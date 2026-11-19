# BAOTRI Mini — Role Assignment Preflight Test Results

**Ngày ghi nhận:** 19/11/2026  
**Môi trường:** Supabase Test  
**Nguồn kết quả:** Người vận hành đã chạy thủ công từng truy vấn Q1–Q8 trong SQL Editor và báo lại kết quả. Đây là ghi nhận theo kết quả được cung cấp, không phải kết nối truy vấn độc lập từ repository.

## 1. Kết quả tổng hợp

| Query | Nội dung | Kết quả được báo cáo | Đánh giá |
|---|---|---|---|
| Q1 | Membership theo organization/status | Tổng membership_count = 4 | Đạt |
| Q2 | Phân bố số role assignment trên membership | Tổng member_count = 4 | Đạt; cần đối chiếu nhóm exactly_one trong output gốc |
| Q3 | Membership thiếu hoặc có nhiều assignment | Success. No rows returned | Đạt |
| Q4 | Assignment trỏ role inactive/không tồn tại | Success. No rows returned | Đạt |
| Q5 | Legacy role không khớp assignment theo mapping mirror | Success. No rows returned | Đạt |
| Q6 | Role code và số membership được gán | Admin = 1; Kỹ thuật viên = 2; Người xem = 1 | Đạt; tổng 4 |
| Q7 | Organization/membership/role scope mismatch | Success. No rows returned | Đạt |
| Q8 | Membership active trong organization active không có đúng một role active | Success. No rows returned | Đạt |

## 2. Kết luận trong phạm vi dữ liệu Test

- Tổng cộng 4 membership được báo cáo ở Q1 và Q2.
- Q3 không phát hiện membership thiếu hoặc có nhiều assignment.
- Q4 không phát hiện assignment gắn với role inactive/không tồn tại.
- Q5 không phát hiện legacy role mismatch theo điều kiện kiểm tra.
- Q6 phân bố 1 Admin, 2 Kỹ thuật viên, 1 Người xem.
- Q7 không phát hiện sai lệch tenant scope.
- Q8 không phát hiện membership active thuộc organization active có số role active khác 1.

**Kết luận:** Kết quả được báo cáo cho Supabase Test đáp ứng các điều kiện preflight đã kiểm tra và không cho thấy duplicate/missing assignment hoặc mismatch thuộc các điều kiện Q3–Q8.

## 3. Giới hạn và cổng tiếp theo

1. Đây là kết quả của Supabase Test; tuyệt đối không suy luận dữ liệu Production cũng sạch.
2. Q1/Q2 là truy vấn tổng hợp theo organization/status và trạng thái assignment; cần giữ output gốc nếu cần audit chi tiết từng nhóm.
3. Chưa thêm unique constraint `(organization_id, member_id)`.
4. Chưa thay đổi `has_org_role()`, RLS, Edge Function, RPC, UI hoặc bootstrap.
5. Chưa chạy migration ghi dữ liệu và chưa thay đổi Supabase.
6. Trước khi cutover vẫn cần rà soát các writer và authorization consumers; triển khai migration phải có precondition kiểm tra duplicate và dừng an toàn nếu dữ liệu thay đổi sau lần preflight.
7. Chỉ xem xét chạy migration trên Test sau khi có bản migration riêng, review SQL, snapshot/backup và kế hoạch kiểm thử. Production cần phê duyệt và preflight độc lập.

## 4. Quyết định

Đánh dấu **Role Assignment Preflight trên Supabase Test: PASS theo kết quả người vận hành cung cấp**. Đây là cổng dữ liệu đạt, không phải xác nhận cutover đã hoàn tất và không phải cho phép triển khai Production.
