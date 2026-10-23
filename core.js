/* =====================================================================
   core.js — แกนหน้าเว็บ OPD Flow
   ตัวช่วยทั่วไป · เรียกหลังบ้าน (หรือหลังบ้านจำลองในโหมดสาธิต) · แคช · หน้าต่าง/แจ้งเตือน · เข้าสู่ระบบ · เมนู
   สัญญากับหลังบ้าน: POST text/plain {action, token, payload} → {ok, data|error}  (เหมือนทุกระบบของ SMC)
   ===================================================================== */
'use strict';
var DEMO = !window.API_URL;
var S = { boot: null, token: null, me: null, page: 'live', busy: 0, demoClock: null };

/* ---------------- ตัวช่วย ---------------- */
var U = {
  esc: function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); },
  fmt: function (n, d) { if (n == null || !isFinite(n)) return '–'; return Number(n).toLocaleString('th-TH', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); },
  pct: function (n, d) { if (n == null || !isFinite(n)) return '–'; return (n > 0 ? '+' : '') + Number(n * 100).toLocaleString('th-TH', { maximumFractionDigits: d == null ? 1 : d }) + '%'; },
  share: function (n, d) { if (n == null || !isFinite(n)) return '–'; return Number(n * 100).toLocaleString('th-TH', { maximumFractionDigits: d == null ? 1 : d }) + '%'; },
  MTH: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
  MTHF: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'],
  DOW: ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'],
  DOWF: ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'],
  p: function (iso) { return iso.split('-').map(Number); },
  addDays: function (iso, n) { var p = U.p(iso), d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)); return d.toISOString().slice(0, 10); },
  dow: function (iso) { var p = U.p(iso); return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); },
  diff: function (a, b) { var x = U.p(a), y = U.p(b); return Math.round((Date.UTC(y[0], y[1] - 1, y[2]) - Date.UTC(x[0], x[1] - 1, x[2])) / 864e5); },
  ymAdd: function (ym, n) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + ('0' + (m + 1)).slice(-2); },
  ymList: function (a, b) { var o = [], x = a.slice(0, 7); while (x <= b.slice(0, 7) && o.length < 600) { o.push(x); x = U.ymAdd(x, 1); } return o; },
  lastDay: function (ym) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7); return ym + '-' + ('0' + new Date(Date.UTC(y, m, 0)).getUTCDate()).slice(-2); },
  dates: function (a, b) { var o = []; for (var d = a; d <= b && o.length < 4000; d = U.addDays(d, 1)) o.push(d); return o; },
  be: function (y) { return y + 543; },
  thDate: function (iso, opt) { if (!iso) return '–'; var p = U.p(iso); opt = opt || {}; return (opt.dow ? U.DOW[U.dow(iso)] + ' ' : '') + p[2] + ' ' + (opt.full ? U.MTHF : U.MTH)[p[1] - 1] + (opt.noYear ? '' : ' ' + String(U.be(p[0])).slice(opt.full ? 0 : 2)); },
  thMonth: function (ym, full) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7); return (full ? U.MTHF : U.MTH)[m - 1] + ' ' + (full ? U.be(y) : String(U.be(y)).slice(2)); },
  hhmm: function (slot, size) { var mm = slot * (size || 15); return ('0' + Math.floor(mm / 60)).slice(-2) + ':' + ('0' + mm % 60).slice(-2); },
  debounce: function (fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; },
  sum: function (a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] || 0; return s; },
  uid: function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },
  clamp: function (x, a, b) { return Math.max(a, Math.min(b, x)); },
  /** สร้าง element จาก HTML */
  el: function (html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; },
  $: function (sel, root) { return (root || document).querySelector(sel); },
  $$: function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
};
/** เวลาปัจจุบันของ รพ. (Asia/Bangkok) · โหมดสาธิตเลื่อนเวลาได้ */
function nowBkk() {
  var t = S.demoClock != null ? S.demoClock : Date.now();
  var d = new Date(t + 7 * 3600e3);
  return { iso: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes(), hm: ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2), t: t };
}

