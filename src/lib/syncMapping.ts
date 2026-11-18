import type {
  Asset,
  ChecklistResult,
  ChecklistTemplate,
  ChecklistTemplateVersion,
  InventoryItem,
  Log,
  MaintenancePlan,
  Movement,
  Task
} from '../db'

/**
 * Pure local ↔ normalized Cloud row mapping.
 *
 * This module performs no network, Dexie, or Supabase operations. It is a
 * reviewed conversion layer only; a sync worker must not be enabled until
 * conflict/version and inventory-movement RPC contracts are implemented.
 */

export const LOCAL_TO_CLOUD_TABLE = {
  assets: 'assets',
  inventory: 'inventory_items',
  tasks: 'maintenance_tasks',
  maintenancePlans: 'maintenance_plans',
  checklistTemplates: 'checklist_templates',
  checklistVersions: 'checklist_template_versions',
  checklistResults: 'checklist_results',
  logs: 'maintenance_logs',
  movements: 'inventory_movements'
} as const

export const CLOUD_SYNC_ORDER = [
  'assets',
  'inventory_items',
  'maintenance_tasks',
  'maintenance_plans',
  'checklist_templates',
  'checklist_template_versions',
  'checklist_results',
  'maintenance_logs',
  'inventory_movements'
] as const

export type OrganizationScope = { organization_id: string }

export type CloudAssetRow = OrganizationScope & {
  id: string; code: string; name: string; category: string; brand: string; model: string
  serial: string; location: string; commissioned_at: string | null; power: string; cycle: string
  cycle_started_at: string | null; transferred_from_other_facility: boolean
  status: Asset['status']; notes: string; archived_at: string | null
  created_at: string; updated_at: string
}

export type CloudInventoryItemRow = OrganizationScope & {
  id: string; code: string; name: string; item_group: string; unit: string
  part_number: string | null; size: string | null; quantity: number; min_quantity: number
  location: string; supplier: string; unit_price: number; updated_at: string
}

export type CloudTaskRow = OrganizationScope & {
  id: string; asset_id: string; title: string; due_date: string | null; frequency: string
  status: Task['status']; checklist: string; readings: string; notes: string
  completed_at: string | null; created_at: string; updated_at: string
}

export type CloudMaintenancePlanRow = OrganizationScope & {
  id: string; asset_id: string; title: string; period: MaintenancePlan['period']
  start_date: string | null; end_date: string | null; execution: MaintenancePlan['execution']
  contractor: string; notes: string; created_at: string; updated_at: string
}

export type CloudChecklistTemplateRow = OrganizationScope & {
  id: string; asset_id: string; title: string; description: string
  current_version: number; active: boolean; created_at: string; updated_at: string
}

export type CloudChecklistVersionRow = OrganizationScope & {
  id: string; template_id: string; asset_id: string; version: number
  title: string; description: string; items: ChecklistTemplateVersion['items']; created_at: string
}

export type CloudChecklistResultRow = OrganizationScope & {
  id: string; asset_id: string; template_id: string; template_version_id: string
  template_version: number; template_title: string; performed_at: string; performed_by: string
  result: ChecklistResult['result']; scheduled_for: string | null; is_makeup: boolean
  notes: string; items: ChecklistResult['items']; created_at: string
}

export type CloudMaintenanceLogRow = OrganizationScope & {
  id: string; asset_id: string; task_id: string | null; checklist_result_id: string | null
  log_date: string | null; kind: string; description: string; parts: string; readings: string
  result: Log['result'] | null; completed_at: string | null; performed_by: string
}

/** The current SQL schema cannot yet preserve all local Log fields. */
export class UnsupportedCloudFieldError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsupportedCloudFieldError'
  }
}

function requireOrganizationId(organizationId: string): string {
  const value = organizationId?.trim()
  if (!value) throw new Error('Thiếu organization_id; từ chối tạo dữ liệu Cloud không có phạm vi tổ chức.')
  return value
}

function nullable(value?: string | null): string | null {
  return value?.trim() ? value : null
}

export function toCloudAssetRow(value: Asset, organizationId: string): CloudAssetRow {
  return {
    organization_id: requireOrganizationId(organizationId),
    id: value.id, code: value.code, name: value.name, category: value.category,
    brand: value.brand ?? '', model: value.model ?? '', serial: value.serial ?? '',
    location: value.location ?? '', commissioned_at: nullable(value.commissionedAt),
    power: value.power ?? '', cycle: value.cycle ?? '',
    cycle_started_at: nullable(value.cycleStartedAt),
    transferred_from_other_facility: Boolean(value.transferredFromOtherFacility),
    status: value.status, notes: value.notes ?? '', archived_at: nullable(value.archivedAt),
    created_at: value.createdAt, updated_at: value.updatedAt
  }
}

