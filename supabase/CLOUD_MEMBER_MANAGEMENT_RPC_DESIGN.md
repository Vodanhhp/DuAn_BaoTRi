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


## 26. Hợp nhất lock order và ranh giới Change Feed sau cross-review (19/11/2026)

Trạng thái: **chuẩn hóa thiết kế; chưa phải phê duyệt SQL hoặc cutover**. Mục này giải quyết hai điểm chưa nhất quán giữa §§13, 24, 25 của tài liệu này với Shared Receipt và Change Feed design.

### 26.1 Ranh giới roster: chưa phát Change Feed event

Quyết định sản phẩm tại §13 vẫn có hiệu lực: **chưa đưa roster vào Change Feed**.

Do đó, trong giai đoạn hiện tại:
- Member create/finalize, role change, status change, remove và self-activation vẫn phải có Shared Receipt cho mutation DB đã commit, theo operation code/fingerprint được chốt.
- Các thao tác này phải ghi audit quản trị append-only riêng theo chính sách audit; audit không thay thế Receipt.
- Không insert membership event vào `organization_changes`, không cấp cursor cho roster, không đồng bộ roster qua business Change Feed.
- §25.4 chỉ là phác thảo cho một tính năng tương lai; không phải scope triển khai. Các event code `membership.*` và payload roster chưa được duyệt, không được dùng trong SQL migration hiện tại.
- Roster chỉ được đọc qua read RPC riêng có authorization `users.view`; `users.manage` không tự suy ra quyền đọc. Không tự mở rộng roster cache/sync.
- Nếu sau này sản phẩm yêu cầu roster sync, phải có quyết định riêng về capability, disclosure fields, authorization revision, revoke/purge Local cache, offline cache expiry, cursor và retention trước khi thêm feed.

Vì vậy, các câu trong §24.4 nói Receipt + Change Feed cho Member RPC được hiểu lại là **Receipt + audit**, không phải business Change Feed. §25.3 operation code/fingerprint vẫn là thiết kế cần chốt; §25.4 được giữ làm tài liệu tham khảo tương lai nhưng không thuộc cutover.

### 26.2 Lock order — phân biệt Receipt lookup với Receipt claim

§25.1 liệt kê Receipt sau Role Permission, trong khi §25.2.A yêu cầu tra Receipt trước khi kiểm tra write permission để hỗ trợ replay sau revoke. Chuẩn hóa thành hai thao tác khác nhau:

**A. Replay lookup (read-only, không claim):**
1. Xác thực `auth.uid()`.
2. Khóa Organization và actor Membership theo thứ tự chuẩn; yêu cầu cả hai còn active.
3. Đọc Receipt theo organization + mutation ID. Đây là lookup read-only, không khóa business rows, không tạo pending Receipt và không phát side effect.
4. Nếu Receipt final tồn tại, xác minh actor, operation và fingerprint server-side; kiểm tra read permissions hiện tại rồi trả full snapshot hoặc acknowledgement tối thiểu theo policy đã được chấp thuận.
5. Nếu không có Receipt, tiếp tục nhánh mutation mới. Kết quả lookup không được xem là quyền cho phép ghi.

**B. Mutation mới (authorization và claim):**
1. Sau Organization + actor Membership, khóa target Membership/assignment/Role/Role Permission theo §25.1 và thứ tự ID ổn định.
2. Kiểm tra target state và write permission trong cùng transaction; revoke/deactivate phải dùng lock protocol tương thích.
3. Chuẩn hóa payload và dựng fingerprint hoàn toàn phía server.
4. Claim unique Receipt key `(organization_id, mutation_id)` sau authorization, trước business side effect và trước khi khóa business rows. Pending Receipt chỉ sống trong cùng transaction.
5. Nếu claim thua request đồng thời, đọc Receipt ở statement kế tiếp theo READ COMMITTED, xác minh actor/operation/fingerprint rồi replay; nếu claimant đầu rollback, request chờ có thể claim.
6. Nếu authorization bị deny nhưng Receipt có thể vừa commit sau lookup đầu, thực hiện một Receipt recheck read-only trong statement riêng trước khi trả deny. Chỉ replay nếu Receipt final khớp hoàn toàn; tuyệt đối không claim hoặc chạy mutation trong nhánh này.
7. Sau claim, khóa business rows theo table-rank/primary-key ổn định; thực hiện business write và row_version.
8. Nếu mutation tạo Change Feed event thuộc phạm vi được bật, khóa counter và ghi event cùng transaction. Member RPC hiện tại không tạo event roster theo §26.1.
9. Finalize Receipt và commit business write/audit/event (nếu có) trong cùng transaction; deferred assertion phải xác nhận Receipt final.

Receipt replay không cần khóa Receipt để sửa vì Receipt final bất biến. Không dùng SELECT thường ở bước preflight làm căn cứ bảo mật; mọi quyết định replay vẫn phải xác minh actor/fingerprint và active organization/membership trong transaction hiện tại.

### 26.3 Thứ tự khóa chuẩn được áp dụng

Giữ thứ tự tương đối tại §25.1, với diễn giải rõ:
1. Organization.
2. Actor/target Membership rows, khóa theo UUID tăng dần.
3. Member role assignments.
4. Role rows.
5. Role Permission rows.
6. Auth user row nếu Invite Saga thực sự cần; không gọi Auth Admin API/network khi đang giữ DB locks.
7. Receipt claim cho mutation mới (replay lookup read-only là nhánh riêng ở §26.2.A).
8. Business/target rows theo table-rank rồi primary key.
9. Asset Lease chỉ theo bridge contract riêng; chưa thuộc Member RPC cutover.
10. Organization Sync Counter và Change events chỉ cho mutation có feed event được bật; sau đó finalize Receipt.

Mọi writer/revoker của Organization, Membership, Role và Role Permission phải tuân thứ tự tương thích. Các FK cascade, trigger và implicit lock phải được rà soát; tài liệu thứ tự khóa không tự chứng minh deadlock-free.

### 26.4 Những điểm phải cập nhật trước executable SQL

- Sửa câu chữ §24.4 để thống nhất Receipt + audit, không yêu cầu membership Change Feed.
- Đánh dấu rõ §25.4 là future-only; không tạo event code/payload roster trong migration hiện tại.
- Đối chiếu lại Foundation Lock Matrix và Shared Receipt để dùng cùng hai nhánh Replay lookup / Mutation claim.
- Chốt operation code, fingerprint field allowlist, audit schema và read-permission requirements cho từng Member RPC.
- Kiểm thử permission revoke race, Receipt commit sau lookup đầu, cùng mutation ID đồng thời, target suspend/remove đồng thời, organization deactivate và Invite Saga recovery.
- Chỉ sau khi các contract trên nhất quán mới viết SQL migration riêng; vẫn phải review tĩnh và xin phép trước khi chạy trên Supabase Test.

### 26.5 Ranh giới an toàn

Chỉ bổ sung chuẩn hóa thiết kế trong tài liệu này. Không sửa §13 quyết định sản phẩm, không sửa SQL draft/migration, Edge Function, client hoặc Dexie; không chạy SQL/RPC, không thay đổi Supabase Test/Production, quyền hoặc dữ liệu.


## 27. Contract operation, fingerprint, Receipt disclosure và audit cho Member RPC (19/11/2026)

Trạng thái: **đề xuất chuẩn hóa để review; chưa phải SQL schema hoặc cutover approval**. Mục này chốt contract ở mức nghiệp vụ cho các Member RPC đã xác định tại §25.3, đồng thời giữ ranh giới Invite Saga/Auth API và roster Change Feed tại §26.

### 27.1 Operation code ổn định

Dùng đúng các mã sau, độc lập tên SQL function và không tái sử dụng cùng một mã cho intent khác:

| Intent | Operation code | Mutation ID |
|---|---|---|
| Finalize/tạo membership sau khi Invite Saga đã resolve Auth identity | `member.create` | UUID riêng cho lần finalize logical |
| Đổi role membership | `member.role.change` | UUID riêng cho lần đổi role |
| Suspend/reactivate membership | `member.status.change` | UUID riêng cho lần đổi status |
| Remove membership | `member.remove` | UUID riêng cho lần remove |
| User tự kích hoạt membership đã xác nhận email | `member.self.activate` | UUID riêng cho lần self-activation |

Không dùng Shared Receipt của `member.create` thay cho Invite Saga operation record. Auth invite/create là external side effect; Saga giữ `invite_operation_id` riêng. Chỉ bước finalize membership trong PostgreSQL dùng Shared Receipt, fingerprint bind invite_operation_id đã được server xác minh. Reset password/Auth Admin API không phải Member business mutation và không được giả làm Receipt của membership.

### 27.2 Fingerprint field allowlist — server-built

Mọi fingerprint đều do RPC dựng từ JWT, DB state và payload đã chuẩn hóa; client chỉ gửi mutation_id cùng các input nghiệp vụ được phép.

| Operation | Trường bắt buộc bind vào fingerprint |
|---|---|
| `member.create` | operation code; organization_id; actor auth.uid(); invite_operation_id đã xác minh; auth_user_id đã được Saga resolve; target role code; trạng thái khởi tạo do server suy ra từ email-confirmed state; schema/contract version |
| `member.role.change` | operation code; organization_id; actor; target membership_id; role code hiện tại đã đọc dưới lock; role code đích; trạng thái membership đã xác thực; schema/contract version |
| `member.status.change` | operation code; organization_id; actor; target membership_id; status hiện tại; status đích; schema/contract version |
| `member.remove` | operation code; organization_id; actor; target membership_id; status và role assignment hiện tại đã xác thực; schema/contract version |
| `member.self.activate` | operation code; organization_id; actor auth.uid(); target membership_id thuộc chính actor; status invited; email_confirmed_at do server đọc và xác minh; schema/contract version |

Quy tắc:
- Common scope luôn bind organization + actor + operation; target identity và mọi trường làm thay đổi kết quả phải được bind.
- Không bind giá trị do client tự khai là sự thật (actor ID, email-confirmed flag, role hiện tại, membership status, permission list).
- Không đưa email, phone, invite URL, token, Auth metadata, raw request headers hoặc dữ liệu không liên quan vào fingerprint.
- Chuẩn hóa enum theo canonical code; UUID về canonical representation; chuỗi theo quy tắc trim/case đã định nghĩa cho field đó; không tự lower-case display name. Các trường server-derived được đọc lại trong transaction/lock scope.
- Không có row_version cho Membership/Role assignment hiện tại; không giả định có expected_version. Dùng current state dưới row lock + fingerprint. Nếu sau này thêm revision, phải version hóa contract.
- Cùng organization + mutation_id nhưng khác operation/actor/fingerprint là key reuse và phải từ chối không side effect. Timeout/unknown outcome replay cùng mutation_id và cùng logical payload.
- `member.create` retry phải dùng cùng invite_operation_id và cùng mutation_id của finalize. Không tạo Auth invite mới chỉ vì response finalize bị mất.

### 27.3 Receipt read-permission và disclosure policy

Để tuân Shared Receipt all-or-nothing mà không làm lộ roster:

| Operation | Read permission codes gắn với snapshot | Full result được phép trả khi replay |
|---|---|---|
| `member.create` | `users.view` | Chỉ khi actor hiện còn users.view; nếu không chỉ acknowledgement tối thiểu |
| `member.role.change` | `users.view` | Chỉ khi actor hiện còn users.view; nếu không chỉ acknowledgement tối thiểu |
| `member.status.change` | `users.view` | Chỉ khi actor hiện còn users.view; nếu không chỉ acknowledgement tối thiểu |
| `member.remove` | `users.view` | Chỉ acknowledgement tối thiểu sau remove; không trả roster snapshot hoặc dữ liệu target đã xóa |
| `member.self.activate` | Không lưu roster read permission; result payload chỉ là acknowledgement self-scoped | Chỉ trả acknowledgement self-scoped; không trả roster hoặc thông tin thành viên khác |

- Write permission cho bốn thao tác quản trị là `users.manage`, được kiểm tra trong transaction. Đổi role membership không tự đòi `roles.manage`; quyền đó dành cho quản trị Role/Permission catalog, trừ khi policy sản phẩm sau này quyết định khác.
- `member.self.activate` không dùng `users.manage`; server bắt buộc auth.uid() = auth user sở hữu membership, organization active, membership invited và email đã xác nhận.
- `users.manage` không thay thế `users.view`. Có manage-only nhưng không view thì vẫn có thể thực hiện mutation được phép, song Receipt replay chỉ nhận acknowledgement.
- Receipt mismatch hoặc actor khác không được tiết lộ có Receipt hay result nào.
- `member.remove` không trả affected snapshot có chứa membership đã xóa. Receipt chỉ trả trạng thái xử lý tối thiểu cùng operation identity an toàn.

### 27.4 Audit contract — độc lập Shared Receipt

Mỗi state transition quản trị thành công ghi một audit row append-only trong cùng transaction với Membership/Role assignment mutation và Shared Receipt. Audit không phải Change Feed, không làm tăng organization sync cursor và không mang roster payload tới Local.

Schema logic đề xuất (tên bảng/cột chỉ là contract, chưa chốt DDL):
- `audit_id`: UUID bất biến.
- `organization_id`: tenant scope.
- `actor_user_id`: actor lấy từ auth.uid(); với Saga recovery lưu actor thực hiện bước adoption/finalize và giữ actor gốc trong Saga operation record.
- `action_code`: một trong operation code ở §27.1; adoption dùng action riêng `member.invite.adopt`.
- `target_membership_id`: nullable; giữ giá trị dạng scalar, không FK cascade tới membership để audit còn nguyên sau remove.
- `invite_operation_id`: nullable, chỉ tham chiếu Saga operation đã xác minh; không lưu email.
- `mutation_id`: nullable với thao tác external/Saga chưa có Shared Receipt; khi có Receipt thì liên kết đúng mutation.
- `before_state` / `after_state`: JSONB allowlist tối thiểu, chỉ role code/status cần audit; không snapshot toàn bộ row.
- `reason`: nullable cho thao tác thường; bắt buộc cho adoption theo quyết định đã chốt. Không ghi email/PII hoặc token vào reason.
- `outcome`: `applied` cho transition đã commit; không tạo audit transition giả cho no_change.
- `occurred_at`: timestamp do database gán.
- `schema_version`: version của audit payload.

Bất biến:
1. Audit append-only; không UPDATE/DELETE từ client hoặc RPC nghiệp vụ thông thường. Retention/archive là quy trình riêng, cần phê duyệt và không được cascade theo membership.
2. Audit ghi cùng transaction với state transition và Receipt; nếu audit insert thất bại thì mutation rollback.
3. Audit không thay thế Receipt: Receipt phục vụ idempotency/recovery; audit phục vụ truy vết actor/action/target/before-after/reason/time.
4. Không đưa email, phone, Auth metadata, invite URL, token hoặc result payload nhạy cảm vào audit. PII cần cho Invite Saga nằm trong bảng operation riêng, có RLS/grants/retention riêng.
5. Adoption ghi audit riêng với actor adopter, operation ID, reason bắt buộc; không đổi actor gốc, fingerprint hoặc Receipt gốc.
6. Self-activation ghi audit lifecycle tối thiểu trong cùng transaction; no_change idempotent không tạo audit transition mới.
7. Permission denial/validation failure không tạo audit state-transition row; nếu cần security telemetry thì dùng hệ thống log bảo mật riêng, không trộn vào audit committed mutation.

### 27.5 Bảng quyết định tổng hợp

| RPC intent | Write authorization | Receipt | Audit | Change Feed |
|---|---|---|---|---|
| member.create/finalize | users.manage | Shared Receipt | Có khi membership tạo mới | Không |
| member.role.change | users.manage | Shared Receipt | Có khi role thực sự đổi | Không |
| member.status.change | users.manage | Shared Receipt | Có khi status thực sự đổi | Không |
| member.remove | users.manage | Shared Receipt | Có khi membership thực sự bị remove | Không |
| member.self.activate | Self identity + email confirmed; không cần users.manage | Shared Receipt | Có khi invited → active | Không |

### 27.6 Cổng review còn lại

Trước SQL phải xác nhận tên/cột thật của Saga operation table, Role code và status enum; chốt chính xác Receipt result payload tối thiểu; rà soát audit table hiện có để tránh tạo bảng trùng; xác định RLS, function owner, grants, retention và khả năng audit trigger/insert cùng transaction. Mục này chưa cho phép tự tạo audit table nếu repository đã có audit contract khác.

Không sửa migration, draft SQL, Edge Function, UI hoặc Dexie; không chạy SQL/RPC và không thay đổi Supabase Test/Production.


## 27.7 Sửa nguyên tắc fingerprint để replay sau commit luôn ổn định

Đây là điều chỉnh bắt buộc cho §27.2; nếu có khác biệt, **§27.7 được ưu tiên**.

Không đưa trạng thái mutable được đọc từ DB sau khi mutation vào fingerprint. Ví dụ role/status trước mutation sẽ khác sau commit; nếu retry dựng fingerprint từ live state mới, cùng một logical request có thể bị hiểu nhầm là key reuse. Fingerprint phải được dựng từ request intent ổn định và input đã chuẩn hóa; state hiện tại chỉ là precondition cho nhánh mutation mới.

Bảng fingerprint chuẩn hóa:

| Operation | Fingerprint ổn định |
|---|---|
| `member.create` | operation; organization; actor; invite_operation_id; auth_user_id đã được Saga resolve; requested role code; resolved initial status đã được ghi bất biến trong Saga operation; contract version |
| `member.role.change` | operation; organization; actor; target membership_id; requested target role code; optional expected-current-role precondition nếu client gửi; contract version |
| `member.status.change` | operation; organization; actor; target membership_id; requested target status; optional expected-current-status precondition nếu client gửi; contract version |
| `member.remove` | operation; organization; actor; target membership_id; optional expected-state precondition nếu client gửi; contract version |
| `member.self.activate` | operation; organization; actor auth.uid(); target membership_id; self-activation intent; contract version |

Quy tắc thực thi:
1. Fingerprint được canonicalize từ cùng một request intent; cùng mutation_id + cùng intent luôn tạo cùng fingerprint trước và sau commit.
2. Optional expected-current-role/status/state là precondition do client gửi từ snapshot trước đó, không phải sự thật được tin cậy. Server chỉ kiểm tra precondition trong nhánh mutation mới, sau khi lấy đủ locks. Không có expected version thì server vẫn kiểm tra state transition hợp lệ dưới lock.
3. Khi replay lookup tìm thấy Receipt final, so fingerprint với intent request đã chuẩn hóa; không đọc live role/status để dựng lại fingerprint và không áp dụng precondition lần nữa.
4. Khi chưa có Receipt, server mới khóa target, đọc state hiện tại và xác nhận transition/precondition. State không khớp thì trả conflict/validation theo contract; không ghi audit transition hoặc business mutation.
5. `member.create` phải lấy resolved initial status bất biến từ Invite Saga operation record; không suy lại status từ trạng thái email confirmation hiện tại ở mỗi retry.
6. `member.self.activate` bind intent self-activation và actor/target identity; email-confirmed condition là điều kiện server kiểm tra ở nhánh mutation mới, không bind timestamp có thể làm thay đổi cách nhận diện cùng request.
7. Không có row_version cho Membership hiện tại; không giả lập expected version bằng cách nhét live status/role vào fingerprint. Nếu cần optimistic concurrency mạnh hơn, phải bổ sung revision contract riêng.

