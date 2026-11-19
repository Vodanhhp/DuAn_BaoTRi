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



## 13. Rà soát Change Feed và cursor đồng bộ

Đã đối chiếu hai tài liệu thiết kế change feed hiện có:
- `supabase/CLOUD_RPC_IDEMPOTENCY_CHANGEFEED_DESIGN.md`
- `supabase/CLOUD_SYNC_SCHEMA_PROTOCOL_DESIGN.md`

Đồng thời tìm trong mã nguồn/migration theo các tên `organization_sync_counters`, `organization_changes`, `pull_organization_changes`, `sync_cursor`. Kết quả hiện chỉ thấy các tài liệu thiết kế; chưa tìm thấy migration/bảng/RPC change feed được triển khai trong repository. Đây là kết luận theo nội dung repo main đã rà soát, không phải xác nhận trực tiếp trạng thái database Supabase.

### 13.1 Các nguyên tắc đã đúng và cần giữ

- Change event, business rows, row_version và Shared Receipt phải cùng một transaction PostgreSQL. Rollback thì không có event hoặc Receipt thành công.
- Một logical mutation tác động nhiều record phải có một Receipt nhưng một event cho mỗi record thực sự thay đổi.
- Conflict và no_change không phát change event.
- Delete phải tạo tombstone; không phụ thuộc FK tới record đã bị xóa.
- Cursor phải phản ánh commit order trong từng organization. Không dùng PostgreSQL sequence độc lập làm cursor vì thứ tự cấp sequence có thể khác thứ tự commit.
- Pull trả event theo cursor tăng dần; Local chỉ commit cursor sau khi áp dụng thành công toàn bộ page trong một Dexie transaction.
- Cursor riêng theo từng thiết bị/cài đặt; PC và Mobile không dùng chung cursor.
- Không cho pull ghi đè Local record đang có mutation pending/processing/conflict.

### 13.2 Điểm cần thống nhất giữa hai tài liệu

Tài liệu `CLOUD_SYNC_SCHEMA_PROTOCOL_DESIGN.md` mô tả trigger AFTER INSERT/UPDATE/DELETE tự ghi event. Tài liệu `CLOUD_RPC_IDEMPOTENCY_CHANGEFEED_DESIGN.md` nhấn mạnh RPC nghiệp vụ phải ghi event trong cùng transaction.

Khuyến nghị chốt một cơ chế ghi event duy nhất:
- Ưu tiên RPC nghiệp vụ chủ động phát event cho đúng các record thuộc logical mutation.
- Không đồng thời để trigger tự phát event trên cùng bảng nếu RPC cũng insert event, tránh duplicate event.
- Trigger chỉ nên dùng cho nhiệm vụ kỹ thuật đã định nghĩa rõ; nếu chọn trigger làm event producer thì RPC không được phát event lần nữa và phải chứng minh được permission/payload filtering.
- Với RPC nhiều record như complete Task + tạo Log, RPC phải phát cả hai event cùng Receipt.

Lý do: event không chỉ là dấu vết SQL row. Nó phải thể hiện đúng ngữ nghĩa nghiệp vụ, quyền đọc, revision và kết quả của một mutation.

### 13.3 Cursor và counter — các điều kiện còn thiếu trước SQL

- Phải tạo counter row cho organization mới theo cách an toàn đồng thời (ví dụ insert-if-absent rồi lock row); không giả định counter đã tồn tại.
- Mọi writer của một organization phải lấy cùng counter lock trước khi cấp cursor và giữ lock đến commit. Bất kỳ đường ghi nào bỏ qua quy tắc này đều có thể làm sai commit order.
- Cần quy định rõ thứ tự khóa giữa Organization, Membership, business row, Receipt và sync counter; các RPC phải dùng thứ tự nhất quán để tránh deadlock.
- Pull cần đọc high-water mark và page trong một snapshot nhất quán. Không được trả next_cursor vượt qua event chưa được page trả về.
- Giới hạn page size phía server; xác thực cursor không âm và không vượt high-water mark hợp lệ.
- Cursor không được tiến qua event bị lọc do permission. Nếu event stream có nhiều loại dữ liệu với quyền xem khác nhau, pull phải trả một cursor tiến triển an toàn kèm cơ chế skip/redact có định nghĩa; không để client kẹt vĩnh viễn ở một event không có quyền đọc.
- Phải quyết định payload là immutable snapshot tại thời điểm event hay chỉ là record reference. Khuyến nghị snapshot có allowlist trường theo quyền đọc; nếu chỉ lưu ref thì phải chứng minh pull có thể tái tạo trạng thái đúng khi record bị sửa/xóa nhiều lần trước khi client kéo.
- Không đưa dữ liệu nhạy cảm hoặc snapshot của bảng người dùng không có quyền đọc vào event payload chung.

### 13.4 Retention, thiết bị và resync

- Cần bảng/device cursor hoặc cơ chế last_seen theo từng organization + installation; không xóa event chỉ vì đã qua một khoảng thời gian cố định nếu thiết bị hợp lệ còn có thể quay lại.
- Phải định nghĩa thiết bị bị thu hồi, mất máy, cài lại, hoặc quá lâu không đồng bộ; đây là điều kiện để bỏ cursor cũ và yêu cầu full resync.
- `resync_required` phải có snapshot boundary/high-water mark rõ ràng. Client tải snapshot theo boundary, sau đó mới tiếp tục feed từ cursor tương ứng; không ghi đè Local pending/conflict.
- Tombstone chỉ được dọn khi mọi cursor còn hiệu lực đã vượt qua nó hoặc đã hết hạn theo chính sách thiết bị đã chốt.

### 13.5 Phân quyền và cách ly tenant

- Không cấp client quyền SELECT/INSERT/UPDATE/DELETE trực tiếp trên counter/change tables nếu pull RPC là cửa duy nhất.
- Pull phải xác thực Auth, organization active, active membership và quyền đọc theo từng loại resource.
- Organization ID trong request chỉ là tham số định tuyến; không phải bằng chứng quyền.
- Với một page có nhiều loại record, phải lọc/redact theo quyền hiện tại mà vẫn bảo toàn cursor. Không để receipt replay hoặc change feed trở thành đường vòng vượt quyền đọc.
- SECURITY DEFINER cần owner/quyền tối thiểu, `search_path = ''`, schema-qualified objects, EXECUTE grants chính xác; không mặc định `row_security = off` là đủ an toàn.

### 13.6 Kiểm thử bắt buộc bổ sung

1. Hai mutation cùng organization phát event đồng thời: cursor theo đúng commit order, không bỏ sót.
2. Hai organization khác nhau không khóa counter của nhau.
3. Counter chưa tồn tại: hai RPC khởi tạo đồng thời không tạo hai counter hoặc mất cursor.
4. Business write lỗi sau khi cấp cursor: counter increment và event cùng rollback.
5. Một mutation Task + Log: một Receipt, đúng hai event; lỗi ở bước Log thì Task, Receipt, cursor và events đều rollback.
6. Delete: tombstone được kéo qua nhiều page và không bị FK cascade xóa.
7. Pull page lỗi khi apply Local: IndexedDB rollback và cursor Local giữ nguyên.
8. Event bị ẩn do permission: cursor vẫn tiến an toàn nhưng payload không lộ.
9. Permission bị thu hồi giữa các page; membership/org bị suspend; cross-tenant cursor.
10. Cursor hết retention, thiết bị bị thu hồi, resync snapshot boundary và tiếp tục pull.
11. Record bị sửa nhiều lần trước pull: xác nhận semantics snapshot/event không làm Local áp dụng sai thứ tự.
12. Event payload lớn hoặc malformed: giới hạn kích thước, lỗi page không làm cursor tiến.

### 13.7 Kết luận và trạng thái

Thiết kế hiện tại đã có nền tảng đúng về commit-order cursor, tombstone, multi-record event và atomic apply Local. Tuy nhiên chưa đủ điều kiện viết migration triển khai hoặc bật worker. Cần chốt cơ chế event producer (RPC hay trigger, không trùng lặp), snapshot semantics, permission-aware cursor, counter initialization/lock order, retention và resync boundary.

Không tạo SQL draft, không sửa code, không gọi RPC, không chạy SQL và không thay đổi Supabase trong lượt review này.


## 14. Rà soát Dexie syncQueue và chuyển đổi Local → Cloud

Đã đọc trực tiếp `src/db.ts`, `src/lib/cloudSync.ts`, `supabase/CLOUD_SYNC_QUEUE_V7_DESIGN.md`, `supabase/CLOUD_FIRST_WRITE_AUDIT.md` và tìm toàn repository các tham chiếu `syncLocalDatabase`, `queueChange`, `syncQueue`.

### 14.1 Trạng thái Dexie thực tế

- Ứng dụng đang ở Dexie version 8. Version 8 chỉ thêm `assetCloudLinks` và `assetMutations`; không thay đổi cấu trúc `syncQueue` từ version 6.
- `syncQueue` vẫn có primary key `id` và unique compound index `[tableName+recordId]`. Vì vậy một record chỉ có tối đa một queue row.
- `queueChange()` dùng ID `tableName:recordId`, ghi `put()`, tạo `mutationId` mới và reset status/attempts về pending. Thay đổi mới có thể ghi đè mutation cũ cùng record.
- `putAndQueue`, `addAndQueue`, `deleteAndQueue` ghi Local + queue trong cùng Dexie transaction. Đây là helper Local-first, không đáp ứng hợp đồng Cloud-first.
- Queue không giữ payload snapshot bất biến hoặc baseVersion. Do đó không thể tái tạo chính xác request lịch sử chỉ từ queue row; worker cũ đọc bản ghi Local hiện tại tại thời điểm push.

### 14.2 Protocol JSON cũ không được bật lại

`src/lib/cloudSync.ts` có hàm `syncLocalDatabase()`, nhưng tìm kiếm toàn repository chỉ thấy định nghĩa trong module, không thấy caller từ UI/app. Không có bằng chứng đây là worker đang hoạt động.

Các vấn đề kỹ thuật nếu tái sử dụng:
- Push ghi vào bảng JSON tổng quát `maintenance_records` bằng upsert, không gọi các RPC nghiệp vụ Cloud-first.
- `mutationId` của queue không được gửi vào Cloud Receipt; không có idempotency/replay theo mutation ID.
- Hàm gộp queue theo record rồi đọc payload mới nhất từ Dexie; không gửi snapshot của mutation đã tạo queue.
- Sau upsert, hàm xóa queue theo các key đã xử lý; nếu queue row bị thay thế trong lúc request đang chạy, có nguy cơ xóa mutation mới.
- Pull đọc toàn bộ record JSON và áp dụng từng row bằng put/delete riêng lẻ, không có change cursor, tombstone protocol chuẩn hoặc atomic page + cursor.
- Khi Cloud rỗng, hàm seed toàn bộ Local records lên Cloud. Đây là hành vi không phù hợp kiến trúc Cloud-first đã chốt.

Kết luận: giữ module cũ ở trạng thái không được gọi; không nối lại vào UI, không dùng làm worker tạm và không dùng để “dọn queue”.

### 14.3 Phân loại queue cũ và nguồn phát sinh

Queue cũ có thể gồm:
- Business mutations từ Asset, Inventory, Task, Maintenance Plan, Log, Movement, Checklist Template/Version/Result.
- Demo/test data: các luồng tạo dữ liệu mẫu từng gọi `queueChange()`; không được upload sang tenant Cloud.
- Queue được khôi phục từ backup vì backup hiện chứa cả `syncQueue`.
- Queue được rekey khi chuyển draft ID sang official ID; thao tác rekey có thể tạo mutation ID mới, nên không thể mặc định đó là một business action mới đã được người dùng xác nhận.
- Các queue row cũ có thể còn dù bản ghi Local đã bị xóa hoặc đã được nhập Cloud theo một luồng khác.

Không thể xác định loại từng queue row chỉ từ `tableName`, `recordId`, `operation`, `queuedAt` và `mutationId`. Queue không có nguồn tạo, tenant, immutable payload, Cloud receipt status hoặc classification flag. Không được tự động replay hoặc xóa hàng loạt.

### 14.4 Quy trình chuyển tiếp an toàn đề xuất

