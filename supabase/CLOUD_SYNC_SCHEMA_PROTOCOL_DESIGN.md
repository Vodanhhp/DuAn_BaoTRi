# BAOTRI Mini – Thiết kế phiên bản, idempotency, change feed và giao dịch kho

**Ngày:** 18/11/2026  
**Trạng thái:** Thiết kế review; chưa tạo SQL migration, chưa thực thi RPC, chưa kết nối worker.  
**Phạm vi:** Chuẩn hóa hợp đồng Cloud cho local-first sync; chỉ được thử nghiệm trên BAOTRI-Mini-Test sau khi thiết kế và migration được duyệt.

## 1. Phát hiện từ schema hiện tại

### 1.1 Chưa có row_version

Các bảng nghiệp vụ mutable hiện có `updated_at` trigger nhưng chưa có `row_version`. Timestamp không đủ để optimistic concurrency vì có thể trùng, độ phân giải, hoặc thay đổi đồng hồ client.

### 1.2 Inventory INSERT đang có thể bypass movement

Migration 002 cấp `GRANT INSERT` trên toàn bảng `inventory_items`; RLS policy cho phép member có thể insert row. Dù quyền UPDATE cột `quantity` đã bị thu hồi, quyền INSERT hiện tại vẫn cho phép client tạo vật tư với quantity ban đầu mà không có movement/opening balance event.

**Kết luận:** Muốn đảm bảo mọi thay đổi số tồn đều có lịch sử thì cần thu hồi INSERT trực tiếp `inventory_items` từ authenticated và thay bằng RPC tạo vật tư + movement mở tồn trong cùng transaction. RPC movement riêng không đủ nếu đường INSERT cũ còn mở.

### 1.3 Assets có đường tạo riêng

Migration 012 thu hồi INSERT trực tiếp `assets` và buộc tạo qua `create_asset_with_code`. RPC tự cấp code theo cấu hình tổ chức, không nhận code local. Vì vậy luồng import thiết bị local có mã sẵn vẫn cần RPC import Admin riêng, giữ nguyên UUID + code và kiểm tra trùng; không được dùng mapper để REST upsert.

### 1.4 Ý nghĩa movement “Điều chỉnh” chưa đủ rõ

UI hiện tại tính tồn mới bằng `+quantity` cho “Nhập” và `-quantity` cho mọi loại còn lại; do đó “Điều chỉnh” đang giảm tồn như “Xuất”. Kiểu local chỉ lưu quantity dương, không có signed delta hoặc target balance.

**Kết luận:** Chưa viết RPC kho cho tới khi chốt nghiệp vụ “Điều chỉnh” là tăng/giảm theo delta có dấu hay đặt tồn thực tế. Không tự suy đoán và không đổi dữ liệu lịch sử. “Nhập” tăng, “Xuất” giảm; số lượng phải dương và không được xuất vượt tồn.

## 2. row_version và optimistic concurrency

Áp dụng cho bảng mutable:
- `assets`
- `inventory_items` (chỉ metadata; balance thay đổi qua RPC movement)
- `maintenance_tasks`
- `maintenance_plans`
- `checklist_templates`
- `organization_settings` khi được đồng bộ
- `asset_images` nếu sau này cho phép sửa metadata

Quy tắc:
1. Thêm `row_version bigint not null default 1 check (row_version > 0)`.
2. INSERT bắt đầu version = 1.
3. UPDATE nghiệp vụ thành công tăng đúng 1, do trigger DB; client không được tự gửi row_version mới.
4. RPC update nhận `p_expected_version`; chỉ update nếu row hiện tại có version bằng giá trị này.
5. Nếu không khớp, trả mã conflict + server row snapshot + server row_version; không sửa row.
6. Nếu request lặp lại cùng mutationId, idempotency xử lý trước khi kiểm tra version để retry sau timeout trả kết quả cũ, không bị biến thành conflict giả.
7. Với inventory movement, balance update tăng row_version của inventory item trong cùng transaction.
8. Các bảng lịch sử append-only không cần row_version update; ID + idempotency + unique constraints bảo vệ insert. Nếu cần version chỉ dùng cho metadata chỉnh sửa, phải review riêng.

Không dùng `updated_at` làm version. Không cho client ghi trực tiếp row_version. Trigger phải phân biệt update nghiệp vụ với thao tác không đổi dữ liệu; tránh tăng version khi UPDATE không làm thay đổi cột nghiệp vụ.

