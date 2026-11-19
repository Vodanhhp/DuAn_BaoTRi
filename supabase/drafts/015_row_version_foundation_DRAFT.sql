-- BAOTRI Mini — DRAFT ONLY: row_version foundation
-- Proposed file number: 015
--
-- IMPORTANT:
--   * This file is intentionally under supabase/drafts/, NOT supabase/migrations/.
--   * Do NOT run it on BAOTRI-Mini-Test or Production yet.
--   * Adding row_version alone does NOT prevent lost updates. Before enabling
--     Cloud writes, every mutable-row update must go through an RPC that checks
--     p_expected_version and performs the update atomically.
--   * Direct UPDATE grants must be reviewed/replaced as part of those RPC
--     migrations; do not assume this additive draft completes concurrency control.
--
-- Scope: mutable business/master-data rows only.
-- Append-only history tables (checklist_template_versions, checklist_results,
-- maintenance_logs, inventory_movements) intentionally do not get row_version.
-- asset_images is currently insert/delete metadata and is not included.

begin;

alter table public.assets
  add column row_version bigint not null default 1,
  add constraint assets_row_version_positive check (row_version > 0);

alter table public.inventory_items
  add column row_version bigint not null default 1,
  add constraint inventory_items_row_version_positive check (row_version > 0);

alter table public.maintenance_tasks
  add column row_version bigint not null default 1,
  add constraint maintenance_tasks_row_version_positive check (row_version > 0);

alter table public.maintenance_plans
  add column row_version bigint not null default 1,
  add constraint maintenance_plans_row_version_positive check (row_version > 0);

alter table public.checklist_templates
  add column row_version bigint not null default 1,
  add constraint checklist_templates_row_version_positive check (row_version > 0);

alter table public.organization_settings
  add column row_version bigint not null default 1,
  add constraint organization_settings_row_version_positive check (row_version > 0);

-- The trigger owns row_version. A client-supplied value is never trusted.
-- updated_at is excluded from comparison because its existing trigger changes
-- it for every UPDATE; a timestamp-only update must not count as a business edit.
create or replace function public.set_business_row_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.row_version := 1;
    return new;
  end if;

  if (to_jsonb(new) - 'row_version' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'row_version' - 'updated_at') then
    new.row_version := old.row_version + 1;
  else
    new.row_version := old.row_version;
  end if;

  return new;
end;
$$;

-- PostgreSQL executes same-event triggers alphabetically. These names sort
-- before the existing *_set_updated_at triggers. The comparison excludes
-- updated_at, so the trigger order does not affect the business version.
create trigger assets_set_row_version
before insert or update on public.assets
for each row execute function public.set_business_row_version();

create trigger inventory_items_set_row_version
before insert or update on public.inventory_items
for each row execute function public.set_business_row_version();

create trigger maintenance_tasks_set_row_version
before insert or update on public.maintenance_tasks
for each row execute function public.set_business_row_version();

create trigger maintenance_plans_set_row_version
before insert or update on public.maintenance_plans
for each row execute function public.set_business_row_version();

create trigger checklist_templates_set_row_version
before insert or update on public.checklist_templates
for each row execute function public.set_business_row_version();

create trigger organization_settings_set_row_version
before insert or update on public.organization_settings
for each row execute function public.set_business_row_version();

revoke all on function public.set_business_row_version() from public, anon, authenticated;

comment on function public.set_business_row_version() is
  'DRAFT foundation only: database-owned monotonic row_version for mutable business rows. Optimistic concurrency still requires expected-version RPCs.';

commit;

-- Required verification before promotion to supabase/migrations/:
-- 1. Existing rows start at version 1.
-- 2. INSERT ignores any client-supplied row_version and stores 1.
-- 3. A real business-column UPDATE increments exactly once.
-- 4. UPDATE that changes no business columns leaves row_version unchanged.
-- 5. Inventory quantity changes through the future inventory RPC increment once.
-- 6. Two concurrent updates with the same expected version: exactly one succeeds.
-- 7. A stale expected version returns a conflict snapshot without partial writes.
-- 8. Trigger behavior is checked alongside the existing updated_at triggers.
-- 9. RPCs update the business row once per logical mutation; no duplicate trigger
--    increments caused by multiple UPDATE statements in one RPC.
