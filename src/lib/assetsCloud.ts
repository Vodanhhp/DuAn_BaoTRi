import type { SupabaseClient } from '@supabase/supabase-js'
import type { Asset } from '../db'

/**
 * Cloud repository for the Assets vertical slice.
 *
 * This module deliberately does not read from or write to Dexie. Local demo
 * records, syncQueue entries and browser-stored images are never uploaded here.
 * Row-level security remains the authoritative permission check.
 */

type AssetRow = {
  id: string
  organization_id: string
  code: string
  name: string
  category: string
  brand: string
  model: string
  serial: string
  location: string
  commissioned_at: string | null
  power: string
  cycle: string
  cycle_started_at: string | null
  transferred_from_other_facility: boolean
  status: Asset['status']
  notes: string
  archived_at: string | null
  created_at: string
  updated_at: string
}

const ASSET_COLUMNS = [
  'id', 'organization_id', 'code', 'name', 'category', 'brand', 'model',
  'serial', 'location', 'commissioned_at', 'power', 'cycle',
  'cycle_started_at', 'transferred_from_other_facility', 'status',
  'notes', 'archived_at', 'created_at', 'updated_at'
].join(',')

function toAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    brand: row.brand ?? '',
    model: row.model ?? '',
    serial: row.serial ?? '',
    location: row.location ?? '',
    commissionedAt: row.commissioned_at ?? '',
    power: row.power ?? '',
    cycle: row.cycle ?? '',
    cycleStartedAt: row.cycle_started_at ?? undefined,
    transferredFromOtherFacility: row.transferred_from_other_facility,
    status: row.status,
    notes: row.notes ?? '',
    // Image bytes remain in local IndexedDB until Storage is implemented.
    images: [],
    archivedAt: row.archived_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toCloudUpdate(asset: Asset) {
  return {
    name: asset.name.trim(),
    brand: asset.brand ?? '',
    model: asset.model ?? '',
    serial: asset.serial ?? '',
    location: asset.location ?? '',
    commissioned_at: asset.commissionedAt || null,
    power: asset.power ?? '',
    cycle: asset.cycle ?? '',
    cycle_started_at: asset.cycleStartedAt || null,
    transferred_from_other_facility: Boolean(asset.transferredFromOtherFacility),
    status: asset.status,
    notes: asset.notes ?? '',
    updated_at: new Date().toISOString()
  }
}

/** Read only this tenant's Assets. RLS independently verifies membership. */
export async function listCloudAssets(
  client: SupabaseClient,
  organizationId: string
): Promise<Asset[]> {
  if (!organizationId) throw new Error('Thiếu tổ chức đang hoạt động.')
  const { data, error } = await client
    .from('assets')
    .select(ASSET_COLUMNS)
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })

  if (error) throw new Error('Không thể tải thiết bị cloud: ' + error.message)
  return ((data ?? []) as unknown as AssetRow[]).map(toAsset)
}

/**
 * Update editable fields only. ID, code, organization_id, timestamps created
 * and image metadata are not accepted from the browser as mutable fields.
 */
export async function updateCloudAsset(
  client: SupabaseClient,
  organizationId: string,
  asset: Asset
): Promise<Asset> {
  if (!organizationId) throw new Error('Thiếu tổ chức đang hoạt động.')
  if (!asset.id) throw new Error('Thiếu ID thiết bị.')
  if (!asset.name.trim()) throw new Error('Tên thiết bị không được để trống.')

  const { data, error } = await client
    .from('assets')
    .update(toCloudUpdate(asset))
    .eq('organization_id', organizationId)
    .eq('id', asset.id)
    .select(ASSET_COLUMNS)
    .single()

  if (error) throw new Error('Không thể cập nhật thiết bị cloud: ' + error.message)
  return toAsset(data as unknown as AssetRow)
}