## 3. Idempotency ledger

Bảng nội bộ đề xuất: `organization_mutations` (tên tạm).

Các cột:
- `organization_id`
- `mutation_id` UUID
- `device_id` UUID
- `table_name` / `operation` (giá trị allow-list, không nhận tên bảng tùy ý để dynamic SQL)
- `record_id` UUID
- `payload_hash` (hash tính phía server từ JSONB đã chuẩn hóa)
- `result_status` (applied / conflict / rejected)
- `result_version` nullable
- `result_payload` JSONB hoặc response tối thiểu đủ cho retry
- `created_at`

Ràng buộc unique `(organization_id, mutation_id)`. Không cấp SELECT/INSERT/UPDATE/DELETE trực tiếp cho authenticated; chỉ RPC Security Definer có `search_path` cố định, kiểm tra auth + organization permission, và RLS/privilege được review.

Luồng RPC trong **một transaction PostgreSQL**:
1. Xác thực auth.uid và permission cụ thể; organization_id phải được xác minh từ membership/permission, không tin queue.
2. Tạo hoặc khóa ledger row theo (organization_id, mutation_id); unique constraint serialize request trùng.
3. Nếu mutationId đã có: so payload hash. Hash giống → trả lại kết quả đã lưu; hash khác → từ chối nghiêm trọng.
4. Nếu mới: validate allow-list, FK, business rules, expected version.
5. Thực hiện đúng một mutation nghiệp vụ.
6. Lưu kết quả + version mới vào ledger.
7. Commit đồng thời ledger và business change.

Nếu business operation lỗi và transaction rollback, ledger row của request mới cũng rollback. Retry cùng mutationId có thể chạy lại. Nếu server đã commit nhưng response thất lạc, retry trả lại result đã lưu. Ledger phải có retention đủ dài cho các thiết bị offline lâu ngày; không xóa chỉ vì quá một vài ngày.

Payload hash nên tính server-side từ JSONB canonical representation. Nếu dùng SHA-256 cần xác nhận extension `pgcrypto` có sẵn trên project; không dựa vào hash do client tự khai báo.

## 4. Change feed và tombstone có cursor ổn định

Đề xuất:
- Bảng `organization_sync_counters`: một dòng mỗi organization, giữ `last_sequence bigint`.
- Bảng `organization_changes`: `organization_id`, `sequence bigint`, `table_name`, `record_id`, `operation` (upsert/delete), `row_version` nullable, `changed_at`, `payload jsonb` hoặc tombstone metadata.
- Unique `(organization_id, sequence)`; index phục vụ `(organization_id, sequence)` và tra theo record.
- Không tạo FK từ change feed đến record nghiệp vụ vì delete phải giữ tombstone.

Trigger AFTER INSERT/UPDATE/DELETE trên bảng đồng bộ:
1. Lấy counter row của organization bằng UPDATE/row lock trong cùng transaction.
2. Tăng sequence và insert change row trong cùng transaction.
3. Với DELETE, ghi tombstone (table + record_id + version cuối + operation=delete), không cần giữ toàn bộ payload nếu không cần khôi phục.
4. Với INSERT/UPDATE, lưu snapshot row JSONB tại thời điểm thay đổi nếu muốn event replay chính xác; hoặc chỉ lưu ref/version nếu pull RPC đảm bảo trả snapshot hiện tại và cursor semantics được chứng minh. Không trộn hai mô hình.
5. Vì counter row bị khóa tới COMMIT, transaction tiếp theo cùng organization không thể cấp sequence cao hơn rồi commit trước transaction trước; tránh lỗ hổng cursor do sequence cấp trước nhưng commit đảo thứ tự. Không dùng PostgreSQL sequence độc lập làm cursor commit-order.

Pull RPC:
- Input: organization context đã xác thực, `p_after_sequence`, `p_limit` có giới hạn.
- Lấy high-water mark và trả các change có sequence > cursor theo thứ tự tăng dần.
- Cursor tiếp tục chỉ được lưu local sau khi toàn bộ page đã apply thành công trong một Dexie transaction.
- Nếu feed chứa snapshot event, apply theo thứ tự; nếu feed chỉ chứa record refs, phải định nghĩa rõ latest-state coalescing và cách xử lý update/delete xen kẽ.
- Không cho pull ghi đè record có local mutation pending/processing/conflict; tạo conflict state thay vì overwrite.
- Delete chỉ được áp dụng khi tombstone sequence/version mới hơn trạng thái local đã biết.
- Cursor riêng theo device/install; không chia sẻ cursor giữa desktop và mobile.

