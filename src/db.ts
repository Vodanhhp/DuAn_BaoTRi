import Dexie, { type Table } from 'dexie'

export type AssetStatus = 'Đang hoạt động' | 'Đang sửa chữa' | 'Ngừng sử dụng' | 'Thanh lý'
export type TaskStatus = 'Chờ thực hiện' | 'Đang thực hiện' | 'Hoàn thành' | 'Quá hạn'
export type MaintenancePlanPeriod = 'Tuần' | 'Tháng' | 'Quý' | 'Năm'
export type MaintenancePlanExecution = 'Nội bộ' | 'Thuê ngoài'

export type ChecklistAnswerType = 'pass-fail-na' | 'yes-no' | 'text' | 'number'

export interface ChecklistTemplateItem {
  id: string
  label: string
  description?: string
  answerType: ChecklistAnswerType
  required: boolean
  order: number
}

export interface ChecklistTemplate {
  id: string
  assetId: string
  title: string
  description: string
  currentVersion: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface ChecklistTemplateVersion {
  id: string
  templateId: string
  assetId: string
  version: number
  title: string
  description: string
  items: ChecklistTemplateItem[]
  createdAt: string
}

export interface ChecklistResultItem {
  templateItemId: string
  label: string
  description?: string
  answerType: ChecklistAnswerType
  required?: boolean
  answer: string
  note: string
  order: number
}

export interface ChecklistResult {
  id: string
  assetId: string
  templateId: string
  templateVersionId: string
  templateVersion: number
  templateTitle: string
  performedAt: string
  performedBy: string
  result: 'Đạt' | 'Không đạt' | 'Chưa hoàn thành'
  scheduledFor?: string
  isMakeup?: boolean
  notes: string
  items: ChecklistResultItem[]
  createdAt: string
}

export interface Asset {
  id: string; code: string; name: string; category: string; brand: string; model: string
  serial: string; location: string; commissionedAt: string; power: string; cycle: string; cycleStartedAt?: string
  transferredFromOtherFacility?: boolean
  status: AssetStatus; notes: string; images: string[]; archivedAt?: string; createdAt: string; updatedAt: string
}
export interface InventoryItem {
  id: string; code: string; name: string; group: string; unit: string
  partNumber?: string; size?: string
  quantity: number; minQuantity: number; location: string; supplier: string; unitPrice: number
  updatedAt: string
}
export interface Task {
  id: string; assetId: string; title: string; dueDate: string; frequency: string
  status: TaskStatus; checklist: string; readings: string; notes: string
  completedAt?: string; createdAt: string; updatedAt: string
}
export interface MaintenancePlan {
  id: string; assetId: string; title: string; period: MaintenancePlanPeriod
  startDate: string; endDate: string; execution: MaintenancePlanExecution
  contractor: string; notes: string; createdAt: string; updatedAt: string
}
export interface LogEditHistory {
  id: string
  editedAt: string
  editedBy: string
  action: string
  previousResult: 'Đạt' | 'Không đạt' | ''
  previousCompletedAt?: string
  previousPerformedBy: string
}
export interface Log {
  id: string; assetId: string; taskId?: string; checklistResultId?: string; date: string; dueDate?: string; kind: string
  description: string; parts: string; readings: string; requestedBy?: string; result?: 'Đạt' | 'Không đạt' | ''; completedAt?: string; performedBy: string
  editHistory?: LogEditHistory[]
}
export interface Movement {
  id: string; itemId: string; date: string; type: 'Nhập' | 'Xuất' | 'Điều chỉnh'
  quantity: number; reason: string; linkedAssetId?: string
}
export interface SyncItem {
  id: string; tableName: string; recordId: string; operation: string; queuedAt: string
}

class MaintenanceDB extends Dexie {
  assets!: Table<Asset, string>
  inventory!: Table<InventoryItem, string>
  tasks!: Table<Task, string>
  logs!: Table<Log, string>
  movements!: Table<Movement, string>
  syncQueue!: Table<SyncItem, string>
  checklistTemplates!: Table<ChecklistTemplate, string>
  checklistVersions!: Table<ChecklistTemplateVersion, string>
  checklistResults!: Table<ChecklistResult, string>
  maintenancePlans!: Table<MaintenancePlan, string>

