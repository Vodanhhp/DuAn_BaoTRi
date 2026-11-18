# BAOTRI Mini – Hợp đồng RPC update, idempotency và change feed

Cập nhật: 18/11/2026
Trạng thái: thiết kế/review, chưa triển khai SQL hoặc gọi Supabase.

## 1. Kết luận kiến trúc

Không được bật Cloud worker khi frontend còn có thể UPDATE trực tiếp các bảng nghiệp vụ. `row_version` chỉ là token phát hiện thay đổi; bảo vệ lost-update chỉ hoàn chỉnh khi:
- mọi update đi qua RPC có `expected_version`;
- RPC tự xác thực `auth.uid()`, organization membership đang active và permission cụ thể;
- RPC khóa bản ghi, so sánh version, cập nhật và ghi change event trong cùng transaction;
- quyền UPDATE trực tiếp của authenticated bị thu hồi cho các bảng được chuyển sang RPC;
- response trả version mới và snapshot conflict có cấu trúc ổn định.

Không dùng một RPC tổng quát nhận tên bảng/cột tùy ý. Dùng RPC theo nghiệp vụ/bảng hoặc nhóm thao tác có allowlist cột rõ ràng.

## 2. Hợp đồng RPC cập nhật

### Đầu vào chuẩn

Mỗi mutation update mang:
- `p_organization_id uuid`
- `p_record_id uuid`
- `p_expected_version bigint`
- `p_mutation_id uuid`
- payload có schema/allowlist riêng cho RPC (không nhận JSON tùy ý rồi ghép SQL động).

Ví dụ nhóm RPC cần có:
- `update_asset`: chỉ cho phép các trường hồ sơ thiết bị được sửa; không cho client tự đổi organization_id, id, row_version, created_at, updated_at.
- `update_inventory_item_metadata`: chỉ metadata; tuyệt đối không nhận quantity. Quantity chỉ đổi qua inventory movement RPC.
- `update_maintenance_task` và `update_maintenance_plan`: payload theo đúng cột nghiệp vụ; xóa là RPC riêng và kiểm tra `maintenance.delete`.
- `update_checklist_template`: cập nhật header/current_version theo quy trình phát hành version; không sửa version snapshot cũ.
- `update_organization_settings`: allowlist cấu hình, kiểm tra `settings.manage`.

### Trình tự trong mỗi RPC

1. Yêu cầu `auth.uid()` khác null.
2. Kiểm tra organization đang active, membership của auth.uid() đang active và permission tương ứng bằng `has_org_permission`.
3. Chuẩn hóa payload và tính hash ở server; không tin hash client.
4. Claim/đọc idempotency key trong cùng transaction (mục 3).
5. Khóa đúng row bằng `SELECT ... FOR UPDATE` theo cả organization_id và id.
6. Nếu không có row: trả not_found, không tiết lộ row thuộc organization khác.
7. So sánh `row_version` với `p_expected_version`.
8. Nếu lệch: không update; trả `conflict` kèm current row snapshot, current version và mutation id.
9. Nếu khớp: update đúng allowlist cột; trigger tăng row_version đúng một lần.
10. Ghi change event trong cùng transaction; lưu response hoàn tất vào idempotency ledger.
11. Trả `applied`, version mới và snapshot kết quả.

Response RPC nên dùng cấu trúc ổn định:
- `status`: applied | conflict | not_found (permission/validation errors có thể raise SQLSTATE tương ứng).
- `mutation_id`
- `record_id`
- `current_version`
- `record`: snapshot row khi applied/conflict.

Conflict là kết quả nghiệp vụ, không phải lỗi retry tự động. Client giữ mutation và đưa vào hàng đợi xử lý conflict; không tự đổi expected_version rồi gửi lại payload cũ.

## 3. Idempotency ledger

Đề xuất bảng nội bộ `organization_mutations`:
- `organization_id`
- `mutation_id`
- `actor_user_id`
- `operation` (RPC/loại mutation)
- `record_id`
- `payload_hash`
- `result_status`
- `result_payload jsonb`
- `created_at`, `completed_at`

Khóa duy nhất: `(organization_id, mutation_id)`.

Quy tắc:
- Client tạo mutationId một lần và giữ nguyên khi retry; không sinh ID mới mỗi lần gửi lại.
- Server tự tính hash trên operation + organization + record + expected_version + payload đã chuẩn hóa. Cần xác minh extension `pgcrypto`/hàm hash có sẵn trước khi viết migration; không tự giả định extension đã bật.
- Nếu key chưa có, RPC tạo ledger entry và thực hiện business mutation trong cùng transaction.
- Nếu key đã có, khóa/đọc entry:
  - cùng actor + cùng operation + cùng record + cùng hash: trả lại response đã lưu, không chạy business mutation lần nữa;
  - hash/operation/record khác: từ chối `idempotency_key_reuse`;
  - actor khác: từ chối, không cho replay kết quả của người dùng khác.
- Ledger và thay đổi nghiệp vụ phải commit/rollback cùng nhau. Không tạo ledger “đã thành công” trước business write.
- Lưu cả kết quả conflict để retry cùng mutationId trả đúng conflict cũ. Sau khi người dùng giải quyết conflict, mutation mới phải dùng mutationId mới.
- Giữ ledger đủ lâu để bao phủ retry/backup restore; chính sách retention chỉ được xóa khi có quy trình chứng minh không còn client retry cũ. Mặc định không xóa trong giai đoạn đầu.

Quyền:
- Không cấp SELECT/INSERT/UPDATE/DELETE trực tiếp bảng ledger cho anon/authenticated.
- Chỉ RPC SECURITY DEFINER có `search_path = ''`, kiểm tra auth và permission rõ ràng mới truy cập bảng.
- Tránh lưu payload nhạy cảm không cần thiết; lưu hash và response tối thiểu cần cho replay.

