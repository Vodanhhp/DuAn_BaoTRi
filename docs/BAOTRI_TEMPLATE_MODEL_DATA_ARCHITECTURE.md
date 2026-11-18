# BAOTRI – KIẾN TRÚC THƯ VIỆN MÔ HÌNH MẪU VÀ CẤU HÌNH DOANH NGHIỆP

Ngày thiết kế: 18/11/2026  
Trạng thái: **DESIGN BASELINE – CHƯA TRIỂN KHAI CODE / CHƯA TẠO MIGRATION**  
Repository: `Vodanhhp/DuAn_BaoTRi` – nhánh `main`

## 1. Mục tiêu

Thiết kế một cấu trúc dữ liệu tổng quát để BAOTRI có thể phục vụ nhiều loại hình doanh nghiệp và nhiều mức độ quản lý mà không phải viết một ứng dụng riêng cho từng ngành.

Nguyên tắc sản phẩm:

> **Một nền tảng lõi – nhiều mô hình doanh nghiệp – nhiều bộ từ điển chuyên dụng.**

Mô hình mẫu chỉ cung cấp cấu hình khởi đầu. Nó không tạo sẵn thiết bị, vật tư có tồn kho, công việc đã phát sinh, nhật ký hoặc kết quả kiểm tra thực tế.

Tài liệu này là thiết kế kiến trúc logic. Tên bảng/tên cột bên dưới là tên đề xuất, chưa phải cam kết schema SQL. Chỉ chuyển thành Dexie/Supabase schema sau khi rà soát code hiện hành và có kế hoạch triển khai riêng.

## 2. Nguyên tắc kiến trúc bắt buộc

1. **Tách ba lớp dữ liệu**
   - Thư viện mẫu chuẩn do BAOTRI quản lý.
   - Bản cấu hình đã sao chép và tùy chỉnh của từng doanh nghiệp.
   - Dữ liệu nghiệp vụ thực tế do doanh nghiệp tạo ra.

2. **Không để mẫu ghi đè dữ liệu thật**
   - Cập nhật mẫu chuẩn không tự sửa/xóa thiết bị, vật tư, công việc, lịch sử hoặc kết quả đã phát sinh.
   - Không tự thay đổi cấu hình doanh nghiệp đã tùy chỉnh.
   - Chỉ áp dụng thay đổi mẫu khi Admin xem trước và xác nhận.

3. **Local-first**
   - Local là nơi thao tác nghiệp vụ và lưu dữ liệu trước.
   - Khi online, ID UUID chính thức và mã quản lý được tạo/ghi nhận theo quy tắc hiện hành ở phía Local; Cloud kiểm tra quyền, tính duy nhất, idempotency và lưu đúng giá trị Local gửi.
   - Cloud không tự tạo thiết bị/vật tư nghiệp vụ, không tự sinh mã quản lý và không tự áp mẫu lên dữ liệu thực tế.
   - Cấu hình doanh nghiệp phải được phân phối/đồng bộ nhất quán giữa PC và Mobile; không lấy localStorage riêng của từng máy làm nguồn quyết định.
   - Các quy tắc Local/Cloud hiện hành trong TIENDO và tài liệu `supabase/CLOUD_LOCAL_DRAFT_IDENTITY_DESIGN.md` được ưu tiên hơn mọi mô tả cũ trái ngược.

4. **Tách mã và ID**
   - ID nội bộ là UUID bất biến, dùng làm khóa và liên kết.
   - Mã hiển thị là quy ước của doanh nghiệp hoặc mã người dùng nhập theo nghiệp vụ.
   - Không dùng mã hiển thị làm primary key.
   - Không đưa ID tạm offline vào cột UUID chính thức của Cloud.

5. **Phân biệt cấu hình với quyền**
   - Bật một phân hệ không đồng nghĩa mọi người dùng được quyền thao tác.
   - Menu hiển thị, module được kích hoạt, permission và dữ liệu nghiệp vụ là các lớp riêng.
   - Không tạo hệ thống role/permission thứ hai; phải ánh xạ vào permission catalog hiện hữu.

6. **Thiết kế theo khả năng mở rộng nhưng không làm phức tạp app hiện tại**
   - Mẫu có thể mô tả trường mở rộng có schema rõ ràng; không biến toàn bộ dữ liệu thành JSON tùy ý.
   - Chỉ chuẩn hóa bảng riêng khi có nhu cầu truy vấn, quan hệ, kiểm soát quyền hoặc báo cáo thực tế.
   - Không triển khai engine workflow tổng quát trong giai đoạn hoàn thiện app lõi.

## 3. Phân loại mô hình

Mỗi mô hình doanh nghiệp được xác định bởi ba trục:

### 3.1 Nhóm ngành

