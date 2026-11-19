-- BAOTRI Mini — Member audit + Invite Saga schema draft
-- STATUS: DESIGN DRAFT ONLY. DO NOT APPLY.
-- Target reviewed: BAOTRI-Mini-Test (read-only metadata snapshot, 2026-11-19).
-- No RPCs, policies granting client reads, or data migrations are included.
-- Before promotion: decide audit-read permission, retention/backup windows,
-- organization-wide vs member-only audit scope, adoption approval, and worker model.

begin;

-- ---------------------------------------------------------------------------
-- 1) Invite Saga operation
-- One row per logical invitation. Auth Admin API remains outside DB transaction.
-- normalized_email is PII: never expose it to clients, receipts, feed, or logs.
-- ---------------------------------------------------------------------------

create table public.organization_member_invite_operations (
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  operation_id uuid not null,
  actor_user_id uuid not null
    references public.profiles(id) on delete restrict,

  normalized_email text not null,
  role_code text not null
    check (role_code in ('technician', 'viewer')),
  resolved_initial_status text
    check (resolved_initial_status is null or resolved_initial_status in ('invited', 'active')),
  request_fingerprint jsonb not null
    check (jsonb_typeof(request_fingerprint) = 'object'),

  status text not null default 'requested'
    check (status in (
      'requested',
      'auth_calling',
      'auth_outcome_unknown',
      'auth_user_resolved',
      'finalize_pending',
      'completed',
      'needs_review',
      'failed_terminal',
      'cancelled'
    )),

  auth_user_id uuid
    references auth.users(id) on delete restrict,
  auth_user_created_by_operation boolean,
  membership_id uuid,
  membership_receipt_mutation_id uuid,

  auth_attempt_count integer not null default 0
    check (auth_attempt_count >= 0),
  current_attempt_id uuid,
  auth_attempt_started_at timestamptz,
  auth_result_observed_at timestamptz,
  lease_expires_at timestamptz,
  retry_after timestamptz,

  last_error_code text
    check (last_error_code is null or last_error_code ~ '^[a-z0-9_.-]{1,96}$'),

  adopted_by_user_id uuid
    references public.profiles(id) on delete restrict,
  adoption_reason text
    check (adoption_reason is null or char_length(btrim(adoption_reason)) between 1 and 1000),
  adopted_at timestamptz,

  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,

  constraint organization_member_invite_operations_pkey
    primary key (organization_id, operation_id),

  constraint organization_member_invite_email_nonblank
    check (char_length(btrim(normalized_email)) between 3 and 320),

  constraint organization_member_invite_email_normalized
    check (normalized_email = lower(btrim(normalized_email))),

  constraint organization_member_invite_adoption_consistent
    check (
      (adopted_by_user_id is null and adoption_reason is null and adopted_at is null)
      or
      (adopted_by_user_id is not null and adoption_reason is not null
        and char_length(btrim(adoption_reason)) between 1 and 1000
        and adopted_at is not null
        and adopted_by_user_id <> actor_user_id)
    ),

  constraint organization_member_invite_auth_creator_consistent
    check (auth_user_created_by_operation is null or auth_user_id is not null),

  constraint organization_member_invite_completed_consistent
    check (
      status <> 'completed'
      or (
        auth_user_id is not null
        and membership_id is not null
        and membership_receipt_mutation_id is not null
        and resolved_initial_status is not null
        and completed_at is not null
      )
    ),

  constraint organization_member_invite_auth_resolved_consistent
    check (
      status not in ('auth_user_resolved', 'finalize_pending', 'completed')
      or (auth_user_id is not null and resolved_initial_status is not null)
    )
);

comment on table public.organization_member_invite_operations is
  'Private multi-phase Invite Saga state. Contains normalized_email PII; access only through controlled server RPCs.';
comment on column public.organization_member_invite_operations.normalized_email is
  'PII. Never return to client, Shared Receipt, Change Feed, audit payload, error or telemetry.';
comment on column public.organization_member_invite_operations.resolved_initial_status is
  'Immutable initial membership status resolved once by server and reused for stable member.create fingerprint.';
comment on column public.organization_member_invite_operations.membership_id is
  'Scalar historical reference; deliberately no FK so later membership removal cannot erase Saga history.';
