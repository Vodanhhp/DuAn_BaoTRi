const tableKeys = [
  'assets',
  'inventory',
  'tasks',
  'logs',
  'movements',
  'maintenancePlans',
  'checklistTemplates',
  'checklistVersions',
  'checklistResults',
  'syncQueue'
] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasValidRows = (value: unknown): value is Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) return false
  const ids = new Set<string>()
  for (const row of value) {
    if (!isRecord(row) || typeof row.id !== 'string' || !row.id.trim() || ids.has(row.id)) return false
    ids.add(row.id)
  }
  return true
}

const syncCollections = new Set([
  'assets', 'inventory', 'tasks', 'logs', 'movements', 'maintenancePlans',
  'checklistTemplates', 'checklistVersions', 'checklistResults'
])

const hasValidSyncQueue = (value: unknown): value is Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) return false
  const keys = new Set<string>()
  for (const item of value) {
    if (!isRecord(item) || typeof item.tableName !== 'string' || !syncCollections.has(item.tableName) ||
        typeof item.recordId !== 'string' || !item.recordId.trim() ||
        item.id !== `${item.tableName}:${item.recordId}` || keys.has(`${item.tableName}:${item.recordId}`) ||
        !['upsert', 'delete'].includes(String(item.operation)) ||
        typeof item.queuedAt !== 'string' || !item.queuedAt.trim() ||
        !['pending', 'processing', 'failed'].includes(String(item.status)) ||
        !Number.isInteger(item.attempts) || (item.attempts as number) < 0 ||
        typeof item.deviceId !== 'string' || !item.deviceId.trim() ||
        typeof item.mutationId !== 'string' || !item.mutationId.trim()) return false
    keys.add(`${item.tableName}:${item.recordId}`)
  }
  return true
}

/**
 * Validate the complete current backup format before any destructive restore.
 * A valid empty database is allowed, but every table must be explicitly present.
 */
export function isValidBackupV3(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  if (value.backupVersion !== 3 || value.database !== 'baotri-local-v1') return false
  if (typeof value.exportedAt !== 'string' || !value.exportedAt.trim()) return false
  if (!tableKeys.every(key => hasValidRows(value[key]))) return false
  if (!hasValidSyncQueue(value.syncQueue)) return false
  if (!Array.isArray(value.customAssetCategories)) return false
  // Inventory locations were added after the original v3 format. Keep older
  // v3 backups valid, but validate the fields when they are present.
  if ('inventoryLocations' in value && (!Array.isArray(value.inventoryLocations) ||
      value.inventoryLocations.some(location => typeof location !== 'string' || !location.trim()))) return false
  if ('inventoryLocationEnabled' in value && typeof value.inventoryLocationEnabled !== 'boolean') return false

  // Preserve Checklist and maintenance-request relationships during restore.
  const assets = new Map((value.assets as Array<Record<string, unknown>>).map(row => [row.id as string, row]))
  const templates = new Map((value.checklistTemplates as Array<Record<string, unknown>>).map(row => [row.id as string, row]))
  const versions = new Map((value.checklistVersions as Array<Record<string, unknown>>).map(row => [row.id as string, row]))
  const results = new Map((value.checklistResults as Array<Record<string, unknown>>).map(row => [row.id as string, row]))

  for (const template of templates.values()) {
    const asset = assets.get(template.assetId as string)
    if (!asset) return false
  }
  for (const version of versions.values()) {
    const template = templates.get(version.templateId as string)
    if (!template || template.assetId !== version.assetId) return false
  }
  for (const result of results.values()) {
    const asset = assets.get(result.assetId as string)
    const template = templates.get(result.templateId as string)
    const version = versions.get(result.templateVersionId as string)
    if (!asset || !template || !version ||
        template.assetId !== result.assetId ||
        version.assetId !== result.assetId ||
        version.templateId !== result.templateId) return false
  }
  for (const log of value.logs as Array<Record<string, unknown>>) {
    if (log.checklistResultId === undefined || log.checklistResultId === null || log.checklistResultId === '') continue
    if (typeof log.checklistResultId !== 'string') return false
    const result = results.get(log.checklistResultId)
    if (!result || result.assetId !== log.assetId) return false
  }
  return true
}
