# AUDIT KIẾN TRÚC GHI DỮ LIỆU CLOUD-FIRST – 19/11/2026

## Mục đích và phạm vi
Đối chiếu mã nguồn branch `main` sau quyết định Cloud-first: mọi ghi nghiệp vụ cần Cloud xác nhận trước; Local chính thức chỉ cập nhật sau xác nhận. Đây là audit đọc mã, không phải runtime test. Không sửa code, SQL/migration, RPC, cấu hình Supabase hoặc dữ liệu.

Đã xem: `src/App.tsx` (các handler ghi và checklist), `src/db.ts` (Dexie + helper queue), `src/lib/cloudSync.ts`, `src/lib/assetsCloud.ts`, `src/lib/assetEditLocks.ts`, `src/CloudAssetsPanel.tsx`, cùng tài liệu audit/draft hiện có trong repository.

## 1. Kết luận nhanh
**Code hiện tại chưa theo Cloud-first.** Nhiều luồng vẫn ghi Local/Dexie trước rồi tạo `syncQueue`; một số thao tác Asset đã gọi RPC Cloud nhưng vẫn commit snapshot Local + mutation trước RPC. Nếu RPC thất bại, Local giữ mutation pending và form/lease được giữ để retry. Đây là hành vi Local-first/hybrid đã có kiểm thử, không được thay đổi đột ngột hoặc xóa dữ liệu pending.

## 2. Các luồng ghi đã tìm thấy

### Asset / Thiết bị
- Thêm mới hoặc sửa Asset chưa liên kết Cloud: `saveAsset()` tính mã từ dữ liệu Local, ghi `db.assets` và `syncQueue` trong Dexie transaction; đóng form/báo thành công ngay. Không gọi Cloud ở handler này.
- Sửa Asset đã linked Cloud: `saveAsset()` ghi candidate vào `db.assets` và thêm `assetMutations` (pending) trước; sau đó gọi `apply_asset_mutation_with_lock`. Receipt thành công mới cập nhật mutation/link metadata, đóng form và release lease. Khi RPC error/timeout, snapshot Local và mutation pending được giữ lại, form/lease tiếp tục để retry.
- Lưu kho, khôi phục, đổi trạng thái: các handler ghi qua `putAndQueue(db.assets,...)`; linked Asset bị chặn ở helper Cloud-link gate hiện có và chưa có đường Cloud-first hoàn chỉnh cho các thao tác này.
- Tạo Asset Cloud qua `createCloudAsset()` / RPC `create_asset_with_code` có trong repository nhưng không được gọi từ handler tạo Asset thông thường trong `App.tsx`. RPC allocator tự cấp mã; phải review idempotency trước khi dùng trong Cloud-first.

### Vật tư và giao dịch kho
- `saveItem()`: `putAndQueue(db.inventory,...)`, Local commit trước, queue sau; metadata hồ sơ vật tư được lưu, quantity được giữ theo tồn hiện có.
- `addMovement()`: transaction Local ghi cập nhật quantity trên Inventory + Movement history + hai queue entries; success message hiện sau Local commit. Nhập/Xuất là giao dịch ghép bắt buộc phải Cloud-atomic để không lệch tồn và lịch sử.
- Xóa/ghi movement hoặc điều chỉnh tồn phải được review cùng các handlers hiện tại; không cho cập nhật quantity độc lập khi chuyển kiến trúc.

### Công việc, kế hoạch, phiếu và Checklist
- `saveTask()`: Local put + queue.
- `completeTask()`: Local transaction cập nhật Task hoàn thành và tạo Log đạt, cùng queue cho hai records; Cloud-first cần giao dịch backend nguyên tử cho Task + Log.
- `saveMaintenancePlans()`: bulkPut Local + queue cho các kế hoạch.
- `deleteMaintenancePlan()`: Local delete + queue.
- `saveLog()`: Local put + queue; có logic giữ lịch sử khi đổi kết quả hoàn thành.
- `ensureDefaultChecklist()`: tự tạo Template + Version trong Local transaction và queue khi người dùng mở Checklist (nếu chưa có). Đây là ghi nghiệp vụ tự động, không chỉ nút Save; cần chuyển sang online/Cloud-confirmed và tránh tạo trùng.
- `saveTemplate()`: Local put Template + add Version + queue trong transaction.
- `saveResult()`: dùng `addAndQueue` cho Checklist result.
- Tạo Phiếu YC từ Checklist chỉ dựng draft trong UI trước khi người dùng lưu Log; draft UI không phải record chính thức.

### Khôi phục backup / import / restore
- Khôi phục backup là thao tác ghi nhiều bảng Local trong transaction; có preflight bảo vệ Asset Cloud-linked và mutation unresolved. Đây là chức năng phục hồi Local, cần quyết định rõ có giữ như thao tác quản trị Local độc lập hay cần quy trình import Cloud; không mặc định coi backup restore là giao dịch Cloud business thông thường.
- Nhận một Asset Cloud về Local là luồng restore/import có chọn lọc: đọc Cloud row trước, preflight collision, sau đó ghi Asset + link trong Local transaction. Cần phân biệt restore cache/snapshot với nghiệp vụ tạo/sửa dữ liệu Cloud; không dùng thao tác này để ghi ngược Cloud.

## 3. Cơ chế nền hiện tại
- `src/db.ts`: `putAndQueue`, `addAndQueue`, `deleteAndQueue` thực hiện ghi Dexie và queue trong cùng Local transaction. Queue là cơ chế Local-first.
- `src/lib/cloudSync.ts`: protocol JSON cũ push queue/pull records từ bảng `maintenance_records`. Search toàn repository cho `syncLocalDatabase` cho thấy chỉ định nghĩa trong module này, chưa thấy caller trong app; không coi đây là sync worker đang hoạt động hoặc nền tảng cho Cloud-first.
- `navigator.onLine` được dùng ở một số nơi (ví dụ lease heartbeat và CloudAssetsPanel), không có gate chung cho mọi nút ghi. Online browser state không chứng minh Supabase/Auth/RPC hoạt động.
- `src/lib/assetEditLocks.ts`: Asset Edit Lease RPC và Mutation Receipt RPC đã có; receipt hỗ trợ idempotent recovery. Edit Lease vẫn được giữ theo quyết định; Cloud-first không thay thế khóa.
- UI permission helper `blockViewer` là chặn quyền theo role, không phải kiểm tra connectivity hay xác nhận Cloud write.
- `assetCloudLinks` và `assetMutations` là cấu trúc hiện có cho vertical slice Asset. Các mutation pending/processing/conflict phải được reconcile trước khi chuyển hoặc bỏ Local-first.

## 4. Khoảng trống/rủi ro cần xử lý
1. Không có một online/Cloud readiness gate thống nhất cho toàn bộ ghi nghiệp vụ.
2. Các handlers Local-first hiển thị success trước Cloud; queue hiện không được app sync worker xử lý theo protocol đã rà soát.
3. Các nghiệp vụ nhiều record cần RPC/backend transaction: nhập/xuất vật tư (quantity + movement), hoàn thành Task (Task + Log), Checklist template + version, và những thay đổi status/archive/restore.
4. Cần idempotency/receipt cho mọi request có thể retry; đặc biệt response mất sau commit. Tránh tạo duplicate Movement, Log, Checklist version hoặc Plan.
5. Asset create cần code allocator/unique validation/idempotency; RPC allocator hiện có nhưng chưa tích hợp handler tạo mới.
6. Cần reconcile records Local-only, queue và mutations đang có trước khi rollout. Không xóa queue/pending hoặc reset Local như cách chuyển đổi.
7. Draft form chỉ giữ trong UI khi chưa commit; xác định UX khi Cloud xác nhận thất bại (giữ draft cho sửa/retry hay bỏ) và khi outcome không rõ (reconcile receipt/read Cloud trước).
8. Backup restore, cấu hình cục bộ, export/report và các thao tác chỉ đọc cần phân loại riêng, không vô tình bị chặn hoặc gửi Cloud như ghi nghiệp vụ.

## 5. Lộ trình đề xuất (chưa triển khai)
**Bước A – Inventory & quyết định phạm vi:** phân loại từng action thành read, business write, local setting, export, restore/import; xác định transaction boundary và kết quả UI.

**Bước B – Shared Cloud write contract:** thiết kế API/RPC trả canonical record/receipt; validate Auth, organization, permission, version/lock; idempotency key; quy tắc lỗi rõ/uncertain; connectivity UI gate chỉ là UX.

**Bước C – Asset vertical slice:** thiết kế Cloud-first create/edit/status/archive/restore, code allocator, Edit Lease cho sửa, receipt/idempotency; form draft không ghi Dexie; sau Cloud commit mới Local transaction cập nhật Asset + mapping. Reconcile pending mutations/Local-only Asset trước rollout.

**Bước D – Inventory vertical slice:** Cloud transaction cập nhật Item và Movement cùng quantity; chống duplicate idempotency; Local cập nhật sau receipt.

**Bước E – Task/Plan/Log/Checklist:** xây endpoint/RPC và transaction boundaries; đặc biệt Task completion + Log, Checklist Template + Version, Checklist Result, Plan batch/delete.

**Bước F – Offline gate, recovery, test:** shared status UI + disable/block write; test offline, auth expired, permission denied, server validation, network dropped before/after commit, retry/replay, concurrent clients, Local DB failure after Cloud success, reload/recovery. Không bật/rollout cho đến khi reconcile và test.

## 6. Trạng thái audit
- [x] Đã đọc các handlers ghi chính trong `src/App.tsx`, helper Dexie queue và Cloud modules trên `main`.
- [x] Đã xác định code hiện tại vẫn Local-first/hybrid, chưa áp dụng quyết định Cloud-first.
- [x] Đã lập danh sách các vertical slices và transaction cần chuyển.
- [ ] Chưa audit hết mọi action UI/setting/restore; danh sách write sites là audit ban đầu, cần rà soát bổ sung trước triển khai.
- [ ] Chưa sửa code/SQL/migration/RPC, chưa thao tác dữ liệu Local/Cloud và chưa runtime test trong đợt audit này.