export function fromCloudAssetRow(row: CloudAssetRow): Asset {
  return {
    id: row.id, code: row.code, name: row.name, category: row.category,
    brand: row.brand ?? '', model: row.model ?? '', serial: row.serial ?? '',
    location: row.location ?? '', commissionedAt: row.commissioned_at ?? '',
    power: row.power ?? '', cycle: row.cycle ?? '',
    cycleStartedAt: row.cycle_started_at ?? undefined,
    transferredFromOtherFacility: row.transferred_from_other_facility,
    status: row.status, notes: row.notes ?? '', images: [],
    archivedAt: row.archived_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at
  }
}

/** Full quantity is only valid for a deliberate baseline/initial import. */
export function toCloudInventoryBaselineRow(value: InventoryItem, organizationId: string): CloudInventoryItemRow {
  return {
    organization_id: requireOrganizationId(organizationId),
    id: value.id, code: value.code, name: value.name, item_group: value.group ?? '',
    unit: value.unit ?? '', part_number: nullable(value.partNumber), size: nullable(value.size),
    quantity: value.quantity, min_quantity: value.minQuantity, location: value.location ?? '',
    supplier: value.supplier ?? '', unit_price: value.unitPrice, updated_at: value.updatedAt
  }
}

/** Normal queue upserts must not overwrite the Cloud balance after movement RPCs. */
export function toCloudInventoryMetadataRow(value: InventoryItem, organizationId: string) {
  const row = toCloudInventoryBaselineRow(value, organizationId)
  const { quantity: _localBalance, ...metadata } = row
  return metadata
}

export function fromCloudInventoryItemRow(row: CloudInventoryItemRow): InventoryItem {
  return {
    id: row.id, code: row.code, name: row.name, group: row.item_group ?? '',
    unit: row.unit ?? '', partNumber: row.part_number ?? undefined, size: row.size ?? undefined,
    quantity: Number(row.quantity), minQuantity: Number(row.min_quantity),
    location: row.location ?? '', supplier: row.supplier ?? '',
    unitPrice: Number(row.unit_price), updatedAt: row.updated_at
  }
}

export function toCloudTaskRow(value: Task, organizationId: string): CloudTaskRow {
  return {
    organization_id: requireOrganizationId(organizationId),
    id: value.id, asset_id: value.assetId, title: value.title,
    due_date: nullable(value.dueDate), frequency: value.frequency ?? '', status: value.status,
    checklist: value.checklist ?? '', readings: value.readings ?? '', notes: value.notes ?? '',
    completed_at: nullable(value.completedAt), created_at: value.createdAt, updated_at: value.updatedAt
  }
}

export function fromCloudTaskRow(row: CloudTaskRow): Task {
  return {
    id: row.id, assetId: row.asset_id, title: row.title, dueDate: row.due_date ?? '',
    frequency: row.frequency ?? '', status: row.status, checklist: row.checklist ?? '',
    readings: row.readings ?? '', notes: row.notes ?? '', completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at
  }
}

export function toCloudMaintenancePlanRow(value: MaintenancePlan, organizationId: string): CloudMaintenancePlanRow {
  return {
    organization_id: requireOrganizationId(organizationId),
    id: value.id, asset_id: value.assetId, title: value.title, period: value.period,
    start_date: nullable(value.startDate), end_date: nullable(value.endDate),
    execution: value.execution, contractor: value.contractor ?? '', notes: value.notes ?? '',
    created_at: value.createdAt, updated_at: value.updatedAt
  }
}

export function fromCloudMaintenancePlanRow(row: CloudMaintenancePlanRow): MaintenancePlan {
  return {
    id: row.id, assetId: row.asset_id, title: row.title, period: row.period,
    startDate: row.start_date ?? '', endDate: row.end_date ?? '', execution: row.execution,
    contractor: row.contractor ?? '', notes: row.notes ?? '',
    createdAt: row.created_at, updatedAt: row.updated_at
  }
}

export function toCloudChecklistTemplateRow(value: ChecklistTemplate, organizationId: string): CloudChecklistTemplateRow {
  return {
    organization_id: requireOrganizationId(organizationId),
    id: value.id, asset_id: value.assetId, title: value.title, description: value.description ?? '',
    current_version: value.currentVersion, active: value.active,
    created_at: value.createdAt, updated_at: value.updatedAt
  }
}

export function fromCloudChecklistTemplateRow(row: CloudChecklistTemplateRow): ChecklistTemplate {
  return {
    id: row.id, assetId: row.asset_id, title: row.title, description: row.description ?? '',
    currentVersion: row.current_version, active: row.active,
    createdAt: row.created_at, updatedAt: row.updated_at
  }
}

