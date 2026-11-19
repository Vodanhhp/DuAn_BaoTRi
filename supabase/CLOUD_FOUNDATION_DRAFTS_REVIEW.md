# BAOTRI Mini — Review tổng hợp draft 015, 018 và 020

Ngày: 19/11/2026  
Phạm vi: static review trên GitHub main; không chạy SQL, không truy cập/ghi Supabase.

## Kết luận

- Draft 015 (row_version): có thể giữ làm nền tảng, nhưng cần bổ sung kiểm thử trigger và quy tắc mọi RPC chỉ UPDATE mỗi mutable row một lần cho một logical mutation.
- Draft 018 (Movement audit): CHƯA HỢP LỆ để promotion do lỗi ký tự `\\n` nằm trong câu lệnh ALTER TABLE. Ngoài sửa cú pháp, cần xác minh constraint audit với toàn bộ loại movement và các trường hợp legacy.
- Draft 020 (Shared Receipt): cấu trúc và trạng thái pending/final hợp lý về mặt thiết kế. Có một điểm cần xử lý trước promotion: deferred constraint trigger đọc bảng Receipt trong khi client role bị revoke toàn bộ quyền. Cần bảo đảm trigger kiểm tra cuối transaction chạy với quyền đủ đọc bảng, không phụ thuộc vào giả định SECURITY DEFINER context của RPC vẫn còn hiệu lực tại thời điểm deferred trigger chạy.

Không có draft nào được chuyển vào supabase/migrations và không có thay đổi SQL nào được thực hiện.

## 1. Draft 015 — row_version

### Phần đạt

- Chỉ áp dụng cho bảng mutable; không thêm version vào bảng lịch sử append-only.
- INSERT luôn đặt row_version = 1, không tin giá trị client.
- UPDATE tăng version khi có thay đổi business column; loại updated_at và row_version khỏi phép so sánh.
- Trigger dùng một hàm chung và không cấp EXECUTE trực tiếp cho client.
- Tài liệu đã cảnh báo đúng: thêm cột/trigger không tự tạo optimistic concurrency; RPC phải kiểm tra expected version.

### Điều kiện trước promotion

1. Xác nhận đủ sáu bảng trong draft đã tồn tại trên đúng migration baseline: assets, inventory_items, maintenance_tasks, maintenance_plans, checklist_templates, organization_settings.
2. Test INSERT có row_version giả từ client: DB vẫn lưu 1.
3. Test UPDATE thay đổi business field: tăng đúng 1.
4. Test UPDATE chỉ thay updated_at hoặc không thay giá trị business: không tăng.
5. Test UPDATE cùng expected version đồng thời: chỉ một RPC được phép commit.
6. Kiểm tra mọi RPC sau này không UPDATE cùng một row nhiều lần trong một logical mutation, nếu không version sẽ tăng nhiều lần.
7. Test tương tác với các trigger updated_at hiện có; trigger ordering theo tên cần được xác nhận trên PostgreSQL thực tế.
8. Khi thêm bảng mutable mới, phải cập nhật danh sách bảng và test; không mặc định trigger hiện tại bao phủ bảng mới.

### Đánh giá

Không thấy lỗi cú pháp rõ ràng trong draft 015 qua static review. Giữ nguyên thiết kế, chưa cần thay đổi kiến trúc. Chưa thể gọi là concurrency control hoàn chỉnh cho tới khi các RPC dùng expected version.

## 2. Draft 018 — Movement audit

### Lỗi chặn promotion

Trong ALTER TABLE, sau `expected_item_version bigint,` có ký tự literal `\\n` trước `add column performed_by_label text`. Đây là lỗi cú pháp SQL; cần thay bằng newline thật trước khi review lại.

### Phần đạt

- Các audit fields nullable để bảo toàn movement legacy.
- Không backfill số dư lịch sử.
- Giữ quantity hiện hữu dương và dùng quantity_delta có dấu.
- Có kiểm tra quan hệ balance_before + delta = balance_after.
- Adjustment yêu cầu counted_quantity và delta bằng counted - before.
- Unique partial index gắn mutation_id với organization.
- Không tự thay đổi grants/RLS hoặc triển khai RPC.

### Điều kiện cần xác minh/chỉnh trong draft trước promotion