**Giai đoạn 0 — Freeze legacy path**
- Không bật `syncLocalDatabase()` và không tạo worker đọc `syncQueue`.
- Không cho helper Local-first tiếp tục được dùng bởi các business write đã chuyển sang Cloud-first; việc thay helper phải theo từng vertical slice đã có RPC/test, không thay toàn bộ một lần.
- Giữ nguyên queue và dữ liệu Local cho tới khi có báo cáo kiểm kê.

**Giai đoạn 1 — Snapshot và kiểm kê chỉ đọc**
- Lấy số lượng queue theo tableName/status/operation, thời gian cũ nhất/mới nhất, số lượng trùng/thiếu record Local.
- Phân loại demo dựa trên bằng chứng nguồn tạo/dấu hiệu dataset, không chỉ dựa vào tên hoặc nội dung giống dữ liệu mẫu.
- Đối chiếu Asset với `assetCloudLinks` + `assetMutations` + Asset Receipt Cloud; các bảng khác đối chiếu Cloud bằng luồng read-only phù hợp.
- Ghi nhận backup/restore provenance nếu có; không suy đoán tenant hoặc actor từ queue.
- Không sửa hoặc xóa queue trong bước kiểm kê.

**Giai đoạn 2 — Quarantine**
- Các entry chưa đủ bằng chứng được đánh dấu/quản lý trong báo cáo quarantine riêng; không chuyển sang worker.
- Demo queue, orphan queue, queue có record đã linked/imported và queue có outcome không rõ phải được xử lý theo từng nhóm có bằng chứng.
- Không tái sử dụng mutation ID cũ cho request mới nếu payload/operation không thể chứng minh giống hệt. Không tạo request mới để thay thế một mutation có outcome chưa rõ trước khi đối soát Cloud.

**Giai đoạn 3 — Chuyển từng vertical**
- Mỗi vertical có RPC Cloud-first, Shared Receipt, version/permission, test rollback/retry/timeout và Local apply sau Cloud commit.
- Chỉ sau khi vertical chạy ổn định mới xác định dữ liệu Local cũ là legacy baseline, Cloud-linked hay conflict; không coi queue cũ là danh sách lệnh cần upload.
- Với Asset, giữ Asset Edit Lease và Asset-specific Receipt trong giai đoạn chuyển tiếp; reconcile pending/processing/conflict trước khi xử lý mutation mới trên cùng Asset.
- Với Inventory/Task/Log/Checklist, không replay queue cũ vì không có snapshot mutation đáng tin cậy và nhiều thao tác cần transaction nhiều bảng.

**Giai đoạn 4 — Ngừng queue cũ**
- Chỉ xóa helper, schema index/table hoặc dữ liệu queue sau khi từng vertical đã cutover, queue đã được phân loại và có backup/đối soát được phê duyệt.
- Dexie migration phải có test nâng cấp từ v8 thực tế và rollback/recovery plan; không xóa bảng queue ngay trong migration đầu tiên.
- Thiết kế queue v7 trước đây có thể dùng làm tài liệu tham khảo cho retry/claim, nhưng kiến trúc Cloud-first mới không nên tạo local outbound business queue khi offline business writes bị cấm. Nếu cần lưu trạng thái recovery sau Cloud request, đó phải là mutation journal của request đã gửi, với immutable payload/ID và semantics riêng; không phải queue để tự upload khi mạng về.

### 14.5 Kết luận

- Dexie v8 hiện vẫn mang syncQueue Local-first v6; chưa có Dexie queue v7 triển khai và chưa có worker tổng quát được gọi từ app.
- Protocol JSON cũ có rủi ro seed/upsert/pull và không đáp ứng Receipt/change feed; không được bật lại.
- Queue cũ là dữ liệu cần kiểm kê/quarantine, không phải danh sách mutation an toàn để replay.
- Cloud-first không cần một outbound queue cho business writes offline. Chỉ giữ Local draft trong UI; sau Cloud commit mới ghi business snapshot Local. Nếu Cloud commit thành công nhưng Local write thất bại, phục hồi bằng cùng Receipt/mutation ID.

Không sửa code, không sửa Dexie schema, không chạy worker, không ghi/xóa dữ liệu Local hoặc Cloud trong lượt này. Chỉ cập nhật tài liệu review.


## 15. Bản đồ đầy đủ các điểm ghi Local và thứ tự cutover

Rà soát tĩnh toàn bộ `src/App.tsx` (242,971 ký tự), `src/db.ts`, `src/CloudAssetsPanel.tsx`, `src/lib/assetsCloud.ts`, `src/lib/assetEditLocks.ts`; quét các lời gọi Dexie mutator và helper queue trong App.

### 15.1 Danh sách business write sites còn Local-first/hybrid

| Thứ tự ưu tiên | Handler / luồng | Local write hiện tại | Cloud-first cần thay |
|---|---|---|---|
| P0 | `saveAsset()` tạo Asset mới/chưa linked | Asset + queue; tự cấp code Local | RPC create/import có Receipt, ID ổn định, code uniqueness; Local chỉ sau commit |
| P0 | `saveAsset()` sửa Asset đã linked | Ghi candidate vào `db.assets` + `assetMutations` trước RPC; giữ pending khi lỗi | Đây là ngoại lệ Local-first còn tồn tại. Cần chuyển thành UI draft → RPC + Receipt → Local snapshot/link/mutation ledger sau commit; giữ Edit Lease |
| P0 | `addMovement()` | Cập nhật Inventory quantity + thêm Movement + 2 queue entries trong Dexie transaction | Một RPC atomic cho Nhập/Xuất, balance check, row_version, Receipt; Adjustment theo quyết định kiểm kê đã chốt |
| P0 | `completeTask()` | Cập nhật Task completed + tạo Log + 2 queue entries | Một RPC atomic Task + Log root + revision 1 + Receipt + change events |
| P1 | `saveItem()` | `putAndQueue` Inventory metadata | RPC create/update metadata; tạo mới có thể kèm opening stock theo quyết định Admin/Technician; metadata update không nhận quantity |
| P1 | `saveTask()` | `putAndQueue` Task | RPC create/update, permission và expected row_version |
| P1 | `saveMaintenancePlans()` | bulkPut nhiều Plan + queue từng record | Chốt batch là một mutation all-or-nothing hay mỗi Plan là mutation riêng; sau đó RPC/Receipt tương ứng |
| P1 | `deleteMaintenancePlan()` | delete Local + queue delete | RPC delete Admin-only + Receipt/tombstone |
| P1 | `saveLog()` | `putAndQueue` Log; hiện cho phép sửa cùng record theo helper chung | Tạo mới RPC Log + revision 1; sửa Log đã Cloud lưu phải dùng `logs.revise` Admin-only, append-only revision; không UPDATE root |
| P1 | `archiveAsset()`, `restoreAsset()`, `changeAssetStatus()` | `putAndQueue` cho Asset chưa linked; linked hiện bị gate chặn | RPC status/archive/restore + Receipt/version; policy linked và unlinked phải thống nhất |
| P1 | `ensureDefaultChecklist()` | Tự tạo Template + Version + queue khi mở lịch sử Checklist | Bỏ side-effect lúc xem; tạo draft/preview; Admin chủ động lưu qua RPC Template + Version atomic |
| P1 | `saveTemplate()` | Template put + Version add + queue | RPC atomic Template + Version + Receipt |
| P1 | `saveResult()` | `addAndQueue` Checklist Result | RPC append-only result + Receipt; Admin/Technician |
| P2 | `saveCloudAssetCodeConfig()` | Ghi trực tiếp PostgREST `organization_settings` (update/insert) | Chuyển sang RPC Cloud-first + settings.manage + version/Receipt; không dùng direct table write |
| P2 | Asset ảnh | Hiện ảnh Local trong IndexedDB; Cloud mapper trả images rỗng | Storage private + metadata/policy riêng; chưa được upload base64 vào Postgres |

### 15.2 Các Local write đặc biệt — không đưa vào business RPC

- **Cloud Asset import → Local** (`CloudAssetsPanel.tsx`): đọc lại Asset từ Cloud, kiểm tra collision, rồi ghi Asset + Cloud Link trong một Dexie transaction. Đây là import/cache có chủ đích, không phải business write ngược Cloud. Giữ luồng riêng và bảo đảm không ghi đè Asset Local.
- **Backup restore**: thay thế nhiều bảng Local và hiện restore cả `syncQueue`. Đây là Local recovery, không phải Cloud business mutation. Cần preflight tất cả unresolved mutations/receipts; không tự replay queue từ file backup và không xóa pending chưa đối soát.
- **Demo data**: tạo 30 Asset + 30 Inventory; tạo thêm 15 Asset. Hiện các luồng này vẫn ghi queue nghiệp vụ. Phải tách demo/test dataset hoặc bỏ queue; chặn upload demo tuyệt đối.
- **Draft rekey** (`rekeyAssetDraftId`, `rekeyInventoryDraftId` trong `src/db.ts`): thay UUID và cập nhật các foreign key/queue Local trong Dexie transaction. Đây là migration danh tính Local, không phải business update Cloud. Trước cutover phải xử lý draft còn tham chiếu và queue rekey; không tự biến rekey thành mutation Cloud mới.
- **Auth profile/password**: thuộc Supabase Auth, không phải business table/queue. Giữ luồng Auth riêng, kiểm tra kết quả Auth trước khi báo thành công.
- **Theme, compact mode, device ID, danh mục vị trí vật tư, bật/tắt location**: localStorage/personal hoặc cấu hình thiết bị. Không cần Cloud business RPC. Riêng danh mục/cấu hình có phạm vi doanh nghiệp cần chốt rõ Local-only hay chuyển sang organization settings; không tự đồng bộ.
- **Export/print/report và thao tác đọc**: không phải business write; không đưa vào mutation queue.

### 15.3 Rủi ro xuyên suốt cần xử lý trong thiết kế client

1. ID của nhiều entity được tạo ngay khi mở form hoặc tạo draft; cần phân biệt draft ID và official ID, không gửi mutation chỉ vì người dùng mở form.
2. Một số handler dùng `blockViewer`/role flag, không phải capability riêng. Khi chuyển Cloud-first phải khóa nút theo permission catalog và server vẫn là nơi quyết định cuối.
3. Asset linked hiện ghi Local candidate trước Cloud; đây là điểm phải chuyển sớm để đạt nguyên tắc Cloud commit trước Local.
4. Batch Plan cần xác định mutation boundary; không thể tự suy diễn một lần Save nhiều Plan là nhiều request độc lập.
5. Sau Cloud commit, Local Dexie apply có thể lỗi. Client cần phục hồi canonical snapshot bằng cùng mutation ID/Receipt; không tạo mutation mới.
6. Không thay mọi `putAndQueue` bằng RPC chung. Mỗi nghiệp vụ cần RPC có schema allowlist, permission, version, transaction boundary và test riêng.

### 15.4 Thứ tự cutover đề xuất

1. **Nền tảng chung**: hoàn tất Receipt, row_version, change feed, transaction/lock order, permission checks, client mutation journal và cơ chế apply canonical snapshot sau commit. Sửa các SQL draft đã phát hiện lỗi tĩnh trước khi viết migration thực thi.
2. **Asset**: linked edit (loại Local candidate trước RPC), create/import-preserving-identity, status/archive/restore; giữ Edit Lease và Asset Receipt trong chuyển tiếp. Reconcile Local-only/linked/pending/conflict trước khi bật từng luồng.
3. **Inventory**: create + opening stock, metadata update, Nhập/Xuất, kiểm kê Adjustment; một giao dịch Cloud cho balance + movement.
4. **Maintenance Log + Task**: Log create/revision; Task create/update/delete; complete Task + Log trong một RPC.
5. **Maintenance Plan**: quyết định batch boundary rồi mới làm create/update/delete.
6. **Checklist**: loại bỏ auto-create khi view; Template + Version; Result append-only.
7. **Organization settings**: chuyển cấu hình mã Asset sang RPC.
8. **Cleanup**: chỉ sau khi mọi vertical đã cutover và queue cũ đã kiểm kê/quarantine/reconcile mới tính đến việc bỏ helper/schema queue.

### 15.5 Tiêu chí hoàn tất mỗi vertical

