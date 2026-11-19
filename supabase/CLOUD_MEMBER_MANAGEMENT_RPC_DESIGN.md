# BAOTRI Mini — Thiết kế hợp đồng RPC quản lý thành viên

Ngày: 19/11/2026  
Trạng thái: Design only — chưa phải SQL, chưa triển khai, chưa chạy trên Supabase.

## 1. Mục tiêu và phạm vi

Chuẩn hóa luồng quản trị thành viên tenant để loại bỏ khoảng TOCTOU giữa kiểm tra `users.manage` ở Edge Function và thay đổi dữ liệu bằng service_role RPC.

Phạm vi:
- Tạo membership cho Auth user đã tồn tại.
- Đổi role Technician/Viewer.
- Suspend/Activate membership.
- Remove membership khỏi một organization.
- Điều phối invite qua Supabase Auth Admin API bằng saga/operation ID.
- Đồng bộ trạng thái xác nhận email và membership invited.

Không thuộc phạm vi:
- Xóa Auth user khi remove membership.
- Xóa Profile khi remove membership.
- Cho phép tạo hoặc sửa Admin membership qua các RPC thông thường.
- Đồng bộ email/Auth metadata vào Change Feed.
- Thay đổi permission catalog hiện hành hoặc quyền Technician/Viewer trong nghiệp vụ.

## 2. Nguyên tắc bắt buộc

1. Actor lấy từ `auth.uid()` bên trong RPC; không nhận `p_actor_user_id` làm căn cứ authorization.
2. RPC mutation được gọi bằng JWT của actor, không phải service_role JWT. Edge Function vẫn có thể dùng service_role cho thao tác Auth Admin API, nhưng không dùng service_role làm danh tính người thực hiện thay đổi membership.
3. Mỗi RPC tự xác thực Auth, Organization active, Actor Membership active và permission cần thiết trong cùng transaction.
4. Authorization locks và mutation nằm trong cùng transaction. Không kiểm tra quyền ở Edge Function rồi tin kết quả đó.
5. Mọi RPC tuân lock order tại Lock Matrix mục 21 của `CLOUD_FOUNDATION_DRAFTS_REVIEW.md`.
6. Không tin organization ID, target member ID, role code, status hoặc operation ID do client gửi nếu không kiểm tra phạm vi và tính hợp lệ ở server.
7. Không tự cấp quyền Admin. Role đích chỉ là `technician` hoặc `viewer` theo policy hiện hành.
8. Remove chỉ xóa membership/role assignments; giữ nguyên `auth.users` và `profiles`.
9. Thao tác lặp phải idempotent; timeout không được tự sinh operation ID mới.
10. RLS không thay thế authorization trong SECURITY DEFINER RPC.

## 3. Authorization transaction protocol

Mỗi RPC quản trị membership dùng thứ tự sau:

1. `auth.uid()` khác NULL; xác thực caller là authenticated user.
2. Khóa Organization row `FOR SHARE`; xác nhận status active.
3. Khóa Actor Membership row `FOR SHARE`; xác nhận thuộc organization và status active.
4. Khóa Actor `member_roles` assignment rows theo `role_id`; xác nhận ít nhất một role hợp lệ.
5. Khóa các Role rows và Role Permission rows liên quan theo thứ tự cố định; xác nhận role active và có `users.manage` (hoặc capability quản trị chuyên biệt nếu được phê duyệt sau).
6. Với thao tác lên người khác, khóa Target Membership sau Actor Membership; nếu actor=target thì chỉ khóa một lần. Không cho phép self role change, self suspend hoặc self remove.
7. Khóa target role assignments/role rows khi cần xác định target có phải Admin hay không.
8. Claim/replay operation receipt (nếu thao tác có operation ID).
9. Thực hiện thay đổi trong cùng transaction.
10. Nếu membership roster tham gia Change Feed, ghi event cùng transaction và chỉ sau khi hợp đồng roster event được chốt.
11. Finalize receipt/operation state; commit.

Các row permission không tồn tại không thể được khóa. Một RPC kiểm tra thấy không có permission phải deny; grant đồng thời không làm request deny trở thành allow. Revoke/role change phải khóa cùng row set tương thích để serialize với RPC nghiệp vụ.

