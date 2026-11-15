# BAOTRI – Tiến độ và các quyết định đã chốt

Cập nhật: 15/11/2026 (đã bổ sung tiến độ giao diện)

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
- Chỉnh sửa từng mục; giữ phong cách xanh đậm hiện tại, không thiết kế lại toàn bộ.
- Máy tính: giữ menu điều hướng bên trái.
- Điện thoại: dùng thanh điều hướng cố định phía dưới gồm Tổng quan, Thiết bị, Kho, Bảo trì và Thêm; Nhật ký, Báo cáo, Cài đặt đặt trong mục Thêm.
- Thanh trên có vùng tên đơn vị và tài khoản mẫu; chưa kết nối đăng nhập thật.
- Trên điện thoại ưu tiên thao tác hiện trường: quét QR, nhập thông số, cập nhật công việc; ảnh sẽ bổ sung ở giai đoạn chức năng hồ sơ.
- Không hiển thị nhãn Offline-first vì không còn phù hợp với định hướng.

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
- Kiến trúc mục tiêu: giao diện web tĩnh được build từ React/Vite; dữ liệu nghiệp vụ lưu trong database trực tuyến; ảnh/PDF/tài liệu dùng dịch vụ lưu trữ tệp phù hợp.
- **Ưu tiên thử GitHub Pages để lưu trữ giao diện BAOTRI miễn phí** sau khi hoàn thiện và build được bản production. GitHub Pages chỉ phục vụ giao diện tĩnh, không thay thế backend hoặc database.
- **Supabase là phương án ưu tiên để đánh giá cho database PostgreSQL, đăng nhập và lưu trữ tệp**, nhưng chưa tạo dự án và chưa chốt chính thức cho đến khi kiểm tra giới hạn miễn phí, bảo mật, backup và nhu cầu thực tế.
- Tạm thời **không dùng 123HOST cho BAOTRI** để tránh phải tự cấu hình PHP/MySQL/API khi chưa cần; không mua hosting ở giai đoạn hiện tại.
- Khi triển khai, người dùng truy cập BAOTRI bằng trình duyệt/PWA trên điện thoại hoặc máy tính; không phải bật máy tính cá nhân hay chạy PowerShell. PowerShell + Vite hiện chỉ dùng trong quá trình phát triển local.
- PWA có thể giữ để cài ứng dụng trên điện thoại, nhưng PWA không đồng nghĩa với offline-first.

## 3. Tiến độ đã xác nhận

- [x] Đã tải mã nguồn dự án `baotri-pwa-starter/baotri-pwa` về máy Windows.
- [x] Đã chạy được ứng dụng bằng Vite tại địa chỉ local `http://localhost:5173/` từ bản clone mới trong `E:\\DuAnBaoTri\\DuAn_BaoTRi`.
- [x] Đã cài dependencies bằng `npm.cmd install` và khởi động Vite thành công trên máy Windows.
- [x] Người dùng đã xem giao diện ở chế độ mô phỏng điện thoại bằng Chrome DevTools và đánh giá hiển thị ổn; chưa kiểm thử hoàn chỉnh trên điện thoại thật.
- [x] Đã mở và xem giao diện Kho vật tư.
- [x] Đã xem ảnh giao diện tổng quan do người dùng cung cấp qua GitHub.
- [x] Đã thống nhất giữ phong cách hiện tại và cải tiến từng phần.
- [x] Đã thống nhất ưu tiên một người dùng, giải pháp miễn phí và không làm offline-first phức tạp.
- [x] Đã rà soát sơ bộ `src/App.tsx`, `src/style.css`, `vite.config.ts` và `README.md` trên GitHub.
- [x] Đã cập nhật khung điều hướng desktop/mobile trong `src/App.tsx` và `src/style.css`.
- [x] Đã thêm vùng tên đơn vị và tài khoản mẫu trên thanh trên.
- [x] Đã bỏ nhãn Offline-first khỏi thanh trên; thông tin dữ liệu cục bộ vẫn được ghi rõ trong sidebar/cài đặt.
- [ ] Chưa chạy build hoặc kiểm thử trực tiếp sau thay đổi giao diện.
- [ ] Chưa kiểm thử giao diện trên điện thoại thực tế.
- [ ] Chưa triển khai đăng nhập thật.
- [ ] Chưa kết nối database tập trung.
- [ ] Chưa triển khai GitHub Pages; hiện mới là phương án ưu tiên cho giao diện.
- [ ] Chưa tạo dự án Supabase; hiện mới là phương án ưu tiên để đánh giá cho database/backend.
- [ ] Chưa triển khai lưu trữ ảnh/tài liệu lên máy chủ.

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
   - Desktop giữ sidebar bên trái.
   - Mobile dùng thanh điều hướng dưới; mục phụ mở qua nút “Thêm”.
