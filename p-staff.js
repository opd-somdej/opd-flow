/* =====================================================================
   p-staff.js — วางแผนอัตรากำลังพยาบาล (FTE)
   สูตร (คู่มือการวิเคราะห์ภาระงาน กรมการแพทย์ · หน้า 10):
     FTE = (ผู้ป่วยเฉลี่ยต่อวัน × ชั่วโมงการพยาบาลต่อราย × 1.2 × 1.4) ÷ ชั่วโมงทำงานพยาบาล 1 คนต่อวัน (7)
       1.2 = ชดเชยการลา (พักผ่อน/ป่วย/อบรม) · 1.4 = ทดแทนการทำงาน 7 วันจาก 5 วันทำงาน
     ขึ้นปฏิบัติงานต่อวัน = FTE × 2,080 ÷ (365 × 8)
   ช่วงพีค: พยาบาลที่ต้องอยู่พร้อมกัน = ผู้ป่วยที่มาถึงในช่วง "ระยะเวลาอยู่ในคลินิก" ที่ผ่านมา × ชม.การพยาบาลต่อราย ÷ ระยะเวลานั้น
   ⚠ ค่าชั่วโมงการพยาบาลต่อราย (NHPPD ของ OPD) ยังไม่มีเกณฑ์ของ รพ. — ค่าตั้งต้นเป็นค่าสมมติ แอดมินปรับได้
   ===================================================================== */
