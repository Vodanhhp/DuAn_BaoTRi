-- BAOTRI Mini — P0 regression test draft
-- STATUS: DRAFT ONLY. Do NOT run until the fixture UUIDs are filled and approved.
-- Target: BAOTRI-Mini-Test ONLY. Never Production.
-- This script invokes the RPC and rolls back all database changes at the end.
--
-- Replace the four fixture values below with:
--   authorized actor UUID (membership with assets.update)
--   organization UUID
--   test Asset UUID
--   active Asset edit lease token UUID
-- Confirm the lease is active and belongs to this actor/Asset immediately before testing.
-- Run as SQL Editor in a single execution. Do not run partially.
--
-- Expected: P01 valid payload succeeds and creates one receipt inside this transaction.
-- P02/P03/P04 invalid payloads must raise exactly SQLSTATE 22023 and leave Asset
-- and receipt state unchanged. The outer ROLLBACK removes P01 receipt/update too.

begin;

-- Fixture placeholders intentionally remain invalid UUID strings until replaced.
-- PostgreSQL will reject the script before tests begin if any placeholder remains.

-- Helper asserts an invalid payload is rejected with exactly 22023 and no writes.
create or replace function pg_temp.assert_invalid_asset_payload(
  p_organization_id uuid,
  p_asset_id uuid,
  p_lock_token uuid,
  p_expected_updated_at timestamptz,
  p_payload jsonb,
  p_case_name text
)
returns void
language plpgsql
as $helper$
declare
  v_before_asset jsonb;
  v_after_asset jsonb;
  v_before_receipts bigint;
  v_after_receipts bigint;
  v_mutation_id uuid := gen_random_uuid();
  v_rejected boolean := false;
begin
  select to_jsonb(a) into v_before_asset
  from public.assets a
  where a.organization_id = p_organization_id and a.id = p_asset_id;

  if v_before_asset is null then
    raise exception 'Fixture Asset not found for %', p_case_name;
  end if;

  select count(*) into v_before_receipts
  from public.asset_mutation_receipts r
  where r.organization_id = p_organization_id and r.mutation_id = v_mutation_id;

  begin
    perform public.apply_asset_mutation_with_lock(
      p_organization_id,
      p_asset_id,
      p_lock_token,
      v_mutation_id,
      p_expected_updated_at,
      p_payload
    );
  exception
    when sqlstate '22023' then
      v_rejected := true;
  end;

  if not v_rejected then
    raise exception 'FAIL %: RPC did not raise SQLSTATE 22023', p_case_name;
  end if;

  select to_jsonb(a) into v_after_asset
  from public.assets a
  where a.organization_id = p_organization_id and a.id = p_asset_id;

  select count(*) into v_after_receipts
  from public.asset_mutation_receipts r
  where r.organization_id = p_organization_id and r.mutation_id = v_mutation_id;

  if v_after_asset is distinct from v_before_asset then
    raise exception 'FAIL %: Asset row changed after rejected payload', p_case_name;
  end if;
  if v_after_receipts <> v_before_receipts then
    raise exception 'FAIL %: receipt state changed after rejected payload', p_case_name;
  end if;

  raise notice 'PASS %: SQLSTATE 22023; Asset and Receipt unchanged', p_case_name;
end;
$helper$;

do $test$
declare
  v_actor uuid := '<ACTOR_UUID>'::uuid;
  v_org uuid := '<ORGANIZATION_UUID>'::uuid;
  v_asset uuid := '<ASSET_UUID>'::uuid;
  v_token uuid := '<LEASE_TOKEN_UUID>'::uuid;
  v_asset_row public.assets;
  v_payload jsonb;
  v_mutation_id uuid := gen_random_uuid();
  v_result jsonb;
  v_receipt_count bigint;
  v_expected_updated_at timestamptz;