## 7. Rà soát bổ sung: dữ liệu mẫu, backup, Checklist tự tạo và cấu hình (19/11/2026)

- Tạo bộ dữ liệu mẫu 30 Asset + 30 Inventory và tạo thêm 15 Asset demo: thao tác chỉ ghi Local và queue, có thông báo rõ chưa đồng bộ Cloud. Đây là công cụ phục vụ test; phải phân loại riêng, không được cho chạy trong tenant dữ liệu thật hoặc tự đưa dữ liệu demo lên Cloud.
- `ensureDefaultChecklist(asset)` tự ghi Template + Version khi mở Checklist và chưa có template. Đây là side-effect khi mở màn hình, cần chuyển thành Cloud-first/idempotent hoặc chỉ tạo draft cho đến khi user chủ động lưu; không nên tự tạo chính thức chỉ vì xem màn hình.
- Backup JSON là đọc dữ liệu Local và export file; không phải business write. Restore backup thay toàn bộ dữ liệu Local trong Dexie transaction, có preflight bảo vệ Asset linked và mutation unresolved; phải giữ như luồng phục hồi Local có cảnh báo, và đánh giá bảo vệ các pending queue/Cloud mapping. Không tự coi restore là upload Cloud.
- Một số cấu hình UI (theme, danh mục/vị trí kho, custom categories) lưu localStorage; cần phân loại theo cấu hình cá nhân/device hay cấu hình organization dùng chung. Chỉ cấu hình organization cần Cloud persistence; không chặn cài đặt giao diện cá nhân khi offline.
- CloudAssetsPanel có thao tác lưu cấu hình mã Asset trên Cloud (organization_settings) và import/restore Asset Cloud → Local. Đây không phải luồng tạo/sửa Asset nghiệp vụ thông thường; cấu hình phải có Cloud confirmation và import phải giữ semantics restore/cache, không ghi Cloud.
- Export Excel/backup/print là read/export, không phải mutation Cloud. Chúng có thể hoạt động offline nếu nguồn Local đủ dữ liệu và UI ghi rõ phạm vi snapshot.

### Phân loại tạm
- Business writes: mọi tạo/sửa/xóa/status, giao dịch tồn kho, Task completion, Logs, Checklist Template/Version/Result, Plans; cần Cloud-first.
- Local-only settings: theme, tùy chọn hiển thị/cá nhân; offline vẫn được.
- Organization settings: cấu hình mã thiết bị, danh mục được chia sẻ; Cloud-first, có quyền, trả confirmation.
- Read/export: xem, lọc, in, Excel, backup; cho phép offline theo dữ liệu đã tải.
- Restore/import: quy trình riêng, xác nhận và preflight; không mặc định Cloud mutation.
- Demo/test utilities: Local-only và phải tách khỏi dữ liệu thật; không auto-sync.

## 8. Audit bổ sung – trạng thái
- [x] Phân loại sơ bộ dữ liệu mẫu, Checklist auto-create, backup/restore, local settings, Cloud settings, import/restore và export.
- [ ] Chưa rà soát từng component/modal, các nút delete trên tất cả phân hệ và permission matrix để bảo đảm danh sách write site không bỏ sót.
- [ ] Chưa thiết kế hay triển khai Cloud-first APIs/RPC; chưa chạy test.

## 9. Rà soát write sites trong AppWorkspace, Checklist, quản lý thành viên và CloudAssetsPanel (19/11/2026)

### 9.1 Write sites trong App.tsx đã đối chiếu
- `saveAsset()`: Asset linked ghi Local snapshot + AssetMutation trước RPC; Asset chưa linked ghi Local + queue. Chưa Cloud-first.
- `saveItem()`, `saveTask()`, `saveLog()`: Local put + queue.
- `saveMaintenancePlans()`: bulkPut Local + queue; `deleteMaintenancePlan()` xóa Local + queue.
- `completeTask()`: ghi Task completed + Log mới + queue trong một Dexie transaction; cần Cloud RPC atomic.
- `archiveAsset()`, `restoreAsset()`, `changeAssetStatus()`: linked Asset bị chặn bởi `blockCloudLinkedAssetMutation()` vì chưa có receipt protocol cho các hành động này; Asset chưa linked vẫn putAndQueue Local.
- `addMovement()`: cập nhật quantity + thêm Movement + queue trong Dexie transaction; cần Cloud transaction atomic/idempotent.
- `ensureDefaultChecklist()`: tự tạo Template + Version + queue khi mở Checklist nếu chưa có. Đây là side-effect khi xem màn hình; cần loại bỏ auto-commit và chỉ tạo sau hành động chủ động/Cloud-first.
- `saveTemplate()`: Template put + Version add + queue trong Dexie transaction.
- `saveResult()`: addAndQueue ChecklistResult.
- `createRequestFromChecklist()`: chỉ dựng Log draft trong UI, chưa ghi DB cho đến khi người dùng lưu.
- `createDemoData()` và `createAdditionalDemoAssets()`: Local-only demo data + queue; giữ riêng công cụ test, tuyệt đối không tự đưa dữ liệu demo vào tenant Cloud.
- Restore backup (`applyRestore()`) thay toàn bộ các bảng Local và syncQueue trong Dexie transaction. Đây là local recovery/import, không được tự chuyển thành business Cloud write; cần preflight/reconciliation riêng.
- Backup/Excel/print/report là read/export; không cần Cloud write. Có thể cho offline nếu dữ liệu Local có sẵn và ghi rõ đó là snapshot Local.

### 9.2 Quản lý thành viên và hồ sơ
- Invite, update role, suspend/activate, remove membership, reset password gọi Edge Function `manage-organization-members`; đây là thao tác quản trị Cloud, đã chờ response trước khi cập nhật thông báo và tải lại danh sách. Không ghi Dexie/syncQueue.
- Cần tiếp tục xác minh permission enforcement phía Edge Function/RPC; UI role check không thay thế backend authorization.
- `onSaveProfile()` cập nhật Supabase Auth user metadata trực tiếp và await response; đây là hồ sơ Auth cá nhân, không phải dữ liệu bảo trì/tenant. Có thể giữ riêng, không buộc dùng business mutation queue.
- Theme/compact mode và một số danh mục UI dùng localStorage; phải phân loại rõ personal/device setting với organization-shared setting. Không khóa cài đặt cá nhân khi offline.

### 9.3 CloudAssetsPanel và cấu hình
- Lưu cấu hình mã Asset ghi `organization_settings` qua insert/update Supabase; đây là organization setting và phải giữ Cloud confirmation trước khi thông báo hoàn tất.
- Nhận Asset Cloud về Local chỉ đọc Cloud row, preflight UUID/code/mapping/mutation/queue rồi ghi Asset + `assetCloudLinks` trong một Dexie transaction. Đây là import/restore cache Cloud → Local, không phải Cloud business mutation; semantics hiện tại phải được giữ và audit tương thích với Cloud-first.
- Permission preflight hiện kiểm tra `assets.import` và `settings.manage` qua RPC `has_org_permission`; backend vẫn phải enforce quyền tại write/read endpoint.

### 9.4 Kết luận bổ sung
- Đã rà soát các write handlers cấp AppWorkspace, Checklist, thao tác thành viên, hồ sơ Auth và CloudAssetsPanel. Không thấy một handler xóa vĩnh viễn Asset/Inventory/Task/Log; thao tác xóa nghiệp vụ cụ thể được tìm thấy là xóa Maintenance Plan qua `deleteAndQueue`. Cần rà tiếp các modal con và các module khác để chắc chắn không bỏ sót thao tác xóa/ghi.
- Các thao tác local recovery, import Cloud → Local, demo/test, personal settings, organization settings, Auth profile và business writes phải được tách thành các nhóm khác nhau; không áp một Cloud write handler chung một cách máy móc.
- Đây vẫn là code audit; chưa runtime test, chưa thay đổi code/schema/RPC/dữ liệu.
- [x] Rà soát các write sites chính trong `src/App.tsx` và các hành động phụ.
- [x] Đối chiếu quản lý thành viên, Auth profile, `CloudAssetsPanel` và `assetsCloud.ts`.
- [ ] Chưa hoàn tất permission matrix cho từng role trên mọi component/modal.
- [ ] Chưa xác minh toàn bộ module phụ/child components và các hành động xóa trên mọi màn hình.


## 10. Đối chiếu phân quyền theo vai trò (19/11/2026)

### 10.1 Permission catalog hiện tại được giữ nguyên, không tự đổi chính sách
- Admin: quản lý toàn bộ nghiệp vụ và cấu hình theo permission catalog.
- Technician: xem; tạo/cập nhật Asset, Inventory, Movement, Task/Plan, Log; thực hiện Checklist và tạo kết quả; không có quyền xóa nghiệp vụ, quản lý template Checklist hoặc quản trị tổ chức.
- Viewer: chỉ xem, không được ghi nghiệp vụ.
- Đây là đối chiếu theo migration 005/006 và tài liệu CLOUD_PERMISSION_UI_MATRIX.md; chưa xác minh database nào đã áp dụng migration.

### 10.2 Sai lệch UI cần sửa trong phase riêng
- UI hiện chủ yếu dùng isViewer thay vì kiểm tra permission theo action. Do đó Technician có thể thấy/nhấn một số thao tác mà permission catalog không cấp.
- Technician có thể nhìn thấy luồng sửa/xóa Maintenance Plan; quyền hiện tại chỉ cấp maintenance.create/update, không cấp maintenance.delete.
- Technician có thể mở sửa Checklist template; quyền checklist.template.manage hiện chỉ cấp Admin. Việc tự tạo template/version mặc định khi mở Checklist cũng phải theo quyền Admin, không phải mọi user không phải Viewer.
- UI cần được chuyển sang permission-based gating; tuy nhiên đây chỉ là UX. RPC/RLS/Edge Function vẫn phải xác thực quyền ở server cho từng giao dịch.

