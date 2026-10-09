# Lending Hub

Nền tảng tiếng Việt kết nối nhu cầu vốn của doanh nghiệp/cá nhân với banker và đối tác môi giới. Phiên bản trải nghiệm có backend, database bền vững, file upload riêng tư, quy trình đề xuất và tiến độ, thông báo, gói vay, quản trị và nhật ký hoạt động.

## Chạy

Node.js 22.13+ hoặc 24, npm. Từ repository:

```sh
npm ci
npm run build
npm test
npm start
```

Server dùng cổng 3000, phục vụ frontend và API cùng origin. `GET /api/health` xác nhận database và chế độ demo. Database tự khởi tạo dữ liệu mẫu một lần tại `.data/lendinghub.sqlite`, tài liệu tại `.data/uploads`. Không xóa `.data` khi cập nhật.

Phát triển với hot reload: chạy `npm run dev` cho API và `npm run dev:web` trong terminal khác. Vite chuyển `/api` tới server. Build lại trước khi chạy `npm start` nếu đã sửa frontend.

## Trải nghiệm

Bộ chọn góc phải cho phép đổi COM, PER, BRO, BAR và quản trị, không cần đăng nhập. Có thể tạo danh tính mẫu mới qua nút +.

- COM/PER tạo hồ sơ và tải tài liệu mẫu trong tab Tài liệu.
- BRO tạo hồ sơ đại diện COM/PER và xác nhận sự đồng ý.
- BAR xem hồ sơ ẩn danh, **Gửi đề xuất tài trợ**, công bố điều kiện/lãi suất/phí/thời gian và tạo cọc mô phỏng.
- Chủ hồ sơ so sánh, lựa chọn banker, chấp thuận điều khoản và bắt đầu xử lý mô phỏng.
- Banker cập nhật, phê duyệt và hẹn ký. Khách hàng xác nhận lịch; banker báo giải ngân; khách hàng xác nhận nhận vốn và hoàn tất.
- Quản trị xem tài khoản, hồ sơ, sổ phí/cọc, nhật ký và xử lý cọc các hồ sơ bị hủy.

Không có đăng nhập, chữ ký số, thanh toán hay giao dịch tiền thật. Không nhập dữ liệu thật. Bản này chưa phải hệ thống vận hành tín dụng chính thức.

## Kiểm thử

`npm test` chạy API tích hợp trong database tạm. `npm run test:e2e` chạy trình duyệt, dùng database riêng và server cổng 3100. Mặc định Chromium ở `/usr/bin/chromium`; đặt `CHROMIUM_PATH` nếu nằm nơi khác. Mỗi lần chạy E2E tạo database mới trong thư mục tạm, không tác động database chính.

[Hướng dẫn trải nghiệm trên tên miền](docs/DEMO.md) · [Kiến trúc và điểm tích hợp](docs/ARCHITECTURE.md) · [Triển khai Spaceship / tên miền](docs/DEPLOYMENT.md)
