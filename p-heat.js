/* =====================================================================
   p-heat.js — ความหนาแน่นตามเวลา (Heat map)
   วันในสัปดาห์ × ช่วงเวลา · ตึก/ชั้น/กลุ่ม × ช่วงเวลา · ปฏิทินรายวัน · ช่วงพีค
   ค่าในช่อง = จำนวนผู้ป่วยที่มาถึง "เฉลี่ยต่อวัน" ในช่วงเวลานั้น (เวลาลงทะเบียน/เปิด visit จาก HIS)
   ===================================================================== */
'use strict';
PAGE_FN.heat = function (root) {
  var tools = U.$('#topTools'), dim, size = STORE.get('u:' + S.me.emp + ':hSize', 2), meas = 'v';
  FUI.bar(tools, function () { load(); });
  var pc = PER.control(tools, function () { load(); }, { kinds: ['week', 'month', 'quarter', 'year', 'custom'] });
  dim = FUI.dimSelect(tools, 'heatDim', 'floor', function (d) { dim = d; load(); });
  EXP.toolbar(tools, { title: 'ความหนาแน่นผู้ป่วยนอกตามช่วงเวลา' });
  if (pc.get().kind === 'day') { PER.set(PER.make('month', nowBkk().iso)); }
  load();

  function load() {
    var p = pc.get(), r = PER.clip(p);
    if (r.from > r.to) { root.innerHTML = '<div class="empty"><b>ช่วงนี้ยังไม่มีข้อมูล</b></div>'; return; }
    root.innerHTML = '<div class="loading-block"><div class="ld-rib"></div><p>กำลังโหลดข้อมูลรายช่วงเวลา ' + U.esc(p.label) + '…</p></div>';
    D.ensure(r.from, r.to, true).then(function () { draw(p, r); }).catch(function (e) { root.innerHTML = '<div class="empty"><b>โหลดข้อมูลไม่สำเร็จ</b><p>' + U.esc(e.message) + '</p></div>'; });
  }
  function draw(p, r) {
    CH.disposeAll();
    var R = D.agg(r.from, r.to, { dow: true, cs: true, slots: true });
    var s0 = 20, s1 = 87, xs = [], step = size;
    for (var s = s0; s <= s1; s += step) xs.push(U.hhmm(s));
    var bin = function (arr, base) { var o = []; for (var s2 = s0; s2 <= s1; s2 += step) { var v = 0; for (var k = 0; k < step; k++) v += arr[base + s2 + k] || 0; o.push(v); } return o; };
    // สรุปพีค
    var all = []; for (s = 0; s < NS; s++) all.push(R.bySlot[s * 2]);
    var days = R.days || 1, peakS = 0; for (s = 0; s < NS; s++) if (all[s] > all[peakS]) peakS = s;
    var before9 = 0, tot = U.sum(all) || 1; for (s = 0; s < 36; s++) before9 += all[s];
    var dowAvg = [0, 1, 2, 3, 4, 5, 6].map(function (w) { var v = 0; for (s = 0; s < NS; s++) v += R.dowS[w * NS + s]; return R.dowN[w] ? v / R.dowN[w] : 0; });
    var busyW = dowAvg.indexOf(Math.max.apply(null, dowAvg));
    var hourMax = 0; for (s = 0; s < NS; s += 4) hourMax = Math.max(hourMax, all[s] + all[s + 1] + all[s + 2] + all[s + 3]);
    root.innerHTML = '<p class="ctx">' + U.esc(p.label) + ' · ' + R.days + ' วันที่มีข้อมูล' + (R.slotsOk ? '' : ' · <span class="tag">บางวันยังไม่มีข้อมูลรายช่วงเวลา</span>') + '</p>' +
      '<div class="kpis">' +
      kpi({ label: 'ช่วง 15 นาทีที่แน่นที่สุด', value: U.hhmm(peakS) + '–' + U.hhmm(peakS + 1), sub: 'เฉลี่ย ' + U.fmt(all[peakS] / days, 1) + ' ราย/วัน', help: 'peak' }) +
      kpi({ label: 'ชั่วโมงที่แน่นที่สุด', value: U.fmt(hourMax / days, 0), unit: 'ราย/ชม.', sub: 'เฉลี่ยต่อวัน', help: 'peakhour' }) +
      kpi({ label: 'มาถึงก่อน 09:00 น.', value: U.share(before9 / tot, 0), sub: U.fmt(before9 / days) + ' ราย/วัน', help: 'before9' }) +
      kpi({ label: 'วันที่คนมากที่สุด', value: 'วัน' + U.DOWF[busyW], sub: 'เฉลี่ย ' + U.fmt(dowAvg[busyW]) + ' ราย/วัน', help: 'busyday' }) +
      '</div>' +
      '<div class="grid g-heat"><div id="h1"></div><div id="h2"></div><div id="h3"></div><div id="h4"></div></div>';

    /* 1) วัน × เวลา */
    var segS = U.el('<div class="seg sm">' + [[1, '15 นาที'], [2, '30 นาที'], [4, '1 ชม.']].map(function (o) { return '<button data-z="' + o[0] + '" class="' + (size === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>');
    var segM = U.el('<div class="seg sm"><button data-m="v" class="' + (meas === 'v' ? 'on' : '') + '">ทั้งหมด</button><button data-m="w" class="' + (meas === 'w' ? 'on' : '') + '">walk-in</button><button data-m="a" class="' + (meas === 'a' ? 'on' : '') + '">ตามนัด</button></div>');
    U.$$('[data-z]', segS).forEach(function (b) { b.onclick = function () { size = +b.getAttribute('data-z'); STORE.set('u:' + S.me.emp + ':hSize', size); draw(p, r); }; });
    U.$$('[data-m]', segM).forEach(function (b) { b.onclick = function () { meas = b.getAttribute('data-m'); draw(p, r); }; });
    var order = [1, 2, 3, 4, 5, 6, 0], data = [], trows = [];
    order.forEach(function (w, yi) {
      var n = R.dowN[w] || 0, arrV = bin(R.dowS, w * NS), arrW = bin(R.dowW, w * NS);
      var row = [U.DOWF[w] + ' (' + n + ' วัน)'];
      arrV.forEach(function (v, xi) { var val = meas === 'v' ? v : meas === 'w' ? arrW[xi] : v - arrW[xi]; val = n ? val / n : 0; data.push([xi, yi, Math.round(val * 10) / 10]); row.push(Math.round(val * 10) / 10); });
      trows.push(row);
    });
    var c1 = CH.card(U.$('#h1', root), { title: 'วันในสัปดาห์ × ช่วงเวลา', sub: 'เฉลี่ยต่อวัน · ' + ({ v: 'ผู้ป่วยทั้งหมด', w: 'เฉพาะ walk-in', a: 'เฉพาะมาตามนัด' })[meas], help: 'heatdow', h: 330, cls: 'span3', extra: [segM, segS] });
    c1.set(CH.heat(c1.chartEl, { x: xs, y: order.map(function (w) { return U.DOWF[w]; }), data: data, labelW: 80, labels: size >= 2 && innerWidth > 900, labelMin: 1, tip: function (d) { return '<b>วัน' + U.DOWF[order[d[1]]] + '</b> ' + xs[d[0]] + ' น.<br>เฉลี่ย ' + U.fmt(d[2], 1) + ' ราย/วัน'; } }));
    c1.setTable([{ h: 'วัน' }].concat(xs.map(function (h) { return { h: h, num: 1, d: 1 }; })), trows);

    /* 2) มิติ × เวลา */
    var top = D.rollup(R, dim).slice(0, 20), ki = {}; top.forEach(function (o, i) { ki[o.key] = i; });
    var mat = top.map(function () { return new Float64Array(NS); });
    for (var ci = 0; ci < D.nC; ci++) { var i2 = ki[D.val(dim, ci)]; if (i2 == null) continue; for (s = 0; s < NS; s++) mat[i2][s] += R.cs[ci * NS + s]; }
    var d2 = [], tr2 = [];
    top.forEach(function (o, yi) { var arr = bin(mat[yi], 0), row = [o.label]; arr.forEach(function (v, xi) { var a = v / days; d2.push([xi, yi, Math.round(a * 10) / 10]); row.push(Math.round(a * 10) / 10); }); tr2.push(row); });
    var c2 = CH.card(U.$('#h2', root), { title: D.DIM[dim].short + ' × ช่วงเวลา', sub: 'เฉลี่ยต่อวัน · ' + (top.length < D.rollup(R, dim).length ? '20 อันดับแรก' : 'ทุกรายการ') + ' · กดช่องเพื่อดูรายละเอียด', help: 'heat', h: Math.max(280, top.length * 26 + 90), cls: 'span3' });
    c2.set(CH.heat(c2.chartEl, { x: xs, y: top.map(function (o) { return o.short; }), data: d2, labelW: 210, tip: function (d) { return '<b>' + U.esc(top[d[1]].label) + '</b><br>' + xs[d[0]] + ' น. · เฉลี่ย ' + U.fmt(d[2], 1) + ' ราย/วัน'; }, onClick: function (d) { DRILL.dim(dim, top[d[1]].key); } }));
    c2.setTable([{ h: D.DIM[dim].short }].concat(xs.map(function (h) { return { h: h, num: 1, d: 1 }; })), tr2);

    /* 3) ปฏิทิน */
    var cal = Object.keys(R.byDay).map(function (d) { return [d, Math.round(R.byDay[d][0])]; });
    var c3 = CH.card(U.$('#h3', root), { title: 'ปฏิทินความหนาแน่นรายวัน', sub: 'ยอดรวมต่อวัน · เห็นวันหยุดยาวและวันหลังหยุดยาวชัดเจน', help: 'calendar', h: 220, cls: 'span2' });
    c3.set(CH.calendar(c3.chartEl, { from: r.from, to: r.to, data: cal }));
    c3.setTable([{ h: 'วันที่' }, { h: 'วัน' }, { h: 'ประเภทวัน' }, { h: 'ราย', num: 1 }], cal.map(function (x) { return [x[0], U.DOWF[U.dow(x[0])], D.DT[D.dayType(x[0])] + (D.hol[x[0]] ? ' · ' + D.hol[x[0]] : ''), x[1]]; }));

    /* 4) วันที่คนมากที่สุด */
    var topDays = cal.slice().sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
    var c4 = U.el('<section class="card"><header class="ch"><div><h2>10 วันที่คนมากที่สุด' + UI.info('topdays') + '</h2><p class="sub">ช่วงที่เลือก</p></div></header><div class="cbody"><ol class="rank">' +
      topDays.map(function (x) { var gap = D.dayType(U.addDays(x[0], -1)) !== 'W' && U.dow(x[0]) !== 1 || (U.dow(x[0]) === 1 && D.dayType(U.addDays(x[0], -3)) !== 'W'); return '<li><b>' + U.thDate(x[0], { dow: true }) + '</b><span class="num">' + U.fmt(x[1]) + '</span>' + (gap ? '<em>หลังวันหยุดยาว/นักขัตฤกษ์</em>' : '') + '</li>'; }).join('') + '</ol></div></section>');
    U.$('#h4', root).appendChild(c4);
    countUp(root);
  }
};
