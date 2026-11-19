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



## 18. Quyền xem danh sách thành viên và phân tách dữ liệu nhạy cảm

### 18.1 Hiện trạng đã kiểm tra

- Permission catalog có `users.view` và `users.manage`.
- Migration 005 cấp toàn bộ permission cho Admin; Technician không có users.view; Viewer được cấp mọi permission có `action='view'`, vì vậy hiện Viewer sẽ nhận `users.view`.
- Edge Function `manage-organization-members` hiện kiểm tra `users.manage` một lần trước khi xử lý mọi action, bao gồm `list`.
- Action `list` dùng service_role đọc membership, Profile email/display_name, role assignment và role; trả email cho client.
- UI `OrganizationMembersPanel` hiện vừa tải roster vừa hiển thị invite, đổi vai trò, reset mật khẩu, suspend/activate và remove; chưa tách read-only roster khỏi quyền quản trị.
- Migration 013 giới hạn cột Profile mà authenticated có thể SELECT; email chỉ được trusted Edge Function đọc qua service_role. Đây là hướng bảo vệ đúng, nhưng Edge Function hiện cấp email cho bất kỳ caller qua được users.manage.

### 18.2 Quyền đề xuất

Tách hai capability độc lập:
- `users.view`: đọc roster của tổ chức.
- `users.manage`: invite, đổi vai trò, reset password, suspend/activate, remove và các thao tác quản trị khác.

Mặc định đề xuất:
- Admin: cả users.view và users.manage.
- Technician: không có cả hai.
- Viewer: không có users.view mặc định, dù đây là permission có action view; phải loại trừ rõ khi seed Viewer. Có thể cấp riêng sau này cho role tùy chỉnh nếu doanh nghiệp chủ động muốn công khai danh bạ.
- Không dùng `users.manage` làm điều kiện đọc roster; không suy ra users.view từ users.manage ở client. Backend có thể cho Admin manage đồng thời view qua permission catalog, không hardcode bypass.

### 18.3 Phân lớp dữ liệu trả về

Roster cơ bản (chỉ users.view):
- membership_id, display_name nếu có, role_code/role_name, membership_status, created_at.
- Không trả email, phone, Auth user metadata, Auth user ID nếu UI không cần, reset token, invite URL hoặc thông tin Auth nhạy cảm.
- Với display_name rỗng, dùng nhãn trung tính như “Chưa cập nhật tên”; không fallback sang email.

Email và thao tác quản trị:
- Chỉ trả email khi caller có users.manage; email là dữ liệu cá nhân cần giới hạn.
- Các thao tác invite/update_role/update_status/remove_member/reset_password luôn yêu cầu users.manage ở server.
- Không coi việc ẩn nút trên UI là authorization.

### 18.4 Luồng Edge Function đề xuất

- Xác thực JWT bằng caller client, lấy actor từ auth.uid()/getUser; không nhận actor ID từ body.
- Parse action trước, sau đó kiểm tra capability đúng với action: list → users.view; các action mutation → users.manage.
- Kiểm tra tổ chức active + actor membership active trong cùng transaction/RPC khi thực hiện thao tác; pre-check Edge Function chỉ để UX, không phải authorization cuối cùng.
- Action list gọi RPC read-only SECURITY DEFINER (hoặc backend query đã được bảo vệ tương đương) để kiểm tra users.view và organization scope; không để service_role tự quyết định chỉ dựa trên organizationId từ request.
- RPC roster chỉ SELECT, không lock lâu hoặc mutate; truy vấn giới hạn theo organization_id và chỉ lấy membership status được phép hiển thị. Không trả membership của tenant khác.
- Nếu trả email theo users.manage, dùng cùng authorization check phía server và allowlist cột rõ ràng; tuyệt đối không SELECT *.
- Phân trang ổn định (created_at + id), giới hạn page size, tổng số thành viên không bắt buộc phải tiết lộ nếu không cần.
- UI tách chế độ read-only và quản trị: users.view chỉ thấy roster + làm mới; users.manage mới thấy form invite và action controls. Khi thiếu users.view thì không tải roster; khi có users.manage nhưng không có users.view, backend không tự suy diễn quyền đọc.

### 18.5 Kiểm thử

- Admin có cả hai quyền: roster đầy đủ theo policy; thao tác quản trị hoạt động.
- Caller chỉ users.view: đọc roster cơ bản được; email và mọi mutation bị từ chối/ẩn.
- Caller chỉ users.manage: mutation được phép theo từng action; list vẫn bị từ chối nếu không có users.view (nguyên tắc tách quyền).
- Technician mặc định: không đọc roster, không quản trị.
- Viewer mặc định: không đọc roster; xác minh migration seed không tự cấp users.view.
- Custom role được cấp users.view: chỉ nhận roster cơ bản.
- Tự sửa body organizationId sang tenant khác, inactive organization/membership, revoke quyền đồng thời: không rò dữ liệu.
- Kiểm tra pagination, empty roster, missing profile, missing role assignment, suspended/invited memberships.
- Email không xuất hiện trong log, telemetry, Change Feed hoặc lỗi; không truy cập trực tiếp Profile.email từ client authenticated.

### 18.6 Ranh giới

Đây là policy/design đề xuất theo nguyên tắc least privilege, chưa thay đổi permission seed, Edge Function, UI, SQL hay Supabase. Cần xác nhận chính sách sản phẩm về việc Viewer có được xem danh bạ thành viên hay không trước khi triển khai. Khuyến nghị mặc định: KHÔNG.


## 19. Chốt policy roster và thiết kế RPC đọc

### 19.1 Quyết định sản phẩm

- Viewer mặc định **không** được xem roster.
- Admin có `users.view` và `users.manage`.
- Technician không có hai quyền này.
- Viewer không có `users.view`; không được suy quyền này từ action='view'. Nếu doanh nghiệp muốn danh bạ nội bộ, có thể cấp riêng cho Custom Role.
- `users.manage` không tự động thay thế `users.view`. Admin seed được cấp cả hai; caller chỉ có manage mà thiếu view không được gọi list.

### 19.2 RPC đề xuất

Tên: `list_organization_members` (read-only, SECURITY DEFINER, SET search_path=''; row_security=off).

Tham số:
- `p_organization_id uuid`
- `p_after_created_at timestamptz DEFAULT NULL`
- `p_after_member_id uuid DEFAULT NULL`
- `p_limit integer DEFAULT 50`, server clamp/reject ngoài 1..100.

Kết quả tối thiểu:
- `membership_id uuid`
- `display_name text` (NULL/blank được UI hiển thị “Chưa cập nhật tên”)
- `role_code text`
- `role_name text`
- `membership_status text`
- `created_at timestamptz`