'use strict';
PAGE_FN.staff = function (root) {
  var tools = U.$('#topTools'), st = S.boot.settings, dim, basis = STORE.get('u:' + S.me.emp + ':stBasis', 'act'), sel = null;
  var P = { nh: Object.assign({}, st.nhppd || {}), act: Object.assign({}, st.actual || {}), hours: +st.hoursPerDay || 7, relief: +st.relief || 1.2, week: +st.weekFactor || 1.4, dwell: +st.dwellHours || 2 };
  if (!P.nh['default']) P.nh['default'] = 0.2;
  FUI.bar(tools, function () { load(); });
  var pc = PER.control(tools, function () { load(); }, { kinds: ['month', 'quarter', 'year', 'custom'] });
  dim = FUI.dimSelect(tools, 'stDim', st.staffDim || 'grp', function (d) { dim = d; sel = null; load(); });
  var rowsOut = null;
  EXP.toolbar(tools, { title: 'วางแผนอัตรากำลังพยาบาล', xlsx: function () { if (rowsOut) EXP.xlsx('อัตรากำลังพยาบาล ' + pc.get().label, [rowsOut]); } });
  if (pc.get().kind === 'day' || pc.get().kind === 'week') PER.set(PER.make('quarter', nowBkk().iso));
  load();

  function load() {
    var p = pc.get(), r = PER.clip(p), t = nowBkk().iso;
    root.innerHTML = '<div class="loading-block"><div class="ld-rib"></div><p>กำลังโหลดข้อมูลสำหรับคำนวณอัตรากำลัง…</p></div>';
    var need = [D.ensure(r.from, r.to, true)];
    if (basis === 'fc') need.push(D.ensure(D.firstDate(), t, false));
    Promise.all(need).then(function () { draw(p, r); }).catch(function (e) { root.innerHTML = '<div class="empty"><b>โหลดข้อมูลไม่สำเร็จ</b><p>' + U.esc(e.message) + '</p></div>'; });
  }
  function nhOf(k) { var v = P.nh[dim + '|' + k]; return v != null && v !== '' ? +v : +P.nh['default']; }
  function actOf(k) { var v = P.act[dim + '|' + k]; return v != null && v !== '' ? +v : null; }

  function draw(p, r) {
    CH.disposeAll();
    var F = JSON.parse(JSON.stringify(D.filt())); F.dts = ['W'];
    var R = D.agg(r.from, r.to, { F: F, cs: true });
    var nW = R.nd.W || 1, rows = D.rollup(R, dim);
    // คาดการณ์ 3 เดือนข้างหน้า (สัดส่วนแต่ละหน่วยเท่าเดิม)
    var fcFactor = 1;
    if (basis === 'fc') {
      var t = nowBkk().iso, m = FC.fit(D.dailySeries(D.firstDate(), U.addDays(t, -1)));
      if (m.ok) { var pr = FC.predict(m, U.dates(t, U.addDays(t, 90))).filter(function (x) { return x.dt === 'W'; }); var fAvg = U.sum(pr.map(function (x) { return x.yhat; })) / (pr.length || 1); fcFactor = R.v ? fAvg / (R.v / nW) : 1; }
    }
    var calc = function (o) {
      var pat = o.v / nW * fcFactor, nh = nhOf(o.key), fte = pat * nh * P.relief * P.week / P.hours, duty = fte * 2080 / (365 * 8), a = actOf(o.key);
      var prod = a ? (pat * nh) / (a * P.hours) * 100 : null;
      return { key: o.key, label: o.label, short: o.short, pat: pat, nh: nh, fte: fte, duty: duty, act: a, prod: prod };
    };
    var list = rows.map(calc), tot = { pat: 0, fte: 0, duty: 0, act: 0, hasAct: false, work: 0 };
    list.forEach(function (x) { tot.pat += x.pat; tot.fte += x.fte; tot.duty += x.duty; if (x.act) { tot.act += x.act; tot.hasAct = true; tot.work += x.pat * x.nh; } });
    if (!sel && list.length) sel = list[0].key;
    var stat = function (pv) { if (pv == null) return '<span class="muted">–</span>'; var k = pv < 85 ? ['warning', 'ต่ำกว่าเกณฑ์'] : pv <= 110 ? ['good', 'เหมาะสม'] : ['critical', 'ภาระงานสูง']; return '<span class="st ' + k[0] + '"><i></i>' + k[1] + '</span>'; };

    root.innerHTML = '<p class="ctx">' + U.esc(p.label) + ' · เฉพาะวันทำการ ' + R.nd.W + ' วัน' + (basis === 'fc' ? ' · ปรับตามค่าคาดการณ์ 3 เดือนข้างหน้า (×' + fcFactor.toFixed(2) + ')' : '') + '</p>' +
      '<div class="kpis">' +
      kpi({ label: 'ผู้ป่วยเฉลี่ยต่อวันทำการ', value: Math.round(tot.pat), unit: 'ราย/วัน', help: 'stpat' }) +
      kpi({ label: 'อัตรากำลังที่ควรมี (FTE)', value: tot.fte, d: 1, unit: 'คน', help: 'stfte' }) +
      kpi({ label: 'ขึ้นปฏิบัติงานต่อวัน', value: tot.duty, d: 1, unit: 'คน/วัน', help: 'stduty' }) +
      kpi({ label: 'มีจริง (ที่กรอกไว้)', value: tot.hasAct ? tot.act : '–', unit: tot.hasAct ? 'คน' : '', sub: tot.hasAct ? 'Productivity ' + U.fmt(tot.work / (tot.act * P.hours) * 100, 0) + '% (เฉพาะแถวที่กรอก)' : 'กรอกในตารางด้านล่าง', help: 'stprod' }) +
      '</div>' +
      '<section class="card params"><header class="ch"><div><h2>ค่าที่ใช้คำนวณ' + UI.info('stparams') + '</h2><p class="sub">ปรับเพื่อจำลองสถานการณ์ได้ทันที' + (S.me.role === 'admin' ? ' · ผู้ดูแลระบบกด "บันทึกเป็นค่าตั้งต้น" ให้ทุกคนเห็นค่าเดียวกัน' : '') + '</p></div></header><div class="cbody prm">' +
      '<label>ฐานจำนวนผู้ป่วย<select id="pBasis"><option value="act"' + (basis === 'act' ? ' selected' : '') + '>ค่าเฉลี่ยจริงของช่วงที่เลือก</option><option value="fc"' + (basis === 'fc' ? ' selected' : '') + '>ค่าคาดการณ์ 3 เดือนข้างหน้า</option></select></label>' +
      '<label>ชม.การพยาบาลต่อราย (ค่าตั้งต้น)<input type="number" step="0.05" min="0.05" id="pNh" value="' + P.nh['default'] + '"></label>' +
      '<label>ชดเชยการลา<input type="number" step="0.05" min="1" id="pRel" value="' + P.relief + '"></label>' +
      '<label>ทดแทน 7 วัน/5 วัน<input type="number" step="0.05" min="1" id="pWk" value="' + P.week + '"></label>' +
      '<label>ชม.ทำงานพยาบาล/วัน<input type="number" step="0.5" min="1" id="pHr" value="' + P.hours + '"></label>' +
      '<label>เวลาผู้ป่วยอยู่ในคลินิก (ชม.)<input type="number" step="0.5" min="0.5" id="pDw" value="' + P.dwell + '"></label>' +
      (S.me.role === 'admin' ? '<button class="btn" id="pSave">บันทึกเป็นค่าตั้งต้น</button>' : '') + '</div>' +
      '<p class="formula">FTE = ผู้ป่วยเฉลี่ย/วัน × ชม.การพยาบาลต่อราย × ' + P.relief + ' × ' + P.week + ' ÷ ' + P.hours + ' &nbsp;·&nbsp; ขึ้นปฏิบัติงาน/วัน = FTE × 2,080 ÷ (365 × 8) &nbsp;·&nbsp; Productivity = (ผู้ป่วย × ชม.การพยาบาล) ÷ (พยาบาลที่มี × ' + P.hours + ' ชม.) × 100</p></section>' +
      '<section class="card"><header class="ch"><div><h2>อัตรากำลังตาม' + D.DIM[dim].short + UI.info('sttable') + '</h2><p class="sub">แก้ "ชม./ราย" และ "มีจริง" ในตารางได้ · กดชื่อเพื่อดูช่วงเวลาที่ต้องการพยาบาลมาก</p></div></header><div class="cbody"><div class="tscroll"><table class="tbl st-tbl"><thead><tr><th>' + D.DIM[dim].short + '</th><th class="num">ผู้ป่วย/วัน</th><th class="num">ชม./ราย</th><th class="num">FTE ที่ควรมี</th><th class="num">ขึ้นงาน/วัน</th><th class="num">มีจริง (คน)</th><th class="num">Productivity</th><th>สถานะ</th></tr></thead><tbody>' +
      list.map(function (x) { return '<tr data-k="' + U.esc(x.key) + '" class="' + (x.key === sel ? 'sel' : '') + '"><td><button class="lnk">' + U.esc(x.short) + '</button></td><td class="num">' + U.fmt(x.pat, 1) + '</td><td class="num"><input type="number" step="0.05" min="0" class="cell" data-nh value="' + (P.nh[dim + '|' + x.key] != null ? P.nh[dim + '|' + x.key] : '') + '" placeholder="' + P.nh['default'] + '"></td><td class="num"><b>' + U.fmt(x.fte, 1) + '</b></td><td class="num">' + U.fmt(x.duty, 1) + '</td><td class="num"><input type="number" step="0.5" min="0" class="cell" data-act value="' + (x.act == null ? '' : x.act) + '" placeholder="–"></td><td class="num">' + (x.prod == null ? '–' : U.fmt(x.prod, 0) + '%') + '</td><td>' + stat(x.prod) + '</td></tr>'; }).join('') +
      '<tr class="tot"><td>รวม</td><td class="num">' + U.fmt(tot.pat, 1) + '</td><td></td><td class="num"><b>' + U.fmt(tot.fte, 1) + '</b></td><td class="num">' + U.fmt(tot.duty, 1) + '</td><td class="num">' + (tot.hasAct ? U.fmt(tot.act, 1) : '–') + '</td><td></td><td></td></tr></tbody></table></div></div></section>' +
      '<div class="grid g2"><div id="s1"></div><div id="s2"></div></div>';

    rowsOut = { name: 'อัตรากำลัง', cols: [{ h: D.DIM[dim].short }, { h: 'ผู้ป่วยเฉลี่ย/วันทำการ', num: 1 }, { h: 'ชม.การพยาบาล/ราย', num: 1 }, { h: 'FTE ที่ควรมี', num: 1 }, { h: 'ขึ้นปฏิบัติงาน/วัน', num: 1 }, { h: 'มีจริง', num: 1 }, { h: 'Productivity %', num: 1 }], rows: list.map(function (x) { return [x.label, x.pat, x.nh, x.fte, x.duty, x.act == null ? '' : x.act, x.prod == null ? '' : x.prod]; }) };

    // แก้ค่าในตาราง
    U.$$('.st-tbl tbody tr[data-k]', root).forEach(function (tr) {
      var k = tr.getAttribute('data-k');
      tr.querySelector('.lnk').onclick = function () { sel = k; draw(p, r); };
      tr.querySelector('[data-nh]').onchange = function () { if (this.value === '') delete P.nh[dim + '|' + k]; else P.nh[dim + '|' + k] = +this.value; draw(p, r); };
      tr.querySelector('[data-act]').onchange = function () { if (this.value === '') delete P.act[dim + '|' + k]; else P.act[dim + '|' + k] = +this.value; draw(p, r); };
    });
    U.$('#pBasis', root).onchange = function () { basis = this.value; STORE.set('u:' + S.me.emp + ':stBasis', basis); load(); };
    [['#pNh', function (v) { P.nh['default'] = v; }], ['#pRel', function (v) { P.relief = v; }], ['#pWk', function (v) { P.week = v; }], ['#pHr', function (v) { P.hours = v; }], ['#pDw', function (v) { P.dwell = v; }]].forEach(function (x) {
      U.$(x[0], root).onchange = function () { var v = +this.value; if (!(v > 0)) return UI.toast('กรุณาใส่ตัวเลขมากกว่า 0', 'warn'); x[1](v); draw(p, r); };
    });
    var sv = U.$('#pSave', root);
    if (sv) sv.onclick = function () {
      api('saveSettings', { partial: { nhppd: P.nh, actual: P.act, hoursPerDay: P.hours, relief: P.relief, weekFactor: P.week, dwellHours: P.dwell, staffDim: dim } }).then(function (res) { S.boot.settings = res.settings; UI.toast('บันทึกค่าตั้งต้นแล้ว ทุกคนจะเห็นค่าเดียวกัน', 'ok'); }).catch(function (e) { UI.toast(e.message, 'bad'); });
    };

    /* ช่วงเวลาที่ต้องมีพยาบาล (หน่วยที่เลือก) */
    var cur = list.filter(function (x) { return x.key === sel; })[0];
    if (!cur) return;
    var arr = new Float64Array(NS);
    for (var ci = 0; ci < D.nC; ci++) { if (D.val(dim, ci) !== sel) continue; for (var s = 0; s < NS; s++) arr[s] += R.cs[ci * NS + s] / nW * fcFactor; }
    var win = Math.max(1, Math.round(P.dwell * 4)), need = [], xs = [], arrive = [];
    for (s = 20; s <= 87; s++) {
      var sum = 0; for (var k = 0; k < win; k++) if (s - k >= 0) sum += arr[s - k];
      need.push(Math.round(sum * cur.nh / P.dwell * 10) / 10); xs.push(U.hhmm(s)); arrive.push(Math.round(arr[s] * 10) / 10);
    }
    var pk = need.indexOf(Math.max.apply(null, need));
    var c1 = CH.card(U.$('#s1', root), { title: 'พยาบาลที่ต้องอยู่พร้อมกัน: ' + cur.short, sub: 'เฉลี่ยวันทำการ · สูงสุด ' + U.fmt(need[pk], 1) + ' คน ช่วง ' + xs[pk] + ' น.' + (cur.act ? ' · เส้นแดง = ที่มีจริง ' + cur.act + ' คน' : ''), help: 'stpeak', h: 280 });
    c1.set(CH.line(c1.chartEl, { x: xs, series: [{ name: 'พยาบาลที่ต้องการ (คน)', data: need, area: true, color: CH.T().cat[2], markLine: cur.act ? { symbol: 'none', silent: true, lineStyle: { color: CH.T().crit, type: 'solid', width: 1.5 }, label: { formatter: 'มีจริง ' + cur.act, color: CH.T().crit }, data: [{ yAxis: cur.act }] } : undefined }], fmt: function (v) { return U.fmt(v, 1) + ' คน'; } }));
    c1.setTable([{ h: 'เวลา' }, { h: 'มาถึงเฉลี่ย (ราย)', num: 1, d: 1 }, { h: 'พยาบาลที่ต้องการ', num: 1, d: 1 }], xs.map(function (x, i) { return [x, arrive[i], need[i]]; }));
    var c2 = CH.card(U.$('#s2', root), { title: 'ผู้ป่วยมาถึงเฉลี่ยราย 15 นาที: ' + cur.short, sub: 'เฉลี่ยวันทำการ · ใช้วางตารางเวร/เปิดจุดบริการเสริม', help: 'starr', h: 280 });
    c2.set(CH.line(c2.chartEl, { x: xs, bars: true, series: [{ name: 'มาถึง (ราย)', data: arrive, bar: true }], fmt: function (v) { return U.fmt(v, 1) + ' ราย'; } }));
    c2.setTable([{ h: 'เวลา' }, { h: 'มาถึงเฉลี่ย (ราย)', num: 1, d: 1 }], xs.map(function (x, i) { return [x, arrive[i]]; }));
    countUp(root);
  }
};
