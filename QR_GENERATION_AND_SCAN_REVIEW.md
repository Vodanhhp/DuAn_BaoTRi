# BAOTRI Mini – Rà soát quá trình sinh, in và quét QR

Ngày rà soát: 18/11/2026
Phạm vi: `src/App.tsx`, `src/db.ts`, `src/style.css`, tài liệu quy ước mã thiết bị và các quyết định đã thống nhất.
Trạng thái: review tĩnh repository; chưa sửa logic QR, chưa in tem vật lý hoặc kiểm thử camera thực tế.

## 1. Quy tắc nghiệp vụ cần giữ

BAOTRI có ba khái niệm độc lập:
1. UUID nội bộ: khóa dữ liệu bất biến, dùng liên kết các bảng và đồng bộ.
2. Mã quản lý thiết bị: ví dụ `QL-HP01-001-02-05-26`, dùng để đọc/in/tra cứu thủ công.
3. QR: mã truy cập nhanh. QR không phải mã quản lý và không nên đồng nhất với UUID nội bộ; có thể cấp lại QR mà không đổi ID hoặc mã quản lý.

Tài liệu `QUY_UOC_MA_DINH_DANH_VA_VIET_TAT_THIET_BI.txt` hiện lại ghi QR chứa `ASSET:<UUID nội bộ>`. Đây là điểm không nhất quán giữa cách diễn đạt “QR là mã tắt riêng” và cách hiện thực payload. Cần chốt payload cuối cùng trước khi thay đổi tem đang dùng.

## 2. Hiện trạng code

### Nơi tạo QR
Trong `src/App.tsx`, có ba vị trí render `QRCodeSVG`:
- Khung QR trong cửa sổ Chi tiết thiết bị.
- Tem QR 50 × 30 mm.
- QR trên bản in chi tiết thiết bị.

Cả ba đều dùng cùng payload:
`ASSET:${value.id}`

Như vậy QR mới hiện mã hóa UUID nội bộ, không mã hóa mã quản lý `value.code`, cũng không có một QR token độc lập. Ba vị trí đang nhất quán với nhau về payload, không thấy ba cách sinh khác nhau.

### Nơi giải mã QR
`ScanModal.resolveAsset()`:
- Trim chuỗi đầu vào.
- Nếu bắt đầu bằng `ASSET:` thì bỏ prefix.
- Tìm chính xác theo `asset.id`, sau đó tìm theo `asset.code` không phân biệt hoa thường.
- Nếu đang thực hiện Checklist, kiểm tra `expectedAssetId` để không mở nhầm thiết bị.
- Camera và nhập thủ công dùng chung hàm resolve.

Do đó hiện hỗ trợ:
- QR mới `ASSET:<UUID>`.
- QR đời cũ chứa raw UUID.
- Mã quản lý dạng raw code.
- Dạng `ASSET:<mã quản lý>` (vì sau khi bỏ prefix sẽ so sánh với code).

Không thấy xử lý URL deep-link; QR hiện tại không tự mở ứng dụng/trang web bên ngoài, mà chỉ hoạt động khi người dùng đang ở ứng dụng và dùng chức năng Quét QR.

### In tem
- Tem CSS được đặt 50 × 30 mm.
- QR được ép kích thước 17 × 17 mm.
- Mã quản lý được in bằng chữ bên cạnh QR.
- Payload `ASSET:<UUID>` tương đối dài so với một token ngắn; 17 mm có thể đọc được với máy in/độ tương phản phù hợp nhưng chưa có kết quả test vật lý.
- Cần kiểm tra print preview, tỷ lệ 100%, lề máy in, độ nét và khả năng quét bằng điện thoại trước khi nghiệm thu.

## 3. Vấn đề và rủi ro phát hiện