Ví dụ:
- Lưu trú: nhà nghỉ, khách sạn, resort.
- Tòa nhà – văn phòng.
- Nhà máy – xưởng sản xuất.
- Trường học.
- Bệnh viện – cơ sở y tế.
- Cửa hàng – siêu thị.
- Nhà hàng – dịch vụ ăn uống.
- Cơ sở dịch vụ khác.

Ngành mô tả loại tài sản, vật tư, công việc, checklist và quy trình thường gặp. Không nên dùng ngành làm điều kiện cứng trong code nghiệp vụ.

### 3.2 Quy mô

Đề xuất ba mức: nhỏ, trung bình, lớn.

Quy mô là gợi ý cấu hình: số cơ sở, số khu vực, số thiết bị, số người dùng, mức chi tiết báo cáo và khả năng tổ chức kho. Không tự suy ra giới hạn cứng nếu chưa có chính sách sản phẩm riêng.

### 3.3 Mức quản lý bảo trì

- **Cơ bản:** ghi nhận thiết bị, vật tư, yêu cầu sửa chữa, kiểm tra đơn giản.
- **Tiêu chuẩn:** bổ sung lịch định kỳ, checklist theo thiết bị, lịch sử và báo cáo.
- **Chuyên sâu:** kế hoạch, định mức, phân tích, nhiều cấp phê duyệt và báo cáo kỹ thuật sâu hơn.

Hệ thống có thể đề xuất mức phù hợp theo ngành/quy mô, nhưng Admin doanh nghiệp phải xem và xác nhận.

Một hồ sơ mô hình có thể kết hợp các profile; không nhân bản toàn bộ bộ dữ liệu chỉ vì thay đổi một trục.

## 4. Ba lớp dữ liệu và quyền sở hữu

### 4.1 Lớp A – Thư viện mẫu chuẩn của BAOTRI

Đây là nguồn do nhà cung cấp quản lý, có version và phát hành theo gói. Thành phần:

- Hồ sơ ngành, quy mô và mức quản lý.
- Danh sách module và menu gợi ý.
- Từ điển thiết bị: nhóm, loại, thuộc tính gợi ý.
- Từ điển vật tư: nhóm, mặt hàng gợi ý, đơn vị tính.
- Từ điển công việc: loại, trạng thái, mức ưu tiên, mẫu nội dung.
- Mẫu Checklist theo loại thiết bị.
- Mẫu kế hoạch/chu kỳ bảo trì.
- Quy tắc mã hiển thị và profile cấp mã.
- Gợi ý cơ cấu cơ sở, khu vực và kho.
- Ma trận gợi ý role/permission theo chức năng (không cấp quyền vượt permission catalog).
- Điều kiện phụ thuộc và cảnh báo an toàn/ngành nghề.

Thư viện chuẩn không phải dữ liệu tenant và không được nhân viên doanh nghiệp sửa trực tiếp.

Trong giai đoạn đầu, thư viện có thể được quản lý dưới dạng các gói JSON/Markdown có version trong repository BAOTRI. Chưa cần tạo một dịch vụ trung tâm riêng. Khi có nhu cầu phân phối phiên bản trực tuyến mới xem xét dịch vụ catalog của nhà cung cấp.

### 4.2 Lớp B – Bản cấu hình doanh nghiệp

Khi onboarding, doanh nghiệp nhận một bản sao từ mẫu chuẩn. Bản sao có vòng đời và version độc lập.

Admin có thể:
- Bật/tắt module được phép sử dụng.
- Bật/tắt nhóm hoặc loại thiết bị.
- Bật/tắt nhóm vật tư và mục gợi ý.
- Bổ sung mục riêng của doanh nghiệp.
- Đổi tên hiển thị hoặc mô tả mà không làm thay đổi mã định danh nguồn.
- Điều chỉnh checklist, mẫu công việc và chu kỳ.
- Chọn cấu trúc cơ sở/kho/vị trí.
- Chọn quy tắc mã trong phạm vi được hỗ trợ.

Mỗi mục cấu hình cần lưu nguồn gốc: mẫu nào, phiên bản nào, ID mục gốc nào; trạng thái là giữ nguyên, tùy chỉnh, bổ sung riêng hoặc ngừng áp dụng.

Cấu hình doanh nghiệp được lưu tại Local trước và được đồng bộ/lưu trữ Cloud theo kiến trúc đã chốt. Mọi thiết bị PC/Mobile thuộc cùng doanh nghiệp phải nhận cùng một cấu hình đã xác nhận.

### 4.3 Lớp C – Dữ liệu nghiệp vụ thực tế

Ví dụ:
- Một máy bơm cụ thể có UUID, mã quản lý, vị trí, hãng, model và tình trạng.
- Một vật tư cụ thể có mã, số lượng tồn và lịch sử nhập/xuất.
- Một phiếu sửa chữa cụ thể.
- Một lần thực hiện Checklist với kết quả và người thực hiện.

