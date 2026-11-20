import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const assetsCloud = await readFile(new URL('../src/lib/assetsCloud.ts', import.meta.url), 'utf8')
const cloudPanel = await readFile(new URL('../src/CloudAssetsPanel.tsx', import.meta.url), 'utf8')

test('Local Asset import enforces the reviewed no-data-loss mapper before calling the Cloud RPC', () => {
  const start = assetsCloud.indexOf('export async function importCloudAssetPreservingIdentity')
  assert.ok(start >= 0, 'Local Asset import function must exist')
  const handler = assetsCloud.slice(start)
  const guard = handler.indexOf('toCloudAssetRow(asset, organizationId)')
  const rpc = handler.indexOf("client.rpc('import_asset_preserving_identity'")
  assert.ok(guard >= 0 && rpc > guard, 'draft identity and unsupported creator metadata must be rejected before the Cloud write')
})

test('Local Asset import preview rejects unsupported fields before reading Cloud rows', () => {
  const start = cloudPanel.indexOf('const checkLocalAssetImport = async')
  const end = cloudPanel.indexOf('const confirmLocalAssetImport = async', start)
  assert.ok(start >= 0 && end > start, 'Local Asset import preview handler must exist')
  const handler = cloudPanel.slice(start, end)
  const guard = handler.indexOf('toCloudAssetRow(asset, organizationId)')
  const cloudRead = handler.indexOf("client.from('assets')")
  assert.ok(guard >= 0 && cloudRead > guard, 'preview must validate every Local Asset before any Cloud lookup')
})
