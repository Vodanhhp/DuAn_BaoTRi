-- BAOTRI Mini Migration 017: idempotent lease-protected asset mutation tests.
-- RUN ONLY on BAOTRI-Mini-Test, after Migration 017 and Migration 016.
-- Uses the known active Admin and Technician in the test organization.
-- All fixture rows, leases and receipts are rolled back.

begin;

create temporary table asset_mutation_fixture (
  organization_id uuid not null,
  admin_uid uuid not null,
  technician_uid uuid not null,
  asset_id uuid not null,
  admin_token uuid,
  cloud_version_before timestamptz,
  mutation_id uuid not null
);

insert into pg_temp.asset_mutation_fixture values (
  'dfb443ec-a1ee-496b-842c-0bef3f50b8ce',
  '08f0f750-3361-4ae0-b6ed-9dc4a5b41244',
  'e8700ff7-a642-45b8-b103-fafdb6286748',
  gen_random_uuid(),
  null,
  null,
  gen_random_uuid()
);

create temporary table asset_mutation_results (
  test_case text not null,
  expected text not null,
  actual text not null,
  passed boolean not null
);

do $preflight$
declare f record;
begin
  select * into strict f from pg_temp.asset_mutation_fixture;
  if not exists (
    select 1 from public.organizations
    where id = f.organization_id and status = 'active'
  ) then raise exception 'Preflight: expected active Test organization not found.'; end if;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = f.organization_id
      and m.user_id = f.admin_uid and m.status = 'active'
  ) then raise exception 'Preflight: expected active Admin membership not found.'; end if;
  if not exists (
    select 1 from public.organization_members m
    join public.member_roles mr
      on mr.organization_id = m.organization_id and mr.member_id = m.id
    join public.roles r
      on r.organization_id = mr.organization_id and r.id = mr.role_id
    join public.role_permissions rp
      on rp.organization_id = r.organization_id and rp.role_id = r.id
    where m.organization_id = f.organization_id
      and m.user_id = f.technician_uid and m.status = 'active'
      and r.code = 'technician' and r.is_active
      and rp.permission_code = 'assets.update'
  ) then raise exception 'Preflight: expected active Technician with assets.update not found.'; end if;
end
$preflight$;

insert into public.assets (id, organization_id, code, name, category)
select asset_id, organization_id,
       'MUT-017-' || replace(asset_id::text, '-', ''),
       'Asset mutation fixture', 'Kiểm thử'
from pg_temp.asset_mutation_fixture;

do $grant_temp$
declare v_schema text;
begin
  select nspname into v_schema from pg_namespace where oid = pg_my_temp_schema();
  execute format('grant usage on schema %I to authenticated', v_schema);
end
$grant_temp$;
grant select, update on pg_temp.asset_mutation_fixture to authenticated;
grant insert on pg_temp.asset_mutation_results to authenticated;

set local role authenticated;

do $mutation_tests$
declare
  f record;
  v_lock jsonb;
  v_first jsonb;
  v_replay jsonb;
  v_payload jsonb;
  v_changed_payload jsonb;
  v_archived_payload jsonb;
  v_expected timestamptz;
  v_after_first timestamptz;
  v_current_before_stale timestamptz;
  v_after_stale timestamptz;
  v_name text;
  v_blocked boolean;
  v_receipt_access boolean;
