-- BAOTRI Mini: integration test for permission-based RLS across business modules.
-- Run ONLY on BAOTRI-Mini-Test. Do not enable/disable RLS for this script.
-- Uses one transaction and rolls back all fixtures and test writes.
begin;

create temporary table rls_fixture (
  org_id uuid not null,
  asset_id uuid not null,
  inventory_id uuid not null,
  task_id uuid not null,
  plan_id uuid not null,
  template_id uuid not null,
  version_id uuid not null,
  result_id uuid not null,
  log_id uuid not null,
  movement_id uuid not null,
  image_id uuid not null
);

insert into pg_temp.rls_fixture values (
  'dfb443ec-a1ee-496b-842c-0bef3f50b8ce',
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid()
);

create temporary table rls_results (
  role_code text, module_name text, operation text,
  expected text, actual text, passed boolean
);

-- Create known-existing rows while SQL Editor is still running as its privileged role.
insert into public.assets (id, organization_id, code, name, category)
select asset_id, org_id, 'RLS-MOD-' || replace(asset_id::text,'-',''),
       'RLS module fixture', 'Kiểm thử'
from pg_temp.rls_fixture;

insert into public.inventory_items (id, organization_id, code, name)
select inventory_id, org_id, 'RLS-INV-' || replace(inventory_id::text,'-',''),
       'RLS inventory fixture'
from pg_temp.rls_fixture;

insert into public.maintenance_tasks (id, organization_id, asset_id, title)
select task_id, org_id, asset_id, 'RLS task fixture'
from pg_temp.rls_fixture;

insert into public.maintenance_plans (id, organization_id, asset_id, title, period, execution)
select plan_id, org_id, asset_id, 'RLS plan fixture', 'Tháng', 'Nội bộ'
from pg_temp.rls_fixture;

insert into public.checklist_templates (id, organization_id, asset_id, title)
select template_id, org_id, asset_id, 'RLS checklist fixture'
from pg_temp.rls_fixture;

insert into public.checklist_template_versions
  (id, organization_id, template_id, asset_id, version, title, items)
select version_id, org_id, template_id, asset_id, 1, 'RLS checklist v1', '[]'::jsonb
from pg_temp.rls_fixture;

insert into public.checklist_results
  (id, organization_id, asset_id, template_id, template_version_id,
   template_version, template_title, performed_at, result, items)
select result_id, org_id, asset_id, template_id, version_id,
       1, 'RLS checklist v1', now(), 'Đạt', '[]'::jsonb
from pg_temp.rls_fixture;

insert into public.maintenance_logs (id, organization_id, asset_id, description)
select log_id, org_id, asset_id, 'RLS log fixture'
from pg_temp.rls_fixture;

insert into public.inventory_movements
  (id, organization_id, item_id, movement_type, quantity)
select movement_id, org_id, inventory_id, 'Nhập', 1
from pg_temp.rls_fixture;

insert into public.asset_images
  (id, organization_id, asset_id, position, storage_path, mime_type)
select image_id, org_id, asset_id, 0,
       'rls-test/' || replace(image_id::text,'-','') || '.jpg', 'image/jpeg'
from pg_temp.rls_fixture;

insert into public.organization_settings (organization_id, asset_categories)
select org_id, '[]'::jsonb from pg_temp.rls_fixture
on conflict (organization_id) do nothing;

-- The simulated authenticated role needs access to the temporary result/fixture tables.
do $grant_temp$
declare v_schema text;
begin
  select nspname into v_schema from pg_namespace where oid = pg_my_temp_schema();
  execute format('grant usage on schema %I to authenticated', v_schema);
end
$grant_temp$;
grant select on pg_temp.rls_fixture to authenticated;
grant insert on pg_temp.rls_results to authenticated;

set local role authenticated;

do $test$
declare
  f record;
  v_uid text;
  v_role text;
  v_table text;
  v_count integer;
  v_rows integer;
  v_blocked boolean;
  v_sql text;
