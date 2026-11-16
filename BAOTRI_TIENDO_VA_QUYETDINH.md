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
- Đây là yêu cầu quy chuẩn cho báo cáo danh mục và các danh sách in trong ứng dụng.


### Đợt sửa – xuất Excel và in danh sách thiết bị
- Đã sửa `src/App.tsx`:
  - Xuất Excel theo danh sách thiết bị đang hiển thị sau khi áp dụng bộ lọc.
  - Mỗi thiết bị là một dòng dữ liệu; cột Tên thiết bị chứa tên, Hãng và Model trên các dòng riêng trong cùng một ô.
  - Bỏ cột Chu kỳ; giữ các thông tin nhận diện/quản lý cần thiết như mã định danh, nhóm, Serial, vị trí, ngày đưa vào sử dụng, công suất/thông số, tình trạng và ghi chú.
  - Đặt tiêu đề **DANH SÁCH THIẾT BỊ** ở đầu worksheet; thiết lập độ rộng cột, chiều cao dòng, bộ lọc tiêu đề.
  - Đã bỏ nút **In danh sách** riêng và luồng in danh sách trực tiếp; chỉ còn **Xuất Excel** để tránh trùng chức năng.
  - Xuất danh mục bằng tệp Excel-compatible `.xls` (HTML workbook) để giữ được định dạng chữ Tahoma 11 pt, tiêu đề 12 pt đậm, đường viền ô, độ rộng cột, A4 ngang và lặp hàng tiêu đề khi in. Dữ liệu vẫn theo danh sách đang lọc; mỗi thiết bị một hàng; Hãng/Model nằm trong cùng ô tên thiết bị.
  - Quy chuẩn Tahoma 11 pt, tiêu đề 12 pt đậm đã áp dụng cho các biểu mẫu in chi tiết/lịch sử thiết bị hiện có.
- Đã cập nhật `src/style.css` cho khổ A4 ngang và bố cục in.
- Đã cập nhật code trên GitHub. **Chưa chạy build, chưa mở thử tệp Excel-compatible và chưa kiểm tra bản in thực tế**. Cần Pull origin, chạy `npm.cmd run build`, mở tệp `.xls` bằng Excel và kiểm tra in thử với danh sách dài.


### Điều chỉnh phân trang Excel danh mục thiết bị (15/11/2026)
- Tệp xuất danh mục thiết bị được bổ sung thiết lập Excel: A4 ngang, FitToPage, FitWidth = 1, FitHeight = 0 (chỉ co vừa chiều ngang, không ép toàn bộ danh sách dài vào một trang), lặp hàng tiêu đề cột và chân trang Trang X / Y.
- Khi nhiều thiết bị, Excel tự chia thành nhiều trang theo chiều dọc; mỗi trang giữ chiều ngang A4 và hàng tiêu đề lặp lại.
- Ứng dụng ghi các thiết lập này vào tệp xuất; Excel áp dụng chúng khi mở/in. Chưa xác nhận thực tế trên máy người dùng, cần mở file bằng Excel và xem Print Preview.


### Triển khai lại biểu mẫu thêm mới thiết bị (15/11/2026)
- Mở rộng danh mục nhóm thiết bị có mã viết tắt riêng; gồm điện/điện tử, cơ khí, nhiều loại quạt (quạt công nghiệp, hút, cấp, thông gió, làm mát, hướng trục, ly tâm), khí nén, lạnh, nguồn điện và an toàn.
- Tên thiết bị vẫn nhập tự do; nhóm thiết bị bắt buộc chọn từ danh mục chuẩn. Loại bỏ nhánh tự rơi về mã TBK khi nhóm không hợp lệ.
- Có cảnh báo kiểm tra chéo tên có từ “quạt” và nhóm quạt; cảnh báo không tự đổi nhóm và không chặn lưu.
- Thêm xem trước mã định danh trước khi lưu; số thứ tự tự tăng theo mã nhóm trong phạm vi toàn công ty, không khởi động lại theo từng cơ sở; mã cơ sở tiếp nhận hiện đang cấu hình thử nghiệm là HP01. Vị trí chưa có trong bảng mã hiện dùng mã dự phòng 99.
- Thêm ô tick “Thiết bị được chuyển từ cơ sở khác đến”; khi tick, mã tự thêm đúng một dấu * ở cuối. QR sau khi lưu vẫn tạo từ toàn bộ mã.
- Khi sửa hồ sơ đã cấp mã, khóa nhóm thiết bị để tránh phân loại thay đổi nhưng mã cũ không đổi.
- Đồng bộ các mã nhóm bổ sung vào tài liệu QUY_UOC_MA_DINH_DANH_VA_VIET_TAT_THIET_BI.txt. Cập nhật src/db.ts để lưu cờ chuyển cơ sở. Chưa chạy build hoặc kiểm thử trên máy; cần kiểm tra mã xem trước so với mã sau lưu, QR, dữ liệu mẫu cũ và giao diện trên điện thoại.


### Chuẩn hóa xuất Excel danh sách thiết bị (15/11/2026)
- Đổi tiêu đề hiển thị trong tệp thành “Danh sách các thiết bị”.
- Thay tệp HTML giả dạng `.xls` bằng workbook `.xlsx` chuẩn Open XML được tạo bằng thư viện SheetJS đang có trong dự án.
- Bố cục bảng: tiêu đề gộp 10 cột, hàng tiêu đề cột, mỗi thiết bị một hàng; Hãng và Model hiển thị xuống dòng trong ô tên thiết bị; giữ nguyên dữ liệu theo bộ lọc hiện tại.
- Thiết lập độ rộng cột, bộ lọc tự động, khổ A4 ngang, vừa một trang theo chiều rộng và không ép chiều cao; có dòng tổng số thiết bị.
- Tên file: `danh-sach-cac-thiet-bi.xlsx`. Chưa chạy build và chưa mở thử bằng Excel trên máy người dùng; cần kiểm tra nội dung, định dạng và Print Preview.


### Điều chỉnh lại xuất Excel theo đúng phạm vi yêu cầu (15/11/2026)
- Khôi phục nguyên cách xuất Excel-compatible `.xls` (HTML workbook) đã dùng trước đó, giữ nguyên định dạng Tahoma, đường viền, độ rộng cột, A4 ngang, tự chia trang và lặp hàng tiêu đề.
- Chỉ thay nội dung tiêu đề thành **DANH SÁCH THIẾT BỊ**. Không thay sang `.xlsx` và không thay đổi cấu trúc/dàn trang khác.


### Tách riêng xuất Excel và in danh sách thiết bị (15/11/2026)
- **Xuất Excel**: giữ nguyên luồng xuất `.xls` dạng dữ liệu bảng để người dùng tiếp tục xử lý trong Excel; không thêm tiêu đề trình bày hoặc dàn trang in.
- **In danh sách**: bổ sung nút riêng cạnh nút Xuất Excel. Bản in lấy theo danh sách thiết bị đang lọc, có tiêu đề **DANH SÁCH THIẾT BỊ**, Tahoma, tiêu đề 12 pt đậm, bảng kẻ viền rõ ràng, A4 ngang, lặp hàng tiêu đề khi sang trang, tránh ngắt một dòng thiết bị giữa hai trang và đánh số trang dạng Trang X / Y.
- Bản in mở cửa sổ riêng và gọi hộp thoại in của trình duyệt; không sửa dữ liệu và không tác động đến file Excel xuất ra.
- Đã cập nhật `src/App.tsx` trên GitHub. Chưa chạy build và chưa kiểm tra bản in thực tế; cần Pull origin, chạy build, sau đó thử in/xem trước khi in trên Chrome.


### Chốt định dạng xuất Excel chuẩn (15/11/2026)
- Chức năng **Xuất Excel** dùng tệp `.xlsx` chuẩn Open XML qua SheetJS, không dùng HTML đổi đuôi `.xls`.
- Xuất dữ liệu thuần theo danh sách đang lọc; mỗi thiết bị một dòng; các trường Hãng và Model tách thành cột riêng để thuận tiện lọc/sắp xếp/xử lý.
- Có hàng tiêu đề, độ rộng cột hợp lý, bộ lọc Excel và cố định hàng tiêu đề khi cuộn. Không chèn tiêu đề báo cáo, tổng số hay dàn trang in vào dữ liệu.
- Nút **In danh sách** là chức năng độc lập, tạo bản in trình bày riêng với tiêu đề **DANH SÁCH THIẾT BỊ**, bảng có viền, A4 ngang và đánh số trang.
- Đã kiểm tra nội dung hiện tại của `src/App.tsx` trên GitHub: hai chức năng được tách riêng như trên. Chưa chạy build hoặc kiểm tra thao tác thực tế trên máy người dùng.


### Tạo bộ dữ liệu mẫu kho vật tư (15/11/2026)
- Bổ sung 40 vật tư giả định, mã VT-001 đến VT-040, thuộc các nhóm: khí nén, dầu mỡ, vòng bi, phớt/gioăng, thiết bị điện, cảm biến, nguồn điện tử, đường ống, dây cáp, vật tư hàn cắt và tiêu hao.
- Mỗi vật tư có đơn vị tính, tồn kho, tồn tối thiểu, vị trí lưu kho, nhà cung cấp giả định và đơn giá tham khảo để thử bộ lọc, cảnh báo tồn thấp, nhập/xuất và báo cáo.
- Seed theo từng mã vật tư còn thiếu: không xóa, không ghi đè số lượng hoặc thông tin của vật tư đã có; tải lại ứng dụng không tạo trùng.
- Đây là dữ liệu giả định phục vụ thử nghiệm, không phải giá mua hoặc tồn kho thực tế. Khi chuyển sang sử dụng thật cần reset/xóa toàn bộ dữ liệu demo.
- Đã cập nhật seed trong `src/App.tsx` và ghi nhận trong file tiến độ. Chưa chạy build hoặc kiểm tra trực tiếp trên trình duyệt.


### Nâng cấp danh mục kho vật tư (15/11/2026)
- Tên vật tư (kèm mã) trong bảng là vùng nhấp chuột; nhấp vào mở cửa sổ Chi tiết vật tư. Nút **Sửa** trong cột Thao tác tiếp tục mở trực tiếp biểu mẫu chỉnh sửa.
- Biểu mẫu vật tư bổ sung hai trường riêng: **Mã số** (mã nhà sản xuất/mã quy cách) và **Kích cỡ / quy cách**; giữ **Mã vật tư** làm mã quản lý nội bộ.
- Đơn vị tính chuyển thành danh sách chọn: Cái, Con, Cuộn, m, mm, cm, Lít, ml, Kg, g, Bộ, Chai, Hộp, Túi, Thùng, Tấm, Ống, Viên, Đôi, Mét, Bao, Thanh, Can...; đơn vị cũ không nằm trong danh sách vẫn được giữ khi sửa hồ sơ.
- Thêm nút **In danh sách** cạnh **Xuất Excel**. Bản in riêng có tiêu đề DANH SÁCH VẬT TƯ, Tahoma, A4 ngang, lưới ô, lặp tiêu đề khi sang trang và đánh số trang; danh sách in theo kết quả tìm kiếm hiện tại.
- Thêm nút **In chi tiết** trong cửa sổ chi tiết vật tư, dùng mẫu trình bày cùng phong cách với phiếu chi tiết thiết bị.
- Cập nhật kiểu dữ liệu IndexedDB bằng hai trường tùy chọn `partNumber` và `size`, không cần xóa dữ liệu cũ. Xuất Excel bổ sung hai cột tương ứng.
- Đã cập nhật `src/App.tsx`, `src/db.ts` trên GitHub. Chưa chạy build hoặc kiểm tra in thực tế; cần Pull origin và kiểm tra trên Chrome.


### Trạng thái kết thúc buổi làm việc 15/11/2026
- Người dùng tạm thời chấp nhận hai phân hệ đã làm là **Thiết bị** và **Kho vật tư** ở mức giao diện/chức năng thử nghiệm hiện tại.
- Phân hệ Kho vật tư vừa được bổ sung: xem chi tiết khi nhấp tên vật tư, sửa hồ sơ, danh sách chọn đơn vị tính, trường Mã số và Kích cỡ/quy cách, in danh sách và in chi tiết.
- Tạm dừng chỉnh sửa code tại đây; buổi làm việc tiếp theo sẽ tiếp tục từ trạng thái hiện tại, không làm lại hai phân hệ này nếu chưa có yêu cầu.
- Lưu ý: chưa có xác nhận người dùng đã Pull code mới nhất, chạy build thành công hoặc kiểm tra in thực tế. Khi tiếp tục, đồng bộ GitHub về máy và kiểm tra build/chức năng trước khi mở rộng.

