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

## 8. Quyết định nghiệp vụ đã được người dùng chốt (19/11/2026)

Trạng thái: **ĐÃ CHỐT**. Nội dung mục này thay thế các câu hỏi “chưa chốt” tương ứng ở các mục trước.

### 8.1 Ngữ nghĩa Điều chỉnh
- Người dùng nhập `counted_quantity`: số tồn thực tế sau kiểm kê, không nhập delta.
- Cho phép số tồn thực tế bằng 0; không nhận số âm.
- RPC khóa dòng `inventory_items`, kiểm tra `expected_version`, đọc balance hiện tại rồi tính:
  `quantity_delta = counted_quantity - balance_before`.
- Nếu delta = 0: trả `no_change`, không tạo movement, không tăng row_version và không phát change event. Không lưu biên bản kiểm kê không chênh lệch.
- Nếu delta khác 0: cập nhật balance = counted_quantity; ghi movement loại `Điều chỉnh` trong cùng transaction.
- Movement mới phải thể hiện rõ `counted_quantity`, `balance_before`, `balance_after`, `quantity_delta` có dấu. Giữ `quantity` cũ dương theo semantics lượng tuyệt đối (`abs(quantity_delta)`) để tương thích CHECK hiện tại; không dùng cột quantity cũ để lưu số âm. Các cột mới cần nullable cho legacy row nếu không thể tái dựng lịch sử đáng tin cậy; không bịa balance trước/sau cho movement cũ.
- Bắt buộc reason không rỗng; server ghi actor, timestamp, mutation_id và expected version. Balance, movement, receipt và change events commit/rollback cùng nhau.
- Permission dùng `inventory.adjust` hiện có cho Admin/Technician; không thêm permission riêng.

### 8.2 Tồn đầu kỳ khi tạo vật tư
- Technician được phép nhập tồn đầu kỳ khi tạo vật tư; Admin cũng được phép.
- Tồn đầu kỳ là một phần của giao dịch `create_inventory_item`, được cho phép bởi `inventory.create`; không cần một mutation điều chỉnh độc lập.
- Tạo Item + opening movement loại `Nhập` với reason chuẩn hóa `Tồn đầu kỳ` (khi initial_quantity > 0) + receipt + change events trong một transaction.
- Nếu initial_quantity = 0: tạo Item nhưng không tạo movement giả có quantity 0.
- Không cho sửa quantity trực tiếp ở metadata update; điều chỉnh tồn về sau phải qua movement/RPC.

### 8.3 Hợp đồng RPC cập nhật
- `create_inventory_item`: yêu cầu `inventory.create`; nhận initial_quantity >= 0; giữ ID ổn định do client cung cấp; trả item và opening movement (nếu có).
- `update_inventory_item_metadata`: yêu cầu `inventory.update`; không nhận quantity.
- `post_inventory_movement`: Nhập/Xuất, yêu cầu `inventory.adjust`; quantity > 0; server tính balance; Xuất không được làm âm tồn.
- `adjust_inventory_count`: yêu cầu `inventory.adjust`; nhận counted_quantity >= 0, reason bắt buộc, expected_version, movement_id, mutation_id. Lock row và tính delta server-side. Delta 0 trả no_change, không phát sinh movement.
- Mỗi RPC sử dụng shared `organization_mutations` receipt/idempotency contract; replay đúng mutation trả kết quả cũ, không lặp side effect. Không tự tạo mutation ID mới khi outcome chưa rõ.

### 8.4 Phần còn phải thiết kế/kiểm thử
- Chọn tên và kiểu dữ liệu chính xác cho các cột movement bổ sung; thiết kế backfill không giả lập dữ liệu lịch sử.
- Xác định row_version migration và cách lấy expected_version cho Item.
- Xác minh unique code hiện tại: schema hiện chưa có unique (organization_id, code); create RPC phải kiểm tra trùng dưới cơ chế chống race và bổ sung constraint phù hợp sau khi xử lý dữ liệu trùng hiện có.
- Chưa sửa SQL/migration, UI, RPC hoặc dữ liệu; chưa chạy Supabase SQL/runtime test.


