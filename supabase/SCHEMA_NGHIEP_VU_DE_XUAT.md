# BAOTRI Mini – Đề xuất schema dữ liệu nghiệp vụ Supabase

**Trạng thái: BẢN THIẾT KẾ ĐỂ REVIEW – CHƯA PHẢI MIGRATION SQL**

Ngày lập: 17/11/2026  
Repository: `Vodanhhp/DuAn_BaoTRi`  
Nhánh: `main`

## 1. Mục tiêu và giới hạn

Thiết kế các bảng PostgreSQL tương ứng với dữ liệu đang lưu trong Dexie database `baotri-local-v1`, để một tài khoản Auth có thể sử dụng cùng dữ liệu trên máy tính và điện thoại.

Các nguyên tắc bắt buộc:

- Giữ nguyên UUID `id` của mọi bản ghi hiện có khi import.
- Mọi bảng nghiệp vụ có `organization_id`, kể cả giai đoạn đầu chỉ có một người dùng; không bỏ khả năng mở rộng multi-tenant.
- Foreign key phải gắn cả `organization_id` để ngăn liên kết chéo giữa hai tổ chức.
- Bảo toàn lịch sử Checklist theo template, version và result snapshot.
- Ảnh chuyển sang Supabase Storage; bảng nghiệp vụ chỉ giữ metadata và đường dẫn tệp.
- Không replay `syncQueue` hiện tại vì hàng đợi này không phản ánh đầy đủ mọi thao tác ghi.
- Không xóa hoặc sửa dữ liệu local trong quá trình import.
- Chưa tạo migration SQL, chưa chạy SQL trên bất kỳ Supabase project nào trong bước thiết kế này.

## 2. Nguồn dữ liệu đã kiểm tra

File backup: `backup-baotri-day-du-2026-11-16.json`  
Database nguồn: `baotri-local-v1`  
Backup version: `2`

| Store / dữ liệu | Số bản ghi |
|---|---:|
| assets | 34 |
| inventory | 41 |
| tasks | 4 |
| logs | 6 |
| movements | 0 |
| maintenancePlans | 0 |
| checklistTemplates | 34 |
| checklistVersions | 34 |
| checklistResults | 0 |
| syncQueue | 17 |
| customAssetCategories | 0 |

Backup chứa 32 thiết bị có ảnh, tổng cộng 64 ảnh. Ảnh đang được nhúng dạng Data URL/Base64 trong `Asset.images`.

Các quan hệ được kiểm tra không có ID tham chiếu mồ côi: task → asset; log → asset/task; checklist template → asset; checklist version → template/asset.

**Dữ liệu cần xử lý trước import:**

- `inventory` có hai bản ghi mã `VT-001`, cùng tên “Lọc dầu máy nén khí” và các thông tin nghiệp vụ giống nhau nhưng có ID khác nhau. Không tự gộp/xóa. Cần người dùng quyết định giữ một bản ghi hay xác định đây là hai mặt hàng riêng và đổi mã một bản ghi.
- Backup hiện chưa có movement, maintenancePlan hoặc checklistResult; schema vẫn cần có các bảng tương ứng để phục vụ dữ liệu phát sinh sau này.
- `syncQueue` có 17 mục, chỉ gồm upsert cho assets/tasks/logs; không bao gồm đầy đủ inventory, movements và Checklist. Đây không phải nhật ký đồng bộ đáng tin cậy và không được chạy lại như lệnh import.
- `customAssetCategories` hiện rỗng. Định dạng hiện tại là cấu trúc nhóm → loại thiết bị, cần bảo toàn nguyên cấu trúc JSON nếu có dữ liệu về sau.

## 3. Sơ đồ bảng đề xuất

### 3.1. Bảng nền đã có từ Migration 001

Giữ nguyên các bảng đã tạo trong migration identity:

- `profiles`: hồ sơ người dùng, khóa theo `auth.users.id`.
- `organizations`: ranh giới dữ liệu của từng đơn vị/tenant.
- `organization_members`: thành viên và vai trò trong tổ chức.

