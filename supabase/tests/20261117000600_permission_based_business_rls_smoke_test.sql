-- BAOTRI Mini
-- Smoke test for Migration 006 permission-based business RLS.
-- Read-only: no business rows or role assignments are changed.
-- Run after Migration 006 on the Test project.

do $$
declare
  v record;
  v_rls_enabled boolean;
  v_policy_count integer;
begin
  -- Every business table must keep RLS enabled.
  for v in
    select unnest(array[
      'assets','inventory_items','maintenance_tasks','maintenance_plans',
      'checklist_templates','checklist_template_versions','checklist_results',
      'maintenance_logs','inventory_movements','asset_images','organization_settings'
    ]) as table_name
  loop
    select c.relrowsecurity into v_rls_enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = v.table_name;

    if coalesce(v_rls_enabled, false) is not true then
      raise exception 'RLS is not enabled on public.%', v.table_name;
    end if;
  end loop;

  -- Expected policies must exist and each must call has_org_permission.
  for v in
    select * from (values
      ('assets','assets_select_permission'),
      ('assets','assets_insert_permission'),
      ('assets','assets_update_permission'),
      ('assets','assets_delete_permission'),
      ('inventory_items','inventory_items_select_permission'),
      ('inventory_items','inventory_items_insert_permission'),
      ('inventory_items','inventory_items_update_permission'),
      ('inventory_items','inventory_items_delete_permission'),
      ('maintenance_tasks','maintenance_tasks_select_permission'),
      ('maintenance_tasks','maintenance_tasks_insert_permission'),
      ('maintenance_tasks','maintenance_tasks_update_permission'),
      ('maintenance_tasks','maintenance_tasks_delete_permission'),
      ('maintenance_plans','maintenance_plans_select_permission'),
      ('maintenance_plans','maintenance_plans_insert_permission'),
      ('maintenance_plans','maintenance_plans_update_permission'),
      ('maintenance_plans','maintenance_plans_delete_permission'),
      ('checklist_templates','checklist_templates_select_permission'),
      ('checklist_templates','checklist_templates_insert_permission'),
      ('checklist_templates','checklist_templates_update_permission'),
      ('checklist_template_versions','checklist_template_versions_select_permission'),
      ('checklist_template_versions','checklist_template_versions_insert_permission'),
      ('checklist_results','checklist_results_select_permission'),
      ('checklist_results','checklist_results_insert_permission'),
      ('maintenance_logs','maintenance_logs_select_permission'),
      ('maintenance_logs','maintenance_logs_insert_permission'),
      ('inventory_movements','inventory_movements_select_permission'),
      ('asset_images','asset_images_select_permission'),
      ('asset_images','asset_images_insert_permission'),
      ('asset_images','asset_images_delete_permission'),
      ('organization_settings','organization_settings_select_permission'),
      ('organization_settings','organization_settings_insert_permission'),
      ('organization_settings','organization_settings_update_permission')
    ) as expected(table_name, policy_name)
  loop
    select count(*) into v_policy_count
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = v.table_name
      and p.policyname = v.policy_name
      and (
        coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')
      ) like '%has_org_permission%';

    if v_policy_count <> 1 then
      raise exception 'Missing or incorrectly defined policy: public.%.%',
        v.table_name, v.policy_name;
    end if;
  end loop;

  -- The former broad member policies must not remain as permissive OR policies.
  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'public'
    and policyname in (
      'assets_select_member','assets_insert_member','assets_update_member','assets_delete_admin',
      'inventory_items_select_member','inventory_items_insert_member','inventory_items_update_member','inventory_items_delete_admin',
      'maintenance_tasks_select_member','maintenance_tasks_insert_member','maintenance_tasks_update_member','maintenance_tasks_delete_admin',
      'maintenance_plans_select_member','maintenance_plans_insert_member','maintenance_plans_update_member','maintenance_plans_delete_admin',
      'checklist_templates_select_member','checklist_templates_insert_admin','checklist_templates_update_admin',
      'checklist_template_versions_select_member','checklist_template_versions_insert_admin',
      'checklist_results_select_member','checklist_results_insert_member',
      'maintenance_logs_select_member','maintenance_logs_insert_member',
      'inventory_movements_select_member','inventory_movements_insert_member',
      'asset_images_select_member','asset_images_insert_member','asset_images_delete_admin',
      'organization_settings_select_member','organization_settings_insert_admin','organization_settings_update_admin'
    );

  if v_policy_count <> 0 then
    raise exception 'Found % legacy broad business RLS policies.', v_policy_count;
  end if;

  -- Stock movement writes must remain blocked until the atomic RPC is implemented.
  if has_table_privilege('authenticated', 'public.inventory_movements', 'INSERT') then
    raise exception 'Authenticated role unexpectedly has direct INSERT on inventory_movements.';
  end if;

  -- Inventory balance cannot be changed directly from the client.
  if has_column_privilege('authenticated', 'public.inventory_items', 'quantity', 'UPDATE') then
    raise exception 'Authenticated role unexpectedly has UPDATE on inventory_items.quantity.';
  end if;

  raise notice 'PASS: 11 business tables retain RLS; 32 permission policies are present; legacy broad policies are removed; direct stock writes remain blocked.';
end;
$$;
