# Triển khai Lending Hub lên shenlong.space

Đích triển khai: Spaceship Shared Hosting qua cPanel, application root `lendinghub`, startup file `app.cjs`, domain `shenlong.space`. Chủ dự án thực hiện upload và khởi động qua cPanel; môi trường phát triển kiểm tra từ xa qua HTTPS. Không có truy cập quản lý/SSH để thay file hoặc restart từ đây.

## Tình trạng xác minh trên tên miền

- `GET https://shenlong.space/api/health` đã trả `status=ok`, `mode=demo`, `database=1`.
- Frontend và JS/CSS trên domain trả thành công, khớp byte với bản giao diện đã build và kiểm thử. Không có thông tin trợ lý trong các asset website.
- Cấu hình Node.js 24.21.0 đã được chọn trong ảnh cPanel của chủ dự án. Không dùng Node.js 10.24.1. Health API không công bố phiên bản runtime, nên không coi đây là xác minh phiên bản Node trực tiếp từ server.
- Kiểm tra tài liệu phát hiện upload thành công nhưng download 404 vì Express mặc định bỏ qua đường dẫn ẩn `.data`. Source và gói cài đầy đủ đã sửa endpoint tải file với root bị giới hạn trong uploads; kiểm tra quyền chủ hồ sơ/banker được chọn vẫn giữ nguyên. Kiểm thử API đã tái hiện lỗi trước sửa và chạy qua sau sửa.
- Chủ dự án đã cập nhật bản vá `server/app.js` và báo Restart. Đã xác minh lại trên domain: tài liệu upload trước bản vá tải xuống đúng nội dung, banker chưa được chọn bị từ chối, hồ sơ và tài liệu được giữ lại sau lần Restart do người dùng thực hiện. Không trực tiếp điều khiển tiến trình hosting từ môi trường cloud.
- Luồng HTTPS/API trên domain chạy qua 20/20 kiểm tra, gồm upload/download, phân quyền, lựa chọn banker, mô phỏng ký/cọc, cập nhật, lịch hẹn, xác nhận giải ngân, hoàn tất, phí và hoàn cọc. Trước đó 17 kiểm tra độc lập cũng xác minh nhiều banker cùng gửi đề xuất và hoàn cọc cho banker không được chọn. Các hồ sơ kiểm tra dùng dữ liệu giả lập riêng.
- Kết nối TCP trực tiếp từ cloud tới IP hosting bị từ chối; HTTPS qua proxy hoạt động. Không suy ra SSH hosting bị tắt hoặc sai mật khẩu.
- Kiểm tra trình duyệt trực tiếp trên domain từ cloud chưa chạy được: trình duyệt chưa tin root CA của proxy và hệ thống duyệt tự động đã từ chối thay đổi trust lâu dài. Không tắt xác minh TLS. Kiểm tra HTTPS dùng curl với trust đã được môi trường cung cấp; kiểm thử trình duyệt local đã chạy trước đó. Điều này không thay cho kiểm tra trực quan domain trên trình duyệt của người dùng.

## Spaceship Shared Hosting với Node.js

Điều kiện: Node.js **22.13+ hoặc 24**, ứng dụng Node chạy liên tục, hỗ trợ `node:sqlite`, thư mục ghi được và HTTPS. Không chỉ upload `dist`: frontend cần API và database. Nếu selector chỉ có phiên bản thấp hơn 22.13 (bao gồm Node.js 10.24.1), không dùng bản này trực tiếp; cần runtime mới hơn hoặc một backend hosting riêng.

1. Tạo bản đóng gói tại máy phát triển: `bash deploy/package.sh`. File tại `.data/releases/lendinghub-shared-hosting.tar.gz` chứa frontend đã build, backend, lockfile và hướng dẫn; không có dữ liệu, file người dùng hay secret.
2. Upload và giải nén vào application root **ngoài thư mục public web**, ví dụ thư mục `lendinghub` dưới tài khoản hosting. Không ghi đè `.data` của bản đang chạy.
3. Trong mục Node.js: tạo application với URL `https://shenlong.space/` (URI `/`), chọn Node.js 22.13+ hoặc 24, production mode, application root như trên, startup file `app.cjs`. Nếu giao diện thực tế dùng cơ chế khác, xác nhận trường và thư mục trước khi điền; không suy đoán đường dẫn `/home/...`.
4. Kích hoạt đúng Node environment theo lệnh mà hosting hiển thị. Trong application root chạy `node --version` và kiểm tra SQLite:
   ```sh
   node -e "const {DatabaseSync}=require('node:sqlite'); console.log(new DatabaseSync(':memory:').prepare('select 1 as ok').get())"
   npm ci --omit=dev --no-audit --no-fund
   ```
   Không cần Vite/devDependencies trên hosting vì frontend đã build trong gói.
5. Cấu hình biến không bí mật trong panel: `DEMO_MODE=true`, `NODE_ENV=production`, `DATABASE_PATH=.data/lendinghub.sqlite`, `UPLOAD_DIR=.data/uploads`. Để panel cung cấp PORT nếu có; không mở cổng công khai riêng khi đã dùng routing của hosting.
6. Dùng Restart application trong panel. Xem log và yêu cầu `https://shenlong.space/api/health`: mong đợi `{"status":"ok","mode":"demo","database":1}`. Mở website, thử bảng hồ sơ và tạo một hồ sơ mẫu. Restart rồi kiểm tra hồ sơ vẫn còn.
7. Bật SSL/HTTPS trong hosting. Xác nhận chứng chỉ hợp lệ và chuyển HTTP sang HTTPS bằng cài đặt được hosting hỗ trợ. Chưa nên gửi link khách hàng nếu API hoặc SSL chưa hoạt động.

Nếu domain đã dùng nameserver Spaceship và đã gắn với hosting, có thể không cần sửa DNS tại Namecheap. Kiểm tra bản ghi đang có trước khi thay. Nếu DNS vẫn quản lý ở Namecheap, dùng IP/hostname được Spaceship cung cấp để điền bản ghi đúng; không đoán IP và không thay nameserver/MX làm ảnh hưởng email. `www` chỉ được thêm nếu cũng đã gắn và có chứng chỉ.

## Phương án VPS dự phòng

Chỉ dùng khi Shared Hosting không đáp ứng runtime. Có Docker và Compose trên VPS, bảo đảm cổng 80/443 mở và không trùng dịch vụ đang chạy. Đặt A record `@` về IP VPS thực tế, không thay bản ghi mail. Trong checkout:

```sh
docker compose -f deploy/compose.yml config
docker compose -f deploy/compose.yml up -d --build
docker compose -f deploy/compose.yml logs --tail=100
curl --fail https://shenlong.space/api/health
```

Caddy cấp TLS cho domain sau khi DNS/cổng hợp lệ. Ứng dụng chỉ mở cổng trong network Docker. Volume `lending_data` giữ SQLite và uploads, volume Caddy giữ chứng chỉ. Không chạy `down -v` nếu cần giữ dữ liệu.

## Cập nhật và sao lưu

Giữ `.data` và cấu hình panel khi thay source/dist. Cập nhật dependencies theo lockfile, restart rồi xác minh health và một luồng mẫu. Sao lưu database bằng SQLite backup API; không chỉ copy một file DB đang mở trong chế độ WAL. Sao lưu uploads cùng thời điểm. Chưa tự động triển khai backup/monitoring trên hosting chưa truy cập được.

Tất cả tài khoản hiện tại là danh tính trải nghiệm. Bản demo công khai không được nhận dữ liệu định danh hay tài liệu tín dụng thật.
