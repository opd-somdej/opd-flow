/* =====================================================================
   p-live.js — สถานการณ์วันนี้ (ยอดสด)
   ยอดถึงตอนนี้ · คาดว่าทั้งวัน · แถบเวลาวันนี้ · เทียบปกติ · จุดที่แน่นที่สุดตอนนี้ · แจ้งเตือน
   "ปกติ" = ค่าเฉลี่ยของวันเดียวกันในสัปดาห์ ย้อนหลัง 8 สัปดาห์ (ประเภทวันเดียวกัน)
   ===================================================================== */
'use strict';
var LIVE = {
  /** คำนวณภาพรวมวันนี้ตามตัวกรอง (ไม่ใช้ตัวกรองช่วงเวลา/ประเภทวัน) */
  compute: function () {
    var t = nowBkk().iso, F = JSON.parse(JSON.stringify(D.filt())); F.hours = null; F.dts = ['W', 'S', 'H'];
    var K = D.compile(F);
    var R = D.agg(t, t, { K: K, slots: true, cs: true });
    var ex = ALERTS.expected(t), E = { bySlot: new Float64Array(NS * 2), cs: new Float64Array(D.nC * NS), v: 0 };
    ex.days.forEach(function (d) {
      var r = D.agg(d, d, { K: K, slots: true, cs: true });
      for (var i = 0; i < NS * 2; i++) E.bySlot[i] += r.bySlot[i] / ex.days.length;
      for (i = 0; i < r.cs.length; i++) E.cs[i] += r.cs[i] / ex.days.length;
      E.v += r.v / ex.days.length;
    });
    var st = SYNC.st || S.boot.status || {}, lf = st.lastFetchAt && st.lastFetchAt.slice(0, 10) === t ? st.lastFetchAt.slice(11, 16) : null;
    var nowSlot = lf ? Math.floor((+lf.slice(0, 2) * 60 + +lf.slice(3, 5)) / 15) - 1 : -1;
    var act = [], exp = [], cumE = 0, totE = 0;
    for (var s = 0; s < NS; s++) { act.push(R.bySlot[s * 2]); exp.push(E.bySlot[s * 2]); totE += E.bySlot[s * 2]; if (s <= nowSlot) cumE += E.bySlot[s * 2]; }
    var share = totE ? cumE / totE : 0, proj = FC.nowcast(R.v, share, E.v || null);
    // สัปดาห์ก่อน ณ เวลาเดียวกัน
    var lw = U.addDays(t, -7), LW = D.DAYS[lw] && D.DAYS[lw].sl ? D.agg(lw, lw, { K: K, slots: true }) : null, lwNow = null;
    if (LW) { lwNow = 0; for (s = 0; s <= nowSlot; s++) lwNow += LW.bySlot[s * 2]; }
    var l60 = 0; for (s = Math.max(0, nowSlot - 3); s <= nowSlot; s++) l60 += act[s];
    var e60 = 0; for (s = Math.max(0, nowSlot - 3); s <= nowSlot; s++) e60 += exp[s];
    return { t: t, K: K, R: R, E: E, ex: ex, act: act, exp: exp, nowSlot: nowSlot, lf: lf, cumE: cumE, totE: totE, share: share, proj: proj, lwNow: lwNow, l60: l60, e60: e60, dt: D.dayType(t) };
  },
  /** ตารางคลินิก/มิติ: ยอดวันนี้ เทียบปกติถึงเวลาเดียวกัน และ 60 นาทีล่าสุด */
  byDim: function (L, dim) {
    var m = {};
    for (var ci = 0; ci < D.nC; ci++) {
      if (!L.K.cm[ci]) continue;
      var a = 0, e = 0, h = 0, he = 0;
      for (var s = 0; s <= L.nowSlot; s++) { a += L.R.cs[ci * NS + s]; e += L.E.cs[ci * NS + s]; if (s > L.nowSlot - 4) { h += L.R.cs[ci * NS + s]; he += L.E.cs[ci * NS + s]; } }
      if (!a && !e) continue;
      var k = D.val(dim, ci), o = m[k] || (m[k] = { key: k, v: 0, e: 0, h: 0, he: 0 });
      o.v += a; o.e += e; o.h += h; o.he += he;
    }
    return Object.keys(m).map(function (k) { var o = m[k]; o.label = D.shortLabel(dim, k); o.title = D.label(dim, k); return o; });
  }
};

