-- BAOTRI Mini: read-only verification for the personal organization bootstrap
-- Replace the email placeholder with the exact Auth email used by the bootstrap.
-- Run ONLY on BAOTRI-Mini-Test after the bootstrap script succeeds.
-- This script makes no changes.

do $verify$
declare
  v_email text := 'REPLACE_WITH_AUTH_EMAIL';
  v_user_id uuid;
  v_user_count integer;
  v_membership_count integer;
  v_admin_count integer;
  v_settings_count integer;
begin
  if v_email = 'REPLACE_WITH_AUTH_EMAIL' or btrim(v_email) = '' then
    raise exception 'Replace REPLACE_WITH_AUTH_EMAIL with the exact Auth email.';
  end if;

  select count(*) into v_user_count
  from auth.users
  where lower(email) = lower(btrim(v_email));

  if v_user_count <> 1 then
    raise exception 'Expected exactly one Auth user, found %.', v_user_count;
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = lower(btrim(v_email));

  select count(*) into v_membership_count
  from public.organization_members
  where user_id = v_user_id and status = 'active';

  select count(*) into v_admin_count
  from public.organization_members
  where user_id = v_user_id and status = 'active' and role = 'admin';

  select count(*) into v_settings_count
  from public.organization_members m
  join public.organization_settings s
    on s.organization_id = m.organization_id
  where m.user_id = v_user_id and m.status = 'active';

  if v_membership_count <> 1 then
    raise exception 'Expected exactly one active membership, found %.', v_membership_count;
  end if;
  if v_admin_count <> 1 then
    raise exception 'Expected exactly one active admin membership, found %.', v_admin_count;
  end if;
  if v_settings_count <> 1 then
    raise exception 'Expected settings row for the active organization, found %.', v_settings_count;
  end if;
end;
$verify$;

select
  o.id as organization_id,
  o.name as organization_name,
  o.status as organization_status,
  m.role,
  m.status as membership_status,
  (s.organization_id is not null) as settings_present,
  (public.is_org_member(o.id)) as membership_helper_true,
  (public.has_org_role(o.id, 'admin')) as admin_helper_true
from auth.users u
join public.organization_members m on m.user_id = u.id
join public.organizations o on o.id = m.organization_id
left join public.organization_settings s on s.organization_id = o.id
where lower(u.email) = lower('REPLACE_WITH_AUTH_EMAIL');
