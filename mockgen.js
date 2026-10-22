/* =====================================================================
   mockgen.js — ตัวสร้าง "ข้อมูลจำลอง" ยอดผู้ป่วยนอกทั้ง รพ. (ใช้ร่วมกันทั้งหน้าเว็บโหมดสาธิต และ Apps Script โหมดจำลอง)
   - สุ่มแบบกำหนดผลได้ (seed จากวันที่+คลินิก) → วันเดิมได้ตัวเลขเดิมทุกครั้ง ทุกเครื่อง
   - ระดับยอด: วันทำการ ≈ 5,500–7,000 ราย · เสาร์ ≈ 1,000 · อาทิตย์/นักขัตฤกษ์ ≈ 500–700
   - มีแนวโน้มเติบโต ~4%/ปี · ฤดูกาล (ฝนสูง เม.ย./ธ.ค. ต่ำ) · วันจันทร์/หลังหยุดยาวสูง
   - ⚠ ตัวเลขทั้งหมดสมมติ ใช้ทดสอบ/สาธิตเท่านั้น
   ===================================================================== */
var MG = (function () {
  'use strict';
  var SLOT_MIN = 15, NSLOT = 96;

  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function poisson(r, l) {
    if (l <= 0) return 0;
    if (l > 30) return Math.max(0, Math.round(l + Math.sqrt(l) * gauss(r)));
    var L = Math.exp(-l), k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1;
  }
  function binom(r, n, p) {
    if (n <= 0 || p <= 0) return 0; if (p >= 1) return n;
    if (n > 40) { var m = n * p, sd = Math.sqrt(n * p * (1 - p)); return Math.min(n, Math.max(0, Math.round(m + sd * gauss(r)))); }
    var k = 0; for (var i = 0; i < n; i++) if (r() < p) k++; return k;
  }
  /** แจก n รายตามสัดส่วน ps (multinomial แบบ binomial ต่อเนื่อง) */
  function multi(r, n, ps) {
    var out = new Array(ps.length), left = n, rest = 0, i;
    for (i = 0; i < ps.length; i++) rest += ps[i];
    for (i = 0; i < ps.length; i++) {
      if (left <= 0 || rest <= 0) { out[i] = 0; continue; }
      var k = i === ps.length - 1 ? left : binom(r, left, ps[i] / rest);
      out[i] = k; left -= k; rest -= ps[i];
    }
    return out;
  }
  function parts(iso) { return iso.split('-').map(Number); }
  function dow(iso) { var p = parts(iso); return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); }
  function addDays(iso, n) { var p = parts(iso), d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)); return d.toISOString().slice(0, 10); }

  /* ---------- โปรไฟล์เวลามาถึง (ต่อช่อง 15 นาที) ---------- */
  function prof(comps, from, to) {
    var a = [], s = 0, i;
    for (i = 0; i < NSLOT; i++) {
      var h = (i + 0.5) * SLOT_MIN / 60, v = 0;
      if (h >= from && h <= to) comps.forEach(function (c) { v += c[2] * Math.exp(-0.5 * Math.pow((h - c[0]) / c[1], 2)); });
      a.push(v); s += v;
    }
    return a.map(function (x) { return x / (s || 1); });
  }
  var P = {
    inA: prof([[7.4, 0.9, 0.75], [10.2, 1.0, 0.18], [13.4, 0.8, 0.07]], 5.5, 15.5),
    inW: prof([[8.3, 1.3, 0.6], [11, 1.2, 0.25], [13.8, 0.9, 0.15]], 5.5, 15.5),
    outA: prof([[16.6, 0.5, 0.6], [17.9, 0.7, 0.4]], 15.5, 20.25),
    outW: prof([[16.9, 0.7, 0.5], [18.6, 0.8, 0.5]], 15.5, 20.75),
    weA: prof([[8.4, 1.0, 0.65], [12.8, 1.3, 0.35]], 7, 16),
    weW: prof([[9.2, 1.4, 0.55], [13.5, 1.5, 0.45]], 7, 16.5),
    nightW: prof([[20.5, 1.0, 0.45], [23.0, 1.6, 0.35], [2.5, 1.5, 0.2]], 0, 24)
  };

  /* ---------- น้ำหนักคลินิก (ยอดเฉลี่ยวันทำการโดยประมาณ) ---------- */
  var GRP_W = [
    [/เวชปฏิบัติทั่วไป|ผู้ป่วยนอกและอุบัติเหตุ/, 70], [/อายุรกรรม|เบาหวาน|ไธรอยด์|หัวใจ|โรคไต|ทางเดินหายใจ|ทางเดินอาหาร|หอบหืด/, 38],
    [/กระดูก/, 40], [/จักษุ/, 36], [/กุมาร|เด็กดี|พัฒนาการ/, 18], [/นรีเวช|สูติ|ฝากครรภ์|วางแผนครอบครัว|วัยทอง/, 30],
    [/ศัลยกรรม/, 28], [/โสต/, 32], [/ผิวหนัง/, 26], [/จิตเวช|ชลธี/, 20], [/ศูนย์ฯ สาขา/, 34], [/ผู้สูงอายุ/, 12],
    [/ทันตกรรม/, 45], [/รังสี|ชันสูตร/, 30], [/เวชกรรมฟื้นฟู/, 22], [/Appointment|ซื้อยา/, 25], [/ทำแผล|หัตถการ/, 24],
    [/เฉพาะทางนอกเวลา/, 14], [/Night OPD/, 70], [/ตรวจสุขภาพ|อาชีว/, 20]
  ];
  var _prof = null, _ptw = null;
  function profiles(clinics) {
    if (_prof && _prof.n === clinics.length) return _prof.list;
    var list = clinics.map(function (c, i) {
      var code = c[0], type = c[2], grp = c[5], show = c[6], r = rng(hash('cl|' + code));
      var kind = /ทั้งใน/.test(type) ? 'both' : /นอกเวลา/.test(type) ? 'out' : 'in';
      if (code === 'NOPD') kind = 'night';
      var w = 10; for (var k = 0; k < GRP_W.length; k++) if (GRP_W[k][0].test(grp + ' ' + c[1])) { w = GRP_W[k][1]; break; }
      w *= Math.exp(0.55 * gauss(r));
      if (!show) w = r() < 0.3 ? 0.4 + 2 * r() : 0;
      if (kind === 'out') w *= 0.75;
      var ap = kind === 'in' ? 0.58 + 0.12 * gauss(r) : kind === 'night' ? 0.05 : 0.42 + 0.1 * gauss(r);
      var kids = /กุมาร|เด็ก/.test(grp + c[1]), elder = /ผู้สูงอายุ/.test(grp);
      return { i: i, code: code, kind: kind, w: Math.max(0, w), ap: Math.min(0.85, Math.max(0.05, ap)), kids: kids, elder: elder, branch: /สาขา/.test(c[3] + grp), seed: hash('pt|' + code) };
    });
    // ปรับสเกลให้วันทำการรวม ~6,000 (ในเวลา 4,850 · นอกเวลา 640 · Night OPD ~60)
    var sIn = 0, sOut = 0;
    list.forEach(function (p) { if (p.kind === 'in') sIn += p.w; else if (p.kind === 'out' || p.kind === 'both') sOut += p.w; });
    list.forEach(function (p) { if (p.kind === 'in') p.w *= 4850 / sIn; else if (p.kind === 'out' || p.kind === 'both') p.w *= 640 / sOut; else p.w = 62; });
    _prof = { n: clinics.length, list: list };
    return list;
  }
  /* สัดส่วนสิทธิ (ตาม SEED_PTTYPES) */
  var PT_IN = [30, 25, 16, 11, 4, 1.6, 2, 2.2, 1.2, 1.4, 0.8, 0.8, 1.6, 1.0];
  var PT_OUT = [26, 6, 18, 30, 3, 7, 3, 2, 1, 2.2, 0.6, 0.5, 0.4, 0.3];
  function ptShares(p) {
    _ptw = _ptw || {};
    if (_ptw[p.i]) return _ptw[p.i];
    var r = rng(p.seed), base = (p.kind === 'out' ? PT_OUT : PT_IN).slice();
    if (p.kids) { base[0] *= 0.15; base[1] *= 1.6; }
    if (p.elder) { base[0] *= 0.3; base[2] *= 2.2; }
    if (p.branch) { base[0] *= 1.5; }
    return (_ptw[p.i] = base.map(function (x) { return x * Math.exp(0.35 * gauss(r)); }));
  }

  var MONTH_F = [1.03, 1.02, 1.0, 0.89, 0.97, 1.04, 1.07, 1.08, 1.05, 1.0, 1.02, 0.94];   // ม.ค.–ธ.ค.
  var DOW_F = [0, 1.13, 1.04, 1.0, 0.97, 0.9, 0];

  /** ประเภทวัน W/S/H (H = นักขัตฤกษ์ที่ตรงวันธรรมดา) */
  function dayType(iso, hol) { var w = dow(iso); if (w === 0 || w === 6) return 'S'; return hol && hol[iso] ? 'H' : 'W'; }

  /**
   * สร้างข้อมูล 1 วัน → { cl:[ci,v,a,w,…], pt:[ci,pi,v,…], sl:[ci,slot,v,w,…], n }
   * clinics = SEED_CLINICS (หรือรูปเดียวกัน) · hol = {iso:1} · upto = ช่อง 15 นาทีสุดท้ายที่นับ (ไม่ใส่ = ทั้งวัน)
   */
  function day(iso, clinics, hol, upto) {
    var list = profiles(clinics), w = dow(iso), dt = dayType(iso, hol), p = parts(iso);
    var yrs = (Date.UTC(p[0], p[1] - 1, p[2]) - Date.UTC(2023, 9, 1)) / (365.25 * 864e5);
    var trend = Math.pow(1.04, yrs), mf = MONTH_F[p[1] - 1];
    var rd = rng(hash('d|' + iso)), dayNoise = Math.exp(0.045 * gauss(rd));
    // วันแรกหลังหยุดยาว (≥3 วัน) คนมากขึ้น
    var gap = 0; for (var k = 1; k <= 5; k++) { if (dayType(addDays(iso, -k), hol) !== 'W') gap++; else break; }
    var post = dt === 'W' && gap >= 3 ? 1.14 : 1;
    var cl = [], pt = [], sl = [], N = 0;
    for (var i = 0; i < list.length; i++) {
      var pr = list[i]; if (!pr.w) continue;
      var f;
      if (pr.kind === 'in') f = dt === 'W' ? DOW_F[w] * post : 0;
      else if (pr.kind === 'night') f = dt === 'W' ? 1 : 1.25;
      else f = dt === 'W' ? (w === 5 ? 0.85 : 1) : (w === 6 ? 1.35 : 0.8);
      if (pr.kids && (p[1] >= 6 && p[1] <= 9)) f *= 1.12;
      if (!f) continue;
      var r = rng(hash(iso + '|' + pr.code));
      var n = poisson(r, pr.w * f * trend * mf * dayNoise * Math.exp(0.1 * gauss(r)));
      if (!n) continue;
      var a = binom(r, n, pr.ap), wk = n - a;
      var pa, pw;
      if (pr.kind === 'night') { pa = P.nightW; pw = P.nightW; }
      else if (pr.kind === 'in') { pa = P.inA; pw = P.inW; }
      else if (dt === 'W') { pa = P.outA; pw = P.outW; }
      else { pa = P.weA; pw = P.weW; }
      var sa = multi(r, a, pa), sw = multi(r, wk, pw);
      var cv = 0, ca = 0, cw = 0;
      for (var s = 0; s < NSLOT; s++) {
        if (upto != null && s > upto) break;
        var v = sa[s] + sw[s];
        if (v) { sl.push(i, s, v, sw[s]); cv += v; ca += sa[s]; cw += sw[s]; }
      }
      if (!cv) continue;
      cl.push(i, cv, ca, cw); N += cv;
      var ps = multi(rng(hash('p|' + iso + pr.code)), cv, ptShares(pr));
      for (var j = 0; j < ps.length; j++) if (ps[j]) pt.push(i, j, ps[j]);
    }
    return { d: iso, dt: dt, n: N, cl: cl, pt: pt, sl: sl };
  }

  /**
   * จำลอง "คำตอบ API ของไอที" ตามรูปที่คุยไว้ (22 ต.ค. 69):
   *   yyyymmdd · hhmm · pttype · clinic · total_visit · total_appoint · total_walkin
   * 1 แถว = คลินิก × ช่วงเวลา × สิทธิ (ยอดรวม ไม่มีรายคน)
   */
  function apiRows(iso, clinics, ptNames, hol, uptoHHMM) {
    var upto = uptoHHMM == null ? null : Math.floor((Math.floor(uptoHHMM / 100) * 60 + uptoHHMM % 100) / SLOT_MIN);
    var dd = day(iso, clinics, hol, upto), list = profiles(clinics), rows = [], ymd = iso.replace(/-/g, '');
    var r = rng(hash('rows|' + iso));
    for (var k = 0; k < dd.sl.length; k += 4) {
      var ci = dd.sl[k], s = dd.sl[k + 1], v = dd.sl[k + 2], wk = dd.sl[k + 3];
      var ps = multi(r, v, ptShares(list[ci])), wks = multi(r, wk, ps.map(function (x) { return x; }));
      for (var j = 0; j < ps.length; j++) {
        if (!ps[j]) continue;
        var wj = Math.min(ps[j], wks[j]);
        var mm = s * SLOT_MIN + Math.floor(r() * SLOT_MIN), hhmm = ('0' + Math.floor(mm / 60)).slice(-2) + ('0' + mm % 60).slice(-2);
        rows.push({ yyyymmdd: ymd, hhmm: hhmm, pttype: ptNames[j], clinic: clinics[ci][0] + ':' + clinics[ci][1], total_visit: ps[j], total_appoint: ps[j] - wj, total_walkin: wj });
      }
    }
    return rows;
  }

  return { day: day, apiRows: apiRows, dayType: dayType, SLOT_MIN: SLOT_MIN, NSLOT: NSLOT, addDays: addDays, dow: dow, hash: hash, rng: rng };
})();
if (typeof module !== 'undefined') module.exports = MG;