Không trả email, phone, Auth user ID, Auth metadata, token, invite URL hoặc toàn bộ Profile row. Không trả tổng số roster nếu không có nhu cầu sản phẩm. Roster có thể gồm invited, active, suspended; không gồm membership đã remove.

### 19.3 Authorization và SQL semantics

- Chỉ execute cho authenticated; revoke PUBLIC/anon/service_role nếu không cần server job. Không cho anon.
- Actor luôn lấy từ `auth.uid()`, không nhận actor ID từ client.
- Trong cùng một SQL statement/RPC transaction, xác minh organization active, membership của actor active và effective `users.view` thông qua role assignment active. Không tin organizationId của request nếu thiếu kiểm tra scope.
- Read-only không cần khóa hàng dài; một statement snapshot đảm bảo dữ liệu và quyền được đánh giá nhất quán tại thời điểm statement. Revoke đồng thời có thể commit sau snapshot; request đã bắt đầu được xem là đọc trước thời điểm revoke. Các mutation vẫn phải có authorization lock trong transaction riêng.
- Query mọi hàng đều lọc `organization_id = p_organization_id`; join Profile theo user ID chỉ để lấy display_name; không select email.
- Role code/name lấy từ role assignment hiện tại; xử lý nhiều role theo quy tắc đã chốt cho ứng dụng (khuyến nghị trả các role codes đã sort, hoặc đảm bảo một membership chỉ có một role system hiện tại). Không dùng tùy tiện `LIMIT 1` nếu schema cho phép nhiều role.
- Keyset pagination theo cặp `(created_at, id)`, order tăng dần. Cursor phải có cả hai thành phần hoặc cả hai NULL; predicate lexicographic `(created_at,id) > (...)`. Page size tối đa 100. Không dùng OFFSET.
- RPC trả `has_more`/next cursor rõ ràng hoặc dùng page-size + 1 để xác định trang kế tiếp; không dùng tổng COUNT.
- Không log dữ liệu Profile; lỗi trả mã tổng quát, không email/UUID Auth hoặc SQL text.

### 19.4 Edge Function và UI

- Khuyến nghị action list gọi RPC bằng caller JWT (callerClient.rpc), không dùng service_role để đọc roster.
- Nếu giữ Edge Function làm transport, dispatch list trước nhánh users.manage; backend RPC vẫn kiểm tra users.view. Không pre-check `has_org_permission` rồi mới service_role SELECT vì tạo khoảng trống giữa kiểm tra và đọc.
- Các mutation invite/role/status/remove/reset password tiếp tục dùng users.manage và RPC transaction bảo vệ. Không thay đổi các action này trong phạm vi thiết kế roster.
- UI chỉ gọi list khi đã có users.view; panel read-only chỉ hiện roster. Các control invite/manage chỉ hiện khi có users.manage. Backend là ranh giới bảo mật cuối cùng.
- Bỏ email khỏi OrganizationMemberView nếu roster chỉ users.view; phần quản trị email nên là response riêng chỉ dành cho users.manage. Không fallback display name sang email.

### 19.5 Migration/seed cần xử lý khi triển khai

Migration 005 hiện seed Viewer bằng `p.action = 'view'`, do đó Viewer đang nhận users.view và roles.view. Khi triển khai phải đổi seed thành allowlist rõ ràng hoặc loại trừ `users.view` khỏi Viewer; chỉ sửa một permission code sau seed là chưa đủ cho tổ chức đã tồn tại nếu không có migration thu hồi role_permissions cũ.

### 19.6 Test bắt buộc

- Admin: list thành công; email không có trong payload.
- users.view-only Custom Role: list thành công, không có email.
- users.manage-only: list bị từ chối.
- Technician và Viewer mặc định: list bị từ chối.
- Organization/member inactive, tenant ID giả, no membership, role inactive, permission revoke.
- Pagination đồng thời có created_at trùng nhau; cursor rỗng/thiếu một nửa/giả mạo; page size 0, 101, âm.
- Missing Profile/display_name, missing role assignment, multi-role membership, invited/suspended rows.
- Authenticated không thể SELECT Profile.email; anon không gọi RPC; service_role không được dùng như đường bypass trong Edge Function.
- Response/log không chứa email, phone, Auth metadata hoặc token.

### 19.7 Ranh giới

Đây là thiết kế đã chốt policy mặc định Viewer không xem roster. Chưa tạo SQL migration/draft, chưa sửa migration 005/013, Edge Function hoặc UI, chưa chạy RPC/SQL và chưa thay đổi Supabase. Trước khi viết SQL cần quyết định schema có cho phép nhiều role trên một membership và nếu có thì API biểu diễn danh sách role như thế nào.


## 20. Chốt một vai trò hiện hành cho mỗi membership

Theo xác nhận tiếp tục của người dùng, phiên bản hiện tại áp dụng nguyên tắc **mỗi membership có đúng một role hiện hành**. Không triển khai multi-role trong phiên bản này.

### Hiện trạng schema và UI

- Migration 005 tạo PK `(organization_id, member_id, role_id)` cho `member_roles`, vì vậy hiện cho phép một membership có nhiều role.
- Seed ban đầu ánh xạ mỗi membership sang một role; luồng đổi role hiện xóa assignment cũ rồi insert assignment mới.
- UI `OrganizationMemberView` chỉ có `roleCode` và `roleName`, không hỗ trợ mảng role.
- Vì vậy cần ràng buộc ở database, không chỉ dựa vào hành vi UI.

### Thiết kế ràng buộc

- Bổ sung UNIQUE `(organization_id, member_id)` cho `member_roles` (unique constraint hoặc unique index).
- Trước khi tạo constraint, migration phải preflight đếm membership có nhiều hơn một role. Nếu có bất kỳ trường hợp nào, dừng migration và yêu cầu rà soát thủ công; không tự chọn role, không xóa assignment dư và không suy đoán role đúng.
- Sau khi constraint được áp dụng, mọi RPC đổi role thực hiện transaction: xác minh actor + target + role hợp lệ; DELETE assignment hiện tại; INSERT đúng một assignment mới; audit/Receipt cùng transaction theo chuẩn mutation chung. Không có trạng thái commit giữa DELETE và INSERT.
- Membership legacy không có member_roles phải được xử lý rõ trong migration/reconciliation. Không tự suy role từ dữ liệu mơ hồ; có thể dùng legacy organization_members.role chỉ khi mapping đã được kiểm chứng và nhất quán.
- Không cho phép role assignment trỏ tới role inactive; RPC phải kiểm tra is_active trong cùng transaction và khóa role theo lock matrix.
- `organization_members.role` hiện là legacy compatibility field. Trong giai đoạn chuyển tiếp, phải giữ đồng bộ với role_code mới ở cùng transaction hoặc xác định rõ nguồn sự thật. Khuyến nghị: member_roles là nguồn phân quyền; legacy role chỉ là mirror tương thích, không được dùng để cấp quyền mới. Cần audit toàn bộ code/RLS còn đọc legacy role trước khi bỏ mirror.

