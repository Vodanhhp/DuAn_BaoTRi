# BAOTRI Mini — Review bản nháp Shared Receipt 020

Ngày: 19/11/2026  
Phạm vi: rà soát tĩnh `supabase/drafts/020_organization_mutations_receipt_DRAFT.sql`; không chạy PostgreSQL/Supabase, không áp dụng SQL.

## 1. Kết luận

Bản nháp có cấu trúc phù hợp để tiếp tục review: Receipt theo logical mutation, khóa duy nhất theo organization + mutation ID, fingerprint do server dựng, không cấp quyền truy cập trực tiếp cho client, Receipt chỉ được chuyển từ pending sang trạng thái cuối, và deferred constraint trigger ngăn pending commit.

Chưa đủ điều kiện promote thành migration hoặc viết business RPC hoàn chỉnh. Các điểm dưới đây phải được giải quyết trong thiết kế RPC và kiểm thử thực tế.

## 2. Điểm đạt

- PK `(organization_id, mutation_id)` ngăn hai Receipt cùng key trong một organization.
- `actor_user_id` lấy từ `auth.uid()` theo hợp đồng RPC; không tin actor do client truyền.
- JSONB fingerprint tránh phụ thuộc thứ tự key của object; không giả định pgcrypto.
- Receipt hỗ trợ nhiều affected records, phù hợp Task + Log trong một transaction.
- RLS bật và revoke quyền trực tiếp khỏi public/anon/authenticated; không có policy client đọc/ghi.
- Trigger bảo vệ identity/fingerprint và chỉ cho phép pending → final; DELETE bị từ chối.
- Deferred constraint trigger truy vấn trạng thái cuối ở cuối transaction, vì vậy insert pending rồi finalize trong cùng transaction là hợp lệ; quên finalize thì transaction bị abort.
- Thuật toán dùng `INSERT ... ON CONFLICT DO NOTHING` rồi SELECT ở statement tiếp theo, tránh tiếp tục trong transaction đã bị abort bởi unique violation.

## 3. Các điểm phải xử lý trước business RPC

### 3.1 Khóa trạng thái organization và membership trong transaction — mức cao

Chỉ SELECT kiểm tra `organizations.status` và `organization_members.status` có thể tạo race với thao tác disable membership/organization đang diễn ra đồng thời.

RPC cần xác định cách khóa các row trạng thái trong transaction, ví dụ khóa phù hợp bằng `SELECT ... FOR SHARE`, để thao tác disable không thể chen vào giữa bước xác thực và commit. Phải kiểm tra lại tên bảng/cột và hành vi lock với schema thực tế trước khi viết SQL. Cần chốt rõ thời điểm hiệu lực của thao tác thu hồi membership/organization.

### 3.2 Race giữa kiểm tra quyền ghi và Receipt vừa được commit — mức trung bình

Trình tự hiện mô tả: lookup Receipt → nếu không có thì kiểm tra write permission → INSERT claim. Một request khác có thể commit Receipt sau lần lookup đầu nhưng trước khi request hiện tại kiểm tra permission. Nếu quyền ghi vừa bị thu hồi, request hiện tại có thể bị từ chối dù Receipt đã tồn tại.

Để khớp chính sách replay đã duyệt, RPC cần xử lý nhánh permission-denied bằng cách tra Receipt lại một cách an toàn trước khi trả lỗi; nếu Receipt đã xuất hiện thì áp dụng đầy đủ actor/fingerprint/membership/read-permission checks. Không được biến nhánh này thành đường vượt quyền cho mutation mới.

### 3.3 Quyền đọc với mutation nhiều record — mức trung bình

`read_permission_codes` hiện được hiểu là tập quyền phải có đầy đủ trước khi trả toàn bộ `result_payload`. Cách này an toàn nhưng có thể ẩn cả snapshot Task khi actor chỉ mất quyền đọc Log.

Trước khi viết RPC, chọn rõ một trong hai:
- Giữ chính sách all-or-nothing: thiếu bất kỳ quyền đọc nào thì chỉ trả acknowledgement tối thiểu; hoặc
- Lưu permission theo từng affected record và chỉ trả snapshot của record mà actor hiện còn quyền đọc.