Dữ liệu thực tế được tạo qua nghiệp vụ ứng dụng, không phải do import mẫu. Không được tự xóa hoặc sửa dữ liệu thực tế khi cập nhật thư viện.

## 5. Mô hình dữ liệu logic đề xuất

Các thực thể sau là mô hình logic. Có thể ánh xạ thành nhiều bảng hoặc một số JSON có version tùy theo tần suất truy vấn và quan hệ. Không triển khai nguyên xi toàn bộ thành bảng ngay từ đầu.

### 5.1 Danh mục hồ sơ và phát hành mẫu

| Thực thể logic | Trường chính | Ý nghĩa |
|---|---|---|
| TemplateCatalog | catalog_id, name, description, status | Bộ thư viện mẫu BAOTRI |
| IndustryProfile | industry_id, code, name, description | Hồ sơ ngành |
| SizeProfile | size_id, code, name, criteria | Hồ sơ quy mô |
| MaintenanceProfile | maintenance_level_id, code, name, capability_set | Mức quản lý |
| BusinessModel | model_id, model_code, name, industry_id, size_id, maintenance_level_id | Một tổ hợp mô hình có thể khởi tạo |
| TemplateRelease | release_id, model_id, version, status, released_at, compatibility | Phiên bản phát hành bất biến |
| TemplateDependency | release_id, dependency_type, dependency_code, required | Điều kiện phụ thuộc module/danh mục |
| TemplateChange | change_id, release_id, target_type, target_id, change_type, summary | Nhật ký thay đổi giữa các version |

Quy tắc:
- `model_code` ổn định, ví dụ `HOTEL_SMALL_BASIC`; tên hiển thị có thể đổi.
- Version dùng dạng có thể so sánh, ví dụ major.minor.patch.
- Bản phát hành đã dùng để khởi tạo tenant không bị sửa tại chỗ; thay đổi tạo release mới.
- Mỗi release có manifest, checksum, phiên bản schema và phiên bản ứng dụng tối thiểu/tối đa tương thích.
- Không cho một release phụ thuộc vào ID nội bộ của tenant.

### 5.2 Cấu trúc nội dung của một release

Một release chứa các gói thành phần:

| Gói | Nội dung |
|---|---|
| ModulePackage | module được đề xuất bật/tắt, menu, thứ tự và điều kiện |
| AssetDictionaryPackage | nhóm thiết bị, loại thiết bị, thuộc tính gợi ý, mã loại |
| InventoryDictionaryPackage | nhóm vật tư, mặt hàng gợi ý, đơn vị tính |
| WorkDictionaryPackage | loại công việc, trạng thái, ưu tiên, mẫu tiêu đề/nội dung |
| ChecklistPackage | mẫu checklist gắn với loại thiết bị và version |
| MaintenancePackage | chu kỳ gợi ý, mẫu kế hoạch và điều kiện áp dụng |
| OrganizationStructurePackage | mô hình cơ sở, khu vực, kho và vị trí gợi ý |
| CodeProfilePackage | quy tắc mã doanh nghiệp/cơ sở/thiết bị/vật tư/công việc |
| RoleSuggestionPackage | gợi ý vai trò và quyền theo permission catalog hiện hành |
| SafetyRulePackage | cảnh báo, giới hạn và điều kiện cần người có chuyên môn |

Mỗi mục trong gói có:
- `template_item_id` ổn định trong thư viện.
- `code` ổn định trong phạm vi danh mục.
- `name`, `description`, `sort_order`.
- `enabled_by_default`, `optional`, `required`.
- `tags`, `dependencies`.
- `schema_version`.
- `attributes_schema` nếu có thuộc tính mở rộng.
- Thông tin nguồn và version.

Không dùng tên hiển thị làm khóa liên kết. Không tái sử dụng code đã ngừng phát hành cho một mục khác.

### 5.3 Cấu hình doanh nghiệp