### Roster API

`list_organization_members` trả một `role_code` và `role_name` duy nhất. Nếu membership thiếu role assignment sau khi migration hoàn tất, coi là integrity error được ghi nhận/giám sát; không trả role ngẫu nhiên và không fallback âm thầm.

### Test bắt buộc

- Unique constraint chặn role thứ hai cho cùng membership.
- Migration preflight abort nếu có duplicate assignments.
- Đổi role thành công atomic; lỗi insert rollback cả DELETE.
- Hai Admin đồng thời đổi role cùng target: serialize theo lock order, kết quả cuối cùng là một role hợp lệ.
- Role bị deactivate đồng thời với assignment: khóa/check role nhất quán.
- Legacy role mirror và member_roles không lệch sau create/change.
- Membership thiếu assignment được phát hiện; không lộ quyền qua legacy fallback.

### Ranh giới

Đã chốt policy một role hiện hành/membership cho phiên bản hiện tại. Chưa tạo migration SQL, chưa thay đổi migration 005/013, RPC, Edge Function, UI hoặc Supabase. Trước khi triển khai phải preflight dữ liệu thực tế trên Test và xác định cách chuyển tiếp legacy role.


## 21. Audit toàn bộ consumer của legacy organization_members.role

### 21.1 Kết quả static search

Đã rà soát migrations 001/002/005/013/014, Edge Function quản lý thành viên, App.tsx, bootstrap script và các test liên quan. Những consumer quan trọng:

| Consumer | Cách dùng hiện tại | Rủi ro / hướng xử lý |
|---|---|---|
| Migration 001 `has_org_role()` | So sánh trực tiếp `organization_members.role` | Migration 005 thay function để xét legacy OR member_roles; cần chuyển sang member_roles-only sau reconciliation |
| Migration 005 `has_org_role()` | Admin/role true nếu legacy role OR assignment | Hai nguồn quyền có thể mâu thuẫn; legacy Admin không có assignment vẫn có quyền |
| RLS migration 002 | DELETE Assets, Inventory, Tasks, Plans, Checklist Templates, Logs? dùng `has_org_role(...,'admin')` | Mọi policy phụ thuộc helper; helper đổi sai có thể mở hoặc khóa quyền xóa hàng loạt |
| Draft 019 | Admin-only `logs.revise` yêu cầu `has_org_role(...,'admin')` | Cũng phụ thuộc nguồn role thống nhất |
| Migration 013 | Role/status RPC đọc cả `m.role` và assigned role; chặn target nếu một trong hai là Admin | Khi hai nguồn lệch có thể từ chối sai hoặc che lỗi dữ liệu; thay bằng role assignment authoritative sau preflight |
| Migration 014 | Remove RPC đọc cả legacy và assignment, sau đó yêu cầu current role technician/viewer | Legacy Admin không assignment bị chặn do current_role null; dữ liệu lệch tạo behavior không nhất quán |
| Edge Function list | Fallback Admin nếu `row.role='admin'`; thiếu assignment khác trả unknown | Có thể hiển thị Admin dựa vào legacy trong khi permission helper đọc assignment; bỏ fallback sau migration |
| App.tsx organization context | Đọc cột role nhưng không dùng trực tiếp; gọi has_org_role 3 lần để suy role | Có thể thay bằng một RPC context/permission response sau; không dùng legacy role ở client |
| Bootstrap/test scripts | Một số báo cáo và test đọc legacy role trực tiếp | Giữ legacy chỉ trong diagnostics/backfill; đổi test nghiệp vụ sang member_roles |

### 21.2 Nguyên tắc nguồn sự thật

- `member_roles` là nguồn duy nhất quyết định vai trò và quyền sau khi migration cutover hoàn tất.
- `organization_members.role` chỉ là compatibility mirror theo constraint cũ ('admin'/'user'), không được dùng để authorize, không được dùng fallback hiển thị.
- Mapping mirror: role_code='admin' → legacy role='admin'; role_code='technician' hoặc 'viewer' → legacy role='user'. Mirror chỉ phục vụ code/diagnostics legacy trong giai đoạn chuyển tiếp.
- Tất cả đường tạo membership, đổi role, bootstrap, invite finalize phải cập nhật assignment và mirror trong cùng transaction. Không có dual-write ngoài transaction.
- Không bỏ cột legacy ngay. Chỉ loại bỏ sau khi search toàn repo và xác nhận không còn code, RLS, function, trigger, script hoặc integration đọc nó.

### 21.3 Thứ tự cutover an toàn

1. Read-only preflight toàn bộ membership: số membership active/invited/suspended; số assignment 0/1/>1; assignment trỏ role inactive; assignment organization mismatch; legacy admin không assignment; legacy admin lệch assignment; legacy user có assignment Admin; role không tồn tại/inactive.
2. Xuất báo cáo định danh nội bộ cho Admin operator; không tự chọn/xóa assignment. Bất kỳ duplicate hoặc role conflict nào phải dừng cutover và xử lý có audit.
3. Bổ sung unique `(organization_id, member_id)` chỉ sau khi duplicate count=0.
4. Đảm bảo mọi membership có đúng một assignment hợp lệ. Không tự suy role cho các dòng không rõ; mapping legacy admin/user chỉ được dùng khi preflight chứng minh dữ liệu và chính sách mapping an toàn.
5. Cập nhật create/invite/change-role/remove và bootstrap để assignment + mirror cùng transaction. Remove cascade assignment.
6. Chuyển `has_org_role()` thành member_roles-only; đây là thay đổi ảnh hưởng toàn bộ RLS admin DELETE và Admin-only RPC, phải kiểm thử đầy đủ từng policy.
7. Chuyển 013/014 Admin-target guard và Edge Function roster bỏ legacy fallback; App context đọc role assignment duy nhất.
8. Chạy test Admin/Technician/Viewer/custom role, RLS DELETE matrix, member management, legacy mismatch, no assignment, inactive role.
9. Sau khi quan sát ổn định mới xem xét bỏ cột legacy trong migration riêng; không gộp vào cutover.

### 21.4 Phát hiện bổ sung cần giải quyết

