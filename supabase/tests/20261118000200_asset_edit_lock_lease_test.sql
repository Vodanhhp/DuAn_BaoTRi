-- BAOTRI Mini Migration 016: per-asset edit lease tests.
-- RUN ONLY on BAOTRI-Mini-Test, after Migration 016 has been applied.
-- Uses the known active Admin and Technician in the test organization.
-- All fixture rows and lease mutations are rolled back.

begin;

create temporary table asset_lock_fixture (
  organization_id uuid not null,
  admin_uid uuid not null,
  technician_uid uuid not null,
  asset_id uuid not null,
  admin_token uuid,
  technician_token uuid
);

insert into pg_temp.asset_lock_fixture values (
  'dfb443ec-a1ee-496b-842c-0bef3f50b8ce',
  '08f0f750-3361-4ae0-b6ed-9dc4a5b41244',
  'e8700ff7-a642-45b8-b103-fafdb6286748',
  gen_random_uuid(),
  null,
  null
);

create temporary table asset_lock_results (
  test_case text not null,
  expected text not null,
  actual text not null,
  passed boolean not null
);

do $preflight$
declare
  f record;
begin
  select * into strict f from pg_temp.asset_lock_fixture;
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
       'LOCK-016-' || replace(asset_id::text, '-', ''),
       'Asset edit lock fixture', 'Kiểm thử'
from pg_temp.asset_lock_fixture;

do $grant_temp$
declare v_schema text;
begin
  select nspname into v_schema from pg_namespace where oid = pg_my_temp_schema();
  execute format('grant usage on schema %I to authenticated', v_schema);
end
$grant_temp$;
grant select, update on pg_temp.asset_lock_fixture to authenticated;
grant insert on pg_temp.asset_lock_results to authenticated;

-- Admin acquires the lease.
set local role authenticated;
do $admin_acquire$
declare
  f record;
  v_result jsonb;