### 10.3 Các ranh giới quyền cần giữ trong thiết kế Cloud transaction
- Asset: Admin/Technician create/update; Admin-only delete. Asset Edit Lease vẫn áp dụng cho sửa Asset theo quyết định đã chốt.
- Inventory: Admin/Technician create/update/adjust; Admin-only delete. Tạo vật tư, tồn đầu kỳ và Movement phải atomic theo policy; không cho direct insert làm lệch balance khỏi ledger.
- Task/Maintenance Plan: Admin/Technician create/update; Admin-only delete. Complete Task + tạo Maintenance Log là một Cloud transaction atomic.
- Checklist Template/Version: Admin-only manage. Checklist Result: Admin/Technician create, append-only; Viewer read-only.
- Maintenance Log/Request: Admin/Technician create theo permission hiện tại; giữ lịch sử append-only/revision model, không update/delete trực tiếp bản ghi lịch sử nếu schema/RLS không cho phép.
- Organization settings, members, roles: Admin-only; Edge Function/RPC phải enforce server-side.

### 10.4 Trạng thái
- Đã có tài liệu đối chiếu chi tiết CLOUD_PERMISSION_UI_MATRIX.md; audit này bổ sung các sai lệch quan trọng cho kế hoạch Cloud-first.
- Không thay đổi permission catalog, không cấp thêm quyền cho Technician, không thu hồi grant, không sửa UI/code/SQL.
- Cần hoàn tất kiểm tra mọi child component/modal và test từng RPC với permission allow/deny, bao gồm quyền bị thu hồi giữa phiên.


## 11. Rà soát bổ sung: demo, restore queue, Checklist và cấu hình Cloud (19/11/2026)

### 11.1 Dữ liệu demo không được dùng business sync queue
- `createDemoData()` tạo 30 Asset + 30 Inventory mẫu bằng Dexie bulkAdd, đồng thời gọi `queueChange()` cho từng bản ghi.
- `createAdditionalDemoAssets()` tạo thêm 15 Asset mẫu và cũng ghi `syncQueue`.
- UI thông báo rõ dữ liệu mẫu chỉ ở Local/chưa đồng bộ. Tuy nhiên việc đưa demo vào cùng `syncQueue` nghiệp vụ tạo nguy cơ bị đồng bộ nhầm nếu worker/đường sync được kích hoạt trong tương lai hoặc một cơ chế xử lý queue mới được bổ sung.
- Hướng xử lý: demo phải nằm trong chế độ/test dataset tách biệt hoặc không tạo business syncQueue; chặn tuyệt đối việc upload demo vào tenant Cloud. Không xóa queue cũ trước khi rà soát và phân loại các entry demo đã tồn tại.

### 11.2 Backup/restore và hàng đợi giao dịch
- Backup hiện export cả `syncQueue`; Restore thay thế toàn bộ các bảng Local và nạp lại `syncQueue` từ file.
- Restore hiện có preflight bảo vệ Asset Cloud-linked và chặn khi `assetMutations` còn pending/processing/conflict. Nhưng chưa thấy preflight tương đương cho các entry trong `syncQueue` hoặc mutation receipt/transaction chưa rõ kết quả của các vertical khác.
- Rủi ro hai chiều: restore có thể xóa queue hiện tại chưa xử lý; hoặc nạp lại queue cũ từ backup khiến mutation đã hoàn tất bị replay. Với Cloud-first, không được coi queue cũ trong backup là lệnh hợp lệ để ghi Cloud.
- Hướng xử lý: giữ restore là local recovery riêng; phân tích/hiển thị số lượng và trạng thái queue trước khi restore; không tự replay queue trong file backup. Cần reconciliation rõ ràng với mutation receipts và mapping Cloud trước khi thay thế/xóa queue. Không làm mất pending transaction hoặc biến backup thành cơ chế ghi ngược Cloud.

### 11.3 Checklist mặc định và permission
- `AssetChecklist` gọi `ensureDefaultChecklist()` trong `useEffect` khi `allowActions` đúng; điều kiện hiện tại chỉ loại Viewer, nên Technician cũng kích hoạt việc tạo Template + Version tự động khi mở màn hình.
- `ensureDefaultChecklist()` ghi hai bảng Local và queue; đây là side-effect nghiệp vụ phát sinh từ thao tác xem màn hình, không phải người dùng chủ động xác nhận lưu.
- Permission catalog hiện chỉ cấp `checklist.template.manage` cho Admin. Hướng xử lý: không tự tạo Template/Version khi mở màn hình; chuyển thành draft/preview và chỉ tạo chính thức sau thao tác chủ động, Cloud confirmation, permission Admin và idempotency. Checklist Result vẫn là giao dịch riêng Admin/Technician theo catalog.

### 11.4 Các đường Cloud setting và Auth
- `saveCloudAssetCodeConfig()` ghi `organization_settings.asset_code_config` qua PostgREST insert/update và chờ response. Đây là organization-shared setting, không phải Asset business mutation; phải giữ Cloud-first confirmation và server-side `settings.manage`.
- `onSaveProfile()` và `SetPasswordScreen` cập nhật Supabase Auth metadata/password, chờ response rồi mới cập nhật UI. Đây là hồ sơ/credential Auth cá nhân, không đưa vào business mutation queue.
- Theme, compact mode và device ID là thiết lập Local/cá nhân/thiết bị; tiếp tục cho phép offline.
- Cloud Asset import vẫn là Cloud read → Local restore/cache có chọn lọc; không được nhầm với thao tác tạo/sửa Asset Cloud.

### 11.5 Phạm vi và trạng thái
- Đã rà lại các write sites trong `App.tsx`, `AssetChecklist`, demo generation, backup/restore, `assetsCloud.ts`, `CloudAssetsPanel.tsx`, Auth profile/password và organization settings.
- Đây là static code audit trên nhánh `main`; chưa runtime test, chưa xác nhận trạng thái migration trên Supabase Project.
- Chưa sửa code, SQL/migration/RPC, dữ liệu Local/Cloud hoặc permission catalog.
- Các việc còn lại: rà mọi child/modal và permission gating; thiết kế xử lý queue/receipt cho restore; chốt transaction contract cho từng vertical; lập test allow/deny và retry/timeout trước khi triển khai.


## 12. Bản đồ transaction Cloud-first (bản thiết kế đề xuất, 19/11/2026)

Đây là transaction boundary đề xuất để review, chưa phải hợp đồng đã được phê duyệt và chưa triển khai.

### 12.1 Hợp đồng chung cho một business mutation
1. UI tạo một `mutation_id` ổn định cho một lần người dùng xác nhận; payload sau khi gửi phải bất biến.
2. Cloud RPC/Edge Function xác thực Auth, membership active, organization scope, permission theo đúng action, dữ liệu đầu vào và version/lease nếu có.
3. Cloud áp dụng thay đổi nghiệp vụ và ghi receipt/idempotency record trong cùng database transaction. Receipt cần gắn tối thiểu organization, mutation ID, actor, action/resource, payload fingerprint hoặc payload chuẩn hóa, kết quả canonical và thời điểm commit.
4. Retry cùng mutation ID + cùng payload trả lại kết quả đã commit; dùng lại ID với payload khác phải bị từ chối. Không cấp ID mới khi kết quả cũ chưa rõ.
5. Chỉ sau khi nhận kết quả Cloud đã commit (hoặc replay receipt xác nhận commit), Local mới ghi snapshot/mapping bằng một Dexie transaction. Nếu Local commit lỗi sau Cloud commit, phải phục hồi từ receipt/canonical snapshot, không gửi mutation mới.
6. Timeout/mất kết nối là trạng thái chưa rõ kết quả; truy vấn/replay cùng mutation ID để phân giải. Lỗi validation/permission/conflict có phản hồi rõ ràng là từ chối xác định, Local không đổi.
7. `navigator.onLine` chỉ hỗ trợ UX; RPC là nơi xác nhận Cloud thực sự sẵn sàng. Offline chỉ xem snapshot Local, không cho business write.

### 12.2 Transaction boundary theo nghiệp vụ

| Nhóm | Một Cloud transaction tối thiểu | Permission / ràng buộc |
|---|---|---|
| Asset tạo mới | Tạo Asset + cấp mã theo cấu hình organization + receipt; trả canonical Asset | `assets.create`; ID/mutation ổn định để retry; không Local-first |
| Asset sửa | Giữ Edit Lease; kiểm tra expected Cloud version; cập nhật Asset + receipt | `assets.update`; giữ lease độc quyền hiện có |
| Asset lưu kho/khôi phục/đổi trạng thái | Cập nhật trạng thái/archived_at + receipt; không ghi Local trước | `assets.update`; áp dụng lease/version policy thống nhất |
| Asset import Local → Cloud (nếu có) | Import giữ UUID + code + validate collision + receipt/audit | `assets.import` theo policy riêng; không dùng create allocator để tự đổi code |
| Inventory item | Tạo/cập nhật metadata; quantity không được tự đổi qua form sửa hồ sơ | `inventory.create/update`; Admin/Technician theo catalog |
| Inventory movement | Lock item; kiểm tra tồn; ghi movement + cập nhật quantity + receipt atomically | `inventory.adjust`; nhập/xuất/điều chỉnh phải có quy tắc dấu rõ ràng |
| Task | Tạo/cập nhật Task; xóa là action riêng Admin-only | `maintenance.create/update/delete` tương ứng |
| Hoàn thành Task | Cập nhật Task hoàn thành + tạo Maintenance Log + receipt trong cùng transaction | Admin/Technician; không thể có Task hoàn thành nhưng thiếu Log |
| Maintenance Plan | Lưu một kế hoạch hoặc batch kế hoạch như một đơn vị mutation đã xác định; xóa riêng | Create/update Admin/Technician; delete Admin-only |
| Checklist Template + Version | Tạo/cập nhật Template và thêm Version mới cùng transaction | `checklist.template.manage`, Admin-only |
| Checklist Result | Insert một kết quả append-only + receipt | `checklist.result.create`, Admin/Technician; không sửa/xóa lịch sử |
| Maintenance Log | Tạo Log root + revision đầu tiên; chỉnh sửa tạo revision mới, không overwrite lịch sử | `maintenance.create`; Admin/Technician; append-only |
| Organization setting | Cập nhật cấu hình organization + version/receipt hoặc kết quả xác nhận | `settings.manage`, Admin-only |
| Thành viên/tài khoản | Giữ Edge Function hiện có; server xác thực quyền và trả kết quả rõ ràng | Admin-only; Auth profile/password là luồng Auth riêng |

