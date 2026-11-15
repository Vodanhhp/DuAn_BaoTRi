import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Activity, Archive, BarChart3, Building2, CalendarDays, Check, ChevronRight, ClipboardList,
  Download, FileSpreadsheet, HardDrive, LayoutDashboard, Menu, MoreHorizontal, Package,
  Plus, QrCode, Search, Settings, ShieldAlert, Trash2, UserRound, Wrench, X, ChevronDown, Image as ImageIcon
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import * as XLSX from 'xlsx'
import { db, uid, now, queueChange, type Asset, type InventoryItem, type Task, type Log } from './db'

type Page = 'dashboard' | 'assets' | 'inventory' | 'tasks' | 'logs' | 'reports' | 'settings'
const xmlEntities: Record<string, string> = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}
const xmlText = (value: string) => value.replace(/[&<>"']/g, ch => xmlEntities[ch] ?? ch)
const makeDemoAssetImage = (category: string, code: string, view: number) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f5f8f7"/><stop offset="1" stop-color="#dce8e3"/></linearGradient><linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#edf3f2"/><stop offset="1" stop-color="#879b98"/></linearGradient></defs><rect width="960" height="640" fill="url(#bg)"/><path d="M0 510H960" stroke="#c5d4ce" stroke-width="3"/><g transform="translate(${view===1?120:165},105)"><ellipse cx="360" cy="405" rx="300" ry="35" fill="#6e8980" opacity=".18"/><rect x="105" y="180" width="510" height="210" rx="28" fill="url(#metal)" stroke="#536d67" stroke-width="9"/><rect x="145" y="215" width="220" height="140" rx="16" fill="${view===1?'#287d70':'#4c789d'}"/><rect x="390" y="215" width="180" height="140" rx="12" fill="#d4dfdc" stroke="#536d67" stroke-width="6"/><circle cx="480" cy="285" r="43" fill="#f8fbfa" stroke="#536d67" stroke-width="8"/><path d="M480 250v70M445 285h70" stroke="#287d70" stroke-width="8"/><rect x="170" y="390" width="45" height="45" rx="7" fill="#344f49"/><rect x="505" y="390" width="45" height="45" rx="7" fill="#344f49"/><path d="M130 180V145h465v35" fill="none" stroke="#536d67" stroke-width="10"/><circle cx="190" cy="245" r="12" fill="#f4c66c"/><circle cx="230" cy="245" r="12" fill="#e8796d"/></g><rect x="42" y="38" width="876" height="564" rx="22" fill="none" stroke="#ffffff" stroke-width="5" opacity=".8"/><text x="58" y="78" font-family="Arial,sans-serif" font-size="25" font-weight="700" fill="#34534b">BAOTRI · ẢNH MINH HỌA THIẾT BỊ</text><text x="58" y="570" font-family="Arial,sans-serif" font-size="22" fill="#526d65">${xmlText(category)} · ${xmlText(code)} · Góc nhìn ${view}</text></svg>`
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg)
}
const today = () => new Date().toISOString().slice(0, 10)
const emptyAsset = (): Asset => ({
  id: uid(), code: '', name: '', category: 'Thiết bị điện', brand: '', model: '', serial: '',
  location: '', commissionedAt: '', power: '', cycle: '', status: 'Đang hoạt động',
  notes: '', images: [], createdAt: now(), updatedAt: now()
})
const emptyItem = (): InventoryItem => ({
  id: uid(), code: '', name: '', group: 'Vật tư điện', unit: 'Cái', quantity: 0,
  minQuantity: 0, location: '', supplier: '', unitPrice: 0, updatedAt: now()
})
const emptyTask = (): Task => ({
  id: uid(), assetId: '', title: '', dueDate: today(), frequency: 'Hàng tháng',
  status: 'Chờ thực hiện', checklist: '', readings: '', notes: '', createdAt: now(), updatedAt: now()
})
const money = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' đ'
const dateText = (s: string) => s ? new Date(s + (s.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('vi-VN') : '—'

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'asset'|'item'|'task'|'scan'|null>(null)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null)
  const [assetCategoryFilter, setAssetCategoryFilter] = useState('')
  const [assetLocationFilter, setAssetLocationFilter] = useState('')
  const [assetStatusFilter, setAssetStatusFilter] = useState('')
  const [assetSort, setAssetSort] = useState('code-asc')
  const [showArchived, setShowArchived] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [notice, setNotice] = useState('')
  const [mobileMore, setMobileMore] = useState(false)
  const assets = useLiveQuery(() => db.assets.orderBy('name').toArray(), []) ?? []
  const activeAssets = assets.filter(a => !a.archivedAt)
  const archivedAssets = assets.filter(a => !!a.archivedAt)
  const inventory = useLiveQuery(() => db.inventory.orderBy('name').toArray(), []) ?? []
  const tasks = useLiveQuery(() => db.tasks.orderBy('dueDate').toArray(), []) ?? []
  const logs = useLiveQuery(() => db.logs.orderBy('date').reverse().toArray(), []) ?? []
  const queueCount = useLiveQuery(() => db.syncQueue.count(), []) ?? 0

  useEffect(() => {
    const seed = async () => {
      // 30 hồ sơ thiết bị mẫu; đối chiếu theo mã để không tạo trùng khi tải lại.
      const demoAssets = [
        { code: 'COMP-001', name: 'Máy nén khí trục vít số 1', category: 'Máy nén khí', brand: 'Atlas Copco', model: 'GA22', location: 'Phòng máy nén khí', commissionedAt: '2023-05-10', power: '22 kW', cycle: 'Hàng tháng' },
        { code: 'KHO-001', name: 'Kho lạnh bảo quản số 1', category: 'Kho lạnh', brand: 'Bitzer', model: 'Cụm lạnh 1', location: 'Khu sản xuất', commissionedAt: '2022-08-01', power: '18 kW', cycle: 'Hàng ngày' },
        { code: 'BOM-001', name: 'Bơm cấp nước sinh hoạt số 1', category: 'Máy bơm', brand: 'Pentax', model: 'CM 50', location: 'Phòng bơm tầng hầm', commissionedAt: '2022-03-15', power: '5.5 kW', cycle: 'Hàng tháng' },
        { code: 'BOM-002', name: 'Bơm cấp nước sinh hoạt dự phòng', category: 'Máy bơm', brand: 'Pentax', model: 'CM 50', location: 'Phòng bơm tầng hầm', commissionedAt: '2022-03-15', power: '5.5 kW', cycle: 'Hàng tháng' },
        { code: 'BOM-003', name: 'Bơm tăng áp khu sản xuất', category: 'Máy bơm', brand: 'Ebara', model: '3M 50-160', location: 'Khu sản xuất', commissionedAt: '2021-11-20', power: '7.5 kW', cycle: 'Hàng tháng' },
        { code: 'MOT-001', name: 'Động cơ băng tải cấp liệu', category: 'Động cơ điện', brand: 'Siemens', model: '1LE100', location: 'Dây chuyền 1', commissionedAt: '2023-01-12', power: '4 kW', cycle: 'Hàng quý' },
        { code: 'MOT-002', name: 'Động cơ quạt hút bụi', category: 'Động cơ điện', brand: 'ABB', model: 'M2BAX', location: 'Khu xử lý bụi', commissionedAt: '2022-06-08', power: '11 kW', cycle: 'Hàng quý' },
        { code: 'FAN-001', name: 'Quạt thông gió nhà xưởng số 1', category: 'Quạt công nghiệp', brand: 'Deton', model: 'DF-600', location: 'Nhà xưởng A', commissionedAt: '2021-09-18', power: '2.2 kW', cycle: 'Hàng quý' },
        { code: 'FAN-002', name: 'Quạt hút khí khu hóa chất', category: 'Quạt công nghiệp', brand: 'Kruger', model: 'KAT-500', location: 'Khu kỹ thuật', commissionedAt: '2022-02-10', power: '3 kW', cycle: 'Hàng tháng' },
        { code: 'AHU-001', name: 'AHU cấp gió tầng 1', category: 'Điều hòa thông gió', brand: 'Daikin', model: 'AHU-01', location: 'Phòng kỹ thuật tầng 1', commissionedAt: '2020-07-01', power: '15 kW', cycle: 'Hàng tháng' },
        { code: 'FCU-001', name: 'FCU khu văn phòng', category: 'Điều hòa thông gió', brand: 'Daikin', model: 'FXFQ', location: 'Tầng 2', commissionedAt: '2021-04-22', power: '2.1 kW', cycle: 'Hàng quý' },
        { code: 'CHL-001', name: 'Máy làm lạnh nước Chiller', category: 'Chiller', brand: 'Trane', model: 'CGAM', location: 'Khu vực Chiller', commissionedAt: '2020-05-16', power: '110 kW', cycle: 'Hàng tháng' },
        { code: 'CTW-001', name: 'Tháp giải nhiệt số 1', category: 'Tháp giải nhiệt', brand: 'Liang Chi', model: 'LBC-100', location: 'Sân kỹ thuật mái', commissionedAt: '2020-05-16', power: '5.5 kW', cycle: 'Hàng tháng' },
        { code: 'GEN-001', name: 'Máy phát điện dự phòng', category: 'Máy phát điện', brand: 'Cummins', model: 'C150D5', location: 'Phòng máy phát điện', commissionedAt: '2019-12-05', power: '150 kVA', cycle: 'Hàng tuần' },
        { code: 'ATS-001', name: 'Tủ chuyển nguồn tự động ATS', category: 'Tủ điện', brand: 'Schneider', model: 'ATyS', location: 'Phòng điện tổng', commissionedAt: '2019-12-05', power: '400 A', cycle: 'Hàng quý' },
        { code: 'MDB-001', name: 'Tủ điện phân phối tổng MDB', category: 'Tủ điện', brand: 'Schneider', model: 'Prisma', location: 'Phòng điện tổng', commissionedAt: '2019-12-05', power: '630 A', cycle: 'Hàng quý' },
        { code: 'DB-001', name: 'Tủ điện phân phối tầng 1', category: 'Tủ điện', brand: 'LS', model: 'DB-01', location: 'Tầng 1', commissionedAt: '2020-01-10', power: '100 A', cycle: '6 tháng' },
        { code: 'VFD-001', name: 'Biến tần điều khiển bơm nước', category: 'Biến tần', brand: 'INVT', model: 'GD200A', location: 'Phòng bơm', commissionedAt: '2022-10-14', power: '7.5 kW', cycle: 'Hàng quý' },
        { code: 'VFD-002', name: 'Biến tần điều khiển quạt hút', category: 'Biến tần', brand: 'Mitsubishi', model: 'FR-E800', location: 'Nhà xưởng A', commissionedAt: '2023-02-19', power: '3.7 kW', cycle: 'Hàng quý' },
        { code: 'UPS-001', name: 'Bộ lưu điện phòng máy chủ', category: 'UPS', brand: 'APC', model: 'Easy UPS', location: 'Phòng IT', commissionedAt: '2021-08-12', power: '6 kVA', cycle: 'Hàng tháng' },
        { code: 'TRF-001', name: 'Máy biến áp hạ thế', category: 'Máy biến áp', brand: 'THIBIDI', model: '560 kVA', location: 'Trạm biến áp', commissionedAt: '2018-06-30', power: '560 kVA', cycle: 'Hàng năm' },
        { code: 'CAP-001', name: 'Tủ tụ bù công suất phản kháng', category: 'Tủ điện', brand: 'Mikro', model: 'PFR-12', location: 'Phòng điện tổng', commissionedAt: '2020-09-01', power: '200 kVAr', cycle: '6 tháng' },
        { code: 'BOI-001', name: 'Nồi hơi cấp nhiệt', category: 'Nồi hơi', brand: 'Cleaver-Brooks', model: 'CB-100', location: 'Nhà lò hơi', commissionedAt: '2019-03-20', power: '1 tấn/giờ', cycle: 'Hàng tháng' },
        { code: 'DRY-001', name: 'Máy sấy khí nén', category: 'Máy sấy khí', brand: 'Sullair', model: 'SRD-30', location: 'Phòng máy nén khí', commissionedAt: '2023-05-10', power: '1.2 kW', cycle: 'Hàng tháng' },
        { code: 'FLT-001', name: 'Bộ lọc khí nén đường chính', category: 'Khí nén', brand: 'SMC', model: 'AFF', location: 'Phòng máy nén khí', commissionedAt: '2023-05-10', power: 'DN50', cycle: 'Hàng tháng' },
        { code: 'WLD-001', name: 'Máy hàn điện bảo trì', category: 'Thiết bị xưởng', brand: 'Jasic', model: 'ARC-250', location: 'Xưởng bảo trì', commissionedAt: '2021-12-02', power: '250 A', cycle: '6 tháng' },
        { code: 'LFT-001', name: 'Thang máy chở người số 1', category: 'Thang máy', brand: 'Mitsubishi', model: 'NEXIEZ', location: 'Sảnh chính', commissionedAt: '2020-02-15', power: '15 kW', cycle: 'Hàng tháng' },
        { code: 'FIR-001', name: 'Bơm chữa cháy điện', category: 'Phòng cháy chữa cháy', brand: 'Ebara', model: 'FSA', location: 'Phòng bơm PCCC', commissionedAt: '2020-02-15', power: '30 kW', cycle: 'Hàng tuần' },
        { code: 'SEN-001', name: 'Cảm biến áp suất đường khí', category: 'Thiết bị đo lường', brand: 'WIKA', model: 'A-10', location: 'Đường ống khí nén', commissionedAt: '2023-05-10', power: '0–10 bar', cycle: 'Hàng quý' },
        { code: 'PMP-001', name: 'Bơm thoát nước hố gom', category: 'Máy bơm', brand: 'Tsurumi', model: 'PU-series', location: 'Hố gom tầng hầm', commissionedAt: '2021-07-11', power: '1.5 kW', cycle: 'Hàng tháng' }
      ]
      const existing = await db.assets.toArray()
      const existingCodes = new Set(existing.map(a => a.code))
      const missing = demoAssets.filter(a => !existingCodes.has(a.code)).map(a => ({
        ...emptyAsset(), ...a, serial: `DEMO-${a.code}`,
        images: [makeDemoAssetImage(a.category, a.code, 1), makeDemoAssetImage(a.category, a.code, 2)],
        notes: 'DỮ LIỆU MẪU – ảnh minh họa kỹ thuật, không phải ảnh thực tế của thiết bị.'
      }))
      if (missing.length) await db.assets.bulkAdd(missing)
      // Bổ sung ảnh minh họa cho hồ sơ demo cũ; không ghi đè ảnh người dùng đã tải lên.
      const demoRows = (await db.assets.toArray()).filter(a => a.serial?.startsWith('DEMO-') || a.notes?.includes('DỮ LIỆU MẪU'))
      const demoWithoutPhotos = demoRows.filter(a => !Array.isArray(a.images) || a.images.length === 0)
      if (demoWithoutPhotos.length) await db.assets.bulkPut(demoWithoutPhotos.map(a => ({
        ...a,
        images: [makeDemoAssetImage(a.category, a.code, 1), makeDemoAssetImage(a.category, a.code, 2)],
        notes: 'DỮ LIỆU MẪU – ảnh minh họa kỹ thuật, không phải ảnh thực tế của thiết bị.'
      })))
      const legacyAssets = (await db.assets.toArray()).filter(a => !Array.isArray(a.images))
      if (legacyAssets.length) await db.assets.bulkPut(legacyAssets.map(a => ({ ...a, images: [] })))

      const compressor = await db.assets.where('code').equals('COMP-001').first()
      const coldStore = await db.assets.where('code').equals('KHO-001').first()
      if (!(await db.inventory.count())) {
        const item = { ...emptyItem(), code: 'VT-001', name: 'Lọc dầu máy nén khí', quantity: 3, minQuantity: 5, unit: 'Bộ' }
        await db.inventory.add(item)
      }
      if (!(await db.tasks.count())) {
        const t1 = { ...emptyTask(), assetId: compressor?.id ?? '', title: 'Kiểm tra máy nén khí định kỳ', dueDate: today(), frequency: 'Hàng tháng', checklist: 'Kiểm tra rò rỉ\\nKiểm tra áp suất\\nKiểm tra nhiệt độ dầu' }
        const t2 = { ...emptyTask(), assetId: coldStore?.id ?? '', title: 'Ghi nhận nhiệt độ kho lạnh', dueDate: today(), frequency: 'Hàng ngày', checklist: 'Ghi nhiệt độ hiển thị\\nKiểm tra cửa kho\\nKiểm tra tình trạng dàn lạnh' }
        await db.tasks.bulkPut([t1, t2])
      }
    }
    seed()
  }, [])

  const assetCategories = useMemo(() => [...new Set(activeAssets.map(a => a.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')), [activeAssets])
  const assetLocations = useMemo(() => [...new Set(activeAssets.map(a => a.location).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')), [activeAssets])
  const filteredAssets = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi')
    return activeAssets.filter(a =>
      [a.code, a.name, a.category, a.location].join(' ').toLocaleLowerCase('vi').includes(query) &&
      (!assetCategoryFilter || a.category === assetCategoryFilter) &&
      (!assetLocationFilter || a.location === assetLocationFilter) &&
      (!assetStatusFilter || a.status === assetStatusFilter)
    ).sort((a,b) => {
      if (assetSort === 'code-desc') return b.code.localeCompare(a.code,'vi')
      if (assetSort === 'name-asc') return a.name.localeCompare(b.name,'vi')
      if (assetSort === 'date-newest') return (b.commissionedAt || '').localeCompare(a.commissionedAt || '')
      if (assetSort === 'date-oldest') return (a.commissionedAt || '').localeCompare(b.commissionedAt || '')
      return a.code.localeCompare(b.code,'vi')
    })
  }, [activeAssets, search, assetCategoryFilter, assetLocationFilter, assetStatusFilter, assetSort])
  const filteredArchivedAssets = useMemo(() => archivedAssets.filter(a => `${a.code} ${a.name} ${a.category} ${a.location}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))), [archivedAssets, search])
  const filteredItems = useMemo(() => inventory.filter(a => `${a.code} ${a.name} ${a.group}`.toLowerCase().includes(search.toLowerCase())), [inventory, search])
  const filteredTasks = useMemo(() => tasks.filter(t => `${t.title} ${assets.find(a=>a.id===t.assetId)?.name ?? ''}`.toLowerCase().includes(search.toLowerCase())), [tasks, assets, search])
  const overdue = tasks.filter(t => t.status !== 'Hoàn thành' && t.dueDate < today()).length
  const dueToday = tasks.filter(t => t.dueDate === today() && t.status !== 'Hoàn thành')
  const lowStock = inventory.filter(i => i.quantity <= i.minQuantity)

  const flash = (s: string) => { setNotice(s); setTimeout(() => setNotice(''), 2800) }
  const saveAsset = async (a: Asset) => {
    const value = { ...a, images: a.images ?? [], updatedAt: now() }
    await db.assets.put(value); await queueChange('assets', value.id); setModal(null); setEditingAsset(null); flash('Đã lưu thiết bị')
  }
  const saveItem = async (i: InventoryItem) => {
    const value = { ...i, updatedAt: now() }
    await db.inventory.put(value); await queueChange('inventory', value.id); setModal(null); setEditingItem(null); flash('Đã lưu vật tư')
  }
  const saveTask = async (t: Task) => {
    const value = { ...t, updatedAt: now() }
    await db.tasks.put(value); await queueChange('tasks', value.id); setModal(null); setEditingTask(null); flash('Đã lưu công việc')
  }
  const completeTask = async (t: Task) => {
    const completed = { ...t, status: 'Hoàn thành' as const, completedAt: now(), updatedAt: now() }
    await db.transaction('rw', db.tasks, db.logs, async () => {
      await db.tasks.put(completed)
      await db.logs.add({ id: uid(), assetId: t.assetId, taskId: t.id, date: today(), kind: 'Bảo trì định kỳ', description: t.title, parts: '', readings: t.readings, performedBy: 'Người sử dụng' })
    })
    await queueChange('tasks', t.id); flash('Đã ghi nhận hoàn thành')
  }
  const archiveAsset = async (a: Asset) => {
    if (!confirm(`Đưa “${a.name}” vào Lưu kho? Hồ sơ, ảnh và lịch sử liên quan vẫn được giữ để tra cứu hoặc khôi phục.`)) return
    const value = { ...a, archivedAt: now(), updatedAt: now() }
    await db.assets.put(value); await queueChange('assets', a.id); flash('Đã đưa thiết bị vào Lưu kho')
  }
  const restoreAsset = async (a: Asset) => {
    const value = { ...a, archivedAt: undefined, updatedAt: now() }
    await db.assets.put(value); await queueChange('assets', a.id); flash('Đã khôi phục thiết bị khỏi Lưu kho')
  }
  const addMovement = async (item: InventoryItem, type: 'Nhập'|'Xuất', qty: number) => {
    if (!qty || qty <= 0) return
    if (type === 'Xuất' && qty > item.quantity) { flash('Số lượng xuất vượt tồn kho'); return }
    const next = { ...item, quantity: item.quantity + (type === 'Nhập' ? qty : -qty), updatedAt: now() }
    await db.transaction('rw', db.inventory, db.movements, async () => {
      await db.inventory.put(next)
      await db.movements.add({ id: uid(), itemId: item.id, date: today(), type, quantity: qty, reason: 'Thao tác từ màn hình kho' })
    })
    await queueChange('inventory', item.id); flash(`Đã ${type.toLowerCase()} ${qty} ${item.unit}`)
  }
  const exportRows = (rows: object[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Du lieu')
    XLSX.writeFile(wb, filename)
  }
  const exportAssets = () => exportRows(assets.map(a => ({ 'Mã thiết bị':a.code,'Tên thiết bị':a.name,'Nhóm':a.category,'Hãng':a.brand,'Model':a.model,'Serial':a.serial,'Vị trí':a.location,'Ngày sử dụng':a.commissionedAt,'Công suất':a.power,'Chu kỳ':a.cycle,'Trạng thái':a.status,'Ghi chú':a.notes })), 'danh-muc-thiet-bi.xlsx')
  const exportInventory = () => exportRows(inventory.map(i => ({ 'Mã vật tư':i.code,'Tên vật tư':i.name,'Nhóm':i.group,'ĐVT':i.unit,'Tồn':i.quantity,'Tồn tối thiểu':i.minQuantity,'Vị trí':i.location,'Nhà cung cấp':i.supplier,'Đơn giá':i.unitPrice })), 'ton-kho-vat-tu.xlsx')
  const exportTasks = () => exportRows(tasks.map(t => ({ 'Thiết bị':assets.find(a=>a.id===t.assetId)?.name ?? '', 'Công việc':t.title,'Ngày đến hạn':t.dueDate,'Chu kỳ':t.frequency,'Trạng thái':t.status,'Checklist':t.checklist,'Thông số':t.readings,'Ghi chú':t.notes })), 'ke-hoach-bao-tri.xlsx')
  const exportLogs = () => exportRows(logs.map(l => ({ 'Ngày':l.date,'Thiết bị':assets.find(a=>a.id===l.assetId)?.name ?? '', 'Loại':l.kind,'Nội dung':l.description,'Thông số':l.readings,'Vật tư':l.parts,'Người thực hiện':l.performedBy })), 'nhat-ky-bao-tri.xlsx')
  const backup = async () => {
    const data = { assets: await db.assets.toArray(), inventory: await db.inventory.toArray(), tasks: await db.tasks.toArray(), logs: await db.logs.toArray(), movements: await db.movements.toArray() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `backup-baotri-${today()}.json`; a.click(); URL.revokeObjectURL(url)
  }
  const restore = async (file: File) => {
    try {
      const data = JSON.parse(await file.text())
      await db.transaction('rw', db.assets, db.inventory, db.tasks, db.logs, db.movements, async () => {
        await db.assets.bulkPut(data.assets ?? []); await db.inventory.bulkPut(data.inventory ?? [])
        await db.tasks.bulkPut(data.tasks ?? []); await db.logs.bulkPut(data.logs ?? []); await db.movements.bulkPut(data.movements ?? [])
      })
      flash('Đã nhập dữ liệu sao lưu')
    } catch { flash('File sao lưu không hợp lệ') }
  }

  const nav = [
    ['dashboard','Tổng quan',LayoutDashboard], ['assets','Thiết bị',HardDrive], ['inventory','Kho vật tư',Package],
    ['tasks','Kế hoạch bảo trì',CalendarDays], ['logs','Nhật ký',ClipboardList], ['reports','Báo cáo',BarChart3], ['settings','Cài đặt',Settings]
  ] as const

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><Wrench size={21}/></div><div><b>BAOTRI</b><small>QUẢN LÝ BẢO TRÌ</small></div></div>
      <div className="nav-label">MENU CHÍNH</div>
      {nav.map(([key,label,Icon]) => <button key={key} className={`nav-item ${page===key?'active':''}`} onClick={()=>{setPage(key);setSearch('')}}><Icon size={18}/><span>{label}</span>{key==='tasks' && overdue>0 && <em>{overdue}</em>}</button>)}
      <div className="sidebar-bottom"><div className="offline-pill"><span className="online-dot"/> Bản thử nghiệm · Dữ liệu lưu cục bộ</div><small>Phiên bản 0.1.0</small></div>
    </aside>
    <nav className="mobile-nav" aria-label="Điều hướng chính">
      {([['dashboard','Tổng quan',LayoutDashboard],['assets','Thiết bị',HardDrive],['inventory','Kho',Package],['tasks','Bảo trì',CalendarDays]] as const).map(([key,label,Icon]) =>
        <button key={key} className={`mobile-nav-item ${page===key?'active':''}`} onClick={()=>{setPage(key);setSearch('');setMobileMore(false)}}><Icon size={19}/><span>{label}</span>{key==='tasks'&&overdue>0&&<i>{overdue}</i>}</button>
      )}
      <button className={`mobile-nav-item ${mobileMore||(['logs','reports','settings'] as Page[]).includes(page)?'active':''}`} onClick={()=>setMobileMore(v=>!v)}><MoreHorizontal size={20}/><span>Thêm</span></button>
    </nav>
    <main className="main">
      <header className="topbar">
        <div className="page-heading"><div className="eyebrow">HỆ THỐNG QUẢN LÝ KỸ THUẬT</div><h1>{nav.find(n=>n[0]===page)?.[1]}</h1></div>
        <div className="top-actions">
          <div className="workspace-chip"><Building2 size={16}/><span><b>Đơn vị của tôi</b><small>Không gian cá nhân</small></span></div>
          <button className="icon-btn" title="Quét QR" onClick={()=>setModal('scan')}><QrCode size={19}/></button>
          <button className="primary-btn" onClick={()=>{ if(page==='assets'){setEditingAsset(emptyAsset());setModal('asset')} else if(page==='inventory'){setEditingItem(emptyItem());setModal('item')} else if(page==='tasks'){setEditingTask(emptyTask());setModal('task')} else {setPage('assets');setEditingAsset(emptyAsset());setModal('asset')} }}><Plus size={17}/><span>Thêm mới</span></button>
          <button className="profile-chip" title="Tài khoản mẫu"><span className="avatar"><UserRound size={16}/></span><span className="profile-text"><b>Người dùng</b><small>Quản trị viên</small></span></button>
        </div>
      </header>
      <div className="content">
        {page!=='dashboard' && page!=='settings' && <div className="searchbar"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm theo mã, tên hoặc nội dung..."/></div>}
        {page==='dashboard' && <Dashboard assets={activeAssets} tasks={tasks} dueToday={dueToday} lowStock={lowStock} overdue={overdue} go={setPage} complete={completeTask}/>}
        {page==='assets' && <section className="panel"><div className="panel-head"><div><h2>{showArchived?'Thiết bị đã lưu kho':'Danh mục thiết bị'}</h2><p>{showArchived?'Hồ sơ được giữ lại để tra cứu hoặc khôi phục':'Quản lý lý lịch, mã QR, ảnh và tình trạng thiết bị'}</p></div><div className="asset-toolbar">
            <button className={!showArchived?'soft-btn':'text-btn'} onClick={()=>setShowArchived(false)}>Đang hoạt động ({activeAssets.length})</button>
            <button className={showArchived?'soft-btn':'text-btn'} onClick={()=>setShowArchived(true)}><Archive size={15}/> Lưu kho ({archivedAssets.length})</button>
            {!showArchived&&<details className="asset-filter-menu"><summary><ChevronDown size={15}/> Lọc & sắp xếp</summary><div className="asset-filter-popover">
              <label>Nhóm thiết bị<select value={assetCategoryFilter} onChange={e=>setAssetCategoryFilter(e.target.value)}><option value="">Tất cả nhóm</option>{assetCategories.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
              <label>Vị trí<select value={assetLocationFilter} onChange={e=>setAssetLocationFilter(e.target.value)}><option value="">Tất cả vị trí</option>{assetLocations.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
              <label>Trạng thái<select value={assetStatusFilter} onChange={e=>setAssetStatusFilter(e.target.value)}><option value="">Tất cả trạng thái</option>{['Đang hoạt động','Ngừng hoạt động','Thanh lý'].map(x=><option key={x}>{x}</option>)}</select></label>
              <label>Sắp xếp<select value={assetSort} onChange={e=>setAssetSort(e.target.value)}><option value="code-asc">Mã thiết bị: A → Z</option><option value="code-desc">Mã thiết bị: Z → A</option><option value="name-asc">Tên thiết bị: A → Z</option><option value="date-newest">Ngày sử dụng: mới nhất</option><option value="date-oldest">Ngày sử dụng: cũ nhất</option></select></label>
              <button type="button" className="text-btn" onClick={()=>{setAssetCategoryFilter('');setAssetLocationFilter('');setAssetStatusFilter('');setAssetSort('code-asc')}}>Đặt lại bộ lọc</button>
            </div></details>}
            {!showArchived&&<button className="soft-btn" onClick={exportAssets}><Download size={16}/> Xuất Excel</button>}
          </div></div>
          <div className="asset-result-count">{showArchived?'Đang lưu kho: '+filteredArchivedAssets.length+'/'+archivedAssets.length+' thiết bị':'Hiển thị '+filteredAssets.length+'/'+activeAssets.length+' thiết bị đang hoạt động'}</div>
          <div className="table-wrap"><table><thead><tr><th>Mã / Tên thiết bị</th><th>Nhóm</th><th>Vị trí</th><th>Ngày sử dụng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
          {(showArchived?filteredArchivedAssets:filteredAssets).map(a=><tr key={a.id}><td><button className="asset-name-link" onClick={()=>setDetailAsset(a)}><b>{a.code}</b><small>{a.name}</small></button></td><td>{a.category}</td><td>{a.location||'—'}</td><td>{dateText(a.commissionedAt)}</td><td><span className={'status '+(a.archivedAt?'gray':a.status==='Đang hoạt động'?'green':'gray')}>{a.archivedAt?'Đã lưu kho':a.status}</span></td><td className="actions">{showArchived?<><button className="text-btn success-text" onClick={()=>restoreAsset(a)}>Khôi phục</button><button className="text-btn danger" title="Chỉ Admin sau khi có xác thực máy chủ" disabled><Trash2 size={14}/> Xóa vĩnh viễn</button></>:<><button className="text-btn" onClick={()=>{setEditingAsset({...a,images:a.images??[]});setModal('asset')}}>Sửa / QR</button><button className="icon-btn" title="Lưu kho" onClick={()=>archiveAsset(a)}><Archive size={15}/></button></>}</td></tr>)}
          </tbody></table>{(showArchived?filteredArchivedAssets:filteredAssets).length===0&&<Empty text={showArchived?'Chưa có thiết bị nào trong Lưu kho.':'Chưa có thiết bị phù hợp.'}/>}</div>
          {showArchived&&<p className="archive-security-note">Xóa vĩnh viễn sẽ chỉ mở khi BAOTRI có đăng nhập và xác thực Admin ở máy chủ. Bản thử nghiệm lưu cục bộ chưa có bảo mật tài khoản thật.</p>}
        </section>}
        {page==='inventory' && <section className="panel"><div className="panel-head"><div><h2>Kho vật tư</h2><p>Nhập xuất tồn và cảnh báo mức tồn tối thiểu</p></div><button className="soft-btn" onClick={exportInventory}><Download size={16}/> Xuất Excel</button></div>
          <div className="table-wrap"><table><thead><tr><th>Mã / Tên vật tư</th><th>Nhóm</th><th>Tồn kho</th><th>Tồn tối thiểu</th><th>Vị trí</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
          {filteredItems.map(i=><tr key={i.id}><td><b>{i.code}</b><small>{i.name}</small></td><td>{i.group}</td><td><b>{i.quantity} {i.unit}</b></td><td>{i.minQuantity} {i.unit}</td><td>{i.location||'—'}</td><td><span className={`status ${i.quantity<=i.minQuantity?'red':'green'}`}>{i.quantity<=i.minQuantity?'Sắp hết':'Đủ tồn'}</span></td><td className="actions"><button className="text-btn" onClick={()=>addMovement(i,'Nhập',Number(prompt('Số lượng nhập?','1')))}>Nhập</button><button className="text-btn" onClick={()=>addMovement(i,'Xuất',Number(prompt('Số lượng xuất?','1')))}>Xuất</button><button className="text-btn" onClick={()=>{setEditingItem(i);setModal('item')}}>Sửa</button></td></tr>)}
          </tbody></table>{filteredItems.length===0&&<Empty text="Chưa có vật tư."/ >}</div></section>}
        {page==='tasks' && <section className="panel"><div className="panel-head"><div><h2>Kế hoạch và công việc bảo trì</h2><p>Danh sách công việc, hạn thực hiện và tiến độ</p></div><button className="soft-btn" onClick={exportTasks}><Download size={16}/> Xuất Excel</button></div>
          <div className="table-wrap"><table><thead><tr><th>Ngày đến hạn</th><th>Thiết bị</th><th>Công việc</th><th>Chu kỳ</th><th>Trạng thái</th><th></th></tr></thead><tbody>
          {filteredTasks.map(t=><tr key={t.id}><td>{dateText(t.dueDate)}</td><td>{assets.find(a=>a.id===t.assetId)?.name??'Chưa gắn thiết bị'}</td><td><b>{t.title}</b><small>{t.checklist.split('\n').filter(Boolean).length} mục checklist</small></td><td>{t.frequency}</td><td><span className={`status ${t.status==='Hoàn thành'?'green':t.dueDate<today()?'red':'orange'}`}>{t.status==='Hoàn thành'?'Hoàn thành':t.dueDate<today()?'Quá hạn':t.status}</span></td><td className="actions"><button className="text-btn" onClick={()=>{setEditingTask(t);setModal('task')}}>Chi tiết</button>{t.status!=='Hoàn thành'&&<button className="text-btn success-text" onClick={()=>completeTask(t)}>Hoàn thành</button>}</td></tr>)}
          </tbody></table>{filteredTasks.length===0&&<Empty text="Chưa có công việc."/ >}</div></section>}
        {page==='logs' && <section className="panel"><div className="panel-head"><div><h2>Nhật ký bảo trì, sửa chữa</h2><p>Lịch sử công việc đã ghi nhận</p></div><button className="soft-btn" onClick={exportLogs}><Download size={16}/> Xuất Excel</button></div>
          <div className="table-wrap"><table><thead><tr><th>Ngày</th><th>Thiết bị</th><th>Loại công việc</th><th>Nội dung</th><th>Thông số</th><th>Người thực hiện</th></tr></thead><tbody>{logs.map(l=><tr key={l.id}><td>{dateText(l.date)}</td><td>{assets.find(a=>a.id===l.assetId)?.name??'—'}</td><td>{l.kind}</td><td>{l.description}</td><td>{l.readings||'—'}</td><td>{l.performedBy}</td></tr>)}</tbody></table>{logs.length===0&&<Empty text="Chưa có nhật ký."/ >}</div></section>}
        {page==='reports' && <div className="report-grid">
          <ReportCard icon={<HardDrive/>} title="Danh mục thiết bị" desc="Lý lịch và trạng thái toàn bộ thiết bị" action={exportAssets}/>
          <ReportCard icon={<Package/>} title="Tồn kho vật tư" desc="Số lượng tồn và mức tối thiểu" action={exportInventory}/>
          <ReportCard icon={<CalendarDays/>} title="Kế hoạch bảo trì" desc="Công việc đến hạn và trạng thái" action={exportTasks}/>
          <ReportCard icon={<ClipboardList/>} title="Nhật ký bảo trì" desc="Lịch sử công việc đã ghi nhận" action={exportLogs}/>
          <div className="panel report-note"><ShieldAlert/><div><b>Lưu ý về dữ liệu</b><p>Báo cáo lấy từ dữ liệu đang có trên thiết bị này. Hãy sao lưu định kỳ trong mục Cài đặt.</p></div></div>
        </div>}
        {page==='settings' && <div className="settings-grid">
          <section className="panel"><div className="panel-head"><div><h2>Dữ liệu và sao lưu</h2><p>Phiên bản thử nghiệm lưu dữ liệu cục bộ trong trình duyệt này</p></div><HardDrive/></div>
            <div className="setting-row"><div><b>Xuất bản sao lưu</b><small>Tải thiết bị, vật tư, công việc và nhật ký thành JSON.</small></div><button className="primary-btn" onClick={backup}><Download size={16}/> Sao lưu</button></div>
            <div className="setting-row"><div><b>Khôi phục bản sao lưu</b><small>Nhập file JSON đã xuất từ ứng dụng.</small></div><label className="soft-btn file-btn">Chọn file<input type="file" accept=".json,application/json" onChange={e=>e.target.files?.[0]&&restore(e.target.files[0])}/></label></div>
            <div className="setting-row"><div><b>Trạng thái đồng bộ</b><small>{queueCount} thay đổi đang chờ. Chưa kết nối máy chủ cloud ở phiên bản này.</small></div><span className="status orange">Chỉ lưu cục bộ</span></div>
          </section>
          <section className="panel"><h2>Thông tin phiên bản</h2><p className="muted">BAOTRI PWA · 0.1.0</p><p>Đây là bộ khung chạy thử để cùng hoàn thiện nghiệp vụ. Dữ liệu nằm trong trình duyệt trên thiết bị hiện tại.</p><p className="warning-box">Không dùng dữ liệu này làm hồ sơ bảo trì chính thức trước khi thiết lập máy chủ, sao lưu và kiểm thử đồng bộ.</p></section>
        </div>}
      </div>
    </main>
    {mobileMore&&<div className="mobile-more-backdrop" onClick={()=>setMobileMore(false)}><div className="mobile-more-menu" onClick={e=>e.stopPropagation()}>
      <div className="mobile-more-title">Chức năng khác</div>
      {([['logs','Nhật ký',ClipboardList],['reports','Báo cáo',BarChart3],['settings','Cài đặt',Settings]] as const).map(([key,label,Icon])=><button key={key} onClick={()=>{setPage(key);setSearch('');setMobileMore(false)}}><Icon size={18}/>{label}<ChevronRight size={16}/></button>)}
    </div></div>}
    {notice&&<div className="toast"><Check size={17}/>{notice}</div>}
    {detailAsset&&<AssetDetailModal value={detailAsset} close={()=>setDetailAsset(null)} edit={()=>{setEditingAsset({...detailAsset,images:detailAsset.images??[]});setDetailAsset(null);setModal('asset')}}/>}
    {modal==='asset'&&editingAsset&&<AssetModal value={editingAsset} close={()=>{setModal(null);setEditingAsset(null)}} save={saveAsset}/>}
    {modal==='item'&&editingItem&&<ItemModal value={editingItem} close={()=>{setModal(null);setEditingItem(null)}} save={saveItem}/>}
    {modal==='task'&&editingTask&&<TaskModal value={editingTask} assets={assets} close={()=>{setModal(null);setEditingTask(null)}} save={saveTask}/>}
    {modal==='scan'&&<ScanModal close={()=>setModal(null)} assets={assets} openAsset={(a: Asset)=>{setEditingAsset(a);setModal('asset')}}/>}
  </div>
}

function Dashboard({assets,tasks,dueToday,lowStock,overdue,go,complete}:any) {
  const completed = tasks.filter((t:Task)=>t.status==='Hoàn thành').length
  return <div className="dashboard">
    <div className="welcome"><div><div className="eyebrow light">BẢNG ĐIỀU KHIỂN</div><h2>Chào bạn, hôm nay cần bảo trì gì?</h2><p>{new Date().toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})} · Theo dõi thiết bị và công việc tại một nơi.</p></div><div className="welcome-icon"><Activity size={42}/></div></div>
    <div className="stat-grid">
      <Stat icon={<HardDrive/>} label="Tổng thiết bị" value={assets.length} hint="Hồ sơ thiết bị" color="blue"/>
      <Stat icon={<CalendarDays/>} label="Việc cần làm hôm nay" value={dueToday.length} hint="Đến hạn hôm nay" color="orange"/>
      <Stat icon={<ShieldAlert/>} label="Công việc quá hạn" value={overdue} hint="Cần theo dõi" color="red"/>
      <Stat icon={<Package/>} label="Vật tư sắp hết" value={lowStock.length} hint="Dưới mức tối thiểu" color="purple"/>
    </div>
    <div className="dash-columns">
      <section className="panel"><div className="panel-head"><div><h2>Công việc hôm nay</h2><p>Tick hoàn thành sau khi thực hiện và ghi nhận kết quả</p></div><button className="link-btn" onClick={()=>go('tasks')}>Xem tất cả <ChevronRight size={15}/></button></div>
        {dueToday.length===0?<Empty text="Không có công việc đến hạn hôm nay."/>:dueToday.map((t:Task)=><div className="task-row" key={t.id}><div className="task-icon"><Wrench size={17}/></div><div className="task-info"><b>{t.title}</b><small>{assets.find((a:Asset)=>a.id===t.assetId)?.name??'Chưa gắn thiết bị'} · {t.frequency}</small></div><button className="complete-btn" onClick={()=>complete(t)}><Check size={16}/> Xong</button></div>)}
      </section>
      <div className="side-stack">
        <section className="panel"><div className="panel-head"><div><h2>Vật tư cần chú ý</h2><p>Đạt hoặc dưới ngưỡng tồn tối thiểu</p></div><Package size={19}/></div>
          {lowStock.length===0?<Empty text="Chưa có vật tư sắp hết."/>:lowStock.slice(0,4).map((i:any)=><div className="stock-row" key={i.id}><div><b>{i.name}</b><small>{i.code}</small></div><span className="status red">{i.quantity} / {i.minQuantity} {i.unit}</span></div>)}
        </section>
        <section className="panel quick-panel"><h2>Truy cập nhanh</h2><button onClick={()=>go('assets')}><HardDrive/> Danh mục thiết bị <ChevronRight/></button><button onClick={()=>go('inventory')}><Package/> Kho vật tư <ChevronRight/></button><button onClick={()=>go('reports')}><FileSpreadsheet/> Xuất báo cáo <ChevronRight/></button></section>
      </div>
    </div>
    <div className="footnote"><span className="online-dot"/> Dữ liệu đang lưu trên thiết bị này <span>·</span> {completed}/{tasks.length} công việc đã hoàn thành trong danh sách</div>
  </div>
}
function Stat({icon,label,value,hint,color}:any){return <div className="stat-card"><div className={`stat-icon ${color}`}>{icon}</div><div><small>{label}</small><strong>{value}</strong><span>{hint}</span></div></div>}
function Empty({text}:any){return <div className="empty"><Archive size={24}/><span>{text}</span></div>}
function ReportCard({icon,title,desc,action}:any){return <div className="panel report-card"><div className="report-icon">{icon}</div><div><h3>{title}</h3><p>{desc}</p></div><button className="soft-btn" onClick={action}><Download size={16}/> Excel</button></div>}

function Modal({title,children,close}:any){return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}><div className="modal"><div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={close}><X/></button></div>{children}</div></div>}
function Field({label,children}:any){return <label className="field"><span>{label}</span>{children}</label>}
function AssetDetailModal({value,close,edit}:any){
  const [showPhotos,setShowPhotos]=useState(false)
  const [activePhoto,setActivePhoto]=useState<string|null>(null)
  const photos: string[] = value.images ?? []
  const rows = [['Mã thiết bị',value.code],['Tên thiết bị',value.name],['Nhóm',value.category],['Vị trí',value.location],['Hãng',value.brand],['Model',value.model],['Serial',value.serial],['Ngày đưa vào sử dụng',dateText(value.commissionedAt)],['Công suất / thông số',value.power],['Chu kỳ bảo trì',value.cycle],['Trạng thái',value.status],['Ghi chú',value.notes]]
  return <Modal title="Chi tiết thiết bị" close={close}>
    <div className="asset-detail-grid">{rows.map(([label,val])=><div className="asset-detail-field" key={label}><small>{label}</small><b>{val||'—'}</b></div>)}</div>
    <div className="asset-photo-actions"><button type="button" className="soft-btn" onClick={()=>setShowPhotos(v=>!v)}><ImageIcon size={16}/> {showPhotos?'Ẩn ảnh':'Xem ảnh ('+photos.length+')'}</button><button type="button" className="primary-btn" onClick={edit}>Sửa hồ sơ</button></div>
    {showPhotos&&<div className="asset-photo-grid">{photos.length?photos.map((src:string,i:number)=><button type="button" className="asset-photo-thumb" key={i} onClick={()=>setActivePhoto(src)}><img src={src} alt={'Ảnh '+(i+1)+' của '+value.name}/><span>Ảnh {i+1}</span></button>):<p className="muted">Thiết bị này chưa có ảnh. Chọn “Sửa hồ sơ” để bổ sung ảnh.</p>}</div>}
    {activePhoto&&<div className="photo-lightbox" onClick={()=>setActivePhoto(null)}><button type="button" className="icon-btn" onClick={()=>setActivePhoto(null)}><X/></button><img src={activePhoto} alt={'Ảnh thiết bị '+value.name}/></div>}
  </Modal>
}
function AssetModal({value,close,save}:any){
  const [v,setV]=useState<Asset>(value)
  const set=(k:keyof Asset,x:any)=>setV(p=>({...p,[k]:x}))
  return <Modal title={value.createdAt===value.updatedAt?'Thêm thiết bị':'Thông tin thiết bị'} close={close}><form onSubmit={e=>{e.preventDefault();if(!v.code||!v.name)return alert('Nhập mã và tên thiết bị');save(v)}} className="form-grid">
    <Field label="Mã thiết bị *"><input required value={v.code} onChange={e=>set('code',e.target.value.toUpperCase())}/></Field><Field label="Tên thiết bị *"><input required value={v.name} onChange={e=>set('name',e.target.value)}/></Field>
    <Field label="Nhóm thiết bị"><select value={v.category} onChange={e=>set('category',e.target.value)}>{['Thiết bị điện','Máy nén khí','Kho lạnh','Nồi hấp','Máy bơm','Điều hòa','Khác'].map(x=><option>{x}</option>)}</select></Field><Field label="Vị trí"><input value={v.location} onChange={e=>set('location',e.target.value)}/></Field>
    <Field label="Hãng"><input value={v.brand} onChange={e=>set('brand',e.target.value)}/></Field><Field label="Model"><input value={v.model} onChange={e=>set('model',e.target.value)}/></Field>
    <Field label="Serial"><input value={v.serial} onChange={e=>set('serial',e.target.value)}/></Field><Field label="Ngày đưa vào sử dụng"><input type="date" value={v.commissionedAt} onChange={e=>set('commissionedAt',e.target.value)}/></Field>
    <Field label="Công suất / thông số"><input value={v.power} onChange={e=>set('power',e.target.value)}/></Field><Field label="Chu kỳ bảo trì"><select value={v.cycle} onChange={e=>set('cycle',e.target.value)}>{['Hàng ngày','Hàng tuần','Hàng tháng','Hàng quý','6 tháng','Hàng năm','Theo giờ chạy',''].map(x=><option>{x}</option>)}</select></Field>
    <Field label="Trạng thái"><select value={v.status} onChange={e=>set('status',e.target.value)}>{['Đang hoạt động','Ngừng hoạt động','Thanh lý'].map(x=><option>{x}</option>)}</select></Field>
    <Field label="Ghi chú"><input value={v.notes} onChange={e=>set('notes',e.target.value)}/></Field>
    <div className="asset-images-field"><label className="field"><span>Ảnh thiết bị (có thể chọn nhiều ảnh)</span><input type="file" accept="image/*" multiple onChange={async e=>{const files=Array.from(e.target.files??[]);const current=v.images??[];const remaining=Math.max(0,8-current.length);const selected=files.slice(0,remaining);const loaded=await Promise.all(selected.map(file=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file)})));set('images',[...current,...loaded]);e.target.value=''}}/></label>
      <div className="asset-photo-grid">{(v.images??[]).map((src:string,i:number)=><div className="asset-photo-thumb" key={i}><img src={src} alt={'Ảnh thiết bị '+(i+1)}/><button type="button" className="text-btn danger" onClick={()=>set('images',(v.images??[]).filter((_:string,index:number)=>index!==i))}>Xóa ảnh</button></div>)}</div>
      <small className="muted">Tối đa 8 ảnh/hồ sơ. Ảnh được lưu cùng dữ liệu thiết bị trong trình duyệt hiện tại; khi chuyển sang máy chủ sẽ cần chuyển ảnh lên kho lưu trữ trực tuyến.</small>
    </div>
    <div className="qr-box"><QRCodeSVG value={`ASSET:${v.code||'CHUA-CO-MA'}`} size={112}/><div><b>Mã QR thiết bị</b><small>QR phiên bản đầu chứa mã thiết bị. Chức năng mở hồ sơ theo QR sẽ hoàn thiện cùng luồng quét.</small></div></div>
    <div className="modal-actions"><button type="button" className="soft-btn" onClick={close}>Hủy</button><button className="primary-btn"><Check size={16}/> Lưu thiết bị</button></div>
  </form></Modal>
}
function ItemModal({value,close,save}:any){
  const [v,setV]=useState<InventoryItem>(value); const set=(k:keyof InventoryItem,x:any)=>setV(p=>({...p,[k]:x}))
  return <Modal title="Thông tin vật tư" close={close}><form className="form-grid" onSubmit={e=>{e.preventDefault();if(!v.code||!v.name)return alert('Nhập mã và tên vật tư');save(v)}}>
    <Field label="Mã vật tư *"><input required value={v.code} onChange={e=>set('code',e.target.value.toUpperCase())}/></Field><Field label="Tên vật tư *"><input required value={v.name} onChange={e=>set('name',e.target.value)}/></Field>
    <Field label="Nhóm"><select value={v.group} onChange={e=>set('group',e.target.value)}>{['Vật tư điện','Linh kiện điện tử','Cơ khí','Khí nén','Điện lạnh','Vật tư tiêu hao','Khác'].map(x=><option>{x}</option>)}</select></Field><Field label="Đơn vị tính"><input value={v.unit} onChange={e=>set('unit',e.target.value)}/></Field>
    <Field label="Số lượng tồn"><input type="number" min="0" value={v.quantity} onChange={e=>set('quantity',Number(e.target.value))}/></Field><Field label="Tồn tối thiểu"><input type="number" min="0" value={v.minQuantity} onChange={e=>set('minQuantity',Number(e.target.value))}/></Field>
    <Field label="Vị trí lưu kho"><input value={v.location} onChange={e=>set('location',e.target.value)}/></Field><Field label="Nhà cung cấp"><input value={v.supplier} onChange={e=>set('supplier',e.target.value)}/></Field>
    <Field label="Đơn giá tham khảo"><input type="number" min="0" value={v.unitPrice} onChange={e=>set('unitPrice',Number(e.target.value))}/></Field>
    <div className="modal-actions"><button type="button" className="soft-btn" onClick={close}>Hủy</button><button className="primary-btn"><Check size={16}/> Lưu vật tư</button></div>
  </form></Modal>
}
function TaskModal({value,assets,close,save}:any){
  const [v,setV]=useState<Task>(value); const set=(k:keyof Task,x:any)=>setV(p=>({...p,[k]:x}))
  return <Modal title="Công việc bảo trì" close={close}><form className="form-grid" onSubmit={e=>{e.preventDefault();if(!v.title||!v.assetId)return alert('Chọn thiết bị và nhập tên công việc');save(v)}}>
    <Field label="Thiết bị"><select value={v.assetId} onChange={e=>set('assetId',e.target.value)}><option value="">-- Chọn thiết bị --</option>{assets.map((a:Asset)=><option value={a.id}>{a.code} - {a.name}</option>)}</select></Field>
    <Field label="Tên công việc"><input required value={v.title} onChange={e=>set('title',e.target.value)}/></Field>
    <Field label="Ngày đến hạn"><input type="date" value={v.dueDate} onChange={e=>set('dueDate',e.target.value)}/></Field><Field label="Chu kỳ"><select value={v.frequency} onChange={e=>set('frequency',e.target.value)}>{['Một lần','Hàng ngày','Hàng tuần','Hàng tháng','Hàng quý','6 tháng','Hàng năm'].map(x=><option>{x}</option>)}</select></Field>
    <Field label="Trạng thái"><select value={v.status} onChange={e=>set('status',e.target.value)}>{['Chờ thực hiện','Đang thực hiện','Hoàn thành','Quá hạn'].map(x=><option>{x}</option>)}</select></Field>
    <Field label="Checklist (mỗi dòng một mục)"><textarea rows={4} value={v.checklist} onChange={e=>set('checklist',e.target.value)}/></Field>
    <Field label="Thông số ghi nhận"><textarea rows={3} placeholder="Ví dụ: Áp suất 7 bar; nhiệt độ dầu 82°C..." value={v.readings} onChange={e=>set('readings',e.target.value)}/></Field>
    <Field label="Ghi chú"><textarea rows={2} value={v.notes} onChange={e=>set('notes',e.target.value)}/></Field>
    <div className="modal-actions"><button type="button" className="soft-btn" onClick={close}>Hủy</button><button className="primary-btn"><Check size={16}/> Lưu công việc</button></div>
  </form></Modal>
}
function ScanModal({close,assets,openAsset}:any){
  const [result,setResult]=useState('')
  useEffect(()=>{
    const scanner = new Html5QrcodeScanner('qr-reader',{fps:10,qrbox:{width:220,height:220}},false)
    scanner.render((text)=>{setResult(text);const code=text.replace('ASSET:','');const found=assets.find((a:Asset)=>a.code===code);if(found){scanner.clear().catch(()=>{});openAsset(found)}},()=>{})
    return ()=>{scanner.clear().catch(()=>{})}
  },[])
  return <Modal title="Quét mã QR thiết bị" close={close}><div id="qr-reader" className="qr-reader"/><p className="muted">Cho phép trình duyệt truy cập camera. Nếu không quét được, kiểm tra quyền camera hoặc nhập mã thiết bị tại danh mục.</p>{result&&<p>Kết quả: {result}</p>}</Modal>
}
