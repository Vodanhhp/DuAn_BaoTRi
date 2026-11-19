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


## §27 — Chốt mô hình một role hiện hành trên mỗi membership

Người dùng đồng ý dùng một role hiện hành cho mỗi membership trong phiên bản hiện tại; chưa hỗ trợ multi-role.

Migration 005 hiện dùng PK `(organization_id, member_id, role_id)`, nên database đang cho phép nhiều role. UI chỉ biểu diễn một role. Khi triển khai cần unique constraint/index `(organization_id, member_id)`, nhưng trước đó phải preflight duplicate và dừng migration nếu có dữ liệu nhiều role; không tự xóa/chọn role. Đổi role phải atomic DELETE+INSERT trong một transaction, có lock và audit/Receipt theo chuẩn. `member_roles` là nguồn quyền; legacy `organization_members.role` chỉ là mirror tương thích cho tới khi audit hết nơi đọc.

Roster RPC trả một role duy nhất; thiếu assignment là integrity error, không fallback tùy tiện. Chưa tạo migration, chưa sửa code hay DB.


## §28 — Audit consumer của legacy organization_members.role

Đã rà soát migrations 001/002/005/013/014, Edge Function, App.tsx, bootstrap và tests.

Phát hiện chính:
- Migration 001 helper has_org_role đọc legacy role.
- Migration 005 helper mới dùng legacy Admin OR member_roles assignment; do đó legacy Admin không assignment vẫn được xem là Admin.
- Migration 002 có nhiều RLS DELETE policy gọi helper này; đổi helper ảnh hưởng Assets, Inventory, Tasks, Plans, Checklist Templates và các module tương ứng.
- Draft 019 Admin-only logs.revise cũng dựa helper.
- RPC 013/014 chặn sửa/xóa Admin bằng cả legacy và assignment; cần thống nhất nguồn.
- Edge Function list fallback role Admin từ row.role nếu thiếu assignment; trong khi has_org_permission chỉ xét assignment.
- App.tsx select legacy role nhưng xác định vai trò qua helper; có thể bỏ cột khi refactor.
- Bootstrap/test scripts còn đọc legacy role để báo cáo.

Kế hoạch: preflight mọi membership/assignment; dừng nếu duplicate/conflict/missing không giải thích được; thêm unique constraint sau preflight; cập nhật mọi mutation tạo/đổi role để ghi assignment + legacy mirror trong cùng transaction; chuyển helper member_roles-only; bỏ fallback Edge Function; kiểm thử toàn bộ RLS DELETE/Admin RPC; chỉ xóa cột legacy ở migration riêng sau khi không còn consumer.

Mapping mirror tạm thời: Admin → legacy admin; Technician/Viewer → legacy user. Legacy field không còn quyền authorize sau cutover.

Chưa sửa code/migration/RLS/Edge Function/tests/bootstrap; chưa tạo SQL draft hay chạy SQL/RPC.


## §29 — Preflight dữ liệu role: phạm vi, ngoại lệ và cổng cutover

Đã đối chiếu schema migration 005, member-management migration 013, removal migration 014 và Edge Function.

- member_roles hiện có PK (organization_id, member_id, role_id), nên cho phép nhiều role trên một membership; FK kép ràng buộc organization/member và organization/role, ON DELETE CASCADE khi membership bị xóa.
- Migration 005 backfill assignment theo legacy role tại thời điểm migration: legacy Admin → role Admin; mọi giá trị còn lại → Technician. Đây chỉ là logic backfill lịch sử, không chứng minh assignment hiện tại luôn phản ánh đúng ý định của người quản trị.
- Migration 013 tạo membership mới với legacy role user và thêm đúng một assignment Technician/Viewer. Đổi role hiện xóa assignment cũ rồi insert assignment mới trong transaction, nhưng không cập nhật legacy mirror. Đây có thể vẫn đúng với mapping Technician/Viewer → user; cần cập nhật mirror nếu có role Admin/Custom Role thay đổi.
- Migration 014 xóa membership và để FK cascade xóa assignments. RPC hiện kiểm tra legacy và assignment theo cách kết hợp, nên dữ liệu lệch có thể ảnh hưởng quyết định chặn thao tác.
- Edge Function list dựng Map theo member_id; nếu có nhiều assignment, kết quả cuối có thể phụ thuộc thứ tự dữ liệu trả về. Đây là lỗi không xác định, không được giữ khi mô hình một role.

**Giới hạn quan trọng:** chỉ đọc repository, không có truy vấn trực tiếp dữ liệu Supabase. Không có số liệu thực tế về duplicate/missing/mismatch và không được tuyên bố dữ liệu DB sạch.

Preflight bắt buộc thống kê assignment count 0/1/>1; role inactive; legacy Admin thiếu/không khớp assignment; legacy user gán Admin; role code ngoài danh sách được duyệt; trạng thái membership/organization; và scope consistency. FK hiện có hỗ trợ bảo vệ scope nhưng vẫn cần kiểm tra hậu điều kiện.

Cổng cutover: không còn duplicate; mỗi membership cần truy cập có đúng một assignment active hợp lệ; mọi legacy mismatch được phê duyệt và xử lý có audit; snapshot/backup và báo cáo trước-sau sẵn sàng. Không tự chọn role, không mặc định missing assignment thành Technician. Chỉ thêm unique (organization_id, member_id) sau khi preflight đạt.

Đây là kế hoạch preflight, không phải migration. Chưa chạy truy vấn, chưa sửa code/SQL/DB, chưa thay đổi Supabase.


## §30 — Cross-review Shared Receipt, Change Feed và Member RPC cutover – 19/11/2026

Phạm vi: đối chiếu CLOUD_RPC_IDEMPOTENCY_CHANGEFEED_DESIGN.md §§8–14, CLOUD_SHARED_RECEIPT_DRAFT_REVIEW.md, Lock Matrix tại §21 và CLOUD_MEMBER_MANAGEMENT_RPC_DESIGN.md §§23–24. Đây là static design review trên repository main; không sửa SQL/code và không truy cập Supabase.

### 30.1 Kết luận

Ba thiết kế có cùng định hướng nhưng **chưa thể ghép thành một contract triển khai**. Có bốn điểm P0 cần giải quyết trước executable migration/business RPC: (1) lock order quản trị thành viên đang mâu thuẫn ngay trong tài liệu; (2) phân biệt Receipt lookup/replay với Receipt claim để vừa bảo đảm replay sau revoke vừa không tạo đường vượt quyền; (3) định nghĩa Change Feed event cho membership/role và tác động của thu hồi quyền đọc lên cache Local; (4) chốt schema/event contract và tên operation ổn định.

### 30.2 P0 — Lock order giữa Lock Matrix và Member RPC đang mâu thuẫn

Các đoạn hiện tại chưa thống nhất:
- Foundation §21.1 nêu thứ tự Actor Role Assignments → Roles → Role Permissions → Target Membership.
- Foundation §21.2 bảng Member role change lại ghi Target Membership → target member_roles → Role → Role Permission.
- Member design §24.3 cũng ghi Actor Membership → Target Membership → current/target Role rows.
- Member design §24.2 yêu cầu kiểm tra users.manage trong cùng transaction; vì vậy role/permission rows dùng để authorize actor phải được khóa theo cùng protocol, không thể để vị trí khóa tùy RPC.

**Quyết định kỹ thuật đề xuất để thống nhất:**
1. Organization.
2. Tất cả Membership cần thiết (actor và target), theo UUID tăng dần; nếu actor=target chỉ khóa một lần.
3. Tất cả member_roles assignment cần thiết, theo khóa ổn định.
4. Tất cả Role rows, sau đó Role Permission rows, theo thứ tự ID/code ổn định. Tập khóa phải bao gồm role/permission dùng authorize actor và role đích cần xác thực.
5. Receipt claim/replay serialization theo quy tắc tại §30.3.
6. Business/target rows theo table-rank + primary key; Asset Lease theo một thứ tự riêng đã thống nhất với Asset RPC.
7. Organization Sync Counter → Change events → Receipt finalize.

Thứ tự trên là đề xuất chuẩn hóa, cần rà soát lại mọi RPC có FK/cascade/trigger trước khi chốt. Không được giữ hai thứ tự khác nhau cho cùng các lớp lock. Các RPC không cần một lớp có thể bỏ qua lớp đó nhưng không được đảo thứ tự tương đối. Cần test đồng thời change-role, suspend/remove, role deactivate và permission revoke để chứng minh không deadlock và authorization có một điểm hiệu lực xác định.

### 30.3 P0 — Receipt lookup/replay phải tách khỏi claim và write authorization

Shared Receipt §13 đã được người dùng chấp thuận: actor còn Auth hợp lệ, Organization active và Membership active có thể replay Receipt đã commit của chính mình mà không cần write permission cũ; snapshot chỉ trả khi đủ read permission hiện tại, nếu không chỉ acknowledgement tối thiểu.

Để không xung đột với lock protocol và không mở lỗ hổng:
- **Receipt lookup/replay path:** sau khi xác thực Auth + Organization + actor Membership, tìm Receipt theo (organization_id, mutation_id). Nếu tồn tại, kiểm tra actor + operation + fingerprint đầy đủ; khác actor/fingerprint phải deny hoặc báo key reuse mà không tiết lộ dữ liệu. Nếu khớp, chỉ replay read-only theo chính sách read-permission all-or-nothing đã chọn trong Shared Receipt review: đủ toàn bộ quyền đọc thì trả snapshot; thiếu bất kỳ quyền nào thì chỉ acknowledgement tối thiểu.
- **New mutation path:** nếu chưa có Receipt, tiếp tục khóa/kiểm tra authorization Role/Permission và write permission trong transaction; chỉ sau đó claim key và thực hiện mutation. Không cho client truyền actor, fingerprint, affected refs hoặc read permission list.
- **Concurrent first request:** nếu lookup ban đầu chưa thấy Receipt nhưng request khác đang commit cùng key, unique claim phải serialize. Request thua đọc lại Receipt ở statement tiếp theo và so actor/fingerprint; không chạy side effect lần hai.
- **Permission-denied race:** nếu request bị deny sau lookup ban đầu, phải kiểm tra lại Receipt trong cùng transaction/statement flow an toàn trước khi trả lỗi, như Shared Receipt review §3.2. Chỉ được replay khi Receipt thực sự đã commit và fingerprint/actor khớp; tuyệt đối không biến nhánh này thành claim hoặc mutation mới.
- Receipt conflict/no_change là kết quả đã xác định và được lưu theo contract; không phát Change Feed event nếu không có record thực sự thay đổi.

Cần ghi rõ lookup receipt hiện hữu không đồng nghĩa với claim/lock receipt mới. Thứ tự khóa và cách tránh deadlock giữa unique-key contention, authorization locks và Receipt row phải được mô tả bằng pseudocode cho business RPC trước khi viết SQL.

### 30.4 P0 — Membership/Role Change Feed và tombstone chưa có event contract đầy đủ

Member design §24 yêu cầu create/change-role/status/remove/self-activation có Receipt và audit/change event; Foundation §21.6 chỉ mới yêu cầu nếu roster được đồng bộ thì phải có permission xem roster riêng, payload allowlist và tombstone. Change Feed design hiện mới mô tả tổng quát table_name, record_id, operation, row_version, payload; chưa định nghĩa event cụ thể cho membership/role.

Trước SQL cần chốt:
- Aggregate/event identity ổn định cho membership roster; không phát Auth user metadata, email, phone, invite URL, token hoặc dữ liệu Auth.
- Các operation/event code ổn định, độc lập tên hàm RPC: membership.created/invited, membership.activated, membership.status_changed, membership.removed, membership.role_changed (tên chỉ là đề xuất; cần chốt một bộ duy nhất).
- Event role change phải thể hiện role code trước/sau ở mức tối thiểu cần thiết cho người có quyền roster; không gửi toàn bộ permission catalog hoặc dữ liệu riêng tư của Role.
- Remove phải ghi tombstone trong cùng transaction trước khi membership row bị xóa/cascade; tombstone không FK đến membership đã xóa và chỉ chứa organization scope, membership identity nội bộ, event cursor/ID, operation và metadata tối thiểu.
- Chốt quyền pull riêng cho roster (users.view theo policy đã duyệt); không suy ra users.view từ users.manage. Nếu role catalog được sync thì phải quyết định roles.view riêng. Actor thiếu quyền không được nhận snapshot roster qua feed.
- Chốt mapping mỗi event tới permission code, payload allowlist, version/revision semantics và quy tắc event bị lọc theo quyền. Membership/Role không mặc định có row_version; nếu không có version thì cần event sequence/revision riêng.

Các operation names ở trên chưa được coi là đã duyệt; chúng là danh sách cần chốt, không được đem thẳng vào migration.

### 30.5 P0 — Thu hồi quyền đọc phải xử lý dữ liệu đã cache ở Local

Change Feed §20.4 lọc payload theo permission hiện tại và §20.8 cho phép cursor tiến qua event bị lọc. Cách này ngăn tải dữ liệu mới sau revoke nhưng **không tự xóa dữ liệu người dùng đã tải về Local khi họ còn quyền trước đó**.

Cần bổ sung một protocol riêng:
- Khi users.view, assets.view, logs.view hoặc capability khác bị revoke, server phải có cách báo cho client biết quyền/visibility scope đã thay đổi (ví dụ authorization revision/epoch hoặc một event control không chứa payload nhạy cảm).
- Client phải xác định các local snapshot thuộc scope bị thu hồi và purge/ẩn theo chính sách bảo mật; không chỉ tiếp tục advance cursor.
- Khi Membership bị suspended/removed hoặc Organization inactive, client phải khóa phiên tenant và xử lý cache tenant theo chính sách đã chốt; không để cache cũ tiếp tục hiển thị như dữ liệu được cấp quyền hiện tại.
- Phải xác định hành vi khi thiết bị offline tại thời điểm revoke: không thể nhận lệnh thu hồi ngay khi offline, do đó cần quy định lần reconnect/reauth trước khi mở dữ liệu cache và thời hạn cho phép đọc offline. Điều này phải phù hợp nguyên tắc BAOTRI Mini hiện tại: offline chỉ đọc cached snapshot, không ghi nghiệp vụ.

Đây là vấn đề bảo mật dữ liệu Local, không thể giải quyết chỉ bằng lọc event phía Cloud.

### 30.6 Các điểm P1 cần chốt đồng bộ

1. **Receipt read policy:** Shared Receipt review §3.3 nêu all-or-nothing hoặc per-record; Shared Receipt design §13 hiện đã chốt thiếu bất kỳ quyền đọc nào thì acknowledgement tối thiểu. Giữ all-or-nothing cho Receipt replay; không áp dụng nhầm chính sách này cho Change Feed, vốn lọc độc lập từng event/capability.
2. **Operation/fingerprint contract:** Member create/change-role/status/remove/self-activation phải có operation code ổn định và fingerprint bind organization, actor scope, target membership, role/status đích, Invite Saga operation ID (nếu có) và các version/revision liên quan. Không dùng tên SQL function làm operation code.
3. **Change event schema:** Cần chốt chính xác field names, event ID, cursor, aggregate/table type, resource ID, operation, version/revision, permission code, payload schema và tombstone shape. Không để mỗi RPC tự tạo JSON payload khác cấu trúc.
4. **Multi-record ordering:** Một mutation tạo nhiều record/event phải có thứ tự ổn định và cùng một Receipt/counter transaction. Với membership mutation, không phát event giả cho no_change; remove vẫn phải giữ tombstone.
5. **Authorization lock scope:** role assignment, Role active và Role Permission phải được khóa trong transaction theo lock matrix. has_org_permission() STABLE hiện tại phục vụ RLS/read không thay thế routine authorization có lock cho RPC.
6. **Audit vs Change Feed:** Audit quản trị và event đồng bộ là hai mục đích khác nhau. Có thể cùng transaction nhưng không được giả định một event roster tối thiểu thay thế audit append-only có actor, action, target, reason và thời điểm.
7. **Asset exception:** Giữ Asset-specific Receipt + Edit Lease như hiện tại. Không đưa Asset vào shared lock/Receipt cutover cho đến khi có bridge và test legacy replay; lock order Asset Lease/Asset row phải được hòa giải với thứ tự chung trước khi triển khai.

