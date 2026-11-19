# BAOTRI Mini – Thiết kế đồng bộ Nhật ký bảo trì và lịch sử chỉnh sửa

Cập nhật: 18/11/2026
Trạng thái: review thiết kế; chưa tạo migration hoặc gọi Supabase.

## 1. Hiện trạng đối chiếu

### Local model
`Log` hiện có:
- id, assetId, taskId, checklistResultId
- date, dueDate, kind, description, parts, readings
- requestedBy, result, completedAt, performedBy
- editHistory[] (editedAt, editedBy, action, previousResult, previousCompletedAt, previousPerformedBy)

`saveLog()` ghi đè bản ghi cùng ID bằng `putAndQueue`. Hiện editHistory chỉ tự thêm một sự kiện khi chuyển phiếu từ Hoàn thành về Chưa hoàn thành; các lần sửa nội dung khác chưa có revision snapshot đầy đủ.

### Cloud schema
`maintenance_logs` hiện có:
- asset_id, task_id, checklist_result_id, log_date
- kind, description, parts, readings, result, completed_at, performed_by, created_at
- RLS hiện thiết kế SELECT + INSERT, không UPDATE/DELETE.
- Thiếu due_date, requested_by, edit_history.
- Mapper chủ động từ chối sync Log có các field thiếu, không âm thầm bỏ dữ liệu.

### Transaction nghiệp vụ
Khi hoàn thành một công việc bảo trì, local UI ghi task đã hoàn thành và tạo maintenance log trong cùng Dexie transaction. Cloud cần bảo đảm hai thay đổi cùng commit hoặc cùng rollback.

## 2. Nguyên tắc

1. Không bỏ dueDate/requestedBy/editHistory khi đồng bộ.
2. Không bật UPDATE trực tiếp cho maintenance_logs chỉ để làm UI sửa được.
3. Giữ nguyên ID nghiệp vụ của Log để liên kết với task/checklist và đồng bộ đa thiết bị.
4. Mỗi lần sửa phải có dấu vết có thể truy vấn, không chỉ lưu một mảng JSON không kiểm soát.
5. Mọi lần tạo/sửa phải idempotent, có actor, thời điểm, mutation_id và change feed.
6. Khi pull về local, tái tạo đúng trạng thái Log mới nhất và lịch sử cần hiển thị.
7. Task completion + Log create phải là một transaction Cloud duy nhất.

## 3. Mô hình đề xuất: Log aggregate + append-only revisions

Giữ `maintenance_logs` làm bản ghi gốc/định danh ổn định:
- id, organization_id, asset_id, task_id, checklist_result_id, created_at

Tạo bảng `maintenance_log_revisions` append-only:
- id UUID (revision ID)
- organization_id
- log_id (FK cùng organization)
- revision_no (1, 2, 3…)
- due_date, log_date, kind, description, parts, readings
- requested_by, result, completed_at, performed_by
- edited_by_user_id (UUID auth user; có thể null cho import legacy có audit nguồn riêng)
- edited_by_label (tên hiển thị tại thời điểm thao tác)
- edit_action (created / updated / completion_reverted / imported)
- mutation_id
- created_at
- unique (organization_id, log_id, revision_no)
- unique (organization_id, mutation_id) hoặc liên kết với ledger chung

Mỗi lần tạo Log:
- Insert root + revision 1 trong cùng transaction.
- Revision 1 giữ snapshot đầy đủ của nội dung ban đầu.

Mỗi lần sửa Log:
1. Xác thực `logs.update` (cần xác nhận permission catalog; hiện mới có logs.view/logs.create).
2. Lock root và revision mới nhất.
3. Kiểm tra expected_revision_no.
4. Insert revision_no + 1, không update revision cũ.
5. Ghi idempotency + change event trong cùng transaction.
6. Trả snapshot revision mới.

Đọc Log:
- Dùng RPC/view đã kiểm soát để trả root cùng revision mới nhất.
- Lịch sử chỉnh sửa lấy toàn bộ revisions theo thứ tự tăng dần.
- Không dùng view SECURITY DEFINER thiếu kiểm soát; phải review RLS và quyền đọc trước khi tạo view.

## 4. Hoàn thành công việc và tạo Log

RPC đề xuất `complete_maintenance_task`:
- Input task_id, expected_task_version, mutation_id, log_id, payload revision 1.
- Kiểm tra membership, `maintenance.update`, `logs.create`, và version.
- Lock task; nếu task đã hoàn thành bởi mutation khác thì trả trạng thái conflict/idempotent phù hợp.
- Cập nhật task status/completed_at.
- Insert maintenance_logs root + revision 1.
- Ghi change event cho task, log root/revision.
- Lưu idempotency result.
- Commit một lần.

Không để frontend gọi update task và insert log bằng hai request độc lập nếu nghiệp vụ yêu cầu atomic như local Dexie transaction.

## 5. Các điểm cần quyết định trước migration

