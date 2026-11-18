# BAOTRI Mini – Thiết kế RPC nghiệp vụ Kho vật tư

Cập nhật: 18/11/2026
Trạng thái: review thiết kế; chưa tạo migration, chưa chạy SQL, chưa gọi Supabase.

## 1. Hiện trạng đã đối chiếu

### Local UI và IndexedDB
- `ItemModal` hiện cho phép nhập/sửa trực tiếp trường `quantity` cùng các metadata của vật tư.
- `saveItem()` ghi toàn bộ `InventoryItem` bằng `putAndQueue`; nếu sửa số lượng, không tự sinh movement tương ứng.
- Nút Nhập/Xuất dùng `addMovement()`: cập nhật `inventory.quantity` và thêm `Movement` trong cùng Dexie transaction, sau đó queue cả inventory item và movement.
- Nút thao tác hiện có chỉ là Nhập và Xuất; chưa có giao diện Điều chỉnh riêng.
- Xuất vượt tồn bị chặn ở client; backend vẫn phải tự kiểm tra lại dưới row lock.

### Cloud schema và quyền
- `inventory_items.quantity` là số tồn hiện tại, không phải lịch sử.
- `inventory_movements` là lịch sử append-only, quantity của từng movement luôn dương; loại hiện được định nghĩa là Nhập/Xuất/Điều chỉnh.
- RLS/grants hiện tại vẫn cho authenticated INSERT `inventory_items`; đường này có thể đặt quantity khác 0 mà không tạo movement.
- Mapper metadata đã chủ ý loại quantity; movement không được đồng bộ trực tiếp bằng upsert.
- Technician có `inventory.create`, `inventory.update`, `inventory.adjust`; quyền xóa vật tư là Admin-only.

## 2. Nguyên tắc bắt buộc trước Cloud worker

1. Không cho client ghi trực tiếp `inventory_items.quantity`.
2. Không cho client INSERT trực tiếp `inventory_movements`.
3. Mọi thay đổi số tồn phải cập nhật balance và thêm movement trong cùng PostgreSQL transaction.
4. Mọi mutation phải có `mutation_id` ổn định, idempotency ledger và server tự kiểm tra quyền.
5. Không dùng upsert đồng bộ trực tiếp cho inventory item nếu payload có quantity.
6. Metadata update phải dùng `expected_version`, không nhận trường quantity.
7. Client chỉ cập nhật IndexedDB sau khi nhận response Cloud hợp lệ; conflict không được tự ghi đè.

## 3. Các RPC cần thiết

### A. `create_inventory_item`
Đầu vào:
- organization_id, item_id, mutation_id
- code, name, item_group, unit, part_number, size
- initial_quantity, min_quantity, location, supplier, unit_price

Transaction:
1. Xác thực user, membership active, permission `inventory.create`.
2. Claim idempotency key và kiểm tra payload hash.
3. Kiểm tra mã vật tư và UUID chưa tồn tại trong organization.
4. Tạo inventory item với balance ban đầu.
5. Nếu initial_quantity > 0, tạo một movement loại `Nhập`, reason cố định/được chuẩn hóa là `Tồn đầu kỳ`, dùng ID do client cấp ổn định hoặc ID được ghi trong idempotency result.
6. Ghi change event cho item và movement trong cùng transaction.
7. Lưu response idempotency và trả item + opening movement.

Ghi chú: tạo vật tư và ghi nhận tồn đầu kỳ là một nghiệp vụ tạo mới; không được tách thành hai request có thể thành công/thất bại riêng. Chính sách quyền cụ thể cho tồn đầu kỳ phải được xác nhận trong permission catalog trước khi viết SQL.

### B. `update_inventory_item_metadata`
- Yêu cầu expected_version và mutation_id.
- Chỉ nhận code/name/group/unit/part_number/size/min_quantity/location/supplier/unit_price.
- Tuyệt đối không nhận quantity, organization_id, id, row_version hoặc timestamps.
- Kiểm tra `inventory.update`, lock row, so version, update metadata, ghi event và idempotency cùng transaction.

