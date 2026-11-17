-- BAOTRI Mini - Migration 014 verification
-- Run only on BAOTRI-Mini-Test after applying migration 014.
-- All membership changes are rolled back.

begin;

do $$
declare
  v_org_id uuid;
  v_admin_user_id uuid;
  v_admin_member_id uuid;
  v_viewer_member_id uuid;
  v_viewer_user_id uuid;
  v_exists boolean;
begin
  select id into v_org_id
  from public.organizations
  where name = 'Cá nhân' and status = 'active'
  order by created_at limit 1;
  if v_org_id is null then raise exception 'TEST FAIL: organization Cá nhân not found'; end if;

  select m.user_id, m.id into v_admin_user_id, v_admin_member_id
  from public.organization_members m
  left join public.member_roles mr on mr.organization_id=m.organization_id and mr.member_id=m.id
  left join public.roles r on r.organization_id=mr.organization_id and r.id=mr.role_id
  where m.organization_id=v_org_id and m.status='active'
    and (m.role='admin' or r.code='admin') limit 1;

  select m.id, m.user_id into v_viewer_member_id, v_viewer_user_id
  from public.organization_members m
  join public.member_roles mr on mr.organization_id=m.organization_id and mr.member_id=m.id
  join public.roles r on r.organization_id=mr.organization_id and r.id=mr.role_id
  where m.organization_id=v_org_id and m.status='active' and r.code='viewer' limit 1;

  if v_admin_user_id is null or v_viewer_member_id is null then
    raise exception 'TEST FAIL: active Admin and Viewer fixtures are required';
  end if;

  if has_function_privilege('authenticated','public.admin_remove_org_membership(uuid,uuid,uuid)','EXECUTE') then
    raise exception 'TEST FAIL: authenticated must not execute admin_remove_org_membership';
  end if;
  if not has_function_privilege('service_role','public.admin_remove_org_membership(uuid,uuid,uuid)','EXECUTE') then
    raise exception 'TEST FAIL: service_role must execute admin_remove_org_membership';
  end if;

  perform set_config('request.jwt.claim.role','service_role',true);
  if auth.role()<>'service_role' then raise exception 'TEST FAIL: service_role JWT claim was not applied'; end if;

  begin
    perform public.admin_remove_org_membership(v_org_id,v_admin_member_id,v_admin_user_id);
    raise exception 'TEST FAIL: Admin self-removal should have been rejected';
  exception when insufficient_privilege then null;
  end;

  perform public.admin_remove_org_membership(v_org_id,v_viewer_member_id,v_admin_user_id);

  select exists(select 1 from public.organization_members where organization_id=v_org_id and id=v_viewer_member_id) into v_exists;
  if v_exists then raise exception 'TEST FAIL: membership row was not removed'; end if;

  select exists(select 1 from public.member_roles where member_id=v_viewer_member_id) into v_exists;
  if v_exists then raise exception 'TEST FAIL: member role assignments were not cascaded'; end if;

  select exists(select 1 from public.profiles where id=v_viewer_user_id) into v_exists;
  if not v_exists then raise exception 'TEST FAIL: profile must be preserved'; end if;

  select exists(select 1 from auth.users where id=v_viewer_user_id) into v_exists;
  if not v_exists then raise exception 'TEST FAIL: Auth identity must be preserved'; end if;
end;
$$;

rollback;

select 'PASS' as result,
       'Migration 014 removes organization membership but preserves Auth identity and profile' as test;