- Không có business write nào ghi IndexedDB trước khi Cloud xác nhận commit.
- Mỗi mutation có ID ổn định, payload chuẩn hóa bất biến và Shared Receipt; retry/replay không nhân đôi.
- Conflict/permission/validation rejection giữ Local business snapshot nguyên trạng.
- Timeout/lost response giữ trạng thái unknown; chỉ reconcile bằng cùng mutation ID.
- Local apply sau Cloud commit có thể retry từ Receipt/canonical result.
- Server kiểm tra Auth, organization, active membership, permission, row_version/lease và dữ liệu đầu vào.
- Có test cho success, deny, stale version, duplicate, payload mismatch, rollback, timeout-after-commit, Local apply failure, concurrent clients và tenant isolation.

### 15.6 Trạng thái

Đây là bản đồ dựa trên static source scan và các handler đang có trên `main`. Chưa runtime-test toàn bộ UI, chưa xác minh trạng thái migration đã áp dụng ở Supabase, chưa sửa code/SQL, chưa chạy RPC/worker, và không ghi/xóa dữ liệu Local hoặc Cloud.


## 16. Hợp đồng nền tảng thống nhất: Shared Receipt + row_version + Change Feed

Mục này hợp nhất các quyết định trong CLOUD_RPC_IDEMPOTENCY_CHANGEFEED_DESIGN.md, draft 015, draft 020, migration plan và các review 8–15. Đây là hợp đồng kiến trúc chuẩn để các vertical RPC sau này tuân theo; chưa phải SQL migration và không thay thế review riêng từng draft.

### 16.1 Ba lớp có trách nhiệm khác nhau

1. **Shared Receipt — mutation identity và recovery**: xác định một logical request đã được commit hay chưa; ngăn chạy lặp; lưu kết quả canonical để cùng actor phục hồi sau timeout/mất response.
2. **row_version / revision_no — concurrency control**: phát hiện dữ liệu đã thay đổi kể từ lúc client đọc. row_version dành cho mutable master/config row; revision_no dành cho append-only Log revision. Receipt không thay thế version check.
3. **Change Feed — phân phối thay đổi tới thiết bị khác**: cung cấp event theo cursor commit-order. Change Feed không phải idempotency ledger, không phải outbound queue và không quyết định quyền ghi.

Một transaction business mutation thành công phải commit đồng thời: business rows + version/revision + một Shared Receipt + các change events tương ứng. Bất kỳ lỗi nào trước commit đều rollback tất cả.

### 16.2 Hợp đồng Shared Receipt

- Một Receipt cho một logical mutation, PK (organization_id, mutation_id); có thể có 1..N affected records.
- Actor chỉ lấy từ auth.uid(). Operation là mã nghiệp vụ ổn định, không phụ thuộc tên hàm SQL.
- Server dựng canonical fingerprint từ organization, actor scope, operation, tất cả resource IDs, expected version/revision và payload đã chuẩn hóa theo allowlist. Không nhận fingerprint/hash authoritative từ client.
- Draft 020 dùng JSONB fingerprint, không giả định pgcrypto. Đây là phương án chấp nhận được cho giai đoạn thiết kế; trước khi triển khai phải giới hạn kích thước, loại bỏ trường nhạy cảm không cần thiết và kiểm thử canonicalization/JSONB equality. Chỉ thay bằng digest sau khi xác minh hàm SHA-256 thực tế.
- Receipt chỉ được claim và finalize trong cùng transaction với business mutation. pending không được commit; kết quả cuối chỉ là applied, no_change, conflict. Permission/Auth/validation rejection trước khi chấp nhận mutation không tạo Receipt.
- Cùng key + cùng actor + cùng fingerprint: replay kết quả đã commit, không thực hiện business write lần nữa. Khác actor/operation/resource/version/payload: reject key reuse, không side effect.
- Replay theo chính sách đã được người dùng chấp thuận: Auth hợp lệ + organization active + membership active + đúng actor. Không yêu cầu lại write permission. Full snapshots chỉ trả nếu hiện còn đủ toàn bộ read permissions; nếu thiếu bất kỳ quyền đọc nào thì chỉ trả acknowledgement tối thiểu.
- Conflict và no_change là kết quả cuối có thể replay; không tạo Change Feed event. Không tự rebase conflict và không sinh mutation ID mới khi outcome request cũ chưa rõ.
- Asset-specific Receipt/Lease tiếp tục được giữ. Không dual-write hai ledger; khi chuyển Asset phải có adapter đọc/replay receipt cũ trước khi đổi write path.

**Lưu ý về draft 020:** DDL chỉ tạo bảng và trigger bảo vệ vòng đời Receipt; nó chưa xác thực Auth, membership, permission, fingerprint hoặc actor cho một business RPC. Các kiểm tra đó bắt buộc nằm trong từng SECURITY DEFINER RPC. Trigger/deferred guard cần test với owner thực tế, RLS, function grants và cả đường rollback; không xem DDL Receipt là đã hoàn thiện toàn bộ security boundary.

### 16.3 Hợp đồng row_version và revision

- Draft 015 áp dụng cho assets, inventory_items, maintenance_tasks, maintenance_plans, checklist_templates, organization_settings. Đây là danh sách mutable rows hiện được review; thay đổi phạm vi phải có lý do và migration riêng.
- Version do database quản lý: INSERT bắt đầu 1; UPDATE business fields tăng đúng một; no-op không tăng. Client không được tự quyết định version.
- Mỗi RPC khóa row, kiểm tra expected version, rồi UPDATE mỗi mutable row tối đa một lần cho một logical mutation. Không để trigger tăng hai lần do RPC cập nhật cùng row nhiều bước.
- Conflict không thay đổi business row/version và không phát event; Receipt conflict ghi nhận kết quả conflict cùng mutation ID.
- Append-only: inventory_movements, maintenance_log_revisions, checklist_template_versions, checklist_results không dùng row_version. Log revise dùng expected_revision_no và thêm revision mới.
- Task completion + Log: Task row_version tăng một; Log root + revision 1 được tạo; một Receipt, một transaction, event riêng cho Task và Log.
- Inventory movement: Inventory Item row_version tăng một; Movement append-only. Điều chỉnh tồn bằng số đếm thực tế; delta do server tính. Delta 0 là no_change, không tăng version và không có Movement/event.
- Asset vẫn dùng expected_cloud_updated_at + Edit Lease + Asset Receipt hiện hữu trong giai đoạn chuyển tiếp. Draft 015 có thể bổ sung cột row_version, nhưng không tự động cho phép bỏ Lease hoặc đổi token của Asset RPC.

**Điểm cần sửa trước promotion draft 015:** chạy static syntax/trigger review và test trên bản schema clone; xác minh trigger names không xung đột, bảng/cột thực tế và tất cả đường UPDATE hiện hữu. Việc thêm trigger không tự thu hồi direct UPDATE grants và không tự buộc client gửi expected_version.

### 16.4 Hợp đồng Change Feed — chọn RPC làm event producer duy nhất

**Quyết định kiến trúc:** chỉ business RPC ghi organization_changes và cập nhật counter; không dùng AFTER trigger để tự sinh cùng loại event. Trigger row_version chỉ quản lý version, không phát event. Không được đồng thời có RPC event insert và trigger event insert vì sẽ tạo event trùng.

- Mỗi record thực sự thay đổi có một event; một logical mutation nhiều record có một Receipt nhưng nhiều event. Ví dụ Task + Log = hai events; Inventory Item + Movement = hai events.
- Conflict/no_change không có event. Delete phải có tombstone; không dựa vào việc row đã bị hard-delete để client suy ra thay đổi.
- Counter theo organization được khóa bằng row lock và giữ tới commit. Cấp cursor liên tiếp cho tất cả event của transaction. Không dùng PostgreSQL sequence độc lập làm cursor commit-order.
- Counter phải được khởi tạo an toàn cho mọi organization hiện hữu trong migration; RPC vẫn cần xử lý phòng thủ nếu thiếu row (insert-on-conflict rồi lock lại). Không dùng MAX(cursor)+1 không khóa.
- Chốt thứ tự khóa dùng chung cho tất cả business RPC: **Organization → Membership → Receipt claim/replay → business rows (sắp xếp ổn định theo table + ID) → organization counter → insert events → finalize Receipt**. Replay Receipt không đi tiếp tới business rows/counter. Các thao tác quản trị thay đổi organization/membership status phải tương thích thứ tự khóa này. Nếu RPC nào cần nhiều business rows, luôn khóa theo cùng thứ tự để tránh deadlock.
- Event producer ghi payload snapshot tại thời điểm mutation trong cùng transaction; payload chỉ gồm field cần thiết cho đồng bộ và không được vượt quyền đọc. Append-only event giữ identity riêng, không coalesce mất lịch sử.
- Pull RPC xác thực Auth, organization active, active membership và quyền đọc hiện tại. Không cho client đọc/ghi trực tiếp bảng counter/change feed.
- Page có thể chứa event bị ẩn bởi permission. Pull phải tiến cursor qua các event đã quét nhưng không trả payload bị cấm; next_cursor là cursor cuối đã quét an toàn, không phải cursor cuối của event visible. Giới hạn page phải tính trên số event đã quét để tránh page vô hạn khi nhiều event bị lọc.
- Pull trả high_watermark nhất quán với snapshot truy vấn. Cursor chỉ tiến đến event đã được xác định trong page; không nhảy qua event chưa trả/chưa quét. Retry cùng cursor phải cho kết quả nhất quán theo semantics đã định.
- Client áp dụng toàn bộ page (snapshot + tombstone) trong một Dexie transaction; chỉ cập nhật cursor local sau khi toàn bộ page apply thành công. Không ghi đè Local draft/pending/conflict.
- Retention/resync: khi cursor quá cũ, trả resync_required kèm snapshot boundary/high-watermark; tải snapshot theo boundary rồi tiếp tục feed từ cursor đó. Chỉ dọn tombstone/event sau khi cursor thiết bị còn hiệu lực đã vượt qua hoặc thiết bị hết hạn/thu hồi theo chính sách. Không âm thầm trả page rỗng.

### 16.5 Luồng chuẩn của một business RPC

1. Xác thực auth.uid(); khóa/đọc Organization active và Membership active theo thứ tự khóa chuẩn.
2. Chuẩn hóa payload bằng allowlist và dựng fingerprint ở server.
3. Tra Receipt theo organization + mutation ID. Nếu có, kiểm tra actor/fingerprint rồi replay read-only theo quyền đọc hiện tại.
4. Nếu chưa có, kiểm tra permission ghi hiện tại; claim Receipt bằng unique key. Khi trùng key đồng thời, dùng INSERT ... ON CONFLICT DO NOTHING RETURNING, sau đó statement riêng SELECT Receipt; không bắt unique violation rồi tiếp tục trong transaction đã lỗi.
5. Khóa các business rows theo thứ tự ổn định; kiểm tra tồn tại, tenant, expected row_version/revision, lease và điều kiện nghiệp vụ.
6. Thực hiện business write; mỗi mutable row UPDATE đúng một lần; insert append-only rows nếu cần.
7. Khóa organization counter; tạo event cho từng record thay đổi, cấp cursor liên tiếp.
8. Finalize Receipt với status + affected refs + canonical result; commit.
9. Chỉ sau RPC trả kết quả commit, client mới apply canonical snapshot/mapping vào Dexie. Nếu Local apply lỗi, phục hồi bằng cùng mutation ID/Receipt. Nếu response mất, giữ outcome unknown và replay cùng ID/payload; không tạo mutation mới.

### 16.6 Các vấn đề vẫn phải kiểm chứng trước SQL migration

- DDL draft 020: kiểm tra RLS/owner của trigger deferred, SECURITY DEFINER context, quyền EXECUTE và khả năng trigger đọc Receipt khi transaction finalize.
- Draft 015: kiểm tra schema thực tế, trigger naming/order, direct grants và mọi UPDATE path cũ; xác nhận Asset compatibility.
- Change Feed: chưa có DDL; cần thiết kế bảng, FK/retention, tombstone, payload contract, cursor counter initialization, pull RPC và resync snapshot boundary.
- Lock order: đối chiếu các RPC quản trị membership/organization hiện có để chắc chắn không tạo deadlock ngược thứ tự.
- Pull permission: xác định permission code cho từng resource, semantics event bị lọc và cursor progression; kiểm thử thu hồi quyền giữa các page.
- Payload: giới hạn kích thước, dữ liệu nhạy cảm, snapshot event-time, schema version và xử lý event không nhận diện được ở client.
- Asset: thiết kế legacy Receipt replay/adapter và quy trình giữ Lease trong lúc cutover.
- Không migration nào được áp dụng chỉ vì draft đã qua static review; cần Test clone, concurrency tests, rollback tests, security/grants review và phê duyệt riêng.