Test bắt buộc bổ sung: cùng mutation_id retry sau role change, sau status change, sau remove và sau self-activation phải tìm đúng Receipt cũ; cùng ID nhưng target hoặc requested target role/status khác phải bị reject key reuse.


## 28. Static inventory audit schema và Invite Saga persistence (19/11/2026)

Trạng thái: **đã đối chiếu repository hiện tại; chỉ ghi nhận phát hiện và yêu cầu thiết kế, chưa tạo DDL**.

### 28.1 Kết quả tìm kiếm audit hiện có

Đã tìm trong repository các dấu hiệu `audit_id`, `audit_log`, `audit_events`, `activity_log` và đọc các migration liên quan Member/Role:
- `20261117000500_roles_and_permissions.sql`
- `20261117001300_member_management.sql`
- `20261117001400_remove_org_member.sql`

Kết quả hiện tại: **chưa tìm thấy bảng audit quản trị dùng chung hoặc bảng audit membership đã được triển khai trong migration/repository**. Các đề cập audit trong tài liệu là yêu cầu/đề xuất thiết kế, chưa phải schema đang chạy. Đây là kết luận static theo repository đã rà soát, không phải khẳng định database Supabase không có bảng ngoài repo.

Do chưa có schema audit hiện hữu được chứng minh, không được tuyên bố Member RPC có thể ghi vào audit table hiện tại. Cần thiết kế một bảng audit chuyên biệt hoặc một audit framework dùng chung sau khi inventory toàn bộ schema Test xác nhận không có đối tượng tương đương.

### 28.2 Hiện trạng Invite Saga

`organization_member_invite_operations` mới được đề xuất trong §§15.1–15.8; chưa thấy migration/DDL triển khai. Các field thiết kế đã nhắc tới gồm organization/operation identity, actor gốc, normalized email, requested role, state, auth_user_id khi resolve, attempts/lease/recovery và timestamps.

Tách đúng hai lớp:
- Saga operation: theo dõi workflow nhiều transaction + Auth Admin API, bao gồm trạng thái chưa rõ, retry, adoption và manual recovery.
- Shared Receipt: chỉ ghi nhận kết quả cuối của transaction PostgreSQL finalize membership đã commit.

Không gộp Saga operation vào Receipt; không coi Auth invite thành một phần atomic của transaction DB.

### 28.3 Phân loại dữ liệu và giới hạn truy cập Saga

| Dữ liệu | Phân loại | Quy tắc |
|---|---|---|
| organization_id, operation_id | Tenant/operation identity | Dùng composite key và tenant boundary |
| actor_user_id gốc | Security/audit identity | Bất biến; không đổi khi adoption |
| adopted_by, reason | Security/audit | Ghi actor adopter và reason bắt buộc |
| normalized_email | PII | Chỉ RPC/service nội bộ; không trả client, Receipt, Change Feed, audit payload hoặc error |
| auth_user_id | Internal identity | Chỉ lưu khi Auth identity được Saga resolve; không trả roster/feed |
| requested role/status, state | Business workflow | Validate enum/transition phía server |
| fingerprint | Integrity/security metadata | Server-built; không chứa email/token/PII không cần thiết |
| attempts, lease, retry_after, timestamps | Operational metadata | Không cho client ghi trực tiếp; không log bí mật |

Bắt buộc: RLS bật; revoke trực tiếp SELECT/INSERT/UPDATE/DELETE khỏi PUBLIC/anon/authenticated; mọi đọc/ghi qua RPC được kiểm soát hoặc service-only Edge Function. Không cấp quyền rộng cho toàn bộ authenticated chỉ vì UI Admin cần thao tác. RPC phải xác thực actor hiện tại và quyền users.manage cho create/adoption/recovery theo state; operation gốc không bị đổi actor.

Email có thể cần lưu để xử lý Auth invite, nhưng phải xác định retention, xóa/ẩn danh sau khi Saga terminal và hết cửa sổ retry/recovery, backup retention, quyền service operator và quy trình export. Không xóa unresolved operation. Không ghi email vào audit before/after, Shared Receipt, Change Feed, client error hoặc telemetry.

### 28.4 Audit schema cần thiết kế — không tạo trùng và không cascade mất lịch sử

Do chưa tìm thấy audit table đã triển khai, contract §27.4 vẫn là đề xuất. Trước khi tạo DDL cần:
1. Inventory schema thực tế của Supabase Test và mọi migration/extension liên quan audit để xác nhận không có bảng tương đương ngoài repository.
2. Chọn rõ phạm vi: audit membership riêng hay audit organization-wide dùng chung. Nếu dùng chung, cần schema version và action namespace; không tạo bảng riêng trùng chức năng.
3. Lưu audit append-only trong cùng transaction với state transition và Receipt; audit insert failure phải rollback mutation.
4. Giữ target membership ID dưới dạng scalar không FK cascade; không để DELETE membership xóa audit. Organization retention/deletion phải có policy riêng, không cascade âm thầm.
5. Không lưu email/phone/Auth metadata/token/invite URL; before/after chỉ allowlist role code/status. Adoption reason bắt buộc và phải có giới hạn độ dài/PII policy.
6. Không audit no_change như một state transition. Permission denial/validation failure thuộc security telemetry riêng nếu cần.
7. RLS/grants: không client SELECT trực tiếp. Cần thiết kế Admin read-audit RPC có permission riêng (đề xuất `users.view` không mặc nhiên cho phép xem audit; cần quyết định permission code `users.audit.view` hoặc `audit.view`). Không cấp quyền đọc audit cho Viewer/Technician mặc định.
8. Retention/archive có kiểm soát; không UPDATE/DELETE bởi business RPC; operator access phải được audit.

### 28.5 Các vấn đề schema hiện hữu ảnh hưởng cutover

- Migration 005 hiện khai báo PK `(organization_id, member_id, role_id)` cho `member_roles`, chưa có unique constraint `(organization_id, member_id)`; do đó schema hiện tại vẫn cho phép nhiều role assignment/membership. Unique một role chỉ được thêm sau preflight và migration riêng fail-closed.
- Migration 013 `admin_create_org_membership` tạo membership + assignment atomic nhưng chưa ghi Shared Receipt/audit, chưa khóa Organization/Role theo contract mới, và khóa `auth.users` sau khi kiểm tra Organization/Role. Trigger `sync_auth_user_profile` còn tự active invited memberships khi email confirmation.
- Migration 013 role/status RPC và migration 014 remove RPC hiện service_role-only, nhận actor ID từ tham số, chưa transaction-authorize actor bằng caller JWT. Remove cascade assignment; audit target không được FK cascade theo membership.
- Migration 013/014 hiện chưa ghi audit. Không được coi các writer cũ đã tuân audit contract mới; phải thay/cutover writer đồng bộ trước khi bật audit bắt buộc.
- `profiles.email` được đồng bộ từ `auth.users`; đây là PII. Không sao chép sang Saga log rộng, audit, Receipt hoặc Change Feed.

### 28.6 Cổng tiếp theo

1. Kiểm tra schema Supabase Test read-only để inventory audit object và RLS/grants thực tế; không chạy DDL.
2. Chốt permission đọc audit riêng, scope Admin-only và disclosure fields.
3. Chốt retention PII của Saga, unresolved retention, completed terminal retention và backup window.
4. Thiết kế schema DDL draft cho audit + Saga operation trong cùng review nhưng giữ hai bảng/identity riêng.
5. Cross-review lock order: Organization → actor/target Membership → operation/audit rows theo thứ tự ổn định; không tạo lock cycle với Auth trigger. Audit insert là cuối transaction sau khi state transition đã được xác thực, nhưng vẫn cùng transaction.
6. Sau static review mới viết migration draft; chưa chạy SQL/RPC và cần phê duyệt riêng trước khi áp dụng Test.

Không sửa migration 005/013/014, không sửa Edge Function/client, không tạo DDL hoặc thay đổi Supabase.


## 29. Supabase Test schema inventory — kết quả đọc trực tiếp (19/11/2026)

**Nguồn:** Supabase project `BAOTRI-Mini-Test`, ref `oyzhxgzltpdebpymuicb`, trạng thái ACTIVE_HEALTHY, PostgreSQL 17.12. Các kết quả dưới đây là snapshot tại thời điểm kiểm tra, chỉ dùng truy vấn SELECT/catalog metadata; không DDL, không ghi dữ liệu.

### 29.1 Audit và Invite Saga

- Không tìm thấy bảng nghiệp vụ trong schema được kiểm tra có tên/ý nghĩa audit, invite, member operation, ngoài bảng Auth và các bảng receipt/mutation được liệt kê bên dưới.
- Có `auth.audit_log_entries`, comment hệ thống: `Auth: Audit trail for user actions`. Đây là audit của Supabase Auth, không phải audit membership/organization của BAOTRI Mini. Không tái sử dụng bảng này làm audit nghiệp vụ.
- Không tìm thấy `organization_member_invite_operations` hoặc bảng Invite Saga tương đương trong schema Test.
- Không tìm thấy bảng audit quản trị/member riêng trong Test.
- Kết luận chỉ áp dụng project Test và snapshot hiện tại; không suy rộng sang Production hoặc database khác.

### 29.2 Receipt/mutation hiện có — không phải audit

| Bảng | RLS | Policy tìm thấy | Grants quan sát được |
|---|---|---|---|
| `public.asset_import_mutations` | enabled | Không có policy trong `pg_policies` | postgres, service_role |
| `public.asset_mutation_receipts` | enabled | Không có policy trong `pg_policies` | postgres, service_role |
| `auth.audit_log_entries` | enabled | Không có policy phù hợp trong truy vấn | postgres |

Metadata grants không cho thấy anon/authenticated được cấp quyền trực tiếp trên hai bảng mutation/receipt. RLS đang bật nhưng `relforcerowsecurity=false`; service_role và owner/bypass roles không bị RLS giới hạn như client thường. Đây là cấu trúc private phù hợp với vai trò internal ledger hiện tại, nhưng không chứng minh các RPC/Edge Function xung quanh đã được authorize đúng.

Hai bảng asset receipt/mutation có schema khác mục tiêu Member:
- `asset_import_mutations`: idempotency ledger cho import tài sản.
- `asset_mutation_receipts`: receipt cho asset mutation được lease bảo vệ.

Không dùng lại hai bảng này làm Shared Receipt Member hoặc audit chung; không đổi semantics asset-specific trong Member cutover.

### 29.3 Hệ quả thiết kế đã chốt

1. Cần thiết kế audit nghiệp vụ riêng hoặc framework audit dùng chung mới sau khi inventory Test; không dùng `auth.audit_log_entries`.
2. Cần thiết kế Invite Saga operation table mới; không có bảng sẵn để tái sử dụng.
3. Giữ Saga PII và Receipt/audit tách biệt như §28.
4. Audit đọc phải có permission riêng được chốt trước; không suy ra từ `users.view`.
5. Không tạo migration ở bước này. Kết quả schema inventory chỉ xác nhận khoảng trống thiết kế, chưa cấp quyền triển khai DDL.
6. Test schema đã quan sát không có policy cho hai bảng asset mutation/receipt; grants metadata chỉ hiện postgres/service_role. Không thay đổi RLS/grants các bảng này trong phạm vi Member audit.

### 29.4 Phạm vi và giới hạn

- Đã kiểm tra catalog table/view names, RLS flags, policies liên quan và table grants cho tên audit/invite/member-operation/receipt/mutation/change.
- Kết quả `list_migrations` qua API trả danh sách rỗng; không dùng kết quả này để kết luận migration chưa chạy vì các bảng nghiệp vụ đang tồn tại. Cần đối chiếu migration history riêng nếu công việc sau phụ thuộc vào nó.
- Chưa kiểm tra nội dung dữ liệu Auth audit, không đọc email/PII, không kiểm tra Production.


## 30. DDL draft 021 — Member audit và Invite Saga (19/11/2026)

Tạo file nháp: supabase/drafts/021_member_audit_and_invite_saga_DRAFT.sql.

**Trạng thái:** DDL draft only; chưa phải migration, chưa chạy trên Supabase. Không sửa migration hiện hữu, Edge Function hoặc client.

### 30.1 Cấu trúc được đề xuất

1. organization_member_invite_operations: một row cho mỗi logical invite, PK (organization_id, operation_id), giữ actor gốc, normalized_email (PII), role code, fingerprint, state machine, resolved Auth user, initial membership status bất biến theo contract, attempt/lease/retry metadata, adoption metadata, membership/Receipt scalar references và version.
2. organization_member_audit_events: append-only audit cho Member lifecycle và Saga adoption/state transition; target membership ID là scalar không FK/cascade. Saga operation reference dùng composite FK RESTRICT để không xóa operation history khi audit còn tham chiếu.
3. Trigger từ chối UPDATE/DELETE audit; RLS bật; không có policy đọc client; revoke direct table privileges khỏi PUBLIC/anon/authenticated/service_role. Mọi truy cập phải qua RPC hẹp được review.

### 30.2 Đối chiếu schema Test

- Role codes hiện có trong Test: admin, technician, viewer; draft chỉ cho phép technician/viewer ở invite, đúng contract.
- organization_members hiện có các cột id, organization_id, user_id, role, status, invited_by_user_id, created_at, updated_at.
- Test có pgcrypto; draft dùng gen_random_uuid() cho audit ID. Đây là metadata xác nhận, không phải dependency cần bật thêm.
- organizations(id), profiles(id), auth.users(id) và composite organization/member identity đã được xác nhận có trong Test. Draft không tạo FK từ target_membership_id hoặc membership_id về organization_members, để lịch sử không bị cascade/mất khi remove.
- Không tái sử dụng auth.audit_log_entries, asset_import_mutations hoặc asset_mutation_receipts.

### 30.3 Những điểm cố ý chưa tự quyết

- **Audit scope:** draft hiện đặt tên và phạm vi Member-specific; chưa phải framework audit organization-wide.
- **Audit read permission:** chưa tạo read RPC hoặc cấp quyền đọc. Cần chốt users.audit.view hay audit.view; không mặc định dùng users.view.
- **Retention:** không tạo TTL, cleanup hay archive. Phải chốt retention audit, Saga terminal/unresolved, PII deletion/anonymization và backup window.
- **Adoption:** field hỗ trợ Admin khác tiếp quản, nhưng policy cho phép adoption vẫn là quyết định cần phê duyệt.
- **Worker:** draft có attempt/lease fields nhưng chưa triển khai worker, RPC claim hoặc attempt history table; giai đoạn đầu manual recovery hay worker vẫn cần chốt.
- **PII encryption:** chưa giả định pgcrypto encryption; cần key management riêng nếu quyết định mã hóa email at rest.
- **System actor:** audit draft thêm actor_kind=user/system; system transition có actor_user_id NULL. Đây là mở rộng so với contract user-actor ban đầu, cần cross-review và xác nhận semantics trước khi dùng.

### 30.4 Giới hạn DDL và các việc bắt buộc trước promote

- DDL chỉ tạo hai bảng, index, RLS bật, revoke trực tiếp và append-only trigger. Không có RPC, client read policy, worker, state transition function, audit read function hoặc retention job.
- resolved_initial_status, actor gốc, fingerprint và state/version transition phải được bảo vệ bất biến/compare-and-set trong RPC; DDL hiện chỉ có CHECK cơ bản, chưa tự enforce toàn bộ state machine.
- Audit before_state/after_state có CHECK allowlist chỉ cho role_code, membership_status và saga_status với enum hợp lệ; không cho phép key tùy ý. reason vẫn là text cần RPC/operational sanitization, tuyệt đối không đưa PII/token vào reason.
- Append-only trigger chặn UPDATE/DELETE row; không thay thế quyền vận hành đối với owner/superuser hoặc TRUNCATE. Grants vận hành phải được review riêng.
- Direct privileges bị revoke khỏi service_role; Edge Function không được ghi bảng trực tiếp. Service orchestration cần RPC SECURITY DEFINER purpose-specific với EXECUTE grants hẹp.
- FK RESTRICT tới Auth/Profile/Organization có thể chặn xóa identity/tenant; cần xác nhận lifecycle/retention policy và quy trình archive trước production.
- Cần review kỹ SQL, test syntax/constraints trên PostgreSQL clone, concurrency, RLS, function owner, lock order, transaction rollback và PII leakage trước khi tạo migration thật.

Không áp dụng SQL. Không có thay đổi database.


## 31. Static review DDL 021 — vòng 1 (19/11/2026)

Đã rà soát file `supabase/drafts/021_member_audit_and_invite_saga_DRAFT.sql` và chỉnh các ràng buộc ngay trong draft:

- Adoption phải có adopter khác actor gốc, reason không rỗng sau trim và timestamp; Auth-created flag không được khai báo khi chưa có auth_user_id.
- Audit reason nếu có phải không rỗng sau trim; adoption bắt buộc user actor + reason hợp lệ.
- `actor_kind=system` chỉ dành cho `member.invite.state.change`; actor user luôn cần actor_user_id.
- Các membership lifecycle actions (create/role/status/remove/self.activate) bắt buộc target_membership_id và mutation_id.
- Các audit create/adopt/invite-state-change bắt buộc invite_operation_id.
- JSONB before/after key allowlist đã được làm null-safe bằng COALESCE; key có JSON null không thể vượt CHECK enum.
- Giữ nguyên tách Saga/Receipt/Audit, RLS private và không tạo policy client.

### 31.1 Những điểm vẫn phải xử lý ở RPC/runtime

