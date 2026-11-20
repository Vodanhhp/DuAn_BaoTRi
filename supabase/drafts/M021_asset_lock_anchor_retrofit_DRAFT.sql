-- BAOTRI Mini — DRAFT ONLY: M021 Asset/Lease lock-anchor retrofit.
-- Current applied baseline on BAOTRI-Mini-Test: Migration 020 P0 payload fix.
-- This candidate combines the former lock primitive/Settings bridge and all
-- Asset writer retrofits in ONE transaction to avoid a committed mixed protocol.
-- Do not apply to Production. Two-session concurrency gates remain mandatory.

begin;

-- Private, non-Data-API lock implementation. Client roles receive no schema
-- USAGE and no function EXECUTE. Business SECURITY DEFINER functions run as
-- postgres and call these helpers; the Settings statement trigger is the only
-- direct-client entry, and it only acquires a lock.
create schema private authorization postgres;
revoke all on schema private from public, anon, authenticated, service_role;

create function private.lock_two_int(p_key_input text, p_shared boolean default false)
returns void
language plpgsql
security invoker
set search_path = ''
as $lock$
declare
  v_hash bigint;
  v_hi_u bigint;
  v_lo_u bigint;
  v_hi integer;
  v_lo integer;
begin
  if p_key_input is null or p_key_input !~ '[^[:space:]]' then
    raise exception 'Advisory lock key input is required' using errcode = '22023';
  end if;

  v_hash := pg_catalog.hashtextextended(p_key_input, 0);
  v_hi_u := (v_hash >> 32) & 4294967295;
  v_lo_u := v_hash & 4294967295;

  -- Convert unsigned 32-bit halves to signed int32 without overflow.
  v_hi := (
    case when v_hi_u >= 2147483648 then v_hi_u - 4294967296 else v_hi_u end
  )::integer;
  v_lo := (
    case when v_lo_u >= 2147483648 then v_lo_u - 4294967296 else v_lo_u end
  )::integer;

  if p_shared then
    perform pg_catalog.pg_advisory_xact_lock_shared(v_hi, v_lo);
  else
    perform pg_catalog.pg_advisory_xact_lock(v_hi, v_lo);
  end if;
end;
$lock$;