## 4. Hợp đồng RPC đồng bộ (không gọi Auth Admin API)

### 4.1 `admin_create_org_membership`

Input đề xuất:
- `p_organization_id uuid`
- `p_user_id uuid` — Auth user đã tồn tại
- `p_role_code text` — chỉ technician/viewer
- `p_operation_id uuid` — bắt buộc khi đã chuyển sang operation receipt

Actor: `auth.uid()`.

Transaction:
- Authorization theo mục 3 với `users.manage`.
- Khóa Organization, actor Membership/role permission trước khi xử lý target.
- Kiểm tra Auth user tồn tại và Profile tồn tại.
- Khóa Auth user row chỉ khi cần serialize với xác nhận email; không dùng lock Auth user làm thay thế Organization/Membership locks.
- Kiểm tra membership hiện hữu theo unique key (organization_id,user_id). Duplicate cùng operation/payload replay kết quả; membership tồn tại do operation khác trả conflict rõ ràng.
- Tạo membership trạng thái `active` nếu email đã xác nhận, ngược lại `invited` theo quy tắc hiện hành.
- Gán đúng một role Technician/Viewer trong cùng transaction.
- Không nhận `p_invited_by_user_id`; dùng actor từ `auth.uid()`.
- Receipt + membership + member_roles phải atomic.

### 4.2 `admin_update_org_member_role`

Input:
- `p_organization_id uuid`
- `p_member_id uuid`
- `p_role_code text`
- `p_operation_id uuid`

Transaction:
- Authorization `users.manage`.
- Khóa target Membership và assignment/role rows theo lock order.
- Từ chối self-change, target Admin, role không hỗ trợ, membership không active (nếu policy yêu cầu).
- Thay assignment trong một transaction; không tạo khoảng thời gian target không có role đã commit.
- Nếu role hiện tại đã đúng, trả no_change; không phát event/version vô ích.
- Ghi audit actor bằng `auth.uid()`, không lấy từ input.

### 4.3 `admin_update_org_member_status`

Input:
- `p_organization_id uuid`
- `p_member_id uuid`
- `p_status text` — active/suspended
- `p_operation_id uuid`

Transaction:
- Authorization `users.manage`.
- Khóa target Membership.
- Từ chối self-change, target Admin, trạng thái invited chưa accept nếu giữ policy hiện hành.
- Chỉ cập nhật status; không xóa Auth user/Profile/role assignment.
- Same status là no_change.
- Nếu Change Feed quản lý roster, event chỉ chứa membership ID/status/timestamp và actor ID theo allowlist, không chứa email/Auth metadata.

### 4.4 `admin_remove_org_membership`

Input:
- `p_organization_id uuid`
- `p_member_id uuid`
- `p_operation_id uuid`

Transaction:
- Authorization `users.manage`.
- Khóa target Membership và role assignment rows.
- Từ chối self-remove và target Admin.
- Xóa membership; FK cascade xóa member_roles.
- Giữ Auth user, Profile và dữ liệu cá nhân.
- Tombstone event nếu roster sync được bật; không đưa email vào tombstone.
- Retry cùng operation ID replay kết quả; không cố xóa lại Auth user.

## 5. Invite saga — Auth Admin và PostgreSQL không thể atomic cùng nhau

Invite cần tách thành operation bền vững; không thể giữ PostgreSQL transaction mở trong khi gọi Auth Admin API.

### 5.1 Operation record

Thiết kế bảng operation riêng (hoặc mở rộng Receipt có kiểm soát) với tối thiểu:
- operation_id (PK)
- organization_id
- actor_user_id (từ auth.uid())
- normalized_email hoặc email lookup reference được bảo vệ
- role_code
- status: requested / auth_user_created / membership_created / completed / failed_retryable / compensation_required / cancelled
- auth_user_id nullable
- request fingerprint do server xây dựng
- created_at, updated_at, last_error_code (không lưu access token/secret)

Email là dữ liệu cá nhân; quyền SELECT phải hạn chế. Không đưa operation payload nhạy cảm vào Change Feed.

### 5.2 Luồng