1. Sau sửa cú pháp, chạy parser/DDL trên database Test có đúng baseline; không chạy trên Production.
2. Test 3 loại movement mới: Nhập, Xuất, Điều chỉnh; test adjustment counted_quantity = 0 và delta âm/dương.
3. Test legacy rows có toàn bộ audit fields NULL vẫn hợp lệ.
4. Test các tổ hợp audit field NULL một phần phải bị từ chối.
5. RPC phải bắt buộc expected_item_version cho Nhập/Xuất/Điều chỉnh trên Item đã tồn tại; chỉ opening movement của Item mới được NULL. Constraint hiện tại chỉ kiểm tra nếu có thì phải > 0, chưa tự phân biệt trường hợp này.
6. Opening movement phải có balance_before = 0, balance_after = initial_quantity, quantity_delta dương, quantity dương, reason đúng quy ước và expected_item_version NULL.
7. Điều chỉnh delta = 0 không được INSERT Movement; không được tạo Receipt/event thay đổi.
8. Kiểm tra reason không rỗng cho mọi movement mới; không dựa vào default rỗng của schema cũ.
9. Kiểm tra numeric input hữu hạn, đúng scale và giới hạn miền ở RPC; không chỉ dựa vào kiểm tra >= 0.
10. Xác minh unique index (organization_id, mutation_id) không xung đột với bất kỳ dữ liệu đã có; mutation_id legacy NULL được phép.

### Đánh giá

Draft 018 chưa thể dùng do lỗi cú pháp. Sau sửa lỗi, phần lớn ràng buộc có thể giữ. Các quy tắc expected version và input numeric cần được enforcement trong RPC contract; không nên cố ép constraint bảng phải đoán opening movement bằng reason hoặc số dư.

## 3. Draft 020 — Shared Receipt

### Phần đạt

- PK (organization_id, mutation_id) bảo đảm một Receipt cho một mutation trong tenant.
- Actor được gắn với Auth user.
- Fingerprint JSONB do RPC dựng; không dựa vào hash/client fingerprint.
- Pending chỉ được tồn tại trong transaction và deferred trigger từ chối commit pending.
- Trigger chỉ cho phép pending → final một lần; cấm sửa identity/fingerprint và cấm DELETE.
- Client bị revoke quyền truy cập trực tiếp; business RPC là đường truy cập duy nhất.
- Claim bằng ON CONFLICT DO NOTHING và SELECT ở statement tiếp theo phù hợp để xử lý request đồng thời dưới READ COMMITTED.

### Điểm phải xử lý trước promotion: quyền của deferred trigger

Hàm `assert_organization_mutation_receipt_finalized()` thực hiện SELECT từ `public.organization_mutations`. Nhưng draft đồng thời REVOKE ALL trên bảng khỏi authenticated và không khai báo hàm trigger là SECURITY DEFINER.

Deferred constraint trigger được thực thi tại thời điểm constraint được kiểm tra (thường là cuối transaction). Không được mặc định rằng quyền SECURITY DEFINER của business RPC vẫn là effective role tại thời điểm deferred trigger chạy. Nếu trigger chạy dưới authenticated, SELECT có thể lỗi do thiếu table privilege; nếu row-security cũng lọc, kết quả có thể không phản ánh row Receipt.

Trước promotion, chọn và kiểm thử một phương án rõ ràng:
- Ưu tiên hàm assertion SECURITY DEFINER với owner chuyên trách/đủ quyền tối thiểu, `SET search_path = ''`, schema-qualified table, và cấu hình RLS có chủ đích; hoặc
- Một cơ chế trigger khác chứng minh được việc kiểm tra final state mà không cần cấp quyền đọc Receipt cho client.

Không cấp SELECT trực tiếp cho authenticated chỉ để làm trigger chạy. Kiểm thử thực tế trên Supabase Test bằng authenticated caller gọi một SECURITY DEFINER RPC: transaction commit với Receipt đã finalize phải PASS; transaction bỏ quên finalize phải rollback; client không SELECT được Receipt.

### Các kiểm thử bắt buộc khác

1. Trigger chặn INSERT trực tiếp vào trạng thái final.
2. Trigger chặn UPDATE Receipt đã final, đổi actor/fingerprint/operation hoặc DELETE.
3. Pending insert + finalize trong cùng transaction được commit.
4. Pending chưa finalize bị deferred trigger rollback.
5. Cùng actor + cùng fingerprint replay; cùng key khác payload bị từ chối.
6. Actor khác/cross-org không thể dò sự tồn tại của Receipt.
7. Active membership + organization được kiểm tra trước replay.
8. Replay sau khi mất write permission vẫn được acknowledgement; snapshot chỉ khi đủ toàn bộ read permissions.
9. Permission bị thu hồi đồng thời với mutation/replay: xác minh khóa Organization rồi Membership bằng FOR SHARE thực sự chặn thay đổi trạng thái cho đến khi transaction kết thúc.
10. Replay race: Receipt commit sau lần SELECT đầu nhưng trước khi write permission check trả deny; RPC phải tra Receipt lại ở statement riêng và chỉ replay khi actor/fingerprint/membership/read checks khớp.
11. Claim cùng key đồng thời; rollback của claimant đầu cho phép claimant chờ tiếp tục.
12. Retention không xóa Receipt trước khi client retry/recovery policy cho phép.