| Thực thể logic | Trường chính | Ý nghĩa |
|---|---|---|
| OrganizationProfile | organization_id, business_name, business_code, industry_id, size_id, maintenance_level_id | Hồ sơ doanh nghiệp |
| OrganizationModel | organization_id, model_code, source_release_id, source_version, installed_at | Mẫu nguồn đã khởi tạo |
| OrganizationConfigVersion | organization_id, config_version, parent_version, status, created_at, created_by | Phiên bản cấu hình tenant |
| OrganizationModule | organization_id, module_code, enabled, menu_order, settings | Trạng thái module |
| OrganizationDictionaryItem | organization_id, dictionary_type, item_id, source_item_id, source_release_id, code, name, status, origin, overrides | Mục từ điển được sao chép |
| OrganizationChecklistTemplate | organization_id, template_id, source_item_id, asset_type_id, version, status, content | Checklist tenant |
| OrganizationMaintenanceTemplate | organization_id, template_id, source_item_id, asset_type_id, version, settings | Mẫu bảo trì tenant |
| OrganizationCodeProfile | organization_id, entity_type, code_rule, config, version | Quy tắc mã hiển thị |
| OrganizationStructure | organization_id, structure_type, structure_id, parent_id, code, name, status | Cơ sở/khu vực/kho/vị trí |
| OrganizationTemplateInstall | organization_id, release_id, installed_config_version, installed_at, installed_by | Lịch sử cài mẫu |
| OrganizationTemplateUpdate | organization_id, release_id, from_version, to_version, preview, status, applied_at | Theo dõi cập nhật mẫu |

Ghi chú:
- Đây là tên logic, không khẳng định mỗi thực thể sẽ thành một bảng.
- `OrganizationDictionaryItem` phải có loại danh mục rõ ràng; không tạo một bảng key-value không kiểm soát cho mọi thứ.
- `overrides` chỉ chứa trường được phép tùy chỉnh và phải được validate theo schema của loại mục.
- Không lưu permission thực tế trong module config như một bản quyền độc lập; quyền vẫn thuộc hệ thống phân quyền hiện hữu.
- Một tenant có thể giữ mục ở trạng thái active, disabled hoặc retired. Không hard-delete mục đã được dữ liệu thật tham chiếu.

### 5.4 Liên kết với dữ liệu nghiệp vụ hiện có

| Cấu hình mẫu | Dữ liệu thực tế hiện có / dự kiến | Quy tắc |
|---|---|---|
| Loại thiết bị | assets.category và danh mục nhóm/loại | Chọn loại khi tạo Asset; Asset lưu giá trị ổn định, không phụ thuộc tên hiển thị thay đổi |
| Mục vật tư gợi ý | inventory_items | Chỉ là danh mục gợi ý; không tự tạo mặt hàng thực tế hoặc số tồn |
| Đơn vị tính | inventory_items.unit | Dùng danh mục đơn vị; cho phép bổ sung theo quy tắc |
| Loại công việc | tasks/logs và các phiếu nghiệp vụ | Gợi ý phân loại; không thay đổi lịch sử đã lưu |
| Checklist mẫu | checklist_templates / checklist_template_versions | Khi tạo Asset có thể tạo bản Checklist riêng từ mẫu; version đã thực hiện phải giữ snapshot |
| Mẫu bảo trì | maintenance_plans / tasks | Admin xác nhận mới tạo kế hoạch/công việc; không tự tạo hàng loạt |
| Cơ sở/kho/vị trí | cấu hình tổ chức và trường nghiệp vụ liên quan | Cấu hình cấp doanh nghiệp, PC/Mobile dùng chung |
| Quy tắc mã | cấu hình mã và luồng cấp mã hiện hành | Không thay ID; không tự đổi mã đã cấp |

Trước khi ánh xạ thật phải đọc lại `src/db.ts`, `src/App.tsx`, các repository Cloud và migration đang có trên `main`. Đặc biệt, `customAssetCategories`, `organization_settings.asset_categories` và `asset_code_config` là các cấu trúc khác nhau, không được gộp tùy tiện.

## 6. Từ điển chuẩn

### 6.1 Từ điển thiết bị

Một mục loại thiết bị nên mô tả:
- Mã loại ổn định.
- Tên và mô tả.
- Nhóm thiết bị cha.
- Ngành áp dụng và mức phổ biến.
- Thuộc tính gợi ý (hãng, model, serial, công suất, chu kỳ, thông số riêng).
- Checklist mẫu tương ứng.
- Mẫu bảo trì/chu kỳ gợi ý.
- Nhóm vật tư có thể dùng.
- Cảnh báo an toàn.
- Trạng thái và version.

Một thiết bị thực tế chỉ tham chiếu loại phù hợp; không tự sinh một Asset từ mỗi mục từ điển.

### 6.2 Từ điển vật tư

Mỗi mục gợi ý gồm:
- Mã danh mục ổn định.
- Tên, nhóm, mô tả.
- Đơn vị tính mặc định và đơn vị thay thế nếu được phép.
- Thiết bị/loại thiết bị có thể liên quan.
- Quy cách hoặc thuộc tính gợi ý.
- Ngành áp dụng.
- Trạng thái.

Không có số lượng tồn, đơn giá mua, nhà cung cấp hoặc giao dịch kho trong từ điển chuẩn. Các thông tin đó chỉ có ở mặt hàng thực tế của doanh nghiệp.

