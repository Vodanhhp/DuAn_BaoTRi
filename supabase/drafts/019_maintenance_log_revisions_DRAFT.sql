-- BAOTRI Mini — DRAFT ONLY: append-only maintenance log revisions
-- Proposed sequence: 019 (do not treat this filename as an applied migration).
--
-- Preconditions:
--   * Review supabase/CLOUD_FIRST_SCHEMA_MIGRATION_PLAN.md.
--   * Deploy create/revise/complete-task RPCs in a coordinated cutover before
--     revoking direct maintenance_logs INSERT.
--   * Do NOT run on BAOTRI-Mini-Test or Production yet.
--
-- Legacy preservation:
--   * Existing maintenance_logs IDs and FK relationships are preserved.
--   * Legacy root rows receive revision 1 snapshots from columns that exist.
--   * due_date/requested_by/actor/edit history are NOT reconstructed or guessed.

begin;

alter table public.maintenance_logs
  add column created_by_user_id uuid references auth.users(id) on delete restrict;

create table public.maintenance_log_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  log_id uuid not null,
  revision_no integer not null,
  log_date date,
  due_date date,
  kind text not null default '',
  description text not null default '',
  parts text not null default '',
  readings text not null default '',
  requested_by text,
  result text,
  completed_at timestamptz,
  performed_by text not null default '',
  action text not null,
  reason text,
  edited_by_user_id uuid references auth.users(id) on delete restrict,
  mutation_id uuid,
  created_at timestamptz not null default now(),

  constraint maintenance_log_revisions_org_id_id_unique
    unique (organization_id, id),
  constraint maintenance_log_revisions_log_revision_unique
    unique (organization_id, log_id, revision_no),
  constraint maintenance_log_revisions_root_fk
    foreign key (organization_id, log_id)
    references public.maintenance_logs (organization_id, id)
    on delete restrict,
  constraint maintenance_log_revisions_number_positive
    check (revision_no > 0),
  constraint maintenance_log_revisions_result_check
    check (result is null or result in ('Đạt', 'Không đạt', '')),
  constraint maintenance_log_revisions_action_check
    check (
      (
        revision_no = 1
        and action = 'created'
        and edited_by_user_id is not null
        and mutation_id is not null
        and reason is null
      )
      or
      (
        revision_no = 1
        and action = 'legacy_baseline'
        and edited_by_user_id is null
        and mutation_id is null
        and reason is null
      )
      or
      (
        revision_no > 1
        and action = 'edited'
        and edited_by_user_id is not null
        and mutation_id is not null
        and nullif(btrim(reason), '') is not null
      )
    )
);

create index maintenance_log_revisions_org_log_idx
  on public.maintenance_log_revisions (organization_id, log_id, revision_no desc);

create unique index maintenance_log_revisions_org_mutation_unique
  on public.maintenance_log_revisions (organization_id, mutation_id)
  where mutation_id is not null;

-- Backfill one immutable baseline snapshot per existing Log.
-- Legacy rows intentionally have no authenticated actor or mutation ID.
insert into public.maintenance_log_revisions (
  organization_id, log_id, revision_no,
  log_date, due_date, kind, description, parts, readings,
  requested_by, result, completed_at, performed_by,
  action, reason, edited_by_user_id, mutation_id, created_at
)
select
  l.organization_id, l.id, 1,
  l.log_date, null, l.kind, l.description, l.parts, l.readings,
  null, l.result, l.completed_at, l.performed_by,
  'legacy_baseline', null, null, null, l.created_at
from public.maintenance_logs l
where not exists (
  select 1
  from public.maintenance_log_revisions r
  where r.organization_id = l.organization_id
    and r.log_id = l.id
    and r.revision_no = 1
);

-- Register the dedicated permission. It is intentionally granted only to
-- built-in Admin roles. The RPC must additionally enforce has_org_role(...,
-- 'admin') so a custom role cannot gain Admin-only revision rights by grant.
insert into public.permissions (code, module, action, description)
values (
  'logs.revise',
  'logs',
  'revise',
  'Sửa nhật ký đã lưu bằng phiên bản mới (Admin)'
)
on conflict (code) do update
set module = excluded.module,
    action = excluded.action,
    description = excluded.description;

insert into public.role_permissions (organization_id, role_id, permission_code)
select r.organization_id, r.id, 'logs.revise'
from public.roles r
where r.code = 'admin'
on conflict do nothing;

-- Revision history is readable by members with logs.view only.
alter table public.maintenance_log_revisions enable row level security;

revoke all on table public.maintenance_log_revisions from public, anon, authenticated;

create policy maintenance_log_revisions_select_permission
on public.maintenance_log_revisions
for select to authenticated
using (public.has_org_permission(organization_id, 'logs.view'));

grant select on table public.maintenance_log_revisions to authenticated;

comment on table public.maintenance_log_revisions is
  'Append-only full snapshots for maintenance Logs. Legacy baseline rows preserve only fields available in the original root record.';
comment on column public.maintenance_logs.created_by_user_id is
  'Immutable authenticated creator for new Cloud Logs; NULL for legacy rows whose actor cannot be proven.';

commit;

-- Follow-up RPC/cutover requirements (not implemented by this DDL):
-- 1. create_maintenance_log inserts root + revision 1 + shared Receipt + events.
-- 2. complete_maintenance_task updates Task and inserts Log root + revision 1
--    under one shared mutation/transaction.
-- 3. revise_maintenance_log requires active membership, has_org_role(org,'admin')
--    AND has_org_permission(org,'logs.revise'), expected_revision_no, nonblank
--    reason, then inserts revision_no + 1 only.
-- 4. All RPCs set maintenance_logs.created_by_user_id from auth.uid() on create.
-- 5. No client direct INSERT/UPDATE/DELETE on revisions. After create RPC is
--    deployed, revoke direct INSERT on maintenance_logs in the same cutover.
-- 6. Root payload columns remain for legacy compatibility; canonical UI reads
--    latest revision. Do not update/delete old revision snapshots.
