-- BAOTRI Mini: atomic Cloud asset code allocator test.
-- Run only on BAOTRI-Mini-Test after Migration 012. Transaction is rolled back.
begin;

-- Test tenant and test-only code configuration. Existing settings are restored by ROLLBACK.
insert into public.organization_settings (organization_id, asset_code_config)
values (
  'dfb443ec-a1ee-496b-842c-0bef3f50b8ce',
  '{"facility_code":"HP01","category_codes":{"Máy nén khí":"MNA"},"location_codes":{"Phòng máy nén khí":"01","__UNASSIGNED__":"99"}}'::jsonb
)
on conflict (organization_id) do update
set asset_code_config = excluded.asset_code_config;

create temporary table allocator_results (
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
grant insert on table pg_temp.allocator_results to authenticated;

set local role authenticated;

do $test$
declare
  v_org uuid := 'dfb443ec-a1ee-496b-842c-0bef3f50b8ce';
  v_id_1 uuid := gen_random_uuid();
  v_id_2 uuid := gen_random_uuid();
  v_asset_1 public.assets;
  v_asset_2 public.assets;
  v_seq_1 bigint;
  v_seq_2 bigint;
  v_blocked boolean := false;
begin
  -- Admin creates first asset and the supplied UUID is preserved.
  perform set_config('request.jwt.claim.sub', '08f0f750-3361-4ae0-b6ed-9dc4a5b41244', true);
  perform set_config('request.jwt.claims',
    '{"sub":"08f0f750-3361-4ae0-b6ed-9dc4a5b41244","role":"authenticated","aud":"authenticated"}', true);

  select * into strict v_asset_1
  from public.create_asset_with_code(
    p_organization_id => v_org,
    p_name => 'Allocator test asset 1',
    p_category => 'Máy nén khí',
    p_location => 'Phòng máy nén khí',
    p_id => v_id_1,
    p_commissioned_at => date '2026-05-01'
  );

  v_seq_1 := (regexp_match(v_asset_1.code, '^MNA-HP01-([0-9]+)-'))[1]::bigint;
  insert into pg_temp.allocator_results values
    ('Preserve supplied UUID', v_id_1::text, v_asset_1.id::text, v_asset_1.id = v_id_1);
  insert into pg_temp.allocator_results values
    ('Generated code format', 'MNA-HP01-sequence-01-05-26', v_asset_1.code,
      v_asset_1.code ~ '^MNA-HP01-[0-9]{3,}-01-05-26$');

  -- Technician creates second asset; same organization/category must increment.
  perform set_config('request.jwt.claim.sub', 'e8700ff7-a642-45b8-b103-fafdb6286748', true);
  perform set_config('request.jwt.claims',
    '{"sub":"e8700ff7-a642-45b8-b103-fafdb6286748","role":"authenticated","aud":"authenticated"}', true);

  select * into strict v_asset_2
  from public.create_asset_with_code(
    p_organization_id => v_org,
    p_name => 'Allocator test asset 2',
    p_category => 'Máy nén khí',
    p_location => 'Phòng máy nén khí',
    p_id => v_id_2,
    p_commissioned_at => date '2026-05-01'
  );

  v_seq_2 := (regexp_match(v_asset_2.code, '^MNA-HP01-([0-9]+)-'))[1]::bigint;
  insert into pg_temp.allocator_results values
    ('Sequential allocation', (v_seq_1 + 1)::text, v_seq_2::text, v_seq_2 = v_seq_1 + 1);

  -- Viewer has no assets.create permission.
  perform set_config('request.jwt.claim.sub', 'f7425dee-0073-4bb4-9353-5385e9d64895', true);
  perform set_config('request.jwt.claims',
    '{"sub":"f7425dee-0073-4bb4-9353-5385e9d64895","role":"authenticated","aud":"authenticated"}', true);
  begin
    perform public.create_asset_with_code(
      p_organization_id => v_org,
      p_name => 'Must be denied',
      p_category => 'Máy nén khí',
      p_location => 'Phòng máy nén khí'
    );
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  insert into pg_temp.allocator_results values
    ('Viewer create denied', '42501 / denied',
      case when v_blocked then '42501 / denied' else 'not denied' end, v_blocked);
end
$test$;

reset role;

select test_case, expected, actual,
       case when passed then 'PASS' else 'FAIL' end as result
from pg_temp.allocator_results
order by test_case;

rollback;
