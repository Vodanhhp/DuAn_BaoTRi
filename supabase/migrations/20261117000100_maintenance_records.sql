-- User-scoped maintenance data for the single-account rollout.
-- Every row is isolated to the authenticated Supabase user by RLS.

begin;

create table public.maintenance_records (
  owner_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  collection text not null,
  record_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint maintenance_records_pkey
    primary key (owner_id, collection, record_id),
  constraint maintenance_records_collection_check
    check (collection in (
      'assets',
      'inventory',
      'tasks',
      'logs',
      'movements',
      'maintenancePlans',
      'checklistTemplates',
      'checklistVersions',
      'checklistResults'
    )),
  constraint maintenance_records_payload_object_check
    check (jsonb_typeof(payload) = 'object'),
  constraint maintenance_records_payload_id_check
    check (payload ->> 'id' = record_id)
);

create index maintenance_records_owner_updated_idx
  on public.maintenance_records (owner_id, updated_at);

alter table public.maintenance_records enable row level security;

revoke all on table public.maintenance_records from anon, authenticated;
grant select, insert, update on table public.maintenance_records to authenticated;

create policy maintenance_records_select_own
on public.maintenance_records
for select
to authenticated
using (owner_id = (select auth.uid()));

create policy maintenance_records_insert_own
on public.maintenance_records
for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy maintenance_records_update_own
on public.maintenance_records
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

comment on table public.maintenance_records is
  'JSON records for the BAOTRI PWA, isolated to the authenticated owner. Deletes are synchronized as tombstones.';

commit;