### Cập nhật nguyên tắc làm việc và Checklist (16/11/2026)
- **Quyết định mới về Git:** từ nay sửa trực tiếp trên nhánh `main`; không tạo nhánh tính năng mới và không tạo Pull Request trung gian. Trước mỗi lần sửa phải đọc phiên bản mới nhất trên `main`, chỉ thay đổi đúng phạm vi yêu cầu và giữ nguyên các chức năng đang hoạt động.
- **Checklist – trạng thái hiện tại:** đã có phần triển khai thử trên nhánh `feature/checklist-per-device`, gồm thay đổi `src/App.tsx` và `src/db.ts`; hiện chưa được đưa vào `main`. PR #1 đang ở trạng thái Draft/open, chưa merge.
- Nội dung triển khai Checklist trên nhánh thử nghiệm: mỗi thiết bị có một biểu mẫu riêng; tạo/sửa biểu mẫu từ hồ sơ thiết bị; mỗi lần thực hiện lưu một phiếu kết quả độc lập; lưu snapshot và phiên bản biểu mẫu để không làm thay đổi phiếu cũ; có lịch sử thực hiện và bổ sung dữ liệu Checklist vào backup/restore.
- **Chưa xác nhận build/test:** chưa chạy thành công `npm run build` và chưa kiểm thử thao tác thực tế. Không đánh dấu Checklist hoàn thành. Cần kiểm tra mã và khả năng tương thích với luồng dữ liệu/đồng bộ hiện có trước khi đưa phần này vào `main`.
- Người dùng đã thử chạy local bằng PowerShell tại `E:\\DuAnBaoTri\\DuAn_BaoTRi`; `npm install` bị PowerShell chặn script `npm.ps1`, đã khắc phục bằng `npm.cmd install`. Ứng dụng chạy được nhưng không thấy Checklist vì thư mục local đang dùng chưa có thay đổi từ nhánh thử nghiệm. Git chưa được nhận diện trong PATH của PowerShell (`where.exe git` không tìm thấy); người dùng có GitHub Desktop và đã thử đồng bộ.
- Hướng xử lý tiếp theo: kiểm tra kỹ phần Checklist trên nhánh thử nghiệm; sau khi đủ an toàn thì đưa trực tiếp thay đổi cần thiết vào `main` theo quy trình phù hợp, cập nhật file tiến độ này trong cùng đợt. Sau đó người dùng đồng bộ `main` bằng GitHub Desktop và chạy thử local.
- **Quy tắc cập nhật tài liệu:** file chính thức là `BAOTRI_TIENDO_VA_QUYETDINH.md` ở thư mục gốc nhánh `main`. Mọi quyết định mới, thay đổi code, kết quả build/test và việc còn tồn tại phải cập nhật trực tiếp vào đúng file này; không tạo file tiến độ khác.

### Đưa Checklist trực tiếp vào main (16/11/2026)
- Theo yêu cầu người dùng, đã cập nhật trực tiếp hai tệp trên nhánh `main`, không tạo nhánh mới và không dùng Pull Request làm quy trình triển khai:
  - `src/App.tsx`: thêm khu vực Checklist trong hồ sơ thiết bị, tạo/sửa biểu mẫu, thực hiện phiếu và xem lịch sử.
  - `src/db.ts`: bổ sung các kiểu dữ liệu và ba bảng IndexedDB `checklistTemplates`, `checklistVersions`, `checklistResults`; nâng schema lên version 3, giữ nguyên dữ liệu cũ.
- Đã sửa lỗi thiếu trường `templateItemId` trong snapshot kết quả và thống nhất kiểu sự kiện biểu mẫu với `FormEvent`.
- Đã đọc lại các tệp trên `main` sau khi cập nhật; xác nhận mã Checklist và schema v3 hiện diện.
- **Chưa chạy được build/test trong môi trường này.** Người dùng cần đồng bộ nhánh `main` bằng GitHub Desktop, sau đó chạy `npm.cmd run build` và kiểm tra giao diện Checklist trong hồ sơ một thiết bị.
- Lưu ý: PR #1/nhánh thử nghiệm trước đó không phải quy trình triển khai nữa; các thay đổi Checklist đã được ghi trực tiếp vào `main`. Không tiếp tục tạo nhánh/PR mới cho các lần sửa sau.


### Nâng cấp Checklist tự sinh mẫu theo loại thiết bị (16/11/2026)
- Khi mở hồ sơ thiết bị chưa có Checklist, hệ thống tự tạo và lưu biểu mẫu nền phiên bản 1 theo nhóm thiết bị; mỗi thiết bị vẫn có biểu mẫu riêng, không dùng chung dữ liệu.
- Bổ sung bộ tiêu chí kỹ thuật chuyên biệt cho các nhóm: động cơ điện, máy bơm, máy nén khí, máy sấy khí, bộ lọc khí nén, hệ thống khí nén, tủ điện (tổng/phân phối/điều khiển), ATS, tủ tụ bù, biến tần, UPS, máy biến áp, thiết bị đo lường, máy phát điện, Chiller, kho lạnh, điều hòa thông gió, quạt, tháp giải nhiệt, nồi hơi, nồi hấp, PCCC, thang máy, hộp giảm tốc, băng tải và thiết bị xưởng. Nhóm chưa có bộ riêng dùng bộ tiêu chí nền an toàn và có thể chỉnh sửa.
- Mỗi mẫu tự sinh có sẵn các hạng mục bắt buộc theo dạng Đạt / Không đạt / Không áp dụng; Admin chỉ cần sửa, thêm hoặc bỏ hạng mục theo cấu hình thực tế, không phải tạo từ đầu.
- Việc tạo mẫu được thực hiện trong transaction và kiểm tra biểu mẫu đã tồn tại trước khi thêm, tránh tạo trùng khi component khởi tạo lại. Không ghi đè biểu mẫu đã tùy chỉnh, không ảnh hưởng phiên bản và phiếu kết quả cũ.
- Nút Thực hiện Checklist chỉ được kích hoạt khi biểu mẫu và phiên bản hiện hành đã sẵn sàng; bổ sung điều kiện kiểm tra phiên bản để tránh mở phiếu rỗng.
- Đã cập nhật trực tiếp src/App.tsx trên main. Chưa chạy build/test và chưa kiểm thử thao tác thực tế; cần người dùng Pull origin, chạy build, thử mở nhiều loại thiết bị, thực hiện và lưu phiếu. Chưa tuyên bố chức năng đã hoàn tất.


### Tách lịch sử Checklist và bổ sung in phiếu A4 (16/11/2026)
- Giữ nguyên phân hệ **Lịch sử bảo trì – sửa chữa**: chỉ ghi nhận công việc bảo dưỡng/sửa chữa thủ công; số lần ghi nhận không tự tăng khi thực hiện Checklist.
- Đổi phần kết quả thực hiện thành khu vực **Lịch sử Checklist** riêng, hiển thị số phiếu đã lưu, thời gian, phiên bản biểu mẫu, người thực hiện và kết quả chung. Khi chưa có phiếu, hiển thị hướng dẫn lưu phiếu rõ ràng.
- Mỗi phiếu Checklist có nút **In phiếu A4**. Mẫu in gồm thông tin thiết bị, biểu mẫu/phiên bản, thời gian, người thực hiện, kết quả, toàn bộ hạng mục/kết quả/ghi chú và khu vực ký xác nhận.
- Mẫu in được tách riêng khỏi mẫu in lịch sử bảo trì – sửa chữa và không thay đổi dữ liệu phiếu đã lưu.
- Đã cập nhật trực tiếp src/App.tsx và src/style.css trên main. Chưa chạy build hoặc xác minh in trên Chrome; cần đồng bộ và kiểm thử thực tế. Không tuyên bố chức năng in hoàn tất trước khi kiểm thử.


### Chốt tách nghiệp vụ Bảo trì – Checklist và Bảo dưỡng – Sửa chữa; giới hạn Checklist bằng QR (16/11/2026)
- Chốt hai nghiệp vụ độc lập:
  1. **Bảo trì – Checklist:** kiểm tra tình trạng thiết bị theo biểu mẫu riêng của từng thiết bị; mỗi lần thực hiện tạo một phiếu độc lập, giữ nguyên version và lịch sử.
  2. **Bảo dưỡng – Sửa chữa:** ghi nhận công việc kỹ thuật thực tế, vật tư/phụ tùng, thông số, kết quả và người thực hiện; có nhật ký riêng, không cộng/trộn với phiếu Checklist.
- Checklist chỉ được hiển thị trong hồ sơ thiết bị được mở bằng thao tác quét QR hợp lệ. Mở hồ sơ từ danh mục thiết bị không hiển thị Checklist; không có thao tác chọn thiết bị từ danh sách để thực hiện Checklist hàng loạt.
- Khi phiếu Checklist có kết quả Không đạt, cho phép tạo phiếu Sửa chữa từ chính phiếu đó; nội dung các hạng mục không đạt được chuyển sang phần mô tả công việc và lưu liên kết nguồn bằng `checklistResultId`. Hai bản ghi vẫn độc lập.
- Mẫu in Checklist chuyển sang bảng hàng/cột kiểu phiếu giấy: STT, nội dung kiểm tra, ô Đạt, ô Không đạt, ô KPH, kết quả/thông số và ghi chú; có lặp tiêu đề bảng khi sang trang và giữ vùng ký xác nhận.
- Cập nhật trực tiếp trên nhánh `main`: `src/App.tsx`, `src/db.ts`, `src/style.css`. Nâng IndexedDB lên schema v4 để bổ sung chỉ mục liên kết tùy chọn từ nhật ký sang phiếu Checklist; dữ liệu cũ được giữ nguyên.
- **Chưa chạy build/test và chưa xác minh camera QR, lưu phiếu, liên kết sửa chữa hoặc bản in thực tế.** Cần đồng bộ main về máy, chạy `npm.cmd run build`, sau đó thử: mở hồ sơ từ danh mục (không thấy Checklist), quét QR (thấy Checklist), lưu phiếu, tạo phiếu sửa chữa từ kết quả Không đạt, kiểm tra lịch sử riêng và in A4.
- Mẫu giấy vật lý cụ thể chưa được đính kèm trong cuộc trao đổi; bảng in hiện được chuẩn hóa theo cấu trúc hàng/cột nêu trên. Nếu cần khớp chính xác từng cột của biểu mẫu đang dùng tại đơn vị, cần đối chiếu ảnh/scan mẫu giấy gốc.


### Điều chỉnh quyền xem lịch sử Checklist và căn lề in A4 (16/11/2026)
- Sửa nguyên tắc truy cập: quét QR chỉ bắt buộc khi tạo mới/thực hiện Checklist hoặc chỉnh sửa biểu mẫu. Khi mở hồ sơ thiết bị bình thường, người dùng vẫn xem được lịch sử Checklist đã lưu, xem chi tiết và in lại từng phiếu mà không cần quét QR.
- Thành phần Checklist luôn tải lịch sử theo mã thiết bị; chỉ khi có quyền truy cập từ luồng quét QR mới tự tạo mẫu mặc định và hiện nút Tạo/Sửa biểu mẫu, Thực hiện Checklist. Việc xem lịch sử không tự sinh biểu mẫu.
- Sửa CSS in phiếu A4: gom quy tắc trang Checklist về lề trên 5mm, lề trái/phải 7mm, bỏ padding 8mm thừa của báo cáo, giảm khoảng cách tiêu đề/metadata và tránh cộng dồn lề trang với lề nội dung. Ẩn toàn bộ giao diện, chỉ in phiếu Checklist.
- Cập nhật trực tiếp trên `main`: `src/App.tsx`, `src/style.css`, và file tiến độ này.
- Chưa chạy build/test hoặc xem bản in thực tế; cần đồng bộ về máy, chạy `npm.cmd run build`, sau đó mở hồ sơ từ danh mục để in phiếu cũ không cần QR và kiểm tra lề trên A4.

### Chốt kiến trúc tài khoản và dữ liệu tập trung bằng Supabase (16/11/2026) – GHI NHẬN TRƯỚC KHI TRIỂN KHAI

**Quyết định mới nhất – thay thế các định hướng cũ về chỉ dùng một người dùng và chưa cần đăng nhập thật:**
- Chốt dùng **Supabase** làm nền tảng backend cho xác thực tài khoản, PostgreSQL và lưu trữ tệp; giao diện React/Vite hiện tại tiếp tục được giữ, có thể triển khai tĩnh trên GitHub Pages.
- Mục tiêu là xây nền tảng có thể thương mại hóa: nhiều tài khoản, nhiều doanh nghiệp (multi-tenant), dữ liệu được cách ly ở database/backend, không dựa vào việc ẩn giao diện.
- Hồ sơ tài khoản dự kiến có: mã tài khoản/UUID do Auth cấp, tên đăng nhập hoặc định danh đăng nhập, họ và tên, ngày sinh; vị trí làm việc sẽ bổ sung ở giai đoạn sau. Không lưu mật khẩu dạng văn bản trong bảng hồ sơ; mật khẩu do Supabase Auth quản lý.
- Khi tạo phiếu Checklist, người thực hiện phải được xác định từ phiên đăng nhập đã xác thực. Ứng dụng không cho tự nhập/chọn tên người thực hiện. Backend/database phải ràng buộc danh tính người tạo; phiếu lưu cả performed_by_user_id và ảnh chụp họ tên tại thời điểm thực hiện để lịch sử không đổi khi hồ sơ tài khoản được cập nhật.
- Tài khoản khác không được ghi nhận công việc dưới danh tính người khác. Xác thực phải được kiểm tra ở backend/RLS hoặc cơ chế ghi phiếu an toàn phía server; chỉ khóa ô nhập trên frontend là không đủ.
- Tài khoản đầu tiên/khởi tạo tổ chức và vai trò quản trị phải có quy trình an toàn; không tự tạo quyền Admin mặc định cho mọi người đăng ký.
- Thiết kế tenant: các bảng nghiệp vụ sẽ gắn organization_id; membership liên kết user với tổ chức và role. Cần RLS kiểm soát mọi truy cập theo tổ chức. Chưa migrate dữ liệu nghiệp vụ IndexedDB hiện có lên cloud cho đến khi có kế hoạch backup/đối chiếu và được kiểm tra.
- Dữ liệu hiện tại trong ứng dụng vẫn đang lưu bằng IndexedDB trên từng trình duyệt/máy. **Chưa có đăng nhập thật, chưa có database tập trung, chưa có đồng bộ đa thiết bị.** Không được mô tả hệ thống đã có bảo mật tài khoản hoặc dữ liệu cloud trước khi triển khai và kiểm thử thành công.
- Storage dự kiến dùng Supabase Storage cho ảnh/tài liệu; không đưa service-role key hoặc secret vào frontend/repository. Chỉ dùng publishable/anon key ở client cùng RLS đúng chuẩn.
- Trước khi triển khai code: rà soát toàn bộ thao tác đọc/ghi các bảng hiện tại, backup/restore, seed dữ liệu mẫu, luồng Checklist và luồng Bảo dưỡng – Sửa chữa; lập kế hoạch schema/migration và cách xử lý dữ liệu cũ. Giữ nguyên các phân hệ Thiết bị, Kho vật tư và Checklist; thay đổi từng bước.
- Cần tạo Supabase project và cấu hình URL + publishable/anon key qua biến môi trường khi đến bước kết nối thực tế. Không commit file .env chứa bí mật. Nếu chưa có project/credentials thì chỉ có thể chuẩn bị code/schema và ghi rõ chưa kết nối, không giả định backend đã hoạt động.