Không được trả một payload hỗn hợp nếu chưa lọc quyền theo từng record.

### 3.4 Kiểm tra fingerprint và payload — mức cao

Mỗi RPC phải tự dựng fingerprint từ allowlist đã chuẩn hóa, bao gồm tối thiểu organization, operation, actor scope, toàn bộ resource IDs, expected row/revision version và payload nghiệp vụ đã chuẩn hóa. Không nhận fingerprint, read permission list, affected refs hoặc result payload từ client.

Phải định nghĩa canonicalization cho NULL, số thập phân, ngày/giờ, enum, text trim và thứ tự các phần tử array. JSONB equality chỉ giải quyết thứ tự key object, không tự định nghĩa chuẩn hóa nghiệp vụ.

### 3.5 Quyền thực thi SECURITY DEFINER — mức cao

Mỗi business RPC cần:
- `SECURITY DEFINER`, `SET search_path = ''`;
- schema-qualify mọi object;
- xác minh Auth, organization, membership, actor, permission và resource ownership;
- chỉ cấp EXECUTE cho role cần thiết;
- không tạo generic RPC cho phép truyền tên bảng/cột tùy ý;
- kiểm tra owner/BYPASSRLS và hành vi RLS thực tế của function owner.

Các trigger function trong draft đã revoke EXECUTE khỏi client; RPC nghiệp vụ tương lai cần có grant riêng, không suy ra từ quyền trên bảng Receipt.

### 3.6 Bất biến Receipt và retention

Trigger bảo vệ UPDATE/DELETE; quyền client cũng bị revoke. Không có cơ chế retention trong draft, phù hợp giai đoạn đầu. Không bổ sung cleanup/archive cho đến khi có chính sách chứng minh không còn client retry hoặc backup cũ có thể replay. Cần tính cả quyền đặc biệt của owner/service role và thao tác TRUNCATE trong quy trình vận hành.

## 4. Kịch bản kiểm thử bổ sung

- Disable membership đồng thời với mutation: xác nhận lock và thứ tự hiệu lực rõ ràng.
- Deactivate organization đồng thời với replay/mutation.
- Receipt commit giữa lần lookup đầu và lúc write permission bị từ chối: cùng actor phải replay read-only nếu membership còn active.
- Hai request cùng key, cùng fingerprint; hai request cùng key, fingerprint khác; request đầu rollback.
- Actor khác và organization khác không thể dò sự tồn tại của Receipt.
- Thu hồi một trong nhiều read permissions: kết quả tuân theo chính sách all-or-nothing hoặc per-record đã chọn.
- Client cố gửi giả actor, fingerprint, read permission codes, affected refs và result payload: RPC bỏ qua/từ chối.
- Cố UPDATE Receipt sau final, DELETE, TRUNCATE bằng từng database role; client không có đường truy cập trực tiếp.
- Bỏ quên finalize: deferred trigger abort toàn bộ business write.
- Kiểm tra function owner, RLS, EXECUTE grants và search_path trên Supabase Test.

## 5. Trạng thái an toàn

- Draft 020 vẫn là bản nháp, chưa chạy SQL.
- Không sửa Asset-specific Receipt/Lease, không dual-write.
- Không sửa code, migration đang áp dụng, quyền hoặc dữ liệu Supabase.
- Các mục trong tài liệu này là yêu cầu review cho thiết kế RPC tiếp theo, không phải xác nhận rằng schema hiện tại đã được kiểm chứng trên database đang chạy.


## 6. Thứ tự Replay/Claim và authorization locks thống nhất (19/11/2026)

Trạng thái: **bổ sung hợp đồng thiết kế; chưa sửa SQL draft 020 và chưa chạy kiểm thử database**.

### 6.1 Replay lookup — read-only