begin
  select * into strict f from pg_temp.asset_mutation_fixture;
  perform set_config('request.jwt.claim.sub', f.admin_uid::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', f.admin_uid, 'role', 'authenticated', 'aud', 'authenticated')::text, true);

  v_receipt_access := has_table_privilege('authenticated', 'public.asset_mutation_receipts', 'SELECT');
  insert into pg_temp.asset_mutation_results values (
    'Receipt table is not directly readable',
    'authenticated SELECT privilege is false',
    'has_select=' || v_receipt_access::text,
    not v_receipt_access
  );

  v_lock := public.acquire_asset_edit_lock(
    f.organization_id, f.asset_id, gen_random_uuid(), 'PC – Admin'
  );
  if v_lock ->> 'acquired' <> 'true' then
    raise exception 'Admin could not acquire fixture asset: %', v_lock;
  end if;

  update pg_temp.asset_mutation_fixture
  set admin_token = (v_lock ->> 'lock_token')::uuid
  where asset_id = f.asset_id;
  f.admin_token := (v_lock ->> 'lock_token')::uuid;

  select updated_at into strict v_expected
  from public.assets
  where organization_id = f.organization_id and id = f.asset_id;

  update pg_temp.asset_mutation_fixture
  set cloud_version_before = v_expected
  where asset_id = f.asset_id;

  v_payload := jsonb_build_object(
    'name', 'Asset mutation committed once',
    'brand', 'Test brand',
    'model', 'Model 017',
    'serial', 'SER-017',
    'location', 'Test room',
    'commissioned_at', current_date,
    'power', '5 kW',
    'cycle', '',
    'cycle_started_at', null,
    'transferred_from_other_facility', false,
    'status', 'Đang hoạt động',
    'notes', 'Receipt test',
    'archived_at', null
  );

  v_first := public.apply_asset_mutation_with_lock(
    f.organization_id, f.asset_id, f.admin_token,
    f.mutation_id, v_expected, v_payload
  );
  if v_first ->> 'already_applied' <> 'false'
     or v_first #>> '{asset,name}' <> 'Asset mutation committed once' then
    raise exception 'First mutation did not apply as expected: %', v_first;
  end if;
  v_after_first := (v_first #>> '{asset,updated_at}')::timestamptz;

  -- Simulate a lost response: same user, asset, expected version, mutation ID
  -- and payload must return the stored receipt without applying a second write.
  v_replay := public.apply_asset_mutation_with_lock(
    f.organization_id, f.asset_id, f.admin_token,
    f.mutation_id, v_expected, v_payload
  );
  insert into pg_temp.asset_mutation_results values (
    'Same mutation replays receipt',
    'already_applied=true and identical updated_at',
    'already_applied=' || coalesce(v_replay ->> 'already_applied', 'null')
      || '; same_version=' || (((v_replay #>> '{asset,updated_at}')::timestamptz = v_after_first)::text),
    v_replay ->> 'already_applied' = 'true'
      and (v_replay #>> '{asset,updated_at}')::timestamptz = v_after_first
  );

  -- A reused mutation ID with different payload is rejected.
  v_changed_payload := jsonb_set(v_payload, '{name}', to_jsonb('Changed payload'::text));
  v_blocked := false;
  begin
    perform public.apply_asset_mutation_with_lock(
      f.organization_id, f.asset_id, f.admin_token,
      f.mutation_id, v_expected, v_changed_payload
    );
  exception when SQLSTATE '22023' then
    v_blocked := true;
  end;
  insert into pg_temp.asset_mutation_results values (
    'Mutation ID cannot be reused with different payload',
    'SQLSTATE 22023',
    'blocked=' || v_blocked::text,
    v_blocked
  );

  -- Another authorized user cannot use the first user's receipt.
  perform set_config('request.jwt.claim.sub', f.technician_uid::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', f.technician_uid, 'role', 'authenticated', 'aud', 'authenticated')::text, true);
  v_blocked := false;
  begin
    perform public.apply_asset_mutation_with_lock(
      f.organization_id, f.asset_id, f.admin_token,
      f.mutation_id, v_expected, v_payload
    );
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  insert into pg_temp.asset_mutation_results values (
    'Receipt cannot be replayed by another user',
    'SQLSTATE 42501',
    'blocked=' || v_blocked::text,
    v_blocked
  );

  -- Admin tests optimistic version check and wrong token.
  perform set_config('request.jwt.claim.sub', f.admin_uid::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', f.admin_uid, 'role', 'authenticated', 'aud', 'authenticated')::text, true);

  select updated_at into strict v_current_before_stale
  from public.assets
  where organization_id = f.organization_id and id = f.asset_id;

  v_blocked := false;
  begin
    perform public.apply_asset_mutation_with_lock(
      f.organization_id, f.asset_id, f.admin_token,
      gen_random_uuid(), v_expected, v_payload
    );
  exception when SQLSTATE '40001' then
    v_blocked := true;
  end;

  select name, updated_at into strict v_name, v_after_stale
  from public.assets
  where organization_id = f.organization_id and id = f.asset_id;

  insert into pg_temp.asset_mutation_results values (
    'Stale expected Cloud version is rejected',
    'SQLSTATE 40001; timestamp unchanged by rejected mutation',
    'blocked=' || v_blocked::text
      || '; original=' || v_expected::text
      || '; after_first=' || v_after_first::text
      || '; before_stale=' || v_current_before_stale::text
      || '; after_stale=' || v_after_stale::text
      || '; name=' || v_name,
    v_blocked
      and v_after_first is distinct from v_expected
      and v_current_before_stale = v_after_first
      and v_after_stale = v_current_before_stale
      and v_name = 'Asset mutation committed once'
  );

  v_blocked := false;
  begin
    perform public.apply_asset_mutation_with_lock(
      f.organization_id, f.asset_id, gen_random_uuid(),
      gen_random_uuid(), v_after_first, v_payload
    );
  exception when SQLSTATE '55000' then
    v_blocked := true;
  end;
  insert into pg_temp.asset_mutation_results values (
    'Wrong lease token cannot apply a new mutation',
    'SQLSTATE 55000',
    'blocked=' || v_blocked::text,
    v_blocked
  );

  -- Archive/restore is represented in the same protected mutation payload.
  v_archived_payload := jsonb_set(
    v_payload, '{archived_at}', to_jsonb(clock_timestamp())
  );
  v_first := public.apply_asset_mutation_with_lock(
    f.organization_id, f.asset_id, f.admin_token,
    gen_random_uuid(), v_after_first, v_archived_payload
  );
  insert into pg_temp.asset_mutation_results values (
    'Archive field uses same protected mutation RPC',
    'archived_at is not null',
    'archived=' || ((v_first #>> '{asset,archived_at}') is not null)::text,
    (v_first #>> '{asset,archived_at}') is not null
  );
end
$mutation_tests$;

reset role;

select test_case, expected, actual,
       case when passed then 'PASS' else 'FAIL' end as result
from pg_temp.asset_mutation_results
order by test_case;

rollback;
