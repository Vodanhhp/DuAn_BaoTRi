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
