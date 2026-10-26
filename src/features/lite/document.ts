// A standalone document, intentionally outside React, Tailwind and the app layout.
// Keep legacy assets ES5/CSS3 compatible. Never interpolate user input into HTML.
export const liteDocument = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dateny — Bản nhẹ</title><meta name="description" content="Tìm quán quanh bạn với bản Dateny dành cho máy cũ.">
<link rel="stylesheet" href="/lite/style.css?v=1"><script src="/lite/app.js?v=1" defer></script></head>
<body><main><header><a class="brand" href="/lite">Dateny</a><span>Bản nhẹ</span></header>
<h1>Đi đâu khó, có Dateny lo.</h1>
<p>Bản gọn cho máy cũ: tìm quán, bốc quán và mở ứng dụng chỉ đường. Đăng nhập, đánh giá và bản đồ tương tác có ở bản đầy đủ.</p>
<nav aria-label="Kiểu đi chơi"><a href="/lite?mode=solo" data-mode="solo">Một mình</a><a href="/lite?mode=couple" data-mode="couple">Hẹn hò</a><a href="/lite?mode=friends" data-mode="friends">Bạn bè</a></nav>
<section class="panel"><button id="locate" type="button">Dùng vị trí của tôi</button><p id="status" role="status" aria-live="polite">Bấm để tìm quán gần bạn.</p>
<div id="filters" hidden><label for="search">Tìm quán</label><input id="search" type="search" placeholder="Tên quán, địa chỉ…" autocomplete="off">
<div class="filter-row"><label for="category">Loại quán<select id="category"><option value="all">Tất cả</option><option value="restaurant">Nhà hàng</option><option value="cafe">Cà phê</option><option value="fast_food">Ăn nhanh</option></select></label>
<label for="radius">Bán kính<select id="radius"><option value="1000">1 km</option><option value="2000" selected>2 km</option><option value="3000">3 km</option><option value="5000">5 km</option></select></label></div>
<button id="random" type="button">Bốc một quán</button><button id="reset" type="button" class="secondary">Đặt lại bộ lọc</button></div></section>
<section id="picked" class="panel" hidden aria-label="Quán được chọn" aria-live="polite"></section>
<div id="results" aria-label="Quán quanh đây"></div><button id="more" type="button" hidden>Xem thêm quán</button>
<noscript><p>Cần bật JavaScript để dùng vị trí và tìm quán.</p></noscript>
<footer><p>Dữ liệu địa điểm: © OpenStreetMap contributors<span id="source"></span>.</p><a href="/?view=full">Mở bản đầy đủ (cần trình duyệt mới)</a></footer>
</main></body></html>`;