1. SQL CHECK không thể bảo đảm state machine hợp lệ theo thứ tự; RPC phải dùng row lock hoặc compare-and-set version, kiểm tra transition graph và cập nhật updated_at/version nhất quán.
2. Bảo vệ bất biến actor gốc, request_fingerprint, organization_id, operation_id, normalized_email và resolved_initial_status sau khi tạo. Chỉ cho phép các cột state/attempt/adoption được thay đổi theo RPC cụ thể.
3. reason là text tự do; RPC phải chặn email, token, secret và PII; không thể dựa vào CHECK độ dài.
4. Không có attempt-history table: current_attempt_id/attempt_count chỉ là trạng thái hiện tại. Nếu cần forensic retry history, thiết kế bảng append-only riêng.
5. Audit trigger chặn UPDATE/DELETE nhưng không phải cơ chế chống owner/superuser/TRUNCATE. Giới hạn owner, grants và vận hành phải được review.
6. Trigger updated_at chưa có; RPC phải set updated_at rõ ràng. Không cho client update trực tiếp.
7. FK RESTRICT tới profiles/auth.users/organizations có thể cản trở xóa identity/tenant; cần retention/archive lifecycle.
8. Chưa kiểm chứng cú pháp bằng PostgreSQL parser hoặc chạy thử; file vẫn là static draft.

**Kết luận vòng 1:** các điểm ràng buộc SQL nhìn thấy được đã được gia cố; chưa đủ điều kiện promote thành migration. Cần tiếp tục review RPC authorization, transition matrix, lock order, atomic audit + Shared Receipt, PII handling và retention.


## 32. Ma trận State Transition và kiểm thử RPC Invite Saga (19/11/2026)

Trạng thái: **hợp đồng review thiết kế**, chưa viết RPC SQL, chưa chạy test database. Dựa trên state machine §15.3–15.10, quyết định adoption/manual recovery §16 và DDL 021.

### 32.1 Ma trận transition được phép

Mỗi transition phải CAS theo (organization_id, operation_id, expected status, expected version); RPC kiểm tra attempt token/lease nếu transition thuộc Auth attempt. Cập nhật Saga row và audit state-change trong cùng transaction. Transition không liệt kê dưới đây mặc định bị từ chối.

| Trạng thái hiện tại | Trạng thái kế tiếp | Điều kiện bắt buộc |
|---|---|---|
| (chưa có row) | requested | Begin RPC hợp lệ; actor JWT; organization + membership active; users.manage; role chỉ technician/viewer; claim operation ID + fingerprint |
| requested | auth_calling | Server-only claim; lease + attempt ID do DB sinh; không có attempt đang hiệu lực |
| requested | cancelled | Actor hợp lệ; Auth provisioning chưa từng bắt đầu; cancellation atomic + audit |
| auth_calling | auth_user_resolved | Server-only record result; attempt token hiện hành; Auth user ID + provenance được ghi nhận; kết quả không xung đột |
| auth_calling | auth_outcome_unknown | Server-only timeout/crash marker; đúng attempt; không kết luận user không tồn tại |
| auth_calling | failed_terminal | Chỉ lỗi definitive, không retry được và đã chứng minh Auth user không được tạo/liên kết; không dùng cho timeout |
| auth_outcome_unknown | auth_user_resolved | Reconciliation có bằng chứng đáng tin cậy về đúng Auth user; email trùng đơn thuần không đủ |
| auth_outcome_unknown | auth_calling | Chỉ sau khi reconciliation chứng minh không có Auth user được tạo/liên kết, lỗi retryable, backoff đủ điều kiện; claim attempt mới + lease mới; operation_id giữ nguyên |
| auth_outcome_unknown | needs_review | Không xác minh được ownership/provenance, xung đột hoặc hết ngưỡng recovery |
| auth_user_resolved | finalize_pending | Server đã lưu kết quả Auth; sẵn sàng finalize; trạng thái và version khớp |
| auth_user_resolved | needs_review | Phát hiện xung đột Auth user, membership hoặc provenance |
| finalize_pending | completed | Finalize RPC actor JWT recheck quyền hiện tại; membership + role assignment + audit + Shared Receipt commit atomic |
| finalize_pending | needs_review | Conflict/permission loss cần người có quyền xử lý; không xóa Auth user |
| needs_review | auth_user_resolved | Sau adoption/review được phép và có bằng chứng xác minh Auth user; không thay actor gốc/fingerprint |
| needs_review | finalize_pending | Chỉ khi evidence đã được xác minh và operation đủ điều kiện finalize; không dùng để bỏ qua authorization |
| completed, cancelled, failed_terminal | — | Terminal; không reopen, không adoption; replay chỉ đọc theo Receipt/operation policy |

**Ranh giới quan trọng:**
- auth_outcome_unknown không được chuyển thẳng sang failed_terminal, cancelled hoặc tạo operation ID mới.
- Hết lease chỉ cho phép reconciliation/claim có điều kiện; không chứng minh Auth call cũ đã dừng.
- needs_review là trạng thái giữ an toàn, không phải hàng đợi tự động retry.
- Adoption là metadata/audit riêng, không tự đổi trạng thái và không tự finalize/compensate.
- auth_user_created_by_operation=true chỉ khi provenance được chứng minh; user có sẵn luôn false.
- resolved_initial_status là giá trị được server quyết định một lần và giữ bất biến; không đưa trạng thái Auth thay đổi sau đó vào fingerprint retry.

### 32.2 Ma trận RPC — authorization và tác dụng

| RPC | Ai được gọi | Tác dụng / transaction boundary |
|---|---|---|
| begin_member_invite | authenticated actor JWT | Derive auth.uid(); lock Organization → actor Membership → Role/Permission; check users.manage; canonicalize intent/fingerprint; insert requested; replay cùng key/fingerprint; audit |
| cancel_member_invite | authenticated actor JWT ban đầu | Chỉ hủy khi status=requested và chưa có Auth attempt; CAS + audit; không xóa Auth user |
| claim_member_invite_auth_attempt | server identity | Atomic claim; tạo attempt ID/token + lease từ DB; CAS requested hoặc retry đủ điều kiện → auth_calling; không giữ transaction qua Auth API |
| record_member_invite_auth_result | server identity | Check operation + attempt token; ghi auth_user_id/provenance + resolved_initial_status; idempotent cùng kết quả, reject kết quả xung đột |
| mark_member_invite_outcome_unknown | server identity | Check attempt token; auth_calling → auth_outcome_unknown; không kết luận absence |
| finalize_member_invite | authenticated actor JWT | Recheck actor/org/membership/users.manage; kiểm tra operation + role + target; claim/replay Shared Receipt; tạo membership + role assignment + audit + finalize Receipt + Saga completed atomic |
| adopt_member_invite_operation | authenticated Admin khác | Recheck active membership + users.manage; reason bắt buộc; khóa operation; chỉ unresolved/nonterminal và không có ownership dispute; append adoption audit; giữ nguyên actor gốc/fingerprint; không tự finalize |
| activate_my_confirmed_membership (lifecycle RPC riêng) | chính authenticated user | Chỉ kích hoạt membership của auth.uid() khi email đã confirmed; lock Organization → own Membership; invited → active idempotent. Audit/Receipt semantics cần chốt riêng trước khi đưa vào implementation |

Ghi chú: server-only RPC không cấp EXECUTE cho anon/authenticated; actor JWT RPC không được gọi bằng service_role để giả danh Admin. Các tên RPC là contract thiết kế, chưa khẳng định function đã tồn tại.

### 32.3 Bộ kiểm thử bắt buộc theo RPC

**A. Begin**
1. anon/NULL auth.uid() → deny, không tạo row.
2. organization inactive, actor membership inactive, thiếu users.manage → deny.
3. role admin/role không hợp lệ → deny; chỉ technician/viewer.
4. cùng operation_id + cùng canonical fingerprint → replay operation hiện tại, không tạo row thứ hai.
5. cùng operation_id + khác org/actor/email/role/fingerprint → reject, không lộ dữ liệu PII.
6. email normalize (trim/lowercase) nhất quán; response không chứa normalized_email.

**B. Cancel + Claim Auth attempt**
1. Cancel chỉ bởi actor ban đầu, operation còn requested và chưa từng claim Auth; cancellation đồng thời với claim chỉ một CAS thắng.
2. Cancel sau auth_calling/auth_outcome_unknown hoặc sau khi có Auth user → reject; phải reconcile.
3. anon/authenticated trực tiếp → permission denied; chỉ server identity được execute.
4. hai worker đồng thời claim → chỉ một attempt token/lease thắng.
5. stale version/token hoặc lease chưa hết → reject/no-op an toàn.
6. hết lease → worker mới chỉ được reconcile; không tự gọi Auth API trước khi chứng minh retry an toàn.
7. operation terminal → không claim.

**C. Record Auth result**
1. đúng attempt + kết quả mới → ghi auth_user_id/provenance.
2. lặp cùng Auth user/provenance → idempotent.
3. cùng attempt nhưng Auth user khác → reject + needs_review theo quy trình; không overwrite âm thầm.
4. stale attempt token → reject.
5. Auth user đã tồn tại trước invite → created_by_operation=false.
6. không chứng minh provenance → không set true; không tự attach user.

**D. Mark outcome unknown**
1. đúng attempt đang auth_calling → chuyển unknown + audit atomic.
2. stale token/wrong operation/wrong status → reject.
3. gọi lặp sau khi đã unknown → idempotent hoặc trả current state, không tạo transition mới.
4. xác nhận rõ Auth user không tồn tại không được suy ra từ timeout hoặc một lần lookup không đầy đủ.

**E. Finalize**
1. actor mất users.manage, membership suspended hoặc organization inactive sau Begin → deny; không tạo membership/role assignment.
2. actor ban đầu mất quyền nhưng operation đã adoption hợp lệ → chỉ adopter active có users.manage được tiếp tục theo policy.
3. tạo membership + member_roles + audit + Shared Receipt + Saga completed cùng transaction; ép lỗi giữa chừng phải rollback tất cả.
4. timeout sau commit → retry cùng operation_id trả receipt/result; không tạo membership thứ hai.
5. cùng operation ID khác payload/fingerprint → reject.
6. duplicate membership/role assignment hoặc target Admin → fail closed; không tự sửa role.
7. email confirmed trước khi resolve initial status → trạng thái khởi tạo theo server policy; confirmation race sau đó xử lý bằng self-activation RPC, không để Auth trigger ghi membership.
8. Audit actor là actor JWT thật; không nhận actor_user_id từ payload.

**F. Adoption**
1. actor không phải Admin/thiếu users.manage/inactive → deny.
2. actor không phải người khác actor gốc → deny.
3. reason NULL/rỗng/chỉ spaces/quá dài → deny.
4. completed/cancelled/failed_terminal → deny; ownership đang tranh chấp → needs_review, không adoption để bypass.
5. hai Admin adoption đồng thời → một CAS thắng; loser đọc trạng thái hiện tại, không overwrite adopter.
6. adoption không đổi actor_user_id, request_fingerprint, operation_id; không tự finalize, không delete Auth user.
7. actor gốc finalize đồng thời adoption → lock/CAS xác định một thứ tự; không có finalize dưới actor cũ sau khi operation đã được chuyển quyền hợp lệ.

**G. Self activation (nếu được chốt)**
1. auth.uid() NULL hoặc target user khác caller → deny.
2. email chưa confirmed → deny.
3. membership không thuộc organization/caller hoặc không invited → deny/no-op theo trạng thái.
4. email confirmed + invited → active; lặp lại active → no-op idempotent.
5. confirmation đồng thời Finalize → cuối cùng user chỉ active khi điều kiện confirmed đã được xác thực; không có Auth trigger cập nhật membership.

### 32.4 Kiểm thử xuyên suốt, bảo mật và crash matrix

- Crash trước Auth call; giữa Auth call; Auth create thành công nhưng response mất; crash trước/sau record result; crash sau Finalize commit nhưng response mất.
- Timeout Auth không tạo operation ID mới và không gửi invite mù quáng.
- Hai worker claim cùng operation; lease hết hạn trong khi Auth call cũ còn chạy.
- Adoption cạnh tranh với Finalize; revoke users.manage cạnh tranh với Finalize.
- Actor khác/cross-tenant không thể dò operation, email, Auth user hoặc Receipt.
- Không PII trong client response, Shared Receipt, Change Feed, audit before/after, error, logs, telemetry.
- Kiểm tra grants: server-only RPC không execute bởi anon/authenticated; actor RPC derive auth.uid().
- Kiểm tra SECURITY DEFINER, owner/BYPASSRLS, search_path rỗng, schema qualification và RLS.
- Kiểm tra atomicity: Saga state + audit cùng transaction; membership + role assignment + audit + Shared Receipt cùng transaction.
- Kiểm tra terminal state không reopen; unresolved/needs_review không bị retention cleanup.
- Kiểm tra lock order Organization → Membership sorted → role assignments → Role/Permission → Receipt claim → business rows → receipt finalize; không giữ transaction qua Auth network call.

### 32.5 Các điểm cần đóng trước khi viết RPC SQL

1. DDL 021 hiện không lưu attempt history riêng. Giai đoạn đầu có thể dùng current_attempt_id/count + manual recovery, nhưng nếu cần forensic retries phải thêm bảng attempt append-only trước implementation.
2. auth_user_created_by_operation provenance cần đặc tả nguồn chứng minh cụ thể; không dựa vào email match hoặc user_metadata.
3. activate_my_confirmed_membership cần chốt audit/Receipt semantics và kiểm tra trigger migration 013; không được đưa vào cùng Admin Invite RPC.
4. needs_review recovery phải có thao tác Admin rõ ràng và bằng chứng; không cho generic transition endpoint.
5. PII encryption/key management và retention còn mở; chưa được phép promote DDL.
6. Các transition CHECK trong DDL chỉ giới hạn enum; transition graph/CAS/version phải nằm trong RPC.

**Kết luận:** Ma trận trên là baseline để review implementation. Không có SQL, RPC hoặc worker nào được tạo/chạy trong bước này.


## 33. Static schema adequacy review DDL 021 so với Invite Saga §32 (19/11/2026)

**Kết luận:** DDL 021 hiện đủ làm khung lưu operation + append-only audit, nhưng chưa đủ điều kiện triển khai toàn bộ transition/RPC contract §32. Không chỉnh DDL ở vòng này; dưới đây là gap analysis để tránh thêm cột/bảng khi chưa chốt semantics.

### 33.1 Gap bắt buộc trước implementation

| Hạng mục | DDL hiện có | Khoảng trống / rủi ro | Hướng xử lý |
|---|---|---|---|
| Attempt history | auth_attempt_count, current_attempt_id, started_at, result_observed_at, lease_expires_at, retry_after | Chỉ giữ attempt hiện tại; mất lịch sử từng lần gọi, outcome, lỗi phân loại, lease và reconciliation | Manual recovery có thể tạm chấp nhận nếu không cần forensic retry; khuyến nghị bảng attempt append-only trước worker hoặc nếu cần audit từng lần gọi |
| Auth provenance | auth_user_id + auth_user_created_by_operation boolean nullable | Boolean không giải thích bằng chứng, thời điểm, attempt hoặc nguồn xác minh; không đủ phân biệt created, pre-existing, unknown/conflict | Định nghĩa provenance enum + evidence reference/verified_at/verified_by; không lưu token/PII thừa; không cho finalize nếu provenance chưa đạt policy |
| Status/attempt consistency | CHECK enum status và một số CHECK cho resolved/completed | Có thể lưu auth_calling nhưng thiếu current_attempt_id/lease; unknown không có attempt; cancelled dù đã có Auth user; completed thiếu attempt/result timestamps | Thêm CHECK theo trạng thái sau khi chốt semantics; RPC vẫn enforce CAS/version/transition graph |
| Immutable intent | organization_id, operation_id, actor_user_id, normalized_email, role_code, request_fingerprint | DDL không ngăn update các cột intent; RPC SECURITY DEFINER có thể vô tình overwrite | RPC chỉ update allowlist cột; cân nhắc trigger bảo vệ immutable fields; fingerprint phải canonical/stable |
| Fingerprint representation | request_fingerprint jsonb object | Không có canonicalization/hash contract; chưa chỉ rõ có chứa email PII hay không | Đặc tả canonical JSON/hash hoặc structured fields; không đưa plaintext email vào Receipt/log; cùng operation ID khác intent phải reject |
| Adoption | adopted_by_user_id/reason/at | Chỉ biểu diễn một lần adoption; chưa có lịch sử tiếp quản nhiều lần | Nếu chỉ cho một adopter duy nhất thì giữ; nếu cho phép chuyển tiếp nhiều lần, dùng adoption event history append-only |
| Audit idempotency/order | audit_id + occurred_at; invite_operation_id | Không có transition version/sequence hoặc unique key; retry RPC có thể tạo audit duplicate nếu RPC không chống | Gắn transition version/sequence hoặc event ID duy nhất; unique constraint theo operation + version/event key; audit insert cùng transaction CAS |
| Audit event shape | CHECK actor, action, target, mutation, JSON keys | Chưa bắt buộc before/after saga_status cho state.change; chưa buộc role/status action có đúng key tương ứng | Bổ sung shape CHECK sau khi chốt action semantics; RPC xác thực giá trị trước/sau |
| Membership linkage | membership_id scalar; membership_receipt_mutation_id scalar | Không có FK/unique relationship tới membership/receipt; có thể lưu ID sai nếu RPC lỗi | Giữ scalar để bảo toàn lịch sử nhưng RPC xác minh membership/receipt đúng org/operation; cân nhắc unique constraint |
| PII at rest | normalized_email plaintext | RLS/revoke không mã hóa dữ liệu; DB dump/backup/owner vẫn có thể đọc | Chốt threat model, encryption/key management, backup/restore và lookup; không để key cạnh ciphertext trong DB |
| Retention | Không có cleanup | FK RESTRICT và PII có thể tồn tại vô thời hạn; unresolved operation không thể xóa tùy tiện | Policy riêng cho completed/terminal/unresolved/audit/backup; archive/anonymize không phá replay, legal hold và audit |
| Actor/adopter authorization | FK Profile only | FK không chứng minh actor/adopter active trong đúng organization hoặc có users.manage tại thời điểm thao tác | RPC khóa org + membership + role/permission và xác minh tại thời điểm mutation |
| Error/recovery data | last_error_code regex | Không có phân loại retryability, Auth response class hoặc recovery evidence; tránh lưu raw Auth response | Error code allowlist + sanitized classification; không lưu raw response/token/email |

### 33.2 Ma trận trạng thái — yêu cầu nhất quán dữ liệu tối thiểu

Các CHECK dưới đây là hướng thiết kế cần chốt trước khi chỉnh DDL, không phải SQL đã được áp dụng:

- requested: chưa có Auth attempt; current_attempt_id/lease/auth_user_id/completed_at phải null; count bằng 0.
- auth_calling: current_attempt_id và auth_attempt_started_at phải có; lease phải có; attempt count > 0; chưa completed.
- auth_outcome_unknown: giữ current_attempt_id của attempt unresolved; lease cũ được ghi nhận hoặc hết hạn theo protocol; không xóa dấu vết attempt.
- auth_user_resolved/finalize_pending: auth_user_id + provenance đủ tin cậy + resolved_initial_status phải có; không còn Auth call đang chạy.
- needs_review: phải có reason/error classification hoặc review event; không tự retry và không tự finalize nếu chưa có quyết định/evidence.
- failed_terminal: chỉ khi lỗi definitive, Auth outcome được chứng minh và không còn Auth user cần xử lý; timeout không được vào trạng thái này.
- cancelled: chỉ khi Auth provisioning chưa bắt đầu; không có auth_user_id và không có attempt từng được claim.
- completed: auth_user_id, provenance, resolved_initial_status, membership_id, membership_receipt_mutation_id, completed_at và receipt liên quan phải được xác minh cùng transaction.

Lưu ý: auth_outcome_unknown có thể tồn tại lâu; không đặt CHECK buộc lease còn hiệu lực. lease_expires_at là thời điểm hết hạn, không phải bằng chứng Auth request đã dừng.

### 33.3 Quyết định đề xuất để khóa schema

1. **Attempt history:** chưa có worker nền. Tuy vậy, trước khi triển khai RPC manual recovery cần tối thiểu có attempt ID không tái sử dụng, started/finished time, outcome classification và audit transition. Nếu cần lịch sử chi tiết từng Auth call, tạo bảng append-only organization_member_invite_attempts trước RPC; không đợi đến khi có worker.
2. **Provenance:** dùng các trạng thái rõ nghĩa như created_by_operation, preexisting, verified_existing, unknown, conflict; chỉ trạng thái đã được policy cho phép mới được finalize. Không coi email match là provenance.
3. **Fingerprint:** lưu digest canonical của intent, không lưu object chứa plaintext email; fingerprint bind organization, actor gốc, operation type, normalized-email digest, role và immutable options. Expected-current-state nếu có chỉ là precondition kiểm tra sau lock, không lấy live DB state làm fingerprint.
4. **Adoption:** quyết định hiện tại cho phép Admin khác tiếp quản unresolved operation. Nếu chỉ cần một lần adoption thì cột hiện tại đủ biểu diễn adopter hiện hành; audit event phải ghi từng lần. Nếu cần chuyển adopter nhiều lần, thêm history table trước implementation.
5. **Audit sequence:** mỗi Saga transition có version tăng đơn điệu; audit event lưu version/transition ID để retry không ghi trùng và có thể tái dựng thứ tự.
6. **PII:** chưa promote khi chưa có quyết định key management, backup và retention. Hash email phải dùng keyed HMAC nếu cần chống dò từ điển; hash không khóa không đủ bảo vệ email.
7. **Status CHECK:** chỉ thêm sau khi xác nhận state invariants, để không vô tình chặn trạng thái recovery hợp lệ.

### 33.4 Thứ tự công việc tiếp theo

1. Chốt provenance model và fingerprint format.
2. Chốt có cần attempt history table ngay ở giai đoạn manual recovery không.
3. Chốt một lần hay nhiều lần adoption; audit sequence.
4. Chốt PII encryption/key management và retention.
5. Sau đó mới sửa DDL 021, chạy parser/clone tests, rồi mới thiết kế RPC SQL.
6. Không chạy trên Supabase Test/Production cho đến khi có phê duyệt riêng.

**Kết luận cuối:** Không promote DDL 021 ở trạng thái hiện tại. Không có thay đổi DDL, migration, RPC, Edge Function hoặc Supabase trong vòng review này.


## 34. Đề xuất khóa Auth provenance và request fingerprint (19/11/2026)

Phần này là **đề xuất thiết kế để người dùng xem xét**, chưa phải quyết định được phê duyệt và chưa phải DDL. Không có SQL/Supabase operation trong bước này.

### 34.1 Auth provenance — không suy luận quyền sở hữu từ email match

Mục tiêu: mỗi `auth_user_id` được gắn với Invite Operation phải có nguồn gốc có thể giải thích và kiểm chứng. Không dùng `auth_user_created_by_operation = true/false` như bằng chứng duy nhất.

**Đề xuất mô hình provenance:**

| Giá trị | Ý nghĩa | Có được Finalize? |
|---|---|---|
| `created_by_operation` | Auth provider trả về chính xác user ID mới được tạo bởi attempt thuộc operation hiện tại; attempt/result được đối chiếu | Có |
| `preexisting_verified` | Tài khoản đã tồn tại trước operation; danh tính được xác minh qua nguồn Auth đáng tin cậy và quy trình invite/claim chứng minh đúng chủ tài khoản | Chỉ khi thỏa quy trình xác minh và policy membership |
| `unknown` | Không đủ bằng chứng để kết luận tài khoản mới hay đã tồn tại, ví dụ timeout/crash hoặc kết quả Auth không rõ | Không |
| `conflict` | Auth result không khớp operation/attempt, nhiều ứng viên, hoặc có dấu hiệu liên kết sai | Không; chuyển needs_review |

Không dùng `email match`, `user_metadata`, client-supplied Auth ID hoặc một lần tra cứu không có kiểm chứng làm bằng chứng `created_by_operation`. Không tự xóa Auth user khi provenance là unknown/conflict.

**Dữ liệu tối thiểu nên lưu (tên cột chỉ là gợi ý):**
- `auth_provenance`: enum/text allowlist như bảng trên.
- `provenance_attempt_id`: attempt đã tạo ra hoặc xác minh kết quả.
- `provenance_evidence_code`: mã bằng chứng allowlist, không chứa raw Auth response.
- `provenance_verified_at`: thời điểm xác minh.
- `provenance_verified_by`: actor/system thực hiện xác minh; system event phải có audit tương ứng.
- `auth_user_id`: chỉ gắn khi có ID từ nguồn Auth đáng tin cậy.

`created_by_operation` chỉ hợp lệ khi provider result gắn trực tiếp với cùng operation + attempt và user ID. `preexisting_verified` cần một quy trình chứng minh quyền sở hữu/claim độc lập; không được tự động suy ra chỉ từ việc tìm thấy email trùng. Khi chưa có quy trình này, xử lý pre-existing account theo `needs_review` thay vì tự gắn membership.

### 34.2 Request fingerprint — digest của ý định bất biến

**Đề xuất:** thay JSONB fingerprint bằng digest có version, không lưu plaintext email trong fingerprint/receipt/log.

Canonical intent gồm các trường ổn định:
1. schema/version của fingerprint;
2. organization ID;
3. actor_user_id ban đầu (không đổi khi adoption);
4. operation type;
5. normalized email được đưa qua keyed HMAC riêng cho mục đích fingerprint;
6. role code;
7. immutable invite options/policy version có ảnh hưởng đến ý nghĩa yêu cầu.

Tạo digest bằng HMAC-SHA-256 với secret quản lý ngoài database (ví dụ secret của server/Edge Function), không lưu secret cạnh digest. Lưu `fingerprint_version`, `fingerprint_key_version` và `request_fingerprint_digest`; không lưu key material. Việc xoay key phải có kế hoạch giữ khả năng replay operation cũ (giữ key version cũ trong secret manager trong thời hạn retention hoặc quy trình re-key có kiểm soát).

**Không đưa vào fingerprint:**
- Auth user ID được resolve sau này;
- current membership/status/role/permission tại thời điểm retry;
- thời gian, attempt ID, lease, retry count;
- adopter hiện tại;
- trạng thái hiện tại của Saga;
- email plaintext.

Các dữ liệu trên thay đổi theo thời gian hoặc thuộc kết quả thực thi, không phải ý định ban đầu. Nếu có expected-current-state là precondition, lưu riêng trong intent và chỉ kiểm tra ở nhánh mutation mới sau khi khóa dữ liệu; không lấy live DB state làm nguồn fingerprint khi replay.

**Quy tắc idempotency:**
- Cùng operation ID + cùng digest + cùng actor gốc: tiếp tục/replay đúng operation.
- Cùng operation ID + digest khác: reject conflict; không ghi đè intent.
- Cùng operation ID nhưng fingerprint version/key version cũ: tính/so sánh bằng đúng version/key đã lưu, không tự diễn giải lại bằng key hiện hành.
- Adoption không thay actor gốc hoặc digest.
- Không trả email, digest trung gian hoặc thông tin cho phép dò email qua client response.

### 34.3 Ranh giới giữa provenance và fingerprint

Fingerprint chứng minh **yêu cầu ban đầu không đổi**; provenance chứng minh **Auth user được gắn vào operation bằng con đường nào**. Hai khái niệm không thay thế nhau. Một digest hợp lệ không chứng minh quyền sở hữu Auth user; một Auth user ID hợp lệ cũng không cho phép thay đổi role/email/actor của intent đã claim.

### 34.4 Khuyến nghị triển khai theo thứ tự

1. Chốt các giá trị provenance và bằng chứng hợp lệ; nếu chưa có quy trình xác minh pre-existing account thì fail closed sang needs_review.
2. Chốt HMAC secret location, key version và retention/rotation.
3. Chọn tên/cấu trúc cột tương ứng, sau đó mới sửa DDL 021.
4. Bổ sung test: provider create success; timeout sau create; pre-existing account; email trùng nhưng chưa xác minh; mismatched Auth ID; retry cùng operation; cùng operation ID với digest khác; key rotation/replay.
5. Chỉ sau khi DDL được review và parser/clone tests đạt mới thiết kế RPC SQL.

**Trạng thái:** đề xuất để thảo luận; chưa được coi là policy đã duyệt. Không chỉnh DDL 021, không chạy SQL, không thay đổi Supabase Test/Production.


### 35. Quyết định đã chốt: Auth provenance và request fingerprint (20/11/2026)

Người dùng đã xác nhận chốt các nguyên tắc sau; từ thời điểm này đây là quyết định kiến trúc, không còn là đề xuất:

1. **Auth provenance:** dùng đúng bốn trạng thái `created_by_operation`, `preexisting_verified`, `unknown`, `conflict`. Chỉ `created_by_operation` khi Auth provider trả về đúng user ID mới được tạo bởi attempt thuộc operation hiện tại và có thể đối chiếu. `preexisting_verified` chỉ được dùng khi có quy trình xác minh/claim độc lập chứng minh đúng chủ tài khoản. Không suy luận quyền sở hữu từ email trùng, metadata do client cung cấp hoặc kết quả tra cứu không đủ kiểm chứng.
2. **Fail closed:** `unknown` và `conflict` không được finalize membership; chuyển `needs_review`. Không tự xóa Auth user hoặc tự gắn user vào membership trong các trường hợp này.
3. **Fingerprint:** dùng canonical intent digest bằng HMAC-SHA-256. Secret/key material phải nằm ngoài Database trong secret manager; Database chỉ lưu digest và metadata phiên bản, không lưu key.
4. **Idempotency:** cùng operation ID + cùng digest + cùng actor gốc thì tiếp tục/replay operation; cùng operation ID nhưng digest khác thì reject conflict, không ghi đè intent. Khi replay operation cũ phải dùng đúng fingerprint/key version đã lưu.
5. **Adoption:** adoption không thay đổi actor gốc, canonical intent hoặc fingerprint digest.

**Hệ quả triển khai:** DDL 021 cần biểu diễn provenance, evidence/attempt linkage và fingerprint version/key version/digest; RPC phải kiểm tra các bất biến trên trong transaction. Trước khi triển khai thực tế vẫn phải chốt thời hạn giữ key cũ để replay, quy trình xác minh `preexisting_verified`, cùng phương án bảo vệ/retention dữ liệu email. Các chi tiết vận hành này không làm thay đổi năm nguyên tắc đã chốt.

**Phạm vi thay đổi lần này:** chỉ ghi nhận quyết định thiết kế. Chưa sửa DDL 021, chưa tạo migration/RPC/Edge Function, chưa chạy SQL, không thay đổi Supabase Test/Production.


### 36. Phương án cấu trúc dữ liệu DDL 021 sau khi chốt provenance/fingerprint (20/11/2026)

Đây là schema proposal để review, chưa phải DDL được duyệt. Không chỉnh file SQL trong bước này.

#### 36.1 `organization_member_invite_operations`

**Thay fingerprint JSONB và boolean provenance cũ:**
- Bỏ `request_fingerprint jsonb` sau khi có transition/migration plan; thay bằng `fingerprint_version smallint NOT NULL`, `fingerprint_key_version text NOT NULL`, `request_fingerprint_digest bytea NOT NULL` (độ dài đúng 32 bytes cho HMAC-SHA-256). Không lưu key material hoặc canonical payload chứa email plaintext.
- Bỏ `auth_user_created_by_operation boolean`; thay bằng `auth_provenance text` allowlist bốn giá trị `created_by_operation`, `preexisting_verified`, `unknown`, `conflict` (nullable trước khi có kết quả Auth đáng tin cậy).
- Thêm `provenance_attempt_id uuid`, `provenance_evidence_code text`, `provenance_verified_at timestamptz`, `provenance_verified_by uuid` (FK Profile khi là user; nếu system thì cần biểu diễn actor kind rõ ràng, không giả lập user ID). Evidence code là allowlist, không lưu raw provider response/token.
- Chỉ coi `auth_user_id` là liên kết đã được xác minh khi provenance là `created_by_operation` hoặc `preexisting_verified`. Với kết quả Auth quan sát được nhưng chưa đáng tin hoặc đang conflict, giữ candidate ID trong attempt record riêng, không gắn vào `auth_user_id` của operation.
- Thêm `transition_version bigint NOT NULL DEFAULT 0 CHECK (transition_version >= 0)` riêng với `version`: `version` tăng cho mọi CAS mutation của operation; `transition_version` chỉ tăng khi Saga `status` thực sự đổi.

#### 36.2 Bảng attempt history `organization_member_invite_attempts`

Đề xuất tạo append-only table ngay cả khi giai đoạn đầu recovery thủ công, để giữ dấu vết từng lần gọi Auth và xử lý cửa sổ crash/timeout:
- PK `attempt_id uuid`; FK `(organization_id, operation_id)` tới operation với `ON DELETE RESTRICT`.
- `attempt_no integer > 0`; unique `(organization_id, operation_id, attempt_no)`.
- `claimed_by_kind` (`user`/`system`) và `claimed_by_user_id` nullable có CHECK tương ứng; `started_at`, `finished_at`, `lease_expires_at`.
- `outcome` allowlist: `calling`, `created`, `preexisting`, `definitive_failure`, `outcome_unknown`, `mismatch`; trạng thái `calling` có thể là record còn dang dở sau crash, không được tự diễn giải lease hết hạn là Auth request đã dừng.
- `observed_auth_user_id uuid` chỉ là dữ kiện provider trả về/được quan sát, không tự tạo quyền liên kết; `evidence_code`, `error_code` allowlist; không lưu email, raw response, access token, refresh token hoặc secret.
- Unique/constraint bảo đảm một attempt number duy nhất; operation giữ `current_attempt_id` để truy cập attempt đang xử lý. Composite FK từ operation về attempt có thể bổ sung sau khi chốt thứ tự insert và deferrability; nếu chưa dùng FK thì RPC bắt buộc kiểm tra attempt thuộc đúng organization/operation.
- Cấm UPDATE/DELETE client; mọi thay đổi kết quả attempt ghi bằng event append-only hoặc chỉ cho phép finalize đúng một lần bằng server RPC. Khuyến nghị attempt record immutable; nếu cần nhiều mốc kết quả, dùng bảng attempt events append-only thay vì sửa lịch sử.

#### 36.3 Audit transition idempotency

- Bổ sung `transition_id uuid NOT NULL` cho event thay đổi trạng thái Saga; RPC tạo một ID ổn định cho một transition intent và tái sử dụng khi retry.
- Bổ sung `transition_version bigint NOT NULL` trên audit event Saga; unique `(organization_id, invite_operation_id, transition_version)` và unique `(organization_id, transition_id)` để chặn ghi trùng.
- `transition_version` trên operation tăng đơn điệu trong cùng transaction với đổi `status` và insert audit event. Không dùng timestamp để suy ra thứ tự.
- Audit state-change bắt buộc có `before_state.saga_status` và `after_state.saga_status`, hai giá trị khác nhau; RPC xác minh cặp trạng thái thuộc transition graph §32. Các action membership khác không được phép giả dạng Saga transition.

#### 36.4 Adoption và các liên kết

- Giai đoạn hiện tại giữ một adopter hiện hành trên operation (`adopted_by_user_id`, `adoption_reason`, `adopted_at`); mỗi lần adoption/handoff phải tạo audit event riêng có actor, reason, before/after adopter reference tối thiểu và mutation/operation idempotency.
- Không thay actor gốc, intent, digest hoặc operation ID khi adoption. Chỉ Admin khác actor gốc, có membership/permission hợp lệ tại thời điểm adoption, được nhận operation.
- Chưa tạo adoption history table riêng: append-only audit là lịch sử handoff; nếu sau này cần query/approval workflow chuyên biệt mới tách bảng.
- `membership_id` và `membership_receipt_mutation_id` vẫn là scalar lịch sử; finalize RPC phải xác minh membership đúng organization/target và receipt đúng actor/operation/fingerprint. Không thêm FK có thể làm mất lịch sử khi membership lifecycle thay đổi.

#### 36.5 Những điểm còn phải quyết định trước khi viết DDL

1. Quy trình và evidence code cụ thể để đạt `preexisting_verified` (nếu chưa có, pre-existing account luôn đi `needs_review`).
2. Fingerprint/key version type, secret manager và thời hạn giữ key cũ; phải giữ khả năng replay trong toàn bộ thời hạn operation/receipt retention.
3. Cách bảo vệ `normalized_email` at rest, backup/restore, retention và quyền truy cập; HMAC digest không mã hóa cột email gốc.
4. Attempt record immutable hoàn toàn hay có attempt-events table cho nhiều mốc kết quả; đề xuất immutable attempt + append-only event nếu cần.
5. `transition_id` được sinh/giữ ổn định ở operation intent hay được truyền từ orchestration; không được tạo ID mới khi retry cùng transition.

**Kết luận:** phương án khuyến nghị là bổ sung attempt history, provenance có evidence, digest versioned, transition sequence/idempotency; giữ adoption history trong audit append-only. Chưa sửa DDL 021, chưa tạo migration/RPC, chưa chạy SQL và không thay đổi Supabase Test/Production.


### 37. Attempt History và phục hồi sau timeout/crash — schema/flow proposal (20/11/2026)

Mục này cụ thể hóa §36.2. Đây là proposal để review, chưa phải DDL approval.

#### 37.1 Nguyên tắc bất biến

