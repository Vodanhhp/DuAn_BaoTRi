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

### 2.4 Danh mục nhóm thiết bị và an toàn khi xóa dữ liệu
- Danh mục nhóm thiết bị phải cho phép người dùng **thêm nhóm mới, sửa tên/thông tin nhóm**; không giới hạn cứng vào một danh sách cố định vì mỗi nhà máy/doanh nghiệp có chủng loại thiết bị khác nhau.
- Khi sửa hoặc quản lý nhóm, phải giữ liên kết của thiết bị đang thuộc nhóm đó; không làm mất hoặc gán sai nhóm của thiết bị.
- Nếu muốn xóa một nhóm đang có thiết bị sử dụng, phải cảnh báo và yêu cầu xử lý thiết bị liên quan (chuyển sang nhóm khác hoặc phương án phù hợp); không xóa âm thầm.
- **Mọi thao tác xóa ở tất cả phân hệ** (thiết bị, nhóm, vật tư, phiếu, công việc, nhật ký và các dữ liệu khác) đều phải có hộp thoại xác nhận riêng trước khi thực hiện.
- Dùng tên khu vực **Lưu kho** thay cho “Thùng rác”. Đây là nơi chứa các hồ sơ được đưa ra khỏi danh sách đang hoạt động nhưng vẫn được giữ lại để tra cứu và có thể khôi phục.
- Thao tác **Lưu kho** không đồng nghĩa với thanh lý hoặc xóa dữ liệu. Khi đưa hồ sơ vào Lưu kho, cần giữ nguyên thông tin thiết bị và toàn bộ lịch sử bảo trì/sửa chữa liên quan.
- Phân biệt rõ trạng thái nghiệp vụ: **Ngừng hoạt động** (tạm thời không sử dụng, có thể đưa vào hoạt động lại), **Thanh lý** (đã loại khỏi sử dụng nhưng giữ hồ sơ/lịch sử), và **Lưu kho** (ẩn khỏi danh sách đang hoạt động, có thể khôi phục).
- Chỉ cho phép xóa vĩnh viễn khi người dùng chủ động chọn và xác nhận rõ ràng; cần cân nhắc quan hệ dữ liệu và lịch sử bảo trì, không để xóa một hồ sơ làm mất lịch sử liên quan.
- Thiết kế thao tác an toàn, dễ hiểu trên cả máy tính và điện thoại; tránh dùng `window.confirm()`/`prompt()` làm trải nghiệm cuối cùng nếu có thể thay bằng hộp thoại giao diện thống nhất.

### 2.5 Chi phí
- Ưu tiên gói miễn phí cho giai đoạn cá nhân; chưa mua hosting hoặc dịch vụ trả phí.
- Hướng đi dự kiến: GitHub để quản lý mã nguồn và GitHub Pages để host giao diện; Supabase để đánh giá database/backend. Đây là định hướng, chưa phải cấu hình đã triển khai.
- Trước khi chọn dịch vụ, cần kiểm tra giới hạn miễn phí hiện hành, dung lượng, băng thông, backup, thời gian ngừng do không hoạt động, bảo mật và điều kiện nâng cấp.
- Khi có khách hàng hoặc nhu cầu thương mại, đánh giá lại hosting, database, lưu trữ ảnh, bảo mật, backup, phân quyền và chi phí vận hành.

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

### Bước 3 – Kiểm tra các phân hệ\n- Đã chuẩn bị 30 thiết bị mẫu thuộc nhiều nhóm cơ điện, điện lạnh, điện, PCCC và thiết bị xưởng. Tất cả hồ sơ mới có ghi chú dữ liệu mẫu; cần đồng bộ và xác nhận trên trình duyệt trước khi coi là hoàn tất.
- Kiểm tra từng thao tác: thêm/sửa/xóa hoặc ngừng sử dụng, nhập/xuất kho, tạo công việc, lưu nhật ký.
- Kiểm thử riêng việc thêm/sửa nhóm thiết bị, xác nhận trước khi xóa và hoàn tác/khôi phục sau khi xóa ở từng phân hệ.
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
- Khi người dùng bổ sung yêu cầu trong lúc thảo luận, cập nhật tệp tiến độ trên GitHub để lưu lại; không tự ý triển khai chức năng nếu chưa đến đợt sửa đã thống nhất.
- Chỉ đánh dấu hoàn thành khi đã chạy thử và kiểm tra; code tồn tại không đồng nghĩa chức năng đã hoàn tất.
- Nếu thay đổi cấu trúc database, ghi rõ migration và ảnh hưởng dữ liệu cũ.
- Trước khi sửa, kiểm tra phiên bản mới nhất trên GitHub; tránh ghi đè thay đổi mới của người dùng.
- Không đưa mật khẩu, service-role key, token hoặc bí mật vào repository công khai.
- Khi kết thúc mỗi phiên làm việc, cập nhật mục 3 và 5 trong tài liệu này.