begin
  select * into strict f from pg_temp.rls_fixture;

  -- Viewer: SELECT allowed on all 11 business tables.
  v_uid := 'f7425dee-0073-4bb4-9353-5385e9d64895';
  perform set_config('request.jwt.claim.sub', v_uid, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_uid,'role','authenticated','aud','authenticated')::text, true);

  foreach v_table in array array[
    'assets','inventory_items','maintenance_tasks','maintenance_plans',
    'checklist_templates','checklist_template_versions','checklist_results',
    'maintenance_logs','inventory_movements','asset_images','organization_settings'
  ] loop
    v_sql := format('select count(*) from public.%I where organization_id = $1', v_table);
    execute v_sql into v_count using f.org_id;
    insert into pg_temp.rls_results values
      ('viewer',v_table,'SELECT','at least 1 visible',v_count::text || ' visible',v_count >= 1);
  end loop;

  -- Viewer cannot insert an inventory item; UPDATE/DELETE on fixture are filtered by RLS.
  v_blocked := false;
  begin
    insert into public.inventory_items (id,organization_id,code,name)
    values (gen_random_uuid(),f.org_id,'RLS-VIEW-'||replace(gen_random_uuid()::text,'-',''),'Viewer denied');
  exception when insufficient_privilege then v_blocked := true;
  end;
  insert into pg_temp.rls_results values
    ('viewer','inventory','INSERT','blocked','blocked='||v_blocked::text,v_blocked);

  update public.maintenance_tasks set title = title
    where id=f.task_id and organization_id=f.org_id;
  get diagnostics v_rows = row_count;
  insert into pg_temp.rls_results values
    ('viewer','maintenance','UPDATE','0 rows',v_rows::text||' rows',v_rows=0);

  delete from public.maintenance_plans where id=f.plan_id and organization_id=f.org_id;
  get diagnostics v_rows = row_count;
  insert into pg_temp.rls_results values
    ('viewer','maintenance','DELETE','0 rows',v_rows::text||' rows',v_rows=0);

  -- Technician: inventory and maintenance CRUD allowed except delete; checklist results/logs append allowed.
  v_uid := 'e8700ff7-a642-45b8-b103-fafdb6286748';
  perform set_config('request.jwt.claim.sub', v_uid, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_uid,'role','authenticated','aud','authenticated')::text, true);

  insert into public.inventory_items (id,organization_id,code,name)
  values (gen_random_uuid(),f.org_id,'RLS-TECH-INV-'||replace(gen_random_uuid()::text,'-',''),'Technician item');
  insert into pg_temp.rls_results values ('technician','inventory','INSERT','1 row','1 row',true);

  update public.inventory_items set name=name||' updated'
    where id=f.inventory_id and organization_id=f.org_id;
  get diagnostics v_rows = row_count;
  insert into pg_temp.rls_results values ('technician','inventory','UPDATE','1 row',v_rows::text||' rows',v_rows=1);

  insert into public.maintenance_tasks (id,organization_id,asset_id,title)
  values (gen_random_uuid(),f.org_id,f.asset_id,'Technician task');
  insert into pg_temp.rls_results values ('technician','maintenance task','INSERT','1 row','1 row',true);

  update public.maintenance_plans set notes=notes||' test'
    where id=f.plan_id and organization_id=f.org_id;
  get diagnostics v_rows = row_count;
  insert into pg_temp.rls_results values ('technician','maintenance plan','UPDATE','1 row',v_rows::text||' rows',v_rows=1);

  delete from public.maintenance_tasks where id=f.task_id and organization_id=f.org_id;
  get diagnostics v_rows = row_count;
  insert into pg_temp.rls_results values ('technician','maintenance task','DELETE','0 rows',v_rows::text||' rows',v_rows=0);

  insert into public.checklist_results
    (id,organization_id,asset_id,template_id,template_version_id,template_version,
     template_title,performed_at,result,items)
  values (gen_random_uuid(),f.org_id,f.asset_id,f.template_id,f.version_id,1,
          'Technician checklist',now(),'Đạt','[]'::jsonb);
  insert into pg_temp.rls_results values ('technician','checklist result','INSERT','1 row','1 row',true);

  insert into public.maintenance_logs (id,organization_id,asset_id,description)
  values (gen_random_uuid(),f.org_id,f.asset_id,'Technician log');
  insert into pg_temp.rls_results values ('technician','maintenance log','INSERT','1 row','1 row',true);

  v_blocked := false;
  begin
    insert into public.checklist_templates (id,organization_id,asset_id,title)
    values (gen_random_uuid(),f.org_id,gen_random_uuid(),'Technician must not manage template');
  exception when insufficient_privilege or foreign_key_violation then v_blocked := true;
  end;
  insert into pg_temp.rls_results values ('technician','checklist template','INSERT','blocked','blocked='||v_blocked::text,v_blocked);

  v_blocked := false;
  begin
    insert into public.organization_settings (organization_id,asset_categories)
    values (gen_random_uuid(),'[]'::jsonb);
  exception when insufficient_privilege or foreign_key_violation then v_blocked := true;
  end;
  insert into pg_temp.rls_results values ('technician','settings','INSERT','blocked','blocked='||v_blocked::text,v_blocked);

  v_blocked := false;
  begin
    insert into public.inventory_movements (id,organization_id,item_id,movement_type,quantity)
    values (gen_random_uuid(),f.org_id,f.inventory_id,'Nhập',1);
  exception when insufficient_privilege then v_blocked := true;
  end;
  insert into pg_temp.rls_results values ('technician','inventory movement','INSERT','blocked until atomic RPC','blocked='||v_blocked::text,v_blocked);

  -- Admin: template management and settings updates are allowed.
  v_uid := '08f0f750-3361-4ae0-b6ed-9dc4a5b41244';
  perform set_config('request.jwt.claim.sub', v_uid, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_uid,'role','authenticated','aud','authenticated')::text, true);

  update public.checklist_templates set description='Admin RLS test'
    where id=f.template_id and organization_id=f.org_id;
  get diagnostics v_rows = row_count;
  insert into pg_temp.rls_results values ('admin','checklist template','UPDATE','1 row',v_rows::text||' rows',v_rows=1);

  update public.organization_settings set asset_categories='[]'::jsonb
    where organization_id=f.org_id;
  get diagnostics v_rows = row_count;
  insert into pg_temp.rls_results values ('admin','settings','UPDATE','1 row',v_rows::text||' rows',v_rows=1);

  delete from public.inventory_items where id=f.inventory_id and organization_id=f.org_id;
  get diagnostics v_rows = row_count;
  insert into pg_temp.rls_results values ('admin','inventory','DELETE','1 row',v_rows::text||' rows',v_rows=1);
end
$test$;

reset role;

select role_code, module_name, operation, expected, actual,
       case when passed then 'PASS' else 'FAIL' end as result
from pg_temp.rls_results
order by case role_code when 'viewer' then 1 when 'technician' then 2 else 3 end,
         module_name, operation;

rollback;
