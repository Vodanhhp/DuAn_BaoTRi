# RÀ SOÁT DANH MỤC THIẾT BỊ VÀ CẤU HÌNH SINH MÃ CLOUD – 18/11/2026

## 1. Kết luận chính

Danh mục nhóm/loại thiết bị và cấu hình sinh mã là hai cấu hình khác nhau, cần đồng bộ độc lập:
- `customAssetCategories`: cây nhóm → loại thiết bị, mỗi loại có `name` và `code`.
- `asset_code_config`: quy tắc cấp mã quản lý gồm `facility_code`, `category_codes`, `location_codes`.

Không được suy ra cấu hình sinh mã hoàn chỉnh chỉ từ cây danh mục, cũng không được ghi đè một cấu hình khi cập nhật cấu hình kia.

## 2. Hành vi hiện tại của Local

### Danh mục tùy chỉnh
- Đọc từ localStorage key `baotri-custom-asset-categories`.
- Cấu trúc hiện tại: `[{ label, items: [{ name, code }] }]`.
- Mỗi item có mã 2–5 ký tự A-Z/0-9; tên loại và mã loại phải duy nhất so với danh mục hiện có.
- Khi thêm loại mới, chỉ ghi localStorage và React state; không ghi vào Dexie, không gọi queueChange.
- Backup JSON có trường `customAssetCategories`; restore ghi lại localStorage sau transaction.
- Vì vậy danh mục tùy chỉnh hiện chỉ thuộc browser đã tạo hoặc browser được restore backup; không tự đồng bộ qua thiết bị khác.

### Quy tắc sinh mã hiện tại
- Local dùng `RECEIVING_FACILITY_CODE='HP01'` cố định.
- `ASSET_LOCATION_CODES` là bảng mã vị trí hard-code; vị trí không có trong bảng nhận mã mặc định `99`.
- Tiền tố nhóm lấy từ danh mục chuẩn hoặc custom category.
- Sequence tăng theo prefix nhóm trên toàn bộ danh sách Asset local; local transaction bảo vệ hai tab trong cùng browser.
- Mã có dạng `ABC-HP01-xxx-BB-MM-YY`, thêm dấu `*` nếu chuyển từ cơ sở khác.
- Đây là cấu hình cục bộ, chưa có giao diện quản trị facility/category/location code dùng chung giữa nhiều thiết bị.

## 3. Hành vi Cloud schema hiện tại

- `organization_settings.asset_categories` là JSONB array, phù hợp để giữ nguyên cây nhóm → loại hiện tại.
- `organization_settings.asset_code_config` là JSONB object riêng, dùng facility_code, category_codes, location_codes.
- `asset_code_counters` lưu sequence theo organization + category_code.
- `create_asset_with_code` lấy cấu hình từ `asset_code_config`, khóa/cập nhật counter theo category_code, rồi tạo Asset trong transaction.
- RPC yêu cầu `assets.create`; hiện không có RPC quản trị riêng cho cập nhật hai cấu hình này trong các migration đã rà soát.

## 4. Các khoảng cách và rủi ro cần xử lý

1. **Danh mục tùy chỉnh không được queue:** hiện tại tạo danh mục trên máy A không làm máy B nhận được. Nếu Asset có category mới nhưng Cloud `asset_categories` chưa có danh mục đó, UI và cấu hình sinh mã có thể không nhất quán.
2. **Cấu hình cơ sở/địa điểm chưa tương thích hoàn toàn:** local dùng HP01 và bảng vị trí cố định; Cloud dùng config theo organization. Không được tự động chuyển HP01 thành facility code mặc định cho mọi khách hàng.
3. **Category code cần một nguồn chuẩn:** local danh mục chuẩn và custom category đều chứa code; Cloud allocator đọc `category_codes` riêng. Cần kiểm tra hai nguồn trùng khớp trước khi cho phép tạo Asset.
4. **Vị trí chưa có mã:** local âm thầm dùng 99; Cloud hiện yêu cầu location code hợp lệ và sẽ từ chối nếu không cấu hình. Cần quyết định rõ: bắt buộc khai báo mã vị trí hay cho phép một key dự phòng `__UNASSIGNED__`.
5. **Thay đổi mã sau khi đã cấp Asset:** category code, facility code hoặc location code là thành phần của mã quản lý đã in trên tem QR. Thay cấu hình không được đổi mã Asset cũ; chỉ tác động Asset mới.
6. **Khác biệt thuật toán sequence:** local tính max trong browser; Cloud dùng counter + max historical trong organization. Khi import dữ liệu local, cần nâng counter theo sequence thực tế, khóa cùng counter để tránh race.
7. **Khác biệt nhiều cơ sở:** local đang cố định HP01, trong khi Cloud config có một facility_code cấp tổ chức. Nếu một organization có nhiều cơ sở, cấu hình một facility_code đơn có thể chưa đủ để cấp mã theo từng cơ sở. Cần xem xét facility_code thuộc từng Asset/cơ sở, không ép dùng một mã chung.
8. **Backup/restore danh mục:** backup hiện mang danh mục custom, nhưng không có trường cấu hình riêng facility/location code. Cần bổ sung metadata cấu hình sau khi định nghĩa schema, không suy đoán từ mã Asset.