Một vật tư có thể liên quan nhiều loại thiết bị. Quan hệ này chỉ phục vụ tra cứu/gợi ý, không tự động trừ kho.

### 6.3 Từ điển công việc

Mỗi loại công việc gồm:
- Mã, tên, mô tả.
- Nhóm nghiệp vụ (sửa chữa, kiểm tra, bảo dưỡng, bảo trì, kiểm định...).
- Mức ưu tiên gợi ý.
- Các trường hiển thị/nhập liệu cần thiết.
- Checklist hoặc mẫu nội dung liên quan.
- Ngành/loại thiết bị áp dụng.

Trạng thái vòng đời công việc là một danh mục lõi dùng chung; không nhân bản mỗi ngành một bộ trạng thái nếu không có lý do nghiệp vụ rõ ràng.

### 6.4 Đơn vị tính và danh mục lõi

Tách từ điển lõi khỏi từ điển ngành:
- Đơn vị tính.
- Trạng thái thiết bị.
- Trạng thái công việc.
- Mức ưu tiên.
- Loại giao dịch kho.
- Kết quả kiểm tra.
- Loại nhật ký.

Danh mục lõi có mã ổn định và quy tắc tương thích. Mô hình ngành chỉ bổ sung mục chuyên dụng, không sửa ý nghĩa mã lõi.

## 7. Checklist và mẫu bảo trì

### 7.1 Checklist mẫu theo loại thiết bị

Mẫu Checklist chuẩn thuộc thư viện BAOTRI. Khi cài mẫu:
1. Sao chép mẫu vào cấu hình doanh nghiệp.
2. Admin được xem, tùy chỉnh và xác nhận.
3. Khi tạo thiết bị thực tế, có thể tạo Checklist riêng dựa trên mẫu đã chọn.
4. Mỗi lần chỉnh mẫu riêng tạo version mới.
5. Kết quả thực hiện lưu snapshot nội dung/version tại thời điểm làm, không dựng lại từ mẫu mới nhất.

Mẫu Checklist không phải phiếu kết quả và không tự tạo lịch thực hiện.

### 7.2 Mẫu bảo trì

Mẫu có thể gồm:
- Loại thiết bị áp dụng.
- Công việc gợi ý.
- Chu kỳ gợi ý.
- Nội dung và phạm vi.
- Người/nhóm phụ trách gợi ý.
- Điều kiện áp dụng.
- Cảnh báo chuyên môn.

Chu kỳ chỉ là gợi ý. Admin phải xác nhận trước khi áp dụng cho thiết bị hoặc tạo kế hoạch. Không tự động tạo lịch hàng năm hoặc lịch cho toàn bộ thiết bị khi vừa cài mẫu.

## 8. Module, menu và phân quyền

Ba lớp cần lưu riêng:

1. **Module capability:** doanh nghiệp có cấu hình/được sử dụng phân hệ hay không.
2. **Navigation/menu:** mục nào hiển thị, thứ tự và nhóm menu.
3. **Permission:** tài khoản nào được thực hiện hành động nào.

Ví dụ:
- Tắt module Quản lý nhiều cơ sở thì menu và luồng nghiệp vụ nhiều cơ sở không được kích hoạt; không xóa dữ liệu lịch sử.
- Bật module Checklist không đồng nghĩa Viewer được thực hiện Checklist.
- Mẫu chỉ đưa ra role/permission gợi ý; việc cấp quyền phải qua permission catalog và cơ chế Admin hiện hữu.
- Không dùng menu ẩn làm biện pháp bảo mật; backend/RLS/RPC vẫn phải kiểm tra quyền.

## 9. Cấu trúc cơ sở, kho và vị trí

Mô hình phải hỗ trợ:
- Một doanh nghiệp có một hoặc nhiều cơ sở.
- Một cơ sở có nhiều khu vực/tầng/phòng.
- Một hoặc nhiều kho tùy cấu hình.
- Có thể chọn quản lý vị trí vật tư hoặc dùng một kho chung.

Đây là cấu hình tổ chức, không được nhầm với danh mục thiết bị hoặc danh mục vật tư.

Profile nhỏ có thể mặc định một cơ sở, một kho chung, tắt quản lý vị trí. Profile lớn có thể đề xuất nhiều cơ sở/kho nhưng Admin phải xác nhận.

Không tự chuyển dữ liệu vật tư giữa kho khi thay cấu hình; phải có nghiệp vụ điều chuyển và lịch sử riêng nếu chức năng đó được triển khai.

## 10. Quy tắc mã hiển thị

Mỗi loại thực thể có thể có profile mã riêng:
- Doanh nghiệp.
- Cơ sở.
- Thiết bị.
- Vật tư.
- Công việc.
- Khu vực/kho/vị trí nếu nghiệp vụ cần.

