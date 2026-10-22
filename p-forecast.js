/* =====================================================================
   p-forecast.js — คาดการณ์แนวโน้ม รายวัน / รายเดือน / รายปี (ปีงบหรือปีปฏิทิน)
   ใช้ข้อมูลย้อนหลังทั้งหมดตามตัวกรอง · มีช่วงความเชื่อมั่น 80% และวัดความแม่นยำย้อนหลังให้เห็น
   ===================================================================== */
'use strict';
PAGE_FN.forecast = function (root) {
  var tools = U.$('#topTools'), hz = STORE.get('u:' + S.me.emp + ':fcH', 30);
  FUI.bar(tools, function () { load(); });
  var seg = U.el('<div class="seg">' + [[14, '14 วัน'], [30, '30 วัน'], [90, '3 เดือน'], [365, '12 เดือน']].map(function (o) { return '<button data-h="' + o[0] + '" class="' + (hz === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>');
  tools.appendChild(seg);
  U.$$('button', seg).forEach(function (b) { b.onclick = function () { hz = +b.getAttribute('data-h'); STORE.set('u:' + S.me.emp + ':fcH', hz); U.$$('button', seg).forEach(function (x) { x.classList.toggle('on', x === b); }); load(); }; });
  var fyT = U.el('<label class="fy-tog"><input type="checkbox"' + (PER.fiscal() ? ' checked' : '') + '><span>ปีงบประมาณ</span></label>');
  tools.appendChild(fyT);
  fyT.querySelector('input').onchange = function () { STORE.set('u:' + S.me.emp + ':fiscal', this.checked); load(); };
  var tables = {};
  EXP.toolbar(tools, { title: 'คาดการณ์ยอดผู้ป่วยนอก', xlsx: function () { EXP.xlsx('คาดการณ์ยอดผู้ป่วยนอก', Object.keys(tables).map(function (k) { return { name: k, cols: tables[k].cols, rows: tables[k].rows }; })); } });
  load();

  function load() {
    var t = nowBkk().iso;
    root.innerHTML = '<div class="loading-block"><div class="ld-rib"></div><p>กำลังโหลดสถิติย้อนหลังทั้งหมดเพื่อคำนวณ… (ครั้งแรกอาจใช้เวลาสักครู่ ครั้งต่อไปเร็วขึ้น)</p></div>';
    D.ensure(D.firstDate(), t, false).then(function () { setTimeout(draw, 20); }).catch(function (e) { root.innerHTML = '<div class="empty"><b>โหลดข้อมูลไม่สำเร็จ</b><p>' + U.esc(e.message) + '</p></div>'; });
  }
  function draw() {
    CH.disposeAll(); tables = {};
    var t = nowBkk().iso, y = U.addDays(t, -1), fiscal = PER.fiscal();
    var ser = D.dailySeries(D.firstDate(), y);
    var m = FC.fit(ser);
    if (!m.ok) { root.innerHTML = '<div class="empty"><b>ข้อมูลย้อนหลังยังไม่พอสำหรับคาดการณ์</b><p>ต้องมีอย่างน้อย 8 สัปดาห์ (ตอนนี้มี ' + m.n + ' วัน) · ดึงข้อมูลย้อนหลังได้ที่ ตั้งค่า › การดึงข้อมูล</p></div>'; return; }
    var bt = FC.backtest(ser), end = U.addDays(t, Math.max(hz, 400)), fut = FC.predict(m, U.dates(t, end)), byD = {};
    fut.forEach(function (p) { byD[p.d] = p; });
    var act = {}; ser.forEach(function (x) { if (x.v != null) act[x.d] = x.v; });
    // วันนี้: ใช้ค่าจริงถึงตอนนี้ไม่ได้ (ยังไม่ครบวัน) → ใช้ค่าคาดการณ์ทั้งวัน
    var nextW = fut.filter(function (p) { return p.d > t && p.dt === 'W'; })[0];
    var wk = FC.rollupRange({}, fut, U.addDays(t, 1), U.addDays(t, 7));
    var ym = t.slice(0, 7), mon = FC.rollupRange(act, fut, ym + '-01', U.lastDay(ym)), lyMon = sumAct(act, (+ym.slice(0, 4) - 1) + ym.slice(4) + '-01', U.lastDay((+ym.slice(0, 4) - 1) + ym.slice(4)));
    var yr = PER.make('year', t, fiscal), yrR = FC.rollupRange(act, fut, yr.from, yr.to), lyYr = PER.lastYear(yr), lyYrV = sumAct(act, lyYr.from, lyYr.to);
    var nyr = PER.make('year', U.addDays(yr.to, 1), fiscal), nyrR = FC.rollupRange(act, FC.predict(m, U.dates(nyr.from, nyr.to)), nyr.from, nyr.to);

    root.innerHTML = '<p class="ctx">คำนวณจากข้อมูล ' + U.thDate(D.firstDate()) + ' – ' + U.thDate(y) + ' (' + U.fmt(m.n) + ' วัน) ตามตัวกรองปัจจุบัน · ช่วงความเชื่อมั่น 80% ' + UI.info('fcmodel') + '</p>' +
      '<div class="kpis">' +
      kpi({ label: 'วันทำการถัดไป', value: nextW ? Math.round(nextW.yhat) : '–', unit: 'ราย', sub: nextW ? U.thDate(nextW.d, { dow: true }) + ' · ช่วง ' + U.fmt(nextW.lo80) + '–' + U.fmt(nextW.hi80) : '', help: 'fcnext' }) +
      kpi({ label: '7 วันข้างหน้า', value: Math.round(wk.yhat), unit: 'ราย', sub: 'ช่วง ' + U.fmt(wk.lo) + '–' + U.fmt(wk.hi) }) +
      kpi({ label: 'ทั้งเดือน' + U.MTH[+ym.slice(5) - 1], value: Math.round(mon.yhat), unit: 'ราย', delta: lyMon ? mon.yhat / lyMon - 1 : null, deltaLabel: 'เทียบเดือนเดียวกันปีก่อน', sub: 'จริงแล้ว ' + U.fmt(mon.act) + ' + คาดการณ์ ' + U.fmt(mon.fc), help: 'fcmonth' }) +
      kpi({ label: yr.label, value: Math.round(yrR.yhat), unit: 'ราย', delta: lyYrV && yrR.nF < 360 ? yrR.yhat / lyYrV - 1 : null, deltaLabel: 'เทียบปีก่อน', sub: 'ช่วง ' + U.fmt(yrR.lo) + '–' + U.fmt(yrR.hi), help: 'fcyear' }) +
      kpi({ label: 'ความแม่นยำย้อนหลัง', value: bt ? '±' + U.fmt(bt.wapeW * 100, 1) + '%' : '–', sub: bt ? 'วันทำการ · ทดสอบ ' + bt.n + ' วันล่าสุด' : 'ข้อมูลยังไม่พอทดสอบ', help: 'fcacc', cls: bt && bt.wapeW < 0.08 ? 'good' : '' }) +
      '</div><div class="grid g-fc"><div id="f1"></div><div id="f2"></div><div id="f3"></div><div id="f4"></div><div id="f5"></div></div>';

    /* 1) กราฟหลัก */
    if (hz <= 90) {
      var hist = U.dates(U.addDays(t, -Math.max(60, hz)), y), fd = U.dates(t, U.addDays(t, hz - 1)), xs = hist.concat(fd);
      var c1 = CH.card(U.$('#f1', root), { title: 'ยอดรายวัน: ที่ผ่านมา และคาดการณ์ ' + hz + ' วัน', sub: 'แถบสี = ช่วงที่ค่าจริงน่าจะอยู่ (80%) · เส้นประ = ค่าคาดการณ์', help: 'fcchart', h: 320, cls: 'span3' });
      var A = xs.map(function (d) { return d <= y ? (act[d] == null ? null : Math.round(act[d])) : null; });
      var Fv = xs.map(function (d) { return d >= t || d === y ? (byD[d] ? Math.round(byD[d].yhat) : (d === y ? A[xs.indexOf(d)] : null)) : null; });
      c1.set(CH.line(c1.chartEl, { x: xs.map(function (d) { return U.thDate(d, { noYear: true }); }), series: [{ name: 'ค่าจริง', data: A, area: true }, { name: 'คาดการณ์', data: Fv, dash: true, color: CH.T().cat[1] }],
        band: { name: 'ช่วง 80%', lo: xs.map(function (d) { return byD[d] ? Math.round(byD[d].lo80) : null; }), hi: xs.map(function (d) { return byD[d] ? Math.round(byD[d].hi80) : null; }), color: CH.T().cat[1] },
        tipTitle: function (i) { var d = xs[i]; return U.thDate(d, { dow: true }) + (D.hol[d] ? ' · ' + D.hol[d] : ''); }, bandTip: function (i) { var p = byD[xs[i]]; return p ? 'ช่วง 80%: ' + U.fmt(p.lo80) + '–' + U.fmt(p.hi80) : ''; } }));
      var rowsF = fd.map(function (d) { var p = byD[d]; return [d, U.DOWF[U.dow(d)], D.DT[p.dt] + (D.hol[d] ? ' · ' + D.hol[d] : ''), Math.round(p.yhat), Math.round(p.lo80), Math.round(p.hi80)]; });
      var colsF = [{ h: 'วันที่' }, { h: 'วัน' }, { h: 'ประเภทวัน' }, { h: 'คาดการณ์', num: 1 }, { h: 'ต่ำสุด (80%)', num: 1 }, { h: 'สูงสุด (80%)', num: 1 }];
      c1.setTable(colsF, rowsF); tables['รายวัน'] = { cols: colsF, rows: rowsF };
    } else {
      var months = U.ymList(U.ymAdd(ym, -24), U.ymAdd(ym, 11)), futAll = FC.predict(m, U.dates(t, U.lastDay(U.ymAdd(ym, 11))));
      var mm = months.map(function (x) { return x < ym ? { ym: x, act: sumAct(act, x + '-01', U.lastDay(x)) } : Object.assign({ ym: x }, FC.rollupRange(act, futAll, x + '-01', U.lastDay(x))); });
      var c1b = CH.card(U.$('#f1', root), { title: 'ยอดรายเดือน: 24 เดือนที่ผ่านมา และคาดการณ์ 12 เดือน', sub: 'เดือนปัจจุบัน = ค่าจริงถึงเมื่อวาน + คาดการณ์ส่วนที่เหลือ', help: 'fcchart', h: 320, cls: 'span3' });
      c1b.set(CH.line(c1b.chartEl, { x: months.map(function (x) { return U.thMonth(x); }), series: [{ name: 'ค่าจริง', data: mm.map(function (o) { return o.ym < ym ? Math.round(o.act) : null; }), area: true, showSymbol: true }, { name: 'คาดการณ์', data: mm.map(function (o, i) { return o.ym >= ym ? Math.round(o.yhat) : (months[i + 1] === ym ? Math.round(o.act) : null); }), dash: true, color: CH.T().cat[1], showSymbol: true }],
        band: { name: 'ช่วง 80%', lo: mm.map(function (o) { return o.ym >= ym ? Math.round(o.lo) : null; }), hi: mm.map(function (o) { return o.ym >= ym ? Math.round(o.hi) : null; }), color: CH.T().cat[1] } }));
      var colsM = [{ h: 'เดือน' }, { h: 'ค่าจริง', num: 1 }, { h: 'คาดการณ์', num: 1 }, { h: 'ต่ำสุด (80%)', num: 1 }, { h: 'สูงสุด (80%)', num: 1 }];
      var rowsM = mm.map(function (o) { return [U.thMonth(o.ym, true), o.ym < ym ? Math.round(o.act) : o.act ? Math.round(o.act) : '', o.ym >= ym ? Math.round(o.yhat) : '', o.ym >= ym ? Math.round(o.lo) : '', o.ym >= ym ? Math.round(o.hi) : '']; });
      c1b.setTable(colsM, rowsM); tables['รายเดือน'] = { cols: colsM, rows: rowsM };
    }

    /* 2) 12 เดือนข้างหน้า (ตาราง) */
    var fut12 = FC.predict(m, U.dates(t, U.lastDay(U.ymAdd(ym, 11))));
    var mrows = U.ymList(ym, U.ymAdd(ym, 11)).map(function (x) {
      var rr = FC.rollupRange(act, fut12, x + '-01', U.lastDay(x)), lyv = sumAct(act, (+x.slice(0, 4) - 1) + x.slice(4) + '-01', U.lastDay((+x.slice(0, 4) - 1) + x.slice(4)));
      var wd = U.dates(x + '-01', U.lastDay(x)).filter(function (d) { return D.dayType(d) === 'W'; }).length;
      return { ym: x, wd: wd, r: rr, ly: lyv };
    });
    var maxM = Math.max.apply(null, mrows.map(function (o) { return o.r.yhat; }));
    var c2 = U.el('<section class="card span2"><header class="ch"><div><h2>คาดการณ์ 12 เดือนข้างหน้า' + UI.info('fc12') + '</h2><p class="sub">คิดจากจำนวนวันทำการจริงของแต่ละเดือน (ตามปฏิทินวันหยุดในระบบ)</p></div></header><div class="cbody"><div class="tscroll"><table class="tbl"><thead><tr><th>เดือน</th><th class="num">วันทำการ</th><th class="num">คาดการณ์</th><th></th><th class="num">ช่วง 80%</th><th class="num">ปีก่อน</th><th class="num">เปลี่ยนแปลง</th></tr></thead><tbody>' +
      mrows.map(function (o) { return '<tr><td>' + U.thMonth(o.ym, true) + (o.ym === ym ? ' <span class="tag">เดือนนี้</span>' : '') + '</td><td class="num">' + o.wd + '</td><td class="num"><b>' + U.fmt(o.r.yhat) + '</b></td><td class="mbar"><i style="width:' + (o.r.yhat / maxM * 100).toFixed(1) + '%"></i></td><td class="num muted">' + U.fmt(o.r.lo) + '–' + U.fmt(o.r.hi) + '</td><td class="num">' + (o.ly ? U.fmt(o.ly) : '–') + '</td><td class="num">' + (o.ly ? U.pct(o.r.yhat / o.ly - 1) : '–') + '</td></tr>'; }).join('') +
      '</tbody></table></div></div></section>');
    U.$('#f2', root).appendChild(c2);
    tables['12 เดือน'] = { cols: [{ h: 'เดือน' }, { h: 'วันทำการ', num: 1 }, { h: 'คาดการณ์', num: 1 }, { h: 'ต่ำสุด', num: 1 }, { h: 'สูงสุด', num: 1 }, { h: 'ปีก่อน', num: 1 }], rows: mrows.map(function (o) { return [U.thMonth(o.ym, true), o.wd, Math.round(o.r.yhat), Math.round(o.r.lo), Math.round(o.r.hi), o.ly ? Math.round(o.ly) : '']; }) };

    /* 3) รายปี */
    var c3 = U.el('<section class="card"><header class="ch"><div><h2>' + (fiscal ? 'ปีงบประมาณ' : 'รายปี') + UI.info('fcyear') + '</h2><p class="sub">' + (fiscal ? 'ต.ค.–ก.ย.' : 'ม.ค.–ธ.ค.') + '</p></div></header><div class="cbody yrs">' +
      [[lyYr.from, lyYr.to, 'ปีก่อน', { yhat: lyYrV, act: lyYrV, fc: 0 }], [yr.from, yr.to, 'ปีนี้', yrR], [nyr.from, nyr.to, 'ปีหน้า', nyrR]].map(function (o) {
        var lbl = PER.make('year', o[0], fiscal).label;
        return '<div class="yr"><span>' + o[2] + '</span><b>' + lbl + '</b><strong>' + (o[3].yhat ? U.fmt(o[3].yhat) : '–') + '</strong><small>' + (o[3].fc ? 'จริง ' + U.fmt(o[3].act) + ' · คาดการณ์ ' + U.fmt(o[3].fc) + (o[3].lo ? '<br>ช่วง ' + U.fmt(o[3].lo) + '–' + U.fmt(o[3].hi) : '') : 'ค่าจริงทั้งปี') + '</small></div>';
      }).join('') + '</div></section>');
    U.$('#f3', root).appendChild(c3);

    /* 4) ความแม่นยำย้อนหลัง */
    var c4 = CH.card(U.$('#f4', root), { title: 'ทดสอบความแม่นยำย้อนหลัง', sub: bt ? 'ซ่อนข้อมูล ' + bt.n + ' วันล่าสุด แล้วให้ระบบทาย · คลาดเคลื่อนเฉลี่ย ' + U.fmt(bt.wapeW * 100, 1) + '% (วันทำการ) · ค่าจริงอยู่ในช่วง 80% ' + U.share(bt.cover80, 0) + ' ของวัน' : 'ข้อมูลยังไม่พอ', help: 'fcacc', h: 260, cls: 'span2' });
    if (bt) {
      c4.set(CH.line(c4.chartEl, { x: bt.pairs.map(function (p) { return U.thDate(p.d, { noYear: true }); }), series: [{ name: 'ค่าจริง', data: bt.pairs.map(function (p) { return Math.round(p.v); }) }, { name: 'ระบบทาย', data: bt.pairs.map(function (p) { return Math.round(p.yhat); }), dash: true, color: CH.T().cat[1] }] }));
      c4.setTable([{ h: 'วันที่' }, { h: 'ค่าจริง', num: 1 }, { h: 'ระบบทาย', num: 1 }, { h: 'คลาด %', num: 1, d: 1 }], bt.pairs.map(function (p) { return [p.d, Math.round(p.v), Math.round(p.yhat), p.v ? (p.yhat / p.v - 1) * 100 : '']; }));
    }

    /* 5) วันที่คาดว่าคนมาก */
    var soon = fut.filter(function (p) { return p.d >= t && p.d <= U.addDays(t, Math.min(hz, 90)) && p.dt === 'W'; });
    var avgW = soon.length ? U.sum(soon.map(function (p) { return p.yhat; })) / soon.length : 0;
    var hot = soon.slice().sort(function (a, b) { return b.yhat - a.yhat; }).slice(0, 8);
    var c5 = U.el('<section class="card"><header class="ch"><div><h2>วันที่คาดว่าคนมาก' + UI.info('fchot') + '</h2><p class="sub">วันทำการใน ' + Math.min(hz, 90) + ' วันข้างหน้า · เทียบค่าเฉลี่ย ' + U.fmt(avgW) + ' ราย/วัน</p></div></header><div class="cbody"><ol class="rank">' +
      hot.map(function (p) { var gap = 0; for (var k = 1; k <= 6 && D.dayType(U.addDays(p.d, -k)) !== 'W'; k++) gap++; gap = gap >= 3; return '<li><b>' + U.thDate(p.d, { dow: true }) + '</b><span class="num">' + U.fmt(p.yhat) + '</span><em>' + U.pct(p.yhat / avgW - 1, 0) + (gap ? ' · หลังหยุดยาว' : '') + '</em></li>'; }).join('') + '</ol></div></section>');
    U.$('#f5', root).appendChild(c5);
    countUp(root);
  }
  function sumAct(act, a, b) { var s = 0, any = false; U.dates(a, b).forEach(function (d) { if (act[d] != null) { s += act[d]; any = true; } }); return any ? s : null; }
};
