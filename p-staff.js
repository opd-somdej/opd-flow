/* =====================================================================
   p-staff.js — วางแผนอัตรากำลังพยาบาล (ปรับใหม่ 27 ต.ค. 69: สูตร 3 ขั้น ระดับโซน › หน่วยงาน)
   ① ชั่วโมงงานพยาบาลต่อวัน   = ผู้ป่วยเฉลี่ยต่อวันที่เปิดบริการ × ชม.การพยาบาลต่อราย (ตั้งต้น 0.2 ชม. = 12 นาที)
   ② พยาบาลที่ต้องขึ้นงาน/วัน = ① ÷ ชม.ทำงานพยาบาล 1 คนต่อวัน (7 ชม.)
   ③ FTE ที่ควรมี (รวมคนสำรอง) = ② × ค่าเผื่อลา/หยุด/อบรม (ตั้งต้น 1.2)
   Productivity = ① ÷ (พยาบาลที่ขึ้นงานจริง × 7 ชม.) × 100 · เกณฑ์ รพ. เหมาะสม 90–110%
   เทียบ "ขึ้นงานจริง" กับ ② (ฐานเดียวกัน คือคนที่อยู่หน้างานต่อวัน) — แก้ปัญหาเดิมที่เทียบ FTE กับคนขึ้นงาน
   "วันที่เปิดบริการ" นับเฉพาะวันที่โซนนั้นมีผู้ป่วย (คลินิกนอกเวลา/เสาร์จึงไม่ถูกหารด้วยวันทำการทั้งหมด)
   ===================================================================== */