### 30.7 Cổng hoàn tất trước executable SQL

Chưa viết migration/business RPC cho tới khi:
- Foundation §21 và Member §24 có cùng lock order, cùng thứ tự Actor/Target Membership và Role/Permission.
- Có pseudocode riêng cho Receipt replay, new claim, concurrent duplicate claim và permission-denied recheck.
- Có event contract cho membership/role, roster permission, tombstone và audit boundary.
- Có protocol thu hồi quyền đọc/cache Local, kể cả thiết bị offline.
- Có bảng operation codes + fingerprint fields + Receipt read requirements + Change Feed event mapping cho từng member RPC.
- Có test matrix concurrency/replay/revoke/roster/remove/offline cache; static review hoàn tất trước khi người dùng duyệt chạy trên Supabase Test.

### 30.8 Ranh giới

Chỉ bổ sung kết quả cross-review tài liệu. Không tạo/sửa SQL draft, migration, Edge Function, UI, Dexie hoặc test; không chạy SQL/RPC; không thay đổi Supabase Test/Production, quyền hoặc dữ liệu. Các operation/event names trong mục này là đề xuất chờ chốt, không phải quyết định đã được người dùng duyệt.


## 31. Chốt lại Lock Matrix và phạm vi roster sau quyết định sản phẩm (19/11/2026)

Trạng thái: **chuẩn hóa tài liệu thiết kế; chưa phải migration hoặc phê duyệt cutover**. Mục này cập nhật cách áp dụng §§21 và 30 sau khi đối chiếu Member RPC §26. Không xóa các nhận định lịch sử; khi có khác biệt, dùng quy tắc tại §31 cho thiết kế Member RPC mới.

### 31.1 Lock order có hiệu lực cho Member RPC

Các mô tả tại §21.1 và một số dòng §21.2 được viết trước khi chốt thứ tự khóa Membership. Với Member RPC, thứ tự chuẩn là:

1. Organization.
2. Tất cả actor/target Membership cần thiết, khóa theo UUID tăng dần; actor=target chỉ khóa một lần.
3. Member role assignments cần thiết, theo khóa ổn định.
4. Role rows, theo role ID tăng dần.
5. Role Permission rows, theo (role_id, permission_code) tăng dần.
6. Auth user row chỉ khi Invite Saga/finalize cần; không gọi Auth Admin API hoặc network khi đang giữ DB locks.
7. Receipt claim cho mutation mới; Receipt replay lookup read-only là nhánh riêng sau Organization + actor Membership.
8. Business/target rows theo table-rank và primary key.
9. Organization Sync Counter và Change events chỉ cho các loại feed đang được bật.
10. Receipt finalize trong cùng transaction.

Như vậy, với Member RPC, **khóa actor và target Membership trước role assignments/Role/Role Permission**. Quy tắc này thay thế thứ tự cũ tại §21.1 (Role/Permission trước target Membership) và các mô tả khác nhau trong bảng §21.2. Các RPC không cần một lớp có thể bỏ qua lớp đó nhưng không được đảo thứ tự tương đối.

Không suy rộng thứ tự Member RPC sang Asset RPC. Asset Lease/Asset Receipt vẫn là ngoại lệ chuyển tiếp; cần bridge contract riêng để hòa giải thứ tự Receipt → Lease → Asset row trước khi Asset cutover.

### 31.2 Receipt lookup và claim là hai nhánh khác nhau

- Replay lookup: sau Auth + Organization active + actor Membership active, đọc Receipt read-only; nếu Receipt final khớp actor/operation/fingerprint thì replay theo current read permission. Không cần write permission cũ, không claim, không khóa business row, không tạo side effect.
- Mutation mới: nếu không có Receipt, tiếp tục khóa target/assignment/Role/Permission và kiểm tra write permission trong transaction; sau đó claim unique Receipt key trước business row locks và side effects.
- Permission-denied recheck: nếu Receipt có thể vừa commit sau lookup ban đầu, đọc lại Receipt trong statement riêng trước khi trả deny; chỉ replay khi Receipt final và fingerprint khớp. Không claim hoặc thực hiện mutation trong nhánh deny.
- Claim contention: request thua đọc Receipt ở statement tiếp theo theo READ COMMITTED; không dựa vào exception unique violation rồi tiếp tục trong transaction đã abort.
- Business rows, row_version, Receipt và các event feed có liên quan (nếu có) phải cùng transaction. No_change/conflict không tạo Change Feed event nếu không có record thực sự thay đổi.

Đây là cách áp dụng thống nhất cho Member RPC và Shared Receipt review; không làm thay đổi Asset-specific Receipt hiện hữu.

### 31.3 Roster không thuộc Change Feed hiện tại

Quyết định sản phẩm tại Member design §13 vẫn giữ nguyên: **chưa đưa roster vào Change Feed**.

- §30.4 và các event code membership.* tại Member design §25.4 chỉ là phân tích cho khả năng tương lai; không phải P0 blocker của migration Member RPC hiện tại.
- Member create/change-role/status/remove/self-activation hiện chỉ cần Shared Receipt + audit quản trị append-only; không insert membership event, không tăng organization sync cursor và không đồng bộ roster.
- Roster read tiếp tục là RPC riêng có users.view; users.manage không tự suy ra quyền đọc.
- §30.5 về cache Local của roster chỉ trở thành điều kiện bắt buộc nếu sau này quyết định bật roster sync. Không được vì mục đó mà tự thêm roster payload/control event vào Change Feed hiện tại.
- Các nguyên tắc revoke/cache Local vẫn bắt buộc đối với những loại dữ liệu thực sự được đồng bộ qua Change Feed; việc chưa sync roster không miễn trừ bảo vệ cache của Asset/Inventory/Task/Log đang thuộc feed tương lai.

### 31.4 Cổng hoàn tất đã điều chỉnh trước executable Member SQL

Trước khi viết SQL Member RPC, cần:
1. Đồng bộ Member §24–26 với lock order tại §31.1.
2. Chốt pseudocode Receipt replay, new claim, contention và permission-denied recheck theo §31.2.
3. Chốt operation code, server-built fingerprint allowlist, Receipt read-permission requirements và audit fields.
4. Chốt caller JWT RPC ↔ Edge Function ↔ Auth Admin API Invite Saga boundary.
5. Kiểm thử concurrency cho Membership/Role/Permission/Organization revoke và target suspend/remove; test replay sau revoke và Invite Saga recovery.
6. Giữ roster Change Feed ngoài scope. Không yêu cầu event schema/tombstone roster để mở Member RPC cutover hiện tại.

Sau khi các contract này nhất quán mới viết migration riêng; migration vẫn phải static review và cần người dùng phê duyệt trước khi chạy trên Supabase Test.

### 31.5 Ranh giới

Chỉ chuẩn hóa tài liệu. Không sửa migration 013/014, draft SQL, Edge Function, client hoặc Dexie; không chạy SQL/RPC và không thay đổi Supabase Test/Production, quyền hay dữ liệu.


## 32. Inventory audit và Invite Saga schema trước Member SQL (19/11/2026)

Cross-reference Member design §28:

- Static repository search chưa tìm thấy audit table đã triển khai; audit hiện mới là contract tài liệu. Đây không chứng minh Supabase schema ngoài repo không có bảng audit. Cần inventory Test read-only trước khi chọn tên/bảng mới.
- `organization_member_invite_operations` mới là thiết kế, chưa có DDL/migration. Giữ riêng Saga workflow (Auth API nhiều pha, PII email, recovery/adoption) và Shared Receipt (DB mutation finalize đã commit).
- Saga table phải private: RLS bật, không direct client CRUD; email là PII, auth_user_id là internal identity; không đưa vào Receipt/audit/feed/error/telemetry. Chốt retention và backup window, giữ unresolved operation.
- Audit cần append-only, same-transaction với membership transition + Receipt, không FK cascade tới target membership, before/after allowlist role/status. Quyền đọc audit chưa được quyết định; không mặc định `users.view` là đủ. Cần quyết định permission riêng như `users.audit.view` hoặc `audit.view`.
- Migration 005 hiện chưa enforce một role/membership: PK member_roles gồm role_id. Unique constraint chỉ sau preflight fail-closed.
- Migration 013/014 là writer cũ chưa có Receipt/audit, service_role-only và nhận actor ID input; Auth trigger còn ghi membership status. Chưa được xem là tương thích contract mới.

Cổng trước executable Member SQL: Test schema inventory read-only; chốt audit read permission + retention; chốt Saga PII lifecycle; thiết kế riêng audit/Saga DDL; thay/cutover toàn bộ membership writers và Auth trigger theo lock order; concurrency/RLS/grants tests. Chưa chạy SQL, chưa sửa code và chưa thay đổi Supabase.


## 33. Kết quả live schema inventory trên BAOTRI-Mini-Test (19/11/2026)

Đối chiếu Member design §29. Đã đọc metadata trực tiếp từ project `BAOTRI-Mini-Test` (PostgreSQL 17.12), không chạy DDL hoặc ghi dữ liệu.

- `auth.audit_log_entries` tồn tại nhưng chỉ là Supabase Auth audit; không dùng làm business/member audit.
- Không có audit nghiệp vụ/member riêng và không có Invite Saga operation table trong schema Test được truy vấn.
- Hai bảng `public.asset_import_mutations` và `public.asset_mutation_receipts` là asset-specific idempotency/receipt, RLS enabled; truy vấn policy không thấy policy, grants quan sát được chỉ postgres/service_role. Không tái sử dụng cho Member audit/Saga.
- Hai bảng trên có `relforcerowsecurity=false`; cần giữ nguyên semantics và quyền service-only hiện tại, không suy diễn rằng RLS giới hạn owner/service_role.
- Audit nghiệp vụ và Invite Saga do đó vẫn cần thiết kế schema riêng, retention/PII policy, permission đọc audit riêng; không lấy `users.view` làm quyền đọc audit mặc định.
- Kết quả chỉ là snapshot Test, không suy rộng Production. API list_migrations trả rỗng dù các bảng hiện hữu; không dùng nó làm bằng chứng migration chưa chạy.

Không tạo migration, không sửa RLS/grants, không đọc PII, không thay đổi database.

## 34. Cross-review DDL draft 021 — Member audit và Invite Saga (19/11/2026)

File: supabase/drafts/021_member_audit_and_invite_saga_DRAFT.sql. Đối chiếu Member design §30 và live Test inventory §33.

- Hai bảng mới giữ tách biệt Saga workflow nhiều transaction/Auth API và audit append-only; không tái sử dụng asset-specific receipt/mutation.
- Target membership ID là scalar không FK/cascade. Audit → Saga operation dùng composite FK RESTRICT. Organization/Profile/Auth references RESTRICT có thể ảnh hưởng lifecycle deletion, phải review retention/archive.
- RLS bật, không tạo policy; direct table privileges bị revoke cả service_role. Chỉ purpose-specific SECURITY DEFINER RPC đã review mới được thao tác.
- Audit before_state/after_state bị giới hạn bằng CHECK allowlist key và enum; reason vẫn cần kiểm soát PII tại RPC.
- Audit trigger từ chối UPDATE/DELETE nhưng không tự ngăn owner/superuser hoặc TRUNCATE. Cần giới hạn quyền vận hành và kiểm thử role context.
- DDL chưa triển khai RPC/state machine CAS, immutability guard cho fingerprint/actor/resolved initial status, worker/attempt history, audit read RPC hoặc retention job.
- Các quyết định còn mở: audit scope, permission đọc audit, retention/backup, PII encryption/key management, adoption approval, worker/manual recovery và actor_kind system.
- DDL có begin/commit và fail-closed object creation (không IF NOT EXISTS/CREATE OR REPLACE); tuy nhiên đây chỉ là draft static, chưa chứng minh cú pháp/chạy thành công trên Test.
- Không chạy SQL, không tạo migration, không thay đổi Test/Production.

**Gate:** DDL 021 chỉ được promote sau khi quyết định sản phẩm còn mở được phê duyệt, static review hoàn tất và có test plan. Tạo migration/applies SQL là một bước riêng cần chỉ thị rõ ràng.


## 35. Static review vòng 1 cho DDL 021 (19/11/2026)

Đối chiếu Member design §31. Draft đã siết nonblank reason, adoption cross-Admin, actor_kind system chỉ cho Saga state transition, required target/mutation ID cho membership lifecycle, required Saga operation reference và JSONB enum CHECK null-safe.

Các rủi ro còn lại không được DDL đơn thuần giải quyết: immutable Saga identity/fingerprint/PII, transition CAS/version, updated_at, attempt history, reason PII filtering, audit trigger bypass bởi owner/TRUNCATE, FK retention lifecycle, RPC permission/lock order và atomic Audit + Shared Receipt.

Chưa chạy parser/SQL, chưa tạo migration, chưa thay đổi Supabase.


## 36. Invite Saga — transition/RPC test matrix (19/11/2026)

Đã bổ sung Member design §32: ma trận trạng thái hợp lệ, RPC authorization/transaction boundary và test matrix Begin/Cancel/Claim/Record Result/Mark Unknown/Finalize/Adoption/Self Activation. Các điểm trọng yếu: CAS theo status+version, attempt token, manual recovery, không retry Auth mù quáng sau lease expiry, không dùng service_role giả actor, atomic membership + role + audit + Shared Receipt, và terminal state không reopen.

Chưa viết RPC SQL, chưa chạy test database, chưa thay đổi Supabase. Self activation vẫn cần chốt audit/Receipt semantics; provenance Auth user và attempt-history vẫn là các gate mở.


## 37. Schema adequacy review DDL 021 (19/11/2026)

Đối chiếu DDL 021 với Member design §32–33: draft hiện là khung operation/audit, chưa đủ triển khai RPC an toàn. Các gap chính: không có attempt history; Auth provenance chỉ là boolean nullable, thiếu evidence; status CHECK chưa ràng buộc attempt/lease/result; immutable intent chưa được bảo vệ; request_fingerprint chưa có canonical/hash contract; audit thiếu transition sequence/idempotency; audit state-change chưa bắt buộc đủ before/after; normalized_email plaintext; retention chưa định nghĩa.

Đã ghi chi tiết ma trận gap và hướng xử lý tại Member design §33. Không sửa DDL, không tạo migration/RPC, không chạy SQL hoặc thay đổi Supabase.


## 38. Quyết định kiến trúc Invite Saga đã chốt (20/11/2026)

