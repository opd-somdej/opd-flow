/* =====================================================================
   forecast.js — คาดการณ์ยอดผู้ป่วยจากสถิติย้อนหลัง
   แบบจำลอง: log(ยอด+1) = ระดับ + แนวโน้ม(ปี) + วันในสัปดาห์ + เดือนของปี + วันหยุดนักขัตฤกษ์ + วันแรกหลังหยุดยาว
   - ถ่วงน้ำหนักข้อมูลใหม่มากกว่าเก่า (ครึ่งชีวิต ~1 ปี) · ridge กันค่าแกว่ง
   - ช่วงความเชื่อมั่น 80%/95% จากความคลาดเคลื่อนจริงในอดีต แยกตามประเภทวัน
   - วัดความแม่นยำแบบย้อนหลัง (backtest): ซ่อน 8 สัปดาห์ล่าสุด → ทำนาย → เทียบของจริง
   รายเดือน/รายปี = ผลรวมค่าคาดการณ์รายวัน (ใช้ปฏิทินวันหยุดของปีนั้น) จึงสะท้อนจำนวนวันทำการจริง
   ===================================================================== */
'use strict';
var FC = (function () {
  var NF = 21;
  function feats(d, t0, hol, dayType) {
    var f = new Float64Array(NF), p = U.p(d), w = U.dow(d), dt = dayType(d);
    f[0] = 1;
    f[1] = U.diff(t0, d) / 365.25;
    if (w >= 1) f[1 + w] = 1;                 // 2..7 = จ.–ส. (อา. เป็นฐาน)
    f[8] = dt === 'H' ? 1 : 0;
    if (p[1] >= 2) f[7 + p[1]] = 1;            // 9..19 = ก.พ.–ธ.ค.
    if (dt === 'W') { var g = 0; for (var k = 1; k <= 5; k++) { if (dayType(U.addDays(d, -k)) !== 'W') g++; else break; } f[20] = g >= 3 ? 1 : 0; }
    return f;
  }
  function solve(A, b) {   // Gauss–Jordan (ขนาดเล็ก)
    var n = b.length, M = A.map(function (r, i) { return Array.prototype.slice.call(r).concat([b[i]]); });
    for (var c = 0; c < n; c++) {
      var piv = c; for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      var tmp = M[c]; M[c] = M[piv]; M[piv] = tmp;
      var v = M[c][c]; if (Math.abs(v) < 1e-12) continue;
      for (var j = c; j <= n; j++) M[c][j] /= v;
      for (r = 0; r < n; r++) if (r !== c && M[r][c]) { var f = M[r][c]; for (j = c; j <= n; j++) M[r][j] -= f * M[c][j]; }
    }
    return M.map(function (r) { return r[n]; });
  }
  /**
   * fit(series) — series = [{d, v, dt}] (v = null คือไม่มีข้อมูล)
   * → model {beta, sd:{W,S,H}, t0, n, ok}
   */
  function fit(series, opt) {
    opt = opt || {};
    var pts = series.filter(function (x) { return x.v != null; });
    if (pts.length < 56) return { ok: false, n: pts.length };
    var t0 = pts[0].d, last = pts[pts.length - 1].d, hl = opt.halfLife || 380, lam = opt.ridge || 0.6;
    var XtX = []; for (var i = 0; i < NF; i++) XtX.push(new Float64Array(NF));
    var Xty = new Float64Array(NF), rows = [];
    pts.forEach(function (x) {
      var f = feats(x.d, t0, D.hol, D.dayType), y = Math.log(x.v + 1), w = Math.pow(0.5, U.diff(x.d, last) / hl);
      rows.push({ f: f, y: y, dt: x.dt, w: w });
      for (var a = 0; a < NF; a++) { if (!f[a]) continue; Xty[a] += w * f[a] * y; for (var b = 0; b < NF; b++) if (f[b]) XtX[a][b] += w * f[a] * f[b]; }
    });
    for (i = 2; i < NF; i++) XtX[i][i] += lam;    // ridge (ไม่ลงโทษระดับ/แนวโน้ม)
    var beta = solve(XtX, Xty);
    var ss = { W: [0, 0], S: [0, 0], H: [0, 0] };
    rows.forEach(function (r) { var e = r.y - dot(beta, r.f); ss[r.dt][0] += r.w * e * e; ss[r.dt][1] += r.w; });
    var sd = {}; Object.keys(ss).forEach(function (k) { sd[k] = ss[k][1] > 3 ? Math.sqrt(ss[k][0] / ss[k][1]) : 0.25; });
    return { ok: true, beta: beta, sd: sd, t0: t0, n: pts.length, last: last };
  }
  function dot(b, f) { var s = 0; for (var i = 0; i < NF; i++) if (f[i]) s += b[i] * f[i]; return s; }
  /** ทำนายรายวัน → [{d, yhat, lo80, hi80, lo95, hi95, dt}] */
  function predict(m, dates) {
    return dates.map(function (d) {
      var f = feats(d, m.t0, D.hol, D.dayType), mu = dot(m.beta, f), dt = D.dayType(d), s = m.sd[dt] || 0.2;
      var g = function (z) { return Math.max(0, Math.exp(mu + z * s) - 1); };
      return { d: d, dt: dt, yhat: g(0), lo80: g(-1.2816), hi80: g(1.2816), lo95: g(-1.96), hi95: g(1.96), sd: s };
    });
  }
  /** ความแม่นยำย้อนหลัง: ซ่อน hold วันล่าสุด */
  function backtest(series, hold) {
    hold = hold || 56;
    var have = series.filter(function (x) { return x.v != null; });
    if (have.length < hold + 120) return null;
    var cut = have[have.length - hold - 1].d;
    var m = fit(series.filter(function (x) { return x.d <= cut; }));
    if (!m.ok) return null;
    var test = have.filter(function (x) { return x.d > cut; }), pr = predict(m, test.map(function (x) { return x.d; }));
    var ae = 0, sa = 0, aeW = 0, saW = 0, inside = 0, pairs = [];
    test.forEach(function (x, i) {
      var e = Math.abs(pr[i].yhat - x.v); ae += e; sa += x.v;
      if (x.dt === 'W') { aeW += e; saW += x.v; }
      if (x.v >= pr[i].lo80 && x.v <= pr[i].hi80) inside++;
      pairs.push({ d: x.d, v: x.v, yhat: pr[i].yhat, dt: x.dt });
    });
    return { wape: sa ? ae / sa : null, wapeW: saW ? aeW / saW : null, cover80: inside / test.length, n: test.length, from: test[0].d, to: test[test.length - 1].d, pairs: pairs };
  }
  /** รวมเป็นช่วง (เดือน/ปี) จากค่าจริง + ค่าคาดการณ์ → {act, fc, yhat, lo, hi} */
  function rollupRange(actualByDay, preds, from, to) {
    var act = 0, fc = 0, s1 = 0, s2 = 0, nA = 0, nF = 0;
    var pm = {}; preds.forEach(function (p) { pm[p.d] = p; });
    U.dates(from, to).forEach(function (d) {
      if (actualByDay[d] != null) { act += actualByDay[d]; nA++; return; }
      var p = pm[d]; if (!p) return;
      fc += p.yhat; nF++;
      var sig = p.yhat * (Math.exp(p.sd) - 1);
      s1 += sig * sig; s2 += sig;
    });
    var sd = Math.sqrt(s1 + 0.25 * s2 * s2);   // ความคลาดเคลื่อนของวันใกล้กันมักไปทางเดียวกัน
    return { act: act, fc: fc, yhat: act + fc, lo: act + Math.max(0, fc - 1.2816 * sd), hi: act + fc + 1.2816 * sd, nA: nA, nF: nF };
  }
  /**
   * ปรับยอดวันนี้แบบเรียลไทม์ (nowcast): ยอดถึงตอนนี้ ÷ สัดส่วนสะสมตามปกติ ณ เวลานี้
   * ช่วงเช้ามืดสัดส่วนยังน้อย → ผสมกับค่าคาดการณ์รายวันมากกว่า
   */
  function nowcast(sofar, cumShare, dayPred) {
    if (!dayPred) return cumShare > 0.05 ? sofar / cumShare : null;
    if (cumShare <= 0.02) return dayPred;
    var nc = sofar / cumShare, w = Math.min(1, cumShare / 0.35);
    return Math.max(sofar, w * nc + (1 - w) * dayPred);
  }
  return { fit: fit, predict: predict, backtest: backtest, rollupRange: rollupRange, nowcast: nowcast };
})();
