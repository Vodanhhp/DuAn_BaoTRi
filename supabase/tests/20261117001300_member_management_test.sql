-- BAOTRI Mini - Member management migration 013 verification
-- Run only on BAOTRI-Mini-Test after applying migration 013.
-- All role/status changes below are rolled back.

begin;

do $$
declare
  v_org_id uuid;
  v_admin_user_id uuid;
  v_admin_member_id uuid;
  v_viewer_member_id uuid;
  v_technician_member_id uuid;
  v_role_code text;
  v_status text;
  v_email_mismatches integer;
begin
  select id into v_org_id
  from public.organizations
  where name = 'Cá nhân' and status = 'active'
  order by created_at
  limit 1;

  if v_org_id is null then
    raise exception 'TEST FAIL: organization Cá nhân not found';
  end if;

  select m.user_id, m.id into v_admin_user_id, v_admin_member_id
  from public.organization_members m
  left join public.member_roles mr
    on mr.organization_id = m.organization_id and mr.member_id = m.id
  left join public.roles r
    on r.organization_id = mr.organization_id and r.id = mr.role_id
  where m.organization_id = v_org_id
    and m.status = 'active'
    and (m.role = 'admin' or r.code = 'admin')
  limit 1;

  select m.id into v_viewer_member_id
  from public.organization_members m
  join public.member_roles mr
    on mr.organization_id = m.organization_id and mr.member_id = m.id
  join public.roles r
    on r.organization_id = mr.organization_id and r.id = mr.role_id
  where m.organization_id = v_org_id and m.status = 'active' and r.code = 'viewer'
  limit 1;

  select m.id into v_technician_member_id
  from public.organization_members m
  join public.member_roles mr
    on mr.organization_id = m.organization_id and mr.member_id = m.id
  join public.roles r
    on r.organization_id = mr.organization_id and r.id = mr.role_id
  where m.organization_id = v_org_id and m.status = 'active' and r.code = 'technician'
  limit 1;

  if v_admin_user_id is null or v_viewer_member_id is null or v_technician_member_id is null then
    raise exception 'TEST FAIL: expected active Admin, Viewer and Technician fixtures are required';
  end if;

  if has_function_privilege('authenticated',
    'public.admin_create_org_membership(uuid,uuid,text,uuid,text)', 'EXECUTE') then
    raise exception 'TEST FAIL: authenticated must not execute admin_create_org_membership';
  end if;
  if has_function_privilege('authenticated',
    'public.admin_update_org_member_role(uuid,uuid,text,uuid)', 'EXECUTE') then
    raise exception 'TEST FAIL: authenticated must not execute admin_update_org_member_role';
  end if;
  if has_function_privilege('authenticated',
    'public.admin_update_org_member_status(uuid,uuid,text,uuid)', 'EXECUTE') then
    raise exception 'TEST FAIL: authenticated must not execute admin_update_org_member_status';
  end if;
  if not has_function_privilege('service_role',
    'public.admin_create_org_membership(uuid,uuid,text,uuid,text)', 'EXECUTE') then
    raise exception 'TEST FAIL: service_role must execute admin_create_org_membership';
  end if;

  if has_column_privilege('authenticated', 'public.profiles', 'email', 'SELECT') then
    raise exception 'TEST FAIL: ordinary authenticated members must not read profile email directly';
  end if;
  if not has_column_privilege('service_role', 'public.profiles', 'email', 'SELECT') then
    raise exception 'TEST FAIL: trusted service_role must read profile email for Admin directory';
  end if;

  select count(*) into v_email_mismatches
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.email is distinct from u.email;
  if v_email_mismatches > 0 then
    raise exception 'TEST FAIL: profiles email mirror mismatch count=%', v_email_mismatches;
  end if;

  perform set_config('request.jwt.claim.role', 'service_role', true);
  if auth.role() <> 'service_role' then
    raise exception 'TEST FAIL: service_role JWT claim was not applied';
  end if;

  perform public.admin_update_org_member_role(
    v_org_id, v_viewer_member_id, 'technician', v_admin_user_id
  );

  select r.code into v_role_code
  from public.member_roles mr
  join public.roles r on r.organization_id = mr.organization_id and r.id = mr.role_id
  where mr.organization_id = v_org_id and mr.member_id = v_viewer_member_id;
  if v_role_code <> 'technician' then
    raise exception 'TEST FAIL: role change did not assign Technician';
  end if;

  perform public.admin_update_org_member_status(
    v_org_id, v_viewer_member_id, 'suspended', v_admin_user_id
  );
  
  select status into v_status
  from public.organization_members
  where organization_id = v_org_id and id = v_viewer_member_id;
  if v_status <> 'suspended' then
    raise exception 'TEST FAIL: member was not suspended';
  end if;

  perform public.admin_update_org_member_status(
    v_org_id, v_viewer_member_id, 'active', v_admin_user_id
  );

  select status into v_status
  from public.organization_members
  where organization_id = v_org_id and id = v_viewer_member_id;
  if v_status <> 'active' then
    raise exception 'TEST FAIL: member was not reactivated';
  end if;

  begin

    perform public.admin_update_org_member_role(
      v_org_id, v_admin_member_id, 'viewer', v_admin_user_id
    );

    raise exception 'TEST FAIL: Admin self-role change should have been rejected';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

rollback;

select 'PASS' as result,
       'Migration 013 member-management permissions and reversible role/status operations' as test;
