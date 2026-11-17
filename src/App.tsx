import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import AuthScreen from './AuthScreen'
import CloudAssetsPanel from './CloudAssetsPanel'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Activity, Archive, BarChart3, Building2, CalendarDays, Check, ChevronRight, ClipboardList,
  Download, FileSpreadsheet, Printer, HardDrive, LayoutDashboard, Menu, MoreHorizontal, Package,
  Plus, QrCode, Search, Settings, ShieldAlert, Trash2, UserRound, Wrench, X, ChevronDown, Image as ImageIcon,
  Phone, Mail
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import namingConventionText from '../QUY_UOC_MA_DINH_DANH_VA_VIET_TAT_THIET_BI.txt?raw'
import { db, uid, now, queueChange, type Asset, type InventoryItem, type Task, type MaintenancePlan, type MaintenancePlanPeriod, type Movement, type Log, type ChecklistTemplateItem, type ChecklistTemplateVersion, type ChecklistResultItem, type ChecklistResult } from './db'
import { downloadExcelReport } from './lib/excelExport'

type Page = 'dashboard' | 'checklist' | 'assets' | 'inventory' | 'planning' | 'tasks' | 'logs' | 'reports' | 'settings'

// Chỉ bật trong giai đoạn thử nghiệm. Khi nghiệm thu Checklist, đổi duy nhất thành false để bắt buộc quét QR.
const CHECKLIST_TEST_MODE = false
const xmlEntities: Record<string, string> = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}
const xmlText = (value: string) => value.replace(/[&<>"']/g, ch => xmlEntities[ch] ?? ch)
const htmlEscape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] ?? ch))
const makeDemoAssetImage = (category: string, code: string, view: number) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f5f8f7"/><stop offset="1" stop-color="#dce8e3"/></linearGradient><linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#edf3f2"/><stop offset="1" stop-color="#879b98"/></linearGradient></defs><rect width="960" height="640" fill="url(#bg)"/><path d="M0 510H960" stroke="#c5d4ce" stroke-width="3"/><g transform="translate(${view===1?120:165},105)"><ellipse cx="360" cy="405" rx="300" ry="35" fill="#6e8980" opacity=".18"/><rect x="105" y="180" width="510" height="210" rx="28" fill="url(#metal)" stroke="#536d67" stroke-width="9"/><rect x="145" y="215" width="220" height="140" rx="16" fill="${view===1?'#287d70':'#4c789d'}"/><rect x="390" y="215" width="180" height="140" rx="12" fill="#d4dfdc" stroke="#536d67" stroke-width="6"/><circle cx="480" cy="285" r="43" fill="#f8fbfa" stroke="#536d67" stroke-width="8"/><path d="M480 250v70M445 285h70" stroke="#287d70" stroke-width="8"/><rect x="170" y="390" width="45" height="45" rx="7" fill="#344f49"/><rect x="505" y="390" width="45" height="45" rx="7" fill="#344f49"/><path d="M130 180V145h465v35" fill="none" stroke="#536d67" stroke-width="10"/><circle cx="190" cy="245" r="12" fill="#f4c66c"/><circle cx="230" cy="245" r="12" fill="#e8796d"/></g><rect x="42" y="38" width="876" height="564" rx="22" fill="none" stroke="#ffffff" stroke-width="5" opacity=".8"/><text x="58" y="78" font-family="Arial,sans-serif" font-size="25" font-weight="700" fill="#34534b">BAOTRI · ẢNH MINH HỌA THIẾT BỊ</text><text x="58" y="570" font-family="Arial,sans-serif" font-size="22" fill="#526d65">${xmlText(category)} · ${xmlText(code)} · Góc nhìn ${view}</text></svg>`
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg)
}
const today = () => new Date().toISOString().slice(0, 10)

type ChecklistFrequency = 'Hàng ngày' | 'Hàng tuần' | 'Hàng tháng' | 'Hàng quý' | 'Hàng năm'
type ChecklistScheduleRow = { asset: Asset; dueDate: string; completed: boolean; isMakeup: boolean; result?: string; missingTemplate?: boolean }
const CHECKLIST_FREQUENCIES: ChecklistFrequency[] = ['Hàng ngày','Hàng tuần','Hàng tháng','Hàng quý','Hàng năm']
const parseChecklistDate = (value: string) => new Date(value.slice(0,10)+'T00:00:00.000Z')
const formatChecklistDate = (value: Date) => value.toISOString().slice(0,10)
function checklistOccurrenceDate(anchor: string, frequency: ChecklistFrequency, index: number) {
  const base = parseChecklistDate(anchor)
  if (frequency === 'Hàng ngày') base.setUTCDate(base.getUTCDate()+index)
  else if (frequency === 'Hàng tuần') base.setUTCDate(base.getUTCDate()+index*7)
  else {
    const months = frequency === 'Hàng tháng' ? index : frequency === 'Hàng quý' ? index*3 : index*12
    const day = base.getUTCDate()
    const monthStart = new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+months,1))
    const lastDay = new Date(Date.UTC(monthStart.getUTCFullYear(),monthStart.getUTCMonth()+1,0)).getUTCDate()
    monthStart.setUTCDate(Math.min(day,lastDay))
    return formatChecklistDate(monthStart)
  }
  return formatChecklistDate(base)
}
function buildChecklistScheduleRows(assets: Asset[], templates: any[], results: ChecklistResult[], frequency: ChecklistFrequency, asOf: string): ChecklistScheduleRow[] {
  const rows: ChecklistScheduleRow[] = []
  for (const asset of assets.filter(item=>!item.archivedAt && item.cycle===frequency)) {
    const template = templates.find(item=>item.assetId===asset.id && item.active!==false)
    if (!template) {
      rows.push({asset,dueDate:'',completed:false,isMakeup:false,missingTemplate:true})
      continue
    }
    const templateDate = String(template.createdAt || asset.updatedAt || asset.commissionedAt || asOf).slice(0,10)
    const cycleDate = String(asset.cycleStartedAt || templateDate).slice(0,10)
    const anchor = cycleDate > templateDate ? cycleDate : templateDate
    const assetResults = results.filter(item=>item.assetId===asset.id)
    for (let index=0; index<5000; index++) {
      const dueDate = checklistOccurrenceDate(anchor,frequency,index)
      if (dueDate>asOf) break
      const nextDate = checklistOccurrenceDate(anchor,frequency,index+1)
      const matched = assetResults.find(item=>item.scheduledFor===dueDate) ??
        assetResults.find(item=>!item.scheduledFor && item.performedAt.slice(0,10)>=dueDate && item.performedAt.slice(0,10)<nextDate)
      const performedDate = matched?.performedAt.slice(0,10) ?? ''
      rows.push({asset,dueDate,completed:Boolean(matched),isMakeup:Boolean(matched && (matched.isMakeup || performedDate>dueDate)),result:matched?.result})
    }
  }
  return rows.sort((a,b)=>{
    if(a.completed!==b.completed) return a.completed?1:-1
    const dateOrder = a.completed ? b.dueDate.localeCompare(a.dueDate) : a.dueDate.localeCompare(b.dueDate)
    return dateOrder || a.asset.name.localeCompare(b.asset.name,'vi')
  })
}

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
function maintenancePlanRange(period: MaintenancePlanPeriod, anchorDate: string) {
  const anchor = new Date(`${anchorDate.slice(0, 10)}T00:00:00.000Z`)
  const year = anchor.getUTCFullYear()
  const month = anchor.getUTCMonth()
  let start: Date
  let end: Date
  if (period === 'Tuần') {
    start = new Date(anchor)
    start.setUTCDate(anchor.getUTCDate() - ((anchor.getUTCDay() + 6) % 7))
    end = new Date(start)
    end.setUTCDate(start.getUTCDate() + 6)
  } else if (period === 'Tháng') {
    start = new Date(Date.UTC(year, month, 1))
    end = new Date(Date.UTC(year, month + 1, 0))
  } else if (period === 'Quý') {
    const firstMonth = Math.floor(month / 3) * 3
    start = new Date(Date.UTC(year, firstMonth, 1))
    end = new Date(Date.UTC(year, firstMonth + 3, 0))
  } else {
    start = new Date(Date.UTC(year, 0, 1))
    end = new Date(Date.UTC(year, 11, 31))
  }
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
}
function maintenancePlanPeriodsFor(period: MaintenancePlanPeriod): MaintenancePlanPeriod[] {
  if (period === 'Tuần') return ['Tuần']
  if (period === 'Tháng') return ['Tuần', 'Tháng']
  if (period === 'Quý') return ['Tuần', 'Tháng', 'Quý']
  return ['Tuần', 'Tháng', 'Quý', 'Năm']
}
const MAINTENANCE_PLAN_PERIOD_ORDER: Record<MaintenancePlanPeriod, number> = { Tuần: 0, Tháng: 1, Quý: 2, Năm: 3 }
const MAINTENANCE_PLAN_PERIOD_SLUG: Record<MaintenancePlanPeriod, string> = { Tuần: 'tuan', Tháng: 'thang', Quý: 'quy', Năm: 'nam' }
function maintenancePlanScopeLabel(period: MaintenancePlanPeriod) {
  if (period === 'Tuần') return 'chỉ kế hoạch tuần'
  if (period === 'Tháng') return 'gồm kế hoạch tháng và tuần'
  if (period === 'Quý') return 'gồm kế hoạch quý, tháng và tuần'
  return 'gồm kế hoạch năm, quý, tháng và tuần'
}
function sortMaintenancePlansByDate(plans: MaintenancePlan[], assets: Asset[]) {
  return [...plans].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate) || MAINTENANCE_PLAN_PERIOD_ORDER[a.period]-MAINTENANCE_PLAN_PERIOD_ORDER[b.period] || (assets.find(item=>item.id===a.assetId)?.code??'').localeCompare(assets.find(item=>item.id===b.assetId)?.code??'','vi') || a.title.localeCompare(b.title, 'vi'))
}
const emptyMaintenancePlan = (period: MaintenancePlanPeriod, anchorDate = today()): MaintenancePlan => {
  const range = maintenancePlanRange(period, anchorDate)
  return {
    id: uid(), assetId: '', title: '', period, ...range, execution: 'Nội bộ',
    contractor: '', notes: '', createdAt: now(), updatedAt: now()
  }
}
const MAINTENANCE_PLAN_YEARS = Array.from({ length: 101 }, (_, index) => String(2000 + index))
function periodRangeLabel(period: MaintenancePlanPeriod, range: { startDate: string; endDate: string }) {
  if (period === 'Tuần') return `Tuần ${dateText(range.startDate)} – ${dateText(range.endDate)}`
  if (period === 'Tháng') return `Tháng ${range.startDate.slice(5, 7)}/${range.startDate.slice(0, 4)}`
  if (period === 'Quý') return `Quý ${Math.floor((Number(range.startDate.slice(5, 7)) - 1) / 3) + 1}/${range.startDate.slice(0, 4)}`
  return `Năm ${range.startDate.slice(0, 4)}`
}
const completedWorkDate = (log: Log) => log.completedAt?.slice(0, 10) || log.date

