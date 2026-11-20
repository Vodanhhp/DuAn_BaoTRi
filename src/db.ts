import Dexie, { type Table } from 'dexie'
import { buildAssetRekeyPlan, buildInventoryRekeyPlan } from './lib/localIdentity'

export type AssetStatus = 'Đang hoạt động' | 'Đang sửa chữa' | 'Ngừng sử dụng' | 'Thanh lý'
export type TaskStatus = 'Chờ thực hiện' | 'Đang thực hiện' | 'Hoàn thành' | 'Quá hạn'
export type MaintenancePlanPeriod = 'Tuần' | 'Tháng' | 'Quý' | 'Năm'
export type MaintenancePlanExecution = 'Nội bộ' | 'Thuê ngoài'

export type ChecklistAnswerType = 'pass-fail-na' | 'yes-no' | 'text' | 'number'
export type IdentityStatus = 'legacy' | 'draft' | 'ready' | 'synced' | 'conflict'

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
  identityStatus?: IdentityStatus; createdByLabel?: string; createdByUserId?: string
  serial: string; location: string; commissionedAt: string; power: string; cycle: string; cycleStartedAt?: string
  transferredFromOtherFacility?: boolean
  status: AssetStatus; notes: string; images: string[]; archivedAt?: string; createdAt: string; updatedAt: string
}
export type AssetCloudLinkStatus = 'linked' | 'conflict'
export type AssetMutationStatus = 'pending' | 'processing' | 'applied' | 'conflict'

export type AssetMutationPayload = Pick<Asset,
  'name' | 'brand' | 'model' | 'serial' | 'location' | 'commissionedAt' |
  'power' | 'cycle' | 'cycleStartedAt' | 'transferredFromOtherFacility' |
  'status' | 'notes' | 'archivedAt'
>

export interface AssetCloudLink {
  id: string
  organizationId: string
  assetId: string
  cloudCode: string
  cloudUpdatedAt: string
  lastSyncedLocalUpdatedAt: string
  status: AssetCloudLinkStatus
  linkedAt: string
  lastVerifiedAt: string
}

export interface AssetMutation {
  mutationId: string
  organizationId: string
  assetId: string
  payload: AssetMutationPayload
  expectedCloudUpdatedAt: string
  localUpdatedAt: string
  status: AssetMutationStatus
  attempts: number
  lastError?: string
  createdAt: string
  updatedAt: string
  appliedAt?: string
  cloudUpdatedAt?: string
}

export interface InventoryItem {
  id: string; code: string; name: string; group: string; unit: string
  identityStatus?: IdentityStatus; createdByLabel?: string; createdByUserId?: string
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
  updatedAt?: string
}
export interface Movement {
  id: string; itemId: string; date: string; type: 'Nhập' | 'Xuất' | 'Điều chỉnh'
  quantity: number; reason: string; note?: string; performedBy?: string; linkedAssetId?: string
}
export type SyncStatus = 'pending' | 'processing' | 'failed'

export interface SyncItem {
  id: string
  tableName: string
  recordId: string
  operation: 'upsert' | 'delete'
  queuedAt: string
  status: SyncStatus
  attempts: number
  lastError?: string
  lastAttemptAt?: string
  deviceId: string
  mutationId: string
}