Người dùng chốt năm nguyên tắc Auth provenance và request fingerprint tại Member design §35: (1) provenance có bốn trạng thái `created_by_operation`, `preexisting_verified`, `unknown`, `conflict`; (2) không đủ bằng chứng hoặc có xung đột thì fail closed sang `needs_review`, không tự gắn/xóa Auth user; (3) canonical request fingerprint dùng HMAC-SHA-256, secret nằm ngoài Database, chỉ lưu digest và version metadata; (4) cùng operation ID nhưng digest khác phải reject, replay dùng đúng version/key version cũ; (5) adoption không thay actor gốc hoặc fingerprint.

Đây là policy kiến trúc đã được người dùng xác nhận. Các chi tiết vận hành như quy trình chứng minh `preexisting_verified`, key retention/rotation và bảo vệ/retention email vẫn cần thiết kế trước DDL implementation. Lần cập nhật này chỉ ghi nhận quyết định; không sửa DDL 021, không tạo migration/RPC, không chạy SQL và không thay đổi Supabase Test/Production.


## 39. Schema proposal DDL 021 sau quyết định provenance/fingerprint (20/11/2026)

Đã lập phương án cấu trúc dữ liệu tại Member design §36: operation thay boolean Auth provenance bằng enum/text allowlist 4 trạng thái cùng attempt/evidence/verification metadata; thay JSONB fingerprint bằng HMAC-SHA-256 digest `bytea` 32 bytes kèm fingerprint/key version; bổ sung `transition_version` riêng với row `version`; tạo append-only `organization_member_invite_attempts`; bổ sung `transition_id` + `transition_version` unique cho audit Saga transition và bắt buộc before/after saga status; giữ adopter hiện hành và lưu mọi lần handoff trong append-only audit, chưa cần adoption history table riêng.

Các điểm còn mở: quy trình `preexisting_verified`, secret manager/key retention/rotation, bảo vệ và retention normalized_email, attempt immutable/event detail, stable transition ID qua retry. Đây mới là schema proposal, chưa phải DDL approval. Không sửa DDL 021, không chạy SQL, không thay đổi Supabase Test/Production.


## 40. Attempt History và phục hồi timeout/crash (20/11/2026)

Đã cụ thể hóa proposal tại Member design §37: dùng immutable `organization_member_invite_attempts` header và append-only `organization_member_invite_attempt_events`; claim/commit attempt trước Auth call; lease expiry chỉ cho phép takeover reconciliation, không cho provider retry; `outcome_unknown` phải reconcile, không tự retry; chỉ retry sau definitive no-side-effect evidence; kết quả/mismatch/pre-existing đều lưu event allowlist và evidence code; không lưu raw Auth response/token/email. Manual recovery trước, chưa cần background worker.

Các chi tiết còn mở: provider-specific correlation/evidence chứng minh không có side effect, phân loại definitive failure, lease duration và quyền takeover. Default fail-closed nếu không chứng minh được. Đây là proposal, không sửa DDL 021 và không chạy SQL/Supabase.


## 41. Quyết định đã chốt về Attempt History và lease recovery (20/11/2026)

Người dùng đã đồng ý mô hình hai bảng `organization_member_invite_attempts` (immutable header) và `organization_member_invite_attempt_events` (append-only history). Attempt được claim trước Auth call; không giữ DB transaction trong network call. Lease expiry chỉ cho phép takeover reconciliation, không cho phép gọi Auth lần nữa. `outcome_unknown` không phải definitive failure; chỉ retry khi có bằng chứng đáng tin cậy không có side effect, nếu không thì fail closed. Các chi tiết provider evidence, error classification, lease duration và quyền Admin takeover còn phải thiết kế. Chưa sửa DDL 021, không chạy SQL/Supabase.


## 42. Phân loại lỗi Auth và điều kiện retry (20/11/2026)

Đã lập policy proposal tại Member design §39: ba nhóm `definitive_no_side_effect`, `outcome_unknown`, `needs_review/conflict`. Không phân loại bằng HTTP status chung chung; 4xx/429/5xx đều không tự chứng minh không có side effect. Timeout, mất kết nối, crash hoặc response không đầy đủ sau dispatch mặc định unknown. Duplicate/existing email không phải `created_by_operation`, cần claim/ownership verification độc lập. Chỉ retry khi có evidence allowlist chứng minh request chưa dispatch hoặc endpoint contract cụ thể bảo đảm không side effect; allowlist provider rejection để trống cho tới khi kiểm chứng endpoint/version thực tế. Không sửa DDL, không chạy SQL/Supabase.


## 43. Quyết định đã chốt: fail-closed retry policy cho Auth (20/11/2026)

Người dùng đã chốt: ban đầu để trống allowlist provider error codes có thể retry. Chỉ local preflight có bằng chứng chắc chắn chưa dispatch mới là `definitive_no_side_effect`; mọi lỗi sau dispatch hoặc không rõ dispatch state mặc định `outcome_unknown`, phải reconciliation, không gọi Auth lại. Chỉ mở allowlist khi review đúng endpoint/provider/version và có test evidence no-side-effect. Không dùng HTTP status, duplicate email, Retry-After, timeout hay lease expiry làm bằng chứng no-side-effect. Chưa sửa DDL, không chạy SQL/Supabase.


## 44. Proposal: reconciliation evidence cho Auth user creation (20/11/2026)

Đề xuất tại Member design §41: email match không phải provenance. Khảo sát opaque random marker server-generated (digest lưu trong attempt record trước dispatch) gắn nguyên tử ngay tại Auth create-time trong metadata server-managed; chỉ dùng nếu đúng Admin endpoint/SDK version xác nhận hỗ trợ atomic create-time write. Tài liệu Auth `admin.createUser` đã tra cứu chưa đủ xác nhận `app_metadata` create-time, do đó không giả định khả thi. Nếu dùng được: recovery chỉ tìm candidate bằng email locator, sau đó xác minh marker chính xác, project và attempt; đúng một match mới có thể ghi `created_by_operation`. Không có candidate không chứng minh no-side-effect; mismatch/multiple candidate => needs_review/conflict. Nếu không có atomic marker/correlation, không thể đóng crash window bằng update metadata sau create; giữ needs_review/manual recovery. Chưa sửa DDL, không chạy SQL/Supabase.


## 45. Technical verification: createUser marker không đồng nghĩa inviteUserByEmail marker (20/11/2026)

Source-level verification: `admin.createUser` trong supabase-js nhận `AdminUserAttributes.app_metadata`; GoTrue `adminUserCreate` ghi app_metadata trong cùng DB transaction tạo user. Tuy nhiên native `inviteUserByEmail` chỉ gửi `{email,data}` tới `/invite`; GoTrue `InviteParams` chỉ có Email và Data, Data là user_metadata. Vì vậy create-time app_metadata marker khả thi về source cho createUser nhưng không có trong native invite endpoint được thiết kế cho Invite Saga. Không dùng user_metadata thay thế. `generateLink(type:'invite')` chưa được xác minh hỗ trợ app_metadata. Cần xem xét hook/server-trusted correlation, thay đổi provisioning chỉ sau khi duyệt nghiệp vụ, hoặc giữ unknown/needs_review. Phải pin Auth server + SDK versions trước implementation. Chưa sửa DDL, không chạy SQL/Supabase.


## 46. Proposal: correlation receipt qua Before User Created Hook (20/11/2026)

Đề xuất tại Member design §43. Native invite route gọi Before User Created chỉ với user mới (`isCreate=true`); Auth sinh user UUID server-side trước hook. Edge Function tạo random token cho operation+attempt, lưu digest trước dispatch và truyền token qua reserved `user_metadata` key. Không tin metadata; HTTP hook verify Standard Webhooks signature, xác minh token với attempt digest/state/project/email fingerprint, rồi ghi durable append-only receipt qua internal server-only RPC gồm webhook ID, hook request UUID, operation/attempt, Auth-generated user ID. Chỉ sau khi receipt commit hook mới allow. Reconciliation đọc receipt rồi `getUserById` exact ID; chỉ receipt + Auth user hiện tồn tại mới hỗ trợ created_by_operation. Orphan receipt khi Auth rollback không được attach. Existing unconfirmed account không gọi hook nên vẫn cần independent verification/needs_review. Hook + Auth insert không cùng transaction; cần test retry/timeout, lookup consistency, hook availability/plan and version. Đây là proposal chưa duyệt; chưa sửa DDL/RPC/Edge Function, không chạy SQL/Supabase.


## 47. Technical verification: Before User Created Hook correlation cho native invite (20/11/2026)

Đã xác minh source hiện hành: `internal/api/invite.go` gọi `triggerBeforeUserCreated` trong nhánh `isCreate == true`, sau khi tạo user model từ `SignupParams{Data: params.Data}` và trước transaction insert Auth user. `Data` đi vào `user_metadata`; Hook nhận user object gồm `user_metadata` và Auth-generated user ID. Vì vậy reserved `data` key có thể chuyển opaque random correlation token vào Hook cho invite tạo user mới.

Proposal an toàn cần: token >=256-bit do server tạo; chỉ lưu digest/key version trong attempt trước dispatch; verify Standard Webhooks signature; đối chiếu token với attempt/project/state/email fingerprint; ghi durable append-only receipt qua internal server-only RPC trước khi Hook allow; receipt chứa Auth user ID do Auth sinh; reconciliation xác nhận user tồn tại bằng exact ID. Orphan receipt không chứng minh Auth commit. `user_metadata` chỉ là transport, user-editable sau tạo, tuyệt đối không dùng làm authorization/provenance trực tiếp. Nhánh `isCreate == false` không chạy Hook nên existing unconfirmed/preexisting account vẫn cần quy trình độc lập hoặc `needs_review`.

Source-level result supports feasibility, not production readiness. Cần pin GoTrue/Auth + SDK version, xác nhận Hook plan/configuration và test end-to-end crash/timeout/replay/rollback/orphan/lookup consistency. Chưa được duyệt implementation; không sửa DDL/RPC/Edge Function, không chạy SQL/Supabase.


## 48. Technical verification: ưu tiên After User Created Hook cho Invite Saga receipt

Source Auth tại commit `10ef10789d1ee4fb422b448047e67e3e264c0482` cho thấy `Invite()` gọi `triggerAfterUserCreated` sau khi `db.Transaction(...)` đã trả về thành công; Hook kiểm tra không còn transaction trước khi invoke. Vì vậy receipt trong After User Created Hook có thể được ghi sau Auth user commit, mạnh hơn Before Hook vốn chạy trước insert và có thể để orphan receipt.

Caveat: source hiện gọi After Hook sau transaction trên đường Invite mà không gate theo `isCreate`; handler phải yêu cầu reserved correlation token khớp attempt, nếu không thì không tạo receipt. Hook metadata UUID được sinh mới cho từng invocation, không dùng làm stable idempotency key. Idempotency chính phải theo attempt_id + Auth user ID; cùng cặp replay idempotent, cùng attempt nhưng ID khác là conflict. Hook/receipt failure có thể xảy ra sau Auth commit, nên `/invite` trả lỗi vẫn phải giữ Saga `outcome_unknown`, không gọi Auth lại; thiếu receipt thì manual review. Token trong user_metadata chỉ là transport, không phải authorization/provenance đọc lại.

Ưu tiên After Hook làm receipt point; Before Hook chỉ còn vai trò optional preflight gate, không phải proof create commit. Source-level feasibility chưa xác nhận availability trên Supabase Cloud/plan hoặc retry semantics. Cần pin versions và test Hook config, delivery, timeout, replay, post-commit failure, exact-ID lookup. Chưa duyệt implementation; không sửa DDL/RPC/Edge Function, không chạy SQL/Supabase.


## 49. Hosted Auth Hook availability and delivery semantics

Supabase Auth Hooks docs (20/11/2026) list Before User Created, Custom Access Token, Send SMS, Send Email, MFA Verification and Password Verification by plan. After User Created is absent from the documented hosted hook list. GoTrue source implementation alone does not establish availability/configurability on Supabase Cloud. Do not rely on After User Created for hosted BAOTRI Mini unless Supabase explicitly confirms support for the target project.

Before User Created is documented for Free/Pro but runs before Auth insert and cannot prove commit. HTTP Hooks use Standard Webhooks; verify raw body and `webhook-id`, `webhook-timestamp`, `webhook-signature` with the standard library. Docs describe 429/503 plus non-empty `retry-after` as retryable, up to 3 retries with 2-second backoff and a 5-second total invocation budget. Retry-After handling is not full RFC behavior. Timeout/retry means handler must be idempotent by attempt_id + Auth user ID, enforce uniqueness/replay protection, and commit durable receipt before success. A hook timeout/failure can coexist with side effects in its own service; keep Invite Saga fail-closed.

Current conclusion: After Hook is source-level only, not verified hosted capability. Before Hook is available but not commit proof. Keep manual review/fail-closed until a post-commit correlation channel is officially supported on Supabase Cloud or another provisioning flow is approved. No DDL/RPC/Edge Function changes and no SQL/Supabase writes.


## 50. Alternative Auth provisioning candidate: createUser + app_metadata marker

Current Supabase JS Auth Admin API review (20/11/2026): `admin.createUser()` is server-only, accepts `app_metadata` in create attributes, and does not send confirmation email. `inviteUserByEmail()` sends an invite but its `options.data` maps to `user_metadata`. `generateLink({type:'invite'})` also handles user creation and exposes only user_metadata `data`, not trusted create-time app_metadata. `listUsers()` exposes pagination only (no filter); `getUserById()` requires known UUID.

Candidate only, not approved: create attempt marker before dispatch; call `createUser({email, email_confirm:false, app_metadata:{...marker}})` server-side; verify response or reconcile exact marker in `auth.users` via a separately reviewed server-only lookup. Marker must be unique per attempt; email only locator. A missing marker immediately after timeout does not prove no side effect or no in-flight request; keep outcome_unknown and never blindly repeat createUser. Do not scan all Auth users via paginated listUsers as routine lookup.

Blocking gap: createUser sends no invite email. generateLink invite creates the user itself and has no app_metadata input. Recovery/setup link for an unconfirmed created user or a custom email flow is not yet proven. Never auto-confirm email to bypass. Therefore this is not yet a complete replacement for native inviteUserByEmail. Retain current flow + fail-closed/manual review until onboarding and recovery behavior are tested against pinned versions. No DDL/RPC/Edge Function changes or Supabase writes.


## 51. Recovery link cannot yet be treated as initial activation for createUser accounts

Supabase docs document `admin.generateLink({type:'recovery'})` as a recovery link for a custom email provider, but do not guarantee it works for a `createUser({email_confirm:false})` account before email confirmation or that it confirms that email. Supabase Users docs say unverified email users cannot sign in by default; the documented invite flow explicitly confirms email and lets the invitee finish setup. That behavior cannot be assumed for recovery or magiclink. `generateLink({type:'invite'})` creates the user itself and lacks trusted create-time app_metadata input.

Therefore the createUser + app_metadata marker alternative still has an unresolved onboarding blocker. Do not implement/select it until isolated tests on pinned Auth/SDK establish recovery generation for an existing unconfirmed user, verification/email_confirmed_at outcome, password setup, replay/expiry, custom email delivery, and secure attempt correlation. Current native inviteUserByEmail + fail-closed/manual review remains unchanged.


## 52. Existing Auth account: self-acceptance instead of inviter-side attachment (proposal, 20/11/2026)