### 16.7 Thứ tự triển khai nền tảng sau khi thiết kế được duyệt

1. Sửa và review draft 015, 020; chưa promotion.
2. Thiết kế Change Feed DDL + pull contract theo mục 16.4.
3. Viết migration nền tảng theo lát cắt riêng, chạy trên Test sau phê duyệt; kiểm thử lock order, Receipt concurrency, row_version và cursor commit-order.
4. Viết một vertical RPC mẫu (ưu tiên Inventory hoặc một nghiệp vụ ít phụ thuộc Asset legacy) để kiểm chứng end-to-end Receipt → version → event → Local apply.
5. Chỉ sau PASS mới nhân rộng RPC theo từng vertical và cutover client.

**Trạng thái:** đây là hợp đồng kiến trúc thống nhất và danh sách kiểm chứng. Không sửa source code, không sửa SQL draft 015/020, không tạo migration Change Feed, không chạy SQL/RPC, không bật worker và không thay đổi Supabase Test/Production hoặc dữ liệu.


## 17. Review draft 015 — row_version foundation

Đã đối chiếu draft 015 với schema nghiệp vụ 002, identity schema 001 và migration 019 điều chỉnh Asset updated_at. Đây là static review trên GitHub; chưa chạy PostgreSQL, chưa xác minh migration nào đã được apply vào Supabase Test/Production.

### 17.1 Phạm vi bảng: khớp schema hiện tại

Draft 015 thêm row_version cho sáu bảng mutable hiện có:
- assets
- inventory_items
- maintenance_tasks
- maintenance_plans
- checklist_templates
- organization_settings

Cả sáu bảng đều có updated_at trong business schema 002; organization_settings là singleton theo organization_id, không có id riêng nhưng row_version vẫn dùng bình thường trên row đó.

Không thêm version cho các bảng append-only/history như inventory_movements, maintenance_logs, checklist_template_versions, checklist_results. Phạm vi này phù hợp với thiết kế hiện tại. Asset_images chưa đưa vào là hợp lý vì hiện là metadata insert/delete, không phải mutable master row trong hợp đồng này.

### 17.2 Trigger behavior: ý tưởng đúng, cần giữ các điều kiện

- Hàm set_business_row_version dùng SECURITY INVOKER mặc định, search_path rỗng và chỉ thay đổi NEW; không cần SECURITY DEFINER.
- INSERT ép row_version = 1, không tin giá trị client.
- UPDATE so sánh JSONB sau khi bỏ row_version và updated_at; business field thay đổi thì tăng OLD.row_version đúng một, chỉ đổi updated_at thì giữ version.
- Tên trigger dạng [table]_set_row_version đứng trước [table]_set_updated_at theo thứ tự alphabetic của PostgreSQL. Trigger updated_at ở schema 002 dùng set_updated_at; Asset có migration 019 thay bằng set_asset_updated_at dùng clock_timestamp(). Vì row_version comparison loại updated_at nên cả hai kiểu timestamp đều không làm tăng version giả.
- Mỗi SQL UPDATE chỉ chạy trigger một lần; nếu RPC UPDATE cùng row hai lần thì version tăng hai lần. Đây là behavior đã biết, phải tránh trong RPC chứ không sửa bằng cách làm trigger phức tạp hơn.

### 17.3 Những điểm draft 015 chưa và không thể tự giải quyết

1. **Không có optimistic concurrency enforcement:** draft chỉ thêm cột/trigger. RLS policy và direct UPDATE grants trong schema 002 vẫn cho phép một số client update trực tiếp. Trigger không kiểm tra expected_version. Không được coi draft 015 là đã ngăn lost update.
2. **Không khóa quyền ghi trực tiếp:** assets, maintenance_tasks, maintenance_plans có grant UPDATE; checklist_templates có grant UPDATE; organization_settings có grant UPDATE; inventory_items có column-level UPDATE. Khi từng vertical chuyển sang RPC, migration cutover phải thu hồi direct INSERT/UPDATE phù hợp và chỉ cấp EXECUTE RPC đã kiểm tra Auth, membership, permission, expected version và Receipt. Không thu hồi đồng loạt trước khi client cutover.
3. **Asset chưa chuyển token:** Asset hiện dùng expected_cloud_updated_at + Edit Lease + Asset-specific Receipt. Thêm row_version không thay thế các cơ chế này; không đổi client hoặc RPC Asset trong migration nền.
4. **Trigger chỉ so sánh toàn bộ row:** mọi cột nghiệp vụ mới thêm sau này tự động được tính vào version. Điều này tốt cho default fail-safe nhưng cần kiểm tra các cột kỹ thuật/audit mới; nếu có cột không đại diện thay đổi business thì phải quyết định rõ có loại khỏi phép so sánh hay không.
5. **No-op UPDATE:** nếu RPC gửi UPDATE nhưng giá trị business không đổi, version giữ nguyên; tuy nhiên vẫn có thể kích hoạt updated_at trigger và tạo write/WAL. RPC phải phát hiện no-op trước UPDATE, không dùng UPDATE vô ích làm cơ chế kiểm tra.
6. **INSERT version:** trigger đặt 1 ngay cả khi client gửi giá trị khác. Khi RPC tạo row, snapshot trả về phải lấy row_version từ database sau INSERT, không dựng version phía client.

### 17.4 Kiểm tra migration và thứ tự triển khai

- Draft 015 dùng ALTER TABLE ADD COLUMN NOT NULL DEFAULT 1. Với PostgreSQL hiện đại, constant default thường được tối ưu không cần rewrite toàn bảng, nhưng vẫn cần lock DDL và phải đo trên quy mô dữ liệu thật trước promotion.
- Tên constraint và trigger đang cụ thể, không dùng IF NOT EXISTS. Đây là migration một lần, không idempotent; chỉ chạy qua migration ledger chuẩn, không chạy lại thủ công.
- Draft tạo function trước trigger và revoke EXECUTE khỏi PUBLIC/anon/authenticated; trigger vẫn gọi function. Cần kiểm tra quyền thực thi trigger function dưới owner/role thực tế trong môi trường Test, nhất là nếu sau này đổi function owner hoặc security mode.
- Cần thêm rollback/forward-fix plan. Không tùy tiện DROP row_version sau khi RPC/client đã bắt đầu phụ thuộc.
- Không sửa migration 002 hoặc 019 đã có; chỉ sửa draft 015 trước khi promotion.

### 17.5 Kết luận review

**Kết luận: chấp nhận hướng thiết kế, chưa chấp nhận promotion draft 015 ở trạng thái hiện tại.** Không thấy sai lệch rõ ràng giữa sáu bảng và schema 002; cách tăng version bằng trigger phù hợp với hợp đồng đã chốt. Nhưng draft chỉ là lớp version nền, không phải concurrency/security cutover.

Điều kiện trước promotion:
1. Kiểm thử trigger trên PostgreSQL clone với cả sáu bảng: insert, update business, update timestamp-only, no-op, client cố giả mạo row_version.
2. Kiểm thử hai transaction cùng expected_version ở RPC mẫu: đúng một applied, một conflict; không có partial write.
3. Chốt từng vertical RPC và thời điểm thu hồi direct grants; không để client cũ mất quyền ghi trước cutover.
4. Xác minh quyền execute trigger function, migration lock/duration và thứ tự với migration đang có.
5. Giữ Asset Lease + expected_cloud_updated_at + Asset Receipt cho đến migration Asset riêng.

**Trạng thái:** chỉ bổ sung review tài liệu. Không sửa draft 015, không tạo migration mới, không chạy SQL, không gọi RPC, không thay đổi quyền/dữ liệu Supabase.


## 18. Review draft 020 — Shared Receipt DDL và ranh giới bảo mật

Đã đọc toàn bộ draft 020 và đối chiếu với hợp đồng mục 16, review Receipt trước đó và schema identity hiện có. Đây là static review; không chạy PostgreSQL, không apply DDL, không kiểm tra trực tiếp catalog của Supabase.

### 18.1 Những phần đạt

- Bảng có khóa chính (organization_id, mutation_id), actor riêng, operation ổn định, JSONB fingerprint server-built, read permission list, affected refs và canonical result.
- FK organization/auth user dùng ON DELETE RESTRICT, tránh xóa identity đang được Receipt tham chiếu.
- RLS bật và revoke table privileges khỏi PUBLIC/anon/authenticated; không có policy client trực tiếp. Đây là private ledger, không phải bảng client CRUD.
- Trigger bảo vệ identity/fingerprint/read permissions và chỉ cho pending → final; cấm DELETE.
- Deferred constraint trigger kiểm tra trạng thái cuối, ngăn pending commit nếu trigger hoạt động đúng trong security context thực tế.
- Không giả định pgcrypto; không tạo generic claim RPC; không đụng Asset-specific Receipt/Lease.
- Algorithm dùng INSERT ... ON CONFLICT DO NOTHING RETURNING rồi SELECT ở statement kế tiếp, phù hợp tránh unique-violation làm transaction aborted.
- Replay same actor sau khi mất write permission được giữ read-only, theo chính sách đã duyệt.

### 18.2 Vấn đề P0 — deferred trigger chưa chứng minh được khả năng đọc qua RLS

Function assert_organization_mutation_receipt_finalized() hiện là SECURITY INVOKER (mặc định), đặt SET row_security = off, nhưng bảng organization_mutations bật RLS và không có policy. row_security = off **không phải** cơ chế bypass RLS; với role không có quyền bypass, PostgreSQL có thể báo lỗi thay vì nhìn thấy row. Function chỉ hoạt động nếu effective role lúc trigger chạy có quyền bypass RLS/owner phù hợp và không bị FORCE ROW LEVEL SECURITY.

Trước promotion phải chọn và kiểm thử rõ một phương án:
1. Trigger function SECURITY DEFINER, owner được kiểm soát, search_path rỗng, schema-qualified references, không dynamic SQL, EXECUTE revoke khỏi client roles; đồng thời xác nhận behavior khi table FORCE RLS.
2. Hoặc giữ SECURITY INVOKER nhưng chứng minh mọi đường DML hợp lệ đều chạy dưới effective role có quyền bypass RLS, và test cả RPC SECURITY DEFINER owner thực tế.

Không mặc định table owner luôn bypass: kiểm tra owner, BYPASSRLS, FORCE ROW LEVEL SECURITY và effective role của business RPC trên Test. Đây là blocker trước promotion.

### 18.3 P1 — bảo vệ trạng thái Receipt cần test sâu hơn

- Guard UPDATE hiện kiểm tra OLD pending và NEW final, đồng thời khóa các trường identity. Cần kiểm tra mọi trường được phép thay đổi chỉ đúng một lần; không cho final row bị update lần hai, kể cả nếu caller cố đổi completed_at/result/refs.
- Deferred trigger được tạo AFTER INSERT OR UPDATE và mỗi event sẽ chạy lúc commit. Một Receipt được INSERT pending rồi UPDATE final tạo hai lần deferred check; cả hai phải đọc được trạng thái final trong cùng transaction.
- Trigger guard DELETE chặn xóa ở mức trigger; table privileges cũng revoke. Cần test owner/superuser và mọi maintenance/retention path để không có đường xóa ngoài ý muốn.
- CREATE OR REPLACE FUNCTION trong draft không đổi owner của function đã tồn tại; trước promotion phải kiểm tra object trùng tên/owner/ACL. File không idempotent và chỉ được chạy một lần qua migration ledger.

### 18.4 P1 — khóa Organization/Membership và permission race

Draft mô tả active Organization/Membership nhưng DDL không khóa chúng; mục 16 đã chốt lock order Organization → Membership → Receipt. Mọi business RPC phải thực hiện SELECT FOR SHARE (hoặc chế độ khóa tương đương đã xác minh) trên Organization và Membership trước khi claim/replay Receipt, để suspend/remove/disable không race với mutation/replay.