create function private.lock_asset_anchor(p_organization_id uuid, p_asset_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $lock$
begin
  if p_organization_id is null or p_asset_id is null then
    raise exception 'Organization and Asset IDs are required' using errcode = '22023';
  end if;

  perform private.lock_two_int(
    'baotri:asset-anchor:v1:' || p_organization_id::text || ':' || p_asset_id::text,
    false
  );
end;
$lock$;

create function private.lock_settings_global_shared()
returns void
language plpgsql
security invoker
set search_path = ''
as $lock$
begin
  perform private.lock_two_int('baotri:settings-global:v1', true);
end;
$lock$;

create function private.lock_settings_global_exclusive()
returns void
language plpgsql
security invoker
set search_path = ''
as $lock$
begin
  perform private.lock_two_int('baotri:settings-global:v1', false);
end;
$lock$;

-- Statement-level trigger runs before row processing/tuple locks, including
-- UPDATE/INSERT statements that affect zero rows. It protects the live legacy
-- PostgREST Settings writer during the compatibility window.
create function private.guard_settings_global_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $lock$
begin
  perform private.lock_settings_global_exclusive();
  return null;
end;
$lock$;

revoke all on function private.lock_two_int(text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function private.lock_asset_anchor(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.lock_settings_global_shared()
  from public, anon, authenticated, service_role;
revoke all on function private.lock_settings_global_exclusive()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_settings_global_write()
  from public, anon, authenticated, service_role;

create trigger organization_settings_global_write_lock
before insert or update on public.organization_settings
for each statement
execute function private.guard_settings_global_write();

CREATE OR REPLACE FUNCTION public.acquire_asset_edit_lock(p_organization_id uuid, p_asset_id uuid, p_device_id uuid, p_holder_label text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_lock public.asset_edit_locks;
  v_label text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_organization_id is null or p_asset_id is null or p_device_id is null then
    raise exception 'Organization, asset and device identifiers are required' using errcode = '22023';
  end if;
  if not public.has_org_permission(p_organization_id, 'assets.update') then
    raise exception 'Missing assets.update permission for this organization' using errcode = '42501';
  end if;

  -- Serialize every lifecycle path for this organization + Asset.
  perform private.lock_asset_anchor(p_organization_id, p_asset_id);

  if not exists (
    select 1 from public.assets a
    where a.organization_id = p_organization_id and a.id = p_asset_id
  ) then
    raise exception 'Asset not found in this organization' using errcode = 'P0002';
  end if;

  v_label := left(coalesce(
    nullif(btrim(p_holder_label), ''),
    nullif(auth.jwt() ->> 'email', ''),
    auth.uid()::text
  ), 160);

  insert into public.asset_edit_locks (
    organization_id, asset_id, holder_user_id, holder_device_id,
    holder_label, lock_token, acquired_at, expires_at, updated_at
  ) values (
    p_organization_id, p_asset_id, auth.uid(), p_device_id,
    v_label, gen_random_uuid(), clock_timestamp(),
    clock_timestamp() + interval '2 minutes', clock_timestamp()
  )
  on conflict (organization_id, asset_id) do update
    set holder_user_id = excluded.holder_user_id,
        holder_device_id = excluded.holder_device_id,
        holder_label = excluded.holder_label,
        lock_token = excluded.lock_token,
        acquired_at = excluded.acquired_at,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    where public.asset_edit_locks.expires_at <= clock_timestamp()
  returning * into v_lock;

  if found then
    return jsonb_build_object(
      'acquired', true,
      'asset_id', v_lock.asset_id,
      'holder_user_id', v_lock.holder_user_id,
      'holder_device_id', v_lock.holder_device_id,
      'holder_label', v_lock.holder_label,
      'lock_token', v_lock.lock_token,
      'acquired_at', v_lock.acquired_at,
      'expires_at', v_lock.expires_at
    );
  end if;

  select * into v_lock
  from public.asset_edit_locks l
  where l.organization_id = p_organization_id
    and l.asset_id = p_asset_id
    and l.expires_at > clock_timestamp();

  if not found then
    -- The conflicting lease expired between the attempted upsert and read.
    -- The caller must retry acquisition; never return a token it does not own.
    return jsonb_build_object('acquired', false, 'retry', true);
  end if;

  return jsonb_build_object(
    'acquired', false,
    'asset_id', v_lock.asset_id,
    'holder_user_id', v_lock.holder_user_id,
    'holder_device_id', v_lock.holder_device_id,
    'holder_label', v_lock.holder_label,
    'acquired_at', v_lock.acquired_at,
    'expires_at', v_lock.expires_at
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.heartbeat_asset_edit_lock(p_organization_id uuid, p_asset_id uuid, p_lock_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_expires_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.has_org_permission(p_organization_id, 'assets.update') then
    raise exception 'Missing assets.update permission for this organization' using errcode = '42501';
  end if;
  if p_lock_token is null then
    raise exception 'Lock token is required' using errcode = '22023';
  end if;
  if p_asset_id is null then
    return jsonb_build_object('renewed', false, 'reason', 'lease_missing_expired_or_replaced');
  end if;

  perform private.lock_asset_anchor(p_organization_id, p_asset_id);

  update public.asset_edit_locks l
  set expires_at = clock_timestamp() + interval '2 minutes',
      updated_at = clock_timestamp()
  where l.organization_id = p_organization_id
    and l.asset_id = p_asset_id
    and l.holder_user_id = auth.uid()
    and l.lock_token = p_lock_token
    and l.expires_at > clock_timestamp()
  returning l.expires_at into v_expires_at;

  if not found then
    return jsonb_build_object('renewed', false, 'reason', 'lease_missing_expired_or_replaced');
  end if;

  return jsonb_build_object('renewed', true, 'expires_at', v_expires_at);
end;
$function$;

CREATE OR REPLACE FUNCTION public.release_asset_edit_lock(p_organization_id uuid, p_asset_id uuid, p_lock_token uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_organization_id is null or p_asset_id is null or p_lock_token is null then
    return false;
  end if;

  -- Release remains a holder/token cleanup operation; no new permission gate.
  perform private.lock_asset_anchor(p_organization_id, p_asset_id);

  delete from public.asset_edit_locks l
  where l.organization_id = p_organization_id
    and l.asset_id = p_asset_id
    and l.holder_user_id = auth.uid()
    and l.lock_token = p_lock_token;

  return found;
end;
$function$;

CREATE OR REPLACE FUNCTION public.apply_asset_mutation_with_lock(p_organization_id uuid, p_asset_id uuid, p_lock_token uuid, p_mutation_id uuid, p_expected_cloud_updated_at timestamp with time zone, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_receipt public.asset_mutation_receipts;
  v_lock public.asset_edit_locks;
  v_asset public.assets;
  v_input public.assets;
  v_snapshot jsonb;
  v_applied_at timestamptz;
  v_required_keys text[] := array[
    'name', 'brand', 'model', 'serial', 'location',
    'commissioned_at', 'power', 'cycle', 'cycle_started_at',
    'transferred_from_other_facility', 'status', 'notes', 'archived_at'
  ];
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_organization_id is null or p_asset_id is null
     or p_lock_token is null or p_mutation_id is null
     or p_expected_cloud_updated_at is null then
    raise exception 'Organization, asset, lease, mutation and expected version are required'
      using errcode = '22023';
  end if;
  if not public.has_org_permission(p_organization_id, 'assets.update') then
    raise exception 'Missing assets.update permission for this organization'
      using errcode = '42501';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object'
     or not (p_payload ?& v_required_keys)
     or (p_payload - v_required_keys) <> '{}'::jsonb then
    raise exception 'Asset mutation payload has missing or unsupported fields'
      using errcode = '22023';
  end if;

  -- Anchor precedes even the fast Receipt replay. The bigint key serializes
  -- the same mutation ID across retries before any Lease/Asset tuple lock.
  perform private.lock_asset_anchor(p_organization_id, p_asset_id);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text || ':' || p_mutation_id::text, 0)
  );

  -- Fast replay path. A committed mutation can be acknowledged after its
  -- original response was lost, even if the lease has since expired.
  select * into v_receipt
  from public.asset_mutation_receipts r
  where r.organization_id = p_organization_id
    and r.mutation_id = p_mutation_id;

  if found then
    if v_receipt.applied_by_user_id <> auth.uid()
       or v_receipt.asset_id <> p_asset_id then
      raise exception 'Mutation receipt belongs to another user or asset'
        using errcode = '42501';
    end if;
    if v_receipt.expected_cloud_updated_at <> p_expected_cloud_updated_at
       or v_receipt.request_payload <> p_payload then
      raise exception 'Mutation ID was already used with a different request'
        using errcode = '22023';
    end if;
    return jsonb_build_object(
      'already_applied', true,
      'asset', v_receipt.result_snapshot,
      'applied_at', v_receipt.applied_at
    );
  end if;

  -- Serialize all mutations for this asset through its lease row.
  select * into v_lock
  from public.asset_edit_locks l
  where l.organization_id = p_organization_id
    and l.asset_id = p_asset_id
  for update;

  -- Recheck receipt after waiting for the lease row. Another identical
  -- request may have committed while this transaction was waiting.
  select * into v_receipt
  from public.asset_mutation_receipts r
  where r.organization_id = p_organization_id
    and r.mutation_id = p_mutation_id;

  if found then
    if v_receipt.applied_by_user_id <> auth.uid()
       or v_receipt.asset_id <> p_asset_id then
      raise exception 'Mutation receipt belongs to another user or asset'
        using errcode = '42501';
    end if;
    if v_receipt.expected_cloud_updated_at <> p_expected_cloud_updated_at
       or v_receipt.request_payload <> p_payload then
      raise exception 'Mutation ID was already used with a different request'
        using errcode = '22023';
    end if;
    return jsonb_build_object(
      'already_applied', true,
      'asset', v_receipt.result_snapshot,
      'applied_at', v_receipt.applied_at
    );
  end if;

  if v_lock.organization_id is null then
    raise exception 'Asset edit lease is missing'
      using errcode = '55000';
  end if;
  if v_lock.holder_user_id <> auth.uid()
     or v_lock.lock_token <> p_lock_token
     or v_lock.expires_at <= clock_timestamp() then
    raise exception 'Asset edit lease is not owned or has expired'
      using errcode = '55000';
  end if;

  select * into v_asset
  from public.assets a
  where a.organization_id = p_organization_id
    and a.id = p_asset_id
  for update;

  if not found then
    raise exception 'Asset not found in this organization'
      using errcode = 'P0002';
  end if;
  if v_asset.updated_at is distinct from p_expected_cloud_updated_at then
    raise exception 'Cloud asset version changed; manual conflict resolution is required'
      using errcode = '40001';
  end if;

  v_input := jsonb_populate_record(null::public.assets, p_payload);
  if nullif(btrim(v_input.name), '') is null then
    raise exception 'Asset name is required' using errcode = '22023';
  end if;
  if v_input.status is null or v_input.status not in (
    'Đang hoạt động', 'Đang sửa chữa', 'Ngừng sử dụng', 'Thanh lý'
  ) then
    raise exception 'Unsupported asset status' using errcode = '22023';
  end if;

  update public.assets a
  set name = btrim(v_input.name),
      brand = coalesce(v_input.brand, ''),
      model = coalesce(v_input.model, ''),
      serial = coalesce(v_input.serial, ''),
      location = coalesce(v_input.location, ''),
      commissioned_at = v_input.commissioned_at,
      power = coalesce(v_input.power, ''),
      cycle = coalesce(v_input.cycle, ''),
      cycle_started_at = v_input.cycle_started_at,
      transferred_from_other_facility = coalesce(v_input.transferred_from_other_facility, false),
      status = v_input.status,
      notes = coalesce(v_input.notes, ''),
      archived_at = v_input.archived_at,
      updated_at = clock_timestamp()
  where a.organization_id = p_organization_id
    and a.id = p_asset_id
  returning * into v_asset;

  v_snapshot := to_jsonb(v_asset);
  v_applied_at := clock_timestamp();

  insert into public.asset_mutation_receipts (
    organization_id, mutation_id, asset_id, applied_by_user_id,
    expected_cloud_updated_at, request_payload, result_snapshot, applied_at
  ) values (
    p_organization_id, p_mutation_id, p_asset_id, auth.uid(),
    p_expected_cloud_updated_at, p_payload, v_snapshot, v_applied_at
  );

  return jsonb_build_object(
    'already_applied', false,
    'asset', v_snapshot,
    'applied_at', v_applied_at
  );
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
$function$;

CREATE OR REPLACE FUNCTION public.update_asset_with_lock(p_organization_id uuid, p_asset_id uuid, p_lock_token uuid, p_name text, p_brand text, p_model text, p_serial text, p_location text, p_commissioned_at date, p_power text, p_cycle text, p_cycle_started_at date, p_transferred_from_other_facility boolean, p_status text, p_notes text)
 RETURNS assets
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_lock public.asset_edit_locks;
  v_asset public.assets;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.has_org_permission(p_organization_id, 'assets.update') then
    raise exception 'Missing assets.update permission for this organization' using errcode = '42501';
  end if;
  if p_lock_token is null then
    raise exception 'Lock token is required' using errcode = '22023';
  end if;
  if p_asset_id is null then
    raise exception 'Asset edit lease is missing' using errcode = '55000';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'Asset name is required' using errcode = '22023';
  end if;
  if p_status not in ('Đang hoạt động', 'Đang sửa chữa', 'Ngừng sử dụng', 'Thanh lý') then
    raise exception 'Unsupported asset status' using errcode = '22023';
  end if;

  perform private.lock_asset_anchor(p_organization_id, p_asset_id);

  select * into v_lock
  from public.asset_edit_locks l
  where l.organization_id = p_organization_id
    and l.asset_id = p_asset_id
  for update;

  if not found
     or v_lock.holder_user_id <> auth.uid()
     or v_lock.lock_token <> p_lock_token
     or v_lock.expires_at <= clock_timestamp() then
    raise exception 'Asset edit lease is not owned or has expired' using errcode = '55000';
  end if;

  update public.assets a
  set name = btrim(p_name),
      brand = coalesce(p_brand, ''),
      model = coalesce(p_model, ''),
      serial = coalesce(p_serial, ''),
      location = coalesce(p_location, ''),
      commissioned_at = p_commissioned_at,
      power = coalesce(p_power, ''),
      cycle = coalesce(p_cycle, ''),
      cycle_started_at = p_cycle_started_at,
      transferred_from_other_facility = coalesce(p_transferred_from_other_facility, false),
      status = p_status,
      notes = coalesce(p_notes, ''),
      updated_at = clock_timestamp()
  where a.organization_id = p_organization_id and a.id = p_asset_id
  returning * into v_asset;

  if not found then
    raise exception 'Asset not found in this organization' using errcode = 'P0002';
  end if;

  return v_asset;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_asset_archived_with_lock(p_organization_id uuid, p_asset_id uuid, p_lock_token uuid, p_archived boolean)
 RETURNS assets
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_lock public.asset_edit_locks;
  v_asset public.assets;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.has_org_permission(p_organization_id, 'assets.update') then
    raise exception 'Missing assets.update permission for this organization' using errcode = '42501';
  end if;
  if p_lock_token is null or p_archived is null then
    raise exception 'Lock token and archived state are required' using errcode = '22023';
  end if;
  if p_asset_id is null then
    raise exception 'Asset edit lease is missing' using errcode = '55000';
  end if;

  perform private.lock_asset_anchor(p_organization_id, p_asset_id);

  select * into v_lock
  from public.asset_edit_locks l
  where l.organization_id = p_organization_id
    and l.asset_id = p_asset_id
  for update;

  if not found
     or v_lock.holder_user_id <> auth.uid()
     or v_lock.lock_token <> p_lock_token
     or v_lock.expires_at <= clock_timestamp() then
    raise exception 'Asset edit lease is not owned or has expired' using errcode = '55000';
  end if;

  update public.assets a
  set archived_at = case when p_archived then clock_timestamp() else null end,
      updated_at = clock_timestamp()
  where a.organization_id = p_organization_id and a.id = p_asset_id
  returning * into v_asset;

  if not found then
    raise exception 'Asset not found in this organization' using errcode = 'P0002';
  end if;

  return v_asset;
end;
$function$;

-- The legacy allocator has no observed runtime caller and is not idempotent.
-- Keep its function definition for compatibility, but close both client roles.
revoke all on function public.create_asset_with_code(
  uuid, text, text, text, uuid, text, text, text, date, text, text, date, boolean, text, text
) from public, anon, authenticated, service_role;

-- Direct PostgREST DELETE does not participate in the Asset anchor protocol.
-- UI search found no Cloud caller; archive/restore/retirement remain lifecycle
-- operations, not hard delete. Keep the RLS policy as business permission
-- documentation, but remove the SQL privilege gate from authenticated.
revoke delete on table public.assets from authenticated;

comment on function private.lock_asset_anchor(uuid, uuid) is
  'Internal transaction-scoped two-int advisory anchor for one organization + Asset pair.';
comment on function private.lock_settings_global_shared() is
  'Internal shared transaction lock used before reading organization asset-code settings.';
comment on function private.lock_settings_global_exclusive() is
  'Internal exclusive transaction lock used by Settings writes during the compatibility bridge.';
comment on function private.guard_settings_global_write() is
  'Statement-level Settings write bridge; obtains global exclusive lock before row processing.';

commit;

-- REQUIRED TESTS BEFORE PROMOTION/APPLY:
-- 1. Re-run all existing Asset Lease and Asset mutation SQL tests.
-- 2. Sequential: acquire, heartbeat, release, mutation replay, payload rejection,
--    update/archive lease token ownership and expiry.
-- 3. Lock vectors: verify deterministic Asset two-int keys using PostgreSQL
--    17.12; verify Asset two-int and existing mutation-ID bigint key spaces.
-- 4. Two-session A1-A8/A10/A11 interleavings: no deadlock, no orphan Lease,
--    correct Receipt/Asset/Counter invariants, transaction-scoped release.
-- 5. Settings: direct PostgREST INSERT/UPDATE statement trigger takes global
--    exclusive even for zero-row UPDATE; import reader takes global shared;
--    test both interleavings with two physical sessions.
-- 6. Effective privileges: authenticated cannot DELETE assets; authenticated
--    and service_role cannot EXECUTE create_asset_with_code; all seven retained
--    writers remain callable by the expected roles; anon/PUBLIC remain denied.
-- 7. Search-path poisoning: private helpers and pg_catalog lock functions
--    resolve only through fully-qualified names and empty search_path.
-- 8. Postflight: no missing trigger/function, no schema USAGE/EXECUTE to client,
--    no changed Asset payload validation or Lease token semantics.
-- 9. Production is out of scope.
