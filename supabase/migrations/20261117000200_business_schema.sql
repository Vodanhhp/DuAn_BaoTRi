-- BAOTRI Mini
-- Migration 002: business-domain schema, tenant-safe foreign keys, and RLS
-- REVIEW DRAFT ONLY. Do NOT apply to production.
-- Depends on Migration 001:
--   public.organizations, public.organization_members,
--   public.is_org_member(uuid), public.has_org_role(uuid, text).
--
-- This migration creates schema only. It does not create an organization,
-- membership, Storage bucket, import data, or modify local IndexedDB data.

begin;

-- ---------------------------------------------------------------------------
-- Shared tenant-safe key: every business row can be referenced together with
-- its organization_id, preventing cross-organization foreign-key references.
-- ---------------------------------------------------------------------------

create table public.assets (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  category text not null,
  brand text not null default '',
  model text not null default '',
  serial text not null default '',
  location text not null default '',
  commissioned_at date,
  power text not null default '',
  cycle text not null default '',
  cycle_started_at date,
  transferred_from_other_facility boolean not null default false,
  status text not null default 'Đang hoạt động',
  notes text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assets_org_id_id_unique unique (organization_id, id),
  constraint assets_code_not_blank check (char_length(btrim(code)) > 0),
  constraint assets_name_not_blank check (char_length(btrim(name)) > 0),
  constraint assets_status_check check (
    status in ('Đang hoạt động', 'Đang sửa chữa', 'Ngừng sử dụng', 'Thanh lý')
  ),
  constraint assets_code_unique_per_org unique (organization_id, code)
);

create index assets_org_category_idx on public.assets (organization_id, category);
create index assets_org_status_idx on public.assets (organization_id, status);
create index assets_org_location_idx on public.assets (organization_id, location);

create table public.inventory_items (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  item_group text not null default '',
  unit text not null default '',
  part_number text,
  size text,
  quantity numeric(18,4) not null default 0,
  min_quantity numeric(18,4) not null default 0,
  location text not null default '',
  supplier text not null default '',
  unit_price numeric(18,2) not null default 0,
  updated_at timestamptz not null default now(),
  constraint inventory_items_org_id_id_unique unique (organization_id, id),
  constraint inventory_items_code_not_blank check (char_length(btrim(code)) > 0),
  constraint inventory_items_name_not_blank check (char_length(btrim(name)) > 0),
  constraint inventory_items_quantity_nonnegative check (quantity >= 0),
  constraint inventory_items_min_quantity_nonnegative check (min_quantity >= 0),
  constraint inventory_items_unit_price_nonnegative check (unit_price >= 0)
  -- Intentionally no unique constraint on (organization_id, code) yet:
  -- the development backup contains two VT-001 rows. The agreed go-live reset
  -- will discard development business data; uniqueness can be added after
  -- real inventory data is entered and checked.
);

create index inventory_items_org_name_idx on public.inventory_items (organization_id, name);
create index inventory_items_org_group_idx on public.inventory_items (organization_id, item_group);

create table public.maintenance_tasks (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  asset_id uuid not null,
  title text not null,
  due_date date,
  frequency text not null default '',
  status text not null default 'Chờ thực hiện',
  checklist text not null default '',
  readings text not null default '',
  notes text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_tasks_org_id_id_unique unique (organization_id, id),
  constraint maintenance_tasks_title_not_blank check (char_length(btrim(title)) > 0),
  constraint maintenance_tasks_status_check check (
    status in ('Chờ thực hiện', 'Đang thực hiện', 'Hoàn thành', 'Quá hạn')
  ),
  constraint maintenance_tasks_asset_fk
    foreign key (organization_id, asset_id)
    references public.assets (organization_id, id) on delete restrict
);

create index maintenance_tasks_org_asset_idx on public.maintenance_tasks (organization_id, asset_id);
create index maintenance_tasks_org_due_date_idx on public.maintenance_tasks (organization_id, due_date);
create index maintenance_tasks_org_status_idx on public.maintenance_tasks (organization_id, status);

