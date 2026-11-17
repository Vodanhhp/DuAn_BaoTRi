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