PAGE_FN.live = function (root) {
  var tools = U.$('#topTools'), dim = 'unit';
  FUI.bar(tools, function () { redraw(); });
  dim = FUI.dimSelect(tools, 'liveDim2', 'unit', function (d) { dim = d; redraw(); });
  EXP.toolbar(tools, { title: 'สถานการณ์ผู้ป่วยนอกวันนี้' });
  function redraw() { UI.loading(root, 'กำลังคำนวณ…'); setTimeout(function () { draw(); }, 30); }
  UI.loading(root, 'กำลังโหลดยอดวันนี้…');
  var t = nowBkk().iso;
  Promise.all([D.loadToday(), D.ensure(U.addDays(t, -56), U.addDays(t, -1), true)]).then(function () { ALERTS.evaluate(); draw(true); }).catch(function (e) { UI.doneLoading(root); root.innerHTML = '<div class="empty"><b>โหลดยอดวันนี้ไม่สำเร็จ</b><p>' + U.esc(e.message) + '</p><button class="btn primary" onclick="route()">ลองอีกครั้ง</button></div>'; });

  function draw(first) {
    CH.disposeAll(); UI.doneLoading(root);
    var L = LIVE.compute(), n = nowBkk(), st = TR.step(), res = TR.res();
    var ap = L.R.v ? L.R.a / L.R.v : null, lwD = L.lwNow ? L.R.v / L.lwNow - 1 : null;
    var dtNote = L.dt === 'W' ? '' : '<span class="tag">' + D.DT[L.dt] + (D.hol[L.t] ? ' · ' + U.esc(D.hol[L.t]) : '') + '</span>';
    var noData = L.nowSlot < 0 || !L.R.v;
    root.innerHTML = UNMAPPED.banner() +
      '<section class="hero">' +
      '<div class="hero-main"><p class="eyebrow">' + U.thDate(L.t, { dow: true, full: true }) + ' ' + dtNote + '</p>' +
      '<div class="big"><b data-count="' + Math.round(L.R.v) + '">' + U.fmt(L.R.v) + '</b><span>ราย<br>ถึง ' + (L.lf || '–') + ' น.</span></div>' +
      '<p class="hero-sub">' + (noData ? 'ยังไม่มีผู้ป่วยลงทะเบียนวันนี้ (หรือยังไม่ถึงรอบดึงข้อมูลแรก)' : 'คาดว่าทั้งวัน ≈ <b>' + U.fmt(L.proj) + '</b> ราย ' + UI.info('proj') + ' · ปกติวัน' + U.DOWF[U.dow(L.t)] + ' ≈ ' + U.fmt(L.totE) + ' ราย') + '</p></div>' +
      '<div class="kpis">' +
      kpi({ label: '1 ชั่วโมงล่าสุด', value: L.l60, unit: 'ราย', sub: 'ปกติ ≈ ' + U.fmt(L.e60), help: 'last60' }) +
      kpi({ label: 'เทียบสัปดาห์ก่อน', value: L.lwNow == null ? '–' : U.fmt(L.lwNow), unit: L.lwNow == null ? '' : 'ราย', delta: lwD, deltaLabel: 'ณ เวลาเดียวกัน', help: 'lastweek' }) +
      kpi({ label: 'มาตามนัด', value: ap == null ? '–' : U.share(ap, 0), sub: 'walk-in ' + (ap == null ? '–' : U.share(1 - ap, 0)) + ' · ' + U.fmt(L.R.w) + ' ราย', help: 'appoint' }) +
      kpi({ label: 'ถึงตอนนี้เทียบปกติ', value: L.cumE ? U.pct(L.R.v / L.cumE - 1, 0) : '–', sub: 'ปกติถึงเวลานี้ ≈ ' + U.fmt(L.cumE), help: 'vsnormal', cls: L.cumE && L.R.v / L.cumE - 1 > 0.25 ? 'hot' : '' }) +
      '</div></section>' +
      '<section class="card rib-card"><header class="ch"><div><h2>แถบเวลาวันนี้' + UI.info('ribbon') + '</h2><p class="sub">ช่องละ ' + TR.unit(res) + ' · แท่งสูง/สีเข้ม = มาถึงมาก · กรอบเส้นประ = ช่วงที่ยังไม่ถึง (ปริมาณตามปกติ) · เส้นแดง = ตอนนี้' + (TR.note() ? '<br><span class="note-i">ⓘ ' + TR.note() + '</span>' : '') + '</p></div><div class="rib-legend"><span>น้อย</span><i class="l1"></i><i class="l3"></i><i class="l5"></i><i class="l7"></i><i class="l9"></i><span>มาก</span></div></header><div id="rib"></div></section>' +
      '<div class="grid g-live"><div id="c1"></div><div id="c2"></div><div id="c3"></div><div id="c4"></div><div id="c5"></div><div id="c6"></div></div>';
    ribbon(U.$('#rib', root), { act: L.act, exp: L.exp, now: L.nowSlot, from: 24, to: 87, vals: st >= 4 && innerWidth > 700 });

    // 1) รายช่วงเวลา (ตามความละเอียดที่ตั้ง) เทียบปกติ
    var x = [], a = [], e = [], wk = [];
    for (var s = 24; s < 88; s += st) {
      x.push(U.hhmm(s)); var past = s <= L.nowSlot, av = 0, ev = 0, wv = 0;
      for (var k = 0; k < st; k++) { ev += L.exp[s + k] || 0; if (s + k <= L.nowSlot) { av += L.act[s + k] || 0; wv += L.R.bySlot[(s + k) * 2 + 1] || 0; } }
      a.push(past ? av : null); e.push(Math.round(ev)); wk.push(past ? wv : null);
    }
    var c1 = CH.card(U.$('#c1', root), { title: 'มาถึงราย' + TR.unit(res) + ' เทียบวันปกติ', help: 'halfhour', h: 280, cls: 'span2' });
    c1.set(CH.line(c1.chartEl, { x: x, bars: true, series: [{ name: 'วันนี้', data: a, bar: true }, { name: 'ปกติ (เฉลี่ย 8 สัปดาห์)', data: e, color: CH.T().ink2, dash: true, width: 1.5, smooth: 0.3 }, { name: 'walk-in วันนี้', data: wk, color: CH.T().cat[1], width: 1.5, symbol: 'none' }] }));
    c1.setTable([{ h: 'ช่วงเวลา' }, { h: 'วันนี้', num: 1 }, { h: 'walk-in', num: 1 }, { h: 'ปกติ', num: 1 }], x.map(function (h, i) { return [h, a[i] == null ? '' : a[i], wk[i] == null ? '' : wk[i], e[i]]; }));

    // 2) แน่นที่สุดใน 1 ชม.ล่าสุด (คลินิก)
    var cl = LIVE.byDim(L, 'clinic').sort(function (p, q) { return q.h - p.h; }).filter(function (o) { return o.h > 0; }).slice(0, 10);
    var c2 = CH.card(U.$('#c2', root), { title: 'คลินิกที่คนมาถึงมากที่สุด 1 ชม.ล่าสุด', help: 'top60', h: 320 });
    if (cl.length) c2.set(CH.barsH(c2.chartEl, cl.map(function (o) { return { label: D.shortLabel('clinic', o.key), title: o.title, v: o.h, he: o.he, key: o.key }; }), { labelW: 170, lbl: function (r) { return U.fmt(r.v) + (r.he ? '  (ปกติ ' + U.fmt(r.he) + ')' : ''); }, tip: function (r) { return 'ใน 1 ชั่วโมงล่าสุด ' + U.fmt(r.v) + ' ราย<br>ปกติช่วงเดียวกัน ≈ ' + U.fmt(r.he, 1); }, onClick: function (r) { DRILL.clinic(r.key); } }));
    else c2.chartEl.innerHTML = '<div class="empty sm">ยังไม่มีผู้ป่วยใน 1 ชั่วโมงล่าสุด</div>';
    c2.setTable([{ h: 'คลินิก' }, { h: '1 ชม.ล่าสุด', num: 1 }, { h: 'ปกติ', num: 1, d: 1 }], cl.map(function (o) { return [o.title, o.h, o.he]; }));

    // 3) ตามมิติที่เลือก
    var bd = LIVE.byDim(L, dim).sort(function (p, q) { return q.v - p.v; });
    var top = bd.slice(0, 14);
    var c3 = CH.card(U.$('#c3', root), { title: 'วันนี้แยกตาม' + D.DIM[dim].short, sub: 'ตัวเลขในวงเล็บ = ปกติถึงเวลาเดียวกัน · แท่งสีแดง = มากกว่าปกติเกิน 30% · กดแท่งเพื่อดูรายละเอียด', help: 'bydim', h: Math.max(260, top.length * 28 + 20) });
    if (top.length) c3.set(CH.barsH(c3.chartEl, top.map(function (o) { return { label: o.label, title: o.title, v: o.v, e: o.e, key: o.key, color: o.e && o.v / o.e > 1.3 ? CH.T().crit : null }; }), { labelW: 210, lbl: function (r) { return U.fmt(r.v) + '  (' + U.fmt(r.e) + ')'; }, tip: function (r) { return 'วันนี้ ' + U.fmt(r.v) + ' ราย<br>ปกติถึงเวลานี้ ≈ ' + U.fmt(r.e) + (r.e ? '<br>' + U.pct(r.v / r.e - 1, 0) : ''); }, onClick: function (r) { DRILL.dim(dim, r.key); } }));
    else c3.chartEl.innerHTML = '<div class="empty sm">ยังไม่มีข้อมูล</div>';
    c3.setTable([{ h: D.DIM[dim].short }, { h: 'วันนี้', num: 1 }, { h: 'ปกติถึงเวลานี้', num: 1 }, { h: '1 ชม.ล่าสุด', num: 1 }], bd.map(function (o) { return [o.title, o.v, Math.round(o.e), o.h]; }));

    // 4) สิทธิ
    var pr = D.rollup(L.R, 'ptg'), pgc = {}; D.PG.forEach(function (g, i) { pgc[g.id] = CH.T().cat[i % 8]; });
    var c4 = CH.card(U.$('#c4', root), { title: 'สิทธิการรักษาวันนี้', help: 'ptg', h: 260 });
    if (pr.length) c4.set(CH.donut(c4.chartEl, pr.map(function (r) { return { label: r.label, v: r.v, color: pgc[r.key] }; })));
    c4.setTable([{ h: 'กลุ่มสิทธิ' }, { h: 'ราย', num: 1 }, { h: '%', num: 1, d: 1 }], pr.map(function (r) { return [r.label, Math.round(r.v), r.share * 100]; }));

    // 5) แจ้งเตือน
    var c5 = U.el('<section class="card"><header class="ch"><div><h2>แจ้งเตือนความหนาแน่น' + UI.info('alerts') + '</h2><p class="sub">ประเมินทุกครั้งที่ดึงยอดใหม่</p></div></header><div class="cbody">' + ALERTS.html(8) + '</div></section>');
    U.$('#c5', root).appendChild(c5);

    // 6) heat: มิติ × ครึ่งชั่วโมง วันนี้
    var hs = top.slice(0, 12), hx = TR.labels(24, 87, st), hd = [];
    var keyIdx = {}; hs.forEach(function (o, i) { keyIdx[o.key] = i; });
    var cellv = hs.map(function () { return new Float64Array(hx.length); });
    for (var ci = 0; ci < D.nC; ci++) { if (!L.K.cm[ci]) continue; var ki = keyIdx[D.val(dim, ci)]; if (ki == null) continue; for (s = 24; s < 88 && s <= L.nowSlot; s++) cellv[ki][Math.floor((s - 24) / st)] += L.R.cs[ci * NS + s]; }
    hs.forEach(function (o, yi) { for (var xi = 0; xi < hx.length; xi++) if (24 + xi * st <= L.nowSlot) hd.push([xi, yi, cellv[yi][xi]]); });
    var c6 = CH.card(U.$('#c6', root), { title: 'วันนี้: ' + D.DIM[dim].short + ' × ช่วงเวลา', sub: 'ช่องละ ' + TR.unit(res) + ' · เฉพาะ 12 อันดับแรก', help: 'heat', h: Math.max(260, hs.length * 30 + 80), cls: 'span3' });
    if (hd.length) c6.set(CH.heat(c6.chartEl, { x: hx, y: hs.map(function (o) { return o.label; }), data: hd, labelW: 200, tip: function (d) { return '<b>' + U.esc(hs[d[1]].title) + '</b><br>' + hx[d[0]] + ' น. · ' + U.fmt(d[2]) + ' ราย'; } }));
    else c6.chartEl.innerHTML = '<div class="empty sm">ยังไม่มีข้อมูลวันนี้</div>';
    c6.setTable([{ h: D.DIM[dim].short }].concat(hx.map(function (h) { return { h: h, num: 1 }; })), hs.map(function (o, yi) { return [o.title].concat(Array.prototype.slice.call(cellv[yi])); }));

    if (first) countUp(root);
  }
};

