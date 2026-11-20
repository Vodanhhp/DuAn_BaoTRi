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

const hasValidRows = (value: unknown): value is Array<Record<string, unknown>> =>
  Array.isArray(value) && value.every(row =>
    isRecord(row) && typeof row.id === 'string' && row.id.trim().length > 0
  )

/**
 * Validate the complete current backup format before any destructive restore.
 * A valid empty database is allowed, but every table must be explicitly present.
 */
export function isValidBackupV3(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  if (value.backupVersion !== 3 || value.database !== 'baotri-local-v1') return false
  if (typeof value.exportedAt !== 'string' || !value.exportedAt.trim()) return false
  if (!tableKeys.every(key => hasValidRows(value[key]))) return false
  if (!Array.isArray(value.customAssetCategories)) return false
  return true
}
