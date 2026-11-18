import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { validateTemplateRelease } from '../scripts/validate-template-release.mjs'

const sample = JSON.parse(await readFile(new URL('../templates/HOTEL_SMALL_BASIC/1.0.0.json', import.meta.url), 'utf8'))

test('hotel small basic template has valid internal references', () => {
  assert.deepEqual(validateTemplateRelease(sample), [])
})

test('validator rejects an asset type with a missing group', () => {
  const invalid = structuredClone(sample)
  invalid.packages.dictionaries.assetTypes[0].groupCode = 'UNKNOWN_GROUP'
  assert.ok(validateTemplateRelease(invalid).some(message => message.includes('groupCode')))
})

test('validator rejects missing checklist asset type references', () => {
  const invalid = structuredClone(sample)
  invalid.packages.checklists[0].assetTypeCodes = ['UNKNOWN_ASSET']
  assert.ok(validateTemplateRelease(invalid).some(message => message.includes('assetTypeCodes')))
})

test('validator rejects package/profile identity mismatch', () => {
  const invalid = structuredClone(sample)
  invalid.profile.modelCode = 'OTHER_MODEL'
  assert.ok(validateTemplateRelease(invalid).some(message => message.includes('packageId')))
})

test('validator rejects duplicate codes and duplicate template item IDs', () => {
  const invalid = structuredClone(sample)
  invalid.packages.dictionaries.assetGroups.push({ ...invalid.packages.dictionaries.assetGroups[0] })
  assert.ok(validateTemplateRelease(invalid).some(message => message.includes('assetGroups')))
})
