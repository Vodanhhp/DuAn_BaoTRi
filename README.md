# BAOTRI Mini

BAOTRI Mini là ứng dụng quản lý bảo trì theo hướng **Local-first**: nghiệp vụ hằng ngày được thao tác trên dữ liệu cục bộ của thiết bị; Cloud là lớp tài khoản, tổ chức, phân quyền và lưu trữ/đồng bộ những phân hệ đã được triển khai có kiểm soát.

## Trạng thái sản phẩm

### Chức năng Local hiện có
- Dashboard và quản lý danh mục thiết bị.
- Hồ sơ thiết bị, mã quản lý, QR tạo/quét, lưu kho và khôi phục.
- Kho vật tư: danh mục, nhập – xuất – tồn, cảnh báo tồn tối thiểu.
- Kế hoạch bảo trì, công việc, checklist theo chu kỳ, kết quả checklist.
- Nhật ký bảo trì và báo cáo.
- Xuất Excel, sao lưu và khôi phục dữ liệu JSON.
- Lưu dữ liệu bằng IndexedDB (Dexie), giao diện responsive và PWA có thể cài đặt.

### Phân hệ Cloud đã triển khai
- Đăng nhập Supabase bằng tài khoản được cấp sẵn; không mở đăng ký tự do.
- Tổ chức và phân quyền theo membership/permission.
- Quản lý Asset Cloud theo phạm vi tổ chức.
- Tạo mã thiết bị qua RPC; nhập Asset Local có giữ nguyên UUID/mã khi được phép.
- Sửa hồ sơ Asset, lưu kho/khôi phục thông qua RPC có Lease khóa chỉnh sửa.
- Có kiểm soát payload, idempotency/Receipt riêng cho luồng cập nhật Asset.
- Local và Cloud không được xem là đã đồng bộ toàn bộ chỉ vì Asset Cloud hoạt động.

### Phần chưa nghiệm thu / chưa bật đồng bộ đại trà
- Inventory Cloud chưa có đầy đủ RPC giao dịch nhập, xuất, điều chỉnh và Receipt/change-feed tương ứng. Không ghi Movement trực tiếp lên Cloud.
- Task, kế hoạch, checklist và nhật ký chưa có đầy đủ business RPC/contract để đồng bộ an toàn toàn bộ dữ liệu.
- Một số trường nhật ký Local chưa có cột tương ứng trong schema Cloud; ứng dụng chủ động từ chối đồng bộ để tránh làm mất dữ liệu.
- Ảnh/tệp trong hồ sơ thiết bị vẫn là dữ liệu Local; chưa có luồng Storage hoàn chỉnh.
- M021 Asset lock-anchor retrofit vẫn là draft; chưa được coi là migration đã triển khai. Kiểm thử hai phiên vật lý còn là cổng bắt buộc.
- Chưa nghiệm thu phát hành Production. BAOTRI-Mini-Test là môi trường kiểm thử; Production nằm ngoài phạm vi các thay đổi hiện tại.

### Lưu ý về module đồng bộ cũ

- `src/lib/cloudSync.ts` là giao thức JSON cũ dùng bảng `maintenance_records`; tìm kiếm trên nhánh `main` hiện chỉ thấy định nghĩa `syncLocalDatabase()`, chưa thấy nơi gọi từ ứng dụng. Không kích hoạt hoặc tích hợp module này vào luồng đồng bộ hiện tại. Luồng Cloud phải tiếp tục dùng các contract/RPC đã được triển khai và kiểm thử theo từng phân hệ.

## Kiến trúc và nguyên tắc dữ liệu

1. **Local là nơi thao tác nghiệp vụ** và phải tiếp tục sử dụng được khi mất Internet.
2. **Cloud không tự sinh dữ liệu nghiệp vụ Local**. Với Asset, định danh được tạo theo luồng được kiểm soát và ánh xạ về Local.
3. Chỉ đồng bộ những phân hệ đã có schema, quyền, RPC và kiểm thử đầy đủ. Không bật full sync hoặc đẩy toàn bộ IndexedDB lên Cloud.
4. Không bỏ qua trường dữ liệu Local mà schema Cloud chưa hỗ trợ; phải giữ Local và báo rõ.
5. Các mutation quan trọng cần kiểm tra quyền ở máy chủ, transaction và cơ chế retry/idempotency phù hợp.
6. Migration đã áp dụng không được sửa lịch sử; thay đổi schema phải đi bằng migration mới và được kiểm tra trên Test trước.

## Công nghệ

- React + TypeScript + Vite
- IndexedDB qua Dexie
- Supabase Auth + PostgreSQL + RLS/RPC
- PWA qua vite-plugin-pwa
- ExcelJS, QRCode và html5-qrcode

## Chạy trên máy phát triển

Yêu cầu Node.js LTS.

```bash
npm install
```

Tạo file `.env.local` ở thư mục gốc:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Chạy ứng dụng:

```bash
npm run dev
```

Chạy kiểm tra:

```bash
npm run test:sync-mapping
npm run test:local-identity
npm run test:template-release
npm run build
```

Build production nằm trong thư mục `dist`.

## Tài liệu kỹ thuật

- Kế hoạch schema/RPC: `supabase/CLOUD_FIRST_SCHEMA_MIGRATION_PLAN.md`
- Review nền tảng và các draft: `supabase/CLOUD_FOUNDATION_DRAFTS_REVIEW.md`
- Thiết kế sửa lỗi payload Asset: `supabase/docs/ASSET_MUTATION_PAYLOAD_VALIDATION_FIX_DESIGN.md`
- Các SQL chưa triển khai nằm trong `supabase/drafts/`; phải đọc trạng thái từng file trước khi thực hiện. Draft không phải migration đã áp dụng.

## Nguyên tắc phát hành

- Kiểm tra build và test tự động.
- Kiểm thử nghiệp vụ Local và Cloud theo từng phân hệ.
- Kiểm tra offline/online, khôi phục sau timeout và dữ liệu sau đồng bộ.
- Chỉ promote migration sau khi review và test trên BAOTRI-Mini-Test đạt.
- Production chỉ là bước triển khai riêng sau nghiệm thu.
