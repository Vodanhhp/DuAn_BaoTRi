-- BAOTRI Mini — DRAFT TEST ONLY: M021 Asset/Lease lock-anchor retrofit.
-- Run only after the matching M021 migration is applied to BAOTRI-Mini-Test.
-- This script uses one dedicated Test organization and rolls back all DML.
-- It is not a substitute for the separate two-physical-session concurrency suite.

begin;

do $preflight$
declare v_actor uuid;
begin
  select m.user_id into v_actor
  from public.organization_members m
  join public.member_roles mr on mr.member_id=m.id and mr.organization_id=m.organization_id
  join public.roles r on r.id=mr.role_id and r.organization_id=mr.organization_id
  where m.organization_id='dfb443ec-a1ee-496b-842c-0bef3f50b8ce'::uuid
    and m.status='active' and r.name='Admin'
  order by m.created_at
  limit 1;
  if v_actor is null then raise exception 'M021 Test requires an active Admin fixture'; end if;
  perform pg_catalog.set_config('request.jwt.claim.sub',v_actor::text,true);
  perform pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',v_actor::text,'role','authenticated')::text,true);
end;
$preflight$;

-- PostgreSQL 17.12 / hashtextextended(seed=0) known vector for the Test fixture.
do $vector$
begin
  perform private.lock_asset_anchor(
    'dfb443ec-a1ee-496b-842c-0bef3f50b8ce'::uuid,
    '872077a8-9b75-402d-908a-93fa5bcd9749'::uuid
  );
  if not exists(
    select 1 from pg_locks
    where locktype='advisory' and pid=pg_backend_pid()
      and classid::bigint=1620790905 and objid::bigint=1408844184
      and objsubid=2 and mode='ExclusiveLock' and granted
  ) then raise exception 'Asset anchor known vector mismatch'; end if;
end;
$vector$;

set local role authenticated;

-- Exercise the live authenticated Settings INSERT/UPDATE compatibility bridge
-- against the dedicated fixture; transaction rollback restores original values.
insert into public.organization_settings (organization_id, asset_categories)
values ('dfb443ec-a1ee-496b-842c-0bef3f50b8ce'::uuid, '[]'::jsonb)
on conflict (organization_id) do update
set asset_categories=organization_settings.asset_categories;

-- BEFORE STATEMENT must lock even when no Settings row matches.
update public.organization_settings
set asset_code_config=asset_code_config
where organization_id='00000000-0000-0000-0000-000000000000'::uuid;

do $test$
declare
  v_org uuid := 'dfb443ec-a1ee-496b-842c-0bef3f50b8ce';
  v_asset_id uuid := '872077a8-9b75-402d-908a-93fa5bcd9749';
  v_asset public.assets;
  v_lease jsonb;
  v_token uuid;
  v_mutation uuid := pg_catalog.gen_random_uuid();
  v_payload jsonb;
  v_result jsonb;
  v_replay jsonb;
  v_import jsonb;
  v_updated public.assets;
