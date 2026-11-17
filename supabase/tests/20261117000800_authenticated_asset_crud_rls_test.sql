-- BAOTRI Mini: authenticated CRUD/RLS integration test for assets.
-- Run only on BAOTRI-Mini-Test. Creates fixtures inside a transaction and rolls back.
begin;

-- Create a known-existing fixture before switching to the authenticated role.
create temporary table rls_fixture (id uuid primary key);
insert into pg_temp.rls_fixture values (gen_random_uuid());
insert into public.assets (id, organization_id, code, name, category)
select id, 'dfb443ec-a1ee-496b-842c-0bef3f50b8ce',
       'RLS-TEST-' || replace(id::text, '-', ''),
       'Thiết bị kiểm thử RLS', 'Kiểm thử'
from pg_temp.rls_fixture;

create temporary table rls_results (
  role_code text, operation text, expected text, actual text, passed boolean
);
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

  -- Viewer: read allowed; insert/update/delete denied.
  perform set_config('request.jwt.claims',
    '{"sub":"f7425dee-0073-4bb4-9353-5385e9d64895","role":"authenticated","aud":"authenticated"}', true);
  select count(*) into v_count from public.assets where id = v_fixture and organization_id = v_org;
  insert into pg_temp.rls_results values
    ('viewer','SELECT','1 visible',v_count::text || ' visible',v_count = 1);

  v_blocked := false;
  begin
    insert into public.assets (id,organization_id,code,name,category)
    values (gen_random_uuid(),v_org,'RLS-VIEWER-' || replace(gen_random_uuid()::text,'-',''),'Viewer test','Kiểm thử');
  exception when insufficient_privilege then v_blocked := true;
  end;
  insert into pg_temp.rls_results values
    ('viewer','INSERT','blocked (42501)',case when v_blocked then 'blocked (42501)' else 'not blocked' end,v_blocked);

  update public.assets set name = name
    where id = v_fixture and organization_id = v_org;
  get diagnostics v_rows = row_count;
  insert into pg_temp.rls_results values
    ('viewer','UPDATE','0 rows (blocked)',v_rows::text || ' rows',v_rows = 0);

  delete from public.assets where id = v_fixture and organization_id = v_org;
  get diagnostics v_rows = row_count;
  insert into pg_temp.rls_results values
    ('viewer','DELETE','0 rows (blocked)',v_rows::text || ' rows',v_rows = 0);

  -- Technician: insert/update allowed; delete denied.
  perform set_config('request.jwt.claims',
    '{"sub":"e8700ff7-a642-45b8-b103-fafdb6286748","role":"authenticated","aud":"authenticated"}', true);
  insert into public.assets (id,organization_id,code,name,category)
  values (gen_random_uuid(),v_org,'RLS-TECH-' || replace(gen_random_uuid()::text,'-',''),'Technician test','Kiểm thử')
  returning id into v_tech;
  insert into pg_temp.rls_results values ('technician','INSERT','1 row','1 row',true);

  update public.assets set name = name || ' updated' where id = v_tech and organization_id = v_org;
  get diagnostics v_rows = row_count;
  insert into pg_temp.rls_results values ('technician','UPDATE','1 row',v_rows::text || ' rows',v_rows = 1);

  delete from public.assets where id = v_tech and organization_id = v_org;
  get diagnostics v_rows = row_count;
  insert into pg_temp.rls_results values ('technician','DELETE','0 rows (blocked)',v_rows::text || ' rows',v_rows = 0);

  -- Admin: insert/update/delete allowed.
  perform set_config('request.jwt.claims',
    '{"sub":"08f0f750-3361-4ae0-b6ed-9dc4a5b41244","role":"authenticated","aud":"authenticated"}', true);
  insert into public.assets (id,organization_id,code,name,category)
  values (gen_random_uuid(),v_org,'RLS-ADMIN-' || replace(gen_random_uuid()::text,'-',''),'Admin test','Kiểm thử')
  returning id into v_admin;
  insert into pg_temp.rls_results values ('admin','INSERT','1 row','1 row',true);

  update public.assets set name = name || ' updated' where id = v_admin and organization_id = v_org;
  get diagnostics v_rows = row_count;
  insert into pg_temp.rls_results values ('admin','UPDATE','1 row',v_rows::text || ' rows',v_rows = 1);

  delete from public.assets where id = v_admin and organization_id = v_org;
  get diagnostics v_rows = row_count;
  insert into pg_temp.rls_results values ('admin','DELETE','1 row',v_rows::text || ' rows',v_rows = 1);
end
$test$;

reset role;

-- The only result grid: PASS/FAIL for each operation. All fixture changes are rolled back.
select role_code, operation, expected, actual,
       case when passed then 'PASS' else 'FAIL' end as result
from pg_temp.rls_results
order by case role_code when 'viewer' then 1 when 'technician' then 2 else 3 end,
         case operation when 'SELECT' then 1 when 'INSERT' then 2 when 'UPDATE' then 3 else 4 end;

rollback;
