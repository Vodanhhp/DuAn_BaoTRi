import assert from 'node:assert/strict'
import { readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/lib/backupValidation.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
}).outputText
const modulePath = join(tmpdir(), `baotri-backup-validation-${process.pid}-${Date.now()}.mjs`)
await writeFile(modulePath, compiled, 'utf8')
const { isValidBackupV3 } = await import(pathToFileURL(modulePath).href)
await rm(modulePath, { force: true })

const keys = [
  'assets', 'inventory', 'tasks', 'logs', 'movements', 'maintenancePlans',
  'checklistTemplates', 'checklistVersions', 'checklistResults', 'syncQueue'
]
const validBackup = () => ({
  backupVersion: 3,
  exportedAt: '2026-11-20T10:00:00.000Z',
  database: 'baotri-local-v1',
  ...Object.fromEntries(keys.map(key => [key, []])),
  customAssetCategories: []
})

test('rejects empty JSON that could otherwise wipe local data', () => {
  assert.equal(isValidBackupV3({}), false)
  assert.equal(isValidBackupV3(null), false)
  assert.equal(isValidBackupV3([]), false)
})

test('accepts a complete valid empty backup', () => {
  assert.equal(isValidBackupV3(validBackup()), true)
})

test('accepts legacy v3 backups without inventory location settings', () => {
  assert.equal(isValidBackupV3(validBackup()), true)
})

test('accepts valid inventory location settings in v3 backups', () => {
  const backup = validBackup()
  backup.inventoryLocations = ['Kho cơ điện', 'Kho phụ tùng']
  backup.inventoryLocationEnabled = false
  assert.equal(isValidBackupV3(backup), true)
})

test('rejects malformed optional inventory location settings', () => {
  const invalidLocations = validBackup()
  invalidLocations.inventoryLocations = ['Kho cơ điện', '   ']
  assert.equal(isValidBackupV3(invalidLocations), false)

  const invalidToggle = validBackup()
  invalidToggle.inventoryLocationEnabled = 'false'
  assert.equal(isValidBackupV3(invalidToggle), false)
})

test('accepts a well-formed pending sync queue entry', () => {
  const backup = validBackup()
  backup.assets = [{ id: 'asset-1' }]
  backup.syncQueue = [{
    id: 'assets:asset-1', tableName: 'assets', recordId: 'asset-1', operation: 'upsert',
    queuedAt: '2026-11-20T10:00:00.000Z', status: 'pending', attempts: 0,
    deviceId: 'device-1', mutationId: 'mutation-1'
  }]
  assert.equal(isValidBackupV3(backup), true)
})

test('rejects malformed or unsupported sync queue entries before restore', () => {
  const invalidCollection = validBackup()
  invalidCollection.syncQueue = [{
    id: 'profiles:user-1', tableName: 'profiles', recordId: 'user-1', operation: 'upsert',
    queuedAt: '2026-11-20T10:00:00.000Z', status: 'pending', attempts: 0,
    deviceId: 'device-1', mutationId: 'mutation-1'
  }]
  assert.equal(isValidBackupV3(invalidCollection), false)

  const invalidOperation = validBackup()
  invalidOperation.syncQueue = [{
    id: 'assets:asset-1', tableName: 'assets', recordId: 'asset-1', operation: 'truncate',
    queuedAt: '2026-11-20T10:00:00.000Z', status: 'pending', attempts: 0,
    deviceId: 'device-1', mutationId: 'mutation-1'
  }]
  assert.equal(isValidBackupV3(invalidOperation), false)

  const missingMutationId = validBackup()
  missingMutationId.syncQueue = [{
    id: 'assets:asset-1', tableName: 'assets', recordId: 'asset-1', operation: 'upsert',
    queuedAt: '2026-11-20T10:00:00.000Z', status: 'pending', attempts: -1,
    deviceId: 'device-1'
  }]
  assert.equal(isValidBackupV3(missingMutationId), false)

  const orphanedUpsert = validBackup()
  orphanedUpsert.syncQueue = [{
    id: 'assets:missing-asset', tableName: 'assets', recordId: 'missing-asset', operation: 'upsert',
    queuedAt: '2026-11-20T10:00:00.000Z', status: 'pending', attempts: 0,
    deviceId: 'device-1', mutationId: 'mutation-1'
  }]
  assert.equal(isValidBackupV3(orphanedUpsert), false)

  const validDelete = validBackup()
  validDelete.syncQueue = [{
    id: 'assets:deleted-asset', tableName: 'assets', recordId: 'deleted-asset', operation: 'delete',
    queuedAt: '2026-11-20T10:00:00.000Z', status: 'pending', attempts: 0,
    deviceId: 'device-1', mutationId: 'mutation-2'
  }]
  assert.equal(isValidBackupV3(validDelete), true)
})