**Quy trình bắt buộc cho mọi thao tác lớn từ nay:**
1. Trước khi bắt đầu: cập nhật mục này hoặc thêm ghi chú “trước khi triển khai” vào chính file BAOTRI_TIENDO_VA_QUYETDINH.md trên main, nêu mục tiêu, phạm vi, file/bảng dự kiến tác động, rủi ro và cách kiểm thử.
2. Sau khi hoàn tất từng thao tác lớn: cập nhật ngay trong chính file này các file đã sửa, commit, migration/schema, kết quả build/test thực tế, những gì chưa làm và bước tiếp theo.
3. Không tạo file tiến độ thứ hai. Không đánh dấu hoàn thành nếu chưa chạy kiểm thử tương ứng.
4. Tiếp tục sửa trực tiếp trên main, không tạo branch hoặc Pull Request; bảo toàn chức năng đang hoạt động và dữ liệu hiện có.

**Trạng thái trước khi bắt đầu:** mới chốt kiến trúc và ghi nhận kế hoạch. Chưa sửa mã nguồn cho Supabase/Auth/Profile/tenant; chưa tạo Supabase project; chưa có URL/key; chưa thay đổi nơi lưu dữ liệu. Ứng dụng hiện vẫn dùng IndexedDB cục bộ.

### Mở rộng danh mục thiết bị và Checklist thông minh theo tên thiết bị (16/11/2026) – GHI NHẬN TRƯỚC KHI SỬA CODE
**Mục tiêu:** khắc phục việc danh mục nhóm thiết bị quá hẹp (ví dụ chưa có máy hàn xung/công cụ điện), đồng thời làm Checklist mặc định phù hợp hơn với thiết bị thực tế của từng doanh nghiệp.

**Phạm vi dự kiến:**
- Rà soát và mở rộng danh mục nhóm theo các mảng: điện/điện tử; cơ khí/truyền động; công cụ và dụng cụ điện cầm tay; hàn/cắt; máy gia công; khí nén; lạnh/HVAC; nguồn điện; PCCC/an toàn; đo lường/điều khiển; thiết bị sản xuất và phụ trợ.
- Bổ sung nhóm **Khác** để ghi nhận thiết bị đặc thù/chưa có nhóm riêng; vẫn phải cấp mã định danh hợp lệ, không làm lỗi tạo QR.
- Rà soát luồng tạo Checklist mặc định: kết hợp nhóm đã chọn với từ khóa trong tên thiết bị; ưu tiên bộ tiêu chí chuyên biệt khi tên thể hiện rõ loại máy (ví dụ máy hàn xung, máy khoan, máy mài), đồng thời luôn có phần kiểm tra nền/an toàn phù hợp.
- Hạng mục bắt buộc phải được đánh dấu rõ và không bị suy đoán bỏ qua; mục phụ thuộc cấu hình chỉ nên để Không áp dụng khi thiết bị không có chức năng đó. Người quản trị vẫn có thể tùy chỉnh biểu mẫu riêng của từng thiết bị; không ghi đè mẫu đã tạo, version cũ hoặc phiếu đã lưu.
- Rà soát cảnh báo lệch giữa tên và nhóm; không tự ý đổi nhóm/mã thiết bị khi người dùng nhập tên.

**File dự kiến tác động:** `src/App.tsx`; cập nhật file tiến độ này sau khi hoàn tất. Chưa dự kiến đổi schema IndexedDB vì trường category hiện lưu dạng chuỗi và có thể giữ tương thích.

**Rủi ro cần tránh:** đổi mã nhóm làm sai mã định danh đã cấp; thay mẫu tự động làm mất tùy chỉnh; tạo checklist không phù hợp hoặc yêu cầu thao tác nguy hiểm khi thiết bị đang mang điện/chạy; nhóm Khác không cấp được mã; sửa danh mục làm hỏng lọc/sắp xếp thiết bị.

**Cách kiểm thử:** build TypeScript/Vite; thử tạo thiết bị Máy hàn xung, Máy khoan, Máy mài, thiết bị cơ khí/điện phổ biến và một thiết bị lạ thuộc Khác; kiểm tra mã/QR, nhóm hiển thị và bộ Checklist sinh ra; xác nhận mẫu cũ/phiếu cũ không đổi và có thể sửa version mới. Chưa đánh dấu hoàn thành trước khi có kết quả build/test.


### Đã mở rộng danh mục thiết bị và Checklist theo tên (16/11/2026)
- Đã sửa trực tiếp `src/App.tsx` trên nhánh `main`.
- Mở rộng danh mục lên **97 loại thiết bị**, chia theo các nhóm: điện/điện tử/tự động hóa; cơ khí/máy móc/truyền động; công cụ điện/dụng cụ; hàn/cắt/gia công; quạt; khí nén/nhiệt/lạnh/HVAC; nguồn điện/an toàn/PCCC; thiết bị sản xuất/đóng gói/phụ trợ; **Khác**.
- Bổ sung các loại cụ thể gồm **Máy hàn xung**, máy hàn MIG/MAG, TIG, máy hàn que, máy khoan cầm tay/khoan bàn, máy mài, máy cắt, máy siết bu lông, máy tiện/phay/ép/dập, PLC, HMI, cảm biến, bo mạch điện tử, máy đóng gói, chiết rót, dán nhãn, robot, xử lý nước và nhiều loại khác.
- Nhóm **Khác** có mã nhóm riêng `KHC`, vì vậy vẫn cấp được mã định danh và QR; thiết bị lạ không bị chặn khi tạo hồ sơ.
- Bổ sung gợi ý nhóm dựa trên tên nhập. Ví dụ “máy hàn xung” được gợi ý nhóm “Máy hàn xung”; gợi ý chỉ cảnh báo để người dùng xác nhận, không tự đổi nhóm hoặc mã đã cấp.
- Checklist mặc định nay kết hợp tiêu chí nền/an toàn + tiêu chí theo nhóm + tiêu chí chuyên biệt nhận diện từ tên thiết bị (đã bổ sung các bộ từ khóa cho máy hàn xung/máy hàn, máy khoan, máy mài, máy cắt/cưa, máy siết bu lông, máy nén khí, máy in, máy đóng gói và thiết bị đo).
- Các hạng mục sinh tự động đang được đặt `required: true`; trong trình sửa biểu mẫu, Admin vẫn có thể đánh dấu bỏ bắt buộc hoặc xóa/thêm mục theo điều kiện thực tế. Hướng dẫn từng mục nhắc tuân thủ hướng dẫn nhà sản xuất và cô lập năng lượng/điều kiện an toàn trước khi kiểm tra.
- Không đổi schema IndexedDB; trường `Asset.category` tiếp tục là chuỗi. Không tự cập nhật/ghi đè Checklist đã tồn tại, không sửa version cũ và không ảnh hưởng phiếu đã lưu. Muốn áp dụng bộ mẫu mới cho thiết bị đã có biểu mẫu thì cần thao tác tạo version mới có kiểm soát ở bước sau.
- Kiểm tra tĩnh danh mục: 97 loại, không phát hiện mã nhóm trùng. Đã kiểm tra mã nguồn có phần gợi ý tên và logic ghép Checklist.
- **Chưa chạy `npm.cmd run build`, chưa kiểm thử giao diện hoặc thực hiện Checklist thực tế** vì chưa có môi trường local trong phiên này. Chưa đánh dấu chức năng hoàn tất.
- Commit code: `c8409a5db2390e567ccba2d70f4d93fbeb637f79`.
- Commit ghi kế hoạch trước khi sửa: `cc0945bdaa7726a4b20bff8eefdad2010bd8d6f9`.
- Bước tiếp theo: Pull origin trên GitHub Desktop, chạy build; thử tạo Máy hàn xung và một thiết bị lạ chọn Khác; kiểm tra mã/QR, nhóm được gợi ý, nội dung Checklist và xác nhận các mẫu/phiếu cũ còn nguyên.


### Chế độ thử Checklist không cần QR và tách menu nghiệp vụ (16/11/2026) – GHI NHẬN TRƯỚC KHI SỬA
**Yêu cầu:** trong giai đoạn thử nghiệm cho phép mở/thực hiện Checklist từ danh mục thiết bị mà không quét QR; khi nghiệm thu xong sẽ tắt chế độ thử và bắt buộc quét QR. Tách menu trái thành “Bảo trì – Checklist”, “Bảo dưỡng – Sửa chữa” và “Kế hoạch”. Trong Kế hoạch trước mắt có lối vào “Kế hoạch bảo dưỡng” hiện hữu; “Kế hoạch bảo trì” hiển thị là phần sẽ phát triển sau.

**Phạm vi dự kiến:**
- Thêm hằng cấu hình duy nhất `CHECKLIST_TEST_MODE = true`. Khi true, mở hồ sơ từ màn hình Checklist được cấp quyền thao tác Checklist mà không cần QR; khi false, chỉ đường quét QR mới cấp quyền. Không xóa/né luồng QR hiện có.
- Thêm trang “Bảo trì – Checklist” liệt kê thiết bị đang quản lý; mở thiết bị từ trang này là đường thử Checklist. Danh mục Thiết bị thông thường vẫn chỉ xem/in lịch sử, không được thao tác khi chế độ test tắt.
- Tách menu “Bảo dưỡng – Sửa chữa” thành mục riêng.
- Thêm mục “Kế hoạch” làm trang nhóm; giữ nguyên trang và dữ liệu “Kế hoạch bảo dưỡng” hiện hữu, truy cập qua mục con. Mục “Kế hoạch bảo trì” là placeholder chưa triển khai.
- Cập nhật điều hướng mobile và nhãn trang liên quan. Không đổi schema, dữ liệu, quy tắc lưu Checklist, hay các luồng nghiệp vụ khác.

**Rủi ro:** mở nhầm quyền Checklist từ màn hình danh mục thông thường sau khi chuyển sang production; làm mất đường vào kế hoạch bảo dưỡng đang chạy; điều hướng mobile/desktop không đồng nhất.

**Kiểm thử:** build; xác nhận chế độ test true cho phép vào Checklist từ menu Checklist mà không quét; danh mục Thiết bị thường vẫn chỉ xem/in; quét QR vẫn vào được; trang Bảo dưỡng – Sửa chữa và Kế hoạch bảo dưỡng giữ dữ liệu cũ; menu Kế hoạch bảo trì chỉ là placeholder. Sau nghiệm thu, đổi duy nhất hằng cấu hình sang false và kiểm tra đường QR.


### Đã thêm chế độ thử Checklist và tách menu (16/11/2026)
- Sửa trực tiếp `src/App.tsx` trên nhánh `main`; không đổi schema IndexedDB.
- Thêm cấu hình duy nhất `CHECKLIST_TEST_MODE = true`. Khi đang true, vào menu **Bảo trì – Checklist**, chọn thiết bị và mở hồ sơ thì được tạo/sửa biểu mẫu và thực hiện Checklist không cần quét QR. Cờ này chỉ cấp quyền cho luồng vào từ trang Checklist thử nghiệm; mở thiết bị từ menu **Thiết bị** thông thường vẫn chỉ xem/in lịch sử.
- Giữ nguyên đường quét QR: quét QR thành công vẫn cấp quyền thao tác Checklist. Khi thử nghiệm hoàn tất, chỉ cần đổi `CHECKLIST_TEST_MODE` từ `true` thành `false`; khi đó trang Checklist không tự cấp quyền nữa và phải quét QR. Không xóa hoặc làm tắt chức năng QR.
- Tách menu trái desktop thành các mục riêng: **Bảo trì – Checklist**, **Thiết bị**, **Kho vật tư**, **Kế hoạch**, **Bảo dưỡng – Sửa chữa**, **Báo cáo**, **Cài đặt**.
- Trang **Bảo trì – Checklist** liệt kê thiết bị đang quản lý; nhấp tên hoặc nút Mở Checklist để mở hồ sơ và thao tác theo chế độ thử hiện tại.
- Thêm trang nhóm **Kế hoạch**. Có lối vào **Kế hoạch bảo dưỡng** đang dùng (giữ nguyên trang, dữ liệu và bảng công việc cũ); **Kế hoạch bảo trì** là mục giới thiệu sẽ phát triển sau, chưa tạo nghiệp vụ hoặc dữ liệu giả.
- Cập nhật menu mobile: có lối tắt Checklist và Kế hoạch; Kho vật tư, Kế hoạch bảo dưỡng, Bảo dưỡng – Sửa chữa, Báo cáo, Cài đặt nằm trong mục Thêm.
- Bổ sung tiêu đề đúng cho trang con Kế hoạch bảo dưỡng.
- Kiểm tra tĩnh mã nguồn sau cập nhật: xác nhận chỉ có một cấu hình test; menu Checklist cấp quyền khi test bật; quyền QR vẫn được cấp; menu Kế hoạch và đường vào trang Kế hoạch bảo dưỡng cũ tồn tại. Tất cả kiểm tra tĩnh trên đều đạt.
- **Chưa chạy `npm.cmd run build` và chưa kiểm thử giao diện desktop/mobile hoặc luồng camera thật.** Không khẳng định build thành công.
- Commit code chế độ test/menu: `aee6e715b4a5bced36098c53991d756b1fdbb322`.
- Commit sửa tiêu đề trang con kế hoạch: `a5ce60de5dfe9d4b50bba889dbbb7b98c3d002e1`.
- Commit ghi kế hoạch trước khi sửa: `b102b6303ef52898a4eccc05fba0aecdb72789db`.
- **Bước tiếp theo:** Pull origin trên GitHub Desktop; chạy build; thử Checklist từ menu không QR; thử lại quét QR; kiểm tra riêng trang Thiết bị, Bảo dưỡng – Sửa chữa, Kế hoạch và menu mobile. Sau khi bạn xác nhận Checklist đạt yêu cầu, đổi `CHECKLIST_TEST_MODE` thành `false` và kiểm thử lại để khóa quyền về quét QR.


