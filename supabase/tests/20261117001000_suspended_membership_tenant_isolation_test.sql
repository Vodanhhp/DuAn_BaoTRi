-- BAOTRI Mini: suspended membership and tenant-isolation integration test.
-- Run ONLY on BAOTRI-Mini-Test. Never run on Production.
-- Requires the current test organization and the three known test Auth users.
-- All fixtures and the temporary suspension are rolled back at the end.

begin;

create temporary table security_fixture (
  org_a uuid not null,
  org_b uuid not null,
  admin_uid uuid not null,
  technician_uid uuid not null,
  viewer_uid uuid not null,
  asset_a uuid not null,
  asset_b uuid not null
);

insert into pg_temp.security_fixture values (
  'dfb443ec-a1ee-496b-842c-0bef3f50b8ce',
  gen_random_uuid(),
  '08f0f750-3361-4ae0-b6ed-9dc4a5b41244',
  'e8700ff7-a642-45b8-b103-fafdb6286748',
  'f7425dee-0073-4bb4-9353-5385e9d64895',
  gen_random_uuid(),
  gen_random_uuid()
);

create temporary table security_results (
  test_case text not null,
  operation text not null,
  expected text not null,
  actual text not null,
  passed boolean not null
);

-- Preflight: stop rather than report misleading PASS if the expected Test setup is absent.
do $preflight$
declare
  f record;
  v_count integer;
begin
  select * into strict f from pg_temp.security_fixture;

  if not exists (
    select 1 from public.organizations
    where id = f.org_a and status = 'active'
  ) then
    raise exception 'Preflight failed: expected active Org A was not found.';
  end if;

  if not exists (
    select 1 from public.profiles where id = f.admin_uid
  ) or not exists (
    select 1 from public.profiles where id = f.viewer_uid
  ) then
    raise exception 'Preflight failed: expected Admin/Viewer profiles were not found.';
  end if;

  select count(*) into v_count
  from public.organization_members
  where organization_id = f.org_a
    and user_id = f.viewer_uid
    and status = 'active';

  if v_count <> 1 then
    raise exception 'Preflight failed: expected exactly one active Viewer membership in Org A; found %.', v_count;
  end if;

  select count(*) into v_count
  from public.organization_members m
  join public.member_roles mr
    on mr.organization_id = m.organization_id and mr.member_id = m.id
  join public.roles r
    on r.organization_id = mr.organization_id and r.id = mr.role_id
  where m.organization_id = f.org_a
    and m.user_id = f.viewer_uid
    and r.code = 'viewer'
    and r.is_active;

  if v_count <> 1 then
    raise exception 'Preflight failed: Viewer role assignment is missing or ambiguous; found %.', v_count;
  end if;
end
$preflight$;

-- Create a second active tenant and a business row belonging only to that tenant.
-- No membership is created for any of the three test users in Org B.
insert into public.organizations (id, name, status, created_by)
select org_b, 'RLS Tenant Isolation Fixture', 'active', admin_uid
from pg_temp.security_fixture;

insert into public.assets (id, organization_id, code, name, category)
select asset_a, org_a,
       'RLS-SEC-A-' || replace(asset_a::text, '-', ''),
       'Security fixture Org A', 'Kiểm thử'
from pg_temp.security_fixture;

insert into public.assets (id, organization_id, code, name, category)
select asset_b, org_b,
       'RLS-SEC-B-' || replace(asset_b::text, '-', ''),
       'Security fixture Org B', 'Kiểm thử'
from pg_temp.security_fixture;

-- Temporarily suspend the existing Viewer membership while retaining its role assignment.
update public.organization_members m
set status = 'suspended'
from pg_temp.security_fixture f
where m.organization_id = f.org_a
  and m.user_id = f.viewer_uid
  and m.status = 'active';

do $grant_temp$
declare
  v_schema text;
begin
  select nspname into v_schema
  from pg_namespace where oid = pg_my_temp_schema();
  execute format('grant usage on schema %I to authenticated', v_schema);
end
$grant_temp$;

grant select on pg_temp.security_fixture to authenticated;
grant insert on pg_temp.security_results to authenticated;

set local role authenticated;