/* ---------------- หน้าต่างรายละเอียด (กดจากกราฟ) ---------------- */
var DRILL = {
  clinic: function (code) { var c = D.byCode(code); if (c) DRILL.open('clinic', code, c.code + ' · ' + c.name, [c.unit ? D.shortLabel('unit', c.unit) : 'ยังไม่จัดกลุ่ม', c.zone, c.type, c.bld + (c.floor ? ' ชั้น ' + c.floor : '')].filter(Boolean).join(' · ')); },
  dim: function (dim, key) { if (dim === 'clinic') return DRILL.clinic(key); DRILL.open(dim, key, D.label(dim, key), D.DIM[dim].name); },
  /** ภาพรวม 90 วันล่าสุดของสิ่งที่เลือก: แนวโน้ม + ช่วงเวลาตามวันในสัปดาห์ + คลินิกย่อย */
  open: function (dim, key, title, sub) {
    var body = U.el('<div class="drill"><div class="kpis sm" id="dk"></div><div id="d1"></div><div class="grid g2"><div id="d2"></div><div id="d3"></div></div></div>');
    var m = UI.modal({ title: U.esc(title), sub: U.esc(sub) + ' · 90 วันล่าสุด (ตามตัวกรองปัจจุบัน)', body: body, wide: true, onClose: function () { } });
    var t = nowBkk().iso, from = U.addDays(t, -89), F = JSON.parse(JSON.stringify(D.filt()));
    F.dims = Object.assign({}, F.dims); F.dims[dim] = [key];
    body.querySelector('#dk').innerHTML = '<div class="loading-inline">กำลังโหลด…</div>';
    D.ensure(from, t, true).then(function () {
      var R = D.agg(from, t, { F: F, dow: true, slots: true });
      var ser = U.dates(from, t).map(function (d) { var x = R.byDay[d]; return x ? x[0] : null; });
      var wd = R.nd.W ? U.sum(Object.keys(R.byDay).filter(function (d) { return R.byDay[d][3] === 'W'; }).map(function (d) { return R.byDay[d][0]; })) / R.nd.W : 0;
      body.querySelector('#dk').innerHTML = kpi({ label: 'รวม 90 วัน', value: R.v, unit: 'ราย' }) + kpi({ label: 'เฉลี่ยวันทำการ', value: wd, unit: 'ราย/วัน' }) + kpi({ label: 'มาตามนัด', value: R.v ? U.share(R.a / R.v, 0) : '–' }) + kpi({ label: 'walk-in', value: R.v ? U.share(R.w / R.v, 0) : '–' });
      var c1 = CH.card(body.querySelector('#d1'), { title: 'ยอดรายวัน', h: 220, tools: {} });
      c1.set(CH.line(c1.chartEl, { x: U.dates(from, t).map(function (d) { return U.thDate(d, { noYear: true }); }), series: [{ name: 'ยอด', data: ser, area: true }] }));
      var st = TR.step(), hx = TR.labels(24, 87, st), hd = [], mx = 0;
      [1, 2, 3, 4, 5, 6, 0].forEach(function (w, yi) { var n = R.dowN[w] || 1, arr = TR.bin(R.dowS, w * NS, 24, 87, st); arr.forEach(function (v0, xi) { var v = v0 / n; hd.push([xi, yi, Math.round(v * 10) / 10]); mx = Math.max(mx, v); }); });
      var c2 = CH.card(body.querySelector('#d2'), { title: 'เฉลี่ยต่อวัน ตามวันและเวลา (ช่องละ ' + TR.unit() + ')', h: 250, tools: {} });
      c2.set(CH.heat(c2.chartEl, { x: hx, y: ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'], data: hd, labelW: 70 }));
      var sub2 = D.rollup(R, dim === 'clinic' ? 'ptg' : 'clinic').slice(0, 10);
      var c3 = CH.card(body.querySelector('#d3'), { title: dim === 'clinic' ? 'สิทธิการรักษา' : 'คลินิกย่อย (10 อันดับ)', h: 250, tools: {} });
      c3.set(CH.barsH(c3.chartEl, sub2.map(function (r) { return { label: r.short, title: r.label, v: r.v }; }), { labelW: 160 }));
    });
  }
};

/* ---------------- คลินิกที่ HIS ส่งมาแต่ยังไม่จัดกลุ่ม (เฉพาะแอดมินเห็นแถบเตือน) ---------------- */
var UNMAPPED = {
  /** คลินิกที่ไม่อยู่ในผังแต่มีผู้ป่วยในข้อมูลที่โหลดไว้ (30 วันล่าสุด) */
  list: function () {
    var t = nowBkk().iso, from = U.addDays(t, -30), cnt = {};
    Object.keys(D.DAYS).forEach(function (d) { if (d < from || d > t) return; var x = D.DAYS[d]; if (!x.cl) return; for (var i = 0; i < x.cl.length; i += 4) { var c = D.C[x.cl[i]]; if (c && !c.mapped) cnt[c.i] = (cnt[c.i] || 0) + x.cl[i + 1]; } });
    return Object.keys(cnt).map(function (i) { return { c: D.C[i], n: cnt[i] }; }).sort(function (a, b) { return b.n - a.n; });
  },
  banner: function () {
    if (S.me.role !== 'admin') return '';
    var L = UNMAPPED.list(); if (!L.length) return '';
    var tot = L.reduce(function (s, x) { return s + x.n; }, 0);
    return '<div class="flag-bar" role="note"><b class="fi">!</b><div><b>มีคลินิกจาก HIS ที่ยังไม่จัดกลุ่ม ' + L.length + ' คลินิก</b> (' + U.fmt(tot) + ' ราย ใน 30 วันล่าสุด · ไม่นับในยอด OPD)<br><span class="small">' + L.slice(0, 6).map(function (x) { return U.esc(x.c.code) + ' ' + U.esc(x.c.name.replace(/^คลินิก/, '').slice(0, 24)) + ' (' + U.fmt(x.n) + ')'; }).join(' · ') + (L.length > 6 ? ' …' : '') + '</span></div><a class="btn sm" href="#/admin" onclick="STORE.set(\'u:\' + S.me.emp + \':adTab\', \'clinics\'); STORE.set(\'u:\' + S.me.emp + \':cShow\', \'new\')">จัดกลุ่ม</a></div>';
  }
};