Migration 001 đã được chạy trên project thử nghiệm `BAOTRI-Mini-Test`; chưa chạy trên project chính. Thiết kế nghiệp vụ sẽ tham chiếu các bảng nền này, không tạo lại.

### 3.2. Các bảng nghiệp vụ

| Bảng đề xuất | Nguồn local | Vai trò |
|---|---|---|
| `assets` | assets | Hồ sơ thiết bị |
| `inventory_items` | inventory | Danh mục vật tư và số lượng tồn hiện tại |
| `maintenance_tasks` | tasks | Công việc bảo dưỡng/bảo trì |
| `maintenance_logs` | logs | Nhật ký bảo trì, sửa chữa |
| `inventory_movements` | movements | Giao dịch nhập/xuất/điều chỉnh kho |
| `maintenance_plans` | maintenancePlans | Kế hoạch bảo trì theo thiết bị |
| `checklist_templates` | checklistTemplates | Biểu mẫu Checklist riêng từng thiết bị |
| `checklist_template_versions` | checklistVersions | Các phiên bản bất biến của biểu mẫu |
| `checklist_results` | checklistResults | Phiếu Checklist từng lần thực hiện |
| `asset_images` | Asset.images | Metadata và thứ tự ảnh thiết bị trong Storage |
| `organization_settings` hoặc `organization_asset_categories` | customAssetCategories | Danh mục nhóm/loại thiết bị tự tạo |

Tất cả bảng nghiệp vụ đều có:
- `organization_id uuid not null`.
- `id uuid` giữ nguyên ID nguồn nếu có; với bản ghi tạo mới dùng UUID phía database/client theo quy tắc đã chốt.
- `created_at`/`updated_at` khi nguồn có dữ liệu tương ứng hoặc khi bảng cần quản lý cập nhật.
- RLS bật và policy giới hạn theo membership của `auth.uid()`.

### 3.3. Trường và quan hệ chính

