-- BAOTRI Mini — DRAFT ONLY: shared organization mutation Receipt
-- Historical draft label: 020. Sequence reassignment is required because the P0 corrective Migration 020 is now applied.
--
-- PURPOSE
--   One private Receipt per logical business mutation, including mutations
--   that affect multiple records (for example Task + Maintenance Log).
--
-- SAFETY
--   * This file belongs under supabase/drafts/, not supabase/migrations/.
--   * Do NOT run on BAOTRI-Mini-Test or Production.
--   * This DDL creates no business RPC and does not change existing grants,
--     RLS policies, Asset Receipt behavior, row_version, or change feed.
--   * No pgcrypto/hash extension is assumed. request_fingerprint is canonical
--     server-built JSONB and must never be accepted as an authoritative client
--     hash. RPCs must build it from allowlisted, normalized inputs.
--   * A Receipt row is claimed and finalized in the SAME transaction as its
--     business writes. The transient 'pending' state must never commit.
--
-- DEPENDENCIES
--   * Migration 001: public.organizations, auth.users.
--   * Existing organization membership contract:
--       organizations.status = 'active'
--       organization_members.status = 'active'
--   * Future business RPCs must also validate the relevant permission using
--     public.has_org_permission(...). Replay policy is documented below.

begin;

create table public.organization_mutations (
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  mutation_id uuid not null,
  actor_user_id uuid not null
    references auth.users(id) on delete restrict,

  -- Stable business operation code; do not couple this to a SQL function name.
  operation text not null,

  -- Canonical request envelope built by the RPC from normalized allowlisted
  -- values: operation, resource IDs, expected version/revision, and payload.
  -- JSONB equality is used; no client-provided digest is trusted.
  request_fingerprint jsonb not null,

  -- Permission codes required to read every affected resource snapshot.
  -- For a multi-record mutation, the list contains every relevant read
  -- permission (e.g. maintenance.view AND logs.view).
  read_permission_codes text[] not null,

  -- Minimal resource identities/versions for acknowledgement when the actor
  -- no longer has permission to read one or more affected records.
  affected_record_refs jsonb not null default '[]'::jsonb,

  -- Canonical committed response. May contain snapshots for all affected rows.
  result_payload jsonb not null default '{}'::jsonb,

  -- 'pending' exists only inside the uncommitted business transaction.
  -- A deferred constraint trigger below rejects any transaction that tries
  -- to commit while a Receipt is still pending.
  result_status text not null default 'pending',

  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,

  constraint organization_mutations_pkey
    primary key (organization_id, mutation_id),

  constraint organization_mutations_operation_not_blank
    check (char_length(btrim(operation)) between 1 and 120),

  constraint organization_mutations_fingerprint_object
    check (jsonb_typeof(request_fingerprint) = 'object'),

  constraint organization_mutations_read_permissions_nonempty
    check (
      cardinality(read_permission_codes) > 0
      and array_position(read_permission_codes, null) is null
    ),

  constraint organization_mutations_refs_array
    check (jsonb_typeof(affected_record_refs) = 'array'),

  constraint organization_mutations_result_object
    check (jsonb_typeof(result_payload) = 'object'),

  constraint organization_mutations_status_check
    check (result_status in ('pending', 'applied', 'no_change', 'conflict')),

  constraint organization_mutations_completion_consistent
    check (
      (result_status = 'pending' and completed_at is null)
      or
      (result_status in ('applied', 'no_change', 'conflict') and completed_at is not null)
    )
);

create index organization_mutations_actor_created_idx
  on public.organization_mutations
    (organization_id, actor_user_id, created_at desc);

alter table public.organization_mutations enable row level security;

-- A dedicated NOLOGIN role lets the deferred assertion inspect only the
-- final status without granting Receipt access to browser/client roles.
-- It is intentionally not BYPASSRLS and is not a member of client roles.
create role baotri_receipt_guard
  nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
grant usage on schema public to baotri_receipt_guard;
grant select on table public.organization_mutations to baotri_receipt_guard;
create policy organization_mutations_guard_select
  on public.organization_mutations
  for select to baotri_receipt_guard
  using (true);

