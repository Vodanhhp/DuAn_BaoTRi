import type {
  Asset,
  ChecklistResult,
  ChecklistTemplate,
  ChecklistTemplateVersion,
  InventoryItem,
  Log,
  MaintenancePlan,
  Movement,
  SyncItem,
  Task
} from '../db'

export const DRAFT_ID_PREFIX = 'draft:'

export type IdentityStatus = 'legacy' | 'draft' | 'ready' | 'synced' | 'conflict'

export function createDraftId(randomUuid: () => string = () => crypto.randomUUID()): string {
  const value = randomUuid()
  if (!isUuid(value)) throw new Error('Bộ sinh ID tạm phải trả về UUID hợp lệ.')
  return DRAFT_ID_PREFIX + value
}

export function isDraftId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(DRAFT_ID_PREFIX)
}

export function isUuid(id: string | null | undefined): boolean {
  return typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
}

function assertRekeyIds(draftId: string, officialId: string) {
  if (!isDraftId(draftId)) throw new Error('ID nguồn không thuộc namespace draft:.')
  if (!isUuid(officialId)) throw new Error('ID đích phải là UUID chính thức hợp lệ.')
  if (draftId === officialId) throw new Error('ID nguồn và ID đích không được trùng nhau.')
}

function rekeyQueueItem(
  items: SyncItem[],
  tableName: 'assets' | 'inventory',
  draftId: string,
  officialId: string,
  mutationId: string,
  deviceId: string,
  queuedAt: string
): { oldId?: string; value: SyncItem } {
  const draftQueue = items.filter(item => item.tableName === tableName && item.recordId === draftId)
  const officialQueue = items.some(item => item.tableName === tableName && item.recordId === officialId)
  if (draftQueue.length > 1) throw new Error('Hàng đợi có nhiều mutation cho cùng bản nháp; cần xử lý thủ công.')
  if (officialQueue) throw new Error('ID chính thức đã có mutation trong hàng đợi; từ chối rekey để tránh ghi đè.')
  const previous = draftQueue[0]
  if (previous?.status === 'processing') throw new Error('Không thể rekey khi mutation của bản nháp đang được xử lý.')
  return {
    oldId: previous?.id,
    value: {
      id: `${tableName}:${officialId}`,
      tableName,
      recordId: officialId,
      operation: 'upsert',
      queuedAt: previous?.queuedAt ?? queuedAt,
      status: 'pending',
      attempts: 0,
      deviceId: previous?.deviceId ?? deviceId,
      mutationId,
      lastError: undefined,
      lastAttemptAt: undefined
    }
  }
}

export type AssetRekeyInput = {
  asset: Asset
  tasks: Task[]
  maintenancePlans: MaintenancePlan[]
  logs: Log[]
  checklistTemplates: ChecklistTemplate[]
  checklistVersions: ChecklistTemplateVersion[]
  checklistResults: ChecklistResult[]
  movements: Movement[]
  syncQueue: SyncItem[]
}

export type AssetRekeyPlan = {
  asset: Asset
  tasks: Task[]
  maintenancePlans: MaintenancePlan[]
  logs: Log[]
  checklistTemplates: ChecklistTemplate[]
  checklistVersions: ChecklistTemplateVersion[]
  checklistResults: ChecklistResult[]
  movements: Movement[]
  queueItem: { oldId?: string; value: SyncItem }
}

export function buildAssetRekeyPlan(
  input: AssetRekeyInput,
  draftId: string,
  officialId: string,
  options: { mutationId: string; deviceId: string; queuedAt: string }
): AssetRekeyPlan {
  assertRekeyIds(draftId, officialId)
  if (input.asset.id !== draftId) throw new Error('Không tìm thấy Asset có ID bản nháp cần chuyển.')
  const queueItem = rekeyQueueItem(input.syncQueue, 'assets', draftId, officialId, options.mutationId, options.deviceId, options.queuedAt)
  return {
    asset: { ...input.asset, id: officialId, identityStatus: 'ready' },
    tasks: input.tasks.map(item => item.assetId === draftId ? { ...item, assetId: officialId } : item),
    maintenancePlans: input.maintenancePlans.map(item => item.assetId === draftId ? { ...item, assetId: officialId } : item),
    logs: input.logs.map(item => item.assetId === draftId ? { ...item, assetId: officialId } : item),
    checklistTemplates: input.checklistTemplates.map(item => item.assetId === draftId ? { ...item, assetId: officialId } : item),
    checklistVersions: input.checklistVersions.map(item => item.assetId === draftId ? { ...item, assetId: officialId } : item),
    checklistResults: input.checklistResults.map(item => item.assetId === draftId ? { ...item, assetId: officialId } : item),
    movements: input.movements.map(item => item.linkedAssetId === draftId ? { ...item, linkedAssetId: officialId } : item),
    queueItem
  }
}

export type InventoryRekeyInput = {
  item: InventoryItem
  movements: Movement[]
  syncQueue: SyncItem[]
}

export type InventoryRekeyPlan = {
  item: InventoryItem
  movements: Movement[]
  queueItem: { oldId?: string; value: SyncItem }
}

export function buildInventoryRekeyPlan(
  input: InventoryRekeyInput,
  draftId: string,
  officialId: string,
  options: { mutationId: string; deviceId: string; queuedAt: string }
): InventoryRekeyPlan {
  assertRekeyIds(draftId, officialId)
  if (input.item.id !== draftId) throw new Error('Không tìm thấy InventoryItem có ID bản nháp cần chuyển.')
  const queueItem = rekeyQueueItem(input.syncQueue, 'inventory', draftId, officialId, options.mutationId, options.deviceId, options.queuedAt)
  return {
    item: { ...input.item, id: officialId, identityStatus: 'ready' },
    movements: input.movements.map(item => item.itemId === draftId ? { ...item, itemId: officialId } : item),
    queueItem
  }
}
