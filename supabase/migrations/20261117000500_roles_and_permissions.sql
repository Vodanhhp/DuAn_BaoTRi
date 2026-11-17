-- BAOTRI Mini - Migration 003: role and permission foundation
-- Additive migration. Keeps the legacy organization_members.role column for
-- compatibility while introducing role-based permissions for future RLS policies.
-- REVIEW ON BAOTRI-Mini-Test FIRST. Do not apply to Production directly.

begin;

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  description text not null default '',
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_org_id_id_unique unique (organization_id, id),
  constraint roles_org_code_unique unique (organization_id, code),
  constraint roles_code_format check (code ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint roles_name_not_blank check (char_length(btrim(name)) between 1 and 100)
);

create table public.permissions (
  code text primary key,
  module text not null,
  action text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  constraint permissions_code_format check (code ~ '^[a-z][a-z0-9_.]{2,95}$')
);

create table public.role_permissions (
  organization_id uuid not null,
  role_id uuid not null,
  permission_code text not null references public.permissions(code) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (organization_id, role_id, permission_code),
  foreign key (organization_id, role_id)
    references public.roles(organization_id, id) on delete cascade
);

create table public.member_roles (
  organization_id uuid not null,
  member_id uuid not null,
  role_id uuid not null,
  assigned_by_user_id uuid references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (organization_id, member_id, role_id),
  foreign key (organization_id, member_id)
    references public.organization_members(organization_id, id) on delete cascade,
  foreign key (organization_id, role_id)
    references public.roles(organization_id, id) on delete cascade
);

create index roles_org_active_idx on public.roles(organization_id, is_active);
create index role_permissions_role_idx on public.role_permissions(organization_id, role_id);
create index member_roles_member_idx on public.member_roles(organization_id, member_id);
create index member_roles_role_idx on public.member_roles(organization_id, role_id);

insert into public.permissions (code, module, action, description) values
  ('dashboard.view', 'dashboard', 'view', 'Xem tổng quan'),
  ('assets.view', 'assets', 'view', 'Xem danh mục và hồ sơ thiết bị'),
  ('assets.create', 'assets', 'create', 'Thêm thiết bị'),
  ('assets.update', 'assets', 'update', 'Sửa hồ sơ thiết bị'),
  ('assets.delete', 'assets', 'delete', 'Xóa thiết bị'),
  ('inventory.view', 'inventory', 'view', 'Xem kho vật tư'),
  ('inventory.create', 'inventory', 'create', 'Thêm vật tư'),
  ('inventory.update', 'inventory', 'update', 'Sửa thông tin vật tư'),
  ('inventory.adjust', 'inventory', 'adjust', 'Nhập, xuất và điều chỉnh kho'),
  ('inventory.delete', 'inventory', 'delete', 'Xóa vật tư'),
  ('maintenance.view', 'maintenance', 'view', 'Xem kế hoạch và công việc bảo trì'),
  ('maintenance.create', 'maintenance', 'create', 'Tạo kế hoạch và công việc bảo trì'),
  ('maintenance.update', 'maintenance', 'update', 'Cập nhật kế hoạch và công việc bảo trì'),
  ('maintenance.delete', 'maintenance', 'delete', 'Xóa kế hoạch và công việc bảo trì'),
  ('checklist.view', 'checklist', 'view', 'Xem biểu mẫu và kết quả Checklist'),
  ('checklist.template.manage', 'checklist', 'template.manage', 'Tạo và sửa biểu mẫu Checklist'),
  ('checklist.result.create', 'checklist', 'result.create', 'Thực hiện Checklist và lập phiếu kết quả'),
  ('logs.view', 'logs', 'view', 'Xem nhật ký bảo trì và kho'),
  ('logs.create', 'logs', 'create', 'Tạo nhật ký'),
  ('reports.view', 'reports', 'view', 'Xem và xuất báo cáo'),
  ('settings.view', 'settings', 'view', 'Xem cấu hình doanh nghiệp'),
  ('settings.manage', 'settings', 'manage', 'Thay đổi cấu hình doanh nghiệp'),
  ('users.view', 'users', 'view', 'Xem danh sách người dùng'),
  ('users.manage', 'users', 'manage', 'Mời, sửa, khóa và thu hồi người dùng'),
  ('roles.view', 'roles', 'view', 'Xem danh sách vai trò và quyền'),
  ('roles.manage', 'roles', 'manage', 'Tạo và chỉnh sửa vai trò, phân quyền')
on conflict (code) do update set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description;

