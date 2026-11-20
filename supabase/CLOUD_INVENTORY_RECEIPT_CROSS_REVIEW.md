# BAOTRI Mini — Cross-review Shared Receipt và create_inventory_item

Ngày: 19/11/2026  
Trạng thái: tài liệu review/điều phối thiết kế; không phải SQL thực thi.

## 1. Kết luận kiến trúc

Giữ nguyên hướng Cloud-first đã chốt:

- Cloud transaction là nơi xác nhận mutation nghiệp vụ.
- Shared Receipt là idempotency record cho một logical mutation.
- Item, Movement (nếu có), Receipt và change events phải commit/rollback cùng transaction.
- Local chỉ cập nhật business snapshot sau khi nhận xác nhận Cloud; timeout không rõ kết quả thì retry đúng mutation_id và payload cũ.
- Không bật cutover khi các schema dependency, RPC và change feed chưa hoàn chỉnh.
- Asset-specific Receipt/Lease vẫn giữ nguyên trong giai đoạn chuyển tiếp; không dual-write.

Hai tài liệu 020 và create_inventory_item nhìn chung tương thích. Các điểm dưới đây được chốt để tránh thiết kế tiếp tục đổi hướng.

## 2. Chính sách Shared Receipt được chốt

### 2.1 Replay

- Xác thực Auth, organization active và membership active trước khi replay.
- Cùng actor + cùng organization + cùng operation + cùng fingerprint: replay read-only.
- Replay không yêu cầu lại write permission đã dùng lúc mutation đầu tiên.
- Nếu actor mất quyền đọc cần thiết, chỉ trả acknowledgement tối thiểu và refs; không trả snapshot.
- Actor khác, organization khác, membership inactive hoặc organization inactive: từ chối mà không tiết lộ Receipt có tồn tại hay không.
- Nếu lần tra Receipt đầu tiên không thấy nhưng write permission bị từ chối, RPC tra lại Receipt trong statement riêng để xử lý race. Chỉ replay khi đủ actor/fingerprint/membership/read checks; nếu không có Receipt thì vẫn từ chối.

### 2.2 Quyền đọc nhiều record

Chọn chính sách **all-or-nothing** cho Shared Receipt ở giai đoạn hiện tại: chỉ trả toàn bộ snapshot khi actor hiện có tất cả quyền đọc được ghi trong `read_permission_codes`; nếu thiếu bất kỳ quyền nào thì chỉ trả acknowledgement tối thiểu.

Lý do: đơn giản, an toàn, tránh vô tình rò rỉ một phần dữ liệu của mutation nhiều record. Riêng create_inventory_item chỉ tác động Item và tối đa một Movement, cả hai cùng được bảo vệ bởi `inventory.view`.

### 2.3 Khóa tenant và thời điểm hiệu lực

- Thứ tự khóa thống nhất: Organization trước, Membership sau.
- Dùng row lock đủ mạnh để UPDATE trạng thái hoặc DELETE membership/organization phải chờ mutation/replay đang xử lý kết thúc; dự kiến `FOR SHARE`, phải xác minh bằng test trên database mục tiêu.
- Với quyền nghiệp vụ, xác định hiệu lực tại thời điểm RPC kiểm tra quyền. Thu hồi quyền xảy ra sau thời điểm authorization không hủy hồi tố mutation đã được authorize.
- Không dùng `FOR KEY SHARE` thay cho `FOR SHARE` nếu mục tiêu là chặn UPDATE status không thay đổi khóa chính.

### 2.4 Fingerprint

Mỗi RPC tự dựng fingerprint phía server từ allowlist đã chuẩn hóa. Tối thiểu gồm organization, operation version, actor scope, resource IDs, expected version/revision và payload nghiệp vụ.

Không nhận từ client: fingerprint, actor, read permissions, affected refs hoặc result payload.

Quy tắc chuẩn hóa phải được ghi ngay trong từng RPC contract:
- Text: trim; quy định rõ NULL và chuỗi rỗng.
- Numeric: kiểm tra hữu hạn, scale và miền giá trị; không chỉ dựa vào CHECK >= 0 vì numeric NaN có thể cần xử lý riêng.
- Date/enum: dùng kiểu và giá trị chuẩn; không tự suy đoán ngày nghiệp vụ.
- Array: thứ tự có ý nghĩa thì giữ nguyên; nếu không có ý nghĩa thì chuẩn hóa thứ tự trước khi fingerprint.
- Operation code phải có version, ví dụ `inventory.item.create.v1`; thay đổi ý nghĩa payload thì tăng version.

## 3. Cross-review create_inventory_item