### 12.3 Những điểm không được gộp nhầm
- Asset Edit Lease là khóa độc quyền sửa Asset, không thay thế receipt/idempotency.
- Receipt hiện có trong `asset_mutation_receipts` được thiết kế riêng cho Asset update có lease; không mặc định đủ cho create, inventory, task, checklist hoặc log. Cần quyết định mở rộng thành receipt tổng quát hay receipt theo vertical.
- Import Cloud → Local, restore backup, demo/test data, export/print và personal settings không phải business mutation Cloud-first.
- Không dùng `syncQueue` Local-first làm nơi lưu các lệnh chờ upload sau khi chuyển kiến trúc; phải có kế hoạch phân loại và xử lý dữ liệu queue cũ trước khi bỏ helper/schema.
- Với Log/Checklist Result/Movement là lịch sử append-only, sửa nghiệp vụ phải tạo revision/event hoặc giao dịch bù có audit; không bật UPDATE/DELETE trực tiếp chỉ để UI dễ sửa.

### 12.4 Các quyết định còn cần chốt trước khi viết migration/RPC
- Receipt: một bảng tổng quát hay bảng riêng từng vertical; retention và cách tra cứu/replay.
- Version conflict: Asset đã có expected Cloud timestamp + lease; cần row_version cho Inventory/Task/Plan/Template/Organization settings hay cơ chế khóa tương đương.
- Inventory: xác định chính xác ý nghĩa “Điều chỉnh”, tồn đầu kỳ, kiểm kê tăng/giảm và giao dịch đảo.
- Log: duyệt mô hình Log root + append-only revisions; quy tắc sửa phiếu và quyền tạo revision.
- Batch Maintenance Plan: một batch all-or-nothing hay từng plan là mutation riêng.
- Local commit recovery: cách khôi phục snapshot khi Cloud đã commit nhưng IndexedDB lỗi; cách xử lý nhiều tab và Local DB version.
- Queue cũ: quy trình kiểm kê, quarantine, đối chiếu receipt và loại bỏ an toàn, không replay mù.

### 12.5 Trạng thái
- Đã đối chiếu sơ bộ với business schema migration 002, permission catalog 005/006, Asset lease/receipt migration 018/019, cùng các tài liệu thiết kế Inventory và Log revision.
- Đây là bản đồ transaction đề xuất để review; chưa phải quyết định cuối cùng.
- Chưa tạo migration/RPC, chưa sửa code, chưa chạy SQL và chưa kiểm thử runtime.


## 13. Chuẩn hóa Receipt và xử lý replay khi quyền thay đổi (19/11/2026)

### 13.1 Đối chiếu thiết kế đã có
Repository đã có tài liệu `CLOUD_RPC_IDEMPOTENCY_CHANGEFEED_DESIGN.md` đề xuất ledger chung `organization_mutations` với khóa `(organization_id, mutation_id)`, actor, operation, record, payload_hash, result_status/result_payload và thời điểm; ledger được ghi cùng transaction nghiệp vụ. Đồng thời có migration riêng `asset_mutation_receipts` cho Asset update có Edit Lease, lưu request_payload và result_snapshot.
- Không nên tạo thêm một receipt table mới cho từng vertical mà không có lý do rõ ràng; sẽ làm tăng số cơ chế replay và khó xử lý một mutation tác động nhiều record.
- Hướng thiết kế đề xuất: chuẩn hóa một hợp đồng idempotency dùng chung theo ledger `organization_mutations`; các RPC theo nghiệp vụ vẫn riêng, không tạo RPC ghi bảng tùy ý.
- Asset receipt hiện tại là triển khai chuyên biệt đã có migration/test; chưa được tự xóa hoặc bỏ. Trước khi bật Cloud-first toàn hệ thống, cần chọn một phương án migration có kiểm soát: (A) chuyển dữ liệu/contract sang ledger chung và cập nhật Asset RPC/test trong cùng phase; hoặc (B) giữ Asset receipt như adapter tạm thời, còn các vertical mới dùng ledger chung, với kế hoạch hợp nhất rõ ràng. Không dual-write hai receipt độc lập nếu không có transaction invariant và quy tắc recovery.
- Ledger chung phải hỗ trợ một mutation tác động nhiều record: ví dụ complete Task + insert Log. Một receipt phải trả được snapshot/kết quả của tất cả record đã commit, còn change feed phát event riêng cho từng record.

### 13.2 Payload fingerprint và dữ liệu lưu
- Fingerprint phải được tính ở server trên request đã chuẩn hóa, bao gồm organization, operation, resource IDs, expected version(s), và payload nghiệp vụ; không tin hash do client gửi.
- Repository chưa khai báo pgcrypto và chưa xác minh extension runtime. Không viết migration phụ thuộc `digest()` cho đến khi xác minh Test.
- Trong giai đoạn chưa xác minh hash, có thể giữ canonical request JSON có giới hạn kích thước và so sánh chính xác khi replay; phải tránh lưu trường nhạy cảm không cần thiết. Đây là phương án cần review bảo mật/retention trước khi chốt.
- Receipt result cần giữ canonical response đủ để Local phục hồi sau Cloud commit; với multi-record mutation, response phải chứa toàn bộ snapshot/version liên quan. Không chỉ lưu boolean applied.
- Key reuse với actor/operation/resource/version/payload khác phải bị từ chối; cùng key và cùng request phải trả đúng kết quả đã commit, không chạy lại business effect.

### 13.3 Điểm cần sửa trong Asset receipt hiện tại
Static review migration `20261118000300_asset_mutation_receipts.sql` cho thấy `apply_asset_mutation_with_lock` kiểm tra `assets.update` trước khi tra receipt replay.
- Tình huống: mutation đã commit, response bị mất; sau đó quyền update bị thu hồi; retry cùng mutation ID sẽ bị permission check chặn trước khi server xác nhận receipt.
- Cần phân biệt đường **replay/read-only receipt** với đường **thực thi mutation mới**. Replay không được thực hiện write lần hai, nhưng cũng không được bỏ qua kiểm tra Auth và ranh giới tổ chức.
- Thiết kế cần chốt: nếu cùng actor vẫn là thành viên active và chỉ permission update bị thu hồi, có thể cho phép tra trạng thái/kết quả đã commit mà không cấp quyền mutation mới; nếu membership bị thu hồi hoặc tổ chức không còn quyền truy cập, chỉ trả trạng thái tối thiểu không tiết lộ snapshot, hoặc yêu cầu Admin/actor có quyền đọc xác minh qua luồng an toàn. Không tự chọn một chính sách bỏ qua mọi authorization.
- Kiểm thử bắt buộc: commit → giả lập mất response → thu hồi permission → replay cùng ID; đồng thời kiểm thử actor khác, organization khác, membership inactive và key/payload mismatch.
- Đây là phát hiện thiết kế từ static code review; chưa chứng minh có lỗi runtime trên database.

### 13.4 Row version và transaction identity
- Draft `015_row_version_foundation_DRAFT.sql` đã bao phủ các bảng mutable: assets, inventory_items, maintenance_tasks, maintenance_plans, checklist_templates và organization_settings. Bảng append-only không cần row_version update.
- Draft row_version vẫn chưa được đưa vào migrations và chưa có bằng chứng đã áp dụng. Không lấy timestamp `updated_at` làm version chung cho các vertical mới.
- Asset hiện dùng expected `updated_at` cùng Edit Lease; cần thiết kế chuyển tiếp sang row_version mà không làm hỏng receipt/lease hiện hữu.
- Với Inventory movement, expected_version là version của item trước giao dịch; movement append-only có mutation ID riêng, balance + movement + receipt + change events cùng transaction.
- Với complete Task + Log, kiểm tra expected task version; một mutation ID duy nhất phải bao phủ cả task và log, và receipt phải trả cả hai kết quả.
- Checklist Result và Maintenance Log Revision là append-only; kiểm soát duplicate bằng UUID + mutation ledger/unique constraints, không thêm row_version để sửa lịch sử.

### 13.5 Kết luận đề xuất và trạng thái
- Đề xuất dùng một idempotency contract/ledger chung làm chuẩn toàn hệ thống, không thiết kế các receipt độc lập theo từng bảng; RPC vẫn tách theo nghiệp vụ.
- Asset receipt hiện hữu cần kế hoạch chuyển tiếp/hợp nhất, không xóa ngay.
- Replay phải là read-only confirmation có authorization phù hợp; không được mặc định permission hiện tại giống thời điểm commit.
- Đã đối chiếu `CLOUD_RPC_IDEMPOTENCY_CHANGEFEED_DESIGN.md`, `015_row_version_foundation_DRAFT.sql`, `CLOUD_SYNC_SCHEMA_PROTOCOL_DESIGN.md`, `CLOUD_INVENTORY_RPC_DESIGN.md`, `CLOUD_MAINTENANCE_LOG_REVISION_DESIGN.md` và migration Asset receipt.
- Chưa sửa SQL/RPC, chưa tạo migration, chưa chạy SQL hoặc runtime test; chưa xác minh pgcrypto hay migration state trên Supabase.