-- Create the three built-in roles for every existing organization.
insert into public.roles (organization_id, code, name, description, is_system)
select o.id, r.code, r.name, r.description, true
from public.organizations o
cross join (values
  ('admin', 'Admin', 'Quản trị toàn bộ doanh nghiệp'),
  ('technician', 'Kỹ thuật viên', 'Thực hiện nghiệp vụ kỹ thuật'),
  ('viewer', 'Người xem', 'Chỉ xem dữ liệu được phép')
) as r(code, name, description)
on conflict (organization_id, code) do nothing;

-- Admin receives the complete permission catalog.
insert into public.role_permissions (organization_id, role_id, permission_code)
select r.organization_id, r.id, p.code
from public.roles r
cross join public.permissions p
where r.code = 'admin'
on conflict do nothing;

-- Technician: operational read/write permissions, without administration,
-- destructive deletes, or organization-wide configuration.
insert into public.role_permissions (organization_id, role_id, permission_code)
select r.organization_id, r.id, p.code
from public.roles r
join public.permissions p on p.code in (
  'dashboard.view',
  'assets.view', 'assets.create', 'assets.update',
  'inventory.view', 'inventory.create', 'inventory.update', 'inventory.adjust',
  'maintenance.view', 'maintenance.create', 'maintenance.update',
  'checklist.view', 'checklist.result.create',
  'logs.view', 'logs.create',
  'reports.view', 'settings.view'
)
where r.code = 'technician'
on conflict do nothing;

-- Viewer: read-only access.
insert into public.role_permissions (organization_id, role_id, permission_code)
select r.organization_id, r.id, p.code
from public.roles r
join public.permissions p on p.action = 'view'
where r.code = 'viewer'
on conflict do nothing;

-- Map existing memberships without changing their legacy role values.
insert into public.member_roles (organization_id, member_id, role_id, assigned_by_user_id)
select
  m.organization_id,
  m.id,
  r.id,
  m.invited_by_user_id
from public.organization_members m
join public.roles r
  on r.organization_id = m.organization_id
 and r.code = case when m.role = 'admin' then 'admin' else 'technician' end
on conflict do nothing;

-- Preserve legacy admin checks while also recognizing role assignments.
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
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and o.status = 'active'
      and (
        m.role = p_role
        or exists (
          select 1
          from public.member_roles mr
          join public.roles r
            on r.organization_id = mr.organization_id
           and r.id = mr.role_id
          where mr.organization_id = m.organization_id
            and mr.member_id = m.id
            and r.code = p_role
            and r.is_active
        )
      )
  );
$$;

create or replace function public.has_org_permission(
  p_organization_id uuid,
  p_permission_code text
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
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    join public.member_roles mr
      on mr.organization_id = m.organization_id
     and mr.member_id = m.id
    join public.roles r
      on r.organization_id = mr.organization_id
     and r.id = mr.role_id
     and r.is_active
    join public.role_permissions rp
      on rp.organization_id = r.organization_id
     and rp.role_id = r.id
     and rp.permission_code = p_permission_code
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and o.status = 'active'
  );
$$;

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.member_roles enable row level security;

create policy roles_select_org_member on public.roles
for select to authenticated
using (public.is_org_member(organization_id));

create policy permissions_select_authenticated on public.permissions
for select to authenticated
using (true);

create policy role_permissions_select_org_member on public.role_permissions
for select to authenticated
using (public.is_org_member(organization_id));

create policy member_roles_select_org_member on public.member_roles
for select to authenticated
using (public.is_org_member(organization_id));

revoke all on table public.roles, public.permissions,
  public.role_permissions, public.member_roles from anon, authenticated;

grant select on table public.roles, public.permissions,
  public.role_permissions, public.member_roles to authenticated;

revoke all on function public.has_org_role(uuid, text) from public, anon;
revoke all on function public.has_org_permission(uuid, text) from public, anon;
grant execute on function public.has_org_role(uuid, text) to authenticated;
grant execute on function public.has_org_permission(uuid, text) to authenticated;

comment on table public.roles is
  'Organization-scoped built-in and custom roles. Client writes are reserved for a trusted backend.';
comment on table public.permissions is
  'Application-owned permission catalog. Permission codes are not user-defined.';
comment on table public.role_permissions is
  'Permission grants attached to organization roles. Client writes are reserved for a trusted backend.';
comment on table public.member_roles is
  'Role assignments for organization memberships. Client writes are reserved for a trusted backend.';
comment on function public.has_org_permission(uuid, text) is
  'Checks effective permissions from active membership role assignments for the current authenticated user.';

commit;