/* ---------------- จัดเก็บในเครื่อง (ทุกครั้งครอบ try) ---------------- */
var STORE = {
  get: function (k, def) { try { var v = localStorage.getItem('opd:' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  set: function (k, v) { try { localStorage.setItem('opd:' + k, JSON.stringify(v)); } catch (e) { } },
  del: function (k) { try { localStorage.removeItem('opd:' + k); } catch (e) { } },
  clearUser: function () { try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('opd:u:') === 0) localStorage.removeItem(k); }); } catch (e) { } }
};
/** IndexedDB สำหรับข้อมูลรายเดือนที่ปิดแล้ว (ไม่เปลี่ยน) — ใหญ่เกิน localStorage */
var IDB = (function () {
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res) {
      try {
        var r = indexedDB.open('opdflow', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('packs'); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
    return dbp;
  }
  return {
    get: function (k) { return db().then(function (d) { if (!d) return null; return new Promise(function (res) { try { var q = d.transaction('packs').objectStore('packs').get(k); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; } catch (e) { res(null); } }); }); },
    put: function (k, v) { return db().then(function (d) { if (!d) return; try { d.transaction('packs', 'readwrite').objectStore('packs').put(v, k); } catch (e) { } }); },
    clear: function () { return db().then(function (d) { if (!d) return; try { d.transaction('packs', 'readwrite').objectStore('packs').clear(); } catch (e) { } }); }
  };
})();

/* ---------------- เรียกหลังบ้าน ---------------- */
var READ_RX = /^(get|list|bootstrap|ping|login|test)/;
var _q = [], _active = 0;
function api(action, payload, opt) {
  opt = opt || {};
  return new Promise(function (res, rej) {
    _q.push({ action: action, payload: payload || {}, res: res, rej: rej, tries: 0, bg: !!opt.bg });
    _q.sort(function (a, b) { return (a.bg ? 1 : 0) - (b.bg ? 1 : 0); });
    pump();
  });
}
function pump() {
  while (_active < 4 && _q.length) {
    var j = _q[0];
    if (j.bg && _active >= 1) return;   // งานเบื้องหลังทีละ 1 (งานผู้ใช้ก่อนเสมอ)
    _q.shift(); _active++; run(j);
  }
}
function run(j) {
  var slow = setTimeout(function () { busy(true, 'กำลังรอเซิร์ฟเวอร์ Google…'); }, 3500);
  var done = function () { clearTimeout(slow); _active--; busy(false); pump(); };
  var p = DEMO ? MOCK.rpc(j.action, S.token, j.payload)
    : fetch(window.API_URL, { method: 'POST', body: JSON.stringify({ action: j.action, token: S.token, payload: j.payload }), credentials: 'omit', redirect: 'follow' })
      .then(function (r) { return r.text(); })
      .then(function (t) { if (t.charAt(0) === '<') throw new Error('BUSY'); return JSON.parse(t); });
  p.then(function (r) {
    done();
    if (r && r.ok) return j.res(r.data);
    var msg = (r && r.error) || 'เกิดข้อผิดพลาด';
    if (msg === 'SESSION_EXPIRED') { logout(true); return j.rej(new Error('หมดเวลาการเข้าใช้ กรุณาเข้าสู่ระบบอีกครั้ง')); }
    j.rej(new Error(msg));
  }).catch(function (e) {
    done();
    if (READ_RX.test(j.action) && j.tries < 2) { j.tries++; setTimeout(function () { _q.unshift(j); pump(); }, 1200 * j.tries); return; }
    j.rej(new Error(e && e.message === 'BUSY' ? 'เซิร์ฟเวอร์ Google ไม่ว่างชั่วคราว กรุณาลองอีกครั้ง' : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง'));
  });
}
var _busyN = 0;
function busy(on, msg) {
  _busyN = Math.max(0, _busyN + (on ? 1 : -1));
  var b = U.$('#busy'); if (!b) return;
  if (on && msg) b.querySelector('span').textContent = msg;
  b.hidden = _busyN === 0;
}

/* ---------------- แจ้งเตือน / หน้าต่าง ---------------- */
var UI = {
  toast: function (msg, kind, ms) {
    var box = U.$('#toasts'); if (!box) return;
    var ic = { ok: '✓', warn: '!', bad: '!', info: 'i' }[kind || 'info'];
    var t = U.el('<div class="toast ' + (kind || 'info') + '" role="status"><b class="ti">' + ic + '</b><div>' + msg + '</div><button class="tx" aria-label="ปิด">×</button></div>');
    box.appendChild(t);
    var close = function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 260); };
    t.querySelector('.tx').onclick = close;
    setTimeout(close, ms || 4200);
    return t;
  },
  /** หน้าต่างลอย: {title, sub, body(html|node), actions:[{label, kind, onClick}], wide, onOpen} */
  modal: function (o) {
    var m = U.el('<div class="modal-wrap' + (o.cls ? ' ' + o.cls : '') + '" role="dialog" aria-modal="true"><div class="modal' + (o.wide ? ' wide' : '') + (o.full ? ' full' : '') + '">' +
      '<header><div><h3>' + o.title + '</h3>' + (o.sub ? '<p class="muted small">' + o.sub + '</p>' : '') + '</div><button class="icon-btn mx" aria-label="ปิด">' + ICON.x + '</button></header>' +
      '<div class="mbody"></div>' + (o.actions && o.actions.length ? '<footer></footer>' : '') + '</div></div>');
    var body = m.querySelector('.mbody');
    if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.appendChild(o.body);
    var close = function () { m.classList.add('out'); document.removeEventListener('keydown', esc); setTimeout(function () { m.remove(); if (o.onClose) o.onClose(); }, 220); };
    var esc = function (e) { if (e.key === 'Escape') close(); };
    (o.actions || []).forEach(function (a) {
      var b = U.el('<button class="btn ' + (a.kind || '') + '">' + a.label + '</button>');
      b.onclick = function () { var r = a.onClick ? a.onClick(close, m) : null; if (r !== false && !a.keep) close(); };
      m.querySelector('footer').appendChild(b);
    });
    m.querySelector('.mx').onclick = close;
    m.addEventListener('mousedown', function (e) { if (e.target === m) close(); });
    document.addEventListener('keydown', esc);
    document.body.appendChild(m);
    setTimeout(function () { var f = m.querySelector('input,select,button.primary'); if (f && !o.noFocus) f.focus(); }, 60);
    if (o.onOpen) o.onOpen(body, close);
    return { el: m, body: body, close: close };
  },
  confirm: function (title, msg, label, danger) {
    return new Promise(function (res) {
      UI.modal({ title: title, body: '<p>' + msg + '</p>', actions: [{ label: 'ยกเลิก', onClick: function () { res(false); } }, { label: label || 'ยืนยัน', kind: danger ? 'danger' : 'primary', onClick: function () { res(true); } }], onClose: function () { res(false); } });
    });
  },
  /** กล่องลอยใกล้ปุ่ม (วางใน body เสมอ — บทเรียน SMC Duty #13) */
  pop: function (anchor, content, opt) {
    UI.closePop();
    opt = opt || {};
    var p = U.el('<div class="pop' + (opt.cls ? ' ' + opt.cls : '') + '"></div>');
    if (typeof content === 'string') p.innerHTML = content; else p.appendChild(content);
    document.body.appendChild(p);
    var r = anchor.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight, vw = innerWidth, vh = innerHeight;
    var left = U.clamp(opt.right ? r.right - w : r.left, 8, vw - w - 8), top = r.bottom + 6;
    if (top + h > vh - 8) top = Math.max(8, r.top - h - 6);
    p.style.left = left + 'px'; p.style.top = top + 'px';
    UI._pop = p;
    setTimeout(function () { document.addEventListener('mousedown', UI._out); }, 0);
    return p;
  },
  _out: function (e) { if (UI._pop && !UI._pop.contains(e.target)) UI.closePop(); },
  closePop: function () { if (UI._pop) { UI._pop.remove(); UI._pop = null; } document.removeEventListener('mousedown', UI._out); },
  /** ปุ่ม ⓘ อธิบายตัวเลข */
  info: function (key) { return '<button class="info-btn" data-help="' + key + '" aria-label="คำอธิบาย">i</button>'; }
};
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-help]');
  if (!b) return;
  e.preventDefault(); e.stopPropagation();
  var h = (window.HELP_TIPS || {})[b.getAttribute('data-help')];
  if (h) UI.pop(b, '<div class="tip"><b>' + h[0] + '</b><p>' + h[1] + '</p></div>', { cls: 'tip-pop' });
});