## 14. Đề xuất quy tắc nghiệp vụ Kho và Nhật ký (19/11/2026)

Trạng thái: phương án kỹ thuật/permission đề xuất để người dùng duyệt; chưa được coi là quyết định nghiệp vụ đã chốt.

### 14.1 Kho – phân biệt nhập/xuất và kiểm kê điều chỉnh
**Đề xuất:** thao tác “Điều chỉnh” nhập số tồn thực tế sau kiểm kê, không nhập một con số tăng/giảm tùy ý.
- Nhập: nhập lượng tăng thêm; balance mới = balance cũ + quantity.
- Xuất: xuất lượng giảm; balance mới = balance cũ - quantity; không cho tồn âm.
- Điều chỉnh: người dùng nhập `counted_quantity` (số tồn thực tế đếm được). Server khóa dòng vật tư, đọc balance hiện tại, tính `quantity_delta = counted_quantity - balance_before`, ghi balance mới bằng counted_quantity.
- Ví dụ: tồn hệ thống 12, kiểm kê thực tế 9 → delta -3; tồn mới 9. Tồn hệ thống 12, kiểm kê thực tế 15 → delta +3; tồn mới 15.
- Lưu movement với `balance_before`, `balance_after`, `counted_quantity` và `quantity_delta` có dấu. Trường `quantity` hiện tại đang CHECK > 0 nên không thể dùng nó một mình để thể hiện delta âm; cần migration bổ sung field có dấu hoặc cặp hướng + lượng tuyệt đối. Không đổi nghĩa cột cũ âm thầm.
- Bắt buộc lý do điều chỉnh; lưu actor, thời điểm, mutation ID và expected item version. Không tạo movement nếu không có chênh lệch, trừ khi người dùng muốn lưu cả biên bản kiểm kê không chênh lệch (khi đó nên có loại record kiểm kê riêng, không giả làm movement).
- Toàn bộ lock → kiểm tra version → tính delta → cập nhật balance/row_version → insert movement → receipt/change events phải cùng một DB transaction.
- Quyền: dùng quyền hiện tại `inventory.adjust` cho Admin/Technician; không tạo permission mới nếu phạm vi chỉ là Nhập/Xuất/Điều chỉnh như catalog mô tả. Xóa vật tư vẫn Admin-only.
- Khi tạo vật tư mới, `initial_quantity` là tồn đầu kỳ và tạo movement Nhập/Tồn đầu kỳ trong cùng transaction. Cần xác nhận Technician được phép tạo tồn đầu kỳ theo quyền `inventory.create` hiện tại; không tự mở rộng quyền ngoài catalog.

### 14.2 Nhật ký – phân biệt bản nháp và phiếu đã lưu
**Đề xuất an toàn mặc định:** sau khi Cloud đã xác nhận tạo Log, nội dung revision đã lưu là bất biến; mọi sửa đổi phải tạo revision mới, không UPDATE/DELETE revision cũ.
- Trước khi gửi Cloud: người tạo có thể sửa draft trong form; draft chưa phải Log chính thức và chưa ghi IndexedDB business tables.
- Sau khi Cloud commit: không sửa trực tiếp bản revision. Tạo revision mới với `expected_revision_no`, actor, thời gian, action và lý do sửa; mọi revision trước vẫn truy vấn được.
- Permission catalog hiện có `logs.create`, chưa có `logs.update` hoặc `logs.revise`. Không suy diễn rằng Technician có quyền sửa chỉ vì họ được tạo Log.
- Đề xuất mặc định ít quyền nhất: thêm permission riêng `logs.revise` và chỉ cấp cho Admin; Technician vẫn được tạo Log, nhưng muốn sửa phiếu đã lưu thì gửi yêu cầu Admin. Admin có thể tạo revision correction; không hard-delete Log. Hủy phiếu nếu cần cũng là revision/event riêng có lý do.
- Phương án thay thế cần người dùng duyệt: cấp `logs.revise.own` cho Technician để chỉ sửa Log do chính mình tạo, còn Admin sửa mọi Log. Nếu chọn phương án này cần lưu `created_by_user_id` bất biến trên Log root và server kiểm tra ownership; không dựa vào trường `performed_by`/tên hiển thị.
- Hoàn thành Task + tạo Log revision 1 tiếp tục là một transaction Cloud; nếu Log đã được tạo thì sửa sau này là mutation riêng, không được làm thay đổi lịch sử lần hoàn thành ban đầu.
- Không tự sửa permission catalog/migration cho đến khi người dùng chọn chính sách.

### 14.3 Các quyết định chờ duyệt
1. Điều chỉnh kho có đồng ý nhập **số tồn thực tế sau kiểm kê** và server tự tính delta không?
2. Nhật ký có đồng ý chính sách **Admin-only sửa phiếu đã lưu**, Technician chỉ tạo mới không? Hay cần Technician sửa phiếu do chính mình tạo?
3. Tồn đầu kỳ khi tạo vật tư: Technician có được phép nhập số tồn ban đầu theo `inventory.create` hay chỉ Admin?
4. Có cần lưu biên bản kiểm kê không chênh lệch (counted_quantity bằng balance hiện tại) không?

### 14.4 Trạng thái
- Đã đối chiếu business schema 002: movement.quantity hiện > 0; movement_type có Nhập/Xuất/Điều chỉnh; inventory_items.quantity không âm; permission catalog có inventory.adjust nhưng chưa có logs.update/revise.
- Đây là phương án đề xuất, chưa được người dùng phê duyệt.
- Chưa sửa permission catalog, schema/migration/RPC, UI hoặc dữ liệu; chưa chạy SQL/runtime test.


## 15. Quyết định nghiệp vụ Kho và Nhật ký đã được người dùng chốt (19/11/2026)

Người dùng xác nhận:
1. Điều chỉnh tồn kho = nhập số tồn thực tế sau kiểm kê (`actual`).
2. Chỉ Admin được sửa nhật ký đã lưu.
3. Technician được nhập tồn đầu kỳ khi tạo vật tư.
4. Không lưu biên bản kiểm kê nếu số đếm không chênh lệch.

### 15.1 Hệ quả thiết kế
- `adjust_inventory_count` nhận `counted_quantity >= 0`; server lock Item, so expected version, tính delta = counted - balance hiện tại. Delta = 0 trả no_change, không tạo movement/version/event. Delta khác 0 ghi balance và movement Điều chỉnh atomic; movement mới lưu counted_quantity, balance_before, balance_after, quantity_delta có dấu, reason bắt buộc. Giữ cột quantity hiện tại dương = abs(delta); không ghi số âm vào cột bị CHECK > 0.
- `create_inventory_item` cho Admin/Technician qua `inventory.create`; initial_quantity >= 0 là một phần của tạo vật tư. Nếu > 0, tạo opening movement Nhập/Tồn đầu kỳ cùng transaction; nếu = 0, không tạo movement giả.
- Nhập/Xuất tiếp tục qua `post_inventory_movement` với `inventory.adjust`; metadata update không được nhận quantity.
- Log sau Cloud commit là append-only revisions. Chỉ Admin có permission riêng `logs.revise`; Technician chỉ `logs.create`. Draft trước submit vẫn sửa được trong form và không ghi business IndexedDB.
- Task completion + Log revision 1 là một transaction Cloud; sửa Log sau đó là mutation riêng, revision mới + reason bắt buộc.
- Không hard-delete Log; không lưu kiểm kê không chênh lệch.

### 15.2 Công việc tiếp theo
1. Hoàn thiện schema movement có signed delta và tương thích legacy; không backfill balance lịch sử bằng suy đoán.
2. Thiết kế migration permission `logs.revise` Admin-only, giữ nguyên quyền Technician khác.
3. Hoàn thiện RPC input/output, expected_version/revision, shared Receipt và change events.
4. Thiết kế UI: tạo vật tư có tồn đầu kỳ; sửa metadata khóa quantity; form Điều chỉnh nhập tồn thực tế; Admin mới có nút sửa Log đã lưu.
5. Chỉ sau khi review thiết kế mới tạo SQL draft; không apply migration hoặc sửa code khi chưa có lệnh rõ.


## 16. Kế hoạch schema migration sau khi chốt quy tắc Kho/Log (19/11/2026)

- Đã đối chiếu business schema 002, permission seed 005, RLS/grants 006, Asset Receipt migration, row_version draft 015 và Local `Log` type.
- Inventory movement schema đề xuất thêm signed `quantity_delta`, balance_before/after, counted_quantity, actor, mutation_id, expected_item_version; các trường mới NULL với legacy rows. Giữ quantity hiện tại dương = abs(delta) cho movement mới; không backfill balance lịch sử.
- Log giữ root identity/FK hiện tại; thêm created_by_user_id nullable; tạo append-only maintenance_log_revisions với snapshot đầy đủ. Backfill revision 1 từ root; due_date/requested_by không có trong schema cũ nên NULL; không dựng lại actor/edit history.
- Permission `logs.revise` được seed riêng và chỉ gán Admin. Revisions chỉ SELECT theo logs.view; không direct writes. Thu hồi direct INSERT root Log chỉ trong cutover có create RPC sẵn sàng.
- Inventory RPC cutover thu hồi direct insert/update grants tương ứng khi RPC đã sẵn sàng; không làm mất khả năng nghiệp vụ trong giai đoạn triển khai.
- Migration phải tách foundation/Receipt, Inventory, Log, Change feed và client cutover; row_version draft 015 chưa được coi là applied.
- Kế hoạch chi tiết: `supabase/CLOUD_FIRST_SCHEMA_MIGRATION_PLAN.md`.
- Chưa tạo SQL migration executable, chưa sửa code, chưa apply SQL hoặc thay đổi dữ liệu/permissions.


## 17. SQL schema drafts đã tạo (19/11/2026)