An email match, even with a verified-email flag, must not let the inviter attach an existing Auth UUID to an organization. Proposed safe path:

1. Authorized Admin creates only an immutable pending invitation intent (target email fingerprint, organization, role, original actor, expiry, request fingerprint); no Auth provisioning call and no membership write.
2. Existing account holder signs in to the exact Auth account. A restricted RPC lists only pending invitations matching that account's authoritative verified email; it derives identity from auth.uid() and server-side Auth data, never caller-supplied UID/email.
3. The invitee explicitly accepts. In one transaction the server rechecks UID, email_confirmed_at, normalized verified-email fingerprint, pending/unexpired/not-revoked invite, active organization, valid role, inviter authority/reapproval policy and membership uniqueness. Then it atomically writes membership, single role assignment, audit, Shared Receipt and Saga completion.
4. Until acceptance there is no membership, role, tenant access or Auth-user association. The inviter cannot silently attach the account.

Unverified existing accounts cannot accept until completing the normal supported Auth verification/sign-in flow; do not auto-confirm, reset password or assume inviteUserByEmail will notify/activate an existing account. Changed email, ambiguous/multiple candidates or inconsistent evidence => needs_review/new invitation, never auto-attach/delete. Pending-invite discovery returns minimal data and must not reveal arbitrary Auth account existence or roster details. Recheck conditions at acceptance; a previous list result is not authorization.

Candidate Saga state awaiting_existing_account_acceptance, expiry/decline/revoke transitions and notification delivery are open design items, not approved schema. This is a design proposal only; DDL 021, RPC, Edge Function and Supabase remain unchanged. Native invite + fail-closed/manual review remains current behavior.


## 53. Existing-account invitation notification: in-app first, email optional (proposal, 20/11/2026)

Recommended channel order:

1. **In-app inbox is authoritative.** After sign-in, a narrow authenticated RPC returns minimal pending-invitation display fields for the current Auth UID, matched server-side to its authoritative verified email. It derives identity from auth.uid(); no client-supplied email/UID. Listing is read-only and grants no access. Explicit accept still calls the §52 transaction and rechecks all invariants.
2. **Realtime is only a wake-up hint.** It may prompt the client to refetch the inbox through the authorized RPC. Do not broadcast invitation row contents or rely on websocket delivery; login/app-open/on-demand refresh must work without Realtime.
3. **Email is optional secondary notification.** Send only a generic notice with a link to the normal application sign-in/inbox. No bearer acceptance token, Auth confirmation/recovery token, raw Auth UUID or secret. Opening the link does not accept; recipient must authenticate and explicitly accept in-app. Do not use Auth invite/recovery APIs to notify an existing account.
4. **Separate business email from Auth mail.** Use a trusted server-side transactional email provider via separately configured SMTP or reviewed provider API. Supabase Send Email Auth Hook replaces Auth email sending; it is not the generic BAOTRI business-notification queue. Keep credentials server-side; configure SPF/DKIM/DMARC; disable tracking where possible.
5. **Outbox and privacy.** If enabled, commit a minimal notification outbox row atomically with invitation intent and send only after commit. Idempotent notification ID, bounded retries, rate limits, audit, no raw provider response/email in logs. A fingerprint is not a deliverable address; any recipient PII persistence requires encrypted restricted storage, key and retention policy. Provider acceptance is not proof of inbox receipt or invitation acceptance. Delivery failure never changes membership or Auth provenance.

Do not reveal whether an arbitrary email has an Auth account in Admin/API responses. Current manual-recovery/no-worker rule remains: email is not implemented until provider, encrypted PII, outbox, worker, secrets, retention and monitoring are approved. Recommended sequence is in-app inbox first, optional email second, Realtime as optimization. No DDL/RPC/Edge Function/worker/SQL/Supabase changes.


## 54. In-app Invitation Inbox — data exposure and permission review

Recommended design: no separate Inbox table initially. The authoritative state remains `organization_member_invite_operations`; expose a narrow read projection. Attempts and attempt events remain server-private. This avoids duplicate state and synchronization drift.

Response allowlist only: opaque invitation/operation UUID, organization display name, safe role label, created/expiry timestamps, and derived `pending` status. Initially omit inviter label. Never expose target email, Auth UUID, member ID, HMAC digest/key version, token/URL, receipt ID, attempt identifiers/events, provider responses, internal Saga states, or private recovery details.

Access rules:
- anon/unauthenticated: no access.
- authenticated account with no verified authoritative Auth email: no access.
- signed-in account with verified Auth email: only matching pending invitations for that account's current authoritative verified email.
- inviter/Admin does not gain access to recipient Inbox merely by creating the invitation.
- no arbitrary-email lookup endpoint; no direct client SELECT on Saga/attempt tables.
- deny client access to internal tables; use server-only access and defense-in-depth RLS.
- never authorize from user_metadata or client-supplied email/UID.

List is a read-only snapshot and grants no membership, tenant access, reservation, or acceptance. Accept revalidates identity, verified email, pending/unexpired/not-revoked state, active organization, role validity, and membership conflict inside the transaction. Membership + one role + audit + Shared Receipt + Saga completion commit atomically. Client supplies only invitation ID and stable mutation/idempotency key; actor UID/email/org/role are not trusted client inputs. Same invitation+same actor replay is idempotent; different actor is rejected. Final acceptance receipt/idempotency contract must be reconciled with Shared Receipt design.

Important unresolved trust boundary: Saga stores an HMAC digest while key material is external to Database. PostgreSQL cannot recompute the HMAC without a trusted key-access mechanism. Candidate design is a server Edge Function that validates the bearer with Auth, obtains authoritative user and verified-email state, computes HMAC using secret manager, then calls a server-only internal RPC with actor UID and digest. The internal RPC must not be executable by anon/authenticated and must perform the final transaction atomically. This Edge Function boundary needs a separate threat-model review; do not substitute client email or unverified matching.

Use keyset pagination with bounded page size; no OFFSET/COUNT and no response differences that enumerate arbitrary Auth emails. Realtime is only a wake-up hint; fetch the protected projection again. No physical Inbox table/cache initially.

Status: design proposal only. No DDL/RPC/Edge Function/worker/SQL/Supabase changes. Resolve HMAC trust boundary, acceptance idempotency/receipt contract, expiry/revocation/decline, rate limit and audit retention before implementation.

 
## 55. In-app Invitation Inbox — RPC and digest review

The list/accept design requires a recipient lookup digest distinct from the full canonical request fingerprint. Do not attempt to search by `request_fingerprint_digest`, because it represents the complete invite intent rather than the recipient email alone. Candidate fields are a dedicated HMAC-SHA-256 recipient digest, key version and normalization version. Use a separate key/purpose (domain separation) from the request fingerprint; never store key material in Postgres. Define and version one canonical email normalization contract; do not apply provider-specific dot/plus alias folding. Digest is not a deliverable email address.

Client calls a public Edge Function with its access token and no actor UID/email. The function validates the bearer with Auth server-side, obtains authoritative UID/email/verified state, computes the recipient digest with a secret-manager key, and calls a private internal RPC using server credentials. The internal RPC is not Data-API exposed; revoke EXECUTE from PUBLIC/anon/authenticated and grant only to the required server role. Do not place SECURITY DEFINER functions in exposed schemas. The RPC must validate the actor and current Auth email/confirmation state against the values just verified by the Edge Function, with an appropriate lock to address email-change races; feasibility and permissions must be tested before implementation.

Candidate public contracts:
- List: `list_pending_invitations(cursor?, limit?)`; no email/UID/org/role inputs. Internal query returns only unexpired, unrevoked, valid pending invitations matching the recipient digest and active organization/role. Allowlist remains invitation ID, organization name, safe role label, created/expiry timestamps and derived pending status.
- Pagination: keyset by stable `(created_at, operation_id)`; default 20, maximum 50; no OFFSET/COUNT. Cursor is continuation data, never an authorization credential, and is validated/bound server-side to the current actor/digest.
- Accept: `accept_invitation(invitation_id, mutation_id)`; Edge Function revalidates bearer and digest on every call. The transaction rechecks invitation, actor/email verification, expiry/revocation, active organization, role and membership conflict, then commits membership + single role + audit + Shared Receipt + Saga completion atomically.
- Idempotency must bind invitation + authenticated actor + mutation ID + payload; same-key/different-payload conflicts; replay returns the original receipt; a different actor cannot obtain the result or membership.

Open blockers: final digest columns/normalization/key rotation; hosted permission and row-lock behavior for checking current auth.users email inside the acceptance transaction; activation state transition; expiry/revoke/decline and inviter authority; rate limits/audit retention; exact Shared Receipt key. Design only; no DDL/RPC/Edge Function/SQL/Supabase changes.


## 56. Hosted Auth user row-lock feasibility — review

Read-only inspection of `BAOTRI-Mini-Test` (PostgreSQL 17.12) found:
- `auth.users` is owned by `supabase_auth_admin`, RLS enabled, FORCE RLS off, zero explicit policies.
- `postgres` is non-superuser with BYPASSRLS, auth schema USAGE, and SELECT + UPDATE on `auth.users`.
- `supabase_auth_admin` also has SELECT + UPDATE; `service_role`, `authenticated`, and `anon` do not.
- `SELECT ... WHERE false FOR UPDATE` succeeded as postgres, testing privilege feasibility without locking any real row.
These are Test-project observations, not a guarantee for all customer projects.

PostgreSQL documents that `FOR UPDATE` holds a row lock through transaction end and blocks conflicting writers/lockers. Current GoTrue source `ConfirmEmailChange` updates `auth.users.email` in its transaction. This supports the candidate of locking the exact Auth user row during acceptance to serialize against a confirmed email change. Exact hosted Auth version still needs verification.

Candidate transaction: Edge Function validates bearer via Auth, obtains UID + exact current email + verified state, computes recipient HMAC; server-only function owned by postgres (SECURITY DEFINER, fixed empty search_path) locks `auth.users` by UID FOR UPDATE, compares current DB email with server-verified email and checks email_confirmed_at, then locks invitation Saga row and revalidates all invitation/membership conditions. Consistent lock order: Auth user → invitation/Saga → membership/role/audit/receipt. No network calls while locks are held. If email change committed first, old recipient digest fails; if acceptance locks first, email update waits until acceptance commits.

Do not grant direct auth.users SELECT/UPDATE to service_role, authenticated or clients. Grant only EXECUTE on the narrowly scoped internal function to the trusted server role. A private-schema function is not callable through PostgREST unless the schema is exposed; select either a trusted direct Postgres connection from Edge Function or a tightly restricted server-only RPC wrapper (revoke EXECUTE from PUBLIC/anon/authenticated; grant only to server role). Never expose auth.users through Data API.

Open: repeat read-only privilege preflight per Production project; verify deployed GoTrue version and email-change transaction behavior; test actual concurrent email-confirm-vs-accept, lock timeout, transaction rollback and admin email updates. The current false-predicate query did not test live contention. No DDL/RPC/Edge Function/SQL write or Supabase configuration change.

## 57. Concurrent invitation acceptance and Auth email-change test matrix

Test plan only; no tests have been executed. Use synthetic disposable users/invitations in BAOTRI-Mini-Test and two independent sessions with explicit barriers.

Required cases: acceptance locks Auth user first and email confirmation waits; confirmed email change commits first and stale Inbox acceptance rejects; simultaneous start serializes to one of those orders; email changes to another fixture's address without cross-acceptance; unconfirmed email rejects; invitation expiry/revocation; inactive organization/invalid role; existing membership/concurrent accept; lock timeout/deadlock/serialization failure; lost HTTP response and replay; same mutation ID with changed payload; unauthorized caller; direct Auth/Saga access denial; Admin email-update paths and all supported Auth email-change modes on deployed GoTrue.

Pass criteria: serializable observed ordering; success creates exactly one membership + one role + audit + Shared Receipt + Saga completion; rejection/rollback creates zero business writes; replay returns original receipt; no PII/secret leakage; browser roles cannot execute internal functions or read private/Auth tables. Initial randomized target: at least 20 interleavings per race class plus deterministic barriers for both lock orders.

Use test-only harness barriers, not production sleeps/debug hooks. A controlled SQL update can verify Postgres row-lock mechanics but does not prove the real GoTrue confirmation path. No fixtures or tests were run; no SQL writes, DDL, RPC, Edge Function, grants or config changes.

## 58. Edge Function → private Postgres function invocation review

Supabase's current documentation supports direct PostgreSQL client connections from Edge Functions. For transient Edge workloads, the documented preferred option is Shared Pooler transaction mode (port 6543); prepared statements must be disabled. This can call a function in a private/non-exposed schema without exposing it through PostgREST.

Candidate: validate bearer JWT in Edge Function; derive authoritative UID; compute recipient HMAC server-side; connect over TLS through transaction pooler using a dedicated restricted DB login; execute exactly one private acceptance function; return a minimal result. The DB login receives only schema USAGE and EXECUTE on that function, not table SELECT/UPDATE on auth.users, Saga, attempts, memberships, roles, audit or receipts. Never use postgres/service_role as the Edge Function's general connection identity.

The function candidate remains SECURITY DEFINER owned by a verified privileged owner, fixed empty search_path, fully qualified names, strict validation, and one atomic statement transaction for Auth row lock + invitation lock + membership/role/audit/receipt/Saga writes. Do not split lock and mutation across multiple pooled queries. Bind server-verified UID to authorization and idempotency; never trust a client UID.

Open before implementation: dedicated DB login role creation/grant policy; credential storage/rotation; pooler TLS and connection limits; driver support and prepared-statement disablement; exact transaction semantics; actor binding; hosted project pooler settings; end-to-end JWT and concurrency tests. No role, grant, DDL, RPC, Edge Function, secret or Supabase setting was changed.

### Actor identity and callable-surface caveat
A direct PostgreSQL connection does not automatically carry the end-user JWT context that PostgREST normally establishes. Do not assume auth.uid() identifies the browser user on this connection, accept client-supplied UID, or set request.jwt.claims from untrusted client data.

The Edge Function must validate the bearer token server-side (for example via Auth getUser / verified claims) and derive UID from the verified result. The private DB function receives that UID over the dedicated server-only DB connection and binds it to invitation authorization and idempotency. The trust boundary is Edge Function code + DB credential: a caller possessing that credential could potentially pass another UID unless a separately designed cryptographic assertion is verified in the database.

Use a unique restricted DB login/secret for this acceptance path; never expose it to the browser or share it with unrelated functions. Audit all callable functions available to that role, including EXECUTE inherited from PUBLIC and any SECURITY DEFINER functions in schemas where it has USAGE. A grant on one named function alone does not prove the role has no other callable surface. Any signed actor assertion needs explicit key lifecycle, audience, expiry, replay binding and verification design. Do not trust an ad-hoc GUC/JWT claim without signature verification.

This identity boundary and callable-surface audit are required before creating any role/function.

## 59. Least-privilege role/function matrix — findings and proposed grants

Read-only catalog inspection of BAOTRI-Mini-Test (PostgreSQL 17.12) found: public schema USAGE for anon/authenticated/service_role; multiple SECURITY DEFINER functions in public with EXECUTE granted to authenticated or service_role; function default ACLs differ by owner/schema and include API-role EXECUTE grants for inspected postgres/supabase_admin ownership contexts. Auth table direct SELECT/UPDATE remains restricted as documented earlier. No Edge-specific login or private acceptance function exists.

