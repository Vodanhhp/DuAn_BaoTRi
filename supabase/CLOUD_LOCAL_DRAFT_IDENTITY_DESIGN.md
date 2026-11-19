# THIẾT KẾ BẢN NHÁP LOCAL VÀ XÁC NHẬN ĐỊNH DANH TRỰC TUYẾN – 18/11/2026

## 1. Quyết định nghiệp vụ đã chốt

- Local là nơi người dùng nhập và lưu dữ liệu nghiệp vụ trước.
- Khi có Internet, ứng dụng phải đồng bộ/đọc trạng thái Cloud mới nhất trước khi chính thức hóa bản ghi mới.
- Khi mất Internet, vẫn cho phép nhập và lưu **bản nháp Local**, nhưng bản nháp chưa có UUID chính thức và chưa có mã quản lý thiết bị chính thức.
- Khi kết nối trở lại, xử lý bản nháp theo thứ tự tạo; sau khi xác nhận dữ liệu mới nhất, ứng dụng tạo UUID chính thức và cấp mã quản lý tại phía ứng dụng Local, rồi đồng bộ bản ghi lên Cloud.
- Cloud không tự tạo thiết bị/vật tư, không cấp mã quản lý và không tự thay UUID. Cloud lưu bản ghi do Local gửi lên, kiểm tra ràng buộc và trả lỗi nếu có xung đột.
- Người thêm là dấu vết lịch sử bất biến: lưu họ tên tài khoản; nếu không có họ tên thì lưu email. Không thay đổi khi người khác sửa hoặc chuyển thiết bị/vật tư.
- Một tài khoản chỉ có tối đa một phiên PC và một phiên Mobile đồng thời. Đăng nhập PC khác vô hiệu phiên PC cũ; Mobile tương tự. Một phiên PC và một phiên Mobile được phép tồn tại đồng thời.

## 2. Phân biệt dữ liệu hiện hữu và bản ghi tạo mới

- Không đổi UUID/mã quản lý của dữ liệu đang có. Các hồ sơ cũ tiếp tục hoạt động như hiện tại.
- Chỉ áp dụng trạng thái bản nháp cho bản ghi mới được tạo khi offline sau khi tính năng được triển khai.
- Không tự động chuyển đổi UUID hiện hữu thành ID tạm.
- Bản nháp Local cần ID tạm không phải UUID database, ví dụ chuỗi có namespace riêng `draft:<random>`. ID này chỉ tồn tại trong IndexedDB và không được gửi lên cột UUID của Cloud.
- Trạng thái đề xuất: `legacy` (bản ghi được tạo trước khi triển khai quy trình draft; giữ nguyên ID/mã hiện hữu), `draft` (chưa chính thức), `ready` (đã có UUID/mã chính thức, chờ đồng bộ), `synced` (Cloud đã xác nhận), `conflict` (có xung đột cần người dùng xử lý). Bản ghi hiện tại và bản ghi mới trong giai đoạn chuyển tiếp được giữ ở trạng thái `legacy`; chỉ chuyển sang `draft/ready/synced/conflict` khi luồng mới được triển khai đầy đủ.

## 3. Luồng tạo thiết bị

### Có Internet
1. Xác nhận phiên đăng nhập còn hiệu lực và tài khoản có quyền tạo.
2. Hoàn tất pull các thay đổi Cloud cần thiết; không được cấp mã dựa trên danh sách Local cũ hoặc một trang dữ liệu chưa tải hết.
3. Kiểm tra cấu hình mã/danh mục cần thiết đã được tải và còn hiệu lực.
4. Ứng dụng Local sinh UUID chính thức bằng bộ sinh UUID hiện có, tạo mã quản lý tiếp theo theo quy ước doanh nghiệp và ghi người thêm.
5. Lưu Local + hàng đợi đồng bộ trong cùng transaction.
6. Gửi bản ghi lên Cloud; Cloud chỉ kiểm tra UUID/mã duy nhất, quyền và idempotency rồi lưu đúng giá trị được gửi. Cloud không sinh lại UUID hoặc mã.
7. Chỉ hiển thị trạng thái đã đồng bộ khi nhận xác nhận đúng bản ghi/mutation từ Cloud.