-- Receipt data can contain canonical business snapshots. Clients must never
-- SELECT or mutate this table directly; only reviewed SECURITY DEFINER RPCs
-- may access it after explicit Auth, membership, permission, actor and
-- fingerprint checks.
revoke all on table public.organization_mutations from public, anon, authenticated;

-- Allow exactly one transition: pending -> a final immutable result.
-- Identity, actor, fingerprint and read requirements cannot be rewritten.
create or replace function public.guard_organization_mutation_receipt()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Mutation receipts are immutable and cannot be deleted'
      using errcode = '55000';
  end if;

  if tg_op = 'INSERT' then
    if new.result_status <> 'pending' or new.completed_at is not null then
      raise exception 'A new receipt must begin pending inside its business transaction'
        using errcode = '55000';
    end if;
    return new;
  end if;

  if old.result_status <> 'pending'
     or new.result_status not in ('applied', 'no_change', 'conflict') then
    raise exception 'Only a pending receipt may be finalized once'
      using errcode = '55000';
  end if;

  if new.organization_id is distinct from old.organization_id
     or new.mutation_id is distinct from old.mutation_id
     or new.actor_user_id is distinct from old.actor_user_id
     or new.operation is distinct from old.operation
     or new.request_fingerprint is distinct from old.request_fingerprint
     or new.read_permission_codes is distinct from old.read_permission_codes
     or new.created_at is distinct from old.created_at then
    raise exception 'Receipt identity and request envelope are immutable'
      using errcode = '55000';
  end if;

  if new.completed_at is null
     or jsonb_typeof(new.affected_record_refs) is distinct from 'array'
     or jsonb_typeof(new.result_payload) is distinct from 'object' then
    raise exception 'Final receipt requires completion time and canonical result'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger organization_mutations_guard_insert
before insert on public.organization_mutations
for each row execute function public.guard_organization_mutation_receipt();

create trigger organization_mutations_guard_update
before update on public.organization_mutations
for each row execute function public.guard_organization_mutation_receipt();

create trigger organization_mutations_guard_delete
before delete on public.organization_mutations
for each row execute function public.guard_organization_mutation_receipt();

-- A deferred check sees the final row state at transaction end. The INSERT
-- trigger event also passes when the same transaction subsequently finalizes
-- the row. A forgotten finalization aborts the entire business transaction.
create or replace function public.assert_organization_mutation_receipt_finalized()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select m.result_status
    into v_status
  from public.organization_mutations m
  where m.organization_id = new.organization_id
    and m.mutation_id = new.mutation_id;

  if v_status is null then
    raise exception 'Mutation receipt disappeared before commit'
      using errcode = '55000';
  end if;

  if v_status = 'pending' then
    raise exception 'Mutation receipt cannot commit in pending state'
      using errcode = '55000';
  end if;

  return null;
end;
$$;

create constraint trigger organization_mutations_must_finalize
after insert or update on public.organization_mutations
deferrable initially deferred
for each row execute function public.assert_organization_mutation_receipt_finalized();

revoke all on function public.guard_organization_mutation_receipt()
  from public, anon, authenticated, service_role;

-- Transfer the deferred assertion to the least-privilege guard role. CREATE
-- is temporary: the role must be able to own the function in public, but
-- must not retain schema-object creation rights afterward.
grant create on schema public to baotri_receipt_guard;
alter function public.assert_organization_mutation_receipt_finalized()
  owner to baotri_receipt_guard;
revoke create on schema public from baotri_receipt_guard;

revoke all on function public.assert_organization_mutation_receipt_finalized()
  from public, anon, authenticated, service_role;

comment on table public.organization_mutations is
  'Private shared idempotency Receipt: one immutable final result per logical organization mutation; pending is transaction-local only.';

comment on column public.organization_mutations.request_fingerprint is
  'Canonical server-built JSONB request envelope. Do not trust client hashes; do not assume pgcrypto is installed.';

comment on column public.organization_mutations.read_permission_codes is
  'All current read permissions required to disclose the full result_payload snapshots.';

comment on column public.organization_mutations.affected_record_refs is
  'Minimal affected resource identities/versions used for a read-safe acknowledgement when full snapshots are no longer readable.';

comment on column public.organization_mutations.result_status is
  'Final values: applied, no_change, conflict. pending is allowed only before transaction commit and is rejected by a deferred constraint trigger.';

commit;

