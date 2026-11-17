-- BAOTRI Mini
-- Migration 012: organization-scoped asset code configuration and atomic cloud creation.
-- Apply to BAOTRI-Mini-Test only. Do not apply to Production without explicit approval.
-- This migration does not import Local/IndexedDB data or modify existing assets.

begin;

alter table public.organization_settings
  add column if not exists asset_code_config jsonb;

alter table public.organization_settings
  drop constraint if exists organization_settings_asset_code_config_object;

alter table public.organization_settings
  add constraint organization_settings_asset_code_config_object
  check (asset_code_config is null or jsonb_typeof(asset_code_config) = 'object');

create table if not exists public.asset_code_counters (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  category_code text not null,
  last_value bigint not null check (last_value >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, category_code),
  constraint asset_code_counters_category_code_format
    check (category_code ~ '^[A-Z0-9]{2,5}$')
);

alter table public.asset_code_counters enable row level security;
revoke all on table public.asset_code_counters from public, anon, authenticated;

create or replace function public.create_asset_with_code(
  p_organization_id uuid,
  p_name text,
  p_category text,
  p_location text,
  p_id uuid default null,
  p_brand text default '',
  p_model text default '',
  p_serial text default '',
  p_commissioned_at date default current_date,
  p_power text default '',
  p_cycle text default '',
  p_cycle_started_at date default null,
  p_transferred_from_other_facility boolean default false,
  p_status text default 'Đang hoạt động',
  p_notes text default ''
)
returns public.assets
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_config jsonb;
  v_facility_code text;
  v_category_code text;
  v_location_code text;
  v_date date;
  v_existing_max bigint := 0;
  v_sequence bigint;
  v_asset_id uuid;
  v_code text;
  v_asset public.assets;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_org_permission(p_organization_id, 'assets.create') then
    raise exception 'Missing assets.create permission for this organization' using errcode = '42501';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'Asset name is required' using errcode = '22023';
  end if;
  if nullif(btrim(p_category), '') is null then
    raise exception 'Asset category is required' using errcode = '22023';
  end if;

  select s.asset_code_config
    into v_config
  from public.organization_settings as s
  where s.organization_id = p_organization_id;

  if v_config is null then
    raise exception 'Asset code configuration is not set for this organization' using errcode = '22023';
  end if;

  v_facility_code := upper(btrim(coalesce(v_config ->> 'facility_code', '')));
  v_category_code := upper(btrim(coalesce(v_config -> 'category_codes' ->> p_category, '')));
  v_location_code := upper(btrim(coalesce(
    v_config -> 'location_codes' ->> coalesce(nullif(btrim(p_location), ''), '__UNASSIGNED__'),
    ''
  )));

  if v_facility_code !~ '^[A-Z0-9]{2,8}$' then
    raise exception 'Invalid or missing facility_code in asset code configuration' using errcode = '22023';
  end if;
  if v_category_code !~ '^[A-Z0-9]{2,5}$' then
    raise exception 'Category is not configured with a valid asset code' using errcode = '22023';
  end if;
  if v_location_code !~ '^[A-Z0-9]{2,4}$' then
    raise exception 'Location is not configured with a valid location code' using errcode = '22023';
  end if;

  v_date := coalesce(p_commissioned_at, current_date);
  v_asset_id := coalesce(p_id, gen_random_uuid());

  -- Find the highest historical sequence for this category across all facilities.
  -- The counter row serializes concurrent calls for the same organization/category.
  select coalesce(max((regexp_match(a.code, '^' || v_category_code || '-[^-]+-([0-9]+)-'))[1]::bigint), 0)
    into v_existing_max
  from public.assets as a
  where a.organization_id = p_organization_id;

  insert into public.asset_code_counters (organization_id, category_code, last_value)
  values (p_organization_id, v_category_code, v_existing_max + 1)
  on conflict (organization_id, category_code)
  do update set
    last_value = greatest(public.asset_code_counters.last_value, v_existing_max) + 1,
    updated_at = now()
  returning last_value into v_sequence;

  v_code := v_category_code || '-' || v_facility_code || '-' ||
    lpad(v_sequence::text, 3, '0') || '-' || v_location_code || '-' ||
    to_char(v_date, 'MM-YY') ||
    case when coalesce(p_transferred_from_other_facility, false) then '*' else '' end;

  insert into public.assets (
    id, organization_id, code, name, category, brand, model, serial, location,
    commissioned_at, power, cycle, cycle_started_at,
    transferred_from_other_facility, status, notes
  ) values (
    v_asset_id, p_organization_id, v_code, btrim(p_name), btrim(p_category),
    coalesce(p_brand, ''), coalesce(p_model, ''), coalesce(p_serial, ''),
    coalesce(p_location, ''), v_date, coalesce(p_power, ''), coalesce(p_cycle, ''),
    p_cycle_started_at, coalesce(p_transferred_from_other_facility, false),
    coalesce(p_status, 'Đang hoạt động'), coalesce(p_notes, '')
  )
  returning * into v_asset;

  return v_asset;
end;
$$;

revoke all on function public.create_asset_with_code(
  uuid, text, text, text, uuid, text, text, text, date, text, text, date, boolean, text, text
) from public, anon;
grant execute on function public.create_asset_with_code(
  uuid, text, text, text, uuid, text, text, text, date, text, text, date, boolean, text, text
) to authenticated;

comment on column public.organization_settings.asset_code_config is
  'Organization-owned asset code configuration: facility_code, category_codes object, location_codes object. Use __UNASSIGNED__ for blank locations.';
comment on table public.asset_code_counters is
  'Atomic per-organization/per-category sequence counters used by create_asset_with_code.';
comment on function public.create_asset_with_code(
  uuid, text, text, text, uuid, text, text, text, date, text, text, date, boolean, text, text
) is
  'Creates an asset and allocates its organization/category sequence atomically. Requires assets.create and organization asset_code_config.';

commit;