- `has_org_role()` hiện trả true nếu legacy Admin dù không có assignment; điều này trái với định hướng member_roles là authoritative.
- Migration 013 đổi role assignment nhưng không cập nhật legacy role. Đây không phải lỗi nếu legacy field chỉ là mirror 'admin/user' và role mới technician↔viewer cùng ánh xạ 'user'; nhưng nếu chuyển Admin qua flow khác thì mirror cần cập nhật đồng bộ.
- RLS DELETE policies trong migration 002 gọi has_org_role. Không thể chỉ thay helper mà bỏ qua test; phải xác minh tất cả module Admin-only.
- Edge Function list có fallback Admin từ legacy role, còn permission helper `has_org_permission` chỉ xét assignment. UI có thể hiển thị role không tương ứng permission thực tế.
- Organization_members.role được select trong App.tsx nhưng hiện không được dùng để xác định role; có thể bỏ khỏi select khi refactor.

### 21.5 Ranh giới

Đây là audit static và cutover plan. Chưa sửa helper, migration, RLS, Edge Function, App.tsx, test hoặc bootstrap; chưa tạo SQL draft, chưa chạy SQL/RPC và chưa thay đổi Supabase.


## 22. Preflight dữ liệu trước khi chuyển member_roles thành nguồn vai trò duy nhất

### 22.1 Phạm vi và giới hạn xác minh

Đây là kế hoạch kiểm tra read-only dựa trên schema/migration trong repository. Hiện không có kết nối truy vấn dữ liệu Supabase thực tế trong bước rà soát này; vì vậy chưa biết số membership/assignment thực tế, chưa thể kết luận dữ liệu Test hay Production sạch.

### 22.2 Các nhóm thống kê bắt buộc

Báo cáo phải có tổng số membership theo organization/status và các nhóm:
- Membership có 0 assignment.
- Membership có đúng 1 assignment.
- Membership có hơn 1 assignment.
- Assignment trỏ role inactive.
- Legacy role không thuộc tập giá trị schema cho phép hoặc không khớp mapping mirror dự kiến.
- Legacy Admin nhưng assignment không phải Admin hoặc không có assignment.
- Legacy user nhưng assignment là Admin.
- Assignment role code không thuộc tập role được ứng dụng hỗ trợ (admin/technician/viewer hoặc Custom Role được phê duyệt).
- Organization/membership/role scope mismatch (FK kép hiện có phải ngăn các trường hợp này; vẫn kiểm tra để phát hiện constraint bị thiếu/NOT VALID hoặc dữ liệu được nạp ngoài đường chuẩn).

### 22.3 Phân loại mismatch, không tự sửa

Mapping mirror dự kiến sau cutover: admin → legacy admin; technician, viewer và Custom Role không có quyền Admin → legacy user. Việc phân loại chỉ là báo cáo; không được tự động biến legacy user thành Technician nếu assignment thiếu, vì có thể đã từng là Viewer hoặc Custom Role. Không được tự chọn một trong nhiều assignment. Mọi trường hợp không giải thích được phải được Admin/operator xác nhận và ghi audit trước khi sửa.

### 22.4 Cổng cho phép cutover

Chỉ được tiếp tục khi:
1. Không còn membership có nhiều assignment.
2. Mọi membership cần truy cập tenant có đúng một assignment hợp lệ, role active và thuộc đúng organization.
3. Mọi mismatch legacy/assignment đã được phân loại, phê duyệt và có kế hoạch mirror đồng bộ.
4. Không còn role code ngoài chính sách được duyệt.
5. Có snapshot/backup và báo cáo trước-sau; migration có transaction, kiểm tra hậu điều kiện và phương án forward-fix/rollback phù hợp.

Nếu có bất kỳ dòng mơ hồ nào, dừng cutover; không xóa assignment, không gán mặc định Technician, không thay đổi legacy role tự động.

### 22.5 Thứ tự triển khai dự kiến

1. Chạy truy vấn thống kê read-only trên Test, xuất kết quả tổng hợp và danh sách ngoại lệ có định danh nội bộ.
2. Đối chiếu các trường hợp ngoại lệ với lịch sử invite/đổi role và xác nhận của Admin.
3. Chốt dữ liệu chuẩn và mirror; thực hiện sửa dữ liệu có audit trong migration riêng.
4. Chạy lại preflight; chỉ khi assignment_count=1 và mismatch_count=0 mới thêm unique (organization_id, member_id).
5. Chuyển mọi writer tạo/đổi role sang cập nhật assignment + legacy mirror trong cùng transaction.
6. Chuyển authorization helper/RLS/Edge Function sang member_roles-only; kiểm thử rồi mới triển khai Production theo phê duyệt riêng.

Không có truy vấn nào được chạy trên Supabase trong bước này. Đây không phải migration SQL; không sửa code, dữ liệu, RLS hoặc Cloud.

## 23. Static audit writer role assignment sau preflight Test

### 23.1 Phạm vi và nguồn

Đã đọc trực tiếp:
- `supabase/migrations/20261117000500_roles_and_permissions.sql`
- `supabase/migrations/20261117001300_member_management.sql`
- `supabase/migrations/20261117001400_remove_org_member.sql`
- `supabase/functions/manage-organization-members/index.ts`

Đối chiếu với kết quả preflight Supabase Test do người vận hành báo ngày 19/11/2026: 4 membership; Q3/Q4/Q5/Q7/Q8 không có dòng; Q6 gồm Admin 1, Technician 2, Viewer 1. Kết quả này chỉ xác nhận snapshot Test tại thời điểm chạy, không thay thế các kiểm tra transaction/concurrency.

### 23.2 Ma trận writer hiện tại

| Đường nghiệp vụ | Writer thực tế | Tính nguyên tử | Nhận xét |
|---|---|---|---|
| Backfill migration 005 | INSERT member_roles từ organization_members.role | Trong transaction migration | Backfill chỉ chạy lúc migration; ON CONFLICT DO NOTHING không tự reconciliation dữ liệu đã có |
| Invite/create membership | Edge Function gọi admin_create_org_membership | INSERT membership + assignment cùng RPC transaction | Đang tạo đúng một assignment cho role Technician/Viewer; có unique membership org/user; chưa khóa Organization và Role theo lock matrix |
| Change role | Edge Function gọi admin_update_org_member_role | DELETE assignment cũ + INSERT assignment mới trong một RPC transaction | Atomic khi RPC chạy thành công, nhưng SELECT target không FOR UPDATE; không khóa Organization/Role; legacy mirror không được cập nhật |
| Suspend/reactivate | Edge Function gọi admin_update_org_member_status | Chỉ UPDATE membership status trong RPC transaction | Không thay role assignment; target/organization chưa được khóa theo lock matrix |
| Remove member | Edge Function gọi admin_remove_org_membership | DELETE membership; FK cascade xóa assignments | RPC có FOR UPDATE membership nhưng chưa khóa Organization trước; query role có thể nhiều dòng nếu dữ liệu duplicate |
| Auth email confirmation | Trigger sync_auth_user_profile trên auth.users | Cùng transaction cập nhật Auth user | Trigger cập nhật mọi membership invited thành active; không khóa Organization/Membership theo thứ tự chuẩn và không phát membership audit/event |
| List roster | Edge Function đọc membership, assignments, roles riêng rồi Map theo member_id | Không phải writer | Nếu có nhiều assignment, Map ghi đè theo thứ tự trả về; kết quả role không xác định. Sau unique constraint, vẫn cần xử lý integrity error khi thiếu assignment |

