import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { db, getDeviceId, type Asset } from './db'
import {
  createCloudAsset, getCloudAssetCodeConfig, importCloudAssetPreservingIdentity, listCloudAssets, saveCloudAssetCodeConfig,
  type AssetCodeConfig
} from './lib/assetsCloud'
import {
  acquireAssetEditLock, heartbeatAssetEditLock, listAssetEditLocks, releaseAssetEditLock,
  setAssetArchivedWithEditLock, updateAssetWithEditLock, type AssetEditLease, type AssetEditLock
} from './lib/assetEditLocks'

type Props = {
  client: SupabaseClient
  organizationId: string
  organizationName: string
  organizationRole: string
  onBack: () => void
}

const dateText = (value?: string) => value
  ? new Date(value + (value.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('vi-VN')
  : '—'
type CodeEntry = { name: string; code: string }
const suggestCode = (value: string, maxLength: number): string => {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'D').toUpperCase()
  const words = normalized.split(/[^A-Z0-9]+/).filter(Boolean)
  if (!words.length) return ''
  const initials = words.map(word => word[0]).join('')
  return (initials.length >= 2 ? initials : words[0]).slice(0, maxLength)
}
const entriesToMap = (entries: CodeEntry[], label: string, maxLength: number, required = true): Record<string, string> => {
  const result: Record<string, string> = {}
  const used = new Set<string>()
  for (const [index, entry] of entries.entries()) {
    const name = entry.name.trim()
    const code = entry.code.trim().toUpperCase()
    if (!name && !code) continue
    if (!name || !new RegExp('^[A-Z0-9]{2,' + maxLength + '}$').test(code)) throw new Error(label + ': mục ' + (index + 1) + ' cần tên và mã hợp lệ.')
    if (result[name]) throw new Error(label + ': tên bị lặp "' + name + '".')
    if (used.has(code)) throw new Error(label + ': mã bị trùng "' + code + '".')
    result[name] = code
    used.add(code)
  }
  if (required && !Object.keys(result).length) throw new Error(label + ': hãy thêm ít nhất một mục.')
  return result
}

const sameTimestamp = (left?: string | null, right?: string | null): boolean => {
  if (!left && !right) return true
  if (!left || !right) return false
  const leftTime = Date.parse(left)
  const rightTime = Date.parse(right)
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime
}


const localAssetImportSnapshot = (assets: Asset[]): string => JSON.stringify(
  [...assets]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(asset => ({
      id: asset.id,
      code: asset.code,
      name: asset.name,
      category: asset.category,
      brand: asset.brand ?? '',
      model: asset.model ?? '',
      serial: asset.serial ?? '',
      location: asset.location ?? '',
      commissionedAt: asset.commissionedAt || null,
      power: asset.power ?? '',
      cycle: asset.cycle ?? '',
      cycleStartedAt: asset.cycleStartedAt || null,
      transferredFromOtherFacility: Boolean(asset.transferredFromOtherFacility),
      status: asset.status,
      notes: asset.notes ?? '',
      archivedAt: asset.archivedAt || null,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt
    }))
)

const localAssetMatchesCloud = (asset: Asset, row: Record<string, unknown>): boolean =>
  row.id === asset.id &&
  row.code === asset.code &&
  row.name === asset.name &&
  row.category === asset.category &&
  (row.brand ?? '') === (asset.brand ?? '') &&
  (row.model ?? '') === (asset.model ?? '') &&
  (row.serial ?? '') === (asset.serial ?? '') &&
  (row.location ?? '') === (asset.location ?? '') &&
  (row.commissioned_at ?? null) === (asset.commissionedAt || null) &&
  (row.power ?? '') === (asset.power ?? '') &&
  (row.cycle ?? '') === (asset.cycle ?? '') &&
  (row.cycle_started_at ?? null) === (asset.cycleStartedAt || null) &&
  Boolean(row.transferred_from_other_facility) === Boolean(asset.transferredFromOtherFacility) &&
  row.status === asset.status &&
  (row.notes ?? '') === (asset.notes ?? '') &&
  sameTimestamp(row.archived_at as string | null | undefined, asset.archivedAt || null) &&
  sameTimestamp(row.created_at as string | null | undefined, asset.createdAt) &&
  sameTimestamp(row.updated_at as string | null | undefined, asset.updatedAt)


export default function CloudAssetsPanel({ client, organizationId, organizationName, organizationRole, onBack }: Props) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [lastLoadedAt, setLastLoadedAt] = useState('')
  const [config, setConfig] = useState<AssetCodeConfig | null>(null)
  const [facilityCode, setFacilityCode] = useState(() => suggestCode(organizationName, 8) || 'CS01')
  const [categoryEntries, setCategoryEntries] = useState<CodeEntry[]>([{ name: '', code: '' }])
  const [locationEntries, setLocationEntries] = useState<CodeEntry[]>([{ name: '', code: '' }])
  const [savingConfig, setSavingConfig] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [editDraft, setEditDraft] = useState<Asset | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editLease, setEditLease] = useState<AssetEditLease | null>(null)
  const [editLeaseLost, setEditLeaseLost] = useState(false)
  const [locks, setLocks] = useState<Record<string, AssetEditLock>>({})
  const [lockStateKnown, setLockStateKnown] = useState(false)
  const [lockError, setLockError] = useState('')
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine)
  const [busyAssetId, setBusyAssetId] = useState('')
  const [canUpdateAssets, setCanUpdateAssets] = useState(false)
  const [canCreateAssets, setCanCreateAssets] = useState(false)
  const [canImportAssets, setCanImportAssets] = useState(false)
  const [canManageSettings, setCanManageSettings] = useState(false)
  const [permissionsLoading, setPermissionsLoading] = useState(true)
  const [localImportPreview, setLocalImportPreview] = useState<{ total: number; toInsert: number; alreadyPresent: number; localSnapshot: string } | null>(null)
  const [checkingLocalImport, setCheckingLocalImport] = useState(false)
  const [importingLocalAssets, setImportingLocalAssets] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [commissionedAt, setCommissionedAt] = useState(new Date().toISOString().slice(0, 10))
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [serial, setSerial] = useState('')
  const [power, setPower] = useState('')
  const [cycle, setCycle] = useState('')
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [rows, savedConfig] = await Promise.all([
        listCloudAssets(client, organizationId),
        getCloudAssetCodeConfig(client, organizationId)
      ])
      setAssets(rows)
      setConfig(savedConfig)
      if (savedConfig) {
        setFacilityCode(savedConfig.facility_code)
        setCategoryEntries(Object.entries(savedConfig.category_codes).map(([name, code]) => ({ name, code })))
        setLocationEntries(Object.entries(savedConfig.location_codes).filter(([name]) => name !== '__UNASSIGNED__').map(([name, code]) => ({ name, code })))
      } else {
        const categories = [...new Set(rows.map(row => row.category).filter(Boolean))]
        const locations = [...new Set(rows.map(row => row.location).filter(Boolean))]
        setCategoryEntries(categories.map(name => ({ name, code: suggestCode(name, 5) })))
        setLocationEntries(locations.map(name => ({ name, code: suggestCode(name, 4) })))
      }
      setLastLoadedAt(new Date().toLocaleString('vi-VN'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [client, organizationId])

  useEffect(() => { void load() }, [load])

  const refreshLocks = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLockStateKnown(false)
      setLockError('Mất kết nối Internet. Không thể xác nhận quyền chỉnh sửa thiết bị.')
      return
    }
    try {
      const rows = await listAssetEditLocks(client, organizationId)
      const next: Record<string, AssetEditLock> = {}
      for (const row of rows) next[row.asset_id] = row
      setLocks(next)
      setLockStateKnown(true)
      setLockError('')
    } catch (cause) {
      setLockStateKnown(false)
      setLockError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [client, organizationId])

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true)
      void refreshLocks()
    }
    const onOffline = () => {
      setIsOnline(false)
      setLockStateKnown(false)
      setLockError('Mất kết nối Internet. Thiết bị đang bị khóa cục bộ; không thể chỉnh sửa.')
      if (editLease) setEditLeaseLost(true)
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    void refreshLocks()
    const timer = window.setInterval(() => { if (navigator.onLine) void refreshLocks() }, 5000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.clearInterval(timer)
    }
  }, [refreshLocks, editLease])

  useEffect(() => {
    if (!editLease) return
    const timer = window.setInterval(async () => {
      if (!navigator.onLine) {
        setEditLeaseLost(true)
        setLockError('Mất kết nối Internet. PC/Mobile này vẫn khóa cục bộ và không thể lưu.')
        return
      }
      try {
        const renewed = await heartbeatAssetEditLock(client, organizationId, editLease.asset_id, editLease.lock_token)
        if (!renewed) {
          setEditLeaseLost(true)
          setLockError('Quyền khóa thiết bị đã hết hạn hoặc được thay thế. Không thể tiếp tục chỉnh sửa.')
        } else {
          void refreshLocks()
        }
      } catch (cause) {
        setEditLeaseLost(true)
        setLockError(cause instanceof Error ? cause.message : 'Không thể xác nhận khóa thiết bị.')
      }
    }, 30000)
    return () => window.clearInterval(timer)
  }, [client, organizationId, editLease, refreshLocks])

  const cancelEdit = async () => {
    const lease = editLease
    setEditDraft(null)
    setEditLease(null)
    setEditLeaseLost(false)
    if (lease && navigator.onLine) {
      try { await releaseAssetEditLock(client, organizationId, lease.asset_id, lease.lock_token) }
      catch { /* Cloud lease tự hết hạn sau 2 phút nếu không release được. */ }
    }
    void refreshLocks()
  }

  const openEdit = async (asset: Asset) => {
    if (!canUpdateAssets || !lockStateKnown || !navigator.onLine) {
      setError(lockError || 'Chưa xác nhận được trạng thái khóa từ Cloud. Không thể chỉnh sửa thiết bị.')
      return
    }
    setError('')
    setMessage('')
    try {
      const { data: userResult } = await client.auth.getUser()
      const metadata = userResult.user?.user_metadata ?? {}
      const displayName = typeof metadata.full_name === 'string' && metadata.full_name.trim()
        ? metadata.full_name.trim()
        : userResult.user?.email || 'Tài khoản'
      const platform = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'Mobile' : 'PC'
      const result = await acquireAssetEditLock(
        client, organizationId, asset.id, getDeviceId(), displayName + ' · ' + platform
      )
      if (!result.acquired) {
        if (result.lock) setLocks(current => ({ ...current, [asset.id]: result.lock! }))
        setError(result.lock
          ? 'Thiết bị đang được chỉnh sửa bởi ' + result.lock.holder_label + '. Chỉ được xem cho đến khi họ nhả khóa.'
          : 'Cloud đang xử lý yêu cầu khóa. Vui lòng tải lại trạng thái rồi thử lại.')
        return
      }
      setEditLease(result.lease)
      setLocks(current => ({ ...current, [asset.id]: {
        asset_id: result.lease.asset_id,
        holder_user_id: result.lease.holder_user_id,
        holder_device_id: result.lease.holder_device_id,
        holder_label: result.lease.holder_label,
        acquired_at: result.lease.acquired_at,
        expires_at: result.lease.expires_at
      } }))
      setEditLeaseLost(false)
      setEditDraft({ ...asset })
      void refreshLocks()
      setShowConfig(false)
      setShowCreate(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  useEffect(() => {
    let active = true
    const loadPermissions = async () => {
      setPermissionsLoading(true)
      try {
        const [updateResult, createResult, importResult, settingsResult] = await Promise.all([
          client.rpc('has_org_permission', { p_organization_id: organizationId, p_permission_code: 'assets.update' }),
          client.rpc('has_org_permission', { p_organization_id: organizationId, p_permission_code: 'assets.create' }),
          client.rpc('has_org_permission', { p_organization_id: organizationId, p_permission_code: 'assets.import' }),
          client.rpc('has_org_permission', { p_organization_id: organizationId, p_permission_code: 'settings.manage' })
        ])
        if (updateResult.error) throw updateResult.error
        if (createResult.error) throw createResult.error
        if (importResult.error) throw importResult.error
        if (settingsResult.error) throw settingsResult.error
        if (active) {
          setCanUpdateAssets(updateResult.data === true)
          setCanCreateAssets(createResult.data === true)
          setCanImportAssets(importResult.data === true)
          setCanManageSettings(settingsResult.data === true)
        }
      } catch (cause) {
        if (active) {
          setCanUpdateAssets(false)
          setCanCreateAssets(false)
          setCanImportAssets(false)
          setCanManageSettings(false)
          setError('Không xác định được quyền thao tác thiết bị từ Supabase: ' + (cause instanceof Error ? cause.message : String(cause)))
        }
      } finally {
        if (active) setPermissionsLoading(false)
      }
    }
    void loadPermissions()
    return () => { active = false }
  }, [client, organizationId])

  const active = assets.filter(asset => !asset.archivedAt)
  const archived = assets.filter(asset => Boolean(asset.archivedAt))
  const categoryOptions = useMemo(() => Object.keys(config?.category_codes ?? {}).sort((a, b) => a.localeCompare(b, 'vi')), [config])
  const locationOptions = useMemo(() => Object.keys(config?.location_codes ?? {}).filter(x => x !== '__UNASSIGNED__').sort((a, b) => a.localeCompare(b, 'vi')), [config])

  const saveConfig = async (event: FormEvent) => {
    event.preventDefault()
    if (!canManageSettings) {
      setError('Chỉ Admin có quyền thay đổi cấu hình mã thiết bị của doanh nghiệp.')
      return
    }
    setSavingConfig(true)
    setError('')
    setMessage('')
    try {
      const next: AssetCodeConfig = {
        facility_code: facilityCode.trim().toUpperCase(),
        category_codes: entriesToMap(categoryEntries, 'Loại thiết bị', 5),
        location_codes: { ...entriesToMap(locationEntries, 'Vị trí', 4, false), __UNASSIGNED__: '99' }
      }
      await saveCloudAssetCodeConfig(client, organizationId, next)
      setConfig(next)
      setMessage('Đã lưu cấu hình mã cho tổ chức. Quyền Settings của Supabase đã được kiểm tra ở máy chủ.')
      setShowConfig(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSavingConfig(false)
    }
  }

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editDraft) return
    setSavingEdit(true)
    setError('')
    setMessage('')
    try {
      if (!editLease || editLeaseLost || !navigator.onLine) throw new Error('Không còn quyền khóa hợp lệ hoặc mất kết nối. Không thể lưu thiết bị.')
      const saved = await updateAssetWithEditLock(client, organizationId, editDraft, editLease.lock_token)
      setAssets(current => current.map(asset => asset.id === saved.id ? saved : asset).sort((a, b) => a.name.localeCompare(b.name, 'vi')))
      const lease = editLease
      setEditDraft(null)
      setEditLease(null)
      setEditLeaseLost(false)
      try { await releaseAssetEditLock(client, organizationId, lease.asset_id, lease.lock_token) } catch { /* Lease sẽ tự hết hạn. */ }
      void refreshLocks()
      setMessage('Đã cập nhật hồ sơ thiết bị ' + saved.code + '.')
    } catch (cause) {
      if (editLease && navigator.onLine) {
        try {
          const renewed = await heartbeatAssetEditLock(client, organizationId, editLease.asset_id, editLease.lock_token)
          if (!renewed) setEditLeaseLost(true)
        } catch { setEditLeaseLost(true) }
      }
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSavingEdit(false)
    }
  }

  const toggleArchive = async (asset: Asset, archived: boolean) => {
    const action = archived ? 'đưa thiết bị vào lưu kho' : 'khôi phục thiết bị'
    if (!window.confirm('Bạn có chắc muốn ' + action + ' ' + asset.code + ' – ' + asset.name + '?')) return
    setBusyAssetId(asset.id)
    setError('')
    setMessage('')
    try {
      if (!navigator.onLine || !lockStateKnown) throw new Error('Không thể xác nhận quyền khóa từ Cloud. Không được thay đổi thiết bị khi mất kết nối hoặc chưa rõ trạng thái khóa.')
      const { data: userResult } = await client.auth.getUser()
      const metadata = userResult.user?.user_metadata ?? {}
      const displayName = typeof metadata.full_name === 'string' && metadata.full_name.trim()
        ? metadata.full_name.trim()
        : userResult.user?.email || 'Tài khoản'
      const platform = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'Mobile' : 'PC'
      const acquired = await acquireAssetEditLock(client, organizationId, asset.id, getDeviceId(), displayName + ' · ' + platform)
      if (!acquired.acquired) {
        if (acquired.lock) setLocks(current => ({ ...current, [asset.id]: acquired.lock! }))
        throw new Error(acquired.lock
          ? 'Thiết bị đang được chỉnh sửa bởi ' + acquired.lock.holder_label + '.'
          : 'Cloud chưa xác nhận được quyền khóa. Vui lòng thử lại.')
      }
      let saved: Asset
      try {
        saved = await setAssetArchivedWithEditLock(client, organizationId, asset.id, acquired.lease.lock_token, archived)
      } finally {
        try { await releaseAssetEditLock(client, organizationId, asset.id, acquired.lease.lock_token) } catch { /* Lease sẽ tự hết hạn. */ }
      }
      setAssets(current => current.map(item => item.id === saved.id ? saved : item).sort((a, b) => a.name.localeCompare(b.name, 'vi')))
      void refreshLocks()
      setMessage(archived ? 'Đã đưa ' + saved.code + ' vào lưu kho.' : 'Đã khôi phục ' + saved.code + ' về danh sách đang quản lý.')
      if (editDraft?.id === saved.id) await cancelEdit()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusyAssetId('')
    }
  }

  const checkLocalAssetImport = async () => {
    setCheckingLocalImport(true)
    setError('')
    setMessage('')
    setLocalImportPreview(null)
    try {
      const localRows = await db.assets.toArray()
      if (!localRows.length) throw new Error('PC không có thiết bị Local để đồng bộ.')
      const localIds = new Set<string>()
      const localCodes = new Set<string>()
      for (const asset of localRows) {
        if (!asset.id || !asset.code.trim() || !asset.name.trim() || !asset.category.trim()) {
          throw new Error('Có thiết bị Local thiếu UUID, mã quản lý, tên hoặc nhóm thiết bị. Không thể đồng bộ an toàn.')
        }
        if (localIds.has(asset.id)) throw new Error('Local có UUID thiết bị bị trùng: ' + asset.id)
        if (localCodes.has(asset.code)) throw new Error('Local có mã quản lý bị trùng: ' + asset.code)
        localIds.add(asset.id)
        localCodes.add(asset.code)
      }
      const { data, error } = await client.from('assets')
        .select('*')
        .eq('organization_id', organizationId)
      if (error) throw new Error('Không thể kiểm tra thiết bị hiện có trên Cloud: ' + error.message)
      const cloudRows = (data ?? []) as unknown as Record<string, unknown>[]
      const cloudById = new Map(cloudRows.map(row => [String(row.id), row]))
      const cloudByCode = new Map(cloudRows.map(row => [String(row.code), String(row.id)]))
      let alreadyPresent = 0
      let toInsert = 0
      for (const asset of localRows) {
        const existing = cloudById.get(asset.id)
        const existingId = cloudByCode.get(asset.code)
        if (existing) {
          if (existing.code !== asset.code) {
            throw new Error('UUID đã tồn tại trên Cloud nhưng mã quản lý khác: ' + asset.code)
          }
          if (!localAssetMatchesCloud(asset, existing)) {
            throw new Error('Thiết bị đã có đúng UUID/mã trên Cloud nhưng nội dung khác Local: ' + asset.code + '. Không tự ghi đè.')
          }
          alreadyPresent++
          continue
        }
        if (existingId !== undefined && existingId !== asset.id) {
          throw new Error('Mã quản lý đã thuộc UUID khác trên Cloud: ' + asset.code)
        }
        toInsert++
      }
      setLocalImportPreview({ total: localRows.length, toInsert, alreadyPresent, localSnapshot: localAssetImportSnapshot(localRows) })
      setMessage('Đã kiểm tra Local PC và Cloud. Chưa ghi dữ liệu nào lên Cloud.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setCheckingLocalImport(false)
    }
  }

  const confirmLocalAssetImport = async () => {
    if (!localImportPreview || !localImportPreview.toInsert) return
    if (!window.confirm('Xác nhận đưa ' + localImportPreview.toInsert + ' thiết bị từ Local PC lên Cloud? Giữ nguyên UUID và mã quản lý. Không đồng bộ vật tư hoặc dữ liệu khác.')) return
    setImportingLocalAssets(true)
    setError('')
    setMessage('')
    let importedCount = 0
    try {
      // Re-read both sources after confirmation; the preview is not trusted as a write snapshot.
      const localRows = await db.assets.toArray()
      if (localRows.length !== localImportPreview.total ||
          localAssetImportSnapshot(localRows) !== localImportPreview.localSnapshot) {
        throw new Error('Dữ liệu Local PC đã thay đổi sau bước kiểm tra. Hãy kiểm tra lại trước khi xác nhận import.')
      }
      const { data: existing, error: readError } = await client.from('assets')
        .select('*')
        .eq('organization_id', organizationId)
      if (readError) throw new Error('Không thể kiểm tra lại Cloud trước khi ghi: ' + readError.message)
      const cloudRows = (existing ?? []) as unknown as Record<string, unknown>[]
      const cloudById = new Map(cloudRows.map(row => [String(row.id), row]))
      const cloudByCode = new Map(cloudRows.map(row => [String(row.code), String(row.id)]))
      const rowsToImport: Asset[] = []
      for (const asset of localRows) {
        const existingRow = cloudById.get(asset.id)
        const existingId = cloudByCode.get(asset.code)
        if (existingRow) {
          if (existingRow.code !== asset.code) {
            throw new Error('UUID đã có trên Cloud nhưng mã quản lý không khớp: ' + asset.code)
          }
          if (!localAssetMatchesCloud(asset, existingRow)) {
            throw new Error('Thiết bị Cloud đã tồn tại nhưng nội dung khác Local: ' + asset.code + '. Không tự ghi đè.')
          }
          continue
        }
        if (existingId !== undefined && existingId !== asset.id) {
          throw new Error('Mã quản lý bị trùng với thiết bị Cloud khác: ' + asset.code)
        }
        rowsToImport.push(asset)
      }
      if (rowsToImport.length !== localImportPreview.toInsert) {
        throw new Error('Dữ liệu Cloud đã thay đổi sau bước kiểm tra. Hãy kiểm tra lại trước khi xác nhận import.')
      }

      const codesNeedingCounterReview: string[] = []
      for (let index = 0; index < rowsToImport.length; index++) {
        const asset = rowsToImport[index]
        const imported = await importCloudAssetPreservingIdentity(client, organizationId, asset)
        if (!imported.counterReconciled) codesNeedingCounterReview.push(asset.code)
        importedCount++
        setMessage('Đang nhập thiết bị ' + importedCount + '/' + rowsToImport.length + ': ' + asset.code)
      }

      await load()
      setLocalImportPreview(null)
      const baseMessage = 'Đã nhập ' + importedCount + ' thiết bị từ Local PC lên Cloud. UUID và mã quản lý được giữ nguyên; ảnh thiết bị chưa đồng bộ.'
      setMessage(codesNeedingCounterReview.length
        ? baseMessage + ' Cần rà soát bộ đếm mã thủ công cho các mã chưa khớp cấu hình: ' + codesNeedingCounterReview.join(', ') + '.'
        : baseMessage)
    } catch (cause) {
      if (importedCount > 0) {
        setMessage('Đã nhập ' + importedCount + ' thiết bị trước khi gặp lỗi. Hãy kiểm tra lại dữ liệu; lần chạy tiếp theo sẽ bỏ qua các thiết bị đã nhập chính xác.')
      }
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setImportingLocalAssets(false)
    }
  }

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!config) return
    setCreating(true)
    setError('')
    setMessage('')
    try {
      const created = await createCloudAsset(client, organizationId, {
        id: crypto.randomUUID(), name, category, location, commissionedAt,
        brand, model, serial, power, cycle, notes
      })
      setAssets(current => [...current, created].sort((a, b) => a.name.localeCompare(b.name, 'vi')))
      setMessage('Đã tạo thiết bị Cloud: ' + created.code)
      setName(''); setBrand(''); setModel(''); setSerial(''); setPower(''); setCycle(''); setNotes('')
      setShowCreate(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setCreating(false)
    }
  }

  return <section className="panel">
    <div className="panel-head">
      <div>
        <h2>Thiết bị trên Cloud</h2>
        <p>Tổ chức: {organizationName} · Dữ liệu đọc/ghi trực tiếp từ Supabase, độc lập với IndexedDB.</p>
      </div>
      <div className="asset-photo-actions">
        <button type="button" className="soft-btn" onClick={onBack}>Quay lại dữ liệu cục bộ</button>
        <button type="button" className="soft-btn" onClick={() => void load()} disabled={loading}>
          {loading ? 'Đang tải…' : 'Tải lại dữ liệu'}
        </button>
      </div>
    </div>
    <div className="asset-result-count">
      Cloud: {assets.length} thiết bị · Đang quản lý: {active.length} · Lưu kho: {archived.length}
      {lastLoadedAt && <span> · Cập nhật lúc {lastLoadedAt}</span>}
    </div>
    {message && <div className="form-hint" role="status">{message}</div>}
    {error && <div className="form-hint warning-hint" role="alert">{error}</div>}
    {(!lockStateKnown || !isOnline) && <div className="form-hint warning-hint" role="status">{!isOnline ? 'Mất Internet: không được chỉnh sửa hồ sơ thiết bị.' : lockError || 'Chưa xác nhận được trạng thái khóa từ Cloud. Các thao tác sửa/lưu kho/khôi phục đang bị khóa an toàn.'}</div>}

    {canImportAssets && !permissionsLoading && <div className="panel" style={{ margin: '12px 0', padding: 14 }}>
      <h3>Đồng bộ thiết bị từ Local PC lên Cloud</h3>
      <p className="muted">Chỉ lấy thiết bị trên máy đang mở ứng dụng. Giữ nguyên UUID và mã quản lý Local; không tạo mã mới, không đồng bộ vật tư hoặc phân hệ khác. Ảnh thiết bị chưa được đưa lên Storage.</p>
      <div className="asset-photo-actions" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="soft-btn" disabled={checkingLocalImport || importingLocalAssets} onClick={() => void checkLocalAssetImport()}>
          {checkingLocalImport ? 'Đang kiểm tra Local và Cloud…' : 'Kiểm tra dữ liệu Local PC'}
        </button>
        {localImportPreview && <button type="button" className="primary-btn" disabled={importingLocalAssets || localImportPreview.toInsert === 0} onClick={() => void confirmLocalAssetImport()}>
          {importingLocalAssets ? 'Đang đồng bộ…' : 'Xác nhận đồng bộ ' + localImportPreview.toInsert + ' thiết bị'}
        </button>}
      </div>
      {localImportPreview && <p className="form-hint" role="status">
        Local PC: {localImportPreview.total} thiết bị · Cần đưa lên Cloud: {localImportPreview.toInsert} · Đã có đúng UUID/mã trên Cloud: {localImportPreview.alreadyPresent}. Chưa ghi dữ liệu cho đến khi bạn xác nhận.
      </p>}
    </div>}

    <div className="asset-photo-actions" style={{ margin: '12px 0', flexWrap: 'wrap' }}>
      {canManageSettings && !permissionsLoading && <button type="button" className="soft-btn" onClick={() => { setShowConfig(v => !v); setShowCreate(false); void cancelEdit() }}>
        {showConfig ? 'Đóng cấu hình mã' : config ? 'Cấu hình mã thiết bị' : 'Thiết lập mã thiết bị Cloud'}
      </button>}
      <button type="button" className="primary-btn" disabled={!config || permissionsLoading || !canCreateAssets} title={!canCreateAssets ? 'Tài khoản không có quyền tạo thiết bị.' : undefined} onClick={() => { setShowCreate(v => !v); setShowConfig(false); void cancelEdit() }}>
        {showCreate ? 'Đóng biểu mẫu' : 'Thêm thiết bị Cloud'}
      </button>
    </div>

    {showConfig && canManageSettings && <form className="panel" onSubmit={saveConfig} style={{ marginBottom: 16 }}>
      <h3>Cấu hình mã thiết bị của {organizationName}</h3>
      <p className="muted">Chỉ cần nhập tên. BAOTRI tự gợi ý mã viết tắt, bạn có thể sửa mã nếu muốn.</p>
      <label>Tên/mã cơ sở
        <input value={facilityCode} onChange={e => setFacilityCode(e.target.value.toUpperCase())} placeholder="Ví dụ: CN" required />
        <small>Mã gợi ý từ tên tổ chức: {suggestCode(organizationName, 8) || 'CS01'}</small>
      </label>
      <div className="form-grid">
        <div>
          <h4>Loại thiết bị</h4><p className="muted">Ví dụ: Máy nén khí → MNK</p>
          {categoryEntries.map((entry, index) => <div className="form-grid" key={'cat-' + index}>
            <label>Tên loại<input value={entry.name} placeholder="Máy nén khí" onChange={e => setCategoryEntries(items => items.map((item, i) => i === index ? { name: e.target.value, code: suggestCode(e.target.value, 5) } : item))} /></label>
            <label>Mã gợi ý<input value={entry.code} maxLength={5} onChange={e => setCategoryEntries(items => items.map((item, i) => i === index ? { ...item, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') } : item))} /></label>
            <button type="button" className="soft-btn" onClick={() => setCategoryEntries(items => items.filter((_, i) => i !== index))}>Bỏ</button>
          </div>)}
          <button type="button" className="soft-btn" onClick={() => setCategoryEntries(items => [...items, { name: '', code: '' }])}>+ Thêm loại thiết bị</button>
        </div>
        <div>
          <h4>Vị trí lắp đặt</h4><p className="muted">Ví dụ: Phòng máy → PM</p>
          {locationEntries.map((entry, index) => <div className="form-grid" key={'loc-' + index}>
            <label>Tên vị trí<input value={entry.name} placeholder="Phòng máy" onChange={e => setLocationEntries(items => items.map((item, i) => i === index ? { name: e.target.value, code: suggestCode(e.target.value, 4) } : item))} /></label>
            <label>Mã gợi ý<input value={entry.code} maxLength={4} onChange={e => setLocationEntries(items => items.map((item, i) => i === index ? { ...item, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') } : item))} /></label>
            <button type="button" className="soft-btn" onClick={() => setLocationEntries(items => items.filter((_, i) => i !== index))}>Bỏ</button>
          </div>)}
          <button type="button" className="soft-btn" onClick={() => setLocationEntries(items => [...items, { name: '', code: '' }])}>+ Thêm vị trí</button>
        </div>
      </div>
      <p className="muted">Vị trí để trống sẽ tự dùng mã mặc định. Mã đã cấp không tự đổi khi bạn sửa tên danh mục. Chỉ quản trị viên có quyền cấu hình mới lưu được.</p>
      <button type="submit" className="primary-btn" disabled={savingConfig || !canManageSettings}>{savingConfig ? 'Đang lưu…' : 'Lưu cấu hình Cloud'}</button>
    </form>}

    {editDraft && <form className="panel" onSubmit={submitEdit} style={{ marginBottom: 16 }}>
      <h3>Sửa hồ sơ thiết bị: {editDraft.code}</h3>
      <p className="muted">{editLeaseLost || !isOnline ? 'Lỗi mất kết nối hoặc đã mất quyền khóa. Thiết bị vẫn bị khóa cục bộ trên máy này; không thể tiếp tục sửa/lưu.' : 'Bạn đang giữ khóa chỉnh sửa thiết bị này. Khóa được gia hạn tự động và sẽ hết hạn trên Cloud sau 2 phút nếu không còn heartbeat.'}</p>
      <fieldset disabled={editLeaseLost || !isOnline || !editLease || savingEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <div className="form-grid">
        <label>Mã thiết bị<input value={editDraft.code} disabled /></label>
        <label>Loại thiết bị<input value={editDraft.category} disabled /></label>
        <label>Tên thiết bị<input required value={editDraft.name} onChange={e => setEditDraft(current => current ? { ...current, name: e.target.value } : current)} /></label>
        <label>Vị trí<input value={editDraft.location} onChange={e => setEditDraft(current => current ? { ...current, location: e.target.value } : current)} /></label>
        <label>Ngày đưa vào sử dụng<input type="date" value={editDraft.commissionedAt || ''} onChange={e => setEditDraft(current => current ? { ...current, commissionedAt: e.target.value } : current)} /></label>
        <label>Hãng<input value={editDraft.brand} onChange={e => setEditDraft(current => current ? { ...current, brand: e.target.value } : current)} /></label>
        <label>Model<input value={editDraft.model} onChange={e => setEditDraft(current => current ? { ...current, model: e.target.value } : current)} /></label>
        <label>Serial<input value={editDraft.serial} onChange={e => setEditDraft(current => current ? { ...current, serial: e.target.value } : current)} /></label>
        <label>Công suất<input value={editDraft.power} onChange={e => setEditDraft(current => current ? { ...current, power: e.target.value } : current)} /></label>
        <label>Chu kỳ bảo trì<input value={editDraft.cycle} onChange={e => setEditDraft(current => current ? { ...current, cycle: e.target.value } : current)} /></label>
        <label>Trạng thái<select value={editDraft.status} onChange={e => setEditDraft(current => current ? { ...current, status: e.target.value as Asset['status'] } : current)}>{['Đang hoạt động', 'Đang sửa chữa', 'Ngừng sử dụng', 'Thanh lý'].map(value => <option key={value}>{value}</option>)}</select></label>
      </div>
      <label>Ghi chú<textarea rows={3} value={editDraft.notes} onChange={e => setEditDraft(current => current ? { ...current, notes: e.target.value } : current)} /></label>
      </fieldset>
      <div className="asset-photo-actions"><button type="button" className="soft-btn" onClick={() => void cancelEdit()}>Hủy</button><button type="submit" className="primary-btn" disabled={savingEdit || editLeaseLost || !isOnline || !editLease}>{savingEdit ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>
    </form>}

    {showCreate && config && <form className="panel" onSubmit={submitCreate} style={{ marginBottom: 16 }}>
      <h3>Tạo thiết bị mới trên Cloud</h3>
      <div className="form-grid">
        <label>Tên thiết bị<input value={name} onChange={e => setName(e.target.value)} required /></label>
        <label>Loại thiết bị<select value={category} onChange={e => setCategory(e.target.value)} required><option value="">Chọn loại thiết bị</option>{categoryOptions.map(x => <option key={x} value={x}>{x} · {config.category_codes[x]}</option>)}</select></label>
        <label>Vị trí<select value={location} onChange={e => setLocation(e.target.value)}><option value="">Chưa phân loại</option>{locationOptions.map(x => <option key={x} value={x}>{x} · {config.location_codes[x]}</option>)}</select></label>
        <label>Ngày đưa vào sử dụng<input type="date" value={commissionedAt} onChange={e => setCommissionedAt(e.target.value)} /></label>
        <label>Hãng<input value={brand} onChange={e => setBrand(e.target.value)} /></label>
        <label>Model<input value={model} onChange={e => setModel(e.target.value)} /></label>
        <label>Serial<input value={serial} onChange={e => setSerial(e.target.value)} /></label>
        <label>Công suất<input value={power} onChange={e => setPower(e.target.value)} /></label>
        <label>Chu kỳ bảo trì<input value={cycle} onChange={e => setCycle(e.target.value)} placeholder="Ví dụ: Hàng tháng" /></label>
      </div>
      <label>Ghi chú<textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></label>
      <p className="muted">Mã thiết bị được cấp tại Supabase trong cùng transaction tạo hồ sơ. Không sử dụng bộ đếm ở trình duyệt.</p>
      <button type="submit" className="primary-btn" disabled={creating || !category}>{creating ? 'Đang tạo…' : 'Tạo thiết bị trên Cloud'}</button>
    </form>}

    {loading ? <p className="muted">Đang tải danh sách thiết bị từ Supabase…</p> : <>
      <h3>Đang quản lý ({active.length})</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Mã / Tên thiết bị</th><th>Nhóm</th><th>Vị trí</th><th>Ngày sử dụng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {active.map(asset => <tr key={asset.id}>
              <td><b>{asset.code}</b><small>{asset.name}</small></td>
              <td>{asset.category}</td>
              <td>{asset.location || '—'}</td>
              <td>{dateText(asset.commissionedAt)}</td>
              <td>{asset.status}{locks[asset.id] && <small className="status red">Đang khóa · {locks[asset.id].holder_label}</small>}</td>
              <td className="actions">
                {canUpdateAssets ? <>
                  <button type="button" className="text-btn" disabled={!lockStateKnown || !isOnline || Boolean(locks[asset.id]) || busyAssetId === asset.id} onClick={() => void openEdit(asset)}>Sửa</button>
                  <button type="button" className="text-btn" disabled={!lockStateKnown || !isOnline || Boolean(locks[asset.id]) || busyAssetId === asset.id} onClick={() => void toggleArchive(asset, true)}>{busyAssetId === asset.id ? 'Đang xử lý…' : 'Lưu kho'}</button>
                </> : <span className="muted">Chỉ xem</span>}
              </td>
            </tr>)}
          </tbody>
        </table>
        {active.length === 0 && <p className="muted">Không có thiết bị đang quản lý.</p>}
      </div>

      <h3 style={{ marginTop: 24 }}>Đã lưu kho ({archived.length})</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Mã / Tên thiết bị</th><th>Nhóm</th><th>Vị trí</th><th>Ngày sử dụng</th><th>Ngày lưu kho</th><th>Thao tác</th></tr></thead>
          <tbody>
            {archived.map(asset => <tr key={asset.id}>
              <td><b>{asset.code}</b><small>{asset.name}</small></td>
              <td>{asset.category}</td>
              <td>{asset.location || '—'}</td>
              <td>{dateText(asset.commissionedAt)}</td>
              <td>{dateText(asset.archivedAt)}{locks[asset.id] && <small className="status red">Đang khóa · {locks[asset.id].holder_label}</small>}</td>
              <td className="actions">
                {canUpdateAssets ? <button type="button" className="text-btn success-text" disabled={!lockStateKnown || !isOnline || Boolean(locks[asset.id]) || busyAssetId === asset.id} onClick={() => void toggleArchive(asset, false)}>{busyAssetId === asset.id ? 'Đang xử lý…' : 'Khôi phục'}</button> : <span className="muted">Chỉ xem</span>}
              </td>
            </tr>)}
          </tbody>
        </table>
        {archived.length === 0 && <p className="muted">Chưa có thiết bị nào trong lưu kho.</p>}
      </div>
    </>}
    <p className="muted">Quyền tạo và cập nhật được đọc trực tiếp từ RPC has_org_permission của Supabase (assets.create / assets.update); nếu không xác định được quyền, giao diện mặc định chỉ xem. Không có thao tác xóa cứng; dữ liệu IndexedDB và ảnh local không bị thay đổi.</p>
  </section>
}