Retention:
- Không xóa change rows chưa được các thiết bị hoạt động xác nhận. Cần device cursor/last_seen và chính sách thiết bị mất lâu ngày.
- Khi cursor quá cũ so với retention, trả `resync_required`; không âm thầm trả page rỗng.
- Full resync là luồng riêng có snapshot boundary/high-water mark, không phải tải tất cả rồi cập nhật cursor tùy ý.

## 5. RPC inventory – hợp đồng cần chốt

### Tạo vật tư + tồn đầu kỳ

RPC tạo item phải insert inventory metadata, ghi opening movement (nếu số tồn đầu kỳ khác 0), cập nhật balance và ledger idempotency cùng transaction. Thu hồi direct INSERT inventory_items để không bypass.

### Nhập / Xuất / Điều chỉnh

RPC nhận tối thiểu:
- organization_id từ context đã xác thực
- item_id
- movement_id (UUID ổn định)
- mutation_id
- movement_date
- movement_type
- quantity/delta theo hợp đồng nghiệp vụ đã chốt
- reason
- linked_asset_id nullable
- expected item row_version nếu nghiệp vụ cần phát hiện chỉnh metadata đồng thời

Transaction:
1. Kiểm tra `inventory.adjust` và organization membership.
2. Idempotency ledger.
3. SELECT inventory_items row FOR UPDATE theo organization_id + item_id.
4. Validate quantity/delta, movement type, linked asset FK và số tồn sau giao dịch >= 0.
5. Tính balance phía DB, không nhận balance mới do client gửi.
6. Update quantity + row_version.
7. Insert đúng một inventory_movements row.
8. Lưu ledger result; commit tất cả hoặc rollback tất cả.

Cấm REST insert movement và cấm direct update quantity. Không tạo hai request riêng cho balance và movement.

**Điểm chưa chốt:** “Điều chỉnh” tăng/giảm theo signed delta hay đặt số tồn thực tế; hiện UI local đang giảm tồn cho loại này. Cần sửa hợp đồng nghiệp vụ/UI đồng bộ trước khi viết migration/RPC.

## 6. Permission, RLS và bảng nội bộ

- Mọi RPC dùng `SECURITY DEFINER` chỉ khi thật cần, `SET search_path = ''`, schema-qualify toàn bộ đối tượng và kiểm tra `auth.uid()`.
- Kiểm tra permission theo từng hành động: assets.create/import/update/delete, inventory.create/adjust, task/plan/checklist/log tương ứng.
- Không cho client ghi trực tiếp ledger, counter, change feed.
- Trigger nội bộ cần quyền ghi cần thiết mà không mở quyền trực tiếp cho authenticated.
- Rà soát cả GRANT và RLS; RLS policy cho phép không đồng nghĩa đã cấp SQL privilege, và GRANT INSERT rộng vẫn có thể mở lối nghiệp vụ ngoài ý muốn.
- Không đưa organization_id từ payload queue làm nguồn thẩm quyền. RPC xác minh membership/permission trước khi ghi.

## 7. Thứ tự triển khai đề xuất

1. Chốt nghiệp vụ movement “Điều chỉnh” và cách tạo vật tư/tồn đầu kỳ.
2. Review schema và migration delta: row_version, mutation ledger, counter/change feed, tombstone, log fields; xử lý direct INSERT inventory_items.
3. Viết SQL integration tests: duplicate mutation, payload mismatch, transaction rollback, conflict, trigger sequence commit-order, tombstone, permission revoked, cross-org.
4. Chạy SQL thủ công trên BAOTRI-Mini-Test sau khi người dùng duyệt; không tự chạy.
5. Kiểm thử RPC bằng test SQL và ứng dụng, chưa bật worker.
6. Hoàn thiện Dexie queue v7 và tests race/restart.
7. Chỉ khi tất cả đạt mới xây worker push/pull; Production cần phê duyệt riêng.

## 8. Các giới hạn hiện tại

Tài liệu này chỉ ghi thiết kế. Không tạo migration SQL, không sửa quyền trên database, không chạy SQL, không gọi RPC, không bật worker, không sửa dữ liệu local hoặc Cloud. Các migration 002/006/012 hiện có được review tĩnh; không được coi thiết kế này là đã áp dụng.
