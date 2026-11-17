-- BAOTRI Mini: unauthenticated, no-membership, and revoked-permission security test.
-- RUN ONLY on BAOTRI-Mini-Test. Never run on Production.
-- Uses the known active Technician account in Org A and a temporary Org B.
-- All fixtures and the temporary permission revocation are rolled back.

begin;

create temporary table security_fixture (
  org_a uuid not null,
  org_b uuid not null,
  admin_uid uuid not null,
  technician_uid uuid not null,
  asset_a uuid not null,
  asset_b uuid not null
);

insert into pg_temp.security_fixture values (
  'dfb443ec-a1ee-496b-842c-0bef3f50b8ce',
  gen_random_uuid(),
  '08f0f750-3361-4ae0-b6ed-9dc4a5b41244',
  'e8700ff7-a642-45b8-b103-fafdb6286748',
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

-- Preflight: require the known active Test organization and Technician assignment.
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

  if not exists (select 1 from public.profiles where id = f.admin_uid)
     or not exists (select 1 from public.profiles where id = f.technician_uid) then
    raise exception 'Preflight failed: expected Admin/Technician profiles were not found.';
  end if;

  select count(*) into v_count
  from public.organization_members m
  join public.member_roles mr
    on mr.organization_id = m.organization_id and mr.member_id = m.id
  join public.roles r
    on r.organization_id = mr.organization_id and r.id = mr.role_id
  where m.organization_id = f.org_a
    and m.user_id = f.technician_uid
    and m.status = 'active'
    and r.code = 'technician'
    and r.is_active;

  if v_count <> 1 then
    raise exception 'Preflight failed: expected exactly one active Technician assignment; found %.', v_count;
  end if;

  select count(*) into v_count
  from public.organization_members m
  join public.member_roles mr
    on mr.organization_id = m.organization_id and mr.member_id = m.id
  join public.roles r
    on r.organization_id = mr.organization_id and r.id = mr.role_id
  join public.role_permissions rp
    on rp.organization_id = r.organization_id and rp.role_id = r.id
  where m.organization_id = f.org_a
    and m.user_id = f.technician_uid
    and m.status = 'active'
    and r.code = 'technician'
    and r.is_active
    and rp.permission_code = 'assets.update';

  if v_count <> 1 then
    raise exception 'Preflight failed: Technician assets.update grant must exist exactly once; found %.', v_count;
  end if;
end
$preflight$;

-- Create a second tenant with no membership for the known Technician.
insert into public.organizations (id, name, status, created_by)
select org_b, 'RLS No-Membership Fixture', 'active', admin_uid
from pg_temp.security_fixture;

insert into public.assets (id, organization_id, code, name, category)
select asset_a, org_a, 'RLS-011-A-' || replace(asset_a::text, '-', ''),
       'Security fixture Org A', 'Kiểm thử'
from pg_temp.security_fixture;

insert into public.assets (id, organization_id, code, name, category)
select asset_b, org_b, 'RLS-011-B-' || replace(asset_b::text, '-', ''),
       'Security fixture Org B', 'Kiểm thử'
from pg_temp.security_fixture;

-- Revoke only the Technician's assets.update grant temporarily.
-- The transaction rollback restores this role_permissions row.
delete from public.role_permissions rp
using public.roles r, pg_temp.security_fixture f
where rp.organization_id = f.org_a
  and rp.role_id = r.id
  and r.organization_id = f.org_a
  and r.code = 'technician'
  and rp.permission_code = 'assets.update';

do $grant_temp$
declare
  v_schema text;
begin
  select nspname into v_schema
  from pg_namespace where oid = pg_my_temp_schema();
  execute format('grant usage on schema %I to anon, authenticated', v_schema);
end
$grant_temp$;

grant select on pg_temp.security_fixture to anon, authenticated;
grant insert on pg_temp.security_results to anon, authenticated;

-- Case 1: no JWT / anon role. Table privileges and helper execution must deny access.
set local role anon;

do $anon_test$
declare
  f record;
  v_blocked boolean;
begin
  select * into strict f from pg_temp.security_fixture;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);

  v_blocked := false;
  begin
    perform count(*) from public.assets;
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  insert into pg_temp.security_results values
    ('Unauthenticated', 'SELECT assets', 'denied', 'blocked=' || v_blocked::text, v_blocked);

  v_blocked := false;
  begin
    perform public.has_org_permission(f.org_a, 'assets.view');
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  insert into pg_temp.security_results values
    ('Unauthenticated', 'Execute permission helper', 'denied', 'blocked=' || v_blocked::text, v_blocked);

  v_blocked := false;
  begin
    insert into public.assets (id, organization_id, code, name, category)
    values (gen_random_uuid(), f.org_a, 'RLS-011-ANON-' || replace(gen_random_uuid()::text, '-', ''),
            'Unauthenticated insert must fail', 'Kiểm thử');
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  insert into pg_temp.security_results values
    ('Unauthenticated', 'INSERT assets', 'denied', 'blocked=' || v_blocked::text, v_blocked);