/** Archive/restore is a soft update; no hard delete is exposed by this module. */
export async function setCloudAssetArchived(
  client: SupabaseClient,
  organizationId: string,
  assetId: string,
  archived: boolean
): Promise<Asset> {
  if (!organizationId) throw new Error('Thiếu tổ chức đang hoạt động.')
  if (!assetId) throw new Error('Thiếu ID thiết bị.')

  const { data, error } = await client
    .from('assets')
    .update({
      archived_at: archived ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq('organization_id', organizationId)
    .eq('id', assetId)
    .select(ASSET_COLUMNS)
    .single()

  if (error) throw new Error('Không thể cập nhật lưu kho thiết bị cloud: ' + error.message)
  return toAsset(data as unknown as AssetRow)
}

export type AssetCodeConfig = {
  facility_code: string
  category_codes: Record<string, string>
  location_codes: Record<string, string>
}

export async function getCloudAssetCodeConfig(
  client: SupabaseClient,
  organizationId: string
): Promise<AssetCodeConfig | null> {
  const { data, error } = await client
    .from('organization_settings')
    .select('asset_code_config')
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (error) throw new Error('Không thể đọc cấu hình mã thiết bị: ' + error.message)
  return (data?.asset_code_config as AssetCodeConfig | null) ?? null
}

export async function saveCloudAssetCodeConfig(
  client: SupabaseClient,
  organizationId: string,
  config: AssetCodeConfig
): Promise<void> {
  if (!organizationId) throw new Error('Thiếu tổ chức đang hoạt động.')
  const facilityCode = config.facility_code.trim().toUpperCase()
  if (!/^[A-Z0-9]{2,8}$/.test(facilityCode)) throw new Error('Mã cơ sở phải gồm 2–8 ký tự chữ in hoa hoặc số.')
  if (!Object.keys(config.category_codes).length) throw new Error('Cần khai báo ít nhất một mã loại thiết bị.')
  if (!Object.keys(config.location_codes).length) throw new Error('Cần khai báo ít nhất một mã vị trí.')

  const { data: existing, error: readError } = await client
    .from('organization_settings')
    .select('organization_id')
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (readError) throw new Error('Không thể kiểm tra cấu hình tổ chức: ' + readError.message)

  const query = existing
    ? client.from('organization_settings').update({ asset_code_config: { ...config, facility_code: facilityCode } }).eq('organization_id', organizationId)
    : client.from('organization_settings').insert({ organization_id: organizationId, asset_code_config: { ...config, facility_code: facilityCode } })
  const { error } = await query
  if (error) throw new Error('Không thể lưu cấu hình mã thiết bị: ' + error.message)
}

export type CreateCloudAssetInput = {
  id?: string
  name: string
  category: string
  location: string
  commissionedAt: string
  brand?: string
  model?: string
  serial?: string
  power?: string
  cycle?: string
  cycleStartedAt?: string
  transferredFromOtherFacility?: boolean
  status?: Asset['status']
  notes?: string
}

export async function createCloudAsset(
  client: SupabaseClient,
  organizationId: string,
  input: CreateCloudAssetInput
): Promise<Asset> {
  if (!organizationId) throw new Error('Thiếu tổ chức đang hoạt động.')
  if (!input.name.trim()) throw new Error('Tên thiết bị không được để trống.')
  if (!input.category.trim()) throw new Error('Chưa chọn loại thiết bị.')

  const { data, error } = await client.rpc('create_asset_with_code', {
    p_organization_id: organizationId,
    p_name: input.name.trim(),
    p_category: input.category,
    p_location: input.location,
    p_id: input.id ?? crypto.randomUUID(),
    p_brand: input.brand ?? '',
    p_model: input.model ?? '',
    p_serial: input.serial ?? '',
    p_commissioned_at: input.commissionedAt || null,
    p_power: input.power ?? '',
    p_cycle: input.cycle ?? '',
    p_cycle_started_at: input.cycleStartedAt || null,
    p_transferred_from_other_facility: Boolean(input.transferredFromOtherFacility),
    p_status: input.status ?? 'Đang hoạt động',
    p_notes: input.notes ?? ''
  })
  if (error) throw new Error('Không thể tạo thiết bị Cloud: ' + error.message)
  const row = (Array.isArray(data) ? data[0] : data) as unknown as AssetRow
  if (!row?.id || !row?.code) throw new Error('RPC không trả về hồ sơ thiết bị hợp lệ.')
  return toAsset(row)
}

/**
 * Explicit one-off import of an existing Local asset.
 * The Local UUID and management code are immutable inputs; the mutation ID
 * reuses the asset UUID so a retry after a partial batch is idempotent.
 */
export async function importCloudAssetPreservingIdentity(
  client: SupabaseClient,
  organizationId: string,
  asset: Asset
): Promise<{ asset: Asset; alreadyPresent: boolean; counterReconciled: boolean }> {
  if (!organizationId) throw new Error('Thiếu tổ chức đang hoạt động.')
  if (!asset.id) throw new Error('Thiếu UUID thiết bị Local.')
  if (!asset.code || !asset.code.trim()) throw new Error('Thiếu mã quản lý thiết bị Local.')

  const { data, error } = await client.rpc('import_asset_preserving_identity', {
    p_organization_id: organizationId,
    p_id: asset.id,
    p_code: asset.code,
    p_mutation_id: asset.id,
    p_asset: {
      name: asset.name,
      category: asset.category,
      brand: asset.brand ?? '',
      model: asset.model ?? '',
      serial: asset.serial ?? '',
      location: asset.location ?? '',
      commissioned_at: asset.commissionedAt || null,
      power: asset.power ?? '',
      cycle: asset.cycle ?? '',
      cycle_started_at: asset.cycleStartedAt || null,
      transferred_from_other_facility: Boolean(asset.transferredFromOtherFacility),
      status: asset.status,
      notes: asset.notes ?? '',
      archived_at: asset.archivedAt || null,
      created_at: asset.createdAt,
      updated_at: asset.updatedAt
    }
  })

  if (error) throw new Error('Không thể nhập thiết bị ' + asset.code + ' lên Cloud: ' + error.message)
  const result = data as { asset?: AssetRow; already_present?: boolean; counter_reconciled?: boolean } | null
  const row = result?.asset
  if (!row?.id || !row?.code) throw new Error('RPC import không trả về hồ sơ thiết bị hợp lệ.')
  if (row.id !== asset.id || row.code !== asset.code) {
    throw new Error('Cloud trả về UUID hoặc mã quản lý không khớp với Local: ' + asset.code)
  }
  return {
    asset: toAsset(row),
    alreadyPresent: result?.already_present === true,
    counterReconciled: result?.counter_reconciled === true
  }
}