### Bổ sung tạo nhóm thiết bị ngay trong form Thêm thiết bị (16/11/2026) – GHI NHẬN TRƯỚC KHI SỬA
**Mục tiêu:** khi danh mục nhóm hiện có không phù hợp, người dùng có thể tạo nhóm mới ngay tại form Thêm thiết bị và chọn nhóm đó để cấp mã định danh.

**Phạm vi dự kiến:**
- Chỉ tác động `src/App.tsx` và file tiến độ này.
- Thêm nút “+ Thêm nhóm” cạnh trường Nhóm thiết bị; nhập tên nhóm và mã nhóm ngắn (chữ/số, viết hoa).
- Nhóm do người dùng tạo được lưu trong localStorage của trình duyệt hiện tại, hiển thị ở nhóm “Nhóm tự tạo” và dùng được khi tạo thiết bị lần sau.
- Kiểm tra trùng tên/mã với cả danh mục chuẩn và nhóm tự tạo; mã nhóm mới phải được dùng trong cơ chế cấp mã thiết bị hiện tại.
- Không sửa mã nhóm chuẩn, không đổi mã thiết bị đã cấp, không đổi schema IndexedDB và không ảnh hưởng dữ liệu thiết bị cũ.

**Rủi ro:** mã nhóm trùng làm sai chuỗi mã định danh; nhóm lưu cục bộ không tự đồng bộ sang máy/trình duyệt khác (đúng với trạng thái lưu trữ hiện tại, trước khi triển khai Supabase).

**Cách kiểm thử:** kiểm tra tĩnh luồng thêm nhóm, lưu localStorage, kiểm tra trùng tên/mã, chọn nhóm tự tạo và xem mã dự kiến; chạy `npm.cmd run build`. Chưa đánh dấu hoàn thành nếu chưa chạy build thực tế.


### Đã bổ sung tạo nhóm thiết bị ngay trong form Thêm thiết bị (16/11/2026)
- Sửa trực tiếp `src/App.tsx` trên `main`; không tạo branch/PR và không đổi schema IndexedDB.
- Bên cạnh trường **Nhóm thiết bị** có nút **Thêm nhóm**. Khi mở, người dùng nhập tên nhóm và mã nhóm 2–5 ký tự chữ không dấu/số; bấm **Lưu nhóm và chọn** để lưu và tự chọn nhóm vừa tạo cho thiết bị đang nhập.
- Nhóm tự tạo được lưu trong `localStorage` với khóa `baotri-custom-asset-categories`, tự nạp lại khi mở ứng dụng và hiển thị trong nhóm chọn **Nhóm tự tạo** ở những lần thêm thiết bị tiếp theo. Lưu ý: dữ liệu nhóm hiện chỉ có trên trình duyệt/máy đã tạo, chưa đồng bộ sang máy khác vì ứng dụng chưa kết nối Supabase.
- Kiểm tra trùng tên và mã với toàn bộ danh mục chuẩn + nhóm tự tạo; mã mới chỉ chấp nhận 2–5 ký tự A–Z/0–9. Mã nhóm tự tạo được đưa vào cả phần xem trước và bước cấp mã thiết bị thực tế; không thay đổi mã đã cấp cho thiết bị cũ.
- Khi sửa hồ sơ thiết bị hiện có, trường nhóm vẫn bị khóa như trước để tránh làm sai mã định danh.
- Kiểm tra tĩnh mã nguồn: đạt các mục nạp/lưu localStorage, xác thực tên/mã trùng, định dạng mã, hiển thị nhóm tự tạo, tự chọn nhóm mới, dùng mã tự tạo cho preview và lưu thiết bị; đã sửa cú pháp JSX của AssetModal.
- **Chưa chạy `npm.cmd run build` và chưa kiểm thử trực tiếp trên giao diện/trình duyệt.** Vì vậy chưa xác nhận build thành công; cần chạy build và thử tạo một nhóm mới, tải lại trang, tạo thiết bị dùng nhóm đó để xác nhận mã.
- Commit ghi kế hoạch trước khi sửa: `fb29ec6cbb1a6b5494964c2cd846d6de8c4a8db7`.
- Commit code bổ sung nhóm tự tạo: `4af4840eb6abc729bde418659f7c107d22a06474`.
- Commit sửa JSX và thứ tự lưu an toàn: `4bd0667f067296cc52f55a26939616132656873f`.
- Bước tiếp theo: Pull origin trên GitHub Desktop, chạy `npm.cmd run build`; mở Thêm thiết bị, tạo thử nhóm (ví dụ Máy đóng đai / MDD), xác nhận nhóm tự được chọn và mã dự kiến bắt đầu bằng `MDD-`; tải lại trang để xác nhận nhóm còn trong danh sách.


### Điều chỉnh lại cấu trúc danh mục thiết bị thành 2 cấp (16/11/2026) – GHI NHẬN TRƯỚC KHI SỬA
**Lý do:** yêu cầu trước đã hiểu sai khái niệm: người dùng cần tạo *nhóm lớn* (ví dụ `TB Y TẾ`), bên trong nhóm có nhiều *loại thiết bị* (ví dụ `Máy làm răng` – mã `MLR`), không phải thêm loại thiết bị thành một nhóm phẳng.

**Phạm vi sửa:**
- Chỉ sửa `src/App.tsx` và cập nhật file tiến độ chính thức.
- Đổi cấu trúc danh mục bổ sung thành nhóm `{label, items:[{name,code}]}`; danh mục chuẩn hiện tại giữ nguyên.
- Trong form Thêm thiết bị, thao tác thêm danh mục phải cho phép tạo nhóm mới kèm loại thiết bị đầu tiên và mã loại; các lần sau có thể thêm loại thiết bị vào nhóm bổ sung đã tạo.
- Danh sách chọn hiển thị đúng optgroup tên nhóm và các loại thiết bị/mã bên trong; trường `Asset.category` tiếp tục lưu tên loại thiết bị để không phá hồ sơ cũ và logic Checklist hiện có.
- Mã loại thiết bị phải duy nhất toàn danh mục và tiếp tục được dùng làm tiền tố mã định danh; không đổi mã thiết bị đã cấp.
- Chuyển đổi dữ liệu phẳng đã lưu từ phiên bản trước sang một nhóm tương thích khi nạp, không làm mất các loại đã tạo. Không xóa dữ liệu localStorage cũ.

**Rủi ro:** dữ liệu danh mục cũ đang lưu dạng mảng phẳng; cần hỗ trợ migration khi nạp. Tên loại thiết bị phải duy nhất vì hồ sơ hiện tại chỉ lưu tên loại, chưa lưu group ID.

**Kiểm thử:** kiểm tra migration dữ liệu cũ; tạo `TB Y TẾ` + `Máy làm răng` + `MLR`; thêm tiếp loại khác vào nhóm TB Y TẾ; xác nhận select hiển thị đúng nhóm/loại; xác nhận mã preview và mã lưu dùng `MLR`; xác nhận danh mục chuẩn và hồ sơ cũ không đổi; chạy `npm.cmd run build` nếu có môi trường build.


### Đã sửa danh mục thiết bị thành đúng cấu trúc 2 cấp: Nhóm → Loại thiết bị (16/11/2026)
- Sửa trực tiếp `src/App.tsx` trên `main`. Cấu trúc danh mục bổ sung hiện là nhóm có `label` và danh sách `items`, không còn danh sách phẳng hiển thị dưới nhãn “Nhóm tự tạo”.
- Trong form **Thêm thiết bị**, trường chọn được đặt đúng tên **Loại thiết bị**; các lựa chọn được gom theo tên nhóm. Nút **Thêm nhóm / loại thiết bị** mở phần nhập danh mục:
  - Chọn `Tạo nhóm mới`, nhập tên nhóm (ví dụ `TB Y TẾ`), tên loại (ví dụ `Máy làm răng`) và mã loại (`MLR`) để tạo nhóm cùng loại đầu tiên.
  - Hoặc chọn một nhóm bổ sung đã có để thêm loại thiết bị mới vào nhóm đó.
  - Sau khi lưu, loại mới tự được chọn cho hồ sơ đang tạo.
- Danh sách chọn hiển thị dạng `TB Y TẾ` (nhóm) chứa `Máy làm răng · MLR` (loại). Mã loại tiếp tục là tiền tố mã định danh; cả xem trước và lưu thiết bị đều dùng danh mục hai cấp.
- Kiểm tra trùng tên loại và mã loại trên toàn bộ danh mục chuẩn + danh mục bổ sung; tên nhóm mới không được trùng nhóm chuẩn hoặc nhóm bổ sung đã có.
- Tương thích dữ liệu đã lưu từ phiên bản trước: mảng phẳng cũ được nạp và gom vào nhóm `Danh mục bổ sung (cũ)` để không mất loại đã tạo. Khi thêm mục mới, dữ liệu được lưu theo cấu trúc hai cấp. Không đổi trường `Asset.category` (vẫn lưu tên loại), không đổi schema IndexedDB và không đổi mã thiết bị đã cấp.
- Kiểm tra tĩnh mã nguồn: đạt các mục cấu trúc nhóm/loại, migration dữ liệu cũ, tạo nhóm mới, thêm loại vào nhóm có sẵn, render optgroup, kiểm tra trùng, dùng mã loại trong preview và lưu; đã loại bỏ nhãn “Nhóm tự tạo”.
- **Chưa chạy `npm.cmd run build` và chưa kiểm thử giao diện thực tế.** Cần build và thử đúng ví dụ `TB Y TẾ` → `Máy làm răng` → `MLR`, sau đó thêm tiếp một loại khác vào nhóm TB Y TẾ và tải lại trang để kiểm tra dữ liệu còn nguyên.
- Commit ghi kế hoạch trước khi sửa: `62a53565b2cdff8e63ef09be452df858266aff8b`.
- Commit sửa cấu trúc hai cấp: `cffcf4b8ebc8e4282cecc05cd75f8ed8202f6fd2`.
- Bước tiếp theo: Pull origin trên GitHub Desktop, chạy `npm.cmd run build`, rồi thử quy trình nhóm/loại như trên.


### Khóa lại Checklist: bắt buộc quét mã QR (16/11/2026) – GHI NHẬN TRƯỚC KHI SỬA
- Yêu cầu: kết thúc chế độ thử nghiệm mở Checklist từ danh sách thiết bị; từ nay tạo mới/chỉnh sửa biểu mẫu/thực hiện Checklist phải đi qua quét QR.
- Phạm vi: đổi duy nhất `CHECKLIST_TEST_MODE` trong `src/App.tsx` từ `true` thành `false`; giữ nguyên luồng QR, lịch sử phiếu cũ, xem chi tiết và in lại không cần QR.
- Rủi ro: nếu còn nhánh UI nào cấp quyền từ chế độ thử nghiệm thì phải rà soát điều kiện `CHECKLIST_TEST_MODE`; không thay đổi quyền xem/in lịch sử.
- Kiểm thử: kiểm tra tĩnh cờ chỉ còn một lần khai báo và bằng `false`; kiểm tra trang Checklist không cấp quyền thao tác khi không quét QR; kiểm tra đường quét QR vẫn cấp quyền; kiểm tra lịch sử/chi tiết/in vẫn không cần QR. Chưa chạy build thực tế.


### Đã khóa lại Checklist về chế độ bắt buộc quét QR (16/11/2026)
- Đổi `CHECKLIST_TEST_MODE` từ `true` thành `false` trong `src/App.tsx` trên `main`.
- Trang Bảo trì – Checklist vẫn có thể hiển thị danh sách thiết bị, nhưng mở thiết bị từ trang này không còn cấp quyền tạo/sửa/thực hiện Checklist. Các thao tác đó phải đi qua luồng quét QR.
- Đã kiểm tra tĩnh: cờ cấu hình là `false`; nhánh cấp quyền từ trang Checklist vẫn phụ thuộc cờ này; luồng QR vẫn có `setChecklistAccess(true)`; thành phần lịch sử Checklist vẫn được render. Do đó xem lịch sử, xem chi tiết phiếu cũ và in lại vẫn giữ nguyên, không bắt quét QR.
- Chưa chạy `npm.cmd run build` hoặc kiểm thử camera/QR thực tế.
- Commit ghi kế hoạch trước khi sửa: `987970fd15aacb21e435f3284e0139a8de1e4245`.
- Commit khóa chế độ QR: `bd584d57270b9c40a0dc6a7e5a9e3c72555dfe89`.
- Bước tiếp theo: Pull origin trên GitHub Desktop và chạy `npm.cmd run build`; khi kiểm thử giao diện, xác nhận mở thiết bị từ menu Checklist không thao tác được, quét QR thì thao tác được, lịch sử/phiếu cũ vẫn xem và in bình thường.


