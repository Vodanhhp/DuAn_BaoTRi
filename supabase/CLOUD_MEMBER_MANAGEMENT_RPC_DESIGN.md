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

## 12. Quyết định sản phẩm (đã xác nhận)

Ba mặc định đã được người dùng đồng ý; xem mục 13. Không còn chờ xác nhận sản phẩm cho ba nội dung này. Các câu hỏi kỹ thuật còn mở được liệt kê tại mục 14.5.

Không có SQL executable trong tài liệu này. Không sửa migrations 013/014, Edge Function hoặc client; không chạy SQL, không gọi RPC, không thay đổi Supabase.


## 13. Quyết định sản phẩm đã xác nhận

Người dùng đồng ý giữ cả ba mặc định:
1. Chỉ Admin quản lý thành viên; không tự đổi role, tự suspend hoặc tự remove.
2. Suspend/remove chặn quyền truy cập tenant qua Membership; không xóa Auth session toàn cục. Mỗi request/RPC vẫn phải kiểm tra membership active. Nếu sau này cần thu hồi phiên tức thời, đó là tính năng riêng với session strategy rõ ràng.
3. Chưa đưa roster vào Change Feed. Danh sách thành viên chỉ được đọc qua luồng có authorization riêng; không mặc định dùng users.manage làm quyền đọc.

## 14. Đối chiếu Edge Function hiện tại và điều chỉnh Invite Saga

Đã rà soát tĩnh `supabase/functions/manage-organization-members/index.ts` (13.5 KB), migrations 001/005/013/014 và draft Shared Receipt 020.

### 14.1 Các điểm hiện tại cần thay đổi khi cutover

- Edge Function hiện kiểm tra `has_org_permission(..., 'users.manage')` trước mọi action, rồi dùng service_role để đọc/ghi. Kiểm tra này nằm ngoài transaction mutation, nên không khóa được permission/membership trước thay đổi.
- Các RPC 013/014 yêu cầu `auth.role() = service_role` và nhận `p_actor_user_id`; đó là actor assertion do Edge Function truyền vào, không phải actor được DB xác thực.
- `invite` tạo hoặc tìm Auth user trước, sau đó mới gọi membership RPC. Nếu RPC lỗi, code gọi `deleteUser` cho user vừa invite mà không kiểm tra kết quả; timeout/response không rõ có thể dẫn đến xóa nhầm user đã được tạo membership hoặc đã được dùng.
- `update_role`, `update_status`, `remove_member` hiện thực hiện một số đọc target/role ở Edge Function rồi mới gọi RPC; những lần đọc trước RPC không phải căn cứ bảo mật. RPC phải tự khóa và kiểm tra target Admin/self/role trong cùng transaction.
- `list` hiện dùng users.manage như quyền đọc roster. Khi chuyển sang policy đã chốt, cần tách quyền đọc roster (users.view) khỏi quyền quản trị (users.manage), hoặc tạm thời không hiển thị roster cho vai trò không có users.view.
- `reset_password` là thao tác Auth riêng, không phải business mutation Receipt và không phát Change Feed. Tuy nhiên, xác thực actor và quyền users.manage phải được thực hiện server-side; target phải được xác minh là thành viên trong organization và không phải Admin. Không đưa email/token/recovery URL vào Receipt hoặc Change Feed.
- Migration 013 trigger `sync_auth_user_profile()` chuyển invited → active khi email được xác nhận; trigger hiện update membership mà chưa tham gia Organization → Membership lock protocol.

### 14.2 Invite Saga — điều chỉnh quan trọng

Không thể dùng một transaction PostgreSQL bao trùm Auth Admin API. Tách thành ba pha bền vững:

A. **Begin intent** — RPC bằng JWT actor:
- Derive actor bằng auth.uid(); kiểm tra Organization active, actor Membership active và users.manage dưới lock protocol.
- Claim operation_id + canonical fingerprint; lưu trạng thái requested và actor/organization/email chuẩn hóa/role.
- Retry cùng operation_id + fingerprint trả lại trạng thái hiện tại; fingerprint khác bị từ chối.

