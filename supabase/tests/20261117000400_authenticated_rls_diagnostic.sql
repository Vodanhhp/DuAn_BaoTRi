-- BAOTRI Mini - Diagnose authenticated RLS test context
-- READ-ONLY. Run ONLY on BAOTRI-Mini-Test.
-- This script does not insert, update, or delete any rows.

begin;

do $setup$
declare
  v_email text := 'tuanluongpham1980@gmail.com';
  v_user_id uuid;
  v_org_id uuid;
begin
  select id into strict v_user_id
  from auth.users
  where lower(email) = lower(btrim(v_email));

  select organization_id into strict v_org_id
  from public.organization_members
  where user_id = v_user_id
    and status = 'active';

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_user_id::text,
      'role', 'authenticated',
      'email', v_email
    )::text,
    true
  );
  perform set_config('baotri.test_org_id', v_org_id::text, true);
end;
$setup$;

set local role authenticated;

-- Diagnostic result: auth.uid() and both JWT claim settings must be populated.
select
  current_user as database_role,
  session_user as session_role,
  auth.uid() as auth_uid,
  current_setting('request.jwt.claim.sub', true) as jwt_sub_setting,
  current_setting('request.jwt.claims', true) as jwt_claims_setting,
  current_setting('baotri.test_org_id', true) as test_organization_id,
  has_table_privilege(current_user, 'public.profiles', 'SELECT') as can_select_profiles,
  has_table_privilege(current_user, 'public.organizations', 'SELECT') as can_select_organizations,
  has_table_privilege(current_user, 'public.organization_members', 'SELECT') as can_select_memberships;

-- RLS visibility and helper results for the known test user and organization.
select
  (select count(*) from public.profiles where id = auth.uid()) as own_profile_rows_visible,
  (select count(*) from public.organizations) as organizations_visible,
  (select count(*) from public.organization_members where user_id = auth.uid()) as own_memberships_visible,
  public.is_org_member(current_setting('baotri.test_org_id', true)::uuid) as is_org_member_for_test_org,
  public.has_org_role(current_setting('baotri.test_org_id', true)::uuid, 'admin') as has_admin_role_for_test_org,
  (select count(*) from public.organization_settings
   where organization_id = current_setting('baotri.test_org_id', true)::uuid) as own_org_settings_visible;

rollback;