Proposed, unapplied matrix:
- Browser anon/authenticated: no direct DB credential, no private schema USAGE, no acceptance EXECUTE, no direct Auth/Saga/attempt/membership/role/audit/receipt table access.
- service_role: not used as the direct DB login and receives no acceptance function grant.
- Dedicated Edge DB login: LOGIN only; NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS; no privileged role memberships/SET ROLE; TLS; connection limit; server-side rotated secret. CONNECT to target DB if narrowed by policy; USAGE on one private schema; EXECUTE on one exact function signature; no direct table DML/SELECT.
- Candidate function owner: verified privileged owner (postgres is only a candidate pending Production review); SECURITY DEFINER, fixed empty search_path, fully qualified names, strict validation, minimal result. Owner privilege is the explicit elevated boundary.
- Explicitly revoke function EXECUTE from PUBLIC, anon, authenticated and service_role; grant only the dedicated Edge login. Verify effective privileges using has_function_privilege and inspect ACLs after migration.
- Default privileges are owner- and schema-specific. Revoke default EXECUTE for PUBLIC/API roles for the exact owner/schema before future functions; inspect pg_default_acl rather than assuming one owner setting applies to another.
- Keep private schema out of Data API exposed schemas and do not grant the Edge login USAGE on public/auth/storage/vault/extensions unless a reviewed dependency requires it. Audit all callable functions in every schema it can use, including PUBLIC-inherited EXECUTE and SECURITY DEFINER functions.
- No table privileges to Edge login; the SECURITY DEFINER function performs the one atomic transaction. No dynamic SQL unless identifiers are safely handled.

Blocking identity issue: direct Postgres does not set PostgREST JWT context, so auth.uid()/auth.jwt() cannot be trusted as caller identity. If Edge Function validates JWT then passes UID, DB trusts that code and credential; credential compromise could spoof UID. Before implementation choose explicitly between accepting Edge Function as the trusted boundary with strong controls, or designing a signed short-lived actor assertion verified by DB (signature, audience, expiry, replay). No ad-hoc GUC/client UID is sufficient.

This is design/read-only evidence only. No role, grant, schema, function, secret or migration was created or changed.

### Additional role-semantics verification
On BAOTRI-Mini-Test, read-only `pg_roles` inspection shows postgres is LOGIN but not SUPERUSER; however CREATEDB, CREATEROLE, REPLICATION and BYPASSRLS are true, so it is unsuitable as a runtime Edge credential. service_role is NOLOGIN and BYPASSRLS true; anon/authenticated are NOLOGIN without BYPASSRLS; authenticator is LOGIN/NOINHERIT for PostgREST role switching; supabase_auth_admin is LOGIN/CREATEROLE for Auth internals and must not be reused.

Supabase's Postgres Roles guide recommends a separate database user per external service. For the dedicated Edge login, prefer no role memberships at all, not merely NOINHERIT: NOINHERIT blocks automatic inheritance but membership may still permit SET ROLE depending on membership options/version. Verify no membership path, no SET ROLE path and effective privileges. No changes applied.

## 60. PG17 crypto/Vault findings and authenticated RPC alternative

Read-only inspection of BAOTRI-Mini-Test (PostgreSQL 17.12) found pgcrypto 1.3 installed in schema extensions; pgjwt absent. Supabase marks pgjwt deprecated on PostgreSQL 17, so do not adopt it for JWT verification. The vault schema and secrets/decrypted_secrets objects exist, but vault was not listed as an installed extension in pg_extension; availability/lifecycle requires confirmation. service_role has SELECT on vault.secrets and vault.decrypted_secrets plus schema USAGE. Do not use service_role as a generic secret reader or expose vault schema through Data API; exposed-schema configuration has not been checked. No secret values were read.

pgcrypto HMAC may support recipient email digest calculation inside DB if the key can be read by a narrowly privileged function owner without exposing it to caller. HMAC is not a complete JWS/JWT verifier and does not verify Supabase asymmetric ES256/RS256 tokens.

Alternative to evaluate: one narrow authenticated PostgREST RPC wrapper. PostgREST verifies the user's JWT and switches to authenticated role; wrapper derives actor using auth.uid(), not caller input; it checks Auth user's current email/verified state and delegates to a private SECURITY DEFINER transaction function that locks Auth + invitation and commits membership/role/audit/receipt/Saga atomically. Revoke wrapper EXECUTE from PUBLIC/anon; grant authenticated only; strict validation and minimal result. Direct authenticated calls are safe only if function enforces all invariants itself. Recipient HMAC can be computed inside DB only if secret isolation is solved; Vault grants need careful review.

This may avoid a dedicated Edge DB credential and UID-spoofing boundary. Before choosing it, verify JWT context within SECURITY DEFINER, API exposed-schema config, wrapper/inner ACLs, Vault isolation and concurrency behavior. No implementation or architecture decision is finalized.

## 61. PostgREST JWT actor context and Vault effective privileges

Read-only Test catalog inspection confirmed `auth.uid()` reads `request.jwt.claim.sub`, falling back to `request.jwt.claims ->> 'sub'`, then casts to UUID. Effective privileges: anon/authenticated can use auth schema and execute auth.uid(); neither can use vault schema or select Vault secrets/decrypted_secrets. service_role and postgres can use vault and select both. No claim was forged/set, no user or privilege was changed.

Implications: a normal authenticated Supabase RPC call can rely on PostgREST's validated JWT request context; wrapper and private SECURITY DEFINER body derive actor only from auth.uid(), never caller UID/email/org/role. Do not overwrite JWT request settings. Direct SQL/Edge→Postgres does not have the same verified context; session settings can be caller-controlled. Re-lock and validate auth.users current email/confirmed state inside the same transaction before invitation lock/acceptance. Revoke wrapper EXECUTE from PUBLIC/anon; grant authenticated only; private implementation in non-exposed schema with restricted EXECUTE, fixed empty search_path and fully qualified names.

Vault: authenticated users cannot directly read Vault. A tightly scoped SECURITY DEFINER path may read a secret, but a postgres-owned function is a high-privilege boundary; evaluate a narrower owner. Vault schema absence from pg_extension does not mean Vault is absent; schema and objects exist. Managed packaging/lifecycle remains to verify.

Authenticated PostgREST RPC is now the preferred candidate to prototype before direct Edge DB login, but not approved architecture. Need real API-path JWT-context test, exposed-schema inspection, secret access design and Auth email-change concurrency tests. No DDL/RPC/grants/secrets/config changes.

## 62. PostgREST exposure and invitation RPC placement

Catalog inspection of pg_settings and pg_db_role_setting did not reveal pgrst.db_schemas. This does not prove no schemas are exposed; actual API Settings → Exposed schemas must be checked in Dashboard or supported management API. The queried repository path supabase/config.toml does not exist, so deployment exposure cannot be inferred from repo config. Existing Test app tables in public have RLS enabled, but that does not establish RPC schema exposure or function ACL safety.

Candidate layout: private tables and implementation in a non-exposed private schema; exactly one narrow RPC wrapper in a deliberately exposed schema (likely public after Dashboard verification). Wrapper SECURITY DEFINER only if needed; fixed search_path='', fully qualified objects, actor from auth.uid(), no trusted actor/email/org/role arguments. Private implementation callable only by wrapper owner. Revoke wrapper EXECUTE from PUBLIC/anon, grant authenticated only; no browser USAGE on private or direct table access. Keep entire acceptance in one PostgREST RPC transaction; plan schema-cache reload and rollback.

Preflight: confirm exposed schemas separately in Test/Production; verify private is not exposed; confirm only wrapper appears in RPC discovery; test anon denied/authenticated allowed; test private/Auth/Vault direct access denied; verify JWT context inside SECURITY DEFINER; check overloads/default ACL; rerun privilege/RLS tests for anon, no-membership, valid/expired/revoked invitee and unrelated user. No exposure/schema/function/grant/config/data change.

## 63. Membership RLS and SECURITY DEFINER bypass

Read-only Test inspection: RLS is enabled but not FORCE on organizations, organization_members, member_roles, roles, role_permissions and profiles; owner is postgres. Existing member/role SELECT policies require organization membership; profiles restrict self/same-org. authenticated has SELECT grants with RLS filtering and no direct DML on these inspected tables. service_role has broad table privileges + BYPASSRLS; postgres also BYPASSRLS. Existing policies do not supply the narrow pending-invitation inbox for users without membership.

If acceptance SECURITY DEFINER runs as postgres/BYPASSRLS, it bypasses RLS. The function must explicitly revalidate actor from auth.uid(), current confirmed Auth email, recipient digest/version, pending/unexpired/unrevoked invite, active org, valid role, inviter authority, target binding, no conflicting membership and idempotency actor+invite+mutation+payload. Lock deterministically and commit membership+role+audit+Shared Receipt+Saga atomically; return only minimal outcome. Add negative tests for cross-tenant IDs, wrong recipient, suspended/removed user, expired/revoked invite, invalid role, demoted inviter, existing membership and cross-actor replay. Do not weaken RLS or use FORCE RLS as a shortcut without assessing owner/FK/trigger semantics.

This confirms RPC is only the transport/identity boundary; all business authorization remains explicit in the transaction. No RLS/grant/function/data change.

## 64. Membership trigger side-effect inventory

Read-only Test inspection found only updated_at triggers on organizations, organization_members and profiles; no non-internal triggers on member_roles or roles/role_permissions, and no trigger that creates roles, audit, invitation state or receipts. Acceptance must explicitly write membership, member_roles, audit, Shared Receipt and Saga completion in one transaction. Reinspect trigger inventory before deployment because future migrations may change it. No trigger/table change.


## 65. Vault ownership/grantor clarification and digest-only helper candidate (20/11/2026)

Supabase KB updated 04 Nov 2026 states that Vault schema objects are owned by `supabase_admin`; postgres cannot revoke grants it did not make. Its documented least-exposure pattern is a `SECURITY DEFINER` function in a non-exposed schema that returns one intended secret to a specifically granted role without granting that role direct Vault access. Database Functions docs require fixed/empty search_path and explicit schema qualification, and warn that functions are EXECUTE-granted broadly by default.

Read-only Test catalog verification: vault schema, secrets table and decrypted_secrets view are owned by supabase_admin; grantor is supabase_admin; postgres has SELECT with grant option; service_role has SELECT without grant option. This explains why revoking service_role's Vault access as postgres is ineffective. No secret values read; no changes made.

BAOTRI candidate: a private SECURITY DEFINER helper owned by a Vault-capable owner reads one fixed-name HMAC key, computes HMAC-SHA-256 internally and returns only a digest. EXECUTE is restricted to the internal acceptance-function owner; no browser/API role or service_role access; helper schema is not exposed. The acceptance flow supplies only the current verified email read under lock after actor is derived from auth.uid(). This must not become a caller-controlled HMAC oracle.

This resolves a documented pattern for secret isolation, not the acceptance function owner problem. Compare a single postgres-owned privileged transaction function against a split design with a narrower acceptance owner and dedicated Vault helper. Revalidate effective ACL, schema USAGE, owner/membership chain, default ACL, overloads and callable SECURITY DEFINER surface. No DDL/RPC/grants/secrets/config changes.


## 66. Split-owner design candidate for invitation acceptance

Read-only catalog results: auth.users is owned by supabase_auth_admin; postgres has SELECT with grant option and UPDATE privilege. Inspected business membership tables are owned by postgres. Vault schema/objects are owned by supabase_admin; postgres has SELECT with grant option, while service_role has a managed SELECT grant. No custom acceptance role exists.

Candidate split design:
- Private postgres-owned SECURITY DEFINER helper derives actor from auth.uid() in the verified PostgREST context, locks and validates the current confirmed Auth user/email, computes recipient HMAC using one fixed-name Vault key, and returns only actor UUID + digest. It accepts no client UID/email and never returns the key or raw email. EXECUTE only to the internal acceptance owner; no exposed schema or API-role access.
- A separate NOLOGIN membership RPC owner owns the narrow exposed wrapper; candidate privileges include BYPASSRLS but only exact table grants required for membership/role/invitation/receipt/audit operations, schema USAGE, and EXECUTE on the private helper. It receives no Auth/Vault access and no login credential. Its SECURITY DEFINER wrapper accepts opaque invitation ID + mutation ID and performs explicit authorization checks plus atomic writes.

BYPASSRLS remains a strong privilege even on a NOLOGIN role; exact grants, role membership/SET ROLE, default ACL, function ownership, foreign-key/trigger effects and lock order must be verified. Nested SECURITY DEFINER preservation of PostgREST JWT context must be tested through the real API before implementation. This is a candidate only; no DDL/role/grant/RPC or API test.


## 67. Auth-trigger membership activation và quyền mặc định – 20/11/2026

### Trigger side effect mới được xác minh
- Trên BAOTRI-Mini-Test, public.sync_auth_user_profile() là SECURITY DEFINER owner postgres, fixed empty search_path. Trigger Auth UPDATE trên email/raw_user_meta_data/email_confirmed_at gọi function này.
- Function đồng bộ profiles, rồi nếu email đã confirmed thì tự UPDATE mọi organization_members của user từ invited sang active. Điều kiện không kiểm tra recipient digest, invitation ID, expiry/revocation, tenant status, role, inviter authority hay mutation/receipt.
- Trigger không tạo member_roles, audit, Shared Receipt hoặc Saga completion. Có nguy cơ trạng thái active bị tạo ngoài acceptance transaction và thiếu các bản ghi liên quan.
- Kiến nghị thiết kế: trigger Auth chỉ làm profile sync; membership activation phải nằm trong một acceptance transaction duy nhất. Chỉ là kiến nghị; cần review tương thích legacy và migration riêng trước khi áp dụng.

### FK/trigger và lock ordering
- Trigger Auth có đường khóa ngầm: auth.users -> profiles -> organization_members. Acceptance không được khóa membership trước rồi mới chạm Auth user. Candidate order phải bắt đầu Auth actor, sau đó Profile nếu cần, rồi Organization/Saga/Membership/Role, cuối cùng audit/receipt; thứ tự Organization vs Saga cần audit mọi writer trước khi chốt.
- member_roles có FK cascade khi membership hoặc role bị xóa; organization_members tham chiếu Organization/Profile bằng RESTRICT; role cũng tham chiếu Organization bằng RESTRICT. Các FK parent lock cần được tính vào phân tích concurrency. Không có trigger nghiệp vụ trên member_roles/roles/role_permissions trong inventory hiện tại.
- Draft 021_member_audit_and_invite_saga_DRAFT.sql chưa được áp dụng; bảng Saga/Audit trong draft không tồn tại trong catalog hiện tại.

### Default ACL và role membership
- pg_default_acl trên Test cho thấy khi postgres tạo function trong public, default EXECUTE được cấp cho anon, authenticated và service_role; default table privileges trong public cũng rộng. Vì vậy việc tạo SECURITY DEFINER/RPC function bằng postgres phải có revoke/GRANT chính xác trong cùng transaction tạo object và phải kiểm tra effective privileges sau đó; không được giả định function mới tự private.
- Catalog role membership cho thấy postgres có membership mạnh vào service_role (admin/inherit/set option); authenticator có SET membership vào anon/authenticated/service_role phục vụ PostgREST. Chưa có member_rpc_owner hoặc custom acceptance role. Role owner tương lai không được có membership/SET ROLE path tới postgres, service_role hay role đặc quyền; kiểm tra cả role graph và effective privileges.
- Nếu function được tạo bằng SET ROLE sang custom owner, phải đọc default ACL của đúng effective creator/schema; không suy luận từ default ACL postgres. Exact function signature, PUBLIC/API grants, schema USAGE, overloads và callable SECURITY DEFINER surface đều phải audit.

