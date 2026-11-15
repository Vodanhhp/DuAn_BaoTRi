# BAOTRI – Tiến độ và các quyết định đã chốt

Cập nhật: 15/11/2026

Tài liệu này ghi lại các quyết định kiến trúc và tiến độ thực tế để tiếp tục dự án ở những cuộc làm việc sau. Khi thay đổi quyết định hoặc hoàn thành chức năng, phải cập nhật tài liệu này.

## 1. Mục tiêu giai đoạn hiện tại

- BAOTRI trước mắt phục vụ **một người dùng cá nhân**.
- Ưu tiên giải pháp **miễn phí hoặc có gói miễn phí**, chưa mua hosting, chưa thuê dịch vụ trả phí.
- Làm từng phần nhỏ, chạy thử và kiểm tra trước khi chuyển sang phần tiếp theo.
- Giữ khả năng mở rộng thành phần mềm cho nhiều người dùng/nhiều doanh nghiệp trong tương lai, nhưng không triển khai sớm các chức năng chưa cần.
- Không làm lại toàn bộ ứng dụng nếu có thể chỉnh sửa an toàn trên mã nguồn hiện tại.

## 2. Quyết định đã thống nhất

### 2.1 Giao diện
- Giữ phong cách giao diện hiện tại: menu bên trái, tông xanh, bố cục quản lý kỹ thuật.
- Chỉnh sửa từng mục; bắt đầu từ khung giao diện tổng quan (Dashboard).
- Thiết kế responsive: máy tính và điện thoại dùng chung một ứng dụng, tự điều chỉnh bố cục.
- Trên điện thoại ưu tiên thao tác hiện trường: quét QR, chụp/tải ảnh, nhập thông số, cập nhật công việc.
- Trên máy tính ưu tiên quản lý danh mục, kế hoạch, kho và báo cáo.
- Bổ sung vị trí tài khoản người dùng, tên đơn vị và menu tài khoản (mẫu giao diện trước, chưa cần đăng nhập thật).
- Có thể thu gọn menu trái trên máy tính; trên điện thoại dùng menu gọn/nút menu.

### 2.2 Người dùng và doanh nghiệp
- Giai đoạn đầu: một người dùng cá nhân.
- Chưa cần đăng nhập thật hoặc phân quyền nhiều vai trò.
- Tuy nhiên, thiết kế dữ liệu nên dự phòng các trường định danh như `user_id` và `tenant_id` khi phù hợp, tránh phải thiết kế lại lớn khi mở rộng.
- Tương lai có thể bổ sung nhiều tài khoản và nhiều doanh nghiệp; dữ liệu doanh nghiệp phải được cách ly bằng kiểm soát ở backend/database, không chỉ ẩn trên giao diện.
- Không tạo database riêng cho từng nhân viên trong cùng doanh nghiệp; người dùng cùng doanh nghiệp truy cập dữ liệu chung theo quyền.

### 2.3 Dữ liệu và kết nối
- Máy tính và điện thoại là hai giao diện truy cập **cùng một nguồn dữ liệu tập trung** khi có Internet.
- Không triển khai offline-first hoặc cơ chế đồng bộ offline phức tạp trong giai đoạn hiện tại.
- Khi mất mạng: người dùng có thể chụp ảnh bằng camera và giữ ảnh trong thư viện điện thoại; khi có mạng thì mở BAOTRI để tải ảnh lên và cập nhật thông số.
- Không cam kết ứng dụng có thể ghi trực tiếp dữ liệu nghiệp vụ khi offline.
- Kiến trúc mục tiêu khi triển khai dữ liệu tập trung: PostgreSQL cho dữ liệu nghiệp vụ và dịch vụ lưu trữ tệp cho ảnh/PDF/tài liệu.
- Supabase là một phương án có thể xem xét vì có gói miễn phí, nhưng **chưa chốt nhà cung cấp và chưa tạo dự án database**.
- Website/frontend có thể lưu trữ ở nơi khác với database; chưa cần mua hosting ngay.
- PWA có thể giữ để cài ứng dụng trên điện thoại, nhưng PWA không đồng nghĩa với offline-first.

### 2.4 Chi phí
- Ưu tiên gói miễn phí cho giai đoạn cá nhân.
- Trước khi chọn dịch vụ, cần kiểm tra giới hạn miễn phí hiện hành, giới hạn dung lượng, băng thông, backup, thời gian ngừng do không hoạt động và điều kiện nâng cấp.
- Khi có khách hàng hoặc nhu cầu thương mại, đánh giá lại hosting, database, lưu trữ ảnh, bảo mật, backup, phân quyền và chi phí vận hành.

## 3. Tiến độ đã xác nhận

