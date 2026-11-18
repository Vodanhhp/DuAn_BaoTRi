# BAOTRI Mini – Rà soát quá trình sinh, in và quét QR

Ngày rà soát: 18/11/2026
Phạm vi: `src/App.tsx`, `src/db.ts`, `src/style.css`, tài liệu quy ước mã thiết bị và các quyết định đã thống nhất.
Trạng thái: đã sửa payload QR theo quyết định nghiệp vụ; review code tĩnh, chưa in tem vật lý hoặc kiểm thử camera thực tế.

## 1. Quy tắc nghiệp vụ cần giữ

BAOTRI phân biệt hai loại mã:
1. UUID nội bộ: khóa dữ liệu kỹ thuật, dùng liên kết các bảng và đồng bộ; chỉ hiển thị nhỏ trong chi tiết thiết bị đối với Admin.
2. Mã quản lý thiết bị: ví dụ `QL-HP01-001-02-05-26`, là nội dung được mã hóa trực tiếp vào QR, đồng thời được in bằng chữ trên tem.

Quyết định nghiệp vụ đã được người dùng xác nhận: QR chính là mã quản lý được mã hóa thành hình QR. Không dùng UUID làm payload QR mới.

## 2. Hiện trạng code

### Nơi tạo QR
Trong `src/App.tsx`, có ba vị trí render `QRCodeSVG`:
- Khung QR trong cửa sổ Chi tiết thiết bị.
- Tem QR 50 × 30 mm.
- QR trên bản in chi tiết thiết bị.

Đã sửa cả ba vị trí dùng chung payload `value.code`:
- Khung QR trong cửa sổ Chi tiết thiết bị.
- Tem QR 50 × 30 mm.
- QR trên bản in chi tiết thiết bị.

QR mới mã hóa trực tiếp mã quản lý, không chứa UUID và không thêm tiền tố `ASSET:`.

### Nơi giải mã QR
`ScanModal.resolveAsset()`:
- Trim chuỗi đầu vào.
- Nếu bắt đầu bằng `ASSET:` thì bỏ prefix để tương thích tem cũ.
- Tìm chính xác theo `asset.id` (tương thích QR UUID đời cũ), sau đó tìm theo `asset.code` không phân biệt hoa thường (QR mới và tem mã quản lý đời cũ).
- Nếu đang thực hiện Checklist, kiểm tra `expectedAssetId` để không mở nhầm thiết bị.
- Camera và nhập thủ công dùng chung hàm resolve.

Do đó hiện hỗ trợ:
- QR mới chứa raw mã quản lý.
- QR cũ `ASSET:<UUID>`.
- QR cũ chứa raw UUID.
- Dạng `ASSET:<mã quản lý>`.

Không thấy xử lý URL deep-link; QR hiện tại không tự mở ứng dụng/trang web bên ngoài, mà chỉ hoạt động khi người dùng đang ở ứng dụng và dùng chức năng Quét QR.

### In tem
- Tem CSS được đặt 50 × 30 mm.
- QR được ép kích thước 17 × 17 mm.
- Mã quản lý được in bằng chữ bên cạnh QR.
- Payload QR hiện là mã quản lý thiết bị; độ dài phụ thuộc từng mã. QR 17 mm chưa có kết quả test vật lý.
- Cần kiểm tra print preview, tỷ lệ 100%, lề máy in, độ nét và khả năng quét bằng điện thoại trước khi nghiệm thu.

## 3. Vấn đề và rủi ro phát hiện

1. **QR phụ thuộc mã quản lý:** nếu mã quản lý thay đổi thì QR trên tem cũ không còn tra đúng; cần cập nhật tem sau khi thay mã. Mã quản lý vốn được quy định ổn định, nên đây là quy tắc quản trị chứ không phải lý do dùng UUID trong QR.
2. **Không có URL mở trực tiếp:** hiện quét QR chỉ tra trong danh sách `assets` đang có ở local app; không tự mở trang web.
3. **Chưa có test tự động giải mã QR:** cần test xác nhận cả ba nơi in đều có payload đúng bằng `asset.code`.
4. **Camera scanner:** đã sửa callback dùng dữ liệu mới nhất qua refs; cleanup vô hiệu callback khi modal đóng. Vẫn cần kiểm thử mở/đóng liên tục và đổi ngữ cảnh thực tế.
5. **Kích thước tem chưa được xác minh vật lý:** 17 mm QR trên tem 50 × 30 mm là thông số CSS, chưa chứng minh quét ổn định.

## 4. Quy tắc hiện hành sau khi sửa

- Cả ba nơi tạo QR dùng trực tiếp `value.code`.
- Chỉ Admin thấy UUID nội bộ ở dạng chữ nhỏ trong cửa sổ Chi tiết thiết bị; UUID không xuất hiện trên tem hoặc QR.
- Scanner giữ nguyên hỗ trợ QR legacy UUID và mã quản lý có/không có tiền tố `ASSET:`.
- Không bổ sung `qrToken`, không thêm URL deep-link, không thay đổi schema Dexie/Supabase.

## 5. Lỗi lân cận trong sinh mã quản lý (không phải payload QR)

Trong cùng `src/App.tsx`, `buildAssetCode()` hiện:
- Hard-code `RECEIVING_FACILITY_CODE = 'HP01'`, dù quy ước nói mã cơ sở phải cấu hình theo doanh nghiệp.
- Dùng bảng `ASSET_LOCATION_CODES` hard-code; vị trí không có trong bảng bị gán `99`.
- Tính số tiếp theo bằng cách đọc toàn bộ assets trong IndexedDB hiện tại. Transaction giúp tránh race trong cùng DB/browser, nhưng không bảo đảm duy nhất giữa nhiều thiết bị/browser offline hoặc nhiều user.
- Cloud có cấu hình facility/category/location riêng và allocator RPC riêng. Local generator và Cloud generator hiện không cùng một nguồn cấu hình/sequence.

Đây là lỗi đáng lưu ý vì mã quản lý được in cạnh QR, nhưng cần xử lý riêng với thay đổi payload QR.

## 6. Kế hoạch kiểm thử còn lại

1. Render QR ở cả 3 vị trí; giải mã bằng thư viện test và xác nhận payload đúng bằng `asset.code`.
2. Scan QR mới mã quản lý, QR cũ UUID, raw UUID và `ASSET:<code>`.
4. Scan token của thiết bị A trong Checklist thiết bị B: phải từ chối.
5. Cấp lại QR token: asset ID, mã quản lý, logs, tasks, checklist không đổi; QR cũ xử lý theo chính sách đã chốt.
6. Print tem 50 × 30 mm ở tỷ lệ 100%; thử nhiều điện thoại, ánh sáng và chất lượng in.
7. Đóng/mở modal quét liên tục; không còn camera instance hoặc callback cũ.

## 7. Trạng thái an toàn

- Đã sửa `src/App.tsx`: cả ba QR dùng `value.code`; Admin thấy UUID nhỏ trong chi tiết.
- Đã cập nhật quy ước mã thiết bị để thống nhất QR = mã quản lý.
- Scanner legacy giữ nguyên; chưa đổi dữ liệu thiết bị hoặc mã đã lưu.
- Chưa chạy SQL/migration, không ghi dữ liệu Supabase Test/Production.
- Chưa xác nhận in tem vật lý hoặc kiểm thử camera thực tế.