1. **Khả năng sai về mô hình định danh:** QR đang chứa trực tiếp UUID. Nếu quyết định nghiệp vụ là QR token riêng, đây là sai lệch cần sửa ở cả ba vị trí sinh QR và resolver.
2. **QR không độc lập với ID:** đổi/cấp lại QR hiện không có cơ chế riêng; muốn đổi payload phải thay đổi logic hoặc ID, trái với yêu cầu QR có thể thay mà không đổi hồ sơ.
3. **Không có trường QR riêng:** `Asset` trong `src/db.ts` chưa có `qrToken`/mã truy cập riêng. Schema Cloud cũng chưa có trường tương ứng.
4. **Không có URL mở trực tiếp:** hiện quét QR chỉ tra trong danh sách `assets` đang có ở local app. Đây có thể là chủ ý offline-first; không được tự chuyển sang URL khi chưa chốt trải nghiệm.
5. **Chưa có test tự động cho payload QR:** build thành công không chứng minh QR sinh ra đúng payload hoặc scanner nhận được tem in.
6. **Camera scanner dùng effect dependency rỗng:** scanner đóng trên `assets` và `expectedAssetId` tại thời điểm mount. Luồng modal hiện thường mount mới mỗi lần mở, nhưng cần test chuyển Checklist/đổi ngữ cảnh và unmount/cleanup để tránh stale closure hoặc scanner tồn tại trùng.
7. **Kích thước tem chưa được xác minh vật lý:** 17 mm QR trên tem 50 × 30 mm là thông số CSS, không phải bằng chứng tem thực tế quét ổn định.

## 4. Hướng thiết kế nên dùng nếu xác nhận QR là mã riêng

- Bổ sung thuộc tính QR độc lập (ví dụ `qrToken`) vào Asset; không dùng UUID hay mã quản lý làm payload QR mới.
- Token phải được tạo ngẫu nhiên, duy nhất trong phạm vi doanh nghiệp, lưu bền vững trong IndexedDB và đồng bộ Cloud; không được tính lại từ tên, mã thiết bị, ngày hoặc vị trí.
- Tái tạo/cấp lại QR chỉ thay token; giữ nguyên `asset.id` và `asset.code`.
- Resolver tra token trước; sau đó vẫn hỗ trợ legacy UUID/code để tem cũ không mất tác dụng.
- Checklist vẫn kiểm tra assetId sau khi token được phân giải, giữ nguyên chống mở nhầm thiết bị.
- Có thể in mã quản lý dạng chữ dưới QR để dự phòng nhập thủ công.
- Trước khi bật Cloud Sync, cần quy tắc uniqueness và RPC/permission cấp lại token; không dùng client upsert tùy ý.

Chưa chọn độ dài/định dạng token hoặc QR có URL hay không; đó là quyết định sản phẩm cần thống nhất.

## 5. Lỗi lân cận trong sinh mã quản lý (không phải payload QR)

Trong cùng `src/App.tsx`, `buildAssetCode()` hiện:
- Hard-code `RECEIVING_FACILITY_CODE = 'HP01'`, dù quy ước nói mã cơ sở phải cấu hình theo doanh nghiệp.
- Dùng bảng `ASSET_LOCATION_CODES` hard-code; vị trí không có trong bảng bị gán `99`.
- Tính số tiếp theo bằng cách đọc toàn bộ assets trong IndexedDB hiện tại. Transaction giúp tránh race trong cùng DB/browser, nhưng không bảo đảm duy nhất giữa nhiều thiết bị/browser offline hoặc nhiều user.
- Cloud có cấu hình facility/category/location riêng và allocator RPC riêng. Local generator và Cloud generator hiện không cùng một nguồn cấu hình/sequence.

Đây là lỗi đáng lưu ý vì mã quản lý được in cạnh QR, nhưng cần xử lý riêng với thay đổi payload QR.

## 6. Kế hoạch kiểm thử trước khi sửa

1. Tạo asset mới local; xác nhận ID, mã quản lý và payload QR được lưu/hiển thị riêng.
2. Render QR ở cả 3 vị trí; giải mã bằng thư viện test để so payload.
3. Scan QR mới, QR cũ UUID, raw code và `ASSET:<code>`.
4. Scan token của thiết bị A trong Checklist thiết bị B: phải từ chối.
5. Cấp lại QR token: asset ID, mã quản lý, logs, tasks, checklist không đổi; QR cũ xử lý theo chính sách đã chốt.
6. Export/import backup và restore: QR token phải được bảo toàn.
7. Hai browser offline tạo tài sản: không trùng QR token.
8. Print tem 50 × 30 mm ở tỷ lệ 100%; thử nhiều điện thoại, ánh sáng và chất lượng in.
9. Đóng/mở modal quét liên tục; không còn camera instance hoặc callback cũ.

## 7. Trạng thái an toàn

- Chỉ đọc và đối chiếu code/tài liệu.
- Chưa sửa App.tsx, db.ts, CSS hoặc schema.
- Chưa đổi QR của bất kỳ thiết bị nào; không làm mất khả năng đọc tem cũ.
- Chưa chạy SQL/migration, không ghi dữ liệu Supabase Test/Production.
- Chưa xác nhận in tem vật lý hoặc kiểm thử camera thực tế.

