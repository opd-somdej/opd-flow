/* =====================================================================
   ui.js — ชิ้นส่วนที่ใช้ร่วมกันทุกหน้า
   ตัวกรอง (ใช้ร่วมทุกหน้า) · ตัวเลขสรุป · แถบเวลาวันนี้ (ribbon) · การแจ้งเตือนความหนาแน่น · ทัวร์แนะนำ
   ===================================================================== */
'use strict';

/* ---------------- ตัวกรอง ---------------- */
var FUI = {
  /** วางปุ่มตัวกรอง + ชิปสรุป · onChange() เมื่อกดใช้ */
  bar: function (host, onChange, opt) {
    opt = opt || {};
    var box = U.el('<div class="fbar"><button class="btn fbtn" id="fBtn">' + ICON.filter + '<span>ตัวกรอง</span><i class="fn" hidden></i></button><div class="chips" id="fChips"></div></div>');
    host.appendChild(box);
    var paint = function () {
      var d = D.describe(), n = U.$('.fn', box);
      n.hidden = !d.length; n.textContent = d.length;
      U.$('#fChips', box).innerHTML = d.length ? d.map(function (x) { return '<span class="chip">' + U.esc(x) + '</span>'; }).join('') + '<button class="chip clear" id="fClr">ล้างตัวกรอง</button>' : '<span class="chip muted">' + (D.scopeMask ? 'ทุกคลินิกในขอบเขตของคุณ' : 'ทุกคลินิก ทั้งโรงพยาบาล') + '</span>';
      var c = U.$('#fClr', box); if (c) c.onclick = function () { var F = D.filt(); F.dims = {}; F.ptg = []; F.hours = null; F.dts = ['W', 'S', 'H']; D.saveFilt(); paint(); onChange(); };
    };
    U.$('#fBtn', box).onclick = function () { FUI.open(function () { paint(); onChange(); }, opt); };
    paint();
    return { paint: paint };
  },
  open: function (onApply, opt) {
    var F = JSON.parse(JSON.stringify(D.filt())), dims = D.DIMS.filter(function (d) { return d.id !== 'clinic'; }).concat([D.DIM.clinic]);
    var body = U.el('<div class="fpanel"></div>');
    var paint = function () {
      body.innerHTML =
        '<div class="fsec"><h4>ช่วงเวลาที่มาถึง' + UI.info('hours') + '</h4><div class="seg wrap">' +
        [['ทั้งวัน', null], ['ในเวลาราชการ 06–16 น.', [24, 63]], ['นอกเวลา 16–21 น.', [64, 83]], ['เช้า 06–12 น.', [24, 47]], ['บ่าย 12–16 น.', [48, 63]]].map(function (h) { var on = JSON.stringify(F.hours) === JSON.stringify(h[1]); return '<button type="button" data-h=\'' + JSON.stringify(h[1]) + '\' class="' + (on ? 'on' : '') + '">' + h[0] + '</button>'; }).join('') +
        '</div><div class="hcustom">กำหนดเอง <select id="h0">' + opts(F.hours ? F.hours[0] : 24) + '</select> ถึง <select id="h1">' + opts(F.hours ? F.hours[1] + 1 : 64, true) + '</select> <button type="button" class="btn sm" id="hSet">ใช้</button></div></div>' +
        '<div class="fsec"><h4>ประเภทวัน</h4><div class="seg wrap">' + ['W', 'S', 'H'].map(function (t) { return '<label class="ck"><input type="checkbox" data-dt="' + t + '"' + (F.dts.indexOf(t) >= 0 ? ' checked' : '') + '>' + D.DT[t] + '</label>'; }).join('') + '</div></div>' +
        '<div class="fsec"><h4>กลุ่มสิทธิการรักษา</h4><div class="seg wrap">' + D.PG.map(function (g) { return '<label class="ck"><input type="checkbox" data-pg="' + g.id + '"' + (F.ptg.indexOf(g.id) >= 0 ? ' checked' : '') + '>' + U.esc(g.name) + '</label>'; }).join('') + '</div></div>' +
        dims.map(function (d) {
          var vals = D.values(d.id, F.showHidden), sel = F.dims[d.id] || [];
          return '<details class="fsec fd"' + (sel.length ? ' open' : '') + '><summary><h4>' + U.esc(d.name) + '</h4><span class="muted small">' + (sel.length ? 'เลือก ' + sel.length + ' จาก ' + vals.length : 'ทั้งหมด ' + vals.length) + '</span></summary>' +
            (vals.length > 8 ? '<input class="fsearch" type="search" placeholder="ค้นหา…" data-s="' + d.id + '">' : '') +
            '<div class="flist" data-dim="' + d.id + '">' + vals.map(function (v) { return '<label class="ck"><input type="checkbox" value="' + U.esc(v) + '"' + (sel.indexOf(v) >= 0 ? ' checked' : '') + '><span>' + U.esc(D.shortLabel(d.id, v)) + '</span></label>'; }).join('') + '</div>' +
            '<div class="fmini"><button type="button" data-all="' + d.id + '">เลือกทั้งหมด</button><button type="button" data-none="' + d.id + '">ไม่เลือก</button></div></details>';
        }).join('') +
        (S.me.role === 'admin' ? '<label class="ck"><input type="checkbox" id="fHid"' + (F.showHidden ? ' checked' : '') + '>รวมคลินิกที่ตั้ง "ไม่แสดง" ในผังคลินิก</label>' : '');
      U.$$('[data-h]', body).forEach(function (b) { b.onclick = function () { F.hours = JSON.parse(b.getAttribute('data-h')); paint(); }; });
      U.$('#hSet', body).onclick = function () { var a = +U.$('#h0', body).value, b = +U.$('#h1', body).value - 1; if (b < a) return UI.toast('เวลาสิ้นสุดต้องหลังเวลาเริ่ม', 'warn'); F.hours = [a, b]; paint(); };
      U.$$('[data-dt]', body).forEach(function (c) { c.onchange = function () { F.dts = U.$$('[data-dt]', body).filter(function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-dt'); }); }; });
      U.$$('[data-pg]', body).forEach(function (c) { c.onchange = function () { F.ptg = U.$$('[data-pg]', body).filter(function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-pg'); }); }; });
      U.$$('.flist', body).forEach(function (l) { l.onchange = function () { var d = l.getAttribute('data-dim'); F.dims[d] = U.$$('input', l).filter(function (x) { return x.checked; }).map(function (x) { return x.value; }); }; });
      U.$$('[data-s]', body).forEach(function (s) { s.oninput = function () { var q = s.value.trim().toLowerCase(); U.$$('.flist[data-dim="' + s.getAttribute('data-s') + '"] label', body).forEach(function (l) { l.hidden = q && l.textContent.toLowerCase().indexOf(q) < 0; }); }; });
      U.$$('[data-all]', body).forEach(function (b) { b.onclick = function () { var l = U.$('.flist[data-dim="' + b.getAttribute('data-all') + '"]', body); U.$$('input', l).forEach(function (x) { if (!x.closest('label').hidden) x.checked = true; }); l.onchange(); }; });
      U.$$('[data-none]', body).forEach(function (b) { b.onclick = function () { var l = U.$('.flist[data-dim="' + b.getAttribute('data-none') + '"]', body); U.$$('input', l).forEach(function (x) { x.checked = false; }); l.onchange(); }; });
      var h = U.$('#fHid', body); if (h) h.onchange = function () { F.showHidden = h.checked; paint(); };
    };
    function opts(sel, end) { var o = ''; for (var s = 0; s <= 96; s += 2) { if (!end && s === 96) break; if (end && s === 0) continue; o += '<option value="' + s + '"' + (s === sel ? ' selected' : '') + '>' + U.hhmm(s) + '</option>'; } return o; }
    paint();
    UI.modal({ title: 'ตัวกรอง', sub: 'ใช้กับทุกหน้า (วิเคราะห์ · หนาแน่น · คาดการณ์ · อัตรากำลัง) จนกว่าจะล้าง', body: body, wide: true, cls: 'drawer',
      actions: [{ label: 'ล้างทั้งหมด', onClick: function () { F = { dims: {}, ptg: [], hours: null, dts: ['W', 'S', 'H'], showHidden: false }; paint(); return false; }, keep: true },
        { label: 'ใช้ตัวกรอง', kind: 'primary', onClick: function () { if (!F.dts.length) { UI.toast('เลือกประเภทวันอย่างน้อย 1 แบบ', 'warn'); return false; } Object.keys(F.dims).forEach(function (k) { if (!F.dims[k].length) delete F.dims[k]; }); D.FILT = F; D.saveFilt(); onApply(); } }] });
  },
  /** ตัวเลือก "ดูตาม" (มิติ) */
  dimSelect: function (host, key, def, onChange, extra) {
    var cur = STORE.get('u:' + S.me.emp + ':' + key, def);
    var all = D.DIMS.concat(extra || []);
    if (!all.some(function (d) { return d.id === cur; })) cur = def;
    var el = U.el('<label class="dimsel"><span>ดูตาม</span><select>' + all.map(function (d) { return '<option value="' + d.id + '"' + (d.id === cur ? ' selected' : '') + '>' + U.esc(d.short || d.name) + '</option>'; }).join('') + '</select></label>');
    host.appendChild(el);
    el.querySelector('select').onchange = function () { STORE.set('u:' + S.me.emp + ':' + key, this.value); onChange(this.value); };
    return cur;
  }
};

/* ---------------- ตัวเลขสรุป ---------------- */
function kpi(o) {
  var d = o.delta, dHtml = '';
  if (d != null && isFinite(d)) dHtml = '<span class="delta ' + (Math.abs(d) < 0.005 ? 'flat' : d > 0 ? 'up' : 'down') + '">' + (d > 0.005 ? '▲' : d < -0.005 ? '▼' : '■') + ' ' + U.pct(d) + '</span><span class="dl">' + (o.deltaLabel || '') + '</span>';
  return '<div class="kpi' + (o.cls ? ' ' + o.cls : '') + '"><span class="kl">' + o.label + (o.help ? UI.info(o.help) : '') + '</span>' +
    '<b class="kv" data-count="' + (typeof o.value === 'number' ? o.value : '') + '" data-d="' + (o.d || 0) + '">' + (typeof o.value === 'number' ? U.fmt(o.value, o.d || 0) : o.value) + '</b>' + (o.unit ? '<span class="ku">' + o.unit + '</span>' : '') +
    '<div class="ks">' + dHtml + (o.sub ? '<span class="sub2">' + o.sub + '</span>' : '') + '</div></div>';
}
/** ตัวเลขนับขึ้น (ครั้งแรกที่เปิดหน้า) */
function countUp(root) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  U.$$('[data-count]', root).forEach(function (el) {
    var to = +el.getAttribute('data-count'), dd = +el.getAttribute('data-d') || 0; if (!isFinite(to) || el.getAttribute('data-count') === '') return;
    var t0 = performance.now(), dur = 650;
    (function step(t) { var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = U.fmt(to * e, dd); if (k < 1) requestAnimationFrame(step); })(t0);
  });
}

/* ---------------- แถบเวลาวันนี้ (ลายเซ็นของระบบ) ---------------- */
/**
 * ribbon(el, {act:[96], exp:[96], now: ช่องล่าสุดที่มีข้อมูล, from, to})
 * ช่องละ 15 นาที · สีเข้มตามจำนวนที่มาถึง · ช่องอนาคตแสดงกรอบเส้นตามค่าคาดการณ์ · เข็มบอกเวลาปัจจุบัน
 */
function ribbon(el, o) {
  var from = o.from == null ? 20 : o.from, to = o.to == null ? 87 : o.to;
  var max = 1; for (var s = from; s <= to; s++) max = Math.max(max, o.act[s] || 0, o.exp ? o.exp[s] || 0 : 0);
  var lvl = function (v) { if (!v) return 0; return Math.min(9, 1 + Math.floor(8 * Math.sqrt(v / max))); };
  var cells = '', labels = '';
  for (s = from; s <= to; s++) {
    var past = o.now == null || s <= o.now, v = past ? o.act[s] || 0 : null, e = o.exp ? Math.round(o.exp[s] || 0) : null;
    var tipTxt = U.hhmm(s) + '–' + U.hhmm(s + 1) + ' น. · ' + (past ? 'มาถึง ' + U.fmt(v) + ' ราย' : 'ยังไม่ถึงเวลา') + (e != null ? ' · ปกติ ≈ ' + U.fmt(e) : '');
    cells += '<i class="rc ' + (past ? 'l' + lvl(v) : 'fut f' + lvl(e)) + (s === o.now ? ' now' : '') + '" data-tip="' + tipTxt + '" style="--h:' + (past ? Math.max(0.06, (v || 0) / max) : Math.max(0.06, (e || 0) / max)) + '"></i>';
    if (s % 4 === 0) labels += '<span style="grid-column:' + (s - from + 1) + '">' + U.hhmm(s).slice(0, 2) + '</span>';
  }
  el.innerHTML = '<div class="ribbon" style="--n:' + (to - from + 1) + '"><div class="rcells">' + cells + '</div><div class="rlabels">' + labels + '</div></div>';
  var tipEl = null;
  el.onmousemove = function (ev) {
    var c = ev.target.closest('.rc'); if (!c) { if (tipEl) tipEl.hidden = true; return; }
    if (!tipEl) { tipEl = U.el('<div class="rtip"></div>'); document.body.appendChild(tipEl); }
    tipEl.hidden = false; tipEl.textContent = c.getAttribute('data-tip');
    tipEl.style.left = Math.min(innerWidth - tipEl.offsetWidth - 8, ev.clientX + 12) + 'px'; tipEl.style.top = (ev.clientY - 40) + 'px';
  };
  el.onmouseleave = function () { if (tipEl) tipEl.hidden = true; };
  var obs = new MutationObserver(function () { if (!document.body.contains(el) && tipEl) { tipEl.remove(); obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });
}
/** ภาพประกอบหน้าเข้าสู่ระบบ: แถบเวลาเติมจากเช้าถึงค่ำ (เคลื่อนไหวครั้งเดียว) */
window.LOGIN_ART = function (el) {
  var prof = [], s;
  for (s = 20; s <= 84; s++) { var h = s / 4; prof.push(Math.exp(-0.5 * Math.pow((h - 8) / 1.3, 2)) + 0.35 * Math.exp(-0.5 * Math.pow((h - 11) / 1.2, 2)) + 0.25 * Math.exp(-0.5 * Math.pow((h - 17.5) / 0.9, 2)) + 0.04); }
  var mx = Math.max.apply(null, prof);
  el.innerHTML = '<div class="la-rib">' + prof.map(function (v, i) { return '<i style="--v:' + (v / mx).toFixed(3) + ';--d:' + (i * 22) + 'ms"></i>'; }).join('') + '</div><div class="la-axis"><span>05:00</span><span>09:00</span><span>13:00</span><span>17:00</span><span>21:00</span></div>';
};

/* ---------------- การแจ้งเตือนความหนาแน่น ---------------- */
var ALERTS = {
  list: [],
  init: function () { if (S.me.role !== 'tv') ALERTS.refresh(); },
  /** โหลดวันนี้ + วันเดียวกันของ 8 สัปดาห์ก่อน → ประเมินกฎทั้งหมด */
  refresh: function () {
    var t = nowBkk().iso;
    return Promise.all([D.loadToday(), D.ensure(U.addDays(t, -56), U.addDays(t, -1), true)]).then(function () { ALERTS.evaluate(); }).catch(function () { });
  },
  /** โปรไฟล์ปกติ (ค่าเฉลี่ย 8 สัปดาห์ วันเดียวกันในสัปดาห์ ประเภทวันเดียวกัน) แยกตามคลินิก */
  expected: function (iso) {
    var same = [], dt = D.dayType(iso);
    for (var k = 1; k <= 8; k++) { var d = U.addDays(iso, -7 * k); if (D.dayType(d) === dt && D.DAYS[d] && D.DAYS[d].sl) same.push(d); }
    if (dt !== 'W' && same.length < 3) { for (k = 1; k <= 21 && same.length < 6; k++) { var d2 = U.addDays(iso, -k); if (D.dayType(d2) === dt && D.DAYS[d2] && D.DAYS[d2].sl && same.indexOf(d2) < 0) same.push(d2); } }
    var cs = new Float64Array(D.nC * NS);
    same.forEach(function (d) { var sl = D.DAYS[d].sl; for (var i = 0; i < sl.length; i += 4) cs[sl[i] * NS + sl[i + 1]] += sl[i + 2] / same.length; });
    return { cs: cs, n: same.length, days: same };
  },
  evaluate: function () {
    var t = nowBkk().iso, x = D.DAYS[t];
    ALERTS.list = [];
    if (!x || !x.sl) return ALERTS.paint();
    var rules = (S.boot.settings.alerts || []).filter(function (r) { return +r.on; });
    var last = -1; for (var i = 0; i < x.sl.length; i += 4) last = Math.max(last, x.sl[i + 1]);
    if (last < 0) return ALERTS.paint();
    var ex = ALERTS.expected(t), K = D.compile({ dims: {}, ptg: [], hours: null, dts: ['W', 'S', 'H'] });
    rules.forEach(function (r) {
      var dim = r.dim === 'all' ? null : r.dim, groups = {};
      var keyOf = function (ci) { return dim ? D.val(dim, ci) : '*'; };
      for (var j = 0; j < x.sl.length; j += 4) {
        var ci = x.sl[j]; if (!K.cm[ci]) continue;
        var k = keyOf(ci); if (r.val && k !== r.val) continue;
        var g = groups[k] || (groups[k] = { act: 0, exp: 0, l60: 0 });
        g.act += x.sl[j + 2];
        if (x.sl[j + 1] > last - 4) g.l60 += x.sl[j + 2];
      }
      for (var ci2 = 0; ci2 < D.nC; ci2++) {
        if (!K.cm[ci2]) continue; var k2 = keyOf(ci2); if (r.val && k2 !== r.val) continue;
        for (var s = 0; s <= last; s++) { var e = ex.cs[ci2 * NS + s]; if (e) (groups[k2] || (groups[k2] = { act: 0, exp: 0, l60: 0 })).exp += e; }
      }
      Object.keys(groups).forEach(function (k) {
        var g = groups[k], name = dim ? D.shortLabel(dim, k) : 'ทั้งโรงพยาบาล';
        if (r.metric === 'last60' && g.l60 >= +r.thr) ALERTS.list.push({ id: r.id + ':' + k, lvl: g.l60 >= 1.5 * r.thr ? 'critical' : 'serious', title: name, msg: 'มาถึง ' + U.fmt(g.l60) + ' รายใน 1 ชั่วโมงล่าสุด (เกณฑ์ ' + r.thr + ')', dim: dim, key: k });
        if (r.metric === 'vsExp' && g.exp >= (+r.min || 20)) { var over = g.act / g.exp - 1; if (over * 100 >= +r.thr) ALERTS.list.push({ id: r.id + ':' + k, lvl: over >= 0.6 ? 'critical' : 'serious', title: name, msg: 'มากกว่าปกติ ' + U.pct(over, 0) + ' (ถึงตอนนี้ ' + U.fmt(g.act) + ' · ปกติ ≈ ' + U.fmt(g.exp) + ')', dim: dim, key: k }); }
      });
    });
    ALERTS.list.sort(function (a, b) { return (a.lvl === 'critical' ? 0 : 1) - (b.lvl === 'critical' ? 0 : 1); });
    ALERTS.paint();
    // ป๊อปอัปเฉพาะรายการใหม่ (ครั้งละไม่เกิน 3)
    var seen = {}; try { seen = JSON.parse(sessionStorage.getItem('opd:seenAl:' + t) || '{}'); } catch (e) { }
    var fresh = ALERTS.list.filter(function (a) { return !seen[a.id]; });
    fresh.slice(0, 3).forEach(function (a, i) { setTimeout(function () { UI.toast('<b>' + U.esc(a.title) + '</b><br>' + U.esc(a.msg), a.lvl === 'critical' ? 'bad' : 'warn', 7000); }, 400 + i * 500); });
    fresh.forEach(function (a) { seen[a.id] = 1; });
    try { sessionStorage.setItem('opd:seenAl:' + t, JSON.stringify(seen)); } catch (e) { }
  },
  paint: function () {
    var n = U.$('#bellN'); if (!n) return;
    n.hidden = !ALERTS.list.length; n.textContent = ALERTS.list.length;
    var b = U.$('#bellBtn'); if (b) b.classList.toggle('ring', ALERTS.list.some(function (a) { return a.lvl === 'critical'; }));
  },
  html: function (max) {
    if (!ALERTS.list.length) return '<p class="muted small ok-line">✓ ยังไม่มีจุดที่แน่นเกินเกณฑ์</p>';
    return '<ul class="alist">' + ALERTS.list.slice(0, max || 50).map(function (a) { return '<li class="al ' + a.lvl + '"><b class="ai">!</b><div><b>' + U.esc(a.title) + '</b><span>' + U.esc(a.msg) + '</span></div></li>'; }).join('') + '</ul>';
  },
  showList: function (anchor) {
    UI.pop(anchor, '<div class="apop"><h4>แจ้งเตือนความหนาแน่นวันนี้</h4>' + ALERTS.html(12) + (S.me.role === 'admin' ? '<p class="xs muted">ตั้งเกณฑ์ได้ที่ ตั้งค่าระบบ › แจ้งเตือน</p>' : '') + '</div>', { right: true });
  }
};

/* ---------------- ทัวร์แนะนำการใช้งาน ---------------- */
var TOUR = {
  steps: [
    ['.rail nav, .tabbar', 'เมนูหลัก', 'เริ่มที่ "สถานการณ์วันนี้" ดูยอดสด แล้วไป "วิเคราะห์" "ความหนาแน่น" "คาดการณ์" และ "อัตรากำลัง" เพื่อวางแผน'],
    ['#syncBtn', 'ยอดอัปเดตล่าสุด', 'ระบบดึงยอดจาก HIS ให้อัตโนมัติตามรอบที่ตั้งไว้ กดปุ่มนี้เพื่อดึงล่าสุดทันที'],
    ['#fBtn', 'ตัวกรอง', 'เลือกตึก ชั้น กลุ่มคลินิก ประเภท สิทธิ หรือช่วงเวลา ตัวกรองใช้กับทุกหน้าจนกว่าจะล้าง'],
    ['.per, .dimsel', 'ช่วงเวลาและมุมมอง', 'เลือกดูเป็นวัน สัปดาห์ เดือน ไตรมาส หรือปี (ปีงบประมาณหรือปีปฏิทิน) และเลือก "ดูตาม" ตึก ชั้น หรือกลุ่ม'],
    ['.info-btn', 'ปุ่ม i', 'กดดูคำอธิบายว่าตัวเลขนี้คำนวณอย่างไร'],
    ['#bellBtn', 'แจ้งเตือน', 'เมื่อคลินิกแน่นเกินเกณฑ์ จะมีป๊อปอัปเตือนและตัวเลขที่กระดิ่งนี้'],
    ['#btnPrint', 'พิมพ์และส่งออก', 'พิมพ์เป็น A4/PDF หรือส่งออก Excel ไว้รายงานหรือนำเสนอ · ทุกกราฟกดสลับเป็นตารางได้']
  ],
  start: function () {
    var i = 0, ov = U.el('<div class="tour"><div class="tour-hole"></div><div class="tour-card"><b></b><p></p><div><button class="btn sm" data-x>ข้าม</button><span class="xs muted"></span><button class="btn primary sm" data-n>ถัดไป</button></div></div></div>');
    document.body.appendChild(ov);
    var end = function () { ov.remove(); STORE.set('u:' + S.me.emp + ':toured', true); };
    var show = function () {
      while (i < TOUR.steps.length) {
        var st = TOUR.steps[i], el = U.$$(st[0]).filter(function (e) { var r = e.getBoundingClientRect(); return e.offsetParent !== null && r.width > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight; })[0];
        if (el) break; i++;
      }
      if (i >= TOUR.steps.length) return end();
      var r = el.getBoundingClientRect(), hole = U.$('.tour-hole', ov), card = U.$('.tour-card', ov);
      hole.style.cssText = 'left:' + (r.left - 6) + 'px;top:' + (r.top - 6) + 'px;width:' + (r.width + 12) + 'px;height:' + (r.height + 12) + 'px';
      U.$('b', card).textContent = st[1]; U.$('p', card).textContent = st[2]; U.$('span', card).textContent = (i + 1) + '/' + TOUR.steps.length;
      U.$('[data-n]', card).textContent = i === TOUR.steps.length - 1 ? 'เริ่มใช้งาน' : 'ถัดไป';
      var cw = Math.min(320, innerWidth - 24), left = U.clamp(r.left, 12, innerWidth - cw - 12), top = r.bottom + 14;
      if (top + 170 > innerHeight) top = r.top - 184; top = U.clamp(top, 12, Math.max(12, innerHeight - 200));
      card.style.cssText = 'left:' + left + 'px;top:' + top + 'px;width:' + cw + 'px';
    };
    U.$('[data-x]', ov).onclick = end;
    U.$('[data-n]', ov).onclick = function () { i++; show(); };
    show();
  }
};
