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


## 8. Chuẩn hóa shared Receipt và xử lý replay sau khi quyền thay đổi (19/11/2026)

Trạng thái: **Thiết kế đề xuất; chưa áp dụng.** Mục này làm rõ các điểm còn thiếu của hợp đồng ở mục 3–6.

### 8.1 Shared Receipt schema logic

Một dòng `organization_mutations` đại diện cho **một logical mutation**, không phải một record đơn lẻ. Hợp đồng tối thiểu:
- `organization_id uuid`, `mutation_id uuid`: primary key ghép.
- `actor_user_id uuid`: lấy từ `auth.uid()`, không nhận từ client.
- `operation text`: mã thao tác ổn định, không phụ thuộc tên hàm có thể đổi.
- `request_fingerprint jsonb`: envelope canonical do server tự dựng, gồm organization, operation, actor scope, resource IDs, expected version/revision và payload đã chuẩn hóa. Không tin hash do client gửi.
- `result_status text`: applied | no_change | conflict.
- `result_payload jsonb`: response canonical đã commit; với mutation nhiều record chứa danh sách snapshot/identity/version của tất cả record bị ảnh hưởng.
- `created_at`, `completed_at`.

Không dùng `record_id` đơn làm mô hình duy nhất vì `complete_maintenance_task` tác động Task + Log trong cùng transaction. Response/Receipt phải mô tả được 1..N affected records, mỗi record có table/type, id, operation và version/revision sau giao dịch. Primary key vẫn chỉ là (organization_id, mutation_id).

### 8.2 Fingerprint — không giả định pgcrypto

- Server tự chuẩn hóa payload theo allowlist và kiểu cột trước khi dựng fingerprint; JSONB object equality tránh phụ thuộc thứ tự key.
- Trước mắt có thể so sánh canonical JSONB trực tiếp trong bảng Receipt riêng tư, nhưng phải đánh giá dữ liệu nhạy cảm/kích thước payload và chỉ lưu phần cần để phát hiện key reuse.
- Chỉ chuyển sang digest SHA-256 nếu đã xác minh extension/hàm có thật trên Supabase Test và có test canonicalization ổn định. Không dùng MD5 hoặc hash client tự khai làm căn cứ bảo mật.
- Khác actor, operation, organization, resource ID, expected version/revision hoặc payload đều là `idempotency_key_reuse`; không chạy side effect.

### 8.3 Claim và concurrency của mutation ID

- Auth + organization active + active membership được xác minh trước khi trả bất kỳ receipt nào.
- Với request mới, kiểm tra permission nghiệp vụ và payload; sau đó claim key bằng unique key (organization_id, mutation_id) trong cùng transaction với business write.
- Nếu hai request cùng key đến đồng thời, unique constraint phải serialize claim. Request thua đọc lại receipt đã commit trong statement tiếp theo; so actor + fingerprint rồi replay hoặc reject. Nếu transaction đầu rollback, request còn lại có thể claim và thực hiện.
- Không commit receipt trạng thái processing độc lập với business transaction. Receipt chỉ tồn tại sau commit với kết quả hoàn chỉnh; business write, receipt, row_version và change events cùng rollback/commit.
- Không lưu receipt cho Auth/membership/permission/validation errors trước khi mutation được chấp nhận. Conflict/no_change là kết quả nghiệp vụ xác định và được lưu để retry cùng key trả đúng kết quả cũ.

### 8.4 Chính sách replay khi permission bị thu hồi — cần người dùng xác nhận

Phát hiện trong migration Asset hiện tại: `apply_asset_mutation_with_lock` kiểm tra `assets.update` trước khi tra Receipt. Vì vậy, nếu Cloud đã commit nhưng phản hồi mất, sau đó permission bị thu hồi, cùng actor retry sẽ bị chặn trước khi nhận biết mutation đã thành công.

Đề xuất cho shared RPC:
1. Auth vẫn bắt buộc; organization phải active; actor phải còn active membership trong organization.
2. Tra Receipt theo organization + mutation ID; chỉ actor_user_id khớp mới được replay. Actor khác/cross-org/inactive member bị từ chối; không tiết lộ receipt.
3. Replay không phải business write mới, nên không yêu cầu lại permission ghi của operation đã commit.
4. Nếu actor hiện còn quyền đọc tương ứng cho mọi record trong result, trả canonical snapshots như Receipt đã lưu.
5. Nếu actor còn active membership nhưng quyền đọc một phần/toàn bộ đã bị thu hồi, chỉ trả acknowledgement tối thiểu (đã commit, mutation ID, resource IDs/version đã biết trong request), không trả snapshot nhạy cảm; client đọc lại bằng luồng read/pull được cấp quyền hiện tại.
6. Nếu membership bị vô hiệu hoặc organization inactive, deny replay hoàn toàn.

Quy tắc này giữ được recovery sau mất phản hồi nhưng không biến Receipt thành kênh vượt quyền đọc. Cần xác nhận chính sách này trước khi viết RPC SQL.

### 8.5 Asset Receipt trong giai đoạn chuyển tiếp

