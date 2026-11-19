-- BAOTRI Mini — Migration 016: per-asset edit leases.
-- Apply to BAOTRI-Mini-Test only after reviewing this file and its SQL test.
-- Do not apply to Production without separate approval.
--
-- A lease is authoritative on the server. Clients must heartbeat before the
-- two-minute expiry and must present the current token for every asset update.
-- Direct authenticated UPDATE on assets is revoked so the lock cannot be
-- bypassed by a stale/offline client or by a modified frontend.

begin;

create table public.asset_edit_locks (
  organization_id uuid not null,
  asset_id uuid not null,
  holder_user_id uuid not null references auth.users(id) on delete cascade,
  holder_device_id uuid not null,
  holder_label text not null,
  lock_token uuid not null,
  acquired_at timestamptz not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null,
  constraint asset_edit_locks_pkey primary key (organization_id, asset_id),
  constraint asset_edit_locks_asset_fk
    foreign key (organization_id, asset_id)
    references public.assets (organization_id, id) on delete cascade,
  constraint asset_edit_locks_label_length
    check (char_length(holder_label) between 1 and 160),
  constraint asset_edit_locks_expiry_order
    check (expires_at > acquired_at)
);

create index asset_edit_locks_expiry_idx
  on public.asset_edit_locks (expires_at);

alter table public.asset_edit_locks enable row level security;
revoke all on table public.asset_edit_locks from public, anon, authenticated;

-- Atomic lock acquisition. A live lease is never stolen, including by the
-- same user/device; after expiry, exactly one concurrent caller can replace it.
create or replace function public.acquire_asset_edit_lock(
  p_organization_id uuid,
  p_asset_id uuid,
  p_device_id uuid,
  p_holder_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_lock public.asset_edit_locks;
  v_label text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_organization_id is null or p_asset_id is null or p_device_id is null then
    raise exception 'Organization, asset and device identifiers are required' using errcode = '22023';
  end if;
  if not public.has_org_permission(p_organization_id, 'assets.update') then
    raise exception 'Missing assets.update permission for this organization' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.assets a
    where a.organization_id = p_organization_id and a.id = p_asset_id
  ) then
    raise exception 'Asset not found in this organization' using errcode = 'P0002';
  end if;

  v_label := left(coalesce(
    nullif(btrim(p_holder_label), ''),
    nullif(auth.jwt() ->> 'email', ''),
    auth.uid()::text
  ), 160);

  insert into public.asset_edit_locks (
    organization_id, asset_id, holder_user_id, holder_device_id,
    holder_label, lock_token, acquired_at, expires_at, updated_at
  ) values (
    p_organization_id, p_asset_id, auth.uid(), p_device_id,
    v_label, gen_random_uuid(), clock_timestamp(),
    clock_timestamp() + interval '2 minutes', clock_timestamp()
  )
  on conflict (organization_id, asset_id) do update
    set holder_user_id = excluded.holder_user_id,
        holder_device_id = excluded.holder_device_id,
        holder_label = excluded.holder_label,
        lock_token = excluded.lock_token,
        acquired_at = excluded.acquired_at,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    where public.asset_edit_locks.expires_at <= clock_timestamp()
  returning * into v_lock;

  if found then
    return jsonb_build_object(
      'acquired', true,
      'asset_id', v_lock.asset_id,
      'holder_user_id', v_lock.holder_user_id,
      'holder_device_id', v_lock.holder_device_id,
      'holder_label', v_lock.holder_label,
      'lock_token', v_lock.lock_token,
      'acquired_at', v_lock.acquired_at,
      'expires_at', v_lock.expires_at
    );
  end if;

  select * into v_lock
  from public.asset_edit_locks l
  where l.organization_id = p_organization_id
    and l.asset_id = p_asset_id
    and l.expires_at > clock_timestamp();

  if not found then
    -- The conflicting lease expired between the attempted upsert and read.
    -- The caller must retry acquisition; never return a token it does not own.
    return jsonb_build_object('acquired', false, 'retry', true);
  end if;

  return jsonb_build_object(
    'acquired', false,
    'asset_id', v_lock.asset_id,
    'holder_user_id', v_lock.holder_user_id,
    'holder_device_id', v_lock.holder_device_id,
    'holder_label', v_lock.holder_label,
    'acquired_at', v_lock.acquired_at,
    'expires_at', v_lock.expires_at
  );