B. **Auth provisioning** — Edge Function:
- Chỉ dùng service_role cho Auth Admin API; không dùng service_role để giả danh actor trong database RPC.
- Trước khi gọi Auth, xác minh operation đã được begin và đang ở trạng thái phù hợp.
- Sau timeout, tìm/đối chiếu Auth user và operation hiện hữu trước khi thử lại; không gọi invite lần nữa một cách mù quáng.
- Ghi nhận auth_user_id và việc Auth user do operation tạo ra. Không suy ra quyền sở hữu user chỉ từ email trùng.

C. **Finalize membership** — RPC bằng JWT actor:
- Kiểm tra lại Auth, Organization, actor Membership và users.manage; không dựa vào lần kiểm tra ở pha A.
- Claim/replay Receipt theo operation ID, khóa target/role, tạo membership + member_roles atomic, ghi trạng thái completed.
- Nếu actor bị suspend/revoke quyền giữa A và C, finalize phải deny. Operation vẫn unresolved; không tự xóa Auth user. Một Admin đang active khác chỉ được tiếp quản qua một RPC adoption riêng, có authorization hiện thời và audit rõ; không được âm thầm đổi actor của Receipt.
- Timeout sau finalize: query operation/Receipt bằng cùng operation_id trước khi retry hoặc compensation.

### 14.3 Compensation policy

- Chỉ cân nhắc delete Auth user nếu operation chứng minh user được tạo mới bởi chính operation, chưa có membership commit, chưa được xác nhận email/được sử dụng ở nơi khác, và trạng thái được kiểm tra lại ngay trước compensation.
- Nếu Auth create hoặc finalize có kết quả không rõ, trạng thái là unresolved, không phải failed.
- Nếu user đã tồn tại trước invite, tuyệt đối không xóa Auth user khi membership creation thất bại.
- Compensation failure phải để trạng thái cần xử lý/retry; không bỏ qua lỗi deleteUser như code hiện tại.
- Không dùng một Receipt business thông thường để lưu secret hoặc token Auth; operation saga chỉ giữ dữ liệu tối thiểu cần phục hồi.

### 14.4 Các action và Receipt/Change Feed

| Action | DB authorization | Shared Receipt | Change Feed |
|---|---|---|---|
| Invite/create membership | RPC actor JWT | Operation ID + Receipt/final state | Chưa bật roster feed |
| Change role | RPC actor JWT | Có | Chưa bật |
| Suspend/Activate | RPC actor JWT | Có | Chưa bật |
| Remove membership | RPC actor JWT | Có | Chưa bật |
| List roster | users.view riêng | Không | Không |
| Reset password email | Server-side actor + target checks | Không lưu Auth action vào business Receipt | Không |
| Email confirmation | Trigger/worker theo lock protocol, idempotent | Không dùng Receipt của actor invite; liên kết operation nếu cần | Chưa bật |

### 14.5 Câu hỏi kỹ thuật còn phải giải quyết trước SQL

1. Operation saga table tách khỏi organization_mutations hay mở rộng Receipt? Khuyến nghị tách: Auth provisioning có trạng thái nhiều pha, trong khi Shared Receipt chỉ đại diện kết quả transaction DB đã commit.
2. Quyền đọc/tiếp quản operation unresolved: chỉ actor ban đầu hay Admin khác có thể adopt bằng RPC riêng? Khuyến nghị hỗ trợ Admin khác adopt có audit, không đổi actor của Receipt gốc.
3. Trigger email confirmation có thể tuân lock order mà không deadlock với Auth Admin transaction hay không? Cần test concurrency; nếu không, chuyển activation sang worker idempotent.
4. Có cần users.view cho Admin/Technician/Viewer theo catalog hiện hành hay chỉ Admin? Catalog hiện seed users.view cho Viewer do action='view'; cần xác nhận chính sách hiển thị roster riêng trước khi bật.

Không sửa Edge Function/migrations, không chạy SQL/RPC, không thay đổi Supabase.


## 15. Thiết kế bảng Invite Saga và phục hồi

### 15.1 Tách Operation Saga khỏi Shared Receipt

Chốt hướng thiết kế: dùng bảng riêng `organization_member_invite_operations`; không mở rộng `organization_mutations` để lưu trạng thái nhiều pha.

