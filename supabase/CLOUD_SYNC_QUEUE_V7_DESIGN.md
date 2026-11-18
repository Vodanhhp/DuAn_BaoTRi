# BAOTRI Mini – Thiết kế hàng đợi đồng bộ an toàn (Dexie v7 – bản review)

**Ngày:** 18/11/2026  
**Trạng thái:** Thiết kế, chưa triển khai migration Dexie, chưa chạy worker và chưa ghi Cloud.  
**Mục tiêu:** Không làm mất mutation khi người dùng tiếp tục sửa cùng bản ghi trong lúc một mutation trước đang được gửi.

## 1. Vấn đề đã phát hiện ở hàng đợi v6

Hiện tại `syncQueue` dùng khóa duy nhất `[tableName+recordId]`, ID dạng `tableName:recordId`. Hàm `queueChange()` luôn ghi đè mục cũ, đặt lại `status = pending` và tạo `mutationId` mới.

Điều này phù hợp để gộp nhiều thay đổi khi tất cả còn pending và chưa có worker. Nhưng nếu worker trong tương lai đã đọc/claim mutation A và gửi request, trong lúc request đang chạy người dùng sửa cùng bản ghi tạo mutation B, `queueChange()` có thể ghi đè dòng A. Khi server xác nhận A, worker có thể xóa/đánh dấu nhầm B hoặc không còn đủ dữ liệu để retry A. Chỉ dùng trạng thái `processing` không giải quyết được race này.

**Kết luận:** Không triển khai worker trên cấu trúc queue v6 hiện tại. Giữ nguyên v6 cho tới khi thiết kế v7 được duyệt và có migration/test riêng.

## 2. Mô hình đề xuất

Tách danh tính mutation khỏi danh tính bản ghi:

- Mỗi mutation có ID riêng, dùng `mutationId` làm khóa ổn định; không tái sử dụng ID khi retry.
- Mỗi mutation lưu `tableName`, `recordId`, `operation`, `deviceId`, `createdAt`, `status`, `attempts`, `lastError`, `lastAttemptAt`.
- Lưu `baseVersion` (phiên bản Cloud đã đọc trước khi sửa) và snapshot payload bất biến của mutation, hoặc một tham chiếu snapshot đủ để tái tạo đúng payload sau reload.
- Có thể gộp các mutation **pending chưa claim** của cùng bản ghi đối với bảng master dạng trạng thái hiện tại. Không bao giờ sửa mutation đã chuyển sang processing/sent.
- Mutation mới phát sinh khi mutation cũ đang processing phải tạo một queue row mới, giữ nguyên mutationId mới và baseVersion thích hợp. Không ghi đè row đang xử lý.

Index gợi ý:
- Primary key: `mutationId`.
- Index phục vụ quét: `status + createdAt`.
- Index tra theo bản ghi: `tableName + recordId + createdAt`.
- Không đặt unique constraint toàn cục trên `tableName + recordId`, vì một bản ghi có thể có một mutation processing và một mutation pending kế tiếp.

## 3. Claim, gửi và xác nhận

1. Trong một Dexie read-write transaction, chọn mutation pending, kiểm tra thứ tự phụ thuộc và chuyển nó sang processing với `claimToken` + `claimedAt`.
2. Đóng băng snapshot, mutationId và baseVersion đã claim. Không đọc lại payload mới nhất rồi gán cho mutation cũ.
3. Gửi cùng mutationId cho mọi lần retry của request đó.
4. Server xử lý idempotency ledger và thay đổi nghiệp vụ trong cùng transaction PostgreSQL. Cùng mutationId + cùng payload hash trả lại kết quả cũ; cùng mutationId nhưng payload hash khác phải báo lỗi nghiêm trọng và không thực thi lần hai.
5. Khi xác nhận, chỉ cập nhật/xóa đúng queue row theo mutationId + claimToken. Không được xóa queue row mới hơn chỉ vì recordId giống nhau.
6. Nếu có mutation pending kế tiếp cho cùng bản ghi, mutation này phải dùng baseVersion là version trả về sau khi mutation trước thành công.
7. Nếu request timeout, giữ nguyên mutationId, payload snapshot và baseVersion; retry an toàn. Nếu server đã commit nhưng response thất lạc, idempotency ledger trả lại kết quả trước đó.

