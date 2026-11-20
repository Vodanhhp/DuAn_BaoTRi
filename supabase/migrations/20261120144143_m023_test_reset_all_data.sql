-- BAOTRI Mini — M023: guarded Test-only full data reset
-- Applied to BAOTRI-Mini-Test only. The hard-coded organization UUID is a second safety boundary.
-- Production is out of scope. This migration does not execute a reset.

begin;

alter table public.organization_settings
  add column if not exists data_reset_at timestamptz;

create or replace function public.get_baotri_data_reset_epoch(p_organization_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
set row_security = 'off'
as $function$
declare
  v_epoch timestamptz;
  v_test_org constant uuid := 'dfb443ec-a1ee-496b-842c-0bef3f50b8ce';
begin
  if auth.uid() is null or not public.is_org_member(p_organization_id) then
    raise exception 'Active organization membership required' using errcode = '42501';
  end if;

  if p_organization_id <> v_test_org then
    return null;
  end if;

  select s.data_reset_at
    into v_epoch
  from public.organization_settings s
  where s.organization_id = v_test_org;

  return v_epoch;
end;
$function$;

create or replace function public.preview_baotri_test_reset()
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = 'off'
as $function$
declare
  v_org constant uuid := 'dfb443ec-a1ee-496b-842c-0bef3f50b8ce';
  v_name text;
  v_delete_counts jsonb;
  v_preserve_counts jsonb;
begin
  if auth.uid() is null or not public.has_org_role(v_org, 'admin') then
    raise exception 'Only an active Test organization Admin may preview reset' using errcode = '42501';
  end if;

  select o.name into v_name
  from public.organizations o
  where o.id = v_org and o.status = 'active';

  if v_name is distinct from 'Cá nhân' then
    raise exception 'Test organization safety check failed' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'assets', (select count(*) from public.assets where organization_id = v_org),
    'inventory_items', (select count(*) from public.inventory_items where organization_id = v_org),
    'maintenance_tasks', (select count(*) from public.maintenance_tasks where organization_id = v_org),
    'maintenance_plans', (select count(*) from public.maintenance_plans where organization_id = v_org),
    'checklist_templates', (select count(*) from public.checklist_templates where organization_id = v_org),
    'checklist_template_versions', (select count(*) from public.checklist_template_versions where organization_id = v_org),
    'checklist_results', (select count(*) from public.checklist_results where organization_id = v_org),
    'maintenance_logs', (select count(*) from public.maintenance_logs where organization_id = v_org),
    'inventory_movements', (select count(*) from public.inventory_movements where organization_id = v_org),
    'asset_images', (select count(*) from public.asset_images where organization_id = v_org),
    'asset_edit_locks', (select count(*) from public.asset_edit_locks where organization_id = v_org),
    'asset_code_counters', (select count(*) from public.asset_code_counters where organization_id = v_org)
  ) into v_delete_counts;

  select jsonb_build_object(
    'asset_import_mutations', (select count(*) from public.asset_import_mutations where organization_id = v_org),
    'asset_mutation_receipts', (select count(*) from public.asset_mutation_receipts where organization_id = v_org),
    'organization_members', (select count(*) from public.organization_members where organization_id = v_org),
    'roles', (select count(*) from public.roles where organization_id = v_org),
    'role_permissions', (select count(*) from public.role_permissions where organization_id = v_org)
  ) into v_preserve_counts;

  return jsonb_build_object(
    'environment', 'BAOTRI-Mini-Test',
    'organization_id', v_org,
    'organization_name', v_name,
    'delete_counts', v_delete_counts,
    'preserve_counts', v_preserve_counts,
    'settings_row_preserved', true,
    'technical_ledgers_preserved', true
  );
end;
$function$;