### Nguồn kỹ thuật
- PostgreSQL 17 Explicit Locking: https://www.postgresql.org/docs/17/explicit-locking.html (deadlocks có thể phát sinh từ row-level locks; phòng ngừa bằng thứ tự khóa nhất quán).
- Supabase Database Functions: https://supabase.com/docs/guides/database/functions (SECURITY DEFINER, search_path và EXECUTE grants cần được kiểm soát rõ).
- Không có thay đổi database trong lần rà soát này.


## 68. Legacy membership writers và các đường ghi song song – 20/11/2026

### Inventory SECURITY DEFINER liên quan
- admin_create_org_membership: owner postgres, SECURITY DEFINER, EXECUTE postgres/service_role; khóa auth.users FOR UPDATE rồi tạo organization_members + member_roles. Không ghi Saga/audit/Shared Receipt.
- admin_remove_org_membership: owner postgres, SECURITY DEFINER, EXECUTE postgres/service_role; khóa membership FOR UPDATE, xóa membership và FK cascade member_roles.
- admin_update_org_member_role: owner postgres, SECURITY DEFINER, EXECUTE postgres/service_role; đọc membership/role rồi DELETE/INSERT member_roles, chưa có SELECT FOR UPDATE trên membership ở bước đầu.
- admin_update_org_member_status: owner postgres, SECURITY DEFINER, EXECUTE postgres/service_role; đọc membership rồi UPDATE trạng thái, row lock được lấy ở UPDATE.
- has_org_permission/has_org_role/is_org_member là read helpers SECURITY DEFINER, không ghi membership.

### Hệ quả
- Legacy create function đã dùng Auth -> Membership lock order, phù hợp với cảnh báo không lấy membership lock trước rồi mới lấy Auth lock. Nhưng nó là đường tạo membership quản trị bằng service_role, không có recipient digest/Saga/audit/receipt; phải phân biệt rõ với self-acceptance.
- Remove path khóa membership và cascade member_roles nhưng không chạm Auth. Role update chưa khóa tường minh parent membership; cần concurrency test và xác định role cardinality mong muốn trước khi khẳng định một role/membership.
- Khi triển khai acceptance mới, phải kiểm kê và quyết định giữ, giới hạn hoặc retire các server-only writer cũ; không để đường cũ vô tình thay thế invitation acceptance mới. ACL hiện tại không cấp các hàm ghi này cho anon/authenticated.
- Global lock order chưa được xác nhận; cần rà caller/transaction composition ngoài định nghĩa hàm và các đường update Auth/Profile/Membership.

### Trạng thái
Chỉ đọc function definitions và ACL. Không sửa function, grant, role hoặc dữ liệu.


## 69. Server caller và role cardinality – 20/11/2026

### Caller đã xác minh
- Static search toàn repo tìm thấy một Edge Function gọi bốn membership writer legacy: `supabase/functions/manage-organization-members/index.ts`. Không tìm thấy caller khác trong kết quả search hiện tại; đây là kết quả static search, không phải chứng minh runtime không có caller ngoài repo.
- Edge Function xác thực Bearer bằng caller client, kiểm tra `has_org_permission(users.manage)`, sau đó mới tạo service_role client và gọi RPC. Vì permission preflight và mutation là hai request riêng, RPC vẫn phải tự xác minh actor, organization, quyền hiện tại và target trong transaction; không được tin actor UUID do caller truyền vào hoặc kết quả preflight cũ.
- Action list đọc membership, profiles, member_roles và roles bằng nhiều truy vấn riêng, không phải một snapshot transaction. `Map(member_id -> role_id)` chỉ giữ một role cho mỗi member; nếu có nhiều assignment thì một role bị ghi đè theo thứ tự trả về.
- UI `OrganizationMemberView` chỉ có scalar `roleCode/roleName` và một select role đơn. Reset/remove preflight xử lý danh sách roleCodes, nhưng UI/list API không biểu diễn được multi-role.
- Invite tạo Auth user trước khi gọi `admin_create_org_membership`; khi RPC trả lỗi, Edge Function gọi `deleteUser` nếu Auth user vừa tạo nhưng không kiểm tra kết quả xóa. Với outcome không chắc chắn, compensation phải recheck cùng operation/membership state trước khi xóa Auth user; không được coi lỗi RPC là bằng chứng membership chưa commit.
- Reset/remove đọc membership và role assignments trước RPC bằng nhiều request. Các điều kiện chống xóa Admin/kiểm tra target ở Edge Function chỉ là preflight; RPC phải khóa và kiểm tra lại invariant trong transaction.
- Supabase hiện báo Edge Function `manage-organization-members` ACTIVE, version 5, verify_jwt=true. Metadata này không chứng minh source deployed trùng tuyệt đối với file GitHub; chưa đọc được deployed source.

### Cardinality và dữ liệu Test
- Schema `member_roles` hiện có PK `(organization_id, member_id, role_id)`, không có UNIQUE `(organization_id, member_id)`; database hiện cho phép nhiều role/membership.
- Migration 005, UI và luồng đổi role đang theo mô hình một role hiện hành. Tài liệu RPC đã chốt policy phiên bản hiện tại là đúng một role/membership và đề xuất UNIQUE `(organization_id, member_id)` sau preflight; chưa áp dụng constraint.
- Read-only preflight trên BAOTRI-Mini-Test tại thời điểm rà soát: 4 memberships; 4 có đúng một assignment; 0 thiếu assignment; 0 có nhiều assignment; 0 membership có assignment nhưng không có active role. Đây chỉ là snapshot Test, không thay thế preflight trước migration và không đại diện Production.
- Không sửa dữ liệu, schema, RPC, Edge Function, grants hoặc cấu hình. 


## 70. Shared Receipt contract và lock-order inversion với Auth trigger – 20/11/2026

### Receipt contract
- Đối chiếu Member design §25/§27 và Shared Receipt review: operation code ổn định, mutation ID riêng cho mỗi logical intent; Invite Saga operation_id độc lập với Shared Receipt mutation_id.
- Fingerprint phải mô tả request intent canonical do server dựng. Áp dụng §27.7: không dựng fingerprint từ mutable role/status hiện tại sau commit; expected-current-state nếu có chỉ là precondition kiểm tra ở nhánh mutation mới.
- Replay yêu cầu Auth hợp lệ + Organization active + actor membership active + cùng actor/operation/fingerprint. Replay không yêu cầu lại write permission cũ; snapshot chỉ trả theo read permission hiện tại. Remove chỉ acknowledgement tối thiểu. Mutation mới mới kiểm tra write permission và claim Receipt.
- Receipt claim dùng unique key, INSERT ... ON CONFLICT DO NOTHING rồi SELECT ở statement kế tiếp theo READ COMMITTED. Receipt, business write và audit phải atomic; Saga Auth API là quy trình nhiều transaction riêng. Member hiện không bật Change Feed.
- Catalog Test hiện chỉ có asset_mutation_receipts; organization_mutations, organization_member_invite_operations và organization_member_audit_events chưa tồn tại. Draft 020/021 chưa áp dụng.

### Lock-order conflict cần xử lý trước implementation
- Member §25.1 và Shared Receipt review §6.3 thống nhất proposed order: Organization → actor/target Membership (UUID tăng dần) → member_roles → Role → Role Permission → Auth user → Receipt → business rows → sync counter/events → Receipt finalize.
- Nhưng Auth trigger hiện tại còn tự chuyển invited → active, nên đường khóa là Auth user → Profile → Membership. Đây là inversion với proposed Member order; khi hai transaction đồng thời có thể hình thành deadlock (transaction Auth giữ Auth chờ Membership, transaction Member giữ Membership chờ Auth).
- Proposed order chỉ an toàn sau khi trigger không còn ghi Membership (chỉ sync Profile), hoặc có protocol concurrency khác được chứng minh. Cần xem đây là prerequisite trước khi triển khai acceptance/finalize RPC; chưa sửa trigger.
- Candidate Auth-first trong ghi chú §67/§81 mô tả đường trigger cũ; §25.1 là canonical proposal sau khi loại side effect. Phải phân biệt rõ hai giai đoạn và không áp dụng lẫn lộn.

### Trạng thái
Chỉ đọc tài liệu và catalog. Không SQL write, DDL, RPC, grants, role, Auth/data, secrets hoặc cấu hình Supabase thay đổi.


## 71. Writer/revoker inventory cho Organization, Role và Permission – 20/11/2026

### Catalog Test
- Năm bảng `organizations`, `organization_members`, `member_roles`, `roles`, `role_permissions` đều bật RLS.
- Effective privilege: authenticated có SELECT, không có INSERT/UPDATE/DELETE trên cả năm bảng. Service_role có INSERT/UPDATE/DELETE; RLS không phải ranh giới bảo vệ service_role.
- Policies hiện chỉ là SELECT cho authenticated, predicate `is_org_member(...)`; không có write policy cho authenticated trên các bảng này.
- Trigger inventory: `organizations` và `organization_members` chỉ có BEFORE UPDATE `set_updated_at()`; không có trigger trên `member_roles`, `roles`, `role_permissions`.
- Public SECURITY DEFINER function inventory không có RPC tạo/sửa organization, roles hoặc role_permissions. Các hàm quản lý member hiện tại chỉ tạo/xóa membership, gán role hoặc đổi status; `has_org_permission`, `has_org_role`, `is_org_member` là read helpers. Seed built-in roles/permissions nằm trong migration 005.
- Supabase hiện chỉ liệt kê một Edge Function ACTIVE: `manage-organization-members`. Nó gọi các RPC membership đã rà soát; không thấy Edge Function riêng để quản lý Organization/Role/Role Permission.
- Static GitHub search không tìm thấy caller dùng `.from("organizations").insert/update`, `.from("roles").insert/update` hoặc `.from("role_permissions").insert/delete`. Đây là giới hạn của search/code snapshot, không phải bằng chứng tuyệt đối về mọi external client.

### Hệ quả lock matrix
- Trong trạng thái Test hiện tại, chưa có server RPC/revoker nghiệp vụ cho Organization, Role hoặc Role Permission ngoài các migration/manual privileged SQL. Vì vậy chưa có một cặp RPC writer/revoker runtime đầy đủ để concurrency-test trên các bảng này.
- Service_role vẫn có DML và bypass RLS; mọi Edge Function mới dùng service_role phải được xem là privileged writer và được audit như một transaction path, không dựa vào RLS.
- Trước khi triển khai `roles.manage` hoặc Organization status management, phải bổ sung RPC có authorization trong transaction, khóa theo Member §25.1/Shared Receipt §6.3 và test cạnh tranh giữa grant/revoke với business mutation. Không cho phép client authenticated ghi trực tiếp.
- `has_org_permission()` là helper đọc trạng thái hiện tại, không thay thế việc khóa membership/assignment/role/permission trong transaction mutation cần bảo đảm quyền không bị thu hồi giữa chừng.

### Trạng thái
Read-only catalog, RLS/grants/policy/trigger/function inventory và static search. Không thay đổi schema, grants, role, data, RPC hoặc Supabase config.


## 72. Cross-vertical Asset RPC và Member lock-order review – 20/11/2026

### Asset RPC lock paths đã đọc
- `create_asset_with_code`: gọi `has_org_permission(assets.create)`, sau đó đọc Organization Settings/Assets, upsert Asset Code Counter và INSERT Asset. Không khóa Organization, actor Membership, member_roles, Role hoặc Role Permission.
- `import_asset_preserving_identity`: kiểm tra `has_org_permission(assets.import)`, sau đó xử lý import ledger/counter/Asset; không khóa các row authorization Organization/Membership/Role/Permission trước mutation.
- `apply_asset_mutation_with_lock`: kiểm tra `has_org_permission(assets.update)`, tra Asset-specific Receipt, sau đó khóa Asset Edit Lease FOR UPDATE, khóa Asset FOR UPDATE, cập nhật Asset và ghi Asset Receipt. Không khóa Organization/Membership/role assignments/Role/Role Permission.
- `update_asset_with_lock` và `set_asset_archived_with_lock`: kiểm tra permission trước, khóa Lease rồi cập nhật Asset; không khóa các row authorization.
- `acquire_asset_edit_lock`/ `heartbeat_asset_edit_lock`: kiểm tra permission rồi ghi Lease; không khóa Membership/Role/Permission. `release_asset_edit_lock` là đường giải phóng Lease theo holder/token.
- `has_org_permission`, `has_org_role`, `is_org_member` đều STABLE SECURITY DEFINER read helpers; không tự lấy row lock và không thể thay thế authorization locks.

### Hệ quả concurrency
- Hiện Asset RPCs và Member status/role RPCs không dùng chung lock chain. Ví dụ Asset mutation có thể đọc permission=true, sau đó một transaction khác suspend membership hoặc đổi role, nhưng Asset transaction không giữ lock trên Membership/assignment để serialize với thay đổi đó. Mutation có thể tiếp tục sau khi revoke đã commit tùy timing.
- Đây là race về thời điểm hiệu lực revoke, không tự động chứng minh có thể vượt tenant boundary; nhưng nếu yêu cầu “revoke commit xong thì không có business write mới dựa trên quyền cũ”, các RPC cần một protocol chung.
- Proposed Member order §25.1 chưa được áp dụng trong Asset RPC hiện tại. Khi Shared Receipt/Member cutover, phải quyết định có nâng các Asset RPC lên cùng Organization → Membership → assignment → Role → Permission lock order hay định nghĩa rõ semantics cho in-flight mutations. Không được thêm lock tùy tiện trước khi phân tích Lease/Asset/Receipt order.
- Asset-specific Receipt path hiện kiểm tra write permission trước lookup Receipt; điều này đã được ghi nhận riêng là chưa khớp replay policy Shared Receipt khi permission bị thu hồi. Không sửa Asset RPC trong review này.

### Trạng thái
Chỉ đọc function definitions trong catalog Test và migration source. Không chạy RPC, không sửa SQL/function/lease/receipt, không thay đổi dữ liệu hoặc cấu hình.


## 73. Lock matrix liên vertical: Member/Auth/Asset/Receipt – 20/11/2026

### Lock path hiện tại đã xác minh từ source và catalog Test

