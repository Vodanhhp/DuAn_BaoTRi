# BAOTRI Mini — Thiết kế RPC create_inventory_item

Cập nhật: 19/11/2026  
Trạng thái: thiết kế nghiệp vụ/RPC để review; chưa viết SQL thực thi, chưa chạy Supabase.

## 1. Mục tiêu và phạm vi

Thiết kế RPC đầu tiên dùng Shared Receipt: `create_inventory_item`.

Một lần gọi phải tạo nguyên tử:
- Một Inventory Item với ID ổn định do Local/client cung cấp.
- Số dư ban đầu `initial_quantity >= 0`.
- Một Movement loại `Nhập`, lý do `Tồn đầu kỳ`, chỉ khi số dư ban đầu > 0.
- Một Shared Receipt cho toàn bộ logical mutation.
- Change event cho từng record thực sự được tạo.

Tất cả nằm trong một PostgreSQL transaction. Không có trường hợp Item được tạo nhưng opening Movement/Receipt/event thất bại mà Item vẫn tồn tại.

Không nằm trong phạm vi:
- Không triển khai các RPC metadata update, Nhập/Xuất, kiểm kê.
- Không chuyển Asset sang Shared Receipt.
- Không triển khai pull/changefeed worker hoặc Local Dexie cutover.
- Không thu hồi grants/RLS hiện hữu trong tài liệu thiết kế này.

## 2. Quyền và actor

- RPC yêu cầu `auth.uid() IS NOT NULL`.
- Yêu cầu organization tồn tại và `organizations.status = 'active'`.
- Yêu cầu đúng một membership của `auth.uid()` trong organization với `status = 'active'`.
- Yêu cầu `has_org_permission(p_organization_id, 'inventory.create') = true`.
- Theo quyết định nghiệp vụ ngày 19/11/2026, Admin và Technician được tạo Item và khai báo tồn đầu kỳ qua cùng quyền `inventory.create`.
- `actor_user_id` trong Receipt và `created_by_user_id` trong Movement luôn lấy từ `auth.uid()`; không nhận actor từ client.
- `performed_by_label` nếu có chỉ là nhãn hiển thị, không có giá trị phân quyền.

## 3. Hợp đồng đầu vào đề xuất

RPC nhận tham số có kiểu rõ ràng, không nhận JSON tùy ý:

| Tham số | Kiểu dự kiến | Quy tắc |
|---|---|---|
| `p_organization_id` | uuid | Scope yêu cầu; server xác minh membership |
| `p_item_id` | uuid | ID ổn định do Local tạo; giữ nguyên qua retry |
| `p_mutation_id` | uuid | Một ID cho toàn bộ logical mutation; giữ nguyên qua retry |
| `p_opening_movement_id` | uuid nullable | Bắt buộc khi initial_quantity > 0; null khi bằng 0 |
| `p_code` | text | Trim/normalize theo quy tắc mã được chốt trước migration |
| `p_name` | text | Trim; không rỗng |
| `p_item_group` | text | Metadata allowlist; mặc định chuỗi rỗng nếu UI không có |
| `p_unit` | text | Metadata allowlist; mặc định chuỗi rỗng nếu UI không có |
| `p_part_number` | text nullable | Metadata allowlist |
| `p_size` | text nullable | Metadata allowlist |
| `p_initial_quantity` | numeric(18,4) | >= 0; không nhận âm |
| `p_min_quantity` | numeric(18,4) | >= 0 |
| `p_location` | text | Metadata allowlist |
| `p_supplier` | text | Metadata allowlist |
| `p_unit_price` | numeric(18,2) | >= 0 |
| `p_movement_date` | date nullable | Chỉ dùng nếu UI cung cấp ngày tồn đầu kỳ; không tự suy đoán ngày nghiệp vụ |

Không nhận từ client: `actor_user_id`, `created_at`, `updated_at`, `row_version`, `balance_after`, `quantity_delta`, `result_status`, `request_fingerprint`, `read_permission_codes`, `affected_record_refs` hoặc `result_payload`.

### Chuẩn hóa payload

- Trim các trường text theo quy tắc thống nhất; phân biệt NULL với chuỗi rỗng chỉ khi schema/nghiệp vụ cần.
- Kiểm tra numeric hữu hạn, đúng scale và không âm; từ chối NaN/Infinity nếu client/driver có thể gửi.
- Fingerprint bao gồm organization, operation code ổn định, actor scope, item ID, opening movement ID (nếu có), toàn bộ metadata đã chuẩn hóa và initial_quantity.
- Không nhận fingerprint hoặc digest từ client.
- Không tái sử dụng mutation ID cho payload khác.

## 4. Trình tự transaction đề xuất

### Bước 1 — Xác thực và khóa trạng thái tenant

1. Lấy actor từ `auth.uid()`; nếu null thì từ chối.
2. Khóa row `organizations` tương ứng bằng lock chia sẻ phù hợp, kiểm tra active.
3. Khóa row `organization_members` của actor + organization bằng lock chia sẻ phù hợp, kiểm tra active.
4. Dùng thứ tự khóa thống nhất toàn hệ thống: Organization trước, Membership sau.

