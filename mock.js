/* =====================================================================
   mock.js — "หลังบ้านจำลอง" สำหรับโหมดสาธิต (เมื่อ config.js ยังไม่ใส่ API_URL)
   ตอบคำสั่งชุดเดียวกับ Apps Script จริงทุกคำสั่ง → พอไอทีส่ง API มา ระบบจริงใช้หน้าเว็บนี้ได้ทันที
   การแก้ตั้งค่าในโหมดสาธิตเก็บในเบราว์เซอร์นี้เท่านั้น
   ===================================================================== */
'use strict';
var MOCK = (function () {
  var HOL = {}; SEED_HOLIDAYS.forEach(function (h) { HOL[h[0]] = h[1]; });
  var PTN = SEED_PTTYPES.map(function (p) { return p[0]; });
  var cache = {};
  var ST = load();

  function defaults() {
    var clinics = SEED_CLINICS.map(function (c, i) { return { i: i, code: c[0], name: c[1], type: c[2], bld: c[3], floor: c[4], grp: c[5], show: c[6], g: {}, note: '' }; });
    // ตัวอย่างกลุ่มกำหนดเอง: เขตรับผิดชอบของผู้ตรวจการพยาบาล (สมมติ — แอดมินจัดใหม่ได้)
    var G = { id: 'nurse', name: 'เขตผู้ตรวจการพยาบาล (ตัวอย่าง)', groups: [
      { id: 'OPD1', name: 'งานผู้ป่วยนอก 1 · อาคาร 150 ปี ชั้น 1–5', order: 0 },
      { id: 'OPD2', name: 'งานผู้ป่วยนอก 2 · อาคาร 150 ปี ชั้น 6 ขึ้นไป', order: 1 },
      { id: 'OT', name: 'คลินิกนอกเวลา/พิเศษ', order: 2 },
      { id: 'BR', name: 'ศูนย์บริการสุขภาพสาขา', order: 3 },
      { id: 'OTH', name: 'ตึกอื่น ๆ / ศูนย์ผู้สูงอายุ', order: 4 }] };
    clinics.forEach(function (c) {
      var f = +c.floor || 0;
      c.g.nurse = /นอกเวลา/.test(c.type) ? 'OT' : /สาขา/.test(c.bld) ? 'BR' : /150 ปี/.test(c.bld) ? (f && f <= 5 ? 'OPD1' : 'OPD2') : 'OTH';
    });
    return {
      clinics: clinics,
      pts: SEED_PTTYPES.map(function (p, i) { return { i: i, name: p[0], grp: p[1] }; }),
      ptGroups: SEED_PTGROUPS.map(function (g, i) { return { id: g[0], name: g[1], order: i }; }),
      groupings: [G],
      holidays: HOL,
      users: [
        { emp: '5371822', name: 'พว.ณภัชดา ศิริมาสกุล', role: 'admin', scope: [], active: 1, note: 'ผู้ตรวจการพยาบาล งานผู้ป่วยนอก 1' },
        { emp: '5660101', name: 'หัวหน้าหอ (ตัวอย่าง)', role: 'viewer', scope: [{ dim: 'g:nurse', val: 'OPD1' }], active: 1, note: 'เห็นเฉพาะงานผู้ป่วยนอก 1' }
      ],
      settings: {
        orgName: 'โรงพยาบาลสมเด็จพระบรมราชเทวี ณ ศรีราชา',
        fetchEvery: 30, fetchFrom: '05:00', fetchTo: '22:00', nightlyAt: 2, recheckDays: 3, backfillFrom: '2023-10-01',
        slotView: 30, staffDim: 'grp', nhppd: { 'default': 0.2 }, actual: {}, hoursPerDay: 7, relief: 1.2, weekFactor: 1.4, onDutyHours: 8,
        alerts: [
          { id: 'a1', dim: 'all', val: '', metric: 'vsExp', thr: 30, min: 40, on: 1, note: 'ทั้ง รพ. มาก่อนคาด ≥30%' },
          { id: 'a2', dim: 'clinic', val: '', metric: 'last60', thr: 60, on: 1, note: 'คลินิกใดมี ≥60 รายใน 1 ชม.' }
        ],
        tv: { key: 'tv-demo-150', rotate: 20, title: 'สถานการณ์ผู้ป่วยนอกวันนี้' },
        api: { url: 'https://www.thaimed.net/api/new/', report: '(รอไอทีตั้งชื่อ)', mode: 'mock', map: { date: 'yyyymmdd', time: 'hhmm', pt: 'pttype', clinic: 'clinic', visit: 'total_visit', appoint: 'total_appoint', walkin: 'total_walkin' } }
      },
      log: [], audit: [], bf: null, ver: 1
    };
  }
  function load() { var s = null; try { s = JSON.parse(localStorage.getItem('opd:demoState') || 'null'); } catch (e) { } if (!s || s.ver !== 1) s = defaults(); return s; }
  function save() { try { localStorage.setItem('opd:demoState', JSON.stringify(ST)); } catch (e) { } }
  function seedRows() { return ST.clinics.map(function (c) { return [c.code, c.name, c.type, c.bld, c.floor, c.grp, c.show]; }); }

  /* ---------- เวลา/การดึง ---------- */
  function clock() { return nowBkk(); }
  function lastFetchMin(n) { var ev = ST.settings.fetchEvery || 30, from = toMin(ST.settings.fetchFrom), to = toMin(ST.settings.fetchTo); var m = Math.min(n.min, to); if (m < from) return null; return Math.floor((m - from) / ev) * ev + from; }
  function toMin(s) { var p = String(s || '0:0').split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  function stamp(iso, min) { return iso + ' ' + ('0' + Math.floor(min / 60)).slice(-2) + ':' + ('0' + min % 60).slice(-2) + ':00'; }
  var manual = null;   // เวลาที่กดดึงเอง (นาทีของวัน)
  function status() {
    var n = clock(), lf = lastFetchMin(n);
    if (manual && manual.iso === n.iso && (lf == null || manual.min > lf)) lf = manual.min;
    var ev = ST.settings.fetchEvery || 30, nx = lf == null ? toMin(ST.settings.fetchFrom) : lf + ev - (lf - toMin(ST.settings.fetchFrom)) % ev;
    if (nx > toMin(ST.settings.fetchTo)) nx = null;
    return {
      lastFetchAt: lf == null ? stamp(U.addDays(n.iso, -1), toMin(ST.settings.fetchTo)) : stamp(n.iso, lf), nextFetchAt: nx == null ? '' : stamp(n.iso, nx),
      lastError: '', packVer: 'demo1', firstDate: '2023-10-01', apiMode: 'mock', rowsToday: 0
    };
  }
  function dayData(iso, upto) {
    var k = iso + '|' + (upto == null ? 'all' : upto);
    if (!cache[k]) { cache[k] = MG.day(iso, seedRows(), HOLX(), upto); if (Object.keys(cache).length > 1500) cache = {}; }
    return cache[k];
  }
  function HOLX() { var h = {}; Object.keys(ST.holidays).forEach(function (d) { h[d] = 1; }); return h; }
  function e36(a) { var o = new Array(a.length); for (var i = 0; i < a.length; i++) o[i] = a[i].toString(36); return o.join(','); }
  function encD(x, at) { return x.dt + '|' + x.n.toString(36) + '|' + e36(x.cl) + '|' + e36(x.pt) + '|' + (at || ''); }
  function todayUpto() { var st = status(), n = clock(); if (st.lastFetchAt.slice(0, 10) !== n.iso) return -1; var m = toMin(st.lastFetchAt.slice(11, 16)); return Math.floor(m / 15) - 1; }

  function month(ym, part) {
    var n = clock(), days = {}, last = U.lastDay(ym), fin = last < U.addDays(n.iso, -3);
    U.dates(ym + '-01', last).forEach(function (iso) {
      if (iso > n.iso || iso < '2023-10-01') return;
      var up = iso === n.iso ? todayUpto() : null;
      if (up === -1) return;
      var x = dayData(iso, up);
      days[iso] = part === 'd' ? encD(x, iso === n.iso ? status().lastFetchAt : iso + ' 23:59:00') : e36(x.sl);
    });
    return { ym: ym, fin: fin, days: days };
  }

  /* ---------- คำสั่ง ---------- */
  function bootFor(u) {
    return { me: { emp: u.emp, name: u.name, role: u.role, scope: u.scope || [] }, clinics: ST.clinics, pts: ST.pts, ptGroups: ST.ptGroups, groupings: ST.groupings, holidays: ST.holidays, settings: ST.settings, status: status(), app: { build: FRONT_BUILD, demo: true } };
  }
  var sess = {};
  function me(tk) { var u = sess[tk]; if (!u) { try { u = JSON.parse(sessionStorage.getItem('opd:demoSess') || 'null'); } catch (e) { } if (u && u.tk === tk) sess[tk] = u = ST.users.filter(function (x) { return x.emp === u.emp; })[0]; else u = null; } if (!u) throw new Error('SESSION_EXPIRED'); return u; }
  function needAdmin(u) { if (u.role !== 'admin') throw new Error('เฉพาะผู้ดูแลระบบ'); }
  function audit(u, what, detail) { ST.audit.unshift({ at: stamp(clock().iso, clock().min), emp: u.emp, what: what, detail: detail || '' }); ST.audit = ST.audit.slice(0, 200); }

  var A = {
    login: function (p) {
      var u = ST.users.filter(function (x) { return x.emp === String(p.emp) && x.active; })[0];
      if (!u) throw new Error('รหัส ' + p.emp + ' ยังไม่ได้รับสิทธิ์เข้าใช้ระบบ กรุณาติดต่อผู้ดูแลระบบ (โหมดสาธิต: ใช้ 5371822 หรือ 5660101)');
      if (!p.pass) throw new Error('กรุณากรอกรหัสผ่าน');
      var tk = 'demo-' + U.uid(); sess[tk] = u;
      try { sessionStorage.setItem('opd:demoSess', JSON.stringify({ tk: tk, emp: u.emp })); } catch (e) { }
      u.lastLogin = stamp(clock().iso, clock().min); save();
      return { token: tk, boot: bootFor(u) };
    },
    tvLogin: function (p) {
      if (p.key !== ST.settings.tv.key) throw new Error('ลิงก์จอแสดงผลไม่ถูกต้องหรือถูกเปลี่ยนแล้ว');
      var u = { emp: 'TV', name: 'จอแสดงผล', role: 'tv', scope: [] }, tk = 'demo-tv-' + U.uid(); sess[tk] = u;
      return { token: tk, boot: bootFor(u) };
    },
    bootstrap: function (p, u) { return bootFor(u); },
    logout: function () { return {}; },
    ping: function () { var st = status(); return { status: st, todayVer: st.lastFetchAt }; },
    getMonths: function (p) { return { months: p.yms.map(function (ym) { return month(ym, p.part); }) }; },
    getToday: function () {
      var n = clock(), up = todayUpto(), st = status(), x = up === -1 ? { dt: D.dayType(n.iso), n: 0, cl: [], pt: [], sl: [] } : dayData(n.iso, up);
      return { iso: n.iso, d: encD(x, st.lastFetchAt), s: e36(x.sl), ver: st.lastFetchAt, status: st };
    },
    refreshNow: function () {
      var n = clock(); manual = { iso: n.iso, min: Math.min(n.min, toMin(ST.settings.fetchTo)) };
      var up = todayUpto(), x = up === -1 ? { n: 0 } : dayData(n.iso, up);
      ST.log.unshift({ at: stamp(n.iso, n.min), kind: 'ดึงเอง', date: n.iso, ok: 1, rows: x.n ? Math.round(x.n * 0.62) : 0, total: x.n, ms: 1800 + Math.round(Math.random() * 900), msg: 'สำเร็จ' });
      ST.log = ST.log.slice(0, 100);
      return { status: status(), todayTotal: x.n };
    },
    getAdmin: function (p, u) {
      needAdmin(u);
      if (!ST.log.length) {   // ประวัติการดึงตัวอย่าง
        var n = clock();
        for (var k = 0; k < 12; k++) { var m = toMin('05:00') + k * 30; if (m > n.min) break; ST.log.push({ at: stamp(n.iso, m), kind: 'อัตโนมัติ', date: n.iso, ok: 1, rows: 0, total: 0, ms: 1500 + k * 37, msg: 'สำเร็จ' }); }
        ST.log.reverse();
      }
      return { users: ST.users, log: ST.log, audit: ST.audit, bf: ST.bf, status: status() };
    },
    saveClinics: function (p, u) {
      needAdmin(u);
      (p.list || []).forEach(function (c) {
        var cur = ST.clinics[c.i]; if (!cur) return;
        ['name', 'type', 'bld', 'floor', 'grp', 'show', 'note'].forEach(function (k) { if (c[k] !== undefined) cur[k] = c[k]; });
        if (c.g) Object.keys(c.g).forEach(function (k) { if (c.g[k]) cur.g[k] = c.g[k]; else delete cur.g[k]; });
      });
      audit(u, 'แก้ผังคลินิก', (p.list || []).length + ' คลินิก'); save();
      return { clinics: ST.clinics };
    },
    saveGrouping: function (p, u) {
      needAdmin(u);
      var g = p.grouping, i = ST.groupings.map(function (x) { return x.id; }).indexOf(g.id);
      if (!g.id) { g.id = 'g' + U.uid(); i = -1; }
      if (i >= 0) ST.groupings[i] = { id: g.id, name: g.name, groups: g.groups }; else ST.groupings.push({ id: g.id, name: g.name, groups: g.groups });
      if (p.assign) Object.keys(p.assign).forEach(function (ci) { var c = ST.clinics[+ci]; if (c) { if (p.assign[ci]) c.g[g.id] = p.assign[ci]; else delete c.g[g.id]; } });
      var ok = {}; g.groups.forEach(function (x) { ok[x.id] = 1; });
      ST.clinics.forEach(function (c) { if (c.g[g.id] && !ok[c.g[g.id]]) delete c.g[g.id]; });
      audit(u, 'บันทึกการจัดกลุ่ม', g.name); save();
      return { groupings: ST.groupings, clinics: ST.clinics };
    },
    deleteGrouping: function (p, u) {
      needAdmin(u);
      ST.groupings = ST.groupings.filter(function (g) { return g.id !== p.id; });
      ST.clinics.forEach(function (c) { delete c.g[p.id]; });
      audit(u, 'ลบการจัดกลุ่ม', p.id); save();
      return { groupings: ST.groupings, clinics: ST.clinics };
    },
    savePts: function (p, u) { needAdmin(u); if (p.ptGroups) ST.ptGroups = p.ptGroups; (p.pts || []).forEach(function (x) { if (ST.pts[x.i]) ST.pts[x.i].grp = x.grp; }); audit(u, 'แก้กลุ่มสิทธิการรักษา'); save(); return { pts: ST.pts, ptGroups: ST.ptGroups }; },
    saveUser: function (p, u) {
      needAdmin(u);
      var x = p.user; if (!/^\d{7}$/.test(x.emp)) throw new Error('รหัสเจ้าหน้าที่ต้องเป็นตัวเลข 7 หลัก');
      var cur = ST.users.filter(function (y) { return y.emp === x.emp; })[0];
      if (x.role !== 'admin' && cur && cur.role === 'admin' && ST.users.filter(function (y) { return y.role === 'admin' && y.active; }).length < 2) throw new Error('ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน');
      if (cur) Object.assign(cur, x); else ST.users.push(Object.assign({ active: 1 }, x));
      audit(u, cur ? 'แก้สิทธิ์ผู้ใช้' : 'เพิ่มผู้ใช้', x.emp + ' ' + (x.name || '')); save();
      return { users: ST.users };
    },
    deleteUser: function (p, u) { needAdmin(u); if (p.emp === u.emp) throw new Error('ลบบัญชีของตัวเองไม่ได้'); ST.users = ST.users.filter(function (y) { return y.emp !== p.emp; }); audit(u, 'ลบผู้ใช้', p.emp); save(); return { users: ST.users }; },
    saveSettings: function (p, u) {
      if (p.partial && p.partial.actual && u.role !== 'admin') throw new Error('เฉพาะผู้ดูแลระบบ');
      needAdmin(u);
      Object.keys(p.partial || {}).forEach(function (k) { ST.settings[k] = p.partial[k]; });
      audit(u, 'แก้ตั้งค่า', Object.keys(p.partial || {}).join(', ')); save();
      return { settings: ST.settings, status: status() };
    },
    saveHolidays: function (p, u) { needAdmin(u); ST.holidays = p.holidays || {}; cache = {}; audit(u, 'แก้วันหยุด', Object.keys(ST.holidays).length + ' วัน'); save(); return { holidays: ST.holidays }; },
    newTvKey: function (p, u) { needAdmin(u); ST.settings.tv.key = 'tv-' + U.uid(); save(); return { settings: ST.settings }; },
    testApi: function (p, u) {
      needAdmin(u);
      var n = clock(), d = p.date || n.iso, hm = d === n.iso ? Math.floor(n.min / 60) * 100 + n.min % 60 : 2359;
      var rows = MG.apiRows(d, seedRows(), PTN, HOLX(), hm);
      return { ok: true, ms: 1400 + Math.round(Math.random() * 600), count: rows.length, sample: rows.slice(0, 8), total: rows.reduce(function (s, r) { return s + r.total_visit; }, 0), fields: Object.keys(rows[0] || {}), note: 'โหมดสาธิต: ข้อมูลจำลองตามรูปแบบที่คุยกับไอที' };
    },
    startBackfill: function (p, u) { needAdmin(u); ST.bf = { from: p.from, to: p.to, done: 0, total: U.diff(p.from, p.to) + 1, at: stamp(clock().iso, clock().min), state: 'running' }; save(); return { bf: ST.bf }; },
    getBackfill: function (p, u) {
      needAdmin(u);
      if (ST.bf && ST.bf.state === 'running') { ST.bf.done = Math.min(ST.bf.total, ST.bf.done + 40 + Math.round(Math.random() * 30)); if (ST.bf.done >= ST.bf.total) ST.bf.state = 'done'; save(); }
      return { bf: ST.bf };
    },
    stopBackfill: function (p, u) { needAdmin(u); if (ST.bf) ST.bf.state = 'stopped'; save(); return { bf: ST.bf }; },
    resetDemo: function () { ST = defaults(); save(); cache = {}; return {}; }
  };

  function rpc(action, token, payload) {
    return new Promise(function (res) {
      var lat = action === 'getMonths' ? 120 + 30 * (payload.yms || []).length : 160 + Math.random() * 180;
      setTimeout(function () {
        try {
          var fn = A[action]; if (!fn) throw new Error('ไม่รู้จักคำสั่ง ' + action);
          var u = (action === 'login' || action === 'tvLogin') ? null : me(token);
          res({ ok: true, data: JSON.parse(JSON.stringify(fn(payload || {}, u))) });
        } catch (e) { res({ ok: false, error: e.message }); }
      }, lat);
    });
  }

  /* ---------- แถบโหมดสาธิต (เลื่อนเวลา) ---------- */
  var runT = null, autoSet = false;
  function lastWorkDay() { var d = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10), h = new Date(Date.now() + 7 * 3600e3).getUTCHours(); if (D.dayType(d) === 'W' && h >= 7 && h < 21) return null; if (D.dayType(d) === 'W' && h >= 21) return d; for (var k = 1; k < 10; k++) { var x = U.addDays(d, -k); if (D.dayType(x) === 'W') return x; } return null; }
  function renderBar() {
    var b = U.$('#demoBar'); if (!b) return;
    // เปิดครั้งแรกนอกเวลาทำการ/วันหยุด → แสดงวันทำการล่าสุด 10:30 น. ให้เห็นภาพระหว่างวัน
    if (!autoSet && S.demoClock == null) { autoSet = true; var lw = lastWorkDay(); if (lw) { setClock('10:30', true, lw); setTimeout(function () { UI.toast('โหมดสาธิต: แสดงภาพ ' + U.thDate(lw, { dow: true, full: true }) + ' เวลา 10:30 น. (วันนี้นอกเวลาทำการ) · เปลี่ยนได้ที่แถบด้านบน', 'info', 7000); }, 900); return; } }
    var n = nowBkk();
    b.innerHTML = '<b>โหมดสาธิต</b><span>ข้อมูลจำลองทั้งหมด ยังไม่ได้เชื่อม HIS</span>' +
      '<label>' + ICON.clock + '<span>จำลองเวลา ' + U.thDate(n.iso, { dow: true, noYear: true }) + '</span><select id="dmT"><option value="">เวลาจริงตอนนี้</option>' +
      ['07:00', '08:30', '10:00', '11:30', '14:00', '16:30', '18:00'].map(function (t) { return '<option' + (S.demoClock != null && n.hm === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn sm" id="dmRun">' + (runT ? 'หยุดเดินเวลา' : 'เดินเวลาเร็ว ×180') + '</button>';
    U.$('#dmT').onchange = function () { setClock(this.value); };
    U.$('#dmRun').onclick = function () {
      if (runT) { clearInterval(runT); runT = null; renderBar(); return; }
      if (S.demoClock == null) setClock('07:00', true);
      runT = setInterval(function () { S.demoClock += 15 * 60e3; var hm = nowBkk().hm; if (hm >= '21:00') { clearInterval(runT); runT = null; } D.invalidateToday(); renderBar(); if (S.page === 'live' || S.page === 'tv') route(); }, 5000);
      renderBar();
    };
  }
  function setClock(hm, quiet, day) {
    if (!hm) S.demoClock = null;
    else { var iso = day || (S.demoClock != null ? nowBkk().iso : new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)), p = hm.split(':'); S.demoClock = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), +p[0] - 7, +p[1]); }
    manual = null; D.invalidateToday(); renderBar(); SYNC.set(status());
    if (!quiet) route();
  }
  return { rpc: rpc, renderBar: renderBar, status: status };
})();