### Đánh giá

Giữ cấu trúc Receipt hiện tại. Xử lý vấn đề quyền của deferred assertion trigger trước khi promotion; không cấp quyền đọc bảng Receipt cho client.

## 4. Các điểm đồng bộ tài liệu

- Cross-review `CLOUD_INVENTORY_RECEIPT_CROSS_REVIEW.md` là tài liệu điều phối chính sách replay, fingerprint, lock order, inventory ID/code collision.
- Migration plan có một số đoạn lịch sử ghi trạng thái trước khi draft 020 được tạo; khi cập nhật tài liệu kế hoạch cần giữ rõ mốc thời gian, không xóa lịch sử.
- Các tài liệu đều là thiết kế/draft. Migration hiện có trong GitHub không chứng minh chúng đã được áp dụng trên Supabase.

## 5. Thứ tự công việc tiếp theo

1. Sửa lỗi literal `\\n` trong draft 018 và review lại SHA/nội dung.
2. Hoàn thiện phương án quyền cho deferred assertion trigger của draft 020; kiểm thử trên Test.
3. Kiểm thử draft 015 cùng trigger updated_at và các RPC mẫu có expected version.
4. Sau khi ba foundation này PASS, mới thiết kế change-feed event contract và SQL RPC create_inventory_item.
5. Không cutover client, không revoke quyền ghi hiện tại, không apply Production cho đến khi vertical slice Inventory hoàn tất kiểm thử.

## 6. Giới hạn thay đổi trong lượt review

- Chỉ tạo tài liệu review.
- Không sửa ba SQL draft.
- Không tạo migration thực thi.
- Không chạy SQL, không gọi RPC, không thay đổi Supabase, dữ liệu, RLS, grants hoặc mã nguồn ứng dụng.


## 7. Kết luận kỹ thuật bổ sung — quyền của deferred Receipt trigger

Đã đối chiếu với tài liệu PostgreSQL về `SECURITY DEFINER`, `current_user` và RLS:

- Hàm `SECURITY DEFINER` chạy với quyền của **owner của chính function**; quyền này được áp dụng khi function được gọi, không phụ thuộc vào việc business RPC gọi nó trước đó có phải SECURITY DEFINER hay không.
- Table owner thông thường bypass RLS, trừ khi bảng bật `FORCE ROW LEVEL SECURITY`. Role có `BYPASSRLS` cũng bypass RLS.
- Khi dùng `row_security = off`, PostgreSQL không biến role thường thành role bypass RLS; nếu RLS đáng lẽ phải lọc kết quả, truy vấn có thể báo lỗi thay vì âm thầm bỏ qua policy.
- Vì vậy không nên giữ giả định rằng chỉ cần thêm `SECURITY DEFINER` là đủ; phải chốt owner, quyền SELECT và cách RLS xử lý cụ thể.

### Phương án thiết kế khuyến nghị

Dùng một role kỹ thuật riêng, **NOLOGIN**, chỉ dành cho việc kiểm tra Receipt; không cấp membership/SET ROLE cho `anon` hoặc `authenticated`.

1. Cấp cho role này `USAGE` trên schema cần thiết và chỉ `SELECT` trên `public.organization_mutations`; không cấp INSERT/UPDATE/DELETE.
2. Tạo policy SELECT riêng trên Receipt cho đúng role kỹ thuật này với điều kiện `USING (true)`. Policy này chỉ cho phép function owner đọc Receipt; không áp dụng cho client roles.
3. Chuyển ownership của `assert_organization_mutation_receipt_finalized()` sang role kỹ thuật đó và khai báo function là `SECURITY DEFINER`.
4. Giữ `SET search_path = ''`, schema-qualify mọi object; **bỏ `SET row_security = off`** để truy vấn đi qua policy dành riêng cho role kỹ thuật.
5. Giữ revoke quyền bảng Receipt đối với `PUBLIC`, `anon`, `authenticated`; không cấp EXECUTE function cho client. Trigger đã gắn với bảng tiếp tục gọi trigger function theo cơ chế trigger của PostgreSQL.
6. Role kỹ thuật không được là thành viên của client roles; không được cấp quyền gọi business RPC hoặc quyền sửa Receipt. Function chỉ SELECT trạng thái theo khóa từ `NEW`, không trả payload hay dữ liệu Receipt ra ngoài.