1. Mỗi lần gọi Auth bên ngoài có một `attempt_id` duy nhất, được claim và commit vào DB trước khi bắt đầu network call.
2. Một operation chỉ có tối đa một attempt chưa được kết luận. `current_attempt_id` trỏ đến attempt đó.
3. Lease chỉ giới hạn quyền điều phối/tiếp quản; lease hết hạn KHÔNG chứng minh request Auth đã dừng, thất bại hoặc chưa tạo user.
4. `outcome_unknown` là trạng thái cần reconciliation, không phải retryable failure. Không tự động tạo attempt mới, không gọi Auth lần hai chỉ vì timeout, process crash hoặc lease expiry.
5. Attempt đã tạo user hoặc có kết quả không chắc chắn không được xóa/ghi đè để “làm sạch” lịch sử.
6. Mọi retry provider call chỉ được phép sau `definitive_failure` có bằng chứng rằng lần gọi trước không tạo user/không có side effect, hoặc sau quyết định recovery được kiểm soát và có bằng chứng độc lập. Nếu không thể chứng minh, giữ `needs_review`.

#### 37.2 Mô hình lưu trữ khuyến nghị

**A. `organization_member_invite_attempts` — immutable attempt header**
- `attempt_id` PK; `(organization_id, operation_id)` FK tới operation `ON DELETE RESTRICT`.
- `attempt_no` tăng tuần tự; unique `(organization_id, operation_id, attempt_no)`.
- `claimed_by_kind`, `claimed_by_user_id`; `claimed_at`; `lease_expires_at`; `provider`/`provider_operation_code` nếu cần allowlist.
- Không lưu email, raw request/response, access/refresh token, secret hoặc dữ liệu Auth không cần thiết.
- Header không UPDATE/DELETE sau khi tạo. Không lưu một cột “kết quả cuối” có thể bị sửa ngược; kết quả nằm ở event log.

**B. `organization_member_invite_attempt_events` — append-only event log**
- `event_id` PK; `attempt_id` FK `ON DELETE RESTRICT`; `event_seq` tăng trong một attempt; unique `(attempt_id, event_seq)`.
- `event_type` allowlist đề xuất: `claimed`, `provider_call_started`, `provider_result_created`, `provider_result_preexisting`, `provider_result_definitive_failure`, `outcome_unknown`, `reconciled_created`, `reconciled_preexisting_verified`, `reconciled_no_side_effect_proven`, `mismatch_detected`, `manual_review_required`.
- `occurred_at`; `actor_kind` (`user`/`system`) và actor tương ứng; `evidence_code` allowlist; `observed_auth_user_id` nullable chỉ là ID quan sát được, không tự động trở thành operation.auth_user_id; `error_code` allowlist; `details` JSONB chỉ chứa metadata allowlist không PII.
- Không UPDATE/DELETE; retry/reconciliation luôn append event mới. Unique event key/idempotency key phải ngăn ghi trùng khi response được gửi lại.
- Event order dùng `event_seq`, không dùng timestamp. Event append phải xác thực attempt thuộc đúng operation và actor có quyền.

**C. Operation pointer/state**
- `current_attempt_id` trỏ tới attempt đang unresolved; `auth_attempt_count` phản ánh số attempt đã claim và không giảm.
- `auth_outcome_unknown` giữ pointer và attempt history cho tới khi reconciliation kết luận.
- Chỉ clear pointer sau khi có definitive no-side-effect outcome hoặc chuyển sang trạng thái đã resolve/needs_review theo policy; không clear chỉ vì lease expiry.

#### 37.3 Luồng claim và gọi Auth

1. Actor/RPC xác thực Auth, organization, active membership và permission; khóa operation theo thứ tự lock đã quy định.
2. Nếu operation có current attempt unresolved hoặc trạng thái `auth_outcome_unknown`, từ chối claim provider call mới và trả mã `reconciliation_required`.
3. Nếu chưa có attempt hoặc attempt trước có definitive failure đủ điều kiện retry, RPC tạo attempt header + event `claimed`, cập nhật `current_attempt_id`, count, status/version và commit nguyên tử.
4. Worker/server orchestration thực hiện Auth call sau commit, không giữ DB transaction/row lock.
5. Ghi event kết quả với idempotency key ổn định cho attempt. Nếu process crash trước khi ghi kết quả, trạng thái được coi là unknown; reconciler phải điều tra.

#### 37.4 Lease expiry và reconciliation

- Lease expiry chỉ cho phép Admin khác hoặc recovery process claim quyền reconciliation bằng CAS/version; không cấp quyền gọi Auth lần nữa.
- Reconciler kiểm tra event log, kết quả provider có thể truy xuất bằng nguồn đáng tin cậy, và các correlation/evidence đã lưu. Email match đơn thuần không đủ để chứng minh attempt tạo user hoặc quyền sở hữu.
- Nếu chứng minh đúng user ID được tạo bởi đúng operation + attempt: append `reconciled_created`, set provenance `created_by_operation` trong operation transaction và chuyển sang bước finalize phù hợp.
- Nếu tìm thấy tài khoản pre-existing nhưng chưa chứng minh claim/ownership: append `reconciled_preexisting_verified` chỉ khi quy trình xác minh độc lập đạt; nếu không append `manual_review_required` và `needs_review`.
- Nếu chứng minh chắc chắn provider không tạo side effect: append `reconciled_no_side_effect_proven`; khi đó mới có thể kết thúc attempt và cho phép Admin retry theo quyền/policy.
- Nếu không thể xác định: giữ `outcome_unknown` hoặc `needs_review`; không tạo attempt mới.
- Nếu Auth ID/evidence xung đột: append `mismatch_detected`, provenance `conflict`, chuyển `needs_review`; không tự gắn hoặc xóa Auth user.

#### 37.5 Các tình huống crash bắt buộc test

| Điểm crash | Trạng thái sau phục hồi | Hành động được phép |
|---|---|---|
| Trước khi claim attempt commit | Không có attempt | Claim mới có thể thực hiện |
| Sau commit claim, trước Auth call | Attempt đã claim nhưng chưa có kết quả | Unknown/reconcile; không giả định request chưa chạy chỉ từ lease |
| Trong Auth call hoặc timeout | `outcome_unknown` | Reconcile; không gọi lại mù quáng |
| Auth tạo user, process crash trước khi ghi kết quả | `outcome_unknown` | Tìm bằng chứng liên kết đúng attempt; nếu không đủ thì needs_review |
| Ghi event kết quả thành công nhưng response về client bị mất | Event đã tồn tại | Retry cùng event idempotency key, trả kết quả cũ; không gọi Auth lại |
| Definitive failure được ghi nhận | Attempt kết thúc không side effect | Có thể tạo attempt mới theo policy và quyền hiện hành |
| Lease hết hạn trong khi Auth call có thể vẫn chạy | Attempt unresolved | Chỉ takeover reconciliation, không takeover provider retry |

#### 37.6 Quyết định đề xuất

Khuyến nghị chọn **immutable attempt header + append-only attempt events** ngay từ giai đoạn manual recovery. Cách này có thêm một bảng so với attempt row có thể update, nhưng giữ được bằng chứng lịch sử, chống sửa kết quả cũ, và hỗ trợ worker sau này mà không phải thay mô hình. Không xây background worker ở giai đoạn hiện tại; recovery thủ công qua RPC có audit là đủ.

**Chưa chốt:** provider-specific evidence/correlation nào có thể chứng minh “không có side effect”; danh sách error code nào là definitive failure; thời hạn lease và quyền Admin takeover reconciliation. Nếu không có bằng chứng definitive, default là unknown/needs_review, không retry.

**Phạm vi:** chỉ thiết kế; chưa sửa DDL 021, chưa tạo RPC/worker, chưa chạy SQL, không thay đổi Supabase Test/Production.


### 38. Quyết định đã chốt: Attempt History và lease recovery (20/11/2026)

Người dùng đã đồng ý chốt mô hình hai bảng và nguyên tắc lease:

1. Dùng `organization_member_invite_attempts` làm immutable attempt header, một record cho mỗi lần gọi Auth đã claim.
2. Dùng `organization_member_invite_attempt_events` làm append-only event history; kết quả, reconciliation, mismatch và recovery được ghi thêm event, không ghi đè lịch sử.
3. Attempt phải được claim/commit trước Auth network call; không giữ DB transaction/row lock trong lúc gọi Auth.
4. Lease expiry chỉ cho phép takeover quyền reconciliation bằng CAS/version; không cho phép tự động gọi Auth lại.
5. `outcome_unknown` không phải definitive failure. Chỉ retry sau khi có bằng chứng đáng tin cậy rằng attempt trước không tạo side effect; nếu không chứng minh được thì giữ unresolved/`needs_review`.

**Còn mở để thiết kế tiếp:** provider-specific evidence/correlation chứng minh no-side-effect; phân loại definitive failure; lease duration; quyền và quy trình Admin takeover reconciliation. Default fail-closed khi bằng chứng không đủ.

**Phạm vi:** quyết định schema/flow đã chốt; chưa sửa DDL 021, chưa tạo RPC/worker, chưa chạy SQL, không thay đổi Supabase Test/Production.


### 39. Phân loại lỗi Auth và điều kiện retry (20/11/2026)

Đây là policy proposal để review; không whitelist theo HTTP status chung chung.

#### 39.1 Ba nhóm kết quả

1. **`definitive_no_side_effect`**: chỉ dùng khi có bằng chứng kỹ thuật rằng request chưa được dispatch tới Auth (ví dụ local preflight validation thất bại trước network call, có execution trace chứng minh chưa dispatch), hoặc provider có tài liệu/contract cụ thể xác nhận mã lỗi đó bị reject trước mọi side effect. Khi đó attempt được kết luận không tạo user/không gửi invite; retry có thể được cân nhắc sau khi sửa nguyên nhân và qua policy.
2. **`outcome_unknown`**: mọi trường hợp request có thể đã tới Auth nhưng không có kết quả cuối đáng tin cậy: timeout, connection reset, DNS/TLS/proxy interruption sau khi dispatch không xác định, response body không đọc được, gateway/proxy 5xx, Auth 5xx/5xx-like, Edge Function/server crash sau dispatch, client disconnect, process restart, hoặc bất kỳ lỗi không có contract no-side-effect rõ ràng. Không retry Auth; bắt buộc reconciliation.
3. **`needs_review` / `conflict`**: email đã tồn tại/duplicate, Auth ID không khớp, nhiều candidate, provider response mâu thuẫn với event log, hoặc không thể chứng minh ownership/provenance. Không gắn membership; không tự xóa Auth user; yêu cầu Admin review hoặc quy trình claim độc lập.

#### 39.2 Không suy luận từ HTTP status

- Không quy tắc `4xx = definitive failure` hoặc `5xx = retry`. Status code chỉ là một thuộc tính response, không tự chứng minh Auth chưa có side effect.
- `429`/rate limit, email send limit, invalid email, email not authorized, duplicate user và các lỗi provider-specific chỉ được xếp `definitive_no_side_effect` nếu contract hiện hành của đúng endpoint/phiên bản xác nhận không có user creation/invite side effect trước khi trả lỗi. Nếu không chứng minh được, mặc định `outcome_unknown` hoặc `needs_review` tùy dữ kiện.
- Duplicate/existing account không được coi là `created_by_operation`; email trùng không phải provenance. Chỉ đi `preexisting_verified` khi quy trình claim/ownership độc lập đạt.
- Không dùng `retryAfter` hoặc hết thời gian rate limit làm bằng chứng attempt trước không có side effect. Retry-After chỉ điều khiển thời điểm thử lại sau khi attempt cũ đã được chứng minh không có side effect.

#### 39.3 Event/evidence bắt buộc

- Mỗi kết luận no-side-effect phải ghi `evidence_code`, nguồn/contract version, thời điểm, actor/system và liên kết attempt. Không lưu raw response, token, email hoặc secret.
- `local_preflight_not_dispatched` chỉ hợp lệ nếu orchestration có thể chứng minh chưa gửi request; nếu không có bằng chứng dispatch state thì không được dùng code này.
- `provider_rejection_no_side_effect` phải map tới allowlist endpoint + provider error code + contract version được review; không cho Admin tự nhập error code để ép retry.
- Error code không nhận diện, response không đầy đủ hoặc contract thay đổi: mặc định `outcome_unknown`.
- Reconciliation tìm thấy Auth user không đủ để kết luận attempt đã tạo user. Phải có correlation/evidence đáng tin cậy gắn đúng Auth ID với operation + attempt.

#### 39.4 Quy tắc retry

Chỉ cho phép attempt mới nếu tất cả điều kiện đều đúng: (a) attempt trước có kết luận `definitive_no_side_effect` với evidence allowlist; (b) không còn request cũ có thể đang chạy theo contract; (c) operation vẫn hợp lệ, chưa cancelled/completed/needs_review; (d) actor/system có quyền và retry policy cho phép; (e) attempt mới có ID/number mới và được commit trước network call. Nếu thiếu bất kỳ điều kiện nào, không retry.

**Khuyến nghị:** ở giai đoạn đầu, allowlist `provider_rejection_no_side_effect` để trống cho tới khi kiểm tra được contract của đúng Supabase Auth endpoint đang dùng. Chỉ các lỗi local preflight chứng minh chưa dispatch mới được coi là definitive. Tất cả lỗi sau dispatch mặc định unknown, trừ khi sau này có bằng chứng endpoint-specific đủ mạnh.

**Phạm vi:** proposal; chưa sửa DDL 021, chưa viết RPC/worker, không chạy SQL, không thay đổi Supabase Test/Production.


### 40. Quyết định đã chốt: fail-closed retry policy cho Auth (20/11/2026)

Người dùng đã đồng ý chốt nguyên tắc:

- Giai đoạn đầu để trống allowlist provider error codes được phép retry.
- Chỉ lỗi local preflight có bằng chứng chắc chắn request chưa được dispatch mới được phân loại `definitive_no_side_effect`.
- Mọi lỗi xảy ra sau dispatch, hoặc không xác định được request đã dispatch hay chưa, mặc định `outcome_unknown` và phải reconciliation; không gọi Auth lại.
- Không dùng HTTP status, email trùng, `Retry-After`, timeout hay lease expiry làm bằng chứng không có side effect.
- Chỉ mở allowlist sau khi review contract của đúng endpoint/provider/version và có test evidence chứng minh no-side-effect.

Quyết định này bổ sung cho policy ở §39; không thay đổi nguyên tắc `needs_review/conflict` khi provenance/identity không rõ.

**Phạm vi:** quyết định policy đã chốt; chưa sửa DDL 021, chưa tạo RPC/worker, không chạy SQL hoặc thay đổi Supabase.


### 41. Proposal: bằng chứng reconciliation gắn đúng Auth attempt (20/11/2026)

Mục tiêu chứng minh chuỗi `operation_id → attempt_id → auth_user_id`; email match đơn thuần không phải provenance.

#### 41.1 Correlation marker có điều kiện

Ưu tiên khảo sát khả năng gắn một marker do server tạo ngay trong chính thao tác Auth user creation, ở vùng metadata chỉ Admin/server quản lý (ví dụ `app_metadata`, nếu đúng endpoint/SDK đang dùng hỗ trợ atomic create-time write). Marker nên là opaque random token đủ entropy (ít nhất 256-bit), tạo server-side; chỉ lưu digest của marker trong attempt record trước khi dispatch; raw marker chỉ truyền trong Auth create request và không ghi log. Marker phải gắn đúng operation + attempt trong DB thông qua digest. Không dùng `user_metadata`, client metadata, email, tên, thời gian gần nhau hoặc metadata do user chỉnh sửa làm bằng chứng.

**Điều kiện bắt buộc trước khi chọn giải pháp:** xác minh bằng docs/API type/source của đúng phiên bản Supabase Auth endpoint và `supabase-js` rằng Admin create operation hỗ trợ ghi metadata server-managed ngay trong cùng lệnh tạo user, không phải bước update sau khi tạo. Tài liệu `auth.admin.createUser` hiện được tra cứu mô tả create user và ví dụ `user_metadata`, chưa đủ để khẳng định khả năng create-time `app_metadata`; vì vậy đây mới là hướng khảo sát, chưa được coi là khả thi/chốt. Không triển khai dựa trên giả định.

#### 41.2 Reconciliation khi có marker

1. Recovery actor claim reconciliation lease bằng CAS/version; không gọi create/invite lại.
2. Dùng Auth Admin API server-side để tìm candidate theo email đã chuẩn hóa chỉ như locator; phân trang đầy đủ theo API contract, không dừng ở trang đầu.
3. Với mỗi candidate, lấy bản ghi Auth hiện hành từ Auth server và kiểm tra marker server-managed; so digest constant-time với digest đã commit trên đúng attempt. Email không tham gia chứng minh ownership.
4. Chính xác một Auth user có marker khớp, attempt không mâu thuẫn và marker thuộc đúng project/environment: ghi event `reconciled_created`, gắn `observed_auth_user_id`, xác lập `auth_provenance='created_by_operation'` và tiếp tục finalize theo transaction/policy.
5. Không có candidate/marker: không kết luận no-side-effect ngay; Auth có thể chưa hiển thị hoặc API listing chưa nhất quán. Giữ `outcome_unknown`, tiếp tục reconciliation theo bounded schedule/manual review. Chỉ kết luận no-side-effect khi có bằng chứng provider-specific đáng tin cậy, không chỉ vì search trả rỗng.
6. Marker sai, nhiều candidate, marker trùng ở attempt khác, candidate đã tồn tại trước attempt, hoặc evidence mâu thuẫn: `conflict`/`needs_review`; không attach/delete.

#### 41.3 Nếu Auth API không hỗ trợ atomic create-time marker

Không thể đóng crash window bằng cách tạo user trước rồi gọi update metadata sau: crash giữa hai bước vẫn không chứng minh được ownership. Auth trigger chỉ có thể làm correlation nếu marker đã có sẵn trên row tại thời điểm INSERT và trigger có thể xác thực marker; không tự suy ra operation từ email. Nếu không có cơ chế marker/correlation đáng tin cậy được ghi nguyên tử cùng việc tạo Auth user, trường hợp Auth tạo xong nhưng response mất phải giữ `needs_review`; không auto attach. Có thể yêu cầu Admin xử lý thủ công qua quy trình xác minh độc lập.

#### 41.4 Không được dùng làm bằng chứng

- Trùng email, cùng tên/số điện thoại, cùng thời điểm tạo, `created_at` gần lúc request.
- `user_metadata` hoặc bất kỳ metadata nào client/user có thể tự sửa.
- Client-supplied operation/attempt ID không được server xác thực.
- Chỉ có HTTP success log nếu không có Auth user ID/response được xác thực và log có thể bị mất.
- Không tìm thấy user trong một lần list/search; đây không phải bằng chứng không có side effect.

#### 41.5 Test bắt buộc trước khi triển khai