## 9. Hợp đồng request/response chi tiết (thiết kế)

### 9.1 Quy tắc chung
- Mọi request có `organization_id`, `mutation_id` UUID ổn định; server luôn lấy actor từ `auth.uid()`, không nhận actor từ client.
- `organization_id` client gửi chỉ là scope yêu cầu; server phải xác minh membership active và quyền trong đúng organization.
- Mọi request update balance có `expected_version`; không tự rebase payload cũ khi conflict.
- Response thành công trả canonical snapshot từ Cloud, không lấy lại payload client làm nguồn xác nhận.
- Shared Receipt lưu kết quả `applied`, `no_change` hoặc `conflict` để retry cùng mutation_id cho kết quả ổn định. Mutation ID đã dùng không được tái sử dụng cho payload khác.

### 9.2 Request theo nghiệp vụ

| RPC | Các trường nghiệp vụ bắt buộc | Permission |
|---|---|---|
| `create_inventory_item` | `item_id`, `mutation_id`, `code`, `name`, metadata allowlist, `initial_quantity >= 0` | `inventory.create` |
| `update_inventory_item_metadata` | `item_id`, `mutation_id`, `expected_version`, metadata allowlist; không có quantity | `inventory.update` |
| `post_inventory_movement` | `item_id`, `movement_id`, `mutation_id`, `expected_version`, `movement_type` Nhập/Xuất, `quantity > 0`, `movement_date`, `reason`, optional `linked_asset_id` | `inventory.adjust` |
| `adjust_inventory_count` | `item_id`, `movement_id`, `mutation_id`, `expected_version`, `counted_quantity >= 0`, `movement_date`, nonblank `reason` | `inventory.adjust` |

### 9.3 Canonical response
- `status`: `applied` | `no_change` | `conflict`.
- `mutation_id`, `item_id`, `current_version`.
- `item`: canonical Item snapshot; luôn có khi request đã xác định được Item.
- `movement`: canonical Movement snapshot hoặc null (null khi create initial_quantity = 0 hoặc adjustment delta = 0).
- `balance_before`, `balance_after`, `quantity_delta` cho movement mới; không suy diễn các giá trị lịch sử không có trong database.
- Với conflict, trả canonical current Item snapshot và version; không ghi business mutation.
- Với lỗi Auth/permission/membership/validation/idempotency mismatch, RPC từ chối bằng lỗi phân biệt ổn định; không trả snapshot ngoài phạm vi quyền.
- `no_change` vẫn có Receipt để bảo đảm replay; không tăng row_version, không insert movement, không phát change event.

### 9.4 Transaction boundary
- Create: Item + optional opening Movement + Receipt + Change events (cho các row thực sự tạo) cùng transaction.
- Nhập/Xuất/Điều chỉnh có chênh lệch: Item balance/version + Movement + Receipt + Change events cùng transaction.
- Điều chỉnh không chênh lệch: Receipt `no_change` cùng transaction; không business row/event.
- Metadata update: Item + Receipt + Change event cùng transaction.
- Không có đường PostgREST trực tiếp cho quantity hoặc Movement. Local Dexie chỉ được cập nhật sau response Cloud hợp lệ; nếu response mất, replay cùng mutation ID.

### 9.5 Data integrity và legacy
- `quantity` movement giữ dương để tương thích constraint hiện tại; `quantity_delta` mới là signed delta chuẩn cho các Movement mới.
- Với Nhập: delta dương; Xuất: delta âm; Điều chỉnh: delta = counted - balance_before.
- `balance_before`, `balance_after`, `counted_quantity`, `quantity_delta` có thể NULL với dữ liệu legacy không đủ chứng cứ; các RPC mới bắt buộc ghi đầy đủ trường phù hợp.
- Không tự suy diễn opening balance của dữ liệu cũ từ danh sách movement nếu chưa chứng minh ledger đầy đủ.