### Kế hoạch hoàn thiện Bảo trì – Checklist theo chu kỳ định kỳ (16/11/2026) – GHI NHẬN TRƯỚC KHI SỬA
- Làm rõ nghiệp vụ theo người dùng: Admin thiết lập chu kỳ Checklist cho từng thiết bị trong lý lịch thiết bị; chỉ có 5 chu kỳ ngày/tuần/tháng/quý/năm. Bảo trì là công việc có kế hoạch. Sửa chữa phát sinh tức thời. Bảo dưỡng – Sửa chữa chỉ xử lý ở giai đoạn sau; chưa triển khai chuyển phiếu tự động trong đợt này.
- Màn hình Bảo trì – Checklist phải là bảng theo dõi lịch Checklist, không phải danh mục thiết bị. Có tab Ngày/Tuần/Tháng/Quý/Năm; hiển thị các kỳ đến hạn, kỳ đã làm (xanh), kỳ chưa làm/quá hạn (đỏ), ngày đến hạn cụ thể và nút Checklist bù.
- Mỗi lần Checklist lưu vẫn là phiếu riêng theo template/version hiện hữu. Bổ sung metadata tùy chọn `scheduledFor` (ngày của kỳ phải làm) và `isMakeup` để liên kết phiếu với kỳ định kỳ và nhận biết Checklist bù; không ghi đè phiếu cũ. Phiếu bù hoàn thành sẽ làm kỳ đó chuyển xanh, đồng thời lịch sử hồ sơ thiết bị vẫn ghi nhận rõ Checklist bù.
- Dùng trường `Asset.cycle` hiện có, đổi nhãn thành “Chu kỳ Bảo trì – Checklist” và giới hạn lựa chọn ngày/tuần/tháng/quý/năm; không thêm trường chu kỳ trùng lặp. Bổ sung `cycleStartedAt` tùy chọn để ghi nhận ngày bắt đầu khi Admin đổi chu kỳ; đây là trường dữ liệu bổ sung không cần tạo index hoặc nâng phiên bản Dexie.
- Dự kiến ngày bắt đầu lịch là ngày tạo biểu mẫu Checklist riêng của thiết bị (template.createdAt); từ mốc này sinh các kỳ định kỳ. Kết quả cũ chưa có `scheduledFor` được đối chiếu theo ngày thực hiện nằm trong kỳ tương ứng để giữ tính tương thích. Kỳ đã lưu `scheduledFor` được ưu tiên khớp chính xác.
- Quyền thao tác vẫn bắt buộc quét QR: bấm Checklist bù sẽ mở luồng quét QR; chỉ quét đúng mã thiết bị mới mở phiếu Checklist cho đúng kỳ. Không bật lại `CHECKLIST_TEST_MODE`.
- Không thay đổi nghiệp vụ Bảo dưỡng – Sửa chữa, không tự động tạo phiếu sửa chữa khi có mục Không đạt trong đợt này.
- Rủi ro/cần kiểm thử: sinh ngày tháng qua tháng ngắn/năm nhuận; không tạo kỳ tương lai; phân biệt ngày đến hạn và quá hạn; một phiếu không hoàn thành kỳ khác; lưu phiếu bù giữ nguyên lịch sử; QR phải đúng thiết bị; lịch sử/phiếu cũ và bản in vẫn hoạt động. Chưa triển khai cho đến khi hoàn tất sửa và kiểm tra tĩnh/build.


### Đã triển khai bảng lịch Bảo trì – Checklist theo chu kỳ (16/11/2026)
- `src/App.tsx`: thay danh sách thiết bị bằng bảng lịch Checklist định kỳ; có 5 tab Ngày/Tuần/Tháng/Quý/Năm, tổng số kỳ, số đã hoàn thành/chưa hoàn thành, ngày đến hạn, trạng thái xanh/đỏ và nút thao tác tương ứng.
- Dùng `Asset.cycle` làm chu kỳ Checklist; đổi nhãn trong form và lý lịch thành “Chu kỳ Bảo trì – Checklist”. Khi Admin đổi chu kỳ, ghi `cycleStartedAt` để bắt đầu lịch mới từ ngày thay đổi; giữ nguyên giá trị chu kỳ cũ chưa hỗ trợ để người dùng có thể nhận biết và cập nhật, không làm mất dữ liệu.
- Lịch bắt đầu từ mốc muộn hơn giữa ngày tạo biểu mẫu và ngày bắt đầu chu kỳ; tự sinh ngày lặp ngày/tuần/tháng/quý/năm, có xử lý ngày cuối tháng và năm nhuận. Không sinh kỳ sau ngày hiện tại.
- `src/db.ts`: bổ sung metadata tùy chọn `scheduledFor`, `isMakeup` cho phiếu Checklist và `cycleStartedAt` cho hồ sơ thiết bị. Không đổi các store/index của IndexedDB, không xóa hoặc ghi đè dữ liệu cũ.
- Checklist bù: từ một kỳ chưa hoàn thành, mở camera quét QR; camera chỉ chấp nhận đúng mã thiết bị của kỳ đó. Phiếu lưu ngày kỳ gốc và cờ Checklist bù; sau khi lưu, kỳ tương ứng chuyển xanh. Lịch sử Checklist và bản in A4 ghi rõ kỳ gốc/Checklist bù.
- Kỳ đã hoàn thành có thể mở hồ sơ/lịch sử mà không cần QR; tạo mới/thực hiện Checklist vẫn bắt buộc QR. `CHECKLIST_TEST_MODE` tiếp tục là `false`.
- Không triển khai tự động chuyển mục Không đạt sang phiếu Bảo dưỡng – Sửa chữa; giữ nguyên phần đó cho giai đoạn sau.
- CSS bổ sung cho tab chu kỳ, bảng, trạng thái xanh/đỏ và bố cục mobile trong `src/style.css`.
- Kiểm tra tĩnh sau sửa: xác nhận cờ QR vẫn tắt chế độ test; 5 chu kỳ hiện diện; lịch lấy chu kỳ từ hồ sơ; lưu ngày kỳ và cờ Checklist bù; kiểm tra QR đúng thiết bị; lịch sử xem không cần QR; dữ liệu phiếu cũ giữ tương thích. Các kiểm tra tĩnh đều đạt.
- Chưa chạy `npm.cmd run build`, chưa kiểm thử giao diện trình duyệt/camera thực tế. Chưa được coi là nghiệm thu.
- Commit kế hoạch trước khi sửa: `349d823101e2172ad523305dc48cfea8ea903911`.
- Commit bổ sung metadata phiếu Checklist: `863cf370d56c6f9224d0c869203fd0cfcd59a9e5`.
- Commit mô hình lịch định kỳ: `300a7a449d9a78fb53ef3db67459a09d8f48039a`.
- Commit giao diện lịch và luồng quét QR Checklist bù: `52ce236c80f47bd4fefcef5fd516d5777a38a786`.
- Commit mốc bắt đầu chu kỳ: `a1171f91869875f71732d5d024d13dbd88397faa` và `780226db60cef4630fbb3d6515061182c04a4eef`.
- Commit CSS: `56f7a22e02a85c30a772c48b73e275939d790de5`.
- Bước tiếp theo: Pull origin, chạy build và thử từng tab chu kỳ; kiểm tra một kỳ quá hạn, quét QR đúng/sai, lưu Checklist bù, xác nhận kỳ chuyển xanh và lịch sử ghi lại Checklist bù.

- Bổ sung thứ tự ưu tiên: kỳ chưa hoàn thành được xếp theo ngày đến hạn cũ nhất trước; kỳ hoàn thành xếp mới nhất trước. Commit: `57caf2bbd8ed748c524b06a26d329c75625d19d3`.


### Sửa lỗi cú pháp Vite trong lịch Bảo trì – Checklist (16/11/2026)
- Người dùng báo lỗi Vite/React Babel tại `src/App.tsx:53:115`: `Expecting Unicode escape sequence \\uXXXX`.
- Nguyên nhân: ba câu lệnh khai báo `templateDate`, `cycleDate`, `anchor` bị ghi nhầm ký tự literal `\\n` vào cùng một dòng thay vì xuống dòng thực, khiến parser đọc sai cú pháp.
- Đã sửa trực tiếp trên `main`: thay hai chuỗi literal `\\n` bằng xuống dòng thật; giữ nguyên logic tính mốc lịch Checklist.
- Commit sửa: `d8ccf9e36c71042e9241cf33c1ab3487bff7ccd2`.
- Chưa chạy `npm.cmd run build` trong môi trường local của người dùng; cần Pull origin và chạy build để xác nhận toàn bộ dự án. Nếu còn lỗi Vite khác, gửi log mới để xử lý tiếp.


### Kế hoạch tạo biểu mẫu Checklist mặc định cho toàn bộ thiết bị hiện có (16/11/2026) – GHI NHẬN TRƯỚC KHI SỬA
- Yêu cầu: coi như Admin đã khởi tạo biểu mẫu Checklist cho tất cả hồ sơ thiết bị đang quản lý.
- Phạm vi: khi ứng dụng khởi tạo dữ liệu, rà soát toàn bộ thiết bị hiện có (không lưu kho/đã lưu trữ); thiết bị chưa có biểu mẫu thì tạo riêng một biểu mẫu và version 1 từ `buildDefaultChecklist(asset)`. Thiết bị đã có biểu mẫu không bị sửa, ghi đè hoặc tạo version mới.
- Biểu mẫu được tạo dựa trên nhóm và tên thiết bị theo logic hiện có; giữ nguyên chu kỳ đã thiết lập trong lý lịch. Không tạo phiếu kết quả, không đánh dấu công việc đã hoàn thành, không giả lập người thực hiện.
- Không thay schema IndexedDB, không xóa lịch sử Checklist/phiếu cũ, không đổi quy tắc bắt buộc quét QR khi thực hiện.
- Phạm vi dữ liệu: tác vụ chạy trên dữ liệu IndexedDB có sẵn trong trình duyệt/máy người dùng sau khi cập nhật ứng dụng; chưa phải dữ liệu cloud/Supabase và không tự động cập nhật các trình duyệt/máy khác.
- Kiểm thử: kiểm tra routine chạy sau khi seed/đọc thiết bị; bảo đảm idempotent (tải lại không nhân đôi); bỏ qua thiết bị lưu kho; giữ nguyên template/version đã có; không tạo result. Chạy build nếu môi trường công cụ cho phép; nếu không phải ghi rõ người dùng cần chạy build local.


### Đã bổ sung tự khởi tạo Checklist riêng cho toàn bộ thiết bị hiện có (16/11/2026)
- Trong `src/App.tsx`, sau khi hoàn tất bước khởi tạo/đọc dữ liệu thiết bị, ứng dụng rà soát tất cả hồ sơ chưa lưu kho và gọi `ensureDefaultChecklist(asset)`.
- Mỗi thiết bị chưa có biểu mẫu sẽ được tạo một template riêng và version 1, sử dụng `buildDefaultChecklist(asset)` để ghép tiêu chí nền + nhóm thiết bị + quy tắc theo tên thiết bị.
- Hàm `ensureDefaultChecklist` kiểm tra theo `assetId`; nếu đã có template thì giữ nguyên, không ghi đè, không tạo bản trùng khi tải lại. Không thay đổi các template/version đã được Admin chỉnh sửa.
- Không tạo phiếu kết quả, không đánh dấu kỳ Checklist đã hoàn thành và không giả lập người thực hiện. Chu kỳ trong lý lịch không bị thay đổi. Thực hiện Checklist vẫn bắt buộc quét QR.
- Không thay schema IndexedDB, không xóa lịch sử. Áp dụng cho dữ liệu IndexedDB hiện có trên từng trình duyệt/máy khi chạy phiên bản mới; chưa có cloud/Supabase nên không tự đồng bộ sang thiết bị khác.
- Kiểm tra tĩnh: xác nhận routine được gọi sau bước seed, chỉ duyệt thiết bị chưa lưu kho, gọi hàm idempotent theo assetId; hàm tạo template chỉ thêm mới khi chưa có; không có lệnh tạo Checklist result trong routine. Chưa chạy build thực tế.
- Commit ghi kế hoạch: `ba59d320081ce61a9b0b1be7512974de6f5cac66`.
- Commit code: `1e22de985059ea9730b34edc6c90aa3abff18eb6`.
- Bước tiếp theo: Pull origin, chạy `npm.cmd run build`, mở ứng dụng và kiểm tra từng thiết bị trong Bảo trì – Checklist đã có biểu mẫu; xác nhận biểu mẫu cũ không bị thay đổi và chưa có kỳ nào bị đánh dấu hoàn thành giả.