- Không dual-write độc lập vào `asset_mutation_receipts` và `organization_mutations` cho cùng một mutation.
- Giữ Asset-specific Receipt + Asset Edit Lease cho RPC hiện hữu đến khi có migration/harmonization riêng và test replay đầy đủ.
- Khi chuyển Asset sang shared Receipt, phải bảo toàn tra cứu các mutation ID đã commit trong bảng cũ; định nghĩa cách replay legacy receipt trước khi ngừng RPC cũ hoặc ngừng ghi bảng cũ.
- Không xóa Asset Receipt/Lease trong cùng bước chỉ vì shared ledger đã tồn tại.

## 9. row_version contract sau khi đối chiếu trigger hiện hữu

### 9.1 Bảng thuộc phạm vi

Draft 015 hiện thêm row_version cho: assets, inventory_items, maintenance_tasks, maintenance_plans, checklist_templates, organization_settings. Đây là các mutable master/config rows. Không thêm row_version cho inventory_movements, maintenance_logs root/revisions, checklist_template_versions hoặc checklist_results (append-only history).

### 9.2 Trigger và updated_at

- Schema 002 hiện có BEFORE UPDATE trigger `*_set_updated_at`; draft 015 đặt `*_set_row_version`. PostgreSQL chạy cùng loại trigger theo thứ tự tên alphabetic; tên row_version hiện đứng trước updated_at. Hàm version bỏ `row_version` và `updated_at` khi so sánh JSONB nên updated_at-only change không tự tăng version.
- Trigger tăng version một lần cho mỗi SQL UPDATE có thay đổi business field; không tự hiểu logical transaction. Do đó mỗi RPC phải UPDATE từng mutable row đúng một lần. Hai UPDATE cùng row trong một RPC sẽ tăng version hai lần và phải được thiết kế tránh.
- INSERT luôn bắt đầu version 1; client không được quyết định row_version. No-op không UPDATE row, không tăng version.
- RPC lock row, so expected_version, UPDATE đúng allowlist, trả snapshot/version mới. Conflict không UPDATE; lưu Receipt conflict và trả current snapshot nếu quyền đọc cho phép.

### 9.3 Ranh giới nghiệp vụ

- Inventory movement: row_version thuộc inventory_items; Item balance + một movement là một transaction. Movement append-only không có row_version.
- Task completion + Log: Task row_version tăng đúng một; Log revision_no bắt đầu 1; cả hai dùng một Receipt, hai change events trong cùng transaction.
- Log revise: expected_revision_no trên revision mới nhất, không dùng row_version; insert revision mới, không update root/revision cũ.
- Checklist template: row_version trên template header; version snapshot mới là append-only row riêng. Cần bảo đảm mỗi lần publish chỉ UPDATE header một lần và INSERT đúng một version row.
- Asset: row_version có thể là nền tương lai nhưng Asset RPC hiện dùng expected_cloud_updated_at + Edit Lease + Asset Receipt. Chưa chuyển token/version hoặc bỏ Lease cho đến khi có thiết kế migration riêng.
- organization_settings là một row/organization, RPC dùng organization_id làm resource key; row_version vẫn do DB quản lý.

## 10. Change feed và multi-record mutation

- Receipt một dòng có thể tham chiếu nhiều affected records; change feed tạo một event cho từng record thực sự thay đổi.
- Một transaction khóa organization counter, cấp cursor liên tiếp cho tất cả event của mutation, insert event + Receipt + business rows trước commit. Transaction khác cùng organization chờ counter; không thể commit cursor cao trước cursor thấp.
- Conflict và no_change có Receipt nhưng không change event. Task completion có event cho Task và Log; Log revise có event cho Log/revision aggregate; Inventory movement có event cho Item và Movement.
- Pull page phải apply toàn bộ event vào Dexie transaction rồi mới advance cursor. Nếu một event fail, rollback page và giữ cursor cũ.

## 11. Kiểm thử bổ sung trước khi viết SQL

- Commit thành công → response mất → thu hồi write permission → cùng actor active membership replay: trả acknowledgement; snapshot chỉ trả nếu còn read permission.
- Commit thành công → actor inactive hoặc organization inactive → replay bị deny.
- Cùng key, actor khác hoặc organization khác → deny, không lộ result.
- Hai request cùng mutation ID đồng thời: đúng một business execution; request còn lại replay cùng result.
- Request đầu rollback: request thứ hai có thể claim và thực hiện.
- Multi-record Task+Log: một Receipt, một transaction, đúng hai events, rollback toàn bộ khi lỗi.
- No-op inventory count: Receipt no_change, không row_version/event/movement.
- Hai client cùng expected_version: một applied, một conflict có snapshot.
- Mỗi RPC update cùng row đúng một lần; trigger không tăng version hai lần.
- Asset legacy Receipt replay vẫn hoạt động trong khi chuyển tiếp; không dual-write.

## 12. Trạng thái

- Shared Receipt/row_version contract đã được làm rõ ở mức thiết kế.
- Chính sách replay sau khi quyền ghi/đọc bị thu hồi tại mục 8.4 là đề xuất, chờ người dùng xác nhận.
- Chưa tạo shared-ledger SQL draft mới; chưa sửa draft 015; chưa thay đổi Asset receipt migration.
- Chưa chạy SQL, chưa gọi RPC, chưa thay đổi Test/Production, chưa bật worker.