begin
  if not public.has_org_permission(v_org,'assets.update')
     or not public.has_org_permission(v_org,'assets.import')
     or not public.has_org_permission(v_org,'settings.manage') then
    raise exception 'M021 Test Admin fixture lacks required permissions';
  end if;

  -- Fixed disposable Test fixture; never read the internal Lease table as authenticated.
  if not exists(select 1 from public.assets where organization_id=v_org and id=v_asset_id) then
    raise exception 'M021 Asset fixture missing';
  end if;

  select * into v_asset from public.assets where organization_id=v_org and id=v_asset_id;

  -- Acquire -> heartbeat -> apply -> replay -> release.
  v_lease:=public.acquire_asset_edit_lock(v_org,v_asset_id,pg_catalog.gen_random_uuid(),'M021 regression test');
  if coalesce((v_lease->>'acquired')::boolean,false) is not true then raise exception 'Acquire failed: %',v_lease; end if;
  v_token:=(v_lease->>'lock_token')::uuid;
  if coalesce((public.heartbeat_asset_edit_lock(v_org,v_asset_id,v_token)->>'renewed')::boolean,false) is not true then raise exception 'Heartbeat failed'; end if;

  v_payload:=pg_catalog.jsonb_build_object(
    'name',v_asset.name || ' [M021 test]',
    'brand',v_asset.brand,'model',v_asset.model,'serial',v_asset.serial,'location',v_asset.location,
    'commissioned_at',v_asset.commissioned_at,'power',v_asset.power,'cycle',v_asset.cycle,
    'cycle_started_at',v_asset.cycle_started_at,'transferred_from_other_facility',v_asset.transferred_from_other_facility,
    'status',v_asset.status,'notes',v_asset.notes,'archived_at',v_asset.archived_at
  );
  v_result:=public.apply_asset_mutation_with_lock(v_org,v_asset_id,v_token,v_mutation,v_asset.updated_at,v_payload);
  if coalesce((v_result->>'already_applied')::boolean,true) then raise exception 'First apply incorrectly reported replay'; end if;
  v_replay:=public.apply_asset_mutation_with_lock(v_org,v_asset_id,v_token,v_mutation,v_asset.updated_at,v_payload);
  if coalesce((v_replay->>'already_applied')::boolean,false) is not true then raise exception 'Identical mutation retry was not replayed'; end if;
  if public.release_asset_edit_lock(v_org,v_asset_id,v_token) is not true then raise exception 'Release failed'; end if;

  -- Import existing identity/payload; verifies Asset anchor -> bigint mutation lock -> Settings shared -> Counter/Asset.
  select * into v_asset from public.assets where organization_id=v_org and id=v_asset_id;
  v_payload:=pg_catalog.jsonb_build_object(
    'name',v_asset.name,'category',v_asset.category,'brand',v_asset.brand,'model',v_asset.model,'serial',v_asset.serial,
    'location',v_asset.location,'commissioned_at',v_asset.commissioned_at,'power',v_asset.power,'cycle',v_asset.cycle,
    'cycle_started_at',v_asset.cycle_started_at,'transferred_from_other_facility',v_asset.transferred_from_other_facility,
    'status',v_asset.status,'notes',v_asset.notes,'archived_at',v_asset.archived_at,
    'created_at',v_asset.created_at,'updated_at',v_asset.updated_at
  );
  v_import:=public.import_asset_preserving_identity(v_org,v_asset_id,v_asset.code,v_payload,pg_catalog.gen_random_uuid());
  if coalesce((v_import->>'already_present')::boolean,false) is not true then raise exception 'Import did not preserve existing Asset'; end if;

  -- Retained legacy update/archive writers must take the same Asset anchor.
  v_lease:=public.acquire_asset_edit_lock(v_org,v_asset_id,pg_catalog.gen_random_uuid(),'M021 legacy regression');
  if coalesce((v_lease->>'acquired')::boolean,false) is not true then raise exception 'Legacy acquire failed'; end if;
  v_token:=(v_lease->>'lock_token')::uuid;
  v_updated:=public.update_asset_with_lock(v_org,v_asset_id,v_token,v_asset.name || ' [legacy]',v_asset.brand,v_asset.model,v_asset.serial,v_asset.location,v_asset.commissioned_at,v_asset.power,v_asset.cycle,v_asset.cycle_started_at,v_asset.transferred_from_other_facility,v_asset.status,v_asset.notes);
  v_updated:=public.set_asset_archived_with_lock(v_org,v_asset_id,v_token,true);
  v_updated:=public.set_asset_archived_with_lock(v_org,v_asset_id,v_token,false);
  if public.release_asset_edit_lock(v_org,v_asset_id,v_token) is not true then raise exception 'Legacy release failed'; end if;
end;
$test$;

reset role;

