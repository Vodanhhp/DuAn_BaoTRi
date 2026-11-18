-- BAOTRI Mini - explicit Local asset import RPC tests.
-- Run only on BAOTRI-Mini-Test after migration 20261118000100.
-- All test business data and organization settings are rolled back.
begin;

insert into public.organization_settings (organization_id, asset_code_config)
values (
  'dfb443ec-a1ee-496b-842c-0bef3f50b8ce',
  '{"facility_code":"HP01","category_codes":{"Máy nén khí":"MNA"},"location_codes":{"Phòng máy nén khí":"01","__UNASSIGNED__":"99"}}'::jsonb
)
on conflict (organization_id) do update
set asset_code_config = excluded.asset_code_config;

create temporary table asset_import_test_results (
  test_case text,
  expected text,
  actual text,
  passed boolean
);

do $grant_temp$
declare v_temp_schema text;
begin
  select nspname into v_temp_schema
  from pg_namespace where oid = pg_my_temp_schema();
  execute format('grant usage on schema %I to authenticated', v_temp_schema);
end
$grant_temp$;
grant insert, select on table pg_temp.asset_import_test_results to authenticated;

set local role authenticated;

do $test$
declare
  v_org uuid := 'dfb443ec-a1ee-496b-842c-0bef3f50b8ce';
  v_admin uuid := '08f0f750-3361-4ae0-b6ed-9dc4a5b41244';
  v_technician uuid := 'e8700ff7-a642-45b8-b103-fafdb6286748';
  v_viewer uuid := 'f7425dee-0073-4bb4-9353-5385e9d64895';
  v_asset_id uuid := gen_random_uuid();
  v_mutation_id uuid := gen_random_uuid();
  v_duplicate_mutation uuid := gen_random_uuid();
  v_code text;
  v_sequence bigint := 8000000000000000000 + floor(random() * 1000000)::bigint;
  v_payload jsonb;
  v_result jsonb;
  v_retry jsonb;
  v_created public.assets;
  v_next public.assets;
  v_blocked boolean;
  v_count integer;
  v_next_sequence bigint;