do $test$
declare
  f record;
  v_count integer;
  v_rows integer;
  v_blocked boolean;
  v_code text;
begin
  select * into strict f from pg_temp.security_fixture;

  -- Control: Admin is active in Org A and has assets.view there.
  perform set_config('request.jwt.claim.sub', f.admin_uid::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', f.admin_uid, 'role', 'authenticated', 'aud', 'authenticated')::text, true);

  select count(*) into v_count
  from public.assets where id = f.asset_a and organization_id = f.org_a;

  insert into pg_temp.security_results values
    ('Active Admin control', 'SELECT own tenant', '1 visible', v_count::text || ' visible', v_count = 1);

  insert into pg_temp.security_results values
    ('Tenant isolation', 'has_org_permission for Org B', 'false',
     public.has_org_permission(f.org_b, 'assets.view')::text,
     not public.has_org_permission(f.org_b, 'assets.view'));

  select count(*) into v_count
  from public.assets where id = f.asset_b and organization_id = f.org_b;

  insert into pg_temp.security_results values
    ('Tenant isolation', 'SELECT Org B asset', '0 visible', v_count::text || ' visible', v_count = 0);

  update public.assets
  set name = name || ' must not change'
  where id = f.asset_b and organization_id = f.org_b;
  get diagnostics v_rows = row_count;

  insert into pg_temp.security_results values
    ('Tenant isolation', 'UPDATE Org B asset', '0 rows', v_rows::text || ' rows', v_rows = 0);

  delete from public.assets
  where id = f.asset_b and organization_id = f.org_b;
  get diagnostics v_rows = row_count;

  insert into pg_temp.security_results values
    ('Tenant isolation', 'DELETE Org B asset', '0 rows', v_rows::text || ' rows', v_rows = 0);

  v_code := 'RLS-SEC-DENY-' || replace(gen_random_uuid()::text, '-', '');
  v_blocked := false;
  begin
    insert into public.assets (id, organization_id, code, name, category)
    values (gen_random_uuid(), f.org_b, v_code, 'Cross-tenant insert must fail', 'Kiểm thử');
  exception when insufficient_privilege then
    v_blocked := true;
  end;

  insert into pg_temp.security_results values
    ('Tenant isolation', 'INSERT into Org B', 'blocked by RLS',
     'blocked=' || v_blocked::text, v_blocked);

  -- Suspended Viewer: role assignment still exists, but active membership is required.
  perform set_config('request.jwt.claim.sub', f.viewer_uid::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', f.viewer_uid, 'role', 'authenticated', 'aud', 'authenticated')::text, true);

  insert into pg_temp.security_results values
    ('Suspended membership', 'has_org_permission assets.view', 'false',
     public.has_org_permission(f.org_a, 'assets.view')::text,
     not public.has_org_permission(f.org_a, 'assets.view'));

  select count(*) into v_count
  from public.assets where id = f.asset_a and organization_id = f.org_a;

  insert into pg_temp.security_results values
    ('Suspended membership', 'SELECT Org A asset', '0 visible',
     v_count::text || ' visible', v_count = 0);

  update public.assets
  set name = name || ' suspended must not change'
  where id = f.asset_a and organization_id = f.org_a;
  get diagnostics v_rows = row_count;

  insert into pg_temp.security_results values
    ('Suspended membership', 'UPDATE Org A asset', '0 rows',
     v_rows::text || ' rows', v_rows = 0);

  v_code := 'RLS-SUSP-DENY-' || replace(gen_random_uuid()::text, '-', '');
  v_blocked := false;
  begin
    insert into public.assets (id, organization_id, code, name, category)
    values (gen_random_uuid(), f.org_a, v_code, 'Suspended insert must fail', 'Kiểm thử');
  exception when insufficient_privilege then
    v_blocked := true;
  end;

  insert into pg_temp.security_results values
    ('Suspended membership', 'INSERT into Org A', 'blocked by RLS',
     'blocked=' || v_blocked::text, v_blocked);
end
$test$;

reset role;

select test_case, operation, expected, actual,
       case when passed then 'PASS' else 'FAIL' end as result
from pg_temp.security_results
order by test_case, operation;

rollback;