4. Responsive:
   - Thẻ thống kê xếp lại theo chiều rộng màn hình.
   - Bảng dữ liệu có cách hiển thị phù hợp trên điện thoại (cuộn ngang hoặc dạng thẻ, tùy từng màn hình).
   - Nút thao tác đủ lớn để chạm trên điện thoại.

## 5. Lộ trình gần nhất

### Bước 1 – Khung giao diện (đã cập nhật code, chờ kiểm thử)
- Đã rà soát component/layout gốc và CSS hiện có.
- Đã thêm vùng tên đơn vị và tài khoản mẫu.
- Đã thêm thanh điều hướng dưới trên mobile; mục Nhật ký/Báo cáo/Cài đặt ở menu “Thêm”.
- Đã giữ sidebar trên desktop và bỏ nhãn Offline-first.
- Chưa xác nhận build thành công hoặc kiểm thử trên thiết bị thật.

### Bước 2 – Kiểm thử khung giao diện và Dashboard
- Đồng bộ mã nguồn mới nhất về máy chạy thử.
- Kiểm tra desktop, mobile, điều hướng các mục và menu “Thêm”.
- Sau đó mới chỉnh Dashboard.
- Chỉnh bố cục tổng quan.
- Kiểm tra dữ liệu thống kê lấy từ đâu; phân biệt dữ liệu thật và dữ liệu mẫu.
- Không để số liệu giả tạo cảm giác chức năng đã hoàn thiện.

### Bước 3 – Kiểm tra các phân hệ
- Đã chuẩn bị 30 thiết bị mẫu thuộc nhiều nhóm cơ điện, điện lạnh, điện, PCCC và thiết bị xưởng. Tất cả hồ sơ mẫu có ghi chú dữ liệu mẫu.
- Kiểm tra từng thao tác: thêm/sửa/xóa hoặc ngừng sử dụng, nhập/xuất kho, tạo công việc, lưu nhật ký.
- Xác định chức năng nào hoạt động thật, chức năng nào mới là giao diện mẫu.
- Chỉ sửa từng phân hệ sau khi thống nhất.

### Bước 4 – Đưa ứng dụng lên Internet và dữ liệu tập trung
- Build giao diện production và thử triển khai lên GitHub Pages; chưa cần mua hosting.
- Đánh giá Supabase cho PostgreSQL, đăng nhập, API và lưu trữ tệp; kiểm tra giới hạn gói miễn phí trước khi chốt.
- Thiết kế schema, phân quyền/cách ly dữ liệu và backup trước khi đưa dữ liệu sử dụng thật.
- Kết nối máy tính và điện thoại vào cùng database để dùng chung dữ liệu.
- Thiết kế lưu ảnh/tài liệu tập trung; không đưa khóa bí mật/service-role key vào frontend hoặc repository.
- Không triển khai trên 123HOST ở giai đoạn hiện tại.

### Bước 5 – Làm sạch dữ liệu và mở rộng sau này
- Trước khi sử dụng thật: sao lưu nếu cần, xóa toàn bộ dữ liệu thử nghiệm (thiết bị, vật tư, phiếu nhập/xuất, công việc, nhật ký và dữ liệu demo khác), kiểm tra dữ liệu nghiệp vụ trở về 0; giữ nguyên mã nguồn, cấu trúc database và cấu hình nền.
- Tạo đơn vị/tài khoản sử dụng thật và nhập dữ liệu thật sau khi xác nhận reset thành công.
- Đăng nhập thật, quản lý người dùng, vai trò và phân quyền.
- Multi-tenant và cách ly dữ liệu doanh nghiệp ở backend/database.
- Đánh giá gói hosting/database trả phí khi có khách hàng hoặc vượt giới hạn miễn phí.

