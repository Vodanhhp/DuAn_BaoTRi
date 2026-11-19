import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { db, now, type Asset, type AssetCloudLink } from './db'
import {
  getCloudAssetById, getCloudAssetCodeConfig, importCloudAssetPreservingIdentity, listCloudAssets, saveCloudAssetCodeConfig,
  type AssetCodeConfig
} from './lib/assetsCloud'
import {
  listAssetEditLocks, type AssetEditLock
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

const localAssetHasCurrentCloudLink = (asset: Asset, link?: AssetCloudLink): boolean =>
  Boolean(link &&
    link.status === 'linked' &&
    link.cloudCode === asset.code &&
    sameTimestamp(link.cloudUpdatedAt, asset.updatedAt) &&
    sameTimestamp(link.lastSyncedLocalUpdatedAt, asset.updatedAt))

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
  const [locks, setLocks] = useState<Record<string, AssetEditLock>>({})
  const [lockStateKnown, setLockStateKnown] = useState(false)
  const [lockError, setLockError] = useState('')
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine)
  const [canImportAssets, setCanImportAssets] = useState(false)
  const [canManageSettings, setCanManageSettings] = useState(false)
  const [permissionsLoading, setPermissionsLoading] = useState(true)
  const [localImportPreview, setLocalImportPreview] = useState<{ total: number; toInsert: number; alreadyPresent: number; toLink: number; localSnapshot: string } | null>(null)
  const [checkingLocalImport, setCheckingLocalImport] = useState(false)
  const [importingLocalAssets, setImportingLocalAssets] = useState(false)
  const [restoringCloudAssetId, setRestoringCloudAssetId] = useState<string | null>(null)
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
      setLockError('Mất kết nối Internet. Không thể xác nhận trạng thái khóa thiết bị.')
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
  }, [refreshLocks])

  useEffect(() => {
    let active = true
    const loadPermissions = async () => {
      setPermissionsLoading(true)
      try {
        const [importResult, settingsResult] = await Promise.all([
          client.rpc('has_org_permission', { p_organization_id: organizationId, p_permission_code: 'assets.import' }),
          client.rpc('has_org_permission', { p_organization_id: organizationId, p_permission_code: 'settings.manage' })
        ])
        if (importResult.error) throw importResult.error
        if (settingsResult.error) throw settingsResult.error
        if (active) {
          setCanImportAssets(importResult.data === true)
          setCanManageSettings(settingsResult.data === true)
        }
      } catch (cause) {
        if (active) {
          setCanImportAssets(false)
          setCanManageSettings(false)
          setError('Không xác định được quyền quản trị Cloud: ' + (cause instanceof Error ? cause.message : String(cause)))
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

  const restoreOneCloudAssetToLocal = async (summary: Asset) => {
    if (!canImportAssets || permissionsLoading) {
      setError('Tài khoản chưa được xác nhận quyền nhận thiết bị từ Cloud.')
      return
    }
    if (!isOnline) {
      setError('Cần có Internet để đọc lại và xác nhận phiên bản thiết bị Cloud.')
      return
    }
    if (!window.confirm('Nhận duy nhất thiết bị ' + summary.code + ' – ' + summary.name + ' từ Cloud về Local trên thiết bị này? Dữ liệu Local hiện có sẽ không bị ghi đè.')) return
    setRestoringCloudAssetId(summary.id)
    setError('')
    setMessage('')
    try {
      // Never trust the previously loaded list as the write snapshot.
      const cloudAsset = await getCloudAssetById(client, organizationId, summary.id)
      if (cloudAsset.id !== summary.id || cloudAsset.code !== summary.code) {
        throw new Error('UUID hoặc mã thiết bị Cloud đã thay đổi. Hãy tải lại danh sách và kiểm tra lại.')
      }

      await db.transaction('rw', [db.assets, db.assetCloudLinks, db.assetMutations, db.syncQueue], async () => {
        const existing = await db.assets.get(cloudAsset.id)
        if (existing) {
          throw new Error('Local đã có UUID thiết bị này. Không ghi đè hoặc tự cập nhật; hãy đối chiếu dữ liệu Local/Cloud riêng.')
        }
        const localRows = await db.assets.toArray()
        const duplicateCode = localRows.find(item => item.code.trim().toUpperCase() === cloudAsset.code.trim().toUpperCase())
        if (duplicateCode) {
          throw new Error('Mã quản lý ' + cloudAsset.code + ' đã thuộc thiết bị Local khác (' + duplicateCode.id + '). Không tự ghép.')
        }
        const linkId = organizationId + ':' + cloudAsset.id
        if (await db.assetCloudLinks.get(linkId)) {
          throw new Error('Đã tồn tại mapping Cloud cho UUID này nhưng Local không có hồ sơ tương ứng. Cần đối chiếu trước khi nhận lại.')
        }
        const unresolved = await db.assetMutations.where('[organizationId+assetId]')
          .equals([organizationId, cloudAsset.id])
          .filter(item => item.status === 'pending' || item.status === 'processing' || item.status === 'conflict')
          .first()
        if (unresolved) throw new Error('Thiết bị có mutation chưa được xử lý (' + unresolved.status + '). Không nhận về Local.')
        const queued = await db.syncQueue.where('recordId').equals(cloudAsset.id)
          .filter(item => item.tableName === 'assets')
          .first()
        if (queued) throw new Error('Thiết bị có mục trong hàng đợi Local (' + queued.status + '). Không nhận về để tránh xung đột.')

        const timestamp = now()
        const restoredAsset: Asset = { ...cloudAsset, identityStatus: 'synced', images: [] }
        const link: AssetCloudLink = {
          id: linkId,
          organizationId,
          assetId: cloudAsset.id,
          cloudCode: cloudAsset.code,
          cloudUpdatedAt: cloudAsset.updatedAt,
          lastSyncedLocalUpdatedAt: cloudAsset.updatedAt,
          status: 'linked',
          linkedAt: timestamp,
          lastVerifiedAt: timestamp
        }
        await db.assets.add(restoredAsset)
        await db.assetCloudLinks.add(link)
      })
      setMessage('Đã nhận thiết bị ' + cloudAsset.code + ' về Local trên thiết bị này. UUID, mã quản lý và phiên bản Cloud được giữ nguyên; ảnh chưa được khôi phục.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setRestoringCloudAssetId(null)
    }
  }

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
      const savedLinks = await db.assetCloudLinks.where('organizationId').equals(organizationId).toArray()
      const linksByAssetId = new Map(savedLinks.map(link => [link.assetId, link]))
      let alreadyPresent = 0
      let toInsert = 0
      let toLink = 0
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
          if (!localAssetHasCurrentCloudLink(asset, linksByAssetId.get(asset.id))) toLink++
          continue
        }
        if (existingId !== undefined && existingId !== asset.id) {
          throw new Error('Mã quản lý đã thuộc UUID khác trên Cloud: ' + asset.code)
        }
        toInsert++
        toLink++
      }
      setLocalImportPreview({ total: localRows.length, toInsert, alreadyPresent, toLink, localSnapshot: localAssetImportSnapshot(localRows) })
      setMessage('Đã kiểm tra Local PC và Cloud. Chưa ghi dữ liệu nào lên Cloud.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setCheckingLocalImport(false)
    }
  }

  const confirmLocalAssetImport = async () => {
    if (!localImportPreview || !localImportPreview.toLink) return
    if (!window.confirm('Xác nhận nhập mới hoặc tạo liên kết Cloud cho ' + localImportPreview.toLink + ' thiết bị Local? Giữ nguyên UUID và mã quản lý. Không đồng bộ vật tư hoặc dữ liệu khác.')) return
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
      const savedLinks = await db.assetCloudLinks.where('organizationId').equals(organizationId).toArray()
      const linksByAssetId = new Map(savedLinks.map(link => [link.assetId, link]))
      const rowsToLink: Asset[] = []
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
          if (!localAssetHasCurrentCloudLink(asset, linksByAssetId.get(asset.id))) rowsToLink.push(asset)
          continue
        }
        if (existingId !== undefined && existingId !== asset.id) {
          throw new Error('Mã quản lý bị trùng với thiết bị Cloud khác: ' + asset.code)
        }
        rowsToLink.push(asset)
      }
      if (rowsToLink.length !== localImportPreview.toLink) {
        throw new Error('Trạng thái Cloud hoặc liên kết Local đã thay đổi sau bước kiểm tra. Hãy kiểm tra lại trước khi xác nhận.')
      }

      const codesNeedingCounterReview: string[] = []
      let newlyImportedCount = 0
      for (let index = 0; index < rowsToLink.length; index++) {
        const asset = rowsToLink[index]
        const existedBeforeImport = cloudById.has(asset.id)
        const imported = await importCloudAssetPreservingIdentity(client, organizationId, asset)
        if (!imported.counterReconciled) codesNeedingCounterReview.push(asset.code)
        if (!existedBeforeImport && !imported.alreadyPresent) newlyImportedCount++
        const timestamp = now()
        await db.assetCloudLinks.put({
          id: organizationId + ':' + asset.id,
          organizationId,
          assetId: asset.id,
          cloudCode: imported.asset.code,
          cloudUpdatedAt: imported.asset.updatedAt,
          lastSyncedLocalUpdatedAt: asset.updatedAt,
          status: 'linked',
          linkedAt: linksByAssetId.get(asset.id)?.linkedAt ?? timestamp,
          lastVerifiedAt: timestamp
        })
        importedCount++
        setMessage('Đang xác nhận liên kết ' + importedCount + '/' + rowsToLink.length + ': ' + asset.code)
      }

      await load()
      setLocalImportPreview(null)
      const baseMessage = 'Đã xác nhận ' + importedCount + ' liên kết thiết bị; thêm mới Cloud ' + newlyImportedCount + ' thiết bị. UUID và mã quản lý được giữ nguyên; ảnh thiết bị chưa đồng bộ.'
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

  return <section className="panel">
    <div className="panel-head">
      <div>
        <h2>Thiết bị trên Cloud</h2>
        <p>Tổ chức: {organizationName} · Cloud chỉ hiển thị dữ liệu đã được nhập từ Local và trạng thái khóa; hồ sơ nghiệp vụ được quản lý tại Local.</p>
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
    {(!lockStateKnown || !isOnline) && <div className="form-hint warning-hint" role="status">{!isOnline ? 'Mất Internet: không thể tải dữ liệu Cloud hoặc xác nhận trạng thái khóa mới nhất.' : lockError || 'Chưa xác nhận được trạng thái khóa từ Cloud; thông tin khóa hiển thị có thể chưa cập nhật.'}</div>}

    {canImportAssets && !permissionsLoading && <div className="panel" style={{ margin: '12px 0', padding: 14 }}>
      <h3>Đồng bộ thiết bị từ Local PC lên Cloud</h3>
      <p className="muted">Chỉ lấy thiết bị trên máy đang mở ứng dụng. Giữ nguyên UUID và mã quản lý Local; không tạo mã mới, không đồng bộ vật tư hoặc phân hệ khác. Ảnh thiết bị chưa được đưa lên Storage.</p>
      <div className="asset-photo-actions" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="soft-btn" disabled={checkingLocalImport || importingLocalAssets} onClick={() => void checkLocalAssetImport()}>
          {checkingLocalImport ? 'Đang kiểm tra Local và Cloud…' : 'Kiểm tra dữ liệu Local PC'}
        </button>
        {localImportPreview && <button type="button" className="primary-btn" disabled={importingLocalAssets || localImportPreview.toLink === 0} onClick={() => void confirmLocalAssetImport()}>
          {importingLocalAssets ? 'Đang đồng bộ…' : 'Xác nhận nhập/liên kết ' + localImportPreview.toLink + ' thiết bị'}
        </button>}
      </div>
      {localImportPreview && <p className="form-hint" role="status">
        Local PC: {localImportPreview.total} thiết bị · Cần nhập mới lên Cloud: {localImportPreview.toInsert} · Đã có đúng UUID/mã trên Cloud: {localImportPreview.alreadyPresent} · Cần tạo/cập nhật liên kết: {localImportPreview.toLink}. Chưa ghi dữ liệu cho đến khi bạn xác nhận.
      </p>}
    </div>}

    <div className="asset-photo-actions" style={{ margin: '12px 0', flexWrap: 'wrap' }}>
      {canManageSettings && !permissionsLoading && <button type="button" className="soft-btn" onClick={() => setShowConfig(v => !v)}>
        {showConfig ? 'Đóng cấu hình mã' : config ? 'Cấu hình mã thiết bị' : 'Thiết lập mã thiết bị'}
      </button>}
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

    {loading ? <p className="muted">Đang tải danh sách thiết bị từ Supabase…</p> : <>
      <h3>Đang quản lý ({active.length})</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Mã / Tên thiết bị</th><th>Nhóm</th><th>Vị trí</th><th>Ngày sử dụng</th><th>Trạng thái / Khóa</th><th>Nhận về Local</th></tr></thead>
          <tbody>
            {active.map(asset => <tr key={asset.id}>
              <td><b>{asset.code}</b><small>{asset.name}</small></td>
              <td>{asset.category}</td>
              <td>{asset.location || '—'}</td>
              <td>{dateText(asset.commissionedAt)}</td>
              <td>{asset.status}{locks[asset.id] && <small className="status red">Đang khóa · {locks[asset.id].holder_label}</small>}</td>
              <td>{canImportAssets && !permissionsLoading && <button type="button" className="soft-btn" disabled={!isOnline || Boolean(restoringCloudAssetId) || importingLocalAssets} onClick={() => void restoreOneCloudAssetToLocal(asset)}>{restoringCloudAssetId === asset.id ? 'Đang nhận…' : 'Nhận về Local'}</button>}</td>
            </tr>)}
          </tbody>
        </table>
        {active.length === 0 && <p className="muted">Không có thiết bị đang quản lý.</p>}
      </div>

      <h3 style={{ marginTop: 24 }}>Đã lưu kho ({archived.length})</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Mã / Tên thiết bị</th><th>Nhóm</th><th>Vị trí</th><th>Ngày sử dụng</th><th>Ngày lưu kho / Khóa</th><th>Nhận về Local</th></tr></thead>
          <tbody>
            {archived.map(asset => <tr key={asset.id}>
              <td><b>{asset.code}</b><small>{asset.name}</small></td>
              <td>{asset.category}</td>
              <td>{asset.location || '—'}</td>
              <td>{dateText(asset.commissionedAt)}</td>
              <td>{dateText(asset.archivedAt)}{locks[asset.id] && <small className="status red">Đang khóa · {locks[asset.id].holder_label}</small>}</td>
              <td>{canImportAssets && !permissionsLoading && <button type="button" className="soft-btn" disabled={!isOnline || Boolean(restoringCloudAssetId) || importingLocalAssets} onClick={() => void restoreOneCloudAssetToLocal(asset)}>{restoringCloudAssetId === asset.id ? 'Đang nhận…' : 'Nhận về Local'}</button>}</td>
            </tr>)}
          </tbody>
        </table>
        {archived.length === 0 && <p className="muted">Chưa có thiết bị nào trong lưu kho.</p>}
      </div>
    </>}
    <p className="muted">Màn hình Cloud không tạo hoặc sửa hồ sơ nghiệp vụ. Có thể nhận có chọn lọc một Asset Cloud về Local; việc nhận này không thay đổi dữ liệu Cloud. Tạo, sửa, lưu kho hoặc khôi phục trạng thái hồ sơ vẫn phải thực hiện tại Local và được xác thực bằng khóa Cloud.</p>
  </section>
}
