/* =====================================================================
   data.js — คลังข้อมูลและเครื่องคำนวณ (ทำในเบราว์เซอร์ทั้งหมด → เปิดหน้าซ้ำ/เปลี่ยนตัวกรองได้ทันที)
   ข้อมูล 1 วัน (ย่อ) : cl = [คลินิก, ยอด, นัด, walk-in]×n · pt = [คลินิก, สิทธิ, ยอด]×n · sl = [คลินิก, ช่อง15นาที, ยอด, walk-in]×n
   หลังบ้านส่งเป็นก้อนรายเดือน (part d = cl+pt, part s = sl) · เดือนที่ปิดแล้วเก็บใน IndexedDB ไม่ต้องโหลดซ้ำ
   ===================================================================== */
'use strict';
var NS = 96, SLOT = 15;
var D = {
  C: [], P: [], PG: [], G: [], DAYS: {}, LM: {}, nC: 0, nP: 0, scopeMask: null, hol: {},

  init: function (b) { D.DAYS = {}; D.LM = {}; D.FILT = null; D.meta(b); },
  /** ข้อมูลประกอบ (ผังคลินิก/สิทธิ/กลุ่ม/วันหยุด) — เรียกซ้ำหลังแก้ตั้งค่าได้โดยไม่ล้างยอดที่โหลดไว้ */
  meta: function (b) {
    D._bc = null;
    D.C = []; b.clinics.forEach(function (c) { D.C[c.i] = c; }); D.nC = D.C.length;
    D.P = []; b.pts.forEach(function (p) { D.P[p.i] = p; }); D.nP = D.P.length;
    D.PG = b.ptGroups.slice().sort(function (a, b) { return a.order - b.order; });
    D.G = (b.groupings || []).slice();
    D.hol = b.holidays || {};
    D.settings = b.settings || {};
    // ขอบเขตที่ผู้ใช้เห็น (หลังบ้านกรองซ้ำอีกชั้น)
    D.scopeMask = null;
    var sc = b.me && b.me.scope;
    if (sc && sc.length) {
      D.scopeMask = new Uint8Array(D.nC);
      D.C.forEach(function (c) { if (!c) return; sc.forEach(function (s) { if (D.val(s.dim, c.i) === s.val) D.scopeMask[c.i] = 1; }); });
    }
    D.buildDims();
  },

  /* ---------- มิติข้อมูล (ดูตาม / ตัวกรอง) ---------- */
  buildDims: function () {
    var dims = [
      { id: 'grp', name: 'กลุ่มคลินิก (รายงานสถิติ)', short: 'กลุ่มคลินิก' },
      { id: 'type', name: 'ประเภทคลินิก', short: 'ประเภท' },
      { id: 'bld', name: 'ตึก/อาคาร', short: 'ตึก' },
      { id: 'floor', name: 'ชั้น (ตึก + ชั้น)', short: 'ชั้น' }
    ];
    D.G.forEach(function (g) { dims.push({ id: 'g:' + g.id, name: g.name, short: g.name, custom: true }); });
    dims.push({ id: 'clinic', name: 'คลินิก', short: 'คลินิก' });
    D.DIMS = dims;
    D.DIM = {}; dims.forEach(function (d) { D.DIM[d.id] = d; });
  },
  val: function (dim, ci) {
    var c = D.C[ci]; if (!c) return '';
    switch (dim) {
      case 'clinic': return c.code;
      case 'grp': return c.grp || '(ไม่ระบุกลุ่ม)';
      case 'type': return c.type || '(ไม่ระบุ)';
      case 'bld': return c.bld || '(ไม่ระบุตึก)';
      case 'floor': return (c.bld || '(ไม่ระบุตึก)') + (c.floor ? ' · ชั้น ' + c.floor : ' · ไม่ระบุชั้น');
      default:
        if (dim.indexOf('g:') === 0) { var gid = dim.slice(2); return (c.g && c.g[gid]) || ''; }
        return '';
    }
  },
  label: function (dim, key) {
    if (dim === 'clinic') { var c = D.byCode(key); return c ? c.name : key; }
    if (dim.indexOf('g:') === 0) { if (!key) return '(ยังไม่จัดกลุ่ม)'; var g = D.grouping(dim.slice(2)), x = g && g.groups.filter(function (y) { return y.id === key; })[0]; return x ? x.name : key; }
    if (dim === 'ptg') { var pg = D.PG.filter(function (p) { return p.id === key; })[0]; return pg ? pg.name : key; }
    if (dim === 'pt') return key;
    return key;
  },
  shortLabel: function (dim, key) {
    var l = D.label(dim, key);
    if (dim === 'clinic') return key + ' · ' + l.replace(/^คลินิก/, '').replace(/\s*\(?นอกเวลา\)?.*$/, ' (นอกเวลา)').trim();
    return l.replace(/^อาคารศรีสวรินทิรานุสรณ์ 150 ปี/, 'อาคาร 150 ปี');
  },
  grouping: function (id) { return D.G.filter(function (g) { return g.id === id; })[0] || null; },
  byCode: function (code) { if (!D._bc) { D._bc = {}; D.C.forEach(function (c) { if (c) D._bc[c.code] = c; }); } return D._bc[code] || null; },
  /** ค่าทั้งหมดของมิติ (เฉพาะคลินิกที่แสดง) เรียงตามชื่อ */
  values: function (dim, incHidden) {
    var seen = {}, out = [];
    D.C.forEach(function (c) { if (!c || (!c.show && !incHidden) || (D.scopeMask && !D.scopeMask[c.i])) return; var k = D.val(dim, c.i); if (!seen[k]) { seen[k] = 1; out.push(k); } });
    if (dim.indexOf('g:') === 0) { var g = D.grouping(dim.slice(2)); var ord = {}; (g ? g.groups : []).forEach(function (x, i) { ord[x.id] = x.order != null ? x.order : i; }); return out.sort(function (a, b) { return (a ? (ord[a] != null ? ord[a] : 999) : 1e4) - (b ? (ord[b] != null ? ord[b] : 999) : 1e4); }); }
    return out.sort(function (a, b) { return a.localeCompare(b, 'th', { numeric: true }); });
  },
  ptGroupOf: function (pi) { var p = D.P[pi]; return p ? (p.grp || 'CASH') : 'CASH'; },

  /* ---------- ประเภทวัน ---------- */
  dayType: function (iso) { var w = U.dow(iso); if (w === 0 || w === 6) return 'S'; return D.hol[iso] ? 'H' : 'W'; },
  DT: { W: 'วันทำการ', S: 'เสาร์–อาทิตย์', H: 'วันหยุดนักขัตฤกษ์' },

  /* ---------- ถอดรหัสข้อมูลจากหลังบ้าน ---------- */
  dec: function (s) { if (!s) return new Int32Array(0); var a = s.split(','), o = new Int32Array(a.length); for (var i = 0; i < a.length; i++) o[i] = parseInt(a[i], 36) || 0; return o; },
  putDay: function (iso, d, s) {
    var x = D.DAYS[iso] || (D.DAYS[iso] = { d: iso });
    if (d != null) { var p = d.split('|'); x.dt = p[0] || D.dayType(iso); x.n = parseInt(p[1], 36) || 0; x.cl = D.dec(p[2]); x.pt = D.dec(p[3]); x.at = p[4] || ''; }
    if (s != null) x.sl = D.dec(s);
    return x;
  },
  /** โหลดข้อมูลช่วงวันที่ (part 'd' เสมอ, 's' เมื่อ needSlots) */
  ensure: function (from, to, needSlots) {
    var today = nowBkk().iso, yms = U.ymList(from, to < today ? to : today), parts = needSlots ? ['d', 's'] : ['d'];
    var tasks = [];
    parts.forEach(function (part) {
      var want = yms.filter(function (ym) { var k = part + '|' + ym, m = D.LM[k]; return !m || (!m.fin && Date.now() - m.at > 8 * 60e3); });
      if (!want.length) return;
      tasks.push(D._loadMonths(want, part));
    });
    return Promise.all(tasks);
  },
  _loadMonths: function (yms, part) {
    var pv = (S.boot.status && S.boot.status.packVer) || '1';
    // 1) จาก IndexedDB (เดือนที่ปิดแล้ว)
    return Promise.all(yms.map(function (ym) { return IDB.get(part + '|' + ym + '|' + pv); })).then(function (hits) {
      var miss = [];
      hits.forEach(function (h, i) { if (h) D._applyMonth(h, part); else miss.push(yms[i]); });
      if (!miss.length) return;
      var chunks = []; for (var i = 0; i < miss.length; i += (part === 's' ? 2 : 6)) chunks.push(miss.slice(i, i + (part === 's' ? 2 : 6)));
      return Promise.all(chunks.map(function (c) {
        return api('getMonths', { yms: c, part: part }).then(function (r) {
          r.months.forEach(function (m) { D._applyMonth(m, part); if (m.fin) IDB.put(part + '|' + m.ym + '|' + pv, m); });
        });
      }));
    });
  },
  _applyMonth: function (m, part) {
    Object.keys(m.days).forEach(function (iso) { if (part === 'd') D.putDay(iso, m.days[iso], null); else D.putDay(iso, null, m.days[iso]); });
    D.LM[part + '|' + m.ym] = { fin: !!m.fin, at: Date.now() };
  },
  /** ยอดวันนี้ (ล่าสุด) */
  _tv: '',
  loadToday: function () {
    return api('getToday', {}).then(function (r) {
      D.putDay(r.iso, r.d, r.s); D._tv = r.ver || ''; D.todayIso = r.iso;
      if (r.status) SYNC.set(r.status);
      return D.DAYS[r.iso];
    });
  },
  todayVer: function () { return D._tv; },
  invalidateToday: function () { D._tv = 'x'; var ym = nowBkk().iso.slice(0, 7); delete D.LM['d|' + ym]; delete D.LM['s|' + ym]; },

  /* ---------- ตัวกรอง ---------- */
  FILT: null,
  filt: function () {
    if (!D.FILT) D.FILT = STORE.get('u:' + S.me.emp + ':filt', null) || { dims: {}, ptg: [], hours: null, dts: ['W', 'S', 'H'], showHidden: false };
    return D.FILT;
  },
  saveFilt: function () { STORE.set('u:' + S.me.emp + ':filt', D.FILT); },
  filtActive: function (F) { F = F || D.filt(); return Object.keys(F.dims).some(function (k) { return F.dims[k] && F.dims[k].length; }) || F.ptg.length > 0 || !!F.hours || F.dts.length < 3; },
  compile: function (F) {
    F = F || D.filt();
    var cm = new Uint8Array(D.nC), sets = {};
    Object.keys(F.dims).forEach(function (k) { if (F.dims[k] && F.dims[k].length) { sets[k] = {}; F.dims[k].forEach(function (v) { sets[k][v] = 1; }); } });
    var keys = Object.keys(sets);
    for (var i = 0; i < D.nC; i++) {
      var c = D.C[i]; if (!c) continue;
      if (!c.show && !F.showHidden) continue;
      if (D.scopeMask && !D.scopeMask[i]) continue;
      var ok = true;
      for (var j = 0; j < keys.length; j++) { if (!D.DIM[keys[j]]) continue; if (!sets[keys[j]][D.val(keys[j], i)]) { ok = false; break; } }
      cm[i] = ok ? 1 : 0;
    }
    var pm = null;
    if (F.ptg && F.ptg.length) { var gs = {}; F.ptg.forEach(function (g) { gs[g] = 1; }); pm = new Uint8Array(D.nP); for (var p = 0; p < D.nP; p++) if (D.P[p] && gs[D.ptGroupOf(p)]) pm[p] = 1; }
    var dt = {}; (F.dts && F.dts.length ? F.dts : ['W', 'S', 'H']).forEach(function (t) { dt[t] = 1; });
    return { cm: cm, pm: pm, s0: F.hours ? F.hours[0] : 0, s1: F.hours ? F.hours[1] : NS - 1, hours: !!F.hours, dt: dt };
  },
  describe: function (F) {
    F = F || D.filt(); var out = [];
    Object.keys(F.dims).forEach(function (k) { var v = F.dims[k]; if (v && v.length && D.DIM[k]) out.push(D.DIM[k].short + ': ' + (v.length <= 2 ? v.map(function (x) { return D.shortLabel(k, x); }).join(', ') : v.length + ' รายการ')); });
    if (F.ptg.length) out.push('สิทธิ: ' + F.ptg.map(function (g) { return D.label('ptg', g); }).join(', '));
    if (F.hours) out.push('เวลา ' + U.hhmm(F.hours[0]) + '–' + U.hhmm(F.hours[1] + 1) + ' น.');
    if (F.dts.length < 3) out.push(F.dts.map(function (t) { return D.DT[t]; }).join(' + '));
    return out;
  },

  /* ---------- รวมยอด ---------- */
  /**
   * agg(from, to, opt) → ผลรวมตามตัวกรอง
   * opt.slots: รวมรายช่องเวลา · opt.cs: คลินิก×ช่องเวลา · opt.dow: วันในสัปดาห์×ช่องเวลา · opt.F: ตัวกรองอื่น · opt.K: compiled
   * นัด/walk-in เมื่อกรองสิทธิ = ค่าประมาณตามสัดส่วนของคลินิก (approx=true)
   */
  agg: function (from, to, opt) {
    opt = opt || {};
    var K = opt.K || D.compile(opt.F), cm = K.cm, pm = K.pm, nC = D.nC, nP = D.nP;
    var R = { from: from, to: to, v: 0, a: 0, w: 0, approx: !!pm, byC: new Float64Array(nC * 3), byP: new Float64Array(nP), byDay: {}, nd: { W: 0, S: 0, H: 0 }, days: 0, slotsOk: true, lastAt: '' };
    if (opt.slots || K.hours) R.bySlot = new Float64Array(NS * 2);
    if (opt.cs) R.cs = new Float64Array(nC * NS);
    if (opt.dow) { R.dowS = new Float64Array(7 * NS); R.dowW = new Float64Array(7 * NS); R.dowN = new Float64Array(7); }
    var vC = new Float64Array(nC), hs = new Float64Array(nC), ps = new Float64Array(nC), dates = U.dates(from, to);
    for (var di = 0; di < dates.length; di++) {
      var iso = dates[di], x = D.DAYS[iso];
      var dt = D.dayType(iso);
      if (!K.dt[dt]) continue;
      if (opt.dows && !opt.dows[U.dow(iso)]) continue;
      if (!x || !x.cl) { continue; }
      if (x.at && x.at > R.lastAt) R.lastAt = x.at;
      var needSl = K.hours || opt.slots || opt.cs || opt.dow;
      if (needSl && !x.sl) { R.slotsOk = false; if (K.hours) continue; }
      var cl = x.cl, pt = x.pt, sl = x.sl, i, ci, dv = 0, da = 0, dw = 0, wd = U.dow(iso);
      vC.fill(0); hs.fill(0); ps.fill(0);
      for (i = 0; i < cl.length; i += 4) vC[cl[i]] = cl[i + 1];
      // สัดส่วนสิทธิที่เลือกต่อคลินิก
      if (pm) { for (i = 0; i < pt.length; i += 3) if (cm[pt[i]] && pm[pt[i + 1]]) ps[pt[i]] += pt[i + 2]; for (ci = 0; ci < nC; ci++) ps[ci] = vC[ci] ? ps[ci] / vC[ci] : 0; }
      // ช่วงเวลา
      if (sl && (needSl)) {
        for (i = 0; i < sl.length; i += 4) {
          ci = sl[i]; if (!cm[ci]) continue;
          var s = sl[i + 1], v = sl[i + 2], w = sl[i + 3], f = pm ? ps[ci] : 1;
          if (K.hours && (s < K.s0 || s > K.s1)) continue;
          if (K.hours) hs[ci] += v;
          if (R.bySlot) { R.bySlot[s * 2] += v * f; R.bySlot[s * 2 + 1] += w * f; }
          if (R.cs) R.cs[ci * NS + s] += v * f;
          if (R.dowS) { R.dowS[wd * NS + s] += v * f; R.dowW[wd * NS + s] += w * f; }
          if (K.hours) { dv += v * f; dw += w * f; da += (v - w) * f; R.byC[ci * 3] += v * f; R.byC[ci * 3 + 1] += (v - w) * f; R.byC[ci * 3 + 2] += w * f; }
        }
        if (R.dowN) R.dowN[wd]++;
      }
      if (!K.hours) {
        for (i = 0; i < cl.length; i += 4) {
          ci = cl[i]; if (!cm[ci]) continue;
          var f2 = pm ? ps[ci] : 1;
          if (!f2) continue;
          dv += cl[i + 1] * f2; da += cl[i + 2] * f2; dw += cl[i + 3] * f2;
          R.byC[ci * 3] += cl[i + 1] * f2; R.byC[ci * 3 + 1] += cl[i + 2] * f2; R.byC[ci * 3 + 2] += cl[i + 3] * f2;
        }
      }
      // สิทธิ
      for (i = 0; i < pt.length; i += 3) {
        ci = pt[i]; if (!cm[ci] || (pm && !pm[pt[i + 1]])) continue;
        var hf = K.hours ? (vC[ci] ? hs[ci] / vC[ci] : 0) : 1;
        R.byP[pt[i + 1]] += pt[i + 2] * hf;
      }
      R.v += dv; R.a += da; R.w += dw;
      R.byDay[iso] = [dv, da, dw, dt];
      R.nd[dt]++; R.days++;
    }
    return R;
  },
  /** แจกแจงตามมิติ → [{key,label,v,a,w,share}] เรียงมาก→น้อย */
  rollup: function (R, dim) {
    var m = {}, keys = [];
    if (dim === 'ptg' || dim === 'pt') {
      for (var p = 0; p < D.nP; p++) { if (!R.byP[p]) continue; var k = dim === 'ptg' ? D.ptGroupOf(p) : D.P[p].name; if (!m[k]) { m[k] = { key: k, v: 0, a: 0, w: 0 }; keys.push(k); } m[k].v += R.byP[p]; }
    } else {
      for (var ci = 0; ci < D.nC; ci++) {
        var v = R.byC[ci * 3]; if (!v) continue;
        var key = D.val(dim, ci);
        if (!m[key]) { m[key] = { key: key, v: 0, a: 0, w: 0, n: 0 }; keys.push(key); }
        m[key].v += v; m[key].a += R.byC[ci * 3 + 1]; m[key].w += R.byC[ci * 3 + 2]; m[key].n++;
      }
    }
    var tot = keys.reduce(function (s, k) { return s + m[k].v; }, 0) || 1;
    return keys.map(function (k) { var o = m[k]; o.label = D.label(dim, k); o.short = D.shortLabel(dim, k); o.share = o.v / tot; return o; }).sort(function (a, b) { return b.v - a.v; });
  },
  /** ยอดรายวันของคลินิกตามตัวกรอง สำหรับคาดการณ์ (ใช้ part d อย่างเดียว) */
  dailySeries: function (from, to, F) {
    var K = D.compile(F), all = { W: 1, S: 1, H: 1 }; K.dt = all; K.hours = false;
    var R = D.agg(from, to, { K: K });
    return U.dates(from, to).map(function (d) { var x = R.byDay[d]; return { d: d, v: x ? x[0] : null, dt: D.dayType(d) }; });
  },
  /** ช่วงที่มีข้อมูลเริ่มต้น */
  firstDate: function () { return (S.boot.status && S.boot.status.firstDate) || '2023-10-01'; }
};