create table public.maintenance_plans (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  asset_id uuid not null,
  title text not null,
  period text not null,
  start_date date,
  end_date date,
  execution text not null,
  contractor text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_plans_org_id_id_unique unique (organization_id, id),
  constraint maintenance_plans_title_not_blank check (char_length(btrim(title)) > 0),
  constraint maintenance_plans_period_check check (period in ('Tuần', 'Tháng', 'Quý', 'Năm')),
  constraint maintenance_plans_execution_check check (execution in ('Nội bộ', 'Thuê ngoài')),
  constraint maintenance_plans_date_order check (
    start_date is null or end_date is null or end_date >= start_date
  ),
  constraint maintenance_plans_asset_fk
    foreign key (organization_id, asset_id)
    references public.assets (organization_id, id) on delete restrict
);

create index maintenance_plans_org_asset_idx on public.maintenance_plans (organization_id, asset_id);
create index maintenance_plans_org_dates_idx on public.maintenance_plans (organization_id, start_date, end_date);

-- One current template per device. Each published version is a separate,
-- immutable row. JSONB preserves the item structure and display order.
create table public.checklist_templates (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  asset_id uuid not null,
  title text not null,
  description text not null default '',
  current_version integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checklist_templates_org_id_id_unique unique (organization_id, id),
  constraint checklist_templates_org_id_id_asset_unique unique (organization_id, id, asset_id),
  constraint checklist_templates_one_per_asset unique (organization_id, asset_id),
  constraint checklist_templates_version_positive check (current_version > 0),
  constraint checklist_templates_asset_fk
    foreign key (organization_id, asset_id)
    references public.assets (organization_id, id) on delete restrict
);

create index checklist_templates_org_active_idx on public.checklist_templates (organization_id, active);

create table public.checklist_template_versions (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  template_id uuid not null,
  asset_id uuid not null,
  version integer not null,
  title text not null,
  description text not null default '',
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint checklist_template_versions_org_id_id_unique unique (organization_id, id),
  constraint checklist_template_versions_org_template_version_unique
    unique (organization_id, template_id, version),
  constraint checklist_template_versions_org_id_template_asset_unique
    unique (organization_id, id, template_id, asset_id),
  constraint checklist_template_versions_version_positive check (version > 0),
  constraint checklist_template_versions_items_array check (jsonb_typeof(items) = 'array'),
  constraint checklist_template_versions_template_asset_fk
    foreign key (organization_id, template_id, asset_id)
    references public.checklist_templates (organization_id, id, asset_id) on delete restrict
);

create index checklist_template_versions_org_template_idx
  on public.checklist_template_versions (organization_id, template_id, version desc);

create table public.checklist_results (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  asset_id uuid not null,
  template_id uuid not null,
  template_version_id uuid not null,
  template_version integer not null,
  template_title text not null,
  performed_at timestamptz not null,
  performed_by text not null default '',
  result text not null,
  scheduled_for date,
  is_makeup boolean not null default false,
  notes text not null default '',
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint checklist_results_org_id_id_unique unique (organization_id, id),
  constraint checklist_results_version_positive check (template_version > 0),
  constraint checklist_results_result_check check (
    result in ('Đạt', 'Không đạt', 'Chưa hoàn thành')
  ),
  constraint checklist_results_items_array check (jsonb_typeof(items) = 'array'),
  constraint checklist_results_asset_fk
    foreign key (organization_id, asset_id)
    references public.assets (organization_id, id) on delete restrict,
  constraint checklist_results_template_asset_fk
    foreign key (organization_id, template_id, asset_id)
    references public.checklist_templates (organization_id, id, asset_id) on delete restrict,
  constraint checklist_results_version_template_asset_fk
    foreign key (organization_id, template_version_id, template_id, asset_id)
    references public.checklist_template_versions (organization_id, id, template_id, asset_id)
    on delete restrict
);