Lý do:
- Shared Receipt chỉ ghi nhận kết quả cuối của một transaction PostgreSQL đã commit.
- Invite Saga phải tồn tại qua nhiều transaction và một Auth Admin API call nằm ngoài PostgreSQL.
- Saga có trạng thái trung gian, lỗi có thể phục hồi, và lịch sử tiếp quản; ép vào Receipt sẽ làm mờ ý nghĩa "một mutation đã commit".
- Khi membership transaction hoàn tất, finalize RPC tạo Shared Receipt riêng cho mutation membership. Saga liên kết đến Receipt/membership ID đó.

### 15.2 Cấu trúc dữ liệu đề xuất

Bảng riêng, private, RLS bật và revoke SELECT/INSERT/UPDATE/DELETE trực tiếp từ PUBLIC/anon/authenticated. Mọi thao tác qua RPC được kiểm soát.

Các trường đề xuất:

| Trường | Kiểu dự kiến | Mục đích |
|---|---|---|
| organization_id | uuid | Tenant sở hữu invite |
| operation_id | uuid | Idempotency key do client tạo, duy nhất trong organization |
| actor_user_id | uuid | Actor ban đầu, lấy từ auth.uid(), bất biến |
| normalized_email | text | Email chuẩn hóa; PII, chỉ RPC/service nội bộ được đọc |
| role_code | text | Chỉ technician/viewer |
| request_fingerprint | jsonb | Canonical server-built envelope, không nhận hash client |
| status | text | Trạng thái saga ở mục 15.3 |
| auth_user_id | uuid nullable | Auth user được liên kết sau khi xác minh |
| auth_user_created_by_operation | boolean nullable | Chỉ true khi có bằng chứng đáng tin cậy từ Auth provisioning |
| membership_id | uuid nullable | Membership sau finalize |
| membership_receipt_mutation_id | uuid nullable | Liên kết Shared Receipt đã commit |
| auth_attempt_started_at | timestamptz nullable | Mốc bắt đầu gọi Auth API |
| auth_result_observed_at | timestamptz nullable | Mốc đã ghi nhận phản hồi Auth |
| last_error_code | text nullable | Mã lỗi đã chuẩn hóa; không lưu raw response |
| retry_after | timestamptz nullable | Backoff do server điều khiển |
| adopted_by_user_id | uuid nullable | Admin tiếp quản, nếu chính sách cho phép |
| adoption_reason | text nullable | Lý do bắt buộc khi tiếp quản |
| version | bigint | Optimistic concurrency cho chuyển trạng thái saga |
| created_at / updated_at | timestamptz | Audit timestamps |
| completed_at | timestamptz nullable | Thời điểm hoàn tất |

Khóa chính đề xuất `(organization_id, operation_id)`; FK organization `ON DELETE RESTRICT`, actor/auth user `ON DELETE RESTRICT`. Không cascade xóa operation/audit. Có index theo (organization_id,status,retry_after) cho worker/recovery và theo auth_user_id khi có giá trị.

Email là dữ liệu cá nhân. Không đưa email, Auth metadata, invite URL, recovery URL, token, password hoặc raw Auth error vào Shared Receipt, Change Feed hay log ứng dụng. Không giả định pgcrypto đã cài. Nếu cần mã hóa email at-rest, phải có thiết kế key management riêng; không tự tạo cơ chế mã hóa yếu trong SQL.

### 15.3 State machine

Trạng thái đề xuất:

- `requested`: intent đã được Begin RPC commit; chưa có Auth call được xác nhận bắt đầu.
- `auth_calling`: worker/Edge Function đã claim attempt và bắt đầu Auth API.
- `auth_outcome_unknown`: timeout/crash/response không rõ; bắt buộc reconcile, không gọi invite mới mù quáng.
- `auth_user_resolved`: Auth user ID đã được xác định và ghi nhận; chưa tạo membership.
- `finalize_pending`: sẵn sàng gọi Finalize RPC.
- `completed`: membership + role assignment + Shared Receipt đã commit.
- `needs_review`: không thể chứng minh quyền sở hữu Auth user hoặc có xung đột; cần Admin xử lý rõ ràng.
- `failed_terminal`: lỗi xác định không thể retry theo cùng request; giữ audit, không tự xóa Auth user.
- `cancelled`: chỉ được hủy trước khi Auth provisioning bắt đầu; sau khi Auth call đã bắt đầu phải reconcile.

Không dùng trạng thái chung chung `failed` cho timeout. Timeout luôn là `auth_outcome_unknown` hoặc trạng thái tương đương unresolved.