Còn một race riêng: permission role/assignment có thể bị thu hồi sau khi RPC kiểm tra permission nhưng trước khi business commit. Cần xác định permission source thực tế và khóa/đồng bộ việc thay đổi role/assignment theo cùng transaction protocol; chỉ khóa Membership là chưa đủ nếu role assignment thay đổi độc lập. Kiểm thử Admin revoke Technician permission đồng thời với mutation.

### 18.5 P1 — replay race và disclosure

- Khi request A lookup chưa thấy Receipt, request B claim/commit cùng key trước lúc A kiểm tra write permission hoặc claim, A phải recheck Receipt sau unique conflict; không được trả permission denied một cách máy móc nếu Receipt đã commit và A là cùng actor/fingerprint.
- Nếu permission bị thu hồi trong lúc request đang xử lý, quy tắc replay/snapshot phải được đánh giá ở thời điểm trả kết quả; không để result_payload bị lộ chỉ vì lúc tạo Receipt actor từng có quyền đọc.
- read_permission_codes hiện all-or-nothing cho nhiều resource. Giữ chính sách acknowledgement-only nếu thiếu một quyền đọc; không trả một phần snapshot cho tới khi thiết kế per-record permission hoàn chỉnh.
- Affected refs cũng là dữ liệu nhạy cảm tối thiểu: chỉ chứa loại resource, ID/version cần thiết; không chứa tên, mô tả, số lượng hay dữ liệu nghiệp vụ nhạy cảm. Kiểm thử cross-tenant và actor khác không thể suy ra Receipt tồn tại.

### 18.6 P2 — fingerprint, payload và vận hành

- JSONB equality phù hợp tránh phụ thuộc thứ tự key object, nhưng không tự chuẩn hóa semantics. Mỗi RPC phải chuẩn hóa số, chuỗi, null/default, timezone, enum và danh sách trước khi dựng fingerprint.
- Giới hạn kích thước fingerprint, affected refs và result_payload; không đưa base64 ảnh, bí mật, access token hoặc thông tin không cần vào Receipt.
- Xác định schema_version cho operation/result envelope để thay đổi format trong tương lai không khiến client cũ replay sai.
- created_at dùng clock_timestamp() là thời điểm claim, không phải commit order; không dùng nó thay cursor Change Feed.
- Retention ban đầu giữ Receipt vô thời hạn như mục 16; mọi cleanup/archive sau này cần chính sách retry horizon, backup/restore và idempotency key expiry được duyệt.
- Index actor_created có thể hữu ích cho tra cứu/audit nhưng không thay thế PK lookup. Đánh giá vacuum/bloat khi Receipt tăng; không thêm index tùy tiện vào payload JSONB.

### 18.7 Kết luận

**Kết luận: cấu trúc Receipt đạt về hướng thiết kế; draft 020 chưa đủ điều kiện promotion.** Blocker chính là xác minh deferred trigger có thể đọc final row trong RLS/security context thực tế. Các blocker tiếp theo là lock Organization/Membership và đồng bộ permission revocation; replay race; kiểm thử immutable state và giới hạn payload.

Checklist trước promotion:
1. Kiểm tra owner, ACL, RLS, FORCE RLS, BYPASSRLS và SECURITY DEFINER owner của mọi business RPC.
2. Test insert pending → finalize → commit; pending commit phải rollback; rollback business mutation phải rollback Receipt.
3. Test hai request cùng key đồng thời, claimant rollback, response mất, permission revoke, membership/org disable và role revoke race.
4. Test actor khác, cross-org, fingerprint mismatch, permission đọc bị thu hồi và acknowledgement không rò dữ liệu.
5. Test final Receipt không thể sửa/xóa, kể cả đường maintenance; xác nhận deferred trigger chỉ chạy dưới security context dự kiến.
6. Chốt schema_version, giới hạn payload và retention trước production.

**Trạng thái:** chỉ cập nhật review. Không sửa draft 020, không tạo migration, không chạy SQL/RPC, không thay đổi Supabase Test/Production, quyền hoặc dữ liệu.


## 19. Review luồng quản lý thành viên và permission hiện hành

Đã đọc migration role/permission, migration quản lý thành viên, migration remove membership và Edge Function manage-organization-members trên main. Static review mã nguồn; chưa xác minh migration đã apply trên Supabase, chưa chạy Edge Function/RPC và không thay đổi dữ liệu.

### 19.1 Cấu trúc permission hiện tại

- Permission hiệu lực được tính qua organization_members → member_roles → roles → role_permissions; role phải is_active, membership và organization phải active.
- has_org_permission() là SQL STABLE SECURITY DEFINER, search_path rỗng, row_security off. Nó đọc trạng thái membership/organization và role assignment nhưng không khóa các dòng liên quan.
- Các bảng roles, role_permissions, member_roles bật RLS; client chỉ có SELECT. Quyền ghi được dự kiến qua trusted backend.
- Edge Function xác thực Bearer token bằng getUser(), sau đó dùng callerClient (JWT người gọi) gọi has_org_permission(users.manage). Các thao tác ghi sau đó dùng service-role client gọi RPC.
- RPC admin_* yêu cầu auth.role() = service_role và revoke EXECUTE khỏi PUBLIC/anon/authenticated. Đây là lớp bảo vệ chống gọi trực tiếp bằng JWT thường, nhưng RPC không tự xác thực danh tính Admin của actor; nó tin p_actor_user_id do Edge Function truyền. Vì vậy Edge Function là ranh giới authorization bắt buộc, service-role key phải tuyệt đối không lộ.

### 19.2 P0 — permission check và thao tác quản trị không nằm cùng transaction

Edge Function kiểm tra users.manage trước, sau đó mới chạy các truy vấn/RPC bằng service role. Có khoảng thời gian giữa kiểm tra và thay đổi. Nếu Admin bị suspend, bị remove hoặc mất users.manage trong khoảng đó, request vẫn có thể tiếp tục.

Các RPC hiện không nhận/kiểm tra actor JWT của người gọi; chỉ yêu cầu service_role. Do đó backend authorization hiện dựa vào việc Edge Function truyền đúng actor và không có đường gọi service-role khác bỏ qua kiểm tra.

**Yêu cầu trước khi dùng làm nền cho Shared Receipt:**
- Chuyển authorization + mutation vào một transaction/RPC được gọi bằng caller JWT; hoặc thiết kế trusted RPC có cơ chế xác minh actor/ủy quyền server-side đáng tin cậy và khóa permission state trong cùng transaction.
- Không coi p_actor_user_id do service role truyền vào là bằng chứng xác thực người thao tác.
- Nếu vẫn giữ Edge Function, cần có cơ chế chống TOCTOU rõ ràng; kiểm tra quyền lại trong transaction ghi không đủ nếu giữa lần check và commit vẫn không có khóa đồng bộ.

### 19.3 P1 — các thao tác role/status chưa khóa dòng đích

- admin_remove_org_membership dùng FOR UPDATE OF m khi đọc membership trước khi xóa. Đây là thao tác duy nhất trong ba RPC update/remove có khóa membership rõ ràng.
- admin_update_org_member_role đọc membership + role hiện tại không FOR UPDATE, sau đó DELETE/INSERT member_roles. Có thể race với suspend/remove/đổi role khác.
- admin_update_org_member_status đọc membership không FOR UPDATE rồi UPDATE status. Có thể race với remove hoặc đổi role.
- admin_create_org_membership kiểm tra organization active nhưng không khóa organization; kiểm tra role active nhưng không khóa role. Có khóa auth.users để xử lý email confirmation, nhưng không thay thế khóa organization/membership.
- Role permissions và roles.is_active có thể thay đổi độc lập; has_org_permission không khóa các dòng này. Cần khóa hoặc có version/serialization protocol cho role + role_permissions + member_roles nếu muốn đảm bảo quyền không bị thu hồi giữa mutation và commit.

**Đề xuất:** chuẩn hóa lock order trước khi bổ sung Receipt: Organization → Membership (nếu có) → Role/Role assignment/permission rows cần thiết → Receipt → business rows theo hợp đồng mục 16. Với thao tác tạo membership chưa có membership row, khóa Organization trước rồi mới insert. Với thay role/suspend/remove, khóa Organization trước, sau đó SELECT membership FOR UPDATE; không được có RPC khác khóa Membership rồi quay ngược lấy Organization.

### 19.4 P1 — legacy role và role assignment có thể lệch

- admin_update_org_member_role cập nhật member_roles nhưng không cập nhật organization_members.role (legacy field). has_org_role() vẫn xét legacy role OR role assignment; has_org_permission() chỉ xét role assignment.
- Các RPC update/status/remove ngăn quản lý Admin bằng cách kiểm tra legacy role hoặc role assignment hiện hành. Nếu dữ liệu legacy và assignment lệch, cần test mọi tổ hợp; không thể giả định một nguồn luôn đúng.
- Edge Function list/reset/remove đọc assignment và role qua nhiều truy vấn riêng, không phải snapshot transaction; kết quả có thể thay đổi giữa các truy vấn. RPC cuối cần tự xác minh lại mọi invariant dưới lock, không dựa vào preflight của Edge Function.
- admin_create_org_membership không có xử lý idempotency; invite retry/timeout có thể gặp Auth user đã tạo nhưng membership chưa rõ kết quả. Invite compensation deleteUser cũng cần recheck membership trước khi xóa Auth user nếu RPC trả lỗi không rõ outcome.

### 19.5 P1 — organization status và membership status đồng bộ chưa đầy đủ

- sync_auth_user_profile() khi email được xác nhận sẽ đổi mọi membership invited của user thành active; trigger này không khóa Organization trước khi cập nhật membership. Nếu tổ chức bị disable đồng thời, membership có thể active trở lại nhưng has_org_permission vẫn chặn vì organization inactive. Dù vậy, cần quy định trạng thái membership sau khi organization disable và tránh race khi re-enable.
- Các RPC update role/status/remove hiện kiểm tra service_role, target membership và một số invariant, nhưng không kiểm tra organization active hoặc khóa organization. Edge Function permission check trước đó có kiểm tra qua has_org_permission; race disable organization vẫn có thể lọt qua nếu status đổi sau check.
- RPC remove đã khóa membership row, nhưng không khóa Organization trước đó theo lock order mới.

### 19.6 Kết luận và việc cần làm trước promotion

**Kết luận: mô hình role/permission cơ bản có thể dùng làm nền, nhưng chưa đủ concurrency/authorization guarantees để làm nguồn khóa cho Shared Receipt.** Vấn đề chính không phải thiếu bảng permission mà là check authorization tách khỏi transaction mutation và thiếu khóa nhất quán trên Organization, Membership, Role/assignment.

Thứ tự xử lý đề xuất:
1. Chốt ranh giới tin cậy: actor identity phải được xác thực server-side; không tin riêng p_actor_user_id.
2. Thiết kế một transaction boundary cho authorization + mutation; xác định cách permission revoke/suspend/remove serialize với business RPC.
3. Chuẩn hóa lock order Organization → Membership → Role/assignment/permission → Receipt → business rows.
4. Bổ sung khóa FOR UPDATE cho role/status/remove và khóa Organization cho create/update/remove/sync-confirmation; xử lý role assignment/permission mutation đồng bộ.
5. Làm rõ nguồn dữ liệu role chính thức; xử lý legacy organization_members.role và member_roles lệch.
6. Bổ sung idempotency/timeout recovery cho invite và kiểm soát compensation Auth user.
7. Test concurrency: suspend/remove Admin trong lúc mutation; revoke users.manage/permission trong lúc mutation; đổi role đồng thời; disable organization đồng thời với invite/confirm; hai request quản trị cùng membership.

**Trạng thái:** chỉ cập nhật review. Không sửa migration 005/013/014, Edge Function, không tạo migration mới, không chạy SQL/RPC, không deploy Edge Function và không thay đổi Supabase.

## 20. Review Change Feed và đồng bộ khóa authorization – 19/11/2026

Phạm vi: đối chiếu CLOUD_RPC_IDEMPOTENCY_CHANGEFEED_DESIGN.md, CLOUD_SYNC_SCHEMA_PROTOCOL_DESIGN.md, migrations 005/006 và các kết quả review Shared Receipt/member lifecycle. Đây là static review trên repository main; không có change-feed migration/RPC đang được xác nhận triển khai trong repo. Không truy cập hoặc thay đổi Supabase.