1. Lấy actor từ auth.uid(); từ chối NULL.
2. Khóa Organization phù hợp và xác nhận active.
3. Khóa actor Membership trong organization và xác nhận active.
4. Đọc Receipt theo (organization_id, mutation_id). Lookup không claim, không sửa Receipt và không khóa business row.
5. Nếu Receipt final tồn tại, so sánh actor, operation và fingerprint do server dựng. Mismatch phải từ chối mà không tiết lộ result.
6. Nếu khớp, không yêu cầu write permission cũ. Kiểm tra current read permissions theo chính sách all-or-nothing đã chốt: đủ tất cả quyền đọc thì trả snapshot; thiếu bất kỳ quyền nào chỉ trả acknowledgement tối thiểu.
7. Membership inactive hoặc Organization inactive thì deny trước khi tiết lộ Receipt.

### 6.2 Mutation mới — authorization rồi claim

Nếu replay lookup không thấy Receipt:

1. Khóa target Membership (nếu có), member role assignments, Role và Role Permission theo Lock Matrix; tất cả Membership liên quan phải được khóa trước assignment/Role. Khóa nhiều row theo UUID/ID/code tăng dần.
2. Kiểm tra active target, role active/đúng organization và write permission trong cùng transaction. Các RPC revoke/suspend/deactivate phải dùng thứ tự khóa tương thích.
3. Server chuẩn hóa payload và dựng fingerprint; client không được gửi actor, fingerprint, affected refs hoặc read-permission list làm căn cứ.
4. Claim unique key (organization_id, mutation_id) sau authorization và trước business row locks/side effects. Pending Receipt, business write và finalize ở cùng transaction.
5. Nếu unique claim bị request khác thắng, dùng statement kế tiếp dưới READ COMMITTED để đọc Receipt final và so actor/operation/fingerprint. Không dùng exception unique violation rồi tiếp tục transaction đã abort.
6. Nếu write permission bị deny nhưng Receipt có thể vừa commit sau lookup đầu, thực hiện Receipt recheck read-only trong statement riêng trước khi trả deny. Chỉ replay Receipt final khớp hoàn toàn; không claim hoặc chạy mutation trong nhánh deny.
7. Business rows, row_version, counter/change events (nếu loại dữ liệu đó thuộc feed đang bật), audit và Receipt phải commit/rollback nguyên tử. Conflict/no_change được lưu Receipt theo contract nhưng không phát event nếu không có record thực sự thay đổi.

### 6.3 Lock order và phạm vi

Với Member RPC, thứ tự chuẩn là Organization → tất cả actor/target Membership theo UUID → member role assignments → Role → Role Permission → Auth user row (chỉ nếu Invite Saga cần) → Receipt claim → business rows → sync counter/events (nếu có) → Receipt finalize.

Receipt replay lookup là nhánh read-only sau Organization + actor Membership; không được hiểu là đảo thứ tự claim của mutation mới. Asset Lease/Asset-specific Receipt vẫn là ngoại lệ chuyển tiếp, không thay đổi bởi mục này.

Mọi writer/revoker Organization, Membership, Role và Role Permission phải dùng thứ tự tương thích. Phải test FK/cascade/trigger implicit locks; lock order trên giấy không tự chứng minh không deadlock.

### 6.4 Ranh giới

Mục này chỉ chuẩn hóa review. Chưa sửa supabase/drafts/020_organization_mutations_receipt_DRAFT.sql, chưa tạo migration, chưa sửa business RPC, chưa chạy SQL/RPC và chưa thay đổi Supabase Test/Production.


## 7. Member Receipt operation/read policy và audit boundary

Contract áp dụng cho Member RPC theo CLOUD_MEMBER_MANAGEMENT_RPC_DESIGN.md §27:

- Operation codes: `member.create`, `member.role.change`, `member.status.change`, `member.remove`, `member.self.activate`.
- Fingerprint server-built bind organization, actor, operation, target identity và toàn bộ input/state server-derived làm thay đổi kết quả. Không nhận actor, fingerprint, read permission list, affected refs hoặc result payload authoritative từ client.
- Write permission quản trị: `users.manage`; self-activation là self-scoped, yêu cầu auth.uid() đúng chủ membership và email confirmation server-verified.
- Full replay snapshot cho create/role/status chỉ khi hiện còn `users.view`; nếu thiếu chỉ acknowledgement tối thiểu. Remove chỉ acknowledgement tối thiểu; self-activation chỉ acknowledgement self-scoped. Không có roster Change Feed.
- Receipt vẫn chỉ được claim/finalize cùng transaction với mutation. Audit append-only là record riêng, insert cùng transaction cho state transition; không thay thế Receipt.
- Invite Saga operation ID là identity riêng của quy trình Auth external; `member.create` Receipt chỉ bao phủ bước finalize membership và bind Saga operation ID đã được xác minh. Không gộp Auth API side effect vào giả định PostgreSQL atomicity.

Receipt DDL hiện tại chưa tự áp đặt operation-specific disclosure policy. Các Member RPC phải tự enforce policy trong SECURITY DEFINER transaction trước khi trả result. Không sửa draft 020 hoặc tạo migration trong bước review này.


### 7.1 Fingerprint phải ổn định trước và sau commit

Áp dụng Member design §27.7: fingerprint nhận diện request intent ổn định, không dựng từ live mutable state sau mutation. Nếu fingerprint chứa role/status hiện tại trước mutation rồi retry đọc state sau commit, cùng mutation_id có thể tạo fingerprint khác và không replay được Receipt.

- Fingerprint bind requested target role/status và identity/intent; optional expected-current-state là precondition trong request, được kiểm tra chỉ ở nhánh mutation mới sau khi lấy locks.
- Replay Receipt final so actor/operation/fingerprint từ intent request đã canonicalize; không đọc live state để dựng lại fingerprint và không áp dụng precondition lần hai.
- State transition hợp lệ và expected-current-state được kiểm tra dưới lock chỉ khi Receipt chưa tồn tại.
- Với Invite Saga, trạng thái khởi tạo phải lấy từ operation record bất biến; không suy lại từ trạng thái Auth hiện thời khi retry.
- Test cùng mutation_id sau commit cho role change, status change, remove và self-activation; đồng thời test cùng ID khác requested target phải bị reject.

Điều này không thay đổi fingerprint server-built, actor từ auth.uid(), hoặc nguyên tắc không tin client-supplied fingerprint.


## 8. Member audit/Saga DDL boundary (19/11/2026)

DDL draft 021 tạo riêng organization_member_invite_operations và organization_member_audit_events. Không dùng hai bảng này thay Shared Receipt:
- Saga operation giữ Auth Admin workflow nhiều pha, PII và unresolved state.
- Shared Receipt chỉ ghi nhận transaction membership finalize đã commit, dùng operation code/fingerprint đã chốt tại Member design §27.
- Audit append-only ghi state transition trong cùng transaction với mutation + Receipt; audit không lưu email/phone/Auth metadata/token và không phát Change Feed.
- membership_receipt_mutation_id trong Saga là liên kết scalar; không biến Saga operation thành Receipt.
- Asset-specific Receipt/Lease tiếp tục là ngoại lệ riêng, không dual-write hoặc thay schema trong Member cutover.

DDL 021 chưa có RPC để insert audit + Receipt atomic; yêu cầu này vẫn bắt buộc cho business RPC. Chưa chạy SQL hoặc thay đổi database.


## 9. Audit constraints và transaction boundary (19/11/2026)

DDL 021 đã yêu cầu mutation_id cho audit membership lifecycle và invite_operation_id cho create/adopt/Saga-state events. Đây mới là schema-level completeness check, không thay thế Shared Receipt:
- Business membership RPC phải claim/replay Shared Receipt theo contract §7/Member §27.
- Membership mutation + audit row + receipt finalize phải cùng một DB transaction.
- Saga state transitions nằm ở transaction riêng, không tạo giả Shared Receipt cho mỗi lần gọi Auth Admin API.
- RPC phải xác thực actor và permission bên trong transaction; không tin actor_user_id do Edge Function truyền vào.
- Audit CHECK chỉ kiểm tra shape/allowlist; authorization, state transition và idempotency vẫn thuộc RPC.