Mọi transition phải là compare-and-set theo operation_id + expected status/version; transition bất hợp lệ bị từ chối. State change và audit record phải cùng transaction. Không cho client cập nhật status trực tiếp.

### 15.4 Phân chia RPC và quyền gọi

1. `begin_member_invite`: authenticated actor JWT; derive auth.uid(); lock Organization → Actor Membership → Role/Permission; yêu cầu users.manage; claim operation ID và fingerprint. Cùng key/fingerprint trả trạng thái operation hiện tại; cùng key khác fingerprint bị từ chối.
2. `claim_member_invite_auth_attempt`: chỉ server worker/Edge Function service identity; claim requested/retryable operation với lease/attempt token do DB sinh. Không cho actor client gọi.
3. `record_member_invite_auth_result`: chỉ server identity; ghi auth_user_id và provenance sau Auth API. RPC phải kiểm tra operation state/attempt token; idempotent với cùng kết quả, từ chối kết quả xung đột. Không nhận actor_user_id làm authorization.
4. `mark_member_invite_outcome_unknown`: chỉ server identity; chuyển attempt đang chạy sang unresolved khi timeout/crash được phát hiện. Không được tự kết luận Auth user không tồn tại.
5. `finalize_member_invite`: authenticated actor JWT; recheck actor hiện tại, Organization, Membership, users.manage và role. Tạo membership + member_roles + Shared Receipt trong một transaction; liên kết Saga completed.
6. `adopt_member_invite_operation`: chỉ bổ sung nếu sản phẩm chấp thuận Admin khác tiếp quản. Actor mới phải active và có users.manage tại thời điểm adoption; khóa Organization/actor membership/operation; bắt buộc reason; ghi append-only adoption audit. Không sửa actor_user_id hoặc fingerprint gốc. Adoption không tự động hoàn tất membership và không xóa Auth user.

Service identity chỉ được thực hiện các bước orchestration Auth cần thiết. Các RPC server-only phải có EXECUTE grants hẹp, không cấp cho authenticated/anon; kiểm tra function owner, SECURITY DEFINER, search_path rỗng và schema qualification. Không dùng service_role để thay actor Admin trong Finalize RPC.

### 15.5 Auth provisioning và crash window

Có crash window không thể loại bỏ bằng transaction PostgreSQL: Auth API có thể tạo user thành công nhưng Edge Function chết trước khi lưu auth_user_id vào Saga.

Vì vậy:
- Claim attempt trước Auth API; lưu attempt ID và trạng thái auth_calling.
- Nếu response thành công, ghi auth_user_id ngay bằng server-only RPC.
- Nếu timeout/crash, chuyển auth_outcome_unknown; recovery dùng Auth Admin API để tìm user theo email đã chuẩn hóa và kiểm tra metadata/provenance có thể xác minh.
- Không coi việc tìm thấy email trùng là bằng chứng user được tạo bởi operation này.
- Nếu không có bằng chứng chắc chắn, chuyển needs_review; không tự động gắn user và không xóa user.
- Không dựa vào user_metadata do người dùng có thể sửa làm bằng chứng ownership. Nếu muốn gắn operation marker, phải đánh giá khả năng ghi app_metadata sau create và crash window giữa create/marker. Marker chưa được ghi không chứng minh user không do operation tạo.
- Nếu Auth user tồn tại trước invite, có thể liên kết theo chính sách invite hiện hành chỉ sau xác minh phù hợp; tuyệt đối không đánh dấu auth_user_created_by_operation=true.
- Một lần Auth API trả lỗi rõ ràng vẫn cần phân loại theo mã lỗi; chỉ retry lỗi transient sau khi đã xác minh không có user được tạo.

### 15.6 Lease, retry và worker

- Lease/attempt token được DB tạo; worker phải claim operation bằng atomic UPDATE/RETURNING hoặc RPC tương đương.
- Hết lease chỉ cho phép worker khác reconcile trạng thái, không tự động gọi invite API lần nữa.
- Mỗi lần retry có attempt record riêng; operation_id không đổi.
- Retry backoff do server quyết định; giới hạn số lần gọi Auth API và có trạng thái needs_review khi vượt ngưỡng.
- Không giữ transaction hoặc row lock trong lúc gọi mạng/Auth API.
- Không dùng đồng hồ client để quyết định lease hết hạn; dùng clock_timestamp() phía DB.
- Nếu không có worker chạy nền ở giai đoạn đầu, Admin có thể mở màn hình trạng thái và kích hoạt recovery có kiểm soát; không biến thao tác refresh thành lệnh gửi invite mới.

