import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Activity, Archive, BarChart3, Building2, CalendarDays, Check, ChevronRight, ClipboardList,
  Download, FileSpreadsheet, Printer, HardDrive, LayoutDashboard, Menu, MoreHorizontal, Package,
  Plus, QrCode, Search, Settings, ShieldAlert, Trash2, UserRound, Wrench, X, ChevronDown, Image as ImageIcon
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import * as XLSX from 'xlsx'
import { db, uid, now, queueChange, type Asset, type InventoryItem, type Task, type Log } from './db'

type Page = 'dashboard' | 'assets' | 'inventory' | 'tasks' | 'logs' | 'reports' | 'settings'
const xmlEntities: Record<string, string> = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}
const xmlText = (value: string) => value.replace(/[&<>"']/g, ch => xmlEntities[ch] ?? ch)
const htmlEscape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] ?? ch))
const makeDemoAssetImage = (category: string, code: string, view: number) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f5f8f7"/><stop offset="1" stop-color="#dce8e3"/></linearGradient><linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#edf3f2"/><stop offset="1" stop-color="#879b98"/></linearGradient></defs><rect width="960" height="640" fill="url(#bg)"/><path d="M0 510H960" stroke="#c5d4ce" stroke-width="3"/><g transform="translate(${view===1?120:165},105)"><ellipse cx="360" cy="405" rx="300" ry="35" fill="#6e8980" opacity=".18"/><rect x="105" y="180" width="510" height="210" rx="28" fill="url(#metal)" stroke="#536d67" stroke-width="9"/><rect x="145" y="215" width="220" height="140" rx="16" fill="${view===1?'#287d70':'#4c789d'}"/><rect x="390" y="215" width="180" height="140" rx="12" fill="#d4dfdc" stroke="#536d67" stroke-width="6"/><circle cx="480" cy="285" r="43" fill="#f8fbfa" stroke="#536d67" stroke-width="8"/><path d="M480 250v70M445 285h70" stroke="#287d70" stroke-width="8"/><rect x="170" y="390" width="45" height="45" rx="7" fill="#344f49"/><rect x="505" y="390" width="45" height="45" rx="7" fill="#344f49"/><path d="M130 180V145h465v35" fill="none" stroke="#536d67" stroke-width="10"/><circle cx="190" cy="245" r="12" fill="#f4c66c"/><circle cx="230" cy="245" r="12" fill="#e8796d"/></g><rect x="42" y="38" width="876" height="564" rx="22" fill="none" stroke="#ffffff" stroke-width="5" opacity=".8"/><text x="58" y="78" font-family="Arial,sans-serif" font-size="25" font-weight="700" fill="#34534b">BAOTRI · ẢNH MINH HỌA THIẾT BỊ</text><text x="58" y="570" font-family="Arial,sans-serif" font-size="22" fill="#526d65">${xmlText(category)} · ${xmlText(code)} · Góc nhìn ${view}</text></svg>`
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg)
}
const today = () => new Date().toISOString().slice(0, 10)
const emptyAsset = (): Asset => ({
  id: uid(), code: '', name: '', category: '', brand: '', model: '', serial: '',
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

// Danh mục chuẩn: mã nhóm không phụ thuộc tên người dùng nhập.
const ASSET_CATEGORY_GROUPS = [
 {label:'Điện – điện tử',items:[{name:'Thiết bị điện',code:'TDE'},{name:'Tủ điện',code:'TDI'},{name:'Tủ điện tổng',code:'TDT'},{name:'Tủ điện phân phối',code:'TDP'},{name:'Tủ điều khiển',code:'TDC'},{name:'Biến tần',code:'BT'},{name:'UPS',code:'UPS'},{name:'Máy biến áp',code:'MBA'},{name:'Thiết bị đo lường',code:'DDL'},{name:'Động cơ điện',code:'DCD'},{name:'Bộ chuyển nguồn ATS',code:'ATS'},{name:'Tủ tụ bù',code:'TCB'}]},
 {label:'Cơ khí – truyền động',items:[{name:'Máy bơm',code:'MB'},{name:'Thiết bị xưởng',code:'TBX'},{name:'Thang máy',code:'TM'},{name:'Hộp giảm tốc',code:'HGT'},{name:'Băng tải',code:'BTA'}]},
 {label:'Quạt công nghiệp',items:[{name:'Quạt công nghiệp',code:'QCN'},{name:'Quạt hút',code:'QH'},{name:'Quạt cấp',code:'QC'},{name:'Quạt thông gió',code:'QTG'},{name:'Quạt làm mát',code:'QLM'},{name:'Quạt hướng trục',code:'QK'},{name:'Quạt ly tâm',code:'QLT'}]},
 {label:'Khí nén – nhiệt – lạnh',items:[{name:'Máy nén khí',code:'MNA'},{name:'Máy sấy khí',code:'MSK'},{name:'Bộ lọc khí nén',code:'BLK'},{name:'Khí nén',code:'KN'},{name:'Kho lạnh',code:'KLA'},{name:'Điều hòa thông gió',code:'DHT'},{name:'Chiller',code:'CHL'},{name:'Tháp giải nhiệt',code:'TGN'},{name:'Nồi hơi',code:'NH'},{name:'Nồi hấp',code:'NHA'}]},
 {label:'Nguồn điện – an toàn',items:[{name:'Máy phát điện',code:'MPD'},{name:'Phòng cháy chữa cháy',code:'PCCC'}]}
] as const
const ASSET_CATEGORY_CODES: Record<string,string> = Object.fromEntries(ASSET_CATEGORY_GROUPS.flatMap(g=>g.items.map(i=>[i.name,i.code])))
const ASSET_LOCATION_CODES: Record<string,string> = {'Phòng máy nén khí':'01','Khu sản xuất':'02','Phòng bơm tầng hầm':'03','Dây chuyền 1':'04','Khu xử lý bụi':'05','Nhà xưởng A':'06','Khu kỹ thuật':'07','Phòng kỹ thuật tầng 1':'08','Tầng 2':'09','Khu vực Chiller':'10','Sân kỹ thuật mái':'11','Phòng máy phát điện':'12','Phòng điện tổng':'13','Tầng 1':'14','Phòng bơm':'15','Phòng IT':'16','Trạm biến áp':'17','Nhà lò hơi':'18','Xưởng bảo trì':'19','Sảnh chính':'20','Phòng bơm PCCC':'21','Đường ống khí nén':'22','Hố gom tầng hầm':'23'}
const RECEIVING_FACILITY_CODE='HP01'
const buildAssetCode=(asset:Asset,allAssets:Asset[])=>{
 const typeCode=ASSET_CATEGORY_CODES[asset.category]
 if(!typeCode)return ''
 // xxx tăng theo ABC trong toàn công ty, không khởi động lại theo từng cơ sở.
 const pattern=new RegExp('^'+typeCode+'-[^-]+-(\\d+)-')
 const nums=allAssets.map(a=>a.code.match(pattern)?.[1]).filter((n):n is string=>Boolean(n)).map(Number)
 const seq=String(Math.max(0,...nums)+1).padStart(3,'0')
 const date=asset.commissionedAt||today()
 const location=ASSET_LOCATION_CODES[asset.location]??'99'
 return typeCode+'-'+RECEIVING_FACILITY_CODE+'-'+seq+'-'+location+'-'+date.slice(5,7)+'-'+date.slice(2,4)+(asset.transferredFromOtherFacility?'*':'')
}

const money = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' đ'
const dateText = (s: string) => s ? new Date(s + (s.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('vi-VN') : '—'

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'asset'|'item'|'task'|'log'|'scan'|null>(null)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null)
  const [assetCategoryFilter, setAssetCategoryFilter] = useState('')
  const [assetLocationFilter, setAssetLocationFilter] = useState('')
  const [assetStatusFilter, setAssetStatusFilter] = useState('')
  const [assetSort, setAssetSort] = useState('code-asc')
  const [showArchived, setShowArchived] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editingLog, setEditingLog] = useState<Log | null>(null)
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
      // Chuẩn hóa 30 thiết bị mẫu theo cấu trúc ABC-ABXY-xxx-BB-MM-YY.
      // Giữ nguyên ID, ảnh, lịch sử và các chỉnh sửa của hồ sơ demo đã tồn tại.
      const typeCodes: Record<string, string> = {
        COMP: 'MNA', KHO: 'KLA', BOM: 'MB', MOT: 'DCD', FAN: 'QCN',
        AHU: 'AHU', FCU: 'FCU', CHL: 'CHL', CTW: 'TGN', GEN: 'MPD',
        ATS: 'ATS', MDB: 'TDT', DB: 'TDP', VFD: 'BT', UPS: 'UPS',
        TRF: 'MBA', CAP: 'TCB', BOI: 'NH', DRY: 'MSK', FLT: 'BLK',
        WLD: 'MHD', LFT: 'TM', FIR: 'BCC', SEN: 'CBAS', PMP: 'MB'
      }
      const locationCodes: Record<string, string> = {
        'Phòng máy nén khí': '01', 'Khu sản xuất': '02', 'Phòng bơm tầng hầm': '03',
        'Dây chuyền 1': '04', 'Khu xử lý bụi': '05', 'Nhà xưởng A': '06',
        'Khu kỹ thuật': '07', 'Phòng kỹ thuật tầng 1': '08', 'Tầng 2': '09',
        'Khu vực Chiller': '10', 'Sân kỹ thuật mái': '11', 'Phòng máy phát điện': '12',
        'Phòng điện tổng': '13', 'Tầng 1': '14', 'Phòng bơm': '15',
        'Phòng IT': '16', 'Trạm biến áp': '17', 'Nhà lò hơi': '18',
        'Xưởng bảo trì': '19', 'Sảnh chính': '20', 'Phòng bơm PCCC': '21',
        'Đường ống khí nén': '22', 'Hố gom tầng hầm': '23'
      }
      const typeSequences: Record<string, number> = {}
      const normalizedDemoAssets = demoAssets.map(item => {
        const legacyCode = item.code
        const legacyType = legacyCode.split('-')[0]
        const typeCode = typeCodes[legacyType] ?? 'TBK'
        typeSequences[typeCode] = (typeSequences[typeCode] ?? 0) + 1
        const sequence = String(typeSequences[typeCode]).padStart(3, '0')
        const date = item.commissionedAt
        const locationCode = locationCodes[item.location] ?? '99'
        return {
          ...item,
          legacyCode,
          code: `${typeCode}-HP01-${sequence}-${locationCode}-${date.slice(5, 7)}-${date.slice(2, 4)}`
        }
      })
      const existing = await db.assets.toArray()
      const existingCodes = new Set(existing.map(a => a.code))
      const updates: Asset[] = []
      const missing: Asset[] = []
      for (const item of normalizedDemoAssets) {
        const oldDemo = existing.find(a => a.serial === `DEMO-${item.legacyCode}` || a.code === item.legacyCode)
        if (oldDemo) {
          if (oldDemo.code !== item.code) updates.push({ ...oldDemo, code: item.code, updatedAt: now() })
        } else if (!existingCodes.has(item.code)) {
          missing.push({
            ...emptyAsset(), ...item, serial: `DEMO-${item.legacyCode}`,
            images: [makeDemoAssetImage(item.category, item.code, 1), makeDemoAssetImage(item.category, item.code, 2)],
            notes: 'DỮ LIỆU MẪU – ảnh minh họa kỹ thuật, không phải ảnh thực tế của thiết bị.'
          })
        }
      }
      if (updates.length) await db.assets.bulkPut(updates)
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

      const compressor = await db.assets.filter(a => a.serial === 'DEMO-COMP-001').first()
      const coldStore = await db.assets.filter(a => a.serial === 'DEMO-KHO-001').first()
      // 40 vật tư giả định để thử nghiệm kho; chỉ bổ sung mã còn thiếu, không ghi đè dữ liệu đã sửa.
      const demoInventory = [
        { code:'VT-001', name:'Lọc dầu máy nén khí', group:'Khí nén', unit:'Bộ', quantity:3, minQuantity:5, location:'Kho cơ điện - Kệ A1', supplier:'Nhà cung cấp mẫu A', unitPrice:450000 },
        { code:'VT-002', name:'Lọc tách dầu máy nén khí', group:'Khí nén', unit:'Cái', quantity:2, minQuantity:2, location:'Kho cơ điện - Kệ A1', supplier:'Nhà cung cấp mẫu A', unitPrice:1850000 },
        { code:'VT-003', name:'Lọc gió máy nén khí', group:'Khí nén', unit:'Cái', quantity:4, minQuantity:2, location:'Kho cơ điện - Kệ A1', supplier:'Nhà cung cấp mẫu A', unitPrice:620000 },
        { code:'VT-004', name:'Dầu máy nén khí ISO VG 46', group:'Dầu mỡ bôi trơn', unit:'Lít', quantity:25, minQuantity:10, location:'Kho hóa chất - Kệ D1', supplier:'Nhà cung cấp mẫu B', unitPrice:95000 },
        { code:'VT-005', name:'Dây curoa máy nén khí', group:'Truyền động', unit:'Sợi', quantity:3, minQuantity:2, location:'Kho cơ điện - Kệ A2', supplier:'Nhà cung cấp mẫu A', unitPrice:320000 },
        { code:'VT-006', name:'Bạc đạn 6204-2RS', group:'Vòng bi - bạc đạn', unit:'Cái', quantity:12, minQuantity:5, location:'Kho cơ điện - Kệ B1', supplier:'Nhà cung cấp mẫu C', unitPrice:85000 },
        { code:'VT-007', name:'Bạc đạn 6205-2RS', group:'Vòng bi - bạc đạn', unit:'Cái', quantity:8, minQuantity:5, location:'Kho cơ điện - Kệ B1', supplier:'Nhà cung cấp mẫu C', unitPrice:105000 },
        { code:'VT-008', name:'Bạc đạn 6308-2RS', group:'Vòng bi - bạc đạn', unit:'Cái', quantity:2, minQuantity:2, location:'Kho cơ điện - Kệ B1', supplier:'Nhà cung cấp mẫu C', unitPrice:285000 },
        { code:'VT-009', name:'Phớt bơm cơ khí 25 mm', group:'Phớt - gioăng', unit:'Cái', quantity:5, minQuantity:3, location:'Kho cơ điện - Kệ B2', supplier:'Nhà cung cấp mẫu C', unitPrice:145000 },
        { code:'VT-010', name:'Gioăng cao su mặt bích DN50', group:'Phớt - gioăng', unit:'Cái', quantity:20, minQuantity:10, location:'Kho cơ điện - Kệ B2', supplier:'Nhà cung cấp mẫu C', unitPrice:18000 },
        { code:'VT-011', name:'Contactor 3P 18A cuộn 220VAC', group:'Thiết bị điện', unit:'Cái', quantity:4, minQuantity:2, location:'Kho điện - Kệ C1', supplier:'Nhà cung cấp mẫu D', unitPrice:420000 },
        { code:'VT-012', name:'Contactor 3P 32A cuộn 220VAC', group:'Thiết bị điện', unit:'Cái', quantity:2, minQuantity:2, location:'Kho điện - Kệ C1', supplier:'Nhà cung cấp mẫu D', unitPrice:680000 },
        { code:'VT-013', name:'Rơ le nhiệt 9-13A', group:'Thiết bị điện', unit:'Cái', quantity:3, minQuantity:2, location:'Kho điện - Kệ C1', supplier:'Nhà cung cấp mẫu D', unitPrice:235000 },
        { code:'VT-014', name:'MCB 1P 16A curve C', group:'Thiết bị điện', unit:'Cái', quantity:15, minQuantity:5, location:'Kho điện - Kệ C2', supplier:'Nhà cung cấp mẫu D', unitPrice:78000 },
        { code:'VT-015', name:'MCCB 3P 100A', group:'Thiết bị điện', unit:'Cái', quantity:1, minQuantity:1, location:'Kho điện - Kệ C2', supplier:'Nhà cung cấp mẫu D', unitPrice:1250000 },
        { code:'VT-016', name:'Cầu chì ống 10x38 6A', group:'Thiết bị điện', unit:'Cái', quantity:30, minQuantity:10, location:'Kho điện - Kệ C2', supplier:'Nhà cung cấp mẫu D', unitPrice:12000 },
        { code:'VT-017', name:'Đèn báo pha LED 220VAC', group:'Thiết bị điện', unit:'Cái', quantity:10, minQuantity:5, location:'Kho điện - Kệ C3', supplier:'Nhà cung cấp mẫu D', unitPrice:35000 },
        { code:'VT-018', name:'Nút nhấn đỏ phi 22', group:'Thiết bị điện', unit:'Cái', quantity:8, minQuantity:5, location:'Kho điện - Kệ C3', supplier:'Nhà cung cấp mẫu D', unitPrice:42000 },
        { code:'VT-019', name:'Nút nhấn xanh phi 22', group:'Thiết bị điện', unit:'Cái', quantity:8, minQuantity:5, location:'Kho điện - Kệ C3', supplier:'Nhà cung cấp mẫu D', unitPrice:42000 },
        { code:'VT-020', name:'Cảm biến tiệm cận M18 PNP', group:'Cảm biến - đo lường', unit:'Cái', quantity:2, minQuantity:2, location:'Kho điện tử - Kệ E1', supplier:'Nhà cung cấp mẫu E', unitPrice:390000 },
        { code:'VT-021', name:'Cảm biến áp suất 0-10 bar', group:'Cảm biến - đo lường', unit:'Cái', quantity:1, minQuantity:1, location:'Kho điện tử - Kệ E1', supplier:'Nhà cung cấp mẫu E', unitPrice:1250000 },
        { code:'VT-022', name:'Cảm biến nhiệt độ PT100', group:'Cảm biến - đo lường', unit:'Cái', quantity:3, minQuantity:2, location:'Kho điện tử - Kệ E1', supplier:'Nhà cung cấp mẫu E', unitPrice:280000 },
        { code:'VT-023', name:'Relay trung gian 8 chân 24VDC', group:'Thiết bị điện', unit:'Cái', quantity:10, minQuantity:5, location:'Kho điện - Kệ C4', supplier:'Nhà cung cấp mẫu D', unitPrice:65000 },
        { code:'VT-024', name:'Nguồn switching 24VDC 5A', group:'Điện tử - nguồn', unit:'Cái', quantity:2, minQuantity:2, location:'Kho điện tử - Kệ E2', supplier:'Nhà cung cấp mẫu E', unitPrice:320000 },
        { code:'VT-025', name:'Quạt làm mát tủ điện 120 mm', group:'Làm mát tủ điện', unit:'Cái', quantity:4, minQuantity:2, location:'Kho điện - Kệ C4', supplier:'Nhà cung cấp mẫu D', unitPrice:185000 },
        { code:'VT-026', name:'Ống khí PU phi 8', group:'Khí nén', unit:'Mét', quantity:50, minQuantity:20, location:'Kho cơ điện - Kệ A3', supplier:'Nhà cung cấp mẫu A', unitPrice:8500 },
        { code:'VT-027', name:'Đầu nối nhanh khí nén PC8-02', group:'Khí nén', unit:'Cái', quantity:20, minQuantity:10, location:'Kho cơ điện - Kệ A3', supplier:'Nhà cung cấp mẫu A', unitPrice:18000 },
        { code:'VT-028', name:'Van điện từ khí nén 5/2', group:'Khí nén', unit:'Cái', quantity:2, minQuantity:1, location:'Kho cơ điện - Kệ A3', supplier:'Nhà cung cấp mẫu A', unitPrice:480000 },
        { code:'VT-029', name:'Ống nước PVC DN27', group:'Vật tư đường ống', unit:'Mét', quantity:30, minQuantity:10, location:'Kho vật tư chung - Kệ F1', supplier:'Nhà cung cấp mẫu F', unitPrice:14500 },
        { code:'VT-030', name:'Van bi đồng DN20', group:'Vật tư đường ống', unit:'Cái', quantity:6, minQuantity:3, location:'Kho vật tư chung - Kệ F1', supplier:'Nhà cung cấp mẫu F', unitPrice:95000 },
        { code:'VT-031', name:'Băng tan PTFE', group:'Vật tư tiêu hao', unit:'Cuộn', quantity:25, minQuantity:10, location:'Kho vật tư chung - Kệ F2', supplier:'Nhà cung cấp mẫu F', unitPrice:7000 },
        { code:'VT-032', name:'Keo silicone trung tính', group:'Vật tư tiêu hao', unit:'Tuýp', quantity:8, minQuantity:4, location:'Kho vật tư chung - Kệ F2', supplier:'Nhà cung cấp mẫu F', unitPrice:65000 },
        { code:'VT-033', name:'Que hàn thép 2.5 mm', group:'Vật tư hàn cắt', unit:'Kg', quantity:12, minQuantity:5, location:'Kho xưởng - Kệ G1', supplier:'Nhà cung cấp mẫu G', unitPrice:38000 },
        { code:'VT-034', name:'Đá cắt sắt 100 mm', group:'Vật tư hàn cắt', unit:'Viên', quantity:40, minQuantity:20, location:'Kho xưởng - Kệ G1', supplier:'Nhà cung cấp mẫu G', unitPrice:9000 },
        { code:'VT-035', name:'Mỡ bôi trơn đa dụng', group:'Dầu mỡ bôi trơn', unit:'Kg', quantity:5, minQuantity:3, location:'Kho hóa chất - Kệ D1', supplier:'Nhà cung cấp mẫu B', unitPrice:165000 },
        { code:'VT-036', name:'Dung dịch vệ sinh tiếp điểm', group:'Điện tử - bảo dưỡng', unit:'Chai', quantity:6, minQuantity:3, location:'Kho điện tử - Kệ E2', supplier:'Nhà cung cấp mẫu E', unitPrice:85000 },
        { code:'VT-037', name:'Dây điện mềm 2x1.5 mm²', group:'Dây cáp điện', unit:'Mét', quantity:100, minQuantity:30, location:'Kho điện - Kệ C5', supplier:'Nhà cung cấp mẫu D', unitPrice:14500 },
        { code:'VT-038', name:'Cáp điện CV 1x4 mm²', group:'Dây cáp điện', unit:'Mét', quantity:80, minQuantity:30, location:'Kho điện - Kệ C5', supplier:'Nhà cung cấp mẫu D', unitPrice:12500 },
        { code:'VT-039', name:'Đầu cos đồng 4 mm²', group:'Dây cáp điện', unit:'Cái', quantity:100, minQuantity:30, location:'Kho điện - Kệ C5', supplier:'Nhà cung cấp mẫu D', unitPrice:1200 },
        { code:'VT-040', name:'Dây rút nhựa 200 mm', group:'Vật tư tiêu hao', unit:'Bịch', quantity:10, minQuantity:5, location:'Kho vật tư chung - Kệ F2', supplier:'Nhà cung cấp mẫu F', unitPrice:28000 }
      ]
      const existingInventoryCodes = new Set((await db.inventory.toArray()).map(item => item.code))
      const missingInventory = demoInventory
        .filter(item => !existingInventoryCodes.has(item.code))
        .map(item => ({ ...emptyItem(), ...item, updatedAt: now() }))
      if (missingInventory.length) await db.inventory.bulkAdd(missingInventory)
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
    const isNew = !a.code
    let code = a.code
    if (isNew) {
      if (!ASSET_CATEGORY_CODES[a.category]) {
        alert('Bạn cần chọn một nhóm thiết bị trong danh mục chuẩn để hệ thống cấp mã định danh.')
        return
      }
      const existing = await db.assets.toArray()
      code = buildAssetCode(a, existing)
      if (!code) {
        alert('Không thể tạo mã định danh. Hãy kiểm tra lại nhóm thiết bị.')
        return
      }
    }
    const value = { ...a, code, images: a.images ?? [], updatedAt: now() }
    await db.assets.put(value)
    await queueChange('assets', value.id)
    setModal(null); setEditingAsset(null)
    if (isNew) setDetailAsset(value)
    flash(isNew ? 'Đã thêm thiết bị và cấp mã định danh' : 'Đã lưu thiết bị')
  }
  const saveItem = async (i: InventoryItem) => {
    const value = { ...i, updatedAt: now() }
    await db.inventory.put(value); await queueChange('inventory', value.id); setModal(null); setEditingItem(null); flash('Đã lưu vật tư')
  }
  const saveTask = async (t: Task) => {
    const value = { ...t, updatedAt: now() }
    await db.tasks.put(value); await queueChange('tasks', value.id); setModal(null); setEditingTask(null); flash('Đã lưu công việc')
  }
  const saveLog = async (entry: Log) => {
    await db.logs.put(entry); await queueChange('logs', entry.id)
    setModal(null); setEditingLog(null); flash('Đã ghi nhận lịch sử bảo trì/sửa chữa')
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
  const changeAssetStatus = async (a: Asset, status: Asset['status']) => {
    if (status === 'Thanh lý' && !confirm(`Xác nhận thanh lý “${a.name}”? Hồ sơ và lịch sử vẫn được giữ để tra cứu; đây không phải xóa vĩnh viễn.`)) return
    const value = { ...a, status, updatedAt: now() }
    await db.assets.put(value); await queueChange('assets', a.id); flash(`Đã cập nhật trạng thái: ${status}`)
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
  const exportAssets = () => {
    // Xuất dữ liệu thuần thành tệp XLSX chuẩn để tiếp tục lọc, sắp xếp và xử lý trong Excel.
    const headers = ['STT','Mã định danh','Tên thiết bị','Nhóm thiết bị','Hãng','Model','Serial','Vị trí lắp đặt','Ngày đưa vào sử dụng','Công suất / thông số','Tình trạng','Ghi chú']
    const rows = filteredAssets.map((asset, index) => [
      index + 1,
      asset.code || '',
      asset.name || '',
      asset.category || '',
      asset.brand || '',
      asset.model || '',
      asset.serial || '',
      asset.location || '',
      asset.commissionedAt ? dateText(asset.commissionedAt) : '',
      asset.power || '',
      asset.status || '',
      asset.notes || ''
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = [
      { wch: 6 }, { wch: 23 }, { wch: 30 }, { wch: 22 },
      { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 24 },
      { wch: 20 }, { wch: 24 }, { wch: 19 }, { wch: 32 }
    ]
    if (rows.length > 0) {
      ws['!autofilter'] = { ref: 'A1:L' + (rows.length + 1) }
    }
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Danh sách thiết bị')
    wb.Props = {
      Title: 'Danh sách thiết bị',
      Subject: 'Dữ liệu danh mục thiết bị BAOTRI',
      Author: 'BAOTRI',
      CreatedDate: new Date()
    }
    XLSX.writeFile(wb, 'danh-sach-thiet-bi.xlsx', { compression: true })
  }
  const printAssets = () => {
    const headers = ['STT','Mã định danh','Tên thiết bị','Nhóm thiết bị','Serial','Vị trí lắp đặt','Ngày đưa vào sử dụng','Công suất / thông số','Tình trạng','Ghi chú']
    const bodyRows = filteredAssets.map((asset, index) => '<tr>' +
      '<td class="center">' + (index + 1) + '</td>' +
      '<td>' + htmlEscape(asset.code) + '</td>' +
      '<td><strong>' + htmlEscape(asset.name) + '</strong>' + (asset.brand ? '<br/><span>Hãng: ' + htmlEscape(asset.brand) + '</span>' : '') + (asset.model ? '<br/><span>Model: ' + htmlEscape(asset.model) + '</span>' : '') + '</td>' +
      '<td>' + htmlEscape(asset.category) + '</td><td>' + htmlEscape(asset.serial || '—') + '</td>' +
      '<td>' + htmlEscape(asset.location || '—') + '</td><td>' + htmlEscape(dateText(asset.commissionedAt)) + '</td>' +
      '<td>' + htmlEscape(asset.power || '—') + '</td><td>' + htmlEscape(asset.status) + '</td><td>' + htmlEscape(asset.notes || '—') + '</td></tr>').join('')
    const printWindow = window.open('', '_blank')
    if (!printWindow) { alert('Trình duyệt đang chặn cửa sổ in. Hãy cho phép cửa sổ bật lên rồi thử lại.'); return }
    const html = '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/><title>DANH SÁCH THIẾT BỊ</title>' +
      '<style>@page{size:A4 landscape;margin:12mm 8mm 16mm;@bottom-center{content:"Trang " counter(page) " / " counter(pages);font-family:Tahoma,sans-serif;font-size:9pt}}' +
      '*{box-sizing:border-box}body{font-family:Tahoma,sans-serif;font-size:11pt;color:#111;margin:0}h1{font-size:12pt;font-weight:bold;text-align:center;margin:0 0 12pt}' +
      'table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}' +
      'th,td{border:1px solid #333;padding:4pt 3pt;vertical-align:top;overflow-wrap:anywhere}th{font-size:10pt;font-weight:bold;text-align:center;background:#e9eeeb!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      'td{font-size:10pt}td strong{font-weight:bold}td span{font-size:9pt}.center{text-align:center}.total{text-align:right;font-weight:bold;margin-top:10pt}@media screen{body{padding:16px}}</style></head><body>' +
      '<h1>DANH SÁCH THIẾT BỊ</h1><table><colgroup><col style="width:4%"/><col style="width:12%"/><col style="width:18%"/><col style="width:10%"/><col style="width:9%"/><col style="width:12%"/><col style="width:10%"/><col style="width:9%"/><col style="width:8%"/><col style="width:8%"/></colgroup>' +
      '<thead><tr>' + headers.map(header => '<th>' + htmlEscape(header) + '</th>').join('') + '</tr></thead><tbody>' + bodyRows + '</tbody></table>' +
      '<p class="total">Tổng số: ' + filteredAssets.length + ' thiết bị</p></body></html>'
    printWindow.document.open(); printWindow.document.write(html); printWindow.document.close()
    printWindow.focus(); printWindow.onafterprint = () => printWindow.close(); printWindow.print()
  }
  const exportInventory = () => exportRows(inventory.map(i => ({ 'Mã vật tư':i.code,'Mã số':i.partNumber??'','Tên vật tư':i.name,'Nhóm':i.group,'Kích cỡ':i.size??'','ĐVT':i.unit,'Tồn':i.quantity,'Tồn tối thiểu':i.minQuantity,'Vị trí':i.location,'Nhà cung cấp':i.supplier,'Đơn giá':i.unitPrice })), 'ton-kho-vat-tu.xlsx')
  const printInventory = () => {
    const rows = filteredItems.map((i,index)=>'<tr><td class="center">'+(index+1)+'</td><td>'+htmlEscape(i.code)+'</td><td>'+htmlEscape(i.partNumber||'—')+'</td><td><strong>'+htmlEscape(i.name)+'</strong></td><td>'+htmlEscape(i.group)+'</td><td>'+htmlEscape(i.size||'—')+'</td><td class="center">'+htmlEscape(i.unit)+'</td><td class="num">'+i.quantity+'</td><td class="num">'+i.minQuantity+'</td><td>'+htmlEscape(i.location||'—')+'</td><td>'+htmlEscape(i.supplier||'—')+'</td><td class="num">'+Number(i.unitPrice||0).toLocaleString('vi-VN')+'</td></tr>').join('')
    const printWindow=window.open('','_blank')
    if(!printWindow){alert('Trình duyệt đang chặn cửa sổ in. Hãy cho phép cửa sổ bật lên rồi thử lại.');return}
    const headers=['STT','Mã vật tư','Mã số','Tên vật tư','Nhóm','Kích cỡ','ĐVT','Tồn kho','Tồn tối thiểu','Vị trí lưu kho','Nhà cung cấp','Đơn giá (VNĐ)']
    const html='<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/><title>DANH SÁCH VẬT TƯ</title><style>@page{size:A4 landscape;margin:12mm 8mm 16mm;@bottom-center{content:"Trang " counter(page) " / " counter(pages);font:9pt Tahoma}}*{box-sizing:border-box}body{font-family:Tahoma,sans-serif;font-size:11pt;color:#111;margin:0}h1{text-align:center;font-size:12pt;margin:0 0 12pt}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}th,td{border:1px solid #333;padding:4pt 3pt;vertical-align:top;overflow-wrap:anywhere;font-size:9pt}th{text-align:center;font-weight:bold;background:#e9eeeb!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.center{text-align:center}.num{text-align:right}.total{text-align:right;font-weight:bold;margin-top:10pt}@media screen{body{padding:16px}}</style></head><body><h1>DANH SÁCH VẬT TƯ</h1><table><colgroup><col style="width:3%"/><col style="width:8%"/><col style="width:8%"/><col style="width:15%"/><col style="width:9%"/><col style="width:8%"/><col style="width:5%"/><col style="width:6%"/><col style="width:7%"/><col style="width:10%"/><col style="width:10%"/><col style="width:11%"/></colgroup><thead><tr>'+headers.map(h=>'<th>'+htmlEscape(h)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table><p class="total">Tổng số: '+filteredItems.length+' vật tư</p></body></html>'
    printWindow.document.open();printWindow.document.write(html);printWindow.document.close();printWindow.focus();printWindow.onafterprint=()=>printWindow.close();printWindow.print()
  }
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
            <button className={!showArchived?'soft-btn':'text-btn'} onClick={()=>setShowArchived(false)}>Đang quản lý ({activeAssets.length})</button>
            <button className={showArchived?'soft-btn':'text-btn'} onClick={()=>setShowArchived(true)}><Archive size={15}/> Lưu kho ({archivedAssets.length})</button>
            {!showArchived&&<details className="asset-filter-menu"><summary><ChevronDown size={15}/> Lọc & sắp xếp</summary><div className="asset-filter-popover">
              <label>Nhóm thiết bị<select value={assetCategoryFilter} onChange={e=>{setAssetCategoryFilter(e.target.value);e.currentTarget.closest('details')?.removeAttribute('open')}}><option value="">Tất cả nhóm</option>{assetCategories.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
              <label>Vị trí<select value={assetLocationFilter} onChange={e=>{setAssetLocationFilter(e.target.value);e.currentTarget.closest('details')?.removeAttribute('open')}}><option value="">Tất cả vị trí</option>{assetLocations.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
              <label>Trạng thái<select value={assetStatusFilter} onChange={e=>{setAssetStatusFilter(e.target.value);e.currentTarget.closest('details')?.removeAttribute('open')}}><option value="">Tất cả trạng thái</option>{['Đang hoạt động','Đang sửa chữa','Ngừng sử dụng','Thanh lý'].map(x=><option key={x}>{x}</option>)}</select></label>
              <label>Sắp xếp<select value={assetSort} onChange={e=>{setAssetSort(e.target.value);e.currentTarget.closest('details')?.removeAttribute('open')}}><option value="code-asc">Mã thiết bị: A → Z</option><option value="code-desc">Mã thiết bị: Z → A</option><option value="name-asc">Tên thiết bị: A → Z</option><option value="date-newest">Ngày sử dụng: mới nhất</option><option value="date-oldest">Ngày sử dụng: cũ nhất</option></select></label>
              <button type="button" className="text-btn" onClick={e=>{setAssetCategoryFilter('');setAssetLocationFilter('');setAssetStatusFilter('');setAssetSort('code-asc');e.currentTarget.closest('details')?.removeAttribute('open')}}>Đặt lại bộ lọc</button>
            </div></details>}
            {!showArchived&&<><button className="soft-btn" onClick={exportAssets}><Download size={16}/> Xuất Excel</button><button className="soft-btn" onClick={printAssets}><Printer size={16}/> In danh sách</button></>}
          </div></div>
          <div className="asset-result-count">{showArchived?'Đang lưu kho: '+filteredArchivedAssets.length+'/'+archivedAssets.length+' thiết bị':'Hiển thị '+filteredAssets.length+'/'+activeAssets.length+' thiết bị đang hoạt động'}</div>
          <div className="table-wrap"><table><thead><tr><th>Mã / Tên thiết bị</th><th>Nhóm</th><th>Vị trí</th><th>Ngày sử dụng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
          {(showArchived?filteredArchivedAssets:filteredAssets).map(a=><tr key={a.id}><td><button className="asset-name-link" onClick={()=>setDetailAsset(a)}><b>{a.code}</b><small>{a.name}</small></button></td><td>{a.category}</td><td>{a.location||'—'}</td><td>{dateText(a.commissionedAt)}</td><td><span className={'status '+(a.archivedAt?'gray':a.status==='Đang hoạt động'?'green':a.status==='Đang sửa chữa'?'orange':a.status==='Thanh lý'?'red':'gray')}>{a.archivedAt?'Đã lưu kho':a.status}</span></td><td className="actions">{showArchived?<><button className="text-btn success-text" onClick={()=>restoreAsset(a)}>Khôi phục</button><button className="text-btn danger" title="Chỉ Admin sau khi có đăng nhập và xác thực máy chủ" disabled><Trash2 size={14}/> Xóa vĩnh viễn</button></>:<><button className="text-btn" onClick={()=>{setEditingAsset({...a,images:a.images??[]});setModal('asset')}}>Sửa</button><details className="asset-row-menu"><summary>Thao tác</summary><div><button onClick={e=>{changeAssetStatus(a,'Đang hoạt động');e.currentTarget.closest('details')?.removeAttribute('open')}}>Đánh dấu đang hoạt động</button><button onClick={e=>{changeAssetStatus(a,'Đang sửa chữa');e.currentTarget.closest('details')?.removeAttribute('open')}}>Đang sửa chữa / hỏng</button><button onClick={e=>{changeAssetStatus(a,'Ngừng sử dụng');e.currentTarget.closest('details')?.removeAttribute('open')}}>Ngừng sử dụng</button><button onClick={e=>{archiveAsset(a);e.currentTarget.closest('details')?.removeAttribute('open')}}>Đưa vào Lưu kho</button><button onClick={e=>{changeAssetStatus(a,'Thanh lý');e.currentTarget.closest('details')?.removeAttribute('open')}}>Thanh lý / bán ve chai</button><button className="danger" disabled title="Chờ đăng nhập Admin và xác thực máy chủ">Xóa vĩnh viễn (Admin)</button></div></details></>}</td></tr>)}
          </tbody></table>{(showArchived?filteredArchivedAssets:filteredAssets).length===0&&<Empty text={showArchived?'Chưa có thiết bị nào trong Lưu kho.':'Chưa có thiết bị phù hợp.'}/>}</div>
          {showArchived&&<p className="archive-security-note">Xóa vĩnh viễn sẽ chỉ mở khi BAOTRI có đăng nhập và xác thực Admin ở máy chủ. Bản thử nghiệm lưu cục bộ chưa có bảo mật tài khoản thật.</p>}
        </section>}
        {page==='inventory' && <section className="panel"><div className="panel-head"><div><h2>Kho vật tư</h2><p>Nhập xuất tồn và cảnh báo mức tồn tối thiểu</p></div><div className="asset-photo-actions"><button className="soft-btn" onClick={exportInventory}><Download size={16}/> Xuất Excel</button><button className="soft-btn" onClick={printInventory}><Printer size={16}/> In danh sách</button></div></div>
          <div className="table-wrap"><table><thead><tr><th>Mã / Tên vật tư</th><th>Nhóm</th><th>Tồn kho</th><th>Tồn tối thiểu</th><th>Vị trí</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
          {filteredItems.map(i=><tr key={i.id}><td><button type="button" className="inventory-name-link" onClick={()=>setDetailItem(i)}><b>{i.code}</b><small>{i.name}</small></button></td><td>{i.group}</td><td><b>{i.quantity} {i.unit}</b></td><td>{i.minQuantity} {i.unit}</td><td>{i.location||'—'}</td><td><span className={`status ${i.quantity<=i.minQuantity?'red':'green'}`}>{i.quantity<=i.minQuantity?'Sắp hết':'Đủ tồn'}</span></td><td className="actions"><button className="text-btn" onClick={()=>addMovement(i,'Nhập',Number(prompt('Số lượng nhập?','1')))}>Nhập</button><button className="text-btn" onClick={()=>addMovement(i,'Xuất',Number(prompt('Số lượng xuất?','1')))}>Xuất</button><button className="text-btn" onClick={()=>{setEditingItem(i);setModal('item')}}>Sửa</button></td></tr>)}
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
    {detailItem&&<InventoryDetailModal value={detailItem} close={()=>setDetailItem(null)} edit={()=>{setEditingItem(detailItem);setDetailItem(null);setModal('item')}}/>}
    {detailAsset&&<AssetDetailModal value={detailAsset} logs={logs.filter(l=>l.assetId===detailAsset.id)} close={()=>setDetailAsset(null)} edit={()=>{setEditingAsset({...detailAsset,images:detailAsset.images??[]});setDetailAsset(null);setModal('asset')}} addLog={()=>{setEditingLog({id:uid(),assetId:detailAsset.id,date:today(),kind:'Sửa chữa',description:'',parts:'',readings:'',result:'',performedBy:''});setModal('log')}}/>}
    {modal==='asset'&&editingAsset&&<AssetModal value={editingAsset} close={()=>{setModal(null);setEditingAsset(null)}} save={saveAsset} assets={assets}/>}
    {modal==='item'&&editingItem&&<ItemModal value={editingItem} close={()=>{setModal(null);setEditingItem(null)}} save={saveItem}/>}
    {modal==='task'&&editingTask&&<TaskModal value={editingTask} assets={assets} close={()=>{setModal(null);setEditingTask(null)}} save={saveTask}/>}
    {modal==='log'&&editingLog&&<LogEntryModal value={editingLog} close={()=>{setModal(null);setEditingLog(null)}} save={saveLog}/>}
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
function AssetDetailModal({value,logs,close,edit,addLog}:any){
  const [showPhotos,setShowPhotos]=useState(false)
  const [activePhoto,setActivePhoto]=useState<string|null>(null)
  const [printMode,setPrintMode]=useState<null|'sticker'|'detail'|'history'>(null)
  const photos: string[] = value.images ?? []
  const rows = [['Mã định danh',value.code],['Tên thiết bị',value.name],['Nhóm',value.category],['Vị trí',value.location],['Hãng',value.brand],['Model',value.model],['Serial',value.serial],['Ngày đưa vào sử dụng',dateText(value.commissionedAt)],['Công suất / thông số',value.power],['Chu kỳ bảo trì',value.cycle],['Tình trạng',value.status],['Ghi chú',value.notes]]
  const print = (mode:'sticker'|'detail'|'history') => { setPrintMode(mode); window.setTimeout(()=>window.print(),180) }
  return <Modal title="Chi tiết thiết bị" close={()=>{setPrintMode(null);close()}}>
    <div className="asset-qr-panel"><div><small>MÃ QR THIẾT BỊ</small><b>{value.code}</b><span>Quét mã để tra cứu hồ sơ thiết bị</span></div><QRCodeSVG value={value.code} size={116} level="M" includeMargin/></div>
    <div className="asset-detail-grid">{rows.map(([label,val])=><div className="asset-detail-field" key={label}><small>{label}</small><b>{val||'—'}</b></div>)}</div>
    <div className="asset-photo-actions">
      <button type="button" className="soft-btn" onClick={()=>setShowPhotos(v=>!v)}><ImageIcon size={16}/> {showPhotos?'Ẩn ảnh':'Xem ảnh ('+photos.length+')'}</button>
      <button type="button" className="soft-btn" onClick={()=>print('sticker')}><QrCode size={16}/> In tem QR</button>
      <button type="button" className="soft-btn" onClick={()=>print('detail')}><Download size={16}/> In chi tiết</button>
      <button type="button" className="primary-btn" onClick={addLog}><Wrench size={16}/> Ghi nhận bảo trì / sửa chữa</button>
      <button type="button" className="primary-btn" onClick={edit}>Sửa hồ sơ</button>
    </div>
    <section className="asset-maintenance-history"><div className="panel-head"><div><h3>Lịch sử bảo trì – sửa chữa</h3><p>{logs.length} lần ghi nhận của thiết bị</p></div><button type="button" className="soft-btn" disabled={!logs.length} onClick={()=>print('history')}><Download size={15}/> In quá trình</button></div>
      {logs.length?<div className="maintenance-history-list">{logs.slice().sort((a:any,b:any)=>b.date.localeCompare(a.date)).map((entry:any)=><article key={entry.id}><time>{dateText(entry.date)}</time><div><b>{entry.kind}</b><p>{entry.description||'Không có mô tả'}</p>{entry.parts&&<small>Vật tư/phụ tùng: {entry.parts}</small>}{entry.readings&&<small>Thông số: {entry.readings}</small>}<small>Kết quả sau thực hiện: {entry.result||'Chưa đánh giá'}</small><small>Người thực hiện: {entry.performedBy||'—'}</small></div></article>)}</div>:<p className="muted">Chưa có lịch sử. Hãy chọn “Ghi nhận bảo trì / sửa chữa” sau khi thực hiện công việc.</p>}
    </section>
    {showPhotos&&<div className="asset-photo-grid">{photos.length?photos.map((src:string,i:number)=><button type="button" className="asset-photo-thumb" key={i} onClick={()=>setActivePhoto(src)}><img src={src} alt={'Ảnh '+(i+1)+' của '+value.name}/><span>Ảnh {i+1}</span></button>):<p className="muted">Thiết bị này chưa có ảnh. Chọn “Sửa hồ sơ” để bổ sung ảnh.</p>}</div>}
    {activePhoto&&<div className="photo-lightbox" onClick={()=>setActivePhoto(null)}><button type="button" className="icon-btn" onClick={()=>setActivePhoto(null)}><X/></button><img src={activePhoto} alt={'Ảnh thiết bị '+value.name}/></div>}
    {printMode&&<div className={'asset-print-sheet print-'+printMode}>
      {printMode==='sticker'&&<div className="asset-sticker"><QRCodeSVG value={value.code} size={78} level="M"/><strong>{value.code}</strong></div>}
      {printMode==='detail'&&<div className="asset-print-report"><h1 className="asset-print-form-title">BẢNG CHI TIẾT THIẾT BỊ</h1><div className="asset-print-header"><div className="company-logo-placeholder"><span className="company-logo-mark">BT</span><span className="company-logo-wording"><strong>BAOTRI</strong><small>LOGO THỬ NGHIỆM</small></span></div><QRCodeSVG className="asset-print-header-qr" value={value.code} size={104} level="M"/></div><h2 className="asset-print-device-name">{value.name}</h2><table><tbody>{rows.map(([label,val])=><tr key={label}><th>{label}</th><td>{val||'—'}</td></tr>)}</tbody></table></div>}
      {printMode==='history'&&<div className="asset-print-report"><h1>LỊCH SỬ BẢO TRÌ – SỬA CHỮA</h1><h2>{value.name}</h2><b>Mã thiết bị: {value.code}</b><table><thead><tr><th>Ngày</th><th>Loại</th><th>Nội dung</th><th>Phụ tùng</th><th>Thông số</th><th>Kết quả</th><th>Người thực hiện</th></tr></thead><tbody>{logs.map((entry:any)=><tr key={entry.id}><td>{dateText(entry.date)}</td><td>{entry.kind}</td><td>{entry.description}</td><td>{entry.parts||'—'}</td><td>{entry.readings||'—'}</td><td>{entry.result||'Chưa đánh giá'}</td><td>{entry.performedBy||'—'}</td></tr>)}</tbody></table></div>}
    </div>}
  </Modal>
}
function LogEntryModal({value,close,save}:any){
  const [v,setV]=useState<Log>(value)
  const set = <K extends keyof Log,>(key: K, val: Log[K]) => setV(p => ({ ...p, [key]: val }))
  return <Modal title="Ghi nhận bảo trì / sửa chữa" close={close}><form className="form-grid" onSubmit={e=>{e.preventDefault();if(!v.description.trim())return alert('Nhập nội dung công việc');save(v)}}>
    <Field label="Ngày thực hiện"><input type="date" value={v.date} onChange={e=>set('date',e.target.value)}/></Field>
    <Field label="Loại công việc"><select value={v.kind} onChange={e=>set('kind',e.target.value)}>{['Bảo trì định kỳ','Sửa chữa','Thay thế phụ tùng','Kiểm tra','Hiệu chuẩn','Khác'].map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Nội dung thực hiện *"><textarea required value={v.description} onChange={e=>set('description',e.target.value)}/></Field>
    <Field label="Vật tư / phụ tùng thay thế"><textarea value={v.parts} onChange={e=>set('parts',e.target.value)}/></Field>
    <Field label="Thông số sau thực hiện"><textarea value={v.readings} onChange={e=>set('readings',e.target.value)}/></Field><Field label="Kết quả sau thực hiện"><div className="result-choice"><label><input type="radio" name="maintenance-result" checked={v.result==='Đạt'} onChange={()=>set('result','Đạt')}/> Đạt</label><label><input type="radio" name="maintenance-result" checked={v.result==='Không đạt'} onChange={()=>set('result','Không đạt')}/> Không đạt</label></div></Field>
    <Field label="Người thực hiện"><input value={v.performedBy} onChange={e=>set('performedBy',e.target.value)}/></Field>
    <div className="form-actions"><button type="button" className="soft-btn" onClick={close}>Hủy</button><button type="submit" className="primary-btn">Lưu lịch sử</button></div>
  </form></Modal>
}

function AssetModal({value,close,save,assets}:any){
  const [v,setV]=useState<Asset>(value)
  const isNew=!value.code
  const set=(k:keyof Asset,x:any)=>setV(p=>({...p,[k]:x}))
  const previewCode=isNew&&ASSET_CATEGORY_CODES[v.category]?buildAssetCode(v,assets):''
  const fanCategories=['Quạt công nghiệp','Quạt hút','Quạt cấp','Quạt thông gió','Quạt làm mát','Quạt hướng trục','Quạt ly tâm']
  const nameSuggestsFan=/quạt/i.test(v.name)
  const categoryIsFan=fanCategories.includes(v.category)
  const showCategoryWarning=Boolean(v.name.trim())&&nameSuggestsFan!==categoryIsFan
  return <Modal title={isNew?'Thêm thiết bị':'Thông tin thiết bị'} close={close}><form onSubmit={e=>{e.preventDefault();if(!v.name.trim())return alert('Nhập tên thiết bị');if(!ASSET_CATEGORY_CODES[v.category])return alert('Chọn nhóm thiết bị hợp lệ trong danh mục chuẩn');save(v)}} className="form-grid">
    <Field label="Tên thiết bị *"><input required value={v.name} placeholder="Ví dụ: Quạt hút khu vực đóng gói số 1" onChange={e=>set('name',e.target.value)}/></Field>
    <Field label="Nhóm thiết bị *"><select required disabled={!isNew} value={v.category} onChange={e=>set('category',e.target.value)}><option value="">-- Chọn nhóm thiết bị --</option>{ASSET_CATEGORY_GROUPS.map(group=><optgroup key={group.label} label={group.label}>{group.items.map(item=><option key={item.name} value={item.name}>{item.name} · {item.code}</option>)}</optgroup>)}</select>{!isNew&&<small className="muted">Nhóm đã khóa sau khi cấp mã để tránh mã định danh không còn đúng loại thiết bị.</small>}</Field>
    {showCategoryWarning&&<div className="form-hint warning-hint">Tên thiết bị có từ “quạt” nhưng nhóm đang chọn không thuộc danh mục quạt (hoặc ngược lại). Hãy kiểm tra lại; hệ thống không tự đổi nhóm.</div>}
    <Field label="Vị trí lắp đặt"><input value={v.location} placeholder="Ví dụ: Nhà xưởng A" onChange={e=>set('location',e.target.value)}/></Field>
    <Field label="Hãng"><input value={v.brand} onChange={e=>set('brand',e.target.value)}/></Field><Field label="Model"><input value={v.model} onChange={e=>set('model',e.target.value)}/></Field>
    <Field label="Serial"><input value={v.serial} onChange={e=>set('serial',e.target.value)}/></Field><Field label="Ngày đưa vào sử dụng"><input type="date" value={v.commissionedAt} onChange={e=>set('commissionedAt',e.target.value)}/></Field>
    <Field label="Công suất / thông số"><input value={v.power} onChange={e=>set('power',e.target.value)}/></Field><Field label="Chu kỳ bảo trì"><select value={v.cycle} onChange={e=>set('cycle',e.target.value)}>{['Hàng ngày','Hàng tuần','Hàng tháng','Hàng quý','6 tháng','Hàng năm','Theo giờ chạy',''].map(x=><option key={x} value={x}>{x||'Chưa thiết lập'}</option>)}</select></Field>
    <Field label="Tình trạng thiết bị"><select value={v.status} onChange={e=>set('status',e.target.value)}>{['Đang hoạt động','Đang sửa chữa','Ngừng sử dụng','Thanh lý'].map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Ghi chú"><input value={v.notes} onChange={e=>set('notes',e.target.value)}/></Field>
    {isNew&&<div className="asset-transfer-option"><label><input type="checkbox" checked={!!v.transferredFromOtherFacility} onChange={e=>set('transferredFromOtherFacility',e.target.checked)}/> Thiết bị được chuyển từ cơ sở khác đến</label><small>Cơ sở tiếp nhận hiện tại: {RECEIVING_FACILITY_CODE}. Khi đánh dấu, hệ thống tự thêm đúng một dấu * vào cuối mã định danh.</small></div>}
    {isNew&&<div className="asset-code-preview"><span>MÃ ĐỊNH DANH DỰ KIẾN</span><strong>{previewCode||'— Chọn nhóm thiết bị để xem mã —'}</strong><small>Mã được cấp chính thức khi lưu thiết bị. QR sẽ được tạo từ toàn bộ mã này.</small></div>}
    <div className="asset-images-field"><label className="field"><span>Ảnh thiết bị (có thể chọn nhiều ảnh)</span><input type="file" accept="image/*" multiple onChange={async e=>{const files=Array.from(e.target.files??[]);const current=v.images??[];const remaining=Math.max(0,8-current.length);const selected=files.slice(0,remaining);const loaded=await Promise.all(selected.map(file=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file)})));set('images',[...current,...loaded]);e.target.value=''}}/></label>
      <div className="asset-photo-grid">{(v.images??[]).map((src:string,i:number)=><div className="asset-photo-thumb" key={i}><img src={src} alt={'Ảnh thiết bị '+(i+1)}/><button type="button" className="text-btn danger" onClick={()=>set('images',(v.images??[]).filter((_:string,index:number)=>index!==i))}>Xóa ảnh</button></div>)}</div>
      <small className="muted">Tối đa 8 ảnh/hồ sơ. Ảnh được lưu cùng dữ liệu thiết bị trong trình duyệt hiện tại; khi chuyển sang máy chủ sẽ cần chuyển ảnh lên kho lưu trữ trực tuyến.</small>
    </div>
    <div className="modal-actions"><button type="button" className="soft-btn" onClick={close}>Hủy</button><button className="primary-btn" disabled={isNew&&!previewCode}><Check size={16}/> {isNew?'Lưu và tạo mã thiết bị':'Lưu thiết bị'}</button></div>
  </form></Modal>
}
function ItemModal({value,close,save}:any){
  const [v,setV]=useState<InventoryItem>(value); const set=(k:keyof InventoryItem,x:any)=>setV(p=>({...p,[k]:x}))
  const units=['Cái','Con','Cuộn','m','mm','cm','Lít','ml','Kg','g','Bộ','Chai','Hộp','Túi','Thùng','Tấm','Ống','Viên','Đôi','Mét','Cuộn dây','Bao','Thanh','Can']
  const groups=['Vật tư điện','Linh kiện điện tử','Cơ khí','Khí nén','Điện lạnh','Dầu mỡ bôi trơn','Vòng bi - bạc đạn','Phớt - gioăng','Vật tư đường ống','Vật tư tiêu hao','Vật tư hàn cắt','Dây cáp điện','Khác']
  return <Modal title="Thông tin vật tư" close={close}><form className="form-grid" onSubmit={e=>{e.preventDefault();if(!v.code||!v.name)return alert('Nhập mã vật tư và tên vật tư');save(v)}}>
    <Field label="Mã vật tư *"><input required value={v.code} onChange={e=>set('code',e.target.value.toUpperCase())}/></Field><Field label="Mã số"><input value={v.partNumber??''} onChange={e=>set('partNumber',e.target.value)}/></Field>
    <Field label="Tên vật tư *"><input required value={v.name} onChange={e=>set('name',e.target.value)}/></Field><Field label="Nhóm"><select value={v.group} onChange={e=>set('group',e.target.value)}>{groups.map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Kích cỡ / quy cách"><input placeholder="Ví dụ: DN50, M10, 6204, 2.5 mm..." value={v.size??''} onChange={e=>set('size',e.target.value)}/></Field>
    <Field label="Đơn vị tính"><select value={v.unit} onChange={e=>set('unit',e.target.value)}>{!units.includes(v.unit)&&<option value={v.unit}>{v.unit}</option>}{units.map(x=><option key={x} value={x}>{x}</option>)}</select></Field>
    <Field label="Số lượng tồn"><input type="number" min="0" value={v.quantity} onChange={e=>set('quantity',Number(e.target.value))}/></Field><Field label="Tồn tối thiểu"><input type="number" min="0" value={v.minQuantity} onChange={e=>set('minQuantity',Number(e.target.value))}/></Field>
    <Field label="Vị trí lưu kho"><input value={v.location} onChange={e=>set('location',e.target.value)}/></Field><Field label="Nhà cung cấp"><input value={v.supplier} onChange={e=>set('supplier',e.target.value)}/></Field>
    <Field label="Đơn giá tham khảo"><input type="number" min="0" value={v.unitPrice} onChange={e=>set('unitPrice',Number(e.target.value))}/></Field>
    <div className="modal-actions"><button type="button" className="soft-btn" onClick={close}>Hủy</button><button className="primary-btn"><Check size={16}/> Lưu vật tư</button></div>
  </form></Modal>
}
function InventoryDetailModal({value,close,edit}:any){
  const rows=[['Mã vật tư',value.code],['Mã số',value.partNumber],['Tên vật tư',value.name],['Nhóm',value.group],['Kích cỡ / quy cách',value.size],['Đơn vị tính',value.unit],['Số lượng tồn',String(value.quantity)+' '+value.unit],['Tồn tối thiểu',String(value.minQuantity)+' '+value.unit],['Vị trí lưu kho',value.location],['Nhà cung cấp',value.supplier],['Đơn giá tham khảo',Number(value.unitPrice||0).toLocaleString('vi-VN')+' VNĐ'],['Cập nhật lần cuối',value.updatedAt?new Date(value.updatedAt).toLocaleString('vi-VN'):'—']]
  const print=()=>{window.setTimeout(()=>window.print(),100)}
  return <Modal title="Chi tiết vật tư" close={close}><div className="asset-detail-grid">{rows.map(([label,val])=><div className="asset-detail-field" key={label}><small>{label}</small><b>{val||'—'}</b></div>)}</div><div className="asset-photo-actions"><button className="soft-btn" onClick={print}><Printer size={16}/> In chi tiết</button><button className="primary-btn" onClick={edit}>Sửa vật tư</button></div><div className="asset-print-sheet print-detail"><div className="asset-print-report"><h1 className="asset-print-form-title">BẢNG CHI TIẾT VẬT TƯ</h1><div className="asset-print-header"><div className="company-logo-placeholder"><span className="company-logo-mark">BT</span><span className="company-logo-wording"><strong>BAOTRI</strong><small>LOGO THỬ NGHIỆM</small></span></div></div><h2 className="asset-print-device-name">{value.name}</h2><table><tbody>{rows.map(([label,val])=><tr key={label}><th>{label}</th><td>{val||'—'}</td></tr>)}</tbody></table></div></div></Modal>
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