### 23.3 Các vấn đề cần xử lý trước cutover

**P1 — Lock order chưa thống nhất**
- admin_create_org_membership kiểm tra Organization active và Role active nhưng không khóa hai dòng đó.
- admin_update_org_member_role không khóa target membership trước khi thay assignment; role được tra cứu riêng và không khóa.
- admin_update_org_member_status không khóa Organization/Membership trước khi đổi status.
- admin_remove_org_membership khóa membership nhưng chưa khóa Organization trước.
- Chuẩn hóa: Organization → Membership (nếu đã tồn tại) → Role/assignment/permission → Receipt/audit/event theo mutation contract. Không được có đường ngược thứ tự.
- Khi tạo membership chưa có row: khóa Organization trước, khóa/check Role, sau đó insert membership và assignment.

**P1 — Change role cần enforce đúng một assignment và mirror**
- DELETE + INSERT trong một PL/pgSQL RPC là atomic; không có trạng thái commit giữa hai lệnh.
- Tuy nhiên SELECT INTO hiện join assignment có thể trả nhiều dòng nếu duplicate; khi đó role được chọn không xác định. Preflight hiện tại Test không có duplicate, nhưng RPC vẫn phải phát hiện integrity violation thay vì chọn tùy tiện.
- Sau khi thêm unique (organization_id, member_id), RPC đổi role phải xác nhận assignment hiện tại đúng một dòng và role hiện tại active; role đích active và thuộc đúng organization; khóa target và role theo lock matrix.
- Cập nhật organization_members.role mirror trong cùng transaction: role Admin → legacy admin; Technician/Viewer → legacy user. Hiện RPC chỉ nhận Technician/Viewer nên legacy user giữ nguyên; cần cập nhật rõ để tránh lỗi khi mở rộng role hoặc Admin workflow.
- DELETE + INSERT + mirror + Receipt/audit/change event phải cùng transaction. Nếu bất kỳ bước nào lỗi, rollback toàn bộ.

**P1 — Create membership phải khóa và chống race**
- admin_create_org_membership hiện insert membership rồi assignment trong cùng transaction; đây là điểm tốt.
- Cần khóa Organization active trước khi tạo; khóa Role active theo cùng lock order; giữ khóa Auth user nếu cần giải quyết email-confirmation race nhưng phải phân tích deadlock với trigger Auth.
- Duplicate membership phải trả conflict có kiểm soát; không được xóa Auth user đã tồn tại trước đó.
- Không cho phép membership commit nếu assignment insert không thành công; sau unique constraint, một membership chỉ có thể nhận một assignment.

**P1 — Auth trigger không được tự ý thay lifecycle membership ngoài protocol**
- sync_auth_user_profile hiện cập nhật status invited → active trực tiếp từ trigger auth.users.
- Trigger không cập nhật role assignment, nhưng vẫn là một writer lifecycle membership; nó có thể chạy đồng thời với suspend/remove/invite và không tuân thủ lock order Organization → Membership.
- Theo hướng thiết kế Invite Saga đã review: trigger chỉ đồng bộ Profile; membership activation phải qua RPC self-activation/Finalize có khóa, điều kiện Auth confirmation, idempotency và audit rõ ràng. Chưa sửa trigger hoặc tạo migration ở bước audit này.

**P1 — Edge Function pre-check không thay thế server transaction authorization**
- Edge Function kiểm tra users.manage qua caller JWT trước khi gọi service_role RPC. RPC hiện chỉ kiểm tra auth.role() = service_role và nhận p_actor_user_id từ caller do Edge Function truyền vào.
- Cần giữ kiểm tra users.manage ở server-side mutation protocol/RPC, xác thực actor từ JWT tin cậy hoặc một service-only contract không thể bị gọi tùy tiện; kiểm tra quyền và mutation phải được serialize phù hợp với suspend/revoke race.
- Các thao tác list/reset/remove hiện có pre-read qua service_role; không dùng kết quả pre-read làm căn cứ cuối cùng cho mutation. RPC phải kiểm tra lại target, role, trạng thái và điều kiện cấm ngay trong transaction.
- Invite flow hiện có thể xóa Auth user vừa được invite nếu RPC tạo membership lỗi. Phải thay bằng Invite Saga đã thiết kế; không rollback bằng cách xóa Auth user mù quáng khi outcome không rõ hoặc user có thể đã được dùng ở tenant khác.

### 23.4 Điều kiện cutover đề xuất

1. Preflight Test đạt như báo cáo ngày 19/11/2026; trước migration vẫn chạy precondition trong chính transaction migration để dừng nếu duplicate xuất hiện sau snapshot.
2. Thêm unique constraint/index (organization_id, member_id) chỉ sau precondition duplicate = 0.
3. Thay/thiết kế lại RPC create/change/status/remove theo lock order; mỗi writer phải giữ tenant boundary, membership state, role active, actor permission và Receipt/audit trong transaction.
4. Cập nhật legacy mirror trong cùng transaction; member_roles là nguồn quyền, legacy role chỉ là compatibility mirror.
5. Chuyển Auth trigger membership activation sang RPC lifecycle có kiểm soát theo Invite Saga.
6. Roster phải trả một role duy nhất; thiếu/nhiều assignment là integrity error, không fallback legacy và không chọn tùy tiện.
7. Sau khi các writer mới sẵn sàng, chuyển has_org_role, RLS, member-management RPC và Edge Function sang member_roles-only; chạy đầy đủ permission/RLS/concurrency tests.

### 23.5 Ranh giới xác minh

Đây là static audit repository. Không sửa migration, SQL draft, Edge Function, UI hoặc test; không chạy SQL/RPC; không thay đổi Supabase Test hay Production. Kết quả preflight Test được ghi nhận riêng, không có nghĩa các vấn đề concurrency/authorization đã được kiểm thử runtime.

## 24. RPC cutover contract sau writer audit

### 24.1 Mục tiêu