**assets**
- Giữ các trường hiện tại: `code`, `name`, `category`, `brand`, `model`, `serial`, `location`, `commissionedAt`, `power`, `cycle`, `cycleStartedAt`, `transferredFromOtherFacility`, `status`, `notes`, `archivedAt`, `createdAt`, `updatedAt`.
- Chuyển tên cột sang snake_case trong PostgreSQL, ví dụ `commissioned_at`, `cycle_started_at`, `transferred_from_other_facility`.
- Unique dự kiến: `(organization_id, code)), vì mã thiết bị hiện không trùng trong backup.

**inventory_items**
- Giữ `code`, `name`, `group`, `unit`, `partNumber`, `size`, `quantity`, `minQuantity`, `location`, `supplier`, `unitPrice`, `updatedAt`.
- Dùng numeric cho số lượng và đơn giá để tránh giới hạn số nguyên nếu sau này có vật tư tính theo mét/lít/kg lẻ.
- Chưa áp unique `(organization_id, code)` cho đến khi xử lý xong hai bản ghi `VT-001`. Sau khi người dùng xác nhận và dữ liệu sạch, mới bổ sung ràng buộc mã duy nhất.

**maintenance_tasks**
- Giữ `asset_id`, `title`, `due_date`, `frequency`, `status`, `checklist`, `readings`, `notes`, `completed_at`, `created_at`, `updated_at`.
- FK kép `(organization_id, asset_id)` → `assets(organization_id, id)`.

**maintenance_logs**
- Giữ `asset_id`, `task_id` tùy chọn, `checklist_result_id` tùy chọn, `date`, `kind`, `description`, `parts`, `readings`, `result`, `completed_at`, `performed_by`.
- `performed_by` tiếp tục lưu tên người thực hiện dạng snapshot như dữ liệu hiện tại; có thể bổ sung `performed_by_user_id` nullable để liên kết Auth user về sau, nhưng không thay thế snapshot lịch sử.
- FK kép đến assets; FK task/result nullable và cùng organization.

**inventory_movements**
- Giữ `item_id`, `date`, `type`, `quantity`, `reason`, `linked_asset_id`.
- FK kép đến `inventory_items`; `linked_asset_id` nullable và FK kép đến assets.
- Giao dịch kho là lịch sử; không xóa giao dịch cũ để sửa số tồn. Số tồn hiện tại được lưu tại inventory_items và phải được cập nhật cùng movement trong một transaction khi chức năng kho chuyển sang cloud.

**maintenance_plans**
- Giữ `asset_id`, `title`, `period`, `start_date`, `end_date`, `execution`, `contractor`, `notes`, `created_at`, `updated_at`.
- FK kép đến assets.

**checklist_templates**
- Mỗi thiết bị có biểu mẫu riêng, không dùng chung template giữa các thiết bị.
- Giữ `asset_id`, `title`, `description`, `current_version`, `active`, `created_at`, `updated_at`.
- FK kép đến assets; unique dự kiến `(organization_id, asset_id)` nếu nghiệp vụ tiếp tục giới hạn một template hiện hành cho mỗi thiết bị.

**checklist_template_versions**
- Giữ `template_id`, `asset_id`, `version`, `title`, `description`, `items`, `created_at`.
- `items` dùng JSONB để bảo toàn cấu trúc item hiện tại và thứ tự; phiên bản đã phát hành không sửa nội dung.
- FK kép đến template và asset; unique `(organization_id, template_id, version)`.

**checklist_results**
- Giữ `asset_id`, `template_id`, `template_version_id`, `template_version`, `template_title`, `performed_at`, `performed_by`, `result`, `scheduled_for`, `is_makeup`, `notes`, `items`, `created_at`.
- `items` dùng JSONB snapshot; không dựng lại từ template hiện tại khi xem phiếu cũ.
- FK kép đến asset/template/version. Không cascade delete lịch sử.

**asset_images**
- Mỗi ảnh là một dòng có `organization_id`, `asset_id`, `position`, `storage_path`, `mime_type`, `size_bytes`, `checksum`, `created_at`.
- Vì nguồn hiện tại chỉ là mảng Data URL không có image ID, dùng `(organization_id, asset_id, position)` làm khóa duy nhất ổn định cho đợt import.
- Thứ tự ảnh phải giữ nguyên theo chỉ số trong mảng `Asset.images`.

**Danh mục nhóm/loại thiết bị tự tạo**
- Backup hiện rỗng. Đề xuất lưu cấu trúc nhóm → loại thiết bị trong JSONB theo tổ chức ở giai đoạn đầu để không làm biến dạng dữ liệu local hiện có.
- Nếu sau này cần tìm kiếm/phân quyền/quan hệ mã loại ở mức từng dòng, có thể chuẩn hóa thành hai bảng riêng bằng migration sau; không cần làm phức tạp ngay khi dữ liệu đang rỗng.

## 4. Ảnh và Supabase Storage

- Tạo private bucket, đề xuất tên `asset-images`.
- Đường dẫn object theo tenant và thiết bị, ví dụ: `{organization_id}/{asset_id}/{position}.{ext}`.
- Import giải mã Data URL thành binary, xác định MIME type và phần mở rộng thực tế; không lưu chuỗi Base64 trong cột PostgreSQL.
- Ghi metadata vào `asset_images`; ứng dụng tải ảnh bằng signed URL hoặc cơ chế truy cập Storage có policy phù hợp.
- Chỉ xác nhận import ảnh thành công khi số lượng object, kích thước và checksum được đối chiếu.
- Nếu upload object thành công nhưng transaction metadata thất bại (hoặc ngược lại), import phải ghi nhận trạng thái để retry/dọn object mồ côi an toàn; không tự xóa ảnh nguồn local.

## 5. RLS và khởi tạo tổ chức cho một tài khoản

- Không cho client tự gửi role hoặc tự nhận quyền Admin.
- Không cho người dùng chọn tùy ý `organization_id` để đọc/ghi.
- Mọi policy đọc/ghi nghiệp vụ phải xác minh `auth.uid()` là thành viên active của organization tương ứng, và organization đang active.
- Các FK kép theo organization_id ngăn việc gắn task/log/movement/checklist sang bản ghi của tenant khác.
- Migration 001 hiện chưa có tổ chức hoặc membership được tạo. Trước khi import phải có bước bootstrap tạo đúng một organization và membership Admin cho Auth user đã được chỉ định, bằng thao tác Dashboard/SQL được review hoặc quy trình server-side được kiểm soát.
- Không tạo UI multi-tenant, không cần tạo thêm tài khoản test trong giai đoạn này. Tuy nhiên schema vẫn tenant-ready.
- Cần review riêng policy INSERT/UPDATE/DELETE và quyền EXECUTE trước khi viết migration; không chỉ dựa vào policy SELECT đang có trong Migration 001.

## 6. Quy trình import đề xuất

### Giai đoạn A – kiểm tra trước import
1. Người dùng chọn đúng file backup nguồn và xác nhận tổ chức đích.
2. Công cụ kiểm tra version, số lượng, ID trùng, mã nghiệp vụ trùng, quan hệ tham chiếu, định dạng ngày/số và Data URL.
3. Hiển thị báo cáo lỗi/cảnh báo. Nếu còn lỗi chặn như mã vật tư VT-001 chưa giải quyết, không cho bắt đầu import.

### Giai đoạn B – staging và import
1. Tạo import batch có ID, nguồn backup, checksum tổng thể, thời điểm, người khởi chạy và trạng thái.
2. Import dữ liệu theo thứ tự: assets → inventory_items → maintenance_tasks → maintenance_plans → checklist_templates → checklist_template_versions → checklist_results → maintenance_logs → inventory_movements; đồng thời chuyển ảnh qua Storage và ghi asset_images.
3. Giữ nguyên ID nguồn. Mỗi FK phải xác minh bản ghi cha cùng organization.
4. Import trong transaction cho phần dữ liệu PostgreSQL. Storage không nằm trong transaction DB nên phải có nhật ký từng object và bước retry/cleanup riêng.
5. Không chạy lại syncQueue. Hàng đợi cũ chỉ được lưu trong backup để tra cứu, không chuyển thành lệnh ghi cloud.

### Giai đoạn C – chống nhập trùng và rollback
- Chỉ cho import vào organization mới/đích đang trống trong lần đầu.
- Nếu ID đã tồn tại và nội dung khớp checksum: ghi nhận đã có, không tạo bản sao.
- Nếu ID đã tồn tại nhưng nội dung khác: dừng batch và báo xung đột; không tự overwrite dữ liệu cloud.
- Gắn batch ID cho log import để biết bản ghi nào do batch nào tạo.
- Nếu thất bại trước khi hoàn tất, rollback các hàng PostgreSQL của batch; object Storage xử lý theo manifest để xóa đúng object do batch đó tạo, không xóa object có trước.
- Không xóa hoặc thay đổi IndexedDB/localStorage nguồn.

### Giai đoạn D – đối chiếu
- So sánh số lượng theo từng bảng/store.
- So sánh tập ID, không chỉ so sánh tổng số.
- Kiểm tra toàn bộ FK, unique constraint, số lượng vật tư, version Checklist, snapshot kết quả và thứ tự ảnh.
- Kiểm tra checksum/kích thước từng ảnh.
- Lưu báo cáo import và chỉ đánh dấu hoàn tất khi mọi đối chiếu đạt.
- Sau import vẫn giữ backup JSON và dữ liệu local nguyên vẹn cho đến khi người dùng xác nhận giai đoạn chuyển ứng dụng sang cloud.

## 7. Thứ tự triển khai sau khi duyệt thiết kế

1. Người dùng review và chốt bảng/trường/quan hệ cùng quy tắc xử lý VT-001.
2. Viết Migration 002 cho bảng nghiệp vụ + index + FK + RLS trên giấy và review nội dung SQL.
3. Áp dụng Migration 002 chỉ trên `BAOTRI-Mini-Test`; kiểm tra schema, constraint và RLS.
4. Viết bootstrap organization/membership có kiểm soát; xác minh đúng một Auth user có quyền.
5. Xây import dry-run trước, sau đó import test có thể rollback.
6. Thử chuyển ảnh và đối chiếu dữ liệu.
7. Chỉ khi project test đạt và có phê duyệt riêng mới lập kế hoạch áp dụng project chính.

## 8. Các quyết định cần người dùng duyệt

- [ ] Đồng ý các bảng nghiệp vụ ở mục 3.2.
- [ ] Đồng ý Checklist items và result snapshot lưu JSONB để giữ nguyên lịch sử.
- [ ] Đồng ý ảnh chuyển sang private Supabase Storage, không lưu Base64 trong bảng.
- [ ] Chốt xử lý hai bản ghi mã VT-001 trước khi import.
- [ ] Đồng ý chỉ import vào project test trước; chưa thao tác project chính.
- [ ] Đồng ý không import/replay 17 mục syncQueue cũ.

**Chưa có migration SQL trong tài liệu này. Chưa chạy SQL, chưa import, chưa upload ảnh lên Storage và chưa thay đổi dữ liệu local hoặc Supabase.**


## 9. Cập nhật sau khi soạn Migration 002 (17/11/2026)

Đã tạo bản nháp SQL tại:
`supabase/migrations/20261117000200_business_schema.sql`

Trạng thái: **DRAFT FOR REVIEW – CHƯA CHẠY SQL**.

Bản nháp hiện tạo 11 bảng nghiệp vụ đã nêu ở mục 3.2; thêm index, khóa ngoại kép theo organization, trigger cập nhật updated_at và RLS. Các policy dùng helper `is_org_member` / `has_org_role` từ Migration 001.

Các điểm bảo vệ được áp dụng trong bản nháp:
- Tất cả bảng nghiệp vụ bật RLS; không cấp quyền cho role anon.
- Master data chỉ truy cập trong organization mà Auth user có membership active.
- Checklist template chỉ Admin được tạo/sửa; version và result là lịch sử append-only từ client.
- Maintenance log và inventory movement là lịch sử append-only; không cấp quyền UPDATE/DELETE cho client.
- Chưa cấp quyền INSERT movement trực tiếp và không cho client cập nhật cột quantity của inventory_items. Cần RPC được review để cập nhật số tồn và ghi movement trong cùng transaction.
- Không tạo unique constraint cho mã vật tư theo organization ở giai đoạn này. Hai dòng VT-001 hiện tại sẽ được loại bỏ cùng toàn bộ dữ liệu thử nghiệm trong quy trình reset trước go-live; không cần chỉnh sửa riêng.
- Checklist version/result dùng JSONB và FK kiểm tra đúng template, thiết bị, phiên bản.
- Bảng asset_images mới lưu metadata; bucket Storage và policy Storage chưa được tạo trong Migration 002.

### Các giả định cần kiểm tra trước khi chạy
1. Trường ngày thuần (commissioned_at, cycle_started_at, due_date, start_date, end_date, scheduled_for, log_date, movement_date) đang được khai báo kiểu date; các mốc thời điểm thực hiện/hoàn tất dùng timestamptz. Cần đối chiếu dữ liệu thực tế trong App.tsx trước import.
2. Migration đang giả định danh mục thiết bị tự tạo có cấu trúc JSON object; định dạng lưu localStorage phải được xác minh trước khi kết nối.
3. Các trạng thái/giá trị period và execution đang dùng đúng các chuỗi tiếng Việt từ TypeScript hiện tại; cần rà soát dữ liệu thực tế để tránh giá trị ngoài danh sách.
4. RLS đang cho member thao tác dữ liệu thiết bị, vật tư (trừ số tồn), công việc và kế hoạch; quyền xóa master data giới hạn Admin. Đây là chính sách đề xuất, cần review trước khi áp dụng.
5. Bản nháp không tạo organization/membership, không tạo Storage bucket, không import dữ liệu và không sửa frontend/local data.

Việc người dùng xác nhận reset toàn bộ dữ liệu nghiệp vụ trước go-live có nghĩa là không cần xử lý riêng bản ghi VT-001 trong backup phát triển. Reset chỉ được thực hiện sau này theo quy trình riêng, có backup, preview số lượng và xác nhận rõ ràng; chưa thực hiện ở giai đoạn này.
