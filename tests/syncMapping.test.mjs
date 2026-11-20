import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/lib/syncMapping.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove
  }
}).outputText
const modulePath = join(tmpdir(), `baotri-sync-mapping-${process.pid}-${Date.now()}.mjs`)
await (await import('node:fs/promises')).writeFile(modulePath, compiled, 'utf8')
const mapping = await import(pathToFileURL(modulePath).href)
await (await import('node:fs/promises')).rm(modulePath, { force: true })

const org = '00000000-0000-4000-8000-000000000001'
const asset = {
  id: '10000000-0000-4000-8000-000000000001', code: 'TB-001', name: 'Motor',
  category: 'Động cơ', brand: 'ABB', model: 'M2', serial: 'S1', location: 'Xưởng A',
  commissionedAt: '2026-01-02', power: '2.2kW', cycle: 'Tháng', cycleStartedAt: '2026-02-01',
  transferredFromOtherFacility: true, status: 'Đang hoạt động', notes: 'Ghi chú',
  images: ['data:image/png;base64,not-uploaded'], archivedAt: undefined,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z'
}

test('asset mapping preserves UUID and business fields but never sends local image bytes', () => {
  const row = mapping.toCloudAssetRow(asset, org)
  assert.equal(row.id, asset.id)
  assert.equal(row.organization_id, org)
  assert.equal(row.code, asset.code)
  assert.equal(row.transferred_from_other_facility, true)
  assert.equal('images' in row, false)
  const restored = mapping.fromCloudAssetRow(row)
  assert.equal(restored.id, asset.id)
  assert.equal(restored.code, asset.code)
  assert.deepEqual(restored.images, [])
})

test('every mapper rejects a missing organization scope', () => {
  assert.throws(() => mapping.toCloudAssetRow(asset, '  '), /organization_id/)
  assert.throws(() => mapping.toCloudInventoryBaselineRow({
    id: 'i1', code: 'VT-1', name: 'Bạc đạn', group: 'Cơ khí', unit: 'cái',
    quantity: 5, minQuantity: 1, location: '', supplier: '', unitPrice: 10, updatedAt: '2026-01-01'
  }, ''), /organization_id/)
})

test('inventory metadata mapping cannot overwrite the Cloud balance', () => {
  const item = {
    id: '20000000-0000-4000-8000-000000000001', code: 'VT-001', name: 'Bạc đạn',
    group: 'Cơ khí', unit: 'cái', quantity: 99, minQuantity: 2,
    location: 'Kho A', supplier: 'NCC', unitPrice: 12000, updatedAt: '2026-03-01T00:00:00.000Z'
  }
  const baseline = mapping.toCloudInventoryBaselineRow(item, org)
  const metadata = mapping.toCloudInventoryMetadataRow(item, org)
  assert.equal(baseline.quantity, 99)
  assert.equal('quantity' in metadata, false)
  assert.equal(metadata.organization_id, org)
  assert.equal(mapping.fromCloudInventoryItemRow(baseline).quantity, 99)
})

test('task mapping preserves asset foreign key and status', () => {
  const task = {
    id: '30000000-0000-4000-8000-000000000001', assetId: asset.id, title: 'Bảo dưỡng',
    dueDate: '2026-04-01', frequency: 'Tháng', status: 'Chờ thực hiện',
    checklist: 'A', readings: 'B', notes: '', createdAt: '2026-01-01', updatedAt: '2026-01-02'
  }
  const row = mapping.toCloudTaskRow(task, org)
  assert.equal(row.asset_id, asset.id)
  assert.equal(mapping.fromCloudTaskRow(row).assetId, asset.id)
  assert.equal(mapping.fromCloudTaskRow(row).status, task.status)
})

test('Checklist version and result keep immutable snapshot data', () => {
  const item = { id: 'q1', label: 'Kiểm tra', answerType: 'pass-fail-na', required: true, order: 1 }
  const version = {
    id: '40000000-0000-4000-8000-000000000001', templateId: 't1', assetId: asset.id,
    version: 2, title: 'Checklist', description: '', items: [item], createdAt: '2026-01-01'
  }
  const versionRow = mapping.toCloudChecklistVersionRow(version, org)
  assert.deepEqual(mapping.fromCloudChecklistVersionRow(versionRow).items, [item])
  const result = {
    id: '50000000-0000-4000-8000-000000000001', assetId: asset.id, templateId: 't1',
    templateVersionId: version.id, templateVersion: 2, templateTitle: 'Checklist',
    performedAt: '2026-02-01T08:00:00.000Z', performedBy: 'KTV', result: 'Đạt',
    scheduledFor: '2026-02-01', isMakeup: false, notes: '',
    items: [{ templateItemId: 'q1', label: 'Kiểm tra', answerType: 'pass-fail-na', answer: 'Đạt', note: '', order: 1 }],
    createdAt: '2026-02-01T08:00:00.000Z'
  }
  const resultRow = mapping.toCloudChecklistResultRow(result, org)
  assert.deepEqual(mapping.fromCloudChecklistResultRow(resultRow).items, result.items)
  assert.equal(resultRow.template_version_id, version.id)
})