### 3.1 Phần phù hợp

- Admin và Technician dùng `inventory.create` để tạo Item và khai báo tồn đầu kỳ.
- `initial_quantity >= 0`; bằng 0 thì không tạo Movement giả.
- Lớn hơn 0 thì tạo đúng một Movement `Nhập`, reason `Tồn đầu kỳ`, cùng transaction.
- Movement lưu quantity dương; `quantity_delta` là signed delta; `balance_before = 0`, `balance_after = initial_quantity`.
- Actor/audit lấy từ `auth.uid()`; không tin actor từ client.
- row_version do database quản lý; client không được truyền.
- Replay theo Shared Receipt; timeout dùng lại cùng mutation_id.
- Item + Movement + Receipt + events atomic.

### 3.2 Sửa cách diễn đạt kiểm tra Item ID

Schema hiện tại khai báo `inventory_items.id` là PRIMARY KEY toàn bảng, không chỉ duy nhất trong organization. Vì vậy RPC phải xử lý collision ID trên toàn bảng, không chỉ SELECT trong organization.

Nếu ID đã được dùng ở organization khác, chỉ trả conflict tổng quát, không tiết lộ organization hay dữ liệu của row đang tồn tại.

### 3.3 Chuẩn hóa mã vật tư

Chọn quy tắc:
- Lưu `code` hiển thị sau khi trim, giữ nguyên kiểu chữ người dùng nhập.
- Khóa so sánh uniqueness là `upper(btrim(code))` trong cùng organization.
- Vì vậy `vt-001`, `VT-001` và ` VT-001 ` được xem là cùng mã.
- Trước khi bật RPC phải chạy duplicate preflight read-only; chỉ thêm unique expression index sau khi dữ liệu trùng đã được xử lý và migration được duyệt.
- Không tự đổi code hiển thị của dữ liệu cũ trong quá trình tạo unique index.

Schema hiện có ghi chú dữ liệu phát triển có hai mã VT-001 và chưa tạo unique constraint. Không được bỏ qua preflight.

### 3.4 Xử lý unique collision để vẫn finalize Receipt conflict

Không chỉ SELECT trước khi INSERT vì hai request đồng thời vẫn có thể cùng vượt qua preflight.

Thiết kế RPC phải:
1. Có unique constraint/index làm lớp bảo vệ cuối cùng cho ID và normalized code.
2. Dùng INSERT Item với `ON CONFLICT DO NOTHING RETURNING` để không làm transaction rơi vào trạng thái aborted vì unique collision dự kiến.
3. Nếu không insert được, dùng statement kế tiếp để phân loại collision theo ID hoặc normalized code.
4. Finalize Receipt thành `conflict` với thông tin tối thiểu; không trả snapshot hoặc ID của Item khác.
5. Không tạo Movement hay change event khi Item insert không thành công.
6. Các lỗi constraint/FK/check khác ngoài collision dự kiến vẫn phải rollback toàn bộ transaction; không nuốt lỗi tùy tiện.

Nếu có thêm unique constraint khác trong tương lai, phải cập nhật phân loại conflict và test tương ứng.

### 3.5 Movement ID và Movement audit

- `p_opening_movement_id` bắt buộc khi initial_quantity > 0; null khi bằng 0.
- Movement ID cũng là UUID ổn định qua retry; collision không được làm lộ dữ liệu row khác.
- Draft 018 thêm audit fields nullable để giữ tương thích legacy; row mới từ RPC phải điền đủ các field bắt buộc.
- `expected_item_version` null cho opening Movement vì Item được tạo trong cùng transaction.
- `movement_date` có thể null theo schema hiện tại; không tự gán ngày nếu UI không cung cấp.
- `reason` trong schema hiện tại NOT NULL nhưng default rỗng; RPC vẫn phải ghi reason không rỗng.

## 4. Phát hiện cần xử lý ở các draft hiện tại

### 4.1 Draft 018 có lỗi ký tự

Trong `supabase/drafts/018_inventory_movement_audit_fields_DRAFT.sql`, dòng khai báo `expected_item_version bigint` đang có chuỗi ký tự `\\n` được ghi trực tiếp trước `add column performed_by_label text`, thay vì xuống dòng thật.

Đây là lỗi cú pháp cần sửa trong bản draft trước khi review SQL tiếp. Tài liệu này chỉ ghi nhận; không tự sửa draft SQL hoặc chạy SQL.

### 4.2 Draft 015 row_version