/* ---------------- ไอคอน (เส้น 1.8px) ---------------- */
function svg(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
var ICON = {
  live: svg('<path d="M3 12h4l2-6 4 12 2-6h6"/>'),
  explore: svg('<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>'),
  heat: svg('<rect x="3" y="3" width="5" height="5" rx="1"/><rect x="10" y="3" width="5" height="5" rx="1"/><rect x="17" y="3" width="4" height="5" rx="1"/><rect x="3" y="10" width="5" height="5" rx="1"/><rect x="10" y="10" width="5" height="5" rx="1"/><rect x="3" y="17" width="5" height="4" rx="1"/>'),
  forecast: svg('<path d="M3 17l5-5 4 3 5-7"/><path d="M17 8h4v4" /><path d="M14 20h7" stroke-dasharray="2 3"/>'),
  staff: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c.6-3.4 2.8-5.2 5.5-5.2s4.9 1.8 5.5 5.2"/><path d="M16 11.5a2.6 2.6 0 1 0 0-5.2M18 14.6c1.6.6 2.6 2.2 3 5.4"/>'),
  tv: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.8M12 17.2h.01"/>'),
  filter: svg('<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>'),
  refresh: svg('<path d="M20 11a8 8 0 0 0-14.7-4.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.7 4.3l1.3-1.8M20 20v-4.5h-4.5"/>'),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  chevL: svg('<path d="M15 6l-6 6 6 6"/>'), chevR: svg('<path d="M9 6l6 6-6 6"/>'), chevD: svg('<path d="M6 9l6 6 6-6"/>'),
  download: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  print: svg('<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><rect x="7" y="14" width="10" height="7"/>'),
  image: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'),
  table: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>'),
  bell: svg('<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
  out: svg('<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>'),
  more: svg('<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
  drag: svg('<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>'),
  expand: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')
};

/* ---------------- เมนู ---------------- */
var PAGES = [
  { id: 'live', name: 'สถานการณ์วันนี้', short: 'วันนี้', icon: 'live' },
  { id: 'explore', name: 'วิเคราะห์ยอดผู้ป่วย', short: 'วิเคราะห์', icon: 'explore' },
  { id: 'heat', name: 'ความหนาแน่นตามเวลา', short: 'หนาแน่น', icon: 'heat' },
  { id: 'forecast', name: 'คาดการณ์แนวโน้ม', short: 'คาดการณ์', icon: 'forecast' },
  { id: 'staff', name: 'วางแผนอัตรากำลัง', short: 'อัตรากำลัง', icon: 'staff' },
  { id: 'tv', name: 'จอแสดงผล', short: 'จอ', icon: 'tv' },
  { id: 'admin', name: 'ตั้งค่าระบบ', short: 'ตั้งค่า', icon: 'settings', admin: true },
  { id: 'help', name: 'คู่มือการใช้งาน', short: 'คู่มือ', icon: 'help' }
];
var PAGE_FN = {};   // แต่ละไฟล์หน้าลงทะเบียน PAGE_FN.<id> = function(root){…}

function renderShell() {
  var me = S.me, isAdmin = me.role === 'admin';
  var nav = PAGES.filter(function (p) { return !p.admin || isAdmin; });
  document.body.innerHTML =
    '<div class="shell">' +
    '<aside class="rail" aria-label="เมนูหลัก">' +
    '<a class="brand" href="#/live"><img src="logo-hospital.png" alt="" width="34" height="34"><span><b>OPD Flow</b><small>ยอดผู้ป่วยนอกทั้งโรงพยาบาล</small></span></a>' +
    '<nav>' + nav.map(function (p) { return '<a href="#/' + p.id + '" data-page="' + p.id + '">' + ICON[p.icon] + '<span>' + p.name + '</span></a>'; }).join('') + '</nav>' +
    '<div class="rail-foot"><div class="me"><b>' + U.esc(me.name) + '</b><small>' + U.esc(me.emp) + ' · ' + (isAdmin ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน') + '</small></div>' +
    '<div class="rail-act"><button class="icon-btn" id="themeBtn" aria-label="สลับโหมดสว่าง/มืด">' + ICON.moon + '</button><button class="icon-btn" id="logoutBtn" aria-label="ออกจากระบบ">' + ICON.out + '</button></div>' +
    '<small class="ver">รุ่น ' + FRONT_BUILD + (DEMO ? ' · สาธิต' : '') + '</small></div>' +
    '</aside>' +
    '<div class="main">' +
    (DEMO ? '<div class="demo-bar" id="demoBar"></div>' : '') +
    '<header class="top"><button class="icon-btn menu-btn" id="menuBtn" aria-label="เมนู">' + ICON.more + '</button><h1 id="pageTitle"></h1><div class="top-tools" id="topTools"></div>' +
    '<div class="sync" id="sync"></div><button class="icon-btn bell" id="bellBtn" aria-label="การแจ้งเตือน">' + ICON.bell + '<i id="bellN" hidden></i></button></header>' +
    '<main id="page" tabindex="-1"></main>' +
    '</div>' +
    '<nav class="tabbar" aria-label="เมนูด่วน">' + ['live', 'explore', 'heat', 'forecast', 'staff'].map(function (id) { var p = PAGES.filter(function (x) { return x.id === id; })[0]; return '<a href="#/' + id + '" data-page="' + id + '">' + ICON[p.icon] + '<span>' + p.short + '</span></a>'; }).join('') + '</nav>' +
    '</div><div id="toasts" aria-live="polite"></div><div id="busy" class="busy" hidden><i></i><span>กำลังโหลด…</span></div>';
  U.$('#themeBtn').onclick = toggleTheme;
  U.$('#logoutBtn').onclick = function () { UI.confirm('ออกจากระบบ', 'ต้องการออกจากระบบใช่ไหม', 'ออกจากระบบ').then(function (y) { if (y) logout(); }); };
  U.$('#menuBtn').onclick = function () { document.body.classList.toggle('rail-open'); };
  U.$('#bellBtn').onclick = function () { if (window.ALERTS) ALERTS.showList(U.$('#bellBtn')); };
  U.$('.rail nav').addEventListener('click', function () { document.body.classList.remove('rail-open'); });
  paintTheme();
  if (DEMO && window.MOCK) MOCK.renderBar();
  SYNC.paint();
}
function go(page) { location.hash = '#/' + page; }
function route() {
  var h = (location.hash || '').replace(/^#\/?/, '').split('?')[0] || 'live';
  var pg = PAGES.filter(function (p) { return p.id === h; })[0];
  if (!pg || (pg.admin && S.me.role !== 'admin')) { h = 'live'; pg = PAGES[0]; }
  if (S.me.role === 'tv') { h = 'tv'; pg = PAGES.filter(function (p) { return p.id === 'tv'; })[0]; }
  S.page = h;
  document.body.classList.toggle('tv-mode', h === 'tv');
  U.$$('[data-page]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-page') === h); a.setAttribute('aria-current', a.getAttribute('data-page') === h ? 'page' : 'false'); });
  U.$('#pageTitle').textContent = pg.name;
  U.$('#topTools').innerHTML = '';
  UI.closePop();
  if (window.CH) CH.disposeAll();
  // สร้างกล่องหน้าใหม่ทุกครั้ง: งานโหลดของหน้าเก่าที่ตอบช้าจะวาดลงกล่องเดิมที่หลุดจากจอแล้ว ไม่ทับหน้าใหม่
  var old = U.$('#page'), root = document.createElement('main'); root.id = 'page'; root.tabIndex = -1; root.className = 'pg-' + h;
  old.parentNode.replaceChild(root, old); window.scrollTo(0, 0);
  try { PAGE_FN[h](root); } catch (e) { console.error(e); root.innerHTML = '<div class="empty"><b>เปิดหน้านี้ไม่สำเร็จ</b><p>' + U.esc(e.message) + '</p></div>'; }
  STORE.set('u:' + S.me.emp + ':page', h);
}
window.addEventListener('hashchange', function () { if (S.me) route(); });

/* ---------------- ธีม ---------------- */
function paintTheme() {
  var t = STORE.get('theme', '');
  if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
  var dark = isDark(), b = U.$('#themeBtn'); if (b) b.innerHTML = dark ? ICON.sun : ICON.moon;
}
function isDark() { var t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; }
function toggleTheme() { STORE.set('theme', isDark() ? 'light' : 'dark'); paintTheme(); route(); }

/* ---------------- สถานะการดึงข้อมูล (มุมขวาบน) ---------------- */
var SYNC = {
  st: null, timer: null,
  set: function (st) { SYNC.st = st; SYNC.paint(); },
  paint: function () {
    var el = U.$('#sync'); if (!el) return;
    var st = SYNC.st || (S.boot && S.boot.status) || {};
    var last = st.lastFetchAt ? st.lastFetchAt.slice(11, 16) : '–';
    var bad = st.lastError && st.lastErrorAt && st.lastErrorAt >= (st.lastFetchAt || '');
    el.innerHTML = '<button class="sync-btn' + (bad ? ' bad' : '') + '" id="syncBtn" title="ดึงข้อมูลล่าสุดจาก HIS ทันที">' + ICON.refresh +
      '<span><b>อัปเดต ' + last + ' น.</b><small>' + (bad ? 'ดึงครั้งล่าสุดไม่สำเร็จ' : st.nextFetchAt ? 'รอบถัดไป ' + st.nextFetchAt.slice(11, 16) + ' น.' : 'ดึงทุก ' + ((S.boot && S.boot.settings.fetchEvery) || 30) + ' นาที') + '</small></span></button>';
    U.$('#syncBtn').onclick = SYNC.now;
  },
  now: function () {
    var b = U.$('#syncBtn'); if (b) b.classList.add('spin');
    return api('refreshNow', {}).then(function (r) {
      SYNC.set(r.status);
      D.invalidateToday();
      UI.toast('ดึงข้อมูลล่าสุดแล้ว · วันนี้ ' + U.fmt(r.todayTotal) + ' ราย', 'ok');
      if (S.page !== 'admin' && S.page !== 'help') route();
    }).catch(function (e) { UI.toast(e.message, 'bad'); }).then(function () { var b2 = U.$('#syncBtn'); if (b2) b2.classList.remove('spin'); });
  },
  /** ถามเลขรุ่นแบบเบาทุก 60 วิ ขณะเปิดหน้าจออยู่ → มีข้อมูลใหม่ค่อยวาดใหม่ */
  start: function () {
    clearInterval(SYNC.timer);
    SYNC.timer = setInterval(function () {
      if (document.hidden || !S.me) return;
      api('ping', { v: D.todayVer() }, { bg: true }).then(function (r) {
        if (r.status) SYNC.set(r.status);
        if (r.todayVer && r.todayVer !== D.todayVer()) { D.invalidateToday(); if (S.page === 'live' || S.page === 'tv') route(); }
      }).catch(function () { });
    }, 60000);
  }
};

/* ---------------- เข้าสู่ระบบ ---------------- */
function loginScreen(msg) {
  document.body.innerHTML =
    '<div class="login">' +
    '<section class="login-art" aria-hidden="true"><div class="ribbon-art" id="ribbonArt"></div>' +
    '<div class="la-text"><h2>เห็นการไหลของผู้ป่วยนอก ทั้งโรงพยาบาล ในจอเดียว</h2><p>ยอดสดจากระบบ HIS ทุกคลินิก ทุกชั้น ทุกตึก — ช่วงเวลาที่แน่น แนวโน้มที่กำลังมา และอัตรากำลังที่ควรมี</p></div></section>' +
    '<section class="login-box"><img src="logo-hospital.png" alt="" width="56" height="56">' +
    '<h1>OPD Flow</h1><p class="muted">ระบบติดตามยอดผู้ป่วยนอกแบบเรียลไทม์<br>โรงพยาบาลสมเด็จพระบรมราชเทวี ณ ศรีราชา</p>' +
    '<form id="lf" autocomplete="on"><label>รหัสเจ้าหน้าที่ 7 หลัก<input id="lu" inputmode="numeric" maxlength="7" autocomplete="username" required placeholder="ตัวเลข 7 หลัก"></label>' +
    '<label>รหัสผ่านระบบ HIS<input id="lp" type="password" autocomplete="current-password" required></label>' +
    '<p class="err" id="lerr" role="alert">' + (msg ? U.esc(msg) : '') + '</p>' +
    '<button class="btn primary big" id="lb">เข้าสู่ระบบ</button></form>' +
    (DEMO ? '<div class="demo-login"><p><b>โหมดสาธิต (ข้อมูลจำลอง)</b> กดเลือกบัญชีตัวอย่างเพื่อเข้าดู</p><button class="btn" data-u="1000001">ผู้ดูแลระบบ (ตัวอย่าง)</button><button class="btn" data-u="1000002">หัวหน้าหอ เห็นเฉพาะเขต (ตัวอย่าง)</button></div>' : '') +
    '<p class="muted xs">ใช้รหัสผ่านเดียวกับระบบ HIS · ผู้ที่ได้รับสิทธิ์จากผู้ดูแลระบบเท่านั้นที่เข้าใช้ได้</p></section></div>';
  var f = U.$('#lf');
  f.onsubmit = function (e) {
    e.preventDefault();
    var u = U.$('#lu').value.trim(), p = U.$('#lp').value;
    if (!/^\d{7}$/.test(u)) { U.$('#lerr').textContent = 'กรุณากรอกรหัสเจ้าหน้าที่ 7 หลัก'; return; }
    U.$('#lb').disabled = true; U.$('#lb').textContent = 'กำลังตรวจสอบกับระบบ HIS…'; U.$('#lerr').textContent = '';
    api('login', { emp: u, pass: p }).then(start).catch(function (er) { U.$('#lerr').textContent = er.message; U.$('#lb').disabled = false; U.$('#lb').textContent = 'เข้าสู่ระบบ'; });
  };
  U.$$('.demo-login [data-u]').forEach(function (b) { b.onclick = function () { U.$('#lu').value = b.getAttribute('data-u'); U.$('#lp').value = 'demo'; f.requestSubmit(); }; });
  paintTheme();
  if (window.LOGIN_ART) LOGIN_ART(U.$('#ribbonArt'));
}
function start(r) {
  S.token = r.token; S.boot = r.boot; S.me = r.boot.me;
  STORE.set('token', r.token);
  D.init(S.boot);
  renderShell();
  var want = (location.hash || '').replace(/^#\/?/, '');
  if (!want) location.hash = '#/' + STORE.get('u:' + S.me.emp + ':page', 'live'); else route();
  SYNC.start();
  if (window.ALERTS) ALERTS.init();
  if (window.TOUR && !STORE.get('u:' + S.me.emp + ':toured', false)) setTimeout(TOUR.start, 900);
}
function logout(expired) {
  if (!expired) api('logout', {}).catch(function () { });
  STORE.del('token'); STORE.clearUser(); S.token = null; S.me = null;
  clearInterval(SYNC.timer);
  loginScreen(expired ? 'หมดเวลาการเข้าใช้ กรุณาเข้าสู่ระบบอีกครั้ง' : '');
}
function boot() {
  // โหมดจอแสดงผล (ไม่ต้องล็อกอิน) — ลิงก์ ?tv=<รหัสจอ>
  var tv = (location.search.match(/[?&]tv=([\w-]+)/) || [])[1];
  if (tv) { api('tvLogin', { key: tv }).then(function (r) { start(r); location.hash = '#/tv'; }).catch(function (e) { loginScreen(e.message); }); return; }
  var tk = STORE.get('token', null);
  if (!tk) return loginScreen();
  S.token = tk;
  api('bootstrap', {}).then(function (b) { start({ token: tk, boot: b }); }).catch(function () { STORE.del('token'); loginScreen(); });
}
document.addEventListener('DOMContentLoaded', boot);
