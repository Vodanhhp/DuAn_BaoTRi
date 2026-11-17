import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Asset } from './db'
import {
  createCloudAsset, getCloudAssetCodeConfig, listCloudAssets, saveCloudAssetCodeConfig,
  setCloudAssetArchived, updateCloudAsset, type AssetCodeConfig
} from './lib/assetsCloud'

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
  const [busyAssetId, setBusyAssetId] = useState('')
  const [canUpdateAssets, setCanUpdateAssets] = useState(false)
  const [canCreateAssets, setCanCreateAssets] = useState(false)
  const [canManageSettings, setCanManageSettings] = useState(false)
  const [permissionsLoading, setPermissionsLoading] = useState(true)
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

  useEffect(() => {
    let active = true
    const loadPermissions = async () => {
      setPermissionsLoading(true)
      try {
        const [updateResult, createResult, settingsResult] = await Promise.all([
          client.rpc('has_org_permission', { p_organization_id: organizationId, p_permission_code: 'assets.update' }),
          client.rpc('has_org_permission', { p_organization_id: organizationId, p_permission_code: 'assets.create' }),
          client.rpc('has_org_permission', { p_organization_id: organizationId, p_permission_code: 'settings.manage' })
        ])
        if (updateResult.error) throw updateResult.error
        if (createResult.error) throw createResult.error
        if (settingsResult.error) throw settingsResult.error
        if (active) {
          setCanUpdateAssets(updateResult.data === true)
          setCanCreateAssets(createResult.data === true)
          setCanManageSettings(settingsResult.data === true)
        }
      } catch (cause) {
        if (active) {
          setCanUpdateAssets(false)
          setCanCreateAssets(false)
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
      const saved = await updateCloudAsset(client, organizationId, editDraft)
      setAssets(current => current.map(asset => asset.id === saved.id ? saved : asset).sort((a, b) => a.name.localeCompare(b.name, 'vi')))
      setEditDraft(null)
      setMessage('Đã cập nhật hồ sơ thiết bị ' + saved.code + '.')
    } catch (cause) {
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
      const saved = await setCloudAssetArchived(client, organizationId, asset.id, archived)
      setAssets(current => current.map(item => item.id === saved.id ? saved : item).sort((a, b) => a.name.localeCompare(b.name, 'vi')))
      setMessage(archived ? 'Đã đưa ' + saved.code + ' vào lưu kho.' : 'Đã khôi phục ' + saved.code + ' về danh sách đang quản lý.')
      if (editDraft?.id === saved.id) setEditDraft(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusyAssetId('')
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

    <div className="asset-photo-actions" style={{ margin: '12px 0', flexWrap: 'wrap' }}>
      {canManageSettings && !permissionsLoading && <button type="button" className="soft-btn" onClick={() => { setShowConfig(v => !v); setShowCreate(false); setEditDraft(null) }}>
        {showConfig ? 'Đóng cấu hình mã' : config ? 'Cấu hình mã thiết bị' : 'Thiết lập mã thiết bị Cloud'}
      </button>}
      <button type="button" className="primary-btn" disabled={!config || permissionsLoading || !canCreateAssets} title={!canCreateAssets ? 'Tài khoản không có quyền tạo thiết bị.' : undefined} onClick={() => { setShowCreate(v => !v); setShowConfig(false); setEditDraft(null) }}>
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
      <p className="muted">Mã định danh và loại thiết bị được giữ nguyên. Ảnh chưa được chỉnh sửa trên Cloud.</p>
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
      <div className="asset-photo-actions"><button type="button" className="soft-btn" onClick={() => setEditDraft(null)}>Hủy</button><button type="submit" className="primary-btn" disabled={savingEdit}>{savingEdit ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>
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
              <td>{asset.status}</td>
              <td className="actions">
                {canUpdateAssets ? <>
                  <button type="button" className="text-btn" onClick={() => { setEditDraft({ ...asset }); setShowConfig(false); setShowCreate(false) }}>Sửa</button>
                  <button type="button" className="text-btn" disabled={busyAssetId === asset.id} onClick={() => void toggleArchive(asset, true)}>{busyAssetId === asset.id ? 'Đang xử lý…' : 'Lưu kho'}</button>
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
              <td>{dateText(asset.archivedAt)}</td>
              <td className="actions">
                {canUpdateAssets ? <button type="button" className="text-btn success-text" disabled={busyAssetId === asset.id} onClick={() => void toggleArchive(asset, false)}>{busyAssetId === asset.id ? 'Đang xử lý…' : 'Khôi phục'}</button> : <span className="muted">Chỉ xem</span>}
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
