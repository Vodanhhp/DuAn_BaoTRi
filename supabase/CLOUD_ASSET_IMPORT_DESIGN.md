# THIẾT KẾ RPC IMPORT THIẾT BỊ TỪ DỮ LIỆU LOCAL – 18/11/2026

## 1. Mục tiêu và phạm vi

Khi chuyển dữ liệu từ IndexedDB sang Supabase, hồ sơ thiết bị phải được nhập mà không làm thay đổi:
- UUID nội bộ `assets.id`.
- Mã quản lý `assets.code` đang được in trên tem và dùng làm payload QR.
- Các trường mô tả, trạng thái, chu kỳ và mốc thời gian hiện có.

Đây là luồng **import dữ liệu đã tồn tại**, không phải luồng tạo thiết bị mới. Không sửa `create_asset_with_code` để nhận mã tùy ý; RPC đó tiếp tục là allocator dành cho thiết bị mới.

## 2. Cơ sở schema đã kiểm tra

- `assets.id` là UUID primary key; `(organization_id, id)` unique.
- `(organization_id, code)` có unique constraint; mã không được rỗng.
- Migration 012 thu hồi INSERT trực tiếp vào `assets` và cấp `create_asset_with_code` để tạo mã theo cấu hình doanh nghiệp.
- `create_asset_with_code` nhận được `p_id` nhưng tự sinh `code`; vì vậy không đáp ứng yêu cầu giữ nguyên mã quản lý của hồ sơ local.
- `organization_settings.asset_categories` lưu cây danh mục tùy chỉnh dạng JSON array.
- `organization_settings.asset_code_config` lưu cấu hình sinh mã: facility_code, category_codes và location_codes. Hai trường này khác nghiệp vụ, không được gộp hoặc ghi đè lẫn nhau.
- QR hiện dùng trực tiếp mã quản lý; đổi mã trong lúc import sẽ khiến tem QR đã in không còn khớp.

## 3. Hợp đồng RPC đề xuất

Tên tạm: `import_asset_preserving_identity`.

Đầu vào:
- `p_organization_id`
- `p_id`: UUID gốc từ IndexedDB.
- `p_code`: mã quản lý gốc.
- Các trường Asset được allowlist rõ ràng: name, category, brand, model, serial, location, commissioned_at, power, cycle, cycle_started_at, transferred_from_other_facility, status, notes, archived_at, created_at, updated_at.
- `p_mutation_id`: khóa idempotency cho lần import.

Không nhận JSON tùy ý rồi ghép động tên bảng/cột. Không nhận `organization_id`, UUID hoặc mã từ client mà bỏ qua kiểm tra.

## 4. Kiểm tra quyền và tính hợp lệ

RPC phải:
1. Bắt buộc `auth.uid()` khác null.
2. Xác nhận tài khoản là thành viên active của đúng organization.
3. Yêu cầu quyền riêng `assets.import` (Admin-only), không mặc định coi `assets.create` là quyền import.
4. Kiểm tra UUID hợp lệ; mã, tên và nhóm thiết bị không rỗng; trạng thái thuộc tập giá trị schema cho phép.
5. Kiểm tra các ngày và giá trị boolean đúng kiểu; chuẩn hóa chuỗi theo quy tắc đã chốt nhưng tuyệt đối không tự viết lại mã quản lý.
6. Kiểm tra trùng `(organization_id, id)` và `(organization_id, code)`.
7. Không cho import một UUID đã tồn tại với payload khác; không ghi đè hồ sơ Cloud.
8. Không cho cùng một mutation ID được tái sử dụng cho asset, actor hoặc payload khác.

Nếu UUID đã tồn tại và payload canonical giống hoàn toàn, trả kết quả idempotent đã lưu; nếu khác, trả conflict để người vận hành xử lý, không tự chọn bản mới hơn.

## 5. Bảo vệ bộ cấp mã

Import phải giữ nguyên mã cũ nhưng không được làm bộ cấp mã tạo ra mã trùng về sau.

- Phân tích prefix nhóm và sequence của mã theo quy ước đang dùng.
- Khóa cùng hàng counter `(organization_id, category_code)` mà allocator sử dụng; bảo đảm import và tạo mới không chạy đua.
- Sau khi kiểm tra định dạng và cấu hình, nâng `last_value` ít nhất đến sequence lớn nhất đã import.
- `create_asset_with_code` vẫn phải kiểm tra max hiện có như hiện tại; counter không được giảm.
- Mã lịch sử không khớp cấu hình hiện hành không được tự sửa. Đưa vào danh sách cần rà soát thủ công; không tự suy diễn category code hoặc facility code.

Unique constraint của bảng là lớp bảo vệ cuối cùng. Nếu phát hiện trùng mã, transaction import phải rollback cho bản ghi đó và trả lỗi có thể xử lý.

## 6. Idempotency và transaction