### 15.7 Adoption và quyền phục hồi

Đề xuất cho phép Admin khác tiếp quản operation unresolved bằng RPC adoption riêng, nhưng đây là quyết định sản phẩm cần xác nhận trước SQL:
- Admin mới phải có Auth hợp lệ, Organization active, membership active và users.manage tại thời điểm adoption.
- Không thay đổi actor gốc; ghi adopted_by, reason, timestamp trong audit append-only.
- Admin tiếp quản có thể reconcile, xác minh Auth user, hoặc finalize theo policy; không được bỏ qua fingerprint, role allowlist hoặc target checks.
- Không cho adoption khi operation completed/cancelled hoặc Auth ownership đang tranh chấp.
- Nếu actor gốc bị suspend/revoke, operation không tự được finalize dưới danh tính actor cũ. Admin khác chỉ tiếp tục sau adoption được audit.
- Việc adoption không cấp quyền xóa Auth user. Compensation vẫn theo policy chứng minh ownership và recheck state.

### 15.8 Compensation

Mặc định an toàn: không tự động delete Auth user trong Saga recovery. Chỉ thiết kế compensation tự động sau khi có bằng chứng Auth user được operation tạo, chưa có membership commit, chưa xác nhận email/được dùng ở nơi khác, và trạng thái được recheck ngay trước xóa. Nếu bất kỳ điều kiện nào không chứng minh được, giữ Auth user và chuyển needs_review.

### 15.9 Kiểm thử bắt buộc

- Crash trước Auth call; crash trong Auth call; Auth tạo user nhưng response mất; crash sau khi lưu auth_user_id; crash sau finalize commit nhưng response mất.
- Hai worker cùng claim một operation; lease hết hạn trong khi Auth call còn chạy.
- Cùng operation ID/fingerprint replay; cùng ID khác email/role/org bị từ chối.
- Email đã có Auth user; Auth invite trả duplicate; user xác nhận email trước finalize.
- Actor bị suspend, mất users.manage hoặc Organization bị suspend giữa Begin và Finalize.
- Admin khác adoption đồng thời với actor gốc finalize; chỉ một transition thắng theo version/lock.
- Auth user ownership không rõ: không gắn tự động, không xóa.
- Membership commit thành công nhưng Saga response bị mất: replay kiểm tra Shared Receipt, không tạo membership lần hai.
- RPC server-only không gọi được từ anon/authenticated; Edge Function không thể giả mạo actor của Finalize.
- PII không xuất hiện trong Receipt, Change Feed, client error, logs hoặc telemetry.
- Retention: operation/audit không bị cascade delete; quy trình archive/cleanup phải có phê duyệt và không xóa operation unresolved.

### 15.10 Quyết định còn mở

1. Có cho Admin khác adoption Invite unresolved không? Đây là đề xuất kỹ thuật, chưa mặc định là quyết định đã được người dùng phê duyệt.
2. Giai đoạn đầu có worker nền hay chỉ recovery thủ công từ giao diện Admin?
3. Chính sách liên kết Auth user đã tồn tại/chưa xác nhận email có tiếp tục như hiện tại không, hay mọi invite phải đi qua email invitation mới?
4. Có chấp nhận giữ Auth user mồ côi ở trạng thái needs_review thay vì tự động xóa trong các tình huống không chứng minh được ownership không? Khuyến nghị CÓ.

Chưa tạo SQL draft, chưa sửa Edge Function/migration, không chạy SQL/RPC, không thay đổi Supabase.


## 16. Quyết định sản phẩm đã xác nhận về Invite Saga

Người dùng đồng ý cả ba đề xuất:
1. **Adoption:** Admin khác được phép tiếp quản Invite unresolved qua RPC riêng, có authorization hiện tại, reason bắt buộc và audit append-only. Không đổi actor gốc, fingerprint hoặc Receipt gốc.
2. **Vận hành giai đoạn đầu:** chưa triển khai worker nền. Recovery được kích hoạt có kiểm soát từ giao diện Admin/Edge Function; mọi thao tác vẫn dùng operation_id cũ và state transition CAS. Không tự động gửi lại invite khi trạng thái Auth chưa rõ.
3. **Auth user không xác minh được ownership:** giữ Auth user, chuyển `needs_review`; không tự động xóa hoặc gắn vào membership. Đây là mặc định an toàn.