### C. `post_inventory_movement`
Đầu vào:
- organization_id, item_id, movement_id, mutation_id
- movement_type (Nhập hoặc Xuất trong phiên bản đầu)
- quantity > 0, movement_date, reason, linked_asset_id (nếu có)
- expected_version của inventory item

Transaction:
1. Xác thực user/membership và permission `inventory.adjust`.
2. Claim idempotency key.
3. Lock inventory row bằng SELECT FOR UPDATE theo organization_id + item_id.
4. So sánh expected_version.
5. Tính balance server-side: Nhập cộng; Xuất trừ.
6. Từ chối Xuất nếu balance âm.
7. Cập nhật balance và row_version.
8. Insert movement append-only.
9. Ghi change event cho inventory item và movement; lưu idempotency response.
10. Commit tất cả cùng nhau.

Retry cùng mutation_id trả response đã lưu, không cộng/trừ tồn lần hai.

### D. Xóa vật tư
- Admin-only; phải kiểm tra FK movement trước khi xóa.
- Nếu đã có movement, không hard-delete; ưu tiên trạng thái lưu kho/ngừng sử dụng hoặc quy trình lưu trữ riêng.
- Không dùng cascade để xóa lịch sử.

## 4. Điều chỉnh tồn kho – chưa chốt nghiệp vụ

UI hiện tại chưa có thao tác Điều chỉnh riêng, dù database đã cho phép movement_type = Điều chỉnh. Không tự triển khai loại này trước khi chốt:
- Điều chỉnh nhập số lượng tăng/giảm hay nhập số tồn thực tế sau kiểm kê?
- Nếu nhập số tồn thực tế, server phải tính delta so với balance hiện tại dưới row lock; movement cần lưu dấu tăng/giảm rõ ràng.
- Lý do kiểm kê/điều chỉnh có bắt buộc không?
- Permission `inventory.adjust` có đủ hay cần quyền riêng?

Trong giai đoạn đầu, RPC movement chỉ nên hỗ trợ Nhập và Xuất.

## 5. Sửa UI cần có trước khi bật Cloud sync

- Khi tạo vật tư mới: trường Số lượng tồn được hiểu là tồn đầu kỳ và phải sinh movement mở kho tương ứng.
- Khi sửa vật tư đã tồn tại: khóa trường Số lượng tồn; thay đổi số tồn chỉ qua Nhập/Xuất (và sau này là Điều chỉnh).
- Nếu người dùng cần thay đổi tồn ban đầu do nhập sai, phải tạo movement điều chỉnh có lý do/audit; không sửa balance trực tiếp.
- Cập nhật kiểm tra permission UI theo quyền cụ thể thay vì chỉ phân biệt Viewer/non-Viewer.
- Giữ local transaction atomic giữa item balance và movement; queue hai record cùng mutation group để worker không đẩy movement trước item hoặc ngược lại.

## 6. Những điểm chưa được phép giả định

- Chưa xác nhận runtime pgcrypto/hash extension; không viết hash implementation phụ thuộc extension trước khi có kết quả kiểm tra read-only trên Test.
- Chưa chốt cách lưu response/payload idempotency và retention.
- Chưa chốt đầy đủ quyền tạo tồn đầu kỳ trong catalog.
- Chưa chốt ngữ nghĩa Điều chỉnh.
- Chưa có Cloud worker, chưa sync dữ liệu inventory.
- Không chạy SQL/migration hoặc ghi dữ liệu lên Supabase Test/Production trong bước thiết kế này.

## 7. Kết luận

Rủi ro lớn nhất hiện tại không chỉ là movement RPC chưa có: UI cho sửa trực tiếp quantity khi sửa vật tư. Cần tách metadata khỏi balance ngay trong thiết kế Cloud; trước khi bật worker, phải có RPC tạo vật tư + tồn đầu kỳ, RPC metadata không có quantity, và RPC Nhập/Xuất transaction-safe.