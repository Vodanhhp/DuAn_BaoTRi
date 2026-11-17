-- BAOTRI Mini - Migration 003 role/permission smoke test
-- READ-ONLY. Run ONLY on BAOTRI-Mini-Test after Migration 003 succeeds.
-- Replace the UUID placeholder with the Auth user's UUID from Authentication.
-- This test makes no persistent data changes.

begin;

do $setup$
declare
  v_user_id_text text := 'REPLACE_WITH_AUTH_USER_UUID';
  v_user_id uuid;
  v_org_id uuid;
begin
  if v_user_id_text = 'REPLACE_WITH_AUTH_USER_UUID' or btrim(v_user_id_text) = '' then
    raise exception 'Replace REPLACE_WITH_AUTH_USER_UUID before running this test.';
  end if;
  v_user_id := v_user_id_text::uuid;

  select organization_id into strict v_org_id
  from public.organization_members
  where user_id = v_user_id
    and status = 'active';

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_user_id::text, 'role', 'authenticated')::text,
    true
  );
  perform set_config('baotri.test_org_id', v_org_id::text, true);
end;
$setup$;

set local role authenticated;

do $assertions$
declare
  v_org_id uuid := current_setting('baotri.test_org_id')::uuid;
  v_role_count integer;
  v_permission_count integer;
begin
  select count(*) into v_role_count
  from public.roles
  where organization_id = v_org_id
    and code in ('admin', 'technician', 'viewer')
    and is_system;

  if v_role_count <> 3 then
    raise exception 'Expected 3 built-in roles, found %.', v_role_count;
  end if;

  if not public.has_org_role(v_org_id, 'admin') then
    raise exception 'The test account does not resolve to the Admin role.';
  end if;

  if not public.has_org_permission(v_org_id, 'users.manage')
     or not public.has_org_permission(v_org_id, 'roles.manage') then
    raise exception 'Admin management permissions are missing.';
  end if;

  select count(*) into v_permission_count
  from public.role_permissions rp
  join public.roles r
    on r.organization_id = rp.organization_id
   and r.id = rp.role_id
  where r.organization_id = v_org_id
    and r.code = 'admin';

  if v_permission_count < 20 then
    raise exception 'Admin permission catalog appears incomplete (% permissions).', v_permission_count;
  end if;
end;
$assertions$;

select
  current_user as database_role,
  auth.uid() as authenticated_user_id,
  current_setting('baotri.test_org_id') as organization_id,
  public.has_org_role(current_setting('baotri.test_org_id')::uuid, 'admin') as admin_role_ok,
  public.has_org_permission(current_setting('baotri.test_org_id')::uuid, 'users.manage') as users_manage_ok,
  public.has_org_permission(current_setting('baotri.test_org_id')::uuid, 'roles.manage') as roles_manage_ok;

rollback;