test('maintenance log refuses fields absent from the current SQL schema', () => {
  const base = {
    id: '60000000-0000-4000-8000-000000000001', assetId: asset.id, date: '2026-02-01',
    kind: 'Sửa chữa', description: '', parts: '', readings: '', performedBy: ''
  }
  assert.throws(() => mapping.toCloudMaintenanceLogRow({ ...base, dueDate: '2026-02-02' }, org), mapping.UnsupportedCloudFieldError)
  assert.throws(() => mapping.toCloudMaintenanceLogRow({ ...base, requestedBy: 'Quản lý' }, org), mapping.UnsupportedCloudFieldError)
  assert.throws(() => mapping.toCloudMaintenanceLogRow({
    ...base, editHistory: [{ id: 'e1', editedAt: '2026-02-03', editedBy: 'Admin', action: 'Sửa', previousResult: '', previousPerformedBy: '' }]
  }, org), mapping.UnsupportedCloudFieldError)
  assert.equal(mapping.toCloudMaintenanceLogRow(base, org).asset_id, asset.id)
})

test('inventory movement cannot be sent as a direct table write', () => {
  const movement = {
    id: '70000000-0000-4000-8000-000000000001', itemId: '20000000-0000-4000-8000-000000000001',
    date: '2026-02-01', type: 'Xuất', quantity: 1, reason: 'Sử dụng'
  }
  assert.throws(() => mapping.assertMovementRequiresRpc(movement), mapping.UnsupportedCloudFieldError)
})

test('table dependency order is explicit and movement is last', () => {
  assert.equal(mapping.CLOUD_SYNC_ORDER[0], 'assets')
  assert.equal(mapping.CLOUD_SYNC_ORDER.at(-1), 'inventory_movements')
  assert.equal(mapping.LOCAL_TO_CLOUD_TABLE.movements, 'inventory_movements')
})

test('Cloud mapping refuses draft identities and draft foreign keys', () => {
  assert.throws(() => mapping.toCloudAssetRow({
    ...asset, id: 'draft:10000000-0000-4000-8000-000000000001', code: '', identityStatus: 'draft'
  }, org), /bản nháp Local/)
  assert.throws(() => mapping.toCloudInventoryBaselineRow({
    id: 'draft:20000000-0000-4000-8000-000000000001', code: 'VT-01', name: 'Tụ điện',
    group: 'Điện', unit: 'cái', quantity: 0, minQuantity: 0, location: '',
    supplier: '', unitPrice: 0, updatedAt: '2026-11-18T00:00:00.000Z', identityStatus: 'draft'
  }, org), /bản nháp Local/)
  assert.throws(() => mapping.toCloudTaskRow({
    id: '30000000-0000-4000-8000-000000000001',
    assetId: 'draft:10000000-0000-4000-8000-000000000001',
    title: 'Kiểm tra', dueDate: '2026-11-18', frequency: 'Tháng',
    status: 'Chờ thực hiện', checklist: '', readings: '', notes: '',
    createdAt: '2026-11-18', updatedAt: '2026-11-18'
  }, org), /bản nháp Local/)
})

test('Cloud mapping refuses creator snapshots until the SQL schema can preserve them', () => {
  assert.throws(() => mapping.toCloudAssetRow({
    ...asset, createdByLabel: 'Admin', createdByUserId: '90000000-0000-4000-8000-000000000001'
  }, org), /chưa có trường người tạo Asset/)
  assert.throws(() => mapping.toCloudInventoryBaselineRow({
    id: '20000000-0000-4000-8000-000000000001', code: 'VT-02', name: 'Bóng LED',
    group: 'Điện', unit: 'cái', quantity: 0, minQuantity: 0, location: '',
    supplier: '', unitPrice: 0, updatedAt: '2026-11-18T00:00:00.000Z',
    createdByLabel: 'Admin'
  }, org), /chưa có trường người tạo InventoryItem/)
})

test('Checklist Cloud sync dependency order places every parent before its child', () => {
  const order = mapping.CLOUD_SYNC_ORDER
  const position = table => order.indexOf(table)
  assert.ok(position('assets') >= 0)
  assert.ok(position('checklist_templates') > position('assets'))
  assert.ok(position('checklist_template_versions') > position('checklist_templates'))
  assert.ok(position('checklist_results') > position('checklist_templates'))
  assert.ok(position('checklist_results') > position('checklist_template_versions'))
  assert.ok(position('maintenance_logs') > position('checklist_results'))
  assert.ok(position('maintenance_logs') > position('maintenance_tasks'))
})
