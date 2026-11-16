import type { SupabaseClient } from '@supabase/supabase-js'
import { db, type SyncItem } from '../db'

export const DATA_COLLECTIONS = [
  'assets',
  'inventory',
  'tasks',
  'logs',
  'movements',
  'maintenancePlans',
  'checklistTemplates',
  'checklistVersions',
  'checklistResults'
] as const

export type DataCollection = typeof DATA_COLLECTIONS[number]

type CloudRecord = {
  owner_id: string
  collection: DataCollection
  record_id: string
  payload: unknown
  updated_at: string
  deleted_at: string | null
}

type LocalRecord = {
  collection: DataCollection
  recordId: string
  payload: Record<string, unknown>
}

export type CloudSyncResult = {
  uploaded: number
  downloaded: number
  pending: number
  localRecords: number
  cloudRecords: number
  needsSeed: boolean
}

const isDataCollection = (value: string): value is DataCollection =>
  (DATA_COLLECTIONS as readonly string[]).includes(value)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function assertCloudRecord(value: unknown): CloudRecord {
  if (!isRecord(value) ||
      typeof value.owner_id !== 'string' ||
      typeof value.collection !== 'string' ||
      !isDataCollection(value.collection) ||
      typeof value.record_id !== 'string' ||
      !isRecord(value.payload) ||
      value.payload.id !== value.record_id ||
      typeof value.updated_at !== 'string' ||
      !(value.deleted_at === null || typeof value.deleted_at === 'string')) {
    throw new Error('Dữ liệu Supabase không đúng định dạng đồng bộ BAOTRI.')
  }
  return value as unknown as CloudRecord
}

async function readLocalRecords(): Promise<LocalRecord[]> {
  const groups: Array<[DataCollection, Array<{ id: string }>] > = [
    ['assets', await db.assets.toArray()],
    ['inventory', await db.inventory.toArray()],
    ['tasks', await db.tasks.toArray()],
    ['logs', await db.logs.toArray()],
    ['movements', await db.movements.toArray()],
    ['maintenancePlans', await db.maintenancePlans.toArray()],
    ['checklistTemplates', await db.checklistTemplates.toArray()],
    ['checklistVersions', await db.checklistVersions.toArray()],
    ['checklistResults', await db.checklistResults.toArray()]
  ]

  return groups.flatMap(([collection, records]) => records.map(record => ({
    collection,
    recordId: record.id,
    payload: record as unknown as Record<string, unknown>
  })))
}

function keyFor(collection: string, recordId: string) {
  return `${collection}\u0000${recordId}`
}

function recordTimestamp(payload: Record<string, unknown>) {
  for (const key of ['updatedAt', 'createdAt', 'performedAt', 'completedAt', 'date']) {
    const value = payload[key]
    if (typeof value !== 'string') continue
    const time = Date.parse(value)
    if (Number.isFinite(time)) return new Date(time).toISOString()
  }
  return new Date().toISOString()
}

async function fetchCloudRecords(client: SupabaseClient, ownerId: string): Promise<CloudRecord[]> {
  const records: CloudRecord[] = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from('maintenance_records')
      .select('owner_id, collection, record_id, payload, updated_at, deleted_at')
      .eq('owner_id', ownerId)
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error(`Không thể đọc dữ liệu Supabase: ${error.message}`)
    const page = (data ?? []).map(assertCloudRecord)
    records.push(...page)
    if (page.length < pageSize) break
  }
  return records
}

async function upsertCloudRecords(client: SupabaseClient, records: CloudRecord[]) {
  const batchSize = 100
  for (let offset = 0; offset < records.length; offset += batchSize) {
    const { error } = await client
      .from('maintenance_records')
      .upsert(records.slice(offset, offset + batchSize), {
        onConflict: 'owner_id,collection,record_id'
      })
    if (error) throw new Error(`Không thể ghi dữ liệu lên Supabase: ${error.message}`)
  }
}

function cloudRecord(
  ownerId: string,
  collection: DataCollection,
  recordId: string,
  payload: Record<string, unknown>,
  updatedAt: string,
  deletedAt: string | null = null
): CloudRecord {
  return {
    owner_id: ownerId,
    collection,
    record_id: recordId,
    payload,
    updated_at: updatedAt,
    deleted_at: deletedAt
  }
}

async function pushPendingChanges(client: SupabaseClient, ownerId: string) {
  const queue = await db.syncQueue.orderBy('queuedAt').toArray()
  if (!queue.length) return 0

  const latestByKey = new Map<string, SyncItem>()
  for (const item of queue) {
    if (isDataCollection(item.tableName)) latestByKey.set(keyFor(item.tableName, item.recordId), item)
  }

  const changes: CloudRecord[] = []
  for (const item of latestByKey.values()) {
    if (!isDataCollection(item.tableName)) continue
    const record = await db.table(item.tableName).get(item.recordId)
    const payload = isRecord(record) && record.id === item.recordId ? record : { id: item.recordId }
    const deletedAt = item.operation === 'delete' || payload === undefined ? item.queuedAt : null
    changes.push(cloudRecord(
      ownerId,
      item.tableName,
      item.recordId,
      payload,
      item.queuedAt,
      deletedAt
    ))
  }

  await upsertCloudRecords(client, changes)
  const processedKeys = new Set(latestByKey.keys())
  const processedQueueIds = queue
    .filter(item => isDataCollection(item.tableName) && processedKeys.has(keyFor(item.tableName, item.recordId)))
    .map(item => item.id)
  if (processedQueueIds.length) await db.syncQueue.bulkDelete(processedQueueIds)
  return changes.length
}

async function applyCloudRecords(records: CloudRecord[], pending: SyncItem[]) {
  const pendingKeys = new Set(
    pending.filter(item => isDataCollection(item.tableName))
      .map(item => keyFor(item.tableName, item.recordId))
  )
  let downloaded = 0

  for (const record of records) {
    if (pendingKeys.has(keyFor(record.collection, record.record_id))) continue
    if (record.deleted_at) {
      await db.table(record.collection).delete(record.record_id)
    } else {
      await db.table(record.collection).put(record.payload)
    }
    downloaded++
  }
  return downloaded
}

export async function syncLocalDatabase(
  client: SupabaseClient,
  ownerId: string
): Promise<CloudSyncResult> {
  if (!ownerId) throw new Error('Thiếu tài khoản Supabase để đồng bộ dữ liệu.')

  const localRecords = await readLocalRecords()
  const cloudBeforeSync = await fetchCloudRecords(client, ownerId)
  let uploaded = 0
  let downloaded = 0

  if (cloudBeforeSync.length === 0 && localRecords.length) {
    const initialData = localRecords.map(record => cloudRecord(
      ownerId,
      record.collection,
      record.recordId,
      record.payload,
      recordTimestamp(record.payload)
    ))
    await upsertCloudRecords(client, initialData)
    uploaded += initialData.length
  }

  uploaded += await pushPendingChanges(client, ownerId)
  const cloudRecords = await fetchCloudRecords(client, ownerId)
  const pending = await db.syncQueue.toArray()
  downloaded += await applyCloudRecords(cloudRecords, pending)

  return {
    uploaded,
    downloaded,
    pending: await db.syncQueue.count(),
    localRecords: localRecords.length,
    cloudRecords: cloudRecords.filter(record => !record.deleted_at).length,
    needsSeed: cloudBeforeSync.length === 0 && localRecords.length === 0 && pending.length === 0
  }
}
