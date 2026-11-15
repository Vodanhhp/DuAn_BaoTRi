import Dexie, { type Table } from 'dexie'

export type AssetStatus = 'Đang hoạt động' | 'Đang sửa chữa' | 'Ngừng sử dụng' | 'Thanh lý'
export type TaskStatus = 'Chờ thực hiện' | 'Đang thực hiện' | 'Hoàn thành' | 'Quá hạn'

export interface Asset {
  id: string; code: string; name: string; category: string; brand: string; model: string
  serial: string; location: string; commissionedAt: string; power: string; cycle: string
  status: AssetStatus; notes: string; images: string[]; archivedAt?: string; createdAt: string; updatedAt: string
}
export interface InventoryItem {
  id: string; code: string; name: string; group: string; unit: string
  quantity: number; minQuantity: number; location: string; supplier: string; unitPrice: number
  updatedAt: string
}
export interface Task {
  id: string; assetId: string; title: string; dueDate: string; frequency: string
  status: TaskStatus; checklist: string; readings: string; notes: string
  completedAt?: string; createdAt: string; updatedAt: string
}
export interface Log {
  id: string; assetId: string; taskId?: string; date: string; kind: string
  description: string; parts: string; readings: string; performedBy: string
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
  }
}
export const db = new MaintenanceDB()
export const uid = () => crypto.randomUUID()
export const now = () => new Date().toISOString()
export async function queueChange(tableName: string, recordId: string, operation = 'upsert') {
  await db.syncQueue.put({ id: uid(), tableName, recordId, operation, queuedAt: now() })
}