## 6. Quy tắc làm việc và cập nhật tiến độ

- Mỗi lần làm việc phải ghi rõ: file đã sửa, chức năng đã hoàn thành, cách kiểm thử và kết quả.
- **Quy trình mặc định: chỉ ghi nhận yêu cầu/quyết định mới vào tệp tiến độ, chưa sửa mã nguồn ngay.** Gom nhiều yêu cầu thành một đợt triển khai hoặc chỉ bắt đầu sửa code khi người dùng yêu cầu rõ ràng.
- Khi người dùng bổ sung yêu cầu trong lúc thảo luận, cập nhật tệp tiến độ trên GitHub để lưu lại; không tự ý triển khai chức năng nếu chưa đến đợt code đã thống nhất.
- Chỉ đánh dấu hoàn thành khi đã chạy thử và kiểm tra; code tồn tại không đồng nghĩa chức năng đã hoàn tất.
- Nếu thay đổi cấu trúc database, ghi rõ migration và ảnh hưởng dữ liệu cũ.
- Trước khi sửa, kiểm tra phiên bản mới nhất trên GitHub; tránh ghi đè thay đổi mới của người dùng.
- Không đưa mật khẩu, service-role key, token hoặc bí mật vào repository công khai.

### Tab Thiết bị – sắp xếp, lọc và xem chi tiết
- Bộ lọc kết hợp theo nhóm, vị trí và trạng thái; sắp xếp theo mã, tên và ngày đưa vào sử dụng.
- Có nút đặt lại bộ lọc.
- Nhấn tên thiết bị mở bảng chi tiết ở chế độ xem; có nút xem ảnh và hỗ trợ nhiều ảnh.
- Khu vực menu Lọc & sắp xếp và menu Thao tác phải tự đóng ngay sau khi người dùng chọn một dòng/giá trị, không yêu cầu bấm lần thứ hai.

### Danh mục thiết bị – vòng đời, QR và lịch sử
- Phân biệt Đang hoạt động, Đang sửa chữa, Ngừng sử dụng, Lưu kho và Thanh lý.
- Lưu kho giữ hồ sơ và lịch sử, có thể khôi phục; không đồng nghĩa thanh lý hay xóa.
- Xóa vĩnh viễn là thao tác riêng, yêu cầu kiểm soát quyền và xác nhận ở backend khi có hệ thống đăng nhập thật.
- Chi tiết thiết bị có QR và mã định danh; hỗ trợ in tem QR 50 x 30 mm, in chi tiết và in lịch sử bảo trì.
- Nhật ký liên kết với thiết bị bằng assetId; lưu loại công việc, ngày, nội dung, vật tư/phụ tùng, thông số, kết quả và người thực hiện.
- Kết quả sau thực hiện có lựa chọn Đạt/Không đạt và phải xuất hiện trong lịch sử/bản in.

### Quy ước mã định danh và tự cấp mã
- Cấu trúc mã: `ABC-ABXY-xxx-BB-MM-YY`; xxx tối thiểu 3 chữ số và tự tăng, không giới hạn độ dài.
- Thiết bị chuyển từ cơ sở khác đến: đổi ABXY theo cơ sở tiếp nhận và thêm một dấu `*` ở cuối mã.
- Tài liệu quy chuẩn viết tắt: `QUY_UOC_MA_DINH_DANH_VA_VIET_TAT_THIET_BI.txt`.
- Khi thêm thiết bị, người dùng không phải nhập mã ID; hệ thống tự cấp mã sau khi lưu và tạo QR từ mã hoàn chỉnh.
- **Yêu cầu bổ sung cho luồng thêm mới:** trong biểu mẫu thêm thiết bị phải có ô tick **“Thiết bị được chuyển từ cơ sở khác đến”**. Nếu được tick, hệ thống đánh dấu mã định danh bằng đúng một dấu `*` ở cuối; phần ABXY dùng mã cơ sở tiếp nhận hiện tại. Mã QR tạo sau khi lưu phải chứa toàn bộ mã, bao gồm dấu `*`. Không yêu cầu người dùng tự nhập ID. Yêu cầu này đã ghi nhận, chưa triển khai code.NaN