1. Permission: role catalog hiện có `logs.create` nhưng chưa thấy `logs.update`. Ai được sửa phiếu đã tạo? Admin-only hay Technician được sửa phiếu do chính mình tạo? Không tự nâng quyền.
2. Lịch sử: có cần giữ đầy đủ mọi snapshot trước/sau, hay chỉ ghi event/action? Đề xuất giữ revision snapshot để khôi phục/đối chiếu.
3. Xóa phiếu: khuyến nghị không hard-delete; nếu cần hủy thì tạo revision/event trạng thái `cancelled` và lý do, không xóa lịch sử.
4. Legacy: dữ liệu Log local hiện có thể thiếu editHistory đầy đủ. Khi import cần đánh dấu revision `imported`, không bịa lịch sử chỉnh sửa đã không được ghi nhận.
5. Actor: user_id Cloud là nguồn xác thực; label là tên hiển thị snapshot, không dùng label làm căn cứ phân quyền.
6. Task hoàn thành: xác định trường hợp Log độc lập không gắn task và trường hợp phát sinh từ Checklist result.

## 6. Chưa được thực hiện

- Chưa sửa schema/migration, RLS/grants hoặc RPC.
- Chưa sửa local UI/IndexedDB.
- Chưa chạy SQL, không truy vấn hoặc ghi Supabase Test/Production.
- Chưa bật Cloud worker hoặc đồng bộ Log.
- Mapper tiếp tục từ chối các Log có field chưa được schema hỗ trợ.

## 7. Kết luận

Không thể giải quyết đúng bằng cách thêm ba cột vào `maintenance_logs` rồi bật UPDATE: cách đó làm mất mô hình append-only và audit. Cần giữ Log ID ổn định, lưu từng snapshot vào bảng revision append-only, và dùng RPC giao dịch cho sửa phiếu cũng như hoàn thành task + tạo Log.

## 8. Quyết định nghiệp vụ đã được người dùng chốt (19/11/2026)

Trạng thái: **ĐÃ CHỐT**. Nội dung mục này thay thế câu hỏi permission ở mục 5.

### 8.1 Quyền sửa nhật ký đã lưu
- Chỉ Admin được sửa Log đã Cloud commit.
- Technician được tạo Log theo `logs.create`, nhưng không được tạo revision/sửa phiếu đã lưu.
- Không cấp `logs.revise.own` cho Technician.
- Permission catalog cần có permission riêng `logs.revise`, chỉ gán cho role Admin. Không tái sử dụng `logs.create` để cho phép sửa.
- Admin sửa bằng cách thêm revision mới, không UPDATE/DELETE revision cũ; bắt buộc lý do sửa không rỗng.
- Draft chưa gửi Cloud vẫn được người lập chỉnh sửa trong form UI. Draft chưa phải business record và không được ghi IndexedDB business tables trước Cloud confirmation.
- Không hard-delete Log. Nếu cần hủy/đính chính trạng thái, tạo revision/event riêng có action và lý do.

### 8.2 Data model và RPC
- Giữ `maintenance_logs` làm root identity ổn định; thêm `created_by_user_id` bất biến để audit nguồn tạo (legacy import có thể null và phải đánh dấu imported).
- `maintenance_log_revisions` append-only, unique (organization_id, log_id, revision_no), lưu snapshot đầy đủ gồm due_date, requested_by và các trường nghiệp vụ khác hiện bị mapper từ chối.
- Revision 1 được tạo cùng root trong `create_maintenance_log` hoặc `complete_maintenance_task`.
- RPC `revise_maintenance_log`: kiểm tra Auth + active membership + `logs.revise`, lock root/latest revision, so `expected_revision_no`, bắt buộc reason, insert revision tiếp theo, ghi shared receipt/change event cùng transaction.
- RLS/grants không cho client UPDATE/DELETE root/revision hoặc INSERT revision trực tiếp; chỉ RPC được kiểm soát thực hiện.
- Đọc Log trả root + revision mới nhất; lịch sử revisions vẫn truy vấn được theo thứ tự. Pull/change feed phải cho phép người có `logs.view` đọc đúng phạm vi organization.
- `complete_maintenance_task` kiểm tra `maintenance.update` + `logs.create`, cập nhật Task và tạo Log root + revision 1 atomic; việc revise sau đó là mutation riêng với `logs.revise`.

### 8.3 Kiểm thử bắt buộc
- Technician tạo Log: allow; Technician revise Log đã lưu: deny.
- Admin revise: allow; revision_no tăng đúng một, revision cũ không đổi.
- Admin không có active membership hoặc sai organization: deny.
- Thiếu reason, expected revision cũ, mutation ID trùng payload khác: reject/conflict đúng contract.
- Timeout sau commit rồi replay cùng mutation ID: trả revision đã commit, không tạo revision thứ hai.
- Task completion + Log creation rollback cùng nhau khi một bước thất bại.
- Chưa thêm permission/migration hoặc triển khai RPC cho đến khi thiết kế schema/grants và có lệnh triển khai riêng.