## 4. Quy tắc theo loại dữ liệu

- **Master data có thể sửa** (assets, inventory metadata, tasks, plans, checklist template): có thể coalesce các thay đổi pending chưa claim; dùng optimistic concurrency qua row_version. Mutation processing là bất biến.
- **Append-only history** (checklist versions, checklist results, maintenance logs, inventory movements): không coalesce và không update/delete lịch sử. Mỗi sự kiện có mutationId riêng; movement chỉ qua RPC transaction.
- **Delete:** tạo tombstone mutation riêng. Không xóa cứng queue hoặc bản ghi Cloud trước khi server xác nhận. Delete và upsert cùng record phải được sắp thứ tự; nếu pending upsert chưa claim rồi user xóa, có thể coalesce thành delete theo quy tắc đã test. Nếu upsert đã processing, delete phải là mutation kế tiếp.
- **Restore/undo:** là mutation mới có quan hệ với tombstone; không tái sử dụng mutationId cũ.

## 5. Phiên bản và xung đột

- `baseVersion` là phiên bản server đã đọc tại thời điểm bắt đầu chỉnh sửa, không phải thời gian local.
- Server chỉ chấp nhận update khi `row_version = baseVersion`; thành công tăng version đúng một lần.
- Nếu mismatch, trả conflict kèm server snapshot và version hiện tại. Không tự chọn local/cloud theo đồng hồ.
- Sau conflict, dừng mutation đó và giữ local + server snapshot để người dùng xử lý. Mutation kế tiếp của cùng bản ghi không được vượt qua mutation đang conflict.
- Không cho pull ghi đè bản ghi đang có mutation pending/processing/conflict.

## 6. Migration và kiểm thử bắt buộc trước worker

Migration Dexie v7 phải:
- Không xóa hoặc sửa các bảng nghiệp vụ.
- Chuyển queue v6 sang định dạng mới theo cách bảo toàn operation, queuedAt, deviceId, mutationId, attempts và lỗi.
- Với mỗi queue row v6, tạo một mutation v7 tương ứng; không tự tạo thêm mutation lịch sử không có căn cứ.
- Có rollback/backup hướng dẫn và test migration từ DB v6 thực tế.

Bộ test tối thiểu:
1. Gộp nhiều thay đổi khi tất cả pending thành một mutation pending đúng.
2. Claim A, sửa bản ghi tạo B: A không đổi; B tồn tại riêng.
3. Xác nhận A chỉ xóa A, không xóa B.
4. Timeout sau server commit rồi retry cùng mutationId không nhân đôi.
5. Cùng mutationId nhưng payload hash khác bị từ chối.
6. Hai tab cùng claim không thể gửi cùng mutation hai lần ngoài cơ chế idempotency.
7. Mutation processing bị crash/restart được khôi phục mà không đổi mutationId/payload.
8. Conflict của A chặn mutation kế tiếp cùng record.
9. Append-only rows không bị coalesce.
10. Delete/upsert/restore giữ đúng thứ tự và tombstone.

## 7. Phạm vi chưa được phép thực hiện

Tài liệu này không phải lệnh chạy migration. Chưa thay đổi Dexie v6, chưa tạo worker, chưa gọi Supabase, chưa chạy SQL, chưa thay đổi BAOTRI-Mini-Test hoặc Production. Việc triển khai v7 chỉ bắt đầu sau khi review thiết kế, chuẩn bị test migration và có thể kiểm tra trên bản sao dữ liệu local; Production luôn nằm ngoài phạm vi.
