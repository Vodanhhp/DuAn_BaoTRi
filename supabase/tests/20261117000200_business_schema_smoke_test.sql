-- BAOTRI Mini - Migration 002 smoke checks
-- READ-ONLY validation. Run only AFTER Migration 002 has been applied
-- to BAOTRI-Mini-Test. This script does not create or modify business data.

do $$
declare
  v_table text;
  v_tables text[] := array[
    'assets',
    'inventory_items',
    'maintenance_tasks',
    'maintenance_plans',
    'checklist_templates',
    'checklist_template_versions',
    'checklist_results',
    'maintenance_logs',
    'inventory_movements',
    'asset_images',
    'organization_settings'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'Missing expected table public.%', v_table;
    end if;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_table
        and c.relrowsecurity
    ) then
      raise exception 'RLS is not enabled on public.%', v_table;
    end if;

    if not exists (
      select 1
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = v_table
    ) then
      raise exception 'No RLS policies found on public.%', v_table;
    end if;

    if has_table_privilege('anon', 'public.' || v_table, 'SELECT')
       or has_table_privilege('anon', 'public.' || v_table, 'INSERT')
       or has_table_privilege('anon', 'public.' || v_table, 'UPDATE')
       or has_table_privilege('anon', 'public.' || v_table, 'DELETE') then
      raise exception 'Unexpected anon table privilege on public.%', v_table;
    end if;
  end loop;

  if not has_function_privilege('authenticated', 'public.is_org_member(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.has_org_role(uuid,text)', 'EXECUTE') then
    raise exception 'Expected membership helper function privileges are missing';
  end if;

  if has_column_privilege('authenticated', 'public.inventory_items', 'quantity', 'UPDATE') then
    raise exception 'authenticated must not directly update inventory_items.quantity';
  end if;

  if has_table_privilege('authenticated', 'public.inventory_movements', 'INSERT') then
    raise exception 'authenticated must not directly insert inventory movements before atomic RPC exists';
  end if;

  if has_table_privilege('authenticated', 'public.checklist_results', 'UPDATE')
     or has_table_privilege('authenticated', 'public.checklist_results', 'DELETE') then
    raise exception 'Checklist results must remain append-only for authenticated clients';
  end if;

  if has_table_privilege('authenticated', 'public.maintenance_logs', 'UPDATE')
     or has_table_privilege('authenticated', 'public.maintenance_logs', 'DELETE') then
    raise exception 'Maintenance logs must remain append-only for authenticated clients';
  end if;

  raise notice 'PASS: Migration 002 schema, RLS, helper access, and protected history/stock privileges look correct.';
end;
$$;

-- Human-readable inventory of policies and grants for manual inspection.
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename = any (array[
    'assets','inventory_items','maintenance_tasks','maintenance_plans',
    'checklist_templates','checklist_template_versions','checklist_results',
    'maintenance_logs','inventory_movements','asset_images','organization_settings'
  ])
order by tablename, policyname;

select
  table_name,
  row_security_active
from (
  select c.relname as table_name, c.relrowsecurity as row_security_active
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any (array[
      'assets','inventory_items','maintenance_tasks','maintenance_plans',
      'checklist_templates','checklist_template_versions','checklist_results',
      'maintenance_logs','inventory_movements','asset_images','organization_settings'
    ])
) s
order by table_name;