end;
$$;

create or replace function public.heartbeat_asset_edit_lock(
  p_organization_id uuid,
  p_asset_id uuid,
  p_lock_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_expires_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.has_org_permission(p_organization_id, 'assets.update') then
    raise exception 'Missing assets.update permission for this organization' using errcode = '42501';
  end if;
  if p_lock_token is null then
    raise exception 'Lock token is required' using errcode = '22023';
  end if;

  update public.asset_edit_locks l
  set expires_at = clock_timestamp() + interval '2 minutes',
      updated_at = clock_timestamp()
  where l.organization_id = p_organization_id
    and l.asset_id = p_asset_id
    and l.holder_user_id = auth.uid()
    and l.lock_token = p_lock_token
    and l.expires_at > clock_timestamp()
  returning l.expires_at into v_expires_at;

  if not found then
    return jsonb_build_object('renewed', false, 'reason', 'lease_missing_expired_or_replaced');
  end if;

  return jsonb_build_object('renewed', true, 'expires_at', v_expires_at);
end;
$$;

create or replace function public.release_asset_edit_lock(
  p_organization_id uuid,
  p_asset_id uuid,
  p_lock_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_lock_token is null then
    return false;
  end if;

  delete from public.asset_edit_locks l
  where l.organization_id = p_organization_id
    and l.asset_id = p_asset_id
    and l.holder_user_id = auth.uid()
    and l.lock_token = p_lock_token;

  return found;
end;
$$;

-- Read active lock metadata without exposing the secret lock token.
create or replace function public.list_asset_edit_locks(
  p_organization_id uuid
)
returns table (
  asset_id uuid,
  holder_user_id uuid,
  holder_device_id uuid,
  holder_label text,
  acquired_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.has_org_permission(p_organization_id, 'assets.view') then
    raise exception 'Missing assets.view permission for this organization' using errcode = '42501';
  end if;

  return query
  select l.asset_id, l.holder_user_id, l.holder_device_id,
         l.holder_label, l.acquired_at, l.expires_at
  from public.asset_edit_locks l
  where l.organization_id = p_organization_id
    and l.expires_at > clock_timestamp()
  order by l.acquired_at;
end;
$$;

-- The only permitted path to update an asset's editable master fields.
create or replace function public.update_asset_with_lock(
  p_organization_id uuid,
  p_asset_id uuid,
  p_lock_token uuid,
  p_name text,
  p_brand text,
  p_model text,
  p_serial text,
  p_location text,
  p_commissioned_at date,
  p_power text,
  p_cycle text,
  p_cycle_started_at date,
  p_transferred_from_other_facility boolean,
  p_status text,
  p_notes text
)
returns public.assets
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_lock public.asset_edit_locks;
  v_asset public.assets;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.has_org_permission(p_organization_id, 'assets.update') then
    raise exception 'Missing assets.update permission for this organization' using errcode = '42501';
  end if;
  if p_lock_token is null then
    raise exception 'Lock token is required' using errcode = '22023';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'Asset name is required' using errcode = '22023';
  end if;
  if p_status not in ('Đang hoạt động', 'Đang sửa chữa', 'Ngừng sử dụng', 'Thanh lý') then
    raise exception 'Unsupported asset status' using errcode = '22023';
  end if;

  select * into v_lock
  from public.asset_edit_locks l
  where l.organization_id = p_organization_id
    and l.asset_id = p_asset_id
  for update;

  if not found
     or v_lock.holder_user_id <> auth.uid()
     or v_lock.lock_token <> p_lock_token
     or v_lock.expires_at <= clock_timestamp() then
    raise exception 'Asset edit lease is not owned or has expired' using errcode = '55000';
  end if;

  update public.assets a
  set name = btrim(p_name),
      brand = coalesce(p_brand, ''),
      model = coalesce(p_model, ''),
      serial = coalesce(p_serial, ''),
      location = coalesce(p_location, ''),
      commissioned_at = p_commissioned_at,
      power = coalesce(p_power, ''),
      cycle = coalesce(p_cycle, ''),
      cycle_started_at = p_cycle_started_at,
      transferred_from_other_facility = coalesce(p_transferred_from_other_facility, false),
      status = p_status,
      notes = coalesce(p_notes, ''),
      updated_at = clock_timestamp()
  where a.organization_id = p_organization_id and a.id = p_asset_id
  returning * into v_asset;

  if not found then
    raise exception 'Asset not found in this organization' using errcode = 'P0002';
  end if;

  return v_asset;
end;
$$;

create or replace function public.set_asset_archived_with_lock(
  p_organization_id uuid,
  p_asset_id uuid,
  p_lock_token uuid,
  p_archived boolean
)
returns public.assets
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_lock public.asset_edit_locks;
  v_asset public.assets;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.has_org_permission(p_organization_id, 'assets.update') then
    raise exception 'Missing assets.update permission for this organization' using errcode = '42501';
  end if;
  if p_lock_token is null or p_archived is null then
    raise exception 'Lock token and archived state are required' using errcode = '22023';
  end if;

  select * into v_lock
  from public.asset_edit_locks l
  where l.organization_id = p_organization_id
    and l.asset_id = p_asset_id
  for update;

  if not found
     or v_lock.holder_user_id <> auth.uid()
     or v_lock.lock_token <> p_lock_token
     or v_lock.expires_at <= clock_timestamp() then
    raise exception 'Asset edit lease is not owned or has expired' using errcode = '55000';
  end if;

  update public.assets a
  set archived_at = case when p_archived then clock_timestamp() else null end,
      updated_at = clock_timestamp()
  where a.organization_id = p_organization_id and a.id = p_asset_id
  returning * into v_asset;

  if not found then
    raise exception 'Asset not found in this organization' using errcode = 'P0002';
  end if;

  return v_asset;
end;
$$;

-- The browser cannot bypass lease checks with direct PostgREST UPDATE.
revoke update on table public.assets from authenticated;

revoke all on function public.acquire_asset_edit_lock(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.heartbeat_asset_edit_lock(uuid, uuid, uuid) from public, anon;
revoke all on function public.release_asset_edit_lock(uuid, uuid, uuid) from public, anon;
revoke all on function public.list_asset_edit_locks(uuid) from public, anon;
revoke all on function public.update_asset_with_lock(uuid, uuid, uuid, text, text, text, text, text, date, text, text, date, boolean, text, text) from public, anon;
revoke all on function public.set_asset_archived_with_lock(uuid, uuid, uuid, boolean) from public, anon;

grant execute on function public.acquire_asset_edit_lock(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.heartbeat_asset_edit_lock(uuid, uuid, uuid) to authenticated;
grant execute on function public.release_asset_edit_lock(uuid, uuid, uuid) to authenticated;
grant execute on function public.list_asset_edit_locks(uuid) to authenticated;
grant execute on function public.update_asset_with_lock(uuid, uuid, uuid, text, text, text, text, text, date, text, text, date, boolean, text, text) to authenticated;
grant execute on function public.set_asset_archived_with_lock(uuid, uuid, uuid, boolean) to authenticated;

comment on table public.asset_edit_locks is
  'Server-authoritative two-minute leases preventing concurrent edits to the same asset across platforms.';

comment on function public.acquire_asset_edit_lock(uuid, uuid, uuid, text) is
  'Atomically acquire an asset edit lease. A live lease cannot be stolen; expired leases may be replaced.';
comment on function public.heartbeat_asset_edit_lock(uuid, uuid, uuid) is
  'Extend an owned, unexpired asset edit lease by two minutes using server time.';
comment on function public.release_asset_edit_lock(uuid, uuid, uuid) is
  'Release only the current authenticated user lease with the exact token.';
comment on function public.list_asset_edit_locks(uuid) is
  'List active asset edit lease metadata without exposing lock tokens.';
comment on function public.update_asset_with_lock(uuid, uuid, uuid, text, text, text, text, text, date, text, text, date, boolean, text, text) is
  'Update asset master fields only when the caller owns a currently valid server-side edit lease.';
comment on function public.set_asset_archived_with_lock(uuid, uuid, uuid, boolean) is
  'Archive/restore an asset only when the caller owns a currently valid server-side edit lease.';

commit;