### Kế hoạch đồng bộ mã loại thiết bị tự tạo vào tài liệu Quy ước (16/11/2026) – GHI NHẬN TRƯỚC KHI SỬA
- Người dùng xác nhận phương án an toàn: ứng dụng tiếp tục lưu danh mục nhóm/loại thiết bị tự tạo trong localStorage; bổ sung chức năng xuất lại tài liệu `QUY_UOC_MA_DINH_DANH_VA_VIET_TAT_THIET_BI.txt` có ghép các mã ABC tự tạo. Người dùng tải file và thay tài liệu trong repository khi cần; ứng dụng không tự ghi GitHub.
- Phạm vi dự kiến: chỉ sửa `src/App.tsx`, tài liệu quy ước TXT và file tiến độ chính thức. Giữ nguyên danh mục chuẩn, cấu trúc mã thiết bị, mã đã cấp, localStorage key, IndexedDB và các nghiệp vụ khác.
- Dùng cơ chế import TXT dạng raw của Vite để file xuất luôn dựa trên tài liệu chuẩn đang nằm trong repository; chèn danh mục bổ sung vào đúng mục riêng ở Phần V. Không hard-code bản sao toàn bộ tài liệu trong mã nguồn.
- Trong form Thêm thiết bị, thêm nút xuất tài liệu Quy ước; khi bấm, lấy toàn bộ nhóm/loại bổ sung đang lưu trên trình duyệt, tạo file TXT cùng tên chuẩn và tải xuống. Nếu chưa có mã bổ sung, ghi rõ chưa có mục bổ sung. Mỗi mã chỉ xuất một lần; không thay đổi các mã chuẩn.
- Không dùng GitHub token/API từ frontend, không tạo nhánh/PR. Dữ liệu custom vẫn là localStorage theo từng trình duyệt cho đến khi triển khai Supabase; xuất file là thao tác thủ công, không tự đồng bộ giữa các máy.
- Rủi ro/kiểm thử: kiểm tra import TXT raw và TypeScript; nội dung xuất phải giữ nguyên các phần I–VII, chèn đúng nhóm custom, xử lý nhiều nhóm/nhiều loại và trường hợp rỗng; tải xuống đúng tên file; không làm thay đổi chức năng thêm nhóm/loại và cấp mã.
- Sau sửa sẽ kiểm tra tĩnh; môi trường GitHub không cung cấp checkout/build local trong thao tác này nên nếu không chạy được build sẽ ghi rõ cần người dùng chạy `npm.cmd run build`.

### Đã bổ sung chức năng xuất Quy ước mã có danh mục thiết bị tự tạo (16/11/2026)
- `src/App.tsx`: import nội dung tài liệu TXT chuẩn bằng cơ chế raw của Vite; bổ sung hàm xuất tài liệu dựa trên nội dung gốc trong repository, thay vị trí đánh dấu bằng danh sách nhóm bổ sung và các dòng mã ABC + tên loại thiết bị đang lưu trong localStorage.
- Trong form **Thêm thiết bị** → **Thêm nhóm / loại thiết bị**, bổ sung hướng dẫn và nút **Xuất file Quy ước mã**. Khi bấm, trình duyệt tải xuống file đúng tên `QUY_UOC_MA_DINH_DANH_VA_VIET_TAT_THIET_BI.txt`, có BOM UTF-8 để hiển thị tiếng Việt ổn định.
- `QUY_UOC_MA_DINH_DANH_VA_VIET_TAT_THIET_BI.txt`: bổ sung mục H trong Phần V làm vị trí dành cho các mã do doanh nghiệp tự tạo. Khi xuất từ ứng dụng, nội dung đánh dấu được thay bằng danh sách thực tế; tài liệu xuất ra không còn marker kỹ thuật.
- Danh mục tự tạo vẫn được lưu theo localStorage key hiện tại `baotri-custom-asset-categories`; không thay đổi cách tạo nhóm/loại, kiểm tra trùng tên/mã, cấp mã định danh, mã thiết bị đã cấp, IndexedDB hoặc nghiệp vụ khác. Không tự ghi vào GitHub; người dùng chủ động tải file và thay tài liệu trong repository. Dữ liệu vẫn riêng theo từng trình duyệt/máy cho đến khi có backend/Supabase.
- Kiểm tra tĩnh sau sửa: xác nhận import raw, marker xuất hiện đúng một lần trong tài liệu gốc và nằm trước Phần VI, xuất đủ nhóm + mã + tên loại, ghép xuống dòng đúng, BOM UTF-8, tên file tải xuống, nút giao diện và callback được nối; kiểm tra cơ chế lưu localStorage và kiểm tra trùng mã cũ vẫn còn. **Tất cả 11 kiểm tra tĩnh đạt.**
- **Chưa chạy `npm.cmd run build` và chưa thử tải file trên trình duyệt thực tế.** Cần Pull origin trên GitHub Desktop, chạy build; sau đó tạo một nhóm/loại thử nghiệm và bấm Xuất file Quy ước mã để kiểm tra nội dung tải xuống.
- Commit ghi kế hoạch: `20791c0b9b03a17e03699375ed687af4dd60e6cc`.
- Commit bổ sung mục H trong tài liệu TXT: `03b647aed24312b64f6aa78b9ee7f3cb028187c1`.
- Commit bổ sung chức năng xuất trong ứng dụng: `03a5ad2049584c994d70c3d758d665e62454afe9`.
- Commit sửa xuống dòng, BOM UTF-8 và thời điểm thu hồi URL tải: `9ccbb80ca1b2603b244aaeb94f0a571a0054eca8`.


### Kế hoạch triển khai Supabase Auth – đăng nhập tài khoản (16/11/2026) – GHI NHẬN TRƯỚC KHI SỬA CODE

**Kết quả rà soát mã nguồn trên `main`:**
- `package.json` hiện chưa có `@supabase/supabase-js`; chưa có cấu hình `.env.example` hoặc client Supabase.
- `src/App.tsx` hiện hiển thị tài khoản mẫu “Người dùng / Quản trị viên”; chưa có đăng nhập/đăng xuất thật.
- `src/db.ts` đang khởi tạo một IndexedDB chung tên `baotri-local-v1`; dữ liệu thiết bị, kho, Checklist, bảo dưỡng/sửa chữa và hàng đợi vẫn ở trình duyệt.
- Chưa có hồ sơ tài khoản, tổ chức, membership, role hoặc chính sách RLS. Chưa có Supabase project/URL/publishable key trong repository.
- Tài liệu Supabase React hiện hướng dẫn dùng `@supabase/supabase-js`, `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY`; publishable key được dùng ở client, không đưa service-role key vào frontend. Tham khảo: https://supabase.com/docs/guides/auth/quickstarts/react và https://supabase.com/docs/guides/auth/passwords.

**Mục tiêu đợt đầu:**
- Kết nối Supabase Auth cho React/Vite.
- Màn hình đăng nhập bằng email + mật khẩu; đăng xuất; khôi phục phiên đăng nhập khi tải lại trang.
- Đăng ký tài khoản và xác nhận email chỉ bật khi đã thống nhất quy trình tạo tổ chức/tài khoản Admin đầu tiên; tuyệt đối không tự cấp role Admin cho mọi người đăng ký.
- Hồ sơ người dùng lấy từ phiên Auth; không lưu mật khẩu trong bảng profile.
- Thay tài khoản mẫu trên thanh trên bằng thông tin tài khoản thật sau khi Auth hoạt động.
- Không tuyên bố dữ liệu thiết bị/vật tư/Checklist đã lên cloud trong đợt Auth.

**Phạm vi dự kiến khi có Supabase project và credentials:**
- Thêm `@supabase/supabase-js` vào dependencies và cập nhật lockfile bằng npm.
- Tạo client Supabase đọc biến môi trường `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY`; bổ sung `.env.example` chỉ chứa tên biến/giá trị giả, không commit `.env.local`.
- Tạo luồng Auth UI/context, trạng thái loading/error, sign-in/sign-out và khôi phục session.
- Rà soát điểm khởi tạo ứng dụng và thanh topbar; giữ nguyên các phân hệ nghiệp vụ hiện tại.
- Thiết kế bước kế tiếp cho `profiles`, `organizations`, `organization_members` và RLS; chưa bật quyền truy cập dữ liệu nghiệp vụ khi chưa có schema/policy được kiểm thử.

**Rủi ro và điều kiện an toàn:**
- IndexedDB hiện là database chung trên từng trình duyệt. Không được giả định đăng nhập Supabase tự động biến dữ liệu local thành dữ liệu riêng tư theo tài khoản. Trước khi cho nhiều tài khoản dùng chung một trình duyệt hoặc mở dữ liệu nghiệp vụ cho nhiều tổ chức, phải thiết kế cách ly/migrate dữ liệu local theo user/organization và kiểm thử.
- Không tự động chuyển dữ liệu cũ lên cloud; phải có backup, đối chiếu số lượng và kế hoạch rollback.
- Không dùng service-role/secret key trong frontend, GitHub hoặc file cấu hình công khai.
- Không cấp quyền Admin bằng metadata do client tự gửi; việc khởi tạo tổ chức/Admin đầu tiên phải được kiểm soát phía SQL/server.
- Giữ nguyên QR, version Checklist, lịch sử phiếu và các chức năng thiết bị/kho đang có.

**Cách kiểm thử dự kiến:**
- Chạy `npm.cmd install` và `npm.cmd run build` trên máy local sau khi cập nhật.
- Kiểm thử đăng nhập đúng/sai, đăng xuất, refresh trang, session hết hạn, xác nhận email/redirect và cấu hình thiếu biến môi trường.
- Kiểm tra không thể mở ứng dụng nghiệp vụ khi chưa đăng nhập (nếu đã bật chế độ bắt buộc Auth).
- Sau khi có schema/RLS: kiểm thử tài khoản A không đọc/ghi dữ liệu tổ chức của B và không thể giả mạo người thực hiện Checklist.

**Điều kiện cần từ người dùng trước khi kết nối thực tế:**
- Tạo một Supabase project trong Dashboard.
- Cung cấp Project URL và Publishable key (hoặc anon key legacy) để cấu hình môi trường local/hosting. Đây là khóa public dùng ở frontend; không gửi service-role key, secret key hay mật khẩu database.
- Chưa có project/credentials nên chưa thể xác thực kết nối, kiểm thử đăng nhập thật hoặc chạy migration trên Supabase.

**Trạng thái:** mới hoàn tất rà soát và ghi kế hoạch; chưa sửa code, chưa cài SDK, chưa tạo schema/migration, chưa có đăng nhập thật. Tiếp tục sửa trực tiếp trên `main`, không tạo branch/PR.

### Cập nhật kế hoạch kết nối Supabase và chuyển dữ liệu IndexedDB lên cloud (16/11/2026)

**Thông tin project đã được người dùng cung cấp trong cuộc trò chuyện:**
- Đã có Supabase Project URL và Publishable key. Chỉ dùng hai giá trị này làm cấu hình public cho frontend; tuyệt đối không ghi key thật vào repository/file tiến độ/commit.
- Không sử dụng hướng dẫn @supabase/ssr, page.tsx, cookies, middleware.ts do đó là mẫu Next.js, trong khi BAOTRI Mini là React + Vite.
- Cấu hình đúng cho Vite: VITE_SUPABASE_URL và VITE_SUPABASE_PUBLISHABLE_KEY, lưu trong .env.local ở máy triển khai; .env.local không được commit. .gitignore hiện đã loại .env.* và chỉ cho phép .env.example.

**Rà soát schema IndexedDB hiện tại (src/db.ts):**
- Database: baotri-local-v1.
- Các store: assets, inventory, tasks, logs, movements, syncQueue, checklistTemplates, checklistVersions, checklistResults.
- Ngoài ra danh mục nhóm/loại thiết bị tự tạo đang nằm trong localStorage key baotri-custom-asset-categories; các cài đặt giao diện khác cũng có localStorage riêng.
- Phải rà soát tiếp toàn bộ các hàm đọc/ghi và dữ liệu ảnh trước khi chốt schema cloud. Không bỏ qua dữ liệu liên kết từ logs tới task/checklist result, quan hệ template-version-result, và liên kết vật tư/thiết bị.

**Phương án chuyển dữ liệu bắt buộc:**
1. Tạo chức năng xuất backup đầy đủ từ trình duyệt hiện tại, gồm tất cả store IndexedDB và danh mục custom localStorage; dữ liệu backup có phiên bản định dạng và thời điểm xuất.
2. Tạo schema PostgreSQL/Supabase có organization_id và user/membership; khóa chính/ID cũ được giữ nguyên khi nhập. Thiết kế foreign key và RLS trước khi mở truy cập nghiệp vụ.
3. Tạo công cụ import có kiểm tra dữ liệu, thứ tự nhập theo quan hệ cha-con, giao dịch/nhóm thao tác có thể rollback, và chống nhập trùng khi chạy lại.
4. Đối chiếu số lượng và ID theo từng store, kiểm tra quan hệ tham chiếu, dữ liệu JSON/ảnh; báo cáo bản ghi lỗi trước khi xác nhận.
5. Chỉ sau khi kiểm thử thành công mới chuyển các thao tác đọc/ghi ứng dụng sang Supabase. Giữ IndexedDB và file backup làm bản dự phòng; không tự xóa dữ liệu local.
6. Không giả định localStorage danh mục custom có thể tự đồng bộ; phải đưa vào quy trình backup/import hoặc chuyển sang bảng cloud riêng.

**Các rủi ro cần xử lý trước khi bật dùng thực tế:**
- Dữ liệu hiện tại chưa gắn user/organization. Cần người dùng xác nhận dữ liệu local hiện tại thuộc tổ chức nào khi import; không tự gán cho mọi tài khoản.
- Cần thiết kế storage cho ảnh thiết bị/tệp đính kèm; không nhét tùy tiện data URL/base64 vào bảng nghiệp vụ nếu có thể lưu object Storage.
- Cần bảo đảm phiếu Checklist cũ giữ snapshot tên người thực hiện và nội dung phiên bản biểu mẫu; không sửa lịch sử khi hồ sơ tài khoản thay đổi.
- Không được bật đăng ký tự do với quyền Admin mặc định. Cần quy trình tạo organization và Admin đầu tiên có kiểm soát.
- Không được chuyển ngay sang cloud trước khi backup và đối chiếu đạt.

