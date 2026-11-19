# BAOTRI – Tiến độ và các quyết định đã chốt

Cập nhật: 19/11/2026 (audit bổ sung phân loại thao tác ghi và tiện ích)

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
### Làm rõ ba lớp định danh thiết bị – cập nhật 17/11/2026

Quyết định làm rõ từ buổi thảo luận ngày 17/11/2026; nội dung này bổ sung và ưu tiên áp dụng khi có điểm chưa thống nhất với mô tả mã định danh cũ:

1. **ID nội bộ hệ thống (primary key):** mỗi thiết bị có một UUID duy nhất, do hệ thống tự sinh; bất biến suốt vòng đời, không hiển thị như mã quản lý và không yêu cầu nhân viên nhập. ID này dùng làm khóa chính và liên kết các bảng nghiệp vụ/lịch sử.
2. **Mã quản lý/mã định danh hiển thị:** là mã theo quy ước riêng của doanh nghiệp, dùng để nhận biết và tra cứu thiết bị trong công việc. Mã có thể theo cấu trúc đã quy định trong tài liệu `QUY_UOC_MA_DINH_DANH_VA_VIET_TAT_THIET_BI.txt` hoặc theo quy ước được Admin chọn khi khởi tạo doanh nghiệp. Không dùng mã hiển thị làm khóa chính database.
3. **QR Code:** là phương tiện mở đúng hồ sơ thiết bị; có thể cấp lại mà không tạo thiết bị mới hoặc thay đổi ID nội bộ. Nội dung QR phải được thiết kế để tra cứu hồ sơ an toàn, không coi QR là bằng chứng xác thực hay quyền truy cập. Người không có quyền vẫn phải đăng nhập/được phân quyền trước khi xem dữ liệu được bảo vệ.

Quy tắc mã quản lý:
- Doanh nghiệp chọn một quy ước mã khi khởi tạo; phần mềm hỗ trợ lựa chọn từ đơn giản đến chi tiết. Ví dụ: `TB-001`, `MAY-001`, hoặc cấu trúc theo cơ sở/nhóm như tài liệu quy chuẩn hiện có.
- Hệ thống tự cấp mã theo quy ước đã chọn; số thứ tự phải được cấp an toàn, không trùng khi có nhiều người cùng tạo thiết bị. Không dựa vào phép đọc số lớn nhất rồi cộng 1 ở frontend.
- Mã quản lý phải duy nhất trong phạm vi doanh nghiệp theo chính sách đã chọn. Nếu mã có thành phần cơ sở/nhóm, cần quy định rõ cách xử lý khi chuyển cơ sở hoặc đổi nhóm; không tự ý đổi mã lịch sử.
- Mã cũ được giữ trong lịch sử/alias khi chuyển đổi; mọi đổi mã phải có kiểm tra trùng, lưu dấu vết ai đổi/khi nào/vì sao và bảo toàn toàn bộ liên kết bằng ID nội bộ.
- Cấu trúc mã cũ `ABC-ABXY-xxx-BB-MM-YY` và hậu tố `*` cho thiết bị chuyển cơ sở là quy ước mã hiển thị, không phải ID nội bộ. Cần đối chiếu tài liệu quy chuẩn hiện hành trước khi thay đổi cách cấp mã.
- Chưa triển khai thay đổi schema hoặc code cho phần làm rõ này.

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
- Đổi tiêu đề hiển thị trong tệp thành “Danh sách các thiết bị”.- Thay tệp HTML giả dạng `.xls` bằng workbook `.xlsx` chuẩn Open XML được tạo bằng thư viện SheetJS đang có trong dự án.- Bố cục bảng: tiêu đề gộp 10 cột, hàng tiêu đề cột, mỗi thiết bị một hàng; Hãng và Model hiển thị xuống dòng trong ô tên thiết bị; giữ nguyên dữ liệu theo bộ lọc hiện tại.- Thiết lập độ rộng cột, bộ lọc tự động, khổ A4 ngang, vừa một trang theo chiều rộng và không ép chiều cao; có dòng tổng số thiết bị.- Tên file: `danh-sach-cac-thiet-bi.xlsx`. Chưa chạy build và chưa mở thử bằng Excel trên máy người dùng; cần kiểm tra nội dung, định dạng và Print Preview.


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
- Nhóm do người dùng tạo được lưu trong localStorage của trình duyệt hiện tại, hiển thị ở nhóm “Nhóm tự tạo” và dùng được khi tạo thiết bị lần sau.- Kiểm tra trùng tên/mã với cả danh mục chuẩn và nhóm tự tạo; mã nhóm mới phải được dùng trong cơ chế cấp mã thiết bị hiện tại.
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
- Không sử dụng hướng dẫn @supabase/ssr, page.tsx, cookies, middleware.ts do đó là mẫu Next.js, trong khi BAOTRI Mini là React + Vite.- Cấu hình đúng cho Vite: VITE_SUPABASE_URL và VITE_SUPABASE_PUBLISHABLE_KEY, lưu trong .env.local ở máy triển khai; .env.local không được commit. .gitignore hiện đã loại .env.* và chỉ cho phép .env.example.

**Rà soát schema IndexedDB hiện tại (src/db.ts):**- Database: baotri-local-v1.
- Các store: assets, inventory, tasks, logs, movements, syncQueue, checklistTemplates, checklistVersions, checklistResults.
- Ngoài ra danh mục nhóm/loại thiết bị tự tạo đang nằm trong localStorage key baotri-custom-asset-categories; các cài đặt giao diện khác cũng có localStorage riêng.- Phải rà soát tiếp toàn bộ các hàm đọc/ghi và dữ liệu ảnh trước khi chốt schema cloud. Không bỏ qua dữ liệu liên kết từ logs tới task/checklist result, quan hệ template-version-result, và liên kết vật tư/thiết bị.

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

## 16/11/2026 – Migration 001 thực thi thành công trên Supabase project thử nghiệm
- Người dùng đã chạy file `supabase/migrations/20261116000100_identity_and_organizations.sql` trong SQL Editor của project thử nghiệm `BAOTRI-Mini-Test`, Project Reference `oyzhxgzltpdebpymuicb`.- Supabase trả kết quả **Success. No rows returned**. Đây là kết quả bình thường đối với migration DDL; xác nhận lệnh SQL chạy hoàn tất không báo lỗi.
- Migration tạo các bảng nền `profiles`, `organizations`, `organization_members`, trigger, helper functions, index, RLS policies và quyền truy cập tối thiểu theo nội dung migration.
- Chưa xác minh độc lập từng bảng/policy/function bằng truy vấn kiểm tra; chưa tạo tổ chức hoặc membership mẫu; chưa chạy bộ test RLS hai tổ chức/hai vai trò.
- Chưa chạy migration trên project chính `BAOTRI-Mini`; chưa tạo bảng nghiệp vụ, chưa import dữ liệu local và chưa bật đồng bộ cloud. Dữ liệu nghiệp vụ vẫn ở IndexedDB/localStorage trên từng trình duyệt.- Bước tiếp theo: kiểm tra ba bảng nền trong Table Editor, sau đó chuẩn bị tổ chức và membership thử nghiệm cho bốn Auth users; chạy bộ kiểm thử RLS sau khi thay placeholder bằng UUID thật. Không sao chép thao tác sang project chính.


## 16/11/2026 – Điều chỉnh lộ trình: đồng bộ cloud trước với một tài khoản
Người dùng xác nhận chọn phương án triển khai theo từng giai đoạn: **trước mắt chỉ sử dụng một tài khoản Auth của chính người dùng, nhưng vẫn xây dựng đồng bộ dữ liệu nghiệp vụ giữa máy tính và điện thoại qua Supabase**. Không cần chờ hoàn thiện multi-user/multi-tenant mới làm đồng bộ.

### Phạm vi giai đoạn hiện tại
- Giữ Supabase Auth đã tích hợp và đã kiểm thử đăng nhập/đăng xuất cơ bản; trước mắt chỉ dùng một tài khoản cá nhân được kiểm soát.
- Mục tiêu gần: một tài khoản đăng nhập trên nhiều thiết bị, cùng đọc/ghi một nguồn dữ liệu nghiệp vụ trên Supabase.
- Vẫn phải xây dựng schema PostgreSQL, API/RLS, Storage nếu cần và cơ chế chuyển dữ liệu từ IndexedDB/localStorage; một tài khoản không có nghĩa là chỉ dùng dữ liệu local.
- Không được tuyên bố đồng bộ hoạt động cho đến khi schema, luồng đọc/ghi, xử lý lỗi/mạng, đối chiếu dữ liệu và kiểm thử thực tế trên ít nhất máy tính + điện thoại hoàn tất.
- Không tự động import hoặc xóa dữ liệu local. Trước khi chuyển dữ liệu phải có backup đầy đủ, kế hoạch import có thể chạy an toàn và đối chiếu sau import.
- Tạm thời chưa cần tạo hai tổ chức và bốn membership thử nghiệm; không cần tiếp tục thao tác thủ công với các ID của bốn tài khoản test ở thời điểm này.
- Giữ nguyên project test, bốn Auth users và Migration 001 đã chạy; không cần rollback/xóa.
- Không chạy migration trên project chính chỉ vì đã chốt phương án một tài khoản. Project chính chỉ được thay đổi khi đã review migration và xác định rõ phạm vi.
- Tạm hoãn kiểm thử multi-tenant đầy đủ (hai tổ chức, Admin/User, RLS cross-tenant) đến giai đoạn mở rộng, nhưng không loại bỏ mục tiêu kiến trúc multi-tenant.

### Kiến trúc đích vẫn phải giữ khả năng mở rộng
- Database nghiệp vụ tiếp tục thiết kế có `organization_id` và quan hệ tenant phù hợp để không phải thiết kế lại khi mở rộng.
- Trong giai đoạn một tài khoản, tổ chức ban đầu được khởi tạo theo quy trình an toàn; không hardcode quyền Admin vào frontend và không cho client tự chọn organization_id/role.
- RLS vẫn phải được bật và kiểm thử; phạm vi quyền giai đoạn đầu có thể đơn giản hơn nhưng không được dùng service-role key ở frontend hoặc bỏ qua bảo mật database.
- Sau khi đồng bộ một tài khoản hoạt động ổn định, tiếp tục hoàn thiện invitation, membership, Admin/User và kiểm thử cách ly nhiều tổ chức.

### Thứ tự công việc được điều chỉnh
1. Tiếp tục hoàn thiện các phân hệ và kiểm thử nghiệp vụ trên dữ liệu local hiện có.
2. Chốt schema cloud theo dữ liệu thực tế, vẫn dành chỗ cho organization_id và mở rộng tenant.
3. Thiết kế/kiểm thử migration và RLS trên project BAOTRI-Mini-Test; chưa đụng project chính.
4. Hoàn thiện backup local đầy đủ, bao gồm 9 IndexedDB stores, danh mục custom localStorage và ảnh/tệp.
5. Viết import có kiểm tra, giữ ID/quan hệ/lịch sử, chống chạy lặp; đối chiếu trước/sau.
6. Chuyển từng phân hệ sang Supabase; xác thực cùng một tài khoản trên máy tính và điện thoại, kiểm tra đọc/ghi đồng nhất.
7. Khi luồng một tài khoản ổn định, quay lại hoàn thiện multi-tenant và phân quyền trên project test trước khi triển khai nhiều tổ chức thực tế.

### Trạng thái hiện tại
- Auth đăng nhập/đăng xuất cơ bản: đã được người dùng xác nhận hoạt động.
- Migration 001 identity/organizations/memberships: đã chạy thành công trên project test; chưa có tổ chức/membership mẫu.
- Dữ liệu nghiệp vụ: vẫn ở IndexedDB/localStorage; chưa có bảng nghiệp vụ cloud, chưa import, chưa đồng bộ.
- Bốn tài khoản Auth thử nghiệm: giữ nguyên, chưa cần thao tác thêm.
- Bước tiếp theo: tiếp tục công việc hoàn thiện BAOTRI Mini theo thứ tự ưu tiên; khi bắt đầu triển khai đồng bộ, thiết kế schema và luồng cloud cho một tài khoản trước nhưng không phá vỡ khả năng mở rộng multi-tenant.


## 16/11/2026 – Chốt trạng thái cuối buổi và điểm tiếp tục ngày mai

### Xác nhận về phiên đăng nhập
- Supabase client hiện đã cấu hình `persistSession: true`, `autoRefreshToken: true` và `detectSessionInUrl: true`.
- Người dùng không phải đăng nhập lại mỗi lần mở ứng dụng hoặc mỗi lần sửa dữ liệu; trình duyệt sẽ khôi phục phiên đã lưu và tự làm mới token khi cần.
- Mỗi trình duyệt/thiết bị có phiên đăng nhập riêng: máy tính đăng nhập một lần, điện thoại cũng cần đăng nhập lần đầu riêng. Đăng xuất, xóa dữ liệu trình duyệt hoặc mất phiên có thể khiến phải đăng nhập lại.
- Đây mới là trạng thái của Supabase Auth. Dữ liệu nghiệp vụ vẫn đang lưu riêng trong IndexedDB/localStorage của từng trình duyệt; chưa đồng bộ giữa máy tính và điện thoại.

### Trạng thái cuối buổi
- Đã thống nhất bắt đầu triển khai đồng bộ cloud theo lộ trình một tài khoản Auth trước, giữ khả năng mở rộng multi-tenant về sau.
- Chưa có thay đổi mã nguồn, chưa tạo migration mới, chưa chạy SQL trên Supabase project chính trong buổi trao đổi này.
- File tiến độ chính thức tiếp tục là tài liệu này trên nhánh `main`; không tạo file tiến độ phụ.

### Việc tiếp tục vào buổi làm việc kế tiếp
1. Đọc lại toàn bộ tài liệu tiến độ và kiểm tra trạng thái mới nhất trên nhánh `main`.
2. Rà soát schema/luồng nghiệp vụ đã kiểm kê, chốt schema cloud tối thiểu cho một tài khoản nhưng vẫn có `organization_id`, RLS và khả năng mở rộng tenant.
3. Lập kế hoạch migration theo từng phần, bắt đầu trên project `BAOTRI-Mini-Test`; không chạy SQL trên project chính khi chưa review và xác nhận phạm vi.
4. Thiết kế backup đầy đủ dữ liệu local trước khi viết import; tuyệt đối không tự xóa, ghi đè hoặc chuyển dữ liệu thật khi chưa có backup và đối chiếu.
5. Chỉ sau khi chốt thiết kế mới bắt đầu sửa code theo từng phân hệ; giữ nguyên chức năng đang chạy ổn và cập nhật tài liệu này sau mỗi mốc.



## 16/11/2026 – Chốt phương án triển khai sử dụng thực tế cá nhân

Người dùng xác nhận tiếp tục xây dựng BAOTRI Mini theo kiến trúc:
- **GitHub Pages**: host giao diện Web App/PWA, truy cập online từ máy tính và điện thoại; không cần bật máy tính cá nhân hoặc chạy Vite/PowerShell để sử dụng.
- **Supabase**: cung cấp Auth và PostgreSQL/database tập trung; các thiết bị đăng nhập cùng tài khoản cá nhân và đọc/ghi chung dữ liệu cloud.
- **Một người dùng cá nhân trước mắt**; chưa cần triển khai giao diện quản lý nhiều thành viên/tổ chức để đưa vào sử dụng đợt đầu. Tuy nhiên schema và bảo mật vẫn giữ khả năng mở rộng tenant, không hardcode quyền hoặc bỏ qua RLS.
- PWA có thể cài trên điện thoại; không đồng nghĩa ứng dụng có thể ghi dữ liệu nghiệp vụ offline. Khi mất Internet, phải thể hiện rõ trạng thái và tránh báo lưu thành công nếu chưa ghi được cloud.

### Mục tiêu và tiêu chí trước khi dùng tại nơi làm việc
Người dùng mong muốn có thể sử dụng BAOTRI trong đợt đi làm sắp tới. Đây là mục tiêu ưu tiên triển khai, không phải xác nhận ứng dụng đã sẵn sàng. Trước khi dùng dữ liệu công việc thật cần hoàn thành và kiểm tra tối thiểu:
1. Hoàn thiện schema cloud, RLS và quy trình khởi tạo tổ chức/tài khoản một cách an toàn.
2. Có backup đầy đủ dữ liệu local và quy trình import có kiểm tra, giữ ID, quan hệ, lịch sử và ảnh; có đối chiếu trước/sau.
3. Chuyển từng phân hệ sang đọc/ghi Supabase; không còn ghi nhầm vào IndexedDB như thể đã đồng bộ.
4. Kiểm tra PC và điện thoại cùng tài khoản thấy dữ liệu giống nhau; thử thêm/sửa/ghi nhận ở thiết bị này và xác nhận ở thiết bị kia.
5. Kiểm tra lỗi mạng, token/session, tải ảnh, dữ liệu trùng, lỗi ghi và khôi phục sau lỗi; giao diện phải báo rõ trạng thái lưu.
6. Build production và triển khai GitHub Pages; kiểm tra URL thật, PWA/cài đặt điện thoại, refresh/deep links và cập nhật phiên bản.
7. Kiểm tra dữ liệu mẫu/seed không tự chèn vào dữ liệu sử dụng thật; phân biệt dữ liệu demo và dữ liệu thật.
8. Chỉ đưa dữ liệu công việc thật vào sau khi backup, bảo mật và các kiểm thử thiết yếu đạt yêu cầu.

### Điểm tiếp tục
- Bắt đầu buổi làm việc kế tiếp bằng việc đọc lại file tiến độ và kiểm tra nhánh main.
- Ưu tiên chốt schema cloud tối thiểu, RLS và quy trình bootstrap cho một tài khoản; thử nghiệm trên project BAOTRI-Mini-Test.
- Sau đó triển khai backup/import và chuyển từng phân hệ; cuối cùng triển khai GitHub Pages production.
- Không tuyên bố sẵn sàng sử dụng tại nơi làm việc cho đến khi các tiêu chí trên được kiểm thử thực tế.
- Chưa có code, migration hay dữ liệu nào được thay đổi chỉ bởi quyết định này.


## 16/11/2026 – Xác nhận phạm vi reset toàn bộ dữ liệu trước khi dùng thật

Người dùng làm rõ yêu cầu: **đến ngày bắt đầu sử dụng BAOTRI Mini tại nơi làm việc mới, toàn bộ dữ liệu nghiệp vụ đã tạo từ giai đoạn phát triển/thử nghiệm cho đến thời điểm đó phải được xóa sạch**, không chỉ xóa các bản ghi được gắn nhãn demo.

Phạm vi reset dự kiến gồm toàn bộ dữ liệu nghiệp vụ trong môi trường/tổ chức sử dụng cá nhân trước ngày go-live, bao gồm:
- Toàn bộ hồ sơ thiết bị và ảnh thiết bị.
- Toàn bộ vật tư, số lượng tồn kho và lịch sử nhập/xuất/điều chỉnh.
- Toàn bộ kế hoạch/task bảo trì.
- Toàn bộ phiếu và nhật ký bảo dưỡng – sửa chữa (phiếu SC, lịch sử liên quan).
- Toàn bộ Checklist: biểu mẫu, các phiên bản biểu mẫu và phiếu/kết quả đã thực hiện.
- Toàn bộ danh mục nghiệp vụ tự tạo, dữ liệu mẫu và dữ liệu thử nghiệm liên quan khác.
- Các liên kết, hàng đợi đồng bộ và tệp lưu trữ chỉ thuộc các dữ liệu nghiệp vụ nói trên.

Sau reset, nơi làm việc mới bắt đầu với dữ liệu nghiệp vụ trống; thiết bị và vật tư được tạo/nhập lại theo thực tế. Tồn kho ban đầu được ghi nhận đúng số lượng thực tế tại thời điểm bắt đầu, không tái sử dụng lịch sử nhập/xuất thử nghiệm và không tạo giao dịch nhập giả.

**Không xóa** tài khoản Supabase Auth, thông tin đăng nhập/phiên, cấu trúc database/schema, migration, cấu hình ứng dụng, mã nguồn hoặc các thiết lập kỹ thuật cần để ứng dụng tiếp tục hoạt động. Không xóa dữ liệu của project test hoặc project khác ngoài phạm vi đã xác định.

### Điều kiện an toàn bắt buộc
1. Chức năng reset chỉ được thực hiện khi người dùng chủ động xác nhận rõ ràng ngay trước ngày go-live; không tự chạy theo ngày hoặc khi deploy.
2. Trước reset phải tạo bản backup đầy đủ, có thể khôi phục, gồm dữ liệu quan hệ, ảnh/tệp và các dữ liệu nghiệp vụ liên quan; xác minh backup đọc/khôi phục được.
3. Hiển thị bản xem trước số lượng bản ghi/tệp sẽ xóa theo từng phân hệ; yêu cầu xác nhận mạnh (ví dụ nhập `RESET TOAN BO DU LIEU NGHIEP VU`).
4. Reset theo đúng phạm vi một môi trường/tổ chức cá nhân, dùng transaction hoặc quy trình có kiểm soát; không xóa Auth user, schema hay dữ liệu ngoài phạm vi.
5. Sau reset kiểm tra tất cả phân hệ rỗng, không còn ảnh/tệp mồ côi, dữ liệu tồn kho bằng 0 và không có seed tự động chèn dữ liệu demo trở lại.
6. Chỉ sau khi kiểm tra xong mới bắt đầu nhập thiết bị, vật tư và số dư tồn kho thực tế của nơi làm việc mới.

Đây là yêu cầu nghiệp vụ đã được người dùng xác nhận. Chưa triển khai chức năng reset và chưa xóa dữ liệu nào. Khi triển khai phải thiết kế riêng, review phạm vi và kiểm thử trên project test trước; tuyệt đối không thực hiện reset thật khi chưa có xác nhận cuối cùng của người dùng.


## 17/11/2026 – Bắt đầu chuẩn bị đưa dữ liệu hiện có lên Supabase (một tài khoản)

Người dùng xác nhận đồng ý đưa cả dữ liệu thử nghiệm đang có trong trình duyệt lên Supabase để tiếp tục kiểm tra và sử dụng trên nhiều thiết bị. Mục tiêu vẫn là một tài khoản cá nhân; chưa bật luồng nhiều thành viên/tổ chức trong UI.

### Thay đổi đã thực hiện trên main
- Commit `38adf0c5f66b641384c5e3650ef60db9c2d88705` cập nhật `src/App.tsx`.
- Chức năng Sao lưu hiện xuất đủ 10 Dexie stores: `assets`, `inventory`, `tasks`, `logs`, `movements`, `maintenancePlans`, `checklistTemplates`, `checklistVersions`, `checklistResults`, `syncQueue`.
- File backup có metadata phiên bản/thời điểm/database và kèm `customAssetCategories` trong localStorage.
- Ảnh thiết bị hiện nằm trong `Asset.images` dạng data URL nên được đóng gói cùng bản backup JSON.
- Khôi phục vẫn dùng bulkPut theo ID và bổ sung khôi phục danh mục tự tạo; không xóa dữ liệu đang có. Backup cũ dạng JSON phẳng vẫn được chấp nhận nếu có các mảng tương ứng.

### Giới hạn và bước bắt buộc tiếp theo
- Chưa đọc được IndexedDB trên máy người dùng từ GitHub/Supabase; chưa có file backup thực tế trong cuộc trò chuyện.
- Chưa tải dữ liệu nào lên Supabase; chưa tạo schema nghiệp vụ cloud, chưa chạy SQL/migration mới và chưa sửa project Supabase chính.
- Người dùng cần mở BAOTRI trên đúng trình duyệt/máy đang chứa dữ liệu hiện tại, vào Cài đặt → Dữ liệu và sao lưu → Sao lưu, rồi gửi file `backup-baotri-day-du-YYYY-MM-DD.json` vừa tải xuống trong cuộc trò chuyện.
- Khi nhận file: kiểm tra cấu trúc, số lượng từng store, quan hệ ID, dung lượng/ảnh và danh mục; sau đó mới chốt schema + import có đối chiếu trên project test. Không xóa/ghi đè dữ liệu local.
- Chưa có kết quả build sau commit này; cần người dùng chạy `npm run build` local và báo kết quả trước khi dựa vào chức năng backup mới.

## 17/11/2026 – Đã kiểm tra backup và lập bản thiết kế schema nghiệp vụ cloud

### Đã xác minh lại trạng thái repository và nguồn dữ liệu
- Đã đọc lại file tiến độ trên `main`, migration nền `supabase/migrations/20261116000100_identity_and_organizations.sql`, `src/db.ts`, `src/lib/supabase.ts`, `package.json` và cấu trúc dữ liệu trong `src/App.tsx`.
- Auth Supabase đã tích hợp; dữ liệu nghiệp vụ hiện vẫn dùng Dexie/IndexedDB `baotri-local-v1`. Chưa có bảng nghiệp vụ cloud, chưa có worker đồng bộ.
- Người dùng đã chạy thành công `npm.cmd run build` tại máy local sau các thay đổi backup: TypeScript + Vite build thành công; Vite 6.4.6, 1664 modules transformed, PWA precache 11 entries. Kết quả này xác nhận build tại thời điểm người dùng chạy, không thay thế kiểm thử cloud.
- Đã mở và phân tích file backup `backup-baotri-day-du-2026-11-16.json`, backupVersion 2, database `baotri-local-v1`. Số lượng: assets 34; inventory 41; tasks 4; logs 6; movements 0; maintenancePlans 0; checklistTemplates 34; checklistVersions 34; checklistResults 0; syncQueue 17; customAssetCategories 0.
- Backup có 32 thiết bị chứa tổng cộng 64 ảnh dạng Data URL/Base64 trong `Asset.images`.
- Kiểm tra quan hệ: task → asset; log → asset/task; checklist template → asset; checklist version → template/asset đều không có tham chiếu mồ côi.
- Phát hiện hai bản ghi inventory trùng mã `VT-001`, cùng tên “Lọc dầu máy nén khí” và thông tin nghiệp vụ tương tự nhưng khác ID. Chưa gộp/xóa/đổi mã; cần người dùng xác nhận trước import.
- `syncQueue` 17 mục chỉ có upsert cho assets/tasks/logs, không phản ánh đầy đủ các phân hệ. Không được replay hàng đợi này để import cloud.

### Tài liệu thiết kế được tạo trên main
- Tạo `supabase/SCHEMA_NGHIEP_VU_DE_XUAT.md`, commit `a868f0e8cf78813f1ab73ca57c8487d2d230081a`.
- Tài liệu đề xuất các bảng: assets, inventory_items, maintenance_tasks, maintenance_logs, inventory_movements, maintenance_plans, checklist_templates, checklist_template_versions, checklist_results, asset_images và cấu hình danh mục nhóm/loại thiết bị tự tạo.
- Mọi bảng nghiệp vụ dự kiến có `organization_id`, FK kép theo organization để ngăn liên kết chéo tenant; giữ nguyên UUID ID local khi import.
- Checklist items và result snapshot đề xuất lưu JSONB để bảo toàn phiên bản/lịch sử.
- Ảnh đề xuất chuyển sang private Supabase Storage, bảng `asset_images` giữ metadata/thứ tự/checksum.
- Đề xuất quy trình import có dry-run, staging/batch, chống nhập trùng, dừng khi ID xung đột, đối chiếu ID/FK/số lượng/checksum và rollback có kiểm soát.
- Không đề xuất replay `syncQueue`; không xóa hoặc sửa dữ liệu local.
- Đây là tài liệu thiết kế để review, chưa phải migration SQL. Chưa chạy SQL, chưa tạo bảng nghiệp vụ, chưa tạo Storage bucket, chưa import dữ liệu và chưa thao tác project chính.

### Việc cần duyệt trước khi viết Migration 002
1. Chốt danh sách bảng/trường/quan hệ trong tài liệu thiết kế.
2. Người dùng quyết định cách xử lý hai bản ghi mã `VT-001`.
3. Duyệt nguyên tắc Checklist JSONB snapshot và ảnh lưu Storage.
4. Sau khi duyệt mới soạn Migration 002 và review SQL; chỉ thử trên project `BAOTRI-Mini-Test`, không chạy project chính.

### Migration 002 – bản nháp schema nghiệp vụ (17/11/2026)
- Đã tạo supabase/migrations/20261117000200_business_schema.sql trên main.
- Commit tạo bản nháp: a6325a8b3e93859bfb89a051f490105290cca294; commit rà soát quyền và ràng buộc: 1520e4b8aafaab28f844cdac7c6a3efcf953637e.
- Phạm vi gồm 11 bảng: assets, inventory_items, maintenance_tasks, maintenance_plans, checklist_templates, checklist_template_versions, checklist_results, maintenance_logs, inventory_movements, asset_images, organization_settings.
- Các quan hệ FK nghiệp vụ đều gắn organization_id; bảng con tham chiếu cả ID bản ghi cha và organization để chặn liên kết chéo tenant.
- Bật RLS cho toàn bộ bảng nghiệp vụ; SELECT/ghi được giới hạn theo membership active thông qua helper Migration 001. Các thao tác quản trị biểu mẫu Checklist và cấu hình danh mục yêu cầu role admin.
- Checklist version và result là lịch sử append-only; snapshot items dùng JSONB. Maintenance log độc lập với Checklist result.
- Inventory: chưa tạo unique code constraint vì dữ liệu phát triển có hai dòng VT-001. Người dùng xác nhận dữ liệu thử nghiệm sẽ được xử lý bằng quy trình reset toàn bộ dữ liệu nghiệp vụ trước go-live; không cần làm sạch riêng VT-001 hiện tại. Số tồn không được cập nhật trực tiếp qua quyền client; cần RPC nguyên tử để ghi movement và cập nhật balance cùng transaction.
- Chưa tạo bucket Storage; asset_images hiện chỉ là bảng metadata dự kiến. Chưa có RPC nhập/xuất kho, bootstrap organization/membership, import hoặc kết nối frontend.
- Trạng thái: bản nháp để review, chưa chạy trên bất kỳ Supabase project nào. Tuyệt đối chưa chạy trên project chính.
- Việc tiếp theo: rà soát kiểu ngày/giờ và trường dữ liệu đối chiếu với luồng UI thực tế; kiểm tra SQL trên project test sau khi người dùng duyệt bản migration. Nếu có thay đổi schema, cập nhật file migration trước khi chạy lần đầu.

### Rà soát mapping nguồn cho Migration 002 (17/11/2026)
- Đã đối chiếu src/db.ts và các đoạn sử dụng ngày/giờ trong src/App.tsx: các trường ngày lịch dùng PostgreSQL date; các mốc thời gian ISO dùng timestamptz.
- Đã xác minh customAssetCategories trong localStorage là mảng nhóm {label, items}, item có name và code. Migration 002 đã sửa organization_settings.asset_categories thành JSONB array, mặc định [].
- Đã đối chiếu các union type trạng thái thiết bị/công việc, chu kỳ kế hoạch, hình thức thực hiện và kết quả Checklist với CHECK constraint trong migration.
- Chưa xác minh đầy đủ nghiệp vụ ghi movement trong UI; CHECK quantity > 0 đang giả định quantity là trị tuyệt đối dương. Cần review nếu Điều chỉnh có thể biểu diễn số âm.
- Commit cập nhật Migration 002 theo mapping danh mục: 1a8755782297c39261a628d2c3993d3424f968ed. Commit cập nhật tài liệu thiết kế: 03cc12adb23b617fbb5ad9864bcd987930998b35.

### Người dùng duyệt Migration 002 cho môi trường Test (17/11/2026)
- Người dùng đã xác nhận duyệt bản nháp Migration 002 với phạm vi triển khai chỉ trên BAOTRI-Mini-Test; không được áp dụng trên BAOTRI-Mini production.
- Đã kiểm tra Migration 001 cung cấp set_updated_at(), is_org_member(uuid), has_org_role(uuid,text); role helper kiểm tra membership active và organization active. Các helper phù hợp với các tham chiếu trong Migration 002.
- Đã tạo script kiểm tra chỉ đọc: supabase/tests/20261117000200_business_schema_smoke_test.sql (commit 144299085e4c424d0b725b61ad830203dbcbde25). Script kiểm tra đủ 11 bảng, RLS/policies, quyền anon, quyền helper, cấm cập nhật số tồn trực tiếp, cấm insert movement trực tiếp và tính append-only của Checklist result/maintenance log.
- Trạng thái thực thi: chưa chạy Migration 002 và chưa chạy smoke test. Môi trường hiện tại không có kết nối/công cụ thực thi SQL trực tiếp tới Supabase; cần người dùng chạy trong SQL Editor của BAOTRI-Mini-Test hoặc cung cấp kết nối thực thi được cấp quyền. Không yêu cầu gửi service-role key hoặc mật khẩu.
- Trước khi chạy: mở đúng project BAOTRI-Mini-Test (ref oyzhxgzltpdebpymuicb), xác nhận Migration 001 đã có trong lịch sử migration, chạy nội dung Migration 002; nếu thành công mới chạy smoke test. Nếu lỗi, dừng, gửi nguyên văn lỗi để rà soát; không chạy tiếp hoặc thử trên production.


## 17/11/2026 – Migration 002 và Smoke test đã chạy thành công trên Test- Người dùng xác nhận Migration 002 trả về `Success. No rows returned` trên project `BAOTRI-Mini-Test`.
- Người dùng chạy Smoke test; ảnh kết quả cho thấy cột `row_security_active` là `true` cho các bảng hiển thị và người dùng xác nhận **cả 11/11 bảng đều true**.
- Kết luận trong phạm vi bằng chứng hiện có: Migration 002 thực thi không báo lỗi; RLS đang bật trên toàn bộ 11 bảng. Các kiểm tra khác trong Smoke test đã được script chạy nhưng chưa có ảnh/toàn bộ output để lưu từng dòng kết quả. Không diễn giải kết quả này thành kiểm thử RLS runtime dưới các vai trò authenticated/anon hoặc kiểm thử cách ly tenant thực tế.
- Project Production `BAOTRI-Mini` chưa được thay đổi. Chưa có dữ liệu nghiệp vụ nào được import; chưa có Storage bucket; frontend vẫn chưa đồng bộ dữ liệu cloud.

## 17/11/2026 – Chuẩn bị bootstrap một tổ chức cá nhân trên Test

- Theo kiến trúc hiện hành, chỉ sử dụng một tài khoản Auth của người dùng; vẫn giữ `organization_id`, membership và RLS để sẵn sàng mở rộng tenant về sau. Không triển khai giao diện nhiều tổ chức/thành viên ở giai đoạn này.
- Đã tạo `supabase/scripts/bootstrap_personal_organization.sql`: script one-time tạo tổ chức `Cá nhân`, membership active role `admin` cho đúng một Auth user được chỉ định bằng email, đồng thời tạo `organization_settings` mặc định. Script từ chối chạy nếu email chưa thay placeholder, không tìm thấy/không duy nhất Auth user, hoặc user đã có membership; không tạo Auth user và không thêm dữ liệu nghiệp vụ.
- Đã tạo `supabase/tests/verify_personal_organization_bootstrap.sql`: kiểm tra read-only số lượng membership active, role admin, settings và helper functions sau bootstrap.
- Các file trên được thêm trực tiếp vào `main`; chưa chạy script bootstrap, chưa tạo organization/membership thật và chưa thay đổi dữ liệu Supabase. Chỉ chạy trên `BAOTRI-Mini-Test`, tuyệt đối không chạy Production.
- Trước khi chạy, người dùng cần thay đúng placeholder `REPLACE_WITH_AUTH_EMAIL` trong cả hai script bằng email của tài khoản Auth duy nhất sẽ dùng. Không gửi mật khẩu, access token hoặc service-role key. Nếu project Test hiện có nhiều Auth users, phải chọn đúng email tài khoản của chính người dùng; script chỉ tạo membership cho user khớp email đó.
- Không tạo bảng/migration mới cho bootstrap vì các bảng identity và business schema đã có. Đây là script khởi tạo dữ liệu có kiểm soát, không phải migration cấu trúc.
- Commit bootstrap: d3bd0f71e6668b6020b94f55ecf77eeaa413f53e
- Commit verify: b10e1baadfc0bd8f09c2fa7d26bee9493ef9966c


## 17/11/2026 – Chuẩn bị kiểm tra RLS dưới role authenticated trên Test

- Đã đối chiếu lại mã nguồn Auth trên `main`: `src/lib/supabase.ts` khởi tạo Supabase client bằng `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY`, bật lưu/khôi phục session và tự refresh token; `src/AuthScreen.tsx` đăng nhập bằng email/mật khẩu; `src/App.tsx` gọi `getSession`, lắng nghe `onAuthStateChange`, khóa workspace khi chưa đăng nhập và gọi `signOut` khi đăng xuất.
- Xác nhận frontend đã có lớp Supabase Auth nhưng chưa có truy vấn organization/membership hoặc đọc dữ liệu nghiệp vụ cloud; IndexedDB vẫn là nguồn dữ liệu nghiệp vụ của ứng dụng. Không được hiểu đăng nhập thành công là đã có đồng bộ cloud.
- Đã tạo `supabase/tests/20261117000300_authenticated_rls_session_test.sql` trên `main`, commit `a25f0ec34e20c37095bdd22053ed793e288b1afa`. Đây là script chỉ đọc, chỉ chạy trên `BAOTRI-Mini-Test`: đặt JWT claims cho Auth user `tuanluongpham1980@gmail.com`, chuyển SQL role sang `authenticated`, rồi kiểm tra hồ sơ, organization, membership, hai helper phân quyền và khả năng SELECT trên 11 bảng nghiệp vụ. Script kết thúc bằng ROLLBACK.
- Giới hạn quan trọng: script mô phỏng role/JWT claims bên trong SQL Editor; đây là kiểm tra database grants/RLS ở tầng PostgreSQL, không thay thế kiểm thử API qua một session đăng nhập thực của trình duyệt. Không dùng kết quả này để khẳng định multi-tenant isolation thực tế, vì hiện mới có một tổ chức và chưa có dữ liệu nghiệp vụ.
- Chưa chạy script này. Chưa thay đổi cấu hình Supabase, Auth user, dữ liệu nghiệp vụ hoặc project Production. Bước kế tiếp: người dùng chạy script trên SQL Editor của Test; nếu kết quả đúng, mới thực hiện kiểm tra API Auth bằng cấu hình Test rõ ràng, không suy đoán nội dung `.env.local` và không chuyển nhầm sang Production.


## 17/11/2026 – Bổ sung chẩn đoán JWT/RLS trên Test

- Người dùng chạy script authenticated RLS trước đó và báo kết quả kiểm tra đầu tiên đều bằng 0; chưa đủ bằng chứng để kết luận RLS runtime hoạt động đúng.
- Không sửa migration, policy, Auth user hoặc dữ liệu. Không chạy lại Bootstrap.
- Đã thêm script chỉ đọc `supabase/tests/20261117000400_authenticated_rls_diagnostic.sql`, commit `8893012aad4eec3b215d02abf6fbada2f87938e7`.
- Script lấy đúng Auth user `tuanluongpham1980@gmail.com` và organization active của user trong Test, đặt JWT claims, chuyển role sang `authenticated`, rồi hiển thị database role, `auth.uid()`, các JWT settings, quyền SELECT và số dòng RLS nhìn thấy; kiểm tra trực tiếp hai helper trên organization ID đã xác định. Kết thúc bằng ROLLBACK, không ghi dữ liệu.
- Chỉ chạy script trên `BAOTRI-Mini-Test`; không chạy Production. Cần đọc kết quả chẩn đoán trước khi quyết định sửa JWT simulation hay chuyển sang kiểm thử API bằng phiên đăng nhập thật trong ứng dụng.


## 17/11/2026 – Kết nối ứng dụng đọc tổ chức và thử ghi/đọc một thiết bị trên Supabase Test

- Đã cập nhật `src/App.tsx` trực tiếp trên `main`, commit `b39802178501d254bb581b933ce9fda531f3f173` và commit sửa thứ tự React hooks/làm rõ trạng thái dữ liệu `244ce4264fe4f41725b081c67d66659672bf2df3`.
- Sau khi đăng nhập, ứng dụng gọi Supabase API bằng phiên người dùng thật để đọc membership active của chính user, sau đó đọc tổ chức active tương ứng. Nếu thiếu membership hoặc không đọc được tổ chức, ứng dụng không mở workspace và hiển thị lỗi thay vì dùng dữ liệu không có tenant context.
- Workspace hiển thị tên tổ chức và role thực tế lấy từ Supabase.
- Bổ sung phép thử thủ công “Thử ghi thiết bị lên cloud”: tạo một hàng thử nghiệm trong `public.assets` với mã `TEST-CLOUD-...`, `organization_id` lấy từ membership đã xác thực; ngay sau insert, ứng dụng SELECT lại theo ID để xác minh RLS/ghi/đọc qua API.
- Khi đăng nhập lại, ứng dụng tự tìm hàng `TEST-CLOUD-%` trong đúng organization để xác nhận bản ghi vẫn tồn tại trên cloud. Bản ghi thử nghiệm được giữ lại, không tự xóa.
- Phép thử chỉ ghi đúng một bản ghi thử nghiệm khi người dùng bấm nút; không nhập dữ liệu IndexedDB, không sửa/xóa dữ liệu local, không thay đổi schema/RLS, không dùng service-role key.
- Cần kiểm thử thực tế sau khi người dùng pull `main`, chạy `npm.cmd run build`, khởi động ứng dụng với `.env.local` trỏ đúng project Test, đăng nhập và bấm nút thử ghi. Sau đó đăng xuất/đăng nhập lại để xác nhận bản ghi được tìm thấy.
- Chưa có kết quả build hoặc API runtime từ máy người dùng; không tuyên bố phép thử đã thành công. Dữ liệu nghiệp vụ hiện tại vẫn lưu IndexedDB, chưa triển khai đồng bộ tự động.
- Production `BAOTRI-Mini` không được thay đổi.


## 17/11/2026 – Chuyển GitHub Pages sang build/deploy bằng GitHub Actions

- Người dùng báo tên miền `baotri.vieclamhp247.com` truy cập được nhưng trang trắng. Đối chiếu mã nguồn `main`: `index.html` nạp trực tiếp `/src/main.tsx`, trong khi đây là ứng dụng React/TypeScript cần Vite build; `vite.config.ts` không đặt base path riêng nên phù hợp custom domain tại root.
- Đã thêm workflow `.github/workflows/deploy-pages.yml` trực tiếp trên `main`, commit `adbc1b8a551a8c20f88b763094f132a794c8c76a`. Workflow chạy `npm ci`, `npm run build`, chuyển `CNAME` vào `dist`, upload Pages artifact và deploy bằng GitHub Actions.
- Workflow đọc hai GitHub Actions secrets `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` khi build. Chưa có bằng chứng các secrets này đã được cấu hình; nếu thiếu, frontend sẽ không khởi tạo Supabase client và không thể đăng nhập.
- Chưa đổi cấu hình Pages Source trong Settings; người dùng cần chọn GitHub Actions sau khi workflow có mặt. Chưa xác nhận workflow đã chạy thành công hoặc trang đã hoạt động.
- Bước kế tiếp: vào Settings > Pages, đổi Build and deployment Source sang GitHub Actions; sau đó vào Settings > Secrets and variables > Actions, thêm hai secrets nêu trên với URL và publishable/anon key của project BAOTRI-Mini-Test. Tuyệt đối không dùng service-role key. Kiểm tra Actions run trước khi mở lại site.
- Không thay đổi DNS, Supabase schema/Auth users, Production project hoặc dữ liệu nghiệp vụ. Dữ liệu nghiệp vụ vẫn local IndexedDB, chưa đồng bộ cloud.


## 17/11/2026 – Chốt nguyên tắc xây dựng hệ thống bảo mật BAOTRI Mini (ghi nhận thiết kế, chưa triển khai đầy đủ)

### 1. Mục tiêu và mô hình bảo mật
- Bảo vệ dữ liệu thiết bị, vật tư, công việc, Checklist, ảnh/tài liệu và thông tin tài khoản; ngăn người chưa đăng nhập, tài khoản bị khóa hoặc người thuộc doanh nghiệp khác truy cập trái phép.
- Áp dụng bảo mật nhiều lớp: xác thực danh tính, phân quyền nghiệp vụ, cô lập dữ liệu ở database, bảo vệ API/Storage, quản lý phiên đăng nhập, nhật ký kiểm toán, backup/khôi phục và kiểm thử bảo mật.
- Kiến trúc thương mại đã định hướng: một bộ mã nguồn dùng chung; mỗi doanh nghiệp khách hàng có **Supabase Project riêng** (Database, Auth, Storage riêng), định tuyến bằng subdomain doanh nghiệp. Không dùng chung một Supabase Project để chứa dữ liệu của nhiều khách hàng ở mô hình thương mại cuối cùng.
- Project Test hiện tại chỉ phục vụ phát triển/kiểm thử; Production tách biệt. Không đưa dữ liệu/secret của Production vào Test và không chạy migration thử nghiệm trên Production.
- Trong từng project doanh nghiệp, vẫn dùng organization/membership và RLS phù hợp để kiểm soát phạm vi dữ liệu, đồng thời bảo vệ trước lỗi truy vấn hoặc cấu hình ứng dụng. Việc mỗi doanh nghiệp có project riêng không phải lý do để bỏ qua RLS.

### 2. Xác thực và vòng đời tài khoản
- Supabase Auth là nguồn xác thực email/mật khẩu và quản lý session; không tự xây cơ chế lưu mật khẩu riêng. Không bao giờ lưu mật khẩu dạng rõ trong profile hoặc bảng nghiệp vụ.
- Admin quản lý tài khoản ngay trong giao diện BAOTRI; thao tác tạo/invite, đổi vai trò, khóa/mở khóa, thu hồi quyền và reset mật khẩu phải đi qua backend an toàn. Không đưa Supabase service-role key/secret vào frontend, file cấu hình public, GitHub hoặc log.
- Tạo Admin đầu tiên theo quy trình khởi tạo do nhà cung cấp kiểm soát: chỉ email đã được ủy quyền nhận liên kết có hạn dùng, dùng một lần và xác thực đúng email; không cho người ngoài tự đăng ký rồi nhận quyền Admin.
- Hỗ trợ Admin dự phòng; không để dữ liệu/doanh nghiệp phụ thuộc duy nhất vào một tài khoản cá nhân. Quy trình đổi email, chuyển quyền Admin hoặc khôi phục quyền phải xác minh người đại diện và ghi audit log.
- Khi nhân viên nghỉ việc/không còn nhiệm vụ: khóa hoặc thu hồi membership/quyền ngay ở backend/database, thu hồi phiên/token phù hợp; không chỉ ẩn nút trên giao diện.
- Cân nhắc MFA cho tài khoản Admin và các thao tác nhạy cảm; chính sách bắt buộc hay tùy chọn sẽ chốt trước khi triển khai chức năng tài khoản thương mại.

### 3. Phân quyền và kiểm soát dữ liệu
- Vai trò nghiệp vụ ban đầu: Admin, Kỹ thuật viên, Người xem. Quyền phải được kiểm tra ở database/backend cho từng thao tác; frontend chỉ phản ánh quyền, không phải lớp bảo mật cuối cùng.
- Mọi bảng nghiệp vụ phải có phạm vi tổ chức phù hợp; RLS mặc định từ chối nếu không có membership active/đúng tổ chức. Truy vấn và quan hệ khóa ngoại phải ngăn tham chiếu chéo organization.
- Quyền Admin chỉ cấp qua quy trình bootstrap/invitation được kiểm soát. Không cho client tự ghi role, organization_id, performed_by_user_id hoặc trường kiểm soát quyền.
- Danh tính người tạo/thực hiện phiếu phải lấy từ session đã xác thực ở backend/database; không cho người dùng giả danh người khác. Lưu user ID và snapshot tên người thực hiện tại thời điểm phát sinh để bảo toàn lịch sử.
- Các thao tác nhạy cảm như xóa vĩnh viễn, thay đổi quyền, sửa cấu hình mã, sửa/khóa tài khoản và điều chỉnh tồn kho cần xác nhận, kiểm tra quyền phía server và lưu lịch sử.
- Các phép ghi cần tính nhất quán (ví dụ nhập/xuất/điều chỉnh kho, cấp số mã duy nhất) phải dùng RPC/transaction hoặc backend an toàn; không để client tự cập nhật số tồn hay tự cấp số thứ tự bằng cách đọc rồi cộng 1.

### 4. API, khóa bí mật và Storage
- Frontend chỉ được dùng publishable/anon key; key này không thay thế RLS. Service-role key và mọi secret chỉ được giữ ở môi trường server/secret manager có quyền truy cập giới hạn.
- Không commit `.env`, token, mật khẩu, private key hoặc dữ liệu cá nhân thật vào repository. Cấu hình Test/Production phải tách riêng; rà soát GitHub Actions secrets và quyền workflow.
- Ảnh/tài liệu thiết bị lưu trong bucket private; đọc/tải qua session và policy đúng tổ chức, hoặc signed URL thời hạn ngắn. Không dùng bucket public cho hồ sơ nội bộ nếu không có quyết định riêng.
- Kiểm tra loại file, dung lượng, tên file và quyền upload/download; không tin MIME type hoặc đường dẫn do client tự khai báo.
- Validate dữ liệu ở backend/database; chống SQL injection bằng truy vấn có tham số/RPC an toàn; kiểm soát CORS, HTTPS, security headers và chính sách CSP phù hợp khi triển khai web.
- Giới hạn tốc độ/giám sát các luồng đăng nhập, gửi lời mời, reset mật khẩu và các thao tác có nguy cơ bị lạm dụng; không ghi mật khẩu, token hoặc dữ liệu bí mật vào log.

### 5. Nhật ký, backup và ứng phó sự cố
- Có audit log cho các sự kiện quan trọng: đăng nhập/đăng xuất và thay đổi bảo mật khi nền tảng hỗ trợ; tạo/khóa tài khoản; thay đổi vai trò; thay đổi cấu hình doanh nghiệp/mã thiết bị; xóa/khôi phục dữ liệu; thao tác kho và các thao tác quản trị.
- Audit log ghi actor, hành động, đối tượng, thời điểm, kết quả và thông tin cần thiết để truy vết; hạn chế quyền sửa/xóa log. Không ghi password, access token hoặc secret.
- Có lịch backup database và Storage; quy định thời gian lưu, quyền truy cập bản backup, mã hóa và quy trình khôi phục. Phải kiểm thử restore định kỳ, không chỉ kiểm tra backup đã tạo.
- Có quy trình xử lý sự cố: khóa tài khoản/phiên bị nghi lộ, thu hồi/đổi secret, xác định phạm vi dữ liệu bị ảnh hưởng, khôi phục từ backup và ghi nhận sự kiện.

### 6. Kiểm thử bảo mật bắt buộc trước khi đưa vào sử dụng thật
- Kiểm tra chưa đăng nhập không thể đọc/ghi dữ liệu nghiệp vụ.
- Kiểm tra User bị khóa hoặc membership inactive không thể tiếp tục truy cập qua API.
- Kiểm tra Kỹ thuật viên/Người xem không thể thực hiện thao tác vượt quyền dù gọi API trực tiếp, bỏ qua giao diện.
- Kiểm tra không thể sửa organization_id, role, created_by/performed_by hoặc đọc/ghi hồ sơ của tổ chức khác.
- Kiểm tra Storage private: user không có quyền không thể xem/tải ảnh/tài liệu bằng URL đoán được hoặc URL cũ đã hết hạn.
- Kiểm tra cấp mã đồng thời không trùng; thao tác kho đồng thời không làm sai số tồn; lịch sử Checklist và nhật ký không bị sửa/xóa trái phép.
- Kiểm tra reset mật khẩu/invitation dùng đúng email, có hạn dùng, không dùng lại được; kiểm tra Admin dự phòng và quy trình thu hồi quyền.
- Kiểm tra backup/restore trên môi trường Test và đối chiếu số lượng, quan hệ dữ liệu, ảnh/tài liệu sau khôi phục.
- Tạo các ca kiểm thử âm tính và kiểm thử qua API với ít nhất hai danh tính/nhóm quyền; khi có môi trường doanh nghiệp thử nghiệm, kiểm tra cách ly giữa hai project/subdomain khác nhau.

### 7. Trạng thái bảo mật thực tế tại thời điểm ghi nhận
- Đã có Supabase Auth frontend, đọc membership/organization bằng session người dùng và Migration 001/002 trên project Test; RLS đã bật trên 11/11 bảng nghiệp vụ theo xác nhận của người dùng.
- Đã có phép thử ghi/đọc một thiết bị thử qua API trong code, nhưng chưa có kết quả runtime xác nhận người dùng đã chạy thành công.
- Chưa đủ bằng chứng kiểm thử RLS runtime đầy đủ cho các vai trò; chưa kiểm thử cách ly giữa hai tổ chức hoặc hai doanh nghiệp; chưa triển khai hoàn chỉnh quản lý User/Admin, MFA, audit log, Storage private, backup/restore định kỳ, RPC kho và quy trình sự cố.
- Dữ liệu nghiệp vụ hiện vẫn chưa được đồng bộ/import đầy đủ từ IndexedDB lên cloud. Không được quảng bá BAOTRI Mini là đã hoàn thiện/bảo đảm an toàn bảo mật trước khi hoàn tất các bài kiểm thử nêu trên.
- Nội dung trong mục này là **nguyên tắc/đặc tả bảo mật cần thực hiện**, không phải xác nhận các chức năng đã được code hoặc kiểm thử.

### 8. Thứ tự triển khai đề xuất
1. Hoàn tất kiểm tra Auth, membership và RLS qua API với danh tính thực; kiểm tra negative cases và quyền từng vai trò.
2. Hoàn thiện bootstrap/invitation và quản lý vòng đời tài khoản an toàn.
3. Hoàn thiện các RPC/transaction cho cấp mã và nghiệp vụ kho; kiểm tra quyền ở database.
4. Thiết lập Storage private và policy cho ảnh/tài liệu.
5. Xây audit log, backup/restore và quy trình khôi phục.
6. Thực hiện kiểm thử bảo mật tổng thể trên Test trước khi xem xét triển khai Production.



## 17/11/2026 – Đặc tả phân hệ Admin quản lý User và phân quyền (đã chốt thiết kế, chưa triển khai)

### 1. Mục tiêu và nguyên tắc
- Admin quản lý người dùng ngay trong BAOTRI Mini; không yêu cầu Admin truy cập Supabase Dashboard để thực hiện nghiệp vụ thường ngày.
- Supabase Auth là nguồn xác thực duy nhất cho email, mật khẩu và session. Không tạo bảng mật khẩu riêng, không lưu mật khẩu rõ.
- Tách biệt hồ sơ cá nhân, tư cách thành viên doanh nghiệp và quyền nghiệp vụ. Không gộp tất cả vào một bảng User.
- Mỗi doanh nghiệp thương mại có Supabase Project riêng theo kiến trúc đã chốt. User được quản lý trong phạm vi project/doanh nghiệp tương ứng.
- Một tài khoản Auth có thể được liên kết với hồ sơ và membership theo mô hình dữ liệu đã thiết kế; mọi truy cập nghiệp vụ phải xác định được doanh nghiệp và membership đang hoạt động.
- Không cho người dùng tự đăng ký rồi tự nhận quyền Admin. Admin đầu tiên được khởi tạo theo quy trình onboarding do nhà cung cấp kiểm soát.

### 2. Mô hình dữ liệu định hướng
- `auth.users`: do Supabase Auth quản lý; chứa định danh xác thực (UUID), email và trạng thái xác thực/session. Ứng dụng không tự quản lý mật khẩu.
- `user_profiles`: thông tin hồ sơ dùng chung như họ tên, số điện thoại, mã nhân viên, bộ phận, chức vụ và thông tin hiển thị cần thiết. Không chứa password hoặc secret.
- `organization_members`: liên kết Auth user với doanh nghiệp/tổ chức; lưu trạng thái membership, thời điểm tham gia, người mời và các thông tin vòng đời cần thiết. Thu hồi membership phải có hiệu lực ở backend/database.
- `roles`: danh mục vai trò trong phạm vi doanh nghiệp; gồm ba vai trò mặc định và các vai trò tùy chỉnh do Admin có thẩm quyền tạo.
- `permissions`: danh mục quyền chuẩn do ứng dụng định nghĩa theo phân hệ và hành động; không cho Admin tự tạo mã quyền tùy ý làm thay đổi logic bảo mật.
- `role_permissions`: liên kết vai trò với các quyền được cấp.
- `member_roles` (hoặc cấu trúc tương đương): gán một hay nhiều vai trò cho membership. Cần chốt tên bảng và quan hệ sau khi rà soát Migration hiện hữu; không tạo trùng bảng nếu schema đã có thành phần tương đương.
- Có thể bổ sung bảng invitation/audit log theo thiết kế tổng thể; không lưu token mời dạng có thể sử dụng lại trong dữ liệu đọc công khai.

### 3. Vai trò và cách phân quyền đã chốt
- Ba vai trò mặc định: **Admin**, **Kỹ thuật viên**, **Người xem**.
- Admin được phép tạo vai trò tùy chỉnh bằng cách chọn các quyền trong danh mục quyền chuẩn của hệ thống, ví dụ theo phân hệ Thiết bị, Checklist, Bảo trì, Kho, Báo cáo và Quản trị.
- Quyền được gán thông qua vai trò; mặc định không thiết kế màn hình cấp quyền rời rạc trực tiếp cho từng User. Cách này giúp quản trị nhất quán, dễ kiểm tra và tránh phát sinh cấu hình khó truy vết.
- Một membership có thể được gán nhiều vai trò nếu cần; quyền hiệu lực là hợp các quyền được cấp từ các vai trò đang hoạt động, trừ khi sau này có yêu cầu rõ ràng về cơ chế từ chối quyền. Không triển khai deny/override phức tạp ở giai đoạn đầu.
- Vai trò Admin có quyền quản trị người dùng và phân quyền. Không cho phép Admin tự làm mất quyền Admin cuối cùng đang hoạt động; phải có cơ chế bảo vệ Admin dự phòng.
- Các quyền nhạy cảm (quản lý User/role, xóa dữ liệu, cấu hình hệ thống, điều chỉnh kho) cần được phân biệt rõ với quyền xem hoặc thao tác thông thường.

### 4. Giao diện Admin – Quản lý người dùng
- Danh sách User hiển thị tối thiểu: họ tên, email đăng nhập, mã nhân viên (nếu có), bộ phận/chức vụ (nếu có), vai trò, trạng thái và ngày được mời/tạo.
- Có tìm kiếm/lọc theo tên, email, vai trò và trạng thái.
- Các thao tác: mời User, xem/sửa hồ sơ, gán hoặc thay đổi vai trò, gửi lại lời mời khi phù hợp, khóa/mở khóa hoặc thu hồi membership.
- Trạng thái vòng đời cần phân biệt tối thiểu: đang chờ lời mời/kích hoạt, đang hoạt động, bị khóa/đã thu hồi. Trạng thái hiển thị phải lấy từ trạng thái có thẩm quyền ở backend, không chỉ từ localStorage.
- Không hiển thị password; Admin không được xem hoặc biết mật khẩu của User.
- Có màn hình/quy trình quản lý vai trò: danh sách vai trò, tạo vai trò tùy chỉnh, mô tả vai trò, chọn quyền theo phân hệ/hành động và xem các User đang được gán vai trò đó.
- Khi xóa/ngừng dùng một vai trò, phải kiểm tra các membership đang được gán; không xóa làm mất dấu lịch sử hoặc khiến quyền ngoài dự kiến được cấp.

### 5. Quy trình mời và kích hoạt User
1. Admin nhập email và thông tin hồ sơ cần thiết, chọn vai trò.
2. Frontend gọi backend/Edge Function đã xác thực quyền Admin.
3. Backend dùng secret/service-role key chỉ ở môi trường server để gửi invitation qua Supabase Auth; secret tuyệt đối không xuất hiện ở frontend, repository hoặc log.
4. Người được mời xác minh email và hoàn tất thiết lập mật khẩu theo luồng Auth an toàn.
5. Backend liên kết Auth UUID với hồ sơ và membership doanh nghiệp, gán vai trò đã chọn; tránh tạo membership mồ côi hoặc cấp quyền trước khi xác minh theo chính sách.
6. Khi đăng nhập, ứng dụng đọc identity, membership và quyền hiệu lực từ nguồn dữ liệu có thẩm quyền; chỉ mở các chức năng phù hợp.
- Các thao tác tạo lời mời, gửi lại lời mời, đổi vai trò, khóa/mở khóa và thu hồi membership phải được kiểm tra quyền phía server và ghi audit log.
- Phải xử lý an toàn trường hợp email đã tồn tại, lời mời hết hạn, lời mời bị gửi lặp, người dùng chưa xác minh, hoặc thao tác tạo profile/membership thất bại giữa chừng.

### 6. Khóa tài khoản, nghỉ việc và bảo toàn lịch sử
- Khóa User hoặc thu hồi membership phải ngăn truy cập dữ liệu/API ngay ở backend/database; không chỉ ẩn menu hoặc nút trên frontend.
- Thu hồi quyền không đồng nghĩa xóa Auth user, profile, phiếu Checklist, lịch sử bảo trì, nhật ký kho hoặc dữ liệu do người đó tạo.
- Dữ liệu lịch sử tiếp tục lưu Auth UUID/actor ID và snapshot tên người thực hiện tại thời điểm phát sinh theo nguyên tắc bảo toàn lịch sử đã thống nhất.
- Có quy trình mở khóa/gia hạn membership do Admin đủ quyền thực hiện và ghi audit log.
- Khi chuyển giao quyền Admin hoặc thay email quản trị, phải xác minh đại diện doanh nghiệp; luôn duy trì Admin dự phòng và không để doanh nghiệp mất quyền quản trị.

### 7. Ranh giới bảo mật bắt buộc
- Không gọi thao tác quản trị Auth bằng service-role key trực tiếp từ trình duyệt. Mọi thao tác cần đặc quyền phải qua Edge Function/backend có xác thực session và kiểm tra quyền Admin.
- Không tin role, organization ID, user ID hoặc permission do client tự gửi. Backend/database phải tự xác định actor từ session đã xác thực và kiểm tra membership/role tương ứng.
- RLS phải kiểm tra membership còn hoạt động và quyền cần thiết cho từng thao tác dữ liệu. RLS không được chỉ dựa vào việc frontend đã ẩn chức năng.
- Bảng role/permission và quan hệ gán quyền phải được bảo vệ: chỉ Admin hợp lệ mới được quản trị; người dùng thường không thể tự nâng quyền hoặc sửa role của chính mình.
- Có kiểm thử âm tính: User bị khóa vẫn không đọc/ghi được qua API; Kỹ thuật viên không thể tự cấp Admin; Người xem không thể ghi dữ liệu; không thể truy cập dữ liệu ngoài phạm vi; Admin không thể xóa quyền Admin cuối cùng; lời mời hết hạn/đã dùng không thể tái sử dụng.

### 8. Trạng thái và việc cần làm trước khi code
- Đây là đặc tả thiết kế đã chốt theo hướng: ba vai trò mặc định + vai trò tùy chỉnh theo danh mục quyền chuẩn + gán quyền thông qua vai trò.
- **Chưa xác nhận đã tạo các bảng `user_profiles`, `roles`, `permissions`, `role_permissions`, `member_roles` hoặc bảng invitation/audit log. Chưa có xác nhận đã triển khai giao diện Admin, Edge Function mời User hay kiểm thử vòng đời tài khoản.**
- Trước khi tạo migration, phải đọc toàn bộ Migration hiện có (đặc biệt Migration 001/002), kiểm tra schema thực tế và các bảng/enum/function/policy đã tồn tại; tái sử dụng hoặc điều chỉnh đúng cấu trúc hiện hữu, không tạo bảng trùng và không phá luồng Auth/membership đang chạy.
- Tiếp theo: rà soát schema hiện tại → lập ma trận quyền cụ thể theo từng phân hệ/hành động → thiết kế migration tương thích → xây backend/Edge Function invitation và quản trị membership/role → xây giao diện Admin → kiểm thử RLS/API với từng vai trò và các trường hợp âm tính trên Test.
- Chỉ chuyển trạng thái sang “đã triển khai/đã kiểm thử” khi có code thực tế và kết quả chạy xác nhận; nội dung trên không phải bằng chứng chức năng đã hoàn thành.


### 9. Đối chiếu Migration hiện có – 17/11/2026
Đã đọc trực tiếp ba file migration đang có trên nhánh `main`:
- `20261116000100_identity_and_organizations.sql` (Migration 001): đã có `profiles`, `organizations`, `organization_members`; `profiles.id` liên kết `auth.users.id`; `organization_members.role` hiện chỉ chấp nhận `admin` hoặc `user`; trạng thái membership gồm `invited`, `active`, `suspended`. Client hiện chỉ được SELECT membership, chưa được INSERT/UPDATE/DELETE; có helper `is_org_member(uuid)` và `has_org_role(uuid,text)`.
- `20261117000100_maintenance_records.sql`: bảng đồng bộ dữ liệu JSON theo owner của tài khoản, phục vụ rollout một tài khoản; không phải bảng quản lý User.
- `20261117000200_business_schema.sql` (Migration 002): 11 bảng nghiệp vụ đang dùng RLS dựa trên membership và các helper hiện tại; một số quyền nghiệp vụ hiện vẫn đang cấp rộng cho member, chưa phân biệt granular giữa Kỹ thuật viên và Người xem.
- Vì đã có bảng `profiles`, **không tạo thêm bảng `user_profiles` trùng chức năng**. Có thể mở rộng `profiles` khi có yêu cầu hồ sơ phù hợp.
- Không thể chỉ thêm ba chuỗi role vào giao diện: phải thiết kế migration nâng cấp `organization_members.role` và thay thế/mở rộng helper `has_org_role` cùng các policy RLS hiện tại. Nếu không, role tùy chỉnh sẽ không được RLS hiểu và quyền có thể không đúng.
- Trước khi code phân hệ này, cần kiểm tra thêm toàn bộ frontend auth/session, cấu hình Supabase Functions và trạng thái migration thực tế trên project Test. Các file migration trong repository tự ghi là draft/review; không được suy ra rằng chúng đã được áp dụng thành công chỉ vì có trong GitHub.


## 17/11/2026 – Bắt đầu triển khai nền vai trò và quyền (Migration 003)

### Đã rà soát code hiện tại
- `src/lib/supabase.ts` đã khởi tạo Supabase client bằng `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY`; session được lưu và tự refresh.
- `src/AuthScreen.tsx` đã có đăng nhập email/mật khẩu qua Supabase Auth.
- `src/App.tsx` đã khôi phục session, lắng nghe `onAuthStateChange`, đọc membership active và tổ chức đang hoạt động. Luồng hiện giả định một membership active trong một Supabase Project.
- Frontend hiện vẫn truyền `organizationRole` vào workspace theo role cũ; chưa có bộ nạp permission hiệu lực và chưa có UI Admin quản lý User/Role.
- Repository chưa có thư mục `supabase/functions`; chưa có Edge Function quản trị Auth/invitation.
- Migration 002 có 11 bảng nghiệp vụ. Nhiều policy vẫn cho mọi member active đọc/ghi; chỉ một số thao tác xóa hoặc quản lý mẫu Checklist/cấu hình mới yêu cầu Admin. Vì vậy hiện chưa được xem là đã phân quyền granular.
- Không có bằng chứng từ GitHub để xác nhận Migration 001/002 đã được áp dụng ở project Test hay Production; phải kiểm tra migration state thực tế trước khi chạy Migration 003.

### Code mới đã đưa lên main
- Tạo `supabase/migrations/20261117000500_roles_and_permissions.sql`:
  - Tạo bảng `roles`, `permissions`, `role_permissions` và `member_roles`; các bảng đều giới hạn theo organization.
  - Tạo danh mục quyền chuẩn theo các phân hệ Dashboard, Thiết bị, Kho, Bảo trì, Checklist, Nhật ký, Báo cáo, Cài đặt, User và Role.
  - Tạo ba role hệ thống Admin, Kỹ thuật viên và Người xem cho các organization hiện có.
  - Gán quyền mặc định: Admin toàn quyền trong danh mục; Kỹ thuật viên có quyền nghiệp vụ; Người xem chỉ có quyền xem.
  - Ánh xạ membership cũ `admin` sang Admin và `user` sang Kỹ thuật viên mà không sửa giá trị cột `organization_members.role` hiện tại.
  - Mở rộng `has_org_role` để nhận role assignment mới nhưng vẫn tương thích role cũ; bổ sung `has_org_permission` để kiểm tra quyền hiệu lực.
  - Các bảng role/permission chỉ cấp SELECT cho authenticated; client không được INSERT/UPDATE/DELETE trực tiếp. Việc quản trị phải đi qua backend tin cậy ở bước sau.
- Tạo `supabase/tests/20261117000500_roles_and_permissions_smoke_test.sql` để kiểm tra ba role mặc định, ánh xạ Admin và quyền quản trị. Đây là script đọc/kiểm tra trong transaction rollback, cần thay UUID placeholder trước khi chạy.
- Commit migration: `e66f9225570050ff2bc4207db275ad8a711de51d`.
- Commit smoke test: `09e4ac9350bdceceacb8b9aa5155677a7ab5c269`.

### Giới hạn và việc chưa làm
- Migration 003 mới là code trong repository; **chưa áp dụng lên Supabase Test**, chưa có kết quả chạy SQL hoặc smoke test. Tuyệt đối chưa chạy trên Production.
- Migration 003 chưa thay thế các policy nghiệp vụ hiện hữu của Migration 002 bằng `has_org_permission`. Do đó ba role đã có cấu trúc và quyền mặc định trong database nhưng quyền granular chưa được thực thi trên 11 bảng nghiệp vụ.
- Chưa tạo Edge Function, chưa triển khai lời mời/tạo/khóa User, chưa có giao diện Admin quản lý User/Role.
- Chưa triển khai audit log và bảo vệ Admin cuối cùng ở thao tác thay đổi role; các điều kiện này phải được thực hiện trong backend/RPC trước khi cho phép quản trị thực tế.
- Migration 003 có tính additive và giữ nguyên cột role cũ để tương thích, nhưng vẫn cần kiểm tra trạng thái schema Test và rà soát kỹ trước khi chạy.

### Bước tiếp theo
1. Trên project BAOTRI-Mini-Test, kiểm tra migration history và schema hiện tại; xác nhận Migration 001/002 đã chạy thành công trước Migration 003.
2. Chạy Migration 003 trên Test; nếu lỗi thì dừng và xử lý theo lỗi thực tế, không sửa trực tiếp Production.
3. Chạy smoke test với UUID tài khoản Admin Test và lưu kết quả.
4. Thiết kế Migration 004 để chuyển các policy nghiệp vụ từ kiểm tra membership rộng sang `has_org_permission` theo ma trận quyền; bổ sung test âm tính cho Admin/Kỹ thuật viên/Người xem.
5. Sau khi RLS granular đạt kiểm thử, xây Edge Functions quản lý User/Role và giao diện Admin.

- Đã sửa smoke test để kiểm tra placeholder UUID trước khi ép kiểu UUID; commit sửa test: `a7dcfb7d53d3f928751327e8c63b558cb44dcbdc`. Đã fetch lại xác nhận migration 003 và file tiến độ tồn tại trên `main`; chưa chạy SQL trên Supabase.


### Kết quả chạy Migration 003 trên BAOTRI-Mini-Test – 17/11/2026
- Người dùng xác nhận Supabase SQL Editor trả về: **Success. No rows returned** khi chạy toàn bộ `20261117000500_roles_and_permissions.sql`.
- Ghi nhận Migration 003 đã được thực thi thành công trên project Test theo thông báo của Supabase.
- Người dùng đã chạy `20261117000500_roles_and_permissions_smoke_test.sql` trên Test với Auth UUID `08f0f750-3361-4ae0-b6ed-9dc4a5b41244`; kết quả xác nhận cả ba giá trị `admin_role_ok`, `users_manage_ok`, `roles_manage_ok` đều là **true**.
- Smoke test đã xác nhận tài khoản được nhận diện đúng Admin, có quyền `users.manage` và `roles.manage`; các assertion trong script cũng đã chạy qua, gồm kiểm tra đủ 3 role hệ thống và ít nhất 20 quyền gán cho Admin. Script kết thúc bằng `ROLLBACK`, không lưu thay đổi dữ liệu kiểm thử.
- Phạm vi xác nhận chỉ là smoke test vai trò/quyền cơ bản trên BAOTRI-Mini-Test; chưa phải kiểm thử RLS granular trên 11 bảng nghiệp vụ, chưa kiểm thử Technician/Viewer, membership suspended hoặc cách ly giữa hai tổ chức.
- **Bước tiếp theo:** rà soát đầy đủ tên bảng, cột, policy RLS hiện tại trong Migration 002 và các thao tác CRUD frontend; từ đó lập ma trận quyền và thiết kế Migration 004. Chưa chạy Migration 004 và tuyệt đối chưa áp dụng thay đổi lên Production.

## Cập nhật 17/11/2026 – Chuẩn hóa định danh thiết bị và QR

Đã triển khai trực tiếp trên nhánh `main`:

- Giữ nguyên UUID nội bộ hiện có của thiết bị và các bản ghi liên quan (vật tư, công việc, kế hoạch, nhật ký, Checklist); không đổi khóa chính, không tạo lại hồ sơ và không đụng vào dữ liệu Supabase.
- QR thiết bị chuyển sang payload ổn định `ASSET:<UUID>`. QR trên màn hình chi tiết, tem QR và bản in chi tiết đều dùng cùng payload; mã quản lý hiển thị vẫn được in/hiển thị riêng.
- Trình quét ưu tiên tìm theo UUID. Vẫn hỗ trợ QR cũ chứa trực tiếp mã quản lý hoặc dạng `ASSET:<mã quản lý>`, để các tem đã in trước đây tiếp tục dùng được.
- Cấp mã quản lý khi thêm thiết bị được đưa vào một Dexie transaction bao gồm đọc danh sách hiện tại, tạo mã, ghi thiết bị và ghi hàng đợi thay đổi. Điều này tránh hai tab trên cùng trình duyệt đồng thời lấy cùng số thứ tự.
- Mã quản lý của hồ sơ hiện hữu không tự đổi khi sửa thông tin. Quy tắc cơ sở `HP01`, danh mục vị trí và nhóm thiết bị hiện tại vẫn được giữ nguyên để không làm thay đổi mã đã cấp.

Giới hạn cần ghi nhớ:
- Cơ chế cấp số trong transaction hiện bảo đảm trong cùng IndexedDB trên cùng trình duyệt/origin; chưa phải bộ cấp số toàn doanh nghiệp giữa nhiều máy. Khi triển khai CRUD cloud, phải chuyển khâu cấp số sang PostgreSQL RPC/transaction, dùng unique constraint `(organization_id, code)` đã có trong schema.
- Chưa bổ sung lịch sử alias cho trường hợp Admin chủ động đổi mã quản lý; hiện giao diện không cho sửa mã đã cấp.
- Chưa thay đổi schema hoặc chạy SQL trên Supabase.

Kiểm tra:
- Đã rà soát và cập nhật ba vị trí tạo QR trong `src/App.tsx`, cùng logic quét QR.
- Đã cập nhật quy ước trong `QUY_UOC_MA_DINH_DANH_VA_VIET_TAT_THIET_BI.txt`.
- Chưa chạy được `npm run build`: môi trường thực thi không truy cập được GitHub để clone/cài dependencies. Vì vậy chưa đánh dấu build hoặc kiểm thử runtime là thành công.

## Cập nhật 17/11/2026 – Chuẩn bị phân quyền RLS theo vai trò

Đã rà soát toàn bộ Migration 002, Migration 005 và các lệnh truy cập Supabase trong `src/App.tsx`:

- 11 bảng nghiệp vụ trong Migration 002 hiện có RLS nhưng phần lớn đang cho mọi thành viên active đọc/ghi theo chính sách rộng.
- Migration 005 đã có danh mục quyền chi tiết và hàm `has_org_permission(organization_id, permission_code)`; thành viên bị suspended hoặc tổ chức bị suspended không được hàm này cấp quyền.
- `src/App.tsx` hiện chưa có CRUD nghiệp vụ cloud: dữ liệu thiết bị, kho, công việc, Checklist, kế hoạch và nhật ký vẫn thao tác qua IndexedDB. Các truy vấn Supabase hiện có chủ yếu là membership/organization và bản ghi thiết bị kiểm thử. Vì vậy chưa được coi đồng bộ nghiệp vụ đã hoạt động.

Đã tạo trên `main`:
- `supabase/migrations/20261117000600_permission_based_business_rls.sql`: thay các policy broad-member bằng policy dựa trên quyền cụ thể cho 11 bảng nghiệp vụ.
- `supabase/tests/20261117000600_permission_based_business_rls_smoke_test.sql`: kiểm tra read-only, gồm RLS của 11 bảng, 32 policy theo quyền, việc loại bỏ policy cũ và giữ chặn ghi trực tiếp số lượng kho/phiếu nhập xuất.

Các nguyên tắc được giữ:
- Admin có quyền theo toàn bộ permission catalog.
- Kỹ thuật viên chỉ được thao tác nghiệp vụ đã cấp quyền; không được xóa dữ liệu hoặc quản trị người dùng/vai trò.
- Người xem chỉ có quyền đọc.
- Checklist template/version chỉ được tạo/sửa bởi người có `checklist.template.manage`; kết quả Checklist và nhật ký là dữ liệu lịch sử append-only.
- Không cấp INSERT trực tiếp cho `inventory_movements`; không cấp UPDATE cột `inventory_items.quantity`. Hai thao tác này phải đi qua RPC nguyên tử để tránh sai lệch tồn kho.
- Ảnh thiết bị được kiểm soát theo quyền tạo/sửa/xem/xóa thiết bị.
- Migration mới đánh số 006 vì Migration 005 đã tồn tại; không đổi tên hoặc sửa migration đã chạy.

Trạng thái:
- Đã tạo migration và smoke test trên GitHub.
- Chưa chạy Migration 006 hoặc smoke test trên Supabase Test; không có thay đổi database nào được thực hiện trong bước này.
- Chưa chạy build frontend do môi trường hiện tại không truy cập được GitHub để clone/cài dependencies.
- Trước khi đồng bộ nghiệp vụ cloud, cần chạy migration + smoke test trên Test, sau đó bổ sung kiểm thử quyền thực tế cho Admin/Kỹ thuật viên/Người xem và suspended membership.


## Cập nhật 17/11/2026 – chuẩn bị kiểm thử phân quyền thực tế

- Người dùng xác nhận Migration 006 trên `BAOTRI-Mini-Test` trả về `Success. No rows returned`.
- Người dùng xác nhận smoke test Migration 006 cũng trả về `Success. No rows returned`.
- Đã đối chiếu mã smoke test: đây là khối `DO` chỉ kiểm tra metadata và quyền SQL; nếu điều kiện sai sẽ phát sinh exception. Tuy nhiên, smoke test chưa mô phỏng hành vi của từng Auth user.
- Đã thêm `supabase/tests/20261117000700_role_test_preflight.sql` trên `main`. Đây là script chỉ đọc, trả về ba nhóm kết quả: tổ chức và số membership/role; Auth user cùng role được gán; số lượng và danh sách permission của Admin/Kỹ thuật viên/Người xem.
- Mục đích: xác định dữ liệu tài khoản thật hiện có trước khi viết bài test RLS theo JWT/Auth user. Không tự tạo Auth user, không sửa membership, không thay đổi dữ liệu nghiệp vụ.
- Chưa kiểm thử quyền thực tế Admin/Kỹ thuật viên/Người xem, trạng thái suspended hoặc cross-organization. Chưa có kết luận các hành vi này đã đạt.
- Bước tiếp theo: người dùng chạy preflight trên `BAOTRI-Mini-Test`, gửi ba bảng kết quả; từ đó thiết kế test có fixture an toàn, không dùng UUID/email giả định và không chạm Production.


## Cập nhật 17/11/2026 – chuẩn bị bộ kiểm thử CRUD RLS theo Auth user

- Người dùng đã xác nhận Migration 006 và smoke test Migration 006 chạy thành công trên BAOTRI-Mini-Test.
- Kiểm tra thực tế do người dùng thao tác: Viewer đọc được bảng `assets`; thao tác INSERT nhận lỗi PostgreSQL `42501: new row violates row-level security policy`, đúng với kỳ vọng.
- Các lần thử UPDATE tiếp theo chưa thu được kết quả xác định do SQL Editor chỉ hiển thị kết quả trung gian của `set_config`; không ghi nhận UPDATE/DELETE là đạt.
- Đã rà soát lại Migration 002, 005, 006: policy `assets` yêu cầu lần lượt `assets.view/create/update/delete`; role Technician được cấp view/create/update nhưng không delete; Viewer chỉ có quyền view; Admin được cấp toàn bộ permission catalog.
- Đã tạo file `supabase/tests/20261117000800_authenticated_asset_crud_rls_test.sql` trên `main`. File dựng fixture thiết bị trong transaction, chuyển sang `authenticated`, mô phỏng lần lượt JWT của Viewer/Technician/Admin, kiểm tra SELECT/INSERT/UPDATE/DELETE và trả về một bảng kết quả PASS/FAIL duy nhất. Cuối script có `ROLLBACK` để không lưu fixture hay thay đổi dữ liệu.
- File test đã được fetch lại từ GitHub để xác nhận nội dung sau khi tạo; commit tạo và hiệu chỉnh: `35a4bd653867108e312f7d8865f4b07090fe8cfa`, `39b51af67ff9330113d1d58923fac5cd2588ea10`.
- **Chưa chạy file test 008 trên Supabase Test.** Chỉ chạy trên BAOTRI-Mini-Test, tuyệt đối không chạy trên Production. Chưa kết luận UPDATE/DELETE của Viewer hoặc CRUD Technician/Admin đã được xác minh bằng database.


## Cập nhật 17/11/2026 – Kết quả kiểm thử CRUD thiết bị và chuẩn bị kiểm thử các phân hệ

- Người dùng đã chạy file `supabase/tests/20261117000800_authenticated_asset_crud_rls_test.sql` trên BAOTRI-Mini-Test và xác nhận bảng kết quả trả về **PASS toàn bộ**.
- Ghi nhận kiểm thử thực tế bảng `assets`: Viewer SELECT được và bị chặn INSERT/UPDATE/DELETE; Technician INSERT/UPDATE được, DELETE bị chặn; Admin INSERT/UPDATE/DELETE được.
- Đã tạo file `supabase/tests/20261117000900_business_modules_rls_integration_test.sql` trên `main` để mở rộng kiểm thử sang 11 bảng nghiệp vụ: assets, inventory_items, maintenance_tasks, maintenance_plans, checklist_templates, checklist_template_versions, checklist_results, maintenance_logs, inventory_movements, asset_images và organization_settings.
- Script 009 tạo fixture trong transaction, mô phỏng JWT của Viewer/Technician/Admin, kiểm tra quyền đọc và một số thao tác ghi/khóa theo ma trận đã thiết kế; cuối script có ROLLBACK. Không bật/tắt RLS và chỉ chạy trên BAOTRI-Mini-Test.
- Các trường hợp được kiểm tra trong script 009 gồm: Viewer chỉ đọc; Technician quản lý vật tư/công việc/kế hoạch và tạo kết quả Checklist/nhật ký nhưng không sửa mẫu Checklist/cấu hình hoặc xóa; không cho INSERT trực tiếp inventory_movements khi chưa có RPC nguyên tử; Admin sửa mẫu Checklist, cấu hình và xóa vật tư.
- Commit file test 009: `407cba99be196207bea4a1a862afa6adb9ec969d`; commit hiệu chỉnh để các phép thử từ chối dùng bản ghi fixture đã tồn tại, tránh báo PASS giả do lỗi khóa ngoại: `0d84ee8ac197a2d2e69f87a06e70a6637f949b55`.
- **File test 009 mới chỉ được tạo và rà soát mã; người dùng chưa chạy trên Supabase Test. Không ghi nhận PASS cho các phân hệ này cho đến khi nhận được bảng kết quả thực tế.**


- Hiệu chỉnh script test 009 sau lần chạy đầu: phép thử Admin DELETE vật tư trước đó cố xóa vật tư fixture đang được `inventory_movements` tham chiếu, nên bị FK `inventory_movements_item_fk` chặn. Đây là bảo vệ toàn vẹn dữ liệu đúng của schema, không phải lỗi RLS.
- Đã sửa phép thử: tạo một vật tư riêng không có lịch sử giao dịch, sau đó dùng vật tư đó kiểm tra quyền DELETE của Admin. Vật tư fixture có movement được giữ nguyên.
- Commit sửa: `a8ab0ab7bb4c26f6edbc0f300917977bfbdbe971`. Script 009 cần được chạy lại từ bản mới nhất trên BAOTRI-Mini-Test. Chưa ghi nhận kết quả PASS cuối cùng.


## Cập nhật 17/11/2026 – Kết quả kiểm thử tích hợp RLS 11 bảng nghiệp vụ (test 009)

- Người dùng đã chạy lại toàn bộ `supabase/tests/20261117000900_business_modules_rls_integration_test.sql` trên project `BAOTRI-Mini-Test` sau khi sửa lỗi fixture vật tư có lịch sử giao dịch; người dùng xác nhận **PASS toàn bộ**.
- Ghi nhận bài test tích hợp 009 đã chạy trọn vẹn và tất cả các assertion có trong script đều đạt: Viewer đọc được 11 bảng và bị chặn các thao tác ghi được kiểm tra; Technician thực hiện được các thao tác nghiệp vụ được cấp, bị chặn các thao tác ngoài quyền; Admin thực hiện được các thao tác quản trị được kiểm tra.
- Lỗi FK `inventory_movements_item_fk` ở lần chạy trước đã được xử lý đúng bằng cách dùng vật tư fixture riêng không có lịch sử giao dịch để kiểm tra DELETE; vật tư đang được movement tham chiếu không bị xóa.
- Phạm vi xác nhận: các trường hợp được viết trong test 009, không đồng nghĩa đã kiểm thử exhaustive mọi thao tác CRUD/cột trên cả 11 bảng. Chưa kiểm thử đầy đủ suspended membership, cross-organization/tenant isolation, quản trị role/user qua backend, RPC nhập/xuất kho hoặc CRUD cloud từ frontend.
- File test 009: [supabase/tests/20261117000900_business_modules_rls_integration_test.sql](https://github.com/Vodanhhp/DuAn_BaoTRi/blob/main/supabase/tests/20261117000900_business_modules_rls_integration_test.sql). Chỉ chạy trên `BAOTRI-Mini-Test`; chưa áp dụng các kiểm thử/thay đổi này lên Production.


## Cập nhật 17/11/2026 – chuẩn bị kiểm thử suspended membership và tenant isolation (test 010)

- Đã rà soát lại Migration 001, 002, 005, 006 và test 009 trên nhánh `main`.
- Xác nhận `has_org_permission` yêu cầu membership có trạng thái `active`, organization có trạng thái `active`, role assignment còn hiệu lực, role đang active và permission được gán. Vì vậy membership suspended phải mất quyền nghiệp vụ dù member_roles vẫn còn.
- Đã tạo `supabase/tests/20261117001000_suspended_membership_tenant_isolation_test.sql` trên `main`.
- Test 010 tạo tenant B và asset fixture riêng trong transaction; không tạo membership cho ba tài khoản test trong tenant B. Tài khoản Admin chỉ có quyền trong tenant A được dùng để thử SELECT/UPDATE/DELETE/INSERT vào tenant B.
- Test 010 tạm chuyển membership Viewer hiện có ở tenant A sang `suspended`, giữ nguyên role assignment, rồi mô phỏng JWT authenticated để kiểm tra permission helper, SELECT, UPDATE và INSERT. Script có preflight để dừng nếu organization/profile/membership/Viewer role assignment không đúng trạng thái dự kiến.
- Các fixture, tenant B, asset kiểm thử và thay đổi trạng thái membership đều nằm trong transaction; script kết thúc bằng `ROLLBACK`. Không thay đổi migration/RLS policy, không dùng service role, không chạm Production.
- Đã fetch lại file test 010 từ GitHub và xác minh nội dung có các phép thử cần thiết cùng lệnh ROLLBACK. Commit tạo file: `86ae428b506a3a545574ebd92d14efb5cc45723a`.
- **Trạng thái: mới tạo và rà soát mã; chưa chạy trên Supabase. Chưa được ghi nhận PASS.**
- Bước tiếp theo: người dùng chạy toàn bộ file test 010 một lần trên `BAOTRI-Mini-Test`, gửi bảng kết quả. Chỉ khi nhận được kết quả mới kết luận suspended membership và tenant isolation đạt hay cần sửa.

## Cập nhật 17/11/2026 – kết quả test 010 và chuẩn bị test 011

- Người dùng xác nhận đã chạy `supabase/tests/20261117001000_suspended_membership_tenant_isolation_test.sql` trên `BAOTRI-Mini-Test` và **PASS toàn bộ**. Ghi nhận test 008, 009, 010 đều PASS theo xác nhận kết quả chạy thực tế của người dùng.
- Đã tạo `supabase/tests/20261117001100_unauthenticated_no_membership_permission_revoked_test.sql` trên nhánh `main`.
- Test 011 gồm ba nhóm:
  1. **Unauthenticated/anon:** kiểm tra SELECT bảng nghiệp vụ, gọi helper phân quyền và INSERT đều bị từ chối.
  2. **Authenticated nhưng không có membership tại tenant:** dùng tài khoản Technician hiện có ở Org A để thử quyền với Org B không có membership; kiểm tra helper trả false, SELECT không thấy dữ liệu, UPDATE không tác động dòng và INSERT bị RLS chặn.
  3. **Permission bị thu hồi:** tạm xóa đúng grant `assets.update` khỏi role Technician trong transaction; kiểm tra helper trả false và UPDATE không tác động dòng.
- Test có preflight xác nhận tài khoản, membership, role assignment và permission ban đầu; tạo fixture trong transaction và kết thúc bằng `ROLLBACK`, nên permission bị thu hồi tạm thời và fixture sẽ được hoàn nguyên.
- Đã fetch lại file test 011 từ `main` và kiểm tra có đủ ba nhóm, cảnh báo chỉ chạy Test và lệnh ROLLBACK. Commit tạo file: `cd53608b683be3655fd4f6905a4ce8cf5bd5c093`.
- **Trạng thái test 011: đã tạo và rà soát mã, CHƯA chạy trên Supabase; chưa được ghi nhận PASS.**
- Chỉ chạy file test 011 trên project `BAOTRI-Mini-Test`, tuyệt đối không chạy trên Production. Sau khi người dùng xác nhận kết quả, mới kết luận và chuyển sang bước tiếp theo.

## Cập nhật 17/11/2026 – kết quả test bảo mật 011

- Người dùng xác nhận đã chạy toàn bộ `supabase/tests/20261117001100_unauthenticated_no_membership_permission_revoked_test.sql` trên `BAOTRI-Mini-Test` và **PASS toàn bộ**.
- Ba nhóm kiểm tra đều đạt theo xác nhận của người dùng:
  1. **Unauthenticated/anon:** bị từ chối SELECT dữ liệu nghiệp vụ, gọi helper phân quyền và INSERT.
  2. **Authenticated không có membership tại tenant:** không đọc được asset tenant B, UPDATE không tác động dòng và INSERT bị RLS chặn.
  3. **Permission bị thu hồi:** helper không còn cấp `assets.update`, UPDATE không tác động dòng.
- Script chạy trong transaction và kết thúc bằng `ROLLBACK`; fixture và grant bị thu hồi tạm thời được hoàn nguyên.
- **Kết luận vòng kiểm thử bảo mật cơ bản:** người dùng xác nhận test 008, 009, 010 và 011 đều PASS trên `BAOTRI-Mini-Test`. Đây là các trường hợp assertion được bao phủ trong bốn script, không phải chứng nhận exhaustive mọi API, mọi cột hoặc mọi đường truy cập.
- Không có migration/policy mới được áp dụng trong test 011. Không thay đổi Production.
- **Bước tiếp theo:** rà soát luồng dữ liệu và thao tác CRUD của phân hệ thiết bị trong `src/App.tsx`, thiết kế một vertical slice cloud cho Assets (đọc danh sách, thêm, sửa, xóa theo permission; giữ nguyên UUID và organization_id), có kiểm tra lỗi và không làm mất dữ liệu IndexedDB. Chỉ triển khai sau khi đối chiếu đầy đủ schema và luồng hiện tại; không bật đồng bộ toàn bộ cùng lúc.

## Cập nhật 17/11/2026 – rà soát trước khi triển khai Cloud CRUD phân hệ Thiết bị

### Kết quả đối chiếu mã nguồn hiện tại

- Đã fetch và rà soát phiên bản mới nhất của `src/App.tsx`, `src/db.ts`, `src/lib/supabase.ts`, `package.json`, Migration 002 và Migration 006 trên `main`.
- `src/App.tsx` hiện lấy danh sách Thiết bị từ `db.assets` (Dexie/IndexedDB); các thao tác thêm/sửa, đổi trạng thái, lưu kho và khôi phục đều ghi vào IndexedDB và `syncQueue`. Chưa có CRUD cloud cho dữ liệu Thiết bị.
- Ứng dụng hiện tự seed 30 thiết bị mẫu vào IndexedDB khi mở workspace; các phân hệ local khác cũng đang dùng danh sách thiết bị này. Vì vậy, không được thay nguồn dữ liệu toàn ứng dụng sang Supabase hoặc tự động đẩy dữ liệu local/demo lên cloud trong đợt Assets.
- Hiện có nút thử nghiệm riêng ghi một bản ghi `TEST-CLOUD-*` lên Supabase; đây chỉ là kiểm tra kết nối, không phải CRUD nghiệp vụ.
- UI Thiết bị hiện có thao tác thêm, sửa, đổi trạng thái, lưu kho và khôi phục. Xóa vĩnh viễn đang bị vô hiệu hóa; không được tự mở chức năng xóa cứng chỉ vì database có policy delete.
- Custom category và mã loại thiết bị hiện lưu trong localStorage; chưa có luồng đọc/ghi cấu hình danh mục từ `organization_settings.asset_categories`.

### Đối chiếu schema cloud

- Bảng `assets` có các trường lõi: `id`, `organization_id`, `code`, `name`, `category`, `brand`, `model`, `serial`, `location`, `commissioned_at`, `power`, `cycle`, `cycle_started_at`, `transferred_from_other_facility`, `status`, `notes`, `archived_at`, `created_at`, `updated_at`.
- Cần ánh xạ rõ tên trường camelCase ở frontend sang snake_case ở PostgreSQL; giữ nguyên UUID hiện có khi một hồ sơ được tạo trên cloud.
- `images: string[]` trong kiểu Asset hiện tại không phải cột của bảng `assets`. Migration 002 chỉ tạo metadata `asset_images` trỏ tới `storage_path`; byte ảnh phải được xử lý qua Supabase Storage. Chưa thấy migration tạo Storage bucket/policy hoàn chỉnh. Vì vậy không được bỏ ảnh data URL khỏi hồ sơ khi ghi cloud hoặc giả vờ ảnh đã được đồng bộ.
- RLS Migration 006 đã bảo vệ `assets` bằng các permission `assets.view/create/update/delete`; frontend chỉ dùng publishable key và session người dùng, không có service-role key.

### Các điều kiện kỹ thuật cần giải quyết trước khi bật đủ thao tác tạo mới

1. Mã thiết bị hiện được cấp bằng cách lấy số lớn nhất từ danh sách local rồi cộng 1. Tài liệu quyết định trước đó đã yêu cầu chuyển cấp số sang PostgreSQL RPC/transaction khi triển khai cloud; unique constraint `(organization_id, code)` chỉ ngăn trùng chứ không thay thế cơ chế cấp số an toàn. Không được tái sử dụng thuật toán cấp số local làm cơ chế cloud.
2. Cơ sở nhận thiết bị hiện đang hard-code `HP01`; danh mục loại/mã loại tùy chỉnh lại nằm trong localStorage. Cần xác định nguồn cấu hình cloud theo từng organization trước khi RPC cấp mã được thiết kế, tránh hard-code cấu hình cá nhân vào ứng dụng SaaS.
3. Ảnh cần một luồng Storage riêng và phải giữ metadata theo `asset_images`; chưa triển khai upload ảnh trong vertical slice đầu tiên nếu bucket/policy chưa được rà soát.
4. Tạm thời giữ nguyên IndexedDB và các phân hệ phụ thuộc dữ liệu local. Phần Assets cloud phải được cô lập rõ, không tự import 30 hồ sơ demo, không ghi đè/xóa dữ liệu local và không tự động đồng bộ các bảng nghiệp vụ khác.

### Phạm vi triển khai kế tiếp

- Tách nguồn dữ liệu cloud của riêng màn hình Thiết bị khỏi các phân hệ vẫn dùng IndexedDB.
- Xây dựng repository/service cloud cho đọc danh sách, ánh xạ dữ liệu và cập nhật các trường lõi; mọi truy vấn phải gắn `organization_id` động lấy từ membership/session, đồng thời để RLS là lớp bảo vệ cuối cùng.
- Bổ sung cơ chế cấp mã cloud an toàn bằng RPC/transaction và cấu hình danh mục/cơ sở theo organization trước khi bật tạo mới.
- Giữ hành vi lưu kho/khôi phục là cập nhật `archived_at`; không mở xóa cứng trong UI ở giai đoạn này.
- Xử lý ảnh như một hạng mục riêng qua Storage; cho đến khi hoàn tất, phải thông báo rõ trạng thái ảnh và không tuyên bố đã đồng bộ ảnh.
- Chỉ sau khi hoàn tất code mới yêu cầu người dùng build/chạy thử trên môi trường Test. Không áp dụng migration hoặc thay đổi Production trong bước này.
- Tại thời điểm cập nhật: đây là kết quả rà soát và thiết kế phạm vi; chưa sửa mã nguồn ứng dụng, chưa chạy build và chưa có CRUD cloud Assets được nghiệm thu.

## Cập nhật 17/11/2026 – vertical slice Cloud Assets bước 1 (đọc dữ liệu)

- Tạo `src/lib/assetsCloud.ts`: repository đọc danh sách thiết bị theo `organization_id` động; ánh xạ snake_case PostgreSQL sang kiểu `Asset`; hỗ trợ cập nhật trường hồ sơ và lưu kho/khôi phục mềm qua Supabase; không có hàm xóa cứng.
- Tạo `src/CloudAssetsPanel.tsx`: màn hình đọc riêng danh sách thiết bị Cloud, có tải lại, trạng thái lỗi/tải và thống kê đang quản lý/lưu kho.
- Tích hợp vào `src/App.tsx` bằng nút **Xem dữ liệu Cloud** trong màn hình Thiết bị. Màn hình local IndexedDB vẫn là mặc định và được giữ nguyên; người dùng có thể quay lại dữ liệu cục bộ.
- Mọi truy vấn repository đều lọc theo `organization_id` được truyền từ organization context sau đăng nhập; RLS trên Supabase tiếp tục là lớp kiểm soát quyền cuối cùng.
- Không đọc/ghi Dexie trong repository Cloud; không đụng `syncQueue`; không seed/import 30 thiết bị mẫu; không thay đổi dữ liệu local; không thay đổi Production.
- Dữ liệu ảnh chưa được lấy từ Storage; danh sách Cloud hiện để `images: []` trong model trình bày. Chưa có thao tác tạo mới vì cấp mã thiết bị cloud cần RPC/transaction an toàn và cấu hình cơ sở/danh mục theo organization. Chưa bật nút sửa, đổi trạng thái, lưu kho hoặc khôi phục trong UI Cloud dù repository đã có hàm cập nhật nền; cần kiểm thử quyền và dữ liệu trước khi mở thao tác.
- Chưa chạy được build TypeScript/Vite trong môi trường hiện tại; các thay đổi đã được fetch lại từ `main` để xác minh nội dung. Cần build và kiểm thử thực tế trên BAOTRI-Mini-Test trước khi nghiệm thu.
- Các commit:
  - Repository: `bd7ce78d78e9d783111ca7bde9487aeed3bf8a47`
  - Cloud panel: `d0d36b67c451e525b10854490cc328e91cc60b47`
  - Điều hướng quay lại: `8f336f01b44f516400df56ec23993b60658e0c3c`
  - Tích hợp màn hình Cloud riêng: `6a9496719dc0ab4ba87d8c53b5ed1d06ca072d55`
- **Trạng thái:** hoàn thành bước đọc Cloud Assets ở mức code; chưa nghiệm thu build/runtime. Bước tiếp theo là kiểm thử build và đọc dữ liệu trên Test, sau đó triển khai RPC cấp mã thiết bị cloud an toàn trước khi bật tạo mới.

## Cập nhật 17/11/2026 – thiết kế và tạo RPC cấp mã thiết bị Cloud (Migration 012)

- Đối chiếu tài liệu quy ước mã thiết bị và mã nguồn thực tế: cấu trúc mã là `ABC-ABXY-xxx-BB-MM-YY`, số thứ tự tăng theo từng mã ABC trong phạm vi toàn tổ chức, không khởi động lại theo cơ sở; có dấu `*` khi thiết bị chuyển đến.
- Phát hiện các cấu hình hiện tại (`HP01`, mã loại và mã vị trí) đang lấy từ hằng số/localStorage ở trình duyệt. Không được dùng nguyên trạng làm cấu hình Cloud đa doanh nghiệp.
- Tạo Migration `supabase/migrations/20261117001200_asset_code_allocator_rpc.sql`:
  - Bổ sung `organization_settings.asset_code_config` để lưu cấu hình riêng từng tổ chức: `facility_code`, `category_codes`, `location_codes`; dùng khóa `__UNASSIGNED__` cho vị trí chưa phân loại.
  - Tạo bảng bộ đếm `asset_code_counters`, khóa theo `organization_id + category_code`; client không được đọc/ghi trực tiếp.
  - Tạo RPC `create_asset_with_code`: kiểm tra đăng nhập và permission `assets.create`, lấy cấu hình từ DB, cấp số bằng UPSERT có khóa hàng để tuần tự hóa các yêu cầu đồng thời, tạo mã và INSERT thiết bị trong cùng transaction. Có thể truyền UUID để bảo toàn ID khi cần; nếu không truyền, DB sinh UUID.
  - Thu hồi quyền INSERT trực tiếp trên bảng `assets` khỏi role `authenticated`; mọi tạo thiết bị từ client phải đi qua RPC để không thể bỏ qua bộ cấp mã. RLS vẫn bảo vệ SELECT/UPDATE/DELETE.
  - Migration không tự cấu hình mã cơ sở, không import Local, không sửa thiết bị hiện có và không thay đổi Production.
- Tạo test `supabase/tests/20261117001200_asset_code_allocator_rpc_test.sql`: kiểm tra bảo toàn UUID, định dạng mã, tăng số thứ tự liên tiếp giữa Admin/Technician và từ chối Viewer; cấu hình HP01/MNA/01 chỉ là fixture trong transaction của BAOTRI-Mini-Test; cuối script ROLLBACK.
- Cập nhật test 008 `supabase/tests/20261117000800_authenticated_asset_crud_rls_test.sql` để phản ánh thiết kế mới: direct INSERT bị chặn; Technician/Admin tạo qua RPC; tiếp tục kiểm tra UPDATE/DELETE theo quyền. Test 009 tạo fixture assets trước khi chuyển role authenticated nên không bị ảnh hưởng bởi việc thu hồi INSERT trực tiếp.
- Các commit mới:
  - Migration 012: `2b895424ee747f8923161812c24c2bcc7b72ce65`, hiệu chỉnh bắt buộc tạo qua RPC: `97249de22165ebeb6a3459c282683412bd47af5c`.
  - Test 012: `5b2c8960d3756b4b4f718a747decf76cdd783a1d`.
  - Cập nhật test 008: `1b61b24d91d9406eb2a978c1c66f848ff472e2a1`.
- Đã fetch lại các file từ `main` để xác minh nội dung sau commit.
- **Trạng thái: mới tạo và rà soát mã SQL; CHƯA áp dụng Migration 012, CHƯA chạy test 008 phiên bản mới hoặc test 012 trên Supabase Test.** Chưa tạo UI cấu hình mã theo tổ chức và chưa bật nút tạo thiết bị Cloud. Chỉ tiếp tục sau khi Migration 012 và hai test được người dùng xác nhận đạt trên BAOTRI-Mini-Test.

## Cập nhật 17/11/2026 – xác nhận Migration 012 và giao diện tạo Cloud Assets

- Người dùng xác nhận đã chạy Migration 012 trên BAOTRI-Mini-Test thành công (SQL Editor báo successful); test 008 bản cập nhật và test 012 đều PASS toàn bộ.
- Từ xác nhận này, bộ cấp mã Cloud trên Test được xem là đã nghiệm thu ở mức SQL/RLS. Chưa có thao tác nào trên Production.
- Phát hiện nút thử nghiệm Cloud cũ trong `src/App.tsx` vẫn INSERT trực tiếp vào `assets`, không còn phù hợp sau khi Migration 012 thu hồi quyền INSERT trực tiếp. Đã xóa nút, state, truy vấn và helper thử ghi trực tiếp để tránh tạo đường thao tác lỗi thời. Bản ghi thử nghiệm đã có trên Test được giữ nguyên.
- Mở rộng `src/lib/assetsCloud.ts`:
  - Đọc/lưu cấu hình mã `organization_settings.asset_code_config`.
  - Tạo hồ sơ qua RPC `create_asset_with_code`, truyền UUID mới và các trường hồ sơ; không tự cấp mã ở client.
- Mở rộng `src/CloudAssetsPanel.tsx`:
  - UI cấu hình mã cơ sở, danh mục mã loại và mã vị trí theo tổ chức (dòng `Tên|MÃ`); lưu bằng quyền settings của Supabase.
  - UI tạo mới Cloud khi đã có cấu hình; chọn loại/vị trí từ cấu hình Cloud và gọi RPC để cấp mã/tạo hồ sơ.
  - Local IndexedDB, 30 thiết bị mẫu và syncQueue không bị thay đổi; không tự import dữ liệu Local.
  - Chỉnh sửa, lưu kho/khôi phục, ảnh vẫn chưa bật trên Cloud.
- Các commit mới:
  - Xóa direct Cloud test insert cũ: `16161ea94239d01a9f3402ebc5826539df1e5970`.
  - Repository cấu hình và RPC create: `ed01c388ff465f64c28485eaf1b7785b1db367f2`.
  - UI cấu hình và tạo Cloud: `3fe671ae6844acc4cbf28a2beaff57dd1f291978`.
- Đã fetch file từ `main` trước mỗi lần sửa; cần fetch xác minh cuối cùng và người dùng cần chạy `npm.cmd run build` cùng kiểm thử giao diện trên localhost/Test.
- **Trạng thái:** SQL Migration 012 + test 008/012 đã PASS theo xác nhận người dùng. Code UI cấu hình/tạo Cloud vừa cập nhật nhưng CHƯA build và CHƯA kiểm thử runtime; chưa bật sửa/lưu kho/khôi phục; không thay đổi Production.

## Cập nhật 17/11/2026 – Cloud Assets: sửa hồ sơ, lưu kho và khôi phục

- Mở giao diện thao tác cho phân hệ Cloud Assets, tách danh sách **Đang quản lý** và **Đã lưu kho**.
- Bổ sung sửa các trường hồ sơ được phép: tên, vị trí, ngày đưa vào sử dụng, hãng, model, serial, công suất, chu kỳ bảo trì, trạng thái và ghi chú.
- Mã thiết bị và loại thiết bị hiển thị chỉ đọc, không cho sửa trong form để giữ nguyên mã đã cấp và tránh làm lệch quy tắc định danh. Ảnh Cloud chưa triển khai; không chỉnh sửa hoặc đồng bộ ảnh trong bước này.
- Bổ sung lưu kho/khôi phục bằng cập nhật mềm trường `archived_at`; có hộp xác nhận trước khi thực hiện. Không có thao tác xóa cứng.
- Giao diện chỉ hiển thị thao tác sửa/lưu kho/khôi phục cho role Admin và Technician; Viewer chỉ xem. Đây chỉ là lớp UX, RLS `assets.update` của Supabase vẫn là lớp kiểm soát quyền cuối cùng cho mọi yêu cầu ghi.
- Đã truyền `organizationRole` từ context đăng nhập vào CloudAssetsPanel. Repository dùng lại `updateCloudAsset` và `setCloudAssetArchived` đã có; không thay đổi schema hoặc migration.
- Đã fetch lại file trên `main` sau commit và kiểm tra: JSX form không còn chuỗi newline lỗi, nút sửa/lưu kho/khôi phục có mặt, không có hàm xóa cứng, không có tham chiếu Dexie/IndexedDB/syncQueue trong Cloud panel.
- Các commit:
  - Cloud UI sửa/lưu kho/khôi phục: `78b9703cfb47dab7d0e59ce9902c6683b8701290`
  - Truyền role từ App: `ef986cdf84384e469d9066c6d7481329d055477f`
  - Sửa định dạng JSX form: `30c923deabe40eb9e047f84fd5c10307ffd1963b`
- **Trạng thái:** code đã cập nhật và fetch xác minh trên `main`; CHƯA chạy `npm.cmd run build` và CHƯA kiểm thử runtime. Chưa thao tác sửa/lưu kho/khôi phục trên dữ liệu Supabase thực tế. Chỉ kiểm thử trên `BAOTRI-Mini-Test`; không thay đổi Production.
- Bước tiếp theo: người dùng pull `main`, chạy build; sau đó kiểm tra với tài khoản Admin/Technician/Viewer trên Test. Xác nhận cập nhật nội dung, lưu kho biến mất khỏi danh sách đang quản lý, khôi phục xuất hiện lại đúng hồ sơ và mã thiết bị không thay đổi.

### Sửa lỗi nút thao tác Cloud bị ẩn do kiểm tra role sai – 17/11/2026

- Nguyên nhân: CloudAssetsPanel so sánh chuỗi role hiển thị `Admin`/`Technician`, trong khi App truyền `organization_members.role` dạng legacy chữ thường (`admin`/`user`). Không thể dùng trường role legacy để phân biệt chính xác Technician và Viewer.
- Đã bỏ điều kiện UI suy luận theo tên role. CloudAssetsPanel gọi RPC `has_org_permission` trực tiếp với `assets.update` và `assets.create`, theo đúng cơ chế phân quyền RLS hiện có.
- Nếu RPC lỗi/không xác định được quyền, giao diện fail-closed: ẩn thao tác ghi và chỉ xem. Quyền lưu kho/khôi phục/sửa phụ thuộc `assets.update`; nút tạo phụ thuộc `assets.create`.
- Commit: `f0d703d745ad3128d226054f2a0a6ff099c59750`.
- Đã fetch lại file trên main, kiểm tra RPC và các điều kiện hiển thị. Chưa chạy build hoặc kiểm thử runtime sau sửa; cần người dùng pull main và build.


### Phân quyền cấu hình mã thiết bị Cloud – cập nhật 17/11/2026
- Phát hiện: tài khoản Viewer vẫn nhìn thấy và mở được biểu mẫu cấu hình mã thiết bị, dù không có quyền thay đổi cấu hình doanh nghiệp.
- Quy tắc đúng: chỉ Admin có quyền `settings.manage` mới được thấy nút cấu hình và mở/lưu biểu mẫu. Technician và Viewer không được thay đổi cấu hình mã dùng chung.
- Đã sửa `src/CloudAssetsPanel.tsx`: kiểm tra quyền `settings.manage` trực tiếp qua RPC `has_org_permission`; ẩn nút và biểu mẫu khi không có quyền; chặn thêm ở hàm lưu cấu hình. Quyền ghi cuối cùng vẫn do RLS Supabase bảo vệ.
- Commit: `48402b2ae9c75387eb2877b8703b3c57963d1e58` trên nhánh `main`.
- Chưa chạy build hoặc kiểm thử bằng tài khoản Viewer/Admin sau thay đổi. Cần pull, build, đăng nhập Viewer xác nhận không còn nút cấu hình; đăng nhập Admin xác nhận nút và thao tác lưu vẫn hoạt động.


### Quy tắc Viewer chỉ xem trên toàn bộ ứng dụng – thống nhất 17/11/2026
- Người dùng xác nhận: vai trò Viewer chỉ được xem, không được thực hiện thao tác thay đổi dữ liệu hoặc nghiệp vụ trên toàn bộ ứng dụng, áp dụng cả khu vực dữ liệu Local và Cloud.
- Các thao tác Viewer phải bị vô hiệu hóa và hiển thị mờ/disabled, không chỉ ẩn nút:
  - Thực hiện Checklist và tạo phiếu kết quả.
  - Xuất Excel.
  - Thêm, sửa, xóa vật tư; nhập, xuất và điều chỉnh kho.
  - Sao lưu dữ liệu.
  - Thêm, sửa, xóa hoặc thay đổi dữ liệu nghiệp vụ ở mọi phân hệ Local.
  - Các thao tác ghi tương ứng ở Cloud.
- Viewer vẫn được xem danh sách, chi tiết, lịch sử, Checklist đã có và báo cáo theo quyền xem.
- Admin và Technician tiếp tục sử dụng chức năng theo quyền hiện hành; không khóa chung các vai trò này.
- Đây là quy tắc phân quyền giao diện và nghiệp vụ cần triển khai đồng bộ. Không được coi việc làm mờ nút là lớp bảo mật duy nhất: các thao tác ghi Cloud vẫn phải bị RLS/RPC kiểm soát ở Supabase. Với Local, cần chặn cả handler/luồng ghi, không chỉ CSS hoặc disabled nút.
- Trạng thái: đã thống nhất yêu cầu, chưa triển khai code và chưa kiểm thử.


### Triển khai Viewer chỉ xem trên toàn bộ ứng dụng – 17/11/2026
- Đã triển khai trên nhánh `main` sau khi người dùng xác nhận áp dụng cho Viewer; Admin và Technician không bị khóa bởi thay đổi này.
- `src/App.tsx`: nhận diện role Viewer; khóa thao tác thêm/sửa thiết bị, thay đổi trạng thái/lưu kho/khôi phục thiết bị, thêm/sửa vật tư, nhập/xuất kho, thêm/sửa/hoàn thành công việc, sửa/xóa kế hoạch, tạo/cập nhật phiếu bảo dưỡng – sửa chữa và thao tác ghi Checklist. Các handler ghi dữ liệu đều có chặn Viewer, không chỉ dựa vào trạng thái nút.
- Viewer không thể thực hiện Checklist, sửa biểu mẫu, tạo phiếu Checklist, tạo phiếu sửa chữa từ Checklist, xuất Excel, sao lưu hoặc khôi phục bản sao lưu. Các nút thao tác tương ứng bị disabled/làm mờ; lịch sử, danh sách, dữ liệu chi tiết và nội dung biểu mẫu Checklist hiện có vẫn cho phép xem. In/tra cứu không bị khóa chỉ vì là Viewer.
- Phân hệ Cloud Assets tiếp tục dùng kiểm tra permission/RLS hiện có; thay đổi này tập trung khóa các luồng Local vốn trước đó chưa kiểm tra role.
- `src/style.css`: bổ sung kiểu disabled màu mờ, con trỏ không cho thao tác; vô hiệu hóa vùng chọn file khôi phục sao lưu.
- Các commit triển khai: `6851d3b`, `81fc8ea`, `70fdc9a`, `565c13e`.
- Trạng thái kiểm tra: đã rà soát mã nguồn và xác nhận các handler chính có guard. Chưa chạy `npm.cmd run build` hoặc kiểm thử giao diện trên máy người dùng; cần người dùng pull và build/test Admin, Technician, Viewer trước khi xác nhận hoàn tất.


### Sửa lỗi nhận diện Viewer và khóa nút thao tác – 17/11/2026
- Nguyên nhân lỗi trước: App đọc `organization_members.role` (legacy chỉ có `admin/user`) rồi so sánh với `viewer`; vì vậy tài khoản Viewer bị hiểu nhầm là user và `isViewer=false`.
- Đã sửa `src/App.tsx`: xác định vai trò hiệu lực bằng RPC `has_org_role` cho Admin/Viewer/Technician từ bảng phân vai thực tế. Nếu RPC lỗi hoặc không có vai trò hợp lệ, ứng dụng không mở Workspace thay vì mặc định cấp quyền Technician.
- Đã chỉnh Checklist: các nút tạo/sửa biểu mẫu và thực hiện Checklist luôn hiển thị nhưng disabled/làm mờ đối với Viewer; các handler lưu vẫn kiểm tra `allowActions`.
- Nút xuất kế hoạch Excel trong hộp thoại cũng bị khóa; các nút kho, sao lưu, khôi phục, xuất Excel và thao tác nghiệp vụ khác dùng trạng thái `isViewer` sau khi vai trò được xác định đúng.
- Commit sửa vai trò: `30637a0`; commit hiển thị nút Checklist disabled: `7ec8754`.
- Trạng thái: đã rà soát mã nguồn sau commit. Chưa chạy build và chưa kiểm thử trên trình duyệt thực tế; cần pull/build và đăng nhập đúng tài khoản được gán role Viewer để xác nhận.


## Xây dựng phân hệ Quản lý tài khoản trong ứng dụng – 17/11/2026

- Người dùng xác nhận ba tài khoản thử nghiệm hiện có đã hoạt động đúng vai trò Admin, Technician và Viewer; yêu cầu tiếp theo là Admin có thể thêm tài khoản Technician/Viewer ngay trong BAOTRI Mini.
- Phạm vi đợt đầu:
  - Bổ sung khu vực **Quản lý tài khoản** trong Cài đặt, chỉ Admin được truy cập.
  - Admin nhập email và chọn vai trò Kỹ thuật viên hoặc Người xem; không cho tạo thêm Admin từ giao diện.
  - Nếu email chưa có tài khoản trong Supabase Project: gửi email mời, người nhận tự xác thực và thiết lập mật khẩu. Membership ở trạng thái `invited`, chỉ chuyển `active` sau khi xác nhận email.
  - Nếu email đã có Auth user hợp lệ trong chính Supabase Project nhưng chưa là thành viên tổ chức: thêm vào tổ chức với vai trò đã chọn.
  - Hiển thị email, vai trò và trạng thái; Admin được đổi giữa Technician/Viewer, tạm khóa và mở lại thành viên. Không xóa Auth user hoặc dữ liệu lịch sử; không cho quản lý/đổi vai trò Admin khác hoặc tự khóa tài khoản Admin đang đăng nhập.
  - Technician và Viewer không nhìn thấy khu vực quản lý và mọi thao tác backend phải kiểm tra quyền `users.manage`.
- Ranh giới bảo mật:
  - Không đưa `service_role` key vào frontend. Mọi thao tác Auth Admin chạy trong Supabase Edge Function, xác thực JWT người gọi và kiểm tra `has_org_permission(organization_id, 'users.manage')`.
  - Các thao tác ghi membership/role/status chạy qua RPC nội bộ chỉ cấp EXECUTE cho `service_role`; role code được giới hạn `technician` hoặc `viewer`.
  - Bổ sung email vào `profiles` để Admin xem danh sách thành viên cùng tổ chức; RLS chỉ cho thành viên active cùng tổ chức xem hồ sơ thành viên trong tổ chức.
  - Khi người nhận xác thực email mời, trigger chuyển membership `invited` thành `active`. Khóa thành viên bằng `status='suspended'`, không xóa dữ liệu.
- Phạm vi môi trường: chỉ xây và kiểm thử trên BAOTRI-Mini-Test. Không thay đổi Production, không tác động ba tài khoản thử nghiệm hiện có, không chuyển dữ liệu Local lên Cloud.
- Đã tạo Migration 013 `supabase/migrations/20261117001300_member_management.sql`: đồng bộ email vào profiles, hiển thị hồ sơ thành viên cùng tổ chức kể cả trạng thái invited/suspended, tự kích hoạt membership khi email xác nhận, RPC service_role-only để tạo membership/đổi vai trò/khóa-mở tài khoản. RPC giới hạn role ở Technician/Viewer, không cho đổi vai trò hoặc tự khóa Admin; có khóa hàng auth.users để xử lý race giữa xác nhận email và tạo membership.
- Đã tạo Edge Function `supabase/functions/manage-organization-members/index.ts`: xác thực JWT người gọi, kiểm tra `users.manage`, dùng Auth Admin API để mời email hoặc nhận tài khoản đã xác thực trong cùng project, và gọi RPC backend để quản lý membership. Không đưa service_role key vào frontend.
- Luồng mời mới gắn metadata `must_set_password=true`; sau khi bấm liên kết xác nhận email, app hiển thị màn hình thiết lập mật khẩu bắt buộc trước khi vào Workspace. Sau khi đặt mật khẩu thành công, metadata được cập nhật để không hỏi lại.
- Danh sách thành viên/email được tải qua chính Edge Function (action `list`), không đọc email trực tiếp từ frontend. Migration thu hồi quyền SELECT cột `profiles.email` khỏi role `authenticated`, chỉ cấp quyền đọc email cho `service_role`; các thành viên thường không thể tự truy vấn email đồng nghiệp qua API.
- Đã thêm UI `OrganizationMembersPanel` trong Cài đặt của Admin: thêm bằng email, chọn Technician/Viewer, xem danh sách, đổi vai trò, tạm khóa/mở lại. Không hiển thị cho Technician/Viewer; không có chức năng tạo Admin hoặc xóa lịch sử.
- Đã thêm test SQL `supabase/tests/20261117001300_member_management_test.sql` để kiểm tra ACL service_role, đồng bộ email, đổi vai trò, khóa/mở và chặn Admin tự đổi vai trò; test dùng transaction và ROLLBACK.
- Đã bổ sung CSS responsive cho form mời và bảng thành viên (`src/style.css`, commit `8b9aad5`). Test SQL đã loại bỏ thao tác `SET ROLE` trong khối DO và xác minh claim `service_role` trước khi gọi RPC (commit test cuối `878c00e`).
- Các commit chính: Migration 013 `b4cee903` (hiệu chỉnh race: `9e3e62e`, giới hạn email và cấp quyền đọc cho Edge Function: `0d628c3`, `8102b7a`, `636655e`), Edge Function `430d1c3` (hiệu chỉnh typing: `07f4412`, bổ sung danh sách Admin: `b3db27a`, bắt buộc thiết lập mật khẩu: `bb94825`, kiểu Map: `c926119`), UI `e8f9e30` (hiệu chỉnh: `8523706`, tải danh sách qua Edge Function: `5b113be`, màn hình đặt mật khẩu: `470df4a`, import icon: `f506ce9`, thông báo mời: `393d801`, hiệu lực đổi quyền: `7ed42b2`), test SQL `e49bde6` (hiệu chỉnh: `90e23ba`, `453e4db`, `e749539`, `878c00e`, kiểm tra email ACL: `a43b64c`, kiểm tra users.manage: `a48db33`).
- **Chưa áp dụng Migration 013 trên Supabase Test; chưa deploy Edge Function; chưa cấu hình SMTP/URL chuyển hướng; chưa chạy SQL test 013; chưa chạy build hoặc kiểm thử runtime.** Không thay đổi Production.
- Trước khi mời người thật, cần cấu hình SMTP gửi thư trong Supabase Auth và URL chuyển hướng được phép. Khi deploy Edge Function, dùng project ref Test `oyzhxgzltpdebpymuicb`; `SUPABASE_SERVICE_ROLE_KEY` chỉ dùng ở môi trường Edge Function, tuyệt đối không đưa vào Vite/frontend.


## Bổ sung Reset mật khẩu thành viên – 17/11/2026

- Người dùng yêu cầu Admin có thể hỗ trợ thành viên quên mật khẩu ngay trong **Cài đặt → Quản lý tài khoản**, áp dụng cho Technician/Viewer, không áp dụng cho bất kỳ tài khoản Admin nào.
- Quy tắc bảo mật: Admin chỉ gửi yêu cầu đặt lại mật khẩu qua email; không xem, tạo hoặc đặt mật khẩu thay người dùng. Thành viên tự mở liên kết email và tự nhập mật khẩu mới.
- Đã bổ sung nút **Reset mật khẩu** cho thành viên Technician/Viewer đã xác nhận email. Thành viên đang chờ xác nhận không hiển thị nút reset; tài khoản Admin không có nút này.
- Edge Function `manage-organization-members` bổ sung action `reset_password`: vẫn xác thực JWT và quyền `users.manage`; xác minh membership thuộc đúng tổ chức; đọc vai trò thực tế từ `member_roles/roles`; từ chối Admin và role không hợp lệ; chỉ gửi email cho Auth user đã xác nhận email; chuyển hướng về `APP_BASE_URL`.
- App bắt sự kiện Supabase Auth `PASSWORD_RECOVERY` và hiển thị màn hình **Đặt lại mật khẩu**, dùng lại form cập nhật mật khẩu hiện có; không yêu cầu người dùng biết mật khẩu cũ.
- Không cần migration SQL mới. Không thay đổi Production. Cần deploy lại Edge Function trên BAOTRI-Mini-Test và build/kiểm thử giao diện.
- Trạng thái lúc cập nhật: code đã cập nhật trên `main`; CHƯA chạy build và CHƯA deploy phiên bản Edge Function có action reset_password. Người dùng cần pull main, chạy `npm.cmd run build`, sau đó deploy lại Function lên Test và kiểm thử email reset.


## Bổ sung Xóa thành viên khỏi tổ chức – 17/11/2026

- Người dùng yêu cầu Admin có thể xóa Technician/Viewer khi nhân sự nghỉ việc.
- Chốt semantics an toàn: nút **Xóa khỏi tổ chức** chỉ gỡ membership và role assignments của người đó khỏi tổ chức hiện tại; KHÔNG xóa `auth.users`, KHÔNG xóa `profiles`, KHÔNG xóa tài khoản Supabase toàn cục. Người đó mất quyền truy cập tổ chức do không còn membership; muốn quay lại phải được thêm/mời lại.
- Migration 014 tạo RPC `admin_remove_org_membership`, chỉ `service_role` được EXECUTE; từ chối tự xóa, từ chối xóa Admin và chỉ chấp nhận Technician/Viewer. Xóa membership làm FK cascade xóa role assignments; giữ nguyên Auth user và profile.
- Edge Function action `remove_member` vẫn kiểm tra JWT và `users.manage`, xác minh membership thuộc đúng organization và role assignment thực tế trước khi gọi RPC.
- UI Admin có nút **Xóa khỏi tổ chức** cho Technician/Viewer, kể cả thành viên đang chờ xác nhận email. Có confirm cảnh báo hậu quả; Admin không có nút này. Thành viên đã xóa được loại khỏi danh sách sau khi tải lại.
- Không xóa dữ liệu nghiệp vụ Local/IndexedDB trên trình duyệt. Vì BAOTRI Mini hiện vẫn giữ dữ liệu Local theo trình duyệt, việc gỡ membership không tự xóa dữ liệu Local trên thiết bị người đó; dữ liệu Cloud bị RLS từ chối khi không còn membership.
- Đã tạo SQL test Migration 014 kiểm tra quyền EXECUTE, chặn Admin tự xóa, gỡ membership/role assignments và bảo đảm profile/Auth user vẫn tồn tại; test dùng transaction + ROLLBACK.
- Trạng thái: mã nguồn cập nhật trên `main`; CHƯA build, CHƯA áp dụng Migration 014, CHƯA chạy SQL test 014 và CHƯA deploy lại Edge Function trên Test. Chỉ kiểm thử BAOTRI-Mini-Test; không thay đổi Production.


## Khắc phục luồng Reset mật khẩu – 17/11/2026

- Kiểm tra GitHub Actions: người dùng xác nhận lần triển khai mới nhất có tick xanh; frontend được triển khai tự động qua GitHub Pages.
- Rà soát code trên `main`: Edge Function đã gửi reset email với redirect về `APP_BASE_URL`; frontend chỉ mở form recovery khi nhận sự kiện `PASSWORD_RECOVERY`. Trường hợp SDK xử lý liên kết trước khi React đăng ký listener có thể làm mất sự kiện và khiến người dùng không thấy form.
- Điều chỉnh redirect reset email thành URL có dấu nhận diện `?flow=recovery`; frontend khởi tạo trạng thái recovery từ dấu này, vẫn giữ xử lý sự kiện `PASSWORD_RECOVERY` và xóa dấu nhận diện sau khi lưu mật khẩu thành công. Luồng mời tài khoản không thay đổi.
- Chỉ thay đổi Edge Function `manage-organization-members` và frontend `src/App.tsx`; không thay đổi schema, dữ liệu nghiệp vụ hoặc Production.
- **Cần triển khai lại Edge Function lên BAOTRI-Mini-Test và chờ GitHub Actions tự deploy frontend; sau đó gửi email reset mới để kiểm thử.** Email reset cũ không dùng để xác nhận bản sửa.


## Chuyển lịch bảo dưỡng định kỳ vào Bảo dưỡng – Sửa chữa và tinh gọn giao diện – 17/11/2026

- Đã chuyển lối vào **Lịch bảo dưỡng định kỳ** khỏi trang **Kế hoạch bảo trì** sang trang **Bảo dưỡng – Sửa chữa**. Tại trang Bảo dưỡng – Sửa chữa có nút mở Lịch bảo dưỡng định kỳ; tại màn hình lịch có nút quay lại Phiếu bảo dưỡng – sửa chữa.
- Trên menu desktop, khi đang ở Lịch bảo dưỡng định kỳ, mục **Bảo dưỡng – Sửa chữa** được đánh dấu đang chọn. Trên menu mobile, bỏ mục lịch định kỳ khỏi danh sách “Thêm”; người dùng mở lịch từ trang Bảo dưỡng – Sửa chữa.
- Giữ nguyên route nội bộ `tasks`, dữ liệu `tasks`, các handler thêm/sửa/hoàn thành, bộ lọc, xuất Excel và cấu trúc IndexedDB. Không di chuyển hoặc chuyển đổi dữ liệu.
- Tinh gọn phần đầu trang Bảo dưỡng – Sửa chữa và Lịch bảo dưỡng định kỳ: gom các nút thao tác thành cụm, giảm khoảng cách/padding bảng và bổ sung bố cục nút dọc trên điện thoại.
- Các commit trên `main`:
  - App điều hướng và nút chuyển qua lại: `c86412a`
  - CSS tinh gọn giao diện: `6bc7fb3`
- Trạng thái: đã cập nhật mã nguồn trực tiếp trên `main`; chưa chạy build và chưa kiểm thử giao diện trên trình duyệt. GitHub Actions cần hoàn tất build/deploy GitHub Pages trước khi kiểm tra thực tế. Không thay đổi Supabase, dữ liệu Cloud hoặc Production.


## Sửa lỗi nút tạo phiếu từ Lịch bảo dưỡng định kỳ – 17/11/2026

- Người dùng phản ánh nút “Phiếu bảo dưỡng – sửa chữa” chỉ điều hướng sang trang danh sách Bảo dưỡng – Sửa chữa, chưa mở biểu mẫu tạo phiếu như kỳ vọng.
- Đã đổi nút thành **“Tạo phiếu bảo dưỡng – sửa chữa”** và gọi trực tiếp luồng mở Modal tạo phiếu mới, khởi tạo dữ liệu rỗng theo đúng cấu trúc Log hiện có. Không điều hướng sang trang danh sách.
- Sửa đồng thời trạng thái menu mobile: khi đang ở Lịch bảo dưỡng định kỳ, mục Bảo dưỡng – Sửa chữa được đánh dấu đang chọn.
- Commit: `9c65d1e`.
- Chưa kiểm thử trực tiếp trên trình duyệt; chờ GitHub Actions deploy xong rồi xác nhận nút mở thẳng biểu mẫu.


## Sửa lỗi build sau khi sửa điều hướng mobile – 17/11/2026

- GitHub Actions run `44081336709` thất bại tại `tsc -b`, báo `src/App.tsx(951,72): TS2367`: điều kiện so sánh `key==='logs'` không hợp lệ vì danh sách tab mobile chỉ gồm dashboard, checklist, assets và planning.
- Đã sửa điều kiện active của các tab mobile về `page===key`. Mục “Thêm” vốn đã xử lý trạng thái active cho các trang logs/tasks, nên không cần so sánh `logs` trong danh sách tab mobile.
- Commit sửa: `1594c87`. Chỉ sửa điều hướng giao diện; không thay đổi nghiệp vụ, dữ liệu hay Supabase.
- Trạng thái: chờ GitHub Actions build/deploy lại. Chỉ hướng dẫn người dùng kiểm tra sau khi workflow mới hoàn tất thành công.


## Chốt và triển khai Phiếu YC Bảo dưỡng – Sửa chữa – 17/11/2026

- Người dùng chốt chỉ sử dụng **một loại phiếu duy nhất: Phiếu YC Bảo dưỡng – Sửa chữa**; không tạo phiếu thực hiện riêng.
- Phiếu ghi nhận thiết bị, ngày yêu cầu, loại yêu cầu, nội dung yêu cầu, người yêu cầu; khi xử lý xong cập nhật ngay trên phiếu các thông tin người hoàn thành, vật tư/nội dung xử lý, thông số và kết quả.
- Phiếu chưa hoàn thành phải luôn hiển thị màu đỏ trong Tổng quan → Công việc hôm nay, không phụ thuộc ngày tạo. Khi người hoàn thành xác nhận kết quả (Đạt hoặc Không đạt/Còn tồn tại), phiếu chuyển hoàn thành và hết cảnh báo đỏ.
- Phiếu YC gắn vào lý lịch thiết bị ngay từ lúc tạo. Phiếu phát sinh từ Checklist không đạt giữ liên kết đến đúng Checklist nguồn; lịch sử Checklist đạt/không đạt tiếp tục được lưu độc lập trong hồ sơ thiết bị.
- **Thiết kế lưu trữ an toàn:** tái sử dụng bảng IndexedDB `logs` hiện có làm kho Phiếu YC duy nhất, bổ sung trường tùy chọn `requestedBy`; không tạo bảng mới, không xóa/chuyển đổi dữ liệu cũ, không cần migration Dexie. Phiếu cũ được giữ nguyên; các phiếu chưa có kết quả tiếp tục được coi là đang chờ xử lý.
- Tab **Bảo dưỡng – Sửa chữa** hiển thị danh sách Phiếu YC, có nút tạo phiếu; tab **Lịch bảo dưỡng định kỳ** chỉ có hai thao tác: thêm tác vụ bảo dưỡng – sửa chữa và xuất lịch Excel.
- Trạng thái code: cập nhật trực tiếp trên `main` trong các file `src/App.tsx`, `src/db.ts` và tài liệu tiến độ. Chưa xác nhận build hoặc GitHub Actions; cần chờ workflow xanh và kiểm thử giao diện thực tế.
- Không thay đổi Supabase, không bật đồng bộ dữ liệu nghiệp vụ, không sửa Production.


## Bổ sung chọn và xuất Excel Phiếu YC – 17/11/2026

- Bảng Phiếu YC có checkbox chọn từng phiếu và checkbox chọn tất cả.
- Hỗ trợ xuất Excel riêng một phiếu ngay trên dòng, xuất nhiều phiếu đã chọn, hoặc xuất toàn bộ danh sách.
- Tệp xuất có mã thiết bị, tên thiết bị, nội dung yêu cầu, trạng thái/kết quả, người yêu cầu, người hoàn thành và thời điểm hoàn thành.
- Phần đếm tổng công việc trên Dashboard đang được rà soát theo đúng hạn của từng loại công việc. Kế hoạch bảo trì hiện chỉ có ngày bắt đầu/kết thúc, chưa có trạng thái hoàn thành; cần chốt quy tắc tính hạn trước khi đưa vào bộ đếm để không báo sai.


## Tổng hợp bộ đếm Dashboard và hạn Phiếu YC – 17/11/2026

- Kế hoạch bảo trì chỉ là kế hoạch định hướng và phục vụ in báo cáo; tạm thời không đưa vào bộ đếm công việc hôm nay hoặc quá hạn, không bổ sung hạn hay trạng thái hoàn thành cho phân hệ này.
- Dashboard tổng hợp công việc thực tế từ ba nguồn: tác vụ bảo trì định kỳ, các kỳ Checklist theo lịch của từng thiết bị và Phiếu YC Bảo dưỡng – Sửa chữa chưa hoàn thành.
- “Việc cần làm hôm nay” đếm các tác vụ/kỳ Checklist/Phiếu YC chưa hoàn thành có hạn đúng ngày hiện tại. “Công việc quá hạn” đếm các mục chưa hoàn thành có hạn trước ngày hiện tại.
- Phiếu YC có trường “Hạn hoàn thành” bắt buộc khi tạo/cập nhật; phiếu tạo từ Checklist được gán hạn mặc định là ngày tạo phiếu. Phiếu cũ chưa có hạn được đánh dấu “Chưa đặt hạn” và không tự suy diễn ngày lập phiếu thành hạn.
- Không tạo bảng IndexedDB mới, không migration dữ liệu, không thay đổi Supabase hoặc bật đồng bộ nghiệp vụ.

## Tạm dừng BAOTRI Mini – 17/11/2026

- Người dùng yêu cầu tạm dừng công việc BAOTRI Mini tại thời điểm này và tiếp tục vào ngày hôm sau; không triển khai thêm chức năng mới trong phiên làm việc hiện tại.
- Commit mới nhất trên `main`: `eeb13cde0ab8db1659b482b593540111f0ab7ed4` – **Fix QR asset lookup result type narrowing**.
- Trong `src/App.tsx`, đã khai báo kiểu kết quả phân biệt rõ thành công/thất bại cho hàm `resolveAsset`; cập nhật luồng nhập mã thủ công và quét camera để kiểm tra `match.ok` trước khi đọc `asset` hoặc `error`. Mục đích là xử lý lỗi TypeScript khi truyền giá trị có thể `undefined` vào `setResult`; không thay đổi logic tra cứu thiết bị.
- GitHub Actions run `44090952905` (**Deploy BAOTRI Mini to GitHub Pages**, run #151) đã hoàn tất với kết quả **success** trên commit `eeb13cd`; workflow đã build và triển khai GitHub Pages thành công.
- Trạng thái kiểm thử: build/deploy đã thành công, nhưng người dùng chưa xác nhận kiểm tra trực tiếp giao diện QR sau lần triển khai này.
- **Việc tiếp theo khi quay lại:** mở ứng dụng đã triển khai, tải lại cứng bằng Ctrl+F5; kiểm tra hộp thoại QR, nhập mã thiết bị thủ công và quét bằng camera. Nếu phát sinh lỗi, ghi nhận hiện tượng và xử lý đúng phạm vi; không sửa các chức năng khác đang hoạt động ổn định.
- Trong thời gian tạm dừng, giữ nguyên mã nguồn, dữ liệu, cấu hình Supabase và các quyết định kiến trúc hiện tại; không thực hiện thay đổi Production hoặc đồng bộ dữ liệu nghiệp vụ.


## Cập nhật 18/11/2026 – tinh gọn giao diện quét QR trên điện thoại

- Trong `src/App.tsx`, bỏ khối giới thiệu lớn ở đầu cửa sổ quét QR (icon, dòng tiêu đề “Quét mã QR để mở hồ sơ” và đoạn mô tả) để giảm chiều cao giao diện.
- Trong `src/style.css`, bổ sung responsive riêng cho modal quét QR trên màn hình rộng tối đa 680px: tăng kích thước chữ nhãn, ô nhập mã (cao 58px, chữ 17px), nút tìm thiết bị (cao tối thiểu 54px, chữ 15px), tăng khoảng đệm và tối ưu chiều cao modal.
- Giữ nguyên logic camera QR, xử lý mã/ID thủ công, kiểm tra đúng thiết bị Checklist và thông báo lỗi; không thay đổi dữ liệu hoặc backend.
- Commit trên `main`: giao diện `745a048259e4ba1f836d11328c3a71eb4de43a4a`; CSS responsive `10370bbe64306e059815e9cd4363f8acf1c720d7`.
- **Trạng thái:** đã cập nhật mã nguồn trên `main`; CHƯA chạy build và CHƯA kiểm tra thực tế trên điện thoại. Cần chờ GitHub Actions deploy, sau đó mở giao diện quét QR trên điện thoại để nghiệm thu kích thước.



## Điều chỉnh lần 2 kích thước ô nhập mã QR trên mobile – 18/11/2026

- Người dùng phản ánh ô nhập mã thủ công vẫn quá nhỏ so với nút Tìm thiết bị trên điện thoại.
- Trong `src/style.css`, bổ sung quy tắc mobile có độ ưu tiên rõ ràng: vùng nhập chuyển thành lưới một cột; ô input chiếm 100% chiều ngang, khóa chiều cao 68px, cỡ chữ 18px, bỏ flex co giãn gây sai kích thước. Nút tìm thiết bị giữ chiều cao tối thiểu 54px.
- Chỉ thay đổi trình bày responsive của ô nhập mã QR; không thay đổi logic quét camera, tra cứu mã thiết bị, Checklist hoặc dữ liệu.
- Commit trên `main`: `296f9e9a411baa38c65c976dd1177faa72e02bb6`.
- Chưa xác nhận GitHub Actions build/deploy và chưa nghiệm thu trực tiếp trên điện thoại.

## Xác nhận build/deploy và cập nhật ô nhập mã QR mobile – 18/11/2026

- Sau commit CSS `296f9e9a411baa38c65c976dd1177faa72e02bb6`, GitHub Actions run #156 (`44161528869`) bị hủy khi có commit tài liệu mới hơn kích hoạt workflow tiếp theo; đây không phải lỗi build của bản cuối.
- GitHub Actions run #157 (`44161551615`) trên commit `885d2024abea8aa54858fb4c49db19aa20b2d266` đã hoàn tất **success**. Cả hai job **build** và **deploy** đều thành công; frontend chứa CSS sửa ô nhập QR đã được triển khai lên GitHub Pages.
- Bản CSS đã triển khai: trên màn hình tối đa 680px, ô nhập mã QR chiếm toàn bộ chiều ngang, cao 68px, chữ 18px; nút Tìm thiết bị rộng 100%, cao tối thiểu 54px.
- Không có lỗi TypeScript/build/deploy được ghi nhận trong workflow #157. Tuy nhiên, **chưa nghiệm thu trực quan trên điện thoại thật**; cần người dùng mở `https://baotri.vieclamhp247.com`, tải lại trang rồi kiểm tra ô nhập mã QR.
- Phạm vi thay đổi chỉ là giao diện mobile của ô nhập mã QR; không thay đổi logic camera, tra cứu thiết bị, Checklist, dữ liệu nghiệp vụ hoặc Supabase.


## Đồng bộ nhận diện thương hiệu 247 cho BAOTRI Mini – 18/11/2026

- Người dùng yêu cầu đồng bộ favicon của `baotri.vieclamhp247.com` với bộ nhận diện 247 mới đang dùng trên `vieclamhp247.com`.
- Đã cập nhật trực tiếp trên repository `Vodanhhp/DuAn_BaoTRi`, nhánh `main`; phạm vi chỉ gồm favicon, Apple Touch Icon, icon cài PWA và quy trình tạo icon khi build. Không sửa chức năng nghiệp vụ, dữ liệu IndexedDB, schema/migration, Supabase hoặc giao diện ứng dụng.
- Các thay đổi đã ghi nhận:
  - Thêm `public/icon-247.svg` làm biểu tượng SVG chủ đạo, dùng màu xanh `#176B5C`, bạc hà `#B9D1C8` và chữ 24/7 trắng/bạc hà.
  - Thêm `scripts/generate-brand-icons.py` để tạo bộ ảnh raster PNG/ICO thống nhất: favicon 16×16, 32×32, 48×48; favicon.ico nhiều kích thước; Apple Touch Icon 180×180; Android/PWA 192×192 và 512×512. Ảnh được tạo trong thư mục `public/` khi build, không cần lưu các bản sinh tự động vào Git.
  - Cập nhật `index.html`: khai báo SVG favicon, PNG 48/32/16, favicon.ico và Apple Touch Icon; thêm tham số phiên bản `v=20261118` để hạn chế dùng cache icon cũ.
  - Cập nhật `vite.config.ts`: đưa icon vào `includeAssets`, khai báo hai kích thước icon Android/PWA trong manifest và đồng bộ màu giao diện PWA sang bộ màu 247. Giữ nguyên `registerType: 'autoUpdate'`, cấu hình Workbox và các phần build còn lại.
  - Cập nhật `.github/workflows/deploy-pages.yml`: cài Pillow và chạy script tạo icon trước bước `npm run build`, để các file được đưa vào bản build GitHub Pages.
- Các commit trên `main`:
  - Thêm script tạo icon: `60a077cd20ae2a63446e699b4b5d79f564a075bf`.
  - Thêm SVG master: `27efced2c2d9919216a0b2712a1aa9ffc9037c89`.
  - Cập nhật HTML: `e580c7b9d359e573576d55d8f7baa2cf7c9b46d6`.
  - Cập nhật manifest PWA: `9569cbbbebe903318742de5dec3cbfe37e7ab57d`.
  - Tích hợp tạo icon vào workflow deploy: `5f8b3752007f7df5835a81e48add7ccbf7b18853`.
- **Trạng thái xác minh:** đã đọc lại các file trên `main` và xác nhận nội dung cấu hình đã được cập nhật. Chưa có kết quả GitHub Actions build/deploy được xác minh trong phiên này; vì vậy chưa đánh dấu triển khai website thành công và chưa xác nhận favicon đã hiển thị thực tế trên trình duyệt/điện thoại.
- **Bước tiếp theo:** kiểm tra GitHub Actions của repository BAOTRI; nếu build/deploy thành công, mở `https://baotri.vieclamhp247.com/` và kiểm tra favicon trên trình duyệt, Apple icon/PWA trên thiết bị đã cài. Nếu icon cũ còn do cache, kiểm tra cập nhật service worker/PWA và cache trình duyệt trước khi thay đổi thêm mã nguồn.


---

# ĐÁNH GIÁ VÀ PHƯƠNG ÁN ĐỒNG BỘ DỮ LIỆU CLOUD – 18/11/2026

## A. Quyết định hiện hành – ưu tiên hơn mô tả cũ

- Giai đoạn hiện tại dùng một tài khoản Supabase Auth duy nhất của người dùng. Tạm dừng kiểm thử multi-tenant với nhiều tài khoản, tạo thêm tổ chức/membership và mời người dùng.
- Dữ liệu nghiệp vụ vẫn đọc/ghi tại IndexedDB (baotri-local-v1) trên từng trình duyệt/thiết bị. Chưa bật đồng bộ nghiệp vụ lên Supabase.
- Kiến trúc đích: dữ liệu nghiệp vụ thuộc một tổ chức được bảo vệ bằng organization_id và RLS; có thể mở rộng nhiều người dùng sau này.
- Supabase Test (BAOTRI-Mini-Test, ref oyzhxgzltpdebpymuicb) là nơi kiểm tra schema, RLS và đồng bộ. Production (BAOTRI-Mini, ref ahacxsrriwlfzrobrbmc) không thử nghiệm, không chạy migration và không ghi dữ liệu khi chưa có yêu cầu rõ ràng.
- Các test bảo mật SQL 008, 009, 010, 011 đã được người dùng xác nhận PASS. Điều này không có nghĩa chức năng đồng bộ đã hoàn tất.
- Các mô tả cũ ở đầu tài liệu như “không đăng nhập thật”, “chưa tạo Supabase” đã lỗi thời. Nội dung cập nhật ngày 16–18/11/2026 và mục này được ưu tiên.

## B. Kết quả rà soát mã nguồn trên main

Đã đọc src/db.ts, src/lib/cloudSync.ts, src/lib/assetsCloud.ts, src/lib/supabase.ts, src/AuthScreen.tsx, src/CloudAssetsPanel.tsx và các migration nghiệp vụ/phân quyền.

### B1. Local IndexedDB

- Dexie database baotri-local-v1 có các bảng: assets, inventory, tasks, logs, movements, syncQueue, checklistTemplates, checklistVersions, checklistResults, maintenancePlans.
- ID nghiệp vụ hiện là UUID do crypto.randomUUID() sinh; có thể giữ nguyên ID giữa các thiết bị và Cloud. Mã quản lý hiển thị không phải khóa chính.
- syncQueue hiện chỉ có id, tableName, recordId, operation, queuedAt; chưa có trạng thái xử lý, số lần thử, lỗi, deviceId, mutationId hay thông tin phiên bản máy chủ.
- queueChange() ghi hàng đợi tách rời thao tác ghi nghiệp vụ, chưa bảo đảm cùng transaction Dexie. Có nguy cơ lưu dữ liệu nhưng thiếu queue hoặc ngược lại.
- Rà soát App.tsx cho thấy một số luồng đã queue (inventory, tasks, maintenancePlans, logs, assets, Checklist), nhưng chưa đầy đủ: khi hoàn thành task có tạo log nhưng không queue log; nhập/xuất kho tạo movements nhưng chỉ queue inventory; seed/demo và import/restore backup chưa được phân loại để quyết định có đồng bộ hay không.
- Kết luận: chưa được bật syncLocalDatabase() để chạy dữ liệu thật.

### B2. Hai nhánh Cloud đang tách biệt và chưa tương thích

- Auth dùng Supabase client trong src/lib/supabase.ts và src/AuthScreen.tsx.
- Phân hệ Thiết bị trên Cloud dùng bảng chuẩn hóa assets và organization_settings qua src/lib/assetsCloud.ts. Module này độc lập với IndexedDB; không tự đẩy dữ liệu local lên Cloud và không tải Cloud về local.
- src/lib/cloudSync.ts là bộ đồng bộ JSON cũ, dùng maintenance_records(owner_id, collection, record_id, payload, updated_at, deleted_at), được tạo bởi migration 20261117000100_maintenance_records.sql.
- Schema nghiệp vụ chuẩn hóa trong migration 20261117000200_business_schema.sql dùng organization_id và các bảng assets, inventory_items, maintenance_tasks, maintenance_plans, checklist_templates, checklist_template_versions, checklist_results, maintenance_logs, inventory_movements, asset_images, organization_settings.
- cloudSync.ts cũ không gắn organization_id, không mapping sang tên bảng/cột chuẩn hóa, không xử lý đầy đủ FK; có cơ chế tự đẩy toàn bộ local khi Cloud rỗng và áp dụng Cloud bằng put() có thể ghi đè local. Không gọi module này, không nối vào giao diện và không dùng maintenance_records làm đường đồng bộ chính.
- Hai thiết kế maintenance_records JSON và schema chuẩn hóa hiện cùng tồn tại trong migrations. Chọn schema chuẩn hóa organization_id làm đích đồng bộ chính; giữ nguyên bảng/migration JSON cũ, chưa xóa hay chạy migration phá hủy.

## C. Kiến trúc đồng bộ đề xuất

Mô hình: IndexedDB máy tính ↔ Supabase PostgreSQL của tổ chức cá nhân ↔ IndexedDB điện thoại.

- Supabase là nguồn dữ liệu dùng chung sau khi đồng bộ thành công; mỗi thiết bị giữ bản local. Mất mạng không được làm mất dữ liệu đang chờ gửi.
- Giữ nguyên UUID; không ghép dữ liệu bằng mã hiển thị, tên hoặc số thứ tự.
- Mọi truy vấn/ghi Cloud lấy organization_id từ membership đang hoạt động của Auth user; RLS là lớp bảo vệ bắt buộc. Không tin organization_id do client tự gửi.
- Không dùng owner_id cho dữ liệu nghiệp vụ mới; dùng organization_id.
- Cần lớp repository/sync adapter riêng để mapping dữ liệu local sang schema chuẩn hóa; không copy thủ công từ Cloud Assets panel.

### C1. Mapping local → Cloud

| IndexedDB | Supabase | Lưu ý |
|---|---|---|
| assets | assets | Giữ UUID; camelCase → snake_case; ảnh không nằm trong payload |
| inventory | inventory_items | group → item_group; bảo toàn quantity |
| tasks | maintenance_tasks | assetId → asset_id; phụ thuộc asset |
| maintenancePlans | maintenance_plans | Phụ thuộc asset |
| checklistTemplates | checklist_templates | Một template hiện hành/thiết bị |
| checklistVersions | checklist_template_versions | Bất biến; phụ thuộc template và asset |
| checklistResults | checklist_results | Bất biến; giữ liên kết template/version/asset |
| logs | maintenance_logs | Lịch sử; giữ liên kết asset/task/checklist result |
| movements | inventory_movements | Lịch sử kho; phải dùng RPC transaction |

Không gửi nguyên object local lên Cloud. Mỗi bảng cần adapter có kiểm tra dữ liệu và chuyển đổi kiểu/ngày/null rõ ràng.

### C2. Thứ tự gửi và tải

1. assets và inventory_items.
2. maintenance_tasks và maintenance_plans.
3. checklist_templates.
4. checklist_template_versions.
5. checklist_results.
6. maintenance_logs.
7. inventory_movements qua RPC riêng.

Phải bảo đảm bản ghi cha có trước bản ghi con. Không xóa thiết bị/vật tư nếu còn dữ liệu phụ thuộc. Checklist versions/results và lịch sử là append-only; không dùng upsert để ghi đè lịch sử.

### C3. Hàng đợi, idempotency và xung đột

Trước khi đồng bộ, nâng cấp syncQueue bằng migration Dexie mới, dự kiến thêm status (pending/processing/failed), attempts, lastError, lastAttemptAt, deviceId ổn định, clientMutationId duy nhất và metadata phiên bản cần thiết.

- Ghi nghiệp vụ và queue trong cùng transaction Dexie.
- Gửi lặp cùng mutation không được tạo bản ghi trùng hoặc cộng tồn kho lần hai.
- Chỉ xóa/đánh dấu hoàn tất queue sau khi Cloud xác nhận. Lỗi mạng, RLS, FK hoặc validation phải giữ queue và lưu nguyên nhân.
- Không gộp các sự kiện lịch sử thành trạng thái cuối. Checklist result, maintenance log, inventory movement phải giữ từng sự kiện riêng.
- Tombstone chỉ dùng cho loại dữ liệu được phép xóa; không DELETE hàng loạt để ép hai bên giống nhau.
- Tải theo phân trang và cursor/updated_at; không tải toàn bộ DB mỗi lần mở app. Cần checkpoint có xử lý nhiều bản ghi cùng timestamp.
- Không tự giải quyết xung đột theo kiểu “bản cập nhật sau cùng thắng” khi có nguy cơ mất nội dung. Dữ liệu master dùng optimistic concurrency/version; khi hai máy cùng sửa, giữ cả hai phiên bản và đánh dấu conflict để xử lý có kiểm soát.
- Giao diện cần trạng thái Chưa đồng bộ, Đang đồng bộ, Đã đồng bộ, Có lỗi, Có xung đột; hiển thị số queue và thời điểm đồng bộ cuối.

### C4. Giao dịch kho

Migration 002 cố ý không cấp INSERT trực tiếp inventory_movements và hạn chế cập nhật quantity của inventory_items. Không thể đồng bộ tồn và movement bằng hai lệnh REST rời rạc.

Cần RPC PostgreSQL có transaction: kiểm tra quyền inventory.adjust, khóa dòng vật tư, kiểm tra số lượng hợp lệ, cập nhật quantity và thêm movement với clientMutationId chống lặp; tất cả cùng thành công hoặc rollback. Không ghi đè số tồn local lên Cloud; Cloud phải thực hiện phép cộng/trừ trong transaction.

### C5. Ảnh/tệp

assets.images hiện là dữ liệu ảnh local; adapter Cloud trả images rỗng. Không lưu base64 trong PostgreSQL. Giai đoạn sau dùng Storage private, metadata asset_images, đường dẫn theo tổ chức/thiết bị, policy Storage/RLS, upload có retry và kiểm tra checksum/kích thước. Trước mắt bytes ảnh chưa thuộc phạm vi đồng bộ và phải hiển thị rõ ảnh chỉ có trên thiết bị nguồn.

## D. Lộ trình triển khai – chưa bật đồng bộ

### Giai đoạn 0 – Chốt dữ liệu gốc
- Giữ nguyên dữ liệu trên máy tính và điện thoại, không tự động hợp nhất.
- Hai backup ngày 16/11 đã rà sơ bộ: nhiều bản ghi tương ứng có ID khác nhau do các trình duyệt tạo dữ liệu độc lập; số lượng một số bảng cũng khác. Không dùng mã thiết bị để tự đổi ID hoặc ghi đè.
- Trước seed đầu tiên phải chọn một bản dữ liệu chuẩn, lập báo cáo đối chiếu phần phát sinh riêng trên thiết bị còn lại và sao lưu riêng. Không xóa/sửa backup gốc.
- Xác nhận tổ chức cá nhân và membership Admin trên Test; không tạo thêm tài khoản/tổ chức.

### Giai đoạn 1 – Hoàn thiện local queue, chưa gọi Cloud
- Kiểm kê tất cả add/put/update/delete/bulk/import/restore/seed trong App.tsx và module khác.
- Bảo đảm mọi ghi nghiệp vụ cần đồng bộ được queue trong cùng transaction Dexie.
- Phân loại dữ liệu demo, backup import và nghiệp vụ thật; không tự đẩy dữ liệu mẫu.
- Thêm retry, lỗi, mutation ID, conflict; kiểm tra offline, refresh, đóng/mở app và queue tồn tại.
- Chưa gửi request ghi lên Supabase.

### Giai đoạn 2 – Adapter và test schema
- Viết adapter cho đủ 9 bảng local, kiểm tra kiểu dữ liệu, null/default, ngày giờ, số thập phân và FK.
- Đối chiếu quyền RLS/permission từng thao tác. Inventory movement phải qua RPC.
- Test mapping với mock/local trước khi gọi project Test.
- Không dùng maintenance_records JSON làm đích chính.

### Giai đoạn 3 – Test đồng bộ có kiểm soát trên Test
- Bắt đầu bằng một bản ghi thiết bị thử riêng, sau đó vật tư, task, Checklist, log.
- Test gửi lặp, mất mạng giữa chừng, RLS, FK, xung đột hai thiết bị, tombstone, rollback, phân trang và restore backup.
- Test kho bằng RPC transaction.
- Chỉ sau khi test đạt mới seed bộ dữ liệu đã được chọn; không lấy dữ liệu Production làm dữ liệu thử.

### Giai đoạn 4 – Đồng bộ hai thiết bị
- Ban đầu có nút đồng bộ thủ công; tự động hóa sau khi ổn định.
- Lần đầu chỉ một thiết bị nguồn gửi dữ liệu chuẩn lên Test; thiết bị kia tải dữ liệu từ Cloud. Không cho hai máy cùng seed lần đầu.
- Kiểm tra thay đổi máy tính xuất hiện trên điện thoại và ngược lại; không nhân đôi, mất lịch sử hoặc ghi đè âm thầm.
- Có conflict thì dừng tự động ghi bản ghi đó để xử lý có kiểm soát.

### Giai đoạn 5 – Ảnh, backup và vận hành
- Bổ sung Storage private cho ảnh/tài liệu, retry và xác minh upload/download.
- Có backup định kỳ và quy trình restore đã thử nghiệm; Cloud không thay thế backup độc lập.
- Chỉ xem xét triển khai cùng mô hình lên Production khi có yêu cầu riêng và kế hoạch chuyển đổi được duyệt.

## E. Các điểm chặn trước khi viết code đồng bộ

1. Chọn nguồn dữ liệu chuẩn để seed lần đầu; không tự hợp nhất hai backup cũ.
2. Hoàn thiện transaction queue trên Dexie và kiểm kê các luồng ghi thiếu.
3. Chọn schema chuẩn hóa organization_id; cloudSync.ts hiện tại là mã cũ không tương thích, không được kích hoạt.
4. Xây adapter mapping và kiểm tra FK cho đủ 9 bảng local.
5. Thiết kế RPC kho idempotent và cơ chế version/conflict.
6. Chạy thử trên BAOTRI-Mini-Test; không đụng Production.
7. Không xóa dữ liệu local, không xóa bảng/migration cũ, không tạo thêm membership/tài khoản trong bước chuẩn bị.

**Trạng thái:** Đã rà soát và lập phương án. Chưa sửa mã nguồn đồng bộ, chưa gọi syncLocalDatabase(), chưa ghi dữ liệu nghiệp vụ lên Supabase, chưa chạy SQL/migration mới và chưa thay đổi Test/Production. Bước kế tiếp là Giai đoạn 0–1: đối chiếu nguồn dữ liệu và hoàn thiện hàng đợi local.


---

# TRIỂN KHAI GIAI ĐOẠN 1 – NỀN TẢNG HÀNG ĐỢI ĐỒNG BỘ LOCAL – 18/11/2026

## Phạm vi đã thực hiện

Đã cập nhật trực tiếp trên nhánh main, không tạo branch/PR. Chỉ thay đổi lớp lưu trữ local và các điểm ghi nghiệp vụ cần đưa vào hàng đợi. Không gọi Supabase để đồng bộ, không thay đổi SQL/migration, không ghi dữ liệu lên Test hoặc Production.

### 1. Nâng cấp Dexie database lên version 6

- Giữ nguyên database name baotri-local-v1 và toàn bộ các bảng nghiệp vụ.
- Mở rộng syncQueue với các trường status (pending/processing/failed), attempts, lastError, lastAttemptAt, deviceId và mutationId.
- Thêm unique compound index theo tableName + recordId; hàng đợi được coalesce theo một bản ghi/bảng để tránh phát sinh nhiều queue trùng cho cùng một thay đổi đang chờ.
- Migration v6 chuẩn hóa queue cũ: gộp các mục trùng theo bảng + record, giữ mục mới nhất, bổ sung metadata còn thiếu. Migration chỉ thao tác bảng syncQueue, không sửa/xóa dữ liệu nghiệp vụ.
- deviceId được lưu ổn định theo browser installation bằng localStorage; mutationId mới được tạo mỗi lần ghi nhận thay đổi.

### 2. Bảo đảm ghi nghiệp vụ và queue cùng transaction

- Bổ sung helper putAndQueue, addAndQueue và deleteAndQueue trong src/db.ts.
- Đã chuyển các luồng lưu/sửa vật tư, công việc, nhật ký, lưu kho/khôi phục/thay đổi trạng thái thiết bị, xóa kế hoạch và tạo kết quả Checklist sang cơ chế transaction ghi dữ liệu + queue.
- Lưu Checklist template và Checklist version cùng transaction với hai queue tương ứng; mỗi lần sửa biểu mẫu tạo version riêng như nguyên tắc Checklist đã chốt.
- Khi hoàn thành task: cập nhật task, thêm maintenance log và queue cả hai trong cùng transaction.
- Khi nhập/xuất kho local: cập nhật số lượng vật tư, thêm movement và queue cả inventory + movement trong cùng transaction. Đây mới là queue local; chưa gửi movement lên Cloud. Khi làm đồng bộ Cloud, movement vẫn phải qua RPC transaction phía PostgreSQL.
- Khi khôi phục backup: dữ liệu được ghi local và các bản ghi khôi phục được đưa vào queue trong transaction; không nhập nguyên syncQueue cũ từ file backup để tránh đưa cấu trúc queue lỗi thời vào DB mới.
- Các lệnh seed/demo tự động ban đầu vẫn không tự queue hàng loạt; không tự động đưa dữ liệu demo lên Cloud chỉ vì app khởi động.

### 3. Build/deploy

- Commit nâng cấp DB/queue: c753e5a817a741f4a10293b8b8af27d37622fac1.
- Commit chuyển các luồng nghiệp vụ sang queue: 695096a6ce90597473e191fe5a11f43fe465629e.
- Commit hoàn thiện luồng restore và các thao tác thiết bị còn lại: 1f2c85fea16239698bdfdd14f2ff1c08817b735e.
- Workflow run #166 ở commit đầu tiên thất bại do một điểm ghi queue cũ chưa bổ sung các trường metadata mới. Đã sửa ở commit tiếp theo.
- Workflow run #169 (ID 44231478875) tại commit 1f2c85fea16239698bdfdd14f2ff1c08817b735e: job build **success**, job deploy **success**. Không có lỗi TypeScript/build/deploy ở bản cuối.
- Đã triển khai lên GitHub Pages; chưa thực hiện nghiệm thu thủ công toàn bộ thao tác trên trình duyệt/điện thoại sau nâng cấp.

## Trạng thái sau Giai đoạn 1

- Đã có nền tảng queue local có metadata và transaction cho các luồng ghi nghiệp vụ chính.
- Chưa có worker gửi queue lên Cloud, chưa có adapter schema chuẩn hóa, chưa có xử lý retry thực tế/conflict/version server, chưa có RPC kho, chưa có đồng bộ ảnh.
- Không gọi src/lib/cloudSync.ts cũ.
- Không chạy SQL/migration Supabase; không thay đổi BAOTRI-Mini-Test hoặc BAOTRI-Mini Production.
- Không xóa dữ liệu IndexedDB hiện có. Trình duyệt sẽ tự chạy migration Dexie v6 khi mở bản mới; migration chỉ chuẩn hóa syncQueue.
- Việc chọn dữ liệu gốc giữa backup máy tính và điện thoại vẫn là điểm chặn riêng trước lần seed Cloud đầu tiên. Không tự chọn một thiết bị làm nguồn chuẩn.

**Bước kế tiếp:** kiểm thử mở ứng dụng sau migration v6 và các thao tác lưu/sửa/xóa, Checklist, hoàn thành công việc, nhập/xuất kho, restore backup; sau đó hoàn thành đối chiếu backup và thiết kế trạng thái conflict/version trước khi viết adapter Cloud.

---

# BỔ SUNG KIỂM TRA HÀNG ĐỢI ĐỒNG BỘ LOCAL – 18/11/2026

## Phạm vi triển khai

- Bổ sung phần xem chi tiết hàng đợi trong **Cài đặt → Dữ liệu và sao lưu**.
- Danh sách hiển thị tối đa 50 mục gần nhất, đọc trực tiếp từ IndexedDB; không chỉnh sửa/xóa queue.
- Các cột hiển thị: phân hệ, ID bản ghi, thao tác upsert/delete, trạng thái pending/processing/failed, số lần thử, thời điểm ghi nhận và lỗi gần nhất.
- Dùng live query để số lượng và danh sách tự cập nhật sau các thao tác nghiệp vụ.
- Không thêm nút chạy đồng bộ, không gọi Supabase, không thay đổi dữ liệu nghiệp vụ hoặc cấu hình Supabase.

## Build/deploy

- Commit: `cb73055cf1b2fb7a3d4a8b2ad5d18005819f52cc`.
- GitHub Actions run #171 (ID `44232589189`): build **success**, deploy **success**.
- Chưa kiểm tra thủ công giao diện chi tiết hàng đợi trên desktop/mobile; chưa xác nhận các thao tác nghiệp vụ thực tế đã sinh đúng từng queue item.

## Cách nghiệm thu thủ công

1. Mở Cài đặt → Dữ liệu và sao lưu → mở “Kiểm tra hàng đợi đồng bộ local”.
2. Thực hiện lần lượt một thao tác sửa thiết bị, nhập kho, hoàn thành công việc và lưu một phiếu Checklist.
3. Kiểm tra số queue tăng và từng dòng có đúng tên phân hệ, ID bản ghi, thao tác, trạng thái pending, attempts = 0, deviceId/mutationId được lưu trong DB (hai trường cuối chưa hiển thị trên giao diện).
4. Kiểm tra sửa cùng một bản ghi nhiều lần chỉ còn một queue item cho cặp tableName + recordId, với mutationId/queuedAt mới nhất.
5. Không xóa queue hoặc thử nút đồng bộ vì worker Cloud chưa được triển khai.

## Bước tiếp theo

- Dùng bảng kiểm tra này để nghiệm thu queue local trên trình duyệt thật.
- Hoàn tất thiết kế conflict/version và mapping theo schema chuẩn hóa.
- Chỉ sau khi hoàn tất đối chiếu nguồn dữ liệu và cơ chế bảo vệ xung đột mới triển khai worker Cloud trên project Test. Không thay đổi Production và không chạy SQL/migration nếu chưa có phê duyệt riêng.

---

# MAPPING DỮ LIỆU VÀ REVIEW GIAO THỨC CLOUD SYNC – 18/11/2026

## Đã triển khai trên main

- Thêm `src/lib/syncMapping.ts`: lớp mapping thuần local ↔ Cloud cho assets, inventory, tasks, maintenancePlans, checklistTemplates, checklistVersions, checklistResults và maintenance_logs.
- Mapping yêu cầu organization_id không rỗng; giữ UUID; chuyển camelCase → snake_case; ảnh không được đưa vào row PostgreSQL.
- Inventory có hai hàm tách biệt: baseline có quantity chỉ dành cho seed có kiểm soát; metadata upsert thường ngày loại quantity để không ghi đè số tồn đã được cập nhật qua movement RPC.
- maintenance_logs từ chối sync nếu local có dueDate, requestedBy hoặc editHistory vì schema SQL hiện tại chưa có các cột đó; không âm thầm bỏ dữ liệu.
- inventory_movements bị chặn ghi trực tiếp; chỉ được đồng bộ khi có RPC transaction + idempotency đã review.
- Thêm tài liệu `supabase/CLOUD_SYNC_PROTOCOL_REVIEW.md` mô tả push/pull, conflict, retry, cursor, tombstone, idempotency và các khoảng trống schema.

## Build/deploy

- Mapping commit: `d2a5107882a929814717088561a060074e12cf38`.
- GitHub Actions workflow #173: build **success**, deploy **success**.
- Tài liệu giao thức review commit: `5455fc21954ee98da1c0a1969fa3fc090e670f56`.
- Không có worker chạy và không có request ghi dữ liệu nghiệp vụ lên Supabase.

## Các khoảng trống đã xác định

1. Chưa có row_version/revision cho optimistic concurrency.
2. Chưa có idempotency ledger theo mutationId.
3. Chưa có RPC inventory movement cập nhật tồn và ghi lịch sử cùng transaction.
4. maintenance_logs thiếu due_date, requested_by, edit_history so với local model.
5. Chưa có change feed/cursor/tombstone để pull phân trang và truyền delete.
6. Queue chưa lưu base Cloud version/snapshot để xác định xung đột.
7. Ảnh còn local; chưa có Storage transfer.
8. customAssetCategories còn localStorage; chưa có luồng đồng bộ vào organization_settings.asset_categories.

## Lưu ý nguồn dữ liệu

- Repository hiện có file `backup-baotri-day-du-2026-11-16.json` với 34 assets, 41 inventory, 4 tasks, 6 logs, 34 Checklist templates, 34 versions và 17 syncQueue items.
- Đây là file backup đã commit trong repository; không mặc định đó là một trong hai bản backup desktop/mobile đã đối chiếu trong cuộc trao đổi trước (30 assets desktop, 31 mobile). Không dùng file này làm nguồn seed Cloud khi chưa đối chiếu nguồn gốc và quan hệ.
- Không tự chọn desktop/mobile, không hợp nhất theo mã/tên, không sửa/xóa các backup gốc.

## Trạng thái và bước kế tiếp

- Đã có mapping an toàn bước đầu và tài liệu giao thức; chưa có đồng bộ Cloud thực tế.
- Tiếp theo: review schema delta (row_version, mutation idempotency, change feed/tombstone, log fields, inventory RPC), bổ sung kiểm thử mapping, tiếp tục đối chiếu backup desktop/mobile.
- Chưa tạo hoặc chạy SQL migration; chưa gửi dữ liệu nghiệp vụ lên Supabase Test hoặc Production; chưa thay đổi dữ liệu Cloud.

### Ràng buộc mã thiết bị phát hiện khi review giao thức
- Migration 012 đã thu hồi INSERT trực tiếp trên `assets`; thiết bị Cloud mới phải qua `create_asset_with_code`.
- RPC hiện tại nhận p_id nhưng tự sinh code, không nhận code local. Do đó mapper không đồng nghĩa với quyền upsert; cần RPC import riêng để giữ UUID + code hiện hữu có kiểm tra Admin/audit, hoặc quy trình online tạo mã Cloud trước.
- Thiết bị tạo offline trên hai máy có thể sinh trùng code dù UUID khác nhau; unique constraint của organization sẽ chặn. Không tự đổi mã vì có thể ảnh hưởng QR và hồ sơ tham chiếu.
- `customAssetCategories`, `organization_settings.asset_categories` và `asset_code_config` là các cấu trúc khác nhau, cần mapping cấu hình riêng.

---

# KIỂM THỬ TỰ ĐỘNG LỚP MAPPING CLOUD – 18/11/2026

- Thêm `tests/syncMapping.test.mjs` với 8 nhóm kiểm thử:
  1. Asset mapping giữ UUID/trường nghiệp vụ, không đưa ảnh local vào payload.
  2. Mapper từ chối organization_id rỗng.
  3. Inventory baseline có quantity, metadata upsert không có quantity.  4. Task mapping giữ asset foreign key và status.
  5. Checklist version/result giữ snapshot.  6. Maintenance log từ chối dueDate, requestedBy, editHistory khi schema chưa hỗ trợ.
  7. Inventory movement bị chặn ghi trực tiếp.
  8. Kiểm tra thứ tự phụ thuộc và vị trí movement cuối.
- Thêm script `npm run test:sync-mapping`.
- GitHub Actions chạy test trước bước build.
- Workflow #180: test thành công, build thành công, deploy thành công.
- Run: https://github.com/Vodanhhp/DuAn_BaoTRi/actions/runs/44234010852
- Chưa bật worker Cloud; chưa gọi Supabase để ghi dữ liệu; không chạy SQL/migration; không thay đổi dữ liệu Test/Production.

**Bước tiếp theo:** tiếp tục review thiết kế schema version/idempotency/change feed và RPC inventory; sau đó mới triển khai kiểm thử worker trên Test khi các hợp đồng dữ liệu đã chốt.


---

# REVIEW RACE CONDITION HÀNG ĐỢI CLOUD SYNC – 18/11/2026

## Phát hiện

- `syncQueue` Dexie v6 dùng unique key `[tableName+recordId]`; `queueChange()` luôn ghi đè row hiện có, chuyển về pending và tạo mutationId mới.
- Cách gộp này an toàn khi chưa có worker và mọi mục đều pending. Khi worker đang gửi mutation A mà người dùng sửa tiếp cùng bản ghi tạo mutation B, row A có thể bị ghi đè. Phản hồi thành công của A có nguy cơ xóa nhầm B hoặc làm mất dữ liệu cần retry.
- Vì vậy không được bật worker trên queue v6 chỉ bằng cách thêm trạng thái processing/claim.

## Đã thiết kế

- Tạo `supabase/CLOUD_SYNC_QUEUE_V7_DESIGN.md` (commit `3961d6d6fc329adccba98235337734231794e9ac`).
- Đề xuất mỗi mutation có khóa mutationId riêng; pending chưa claim có thể coalesce, processing/sent là bất biến.
- Mutation mới trong lúc mutation cũ processing phải tạo row riêng; xác nhận chỉ tác động đúng mutationId + claimToken.
- Lưu baseVersion và payload snapshot; retry giữ nguyên mutationId/payload; server idempotency ledger và business write phải cùng transaction.
- Append-only history không coalesce; delete dùng tombstone và giữ thứ tự; conflict chặn mutation kế tiếp của cùng record.
- Đã ghi rõ 10 nhóm kiểm thử bắt buộc và yêu cầu migration Dexie v7 không đụng bảng nghiệp vụ.

## Trạng thái an toàn

- Chỉ thêm tài liệu thiết kế; không sửa Dexie v6 hoặc dữ liệu local.
- Không tạo worker, không gọi Supabase, không chạy SQL/migration.
- Không thay đổi BAOTRI-Mini-Test hoặc Production.
- Workflow #181 tại commit `42b20b61255f6e03c5aa2366a1d72402e6063c1b` đã success; commit thiết kế mới cần chờ workflow tương ứng hoàn tất.

**Bước tiếp theo:** review schema idempotency + row_version + change feed/tombstone và hợp đồng RPC kho; sau đó mới triển khai migration queue v7 cùng test mô phỏng race condition.

---

# REVIEW SCHEMA VERSION / IDEMPOTENCY / CHANGE FEED / INVENTORY RPC – 18/11/2026

## Đã review tĩnh

- Migration 002 có trigger `updated_at` nhưng chưa có `row_version`; timestamp không đủ làm optimistic concurrency token.
- Migration 002 cấp INSERT trực tiếp `inventory_items`; RLS member cũng cho phép INSERT. Dù authenticated không được UPDATE cột quantity, đường INSERT hiện tại vẫn có thể tạo item với số tồn mà không có movement.
- Migration 012 đã thu hồi INSERT trực tiếp `assets`, buộc tạo mới qua allocator RPC; RPC hiện không hỗ trợ import code local.
- UI local hiện tính tồn `+quantity` cho Nhập và `-quantity` cho Xuất/Điều chỉnh. Nghiệp vụ “Điều chỉnh” chưa rõ là delta có dấu hay đặt tồn thực tế; chưa được tự viết RPC trước khi chốt.
- Kiểm tra thao tác kho cho thấy inventory balance và movement đang được ghi cùng Dexie transaction; Cloud phải bảo toàn tính nguyên tử tương tự trong một transaction PostgreSQL.

## Đã thiết kế

- Tạo `supabase/CLOUD_SYNC_SCHEMA_PROTOCOL_DESIGN.md`, commit `822b8a9b04ea57823677b9f3c7064a9e103b550d`.
- Thiết kế row_version do DB tăng, optimistic concurrency theo expected version; không dùng updated_at làm version.
- Thiết kế idempotency ledger unique theo organization + mutationId, lưu payload hash và kết quả; ledger + business mutation cùng transaction.
- Thiết kế change feed theo counter từng organization được khóa trong transaction, sequence commit-order, tombstone cho delete; không dùng sequence độc lập dễ phát sinh commit đảo thứ tự.
- Thiết kế RPC kho khóa row FOR UPDATE, tính tồn phía DB, ghi movement + balance + idempotency trong cùng transaction.
- Ghi rõ cần thu hồi direct INSERT inventory_items và thay bằng RPC tạo item + tồn đầu kỳ/movement.
- Liệt kê test bắt buộc: duplicate mutation, payload mismatch, rollback, conflict, cursor commit-order, tombstone, permission revoked và cross-organization.

## Trạng thái

- Chỉ thêm tài liệu review/thiết kế; không tạo SQL migration, không sửa database grants/RLS.
- Không chạy SQL, không gọi RPC, không bật worker.
- Không thay đổi dữ liệu local, BAOTRI-Mini-Test hoặc Production.
- Commit schema protocol design: `822b8a9b04ea57823677b9f3c7064a9e103b550d`.

**Bước tiếp theo:** rà soát schema fields và permission matrix cụ thể, đối chiếu thêm thao tác kho/Checklist/log với UI; sau đó lập migration draft theo từng phần để review, vẫn chưa áp dụng vào Supabase.


---

# ĐỐI CHIẾU QUYỀN VAI TRÒ VỚI THAO TÁC UI – 18/11/2026

- Đã rà soát migration 005 (roles/permissions), migration 006 (RLS), migration 012 (asset allocator RPC), test RLS 009 và các thao tác chính trong `src/App.tsx`.
- Tạo `supabase/CLOUD_PERMISSION_UI_MATRIX.md`, commit `4d2aa2bcbeb29ce7743eaf1fcbd1e3c2137d7d81`.
- Xác nhận các khác biệt quan trọng:
  1. UI hiện chỉ phân biệt Viewer và non-Viewer; chưa kiểm tra permission chi tiết.
  2. Technician hiện có thể sửa Checklist template trên UI/local nhưng permission catalog không cấp `checklist.template.manage` (Admin-only).
  3. UI có thể cho Technician xóa kế hoạch, trong khi permission catalog không cấp `maintenance.delete`.
  4. Direct INSERT `inventory_items` có thể tạo tồn ban đầu không kèm movement; cần thu hồi và thay bằng RPC nguyên tử.
  5. RPC tạo thiết bị hiện cấp mã Cloud, không nhận mã local; cần RPC import riêng nếu phải bảo toàn UUID + mã hiện có.
  6. Log local có dueDate/requestedBy/editHistory và có thể được sửa; Cloud schema thiếu trường và RLS hiện append-only. Cần chốt mô hình event/revision, không bỏ dữ liệu hoặc update log cũ âm thầm.
  7. Hoàn thành task tạo task update + log insert trong cùng Dexie transaction; Cloud cần transaction tương ứng.
- Workflow #185 (run ID `44234972918`) đã hoàn tất: test mapping, build Vite và deploy đều **success**.
- Chưa sửa mã ứng dụng, chưa tạo worker, chưa gửi dữ liệu nghiệp vụ lên Cloud.
- Không chạy SQL/migration, không thay đổi BAOTRI-Mini-Test hoặc Production, không tạo organization/membership/tài khoản mới.

**Bước tiếp theo:** tiếp tục hoàn thiện hợp đồng permission/RPC và schema cho Log, Checklist, thiết bị import và kho; sau đó tạo migration draft trong repository để review, tuyệt đối chưa áp dụng lên Supabase.


---

# DRAFT ROW_VERSION FOUNDATION – 18/11/2026

- Tạo bản nháp SQL `supabase/drafts/015_row_version_foundation_DRAFT.sql`, commit `a7593a2ca738ca532514e644aa9466c56253837e`.
- Phạm vi gồm các bảng mutable: assets, inventory_items, maintenance_tasks, maintenance_plans, checklist_templates, organization_settings.
- Không thêm row_version vào các bảng lịch sử append-only: checklist_template_versions, checklist_results, maintenance_logs, inventory_movements.
- Trigger đặt row_version do database quản lý: insert bắt đầu ở 1; update cột nghiệp vụ tăng 1; chỉ đổi updated_at không tăng version.
- File nằm trong `supabase/drafts/`, không nằm trong `supabase/migrations/`; không được chạy như migration.
- Quan trọng: row_version/trigger chỉ là nền tảng. Chưa có optimistic concurrency đầy đủ nếu client còn UPDATE trực tiếp; mọi update Cloud phải qua RPC kiểm tra expected_version và xử lý conflict nguyên tử. Cần thiết kế/review grants trước khi đưa vào migrations chính thức.
- Chưa chạy SQL, chưa thay đổi Supabase Test/Production, chưa sửa code app, chưa bật worker hoặc ghi dữ liệu Cloud.

**Bước kế tiếp:** review thiết kế RPC update có expected_version và quyền thực thi; tiếp đó thiết kế idempotency ledger/change feed theo cùng nguyên tắc chỉ draft trong repository.


---

# HỢP ĐỒNG RPC UPDATE / IDEMPOTENCY / CHANGE FEED – 18/11/2026

- Tạo `supabase/CLOUD_RPC_IDEMPOTENCY_CHANGEFEED_DESIGN.md`, commit `2569d1836ac9faa6cdf7cf8abfe15500f042b894`.
- Chốt nguyên tắc: không bật Cloud worker khi client còn UPDATE trực tiếp các bảng; row_version phải đi kèm RPC expected_version và thu hồi direct UPDATE grants tương ứng.
- Định nghĩa hợp đồng RPC theo bảng/nghiệp vụ, không nhận tên bảng/cột động; kiểm tra auth.uid, active membership, active organization và permission cụ thể; khóa row, so sánh version, trả conflict snapshot.
- Thiết kế idempotency ledger theo organization + mutationId; server tự tính payload hash, kiểm tra actor/operation/record/hash; replay trả kết quả cũ, key reuse khác payload bị từ chối; ledger và business mutation cùng transaction.
- Thiết kế change feed theo counter row được khóa trong transaction để cấp cursor commit-order; event/tombstone cùng transaction; pull phân trang và chỉ tiến cursor local sau khi apply page thành công.
- Ghi rõ các điểm chưa được giả định: phải kiểm tra pgcrypto/hash extension thực tế; phải chốt FK/delete/tombstone; quyền pull theo từng phân hệ; payload và retention.
- Chưa tạo SQL migration cho RPC/ledger/change feed; chưa sửa grants/RLS; chưa bật worker; không chạy SQL và không ghi dữ liệu lên Supabase Test/Production.

**Bước tiếp theo:** review extension/hash và quan hệ FK/delete, quyền pull; sau đó mới tạo SQL draft cho idempotency và change feed trong `supabase/drafts/`.


---

# REVIEW HASH / FK / DELETE SEMANTICS – 18/11/2026

- Tạo `supabase/CLOUD_DELETE_AND_HASH_PREREQUISITES.md`, commit `f8f9183809e0e4ace6aa55e40a5bcac2686d17cc`.
- Repository chưa khai báo pgcrypto hoặc hàm digest SHA-256. Chưa thể kết luận extension chưa bật trên Supabase runtime; cần kiểm tra metadata Test trước khi chọn cách hash. Không dùng MD5 thay thế.
- Review FK từ migration 002: assets được tasks, plans, checklist templates/results, logs, movements, asset_images tham chiếu; inventory_items được movements tham chiếu; tasks được logs tham chiếu; template/version được result tham chiếu. Nhiều FK ON DELETE RESTRICT.
- Kết luận: không đổi FK sang CASCADE; không hard-delete thiết bị/vật tư/công việc/template có lịch sử. Phải phân biệt lưu kho, ngừng hoạt động, xóa logic và tombstone đồng bộ. `archived_at` không thể thay thế `deleted_at`.
- RPC `create_asset_with_code` hiện chưa idempotent: retry sau commit có thể lỗi duplicate ID và không được tăng sequence/cấp mã lần hai. Khi thêm ledger, ledger + cấp counter + insert asset phải cùng transaction.
- Chưa tạo SQL migration cho ledger/change feed/delete; chưa chạy SQL hoặc truy vấn database runtime; không thay đổi Test/Production.
- Workflow #185 (run ID `44235551185`, commit `ee4160b2d9b93694c84c63d68ee635776ebabb78`) đã success. Workflow cho commit tài liệu tiếp theo đang chạy/đợi queue, cần kiểm tra trước khi xác nhận deploy.

**Bước kế tiếp:** tiếp tục rà soát delete/archive/restore ở UI và semantics nghiệp vụ; sau đó chuẩn bị danh sách truy vấn chỉ đọc để người vận hành kiểm tra extension/hash trên Test. Chưa viết migration phụ thuộc extension cho đến khi có kết quả xác minh.


- Bổ sung đối chiếu trực tiếp UI archive/restore/disposal vào `supabase/CLOUD_DELETE_AND_HASH_PREREQUISITES.md`, commit `5d1526bc0246c6be0c039cf7dd7af7a927901955`.
- UI xác nhận Lưu kho chỉ đặt `archivedAt`, Khôi phục bỏ `archivedAt`, Thanh lý chỉ đổi trạng thái và không phải xóa; nút Xóa vĩnh viễn hiện disabled, chờ Admin xác thực máy chủ.
- Vì vậy archive/restore/thanh lý phải là update có row_version, không được biến thành tombstone delete. Xóa vĩnh viễn là nghiệp vụ tương lai, cần RPC Admin riêng và kiểm tra FK/lịch sử.


---

# RÀ SOÁT QUÁ TRÌNH SINH / IN / QUÉT QR – 18/11/2026

- Tạo `QR_GENERATION_AND_SCAN_REVIEW.md`, commit `b27f55515c204542e94be6e9de7225b245976310`.
- Đã rà soát 3 vị trí sinh QR trong `src/App.tsx`: QR chi tiết thiết bị, tem 50×30 mm và QR trên bản in chi tiết. Cả ba đều mã hóa `ASSET:<UUID nội bộ>`.
- Scanner bỏ prefix ASSET rồi tra theo UUID hoặc mã quản lý không phân biệt hoa thường; tương thích QR cũ raw UUID, raw management code và `ASSET:<code>`. Checklist giữ kiểm tra expectedAssetId để không mở nhầm thiết bị.
- Phát hiện điểm cần quyết định: yêu cầu QR là mã truy cập nhanh riêng, không phải ID thiết bị, nhưng payload hiện chứa UUID trực tiếp. Asset model và Cloud schema chưa có QR token độc lập. Đề xuất token riêng, ngẫu nhiên, lưu bền vững, có thể cấp lại mà không đổi asset UUID/mã quản lý; giữ resolver tương thích QR đời cũ.
- Chưa xác nhận QR có cần URL deep-link hay chỉ hoạt động khi mở ứng dụng và dùng chức năng Quét QR. Hiện tại chỉ hỗ trợ quét trong ứng dụng; không tự mở trang.
- Tem đang đặt QR 17×17 mm trên tem 50×30 mm; chưa có kiểm thử máy in/điện thoại thực tế.
- Phát hiện lân cận: `buildAssetCode()` local hard-code cơ sở HP01 và bảng vị trí; sequence tính từ IndexedDB từng browser. Không đảm bảo sequence duy nhất giữa nhiều browser offline. Cloud allocator/config là luồng riêng.
- Không sửa code/DB/QR hiện hữu, không chạy SQL, không thay đổi Supabase Test/Production.
- Workflow #44235935310 cho commit `43a06bbb` đã success. Commit QR review mới cần CI kiểm tra riêng.

**Bước tiếp theo:** xác định hợp đồng QR token (token riêng hay UUID reference; QR có URL hay chỉ token) rồi mới sửa đồng bộ Asset model, generator, scanner, backup/restore, Cloud schema và migration. Giữ QR legacy trong giai đoạn chuyển đổi.


---

# CHỐT VÀ SỬA QUY TẮC QR THEO MÃ QUẢN LÝ – 18/11/2026

Người dùng xác nhận: UUID nội bộ chỉ hiển thị nhỏ trong Chi tiết thiết bị khi xem bằng quyền Admin; QR chính là mã quản lý thiết bị được mã hóa thành hình QR.

Đã sửa trực tiếp trên `main`:
- `src/App.tsx`: cả 3 vị trí QR (Chi tiết thiết bị, tem 50×30 mm, bản in chi tiết) dùng payload `value.code`, không còn mã hóa `ASSET:<UUID>`.
- Cửa sổ Chi tiết thiết bị chỉ hiển thị UUID nội bộ bằng chữ nhỏ khi `organizationRole` là `admin`; UUID không in trên tem.
- Không thay đổi UUID, mã quản lý hiện có, dữ liệu thiết bị, Dexie schema hoặc Supabase schema.
- Scanner giữ tương thích QR cũ: `ASSET:<UUID>`, UUID thô, mã quản lý thô và `ASSET:<mã quản lý>`. QR mới dùng mã quản lý thô.
- Cập nhật `QUY_UOC_MA_DINH_DANH_VA_VIET_TAT_THIET_BI.txt` và `QR_GENERATION_AND_SCAN_REVIEW.md` cho thống nhất nghiệp vụ.

Commits:
- App: `41aab9ce8e80e415a9dc7a6a3fdc6c30db5f5f2e`
- Quy ước mã: `9bd36f9e82f923342de4efca0f6275ff5847ddfd`
- QR review: `2556000a0f9e213f492b1e8c1355a328476618ce`

Chưa xác minh build/CI cho chuỗi commit trên; cần chờ workflow tương ứng. Chưa giải mã QR bằng test tự động, chưa in tem và thử camera thực tế. Không chạy SQL/migration, không ghi dữ liệu Supabase Test/Production.


---

# TIẾP TỤC RÀ SOÁT QR VÀ CLOUD INVENTORY – 18/11/2026

## QR scanner
- Đã sửa `ScanModal` để camera callback luôn đọc danh sách thiết bị, expectedAssetId và openAsset mới nhất qua refs; tránh stale closure khi dữ liệu/ngữ cảnh thay đổi trong lúc modal còn mở.
- Khi scan thành công hoặc modal unmount, callback được vô hiệu hóa và scanner được clear.
- Commit code: `26f16d19232974307eddc41dde39542c97e71c7c`.
- Cập nhật `QR_GENERATION_AND_SCAN_REVIEW.md`, commit `70ca03ec743066804fcf7d76fce4ea7750b0379d`.
- Chưa xác nhận CI của commit code; workflow của code bị cancel khi các commit kế tiếp được push. Cần chờ workflow mới nhất hoặc chạy build CI lại. Chưa thử camera/tem vật lý.

## Cloud Inventory RPC design
- Tạo `supabase/CLOUD_INVENTORY_RPC_DESIGN.md`, commit `4e5f8d4bddc0c0d29bfc76ff17bea1e30f44b64b`.
- Phát hiện từ UI: ItemModal cho sửa trực tiếp quantity; saveItem ghi item nhưng không tạo movement. Đây là đường có thể làm lệch số tồn và lịch sử.
- Thiết kế đề xuất ba RPC:
  1. `create_inventory_item`: tạo vật tư và movement tồn đầu kỳ trong cùng transaction.
  2. `update_inventory_item_metadata`: chỉ sửa metadata, tuyệt đối không nhận quantity, có expected_version.
  3. `post_inventory_movement`: Nhập/Xuất, khóa inventory row, kiểm tra tồn, cập nhật balance + append movement + idempotency + change event cùng transaction.
- UI hiện có Nhập/Xuất; chưa có Điều chỉnh riêng. Không tự quyết định semantics Điều chỉnh khi chưa thống nhất.
- Trước Cloud worker cần khóa trường quantity khi sửa vật tư cũ; số tồn chỉ đổi qua movement. Tồn đầu kỳ phải có movement riêng.
- Chưa tạo SQL/migration, chưa sửa UI, chưa gọi Supabase, không ghi Test/Production.


## Cloud Maintenance Logs – thiết kế revision append-only
- Tạo `supabase/CLOUD_MAINTENANCE_LOG_REVISION_DESIGN.md`, commit `1935501613fb9e5e8b462f181f5146a9b2752c27`.
- Local Log có dueDate, requestedBy, editHistory; Cloud `maintenance_logs` hiện thiếu các field này và được thiết kế append-only. Mapper từ chối sync nếu có field bị thiếu.
- Đề xuất giữ Log ID ổn định ở bảng root, thêm bảng `maintenance_log_revisions` lưu snapshot bất biến cho mỗi lần tạo/sửa; không UPDATE revision cũ.
- Hoàn thành Task + tạo Log cần một RPC transaction duy nhất để giữ atomicity giống local Dexie transaction.
- Permission catalog hiện có logs.create nhưng chưa xác nhận logs.update; phải chốt ai được sửa phiếu trước khi viết migration/RPC. Không tự nâng quyền.
- Chưa sửa schema/UI, chưa tạo migration, không chạy SQL, không ghi Supabase Test/Production.


---

# TỔNG KẾT ĐỢT TIẾP TỤC – 18/11/2026

Các nội dung mới trong đợt này:
- QR payload đã đổi sang mã quản lý `value.code` tại cả 3 vị trí; UUID chỉ hiển thị nhỏ cho Admin trong chi tiết thiết bị.
- Scanner đã được sửa stale closure bằng refs; callback bị vô hiệu khi scan thành công hoặc modal đóng.
- Đã tạo thiết kế RPC Kho tại `supabase/CLOUD_INVENTORY_RPC_DESIGN.md`: tạo vật tư + tồn đầu kỳ; update metadata không được sửa quantity; Nhập/Xuất phải cập nhật balance + movement nguyên tử.
- Đã tạo thiết kế revision Nhật ký tại `supabase/CLOUD_MAINTENANCE_LOG_REVISION_DESIGN.md`: giữ Log ID gốc, revision append-only; hoàn thành task + tạo log qua một RPC transaction.
- QR review: `QR_GENERATION_AND_SCAN_REVIEW.md`; quy ước QR: `QUY_UOC_MA_DINH_DANH_VA_VIET_TAT_THIET_BI.txt`.

Trạng thái kiểm thử:
- Deploy workflow #44236669550 (commit `0a7dd946`) success, xác nhận QR payload/UUID UI đã được build và deploy.
- Workflow #44237030709 (commit `70ca03ec`) success; đây là commit tài liệu sau code scanner fix, build trên tree đã bao gồm thay đổi scanner.
- Workflow cho các commit tài liệu sau cùng bị cancel do push liên tiếp; cần một workflow cuối chạy hết để xác nhận trạng thái repository hiện tại.
- Chưa kiểm thử camera thật, tem in thật hoặc giải mã QR tự động.

Giới hạn an toàn vẫn giữ:
- Chưa tạo migration mới cho Inventory/Log RPC.
- Chưa sửa UI quantity, chưa thay đổi permission catalog.
- Chưa bật Cloud worker, chưa đồng bộ nghiệp vụ.
- Không chạy SQL/migration, không ghi dữ liệu Supabase Test/Production.
- Không tạo thêm user/organization/membership; không triển khai multi-tenant test.

---

# SỬA UUID HIỂN THỊ, NGƯỜI THỰC HIỆN CHECKLIST VÀ THIẾT KẾ IMPORT ASSET – 18/11/2026

## Sửa ứng dụng
- Commit `58cddd602fa0dda1830d744283c1935b67faea6f`: loại bỏ chuỗi ký tự xuống dòng thừa `\\n` ở phần UUID trong Chi tiết thiết bị; truyền tên tài khoản đăng nhập xuống Checklist; ô Người thực hiện chuyển sang chỉ đọc và phiếu mới lưu snapshot `performedBy` từ tài khoản hiện tại.
- Commit `bef695c702c4716742d7c3926fcb1b299430fbb0`: chỉnh lại chữ ký component AssetDetailModal để truyền userName đúng một lần, tránh khai báo trùng prop.
- Nguồn tên hiện tại: `profile.fullName.trim() || userEmail`. Nếu hồ sơ chưa khai báo họ tên, phiếu sẽ lưu email đăng nhập thay vì tên mặc định “Người sử dụng”.
- Không đổi cấu trúc ChecklistResult, Dexie schema hoặc dữ liệu phiếu cũ. Phiếu đã lưu trước đây giữ nguyên tên cũ; chỉ phiếu thực hiện sau bản cập nhật mới lấy tên tài khoản tự động.
- Chưa xác nhận build/deploy CI của commit sửa mới nhất; workflow mới nhất cần được kiểm tra sau khi queue hoàn tất.

## Thiết kế import thiết bị bảo toàn UUID + mã quản lý
- Tạo `supabase/CLOUD_ASSET_IMPORT_DESIGN.md`, commit `bb091a58d0acd57e1ea8f449229a179610bdd1b8`.
- Thiết kế RPC import riêng, giữ nguyên UUID và mã quản lý hiện có; không sửa `create_asset_with_code` allocator dùng cho thiết bị mới.
- Đề xuất quyền riêng `assets.import` (Admin-only), idempotency theo mutation ID, chống trùng UUID/code, đồng bộ counter và transaction nguyên tử.
- Tách biệt `organization_settings.asset_categories` (cây danh mục) với `asset_code_config` (quy tắc sinh mã).
- Chưa chọn backup desktop/mobile làm nguồn chuẩn; không merge tự động vì UUID có thể khác giữa browser.
- Chỉ là tài liệu thiết kế; chưa tạo migration/RPC, chưa chạy SQL, chưa ghi dữ liệu lên Supabase Test/Production.

## Giới hạn tiếp tục
- Không bật Cloud worker hoặc thực hiện import trước khi chốt nguồn backup và hoàn thiện kiểm thử.
- Giữ nguyên quy tắc QR dùng mã quản lý; UUID chỉ là khóa nội bộ, hiển thị nhỏ cho Admin trong Chi tiết thiết bị.

---

# RÀ SOÁT DANH MỤC VÀ CẤU HÌNH MÃ THIẾT BỊ – 18/11/2026

- Commit `e0126a6d90d3efa14e3ee95a2b47c70368937e51`: sửa chú thích tại màn hình thêm thiết bị; nội dung cũ nói QR dùng ID nội bộ, nay khớp quyết định chính thức: QR mã hóa mã quản lý, đổi mã thì phải in lại tem.
- Commit `998857efc6f53e582923444c5626645dcac046d1`: thêm `supabase/CLOUD_ASSET_CATEGORY_AND_CODE_CONFIG_REVIEW.md`.
- Đã xác nhận customAssetCategories hiện chỉ lưu localStorage, không đi vào syncQueue; backup/restore có mang theo danh mục custom.
- Local đang hard-code cơ sở HP01 và mã vị trí; Cloud allocator dùng organization_settings.asset_code_config riêng và yêu cầu mapping category/location hợp lệ.
- Cloud settings tách asset_categories (cây danh mục) khỏi asset_code_config (quy tắc cấp mã). Cần hai RPC/quyền cập nhật độc lập, versioning và kiểm soát Admin.
- Rủi ro lớn cần giải quyết trước Cloud worker: mô hình mã cơ sở nhiều cơ sở, mã vị trí chưa gán (local dùng 99 nhưng Cloud cần config), thay category code sau khi đã cấp mã, và cập nhật counter sau import.
- Chưa tạo migration/RPC, chưa chỉnh UI cấu hình, chưa chạy SQL, chưa ghi Supabase.
- CI của commit ứng dụng trước đó `bef695c702c4716742d7c3926fcb1b299430fbb0` đã PASS build/deploy; commit chú thích mới và tài liệu hiện cần workflow riêng xác nhận.


### Chốt nguyên tắc bản nháp Local và định danh chính thức khi online (18/11/2026)

- Local tiếp tục là nơi nhập và lưu dữ liệu nghiệp vụ trước; Cloud không tự tạo thiết bị/vật tư và không cấp UUID/mã quản lý.
- Khi online: ứng dụng phải đồng bộ/đọc dữ liệu Cloud mới nhất, sau đó phía Local mới sinh UUID chính thức và cấp mã quản lý thiết bị; lưu Local + hàng đợi rồi gửi lên Cloud. Cloud chỉ kiểm tra quyền, unique, idempotency và lưu nguyên giá trị Local gửi.
- Khi offline: cho phép lưu bản nháp Local bằng ID tạm riêng, chưa có UUID chính thức và chưa có mã quản lý thiết bị chính thức. Khi online trở lại, xử lý bản nháp theo thứ tự tạo, refresh dữ liệu trước khi chính thức hóa.
- UUID chính thức chỉ được tạo khi online; không tự chuyển đổi UUID hiện có của dữ liệu cũ. ID tạm tuyệt đối không được gửi vào cột UUID Cloud.
- Vật tư áp dụng cùng quy tắc UUID tạm/chính thức. Mã vật tư hiện do người dùng nhập cần được phân biệt với UUID; không tự đổi thành mã Cloud cấp.
- Lưu dấu vết người thêm bất biến cho Thiết bị và Vật tư: họ tên tài khoản, fallback email; không thay đổi khi người khác sửa.
- Một tài khoản có tối đa một phiên PC và một phiên Mobile; đăng nhập mới cùng nền tảng vô hiệu phiên cũ, PC và Mobile vẫn được phép cùng hoạt động.
- Khi bản nháp Asset được chính thức hóa, phải chuyển tất cả FK ở Tasks, Plans, Logs, Checklist Templates/Versions/Results và queue; với Inventory phải chuyển FK Movement. Thực hiện atomic trong Dexie transaction, rollback nếu có lỗi.
- Conflict trùng mã/UUID chỉ cảnh báo; không tự đổi mã, xóa hoặc gộp. Người tạo xác minh hai thiết bị riêng hay nhập trùng một thiết bị.
- Lưu ý: một PC + một Mobile vẫn có thể hoạt động đồng thời trên hai IndexedDB riêng. Vì vậy online flow phải pull đầy đủ dữ liệu mới nhất trước khi cấp mã, đồng bộ ngay sau tạo và xử lý unique conflict. Không tuyên bố bảo đảm tuyệt đối nếu chưa có cơ chế reservation/lock số thứ tự.
- Migration 012 / RPC `create_asset_with_code` đã tồn tại trong repository nhưng không còn là hướng cấp mã cho luồng tạo thông thường. Không xóa lịch sử migration; cần rà trạng thái đã áp dụng ở Test/Production và thiết kế migration tiến về phía trước nếu cần.
- Tài liệu thiết kế chi tiết: `supabase/CLOUD_LOCAL_DRAFT_IDENTITY_DESIGN.md`.
- Đã lưu quyết định vào tài liệu tiến độ và thiết kế chi tiết tại `supabase/CLOUD_LOCAL_DRAFT_IDENTITY_DESIGN.md`.
- Commit tài liệu thiết kế: `c808b9b12084e46727a4568b2df52367aa87b547`.
- Commit cập nhật tiến độ trước đó: `703528e52897b982d6d2664d1cb99d073595442a`.
- Trạng thái: mới cập nhật tài liệu; chưa sửa mã nguồn, chưa chạy SQL/migration, chưa gọi RPC và chưa ghi dữ liệu Supabase.



### Audit triển khai bản nháp Local / UUID chính thức (18/11/2026)

- Tạo `supabase/CLOUD_LOCAL_DRAFT_IMPLEMENTATION_AUDIT.md`, commit `9f73c5b74a146031198de3c151b227b9c748f904`.
- Xác minh hiện trạng: `emptyAsset()` và `emptyItem()` sinh UUID ngay khi mở form; Asset cấp mã tại Local trong `saveAsset()`; mã vật tư hiện do người dùng nhập tay; chưa có Cloud pull/push worker theo protocol mới.
- Đã lập dependency map cho Asset ID: Tasks, Maintenance Plans, Logs, Checklist Templates/Versions/Results, syncQueue và state UI; Inventory ID: Movements, linkedAssetId và syncQueue.
- Đổi ID phải chạy trong Dexie transaction bao gồm tất cả bảng liên quan, giữ nguyên ID bản ghi con/lịch sử và rollback toàn bộ nếu lỗi.
- Không thể dùng riêng `navigator.onLine` để xác nhận dữ liệu Cloud mới nhất. Cần Auth + Cloud reachability + pull đầy đủ pagination/cursor trước khi Local cấp UUID/mã chính thức.
- Inventory code là mã nhập tay, không phải mã thiết bị tự sinh; chỉ kiểm tra trùng khi chính thức hóa, không tự đổi quy tắc mã vật tư.
- Chưa sửa mã nguồn hoặc Dexie schema, chưa chạy SQL/migration, chưa gọi RPC và chưa ghi dữ liệu Supabase. Bước tiếp theo là Phase A: thiết kế và kiểm thử helper chuyển ID + migration Dexie tương thích, sau đó mới triển khai draft UI.


---

# CHUẨN BỊ LÀM SẠCH BỘ DỮ LIỆU THỬ NGHIỆM – 18/11/2026

- Người dùng xác nhận chọn Supabase `BAOTRI-Mini-Test`; không tác động Production.
- Mục tiêu: làm sạch dữ liệu thử nghiệm Thiết bị + Vật tư và các bản ghi phụ thuộc; làm sạch Local trên trình duyệt/thiết bị hiện tại sau khi có bản sao lưu; sau đó tạo 30 thiết bị + 30 vật tư theo quy tắc Local-first mới.
- Rà soát migration 002 xác nhận nhiều FK `ON DELETE RESTRICT`: assets được tasks, plans, checklist templates/versions/results, logs, inventory movements và asset_images tham chiếu; inventory_items được inventory_movements tham chiếu. Không thể xóa riêng hai bảng cha.
- Rà soát migration 012: RPC `create_asset_with_code` vẫn là bộ cấp mã Cloud cũ, không được dùng cho luồng mới. Không sửa/xóa migration lịch sử; cần migration tiến về phía trước.
- Rà soát schema: `inventory_items` hiện chưa có unique constraint cho `(organization_id, code)`; phải bổ sung kiểm tra và ràng buộc phù hợp trước khi cho phép chính thức hóa/sync mã vật tư.
- Đã thêm `supabase/drafts/016_test_reset_preflight_READ_ONLY.sql`, commit `9a8a6079c4c3b5ac44d1728d0f22814ff7f731b4`. Script chỉ SELECT, liệt kê số lượng từng bảng theo tổ chức và membership của tài khoản hiện tại; không ghi/xóa dữ liệu.
- Giới hạn thao tác: chưa có kết nối Supabase trực tiếp trong phiên làm việc; chưa chạy bất kỳ SQL nào, chưa xóa Cloud/Local, chưa tạo dữ liệu mẫu. Người dùng cần chạy script preflight trên đúng project Test và gửi kết quả để xác định organization_id + số liệu trước khi viết/chạy script reset có phạm vi chính xác.
- Chưa bật đồng bộ; `cloudSync.ts` là luồng JSON cũ không tương thích schema chuẩn hóa và tuyệt đối không được kích hoạt lại. Cần hoàn thiện protocol Local-first, quyền ghi, unique validation, idempotency và RPC giao dịch kho trước khi sync bộ 30+30.

---

# ĐỊNH HƯỚNG MÔ HÌNH KHỞI TẠO DOANH NGHIỆP THEO NGÀNH VÀ QUY MÔ – 18/11/2026

Người dùng thống nhất định hướng: khi nhà cung cấp cấp tài khoản Admin chính đầu tiên, doanh nghiệp phải được khởi tạo từ một hồ sơ mẫu phù hợp với loại hình và quy mô hoạt động. BAOTRI Mini không áp dụng một bộ nghiệp vụ bảo trì quá chuyên sâu cho tất cả khách hàng.

## 1. Nguyên tắc kiến trúc đã thống nhất
- Một nền tảng lõi và một bộ mã nguồn BAOTRI Mini dùng chung; không phát triển một ứng dụng riêng cho từng ngành.
- Mỗi doanh nghiệp được khởi tạo từ một bộ hồ sơ cấu hình gồm: nhóm ngành, quy mô, mức độ quản lý bảo trì, quy ước mã, danh mục từ điển, phân hệ/menu và mẫu nghiệp vụ.
- Ba yếu tố phân loại ban đầu: (1) nhóm khách hàng/ngành; (2) quy mô nhỏ, trung bình, lớn; (3) mức quản lý bảo trì cơ bản, tiêu chuẩn, chuyên sâu. Hệ thống có thể đề xuất mức thứ ba theo hai yếu tố đầu, Admin được xác nhận/điều chỉnh.
- Không chỉ lấy bộ dữ liệu nhà máy rồi ẩn bớt để tạo mô hình đơn giản. Mỗi nhóm ngành cần có bộ từ điển chuyên dụng thực sự, chỉ kế thừa các thành phần lõi phù hợp.
- Menu/phân hệ thay đổi theo cấu hình, nhưng ẩn menu không đồng nghĩa xóa dữ liệu hoặc xóa chức năng. Phải tách trạng thái kích hoạt phân hệ, quyền truy cập và dữ liệu nghiệp vụ.

## 2. Cấu trúc từ điển ba tầng
1. Từ điển lõi: các khái niệm dùng chung như thiết bị, vật tư, đơn vị tính, trạng thái, công việc, mức độ ưu tiên.
2. Từ điển theo ngành: nhóm thiết bị, nhóm vật tư, loại công việc, mẫu checklist và nghiệp vụ đặc thù của từng ngành.
3. Cấu hình theo quy mô/doanh nghiệp: chọn danh mục sử dụng, tùy chỉnh tên/nhóm, bổ sung danh mục riêng, cấu hình menu, mẫu công việc và quy tắc mã.

Mỗi mục từ điển cần có định danh nội bộ bất biến, mã danh mục, tên hiển thị, loại danh mục, phạm vi ngành/quy mô, trạng thái và nguồn (lõi/ngành/doanh nghiệp). Phân biệt từ điển chuẩn do BAOTRI quản lý, từ điển tùy chỉnh của doanh nghiệp và dữ liệu thực tế phát sinh. Cập nhật từ điển chuẩn không được tự ý sửa/xóa dữ liệu thực tế đã tạo.

## 3. Quy trình onboarding dự kiến
1. Nhà cung cấp tạo/cấp quyền khởi tạo cho Admin chính đầu tiên.
2. Admin khai báo thông tin doanh nghiệp, mã doanh nghiệp và số cơ sở/mô hình cơ sở.
3. Chọn nhóm ngành.
4. Chọn quy mô.
5. Chọn hoặc xác nhận mức độ quản lý bảo trì.
6. Xem trước và xác nhận quy ước mã cho thiết bị, vật tư, công việc, cơ sở và các đối tượng cần thiết.
7. Hệ thống nạp bộ từ điển, menu/phân hệ, checklist và mẫu bảo trì tương ứng.
8. Admin rà soát, bổ sung/bỏ chọn danh mục trước khi đưa vào sử dụng.

## 4. Hồ sơ mẫu đầu tiên: Nhà nghỉ – khách sạn nhỏ
Dùng làm mô hình mẫu đầu tiên để thiết kế và kiểm chứng:
- Đặc điểm giả định: ít thiết bị, một cơ sở, một kho vật tư chung, đội bảo trì nhỏ hoặc kiêm nhiệm.
- Thiết bị gợi ý: điện (tủ điện, aptomat, đèn, ổ cắm); điều hòa; nước (máy bơm, bồn nước, phao điện); bình nóng lạnh; camera/đầu ghi; quạt và thiết bị phụ trợ.
- Vật tư gợi ý: vật tư điện, vật tư nước, vật tư điều hòa, linh kiện/phụ kiện thiết bị thông dụng và vật tư phụ. Không mặc định đưa các nhóm vòng bi công nghiệp, phớt cơ khí, gioăng công nghiệp, khí nén, dầu thủy lực vào giao diện của mô hình này.
- Vật tư phân loại theo công dụng; một vật tư có thể được liên kết với nhiều thiết bị tương thích.
- Nghiệp vụ: sửa chữa, kiểm tra định kỳ, bảo trì/bảo dưỡng đơn giản; checklist ngắn theo thiết bị. Kế hoạch bảo trì năm, phân công nhiều cấp và báo cáo kỹ thuật chuyên sâu không bắt buộc ở cấu hình mặc định.
- Một kho chung: không bắt buộc khai báo vị trí lưu kho cho từng vật tư; cấu hình vị trí phải có thể tắt theo thiết lập doanh nghiệp, không phụ thuộc localStorage riêng của từng trình duyệt/máy.

## 5. Mô hình menu và khả năng nâng cấp
- Mô hình nhỏ hiển thị các phân hệ thiết yếu: Tổng quan, Thiết bị, Vật tư, Sửa chữa/Công việc, Kiểm tra định kỳ, Nhân sự và Cài đặt.
- Mô hình lớn có thể kích hoạt thêm Checklist chuyên sâu, Kế hoạch bảo trì, Báo cáo kỹ thuật, quản lý nhiều cơ sở và phân quyền nâng cao.
- Cho phép doanh nghiệp nâng cấp từ nhỏ lên trung bình/lớn hoặc bật thêm phân hệ mà không đổi ID, mã quản lý hiện có, xóa vật tư, ghi đè checklist đã tùy chỉnh hoặc làm mất lịch sử công việc.
- Cần có version cho bộ mẫu; cập nhật mẫu của nhà cung cấp không tự động ghi đè tùy chỉnh/dữ liệu doanh nghiệp.

## 6. Kiến trúc cấu hình dự kiến
Các khái niệm cần thiết kế ở giai đoạn kiến trúc: Business Profiles, Size Profiles, Maintenance Profiles, Module Templates, Dictionary Templates, Checklist Templates, Maintenance Templates, Code Templates và Tenant Configuration. Đây là danh sách khái niệm định hướng, chưa phải quyết định tên bảng/schema cuối cùng.

- Tách cấu hình mẫu do nhà cung cấp quản lý khỏi bản cấu hình đã được khởi tạo cho từng doanh nghiệp.
- Giữ nguyên nguyên tắc Local-first đã thống nhất: dữ liệu nghiệp vụ thiết bị/vật tư/công việc được tạo tại Local trước; Cloud lưu trữ và đồng bộ, không tự sinh dữ liệu nghiệp vụ hoặc mã quản lý.
- Cấu hình cần dùng nhất quán giữa PC/Mobile và được đồng bộ theo kiến trúc đã chốt; không dùng localStorage riêng lẻ làm nguồn cấu hình cấp doanh nghiệp.
- ID nội bộ bất biến tách biệt với mã hiển thị theo quy ước doanh nghiệp; mã thiết bị/vật tư/công việc có thể cấu hình riêng. Không để thay đổi hồ sơ ngành làm thay đổi định danh bản ghi đã tồn tại.

## 7. Phạm vi và bước tiếp theo
- Đây là quyết định định hướng sản phẩm/kiến trúc; mới ghi nhận trong TIENDO, chưa sửa mã nguồn, chưa thay đổi database/schema, chưa tạo migration/RPC và chưa chạy SQL.
- Chưa xây dựng đồng loạt tất cả bộ ngành. Thứ tự dự kiến: Nhà nghỉ – khách sạn nhỏ (mẫu đầu tiên), sau đó khách sạn trung bình/lớn, tòa nhà – văn phòng, nhà máy – xưởng sản xuất và các ngành khác.
- Bước tiếp theo khi tiếp tục: thiết kế chi tiết hồ sơ mẫu Nhà nghỉ – khách sạn nhỏ (danh mục thiết bị, vật tư, công việc, checklist, menu, quy tắc mã và cấu hình một kho chung); rà soát với schema/code hiện tại rồi mới lập kế hoạch triển khai.
- Theo quy trình dự án, trước mỗi đợt code phải cập nhật mục tiêu, phạm vi, file/bảng dự kiến tác động, rủi ro và cách kiểm thử vào chính file TIENDO. Chỉ sửa code khi người dùng yêu cầu bắt đầu triển khai.


---

# THIẾT KẾ THƯ VIỆN MÔ HÌNH MẪU VÀ CẤU HÌNH DOANH NGHIỆP – 18/11/2026

- Đã tạo tài liệu kiến trúc logic `docs/BAOTRI_TEMPLATE_MODEL_DATA_ARCHITECTURE.md`, commit `c4b858a119d500027fc6c38da140710356a74dd6`.
- Chốt định hướng: một nền tảng lõi, nhiều mô hình doanh nghiệp, nhiều bộ từ điển chuyên dụng.
- Tách ba lớp: thư viện mẫu chuẩn do BAOTRI quản lý; bản cấu hình sao chép/tùy chỉnh của doanh nghiệp; dữ liệu nghiệp vụ thực tế. Mẫu không tự tạo Asset, InventoryItem, Task, Log, Movement hoặc kết quả Checklist.
- Thiết kế các trục ngành, quy mô, mức quản lý; các gói module/menu, từ điển thiết bị/vật tư/công việc, Checklist, bảo trì, cơ cấu cơ sở/kho, code profile và gợi ý permission.
- Thiết kế version release, provenance nguồn mẫu, tenant config version, preview cập nhật, conflict và nguyên tắc không ghi đè tùy chỉnh/dữ liệu thực tế.
- Mô hình `HOTEL_SMALL_BASIC` được đưa vào làm ví dụ kiểm chứng; chưa được cài vào dữ liệu doanh nghiệp.
- Giữ nguyên nguyên tắc Local-first và quyết định Local/Cloud mới nhất: Cloud không tự sinh dữ liệu nghiệp vụ hoặc mã quản lý; cấu hình doanh nghiệp phải nhất quán PC/Mobile.
- **Chỉ là tài liệu thiết kế. Chưa sửa code, chưa tạo/chạy migration, chưa ghi dữ liệu Supabase Test/Production.**
- **Thứ tự công việc:** tạm dừng triển khai thư viện mẫu; quay lại hoàn thiện và kiểm thử BAOTRI Mini hiện tại. Chỉ triển khai template engine sau khi app lõi ổn định và có kế hoạch riêng.


### Bổ sung hợp đồng dữ liệu Template Release – 18/11/2026

- Đã tạo JSON Schema `docs/schemas/baotri-template-release.schema.json`, commit `eb4a58260550f9b2618134bb3ec15b8fb54fbb9e`.
- Hợp đồng mô tả manifest/version/compatibility; hồ sơ ngành-quy mô-mức quản lý; module/menu; từ điển thiết bị/vật tư/đơn vị/công việc/trạng thái/ưu tiên; checklist; mẫu bảo trì; cơ cấu cơ sở/kho; code profile; gợi ý vai trò/quyền; quy tắc an toàn.
- JSON đã được parse kiểm tra cú pháp thành công khi tạo file. Chưa chạy JSON Schema validator chuyên dụng và chưa có package mô hình thực tế nào được phát hành.
- Schema chỉ là hợp đồng dữ liệu cho thư viện mẫu, không phải schema Dexie/Supabase và không được dùng để tạo dữ liệu nghiệp vụ trực tiếp.
- Chưa sửa code, chưa tạo/chạy migration, chưa ghi dữ liệu Test/Production.


# KẾ HOẠCH PHASE A – NỀN TẢNG ĐỊNH DANH LOCAL – 18/11/2026

## Mục tiêu
Chuẩn bị nền tảng dữ liệu cho bản nháp Local và chuyển ID tạm sang UUID chính thức trong tương lai, nhưng không bật luồng tạo draft/online finalization khi Cloud pull/push worker chưa hoàn thiện.

## Phạm vi dự kiến
- `src/db.ts`: bổ sung metadata định danh tùy chọn cho Asset/InventoryItem; Dexie v7 chỉ thêm index/field metadata và đánh dấu dữ liệu đang có là legacy, tuyệt đối không đổi ID, mã, FK hoặc xóa dữ liệu.
- `src/lib/localIdentity.ts`: helper thuần để nhận diện ID draft/UUID và lập kế hoạch rekey Asset/Inventory cùng toàn bộ FK liên quan.
- `src/App.tsx`: với bản ghi mới theo luồng hiện tại, lưu snapshot người thêm (tên, fallback email, Auth user ID) và trạng thái legacy; không đổi cách cấp mã, không thay hành vi form, không tạo draft trong đợt này.
- `tests/localIdentity.test.mjs` và `package.json`: kiểm thử helper rekey, bao gồm toàn bộ quan hệ Asset/Inventory, queue và tình huống trùng ID/ID không hợp lệ.

## Không thuộc phạm vi
- Không bật Cloud sync worker, không gọi RPC, không thay đổi Supabase schema/migration.
- Không thay đổi quy tắc tạo Asset/Inventory hiện tại, không thay mã thiết bị hoặc mã vật tư.
- Không thay đổi QR, ảnh, backup format hoặc dữ liệu đã tồn tại ngoài migration metadata an toàn.
- Không triển khai session registry PC/Mobile trong đợt này.

## Rủi ro và kiểm soát
- Rekey sai có thể làm mất liên kết lịch sử; helper phải bao phủ tasks, plans, logs, checklist templates/versions/results, movements.linkedAssetId và syncQueue của bản ghi cha.
- Giao dịch rekey thật phải chạy trong một Dexie transaction trên tất cả bảng liên quan; helper thuần được unit test trước. Không cho phép ID draft đi vào mapper Cloud.
- Dữ liệu hiện có được đánh dấu legacy, không chuyển thành draft và không đổi ID/mã.
- Nếu không thể chứng minh cập nhật đầy đủ quan hệ hoặc rollback, không tích hợp helper vào UI.

## Cách kiểm thử
- Chạy `npm run test:local-identity` và `npm run build`.
- Kiểm tra test bao phủ FK và queue; kiểm tra migration v6→v7 giữ nguyên số lượng, ID, code và timestamps.
- Kiểm tra backup/restore tương thích dữ liệu cũ và mới nếu có thay đổi payload.
- Sau khi build PASS mới yêu cầu người dùng pull và kiểm tra thao tác thực tế; không đánh dấu hoàn tất chỉ từ kiểm tra tĩnh.

**Trạng thái:** kế hoạch trước triển khai; chưa sửa code hoặc Dexie schema tại thời điểm ghi mục này.


# TRIỂN KHAI NỀN TẢNG ĐỊNH DANH LOCAL – PHASE A – 18/11/2026

## Đã cập nhật trên main
- `src/db.ts`: Dexie version 7 bổ sung `identityStatus` cho Asset/InventoryItem; migration đánh dấu bản ghi hiện có là `legacy`, không đổi ID, mã, foreign key, số lượng, timestamps hoặc lịch sử. Bổ sung helper rekey Asset và Inventory chạy trong một Dexie transaction, cập nhật các FK và queue liên quan.
- `src/lib/localIdentity.ts`: tạo namespace ID `draft:`, nhận diện UUID/ID draft, lập kế hoạch chuyển Asset và Inventory sang UUID chính thức; cập nhật Tasks, Plans, Logs, Checklist Templates/Versions/Results, Movements liên quan và queue; chặn collision hoặc mutation đang processing.
- `src/App.tsx`: bản ghi Asset/Inventory mới theo luồng hiện tại lưu snapshot người thêm (tên, fallback email, Auth user ID) và trạng thái `legacy`; chi tiết thiết bị/vật tư hiển thị Người thêm. Backup tăng version 3; restore backup cũ tự bổ sung `identityStatus=legacy` mà không đổi ID/mã.
- `src/lib/syncMapping.ts`: từ chối ID draft/foreign key draft; từ chối mapping Asset/Inventory có creator snapshot cho đến khi schema Cloud có trường tương ứng, tránh âm thầm bỏ dữ liệu.
- Thêm `tests/localIdentity.test.mjs`, bổ sung test chặn draft/creator metadata trong `tests/syncMapping.test.mjs`; workflow CI chạy cả hai bộ test.

## Các commit chính
- Thiết kế helper: `e1afe958014eabe05f63a5afb060482601b1c194`.
- Dexie v7 + transaction rekey: `8fabd84b3f13f69fa7d138ebde5acd26d14e4dd0`.
- Lưu metadata người tạo: `6a5b2d245f7a3e294920908d39359ec3d74522ee`.
- Chặn draft trong Cloud mapping: `6c835ebf698c5353e8a90539f05dd1b299cb427a` và `5eee32b42898ad88a9ae2ac0f61c482c36bf4b18`.
- Unit tests + CI: `1eea3f0a3d2381e639d062463575cad50d0876cb`, `a2c2a8d810965eb41d70b78f9d9787a0b6a03995`, `698cc316b5a9ab681dbee66e009f289d9959514d`, `2d25a22f90cd912fb3c904bde79beabcee6b327f`, `e62f33c929153f7e8a95c38f7867fb7548b7c2bc`, `c61ffe531468053b6632f6e2558c9fa31853d9a7`.
- Hiển thị Người thêm: `7c19a48f6f00f56ec8ddb73fcf3bb5026b5ec41c`.

## Xác minh tự động
- GitHub Actions run #270, ID `44316658162`, commit `7c19a48f6f00f56ec8ddb73fcf3bb5026b5ec41c`: test Cloud mapping **success**, test Local identity **success**, build Vite **success**, deploy GitHub Pages **success**.
- Link: https://github.com/Vodanhhp/DuAn_BaoTRi/actions/runs/44316658162

## Giới hạn chưa triển khai
- Luồng tạo draft offline chưa bật; `emptyAsset()`/`emptyItem()` và cách cấp mã hiện tại chưa thay đổi. Bản ghi mới trong giai đoạn chuyển tiếp vẫn ở trạng thái `legacy`.
- Helper rekey đã có transaction thực tế; unit test hiện kiểm tra kế hoạch chuyển đổi thuần, chưa có integration test IndexedDB/browser để chứng minh rollback transaction trên runtime.
- Chưa có Cloud pull/push worker; chưa xác minh Cloud mới nhất trước khi chính thức hóa; không gọi RPC và không gửi dữ liệu nghiệp vụ.
- Schema Supabase hiện chưa có `created_by_label`/`created_by_user_id`; mapper chủ động chặn các bản ghi có creator metadata, không được bật worker trước khi có migration/contract tương ứng.
- Chưa triển khai session registry một PC + một Mobile.
- Dexie v7 sẽ chạy migration khi người dùng mở phiên bản mới; cần kiểm tra trên trình duyệt hiện có dữ liệu: số lượng bản ghi, ID, mã, FK, ảnh và lịch sử phải giữ nguyên. Cần thử thêm mới Asset/Inventory, xem Người thêm và backup/restore bản cũ.

**Kết luận:** Phase A mới hoàn thành nền tảng metadata và helper rekey; chưa bật draft Local hoặc Cloud sync. Tiếp tục theo thứ tự an toàn: kiểm thử migration/runtime trên dữ liệu Local hiện có, sau đó mới thiết kế Phase B pull/push và online finalization. Không thao tác Supabase Test/Production.


# KHÉP LẠI THIẾT KẾ THƯ VIỆN MÔ HÌNH MẪU – 18/11/2026

## Kết quả hoàn tất tạm thời
- JSON Schema Draft 2020-12: `docs/schemas/baotri-template-release.schema.json`; đã sửa pattern Semantic Version và pattern thời gian RFC3339 để validator hoạt động ổn định trong CI.
- Gói mẫu đầu tiên: `templates/HOTEL_SMALL_BASIC/1.0.0.json` – Nhà nghỉ/Khách sạn nhỏ, một cơ sở, một kho chung, vị trí kho tắt, vật tư cơ bản, bảo trì đơn giản; PCCC và thang máy là tùy chọn, không bật mặc định.
- Semantic validator chỉ đọc: `scripts/validate-template-release.mjs`; kiểm tra mã duy nhất, liên kết nhóm/loại thiết bị, nhóm/vật tư/đơn vị, Checklist, bảo trì, module/menu, safety rule và code profile. Không ghi dữ liệu.
- Bộ test: `tests/templateRelease.test.mjs` – kiểm tra gói hợp lệ và các lỗi tham chiếu/định danh mẫu.
- CI đã bổ sung ba bước: kiểm tra JSON Schema bằng Ajv, test liên kết, chạy validator trên gói mẫu.
- Tài liệu kiến trúc cập nhật tại `docs/BAOTRI_TEMPLATE_MODEL_DATA_ARCHITECTURE.md`.

## Xác minh
- GitHub Actions run #273, ID `44318442365`, commit `32772a345b4dd4631c545ba4e58206bda29ee405`: test Cloud mapping PASS; test Local identity PASS; JSON Schema PASS; template reference tests PASS; validator PASS; build Vite PASS; deploy GitHub Pages PASS.
- Link: https://github.com/Vodanhhp/DuAn_BaoTRi/actions/runs/44318442365

## Phạm vi đã đóng
- Thư viện mô hình mẫu được dừng ở tầng thiết kế + JSON Schema + gói JSON + validator/test.
- Chưa tích hợp template vào app, chưa tạo onboarding nạp mô hình, chưa tạo cấu hình doanh nghiệp thật.
- Không tạo/chạy migration; không chạy SQL/RPC; không ghi dữ liệu Supabase Test/Production.
- Khi cần thiết kế ngành khác, tạo gói JSON theo schema và đối chiếu gói `HOTEL_SMALL_BASIC`; không tự động nạp vào app.

**Quyết định tiếp theo:** Tạm đóng nhánh công việc thiết kế thư viện mô hình mẫu. Quay lại BAOTRI Mini hiện tại. Việc tiếp theo là trao đổi và rà soát kiến trúc đồng bộ Local–Cloud trước khi sửa code đồng bộ; chưa bật worker hoặc thay đổi Supabase cho đến khi chốt thiết kế.


## QUYẾT ĐỊNH MỚI – KHÓA CHỈNH SỬA THIẾT BỊ GIỮA CÁC NỀN TẢNG (18/11/2026)

### 1. Phạm vi
- Đợt thiết kế/triển khai tiếp theo tập trung vào **hồ sơ thiết bị** và cơ chế khóa chỉnh sửa giữa PC/Mobile.
- Tạm thời không mở rộng xử lý xung đột vật tư, Checklist và bảo dưỡng trong đợt này. Các nghiệp vụ Checklist/bảo dưỡng vẫn được phép thực hiện Local theo quy tắc đã thống nhất; lịch sử liên quan thiết bị đang khóa chưa được đẩy lên Cloud cho đến khi khóa được giải phóng.
- Không coi màn hình Cloud hiện có là luồng đồng bộ Local–Cloud hoàn chỉnh. Hiện ứng dụng vẫn có workspace Local và màn hình quản lý thiết bị Cloud riêng; chưa có sync worker tổng thể.

### 2. Quy tắc khóa thiết bị đã thống nhất
1. Khóa theo từng thiết bị, không khóa toàn bộ hệ thống.
2. Khi một nền tảng bắt đầu chỉnh sửa hồ sơ thiết bị, nền tảng đó phải xin khóa từ Cloud trước. Chỉ khi Cloud xác nhận cấp khóa mới được phép chỉnh sửa/lưu.
3. Trong thời gian khóa, các nền tảng khác hiển thị thiết bị màu đỏ, kèm tên/người dùng hoặc nền tảng đang giữ khóa; chỉ được xem hồ sơ, không được thêm/sửa/xóa thông tin thiết bị đó.
4. Checklist, bảo dưỡng và công việc khác vẫn được thực hiện trên Local của nền tảng hiện trường. Nếu thiết bị đang bị khóa, lịch sử/các dữ liệu liên quan thiết bị đó phải chờ nhả khóa mới được đồng bộ lên Cloud.
5. Khi chủ khóa hoàn tất hoặc hủy chỉnh sửa, chủ khóa giải phóng khóa; thiết bị trở lại trạng thái bình thường và các nền tảng có thể nhận dữ liệu thiết bị mới nhất. Sau đó mới đồng bộ các lịch sử/công việc đang chờ của thiết bị.
6. Khóa Cloud có thời hạn 2 phút tính từ lần gia hạn/heartbeat hợp lệ cuối cùng. Nếu Cloud không nhận được heartbeat trong 2 phút, Cloud tự hết hạn khóa để nền tảng khác có thể xin khóa.
7. Nếu PC mất Internet trong lúc đang chỉnh sửa: PC lập tức chuyển phiên chỉnh sửa sang trạng thái khóa cục bộ do mất kết nối, không cho tiếp tục sửa/lưu. Sau 2 phút không nhận heartbeat, Cloud giải phóng khóa cho nền tảng khác. Trên PC cũ, thiết bị vẫn bị khóa cho đến khi PC kết nối lại, đồng bộ trạng thái và kiểm tra quyền khóa mới; PC cũ không được tự khôi phục quyền chỉnh sửa.
8. Nếu không xác nhận được quyền khóa từ Cloud (mất Internet, Cloud lỗi hoặc timeout), nền tảng không được chỉnh sửa hồ sơ thiết bị. Vẫn cho phép xem dữ liệu Local hiện có và tiếp tục nghiệp vụ Checklist/bảo dưỡng Local theo phạm vi được phép.
9. Khi PC kết nối lại sau khi đã mất quyền khóa, mọi thao tác lưu cũ phải bị từ chối. Không được ghi đè dữ liệu mà nền tảng khác đã cập nhật.

### 3. Yêu cầu kỹ thuật bắt buộc khi triển khai
- Cloud là nguồn có thẩm quyền duy nhất về quyền khóa dùng chung; thời gian hết hạn phải dựa trên thời gian máy chủ, không dựa vào đồng hồ client.
- Khóa phải có token/lease riêng cho từng lần cấp. Mọi heartbeat, release và cập nhật hồ sơ phải kiểm tra đúng token hiện hành; token cũ không có quyền ghi.
- Cấp khóa phải atomic để hai nền tảng không thể cùng nhận khóa cho một thiết bị.
- Client giữ trạng thái khóa cục bộ khi mất kết nối; không tự mở khóa chỉ vì Cloud đã hết hạn lease.
- Khi lưu hồ sơ thiết bị, máy chủ phải kiểm tra lease còn hiệu lực và token đúng trong cùng transaction với cập nhật dữ liệu. Chỉ kiểm tra giao diện hoặc bảng khóa ở client là không đủ.
- Khi thiết bị đang khóa, hàng đợi đồng bộ của các bản ghi liên quan thiết bị phải được giữ lại; không xóa/đánh dấu hoàn tất trước khi Cloud xác nhận.
- Mỗi bản ghi lịch sử cần idempotency để retry sau khi nhả khóa mà không sinh bản sao.
- Giao diện phải phân biệt ít nhất: đang được nền tảng khác khóa; chính máy đang giữ khóa; chính máy mất kết nối/không còn quyền; thiết bị không xác định được trạng thái khóa.

### 4. Trình tự triển khai an toàn
1. Rà soát toàn bộ luồng tạo/sửa/lưu kho/khôi phục/xóa thiết bị và quyền SQL hiện tại trên nhánh main.
2. Thiết kế bảng lease và các RPC cấp khóa, gia hạn, giải phóng; dùng server time và token.
3. Thiết kế RPC cập nhật hồ sơ thiết bị có kiểm tra lease trong cùng transaction; không để đường UPDATE trực tiếp bỏ qua khóa.
4. Soạn migration SQL và SQL test thành file để người dùng review/chạy thủ công trên BAOTRI-Mini-Test. Assistant không tự chạy SQL hoặc thay đổi Supabase.
5. Tích hợp UI khóa đỏ/xanh, tên người giữ khóa, heartbeat, xử lý mất mạng và chặn lưu trên client.
6. Kiểm thử nhiều phiên PC/Mobile, hết hạn 2 phút, mất mạng, token cũ, hai máy xin khóa đồng thời và máy cũ kết nối lại.
7. Sau khi khóa hồ sơ thiết bị được kiểm chứng, mới nối luồng đồng bộ hồ sơ và lịch sử công việc theo thứ tự: cập nhật thiết bị → xác nhận Cloud → đồng bộ lịch sử đang chờ.
8. Chưa bật đồng bộ đại trà cho vật tư, Checklist, bảo dưỡng hoặc các bảng khác trong đợt khóa thiết bị này.

### 5. Ranh giới an toàn
- Không sửa dữ liệu Local hiện có hoặc xóa IndexedDB.
- Không tự chạy migration/SQL, không thay đổi dữ liệu Supabase Test/Production.
- Không bật sync worker tổng thể hoặc tự động import dữ liệu.
- Không sửa các phân hệ vật tư, Checklist, bảo dưỡng ngoài phần cần thiết để giữ lịch sử chờ đồng bộ theo thiết bị.
- Mọi thay đổi code tiếp tục thực hiện trực tiếp trên main; cập nhật tài liệu tiến độ trước mỗi đợt sửa code.


### TRIỂN KHAI ĐỢT 1 – NỀN TẢNG KHÓA THIẾT BỊ PHÍA CLOUD (18/11/2026)

Đã tạo trên `main` hai file để chuẩn bị kiểm thử cơ chế khóa theo từng thiết bị:

- `supabase/migrations/20261118000200_asset_edit_lock_lease.sql`
  - Tạo bảng `asset_edit_locks`, khóa duy nhất theo organization + asset.
  - RPC cấp khóa nguyên tử, gia hạn heartbeat, giải phóng khóa và đọc danh sách khóa đang hiệu lực.
  - Lease hết hạn sau 2 phút theo đồng hồ máy chủ.
  - Token bí mật chỉ trả cho nền tảng giữ khóa; danh sách trạng thái không tiết lộ token.
  - RPC cập nhật hồ sơ và lưu kho/khôi phục yêu cầu đúng token còn hiệu lực.
  - Thu hồi quyền UPDATE trực tiếp bảng assets của authenticated để không thể bỏ qua khóa bằng PostgREST.
- `supabase/tests/20261118000200_asset_edit_lock_lease_test.sql`
  - Kiểm tra Admin lấy khóa, Technician không chiếm được khóa đang hiệu lực, heartbeat, token sai, release, chuyển khóa, hết hạn lease và chặn UPDATE trực tiếp.
  - Script dùng transaction và kết thúc bằng ROLLBACK.

**Trạng thái:** mới tạo và fetch lại xác minh hai file trên GitHub. Chưa chạy SQL, chưa áp dụng Migration 016 lên BAOTRI-Mini-Test hoặc Production; chưa có kết quả PASS từ PostgreSQL.

**Chưa tích hợp giao diện hoặc luồng Local–Cloud.** Mã `src/lib/assetsCloud.ts` hiện vẫn cập nhật trực tiếp bảng `assets` trong các hàm `updateCloudAsset` và `setCloudAssetArchived`; sau khi Migration 016 được áp dụng, các đường ghi này phải được thay bằng RPC có token. Chưa sửa chúng trong đợt này để tránh làm hỏng màn hình Cloud trước khi người dùng chạy migration và xác nhận SQL test.

**Lưu ý kiến trúc:** CloudAssetsPanel hiện là màn hình thao tác dữ liệu Cloud riêng, còn workspace nghiệp vụ vẫn dùng IndexedDB Local. Cần nối cơ chế khóa vào đúng luồng Local-first và đồng bộ sau khi kiểm chứng nền tảng lease; không được coi việc khóa được tạo trên Cloud là đã hoàn thành đồng bộ PC/Mobile.


### KẾ HOẠCH ĐỢT 2 – TÍCH HỢP LEASE VÀO MÀN HÌNH THIẾT BỊ CLOUD (18/11/2026)

Trước khi nối Local-first, xử lý riêng màn hình Cloud hiện có để không còn đường ghi hồ sơ bỏ qua lease:

- Tạo client service gọi RPC acquire/heartbeat/release/list lock và các RPC update/archive có token.
- Mỗi browser installation dùng device ID ổn định hiện có trong IndexedDB helper.
- Khi mở form sửa hoặc thao tác lưu kho/khôi phục, phải lấy lease thành công trước.
- Hiển thị trạng thái thiết bị bị khóa cùng nhãn người/nền tảng đang giữ; không cho thao tác khi máy khác giữ lease hoặc trạng thái không xác định.
- Heartbeat định kỳ; mất mạng/heartbeat lỗi thì form chuyển sang read-only/khóa cục bộ. Không tự lấy lại quyền khi mạng trở lại; người dùng phải kiểm tra và xin lease mới.
- Tải lại danh sách lease định kỳ để các màn hình khác cập nhật trạng thái. Lease hết hạn do server time sau 2 phút nếu không có heartbeat.
- Hủy/lưu thành công thì release đúng token. Nếu release thất bại do mất mạng, lease tự hết hạn ở Cloud.

**Ranh giới:** Đây mới là bảo vệ thao tác trong CloudAssetsPanel. Chưa áp dụng khóa vào form Local `saveAsset`, vì Local assets hiện chưa có pipeline đồng bộ hồ sơ đầy đủ và màn hình Local có thể chứa thiết bị chưa được import/mapping lên Cloud. Không được giả định Local ID luôn tồn tại trên Cloud. Sau khi Cloud lease được SQL-test và giao diện xác nhận, thiết kế tiếp mapping Local ID ↔ Cloud ID và đồng bộ Local-first trước khi khóa toàn bộ workspace.

**Trước khi áp dụng Migration 016:** phải kiểm tra lại các RPC create/import hiện có và mọi đường ghi bảng assets; các đường update/archive hiện có sẽ chuyển qua RPC lease. Không được chạy migration chỉ vì client code đã được tạo.


### TRIỂN KHAI ĐỢT 2 – CLIENT LEASE CHO MÀN HÌNH THIẾT BỊ CLOUD (18/11/2026)

Đã cập nhật trên `main`:

- `src/lib/assetEditLocks.ts`
  - Client gọi RPC đọc danh sách lease, xin khóa, heartbeat, release.
  - Cập nhật hồ sơ và lưu kho/khôi phục đều gọi RPC có token.
  - Chuyển dữ liệu row trả về từ PostgreSQL sang mô hình `Asset` Local.
- `src/db.ts`: export helper `getDeviceId()` hiện có; không thay đổi cách tạo/lưu device ID.
- `src/CloudAssetsPanel.tsx`
  - Xin lease trước khi mở form sửa và trước thao tác lưu kho/khôi phục.
  - Hiển thị người/nền tảng giữ khóa trên danh sách Cloud.
  - Poll trạng thái khóa mỗi 5 giây; heartbeat mỗi 30 giây.
  - Khi mất Internet hoặc heartbeat lỗi: form chuyển read-only, không cho lưu; không tự lấy lại quyền sau khi kết nối lại.
  - Hủy/lưu thì release đúng token; nếu không release được, Cloud tự hết hạn lease sau 2 phút.
  - Nếu không đọc được trạng thái khóa từ Cloud, mặc định chặn thao tác thay đổi.
- `src/lib/assetsCloud.ts`: đã bỏ các đường UPDATE trực tiếp hồ sơ/lưu kho/khôi phục; chỉ còn đọc danh sách và các RPC tạo/import/cấu hình hiện có.

**CI:** GitHub Actions run #297, run ID `44324086360`, commit `0be9c22166d12481931d864b6a3f12cd4cb3f16e` – completed/success. Các test mapping, local identity, template schema/reference/semantic validator và Vite build đều PASS. Run #296 trước đó thất bại vì một lần chỉnh sửa đã xóa nhầm hàm đọc danh sách Cloud; hàm đã được khôi phục và run #297 xác nhận build PASS.

**Chưa được xác nhận:**
- Chưa chạy SQL Migration 016 hoặc SQL test trên Supabase.
- Chưa kiểm thử runtime lease với hai trình duyệt/PC-Mobile.
- Chưa kiểm thử heartbeat, mất mạng và takeover thực tế.
- Chưa tích hợp khóa vào form Local `saveAsset` hoặc pipeline Local–Cloud. Workspace Local vẫn lưu IndexedDB độc lập; không được coi đợt này là đã giải quyết xung đột thiết bị trên toàn ứng dụng.
- Khi Migration 016 chưa được áp dụng, màn hình Cloud vẫn đọc danh sách, nhưng các thao tác sửa/lưu kho/khôi phục bị chặn vì không thể xác nhận lease. Đây là fail-closed có chủ đích.

**Bước tiếp theo:** rà soát SQL Migration 016 và SQL test để chuẩn bị cho người dùng tự chạy trên BAOTRI-Mini-Test; sau khi SQL test PASS mới kiểm thử CloudAssetsPanel. Tiếp đó thiết kế mapping thiết bị Local ↔ Cloud và đưa lease vào Local-first; không bật đồng bộ tổng thể.


### RÀ SOÁT TƯƠNG THÍCH MIGRATION 016 VỚI BỘ TEST BẢO MẬT CŨ (18/11/2026)

Phát hiện trước khi cho chạy Migration 016: migration thu hồi quyền UPDATE trực tiếp bảng `assets` của authenticated. Vì vậy ba test bảo mật cũ 008, 010, 011 đang chạy câu UPDATE trực tiếp để chứng minh RLS trả 0 dòng; sau Migration 016, các câu lệnh này có thể ném lỗi thiếu SQL privilege và làm test dừng giữa chừng.

Quyết định:
- Sửa ba test 008/010/011 theo hướng tương thích cả trước và sau Migration 016: chấp nhận hai kết quả an toàn tương đương là UPDATE bị SQL privilege chặn hoặc RLS trả 0 dòng; không cho phép có dòng bị thay đổi.
- Test 016 riêng sẽ kiểm tra đường update mới: chỉ RPC `update_asset_with_lock` với lease/token đúng mới được ghi.
- Bổ sung test token cũ không thể ghi sau khi lease hết hạn và nền tảng khác đã nhận khóa; bổ sung kiểm tra archive/restore qua lease.
- Không thay đổi dữ liệu Test/Production; chỉ cập nhật file test SQL.


### HOÀN TẤT RÀ SOÁT TƯƠNG THÍCH BỘ TEST SAU KHI THU HỒI UPDATE TRỰC TIẾP (18/11/2026)

Đã cập nhật các test SQL cũ để không bị hỏng khi Migration 016 thu hồi UPDATE trực tiếp trên `assets`:

- `supabase/tests/20261117000800_authenticated_asset_crud_rls_test.sql`
- `supabase/tests/20261117001000_suspended_membership_tenant_isolation_test.sql`
- `supabase/tests/20261117001100_unauthenticated_no_membership_permission_revoked_test.sql`

Các test chấp nhận đúng hai kết quả an toàn: RLS trả 0 dòng (trước Migration 016) hoặc SQL privilege chặn UPDATE (sau Migration 016). Không chấp nhận có thay đổi trái quyền. Test 008 không còn coi UPDATE trực tiếp là đường ghi hợp lệ sau Migration 016; test 016 riêng xác nhận chỉ RPC với token lease hợp lệ được cập nhật.

Bổ sung vào test 016:
- Archive và restore phải có lease hợp lệ.
- Token Mobile cũ không được ghi sau khi lease hết hạn và Admin/PC đã tiếp quản.
- Tiếp tục kiểm tra heartbeat của token hết hạn, thay lease và chặn direct UPDATE.

**CI:** GitHub Actions run #304, ID `44324948772`, commit `a9256b9aaa03347ccb8bc28589903efaf92f90a8` – completed/success; Vite build PASS. Đây chỉ là TypeScript/build và các test tự động đang có trong workflow; các file SQL vẫn chưa được thực thi trên PostgreSQL/Supabase.

**Trạng thái SQL Migration 016:** đã rà soát schema gốc, xác nhận FK kép `(organization_id, asset_id)` tham chiếu unique `assets(organization_id, id)`, các cột hồ sơ và trạng thái phù hợp. Chưa áp dụng migration và chưa chạy bất kỳ SQL test nào trên BAOTRI-Mini-Test.


### SỬA LỖI TEST 016 – MÔ PHỎNG LEASE HẾT HẠN (18/11/2026)

Người dùng chạy Test SQL 016 và gặp lỗi CHECK constraint `asset_edit_locks_expiry_order`: test chỉ đẩy `expires_at` về quá khứ, trong khi `acquired_at` vẫn ở thời điểm hiện tại. Điều này tạo bản ghi sai thứ tự thời gian và bị PostgreSQL từ chối.

Đã sửa file `supabase/tests/20261118000200_asset_edit_lock_lease_test.sql` trên `main`, commit `d95c8126373808834424d74b13f8dd016fb2a7d6`:
- `acquired_at = clock_timestamp() - interval '2 seconds'`
- `expires_at = clock_timestamp() - interval '1 second'`
- `updated_at = clock_timestamp()`

Giữ nguyên CHECK constraint của bảng; không sửa Migration 016 và không nới lỏng bảo vệ thứ tự timestamp. Đã fetch lại file trên GitHub xác nhận đúng nội dung. CI run #306 được tạo cho commit sửa test và đang queued tại thời điểm ghi nhận.

**Yêu cầu:** chạy lại riêng Test SQL 016 bằng phiên bản mới trên `main`. Migration 016 không cần chạy lại nếu lần áp dụng trước đã thành công.


### XÁC NHẬN KIỂM THỬ SQL SAU MIGRATION 016 (18/11/2026)

Người dùng đã tự chạy trên môi trường BAOTRI-Mini-Test và xác nhận PASS toàn bộ các bài kiểm thử:
- Test SQL 008 – CRUD/RLS thiết bị.
- Test SQL 010 – thành viên bị đình chỉ và cô lập tenant.
- Test SQL 011 – truy cập unauthenticated, không có membership và thu hồi quyền.
- Test SQL 016 – lease khóa chỉnh sửa thiết bị, heartbeat, release, hết hạn/chuyển khóa và cập nhật qua token.

Các script kiểm thử sử dụng transaction/ROLLBACK theo nội dung file. Kết quả PASS là do người dùng trực tiếp xác nhận; assistant không kết nối hoặc thực thi SQL trên Supabase.

**Bước tiếp theo – kiểm thử runtime riêng CloudAssetsPanel:**
1. Dùng hai phiên đăng nhập khác nhau trên hai trình duyệt/thiết bị (PC và Mobile), cùng tổ chức Test.
2. Trên PC, mở Cloud quản lý thiết bị và bắt đầu sửa thiết bị A; xác nhận form chỉ mở sau khi lấy lease.
3. Trên Mobile, tải/đợi cập nhật danh sách; xác nhận thiết bị A hiển thị người/nền tảng đang giữ khóa và không cho sửa/lưu kho/khôi phục.
4. Trên PC, hủy chỉnh sửa; xác nhận Mobile thấy khóa được giải phóng và có thể xin khóa.
5. Lặp lại với PC lưu thay đổi; xác nhận Mobile nhận dữ liệu mới sau khi tải lại.
6. Kiểm tra mất mạng khi đang giữ khóa: phiên giữ khóa phải khóa cục bộ và không lưu; sau khi lease hết hạn, thiết bị khác có thể xin khóa; phiên cũ không được tự khôi phục quyền khi có mạng lại.
7. Kiểm tra lease tự hết hạn khi ngừng heartbeat đủ 2 phút. Không rút ngắn thời gian trong production.

**Giới hạn còn lại:** kiểm thử runtime hai phiên chưa được người dùng xác nhận. Cơ chế lease hiện mới được tích hợp trong CloudAssetsPanel; form Local-first trong App.tsx và pipeline Local–Cloud chưa được nối. Không tuyên bố khóa liên nền tảng toàn ứng dụng đã hoàn tất. Chưa bật sync worker, chưa đồng bộ hàng đợi lịch sử, chưa thay đổi Migration hoặc dữ liệu Supabase.


### RÀ SOÁT LUỒNG LOCAL-FIRST TRƯỚC KHI TÍCH HỢP KHÓA (18/11/2026)

Đã đọc lại src/App.tsx, src/db.ts, src/lib/assetEditLocks.ts và src/lib/assetsCloud.ts trên main. Chưa sửa code ở bước rà soát này.

#### 1. Các điểm ghi hồ sơ thiết bị Local hiện tại
- saveAsset: tạo mới/sửa hồ sơ trong IndexedDB; trong cùng transaction ghi assets và syncQueue.
- archiveAsset, restoreAsset, changeAssetStatus: ghi trực tiếp Local qua putAndQueue.
- Checklist, task, log và maintenance plan tiếp tục lưu Local theo các luồng riêng.
- syncQueue hiện đã có khóa duy nhất theo (tableName, recordId), mutationId và trạng thái retry; tuy nhiên chưa có cơ chế trì hoãn theo asset lock và chưa có sync worker tổng thể được bật.
- Xóa thiết bị không tìm thấy trong các điểm ghi vừa rà soát; cần tìm toàn repo trước khi triển khai để không bỏ sót đường xóa/ẩn hoặc thao tác hàng loạt.

#### 2. Ràng buộc nhận diện Local ↔ Cloud
- RPC import_asset_preserving_identity hiện hỗ trợ nhập hồ sơ Local lên Cloud bằng chính UUID và mã quản lý Local, có kiểm tra idempotency/counter.
- RPC lease khóa Cloud tham chiếu assets(organization_id, id). Do đó Local chỉ có thể xin lease khi hồ sơ thiết bị tương ứng đã tồn tại trên Cloud trong đúng organization.
- Không được tự suy đoán mapping chỉ dựa trên tên/mã; không được tự động ghi đè hồ sơ Cloud đang có.
- Phương án an toàn: bước chuẩn bị mapping/import phải có preview, xác nhận trùng UUID/mã và xử lý xung đột; chỉ thiết bị đã xác nhận có Cloud counterpart mới được mở chức năng sửa hồ sơ Local có khóa. Thiết bị chưa mapping hoặc Cloud chưa xác minh được thì chỉ xem hồ sơ, vẫn cho phép Checklist/bảo dưỡng Local như quy tắc đã chốt.
- Việc import lần đầu là thao tác khởi tạo dữ liệu có chủ đích, không phải sync worker tự chạy nền.

#### 3. Thiết kế kỹ thuật cho đợt Local tiếp theo
1. Tạo một service dùng chung quản lý lease cho Local UI: acquire trước khi mở form; heartbeat; release khi lưu/hủy; trạng thái fail-closed khi offline/timeout/lỗi.
2. Không chỉ khóa nút giao diện: saveAsset, archiveAsset, restoreAsset, changeAssetStatus phải đi qua cùng một lớp kiểm soát quyền lease. Token không được lưu lâu dài trong Local DB hoặc syncQueue.
3. Sửa saveAsset theo hướng tách rõ tạo mới và cập nhật hồ sơ đã tồn tại. Tạo mới cần cơ chế cấp mã/ID và quyền tạo riêng; không được tự ý dùng lease của một asset chưa tồn tại.
4. Mọi thao tác cập nhật hồ sơ đã mapping phải xác minh lease hiện hành từ Cloud trước khi cho phép ghi Local. Khi lưu Local thành công, giữ mutation trong queue; chưa đánh dấu synced.
5. Lịch sử Checklist/task/log/maintenance plan liên quan asset đang khóa tiếp tục được ghi Local. Khi triển khai sync worker sau này, worker phải kiểm tra trạng thái lease và chỉ đẩy lịch sử sau khi khóa được giải phóng; mỗi mutation retry phải idempotent.
6. Cần cơ chế thông báo khóa liên nền tảng cho workspace Local (poll/realtime) nhưng Cloud vẫn là nguồn quyết định. Mất mạng khi đang sửa phải khóa form ngay; reconnect phải refresh và xin lease mới, tuyệt đối không hồi sinh token cũ.
7. Bổ sung test cho từng đường ghi hồ sơ, hai nền tảng tranh lease, offline/timeout, lease hết hạn, stale token, mapping thiếu và retry hàng đợi. Không bật worker đồng bộ trong đợt này.

#### 4. Phạm vi an toàn
- Chưa sửa App.tsx, db.ts, migration hoặc dữ liệu Local/Cloud.
- Chưa tạo bảng mapping mới; cần đánh giá liệu giữ UUID thống nhất hiện có đã đủ hay cần mapping riêng cho các trường hợp legacy trước khi viết migration.
- Chưa bật sync worker và chưa đẩy bất kỳ hàng đợi Checklist/bảo dưỡng nào lên Cloud.
- Chỉ bắt đầu tích hợp Local sau khi kiểm thử runtime CloudAssetsPanel bằng hai phiên thật và xác nhận kết quả.

CI: GitHub Actions run #308, commit 22bf7f2b697ed802dd961832ce403c1b2173b599, completed/success. Đây là build/deploy workflow; không thay thế kiểm thử runtime hai phiên hoặc PostgreSQL.


### BỔ SUNG ĐIỀU KIỆN GIỮ LEASE KHI LƯU HỒ SƠ TỪ LOCAL (18/11/2026)

Rà soát sâu hơn cho thấy không được giải phóng lease ngay sau khi IndexedDB lưu xong nhưng Cloud chưa xác nhận cập nhật. Nếu làm vậy, nền tảng khác có thể lấy khóa và sửa bản Cloud cũ trước khi mutation Local được đồng bộ, gây ghi đè hoặc xung đột.

Quy tắc bắt buộc cho thiết kế Local:
1. Khi sửa hồ sơ Local đã mapping, phải lấy lease Cloud trước khi mở form; tiếp tục heartbeat trong cả thời gian sửa và thời gian chờ Cloud xác nhận.
2. Lưu Local trước theo local-first và ghi mutation vào syncQueue trong transaction. Sau đó gửi chính mutation hồ sơ lên RPC Cloud có token hiện hành.
3. Chỉ khi Cloud xác nhận cập nhật thành công mới được đánh dấu mutation tương ứng hoàn tất và release lease; sau đó mới cho thiết bị khác sửa.
4. Nếu Cloud từ chối, timeout hoặc mất mạng sau khi Local đã lưu, giữ mutation ở trạng thái pending/failed, khóa cục bộ hồ sơ đó và không tự release lease khi vẫn có thể heartbeat. UI phải báo rõ Local đã lưu nhưng Cloud chưa xác nhận.
5. Nếu lease hết hạn hoặc bị nền tảng khác tiếp quản trước khi mutation được Cloud xác nhận, token cũ bị từ chối. Không tự retry mutation bằng token mới và không ghi đè dữ liệu Cloud; chuyển hồ sơ sang trạng thái conflict cần quy trình đối chiếu có chủ đích.
6. Không được tuyên bố hai nền tảng có dữ liệu đồng nhất cho đến khi Cloud xác nhận và nền tảng còn lại tải/nhận phiên bản mới.

Do đó, phần Local lock và đồng bộ hồ sơ thiết bị phải được thiết kế như một luồng nguyên tử logic gồm: Local transaction → Cloud RPC có lease → xác nhận → release. Đây là đồng bộ hẹp riêng hồ sơ thiết bị, không phải bật sync worker tổng thể cho các bảng khác. Chưa triển khai code cho đến khi thiết kế xử lý rõ timeout, lease hết hạn, retry và conflict.


### THIẾT KẾ ĐỢT LOCAL–CLOUD: ĐỒNG BỘ HỒ SƠ THIẾT BỊ CÓ LEASE VÀ IDEMPOTENCY (18/11/2026)

Đã rà soát thực tế:
- App.tsx: saveAsset ghi assets + syncQueue trong cùng IndexedDB transaction; archiveAsset, restoreAsset, changeAssetStatus ghi qua putAndQueue.
- db.ts: SyncItem có mutationId nhưng queueChange tự sinh mutationId mới khi coalesce; chưa có base Cloud version, trạng thái mapping theo organization hoặc trạng thái conflict chi tiết.
- assetsCloud.ts: có listCloudAssets và import_asset_preserving_identity; import giữ nguyên UUID/mã Local, CloudAssetsPanel có preview so khớp hồ sơ trước khi import.
- Migration 016: update_asset_with_lock và set_asset_archived_with_lock xác minh token, nhưng chưa có biên nhận idempotency cho trường hợp Cloud đã commit mà client mất response.
- Checklist/task/log/maintenance plan có các queue riêng; không được đưa vào đợt đồng bộ này.

#### A. Mapping thiết bị Local ↔ Cloud
1. Chỉ xác nhận mapping khi Cloud có đúng organization_id + UUID + mã quản lý trùng Local; không dò ghép theo tên/model.
2. Nếu UUID trùng nhưng mã khác, hoặc mã trùng nhưng UUID khác, đưa vào trạng thái conflict; không import ghi đè.
3. Thiết bị mới được tạo ở Local trước. Chỉ sau preview/đối chiếu mới dùng luồng import preserving identity để tạo bản Cloud mirror với nguyên UUID/mã Local. Đây là import có chủ đích, không phải Cloud tự sinh ID/mã.
4. Thiết bị chưa có counterpart đã xác minh: không mở chức năng sửa hồ sơ master có khóa liên nền tảng. Checklist/bảo dưỡng Local vẫn hoạt động.
5. Mapping phải gắn organization_id, vì cùng Local UUID không được tự động coi là đã map trong một organization khác.

#### B. Metadata Local cần bổ sung
Không nhồi token lease vào Asset hoặc SyncItem. Đề xuất bảng IndexedDB riêng assetSyncState, khóa theo organization_id + asset_id, gồm:
- mappingStatus: unmapped | mapped | conflict;
- cloudUpdatedAt: phiên bản Cloud cuối cùng đã xác nhận;
- syncStatus: synced | pending | conflict;
- pendingMutationId, baseCloudUpdatedAt, lastError, updatedAt;
- conflictCloudSnapshot (nếu có) để giữ bản Cloud tại thời điểm phát hiện xung đột.

SyncQueue tiếp tục là hàng đợi bền vững; bổ sung khả năng truyền mutationId có sẵn và baseCloudUpdatedAt cho riêng mutation assets. Không sinh mutationId mới khi retry cùng một giao dịch. Không xóa queue trước xác nhận Cloud. Không cho phép sửa tiếp cùng asset khi đang pending/conflict.

Lease token chỉ nằm trong bộ nhớ phiên đang sửa; không ghi vào IndexedDB, localStorage hoặc syncQueue. Khi reload/reconnect không được khôi phục quyền từ token cũ.

#### C. Migration/RPC Cloud kế tiếp – chưa tạo/chưa chạy
Đề xuất migration 017 bổ sung bảng biên nhận asset_mutation_receipts, không cho client truy cập trực tiếp:
- khóa duy nhất (organization_id, mutation_id);
- asset_id, applied_by_user_id, payload jsonb, result_snapshot jsonb, applied_at.
- Giữ biên nhận đủ lâu để retry sau mất response vẫn nhận được kết quả cũ; chưa thiết kế job xóa tự động.

RPC mới apply_asset_mutation_with_lock:
1. Nhận organization, asset, token lease, mutationId, expectedCloudUpdatedAt và payload hồ sơ.
2. Tìm receipt theo organization + mutationId trước. Nếu đã áp dụng bởi cùng user, cùng asset và payload giống hệt thì trả lại kết quả đã ghi (idempotent), kể cả lease cũ đã hết hạn; nếu payload khác thì từ chối.
3. Nếu chưa có receipt: khóa hàng lease và hàng asset trong cùng transaction; kiểm tra user/token/expiry, permission, organization và expectedCloudUpdatedAt.
4. Nếu expectedCloudUpdatedAt không khớp Cloud hiện tại thì trả conflict, không update.
5. Cập nhật asset và insert receipt trong cùng transaction. Không có trường hợp asset update thành công mà receipt không được ghi.
6. Bao phủ cả sửa trường hồ sơ, trạng thái, lưu kho và khôi phục. Không để các đường ghi Local khác bỏ qua RPC.
7. Không dùng service_role ở client; mọi quyền vẫn kiểm tra trong RPC.

Lý do cần receipt: nếu Cloud commit thành công nhưng response bị mất, client retry cùng mutationId/payload sẽ nhận lại kết quả đã commit thay vì cập nhật lần hai hoặc bị hiểu nhầm là thất bại. Nếu không có receipt và lease đã hết hạn/bị thay thế, client không được tự xin token mới để gửi lại mutation cũ.

#### D. Luồng cập nhật Local đề xuất
1. Chặn sửa nếu mapping chưa xác minh, đang pending/conflict hoặc Cloud không truy cập được.
2. Xin lease Cloud. Sau khi nhận lease, đọc snapshot Cloud hiện tại; so sánh updated_at với cloudUpdatedAt đã lưu. Nếu khác, không mở form; lưu snapshot và chuyển conflict để đối chiếu.
3. Khi người dùng lưu, trong một IndexedDB transaction: ghi Asset Local, ghi SyncQueue với mutationId cố định, ghi assetSyncState pending + baseCloudUpdatedAt. Local là nơi ghi thao tác trước.
4. Gọi apply_asset_mutation_with_lock với đúng token, mutationId, baseCloudUpdatedAt và snapshot vừa lưu; heartbeat liên tục trong thời gian chờ.
5. Chỉ sau response xác nhận (hoặc retry cùng mutationId nhận receipt đã commit) mới đánh dấu mutation đã xác nhận, cập nhật cloudUpdatedAt và nhả lease. Nếu release thất bại thì lease tự hết hạn; không coi đây là lỗi mất dữ liệu.
6. Khi response không rõ kết quả, giữ queue pending và thử lại cùng mutationId/payload/token trong lúc lease còn hiệu lực. Không sinh mutationId mới.
7. Nếu lease hết hạn/bị thay thế và receipt không tồn tại, chuyển conflict; giữ nguyên bản Local và queue, không tự gửi lại bằng token mới, không ghi đè Cloud.
8. Khi receipt cho biết mutation đã commit nhưng Cloud đã có bản cập nhật mới hơn, đánh dấu mutation cũ đã được áp dụng nhưng không ghi snapshot cũ đè lên Cloud mới; tải snapshot Cloud hiện tại và đưa vào đối chiếu nếu Local còn khác.
9. Chỉ giải quyết conflict bằng thao tác có chủ đích sau khi hiển thị rõ bản Local và bản Cloud; không tự chọn bản mới nhất theo đồng hồ thiết bị.

#### E. Lịch sử Checklist/bảo dưỡng
- Trong đợt này, Checklist, task, log, maintenance plan vẫn chỉ ghi Local theo các luồng đang chạy.
- Không đưa các queue đó lên Cloud và không thay đổi trạng thái synced.
- Thiết kế sync worker lịch sử là đợt riêng sau khi luồng hồ sơ thiết bị ổn định; khi đó worker mới được kiểm tra lease và thứ tự phụ thuộc asset.

#### F. Ma trận kiểm thử bắt buộc trước khi bật
1. Mapped asset, Cloud/local version trùng: acquire → Local transaction → RPC → receipt → release PASS.
2. UUID/code mismatch hoặc asset chưa mapped: chặn sửa; không tạo lease sai organization.
3. Cloud updated_at thay đổi trước khi mở form: phát hiện conflict, không ghi.
4. Hai nền tảng acquire đồng thời: đúng một lease được cấp.
5. RPC commit nhưng response bị cắt: retry cùng mutationId trả receipt, không update lần hai.
6. Retry cùng mutationId nhưng payload khác: bị từ chối.
7. RPC chưa commit, lease hết hạn và platform khác lấy khóa: token cũ bị từ chối; queue Local giữ nguyên và chuyển conflict.
8. Mất mạng khi đang sửa: form khóa ngay, không nhận save; không tự khôi phục quyền khi reconnect.
9. Release RPC lỗi sau khi Cloud đã commit: mutation vẫn được xác nhận; lease hết hạn theo TTL.
10. Reload trình duyệt khi pending: không khôi phục token; giữ queue và chạy quy trình receipt/conflict an toàn.
11. Người khác cập nhật Cloud sau khi mutation cũ commit: retry receipt không được ghi đè snapshot mới.
12. Kiểm tra riêng archive/restore/status để chắc chắn không có đường ghi bỏ qua lease.
13. Kiểm tra Checklist và bảo dưỡng vẫn lưu Local bình thường trong lúc thiết bị đang bị khóa.

#### G. Trạng thái thực hiện
- Đây là thiết kế kỹ thuật, chưa thay đổi code Local, chưa tạo migration 017, chưa thực thi SQL.
- Không bật đồng bộ hàng đợi tổng thể; không đẩy Checklist/task/log/maintenance/inventory.
- Trước khi code, cần triển khai theo lát nhỏ: (1) migration + SQL test receipt/RPC; (2) metadata IndexedDB và helper queue; (3) Local UI acquire/heartbeat/fail-closed; (4) Local save/status/archive/restore qua RPC; (5) test hai nền tảng và offline.
- Không mở rộng qua xóa thiết bị hoặc các bảng nghiệp vụ khác.

CI: run #310 cho commit 8b26aae3d1728e2f4f92ce6b240ab60a9a81afd7 completed/success. CI chỉ xác nhận workflow/build; không kiểm thử SQL hoặc runtime hai nền tảng.


### TRIỂN KHAI ĐỢT 1 – BIÊN NHẬN IDEMPOTENCY CHO HỒ SƠ THIẾT BỊ (18/11/2026)

Đã bắt đầu triển khai theo lát nhỏ, chỉ thêm nền tảng RPC/biên nhận; chưa nối vào luồng Local UI và chưa bật sync.

#### File mới/sửa
- Mới: supabase/migrations/20261118000300_asset_mutation_receipts.sql (Migration 017).
- Mới: supabase/tests/20261118000300_asset_mutation_receipts_test.sql.
- Sửa: src/lib/assetEditLocks.ts – thêm applyAssetMutationWithEditLock(...).

#### Nội dung Migration 017
- Bảng asset_mutation_receipts lưu mutationId, organization, asset, user, expected Cloud version, payload và snapshot kết quả.
- Client không được truy cập trực tiếp bảng receipt.
- RPC apply_asset_mutation_with_lock:
  - xác thực permission assets.update;
  - kiểm tra receipt trước để khôi phục kết quả khi response cũ bị mất;
  - khóa lease row, kiểm tra token và hạn lease;
  - khóa asset row, so sánh updated_at với expectedCloudUpdatedAt;
  - cập nhật hồ sơ và ghi receipt trong cùng transaction;
  - từ chối dùng lại mutationId với payload khác hoặc từ user/asset khác.
- Payload dùng chung cho sửa hồ sơ, thay đổi trạng thái, lưu kho/khôi phục; tránh nhiều đường cập nhật Local bỏ qua kiểm soát.

#### Client helper
- applyAssetMutationWithEditLock gửi đúng mutationId, token, expected Cloud version và snapshot hồ sơ.
- Helper chỉ là hàm chưa được gọi từ App.tsx; không thay đổi hành vi ứng dụng hiện tại.

#### Trạng thái kiểm thử
- Chưa chạy Migration 017 hoặc SQL test 017 trên Supabase. Người dùng vẫn là người thực thi SQL trên BAOTRI-Mini-Test.
- SQL test 017 được viết cho: receipt replay, payload mismatch, replay khác user, stale Cloud version, wrong token, archive field và quyền đọc bảng receipt.
- CI run #312 (commit tạo migration ban đầu) completed/success; CI không thực thi PostgreSQL. Các run #313–#315 bị cancelled khi commit mới thay thế. Run #316 cho client helper đang in_progress tại thời điểm ghi.
- Chưa tích hợp helper vào App.tsx; chưa thêm bảng assetSyncState; chưa chặn UI Local; chưa bật sync worker.
- Migration 017 chỉ được xem là bản đề xuất cho Test sau khi review SQL test và chờ người dùng chạy thủ công; tuyệt đối chưa áp dụng Production.

---

## Cập nhật tiến độ – 18/11/2026 (khóa chỉnh sửa và giao dịch đồng bộ hồ sơ thiết bị)

### 1. Hạ tầng khóa chỉnh sửa Cloud – Migration 016
- Đã có Migration 016: `supabase/migrations/20261118000200_asset_edit_lock_lease.sql`.
- Đã có SQL Test 016; người dùng xác nhận chạy PASS.
- Các SQL Test 008, 010 và 011 cũng đã được người dùng xác nhận PASS sau khi điều chỉnh để tương thích với việc thu hồi quyền UPDATE trực tiếp trên bảng `assets`.
- Cloud management panel đã tích hợp yêu cầu khóa, heartbeat, release và các thao tác cập nhật/lưu kho/khôi phục có xác thực lease.
- Phạm vi hiện tại chỉ là Cloud management panel; màn hình thiết bị Local trong `src/App.tsx` chưa tích hợp khóa. Chưa được coi là khóa liên nền tảng PC/Mobile/Cloud hoàn chỉnh.

### 2. Đợt bổ sung biên nhận giao dịch – Migration 017
Các thành phần đã được xác minh tồn tại trên nhánh `main`:
- Migration: `supabase/migrations/20261118000300_asset_mutation_receipts.sql`.
- SQL Test: `supabase/tests/20261118000300_asset_mutation_receipts_test.sql`.
- RPC: `apply_asset_mutation_with_lock`.
- Client helper: `applyAssetMutationWithEditLock()` trong `src/lib/assetEditLocks.ts`.
- Các commit triển khai gần nhất:
  - `9a5141ec8cb293217e6155b248f7ce2b63c4c70b` – bổ sung kiểm thử biên nhận idempotent.
  - `9854f93d0109421e39475c767b17e0ef7bdda964` – tăng cường kiểm tra lease cho mutation.
  - `c8f4733687715991ebf185900b283f3794cb161d` – sửa test giữ token lease đã acquire.
  - `ad54c43bddf14323565a5b56053d0297155ac52b` – bổ sung client helper dùng biên nhận giao dịch.
  - `aa493d01c13cbfe7b8db4273786dab17c42f3fb5` – cập nhật tài liệu tiến độ.
- GitHub Actions run #317 (commit `aa493d01c13cbfe7b8db4273786dab17c42f3fb5`) đã hoàn tất với kết quả SUCCESS.
- **Lưu ý:** Migration 017 và SQL Test 017 mới được đưa lên repository; chưa có xác nhận người dùng đã chạy migration hoặc SQL Test 017 trên Supabase. Không đánh dấu SQL Test 017 PASS.

### 3. Quy tắc an toàn đồng bộ hồ sơ thiết bị đã chốt
- Luồng dự kiến: Local lưu thay đổi → gửi mutation lên Cloud bằng RPC xác thực lease → Cloud xác nhận → mới đánh dấu mutation hoàn tất và release lease.
- Không release lease trước khi Cloud xác nhận cập nhật.
- Nếu Cloud đã commit nhưng phản hồi bị mất, gửi lại cùng `mutationId` phải nhận biên nhận cũ, không áp dụng mutation lần thứ hai.
- Cùng `mutationId` nhưng payload khác phải bị từ chối.
- Kiểm tra phiên bản Cloud trước khi ghi để không ghi đè dữ liệu mới hơn.
- Token lease hết hạn/bị thay thế không được dùng lại; nếu phát hiện xung đột thì chuyển sang xử lý xung đột, không tự lấy token mới để ghi đè.
- Không xóa hoặc đánh dấu mutation đã đồng bộ trước khi nhận xác nhận từ Cloud.
- Chưa bật worker đồng bộ tổng quát; không mở rộng đồng bộ sang vật tư, checklist, bảo dưỡng hoặc các bảng khác.

### 4. Trạng thái Local và phạm vi chưa triển khai
- Client helper `applyAssetMutationWithEditLock()` đã có trong `src/lib/assetEditLocks.ts`, nhưng chưa được nối vào luồng lưu thiết bị trong `src/App.tsx`.
- Chưa bổ sung hoàn chỉnh metadata mapping Local↔Cloud, trạng thái đồng bộ và xử lý xung đột trong IndexedDB.
- Chưa tích hợp khóa vào biểu mẫu chỉnh sửa thiết bị Local.
- Chưa xác minh bằng kiểm thử thực tế hai phiên PC/Mobile đồng thời.
- Các luồng Local hiện tại và hàng đợi `syncQueue` chưa được chuyển sang cơ chế đồng bộ hồ sơ mới.

### 5. Việc tiếp theo khi tiếp tục
1. Người dùng chạy Migration 017 và SQL Test 017 trên môi trường Supabase Test; chỉ ghi PASS khi người dùng xác nhận kết quả.
2. Rà soát kỹ schema Local, cấu trúc `syncQueue`, các luồng thêm/sửa/lưu kho/khôi phục/trạng thái và cơ chế mapping UUID Local↔Cloud.
3. Hoàn thiện quy tắc versioning, idempotency, retry, queue coalescing và xử lý conflict; đặc biệt không để mutation mới ghi đè mutation cũ chưa được xác nhận.
4. Cập nhật tài liệu trước khi sửa code; sau đó mới tích hợp luồng khóa vào màn hình Local theo từng phần nhỏ.
5. Kiểm thử hai phiên đăng nhập/PC-Mobile và các tình huống mất mạng, timeout, lease hết hạn, phản hồi Cloud bị mất.

### 6. Nguyên tắc bắt buộc khi làm tiếp
- Làm trực tiếp trên nhánh `main`, không tạo nhánh mới hoặc PR trung gian.
- Đọc phiên bản file mới nhất trên `main` trước khi sửa.
- Không tự chạy SQL/migration trên Supabase; người dùng thực hiện và báo kết quả.
- Không bật đồng bộ đại trà, không thay đổi dữ liệu nghiệp vụ hoặc thực hiện thao tác destructive.
- Giữ nguyên các chức năng Local đang hoạt động; chỉ sửa đúng phạm vi đã xác định.
- Không tuyên bố chức năng hoàn tất chỉ vì code/migration đã tồn tại; phải phân biệt rõ code đã có, SQL đã chạy, kiểm thử đã PASS và kiểm thử runtime thực tế.

---

## RÀ SOÁT CHI TIẾT LOCAL DB / SYNC QUEUE TRƯỚC KHI TÍCH HỢP LEASE (18/11/2026)

Đã đọc trực tiếp các file mới nhất trên `main`:
- `src/db.ts` (Dexie schema hiện có đến version 7).
- `src/App.tsx` (luồng save/edit/archive/restore/status của Asset).
- `src/lib/assetEditLocks.ts`.
- `src/lib/assetsCloud.ts`.
- `src/lib/localIdentity.ts`.
- `supabase/migrations/20261118000300_asset_mutation_receipts.sql`.
- `supabase/tests/20261118000300_asset_mutation_receipts_test.sql`.
- `supabase/CLOUD_SYNC_QUEUE_V7_DESIGN.md`.

### 1. Hiện trạng thực tế của Dexie và Asset
- Dexie hiện đã có schema version 7, không phải version 6. Version 7 bổ sung `identityStatus` cho Asset/Inventory; dữ liệu cũ được giữ nguyên ID/mã và đánh dấu `legacy`.
- `Asset.identityStatus` hiện hỗ trợ `legacy | draft | ready | synced | conflict`; tuy nhiên đây chỉ là trạng thái định danh, chưa phải mapping/sync state đầy đủ.
- Chưa có bảng `assetSyncState` hoặc bảng riêng lưu snapshot/version Cloud, organization mapping và conflict snapshot.
- `Asset` Local chứa `id`, `code`, `category`, thông tin hồ sơ, `updatedAt`; Cloud counterpart phải có cùng UUID trong đúng organization thì mới có thể xin lease do FK của `asset_edit_locks` tham chiếu `assets(organization_id,id)`.
- `importCloudAssetPreservingIdentity()` là thao tác nhập Local lên Cloud riêng biệt, bảo toàn UUID và mã quản lý; đây là luồng import tường minh, không phải worker đồng bộ tự động.

### 2. Các luồng ghi Asset đã xác minh
- `saveAsset()` trong `src/App.tsx`: ghi Asset Local và gọi `queueChange('assets', saved.id)` trong cùng Dexie transaction.
- `archiveAsset()`, `restoreAsset()`, `changeAssetStatus()`: dùng `putAndQueue()`, cùng ghi Local và gọi `queueChange()`.
- `rekeyAssetDraftId()` trong `src/db.ts`: đổi ID Asset và các FK liên quan trong một Dexie transaction; queue item được tạo lại qua `buildAssetRekeyPlan()`.
- Checklist/task/log/maintenance tiếp tục có luồng ghi riêng. Không được đưa chúng vào đợt đồng bộ hồ sơ Asset này.
- Chưa thấy worker đang claim/gửi/xác nhận `syncQueue`; không được bật worker chung trong đợt này.

### 3. Vấn đề kỹ thuật đã xác nhận trong syncQueue
- Schema hiện dùng primary key `id` dạng `tableName:recordId` và unique index `[tableName+recordId]`.
- `SyncItem` hiện có operation, status, attempts, deviceId và mutationId; chưa có payload snapshot bất biến, base Cloud version, claim token hoặc organization mapping.
- Mỗi lần gọi `queueChange()`, hàm dùng `put()`, đặt lại pending/attempts và tạo `mutationId` mới. Vì vậy mutation cũ của cùng Asset có thể bị thay thế.
- Cơ chế này được mô tả trong `supabase/CLOUD_SYNC_QUEUE_V7_DESIGN.md`: chỉ có thể coalesce thay đổi pending chưa claim; mutation đã processing/sent phải bất biến. Không được triển khai worker trên queue hiện tại trước khi thiết kế và migration queue an toàn.
- Với đợt Asset lease hiện tại, không được để lần sửa mới thay mutationId/payload của mutation đang pending hoặc chưa có Cloud acknowledgement. Cần chặn sửa tiếp Asset đó hoặc có mô hình mutation riêng theo ID; quyết định phải được kiểm thử trước khi code.
- `buildAssetRekeyPlan()` tạo mutationId mới khi đổi draft ID; logic hiện từ chối queue processing và queue ID chính thức đã tồn tại, nhưng pending queue của draft được thay bằng mutation mới. Phải bảo toàn ngữ nghĩa mutation khi nối lease; không tái sử dụng hoặc làm mất mutation đã gửi/chưa xác nhận.

### 4. Ràng buộc của Migration 017 và helper hiện tại
- RPC `apply_asset_mutation_with_lock` yêu cầu Asset Cloud đã tồn tại trong đúng organization, lease hợp lệ, mutationId, expected Cloud `updated_at` và payload hồ sơ đầy đủ.
- RPC ghi Asset và receipt trong cùng transaction; replay cùng user/asset/mutationId/expected version/payload trả receipt cũ; payload khác hoặc user/asset khác bị từ chối.
- RPC không tạo Asset mới và không thay mã `code` hoặc `category`; các trường này không nằm trong payload cập nhật. Không dùng RPC này thay cho quy trình import/khởi tạo Asset.
- Helper `applyAssetMutationWithEditLock()` hiện gửi payload snapshot và nhận Asset + receipt; chưa được gọi từ `App.tsx`.
- Lease không thể được xin cho Asset chưa có Cloud counterpart. Không được tự ghép Local/Cloud theo tên hoặc mã; chỉ mapping khi xác minh UUID và organization.
- Phải kiểm tra thêm các khác biệt kiểu dữ liệu/null/date giữa Local Asset và Cloud row trước khi nối UI; không tự chuyển đổi mơ hồ.

### 5. Kết luận thiết kế trước khi triển khai Local
1. Giữ nguyên queue chung hiện tại; không bật worker hoặc thay đổi sync semantics của các bảng khác.
2. Xác định một trạng thái đồng bộ Asset riêng theo organization + asset UUID, tối thiểu gồm: Cloud mapping đã xác minh, Cloud updated_at đã xác nhận, mutationId/payload đang chờ, trạng thái pending/conflict và snapshot Cloud khi conflict.
3. Khi Asset có mutation pending/chưa được receipt xác nhận, chặn lần sửa master tiếp theo trên Asset đó; không để `queueChange()` ghi đè mutationId. Chỉ mở lại sau acknowledgement hoặc xử lý conflict có chủ đích.
4. Với mutation đang gửi, giữ nguyên mutationId, payload và expected Cloud version; retry chỉ được dùng đúng bộ dữ liệu đó. Không tự xin token mới để gửi mutation cũ.
5. Khi import Local Asset lần đầu lên Cloud, dùng quy trình import hiện có và xác minh UUID/code/org; sau đó mới ghi nhận mapping + Cloud updated_at để cho phép acquire lease. Import không được chạy nền tự động.
6. Checklist, task, log, maintenance plan và inventory tiếp tục Local-only; không đưa queue của chúng vào luồng này.
7. Trước khi sửa code, cần thiết kế migration Dexie tiếp theo (nếu cần) và test chuyển đổi từ version 7, bao gồm backup/restore, pending queue và draft rekey. Không sửa Dexie schema chỉ để thử nghiệm.

### 6. Trạng thái rà soát
- Đây là audit mã nguồn và cập nhật thiết kế; chưa sửa code ứng dụng, chưa đổi Dexie schema, chưa gọi RPC, chưa ghi dữ liệu Cloud.
- Migration 017 và SQL Test 017 vẫn chưa có xác nhận người dùng đã chạy trên Supabase Test.
- GitHub Actions run #317 cho commit `aa493d01c13cbfe7b8db4273786dab17c42f3fb5` đã được kiểm tra lại: completed / success.
- Bước tiếp theo: review chéo thiết kế `CLOUD_SYNC_QUEUE_V7_DESIGN.md` với luồng lease/receipt của Asset; chốt mô hình asset-specific pending/conflict và mapping trước khi thay đổi code.

## 19. Rà soát tiếp theo – tích hợp khóa Asset với Local-first (19/11/2026)

### 19.1 Kết quả đối chiếu mã nguồn hiện tại

- Form `AssetModal` trong `src/App.tsx` khóa trường `category` khi sửa hồ sơ; trường `code` không xuất hiện trong form sửa. Vì vậy, hai trường định danh này phù hợp với hợp đồng `apply_asset_mutation_with_lock` của Migration 017: RPC không nhận và không cập nhật `code` hoặc `category`.
- Hàm `saveAsset()` hiện vẫn ghi trực tiếp Asset vào IndexedDB và gọi `queueChange('assets', saved.id)`. Form Local chưa xin lease Cloud, chưa lưu snapshot mutation bất biến và chưa gọi RPC Migration 017.
- `src/lib/assetEditLocks.ts` đã có helper `applyAssetMutationWithEditLock()`, nhưng chưa được gọi từ `src/App.tsx` hoặc luồng lưu Asset Local.
- `src/CloudAssetsPanel.tsx` hiện vẫn là luồng Cloud độc lập: tạo Asset bằng `createCloudAsset()`, sửa bằng `updateAssetWithEditLock()` (RPC Migration 016), lưu kho/khôi phục bằng RPC khóa. Panel này chưa sử dụng RPC receipt Migration 017. Luồng đó không đồng nhất với nguyên tắc Local-first đã chốt rằng Cloud chỉ phản ánh dữ liệu nghiệp vụ từ Local; cần xử lý rõ trước khi tuyên bố kiến trúc đã thống nhất. Chưa tự ý thay đổi hoặc vô hiệu hóa panel.
- Luồng import Local → Cloud hiện là thao tác rõ ràng, giữ nguyên UUID và mã quản lý. Sau import, Cloud có `updated_at` để làm mốc phiên bản, nhưng code hiện tại chưa ghi một bản ghi mapping/sync-state riêng vào IndexedDB. Không được coi việc UUID trùng hoặc tên/mã trùng đơn thuần là bằng chứng mapping; chỉ luồng import/xác nhận có kiểm tra đúng organization + UUID + code + payload mới được tạo liên kết.
- `CLOUD_SYNC_QUEUE_V7_DESIGN.md` là thiết kế hàng đợi chung cho nhiều bảng. Không cần triển khai Dexie queue v7 hoặc worker tổng quát trong giai đoạn khóa Asset. Tuyệt đối không bật đồng bộ Checklist, bảo trì, vật tư hoặc các bảng khác.

### 19.2 Kết luận thiết kế hẹp cho Asset – chưa triển khai

Không dùng `syncQueue` hiện tại làm nguồn mutation Cloud cho Asset. Queue này có unique key `[tableName+recordId]` và `queueChange()` tạo mutationId mới/ghi đè hàng cũ; không bảo toàn snapshot hoặc base Cloud version. Thiết kế v7 tổng quát vẫn để riêng, chưa triển khai.

Đề xuất một lát cắt Asset-only gồm hai bảng Dexie riêng, chưa thêm vào DB cho đến khi duyệt và chuẩn bị test migration:

1. `assetCloudLinks` – liên kết một Asset Local với đúng tổ chức và Asset Cloud:
   - Khóa ghép logic `organizationId + assetId`.
   - Lưu `cloudUpdatedAt` (phiên bản Cloud mới nhất đã xác nhận), `lastSyncedLocalUpdatedAt`, trạng thái `linked | conflict`, và thời điểm kiểm tra gần nhất.
   - Chỉ tạo/cập nhật liên kết sau khi RPC import hoặc RPC mutation trả về đúng organization/asset UUID và kết quả hợp lệ. Không tự ghép theo tên hoặc mã.
2. `assetMutations` – nhật ký mutation bất biến, chỉ phục vụ Asset:
   - Primary key `mutationId`; index theo `organizationId + assetId` và trạng thái/thời điểm.
   - Lưu payload snapshot đầy đủ, `expectedCloudUpdatedAt`, `localUpdatedAt`, trạng thái `pending | processing | applied | conflict`, lỗi và kết quả Cloud nếu có.
   - Mỗi Asset chỉ có tối đa một mutation chưa được xác nhận. Khi còn mutation `pending/processing/conflict`, chặn lần sửa master tiếp theo để không phải ghi đè mutation hoặc tự tạo chuỗi baseVersion phức tạp.
   - Retry luôn dùng đúng mutationId, payload snapshot và expectedCloudUpdatedAt cũ. Chỉ đánh dấu applied và cập nhật link version sau khi nhận được receipt hợp lệ; không xóa mutation trước xác nhận.
   - Không cho generic worker xử lý bảng Asset từ `syncQueue`; luồng Asset-only này là đường đồng bộ duy nhất.

### 19.3 Trình tự tích hợp dự kiến

1. Hoàn tất và người dùng xác nhận Migration 017 + Test SQL 017 PASS trên BAOTRI-Mini-Test. Trước đó không gọi RPC receipt từ ứng dụng.
2. Chốt xử lý CloudAssetsPanel: chuyển sang chỉ xem/đọc trạng thái, hoặc xác định rõ đây là công cụ quản trị riêng và không phải nguồn tạo/sửa dữ liệu nghiệp vụ. Không duy trì hai đường ghi Cloud cạnh tranh với Local-first.
3. Xác định cách thiết bị Local trên từng PC/Mobile được liên kết với Cloud: import rõ ràng hoặc tải/nhận bản ghi Cloud theo đúng organization + UUID; không tự động ghép theo tên/mã.
4. Khi người dùng bắt đầu sửa Asset Local đã liên kết: kiểm tra online, xin lease Cloud trước khi mở quyền sửa; lấy `updated_at` Cloud làm expected version. Không xác minh được lease thì chỉ xem và vẫn cho phép Checklist/bảo trì Local theo quy tắc đã chốt.
5. Khi mất heartbeat/kết nối: khóa form Local ngay, không cho lưu; không tự khôi phục quyền sửa sau khi reconnect. Phải tải lại trạng thái Cloud và xin lease mới.
6. Khi lưu: trong transaction Dexie, lưu Asset Local + mutation snapshot bất biến; sau đó gọi `apply_asset_mutation_with_lock` bằng lease token và snapshot. Khi Cloud xác nhận, cập nhật link/version và kết thúc mutation; nếu timeout thì giữ nguyên mutation để retry idempotent.
7. Nếu Cloud version mismatch: giữ Local và Cloud snapshot, chuyển conflict; không tự ghi đè hoặc tự chọn bên thắng.
8. Chỉ tích hợp Asset master. Checklist, bảo trì, nhật ký, vật tư và movement tiếp tục Local, chưa có worker/đồng bộ.

### 19.4 Trạng thái và việc chưa làm
- [x] Đã xác nhận `code` và `category` không thể sửa từ AssetModal hiện tại.
- [x] Đã xác nhận Local save vẫn ghi IndexedDB + generic `syncQueue`, chưa gọi RPC receipt.
- [x] Đã xác nhận CloudAssetsPanel vẫn có đường tạo/sửa/lưu kho trực tiếp trên Cloud và chưa dùng Migration 017.- [x] Đã rà soát thiết kế queue v7: không cần triển khai queue tổng quát cho lát cắt Asset-only.
- [x] Đã đề xuất mapping + mutation ledger riêng cho Asset, có chặn sửa lần tiếp theo khi mutation trước chưa được xác nhận.
- [ ] Chưa sửa mã nguồn, chưa thêm bảng Dexie, chưa gọi RPC Migration 017.
- [ ] Migration 017 và Test SQL 017 vẫn chờ người dùng chạy trên BAOTRI-Mini-Test và xác nhận kết quả.
- [ ] Chưa có kiểm thử hai thiết bị PC/Mobile thực tế cho toàn bộ vòng đời lease.

## 20. Chốt vai trò CloudAssetsPanel trước khi tích hợp Local (19/11/2026)

### 20.1 Phạm vi được phép giữ trong CloudAssetsPanel

CloudAssetsPanel là màn hình quản trị/quan sát Cloud, không phải nơi nhập liệu nghiệp vụ Asset chính. Theo nguyên tắc Local-first đã chốt:

- Giữ tải và xem danh sách Asset Cloud; trạng thái lưu kho; thông tin khóa đang hoạt động; tải lại dữ liệu.
- Giữ luồng import rõ ràng từ Local PC lên Cloud, giữ nguyên UUID và mã quản lý. Đây là thao tác khởi tạo liên kết Cloud có kiểm tra dữ liệu, không phải đồng bộ nền.
- Tạm giữ phần đọc/cấu hình mã tổ chức như công cụ thiết lập quản trị, nhưng không được dùng nó để tạo Asset Cloud hoặc tự cấp mã từ Cloud. Cần rà soát riêng nguồn cấu hình chuẩn khi hoàn thiện onboarding Local-first.
- Không cho tạo Asset trực tiếp trên Cloud bằng `createCloudAsset()`.
- Không cho sửa hồ sơ, lưu kho hoặc khôi phục Asset trực tiếp trong CloudAssetsPanel. Các thao tác nghiệp vụ này phải bắt đầu tại Local, xin lease Cloud và dùng RPC receipt sau khi Migration 017/Test 017 được người dùng xác nhận PASS.
- Không xóa dữ liệu Cloud, không thay đổi bảng/SQL/RLS, không thu hồi permission backend trong bước UI này. Việc ẩn/ngừng gọi các đường ghi từ UI không đồng nghĩa xóa RPC hoặc dữ liệu đã có.

### 20.2 Kế hoạch thay đổi mã UI an toàn

Trước khi sửa:
- Chỉ sửa `src/CloudAssetsPanel.tsx` và tài liệu tiến độ.
- Loại bỏ nút/form tạo Asset Cloud, form sửa Asset Cloud, nút lưu kho/khôi phục Cloud và các handler chỉ phục vụ những thao tác này.
- Giữ luồng import Local PC → Cloud, xem danh sách, hiển thị lease holder, cấu hình quản trị hiện có.
- Không thay đổi Local Asset form, Dexie schema, migration, RPC, permission, import contract hoặc các phân hệ khác.
- Không chạy SQL; không bật queue worker.
- Chạy kiểm tra TypeScript/build qua CI sau commit; CI không thay thế test SQL hoặc kiểm thử nhiều thiết bị.

### 20.3 Rủi ro và giới hạn đã nhận diện

- Người dùng hiện không còn tạo/sửa/lưu kho/khôi phục Asset từ màn hình Cloud sau khi UI được chuyển read-only. Mọi thay đổi phải thực hiện tại Local; đến khi Local lease + receipt tích hợp hoàn tất, sửa hồ sơ Asset đã liên kết có thể tạm thời chưa có luồng hoàn chỉnh.
- CloudAssetsPanel hiện có quyền `assets.create`/`assets.update` và RPC tương ứng ở backend; bước này chỉ loại bỏ đường gọi từ giao diện, chưa thay đổi backend. Không được tuyên bố backend đã cấm tuyệt đối mọi client khác.
- Cấu hình mã tổ chức còn được giữ tạm thời để tránh thay đổi onboarding/cấu hình hiện hữu; chưa kết luận đây là nguồn cấu hình cuối cùng cho Local.
- Migration 017 và Test SQL 017 chưa được người dùng xác nhận PASS. Không gọi `apply_asset_mutation_with_lock` từ Local trước mốc đó.
- Sau khi UI read-only hoàn tất, bước tiếp theo là hoàn thiện mapping/mutation Dexie Asset-only và tích hợp Local lease/receipt; không bật đồng bộ tổng quát.

### 20.4 Trạng thái
- [x] Đã kiểm tra CloudAssetsPanel và xác định các đường tạo/sửa/lưu kho/khôi phục trực tiếp Cloud.
- [x] Đã xác định giữ import Local PC → Cloud và phần xem Cloud.
- [ ] Chưa sửa CloudAssetsPanel trong thời điểm ghi nhận.
- [ ] Chưa thay đổi backend hoặc SQL.

### 20.5 Kết quả thực hiện UI read-only – 19/11/2026

Đã cập nhật trực tiếp trên `main`:

- Commit `83fcc0a204ccccaf2ba746f6d85ffae28182878a`: chuyển `src/CloudAssetsPanel.tsx` thành màn hình chỉ xem đối với hồ sơ Asset; bỏ form/handler tạo Asset Cloud, sửa hồ sơ, lưu kho và khôi phục; bỏ luồng xin lease/heartbeat/release riêng trong panel.
- Commit `854f5388a35737a80455c7566067a4e69f3cd768`: dọn state/import/hàm phụ không còn sử dụng sau khi bỏ các form ghi Cloud.
- Giữ lại: tải danh sách Asset Cloud, hiển thị trạng thái khóa, refresh trạng thái khóa, import Local PC → Cloud có preflight và xác nhận, phần cấu hình mã tổ chức hiện có.
- Không sửa backend/RPC/permission/SQL; không xóa dữ liệu Cloud; không sửa Local form hoặc Dexie; không bật đồng bộ nền.
- Đã kiểm tra lại nội dung file trên `main`: không còn tham chiếu UI tới `createCloudAsset`, `updateAssetWithEditLock`, `setAssetArchivedWithEditLock`, `acquireAssetEditLock`, `heartbeatAssetEditLock`, hoặc các handler/form tạo/sửa/lưu kho/khôi phục.
- GitHub Actions run `44408674037` cho commit trên đang ở trạng thái queued tại thời điểm cập nhật; chưa được đánh dấu PASS. Cần kiểm tra lại kết quả run trước khi kết luận build.
- Thay đổi này chỉ giới hạn giao diện Cloud. Các RPC/backend cũ vẫn tồn tại; không tuyên bố backend đã cấm mọi client khác ghi trực tiếp.
- Lưu ý vận hành: cho đến khi Local lease + receipt được tích hợp, không dùng CloudAssetsPanel để thay đổi hồ sơ nghiệp vụ. CloudAssetsPanel hiện giữ import Local PC, xem và cấu hình quản trị.

## 21. Chuẩn bị liên kết Asset Local–Cloud (19/11/2026)

### 21.1 Vấn đề xác định trong import hiện tại

- Luồng preflight hiện đếm Asset Cloud đã tồn tại đúng UUID/mã/nội dung là `alreadyPresent` rồi bỏ qua RPC import.
- Nút xác nhận bị disable khi `toInsert === 0`. Vì vậy, một Asset có thể đã tồn tại chính xác trên Cloud nhưng Local chưa có mapping; thao tác import hiện tại không thể tạo liên kết Local–Cloud cho trường hợp đó.
- Import RPC cũ có tính idempotent theo UUID/mutation ID và có thể trả lại Asset Cloud đã tồn tại nếu payload khớp hoàn toàn. Có thể dùng chính luồng này để xác nhận lại các bản ghi đã tồn tại, sau đó mới ghi mapping Local.
- Không được tạo mapping chỉ vì UUID hoặc code trùng; phải có kết quả RPC xác nhận đúng organization + asset UUID + code và payload phù hợp.

### 21.2 Phạm vi schema Dexie v8 dự kiến

Thêm hai bảng riêng, không thay đổi bảng `syncQueue` và không chạy worker:

1. `assetCloudLinks`
   - Primary key: `id = organizationId + ':' + assetId`.
   - Unique compound index: `[organizationId+assetId]`.
   - Các trường: `organizationId`, `assetId`, `cloudCode`, `cloudUpdatedAt`, `lastSyncedLocalUpdatedAt`, `status: linked | conflict`, `linkedAt`, `lastVerifiedAt`.
   - Mỗi tổ chức chỉ có một liên kết Cloud cho một UUID Local. Không tự ghép theo tên/mã.
2. `assetMutations`
   - Primary key: `mutationId` (UUID riêng cho từng lần sửa).
   - Index thường: `[organizationId+assetId]`, `[organizationId+assetId+status]`, `organizationId`, `assetId`, `status`, `createdAt`.
   - Lưu snapshot payload bất biến theo allowlist của Migration 017, `expectedCloudUpdatedAt`, `localUpdatedAt`, `status: pending | processing | applied | conflict`, `attempts`, `lastError`, `createdAt`, `updatedAt`, `appliedAt`, `cloudUpdatedAt`.
   - Không dùng unique index cho organization+asset vì cần giữ lịch sử các mutation đã applied. Ứng dụng sẽ kiểm tra và chỉ cho tối đa một mutation chưa xác nhận cho mỗi Asset.
   - Chưa tích hợp ghi/đọc bảng mutation vào luồng sửa Local cho đến khi Test SQL 017 PASS.

### 21.3 Điều chỉnh import để tạo mapping an toàn

- Preflight tiếp tục kiểm tra toàn bộ Local và Cloud, không ghi dữ liệu khi chưa xác nhận.
- Khi người dùng xác nhận, chạy RPC import idempotent cho mọi Asset Local trong snapshot, bao gồm Asset đã có đúng UUID/mã/nội dung trên Cloud. Không bỏ qua Asset chỉ vì Cloud đã có.
- Chỉ sau khi RPC trả về đúng `organizationId`, `asset.id`, `asset.code` và Asset payload hợp lệ, mới ghi `assetCloudLinks` trong Dexie.
- Nếu Cloud import thành công nhưng ứng dụng đóng trước khi ghi mapping, lần xác nhận lại dùng cùng import mutation ID theo UUID Asset để RPC trả kết quả cũ và hoàn thiện mapping.
- Nếu Local/Cloud khác payload, UUID hoặc code xung đột, dừng; không ghi mapping và không tự chọn bên thắng.
- Thông báo import cần phân biệt số Asset mới được thêm Cloud và số Asset đã được xác nhận/liên kết.

### 21.4 Kiểm thử bắt buộc cho Dexie v8/import

- Nâng DB v7 → v8 không mất Asset/Inventory/Checklist/maintenance/queue cũ.
- Bảng mapping và mutation mới tạo rỗng, không tự sinh mapping từ dữ liệu cũ.
- Import Asset mới: Cloud xác nhận đúng UUID/code; mapping được ghi.
- Asset đã tồn tại Cloud đúng payload nhưng chưa có mapping: RPC idempotent trả kết quả, mapping được ghi.
- Cùng UUID nhưng code khác, cùng code nhưng UUID khác, hoặc payload khác: dừng, không tạo mapping.
- Mất phản hồi sau khi Cloud commit: chạy lại import không tạo Asset trùng; mapping hoàn tất khi nhận được kết quả xác nhận.
- Không thay đổi `syncQueue`, không xử lý Checklist, bảo trì, vật tư hoặc bảng khác.
- Test SQL 017 vẫn là điều kiện bắt buộc riêng trước khi bật Local edit receipt; Dexie v8 không thay thế test SQL.

### 21.5 Trạng thái
- [x] Đã xác định lỗ hổng nghiệp vụ: Asset Cloud tồn tại đúng nhưng Local chưa thể tạo mapping khi `toInsert = 0`.
- [x] Đã chốt thiết kế bảng Dexie v8 cho link và mutation; chưa áp dụng vào mã nguồn.
- [ ] Chưa thêm schema v8 hoặc ghi mapping trong import.
- [ ] Chưa tích hợp Local edit lease/receipt; chờ người dùng xác nhận Migration 017 + Test 017 PASS.

### 21.6 Kết quả triển khai Dexie v8 và mapping import – 19/11/2026

Đã cập nhật trên `main`:

- Commit `c7bbf60ee074af907efb55c7e35dd2c91353d690`: thêm type và Dexie schema version 8:
  - `assetCloudLinks`: liên kết Local–Cloud theo organization + asset UUID, lưu code và phiên bản Cloud/Local đã xác nhận.
  - `assetMutations`: cấu trúc lưu snapshot mutation bất biến và trạng thái; hiện mới tạo bảng/index, chưa có luồng ghi/đọc mutation.
- Commit `f5cd368128ab78a00a4258f964aaf2a9e9ce0897`: chỉnh import trong `CloudAssetsPanel`:
  - Preflight tính riêng số Asset cần thêm mới lên Cloud và số Asset cần tạo/cập nhật mapping.
  - Nếu Cloud đã có Asset đúng UUID/code/nội dung nhưng Local chưa có mapping, vẫn cho xác nhận.
  - Khi xác nhận, chạy import RPC idempotent cho Asset cần liên kết, kể cả bản ghi Cloud đã tồn tại đúng; chỉ sau khi RPC trả về Asset hợp lệ mới ghi `assetCloudLinks`.
  - Retry sau khi Cloud commit nhưng Local chưa ghi mapping dùng lại mutation ID theo Asset UUID; không tạo Asset trùng.
  - Nếu UUID/code/payload khác nhau thì dừng, không ghi mapping.
- Dexie v8 không có upgrade transform; dữ liệu cũ được giữ nguyên, hai bảng mới để trống. Không tự động gán link cho dữ liệu legacy.
- Không thay đổi `syncQueue`, không bật worker, không đồng bộ Checklist/bảo trì/vật tư.
- Không gọi Migration 017; `assetMutations` hiện chỉ là schema chuẩn bị, chưa được dùng.
- GitHub Actions cho commit `f5cd368` đang pending tại thời điểm ghi nhận; chưa xác nhận build PASS. Run trước đó cho commit `c7bbf60` đang in progress.
- Lưu ý: import RPC ledger ràng buộc mutation với actor. Giai đoạn hiện tại đang dùng một Auth account như quyết định trước; nếu sau này cho nhiều Admin import cùng organization, cần đánh giá lại luồng retry/mutation ID theo actor trước khi mở rộng.

### 21.7 Hoàn thiện thông báo và đếm import – 19/11/2026

- Commit `e7b66179e0af33a181ae3cc98323d3d3514022bd`: chỉnh thông báo Cloud panel theo đúng vai trò chỉ xem (không còn nói người dùng bị cấm thao tác sửa/lưu kho vốn đã bỏ khỏi UI); bộ đếm Asset mới thêm Cloud không tính nhầm trường hợp RPC trả về đã tồn tại do chạy đua hoặc retry.
- Đây là chỉnh sửa giao diện/thông báo; không thay đổi hợp đồng RPC hoặc dữ liệu.
- Chờ GitHub Actions của commit mới nhất kết thúc để xác nhận build.

## 22. Bảo vệ Asset đã liên kết trong lúc chờ Local lease/receipt (19/11/2026)

Sau khi import tạo mapping, Local hiện vẫn có các đường sửa/lưu kho/khôi phục/thay đổi trạng thái ghi thẳng IndexedDB và generic `syncQueue`. Nếu để các đường này tiếp tục hoạt động trước khi tích hợp lease + receipt, Asset đã liên kết có thể thay đổi Local mà Cloud không được cập nhật, đồng thời bỏ qua khóa Cloud.

Kế hoạch guard tạm thời:
- Chỉ áp dụng với Asset có bản ghi trong `assetCloudLinks` (bất kể status linked/conflict).
- Chặn lưu sửa hồ sơ Asset, lưu kho, khôi phục và đổi trạng thái đối với Asset đã liên kết.
- Không chặn xem hồ sơ, Checklist, bảo trì, nhật ký hoặc các công việc Local được phép.
- Asset chưa liên kết vẫn giữ hành vi hiện tại.
- Guard chỉ là lớp an toàn giao diện/Local; chưa thay thế kiểm tra lease ở server. Khi Local lease + receipt hoàn tất và Test SQL 017 PASS, thay guard tạm bằng luồng xin lease + mutation snapshot + RPC receipt.
- Không xóa queue cũ, không đánh dấu synced, không đổi dữ liệu Cloud.

Phạm vi sửa dự kiến chỉ `src/App.tsx`; thêm kiểm tra link trước các thao tác master data. Cần test thủ công: Asset chưa link vẫn sửa được; Asset linked/conflict bị chặn; Checklist/bảo trì trên Asset linked vẫn hoạt động.

Trạng thái: chưa áp dụng guard tại thời điểm ghi nhận.

### 22.1 Guard tạm thời đã triển khai – 19/11/2026

- Commit `d903c7dab1ec38d2d2cdd588a4e9044f365ece03`: thêm `blockCloudLinkedAssetMutation()` trong `src/App.tsx`.
- Guard kiểm tra `assetCloudLinks` theo Asset UUID trước khi sửa hồ sơ, lưu kho, khôi phục hoặc đổi trạng thái.
- Asset có mapping (kể cả status conflict) bị chặn thay đổi master data; Asset chưa mapping giữ nguyên hành vi hiện tại.
- Checklist, công việc bảo trì và nhật ký không bị chặn bởi guard này.
- Guard là biện pháp tạm thời phía Local, không thay thế lease/RPC server. Khi Local lease + receipt hoàn tất, phải thay guard bằng luồng khóa Cloud và biên nhận.
- Chưa xác nhận build; GitHub Actions của commit mới nhất đang chờ.

## 23. Guard thao tác khôi phục backup đối với Asset đã liên kết (19/11/2026)

Rà soát thêm phát hiện `applyRestore()` thay thế toàn bộ Asset bằng backup và không đi qua các handler sửa/lưu kho/khôi phục thông thường. Đây là đường có thể ghi đè hoặc loại bỏ Asset đã liên kết Cloud, đi vòng qua guard mới.

Kế hoạch:
- Trước khi restore, kiểm tra mọi Asset có `assetCloudLinks`.
- Chỉ cho phép restore nếu backup vẫn có đủ các Asset đã liên kết và snapshot master data của chúng giống hệt dữ liệu Local hiện tại (bao gồm UUID/code/category, hồ sơ, trạng thái, archivedAt, createdAt/updatedAt; ảnh local không thuộc snapshot master).
- Nếu backup thiếu hoặc thay đổi bất kỳ Asset đã liên kết nào, dừng toàn bộ restore; không ghi một phần.
- Nếu `assetMutations` có trạng thái pending/processing/conflict, chặn restore để không làm mất dấu giao dịch chưa được xác nhận/giải quyết.
- Không xóa mapping hoặc mutation ledger trong restore. Các bảng mới không nằm trong backup cũ và phải được giữ nguyên.
- Backup/restore vẫn có thể thao tác các Asset chưa liên kết và các bảng nghiệp vụ khác theo luồng hiện có.

Phạm vi sửa chỉ `src/App.tsx`; không thay đổi định dạng backup hoặc các bảng khác. Cần test: backup không đổi Asset linked thì restore được; backup đổi/bỏ Asset linked thì bị chặn; có mutation chưa xử lý thì bị chặn; Asset unlinked restore như trước.

Trạng thái: chưa áp dụng guard backup restore tại thời điểm ghi nhận.

### 23.1 Guard backup restore đã triển khai – 19/11/2026

- Commit `b59cf661b246d79156dbc4dc56a7e1d515ecc424`: thêm kiểm tra Asset Cloud-linked và mutation chưa xử lý trước khi restore.
- Commit `88716b17206a6ae514c0f27e4f26dc85ccd5b879`: chuyển việc đọc links/mutations/current assets vào cùng Dexie read-write transaction với restore để tránh race giữa các tab.
- Restore bị chặn nếu có mutation pending/processing/conflict, hoặc backup thiếu/thay đổi master snapshot của Asset linked/conflict.
- Ảnh Local không nằm trong master snapshot; backup vẫn có thể cập nhật ảnh nếu hồ sơ master không đổi.
- Hai bảng `assetCloudLinks` và `assetMutations` không bị xóa trong restore. Backup format cũ vẫn không chứa hai bảng này.
- Asset chưa liên kết tiếp tục theo luồng restore cũ.
- Chưa có kiểm thử runtime IndexedDB/restore trên trình duyệt; cần test thủ công sau khi build PASS.

### 23.2 CI xác nhận mã nguồn – 19/11/2026

- GitHub Actions run `44409619749`, commit `2118937bdde443c9415e605a3b5ad82ac85be078`: job `build` đã PASS.
- Các bước Test Cloud sync mapping safety, Test Local identity rekey safety, validate template JSON/reference/package và Build Vite app đều PASS.
- Job `deploy` đang chạy tại thời điểm cập nhật. Chưa đánh dấu toàn bộ workflow/deploy hoàn tất.
- CI không chạy SQL Migration 017, không kiểm thử Dexie migration trong trình duyệt thực, không kiểm thử hai thiết bị PC/Mobile đồng thời.


## 24. Khắc phục kiểm tra payload của Migration 017 (19/11/2026)

Người dùng đã chạy Migration 017 thành công trên BAOTRI-Mini-Test. Khi chạy Test SQL 017, RPC `apply_asset_mutation_with_lock` báo lỗi PostgreSQL `42883: function jsonb_object_length(jsonb) does not exist`.

Nguyên nhân:
- Migration 017 dùng `jsonb_object_length(p_payload)` để đếm số key của JSON object.
- Hàm này không khả dụng trong môi trường PostgreSQL đang dùng.
- Kiểm tra số lượng key là dư thừa vì điều kiện bắt buộc đủ toàn bộ key (`?& v_required_keys`) và không có key ngoài allowlist (`p_payload - v_required_keys = '{}'`) đã đảm bảo chính xác tập key.

Cách sửa:
- Loại bỏ phép gọi `jsonb_object_length`; giữ kiểm tra payload phải là JSON object, đủ các key bắt buộc và không có key ngoài allowlist.
- Dùng `IS DISTINCT FROM 'object'` để xử lý an toàn cả trường hợp payload NULL.
- Vì Migration 017 đã được áp dụng, không chạy lại toàn bộ Migration 017 (sẽ vướng bảng đã tồn tại). Tạo migration hotfix tiếp theo để thay thế định nghĩa RPC hiện hữu an toàn, sau đó mới chạy lại Test SQL 017.
- Đồng thời sửa file Migration 017 gốc để các lần cài mới không gặp lại lỗi.

Phạm vi: chỉ hàm kiểm tra payload trong RPC; không đổi schema receipt, lease, quyền, logic cập nhật Asset, idempotency hoặc phạm vi đồng bộ. Không bật worker và không chạy SQL thay người dùng.

Trạng thái:
- [x] Đã xác định nguyên nhân từ lỗi thực tế.
- [x] Đã cập nhật Migration 017 gốc tại commit `74a27b4f995ae6c78f8a61acc7626e7b7bd7accb` để bỏ hàm không khả dụng và xử lý payload NULL an toàn.
- [x] Đã thêm migration hotfix `supabase/migrations/20261119000100_fix_asset_mutation_payload_validation.sql` tại commit `6d38f25a263fc0ec07ad1e982586c0a4e4524bb9`; hotfix chỉ thay định nghĩa RPC hiện hữu, không tạo lại bảng hoặc thay đổi dữ liệu.
- [ ] Người dùng chạy hotfix trên BAOTRI-Mini-Test.
- [ ] Chạy lại Test SQL 017 và xác nhận PASS.
- [ ] Chưa tích hợp Local lease/receipt trước khi Test 017 PASS.


### 24.1 Phân tích kết quả Test SQL 017 – stale version

Người dùng chạy Test SQL 017 sau hotfix và báo tất cả dòng PASS ngoại trừ:
- `Stale expected Cloud version is rejected`
- Actual: `blocked=false; name=Asset mutation committed once`

Đã kiểm tra lại mã RPC trên `main`:
- RPC hiện so sánh `v_asset.updated_at IS DISTINCT FROM p_expected_cloud_updated_at` và phải trả SQLSTATE `40001` nếu phiên bản Cloud khác.
- Bài test hiện tại chỉ kiểm tra tên Asset sau lời gọi, trong khi payload gửi lại cũng giữ nguyên tên; do đó phần Actual chưa đủ để xác định vì sao lời gọi không bị chặn.
- Cần tăng độ quan sát của test: xác nhận timestamp sau mutation đầu tiên thực sự khác timestamp gốc; chụp timestamp Cloud ngay trước lời gọi stale; sau lời gọi kiểm tra timestamp không thay đổi. Báo rõ các timestamp trong cột Actual.
- Không thay đổi RPC hoặc tích hợp Local trước khi test chẩn đoán xác nhận rõ nguyên nhân.

Trạng thái:
- [x] Đã xác nhận nội dung RPC trên main có điều kiện kiểm tra phiên bản.
- [x] Cập nhật Test SQL 017 tại commit `4e55cdc60855f3043eabdb9a1daa8635bae45ba2`: kiểm tra timestamp sau mutation đầu tiên, timestamp ngay trước stale call và timestamp sau stale call; cột Actual in đủ các mốc để xác định lỗi nằm ở dữ liệu phiên bản hay nhánh RPC.
- [ ] Người dùng chạy lại Test SQL 017 và gửi dòng kết quả mới.
- [ ] Người dùng chạy lại Test SQL 017 và gửi dòng kết quả mới.


### 24.2 Xác định nguyên nhân timestamp không đổi – 19/11/2026

Người dùng chạy lại Test SQL 017 với chẩn đoán chi tiết và nhận được:
- `original`, `after_first`, `before_stale`, `after_stale` đều bằng `2026-11-18 22:28:02.599598+00`.
- `blocked=false`; Asset vẫn giữ tên `Asset mutation committed once`.

Đã kiểm tra mã nguồn trên `main`:
- Bảng `assets` có trigger `assets_set_updated_at` gọi `public.set_updated_at()`.
- Hàm dùng `new.updated_at := now()`.
- Trong một transaction, `now()` trả về thời điểm bắt đầu transaction, nên trigger ghi đè giá trị `clock_timestamp()` mà RPC đặt; timestamp không đổi so với lúc tạo fixture.
- Vì optimistic version không thay đổi, stale request không bị phát hiện.

Phương án sửa đã chốt để triển khai:
- Không thay đổi hàm `set_updated_at()` dùng chung, tránh tác động các bảng khác.
- Tạo trigger function riêng cho Asset, dùng `clock_timestamp()`, và thay trigger `assets_set_updated_at` hiện tại bằng trigger riêng này.
- Migration riêng, không cập nhật dữ liệu hiện có; chỉ thay hành vi cập nhật timestamp cho các lần UPDATE Asset từ sau khi migration được áp dụng.
- Giữ nguyên RPC receipt/lease và bài test stale-version; chạy lại Test SQL 017 sau migration mới.
- Chưa tích hợp Local lease/receipt cho đến khi Test SQL 017 PASS toàn bộ.

Trạng thái:
- [x] Xác định đúng nguyên nhân từ trigger `set_updated_at()`.
- [ ] Tạo migration sửa riêng trigger Asset.
- [ ] Người dùng chạy migration mới trên BAOTRI-Mini-Test.
- [ ] Chạy lại Test SQL 017 và xác nhận tất cả PASS.


### 24.3 Migration 019 đã tạo – 19/11/2026

- Commit tài liệu chẩn đoán: `3bc613101614fe7a5151ef8d34e07c6fd3df3fd8`.
- Commit Migration 019: `17dd94500b3ccc157e4affa54f602a1253ea7550`.
- File: `supabase/migrations/20261119000200_asset_updated_at_wall_clock.sql`.
- Migration tạo hàm trigger riêng `public.set_asset_updated_at()`, dùng `clock_timestamp()`; thay trigger trên `public.assets` để dùng hàm mới.
- Không sửa hàm `public.set_updated_at()` dùng chung, không tác động timestamp các bảng khác, không cập nhật hàng Asset hiện có.
- Chưa chạy SQL. Người dùng cần chạy Migration 019 trên BAOTRI-Mini-Test, sau đó chạy lại Test SQL 017.


## 22. Kết quả Migration 019 và Test SQL 017 – 19/11/2026

- Người dùng xác nhận đã áp dụng Migration 019 `supabase/migrations/20261119000200_asset_updated_at_wall_clock.sql` trên BAOTRI-Mini-Test và chạy lại toàn bộ Test SQL 017; **PASS toàn bộ**.
- Migration 019 tạo trigger riêng `set_asset_updated_at()` dùng `clock_timestamp()` cho bảng `assets`, thay trigger cũ dùng `set_updated_at()`/ `now()`. Không sửa hàm timestamp dùng chung, không ảnh hưởng các bảng khác và không cập nhật hàng Asset hiện có.
- Lỗi stale expected Cloud version đã được xử lý: trong cùng transaction, timestamp Asset thay đổi theo wall-clock, do đó RPC optimistic version check phát hiện phiên bản cũ đúng như yêu cầu.
- Ghi nhận theo xác nhận của người dùng: Migration 016, 017, 018, 019 và Test SQL 016, 017 đã PASS trên BAOTRI-Mini-Test. Assistant không trực tiếp thực thi SQL.
- Không chạy lại Migration 017/018; Migration 019 là hotfix tiến về phía trước.

## 23. Kế hoạch tích hợp Asset Local lease + receipt – đợt tiếp theo

### 23.1 Hiện trạng đã đối chiếu trên `main`
- `src/db.ts` đã có Dexie v8 với `assetCloudLinks` và `assetMutations`; không cần tạo thêm bảng hoặc nâng version chỉ để bắt đầu tích hợp.
- `src/lib/assetEditLocks.ts` đã có acquire/heartbeat/release và `applyAssetMutationWithEditLock()`.
- `src/App.tsx` hiện vẫn có `blockCloudLinkedAssetMutation()`: Asset đã liên kết Cloud bị chặn sửa; `saveAsset()` vẫn ghi Asset + generic `syncQueue`, chưa gọi RPC receipt.
- `src/App.tsx` hiện có Supabase client và organization context; cần dùng đúng `organizationId` + `cloudClient` trong Workspace, không suy đoán mapping từ tên/mã.
- Import Local → Cloud hiện có xác nhận; mapping được lưu ở Dexie v8. Không thay đổi luồng import trong đợt tích hợp save nếu không cần thiết.
- Cloud version làm mốc là `assetCloudLinks.cloudUpdatedAt`; trước khi mở form phải đọc/đối chiếu phiên bản Cloud hiện hành. Nếu khác mốc Local, chuyển conflict và không mở quyền sửa.

### 23.2 Phạm vi triển khai
1. Với Asset chưa mapping Cloud: giữ nguyên hành vi Local hiện tại; không xin lease cho Asset chưa có Cloud counterpart.
2. Với Asset đã mapping: kiểm tra không có mutation `pending/processing/conflict`; lấy snapshot Cloud mới nhất và so sánh `updated_at` với `cloudUpdatedAt` đã lưu.
3. Chỉ sau khi xác minh version và acquire lease thành công mới mở form sửa.
4. Duy trì heartbeat trong toàn bộ phiên chỉnh sửa và trong lúc chờ Cloud receipt. Heartbeat lỗi/mất mạng phải fail-closed; token không được lưu vào IndexedDB/localStorage.
5. Khi lưu Asset mapped: ghi Local snapshot và mutation bất biến vào Dexie transaction; không gọi `queueChange('assets', ...)` cho mutation Asset đã đi theo receipt protocol.
6. Gửi đúng mutationId, payload snapshot, expectedCloudUpdatedAt và lease token tới `applyAssetMutationWithEditLock()`.
7. Chỉ khi nhận receipt hợp lệ mới cập nhật `assetCloudLinks.cloudUpdatedAt`, đánh dấu mutation `applied`, và release lease.
8. Nếu Cloud từ chối/timeout/mất mạng sau Local commit: giữ mutation và dữ liệu Local, không release lease chủ động khi lease còn hoạt động; khóa thao tác sửa tiếp. Không tự xin token mới để gửi mutation cũ. Cần có đường phục hồi/reconcile rõ ràng trước khi xem là hoàn tất.
9. Cancel form: release đúng token; không ghi Local mutation.
10. Các luồng archive/restore/status chỉ tích hợp nếu được chứng minh đi qua cùng receipt RPC; không để đường ghi Local bypass lease.
11. Checklist/task/log/maintenance và queue tương ứng tiếp tục Local-only; không bật worker hoặc sync bảng khác.

### 23.3 Rủi ro và điều kiện dừng
- Không được mở form nếu Cloud version không đọc được, không khớp link version, mapping không ở trạng thái `linked`, hoặc còn mutation chưa xác nhận.
- Không đánh dấu `applied` chỉ vì Local transaction thành công; phải có receipt Cloud.
- Không xóa mutation/queue trước Cloud acknowledgement; không đổi mutationId/payload/expected version khi retry.
- Nếu chưa có cách xử lý an toàn trường hợp Cloud đã commit nhưng client mất response, không được release lease hoặc cho sửa tiếp.
- Không tự thay đổi CloudAssetsPanel, import, migration/RLS hoặc dữ liệu nghiệp vụ trong đợt này.
- Không tự chạy SQL/migration; người dùng tiếp tục chạy SQL trên BAOTRI-Mini-Test.

### 23.4 Cách kiểm thử
- Unit tests cho payload snapshot, mutation id ổn định, chặn mutation đang pending/conflict và trạng thái link/version.
- Build TypeScript/Vite qua CI.
- Người dùng kiểm tra trên BAOTRI-Mini-Test: sửa Asset mapped, hủy form, lưu thành công, Cloud version tăng, receipt được replay nếu retry; Asset chưa mapped vẫn sửa Local; Asset Cloud đổi từ nền tảng khác thì form bị chặn; mất mạng/heartbeat lỗi thì không thể lưu.
- Kiểm tra riêng rằng Checklist/bảo trì vẫn hoạt động Local và không có hàng đợi các bảng này bị gửi lên Cloud.
- Chỉ đánh dấu runtime PASS khi người dùng trực tiếp xác nhận kết quả.

### 23.5 Trạng thái
- Đã cập nhật kế hoạch sau khi người dùng xác nhận Test SQL 017 PASS.
- Chưa sửa `src/App.tsx` hoặc `src/db.ts` trong mục này; chưa gọi RPC từ UI; chưa bật worker tổng thể.



## 24. Kế hoạch code – tích hợp chỉnh sửa Asset Local mapped (19/11/2026)

Trước khi sửa ứng dụng, đã đọc lại phiên bản mới nhất trên `main` của `src/App.tsx`, `src/db.ts`, `src/lib/assetEditLocks.ts` và `src/CloudAssetsPanel.tsx`.

### Phạm vi lát cắt đầu
- Chỉ tích hợp luồng mở form và lưu hồ sơ master của Asset đã có `assetCloudLinks` trong đúng `organizationId`.
- Trước khi mở form: kiểm tra link `linked`, không có mutation chưa xác nhận; acquire lease; đọc lại Cloud row sau acquire và so sánh `id/code/updated_at` với mapping. Nếu lệch, đánh dấu link conflict, release lease và không mở form.
- Lease token chỉ ở React memory. Heartbeat định kỳ; offline/heartbeat thất bại làm lease cục bộ mất hiệu lực và chặn save. Cancel giải phóng đúng token nếu còn hợp lệ.
- Khi save: ghi Local Asset + snapshot mutation bất biến trong một Dexie transaction; không gọi generic `queueChange('assets', ...)` cho Asset mapped. Gọi RPC receipt bằng đúng mutationId, payload, expectedCloudUpdatedAt và token.
- Chỉ khi receipt hợp lệ mới đánh dấu mutation applied, cập nhật link version, rồi release lease.
- Nếu RPC lỗi/timeout: giữ Local và mutation, giữ lease trong memory để heartbeat/retry cùng mutationId/payload/token; không cấp mutation mới. Mutation còn pending sau reload sẽ fail-closed và bị chặn; chưa tự phục hồi receipt sau reload trong lát này.
- Asset chưa mapped giữ nguyên luồng Local cũ. Archive/restore/status tiếp tục bị chặn cho Asset mapped; không để các đường này bypass receipt.
- Checklist/bảo trì và các bảng khác không đổi; không bật worker.

### Giới hạn được ghi nhận trước
- Lát đầu không xử lý tự động pending mutation sau khi reload vì client không lưu token và hiện chưa có RPC tra receipt không cần token. Giữ pending và chặn sửa tiếp an toàn hơn tự xin lease mới.
- Không đánh dấu runtime hai nền tảng PASS chỉ qua build. Cần test thủ công trên hai phiên sau khi có code.




## 25. Tích hợp Local Asset lease + receipt – code lát đầu (19/11/2026)

Đã cập nhật trực tiếp trên `main`:

- Commit `189cb65aa54108691f5d2fa17a7e176af906d159`: tích hợp trong `src/App.tsx`:
  - Nút Sửa từ danh sách và từ màn hình chi tiết đều đi qua `openAssetEditor()`.
  - Asset chưa mapping giữ luồng Local cũ.
  - Asset mapped phải có link `linked`, không có mutation unresolved; ứng dụng acquire lease, đọc Cloud row sau acquire và kiểm tra đúng organization + UUID + code + `updated_at` bằng link version trước khi mở form.
  - Heartbeat 30 giây; sự kiện offline hoặc heartbeat thất bại làm lease Local mất hiệu lực và chặn Save.
  - Khi Save Asset mapped: Local Asset + mutation snapshot được ghi trong cùng Dexie transaction; gọi `applyAssetMutationWithEditLock()`; chỉ khi RPC receipt hợp lệ mới cập nhật mutation `applied` + Cloud version trong link và giải phóng lease.
  - Không gọi `queueChange('assets', ...)` cho Asset mapped trong luồng Save mới. Asset chưa mapped vẫn dùng Local queue hiện tại.
  - Archive/restore/status của Asset mapped vẫn bị chặn vì chưa tích hợp qua receipt RPC; Checklist/bảo trì không đổi.
- Commit `ef1b14fb66124572b62675cb9bc85068e88d6c3f`: sửa đóng form để không giải phóng lease khi mutation còn pending/processing/conflict. Nếu lease đã mất, client không gửi release bằng token cũ.
- Lease token chỉ ở React state; không ghi vào Dexie/localStorage/syncQueue.
- Nếu RPC timeout/lỗi sau khi Local commit, mutation giữ nguyên ID/payload và trạng thái pending; form tiếp tục giữ lease để retry đúng mutation. Khi reload, mutation unresolved bị chặn fail-closed vì hiện chưa có RPC tra receipt độc lập với token; không tự cấp token mới để gửi lại.
- Chưa sửa `src/db.ts`, không thêm migration, không thay đổi SQL/RLS, không bật worker hoặc đồng bộ Checklist/bảo trì.
- GitHub Actions run #353 (`44414385705`) cho commit tài liệu sau tích hợp `f60f9a1c627cde08631c8a815eabd7d1b2eef396` đã completed / success; các bước build Vite và deploy GitHub Pages đều PASS. Hai run code #351/#352 bị cancel khi commit mới thay thế; không dùng chúng làm bằng chứng PASS.
- Chưa kiểm thử runtime trên hai phiên PC/Mobile; chưa tuyên bố luồng tích hợp hoàn tất. Cần đợi CI rồi mới test trên BAOTRI-Mini-Test.

## 26. Kiểm thử runtime Asset Edit Lease + Mutation Receipt trên PC – 19/11/2026

### 26.1 Kết quả người dùng trực tiếp kiểm tra

Phạm vi: một Asset thử nghiệm đã được liên kết Local PC ↔ Cloud; không sửa dữ liệu khác và không kiểm thử trên Mobile trong phiên này.

- [x] Mở form sửa Asset mapped trên PC sau khi acquire lease.
- [x] Đổi tên và lưu thành công; người dùng xác nhận tên mới đã xuất hiện trên Cloud.
- [x] Sau khi lưu thành công, form tự đóng.
- [x] Mở lại form sửa được sau lần lưu thành công; sau đó Hủy để đóng form.
- [x] Khi form đang mở và PC mất Internet: ứng dụng hiển thị thông báo mất kết nối; nút Lưu bị che/không thể thao tác.
- [x] Khi kết nối Internet trở lại, nút Lưu vẫn bị che; ứng dụng không tự khôi phục quyền sửa. Người dùng chỉ có thể Hủy form.
- [x] Ngay sau khi Hủy, chưa mở lại được form do lease Cloud cũ vẫn còn hiệu lực.
- [x] Sau khi chờ quá khoảng 2 phút kể từ lần heartbeat hợp lệ cuối, người dùng mở lại được form sửa.
- [x] Hủy form sau khi mở lại; tiếp tục mở form, đổi tên lần 2 và lưu thành công. Người dùng xác nhận Cloud cũng hiển thị tên lần 2.

Kết luận runtime trong phạm vi đã thử:
- Hành vi mất mạng fail-closed: PASS theo quan sát giao diện.
- Không tự khôi phục quyền sửa sau khi có mạng lại: PASS.
- Lease cũ hết hạn và cho phép acquire phiên mới sau khoảng 2 phút: PASS theo kết quả mở lại form.
- Lưu Asset mapped sau khi acquire lease mới và Cloud nhận tên mới: PASS.
- Chưa quan sát trực tiếp trạng thái lock trên Cloud Assets; giao diện Cloud người dùng thấy bình thường, vì vậy không ghi nhận đây là một phép kiểm tra trạng thái khóa.
- Chưa kiểm thử PC/Mobile đồng thời, heartbeat failure riêng biệt, hoặc mất mạng đúng thời điểm RPC đang xử lý.

### 26.2 Đối chiếu lại code hiện tại trên main

Đã đọc src/App.tsx và src/lib/assetEditLocks.ts trên main; xác nhận luồng Save Asset mapped hiện tại:

1. Khi nhấn Lưu, saveAsset() ghi Local Asset và snapshot mutation vào cùng Dexie transaction.
2. Sau transaction Local, mutation được chuyển sang processing, rồi client gọi applyAssetMutationWithEditLock() ngay bằng lease token, mutationId và expected Cloud version.
3. Chỉ khi RPC trả receipt hợp lệ, mutation mới thành applied, mapping mới cập nhật Cloud version, form mới tự đóng và client mới release lease.
4. Nếu RPC lỗi/timeout/mất mạng sau khi Local transaction đã commit, mutation được trả về pending; Local snapshot vẫn giữ nguyên, form tiếp tục mở và lease vẫn được giữ trong React memory để retry đúng mutation.
5. Khi retry, code kiểm tra mutation unresolved; nếu payload giống hệt snapshot đang chờ thì dùng lại mutationId cũ và Local snapshot hiện có. Nếu payload khác hoặc mutation ở trạng thái conflict thì từ chối, không tạo mutationId mới.
6. Nếu tải lại trang khi mutation còn pending, lease token trong memory bị mất; hiện chưa có cơ chế phục hồi/reconcile tự động sau reload. openAssetEditor() chặn mở phiên sửa mới khi còn mutation pending/processing/conflict. Đây là giới hạn đã biết, fail-closed có chủ ý.

Làm rõ Local-first: đối với Asset đã mapping Cloud, Local được ghi trước; sau đó cùng thao tác Save gọi Cloud RPC để xác nhận và cập nhật Cloud. Đây chưa phải worker đồng bộ nền độc lập. Nếu Cloud chưa xác nhận, Local giữ snapshot và mutation pending; không được coi là đã đồng bộ xong.

### 26.3 Trạng thái và việc tiếp theo

- [x] Ghi nhận kết quả kiểm thử runtime PC trong phiên 19/11/2026.
- [x] Đối chiếu lại code Save/retry trên main; không sửa mã nguồn trong phiên kiểm thử này.
- [x] Thiết kế và thực hiện phép thử an toàn cho trường hợp Local commit thành công nhưng Cloud RPC chưa xác nhận; đã chặn riêng endpoint `apply_asset_mutation_with_lock` trong Chrome DevTools, để heartbeat/kết nối khác tiếp tục hoạt động.
- [x] Xác nhận runtime: lần lưu đầu báo `TypeError: Failed to fetch`, Local giữ snapshot và mutation pending; bỏ chặn endpoint rồi nhấn Lưu lại trên chính form đang mở, ứng dụng báo thành công và tự đóng form. Người dùng xác nhận tên thiết bị trên Cloud đã cập nhật đúng.
- [x] Retry hoàn tất mà không reload/đóng trình duyệt; phép thử dùng cùng form và luồng retry của ứng dụng. Kết quả phù hợp với việc dùng lại mutationId/snapshot theo code đã đối chiếu ở mục 26.2; không tuyên bố đã quan sát trực tiếp mutationId trong Network/IndexedDB.
- [ ] Chưa kiểm thử PC/Mobile đồng thời và chưa xác nhận toàn bộ luồng Asset Edit Lease + Mutation Receipt đã nghiệm thu.

### 26.4 Kiểm thử Local commit thành công nhưng Cloud RPC chưa xác nhận – 19/11/2026

- Dùng Chrome DevTools Network Request Blocking để chặn riêng request `https://oyzhxgzltpdebpymuicb.supabase.co/rest/v1/rpc/apply_asset_mutation_with_lock`; không chặn toàn bộ Supabase domain.
- Trên Asset đã mapping Cloud, mở form sửa, thay đổi tên và nhấn Lưu. Ứng dụng báo lỗi `TypeError: Failed to fetch`; theo thông báo UI, Local đã lưu snapshot nhưng Cloud chưa xác nhận. Form vẫn mở.
- Bỏ chặn riêng RPC khi form còn mở, không reload trang, không đóng form và không tạo thao tác sửa mới; nhấn Lưu lại.
- Người dùng xác nhận ứng dụng báo lưu thành công, form tự đóng và tên thiết bị trên Cloud đã cập nhật đúng.
- **Kết luận:** phép thử runtime retry sau lỗi mạng của RPC PASS. Đã chứng minh người dùng có thể khôi phục thao tác ngay trên form còn mở sau khi RPC được thông suốt. Kết quả phù hợp với code retry dùng mutation unresolved cùng payload/mutationId đã đối chiếu ở mục 26.2; không ghi nhận là đã trực tiếp quan sát mutationId trong DevTools.
- Sau thử nghiệm, mẫu chặn đã được bỏ dấu tích; cần giữ request blocking ở trạng thái tắt hoặc xóa mẫu để tránh chặn nhầm trong lần làm việc sau.
- Không thay đổi code, SQL/migration, dữ liệu khác hoặc cấu hình Supabase trong phép thử.

### 26.5 Trạng thái sau kiểm thử
- [x] Local commit trước Cloud RPC và giữ mutation khi RPC thất bại: PASS theo thông báo ứng dụng và kết quả retry.
- [x] Retry trên form còn mở sau khi bỏ chặn RPC: PASS.
- [x] Cloud nhận đúng dữ liệu sau retry: PASS theo xác nhận trực tiếp của người dùng.
- [ ] Chưa kiểm thử PC/Mobile đồng thời, hai nền tảng cùng xin lease, heartbeat failure riêng biệt hoặc takeover sau lease hết hạn.
- [ ] Chưa nghiệm thu toàn bộ Asset Edit Lease + Mutation Receipt trên nhiều nền tảng; chưa bật đồng bộ nghiệp vụ tổng thể.


## 27. Thiết kế Cloud → Local: nhận từng Asset về Local (19/11/2026)

### 27.1 Audit hiện trạng trên main
- `src/lib/assetsCloud.ts:listCloudAssets()` đọc danh sách Asset từ Supabase và map sang kiểu Asset; không ghi Dexie.
- `src/CloudAssetsPanel.tsx` chỉ hiển thị Cloud Asset và đang có luồng import Local → Cloud. Chưa có chức năng đưa Asset Cloud xuống Local.
- Dexie v8 đã có `assetCloudLinks` với các trường organizationId, assetId, cloudCode, cloudUpdatedAt, lastSyncedLocalUpdatedAt, status, linkedAt, lastVerifiedAt.
- Cloud Asset hiện được map với `images: []`; ảnh Local chưa có Cloud Storage nên không thể phục hồi từ Cloud.
- `src/lib/cloudSync.ts` là giao thức JSON cũ, chưa bật worker; không sử dụng để triển khai chiều Cloud → Local.

### 27.2 Phạm vi đề xuất – phiên đầu
- Bổ sung thao tác nhận **một Asset Cloud được người dùng chọn** về Local, phục vụ phục hồi dữ liệu và kiểm thử PC–Mobile.
- Đọc lại row Cloud theo đúng organization + Asset UUID ngay trước khi áp dụng; không dựa duy nhất vào dữ liệu list đã tải trước.
- Giữ nguyên Cloud UUID, code, dữ liệu nghiệp vụ và timestamps. Không tự sinh ID/mã mới.
- Preflight: nếu Local đã có cùng UUID thì không ghi đè; nếu UUID hoặc code xung đột với Asset Local khác, hoặc có mutation/queue chưa xử lý liên quan, dừng và báo rõ.
- Khi Asset chưa có trên Local và không xung đột, lưu Asset cùng mapping `assetCloudLinks` trong một Dexie transaction; không tạo generic syncQueue hoặc AssetMutation.
- Mapping sau import ghi status `linked`, Cloud code/version và timestamps phù hợp snapshot đã nhận; không tự xác lập mapping khi chưa ghi Local thành công.
- Import Cloud không sửa Cloud, không tải toàn bộ Asset, không nhập Task/Plan/Log/Checklist/Inventory/Movement hoặc ảnh. Không overwrite hồ sơ Local hiện hữu.
- Nếu cùng UUID đã có Local và dữ liệu trùng hoàn toàn, phiên đầu có thể báo “đã có trên Local” và không ghi; nếu khác payload, báo conflict, không tự chọn bên thắng.

### 27.3 Kiểm thử dự kiến
- Import đúng một Asset Cloud vào Local Mobile đang trống; xác nhận Asset ID/code/payload và mapping được giữ đúng.
- Kiểm tra Local PC và Cloud không bị thay đổi.
- Test collision UUID/code và Asset đã tồn tại Local; mọi trường hợp phải fail/no-op an toàn, không overwrite.
- Sau khi có cùng Asset ID trên PC và Mobile, kiểm thử PC giữ lease thì Mobile không mở được form sửa; kiểm thử chiều ngược lại sau khi release/expiry lease.
- Không dùng Local PC có nhiều dữ liệu để reset hoặc làm thử; không khởi chạy LAN dev server để phục vụ test này.

### 27.4 Giới hạn và trạng thái
- Đây là import/restore có chọn lọc Cloud → Local, chưa phải pull/change-feed hoặc đồng bộ hai chiều tổng thể.
- Chưa sửa code, chưa thêm migration, chưa chạy SQL/RPC, chưa ghi hoặc thay đổi dữ liệu Cloud/Local.
- Thiết kế cần review trước khi triển khai. Các bảng lịch sử, xung đột, tombstone, phân trang và đồng bộ nền thuộc giai đoạn sau.


### 27.5 Chốt phạm vi triển khai code trước khi sửa
- Chỉ bổ sung thao tác nhận một Asset Cloud được chọn về Local trong `CloudAssetsPanel` và hàm đọc lại một Asset Cloud theo organization + UUID trong `assetsCloud.ts`.
- Tận dụng Dexie v8 hiện có; không thêm migration/schema.
- Dùng quyền `assets.import` hiện có; không tạo quyền backend mới hoặc thay đổi RLS/RPC.
- Trước ghi: đọc lại Cloud row; kiểm tra UUID/code Local, mapping hiện có, mutation chưa xác nhận và hàng đợi Asset chưa xử lý. Mọi xung đột phải dừng, không overwrite.
- Ghi Asset + mapping trong một Dexie transaction; không tạo syncQueue hoặc AssetMutation; giữ nguyên UUID/code/timestamps từ Cloud, ảnh Local không được phục hồi (images=[]).
- Không sửa App.tsx, assetEditLocks, các phân hệ khác, SQL/migration hoặc dữ liệu Cloud.
- Sau commit, kiểm tra GitHub Actions/build; chỉ khi CI PASS mới hướng dẫn user kiểm thử trên Mobile với đúng một Asset. Runtime chưa được đánh dấu PASS trước khi user xác nhận.


### 27.6 Triển khai chức năng nhận một Asset Cloud về Local – code trên main (19/11/2026)
- Commit `3aeec7a6f237d4233a3927301dcf9377c1cd3a7a`: thêm `getCloudAssetById()` trong `src/lib/assetsCloud.ts`, đọc đúng một Asset theo đồng thời organization_id + UUID; chỉ đọc, không ghi Cloud.
- Commit `d1b1fde4d6e3a77c6ffc400d314fcd6f494aab02`: thêm thao tác “Nhận về Local” cho từng Asset đang quản lý hoặc đã lưu kho trong `src/CloudAssetsPanel.tsx`; dùng quyền `assets.import` hiện có, không thêm quyền/RPC/migration.
- Trước khi ghi, ứng dụng đọc lại Asset Cloud theo UUID; kiểm tra Local không có cùng UUID, không có mã trùng, không có mapping treo, mutation pending/processing/conflict hoặc hàng đợi Asset chưa xử lý.
- Asset và mapping `assetCloudLinks` được thêm trong cùng Dexie transaction; giữ UUID, code, payload và timestamps từ Cloud; đánh dấu identityStatus synced; images=[] vì ảnh chưa được lưu trên Cloud. Không tạo syncQueue/AssetMutation, không overwrite dữ liệu Local.
- Nếu Local đã có cùng UUID hoặc mã, hoặc có mapping/mutation/queue liên quan, thao tác dừng và báo lỗi; không tự ghép hoặc ghi đè.
- Commit `30b6b8ae7987f66a74e1046a01e9a8c8a66d7ca1`: chỉnh chú thích cuối Cloud panel để phân biệt nhận Asset về Local với thao tác khôi phục trạng thái lưu kho.
- Đã fetch lại các file trên main và xác nhận handler, truy vấn tenant-scoped, transaction và nút nhận ở cả danh sách đang quản lý/lưu kho. Không sửa App.tsx, assetEditLocks, SQL/migration, RPC, RLS, syncQueue worker hoặc dữ liệu Cloud.
- Kiểm tra GitHub workflow runs cho commit code: không có workflow run được trả về; commit combined status không có status check. Vì vậy chưa xác nhận build/TypeScript PASS từ CI. Chưa có kiểm thử runtime; không đánh dấu chức năng PASS.
- Bước tiếp theo: cần chạy build/TypeScript qua môi trường dự án hoặc thiết lập CI hiện có; chỉ sau đó mới hướng dẫn nhận đúng một Asset Cloud về Local trên Mobile và kiểm tra UUID/code/mapping. Không thử trên Local PC có 60 Asset và không reset dữ liệu.


## 28. Kiểm thử runtime Cloud → Local và Asset Edit Lease PC–Mobile (19/11/2026)

### 28.1 Nhận một Asset Cloud về Local trên Mobile
- Build local do người dùng chạy: `npm.cmd run build` hoàn tất `tsc -b && vite build`; Vite build thành công.
- Thử truy cập Vite qua IP LAN ban đầu không vào được do dev server chưa lắng nghe đúng interface. Sau khi khởi động lại bằng `npm.cmd run dev -- --host 0.0.0.0`, điện thoại truy cập được `http://192.168.0.2:5173/`.
- Trên origin IP LAN, Cloud hiển thị đúng 1 Asset; người dùng nhấn “Nhận về Local”, sau đó xác nhận Local có đúng 1 Asset.
- Người dùng đối chiếu UUID của Asset Local trên Mobile với UUID Cloud và xác nhận giống hệt.
- Khi quay lại domain HTTPS, Local trên domain ban đầu chưa có Asset do IndexedDB được phân vùng theo origin. Người dùng nhận lại đúng Asset duy nhất từ Cloud trên domain HTTPS; xác nhận Local có 1 Asset và UUID trùng Cloud.
- Không nhận hàng loạt, không reset Local PC, không bật đồng bộ tổng thể. Không khôi phục ảnh, checklist, nhật ký, vật tư hoặc các bảng nghiệp vụ khác.
- Lỗi `crypto is not a function` xuất hiện khi thử mở form sửa trên origin HTTP IP LAN. Không tiếp tục kiểm thử trên origin này; quay lại domain HTTPS. Không ghi nhận đây là lỗi Edit Lease vì chưa xác minh nguyên nhân ở mã nguồn.

### 28.2 Kiểm thử Edit Lease giữa PC và Mobile
- Dùng cùng một Asset đã được nhận về Local trên domain HTTPS; người dùng xác nhận UUID trên PC và Mobile giống hệt nhau.
- Cùng một tài khoản:
  - PC mở form Sửa và giữ lease; Mobile thử mở Sửa cùng Asset thì bị chặn, UI hiển thị thiết bị đang bị khóa bởi tài khoản đang giữ lease: PASS.
  - Sau khi PC thoát form không lưu, tiếp tục kiểm tra chiều ngược lại: Mobile giữ lease thì PC bị chặn: PASS.
  - Mobile thoát form không lưu; PC mở lại được quyền Sửa sau khi lease được giải phóng/hết hiệu lực: PASS theo quan sát người dùng.
- Hai tài khoản khác nhau:
  - PC đăng nhập tài khoản A, Mobile đăng nhập tài khoản B.
  - PC giữ lease thì Mobile bị chặn; Mobile giữ lease thì PC bị chặn: PASS theo xác nhận người dùng.
- Các lần thử chỉ mở form và kiểm tra quyền khóa; không thay đổi hoặc lưu dữ liệu Asset trong phép thử hai chiều này.

### 28.3 Kết luận và giới hạn
- [x] Build production local: PASS theo output người dùng cung cấp.
- [x] Nhận chọn lọc một Asset Cloud về Local trên Mobile; UUID khớp Cloud: PASS theo xác nhận người dùng.
- [x] Đối chiếu cùng UUID trên PC và Mobile: PASS theo xác nhận người dùng.
- [x] Edit Lease cùng một tài khoản, PC giữ khóa → Mobile bị chặn: PASS.
- [x] Edit Lease cùng một tài khoản, Mobile giữ khóa → PC bị chặn: PASS.
- [x] Thoát form trên Mobile, PC mở lại được quyền Sửa: PASS.
- [x] Edit Lease với hai tài khoản khác nhau, kiểm tra cả hai chiều PC/Mobile: PASS theo xác nhận người dùng.
- Chưa xác minh hai tài khoản thuộc cùng organization hay khác organization trong phép thử này; không dùng kết quả khóa để kết luận về cách ly tenant hoặc phân quyền cross-organization.
- Chưa kiểm thử lưu thay đổi đồng thời, heartbeat failure riêng biệt, takeover khi lease hết hạn trong lúc đang sửa, hoặc phục hồi mutation pending sau reload.
- Chưa nghiệm thu toàn bộ Asset Edit Lease + Mutation Receipt; phạm vi PASS hiện tại chỉ là các tình huống acquire/block/release đã nêu.
- Không bật đồng bộ nghiệp vụ tổng thể; không thay đổi code, SQL/migration hoặc dữ liệu Cloud trong phiên kiểm thử này.

## 29. Kiểm thử runtime Mutation Receipt – lưu bình thường trên PC (19/11/2026)

### 29.1 Phạm vi và thao tác đã thực hiện
- Tiếp tục kiểm thử trên domain HTTPS, PC, với Asset thử nghiệm đã liên kết Local ↔ Cloud.
- Asset: UUID `872077a8-9b75-402d-908a-93fa5bcd9749`, mã `TDE-HP01-001-99-11-26`.
- Mở form sửa; Network ghi nhận RPC `acquire_asset_edit_lock` trả `acquired: true`, đúng Asset ID và holder là phiên PC đang thao tác.
- Thay đổi tên Asset thành **“Thiết bị kiểm thử khóa sửa - Lần 5”**, sau đó nhấn Lưu.
- Network ghi nhận RPC `apply_asset_mutation_with_lock` trả về:
  - `asset.id` khớp UUID của Asset thử nghiệm.
  - `asset.name` là tên mới “Thiết bị kiểm thử khóa sửa - Lần 5”.
  - `asset.updated_at` đã được cập nhật.
  - `applied_at` có giá trị.
  - `already_applied: false`, thể hiện mutation được áp dụng lần đầu, không phải replay receipt.
- Người dùng xác nhận giao diện Local hiển thị thông tin mới sau khi lưu.

### 29.2 Kết luận kiểm thử
- [x] Acquire Edit Lease trên PC cho đúng Asset: PASS theo Response Network.
- [x] RPC `apply_asset_mutation_with_lock` thực hiện lưu Cloud thành công: PASS theo Response Network.
- [x] Response có Asset snapshot đúng, `applied_at` và `already_applied: false`: PASS.
- [x] Local hiển thị thông tin mới sau khi lưu: PASS theo xác nhận trực tiếp của người dùng.
- Đây là kiểm thử đường lưu bình thường (first application). Chưa kiểm tra trực tiếp trạng thái bản ghi trong IndexedDB `assetMutations` hoặc đọc bảng receipt từ database.
- Không ghi nhận lock token, thông tin định danh tài khoản hoặc dữ liệu xác thực vào tài liệu tiến độ.

### 29.3 Trạng thái và điểm dừng
- [x] Đã kiểm tra mã nguồn `src/App.tsx`: Local Asset và mutation snapshot được ghi trong cùng Dexie transaction; mutation chuyển sang `processing`, gọi Cloud RPC; chỉ khi nhận receipt hợp lệ mới chuyển `applied`, cập nhật mapping Cloud version, đóng form và release lease.
- [x] Đã kiểm tra migration `supabase/migrations/20261118000300_asset_mutation_receipts.sql`: Cloud lưu receipt theo khóa `(organization_id, mutation_id)`; replay cùng user, Asset, expected version và payload trả receipt cũ với `already_applied: true`; tái sử dụng mutation ID với payload/version khác bị từ chối.
- [ ] Chưa kiểm thử runtime tình huống Cloud đã commit nhưng response bị mất, sau đó retry cùng mutation ID/payload để quan sát `already_applied: true` trong phiên này.
- [ ] Chưa kiểm tra trực tiếp bản ghi Local `assetMutations` sau lần lưu vừa rồi.
- [ ] Chưa nghiệm thu toàn bộ Asset Edit Lease + Mutation Receipt; chưa bật đồng bộ nghiệp vụ tổng thể.
- **Điểm dừng phiên 19/11/2026:** giữ nguyên trạng thái hiện tại, không thao tác thêm trên Asset thử nghiệm. Khi tiếp tục, kiểm tra trạng thái mutation trong IndexedDB trước; sau đó mới quyết định cách kiểm thử replay receipt an toàn. Không tự ý chặn mạng hoặc tạo mutation mới khi chưa xác định rõ snapshot/mutation ID đang dùng.

## 30. Quyết định kiến trúc: ghi nghiệp vụ Cloud-first, Local cập nhật sau (19/11/2026)

### 30.1 Nguyên tắc đã thống nhất
- Mọi thao tác **ghi nghiệp vụ** phải yêu cầu kết nối Internet và Cloud sẵn sàng. Khi offline, người dùng vẫn có thể xem dữ liệu Local đã tải (nếu màn hình hỗ trợ), nhưng các thao tác ghi nghiệp vụ phải bị vô hiệu hóa/chặn và thông báo rõ lý do.
- Áp dụng cho các nghiệp vụ tạo mới, sửa, xóa hoặc thay đổi trạng thái dữ liệu (bao gồm thiết bị, vật tư, lịch/kế hoạch bảo trì, công việc, nhật ký và các phân hệ nghiệp vụ khác). Phạm vi chi tiết sẽ được rà soát khi triển khai từng phân hệ.
- Khi người dùng nhập form, dữ liệu chỉ ở trạng thái tạm trong giao diện/draft; chưa cập nhật Local database chính thức.
- Khi nhấn Lưu, gửi giao dịch lên Cloud. **Chỉ sau khi Cloud xác nhận thành công và trả dữ liệu/receipt hợp lệ, mới cập nhật Local chính thức**, đóng form và thông báo thành công.
- Nếu Cloud xác nhận giao dịch thất bại, không cập nhật Local chính thức; báo lỗi và giữ/đóng draft theo quy tắc UX sẽ chốt khi triển khai.
- Nếu timeout, mất kết nối hoặc response bị mất khiến kết quả Cloud chưa rõ, không được mặc định coi giao dịch thất bại hay tạo mutation mới. Phải reconcile bằng mutationId/idempotency receipt hoặc đọc trạng thái Cloud; nếu Cloud đã commit thì hoàn tất cập nhật Local theo kết quả đã xác nhận, nếu chưa commit mới cho phép retry/hủy an toàn.
- Kiểm tra trạng thái Internet trên UI chỉ là UX. Backend/RPC và quyền truy cập Cloud vẫn phải là nơi quyết định giao dịch có được chấp nhận hay không.

### 30.2 Edit Lease và Mutation Receipt tiếp tục được giữ
- Cơ chế **Asset Edit Lease** vẫn giữ nguyên: PC/Mobile xin khóa trên Cloud; thiết bị giữ lease trước được quyền sửa; nền tảng khác bị chặn cho đến khi lease được release/hết hiệu lực theo cơ chế hiện tại. Không bỏ khóa chỉ vì nghiệp vụ ghi chuyển sang Cloud-first.
- **Mutation Receipt/idempotency** vẫn cần để xử lý retry, timeout, response bị mất và bảo vệ khỏi áp dụng giao dịch trùng. Cloud-first không loại bỏ các tình huống kết quả giao dịch chưa rõ.
- Việc mỗi kỹ thuật viên thường phụ trách khu vực/nhóm thiết bị riêng khiến tranh chấp sửa đồng thời không phổ biến; tuy vậy, ứng dụng vẫn phải xử lý an toàn khi tình huống này xảy ra.

### 30.3 Các cơ chế cũ cần audit trước khi triển khai
- Rà soát luồng Local-first Asset hiện tại (Local snapshot + mutation pending/processing, retry, recovery sau reload, mapping Cloud version) và xác định cách chuyển sang Cloud-confirmed → Local commit.
- Rà soát các phân hệ khác, các nút tạo/sửa/xóa/thay đổi trạng thái, offline behavior, draft, validation, rollback, receipt/idempotency và quyền backend.
- Không xóa code, không sửa schema/migration/RPC, không thay đổi dữ liệu Local/Cloud, không triển khai ngay trong quyết định này.
- Việc chuyển đổi phải được thiết kế và kiểm thử riêng theo từng phân hệ; tránh làm ảnh hưởng các luồng đang hoạt động hoặc kết quả kiểm thử đã ghi nhận.

### 30.4 Trạng thái
- [x] Người dùng và trợ lý thống nhất định hướng Cloud-first cho mọi thao tác ghi nghiệp vụ; Local chính thức chỉ cập nhật sau Cloud xác nhận.
- [x] Giữ Edit Lease PC/Mobile và Mutation Receipt/idempotency.
- [ ] Chưa audit toàn bộ code và các phân hệ để lập kế hoạch chuyển đổi.
- [ ] Chưa sửa code, SQL/migration, RPC, cấu hình hoặc dữ liệu; chưa triển khai cơ chế mới.

## 31. Audit ban đầu kiến trúc ghi dữ liệu Cloud-first – 19/11/2026

- Đã đọc các handlers ghi chính trong `src/App.tsx`, `src/db.ts`, `src/lib/cloudSync.ts`, `src/lib/assetsCloud.ts`, `src/lib/assetEditLocks.ts`, `src/CloudAssetsPanel.tsx` và tài liệu audit/draft hiện có trên `main`.
- Kết luận: code hiện tại **chưa theo Cloud-first**. Asset linked đang commit snapshot Local + mutation trước RPC; Asset Local chưa linked, Inventory, Task, Maintenance Plan, Log, Movement và Checklist vẫn ghi Dexie + `syncQueue` trước. Một số thao tác ghi ghép nhiều record cần backend transaction nguyên tử.
- `syncLocalDatabase()` trong `src/lib/cloudSync.ts` là protocol JSON cũ; search hiện chỉ thấy định nghĩa, chưa thấy caller trong app. Không coi queue đang được đồng bộ nền.
- Chưa có gate Cloud readiness thống nhất; `navigator.onLine` chỉ dùng ở một số luồng. Gate UI không thay thế xác nhận backend/RPC.
- Giữ Edit Lease và Mutation Receipt. Các mutation pending/processing/conflict và dữ liệu Local-only phải reconcile trước rollout; không xóa queue hoặc reset dữ liệu để chuyển đổi.
- Đã lập audit chi tiết và lộ trình từng vertical slice tại `supabase/CLOUD_FIRST_WRITE_AUDIT.md`.
- [x] Audit ban đầu các write handler và cơ chế Local queue.
- [x] Ghi nhận các transaction cần thiết (Movement + Inventory, Task + Log, Checklist Template + Version, v.v.) và các rủi ro idempotency/recovery.
- [ ] Chưa audit hết mọi action UI/setting/restore; tiếp tục rà soát trước khi code.
- [ ] Chưa sửa code, SQL/migration/RPC hoặc dữ liệu; chưa runtime test; chưa triển khai Cloud-first.

### Bước tiếp theo
Rà soát bổ sung toàn bộ thao tác UI (nút thêm/sửa/xóa, archive/restore, import/backup, cấu hình, các hành động tự tạo dữ liệu), phân loại rõ business write / local setting / read / export / restore, rồi chốt danh sách transaction/API/RPC trước khi thiết kế chuyển đổi. Không bắt đầu sửa code cho đến khi audit và phạm vi triển khai được thống nhất.

## 32. Audit bổ sung các thao tác phụ và tiện ích – 19/11/2026

- Đã rà soát thêm tạo dữ liệu mẫu Local, Checklist auto-create khi mở màn hình, backup/restore, cấu hình localStorage, CloudAssetsPanel settings/import và các thao tác export.
- Phân loại tạm: business writes phải Cloud-first; theme/tùy chọn cá nhân Local-only; organization settings Cloud-first; export/backup là read; restore/import là quy trình riêng có preflight; demo/test utility Local-only và phải tách khỏi tenant dữ liệu thật.
- Phát hiện Checklist mặc định hiện tự tạo Template + Version Local/queue khi mở Checklist nếu chưa có; cần xử lý để không tự commit nghiệp vụ chỉ do mở màn hình.
- Backup restore hiện thay toàn bộ dữ liệu Local trong transaction và có preflight bảo vệ Asset linked/mutation unresolved; cần đánh giá riêng, không tự coi là Cloud upload.
- Đã cập nhật audit chi tiết tại `supabase/CLOUD_FIRST_WRITE_AUDIT.md` (mục 7–8).
- [x] Phân loại sơ bộ utilities/settings/import/export/restore.
- [ ] Chưa audit từng component/modal và toàn bộ delete/permission matrix; cần hoàn tất trước khi chốt API/RPC.
- [ ] Chưa sửa code, chưa chạy test và chưa triển khai Cloud-first.

### Tiếp tục
Hoàn tất rà soát component/modal, thao tác xóa và phân quyền để lập inventory đầy đủ; sau đó chốt transaction boundaries và thiết kế Cloud contract. Chưa code.

## 33. Audit bổ sung write sites và thao tác phụ – 19/11/2026

- Đã rà soát các write handlers chính trong src/App.tsx: Asset, Inventory, Task, Maintenance Plan, Maintenance Log/Request, Task completion, Asset archive/restore/status, Inventory Movement và Checklist Template/Version/Result.
- Xác nhận Asset linked hiện vẫn ghi snapshot Local + AssetMutation trước RPC; Asset chưa linked và phần lớn phân hệ khác ghi Dexie + syncQueue trước. Chưa đáp ứng Cloud-first.
- Xác nhận ensureDefaultChecklist() tự tạo Template + Version và queue khi mở Checklist nếu chưa có; cần bỏ side-effect auto-commit khi chuyển đổi.
- Đã rà soát thao tác tạo dữ liệu demo, backup/restore, quản lý thành viên, cập nhật hồ sơ Auth cá nhân, CloudAssetsPanel và cấu hình mã Asset:
  - Demo/test: Local-only, không tự đưa lên Cloud.
  - Backup/export/print: read/export.
  - Restore backup: local recovery thay thế dữ liệu Local, cần preflight/reconciliation riêng.
  - Nhận Asset Cloud về Local: import/cache có chọn lọc, giữ semantics đọc Cloud rồi ghi Local + mapping.
  - Quản lý thành viên: Edge Function Cloud, chờ response; cần tiếp tục xác minh backend permission.
  - Hồ sơ Auth cá nhân: Supabase Auth metadata, tách khỏi business write.
  - Cấu hình dùng chung của tổ chức: Cloud-first; cấu hình cá nhân/local UI: Local-only.
- Đã bổ sung mục 9 trong supabase/CLOUD_FIRST_WRITE_AUDIT.md.
- Chưa hoàn tất permission matrix mọi role/component/modal và chưa rà hết các child modules/điểm xóa; chưa thiết kế API/RPC chi tiết.
- Chưa sửa code, SQL/migration/RPC, chưa thay đổi dữ liệu Cloud/Local và chưa runtime test.

### Bước tiếp theo
Hoàn tất inventory quyền theo role và rà các component/modal còn lại; sau đó lập transaction boundary + danh sách Cloud RPC/receipt cho từng vertical slice. Chưa code.


## 34. Đối chiếu quyền vai trò phục vụ Cloud-first (19/11/2026)

- Đã đọc lại `supabase/CLOUD_PERMISSION_UI_MATRIX.md` và đối chiếu permission catalog migration 005/006 với UI hiện tại.
- Giữ nguyên chính sách quyền hiện có, không tự cấp thêm quyền cho Technician:
  - Admin: toàn quyền theo permission catalog.
  - Technician: được tạo/cập nhật Asset, Inventory, Task/Plan, Log; điều chỉnh kho và thực hiện Checklist/tạo kết quả; không được xóa nghiệp vụ, quản lý Checklist Template/Version hoặc quản trị tổ chức.
  - Viewer: chỉ xem.
- Sai lệch cần xử lý khi triển khai: UI đang dùng `isViewer` cho nhiều thao tác thay vì permission từng action; Technician có thể thấy luồng xóa Maintenance Plan và sửa Checklist Template dù catalog không cấp các quyền đó. Việc tự tạo Checklist mặc định khi mở màn hình cũng phải chuyển thành khởi tạo có kiểm soát quyền Admin.
- Server-side RLS/RPC/Edge Function vẫn là lớp enforce bắt buộc; ẩn/disable UI không thay thế kiểm tra quyền Cloud.
- Đã bổ sung mục 10 trong `supabase/CLOUD_FIRST_WRITE_AUDIT.md`.
- Chưa thay đổi permission catalog, UI, code, SQL/migration, database hay dữ liệu. Chưa xác nhận migration đã được áp dụng trên Supabase project.

### Bước tiếp theo
Rà soát tiếp các child component/modal và xác định transaction boundary + API/RPC cho từng nhóm Asset, Inventory, Maintenance, Checklist. Không triển khai trước khi thiết kế và kiểm thử permission contract.


## 35. Rà soát bổ sung Cloud-first: demo, restore queue, Checklist và cấu hình (19/11/2026)

- Phát hiện `createDemoData()` và `createAdditionalDemoAssets()` ghi dữ liệu mẫu Local nhưng vẫn thêm entry vào business `syncQueue`. Cần tách demo/test dataset hoặc bỏ enqueue; tuyệt đối không upload demo vào tenant Cloud. Phải phân loại queue demo cũ trước khi chuyển đổi.
- Backup export cả `syncQueue`; Restore thay thế queue bằng dữ liệu trong backup. Dù đã có preflight bảo vệ Asset Cloud-linked và Asset mutation unresolved, chưa thấy bảo vệ tương đương cho mọi pending queue/mutation khác. Restore tiếp tục là local recovery riêng; không tự replay queue từ backup, không xóa queue hiện tại khi chưa reconciliation receipt/trạng thái giao dịch.
- `AssetChecklist` tự gọi `ensureDefaultChecklist()` khi mở màn hình nếu `allowActions`; điều kiện chỉ loại Viewer nên Technician có thể kích hoạt tạo Template/Version dù catalog chỉ cho Admin quản lý Template. Cần chuyển thành draft/preview; chỉ Admin chủ động lưu sau Cloud confirmation mới tạo chính thức.
- `saveCloudAssetCodeConfig()` ghi organization setting qua PostgREST và chờ response; giữ Cloud-first + server-side `settings.manage`. `onSaveProfile()`/đặt mật khẩu là Auth cá nhân; theme/compact/device ID là Local cá nhân, không nhập vào business write queue.
- Cloud Asset import vẫn là Cloud read → Local restore/cache chọn lọc; phân biệt với business mutation.
- Đã bổ sung mục 11 trong `supabase/CLOUD_FIRST_WRITE_AUDIT.md`.
- Chưa sửa code/SQL/RPC, chưa thay đổi dữ liệu hay permission; chưa runtime test. Đây là static audit trên main.

### Bước tiếp theo
Rà nốt các child/modal và permission gating; sau đó chốt transaction contract, mutation receipt/idempotency và kế hoạch xử lý queue/restore cho từng vertical. Không triển khai code trước khi thiết kế được thống nhất.


## 36. Bản đồ transaction Cloud-first (bản đề xuất, chưa triển khai)

- Đã lập transaction boundary theo từng vertical: Asset create/update/status/archive/restore; Inventory metadata và movement atomic; Task và complete Task + Log; Maintenance Plan; Checklist Template + Version; Checklist Result; Maintenance Log + revision; organization settings; quản lý thành viên.
- Mỗi business mutation cần Cloud authorization + transaction + idempotency receipt trong cùng commit; Local snapshot chỉ cập nhật sau Cloud confirmation. Timeout phải replay/tra receipt bằng cùng mutation ID + payload; Local commit lỗi sau Cloud commit phải phục hồi từ canonical snapshot/receipt.
- Asset Edit Lease vẫn là khóa độc quyền riêng; receipt hiện tại chỉ chuyên cho Asset update có lease, chưa đủ làm receipt chung cho toàn bộ vertical.
- Đã đối chiếu sơ bộ migration business schema 002, permission 005/006, Asset lease/receipt và tài liệu Inventory/Log revision.
- Các điểm còn phải chốt: receipt tổng quát hay riêng từng vertical; row version cho các bảng ngoài Asset; quy tắc Điều chỉnh/tồn đầu kỳ kho; Log revisions; batch Maintenance Plan; phục hồi Local sau Cloud commit; xử lý queue Local-first cũ.
- Đã ghi bản thiết kế đề xuất tại mục 12 của `supabase/CLOUD_FIRST_WRITE_AUDIT.md`.
- Đây chưa phải quyết định cuối cùng; chưa tạo migration/RPC, chưa sửa code, chưa chạy SQL hoặc runtime test.

### Bước tiếp theo
Review transaction boundary và chốt các quyết định còn mở trước khi viết hợp đồng RPC chi tiết. Không triển khai code/SQL khi các quy tắc nghiệp vụ còn chưa rõ.


## 37. Chuẩn hóa Receipt và replay (19/11/2026)

- Đối chiếu các thiết kế đã có: `CLOUD_RPC_IDEMPOTENCY_CHANGEFEED_DESIGN.md` đề xuất ledger chung `organization_mutations`; migration Asset hiện có bảng `asset_mutation_receipts` chuyên cho Asset update có lease.
- Đề xuất dùng một hợp đồng idempotency/ledger chung cho các vertical; RPC vẫn riêng theo nghiệp vụ. Một receipt phải chứa kết quả đủ phục hồi mọi record trong mutation nhiều bản ghi (ví dụ complete Task + tạo Log). Không tạo thêm receipt table riêng cho từng bảng nếu không có lý do.
- Asset receipt hiện hữu không được xóa ngay; phải có phase chuyển đổi/hợp nhất hoặc adapter tạm thời được kiểm soát. Tránh dual-write hai ledger độc lập.
- Fingerprint do server chuẩn hóa/tính; repository chưa xác minh pgcrypto nên chưa được viết migration phụ thuộc digest. Canonical request JSON có giới hạn là phương án cần review nếu chưa có hash extension.
- Phát hiện trong Asset RPC: kiểm tra `assets.update` xảy ra trước khi tra receipt. Nếu Cloud đã commit, response mất, rồi quyền update bị thu hồi, retry cùng mutation ID có thể không xác nhận được kết quả cũ. Cần tách replay read-only khỏi mutation mới; vẫn kiểm tra Auth và tổ chức, không để actor khác/membership inactive truy cập snapshot. Chốt chính sách khi chỉ permission bị thu hồi và test commit → lost response → revoke permission → replay.
- Draft row_version 015 đã bao phủ master mutable nhưng chưa phải migration đã áp dụng. Asset cần kế hoạch chuyển từ expected updated_at sang row_version; Inventory movement dùng expected item version; complete Task + Log dùng một mutation ID/receipt chung; append-only history không cần row_version.
- Đã bổ sung mục 13 trong `supabase/CLOUD_FIRST_WRITE_AUDIT.md`.
- Chưa sửa code/SQL/RPC, chưa chạy SQL/runtime test, chưa xác minh pgcrypto hoặc trạng thái migration trên Supabase.

### Bước tiếp theo
Hoàn thiện hợp đồng quyền/replay và quyết định điều chỉnh tồn kho; sau đó mới viết các RPC draft. Không triển khai khi chưa thống nhất các quy tắc này.


## 38. Đề xuất quy tắc Kho và Nhật ký – chờ người dùng duyệt (19/11/2026)

### Kho
- Đề xuất “Điều chỉnh” là nhập số tồn thực tế sau kiểm kê; server khóa item, đọc tồn trước, tính delta có dấu = tồn thực tế - tồn hệ thống, cập nhật balance bằng số thực tế.
- Movement cần lưu balance_before, balance_after, counted_quantity và quantity_delta có dấu. Cột quantity hiện tại CHECK > 0 nên phải bổ sung field có dấu hoặc hướng tăng/giảm; không đổi nghĩa cột cũ âm thầm.
- Bắt buộc lý do, actor, mutation ID, expected item version; balance + movement + receipt + event cùng transaction. Không tạo movement nếu không chênh lệch, trừ khi quyết định bổ sung biên bản kiểm kê riêng.
- Dùng permission inventory.adjust hiện có cho Admin/Technician; tồn đầu kỳ khi tạo vật tư cần xác nhận Technician có được phép theo inventory.create.
### Nhật ký
- Draft trước Cloud submit có thể sửa; sau Cloud commit, revision đã lưu bất biến, mọi sửa đổi tạo revision mới và lưu lý do.
- Catalog hiện chỉ có logs.create, không có logs.update/revise. Đề xuất ít quyền nhất: thêm logs.revise và cấp Admin-only; Technician tạo mới nhưng muốn sửa phiếu đã lưu phải gửi Admin. Không hard-delete.
- Phương án thay thế: logs.revise.own cho Technician chỉ sửa Log do chính mình tạo, Admin sửa mọi Log; cần created_by_user_id bất biến và kiểm tra ownership ở server.
- Chưa tự thay đổi permission. Hoàn thành Task + tạo Log revision 1 vẫn cùng transaction.
### Cần người dùng duyệt
1. Điều chỉnh theo số tồn thực tế sau kiểm kê?
2. Admin-only sửa Log đã lưu, hay Technician được sửa Log do mình tạo?
3. Technician có được tạo vật tư kèm tồn đầu kỳ?
4. Có cần lưu biên bản kiểm kê khi không chênh lệch?
- Đã ghi phương án tại mục 14 của CLOUD_FIRST_WRITE_AUDIT.md. Đây chưa phải quyết định đã chốt; chưa sửa code/SQL/permission hoặc dữ liệu.


## 39. Đã chốt quy tắc Kho và Nhật ký; cập nhật thiết kế Cloud-first (19/11/2026)

### Quyết định đã chốt
- Điều chỉnh tồn kho: nhập số tồn thực tế sau kiểm kê; server tự tính chênh lệch. Nếu không chênh lệch thì không tạo movement/biên bản.
- Nhật ký đã lưu: chỉ Admin được sửa; sửa bằng revision mới append-only, có lý do; Technician chỉ được tạo Log.
- Tồn đầu kỳ: Technician và Admin đều được nhập khi tạo vật tư; tồn đầu kỳ là một phần của `create_inventory_item` theo `inventory.create`.
- Không hard-delete Log; draft trước Cloud submit được sửa trong form nhưng chưa ghi dữ liệu nghiệp vụ Local.

### Hợp đồng Kho
- `create_inventory_item`: `inventory.create`, initial_quantity >= 0; nếu > 0 thì tạo movement Nhập/Tồn đầu kỳ atomic; nếu 0 thì không movement.
- `update_inventory_item_metadata`: `inventory.update`, tuyệt đối không nhận quantity.
- `post_inventory_movement`: Nhập/Xuất, `inventory.adjust`, lượng dương; server lock và tính balance.
- `adjust_inventory_count`: `inventory.adjust`, nhận counted_quantity >= 0 + reason bắt buộc + expected_version. Server tính delta có dấu. Delta 0 → no_change, không movement/version/event; khác 0 → cập nhật balance và ghi movement Điều chỉnh atomic.
- Movement mới lưu balance_before, balance_after, counted_quantity, quantity_delta có dấu; cột quantity hiện tại vẫn là lượng tuyệt đối dương. Legacy values không được suy đoán để backfill.

### Hợp đồng Nhật ký
- Thêm permission `logs.revise` Admin-only; Technician giữ `logs.create`, không có quyền revise.
- Root Log giữ ID ổn định + created_by_user_id; revision table append-only lưu đầy đủ snapshot, reason, actor, action, revision_no.
- `revise_maintenance_log` yêu cầu `logs.revise`, expected_revision_no, reason; insert revision mới cùng shared receipt/change event.
- `complete_maintenance_task` cập nhật Task + tạo Log revision 1 trong một transaction với `maintenance.update` + `logs.create`.
- Client không được UPDATE/DELETE trực tiếp root/revision hoặc INSERT revision; đường ghi qua RPC kiểm tra quyền.
- Task, Log, movement, receipt, change event phải commit/rollback đúng transaction boundary.

### Trạng thái triển khai
- Đã cập nhật thiết kế tại `CLOUD_INVENTORY_RPC_DESIGN.md`, `CLOUD_MAINTENANCE_LOG_REVISION_DESIGN.md`, audit mục 15.
- Chưa sửa code, migration, RLS/grants, RPC hay dữ liệu; chưa chạy SQL/runtime test; chưa bật Cloud worker.


## 40. Kế hoạch migration schema Cloud-first (19/11/2026)

- Đã đối chiếu schema, permission seed, RLS/grants, Asset receipt migration, row_version draft và Local Log model.
- Định hướng Inventory: bổ sung signed delta + before/after/count fields + actor/mutation/version; giữ quantity cũ dương, legacy audit fields NULL; không suy đoán tồn lịch sử.
- Định hướng Log: root giữ ID/FK; thêm created_by_user_id nullable; revisions append-only chứa snapshot đầy đủ; legacy rows tạo baseline revision 1, không bịa dueDate/requestedBy/actor/history.
- Permission mới logs.revise chỉ Admin; Technician không có quyền revise. Revision read theo logs.view, write qua SECURITY DEFINER RPC.
- Thu hồi direct table grants phải đi cùng RPC cutover, không thu hồi trước khi endpoint thay thế sẵn sàng.
- Chia rollout thành foundation/Receipt + row_version, Inventory, Log, change feed, client cutover. Mỗi giai đoạn Test trước, không áp Production.
- Chi tiết tại `supabase/CLOUD_FIRST_SCHEMA_MIGRATION_PLAN.md`.
- Chưa tạo SQL migration executable, chưa sửa code, chưa apply SQL hoặc thay đổi dữ liệu/quyền.


## 41. Tạo SQL schema drafts cho Kho và Nhật ký (19/11/2026)

- Tạo hai draft: `supabase/drafts/018_inventory_movement_audit_fields_DRAFT.sql` và `supabase/drafts/019_maintenance_log_revisions_DRAFT.sql`.
- Draft 018 bổ sung audit fields cho Movement, giữ quantity dương, không suy đoán lịch sử tồn.
- Draft 019 thêm created_by_user_id, revision table append-only, backfill legacy baseline, permission logs.revise Admin-only.
- Đây chưa phải migration áp dụng. Chưa chạy SQL, chưa thay DB, grants, UI hoặc dữ liệu.
- Bước tiếp: review logic và dependency, đặc biệt shared Receipt, row_version 015, direct grants cutover, legacy migration và kiểm thử trên Test.
\n\n## 42. Bổ sung tương thích Movement display fields (19/11/2026)\n\n- Đã đối chiếu Local Movement: note hiện trùng reason; không tạo cột note lặp.\n- Bổ sung performed_by_label tùy chọn để giữ snapshot tên người thao tác; created_by_user_id vẫn là Auth actor.\n- Chưa sửa code/mapping hoặc chạy SQL.\n

## 43. Review shared Receipt và row_version (19/11/2026)

- Shared Receipt thiết kế theo logical mutation, hỗ trợ nhiều affected records trong một transaction (ví dụ Task + Log).
- Fingerprint canonical do server dựng; không giả định pgcrypto; unique claim chống hai request cùng mutation ID chạy trùng.
- Receipt, business rows, row_version và change feed cùng commit/rollback. Conflict/no_change được ghi Receipt nhưng không phát event.
- Phát hiện Asset RPC hiện check assets.update trước replay. Đã đề xuất quy tắc replay same actor + active membership, không cần write permission lần nữa; snapshot phụ thuộc read permission hiện tại. Chờ xác nhận.
- Asset-specific Receipt/Lease vẫn giữ nguyên trong chuyển tiếp; không dual-write và không xóa receipt cũ.
- row_version trigger tăng theo mỗi SQL UPDATE; RPC cần update mỗi row đúng một lần. Asset chưa chuyển token từ updated_at/Lease.
- Chưa tạo shared-ledger SQL draft, chưa sửa draft 015, chưa chạy SQL.


## 44. Chốt chính sách replay shared Receipt (19/11/2026)

- Người dùng đồng ý cho cùng actor replay Receipt đã commit bằng cùng mutation ID/fingerprint khi Auth hợp lệ, organization active và membership còn active; không cần permission ghi cũ vì đây là xác nhận read-only, không phải mutation mới.
- Actor khác/cross-org bị từ chối; membership inactive hoặc organization inactive thì deny.
- Chỉ trả snapshot nếu actor hiện có read permission tương ứng; nếu không, chỉ trả acknowledgement tối thiểu, không tiết lộ snapshot nhạy cảm.
- Quyết định này thuộc shared Receipt design; Asset-specific Receipt/Lease và RPC hiện tại chưa thay đổi, cần kế hoạch chuyển đổi riêng.
- Chưa tạo SQL/RPC, chưa sửa code, chưa apply migration, chưa thay đổi dữ liệu/quyền Cloud hoặc chạy test.


## 45. Tạo SQL draft shared Receipt (19/11/2026)

- Tạo `supabase/drafts/020_organization_mutations_receipt_DRAFT.sql` để review DDL cho bảng Receipt chung `organization_mutations`.
- Receipt đại diện một logical mutation, hỗ trợ nhiều affected records; gồm organization + mutation ID, actor Auth, operation, canonical JSONB fingerprint, read permission codes, affected refs, result payload và trạng thái.
- Claim/replay: xác thực Auth + active organization + active membership; tra Receipt trước khi kiểm tra write permission. Receipt cũ cùng actor/fingerprint được replay read-only; full snapshot chỉ khi còn đủ read permission, nếu không chỉ acknowledgement. Mutation mới mới cần write permission và claim unique key.
- `pending` chỉ tồn tại bên trong transaction nghiệp vụ; deferred trigger buộc finalize trước commit, trigger khác bảo vệ Receipt bất biến sau finalize.
- Không phụ thuộc pgcrypto, không tạo generic claim RPC, không dual-write hoặc thay Asset Receipt/Lease. Đây chỉ là SQL draft; chưa chạy SQL, chưa apply Test/Production, chưa sửa code, dữ liệu hoặc quyền.


## 46. Live Test inventory và DDL draft Member audit/Invite Saga (19/11/2026)

- Đã kết nối đúng Supabase project BAOTRI-Mini-Test (ref oyzhxgzltpdebpymuicb), PostgreSQL 17.12; chỉ truy vấn metadata/catalog SELECT, không ghi dữ liệu.
- Test không có bảng Invite Saga hoặc audit nghiệp vụ Member. auth.audit_log_entries là audit nội bộ Supabase Auth, không tái sử dụng. asset_import_mutations và asset_mutation_receipts là asset-specific idempotency/receipt, không phải audit.
- Xác nhận role codes admin/technician/viewer; organization_members có id, organization_id, user_id, role, status, invited_by_user_id, created_at, updated_at.
- Tạo draft supabase/drafts/021_member_audit_and_invite_saga_DRAFT.sql: hai bảng riêng organization_member_invite_operations (PII/Saga) và organization_member_audit_events (append-only), RLS bật, không policy client, revoke direct table grants, audit target membership ID không FK/cascade, before/after JSONB có CHECK allowlist.
- Draft chưa có RPC, worker, audit read permission, retention/cleanup, PII encryption/key management hoặc state transition CAS. Adoption, audit scope, permission đọc audit, retention/backup, worker/manual recovery và actor_kind system còn cần quyết định.
- Cập nhật CLOUD_MEMBER_MANAGEMENT_RPC_DESIGN.md §30, CLOUD_FOUNDATION_DRAFTS_REVIEW.md §34, CLOUD_SHARED_RECEIPT_DRAFT_REVIEW.md §8.
- Các cập nhật GitHub đã fetch lại và xác minh SHA/nội dung. Chưa chạy DDL, chưa tạo migration, chưa thay đổi Supabase Test/Production, code, RLS/grants đang áp dụng hoặc dữ liệu.
- Cổng tiếp theo: review tĩnh DDL 021, chốt các quyết định còn mở, viết RPC/transaction tests; chỉ tạo migration và áp dụng Test sau khi có phê duyệt riêng.


## 47. Static review vòng 1 DDL 021 — Member Audit/Invite Saga (19/11/2026)

- Rà soát tĩnh DDL 021 và siết CHECK constraints: reason nonblank; adoption phải do user khác actor gốc tiếp quản; auth_user_created_by_operation chỉ được set khi auth_user_id có giá trị.
- Audit actor_kind=system chỉ dành cho member.invite.state.change; các membership lifecycle events bắt buộc target_membership_id + mutation_id; create/adopt/invite-state-change bắt buộc invite_operation_id.
- JSONB before/after allowlist enum dùng COALESCE để JSON null không vượt CHECK.
- Ghi nhận các việc còn thuộc RPC/runtime: transition CAS/state graph, bảo vệ bất biến Saga identity/fingerprint/PII, updated_at/version, attempt history, reason PII filtering, owner/TRUNCATE boundary, FK retention lifecycle, atomic Audit + Shared Receipt.
- Cập nhật Member design §31, Foundation review §35, Shared Receipt review §9.
- GitHub files đã fetch lại xác minh SHA/nội dung. Chưa chạy SQL/parser, chưa tạo migration, chưa thay đổi Supabase Test/Production, RPC, code hoặc dữ liệu.
- Bước kế tiếp: tiếp tục review transition/authorization/lock-order contract và lập bảng test cho các RPC trước khi có thể promote DDL.


## 48. Ma trận transition và test RPC Invite Saga (19/11/2026)

- Hoàn thiện Member design §32: transition graph cho requested/auth_calling/auth_outcome_unknown/auth_user_resolved/finalize_pending/needs_review và terminal states.
- Định nghĩa RPC contract: begin, cancel (chỉ trước Auth provisioning), claim Auth attempt, record Auth result, mark outcome unknown, finalize, adopt; self-activation là lifecycle RPC riêng cần chốt semantics.
- Thêm test cases về authorization, CAS/version, concurrency, stale attempt, Auth crash/timeout, replay Shared Receipt, adoption race, atomic rollback, PII leakage, grants/RLS/SECURITY DEFINER và lock order.
- Giữ quyết định đã duyệt: manual recovery giai đoạn đầu; Admin khác có thể adoption có audit; không tự xóa/attach Auth user khi ownership không rõ.
- GitHub Member design đã fetch lại xác minh sau commit. Chưa tạo RPC/SQL, chưa chạy Supabase, chưa sửa migration hoặc code.
- Còn mở: Auth provenance evidence, attempt-history requirement, self-activation audit/Receipt semantics, PII encryption/key management và retention.


## 49. Static schema adequacy review DDL 021 (19/11/2026)

- Đối chiếu DDL 021 với transition/RPC/test matrix §32.
- Kết luận: đủ làm khung operation + append-only audit, chưa đủ điều kiện promote/implementation.
- Gaps: attempt history; Auth provenance evidence; status/attempt/lease consistency; immutable intent; canonical fingerprint; adoption history semantics; audit transition sequence/idempotency; audit event shape; membership/receipt linkage validation; PII encryption/key management; retention; actor/adopter authorization và error classification.
- Ghi chi tiết yêu cầu status invariants và thứ tự công việc tại Member design §33.
- GitHub Member design, Foundation review và Progress file được cập nhật, fetch lại xác minh.
- Không sửa DDL 021; không tạo migration/RPC/Edge Function; không chạy SQL; không thay đổi Supabase Test/Production.
- Bước tiếp theo: chốt schema decisions (provenance, fingerprint, attempt history, adoption cardinality, audit sequence, PII/retention), sau đó mới chỉnh draft.


## 50. Chốt Auth provenance và request fingerprint cho Invite Saga (20/11/2026)

Người dùng đã chốt năm nguyên tắc kiến trúc:
- Auth provenance có bốn trạng thái: `created_by_operation`, `preexisting_verified`, `unknown`, `conflict`.
- Không đủ bằng chứng hoặc có xung đột: fail closed sang `needs_review`; không tự gắn hoặc xóa Auth user. Email trùng không phải bằng chứng sở hữu.
- Request fingerprint là canonical HMAC-SHA-256 digest; secret nằm ngoài Database, chỉ lưu digest và metadata phiên bản.
- Cùng operation ID nhưng digest khác: reject conflict; replay dùng đúng fingerprint/key version đã lưu.
- Adoption không thay đổi actor gốc hoặc fingerprint.

Đã ghi quyết định tại Member design §35 và Foundation review §38. Các chi tiết vận hành còn phải thiết kế trước DDL: quy trình xác minh tài khoản pre-existing, key retention/rotation và bảo vệ/retention email. Chưa sửa DDL 021; chưa tạo migration/RPC/Edge Function; không chạy SQL; không thay đổi Supabase Test/Production.


## 51. Thiết kế cấu trúc dữ liệu DDL 021 sau khi chốt provenance/fingerprint (20/11/2026)

Đã lập schema proposal tại Member design §36 và Foundation review §39:
- Invite operation: thay boolean Auth provenance bằng 4 trạng thái có evidence/attempt/verification metadata; thay JSONB fingerprint bằng HMAC-SHA-256 digest 32 bytes cùng version metadata; thêm `transition_version` riêng với row version.
- Tạo append-only attempt history `organization_member_invite_attempts`, giữ observed Auth ID là bằng chứng quan sát chứ không tự động liên kết Auth user.
- Audit Saga transition có `transition_id`, `transition_version`, unique idempotency và before/after saga status bắt buộc.
- Giữ một adopter hiện hành; audit append-only lưu mọi lần adoption/handoff; chưa cần bảng adoption history riêng.
- Còn mở: quy trình preexisting verification, secret/key retention/rotation, email encryption/retention, attempt event model và stable transition ID.

Đây là thiết kế, chưa sửa DDL 021, chưa tạo migration/RPC, không chạy SQL và không thay đổi Supabase Test/Production.


## 52. Attempt History và phục hồi timeout/crash cho Invite Saga (20/11/2026)

Đã lập proposal tại Member design §37, Foundation review §40: immutable attempt header + append-only attempt events; claim/commit attempt trước Auth call; lease expiry chỉ mở quyền reconciliation, không tự cho phép gọi Auth lần nữa; outcome_unknown không phải definitive failure; chỉ retry khi có bằng chứng không phát sinh side effect. Mỗi kết quả/reconciliation/mismatch được append event, không ghi đè lịch sử. Manual recovery trước, chưa xây worker.

Còn mở: provider evidence/correlation, definitive failure classification, lease duration và quyền takeover reconciliation. Default fail-closed. Chưa sửa DDL 021, chưa tạo RPC/worker, không chạy SQL và không thay đổi Supabase.


## 53. Chốt Attempt History và lease recovery cho Invite Saga (20/11/2026)

Người dùng đồng ý mô hình hai bảng: `organization_member_invite_attempts` là immutable attempt header; `organization_member_invite_attempt_events` là append-only event history. Attempt phải được commit trước Auth call. Lease expiry chỉ cho phép takeover reconciliation, không tự động gọi Auth lại. `outcome_unknown` không phải definitive failure; chỉ retry khi có bằng chứng đáng tin cậy rằng attempt trước không tạo side effect; nếu không đủ bằng chứng thì unresolved/`needs_review`.

Còn mở: provider evidence/correlation, definitive failure classification, lease duration và quyền Admin takeover. Chưa sửa DDL 021, chưa tạo RPC/worker, không chạy SQL và không thay đổi Supabase.


## 54. Phân loại lỗi Auth và điều kiện retry cho Invite Saga (20/11/2026)

Đã lập policy proposal tại Member design §39 và Foundation review §42:
- `definitive_no_side_effect`: chỉ khi chứng minh request chưa dispatch hoặc endpoint-specific contract xác nhận lỗi xảy ra trước mọi side effect.
- `outcome_unknown`: timeout, mất kết nối, crash, response không đầy đủ, 5xx hoặc mọi lỗi sau dispatch chưa rõ side effect; không retry Auth, phải reconciliation.
- `needs_review/conflict`: duplicate/existing account, Auth ID mismatch, evidence mâu thuẫn hoặc chưa chứng minh ownership; không tự gắn/xóa Auth user.
- Không suy luận từ HTTP status; 4xx/429 không mặc nhiên an toàn để retry. Ban đầu để trống allowlist provider rejection, chỉ local preflight chứng minh chưa dispatch mới definitive.
- Retry chỉ khi có evidence allowlist, request cũ không còn khả năng chạy, operation còn hợp lệ và quyền/policy cho phép.

Đây là proposal, chưa được người dùng chốt. Chưa sửa DDL 021, chưa tạo RPC/worker, không chạy SQL hoặc thay đổi Supabase.


## 55. Chốt fail-closed retry policy cho Invite Saga (20/11/2026)

Người dùng đồng ý chốt: giai đoạn đầu để trống allowlist provider error codes được phép retry. Chỉ local preflight có bằng chứng chắc chắn request chưa dispatch mới được coi là `definitive_no_side_effect`. Mọi lỗi sau dispatch hoặc không rõ dispatch state mặc định `outcome_unknown`, phải reconciliation và không gọi Auth lại. Chỉ mở allowlist sau khi review contract đúng endpoint/provider/version và có test evidence chứng minh no-side-effect. HTTP status, duplicate email, Retry-After, timeout và lease expiry không phải bằng chứng no-side-effect.

Đã chốt policy; chưa sửa DDL 021, chưa tạo RPC/worker, không chạy SQL hoặc thay đổi Supabase.


## 56. Proposal bằng chứng reconciliation cho Invite Saga (20/11/2026)

Đề xuất tại Member design §41 và Foundation review §44:
- Email match, thời gian tạo gần nhau, tên/điện thoại, user_metadata hoặc một lần search rỗng không chứng minh Auth user được tạo bởi operation.
- Khảo sát opaque random marker server-generated, lưu digest trong attempt trước dispatch và gắn nguyên tử trong server-managed metadata ở cùng lệnh Auth create. Chỉ áp dụng nếu xác minh đúng endpoint/SDK version hỗ trợ; tài liệu hiện tra cứu chưa đủ xác nhận `app_metadata` create-time.
- Reconciliation phải kiểm tra marker khớp chính xác operation+attempt+project. Không có candidate chưa đủ kết luận no-side-effect. Mismatch/nhiều candidate => needs_review/conflict.
- Nếu không hỗ trợ atomic create-time correlation, giữ needs_review/manual recovery; không chữa bằng update metadata sau create vì vẫn có crash window.

Đây là proposal chưa chốt. Chưa sửa DDL 021, chưa tạo RPC/worker, không chạy SQL hoặc thay đổi Supabase.


## 57. Kết quả kiểm chứng Supabase Auth create-time marker (20/11/2026)

Đã xác minh source hiện hành:
- `admin.createUser`: SDK `AdminUserAttributes` có `app_metadata`; GoTrue `adminUserCreate` ghi AppMetaData trong cùng DB transaction tạo Auth user. Có cơ sở source-level cho marker nguyên tử trong createUser, nhưng cần pin version thực tế.
- `admin.inviteUserByEmail`: SDK chỉ gửi `{email,data}` tới `/invite`; GoTrue InviteParams chỉ nhận Email/Data, Data là user_metadata. Native invite endpoint không có create-time app_metadata marker. Không dùng user_metadata làm bằng chứng.
- `generateLink(type:'invite')` chưa xác minh có hỗ trợ app_metadata.

Kết luận: không được áp dụng createUser marker cho Invite Saga native invite flow. Cần nghiên cứu hook/correlation server-trusted hoặc giữ outcome_unknown/needs_review/manual review; thay đổi quy trình provisioning cần được duyệt riêng. Nguồn: supabase/auth-js `GoTrueAdminApi.ts`, `lib/types.ts`; supabase/auth `internal/api/admin.go`, `internal/api/invite.go` trên master. Chưa pin version dự án, chưa sửa DDL/RPC/worker, không chạy SQL/Supabase.


## 58. Proposal Before User Created Hook correlation receipt cho Invite Saga (20/11/2026)

Nghiên cứu source/docs hiện hành cho thấy native invite route gọi Before User Created Hook chỉ khi Auth user chưa tồn tại; user UUID được Auth sinh server-side trước hook. Proposal Member design §43:
- Edge Function tạo token ngẫu nhiên >=256-bit cho operation+attempt, lưu digest trước Auth dispatch, truyền token qua reserved `user_metadata` key như transport. Metadata không được tin và không dùng authorization.
- HTTP hook verify Standard Webhooks signature, xác minh token digest + attempt state + project + email fingerprint; ghi durable append-only receipt qua internal server-only RPC gồm webhook ID/request UUID, operation/attempt và Auth-generated user ID; chỉ allow sau khi receipt commit.
- Reconciliation cần cả receipt lẫn Auth Admin lookup xác nhận user tồn tại bằng đúng ID. Receipt đơn lẻ là pre-create observation, không chứng minh Auth transaction đã commit. Orphan receipt => unresolved, không attach.
- Existing unconfirmed Auth user đi nhánh existing nên hook không chạy; vẫn cần independent verification hoặc needs_review.
- External hook receipt và Auth insert không cùng transaction; phải test replay/timeout/rollback/consistency, pin Auth/SDK version và xác minh hook plan/availability.

Proposal chưa duyệt. Chưa sửa DDL 021, chưa tạo RPC/Edge Function, không chạy SQL/Supabase.


## 59. Kiểm chứng Before User Created Hook với native Invite Saga (20/11/2026)

Đã kiểm tra source Supabase Auth hiện hành: endpoint `/invite` khi user chưa tồn tại (`isCreate == true`) tạo user model từ `SignupParams` có `Data: params.Data`, gọi `triggerBeforeUserCreated` trước transaction insert Auth user. `Data` được đưa vào `user_metadata`; Hook nhận user object gồm `user_metadata` và UUID do Auth sinh trước Hook. Như vậy native `inviteUserByEmail({ data })` có thể mang reserved correlation token tới Before User Created Hook trong nhánh tạo user mới.

Proposal: Edge Function tạo token ngẫu nhiên >=256-bit cho đúng operation+attempt, lưu digest/key version trước dispatch; token chỉ là transport trong reserved `user_metadata` key. HTTP Hook verify Standard Webhooks signature, xác minh digest/state/project/email fingerprint, ghi durable append-only receipt qua internal server-only RPC với Auth-generated user ID, rồi mới allow. Reconciliation bắt buộc xác nhận Auth user tồn tại bằng exact ID. Receipt có nhưng Auth user không tồn tại là orphan pre-create observation, không được attach/finalize. Không dùng user_metadata đọc lại sau này làm provenance/authorization; không log raw token. Existing account (`isCreate == false`) không chạy Hook, nên chưa giải quyết ownership của preexisting/unconfirmed user.

Kết quả: source-level supports feasibility cho native invite nhánh tạo mới, nhưng chưa phải triển khai. Cần pin Auth/GoTrue + SDK version, xác minh Hook plan/configuration và test end-to-end crash, timeout, replay, rollback, orphan receipt, exact-ID lookup consistency. Proposal chưa được duyệt; không thay đổi DDL 021, RPC, Edge Function, không chạy SQL hoặc thay đổi Supabase.

Nguồn kiểm tra: Supabase Auth `internal/api/invite.go`, `internal/api/signup.go`; Supabase Docs Before User Created Hook và Auth Users.


## 60. Phát hiện After User Created Hook — receipt sau Auth commit

Đã kiểm tra source Supabase Auth tại commit `10ef10789d1ee4fb422b448047e67e3e264c0482`:
- Trong `Invite()`, Auth chạy transaction tạo user/identity/audit/invite; sau khi transaction thành công mới gọi `triggerAfterUserCreated`. Hook kiểm tra không còn transaction trước khi invoke. Vì vậy After User Created Hook là điểm tiềm năng ghi correlation receipt sau Auth user commit, tốt hơn Before Hook (chạy trước insert và có thể tạo orphan receipt).
- Source hiện gọi After Hook sau transaction trên đường Invite mà không gate theo `isCreate`; handler bắt buộc xác minh reserved correlation token + attempt, event không có marker/không khớp không được tạo receipt.
- Hook metadata UUID được tạo mới mỗi invocation, không được coi là idempotency key ổn định. Idempotency dựa trên attempt_id + Auth user ID; cùng cặp replay idempotent, cùng attempt với ID khác => conflict.
- Hook/receipt có thể lỗi sau khi Auth đã commit; `/invite` có thể trả lỗi dù user tồn tại. Saga giữ `outcome_unknown`, tuyệt đối không gọi Auth lại. Chỉ receipt hợp lệ đã commit mới xác lập provenance; thiếu receipt thì manual review.
- Correlation token trong user_metadata chỉ là transport, không dùng giá trị metadata đọc lại để phân quyền/provenance. Digest được lưu trước dispatch; Hook xác minh signed payload + digest + project + attempt state + email fingerprint; ghi receipt qua server-only RPC; không log raw token.

Kết luận: ưu tiên After User Created Hook làm receipt point; Before Hook không phải bằng chứng commit. Đây mới là source-level feasibility; chưa xác minh hook availability trên Supabase Cloud/plan, retry/delivery semantics hoặc version thực tế. Cần pin Auth/SDK, test post-commit hook failure, replay, timeout, exact-ID lookup. Chưa duyệt implementation; không sửa DDL/RPC/Edge Function, không chạy SQL/Supabase.


## 61. Giới hạn Supabase Cloud Hooks và retry/timeout

Đối chiếu tài liệu Supabase Auth Hooks ngày 20/11/2026:
- Danh sách hook hosted theo plan hiện công bố Before User Created, Custom Access Token, Send SMS, Send Email, MFA Verification và Password Verification. Không liệt kê After User Created. Source GoTrue có implementation After Hook không chứng minh hosted project có thể cấu hình hook này. Không phụ thuộc After Hook cho production BAOTRI Mini nếu chưa có xác nhận chính thức từ Supabase.
- Before User Created có tài liệu hỗ trợ Free/Pro nhưng chạy trước Auth insert, không chứng minh user đã commit.
- HTTP Hook xác minh Standard Webhooks trên raw body với `webhook-id`, `webhook-timestamp`, `webhook-signature`; secret `v1,whsec_...` giữ trong secret store.
- Tài liệu nêu 429/503 + `retry-after` không rỗng được retry tối đa 3 lần, backoff 2 giây, tổng time budget 5 giây. `Retry-After` không thực hiện đầy đủ RFC. Timeout/retry yêu cầu handler idempotent theo attempt_id + Auth user ID, unique constraint, chống replay và commit receipt trước success.
- Kết luận tạm thời: After Hook chưa xác nhận hosted availability; Before Hook không phải proof-of-commit. Tiếp tục fail-closed/manual review cho đến khi có post-commit correlation channel được Supabase Cloud hỗ trợ chính thức hoặc provisioning flow khác được duyệt.

Chưa sửa DDL/RPC/Edge Function, không chạy SQL, không thay đổi Supabase.


## 62. Nghiên cứu provisioning Auth thay After User Created Hook

Ngày 20/11/2026 — rà soát Supabase JS Auth Admin API:

- `admin.createUser(attributes)` là server-only, nhận `app_metadata` ngay trong attributes tạo user; không gửi email xác nhận. Nếu không set `email_confirm:true`, email chưa được xác nhận. BAOTRI tuyệt đối không auto-confirm chỉ để lách luồng mời.
- `inviteUserByEmail(email, options)` gửi invite, nhưng `options.data` là `user_metadata`, không phải app_metadata.
- `generateLink({type:'invite'})` tự xử lý tạo user và link; `data` vẫn là user_metadata, không có trusted app_metadata ở thời điểm tạo.
- `admin.listUsers()` chỉ phân trang page/perPage, không hỗ trợ filter email/app_metadata; `getUserById()` cần biết UUID.

Hướng ứng viên (chưa duyệt/chưa triển khai): Edge Function tạo marker ngẫu nhiên riêng cho attempt, lưu digest/key version trước khi dispatch; gọi `admin.createUser({email,email_confirm:false,app_metadata:{marker}})`; nếu response mất thì chỉ reconcile bằng exact marker qua truy vấn server-side hẹp tới `auth.users`, email chỉ là locator. Truy vấn này cần thiết kế RPC server-only riêng, least privilege, không expose anon/authenticated. `listUsers()` scan toàn bộ không phải phương án reconciliation thường xuyên. Nếu không thấy marker ngay sau timeout, chưa chứng minh không có side effect/request còn chạy; giữ outcome_unknown, không gọi createUser lại.

Blocking gap: createUser không gửi invite email; generateLink invite sẽ tự tạo user và không nhận trusted app_metadata. Chưa chứng minh recovery/setup link hoạt động an toàn với user chưa xác nhận hoặc custom email flow. Không auto-confirm. Do đó chưa phải giải pháp thay thế hoàn chỉnh cho inviteUserByEmail. Giữ native invite hiện tại và fail-closed/manual review đến khi test onboarding, reconciliation, security, timeout/crash với phiên bản Auth/SDK pin cụ thể.

Chưa sửa DDL/RPC/Edge Function, không chạy SQL, không thay đổi Supabase.


## 63. Kiểm chứng link recovery cho user chưa xác nhận — chưa đủ bằng chứng

Ngày 20/11/2026:
- Supabase có `admin.generateLink({type:'recovery', email})`; đây là chức năng tạo link/OTP recovery để ứng dụng tự gửi email, không tự gửi email.
- Tài liệu không cam kết recovery link hoạt động với user do `admin.createUser({email_confirm:false})` trước khi xác nhận email, cũng không cam kết verify recovery sẽ xác nhận email. Không được mặc định recovery là invite/activation.
- Tài liệu Users nói user có email chưa xác minh mặc định không thể sign in. Invite flow được mô tả rõ là xác nhận email và cho phép người nhận hoàn tất thiết lập (ví dụ đặt password). Không suy rộng hành vi này sang recovery/magiclink.
- `generateLink({type:'invite'})` tự tạo user, không phải bước thiết lập password generic sau createUser và không có tham số trusted app_metadata tại thời điểm tạo.

Kết luận: onboarding gap của hướng createUser + app_metadata marker vẫn chưa được giải quyết. Trước khi chọn, cần test cô lập trên phiên bản Auth/SDK pin của BAOTRI: tạo recovery link cho user chưa xác nhận, kết quả verify và email_confirmed_at, đặt password, expiry/replay, custom email delivery, và liên kết an toàn với Saga attempt. Chưa triển khai. Giữ native inviteUserByEmail + fail-closed/manual review.

Không sửa DDL/RPC/Edge Function, không chạy SQL, không thay đổi Supabase.


## 64. Quy trình tài khoản Auth đã tồn tại: người nhận tự đăng nhập và chấp nhận lời mời (proposal, 20/11/2026)

**Nguyên tắc:** email trùng, kể cả email đã xác minh, không cho phép Admin/người mời tự gắn Auth UUID vào membership. Người sở hữu tài khoản phải đăng nhập đúng tài khoản đó và chủ động chấp nhận lời mời.

### Luồng đề xuất

1. Admin có quyền tạo invitation intent bất biến: organization, email fingerprint đã chuẩn hóa, role, original actor, expiry và request fingerprint. Không gọi Auth provisioning (inviteUserByEmail, createUser) và chưa tạo membership/role.
2. Giữ lời mời ở trạng thái chờ. Đề xuất state mới awaiting_existing_account_acceptance nhưng đây mới là proposal, chưa được thêm vào DDL 021.
3. Người nhận đăng nhập vào tài khoản Auth hiện có. RPC giới hạn chỉ trả lời mời đang chờ khớp với email xác minh hiện tại của chính Auth user; danh tính lấy từ auth.uid() và dữ liệu Auth authoritative phía server, không nhận UID/email do client tự khai.
4. Người nhận bấm chấp nhận. Transaction cuối phải kiểm tra lại: auth.uid(); Auth email có email_confirmed_at IS NOT NULL; email chuẩn hóa khớp fingerprint; lời mời còn pending/chưa hết hạn/chưa bị revoke; organization active; role hợp lệ; quyền của inviter hoặc cơ chế Admin reapproval; không có membership xung đột.
5. Chỉ sau đó mới atomic commit membership + một role assignment + audit + Shared Receipt + Saga completion. Ghi nhận Auth UID của người chấp nhận. Trước thời điểm này không có membership, role hay tenant access.

### Các nhánh cần xử lý

- Existing account + verified email: chỉ đủ điều kiện sau khi chính tài khoản đó đăng nhập và explicit accept. preexisting_verified chỉ được ghi sau khi server xác minh UID + verified email và commit acceptance; email match đơn thuần không đủ.
- Existing account + unverified email: chưa được accept; không auto-confirm, không reset password và không mặc định inviteUserByEmail gửi được email kích hoạt. Người dùng phải hoàn tất luồng xác minh Auth bình thường trước.
- Email thay đổi, nhiều candidate, dữ liệu không nhất quán hoặc không xác minh được: needs_review hoặc yêu cầu lời mời mới; không tự gắn, không tự xóa Auth user.
- Không có Auth account: tiếp tục nhánh provisioning user mới với policy provenance/timeout đã chốt.

Pending-invite discovery phải tối thiểu dữ liệu, không lộ roster/Auth UUID/phone/token hoặc sự tồn tại tùy ý của email. RPC acceptance phải recheck mọi điều kiện trong transaction; danh sách lời mời trước đó chỉ là snapshot, không phải authorization. Accept lặp cùng operation/actor phải idempotent; cạnh tranh hoặc mismatch bị reject không có partial write.

### Các điểm còn mở

Cách thông báo lời mời cho tài khoản có sẵn (in-app hay email riêng); expiry/resend; decline/revoke; email thay đổi; nhiều lời mời; quyền inviter còn hiệu lực hay Admin khác reapprove; rate limit/audit retention; response shape và chống enumeration. Cần xác minh API/Auth version pin trước khi chọn delivery mechanism.

**Trạng thái:** proposal để review, chưa phải quyết định schema đã duyệt. Chưa thêm state vào DDL 021, chưa tạo RPC/Edge Function, không chạy SQL, không thay đổi Supabase. Hiện tại vẫn giữ native inviteUserByEmail + fail-closed/manual review.


## 65. Kênh thông báo lời mời cho tài khoản Auth có sẵn: in-app trước, email phụ (proposal, 20/11/2026)

### Khuyến nghị

**In-app inbox là kênh chính thức và có thẩm quyền. Email chỉ là thông báo phụ tùy chọn.** Không kênh nào tự chứng minh danh tính, quyền sở hữu tài khoản, email đã xác minh hay việc chấp nhận lời mời. Chỉ phiên đăng nhập đúng Auth user và transaction acceptance ở §64 mới có quyền tạo membership.

### 1. In-app inbox

- Sau đăng nhập, client gọi RPC authenticated hẹp để lấy lời mời chờ của chính Auth UID hiện tại, server tự đối chiếu email xác minh authoritative. Danh tính lấy từ auth.uid(), không nhận UID/email do client truyền.
- Chỉ trả các trường hiển thị tối thiểu: invitation ID opaque, tên tổ chức, nhãn role nếu được phép hiển thị, người mời nếu an toàn, thời điểm tạo/hết hạn, trạng thái pending. Không trả email đích, Auth UUID, fingerprint, receipt ID, token, secret hoặc chi tiết Saga/attempt.
- Đọc inbox không reserve/accept lời mời, không kích hoạt membership, không cấp tenant access. Nút Accept gọi RPC riêng và transaction phải kiểm tra lại toàn bộ điều kiện §64.
- Refresh khi login, mở ứng dụng, mở inbox. Realtime nếu dùng chỉ là tín hiệu báo có thay đổi; client phải fetch lại qua RPC có quyền. Không broadcast nội dung lời mời. Không phụ thuộc websocket; app-open/on-demand refresh vẫn phải hoạt động.

### 2. Email thông báo phụ

- Chỉ gửi email thông báo chung rằng có lời mời đang chờ, kèm link về trang đăng nhập/inbox bình thường của ứng dụng.
- Không nhúng bearer token chấp nhận, Auth confirmation/recovery token, Auth UUID hoặc secret. Mở link không đồng nghĩa chấp nhận; người nhận phải đăng nhập bình thường, xem inbox và bấm Accept.
- Không dùng Auth invite/recovery API để thông báo cho tài khoản có sẵn. Đây là business notification, không phải Auth activation/verification.
- Dùng transactional email provider riêng qua trusted server-side sender (SMTP riêng hoặc provider API được review). Supabase custom SMTP liên quan Auth mail; Send Email Auth Hook thay thế việc gửi Auth email, không nên biến thành hàng đợi thông báo nghiệp vụ BAOTRI. Secret chỉ ở server; cấu hình SPF/DKIM/DMARC; tắt tracking nếu có thể.
- Không để Admin/API trả lời rằng email đích có hay không có tài khoản Auth. Chỉ xác nhận invitation intent đã được ghi nhận.

### 3. Outbox, retry và dữ liệu cá nhân

- Nếu bật email, tạo outbox job tối thiểu cùng transaction với invitation intent; chỉ gửi sau commit. Idempotency theo notification_id; retry/backoff có giới hạn; rate limit; audit; không log email thô hoặc raw provider response.
- Fingerprint không phải địa chỉ gửi được. Nếu cần gửi, phải thiết kế nơi lưu recipient email có mã hóa, quyền truy cập hẹp, quản lý khóa và retention; không để email thô trong queue/log phổ thông.
- Provider chấp nhận gửi không chứng minh email vào inbox; email delivery không làm thay đổi membership/provenance/acceptance.
- Hiện tại quy định manual recovery, chưa có background worker. Vì vậy chưa triển khai email cho đến khi duyệt provider, outbox, worker, secret, PII retention và monitoring.

**Thứ tự triển khai được khuyến nghị:** (1) in-app inbox + explicit accept; (2) email thông báo phụ sau khi outbox/sender được duyệt; (3) Realtime chỉ tối ưu trải nghiệm, không phải dependency.

**Trạng thái:** proposal thiết kế, không phải phê duyệt triển khai. Không sửa DDL 021, không tạo RPC/Edge Function/worker, không chạy SQL và không thay đổi Supabase.


## 66. Thiết kế In-app Invitation Inbox: dữ liệu và quyền truy cập

### Quyết định đề xuất
- Chưa tạo bảng Inbox riêng. `organization_member_invite_operations` là nguồn trạng thái gốc; Inbox chỉ là projection qua API/RPC hẹp.
- Attempts và attempt events giữ nội bộ server; client không SELECT trực tiếp Saga hoặc các bảng lịch sử này.
- Inbox chỉ hiển thị lời mời đang chờ người nhận với trạng thái dẫn xuất `pending`; không lộ các trạng thái Saga nội bộ như `auth_outcome_unknown`, `needs_review`, `failed_terminal`.

### Dữ liệu được phép trả
Chỉ gồm: `invitation_id` (opaque operation UUID, không phải token), tên tổ chức, nhãn vai trò an toàn, thời điểm tạo/hết hạn và trạng thái `pending`. Ban đầu không trả tên người mời. Tuyệt đối không trả email đích, Auth UUID, member ID, fingerprint/digest/key version, invite URL/token, receipt ID, attempt ID/events, provider response hoặc dữ liệu recovery riêng tư.

### Quyền truy cập
- anon/chưa đăng nhập: không được xem/chấp nhận.
- Authenticated nhưng email chưa xác minh: không được xem/chấp nhận.
- Tài khoản đăng nhập có email Auth authoritative đã xác minh: chỉ thấy lời mời khớp với email xác minh hiện tại của chính tài khoản.
- Admin/người mời không có quyền xem Inbox của người nhận chỉ vì đã tạo lời mời.
- Không có endpoint dò theo email tùy ý; không SELECT trực tiếp bảng Saga/attempt từ client.
- Không dùng user_metadata hoặc email/UID client gửi làm căn cứ phân quyền.

### Luồng
- List Inbox chỉ là snapshot; không reserve lời mời, không tạo membership, không cấp tenant access.
- Accept revalidate trong transaction: actor, email xác minh, lời mời pending/chưa hết hạn/chưa revoke, organization active, role hợp lệ, không membership conflict.
- Membership + single role + audit + Shared Receipt + Saga completion commit nguyên tử.
- Client chỉ gửi invitation ID và mutation/idempotency key ổn định; không gửi actor UID, email, organization ID hoặc role làm căn cứ.
- Replay cùng invitation và cùng actor phải idempotent; actor khác bị từ chối. Cần khớp contract receipt với Shared Receipt design.
- Dùng keyset pagination, giới hạn page size; không OFFSET/COUNT. Realtime chỉ là wake-up hint, không phải dependency.

### Điểm chặn HMAC
Saga lưu HMAC digest nhưng key material nằm ngoài Database. PostgreSQL không thể tự đối chiếu digest nếu không có cơ chế cấp key đáng tin cậy. Phương án cần nghiên cứu là Edge Function xác thực bearer với Auth, lấy user/email xác minh authoritative, tính HMAC bằng secret manager và gọi RPC nội bộ server-only. RPC thực hiện acceptance transaction; Edge Function là trust boundary cần threat-model review riêng. Không thay bằng email client gửi hoặc email matching không xác minh.

**Trạng thái:** design proposal, chưa phê duyệt DDL/RPC/Edge Function/worker; chưa chạy SQL và chưa thay đổi Supabase. Trước implementation cần chốt HMAC trust boundary, acceptance idempotency/receipt, expiry/revoke/decline, rate limit và audit retention.


## 67. Invitation Inbox — RPC contract and recipient digest refinement

Không được dùng `request_fingerprint_digest` để tìm Inbox vì nó là digest của toàn bộ canonical invitation request, không phải email recipient độc lập. Cần digest người nhận riêng (candidate: `recipient_email_digest`) kèm key version và normalization version; HMAC-SHA-256, key/purpose tách biệt với request fingerprint, key chỉ ở secret manager. Chuẩn hóa email phải có contract/version duy nhất; không tự gộp alias dấu chấm hoặc plus-addressing theo provider. Digest không thể dùng để gửi email.

Client chỉ gọi Edge Function bằng access token, không gửi UID/email. Edge Function xác thực bearer với Auth server-side, lấy UID/email/email-confirmed authoritative, chuẩn hóa và tính digest. Sau đó gọi RPC private/internal bằng server credential. RPC không expose qua Data API; revoke EXECUTE khỏi PUBLIC/anon/authenticated và chỉ grant cho server role cần thiết. Không đặt SECURITY DEFINER trong exposed schema. RPC cần kiểm tra actor và xác minh email hiện tại trong auth.users vẫn khớp dữ liệu Edge Function vừa xác minh; cần kiểm chứng khả năng lock auth.users row để ngăn race đổi email trước khi triển khai.

Contract dự kiến:
- List: `list_pending_invitations(cursor?, limit?)`, không nhận UID/email/org/role. Chỉ trả allowlist đã chốt: invitation ID, tên tổ chức, nhãn role an toàn, created/expiry và display_status=pending.
- Lọc lời mời còn hạn, chưa revoke/cancel, trạng thái được phép hiển thị, organization active, role hợp lệ và recipient digest khớp.
- Keyset pagination theo `(created_at, operation_id)`; mặc định 20, tối đa 50; không OFFSET/COUNT. Cursor chỉ là continuation marker, không phải credential; validate và bind server-side với actor/digest.
- Accept: `accept_invitation(invitation_id, mutation_id)`. Edge Function xác thực lại bearer và digest ở mỗi request. Transaction revalidate actor/email verification, recipient, pending/expiry/revoke, organization, role và membership conflict; membership + single role + audit + Shared Receipt + Saga completion commit nguyên tử.
- Idempotency gắn invitation + authenticated actor + mutation ID + payload. Same key/different payload là conflict; replay trả receipt gốc; actor khác không nhận receipt hoặc membership.

Open blockers: digest schema/normalization/key rotation; khả năng truy vấn/lock auth.users trong transaction hosted; state chuyển sang Inbox pending; expiry/revoke/decline; inviter authority; rate limit/audit retention; Shared Receipt key. Đây vẫn là proposal; không tạo DDL/RPC/Edge Function, không chạy SQL và không thay đổi Supabase.


## 68. Kiểm chứng row lock auth.users trên Supabase Hosted (read-only)

Đã kiểm tra catalog trên `BAOTRI-Mini-Test` (PostgreSQL 17.12), không ghi dữ liệu:
- `auth.users` owner `supabase_auth_admin`, RLS bật, FORCE RLS tắt, không có policy tường minh.
- `postgres` không phải superuser nhưng có BYPASSRLS, USAGE schema auth, SELECT + UPDATE trên `auth.users`.
- `supabase_auth_admin` có SELECT + UPDATE; `service_role`, `authenticated`, `anon` không có SELECT/UPDATE.
- `SELECT id FROM auth.users WHERE false FOR UPDATE` chạy thành công dưới postgres. Điều này kiểm tra quyền SQL, không khóa user row thật và không phải kiểm thử concurrency.

PostgreSQL xác nhận `FOR UPDATE` giữ row lock đến hết transaction và chặn writer/locker xung đột. GoTrue source hiện tại cho thấy `ConfirmEmailChange` cập nhật cột `auth.users.email` trong transaction. Vì vậy có cơ sở cho phương án khóa đúng Auth user row trong acceptance transaction để tuần tự hóa với email change đã xác nhận. Phải kiểm tra version GoTrue thực tế của Hosted project trước khi dựa vào source hiện tại.

Luồng candidate:
1. Edge Function xác thực bearer với Auth server-side; lấy UID, email hiện tại chính xác và trạng thái xác minh; tính recipient HMAC bằng secret manager. Client không gửi các giá trị này.
2. Function nội bộ hẹp, owner postgres, SECURITY DEFINER, fixed empty search_path, fully qualified names; khóa `auth.users` theo UID bằng `FOR UPDATE`.
3. Khi đã khóa, so sánh email DB với email server vừa xác minh và yêu cầu `email_confirmed_at` không null. Sau đó khóa invitation Saga row, kiểm tra recipient digest, trạng thái, expiry/revoke, organization, role và membership conflict.
4. Lock order cố định: Auth user → invitation/Saga → membership/role/audit/receipt. Transaction ngắn, tuyệt đối không gọi HTTP/Auth/email/provider trong lúc giữ lock.
5. Nếu email change commit trước, acceptance thấy email mới và digest cũ không khớp. Nếu acceptance lấy lock trước, email change phải đợi đến khi acceptance commit. Lỗi lock/serialization/transaction phải rollback toàn bộ; retry dùng mutation ID cũ.

Không cấp trực tiếp SELECT/UPDATE trên `auth.users` cho service_role/authenticated/client. Server role chỉ được EXECUTE function hẹp. Private schema không gọi được qua PostgREST nếu chưa expose; cần chốt direct trusted Postgres connection từ Edge Function hoặc server-only RPC wrapper có EXECUTE bị revoke khỏi PUBLIC/anon/authenticated và chỉ grant server role. Tuyệt đối không expose `auth.users` qua Data API.

**Còn mở:** preflight read-only trên từng Production tenant project; xác minh GoTrue version; kiểm thử thực tế concurrent email-confirm-vs-accept, admin email update, lock timeout và rollback. Test hiện tại dùng WHERE false, chưa kiểm thử tranh chấp row lock thật.

**Kết luận:** khả thi về quyền trên BAOTRI-Mini-Test, là candidate thiết kế chứ chưa phải phê duyệt triển khai. Không tạo DDL/RPC/Edge Function, không chạy SQL ghi, không grant quyền, không migration và không thay đổi Supabase.
