# Refactor và hiệu năng Dateny

## Phạm vi

Refactor local ngày 26/10/2026, đối chiếu commit gốc `ee9869a158c8e043dc9ff8dfd382f033a8684f0f`.
Không deploy/push, thay khóa, migration database hay bật dịch vụ trả phí.

## Cấu trúc

```text
src/
  app/                  Route, layout, metadata; API entry points mỏng
  features/
    welcome/            Trang chọn chế độ và nội dung chào
    discovery/          Màn hình tìm quán, danh sách, chi tiết, bốc quán
    location/           Trạng thái GPS, yêu cầu quyền, native/fallback control
    map/                Leaflet, marker và điều khiển viewport
    directions/         Xem tuyến, GPS live, hướng dẫn và reroute
    date-plan/          Giao diện bốc kế hoạch hẹn
    auth/               Subscription dùng chung, OAuth và tài khoản
    reviews/            Đọc/ghi đánh giá
    lite/               HTML độc lập, không qua React layout
  components/           UI dùng chung: glass, segmented control, typing
  hooks/                Focus trap, Escape và scroll lock cho dialog
  lib/                  Model, hình học, thuật toán, HTTP client, adapters
  server/               Điều phối providers/cache/validation và HTTP errors
  styles/               CSS chia theo màn hình, responsive và hiệu năng
public/lite/            JavaScript ES5 + CSS tương thích trình duyệt cũ
tests/                  Unit/API tests và browser regression tests
scripts/                Đo bundle, phản hồi và benchmark GPS
```

Không import server services vào Client Components. Các adapter provider hiện ở `lib/places` là mã server; browser chỉ dùng model, hình học và thuật toán thuần. `distanceInMeters` đã tách khỏi adapter Overpass. Route geometry được xem là bất biến để tái sử dụng phép chiếu các bước chỉ đường.

## Thay đổi chính

- Trang chủ không còn import cả discovery, auth và reviews; ba discovery route được prerender bằng `generateStaticParams`.
- Bản đồ, chỉ đường, reviews/chi tiết và hai kiểu bốc quán được tải theo nhu cầu. CSS Leaflet không còn tải ở trang chủ.
- State quay túi mù nằm trong dialog, không kéo cả bản đồ/danh sách render lại mỗi nhịp quay.
- Render trước 12 thẻ, thêm từng 12 thẻ khi người dùng yêu cầu. Bản đồ và bốc quán vẫn dùng toàn bộ tập kết quả phù hợp.
- Lập chỉ mục tìm kiếm một lần cho mỗi tập kết quả; `useDeferredValue` giữ input phản hồi khi lọc. Card/marker và callback ổn định giúp memoization có tác dụng.
- Bỏ chờ cố định 460 ms trước điều hướng chế độ.
- Preview chỉ đường dùng vị trí đã có thay vì đợi thêm GPS tối đa 7 giây. Vị trí này có thể cũ; GPS chính xác bắt đầu khi bật dẫn đường, với kiểm tra độ mới/sai số và reroute như trước.
- Cache hình học tuyến bằng WeakMap: không chiếu lại mọi bước lên toàn tuyến ở mỗi GPS fix.
- Kế hoạch hẹn giữ tối đa 24 ứng viên tốt nhất; tính lại chặng thứ hai theo từng cặp activity/finish thay vì từng bộ ba. Có test đối chiếu thuật toán xếp hạng đầy đủ.
- HTTP GET có timeout, hủy request/delay khi không còn cần, chỉ thử lại một lần cho 429. Không tự retry POST/DELETE.
- Một subscription auth dùng chung; reviews không tải lại do `INITIAL_SESSION` và mỗi lần token refresh. Hủy lượt tải reviews cũ khi đóng/đổi địa điểm.
- Đồng bộ focus trap, Escape, trả focus và scroll lock của các dialog.
- Điện thoại màn hình nhỏ dùng ít lớp blur/compositing, giữ màu chế độ và shadow/highlight; tắt nhịp thở liên tục trên màn hình cảm ứng nhỏ. Reduced motion vẫn được tôn trọng.
- Quyền vị trí `granted` được kiểm tra lại khi mount kể cả có native geolocation element. Không lưu cờ giả rằng người dùng đã cấp quyền. Lỗi GPS có nút thử lại thực sự gọi lại GPS.
- Giữ validation, rate limit, quota provider, private cache, thứ tự fallback và kiểm tra quyền ghi reviews. Cache/rate limit vẫn là **per-process**, không phải giới hạn hóa đơn toàn hệ thống.

## iPhone 5 và bản nhẹ

Next 16 và Tailwind 4 yêu cầu Safari hiện đại (mốc Safari 16.4 trong tài liệu của stack đang cài). Không thể hứa giao diện React hiện tại chạy đầy đủ trên Safari iOS 10 của iPhone 5 chỉ bằng memoization.

Vì vậy có `/lite`: HTML riêng, JS ES5, CSS đơn giản, không React/Leaflet/font ngoài. iOS dưới 16.4 được chuyển sang đây từ trang chủ/discovery; không can thiệp callback OAuth. Có thể mở trực tiếp `/lite` trên mọi thiết bị hoặc dùng `/?view=full` để yêu cầu bản đầy đủ.