**Trạng thái cập nhật:** đã nhận Project URL + Publishable key; đã xác định đúng nền tảng React/Vite và các store local. Chưa cài SDK, chưa tạo schema SQL/RLS, chưa tạo file backup từ trình duyệt, chưa import dữ liệu và chưa có đăng nhập/đồng bộ cloud hoạt động. Tiếp tục thực hiện trực tiếp trên main, không tạo branch/PR.

### Kế hoạch triển khai Supabase Auth đợt 1 – đăng nhập an toàn (16/11/2026) – GHI NHẬN TRƯỚC KHI SỬA
- Đã xác nhận trên `main`: `package.json` có `@supabase/supabase-js ^2.119.0`; người dùng đã tạo `.env.local` tại máy local với hai biến Vite. Không ghi giá trị Project URL/Publishable Key vào repo hoặc file tiến độ.
- Phạm vi: tạo Supabase client đọc `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY`; tạo màn hình đăng nhập email/mật khẩu; khôi phục session; đăng xuất; hiển thị email tài khoản đang đăng nhập; xử lý thiếu cấu hình/lỗi Auth.
- Đợt này chưa mở đăng ký tự do, chưa tự cấp Admin, chưa tạo tổ chức/membership, chưa chuyển dữ liệu IndexedDB lên cloud. Tài khoản đăng nhập phải được tạo/quản lý trong Supabase Dashboard trong giai đoạn đầu.
- Không thay đổi các store IndexedDB, localStorage danh mục, nghiệp vụ thiết bị/kho/Checklist, QR, lịch sử hoặc dữ liệu hiện tại. Khi đăng xuất, chỉ khóa giao diện; không xóa dữ liệu local.
- Rủi ro cần thông báo: IndexedDB hiện vẫn là dữ liệu cục bộ của trình duyệt và chưa cách ly theo tài khoản/tổ chức. Không coi việc có Auth là đã có multi-tenant hoặc đã bảo vệ dữ liệu nghiệp vụ. Trước khi cho nhiều tài khoản dùng trên cùng trình duyệt hoặc triển khai thương mại phải hoàn tất schema PostgreSQL, tổ chức/membership, RLS và chuyển/partition dữ liệu.
- Kiểm thử: kiểm tra TypeScript/Vite build; kiểm tra cấu hình thiếu biến; đăng nhập sai/đúng; tải lại trang giữ session; đăng xuất trở về màn hình đăng nhập; kiểm tra không ghi credential vào repo. Nếu môi trường thao tác GitHub không chạy được build, yêu cầu người dùng chạy `npm.cmd run build` trên máy local và báo rõ chưa được xác minh build.
- Tiếp tục sửa trực tiếp nhánh `main`, không tạo branch/PR. Chỉ sửa các file cần thiết cho Auth và cập nhật file tiến độ chính thức này sau khi hoàn tất.


### Đã tích hợp giao diện đăng nhập Supabase Auth đợt 1 (16/11/2026)
- `src/lib/supabase.ts`: tạo Supabase client bằng `createClient`, đọc đúng hai biến môi trường Vite `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY`; bật persist session, auto refresh token và detect session từ URL. Nếu thiếu biến, client là null để giao diện báo cấu hình thay vì làm ứng dụng crash.
- `src/AuthScreen.tsx`: tạo màn hình đăng nhập email/mật khẩu, trạng thái đang xác thực, thông báo lỗi sai thông tin/email chưa xác nhận/lỗi mạng. Chưa có nút đăng ký công khai; tài khoản đợt đầu được tạo/quản lý từ Supabase Dashboard, không tự cấp Admin.
- `src/App.tsx`: giữ nguyên toàn bộ workspace hiện tại trong `AppWorkspace`; thêm lớp Auth bên ngoài để khôi phục session bằng `getSession`, lắng nghe `onAuthStateChange`, chỉ render workspace sau đăng nhập và gọi `signOut` khi người dùng bấm tài khoản. Thay nhãn tài khoản giả “Người dùng / Quản trị viên” bằng email đăng nhập; đổi nhãn không gian thành “Dữ liệu trên thiết bị / Chưa đồng bộ lên cloud”.
- `src/style.css`: bổ sung giao diện đăng nhập responsive; không sửa các style nghiệp vụ hiện có ngoài phần thêm mới.
- `.env.example`: thêm hai tên biến và giá trị minh họa giả; không chứa Project URL/Publishable Key thật. `.gitignore` đã có `.env.*` và ngoại lệ `!.env.example`, vì vậy `.env.local` không được commit.
- Không sửa `src/db.ts`, không đổi IndexedDB `baotri-local-v1`, không xóa/chuyển dữ liệu, không thay Checklist/QR/kho/thiết bị. Khi đăng xuất, dữ liệu local vẫn còn trên trình duyệt.
- Cảnh báo vận hành: Auth hiện chỉ xác thực danh tính. Dữ liệu nghiệp vụ vẫn lưu local và chưa được cách ly theo user/organization; không dùng nhiều tài khoản trên cùng trình duyệt để xử lý dữ liệu riêng biệt, không tuyên bố đã có multi-tenant/RLS/cloud sync.
- Kiểm tra tĩnh qua nội dung GitHub: 12/12 kiểm tra đạt gồm import client/session, workspace cũ còn, Auth wrapper, restore session, unsubscribe listener, signOut, bỏ nhãn Admin giả, cảnh báo local data, không có signup tự do, đúng biến Vite, env example chỉ placeholder, .env.local được ignore. Sau đó bổ sung xử lý ngoại lệ mạng trong form đăng nhập.
- **Chưa chạy `npm.cmd run build` hoặc kiểm thử đăng nhập thực tế trên Supabase.** Cần người dùng Pull `main`, kiểm tra `.env.local` ở thư mục gốc, khởi động lại Vite (nếu đang chạy), chạy build và tạo tài khoản Auth trong Dashboard trước khi đăng nhập.
- Commits: ghi kế hoạch `1dca87c15d423c5d47ca194b0145bb38c4a59f62`; tích hợp App `216e5eaa5aaf70744fd303e8a09ce5d4da979758`; Supabase client `36484837057b10674bc467ddef9df71b655d9352`; màn hình Auth `97fb5f536eb3f1599986c4af1663eab0eeee3540`; style `3e27bc51cc739152cb2d66e5613d7e58918c632c`; `.env.example` `27a5ad0c0e13c6a82c72a55f665e2453ba933c69`; xử lý lỗi mạng `46ba8c3329938ca9598e3722c7616153f7542877`.
- SHA hiện tại: `src/App.tsx` `90da22923ee7762446de32922f044e74bfdd0730`; `src/AuthScreen.tsx` `a7fc0520d14caeef36da7fa354c1779be313de2a`; `src/lib/supabase.ts` `a967c625b9e9a0e123d307dd0bf5239628716a0c`; `src/style.css` `1a74f9683e211f091dbf1a423cf2a574d940a6c8`; `.env.example` `4ef03358816266d65abe2c56bef75e57c5771a4a`.
- Bước tiếp theo: người dùng Pull origin trên GitHub Desktop; chạy `npm.cmd run build`; trong Supabase Dashboard tạo user tại Authentication → Users → Add user, xác nhận email/đặt mật khẩu theo tùy chọn Dashboard; chạy app và thử đăng nhập, refresh, đăng xuất. Sau khi Auth hoạt động, lên kế hoạch schema profiles/organizations/memberships/RLS và partition dữ liệu local trước khi mở nhiều tài khoản.


## 16/11/2026 – Sửa lỗi TypeScript khi build Supabase Auth
- Phát hiện lỗi TS18047 tại callback `onSignOut`: TypeScript không giữ narrowing của biến import `supabase` bên trong callback.
- Sửa trong `src/App.tsx`: sau khi kiểm tra `if (!supabase) return ...`, gán client đã được thu hẹp kiểu vào hằng `authenticatedClient`; dùng hằng này cho AuthScreen và callback đăng xuất.
- Không thay đổi luồng xác thực, dữ liệu nghiệp vụ hoặc schema.
- Commit code trên `main`: `e2150400dd9ae92394f09ab8413d6243d4bbc040`.
- Chưa chạy build sau sửa; cần Pull origin trên GitHub Desktop rồi chạy lại `npm.cmd run build` tại máy local.


## 16/11/2026 – Khắc phục lỗi cú pháp sau khi ghép nội dung App.tsx
- Build local báo TS1005 tại dòng 400 do hai điều kiện sắp xếp thiết bị bị dính trên cùng một dòng.
- Đã tách lại thành hai dòng độc lập trong `src/App.tsx`; không thay đổi logic sắp xếp.
- Rà soát toàn bộ file sau sửa: 1.527 dòng; không còn phát hiện mẫu câu lệnh bị dính tương tự tại các điểm nối.
- Commit code trên `main`: `e4373848e39a762050b7241c59720228f19e669b`.
- Chưa chạy build local; cần Pull origin và chạy lại `npm.cmd run build`.


## 16/11/2026 – Xác nhận build local thành công sau tích hợp Supabase Auth
- Người dùng chạy `npm.cmd run build` tại `E:\DuAnBaoTri\DuAn_BaoTRi`.
- TypeScript `tsc -b`: hoàn tất, không còn lỗi.
- Vite 6.4.6: build thành công; 1.660 modules transformed.
- PWA 0.21.2: generateSW thành công, precache 10 entries; tạo `dist/sw.js` và `dist/workbox-ee9d8b34.js`.
- Xác nhận: mã nguồn hiện tại build production thành công trên máy local.
- Chưa xác nhận đăng nhập thực tế với Supabase, đăng xuất, hoặc kiểm thử các chức năng nghiệp vụ sau đăng nhập.
- Bước tiếp theo: tạo tài khoản Auth đầu tiên trong Supabase Dashboard (nếu chưa tạo), chạy ứng dụng local và kiểm tra đăng nhập/đăng xuất; tiếp tục giữ dữ liệu nghiệp vụ local, chưa đồng bộ cloud.