'use strict';
PAGE_FN.staff = function (root) {
  var tools = U.$('#topTools'), selZone = null, dirty = {};
  var base = function () { var s = S.boot.settings.staff || {}; return { nh: Object.assign({ 'default': 0.2 }, s.nh || {}), act: Object.assign({}, s.act || {}), hours: +s.hours || 7, relief: +s.relief || 1.2, dwell: +s.dwell || 2 }; };
  var P = base();
  var isAdmin = S.me.role === 'admin';
  var myUnits = {}, myZones = {}; (S.me.scope || []).forEach(function (s) { if (s.dim === 'unit') myUnits[s.val] = 1; if (s.dim === 'zone') myZones[s.val] = 1; });
  var canEdit = function (zone) { return isAdmin || myZones[zone] || myUnits[D.ZUNIT[zone]]; };
  FUI.bar(tools, function () { load(); });
  var pc = PER.control(tools, function () { load(); }, { kinds: ['month', 'quarter', 'year', 'custom'] });
  var rowsOut = null;
  EXP.toolbar(tools, { title: 'วางแผนอัตรากำลังพยาบาล', xlsx: function () { if (rowsOut) EXP.xlsx('อัตรากำลังพยาบาล ' + pc.get().label, [rowsOut]); } });
  if (['day', 'week'].indexOf(pc.get().kind) >= 0) pc.set(PER.make('month', U.addDays(nowBkk().iso, -1)), true);
  load();

  function load() {
    var p = pc.get(), r = PER.clip(p);
    if (r.from > r.to) { root.innerHTML = '<div class="empty"><b>ช่วงนี้ยังไม่มีข้อมูล</b></div>'; return; }
    UI.loading(root, 'กำลังโหลดข้อมูลสำหรับคำนวณอัตรากำลัง ' + p.label + '…');
    D.ensure(r.from, r.to, true).then(function () { draw(p, r); }).catch(function (e) { UI.doneLoading(root); root.innerHTML = '<div class="empty"><b>โหลดข้อมูลไม่สำเร็จ</b><p>' + U.esc(e.message) + '</p></div>'; });
  }
  var nhOf = function (z) { var v = P.nh[z]; return v != null && v !== '' ? +v : +P.nh['default']; };
  var actOf = function (z) { var v = P.act[z]; return v != null && v !== '' ? +v : null; };
  /** สถานะตาม Productivity (ไม่พึ่งสีอย่างเดียว: มีคำ + สัญลักษณ์) */
  function status(pv) {
    if (pv == null) return '<span class="st none">– ยังไม่กรอก</span>';
    if (pv < 90) return '<span class="st info"><i>▼</i>คนมากกว่างาน</span>';
    if (pv <= 110) return '<span class="st good"><i>✓</i>เหมาะสม</span>';
    return '<span class="st critical"><i>▲</i>งานมากกว่าคน</span>';
  }

  /** ยอดต่อโซน + จำนวนวันที่เปิดบริการ */
  function compute(r) {
    var F = JSON.parse(JSON.stringify(D.filt())); F.dts = ['W', 'S', 'H']; F.hours = null; F.kind = 'all'; F.ptg = [];
    var K = D.compile(F), Z = {}, order = [];
    U.dates(r.from, r.to).forEach(function (d) {
      var x = D.DAYS[d]; if (!x || !x.cl) return;
      var seen = {};
      for (var i = 0; i < x.cl.length; i += 4) {
        var ci = x.cl[i], v = x.cl[i + 1]; if (!K.cm[ci] || !v) continue;
        var z = D.val('zone', ci), o = Z[z];
        if (!o) { o = Z[z] = { zone: z, unit: D.val('unit', ci), v: 0, days: 0, cs: new Float64Array(NS) }; order.push(z); }
        o.v += v; if (!seen[z]) { seen[z] = 1; o.days++; }
      }
      if (x.sl) for (var j = 0; j < x.sl.length; j += 4) { var c2 = x.sl[j]; if (!K.cm[c2]) continue; var o2 = Z[D.val('zone', c2)]; if (o2) o2.cs[x.sl[j + 1]] += x.sl[j + 2]; }
    });
    var list = order.map(function (z) {
      var o = Z[z], pat = o.days ? o.v / o.days : 0, nh = nhOf(z), hrs = pat * nh, duty = hrs / P.hours, fte = duty * P.relief, act = actOf(z);
      return { zone: z, unit: o.unit, days: o.days, v: o.v, pat: pat, nh: nh, hrs: hrs, duty: duty, fte: fte, act: act, prod: act ? hrs / (act * P.hours) * 100 : null, gap: act != null ? act - duty : null, cs: o.cs };
    });
    list.sort(function (a, b) { return (D.UORD[a.unit] != null ? D.UORD[a.unit] : 1e6) - (D.UORD[b.unit] != null ? D.UORD[b.unit] : 1e6) || (D.ZORD[a.zone] != null ? D.ZORD[a.zone] : 1e6) - (D.ZORD[b.zone] != null ? D.ZORD[b.zone] : 1e6) || b.v - a.v; });
    var units = [], um = {};
    list.forEach(function (x) {
      var u = um[x.unit]; if (!u) { u = um[x.unit] = { unit: x.unit, zones: [], pat: 0, hrs: 0, duty: 0, fte: 0, act: 0, actHrs: 0, nAct: 0 }; units.push(u); }
      u.zones.push(x); u.pat += x.pat; u.hrs += x.hrs; u.duty += x.duty; u.fte += x.fte;
      if (x.act != null) { u.act += x.act; u.actHrs += x.hrs; u.nAct++; }
    });
    var T = { pat: 0, hrs: 0, duty: 0, fte: 0, act: 0, actHrs: 0, nAct: 0, nZ: list.length };
    units.forEach(function (u) { u.prod = u.nAct ? u.actHrs / (u.act * P.hours) * 100 : null; T.pat += u.pat; T.hrs += u.hrs; T.duty += u.duty; T.fte += u.fte; T.act += u.act; T.actHrs += u.actHrs; T.nAct += u.nAct; });
    T.prod = T.nAct ? T.actHrs / (T.act * P.hours) * 100 : null;
    return { list: list, units: units, T: T };
  }

  function draw(p, r) {
    CH.disposeAll(); UI.doneLoading(root);
    var C = compute(r), T = C.T, f1 = function (v) { return U.fmt(v, 1); };
    if (!C.list.length) { root.innerHTML = '<div class="empty"><b>ไม่มีผู้ป่วยในช่วง/ตัวกรองนี้</b><p>ลองเปลี่ยนช่วงเวลาหรือล้างตัวกรอง</p></div>'; return; }
    if (!selZone || !C.list.some(function (x) { return x.zone === selZone; })) selZone = C.list[0].zone;
    var nDirty = Object.keys(dirty).length;
    root.innerHTML =
      '<p class="ctx"><b>' + U.esc(p.label) + '</b> · ' + T.nZ + ' โซน' + (D.describe().length ? ' · ' + U.esc(D.describe().join(' · ')) : '') + ' · นับเฉลี่ยต่อ "วันที่เปิดบริการ" ของแต่ละโซน</p>' +
      '<section class="card st-steps"><header class="ch"><div><h2>คำนวณ 3 ขั้น (รวมทุกโซนที่เลือก)' + UI.info('stfte') + '</h2><p class="sub">ตัวเลขจริงของช่วงนี้ · ปรับค่าตั้งต้นได้ที่ "ค่าที่ใช้คำนวณ" ด้านล่าง</p></div></header>' +
      '<ol class="steps3">' +
      '<li><span class="sn">1</span><div><b>ชั่วโมงงานพยาบาล/วัน</b><p>ผู้ป่วย <em>' + f1(T.pat) + '</em> ราย/วัน × <em>' + U.fmt(P.nh['default'], 2) + '</em> ชม./ราย<small>' + (C.list.some(function (x) { return x.nh !== +P.nh['default']; }) ? ' (บางโซนใช้ค่าเฉพาะ)' : '') + '</small></p><strong>' + f1(T.hrs) + ' <small>ชม.</small></strong></div></li>' +
      '<li><span class="sn">2</span><div><b>พยาบาลที่ต้องขึ้นงาน/วัน</b><p><em>' + f1(T.hrs) + '</em> ชม. ÷ <em>' + P.hours + '</em> ชม./คน</p><strong>' + f1(T.duty) + ' <small>คน</small></strong></div></li>' +
      '<li><span class="sn">3</span><div><b>FTE ที่ควรมี (รวมคนสำรอง)</b><p><em>' + f1(T.duty) + '</em> คน × <em>' + P.relief + '</em> (ลา/หยุด/อบรม)</p><strong>' + f1(T.fte) + ' <small>คน</small></strong></div></li>' +
      '<li class="pv"><span class="sn">✓</span><div><b>Productivity</b><p>' + (T.prod == null ? 'กรอก "ขึ้นงานจริง" ในตารางเพื่อคำนวณ' : '<em>' + f1(T.actHrs) + '</em> ชม. ÷ (<em>' + f1(T.act) + '</em> คน × ' + P.hours + ' ชม.)' + (T.nAct < T.nZ ? '<small> · เฉพาะ ' + T.nAct + '/' + T.nZ + ' โซนที่กรอก</small>' : '')) + '</p><strong>' + (T.prod == null ? '–' : U.fmt(T.prod, 0) + '%') + '</strong>' + status(T.prod) + '</div></li>' +
      '</ol></section>' +
      '<section class="card"><header class="ch"><div><h2>อัตรากำลังรายโซน › หน่วยงาน' + UI.info('sttable') + '</h2><p class="sub">กรอก <b>ขึ้นงานจริง</b> = จำนวนพยาบาลที่อยู่หน้างานต่อวันโดยเฉลี่ย' + (isAdmin ? '' : ' (แก้ได้เฉพาะโซนในหน่วยงานของคุณ)') + ' · กดชื่อโซนเพื่อดูช่วงเวลาที่ต้องการพยาบาลมาก</p></div>' +
      '<div class="ctools"><button class="btn primary" id="stSave"' + (nDirty ? '' : ' disabled') + '>' + ICON.check + '<span>บันทึก' + (nDirty ? ' (' + nDirty + ')' : '') + '</span></button></div></header>' +
      '<div class="cbody"><div class="tscroll st-wrap"><table class="tbl st-tbl"><thead><tr><th class="stick">หน่วยงาน / โซน</th><th class="num">วันที่เปิด</th><th class="num">ผู้ป่วย/วัน</th><th class="num">ชม./ราย</th><th class="num">① ชม.งาน/วัน</th><th class="num">② ต้องขึ้นงาน/วัน</th><th class="num">③ FTE ที่ควรมี</th><th class="num">ขึ้นงานจริง</th><th class="num">ขาด(−)/เกิน(+)</th><th class="num">Productivity</th><th>สถานะ</th></tr></thead><tbody>' +
      C.units.map(function (u) {
        return '<tr class="urow"><td class="stick"><b>' + U.esc(D.shortLabel('unit', u.unit)) + '</b></td><td></td><td class="num"><b>' + f1(u.pat) + '</b></td><td></td><td class="num">' + f1(u.hrs) + '</td><td class="num"><b>' + f1(u.duty) + '</b></td><td class="num"><b>' + f1(u.fte) + '</b></td><td class="num">' + (u.nAct ? f1(u.act) : '–') + '</td><td class="num">' + (u.nAct ? gapTxt(u.act - u.zones.filter(function (z) { return z.act != null; }).reduce(function (s, z) { return s + z.duty; }, 0)) : '–') + '</td><td class="num">' + (u.prod == null ? '–' : U.fmt(u.prod, 0) + '%') + '</td><td>' + status(u.prod) + '</td></tr>' +
          u.zones.map(function (x) {
            var ed = canEdit(x.zone), zd = dirty[x.zone] || {};
            return '<tr data-z="' + U.esc(x.zone) + '" class="zrow' + (x.zone === selZone ? ' sel' : '') + '"><td class="stick"><button class="lnk">' + U.esc(x.zone === x.unit ? 'ทุกคลินิกในหน่วยงาน' : x.zone) + '</button></td><td class="num">' + x.days + '</td><td class="num">' + f1(x.pat) + '</td>' +
              '<td class="num">' + (isAdmin || ed ? '<input type="number" inputmode="decimal" step="0.05" min="0.01" class="cell" data-nh value="' + (zd.nh != null ? zd.nh : P.nh[x.zone] != null ? P.nh[x.zone] : '') + '" placeholder="' + P.nh['default'] + '" aria-label="ชม.การพยาบาลต่อราย ' + U.esc(x.zone) + '">' : U.fmt(x.nh, 2)) + '</td>' +
              '<td class="num">' + f1(x.hrs) + '</td><td class="num"><b>' + f1(x.duty) + '</b></td><td class="num">' + f1(x.fte) + '</td>' +
              '<td class="num">' + (ed ? '<input type="number" inputmode="decimal" step="0.5" min="0" class="cell" data-act value="' + (zd.act != null ? zd.act : x.act == null ? '' : x.act) + '" placeholder="กรอก" aria-label="พยาบาลขึ้นงานจริง ' + U.esc(x.zone) + '">' : (x.act == null ? '–' : f1(x.act))) + '</td>' +
              '<td class="num">' + (x.gap == null ? '–' : gapTxt(x.gap)) + '</td><td class="num">' + (x.prod == null ? '–' : U.fmt(x.prod, 0) + '%') + '</td><td>' + status(x.prod) + '</td></tr>';
          }).join('');
      }).join('') +
      '<tr class="tot"><td class="stick">รวมทั้งหมด</td><td></td><td class="num">' + f1(T.pat) + '</td><td></td><td class="num">' + f1(T.hrs) + '</td><td class="num">' + f1(T.duty) + '</td><td class="num">' + f1(T.fte) + '</td><td class="num">' + (T.nAct ? f1(T.act) : '–') + '</td><td></td><td class="num">' + (T.prod == null ? '–' : U.fmt(T.prod, 0) + '%') + '</td><td>' + status(T.prod) + '</td></tr></tbody></table></div>' +
      '<p class="legend-line"><span class="st good"><i>✓</i>เหมาะสม 90–110%</span><span class="st critical"><i>▲</i>งานมากกว่าคน &gt; 110% (ควรเพิ่มคน)</span><span class="st info"><i>▼</i>คนมากกว่างาน &lt; 90%</span></p></div></section>' +
      '<section class="card params"><header class="ch"><div><h2>ค่าที่ใช้คำนวณ' + UI.info('stparams') + '</h2><p class="sub">' + (isAdmin ? 'ผู้ดูแลระบบปรับได้ · ทุกคนเห็นค่าเดียวกัน' : 'กำหนดโดยผู้ดูแลระบบ') + '</p></div></header><div class="cbody prm">' +
      '<label>ชม.การพยาบาลต่อราย (ตั้งต้น)<input type="number" step="0.05" min="0.01" id="pNh" value="' + P.nh['default'] + '"' + (isAdmin ? '' : ' disabled') + '></label>' +
      '<label>ชม.ทำงานพยาบาล/คน/วัน<input type="number" step="0.5" min="1" id="pHr" value="' + P.hours + '"' + (isAdmin ? '' : ' disabled') + '></label>' +
      '<label>ค่าเผื่อลา/หยุด/อบรม (เท่า)<input type="number" step="0.05" min="1" id="pRel" value="' + P.relief + '"' + (isAdmin ? '' : ' disabled') + '></label>' +
      '<label>เวลาผู้ป่วยอยู่ในคลินิก (ชม.)<input type="number" step="0.5" min="0.5" id="pDw" value="' + P.dwell + '"' + (isAdmin ? '' : ' disabled') + '></label>' +
      (isAdmin ? '<button class="btn" id="pSave">' + ICON.check + '<span>บันทึกค่าตั้งต้น</span></button>' : '') + '</div>' +
      '<p class="formula">ค่าเผื่อ 1.2 = พยาบาล 1 คนลาพักผ่อน/ป่วย/อบรม/วันหยุดชดเชย เฉลี่ยราว 1 ใน 6 ของวันทำงาน จึงต้องมีคนสำรอง 20% · OPD เปิดเฉพาะวันที่มีผู้ป่วย จึงไม่ใช้ตัวคูณ 7 วัน/5 วัน (1.4) แบบหอผู้ป่วยใน</p></section>' +
      '<div class="grid g2"><div id="s1"></div><div id="s2"></div></div>';

    rowsOut = { name: 'อัตรากำลัง', cols: [{ h: 'หน่วยงาน' }, { h: 'โซน' }, { h: 'วันที่เปิด', num: 1 }, { h: 'ผู้ป่วย/วัน', num: 1 }, { h: 'ชม.การพยาบาล/ราย', num: 1 }, { h: '① ชม.งาน/วัน', num: 1 }, { h: '② ต้องขึ้นงาน (คน/วัน)', num: 1 }, { h: 'ขึ้นงานจริง', num: 1 }, { h: 'ขาด/เกิน', num: 1 }, { h: 'Productivity %', num: 1 }, { h: '③ FTE ที่ควรมี', num: 1 }],
      rows: C.list.map(function (x) { return [D.label('unit', x.unit), x.zone, x.days, x.pat, x.nh, x.hrs, x.duty, x.act == null ? '' : x.act, x.gap == null ? '' : x.gap, x.prod == null ? '' : x.prod, x.fte]; }) };

    // แก้ค่าในตาราง → จำไว้จนกด "บันทึก" (คำนวณใหม่ทันที)
    U.$$('.st-tbl tr[data-z]', root).forEach(function (tr) {
      var z = tr.getAttribute('data-z');
      tr.querySelector('.lnk').onclick = function () { selZone = z; draw(p, r); };
      var inN = tr.querySelector('[data-nh]'), inA = tr.querySelector('[data-act]');
      if (inN) inN.onchange = function () { var v = this.value.trim(); if (v !== '' && !(+v > 0)) return UI.toast('ชม./ราย ต้องมากกว่า 0', 'warn'); (dirty[z] = dirty[z] || {}).nh = v; if (v === '') delete P.nh[z]; else P.nh[z] = +v; draw(p, r); };
      if (inA) inA.onchange = function () { var v = this.value.trim(); if (v !== '' && !(+v >= 0)) return UI.toast('จำนวนคนต้องเป็นตัวเลข', 'warn'); (dirty[z] = dirty[z] || {}).act = v; if (v === '') delete P.act[z]; else P.act[z] = +v; draw(p, r); };
    });
    U.$('#stSave', root).onclick = function () {
      var act = {}, nh = {}; Object.keys(dirty).forEach(function (z) { if (dirty[z].act !== undefined) act[z] = dirty[z].act; if (dirty[z].nh !== undefined) nh[z] = dirty[z].nh; });
      UI.busyBtn(this, api('saveStaff', { act: act, nh: nh }), 'กำลังบันทึก…').then(function (res) { S.boot.settings.staff = res.staff; dirty = {}; P = base(); draw(p, r); UI.toast('บันทึกอัตรากำลังแล้ว ทุกคนเห็นตัวเลขเดียวกัน', 'ok'); }).catch(function (e) { UI.toast(e.message, 'bad'); });
    };
    var sv = U.$('#pSave', root);
    if (sv) sv.onclick = function () {
      var b = { nhDefault: +U.$('#pNh', root).value, hours: +U.$('#pHr', root).value, relief: +U.$('#pRel', root).value, dwell: +U.$('#pDw', root).value };
      UI.busyBtn(sv, api('saveStaff', { base: b }), 'กำลังบันทึก…').then(function (res) { S.boot.settings.staff = res.staff; var keep = dirty; P = base(); Object.keys(keep).forEach(function (z) { if (keep[z].act !== undefined) P.act[z] = keep[z].act === '' ? null : +keep[z].act; if (keep[z].nh !== undefined && keep[z].nh !== '') P.nh[z] = +keep[z].nh; }); draw(p, r); UI.toast('บันทึกค่าตั้งต้นแล้ว', 'ok'); }).catch(function (e) { UI.toast(e.message, 'bad'); });
    };
    ['#pNh', '#pHr', '#pRel', '#pDw'].forEach(function (id) { var el = U.$(id, root); if (el && isAdmin) el.onchange = function () { var v = +this.value; if (!(v > 0)) return UI.toast('กรุณาใส่ตัวเลขมากกว่า 0', 'warn'); if (id === '#pNh') P.nh['default'] = v; if (id === '#pHr') P.hours = v; if (id === '#pRel') P.relief = v; if (id === '#pDw') P.dwell = v; draw(p, r); }; });

    /* ช่วงเวลาที่ต้องมีพยาบาล (โซนที่เลือก) */
    var cur = C.list.filter(function (x) { return x.zone === selZone; })[0]; if (!cur) return;
    var st = TR.step(), days = cur.days || 1, arr = new Float64Array(NS);
    for (var s = 0; s < NS; s++) arr[s] = cur.cs[s] / days;
    var win = Math.max(1, Math.round(P.dwell * 4)), need = [], xs = [], arrive = [];
    for (s = 24; s <= 87; s += st) {
      var sum = 0, a2 = 0; for (var k = 0; k < win; k++) if (s + st - 1 - k >= 0) sum += arr[s + st - 1 - k];
      for (k = 0; k < st; k++) a2 += arr[s + k];
      need.push(Math.round(sum * cur.nh / P.dwell * 10) / 10); xs.push(U.hhmm(s)); arrive.push(Math.round(a2 * 10) / 10);
    }
    var pk = need.indexOf(Math.max.apply(null, need)), zl = cur.zone === cur.unit ? D.shortLabel('unit', cur.unit) : cur.zone;
    var c1 = CH.card(U.$('#s1', root), { title: 'พยาบาลที่ต้องอยู่พร้อมกัน: ' + zl, sub: 'เฉลี่ยต่อวันที่เปิด · สูงสุด ' + U.fmt(need[pk], 1) + ' คน ช่วง ' + xs[pk] + ' น.' + (cur.act ? ' · เส้นแดง = ขึ้นงานจริง ' + cur.act + ' คน' : ''), help: 'stpeak', h: 280 });
    c1.set(CH.line(c1.chartEl, { x: xs, series: [{ name: 'พยาบาลที่ต้องการ (คน)', data: need, area: true, color: CH.T().cat[0], markLine: cur.act ? { symbol: 'none', silent: true, lineStyle: { color: CH.T().crit, type: 'solid', width: 2 }, label: { formatter: 'ขึ้นงานจริง ' + cur.act, color: CH.T().crit }, data: [{ yAxis: cur.act }] } : undefined }], fmt: function (v) { return U.fmt(v, 1) + ' คน'; } }));
    c1.setTable([{ h: 'เวลา' }, { h: 'มาถึงเฉลี่ย (ราย)', num: 1, d: 1 }, { h: 'พยาบาลที่ต้องการ', num: 1, d: 1 }], xs.map(function (x, i) { return [x, arrive[i], need[i]]; }));
    var c2 = CH.card(U.$('#s2', root), { title: 'ผู้ป่วยมาถึงเฉลี่ยราย' + TR.unit() + ': ' + zl, sub: 'เฉลี่ยต่อวันที่เปิด · ใช้วางตารางเวร/เปิดจุดบริการเสริม' + (TR.note() ? ' · ' + TR.note() : ''), help: 'starr', h: 280 });
    c2.set(CH.line(c2.chartEl, { x: xs, bars: true, series: [{ name: 'มาถึง (ราย)', data: arrive, bar: true }], fmt: function (v) { return U.fmt(v, 1) + ' ราย'; } }));
    c2.setTable([{ h: 'เวลา' }, { h: 'มาถึงเฉลี่ย (ราย)', num: 1, d: 1 }], xs.map(function (x, i) { return [x, arrive[i]]; }));
  }
  function gapTxt(g) { var a = Math.abs(g); if (a < 0.05) return '<span class="gap ok">พอดี</span>'; return '<span class="gap ' + (g < 0 ? 'neg' : 'pos') + '">' + (g < 0 ? '−' : '+') + U.fmt(a, 1) + '</span>'; }
};
