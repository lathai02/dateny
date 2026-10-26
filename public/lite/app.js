/* ES5 on purpose: this entry must parse on Safari / iOS 10, without React. */
(function () {
  "use strict";
  var places = [], filtered = [], coords = null, limit = 12, xhr = null, searchTimer = null, lastPick = "";
  var coverage = 0, geoRequest = 0;
  var labels = { restaurant: "Nhà hàng", cafe: "Cà phê", fast_food: "Ăn nhanh" };
  function byId(id) { return document.getElementById(id); }
  function status(message) { byId("status").textContent = message; }
  function text(tag, value) { var node = document.createElement(tag); node.textContent = value; return node; }
  function distance(meters) { return meters < 1000 ? Math.round(meters) + " m" : (meters / 1000).toFixed(1) + " km"; }
  function card(place) {
    var article = document.createElement("article");
    article.appendChild(text("h2", place.name));
    article.appendChild(text("p", labels[place.category] + " · " + distance(place.distanceMeters)));
    if (place.address) article.appendChild(text("p", place.address));
    var link = text("a", "Mở bản đồ / chỉ đường");
    link.href = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(place.latitude + "," + place.longitude);
    link.target = "_blank"; link.rel = "noopener noreferrer";
    article.appendChild(link);
    return article;
  }
  function render() {
    var list = byId("results"), fragment = document.createDocumentFragment();
    list.textContent = "";
    for (var i = 0; i < Math.min(limit, filtered.length); i++) fragment.appendChild(card(filtered[i]));
    list.appendChild(fragment);
    byId("more").hidden = limit >= filtered.length;
    byId("random").disabled = filtered.length === 0;
    status(filtered.length ? filtered.length + " quán quanh bạn" : "Chưa có quán phù hợp. Thử loại quán hoặc bán kính khác.");
  }
  function filter() {
    var query = byId("search").value.toLowerCase().trim(), category = byId("category").value;
    var radius = Number(byId("radius").value);
    filtered = places.filter(function (place) {
      return place.distanceMeters <= radius && (category === "all" || place.category === category)
        && [place.name, place.address || "", place.cuisine || ""].join(" ").toLowerCase().indexOf(query) !== -1;
    });
    limit = 12; byId("picked").hidden = true; render();
  }
  function load() {
    if (!coords) return;
    if (xhr) { xhr.abort(); xhr = null; }
    var radius = Number(byId("radius").value);
    if (coverage >= radius) { filter(); return; }
    status("Đang tìm quán quanh bạn…");
    var request = new XMLHttpRequest(); xhr = request;
    request.open("GET", "/api/places/nearby?lat=" + coords.latitude.toFixed(6) + "&lon=" + coords.longitude.toFixed(6) + "&radius=" + radius + "&category=all");
    request.timeout = 30000;
    request.onload = function () {
      if (xhr !== request) return;
      xhr = null;
      try {
        var data = JSON.parse(request.responseText);
        if (request.status !== 200 || !Array.isArray(data.places)) throw new Error(data.error || "Chưa tải được quán. Bấm dùng vị trí để thử lại.");
        places = data.places; coverage = radius;
        byId("filters").hidden = false;
        byId("source").textContent = data.source === "geoapify" ? " · qua Geoapify" : data.source === "photon" ? " · qua Photon" : "";
        filter();
      } catch (error) { status(error.message || "Dữ liệu không hợp lệ. Hãy thử lại."); }
    };
    request.onerror = request.ontimeout = function () {
      if (xhr !== request) return;
      xhr = null; status("Kết nối chậm hoặc bị ngắt. Bấm dùng vị trí để thử lại.");
    };
    request.send();
  }
  function locate() {
    if (!navigator.geolocation) { status("Trình duyệt không hỗ trợ vị trí."); return; }
    var id = ++geoRequest;
    if (xhr) { xhr.abort(); xhr = null; }
    status("Đang lấy vị trí…"); byId("locate").disabled = true;
    navigator.geolocation.getCurrentPosition(function (position) {
      if (id !== geoRequest) return;
      byId("locate").disabled = false;
      coords = position.coords; coverage = 0; load();
    }, function (error) {
      if (id !== geoRequest) return;
      byId("locate").disabled = false;
      status(error.code === 1 ? "Vị trí đang bị chặn. Bật quyền vị trí cho trang trong cài đặt trình duyệt rồi bấm lại." : "Chưa lấy được vị trí. Hãy thử lại.");
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }
  byId("locate").onclick = locate;
  byId("search").oninput = function () { clearTimeout(searchTimer); searchTimer = setTimeout(filter, 150); };
  byId("category").onchange = filter;
  byId("radius").onchange = load;
  byId("more").onclick = function () { limit += 12; render(); };
  byId("reset").onclick = function () { byId("search").value = ""; byId("category").value = "all"; byId("radius").value = "2000"; load(); };
  byId("random").onclick = function () {
    if (!filtered.length) return;
    var pool = filtered.length > 1 ? filtered.filter(function (place) { return place.id !== lastPick; }) : filtered;
    var chosen = pool[Math.floor(Math.random() * pool.length)]; lastPick = chosen.id;
    var panel = byId("picked"); panel.textContent = ""; panel.appendChild(card(chosen)); panel.hidden = false;
    panel.setAttribute("tabindex", "-1"); panel.focus();
  };
  var modeMatch = /(?:^|[?&])mode=(solo|couple|friends)(?:&|$)/.exec(window.location.search);
  var mode = modeMatch ? modeMatch[1] : "solo";
  document.body.className = mode;
  var active = document.querySelector('[data-mode="' + mode + '"]');
  if (active) active.setAttribute("aria-current", "page");
  // Do not store coordinates, nor an "allowed" flag; the browser owns consent.
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: "geolocation" }).then(function (permission) {
      if (permission.state === "granted") locate();
    }, function () {});
  }
}());