comment on column public.organization_member_invite_operations.membership_receipt_mutation_id is
  'Scalar reference to Shared Receipt mutation ID; asset-specific Receipt remains separate.';

create index organization_member_invite_operations_recovery_idx
  on public.organization_member_invite_operations
    (organization_id, status, retry_after, created_at);

create index organization_member_invite_operations_auth_user_idx
  on public.organization_member_invite_operations
    (auth_user_id)
  where auth_user_id is not null;

create index organization_member_invite_operations_lease_idx
  on public.organization_member_invite_operations
    (lease_expires_at)
  where status = 'auth_calling';

-- ---------------------------------------------------------------------------
-- 2) Append-only organization member audit events
-- Does not FK target_membership_id: audit survives membership deletion.
-- Saga operation FK is RESTRICT: operation history cannot be silently removed.
-- actor_kind distinguishes an authenticated human action from server orchestration.
-- ---------------------------------------------------------------------------

create table public.organization_member_audit_events (
  audit_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,

  actor_kind text not null
    check (actor_kind in ('user', 'system')),
  actor_user_id uuid
    references public.profiles(id) on delete restrict,

  action_code text not null
    check (action_code in (
      'member.create',
      'member.role.change',
      'member.status.change',
      'member.remove',
      'member.self.activate',
      'member.invite.adopt',
      'member.invite.state.change'
    )),

  target_membership_id uuid,
  invite_operation_id uuid,
  mutation_id uuid,

  before_state jsonb not null default '{}'::jsonb
    check (jsonb_typeof(before_state) = 'object'),
  after_state jsonb not null default '{}'::jsonb
    check (jsonb_typeof(after_state) = 'object'),
  reason text
    check (reason is null or char_length(btrim(reason)) between 1 and 1000),

  outcome text not null default 'applied'
    check (outcome = 'applied'),
  schema_version smallint not null default 1
    check (schema_version > 0),
  occurred_at timestamptz not null default clock_timestamp(),

  constraint organization_member_audit_actor_consistent
    check (
      (actor_kind = 'user' and actor_user_id is not null)
      or
      (actor_kind = 'system' and actor_user_id is null
        and action_code = 'member.invite.state.change')
    ),

  constraint organization_member_audit_target_required
    check (
      action_code not in (
        'member.create',
        'member.role.change',
        'member.status.change',
        'member.remove',
        'member.self.activate'
      )
      or target_membership_id is not null
    ),

  constraint organization_member_audit_mutation_required
    check (
      action_code not in (
        'member.create',
        'member.role.change',
        'member.status.change',
        'member.remove',
        'member.self.activate'
      )
      or mutation_id is not null
    ),

  constraint organization_member_audit_invite_operation_fk
    foreign key (organization_id, invite_operation_id)
    references public.organization_member_invite_operations(organization_id, operation_id)
    on delete restrict,

  constraint organization_member_audit_adoption_reason
    check (
      action_code <> 'member.invite.adopt'
      or (actor_kind = 'user' and reason is not null
        and char_length(btrim(reason)) between 1 and 1000)
    ),

  constraint organization_member_audit_invite_operation_required
    check (
      action_code not in ('member.create', 'member.invite.adopt', 'member.invite.state.change')
      or invite_operation_id is not null
    ),

  constraint organization_member_audit_before_state_keys
    check (before_state - 'role_code' - 'membership_status' - 'saga_status' = '{}'::jsonb),
  constraint organization_member_audit_after_state_keys
    check (after_state - 'role_code' - 'membership_status' - 'saga_status' = '{}'::jsonb),

  constraint organization_member_audit_before_role_code
    check (not (before_state ? 'role_code') or coalesce(before_state->>'role_code' in ('admin', 'technician', 'viewer'), false)),
  constraint organization_member_audit_after_role_code
    check (not (after_state ? 'role_code') or coalesce(after_state->>'role_code' in ('admin', 'technician', 'viewer'), false)),

  constraint organization_member_audit_before_membership_status
    check (not (before_state ? 'membership_status') or coalesce(before_state->>'membership_status' in ('invited', 'active', 'suspended', 'removed'), false)),
  constraint organization_member_audit_after_membership_status
    check (not (after_state ? 'membership_status') or coalesce(after_state->>'membership_status' in ('invited', 'active', 'suspended', 'removed'), false)),

  constraint organization_member_audit_before_saga_status
    check (not (before_state ? 'saga_status') or coalesce(before_state->>'saga_status' in (
      'requested', 'auth_calling', 'auth_outcome_unknown', 'auth_user_resolved',
      'finalize_pending', 'completed', 'needs_review', 'failed_terminal', 'cancelled'
    ), false)),
  constraint organization_member_audit_after_saga_status
    check (not (after_state ? 'saga_status') or coalesce(after_state->>'saga_status' in (
      'requested', 'auth_calling', 'auth_outcome_unknown', 'auth_user_resolved',
      'finalize_pending', 'completed', 'needs_review', 'failed_terminal', 'cancelled'
    ))
);

comment on table public.organization_member_audit_events is
  'Append-only audit of membership lifecycle and Invite Saga adoption/state transitions. Not a Change Feed.';
comment on column public.organization_member_audit_events.target_membership_id is
  'Scalar only, intentionally no FK/cascade; preserves audit after membership removal.';
comment on column public.organization_member_audit_events.before_state is
  'Allowlisted minimal state only (e.g. role_code/status); never full row or PII.';
comment on column public.organization_member_audit_events.after_state is
  'Allowlisted minimal state only (e.g. role_code/status); never full row or PII.';
comment on column public.organization_member_audit_events.actor_kind is
  'user = real authenticated actor; system is reserved for member.invite.state.change only and requires actor_user_id NULL.';
comment on column public.organization_member_audit_events.reason is
  'Nonblank bounded reason when present. RPC must reject PII, email, tokens and secrets; SQL length checks cannot detect sensitive text.';

create index organization_member_audit_events_org_time_idx
  on public.organization_member_audit_events
    (organization_id, occurred_at desc, audit_id desc);

create index organization_member_audit_events_target_time_idx
  on public.organization_member_audit_events
    (organization_id, target_membership_id, occurred_at desc)
  where target_membership_id is not null;

create index organization_member_audit_events_invite_idx
  on public.organization_member_audit_events
    (organization_id, invite_operation_id, occurred_at desc)
  where invite_operation_id is not null;

-- ---------------------------------------------------------------------------
-- 3) Append-only guard. No client UPDATE/DELETE/TRUNCATE grants are issued.
-- Table owner/superuser remains a privileged operational boundary.
-- ---------------------------------------------------------------------------

