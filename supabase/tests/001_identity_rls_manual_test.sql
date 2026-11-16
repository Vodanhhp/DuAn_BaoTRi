-- BAOTRI Mini – manual RLS smoke test for migration 001
-- REVIEW / TEST ONLY. Run only after migration 001 has been applied to a disposable
-- test Supabase project and four Auth test users plus two organizations/memberships exist.
-- Replace all UUID placeholders below with real IDs from that test project.
-- Run the whole script in Supabase SQL Editor. It ends with ROLLBACK (read-only checks).

begin;

-- Test as User A. Expected: exactly Organization A and only active members of A.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);

select
  'USER_A' as test_identity,
  (select count(*) from public.organizations) as visible_organizations,
  (select string_agg(name, ', ' order by name) from public.organizations) as organization_names,
  (select count(*) from public.organization_members) as visible_memberships,
  (select count(*) from public.profiles) as visible_profiles,
  public.is_org_member('ORG_A_UUID'::uuid) as is_member_of_a,
  public.is_org_member('ORG_B_UUID'::uuid) as is_member_of_b,
  public.has_org_role('ORG_A_UUID'::uuid, 'user') as is_user_in_a,
  public.has_org_role('ORG_A_UUID'::uuid, 'admin') as is_admin_in_a;

reset role;

-- Test as Admin A. Expected: same Organization A only; role helper says admin.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ADMIN_A_UUID', true);

select
  'ADMIN_A' as test_identity,
  (select count(*) from public.organizations) as visible_organizations,
  (select string_agg(name, ', ' order by name) from public.organizations) as organization_names,
  (select count(*) from public.organization_members) as visible_memberships,
  (select count(*) from public.profiles) as visible_profiles,
  public.is_org_member('ORG_A_UUID'::uuid) as is_member_of_a,
  public.is_org_member('ORG_B_UUID'::uuid) as is_member_of_b,
  public.has_org_role('ORG_A_UUID'::uuid, 'admin') as is_admin_in_a;

reset role;

-- Test as User B. Expected: exactly Organization B; no visibility of A.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'USER_B_UUID', true);

select
  'USER_B' as test_identity,
  (select count(*) from public.organizations) as visible_organizations,
  (select string_agg(name, ', ' order by name) from public.organizations) as organization_names,
  (select count(*) from public.organization_members) as visible_memberships,
  (select count(*) from public.profiles) as visible_profiles,
  public.is_org_member('ORG_A_UUID'::uuid) as is_member_of_a,
  public.is_org_member('ORG_B_UUID'::uuid) as is_member_of_b,
  public.has_org_role('ORG_B_UUID'::uuid, 'user') as is_user_in_b;

reset role;

-- Test as Admin B. Expected: exactly Organization B; role helper says admin.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ADMIN_B_UUID', true);

select
  'ADMIN_B' as test_identity,
  (select count(*) from public.organizations) as visible_organizations,
  (select string_agg(name, ', ' order by name) from public.organizations) as organization_names,
  (select count(*) from public.organization_members) as visible_memberships,
  (select count(*) from public.profiles) as visible_profiles,
  public.is_org_member('ORG_A_UUID'::uuid) as is_member_of_a,
  public.is_org_member('ORG_B_UUID'::uuid) as is_member_of_b,
  public.has_org_role('ORG_B_UUID'::uuid, 'admin') as is_admin_in_b;

reset role;

-- Privilege assertions. Expected: all INSERT/UPDATE/DELETE privileges on
-- organizations and organization_members are false for authenticated.
select
  has_table_privilege('authenticated', 'public.organizations', 'INSERT') as can_insert_organization,
  has_table_privilege('authenticated', 'public.organizations', 'UPDATE') as can_update_organization,
  has_table_privilege('authenticated', 'public.organizations', 'DELETE') as can_delete_organization,
  has_table_privilege('authenticated', 'public.organization_members', 'INSERT') as can_insert_membership,
  has_table_privilege('authenticated', 'public.organization_members', 'UPDATE') as can_update_membership,
  has_table_privilege('authenticated', 'public.organization_members', 'DELETE') as can_delete_membership,
  has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE') as can_update_own_display_name,
  has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE') as can_update_profile_id;

rollback;

-- Expected outcomes:
-- * USER_A and ADMIN_A each see only Organization A, its active memberships,
--   and profiles of active colleagues in A.
-- * USER_B and ADMIN_B each see only Organization B, its active memberships,
--   and profiles of active colleagues in B.
-- * Each is_org_member check for the other organization is false.
-- * All organization/membership INSERT, UPDATE, DELETE privilege columns are false.
-- * can_update_own_display_name is true; can_update_profile_id is false.
--
-- This smoke test is not a substitute for negative API tests, concurrent RPC tests,
-- Storage policy tests, or a formal review of the bootstrap/invitation workflow.
