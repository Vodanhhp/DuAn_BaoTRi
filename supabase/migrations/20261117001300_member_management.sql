-- BAOTRI Mini - Migration 013: secure organization member management
-- Apply to BAOTRI-Mini-Test first. Do not apply to Production without explicit approval.
begin;

alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is distinct from u.email;

create or replace function public.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), '')
    )
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, profiles.display_name);

  if new.email_confirmed_at is not null then
    update public.organization_members
    set status = 'active'
    where user_id = new.id
      and status = 'invited';
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_sync_insert on auth.users;
create trigger on_auth_user_profile_sync_insert
after insert on auth.users
for each row execute function public.sync_auth_user_profile();

drop trigger if exists on_auth_user_profile_sync_update on auth.users;
create trigger on_auth_user_profile_sync_update
after update of email, raw_user_meta_data, email_confirmed_at on auth.users
for each row execute function public.sync_auth_user_profile();

drop policy if exists profiles_select_same_org_members on public.profiles;
create policy profiles_select_same_org_members
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members as mine
    join public.organization_members as theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'active'
      and theirs.user_id = profiles.id
      and theirs.status in ('invited', 'active', 'suspended')
      and exists (
        select 1
        from public.organizations as o
        where o.id = mine.organization_id
          and o.status = 'active'
      )
  )
);

create or replace function public.admin_create_org_membership(
  p_organization_id uuid,
  p_user_id uuid,
  p_role_code text,
  p_invited_by_user_id uuid,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_member_id uuid;
  v_role_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_role_code not in ('technician', 'viewer') then
    raise exception 'unsupported_member_role' using errcode = '22023';
  end if;
  if p_status not in ('invited', 'active') then
    raise exception 'invalid_member_status' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.organizations
    where id = p_organization_id and status = 'active'
  ) then
    raise exception 'organization_not_active' using errcode = '23503';
  end if;
  select id into v_role_id
  from public.roles
  where organization_id = p_organization_id
    and code = p_role_code
    and is_active;
  if v_role_id is null then
    raise exception 'member_role_not_found' using errcode = '23503';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'auth_profile_not_found' using errcode = '23503';
  end if;

  insert into public.organization_members (
    organization_id, user_id, role, status, invited_by_user_id
  ) values (
    p_organization_id, p_user_id, 'user', p_status, p_invited_by_user_id
  )
  returning id into v_member_id;

  insert into public.member_roles (
    organization_id, member_id, role_id, assigned_by_user_id
  ) values (
    p_organization_id, v_member_id, v_role_id, p_invited_by_user_id
  );

  return v_member_id;
end;
$$;

create or replace function public.admin_update_org_member_role(
  p_organization_id uuid,
  p_member_id uuid,
  p_role_code text,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_role_id uuid;
  v_target_user_id uuid;
  v_legacy_role text;
  v_current_role text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_role_code not in ('technician', 'viewer') then
    raise exception 'unsupported_member_role' using errcode = '22023';
  end if;

  select m.user_id, m.role, r.code
    into v_target_user_id, v_legacy_role, v_current_role
  from public.organization_members m
  left join public.member_roles mr
    on mr.organization_id = m.organization_id and mr.member_id = m.id
  left join public.roles r
    on r.organization_id = mr.organization_id and r.id = mr.role_id
  where m.organization_id = p_organization_id
    and m.id = p_member_id;

  if not found then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;
  if v_target_user_id = p_actor_user_id then
    raise exception 'cannot_change_own_role' using errcode = '42501';
  end if;
  if v_legacy_role = 'admin' or v_current_role = 'admin' then
    raise exception 'cannot_manage_admin_member' using errcode = '42501';
  end if;

  select id into v_role_id
  from public.roles
  where organization_id = p_organization_id
    and code = p_role_code
    and is_active;
  if v_role_id is null then
    raise exception 'member_role_not_found' using errcode = '23503';
  end if;

  delete from public.member_roles
  where organization_id = p_organization_id and member_id = p_member_id;
  insert into public.member_roles (
    organization_id, member_id, role_id, assigned_by_user_id
  ) values (
    p_organization_id, p_member_id, v_role_id, p_actor_user_id
  );
end;
$$;

create or replace function public.admin_update_org_member_status(
  p_organization_id uuid,
  p_member_id uuid,
  p_status text,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_target_user_id uuid;
  v_legacy_role text;
  v_current_role text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'invalid_member_status' using errcode = '22023';
  end if;

  select m.user_id, m.role, r.code
    into v_target_user_id, v_legacy_role, v_current_role
  from public.organization_members m
  left join public.member_roles mr
    on mr.organization_id = m.organization_id and mr.member_id = m.id
  left join public.roles r
    on r.organization_id = mr.organization_id and r.id = mr.role_id
  where m.organization_id = p_organization_id
    and m.id = p_member_id;

  if not found then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;
  if v_target_user_id = p_actor_user_id then
    raise exception 'cannot_change_own_status' using errcode = '42501';
  end if;
  if v_legacy_role = 'admin' or v_current_role = 'admin' then
    raise exception 'cannot_manage_admin_member' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id and id = p_member_id
      and status in ('active', 'suspended')
  ) then
    raise exception 'invitation_not_accepted_yet' using errcode = '55000';
  end if;

  update public.organization_members
  set status = p_status
  where organization_id = p_organization_id and id = p_member_id;
end;
$$;

revoke all on function public.sync_auth_user_profile() from public, anon, authenticated;
revoke all on function public.admin_create_org_membership(uuid, uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_update_org_member_role(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_update_org_member_status(uuid, uuid, text, uuid) from public, anon, authenticated;

grant execute on function public.admin_create_org_membership(uuid, uuid, text, uuid, text) to service_role;
grant execute on function public.admin_update_org_member_role(uuid, uuid, text, uuid) to service_role;
grant execute on function public.admin_update_org_member_status(uuid, uuid, text, uuid) to service_role;

comment on column public.profiles.email is
  'Email mirror from auth.users for display to members of the same active organization.';
comment on function public.admin_create_org_membership(uuid, uuid, text, uuid, text) is
  'Trusted-backend-only membership creation. Supports Technician and Viewer, never Admin.';
comment on function public.admin_update_org_member_role(uuid, uuid, text, uuid) is
  'Trusted-backend-only role change. Cannot change self or an Admin membership.';
comment on function public.admin_update_org_member_status(uuid, uuid, text, uuid) is
  'Trusted-backend-only membership suspension/reactivation. Preserves Auth user and history.';

commit;