- Ghi ledger idempotency cùng transaction với insert Asset và cập nhật counter.
- Cùng mutation ID + actor + operation + UUID + payload hash: trả lại kết quả đã ghi.
- Cùng mutation ID nhưng payload khác: từ chối.
- Không được cấp counter rồi commit riêng trước khi insert asset.
- Import theo từng asset hoặc lô nhỏ có checkpoint; lỗi một bản ghi không được làm mất trạng thái xác nhận của các bản ghi đã import trước đó.
- Mỗi bản ghi chỉ được đánh dấu hoàn tất ở local sau khi server xác nhận đúng mutation ID và UUID.

## 7. Thứ tự import và quan hệ phụ thuộc

1. Kiểm kê, chọn một bản backup nguồn sau khi đối chiếu desktop/mobile; giữ nguyên file gốc.
2. Khởi tạo cấu hình tổ chức và danh mục tùy chỉnh riêng; không lấy dữ liệu từ backup khác để ghi đè âm thầm.
3. Import Assets trước.
4. Sau khi xác nhận đầy đủ UUID + code, mới import Tasks/Plans, Checklist templates, template versions, Checklist results, Logs và ảnh.
5. Các bản ghi con phải giữ nguyên FK UUID local; nếu thiếu cha thì dừng bản ghi con và báo lỗi tham chiếu.
6. Inventory và movements theo RPC nghiệp vụ riêng, không gộp vào import Asset.

Không chọn desktop hoặc mobile làm nguồn chuẩn cho đến khi người dùng quyết định. Không merge hai backup tự động vì cùng một thiết bị có thể có UUID khác nhau giữa hai browser.

## 8. QR và UUID

- Payload QR tiếp tục là mã quản lý, không phải UUID.
- UUID chỉ là khóa nội bộ và được bảo toàn trong quá trình import.
- Không tạo UUID mới, không đổi code, không in UUID lên tem.
- Khi quét QR, ứng dụng tra cứu theo mã quản lý trong organization hiện hành và vẫn phải áp dụng xác thực/phân quyền.

## 9. Kiểm thử bắt buộc trước khi áp dụng

- Import một Asset mới giữ nguyên UUID và code.
- Retry cùng mutation ID sau khi thành công: không tạo bản ghi/counter lần hai.
- Cùng mutation ID nhưng payload khác: bị từ chối.
- Trùng UUID với payload khác: conflict, không ghi đè.
- Trùng code nhưng UUID khác: unique conflict, không ghi đè.
- Import mã lịch sử hợp lệ và nâng counter; tạo mới sau import không trùng sequence.
- Chạy đồng thời import và create_asset_with_code cùng category: không trùng mã.
- Người không có assets.import, membership suspended, anon và organization khác đều bị chặn.
- Rollback khi insert/counter/ledger lỗi; không để counter hoặc ledger lệch.
- Import Asset có archived_at, trạng thái Thanh lý và transferred_from_other_facility mà không làm mất dữ liệu.
- Kiểm tra FK của tất cả bảng con sau import.

## 10. Trạng thái triển khai – 18/11/2026

Đã tạo mã nguồn triển khai trên nhánh `main`, chưa áp dụng SQL vào bất kỳ Supabase Project nào:

- Migration: `20261118000100_asset_import_preserving_identity.sql`.
- Test SQL: `20261118000100_asset_import_preserving_identity_test.sql`.
- RPC: `public.import_asset_preserving_identity(uuid, uuid, text, jsonb, uuid)`.
- Quyền riêng `assets.import`: chỉ gán cho role hệ thống `admin`; không gộp với `assets.create`.
- Ledger `asset_import_mutations`: lưu actor, UUID thiết bị, payload canonical và kết quả để chống chạy lặp/đổi payload.
- RPC kiểm tra active membership và permission qua `has_org_permission`, không cho ghi đè hồ sơ Cloud, giữ nguyên UUID/mã, và chỉ cập nhật counter khi mã khớp cấu hình nhóm hiện hành.
- Counter được khóa/đối chiếu trước insert để tuần tự hóa với `create_asset_with_code`.
- UI PC gọi RPC từng thiết bị sau xác nhận; mutation ID ổn định bằng UUID thiết bị. Nếu lô bị gián đoạn, lần chạy lại sẽ nhận diện các bản ghi đã nhập chính xác.
- UI preflight so sánh toàn bộ payload; nếu cùng UUID/mã nhưng nội dung khác thì dừng, không ghi đè.
- Ảnh vẫn không được tải lên Storage; không import vật tư, queue hoặc phân hệ khác.

**Trạng thái kiểm thử:** file test đã bao gồm bảo toàn UUID/mã, dữ liệu lưu kho/trạng thái/chuyển cơ sở, retry idempotent, payload conflict, trùng mã, quyền Admin/Technician/Viewer, user không có membership, anon và bộ cấp mã sau import. Chưa chạy test SQL trên BAOTRI-Mini-Test vì chưa có kết nối Supabase được cấp trong phiên này.

**Bước tiếp theo:** kiểm tra GitHub Actions build; sau khi build đạt, người vận hành chạy migration và test SQL trên `BAOTRI-Mini-Test`, gửi kết quả để rà soát. Không áp dụng Production và không import 45 thiết bị cho đến khi Test PASS và người dùng xác nhận bước import.