Một code profile nên mô tả:
- Entity type.
- Prefix/segment.
- Thành phần cơ sở/nhóm/năm nếu có.
- Độ dài số thứ tự và quy tắc tăng.
- Phạm vi duy nhất.
- Quy tắc khi chuyển cơ sở/đổi nhóm.
- Phiên bản cấu hình.

Không hard-code mã ngành vào logic chung. Không tự đổi mã cũ khi nâng version mẫu. Mọi thay đổi code profile phải có preview, kiểm tra trùng và quy trình chuyển đổi riêng. Mã quản lý không phải primary key.

Quy tắc Local/online hiện hành về UUID chính thức, ID tạm và cấp mã phải được giữ nguyên; tài liệu mô hình không được tự định nghĩa lại cơ chế cấp mã.

## 11. Cài đặt mô hình và cập nhật phiên bản

### 11.1 Onboarding lần đầu

1. Nhà cung cấp cấp quyền khởi tạo cho Admin chính theo quy trình bảo mật riêng.
2. Admin khai báo thông tin doanh nghiệp và mã doanh nghiệp.
3. Chọn nhóm ngành.
4. Chọn quy mô.
5. Chọn mức quản lý bảo trì (hệ thống có thể gợi ý).
6. Chọn số cơ sở và cấu trúc cơ sở.
7. Chọn cấu hình kho/vị trí.
8. Xem trước module/menu, từ điển thiết bị/vật tư/công việc, Checklist và mẫu bảo trì.
9. Xác nhận quy tắc mã.
10. Hệ thống tạo **bản cấu hình tenant** từ release đã chọn; không tạo Asset/InventoryItem/Task/Log/Movement thực tế.
11. Admin rà soát và xác nhận hoàn tất.
12. Cấu hình đã xác nhận được lưu Local và đồng bộ/lưu trữ Cloud để PC/Mobile cùng sử dụng.

### 11.2 Cập nhật mẫu chuẩn

Khi BAOTRI phát hành version mới:
1. Doanh nghiệp nhận thông báo có version mới tương thích.
2. Hệ thống so sánh release đang dùng và release mới.
3. Tạo báo cáo thay đổi: thêm, sửa, ngừng khuyến nghị, thay điều kiện.
4. Phân loại thay đổi:
   - Mục mới: đề xuất thêm, mặc định chưa kích hoạt nếu là optional.
   - Thay mô tả: chỉ cập nhật nếu tenant chưa tùy chỉnh trường đó hoặc Admin đồng ý.
   - Thay cấu trúc: yêu cầu migration/config transform có version.
   - Mục ngừng dùng: đánh dấu retired, không xóa nếu đang được tham chiếu.
   - Mục bị loại bỏ vì an toàn/pháp lý: cảnh báo rõ, yêu cầu Admin xử lý.
5. Admin xem trước và chọn áp dụng.
6. Lưu config version mới; giữ lại version cũ và audit.
7. Không sửa dữ liệu nghiệp vụ đã tạo.

### 11.3 Xung đột và rollback

- Cấu hình tenant có version và parent version.
- Hai thiết bị cùng sửa cấu hình phải phát hiện conflict; không âm thầm lấy bản cuối cùng ghi đè.
- Mỗi lần áp dụng release là một giao dịch cấu hình có thể kiểm tra trước/sau.
- Có thể quay về version cấu hình trước nếu chưa phát sinh phụ thuộc không thể đảo ngược; nếu đã có dữ liệu thực tế phụ thuộc thì phải tạo config version mới để khôi phục, không xóa lịch sử.
- Lưu người thực hiện, thời điểm, release nguồn, checksum và kết quả.

## 12. Mẫu đầu tiên: Nhà nghỉ – Khách sạn nhỏ

Mã mô hình: `HOTEL_SMALL_BASIC`  
Ngành: Lưu trú  
Quy mô: Nhỏ  
Mức quản lý: Cơ bản

Cấu hình khởi đầu đề xuất:
- Một cơ sở.
- Một kho chung; tắt quản lý vị trí.
- Quản lý vật tư cơ bản: mã, tên, nhóm, đơn vị, số lượng tồn, tồn tối thiểu. Không bắt buộc đơn giá/nhà cung cấp.
- Bảo trì đơn giản: sửa chữa, kiểm tra định kỳ, bảo dưỡng đơn giản; không bắt buộc kế hoạch năm.
- PCCC và thang máy là optional: có trong thư viện chuẩn nhưng không bật mặc định; Admin chọn nếu cơ sở có.

### 12.1 Nhóm thiết bị gợi ý

