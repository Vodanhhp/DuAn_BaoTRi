# BAOTRI Mini – Thiết kế giao thức đồng bộ Cloud (bản review kỹ thuật)

**Ngày:** 18/11/2026  
**Trạng thái:** Thiết kế và mapping local đã bắt đầu; chưa có worker chạy, chưa gửi dữ liệu nghiệp vụ lên Supabase.  
**Phạm vi:** Một tài khoản Auth hiện tại, dữ liệu nghiệp vụ local-first, kiến trúc tenant-ready bằng organization_id.

## 1. Nguyên tắc không được phá vỡ

1. IndexedDB là nguồn làm việc hiện tại; không tự tải Cloud đè lên local.
2. Giữ nguyên UUID của bản ghi local khi đồng bộ; không đối chiếu bằng mã thiết bị/tên.
3. Mọi thao tác Cloud phải có organization_id lấy từ organization context đã xác thực; không nhận organization_id tùy ý từ dữ liệu queue.
4. Không replay queue cũ như một đợt import. Queue hiện tại chỉ là các thay đổi phát sinh từ phiên bản mới.
5. Không LWW (last-write-wins) đối với dữ liệu sửa được. Phát hiện xung đột và giữ cả hai phía để người dùng xử lý.
6. Checklist versions, Checklist results, maintenance logs và inventory movements là lịch sử; không ghi đè/xóa để giả lập cập nhật.
7. Inventory balance chỉ được thay đổi cùng movement bằng RPC transaction và idempotency.
8. Ảnh không đưa Base64 vào PostgreSQL; chuyển Storage ở giai đoạn riêng.
9. Không bật worker cho tới khi schema delta, kiểm thử Test, nguồn dữ liệu seed và conflict protocol được chốt.
10. Production không được đụng tới trong giai đoạn này.

## 2. Mapping local → Cloud đã viết

File triển khai thuần dữ liệu: `src/lib/syncMapping.ts`.

| IndexedDB | Supabase | Ghi chú |
|---|---|---|
| assets | assets | Bỏ images khỏi row; ảnh local chưa đồng bộ |
| inventory | inventory_items | group → item_group; quantity chỉ cho baseline có kiểm soát |
| tasks | maintenance_tasks | assetId → asset_id |
| maintenancePlans | maintenance_plans | assetId → asset_id |
| checklistTemplates | checklist_templates | Một template theo thiết bị |
| checklistVersions | checklist_template_versions | Version và items JSONB, bất biến |
| checklistResults | checklist_results | Snapshot items JSONB, bất biến |
| logs | maintenance_logs | Mapping hiện bị chặn nếu có trường chưa được schema hỗ trợ |
| movements | inventory_movements | Cấm upsert trực tiếp; chỉ qua RPC transaction |

Mapping functions là pure functions: không gọi Dexie, Supabase, fetch hay network. Chúng chỉ chuyển kiểu dữ liệu và kiểm tra trường có thể gây mất dữ liệu.

### Trường chưa được schema hiện tại hỗ trợ

Bảng local `logs` có:
- `dueDate`
- `requestedBy`
- `editHistory`

Bảng `maintenance_logs` hiện chưa có các cột tương ứng. Vì vậy `toCloudMaintenanceLogRow()` ném `UnsupportedCloudFieldError` nếu các trường này có giá trị; không được tự bỏ trường rồi đánh dấu đã đồng bộ. Cần thiết kế schema delta riêng, review và được duyệt trước khi có migration.

### Hàng tồn kho

- `toCloudInventoryBaselineRow()` gồm quantity, chỉ dùng cho một lần seed có kiểm soát vào organization trống.
- `toCloudInventoryMetadataRow()` cố ý loại quantity, dùng làm nền cho upsert metadata thường ngày.
- Khi tạo vật tư mới có tồn ban đầu, cần RPC mở tồn đầu kỳ/ghi nhận movement; không được lén gửi quantity qua upsert thường.
- Khi nhập/xuất/điều chỉnh: RPC phải khóa dòng inventory_items, kiểm tra số tồn, cập nhật quantity và insert movement trong cùng transaction.

### Hàng đợi và thứ tự phụ thuộc

Thứ tự xử lý đề xuất:
1. assets, inventory_items
2. maintenance_tasks, maintenance_plans
3. checklist_templates
4. checklist_template_versions
5. checklist_results
6. maintenance_logs
7. inventory_movements qua RPC

Không đánh dấu queue hoàn tất chỉ vì HTTP request thành công; phải xác nhận đúng bản ghi/ID và mutation idempotency từ server.

## 3. Khoảng trống schema cần xử lý trước worker

Schema hiện tại chưa có đủ cơ chế để sync an toàn:

1. Chưa có `row_version`/revision trên các bảng master để phát hiện hai thiết bị cùng sửa một bản ghi.
2. Chưa có bảng/ledger idempotency theo `mutation_id`; retry sau timeout có thể lặp một thao tác không idempotent.
3. `inventory_movements` chưa có RPC ghi movement + balance atomically, và chưa có mutation idempotency.
4. `maintenance_logs` thiếu `due_date`, `requested_by`, `edit_history` như đã nêu.
5. Chưa có tombstone/change log để truyền delete và thay đổi đến thiết bị offline.
6. Chưa có cursor/sequence ổn định cho pull phân trang; chỉ dựa updated_at có thể bỏ sót bản ghi khi timestamp trùng hoặc thiết bị lệch giờ.
7. Queue hiện tại chưa giữ base Cloud version/snapshot tại thời điểm bắt đầu sửa. Chỉ thêm retry là chưa đủ để phát hiện conflict.
8. Checklist version/result và maintenance log là append-only; cần bảo vệ unique ID và không cho update/delete tùy tiện.
9. `assets.images` đang là mảng ảnh local; adapter Cloud chưa có Storage transfer.
10. Dữ liệu danh mục tùy chỉnh `customAssetCategories` lưu localStorage; chưa có luồng đồng bộ vào `organization_settings.asset_categories`.