### Tab Thiết bị – sắp xếp và lọc danh sách
- Bổ sung một nút chọn dạng xổ xuống (có biểu tượng mũi tên xuống) để thao tác gọn trên cả desktop và mobile.
- Các tiêu chí cần hỗ trợ:
  - Sắp xếp theo thứ tự thiết bị.
  - Lọc theo nhóm thiết bị.
  - Lọc theo vị trí lắp đặt.
  - Sắp xếp theo ngày (mới nhất/cũ nhất).
  - Lọc theo trạng thái thiết bị.
- Thiết kế phân biệt rõ tiêu chí sắp xếp (thứ tự, ngày) và tiêu chí lọc (nhóm, vị trí, trạng thái), dù có thể gom trong cùng một khu vực xổ xuống.
- Có lựa chọn bỏ lọc/đặt lại để trở về danh sách đầy đủ.
- Đây là yêu cầu ghi nhận cho đợt triển khai sau; chưa sửa mã nguồn ở thời điểm cập nhật.

### Tab Thiết bị – lọc, sắp xếp và xem chi tiết
- Khu vực xổ xuống hỗ trợ đồng thời cả lọc và sắp xếp, không chỉ một trong hai:
  - Có thể kết hợp nhiều điều kiện lọc: nhóm thiết bị, vị trí lắp đặt, trạng thái.
  - Có thể chọn cách sắp xếp: thứ tự thiết bị và ngày (mới nhất/cũ nhất).
  - Có lựa chọn bỏ lọc/đặt lại để trở về danh sách đầy đủ.
- Nhấn trực tiếp vào tên thiết bị trong danh sách sẽ mở bảng chi tiết thiết bị.
- Bảng chi tiết có bố cục/trường thông tin gần giống bảng thêm/sửa thiết bị nhưng ở chế độ xem, không tự động bật chế độ chỉnh sửa.
- Trong bảng chi tiết phải có nút **Xem ảnh** để mở/xem ảnh gắn với hồ sơ thiết bị; hỗ trợ thiết bị có nhiều ảnh nếu cần.
- Ảnh là thành phần quan trọng của hồ sơ đối với các thiết bị cần nhận diện trực quan. Khi thiết kế biểu mẫu và lưu trữ cần tính đến việc đính kèm ảnh cho thiết bị; chưa mặc định bắt buộc mọi thiết bị phải có ảnh nếu chưa có quy định cụ thể.
- Thiết kế bảng chi tiết và thao tác xem ảnh phải thuận tiện trên cả desktop và mobile.
- Đây là yêu cầu ghi nhận cho đợt triển khai sau; chưa sửa mã nguồn ở thời điểm cập nhật.

### Đợt triển khai – danh mục thiết bị, lọc/sắp xếp và ảnh
- Đã cập nhật `src/db.ts`: hồ sơ `Asset` có trường `images: string[]`, cho phép lưu nhiều ảnh trên mỗi thiết bị.
- Đã cập nhật `src/App.tsx`:
  - Thêm bộ lọc kết hợp theo nhóm, vị trí và trạng thái.
  - Thêm sắp xếp theo mã tăng/giảm, tên A–Z, ngày đưa vào sử dụng mới nhất/cũ nhất.
  - Có thao tác đặt lại bộ lọc và hiển thị số thiết bị phù hợp.
  - Nhấn tên thiết bị mở cửa sổ chi tiết ở chế độ xem; có nút xem ảnh và mở ảnh lớn.
  - Biểu mẫu thêm/sửa thiết bị cho phép tải nhiều ảnh (tối đa 8 ảnh/hồ sơ), xem trước và xóa ảnh.
  - Dữ liệu thiết bị cũ được bổ sung `images: []` khi khởi tạo mà không xóa các thông tin hiện có; các hồ sơ demo mới cũng có trường ảnh.