### Biểu mẫu in chi tiết thiết bị
- Có tiêu đề biểu mẫu rõ ràng **BẢNG CHI TIẾT THIẾT BỊ**.
- Logo doanh nghiệp ở trái, QR ở phải; tên thiết bị là tiêu đề phụ; mã định danh chỉ xuất hiện một lần trong bảng thông tin.
- Logo là vùng cấu hình thay thế theo từng doanh nghiệp, không cố định logo BAOTRI.

### Báo cáo danh mục thiết bị – chỉnh lại xuất Excel và bản in
- Đây là **báo cáo danh mục thiết bị**, không phải báo cáo bảo trì. Bố cục phải sáng sủa, dễ đọc, không dàn trải thành nhiều dòng riêng cho một thiết bị.
- Mỗi thiết bị phải chiếm **một hàng duy nhất** trong bảng báo cáo.
- Trong cột **Tên thiết bị**, hiển thị tên thiết bị ở dòng đầu; **Hãng** và **Model** đặt ở các dòng tiếp theo bên trong cùng một ô/cột tên thiết bị (không làm phát sinh thêm hàng cho cùng thiết bị).
- **Bỏ cột Chu kỳ** khỏi báo cáo danh mục thiết bị vì không phù hợp với loại báo cáo này.
- Bảng Excel và bản in cần có cấu trúc cột rõ ràng, căn chỉnh nhất quán, độ rộng cột hợp lý, tiêu đề dễ phân biệt; tránh nội dung Hãng/Model bị tràn hoặc đẩy thành nhiều hàng.
- Khi in phải có **đường kẻ hàng và cột rõ ràng** (viền ô/bảng thực sự), không chỉ dựa vào tùy chọn hiển thị gridlines mặc định của Excel vốn có thể không được in.
- Thiết lập vùng in và lặp lại hàng tiêu đề nếu báo cáo kéo dài nhiều trang; căn trang phù hợp để bảng không bị cắt cột hoặc chữ quá nhỏ.
- Đây là yêu cầu đã ghi nhận cho đợt sửa báo cáo tiếp theo; **chưa sửa code, chưa xuất thử file và chưa kiểm tra bản in**.


### Đợt sửa – xuất Excel và in danh sách thiết bị
- Đã sửa `src/App.tsx`:
  - Xuất Excel theo danh sách thiết bị đang hiển thị sau khi áp dụng bộ lọc.
  - Mỗi thiết bị là một dòng dữ liệu; cột Tên thiết bị chứa tên, Hãng và Model trên các dòng riêng trong cùng một ô.
  - Bỏ cột Chu kỳ; giữ các thông tin nhận diện/quản lý cần thiết như mã định danh, nhóm, Serial, vị trí, ngày đưa vào sử dụng, công suất/thông số, tình trạng và ghi chú.
  - Thêm tiêu đề **DANH SÁCH CÁC THIẾT BỊ HIỆN NAY** vào đầu worksheet; thiết lập độ rộng cột, chiều cao dòng, bộ lọc tiêu đề.
  - Thêm nút **In danh sách** riêng, dùng cùng danh sách đã lọc.
  - Bản in có tiêu đề giữa trang, đầu mục in đậm, bảng có viền ngang/dọc, lặp hàng tiêu đề khi sang trang, tránh ngắt một hàng thiết bị giữa hai trang và đánh số trang dạng “Trang X / Y” ở chân trang.
- Đã cập nhật `src/style.css` cho khổ A4 ngang và bố cục in.
- Đã cập nhật code trên GitHub. **Chưa chạy build, chưa mở thử file Excel và chưa kiểm tra bản in thực tế**. Cần Pull origin, chạy `npm.cmd run build`, sau đó thử xuất Excel và In danh sách với dữ liệu nhiều thiết bị để kiểm tra phân trang.