create function public.reject_member_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  raise exception 'member_audit_is_append_only'
    using errcode = '55000';
end;
$function$;

revoke all on function public.reject_member_audit_mutation() from public, anon, authenticated, service_role;

create trigger organization_member_audit_events_no_update_delete
before update or delete on public.organization_member_audit_events
for each row execute function public.reject_member_audit_mutation();

-- ---------------------------------------------------------------------------
-- 4) Private access boundary
-- No direct client table access. Controlled SECURITY DEFINER RPCs are required.
-- Do not grant service_role direct table access by default; server RPCs execute
-- under a reviewed owner and expose only purpose-specific operations.
-- ---------------------------------------------------------------------------

alter table public.organization_member_invite_operations enable row level security;
alter table public.organization_member_audit_events enable row level security;

revoke all on table public.organization_member_invite_operations
  from public, anon, authenticated, service_role;
revoke all on table public.organization_member_audit_events
  from public, anon, authenticated, service_role;

-- No policies are intentionally created in this draft.
-- Audit read RPC and permission code are deliberately deferred pending product decision.
-- No TTL/cleanup/archive job is created: retention and backup windows are unresolved.

commit;

-- REVIEW GATES BEFORE PROMOTION:
-- 1. Decide audit scope and read permission (e.g. users.audit.view vs audit.view).
-- 2. Decide retention for audit, Saga terminal rows, unresolved rows, and backups.
-- 3. Approve/reject cross-Admin adoption and define actor/authorization semantics.
-- 4. Decide manual recovery vs worker; if worker, design attempt history and lease protocol.
-- 5. Review PII encryption/key management for normalized_email.
-- 6. Implement and test RPCs, grants, function ownership, RLS, lock order and atomic audit.
-- 7. Verify target schema again immediately before any migration; this file is not executable approval.
