# BAOTRI Mini – Đối chiếu quyền vai trò với thao tác UI

Cập nhật: 18/11/2026

## Phạm vi

Review tĩnh trên `main` đối với:
- `supabase/migrations/20261117000500_roles_and_permissions.sql`
- `supabase/migrations/20261117000600_permission_based_business_rls.sql`
- `supabase/migrations/20261117001200_asset_code_allocator_rpc.sql`
- `supabase/tests/20261117000900_business_modules_rls_integration_test.sql`
- `src/App.tsx`

Đây là đối chiếu thiết kế, không phải xác nhận phân quyền Cloud đã được nghiệm thu end-to-end. Hiện chưa có worker đồng bộ; thao tác nghiệp vụ vẫn ghi IndexedDB và queue local.

## 1. Quyền được cấp theo migration 005

| Nhóm quyền | Admin | Technician | Viewer |
|---|---:|---:|---:|
| Dashboard, xem thiết bị/kho/bảo trì/Checklist/log/báo cáo/cài đặt | Có | Có | Có |
| Tạo/sửa thiết bị | Có | Có | Không |
| Xóa thiết bị | Có | Không | Không |
| Tạo/sửa vật tư, nhập/xuất/điều chỉnh kho | Có | Có | Không |
| Xóa vật tư | Có | Không | Không |
| Tạo/sửa công việc và kế hoạch bảo trì | Có | Có | Không |
| Xóa công việc/kế hoạch | Có | Không | Không |
| Tạo/sửa biểu mẫu và phiên bản Checklist | Có | Không | Không |
| Thực hiện Checklist, tạo phiếu kết quả | Có | Có | Không |
| Tạo nhật ký | Có | Có | Không |
| Quản lý cấu hình doanh nghiệp, người dùng, vai trò | Có | Không | Không |

Viewer được seed các permission có action = `view`. Technician không được cấp các quyền xóa, `checklist.template.manage`, `settings.manage`, `users.manage`, `roles.manage`.

## 2. Đối chiếu với UI hiện tại

### Thiết bị
- UI chặn Viewer ở thao tác thêm/sửa, lưu kho và khôi phục; phù hợp với quyền ghi của Technician/Admin.
- UI tạo mã hiển thị tại local bằng `buildAssetCode`; Cloud RPC `create_asset_with_code` tự cấp mã từ `asset_code_config`. RPC nhận `p_id` nhưng không nhận mã local.
- Vì vậy không thể dùng thẳng RPC tạo mới cho bản ghi local cần giữ nguyên code. Cần RPC import riêng có quyền phù hợp, kiểm tra trùng code/UUID và audit; không dùng PostgREST upsert trực tiếp.
- UI hiện không nên coi thao tác local thành bằng chứng đã được Cloud chấp nhận.

### Kho vật tư
- UI chặn Viewer với tạo/sửa vật tư và nhập/xuất.
- Technician được cấp `inventory.create/update/adjust`, phù hợp với thao tác nghiệp vụ thông thường.
- Tuy nhiên migration 006 vẫn cho phép INSERT trực tiếp `inventory_items`; migration 002 có grant INSERT. Đường INSERT có thể gửi quantity ban đầu mà không tạo movement. Cần thu hồi INSERT trực tiếp và thay bằng RPC tạo vật tư + tồn đầu kỳ + movement trong cùng transaction.
- Movement hiện được ghi local cùng transaction với balance. Cloud movement phải qua RPC; không được upsert movement hoặc ghi đè quantity trực tiếp.
- UI hiện có thao tác Nhập/Xuất; đoạn tính tồn đang trừ quantity cho cả loại Xuất và Điều chỉnh. Chưa thiết kế RPC Điều chỉnh cho đến khi nghiệp vụ này được xác định rõ.

### Công việc và kế hoạch bảo trì
- UI hiện chỉ phân biệt Viewer với nhóm không phải Viewer; do đó Technician nhìn thấy được các nút sửa/xóa kế hoạch và có thể thao tác local.
- Permission catalog chỉ cấp Technician `maintenance.create/update`, không cấp `maintenance.delete`. Backend phải từ chối xóa dù UI có thể cho thao tác local; cần đồng bộ kiểm soát giao diện theo permission trước khi mở Cloud sync.
- Hoàn thành công việc cập nhật task và thêm log trong cùng Dexie transaction. Cloud cần một RPC/transaction tương ứng nếu muốn bảo đảm hai thay đổi cùng thành công hoặc cùng rollback.