Đây là khuyến nghị thiết kế để đưa vào bản SQL draft sau khi được phép chỉnh sửa; **chưa phải SQL đã triển khai**. Trước khi chọn role/policy cụ thể, phải kiểm tra role owner thực tế, schema privileges, RLS/FORCE RLS và chính sách tạo role của Supabase project.

### Kiểm thử bắt buộc trên Supabase Test

- Gọi business RPC dưới vai trò `authenticated`; Receipt pending được finalize trong cùng transaction: commit thành công.
- Cùng RPC nhưng cố tình bỏ qua bước finalize: deferred trigger đọc thấy pending và rollback toàn transaction.
- Client `authenticated` và `anon` không SELECT được bảng Receipt, kể cả khi biết organization_id và mutation_id.
- Client không thể gọi trực tiếp trigger function; role kỹ thuật không có quyền ghi bảng.
- Kiểm tra `current_user` bên trong assertion function là role kỹ thuật; `session_user`/Auth context vẫn không bị dùng nhầm làm actor.
- Lặp lại các test khi bật `FORCE ROW LEVEL SECURITY` trên bảng Receipt (nếu cấu hình đó được cân nhắc); policy riêng phải vẫn cho assertion function nhìn thấy đúng row.
- Test function owner không có membership trong `authenticated`/client roles và không có quyền ngoài phạm vi cần thiết.

### Nguồn kỹ thuật