## 5. Thiết kế đề xuất trước khi viết migration

### A. Cấu hình danh mục
- Giữ JSONB `asset_categories` với đúng shape nhóm → items đã có.
- Dùng RPC `update_asset_categories` (tên tạm), yêu cầu Admin + permission `settings.manage`, kiểm tra shape, tên/mã không rỗng và duy nhất, mã 2–5 ký tự.
- Cập nhật bằng optimistic version/expected_version và idempotency; không dùng client ghi đè nguyên JSON một cách mù quáng.
- Danh mục chuẩn có thể nằm trong code release; danh mục custom của organization được đọc từ Cloud. Khi merge hiển thị phải phát hiện trùng tên hoặc mã, không tự chọn một bên.

### B. Cấu hình sinh mã
- Dùng RPC riêng `update_asset_code_config`, không gộp vào `update_asset_categories`.
- Chỉ Admin với `settings.manage` được cập nhật.
- Validate facility/category/location codes và kiểm tra mỗi category đang được dùng trong Asset vẫn giữ được mapping cũ.
- Cấu hình mới chỉ áp dụng cho Asset mới; không sửa `assets.code` lịch sử.
- Khi đổi category code đã từng cấp mã, cần lưu mapping cũ hoặc cấm đổi nếu không có quy trình migration mã được phê duyệt.
- Chốt mô hình nhiều cơ sở trước: một facility_code cấp tổ chức hay nhiều facility_code theo cơ sở. Khuyến nghị về lâu dài lưu cơ sở thành thực thể có mã riêng và Asset tham chiếu cơ sở đó; không triển khai vội khi chưa chốt nghiệp vụ.
- Với location chưa gán, thống nhất một mã dự phòng có cấu hình rõ ràng; không để local tự dùng 99 còn Cloud từ chối.

### C. Đồng bộ và offline
- Đọc settings sau đăng nhập/đổi organization; cache trong local nhưng có version và updated_at.
- Chỉnh sửa cấu hình khi offline chỉ lưu trạng thái pending có conflict/version; không cho phát hành mã mới nếu thiếu cấu hình cần thiết hoặc cấu hình đã quá cũ.
- Danh mục và cấu hình phải được đồng bộ trước khi bật tạo Asset Cloud.
- Không queue từng item category như bảng nghiệp vụ; coi toàn bộ settings document là một aggregate versioned, có RPC cập nhật có kiểm soát.

## 6. Chú thích QR đã chỉnh

Trong AssetModal, chú thích cũ nói QR dùng ID nội bộ đã mâu thuẫn với quyết định mới. Đã sửa để hiển thị đúng: QR mã hóa trực tiếp mã quản lý; nếu thay mã quản lý thì phải in lại tem QR. Không thay payload QR hoặc dữ liệu Asset.

## 7. Trạng thái

Đây là tài liệu rà soát/thiết kế. Chưa sửa schema, chưa thêm RPC, chưa thay đổi UI cấu hình, chưa chạy SQL và chưa ghi dữ liệu lên Supabase. Các quyết định cần chốt trước khi triển khai tiếp:
- Mô hình mã cơ sở khi một doanh nghiệp có nhiều cơ sở.
- Quy tắc mã cho vị trí chưa gán.
- Ai được phép sửa danh mục/cấu hình sinh mã và chính sách đổi category code đã được sử dụng.