begin
  v_code := 'MNA-HP01-' || v_sequence::text || '-01-05-26';
  v_payload := pg_catalog.jsonb_build_object(
    'name', 'Asset import identity test',
    'category', 'Máy nén khí',
    'brand', 'Test brand',
    'model', 'Model A',
    'serial', 'SERIAL-IMPORT-01',
    'location', 'Phòng máy nén khí',
    'commissioned_at', '2026-05-01',
    'power', '5.5 kW',
    'cycle', 'Tháng',
    'cycle_started_at', '2026-05-01',
    'transferred_from_other_facility', true,
    'status', 'Thanh lý',
    'notes', 'Import test notes',
    'archived_at', '2026-11-01T10:00:00Z',
    'created_at', '2026-05-01T08:00:00Z',
    'updated_at', '2026-11-01T10:00:00Z'
  );

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims',
    pg_catalog.jsonb_build_object('sub', v_admin, 'role', 'authenticated', 'aud', 'authenticated')::text, true);

  v_result := public.import_asset_preserving_identity(
    v_org, v_asset_id, v_code, v_payload, v_mutation_id
  );

  select * into strict v_created from public.assets
  where organization_id = v_org and id = v_asset_id;

  insert into pg_temp.asset_import_test_results values
    ('Preserve UUID and management code', v_asset_id::text || ' / ' || v_code,
      v_created.id::text || ' / ' || v_created.code,
      v_created.id = v_asset_id and v_created.code = v_code);

  insert into pg_temp.asset_import_test_results values
    ('Preserve archived/status/transfer fields', 'Thanh lý / archived / transferred',
      v_created.status || ' / ' || (v_created.archived_at is not null)::text || ' / ' || v_created.transferred_from_other_facility::text,
      v_created.status = 'Thanh lý' and v_created.archived_at is not null and v_created.transferred_from_other_facility);

  insert into pg_temp.asset_import_test_results values
    ('Reconcile recognized sequence', v_sequence::text,
      (select last_value::text from public.asset_code_counters
       where organization_id = v_org and category_code = 'MNA'),
      (select last_value >= v_sequence from public.asset_code_counters
       where organization_id = v_org and category_code = 'MNA'));

  -- Same actor, mutation ID and canonical payload returns the recorded result.
  v_retry := public.import_asset_preserving_identity(
    v_org, v_asset_id, v_code, v_payload, v_mutation_id
  );
  select count(*) into v_count from public.assets
  where organization_id = v_org and id = v_asset_id;
  insert into pg_temp.asset_import_test_results values
    ('Idempotent retry', 'one asset and same result',
      v_count::text || ' asset(s), same=' || (v_retry = v_result)::text,
      v_count = 1 and v_retry = v_result);

  -- Reusing the mutation ID with a changed payload must fail.
  v_blocked := false;
  begin
    perform public.import_asset_preserving_identity(
      v_org, v_asset_id, v_code, v_payload || '{"notes":"changed"}'::jsonb, v_mutation_id
    );
  exception when unique_violation then
    v_blocked := true;
  end;
  insert into pg_temp.asset_import_test_results values
    ('Mutation ID payload mismatch rejected', 'denied',
      case when v_blocked then 'denied' else 'allowed' end, v_blocked);

  -- Existing UUID with a different payload must not be overwritten.
  v_blocked := false;
  begin
    perform public.import_asset_preserving_identity(
      v_org, v_asset_id, v_code, v_payload || '{"notes":"changed"}'::jsonb, v_duplicate_mutation
    );
  exception when unique_violation then
    v_blocked := true;
  end;
  insert into pg_temp.asset_import_test_results values
    ('Existing UUID payload conflict rejected', 'denied',
      case when v_blocked then 'denied' else 'allowed' end, v_blocked);

  -- A different UUID cannot claim the same management code.
  v_blocked := false;
  begin
    perform public.import_asset_preserving_identity(
      v_org, gen_random_uuid(), v_code, v_payload, gen_random_uuid()
    );
  exception when unique_violation then
    v_blocked := true;
  end;
  insert into pg_temp.asset_import_test_results values
    ('Duplicate management code rejected', 'denied',
      case when v_blocked then 'denied' else 'allowed' end, v_blocked);

  -- A technician may create assets but must not import them.
  perform set_config('request.jwt.claim.sub', v_technician::text, true);
  perform set_config('request.jwt.claims',
    pg_catalog.jsonb_build_object('sub', v_technician, 'role', 'authenticated', 'aud', 'authenticated')::text, true);
  v_blocked := false;
  begin
    perform public.import_asset_preserving_identity(
      v_org, gen_random_uuid(), 'MNA-HP01-9999999999999999999-01-05-26',
      v_payload, gen_random_uuid()
    );
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  insert into pg_temp.asset_import_test_results values
    ('Technician import denied', 'denied',
      case when v_blocked then 'denied' else 'allowed' end, v_blocked);

  perform set_config('request.jwt.claim.sub', v_viewer::text, true);
  perform set_config('request.jwt.claims',
    pg_catalog.jsonb_build_object('sub', v_viewer, 'role', 'authenticated', 'aud', 'authenticated')::text, true);
  v_blocked := false;
  begin
    perform public.import_asset_preserving_identity(
      v_org, gen_random_uuid(), 'MNA-HP01-9999999999999999998-01-05-26',
      v_payload, gen_random_uuid()
    );
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  insert into pg_temp.asset_import_test_results values
    ('Viewer import denied', 'denied',
      case when v_blocked then 'denied' else 'allowed' end, v_blocked);

  -- Admin creates a new asset after import; allocator must advance beyond imported sequence.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims',
    pg_catalog.jsonb_build_object('sub', v_admin, 'role', 'authenticated', 'aud', 'authenticated')::text, true);
  select * into strict v_next
  from public.create_asset_with_code(
    p_organization_id => v_org,
    p_name => 'Asset after import',
    p_category => 'Máy nén khí',
    p_location => 'Phòng máy nén khí',
    p_commissioned_at => date '2026-05-01'
  );
  v_next_sequence := (regexp_match(v_next.code, '^MNA-HP01-([0-9]+)-'))[1]::bigint;
  insert into pg_temp.asset_import_test_results values
    ('Allocator continues after import', (v_sequence + 1)::text,
      v_next_sequence::text, v_next_sequence > v_sequence);

end
$test$;

reset role;

select test_case, expected, actual,
       case when passed then 'PASS' else 'FAIL' end as result
from pg_temp.asset_import_test_results
order by test_case;

rollback;