Chưa chạy SQL hoặc thay đổi database.


## 10. Cross-review Member Receipt contract và lock-order prerequisite (20/11/2026)

### Contract đã đối chiếu
- Shared Receipt draft 020 vẫn là DRAFT ONLY. Catalog BAOTRI-Mini-Test hiện chỉ có `asset_mutation_receipts`; chưa có `organization_mutations`, `organization_member_invite_operations` hoặc `organization_member_audit_events`. Không có cơ sở nói Shared Receipt/Member Saga đã được triển khai.
- Receipt là kết quả cuối của một PostgreSQL logical mutation, PK `(organization_id, mutation_id)`; Saga `operation_id` là identity riêng cho Auth provisioning nhiều pha. `member.create` Receipt chỉ bao phủ transaction finalize membership và liên kết `invite_operation_id`; không biến Auth API call thành transaction DB.
- Member operation codes ổn định: `member.create`, `member.role.change`, `member.status.change`, `member.remove`, `member.self.activate`. Mutation ID phải giữ nguyên khi timeout/unknown outcome; không tạo ID mới để retry.
- Fingerprint canonical JSONB do server dựng. Áp dụng Member §27.7: fingerprint nhận diện request intent ổn định; không đưa mutable current role/status sau commit vào fingerprint. Optional expected-current-state là precondition chỉ kiểm tra ở nhánh mutation mới sau khi lấy lock.
- Replay và mutation mới là hai nhánh khác nhau. Replay yêu cầu Auth hợp lệ, Organization active, actor membership active, cùng actor/operation/fingerprint; không yêu cầu lại write permission cũ. Full snapshot chỉ khi còn read permission hiện tại; remove chỉ acknowledgement tối thiểu. Mutation mới mới kiểm tra write permission, claim unique key và thực hiện side effect.
- Receipt, business mutation, row_version/counter/events nếu áp dụng và audit state transition phải atomic trong một transaction. Audit là append-only và độc lập Receipt; Saga state transition nằm ở transaction riêng. Membership hiện không bật Change Feed theo contract hiện tại.
- Claim dùng unique key và `INSERT ... ON CONFLICT DO NOTHING`; request thua concurrency đọc Receipt ở statement tiếp theo theo READ COMMITTED. Không bắt unique violation rồi tiếp tục transaction đã abort. Khi permission deny nhưng Receipt có thể vừa commit sau lookup đầu, phải recheck Receipt read-only trước khi trả deny.

### Lock-order prerequisite đang tồn tại
- Member §25.1 và mục 6.3 của review này cùng nêu thứ tự: Organization → actor/target Membership theo UUID → member_roles → Role → Role Permission → Auth user (nếu cần) → Receipt → business rows → sync counter/events → Receipt finalize. Replay lookup là nhánh read-only sau Organization + actor Membership.
- Tuy nhiên Auth trigger hiện trên Test vẫn đi Auth user → Profile → Membership, vì `sync_auth_user_profile()` còn tự UPDATE membership invited thành active. Đây là lock-order inversion trực tiếp với Member §25.1 nếu hai luồng chạy đồng thời: một bên giữ Auth chờ Membership, bên kia giữ Membership chờ Auth.
- Do đó §25.1 chỉ có thể áp dụng an toàn sau khi tách membership activation khỏi Auth trigger (trigger chỉ sync Profile) hoặc có một thiết kế concurrency khác được chứng minh bằng lock analysis/test. Đây là prerequisite, không phải việc đã hoàn thành. Không tự sửa trigger.
- Cần đồng bộ mọi tài liệu lock-order cũ: các candidate Auth-first ở §67/§81 chỉ mô tả đường khóa trigger hiện tại; Member §25.1 là proposed canonical order sau khi trigger không còn ghi Membership. Không được trộn hai thứ tự trong cùng cutover.

### Trạng thái
Chỉ đối chiếu tài liệu và catalog read-only. Không sửa draft 020/021, không tạo migration/RPC, không thay đổi Supabase.