1. Client tạo operation_id ổn định và gọi `begin_member_invite` bằng JWT actor.
2. RPC kiểm tra actor/permission trong transaction, claim operation idempotently, lưu intent; cùng operation ID + fingerprint replay được. Operation chưa tạo membership.
3. Edge Function thực hiện Auth Admin invite/create user. Edge Function phải xác minh operation thuộc actor/tenant và đang ở trạng thái phù hợp; không nhận actor identity tự khai làm thẩm quyền.
4. Nếu Auth API timeout/response không rõ: không tạo Auth user khác ngay. Tìm/đối chiếu theo operation và email bằng Auth Admin API; không dựa vào email client để xóa user.
5. Sau khi có auth_user_id, Edge Function gọi finalize RPC bằng JWT của actor (hoặc một signed, one-time server assertion được thiết kế riêng nếu luồng xác thực không giữ được JWT; không dùng p_actor_user_id trần).
6. Finalize RPC kiểm tra lại Auth + Organization + Membership + users.manage và khóa theo protocol. Tạo membership + role assignment atomic, liên kết operation, đánh dấu completed.
7. Nếu permission bị revoke giữa begin và finalize: finalize bị deny; operation chuyển trạng thái cần xử lý. Không tự động xóa Auth user nếu chưa chứng minh user do operation tạo và chưa có membership/nguồn sử dụng khác.
8. Retry cùng operation ID tiếp tục saga; không tạo invite operation mới cho cùng một yêu cầu đang unresolved.

### 5.3 Bù trừ an toàn

- Chỉ xóa Auth user khi operation chứng minh Auth user mới được tạo bởi chính operation này, membership chưa commit, user không được liên kết với organization/workflow khác, và chưa có xác nhận email/hoạt động khiến việc xóa gây hậu quả không mong muốn.
- Trước compensation, query lại operation và membership state bằng operation ID.
- Timeout của finalize không phải bằng chứng thất bại; query trạng thái operation trước khi retry/compensate.
- Không xóa Auth user nếu operation state không rõ hoặc user đã tồn tại trước invite.

## 6. Email confirmation trigger

Trigger `sync_auth_user_profile()` hiện cập nhật invited membership khi email được xác nhận nhưng không khóa Organization theo lock protocol.

Thiết kế cần:
- Xác định organization IDs liên quan đến user; xử lý nhiều organization theo UUID tăng dần.
- Với từng organization: khóa Organization trước, sau đó khóa Membership; cập nhật invited → active idempotently.
- Không tự tạo role assignment mới.
- Nếu trigger auth.users update đang chạy trong transaction Auth, cần kiểm tra deadlock và lock interaction với Edge Function/Auth Admin. Không được tự giả định trigger có thể lấy mọi lock an toàn.
- Không phát roster event cho đến khi event contract và quyền roster view được chốt.
- Trigger chỉ xử lý xác nhận email; không tự thay đổi role, không cấp quyền mới.

Nếu trigger không thể tuân lock order mà không tạo deadlock với luồng Auth, chuyển việc kích hoạt membership sang worker/Edge Function có retry idempotent; không giữ trigger hiện tại như một ngoại lệ không kiểm soát.

## 7. Role catalog và legacy role

- `organization_members.role` legacy và `member_roles` không được dùng lẫn lộn làm hai nguồn thẩm quyền.
- Trước khi bật RPC mới, cần audit mọi membership để xác định nguồn role authoritative, duplicate assignment, thiếu assignment và trường hợp legacy Admin.
- Không tự sửa dữ liệu role khi migration chưa có preflight/report và rollback plan.
- Không cho phép target Admin bị role/status/remove operations thông thường tác động.
- Nếu sau này hỗ trợ nhiều role trên một member, phải định nghĩa rõ quyền hợp nhất; thiết kế hiện giả định một role assignment hiện hành cho Technician/Viewer.

## 8. Permission và Change Feed cho roster

Hiện không mặc định đưa membership vào business Change Feed.
Trước khi bật roster sync cần quyết định:
- capability đọc roster (ví dụ users.view) độc lập với users.manage;
- trường được phép lộ (membership ID, status, role code, timestamps; email chỉ nếu policy rõ);
- event types create/role_change/suspend/activate/remove;
- cursor, retention, device revoke và resync theo Change Feed contract;
- actor visibility và audit retention.

Không dùng users.manage như quyền đọc roster mặc định.

## 9. EXECUTE, RLS và SECURITY DEFINER