Mục đích: thao tác disable organization hoặc suspend/remove membership cần UPDATE/DELETE các row đang bị khóa phải chờ transaction mutation kết thúc. Cần xác minh schema, FK và lock behavior bằng test concurrency trên Supabase Test trước khi viết SQL chính thức.

### Bước 2 — Chuẩn hóa và xác thực request

- Kiểm tra item_id, mutation_id, code/name và các giá trị numeric.
- Nếu initial_quantity > 0 thì p_opening_movement_id phải có; nếu initial_quantity = 0 thì phải null.
- Dựng canonical fingerprint hoàn toàn phía server.
- Không insert Receipt cho lỗi Auth, membership, validation hoặc permission trước khi mutation được chấp nhận.

### Bước 3 — Tra Receipt trước quyền ghi

- Tìm `organization_mutations` theo (organization_id, mutation_id).
- Nếu đã có: yêu cầu actor_user_id và operation/fingerprint khớp tuyệt đối.
- Replay là read-only: không kiểm tra lại `inventory.create`.
- Membership và organization vẫn phải active.
- Nếu actor hiện có `inventory.view`, trả snapshot Item + Movement như Receipt đã lưu.
- Nếu không còn quyền đọc, chỉ trả acknowledgement tối thiểu và refs, không trả snapshot.
- Actor khác hoặc fingerprint khác: từ chối mà không tiết lộ Receipt.

### Bước 4 — Kiểm tra quyền ghi và xử lý race replay

- Nếu chưa thấy Receipt, kiểm tra `has_org_permission(org, 'inventory.create')`.
- Nếu quyền ghi không còn, tra Receipt lại trong statement riêng trước khi trả permission denied. Việc này xử lý trường hợp một request đồng thời khác vừa commit Receipt sau lần lookup đầu.
- Nếu Receipt đã xuất hiện, áp dụng cùng actor/fingerprint/read permission checks; nếu chưa có thì từ chối.
- Nếu permission hợp lệ, tiếp tục claim.

Chính sách hiệu lực: quyền được đánh giá tại thời điểm authorization của transaction. Một thao tác thu hồi permission xảy ra sau khi RPC đã được cấp quyền có thể chờ transaction đó kết thúc; không hứa hủy hồi tố một mutation đã được authorize. Membership/organization được khóa riêng theo bước 1.

### Bước 5 — Claim Shared Receipt

- Insert một row `organization_mutations` với:
  - organization_id, mutation_id;
  - actor_user_id = auth.uid();
  - operation = mã ổn định, ví dụ `inventory.item.create.v1`;
  - request_fingerprint do server dựng;
  - read_permission_codes = `['inventory.view']`;
  - result_status = `pending`.
- Dùng `ON CONFLICT (organization_id, mutation_id) DO NOTHING RETURNING`.
- Nếu không claim được, chạy SELECT ở statement tiếp theo và xử lý replay theo đúng actor/fingerprint/read permission.
- Không bắt unique violation rồi tiếp tục trong cùng transaction đã abort.
- Không commit pending Receipt độc lập với business transaction.

### Bước 6 — Kiểm tra định danh và mã vật tư

- Kiểm tra `item_id` chưa tồn tại trong organization.
- Kiểm tra code chưa được dùng theo quy tắc chuẩn hóa đã chốt.
- Schema hiện tại chưa có UNIQUE (organization_id, code); chỉ SELECT kiểm tra không đủ chống hai request đồng thời.
- Điều kiện bắt buộc trước khi bật RPC: read-only duplicate preflight và migration tạo unique index/constraint theo quy tắc code đã chốt. Không tự thêm unique constraint khi chưa xử lý dữ liệu trùng hiện hữu.
- Unique constraint là lớp bảo vệ cuối cùng; RPC vẫn trả conflict có cấu trúc khi ID/code bị chiếm.
- Nếu conflict là kết quả nghiệp vụ xác định sau khi claim, finalize Receipt với `conflict`, không tạo Item/Movement/event. Không trả snapshot của record khác nếu actor không có quyền đọc.
- Nếu unique collision phát sinh do race sau preflight, xử lý trong nhánh an toàn để transaction không để lại Item/Movement dở dang; test riêng với hai request tạo cùng code.

### Bước 7 — Tạo Item

- Insert vào `inventory_items` với ID client cung cấp, organization scope đã xác thực, metadata đã chuẩn hóa và quantity = initial_quantity.
- Không nhận row_version từ client. Khi draft row_version 015 được review/áp dụng, INSERT phải để DB trigger đặt row_version = 1.
- Không được bật RPC production trước khi row_version prerequisite và schema version được xác nhận; nếu chưa có row_version, response contract phải ghi rõ version chưa được triển khai, không giả lập version.
- Không có UPDATE balance sau INSERT: balance ban đầu được ghi trực tiếp trong chính INSERT của Item.