create or replace function public.reset_baotri_test_data(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = 'off'
as $function$
declare
  v_org constant uuid := 'dfb443ec-a1ee-496b-842c-0bef3f50b8ce';
  v_name text;
  v_asset_id uuid;
  v_delete_counts jsonb;
  v_preserve_counts jsonb;
  v_reset_at timestamptz;
begin
  if auth.uid() is null or not public.has_org_role(v_org, 'admin') then
    raise exception 'Only an active Test organization Admin may reset data' using errcode = '42501';
  end if;

  if p_confirmation is distinct from 'RESET TEST' then
    raise exception 'Confirmation phrase must be RESET TEST' using errcode = '22023';
  end if;

  select o.name into v_name
  from public.organizations o
  where o.id = v_org and o.status = 'active'
  for update;

  if v_name is distinct from 'Cá nhân' then
    raise exception 'Test organization safety check failed' using errcode = '42501';
  end if;

  -- Preserve the M021 lock order: Asset anchor(s) first, Settings exclusive second.
  for v_asset_id in
    select a.id from public.assets a
    where a.organization_id = v_org
    order by a.id
  loop
    perform private.lock_asset_anchor(v_org, v_asset_id);
  end loop;

  perform private.lock_settings_global_exclusive();

  if exists (
    select 1 from public.asset_edit_locks l
    where l.organization_id = v_org and l.expires_at > now()
  ) then
    raise exception 'Active asset edit locks remain. Close edit forms and retry reset.' using errcode = '55000';
  end if;

  select jsonb_build_object(
    'assets', (select count(*) from public.assets where organization_id = v_org),
    'inventory_items', (select count(*) from public.inventory_items where organization_id = v_org),
    'maintenance_tasks', (select count(*) from public.maintenance_tasks where organization_id = v_org),
    'maintenance_plans', (select count(*) from public.maintenance_plans where organization_id = v_org),
    'checklist_templates', (select count(*) from public.checklist_templates where organization_id = v_org),
    'checklist_template_versions', (select count(*) from public.checklist_template_versions where organization_id = v_org),
    'checklist_results', (select count(*) from public.checklist_results where organization_id = v_org),
    'maintenance_logs', (select count(*) from public.maintenance_logs where organization_id = v_org),
    'inventory_movements', (select count(*) from public.inventory_movements where organization_id = v_org),
    'asset_images', (select count(*) from public.asset_images where organization_id = v_org),
    'asset_edit_locks', (select count(*) from public.asset_edit_locks where organization_id = v_org),
    'asset_code_counters', (select count(*) from public.asset_code_counters where organization_id = v_org)
  ) into v_delete_counts;

  select jsonb_build_object(
    'asset_import_mutations', (select count(*) from public.asset_import_mutations where organization_id = v_org),
    'asset_mutation_receipts', (select count(*) from public.asset_mutation_receipts where organization_id = v_org),
    'organization_members', (select count(*) from public.organization_members where organization_id = v_org),
    'roles', (select count(*) from public.roles where organization_id = v_org),
    'role_permissions', (select count(*) from public.role_permissions where organization_id = v_org)
  ) into v_preserve_counts;

  -- Delete child business rows before their referenced parents.
  delete from public.maintenance_logs where organization_id = v_org;
  delete from public.inventory_movements where organization_id = v_org;
  delete from public.checklist_results where organization_id = v_org;
  delete from public.checklist_template_versions where organization_id = v_org;
  delete from public.checklist_templates where organization_id = v_org;
  delete from public.maintenance_tasks where organization_id = v_org;
  delete from public.maintenance_plans where organization_id = v_org;
  delete from public.asset_images where organization_id = v_org;
  delete from public.asset_edit_locks where organization_id = v_org;
  delete from public.assets where organization_id = v_org;
  delete from public.inventory_items where organization_id = v_org;
  delete from public.asset_code_counters where organization_id = v_org;

  -- Keep idempotency ledgers so delayed retries cannot recreate deleted test assets.
  update public.organization_settings
  set asset_categories = '[]'::jsonb,
      asset_code_config = null,
      data_reset_at = clock_timestamp()
  where organization_id = v_org
  returning data_reset_at into v_reset_at;

  if v_reset_at is null then
    raise exception 'Organization settings row is missing; reset rolled back' using errcode = '55000';
  end if;

  return jsonb_build_object(
    'status', 'reset',
    'environment', 'BAOTRI-Mini-Test',
    'organization_id', v_org,
    'organization_name', v_name,
    'reset_at', v_reset_at,
    'deleted', v_delete_counts,
    'preserved_technical_ledgers', v_preserve_counts,
    'local_clients', 'All clients clear their own Local database on next online app startup/focus after observing reset_at.'
  );
end;
$function$;

revoke all on function public.get_baotri_data_reset_epoch(uuid) from public, anon;
revoke all on function public.preview_baotri_test_reset() from public, anon;
revoke all on function public.reset_baotri_test_data(text) from public, anon;

grant execute on function public.get_baotri_data_reset_epoch(uuid) to authenticated;
grant execute on function public.preview_baotri_test_reset() to authenticated;
grant execute on function public.reset_baotri_test_data(text) to authenticated;

commit;
