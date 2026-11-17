-- BAOTRI Mini
-- Migration 006: permission-based RLS for business tables.
-- Depends on Migration 005 (roles, member_roles, has_org_permission).
-- Apply to Test first. Do not apply to Production without explicit approval.
-- This migration changes access policies only; it does not alter business data.

begin;

-- Remove the broad active-member policies from Migration 002.
drop policy if exists assets_select_member on public.assets;
drop policy if exists assets_insert_member on public.assets;
drop policy if exists assets_update_member on public.assets;
drop policy if exists assets_delete_admin on public.assets;

drop policy if exists inventory_items_select_member on public.inventory_items;
drop policy if exists inventory_items_insert_member on public.inventory_items;
drop policy if exists inventory_items_update_member on public.inventory_items;
drop policy if exists inventory_items_delete_admin on public.inventory_items;

drop policy if exists maintenance_tasks_select_member on public.maintenance_tasks;
drop policy if exists maintenance_tasks_insert_member on public.maintenance_tasks;
drop policy if exists maintenance_tasks_update_member on public.maintenance_tasks;
drop policy if exists maintenance_tasks_delete_admin on public.maintenance_tasks;

drop policy if exists maintenance_plans_select_member on public.maintenance_plans;
drop policy if exists maintenance_plans_insert_member on public.maintenance_plans;
drop policy if exists maintenance_plans_update_member on public.maintenance_plans;
drop policy if exists maintenance_plans_delete_admin on public.maintenance_plans;

drop policy if exists checklist_templates_select_member on public.checklist_templates;
drop policy if exists checklist_templates_insert_admin on public.checklist_templates;
drop policy if exists checklist_templates_update_admin on public.checklist_templates;

drop policy if exists checklist_template_versions_select_member on public.checklist_template_versions;
drop policy if exists checklist_template_versions_insert_admin on public.checklist_template_versions;

drop policy if exists checklist_results_select_member on public.checklist_results;
drop policy if exists checklist_results_insert_member on public.checklist_results;

drop policy if exists maintenance_logs_select_member on public.maintenance_logs;
drop policy if exists maintenance_logs_insert_member on public.maintenance_logs;

drop policy if exists inventory_movements_select_member on public.inventory_movements;
drop policy if exists inventory_movements_insert_member on public.inventory_movements;

drop policy if exists asset_images_select_member on public.asset_images;
drop policy if exists asset_images_insert_member on public.asset_images;
drop policy if exists asset_images_delete_admin on public.asset_images;

drop policy if exists organization_settings_select_member on public.organization_settings;
drop policy if exists organization_settings_insert_admin on public.organization_settings;
drop policy if exists organization_settings_update_admin on public.organization_settings;

-- Assets
create policy assets_select_permission on public.assets
for select to authenticated
using (public.has_org_permission(organization_id, 'assets.view'));

create policy assets_insert_permission on public.assets
for insert to authenticated
with check (public.has_org_permission(organization_id, 'assets.create'));

create policy assets_update_permission on public.assets
for update to authenticated
using (public.has_org_permission(organization_id, 'assets.update'))
with check (public.has_org_permission(organization_id, 'assets.update'));

create policy assets_delete_permission on public.assets
for delete to authenticated
using (public.has_org_permission(organization_id, 'assets.delete'));

-- Inventory master. Quantity remains excluded from direct UPDATE by column grants.
create policy inventory_items_select_permission on public.inventory_items
for select to authenticated
using (public.has_org_permission(organization_id, 'inventory.view'));

create policy inventory_items_insert_permission on public.inventory_items
for insert to authenticated
with check (public.has_org_permission(organization_id, 'inventory.create'));

create policy inventory_items_update_permission on public.inventory_items
for update to authenticated
using (public.has_org_permission(organization_id, 'inventory.update'))
with check (public.has_org_permission(organization_id, 'inventory.update'));

create policy inventory_items_delete_permission on public.inventory_items
for delete to authenticated
using (public.has_org_permission(organization_id, 'inventory.delete'));

-- Maintenance tasks
create policy maintenance_tasks_select_permission on public.maintenance_tasks
for select to authenticated
using (public.has_org_permission(organization_id, 'maintenance.view'));