export function toCloudChecklistVersionRow(value: ChecklistTemplateVersion, organizationId: string): CloudChecklistVersionRow {
  return {
    organization_id: requireOrganizationId(organizationId),
    id: value.id, template_id: value.templateId, asset_id: value.assetId, version: value.version,
    title: value.title, description: value.description ?? '', items: value.items, created_at: value.createdAt
  }
}

export function fromCloudChecklistVersionRow(row: CloudChecklistVersionRow): ChecklistTemplateVersion {
  return {
    id: row.id, templateId: row.template_id, assetId: row.asset_id, version: row.version,
    title: row.title, description: row.description ?? '', items: row.items, createdAt: row.created_at
  }
}

export function toCloudChecklistResultRow(value: ChecklistResult, organizationId: string): CloudChecklistResultRow {
  return {
    organization_id: requireOrganizationId(organizationId),
    id: value.id, asset_id: value.assetId, template_id: value.templateId,
    template_version_id: value.templateVersionId, template_version: value.templateVersion,
    template_title: value.templateTitle, performed_at: value.performedAt,
    performed_by: value.performedBy ?? '', result: value.result,
    scheduled_for: nullable(value.scheduledFor), is_makeup: Boolean(value.isMakeup),
    notes: value.notes ?? '', items: value.items, created_at: value.createdAt
  }
}

export function fromCloudChecklistResultRow(row: CloudChecklistResultRow): ChecklistResult {
  return {
    id: row.id, assetId: row.asset_id, templateId: row.template_id,
    templateVersionId: row.template_version_id, templateVersion: row.template_version,
    templateTitle: row.template_title, performedAt: row.performed_at,
    performedBy: row.performed_by ?? '', result: row.result,
    scheduledFor: row.scheduled_for ?? undefined, isMakeup: row.is_makeup,
    notes: row.notes ?? '', items: row.items, createdAt: row.created_at
  }
}

/**
 * Current maintenance_logs SQL omits due_date, requested_by and edit_history.
 * Refuse to sync a local row containing those fields rather than silently
 * discard information. A later reviewed SQL migration must add them first.
 */
export function toCloudMaintenanceLogRow(value: Log, organizationId: string): CloudMaintenanceLogRow {
  if (value.dueDate) throw new UnsupportedCloudFieldError('maintenance_logs chưa có cột due_date; giữ phiếu local.')
  if (value.requestedBy) throw new UnsupportedCloudFieldError('maintenance_logs chưa có cột requested_by; giữ phiếu local.')
  if (value.editHistory?.length) throw new UnsupportedCloudFieldError('maintenance_logs chưa có cột edit_history; giữ lịch sử chỉnh sửa local.')
  return {
    organization_id: requireOrganizationId(organizationId),
    id: value.id, asset_id: value.assetId, task_id: value.taskId ?? null,
    checklist_result_id: value.checklistResultId ?? null, log_date: nullable(value.date),
    kind: value.kind ?? '', description: value.description ?? '', parts: value.parts ?? '',
    readings: value.readings ?? '', result: value.result ?? null,
    completed_at: value.completedAt ?? null, performed_by: value.performedBy ?? ''
  }
}

export function fromCloudMaintenanceLogRow(row: CloudMaintenanceLogRow): Log {
  return {
    id: row.id, assetId: row.asset_id, taskId: row.task_id ?? undefined,
    checklistResultId: row.checklist_result_id ?? undefined, date: row.log_date ?? '',
    kind: row.kind ?? '', description: row.description ?? '', parts: row.parts ?? '',
    readings: row.readings ?? '', result: row.result ?? '',
    completedAt: row.completed_at ?? undefined, performedBy: row.performed_by ?? ''
  }
}

/** Inventory movements are deliberately excluded from direct table upserts. */
export function assertMovementRequiresRpc(_value: Movement): never {
  throw new UnsupportedCloudFieldError(
    'inventory_movements chỉ được ghi qua RPC giao dịch có idempotency; chưa triển khai RPC nên giữ thay đổi local.'
  )
}

export type LocalSyncRecord =
  | { tableName: 'assets'; value: Asset }
  | { tableName: 'inventory'; value: InventoryItem }
  | { tableName: 'tasks'; value: Task }
  | { tableName: 'maintenancePlans'; value: MaintenancePlan }
  | { tableName: 'checklistTemplates'; value: ChecklistTemplate }
  | { tableName: 'checklistVersions'; value: ChecklistTemplateVersion }
  | { tableName: 'checklistResults'; value: ChecklistResult }
  | { tableName: 'logs'; value: Log }
  | { tableName: 'movements'; value: Movement }
