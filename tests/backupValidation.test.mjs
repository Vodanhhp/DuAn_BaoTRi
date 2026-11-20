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