### 20.1 Kết luận

**Giữ thiết kế counter theo organization và transaction commit-order, nhưng chưa đủ điều kiện viết migration change feed.** Cần chốt thêm semantics phân trang có lọc permission, payload disclosure, retention/device cursor, và phối hợp khóa permission với mutation.

Ba cơ chế phải giữ đúng vai trò:
- Organization/Membership/Role locks: ổn định phạm vi tenant và quyết định authorization trong transaction.
- Shared Receipt + row_version: nhận diện/replay mutation và phát hiện ghi đè đồng thời.
- Change Feed + cursor: phân phối thay đổi đã commit đến các thiết bị; không thay thế Receipt hoặc authorization.

### 20.2 Những điểm thiết kế đang đúng

1. Counter riêng từng organization, khóa row trong transaction ghi nghiệp vụ, cấp cursor rồi insert event trong cùng transaction. Transaction khác cùng organization phải chờ lock, vì vậy cursor cấp sau không thể commit trước transaction cấp trước.
2. Không dùng PostgreSQL sequence độc lập làm cursor commit-order.
3. Một logical mutation nhiều record tạo một Receipt và một event cho mỗi record thực sự thay đổi; Task + Log là ví dụ hai event cùng transaction.
4. Conflict/no_change có Receipt nhưng không có event; rollback không để lại counter/event.
5. Delete cần tombstone không phụ thuộc FK tới record đã xóa.
6. Client apply nguyên page vào một Dexie transaction; chỉ cập nhật local cursor sau khi toàn bộ page thành công.
7. Không overwrite Local record đang có mutation pending/processing/conflict; cần tạo trạng thái conflict/reconciliation.
8. Pull RPC phải xác thực Auth, organization active, active membership và quyền xem; client không được quyết định organization scope chỉ bằng payload.

### 20.3 P0 – Cursor phải tiến qua event bị lọc quyền

Thiết kế hiện nói pull trả events theo permission và next_cursor, nhưng chưa định nghĩa trường hợp một page có event mà actor không được xem.

Nếu server chỉ trả event nhìn thấy và đặt cursor bằng cursor của event cuối cùng trả về, client có thể đọc lặp vô hạn hoặc không tiến qua vùng event bị ẩn. Nếu server nhảy cursor qua event ẩn nhưng không báo rõ ranh giới đã quét, client không thể phân biệt “không có event” với “có event nhưng bị lọc”.

**Hợp đồng cần chốt:**
- Phân biệt scanned_through_cursor (ranh giới server đã quét) với danh sách event được phép trả.
- Server quét theo cursor tăng dần, giới hạn số event đã quét, không chỉ số event trả về.
- Response phải cho client biết cursor an toàn để tiếp tục, kể cả page không có event hiển thị.
- Nếu dùng opaque cursor thì token phải mang được ranh giới quét và high-watermark; không để client tự tăng cursor tùy ý.
- Khi page rỗng do tất cả event bị lọc, cursor vẫn phải tiến đến ranh giới đã quét.
- Test liên tiếp nhiều page có event xen kẽ được phép/không được phép; không lặp vô hạn, không bỏ sót event có quyền.

Không được dùng một next_cursor mơ hồ vừa là last returned event vừa là scan boundary.

### 20.4 P0 – Payload phải được lọc theo từng capability

Không được trả nguyên payload JSONB chỉ vì người dùng có một quyền view chung. Mỗi event phải ánh xạ rõ bảng/aggregate và permission tương ứng:
- assets → assets.view
- inventory_items / inventory_movements → inventory.view
- maintenance_tasks / maintenance_plans → maintenance.view
- checklist_templates / versions / results → checklist.view
- maintenance_logs / revisions → logs.view
- organization_settings → settings.view hoặc capability hẹp hơn nếu dữ liệu có trường nhạy cảm.

Nếu một mutation tạo nhiều loại record (ví dụ Task + Log), quyền đọc từng event có thể khác nhau. Phải lọc độc lập từng event, không để quyền xem Task vô tình mở snapshot Log.

Với payload snapshot:
- Chỉ chứa allowlist cột đã duyệt, không serialize toàn bộ row một cách mặc định.
- Không đưa token, dữ liệu Auth, thông tin bí mật, hoặc trường quản trị không thuộc permission view.
- Delete tombstone chỉ chứa identity/version/metadata tối thiểu cần xóa đúng Local record.
- Quyền đọc được đánh giá tại thời điểm pull; Receipt replay và Change Feed pull là hai đường riêng, cùng tuân theo quyền hiện tại.

Cần chốt rõ snapshot event hay reference-only event. Không trộn hai mô hình tùy từng RPC. Snapshot giúp apply đúng lịch sử; reference-only cần quy tắc latest-state fetch/coalescing và xử lý update/delete xen kẽ.

### 20.5 P0 – Khóa authorization phải bao phủ cả role và permission

Migration 005 hiện có has_org_permission() là SQL STABLE SECURITY DEFINER, đọc Organization, Membership, member_roles, roles và role_permissions nhưng không khóa các row này. Migration 006 dùng helper trong RLS policy. Vì vậy helper hiện tại là phép kiểm tra quyền phục vụ RLS/read, không phải cơ chế serialize authorization với business mutation.

Đề xuất cho mọi business RPC dùng Shared Receipt và Change Feed:
1. Xác thực auth.uid().
2. Khóa Organization trước, xác nhận active.
3. Khóa Membership của actor sau, xác nhận active.
4. Khóa các dòng member_roles/roles/role_permissions liên quan đến capability cần thiết theo thứ tự cố định; xác nhận role active và permission còn được cấp.
5. Sau khi authorization đã ổn định mới xử lý Receipt, business rows, counter, events và finalize Receipt.

Các thao tác quản trị có thể làm thay đổi trạng thái/quyền phải tuân cùng thứ tự khóa Organization → Membership → Role assignment/Role → Role permission. Cần rà soát riêng thao tác xóa membership, suspend, đổi role, deactivate role và revoke permission để tránh đường quản trị bỏ qua lock protocol.

Lưu ý:
- FOR SHARE trên Organization/Membership ngăn UPDATE/DELETE tương ứng chen vào cho đến khi mutation kết thúc; phải xác minh bằng concurrency test trên đúng PostgreSQL/Supabase.
- Khóa row permission đang được cấp để ngăn DELETE/UPDATE revoke chen giữa check và commit. Nếu permission không tồn tại, request có thể bị từ chối; một grant đồng thời không được phép làm request đã kiểm tra deny tự động thành allow.
- Không đổi has_org_permission() thành helper khóa dùng chung cho RLS nếu chưa phân tích volatility, RLS recursion và lock ordering. Nên có authorization routine riêng cho RPC transaction, với schema-qualified SQL và quyền EXECUTE giới hạn.
- Permission được thu hồi sau khi RPC đã lấy đủ locks và authorize thì không hồi tố mutation đó; thao tác revoke phải chờ transaction đã authorize kết thúc. Đây là ranh giới hiệu lực cần ghi rõ trong tài liệu và test.

### 20.6 Counter contention và multi-record event ordering

Một counter row mỗi organization là lựa chọn đơn giản, dễ chứng minh đúng nhưng biến thành điểm tuần tự hóa mọi mutation trong tenant. Điều này có thể giới hạn throughput khi doanh nghiệp có nhiều thiết bị ghi đồng thời.

Giai đoạn đầu có thể chấp nhận trade-off để ưu tiên correctness. Trước khi scale cần đo:
- Thời gian chờ lock counter và transaction duration.
- Số event trung bình / mutation, đặc biệt Task + Log và inventory.
- Tác động khi RPC giữ counter lock trong lúc làm validation hoặc truy vấn phụ.

Quy tắc thực thi:
- Không lấy counter lock trước khi đã xác thực và khóa business rows cần thiết; không giữ lock trong khi làm tác vụ mạng/ngoài transaction.
- Một mutation nhiều event cấp các cursor liên tiếp dưới cùng một lock; tất cả event commit/rollback cùng Receipt và business rows.
- Chốt thứ tự event ổn định trong một mutation (ví dụ theo thứ tự loại record đã quy định trong RPC), không phụ thuộc thứ tự trả về ngẫu nhiên của query.
- Tất cả RPC phải tuân cùng lock order; kiểm tra deadlock khi hai mutation chạm nhiều business rows.

### 20.7 Retention, device cursor và resync

Tài liệu hiện nêu retention và resync_required nhưng chưa có mô hình dữ liệu đủ cụ thể để xóa an toàn:
- Cần định danh từng device/install độc lập (PC và Mobile không dùng chung cursor).
- Lưu cursor đã apply thành công và last_seen của từng device trong tenant.
- Xác định thiết bị nào được xem là active, thời gian grace, quy trình revoke device và xử lý thiết bị mất.
- Chỉ xóa events khi mọi device còn trong chính sách retention đã vượt qua cursor tương ứng, hoặc đã đánh dấu device stale/revoked và buộc full resync.
- Full resync cần snapshot boundary/high-watermark nhất quán; dữ liệu snapshot và cursor phải cùng một mốc logic.
- Khi cursor cũ hơn retention, trả resync_required; tuyệt đối không trả page rỗng như thể không có thay đổi.

Không triển khai cleanup job trước khi có chính sách device lifecycle và snapshot boundary.

### 20.8 Phân biệt ba cursor và nguyên tắc apply Local

Cần phân biệt rõ:
- last_committed_cursor: counter cao nhất đã commit ở Cloud.
- scanned_through_cursor: ranh giới pull server đã quét/đánh giá quyền.
- applied_cursor: cursor Local đã apply thành công trong Dexie.

Không đồng nhất ba giá trị. Client chỉ advance applied_cursor cùng transaction Dexie áp dụng page. Nếu crash trước commit Dexie, lần pull sau phải lấy lại page cũ. Nếu event bị lọc quyền, server vẫn phải cung cấp scan boundary an toàn nhưng không được làm client đánh dấu đã apply snapshot mà họ chưa được phép đọc.

### 20.9 Test bắt buộc trước khi tạo migration thực thi

- Hai transaction cùng organization cấp cursor; cursor thấp commit trước cursor cao.
- Transaction giữ counter rồi rollback: không có lỗ cursor đã commit.
- Một mutation Task + Log phát đúng hai event, một Receipt; lỗi ở bất kỳ bước nào rollback cả hai event và business rows.
- Event xen kẽ quyền cho phép/không cho phép qua nhiều page; scan cursor tiến đúng, không lặp/skip.
- User có maintenance.view nhưng không có logs.view không nhận payload Log.
- Tombstone không lộ payload đã xóa và xóa đúng record Local.
- Permission bị revoke đồng thời: revoke chờ mutation đã authorize; mutation đến sau revoke bị deny.
- Role assignment/deactivation/revoke permission đồng thời với RPC; không có mutation commit dựa trên permission đã bị thu hồi trước authorization point.
- Hai mutation nhiều record với lock order nhất quán không deadlock.
- Client lỗi khi apply event giữa page: Dexie rollback và applied_cursor không tiến.
- PC và Mobile có cursor riêng; một thiết bị offline lâu không làm thiết bị kia bị lùi cursor.
- Cursor hết retention, device revoked, full resync snapshot boundary.
- Pull retry cùng cursor/opaque token trả cùng phạm vi event và scan boundary, không có side effect.

### 20.10 Trạng thái và thứ tự tiếp theo

- Change Feed hiện vẫn ở mức thiết kế; chưa tìm thấy migration, bảng, RPC hoặc worker tương ứng trong repository main.
- Không tạo migration change feed ở bước này.
- Không sửa has_org_permission(), RPC thành viên, Edge Function hoặc client sync.
- Không chạy SQL, không gọi RPC, không ghi dữ liệu hoặc quyền Cloud.
- Trước khi viết SQL draft, cần cập nhật hợp đồng Change Feed để chốt scan cursor, permission filtering, snapshot model, device cursor/retention; đồng thời lập lock matrix cho mọi RPC nghiệp vụ và RPC quản trị thành viên/role/permission.

