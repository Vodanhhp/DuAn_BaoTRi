-- BAOTRI Mini: authenticated asset CRUD/RLS test after atomic allocator.
-- Run only on BAOTRI-Mini-Test after Migration 012. All changes roll back.
begin;

insert into public.organization_settings (organization_id, asset_code_config)
values (
  'dfb443ec-a1ee-496b-842c-0bef3f50b8ce',
  '{"facility_code":"HP01","category_codes":{"Máy nén khí":"MNA"},"location_codes":{"Phòng máy nén khí":"01","__UNASSIGNED__":"99"}}'::jsonb
)
on conflict (organization_id) do update
set asset_code_config = excluded.asset_code_config;

create temporary table rls_fixture (id uuid primary key);
insert into pg_temp.rls_fixture values (gen_random_uuid());
insert into public.assets (id, organization_id, code, name, category)
select id, 'dfb443ec-a1ee-496b-842c-0bef3f50b8ce',
       'RLS-TEST-' || replace(id::text, '-', ''),
       'Thiết bị kiểm thử RLS', 'Máy nén khí'
from pg_temp.rls_fixture;

create temporary table rls_results (
  role_code text, operation text, expected text, actual text, passed boolean
);
do $grant_temp$
declare v_temp_schema text;
begin
  select nspname into v_temp_schema from pg_namespace where oid = pg_my_temp_schema();
  execute format('grant usage on schema %I to authenticated', v_temp_schema);
end
$grant_temp$;
grant select on table pg_temp.rls_fixture to authenticated;
grant insert on table pg_temp.rls_results to authenticated;

set local role authenticated;

do $test$
declare
  v_org uuid := 'dfb443ec-a1ee-496b-842c-0bef3f50b8ce';
  v_fixture uuid;
  v_tech uuid;
  v_admin uuid;
  v_rows integer;
  v_count integer;
  v_blocked boolean;
begin
  select id into strict v_fixture from pg_temp.rls_fixture;

  -- Viewer: read allowed; all writes denied.
  perform set_config('request.jwt.claim.sub', 'f7425dee-0073-4bb4-9353-5385e9d64895', true);
  perform set_config('request.jwt.claims',
    '{"sub":"f7425dee-0073-4bb4-9353-5385e9d64895","role":"authenticated","aud":"authenticated"}', true);
  select count(*) into v_count from public.assets where id = v_fixture and organization_id = v_org;
  insert into pg_temp.rls_results values ('viewer','SELECT','1 visible',v_count::text || ' visible',v_count = 1);

  v_blocked := false;
  begin
    insert into public.assets (id,organization_id,code,name,category)
    values (gen_random_uuid(),v_org,'DIRECT-VIEWER-' || replace(gen_random_uuid()::text,'-',''),'Denied','Máy nén khí');
  exception when insufficient_privilege then v_blocked := true;
  end;
  insert into pg_temp.rls_results values ('viewer','DIRECT INSERT','blocked','blocked',v_blocked);

  update public.assets set name = name where id = v_fixture and organization_id = v_org;
  get diagnostics v_rows = row_count;
  insert into pg_temp.rls_results values ('viewer','UPDATE','0 rows',v_rows::text || ' rows',v_rows = 0);
  delete from public.assets where id = v_fixture and organization_id = v_org;
  get diagnostics v_rows = row_count;
  insert into pg_temp.rls_results values ('viewer','DELETE','0 rows',v_rows::text || ' rows',v_rows = 0);

  -- Technician: direct INSERT is blocked; allocator RPC and UPDATE are allowed; DELETE denied.
  perform set_config('request.jwt.claim.sub', 'e8700ff7-a642-45b8-b103-fafdb6286748', true);
  perform set_config('request.jwt.claims',
    '{"sub":"e8700ff7-a642-45b8-b103-fafdb6286748","role":"authenticated","aud":"authenticated"}', true);
  v_blocked := false;
  begin
    insert into public.assets (id,organization_id,code,name,category)
    values (gen_random_uuid(),v_org,'DIRECT-TECH-' || replace(gen_random_uuid()::text,'-',''),'Denied','Máy nén khí');
  exception when insufficient_privilege then v_blocked := true;
  end;
  insert into pg_temp.rls_results values ('technician','DIRECT INSERT','blocked','blocked',v_blocked);

  select id into v_tech from public.create_asset_with_code(
    p_organization_id => v_org, p_name => 'Technician test',
    p_category => 'Máy nén khí', p_location => 'Phòng máy nén khí'
  );
  insert into pg_temp.rls_results values ('technician','RPC INSERT','1 row',case when v_tech is not null then '1 row' else '0 rows' end,v_tech is not null);

  update public.assets set name = name || ' updated' where id = v_tech and organization_id = v_org;
  get diagnostics v_rows = row_count;
  insert into pg_temp.rls_results values ('technician','UPDATE','1 row',v_rows::text || ' rows',v_rows = 1);
  delete from public.assets where id = v_tech and organization_id = v_org;
  get diagnostics v_rows = row_count;
  insert into pg_temp.rls_results values ('technician','DELETE','0 rows',v_rows::text || ' rows',v_rows = 0);

  -- Admin: direct INSERT blocked; RPC create, UPDATE and DELETE allowed.
  perform set_config('request.jwt.claim.sub', '08f0f750-3361-4ae0-b6ed-9dc4a5b41244', true);
  perform set_config('request.jwt.claims',
    '{"sub":"08f0f750-3361-4ae0-b6ed-9dc4a5b41244","role":"authenticated","aud":"authenticated"}', true);
  v_blocked := false;
  begin
    insert into public.assets (id,organization_id,code,name,category)
    values (gen_random_uuid(),v_org,'DIRECT-ADMIN-' || replace(gen_random_uuid()::text,'-',''),'Denied','Máy nén khí');
  exception when insufficient_privilege then v_blocked := true;
  end;
  insert into pg_temp.rls_results values ('admin','DIRECT INSERT','blocked','blocked',v_blocked);

  select id into v_admin from public.create_asset_with_code(
    p_organization_id => v_org, p_name => 'Admin test',
    p_category => 'Máy nén khí', p_location => 'Phòng máy nén khí'
  );
  insert into pg_temp.rls_results values ('admin','RPC INSERT','1 row',case when v_admin is not null then '1 row' else '0 rows' end,v_admin is not null);

  update public.assets set name = name || ' updated' where id = v_admin and organization_id = v_org;
  get diagnostics v_rows = row_count;
  insert into pg_temp.rls_results values ('admin','UPDATE','1 row',v_rows::text || ' rows',v_rows = 1);
  delete from public.assets where id = v_admin and organization_id = v_org;
  get diagnostics v_rows = row_count;
  insert into pg_temp.rls_results values ('admin','DELETE','1 row',v_rows::text || ' rows',v_rows = 1);
end
$test$;

reset role;
select role_code, operation, expected, actual,
       case when passed then 'PASS' else 'FAIL' end as result
from pg_temp.rls_results
order by case role_code when 'viewer' then 1 when 'technician' then 2 else 3 end, operation;
rollback;
