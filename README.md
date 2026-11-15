# BAOTRI PWA – bản nền 0.1

Đây là bộ khung khởi đầu cho phần mềm quản lý bảo trì theo yêu cầu đã thống nhất.

## Có sẵn trong bản 0.1
- Giao diện responsive cho máy tính và điện thoại.
- PWA cơ bản, có thể cài như ứng dụng.
- Dữ liệu cục bộ bằng IndexedDB/Dexie.
- Danh mục thiết bị, tạo QR, quét QR.
- Kho vật tư, nhập/xuất và cảnh báo tồn tối thiểu.
- Kế hoạch/công việc bảo trì, checklist và thông số.
- Nhật ký bảo trì khi đánh dấu hoàn thành.
- Xuất Excel cho thiết bị, kho, kế hoạch và nhật ký.
- Sao lưu/khôi phục JSON.
- Dữ liệu mẫu demo để mở lên có thứ để xem.

## Chưa có trong bản 0.1
- Chưa có tài khoản, Supabase hoặc dữ liệu cloud.
- Chưa có đồng bộ máy tính/điện thoại.
- Chưa có phân tách tenant.
- Chưa tự sinh lịch bảo trì định kỳ theo chu kỳ; hiện tại tạo từng công việc.
- Chưa có biểu mẫu PDF tùy biến.
- Chưa có upload ảnh/tệp thực tế trong hồ sơ.
- QR hiện chứa mã thiết bị, luồng quét tra mã thiết bị.
- Chưa dùng cho hồ sơ bảo trì chính thức hoặc môi trường an toàn trọng yếu.

## Chạy trên Windows
1. Cài Node.js bản LTS: https://nodejs.org/
2. Giải nén thư mục.
3. Mở thư mục `baotri-pwa` bằng VS Code.
4. Mở Terminal trong VS Code và chạy:

```bash
npm install
npm run dev
```

5. Mở địa chỉ Vite in ra, thường là `http://localhost:5173`.

## Build để đưa lên GitHub Pages hoặc hosting
```bash
npm run build
```
Bản build nằm trong thư mục `dist`.

Lưu ý: deploy dưới đường dẫn con của GitHub Pages có thể cần cấu hình `base` trong `vite.config.ts`. Nếu dùng tên miền riêng hoặc hosting gốc thì cấu hình mặc định phù hợp hơn.

## Dữ liệu
Dữ liệu đang lưu trong IndexedDB của trình duyệt hiện tại. Dùng mục Cài đặt > Sao lưu thường xuyên. Xóa dữ liệu trình duyệt có thể làm mất dữ liệu cục bộ nếu chưa sao lưu.

## Hướng phát triển kế tiếp
1. Chốt nghiệp vụ và chuẩn hóa biểu mẫu.
2. Bổ sung lịch bảo trì định kỳ tự sinh.
3. Bổ sung hồ sơ thiết bị chi tiết và lịch sử sửa chữa/thay thế.
4. Thiết kế Supabase/PostgreSQL, tenant_id, auth và quyền truy cập.
5. Xây dựng sync engine hai chiều có xử lý xung đột và kiểm thử.