### Checklist
- UI dùng `allowActions={!isViewer ...}`; về cơ bản Technician và Admin đều có thể mở trình sửa biểu mẫu.
- Technician không có `checklist.template.manage` trong migration 005. Vì vậy Technician hiện có thể sửa template local nhưng thao tác Cloud phải bị từ chối. Cần quyết định giữ chính sách Admin-only hay cấp quyền quản lý template cho Technician; không tự ý thay đổi permission mặc định.
- UI tự tạo Checklist mặc định và version đầu khi người không phải Viewer mở chức năng. Khi đồng bộ Cloud, việc khởi tạo này cũng phải tuân thủ quyền quản lý template; không để Technician vô tình tạo template trái quyền.
- Technician/Admin có `checklist.result.create`; kết quả Checklist là lịch sử append-only và mỗi lần thực hiện phải tạo bản ghi riêng, không update đè kết quả cũ.

### Nhật ký bảo trì
- UI cho nhóm không phải Viewer tạo và cập nhật cùng một Log local; khi hoàn thành công việc, UI có thể đổi trạng thái và thêm editHistory.
- RLS Cloud hiện chỉ cho INSERT và SELECT trên `maintenance_logs`, không có UPDATE/DELETE; đây là mô hình append-only.
- Mapper hiện từ chối các Log có `dueDate`, `requestedBy`, `editHistory` vì schema chưa có các trường này.
- Trước khi sync cần quyết định: mở rộng schema để lưu đầy đủ trường; và biểu diễn chỉnh sửa/đổi trạng thái bằng event hoặc revision mới thay vì sửa lịch sử đã ghi. Không âm thầm bỏ các trường hoặc update trực tiếp log append-only.

### Ảnh thiết bị
- RLS cho phép INSERT metadata ảnh nếu có `assets.create` hoặc `assets.update`, SELECT nếu có `assets.view`, DELETE nếu có `assets.delete`.
- Chưa có luồng Storage upload/download. Không đưa base64 ảnh vào PostgreSQL; cần Storage private và metadata `asset_images` sau khi có thiết kế đường dẫn, quyền và cleanup.

## 3. Vấn đề cần xử lý trước khi bật Cloud worker

1. UI hiện dùng `isViewer` thay cho kiểm tra từng permission. Backend RLS/RPC vẫn là lớp bảo vệ bắt buộc; UI cần được cập nhật để ẩn/disable đúng thao tác theo quyền thực tế, tránh người dùng thao tác local rồi gặp lỗi khi sync.
2. Chốt chính sách Technician có được sửa biểu mẫu Checklist không. Permission hiện tại trả lời là không, UI hiện tại lại cho phép.
3. Chốt cách xử lý xóa công việc/kế hoạch của Technician. Permission hiện tại không cho xóa, UI hiện tại có thể cho thao tác.
4. Thiết kế RPC tạo vật tư có movement tồn đầu kỳ; thu hồi direct INSERT inventory_items.
5. Thiết kế RPC import thiết bị bảo toàn UUID + mã local, tách biệt với RPC cấp mã Cloud mới.
6. Hoàn thiện schema và mô hình append-only cho Log, gồm dueDate/requestedBy/editHistory.
7. Xây kiểm thử quyền theo từng RPC, cả trường hợp permission bị thu hồi giữa lúc queue đang chờ.

## 4. Trạng thái an toàn

- Chỉ review mã nguồn và schema; tài liệu này không thay đổi hành vi ứng dụng.
- Không tạo worker, không gửi dữ liệu nghiệp vụ lên Supabase.
- Không chạy SQL/migration, không thay đổi RLS/grants/RPC trên Test hoặc Production.
- Không tạo thêm tài khoản, organization hoặc membership.
- Các migration hiện tại vẫn là thiết kế/repository state; không suy diễn rằng mọi thay đổi đã được áp dụng lên database.

## 5. Bước tiếp theo

Tiếp tục review các bảng/field còn lại và chuẩn hóa hợp đồng quyền cho từng RPC. Sau đó tạo migration draft chỉ trong repository, chia nhỏ theo row_version, idempotency/change feed, asset import và inventory RPC. Không áp dụng migration lên bất kỳ Supabase project nào khi chưa có phê duyệt riêng.