- [x] Đã tải mã nguồn dự án `baotri-pwa-starter/baotri-pwa` về máy Windows.
- [x] Đã chạy được ứng dụng bằng Vite tại địa chỉ local `http://localhost:5173/`.
- [x] Đã mở và xem giao diện Kho vật tư.
- [x] Đã xem ảnh giao diện tổng quan do người dùng cung cấp qua GitHub.
- [x] Đã thống nhất giữ phong cách hiện tại và cải tiến từng phần.
- [x] Đã thống nhất ưu tiên một người dùng, giải pháp miễn phí và không làm offline-first phức tạp.
- [ ] Chưa rà soát mã nguồn thực tế của toàn bộ dự án.
- [ ] Chưa sửa code giao diện.
- [ ] Chưa triển khai đăng nhập thật.
- [ ] Chưa kết nối database tập trung.
- [ ] Chưa triển khai lưu trữ ảnh/tài liệu lên máy chủ.
- [ ] Chưa kiểm thử giao diện trên điện thoại thực tế.

## 4. Các vấn đề giao diện cần xử lý

1. Dashboard:
   - Giữ bốn thẻ thống kê chính.
   - Các thẻ nên dẫn đến danh sách liên quan khi chức năng đã hoạt động.
   - Hiển thị công việc hôm nay, cảnh báo kỹ thuật và hoạt động gần đây.
   - Hiển thị trạng thái kết nối/lưu dữ liệu rõ ràng; không dùng nhãn Offline-first nếu không còn phù hợp.
2. Thanh trên:
   - Có tên đơn vị (ban đầu có thể là “Cá nhân” hoặc tên cấu hình).
   - Có khu vực tài khoản: tên/ảnh đại diện, vai trò mẫu, thông tin tài khoản, đăng xuất mẫu.
3. Menu:
   - Thu gọn được trên máy tính.
   - Có menu phù hợp màn hình điện thoại.
4. Responsive:
   - Thẻ thống kê xếp lại theo chiều rộng màn hình.
   - Bảng dữ liệu có cách hiển thị phù hợp trên điện thoại (cuộn ngang hoặc dạng thẻ, tùy từng màn hình).
   - Nút thao tác đủ lớn để chạm trên điện thoại.

## 5. Lộ trình gần nhất

### Bước 1 – Khung giao diện
- Kiểm tra mã nguồn hiện tại trên GitHub.
- Xác định component/layout gốc và CSS hiện có.
- Thêm vùng tên đơn vị và menu tài khoản dạng mẫu.
- Chỉnh menu responsive cho máy tính/điện thoại.
- Không làm hỏng các phân hệ đang có.

### Bước 2 – Dashboard
- Chỉnh bố cục tổng quan.
- Kiểm tra dữ liệu thống kê lấy từ đâu; phân biệt dữ liệu thật và dữ liệu mẫu.
- Không để số liệu giả tạo cảm giác chức năng đã hoàn thiện.

### Bước 3 – Kiểm tra các phân hệ
- Kiểm tra từng thao tác: thêm/sửa/xóa hoặc ngừng sử dụng, nhập/xuất kho, tạo công việc, lưu nhật ký.
- Xác định chức năng nào hoạt động thật, chức năng nào mới là giao diện mẫu.
- Chỉ sửa từng phân hệ sau khi thống nhất.

### Bước 4 – Dữ liệu tập trung
- Chọn dịch vụ có gói miễn phí phù hợp (có thể đánh giá Supabase).
- Thiết kế schema và backup trước khi đưa dữ liệu sử dụng thật.
- Kết nối máy tính và điện thoại vào cùng database.
- Thiết kế lưu ảnh/tài liệu tập trung.

### Bước 5 – Mở rộng sau này
- Đăng nhập thật, quản lý người dùng, vai trò và phân quyền.
- Multi-tenant và cách ly dữ liệu doanh nghiệp.
- Đánh giá gói hosting/database trả phí khi có khách hàng hoặc vượt giới hạn miễn phí.

## 6. Quy tắc làm việc và cập nhật tiến độ

- Mỗi lần làm việc phải ghi rõ: file đã sửa, chức năng đã hoàn thành, cách kiểm thử và kết quả.
- Chỉ đánh dấu hoàn thành khi đã chạy thử và kiểm tra; code tồn tại không đồng nghĩa chức năng đã hoàn tất.
- Nếu thay đổi cấu trúc database, ghi rõ migration và ảnh hưởng dữ liệu cũ.
- Trước khi sửa, kiểm tra phiên bản mới nhất trên GitHub; tránh ghi đè thay đổi mới của người dùng.
- Không đưa mật khẩu, service-role key, token hoặc bí mật vào repository công khai.
- Khi kết thúc mỗi phiên làm việc, cập nhật mục 3 và 5 trong tài liệu này.