  constructor() {
    super('baotri-local-v1')
    this.version(1).stores({
      assets: 'id, code, name, category, status, updatedAt',
      inventory: 'id, code, name, group, quantity, updatedAt',
      tasks: 'id, assetId, dueDate, status, updatedAt',
      logs: 'id, assetId, taskId, date, kind',
      movements: 'id, itemId, date, type',
      syncQueue: 'id, tableName, recordId, queuedAt'
    })
    this.version(2).stores({
      assets: 'id, code, name, category, status, archivedAt, updatedAt',
      inventory: 'id, code, name, group, quantity, updatedAt',
      tasks: 'id, assetId, dueDate, status, updatedAt',
      logs: 'id, assetId, taskId, date, kind',
      movements: 'id, itemId, date, type',
      syncQueue: 'id, tableName, recordId, queuedAt'
    })
    // v3: Checklist có biểu mẫu riêng theo từng thiết bị; phiên bản và phiếu kết quả độc lập.
    // Không sửa/xóa dữ liệu Task.checklist cũ trong quá trình nâng cấp.
    this.version(3).stores({
      assets: 'id, code, name, category, status, archivedAt, updatedAt',
      inventory: 'id, code, name, group, quantity, updatedAt',
      tasks: 'id, assetId, dueDate, status, updatedAt',
      logs: 'id, assetId, taskId, date, kind',
      movements: 'id, itemId, date, type',
      syncQueue: 'id, tableName, recordId, queuedAt',
      checklistTemplates: 'id, assetId, active, updatedAt',
      checklistVersions: 'id, templateId, assetId, version, createdAt',
      checklistResults: 'id, assetId, templateId, templateVersionId, performedAt, result'
    })
    // v4: bổ sung liên kết tùy chọn từ phiếu Bảo dưỡng – Sửa chữa về phiếu Checklist nguồn.
    // Giữ nguyên toàn bộ nhật ký và các bảng Checklist hiện có.
    this.version(4).stores({
      assets: 'id, code, name, category, status, archivedAt, updatedAt',
      inventory: 'id, code, name, group, quantity, updatedAt',
      tasks: 'id, assetId, dueDate, status, updatedAt',
      logs: 'id, assetId, taskId, checklistResultId, date, kind',
      movements: 'id, itemId, date, type',
      syncQueue: 'id, tableName, recordId, queuedAt',
      checklistTemplates: 'id, assetId, active, updatedAt',
      checklistVersions: 'id, templateId, assetId, version, createdAt',
      checklistResults: 'id, assetId, templateId, templateVersionId, performedAt, result'
    })
    this.version(5).stores({
      assets: 'id, code, name, category, status, archivedAt, updatedAt',
      inventory: 'id, code, name, group, quantity, updatedAt',
      tasks: 'id, assetId, dueDate, status, updatedAt',
      logs: 'id, assetId, taskId, checklistResultId, date, kind',
      movements: 'id, itemId, date, type',
      syncQueue: 'id, tableName, recordId, queuedAt',
      checklistTemplates: 'id, assetId, active, updatedAt',
      checklistVersions: 'id, templateId, assetId, version, createdAt',
      checklistResults: 'id, assetId, templateId, templateVersionId, performedAt, result',
      maintenancePlans: 'id, assetId, period, startDate, endDate, updatedAt'
    })
  }
}
export const db = new MaintenanceDB()
export const uid = () => crypto.randomUUID()
export const now = () => new Date().toISOString()
export async function queueChange(tableName: string, recordId: string, operation = 'upsert') {
  await db.syncQueue.put({ id: uid(), tableName, recordId, operation, queuedAt: now() })
}
