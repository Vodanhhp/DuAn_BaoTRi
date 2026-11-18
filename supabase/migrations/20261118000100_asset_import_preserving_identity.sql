-- BAOTRI Mini - Preserve Local asset identity during explicit Cloud import.
-- Apply to BAOTRI-Mini-Test first. Do not apply to Production without explicit approval.
-- This migration adds a separate Admin-only import permission and RPC.
-- It does not import data or modify existing assets.

begin;

insert into public.permissions (code, module, action, description)
values ('assets.import', 'assets', 'import', 'Nhập hồ sơ thiết bị đã có từ dữ liệu Local, giữ nguyên UUID và mã quản lý')
on conflict (code) do update set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description;

-- Grant this permission only to the built-in Admin role in each organization.
insert into public.role_permissions (organization_id, role_id, permission_code)
select r.organization_id, r.id, 'assets.import'
from public.roles r
where r.code = 'admin'
on conflict do nothing;

delete from public.role_permissions rp
using public.roles r
where rp.organization_id = r.organization_id
  and rp.role_id = r.id
  and rp.permission_code = 'assets.import'
  and r.code <> 'admin';

create table public.asset_import_mutations (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  mutation_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  asset_id uuid not null,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, mutation_id)
);

alter table public.asset_import_mutations enable row level security;
revoke all on table public.asset_import_mutations from public, anon, authenticated;

