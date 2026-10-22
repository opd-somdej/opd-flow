/* =====================================================================
   p-tv.js — จอแสดงผล (เปิดค้างบนทีวี/จอใหญ่)
   วนแสดงทีละหน้าอัตโนมัติ · อัปเดตเองเมื่อมียอดใหม่ · ลิงก์จอไม่ต้องล็อกอิน (?tv=รหัสจอ ตั้งที่ ตั้งค่า › จอแสดงผล)
   ===================================================================== */
'use strict';
var TVS = { i: 0, timer: null, clock: null };
PAGE_FN.tv = function (root) {
  clearInterval(TVS.timer); clearInterval(TVS.clock);
  var cfg = S.boot.settings.tv || {}, rot = (+cfg.rotate || 20) * 1000;
  root.innerHTML = '<div class="tv"><header class="tv-h"><img src="logo-hospital.png" alt="" width="44" height="44"><div><h1>' + U.esc(cfg.title || 'สถานการณ์ผู้ป่วยนอกวันนี้') + '</h1><p>' + U.esc(S.boot.settings.orgName || '') + '</p></div>' +
    '<div class="tv-clock"><b id="tvClock"></b><span id="tvUpd"></span></div>' +
    '<div class="tv-act">' + (S.me.role !== 'tv' ? '<button class="btn ghost sm" id="tvExit">ออกจากจอแสดงผล</button>' : '') + '<button class="icon-btn" id="tvFs" aria-label="เต็มจอ">' + ICON.expand + '</button></div></header>' +
    '<div class="tv-body" id="tvBody"><div class="loading-block"><div class="ld-rib"></div><p>กำลังโหลด…</p></div></div><nav class="tv-dots" id="tvDots"></nav></div>';
  var ex = U.$('#tvExit'); if (ex) ex.onclick = function () { clearInterval(TVS.timer); clearInterval(TVS.clock); go('live'); };
  U.$('#tvFs').onclick = function () { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); };
  var tick = function () { var n = nowBkk(); var c = U.$('#tvClock'); if (!c) { clearInterval(TVS.clock); return; } c.textContent = n.hm + ' น.'; };
  tick(); TVS.clock = setInterval(tick, 15000);
  var t = nowBkk().iso;
  Promise.all([D.loadToday(), D.ensure(U.addDays(t, -56), U.addDays(t, -1), true)]).then(function () { ALERTS.evaluate(); show(); TVS.timer = setInterval(function () { TVS.i++; show(); }, rot); });

  var PANELS = ['hero', 'floor', 'top', 'heat'];
  function show() {
    var body = U.$('#tvBody'); if (!body) { clearInterval(TVS.timer); return; }
    CH.disposeAll();
    var L = LIVE.compute(), k = PANELS[TVS.i % PANELS.length];
    U.$('#tvUpd').textContent = 'ยอดถึง ' + (L.lf || '–') + ' น.';
    U.$('#tvDots').innerHTML = PANELS.map(function (p, i) { return '<i class="' + (i === TVS.i % PANELS.length ? 'on' : '') + '"></i>'; }).join('');
    body.className = 'tv-body p-' + k;
    if (k === 'hero') {
      body.innerHTML = '<div class="tv-hero"><div><span>ผู้ป่วยนอกวันนี้ถึงตอนนี้</span><b data-count="' + Math.round(L.R.v) + '">' + U.fmt(L.R.v) + '</b><em>คาดว่าทั้งวัน ≈ ' + U.fmt(L.proj) + ' ราย</em></div>' +
        '<div class="tv-k">' + kpi({ label: '1 ชั่วโมงล่าสุด', value: L.l60, unit: 'ราย', sub: 'ปกติ ≈ ' + U.fmt(L.e60) }) + kpi({ label: 'ถึงตอนนี้เทียบปกติ', value: L.cumE ? U.pct(L.R.v / L.cumE - 1, 0) : '–' }) + kpi({ label: 'walk-in', value: L.R.v ? U.share(L.R.w / L.R.v, 0) : '–' }) + '</div></div><div id="tvRib"></div>';
      ribbon(U.$('#tvRib'), { act: L.act, exp: L.exp, now: L.nowSlot, from: 20, to: 87 });
      countUp(body);
    } else if (k === 'floor') {
      var dim = 'floor', bd = LIVE.byDim(L, dim).sort(function (a, b) { return b.v - a.v; }).slice(0, 12);
      body.innerHTML = '<h2>วันนี้แยกตามชั้น (ตัวเลขในวงเล็บ = ปกติถึงเวลานี้)</h2><div class="tv-chart" id="tvC"></div>';
      CH.barsH(U.$('#tvC'), bd.map(function (o) { return { label: o.label, title: o.title, v: o.v, e: o.e, color: o.e && o.v / o.e > 1.3 ? CH.T().serious : null }; }), { labelW: 320, lbl: function (r) { return U.fmt(r.v) + '  (' + U.fmt(r.e) + ')'; } });
    } else if (k === 'top') {
      var cl = LIVE.byDim(L, 'clinic').sort(function (a, b) { return b.h - a.h; }).filter(function (o) { return o.h > 0; }).slice(0, 10);
      body.innerHTML = '<div class="tv-two"><div><h2>มาถึงมากที่สุดใน 1 ชั่วโมงล่าสุด</h2><div class="tv-chart" id="tvC"></div></div><div><h2>แจ้งเตือน</h2>' + ALERTS.html(6) + '</div></div>';
      if (cl.length) CH.barsH(U.$('#tvC'), cl.map(function (o) { return { label: D.shortLabel('clinic', o.key), v: o.h, he: o.he }; }), { labelW: 300, lbl: function (r) { return U.fmt(r.v) + (r.he ? '  (ปกติ ' + U.fmt(r.he) + ')' : ''); } });
      else U.$('#tvC').innerHTML = '<div class="empty">ยังไม่มีผู้ป่วยใน 1 ชั่วโมงล่าสุด</div>';
    } else {
      var d2 = 'bld', top = LIVE.byDim(L, d2).sort(function (a, b) { return b.v - a.v; }).slice(0, 10), hx = [], hd = [], ki = {};
      top.forEach(function (o, i) { ki[o.key] = i; });
      for (var s = 20; s < 88; s += 2) hx.push(U.hhmm(s));
      var mat = top.map(function () { return new Float64Array(hx.length); });
      for (var ci = 0; ci < D.nC; ci++) { if (!L.K.cm[ci]) continue; var i2 = ki[D.val(d2, ci)]; if (i2 == null) continue; for (s = 20; s < 88 && s <= L.nowSlot; s++) mat[i2][(s - 20) >> 1] += L.R.cs[ci * NS + s]; }
      top.forEach(function (o, yi) { for (var xi = 0; xi < hx.length; xi++) if (20 + xi * 2 <= L.nowSlot) hd.push([xi, yi, mat[yi][xi]]); });
      body.innerHTML = '<h2>วันนี้: ตึก × ช่วงเวลา (ครึ่งชั่วโมง)</h2><div class="tv-chart" id="tvC"></div>';
      if (hd.length) CH.heat(U.$('#tvC'), { x: hx, y: top.map(function (o) { return o.label; }), data: hd, labelW: 300, labels: true, labelMin: 1 });
    }
  }
};