begin
  -- SQL Editor runs with elevated role; set request JWT claims for auth.uid()
  -- and permission checks. This does not authenticate a real client session.
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_actor::text, 'role', 'authenticated')::text,
    true
  );

  if not public.has_org_permission(v_org, 'assets.update') then
    raise exception 'Fixture actor lacks assets.update permission';
  end if;

  select * into v_asset_row
  from public.assets a
  where a.organization_id = v_org and a.id = v_asset
  for update;

  if not found then
    raise exception 'Fixture Asset not found';
  end if;

  if not exists (
    select 1 from public.asset_edit_locks l
    where l.organization_id = v_org
      and l.asset_id = v_asset
      and l.holder_user_id = v_actor
      and l.lock_token = v_token
      and l.expires_at > clock_timestamp()
  ) then
    raise exception 'Fixture Lease missing, mismatched, or expired';
  end if;

  -- Build exact 13-key payload from current Asset fields; change name to prove write.
  v_payload := jsonb_build_object(
    'name', v_asset_row.name || ' [P0 test]',
    'brand', v_asset_row.brand,
    'model', v_asset_row.model,
    'serial', v_asset_row.serial,
    'location', v_asset_row.location,
    'commissioned_at', v_asset_row.commissioned_at,
    'power', v_asset_row.power,
    'cycle', v_asset_row.cycle,
    'cycle_started_at', v_asset_row.cycle_started_at,
    'transferred_from_other_facility', v_asset_row.transferred_from_other_facility,
    'status', v_asset_row.status,
    'notes', v_asset_row.notes,
    'archived_at', v_asset_row.archived_at
  );

  v_result := public.apply_asset_mutation_with_lock(
    v_org, v_asset, v_token, v_mutation_id, v_asset_row.updated_at, v_payload
  );

  if coalesce((v_result->>'already_applied')::boolean, true) then
    raise exception 'FAIL P01: expected a new mutation, not replay';
  end if;

  select a.updated_at into v_expected_updated_at
  from public.assets a
  where a.organization_id = v_org and a.id = v_asset;

  select count(*) into v_receipt_count
  from public.asset_mutation_receipts r
  where r.organization_id = v_org and r.mutation_id = v_mutation_id;

  if v_receipt_count <> 1 then
    raise exception 'FAIL P01: expected exactly one receipt; got %', v_receipt_count;
  end if;

  if (select a.name from public.assets a where a.organization_id = v_org and a.id = v_asset)
       <> (v_payload->>'name') then
    raise exception 'FAIL P01: expected Asset name was not applied';
  end if;

  raise notice 'PASS P01: valid exact-13-key payload accepted; one receipt created';

  -- Invalid payload suite uses the post-P01 version timestamp and separate mutation IDs.
  perform pg_temp.assert_invalid_asset_payload(
    v_org, v_asset, v_token, v_expected_updated_at,
    v_payload - 'serial', 'P02 missing required key (serial)'
  );

  perform pg_temp.assert_invalid_asset_payload(
    v_org, v_asset, v_token, v_actor, v_expected_updated_at,
    v_payload || jsonb_build_object('unsupported_test_key', 'extra'),
    'P03 unsupported extra key'
  );

  perform pg_temp.assert_invalid_asset_payload(
    v_org, v_asset, v_token, v_actor, v_expected_updated_at,
    'null'::jsonb, 'P04a JSON null'
  );

  perform pg_temp.assert_invalid_asset_payload(
    v_org, v_asset, v_token, v_actor, v_expected_updated_at,
    '"string"'::jsonb, 'P04b JSON string'
  );

  perform pg_temp.assert_invalid_asset_payload(
    v_org, v_asset, v_token, v_actor, v_expected_updated_at,
    '123'::jsonb, 'P04c JSON number'
  );

  perform pg_temp.assert_invalid_asset_payload(
    v_org, v_asset, v_token, v_actor, v_expected_updated_at,
    'true'::jsonb, 'P04d JSON boolean'
  );

  perform pg_temp.assert_invalid_asset_payload(
    v_org, v_asset, v_token, v_actor, v_expected_updated_at,
    '[]'::jsonb, 'P04e JSON array'
  );

  perform pg_temp.assert_invalid_asset_payload(
    v_org, v_asset, v_token, v_actor, v_expected_updated_at,
    null::jsonb, 'P04f SQL NULL'
  );

  raise notice 'ALL P0 PAYLOAD TESTS PASSED (8 invalid cases + P01).';
end;
$test$;

rollback;