| Luồng | Thứ tự khóa/ghi quan sát được | Ghi chú |
|---|---|---|
| Auth profile trigger | Auth user (UPDATE caller) → Profile upsert → Membership UPDATE invited→active | Trigger vẫn có business side effect; tạo inversion với Member proposed order |
| Member create legacy | đọc Organization/Role → Auth user FOR UPDATE → Profile read → INSERT Membership → INSERT member_roles | Có Auth-first rõ ràng; không Shared Receipt/Audit |
| Member role change | đọc Membership/Role không FOR UPDATE → DELETE/INSERT member_roles | Không khóa parent Membership trước; concurrency/race cần xử lý |
| Member status change | đọc Membership/Role → UPDATE Membership | Row lock chỉ lấy ở UPDATE; không khóa Organization/role chain trước |
| Member remove | Membership FOR UPDATE → DELETE Membership → FK cascade member_roles | Có parent-first trong nhánh remove |
| Asset create | đọc Settings/Assets → UPSERT asset_code_counters → INSERT Asset | Counter row serialize cùng org/category; không lock authorization rows |
| Asset import | advisory xact lock theo org+mutation → đọc ledger → đọc Settings → UPSERT counter → Asset FOR UPDATE (nếu tồn tại) hoặc INSERT → INSERT import ledger | Counter trước Asset; idempotency ledger riêng, không phải Shared Receipt |
| Lease acquire | kiểm tra permission + đọc Asset → UPSERT asset_edit_locks | Unique conflict serializes cùng asset; không giữ Organization/Membership lock |
| Lease heartbeat/release | UPDATE hoặc DELETE asset_edit_locks | Không kiểm tra permission khi release; chỉ holder + token |
| Asset update/archive | Asset Edit Lease FOR UPDATE → UPDATE Asset | Thứ tự Lease → Asset |
| Asset mutation receipt | lookup Receipt (read) → Lease FOR UPDATE → recheck Receipt → Asset FOR UPDATE → UPDATE Asset → INSERT asset_mutation_receipts | Receipt được ghi sau business row, khác Shared Receipt proposed claim-before-business |
| Auth user delete (FK path) | Auth user delete → FK CASCADE asset_edit_locks; FK RESTRICT ở Asset receipts/import ledger | Đường này do Auth Admin/Postgres thực hiện, không phải RPC trong repo |

### FK/trigger đã kiểm tra trên Test
- `asset_edit_locks(holder_user_id)` tham chiếu `auth.users(id) ON DELETE CASCADE`; `asset_edit_locks(organization_id, asset_id)` tham chiếu Asset ON DELETE CASCADE.
- `asset_mutation_receipts.applied_by_user_id` và `asset_import_mutations.actor_user_id` tham chiếu Auth user ON DELETE RESTRICT.
- `asset_code_counters.organization_id` và `asset_import_mutations.organization_id` tham chiếu Organization ON DELETE RESTRICT.
- Trigger nghiệp vụ duy nhất trong nhóm Asset đang kiểm tra là BEFORE UPDATE trên `assets` để cập nhật `updated_at`; không có trigger trên Lease/Receipt/Import ledger/Counter.

### Deadlock/race cần giữ ở trạng thái open
1. **Auth deletion ↔ Asset mutation (deadlock candidate có cơ sở FK):** transaction A xóa Auth user và CASCADE xóa Lease; transaction B đang giữ Lease rồi ghi Asset Receipt, FK cần xác nhận `applied_by_user_id` còn tồn tại. Có thể tạo chu trình Auth row ↔ Lease row. Cần xác minh bằng concurrency test được kiểm soát trước khi chốt; chưa chạy test.
2. **Member revoke ↔ Asset write:** Asset RPC chỉ đọc permission helper STABLE, không khóa Membership/assignment/Role/Permission. Revoke có thể commit trong khi Asset mutation đã qua check quyền. Chưa có linearization point chung.
3. **Asset Lease/Asset ↔ Shared Receipt:** Asset mutation hiện Lease → Asset → Receipt insert; Shared Receipt proposal claim Receipt trước business rows. Cần chọn một thứ tự thống nhất, xử lý cả unique claim/replay và FK.
4. **Counter ↔ Asset:** create/import đều Counter → Asset; import có thêm advisory lock trước Counter. Giữ nguyên thứ tự này trong mọi import/create path; không thêm path Asset → Counter.
5. **Role update ↔ Membership status/remove:** role update chưa FOR UPDATE parent Membership; status update chỉ khóa ở UPDATE; remove khóa Membership trước cascade. Cần chuẩn hóa actor/target Membership locks theo UUID tăng dần trước assignment/Role/Permission.

### Candidate protocol để nghiên cứu tiếp (chưa chốt)
- Business mutation cần bảo đảm revoke serialization: Organization → actor/target Membership theo UUID → member_roles → Role → Role Permission → Auth user (nếu bắt buộc) → operation/Receipt claim → domain lock (Asset Lease/Counter/advisory theo namespace) → Asset/business rows → Receipt finalize.
- Đây chưa phải lock order đã được chứng minh. Cần xử lý Auth trigger trước; phân loại Auth delete; định nghĩa domain lock order Lease/Counter/Asset; tránh khóa Auth nếu không cần; kiểm tra mọi FK cascade/restrict.
- Asset Receipt replay hiện chạy permission check trước lookup. Shared Receipt proposal yêu cầu replay branch tách khỏi write permission sau khi Auth/Organization/active membership được xác thực; cần sửa thiết kế trước khi đồng nhất API.
- Không chạy concurrency test, không sửa SQL, không triển khai thay đổi.

### Trạng thái
Read-only review source migrations, FK, triggers và effective privileges trên BAOTRI-Mini-Test. Ma trận là inventory/candidate, chưa phải chứng nhận không deadlock.


## 74. Asset hard-delete path và Lease cascade – 20/11/2026

### Quyền xóa hiện tại
- Migration 006 có policy `assets_delete_permission` cho authenticated với predicate `has_org_permission(organization_id, 'assets.delete')`.
- Effective privilege Test xác nhận authenticated có DELETE trên `public.assets`, không có UPDATE. Do đó direct PostgREST DELETE có thể thực thi nếu RLS permission policy pass; không cần RPC delete riêng.
- Static search không tìm thấy caller Cloud `.from('assets').delete()` hoặc `assets.delete` RPC. Đây là capability của database, chưa thấy luồng UI/Cloud hiện hành gọi trực tiếp.
- Asset Edit Lease FK tham chiếu Asset ON DELETE CASCADE; Asset images, checklist results/templates, inventory movements, maintenance logs/plans/tasks đều RESTRICT. Vì vậy hard-delete chỉ thành công khi các bảng lịch sử/tham chiếu RESTRICT không còn row liên quan; Lease sẽ bị cascade.

### Lock-order conflict cụ thể
- Update/archive/receipt RPC khóa Lease FOR UPDATE rồi mới UPDATE/lock Asset: Lease → Asset.
- Direct Asset DELETE khóa Asset row trước; FK cascade cần xóa Lease: Asset → Lease.
- Hai transaction trên cùng Asset có thể tạo chu trình chờ: T1 giữ Asset chờ Lease; T2 giữ Lease chờ Asset. Đây là deadlock candidate trực tiếp từ hai đường truy cập đang được cấp quyền, dù chưa thấy caller delete trong UI.
- Cần một trong các quyết định thiết kế trước khi bật Cloud delete: cấm direct DELETE và chuyển sang RPC delete theo thứ tự Lease → Asset; hoặc thay đổi lock protocol của update/delete thống nhất. Không chỉ dựa vào FK RESTRICT vì Lease vẫn cascade.

### Trạng thái
Chỉ đọc migration 006, ACL/RLS Test, FK catalog và static search caller. Không thực hiện DELETE, không sửa grants/policy/RPC.


## 75. Inventory mọi bảng authenticated có DELETE và legacy Local queue – 20/11/2026

### Effective DML Test
Catalog Test xác nhận authenticated có DELETE trên 5 bảng:
- `assets`: DELETE, không UPDATE/INSERT.
- `asset_images`: INSERT + DELETE, không UPDATE.
- `inventory_items`: INSERT + DELETE, không UPDATE.
- `maintenance_plans`: INSERT + UPDATE + DELETE.
- `maintenance_tasks`: INSERT + UPDATE + DELETE.
Các DELETE policies tương ứng yêu cầu `assets.delete`, `inventory.delete` hoặc `maintenance.delete`. Không có DELETE policy cho checklist template/version và lịch sử maintenance log/inventory movement.

### Caller / Local queue
- Static search không tìm thấy Cloud client caller trực tiếp `.from(table).delete()` cho các bảng business trên.
- UI hiện có `deleteMaintenancePlan()` gọi `deleteAndQueue()`; helper xóa Dexie và ghi syncQueue trong Local transaction.
- `cloudSync.ts` push queue bằng upsert vào bảng JSON `maintenance_records` với `deleted_at`, và pull tombstone xóa Local row. Static search chỉ tìm thấy định nghĩa `syncLocalDatabase()`, không có caller trong app. Không coi đây là Cloud business delete hoặc worker đang hoạt động.
- Vì vậy database có direct DML capability rộng hơn luồng Cloud-first hiện hành; việc không thấy caller không đồng nghĩa API bị khóa.

### Hệ quả
- Trước khi bật Cloud-first cho Inventory/Maintenance/Asset deletion, rà từng bảng: direct DML privilege, RLS policy, FK restrict/cascade, writer, Receipt/audit, và lock path.
- Các thao tác có quyền direct UPDATE/DELETE hiện chưa có Shared Receipt hoặc RPC serialization trong catalog. Không mở rộng sử dụng direct PostgREST write trong kiến trúc Cloud-first đã chốt.
- Riêng Asset direct DELETE có Lease cascade lock inversion §74. Maintenance Plan/Task direct writes cũng cần được đưa vào lock/receipt design trước khi bật Cloud worker.
- Không thay đổi grants, RLS, RPC, Local helper hoặc legacy sync module.

### Trạng thái
Read-only effective privilege/policy catalog, FK catalog và static GitHub search. Không chạy mutation hoặc sync.


## 76. Asset RPC lock path và permission TOCTOU – 20/11/2026

### Lock sequence đã xác minh từ function definition Test
- `apply_asset_mutation_with_lock`: Auth + `has_org_permission(assets.update)` (read-only helper) → fast lookup Asset Receipt → Lease `FOR UPDATE` → recheck Receipt → validate token/expiry → Asset `FOR UPDATE` → UPDATE Asset → INSERT Asset Receipt.
- `update_asset_with_lock` và `set_asset_archived_with_lock`: Auth + permission precheck → Lease `FOR UPDATE` → UPDATE Asset. Hai hàm không khóa Membership/Role/Role Permission trước khi kiểm tra quyền.
- `acquire_asset_edit_lock`: permission precheck → đọc Asset không khóa → INSERT/UPSERT Lease; heartbeat: permission precheck → UPDATE Lease. Đây là lock lease lifecycle, không phải authorization serialization.
- `create_asset_with_code`: permission precheck → đọc organization settings/Asset aggregate → UPSERT Asset counter → INSERT Asset. Domain order là Counter → Asset.
- `import_asset_preserving_identity`: permission precheck → advisory transaction lock theo organization + mutation → Receipt lookup → settings → Counter UPSERT (khi nhận diện code) → Asset FOR UPDATE/INSERT → import ledger INSERT.

### Hệ quả
- `has_org_permission` chỉ đọc Membership, Organization, member_roles, Role và Role Permission; không lấy row lock. Việc kiểm tra quyền ở đầu RPC không tuần tự hóa với transaction Admin đổi status/role hoặc xóa membership.
- Do đó có TOCTOU: một Asset write có thể qua permission check rồi tiếp tục khóa Lease/Asset trong lúc Admin thu hồi quyền. Đây là race candidate từ function definitions; chưa chạy concurrency test và chưa xác nhận runtime outcome theo isolation/statement timing.
- Lease → Asset là domain lock order hiện hành cho update/archive/mutation. Counter → Asset là thứ tự của create/import. Mọi delete/cleanup phải được đối chiếu với các thứ tự này và FK cascade.
- Asset Receipt hiện có fast replay trước khi xác minh Lease, nhưng vẫn chạy write permission check trước replay. Điều này khác Shared Receipt draft: replay cần xác thực Auth + organization + active membership, sau đó xử lý quyền đọc kết quả; không nhất thiết yêu cầu write permission cũ. Chưa tự động chuyển Asset sang Shared Receipt.

### Đề xuất để review tiếp
- Xác định một permission-serialization row protocol: business RPC khóa membership actor (và trạng thái organization nếu cần) trước domain locks; Admin role/status/remove phải khóa cùng membership row. Chỉ khi cả hai phía tuân thủ mới có điểm tuyến tính hóa rõ ràng cho thu hồi quyền.
- Sau membership lock, khóa domain rows theo thứ tự cố định (Lease → Asset; Counter → Asset; advisory/mutation key theo một vị trí thống nhất), sau đó finalize receipt. Không được áp dụng thứ tự trên như kết luận cuối khi chưa rà hết writer/FK.
- Xem riêng trường hợp organization suspension/deactivation; chỉ khóa membership không đủ nếu trạng thái organization thay đổi độc lập.

### Trạng thái
Chỉ đọc function definitions trên BAOTRI-Mini-Test và migration/source GitHub. Không chạy concurrency test, không thay đổi SQL, grants, RLS, RPC, Auth hoặc dữ liệu.

## 77. Organization state writers, hard-delete FK và Auth deletion lock path – 20/11/2026

### Organization state và quyền ghi
- Catalog Test: bảng `organizations` chỉ có trigger BEFORE UPDATE `organizations_set_updated_at`; không có trigger nghiệp vụ thay đổi trạng thái.
- Function inventory public không tìm thấy RPC/function chuyên cập nhật hoặc xóa Organization. Static search GitHub cũng chưa tìm thấy caller cập nhật/xóa `organizations`; App chỉ SELECT Organization đang active khi thiết lập context.
- Effective privilege Test: anon/authenticated không có INSERT/UPDATE/DELETE trên `organizations`; service_role có DELETE. Không thấy bằng chứng một luồng server hiện hành dùng quyền này. Do đó chưa có cơ chế Organization state mutation được xác nhận trong runtime, nhưng service_role vẫn là capability cần quản trị.
- Các RPC Asset/Member hiện đọc Organization status/permission mà không khóa Organization row. Nếu sau này có thao tác suspend/deactivate Organization, chỉ SELECT status không tuần tự hóa với business mutation đang chạy.

### Organization hard-delete và FK
- Organization có FK RESTRICT từ organization_members, roles, organization_settings, assets, asset_code_counters, asset_images, asset_import_mutations, checklist templates/versions/results, inventory items/movements, maintenance plans/tasks/logs.
- Hard-delete Organization sẽ bị FK RESTRICT chặn khi còn các dữ liệu phụ thuộc. Không có cascade cleanup tổng thể.
- Hướng thiết kế an toàn hơn cho vòng đời tenant là state transition (suspend/disabled) và retention/archive có chủ đích; không coi hard-delete là thao tác thông thường. State transition cần được đưa vào shared Organization lock/version protocol trước khi có writer.

### Auth user deletion và profile dependency
- FK `profiles.id -> auth.users.id` là ON DELETE CASCADE; tuy nhiên profile được tham chiếu bởi Organization.created_by, organization_members.user_id/invited_by_user_id và member_roles.assigned_by_user_id đều ON DELETE RESTRICT.
- Auth user còn được tham chiếu trực tiếp bởi asset_import_mutations.actor_user_id và asset_mutation_receipts.applied_by_user_id (RESTRICT). asset_edit_locks.holder_user_id tham chiếu Auth user ON DELETE CASCADE.
- Vì vậy Auth hard-delete không phải thao tác dọn tài khoản đơn giản: có thể bị chặn bởi membership, tổ chức do user tạo, role audit provenance và Asset receipt/import history. Remove membership hiện tại chỉ xóa membership/role mapping; không xóa Auth identity/profile.

