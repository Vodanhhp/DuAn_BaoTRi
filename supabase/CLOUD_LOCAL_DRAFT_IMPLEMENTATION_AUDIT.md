# AUDIT TRIỂN KHAI BẢN NHÁP LOCAL / UUID CHÍNH THỨC – 18/11/2026

## Kết luận nhanh

Chưa thể bật ngay quy tắc “offline chỉ có bản nháp, online mới có UUID/mã chính thức” bằng cách đổi `emptyAsset()` và `emptyItem()`. Mã hiện tại chưa có Cloud pull/sync worker hoạt động; `navigator.onLine` (nếu dùng riêng) không chứng minh dữ liệu Cloud đã mới nhất. Nếu cấp mã sau khi chỉ thấy có Internet, PC và Mobile vẫn có thể đọc hai snapshot khác nhau.

Đợt này chỉ audit và chốt thứ tự triển khai. Không sửa luồng tạo dữ liệu, không migrate Dexie, không chạy SQL và không ghi Supabase.

## 1. Hiện trạng được xác minh trong mã nguồn

### Thiết bị
- `src/App.tsx`: `emptyAsset()` gọi `uid()` ngay khi mở form Thêm thiết bị, tức UUID hiện được tạo trước lúc người dùng bấm Lưu.
- `saveAsset()` hiện cấp mã quản lý tại Local bằng `buildAssetCode(a, allAssets, customAssetCategories)`; kiểm tra trùng trên toàn bộ bảng `db.assets` trong Dexie transaction.
- `saveAsset()` ghi Asset và gọi `queueChange('assets', saved.id)` trong cùng transaction `db.assets + db.syncQueue`.
- Vì vậy quy tắc hiện tại đang cấp cả UUID và mã quản lý ngay Local, không phụ thuộc Internet/Cloud.
- `AssetModal` hiển thị mã dự kiến và cho lưu thiết bị ngay cả khi chưa có xác nhận dữ liệu Cloud mới nhất.

### Vật tư
- `emptyItem()` cũng gọi `uid()` ngay khi mở form.
- Mã vật tư `code` hiện do người dùng nhập, không phải bộ cấp mã tự động như mã thiết bị.
- `saveItem()` dùng `putAndQueue(db.inventory, 'inventory', value)`.
- Không được tự áp quy tắc sinh mã thiết bị sang `InventoryItem.code`; yêu cầu trước mắt là UUID chính thức và người thêm, còn mã vật tư vẫn là mã nghiệp vụ người dùng nhập, phải kiểm tra trùng khi chính thức hóa.

### Cơ sở dữ liệu Local
- `src/db.ts` hiện dùng Dexie schema version 6.
- Các ID/foreign key đều khai báo kiểu string, nhưng dữ liệu Cloud chuẩn yêu cầu UUID. ID tạm phải có namespace riêng và bị chặn khỏi mọi mapper/Cloud write.
- `syncQueue.recordId` cũng là string và có thể lưu ID tạm; queue hiện tại chưa có trạng thái riêng cho draft-chưa-chính-thức.

### Cloud
- `src/lib/syncMapping.ts` map Asset/Inventory và các bảng liên quan sang normalized schema, không có bước xác nhận online hoặc đổi ID.
- `src/lib/assetsCloud.ts` là repository Cloud riêng, comment xác nhận không đọc/ghi Dexie và không tự đồng bộ.
- `src/lib/cloudSync.ts` là luồng JSON cũ, không được bật lại.
- Repository chưa có worker thực hiện pull/push queue theo protocol mới. Do đó hiện không tồn tại bằng chứng cho việc “đã pull hết dữ liệu Cloud mới nhất” trước khi cấp mã.
- Migration 012 đã có `create_asset_with_code`, nhưng hướng nghiệp vụ mới không dùng Cloud làm bộ cấp mã. Không xóa migration cũ; cần kiểm tra trạng thái đã áp dụng và tạo migration tiến về phía trước nếu cần.

## 2. Dependency map – khi đổi ID tạm thành UUID chính thức

### Asset ID được tham chiếu bởi
- `tasks.assetId`
- `maintenancePlans.assetId`
- `logs.assetId`
- `checklistTemplates.assetId`
- `checklistVersions.assetId`
- `checklistResults.assetId`
- `syncQueue.recordId` cho chính Asset và các mutation liên quan
- Các state/modal đang giữ Asset ID trong UI cần refresh sau khi đổi ID.
- Các liên kết lồng trong `logs.taskId`, `logs.checklistResultId`, `checklistVersions.templateId`, `checklistResults.templateId/templateVersionId` không đổi chỉ vì Asset ID đổi, nhưng cần giữ nguyên tính toàn vẹn liên kết.

### Inventory ID được tham chiếu bởi
- `movements.itemId`
- `syncQueue.recordId` cho Inventory item và movement có liên quan.
- `movements.linkedAssetId` là tham chiếu Asset ID tùy chọn; phải cập nhật nếu Asset được đổi ID.

### Nguyên tắc chuyển ID
- Chuyển cha và mọi FK liên quan trong một Dexie read-write transaction bao gồm toàn bộ bảng bị ảnh hưởng.
- Bảo toàn ID riêng của Task/Log/Checklist/Movement, timestamps, lịch sử và nội dung.
- Bảo toàn thứ tự queue; không tạo mutation Cloud cho bản ghi con trước khi cha có UUID chính thức.
- Nếu queue đã có entry cho ID tạm, phải thay recordId/queue key một cách nguyên tử; không để hai queue row cho cùng một record.
- Rollback toàn bộ khi bất kỳ bảng hoặc FK nào không cập nhật được.
- ID tạm không được xuất ra Cloud, không được dùng trong QR payload chính thức, và không được coi là Asset/Inventory đã được đồng bộ.

