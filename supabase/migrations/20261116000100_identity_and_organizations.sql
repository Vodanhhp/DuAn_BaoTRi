-- BAOTRI Mini
-- Migration 001: identity, organizations, and memberships
-- Draft for review only. Do NOT run on the production Supabase project until approved.
-- This migration intentionally does not create maintenance-domain tables or migrate local data.

begin;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (
    display_name is null or char_length(display_name) between 1 and 120
  ),
  constraint profiles_phone_length check (
    phone is null or char_length(phone) <= 30
  )
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active',
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_not_blank check (char_length(btrim(name)) > 0),
  constraint organizations_name_length check (char_length(name) <= 160),
  constraint organizations_status_check check (status in ('active', 'suspended'))
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  role text not null,
  status text not null default 'active',
  invited_by_user_id uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_members_role_check check (role in ('admin', 'user')),
  constraint organization_members_status_check check (status in ('invited', 'active', 'suspended')),
  constraint organization_members_org_user_unique unique (organization_id, user_id),
  constraint organization_members_org_id_id_unique unique (organization_id, id)
);

create index organization_members_user_status_idx
  on public.organization_members (user_id, status);

create index organization_members_org_status_role_idx
  on public.organization_members (organization_id, status, role);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger organization_members_set_updated_at
before update on public.organization_members
for each row execute function public.set_updated_at();

-- A profile is created automatically when an Auth user is provisioned.
-- The display name remains NULL unless supplied as Auth user metadata; the app
-- must request a real display name before creating an auditable work record.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- These SECURITY DEFINER helpers read membership rows without triggering
-- recursive organization_members RLS policies. They expose only boolean answers.
create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.organization_members as m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function public.has_org_role(
  p_organization_id uuid,
  p_role text
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.organization_members as m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = p_role
  );
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy profiles_select_self
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

-- Admins and users may read profile names of people sharing an active organization.
-- Membership RLS still limits the visible membership rows to the caller's own orgs.
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
      and theirs.status = 'active'
  )
);

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy organizations_select_member
on public.organizations
for select
to authenticated
using (public.is_org_member(id));

create policy organization_members_select_member
on public.organization_members
for select
to authenticated
using (public.is_org_member(organization_id));

-- Start from no client table privileges, then grant only the minimum needed.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.organizations from anon, authenticated;
revoke all on table public.organization_members from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, phone) on table public.profiles to authenticated;

grant select on table public.organizations to authenticated;
grant select on table public.organization_members to authenticated;

-- Helper functions are callable by authenticated sessions only.
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.has_org_role(uuid, text) from public, anon;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text) to authenticated;

comment on table public.profiles is
  'Application profile keyed to auth.users. Role and organization membership are stored separately.';
comment on table public.organizations is
  'Tenant boundary. Business data tables must carry organization_id and enforce tenant isolation.';
comment on table public.organization_members is
  'Organization membership and role. Client-side inserts/updates/deletes are intentionally not granted in migration 001.';
comment on function public.is_org_member(uuid) is
  'Returns whether the current authenticated user has active membership in the organization.';
comment on function public.has_org_role(uuid, text) is
  'Returns whether the current authenticated user has the requested active organization role.';

commit;