Mặc định bật:
- Điện: tủ điện tổng, tủ điện tầng, aptomat, đèn, ổ cắm, công tắc.
- Điều hòa: điều hòa treo tường, điều hòa âm trần.
- Nước: máy bơm, bồn nước, phao điện, van nước.
- Bình nóng lạnh.
- An ninh: camera, đầu ghi, màn hình giám sát.
- Thiết bị khác: tivi, tủ lạnh, máy giặt, quạt hút.

Optional:
- PCCC: bình chữa cháy, tủ báo cháy, đầu báo, chuông báo.
- Thang máy chở khách.

Chỉ cài nhóm/loại gợi ý; không tạo sẵn hồ sơ thiết bị thật.

### 12.2 Nhóm vật tư gợi ý

- Vật tư điện: bóng LED, aptomat, dây điện, ổ cắm, công tắc.
- Vật tư nước: van nước, ống PVC, co nối, vòi.
- Vật tư điều hòa: tụ điện, điều khiển, ống thoát nước.
- Vật tư thiết bị: linh kiện và phụ kiện thay thế.
- Vật tư PCCC: pin và phụ kiện phù hợp (chỉ khi bật PCCC).
- Vật tư phụ: ốc vít, băng keo, keo silicone, dây rút.

Đơn vị gợi ý: cái, chiếc, bộ, mét, cuộn, hộp, chai, kg, lít. Admin có thể bổ sung. Không tạo số lượng tồn mẫu. Một vật tư có thể liên kết nhiều loại thiết bị; liên kết chỉ phục vụ tra cứu, không tự trừ kho.

### 12.3 Loại công việc gợi ý

- Sửa chữa.
- Kiểm tra.
- Bảo dưỡng.
- Bảo trì.
- Kiểm định (có trong từ điển, chỉ bật khi cần).

Trạng thái lõi: Chờ thực hiện → Đang thực hiện → Hoàn thành. Quá hạn là trạng thái suy ra từ hạn và trạng thái hiện tại, không phải loại công việc riêng.

Mẫu tiêu đề: thay bóng đèn phòng; khắc phục aptomat nhảy; kiểm tra máy bơm; vệ sinh điều hòa; kiểm tra bình nóng lạnh; kiểm tra hệ thống điện.

### 12.4 Checklist gợi ý

Mặc định:
1. Máy bơm nước: tiếng ồn, rung, rò rỉ, dây điện/thiết bị đóng cắt quan sát được, khả năng cấp nước.
2. Điều hòa: khả năng làm lạnh, tiếng ồn, nước ngưng/thoát nước, lưới lọc, điều khiển.
3. Tủ điện: vỏ tủ, dấu hiệu nóng, tiếng bất thường, dây/đầu nối quan sát bên ngoài, thiết bị đóng cắt.
4. Bình nóng lạnh: tình trạng bên ngoài, rò nước, dấu hiệu bất thường về điện, khả năng làm nóng, dây/thiết bị bảo vệ.
5. Camera: hình ảnh, tín hiệu, ghi hình, lưu trữ, nguồn.
6. Chiếu sáng: đèn, công tắc, nhấp nháy, hư hỏng, khu vực thiếu sáng.

Optional:
7. PCCC: tình trạng bên ngoài, niêm phong, khả năng tiếp cận, chỉ dẫn, hồ sơ kiểm tra.
8. Thang máy: vận hành quan sát, cửa, tín hiệu cảnh báo, hiển thị, hồ sơ bảo trì/kiểm định.

Checklist nội bộ không thay thế kiểm định hoặc quy trình pháp lý/chuyên môn. Không hướng dẫn người không đủ chuyên môn thao tác trên thiết bị điện đang mang điện hoặc mở tủ điện.

### 12.5 Chu kỳ gợi ý

- Máy bơm: hàng tháng, kiểm tra vận hành.
- Điều hòa: 3–6 tháng, vệ sinh và kiểm tra.
- Tủ điện: hàng tháng, kiểm tra bên ngoài/dấu hiệu bất thường.
- Bình nóng lạnh: theo hướng dẫn nhà sản xuất.
- Camera: hàng tháng, kiểm tra hình ảnh/lưu trữ.

Đây là gợi ý, không phải lịch bắt buộc. Admin xác nhận trước khi áp dụng. PCCC/thang máy phải theo yêu cầu chuyên ngành; không dùng chu kỳ đơn giản này thay thế.

### 12.6 Menu gợi ý

Mặc định:
- Tổng quan.
- Thiết bị.
- Vật tư.
- Công việc.
- Kiểm tra định kỳ.
- Nhân sự.
- Cài đặt.

Không bật mặc định:
- Kế hoạch bảo trì chuyên sâu.
- Báo cáo kỹ thuật chuyên sâu.
- Quản lý nhiều cơ sở.

Menu thực tế phải được ánh xạ vào module và permission hiện có; không tạo quyền mới chỉ từ mẫu.