### Lock-order candidate Auth deletion ↔ Asset mutation
- Auth deletion bắt đầu từ Auth user row và có thể cascade xóa asset_edit_locks (Lease).
- Asset mutation khóa Lease trước, sau đó Asset, rồi INSERT Asset Receipt có FK applied_by_user_id -> auth.users.
- Đây là candidate đảo chiều Auth → Lease so với Lease → Asset/Receipt → Auth; có thể hình thành chu trình chờ khi hai transaction cùng user/Asset. Chưa tái hiện bằng concurrency test; FK checks/row-lock mode và timing thực tế cần được kiểm chứng trên Test.
- Chỉ có một caller Auth hard-delete được tìm thấy trong Edge Function invite compensation: nếu RPC tạo membership trả lỗi sau khi vừa tạo Auth user, code gọi deleteUser. Caller không kiểm tra kết quả delete; không có bằng chứng deleteUser được gọi trong Remove/Suspend/Activate/Role change/Reset.

### Kết luận và việc còn mở
- Không bật Organization hard-delete hoặc Auth hard-delete như luồng nghiệp vụ thông thường.
- Invite compensation phải dựa trên operation state và xác minh membership/profile/receipt trước khi xóa; không xóa Auth user chỉ vì RPC trả lỗi.
- Cần thiết kế Organization suspension serialization, Auth deletion policy/retention và test deadlock candidate Auth ↔ Lease ↔ Asset/Receipt trước khi có bất kỳ writer mới.
- Chỉ đọc catalog, ACL, FK, triggers và GitHub source. Không chạy DELETE/UPDATE, không thay SQL, grants, RPC, Auth hoặc dữ liệu.

## 78. Concurrency test matrix – Organization, Auth, Membership và Asset – 20/11/2026

### Mục tiêu và nguyên tắc
- Thiết kế test hai transaction độc lập, điều phối bằng barrier tại client/test harness để giữ khóa ở thời điểm xác định. Không dùng dữ liệu Production; mỗi case cần tenant/user/Asset tổng hợp có thể disposable.
- Chạy baseline để quan sát hiện trạng trước; sau khi có protocol sửa mới chạy lại cùng kịch bản. Không coi một lần PASS là chứng minh không deadlock toàn hệ thống.
- Ghi transaction timeline, lock wait, SQLSTATE, deadlock log, trạng thái cuối của rows/Receipt/Lease và tính toàn vẹn FK. Phân biệt deadlock `40P01`, lock timeout `55P03`, business denial và lỗi FK.
- Không tạo test function/migration chỉ để điều phối. Chưa chạy test trong checkpoint này; mọi test có ghi dữ liệu cần được cho phép riêng.

### C1 – Organization suspend ↔ Asset mutation
- Actors: T1 gọi Asset mutation (ví dụ `apply_asset_mutation_with_lock`); T2 chuyển Organization active → suspended.
- Baseline hiện tại: Asset helper chỉ đọc Organization status; chưa có Organization row lock chung với thao tác suspend. Test cần xác định Asset mutation đã qua permission precheck có tiếp tục sau khi T2 suspend hay không.
- Protocol đích: cả hai transaction khóa cùng Organization row trước Membership/domain locks. Nếu T1 lấy khóa và xác minh active trước, T1 được commit rồi T2 suspend; nếu T2 commit trước, T1 phải từ chối do Organization không active.
- Assertions: không có Asset mutation mới commit sau điểm suspend đã commit; không có Receipt thành công nếu Asset mutation bị từ chối; Organization cuối cùng suspended.

### C2 – Auth deletion ↔ Asset Lease/Receipt
- Actors: T1 thực hiện Asset mutation với actor U, khóa Lease → Asset rồi ghi Asset Receipt có FK actor U; T2 Auth Admin xóa U, có thể cascade Lease holder.
- Chỉ dùng user/tenant/Asset tổng hợp; không xóa user thật hoặc user đang dùng. Phải kiểm tra trước các FK RESTRICT khác để test không dừng sớm vì constraint.
- Baseline candidate: T1 giữ Lease và chờ/insert Receipt tham chiếu Auth; T2 giữ Auth user row và cascade Lease. Quan sát wait graph/deadlock log, không giả định FK lock mode nếu chưa đo.
- Target policy: không hard-delete Auth user đồng thời với business mutation. Deactivate/revoke, chặn request mới, drain/release Lease và xử lý retention/Receipt trước; account erasure là workflow riêng sau khi không còn in-flight operations và dependency hợp lệ.
- Assertions: không mất Receipt/Lease ngoài dự kiến; không orphan actor reference; không deadlock không xử lý; kết quả erasure tuân FK/retention policy.

### C3 – Membership revoke ↔ Asset mutation
- Actors: T1 Asset mutation của user U; T2 Admin đổi status U sang suspended, đổi role/revoke permission hoặc remove membership.
- Baseline hiện tại: Asset permission helper chỉ đọc; Member legacy writers chưa cùng protocol actor-membership lock. Test các nhánh status, role và remove riêng.
- Protocol đích: Asset RPC khóa actor Membership và xác minh active + permission trong cùng transaction; Admin revoke khóa đúng Membership row trước thay đổi. Nếu T1 khóa trước, mutation được hoàn tất rồi revoke; nếu T2 khóa/commit trước, T1 phải fail authorization. Không cho phép T1 qua precheck cũ rồi commit sau khi revoke đã thắng.
- Assertions: không có mutation commit sau revoke thắng; không có Receipt thành công cho mutation bị từ chối; member_roles/status đúng và không có assignment thiếu/nhiều.

### C4 – Asset hard-delete ↔ Lease update
- Actors: T1 gọi update/archive/mutation khóa Lease → Asset; T2 thực hiện direct DELETE Asset, hiện có thể khóa Asset rồi cascade Lease.
- Baseline: dùng Asset tổng hợp không có FK RESTRICT history, có Lease hợp lệ; đồng bộ barrier để T1 giữ Lease và T2 đi vào DELETE. Ghi nhận deadlock victim/SQLSTATE và trạng thái rollback.
- Protocol đích: không cho direct PostgREST DELETE; mọi delete RPC phải khóa Lease → Asset, kiểm tra token/permission/history/FK và xóa trong cùng transaction. Nếu update thắng thì delete chạy sau và kiểm tra lại; nếu delete thắng thì update sau phải trả not-found/lease-invalid, không deadlock.
- Assertions: Asset hoặc còn nguyên sau rollback, hoặc bị xóa hoàn toàn theo policy; Lease không mồ côi; không xóa lịch sử; không có partial Receipt.

### Cách chạy và tiêu chí đánh giá
1. Tạo fixture độc lập cho từng case; snapshot trước test.
2. Dùng hai DB sessions/transactions riêng, barrier xác nhận từng session đã đạt điểm khóa dự kiến rồi mới thả session còn lại.
3. Chạy từng thứ tự thắng (T1 trước/T2 trước), sau đó lặp nhiều vòng với lịch xen kẽ; không dựa vào `pg_sleep` đơn thuần để khẳng định thứ tự.
4. Thu `pg_stat_activity`, `pg_locks`, deadlock log và kết quả transaction; áp dụng lock timeout có kiểm soát để test không treo.
5. PASS chỉ khi outcome đúng winner semantics, không orphan/partial write, không vi phạm FK/Receipt, và không có deadlock trong protocol đích ở ma trận đã chạy. Ghi rõ số vòng và giới hạn phạm vi; không tuyên bố global deadlock-free.

### Trạng thái
Đây là test design, không phải test result. Chưa chạy SQL transaction có ghi dữ liệu, chưa tạo fixture, chưa tạo function/migration và chưa thay đổi Supabase.

## 79. Coverage audit – các writer ngoài bốn concurrency pair – 20/11/2026

### Đường ghi đã nhận diện từ migration trên main
- Asset create: create_asset_with_code khóa/UPSERT asset_code_counters rồi INSERT Asset; thứ tự Counter → Asset.
- Asset import: import_asset_preserving_identity dùng advisory mutation lock, tra import ledger, đọc settings, có thể UPSERT Counter, rồi Asset FOR UPDATE/INSERT và INSERT import ledger. Cần kiểm tra Import ↔ Create cùng mã/category và Import replay ↔ Asset update.
- Lease lifecycle: acquire INSERT/UPSERT Lease; heartbeat UPDATE Lease; release DELETE Lease; edit/archive/mutation khóa Lease rồi Asset.
- Receipt mutation: khóa Lease, kiểm tra Receipt, khóa Asset, UPDATE Asset, INSERT Asset Receipt. Replay/retry cần kiểm tra cùng mutation ID/payload.
- Membership: Auth profile-sync trigger tự UPDATE invited → active; admin create INSERT Membership + member_roles; role update DELETE/INSERT member_roles; status update UPDATE Membership; remove DELETE Membership và cascade role assignment.
- Organization settings: RLS cho phép INSERT/UPDATE theo permission; Asset create/import đọc settings. Settings update ↔ Asset create/import là cặp consistency cần rà.
- Inventory: RLS cho phép INSERT/UPDATE/DELETE inventory_items; INSERT inventory_movements. Item update/delete ↔ movement cần test FK/quantity contract.
- Maintenance: RLS cho phép INSERT/UPDATE/DELETE maintenance_tasks và maintenance_plans; INSERT maintenance_logs. Plan/task delete ↔ task/log insert hoặc update là cặp cần rà.
- Checklist: template INSERT/UPDATE, version INSERT, result INSERT theo permission. Template update/version creation ↔ result submission cần kiểm tra version pinning và snapshot semantics.
- Asset images: INSERT/DELETE; Asset/metadata lifecycle và image deletion cần giữ FK/history đúng.
- Direct DELETE Asset vẫn có capability qua privilege + RLS; không có caller Cloud delete tìm thấy trước đó không đồng nghĩa database đã chặn.

### Kết luận về coverage
Bốn cặp §78 là lõi lock-order/authz, nhưng chưa đủ để chứng minh coverage toàn bộ writers. Bổ sung nhóm test ưu tiên: (1) Counter ↔ Create/Import; (2) Settings update ↔ Create/Import; (3) Lease acquire/heartbeat/release ↔ mutation/delete; (4) Inventory item ↔ movement; (5) Maintenance plan/task ↔ log; (6) Checklist template/version ↔ result; (7) Auth confirmation trigger ↔ invitation acceptance/revoke.
RLS predicates và helper permission chỉ đọc không tự tạo shared serialization lock. Cần tách test DB concurrency khỏi kiểm tra logic UI/offline queue. Mọi cặp phải dựa trên FK và function body cụ thể, không suy diễn chỉ từ tên bảng.

### Trạng thái
Static inventory từ migration/main, chưa phải runtime call graph đầy đủ. Chưa chạy test, chưa ghi DB và chưa sửa Supabase.

## 80. Lock-order map mở rộng – Counter/Settings/Inventory/Maintenance/Checklist – 20/11/2026

### Asset create và import
- `create_asset_with_code`: permission helper đọc trước; đọc `organization_settings.asset_code_config`; đọc MAX code từ Asset; UPSERT `asset_code_counters` (điểm serialize theo organization/category); INSERT Asset. Thứ tự ghi chính: Settings read → Counter → Asset. MAX Asset được đọc trước Counter nên cần giữ logic `greatest(counter, existing_max)+1`.
- `import_asset_preserving_identity`: advisory transaction lock theo organization + mutation_id (chỉ serialize retry cùng mutation ID); đọc import ledger; đọc Settings; UPSERT Counter nếu code nhận diện; Asset FOR UPDATE hoặc INSERT; INSERT import ledger. Thứ tự chính: advisory claim → Settings read → Counter → Asset → import ledger. Advisory lock khác mutation_id không serialize các import khác nhau; Counter mới là điểm đồng bộ với create cho cùng category.
- Cả hai luồng hiện đọc Settings không khóa row. Nếu cần cấu hình nhất quán tại thời điểm tạo/import, protocol đề xuất Settings `FOR SHARE` trước Counter; thao tác settings update lấy row UPDATE lock. Winner semantics: create/import giữ shared lock thì dùng cấu hình đó và hoàn tất trước settings update; settings update thắng thì luồng sau đọc cấu hình mới. Chưa thay đổi code.

### Inventory
- `inventory_items.quantity` là số dư; schema comment nêu mọi movement và cập nhật số dư phải atomic qua RPC được review.
- Migration 006 chỉ tạo SELECT policy cho `inventory_movements`, ghi rõ INSERT bị withheld cho tới khi có atomic stock RPC. Vì vậy hiện chưa có writer Cloud được phép ghi movement qua authenticated RLS; không lập concurrency test movement như thể RPC đã tồn tại.
- Khi thiết kế stock RPC tương lai: khóa Inventory Item `FOR UPDATE` → validate số dư/loại movement → update quantity → insert movement trong cùng transaction. Mọi điều chỉnh số dư khác phải cùng protocol. Item delete phải bị FK RESTRICT nếu có movement.

### Maintenance
- `maintenance_tasks` và `maintenance_plans` đều FK Asset ON DELETE RESTRICT.
- `maintenance_logs` là append-only theo RLS, FK tới Asset, Task và Checklist Result đều RESTRICT. Cặp có ý nghĩa là Task delete/update ↔ Log insert; Plan không có FK trực tiếp từ Log nên không được gộp Plan ↔ Log nếu không có quan hệ nghiệp vụ khác.
- Target protocol cho ghi log: khóa Task (nếu log gắn task) → khóa/kiểm tra Asset → khóa Checklist Result (nếu gắn) theo thứ tự ID ổn định → INSERT log. Task delete khóa Task trước; nếu log writer thắng, delete phải bị FK RESTRICT; nếu delete thắng, log phải fail vì task không còn. Chỉ áp dụng nếu caller/RPC thực tế xác nhận cần serialize; FK đã cung cấp integrity nhưng chưa thay thế nghiệp vụ validation.

### Checklist
- Template có unique một template/Asset; Version FK RESTRICT tới Template; Result FK RESTRICT tới Asset + Template + đúng Version. RLS cho phép template INSERT/UPDATE, version INSERT, result INSERT; result là immutable history.
- Khi publish version mới và cập nhật `checklist_templates.current_version`, cần một transaction khóa Template `FOR UPDATE`, xác định version kế tiếp, INSERT version row và UPDATE current_version nguyên tử.
- Khi submit result, đọc/chọn version cụ thể và INSERT result tham chiếu đúng version; không được âm thầm đổi version giữa lúc người dùng thực hiện checklist. Nếu cần bảo đảm chỉ submit current version, khóa Template `FOR SHARE` rồi xác minh current_version, sau đó INSERT result. Nếu nghiệp vụ cho phép hoàn tất phiên bản cũ đã bắt đầu, phải truyền version ID cố định và chỉ kiểm tra version đó tồn tại.

### Giới hạn và ưu tiên
- Inventory movement concurrency chưa khả thi cho authenticated cho đến khi có stock RPC; đây là design gate, không phải test thiếu.
- Ưu tiên bổ sung test: Settings update ↔ Asset create/import; Counter create ↔ import cùng category; Task delete ↔ Log insert; Checklist publish ↔ Result submit; Asset delete ↔ các child inserts (ảnh/task/plan/template/result/log/movement).
- Chưa có bằng chứng runtime caller đầy đủ cho các module; static RLS/schema không chứng minh UI đang gọi Cloud. Chưa chạy test và chưa thay đổi Supabase.