Giữ: xin vị trí bằng thao tác người dùng, tìm quán gần đây, lọc, bán kính, phân trang, bốc quán, liên kết mở bản đồ/chỉ đường bên ngoài.

Không có trong bản nhẹ: đăng nhập, đánh giá, bản đồ tương tác trong app, GPS dẫn đường trong app và bốc cả kế hoạch hẹn. Không lưu tọa độ ở localStorage. Nếu trình duyệt đã chặn quyền, web không thể ép hiện lại hộp thoại quyền.

Đây là nhánh tương thích có chủ đích, **chưa được xác nhận trên iPhone 5 thật**. User-agent và viewport 320 × 568 chỉ kiểm tra luồng/lay-out, không mô phỏng WebKit iOS 10, CPU, RAM hay TLS của máy.

## Số đo local

Đo các script được tham chiếu bởi HTML build, nén gzip từng file; không gồm lazy chunks, API, ảnh bản đồ hay prefetch. Không phải tổng traffic của cả phiên.

| Chỉ số | Trước | Sau |
| --- | ---: | ---: |
| JS đầu trang chủ, raw | 891.884 byte | 586.748 byte |
| JS đầu trang chủ, gzip | 263.401 byte | 182.486 byte |
| HTML trang chủ | 9.770 byte | 9.392 byte |
| JS đầu discovery, gzip | Chưa có số đo đối chiếu tương đương | 259.551 byte |
| JS bản nhẹ | Không có | 6.042 byte raw / 2.410 byte gzip |

JS đầu trang chủ giảm **30,7% sau gzip** (34,2% raw). CSS được chia để dễ bảo trì; không tuyên bố việc chia file tự nó giảm byte CSS tải về.

Benchmark navigation trên Node 25.9/Windows, tuyến 1.200 điểm, 80 bước, 100 GPS fixes: **181,14 ms → 5,95 ms**, cùng kết quả kiểm tra. Đây là benchmark thuật toán, không phải FPS hay độ chính xác GPS ngoài thực tế.

Chrome desktop 155, CPU throttle 4×, viewport 375 × 812, 30 địa điểm giả lập: thao tác điền tìm kiếm → thấy một kết quả là **339, 45, 39, 42, 37 ms**. Có overhead Playwright/IPC và lần đầu scroll/focus; không phải phép đo INP chuẩn. Năm lượt lọc chỉ có một request nearby. Kết quả lưu ở `artifacts/interaction.json`.

Chưa đo mạng production/cold start/upstream thực tế và chưa xác nhận mục tiêu 55 FPS trên điện thoại cũ.

## Kiểm chứng

- `npm run lint`: sạch.
- `npm run typecheck`: qua.
- `npm test`: 27 tests qua, gồm provider fallback, quota/rate limit, validation, hủy/timeout HTTP, thuật toán và nhận diện iOS cũ.
- `npm run build`: qua; homepage và ba discovery mode được prerender.
- Browser: 8 tests qua trên production build local; kiểm tra homepage, cả ba mode, marker/attribution, tìm kiếm, thêm trang, yêu thích, chi tiết/reviews, random, kế hoạch hẹn, đổi phương tiện, bắt đầu/thoát dẫn đường, reload với quyền đã cấp, lỗi/timeout/denied, loading/empty và bản nhẹ. Test riêng bản nhẹ được chạy lại sau sửa màu nút.
- Viewport: 375 × 812, 768 × 1024, 1440 × 900; bản nhẹ thêm 320 × 568. Không tràn ngang trong các màn chính đã kiểm tra.
- Có kiểm tra reduced motion, trạng thái selected và pointer pressed bình thường, mở/đóng dialog, hủy quay. Chưa đo contrast toàn trang bằng công cụ chuyên dụng, FPS hoặc toàn bộ thiết bị/browser.
- Screenshots sau thay đổi ở `artifacts/after/`: homepage, ba mode, chỉ đường, loading, error, empty, pressed và lite. Đã trực tiếp xem các ảnh đại diện mobile/tablet/desktop. Map tiles có chữ **TEST MAP**, là fixture, không phải bản đồ production.
- Baseline ảnh có trang chủ 375 px ở `artifacts/before/home-375.png`. Không có bộ before đầy đủ: lượt chụp discovery bản cũ mắc ở màn xin vị trí native (sau đó tìm và sửa nguyên nhân). Không tuyên bố có ảnh before/after của toàn bộ màn hình.
- Chưa test OAuth thật, upload/xóa reviews thật, nguồn địa điểm thật, GPS ngoài đường hoặc Safari iPhone thật. Tests không dùng tài khoản cá nhân hoặc gọi provider tính phí.

## Chạy lại

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run measure
node scripts/benchmark-navigation.mjs ee9869a158c8e043dc9ff8dfd382f033a8684f0f
```

Playwright dùng Chrome cài trên máy. Nếu test một server đã chạy, đặt `PLAYWRIGHT_BASE_URL` đến URL local đó. `scripts/measure-interaction.mjs` mặc định dùng `http://localhost:3102`, hoặc biến tương tự. Không chạy script này với production: fixture chỉ dành cho đo local.

Sau khi review diff, bước tiếp theo là thử `/lite` bằng iPhone 5 thật và kiểm tra GPS/đăng nhập trên staging trước khi deploy. Không có cấu hình mới bắt buộc và không cần nâng gói dịch vụ để chạy thay đổi này.