- Marker được gắn atomically tại create-time; crash ngay sau khi Auth commit nhưng trước khi operation ghi result vẫn tìm lại đúng user.
- User không thể sửa marker; client metadata không thể giả marker.
- Marker của attempt A không thể xác minh cho attempt B, operation khác hoặc project khác.
- Pagination/listing, eventual consistency, duplicate email, concurrent requests, Auth API timeout, trigger failure, marker missing/modified/duplicated.
- Không log raw marker, access token, service key, email hoặc payload nhạy cảm.

**Trạng thái:** proposal cần review; marker create-time support chưa được xác minh cho endpoint/SDK cụ thể. Fail-closed: nếu không có bằng chứng correlation, `needs_review`. Chưa sửa DDL 021, chưa viết RPC/worker, không chạy SQL hoặc thay đổi Supabase.


### 42. Technical verification: createUser khác inviteUserByEmail về create-time app_metadata (20/11/2026)

Đã kiểm tra `supabase/auth-js` và Supabase Auth server source hiện hành trên nhánh `master`:

1. `supabase.auth.admin.createUser(attributes)` nhận `AdminUserAttributes`; type hiện hành khai báo `app_metadata?: object`. SDK gửi nguyên `attributes` trong POST `/admin/users`. GoTrue `adminUserCreate` nhận `AppMetaData`, tạo user trong DB transaction, sau đó gọi `user.UpdateAppMetaData(tx, params.AppMetaData)` trong chính transaction đó trước commit. Vì vậy, với endpoint **createUser**, server-managed marker có thể được ghi nguyên tử cùng quá trình tạo Auth user theo source hiện tại. Đây là bằng chứng source-level, chưa phải xác nhận version đang chạy trong project; cần pin phiên bản Auth server và `@supabase/supabase-js` trước implementation.

2. Nhưng luồng nghiệp vụ Invite Saga của BAOTRI Mini là **invite email**, không đơn thuần `createUser`. SDK `inviteUserByEmail(email, options)` hiện chỉ gửi body `{ email, data: options.data }` tới POST `/invite`; `data` được lưu ở `user_metadata`, không có `app_metadata` parameter. GoTrue `InviteParams` hiện chỉ nhận `Email` và `Data`; endpoint tạo user qua signup flow và không nhận create-time `AppMetaData`. Do đó không được chuyển marker sang `user_metadata`.

3. `generateLink({type:'invite', ...})` cũng không được mặc định xem là hỗ trợ marker; SDK generateLink body phải được kiểm tra theo `GenerateLinkParams`/server handler version cụ thể. Tài liệu hiện hành chỉ mô tả custom data/user_metadata cho invite; chưa có căn cứ để dùng app_metadata làm correlation marker trong native invite flow.

**Kết luận quan trọng:** hướng `app_metadata` create-time marker có cơ sở cho `admin.createUser`, nhưng **không áp dụng trực tiếp cho `admin.inviteUserByEmail`** đang phù hợp với luồng Invite Saga. Không được ghi nhận đây là giải pháp đã đóng crash window của Invite Saga.

Các hướng còn lại cần đánh giá riêng, không tự ý chọn:
- Kiểm tra khả năng Supabase Auth hook/before-user-created hook nhận correlation marker server-trusted và bảo toàn nó trong transaction; phải chứng minh semantics cụ thể, không dựa vào payload client.
- Xem xét thay đổi quy trình provisioning (ví dụ createUser + cơ chế gửi invite riêng) chỉ khi chấp nhận được khác biệt về hành vi email/confirmation và bảo đảm không có khoảng hở tạo user rồi mới gửi mail; đây là thay đổi nghiệp vụ, chưa được duyệt.
- Nếu không có correlation atomic cho native invite endpoint, giữ `outcome_unknown`/`needs_review`, manual review; không auto attach.

**Nguồn source đã kiểm tra:** `supabase/auth-js` `GoTrueAdminApi.ts`, `lib/types.ts`; `supabase/auth` `internal/api/admin.go`, `internal/api/invite.go`. Source trên nhánh master có thể thay đổi; trước implementation phải pin release/commit tương ứng với project. Chưa sửa DDL 021, chưa tạo RPC/worker, không chạy SQL hoặc thay đổi Supabase.


### 43. Proposal: Before User Created Hook làm correlation receipt cho native invite (20/11/2026)

#### 43.1 Kết luận source-level

Supabase docs hiện hành mô tả Before User Created Hook chạy ngay trước khi user được insert, payload gồm `metadata` (request UUID/time/name/IP) và `user` (có `id`, `email`, `app_metadata`, `user_metadata`); hook có thể allow hoặc reject, không có contract để sửa user object. HTTP Hook payload phải verify theo Standard Webhooks signature. Supabase Auth source hiện hành cho thấy native `Invite` route gọi `triggerBeforeUserCreated` chỉ khi `isCreate == true`, trước transaction tạo user; `InviteParams.Data` được đưa vào user metadata. `ToUserModel`/`NewUser` sinh UUID user ở server trước khi hook được gọi. Vì vậy có thể khảo sát một **pre-create correlation receipt**, không phải metadata mutation.

#### 43.2 Luồng đề xuất

1. Edge Function tạo random correlation token đủ entropy (>=256 bit) cho đúng `operation_id + attempt_id`. Không nhận token từ client. Trước khi gọi Auth, lưu digest + key version của token vào attempt record bằng internal RPC; commit attempt và digest trước network dispatch. Raw token chỉ tồn tại trong Edge Function memory và request `inviteUserByEmail({data})`; không log token.
2. Đặt token vào một reserved key trong `data` (tức user_metadata transport). Dữ liệu này **không được tin** và không được dùng làm authorization/provenance trực tiếp. Nó chỉ là locator/correlation challenge. Token có thể còn trong user_metadata sau create; xem là opaque non-authorizing marker, không chứa operation data/PII/secret có quyền truy cập. Không sử dụng marker trong RLS, JWT authorization hoặc permission.
3. Cấu hình HTTP Before User Created Hook. Hook bắt buộc verify Standard Webhooks signature + timestamp/replay policy; parse đúng payload. Nếu reserved marker key xuất hiện, hook tính digest bằng secret/key version phía server và đối chiếu attempt đang `auth_calling`, marker chưa consume, đúng project/environment, đúng email fingerprint/operation/attempt. Thiếu hoặc mismatch => reject, không ghi event. Với signup thông thường không có reserved key, áp dụng policy signup bình thường.
4. Sau khi marker hợp lệ, hook gọi internal server-only RPC để ghi append-only `hook_observation`/correlation receipt: webhook event ID, hook request UUID, operation_id, attempt_id, Auth-generated `user.id`, project/environment, marker digest/key version, observed time. Unique webhook ID và unique attempt binding; cùng webhook replay idempotent; attempt đã map user khác => conflict. RPC chỉ cho service-side caller, không public/anon/authenticated; không nhận actor do client chỉ định. Commit receipt bền vững rồi hook mới trả HTTP 200 allow.
5. Auth tiếp tục tạo user. Khi reconcile, đọc receipt từ DB và query Auth Admin `getUserById(receipt.auth_user_id)` trong đúng project. Chỉ khi Auth user hiện tồn tại với đúng ID và dữ liệu provider phù hợp mới có thể xác lập `created_by_operation`; email chỉ là consistency check, không phải proof. Receipt một mình chưa chứng minh user đã commit vì hook chạy trước insert.
6. Nếu hook ghi receipt thành công nhưng Auth transaction sau đó rollback, receipt là orphan pre-create observation; Auth user không tồn tại. Không được finalize/attach, không tự coi một lần query không thấy là definitive no-side-effect; giữ unresolved và theo dõi/review. Nếu hook không thể ghi receipt bền vững, hook fail closed (reject); không cho Auth tiếp tục.

#### 43.3 Giới hạn và điều kiện bảo mật

- Marker nằm trong `user_metadata` chỉ là phương tiện chuyển correlation token vào hook. Chính hook phải xác minh token với digest đã commit trước dispatch; không tin metadata chỉ vì nó xuất hiện trong payload. Sau hook, bằng chứng là signed hook + durable receipt + Auth-generated immutable user ID + xác nhận Auth user tồn tại.
- Không để client gọi trực tiếp service-role invite path hoặc truyền correlation token; Edge Function server-side tự tạo token. Không ghi raw token vào DB/log/receipt. Chống replay bằng attempt state, unique constraints, expiry và consumed state.
- Hook có thể được gọi cho nhiều loại account creation; reserved marker phải chỉ được chấp nhận khi khớp một invite attempt hợp lệ. Không biến hook thành cơ chế tạo membership hoặc cấp quyền.
- `Invite` route chỉ gọi Before User Created khi `isCreate == true`. Nếu email đã có Auth user chưa xác nhận, endpoint đi nhánh existing user và hook không chạy. Vì vậy giải pháp này **không chứng minh provenance cho preexisting account**; trường hợp đó vẫn cần independent verification hoặc `needs_review`.
- External hook receipt và Auth user insert không phải cùng một transaction. Thiết kế an toàn dựa trên hai pha: receipt trước + exact Auth user ID tồn tại sau. Receipt orphan không được dùng để attach. Cần kiểm tra webhook retry/timeout và tính nhất quán Auth read bằng test thực tế.
- Hook availability/plan, signature rotation, timeout, retry semantics, rate limits, event ID semantics, Auth user lookup consistency, project version và SDK/Auth release phải được pin/test trước triển khai. Không suy diễn HTTP 200 của hook đồng nghĩa Auth create đã commit.

#### 43.4 Test bắt buộc

- Hook event signature sai, timestamp cũ, replay cùng webhook ID; duplicate/reordered hook calls.
- Token sai, token của operation/attempt khác, marker missing, expired, consumed, email/project mismatch.
- Hook DB receipt insert success nhưng Auth transaction rollback; receipt tồn tại nhưng Auth getUserById không thấy user.
- Hook DB receipt insert timeout/lost response; retry cùng webhook ID không tạo duplicate.
- Auth create commit nhưng response mất; receipt + exact user ID cho phép reconcile đúng.
- User metadata bị sửa/xóa sau khi tạo: provenance vẫn dựa vào immutable receipt, không dựa metadata hiện tại.
- Existing unconfirmed account: hook không chạy, không gán `created_by_operation`.
- Không log token, email raw, webhook secret, service key hoặc invite URL.

**Trạng thái:** proposal nghiên cứu; chưa được người dùng phê duyệt. Supabase source/docs trên bản hiện hành; cần pin phiên bản dự án trước implementation. Chưa sửa DDL 021, chưa viết RPC/Edge Function, không chạy SQL hoặc thay đổi Supabase.


## 44. Technical verification: Before User Created Hook có thể nhận correlation marker trong native invite (20/11/2026)

Đã kiểm tra Supabase Auth source hiện hành trên `master` và tài liệu Hook:

- `internal/api/invite.go`: khi email chưa có Auth user (`isCreate == true`), `/invite` tạo `SignupParams` với `Data: params.Data`, gọi `ToUserModel(false)`, rồi gọi `triggerBeforeUserCreated(...)` **trước** `db.Transaction(...)` tạo Auth user. Vì vậy native `inviteUserByEmail({ data })` có đường đi vào Before User Created Hook khi tạo user mới; không chỉ là signup thông thường.
- `SignupParams.Data` được đưa vào `user_metadata` của user model; Hook nhận payload `user` theo shape Auth user, có `user_metadata`. UUID user đã được tạo ở bước `ToUserModel` trước khi Hook chạy.
- Do đó có thể dùng một reserved key trong `data` làm **transport cho correlation token ngẫu nhiên**, không phải dùng metadata làm bằng chứng tự thân. Edge Function phải tạo token >=256-bit, lưu digest + key version vào attempt trước dispatch; Hook xác minh signed webhook và token digest với đúng operation/attempt/project/state/email fingerprint, sau đó ghi durable receipt append-only qua internal server-only RPC, chứa Auth-generated user ID. Không log hoặc lưu raw token.
- Hook phải commit receipt thành công rồi mới trả allow. Sau đó reconciliation phải xác nhận Auth user tồn tại bằng đúng ID qua Admin lookup. Receipt tồn tại nhưng user không tồn tại là orphan pre-create observation, không được finalize/attach; giữ unresolved. Nếu receipt không ghi được, Hook fail closed.
- `user_metadata` vẫn là dữ liệu user-editable sau khi tạo; không dùng marker hiện tại cho authorization/RLS/JWT. Bằng chứng provenance là sự kiện Hook có chữ ký được xác minh + receipt bền vững tại thời điểm pre-create + Auth user ID chính xác được xác nhận tồn tại, không phải giá trị metadata đọc lại sau này.
- Nhánh email đã có Auth user (`isCreate == false`, gồm existing unconfirmed account) không gọi Before User Created Hook. Vì vậy phương án chỉ giải quyết crash window của nhánh tạo user mới; không chứng minh ownership cho tài khoản có sẵn.

**Kết luận kỹ thuật:** proposal correlation receipt qua Before User Created Hook có cơ sở source-level cho native `inviteUserByEmail` ở nhánh tạo mới. Chưa phải implementation-ready: cần pin GoTrue/Auth + SDK version thực tế, kiểm tra cấu hình/plan Hook, và test end-to-end các cửa sổ crash, timeout, replay, orphan receipt, rollback và exact-ID lookup consistency. Không thay đổi policy fail-closed; không tự động retry khi outcome unknown.

**Trạng thái:** technical verification, proposal chưa được người dùng phê duyệt. Chưa sửa DDL 021, chưa tạo RPC/Edge Function, không chạy SQL hoặc thay đổi Supabase.


## 45. Technical verification: After User Created Hook và vị trí receipt an toàn hơn

Đọc source Supabase Auth tại commit `10ef10789d1ee4fb422b448047e67e3e264c0482`:

- `Invite()` thực hiện `db.Transaction(...)` để tạo Auth user, identity, audit log và gửi invite. Sau khi transaction trả về thành công, code gọi `triggerAfterUserCreated(r, db, user)`; `triggerAfterUserCreated` kiểm tra connection không còn transaction rồi mới gọi Hook. Do đó Hook được gọi sau transaction Auth đã commit.
- Source `internal/hooks/v0hooks/v0hooks.go` định nghĩa `AfterUserCreatedInput` gồm `metadata` và `user`; metadata có UUID mới được sinh cho mỗi lần gọi Hook. Không giả định UUID này là stable idempotency key hoặc cùng một ID qua retry.
- Khác với Before Hook, After Hook receipt được ghi sau khi Auth user transaction đã commit. Đây là candidate evidence mạnh hơn: signed After Hook + token/attempt correlation + Auth-generated user ID, và receipt commit bền vững.
- Lưu ý quan trọng: trong source hiện tại, `Invite()` gọi `triggerAfterUserCreated` sau transaction mà không đặt điều kiện `isCreate`. Vì vậy không giả định After Hook chỉ phát ra cho user mới. Hook handler phải chỉ xử lý event có reserved correlation token khớp chính xác một attempt đang chờ; event không có marker hoặc không khớp phải không tạo receipt, không thay đổi trạng thái Saga.
- Vì Hook được gọi sau Auth commit, nếu Hook/receipt lỗi thì Auth user có thể đã tồn tại trong khi `/invite` trả lỗi. Saga phải giữ `outcome_unknown`; không gọi Auth lại. Reconciliation chỉ có thể dùng receipt hợp lệ đã commit. Nếu không có receipt, không suy luận từ HTTP response hoặc email; giữ `needs_review`/manual recovery.
- Token vẫn chỉ là opaque transport trong `user_metadata`, không phải quyền truy cập. Edge Function tạo token >=256-bit; digest lưu trong attempt trước dispatch; verify Standard Webhooks signature; đối chiếu digest, attempt, project, trạng thái, email fingerprint; receipt unique theo `attempt_id` và ràng buộc một Auth user ID. Cùng attempt + cùng user ID replay idempotent; cùng attempt + user ID khác là conflict. Webhook metadata UUID chỉ là audit metadata.
- Receipt RPC phải server-only, append-only, không nhận actor/tenant/operation tùy ý từ payload ngoài các giá trị đã đối chiếu với attempt. Chống replay bằng attempt state, unique constraints, consumed/observed state và exact match. Không log raw token, secret, invite URL hoặc email raw.
- Existing account / existing unconfirmed user vẫn phải được kiểm tra bằng attempt marker: nếu không có marker hợp lệ thì After Hook không tạo receipt. Dù source gọi hook sau transaction cho route Invite, không được coi event không có correlation là user vừa được operation tạo.

**Kết luận cập nhật:** ưu tiên nghiên cứu After User Created Hook làm điểm ghi receipt sau Auth commit; Before Hook không còn là điểm receipt chính vì có thể tạo orphan pre-create observation. Đây vẫn là source-level feasibility, chưa phải cam kết availability trên Supabase Cloud/plan hoặc production readiness. Cần xác minh Auth/GoTrue + SDK version đã pin, hook type được bật trên project, delivery/retry/timeout semantics, và test end-to-end. Chưa duyệt implementation; không sửa DDL 021/RPC/Edge Function, không chạy SQL hoặc thay đổi Supabase.


## 46. Supabase Cloud availability and HTTP Hook delivery constraints

Đối chiếu tài liệu Supabase Auth Hooks hiện hành (20/11/2026):

- Bảng hook được Supabase công bố theo plan liệt kê Before User Created, Custom Access Token, Send SMS, Send Email (Free/Pro), MFA Verification và Password Verification (Teams/Enterprise). **After User Created không xuất hiện trong danh sách hook có thể cấu hình trên Supabase Cloud**. Vì vậy source GoTrue có `AfterUserCreated` không đủ chứng minh tính năng này được cung cấp/bật trên hosted project. Không thiết kế production phụ thuộc After Hook nếu Supabase xác nhận bằng tài liệu hoặc support chính thức rằng project có thể cấu hình nó.
- Before User Created được tài liệu công bố cho Free/Pro, nhưng chạy trước insert; receipt ở đây không chứng minh Auth user đã commit.
- HTTP Hooks dùng Standard Webhooks: phải xác minh raw request body cùng `webhook-id`, `webhook-timestamp`, `webhook-signature` bằng thư viện chuẩn; không tự parse rồi serialize lại body trước verify. Secret có dạng `v1,whsec_<base64>` và phải lưu trong secret store.
- Tài liệu hiện nêu HTTP Hook trả 429/503 kèm `retry-after` không rỗng sẽ được retry tối đa 3 lần, backoff 2 giây, tổng time budget 5 giây cho cả invocation. `Retry-After` chỉ là trigger retry, không bảo đảm đúng thời gian RFC. HTTP Hook có timeout; lỗi/timeout có thể làm Auth request fail dù side effect ở endpoint đã xảy ra.
- Vì hook retry và timeout, receipt endpoint phải idempotent theo attempt_id + Auth user ID, có unique constraint, xác minh signature/timestamp, chống replay và không thực hiện side effect không idempotent. Trả success chỉ sau khi receipt đã commit bền vững. Nếu handler không thể ghi receipt, không giả vờ success; Saga vẫn phải xử lý Auth outcome theo trạng thái unknown và không gọi lại Auth.