/* =====================================================================
   ช่วงเวลา: วัน · สัปดาห์ · เดือน · ไตรมาส · ปี (ปีงบประมาณ ต.ค.–ก.ย. หรือ ปีปฏิทิน)
   ===================================================================== */
var PER = {
  KINDS: { day: 'วัน', week: 'สัปดาห์', month: 'เดือน', quarter: 'ไตรมาส', year: 'ปี', custom: 'กำหนดเอง' },
  fiscal: function () { return STORE.get('u:' + S.me.emp + ':fiscal', true); },
  get: function () {
    var p = STORE.get('u:' + S.me.emp + ':per', null);
    if (!p || !p.from) { var t = nowBkk().iso; p = PER.make('month', t); }
    return p;
  },
  set: function (p) { STORE.set('u:' + S.me.emp + ':per', p); },
  make: function (kind, anchor, fiscal) {
    if (fiscal == null) fiscal = PER.fiscal();
    var p = U.p(anchor), y = p[0], m = p[1], from, to, label;
    if (kind === 'day') { from = to = anchor; label = U.thDate(anchor, { dow: true, full: true }); }
    else if (kind === 'week') { var w = (U.dow(anchor) + 6) % 7; from = U.addDays(anchor, -w); to = U.addDays(from, 6); label = 'สัปดาห์ ' + U.thDate(from, { noYear: true }) + ' – ' + U.thDate(to); }
    else if (kind === 'month') { from = anchor.slice(0, 7) + '-01'; to = U.lastDay(anchor.slice(0, 7)); label = U.thMonth(anchor.slice(0, 7), true); }
    else if (kind === 'quarter') {
      if (fiscal) { var q = m >= 10 ? 1 : m <= 3 ? 2 : m <= 6 ? 3 : 4, fy = m >= 10 ? y + 1 : y, sm = [10, 1, 4, 7][q - 1], sy = q === 1 ? fy - 1 : fy; from = sy + '-' + ('0' + sm).slice(-2) + '-01'; to = U.lastDay(U.ymAdd(from.slice(0, 7), 2)); label = 'ไตรมาส ' + q + ' ปีงบประมาณ ' + U.be(fy); }
      else { var cq = Math.ceil(m / 3); from = y + '-' + ('0' + (cq * 3 - 2)).slice(-2) + '-01'; to = U.lastDay(U.ymAdd(from.slice(0, 7), 2)); label = 'ไตรมาส ' + cq + ' ปี ' + U.be(y); }
    }
    else if (kind === 'year') {
      if (fiscal) { var fy2 = m >= 10 ? y + 1 : y; from = (fy2 - 1) + '-10-01'; to = fy2 + '-09-30'; label = 'ปีงบประมาณ ' + U.be(fy2); }
      else { from = y + '-01-01'; to = y + '-12-31'; label = 'ปี ' + U.be(y); }
    }
    return { kind: kind, from: from, to: to, label: label, fiscal: fiscal };
  },
  custom: function (from, to) { return { kind: 'custom', from: from, to: to, label: U.thDate(from) + ' – ' + U.thDate(to) }; },
  shift: function (p, n) {
    if (p.kind === 'custom') { var len = U.diff(p.from, p.to) + 1; return PER.custom(U.addDays(p.from, n * len), U.addDays(p.to, n * len)); }
    var a = p.from;
    if (p.kind === 'day') a = U.addDays(a, n);
    else if (p.kind === 'week') a = U.addDays(a, 7 * n);
    else if (p.kind === 'month') a = U.ymAdd(a.slice(0, 7), n) + '-01';
    else if (p.kind === 'quarter') a = U.ymAdd(a.slice(0, 7), 3 * n) + '-01';
    else if (p.kind === 'year') a = U.ymAdd(a.slice(0, 7), 12 * n) + '-01';
    return PER.make(p.kind, a, p.fiscal);
  },
  /** ช่วงเดียวกันของปีก่อน (สัปดาห์/วัน ถอย 364 วัน ให้ตรงวันในสัปดาห์) */
  lastYear: function (p) {
    if (p.kind === 'day' || p.kind === 'week') return { kind: p.kind, from: U.addDays(p.from, -364), to: U.addDays(p.to, -364) };
    var f = U.p(p.from), t = U.p(p.to);
    var to = (t[0] - 1) + p.to.slice(4); if (p.to.slice(5) === '02-29') to = (t[0] - 1) + '-02-28';
    return { kind: p.kind, from: (f[0] - 1) + p.from.slice(4), to: to };
  },
  /** ตัดช่วงไม่ให้เกินวันนี้/ก่อนวันเริ่มข้อมูล */
  clip: function (p) { var t = nowBkk().iso, f = D.firstDate(); return { from: p.from < f ? f : p.from, to: p.to > t ? t : p.to }; },
  /** เครื่องมือเลือกช่วงเวลา (วางบนแถบบน) */
  control: function (host, onChange, opt) {
    opt = opt || {};
    var p = PER.get();
    var kinds = opt.kinds || ['day', 'week', 'month', 'quarter', 'year', 'custom'];
    var box = U.el('<div class="per">' +
      '<div class="seg" role="tablist">' + kinds.map(function (k) { return '<button role="tab" data-k="' + k + '" class="' + (p.kind === k ? 'on' : '') + '">' + PER.KINDS[k] + '</button>'; }).join('') + '</div>' +
      '<div class="per-nav"><button class="icon-btn" data-n="-1" aria-label="ช่วงก่อนหน้า">' + ICON.chevL + '</button><button class="per-label" id="perLbl"></button><button class="icon-btn" data-n="1" aria-label="ช่วงถัดไป">' + ICON.chevR + '</button></div>' +
      '<label class="fy-tog" title="นับไตรมาส/ปี แบบปีงบประมาณ (ต.ค.–ก.ย.) หรือปีปฏิทิน (ม.ค.–ธ.ค.)"><input type="checkbox" id="fyTog"' + (PER.fiscal() ? ' checked' : '') + '><span>ปีงบประมาณ</span></label></div>');
    host.appendChild(box);
    var paint = function () { U.$('#perLbl', box).textContent = p.label; U.$$('.seg button', box).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-k') === p.kind); }); };
    var fire = function () { PER.set(p); paint(); onChange(p); };
    U.$$('.seg button', box).forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-k');
        if (k === 'custom') return PER.pickCustom(b, p, function (np) { p = np; fire(); });
        var anchor = p.to > nowBkk().iso ? nowBkk().iso : p.to;
        p = PER.make(k, anchor); fire();
      };
    });
    U.$$('[data-n]', box).forEach(function (b) { b.onclick = function () { var np = PER.shift(p, +b.getAttribute('data-n')); if (np.from > nowBkk().iso) return UI.toast('ยังไม่มีข้อมูลของช่วงถัดไป ดูค่าคาดการณ์ได้ที่หน้า "คาดการณ์แนวโน้ม"', 'info'); p = np; fire(); }; });
    U.$('#perLbl', box).onclick = function () { PER.pickCustom(this, p, function (np) { p = np; fire(); }); };
    U.$('#fyTog', box).onchange = function () { STORE.set('u:' + S.me.emp + ':fiscal', this.checked); if (p.kind === 'quarter' || p.kind === 'year') p = PER.make(p.kind, p.from > nowBkk().iso ? nowBkk().iso : p.to < nowBkk().iso ? p.to : nowBkk().iso, this.checked); fire(); };
    paint();
    return { get: function () { return p; } };
  },
  pickCustom: function (anchor, p, cb) {
    var t = nowBkk().iso, f = D.firstDate();
    var pop = UI.pop(anchor, '<form class="pick"><b>เลือกช่วงวันที่</b><label>ตั้งแต่<input type="date" id="pf" min="' + f + '" max="' + t + '" value="' + (p.from < f ? f : p.from) + '"></label><label>ถึง<input type="date" id="pt" min="' + f + '" max="' + t + '" value="' + (p.to > t ? t : p.to) + '"></label>' +
      '<div class="quick">' + [['7 วันล่าสุด', 6], ['30 วันล่าสุด', 29], ['90 วันล่าสุด', 89], ['1 ปีล่าสุด', 364]].map(function (q) { return '<button type="button" data-d="' + q[1] + '">' + q[0] + '</button>'; }).join('') + '</div>' +
      '<button class="btn primary">ใช้ช่วงนี้</button></form>');
    U.$$('[data-d]', pop).forEach(function (b) { b.onclick = function () { U.$('#pf', pop).value = U.addDays(t, -(+b.getAttribute('data-d'))); U.$('#pt', pop).value = t; }; });
    U.$('form', pop).onsubmit = function (e) { e.preventDefault(); var a = U.$('#pf', pop).value, b = U.$('#pt', pop).value; if (!a || !b) return; if (a > b) { var x = a; a = b; b = x; } UI.closePop(); cb(PER.custom(a, b)); };
  }
};