## 21. Lock Matrix thống nhất cho RPC nghiệp vụ và quản trị – 19/11/2026

Phạm vi: đối chiếu migrations 005, 012, 013, 014, 017 và các thiết kế Shared Receipt, Change Feed. Static review repository main; không xác nhận migration đã được áp dụng lên Supabase. Không thay đổi SQL hoặc dữ liệu.

### 21.1 Kết luận kiến trúc

Chốt một protocol lock thống nhất cho các RPC mới:

**Organization → Actor Membership → Actor Role Assignments → Roles → Role Permissions → Target Membership (nếu quản trị thành viên khác) → Receipt → Business rows theo thứ tự ID → Asset Lease (nếu có, theo quy ước cần thống nhất) → Organization Sync Counter → Change events → Receipt finalize.**

Có một điểm cần điều chỉnh trước khi viết SQL: Asset Lease hiện được lấy trước Asset row và Asset-specific Receipt được tra trước Lease. Khi chuyển Asset sang Shared Receipt, phải thống nhất một thứ tự duy nhất cho Receipt/Lease/Asset rows và mọi RPC Asset cùng tuân thủ; không được giữ hai lock order chồng chéo. Khuyến nghị giữ lock order chung: authorization locks → Receipt claim/replay → Lease row → Asset row → counter → events → finalize. Receipt replay chỉ đọc không được lấy Lease hoặc Business row không cần thiết.

Lock matrix không có nghĩa mọi RPC phải khóa mọi loại row. RPC chỉ khóa các lớp cần cho operation nhưng không được đảo thứ tự tương đối giữa các lớp mà nó cùng sử dụng.

### 21.2 Lock matrix theo nhóm RPC

| Nhóm RPC | Actor authorization | Target / role locks | Receipt | Business rows | Counter / event |
|---|---|---|---|---|---|
| Asset create/import/update/archive/restore/status | Organization + actor Membership + permission tương ứng | Role/Permission rows | Shared Receipt; Asset-specific Receipt/Lease phải có kế hoạch chuyển tiếp | Asset Lease rồi Asset row; code counter nếu allocator | Counter + event cho Asset |
| Inventory create/opening stock/In/Out/Adjustment | Organization + Membership + inventory.create hoặc inventory.adjust | Role/Permission rows | Shared Receipt | Inventory item row FOR UPDATE; movement ID uniqueness | Counter + Item/Movement events |
| Task create/update/delete/complete | Organization + Membership + maintenance.create/update/delete | Role/Permission rows | Shared Receipt | Task row; complete còn tạo Log root/revision trong cùng transaction | Counter + từng event thực sự thay đổi |
| Maintenance Plan create/update/delete | Organization + Membership + maintenance.create/update/delete | Role/Permission rows | Shared Receipt | Plan rows, nhiều row theo thứ tự ID cố định | Counter + Plan events |
| Checklist Template/Version | Organization + Membership + checklist.template.manage | Role/Permission rows | Shared Receipt | Template row; version append-only | Counter + Template/Version events |
| Checklist Result | Organization + Membership + checklist.result.create | Role/Permission rows | Shared Receipt | Template/version chỉ đọc để xác thực; Result append-only | Counter + Result event |
| Maintenance Log create/revise | Organization + Membership + logs.create hoặc logs.revise | Role/Permission rows | Shared Receipt | Log root; revision mới append-only; complete Task phải khóa Task trước Log theo thứ tự định nghĩa | Counter + Log/Revision events |
| Organization Settings | Organization + Membership + settings.manage | Role/Permission rows | Shared Receipt | Settings row | Counter + Settings event |
| Member invite/create membership | Organization + actor Membership + users.manage | Role target; Membership uniqueness; Auth user lock nếu cần | Receipt/idempotency riêng cho invite workflow | Organization Membership + member_roles | Change event quản trị nếu member roster thuộc feed |
| Member role change | Organization + actor Membership + users.manage/roles.manage theo policy chốt | Target Membership → target member_roles → Role → Role Permission | Receipt quản trị | Xóa/gán member_roles trong cùng transaction | Event membership/role nếu client sync roster |
| Member suspend/activate | Organization + actor Membership + users.manage | Target Membership | Receipt quản trị | Update membership status | Event membership status |
| Member remove | Organization + actor Membership + users.manage | Target Membership FOR UPDATE; member_roles cascade | Receipt quản trị | Delete membership, giữ Auth/Profile | Tombstone membership event nếu roster sync |
| Role/Permission catalog management | Organization + actor Membership + roles.manage | Role → Role Permission rows theo ID/code cố định | Receipt quản trị | Role/role_permissions | Events nếu role catalog được đồng bộ |

### 21.3 Quy tắc khóa và tránh deadlock

1. Luôn khóa Organization trước Membership; kiểm tra trạng thái active sau khi lấy lock.
2. Actor Membership luôn trước target Membership. Nếu actor và target là cùng một row, chỉ khóa một lần. Khi một RPC cần khóa nhiều Membership, sort theo UUID trước khi khóa.
3. Role rows và role_permissions phải được khóa theo thứ tự ổn định (role_id, permission_code); không query join rồi dựa vào thứ tự planner để suy ra thứ tự khóa.
4. Mọi business rows nhiều bản ghi phải khóa theo (table rank, primary key) đã quy định. Task + Log và các mutation batch phải dùng cùng thứ tự trong mọi RPC.
5. Chỉ lấy counter sau khi đã khóa/validate các business rows cần thay đổi; counter được giữ đến COMMIT để bảo đảm commit-order cursor.
6. Không gọi mạng, Edge Function, Auth Admin API hoặc thao tác ngoài PostgreSQL trong lúc đang giữ transaction locks.
7. Có thể deadlock do FK/cascade/trigger tự lấy lock khác thứ tự; phải chạy concurrency test với đúng schema và PostgreSQL version, không chỉ dựa trên bảng matrix.
8. Không dùng advisory lock thay thế row locks nếu chưa chứng minh key space, tenant isolation và thứ tự tương tác với FK/row locks.

### 21.4 P0 – Hiện trạng migration 013/014 chưa đáp ứng matrix

Static review cho thấy:
- admin_create_org_membership kiểm tra Organization active nhưng không khóa Organization; chọn Role không khóa Role; khóa auth.users nhưng không khóa/serialize trạng thái Organization theo protocol.
- admin_update_org_member_role đọc target Membership và Role mà không FOR UPDATE; sau đó DELETE/INSERT member_roles.
- admin_update_org_member_status đọc target Membership nhưng chỉ khóa ngầm tại câu UPDATE cuối; không có khóa Organization/actor authorization trong cùng RPC.
- admin_remove_org_membership có FOR UPDATE target Membership, nhưng chưa khóa Organization và actor Membership trước đó.
- Các RPC trên yêu cầu service_role và nhận p_actor_user_id từ caller; actor authorization hiện nằm ở Edge Function trước khi gọi RPC. Điều này tạo khoảng TOCTOU giữa kiểm tra users.manage và thay đổi Membership.
- sync_auth_user_profile() trigger kích hoạt khi xác nhận email và cập nhật invited Membership nhưng không đi qua cùng Organization lock protocol. Đây là luồng hệ thống riêng cần đưa vào matrix, không được bỏ qua.
- has_org_permission() ở migration 005 là helper STABLE không khóa các row permission; tiếp tục dùng cho RLS/read, không coi là authorization lock cho mutation.

**Hướng sửa đề xuất:** chuyển xác thực actor và kiểm tra users.manage vào cùng transaction DB với thao tác quản trị. Ưu tiên RPC quản trị được gọi bằng JWT của actor, lấy auth.uid() bên trong, SECURITY DEFINER với search_path rỗng và grant EXECUTE phù hợp; Edge Function tiếp tục làm Auth Admin invite/reset-password nhưng không được là nơi duy nhất kiểm tra quyền cho mutation membership. Nếu bắt buộc dùng service_role RPC, phải có cơ chế actor assertion tin cậy không thể giả mạo từ client và vẫn kiểm tra/khóa permission trong transaction; tham số p_actor_user_id đơn thuần không đủ.

### 21.5 P0 – Asset hiện tại là ngoại lệ chuyển tiếp

Migration 017 apply_asset_mutation_with_lock hiện:
- Kiểm tra assets.update trước khi tra Asset Receipt; retry sau khi quyền bị thu hồi có thể bị chặn dù mutation đã commit.
- Tra Receipt trước khi lấy Lease, sau đó khóa Lease rồi Asset.
- Dùng Asset-specific Receipt và expected_cloud_updated_at, không dùng Shared Receipt/row_version.
- Chưa khóa Organization/Membership/Role/Permission theo protocol chung.
- Chưa phát Change Feed event.

Không thay đổi Asset Lease hoặc Asset Receipt trong bước review này. Khi chuyển đổi phải có migration/bridge rõ ràng để không tạo hai nguồn idempotency và không làm mất khả năng replay mutation cũ. Không cho phép một RPC khóa Asset trước Receipt trong khi RPC khác khóa Receipt trước Asset.

### 21.6 P1 – Phân biệt business mutation và quản trị membership

Membership/Role là dữ liệu quản trị tenant, không phải Asset/Inventory/Task. Nếu muốn đồng bộ roster qua Change Feed, phải định nghĩa permission xem roster riêng (users.view/roles.view), payload allowlist và tombstone riêng. Không tự đưa email/Auth metadata vào Change Feed.

Invite có hai hệ thống transaction không thể gộp nguyên tử: Supabase Auth Admin API và PostgreSQL membership. Cần saga có operation ID/Receipt:
- Tạo Auth user thành công nhưng membership chưa tạo: retry phải tìm/đối chiếu Auth identity trước khi tạo trùng.
- Membership RPC timeout: phải query trạng thái bằng cùng operation ID trước khi bù trừ hoặc xóa Auth user.
- Chỉ được xóa Auth user vừa tạo khi chứng minh membership chưa commit và user chưa được gắn với workflow khác.
- Email confirmation trigger đổi invited → active phải idempotent và có thứ tự khóa tương thích.

### 21.7 Các quyết định cần giữ

- Authorization được xác định tại thời điểm RPC lấy đủ authorization locks và kiểm tra quyền. Revoke bắt đầu sau thời điểm đó phải chờ transaction đã authorize; không hồi tố.
- Replay Receipt đã commit: Auth + Organization active + actor Membership active; không yêu cầu write permission cũ. Snapshot chỉ trả nếu current read permissions cho phép; nếu không chỉ acknowledgement tối thiểu.
- Actor khác hoặc cross-org không được dò Receipt.
- Business RPC và admin RPC không nhận actor identity hoặc permission list do client tự khai để làm căn cứ thẩm quyền.
- Mọi RPC ghi business data phải tạo Receipt + business rows + Change Feed events trong cùng transaction sau khi nền tảng sẵn sàng.
- Không cho phép direct PostgREST write bypass RPC sau vertical cutover.

### 21.8 Trình tự tiếp theo

1. Chốt lock matrix và lock order ở mục 21; kiểm tra riêng Asset Lease order và Task+Log multi-row order.
2. Sửa tài liệu Shared Receipt/Change Feed để phản ánh Role/Permission locks và scan cursor.
3. Thiết kế lại member-management RPC contract (actor từ JWT, không tin p_actor_user_id từ service role), đồng thời thiết kế invite saga/operation receipt.
4. Hoàn tất row_version + Shared Receipt + counter/change feed schema drafts; review DDL/trigger/grants/RLS.
5. Chỉ sau khi người dùng duyệt mới tạo migration executable draft; chưa chạy trên Test hoặc Production nếu chưa có lệnh rõ ràng.

Không sửa migration 013/014/017, không sửa Edge Function, không tạo SQL, không chạy SQL, không gọi RPC, không thay đổi Supabase trong lượt review này.



## §22 — Đối chiếu Edge Function quản lý thành viên và Invite Saga

Phạm vi: static review `supabase/functions/manage-organization-members/index.ts`, migrations 001/005/013/014, draft 020 và thiết kế `CLOUD_MEMBER_MANAGEMENT_RPC_DESIGN.md`. Không chạy code/SQL, không gọi Auth Admin API, không thay đổi Supabase.

### Kết luận chính

