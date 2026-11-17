import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Asset } from './db'
import {
  createCloudAsset, getCloudAssetCodeConfig, listCloudAssets, saveCloudAssetCodeConfig,
  type AssetCodeConfig
} from './lib/assetsCloud'

type Props = {
  client: SupabaseClient
  organizationId: string
  organizationName: string
  onBack: () => void
}

const dateText = (value?: string) => value
  ? new Date(value + (value.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('vi-VN')
  : '—'
const toLines = (items: Record<string, string>) =>
  Object.entries(items).map(([name, code]) => name + '|' + code).join('\n')
const fromLines = (value: string, label: string, maxCodeLength = 5): Record<string, string> => {
  const result: Record<string, string> = {}
  for (const [index, line] of value.split('\n').entries()) {
    const clean = line.trim()
    if (!clean) continue
    const parts = clean.split('|')
    if (parts.length !== 2 || !parts[0].trim() || !new RegExp('^[A-Z0-9]{2,' + maxCodeLength + '}) {
      throw new Error(label + ': dòng ' + (index + 1) + ' phải có dạng Tên|' + 'MÃ (2–5 ký tự A-Z/0-9).')
    }
    const name = parts[0].trim()
    const code = parts[1].trim().toUpperCase()
    if (result[name]) throw new Error(label + ': tên bị lặp "' + name + '".')
    if (Object.values(result).includes(code)) throw new Error(label + ': mã bị lặp "' + code + '".')
    result[name] = code
  }
  return result
}

export default function CloudAssetsPanel({ client, organizationId, organizationName, onBack }: Props) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [lastLoadedAt, setLastLoadedAt] = useState('')
  const [config, setConfig] = useState<AssetCodeConfig | null>(null)
  const [facilityCode, setFacilityCode] = useState('')
  const [categoryLines, setCategoryLines] = useState('')
  const [locationLines, setLocationLines] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
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
        setCategoryLines(toLines(savedConfig.category_codes))
        setLocationLines(toLines(savedConfig.location_codes))
      }
      setLastLoadedAt(new Date().toLocaleString('vi-VN'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [client, organizationId])

  useEffect(() => { void load() }, [load])

  const active = assets.filter(asset => !asset.archivedAt)
  const archived = assets.filter(asset => Boolean(asset.archivedAt))
  const categoryOptions = useMemo(() => Object.keys(config?.category_codes ?? {}).sort((a, b) => a.localeCompare(b, 'vi')), [config])
  const locationOptions = useMemo(() => Object.keys(config?.location_codes ?? {}).filter(x => x !== '__UNASSIGNED__').sort((a, b) => a.localeCompare(b, 'vi')), [config])

  const saveConfig = async (event: FormEvent) => {
    event.preventDefault()
    setSavingConfig(true)
    setError('')
    setMessage('')
    try {
      const next: AssetCodeConfig = {
        facility_code: facilityCode.trim().toUpperCase(),
        category_codes: fromLines(categoryLines, 'Mã loại thiết bị'),
        location_codes: fromLines(locationLines, 'Mã vị trí', 4)
      }
      if (!next.location_codes.__UNASSIGNED__) throw new Error('Cần khai báo dòng __UNASSIGNED__|99 (hoặc mã vị trí chưa phân loại khác).')
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
      <button type="button" className="soft-btn" onClick={() => { setShowConfig(v => !v); setShowCreate(false) }}>
        {showConfig ? 'Đóng cấu hình mã' : config ? 'Cấu hình mã thiết bị' : 'Thiết lập mã thiết bị Cloud'}
      </button>
      <button type="button" className="primary-btn" disabled={!config} onClick={() => { setShowCreate(v => !v); setShowConfig(false) }}>
        {showCreate ? 'Đóng biểu mẫu' : 'Thêm thiết bị Cloud'}
      </button>
    </div>

    {showConfig && <form className="panel" onSubmit={saveConfig} style={{ marginBottom: 16 }}>
      <h3>Cấu hình mã thiết bị của {organizationName}</h3>
      <p className="muted">Mã cơ sở, mã loại và mã vị trí được lưu trên Supabase theo tổ chức, không lấy từ localStorage. Mỗi dòng danh mục có dạng Tên|MÃ.</p>
      <label>Mã cơ sở ABXY<input value={facilityCode} onChange={e => setFacilityCode(e.target.value)} placeholder="Ví dụ: HP01" required /></label>
      <label>Mã loại thiết bị ABC<textarea rows={6} value={categoryLines} onChange={e => setCategoryLines(e.target.value)} placeholder={'Máy nén khí|MNA\nMáy bơm|MB'} required /></label>
      <label>Mã vị trí BB<textarea rows={6} value={locationLines} onChange={e => setLocationLines(e.target.value)} placeholder={'Phòng máy nén khí|01\nKhu sản xuất|02\n__UNASSIGNED__|99'} required /></label>
      <p className="muted">Không đổi mã đã cấp chỉ vì đổi tên hoặc vị trí. Cần cấu hình đầy đủ trước khi tạo thiết bị. Nếu không có quyền settings.manage, Supabase sẽ từ chối lưu.</p>
      <button type="submit" className="primary-btn" disabled={savingConfig}>{savingConfig ? 'Đang lưu…' : 'Lưu cấu hình Cloud'}</button>
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

    {loading ? <p className="muted">Đang tải danh sách thiết bị từ Supabase…</p> :
      <div className="table-wrap">
        <table>
          <thead><tr><th>Mã / Tên thiết bị</th><th>Nhóm</th><th>Vị trí</th><th>Ngày sử dụng</th><th>Trạng thái</th><th>Lưu kho</th></tr></thead>
          <tbody>
            {assets.map(asset => <tr key={asset.id}>
              <td><b>{asset.code}</b><small>{asset.name}</small></td>
              <td>{asset.category}</td>
              <td>{asset.location || '—'}</td>
              <td>{dateText(asset.commissionedAt)}</td>
              <td>{asset.status}</td>
              <td>{asset.archivedAt ? 'Đã lưu kho' : 'Đang quản lý'}</td>
            </tr>)}
          </tbody>
        </table>
        {assets.length === 0 && <p className="muted">Tổ chức này chưa có thiết bị trên Cloud. Dữ liệu mẫu trong trình duyệt không được tự động đưa lên đây.</p>}
      </div>
    }
    <p className="muted">Tạo mới trên Cloud đã dùng RPC cấp mã. Chỉnh sửa, lưu kho/khôi phục và ảnh vẫn chưa bật trong giao diện. Không có dữ liệu IndexedDB nào bị thay đổi.</p>
  </section>
}
).test(parts[1].trim().toUpperCase())) {
      throw new Error(label + ': dòng ' + (index + 1) + ' phải có dạng Tên|' + 'MÃ (2–5 ký tự A-Z/0-9).')
    }
    const name = parts[0].trim()
    const code = parts[1].trim().toUpperCase()
    if (result[name]) throw new Error(label + ': tên bị lặp "' + name + '".')
    if (Object.values(result).includes(code)) throw new Error(label + ': mã bị lặp "' + code + '".')
    result[name] = code
  }
  return result
}

export default function CloudAssetsPanel({ client, organizationId, organizationName, onBack }: Props) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [lastLoadedAt, setLastLoadedAt] = useState('')
  const [config, setConfig] = useState<AssetCodeConfig | null>(null)
  const [facilityCode, setFacilityCode] = useState('')
  const [categoryLines, setCategoryLines] = useState('')
  const [locationLines, setLocationLines] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
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
        setCategoryLines(toLines(savedConfig.category_codes))
        setLocationLines(toLines(savedConfig.location_codes))
      }
      setLastLoadedAt(new Date().toLocaleString('vi-VN'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [client, organizationId])

  useEffect(() => { void load() }, [load])

  const active = assets.filter(asset => !asset.archivedAt)
  const archived = assets.filter(asset => Boolean(asset.archivedAt))
  const categoryOptions = useMemo(() => Object.keys(config?.category_codes ?? {}).sort((a, b) => a.localeCompare(b, 'vi')), [config])
  const locationOptions = useMemo(() => Object.keys(config?.location_codes ?? {}).filter(x => x !== '__UNASSIGNED__').sort((a, b) => a.localeCompare(b, 'vi')), [config])

  const saveConfig = async (event: FormEvent) => {
    event.preventDefault()
    setSavingConfig(true)
    setError('')
    setMessage('')
    try {
      const next: AssetCodeConfig = {
        facility_code: facilityCode.trim().toUpperCase(),
        category_codes: fromLines(categoryLines, 'Mã loại thiết bị'),
        location_codes: fromLines(locationLines, 'Mã vị trí')
      }
      if (!next.location_codes.__UNASSIGNED__) throw new Error('Cần khai báo dòng __UNASSIGNED__|99 (hoặc mã vị trí chưa phân loại khác).')
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
      <button type="button" className="soft-btn" onClick={() => { setShowConfig(v => !v); setShowCreate(false) }}>
        {showConfig ? 'Đóng cấu hình mã' : config ? 'Cấu hình mã thiết bị' : 'Thiết lập mã thiết bị Cloud'}
      </button>
      <button type="button" className="primary-btn" disabled={!config} onClick={() => { setShowCreate(v => !v); setShowConfig(false) }}>
        {showCreate ? 'Đóng biểu mẫu' : 'Thêm thiết bị Cloud'}
      </button>
    </div>

    {showConfig && <form className="panel" onSubmit={saveConfig} style={{ marginBottom: 16 }}>
      <h3>Cấu hình mã thiết bị của {organizationName}</h3>
      <p className="muted">Mã cơ sở, mã loại và mã vị trí được lưu trên Supabase theo tổ chức, không lấy từ localStorage. Mỗi dòng danh mục có dạng Tên|MÃ.</p>
      <label>Mã cơ sở ABXY<input value={facilityCode} onChange={e => setFacilityCode(e.target.value)} placeholder="Ví dụ: HP01" required /></label>
      <label>Mã loại thiết bị ABC<textarea rows={6} value={categoryLines} onChange={e => setCategoryLines(e.target.value)} placeholder={'Máy nén khí|MNA\nMáy bơm|MB'} required /></label>
      <label>Mã vị trí BB<textarea rows={6} value={locationLines} onChange={e => setLocationLines(e.target.value)} placeholder={'Phòng máy nén khí|01\nKhu sản xuất|02\n__UNASSIGNED__|99'} required /></label>
      <p className="muted">Không đổi mã đã cấp chỉ vì đổi tên hoặc vị trí. Cần cấu hình đầy đủ trước khi tạo thiết bị. Nếu không có quyền settings.manage, Supabase sẽ từ chối lưu.</p>
      <button type="submit" className="primary-btn" disabled={savingConfig}>{savingConfig ? 'Đang lưu…' : 'Lưu cấu hình Cloud'}</button>
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

    {loading ? <p className="muted">Đang tải danh sách thiết bị từ Supabase…</p> :
      <div className="table-wrap">
        <table>
          <thead><tr><th>Mã / Tên thiết bị</th><th>Nhóm</th><th>Vị trí</th><th>Ngày sử dụng</th><th>Trạng thái</th><th>Lưu kho</th></tr></thead>
          <tbody>
            {assets.map(asset => <tr key={asset.id}>
              <td><b>{asset.code}</b><small>{asset.name}</small></td>
              <td>{asset.category}</td>
              <td>{asset.location || '—'}</td>
              <td>{dateText(asset.commissionedAt)}</td>
              <td>{asset.status}</td>
              <td>{asset.archivedAt ? 'Đã lưu kho' : 'Đang quản lý'}</td>
            </tr>)}
          </tbody>
        </table>
        {assets.length === 0 && <p className="muted">Tổ chức này chưa có thiết bị trên Cloud. Dữ liệu mẫu trong trình duyệt không được tự động đưa lên đây.</p>}
      </div>
    }
    <p className="muted">Tạo mới trên Cloud đã dùng RPC cấp mã. Chỉnh sửa, lưu kho/khôi phục và ảnh vẫn chưa bật trong giao diện. Không có dữ liệu IndexedDB nào bị thay đổi.</p>
  </section>
}
