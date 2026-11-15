# QUY ƯỚC MÃ ĐỊNH DANH THIẾT BỊ BAOTRI

## 1. Cấu trúc mã

```
ABC-ABXY-xxx-BB-MM-YY
```

Mã gồm 6 thành phần, phân tách bằng dấu gạch ngang:

| Thành phần | Ý nghĩa | Quy ước / ví dụ |
|---|---|---|
| ABC | Mã viết tắt tên thiết bị / loại thiết bị | Quạt Lạnh = QL; Quạt Cắt Gió = QCG; Tủ Lạnh = TL |
| ABXY | Mã số đơn vị sử dụng | Ví dụ một công ty có hai đơn vị: HP01 và HP02 |
| xxx | Số thứ tự của thiết bị đó | Đánh số theo cùng một loại thiết bị trong công ty |
| BB | Mã vị trí đặt thiết bị trong công ty | Quy ước theo công ty hoặc phân xưởng; đánh số thứ tự và có thể sửa đổi sau |
| MM | Tháng đưa thiết bị vào sử dụng | Tháng, gồm 2 chữ số |
| YY | Năm đưa thiết bị vào sử dụng | Năm, gồm 2 chữ số |

## 2. Diễn giải theo quy ước người dùng cung cấp

- **ABC:** tên viết tắt của thiết bị/loại thiết bị. Ví dụ: Quạt Lạnh là QL, Quạt Cắt Gió là QCG, Tủ Lạnh là TL.
- **ABXY:** mã số đơn vị sử dụng thiết bị. Ví dụ công ty có hai đơn vị là HP01 và HP02.
- **xxx:** số thứ tự của thiết bị cùng một loại trong công ty. Độ dài có thể tăng theo số lượng thực tế; ví dụ 001, 002, ... 999, 1000. Không giới hạn cứng ở 3 chữ số.
- **BB:** mã vị trí đặt thiết bị trong công ty hoặc phân xưởng. Mã vị trí được quy ước riêng theo từng công ty/phân xưởng, có thể điều chỉnh sau.
- **MM:** tháng đưa thiết bị vào sử dụng.
- **YY:** năm đưa thiết bị vào sử dụng.

## 3. Lưu ý khi triển khai trong BAOTRI

- Phải giữ đúng thứ tự 6 thành phần và dấu phân cách như cấu trúc đã thống nhất.
- Mã loại thiết bị (ABC), mã đơn vị (ABXY) và mã vị trí (BB) cần được quản lý bằng danh mục/quy ước có thể cấu hình, tránh hard-code cố định.
- Khi thiết kế chức năng tạo mã tự động, cần bảo đảm số thứ tự `xxx` không bị trùng trong phạm vi cùng loại thiết bị của cùng công ty.
- Mã định danh cần được lưu ổn định. Nếu thiết bị đổi vị trí hoặc đổi đơn vị quản lý, cần có quy tắc xử lý riêng trước khi tự động thay đổi mã cũ.
- `xxx` dùng tối thiểu 3 chữ số để mã ngắn gọn và đồng nhất ở quy mô nhỏ; khi vượt 999 thì tăng tự nhiên thành 1000, 1001... Không cắt số hoặc quay vòng về 001.
- Cách xử lý khi chuyển đơn vị/vị trí, và việc mã có được thay đổi sau khi cấp hay không sẽ được chốt tiếp với người dùng; không tự suy diễn thành quy định chính thức.

## 4. Trạng thái

Đây là quy ước do người dùng cung cấp ngày 15/11/2026, được lưu làm tài liệu tham chiếu cho thiết kế mã thiết bị và chức năng in QR của BAOTRI.
