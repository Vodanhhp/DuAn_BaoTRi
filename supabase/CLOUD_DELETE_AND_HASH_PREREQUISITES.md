# BAOTRI Mini – Điều kiện tiên quyết: hash, xóa và tombstone

Cập nhật: 18/11/2026
Trạng thái: review tĩnh repository; chưa truy cập database runtime.

## 1. Hash extension: chưa đủ bằng chứng để chọn hàm

- Đã tìm toàn bộ các migration hiện có trong repository: không thấy câu lệnh `CREATE EXTENSION pgcrypto`, cũng chưa thấy hàm `digest(..., 'sha256')` hoặc helper hash tương đương.
- Điều này chỉ chứng minh repository chưa khai báo extension; không chứng minh pgcrypto chưa được bật sẵn trên Supabase project.
- Vì vậy chưa được viết migration ledger phụ thuộc `digest` cho đến khi kiểm tra `pg_extension` trên BAOTRI-Mini-Test hoặc xác minh môi trường Supabase cụ thể.
- Không dùng `md5` làm phương án thay thế cho hash bảo vệ idempotency. Nếu không thể dùng pgcrypto, cần chọn giải pháp hash mật mã được hỗ trợ và review riêng.
- Hash phải được tạo từ canonical payload do server chuẩn hóa; không nhận hash client làm căn cứ.

## 2. Quan hệ FK hiện tại và ảnh hưởng delete

Từ migration `20261117000200_business_schema.sql`, các quan hệ chính đều dùng `ON DELETE RESTRICT`:

- `maintenance_tasks.asset_id` → assets.
- `maintenance_plans.asset_id` → assets.
- `checklist_templates.asset_id` → assets.
- `checklist_template_versions` → checklist_templates (kèm asset).
- `checklist_results` → assets, checklist_templates và checklist_template_versions.
- `maintenance_logs` → assets, maintenance_tasks và checklist_results.
- `inventory_movements.item_id` → inventory_items; `asset_id` → assets (nullable).
- `asset_images.asset_id` → assets.

Do đó:
- Không thể hard-delete thiết bị đã có task, plan, Checklist, log, movement hoặc ảnh liên kết.
- Không thể hard-delete vật tư đã có movement.
- Không thể hard-delete task đã được log tham chiếu.
- Không thể xóa template/version đang được result tham chiếu.
- Đây là bảo vệ lịch sử có chủ đích; không đổi FK sang CASCADE để “dọn dữ liệu”.

## 3. Đề xuất semantics delete

### Thiết bị
- Dùng trạng thái vòng đời hiện có (Lưu kho/Ngừng sử dụng/Thanh lý) cho các trường hợp nghiệp vụ tương ứng.
- `archived_at` hiện có nhưng chưa đủ phân biệt archive/restore với tombstone xóa đồng bộ.
- Nếu cần xóa logic khỏi danh sách mà vẫn giữ lịch sử, bổ sung `deleted_at` hoặc trạng thái xóa riêng; giữ row để FK và lịch sử còn nguyên.
- Restore là mutation riêng, tăng row_version và phát change event mới; không xóa tombstone cũ khỏi change feed.

### Vật tư
- Không hard-delete vật tư đã có movement.
- Đề xuất `deleted_at`/inactive flag; chặn thao tác kho mới khi đã ngừng hoạt động, vẫn cho xem lịch sử.
- Xóa vật tư chưa từng phát sinh movement có thể cân nhắc hard-delete, nhưng để đồng nhất sync nên ưu tiên soft-delete.

### Công việc/kế hoạch
- Cần xác định xóa là hủy/ẩn hay xóa vĩnh viễn. Task có thể bị maintenance_logs tham chiếu; plan hiện chưa có FK từ history nhưng vẫn cần audit.
- Đề xuất soft-delete/cancel state và change event, không hard-delete mặc định.

### Checklist và lịch sử
- Không xóa template/version/result/log đã được sử dụng.
- Ngừng kích hoạt template bằng `active=false`; version và result giữ nguyên.
- Checklist result, maintenance log và inventory movement là append-only; không update/delete lịch sử qua client.

## 4. Tombstone và retention

- Tombstone phải là sự kiện bền vững trong change feed, không phụ thuộc row nghiệp vụ bị hard-delete.
- Với soft-delete, change feed chứa snapshot/tombstone metadata; pull client đánh dấu record đã xóa/ẩn mà không xóa lịch sử.
- Không purge tombstone khi còn client có thể quay lại với cursor cũ.
- Nếu cần purge dữ liệu/tombstone, phải có retention window, client cursor expiry và luồng resync_required được kiểm thử.
- Không coi `archived_at` là deleted_at: lưu kho và xóa đồng bộ là hai ý nghĩa khác nhau.

## 5. RPC allocator hiện tại và idempotency

- `create_asset_with_code` đã kiểm tra auth và `assets.create`, cấp code theo counter và nhận `p_id`.
- RPC chưa nhận `mutation_id` và chưa có idempotency ledger; gọi lại với cùng p_id sau khi request trước đã commit có thể gặp duplicate primary key thay vì trả response cũ.
- Khi bọc RPC này bằng idempotency, ledger phải cùng transaction với việc cấp counter và insert asset; retry cùng mutationId không được tăng counter hoặc cấp mã thứ hai.
- RPC import thiết bị từ local là luồng khác, phải bảo toàn UUID + code local, kiểm tra uniqueness và permission; không biến allocator hiện tại thành import bằng cách nhận code tùy ý.

## 6. Trạng thái và việc cần xác minh

- Chưa có bằng chứng runtime về pgcrypto hoặc các extension hash đang bật.
- Chưa chạy truy vấn metadata database; không gọi SQL và không thay đổi Test/Production.
- Chưa tạo migration cho deleted_at, tombstone, ledger hoặc RPC.
- Trước khi viết SQL draft:
  1. Người vận hành xác minh extension/hash trên Test bằng truy vấn chỉ đọc.
  2. Chốt semantics xóa/ẩn/lưu kho cho từng phân hệ.
  3. Chốt chính sách retention và resync.
  4. Thiết kế test cho allocator retry, soft-delete/restore và FK history.

## 7. Quy tắc an toàn

Không thay đổi FK hiện hữu sang CASCADE; không hard-delete dữ liệu có lịch sử; không xóa dữ liệu Test/Production; không chạy SQL/migration khi chưa được phê duyệt.