### Offline
1. Cho phép nhập đủ thông tin thiết bị, lưu ảnh và người thêm tại Local.
2. Dùng ID tạm; để trống UUID chính thức và mã quản lý chính thức.
3. Không đưa bản nháp vào hàng đợi upsert Cloud thông thường; giữ trong hàng đợi chờ chính thức hóa.
4. Khi online, xử lý theo thứ tự tạo, refresh dữ liệu Cloud trước từng lượt cấp mã, sau đó chính thức hóa và đưa vào hàng đợi đồng bộ.

## 4. Luồng tạo vật tư

- Áp dụng cùng nguyên tắc ID tạm/UUID chính thức và người thêm bất biến.
- Cần phân biệt rõ mã vật tư nghiệp vụ hiện do người dùng nhập với UUID nội bộ. Không tự ý biến mã vật tư người dùng nhập thành mã do Cloud cấp.
- Nếu mã vật tư hiện đang được nhập thủ công, khi offline có thể lưu bản nháp với mã người dùng nhập; khi online phải kiểm tra trùng trước khi chính thức hóa. Nếu mã vật tư sẽ được tự cấp trong tương lai, phải có quyết định riêng về quy tắc mã trước khi triển khai.

## 5. Quan hệ dữ liệu và chuyển ID tạm

ID thiết bị/vật tư có thể đang được tham chiếu bởi bản ghi con. Vì vậy khi bản nháp chuyển sang UUID chính thức, không được chỉ đổi khóa ở bảng cha.

Trước khi triển khai phải lập đầy đủ dependency map và thực hiện trong một transaction Dexie:
- Asset: cập nhật `assetId` ở Tasks, Maintenance Plans, Logs, Checklist Templates, Checklist Versions, Checklist Results và các bảng liên quan.
- Inventory: cập nhật `itemId` ở Movements.
- Cập nhật `recordId` trong syncQueue và mọi khóa/phụ thuộc khác có liên quan.
- Bảo toàn ID riêng của bản ghi con, nội dung, lịch sử Checklist, lịch sử bảo trì, ảnh và timestamps.
- Chỉ sau khi mọi tham chiếu được chuyển thành công mới xóa/đánh dấu bản nháp ID cũ.
- Nếu transaction thất bại, rollback toàn bộ; không để một phần quan hệ dùng ID tạm và một phần dùng UUID chính thức.

Không cho đồng bộ bản ghi con lên Cloud trước khi bản ghi cha có UUID chính thức và đã được Cloud xác nhận.

## 6. Người thêm – dữ liệu lịch sử

Đề xuất trường Local cho Asset và Inventory:
- `createdByLabel`: họ tên tài khoản tại thời điểm tạo; fallback email.
- `createdByUserId`: UUID Auth nếu có, để truy vết tài khoản; không thay thế nhãn hiển thị.
- Giá trị được chụp một lần khi bắt đầu tạo bản ghi, không lấy động từ profile ở mỗi lần mở hồ sơ.
- Không cho biểu mẫu sửa trường này.
- Cloud cần cột tương ứng và chính sách chỉ ghi từ luồng tạo/import được phép. Không dùng `updated_by` làm thay thế người tạo.

## 7. Hàng đợi và thứ tự

- Bản nháp offline có hàng đợi riêng hoặc trạng thái riêng; không được gửi lên RPC/table Cloud khi còn ID tạm.
- Xử lý FIFO theo `createdAt`/thứ tự hàng đợi; retry cùng mutation ID phải idempotent.
- Không đánh dấu hoàn tất trước khi Cloud xác nhận.
- Lỗi mạng giữ nguyên bản nháp; lỗi trùng mã/UUID chuyển trạng thái conflict và hiển thị cảnh báo.
- Người tạo xem danh sách conflict, kiểm tra hai tình huống: hai thiết bị thực sự khác nhau nhưng trùng mã do dữ liệu/cấp mã, hoặc người dùng nhập cùng một thiết bị hai lần. Không tự xóa, không tự đổi mã và không tự gộp.
- Nếu hai hồ sơ là hai thiết bị riêng, người dùng phải có quy trình sửa mã có audit; nếu là cùng một thiết bị nhập hai lần, người dùng chọn hồ sơ cần giữ và xử lý hồ sơ trùng theo quy trình xóa/huỷ có kiểm soát.

## 8. Đồng thời PC và Mobile – điểm kỹ thuật phải bảo vệ