## 13. Chiến lược triển khai dữ liệu sau này

Không triển khai toàn bộ kiến trúc trong một lần. Thứ tự đề xuất khi quay lại:

1. Hoàn thiện ứng dụng lõi hiện tại và kiểm thử các chức năng đang có.
2. Chốt logical schema và data contract của template release (JSON schema, ID, version, dependency, checksum).
3. Làm parser/validator đọc gói mẫu mà chưa ghi dữ liệu.
4. Thử cài một release vào cấu hình tenant Local trên môi trường test.
5. Bổ sung lưu cấu hình doanh nghiệp lên Cloud và đồng bộ PC/Mobile bằng cơ chế riêng, không dùng localStorage riêng làm nguồn chân lý.
6. Thử cập nhật release, preview diff, tùy chỉnh và conflict.
7. Chỉ sau khi luồng cấu hình ổn định mới nối các lựa chọn mẫu vào biểu mẫu tạo nghiệp vụ.
8. Khởi tạo một mô hình khác để kiểm chứng tính tổng quát.

Không được đưa thư viện mẫu vào luồng seed dữ liệu nghiệp vụ hiện tại hoặc tự động ghi dữ liệu mẫu lên Supabase.

## 14. Những điều chưa chốt và không được tự giả định

- Danh sách ngành và mã ngành cuối cùng.
- Tiêu chí định lượng cho quy mô nhỏ/trung bình/lớn.
- Danh sách module chính thức và quan hệ phụ thuộc.
- Cấu trúc field mở rộng riêng cho từng loại thiết bị.
- Cơ chế phát hành/cấp phép và phân phối template package khi thương mại hóa.
- Cấu trúc vật lý cuối cùng: bảng riêng hay JSONB cho từng nhóm cấu hình.
- Quy tắc migration cấu hình khi schema app thay đổi.
- Phạm vi permission từng vai trò cho từng mô hình.
- Cấu trúc đa cơ sở/kho chi tiết và nghiệp vụ điều chuyển.
- Chuẩn hóa đơn vị tính và code dictionary toàn hệ thống.

Các nội dung này sẽ được rà soát theo nhu cầu thực tế; không cản trở việc hoàn thiện app lõi hiện tại.

## 15. Phạm vi và trạng thái

### Đã hoàn thành ở tầng thiết kế và kiểm chứng gói mẫu
- Thiết kế ba lớp dữ liệu: thư viện mẫu chuẩn của BAOTRI, bản cấu hình doanh nghiệp và dữ liệu nghiệp vụ thực tế.
- Thiết kế các trục ngành/quy mô/mức quản lý; quy tắc version, provenance, tùy chỉnh, cập nhật và conflict.
- Định nghĩa JSON Schema Draft 2020-12 tại `docs/schemas/baotri-template-release.schema.json`.
- Tạo gói mẫu tham chiếu `templates/HOTEL_SMALL_BASIC/1.0.0.json`: sáu nhóm Checklist mặc định, hai Checklist PCCC/thang máy tùy chọn; nhóm thiết bị PCCC/thang máy không bật mặc định; vật tư cơ bản; bảo trì đơn giản; một cơ sở/một kho chung; quy tắc mã và vai trò gợi ý.
- Tạo semantic validator `scripts/validate-template-release.mjs` để đọc JSON và kiểm tra liên kết giữa các danh mục; validator chỉ đọc và kiểm tra, không ghi dữ liệu.
- Thêm test cho gói mẫu và các trường hợp tham chiếu sai tại `tests/templateRelease.test.mjs`.
- CI kiểm tra JSON Schema bằng Ajv, kiểm tra tham chiếu nghiệp vụ, chạy validator, sau đó build và deploy.

### Chưa triển khai – chủ ý để dành giai đoạn sau
- Chưa tích hợp thư viện mẫu vào TypeScript/React/Dexie của app.
- Chưa tạo hoặc sửa Supabase migration; chưa chạy SQL, RPC hoặc ghi dữ liệu vào Supabase Test/Production.
- Chưa tạo cấu hình doanh nghiệp thật từ gói mẫu.
- Chưa thay đổi dữ liệu nghiệp vụ hiện có.
- Chưa có giao diện quản trị/phát hành template catalog.

**Kết luận:** Cấu trúc dữ liệu mẫu và gói mẫu đầu tiên đã có thể lưu trữ, kiểm tra định dạng và kiểm tra liên kết độc lập với app. Tạm đóng phần thư viện mẫu tại đây; quay lại hoàn thiện BAOTRI Mini hiện tại. Khi cần tạo mô hình ngành khác, dùng JSON Schema và gói `HOTEL_SMALL_BASIC` làm chuẩn tham chiếu, không tự động nạp gói vào dữ liệu doanh nghiệp.