- PostgreSQL — [CREATE FUNCTION: Writing SECURITY DEFINER Functions Safely](https://www.postgresql.org/docs/current/sql-createfunction.html).
- PostgreSQL — [Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).
- PostgreSQL — [System Information Functions: current_user và session_user](https://www.postgresql.org/docs/current/functions-info.html).

### Kết luận cập nhật

Điểm vướng của draft 020 đã có hướng xử lý rõ ở mức thiết kế: **trigger assertion là SECURITY DEFINER do role kỹ thuật NOLOGIN sở hữu, chỉ có SELECT qua policy RLS riêng; không cấp SELECT cho client và không dùng `row_security = off`**. Draft 020 vẫn ở trạng thái DRAFT, cần chỉnh SQL riêng và kiểm thử thực tế trước promotion.


## 8. Rà soát đối chiếu draft 015 với migration baseline hiện có

Đã đọc lại draft 015 cùng các migration schema đang có trên nhánh main (static review):

- Sáu bảng được draft 015 nhắm tới đều có trong business schema: `assets`, `inventory_items`, `maintenance_tasks`, `maintenance_plans`, `checklist_templates`, `organization_settings`.
- Cả sáu bảng đều có `updated_at` và trigger cập nhật timestamp trong business schema.
- Migration ngày 19/11 thay riêng trigger Asset sang `clock_timestamp()`; draft 015 vẫn loại `updated_at` khỏi phép so sánh JSONB nên thay đổi timestamp không làm tăng row_version.
- Tên trigger draft `*_set_row_version` đứng trước `*_set_updated_at` theo thứ tự alphabetic trigger của PostgreSQL. Riêng Asset, trigger updated_at hiện đã được thay bằng `assets_set_updated_at` gọi `set_asset_updated_at()`; quy tắc loại updated_at khỏi so sánh vẫn giữ đúng ý đồ.
- Không thấy bảng nào trong scope thiếu cột `updated_at` ở baseline được đọc. Không thấy lý do phải đổi thiết kế trigger dùng chung của draft 015.

### Giới hạn và điều kiện vẫn còn

1. Đây chỉ là đối chiếu file migration trong GitHub; không xác nhận migration đã được apply vào Supabase Test/Production.
2. Draft 015 chỉ tự tăng version; nó **không** nhận expected version, không phát hiện stale write và không tự chặn lost update. Mỗi RPC cập nhật phải có điều kiện version nguyên tử, ví dụ UPDATE có `WHERE id = ... AND row_version = p_expected_version`, sau đó xác nhận đúng một row được cập nhật.
3. Asset hiện có Lease và optimistic check riêng theo `updated_at`; không được tự ý chuyển Asset RPC sang row_version trong đợt này. Có thể giữ row_version làm metadata nền, nhưng chỉ dùng khi Asset migration/RPC riêng được thiết kế và test.
4. Cần test trên PostgreSQL/Supabase thực tế: INSERT ép row_version về 1; UPDATE business field tăng đúng một; UPDATE chỉ timestamp không tăng; hai RPC đồng thời cùng expected version chỉ một thành công; rollback không để lại version tăng.
5. Vì trigger tăng theo từng SQL UPDATE, một RPC không được UPDATE cùng mutable row nhiều lần trong cùng logical mutation nếu muốn version tăng đúng một lần.

### Kết luận cập nhật cho draft 015

**Có thể giữ nguyên SQL draft 015 ở mức thiết kế; không phát hiện lỗi cần sửa qua đối chiếu baseline.** Chưa đủ điều kiện promotion vì chưa chạy DDL/test trên Test và chưa có các RPC expected-version hoàn chỉnh. Không thay đổi SQL draft trong lượt rà soát này.


## 9. Rà soát sâu draft 018 — kết quả constraint và audit semantics

Đã đối chiếu draft 018 với schema `inventory_movements` hiện tại và quyết định nghiệp vụ đã chốt.

### 9.1 Lỗi cú pháp xác nhận

- Dòng `expected_item_version bigint,\\n  add column performed_by_label text` chứa literal backslash + n.
- Đây là lỗi cú pháp chắc chắn; phải thay bằng dấu phẩy và xuống dòng SQL thật trước khi chạy parser.
- Chưa sửa file draft trong lượt này.

### 9.2 Các constraint hiện tại phù hợp

- Giữ `quantity > 0` của movement cũ; cột `quantity_delta` mới mới là delta có dấu.
- Legacy row được phép để toàn bộ audit snapshot mới NULL; không backfill số dư không có căn cứ.
- Khi audit snapshot đã có, `balance_before`, `balance_after`, actor và mutation ID phải có; delta khác 0; `balance_after = balance_before + quantity_delta`; `quantity = abs(quantity_delta)`.
- Nhập yêu cầu delta dương; Xuất yêu cầu delta âm; Điều chỉnh yêu cầu counted_quantity không NULL, bằng balance_after và delta bằng counted - before.
- Điều chỉnh về tồn 0 vẫn hợp lệ nếu delta khác 0; kiểm kê không chênh lệch không được tạo movement.
- Unique partial index `(organization_id, mutation_id)` phù hợp với hợp đồng hiện tại: mỗi mutation tạo tối đa một movement. Nếu một logical mutation trong tương lai cần nhiều movement, phải đổi khóa idempotency ở thiết kế trước khi triển khai.

### 9.3 Phát hiện cần bổ sung vào thiết kế — numeric NaN

PostgreSQL coi `NaN` lớn hơn mọi giá trị numeric thông thường. Vì vậy các CHECK kiểu `quantity_delta <> 0`, `balance_before >= 0` và `counted_quantity >= 0` không tự loại trừ NaN. Kiểu `numeric(18,4)` loại được Infinity do precision hữu hạn, nhưng vẫn có thể lưu NaN.

Yêu cầu trước khi promote:
- RPC phải từ chối NaN cho initial_quantity, quantity, counted_quantity và mọi numeric đầu vào liên quan.
- Constraint trên các cột numeric audit mới phải loại NaN một cách tường minh, không chỉ kiểm tra dấu hoặc phép bằng.
- Test INSERT/UPDATE trực tiếp qua test harness cho NaN ở từng cột audit; tất cả phải bị từ chối.
- Kiểm tra thêm trường hợp numeric vượt precision/scale; không tự làm tròn âm thầm ngoài quy tắc đã thống nhất.

Nguồn: PostgreSQL Numeric Types ghi rõ NaN được xem bằng nhau và lớn hơn mọi numeric không phải NaN; xem tài liệu chính thức ở phần nguồn cuối tài liệu.

### 9.4 expected_item_version: RPC bắt buộc, DDL hiện chưa phân biệt đủ

- Draft cho phép `expected_item_version IS NULL` trong nhánh audit snapshot mới.
- Điều này cần thiết cho opening movement vì Item được tạo cùng transaction và chưa có version cũ.
- Nhưng cùng điều kiện đó cũng cho phép một movement Nhập/Xuất/Điều chỉnh thông thường bị ghi thiếu expected version nếu RPC/đường ghi không kiểm soát.
- Không nên suy luận opening movement chỉ từ nhãn reason ở CHECK constraint. RPC phải phân biệt operation context: opening movement chỉ được tạo bên trong `create_inventory_item`; các movement thay đổi Item đã tồn tại phải nhận và kiểm tra expected version.
- Test bắt buộc: movement thường thiếu expected version bị từ chối; opening movement có version NULL được chấp nhận; opening movement không thể được tạo độc lập qua RPC movement thông thường.

### 9.5 created_by_user_id và vòng đời Auth user

- FK `created_by_user_id REFERENCES auth.users(id) ON DELETE RESTRICT` giữ được dấu vết actor và ngăn xóa Auth user đã tạo movement.
- Đây có thể là chủ ý tốt cho audit, nhưng là một quyết định vòng đời tài khoản: xóa Auth user có thể bị chặn nếu còn movement tham chiếu.
- Cần ghi rõ chính sách sản phẩm: tài khoản nhân viên nghỉ việc nên bị suspend/deactivate thay vì xóa Auth user; nếu vẫn cần xóa tài khoản thì phải có quy trình lưu actor audit không phụ thuộc FK. Không tự đổi sang SET NULL vì sẽ mất liên kết actor đã xác thực.

### 9.6 Kết luận draft 018

Draft 018 **chưa đạt để chạy** vì lỗi cú pháp. Ngoài sửa lỗi đó, cần bổ sung xử lý NaN và làm rõ quy tắc expected version ở RPC/test. Các constraint hiện tại về dấu delta, balance và legacy preservation nhìn chung đúng với nghiệp vụ đã chốt. FK actor cần chốt chính sách xóa tài khoản trước khi promote.

### Nguồn kỹ thuật bổ sung

- PostgreSQL 18 — [Numeric Types](https://www.postgresql.org/docs/18/datatype-numeric.html): NaN, Infinity và quy tắc so sánh numeric.
- PostgreSQL — [Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html): semantics của CHECK constraints.


## 10. Đối chiếu sâu draft 018 với schema inventory_movements gốc

Đã fetch và đối chiếu draft 018 với migration nền `20261117000200_business_schema.sql` trên nhánh main. Đây là static review của mã nguồn migration, không xác nhận migration đã chạy trên Supabase.

### 10.1 Schema gốc xác nhận

- `inventory_movements.quantity` là `numeric(18,4) NOT NULL`, `reason` là `text NOT NULL DEFAULT ''`.
- Movement type được giới hạn ở `Nhập`, `Xuất`, `Điều chỉnh`; quantity hiện có CHECK `quantity > 0`.
- `inventory_movements` có FK tenant-safe tới `inventory_items` và Asset tùy chọn.
- Direct client INSERT vào `inventory_movements` hiện đang bị withheld trong migration nền; không được hiểu draft 018 là đã mở đường ghi trực tiếp.
- Các CHECK hiện có trên `inventory_items.quantity`, `min_quantity`, `unit_price` cũng chỉ kiểm tra không âm. Do semantics numeric NaN của PostgreSQL, các CHECK này không tự loại NaN.

### 10.2 Phát hiện bổ sung về NaN

Phát hiện NaN ở mục 9.3 không chỉ áp dụng cho các cột audit mới. Cột `inventory_movements.quantity` hiện hữu cũng là numeric và được kiểm tra bằng `quantity > 0`; CHECK này không đủ để loại NaN.

Yêu cầu thiết kế:
1. Mọi movement mới phải từ chối NaN ở `quantity`, `quantity_delta`, `balance_before`, `balance_after`, `counted_quantity`.
2. RPC phải từ chối NaN ở các numeric đầu vào tồn kho như initial quantity, counted quantity, quantity nhập/xuất, min quantity và unit price.
3. Không cần thay đổi lịch sử hoặc backfill. Nếu dữ liệu hiện có có NaN, phải phát hiện và xử lý bằng một kế hoạch dữ liệu riêng trước khi thêm constraint; không tự sửa dữ liệu.
4. Test riêng từng cột và từng RPC; không coi phép so sánh `>= 0`, `> 0`, `<> 0` hoặc phương trình balance là bộ lọc NaN.

### 10.3 Giới hạn của CHECK snapshot

- Constraint hiện tại bảo đảm audit fields gần như đầy đủ khi `quantity_delta` có giá trị; legacy rows vẫn có thể để toàn bộ audit snapshot NULL.
- Constraint không tự biết một movement mới là opening movement hay movement trên Item đã tồn tại. Bắt buộc expected version là trách nhiệm của RPC theo ngữ cảnh thao tác.
- Constraint không xác nhận `created_by_user_id = auth.uid()`; giá trị actor phải do server/RPC gán, không nhận từ client.
- Constraint không xác nhận `mutation_id` đã có Receipt tương ứng. RPC phải tạo Receipt và movement cùng transaction; cần test FK/logic liên kết nếu thiết kế sau này bổ sung khóa ngoại.
- `performed_by_label` là nhãn hiển thị lịch sử, không thay thế actor Auth; không được dùng nó làm căn cứ phân quyền hay truy vết danh tính.

### 10.4 Kết luận đối chiếu

Không phát hiện xung đột mới giữa schema movement gốc và các quyết định nghiệp vụ đã chốt. Tuy nhiên, phạm vi chặn NaN phải bao gồm cả cột `quantity` hiện hữu và mọi numeric input tồn kho. Draft 018 vẫn chưa hợp lệ do literal `\\\\n`; chưa sửa SQL, chưa chạy parser/DDL và chưa truy cập Supabase.



## 11. Chốt chính sách vòng đời Auth actor cho audit

Đã đối chiếu draft 018/019 với migration identity nền `20261116000100_identity_and_organizations.sql`.

### 11.1 Hiện trạng schema identity

- `public.profiles.id` tham chiếu `auth.users(id) ON DELETE CASCADE`.
- `organizations.created_by` tham chiếu `profiles(id) ON DELETE RESTRICT`.
- `organization_members.user_id` và `invited_by_user_id` tham chiếu `profiles(id) ON DELETE RESTRICT`.
- Vì vậy, Auth user đã tạo Organization hoặc còn được tham chiếu bởi membership thường đã không thể hard-delete an toàn; FK cascade từ Auth sang Profile không vượt qua được các FK RESTRICT đang giữ Profile.
- Draft 018 và 019 tham chiếu trực tiếp `auth.users(id) ON DELETE RESTRICT` cho actor. Đây là cách nhất quán với mục tiêu giữ danh tính audit, đồng thời làm rõ thêm rằng actor lịch sử không được xóa khi còn movement/log tham chiếu.
- Đây là kết luận từ file migration trong GitHub; chưa xác nhận schema đang triển khai trên Supabase.

### 11.2 Quyết định thiết kế khuyến nghị

**Giữ `ON DELETE RESTRICT` cho actor audit. Không đổi sang `SET NULL` hoặc `CASCADE`.**

Lý do:
1. Movement và Log là lịch sử nghiệp vụ; cần giữ liên kết tới Auth identity đã thực hiện thao tác.
2. `performed_by_label` chỉ là snapshot tên hiển thị, không thay thế được UUID actor.
3. Xóa Auth user không nên là cách xử lý nhân viên nghỉ việc. Nên vô hiệu hóa/ban đăng nhập Auth và chuyển membership sang suspended hoặc remove membership theo chính sách tổ chức; không xóa Auth identity nếu còn lịch sử nghiệp vụ.
4. Nếu sản phẩm sau này bắt buộc hỗ trợ xóa định danh cá nhân theo yêu cầu pháp lý, phải thiết kế quy trình ẩn danh hóa riêng có phê duyệt, phạm vi dữ liệu rõ ràng và bảo toàn tính toàn vẹn audit; không tự đổi FK trong migration hiện tại.

### 11.3 Điều kiện cần kiểm tra trong member-management flow

- Phân biệt rõ remove khỏi Organization, suspend membership và hard-delete Auth user.
- Remove/suspend membership không được xóa Auth user và không được xóa Movement/Log.
- Nếu Edge Function có thao tác hard-delete Auth user, phải kiểm tra trước các tham chiếu Organization, Membership, Receipt, Asset Lease, Movement, Log revision và audit; thao tác phải thất bại an toàn khi còn tham chiếu RESTRICT.
- Kiểm thử Auth user bị ban/suspended vẫn giữ nguyên actor UUID trong lịch sử; người đó không còn quyền đăng nhập hoặc thực hiện mutation mới.
- Không cho phép UI mô tả “Xóa thành viên” như thể xóa vĩnh viễn Auth identity nếu backend thực tế chỉ remove membership.

### 11.4 Kết luận

Giữ FK actor `ON DELETE RESTRICT` trong draft 018 và 019 là phù hợp với schema identity hiện tại và mục tiêu audit. Chính sách vận hành nên là **deactivate/suspend thay vì hard-delete Auth user**. Không cần sửa hai SQL draft chỉ vì vòng đời actor; cần review riêng Edge Function member-management để xác nhận thao tác Remove/Suspend/ban Auth không vô tình hard-delete tài khoản.

Chưa sửa SQL, chưa gọi Edge Function, chưa chạy SQL và chưa thay đổi Supabase.



## 12. Rà soát Edge Function quản lý thành viên

Đã đọc trực tiếp Edge Function `supabase/functions/manage-organization-members/index.ts`, migration 013/014 và test 014 trên nhánh main.

### 12.1 Remove membership — phù hợp chính sách

- Action `remove_member` gọi RPC `admin_remove_org_membership`.
- Migration 014 chỉ DELETE dòng `organization_members`; FK cascade xóa role assignments.
- Comment và implementation nêu rõ Auth identity và Profile được giữ nguyên.
- Test 014 kiểm tra membership/role assignment bị xóa nhưng Profile và `auth.users` vẫn tồn tại.
- RPC khóa membership row `FOR UPDATE`, từ chối tự xóa và từ chối xóa Admin.

Kết luận: Remove member hiện tại là remove khỏi một Organization, không phải hard-delete Auth user. Phù hợp với chính sách giữ actor audit.

### 12.2 Suspend / Activate — phù hợp chính sách

- Edge Function chỉ gọi `admin_update_org_member_status`.
- Migration 013 chỉ cập nhật `organization_members.status` thành `suspended` hoặc `active`.
- Không gọi Auth delete, không xóa Profile và không xóa lịch sử.
- Test suspended membership đã có kiểm tra tenant isolation.

Kết luận: Suspend/Activate chỉ tác động membership của tổ chức, không xóa tài khoản Auth. Đây là hành vi đúng.

### 12.3 Hard-delete Auth duy nhất tìm thấy

Trong Edge Function có một lời gọi:
`admin.auth.admin.deleteUser(targetUserId)`

Nó chỉ nằm trong nhánh Invite: khi Edge Function vừa tạo Auth user mới bằng `inviteUserByEmail`, nhưng RPC tạo membership thất bại, code gọi deleteUser để dọn tài khoản vừa tạo. Không có lời gọi deleteUser trong Remove, Suspend, Activate, Update role hoặc Reset password.

Đây là compensation cho tài khoản vừa được tạo trong chính request hiện tại, không phải xóa người dùng đã có lịch sử. Tuy nhiên:
- Kết quả deleteUser hiện không được kiểm tra; nếu cleanup thất bại có thể để lại Auth user/profile mồ côi.
- Nên kiểm tra lỗi cleanup và ghi log có kiểm soát; không trả thông tin nhạy cảm ra client.
- Không được tái sử dụng nhánh cleanup này cho tài khoản Auth đã tồn tại trước request.
- Nếu membership RPC báo lỗi không xác định sau khi transaction thực tế đã commit nhưng response bị mất, cần đối soát membership trước khi xóa Auth user mới tạo. Không được xóa một user đã có membership được tạo thành công.

### 12.4 Giới hạn và rủi ro còn cần kiểm thử

- Test 014 là SQL test file có trong repo; việc file tồn tại không chứng minh đã chạy trên Supabase Test.
- Cần test Edge Function thực tế với 4 trường hợp: Remove member, Suspend, Activate, Invite thất bại khi tạo membership.
- Cần xác nhận cleanup chỉ xóa Auth user do đúng request vừa tạo; trường hợp timeout/response unknown phải đối soát trước.
- Cần kiểm tra Edge Function có kiểm soát trạng thái Organization và membership/permission đủ chặt ở thời điểm thao tác; không chỉ dựa vào UI.
- Tài khoản bị suspend membership vẫn có thể là thành viên của Organization khác; không được ban Auth toàn cục chỉ vì một tổ chức suspend họ.

### 12.5 Kết luận

**Không phát hiện hard-delete Auth user trong luồng Remove/Suspend/Activate.** Các luồng này phù hợp với chính sách audit đã chốt. Lời gọi deleteUser duy nhất là cleanup Auth account vừa được tạo trong Invite nếu tạo membership thất bại; cần tăng độ an toàn khi cleanup và xử lý kết quả RPC không chắc chắn.

Không sửa Edge Function, SQL, test hoặc dữ liệu trong lượt này. Chỉ cập nhật tài liệu review; chưa gọi Edge Function và chưa chạy test trên Supabase.

