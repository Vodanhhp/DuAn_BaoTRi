-- BAOTRI Mini - Authenticated RLS session simulation
-- READ-ONLY. Run ONLY on BAOTRI-Mini-Test after:
--   1) Migration 001 and 002 have succeeded.
--   2) The personal organization bootstrap has succeeded.
--
-- This script simulates the JWT claims of the selected Auth user and switches
-- the SQL role to "authenticated". It tests PostgreSQL grants + RLS policies,
-- but it is NOT a substitute for an API request made with a real browser session.
-- No business rows are inserted, updated, or deleted.

begin;

-- Set the JWT claims while still running as the SQL Editor's privileged role.
do $setup$
declare
  v_email text := 'tuanluongpham1980@gmail.com';
  v_user_id uuid;
  v_user_count integer;
  v_membership_count integer;
  v_org_count integer;
begin
  select count(*) into v_user_count
  from auth.users
  where lower(email) = lower(btrim(v_email));

  if v_user_count <> 1 then
    raise exception 'Expected exactly one Auth user for %, found %.', v_email, v_user_count;
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = lower(btrim(v_email));

  select count(*) into v_membership_count
  from public.organization_members
  where user_id = v_user_id and status = 'active';

  select count(distinct organization_id) into v_org_count
  from public.organization_members
  where user_id = v_user_id and status = 'active';

  if v_membership_count <> 1 or v_org_count <> 1 then
    raise exception 'Expected exactly one active membership in one organization; memberships %, organizations %.',
      v_membership_count, v_org_count;
  end if;

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
end;
$setup$;

-- Apply the same database role used by a signed-in Supabase client.
set local role authenticated;

-- Identity, profile, organization, membership, and helper-function visibility.
select
  auth.uid() as authenticated_user_id,
  (select count(*) from public.profiles where id = auth.uid()) as own_profile_rows_visible,
  (select count(*) from public.organizations) as organizations_visible,
  (select count(*) from public.organization_members where user_id = auth.uid()) as own_memberships_visible,
  (
    select bool_and(public.is_org_member(organization_id))
    from public.organization_members
    where user_id = auth.uid() and status = 'active'
  ) as is_org_member_returns_true,
  (
    select bool_and(public.has_org_role(organization_id, 'admin'))
    from public.organization_members
    where user_id = auth.uid() and status = 'active'
  ) as has_org_role_admin_returns_true;

-- Read-only visibility check for all 11 business tables.
-- Zero rows is expected at this stage because business data has not been imported.
select 'assets' as table_name, count(*) as visible_rows from public.assets
union all select 'inventory_items', count(*) from public.inventory_items
union all select 'maintenance_tasks', count(*) from public.maintenance_tasks
union all select 'maintenance_plans', count(*) from public.maintenance_plans
union all select 'checklist_templates', count(*) from public.checklist_templates
union all select 'checklist_template_versions', count(*) from public.checklist_template_versions
union all select 'checklist_results', count(*) from public.checklist_results
union all select 'maintenance_logs', count(*) from public.maintenance_logs
union all select 'inventory_movements', count(*) from public.inventory_movements
union all select 'asset_images', count(*) from public.asset_images
union all select 'organization_settings', count(*) from public.organization_settings
order by table_name;

-- End without persisting any database changes.
rollback;
