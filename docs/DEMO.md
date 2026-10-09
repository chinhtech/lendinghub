# Trải nghiệm Lending Hub

Link: https://shenlong.space

Đây là bản trải nghiệm công khai. Bộ chọn tài khoản thay cho đăng nhập, các thao tác ký/cọc/thanh toán đều mô phỏng. Chỉ sử dụng dữ liệu và tài liệu mẫu.

## Đi một vòng quy trình

1. Chọn tài khoản **COM** ở góc phải hoặc dùng nút + để tạo tài khoản COM mẫu. Chọn **Tạo hồ sơ vay**, nhập thông tin mẫu và xác nhận sự đồng ý. Trong tab **Tài liệu**, upload PDF/JPG/PNG mẫu.
2. Chuyển sang **BAR**. Vào **Khám phá hồ sơ**, mở hồ sơ vừa tạo và **Gửi đề xuất tài trợ**. Công bố lãi suất/năm, phí, điều kiện, thời gian và xác nhận cọc mô phỏng.
3. Chuyển lại đúng COM đã tạo hồ sơ, mở **Đề xuất** để so sánh và chọn banker, đồng ý chia sẻ thông tin. Xác nhận điều khoản mô phỏng để bắt đầu xử lý.
4. Chuyển sang đúng BAR đã được chọn, **Cập nhật tiến độ**. Khi phê duyệt, **Đặt lịch ký hợp đồng** với thời gian tương lai.
5. COM mở **Tiến độ & lịch hẹn**, xác nhận lịch. BAR báo đã giải ngân; COM xác nhận nhận vốn và hoàn tất.
6. Mở **Cọc & phí dịch vụ** để xem sổ mô phỏng, hoặc chuyển tài khoản quản trị để xem hồ sơ và nhật ký.

PER thử quy trình cá nhân tương tự. BRO tạo hồ sơ đại diện COM/PER và xác nhận sự đồng ý của khách hàng mẫu. Nếu mở nhiều trình duyệt, tải lại trang để nhận cập nhật từ người còn lại.

Mọi người tham quan dùng chung database demo và có thể chuyển sang các danh tính mẫu. Đây chưa phải hệ thống xác thực hay tiếp nhận hồ sơ tín dụng thật. Quyết định cấp tín dụng thuộc ngân hàng. Lãi suất, cọc và phí hiển thị trong demo là thông tin minh họa.

## Kết quả đã xác minh

- Frontend trên domain khớp bản build đã kiểm thử local; HTTPS/API hoạt động.
- 20/20 kiểm tra HTTPS/API qua domain và 17 kiểm tra riêng cho luồng nhiều banker cùng gửi đề xuất.
- Lỗi tải tài liệu đã được sửa và xác minh lại qua domain. Hồ sơ/tài liệu trước bản vá vẫn còn sau lần Restart do người dùng báo đã thực hiện.
- 14/14 kiểm thử API local và 4/4 kiểm thử trình duyệt local trước triển khai. Trình duyệt cloud trực tiếp trên domain chưa được kiểm thử do proxy certificate trust bị chặn bởi duyệt tự động; không tắt xác minh TLS.