do $security$
begin
  if has_table_privilege('authenticated','public.assets','DELETE') then raise exception 'Authenticated still has direct Asset DELETE'; end if;
  if has_table_privilege('service_role','public.assets','INSERT') then raise exception 'service_role still has direct Asset INSERT'; end if;
  if has_table_privilege('service_role','public.assets','UPDATE') then raise exception 'service_role still has direct Asset UPDATE'; end if;
  if has_table_privilege('service_role','public.assets','DELETE') then raise exception 'service_role still has direct Asset DELETE'; end if;
  if exists(select 1 from pg_attribute a where a.attrelid='public.assets'::regclass and a.attnum>0 and not a.attisdropped and (has_column_privilege('service_role','public.assets',a.attname,'INSERT') or has_column_privilege('service_role','public.assets',a.attname,'UPDATE'))) then raise exception 'service_role retains column-level direct Asset INSERT/UPDATE'; end if;
  if has_table_privilege('service_role','public.organization_settings','DELETE') then raise exception 'service_role still has Settings DELETE'; end if;
  if not has_table_privilege('authenticated','public.organization_settings','INSERT') then raise exception 'Authenticated lost Settings INSERT compatibility privilege'; end if;
  if not has_table_privilege('authenticated','public.organization_settings','UPDATE') then raise exception 'Authenticated lost Settings UPDATE compatibility privilege'; end if;
  if has_function_privilege('authenticated','public.create_asset_with_code(uuid,text,text,text,uuid,text,text,text,date,text,text,date,boolean,text,text)','EXECUTE') then raise exception 'Authenticated can still execute legacy allocator'; end if;
  if has_function_privilege('service_role','public.create_asset_with_code(uuid,text,text,text,uuid,text,text,text,date,text,text,date,boolean,text,text)','EXECUTE') then raise exception 'service_role can still execute legacy allocator'; end if;
  if has_schema_privilege('authenticated','private','USAGE') or has_schema_privilege('service_role','private','USAGE') or has_schema_privilege('anon','private','USAGE') then raise exception 'Client/service role can access private schema'; end if;
  if has_function_privilege('authenticated','private.lock_asset_anchor(uuid,uuid)','EXECUTE') or has_function_privilege('service_role','private.lock_asset_anchor(uuid,uuid)','EXECUTE') or has_function_privilege('anon','private.lock_asset_anchor(uuid,uuid)','EXECUTE') then raise exception 'Client/service role can execute Asset anchor helper'; end if;
  if not has_function_privilege('authenticated','public.acquire_asset_edit_lock(uuid,uuid,uuid,text)','EXECUTE') then raise exception 'Authenticated lost acquire RPC'; end if;
  if not has_function_privilege('service_role','public.acquire_asset_edit_lock(uuid,uuid,uuid,text)','EXECUTE') then raise exception 'service_role lost expected acquire RPC EXECUTE'; end if;
  if has_function_privilege('anon','public.acquire_asset_edit_lock(uuid,uuid,uuid,text)','EXECUTE') then raise exception 'anon can execute acquire RPC'; end if;
  if not has_function_privilege('authenticated','public.heartbeat_asset_edit_lock(uuid,uuid,uuid)','EXECUTE') or not has_function_privilege('service_role','public.heartbeat_asset_edit_lock(uuid,uuid,uuid)','EXECUTE') or has_function_privilege('anon','public.heartbeat_asset_edit_lock(uuid,uuid,uuid)','EXECUTE') then raise exception 'Heartbeat RPC EXECUTE matrix incorrect'; end if;
  if not has_function_privilege('authenticated','public.release_asset_edit_lock(uuid,uuid,uuid)','EXECUTE') or not has_function_privilege('service_role','public.release_asset_edit_lock(uuid,uuid,uuid)','EXECUTE') or has_function_privilege('anon','public.release_asset_edit_lock(uuid,uuid,uuid)','EXECUTE') then raise exception 'Release RPC EXECUTE matrix incorrect'; end if;
  if not has_function_privilege('authenticated','public.apply_asset_mutation_with_lock(uuid,uuid,uuid,uuid,timestamptz,jsonb)','EXECUTE') or not has_function_privilege('service_role','public.apply_asset_mutation_with_lock(uuid,uuid,uuid,uuid,timestamptz,jsonb)','EXECUTE') or has_function_privilege('anon','public.apply_asset_mutation_with_lock(uuid,uuid,uuid,uuid,timestamptz,jsonb)','EXECUTE') then raise exception 'Apply mutation RPC EXECUTE matrix incorrect'; end if;
  if not has_function_privilege('authenticated','public.import_asset_preserving_identity(uuid,uuid,text,jsonb,uuid)','EXECUTE') or not has_function_privilege('service_role','public.import_asset_preserving_identity(uuid,uuid,text,jsonb,uuid)','EXECUTE') or has_function_privilege('anon','public.import_asset_preserving_identity(uuid,uuid,text,jsonb,uuid)','EXECUTE') then raise exception 'Import RPC EXECUTE matrix incorrect'; end if;
  if not has_function_privilege('authenticated','public.update_asset_with_lock(uuid,uuid,uuid,text,text,text,text,text,date,text,text,date,boolean,text,text)','EXECUTE') or not has_function_privilege('service_role','public.update_asset_with_lock(uuid,uuid,uuid,text,text,text,text,text,date,text,text,date,boolean,text,text)','EXECUTE') or has_function_privilege('anon','public.update_asset_with_lock(uuid,uuid,uuid,text,text,text,text,text,date,text,text,date,boolean,text,text)','EXECUTE') then raise exception 'Legacy update RPC EXECUTE matrix incorrect'; end if;
  if not has_function_privilege('authenticated','public.set_asset_archived_with_lock(uuid,uuid,uuid,boolean)','EXECUTE') or not has_function_privilege('service_role','public.set_asset_archived_with_lock(uuid,uuid,uuid,boolean)','EXECUTE') or has_function_privilege('anon','public.set_asset_archived_with_lock(uuid,uuid,uuid,boolean)','EXECUTE') then raise exception 'Archive RPC EXECUTE matrix incorrect'; end if;
  if not has_function_privilege('authenticated','public.list_asset_edit_locks(uuid)','EXECUTE') or not has_function_privilege('service_role','public.list_asset_edit_locks(uuid)','EXECUTE') or has_function_privilege('anon','public.list_asset_edit_locks(uuid)','EXECUTE') then raise exception 'List locks RPC EXECUTE matrix incorrect'; end if;