**Quyết định kỹ thuật tạm thời:** After Hook là source-level capability nhưng chưa được xác nhận là Supabase Cloud feature; không được coi là triển khai khả thi trên BAOTRI Mini hosted project. Before Hook có documented availability nhưng không phải proof-of-commit. Giữ fail-closed/manual review cho đến khi có một kênh correlation sau commit được Supabase Cloud hỗ trợ chính thức hoặc một provisioning workflow khác được duyệt. Không đổi DDL/RPC/Edge Function, không chạy SQL hoặc thay đổi Supabase.


## 47. Alternative Auth provisioning: createUser with server metadata marker

Review of the current Supabase JS Auth Admin API (20/11/2026):

**Confirmed API facts**
- `admin.createUser(attributes)` is server-only, accepts `app_metadata` in `AdminUserAttributes`, and does not send a confirmation email. The user email is unconfirmed unless explicitly confirmed; BAOTRI must not set `email_confirm: true` without independent proof of email ownership.
- `admin.inviteUserByEmail(email, options)` sends an invitation and its `options.data` maps to `user_metadata`; it does not expose create-time `app_metadata` in the public SDK method.
- `admin.generateLink({type:'invite', email})` handles creation of the user and returns a link; its options expose `data` mapped to `user_metadata`, not trusted create-time `app_metadata`.
- `admin.listUsers()` supports pagination (`page`, `perPage`) only; the public SDK does not expose email or app_metadata filtering. `getUserById()` requires a known Auth UUID.

**Candidate provisioning direction (not approved / not implemented)**
1. Edge Function creates a unique opaque random correlation marker for this attempt; persist only its digest/key version with the immutable attempt record before Auth dispatch.
2. Call `admin.createUser()` from trusted server code with `email_confirm:false` and the marker in server-controlled `app_metadata` at creation time. This provides a candidate positive proof because app_metadata is part of the create request, not user_metadata supplied by an end user.
3. If the response is received, verify returned user ID and exact marker before recording trusted provenance/receipt. If response is lost, reconcile by querying `auth.users` on the server/database side for the exact marker and retrieve the exact Auth UUID; email is only a locator, never proof.
4. Do not use public `listUsers()` to scan every user as a routine reconciliation mechanism; it is paginated only and does not support filters. A narrowly scoped, server-only database lookup/RPC against `auth.users` would need separate security review, least privilege, strict marker matching, and no exposure to anon/authenticated.
5. A missing marker result immediately after timeout is not proof that the create request did not commit or is no longer in flight. Keep `outcome_unknown`; no repeat `createUser()` unless a definitive no-dispatch/no-side-effect condition is established.

**Blocking unresolved issue: onboarding email / password setup**
`createUser()` does not send an invite email. `generateLink({type:'invite'})` creates the user itself and does not offer trusted app_metadata input, so it is not a direct second step for an already-created user. A possible separate email/onboarding flow (e.g. a supported recovery/setup link or custom email) has not been proven to work safely with an unconfirmed user and must be tested against the pinned Supabase Auth/SDK versions before selection. Never auto-confirm email just to bypass this gap.

**Conclusion:** `createUser + app_metadata marker` is a promising way to obtain positive Auth provenance without After User Created Hook, but it is not yet a complete replacement for native invite flow. Keep native `inviteUserByEmail` and fail-closed/manual review as current behavior until onboarding, reconciliation query, security, and timeout/crash tests are validated. No DDL/RPC/Edge Function changes or Supabase writes.


## 48. createUser onboarding: recovery link is not yet proven for unconfirmed users

Supabase docs/API review (20/11/2026):

- `admin.generateLink({type:'recovery', email})` is a documented link-generation option; it generates an email action link/OTP for a custom email provider and does not itself send email.
- The docs describe recovery as a password-recovery flow, but do not explicitly guarantee that a user created by `admin.createUser({email_confirm:false})` can receive/use a recovery link before email confirmation, nor that using that link confirms the email address. Do not assume recovery = invite/initial account activation.
- Supabase Users docs state that a user with unverified email cannot sign in by default. Invite flow is explicitly described as sending a link that confirms email and lets the user finish setup (e.g. set password). That documented behavior applies to invite flow, not automatically to createUser + recovery.
- `generateLink({type:'magiclink'})` is also not an established workaround: unverified email users cannot sign in by default, and docs do not state it confirms an unverified email created by createUser.
- `generateLink({type:'invite'})` handles user creation itself; cannot be safely chained after createUser as a generic password-setup action and has no trusted create-time app_metadata parameter.

**Conclusion:** The exact onboarding gap remains unresolved. Before considering `createUser + app_metadata marker`, a controlled isolated test on the pinned BAOTRI Supabase Auth/SDK versions must establish: (a) recovery generation for an existing unconfirmed user, (b) link verification outcome and `email_confirmed_at`, (c) ability to set password without auto-confirming, (d) expired/replayed link behavior, (e) delivery using custom SMTP/provider, and (f) whether the resulting link can be safely correlated with the Saga attempt without exposing secrets. Until then, do not implement or select this flow. Native `inviteUserByEmail` + fail-closed/manual review remains current.


## 49. Existing Auth account: verified self-acceptance flow (proposal, 20/11/2026)

**Security boundary:** an email match is only a candidate locator. An inviter must never attach an existing Auth UUID to a membership merely because the submitted email matches auth.users.email, even when email_confirmed_at is populated. The existing account holder must authenticate as that exact Auth user and explicitly accept the pending organization invitation.

### Proposed flow