## 16/11/2026 – Kiểm thử đăng nhập Supabase Auth lần đầu
- Người dùng chạy ứng dụng local bằng Vite; do cổng 5173 và 5174 đang được sử dụng, Vite tự chọn cổng 5175 (http://localhost:5175/). Đây là hành vi bình thường, không phải lỗi.
- Người dùng xác nhận đăng nhập thành công bằng tài khoản đã tạo trong Supabase Dashboard.
- Kết quả đã xác nhận: cấu hình môi trường local, kết nối Supabase Auth và luồng đăng nhập email/mật khẩu hoạt động ở mức cơ bản.
- Chưa xác nhận riêng các bước tải lại trang để khôi phục session, hiển thị email tài khoản, đăng xuất và đăng nhập lại; đang chờ người dùng kiểm tra các bước này.
- Chưa có schema nghiệp vụ, PostgreSQL tables/RLS hoặc đồng bộ cloud. Dữ liệu thiết bị, vật tư, Checklist và các nghiệp vụ vẫn ở IndexedDB/localStorage trên trình duyệt.

- Người dùng tiếp tục kiểm tra trên giao diện local: email tài khoản hiển thị đúng; đăng xuất đưa về màn hình đăng nhập và đăng nhập lại thành công. Xác nhận các thao tác này hoạt động trong lần kiểm thử đầu tiên.
- Chưa có kiểm thử riêng về session sau khi đóng/mở trình duyệt hoặc hết hạn token; chưa kiểm thử các chức năng nghiệp vụ với dữ liệu cloud vì chưa triển khai schema/RLS.


## 16/11/2026 – Chốt kiến trúc triển khai Supabase multi-tenant (quyết định mới nhất)

Người dùng xác nhận chọn **Phương án 2: triển khai nhiều tài khoản, nhiều tổ chức, vai trò Admin/User và cách ly dữ liệu doanh nghiệp ngay từ đầu**. Quyết định này thay thế định hướng giai đoạn đầu chỉ phục vụ một người dùng cá nhân trong các mục cũ; các ghi chú lịch sử trước đó được giữ để truy vết, nhưng khi triển khai tiếp phải ưu tiên quyết định mới này.

### Nguyên tắc kiến trúc
- Một Supabase project/database phục vụ nhiều tổ chức; dữ liệu nghiệp vụ của mỗi tổ chức phải được gắn `organization_id` và cách ly bằng PostgreSQL RLS ở backend/database.
- Có bảng hồ sơ người dùng liên kết `auth.users`, bảng `organizations`, bảng membership nối user–organization–role. Một tài khoản có thể là thành viên của một hoặc nhiều tổ chức.
- Vai trò ban đầu: Admin và User. Quyền cụ thể phải được định nghĩa theo từng nghiệp vụ; không chỉ dựa vào việc ẩn/hiện nút trên frontend.
- Admin quản lý thành viên và dữ liệu trong tổ chức mình theo quyền; User chỉ thực hiện các thao tác được policy/role cho phép.
- Không cho client tự gửi role hoặc organization_id để tự nâng quyền. Khởi tạo tổ chức và Admin đầu tiên phải có quy trình được kiểm soát an toàn; không tự cấp Admin cho mọi tài khoản đăng ký.
- Danh tính người thực hiện Checklist lấy từ Supabase Auth/session và được xác thực ở backend; lưu user ID cùng snapshot tên người thực hiện tại thời điểm ghi nhận. Không cho người dùng tự chọn/giả mạo người thực hiện.
- Các bảng nghiệp vụ, quan hệ khóa ngoại, unique constraint và policy RLS phải được thiết kế đồng bộ; kiểm thử chéo ít nhất hai tổ chức và các vai trò trước khi đưa dữ liệu thật lên cloud.

### Thứ tự triển khai bắt buộc
1. Rà soát đầy đủ schema IndexedDB/localStorage và các quan hệ dữ liệu hiện tại.
2. Thiết kế ERD/schema PostgreSQL, organization membership, role/permission, foreign key, index và RLS.
3. Viết migration SQL có thể quản lý phiên bản; rà soát chính sách SELECT/INSERT/UPDATE/DELETE và kiểm tra không thể truy cập chéo tổ chức.
4. Tạo chức năng backup đầy đủ dữ liệu local trước khi migrate, gồm tất cả IndexedDB stores, danh mục custom localStorage và dữ liệu tệp/ảnh liên quan nếu có.
5. Xây dựng import có kiểm tra, giữ nguyên ID/quan hệ/version lịch sử, chống nhập trùng và có phương án phục hồi.
6. Chuyển từng phân hệ sang Supabase theo thứ tự đã thống nhất; máy tính và điện thoại truy cập cùng nguồn dữ liệu cloud.
7. Đối chiếu số lượng, ID, quan hệ tham chiếu, file/ảnh; kiểm thử đa tài khoản/đa tổ chức, sau đó mới xác nhận sẵn sàng chạy thật.

### Giới hạn an toàn
- Chưa có bảng nghiệp vụ cloud, RLS, migration dữ liệu hay đồng bộ nào được triển khai chỉ bởi việc chọn phương án này.
- Hiện Supabase Auth đã đăng nhập được; dữ liệu thiết bị, kho, Checklist, bảo dưỡng/sửa chữa vẫn ở IndexedDB/localStorage trên từng trình duyệt.
- Không xóa hoặc ghi đè dữ liệu local; không chạy import lên dữ liệu thật trước khi có backup và đối chiếu.
- Không đưa service-role/secret key vào frontend, repository hoặc file tiến độ. Frontend chỉ dùng publishable key; RLS là bắt buộc.
- Không mở đăng ký tự do hoặc cấp quyền Admin mặc định.
- Tiếp tục làm trực tiếp trên nhánh `main`, không tạo branch/PR; bảo toàn chức năng hiện hữu.

### Bước công việc kế tiếp
Bắt đầu bằng rà soát chi tiết toàn bộ `src/db.ts`, các hàm đọc/ghi trong `src/App.tsx` và những nơi dùng localStorage để lập bản đồ dữ liệu/quan hệ. Sau đó đề xuất schema và ma trận quyền Admin/User để người dùng duyệt trước khi tạo migration SQL hoặc sửa code.


## 16/11/2026 – Rà soát dữ liệu local và luồng ghi hiện tại (đợt 1)

Đã đọc trực tiếp `src/db.ts` và rà soát các luồng đọc/ghi chính trong `src/App.tsx` trên `main`. Đây là kiểm kê hiện trạng, **chưa sửa mã nguồn, chưa tạo bảng Supabase, chưa chạy migration hoặc đồng bộ dữ liệu**.

### 1. Cấu trúc IndexedDB

Database: `baotri-local-v1`, dùng Dexie; schema hiện tại có 4 phiên bản nâng cấp (v1–v4), gồm 9 object stores:

| Store | Nội dung / khóa liên kết đang có |
|---|---|
| `assets` | Hồ sơ thiết bị; ID, mã, tên, nhóm, vị trí, trạng thái, chu kỳ, ảnh dạng mảng chuỗi |
| `inventory` | Vật tư; mã, nhóm, đơn vị, số lượng, tồn tối thiểu, đơn giá |
| `tasks` | Kế hoạch/công việc; có `assetId` liên kết thiết bị |
| `logs` | Lịch sử bảo dưỡng/sửa chữa; có `assetId`, tùy chọn `taskId`, `checklistResultId` |
| `movements` | Lịch sử nhập/xuất/điều chỉnh; có `itemId`, tùy chọn `linkedAssetId` |
| `syncQueue` | Hàng đợi thay đổi; `tableName`, `recordId`, `operation`, thời điểm xếp hàng |
| `checklistTemplates` | Biểu mẫu Checklist; có `assetId`, `currentVersion` |
| `checklistVersions` | Phiên bản biểu mẫu; có `templateId`, `assetId`, số phiên bản và mảng `items` |
| `checklistResults` | Phiếu thực hiện; có `assetId`, `templateId`, `templateVersionId`, snapshot tên/phiên bản biểu mẫu và mảng kết quả `items` |

Các liên kết trên hiện là trường ID trong object và chỉ mục Dexie; `src/db.ts` chưa khai báo ràng buộc foreign key kiểu cơ sở dữ liệu quan hệ. Khi thiết kế PostgreSQL cần tạo FK/ON DELETE phù hợp và quyết định cách giữ lịch sử khi lưu kho/ẩn thiết bị, vật tư hoặc biểu mẫu.

### 2. localStorage và dữ liệu ngoài IndexedDB

Đã xác định các khóa được dùng trong `App.tsx`:
- `baotri-custom-asset-categories`: danh mục nhóm/loại thiết bị do người dùng tự tạo; có hỗ trợ chuyển đổi định dạng cũ.
- `baotri-theme`: giao diện sáng/tối.
- `baotri-compact`: tùy chọn giao diện gọn.

Danh mục custom là dữ liệu nghiệp vụ/cấu hình cần được backup và chuyển sang cloud hoặc cấu hình theo tổ chức. Theme/compact là tùy chọn giao diện, không nhất thiết đưa vào bảng nghiệp vụ cloud.

### 3. Ảnh và dữ liệu lồng

- Ảnh thiết bị được đọc bằng FileReader thành data URL/Base64 và lưu trực tiếp trong `Asset.images`; giới hạn giao diện hiện tại là tối đa 8 ảnh/hồ sơ.
- Checklist version lưu danh sách hạng mục trong `items`; phiếu kết quả lưu snapshot hạng mục, câu trả lời và ghi chú trong `items`.
- Vì vậy cần tách quyết định: dữ liệu checklist có thể lưu dạng JSONB hoặc chuẩn hóa thành bảng con; ảnh cần chuyển sang Supabase Storage và lưu đường dẫn/object key trong hồ sơ, không nên giữ Base64 lớn trong hàng PostgreSQL.

### 4. Các luồng ghi và điểm cần xử lý trước đồng bộ

- Thiết bị, vật tư, task, log, checklist template và checklist result đang ghi vào Dexie. `queueChange` có được gọi ở một số luồng, nhưng chưa có worker/luồng đẩy hàng đợi lên Supabase; `syncQueue` hiện không đồng nghĩa đã có đồng bộ.
- Ghi hoàn thành task tạo đồng thời task và log trong một transaction, nhưng sau transaction chỉ xếp hàng `tasks`, chưa xếp hàng `logs`.
- Nhập/xuất kho cập nhật inventory và tạo movement trong một transaction, nhưng chỉ xếp hàng `inventory`, chưa xếp hàng `movements`.
- Backup JSON hiện xuất 8 store nghiệp vụ, **không xuất `syncQueue`**, không chứa `baotri-custom-asset-categories`; do đó chưa phải bản backup đầy đủ theo yêu cầu multi-tenant. Chức năng restore hiện bulkPut dữ liệu vào local, không phải công cụ import cloud.
- Khi khởi động workspace, hàm seed có thể bổ sung/cập nhật dữ liệu demo và tạo Checklist mặc định cho thiết bị chưa có mẫu. Cần rà soát và tách rõ dữ liệu demo khỏi dữ liệu tổ chức trước khi chuyển sang cloud để tránh tự tạo dữ liệu mẫu trong tổ chức thật.
- Component Checklist hiện cho phép nhập tay `performedBy` và lưu vào phiếu. Khi triển khai multi-user, cần lấy `auth.uid()` từ phiên đăng nhập ở backend, lưu user ID và snapshot tên được xác thực; không tin trường người thực hiện từ client.
- Workspace hiện chỉ nhận `userEmail` và callback đăng xuất; chưa truyền user ID/membership/organization context xuống các phân hệ. Đây là phần cần thiết kế cùng cơ chế chọn tổ chức và kiểm tra quyền.

### 5. Quan hệ nghiệp vụ cần giữ khi thiết kế ERD

1. Organization → assets, inventory, tasks, logs, movements, checklist templates/versions/results.
2. Asset → tasks, logs, checklist templates, checklist versions, checklist results.
3. Task → logs (liên kết tùy chọn).
4. Inventory item → movements.
5. Checklist template → nhiều versions; mỗi version thuộc đúng asset/template.
6. Checklist result → đúng asset, template và version đã thực hiện; log sửa chữa có thể tham chiếu phiếu Checklist nguồn.
7. Người thực hiện → Auth user; đồng thời giữ snapshot tên tại thời điểm lập phiếu để lịch sử không đổi khi hồ sơ tài khoản thay đổi.

### 6. Kết luận và bước tiếp theo

- Hiện trạng đủ để bắt đầu phác thảo ERD và ma trận quyền, nhưng chưa đủ căn cứ để viết migration cuối cùng: cần kiểm tra thêm toàn bộ luồng xóa/khôi phục, cách dùng các trường liên kết, các file ngoài App/db và chính sách xóa dữ liệu.
- Bước kế tiếp: hoàn tất kiểm tra các thao tác xóa và quan hệ tham chiếu; sau đó trình người dùng bản ERD/schema đề xuất và ma trận quyền Admin/User để duyệt. Chưa tạo migration hoặc sửa ứng dụng trước khi được duyệt.


## 16/11/2026 – Rà soát xóa/khôi phục và dữ liệu khởi tạo (đợt 2)

Tiếp tục kiểm tra `src/db.ts` và toàn bộ `src/App.tsx` trên `main`. Không phát hiện lệnh xóa cứng record qua các API Dexie trong workspace hiện tại.

### Kết quả rà soát xóa và lưu trữ
- Thiết bị có cơ chế lưu kho mềm bằng trường `archivedAt`; thao tác khôi phục xóa giá trị trường này. Hồ sơ và lịch sử liên quan được giữ lại.
- Trạng thái `Thanh lý` là trạng thái nghiệp vụ, không phải xóa record.
- Chưa thấy giao diện/xử lý xóa cứng cho vật tư, task, log, movement hoặc Checklist template/version/result.
- Vì vậy schema cloud nên mặc định bảo toàn lịch sử; không thiết kế cascade delete làm mất log/phiếu Checklist. Cần chốt quy tắc archive/soft-delete riêng cho từng nhóm dữ liệu nếu sau này bổ sung chức năng xóa.
- `syncQueue` chưa có xử lý xóa record; khi triển khai đồng bộ cần có tombstone/operation delete nếu sau này có xóa mềm hoặc xóa theo chính sách.

### Phát hiện quan trọng về dữ liệu demo
Hàm `seed()` trong `App.tsx` chạy khi workspace mount và hiện có thể:
- Bổ sung/chuẩn hóa 30 thiết bị demo.
- Bổ sung 40 vật tư demo.
- Tạo hai task mẫu nếu bảng task đang rỗng.
- Tạo Checklist mặc định cho mọi thiết bị đang quản lý chưa có biểu mẫu.

Đây là hành vi hữu ích cho bản thử nghiệm local nhưng **không được để chạy tự động trong tổ chức cloud thật**. Trước khi mở dữ liệu multi-tenant cần tách rõ chế độ demo/seed, chỉ chạy có chủ đích trong môi trường demo hoặc dữ liệu mẫu được đánh dấu; không để seed tự ghi vào tổ chức người dùng thật.

### Kết luận rà soát hiện tại
- Đã kiểm kê 9 stores IndexedDB, các khóa localStorage, ảnh Base64, dữ liệu lồng Checklist, luồng ghi, quan hệ ID và cơ chế archive.
- Đã xác định những thiếu sót cần xử lý trước migration: backup thiếu custom categories; các transaction tạo log/movement chưa queue đủ; seed demo chạy tự động; người thực hiện Checklist nhập tay; ảnh cần chuyển Storage; chưa có user/org context trong workspace.
- Chưa có hard-delete workflow hiện hữu cần ánh xạ; giữ nguyên nguyên tắc không cascade xóa lịch sử.
- Chưa sửa mã nguồn, chưa tạo bảng/migration, chưa thay đổi dữ liệu local.

### Hướng thiết kế sơ bộ để trình duyệt
ERD sẽ được xây quanh các nhóm:
1. `profiles`, `organizations`, `organization_members` (Auth user – tổ chức – vai trò).
2. `assets`, `asset_images`, `asset_categories` (thiết bị và ảnh/danh mục theo tổ chức).
3. `inventory_items`, `inventory_movements`.
4. `maintenance_tasks`, `maintenance_logs`.
5. `checklist_templates`, `checklist_template_versions`, `checklist_results` (giữ snapshot/version).
6. Supabase Storage bucket riêng tư cho ảnh; metadata/object path gắn organization và asset.
7. RLS theo membership của tổ chức trên mọi bảng nghiệp vụ; không tin organization_id/role do client tự khai báo.

Đây mới là khung đề xuất, chưa phải schema đã chốt. Trước migration sẽ cần duyệt chính sách xóa/archive, phạm vi quyền Admin/User và cách tạo tổ chức/Admin đầu tiên.