Đây là hợp đồng thiết kế để chuẩn bị migration/cutover một role/membership. Không phải SQL thực thi. Giữ nguyên nguyên tắc:
- member_roles là nguồn duy nhất quyết định role/permission sau cutover.
- organization_members.role chỉ là compatibility mirror: Admin → 'admin'; Technician/Viewer → 'user'.
- Mỗi membership có đúng một assignment active hợp lệ.
- Tất cả membership mutation và audit/Receipt/change event liên quan phải cùng transaction.
- Không có fallback quyền từ legacy role.
- Không thay đổi quyền nghiệp vụ Admin/Technician/Viewer đã chốt.

### 24.2 Authorization boundary

Khuyến nghị các RPC nghiệp vụ nhận caller JWT và tự xác thực actor bằng auth.uid(), thay vì tin p_actor_user_id do Edge Function truyền vào cùng service_role. Trong transaction:
1. Yêu cầu authenticated caller hợp lệ.
2. Lấy actor duy nhất từ auth.uid(); không nhận actor ID từ client.
3. Khóa/check Organization active.
4. Khóa/check actor Membership active trong Organization.
5. Kiểm tra users.manage bằng role assignment hiện hành trong cùng transaction.
6. Khóa target Membership/Role theo operation và kiểm tra lại mọi điều kiện cấm.
7. Ghi mutation, Receipt và audit/change event trong cùng transaction.

Edge Function vẫn có thể dùng service_role cho Auth Admin API (invite email, reset password), nhưng không được dùng pre-check quyền riêng lẻ làm authorization cuối cùng cho DB mutation. Nếu giữ RPC service_role-only cho một bước nội bộ của Invite Saga, phải phân biệt rõ RPC internal-only với RPC mutation do Admin yêu cầu; không được để caller điều khiển actor ID tùy ý.

### 24.3 Lock order chuẩn

- Tạo membership: Organization FOR SHARE → Role đích FOR SHARE → Auth user lock/reconciliation theo Invite Saga → INSERT Membership → INSERT Assignment → Receipt/audit/event.
- Đổi role: Organization FOR SHARE → actor Membership FOR SHARE → target Membership FOR UPDATE → current/target Role rows FOR SHARE theo thứ tự ID ổn định → Assignment mutation → legacy mirror → Receipt/audit/event.
- Suspend/reactivate: Organization FOR SHARE → actor Membership FOR SHARE → target Membership FOR UPDATE → status mutation → Receipt/audit/event.
- Remove: Organization FOR SHARE → actor Membership FOR SHARE → target Membership FOR UPDATE → kiểm tra role/target → DELETE Membership (FK cascade assignment) → Receipt/tombstone/audit/event.
- Self-activation sau email confirmation: Organization FOR SHARE → own Membership FOR UPDATE → xác minh Auth email confirmation → chuyển invited → active → audit/event.
- Mọi đường thay đổi Organization status, Membership status, Role active, Role permissions phải tuân thủ lock order tương thích. Không khóa Auth user trước rồi quay ngược lấy Organization/Membership nếu trigger Auth còn có thể thao tác tenant rows.

### 24.4 Hợp đồng từng RPC

**create/finalize membership**
- Input gồm organization_id, auth_user_id đã được Invite Saga xác minh, role_code được allowlist, operation/mutation ID.
- Actor lấy từ JWT; users.manage và Organization active được xác minh trong transaction cuối.
- Role đích phải thuộc đúng organization, active, và nằm trong role code được phép gán.
- Membership + đúng một assignment + legacy mirror + Receipt + Change Feed cùng transaction.
- Unique (organization_id, user_id) xử lý duplicate; conflict không xóa Auth user. Auth user lifecycle thuộc Invite Saga riêng.
- Nếu invite email đã gửi nhưng kết quả DB không rõ, reconcile cùng operation ID; không gọi invite lần hai, không delete Auth user để giả rollback.

**change role**
- Chỉ nhận role đích hợp lệ; không nhận role_id tùy ý nếu code allowlist có thể được server resolve.
- Cấm tự đổi role; cấm thay đổi Admin membership theo policy hiện hành.
- Target phải tồn tại, chưa removed; current assignment phải có đúng một dòng và role active. Zero/multiple/inactive là integrity error, không tự chọn.
- Nếu role đích trùng role hiện tại: trả no_change Receipt; không delete/insert lại và không phát event giả.
- Nếu khác: xóa assignment cũ + insert assignment mới + cập nhật legacy mirror trong một transaction.
- Receipt fingerprint phải bind organization, target, role đích và actor; replay tuân Shared Receipt policy.

**change status**
- Chỉ active/suspended; không kích hoạt invitation chưa xác nhận bằng Admin status RPC.
- Cấm tự suspend/reactivate nếu policy hiện hành yêu cầu; target Admin không được thao tác qua RPC quản lý Technician/Viewer.
- Status transition được khóa; assignment vẫn giữ nguyên. Audit event bắt buộc.

**remove membership**
- Không xóa Auth user hoặc Profile.
- Cấm tự xóa; cấm xóa Admin; target phải có đúng một role hợp lệ theo policy.
- Delete membership và cascade assignment trong một transaction; Receipt + tombstone/change event phải giữ được target ID sau khi row bị xóa.
- Không dựa pre-read Edge Function để kết luận role; kiểm tra lại trong RPC.

**self activation**
- Trigger auth.users chỉ đồng bộ Profile, không đổi membership status.
- Sau khi email confirmation hoàn tất, người dùng gọi RPC self-activation bằng JWT của chính họ.
- RPC kiểm tra auth.uid() khớp membership user_id và Auth email_confirmed_at khác NULL; chỉ chuyển invited → active; suspended/removed không được tự kích hoạt.
- Idempotent: active sẵn thì no_change; không tạo role assignment mới.

### 24.5 Ràng buộc một role/membership

Sau precondition duplicate = 0, thêm unique (organization_id, member_id) cho member_roles. Migration phải:
- Chạy trong transaction.
- Re-check duplicate ngay trong migration; nếu có thì RAISE EXCEPTION và rollback toàn bộ.
- Không tự xóa hoặc chọn assignment.
- Kiểm tra membership cần dùng có đúng một assignment, role tồn tại/active và đúng organization.
- Không backfill missing role bằng Technician một cách tự động.
- Không bỏ PK hiện tại nếu unique mới có thể thêm trực tiếp; đánh giá index/constraint và query plan trước.
- Cập nhật writer trước hoặc trong cutover theo thứ tự an toàn để không có khoảng thời gian tạo nhiều assignment.

### 24.6 Bắt buộc trước khi viết migration thực thi