- Đã tạo `supabase/drafts/018_inventory_movement_audit_fields_DRAFT.sql` và `supabase/drafts/019_maintenance_log_revisions_DRAFT.sql`.
- Draft 018 giữ nguyên `quantity > 0`, bổ sung signed delta/balance/count/actor/mutation/version; legacy data không backfill.
- Draft 019 giữ root Log ID/FK, tạo append-only revisions, backfill revision 1 dạng legacy_baseline, thêm permission logs.revise cho Admin role, RLS SELECT theo logs.view.
- Đã xác định RPC revise phải kiểm tra đồng thời has_org_role(org,'admin') và has_org_permission(org,'logs.revise') để custom role không thể tự được cấp quyền Admin-only.
- Hai draft chưa phải migration áp dụng; chưa chạy SQL, chưa thay đổi DB, grants trực tiếp hoặc UI.
\n\n## 18. Đối chiếu Local Movement fields với Cloud schema (19/11/2026)\n\n- Local Movement có `note` và `performedBy`; handler hiện gán `note` trùng `reason`, vì vậy Cloud không cần cột note trùng lặp.\n- Bổ sung đề xuất `performed_by_label` để giữ tên hiển thị snapshot; `created_by_user_id` mới là actor xác thực.\n- Chưa sửa UI/mapping; draft schema được cập nhật để có field label tùy chọn.\n

## 19. Review shared Receipt và row_version (19/11/2026)

- Đã làm rõ Receipt một mutation có thể bao gồm nhiều record; request fingerprint canonical do server dựng; claim concurrency qua unique (organization_id, mutation_id).
- Đã xác định Receipt/business write/version/change events cùng transaction; conflict/no_change có Receipt nhưng không event.
- Phát hiện Asset RPC kiểm tra permission ghi trước Receipt replay; cần sửa thiết kế replay. Đề xuất active membership + same actor, không yêu cầu write permission cho replay; snapshots phải theo read permission hiện tại. Chờ người dùng xác nhận.
- Draft row_version 015 trigger tăng theo từng SQL UPDATE; mỗi RPC phải update mỗi row đúng một lần. Asset chưa chuyển từ expected_cloud_updated_at/Lease.
- Chi tiết tại mục 8–12 của CLOUD_RPC_IDEMPOTENCY_CHANGEFEED_DESIGN.md. Chưa tạo shared-ledger SQL, chưa sửa draft 015, chưa chạy SQL.


## 20. Chốt chính sách replay shared Receipt (19/11/2026)

- Người dùng đã đồng ý: cùng actor có Auth hợp lệ + active membership + organization active được replay Receipt đã commit bằng cùng mutation ID/fingerprint mà không cần permission ghi cũ.
- Replay chỉ là xác nhận kết quả đã commit, không phải business write mới. Actor khác/cross-org bị deny; inactive membership hoặc organization inactive bị deny.
- Snapshot chỉ trả theo read permission hiện tại; nếu thiếu quyền đọc, trả acknowledgement tối thiểu, không lộ dữ liệu record.
- Chính sách này áp dụng cho thiết kế shared Receipt. Asset-specific Receipt/Lease và RPC hiện tại chưa bị thay đổi; cần migration riêng, không dual-write.
- Chưa sửa code/SQL/RPC, chưa thay đổi permission, dữ liệu Cloud/Local hoặc chạy test.


## 21. Shared Receipt SQL draft 020 (19/11/2026)

- Đã tạo `supabase/drafts/020_organization_mutations_receipt_DRAFT.sql` để review DDL bảng `organization_mutations` và cơ chế bảo vệ trạng thái Receipt.
- Bảng dùng một Receipt cho mỗi logical mutation, có thể mô tả nhiều affected records; lưu actor, operation, canonical fingerprint JSONB, read permission codes, affected refs, result payload và trạng thái `pending/applied/no_change/conflict`.
- Claim algorithm ưu tiên tra Receipt trước khi yêu cầu write permission: Receipt cũ cùng actor/fingerprint được replay read-only sau kiểm tra Auth + active organization + active membership; snapshot phụ thuộc toàn bộ read permission hiện tại. Chỉ mutation mới mới cần write permission và claim unique key.
- `pending` chỉ được tồn tại trong cùng transaction; deferred constraint trigger chặn commit chưa finalize. Trigger bảo vệ identity/fingerprint và chỉ cho phép finalize một lần.
- Không giả định pgcrypto, không dual-write với Asset Receipt, không sửa Asset RPC/Lease. DDL chưa được áp dụng; chưa tạo business RPC, chưa chạy SQL, chưa đổi dữ liệu/quyền hoặc code.


## 10. Rà soát lỗi thực tế và sửa an toàn (20/11/2026)

### 10.1 Ngày lịch theo múi giờ thiết bị
- Phát hiện `today()` trong `src/App.tsx` dùng `new Date().toISOString().slice(0, 10)`, tức ngày UTC. Với múi giờ Việt Nam, trong khoảng 00:00–06:59 giờ địa phương có thể trả về ngày hôm trước.
- Đã thay bằng `formatLocalDate()` trong `src/lib/dateUtils.ts`, định dạng theo local timezone của thiết bị.
- Đã thêm `tests/dateUtils.test.mjs` với hai ca hồi quy cho `Asia/Ho_Chi_Minh` và script `npm run test:date-utils`.
- Chưa chạy Node test/build trong môi trường thực thi của lượt audit; cần chạy khi có checkout Node đầy đủ.

### 10.2 Giao dịch nhập/xuất vật tư
- Phát hiện `addMovement()` kiểm tra số lượng xuất và tính tồn mới từ `item.quantity` lấy từ UI trước khi mở Dexie transaction. Nếu tab khác đã thay đổi tồn kho, dữ liệu UI cũ có thể làm ghi đè số tồn mới hoặc cho xuất vượt tồn thực tế.
- Đã chuyển việc đọc lại Inventory, kiểm tra số lượng xuất và tính tồn mới vào cùng read-write transaction chứa cập nhật Inventory, thêm Movement và queue hai thay đổi.
- Lỗi thiếu vật tư hoặc không đủ tồn hiện được báo rõ; transaction rollback giữ nguyên cả tồn kho và lịch sử khi thao tác không hợp lệ.
- Đây là gia cố tính nhất quán Local giữa các tab; chưa thay thế RPC atomic cần có khi triển khai Cloud-first.

### 10.3 Trạng thái xác minh
- [x] Sửa mã nguồn và kiểm tra lại nội dung file trên GitHub.
- [x] Thêm kiểm thử hồi quy ngày địa phương và script package.
- [ ] Chưa thực thi `npm run test:date-utils`, các test hiện có hoặc `npm run build`; không báo PASS runtime.
- [ ] Chưa thực hiện kiểm thử đồng thời nhiều tab/browser thật cho giao dịch tồn kho.


## 11. Ngăn khôi phục từ JSON không phải backup hợp lệ (20/11/2026)

- Phát hiện bộ đọc backup trước đây chỉ kiểm tra các trường bảng nếu chúng xuất hiện; file `{}` hoặc JSON thiếu toàn bộ bảng vẫn được chấp nhận. Khi xác nhận, `applyRestore()` sẽ clear các bảng Local rồi nạp mảng rỗng, có nguy cơ mất toàn bộ dữ liệu.
- Đã thêm `src/lib/backupValidation.ts` và yêu cầu đúng `backupVersion: 3`, `database: baotri-local-v1`, `exportedAt`, đầy đủ 10 mảng bảng, mọi record có `id` không rỗng, cùng `customAssetCategories` dạng mảng.
- Backup database hợp lệ nhưng rỗng vẫn được chấp nhận nếu cấu trúc v3 đầy đủ; chỉ chặn file thiếu cấu trúc/không đúng phiên bản.
- Đã thêm `tests/backupValidation.test.mjs`, script `npm run test:backup-validation`, và cập nhật README.
- Chưa chạy test/build runtime; cần xác minh trên Node trước khi coi là nghiệm thu.

- Bổ sung: trì hoãn thu hồi Blob URL của file backup 1 giây sau khi kích hoạt tải xuống, tránh thu hồi URL quá sớm khi trình duyệt chưa bắt đầu đọc Blob.


## 12. Backup snapshot nhất quán và CI tự động (20/11/2026)

- Phát hiện backup trước đây đọc từng bảng bằng các request riêng lẻ ngoài transaction; nếu dữ liệu thay đổi trong lúc sao lưu, JSON có thể ghép các trạng thái ở những thời điểm khác nhau.
- Đã chuyển toàn bộ 10 bảng Local vào một Dexie readonly transaction; snapshot chỉ được serialize sau khi transaction đọc hoàn tất. Có thêm xử lý lỗi sao lưu và thông báo trạng thái; không sửa dữ liệu nghiệp vụ.
- Đã thêm GitHub Actions workflow `.github/workflows/ci.yml`: Node.js 20, `npm ci`, chạy 5 nhóm regression tests, validate template release và `npm run build` trên push main, pull request vào main hoặc workflow_dispatch.
- Workflow vừa được tạo; cần chờ GitHub Actions thực thi và đọc kết quả thực tế. Không coi workflow tồn tại là bằng chứng build/test PASS.


## 13. Đồng thời sửa thông tin vật tư và nhập/xuất kho (20/11/2026)

- Phát hiện `saveItem()` đọc số tồn hiện tại trước transaction rồi mới ghi vật tư. Nếu một tab khác nhập/xuất kho sau lần đọc nhưng trước lần ghi, form sửa tên/đơn vị/nhà cung cấp có thể ghi đè số tồn mới bằng số cũ.
- Đã chuyển thao tác đọc bản ghi hiện tại, giữ nguyên `quantity`, áp dụng quyền cập nhật `minQuantity`, ghi metadata và queue vào cùng Dexie readwrite transaction.
- Luồng `addMovement()` trước đó đã được chuyển sang transaction; nay hai đường ghi có thể thay đổi hàng tồn đều đọc/ghi trong transaction, tránh stale overwrite giữa các tab.
- Đã xác minh nội dung commit trên GitHub; chưa có kiểm thử browser đa tab thực tế.