create index checklist_results_org_asset_performed_idx
  on public.checklist_results (organization_id, asset_id, performed_at desc);
create index checklist_results_org_template_idx
  on public.checklist_results (organization_id, template_id, performed_at desc);

-- Maintenance log is a separate history from Checklist results.
create table public.maintenance_logs (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  asset_id uuid not null,
  task_id uuid,
  checklist_result_id uuid,
  log_date date,
  kind text not null default '',
  description text not null default '',
  parts text not null default '',
  readings text not null default '',
  result text,
  completed_at timestamptz,
  performed_by text not null default '',
  created_at timestamptz not null default now(),
  constraint maintenance_logs_org_id_id_unique unique (organization_id, id),
  constraint maintenance_logs_result_check check (
    result is null or result in ('Đạt', 'Không đạt', '')
  ),
  constraint maintenance_logs_asset_fk
    foreign key (organization_id, asset_id)
    references public.assets (organization_id, id) on delete restrict,
  constraint maintenance_logs_task_asset_fk
    foreign key (organization_id, task_id)
    references public.maintenance_tasks (organization_id, id) on delete restrict,
  constraint maintenance_logs_checklist_result_fk
    foreign key (organization_id, checklist_result_id)
    references public.checklist_results (organization_id, id) on delete restrict
);

create index maintenance_logs_org_asset_date_idx
  on public.maintenance_logs (organization_id, asset_id, log_date desc);
create index maintenance_logs_org_task_idx
  on public.maintenance_logs (organization_id, task_id);

-- Quantity is stored on inventory_items. Every future movement and balance
-- change must be committed atomically by a reviewed database function/RPC.
create table public.inventory_movements (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  item_id uuid not null,
  movement_date date,
  movement_type text not null,
  quantity numeric(18,4) not null,
  reason text not null default '',
  linked_asset_id uuid,
  created_at timestamptz not null default now(),
  constraint inventory_movements_org_id_id_unique unique (organization_id, id),
  constraint inventory_movements_type_check check (
    movement_type in ('Nhập', 'Xuất', 'Điều chỉnh')
  ),
  constraint inventory_movements_quantity_positive check (quantity > 0),
  constraint inventory_movements_item_fk
    foreign key (organization_id, item_id)
    references public.inventory_items (organization_id, id) on delete restrict,
  constraint inventory_movements_asset_fk
    foreign key (organization_id, linked_asset_id)
    references public.assets (organization_id, id) on delete restrict
);

create index inventory_movements_org_item_date_idx
  on public.inventory_movements (organization_id, item_id, movement_date desc);

-- Storage object metadata only; actual image bytes will be handled in a
-- separate reviewed Storage migration/import step.
create table public.asset_images (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  asset_id uuid not null,
  position integer not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint,
  checksum text,
  created_at timestamptz not null default now(),
  constraint asset_images_org_id_id_unique unique (organization_id, id),
  constraint asset_images_position_nonnegative check (position >= 0),
  constraint asset_images_size_nonnegative check (size_bytes is null or size_bytes >= 0),
  constraint asset_images_path_not_blank check (char_length(btrim(storage_path)) > 0),
  constraint asset_images_org_asset_position_unique unique (organization_id, asset_id, position),
  constraint asset_images_storage_path_unique unique (storage_path),
  constraint asset_images_asset_fk
    foreign key (organization_id, asset_id)
    references public.assets (organization_id, id) on delete restrict
);

create index asset_images_org_asset_idx on public.asset_images (organization_id, asset_id, position);

-- Custom device-category tree. The exact JSON shape is intentionally not
-- constrained until the UI's saved format is reviewed from actual app code.
create table public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  asset_categories jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_settings_asset_categories_object check (
    jsonb_typeof(asset_categories) = 'object'
  )
);

-- Maintain updated_at for mutable master-data tables.
create trigger assets_set_updated_at
before update on public.assets
for each row execute function public.set_updated_at();