### Bước 8 — Tạo opening Movement nếu có

Chỉ khi `initial_quantity > 0`:
- Insert một row `inventory_movements`:
  - id = p_opening_movement_id;
  - organization_id, item_id;
  - movement_type = 'Nhập';
  - quantity = initial_quantity (luôn dương);
  - reason = 'Tồn đầu kỳ' (giá trị chuẩn do server đặt);
  - movement_date = p_movement_date nếu người dùng cung cấp; nếu không, không tự bịa ngày nghiệp vụ;
  - created_by_user_id = auth.uid();
  - mutation_id = p_mutation_id;
  - expected_item_version = NULL vì Item được tạo trong cùng transaction;
  - balance_before = 0;
  - balance_after = initial_quantity;
  - quantity_delta = +initial_quantity;
  - counted_quantity = NULL;
  - performed_by_label chỉ là snapshot tùy chọn.
- Không tạo Movement quantity 0.
- Nếu initial_quantity = 0: không insert Movement và movement trong response là null.

Các audit columns dự kiến thuộc draft 018; RPC không được viết trước khi schema/constraint tương ứng được review và thống nhất.

### Bước 9 — Ghi change events

- Ghi một event cho Item.
- Nếu có opening Movement, ghi thêm một event cho Movement.
- Không phát event cho Receipt.
- Event, Item, Movement và Receipt phải cùng transaction.
- Nếu change feed schema/RPC chưa sẵn sàng, chưa bật client cutover/worker; không ghi event giả hoặc đẩy queue Local thay thế.

### Bước 10 — Finalize Receipt và trả kết quả

- Finalize Receipt đúng một lần: `result_status = 'applied'`, completed_at do server đặt.
- `affected_record_refs` chứa Item và Movement nếu có, kèm loại record, ID và version phù hợp.
- `result_payload` lưu canonical snapshot từ các row vừa insert; không lấy payload request làm response chuẩn.
- Commit một lần; bất kỳ lỗi nào ở bước 7–10 đều rollback Item, Movement, events và Receipt.
- Response trả `status=applied`, mutation_id, item snapshot, movement snapshot hoặc null, và row_version nếu prerequisite đã tồn tại.

## 5. Các trường hợp đặc biệt

| Tình huống | Kết quả |
|---|---|
| initial_quantity = 0 | Tạo Item, không Movement, một Receipt, một Item event |
| initial_quantity > 0 | Tạo Item + một Movement + một Receipt + hai events |
| Retry cùng ID/payload sau commit | Replay Receipt, không insert lần hai |
| Cùng ID nhưng payload khác | Từ chối idempotency key reuse |
| Actor khác dùng cùng ID | Từ chối, không tiết lộ Receipt |
| Membership/organization inactive | Từ chối |
| Actor bị thu hồi write nhưng Receipt đã commit | Replay read-only theo chính sách đã duyệt |
| Actor mất inventory.view | Chỉ acknowledgement tối thiểu, không snapshot |
| Item ID/code đã tồn tại | Conflict; không ghi business row mới |
| Lỗi insert Movement/event/finalize | Rollback toàn bộ transaction |
| Timeout không rõ kết quả | Client giữ nguyên mutation_id và payload, gọi lại cùng request |

## 6. Điều kiện phụ thuộc trước khi viết SQL

1. Xác minh chính xác schema organizations/memberships và lock ordering trên database mục tiêu.
2. Xác minh permission `inventory.view` và `inventory.create` có đúng catalog/role grants ở database thực tế.
3. Review và hoàn tất draft 020, bao gồm replay race và quyền đọc.
4. Review draft 015 row_version và draft 018 movement audit fields.
5. Read-only duplicate preflight cho `inventory_items`; chốt quy tắc chuẩn hóa code (trim, phân biệt hoa/thường) rồi mới tạo unique constraint.
6. Xác minh quyền INSERT/UPDATE trực tiếp hiện tại và lập kế hoạch revoke đồng thời với client cutover; không revoke trước khi RPC được triển khai và client đã sẵn sàng.
7. Xác định change feed schema/event payload trước khi bật RPC production.
8. Xây dựng test SQL cho Admin/Technician/Viewer, tenant isolation, replay, same-key concurrency, same-code concurrency, rollback, initial_quantity 0/nonzero và lost response.
9. Chỉ sau review và phê duyệt riêng mới tạo SQL draft thực thi; không apply lên Test/Production nếu chưa có chỉ thị rõ.

## 7. Ranh giới an toàn

- Tài liệu này chỉ là thiết kế RPC, không phải SQL chạy được.
- Không sửa migrations hiện hữu hoặc draft 020/015/018.
- Không chạy SQL, không gọi RPC, không ghi dữ liệu hoặc thay đổi grants/RLS trên Supabase.
- Không sửa code UI, IndexedDB, syncQueue hoặc worker.
- Local chỉ cập nhật business snapshot sau Cloud commit; timeout dùng lại cùng mutation ID.