## 4. Change feed và cursor

Đề xuất hai bảng nội bộ:
- `organization_sync_counters(organization_id, last_cursor)`
- `organization_changes(organization_id, cursor, change_id, table_name, record_id, operation, row_version, payload, created_at)`

Unique:
- `organization_sync_counters.organization_id` primary key.
- `organization_changes(organization_id, cursor)` unique.
- `change_id` UUID unique trong organization hoặc global.

Cấp cursor theo commit-order:
1. Trong transaction business mutation, khóa counter row của organization bằng `SELECT ... FOR UPDATE`.
2. Tăng `last_cursor`, lấy giá trị mới.
3. Insert change event cùng transaction với business row và idempotency ledger.
4. Commit toàn bộ. Transaction khác của cùng organization phải chờ counter lock; vì thế không thể commit cursor cao hơn trước cursor thấp hơn.
5. Không dùng PostgreSQL sequence độc lập làm cursor đồng bộ vì sequence có thể cấp số theo thứ tự khác commit.

Change event:
- Upsert/update: table, record ID, row_version và snapshot payload cần cho pull.
- Delete: tombstone với record ID, operation=delete và version/metadata cần thiết; không xóa dấu vết trước khi client có thể nhận.
- Append-only history: mỗi event là một record riêng, không coalesce.
- Chỉ phát event sau khi quyền và business operation thành công; rollback thì counter/event cũng rollback.
- Một logical mutation chỉ phát đúng một change event cho mỗi record thay đổi; nếu RPC hoàn thành task đồng thời tạo log thì phải phát event cho cả task và log trong cùng transaction.

Pull RPC:
- Input: organization_id, after_cursor, limit có giới hạn server-side.
- Xác thực membership + quyền xem phù hợp; không tin organization_id client gửi.
- Trả ordered events theo cursor tăng dần, kèm next_cursor và high_watermark.
- Client áp dụng toàn bộ page vào IndexedDB transaction; chỉ commit local cursor sau khi mọi row/tombstone trong page đã apply thành công.
- Retry cùng cursor phải trả lại event giống nhau; không có tác dụng phụ.
- Nếu cursor quá cũ do retention hoặc có khoảng trống không thể khôi phục, trả `resync_required`; không tự tải toàn bộ rồi ghi đè local.

RLS/grants:
- Không cho client ghi trực tiếp counter/change feed.
- Không cho client đọc trực tiếp nếu pull RPC là đường truy cập duy nhất.
- SECURITY DEFINER RPC phải khóa `search_path`, xác thực membership/permission và giới hạn kích thước page/payload.
- Chống lộ dữ liệu giữa organization trong cả query lẫn payload.

## 5. Những điểm phải chốt trước khi viết SQL migration

1. Kiểm tra extension hash thực tế trên Supabase Test; chọn hàm hash và canonical JSON ổn định.
2. Chốt RPC riêng cho từng bảng và allowlist cột từ schema/local model.
3. Chốt semantics delete: hard delete hay soft-delete/tombstone; các FK hiện tại dùng ON DELETE RESTRICT nên không thể tùy tiện hard-delete thiết bị có lịch sử.
4. Chốt permission xem cho từng bảng khi pull; ví dụ logs.view, checklist.view, assets.view và inventory.view.
5. Chốt payload change feed có đủ dữ liệu để client apply mà không phải SELECT từng row, nhưng không chứa trường người dùng không có quyền xem.
6. Xác định cách đồng bộ nhiều mutation của cùng record: giữ thứ tự, conflict chặn mutation sau, không tự rebase.
7. Kiểm tra row_version trigger tương tác với các RPC nhiều UPDATE; mỗi logical mutation tăng version một lần.
8. Chạy kiểm thử concurrency thật trên Test sau khi migration được phê duyệt; không dùng Production để thử.

## 6. Bộ kiểm thử bắt buộc

- Hai client cùng expected_version: chỉ một update applied; client còn lại nhận conflict snapshot.
- Hai request cùng mutationId và cùng payload: business mutation chỉ chạy một lần, cùng response.
- Cùng mutationId nhưng khác payload/operation/record/actor: bị từ chối.
- RPC lỗi giữa chừng: business row, ledger và change event cùng rollback.
- Permission bị thu hồi trước request: RPC từ chối, không ghi ledger thành công hay thay đổi dữ liệu.
- Membership bị disable hoặc organization inactive: mọi RPC từ chối.
- Client truyền organization_id khác: không thể đọc/ghi chéo organization.
- Hai transaction đồng thời phát change: cursor trả về đúng commit order, không bỏ sót.
- Delete tạo tombstone; pull nhiều page không mất tombstone.
- Client apply page lỗi giữa chừng: cursor local không tiến.
- Retry pull cùng cursor: kết quả nhất quán.
- Cursor hết retention: trả resync_required, không âm thầm trả page rỗng.

## 7. Trạng thái an toàn

- Đây là hợp đồng thiết kế; chưa tạo bảng/RPC SQL và chưa sửa quyền hiện tại.
- Không chạy SQL/migration, không gọi RPC, không ghi dữ liệu Cloud.
- Không bật worker và không thay đổi Dexie queue v6/v7.
- Không thay đổi BAOTRI-Mini-Test hoặc Production.

Bước tiếp theo: viết các SQL draft tách biệt cho idempotency ledger và change feed sau khi hoàn tất review hash extension, grants, FK delete và pull permissions. Mọi draft vẫn nằm trong `supabase/drafts/`, không được áp dụng khi chưa phê duyệt.
