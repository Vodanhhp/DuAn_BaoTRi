-- BAOTRI Mini — M022 creator metadata for Cloud Assets
-- DRAFT ONLY. Target: BAOTRI-Mini-Test after explicit approval.
-- Production is out of scope. This file is not an instruction to apply.
-- Purpose: preserve Local Asset creator metadata during selective Local -> Cloud import.
-- Existing Cloud rows remain NULL; no historical creator is fabricated.
-- Cloud-origin creates stamp auth.uid() and JWT email (fallback UUID text).
-- Local imports preserve the exact supplied creator UUID/label.
-- User deletion nulls the UUID but retains the human-readable label.

begin;

alter table public.assets
  add column if not exists created_by_user_id uuid
    references auth.users(id) on delete set null,
  add column if not exists created_by_label text;

CREATE OR REPLACE FUNCTION public.create_asset_with_code(p_organization_id uuid, p_name text, p_category text, p_location text, p_id uuid DEFAULT NULL::uuid, p_brand text DEFAULT ''::text, p_model text DEFAULT ''::text, p_serial text DEFAULT ''::text, p_commissioned_at date DEFAULT CURRENT_DATE, p_power text DEFAULT ''::text, p_cycle text DEFAULT ''::text, p_cycle_started_at date DEFAULT NULL::date, p_transferred_from_other_facility boolean DEFAULT false, p_status text DEFAULT 'Đang hoạt động'::text, p_notes text DEFAULT ''::text)
 RETURNS assets
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
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
    transferred_from_other_facility, status, notes,
    created_by_user_id, created_by_label
  ) values (
    v_asset_id, p_organization_id, v_code, btrim(p_name), btrim(p_category),
    coalesce(p_brand, ''), coalesce(p_model, ''), coalesce(p_serial, ''),
    coalesce(p_location, ''), v_date, coalesce(p_power, ''), coalesce(p_cycle, ''),
    p_cycle_started_at, coalesce(p_transferred_from_other_facility, false),
    coalesce(p_status, 'Đang hoạt động'), coalesce(p_notes, ''),
    auth.uid(), coalesce(nullif(auth.jwt() ->> 'email', ''), auth.uid()::text)
  )
  returning * into v_asset;

  return v_asset;
end;
$function$;

CREATE OR REPLACE FUNCTION public.import_asset_preserving_identity(p_organization_id uuid, p_id uuid, p_code text, p_asset jsonb, p_mutation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_key text;
  v_commissioned_at date;
  v_cycle_started_at date;
  v_archived_at timestamptz;
  v_created_at timestamptz;
  v_updated_at timestamptz;
  v_created_by_user_id uuid;
  v_created_by_label text;
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
      'created_at', 'updated_at', 'created_by_user_id', 'created_by_label'
    )
  ) then
    raise exception 'Asset payload contains unsupported fields' using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_asset -> 'name') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_asset -> 'category') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_asset -> 'status') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_asset -> 'transferred_from_other_facility') is distinct from 'boolean'
     or pg_catalog.jsonb_typeof(p_asset -> 'created_at') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_asset -> 'updated_at') is distinct from 'string'
     or not (p_asset ? 'created_by_user_id')
     or not (p_asset ? 'created_by_label')
     or pg_catalog.jsonb_typeof(p_asset -> 'created_by_user_id') not in ('string', 'null')
     or pg_catalog.jsonb_typeof(p_asset -> 'created_by_label') not in ('string', 'null') then
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
  v_created_by_user_id := nullif(p_asset ->> 'created_by_user_id', '')::uuid;
  v_created_by_label := p_asset ->> 'created_by_label';

  if nullif(btrim(v_name), '') is null or nullif(btrim(v_category), '') is null then
    raise exception 'Asset name and category are required' using errcode = '22023';
  end if;
  if v_status not in ('Đang hoạt động', 'Đang sửa chữa', 'Ngừng sử dụng', 'Thanh lý') then
    raise exception 'Unsupported asset status: %', v_status using errcode = '22023';
  end if;

  -- Asset anchor is always acquired before the existing mutation-ID bigint lock.
  perform private.lock_asset_anchor(p_organization_id, p_id);

  -- Canonical, typed payload binds the mutation ID to the exact intended row.
  v_payload := pg_catalog.jsonb_build_object(
    'id', p_id, 'code', p_code, 'name', v_name, 'category', v_category,
    'brand', v_brand, 'model', v_model, 'serial', v_serial, 'location', v_location,
    'commissioned_at', v_commissioned_at, 'power', v_power, 'cycle', v_cycle,
    'cycle_started_at', v_cycle_started_at,
    'transferred_from_other_facility', v_transferred, 'status', v_status,
    'notes', v_notes, 'archived_at', v_archived_at,
    'created_at', v_created_at, 'updated_at', v_updated_at,
    'created_by_user_id', v_created_by_user_id, 'created_by_label', v_created_by_label
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
  -- Join the global Settings compatibility protocol before reading config.
  perform private.lock_settings_global_shared();

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
      'updated_at', v_existing.updated_at,
      'created_by_user_id', v_existing.created_by_user_id,
      'created_by_label', v_existing.created_by_label
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
      status, notes, archived_at, created_at, updated_at,
      created_by_user_id, created_by_label
    ) values (
      p_id, p_organization_id, p_code, v_name, v_category, v_brand, v_model, v_serial, v_location,
      v_commissioned_at, v_power, v_cycle, v_cycle_started_at, v_transferred,
      v_status, v_notes, v_archived_at, v_created_at, v_updated_at,
      v_created_by_user_id, v_created_by_label
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
$function$;

commit;