## 3. Các điểm phải xử lý trước khi code luồng chính thức

1. **Connectivity thực:** cần một bước xác minh Auth + truy cập Cloud + pull hoàn tất, không dùng riêng `navigator.onLine`.
2. **Snapshot đầy đủ:** danh sách Asset hiện có phải được pull đủ (pagination/cursor) trước khi tính mã tiếp theo; không dùng một trang dữ liệu.
3. **PC và Mobile đồng thời:** hai nền tảng vẫn được phép hoạt động cùng lúc, do đó cần conflict/unique guard phía Cloud. Local cấp mã, Cloud không tự cấp hoặc tự sửa mã.
4. **Inventory code:** hiện người dùng nhập tay; online finalization chỉ validate unique code và gán UUID chính thức, không tự sinh lại mã vật tư.
5. **Người thêm:** thêm snapshot bất biến (label = full name, fallback email; kèm auth user ID nếu có) cho Asset và Inventory. Phải chụp ở thời điểm tạo bản nháp, không lấy động khi mở hồ sơ sau này.
6. **Backup/restore:** cần kiểm tra dữ liệu bản nháp, ID tạm và người thêm có được backup/restore nguyên trạng; không biến draft thành record chính thức chỉ vì restore trên máy đang online.
7. **Demo/seed:** seed dữ liệu mẫu và import/restore hiện có phải được phân loại riêng; không tự động gửi seed/demo thành dữ liệu Cloud.
8. **Migration tương thích:** dữ liệu Local cũ đã có UUID/mã quản lý phải tiếp tục nguyên trạng; không chuyển chúng thành draft hoặc tái cấp mã.
9. **Auth session policy:** one PC + one Mobile cần server-side session registry/lease, không thể triển khai an toàn chỉ bằng localStorage. Phải thiết kế cùng luồng Auth, nhưng không nên chặn đăng nhập trước khi cơ chế server-side có migration/function và xử lý refresh token.
10. **QR/print/export:** draft chưa có mã quản lý chính thức thì không được phát hành tem QR/mã chính thức; UI cần trạng thái “Bản nháp – chờ kết nối” rõ ràng.

## 4. Thứ tự triển khai được đề xuất

### Phase A – nền tảng Local (chưa bật Cloud)
- Bổ sung `identityStatus` (draft/ready/synced/conflict) và `createdByLabel/createdByUserId` cho Asset + Inventory.
- Thêm Dexie migration version 7 chỉ bổ sung field/index cần thiết; upgrade dữ liệu cũ thành trạng thái legacy/official, không sửa ID/code.
- Tách ID tạm namespace `draft:` khỏi UUID; tạo draft offline không có UUID chính thức và Asset không có mã quản lý chính thức.
- Tạo helper rekey Asset/Inventory và FK trong Dexie transaction; unit tests rollback/complete FK coverage.
- Chặn các mapper Cloud từ chối draft ID, draft status và mã Asset trống.
- Chưa bật UI tạo online chính thức cho đến khi Phase B có pull/snapshot đáng tin cậy.

### Phase B – online finalization
- Xây dựng Cloud sync protocol pull/push đúng cursor, pagination, idempotency, permission, conflict.
- Khi online: verify session, pull đầy đủ dữ liệu liên quan, Local cấp UUID + mã thiết bị, lưu Local + queue nguyên tử, push ngay; Cloud chỉ validate và lưu nguyên giá trị.
- Khi offline: chỉ tạo draft; khi online trở lại FIFO finalization, từng draft phải refresh snapshot/đảm bảo allocator state mới nhất.
- Cloud unique constraints từ chối collision; UI tạo cảnh báo để người tạo xác minh, không tự đổi mã/xóa/gộp.

### Phase C – Inventory
- Dùng cùng draft identity/rekey.
- Giữ mã vật tư nhập tay; validate trùng trước khi official.
- Không thay đổi tồn kho/movement semantics; movements chỉ đồng bộ qua RPC giao dịch đã thiết kế.

### Phase D – một phiên mỗi nền tảng
- Server-side registry cho `user_id + platform` với PC/Mobile riêng; login mới cùng platform thu hồi session cũ.
- Client nhận tín hiệu revoke và signOut; PC và Mobile cùng tồn tại.
- Xử lý lease/heartbeat, mất mạng, token refresh, browser đóng/mở và lỗi mạng.

## 5. Điều kiện hoàn tất trước khi bật cho người dùng

- Test migration Dexie v6 → v7 trên bản sao dữ liệu; không đụng IndexedDB người dùng.
- Test chuyển ID Asset với Task, Plan, Log, Checklist template/version/result và queue.
- Test chuyển ID Inventory với Movement và linkedAssetId.
- Test rollback nếu một FK/queue update lỗi.
- Test offline draft, app reload, backup/restore, reconnect, FIFO, retry, duplicate conflict.
- Test hai trình duyệt PC/Mobile tạo liên tiếp, race/latency và Cloud unique rejection.
- Test dữ liệu legacy đang có vẫn giữ nguyên UUID, code, QR và history.
- CI build + unit tests PASS; sau đó mới triển khai từng phase trên Test theo chấp thuận riêng.

## 6. Trạng thái

- Đã hoàn tất audit mã nguồn và dependency map ở mức model/luồng lưu.
- Chưa sửa mã nguồn, chưa thay đổi Dexie schema, chưa chạy migration/SQL, chưa gọi RPC, chưa ghi Supabase.
- Tài liệu này bổ sung cho `supabase/CLOUD_LOCAL_DRAFT_IDENTITY_DESIGN.md`, không thay thế các quyết định nghiệp vụ đã chốt.