end
$anon_test$;

reset role;

-- Case 2: authenticated user exists but has no membership in Org B.
set local role authenticated;

do $no_membership_test$
declare
  f record;
  v_count integer;
  v_rows integer;
  v_blocked boolean;
begin
  select * into strict f from pg_temp.security_fixture;
  perform set_config('request.jwt.claim.sub', f.technician_uid::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', f.technician_uid, 'role', 'authenticated', 'aud', 'authenticated')::text, true);

  insert into pg_temp.security_results values
    ('No membership', 'has_org_permission Org B', 'false',
     public.has_org_permission(f.org_b, 'assets.view')::text,
     not public.has_org_permission(f.org_b, 'assets.view'));

  select count(*) into v_count
  from public.assets where id = f.asset_b and organization_id = f.org_b;
  insert into pg_temp.security_results values
    ('No membership', 'SELECT Org B asset', '0 visible', v_count::text || ' visible', v_count = 0);

  update public.assets set name = name || ' unauthorized'
  where id = f.asset_b and organization_id = f.org_b;
  get diagnostics v_rows = row_count;
  insert into pg_temp.security_results values
    ('No membership', 'UPDATE Org B asset', '0 rows', v_rows::text || ' rows', v_rows = 0);

  v_blocked := false;
  begin
    insert into public.assets (id, organization_id, code, name, category)
    values (gen_random_uuid(), f.org_b, 'RLS-011-NOMEM-' || replace(gen_random_uuid()::text, '-', ''),
            'No-membership insert must fail', 'Kiểm thử');
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  insert into pg_temp.security_results values
    ('No membership', 'INSERT Org B asset', 'blocked by RLS',
     'blocked=' || v_blocked::text, v_blocked);
end
$no_membership_test$;

-- Case 3: active Technician loses assets.update when the grant is revoked.
do $revoked_permission_test$
declare
  f record;
  v_rows integer;
begin
  select * into strict f from pg_temp.security_fixture;

  insert into pg_temp.security_results values
    ('Permission revoked', 'has_org_permission assets.update', 'false',
     public.has_org_permission(f.org_a, 'assets.update')::text,
     not public.has_org_permission(f.org_a, 'assets.update'));

  update public.assets set name = name || ' permission revoked'
  where id = f.asset_a and organization_id = f.org_a;
  get diagnostics v_rows = row_count;

  insert into pg_temp.security_results values
    ('Permission revoked', 'UPDATE Org A asset', '0 rows',
     v_rows::text || ' rows', v_rows = 0);
end
$revoked_permission_test$;

reset role;

select test_case, operation, expected, actual,
       case when passed then 'PASS' else 'FAIL' end as result
from pg_temp.security_results
order by test_case, operation;

rollback;
