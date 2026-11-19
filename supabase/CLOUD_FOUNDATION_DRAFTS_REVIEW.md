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
