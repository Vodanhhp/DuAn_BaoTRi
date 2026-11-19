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