Draft 015 phù hợp làm nền tảng row_version cho các bảng mutable, nhưng chỉ có tác dụng chống lost update khi mọi đường UPDATE nghiệp vụ được chuyển qua RPC kiểm tra expected version. Không được coi việc thêm cột/trigger đơn thuần là hoàn tất optimistic concurrency.

Trước khi bật create_inventory_item:
- Xác nhận row_version đã có trên inventory_items.
- INSERT Item phải để trigger đặt version 1.
- Không nhận row_version từ client.
- Response và Receipt snapshot phải lấy version thực tế từ row vừa insert.

### 4.3 Draft 020 Receipt

Cấu trúc Receipt phù hợp để tiếp tục. Trước khi promote cần:
- Hoàn tất kiểm thử lock organization/membership và lock ordering.
- Hoàn tất replay race sau permission-denied.
- Giữ all-or-nothing read policy.
- Kiểm tra trigger finalization, quyền owner/RLS, SECURITY DEFINER và EXECUTE grants trên Supabase Test.
- Chốt retention; không cleanup Receipt trong giai đoạn đầu.

## 5. Trình tự phụ thuộc đã chốt

1. Sửa lỗi định dạng trong draft 018 và review lại toàn bộ constraint.
2. Review/hoàn tất draft 015 row_version; xác minh các bảng và trigger.
3. Review/hoàn tất draft 020 Shared Receipt theo chính sách tại mục 2.
4. Read-only duplicate preflight cho inventory code; xử lý dữ liệu trùng và tạo uniqueness theo normalized code trong migration được duyệt.
5. Xác định change feed schema/event contract.
6. Viết SQL/RPC create_inventory_item theo thiết kế đã cross-review.
7. Kiểm thử transaction, collision, idempotency, replay, quyền và rollback trên môi trường Test.
8. Chỉ sau khi vertical slice đạt kiểm thử mới lập kế hoạch Local cutover; chưa bật đồng bộ đại trà.

## 6. Phạm vi không được tự động thực hiện

- Không apply bất kỳ draft/migration nào lên Supabase.
- Không sửa grants, RLS, dữ liệu hoặc gọi RPC.
- Không thay đổi code UI, IndexedDB, syncQueue hoặc worker.
- Không chuyển Asset sang Shared Receipt hoặc dual-write.
- Không coi migration trong GitHub là bằng chứng migration đã được apply trên database.

Tài liệu này thống nhất cách hiểu giữa các thiết kế; mọi thay đổi SQL thực thi, code hoặc dữ liệu vẫn cần phê duyệt riêng.

## 6. Re-review Draft 018 — 20/11/2026

Finding về literal `\\n` trong ALTER TABLE đã được sửa trong `supabase/drafts/018_inventory_movement_audit_fields_DRAFT.sql`. Re-review bổ sung guard `NaN` cho các cột numeric (kể cả quantity cũ) và dùng regex để reason không thể chỉ chứa whitespace.

Đã chạy thử DDL + constraint trên BAOTRI-Mini-Test trong transaction rollback với temp table LIKE schema thật. Legacy row, Nhập, Xuất, Điều chỉnh về 0 pass; NaN, delta 0, whitespace-only reason, partial audit snapshot và balance âm đều bị reject. Sau rollback xác nhận không có cột mới, không có Movement row và migration history không đổi.

Draft vẫn là DRAFT ONLY. Chưa apply schema. Các điều kiện còn lại: preflight duplicate `(organization_id, mutation_id)` trên dataset thực, RPC bắt buộc expected_item_version cho Item đã tồn tại, kiểm tra numeric scale/range tại RPC, và đồng bộ với Shared Receipt + row_version trước cutover.

## 7. Shared Receipt deferred guard — test result 20/11/2026

Đã bổ sung role `baotri_receipt_guard` NOLOGIN/NOBYPASSRLS/NOINHERIT, SELECT-only trên Receipt qua policy RLS riêng. Deferred assertion function chạy SECURITY DEFINER dưới owner role này, `search_path = ''`, không dùng `row_security = off`. Không cấp SELECT/EXECUTE cho client; guard không là member của anon/authenticated/service_role. Membership guard → postgres do Supabase managed grantor cấp để ownership transfer được giữ; postgres vốn là DB admin role.

Đã chạy DDL + probe RPC trên BAOTRI-Mini-Test trong transaction rollback. Finalized Receipt pass deferred check; pending Receipt bị chặn; authenticated SELECT Receipt bị từ chối. Owner, role flags và grants pass. Sau rollback, table/role không tồn tại và migration history không đổi.

Đây là xác minh phương án quyền trigger, không phải triển khai Shared Receipt. Draft vẫn cần replay-race, lock-order, business RPC authorization và concurrency review trước promotion.
