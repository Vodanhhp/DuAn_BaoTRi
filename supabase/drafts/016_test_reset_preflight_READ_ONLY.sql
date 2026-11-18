-- BAOTRI Mini - read-only preflight before resetting TEST business data.
-- Target: BAOTRI-Mini-Test ONLY.
-- This script performs SELECTs only. It does not delete, update, insert, or alter anything.
-- Run in Supabase SQL Editor while connected to the TEST project.
-- Review the organization_id/name first; reset SQL must be scoped to the intended organization.

select
  o.id as organization_id,
  o.name as organization_name,
  counts.table_name,
  counts.row_count
from public.organizations o
cross join lateral (
  select 'assets'::text as table_name, count(*)::bigint as row_count
  from public.assets t where t.organization_id = o.id
  union all
  select 'inventory_items', count(*)::bigint
  from public.inventory_items t where t.organization_id = o.id
  union all
  select 'maintenance_tasks', count(*)::bigint
  from public.maintenance_tasks t where t.organization_id = o.id
  union all
  select 'maintenance_plans', count(*)::bigint
  from public.maintenance_plans t where t.organization_id = o.id
  union all
  select 'checklist_templates', count(*)::bigint
  from public.checklist_templates t where t.organization_id = o.id
  union all
  select 'checklist_template_versions', count(*)::bigint
  from public.checklist_template_versions t where t.organization_id = o.id
  union all
  select 'checklist_results', count(*)::bigint
  from public.checklist_results t where t.organization_id = o.id
  union all
  select 'maintenance_logs', count(*)::bigint
  from public.maintenance_logs t where t.organization_id = o.id
  union all
  select 'inventory_movements', count(*)::bigint
  from public.inventory_movements t where t.organization_id = o.id
  union all
  select 'asset_images', count(*)::bigint
  from public.asset_images t where t.organization_id = o.id
  union all
  select 'organization_settings', count(*)::bigint
  from public.organization_settings t where t.organization_id = o.id
) counts
order by o.name, counts.table_name;

-- Also show tenant membership/status without exposing email or other profile data.
select
  o.id as organization_id,
  o.name as organization_name,
  o.status as organization_status,
  m.role as current_user_role,
  m.status as membership_status
from public.organizations o
join public.organization_members m on m.organization_id = o.id
where m.user_id = auth.uid()
order by o.name;
