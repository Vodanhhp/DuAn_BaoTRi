import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/lib/localIdentity.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove
  }
}).outputText
const modulePath = join(tmpdir(), `baotri-local-identity-${process.pid}-${Date.now()}.mjs`)
await (await import('node:fs/promises')).writeFile(modulePath, compiled, 'utf8')
const identity = await import(pathToFileURL(modulePath).href)
await (await import('node:fs/promises')).rm(modulePath, { force: true })

const draftAssetId = 'draft:10000000-0000-4000-8000-000000000001'
const draftItemId = 'draft:20000000-0000-4000-8000-000000000001'
const officialAssetId = '30000000-0000-4000-8000-000000000001'
const officialItemId = '40000000-0000-4000-8000-000000000001'
const assetQueue = {
  id: `assets:${draftAssetId}`, tableName: 'assets', recordId: draftAssetId,
  operation: 'upsert', queuedAt: '2026-11-18T08:00:00.000Z', status: 'pending',
  attempts: 0, deviceId: 'device-1', mutationId: 'old-mutation'
}
const inventoryQueue = {
  id: `inventory:${draftItemId}`, tableName: 'inventory', recordId: draftItemId,
  operation: 'upsert', queuedAt: '2026-11-18T08:01:00.000Z', status: 'pending',
  attempts: 0, deviceId: 'device-1', mutationId: 'old-mutation-2'
}

test('draft ID uses a separate namespace and cannot be mistaken for UUID', () => {
  const id = identity.createDraftId(() => '50000000-0000-4000-8000-000000000001')
  assert.equal(id, 'draft:50000000-0000-4000-8000-000000000001')
  assert.equal(identity.isDraftId(id), true)
  assert.equal(identity.isUuid(id), false)
  assert.equal(identity.isUuid('50000000-0000-4000-8000-000000000001'), true)
})

test('Asset rekey plan updates every dependent foreign key and creates a fresh queue mutation', () => {
  const plan = identity.buildAssetRekeyPlan({
    asset: { id: draftAssetId, code: '', name: 'Bơm', identityStatus: 'draft' },
    tasks: [{ id: 'task-1', assetId: draftAssetId }],
    maintenancePlans: [{ id: 'plan-1', assetId: draftAssetId }],
    logs: [{ id: 'log-1', assetId: draftAssetId }],
    checklistTemplates: [{ id: 'template-1', assetId: draftAssetId }],
    checklistVersions: [{ id: 'version-1', templateId: 'template-1', assetId: draftAssetId }],
    checklistResults: [{ id: 'result-1', assetId: draftAssetId, templateId: 'template-1', templateVersionId: 'version-1' }],
    movements: [
      { id: 'movement-1', itemId: 'item-1', linkedAssetId: draftAssetId },
      { id: 'movement-2', itemId: 'item-2', linkedAssetId: 'other-asset' }
    ],
    syncQueue: [assetQueue]
  }, draftAssetId, officialAssetId, {
    mutationId: 'new-asset-mutation', deviceId: 'device-1', queuedAt: '2026-11-18T08:05:00.000Z'
  })

  assert.equal(plan.asset.id, officialAssetId)
  assert.equal(plan.asset.identityStatus, 'ready')
  for (const rows of [plan.tasks, plan.maintenancePlans, plan.logs, plan.checklistTemplates, plan.checklistVersions, plan.checklistResults]) {
    assert.equal(rows[0].assetId, officialAssetId)
  }
  assert.equal(plan.movements[0].linkedAssetId, officialAssetId)
  assert.equal(plan.movements[1].linkedAssetId, 'other-asset')
  assert.equal(plan.queueItem.oldId, assetQueue.id)
  assert.equal(plan.queueItem.value.id, `assets:${officialAssetId}`)
  assert.equal(plan.queueItem.value.recordId, officialAssetId)
  assert.equal(plan.queueItem.value.mutationId, 'new-asset-mutation')
  assert.equal(plan.queueItem.value.status, 'pending')
})

test('Inventory rekey plan updates movement itemId and queue identity', () => {
  const plan = identity.buildInventoryRekeyPlan({
    item: { id: draftItemId, code: 'VT-01', name: 'Tụ điện', identityStatus: 'draft' },
    movements: [
      { id: 'movement-1', itemId: draftItemId },
      { id: 'movement-2', itemId: 'another-item' }
    ],
    syncQueue: [inventoryQueue]
  }, draftItemId, officialItemId, {
    mutationId: 'new-inventory-mutation', deviceId: 'device-2', queuedAt: '2026-11-18T08:06:00.000Z'
  })

  assert.equal(plan.item.id, officialItemId)
  assert.equal(plan.item.identityStatus, 'ready')
  assert.equal(plan.movements[0].itemId, officialItemId)
  assert.equal(plan.movements[1].itemId, 'another-item')
  assert.equal(plan.queueItem.oldId, inventoryQueue.id)
  assert.equal(plan.queueItem.value.id, `inventory:${officialItemId}`)
  assert.equal(plan.queueItem.value.recordId, officialItemId)
})

test('rekey rejects invalid IDs, queue collision, and in-flight mutation', () => {
  const input = {
    asset: { id: draftAssetId, code: '', name: 'Bơm' },
    tasks: [], maintenancePlans: [], logs: [], checklistTemplates: [],
    checklistVersions: [], checklistResults: [], movements: [], syncQueue: []
  }
  const options = { mutationId: 'm1', deviceId: 'd1', queuedAt: '2026-11-18T08:00:00.000Z' }
  assert.throws(() => identity.buildAssetRekeyPlan(input, 'not-a-draft', officialAssetId, options), /namespace draft/)
  assert.throws(() => identity.buildAssetRekeyPlan(input, draftAssetId, 'not-a-uuid', options), /UUID chính thức/)
  assert.throws(() => identity.buildAssetRekeyPlan({
    ...input, asset: { ...input.asset, id: 'draft:90000000-0000-4000-8000-000000000009' }
  }, draftAssetId, officialAssetId, options), /Không tìm thấy Asset/)

  assert.throws(() => identity.buildAssetRekeyPlan({
    ...input,
    syncQueue: [{ ...assetQueue, id: `assets:${officialAssetId}`, recordId: officialAssetId }]
  }, draftAssetId, officialAssetId, options), /đã có mutation/)
  assert.throws(() => identity.buildAssetRekeyPlan({
    ...input,
    syncQueue: [{ ...assetQueue, status: 'processing' }]
  }, draftAssetId, officialAssetId, options), /đang được xử lý/)
})