Các quyết định này không đồng nghĩa cho phép adoption khi operation đã completed/cancelled hoặc ownership đang tranh chấp. Adoption chỉ cho phép Admin khác tiếp tục reconcile/finalize theo policy; không cấp quyền compensation.

## 17. Phân tích trigger xác nhận email và phương án tránh deadlock

Đã đọc trực tiếp migration 013. Trigger `sync_auth_user_profile()` chạy AFTER UPDATE trên `auth.users`; ngoài đồng bộ Profile, nó UPDATE `organization_members` từ invited sang active. Đây là một writer membership chạy bên trong transaction Auth.

### 17.1 Deadlock cycle có thể xảy ra

- Transaction xác nhận email giữ row lock trên `auth.users`, sau đó trigger chờ row lock/lock liên quan `organization_members`.
- Transaction Finalize Invite theo lock matrix mới có thể khóa Organization/Actor Membership trước, rồi đọc/khóa Auth user hoặc insert/update target Membership.
- Nếu Finalize chờ Auth user trong khi Auth trigger chờ membership, có thể tạo chu trình chờ. Thứ tự hiện tại trong migration 013 (khóa auth.users rồi tạo membership) cũng không tương thích với lock order Organization → Membership → ... nếu được giữ nguyên khi chuyển sang RPC actor JWT.

Không được giải quyết bằng cách thêm lock tùy tiện hoặc giữ transaction mở khi gọi Auth API.

### 17.2 Đề xuất cắt vòng khóa

Đề xuất **không để trigger Auth cập nhật organization_members trực tiếp**.

- Giữ trigger đồng bộ Profile nếu cần, nhưng bỏ phần UPDATE membership.
- Finalize Invite đọc trạng thái email confirmation theo cách không tạo lock ngược; nếu email đã xác nhận tại thời điểm kiểm tra thì tạo membership active, nếu chưa thì invited.
- Nếu email confirmation xảy ra đồng thời và Finalize vẫn tạo invited, trạng thái được sửa bởi một RPC riêng do chính user đã đăng nhập gọi: `activate_my_confirmed_membership(organization_id)`.
- RPC chỉ cho `auth.uid()` kích hoạt membership của chính mình; xác nhận `auth.users.email_confirmed_at IS NOT NULL`; khóa Organization rồi Membership theo lock matrix; chỉ chuyển invited → active, idempotent. Không cho client kích hoạt user khác.
- Ứng dụng gọi RPC này sau khi có Auth session hợp lệ và trước khi tải dữ liệu tenant. Nếu người dùng chưa xác nhận email, RPC từ chối. Nếu user chưa từng đăng nhập sau xác nhận, membership có thể giữ invited — đây là trạng thái đúng, chưa cấp quyền truy cập.
- Trigger Auth không còn ghi vào organization_members nên không tranh chấp lock với Admin membership RPC. Profile sync phải được kiểm tra riêng về lock interaction; không thêm thao tác tenant vào trigger.

### 17.3 Điều kiện và giới hạn

- Không khóa `auth.users` trong Finalize theo thứ tự sau khi đã khóa Organization/Membership nếu điều đó có thể tạo cycle với Auth transaction.
- Kiểm tra email confirmation là dữ liệu Auth nhạy cảm; chỉ RPC SECURITY DEFINER đọc cột cần thiết, không trả email hoặc Auth metadata cho client.
- `activate_my_confirmed_membership` là lifecycle transition riêng, không phải Admin invite mutation. Cần quyết định audit/Receipt semantics: đề xuất audit append-only tối thiểu; không đưa email vào Receipt/Change Feed; idempotent no-op nếu đã active.
- Cần test race: confirmation commit trước Finalize, Finalize commit trước confirmation, confirmation đồng thời với Finalize, user login sau confirmation, user chưa confirmation.
- Đây là đề xuất thiết kế, chưa sửa migration 013 và chưa kiểm chứng runtime. Cần review trigger ownership, Auth transaction behavior, grants và lock graph trên Supabase Test.