- Hoàn thiện thêm bộ kiểm tra backup: từ chối ID trùng trong cùng bảng để tránh `bulkPut()` âm thầm ghi đè một bản ghi khác khi nhập file bị lỗi hoặc chỉnh sửa thủ công; đã thêm ca regression tương ứng.


## 14. Chống ghi trùng khi thao tác Checklist và hoàn thành công việc (20/11/2026)

- `saveTemplate()` trước đây lấy `template.currentVersion` từ React state trước transaction. Hai tab có thể cùng dùng một phiên bản cũ, ghi trùng số phiên bản; trường hợp chưa có template còn có nguy cơ tạo hai template cho cùng Asset.
- Đã chuyển truy vấn template hiện tại theo `assetId`, xác định ID template và số phiên bản kế tiếp vào trong cùng Dexie readwrite transaction với việc ghi Template, Version và syncQueue. Số phiên bản hiển thị sau lưu lấy từ kết quả transaction.
- `completeTask()` trước đây dùng Task snapshot từ UI và luôn tạo Log mới. Hai tab hoặc thao tác lặp có thể tạo nhiều Log cho cùng một lần hoàn thành.
- Đã đọc lại Task trong transaction; nếu không tồn tại hoặc đã hoàn thành thì không tạo Log mới. Task, Log và queue vẫn commit nguyên tử trong cùng transaction.
- Đã thêm `tests/localConcurrencyContracts.test.mjs`, script `test:local-concurrency`, đưa vào GitHub Actions và README. Đây là kiểm tra source contract; cần CI build/test thực thi để xác nhận cú pháp và chưa thay thế kiểm thử browser đa tab.
- Không sửa Cloud/Production, schema, RPC hoặc dữ liệu hiện có.

- Bổ sung bảo vệ khi `currentVersion` không khớp lịch sử: trong transaction, `saveTemplate()` đọc các version đã lưu và lấy số lớn nhất giữa lịch sử với `currentVersion`, sau đó mới tăng phiên bản. Tránh tái sử dụng số phiên bản nếu metadata bị lệch.


## 15. Bảo toàn lịch sử Phiếu YC khi sửa đồng thời (20/11/2026)

- `saveLog()` trước đây đọc Log hiện tại bên ngoài transaction; khi tab khác vừa ghi nhận hoàn thành hoặc thêm `editHistory`, tab cũ có thể ghi đè lịch sử mới.
- Đã chuyển thao tác đọc Log, xác định chuyển trạng thái Hoàn thành → Chưa hoàn thành, hợp nhất `editHistory`, ghi Log và queue vào cùng Dexie readwrite transaction. Lịch sử đã lưu mới nhất được ưu tiên; chỉ dùng lịch sử từ form khi bản ghi chưa có lịch sử.
- Bổ sung kiểm tra source contract cho luồng này trong `tests/localConcurrencyContracts.test.mjs`, chạy cùng script `test:local-concurrency`.
- Chưa có kiểm thử browser đa tab thực tế và chưa có xác nhận CI; không tuyên bố test/build PASS.


## 16. Chặn ghi đè Task từ biểu mẫu cũ (20/11/2026)

- `saveTask()` trước đây ghi trực tiếp snapshot từ form. Nếu Task được hoàn thành hoặc sửa ở tab khác trong lúc form cũ vẫn mở, thao tác lưu từ form cũ có thể ghi đè trạng thái/nội dung mới.
- Đã chuyển đọc Task hiện tại, so sánh `updatedAt` của bản đang lưu với revision mở form, ghi Task và queue vào cùng transaction. Nếu revision đã thay đổi, từ chối ghi và yêu cầu người dùng mở lại biểu mẫu; không tự merge mù các trường nghiệp vụ.
- Bổ sung source contract test cho trường hợp stale revision trong `test:local-concurrency`.


## 17. Chặn ghi đè/xóa nhầm kế hoạch bảo trì từ snapshot cũ (20/11/2026)

- `saveMaintenancePlans()` trước đây `bulkPut()` trực tiếp các bản kế hoạch từ form; một form cũ có thể ghi đè bản cập nhật ở tab khác.
- Đã đọc các bản hiện tại trong cùng transaction, so sánh `updatedAt` với revision lúc mở form và từ chối toàn bộ batch nếu phát hiện xung đột; không ghi một phần batch.
- `deleteMaintenancePlan()` trước đây xóa theo ID mà không kiểm tra revision. Đã chuyển đọc, so sánh revision, xóa và tạo queue delete vào cùng transaction. Bản ghi đã đổi ở nơi khác sẽ không bị xóa bởi thao tác cũ.
- Bổ sung source contract tests cho cả save và delete trong `test:local-concurrency`.

- Bổ sung trường hợp bản kế hoạch đang sửa bị xóa ở tab khác: form cũ không được `bulkPut()` tạo lại bản ghi đã mất; thao tác bị báo xung đột. Các kế hoạch mới trong luồng tạo nhiều thiết bị vẫn được phép thêm.

- Bổ sung `Log.updatedAt` tùy chọn để kiểm soát revision. `saveLog()` từ chối lưu nếu timestamp của bản đang lưu khác snapshot lúc mở form, rồi mới hợp nhất lịch sử, ghi Log và queue trong transaction. Nhật ký mới tạo khi hoàn thành Task cũng được đóng dấu revision. Dữ liệu Log cũ không cần migration: `updatedAt` có thể để trống cho đến lần lưu đầu tiên.

## 14. Khôi phục backup: tách commit IndexedDB và lưu tùy chọn localStorage (20/11/2026)

- `applyRestore()` thay thế các bảng Local trong một Dexie transaction. Sau khi transaction hoàn tất, ứng dụng mới cập nhật `baotri-custom-asset-categories` trong `localStorage`.
- Trước sửa, nếu `localStorage.setItem()` lỗi sau khi Dexie transaction đã commit, catch chung hiển thị thông báo khôi phục thất bại dù dữ liệu database đã được thay thế thành công. Người dùng có thể hiểu nhầm và thử lại.
- Đã tách lỗi lưu danh mục tùy chọn khỏi kết quả transaction: đóng hộp thoại restore sau khi DB commit; nếu localStorage lỗi, vẫn báo khôi phục DB thành công kèm cảnh báo danh mục tùy chỉnh chưa lưu.
- Thay đổi không sửa schema, không đổi semantics thay thế backup, không thay đổi dữ liệu Cloud/Production.
- Bổ sung static regression contract vào `tests/localConcurrencyContracts.test.mjs`. Đây là kiểm tra cấu trúc mã nguồn; chưa phải runtime test hoặc mô phỏng quota/private-mode của trình duyệt.

## 15. Checklist editor optimistic concurrency (20/11/2026)

- Trình sửa Checklist chụp `updatedAt` của Template khi mở.
- Khi lưu, transaction đọc lại Template hiện tại theo `assetId` và so sánh `updatedAt` với mốc đã chụp.
- Nếu khác nhau (bao gồm trường hợp một tab khác vừa tạo Template trong lúc tab này đang mở), transaction trả `conflict`, không ghi Template/Version và không queue mutation. UI yêu cầu đóng trình sửa và mở lại dữ liệu mới nhất.
- Nếu không có thay đổi cạnh tranh, việc tính version tiếp theo, ghi Template, thêm Version và queue vẫn diễn ra trong cùng transaction.
- Bổ sung static regression contract. Chưa chạy Node test hoặc browser multi-tab runtime; chưa tuyên bố PASS.

## 16. Chống tạo trùng Phiếu YC từ cùng một Checklist không đạt (20/11/2026)

- `saveLog()` khi lưu phiếu có `checklistResultId` nay đọc phiếu Checklist nguồn trong cùng Dexie readwrite transaction.
- Từ chối lưu nếu phiếu nguồn không tồn tại hoặc `assetId` không khớp với phiếu sửa chữa.
- Tra cứu Log đã liên kết bằng index `logs.checklistResultId`; nếu một Log khác đã liên kết cùng kết quả Checklist thì từ chối ghi. Trường hợp đang sửa chính Log đã liên kết vẫn được phép.
- Kiểm tra nguồn, kiểm tra trùng, ghi Log và queue mutation nằm trong cùng transaction; ngăn hai tab tạo hai yêu cầu từ một kết quả Checklist.
- Không thêm schema/migration, tận dụng index đã có từ DB v4. Bổ sung static regression contract; chưa chạy runtime test hoặc multi-tab browser test.

## 17. Kiểm tra tính toàn vẹn liên kết Checklist trong backup (20/11/2026)

- `isValidBackupV3()` không chỉ kiểm tra ID từng bảng: nay còn xác thực chuỗi tham chiếu `ChecklistTemplate → Asset`, `ChecklistVersion → ChecklistTemplate/Asset`, `ChecklistResult → Asset/Template/Version`.
- Với Log có `checklistResultId`, backup chỉ hợp lệ khi kết quả Checklist nguồn tồn tại và thuộc cùng `assetId` với Log.
- Mục tiêu: từ chối backup hỏng/tham chiếu chéo trước khi mở bước khôi phục thay thế dữ liệu Local; không tự sửa hoặc bỏ qua lịch sử lỗi.
- Bổ sung test cho chuỗi tham chiếu hợp lệ, thiếu bản ghi và sai thiết bị. Chưa chạy test runtime; cần CI hoặc chạy `npm test` trên môi trường repo để xác nhận.

## 18. Rà soát thứ tự và khóa ngoại đồng bộ Checklist lên Cloud (20/11/2026)