1. Chốt chính xác operation Receipt names, mutation IDs, fingerprint fields, permission codes và Change Feed event schema theo Shared Receipt/Change Feed design.
2. Rà soát lock matrix với các RPC thay đổi Organization, Membership, Role, Role Permissions và Auth confirmation.
3. Chốt API boundary Edge Function ↔ caller JWT RPC ↔ Auth Admin API cho Invite Saga.
4. Chốt cách xử lý custom role: hiện RPC membership chỉ cho Technician/Viewer; không tự mở custom role nếu chưa có policy.
5. Viết SQL migration riêng, có precondition fail-closed, grants/revokes, RLS, comments và rollback/forward-fix plan.
6. Viết test SQL cho concurrent role changes, permission revoke race, org suspend race, duplicate/missing assignment, inactive role, replay, self/admin restrictions, Auth confirmation/suspend/remove race.
7. Static review migration và test trước khi người dùng phê duyệt chạy trên Supabase Test.

### 24.7 Ranh giới

Chỉ chốt hợp đồng thiết kế. Chưa viết SQL migration thực thi, chưa sửa migration 013/014, chưa sửa Edge Function, chưa chạy SQL/RPC, chưa áp dụng unique constraint và chưa thay đổi Supabase.



## 25. Hợp đồng thống nhất Member RPC – lock, Receipt và Change Feed (19/11/2026)

Trạng thái: **đề xuất kỹ thuật để chuẩn hóa §§21, 24 và cross-review Foundation §30; chưa phải SQL contract đã triển khai**. Mục này làm rõ thứ tự xử lý; các operation/event code cần được duyệt trước executable migration.

### 25.1 Một lock order duy nhất

Áp dụng thứ tự tương đối sau cho mọi RPC quản trị thành viên/role và mọi business RPC có dùng các lớp lock tương ứng:

1. **Organization** — khóa và xác nhận active.
2. **Membership rows** — actor và target cần thiết; khóa theo UUID tăng dần, actor=target chỉ khóa một lần. Xác nhận actor active; kiểm tra target state sau khi khóa.
3. **member_roles assignments** — khóa các assignment cần thiết theo organization_id, member_id, role_id tăng dần. Với mô hình một role/membership, phải xác nhận đúng một assignment, không chọn tùy tiện.
4. **Role rows** — khóa theo role ID tăng dần; xác nhận role active và thuộc đúng organization.
5. **Role Permission rows** — khóa theo role ID và permission code tăng dần; xác nhận permission cần thiết cho operation. Các lớp 2–5 phải được lấy theo cùng thứ tự ở mọi RPC, kể cả RPC revoke/deactivate.
6. **Auth user row**, chỉ khi Invite Saga/finalize thực sự cần; không gọi Auth Admin API hoặc network khi đang giữ DB locks. Trigger Auth chỉ được đồng bộ Profile, không được ghi Membership.
7. **Receipt** — replay lookup/claim theo §25.2; không được khóa business row trước rồi mới quay lại claim Receipt.
8. **Business/target rows** — theo table-rank rồi primary key tăng dần. Nếu nhiều bảng, mọi RPC dùng cùng table-rank.
9. **Asset Lease** — chỉ theo bridge contract riêng đã thống nhất với Asset RPC; chưa đưa Asset vào cutover này.
10. **Organization Sync Counter** → **Change events** → **Receipt finalize**.

Các RPC được phép bỏ qua lớp không sử dụng, nhưng không được đảo thứ tự tương đối. Nếu một thao tác FK/cascade/trigger tự lấy lock ngoài thứ tự này, phải phân tích và concurrency-test; không coi bảng lock order tự nó là bằng chứng không deadlock.

**Đính chính tài liệu:** thứ tự cũ ở §24.3 (Role đích trước Membership trong create; target Membership trước Role trong change-role) và bảng Foundation §21.2 không còn là thứ tự độc lập. Khi review/cutover, dùng §25.1 làm thứ tự chuẩn đề xuất; cần đồng bộ lại §21 và §24 trước khi viết SQL.

### 25.2 Receipt replay và claim — hai nhánh tách biệt

**A. Replay lookup (read-only):**
1. Xác thực auth.uid() khác NULL.
2. Khóa Organization và actor Membership theo §25.1; yêu cầu Organization active và actor Membership active.
3. Tra Receipt theo (organization_id, mutation_id).
4. Nếu Receipt đã final: xác minh actor_user_id, operation code và fingerprint server-side. Nếu không khớp, từ chối mà không tiết lộ result.
5. Nếu khớp: không yêu cầu write permission cũ; kiểm tra read permission hiện tại. Theo chính sách đã chấp thuận, đủ toàn bộ read permissions mới trả snapshot đầy đủ; thiếu bất kỳ quyền nào chỉ trả acknowledgement tối thiểu.
6. Replay không cập nhật business rows, không tăng row_version, không phát Change Feed event và không tạo Receipt mới.

**B. Mutation mới:**
1. Nếu replay lookup không tìm thấy Receipt, tiếp tục khóa assignment/Role/Role Permission theo §25.1.
2. Xác minh write permission trong cùng transaction; không dùng has_org_permission() STABLE hiện tại như authorization lock.
3. Chuẩn hóa payload và dựng fingerprint từ dữ liệu server đã xác thực.
4. Claim unique key (organization_id, mutation_id); chỉ request claim thành công được thực hiện side effect.
5. Nếu claim thua do request đồng thời: đọc Receipt ở statement tiếp theo, xác minh actor/operation/fingerprint và đi theo nhánh replay. Không chạy side effect lần hai.
6. Nếu write permission bị deny sau lần lookup đầu: thực hiện recheck Receipt an toàn trước khi trả lỗi. Chỉ replay nếu Receipt final cùng actor/operation/fingerprint đã thực sự tồn tại; tuyệt đối không claim hoặc thực hiện mutation trong nhánh deny.
7. Business mutation, row_version, counter, events và Receipt final cùng commit/rollback.

**Điều kiện isolation cần xác minh:** flow INSERT ... ON CONFLICT DO NOTHING rồi SELECT Receipt ở statement kế tiếp được thiết kế theo READ COMMITTED. Nếu function/transaction chạy isolation khác, phải xác định cách xử lý serialization failure và retry; không giả định statement sau luôn nhìn thấy transaction vừa commit. Không dùng exception unique violation rồi tiếp tục trong transaction đã bị abort.

### 25.3 Bảng operation và fingerprint cho Member RPC

Các operation code dưới đây là **đề xuất ổn định**, không dùng tên SQL function làm operation code. UUID mutation ID do client tạo một lần cho một logical intent; khi timeout/unknown outcome phải replay cùng ID và cùng payload, không tạo ID mới.