create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

create trigger maintenance_tasks_set_updated_at
before update on public.maintenance_tasks
for each row execute function public.set_updated_at();

create trigger maintenance_plans_set_updated_at
before update on public.maintenance_plans
for each row execute function public.set_updated_at();

create trigger checklist_templates_set_updated_at
before update on public.checklist_templates
for each row execute function public.set_updated_at();

create trigger organization_settings_set_updated_at
before update on public.organization_settings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: every row is scoped to an active organization membership.
-- Admin-only deletion for mutable master data; history rows are append-only
-- from the authenticated client (no UPDATE/DELETE grants or policies).
-- ---------------------------------------------------------------------------

alter table public.assets enable row level security;
alter table public.inventory_items enable row level security;
alter table public.maintenance_tasks enable row level security;
alter table public.maintenance_plans enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.checklist_template_versions enable row level security;
alter table public.checklist_results enable row level security;
alter table public.maintenance_logs enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.asset_images enable row level security;
alter table public.organization_settings enable row level security;

-- Assets
create policy assets_select_member on public.assets
for select to authenticated using (public.is_org_member(organization_id));
create policy assets_insert_member on public.assets
for insert to authenticated with check (public.is_org_member(organization_id));
create policy assets_update_member on public.assets
for update to authenticated using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));
create policy assets_delete_admin on public.assets
for delete to authenticated using (public.has_org_role(organization_id, 'admin'));

-- Inventory items
create policy inventory_items_select_member on public.inventory_items
for select to authenticated using (public.is_org_member(organization_id));
create policy inventory_items_insert_member on public.inventory_items
for insert to authenticated with check (public.is_org_member(organization_id));
create policy inventory_items_update_member on public.inventory_items
for update to authenticated using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));
create policy inventory_items_delete_admin on public.inventory_items
for delete to authenticated using (public.has_org_role(organization_id, 'admin'));

-- Tasks
create policy maintenance_tasks_select_member on public.maintenance_tasks
for select to authenticated using (public.is_org_member(organization_id));
create policy maintenance_tasks_insert_member on public.maintenance_tasks
for insert to authenticated with check (public.is_org_member(organization_id));
create policy maintenance_tasks_update_member on public.maintenance_tasks
for update to authenticated using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));
create policy maintenance_tasks_delete_admin on public.maintenance_tasks
for delete to authenticated using (public.has_org_role(organization_id, 'admin'));

-- Plans
create policy maintenance_plans_select_member on public.maintenance_plans
for select to authenticated using (public.is_org_member(organization_id));
create policy maintenance_plans_insert_member on public.maintenance_plans
for insert to authenticated with check (public.is_org_member(organization_id));
create policy maintenance_plans_update_member on public.maintenance_plans
for update to authenticated using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));
create policy maintenance_plans_delete_admin on public.maintenance_plans
for delete to authenticated using (public.has_org_role(organization_id, 'admin'));

-- Checklist template administration: Admin only may create/edit the form.
create policy checklist_templates_select_member on public.checklist_templates
for select to authenticated using (public.is_org_member(organization_id));
create policy checklist_templates_insert_admin on public.checklist_templates
for insert to authenticated with check (public.has_org_role(organization_id, 'admin'));
create policy checklist_templates_update_admin on public.checklist_templates
for update to authenticated using (public.has_org_role(organization_id, 'admin'))
with check (public.has_org_role(organization_id, 'admin'));
create policy checklist_templates_delete_admin on public.checklist_templates
for delete to authenticated using (public.has_org_role(organization_id, 'admin'));

-- Version rows are immutable from the client. Admin can append new versions.
create policy checklist_template_versions_select_member on public.checklist_template_versions
for select to authenticated using (public.is_org_member(organization_id));
create policy checklist_template_versions_insert_admin on public.checklist_template_versions
for insert to authenticated with check (public.has_org_role(organization_id, 'admin'));