- Đã cập nhật `src/style.css` cho bộ lọc, chi tiết hồ sơ và thư viện ảnh; có bố cục phù hợp mobile.
- **Lưu ý dữ liệu mẫu:** repository hiện không có ảnh thực tế tương ứng từng thiết bị; không gán ảnh minh họa không đúng máy. 30 hồ sơ mẫu có trường ảnh rỗng để người dùng bổ sung ảnh thật.
- **Kiểm thử:** đã kiểm tra lại nội dung các file sau cập nhật trên GitHub; chưa chạy build/test trong môi trường máy người dùng. Cần Pull về máy và chạy `npm.cmd run build` trước khi xác nhận hoàn tất kiểm thử.
- **Việc còn lại trong backlog:** CRUD nhóm thiết bị; xác nhận xóa/hoàn tác theo yêu cầu trước đó chưa nằm trong đợt code này.


### Quy ước thuật ngữ – Lưu kho thiết bị
- Không dùng nhãn hoặc biểu tượng “Thùng rác” cho thao tác đưa thiết bị ra khỏi danh sách đang hoạt động.
- Dùng thuật ngữ **Lưu kho** cho khu vực lưu các hồ sơ không còn hiển thị trong danh sách hoạt động nhưng vẫn được bảo toàn, tra cứu và khôi phục.
- Nút thao tác cạnh nút Sửa trong danh sách thiết bị sẽ mang ý nghĩa **Lưu kho** (không phải Thanh lý và không phải Xóa vĩnh viễn); cần có bước xác nhận trước khi lưu kho.
- Trong khu vực Lưu kho, người dùng có thể xem hồ sơ và chọn khôi phục về danh sách hoạt động. Việc thanh lý/ngừng hoạt động phải được quản lý bằng trạng thái nghiệp vụ riêng, không dùng chung với Lưu kho.
- Quy ước này mới được ghi nhận trong tài liệu yêu cầu; chưa thay đổi giao diện hoặc mã nguồn. Khi triển khai cần rà soát cả các phân hệ khác để dùng thuật ngữ nhất quán.


### Quy định quyền Xóa vĩnh viễn
- BAOTRI vẫn phải có chức năng **Xóa vĩnh viễn** bên cạnh quy trình Lưu kho/khôi phục; đây là thao tác đặc quyền, không dùng thay cho việc ngừng hoạt động, thanh lý hoặc lưu kho.
- Mặc định chỉ **Admin** mới có quyền xóa vĩnh viễn. Nhân viên không được thực hiện thao tác này.
- Trước khi xóa, yêu cầu xác thực lại bằng mật khẩu Admin (hoặc cơ chế xác thực mạnh tương đương khi triển khai đăng nhập thật), sau đó hiển thị xác nhận cuối cùng nêu rõ phạm vi dữ liệu sẽ bị xóa.
- Khi xóa một thiết bị, phải rà soát và xử lý toàn bộ dữ liệu phụ thuộc thuộc riêng thiết bị đó: hồ sơ, ảnh/tệp đính kèm, tài liệu và các bản ghi lịch sử/công việc liên quan theo chính sách dữ liệu đã thống nhất.
- Không xóa mù quáng dữ liệu dùng chung hoặc dữ liệu có liên quan tới đối tượng khác. Ví dụ vật tư, phiếu kho hoặc nhà cung cấp có thể được nhiều thiết bị sử dụng; phải giữ lại hoặc xử lý liên kết phù hợp để không làm hỏng dữ liệu của đối tượng còn tồn tại.
- Cần có bước xem trước phạm vi ảnh hưởng trước khi xác nhận; thao tác xóa vĩnh viễn không có chức năng hoàn tác. Khuyến nghị tạo bản sao lưu trước khi thực hiện.
- Phân quyền và xác thực phải được kiểm tra ở backend/database khi triển khai thật; không chỉ ẩn nút trên giao diện. Không lưu hoặc kiểm tra mật khẩu Admin bằng mã frontend.
- Đây là quyết định yêu cầu/thiết kế; chưa triển khai code hoặc kiểm thử chức năng.


### Đợt triển khai – Lưu kho thiết bị và ảnh dữ liệu mẫu
- Đã cập nhật `src/db.ts`:
  - Bổ sung trường tùy chọn `archivedAt` cho hồ sơ thiết bị.
  - Nâng Dexie database từ version 1 lên version 2, thêm chỉ mục `archivedAt`; dữ liệu hiện có được giữ nguyên khi nâng phiên bản.
