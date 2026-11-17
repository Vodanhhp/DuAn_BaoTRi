-- BAOTRI Mini - Migration 014: remove a member from an organization
-- Removes only the organization membership and role assignments.
-- Keeps auth.users and profiles intact; no Production changes.

begin;

create or replace function public.admin_remove_org_membership(
  p_organization_id uuid,
  p_member_id uuid,
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

  select m.user_id, m.role, r.code
    into v_target_user_id, v_legacy_role, v_current_role
  from public.organization_members m
  left join public.member_roles mr
    on mr.organization_id = m.organization_id and mr.member_id = m.id
  left join public.roles r
    on r.organization_id = mr.organization_id and r.id = mr.role_id
  where m.organization_id = p_organization_id
    and m.id = p_member_id
  for update of m;

  if not found then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;
  if v_target_user_id = p_actor_user_id then
    raise exception 'cannot_remove_self' using errcode = '42501';
  end if;
  if v_legacy_role = 'admin' or v_current_role = 'admin' then
    raise exception 'cannot_remove_admin_member' using errcode = '42501';
  end if;
  if v_current_role not in ('technician', 'viewer') then
    raise exception 'member_role_not_supported' using errcode = '55000';
  end if;

  -- FK cascade removes role assignments only. Auth identity and profile remain.
  delete from public.organization_members
  where organization_id = p_organization_id and id = p_member_id;
end;
$$;

revoke all on function public.admin_remove_org_membership(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_remove_org_membership(uuid, uuid, uuid)
  to service_role;

comment on function public.admin_remove_org_membership(uuid, uuid, uuid) is
  'Trusted-backend-only removal from one organization. Preserves Auth user and profile; cascades only member role assignments.';

commit;