Không giải quyết các điểm này bằng cách sửa trực tiếp Production hoặc chạy SQL tự động.

## 4. Giao thức push đề xuất

Mỗi queue item sau này cần tối thiểu:
- organization_id lấy từ phiên đăng nhập hiện tại (không lấy từ queue).
- tableName, recordId, operation.
- deviceId ổn định của trình duyệt.
- mutationId duy nhất cho một lần thay đổi logic.
- baseVersion (version Cloud mà local đã đọc trước khi sửa).
- trạng thái, attempts, lastError, lastAttemptAt.

Luồng:
1. Lấy queue pending theo thứ tự phụ thuộc; khóa/claim queue item trong Dexie transaction để tránh hai tab cùng xử lý.
2. Kiểm tra user session, membership active và quyền tương ứng; nếu mất quyền thì giữ queue và báo lỗi rõ.
3. Tạo payload từ local row bằng mapper; validate FK và required fields.
4. Gửi mutation có mutationId. Server ghi nhận idempotency key trước/đồng thời mutation trong cùng transaction.
5. Với master row, chỉ update nếu server row_version = baseVersion; nếu không, trả conflict cùng server snapshot, không ghi đè.
6. Với append-only row, insert theo UUID + idempotency; nếu UUID đã tồn tại, so sánh payload hash: giống thì coi là đã áp dụng, khác thì conflict.
7. Chỉ xóa/hoàn tất queue sau khi server xác nhận mutationId và version mới.
8. Timeout/mất mạng: retry cùng mutationId, không sinh mutationId mới cho cùng một request đang retry.
9. Khi người dùng tiếp tục sửa bản ghi sau lần push trước, đó là mutation mới; giữ baseVersion gốc cho tới khi mutation trước được xác nhận.

## 5. Giao thức pull đề xuất

- Server cung cấp change feed có sequence tăng đơn điệu theo organization, hoặc cursor tương đương được tạo trong transaction.
- Mỗi thiết bị lưu cursor riêng; pull theo trang có giới hạn, không tải toàn bộ DB mỗi lần mở app.
- Áp dụng thay đổi vào Dexie theo transaction; không ghi đè local row đang có queue pending/processing/failed.
- Nếu server thay đổi một row đang có local mutation, tạo conflict record; giữ nguyên cả local và cloud snapshot.
- Delete phải được biểu diễn bằng tombstone có sequence/version; không chỉ dựa vào row đã biến mất.
- Chỉ cập nhật cursor sau khi toàn bộ trang được ghi local thành công.

## 6. Conflict resolution

Trạng thái conflict tối thiểu:
- local record + local mutation + baseVersion
- server record + server row_version
- detectedAt + field-level diff (nếu xác định được)
- resolution: keep_local / use_cloud / manual_merge
- resolvedBy + resolvedAt

Không tự động chọn phía mới hơn theo đồng hồ thiết bị. Với Checklist/history, không merge nội dung đã phát hành; giữ phiên bản cũ và tạo version mới nếu cần.

## 7. Retry và vận hành

- Lỗi mạng/5xx/429: retry exponential backoff có jitter, giới hạn thời gian và số lần; queue vẫn bền vững.
- Lỗi xác thực: refresh session một lần; nếu vẫn thất bại, dừng worker và giữ queue.
- Lỗi quyền/RLS/validation: không retry liên tục; đánh dấu failed, hiển thị lý do.
- Lỗi conflict: chuyển conflict, không tự retry ghi.
- Queue processing bị bỏ dở sau crash: khi khởi động, reset item processing cũ về pending sau timeout an toàn; giữ mutationId.
- Worker có một khóa singleton liên tab; không dùng setInterval không kiểm soát.
- Mọi log kỹ thuật tránh ghi access token, dữ liệu nhạy cảm hoặc ảnh Base64.

## 8. Giai đoạn tiếp theo

A. Hoàn tất đối chiếu backup desktop/mobile và quyết định nguồn seed. Không merge theo tên/mã; giữ nguyên backup gốc.  
B. Review schema delta: row_version, idempotency ledger, change feed/tombstone, log fields, inventory RPC. Chỉ tạo migration draft sau khi thiết kế được review; chưa áp dụng.  
C. Viết tests thuần cho mapping, round-trip, FK dependencies, unsupported fields và inventory quantity guard.  
D. Triển khai worker chỉ trên project Test sau khi có migration đã duyệt và test cases.  
E. Kiểm thử hai thiết bị, offline edits, conflict, retry sau timeout, permission revoked, duplicate mutation, pagination và rollback.  
F. Chỉ lập kế hoạch Production sau khi Test đạt; mọi thao tác Production cần phê duyệt riêng.

## 9. Trạng thái commit

- Mapping layer: `src/lib/syncMapping.ts` – commit `d2a5107882a929814717088561a060074e12cf38`.
- Build và deploy workflow #173: thành công.
- Không có worker Cloud, không có lệnh ghi Supabase, không chạy SQL, không thay đổi dữ liệu Test/Production.