1. **Create invitation intent only.** An authorized Admin creates an immutable invitation operation with normalized target-email fingerprint, requested role, organization, original actor, expiry and canonical request fingerprint. Do not call inviteUserByEmail, createUser, or any Auth provisioning endpoint when the system has positively identified an existing account. Do not create a membership or assign a role yet.
2. **Keep it pending.** Add a candidate Saga state such as awaiting_existing_account_acceptance (schema/state-machine change not approved). The pending invitation is not an active membership and grants no organization access. It can be cancelled/revoked by an authorized Admin and expires according to a policy still to be specified.
3. **Require the invitee's own authenticated session.** After signing in to the existing account, the user opens a pending-invitations view. A narrowly scoped authenticated RPC returns only invitations whose target email matches the current Auth user's authoritative, currently verified email. Do not accept a caller-supplied Auth UUID or email as identity evidence; derive the actor from auth.uid() and read the authoritative Auth record server-side.
4. **Explicit acceptance.** The invitee chooses Accept. In one database transaction, the server revalidates: current Auth UID; authoritative email is verified (email_confirmed_at IS NOT NULL); normalized verified email matches the invitation's stored fingerprint; invitation is still pending/unexpired/not revoked; organization is active; role is still valid; inviter's authority (or an authorized Admin's reapproval if policy later permits) remains valid; and no conflicting membership exists. Then atomically create membership + one role assignment + audit + Shared Receipt + operation completion. Record the accepting Auth UID and evidence that acceptance occurred in the authenticated session.
5. **No silent attachment.** Until the invitee accepts, no membership, role, tenant access or Auth-user association is created. Decline/cancel/expiry are explicit terminal or revocation transitions to be designed; they must be idempotent and audited.

### Existing account variants

- **Existing account with verified email:** eligible to discover and accept only after signing in as that exact account. preexisting_verified is recorded only after the server verifies the authenticated UID and current verified email and commits the explicit acceptance. Email match alone is insufficient.
- **Existing account with unverified email:** do not attach, auto-confirm, reset password, or assume inviteUserByEmail will deliver an activation message. The user must complete the normal supported Auth verification/sign-in process first; only then can the same self-acceptance flow run. Until then keep the invitation pending or needs_review according to expiry/recovery policy.
- **Multiple matching candidates, changed email, missing/ambiguous Auth record, stale or conflicting operation:** fail closed to needs_review; no automatic attach/delete. If the user changes their verified email after the invitation was issued, require a new invitation or separately approved re-verification flow; do not silently rewrite the original immutable intent.
- **No existing account:** remains the separate new-user provisioning path. Existing fail-closed Auth provenance and timeout/crash policy remains unchanged.

### Privacy and abuse controls

- Pending-invitation discovery must not expose organization roster, arbitrary email existence, Auth UUID, phone, role details beyond what the invitee needs, invite token, or another person's invitation. Return minimal fields and only rows bound to the current verified Auth email.
- Rate-limit and audit discovery/accept/decline attempts. Avoid different unauthenticated responses that reveal whether an email has an Auth account.
- Do not trust user_metadata, client-supplied email/UID, JWT user-editable metadata, or an email-only lookup as proof. Use server-derived auth.uid() plus authoritative Auth record and verified email state.
- Recheck all conditions in the final transaction; a prior list result is only a snapshot and cannot authorize acceptance later.
- Membership + role + audit + Shared Receipt + Saga transition must commit atomically. Duplicate acceptance with the same operation/actor is idempotent; competing or mismatched acceptance is rejected without partial writes.

### Open design items

Invitation notification/delivery for existing accounts; whether pending invites are surfaced in-app only or via a separate email; expiry and resend policy; decline/revoke states; handling changed email and multiple pending invitations; whether original inviter must retain users.manage or an Admin can reapprove; rate limits and audit retention; exact RPC response shape and enumeration controls. Verify current Auth API behavior against pinned versions before implementing any delivery mechanism.

**Status:** recommended workflow for design review only. It is not yet an approved schema/state-machine change. Do not add the candidate state to DDL 021, do not implement RPC/Edge Function, do not run SQL, and do not modify Supabase. Current native inviteUserByEmail + fail-closed/manual review remains unchanged.


## 50. Existing-account invitation notification channels (proposal, 20/11/2026)

### Recommendation

Use **in-app pending invitations as the authoritative channel**. Treat email as an optional, secondary notification only. Neither channel is proof of identity, account ownership, email verification, or acceptance. The only acceptance authority is the signed-in invitee's authenticated session and the server-side acceptance transaction defined in §49.

### A. In-app inbox — primary

- After sign-in, the client calls a narrow authenticated RPC to list pending invitations for the current Auth UID, matched server-side against the authoritative currently verified email. Derive identity from auth.uid(); never accept client-supplied email or Auth UID.
- Return only minimum display fields: opaque invitation/operation identifier, organization display name, requested role label if approved for disclosure, inviter display label if safe, created/expiry timestamps, and current pending state. Never return target email, Auth UUID, internal fingerprints, receipt IDs, tokens, secret material, or private Saga/attempt details.
- Listing is read-only. It does not reserve, accept, activate or grant tenant access. Accept invokes the separate transactional RPC and rechecks every invariant from §49.
- Refresh on app launch, login, and inbox navigation. A Realtime event may be used only as a wake-up hint; client then fetches the authorized inbox via RPC. Do not broadcast invitation row contents or treat a Realtime payload as authorization.
- If Realtime is unavailable, polling/on-demand refresh remains sufficient. Correctness must not depend on websocket delivery.

### B. Email notification — optional secondary

- Send a generic notification that an invitation is waiting, with a link to the application's normal sign-in page/inbox. Do not put an acceptance bearer token, Auth confirmation token, password-reset link, raw Auth UUID, or secret in the notification.
- Opening the email link only opens the application. The recipient must authenticate normally, load the in-app inbox, and explicitly accept. A forwarded email or link must not confer access.
- Do not call Auth invite/recovery APIs to notify an existing account. This is a business notification, not an Auth activation or verification message.
- Use a separately configured transactional email provider through a trusted server-side sender (for example, a controlled SMTP provider or a reviewed provider API integration). Supabase custom SMTP is relevant to Auth mail delivery; Send Email Auth Hook replaces Auth email sending and should not be repurposed as the generic BAOTRI invitation-notification bus. Keep Auth security mail and business notification streams logically separate.
- Never expose provider credentials in the client. Disable open/click tracking where possible; do not place sensitive invitation data in URLs or provider metadata. Configure sender-domain SPF, DKIM and DMARC and monitor bounce/complaint rates.
- Avoid account-enumeration responses: the Admin UI should report only that the invitation intent was recorded, not whether a target address has an Auth account. Email send success/failure must not reveal account existence to an unauthenticated requester.

### Delivery consistency and PII

- If email is enabled, use a transactional outbox: commit invitation intent and a minimal notification job atomically; a trusted worker sends after commit. The worker must be idempotent by notification_id, record attempt/result metadata without raw provider response, and use bounded retry/backoff. Delivery failure never changes membership, Auth provenance, or invitation acceptance state.
- The outbox needs a securely recoverable recipient address. Do not store raw email in a broadly readable queue or logs. Before implementation, decide whether to keep encrypted recipient PII in a narrowly privileged private record with explicit key/retention policy, or to use a separately reviewed delivery handoff that avoids persistent plaintext. The existing email fingerprint alone cannot be used as a delivery address.
- Do not send before the invitation transaction commits. Do not claim delivery means inbox receipt; provider acceptance is not recipient receipt. Do not auto-resend indefinitely. Rate-limit per organization and recipient; audit who requested/resend and why.
- Current project policy is manual recovery initially and no background worker unless separately approved. Therefore email delivery remains disabled/not implemented until outbox, worker ownership, provider, secrets, retention, retries and operational monitoring are designed and approved.

### Decision status

Recommended order: (1) build the authenticated in-app inbox and explicit accept flow; (2) add optional email notification only after a secure outbox and sender are approved; (3) Realtime is an optimization, never a dependency. This is a design recommendation, not implementation approval. No DDL 021, RPC, Edge Function, worker, SQL or Supabase changes are authorized by this section.


## 51. In-app Invitation Inbox — dữ liệu, quyền và RPC (design proposal)

### Mục tiêu và nguyên tắc
- In-app Inbox là kênh hiển thị lời mời hiện có cho đúng người nhận; không phải nguồn trạng thái độc lập và không cấp quyền tenant.
- Không tạo bảng Inbox riêng ở giai đoạn đầu. Dùng `organization_member_invite_operations` làm nguồn trạng thái gốc; Inbox là projection qua API/RPC hẹp. Tránh duplicate state và reconciliation giữa hai bảng.
- `organization_member_invite_attempts` và `organization_member_invite_attempt_events` tiếp tục là dữ liệu nội bộ; không xuất hiện trong response Inbox.
- Chỉ hiển thị trạng thái dẫn xuất `pending` cho lời mời đang chờ người nhận. Không trả enum Saga nội bộ như `auth_outcome_unknown`, `needs_review`, `failed_terminal`, `auth_calling` hoặc thông tin xử lý Auth.

### Response allowlist
Ban đầu chỉ trả:
- `invitation_id`: opaque operation UUID dùng làm tham chiếu lời mời; không phải bearer token/secret.
- `organization_name`: tên hiển thị tổ chức, nếu có.
- `requested_role_label`: nhãn vai trò đã được xác định là an toàn để hiển thị.
- `created_at`, `expires_at`.
- `display_status`: giá trị dẫn xuất cố định `pending`.

Không trả email đích, Auth UUID, member ID, fingerprint/digest/key version, invite token/URL, receipt ID, attempt ID/events, provider response, raw Saga state hoặc dữ liệu riêng tư khác. Tạm thời không trả inviter label để giảm PII và phụ thuộc join hồ sơ.

### Quyền và ranh giới truy cập
- Unauthenticated/anon: không được đọc hoặc chấp nhận Inbox.
- Authenticated nhưng email chưa xác minh: không được đọc hoặc chấp nhận.
- Tài khoản đã đăng nhập và email được Auth xác minh: chỉ thấy lời mời khớp với email xác minh hiện tại của chính tài khoản.
- Inviter/Admin không được đọc Inbox của người nhận chỉ vì họ tạo lời mời.
- Không có API nhận email tùy ý để dò lời mời hoặc dò sự tồn tại của Auth account.
- Client không được SELECT trực tiếp bảng Saga, attempts hoặc attempt events; các bảng này giữ quyền truy cập server-only và chính sách RLS phòng thủ phù hợp.
- Không dùng user_metadata/client metadata/JWT user-editable claims làm căn cứ xác thực email hoặc phân quyền.

### Đọc Inbox và chấp nhận
- List là snapshot chỉ đọc; không reserve invitation, không activate membership, không cấp tenant access.
- Accept phải revalidate trong transaction: danh tính người chấp nhận; email Auth authoritative đã xác minh; lời mời đúng người nhận, còn pending, chưa hết hạn/thu hồi; tổ chức active; role hợp lệ; không có membership xung đột.
- Khi thành công, membership + single role + audit + Shared Receipt + Saga completion commit nguyên tử.
- Client chỉ gửi invitation/operation ID và mutation/idempotency key ổn định. Không nhận actor Auth UID, email, organization ID hay role từ client làm căn cứ cấp quyền.
- Accept replay cùng invitation và cùng actor phải idempotent; cùng invitation nhưng actor khác phải từ chối. Việc xác định chi tiết mutation ID và receipt gắn với acceptance cần thống nhất với Shared Receipt design trước DDL.
- Mọi lỗi/điều kiện không còn hợp lệ phải fail closed; không tạo membership/role một phần.

### Điểm chặn kỹ thuật: HMAC fingerprint
Saga lưu HMAC digest, còn key material nằm ngoài Database. PostgreSQL không thể tự tính lại HMAC nếu không có cơ chế cung cấp key đáng tin cậy. Không được giải quyết bằng email client gửi hoặc so khớp email không xác minh.
- Phương án cần nghiên cứu: Edge Function xác thực bearer token bằng Auth server-side, lấy authoritative user/email verification, tính HMAC bằng secret manager, rồi gọi RPC nội bộ truyền actor UID và digest.
- RPC nội bộ chỉ cho server role gọi; không expose cho anon/authenticated. Edge Function là trust boundary cần review riêng: xác minh JWT/Auth user, chống replay, rate limit, secret handling và không log PII.
- RPC vẫn phải revalidate trạng thái lời mời và thực hiện toàn bộ acceptance transaction nguyên tử.
- Chưa chốt phương án này; cần kiểm chứng khả năng triển khai và threat model trước khi thiết kế DDL/RPC cuối.

### Pagination, enumeration và trạng thái
- Dùng keyset pagination, giới hạn page size; không OFFSET/COUNT.
- Không trả tổng số lời mời hoặc khác biệt lỗi giúp dò email/Auth account.
- Realtime nếu có chỉ là wake-up hint; client phải gọi lại endpoint được bảo vệ. Poll/on-demand refresh vẫn hoạt động khi Realtime mất kết nối.
- Không cần Inbox table/cache độc lập ban đầu. Nếu sau này cần projection vật lý vì tải, phải có owner, invalidation và reconciliation design riêng.

### Trạng thái
Đây là design proposal. Chưa phê duyệt DDL, RPC, Edge Function, worker, SQL hoặc thay đổi Supabase. Các điểm cần giải quyết trước implementation: HMAC trust boundary; contract idempotency/Shared Receipt cho acceptance; expiry/revoke/decline policy; rate limit và audit retention.



## 52. In-app Invitation Inbox — RPC contract and recipient matching refinement (design proposal, 20/11/2026)

### Tách digest người nhận khỏi request fingerprint
- Không dùng `request_fingerprint_digest` để tìm Inbox: digest đó đại diện toàn bộ canonical request (recipient + organization + role + actor + intent), không phải digest riêng của email.
- Cần một recipient lookup digest riêng, ví dụ `recipient_email_digest`, kèm `recipient_digest_key_version` và `recipient_normalization_version`. Digest dùng HMAC-SHA-256 với key/purpose tách biệt (domain separation) khỏi request fingerprint; key material chỉ ở secret manager.
- Email normalization phải là một canonicalization contract duy nhất, versioned và test bằng các trường hợp Unicode/domain/case/whitespace. Không tự ý áp dụng provider-specific alias folding (dấu chấm, plus-addressing).
- Không lưu email thô trong bảng Saga nếu không có quyết định riêng về mã hóa, quyền truy cập, retention và xóa. Digest không thể dùng để gửi email.
- Key rotation phải cho phép tra cứu digest theo các key version còn hiệu lực; không fallback sang so khớp email không xác minh. Retire key chỉ sau khi mọi lời mời còn hiệu lực đã được migrate/reissued hoặc có kế hoạch dual-key rõ ràng.

### Trust boundary và RPC nội bộ
- Client chỉ gọi Edge Function công khai bằng access token hiện tại; không được gửi actor UID/email. Edge Function xác thực token bằng Auth server-side (không chỉ decode JWT), lấy UID, email và email-confirmed state từ Auth authoritative.
- Edge Function chuẩn hóa email và tính recipient digest bằng secret manager. Không log access token, email thô, digest, secret hoặc response Auth chứa PII.
- Edge Function gọi RPC ở schema private/internal bằng server credential. RPC không được expose qua Data API; revoke EXECUTE khỏi PUBLIC, anon và authenticated; chỉ cấp cho server role cần thiết. Không đặt SECURITY DEFINER function trong exposed schema.
- RPC nhận actor UID + verified email (chỉ truyền nội bộ) + digest/key version + các tham số nghiệp vụ. Bên trong transaction, kiểm tra actor UID tồn tại trong auth.users và email/email_confirmed_at hiện tại vẫn khớp giá trị Edge Function vừa xác minh; lock phù hợp trên auth.users row để tránh race email-change trong lúc acceptance. Sau đó mới đối chiếu digest.
- RPC phải kiểm tra tham số không null, key version allowlist, giới hạn độ dài, invitation state và expiry; mọi mismatch fail closed. Không có RPC nhận email tùy ý từ browser.
- Đây là trust-boundary proposal; cần test quyền schema/function, bearer validation, email-change race, key rotation và Edge Function secret handling trước khi implementation.

### Contract đọc Inbox
- Public Edge Function: `list_pending_invitations(cursor?, limit?)`. Không nhận email, UID, organization ID hay role.
- Nội bộ RPC lọc theo recipient digest + key version, trạng thái Saga được phép hiển thị pending/awaiting-existing-account-acceptance, chưa hết hạn, chưa revoke/cancel, tổ chức còn active và role vẫn hợp lệ.
- Chỉ trả allowlist đã chốt ở §51: invitation_id, organization_name, requested_role_label, created_at, expires_at, display_status='pending'. Không trả recipient digest hay internal state.
- Pagination keyset theo cặp ổn định `(created_at, operation_id)`, thứ tự xác định; page size mặc định 20, tối đa 50. Cursor chỉ là continuation marker, không phải credential; validate cấu trúc/version và ràng buộc với actor/digest ở server. Không OFFSET/COUNT/total.
- Không trả lỗi phân biệt “email không có tài khoản”, “không có lời mời”, “email chưa xác minh” theo cách cho phép dò tài khoản. Edge Function chỉ trả danh sách rỗng hoặc lỗi xác thực chung phù hợp; rate-limit theo actor và IP/device signals.

### Contract chấp nhận
- Public Edge Function: `accept_invitation(invitation_id, mutation_id)`. Client không gửi actor UID, email, organization ID, role hoặc recipient digest.
- Edge Function xác thực bearer lại ở mỗi request, lấy authoritative UID/email/verified state và tính digest; không tin kết quả list cũ.
- RPC trong một transaction khóa invitation/Saga row và revalidate actor/email hiện tại, recipient digest, invitation state, expiry/revocation, organization active, role validity, membership uniqueness/conflict và inviter/approval policy.
- Tạo membership + đúng một role + audit + Shared Receipt + acceptance result + Saga completion trong cùng transaction. Không có trạng thái membership/role nửa chừng.
- Idempotency: cùng invitation_id + cùng authenticated actor + cùng mutation_id/payload trả lại cùng receipt/result; cùng mutation_id với payload khác là conflict; invitation đã được actor đó accept thì replay theo receipt gốc. Actor khác không được nhận receipt hoặc membership. Cần reconcile chính xác với Shared Receipt unique key và mutation receipt schema trước DDL.
- Nếu email đổi hoặc mất verified status giữa list và accept, reject/fail closed; yêu cầu người dùng xác minh email mới và tạo/khôi phục invitation theo policy, không tự động attach.

### Những gì chưa chốt
- Tên cột digest cuối cùng, normalization contract và key rotation/migration.
- Có thể khóa auth.users row phù hợp trong RPC hosted Supabase hay không; phải xác minh quyền/transaction semantics trên project test trước khi dựa vào nó.
- Candidate state `awaiting_existing_account_acceptance` và điều kiện chuyển từ intent sang pending Inbox.
- Expiry, revoke, decline, inviter authority reapproval, rate limit, audit retention và Shared Receipt acceptance key.
- Đây vẫn là design proposal. Không tạo DDL/RPC/Edge Function, không chạy SQL, không thay đổi Supabase.


## 53. Supabase Hosted — auth.users row-lock feasibility for invitation acceptance (read-only investigation, 20/11/2026)

### Read-only catalog check on BAOTRI-Mini-Test
Project checked: `oyzhxgzltpdebpymuicb`, PostgreSQL 17.12. No schema/data changes were made.
- `auth.users` owner is `supabase_auth_admin`; RLS is enabled; FORCE ROW LEVEL SECURITY is false; catalog query found zero explicit policies on this table.
- `postgres` is not superuser, but has `BYPASSRLS=true`, `USAGE` on schema auth, and SELECT + UPDATE privileges on `auth.users`.
- `supabase_auth_admin` also has SELECT + UPDATE; it is not BYPASSRLS.
- `service_role`, `authenticated`, and `anon` do not have SELECT or UPDATE on `auth.users`.
- A read-only `SELECT id FROM auth.users WHERE false FOR UPDATE` executed as postgres without permission error. The false predicate ensured no actual user row was locked. This verifies SQL privilege/parse feasibility only, not a live concurrent lock test.
- These are observations for this Test project only. Do not assume identical grants/ownership on every customer Production project; repeat the catalog preflight on each target project before deployment.

### What this establishes
PostgreSQL `FOR UPDATE` locks the selected row against concurrent updates/deletes/competing row locks until the transaction ends. GoTrue's current source-level email-change confirmation path updates the `auth.users.email` field as part of its transaction (`ConfirmEmailChange` -> `UpdateOnly(..., "email", ...)`). Therefore, when the deployed Auth version follows this path, locking the exact `auth.users` row serializes invitation acceptance against a concurrent confirmed email change.

Sources reviewed:
- PostgreSQL 17 explicit row locking: https://www.postgresql.org/docs/17/explicit-locking.html
- PostgreSQL 17 consistency and blocking locks: https://www.postgresql.org/docs/17/applevel-consistency.html
- GoTrue current source, `ConfirmEmailChange`: https://github.com/supabase/auth/blob/master/internal/models/user.go
- Supabase User Management: Auth schema is not exposed through the auto-generated Data API: https://supabase.com/docs/guides/auth/managing-user-data

### Recommended acceptance transaction pattern — proposal only
1. Edge Function validates the bearer with Auth server-side and obtains the authoritative UID, exact current email string and email-confirmed state. It computes the recipient HMAC using the secret-manager key. Client supplies none of these values.
2. Internal acceptance function is owned by `postgres` (or another specifically verified role with equivalent SELECT + UPDATE + BYPASSRLS capability), uses `SECURITY DEFINER`, fixed empty `search_path`, and fully qualified object names. It first selects the exact `auth.users` row by actor UID `FOR UPDATE`.
3. Under that lock, function checks that the database email exactly equals the server-verified email supplied by the Edge Function and that `email_confirmed_at` is still non-null. It then validates recipient digest/key version, locks the invitation Saga row, and rechecks pending/expiry/revocation, organization, role and membership constraints.
4. Use one consistent lock order: Auth user row first, invitation/Saga row second, then membership/role/audit/receipt rows. Keep transaction short; no HTTP/Auth/email/provider calls while locks are held.
5. If Auth email update committed first, the locked row exposes the new email and the old invitation digest does not match. If acceptance locks first, the email update waits until the acceptance transaction commits; acceptance is valid against the verified email current at its serialization point. Any transaction/serialization/lock error aborts the whole acceptance; retry only with the same stable mutation ID.
6. Do not grant SELECT/UPDATE on `auth.users` directly to `service_role`, `authenticated` or the browser. The server role should receive EXECUTE on a narrowly scoped function only; direct table privileges remain confined to the function owner/managed Auth role.

### Important implementation caveats
- This confirms feasibility on BAOTRI-Mini-Test, not automatic Production portability. Hosted project grants can differ; each tenant project needs a read-only preflight.
- A `private` schema function is not callable through PostgREST unless the schema is exposed. Choose and security-review one call path before implementation: direct trusted Postgres connection from Edge Function to a private-schema function, or a tightly restricted server-only RPC wrapper with EXECUTE revoked from PUBLIC/anon/authenticated and granted only to the server role. Do not expose a general-purpose Auth lookup RPC.
- Supabase docs state Auth schema is not exposed through the generated Data API; this is distinct from trusted SQL access. Do not expose `auth.users` as a client API.
- Source code on `master` is not a substitute for checking the exact GoTrue version deployed to each hosted project. Pin/record Auth version and test normal email change, secure email change, admin email update, concurrent accept-vs-confirm, lock timeout, and transaction rollback on the Test project before production.
- The test query used `WHERE false`; no real row-level contention test has yet been performed. Do not mark race-condition tests PASS.

### Status
Read-only investigation supports a viable candidate: a tightly restricted `SECURITY DEFINER` function owned by `postgres` can lock `auth.users` on the current Test project. This is not implementation approval. No DDL, RPC, Edge Function, SQL write, grant, migration or Supabase configuration was changed. Production preflight, deployed Auth version verification, live concurrency tests, and final RPC invocation path remain open.

## 54. Invitation acceptance — concurrent email-change test plan (design only, 20/11/2026)

### Test isolation and prerequisites
- Use dedicated synthetic Auth users and disposable organizations/invitations in BAOTRI-Mini-Test only. Never use a real person's account/email or Production data.
- Record exact project ref, PostgreSQL version, deployed GoTrue/Auth version/build, SDK versions, function owner, SECURITY DEFINER/INVOKER setting, fixed search_path, grants and relevant Auth email-change settings before the run.
- Create fixture A with a verified email and one pending invitation addressed to that exact normalized email. Fixture B is a separate disposable Auth user for negative/unauthorized tests.
- Keep fixtures isolated by IDs. Capture before/after snapshots and clean up only through separately reviewed test-fixture teardown; never automatically delete Auth users or business data.
- Run two independent database sessions/transactions with explicit barriers. Record timestamps, transaction IDs, lock wait observations, SQLSTATE, function outcome and final state. Redact emails, access tokens, service keys and webhook secrets.

### Core race tests
1. **Acceptance locks first; email confirmation starts second:** Session A starts acceptance and locks auth.users. Pause A after lock + authoritative email verification. Session B executes normal Auth email-change confirmation for the same user. Expected: B waits; A completes against the email current at its serialization point; B proceeds only after A commits. Exactly one membership/role/audit/receipt set exists.
2. **Email change commits first; acceptance starts second:** B completes confirmed email change first. A attempts acceptance using an old Inbox item. Expected: A sees the new DB email under lock; old recipient digest fails; acceptance rejects without business writes or automatic reassignment.
3. **Both begin concurrently:** Start A and B from a barrier. Expected: execution serializes to case 1 or 2; no mixed state, duplicate membership/role, stale-email acceptance or deadlock.
4. **Email changes to another fixture's address:** Expected: no cross-acceptance or invitation transfer.
5. **Email loses verified status / unconfirmed account:** Expected: fail closed; no business writes. Cached Inbox data cannot override current Auth state.

### Additional integrity and failure tests
6. Invitation expires or is revoked while Inbox is open: acceptance rechecks and rejects atomically.
7. Organization becomes inactive or role invalid before acceptance: reject with no partial writes.
8. Membership already exists or concurrent acceptance wins: one canonical result; no duplicate role.
9. Lock timeout / deadlock victim / serialization failure: entire transaction rolls back. Retry uses same mutation ID.
10. Acceptance commits but HTTP response is lost: replay with same invitation + actor + mutation ID returns original receipt; no duplicate writes.
11. Same mutation ID with changed payload or another actor: conflict/deny; no receipt disclosure.
12. Function called by anon/authenticated or direct Data API: denied. Server-only invocation succeeds only with expected server identity.
13. Direct SELECT of private Saga/attempt/Auth data from browser roles: denied. No email, Auth UUID, recipient digest, HMAC key or internal state leaks in response/errors/logs.
14. Admin-initiated Auth email update path: verify it participates in the same row-lock serialization; otherwise do not approve the design until guarded.
15. Email change initiated but not confirmed: old email remains authoritative only if confirmed by the deployed GoTrue behavior; acceptance checks the locked row's current verified state.

### Pass criteria
- Every interleaving is equivalent to one serial order; no acceptance uses an email that is no longer current at its serialization point.
- Success creates exactly one atomic membership + one role + audit + Shared Receipt + Saga completion; rejection/transaction failure creates zero business writes.
- Replay returns original receipt; no privilege escalation, cross-invite access, duplicate side effects or new mutation ID on uncertain outcome.
- Lock waits/errors are bounded and observable without exposing PII/secrets.
- Verify deployed Auth implementation and every supported administrative email-update path; do not infer from moving master source.
- Initial target: at least 20 randomized interleavings per race class plus deterministic barriers for both lock orders. This is a test target, not proof by itself.

### Harness constraints and status
- Use test-only barriers; do not add production sleeps, debug endpoints, or test hooks to business RPCs.
- A controlled SQL update can validate Postgres lock mechanics, but does not prove the real GoTrue confirmation route. Test that route separately end-to-end.
- This is a proposed plan, not PASS evidence. No fixtures/users/invitations were created, no SQL writes were run, and no DDL/RPC/Edge Function/grants/configuration were changed.

## 55. Private RPC invocation from Edge Function — direct PostgreSQL connection candidate (20/11/2026)

### Official platform capability verified
- Current Supabase documentation explicitly supports connecting to Postgres from Edge Functions with a native Postgres client, in addition to supabase-js/Data API.
- Supabase connection guidance recommends Shared Pooler (Supavisor) transaction mode for transient/serverless/edge traffic. Transaction mode uses port 6543 and does not support prepared statements; the selected driver must disable them.
- This provides a supported invocation path for a function in a non-exposed/private schema without exposing that schema through PostgREST/Data API.

### Candidate call path
1. Edge Function validates the caller's bearer token server-side and obtains authoritative Auth UID. Client-supplied UID/email/org/role are not trusted.
2. Edge Function computes recipient lookup digest using the server-held, purpose-separated HMAC key and versioned normalization contract.
3. Edge Function opens a TLS-protected PostgreSQL connection through the transaction pooler. Credentials are held only in server-side Edge Function secrets.
4. Use a dedicated database login role for this Edge Function. Do not connect as postgres, supabase_auth_admin, service_role, anon or authenticated.
5. Grant that role only minimum schema USAGE and EXECUTE on the exact private acceptance function. Do not grant table SELECT/UPDATE on auth.users, Saga, attempts, membership, roles, audit or receipt tables.
6. The narrowly scoped function is owned by a verified privileged owner (candidate: postgres), uses SECURITY DEFINER, fixed empty search_path, fully qualified object names, strict input validation, and binds actor identity to the server-authenticated contract. It locks auth.users and invitation state and performs all acceptance writes in one DB transaction.
7. Edge Function returns only minimal public result/receipt projection. No SQL error details, Auth UUID, email, digest, internal Saga state or privileged credentials are returned.

### Critical caveats to resolve before implementation
- Current Test project's postgres role permissions were inspected, but no dedicated login role or function exists. Do not assume a custom login role can be created/granted without a reviewed privilege plan.
- Verify how Edge Function obtains DB connection secret, secret rotation, connection limits, TLS validation and cold-start behavior.
- Transaction pooling is compatible only if the entire lock + validation + business mutation occurs in one SQL statement/function transaction. Do not split row lock and subsequent writes across separate Edge Function queries/connections.
- Transaction mode does not support prepared statements. Avoid session-scoped state, temporary tables, advisory session locks, or relying on connection affinity.
- The database function must not trust a caller-supplied UID merely because the caller reached the Edge Function. Bind authenticated UID from server-side JWT verification to acceptance idempotency and authorization checks.
- If a server-only RPC wrapper through PostgREST is considered instead, verify schema exposure, role execution grants and function behavior separately. Do not expose auth.users or grant broad Data API privileges.
- Verify actual hosted project's pooler configuration and IPv4/IPv6 behavior.

### Security posture and decision
- Preferred candidate for further prototyping: Edge Function → TLS PostgreSQL transaction-pooler connection as a dedicated restricted DB role → one private SECURITY DEFINER acceptance function.
- This avoids exposing the private schema and avoids granting Auth/Saga table reads to browser roles.
- This is an architecture candidate, not implementation approval. Need explicit role/function privilege matrix, connection secret plan, JWT-to-DB actor binding review, and isolated concurrency tests before any DDL, grant, secret or deployment.
- No SQL writes, roles, grants, DDL, RPC, Edge Function, secret, pooler or Supabase configuration were changed during this research.