Chính sách một PC + một Mobile ngăn hai phiên cùng nền tảng, nhưng vẫn cho phép PC và Mobile hoạt động cùng lúc. Hai trình duyệt có IndexedDB riêng, nên cả hai có thể đọc cùng một snapshot cũ trước khi bản ghi bên kia đồng bộ.

Vì vậy, quy trình online phải:
- Pull hết dữ liệu liên quan trước khi cấp mã; không chỉ lấy một trang hoặc chỉ đọc Local.
- Đồng bộ ngay bản ghi chính thức sau khi tạo.
- Cloud có unique constraint cho `(organization_id, code)` và `(organization_id, id)`; khi vi phạm, từ chối và trả conflict, không cấp lại mã.
- Client refresh lại dữ liệu sau conflict và đưa người tạo vào luồng xác minh.
- Không tuyên bố chống trùng tuyệt đối chỉ nhờ chênh lệch thời gian. Nếu về sau cần bảo đảm tuyệt đối khi PC và Mobile cùng tạo liên tiếp/race, cần cơ chế reservation/lock số thứ tự; cơ chế đó phải được thiết kế riêng và được người dùng chấp thuận vì Cloud hiện được xác định chỉ là nơi lưu trữ/kiểm tra, không phải bộ cấp mã.

## 9. Phiên đăng nhập theo nền tảng

- Nhận diện phiên PC và Mobile riêng; mỗi user chỉ có một session active cho mỗi platform.
- Login mới cùng platform phải vô hiệu session cũ bằng server-side session registry/lease và cơ chế client lắng nghe bị thu hồi để signOut.
- Không chỉ dựa vào localStorage hoặc một cờ phía trình duyệt; chúng không thể vô hiệu phiên ở máy khác một cách tin cậy.
- Một PC và một Mobile cùng user vẫn được phép hoạt động.
- Cần xử lý mất mạng/lease hết hạn, refresh token, đóng trình duyệt và đăng nhập lại; không tự đăng xuất platform còn lại.
- Đây là thiết kế, chưa triển khai Auth/session registry.

## 10. Tác động đến thiết kế Cloud cũ

- Migration `20261117001200_asset_code_allocator_rpc.sql` và `create_asset_with_code` đã tồn tại trong repository, nhưng cách dùng Cloud RPC để tự cấp mã không còn phù hợp với quyết định nghiệp vụ mới cho luồng tạo thông thường.
- Không xóa migration đã có hoặc sửa lịch sử migration. Trước khi áp dụng kiến trúc mới, cần đánh giá migration đã chạy ở Test/Production chưa và xử lý tương thích bằng migration tiến về phía trước nếu cần.
- RPC import/insert trong tương lai phải nhận UUID và mã do Local đã chính thức hóa, validate quyền, unique, idempotency và lưu đúng dữ liệu gửi lên; không tự đổi identity.
- Chưa có SQL, migration, RPC, UI hoặc thay đổi dữ liệu nào được triển khai trong tài liệu này.

## 11. Trình tự triển khai an toàn

1. Hoàn thiện dependency map và rà soát mọi chỗ giả định ID luôn là UUID.
2. Thiết kế type/field cho draft identity, status, createdByLabel và createdByUserId.
3. Viết unit tests cho chuyển ID cha-con và rollback transaction.
4. Triển khai Local draft flow cho Asset trước; kiểm thử offline/online, ảnh, QR, Checklist, Task, Plan, Log và backup/restore.
5. Triển khai tương tự cho Inventory và Movements.
6. Thiết kế Cloud receive/validation và unique conflict; chưa ghi Cloud cho đến khi contract và migration được duyệt.
7. Thiết kế session registry một PC + một Mobile; kiểm thử hai trình duyệt/máy thật.
8. Chỉ sau khi các test Local đạt mới bật đồng bộ trên Test. Không tác động Production khi chưa có chấp thuận riêng.

## 12. Trạng thái

Đã chốt nguyên tắc nghiệp vụ và ghi nhận thiết kế. Chưa sửa mã nguồn, chưa chạy migration/SQL, chưa gọi RPC và chưa ghi dữ liệu Supabase. Các bước tiếp theo là dependency audit và unit test thiết kế trước khi thay đổi luồng tạo mới.