create or replace function public.import_asset_preserving_identity(
  p_organization_id uuid,
  p_id uuid,
  p_code text,
  p_asset jsonb,
  p_mutation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_actor uuid := auth.uid();
  v_key text;
  v_commissioned_at date;
  v_cycle_started_at date;
  v_archived_at timestamptz;
  v_created_at timestamptz;
  v_updated_at timestamptz;
  v_transferred boolean;
  v_name text;
  v_category text;
  v_brand text;
  v_model text;
  v_serial text;
  v_location text;
  v_power text;
  v_cycle text;
  v_status text;
  v_notes text;
  v_payload jsonb;
  v_existing_payload jsonb;
  v_existing public.assets;
  v_asset public.assets;
  v_config jsonb;
  v_category_code text;
  v_code_match text[];
  v_counter_reconciled boolean := false;
  v_already_present boolean := false;
  v_ledger_actor uuid;
  v_ledger_asset_id uuid;
  v_ledger_payload jsonb;
  v_ledger_result jsonb;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_organization_id is null or p_id is null or p_mutation_id is null then
    raise exception 'Organization, asset UUID and mutation UUID are required' using errcode = '22023';
  end if;
  if nullif(btrim(p_code), '') is null then
    raise exception 'Asset management code is required' using errcode = '22023';
  end if;
  if not public.has_org_permission(p_organization_id, 'assets.import') then
    raise exception 'Missing assets.import permission for this organization' using errcode = '42501';
  end if;
  if p_asset is null or pg_catalog.jsonb_typeof(p_asset) <> 'object' then
    raise exception 'Asset payload must be a JSON object' using errcode = '22023';
  end if;

  -- Reject unknown fields; the RPC never accepts arbitrary table columns.
  if exists (
    select 1
    from pg_catalog.jsonb_object_keys(p_asset) as supplied(key)
    where supplied.key not in (
      'name', 'category', 'brand', 'model', 'serial', 'location',
      'commissioned_at', 'power', 'cycle', 'cycle_started_at',
      'transferred_from_other_facility', 'status', 'notes', 'archived_at',
      'created_at', 'updated_at'
    )
  ) then
    raise exception 'Asset payload contains unsupported fields' using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_asset -> 'name') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_asset -> 'category') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_asset -> 'status') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_asset -> 'transferred_from_other_facility') is distinct from 'boolean'
     or pg_catalog.jsonb_typeof(p_asset -> 'created_at') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_asset -> 'updated_at') is distinct from 'string' then
    raise exception 'Asset payload is missing required fields or has invalid field types' using errcode = '22023';
  end if;

  foreach v_key in array array[
    'brand', 'model', 'serial', 'location', 'power', 'cycle', 'notes'
  ] loop
    if p_asset ? v_key and pg_catalog.jsonb_typeof(p_asset -> v_key) not in ('string', 'null') then
      raise exception 'Invalid text field: %', v_key using errcode = '22023';
    end if;
  end loop;

  foreach v_key in array array['commissioned_at', 'cycle_started_at', 'archived_at'] loop
    if p_asset ? v_key and pg_catalog.jsonb_typeof(p_asset -> v_key) not in ('string', 'null') then
      raise exception 'Invalid date field: %', v_key using errcode = '22023';
    end if;
  end loop;

  v_name := p_asset ->> 'name';
  v_category := p_asset ->> 'category';
  v_brand := coalesce(p_asset ->> 'brand', '');
  v_model := coalesce(p_asset ->> 'model', '');
  v_serial := coalesce(p_asset ->> 'serial', '');
  v_location := coalesce(p_asset ->> 'location', '');
  v_power := coalesce(p_asset ->> 'power', '');
  v_cycle := coalesce(p_asset ->> 'cycle', '');
  v_status := p_asset ->> 'status';
  v_notes := coalesce(p_asset ->> 'notes', '');
  v_transferred := (p_asset ->> 'transferred_from_other_facility')::boolean;
  v_commissioned_at := nullif(p_asset ->> 'commissioned_at', '')::date;
  v_cycle_started_at := nullif(p_asset ->> 'cycle_started_at', '')::date;
  v_archived_at := nullif(p_asset ->> 'archived_at', '')::timestamptz;
  v_created_at := (p_asset ->> 'created_at')::timestamptz;
  v_updated_at := (p_asset ->> 'updated_at')::timestamptz;

  if nullif(btrim(v_name), '') is null or nullif(btrim(v_category), '') is null then
    raise exception 'Asset name and category are required' using errcode = '22023';
  end if;
  if v_status not in ('Đang hoạt động', 'Đang sửa chữa', 'Ngừng sử dụng', 'Thanh lý') then
    raise exception 'Unsupported asset status: %', v_status using errcode = '22023';
  end if;

  -- Canonical, typed payload binds the mutation ID to the exact intended row.
  v_payload := pg_catalog.jsonb_build_object(
    'id', p_id, 'code', p_code, 'name', v_name, 'category', v_category,
    'brand', v_brand, 'model', v_model, 'serial', v_serial, 'location', v_location,
    'commissioned_at', v_commissioned_at, 'power', v_power, 'cycle', v_cycle,
    'cycle_started_at', v_cycle_started_at,
    'transferred_from_other_facility', v_transferred, 'status', v_status,
    'notes', v_notes, 'archived_at', v_archived_at,
    'created_at', v_created_at, 'updated_at', v_updated_at
  );

  -- Serialize retries using the same mutation ID.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text || ':' || p_mutation_id::text, 0)
  );

  select actor_user_id, asset_id, payload, result
    into v_ledger_actor, v_ledger_asset_id, v_ledger_payload, v_ledger_result
  from public.asset_import_mutations
  where organization_id = p_organization_id
    and mutation_id = p_mutation_id;

  if found then
    if v_ledger_actor <> v_actor
       or v_ledger_asset_id <> p_id
       or v_ledger_payload <> v_payload then
      raise exception 'Mutation ID was already used for a different actor, asset or payload'
        using errcode = '23505';
    end if;
    return v_ledger_result;
  end if;

  -- Lock/reconcile the allocator counter before inserting the asset.
  -- This serializes a recognized import against create_asset_with_code for
  -- the same organization/category; a later failure rolls this update back.
  -- Historical/unrecognized codes are preserved unchanged and require review.
  select asset_code_config into v_config
  from public.organization_settings
  where organization_id = p_organization_id;

  v_category_code := upper(btrim(coalesce(
    v_config -> 'category_codes' ->> v_category, ''
  )));
  if v_category_code ~ '^[A-Z0-9]{2,5}$' then
    v_code_match := pg_catalog.regexp_match(
      p_code, '^' || v_category_code || '-[^-]+-([0-9]+)-'
    );
    if v_code_match is not null then
      insert into public.asset_code_counters (
        organization_id, category_code, last_value
      ) values (
        p_organization_id, v_category_code, v_code_match[1]::bigint
      )
      on conflict (organization_id, category_code)
      do update set
        last_value = greatest(
          public.asset_code_counters.last_value,
          excluded.last_value
        ),
        updated_at = now();
      v_counter_reconciled := true;
    end if;
  end if;

  select * into v_existing
  from public.assets
  where organization_id = p_organization_id and id = p_id
  for update;

  if found then
    v_existing_payload := pg_catalog.jsonb_build_object(
      'id', v_existing.id, 'code', v_existing.code, 'name', v_existing.name,
      'category', v_existing.category, 'brand', v_existing.brand, 'model', v_existing.model,
      'serial', v_existing.serial, 'location', v_existing.location,
      'commissioned_at', v_existing.commissioned_at, 'power', v_existing.power,
      'cycle', v_existing.cycle, 'cycle_started_at', v_existing.cycle_started_at,
      'transferred_from_other_facility', v_existing.transferred_from_other_facility,
      'status', v_existing.status, 'notes', v_existing.notes,
      'archived_at', v_existing.archived_at, 'created_at', v_existing.created_at,
      'updated_at', v_existing.updated_at
    );
    if v_existing_payload <> v_payload then
      raise exception 'Asset UUID already exists with a different Cloud payload: %', p_id
        using errcode = '23505';
    end if;
    v_asset := v_existing;
    v_already_present := true;
  else
    if exists (
      select 1 from public.assets
      where organization_id = p_organization_id and code = p_code
    ) then
      raise exception 'Asset management code already belongs to another Cloud UUID: %', p_code
        using errcode = '23505';
    end if;

    insert into public.assets (
      id, organization_id, code, name, category, brand, model, serial, location,
      commissioned_at, power, cycle, cycle_started_at, transferred_from_other_facility,
      status, notes, archived_at, created_at, updated_at
    ) values (
      p_id, p_organization_id, p_code, v_name, v_category, v_brand, v_model, v_serial, v_location,
      v_commissioned_at, v_power, v_cycle, v_cycle_started_at, v_transferred,
      v_status, v_notes, v_archived_at, v_created_at, v_updated_at
    )
    returning * into v_asset;
  end if;

  v_result := pg_catalog.jsonb_build_object(
    'asset', pg_catalog.to_jsonb(v_asset),
    'already_present', v_already_present,
    'counter_reconciled', v_counter_reconciled
  );

  insert into public.asset_import_mutations (
    organization_id, mutation_id, actor_user_id, asset_id, payload, result
  ) values (
    p_organization_id, p_mutation_id, v_actor, p_id, v_payload, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.import_asset_preserving_identity(uuid, uuid, text, jsonb, uuid)
  from public, anon;
grant execute on function public.import_asset_preserving_identity(uuid, uuid, text, jsonb, uuid)
  to authenticated;

comment on function public.import_asset_preserving_identity(uuid, uuid, text, jsonb, uuid) is
  'Admin-only explicit Local asset import. Preserves UUID and management code, never overwrites Cloud rows, records idempotency, and reconciles recognized asset-code counters.';

comment on table public.asset_import_mutations is
  'Private idempotency ledger for explicit Admin-only asset imports. Not directly accessible to clients.';

commit;
 then
    v_code_match := pg_catalog.regexp_match(
      p_code, '^' || v_category_code || '-[^-]+-([0-9]+)-'
    );
    if v_code_match is not null then
      insert into public.asset_code_counters (
        organization_id, category_code, last_value
      ) values (
        p_organization_id, v_category_code, v_code_match[1]::bigint
      )
      on conflict (organization_id, category_code)
      do update set
        last_value = greatest(
          public.asset_code_counters.last_value,
          excluded.last_value
        ),
        updated_at = now();
      v_counter_reconciled := true;
    end if;
  end if;

  select * into v_existing
  from public.assets
  where organization_id = p_organization_id and id = p_id
  for update;

  if found then
    v_existing_payload := pg_catalog.jsonb_build_object(
      'id', v_existing.id, 'code', v_existing.code, 'name', v_existing.name,
      'category', v_existing.category, 'brand', v_existing.brand, 'model', v_existing.model,
      'serial', v_existing.serial, 'location', v_existing.location,
      'commissioned_at', v_existing.commissioned_at, 'power', v_existing.power,
      'cycle', v_existing.cycle, 'cycle_started_at', v_existing.cycle_started_at,
      'transferred_from_other_facility', v_existing.transferred_from_other_facility,
      'status', v_existing.status, 'notes', v_existing.notes,
      'archived_at', v_existing.archived_at, 'created_at', v_existing.created_at,
      'updated_at', v_existing.updated_at
    );
    if v_existing_payload <> v_payload then
      raise exception 'Asset UUID already exists with a different Cloud payload: %', p_id
        using errcode = '23505';
    end if;
    v_asset := v_existing;
    v_already_present := true;
  else
    if exists (
      select 1 from public.assets
      where organization_id = p_organization_id and code = p_code
    ) then
      raise exception 'Asset management code already belongs to another Cloud UUID: %', p_code
        using errcode = '23505';
    end if;

    insert into public.assets (
      id, organization_id, code, name, category, brand, model, serial, location,
      commissioned_at, power, cycle, cycle_started_at, transferred_from_other_facility,
      status, notes, archived_at, created_at, updated_at
    ) values (
      p_id, p_organization_id, p_code, v_name, v_category, v_brand, v_model, v_serial, v_location,
      v_commissioned_at, v_power, v_cycle, v_cycle_started_at, v_transferred,
      v_status, v_notes, v_archived_at, v_created_at, v_updated_at
    )
    returning * into v_asset;
  end if;

  v_result := pg_catalog.jsonb_build_object(
    'asset', pg_catalog.to_jsonb(v_asset),
    'already_present', v_already_present,
    'counter_reconciled', v_counter_reconciled
  );

  insert into public.asset_import_mutations (
    organization_id, mutation_id, actor_user_id, asset_id, payload, result
  ) values (
    p_organization_id, p_mutation_id, v_actor, p_id, v_payload, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.import_asset_preserving_identity(uuid, uuid, text, jsonb, uuid)
  from public, anon;
grant execute on function public.import_asset_preserving_identity(uuid, uuid, text, jsonb, uuid)
  to authenticated;

comment on function public.import_asset_preserving_identity(uuid, uuid, text, jsonb, uuid) is
  'Admin-only explicit Local asset import. Preserves UUID and management code, never overwrites Cloud rows, records idempotency, and reconciles recognized asset-code counters.';

comment on table public.asset_import_mutations is
  'Private idempotency ledger for explicit Admin-only asset imports. Not directly accessible to clients.';

commit;