- RPC mutation mới: SECURITY DEFINER, `SET search_path = ''`, schema-qualify mọi bảng/hàm.
- Dùng `auth.uid()` trong function để lấy actor; từ chối NULL.
- Revoke EXECUTE khỏi PUBLIC/anon; grant authenticated đúng function signature.
- Không grant service_role-only function cho authenticated nếu function có thể được gọi trực tiếp bởi client.
- Nếu cần Edge Function làm Auth Admin, chỉ Auth API dùng service_role; database membership mutation vẫn đi qua JWT actor RPC.
- Function owner, BYPASSRLS, row_security setting, RLS recursion và grants phải được test trên đúng Supabase role context. SECURITY DEFINER không tự động bảo đảm an toàn nếu owner hoặc search_path cấu hình sai.
- Không trả email, profile private fields, raw auth error hoặc dữ liệu tenant khác trong exception/result.

## 10. Test bắt buộc

1. Anonymous/unauthenticated không gọi được.
2. Authenticated không membership, membership suspended, organization inactive đều bị deny.
3. Active Admin có users.manage được tạo/đổi role/suspend/activate/remove Technician/Viewer.
4. Technician/Viewer bị deny mọi member-management mutation.
5. Không thể self-change role, self-suspend, self-remove.
6. Không thể sửa/xóa target Admin; không thể gán Admin role.
7. Cross-organization IDs không dò được target.
8. Concurrent suspend/revoke permission và member RPC tuân lock protocol; request đến sau revoke bị deny.
9. Hai request đồng thời cùng operation ID: một operation; request sau replay/read result.
10. Cùng operation ID nhưng fingerprint khác bị từ chối.
11. Duplicate membership do operation khác trả conflict rõ ràng, không tạo role assignment trùng.
12. Role assignment atomic; lỗi giữa DELETE/INSERT không để member mất role đã commit.
13. Remove giữ nguyên auth.users và profiles.
14. Invite timeout sau Auth create và sau membership finalize được recover bằng cùng operation ID.
15. Permission bị revoke giữa begin/finalize không tạo membership ngoài policy; compensation không xóa user tồn tại trước đó.
16. Email confirmation lặp lại idempotent; test concurrent với suspend/remove/invite, nhiều organizations và lock order.
17. RLS/SECURITY DEFINER/grants/function owner được xác minh dưới anon, authenticated, service_role và function owner.
18. Legacy role/member_roles inconsistency được phát hiện trước cutover.

## 11. Cutover và rollback

1. Audit role data và duplicate membership; chỉ báo cáo, chưa tự sửa.
2. Thiết kế operation table/receipt schema và RPC signatures.
3. Viết migration draft riêng; review DDL, lock, RLS, grants, function owner.
4. Test trên PostgreSQL clone/Supabase Test với concurrency và failure injection.
5. Cập nhật Edge Function để chỉ orchestration Auth Admin; DB authorization ở JWT RPC.
6. Cutover từng action; theo dõi operation unresolved.
7. Chỉ xóa/revoke RPC cũ sau khi client/Edge Function cũ không còn gọi và có rollback/forward-fix plan.

Rollback không được xóa Auth users hoặc memberships đã tạo hợp lệ. Nếu đã có operation saga đang chạy, phải reconcile từng operation trước khi đổi protocol.

## 12. Quyết định còn cần chủ sản phẩm xác nhận trước SQL draft

1. Có giữ policy hiện hành rằng chỉ Admin quản lý thành viên, và không cho Admin tự đổi role/trạng thái/xóa chính mình? Thiết kế này đang giả định CÓ.
2. Khi suspend/remove một thành viên, có cần thu hồi phiên đăng nhập ngay lập tức ở mọi thiết bị hay chỉ chặn truy cập dữ liệu/RPC theo membership status? Thiết kế hiện giả định membership status là nguồn chặn authorization; Auth session toàn cục không bị xóa.
3. Roster có cần đồng bộ tới PC/Mobile trong Change Feed không? Thiết kế hiện giả định CHƯA, cho đến khi users.view và dữ liệu được phép lộ được chốt.

Không có SQL executable trong tài liệu này. Không sửa migrations 013/014, Edge Function hoặc client; không chạy SQL, không gọi RPC, không thay đổi Supabase.