- Đã cập nhật `src/App.tsx`:
  - Thay thao tác biểu tượng thùng rác/ngừng hoạt động cạnh nút sửa bằng thao tác **Lưu kho** có bước xác nhận.
  - Tách danh sách thiết bị đang hoạt động và danh sách **Lưu kho**; có số lượng từng danh sách.
  - Thiết bị lưu kho được loại khỏi danh sách hoạt động và thống kê Dashboard, nhưng hồ sơ, ảnh và các bản ghi liên quan chưa bị xóa.
  - Có thao tác **Khôi phục** thiết bị từ Lưu kho về danh sách hoạt động.
  - Hiển thị nút **Xóa vĩnh viễn** ở trạng thái khóa. Chưa cho phép thực hiện trong bản local vì ứng dụng chưa có đăng nhập/xác thực Admin thật; không dùng mật khẩu giả hoặc kiểm tra quyền ở frontend để tạo cảm giác an toàn sai.
  - Khi triển khai backend, chức năng xóa vĩnh viễn phải được xác thực Admin ở máy chủ, yêu cầu xác nhận lại và xử lý quan hệ dữ liệu theo phạm vi ảnh hưởng; dữ liệu dùng chung không được xóa dây chuyền ngoài ý muốn.
- Đã sửa dữ liệu demo thiết bị:
  - Mỗi hồ sơ demo có 2 ảnh minh họa dạng SVG (hai góc nhìn) để căn chỉnh kích thước ảnh thu nhỏ, gallery và ảnh lớn.
  - Các hồ sơ demo cũ chưa có ảnh sẽ được bổ sung tự động khi mở ứng dụng; ảnh người dùng đã tải lên không bị ghi đè.
  - Ghi chú hồ sơ nêu rõ đây là **ảnh minh họa kỹ thuật**, không phải ảnh thực tế của thiết bị.
- Đã cập nhật `src/style.css` cho thông báo giới hạn bảo mật ở khu vực Lưu kho.
- **Giới hạn hiện tại:** các ảnh là hình minh họa vector dùng thử giao diện, chưa phải ảnh chụp thực tế theo đúng model máy. Dữ liệu vẫn lưu cục bộ trong IndexedDB.
- **Kiểm thử:** đã cập nhật mã nguồn trên GitHub; chưa chạy build hoặc kiểm thử trong máy người dùng. Cần Pull origin, chạy `npm.cmd run build`, sau đó mở app kiểm tra danh sách, Lưu kho, Khôi phục và gallery ảnh trước khi xác nhận hoàn tất.


### Sửa lỗi TypeScript sau đợt cập nhật Lưu kho/ảnh demo
- Gắn kiểu `Asset` tường minh cho callback mở thiết bị từ màn hình quét QR để xử lý lỗi TS7006.
- Thêm `@types/react-dom` vào `devDependencies` để TypeScript nhận diện `react-dom/client`.
- Thêm `src/vite-env.d.ts` tham chiếu kiểu Vite và `vite-plugin-pwa/client` để nhận diện module ảo `virtual:pwa-register`.
- Người dùng cần Pull origin và chạy `npm.cmd install` để cập nhật package/lockfile tại máy, sau đó chạy lại `npm.cmd run build`.
- Chưa xác nhận build thành công cho đến khi người dùng chạy và gửi kết quả.


### Kết quả build production lần đầu sau cập nhật Lưu kho/ảnh demo
- Người dùng đã chạy `npm.cmd install` và `npm.cmd run build` trên máy Windows tại bản mã nguồn đã đồng bộ.
- **Build thành công:** `tsc -b` không còn báo lỗi; Vite v6.4.6 build production thành công; PWA tạo `dist/sw.js` và precache 5 entries.
- Cảnh báo còn lại:
  - npm audit báo 6 vulnerabilities (2 low, 3 moderate, 1 high). Chưa chạy `npm audit fix`; cần xem chi tiết và đánh giá tương thích trước khi nâng dependency.
  - `esbuild@0.25.12` có install script chưa được approve theo cảnh báo của npm. Chưa approve tự động; cần xem xét nguồn gốc/gói phụ thuộc trước.
  - Bundle JS chính khoảng 994.33 kB trước gzip (310.92 kB sau gzip), vượt ngưỡng cảnh báo 500 kB của Vite. Không làm build thất bại; có thể tối ưu code splitting ở đợt sau.
- **Trạng thái:** xác nhận build production thành công, nhưng chưa đồng nghĩa đã kiểm thử chức năng trên trình duyệt.
- **Bước kiểm thử tiếp theo:** chạy `npm.cmd run dev`, mở ứng dụng và kiểm tra danh sách thiết bị, lọc/sắp xếp kết hợp, mở chi tiết, gallery ảnh demo, thêm ảnh, Lưu kho và Khôi phục. Không xóa dữ liệu thử nghiệm ở bước này.