class MaintenanceDB extends Dexie {
  assets!: Table<Asset, string>
  inventory!: Table<InventoryItem, string>
  tasks!: Table<Task, string>
  logs!: Table<Log, string>
  movements!: Table<Movement, string>
  syncQueue!: Table<SyncItem, string>
  assetCloudLinks!: Table<AssetCloudLink, string>
  assetMutations!: Table<AssetMutation, string>
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
    // v6: queue bền vững, coalesce theo bảng + record và hỗ trợ retry/idempotency.
    this.version(6).stores({
      assets: 'id, code, name, category, status, archivedAt, updatedAt',
      inventory: 'id, code, name, group, quantity, updatedAt',
      tasks: 'id, assetId, dueDate, status, updatedAt',
      logs: 'id, assetId, taskId, checklistResultId, date, kind',
      movements: 'id, itemId, date, type',
      syncQueue: 'id, &[tableName+recordId], tableName, recordId, operation, queuedAt, status, attempts, lastAttemptAt, deviceId, mutationId',
      checklistTemplates: 'id, assetId, active, updatedAt',
      checklistVersions: 'id, templateId, assetId, version, createdAt',
      checklistResults: 'id, assetId, templateId, templateVersionId, performedAt, result',
      maintenancePlans: 'id, assetId, period, startDate, endDate, updatedAt'
    }).upgrade(async tx => {
      const table = tx.table('syncQueue')
      const previous = await table.toArray() as Array<Partial<SyncItem> & { id: string; tableName: string; recordId: string; operation: string; queuedAt: string }>
      const latest = new Map<string, SyncItem>()
      for (const item of previous) {
        const id = queueId(item.tableName, item.recordId)
        const current = latest.get(id)
        if (!current || item.queuedAt > current.queuedAt) {
          latest.set(id, {
            id, tableName: item.tableName, recordId: item.recordId,
            operation: item.operation === 'delete' ? 'delete' : 'upsert',
            queuedAt: item.queuedAt || now(), status: 'pending',
            attempts: Number(item.attempts) || 0,
            lastError: item.lastError,
            lastAttemptAt: item.lastAttemptAt,
            deviceId: item.deviceId || getDeviceId(),
            mutationId: item.mutationId || uid()
          })
        }
      }
      await table.clear()
      if (latest.size) await table.bulkPut([...latest.values()])
    })
    // v7: metadata định danh để chuẩn bị cho draft Local. Dữ liệu hiện có
    // được đánh dấu legacy; không đổi ID, mã, foreign key hoặc timestamps.
    this.version(7).stores({
      assets: 'id, code, name, category, status, archivedAt, updatedAt, identityStatus',
      inventory: 'id, code, name, group, quantity, updatedAt, identityStatus',
      tasks: 'id, assetId, dueDate, status, updatedAt',
      logs: 'id, assetId, taskId, checklistResultId, date, kind',
      movements: 'id, itemId, date, type',
      syncQueue: 'id, &[tableName+recordId], tableName, recordId, operation, queuedAt, status, attempts, lastAttemptAt, deviceId, mutationId',
      checklistTemplates: 'id, assetId, active, updatedAt',
      checklistVersions: 'id, templateId, assetId, version, createdAt',
      checklistResults: 'id, assetId, templateId, templateVersionId, performedAt, result',
      maintenancePlans: 'id, assetId, period, startDate, endDate, updatedAt'
    }).upgrade(async tx => {
      const assets = await tx.table('assets').toArray()
      const inventory = await tx.table('inventory').toArray()
      await Promise.all([
        tx.table('assets').bulkPut(assets.map(asset => ({
          ...asset,
          identityStatus: asset.identityStatus ?? 'legacy'
        }))),
        tx.table('inventory').bulkPut(inventory.map(item => ({
          ...item,
          identityStatus: item.identityStatus ?? 'legacy'
        })))
      ])
    })
     // v8: Asset-only Cloud links and immutable mutation ledger.
    // Existing Local records are intentionally NOT auto-linked or queued.
    this.version(8).stores({
      assets: 'id, code, name, category, status, archivedAt, updatedAt, identityStatus',
      inventory: 'id, code, name, group, quantity, updatedAt, identityStatus',
      tasks: 'id, assetId, dueDate, status, updatedAt',
      logs: 'id, assetId, taskId, checklistResultId, date, kind',
      movements: 'id, itemId, date, type',
      syncQueue: 'id, &[tableName+recordId], tableName, recordId, operation, queuedAt, status, attempts, lastAttemptAt, deviceId, mutationId',
      checklistTemplates: 'id, assetId, active, updatedAt',
      checklistVersions: 'id, templateId, assetId, version, createdAt',
      checklistResults: 'id, assetId, templateId, templateVersionId, performedAt, result',
      maintenancePlans: 'id, assetId, period, startDate, endDate, updatedAt',
      assetCloudLinks: 'id, &[organizationId+assetId], organizationId, assetId, cloudCode, cloudUpdatedAt, status',
      assetMutations: 'mutationId, [organizationId+assetId], [organizationId+assetId+status], organizationId, assetId, status, createdAt'
    })
  }
}
export const db = new MaintenanceDB()
export const uid = () => crypto.randomUUID()
export const now = () => new Date().toISOString()

function queueId(tableName: string, recordId: string) {
  return `${tableName}:${recordId}`
}

let cachedDeviceId: string | undefined
export function getDeviceId() {
  if (cachedDeviceId) return cachedDeviceId
  const key = 'baotri-device-id'
  try {
    const existing = localStorage.getItem(key)
    if (existing) return cachedDeviceId = existing
    const created = uid()
    localStorage.setItem(key, created)
    return cachedDeviceId = created
  } catch {
    return cachedDeviceId = uid()
  }
}

