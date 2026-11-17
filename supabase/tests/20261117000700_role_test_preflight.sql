-- BAOTRI Mini - role test preflight (read-only)
-- Run on BAOTRI-Mini-Test after migrations 001, 005 and 006.
-- This script does not create users, change memberships, or modify business data.
-- Its purpose is to identify real Auth users and organization memberships before
-- running authenticated RLS tests. Do not use Production for this test.

-- Result 1: organizations and their membership / built-in-role coverage.
select
  o.id as organization_id,
  o.name as organization_name,
  o.status as organization_status,
  count(distinct m.id) as membership_count,
  count(distinct m.id) filter (where m.status = 'active') as active_membership_count,
  count(distinct r.id) filter (where r.code in ('admin','technician','viewer')) as builtin_role_count,
  count(distinct mr.member_id) as members_with_role_assignment
from public.organizations o
left join public.organization_members m
  on m.organization_id = o.id
left join public.roles r
  on r.organization_id = o.id and r.is_active
left join public.member_roles mr
  on mr.organization_id = o.id and mr.member_id = m.id
group by o.id, o.name, o.status
order by o.created_at;

-- Result 2: real Auth identities and their membership role assignments.
-- Email is intentionally omitted; user_id is sufficient to prepare the test.
select
  o.id as organization_id,
  o.name as organization_name,
  m.id as membership_id,
  m.user_id,
  m.status as membership_status,
  m.role as legacy_role,
  coalesce(
    string_agg(distinct r.code, ', ' order by r.code)
      filter (where r.code is not null),
    '(no role assignment)'
  ) as assigned_roles,
  u.created_at as auth_user_created_at
from public.organization_members m
join public.organizations o on o.id = m.organization_id
left join public.member_roles mr
  on mr.organization_id = m.organization_id and mr.member_id = m.id
left join public.roles r
  on r.organization_id = mr.organization_id and r.id = mr.role_id
join auth.users u on u.id = m.user_id
group by o.id, o.name, m.id, m.user_id, m.status, m.role, u.created_at
order by o.created_at, m.created_at;

-- Result 3: built-in permission coverage for each organization.
select
  o.id as organization_id,
  r.code as role_code,
  r.name as role_name,
  count(rp.permission_code) as permission_count,
  string_agg(rp.permission_code, ', ' order by rp.permission_code) as permissions
from public.organizations o
join public.roles r on r.organization_id = o.id
left join public.role_permissions rp
  on rp.organization_id = r.organization_id and rp.role_id = r.id
where r.code in ('admin','technician','viewer')
group by o.id, r.code, r.name
order by o.created_at,
  case r.code when 'admin' then 1 when 'technician' then 2 when 'viewer' then 3 else 4 end;