end;
$security$;

-- The current transaction must hold the two-int Asset/Settings namespace and
-- bigint mutation-ID namespace. objsubid=2 denotes two-int; objsubid=1 bigint.
do $locks$
begin
  if not exists(select 1 from pg_locks where locktype='advisory' and pid=pg_backend_pid() and objsubid=2 and granted) then
    raise exception 'No two-int advisory transaction lock observed';
  end if;
  if not exists(select 1 from pg_locks where locktype='advisory' and pid=pg_backend_pid() and objsubid=1 and granted) then
    raise exception 'No bigint mutation-ID advisory transaction lock observed';
  end if;
  if not exists(select 1 from pg_locks where locktype='advisory' and pid=pg_backend_pid()
      and classid::bigint=2635656809 and objid::bigint=2123944637
      and objsubid=2 and mode='ExclusiveLock' and granted) then
    raise exception 'Settings statement trigger did not hold global exclusive lock';
  end if;
  if not exists(select 1 from pg_locks where locktype='advisory' and pid=pg_backend_pid()
      and classid::bigint=2635656809 and objid::bigint=2123944637
      and objsubid=2 and mode='ShareLock' and granted) then
    raise exception 'Import did not hold global Settings shared lock';
  end if;
end;
$locks$;

rollback;

-- TWO-PHYSICAL-SESSION CONCURRENCY SUITE (must be run by an external harness):
-- A1-A4: acquire/takeover, heartbeat/release, and delete-anchor interleavings.
-- A5-A7: apply mutation vs delete; import vs delete; same mutation ID across Asset IDs.
-- A8: different Asset IDs in one org; confirm independent anchors.
-- A9: Settings direct INSERT/UPDATE (statement trigger exclusive) vs import shared reader.
-- A10: FK reference INSERT vs delete; confirm no orphan or deadlock.
-- A11: legacy update/archive vs Asset delete.
-- Each session records PID, txid, READY checkpoint, pg_locks, pg_blocking_pids, SQLSTATE.
-- No pg_sleep-based ordering. Use external READY barriers and lock_timeout only as a safety bound.
-- Roll back both sessions and verify Asset, Lease, Receipt, Import ledger and Counter snapshots.
-- This sequential SQL file does not mark those concurrency cases PASS.