test('rejects missing tables and unsupported backup versions', () => {
  const missingTable = validBackup()
  delete missingTable.logs
  assert.equal(isValidBackupV3(missingTable), false)

  const unsupported = validBackup()
  unsupported.backupVersion = 99
  assert.equal(isValidBackupV3(unsupported), false)
})

test('rejects rows without a non-empty primary key', () => {
  const malformed = validBackup()
  malformed.assets = [{ name: 'Asset without ID' }]
  assert.equal(isValidBackupV3(malformed), false)
})

test('rejects missing custom categories and wrong database identity', () => {
  const missingCategories = validBackup()
  delete missingCategories.customAssetCategories
  assert.equal(isValidBackupV3(missingCategories), false)

  const wrongDatabase = validBackup()
  wrongDatabase.database = 'another-database'
  assert.equal(isValidBackupV3(wrongDatabase), false)
})

test('rejects duplicate primary keys within a table', () => {
  const duplicate = validBackup()
  duplicate.assets = [{ id: 'same-id' }, { id: 'same-id' }]
  assert.equal(isValidBackupV3(duplicate), false)
})

const backupWithChecklistChain = () => {
  const backup = validBackup()
  backup.assets = [{ id: 'asset-1' }]
  backup.checklistTemplates = [{ id: 'template-1', assetId: 'asset-1' }]
  backup.checklistVersions = [{ id: 'version-1', templateId: 'template-1', assetId: 'asset-1' }]
  backup.checklistResults = [{ id: 'result-1', assetId: 'asset-1', templateId: 'template-1', templateVersionId: 'version-1' }]
  backup.logs = [{ id: 'log-1', assetId: 'asset-1', checklistResultId: 'result-1' }]
  return backup
}

test('accepts backup with consistent Checklist-to-request references', () => {
  assert.equal(isValidBackupV3(backupWithChecklistChain()), true)
})

test('rejects Checklist templates, versions, or results with missing or mismatched asset references', () => {
  const missingAsset = backupWithChecklistChain()
  missingAsset.checklistTemplates[0].assetId = 'missing-asset'
  assert.equal(isValidBackupV3(missingAsset), false)

  const mismatchedVersion = backupWithChecklistChain()
  mismatchedVersion.checklistVersions[0].assetId = 'another-asset'
  assert.equal(isValidBackupV3(mismatchedVersion), false)

  const missingVersion = backupWithChecklistChain()
  missingVersion.checklistResults[0].templateVersionId = 'missing-version'
  assert.equal(isValidBackupV3(missingVersion), false)
})

test('rejects maintenance requests linked to missing Checklist results or another asset', () => {
  const missingResult = backupWithChecklistChain()
  missingResult.logs[0].checklistResultId = 'missing-result'
  assert.equal(isValidBackupV3(missingResult), false)

  const mismatchedAsset = backupWithChecklistChain()
  mismatchedAsset.logs[0].assetId = 'another-asset'
  assert.equal(isValidBackupV3(mismatchedAsset), false)
})