-- Results are immutable history; active members may execute a checklist.
create policy checklist_results_select_member on public.checklist_results
for select to authenticated using (public.is_org_member(organization_id));
create policy checklist_results_insert_member on public.checklist_results
for insert to authenticated with check (public.is_org_member(organization_id));

-- Maintenance logs are append-only history.
create policy maintenance_logs_select_member on public.maintenance_logs
for select to authenticated using (public.is_org_member(organization_id));
create policy maintenance_logs_insert_member on public.maintenance_logs
for insert to authenticated with check (public.is_org_member(organization_id));

-- Inventory movements are append-only; balance changes need a future RPC.
create policy inventory_movements_select_member on public.inventory_movements
for select to authenticated using (public.is_org_member(organization_id));
create policy inventory_movements_insert_member on public.inventory_movements
for insert to authenticated with check (public.is_org_member(organization_id));

-- Images metadata
create policy asset_images_select_member on public.asset_images
for select to authenticated using (public.is_org_member(organization_id));
create policy asset_images_insert_member on public.asset_images
for insert to authenticated with check (public.is_org_member(organization_id));
create policy asset_images_delete_admin on public.asset_images
for delete to authenticated using (public.has_org_role(organization_id, 'admin'));

-- Organization-level settings
create policy organization_settings_select_member on public.organization_settings
for select to authenticated using (public.is_org_member(organization_id));
create policy organization_settings_insert_admin on public.organization_settings
for insert to authenticated with check (public.has_org_role(organization_id, 'admin'));
create policy organization_settings_update_admin on public.organization_settings
for update to authenticated using (public.has_org_role(organization_id, 'admin'))
with check (public.has_org_role(organization_id, 'admin'));

-- Explicit table privileges; RLS policies alone do not grant SQL privileges.
revoke all on table
  public.assets,
  public.inventory_items,
  public.maintenance_tasks,
  public.maintenance_plans,
  public.checklist_templates,
  public.checklist_template_versions,
  public.checklist_results,
  public.maintenance_logs,
  public.inventory_movements,
  public.asset_images,
  public.organization_settings
from anon, authenticated;

grant select on table
  public.assets,
  public.inventory_items,
  public.maintenance_tasks,
  public.maintenance_plans,
  public.checklist_templates,
  public.checklist_template_versions,
  public.checklist_results,
  public.maintenance_logs,
  public.inventory_movements,
  public.asset_images,
  public.organization_settings
to authenticated;

grant insert, update on table
  public.assets,
  public.inventory_items,
  public.maintenance_tasks,
  public.maintenance_plans
to authenticated;

grant delete on table
  public.assets,
  public.inventory_items,
  public.maintenance_tasks,
  public.maintenance_plans
to authenticated;

grant insert, update, delete on table public.checklist_templates to authenticated;
grant insert on table
  public.checklist_template_versions,
  public.checklist_results,
  public.maintenance_logs,
  public.inventory_movements
to authenticated;

grant insert, delete on table public.asset_images to authenticated;
grant insert, update on table public.organization_settings to authenticated;

comment on table public.assets is 'Business asset register. Tenant-scoped; source UUIDs are preserved on import.';
comment on table public.inventory_items is 'Inventory master and current balance. Code uniqueness is intentionally deferred.';
comment on table public.maintenance_logs is 'Append-only maintenance and repair history, separate from Checklist results.';
comment on table public.checklist_templates is 'One current Checklist template per asset; edits are represented by new version rows.';
comment on table public.checklist_template_versions is 'Immutable Checklist template versions; items are stored as JSONB snapshots.';
comment on table public.checklist_results is 'Immutable Checklist execution history; items are stored as JSONB snapshots.';
comment on table public.inventory_movements is 'Append-only stock movement history. Balance updates require a future atomic RPC.';
comment on table public.asset_images is 'Metadata for objects stored separately in a private Supabase Storage bucket.';

commit;