-- REQUIRED CLAIM/REPLAY ALGORITHM FOR EACH FUTURE BUSINESS RPC
-- (intentionally not implemented as a generic callable RPC here):
--
-- 1. Require auth.uid(); verify organization exists and is active, and the
--    caller has active organization_members membership. Do NOT require the
--    operation's write permission yet: an existing committed Receipt is a
--    read-only replay and must remain recoverable after write permission revoke.
-- 2. Validate and normalize the operation payload using a strict allowlist.
--    Build request_fingerprint on the server; include operation, org, actor
--    scope, all resource IDs, expected row/revision version and normalized
--    payload. Never accept a client fingerprint as authoritative.
-- 3. Look up the Receipt by (organization_id, mutation_id), locking it when
--    found. If present, require same actor + exact operation/fingerprint, then
--    replay read-only. Do not require the old write permission again.
-- 4. If no Receipt exists, require the operation-specific write permission.
--    Then attempt to INSERT one pending Receipt with actor_user_id = auth.uid()
--    and ON CONFLICT (organization_id, mutation_id) DO NOTHING.
-- 5. If INSERT did not claim the key, issue a subsequent SELECT ... FOR UPDATE
--    for that key. The unique-key conflict serializes concurrent requests:
--      a. Require the stored actor to equal auth.uid().
--      b. Require exact operation + request_fingerprint equality; otherwise
--         reject idempotency_key_reuse without executing side effects.
--      c. Replay the final Receipt read-only. Require Auth, active organization
--         and active membership. Return full result_payload only if the actor
--         currently has EVERY permission in read_permission_codes via
--         has_org_permission; otherwise return only acknowledgement plus
--         affected_record_refs, never the stored snapshots.
--      d. Different actor, cross-organization, inactive membership or inactive
--         organization: deny without revealing whether a Receipt exists.
-- 6. If this request claimed the key, execute the business mutation, update
--    affected rows, row_version and change events in this same transaction.
--    Then UPDATE this pending Receipt exactly once to applied/no_change/
--    conflict, set affected_record_refs, result_payload and completed_at.
-- 7. Commit all business rows, receipt and events together. Any exception
--    rolls all of them back, including the pending claim. The deferred trigger
--    prevents accidental commit of pending.
-- 8. conflict and no_change are final replayable results; they do not create
--    change events. Applied mutations create one event per changed record.
--
-- CONCURRENCY NOTE
--   Do not catch a unique violation and continue in the same aborted SQL
--   transaction. Use INSERT ... ON CONFLICT DO NOTHING RETURNING, then a
--   separate SELECT statement after the conflict wait. Under READ COMMITTED,
--   that subsequent statement sees the winner's committed final Receipt.
--
-- ASSET TRANSITION
--   Existing asset_mutation_receipts and Asset Edit Lease remain untouched.
--   Do not dual-write this table and the Asset-specific table. A later Asset
--   migration must provide legacy Receipt lookup/replay compatibility before
--   switching Asset RPCs to the shared ledger.
--
-- REQUIRED REVIEW / TESTS BEFORE PROMOTION
--   * Verify deployed schema and migration order; this is a draft, not proof
--     that any prerequisite migration has been applied to Supabase.
--   * Test same mutation ID + same fingerprint concurrently: one execution,
--     one final Receipt, identical replay result.
--   * Test first claimant rollback: waiting request can claim and execute.
--   * Test same key with changed actor, operation, resource, expected version
--     or payload: reject with no side effects.
--   * Test committed write -> lost response -> revoke write permission ->
--     same active actor replay: acknowledgement/snapshot according to current
--     read permissions, without a second business execution.
--   * Test revoked read permission: acknowledgement only, no snapshot leak.
--   * Test inactive membership and inactive organization: deny replay.
--   * Test a Task + Log mutation: one Receipt, two affected refs/events,
--     atomic rollback on failure.
--   * Test no_change and conflict receipts: replay stable; no change events.
--   * Test deferred finalization guard: a pending row cannot commit.
--   * Verify assertion runs as baotri_receipt_guard (NOLOGIN, NOBYPASSRLS),
--     whose only table privilege is SELECT and whose dedicated RLS policy is
--     the only path to inspect Receipt state. Client roles cannot read Receipt.
--   * Confirm Receipt retention policy before any deletion/archive mechanism.