- Đã đọc trực tiếp định nghĩa FK trên Supabase `BAOTRI-Mini-Test` (không thay đổi schema/dữ liệu): `checklist_templates` → `assets`; `checklist_template_versions` → `checklist_templates` cùng asset; `checklist_results` → Asset + Template + đúng Version (bao gồm `template_version`); `maintenance_logs` → Asset + Task tùy chọn + ChecklistResult tùy chọn. Các FK đều `ON DELETE RESTRICT`, dùng khóa ghép `organization_id` để không thể liên kết chéo tenant.
- `src/lib/syncMapping.ts` có `CLOUD_SYNC_ORDER` đúng thứ tự phụ thuộc: assets → checklist_templates → checklist_template_versions → checklist_results → maintenance_logs; Task cũng đứng trước Log. Bổ sung regression test kiểm tra các quan hệ thứ tự này.
- `src/lib/cloudSync.ts` là legacy worker không được kích hoạt. Mảng `DATA_COLLECTIONS` của file này hiện xếp `logs` trước `checklistResults`, không đáp ứng FK khi upload tuần tự; không sửa/kích hoạt file legacy theo nguyên tắc dự án. `src/App.tsx` hiện không import hoặc gọi worker này.
- Vì vậy không được bật worker legacy. Nếu sau này xây worker mới, phải dùng dependency order đã review, đồng bộ parent trước child, giữ pending khi parent chưa được xác nhận, và xử lý batch/transaction/idempotency phía server. `CLOUD_SYNC_ORDER` mới chỉ là thứ tự tham chiếu, chưa phải worker hoàn chỉnh.
- Đã xác minh constraint definitions bằng truy vấn chỉ đọc trên project Test; không chạy INSERT/UPDATE/DELETE, không sửa Production. Chưa chạy regression test runtime; CI chưa có status.

## 19. Liên kết Task/Checklist của Log phải cùng thiết bị (20/11/2026)

- Bổ sung bảo vệ Local trong `saveLog()`: nếu Log có `taskId`, đọc Task nguồn trong cùng Dexie readwrite transaction và từ chối lưu nếu Task không tồn tại hoặc `task.assetId !== log.assetId`. Kiểm tra ChecklistResult và chống tạo trùng vẫn cùng transaction. Regression contract được bổ sung.
- Phát hiện giới hạn ở tầng Cloud trên `BAOTRI-Mini-Test`: FK `maintenance_logs_task_asset_fk` hiện chỉ bảo đảm `(organization_id, task_id)` tồn tại, không bảo đảm Task cùng `asset_id` với Log. FK Checklist tương tự chỉ bảo đảm `(organization_id, checklist_result_id)` tồn tại, không buộc cùng thiết bị. Do đó một Log ghi sai `asset_id` nhưng trỏ Task/Checklist của thiết bị khác trong cùng tenant vẫn có thể vượt qua các FK hiện tại nếu đi qua đường ghi được cấp quyền.
- Thiết kế DB cần xem xét FK ghép `(organization_id, task_id, asset_id)` → `maintenance_tasks(organization_id, id, asset_id)` và `(organization_id, checklist_result_id, asset_id)` → `checklist_results(organization_id, id, asset_id)`. Muốn triển khai cần unique constraint tương ứng trên bảng cha và migration có kiểm tra dữ liệu hiện hữu. Chưa tạo/chạy migration, chưa sửa Test hay Production vì đây là thay đổi schema/bảo mật cần review riêng.
- Trạng thái hiện tại: Local save guard đã bổ sung; Cloud constraint gap vẫn là finding mở, không được coi là đã khắc phục. Test runtime/CI chưa được chạy.

### Bổ sung mức độ ảnh hưởng (đã kiểm tra quyền trên Test)

- `authenticated` hiện có quyền SQL `INSERT` trên `public.maintenance_logs`; RLS policy `maintenance_logs_insert_permission` cho phép INSERT khi `has_org_permission(organization_id, 'logs.create')` đúng. Vì vậy đây không chỉ là giả thuyết về service-role/RPC: một thành viên có quyền tạo Log có thể đi qua Data API trực tiếp, và các FK hiện tại chưa chặn liên kết Task/Checklist khác thiết bị trong cùng tenant.
- Xếp finding này là **Cloud integrity/security gap cần ưu tiên xử lý trước khi mở rộng quyền tạo Log Cloud**. Local guard không thay thế được kiểm tra ở DB. Không thử INSERT khai thác, không thay đổi grants/policies hay schema trong lượt này.


## 20. Rà soát đường ghi trực tiếp Log/Checklist trên Cloud (20/11/2026)

- Truy vấn chỉ đọc trên `BAOTRI-Mini-Test` xác nhận `authenticated` có SQL privilege `INSERT` trên `maintenance_logs` và `checklist_results`. RLS tương ứng chỉ kiểm tra `logs.create` hoặc `checklist.result.create` theo `organization_id`; không tự kiểm tra Asset/Task/Checklist reference cùng thiết bị.
- `maintenance_tasks` hiện cấp INSERT/UPDATE/DELETE cho `authenticated`, RLS kiểm tra lần lượt `maintenance.create/update/delete`. Checklist templates và versions có INSERT; template có UPDATE; kết quả Checklist và Log chỉ có INSERT/SELECT theo chính sách append-only.
- Không tìm thấy trigger nghiệp vụ trên `maintenance_logs`, `checklist_results` hoặc `maintenance_tasks`; chỉ có trigger cập nhật `updated_at` trên `maintenance_tasks` và `checklist_templates`. Truy vấn các hàm PostgreSQL thường trong schema public/app_private theo tên/nội dung liên quan Log/Task/Checklist không trả về RPC ghi nghiệp vụ phù hợp.
- Đối chiếu repository: `syncLocalDatabase()` chỉ được định nghĩa trong legacy `src/lib/cloudSync.ts`, không có caller runtime; README và audit hiện hành xác nhận module này không được bật. Inventory/Maintenance/Checklist hiện ghi Dexie + syncQueue; không tìm thấy Cloud writer runtime cho Log hoặc Checklist. `syncMapping.ts` chỉ là pure mapping, không gọi Supabase.
- Vì vậy quyền INSERT hiện hữu là bề mặt API có thể bị gọi trực tiếp bởi client authenticated đủ permission, nhưng không phải bằng chứng ứng dụng hiện đang đẩy Log/Checklist lên Cloud. Không được nhầm quyền DB với một luồng đồng bộ đang hoạt động.
- Truy vấn preflight dữ liệu hiện hữu trên Test cho kết quả: 0 Log có Task khác Asset; 0 Log có ChecklistResult khác Asset; 0 orphan Task/Checklist reference; 0 Task/Checklist thiếu Asset. Đây chỉ là ảnh chụp dữ liệu hiện tại, không đóng được lỗ hổng ghi mới.
- Không thay đổi grants/RLS/schema/dữ liệu; không gọi INSERT/UPDATE/DELETE hoặc RPC ghi. Chưa tạo migration vì cần triển khai đồng bộ RPC tạo Log/Checklist và thu hồi direct INSERT theo một cutover an toàn; không được revoke trước khi có đường ghi thay thế được test.
- Finding mở: bổ sung FK ghép để bảo đảm cùng Asset ở tầng DB; thiết kế RPC có kiểm tra active membership/permission, tenant boundary và idempotency; sau khi RPC được triển khai/test mới thu hồi direct INSERT phù hợp. Với Task CRUD, cần rà soát riêng quyền xóa và mô hình history trước khi mở worker.


## 21. Task delete và tính bất biến Checklist (20/11/2026)

- Trên `BAOTRI-Mini-Test`, `authenticated` có SQL DELETE trên `maintenance_tasks`, nhưng RLS chỉ cho phép khi `has_org_permission(organization_id, 'maintenance.delete')`. Kiểm tra role_permissions hiện chỉ thấy role built-in `admin` có quyền này; Technician không có. Đây là chủ ý phù hợp với permission catalog, không phải lỗ hổng Technician.
- FK `maintenance_logs_task_asset_fk` đang `ON DELETE RESTRICT`, nên Task đã được Log tham chiếu không thể xóa vật lý. Task không có Log tham chiếu vẫn có thể bị Admin xóa; cần xác định chính sách nghiệp vụ (xóa thật hay archive/tombstone) trước khi mở đồng bộ. Không tự thay đổi vì đây là quyết định vòng đời dữ liệu.
- Checklist Results và Template Versions: authenticated chỉ có SELECT/INSERT, không có UPDATE/DELETE privilege; RLS cũng không có policy UPDATE/DELETE. Đã xác nhận bằng `has_table_privilege`. Điều này phù hợp append-only cho lịch sử kết quả và snapshot phiên bản.
- Checklist Templates: authenticated có SELECT/INSERT/UPDATE theo `checklist.template.manage`, không có DELETE. Trigger duy nhất là set_updated_at; không có trigger kiểm tra current_version có trỏ tới version đã phát hành.
- Rủi ro thiết kế cần lưu ý trước khi có Cloud writer: `checklist_templates.current_version` là số nguyên header, chưa có FK/constraint bảo đảm tồn tại một dòng `checklist_template_versions` tương ứng. Một UPDATE template trực tiếp có quyền có thể đặt current_version sai; INSERT version và UPDATE header cũng không được DB buộc cùng một transaction. Trên Test hiện có 0 template nên không thể đánh giá dữ liệu thực tế; đây là gap cấu trúc, không phải phát hiện bản ghi sai.
- Hướng xử lý trước khi mở Cloud Checklist: RPC publish version trong một transaction, kiểm tra active membership + `checklist.template.manage`, serialize theo template row, cấp số version kế tiếp từ DB, insert immutable version rồi cập nhật current_version; thu hồi direct INSERT/UPDATE nếu RPC là đường ghi duy nhất. Cần kiểm thử concurrent publish và rollback. Không áp dụng thay đổi trong lượt này.
- Không chạy DML ghi, không thay đổi RLS/grants/schema/Production. Các kết quả ACL/policy/constraint là truy vấn chỉ đọc trên Test.