1. **TOCTOU xác nhận:** Edge Function gọi `has_org_permission(users.manage)` bằng caller JWT, sau đó chuyển sang service_role để thực hiện đọc/ghi. Các RPC 013/014 chỉ chấp nhận service_role và nhận actor qua `p_actor_user_id`. Vì vậy authorization và mutation không nằm trong cùng transaction; actor truyền vào chưa được DB ràng buộc với auth.uid().
2. **Invite compensation nguy hiểm:** Invite tạo Auth user rồi gọi `admin_create_org_membership`; nếu RPC trả lỗi, code gọi `deleteUser` nhưng bỏ qua kết quả. Timeout/response không rõ không chứng minh membership chưa commit. Không thể giữ cách bù trừ này.
3. **Target checks ở Edge Function không đủ:** update role/status/remove đọc target và role assignments trước RPC. Những kết quả đọc có thể stale; RPC phải tự khóa target và role assignments, kiểm tra Admin/self/status trong cùng transaction.
4. **Roster authorization chưa tách:** action list dùng users.manage. Product đã chốt chưa bật roster Change Feed; khi chỉnh luồng đọc, dùng users.view riêng hoặc giới hạn roster cho Admin, không dùng users.manage như quyền đọc mặc định.
5. **Reset password là Auth side effect:** không phải business mutation Receipt/Change Feed; cần actor permission và target eligibility được xác minh server-side, không lưu email/recovery data vào Receipt.
6. **Email confirmation trigger là writer thứ hai:** migration 013 trigger `sync_auth_user_profile()` đổi invited → active mà chưa theo Organization → Membership lock order. Phải kiểm thử deadlock với Auth transaction; nếu không thể tuân lock order, dùng worker/Edge Function idempotent.

### Hợp đồng đã chốt ở mức thiết kế

- RPC database mutation được gọi bằng JWT actor; actor lấy từ auth.uid(). service_role chỉ dùng cho Auth Admin API.
- Begin Invite ghi operation intent bền vững trước Auth provisioning; Auth Admin phase; Finalize membership bằng actor JWT và recheck permission. Không có transaction xuyên Auth API + PostgreSQL.
- Operation saga tách khỏi Shared Receipt: operation có trạng thái nhiều pha; Receipt đại diện transaction database đã commit.
- Timeout ở bất kỳ pha nào là unresolved cho đến khi query/reconcile bằng cùng operation_id. Không tạo ID mới, không xóa Auth user khi outcome chưa rõ.
- Admin khác có thể adopt operation unresolved chỉ qua RPC riêng, kiểm tra quyền hiện tại và ghi audit; không sửa actor/fingerprint của Receipt ban đầu.
- Invite/create, role change, status change, remove cần idempotency Receipt. Chưa phát roster Change Feed.
- List roster dùng users.view riêng. Reset password không có business Receipt/Change Feed.
- Ba mặc định người dùng xác nhận: chỉ Admin quản lý; không self-change/self-suspend/self-remove; suspend/remove chỉ chặn quyền tenant qua Membership, không xóa Auth session toàn cục; chưa đồng bộ roster qua Change Feed.

### Các việc chưa được quyết định/kiểm chứng

- Quyền cụ thể nào được cấp users.view và dữ liệu roster nào được hiển thị.
- Cơ chế adoption/recovery cho Invite saga khi actor gốc mất quyền hoặc bị vô hiệu.
- Khả năng chuyển invited → active qua trigger theo lock order mà không deadlock; cần concurrency test.
- RLS/function owner/grants và quyền gọi RPC bằng authenticated JWT phải được kiểm thử trên Supabase Test.
- Không có bằng chứng migrations 013/014 đã áp dụng vào bất kỳ project Supabase nào.

Không có thay đổi code, Edge Function, SQL migration, database hoặc Supabase. Đây chỉ là tài liệu thiết kế/review.


## §23 — Thiết kế bảng Invite Saga và phục hồi

Static design review ngày 19/11/2026. Đã bổ sung mục 15 trong `CLOUD_MEMBER_MANAGEMENT_RPC_DESIGN.md`.

### Kết luận kiến trúc

- Tách `organization_member_invite_operations` khỏi Shared Receipt: Saga là workflow nhiều transaction + Auth API; Receipt chỉ đại diện DB mutation đã commit.
- Operation key là (organization_id, operation_id), fingerprint do server chuẩn hóa; actor gốc bất biến.
- State machine phân biệt requested, auth_calling, auth_outcome_unknown, auth_user_resolved, finalize_pending, completed, needs_review, failed_terminal, cancelled. Timeout không phải failed.
- Các transition dùng expected status/version compare-and-set; operation/audit không cho client ghi trực tiếp.
- Begin và Finalize dùng actor JWT + auth.uid(); Auth provisioning chỉ dùng server identity cho Auth Admin API và server-only operation RPC. Không dùng service_role để giả danh actor trong Finalize.
- Crash window Auth create thành công nhưng chưa ghi auth_user_id là không thể loại bỏ bằng transaction Postgres. Không dựa email trùng hoặc user_metadata để chứng minh ownership; unresolved không tự gắn và không tự xóa.
- Finalize tạo membership + role assignment + Shared Receipt atomic; timeout sau commit phải replay cùng operation ID/Receipt.
- Lease hết hạn chỉ cho worker reconcile; không tự động gửi invite lần nữa. Không giữ DB locks khi gọi Auth API.
- Default compensation: không tự động delete Auth user nếu không chứng minh được ownership và absence of membership/other use.
- Adoption của Admin khác được đề xuất nhưng chưa được người dùng xác nhận; nếu chấp thuận, actor gốc/fingerprint không đổi và adoption có audit riêng.

### Các điểm chưa được quyết định/kiểm chứng

1. Admin khác có được adoption operation không?
2. Có worker nền ngay giai đoạn đầu hay recovery thủ công?
3. Policy cho Auth user đã tồn tại/chưa xác nhận email.
4. RLS, grants, function owner, service-only RPC và Auth Admin metadata/provenance phải được kiểm chứng trong môi trường test.
5. Không có SQL draft hoặc runtime test; chưa xác minh migrations đang áp dụng ở Supabase.

Không sửa Edge Function/migration, không chạy SQL/RPC, không thay đổi Supabase.


## §24 — Quyết định Invite Saga và email confirmation lock review

### Quyết định người dùng xác nhận

- Admin khác được adoption Invite unresolved bằng RPC riêng, authorization hiện tại + reason + append-only audit; không đổi actor/fingerprint/Receipt gốc.
- Giai đoạn đầu không có worker nền; recovery thủ công có kiểm soát từ Admin UI/Edge Function.
- Nếu không chứng minh được Auth user ownership, giữ user và chuyển needs_review; không tự xóa/gắn membership.

### Phát hiện migration 013

Trigger `sync_auth_user_profile()` AFTER UPDATE trên `auth.users` đồng bộ Profile và trực tiếp UPDATE `organization_members` invited → active. Đây là membership writer thứ hai bên trong Auth transaction và chưa theo lock matrix Organization → Membership. Khi Finalize Invite khóa tenant/member rồi chờ Auth user trong khi Auth trigger giữ Auth row rồi chờ membership, có nguy cơ deadlock.

### Hướng thiết kế đề xuất

- Không để Auth trigger trực tiếp cập nhật organization_members.
- Finalize tạo membership active nếu email đã confirmed tại thời điểm kiểm tra, nếu chưa thì invited.
- Nếu confirmation chạy đồng thời và membership vẫn invited, user sau khi có Auth session gọi RPC `activate_my_confirmed_membership(organization_id)` để tự kích hoạt membership của chính mình; RPC xác minh email_confirmed_at, khóa Organization → Membership, idempotent.
- Trigger có thể tiếp tục đồng bộ Profile nhưng không được thực hiện tenant membership mutation.
- Cần review riêng Profile sync lock interaction, quyền đọc Auth column, SECURITY DEFINER/grants và test race trên Supabase Test.

### Ranh giới

Đây là thiết kế, không phải kết luận runtime đã chứng minh. Chưa sửa migration 013, chưa tạo SQL draft, chưa chạy SQL/RPC, chưa thay đổi Supabase. Cần chốt audit semantics của self-activation (đề xuất append-only audit tối thiểu, không Receipt/Change Feed payload chứa PII).


## §25 — Static review quyền roster và dữ liệu thành viên

### Phát hiện hiện trạng

- Permission catalog đã có users.view/users.manage.
- Admin nhận toàn bộ; Technician không có users.view; Viewer được seed mọi permission action=view nên hiện nhận users.view.
- Edge Function `manage-organization-members` đang kiểm tra users.manage ở đầu handler cho cả action list.
- List query qua service_role đọc Profile email và trả email cùng display name, role, status, created_at.
- UI OrganizationMembersPanel trộn đọc roster và thao tác quản trị trong cùng panel; chưa phân lớp theo users.view/users.manage.
- Migration 013 hạn chế SELECT Profile.email với authenticated; Edge Function service_role là đường đọc email hiện tại.

### Thiết kế đề xuất

- Tách users.view (đọc roster) khỏi users.manage (thay đổi membership).
- Admin mặc định có cả hai; Technician không có; Viewer không được cấp users.view mặc định dù permission có action=view. Custom role có thể được cấp riêng.
- users.view chỉ nhận membership_id, display_name, role, status, created_at; không nhận email/Auth metadata/phone/user ID nếu không cần.
- Chỉ users.manage mới nhận email và các chức năng quản trị.
- Edge Function dispatch permission theo action; list dùng read-only RPC kiểm tra actor + tenant ở server, không tin organizationId do client gửi. Các mutation tiếp tục cần users.manage và authorization cuối cùng nằm trong transaction/RPC.
- UI tách roster read-only với controls quản trị; ẩn control chỉ là UX, backend vẫn bắt buộc kiểm tra quyền.

### Kiểm thử bắt buộc

Admin, users.view-only, users.manage-only, Technician, Viewer, custom role; tenant spoofing; organization/membership inactive; permission revoke race; pagination; missing Profile/role; không rò email qua API/log/feed.

### Khuyến nghị chờ xác nhận

Mặc định không cho Viewer xem roster. Đây là quyết định privacy/hiển thị nhân sự, không nên tự suy ra chỉ vì Viewer là read-only. Chưa sửa migration 005, Edge Function, UI hoặc Cloud; chưa tạo SQL draft và chưa chạy SQL/RPC.


## §26 — Roster RPC design và policy Viewer

### Policy được chốt để triển khai

- Viewer mặc định không được xem roster.
- Admin có users.view + users.manage; Technician không có; Viewer không có users.view.
- Custom Role có thể được cấp users.view riêng.
- users.manage không ngầm cấp quyền đọc; list yêu cầu users.view riêng.

### RPC đề xuất

`list_organization_members` là read-only SECURITY DEFINER, caller JWT/auth.uid(), kiểm tra organization active + actor membership active + users.view trong cùng statement. Trả membership_id, display_name, role code/name, status, created_at; tuyệt đối không email/phone/Auth metadata/user ID. Roster gồm invited/active/suspended, không gồm removed.

Keyset pagination theo (created_at,id), page size 1..100, không OFFSET/COUNT; cursor gồm đủ hai thành phần hoặc cả hai NULL. Tất cả truy vấn tenant-scoped. Edge Function nếu còn làm transport phải gọi RPC bằng caller JWT; không dùng service_role SELECT sau một pre-check permission riêng.

### Phát hiện migration seed cần sửa

Migration 005 seed Viewer bằng mọi permission có action='view', vì vậy Viewer hiện được cấp users.view. Migration triển khai phải dùng allowlist rõ hoặc loại trừ users.view và thu hồi permission đã cấp cho Viewer ở các organization đã seed; không chỉ sửa câu INSERT cho tổ chức mới.

### Điểm chưa chốt kỹ thuật

Schema member_roles cho phép nhiều role trên một membership, trong khi UI hiện giả định một role. Trước SQL RPC cần chọn một trong hai: constraint một role system hiện hành/membership hoặc trả roles[] có thứ tự ổn định và cập nhật UI. Không được lấy role tùy tiện bằng LIMIT 1.

### Ranh giới

Policy Viewer không xem roster đã được chốt cho thiết kế. Chưa tạo migration/draft SQL, chưa sửa code/Edge Function/UI, chưa chạy SQL/RPC và chưa thay đổi Supabase.
