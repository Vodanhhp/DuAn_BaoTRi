import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const code = value => typeof value === 'string' && value.length > 0
const uniqueBy = (items, key, label, errors) => {
  const seen = new Set()
  for (const item of items ?? []) {
    const value = item?.[key]
    if (value === undefined || value === null) continue
    if (seen.has(value)) errors.push(`${label}: giá trị trùng "${value}".`)
    seen.add(value)
  }
}
const refsExist = (refs, known, label, errors) => {
  for (const ref of refs ?? []) {
    if (!known.has(ref)) errors.push(`${label}: tham chiếu không tồn tại "${ref}".`)
  }
}

export function validateTemplateRelease(pkg) {
  const errors = []
  if (!pkg || typeof pkg !== 'object') return ['Gói mô hình phải là một object JSON.']
  const { manifest, profile, packages } = pkg
  if (!manifest || !profile || !packages) return ['Thiếu manifest, profile hoặc packages.']
  if (manifest.packageId !== profile.modelCode) errors.push('manifest.packageId phải trùng profile.modelCode.')
  if (manifest.status === 'released' && !manifest.publishedAt) errors.push('Gói released phải có publishedAt.')
  if (!manifest.compatibility?.minAppVersion) errors.push('Thiếu compatibility.minAppVersion.')

  const d = packages.dictionaries ?? {}
  const arrays = [
    ['assetGroups', d.assetGroups], ['assetTypes', d.assetTypes],
    ['inventoryGroups', d.inventoryGroups], ['inventoryItems', d.inventoryItems],
    ['units', d.units], ['taskTypes', d.taskTypes],
    ['taskStatuses', d.taskStatuses], ['priorities', d.priorities],
    ['assetStatuses', d.assetStatuses], ['checklists', packages.checklists],
    ['maintenanceTemplates', packages.maintenanceTemplates], ['modules', packages.modules]
  ]
  for (const [name, items] of arrays) {
    if (!Array.isArray(items)) errors.push(`packages.${name} phải là một mảng.`)
  }
  const list = name => Array.isArray(d[name]) ? d[name] : []
  const assetGroups = new Set(list('assetGroups').map(x => x.code))
  const assetTypes = new Set(list('assetTypes').map(x => x.code))
  const inventoryGroups = new Set(list('inventoryGroups').map(x => x.code))
  const inventoryItems = new Set(list('inventoryItems').map(x => x.code))
  const units = new Set(list('units').map(x => x.code))
  const taskTypes = new Set(list('taskTypes').map(x => x.code))
  const taskStatuses = new Set(list('taskStatuses').map(x => x.code))
  const priorities = new Set(list('priorities').map(x => x.code))
  const checklists = new Set((packages.checklists ?? []).map(x => x.templateCode))
  const maintenance = new Set((packages.maintenanceTemplates ?? []).map(x => x.templateCode))
  const modules = new Set((packages.modules ?? []).map(x => x.moduleCode))
  const safety = new Set((packages.safetyRules ?? []).map(x => x.ruleCode))

  for (const [name, items] of arrays) {
    if (!Array.isArray(items)) continue
    uniqueBy(items, 'code', name, errors)
    if (name === 'checklists' || name === 'maintenanceTemplates') uniqueBy(items, 'templateCode', name, errors)
    if (name === 'modules') uniqueBy(items, 'moduleCode', name, errors)
    if (name === 'taskStatuses' || name === 'priorities' || name === 'assetStatuses') uniqueBy(items, 'code', name, errors)
  }

  const allTemplateIds = [
    ...arrays.flatMap(([, items]) => Array.isArray(items) ? items.map(x => x.templateItemId).filter(code) : [])
  ]
  if (new Set(allTemplateIds).size !== allTemplateIds.length) errors.push('templateItemId phải duy nhất trong toàn bộ release.')

  for (const item of list('assetTypes')) {
    if (!assetGroups.has(item.groupCode)) errors.push(`AssetType ${item.code}: groupCode "${item.groupCode}" không tồn tại.`)
    refsExist(item.checklistTemplateRefs, checklists, `AssetType ${item.code}.checklistTemplateRefs`, errors)
    refsExist(item.maintenanceTemplateRefs, maintenance, `AssetType ${item.code}.maintenanceTemplateRefs`, errors)
    refsExist(item.compatibleInventoryItemCodes, inventoryItems, `AssetType ${item.code}.compatibleInventoryItemCodes`, errors)
    for (const field of item.attributeDefinitions ?? []) {
      if (field.unitCode && !units.has(field.unitCode)) errors.push(`AssetType ${item.code}: unitCode "${field.unitCode}" không tồn tại.`)
    }
  }
  for (const item of list('inventoryItems')) {
    if (!inventoryGroups.has(item.groupCode)) errors.push(`InventoryItem ${item.code}: groupCode "${item.groupCode}" không tồn tại.`)
    if (!units.has(item.defaultUnitCode)) errors.push(`InventoryItem ${item.code}: defaultUnitCode "${item.defaultUnitCode}" không tồn tại.`)
    refsExist(item.compatibleAssetTypeCodes, assetTypes, `InventoryItem ${item.code}.compatibleAssetTypeCodes`, errors)
  }
  for (const item of list('taskTypes')) {
    if (item.defaultPriorityCode && !priorities.has(item.defaultPriorityCode)) errors.push(`TaskType ${item.code}: defaultPriorityCode không tồn tại.`)
    refsExist(item.applicableAssetTypeCodes, assetTypes, `TaskType ${item.code}.applicableAssetTypeCodes`, errors)
    refsExist(item.suggestedChecklistRefs, checklists, `TaskType ${item.code}.suggestedChecklistRefs`, errors)
  }
  for (const item of packages.checklists ?? []) {
    refsExist(item.assetTypeCodes, assetTypes, `Checklist ${item.templateCode}.assetTypeCodes`, errors)
    for (const entry of item.items ?? []) {
      if (entry.unitCode && !units.has(entry.unitCode)) errors.push(`Checklist ${item.templateCode}: unitCode "${entry.unitCode}" không tồn tại.`)
    }
  }
  for (const item of packages.maintenanceTemplates ?? []) {
    refsExist(item.assetTypeCodes, assetTypes, `Maintenance ${item.templateCode}.assetTypeCodes`, errors)
    if (!taskTypes.has(item.taskTypeCode)) errors.push(`Maintenance ${item.templateCode}: taskTypeCode "${item.taskTypeCode}" không tồn tại.`)
    refsExist(item.safetyRuleRefs, safety, `Maintenance ${item.templateCode}.safetyRuleRefs`, errors)
  }
  for (const item of packages.modules ?? []) {
    refsExist(item.dependsOn, modules, `Module ${item.moduleCode}.dependsOn`, errors)
    const menus = new Set((item.menuItems ?? []).map(x => x.menuCode))
    if (menus.size !== (item.menuItems ?? []).length) errors.push(`Module ${item.moduleCode}: menuCode bị trùng.`)
    for (const menu of item.menuItems ?? []) {
      if (menu.parentMenuCode && !menus.has(menu.parentMenuCode)) errors.push(`Menu ${menu.menuCode}: parentMenuCode không tồn tại trong module.`)
    }
  }
  for (const item of packages.safetyRules ?? []) {
    if (!Array.isArray(item.appliesTo) || item.appliesTo.length === 0) errors.push(`SafetyRule ${item.ruleCode}: appliesTo không được rỗng.`)
  }
  const entityTypes = (packages.codeProfiles ?? []).map(x => x.entityType)
  if (new Set(entityTypes).size !== entityTypes.length) errors.push('Mỗi entityType chỉ được có một codeProfile trong release.')
  if (!packages.organizationStructure || packages.organizationStructure.facilityCountDefault < 1) {
    errors.push('organizationStructure.facilityCountDefault phải lớn hơn hoặc bằng 1.')
  }
  if (packages.organizationStructure?.warehouseModeDefault === 'single_shared' &&
      packages.organizationStructure.manageLocationsDefault === true) {
    errors.push('Kho single_shared không nên bật quản lý vị trí mặc định.')
  }
  return errors
}

async function main() {
  const file = process.argv[2]
  if (!file) {
    process.stderr.write('Cách dùng: node scripts/validate-template-release.mjs <file.json>\\n')
    process.exitCode = 2
    return
  }
  let pkg
  try {
    pkg = JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    process.stderr.write(`Không đọc được JSON: ${error.message}\\n`)
    process.exitCode = 2
    return
  }
  const errors = validateTemplateRelease(pkg)
  if (errors.length) {
    process.stderr.write(errors.map((e, i) => `${i + 1}. ${e}`).join('\\n') + '\\n')
    process.exitCode = 1
  } else {
    process.stdout.write(`Template release hợp lệ về liên kết dữ liệu: ${file}\\n`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main()
