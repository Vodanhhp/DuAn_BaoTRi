import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Asset } from './db'
import { listCloudAssets } from './lib/assetsCloud'

type Props = {
  client: SupabaseClient
  organizationId: string
  organizationName: string
}

const dateText = (value?: string) => value
  ? new Date(value + (value.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('vi-VN')
  : '—'

export default function CloudAssetsPanel({ client, organizationId, organizationName }: Props) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastLoadedAt, setLastLoadedAt] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await listCloudAssets(client, organizationId)
      setAssets(rows)
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

  return <section className="panel">
    <div className="panel-head">
      <div>
        <h2>Thiết bị trên Cloud</h2>
        <p>Tổ chức: {organizationName} · Dữ liệu đọc trực tiếp từ Supabase, không lấy từ IndexedDB.</p>
      </div>
      <div className="asset-photo-actions">
        <button type="button" className="soft-btn" onClick={() => void load()} disabled={loading}>
          {loading ? 'Đang tải…' : 'Tải lại dữ liệu'}
        </button>
      </div>
    </div>
    <div className="asset-result-count">
      Cloud: {assets.length} thiết bị · Đang quản lý: {active.length} · Lưu kho: {archived.length}
      {lastLoadedAt && <span> · Cập nhật lúc {lastLoadedAt}</span>}
    </div>
    {error && <div className="form-hint warning-hint" role="alert">{error}</div>}
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
    <p className="muted">Giai đoạn hiện tại chỉ đọc dữ liệu Cloud. Thêm mới, chỉnh sửa, lưu kho/khôi phục và ảnh sẽ được bật sau khi hoàn tất cấp mã an toàn và kiểm thử từng thao tác. Không có dữ liệu IndexedDB nào bị thay đổi.</p>
  </section>
}