create policy maintenance_tasks_insert_permission on public.maintenance_tasks
for insert to authenticated
with check (public.has_org_permission(organization_id, 'maintenance.create'));

create policy maintenance_tasks_update_permission on public.maintenance_tasks
for update to authenticated
using (public.has_org_permission(organization_id, 'maintenance.update'))
with check (public.has_org_permission(organization_id, 'maintenance.update'));

create policy maintenance_tasks_delete_permission on public.maintenance_tasks
for delete to authenticated
using (public.has_org_permission(organization_id, 'maintenance.delete'));

-- Maintenance plans
create policy maintenance_plans_select_permission on public.maintenance_plans
for select to authenticated
using (public.has_org_permission(organization_id, 'maintenance.view'));

create policy maintenance_plans_insert_permission on public.maintenance_plans
for insert to authenticated
with check (public.has_org_permission(organization_id, 'maintenance.create'));

create policy maintenance_plans_update_permission on public.maintenance_plans
for update to authenticated
using (public.has_org_permission(organization_id, 'maintenance.update'))
with check (public.has_org_permission(organization_id, 'maintenance.update'));

create policy maintenance_plans_delete_permission on public.maintenance_plans
for delete to authenticated
using (public.has_org_permission(organization_id, 'maintenance.delete'));

-- Checklist templates and versions: managed only by members with template.manage.
create policy checklist_templates_select_permission on public.checklist_templates
for select to authenticated
using (public.has_org_permission(organization_id, 'checklist.view'));

create policy checklist_templates_insert_permission on public.checklist_templates
for insert to authenticated
with check (public.has_org_permission(organization_id, 'checklist.template.manage'));

create policy checklist_templates_update_permission on public.checklist_templates
for update to authenticated
using (public.has_org_permission(organization_id, 'checklist.template.manage'))
with check (public.has_org_permission(organization_id, 'checklist.template.manage'));

-- No DELETE policy: template and version history must be retained.
create policy checklist_template_versions_select_permission on public.checklist_template_versions
for select to authenticated
using (public.has_org_permission(organization_id, 'checklist.view'));

create policy checklist_template_versions_insert_permission on public.checklist_template_versions
for insert to authenticated
with check (public.has_org_permission(organization_id, 'checklist.template.manage'));

-- Checklist results are immutable history.
create policy checklist_results_select_permission on public.checklist_results
for select to authenticated
using (public.has_org_permission(organization_id, 'checklist.view'));

create policy checklist_results_insert_permission on public.checklist_results
for insert to authenticated
with check (public.has_org_permission(organization_id, 'checklist.result.create'));

-- Maintenance logs are append-only history.
create policy maintenance_logs_select_permission on public.maintenance_logs
for select to authenticated
using (public.has_org_permission(organization_id, 'logs.view'));

create policy maintenance_logs_insert_permission on public.maintenance_logs
for insert to authenticated
with check (public.has_org_permission(organization_id, 'logs.create'));

-- Inventory movement insertion remains withheld until an atomic stock RPC exists.
create policy inventory_movements_select_permission on public.inventory_movements
for select to authenticated
using (public.has_org_permission(organization_id, 'inventory.view'));

-- Image metadata follows the asset create/update/delete permissions.
create policy asset_images_select_permission on public.asset_images
for select to authenticated
using (public.has_org_permission(organization_id, 'assets.view'));

create policy asset_images_insert_permission on public.asset_images
for insert to authenticated
with check (
  public.has_org_permission(organization_id, 'assets.create')
  or public.has_org_permission(organization_id, 'assets.update')
);

create policy asset_images_delete_permission on public.asset_images
for delete to authenticated
using (public.has_org_permission(organization_id, 'assets.delete'));

-- Organization settings
create policy organization_settings_select_permission on public.organization_settings
for select to authenticated
using (public.has_org_permission(organization_id, 'settings.view'));

create policy organization_settings_insert_permission on public.organization_settings
for insert to authenticated
with check (public.has_org_permission(organization_id, 'settings.manage'));

create policy organization_settings_update_permission on public.organization_settings
for update to authenticated
using (public.has_org_permission(organization_id, 'settings.manage'))
with check (public.has_org_permission(organization_id, 'settings.manage'));

commit;
