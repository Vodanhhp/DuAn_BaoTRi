-- BAOTRI Mini: one-time personal organization bootstrap
-- Run ONLY on BAOTRI-Mini-Test after replacing the email placeholder below.
-- This script creates one "Cá nhân" organization, makes the selected Auth user
-- its active admin, and creates default organization settings.
-- It does not create Auth users, business records, Storage buckets, or touch local data.
-- One-time script: intentionally aborts if the selected user already has any membership.

begin;

do $bootstrap$
declare
  v_email text := 'REPLACE_WITH_AUTH_EMAIL';
  v_user_id uuid;
  v_user_count integer;
  v_org_id uuid;
begin
  if v_email = 'REPLACE_WITH_AUTH_EMAIL' or btrim(v_email) = '' then
    raise exception 'Replace REPLACE_WITH_AUTH_EMAIL with the exact email of the intended Auth user before running.';
  end if;

  select count(*) into v_user_count
  from auth.users
  where lower(email) = lower(btrim(v_email));

  if v_user_count <> 1 then
    raise exception 'Expected exactly one Auth user for email %, found %. No organization was created.', v_email, v_user_count;
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = lower(btrim(v_email));

  if exists (
    select 1 from public.organization_members
    where user_id = v_user_id
  ) then
    raise exception 'This Auth user already has an organization membership. Stop and inspect existing records; do not rerun bootstrap.';
  end if;

  insert into public.profiles (id, display_name)
  select v_user_id, nullif(btrim(raw_user_meta_data ->> 'display_name'), '')
  from auth.users
  where id = v_user_id
  on conflict (id) do nothing;

  insert into public.organizations (name, status, created_by)
  values ('Cá nhân', 'active', v_user_id)
  returning id into v_org_id;

  insert into public.organization_members (
    organization_id, user_id, role, status, invited_by_user_id
  )
  values (v_org_id, v_user_id, 'admin', 'active', v_user_id);

  insert into public.organization_settings (organization_id, asset_categories)
  values (v_org_id, '[]'::jsonb);

  raise notice 'Created personal organization % for Auth user %.', v_org_id, v_user_id;
end;
$bootstrap$;

-- Result row should show exactly one active admin membership and settings=true.
select
  o.id as organization_id,
  o.name as organization_name,
  o.status as organization_status,
  p.id as auth_user_id,
  m.role,
  m.status as membership_status,
  (s.organization_id is not null) as settings_created
from auth.users u
join public.profiles p on p.id = u.id
join public.organization_members m on m.user_id = u.id
join public.organizations o on o.id = m.organization_id
left join public.organization_settings s on s.organization_id = o.id
where lower(u.email) = lower('REPLACE_WITH_AUTH_EMAIL');

commit;