begin
  select * into strict f from pg_temp.asset_lock_fixture;
  perform set_config('request.jwt.claim.sub', f.admin_uid::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', f.admin_uid, 'role', 'authenticated', 'aud', 'authenticated')::text, true);

  v_result := public.acquire_asset_edit_lock(
    f.organization_id, f.asset_id, gen_random_uuid(), 'PC – Admin'
  );
  if v_result ->> 'acquired' <> 'true' then
    raise exception 'Admin should acquire an unlocked asset: %', v_result;
  end if;
  update pg_temp.asset_lock_fixture
  set admin_token = (v_result ->> 'lock_token')::uuid;
  insert into pg_temp.asset_lock_results values
    ('Admin acquires free asset', 'acquired=true and token returned',
     v_result::text, true);
end
$admin_acquire$;

-- Technician sees the lock but cannot take it.
do $technician_blocked$
declare
  f record;
  v_result jsonb;
  v_pass boolean;
begin
  select * into strict f from pg_temp.asset_lock_fixture;
  perform set_config('request.jwt.claim.sub', f.technician_uid::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', f.technician_uid, 'role', 'authenticated', 'aud', 'authenticated')::text, true);

  v_result := public.acquire_asset_edit_lock(
    f.organization_id, f.asset_id, gen_random_uuid(), 'Mobile – Technician'
  );
  v_pass := v_result ->> 'acquired' = 'false'
    and v_result ->> 'holder_user_id' = f.admin_uid::text
    and not (v_result ? 'lock_token');
  insert into pg_temp.asset_lock_results values
    ('Second platform cannot steal live lease', 'acquired=false; Admin shown; no token',
     v_result::text, v_pass);
end
$technician_blocked$;

-- Current owner can heartbeat; wrong token cannot release.
do $admin_heartbeat$
declare
  f record;
  v_result jsonb;
  v_wrong_release boolean;
begin
  select * into strict f from pg_temp.asset_lock_fixture;
  perform set_config('request.jwt.claim.sub', f.admin_uid::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', f.admin_uid, 'role', 'authenticated', 'aud', 'authenticated')::text, true);

  v_result := public.heartbeat_asset_edit_lock(f.organization_id, f.asset_id, f.admin_token);
  if v_result ->> 'renewed' <> 'true' then raise exception 'Valid heartbeat failed: %', v_result; end if;

  v_wrong_release := public.release_asset_edit_lock(f.organization_id, f.asset_id, gen_random_uuid());
  insert into pg_temp.asset_lock_results values
    ('Heartbeat and token ownership', 'renewed=true; wrong token release=false',
     v_result::text || '; wrong_release=' || v_wrong_release::text,
     v_result ->> 'renewed' = 'true' and not v_wrong_release);
end
$admin_heartbeat$;

-- Direct PostgREST UPDATE must be denied, while the lease-protected RPC succeeds.
do $protected_update$
declare
  f record;
  v_blocked boolean := false;
  v_asset public.assets;
begin
  select * into strict f from pg_temp.asset_lock_fixture;
  perform set_config('request.jwt.claim.sub', f.admin_uid::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', f.admin_uid, 'role', 'authenticated', 'aud', 'authenticated')::text, true);

  begin
    update public.assets set name = 'Direct update bypass attempt'
    where id = f.asset_id and organization_id = f.organization_id;
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  insert into pg_temp.asset_lock_results values
    ('Direct UPDATE bypass blocked', 'permission denied', 'blocked=' || v_blocked::text, v_blocked);

  select * into strict v_asset
  from public.update_asset_with_lock(
    f.organization_id, f.asset_id, f.admin_token,
    'Updated by lock RPC', '', '', '', 'Plant room',
    current_date, '', '', null, false, 'Đang hoạt động', 'Lease test'
  );
  insert into pg_temp.asset_lock_results values
    ('Valid token updates asset', 'name=Updated by lock RPC',
     'name=' || v_asset.name, v_asset.name = 'Updated by lock RPC');

  select * into strict v_asset
  from public.set_asset_archived_with_lock(
    f.organization_id, f.asset_id, f.admin_token, true
  );
  insert into pg_temp.asset_lock_results values
    ('Archive requires valid lease', 'archived_at is not null',
     'archived=' || (v_asset.archived_at is not null)::text,
     v_asset.archived_at is not null);

  select * into strict v_asset
  from public.set_asset_archived_with_lock(
    f.organization_id, f.asset_id, f.admin_token, false
  );
  insert into pg_temp.asset_lock_results values
    ('Restore requires valid lease', 'archived_at is null',
     'archived=' || (v_asset.archived_at is not null)::text,
     v_asset.archived_at is null);
end
$protected_update$;

-- Release by owner, then Technician can acquire the same asset.
do $release_and_transfer$
declare
  f record;
  v_released boolean;
  v_result jsonb;
begin
  select * into strict f from pg_temp.asset_lock_fixture;
  perform set_config('request.jwt.claim.sub', f.admin_uid::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', f.admin_uid, 'role', 'authenticated', 'aud', 'authenticated')::text, true);

  v_released := public.release_asset_edit_lock(f.organization_id, f.asset_id, f.admin_token);
  if not v_released then raise exception 'Current owner could not release lease.'; end if;

  perform set_config('request.jwt.claim.sub', f.technician_uid::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', f.technician_uid, 'role', 'authenticated', 'aud', 'authenticated')::text, true);

  v_result := public.acquire_asset_edit_lock(
    f.organization_id, f.asset_id, gen_random_uuid(), 'Mobile – Technician'
  );
  if v_result ->> 'acquired' <> 'true' then
    raise exception 'Technician should acquire after Admin release: %', v_result;
  end if;
  update pg_temp.asset_lock_fixture
  set technician_token = (v_result ->> 'lock_token')::uuid;

  insert into pg_temp.asset_lock_results values
    ('Lock transferred after release', 'Technician acquired=true',
     v_result::text, v_result ->> 'acquired' = 'true');
end
$release_and_transfer$;

-- Simulate a dead/offline owner: server expiry is authoritative after two minutes.
reset role;
update public.asset_edit_locks
set expires_at = clock_timestamp() - interval '1 second'
where organization_id = (select organization_id from pg_temp.asset_lock_fixture)
  and asset_id = (select asset_id from pg_temp.asset_lock_fixture);

set local role authenticated;
do $expired_lease$
declare
  f record;
  v_heartbeat jsonb;
  v_result jsonb;
begin
  select * into strict f from pg_temp.asset_lock_fixture;
  perform set_config('request.jwt.claim.sub', f.technician_uid::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', f.technician_uid, 'role', 'authenticated', 'aud', 'authenticated')::text, true);

  v_heartbeat := public.heartbeat_asset_edit_lock(f.organization_id, f.asset_id, f.technician_token);
  if v_heartbeat ->> 'renewed' <> 'false' then
    raise exception 'Expired token must not be renewed: %', v_heartbeat;
  end if;

  perform set_config('request.jwt.claim.sub', f.admin_uid::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', f.admin_uid, 'role', 'authenticated', 'aud', 'authenticated')::text, true);

  v_result := public.acquire_asset_edit_lock(
    f.organization_id, f.asset_id, gen_random_uuid(), 'PC – Admin Reconnected'
  );
  insert into pg_temp.asset_lock_results values
    ('Expired lease can be replaced', 'Admin acquired=true',
     v_result::text, v_result ->> 'acquired' = 'true');
  if v_result ->> 'acquired' <> 'true' then
    raise exception 'Admin could not replace expired lease: %', v_result;
  end if;
  update pg_temp.asset_lock_fixture
  set admin_token = (v_result ->> 'lock_token')::uuid;

  perform set_config('request.jwt.claim.sub', f.technician_uid::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', f.technician_uid, 'role', 'authenticated', 'aud', 'authenticated')::text, true);

  begin
    perform public.update_asset_with_lock(
      f.organization_id, f.asset_id, f.technician_token,
      'Stale Mobile write must fail', '', '', '', '',
      current_date, '', '', null, false, 'Đang hoạt động', 'Stale token test'
    );
    insert into pg_temp.asset_lock_results values
      ('Old token cannot write after takeover', 'lease rejection SQLSTATE 55000',
       'RPC unexpectedly accepted stale token', false);
  exception when SQLSTATE '55000' then
    insert into pg_temp.asset_lock_results values
      ('Old token cannot write after takeover', 'lease rejection SQLSTATE 55000',
       'stale token rejected', true);
  end;
end
$expired_lease$;

reset role;

select test_case, expected, actual,
       case when passed then 'PASS' else 'FAIL' end as result
from pg_temp.asset_lock_results
order by test_case;

rollback;