export async function queueChange(tableName: string, recordId: string, operation: 'upsert' | 'delete' = 'upsert') {
  if (!tableName || !recordId) throw new Error('Thiếu tên bảng hoặc ID bản ghi khi tạo hàng đợi đồng bộ.')
  const id = queueId(tableName, recordId)
  await db.syncQueue.put({
    id, tableName, recordId, operation, queuedAt: now(),
    status: 'pending', attempts: 0, deviceId: getDeviceId(), mutationId: uid(),
    lastError: undefined, lastAttemptAt: undefined
  })
}

export async function putAndQueue<T extends { id: string }>(table: Table<T, string>, tableName: string, value: T) {
  await db.transaction('rw', table, db.syncQueue, async () => {
    await table.put(value)
    await queueChange(tableName, value.id)
  })
}

export async function addAndQueue<T extends { id: string }>(table: Table<T, string>, tableName: string, value: T) {
  await db.transaction('rw', table, db.syncQueue, async () => {
    await table.add(value)
    await queueChange(tableName, value.id)
  })
}

export async function deleteAndQueue<T>(table: Table<T, string>, tableName: string, recordId: string) {
  await db.transaction('rw', table, db.syncQueue, async () => {
    await table.delete(recordId)
    await queueChange(tableName, recordId, 'delete')
  })
}

export async function rekeyAssetDraftId(draftId: string, officialId: string) {
  return db.transaction('rw', [
    db.assets, db.tasks, db.maintenancePlans, db.logs,
    db.checklistTemplates, db.checklistVersions, db.checklistResults,
    db.movements, db.syncQueue
  ], async () => {
    const asset = await db.assets.get(draftId)
    if (!asset) throw new Error('Không tìm thấy thiết bị bản nháp.')
    if (await db.assets.get(officialId)) throw new Error('UUID thiết bị đích đã tồn tại.')
    const [tasks, maintenancePlans, logs, checklistTemplates, checklistVersions, checklistResults, movements, syncQueue] = await Promise.all([
      db.tasks.where('assetId').equals(draftId).toArray(),
      db.maintenancePlans.where('assetId').equals(draftId).toArray(),
      db.logs.where('assetId').equals(draftId).toArray(),
      db.checklistTemplates.where('assetId').equals(draftId).toArray(),
      db.checklistVersions.where('assetId').equals(draftId).toArray(),
      db.checklistResults.where('assetId').equals(draftId).toArray(),
      db.movements.toArray(),
      db.syncQueue.where('tableName').equals('assets').toArray()
    ])
    const plan = buildAssetRekeyPlan({
      asset, tasks, maintenancePlans, logs, checklistTemplates, checklistVersions,
      checklistResults, movements: movements.filter(item => item.linkedAssetId === draftId), syncQueue
    }, draftId, officialId, { mutationId: uid(), deviceId: getDeviceId(), queuedAt: now() })

    await db.assets.delete(draftId)
    await db.assets.add(plan.asset)
    await Promise.all([
      db.tasks.bulkPut(plan.tasks),
      db.maintenancePlans.bulkPut(plan.maintenancePlans),
      db.logs.bulkPut(plan.logs),
      db.checklistTemplates.bulkPut(plan.checklistTemplates),
      db.checklistVersions.bulkPut(plan.checklistVersions),
      db.checklistResults.bulkPut(plan.checklistResults),
      db.movements.bulkPut(plan.movements)
    ])
    if (plan.queueItem.oldId) await db.syncQueue.delete(plan.queueItem.oldId)
    await db.syncQueue.add(plan.queueItem.value)
    return plan.asset
  })
}

export async function rekeyInventoryDraftId(draftId: string, officialId: string) {
  return db.transaction('rw', [db.inventory, db.movements, db.syncQueue], async () => {
    const item = await db.inventory.get(draftId)
    if (!item) throw new Error('Không tìm thấy vật tư bản nháp.')
    if (await db.inventory.get(officialId)) throw new Error('UUID vật tư đích đã tồn tại.')
    const [movements, syncQueue] = await Promise.all([
      db.movements.where('itemId').equals(draftId).toArray(),
      db.syncQueue.where('tableName').equals('inventory').toArray()
    ])
    const plan = buildInventoryRekeyPlan({
      item, movements, syncQueue
    }, draftId, officialId, { mutationId: uid(), deviceId: getDeviceId(), queuedAt: now() })

    await db.inventory.delete(draftId)
    await db.inventory.add(plan.item)
    await db.movements.bulkPut(plan.movements)
    if (plan.queueItem.oldId) await db.syncQueue.delete(plan.queueItem.oldId)
    await db.syncQueue.add(plan.queueItem.value)
    return plan.item
  })
}