// Danh mục chuẩn: mã nhóm không phụ thuộc tên người dùng nhập.
const ASSET_CATEGORY_GROUPS = [
 {label:'Điện – điện tử – tự động hóa',items:[
  {name:'Thiết bị điện',code:'TDE'},{name:'Tủ điện',code:'TDI'},{name:'Tủ điện tổng',code:'TDT'},{name:'Tủ điện phân phối',code:'TDP'},{name:'Tủ điều khiển',code:'TDC'},
  {name:'Biến tần',code:'BT'},{name:'UPS',code:'UPS'},{name:'Máy biến áp',code:'MBA'},{name:'Thiết bị đo lường',code:'DDL'},{name:'Động cơ điện',code:'DCD'},
  {name:'Bộ chuyển nguồn ATS',code:'ATS'},{name:'Tủ tụ bù',code:'TCB'},{name:'PLC',code:'PLC'},{name:'HMI',code:'HMI'},{name:'Cảm biến',code:'CBI'},
  {name:'Bộ nguồn điện',code:'BND'},{name:'Thiết bị điện tử',code:'TDTU'},{name:'Bo mạch điện tử',code:'BMD'},{name:'Rơ le – contactor',code:'RLC'}
 ]},
 {label:'Cơ khí – máy móc – truyền động',items:[
  {name:'Máy bơm',code:'MB'},{name:'Thiết bị xưởng',code:'TBX'},{name:'Thang máy',code:'TM'},{name:'Hộp giảm tốc',code:'HGT'},{name:'Băng tải',code:'BTA'},
  {name:'Máy tiện',code:'MTI'},{name:'Máy phay',code:'MPH'},{name:'Máy khoan bàn',code:'MKB'},{name:'Máy cưa',code:'MCA'},{name:'Máy ép',code:'MEP'},
  {name:'Máy dập',code:'MDP'},{name:'Máy CNC',code:'CNC'},{name:'Máy nén thủy lực',code:'NTH'},{name:'Hệ thống thủy lực',code:'HTL'},
  {name:'Thiết bị nâng hạ',code:'TNH'},{name:'Pa lăng – tời',code:'PLT'},{name:'Cầu trục',code:'CTR'},{name:'Xe nâng',code:'XNA'}
 ]},
 {label:'Công cụ – dụng cụ điện',items:[
  {name:'Công cụ điện cầm tay',code:'CDT'},{name:'Máy khoan cầm tay',code:'MKT'},{name:'Máy mài',code:'MMA'},{name:'Máy cắt',code:'MCA2'},
  {name:'Máy siết bu lông',code:'MSB'},{name:'Máy chà nhám',code:'MCN'},{name:'Máy thổi bụi',code:'MTB'},{name:'Máy hút bụi công nghiệp',code:'HBI'},
  {name:'Dụng cụ đo điện',code:'DDE'},{name:'Dụng cụ cơ khí',code:'DCK'}
 ]},
 {label:'Hàn – cắt – gia công',items:[
  {name:'Máy hàn',code:'HAN'},{name:'Máy hàn xung',code:'MHX'},{name:'Máy hàn MIG/MAG',code:'MIG'},{name:'Máy hàn TIG',code:'TIG'},
  {name:'Máy hàn que',code:'MHQ'},{name:'Máy cắt plasma',code:'MCP'},{name:'Máy cắt gas',code:'MCG'},{name:'Máy cắt kim loại',code:'MCK'},
  {name:'Máy uốn',code:'MUN'},{name:'Máy đột lỗ',code:'MDL'}
 ]},
 {label:'Quạt công nghiệp',items:[
  {name:'Quạt công nghiệp',code:'QCN'},{name:'Quạt hút',code:'QH'},{name:'Quạt cấp',code:'QC'},{name:'Quạt thông gió',code:'QTG'},
  {name:'Quạt làm mát',code:'QLM'},{name:'Quạt hướng trục',code:'QK'},{name:'Quạt ly tâm',code:'QLT'}
 ]},
 {label:'Khí nén – nhiệt – lạnh – HVAC',items:[
  {name:'Máy nén khí',code:'MNA'},{name:'Máy sấy khí',code:'MSK'},{name:'Bộ lọc khí nén',code:'BLK'},{name:'Khí nén',code:'KN'},
  {name:'Kho lạnh',code:'KLA'},{name:'Điều hòa thông gió',code:'DHT'},{name:'Chiller',code:'CHL'},{name:'Tháp giải nhiệt',code:'TGN'},
  {name:'Nồi hơi',code:'NH'},{name:'Nồi hấp',code:'NHA'},{name:'Máy lạnh',code:'MLA'},{name:'Máy hút ẩm',code:'MHA2'},
  {name:'Máy sưởi',code:'MSU'},{name:'Hệ thống HVAC',code:'HVAC'}
 ]},
 {label:'Nguồn điện – an toàn – PCCC',items:[
  {name:'Máy phát điện',code:'MPD'},{name:'Phòng cháy chữa cháy',code:'PCCC'},{name:'Hệ thống tiếp địa',code:'HTD'},
  {name:'Chống sét',code:'CSE'},{name:'Đèn chiếu sáng',code:'DCS'},{name:'Thiết bị an toàn',code:'TBA'}
 ]},
 {label:'Thiết bị sản xuất – đóng gói – phụ trợ',items:[
  {name:'Máy đóng gói',code:'MDG'},{name:'Máy chiết rót',code:'MCR'},{name:'Máy dán nhãn',code:'MDN'},{name:'Máy in công nghiệp',code:'MIC'},
  {name:'Máy trộn',code:'MTR'},{name:'Máy nghiền',code:'MNG'},{name:'Máy sàng',code:'MSA'},{name:'Máy sấy công nghiệp',code:'MSC'},
  {name:'Máy ép nhựa',code:'MEN'},{name:'Robot công nghiệp',code:'RBT'},{name:'Thiết bị xử lý nước',code:'XLN'},{name:'Hệ thống lọc bụi',code:'LBU'}
 ]},
 {label:'Nhóm khác',items:[{name:'Khác',code:'KHC'}]}
] as const
const ASSET_CATEGORY_CODES: Record<string,string> = Object.fromEntries(ASSET_CATEGORY_GROUPS.flatMap(g=>g.items.map(i=>[i.name,i.code])))
type CustomAssetCategory = { name: string; code: string }
type CustomAssetCategoryGroup = { label: string; items: CustomAssetCategory[] }
const getAssetCategoryCodes = (custom: CustomAssetCategoryGroup[] = []): Record<string,string> => ({...ASSET_CATEGORY_CODES,...Object.fromEntries(custom.flatMap(group=>group.items.map(item=>[item.name,item.code])))})
const suggestAssetCategory = (name:string) => {
 const n=name.toLocaleLowerCase('vi')
 const rules:[RegExp,string][]=[
  [/hàn.*xung|xung.*hàn/,'Máy hàn xung'],[/hàn.*mig|mig.*hàn/,'Máy hàn MIG/MAG'],[/hàn.*tig|tig.*hàn/,'Máy hàn TIG'],
  [/hàn.*que|que.*hàn/,'Máy hàn que'],[/máy hàn/,'Máy hàn'],[/plasma/,'Máy cắt plasma'],
  [/máy khoan.*bàn|khoan bàn/,'Máy khoan bàn'],[/máy khoan|khoan pin/,'Máy khoan cầm tay'],
  [/máy mài|máy mài góc/,'Máy mài'],[/máy cắt/,'Máy cắt'],[/siết.*bu lông|siết.*bulong/,'Máy siết bu lông'],
  [/máy tiện/,'Máy tiện'],[/máy phay/,'Máy phay'],[/máy ép/,'Máy ép'],[/máy dập/,'Máy dập'],
  [/máy nén khí/,'Máy nén khí'],[/máy bơm|bơm nước/,'Máy bơm'],[/động cơ/,'Động cơ điện'],
  [/quạt hút/,'Quạt hút'],[/quạt cấp/,'Quạt cấp'],[/quạt/,'Quạt công nghiệp'],
  [/chiller/,'Chiller'],[/kho lạnh/,'Kho lạnh'],[/ups/,'UPS'],[/biến tần/,'Biến tần'],[/plc/,'PLC']
 ]
 return rules.find(([pattern])=>pattern.test(n))?.[1] ?? ''
}
const ASSET_LOCATION_CODES: Record<string,string> = {'Phòng máy nén khí':'01','Khu sản xuất':'02','Phòng bơm tầng hầm':'03','Dây chuyền 1':'04','Khu xử lý bụi':'05','Nhà xưởng A':'06','Khu kỹ thuật':'07','Phòng kỹ thuật tầng 1':'08','Tầng 2':'09','Khu vực Chiller':'10','Sân kỹ thuật mái':'11','Phòng máy phát điện':'12','Phòng điện tổng':'13','Tầng 1':'14','Phòng bơm':'15','Phòng IT':'16','Trạm biến áp':'17','Nhà lò hơi':'18','Xưởng bảo trì':'19','Sảnh chính':'20','Phòng bơm PCCC':'21','Đường ống khí nén':'22','Hố gom tầng hầm':'23'}
const RECEIVING_FACILITY_CODE='HP01'
const buildAssetCode=(asset:Asset,allAssets:Asset[],customCategories:CustomAssetCategoryGroup[] = [])=>{
 const typeCode=getAssetCategoryCodes(customCategories)[asset.category]
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
const dateTimeText = (s?: string) => s ? new Date(s).toLocaleString('vi-VN') : '—'

type EmployeeProfile = { fullName: string; phone: string; dateOfBirth: string; position: string }

function AppWorkspace({ userName, userEmail, profile, onSaveProfile, onSignOut, organizationId, organizationName, organizationRole, cloudClient }: {
  userName: string
  userEmail: string
  profile: EmployeeProfile
  onSaveProfile: (value: EmployeeProfile) => Promise<void>
  onSignOut: () => void
  organizationId: string
  organizationName: string
  organizationRole: string
  cloudClient: SupabaseClient
}) {
  const isViewer = organizationRole.trim().toLowerCase() === 'viewer'
  const [page, setPage] = useState<Page>('dashboard')
  const [showCloudAssets, setShowCloudAssets] = useState(false)
  const [search, setSearch] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [compact, setCompact] = useState(false)
  const [profileEditOpen, setProfileEditOpen] = useState(false)
  const [modal, setModal] = useState<'asset'|'item'|'task'|'plan'|'planExport'|'log'|'scan'|null>(null)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null)
  const [checklistAccess, setChecklistAccess] = useState(false)
  const [checklistFrequency,setChecklistFrequency] = useState<ChecklistFrequency>('Hàng ngày')
  const [pendingChecklistOccurrence,setPendingChecklistOccurrence] = useState<{assetId:string;scheduledFor?:string;isMakeup:boolean}|null>(null)
  const [activeChecklistOccurrence,setActiveChecklistOccurrence] = useState<{scheduledFor?:string;isMakeup:boolean}|null>(null)
  const [assetCategoryFilter, setAssetCategoryFilter] = useState('')
  const [customAssetCategories, setCustomAssetCategories] = useState<CustomAssetCategoryGroup[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('baotri-custom-asset-categories') || '[]')
      if (!Array.isArray(saved)) return []
      if (saved.every((x:any)=>x&&typeof x.label==='string'&&Array.isArray(x.items))) return saved.filter((g:any)=>g.label&&g.items.length).map((g:any)=>({label:g.label,items:g.items.filter((i:any)=>i&&typeof i.name==='string'&&typeof i.code==='string')}))
      const legacy = saved.filter((x:any)=>x&&typeof x.name==='string'&&typeof x.code==='string')
      return legacy.length ? [{label:'Danh mục bổ sung (cũ)',items:legacy}] : []
    } catch { return [] }
  })
  const [assetLocationFilter, setAssetLocationFilter] = useState('')
  const [assetStatusFilter, setAssetStatusFilter] = useState('')
  const [assetSort, setAssetSort] = useState('code-asc')
  const [showArchived, setShowArchived] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editingPlan, setEditingPlan] = useState<MaintenancePlan | null>(null)
  const [planPeriod, setPlanPeriod] = useState<MaintenancePlanPeriod>('Năm')
  const [planAnchorDate, setPlanAnchorDate] = useState(today())
  const [planExportPeriod, setPlanExportPeriod] = useState<MaintenancePlanPeriod>('Năm')
  const [planExportAnchorDate, setPlanExportAnchorDate] = useState(today())
  const [planExportAllPeriods, setPlanExportAllPeriods] = useState(false)
  const [reportPeriod, setReportPeriod] = useState<MaintenancePlanPeriod>('Tháng')
  const [reportAnchorDate, setReportAnchorDate] = useState(today())
  const [editingLog, setEditingLog] = useState<Log | null>(null)
  const [notice, setNotice] = useState('')
  const [mobileMore, setMobileMore] = useState(false)
  const assets = useLiveQuery(() => db.assets.orderBy('name').toArray(), []) ?? []
  const activeAssets = assets.filter(a => !a.archivedAt)
  const archivedAssets = assets.filter(a => !!a.archivedAt)
  const inventory = useLiveQuery(() => db.inventory.orderBy('name').toArray(), []) ?? []
  const movements = useLiveQuery(() => db.movements.orderBy('date').reverse().toArray(), []) ?? []
  const tasks = useLiveQuery(() => db.tasks.orderBy('dueDate').toArray(), []) ?? []
  const maintenancePlans = useLiveQuery(() => db.maintenancePlans.orderBy('startDate').toArray(), []) ?? []
  const logs = useLiveQuery(() => db.logs.orderBy('date').reverse().toArray(), []) ?? []
  const checklistTemplates = useLiveQuery(() => db.checklistTemplates.toArray(), []) ?? []
  const allChecklistResults = useLiveQuery(() => db.checklistResults.toArray(), []) ?? []
  const queueCount = useLiveQuery(() => db.syncQueue.count(), []) ?? 0



  useEffect(() => {
    const savedTheme = localStorage.getItem('baotri-theme') as 'light' | 'dark' | null
    const savedCompact = localStorage.getItem('baotri-compact') === 'true'
    if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme)
    setCompact(savedCompact)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('baotri-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('baotri-compact', String(compact))
  }, [compact])

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
      // Khởi tạo biểu mẫu riêng cho mọi thiết bị đang quản lý; không đụng vào biểu mẫu đã có.
      const checklistAssets = (await db.assets.toArray()).filter(asset => !asset.archivedAt)
      for (const asset of checklistAssets) await ensureDefaultChecklist(asset)
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
  const checklistScheduleRows = useMemo(() => buildChecklistScheduleRows(activeAssets,checklistTemplates,allChecklistResults,checklistFrequency,today()).filter(row=>!search.trim() || [row.asset.code,row.asset.name,row.asset.location].join(' ').toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))),[activeAssets,checklistTemplates,allChecklistResults,checklistFrequency,search])
  const filteredItems = useMemo(() => inventory.filter(a => `${a.code} ${a.name} ${a.group}`.toLowerCase().includes(search.toLowerCase())), [inventory, search])
  const filteredTasks = useMemo(() => tasks.filter(t => `${t.title} ${assets.find(a=>a.id===t.assetId)?.name ?? ''}`.toLowerCase().includes(search.toLowerCase())), [tasks, assets, search])
  const maintenancePlanPeriodRange = useMemo(() => maintenancePlanRange(planPeriod, planAnchorDate), [planPeriod, planAnchorDate])
  const planExportRange = useMemo(() => planExportAllPeriods && planExportPeriod !== 'Năm'
    ? maintenancePlanRange('Năm', `${planExportAnchorDate.slice(0, 4)}-01-01`)
    : maintenancePlanRange(planExportPeriod, planExportAnchorDate),
  [planExportAllPeriods, planExportPeriod, planExportAnchorDate])
  const maintenancePlansForPeriod = useMemo(() => maintenancePlans
    .filter(plan => maintenancePlanPeriodsFor(planPeriod).includes(plan.period))
    .filter(plan => plan.startDate <= maintenancePlanPeriodRange.endDate && plan.endDate >= maintenancePlanPeriodRange.startDate),
  [maintenancePlans, planPeriod, maintenancePlanPeriodRange])
  const filteredMaintenancePlans = useMemo(() => sortMaintenancePlansByDate(maintenancePlansForPeriod
    .filter(plan => {
      const asset = assets.find(item => item.id === plan.assetId)
      return `${plan.title} ${asset?.code ?? ''} ${asset?.name ?? ''} ${plan.contractor} ${plan.notes}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))
    }), assets),
  [maintenancePlansForPeriod, assets, search])
  const plannedAssetIds = useMemo(() => new Set(maintenancePlansForPeriod.map(plan => plan.assetId)), [maintenancePlansForPeriod])
  const unplannedMaintenanceAssets = useMemo(() => activeAssets.filter(asset => !plannedAssetIds.has(asset.id)), [activeAssets, plannedAssetIds])
  const reportPeriodRange = useMemo(() => maintenancePlanRange(reportPeriod, reportAnchorDate), [reportPeriod, reportAnchorDate])
  const reportWorkLogs = useMemo(() => logs
    .filter(log => Boolean(log.result) && completedWorkDate(log) >= reportPeriodRange.startDate && completedWorkDate(log) <= reportPeriodRange.endDate)
    .filter(log => {
      const asset = assets.find(item => item.id === log.assetId)
      return `${log.kind} ${log.description} ${asset?.code ?? ''} ${asset?.name ?? ''} ${log.performedBy}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))
    }),
  [logs, reportPeriodRange, assets, search])
  const reportMaterialMovements = useMemo(() => movements
    .filter(movement => movement.type === 'Xuất' && movement.date >= reportPeriodRange.startDate && movement.date <= reportPeriodRange.endDate),
  [movements, reportPeriodRange])
  const reportMaterialUsage = useMemo(() => {
    const grouped = new Map<string, { itemId: string; quantity: number; transactions: number }>()
    for (const movement of reportMaterialMovements) {
      const row = grouped.get(movement.itemId) ?? { itemId: movement.itemId, quantity: 0, transactions: 0 }
      row.quantity += movement.quantity
      row.transactions += 1
      grouped.set(movement.itemId, row)
    }
    const query = search.trim().toLocaleLowerCase('vi')
    return [...grouped.values()].map(row => {
      const item = inventory.find(value => value.id === row.itemId)
      return {
        ...row,
        item,
        matches: `${item?.code ?? ''} ${item?.name ?? ''} ${item?.group ?? ''}`.toLocaleLowerCase('vi').includes(query)
      }
    }).filter(row => row.matches).sort((a, b) => (a.item?.name ?? '').localeCompare(b.item?.name ?? '', 'vi'))
  }, [reportMaterialMovements, inventory, search])
  const reportBrokenAssets = useMemo(() => activeAssets.filter(asset => asset.status === 'Đang sửa chữa'), [activeAssets])
  const overdue = tasks.filter(t => t.status !== 'Hoàn thành' && t.dueDate < today()).length
  const dueToday = tasks.filter(t => t.dueDate === today() && t.status !== 'Hoàn thành')
  const lowStock = inventory.filter(i => i.quantity <= i.minQuantity)

  const flash = (s: string) => { setNotice(s); setTimeout(() => setNotice(''), 2800) }
  const blockViewer = (action: string) => {
    if (!isViewer) return false
    flash(`Tài khoản Viewer chỉ có quyền xem, không được phép ${action}.`)
    return true
  }
  const addAssetCategory = (groupName: string, itemName: string, code: string, existingGroup = false) => {
    if (blockViewer('thay đổi danh mục thiết bị')) return false
    const cleanGroup = groupName.trim()
    const cleanName = itemName.trim()
    const cleanCode = code.trim().toUpperCase()
    const allCodes = getAssetCategoryCodes(customAssetCategories)
    if (!cleanGroup) { alert('Nhập tên nhóm thiết bị.'); return false }
    if (!cleanName) { alert('Nhập tên loại thiết bị.'); return false }
    if (!/^[A-Z0-9]{2,5}$/.test(cleanCode)) { alert('Mã loại thiết bị gồm 2–5 ký tự chữ không dấu hoặc số.'); return false }
    if (Object.keys(allCodes).some(x=>x.toLocaleLowerCase('vi')===cleanName.toLocaleLowerCase('vi'))) { alert('Tên loại thiết bị đã tồn tại trong danh mục.'); return false }
    if (Object.values(allCodes).includes(cleanCode)) { alert('Mã loại thiết bị đã được sử dụng.'); return false }
    const groupIndex = customAssetCategories.findIndex(g=>g.label.toLocaleLowerCase('vi')===cleanGroup.toLocaleLowerCase('vi'))
    if (existingGroup && groupIndex<0) { alert('Không tìm thấy nhóm đã chọn.'); return false }
    if (!existingGroup && (ASSET_CATEGORY_GROUPS.some(g=>g.label.toLocaleLowerCase('vi')===cleanGroup.toLocaleLowerCase('vi')) || groupIndex>=0)) { alert('Tên nhóm đã tồn tại. Hãy chọn nhóm đó để thêm loại thiết bị.'); return false }
    const next = groupIndex>=0
      ? customAssetCategories.map((g,i)=>i===groupIndex?{...g,items:[...g.items,{name:cleanName,code:cleanCode}]}:g)
      : [...customAssetCategories,{label:cleanGroup,items:[{name:cleanName,code:cleanCode}]}]
    try { localStorage.setItem('baotri-custom-asset-categories',JSON.stringify(next)) } catch { alert('Không lưu được danh mục trong trình duyệt.'); return false }
    setCustomAssetCategories(next)
    return true
  }
  const exportAssetCodeConvention = () => {
    const marker = '[[BAOTRI_CUSTOM_ASSET_CODES]]'
    if (!namingConventionText.includes(marker)) {
      alert('Không tìm thấy vị trí danh mục bổ sung trong tài liệu Quy ước mã.')
      return
    }
    const customCodeList = customAssetCategories.length
      ? customAssetCategories.map(group => [
          group.label,
          ...group.items.map(item => `${item.code.padEnd(8, ' ')}${item.name}`)
        ].join('\n')).join('\n\n')
      : 'Chưa có nhóm hoặc loại thiết bị bổ sung.'
    const content = namingConventionText.replace(marker, customCodeList)
    const blob = new Blob(['\uFEFF', content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'QUY_UOC_MA_DINH_DANH_VA_VIET_TAT_THIET_BI.txt'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    flash('Đã xuất tài liệu Quy ước mã thiết bị')
  }

  const saveAsset = async (a: Asset) => {
    if (blockViewer('thêm hoặc sửa thiết bị')) return
    const isNew = !a.code
    if (isNew && !getAssetCategoryCodes(customAssetCategories)[a.category]) {
      alert('Bạn cần chọn một nhóm thiết bị hợp lệ để hệ thống cấp mã định danh.')
      return
    }
    try {
      // Cấp số trong cùng transaction với thao tác ghi để hai tab trên cùng trình duyệt
      // không cùng đọc một số thứ tự rồi tạo ra hai mã giống nhau.
      const value = await db.transaction('rw', [db.assets, db.syncQueue], async () => {
        const previousAsset = isNew ? undefined : await db.assets.get(a.id)
        const allAssets = await db.assets.toArray()
        const code = isNew ? buildAssetCode(a, allAssets, customAssetCategories) : a.code
        if (!code) throw new Error('Không thể tạo mã định danh. Hãy kiểm tra lại nhóm thiết bị.')
        if (isNew && allAssets.some(item => item.code === code)) {
          throw new Error('Mã định danh vừa được sử dụng. Vui lòng lưu lại để hệ thống cấp số tiếp theo.')
        }
        const cycleStartedAt = a.cycle
          ? (previousAsset?.cycle === a.cycle ? (previousAsset.cycleStartedAt || undefined) : today())
          : undefined
        const saved: Asset = { ...a, code, cycleStartedAt, images: a.images ?? [], updatedAt: now() }
        await db.assets.put(saved)
        await db.syncQueue.put({ id: uid(), tableName: 'assets', recordId: saved.id, operation: 'upsert', queuedAt: now() })
        return saved
      })
      setModal(null); setEditingAsset(null)
      if (isNew) setDetailAsset(value)
      flash(isNew ? 'Đã thêm thiết bị và cấp mã định danh' : 'Đã lưu thiết bị')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không thể lưu thiết bị. Vui lòng thử lại.')
    }
  }
  const saveItem = async (i: InventoryItem) => {
    if (blockViewer('thêm hoặc sửa vật tư')) return
    const value = { ...i, updatedAt: now() }
    await db.inventory.put(value); await queueChange('inventory', value.id); setModal(null); setEditingItem(null); flash('Đã lưu vật tư')
  }
  const saveTask = async (t: Task) => {
    if (blockViewer('thêm hoặc sửa công việc')) return
    const value = { ...t, updatedAt: now() }
    await db.tasks.put(value); await queueChange('tasks', value.id); setModal(null); setEditingTask(null); flash('Đã lưu công việc')
  }
  const saveMaintenancePlans = async (plans: MaintenancePlan[]) => {
    if (blockViewer('thêm hoặc sửa kế hoạch bảo trì')) return
    if (plans.some(plan => plan.startDate > plan.endDate)) {
      alert('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.')
      return
    }
    const timestamp = now()
    const values = plans.map(plan => ({ ...plan, title: plan.title.trim(), contractor: plan.contractor.trim(), notes: plan.notes.trim(), updatedAt: timestamp }))
    await db.transaction('rw', [db.maintenancePlans, db.syncQueue], async () => {
      await db.maintenancePlans.bulkPut(values)
      await Promise.all(values.map(value => queueChange('maintenancePlans', value.id)))
    })
    setModal(null); setEditingPlan(null)
    flash(values.length > 1 ? `Đã lưu kế hoạch cho ${values.length} thiết bị` : 'Đã lưu kế hoạch bảo trì')
  }
  const deleteMaintenancePlan = async (plan: MaintenancePlan) => {
    if (blockViewer('xóa kế hoạch bảo trì')) return
    if (!confirm(`Xóa kế hoạch “${plan.title}”?`)) return
    await db.maintenancePlans.delete(plan.id)
    await queueChange('maintenancePlans', plan.id, 'delete')
    flash('Đã xóa kế hoạch bảo trì')
  }
  const saveLog = async (entry: Log) => {
    if (blockViewer('tạo hoặc cập nhật phiếu bảo dưỡng – sửa chữa')) return
    const existing = await db.logs.get(entry.id)
    const completedAt = entry.result ? entry.completedAt || existing?.completedAt || now() : undefined
    const value: Log = { ...entry, performedBy: entry.performedBy.trim() || userName, result: entry.result || '', completedAt }
    await db.logs.put(value); await queueChange('logs', value.id)
    setModal(null); setEditingLog(null)
    flash(value.result ? 'Đã lưu phiếu hoàn thành' : 'Đã lưu phiếu, đang chờ kết quả')
  }
  const createRepairFromChecklist = (entry: ChecklistResult) => {
    if (blockViewer('tạo phiếu sửa chữa từ Checklist')) return
    const failedItems = entry.items.filter(item => item.answer === 'Không đạt' || item.answer === 'Không')
    const description = `Phát hiện từ Checklist ${entry.templateTitle} · phiên bản ${entry.templateVersion} · ${new Date(entry.performedAt).toLocaleString('vi-VN')}\n` +
      failedItems.map((item, index) => `${index + 1}. ${item.label}${item.note ? ` — ${item.note}` : ''}`).join('\n')
    setEditingLog({ id: uid(), assetId: entry.assetId, checklistResultId: entry.id, date: today(), kind: 'Sửa chữa', description, parts: '', readings: '', result: '', performedBy: userName })
    setDetailAsset(null); setChecklistAccess(false); setModal('log')
  }
  const completeTask = async (t: Task) => {
    if (blockViewer('ghi nhận hoàn thành công việc')) return
    const completedAt = now()
    const completed = { ...t, status: 'Hoàn thành' as const, completedAt, updatedAt: completedAt }
    await db.transaction('rw', db.tasks, db.logs, async () => {
      await db.tasks.put(completed)
      await db.logs.add({ id: uid(), assetId: t.assetId, taskId: t.id, date: today(), kind: 'Bảo dưỡng định kỳ', description: t.title, parts: '', readings: t.readings, result: 'Đạt', completedAt, performedBy: userName })
    })
    await queueChange('tasks', t.id); flash('Đã ghi nhận hoàn thành')
  }
  const archiveAsset = async (a: Asset) => {
    if (blockViewer('đưa thiết bị vào lưu kho')) return
    if (!confirm(`Đưa “${a.name}” vào Lưu kho? Hồ sơ, ảnh và lịch sử liên quan vẫn được giữ để tra cứu hoặc khôi phục.`)) return
    const value = { ...a, archivedAt: now(), updatedAt: now() }
    await db.assets.put(value); await queueChange('assets', a.id); flash('Đã đưa thiết bị vào Lưu kho')
  }
  const restoreAsset = async (a: Asset) => {
    if (blockViewer('khôi phục thiết bị')) return
    const value = { ...a, archivedAt: undefined, updatedAt: now() }
    await db.assets.put(value); await queueChange('assets', a.id); flash('Đã khôi phục thiết bị khỏi Lưu kho')
  }
  const changeAssetStatus = async (a: Asset, status: Asset['status']) => {
    if (blockViewer('thay đổi tình trạng thiết bị')) return
    if (status === 'Thanh lý' && !confirm(`Xác nhận thanh lý “${a.name}”? Hồ sơ và lịch sử vẫn được giữ để tra cứu; đây không phải xóa vĩnh viễn.`)) return
    const value = { ...a, status, updatedAt: now() }
    await db.assets.put(value); await queueChange('assets', a.id); flash(`Đã cập nhật trạng thái: ${status}`)
  }
  const addMovement = async (item: InventoryItem, type: 'Nhập'|'Xuất', qty: number) => {
    if (blockViewer('nhập hoặc xuất kho')) return
    if (!qty || qty <= 0) return
    if (type === 'Xuất' && qty > item.quantity) { flash('Số lượng xuất vượt tồn kho'); return }
    const next = { ...item, quantity: item.quantity + (type === 'Nhập' ? qty : -qty), updatedAt: now() }
    await db.transaction('rw', db.inventory, db.movements, async () => {
      await db.inventory.put(next)
      await db.movements.add({ id: uid(), itemId: item.id, date: today(), type, quantity: qty, reason: 'Thao tác từ màn hình kho' })
    })
    await queueChange('inventory', item.id); flash(`Đã ${type.toLowerCase()} ${qty} ${item.unit}`)
  }
  const exportRows = async (rows: Record<string, string | number>[], filename: string, title: string, sheetName: string, headers: string[], orientation: 'portrait' | 'landscape' = 'landscape') => {
    if (blockViewer('xuất Excel')) return
    flash('Đang chuẩn bị tệp Excel…')
    try {
      await downloadExcelReport(rows, filename, title, sheetName, headers, orientation)
    flash(`Đã xuất Excel: ${filename}`)
    } catch (error) {
      console.error('Không thể xuất tệp Excel:', error)
      flash('Xuất Excel thất bại. Vui lòng thử lại.')
    }
  }
  const exportAssets = () => {
    const headers = ['STT','Mã định danh','Tên thiết bị','Nhóm thiết bị','Hãng','Model','Serial','Vị trí lắp đặt','Ngày đưa vào sử dụng','Công suất / thông số','Tình trạng','Ghi chú']
    exportRows(filteredAssets.map(asset => ({
      'Mã định danh':asset.code||'',
      'Tên thiết bị':asset.name||'',
      'Nhóm thiết bị':asset.category||'',
      'Hãng':asset.brand||'',
      'Model':asset.model||'',
      'Serial':asset.serial||'',
      'Vị trí lắp đặt':asset.location||'',
      'Ngày đưa vào sử dụng':asset.commissionedAt?dateText(asset.commissionedAt):'',
      'Công suất / thông số':asset.power||'',
      'Tình trạng':asset.status||'',
      'Ghi chú':asset.notes||''
    })), 'danh-sach-thiet-bi.xlsx', 'DANH SÁCH THIẾT BỊ', 'Danh sách thiết bị', headers.slice(1))
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
  const exportInventory = () => exportRows(inventory.map(i => ({ 'Mã vật tư':i.code,'Mã số':i.partNumber??'','Tên vật tư':i.name,'Nhóm':i.group,'Kích cỡ':i.size??'','ĐVT':i.unit,'Tồn kho':i.quantity,'Tồn tối thiểu':i.minQuantity,'Vị trí':i.location,'Nhà cung cấp':i.supplier,'Đơn giá (VNĐ)':i.unitPrice })), 'ton-kho-vat-tu.xlsx', 'BÁO CÁO TỒN KHO VẬT TƯ', 'Tồn kho vật tư', ['Mã vật tư','Mã số','Tên vật tư','Nhóm','Kích cỡ','ĐVT','Tồn kho','Tồn tối thiểu','Vị trí','Nhà cung cấp','Đơn giá (VNĐ)'], 'landscape')
  const printInventory = () => {
    const rows = filteredItems.map((i,index)=>'<tr><td class="center">'+(index+1)+'</td><td>'+htmlEscape(i.code)+'</td><td>'+htmlEscape(i.partNumber||'—')+'</td><td><strong>'+htmlEscape(i.name)+'</strong></td><td>'+htmlEscape(i.group)+'</td><td>'+htmlEscape(i.size||'—')+'</td><td class="center">'+htmlEscape(i.unit)+'</td><td class="num">'+i.quantity+'</td><td class="num">'+i.minQuantity+'</td><td>'+htmlEscape(i.location||'—')+'</td><td>'+htmlEscape(i.supplier||'—')+'</td><td class="num">'+Number(i.unitPrice||0).toLocaleString('vi-VN')+'</td></tr>').join('')
    const printWindow=window.open('','_blank')
    if(!printWindow){alert('Trình duyệt đang chặn cửa sổ in. Hãy cho phép cửa sổ bật lên rồi thử lại.');return}
    const headers=['STT','Mã vật tư','Mã số','Tên vật tư','Nhóm','Kích cỡ','ĐVT','Tồn kho','Tồn tối thiểu','Vị trí lưu kho','Nhà cung cấp','Đơn giá (VNĐ)']
    const html='<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/><title>DANH SÁCH VẬT TƯ</title><style>@page{size:A4 landscape;margin:12mm 8mm 16mm;@bottom-center{content:"Trang " counter(page) " / " counter(pages);font:9pt Tahoma}}*{box-sizing:border-box}body{font-family:Tahoma,sans-serif;font-size:11pt;color:#111;margin:0}h1{text-align:center;font-size:12pt;margin:0 0 12pt}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}th,td{border:1px solid #333;padding:4pt 3pt;vertical-align:top;overflow-wrap:anywhere;font-size:9pt}th{text-align:center;font-weight:bold;background:#e9eeeb!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.center{text-align:center}.num{text-align:right}.total{text-align:right;font-weight:bold;margin-top:10pt}@media screen{body{padding:16px}}</style></head><body><h1>DANH SÁCH VẬT TƯ</h1><table><colgroup><col style="width:3%"/><col style="width:8%"/><col style="width:8%"/><col style="width:15%"/><col style="width:9%"/><col style="width:8%"/><col style="width:5%"/><col style="width:6%"/><col style="width:7%"/><col style="width:10%"/><col style="width:10%"/><col style="width:11%"/></colgroup><thead><tr>'+headers.map(h=>'<th>'+htmlEscape(h)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table><p class="total">Tổng số: '+filteredItems.length+' vật tư</p></body></html>'
    printWindow.document.open();printWindow.document.write(html);printWindow.document.close();printWindow.focus();printWindow.onafterprint=()=>printWindow.close();printWindow.print()
  }
  const exportTasks = () => exportRows(tasks.map(t => ({ 'Thiết bị':assets.find(a=>a.id===t.assetId)?.name ?? '', 'Công việc':t.title,'Ngày đến hạn':t.dueDate?dateText(t.dueDate):'','Chu kỳ':t.frequency,'Trạng thái':t.status,'Checklist':t.checklist??'','Thông số':t.readings??'','Ghi chú':t.notes??'' })), 'lich-bao-duong-dinh-ky.xlsx', 'LỊCH BẢO DƯỠNG ĐỊNH KỲ', 'Lịch bảo dưỡng', ['Thiết bị','Công việc','Ngày đến hạn','Chu kỳ','Trạng thái','Checklist','Thông số','Ghi chú'], 'landscape')
  const openMaintenancePlanExport = () => {
    setPlanExportPeriod(planPeriod)
    setPlanExportAnchorDate(planAnchorDate)
    setPlanExportAllPeriods(false)
    setModal('planExport')
  }
  const exportMaintenancePlans = () => {
    if (blockViewer('xuất Excel')) return
    const exportAllInYear = planExportPeriod !== 'Năm' && planExportAllPeriods
    const exportRange = exportAllInYear
      ? maintenancePlanRange('Năm', `${planExportAnchorDate.slice(0, 4)}-01-01`)
      : maintenancePlanRange(planExportPeriod, planExportAnchorDate)
    const exportPlans = sortMaintenancePlansByDate(maintenancePlans.filter(plan =>
      maintenancePlanPeriodsFor(planExportPeriod).includes(plan.period) &&
      plan.startDate <= exportRange.endDate &&
      plan.endDate >= exportRange.startDate
    ), assets)
    if (exportPlans.length === 0) {
      alert('Không có kế hoạch trong phạm vi đã chọn.')
      return
    }
    const year = exportRange.startDate.slice(0, 4)
    const periodLabel = exportAllInYear
      ? `Toàn bộ kế hoạch ${planExportPeriod.toLocaleLowerCase('vi')} trong năm ${year}`
      : periodRangeLabel(planExportPeriod, exportRange)
    const headers = ['Kỳ kế hoạch','Thời gian dự kiến','Mã thiết bị','Tên thiết bị','Nhóm thiết bị','Vị trí','Nội dung bảo trì','Hình thức thực hiện','Đơn vị thuê ngoài','Ghi chú']
    const rows = exportPlans.map(plan => {
      const asset = assets.find(item => item.id === plan.assetId)
      return {
        'Kỳ kế hoạch': plan.period,
        'Thời gian dự kiến': `${dateText(plan.startDate)} – ${dateText(plan.endDate)}`,
        'Mã thiết bị': asset?.code ?? '',
        'Tên thiết bị': asset?.name ?? '',
        'Nhóm thiết bị': asset?.category ?? '',
        'Vị trí': asset?.location ?? '',
        'Nội dung bảo trì': plan.title,
        'Hình thức thực hiện': plan.execution,
        'Đơn vị thuê ngoài': plan.execution === 'Thuê ngoài' ? plan.contractor : '',
        'Ghi chú': plan.notes
      }
    })
    const periodId = exportAllInYear
      ? `toan-bo-nam-${year}`
      : planExportPeriod === 'Tuần'
        ? exportRange.startDate
        : planExportPeriod === 'Tháng'
          ? exportRange.startDate.slice(0, 7)
          : planExportPeriod === 'Quý'
            ? `${year}-q${Math.floor((Number(exportRange.startDate.slice(5, 7))-1)/3)+1}`
            : year
    const reportTitle = `KẾ HOẠCH BẢO TRÌ · ${periodLabel.toLocaleUpperCase('vi')} · ${maintenancePlanScopeLabel(planExportPeriod).toLocaleUpperCase('vi')}`
    exportRows(rows, `ke-hoach-bao-tri-${MAINTENANCE_PLAN_PERIOD_SLUG[planExportPeriod]}-${periodId}.xlsx`, reportTitle, 'Kế hoạch bảo trì', headers, 'landscape')
    setModal(null)
  }
  const exportLogs = () => exportRows(logs.map(l => ({
    'Ngày lập phiếu':dateText(l.date),
    'Thiết bị':assets.find(a=>a.id===l.assetId)?.name ?? '',
    'Nội dung công việc':[l.kind,l.description].filter(Boolean).join('\n'),
    'Thông số / vật tư':[l.readings?`Thông số: ${l.readings}`:'',l.parts?`Vật tư: ${l.parts}`:''].filter(Boolean).join('\n'),
    'Kết quả / trạng thái':[`Trạng thái: ${l.result?'Hoàn thành':'Chưa hoàn thành'}`,`Kết quả: ${l.result||'Chưa cập nhật'}`].join('\n'),
    'Người thực hiện':l.performedBy||'',
    'Hoàn thành lúc':l.completedAt?dateTimeText(l.completedAt):''
  })), 'bao-duong-sua-chua.xlsx', 'PHIẾU BẢO DƯỠNG – SỬA CHỮA', 'Phiếu bảo dưỡng', ['Ngày lập phiếu','Thiết bị','Nội dung công việc','Thông số / vật tư','Kết quả / trạng thái','Người thực hiện','Hoàn thành lúc'], 'portrait')
  const reportTitleSuffix = periodRangeLabel(reportPeriod, reportPeriodRange).toLocaleUpperCase('vi')
  const exportReportWork = () => exportRows(reportWorkLogs.map(log => {
    const asset = assets.find(item => item.id === log.assetId)
    return {
      'Ngày hoàn thành': dateText(completedWorkDate(log)),
      'Mã thiết bị': asset?.code ?? '',
      'Tên thiết bị': asset?.name ?? '',
      'Loại công việc': log.kind,
      'Nội dung bảo trì / sửa chữa': log.description,
      'Vật tư ghi nhận trên phiếu': log.parts || '',
      'Người thực hiện': log.performedBy || '',
      'Kết quả': log.result || 'Chưa cập nhật'
    }
  }), `bao-cao-cong-viec-${reportPeriodRange.startDate}.xlsx`, `BÁO CÁO CÔNG VIỆC BẢO TRÌ · ${reportTitleSuffix}`, 'Công việc bảo trì', ['Ngày hoàn thành','Mã thiết bị','Tên thiết bị','Loại công việc','Nội dung bảo trì / sửa chữa','Vật tư ghi nhận trên phiếu','Người thực hiện','Kết quả'], 'landscape')
  const exportReportMaterials = () => exportRows(reportMaterialUsage.map(row => ({
    'Mã vật tư': row.item?.code ?? 'Không còn trong danh mục',
    'Tên vật tư': row.item?.name ?? row.itemId,
    'Nhóm vật tư': row.item?.group ?? '',
    'ĐVT': row.item?.unit ?? '',
    'Số lượng xuất trong kỳ': row.quantity,
    'Số lượt xuất': row.transactions,
    'Tồn kho hiện tại': row.item?.quantity ?? '—',
    'Vị trí lưu kho': row.item?.location ?? ''
  })), `bao-cao-vat-tu-${reportPeriodRange.startDate}.xlsx`, `BÁO CÁO SỬ DỤNG VẬT TƯ · ${reportTitleSuffix}`, 'Vật tư sử dụng', ['Mã vật tư','Tên vật tư','Nhóm vật tư','ĐVT','Số lượng xuất trong kỳ','Số lượt xuất','Tồn kho hiện tại','Vị trí lưu kho'], 'landscape')
  const exportReportAssets = () => {
    const brokenCodes = reportBrokenAssets.map(asset => asset.code).join(', ')
    const headers = ['Loại thông tin','Số lượng','Mã thiết bị','Tên thiết bị','Nhóm thiết bị','Vị trí','Tình trạng hiện tại']
    const rows: Record<string, string | number>[] = [
      { 'Loại thông tin':'Tổng thiết bị chưa lưu kho','Số lượng':activeAssets.length },
      { 'Loại thông tin':'Đang hoạt động','Số lượng':activeAssets.filter(asset=>asset.status==='Đang hoạt động').length },
      { 'Loại thông tin':'Hỏng / đang sửa chữa','Số lượng':reportBrokenAssets.length,'Mã thiết bị':brokenCodes },
      { 'Loại thông tin':'Ngừng sử dụng / thanh lý','Số lượng':activeAssets.filter(asset=>asset.status==='Ngừng sử dụng'||asset.status==='Thanh lý').length },
      ...reportBrokenAssets.map(asset=>({
        'Loại thông tin':'Thiết bị hỏng / đang sửa chữa',
        'Số lượng':1,
        'Mã thiết bị':asset.code,
        'Tên thiết bị':asset.name,
        'Nhóm thiết bị':asset.category,
        'Vị trí':asset.location,
        'Tình trạng hiện tại':asset.status
      }))
    ]
    exportRows(rows, `bao-cao-tinh-trang-thiet-bi-${today()}.xlsx`, `BÁO CÁO TÌNH TRẠNG THIẾT BỊ · ${dateText(today())}`, 'Tình trạng thiết bị', headers, 'landscape')
  }
  const backup = async () => {
    if (blockViewer('sao lưu dữ liệu')) return
    const data = {
      backupVersion: 2,
      exportedAt: now(),
      database: 'baotri-local-v1',
      assets: await db.assets.toArray(),
      inventory: await db.inventory.toArray(),
      tasks: await db.tasks.toArray(),
      logs: await db.logs.toArray(),
      movements: await db.movements.toArray(),
      maintenancePlans: await db.maintenancePlans.toArray(),
      checklistTemplates: await db.checklistTemplates.toArray(),
      checklistVersions: await db.checklistVersions.toArray(),
      checklistResults: await db.checklistResults.toArray(),
      syncQueue: await db.syncQueue.toArray(),
      customAssetCategories: customAssetCategories
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `backup-baotri-day-du-${today()}.json`; a.click(); URL.revokeObjectURL(url)
  }
  const restore = async (file: File) => {
    if (blockViewer('khôi phục dữ liệu từ bản sao lưu')) return
    try {
      const data = JSON.parse(await file.text())
      const tableKeys = ['assets','inventory','tasks','logs','movements','maintenancePlans','checklistTemplates','checklistVersions','checklistResults','syncQueue']
      if (!data || typeof data !== 'object' || tableKeys.some(key => data[key] !== undefined && !Array.isArray(data[key]))) {
        throw new Error('Invalid backup structure')
      }
      await db.transaction('rw', [db.assets, db.inventory, db.tasks, db.logs, db.movements, db.maintenancePlans, db.checklistTemplates, db.checklistVersions, db.checklistResults, db.syncQueue], async () => {
        await db.assets.bulkPut(data.assets ?? []); await db.inventory.bulkPut(data.inventory ?? [])
        await db.tasks.bulkPut(data.tasks ?? []); await db.logs.bulkPut(data.logs ?? []); await db.movements.bulkPut(data.movements ?? [])
        await db.maintenancePlans.bulkPut(data.maintenancePlans ?? [])
        await db.checklistTemplates.bulkPut(data.checklistTemplates ?? [])
        await db.checklistVersions.bulkPut(data.checklistVersions ?? [])
        await db.checklistResults.bulkPut(data.checklistResults ?? [])
        await db.syncQueue.bulkPut(data.syncQueue ?? [])
      })
      if (Array.isArray(data.customAssetCategories)) {
        localStorage.setItem('baotri-custom-asset-categories', JSON.stringify(data.customAssetCategories))
        setCustomAssetCategories(data.customAssetCategories)
      }
      flash('Đã nhập dữ liệu sao lưu')
    } catch { flash('File sao lưu không hợp lệ hoặc không thể khôi phục') }
  }

  const nav = [
    ['dashboard','Tổng quan',LayoutDashboard],
    ['checklist','Bảo trì – Checklist',ClipboardList],
    ['assets','Thiết bị',HardDrive],
    ['inventory','Kho vật tư',Package],
    ['planning','Kế hoạch bảo trì',CalendarDays],
    ['logs','Bảo dưỡng – Sửa chữa',Wrench],
    ['reports','Báo cáo',BarChart3],
    ['settings','Cài đặt',Settings]
  ] as const

  return <div className={`app-shell ${theme} ${compact ? 'compact-mode' : ''}`}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><Wrench size={21}/></div><div><b>BAOTRI</b><small>QUẢN LÝ BẢO TRÌ</small></div></div>
      <div className="nav-label">MENU CHÍNH</div>
      {nav.map(([key,label,Icon]) => <button key={key} className={`nav-item ${page===key || (key==='planning'&&page==='tasks')?'active':''}`} onClick={()=>{setPage(key);setSearch('');if(key==='assets'||key==='checklist')setShowArchived(false)}}><Icon size={18}/><span>{label}</span>{key==='planning' && overdue>0 && <em>{overdue}</em>}</button>)}
      <div className="sidebar-bottom"><div className="offline-pill"><span className="online-dot"/> Bản thử nghiệm · Dữ liệu lưu cục bộ</div><small>Phiên bản 0.1.0</small></div>
    </aside>
    <nav className="mobile-nav" aria-label="Điều hướng chính">
      {([['dashboard','Tổng quan',LayoutDashboard],['checklist','Checklist',ClipboardList],['assets','Thiết bị',HardDrive],['planning','Kế hoạch bảo trì',CalendarDays]] as const).map(([key,label,Icon]) =>
        <button key={key} className={`mobile-nav-item ${page===key || (key==='planning'&&page==='tasks')?'active':''}`} onClick={()=>{setPage(key);setSearch('');setMobileMore(false)}}><Icon size={19}/><span>{label}</span>{key==='planning'&&overdue>0&&<i>{overdue}</i>}</button>
      )}
      <button className={`mobile-nav-item ${mobileMore||(['inventory','logs','tasks','reports','settings'] as Page[]).includes(page)?'active':''}`} onClick={()=>setMobileMore(v=>!v)}><MoreHorizontal size={20}/><span>Thêm</span></button>
    </nav>
    <main className="main">
      <header className="topbar">
        <div className="page-heading"><div className="eyebrow">HỆ THỐNG QUẢN LÝ KỸ THUẬT</div><h1>{nav.find(n=>n[0]===page)?.[1] ?? (page==='tasks'?'Lịch bảo dưỡng định kỳ':'')}</h1></div>
        <div className="top-actions">
          <div className="workspace-chip"><Building2 size={16}/><span><b>{organizationName}</b><small>Supabase · quyền {organizationRole}</small></span></div>
          <button className="icon-btn" title="Quét QR" onClick={()=>setModal('scan')}><QrCode size={19}/></button>
          {page!=='planning'&&page!=='checklist'&&<button className="primary-btn" disabled={isViewer} title={isViewer?'Viewer chỉ có quyền xem':undefined} onClick={()=>{ if(page==='assets'){setEditingAsset(emptyAsset());setModal('asset')} else if(page==='inventory'){setEditingItem(emptyItem());setModal('item')} else if(page==='tasks'){setEditingTask(emptyTask());setModal('task')} else if(page==='logs'){setEditingLog({id:uid(),assetId:'',date:today(),kind:'Sửa chữa',description:'',parts:'',readings:'',result:'',performedBy:userName});setModal('log')} else {setPage('assets');setEditingAsset(emptyAsset());setModal('asset')} }}><Plus size={17}/><span>Thêm mới</span></button>}
          <button className="profile-chip" title="Mở hồ sơ trong Cài đặt" onClick={()=>{setPage('settings');setSearch('');setMobileMore(false)}}><span className="avatar"><UserRound size={16}/></span><span className="profile-text"><b>{userName}</b><small>Hồ sơ · Cài đặt</small></span></button>
        </div>
      </header>
      <div className="content">
        {page!=='dashboard' && page!=='settings' && <div className="searchbar"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm theo mã, tên hoặc nội dung..."/></div>}
        {page==='dashboard' && <Dashboard assets={activeAssets} tasks={tasks} inventory={inventory} dueToday={dueToday} lowStock={lowStock} overdue={overdue} go={setPage} complete={completeTask} readOnly={isViewer}/>}
        <>
        {page==='checklist' && <section className="panel checklist-schedule-panel">
          <div className="panel-head"><div><h2>Lịch Bảo trì – Checklist</h2><p>Theo dõi từng kỳ Checklist định kỳ của thiết bị. Kỳ chưa thực hiện hiển thị đỏ; hoàn thành hiển thị xanh.</p></div><span className="status green">BẮT BUỘC QUÉT QR</span></div>
          <div className="checklist-frequency-tabs">{CHECKLIST_FREQUENCIES.map(freq=><button type="button" key={freq} className={checklistFrequency===freq?'active':''} onClick={()=>setChecklistFrequency(freq)}>{freq.replace('Hàng ','')}</button>)}</div>
          <div className="checklist-schedule-summary"><span><b>{checklistScheduleRows.length}</b> kỳ Checklist</span><span className="checklist-summary-done"><b>{checklistScheduleRows.filter(row=>row.completed).length}</b> đã hoàn thành</span><span className="checklist-summary-pending"><b>{checklistScheduleRows.filter(row=>!row.completed).length}</b> chưa hoàn thành</span></div>
          <div className="table-wrap"><table className="checklist-schedule-table"><thead><tr><th>Ngày đến hạn</th><th>Mã / Tên thiết bị</th><th>Vị trí</th><th>Trạng thái Checklist</th><th>Thao tác</th></tr></thead><tbody>
            {checklistScheduleRows.map((row,index)=><tr key={row.asset.id+'-'+(row.dueDate||'template')+'-'+index} className={row.completed?'checklist-row-done':'checklist-row-pending'}>
              <td>{row.dueDate?dateText(row.dueDate):'Chưa có lịch'}</td>
              <td><b>{row.asset.code}</b><small>{row.asset.name}</small></td>
              <td>{row.asset.location||'—'}</td>
              <td><span className={'checklist-schedule-state '+(row.completed?'done':'pending')}>{row.missingTemplate?'Chưa tạo biểu mẫu':row.completed?(row.isMakeup?'Đã hoàn thành · Checklist bù':row.result==='Không đạt'?'Đã Checklist · Có mục không đạt':'Đã Checklist'):(row.dueDate<today()?'Chưa hoàn thành':'Đến hạn · Chưa hoàn thành')}</span>{!row.completed&&row.dueDate&&<small className="checklist-overdue-note">Chưa hoàn thành ngày {dateText(row.dueDate)}</small>}</td>
              <td><button type="button" className={row.completed?'soft-btn':'primary-btn'} disabled={isViewer&&!row.completed} title={isViewer&&!row.completed?'Viewer không được thực hiện Checklist':undefined} onClick={()=>{if(row.completed){setChecklistAccess(false);setActiveChecklistOccurrence(null);setDetailAsset(row.asset);return}setPendingChecklistOccurrence({assetId:row.asset.id,scheduledFor:row.dueDate||undefined,isMakeup:Boolean(row.dueDate&&row.dueDate<today())});setActiveChecklistOccurrence(null);setModal('scan')}}>{row.missingTemplate?'Quét QR tạo Checklist':row.completed?'Xem lịch sử':row.dueDate<today()?'Checklist bù':'Quét QR thực hiện'}</button></td>
            </tr>)}
          </tbody></table>{checklistScheduleRows.length===0&&<Empty text={'Chưa có thiết bị thiết lập chu kỳ '+checklistFrequency+'. Hãy mở lý lịch thiết bị và chọn Chu kỳ Bảo trì – Checklist.'}/>}</div>
          <p className="checklist-schedule-footnote">Ngày bắt đầu lịch được tính từ ngày tạo biểu mẫu Checklist riêng của thiết bị. Checklist bù vẫn lưu thành phiếu riêng và được ghi rõ trong lịch sử thiết bị.</p>
        </section>}
        </>
        {page==='assets' && !showCloudAssets && <section className="panel"><div className="panel-head"><div><h2>{showArchived?'Thiết bị đã lưu kho':'Danh mục thiết bị'}</h2><p>{showArchived?'Hồ sơ được giữ lại để tra cứu hoặc khôi phục':'Quản lý lý lịch, mã QR, ảnh và tình trạng thiết bị'}</p></div><div className="asset-toolbar"><button type="button" className="soft-btn" onClick={()=>setShowCloudAssets(true)}>Xem dữ liệu Cloud</button>
            <button className={!showArchived?'soft-btn':'text-btn'} onClick={()=>setShowArchived(false)}>Đang quản lý ({activeAssets.length})</button>
            <button className={showArchived?'soft-btn':'text-btn'} onClick={()=>setShowArchived(true)}><Archive size={15}/> Lưu kho ({archivedAssets.length})</button>
            {!showArchived&&<details className="asset-filter-menu"><summary><ChevronDown size={15}/> Lọc & sắp xếp</summary><div className="asset-filter-popover">
              <label>Nhóm thiết bị<select value={assetCategoryFilter} onChange={e=>{setAssetCategoryFilter(e.target.value);e.currentTarget.closest('details')?.removeAttribute('open')}}><option value="">Tất cả nhóm</option>{assetCategories.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
              <label>Vị trí<select value={assetLocationFilter} onChange={e=>{setAssetLocationFilter(e.target.value);e.currentTarget.closest('details')?.removeAttribute('open')}}><option value="">Tất cả vị trí</option>{assetLocations.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
              <label>Trạng thái<select value={assetStatusFilter} onChange={e=>{setAssetStatusFilter(e.target.value);e.currentTarget.closest('details')?.removeAttribute('open')}}><option value="">Tất cả trạng thái</option>{['Đang hoạt động','Đang sửa chữa','Ngừng sử dụng','Thanh lý'].map(x=><option key={x}>{x}</option>)}</select></label>
              <label>Sắp xếp<select value={assetSort} onChange={e=>{setAssetSort(e.target.value);e.currentTarget.closest('details')?.removeAttribute('open')}}><option value="code-asc">Mã thiết bị: A → Z</option><option value="code-desc">Mã thiết bị: Z → A</option><option value="name-asc">Tên thiết bị: A → Z</option><option value="date-newest">Ngày sử dụng: mới nhất</option><option value="date-oldest">Ngày sử dụng: cũ nhất</option></select></label>
              <button type="button" className="text-btn" onClick={e=>{setAssetCategoryFilter('');setAssetLocationFilter('');setAssetStatusFilter('');setAssetSort('code-asc');e.currentTarget.closest('details')?.removeAttribute('open')}}>Đặt lại bộ lọc</button>
            </div></details>}
            {!showArchived&&<><button className="soft-btn" disabled={isViewer} title={isViewer?'Viewer không được xuất Excel':undefined} onClick={exportAssets}><Download size={16}/> Xuất Excel</button><button className="soft-btn" onClick={printAssets}><Printer size={16}/> In danh sách</button></>}
          </div></div>
          <div className="asset-result-count">{showArchived?'Đang lưu kho: '+filteredArchivedAssets.length+'/'+archivedAssets.length+' thiết bị':'Hiển thị '+filteredAssets.length+'/'+activeAssets.length+' thiết bị đang hoạt động'}</div>
          <div className="table-wrap"><table><thead><tr><th>Mã / Tên thiết bị</th><th>Nhóm</th><th>Vị trí</th><th>Ngày sử dụng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
          {(showArchived?filteredArchivedAssets:filteredAssets).map(a=><tr key={a.id}><td><button className="asset-name-link" onClick={()=>{setChecklistAccess(false);setDetailAsset(a)}}><b>{a.code}</b><small>{a.name}</small></button></td><td>{a.category}</td><td>{a.location||'—'}</td><td>{dateText(a.commissionedAt)}</td><td><span className={'status '+(a.archivedAt?'gray':a.status==='Đang hoạt động'?'green':a.status==='Đang sửa chữa'?'orange':a.status==='Thanh lý'?'red':'gray')}>{a.archivedAt?'Đã lưu kho':a.status}</span></td><td className="actions">{showArchived?<><button className="text-btn success-text" disabled={isViewer} title={isViewer?'Viewer chỉ có quyền xem':undefined} onClick={()=>restoreAsset(a)}>Khôi phục</button><button className="text-btn danger" title="Chỉ Admin sau khi có đăng nhập và xác thực máy chủ" disabled><Trash2 size={14}/> Xóa vĩnh viễn</button></>:<><button className="text-btn" disabled={isViewer} title={isViewer?'Viewer chỉ có quyền xem':undefined} onClick={()=>{setEditingAsset({...a,images:a.images??[]});setModal('asset')}}>Sửa</button><details className="asset-row-menu"><summary>Thao tác</summary><div><button disabled={isViewer} onClick={e=>{changeAssetStatus(a,'Đang hoạt động');e.currentTarget.closest('details')?.removeAttribute('open')}}>Đánh dấu đang hoạt động</button><button disabled={isViewer} onClick={e=>{changeAssetStatus(a,'Đang sửa chữa');e.currentTarget.closest('details')?.removeAttribute('open')}}>Đang sửa chữa / hỏng</button><button disabled={isViewer} onClick={e=>{changeAssetStatus(a,'Ngừng sử dụng');e.currentTarget.closest('details')?.removeAttribute('open')}}>Ngừng sử dụng</button><button disabled={isViewer} onClick={e=>{archiveAsset(a);e.currentTarget.closest('details')?.removeAttribute('open')}}>Đưa vào Lưu kho</button><button disabled={isViewer} onClick={e=>{changeAssetStatus(a,'Thanh lý');e.currentTarget.closest('details')?.removeAttribute('open')}}>Thanh lý / bán ve chai</button><button className="danger" disabled title="Chờ đăng nhập Admin và xác thực máy chủ">Xóa vĩnh viễn (Admin)</button></div></details></>}</td></tr>)}
          </tbody></table>{(showArchived?filteredArchivedAssets:filteredAssets).length===0&&<Empty text={showArchived?'Chưa có thiết bị nào trong Lưu kho.':'Chưa có thiết bị phù hợp.'}/>}</div>
          {showArchived&&<p className="archive-security-note">Xóa vĩnh viễn sẽ chỉ mở khi BAOTRI có đăng nhập và xác thực Admin ở máy chủ. Bản thử nghiệm lưu cục bộ chưa có bảo mật tài khoản thật.</p>}
        </section>}
        {page==='assets' && showCloudAssets && <CloudAssetsPanel client={cloudClient} organizationId={organizationId} organizationName={organizationName} organizationRole={organizationRole} onBack={()=>setShowCloudAssets(false)}/>}
         {page==='inventory' && <section className="panel"><div className="panel-head"><div><h2>Kho vật tư</h2><p>Nhập xuất tồn và cảnh báo mức tồn tối thiểu</p></div><div className="asset-photo-actions"><button className="soft-btn" disabled={isViewer} title={isViewer?'Viewer không được xuất Excel':undefined} onClick={exportInventory}><Download size={16}/> Xuất Excel</button><button className="soft-btn" onClick={printInventory}><Printer size={16}/> In danh sách</button></div></div>
          <div className="table-wrap"><table><thead><tr><th>Mã / Tên vật tư</th><th>Nhóm</th><th>Tồn kho</th><th>Tồn tối thiểu</th><th>Vị trí</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
          {filteredItems.map(i=><tr key={i.id}><td><button type="button" className="inventory-name-link" onClick={()=>setDetailItem(i)}><b>{i.code}</b><small>{i.name}</small></button></td><td>{i.group}</td><td><b>{i.quantity} {i.unit}</b></td><td>{i.minQuantity} {i.unit}</td><td>{i.location||'—'}</td><td><span className={`status ${i.quantity<=i.minQuantity?'red':'green'}`}>{i.quantity<=i.minQuantity?'Sắp hết':'Đủ tồn'}</span></td><td className="actions"><button className="text-btn" disabled={isViewer} title={isViewer?'Viewer chỉ có quyền xem':undefined} onClick={()=>addMovement(i,'Nhập',Number(prompt('Số lượng nhập?','1')))}>Nhập</button><button className="text-btn" disabled={isViewer} title={isViewer?'Viewer chỉ có quyền xem':undefined} onClick={()=>addMovement(i,'Xuất',Number(prompt('Số lượng xuất?','1')))}>Xuất</button><button className="text-btn" disabled={isViewer} title={isViewer?'Viewer chỉ có quyền xem':undefined} onClick={()=>{setEditingItem(i);setModal('item')}}>Sửa</button></td></tr>)}
          </tbody></table>{filteredItems.length===0&&<Empty text="Chưa có vật tư."/ >}</div></section>}
        {page==='planning' && <section className="panel maintenance-plan-panel">
          <div className="panel-head">
            <div><h2>Kế hoạch bảo trì</h2><p>Lập lịch bảo trì thiết bị, phân công nội bộ hoặc thuê ngoài</p></div>
            <div className="maintenance-plan-actions">
              <button type="button" className="soft-btn" onClick={()=>setPage('tasks')}><CalendarDays size={16}/> Lịch bảo dưỡng định kỳ</button>
              <button type="button" className="soft-btn" disabled={isViewer} title={isViewer?'Viewer không được xuất Excel':undefined} onClick={openMaintenancePlanExport}><Download size={16}/> Xuất kế hoạch Excel</button>
              <button type="button" className="primary-btn" disabled={isViewer} title={isViewer?'Viewer chỉ có quyền xem':undefined} onClick={()=>{setEditingPlan(emptyMaintenancePlan(planPeriod,planAnchorDate));setModal('plan')}}><Plus size={16}/> Thêm kế hoạch</button>
            </div>
          </div>
          <div className="plan-period-tabs" role="tablist" aria-label="Kỳ kế hoạch bảo trì">
            {(['Tuần','Tháng','Quý','Năm'] as MaintenancePlanPeriod[]).map(period=><button type="button" role="tab" aria-selected={planPeriod===period} key={period} className={planPeriod===period?'active':''} onClick={()=>setPlanPeriod(period)}>{period}</button>)}
          </div>
          <div className="plan-period-toolbar">
            <div className="plan-period-picker">
              {planPeriod==='Tuần'&&<label className="plan-period-control"><span>Chọn ngày trong tuần</span><input type="date" value={planAnchorDate} onChange={event=>event.target.value&&setPlanAnchorDate(event.target.value)}/></label>}
              {planPeriod==='Tháng'&&<label className="plan-period-control"><span>Chọn tháng</span><input type="month" value={planAnchorDate.slice(0,7)} onChange={event=>event.target.value&&setPlanAnchorDate(`${event.target.value}-01`)}/></label>}
              {planPeriod==='Quý'&&<><label className="plan-period-control"><span>Năm</span><select value={planAnchorDate.slice(0,4)} onChange={event=>setPlanAnchorDate(`${event.target.value}-${planAnchorDate.slice(5,7)}-01`)}>{MAINTENANCE_PLAN_YEARS.map(year=><option key={year}>{year}</option>)}</select></label><label className="plan-period-control"><span>Quý</span><select value={Math.floor((Number(planAnchorDate.slice(5,7))-1)/3)+1} onChange={event=>setPlanAnchorDate(`${planAnchorDate.slice(0,4)}-${String((Number(event.target.value)-1)*3+1).padStart(2,'0')}-01`)}>{[1,2,3,4].map(quarter=><option key={quarter} value={quarter}>Quý {quarter}</option>)}</select></label></>}
              {planPeriod==='Năm'&&<label className="plan-period-control"><span>Chọn năm</span><select value={planAnchorDate.slice(0,4)} onChange={event=>setPlanAnchorDate(`${event.target.value}-01-01`)}>{MAINTENANCE_PLAN_YEARS.map(year=><option key={year}>{year}</option>)}</select></label>}
            </div>
            <b className="plan-period-range">
              {periodRangeLabel(planPeriod,maintenancePlanPeriodRange)} · {maintenancePlanScopeLabel(planPeriod)}
            </b>
          </div>
          <div className="plan-summary">
            <span><b>{filteredMaintenancePlans.length}</b> hạng mục trong kỳ</span>
            <span><b>{filteredMaintenancePlans.filter(plan=>plan.execution==='Nội bộ').length}</b> nội bộ</span>
            <span><b>{filteredMaintenancePlans.filter(plan=>plan.execution==='Thuê ngoài').length}</b> thuê ngoài</span>
            <span><b>{activeAssets.length-unplannedMaintenanceAssets.length}/{activeAssets.length}</b> thiết bị đã có lịch</span>
          </div>
          {unplannedMaintenanceAssets.length>0&&<details className="plan-coverage-warning">
            <summary>Chưa có kế hoạch cho {unplannedMaintenanceAssets.length} thiết bị trong kỳ này</summary>
            <p>{unplannedMaintenanceAssets.map(asset=>`${asset.code} – ${asset.name}`).join(' · ')}</p>
          </details>}
          <div className="table-wrap">
            <table className="maintenance-plan-table"><thead><tr><th>Kỳ</th><th>Thời gian dự kiến</th><th>Thiết bị</th><th>Nội dung bảo trì</th><th>Thực hiện</th><th>Đơn vị thuê ngoài</th><th>Thao tác</th></tr></thead><tbody>
              {filteredMaintenancePlans.map(plan=>{
                const asset=assets.find(item=>item.id===plan.assetId)
                return <tr key={plan.id}><td><span className="status gray">{plan.period}</span></td><td>{dateText(plan.startDate)}{plan.endDate!==plan.startDate&&<> – {dateText(plan.endDate)}</>}</td><td><b>{asset?.code||'—'}</b><small>{asset?.name||'Thiết bị không còn trong danh mục'}</small></td><td><b>{plan.title}</b>{plan.notes&&<small>{plan.notes}</small>}</td><td><span className={`status ${plan.execution==='Nội bộ'?'green':'orange'}`}>{plan.execution}</span></td><td>{plan.execution==='Thuê ngoài'?(plan.contractor||'Chưa xác định'):'—'}</td><td className="actions"><button type="button" className="text-btn" disabled={isViewer} title={isViewer?'Viewer chỉ có quyền xem':undefined} onClick={()=>{setEditingPlan(plan);setModal('plan')}}>Sửa</button><button type="button" className="text-btn danger" title="Xóa kế hoạch" disabled={isViewer} onClick={()=>deleteMaintenancePlan(plan)}><Trash2 size={15}/></button></td></tr>
              })}
            </tbody></table>
            {filteredMaintenancePlans.length===0&&<Empty text="Chưa có kế hoạch trong kỳ này. Hãy thêm hạng mục bảo trì đầu tiên."/>}
          </div>
        </section>}
        {page==='tasks' && <section className="panel"><div className="panel-head"><div><h2>Lịch bảo dưỡng định kỳ</h2><p>Công việc lặp lại, hạn thực hiện và tiến độ; không phải kế hoạch bảo trì theo kỳ.</p></div><button className="soft-btn" disabled={isViewer} title={isViewer?'Viewer không được xuất Excel':undefined} onClick={exportTasks}><Download size={16}/> Xuất lịch bảo dưỡng Excel</button></div>
          <div className="table-wrap"><table><thead><tr><th>Ngày đến hạn</th><th>Thiết bị</th><th>Công việc</th><th>Chu kỳ</th><th>Trạng thái</th><th></th></tr></thead><tbody>
          {filteredTasks.map(t=><tr key={t.id}><td>{dateText(t.dueDate)}</td><td>{assets.find(a=>a.id===t.assetId)?.name??'Chưa gắn thiết bị'}</td><td><b>{t.title}</b><small>{t.checklist.split('\n').filter(Boolean).length} bước công việc</small></td><td>{t.frequency}</td><td><span className={`status ${t.status==='Hoàn thành'?'green':t.dueDate<today()?'red':'orange'}`}>{t.status==='Hoàn thành'?'Hoàn thành':t.dueDate<today()?'Quá hạn':t.status}</span></td><td className="actions"><button className="text-btn" disabled={isViewer} title={isViewer?'Viewer chỉ có quyền xem':undefined} onClick={()=>{setEditingTask(t);setModal('task')}}>Chi tiết</button>{t.status!=='Hoàn thành'&&<button className="text-btn success-text" disabled={isViewer} title={isViewer?'Viewer chỉ có quyền xem':undefined} onClick={()=>completeTask(t)}>Hoàn thành</button>}</td></tr>)}
          </tbody></table>{filteredTasks.length===0&&<Empty text="Chưa có công việc."/ >}</div></section>}
        {page==='logs' && <section className="panel"><div className="panel-head"><div><h2>Bảo dưỡng – Sửa chữa</h2><p>Phiếu công việc và lịch sử xử lý kỹ thuật thực tế</p></div><button className="soft-btn" disabled={isViewer} title={isViewer?'Viewer không được xuất Excel':undefined} onClick={exportLogs}><Download size={16}/> Xuất Excel</button></div>
          <div className="table-wrap"><table><thead><tr><th>Ngày lập phiếu</th><th>Thiết bị</th><th>Loại công việc</th><th>Nội dung</th><th>Trạng thái</th><th>Kết quả</th><th>Người thực hiện</th><th>Hoàn thành lúc</th><th>Thao tác</th></tr></thead><tbody>{logs.map(l=><tr key={l.id}><td>{dateText(l.date)}</td><td>{assets.find(a=>a.id===l.assetId)?.name??'—'}</td><td>{l.kind}</td><td>{l.description}</td><td><span className={`status ${l.result?'green':'orange'}`}>{l.result?'Hoàn thành':'Chưa hoàn thành'}</span></td><td>{l.result||'Chưa có kết quả'}</td><td>{l.performedBy||'—'}</td><td>{dateTimeText(l.completedAt)}</td><td className="actions"><button type="button" className="text-btn" disabled={isViewer} title={isViewer?'Viewer chỉ có quyền xem':undefined} onClick={()=>{setEditingLog(l);setModal('log')}}>{l.result?'Sửa phiếu':'Cập nhật phiếu'}</button></td></tr>)}</tbody></table>{logs.length===0&&<Empty text="Chưa có nhật ký."/ >}</div></section>}
        {page==='reports' && <div className="reports-dashboard">
          <section className="panel report-period-panel">
            <div className="panel-head"><div><h2>Báo cáo hoạt động thực tế</h2><p>Thống kê phiếu đã ghi nhận và vật tư đã xuất kho; không bao gồm kế hoạch dự kiến.</p></div><FileSpreadsheet/></div>
            <div className="report-period-tabs" role="tablist" aria-label="Kỳ báo cáo">
              {(['Tuần','Tháng','Quý','Năm'] as MaintenancePlanPeriod[]).map(period=><button type="button" role="tab" aria-selected={reportPeriod===period} key={period} className={reportPeriod===period?'active':''} onClick={()=>setReportPeriod(period)}>{period}</button>)}
            </div>
            <div className="report-period-toolbar">
              <div className="plan-period-picker">
                {reportPeriod==='Tuần'&&<label className="plan-period-control"><span>Chọn ngày trong tuần</span><input type="date" value={reportAnchorDate} onChange={event=>event.target.value&&setReportAnchorDate(event.target.value)}/></label>}
                {reportPeriod==='Tháng'&&<label className="plan-period-control"><span>Chọn tháng</span><input type="month" value={reportAnchorDate.slice(0,7)} onChange={event=>event.target.value&&setReportAnchorDate(`${event.target.value}-01`)}/></label>}
                {reportPeriod==='Quý'&&<><label className="plan-period-control"><span>Năm</span><select value={reportAnchorDate.slice(0,4)} onChange={event=>setReportAnchorDate(`${event.target.value}-${reportAnchorDate.slice(5,7)}-01`)}>{MAINTENANCE_PLAN_YEARS.map(year=><option key={year}>{year}</option>)}</select></label><label className="plan-period-control"><span>Quý</span><select value={Math.floor((Number(reportAnchorDate.slice(5,7))-1)/3)+1} onChange={event=>setReportAnchorDate(`${reportAnchorDate.slice(0,4)}-${String((Number(event.target.value)-1)*3+1).padStart(2,'0')}-01`)}>{[1,2,3,4].map(quarter=><option key={quarter} value={quarter}>Quý {quarter}</option>)}</select></label></>}
                {reportPeriod==='Năm'&&<label className="plan-period-control"><span>Chọn năm</span><select value={reportAnchorDate.slice(0,4)} onChange={event=>setReportAnchorDate(`${event.target.value}-01-01`)}>{MAINTENANCE_PLAN_YEARS.map(year=><option key={year}>{year}</option>)}</select></label>}
              </div>
              <b className="plan-period-range">{periodRangeLabel(reportPeriod, reportPeriodRange)}</b>
            </div>
          </section>

          <section className="panel report-data-panel">
            <div className="panel-head"><div><h2>Công việc bảo trì, bảo dưỡng, sửa chữa</h2><p>{periodRangeLabel(reportPeriod, reportPeriodRange)} · chỉ tính phiếu đã hoàn thành, theo ngày hoàn thành</p></div><button type="button" className="soft-btn" disabled={isViewer} title={isViewer?'Viewer không được xuất Excel':undefined} onClick={exportReportWork}><Download size={16}/> Xuất báo cáo công việc Excel</button></div>
            <div className="report-summary"><span><b>{reportWorkLogs.length}</b> phiếu đã hoàn thành</span><span><b>{reportWorkLogs.filter(log=>/bảo dưỡng|bảo trì/i.test(log.kind)).length}</b> bảo trì / bảo dưỡng</span><span><b>{reportWorkLogs.filter(log=>log.kind.toLocaleLowerCase('vi').includes('sửa chữa')).length}</b> sửa chữa</span></div>
            <div className="table-wrap"><table className="period-report-table"><thead><tr><th>Ngày hoàn thành</th><th>Thiết bị</th><th>Loại công việc</th><th>Nội dung đã thực hiện</th><th>Vật tư ghi trên phiếu</th><th>Người thực hiện</th></tr></thead><tbody>
              {reportWorkLogs.map(log=>{const asset=assets.find(item=>item.id===log.assetId);return <tr key={log.id}><td>{dateText(completedWorkDate(log))}</td><td><b>{asset?.code||'—'}</b><small>{asset?.name||'Thiết bị không còn trong danh mục'}</small></td><td>{log.kind}</td><td>{log.description||'—'}</td><td>{log.parts||'—'}</td><td>{log.performedBy||'—'}</td></tr>})}
            </tbody></table>{reportWorkLogs.length===0&&<Empty text="Không có phiếu công việc trong kỳ báo cáo này."/>}</div>
          </section>

          <section className="panel report-data-panel">
            <div className="panel-head"><div><h2>Vật tư đã xuất và tồn kho hiện tại</h2><p>{periodRangeLabel(reportPeriod, reportPeriodRange)} · số lượng sử dụng tính theo giao dịch Xuất kho</p></div><button type="button" className="soft-btn" disabled={isViewer} title={isViewer?'Viewer không được xuất Excel':undefined} onClick={exportReportMaterials}><Download size={16}/> Xuất báo cáo vật tư Excel</button></div>
            <div className="report-summary"><span><b>{reportMaterialUsage.length}</b> loại vật tư đã xuất</span><span><b>{reportMaterialUsage.reduce((sum,row)=>sum+row.transactions,0)}</b> lượt xuất kho</span></div>
            <div className="table-wrap"><table className="period-report-table"><thead><tr><th>Vật tư</th><th>Nhóm</th><th>Đã xuất trong kỳ</th><th>Tồn kho hiện tại</th><th>Vị trí</th></tr></thead><tbody>
              {reportMaterialUsage.map(row=><tr key={row.itemId}><td><b>{row.item?.code||'—'}</b><small>{row.item?.name||'Vật tư không còn trong danh mục'}</small></td><td>{row.item?.group||'—'}</td><td><b>{row.quantity} {row.item?.unit||''}</b><small>{row.transactions} lượt xuất</small></td><td><b>{row.item?`${row.item.quantity} ${row.item.unit}`:'—'}</b></td><td>{row.item?.location||'—'}</td></tr>)}
            </tbody></table>{reportMaterialUsage.length===0&&<Empty text="Không có giao dịch xuất kho trong kỳ báo cáo này."/>}</div>
          </section>

          <section className="panel report-data-panel">
            <div className="panel-head"><div><h2>Tình trạng thiết bị hiện tại</h2><p>Ảnh chụp hiện tại, không thay đổi theo kỳ thời gian đã chọn</p></div><button type="button" className="soft-btn" disabled={isViewer} title={isViewer?'Viewer không được xuất Excel':undefined} onClick={exportReportAssets}><Download size={16}/> Xuất báo cáo thiết bị Excel</button></div>
            <div className="report-summary"><span><b>{activeAssets.length}</b> thiết bị chưa lưu kho</span><span><b>{activeAssets.filter(asset=>asset.status==='Đang hoạt động').length}</b> đang hoạt động</span><span className="report-summary-alert"><b>{reportBrokenAssets.length}</b> hỏng / đang sửa chữa</span><span><b>{activeAssets.filter(asset=>asset.status==='Ngừng sử dụng'||asset.status==='Thanh lý').length}</b> ngừng sử dụng / thanh lý</span></div>
            <div className="table-wrap"><table className="period-report-table"><thead><tr><th>Mã thiết bị hỏng</th><th>Tên thiết bị</th><th>Nhóm</th><th>Vị trí</th><th>Tình trạng</th></tr></thead><tbody>
              {reportBrokenAssets.map(asset=><tr key={asset.id}><td><b>{asset.code}</b></td><td>{asset.name}</td><td>{asset.category||'—'}</td><td>{asset.location||'—'}</td><td><span className="status orange">Đang sửa chữa / hỏng</span></td></tr>)}
            </tbody></table>{reportBrokenAssets.length===0&&<Empty text="Hiện không có thiết bị nào được đánh dấu Đang sửa chữa / hỏng."/>}</div>
          </section>
          <div className="panel report-note"><ShieldAlert/><div><b>Lưu ý nguồn dữ liệu</b><p>Vật tư đã dùng được tính từ giao dịch Xuất kho; tồn kho là số hiện tại. Vật tư nhập dạng ghi chú tự do trong phiếu sửa chữa không được cộng vào số lượng xuất kho.</p></div></div>
        </div>}
        {page==='settings' && <div className="settings-grid">
          <section className="panel settings-profile">
            <div className="panel-head"><div><h2>Hồ sơ nhân viên</h2><p>Thông tin cá nhân của tài khoản đang đăng nhập</p></div><UserRound/></div>
            <div className="employee-profile-details">
              <div><small>Email đăng nhập</small><b>{userEmail||'—'}</b></div>
              <div><small>Họ và tên</small><b>{profile.fullName||'Chưa cập nhật'}</b></div>
              <div><small>Số điện thoại</small><b>{profile.phone||'Chưa cập nhật'}</b></div>
              <div><small>Ngày sinh</small><b>{profile.dateOfBirth?dateText(profile.dateOfBirth):'Chưa cập nhật'}</b></div>
              <div><small>Vị trí nhân viên</small><b>{profile.position||'Chưa cập nhật'}</b></div>
            </div>
            <div className="setting-row"><div><b>Thao tác hồ sơ</b><small>Thông tin chỉ được thay đổi khi chọn Sửa hồ sơ.</small></div><div className="setting-inline-actions"><button className="soft-btn" onClick={()=>setProfileEditOpen(true)}>Sửa hồ sơ</button><button className="soft-btn" onClick={onSignOut}>Đăng xuất</button></div></div>
          </section>
          {organizationRole.trim().toLowerCase()==='admin'&&<OrganizationMembersPanel client={cloudClient} organizationId={organizationId}/>}
          <section className="panel"><div className="panel-head"><div><h2>Dữ liệu và sao lưu</h2><p>Phiên bản thử nghiệm lưu dữ liệu cục bộ trong trình duyệt này</p></div><HardDrive/></div>
            <div className="setting-row"><div><b>Xuất bản sao lưu</b><small>Tải đầy đủ thiết bị, vật tư, kế hoạch, nhật ký, Checklist, ảnh, danh mục tự tạo và dữ liệu hàng đợi thành JSON.</small></div><button className="primary-btn" disabled={isViewer} title={isViewer?'Viewer không được sao lưu dữ liệu':undefined} onClick={backup}><Download size={16}/> Sao lưu</button></div>
            <div className="setting-row"><div><b>Khôi phục bản sao lưu</b><small>Nhập file JSON đã xuất từ ứng dụng.</small></div><label className={`soft-btn file-btn ${isViewer?'disabled':''}`} title={isViewer?'Viewer không được khôi phục dữ liệu':undefined}>Chọn file<input type="file" accept=".json,application/json" disabled={isViewer} onChange={e=>e.target.files?.[0]&&restore(e.target.files[0])}/></label></div>
            <div className="setting-row"><div><b>Trạng thái dữ liệu</b><small>{queueCount} thay đổi cục bộ đang chờ. Đăng nhập, tổ chức và phép thử ghi/đọc thiết bị đã kết nối Supabase; dữ liệu nghiệp vụ chính vẫn đang lưu trong trình duyệt, chưa đồng bộ tự động.</small></div><span className="status orange">Chưa đồng bộ nghiệp vụ</span></div>
            <div className="setting-row"><div><b>Giao diện</b><small>Chuyển đổi giữa tối/ sáng và thu gọn thông tin chính.</small></div><div className="setting-inline-actions"><button className={`soft-btn ${theme === 'light' ? 'active' : ''}`} onClick={()=>setTheme('light')}>Sáng</button><button className={`soft-btn ${theme === 'dark' ? 'active' : ''}`} onClick={()=>setTheme('dark')}>Tối</button><button className={`soft-btn ${compact ? 'active' : ''}`} onClick={()=>setCompact(v=>!v)}>{compact ? 'Thu gọn' : 'Mở rộng'}</button></div></div>
          </section>
          <section className="panel about-panel">
            <div className="about-heading">
              <div><span className="about-eyebrow">GIỚI THIỆU ỨNG DỤNG</span><h2>Thông tin phiên bản</h2></div>
              <span className="about-version">BAOTRI PWA <b>0.1.0</b></span>
            </div>
            <p className="about-description">Đây là bộ khung chạy thử để cùng hoàn thiện nghiệp vụ. Dữ liệu nằm trong trình duyệt trên thiết bị hiện tại.</p>
            <div className="about-contact-grid">
              <a className="about-contact" href="tel:0912500396">
                <span className="about-contact-icon"><Phone size={18}/></span>
                <span className="about-contact-copy"><small>Điện thoại liên hệ</small><strong>0912500396</strong></span>
              </a>
              <a className="about-contact" href="mailto:tuanluongpham@gmail.com">
                <span className="about-contact-icon"><Mail size={18}/></span>
                <span className="about-contact-copy"><small>Email liên hệ</small><strong>tuanluongpham@gmail.com</strong></span>
              </a>
            </div>
            <div className="about-warning"><ShieldAlert size={18}/><p>Không dùng dữ liệu này làm hồ sơ bảo trì chính thức trước khi thiết lập máy chủ, sao lưu và kiểm thử đồng bộ.</p></div>
          </section>
        </div>}
      </div>
    </main>
    {mobileMore&&<div className="mobile-more-backdrop" onClick={()=>setMobileMore(false)}><div className="mobile-more-menu" onClick={e=>e.stopPropagation()}>
      <div className="mobile-more-title">Chức năng khác</div>
      {([['inventory','Kho vật tư',Package],['tasks','Kế hoạch bảo dưỡng định kỳ',CalendarDays],['logs','Bảo dưỡng – Sửa chữa',Wrench],['reports','Báo cáo',BarChart3],['settings','Cài đặt',Settings]] as const).map(([key,label,Icon])=><button key={key} onClick={()=>{setPage(key);setSearch('');setMobileMore(false)}}><Icon size={18}/>{label}<ChevronRight size={16}/></button>)}
    </div></div>}
    {notice&&<div className="toast"><Check size={17}/>{notice}</div>}
    {profileEditOpen&&<EmployeeProfileEditModal email={userEmail} profile={profile} close={()=>setProfileEditOpen(false)} onSave={async value=>{await onSaveProfile(value);setNotice('Đã lưu hồ sơ nhân viên')}}/>}
    {detailItem&&<InventoryDetailModal value={detailItem} readOnly={isViewer} close={()=>setDetailItem(null)} edit={()=>{setEditingItem(detailItem);setDetailItem(null);setModal('item')}}/>}
    {detailAsset&&<AssetDetailModal value={detailAsset} logs={logs.filter(l=>l.assetId===detailAsset.id)} allowChecklist={!isViewer && (checklistAccess || (CHECKLIST_TEST_MODE && page==='checklist'))} checklistOccurrence={activeChecklistOccurrence} createRepairFromChecklist={createRepairFromChecklist} readOnly={isViewer} editLog={(entry:Log)=>{if(isViewer)return;setEditingLog(entry);setModal('log')}} close={()=>{setDetailAsset(null);setChecklistAccess(false);setActiveChecklistOccurrence(null)}} edit={()=>{setEditingAsset({...detailAsset,images:detailAsset.images??[]});setDetailAsset(null);setChecklistAccess(false);setModal('asset')}} addLog={()=>{setEditingLog({id:uid(),assetId:detailAsset.id,date:today(),kind:'Sửa chữa',description:'',parts:'',readings:'',result:'',performedBy:userName});setModal('log')}}/>}
    {modal==='asset'&&editingAsset&&<AssetModal value={editingAsset} close={()=>{setModal(null);setEditingAsset(null)}} save={saveAsset} assets={assets} customCategories={customAssetCategories} onAddCategory={addAssetCategory} onExportConvention={exportAssetCodeConvention}/>}
    {modal==='item'&&editingItem&&<ItemModal value={editingItem} close={()=>{setModal(null);setEditingItem(null)}} save={saveItem}/>}
    {modal==='task'&&editingTask&&<TaskModal value={editingTask} assets={assets} close={()=>{setModal(null);setEditingTask(null)}} save={saveTask}/>}
    {modal==='plan'&&editingPlan&&<MaintenancePlanModal value={editingPlan} assets={assets} close={()=>{setModal(null);setEditingPlan(null)}} save={saveMaintenancePlans}/>}
    {modal==='planExport'&&<Modal title="Xuất kế hoạch bảo trì Excel" close={()=>setModal(null)}>
      <form className="form-grid plan-export-form" onSubmit={event=>{event.preventDefault();exportMaintenancePlans()}}>
        <Field label="Kỳ kế hoạch">
          <select value={planExportPeriod} onChange={event=>setPlanExportPeriod(event.target.value as MaintenancePlanPeriod)}>
            {(['Tuần','Tháng','Quý','Năm'] as MaintenancePlanPeriod[]).map(period=><option key={period}>{period}</option>)}
          </select>
        </Field>
        {planExportPeriod==='Tuần'&&<Field label="Chọn ngày trong tuần"><input type="date" value={planExportAnchorDate} onChange={event=>event.target.value&&setPlanExportAnchorDate(event.target.value)}/></Field>}
        {planExportPeriod==='Tháng'&&<Field label="Chọn tháng"><input type="month" value={planExportAnchorDate.slice(0,7)} onChange={event=>event.target.value&&setPlanExportAnchorDate(`${event.target.value}-01`)}/></Field>}
        {planExportPeriod==='Quý'&&<>
          <Field label="Năm"><select value={planExportAnchorDate.slice(0,4)} onChange={event=>setPlanExportAnchorDate(`${event.target.value}-${planExportAnchorDate.slice(5,7)}-01`)}>{MAINTENANCE_PLAN_YEARS.map(year=><option key={year}>{year}</option>)}</select></Field>
          <Field label="Quý"><select value={Math.floor((Number(planExportAnchorDate.slice(5,7))-1)/3)+1} onChange={event=>setPlanExportAnchorDate(`${planExportAnchorDate.slice(0,4)}-${String((Number(event.target.value)-1)*3+1).padStart(2,'0')}-01`)}>{[1,2,3,4].map(quarter=><option key={quarter} value={quarter}>Quý {quarter}</option>)}</select></Field>
        </>}
        {planExportPeriod==='Năm'&&<Field label="Chọn năm"><select value={planExportAnchorDate.slice(0,4)} onChange={event=>setPlanExportAnchorDate(`${event.target.value}-01-01`)}>{MAINTENANCE_PLAN_YEARS.map(year=><option key={year}>{year}</option>)}</select></Field>}
        {planExportPeriod!=='Năm'&&<label className="plan-export-all">
          <input type="checkbox" checked={planExportAllPeriods} onChange={event=>setPlanExportAllPeriods(event.target.checked)}/>
          <span>Xuất toàn bộ {planExportPeriod.toLocaleLowerCase('vi')} trong năm {planExportAnchorDate.slice(0,4)}</span>
        </label>}
        <p className="plan-export-scope">Phạm vi: {planExportAllPeriods&&planExportPeriod!=='Năm'?`Toàn bộ ${planExportPeriod.toLocaleLowerCase('vi')} trong năm ${planExportAnchorDate.slice(0,4)}`:periodRangeLabel(planExportPeriod,planExportRange)} · {maintenancePlanScopeLabel(planExportPeriod)}.</p>
        <div className="modal-actions"><button type="button" className="soft-btn" onClick={()=>setModal(null)}>Hủy</button><button type="submit" className="primary-btn" disabled={isViewer} title={isViewer?'Viewer không được xuất Excel':undefined}><Download size={16}/> Xuất Excel</button></div>
      </form>
    </Modal>}
    {modal==='log'&&editingLog&&<LogEntryModal value={editingLog} assets={assets} userName={userName} isExisting={logs.some(entry=>entry.id===editingLog.id)} close={()=>{setModal(null);setEditingLog(null)}} save={saveLog}/>}
    {modal==='scan'&&<ScanModal close={()=>{setModal(null);setPendingChecklistOccurrence(null)}} assets={assets} expectedAssetId={pendingChecklistOccurrence?.assetId} openAsset={(a: Asset)=>{if(pendingChecklistOccurrence&&pendingChecklistOccurrence.assetId!==a.id)return;setEditingAsset(null);setChecklistAccess(true);setActiveChecklistOccurrence(pendingChecklistOccurrence?{scheduledFor:pendingChecklistOccurrence.scheduledFor,isMakeup:pendingChecklistOccurrence.isMakeup}:null);setPendingChecklistOccurrence(null);setModal(null);setDetailAsset(a)}}/>}
  </div>
}

function Dashboard({assets,tasks,dueToday,lowStock,overdue,go,complete,inventory,readOnly=false}:any) {
  const completed = tasks.filter((t:Task)=>t.status==='Hoàn thành').length
  const repairCount = assets.filter((a:Asset)=>a.status==='Đang sửa chữa').length
  const inventoryValue = (inventory as InventoryItem[]).reduce((sum:number, item:InventoryItem) => sum + item.quantity * item.unitPrice, 0)
  const completionRate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0
  const categoryStats: [string, number][] = (Object.entries(
    (assets as Asset[]).reduce((acc:Record<string, number>, asset:Asset) => {
      const key = asset.category || 'Khác'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {}) as Record<string, number>
  ) as [string, number][]).sort((a,b)=>b[1]-a[1]).slice(0,4)
  const maxCategory = Math.max(1, ...categoryStats.map(([,count]) => count))
  const priorityItems = lowStock.slice(0,3).map((item:InventoryItem) => ({
    name: item.name,
    code: item.code,
    ratio: Math.min(100, Math.round((item.quantity / Math.max(item.minQuantity, 1)) * 100))
  }))

  return <div className="dashboard">
    <div className="welcome"><div><div className="eyebrow light">BẢNG ĐIỀU KHIỂN</div><h2>Chào bạn, hôm nay cần bảo trì gì?</h2><p>{new Date().toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})} · Theo dõi thiết bị và công việc tại một nơi.</p></div><div className="welcome-icon"><Activity size={42}/></div></div>
    <div className="stat-grid">
      <Stat icon={<HardDrive/>} label="Tổng thiết bị" value={assets.length} hint="Hồ sơ thiết bị" color="blue"/>
      <Stat icon={<CalendarDays/>} label="Việc cần làm hôm nay" value={dueToday.length} hint="Đến hạn hôm nay" color="orange"/>
      <Stat icon={<ShieldAlert/>} label="Công việc quá hạn" value={overdue} hint="Cần theo dõi" color="red"/>
      <Stat icon={<Package/>} label="Vật tư sắp hết" value={lowStock.length} hint="Dưới mức tối thiểu" color="purple"/>
    </div>
    <div className="analytics-grid">
      <section className="panel insight-panel">
        <div className="panel-head"><div><h2>Hiệu suất bảo dưỡng</h2><p>Tỷ lệ hoàn thành và phân bổ thiết bị theo nhóm</p></div><span className="mini-chip">{completionRate}%</span></div>
        <div className="mini-stat-list">
          <div className="mini-stat"><span>Hoàn thành</span><strong>{completed}</strong></div>
          <div className="mini-stat"><span>Đang sửa</span><strong>{repairCount}</strong></div>
          <div className="mini-stat"><span>Giá trị kho</span><strong>{money(inventoryValue)}</strong></div>
        </div>
        <div className="bar-chart">
          {categoryStats.map(([label, count]) => (
            <div className="bar-row" key={label}>
              <span>{label}</span>
              <div className="bar-track"><i style={{ width: `${(count / maxCategory) * 100}%` }} /></div>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="panel insight-panel">
        <div className="panel-head"><div><h2>Ưu tiên kho</h2><p>Vật tư cần bổ sung sớm</p></div><button className="link-btn" onClick={()=>go('inventory')}>Xem kho <ChevronRight size={15}/></button></div>
        <div className="priority-list">
          {priorityItems.length ? priorityItems.map((item:any, index:number) => (            <div className="priority-item" key={`${item.code}-${index}`}>
              <div>
                <b>{item.name}</b>
                <small>{item.code}</small>
              </div>
              <div className="priority-meter">
                <span style={{ width: `${item.ratio}%` }} />
              </div>
            </div>
          )) : <Empty text="Kho đang ổn định."/>}
        </div>
      </section>
    </div>
    <div className="dash-columns">
      <section className="panel"><div className="panel-head"><div><h2>Công việc hôm nay</h2><p>Tick hoàn thành sau khi thực hiện và ghi nhận kết quả</p></div><button className="link-btn" onClick={()=>go('tasks')}>Xem tất cả <ChevronRight size={15}/></button></div>
        {dueToday.length===0?<Empty text="Không có công việc đến hạn hôm nay."/>:dueToday.map((t:Task)=><div className="task-row" key={t.id}><div className="task-icon"><Wrench size={17}/></div><div className="task-info"><b>{t.title}</b><small>{assets.find((a:Asset)=>a.id===t.assetId)?.name??'Chưa gắn thiết bị'} · {t.frequency}</small></div><button className="complete-btn" disabled={readOnly} title={readOnly?'Viewer chỉ có quyền xem':undefined} onClick={()=>complete(t)}><Check size={16}/> Xong</button></div>)}
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
function Modal({title,children,close}:any){return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}><div className="modal"><div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={close}><X/></button></div>{children}</div></div>}
function Field({label,children}:any){return <label className="field"><span>{label}</span>{children}</label>}
function EmployeeProfileEditModal({email,profile,close,onSave}:{email:string;profile:EmployeeProfile;close:()=>void;onSave:(value:EmployeeProfile)=>Promise<void>}) {
  const [value,setValue]=useState(profile)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const set = <K extends keyof EmployeeProfile,>(key:K,next:EmployeeProfile[K]) => setValue(current=>({...current,[key]:next}))
  const submit = async (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSave({...value,fullName:value.fullName.trim(),phone:value.phone.trim(),position:value.position.trim()})
      close()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể lưu hồ sơ. Vui lòng thử lại.')
    } finally {
      setBusy(false)
    }
  }
  return <Modal title="Sửa hồ sơ nhân viên" close={close}><form className="form-grid" onSubmit={submit}>
    <div className="form-hint">Thông tin được lưu trong hồ sơ tài khoản Supabase. Email đăng nhập không thể thay đổi tại đây.</div>
    <Field label="Email đăng nhập"><input type="email" value={email} readOnly/></Field>
    <Field label="Họ và tên"><input autoComplete="name" value={value.fullName} onChange={event=>set('fullName',event.target.value)} placeholder="Nhập họ và tên"/></Field>
    <Field label="Số điện thoại"><input type="tel" autoComplete="tel" value={value.phone} onChange={event=>set('phone',event.target.value)} placeholder="Nhập số điện thoại"/></Field>
    <Field label="Ngày sinh"><input type="date" autoComplete="bday" value={value.dateOfBirth} onChange={event=>set('dateOfBirth',event.target.value)}/></Field>
    <Field label="Vị trí nhân viên"><input autoComplete="organization-title" value={value.position} onChange={event=>set('position',event.target.value)} placeholder="Ví dụ: Nhân viên bảo trì"/></Field>
    {error&&<div className="form-hint warning-hint" role="alert">{error}</div>}
    <div className="modal-actions"><button type="button" className="soft-btn" onClick={close}>Hủy</button><button type="submit" className="primary-btn" disabled={busy}>{busy?'Đang lưu…':'Lưu hồ sơ'}</button></div>
  </form></Modal>
}

type OrganizationMemberView = {
  id: string
  userId: string
  email: string
  displayName: string
  status: 'invited' | 'active' | 'suspended'
  roleCode: string
  roleName: string
  createdAt: string
}

function OrganizationMembersPanel({client,organizationId}:{client:SupabaseClient;organizationId:string}) {
  const [members,setMembers]=useState<OrganizationMemberView[]>([])
  const [email,setEmail]=useState('')
  const [roleCode,setRoleCode]=useState<'technician'|'viewer'>('technician')
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [busyMember,setBusyMember]=useState('')
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')

  const callManagement=async(body:Record<string,string>)=>{
    const {data,error:invokeError}=await client.functions.invoke('manage-organization-members',{
      body:{organizationId,...body}
    })
    if(invokeError) {
      let detail=invokeError.message
      const context=(invokeError as any).context
      if(context&&typeof context.json==='function') {
        try { const payload=await context.json(); if(payload?.error)detail=String(payload.error) } catch {}
      }
      throw new Error(detail)
    }
    if(data?.error)throw new Error(String(data.error))
    return data
  }

  const loadMembers=async()=>{
    setLoading(true)
    setError('')
    try {
      const result=await callManagement({action:'list'})
      setMembers((result?.members??[]) as OrganizationMemberView[])
    } catch(reason) {
      setError(reason instanceof Error?reason.message:'Không thể tải danh sách tài khoản.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{void loadMembers()},[client,organizationId])

  const invite=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault()
    const cleanEmail=email.trim().toLowerCase()
    if(!cleanEmail)return
    setBusy(true);setError('');setMessage('')
    try {
      const result=await callManagement({action:'invite',email:cleanEmail,roleCode})
      setEmail('')
      setMessage(result?.invitationSent
        ? 'Đã gửi email mời. Tài khoản sẽ hoạt động sau khi người nhận xác nhận email.'
        : 'Đã thêm tài khoản đã xác thực vào tổ chức.')
      await loadMembers()
    } catch(reason) {
      const raw=reason instanceof Error?reason.message:String(reason)
      setError(raw.includes('already_a_member')?'Email này đã là thành viên của tổ chức.'
        :raw.includes('email_confirmation_pending')?'Email đã có tài khoản nhưng chưa xác nhận. Người dùng cần hoàn tất lời mời hiện tại trước.'
        :raw)
    } finally {setBusy(false)}
  }

  const changeRole=async(member:OrganizationMemberView,nextRole:string)=>{
    if(nextRole!=='technician'&&nextRole!=='viewer')return
    setBusyMember(member.id);setError('');setMessage('')
    try {
      await callManagement({action:'update_role',memberId:member.id,roleCode:nextRole})
      setMessage('Đã cập nhật vai trò.')
      await loadMembers()
    } catch(reason) {setError(reason instanceof Error?reason.message:String(reason))}
    finally {setBusyMember('')}
  }

  const changeStatus=async(member:OrganizationMemberView)=>{
    const nextStatus=member.status==='active'?'suspended':'active'
    const actionText=nextStatus==='suspended'?'tạm khóa':'mở lại'
    if(!confirm('Bạn muốn '+actionText+' tài khoản '+member.email+'? Dữ liệu và lịch sử của tài khoản vẫn được giữ nguyên.'))return
    setBusyMember(member.id);setError('');setMessage('')
    try {
      await callManagement({action:'update_status',memberId:member.id,status:nextStatus})
      setMessage(nextStatus==='suspended'?'Đã tạm khóa tài khoản.':'Đã mở lại tài khoản.')
      await loadMembers()
    } catch(reason) {setError(reason instanceof Error?reason.message:String(reason))}
    finally {setBusyMember('')}
  }

  return <section className="panel organization-members-panel">
    <div className="panel-head"><div><h2>Quản lý tài khoản</h2><p>Thêm Kỹ thuật viên / Người xem và quản lý quyền truy cập của thành viên tổ chức</p></div><UserRound/></div>
    <form className="form-grid member-invite-form" onSubmit={invite}>
      <Field label="Email tài khoản mới"><input required type="email" autoComplete="off" value={email} onChange={event=>setEmail(event.target.value)} placeholder="nhanvien@congty.vn"/></Field>
      <Field label="Vai trò"><select value={roleCode} onChange={event=>setRoleCode(event.target.value as 'technician'|'viewer')}><option value="technician">Kỹ thuật viên</option><option value="viewer">Người xem (chỉ xem)</option></select></Field>
      <div className="member-invite-action"><button type="submit" className="primary-btn" disabled={busy||!email.trim()}><Plus size={16}/>{busy?'Đang xử lý…':'Thêm tài khoản'}</button></div>
    </form>
    <p className="muted member-invite-note">Email chưa có tài khoản sẽ nhận liên kết mời để tự xác thực và đặt mật khẩu. Email đã có tài khoản xác thực trong Supabase Project này có thể được thêm trực tiếp. Không thể tạo thêm Admin tại đây.</p>
    {error&&<div className="form-hint warning-hint" role="alert">{error}</div>}
    {message&&<div className="form-hint" role="status">{message}</div>}
    <div className="panel-head member-list-heading"><div><b>Thành viên tổ chức</b><p>{members.length} tài khoản</p></div><button type="button" className="soft-btn" onClick={()=>void loadMembers()} disabled={loading}>Làm mới</button></div>
    {loading?<p className="muted">Đang tải danh sách tài khoản…</p>:<div className="table-wrap"><table className="member-table"><thead><tr><th>Tài khoản</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
      {members.map(member=><tr key={member.id}>
        <td><b>{member.displayName||member.email}</b>{member.displayName&&<small>{member.email}</small>}</td>
        <td>{member.roleCode==='admin'?<span className="status green">Admin</span>:member.roleCode==='unknown'?member.roleName:<select aria-label={'Vai trò '+member.email} value={member.roleCode} disabled={busyMember===member.id||member.roleCode==='unknown'} onChange={event=>void changeRole(member,event.target.value)}><option value="technician">Kỹ thuật viên</option><option value="viewer">Người xem</option></select>}</td>
        <td><span className={'status '+(member.status==='active'?'green':member.status==='invited'?'orange':'gray')}>{member.status==='active'?'Đang hoạt động':member.status==='invited'?'Chờ xác nhận email':'Đã tạm khóa'}</span></td>
        <td>{member.roleCode!=='admin'&&member.status!=='invited'&&<button type="button" className={member.status==='active'?'text-btn danger':'text-btn success-text'} disabled={busyMember===member.id} onClick={()=>void changeStatus(member)}>{member.status==='active'?'Tạm khóa':'Mở lại'}</button>}{member.roleCode==='admin'&&<small className="muted">Không quản lý Admin tại đây</small>}</td>
      </tr>)}
      {members.length===0&&<tr><td colSpan={4}>Chưa có thành viên.</td></tr>}
    </tbody></table></div>}
  </section>
}

function AssetDetailModal({value,logs,allowChecklist,checklistOccurrence,createRepairFromChecklist,editLog,close,edit,addLog,readOnly=false}:any){
  const [showPhotos,setShowPhotos]=useState(false)
  const [activePhoto,setActivePhoto]=useState<string|null>(null)
  const [printMode,setPrintMode]=useState<null|'sticker'|'detail'|'history'>(null)
  const photos: string[] = value.images ?? []
  const rows = [['Mã định danh',value.code],['Tên thiết bị',value.name],['Nhóm',value.category],['Vị trí',value.location],['Hãng',value.brand],['Model',value.model],['Serial',value.serial],['Ngày đưa vào sử dụng',dateText(value.commissionedAt)],['Công suất / thông số',value.power],['Chu kỳ Bảo trì – Checklist',value.cycle],['Tình trạng',value.status],['Ghi chú',value.notes]]
  const print = (mode:'sticker'|'detail'|'history') => { setPrintMode(mode); window.setTimeout(()=>window.print(),180) }
  return <Modal title="Chi tiết thiết bị" close={()=>{setPrintMode(null);close()}}>
    <div className="asset-qr-panel"><div><small>MÃ QR THIẾT BỊ</small><b>{value.code}</b><span>Quét mã để mở đúng hồ sơ thiết bị</span></div><QRCodeSVG value={`ASSET:${value.id}`} size={116} level="M" includeMargin/></div>
    <div className="asset-detail-grid">{rows.map(([label,val])=><div className="asset-detail-field" key={label}><small>{label}</small><b>{val||'—'}</b></div>)}</div>
    <div className="asset-photo-actions">
      <button type="button" className="soft-btn" onClick={()=>setShowPhotos(v=>!v)}><ImageIcon size={16}/> {showPhotos?'Ẩn ảnh':'Xem ảnh ('+photos.length+')'}</button>
      <button type="button" className="soft-btn" onClick={()=>print('sticker')}><QrCode size={16}/> In tem QR</button>
      <button type="button" className="soft-btn" onClick={()=>print('detail')}><Download size={16}/> In chi tiết</button>
      <button type="button" className="primary-btn" disabled={readOnly} title={readOnly?'Viewer chỉ có quyền xem':undefined} onClick={addLog}><Wrench size={16}/> Ghi nhận bảo dưỡng / sửa chữa</button>
      <button type="button" className="primary-btn" disabled={readOnly} title={readOnly?'Viewer chỉ có quyền xem':undefined} onClick={edit}>Sửa hồ sơ</button>
    </div>
    <AssetChecklist asset={value} allowActions={allowChecklist} scheduledFor={checklistOccurrence?.scheduledFor} isMakeup={checklistOccurrence?.isMakeup} createRepairFromChecklist={createRepairFromChecklist}/>
    <section className="asset-maintenance-history"><div className="panel-head"><div><h3>Lịch sử Bảo dưỡng – Sửa chữa</h3><p>{logs.length} lần ghi nhận công việc của thiết bị</p></div><button type="button" className="soft-btn" disabled={!logs.length} onClick={()=>print('history')}><Printer size={15}/> In lịch sử sửa chữa</button></div>
      {logs.length?<div className="maintenance-history-list">{logs.slice().sort((a:any,b:any)=>b.date.localeCompare(a.date)).map((entry:any)=><article key={entry.id}><time>{dateText(entry.date)}</time><div><b>{entry.kind}</b><p>{entry.description||'Không có mô tả'}</p>{entry.parts&&<small>Vật tư/phụ tùng: {entry.parts}</small>}{entry.readings&&<small>Thông số: {entry.readings}</small>}<small>Kết quả: {entry.result||'Chưa có kết quả · Chưa hoàn thành'}</small><small>Người thực hiện: {entry.performedBy||'—'}</small>{entry.result&&<small>Hoàn thành lúc: {dateTimeText(entry.completedAt)}</small>}{entry.checklistResultId&&<small>Liên kết từ phiếu Checklist</small>}<button type="button" className="text-btn" disabled={readOnly} title={readOnly?'Viewer chỉ có quyền xem':undefined} onClick={()=>editLog(entry)}>{entry.result?'Sửa phiếu':'Cập nhật phiếu sửa chữa'}</button></div></article>)}</div>:<p className="muted">Chưa có lịch sử. Hãy chọn “Ghi nhận bảo dưỡng / sửa chữa” sau khi thực hiện công việc.</p>}
    </section>
    {showPhotos&&<div className="asset-photo-grid">{photos.length?photos.map((src:string,i:number)=><button type="button" className="asset-photo-thumb" key={i} onClick={()=>setActivePhoto(src)}><img src={src} alt={'Ảnh '+(i+1)+' của '+value.name}/><span>Ảnh {i+1}</span></button>):<p className="muted">Thiết bị này chưa có ảnh. Chọn “Sửa hồ sơ” để bổ sung ảnh.</p>}</div>}
    {activePhoto&&<div className="photo-lightbox" onClick={()=>setActivePhoto(null)}><button type="button" className="icon-btn" onClick={()=>setActivePhoto(null)}><X/></button><img src={activePhoto} alt={'Ảnh thiết bị '+value.name}/></div>}
    {printMode&&<div className={'asset-print-sheet print-'+printMode}>
      {printMode==='sticker'&&<div className="asset-sticker"><QRCodeSVG value={`ASSET:${value.id}`} size={78} level="M"/><strong>{value.code}</strong></div>}
      {printMode==='detail'&&<div className="asset-print-report"><h1 className="asset-print-form-title">BẢNG CHI TIẾT THIẾT BỊ</h1><div className="asset-print-header"><div className="company-logo-placeholder"><span className="company-logo-mark">BT</span><span className="company-logo-wording"><strong>BAOTRI</strong><small>LOGO THỬ NGHIỆM</small></span></div><QRCodeSVG className="asset-print-header-qr" value={`ASSET:${value.id}`} size={104} level="M"/></div><h2 className="asset-print-device-name">{value.name}</h2><table><tbody>{rows.map(([label,val])=><tr key={label}><th>{label}</th><td>{val||'—'}</td></tr>)}</tbody></table></div>}
      {printMode==='history'&&<div className="asset-print-report print-history-report"><h1>LỊCH SỬ BẢO DƯỠNG – SỬA CHỮA</h1><h2>{value.name}</h2><b>Mã thiết bị: {value.code}</b><table className="print-history-table"><colgroup><col style={{width:'8%'}}/><col style={{width:'11%'}}/><col style={{width:'22%'}}/><col style={{width:'14%'}}/><col style={{width:'12%'}}/><col style={{width:'10%'}}/><col style={{width:'12%'}}/><col style={{width:'11%'}}/></colgroup><thead><tr><th>Ngày lập phiếu</th><th>Loại</th><th>Nội dung</th><th>Phụ tùng</th><th>Thông số</th><th>Kết quả</th><th>Hoàn thành lúc</th><th>Người thực hiện</th></tr></thead><tbody>{logs.map((entry:any)=><tr key={entry.id}><td>{dateText(entry.date)}</td><td>{entry.kind}</td><td>{entry.description}</td><td>{entry.parts||'—'}</td><td>{entry.readings||'—'}</td><td>{entry.result||'Chưa hoàn thành'}</td><td>{dateTimeText(entry.completedAt)}</td><td>{entry.performedBy||'—'}</td></tr>)}</tbody></table></div>}
    </div>}
  </Modal>
}

// Bộ Checklist nền theo đúng nhóm thiết bị. Mỗi thiết bị được tạo bản riêng để người dùng tùy chỉnh.
function buildDefaultChecklist(asset: Asset): ChecklistTemplateItem[] {
  const category = asset.category || ''
  const common = [
    'Kiểm tra vệ sinh bên ngoài, bụi bẩn và tình trạng tổng thể',
    'Kiểm tra nhãn thiết bị, cảnh báo và thông tin nhận diện',
    'Kiểm tra tiếng ồn, rung động hoặc dấu hiệu bất thường khi vận hành',
    'Kiểm tra rò rỉ, phát nhiệt, mùi khét hoặc dấu hiệu hư hỏng',
    'Kiểm tra khu vực xung quanh, lối tiếp cận và điều kiện an toàn'
  ]
  const byCategory: Record<string, string[]> = {
    'Động cơ điện': [
      'Kiểm tra thân máy, chân đế, bulông và khớp nối',
      'Kiểm tra tiếng ồn, rung động và nhiệt độ ổ bi',
      'Kiểm tra quạt làm mát, nắp che và đường thông gió',
      'Kiểm tra hộp cực, đầu cos, dây tiếp địa và độ chắc chắn đầu nối',
      'Đo điện áp ba pha và kiểm tra độ cân bằng pha',
      'Đo dòng điện ba pha khi động cơ mang tải',
      'Kiểm tra cách điện cuộn dây theo quy trình an toàn phù hợp',
      'Kiểm tra chiều quay, tốc độ và tình trạng tải',
      'Kiểm tra khớp nối, puly, dây đai hoặc cơ cấu truyền động',
      'Ghi nhận nhiệt độ ổ bi và thông số vận hành'
    ],
    'Máy bơm': [
      'Kiểm tra thân bơm, chân đế, bulông và khớp nối',
      'Kiểm tra rò rỉ tại phớt cơ khí, gioăng và mặt bích',
      'Kiểm tra áp suất hút và áp suất đẩy',
      'Kiểm tra lưu lượng hoặc khả năng cấp/thoát nước',
      'Kiểm tra tiếng ồn, rung động và nhiệt độ ổ bi',
      'Kiểm tra động cơ, dòng điện và chiều quay',
      'Kiểm tra van hút, van đẩy và van một chiều',
      'Kiểm tra lọc rác, đường ống và tình trạng tắc nghẽn',
      'Kiểm tra mồi bơm, mức nước và nguy cơ chạy khô',
      'Kiểm tra chế độ chạy luân phiên/dự phòng nếu có'
    ],
    'Máy nén khí': [
      'Kiểm tra mức dầu và tình trạng dầu bôi trơn',
      'Kiểm tra rò rỉ khí, dầu tại đầu nối và đường ống',
      'Kiểm tra áp suất khởi động, áp suất tải và áp suất ngắt',
      'Kiểm tra nhiệt độ đầu nén và nhiệt độ dầu',
      'Kiểm tra dòng điện động cơ và tình trạng tải',
      'Kiểm tra lọc hút gió và cảnh báo chênh áp lọc',
      'Kiểm tra bộ tách dầu, đường hồi dầu và mức tiêu hao dầu',
      'Xả nước ngưng tại bình chứa và bộ lọc',
      'Kiểm tra dây đai/khớp nối, tiếng ồn và rung động',
      'Kiểm tra van an toàn, nút dừng khẩn và cảnh báo lỗi',
      'Ghi nhận tổng giờ chạy và giờ chạy có tải'
    ],
    'Máy sấy khí': [
      'Kiểm tra áp suất khí vào/ra và chênh áp',
      'Kiểm tra nhiệt độ điểm sương hoặc chỉ thị độ ẩm',
      'Kiểm tra nhiệt độ dàn nóng/dàn lạnh nếu là máy sấy lạnh',
      'Kiểm tra quạt giải nhiệt và vệ sinh dàn trao đổi nhiệt',
      'Kiểm tra bộ xả nước ngưng tự động',
      'Kiểm tra rò rỉ khí, tiếng ồn và rung động',
      'Kiểm tra cảnh báo, đèn báo và chế độ vận hành'
    ],
    'Tủ điện': [
      'Kiểm tra vỏ tủ, cửa tủ, khóa và gioăng chống bụi',
      'Kiểm tra dấu hiệu ẩm, bụi, côn trùng và nước xâm nhập',
      'Kiểm tra đèn báo pha, đồng hồ và màn hình hiển thị',
      'Kiểm tra điện áp các pha và điện áp điều khiển',
      'Kiểm tra dòng tải các pha và tình trạng mất cân bằng',
      'Kiểm tra nhiệt độ bất thường tại aptomat, contactor và đầu nối',
      'Kiểm tra tiếng kêu, rung và mùi khét của thiết bị đóng cắt',
      'Kiểm tra dây tiếp địa, thanh cái và đầu cos bằng quan sát an toàn',
      'Kiểm tra quạt lọc gió, bộ sấy tủ và thông gió',
      'Kiểm tra sơ đồ điện, nhãn mạch và cảnh báo an toàn'
    ],
    'Tủ điện tổng': [
      'Kiểm tra tình trạng tổng thể tủ và khu vực đặt tủ',
      'Kiểm tra máy cắt tổng, cơ cấu đóng cắt và chỉ thị trạng thái',
      'Ghi nhận điện áp các pha và điện áp dây',
      'Ghi nhận dòng điện từng pha và dòng trung tính nếu có',
      'Kiểm tra nhiệt bất thường tại thanh cái, đầu cáp và máy cắt',
      'Kiểm tra hệ thống đo đếm, công tơ và hệ số công suất',
      'Kiểm tra tiếp địa, liên động và che chắn phần mang điện',
      'Kiểm tra thông gió, nhiệt độ và độ ẩm phòng điện',
      'Đối chiếu cảnh báo/rơ le bảo vệ và nhật ký sự cố'
    ],
    'Tủ điện phân phối': [
      'Kiểm tra vỏ tủ, cửa, khóa và sơ đồ phân phối',
      'Kiểm tra trạng thái aptomat nhánh và nhãn phụ tải',
      'Ghi nhận dòng tải các nhánh quan trọng',
      'Kiểm tra điểm phát nhiệt bất thường tại đầu nối',
      'Kiểm tra dấu hiệu quá tải, nhảy aptomat hoặc cháy sém',
      'Kiểm tra dây trung tính, dây tiếp địa và thanh cái',
      'Kiểm tra độ kín, bụi, ẩm và thông gió trong tủ'
    ],
    'Tủ điều khiển': [
      'Kiểm tra nguồn điều khiển và nguồn dự phòng nếu có',
      'Kiểm tra PLC, HMI, đèn báo và trạng thái lỗi',
      'Kiểm tra contactor, relay trung gian và rơ le nhiệt',
      'Kiểm tra cầu đấu, dây tín hiệu và đánh số dây',
      'Kiểm tra cảm biến, công tắc hành trình và tín hiệu phản hồi',
      'Thử nút Start/Stop và chế độ Auto/Manual theo quy trình',
      'Kiểm tra liên động, dừng khẩn và các chức năng bảo vệ',
      'Kiểm tra quạt tủ, lọc bụi và nhiệt độ bên trong'
    ],
    'Biến tần': [
      'Kiểm tra mã lỗi hiện tại và lịch sử lỗi',
      'Ghi nhận tần số đặt, tần số đầu ra và dòng điện',
      'Kiểm tra điện áp nguồn vào và điện áp DC bus theo hướng dẫn hãng',
      'Kiểm tra nhiệt độ biến tần và quạt làm mát',
      'Kiểm tra bụi bẩn, khe thông gió và tụ điện có dấu hiệu bất thường',
      'Kiểm tra dây động lực, dây tiếp địa và đầu nối',
      'Kiểm tra dây điều khiển, tín hiệu analog và truyền thông',
      'Thử lệnh chạy/dừng và tín hiệu liên động ở chế độ được phép',
      'Đối chiếu thông số cài đặt, thời gian tăng/giảm tốc và giới hạn bảo vệ'
    ],
    'UPS': [
      'Kiểm tra trạng thái UPS, chế độ hoạt động và cảnh báo',
      'Ghi nhận điện áp/tần số đầu vào và đầu ra',
      'Ghi nhận tải phần trăm và công suất tải',
      'Kiểm tra tình trạng ắc quy, ngày thay và cảnh báo pin',
      'Kiểm tra điện áp chuỗi ắc quy theo quy trình của hãng',
      'Kiểm tra quạt làm mát, nhiệt độ và thông gió',
      'Kiểm tra chế độ bypass và khả năng chuyển nguồn theo kế hoạch thử',
      'Kiểm tra nhật ký sự kiện và thời gian lưu điện ước tính'
    ],
    'Máy phát điện': [
      'Kiểm tra mức nhiên liệu, dầu bôi trơn và nước làm mát',
      'Kiểm tra rò rỉ nhiên liệu, dầu và nước làm mát',
      'Kiểm tra điện áp ắc quy khởi động và bộ sạc',
      'Kiểm tra mức nước làm mát, dây đai và két nước',
      'Kiểm tra tình trạng lọc gió, lọc dầu và lọc nhiên liệu',
      'Chạy thử không tải theo thời lượng quy định',
      'Ghi nhận điện áp, tần số và áp suất dầu khi chạy',
      'Kiểm tra bộ điều tốc, bộ điều khiển và cảnh báo',
      'Kiểm tra ATS/chế độ Auto và tín hiệu sẵn sàng',
      'Kiểm tra khí xả, giảm thanh, thông gió và nút dừng khẩn',
      'Ghi nhận giờ chạy và mức nhiên liệu sau thử'
    ],
    'Máy biến áp': [
      'Kiểm tra mức dầu, rò rỉ dầu và tình trạng bình dầu phụ nếu có',
      'Kiểm tra nhiệt độ dầu/cuộn dây và chỉ thị nhiệt',
      'Kiểm tra sứ cách điện, đầu cáp và dấu hiệu phóng điện',
      'Kiểm tra tiếng ù, rung và mùi bất thường',
      'Ghi nhận điện áp, dòng điện và mức tải các pha',
      'Kiểm tra tiếp địa vỏ máy và chống sét liên quan',
      'Kiểm tra quạt/bơm làm mát và bộ điều khiển nhiệt',
      'Kiểm tra khu vực đặt máy, thông gió và biển cảnh báo'
    ],
    'Máy phát điện dự phòng': [
      'Kiểm tra mức nhiên liệu, dầu bôi trơn và nước làm mát',
      'Kiểm tra ắc quy khởi động và bộ sạc',
      'Kiểm tra rò rỉ và tình trạng đường ống',
      'Chạy thử và ghi nhận điện áp, tần số, áp suất dầu',
      'Kiểm tra bộ điều khiển, cảnh báo và ATS',
      'Kiểm tra khí xả, thông gió và nút dừng khẩn'
    ],
    'Chiller': [
      'Ghi nhận nhiệt độ nước lạnh vào/ra',
      'Ghi nhận nhiệt độ nước giải nhiệt vào/ra nếu có',
      'Ghi nhận áp suất hút/đẩy và thông số môi chất theo màn hình máy',
      'Kiểm tra dòng điện máy nén và phần trăm tải',
      'Kiểm tra lưu lượng nước, chênh áp và tình trạng bơm',
      'Kiểm tra rò rỉ nước/môi chất và dấu hiệu đóng băng',
      'Kiểm tra dàn trao đổi nhiệt và vệ sinh bề mặt',
      'Kiểm tra quạt, bơm, van và cơ cấu chấp hành',
      'Kiểm tra cảnh báo, lịch sử lỗi và liên động bảo vệ',
      'Ghi nhận nhiệt độ môi trường/phòng máy và tình trạng thông gió'
    ],
    'Kho lạnh': [
      'Ghi nhận nhiệt độ hiển thị và nhiệt độ thực tế theo quy định',
      'Kiểm tra chênh lệch nhiệt độ, thời gian kéo nhiệt và cảnh báo',
      'Kiểm tra cửa kho, gioăng cửa và tình trạng đóng kín',
      'Kiểm tra lớp cách nhiệt, trần, vách và nền kho',
      'Kiểm tra dàn lạnh, quạt dàn lạnh và tình trạng đóng tuyết',
      'Kiểm tra dàn nóng, quạt giải nhiệt và vệ sinh',
      'Kiểm tra rò rỉ nước ngưng và đường thoát nước',
      'Kiểm tra áp suất/nhiệt độ hệ thống lạnh theo thông số máy',
      'Kiểm tra chuông báo, mở cửa khẩn cấp và cảnh báo nhiệt độ',
      'Ghi nhận tình trạng hàng hóa và lối lưu thông gió'
    ],
    'Điều hòa thông gió': [
      'Kiểm tra nhiệt độ gió cấp và gió hồi',
      'Kiểm tra lọc gió, vệ sinh và chênh áp lọc',
      'Kiểm tra dàn trao đổi nhiệt và khay nước ngưng',
      'Kiểm tra quạt, dây đai, ổ bi và độ rung',
      'Kiểm tra động cơ, dòng điện và chế độ chạy',
      'Kiểm tra van nước lạnh/van gas và cơ cấu điều khiển',
      'Kiểm tra rò rỉ nước, tắc đường thoát nước ngưng',
      'Kiểm tra cảm biến nhiệt độ, thermostat và tín hiệu BMS',
      'Kiểm tra damper, cửa gió và lưu lượng gió',
      'Kiểm tra tiếng ồn và tình trạng cách nhiệt đường ống'
    ],
    'Quạt công nghiệp': [
      'Kiểm tra cánh quạt, lồng bảo vệ và vỏ quạt',
      'Kiểm tra chân đế, bulông, khớp nối và độ chắc chắn',
      'Kiểm tra tiếng ồn, rung động và độ đồng tâm',
      'Kiểm tra ổ bi, nhiệt độ gối đỡ và bôi trơn',
      'Kiểm tra dây đai/puly hoặc khớp nối truyền động',
      'Kiểm tra động cơ, dòng điện và chiều quay',
      'Kiểm tra cửa gió, damper và tình trạng tắc nghẽn',
      'Kiểm tra lưu lượng gió và tình trạng hút/cấp',
      'Kiểm tra lưới chắn, tiếp địa và thiết bị bảo vệ'
    ],
    'Tháp giải nhiệt': [
      'Kiểm tra mức nước bể và tình trạng cấp nước bổ sung',
      'Kiểm tra quạt, cánh quạt, hộp giảm tốc và động cơ',
      'Kiểm tra rung động, tiếng ồn và nhiệt độ ổ bi',
      'Kiểm tra dây đai/khớp nối và bulông liên kết',
      'Kiểm tra vòi phun, tấm tản nhiệt và phân phối nước',
      'Kiểm tra bơm tuần hoàn, van và đường ống',
      'Kiểm tra xả đáy, cáu cặn, rêu và chất lượng nước theo quy định',
      'Ghi nhận nhiệt độ nước vào/ra'
    ],
    'Nồi hơi': [
      'Kiểm tra áp suất làm việc và đồng hồ áp suất',
      'Kiểm tra mức nước và thiết bị báo/cắt mức thấp',
      'Kiểm tra tình trạng đầu đốt và ngọn lửa qua ô quan sát',
      'Kiểm tra rò rỉ nhiên liệu, nước và hơi',
      'Kiểm tra van an toàn, van xả và đường ống',
      'Kiểm tra bơm cấp nước và hệ thống xử lý nước',
      'Kiểm tra cảnh báo, liên động và nút dừng khẩn',
      'Ghi nhận nhiệt độ, áp suất và thông số vận hành'
    ],
    'Phòng cháy chữa cháy': [
      'Kiểm tra trạng thái tủ điều khiển và nguồn điện chính/dự phòng',
      'Kiểm tra áp suất hệ thống và trạng thái van chính',
      'Kiểm tra bơm chính, bơm bù áp và bơm dự phòng',
      'Kiểm tra chế độ Auto/Manual và tín hiệu báo chạy',
      'Kiểm tra công tắc dòng chảy, công tắc áp suất và tín hiệu giám sát',
      'Kiểm tra bình chữa cháy, niêm phong và hạn kiểm định theo kế hoạch',
      'Kiểm tra lối tiếp cận, biển báo và tình trạng đầu phun/họng nước',
      'Ghi nhận sự cố/cảnh báo trên tủ trung tâm'
    ],
    'Thang máy': [
      'Kiểm tra trạng thái hoạt động và mã lỗi bộ điều khiển',
      'Kiểm tra cửa tầng, cửa cabin và cảm biến an toàn',
      'Kiểm tra nút gọi tầng, bảng hiển thị và đèn chiếu sáng',
      'Kiểm tra quạt thông gió và liên lạc khẩn cấp',
      'Kiểm tra tiếng ồn, rung và độ êm khi vận hành',
      'Kiểm tra cứu hộ tự động/nguồn dự phòng theo quy trình',
      'Kiểm tra phòng máy, tủ điện và dấu hiệu bất thường',
      'Ghi nhận tình trạng kiểm định và lịch bảo dưỡng đơn vị chuyên môn'
    ],
    'Băng tải': [
      'Kiểm tra dây băng, mối nối và tình trạng lệch băng',
      'Kiểm tra con lăn, tang chủ động/bị động và ổ bi',
      'Kiểm tra động cơ, hộp giảm tốc và khớp nối',
      'Kiểm tra dây đai/xích truyền động và độ căng',
      'Kiểm tra cơ cấu căng băng và gạt liệu',
      'Kiểm tra công tắc lệch băng, dây giật dừng khẩn',
      'Kiểm tra tiếng ồn, rung và nhiệt độ ổ bi',
      'Kiểm tra che chắn an toàn và vệ sinh khu vực'
    ]
  }
  Object.assign(byCategory, {
    'Bộ chuyển nguồn ATS': [
      'Kiểm tra trạng thái nguồn lưới và nguồn máy phát trên bộ điều khiển',
      'Kiểm tra chế độ Auto/Manual và tín hiệu sẵn sàng',
      'Kiểm tra chỉ thị vị trí máy cắt/contactor nguồn lưới và máy phát',
      'Kiểm tra liên động điện và cơ khí, tránh đóng song song ngoài thiết kế',
      'Kiểm tra thời gian trễ chuyển nguồn và chuyển trả nguồn',
      'Kiểm tra cảnh báo, nguồn điều khiển và ắc quy nếu có',
      'Kiểm tra đầu nối, dây tín hiệu và tiếp địa',
      'Thử chuyển nguồn theo kế hoạch được phê duyệt và ghi nhận kết quả'
    ],
    'Tủ tụ bù': [
      'Kiểm tra bộ điều khiển tụ bù và hệ số công suất hiển thị',
      'Ghi nhận hệ số công suất trước/sau khi đóng cấp tụ',
      'Kiểm tra trạng thái đóng cắt từng cấp tụ',
      'Kiểm tra contactor chuyên dụng hoặc thyristor đóng cắt tụ',
      'Kiểm tra tụ điện phồng, rò dầu, nứt vỡ hoặc biến dạng',
      'Kiểm tra cầu chì, cuộn kháng lọc sóng hài và đầu nối',
      'Kiểm tra nhiệt độ trong tủ, quạt làm mát và thông gió',
      'Ghi nhận cảnh báo quá áp, quá dòng hoặc quá nhiệt'
    ],
    'Hộp giảm tốc': [
      'Kiểm tra mức dầu, chất lượng dầu và lịch thay dầu',
      'Kiểm tra rò rỉ dầu tại phớt và mặt ghép',
      'Kiểm tra tiếng ồn, rung động và nhiệt độ vỏ hộp',
      'Kiểm tra độ chắc chắn bulông chân đế và mặt bích',
      'Kiểm tra khớp nối, then, puly hoặc nhông xích liên kết',
      'Kiểm tra độ đồng tâm và tình trạng tải truyền động',
      'Kiểm tra nút thông hơi, nút châm và nút xả dầu'
    ],
    'Thiết bị đo lường': [
      'Kiểm tra tình trạng vỏ, màn hình và đầu nối thiết bị',
      'Kiểm tra nguồn cấp và tín hiệu đầu ra',
      'Đối chiếu giá trị đo với thiết bị chuẩn hoặc giá trị tham chiếu',
      'Kiểm tra dây tín hiệu, chống nhiễu và tiếp địa',
      'Kiểm tra vị trí lắp đặt, rung động, nhiệt độ và độ ẩm',
      'Kiểm tra hạn hiệu chuẩn/kiểm định và tem nhận diện',
      'Ghi nhận sai lệch đo và tình trạng cảnh báo'
    ],
    'Bộ lọc khí nén': [
      'Kiểm tra chênh áp trước và sau bộ lọc',
      'Kiểm tra lõi lọc và thời hạn thay thế',
      'Kiểm tra cốc lọc, nứt vỡ và rò rỉ',
      'Kiểm tra bộ xả nước ngưng tự động/thủ công',
      'Kiểm tra áp suất làm việc và tình trạng tắc nghẽn',
      'Kiểm tra van khóa, bypass và chiều dòng khí',
      'Ghi nhận tình trạng nước, dầu và bụi bẩn trong cốc lọc'
    ],
    'Khí nén': [
      'Kiểm tra áp suất đường ống chính và áp suất tại điểm sử dụng',
      'Kiểm tra rò rỉ tại khớp nối, van và ống mềm',
      'Kiểm tra giá đỡ, rung động và ăn mòn đường ống',
      'Kiểm tra van khóa, van xả và van điều áp',
      'Kiểm tra bộ lọc, bộ điều áp và bộ tra dầu tại điểm dùng',
      'Kiểm tra nước ngưng và điểm xả thấp đường ống',
      'Ghi nhận sụt áp bất thường và khu vực tiêu thụ lớn'
    ],
    'Nồi hấp': [
      'Kiểm tra tình trạng buồng hấp, cửa và gioăng làm kín',
      'Kiểm tra áp suất, nhiệt độ và đồng hồ hiển thị',
      'Kiểm tra van an toàn, van xả và đường thoát nước',
      'Kiểm tra cấp nước, tạo hơi và xả ngưng',
      'Kiểm tra khóa liên động cửa và thiết bị bảo vệ',
      'Kiểm tra chương trình chu trình, cảnh báo và nhật ký lỗi',
      'Ghi nhận kết quả thử chu trình theo quy trình của đơn vị'
    ],
    'Thiết bị xưởng': [
      'Kiểm tra vỏ máy, chân đế, bulông và che chắn an toàn',
      'Kiểm tra nguồn điện, dây dẫn và tiếp địa',
      'Kiểm tra công tắc, nút dừng khẩn và thiết bị bảo vệ',
      'Kiểm tra cơ cấu truyền động, ray trượt hoặc bộ phận chuyển động',
      'Kiểm tra tiếng ồn, rung động và phát nhiệt',
      'Thử vận hành không tải và có tải theo hướng dẫn',
      'Kiểm tra vệ sinh, bôi trơn và tình trạng phụ kiện'
    ]
  })
  // Ghép tiêu chí theo nhóm và theo chính tên thiết bị; tên cụ thể được ưu tiên bổ sung vào bộ nhóm.
  let labels = byCategory[category]
  if (!labels && category.toLowerCase().includes('quạt')) labels = byCategory['Quạt công nghiệp']
  if (!labels && category.toLowerCase().includes('điều hòa')) labels = byCategory['Điều hòa thông gió']
  if (!labels && category.toLowerCase().includes('tủ điện')) labels = byCategory['Tủ điện']
  if (!labels && category.toLowerCase().includes('máy bơm')) labels = byCategory['Máy bơm']
  if (!labels && category.toLowerCase().includes('máy nén')) labels = byCategory['Máy nén khí']
  const name = (asset.name || '').toLocaleLowerCase('vi')
  const nameRules: Array<{pattern:RegExp;items:string[]}> = [
    {pattern:/hàn.*xung|xung.*hàn/,items:[
      'Kiểm tra bề mặt điện cực hàn, đầu hàn và độ đồng tâm',      'Kiểm tra lực ép, hành trình và cơ cấu kẹp phôi',
      'Kiểm tra thời gian xung, dòng hàn và thông số chương trình theo quy trình đã duyệt',
      'Kiểm tra cáp hàn, đầu nối công suất và dấu hiệu quá nhiệt',
      'Kiểm tra hệ thống làm mát điện cực/biến áp nếu được trang bị',
      'Kiểm tra che chắn, bàn đạp/công tắc kích hoạt và dừng khẩn cấp'
    ]},
    {pattern:/máy hàn|hàn mig|hàn tig|hàn que/,items:[
      'Kiểm tra nguồn hàn, dây hàn, kìm hàn/súng hàn và đầu nối',
      'Kiểm tra kẹp mass, tiếp xúc điện và cách điện dây dẫn',
      'Kiểm tra lưu lượng khí bảo vệ và đường ống khí nếu có',
      'Kiểm tra quạt làm mát, chu kỳ tải và cảnh báo quá nhiệt',
      'Kiểm tra tiếp địa, màn chắn hồ quang và phương tiện PCCC khu vực hàn'
    ]},
    {pattern:/máy khoan|khoan pin/,items:[
      'Kiểm tra đầu kẹp/mâm cặp, độ đảo và khả năng giữ mũi khoan',
      'Kiểm tra công tắc cò, đảo chiều, điều tốc và khóa an toàn',
      'Kiểm tra pin, bộ sạc hoặc dây nguồn và đầu nối',
      'Kiểm tra tay cầm phụ, vỏ cách điện và tình trạng mũi khoan'
    ]},
    {pattern:/máy mài/,items:[
      'Kiểm tra đá mài/lưỡi cắt đúng chủng loại, tốc độ cho phép và không nứt vỡ',
      'Kiểm tra vành chắn bảo vệ, tay cầm phụ và công tắc',
      'Kiểm tra trục chính, mặt bích kẹp đá và rung bất thường',
      'Kiểm tra dây nguồn/pin, vỏ cách điện và tình trạng phát nhiệt'
    ]},
    {pattern:/máy cắt|cưa đĩa|máy cưa/,items:[
      'Kiểm tra lưỡi cắt, độ chắc chắn và tình trạng mẻ/nứt',
      'Kiểm tra cơ cấu chắn lưỡi, khóa liên động và nút dừng',
      'Kiểm tra bàn/kẹp phôi, cơ cấu dẫn hướng và độ rung',
      'Kiểm tra động cơ, dây nguồn và dấu hiệu quá nhiệt'
    ]},
    {pattern:/máy siết|súng siết|siết bu lông/,items:[
      'Kiểm tra đầu khẩu, cơ cấu đảo chiều và lực siết cài đặt',
      'Kiểm tra cò điều khiển, khóa cò và cơ cấu giữ đầu khẩu',
      'Kiểm tra pin/bộ sạc hoặc dây cấp nguồn'
    ]},
    {pattern:/máy nén khí/,items:[
      'Ghi nhận áp suất cài đặt, áp suất tải/ngắt và giờ chạy',
      'Kiểm tra mức dầu, lọc hút, bộ tách dầu và xả nước ngưng',
      'Kiểm tra van an toàn, rơ le áp suất và cảnh báo'
    ]},
    {pattern:/máy in|printer/,items:[
      'Kiểm tra đầu in, cơ cấu kéo giấy/vật liệu và chất lượng bản in',
      'Kiểm tra cảm biến giấy/vật liệu, nắp che và cảnh báo kẹt',
      'Kiểm tra nguồn cấp, dây tín hiệu và kết nối điều khiển'
    ]},
    {pattern:/máy đóng gói|đóng gói/,items:[
      'Kiểm tra cơ cấu cấp liệu, định lượng và độ kín/đúng quy cách đóng gói',
      'Kiểm tra cảm biến, công tắc hành trình và liên động cửa che',
      'Kiểm tra bộ gia nhiệt/hàn miệng túi nếu có',
      'Kiểm tra nút dừng khẩn cấp và che chắn bộ phận chuyển động'
    ]},
    {pattern:/máy đo|đồng hồ đo|ampe kìm|đồng hồ vạn năng/,items:[
      'Kiểm tra que đo, dây đo, cầu chì bảo vệ và đầu cắm đúng cổng',
      'Kiểm tra tình trạng vỏ, màn hình, pin và cấp an toàn đo lường',
      'Đối chiếu tình trạng hiệu chuẩn/kiểm định và tem nhận diện'
    ]}
  ]
  const matchedNameItems = nameRules.filter(rule=>rule.pattern.test(name)).flatMap(rule=>rule.items)
  const fallback = ['Kiểm tra nguồn cấp và thông số vận hành theo nhãn thiết bị','Kiểm tra cơ cấu bảo vệ, liên động và nút dừng khẩn cấp nếu có','Ghi nhận thông số vận hành và hiện tượng bất thường']
  const merged = [...new Set([...common,...(labels??fallback),...matchedNameItems])]
  return merged.map((label, order) => ({
    id: uid(), label, description: 'Hạng mục mặc định. Thực hiện theo hướng dẫn nhà sản xuất và quy trình an toàn của cơ sở; chỉ kiểm tra/thử nghiệm khi đã cô lập năng lượng và đủ điều kiện an toàn.',
    answerType: 'pass-fail-na', required: true, order
  }))
}

async function ensureDefaultChecklist(asset: Asset) {
  return db.transaction('rw', db.checklistTemplates, db.checklistVersions, async () => {
    const existing = await db.checklistTemplates.where('assetId').equals(asset.id).first()
    if (existing) return existing.id
    const timestamp = now()
    const templateId = uid()
    const title = 'Checklist bảo trì – ' + (asset.category || 'Thiết bị')
    const description = 'Biểu mẫu nền tự động theo nhóm thiết bị. Admin có thể bổ sung, xóa hoặc chỉnh sửa hạng mục theo cấu hình thực tế.'
    const items = buildDefaultChecklist(asset)
    await db.checklistTemplates.add({
      id: templateId, assetId: asset.id, title, description, currentVersion: 1,
      active: true, createdAt: timestamp, updatedAt: timestamp
    })
    await db.checklistVersions.add({
      id: uid(), templateId, assetId: asset.id, version: 1, title, description, items, createdAt: timestamp
    })
    return templateId
  })
}

function AssetChecklist({asset,allowActions,scheduledFor,isMakeup,createRepairFromChecklist}:{asset:Asset;allowActions:boolean;scheduledFor?:string;isMakeup?:boolean;createRepairFromChecklist:(entry:ChecklistResult)=>void}) {
  const template = useLiveQuery(() => db.checklistTemplates.where('assetId').equals(asset.id).first(), [asset.id])
  useEffect(() => {
    let active = true
    if (!allowActions) return () => { active = false }
    void ensureDefaultChecklist(asset).then(async templateId => {
      if (active && templateId) await queueChange('checklistTemplates', templateId)
    }).catch(error => console.error('Không thể tạo Checklist mẫu:', error))
    return () => { active = false }
  }, [asset.id, allowActions])
  const versions = useLiveQuery(() => template ? db.checklistVersions.where('templateId').equals(template.id).toArray() : Promise.resolve([] as ChecklistTemplateVersion[]), [template?.id])
  const results = useLiveQuery(() => db.checklistResults.where('assetId').equals(asset.id).toArray(), [asset.id]) ?? []
  const [builderOpen,setBuilderOpen] = useState(false)
  const [runOpen,setRunOpen] = useState(false)
  const [draftTitle,setDraftTitle] = useState('')
  const [draftDescription,setDraftDescription] = useState('')
  const [draftItems,setDraftItems] = useState<ChecklistTemplateItem[]>([])
  const [answers,setAnswers] = useState<Record<string,string>>({})
  const [itemNotes,setItemNotes] = useState<Record<string,string>>({})
  const [performedBy,setPerformedBy] = useState('Người sử dụng')
  const [resultNotes,setResultNotes] = useState('')
  const [printEntry,setPrintEntry] = useState<ChecklistResult|null>(null)
  const currentVersion = versions?.find(v=>v.version===template?.currentVersion)
  const orderedResults = results.slice().sort((a,b)=>b.performedAt.localeCompare(a.performedAt))
  const openBuilder = async () => {
    if (!allowActions) return
    setDraftTitle(template?.title ?? ('Checklist - '+asset.name))
    setDraftDescription(template?.description ?? '')
    const current = template ? await db.checklistVersions.where('templateId').equals(template.id).toArray() : []
    const latest = current.find(v=>v.version===template?.currentVersion)
    setDraftItems(latest?.items.map(item=>({...item})) ?? [])
    setBuilderOpen(true)
  }
  const addItem = () => setDraftItems(items=>[...items,{id:uid(),label:'',description:'',answerType:'pass-fail-na',required:true,order:items.length}])
  const updateItem = (id:string,patch:Partial<ChecklistTemplateItem>) => setDraftItems(items=>items.map(item=>item.id===id?{...item,...patch}:item))
  const saveTemplate = async (event:FormEvent) => {
    event.preventDefault()
    if (!allowActions) return
    const cleanItems = draftItems.filter(item=>item.label.trim()).map((item,index)=>({...item,label:item.label.trim(),order:index}))
    if(!draftTitle.trim()) return alert('Nhập tên biểu mẫu Checklist')
    if(!cleanItems.length) return alert('Thêm ít nhất một hạng mục kiểm tra')
    const timestamp=now()
    const templateId=template?.id ?? uid()
    const nextVersion=(template?.currentVersion ?? 0)+1
    const versionId=uid()
    const nextTemplate={id:templateId,assetId:asset.id,title:draftTitle.trim(),description:draftDescription,currentVersion:nextVersion,active:true,createdAt:template?.createdAt??timestamp,updatedAt:timestamp}
    await db.transaction('rw',db.checklistTemplates,db.checklistVersions,async()=>{
      await db.checklistTemplates.put(nextTemplate)
      await db.checklistVersions.add({id:versionId,templateId,assetId:asset.id,version:nextVersion,title:draftTitle.trim(),description:draftDescription,items:cleanItems,createdAt:timestamp})
    })
    await queueChange('checklistTemplates',templateId)
    setBuilderOpen(false)
    alert('Đã lưu biểu mẫu phiên bản '+nextVersion+'. Các phiên bản và phiếu cũ được giữ nguyên.')
  }
  const startRun = () => {
    if (!allowActions) return
    if(!template || !currentVersion) return alert('Thiết bị này chưa có biểu mẫu Checklist')
    setAnswers({})
    setItemNotes({})
    setResultNotes('')
    setRunOpen(true)
  }
  const saveResult = async (event:FormEvent) => {
    event.preventDefault()
    if (!allowActions) return
    if(!template || !currentVersion) return
    const items:ChecklistResultItem[]=currentVersion.items.map(item=>({...item,templateItemId:item.id,answer:answers[item.id]??'',note:itemNotes[item.id]??''}))
    if(items.some(item=>item.required&&!item.answer.trim())) return alert('Vui lòng hoàn thành các hạng mục bắt buộc')
    const failed=items.some(item=>item.answer==='Không đạt'||item.answer==='Không')
    const performedAt=now()
    const entry: ChecklistResult = {id:uid(),assetId:asset.id,templateId:template.id,templateVersionId:currentVersion.id,templateVersion:currentVersion.version,templateTitle:currentVersion.title,performedAt,performedBy:performedBy.trim()||'Người sử dụng',result:failed?'Không đạt':'Đạt',scheduledFor:scheduledFor||undefined,isMakeup:Boolean(scheduledFor && (isMakeup || performedAt.slice(0,10)>scheduledFor)),notes:resultNotes,items,createdAt:performedAt}
    await db.checklistResults.add(entry)
    await queueChange('checklistResults',entry.id)
    setRunOpen(false)
    alert(scheduledFor && (isMakeup || performedAt.slice(0,10)>scheduledFor)?'Đã lưu phiếu Checklist bù cho ngày '+dateText(scheduledFor)+'. Kỳ này đã được ghi nhận hoàn thành.':'Đã lưu phiếu Checklist. Kết quả được lưu thành một lần thực hiện riêng.')
  }
  return <section className="asset-maintenance-history">
    <div className="panel-head"><div><h3>1. Bảo trì – Checklist</h3><p>{template?('Biểu mẫu riêng · Phiên bản '+template.currentVersion+' · '+orderedResults.length+' lần thực hiện'):(allowActions?'Thiết bị chưa có biểu mẫu Checklist riêng':'Lịch sử các phiếu Checklist đã lưu')}</p></div>
      <div className="asset-photo-actions"><button type="button" className="soft-btn" disabled={!allowActions} title={!allowActions?'Viewer chỉ có quyền xem':undefined} onClick={openBuilder}>{template?'Sửa biểu mẫu':'Tạo biểu mẫu'}</button><button type="button" className="primary-btn" disabled={!allowActions || !template || !currentVersion} title={!allowActions?'Viewer chỉ có quyền xem':undefined} onClick={startRun}>{isMakeup?'Thực hiện Checklist bù':'Thực hiện Checklist'}</button></div>
    </div>
    {template&&currentVersion&&<div className="maintenance-history-list"><b>{currentVersion.title}</b>{currentVersion.description&&<p>{currentVersion.description}</p>}{currentVersion.items.map((item,index)=><article key={item.id}><time>{index+1}</time><div><b>{item.label}</b>{item.description&&<small>{item.description}</small>}</div></article>)}</div>}
    <section className="checklist-results">
      <div className="panel-head"><div><b>Lịch sử Bảo trì – Checklist</b><p>{orderedResults.length} phiếu đã thực hiện · lưu riêng, không tính vào lịch sử sửa chữa</p></div></div>
      {orderedResults.length>0?<div className="maintenance-history-list">{orderedResults.map(entry=><article key={entry.id}><time>{new Date(entry.performedAt).toLocaleString('vi-VN')}</time><div><b>{entry.templateTitle} · v{entry.templateVersion}</b><small>Người thực hiện: {entry.performedBy} · Kết quả: {entry.result}</small>{entry.scheduledFor&&<small>Kỳ Checklist: {dateText(entry.scheduledFor)}{entry.isMakeup?' · Checklist bù':''}</small>}{entry.notes&&<small>Ghi chú: {entry.notes}</small>}<div className="checklist-result-actions"><button type="button" className="soft-btn" onClick={()=>{setPrintEntry(entry);window.setTimeout(()=>window.print(),180)}}><Printer size={14}/> In phiếu A4</button>{entry.result==='Không đạt'&&<button type="button" className="soft-btn" disabled={!allowActions} title={!allowActions?'Tài khoản chỉ có quyền xem':undefined} onClick={()=>createRepairFromChecklist(entry)}><Wrench size={14}/> Tạo phiếu Bảo dưỡng – Sửa chữa</button>}</div><details><summary>Xem chi tiết phiếu</summary>{entry.items.map((item,index)=><p key={item.templateItemId}>{index+1}. {item.label}: <b>{item.answer||'—'}</b>{item.note?' · '+item.note:''}</p>)}</details></div></article>)}</div>:<p className="muted">Chưa có phiếu Checklist nào. Sau khi nhấn “Thực hiện Checklist” và “Lưu phiếu kết quả”, phiếu sẽ xuất hiện tại đây.</p>}
    </section>
    {printEntry&&<div className="asset-print-sheet print-checklist"><div className="asset-print-report">
      <h1 className="asset-print-form-title">PHIẾU KIỂM TRA CHECKLIST THIẾT BỊ</h1>
      <div className="checklist-print-meta">
        <div><b>Mã thiết bị:</b> {asset.code}</div><div><b>Tên thiết bị:</b> {asset.name}</div>
        <div><b>Nhóm thiết bị:</b> {asset.category}</div><div><b>Vị trí:</b> {asset.location||'—'}</div>
        <div><b>Biểu mẫu:</b> {printEntry.templateTitle} · Phiên bản {printEntry.templateVersion}</div>
        <div><b>Thời gian:</b> {new Date(printEntry.performedAt).toLocaleString('vi-VN')}</div>{printEntry.scheduledFor&&<div><b>Kỳ Checklist:</b> {dateText(printEntry.scheduledFor)}{printEntry.isMakeup?' · Checklist bù':''}</div>}
        <div><b>Người thực hiện:</b> {printEntry.performedBy}</div><div><b>Kết quả chung:</b> {printEntry.result}</div>
      </div>
      <table className="checklist-print-table"><thead><tr><th style={{width:'5%'}}>STT</th><th style={{width:'34%'}}>Nội dung kiểm tra</th><th style={{width:'7%'}}>Đạt</th><th style={{width:'9%'}}>Không đạt</th><th style={{width:'8%'}}>KPH</th><th style={{width:'19%'}}>Kết quả / thông số</th><th style={{width:'18%'}}>Ghi chú</th></tr></thead><tbody>{printEntry.items.map((item,index)=><tr key={item.templateItemId}><td className="checklist-print-center">{index+1}</td><td><b>{item.label}</b>{item.description&&<div className="checklist-print-description">{item.description}</div>}</td><td className="checklist-print-center">{item.answer==='Đạt'?'✓':''}</td><td className="checklist-print-center">{item.answer==='Không đạt'?'✓':''}</td><td className="checklist-print-center">{item.answer==='Không áp dụng'?'✓':''}</td><td>{['Đạt','Không đạt','Không áp dụng'].includes(item.answer)?'':(item.answer||'—')}</td><td>{item.note||'—'}</td></tr>)}</tbody></table>
      {printEntry.notes&&<p><b>Ghi chú chung:</b> {printEntry.notes}</p>}
      <div className="checklist-signatures"><div><b>Người thực hiện</b><small>(Ký, ghi rõ họ tên)</small></div><div><b>Người kiểm tra / xác nhận</b><small>(Ký, ghi rõ họ tên)</small></div></div>
    </div></div>}
    {allowActions&&builderOpen&&<Modal title={template?'Chỉnh sửa biểu mẫu Checklist':'Tạo Checklist cho thiết bị'} close={()=>setBuilderOpen(false)}><form className="form-grid" onSubmit={saveTemplate}>
      <div className="form-hint">Thiết bị: <b>{asset.code} – {asset.name}</b>. Biểu mẫu này chỉ thuộc thiết bị đang mở.</div>
      <Field label="Tên biểu mẫu *"><input required value={draftTitle} onChange={e=>setDraftTitle(e.target.value)}/></Field>
      <Field label="Mô tả"><textarea value={draftDescription} onChange={e=>setDraftDescription(e.target.value)}/></Field>
      <div className="form-hint">Danh sách hạng mục kiểm tra</div>
      {draftItems.map((item,index)=><div className="panel" key={item.id}><b>Hạng mục {index+1}</b><Field label="Nội dung kiểm tra"><input value={item.label} onChange={e=>updateItem(item.id,{label:e.target.value})} placeholder="Ví dụ: Kiểm tra áp suất làm việc"/></Field><Field label="Ghi chú hướng dẫn"><input value={item.description??''} onChange={e=>updateItem(item.id,{description:e.target.value})}/></Field><Field label="Kiểu kết quả"><select value={item.answerType} onChange={e=>updateItem(item.id,{answerType:e.target.value as ChecklistTemplateItem['answerType']})}><option value="pass-fail-na">Đạt / Không đạt / Không áp dụng</option><option value="yes-no">Có / Không</option><option value="text">Ghi nội dung</option><option value="number">Nhập số</option></select></Field><label><input type="checkbox" checked={item.required} onChange={e=>updateItem(item.id,{required:e.target.checked})}/> Bắt buộc thực hiện</label><button type="button" className="text-btn danger" onClick={()=>setDraftItems(items=>items.filter(x=>x.id!==item.id))}>Xóa hạng mục</button></div>)}
      <button type="button" className="soft-btn" onClick={addItem}><Plus size={16}/> Thêm hạng mục</button>
      <div className="modal-actions"><button type="button" className="soft-btn" onClick={()=>setBuilderOpen(false)}>Hủy</button><button className="primary-btn"><Check size={16}/> Lưu biểu mẫu</button></div>
    </form></Modal>}
    {allowActions&&runOpen&&currentVersion&&<Modal title="Thực hiện Checklist" close={()=>setRunOpen(false)}><form className="form-grid" onSubmit={saveResult}>
      <div className="form-hint"><b>{asset.code} – {asset.name}</b><br/>{currentVersion.title} · Phiên bản {currentVersion.version}</div>
      <Field label="Người thực hiện"><input value={performedBy} onChange={e=>setPerformedBy(e.target.value)}/></Field>
      {currentVersion.items.map((item,index)=><div className="panel" key={item.id}><b>{index+1}. {item.label}{item.required?' *':''}</b>{item.description&&<small>{item.description}</small>}{item.answerType==='pass-fail-na'?<Field label="Kết quả"><select required={item.required} value={answers[item.id]??''} onChange={e=>setAnswers(a=>({...a,[item.id]:e.target.value}))}><option value="">-- Chọn kết quả --</option><option>Đạt</option><option>Không đạt</option><option>Không áp dụng</option></select></Field>:item.answerType==='yes-no'?<Field label="Kết quả"><select required={item.required} value={answers[item.id]??''} onChange={e=>setAnswers(a=>({...a,[item.id]:e.target.value}))}><option value="">-- Chọn --</option><option>Có</option><option>Không</option></select></Field>:<Field label="Giá trị ghi nhận"><input required={item.required} type={item.answerType==='number'?'number':'text'} value={answers[item.id]??''} onChange={e=>setAnswers(a=>({...a,[item.id]:e.target.value}))}/></Field>}<Field label="Ghi chú"><input value={itemNotes[item.id]??''} onChange={e=>setItemNotes(a=>({...a,[item.id]:e.target.value}))}/></Field></div>)}
      <Field label="Ghi chú chung"><textarea value={resultNotes} onChange={e=>setResultNotes(e.target.value)}/></Field>
      <div className="modal-actions"><button type="button" className="soft-btn" onClick={()=>setRunOpen(false)}>Hủy</button><button className="primary-btn"><Check size={16}/> Lưu phiếu kết quả</button></div>
    </form></Modal>}
  </section>
}

function LogEntryModal({value,close,save,assets,userName,isExisting}:{value:Log;close:()=>void;save:(entry:Log)=>void;assets:Asset[];userName:string;isExisting:boolean}){
  const [v,setV]=useState<Log>(()=>({...value,performedBy:value.performedBy||userName,result:value.result||''}))
  const set = <K extends keyof Log,>(key: K, val: Log[K]) => setV(p => ({ ...p, [key]: val }))
  return <Modal title={isExisting?'Cập nhật phiếu Bảo dưỡng – Sửa chữa':'Tạo phiếu Bảo dưỡng – Sửa chữa'} close={close}><form className="form-grid" onSubmit={async e=>{e.preventDefault();if(!v.assetId)return alert('Chọn thiết bị');if(!v.description.trim())return alert('Nhập nội dung công việc');await save(v)}}>
    <Field label="Thiết bị *"><select required value={v.assetId} onChange={e=>set('assetId',e.target.value)}><option value="">-- Chọn thiết bị --</option>{assets.filter(asset=>!asset.archivedAt).map(asset=><option key={asset.id} value={asset.id}>{asset.code} · {asset.name}</option>)}</select></Field>
    <Field label="Ngày lập phiếu"><input type="date" value={v.date} onChange={e=>set('date',e.target.value)}/></Field>
    <Field label="Loại công việc"><select value={v.kind} onChange={e=>set('kind',e.target.value)}>{['Bảo dưỡng định kỳ','Sửa chữa','Thay thế phụ tùng','Hiệu chuẩn','Khác'].map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Nội dung thực hiện *"><textarea required value={v.description} onChange={e=>set('description',e.target.value)}/></Field>
    <Field label="Vật tư / phụ tùng thay thế"><textarea value={v.parts} onChange={e=>set('parts',e.target.value)}/></Field>
    <Field label="Thông số sau thực hiện"><textarea value={v.readings} onChange={e=>set('readings',e.target.value)}/></Field>
    {isExisting?<Field label="Kết quả sau thực hiện"><div className="result-choice"><label><input type="radio" name="maintenance-result" checked={v.result==='Đạt'} onChange={()=>set('result','Đạt')}/> Đạt</label><label><input type="radio" name="maintenance-result" checked={v.result==='Không đạt'} onChange={()=>set('result','Không đạt')}/> Không đạt</label></div></Field>:<div className="form-hint">Kết quả sẽ được ghi nhận sau khi công việc hoàn tất. Hãy lưu phiếu trước, sau đó mở lại phiếu để cập nhật kết quả.</div>}
    <Field label="Người thực hiện *"><input required value={v.performedBy} onChange={e=>set('performedBy',e.target.value)}/></Field>
    <div className="form-actions"><button type="button" className="soft-btn" onClick={close}>Hủy</button><button type="submit" className="primary-btn">{isExisting?(v.result?'Lưu kết quả hoàn thành':'Lưu phiếu chưa hoàn thành'):'Tạo phiếu chưa hoàn thành'}</button></div>
  </form></Modal>
}

function AssetModal({value,close,save,assets,customCategories=[],onAddCategory,onExportConvention}:any){
  const [v,setV]=useState<Asset>(value)
  const [showAddCategory,setShowAddCategory]=useState(false)
  const [newGroupName,setNewGroupName]=useState('')
  const [selectedCustomGroup,setSelectedCustomGroup]=useState('')
  const [newCategoryName,setNewCategoryName]=useState('')
  const [newCategoryCode,setNewCategoryCode]=useState('')
  const isNew=!value.code
  const set=(k:keyof Asset,x:any)=>setV(p=>({...p,[k]:x}))
  const categoryCodes=getAssetCategoryCodes(customCategories)
  const addingToExistingGroup=Boolean(selectedCustomGroup)
  const activeGroupName=addingToExistingGroup?selectedCustomGroup:newGroupName
  const previewCode=isNew&&categoryCodes[v.category]?buildAssetCode(v,assets,customCategories):''
  const suggestedCategory=suggestAssetCategory(v.name)
  const showCategoryWarning=Boolean(suggestedCategory)&&suggestedCategory!==v.category
  return <Modal title={isNew?'Thêm thiết bị':'Thông tin thiết bị'} close={close}><form onSubmit={e=>{e.preventDefault();if(!v.name.trim())return alert('Nhập tên thiết bị');if(!categoryCodes[v.category])return alert('Chọn nhóm thiết bị hợp lệ');save(v)}} className="form-grid">
    <Field label="Tên thiết bị *"><input required value={v.name} placeholder="Ví dụ: Quạt hút khu vực đóng gói số 1" onChange={e=>set('name',e.target.value)}/></Field>
    <Field label="Loại thiết bị *"><select required disabled={!isNew} value={v.category} onChange={e=>set('category',e.target.value)}><option value="">-- Chọn loại thiết bị --</option>{ASSET_CATEGORY_GROUPS.map(group=><optgroup key={group.label} label={group.label}>{group.items.map(item=><option key={item.name} value={item.name}>{item.name} · {item.code}</option>)}</optgroup>)}{customCategories.map((group:CustomAssetCategoryGroup)=><optgroup key={group.label} label={group.label}>{group.items.map(item=><option key={item.name} value={item.name}>{item.name} · {item.code}</option>)}</optgroup>)}</select>{isNew&&<button type="button" className="soft-btn" style={{marginTop:8}} onClick={()=>setShowAddCategory(x=>!x)}><Plus size={15}/> Thêm nhóm / loại thiết bị</button>}{showAddCategory&&isNew&&<div className="panel" style={{marginTop:10,display:'grid',gap:8}}><Field label="Thêm vào nhóm đã có (không bắt buộc)"><select value={selectedCustomGroup} onChange={e=>{setSelectedCustomGroup(e.target.value);setNewGroupName('')}}><option value="">-- Tạo nhóm mới --</option>{customCategories.map((group:CustomAssetCategoryGroup)=><option key={group.label} value={group.label}>{group.label}</option>)}</select></Field>{!addingToExistingGroup&&<Field label="Tên nhóm mới *"><input value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} placeholder="Ví dụ: TB Y TẾ"/></Field>}<Field label="Tên loại thiết bị *"><input value={newCategoryName} onChange={e=>setNewCategoryName(e.target.value)} placeholder="Ví dụ: Máy làm răng"/></Field><Field label="Mã loại thiết bị *"><input value={newCategoryCode} onChange={e=>setNewCategoryCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} maxLength={5} placeholder="Ví dụ: MLR"/><small className="muted">2–5 ký tự chữ không dấu hoặc số, dùng làm tiền tố mã định danh.</small></Field><div className="form-hint">Mã nhóm/loại tự tạo được lưu trên trình duyệt này. Sau khi thêm, dùng nút xuất để cập nhật danh mục vào tài liệu Quy ước chuẩn.</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button type="button" className="primary-btn" onClick={()=>{if(onAddCategory(activeGroupName,newCategoryName,newCategoryCode,addingToExistingGroup)){set('category',newCategoryName.trim());setNewGroupName('');setSelectedCustomGroup('');setNewCategoryName('');setNewCategoryCode('');setShowAddCategory(false)}}}>Lưu danh mục và chọn loại</button><button type="button" className="soft-btn" onClick={onExportConvention}><Download size={15}/> Xuất file Quy ước mã</button><button type="button" className="soft-btn" onClick={()=>setShowAddCategory(false)}>Hủy</button></div></div>}{!isNew&&<small className="muted">Loại thiết bị đã khóa sau khi cấp mã để tránh mã định danh không còn đúng loại.</small>}</Field>
    {showCategoryWarning&&<div className="form-hint warning-hint">Theo tên thiết bị, hệ thống gợi ý nhóm “{suggestedCategory}”. Nhóm hiện tại là “{v.category||'chưa chọn'}”. Hãy kiểm tra và chọn nhóm phù hợp; hệ thống không tự đổi nhóm hay mã định danh.</div>}
    <Field label="Vị trí lắp đặt"><input value={v.location} placeholder="Ví dụ: Nhà xưởng A" onChange={e=>set('location',e.target.value)}/></Field>
    <Field label="Hãng"><input value={v.brand} onChange={e=>set('brand',e.target.value)}/></Field><Field label="Model"><input value={v.model} onChange={e=>set('model',e.target.value)}/></Field>
    <Field label="Serial"><input value={v.serial} onChange={e=>set('serial',e.target.value)}/></Field><Field label="Ngày đưa vào sử dụng"><input type="date" value={v.commissionedAt} onChange={e=>set('commissionedAt',e.target.value)}/></Field>
    <Field label="Công suất / thông số"><input value={v.power} onChange={e=>set('power',e.target.value)}/></Field><Field label="Chu kỳ Bảo trì – Checklist"><select value={v.cycle} onChange={e=>set('cycle',e.target.value)}><option value="">Chưa thiết lập</option>{CHECKLIST_FREQUENCIES.map(x=><option key={x} value={x}>{x}</option>)}{v.cycle&&!CHECKLIST_FREQUENCIES.includes(v.cycle as ChecklistFrequency)&&<option value={v.cycle}>{v.cycle} (giá trị cũ – cần cập nhật)</option>}</select><small className="muted">Admin thiết lập lịch Checklist định kỳ cho riêng thiết bị này.</small></Field>
    <Field label="Tình trạng thiết bị"><select value={v.status} onChange={e=>set('status',e.target.value)}>{['Đang hoạt động','Đang sửa chữa','Ngừng sử dụng','Thanh lý'].map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Ghi chú"><input value={v.notes} onChange={e=>set('notes',e.target.value)}/></Field>
    {isNew&&<div className="asset-transfer-option"><label><input type="checkbox" checked={!!v.transferredFromOtherFacility} onChange={e=>set('transferredFromOtherFacility',e.target.checked)}/> Thiết bị được chuyển từ cơ sở khác đến</label><small>Cơ sở tiếp nhận hiện tại: {RECEIVING_FACILITY_CODE}. Khi đánh dấu, hệ thống tự thêm đúng một dấu * vào cuối mã quản lý hiển thị.</small></div>}
    {isNew&&<div className="asset-code-preview"><span>MÃ ĐỊNH DANH DỰ KIẾN</span><strong>{previewCode||'— Chọn nhóm thiết bị để xem mã —'}</strong><small>Mã quản lý được cấp khi lưu. QR dùng ID nội bộ ổn định nên không đổi khi mã quản lý thay đổi.</small></div>}
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
function InventoryDetailModal({value,close,edit,readOnly=false}:any){
  const rows=[['Mã vật tư',value.code],['Mã số',value.partNumber],['Tên vật tư',value.name],['Nhóm',value.group],['Kích cỡ / quy cách',value.size],['Đơn vị tính',value.unit],['Số lượng tồn',String(value.quantity)+' '+value.unit],['Tồn tối thiểu',String(value.minQuantity)+' '+value.unit],['Vị trí lưu kho',value.location],['Nhà cung cấp',value.supplier],['Đơn giá tham khảo',Number(value.unitPrice||0).toLocaleString('vi-VN')+' VNĐ'],['Cập nhật lần cuối',value.updatedAt?new Date(value.updatedAt).toLocaleString('vi-VN'):'—']]
  const print=()=>{window.setTimeout(()=>window.print(),100)}
  return <Modal title="Chi tiết vật tư" close={close}><div className="asset-detail-grid">{rows.map(([label,val])=><div className="asset-detail-field" key={label}><small>{label}</small><b>{val||'—'}</b></div>)}</div><div className="asset-photo-actions"><button className="soft-btn" onClick={print}><Printer size={16}/> In chi tiết</button><button className="primary-btn" disabled={readOnly} title={readOnly?'Viewer chỉ có quyền xem':undefined} onClick={edit}>Sửa vật tư</button></div><div className="asset-print-sheet print-detail"><div className="asset-print-report"><h1 className="asset-print-form-title">BẢNG CHI TIẾT VẬT TƯ</h1><div className="asset-print-header"><div className="company-logo-placeholder"><span className="company-logo-mark">BT</span><span className="company-logo-wording"><strong>BAOTRI</strong><small>LOGO THỬ NGHIỆM</small></span></div></div><h2 className="asset-print-device-name">{value.name}</h2><table><tbody>{rows.map(([label,val])=><tr key={label}><th>{label}</th><td>{val||'—'}</td></tr>)}</tbody></table></div></div></Modal>
}
function TaskModal({value,assets,close,save}:any){
  const [v,setV]=useState<Task>(value); const set=(k:keyof Task,x:any)=>setV(p=>({...p,[k]:x}))
  return <Modal title="Công việc bảo dưỡng định kỳ" close={close}><form className="form-grid" onSubmit={e=>{e.preventDefault();if(!v.title||!v.assetId)return alert('Chọn thiết bị và nhập tên công việc');save(v)}}>
    <Field label="Thiết bị"><select value={v.assetId} onChange={e=>set('assetId',e.target.value)}><option value="">-- Chọn thiết bị --</option>{assets.map((a:Asset)=><option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}</select></Field>
    <Field label="Tên công việc"><input required value={v.title} onChange={e=>set('title',e.target.value)}/></Field>
    <Field label="Ngày đến hạn"><input type="date" value={v.dueDate} onChange={e=>set('dueDate',e.target.value)}/></Field><Field label="Chu kỳ"><select value={v.frequency} onChange={e=>set('frequency',e.target.value)}>{['Một lần','Hàng ngày','Hàng tuần','Hàng tháng','Hàng quý','6 tháng','Hàng năm'].map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Trạng thái"><select value={v.status} onChange={e=>set('status',e.target.value)}>{['Chờ thực hiện','Đang thực hiện','Hoàn thành','Quá hạn'].map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Các bước công việc (mỗi dòng một mục)"><textarea rows={4} value={v.checklist} onChange={e=>set('checklist',e.target.value)}/></Field>
    <Field label="Thông số ghi nhận"><textarea rows={3} placeholder="Ví dụ: Áp suất 7 bar; nhiệt độ dầu 82°C..." value={v.readings} onChange={e=>set('readings',e.target.value)}/></Field>
    <Field label="Ghi chú"><textarea rows={2} value={v.notes} onChange={e=>set('notes',e.target.value)}/></Field>
    <div className="modal-actions"><button type="button" className="soft-btn" onClick={close}>Hủy</button><button className="primary-btn"><Check size={16}/> Lưu công việc</button></div>
  </form></Modal>
}
function MaintenancePlanModal({value,assets,close,save}:{value:MaintenancePlan;assets:Asset[];close:()=>void;save:(plans:MaintenancePlan[])=>void}) {
  const [plan,setPlan]=useState<MaintenancePlan>(value)
  const isEditing=Boolean(value.assetId)
  const [selectedAssetIds,setSelectedAssetIds]=useState<string[]>(()=>value.assetId?[value.assetId]:assets.filter(asset=>!asset.archivedAt).map(asset=>asset.id))
  const [didInitializeAssetSelection,setDidInitializeAssetSelection]=useState(Boolean(value.assetId)||assets.some(asset=>!asset.archivedAt))
  useEffect(()=>{
    if(!didInitializeAssetSelection&&assets.some(asset=>!asset.archivedAt)){
      setSelectedAssetIds(assets.filter(asset=>!asset.archivedAt).map(asset=>asset.id))
      setDidInitializeAssetSelection(true)
    }
  },[assets,didInitializeAssetSelection])
  const set=(key:keyof MaintenancePlan,next:string)=>setPlan(current=>({...current,[key]:next}))
  const activeAssets=assets.filter(asset=>!asset.archivedAt)
  const selectableAssets=assets.filter(asset=>!asset.archivedAt||selectedAssetIds.includes(asset.id))
  const allActiveAssetsSelected=activeAssets.length>0&&activeAssets.every(asset=>selectedAssetIds.includes(asset.id))
  const changePeriod=(period:MaintenancePlanPeriod)=>{
    const range=maintenancePlanRange(period,plan.startDate||today())
    setPlan(current=>({...current,period,...range}))
  }
  return <Modal title="Kế hoạch bảo trì" close={close}>
    <form className="form-grid" onSubmit={event=>{
      event.preventDefault()
      if(selectedAssetIds.length===0||!plan.title.trim())return alert('Chọn ít nhất một thiết bị và nhập nội dung bảo trì.')
      if(plan.startDate>plan.endDate)return alert('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.')
      save(selectedAssetIds.map((assetId,index)=>({...plan,id:isEditing?plan.id:index===0?plan.id:uid(),assetId})))
    }}>
      <div className="plan-assets-field">
        <div className="plan-assets-heading"><strong>Thiết bị áp dụng *</strong>
          {!isEditing&&<label><input type="checkbox" checked={allActiveAssetsSelected} onChange={event=>setSelectedAssetIds(event.target.checked?activeAssets.map(asset=>asset.id):[])}/> Chọn tất cả thiết bị đang quản lý ({activeAssets.length})</label>}
        </div>
        <div className="plan-assets-list">
          {selectableAssets.map(asset=><label key={asset.id} className="plan-asset-option">
            <input type={isEditing?'radio':'checkbox'} name="maintenancePlanAsset" checked={selectedAssetIds.includes(asset.id)} onChange={event=>{
              if(isEditing){if(event.target.checked)setSelectedAssetIds([asset.id])}
              else setSelectedAssetIds(current=>event.target.checked?[...current,asset.id]:current.filter(id=>id!==asset.id))
            }}/>
            <span><b>{asset.code}</b><small>{asset.name}{asset.archivedAt?' · Đã lưu kho':''}</small></span>
          </label>)}
          {selectableAssets.length===0&&<p className="muted">Chưa có thiết bị đang quản lý.</p>}
        </div>
        <small>{isEditing?'Chọn thiết bị của hạng mục này.':'Kế hoạch sẽ tạo một hạng mục riêng cho từng thiết bị đã chọn. Mặc định đã chọn tất cả thiết bị đang quản lý.'}</small>
      </div>
      <Field label="Kỳ kế hoạch"><select value={plan.period} onChange={event=>changePeriod(event.target.value as MaintenancePlanPeriod)}>{(['Tuần','Tháng','Quý','Năm'] as MaintenancePlanPeriod[]).map(period=><option key={period}>{period}</option>)}</select></Field>
      <Field label="Ngày bắt đầu"><input required type="date" value={plan.startDate} onChange={event=>set('startDate',event.target.value)}/></Field>
      <Field label="Ngày kết thúc"><input required type="date" value={plan.endDate} onChange={event=>set('endDate',event.target.value)}/></Field>
      <Field label="Nội dung bảo trì"><input required value={plan.title} onChange={event=>set('title',event.target.value)} placeholder="Ví dụ: Bảo dưỡng cụm máy nén khí"/></Field>
      <Field label="Hình thức thực hiện"><select value={plan.execution} onChange={event=>set('execution',event.target.value)}><option>Nội bộ</option><option>Thuê ngoài</option></select></Field>
      {plan.execution==='Thuê ngoài'&&<Field label="Đơn vị thuê ngoài (nếu có)"><input value={plan.contractor} onChange={event=>set('contractor',event.target.value)} placeholder="Tên nhà cung cấp / đơn vị thực hiện"/></Field>}
      <Field label="Ghi chú"><textarea rows={3} value={plan.notes} onChange={event=>set('notes',event.target.value)} placeholder="Phạm vi công việc, yêu cầu hoặc lưu ý"/></Field>
      <div className="modal-actions"><button type="button" className="soft-btn" onClick={close}>Hủy</button><button type="submit" className="primary-btn">Lưu kế hoạch</button></div>
    </form>
  </Modal>
}
function ScanModal({close,assets,openAsset,expectedAssetId}:any){
  const [result,setResult]=useState('')
  useEffect(()=>{
    const scanner = new Html5QrcodeScanner('qr-reader',{fps:10,qrbox:{width:220,height:220}},false)
    scanner.render((text)=>{setResult(text);const payload=text.trim().startsWith('ASSET:')?text.trim().slice(6):text.trim();const found=assets.find((a:Asset)=>a.id===payload)||assets.find((a:Asset)=>a.code===payload);if(found){if(expectedAssetId && found.id!==expectedAssetId){setResult('Mã QR không đúng thiết bị của công việc Checklist này. Hãy quét đúng thiết bị.');return}scanner.clear().catch(()=>{});openAsset(found)}},()=>{})
    return ()=>{scanner.clear().catch(()=>{})}
  },[])
  return <Modal title="Quét mã QR thiết bị" close={close}><div id="qr-reader" className="qr-reader"/><p className="muted">Cho phép trình duyệt truy cập camera. Checklist chỉ được mở sau khi quét đúng QR của thiết bị.</p>{result&&<p>Kết quả: {result}</p>}</Modal>
}


export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [organizationContext, setOrganizationContext] = useState<{id:string;name:string;role:string}|null>(null)
  const [organizationError, setOrganizationError] = useState('')
  const [checkingOrganization, setCheckingOrganization] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setCheckingSession(false)
      return
    }
    let active = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) console.error('Không thể khôi phục phiên Supabase:', error.message)
      setSession(data.session)
      setCheckingSession(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setCheckingSession(false)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const authenticatedClient = supabase
  useEffect(() => {
    if (!authenticatedClient || !session) {
      setOrganizationContext(null)
      setOrganizationError('')
      setCheckingOrganization(false)
      return
    }
    let active = true
    setCheckingOrganization(true)
    setOrganizationContext(null)
    setOrganizationError('')
    const loadOrganization = async () => {
      const { data: membership, error: membershipError } = await authenticatedClient
        .from('organization_members')
        .select('organization_id,role')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .maybeSingle()
      if (membershipError) throw membershipError
      if (!membership) throw new Error('Tài khoản chưa có membership active trong tổ chức.')

      // organization_members.role là cột legacy chỉ có admin/user.
      // Vai trò thực tế (admin/technician/viewer) phải đọc từ role assignment.
      const { data: isAdmin, error: adminRoleError } = await authenticatedClient
        .rpc('has_org_role', { p_organization_id: membership.organization_id, p_role: 'admin' })
      if (adminRoleError) throw adminRoleError
      const { data: isViewerRole, error: viewerRoleError } = await authenticatedClient
        .rpc('has_org_role', { p_organization_id: membership.organization_id, p_role: 'viewer' })
      if (viewerRoleError) throw viewerRoleError
      const { data: isTechnician, error: technicianRoleError } = await authenticatedClient
        .rpc('has_org_role', { p_organization_id: membership.organization_id, p_role: 'technician' })
      if (technicianRoleError) throw technicianRoleError
      // Ưu tiên quyền thấp hơn khi không phải Admin để tránh vô tình cấp quyền ghi.
      const effectiveRole = isAdmin ? 'admin' : isViewerRole ? 'viewer' : isTechnician ? 'technician' : null
      if (!effectiveRole) throw new Error('Tài khoản chưa được gán vai trò hợp lệ trong tổ chức.')

      const { data: organization, error: organizationLoadError } = await authenticatedClient
        .from('organizations')
        .select('id,name,status')
        .eq('id', membership.organization_id)
        .eq('status', 'active')
        .single()
      if (organizationLoadError) throw organizationLoadError
      if (active) setOrganizationContext({id:organization.id,name:organization.name,role:effectiveRole})
    }
    loadOrganization().catch(error => {
      if (active) setOrganizationError(error instanceof Error ? error.message : String(error))
    }).finally(() => { if (active) setCheckingOrganization(false) })
    return () => { active = false }
  }, [authenticatedClient, session?.user.id])
  if (!authenticatedClient) return <AuthScreen client={null} />
  if (checkingSession) return <div className="auth-page"><div className="auth-card auth-loading">Đang kiểm tra phiên đăng nhập…</div></div>
  if (!session) return <AuthScreen client={authenticatedClient} />
  if (checkingOrganization) return <div className="auth-page"><div className="auth-card auth-loading">Đang kiểm tra tổ chức và quyền truy cập…</div></div>
  if (organizationError || !organizationContext) return <div className="auth-page"><div className="auth-card"><h1>Không thể mở dữ liệu tổ chức</h1><p className="auth-error">{organizationError || 'Tài khoản chưa được gắn với tổ chức hoạt động.'}</p><button className="auth-submit" onClick={() => { void authenticatedClient.auth.signOut() }}>Đăng xuất</button></div></div>
  const metadata = session.user.user_metadata
  const profile: EmployeeProfile = {
    fullName: typeof metadata.full_name === 'string' ? metadata.full_name : typeof metadata.name === 'string' ? metadata.name : '',
    phone: typeof metadata.phone === 'string' ? metadata.phone : '',
    dateOfBirth: typeof metadata.date_of_birth === 'string' ? metadata.date_of_birth : '',
    position: typeof metadata.position === 'string' ? metadata.position : ''
  }
  const userEmail = session.user.email ?? 'Tài khoản'
  const userName = profile.fullName.trim() || userEmail
  const onSaveProfile = async (value:EmployeeProfile) => {
    const { error } = await authenticatedClient.auth.updateUser({data:{
      full_name:value.fullName,
      phone:value.phone,
      date_of_birth:value.dateOfBirth,
      position:value.position
    }})
    if (error) throw error
  }

  return <AppWorkspace
    key={session.user.id}
    cloudClient={authenticatedClient}
    organizationId={organizationContext.id}
    organizationName={organizationContext.name}
    organizationRole={organizationContext.role}
    userName={userName}
    userEmail={userEmail}
    profile={profile}
    onSaveProfile={onSaveProfile}
    onSignOut={() => { void authenticatedClient.auth.signOut() }}
  />
}