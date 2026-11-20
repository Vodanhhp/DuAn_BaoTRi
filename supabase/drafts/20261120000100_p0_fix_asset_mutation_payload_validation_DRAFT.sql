-- BAOTRI Mini — proposed Migration 020: P0 Asset mutation payload validation
-- Proposed version: 20261120000100
-- Intended final path: supabase/migrations/20261120000100_p0_fix_asset_mutation_payload_validation.sql
-- STATUS: REVIEW DRAFT ONLY. Not approved for execution. Do NOT run.
-- Target: BAOTRI-Mini-Test only, after explicit user approval.
-- Replaces the complete apply_asset_mutation_with_lock function definition.
-- Does not modify Migration 017, Migration 018, or the Asset lock retrofit.
-- Proposed timestamp follows the confirmed Test sequence through Migration 019.
-- Deployment remains manual; this draft must be reviewed and approved before promotion.
--
-- Required payload contract: exactly 13 keys; rejects SQL NULL, JSON null,
-- scalar, array, missing keys, and unsupported extra keys with SQLSTATE 22023.
--
-- Review source:
-- supabase/docs/ASSET_MUTATION_PAYLOAD_VALIDATION_FIX_DESIGN.md

begin;

create or replace function public.apply_asset_mutation_with_lock(
  p_organization_id uuid,
  p_asset_id uuid,
  p_lock_token uuid,
  p_mutation_id uuid,
  p_expected_cloud_updated_at timestamptz,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
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
$$;

revoke all on function public.apply_asset_mutation_with_lock(uuid, uuid, uuid, uuid, timestamptz, jsonb) from public, anon;
grant execute on function public.apply_asset_mutation_with_lock(uuid, uuid, uuid, uuid, timestamptz, jsonb) to authenticated;
grant execute on function public.apply_asset_mutation_with_lock(uuid, uuid, uuid, uuid, timestamptz, jsonb) to service_role;

comment on function public.apply_asset_mutation_with_lock(uuid, uuid, uuid, uuid, timestamptz, jsonb) is
  'Apply an asset master mutation only with the current lease and expected Cloud version; safely replay the same committed mutation by its immutable mutation ID.';

commit;
