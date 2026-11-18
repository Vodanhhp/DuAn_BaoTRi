import type { SupabaseClient } from '@supabase/supabase-js'
import type { Asset } from '../db'

export type AssetEditLock = {
  asset_id: string
  holder_user_id: string
  holder_device_id: string
  holder_label: string
  acquired_at: string
  expires_at: string
}

export type AssetEditLease = AssetEditLock & {
  lock_token: string
}

type AcquireResult = {
  acquired?: boolean
  retry?: boolean
  asset_id?: string
  holder_user_id?: string
  holder_device_id?: string
  holder_label?: string
  lock_token?: string
  acquired_at?: string
  expires_at?: string
}

function requireRpcData<T>(data: unknown, error: { message: string } | null, action: string): T {
  if (error) throw new Error(action + ': ' + error.message)
  if (data == null) throw new Error(action + ': Cloud không trả về kết quả.')
  return data as T
}

export async function listAssetEditLocks(
  client: SupabaseClient,
  organizationId: string
): Promise<AssetEditLock[]> {
  const { data, error } = await client.rpc('list_asset_edit_locks', {
    p_organization_id: organizationId
  })
  return requireRpcData<AssetEditLock[]>(data, error, 'Không thể tải trạng thái khóa thiết bị')
}

export async function acquireAssetEditLock(
  client: SupabaseClient,
  organizationId: string,
  assetId: string,
  deviceId: string,
  holderLabel: string
): Promise<{ acquired: true; lease: AssetEditLease } | { acquired: false; lock?: AssetEditLock; retry?: boolean }> {
  const { data, error } = await client.rpc('acquire_asset_edit_lock', {
    p_organization_id: organizationId,
    p_asset_id: assetId,
    p_device_id: deviceId,
    p_holder_label: holderLabel
  })
  const result = requireRpcData<AcquireResult>(data, error, 'Không thể xin khóa thiết bị')
  if (result.acquired === true) {
    if (!result.lock_token || !result.expires_at || !result.holder_user_id || !result.holder_device_id || !result.holder_label || !result.acquired_at) {
      throw new Error('Cloud cấp khóa nhưng dữ liệu lease không đầy đủ.')
    }
    return { acquired: true, lease: {
      asset_id: assetId,
      holder_user_id: result.holder_user_id,
      holder_device_id: result.holder_device_id,
      holder_label: result.holder_label,
      lock_token: result.lock_token,
      acquired_at: result.acquired_at,
      expires_at: result.expires_at
    } }
  }
  return {
    acquired: false,
    retry: result.retry === true,
    lock: result.holder_user_id && result.holder_device_id && result.holder_label && result.acquired_at && result.expires_at
      ? {
          asset_id: assetId,
          holder_user_id: result.holder_user_id,
          holder_device_id: result.holder_device_id,
          holder_label: result.holder_label,
          acquired_at: result.acquired_at,
          expires_at: result.expires_at
        }
      : undefined
  }
}

export async function heartbeatAssetEditLock(
  client: SupabaseClient,
  organizationId: string,
  assetId: string,
  lockToken: string
): Promise<boolean> {
  const { data, error } = await client.rpc('heartbeat_asset_edit_lock', {
    p_organization_id: organizationId,
    p_asset_id: assetId,
    p_lock_token: lockToken
  })
  const result = requireRpcData<{ renewed?: boolean }>(data, error, 'Không thể gia hạn khóa thiết bị')
  return result.renewed === true
}

export async function releaseAssetEditLock(
  client: SupabaseClient,
  organizationId: string,
  assetId: string,
  lockToken: string
): Promise<boolean> {
  const { data, error } = await client.rpc('release_asset_edit_lock', {
    p_organization_id: organizationId,
    p_asset_id: assetId,
    p_lock_token: lockToken
  })
  return requireRpcData<boolean>(data, error, 'Không thể giải phóng khóa thiết bị')
}

type AssetRow = {
  id: string
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

function fromAssetRow(row: AssetRow): Asset {
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
    images: [],
    archivedAt: row.archived_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export async function updateAssetWithEditLock(
  client: SupabaseClient,
  organizationId: string,
  asset: Asset,
  lockToken: string
): Promise<Asset> {
  const { data, error } = await client.rpc('update_asset_with_lock', {
    p_organization_id: organizationId,
    p_asset_id: asset.id,
    p_lock_token: lockToken,
    p_name: asset.name.trim(),
    p_brand: asset.brand ?? '',
    p_model: asset.model ?? '',
    p_serial: asset.serial ?? '',
    p_location: asset.location ?? '',
    p_commissioned_at: asset.commissionedAt || null,
    p_power: asset.power ?? '',
    p_cycle: asset.cycle ?? '',
    p_cycle_started_at: asset.cycleStartedAt || null,
    p_transferred_from_other_facility: Boolean(asset.transferredFromOtherFacility),
    p_status: asset.status,
    p_notes: asset.notes ?? ''
  })
  return fromAssetRow(requireRpcData<AssetRow>(data, error, 'Không thể cập nhật thiết bị'))
}

export async function setAssetArchivedWithEditLock(
  client: SupabaseClient,
  organizationId: string,
  assetId: string,
  lockToken: string,
  archived: boolean
): Promise<Asset> {
  const { data, error } = await client.rpc('set_asset_archived_with_lock', {
    p_organization_id: organizationId,
    p_asset_id: assetId,
    p_lock_token: lockToken,
    p_archived: archived
  })
  return fromAssetRow(requireRpcData<AssetRow>(data, error, 'Không thể thay đổi trạng thái lưu kho thiết bị'))
}