| RPC intent | Operation code đề xuất | Fingerprint tối thiểu do server dựng | Kết quả/event |
|---|---|---|---|
| Tạo/finalize membership | member.create | organization, actor, target auth user đã được Invite Saga xác minh, role code, invite operation ID | applied hoặc duplicate/no_change; membership event nếu tạo mới |
| Đổi role | member.role.change | organization, actor, target member, role code hiện tại, role code đích | applied hoặc no_change; role-change event nếu thực sự đổi |
| Suspend/reactivate | member.status.change | organization, actor, target member, status hiện tại/đích | applied hoặc no_change; status event nếu đổi |
| Remove | member.remove | organization, actor, target member, target role/state đã xác thực | applied hoặc no_change; tombstone nếu xóa |
| Self-activation | member.self.activate | organization, actor/auth.uid, target membership, trạng thái invited, email-confirmed condition | applied hoặc no_change; activation event nếu đổi |

Fingerprint phải bind operation code, organization scope, actor scope, target identity, toàn bộ trường nghiệp vụ đã chuẩn hóa, role/status đích và expected version/revision nếu có. Với Invite Saga, bind operation ID nội bộ đã được xác minh; không đưa email thô, token, invite URL hay Auth metadata vào event payload. Client không được cung cấp fingerprint, affected refs hoặc read permission list làm căn cứ server.

Nếu một intent cùng mutation ID nhưng khác operation, target hoặc payload, phải từ chối key reuse; không diễn giải thành mutation mới. Nếu operation trả no_change, lưu Receipt no_change nhưng không tạo event giả.

### 25.4 Membership Change Feed — event contract cần chốt

Đề xuất một aggregate roster thuộc organization, với event schema chung thay vì mỗi RPC tự tạo JSON riêng. Các operation dưới đây là tên dự kiến, chưa được duyệt cuối:

| Thay đổi | Event code đề xuất | Payload allowlist tối thiểu |
|---|---|---|
| Membership được tạo | membership.created | membership_id, role_code, status |
| Membership được kích hoạt | membership.activated | membership_id, status |
| Membership đổi trạng thái | membership.status_changed | membership_id, old_status, new_status |
| Membership đổi role | membership.role_changed | membership_id, old_role_code, new_role_code |
| Membership bị xóa | membership.removed | tombstone: membership_id, organization scope, event identity/cursor, operation |

Không đưa email, phone, Auth user metadata/ID, invite URL, access/refresh token hoặc thông tin xác thực vào payload Change Feed. Nếu UI roster cần email hiển thị, phải thiết kế một read RPC riêng với users.view, allowlist và disclosure policy; không mở rộng payload feed ngầm.

Mỗi event cần schema field thống nhất: event_id, organization_id, cursor, aggregate_type, aggregate_id, operation, revision/version nếu có, required_permission, payload, created_at. Tên field và kiểu dữ liệu cuối cùng phải khớp draft schema trước khi tạo migration.

- Quyền xem roster là users.view; không suy ra từ users.manage.
- Role catalog nếu cần đồng bộ phải có quyết định riêng về roles.view; không mặc định roster permission cho phép đọc toàn bộ role/permission catalog.
- Membership/Role chưa có row_version contract thì phải dùng revision/event sequence riêng hoặc chỉ dựa event cursor; không tự giả định row_version đã tồn tại.
- Remove phải ghi tombstone trước khi DELETE/cascade trong cùng transaction; tombstone không có FK tới membership đã bị xóa.
- Audit quản trị append-only vẫn riêng biệt, có actor/action/target/reason/time; Change Feed không thay thế audit.
- Event bị lọc quyền phải tuân scanned_through_cursor contract của Change Feed; không để client kẹt cursor hoặc nhận payload ngoài capability.

### 25.5 Thu hồi quyền và cache Local — điều kiện cho roster sync

Change Feed permission filtering không tự thu hồi dữ liệu đã tải xuống trước đó. Trước khi bật roster sync hoặc bất kỳ feed nào có dữ liệu theo permission, cần thiết kế authorization revision/epoch hoặc control event để client nhận biết visibility scope thay đổi.

Khi quyền users.view bị thu hồi, client phải ngừng hiển thị và xử lý cache roster theo chính sách purge/retention đã chốt. Khi Membership suspended/removed hoặc Organization inactive, client phải khóa tenant session và không tiếp tục mở cache như thể quyền hiện tại vẫn còn.

Thiết bị offline không thể nhận revoke ngay. Do đó phải chốt chính sách: khi reconnect phải re-auth/kiểm tra authorization revision trước khi mở cache tenant; thời hạn đọc cache offline và cách xử lý thiết bị không quay lại cần được quy định rõ. Điều này không thay đổi nguyên tắc hiện hành: offline chỉ đọc cached snapshots, không business write.

### 25.6 Test matrix tối thiểu trước SQL

- Actor và target Membership khóa ngược thứ tự ở hai request; kết quả không deadlock.
- Change-role đồng thời suspend/remove target; chỉ một transition hợp lệ commit.
- Permission revoke/Role deactivate đồng thời member mutation; mutation đã authorize giữ điểm hiệu lực theo lock, request đến sau revoke bị deny.
- Organization deactivate đồng thời create/change/remove/replay; kết quả tuân trạng thái và lock boundary.
- Replay Receipt sau revoke write; actor khác, fingerprint khác, organization khác bị deny.
- Receipt commit giữa lookup đầu và permission-denied branch; recheck chỉ replay, không chạy mutation lần hai.
- Hai request cùng mutation ID: một execution; request thua nhận cùng kết quả qua replay.
- Request đầu rollback: request sau có thể claim và thực hiện.
- no_change không tăng revision/cursor và không phát event giả.
- Remove ghi tombstone và event trước cascade; client nhận được tombstone qua nhiều page.
- Roster event thiếu users.view bị lọc nhưng scan cursor vẫn tiến; không lộ payload.
- Revoke users.view làm Local ẩn/purge cache theo policy; offline device phải reauthorize trước khi mở cache khi reconnect.
- Kiểm thử Auth confirmation/self-activation không có trigger ghi membership và không tạo deadlock với Organization/Membership locks.

### 25.7 Ranh giới

Mục §25 là contract thiết kế đề xuất để chuẩn hóa; không phải phê duyệt triển khai. Chưa sửa các mục §21/§24 cũ, chưa tạo SQL draft/migration, chưa sửa Edge Function/client/Dexie, chưa chạy SQL/RPC và chưa thay đổi Supabase Test/Production. Trước executable SQL cần cross-review lại §21, §24, Foundation §30 và Change Feed schema theo contract này; các operation/event code phải được chốt rõ ràng.
