/* =====================================================================
   p-explore.js — วิเคราะห์ยอดผู้ป่วย (ย้อนหลัง)
   ช่วงเวลา วัน/สัปดาห์/เดือน/ไตรมาส/ปี (ปีงบ/ปีปฏิทิน) · เทียบช่วงก่อนและปีก่อน · แยกหลายระดับ (ตึก › ชั้น › คลินิก ฯลฯ)
   ===================================================================== */
'use strict';
PAGE_FN.explore = function (root) {
  var tools = U.$('#topTools'), dim, split = STORE.get('u:' + S.me.emp + ':exSplit', false);
  FUI.bar(tools, function () { load(); });
  var pc = PER.control(tools, function () { load(); });
  dim = FUI.dimSelect(tools, 'exDim', 'grp', function (d) { dim = d; load(); });
  var tables = {};
  EXP.toolbar(tools, { title: 'วิเคราะห์ยอดผู้ป่วยนอก', xlsx: function () { EXP.xlsx('วิเคราะห์ยอดผู้ป่วย ' + pc.get().label, Object.keys(tables).map(function (k) { return { name: k, cols: tables[k].cols, rows: tables[k].rows }; })); } });
  load();

  function load() {
    var p = pc.get(), r = PER.clip(p), prev = PER.clip(PER.shift(p, -1)), ly = PER.lastYear(p);
    var lyc = { from: ly.from < D.firstDate() ? D.firstDate() : ly.from, to: ly.to };
    if (r.from > r.to) { root.innerHTML = '<div class="empty"><b>ช่วงนี้ยังไม่มีข้อมูล</b><p>ข้อมูลเริ่ม ' + U.thDate(D.firstDate(), { full: true }) + '</p></div>'; return; }
    root.innerHTML = '<div class="loading-block"><div class="ld-rib"></div><p>กำลังโหลดข้อมูล ' + U.esc(p.label) + '…</p></div>';
    var hrs = !!D.filt().hours;
    Promise.all([D.ensure(r.from, r.to, hrs), prev.from <= prev.to ? D.ensure(prev.from, prev.to, hrs) : null, lyc.from <= lyc.to ? D.ensure(lyc.from, lyc.to, hrs) : null]).then(function () { draw(p, r, prev, lyc); })
      .catch(function (e) { root.innerHTML = '<div class="empty"><b>โหลดข้อมูลไม่สำเร็จ</b><p>' + U.esc(e.message) + '</p></div>'; });
  }

  function draw(p, r, prev, ly) {
    CH.disposeAll(); tables = {};
    var R = D.agg(r.from, r.to), P = prev.from <= prev.to ? D.agg(prev.from, prev.to) : null, Y = ly.from <= ly.to ? D.agg(ly.from, ly.to) : null;
    var partial = p.to > r.to;
    // เทียบแบบเท่ากัน: ถ้าช่วงนี้ยังไม่จบ เทียบช่วงก่อน/ปีก่อนเฉพาะจำนวนวันเท่ากัน
    var nDays = U.diff(r.from, r.to) + 1;
    if (partial && P) P = D.agg(prev.from, U.addDays(prev.from, Math.min(nDays, U.diff(prev.from, prev.to) + 1) - 1));
    if (partial && Y) Y = D.agg(ly.from, U.addDays(ly.from, nDays - 1) < ly.to ? U.addDays(ly.from, nDays - 1) : ly.to);
    var wdAvg = function (X) { var s = 0, n = 0; Object.keys(X.byDay).forEach(function (d) { if (X.byDay[d][3] === 'W') { s += X.byDay[d][0]; n++; } }); return n ? s / n : null; };
    var offAvg = function (X) { var s = 0, n = 0; Object.keys(X.byDay).forEach(function (d) { if (X.byDay[d][3] !== 'W') { s += X.byDay[d][0]; n++; } }); return n ? s / n : null; };
    var w0 = wdAvg(R);
    root.innerHTML =
      '<p class="ctx">' + U.esc(p.label) + (partial ? ' · ถึง ' + U.thDate(r.to, { full: true }) + ' (ยังไม่ครบช่วง — เทียบกับจำนวนวันเท่ากัน)' : '') + (R.approx ? ' · <span class="tag">นัด/walk-in เป็นค่าประมาณเมื่อกรองสิทธิ</span>' : '') + '</p>' +
      '<div class="kpis">' +
      kpi({ label: 'ผู้ป่วยนอกรวม', value: R.v, unit: 'ครั้ง', delta: P && P.v ? R.v / P.v - 1 : null, deltaLabel: 'เทียบช่วงก่อน', help: 'visits' }) +
      kpi({ label: 'เฉลี่ยวันทำการ', value: w0 == null ? '–' : Math.round(w0), unit: w0 == null ? '' : 'ราย/วัน', delta: Y && wdAvg(Y) && w0 ? w0 / wdAvg(Y) - 1 : null, deltaLabel: 'เทียบปีก่อน', sub: R.nd.W + ' วันทำการ', help: 'wdavg' }) +
      kpi({ label: 'เฉลี่ยวันหยุด', value: offAvg(R) == null ? '–' : Math.round(offAvg(R)), unit: offAvg(R) == null ? '' : 'ราย/วัน', sub: (R.nd.S + R.nd.H) + ' วัน (เสาร์–อาทิตย์/นักขัตฤกษ์)', help: 'offavg' }) +
      kpi({ label: 'มาตามนัด : walk-in', value: R.v ? U.share(R.a / R.v, 0) + ' : ' + U.share(R.w / R.v, 0) : '–', sub: 'walk-in ' + U.fmt(R.w) + ' ราย', help: 'appoint' }) +
      kpi({ label: 'เทียบช่วงเดียวกันปีก่อน', value: Y && Y.v ? U.pct(R.v / Y.v - 1) : '–', sub: Y && Y.v ? 'ปีก่อน ' + U.fmt(Y.v) + ' ราย' : 'ไม่มีข้อมูลปีก่อน', help: 'yoy' }) +
      '</div>' +
      '<div class="grid g-ex"><div id="e1"></div><div id="e2"></div><div id="e3"></div><div id="e4"></div><div id="e5"></div><div id="e6"></div></div>';

    /* 1) แนวโน้ม */
    var dates = U.dates(r.from, r.to), gran = nDays <= 70 ? 'day' : nDays <= 200 ? 'week' : 'month';
    var buckets = bucket(dates, gran), x = buckets.map(function (b) { return b.label; });
    var sumB = function (X, shift) { return buckets.map(function (b) { var s = 0, any = false; b.days.forEach(function (d) { var k = shift ? shift(d) : d, v = X && X.byDay[k]; if (v) { s += v[0]; any = true; } }); return any ? Math.round(s) : null; }); };
    // รายวัน/รายสัปดาห์: เทียบวันในสัปดาห์เดียวกัน (ถอย 364 วัน) · รายเดือน: เทียบเดือนเดียวกัน
    var lyShift = function (d) { return gran !== 'month' ? U.addDays(d, -364) : (+d.slice(0, 4) - 1) + d.slice(4); };
    var Yfull = Y ? D.agg(ly.from, ly.to) : null;
    var series = [];
    var segBtn = U.el('<div class="seg sm"><button data-s="0" class="' + (!split ? 'on' : '') + '">รวม</button><button data-s="1" class="' + (split ? 'on' : '') + '">แยกตาม' + D.DIM[dim].short + '</button></div>');
    var c1 = CH.card(U.$('#e1', root), { title: 'แนวโน้ม' + { day: 'รายวัน', week: 'รายสัปดาห์', month: 'รายเดือน' }[gran], sub: split ? '6 อันดับแรก + อื่น ๆ' : 'เส้นประ = ช่วงเดียวกันของปีก่อน', help: 'trend', h: 300, cls: 'span3', extra: [segBtn] });
    U.$$('button', segBtn).forEach(function (b) { b.onclick = function () { split = b.getAttribute('data-s') === '1'; STORE.set('u:' + S.me.emp + ':exSplit', split); draw(p, r, prev, ly); }; });
    var tcols = [{ h: 'ช่วง' }], trows = x.map(function (l) { return [l]; });
    if (!split) {
      var cur = sumB(R), lyv = Yfull ? sumB(Yfull, lyShift) : null;
      series.push({ name: 'ช่วงนี้', data: cur, area: true, showSymbol: gran !== 'day', smooth: 0 });
      if (lyv) series.push({ name: 'ปีก่อน (วันในสัปดาห์เดียวกัน)', data: lyv, color: CH.T().muted, dash: true, width: 1.5, smooth: 0 });
      tcols.push({ h: 'ช่วงนี้', num: 1 }); if (lyv) tcols.push({ h: 'ปีก่อน', num: 1 });
      trows.forEach(function (row, i) { row.push(cur[i] == null ? '' : cur[i]); if (lyv) row.push(lyv[i] == null ? '' : lyv[i]); });
    } else {
      var top = D.rollup(R, dim).slice(0, 6), keyset = {}; top.forEach(function (t2, i) { keyset[t2.key] = i; });
      var perDay = splitByDay(dates, dim, keyset, top.length);
      top.concat([{ key: '_o', short: 'อื่น ๆ' }]).forEach(function (t2, i) {
        var data = buckets.map(function (b) { var s = 0, any = false; b.days.forEach(function (d) { var v = perDay[d]; if (v) { s += v[i]; any = true; } }); return any ? Math.round(s) : null; });
        series.push({ name: t2.short, data: data, color: i === top.length ? CH.T().other : CH.T().cat[i], width: 1.8, smooth: 0 });
        tcols.push({ h: t2.short, num: 1 }); trows.forEach(function (row, j) { row.push(data[j] == null ? '' : data[j]); });
      });
    }
    c1.set(CH.line(c1.chartEl, { x: x, series: series, zoom: buckets.length > 120 }));
    c1.setTable(tcols, trows); tables['แนวโน้ม'] = { cols: tcols, rows: trows };

    /* 2) อันดับตามมิติ */
    var rows = D.rollup(R, dim), pmap = {}; if (P) D.rollup(P, dim).forEach(function (o) { pmap[o.key] = o.v; });
    var topN = rows.slice(0, 20);
    var c2 = CH.card(U.$('#e2', root), { title: 'ยอดตาม' + D.DIM[dim].short, sub: rows.length > 20 ? '20 อันดับแรกจาก ' + rows.length + ' · ตารางมีครบ' : rows.length + ' รายการ', help: 'rank', h: Math.max(240, topN.length * 26 + 16), cls: 'span2' });
    c2.set(CH.barsH(c2.chartEl, topN.map(function (o) { return { label: o.short, title: o.label, v: o.v, key: o.key, share: o.share }; }), { labelW: 220, lbl: function (o) { return U.fmt(o.v) + ' · ' + U.share(o.share); }, onClick: function (o) { DRILL.dim(dim, o.key); } }));
    var rc = [{ h: D.DIM[dim].short }, { h: 'ราย', num: 1 }, { h: '% ของทั้งหมด', num: 1, d: 1 }, { h: 'เฉลี่ย/วันทำการ', num: 1, d: 1 }, { h: '% มาตามนัด', num: 1, d: 0 }, { h: 'เทียบช่วงก่อน %', num: 1, d: 1 }];
    var rr = rows.map(function (o) { return [o.label, Math.round(o.v), o.share * 100, R.nd.W ? o.v / Math.max(1, R.nd.W) : 0, o.v ? o.a / o.v * 100 : 0, pmap[o.key] ? (o.v / pmap[o.key] - 1) * 100 : '']; });
    c2.setTable(rc, rr); tables[D.DIM[dim].short] = { cols: rc, rows: rr };

    /* 3) สิทธิ */
    var pg = D.rollup(R, 'ptg'), pgc = {}; D.PG.forEach(function (g, i) { pgc[g.id] = CH.T().cat[i % 8]; });
    var c3 = CH.card(U.$('#e3', root), { title: 'สิทธิการรักษา', help: 'ptg', h: 260 });
    c3.set(CH.donut(c3.chartEl, pg.map(function (o) { return { label: o.label, v: o.v, color: pgc[o.key] }; })));
    var ptr = D.rollup(R, 'pt'), pc2 = [{ h: 'สิทธิการรักษา' }, { h: 'กลุ่ม' }, { h: 'ราย', num: 1 }, { h: '%', num: 1, d: 1 }];
    var ptRows = ptr.map(function (o) { var pi = D.P.filter(function (x2) { return x2 && x2.name === o.key; })[0]; return [o.key, pi ? D.label('ptg', pi.grp) : '', Math.round(o.v), o.share * 100]; });
    c3.setTable(pc2, ptRows); tables['สิทธิการรักษา'] = { cols: pc2, rows: ptRows };

    /* 4) หลายระดับ */
    var paths = treePaths(), pathSel = STORE.get('u:' + S.me.emp + ':exPath', 0); if (!paths[pathSel]) pathSel = 0;
    var sel = U.el('<select class="sm-sel" aria-label="ลำดับชั้น">' + paths.map(function (pp, i) { return '<option value="' + i + '"' + (i === pathSel ? ' selected' : '') + '>' + pp.map(function (d) { return D.DIM[d].short; }).join(' › ') + '</option>'; }).join('') + '</select>');
    var c4 = U.el('<section class="card span3"><header class="ch"><div><h2>ภาพรวม → รายย่อย' + UI.info('tree') + '</h2><p class="sub">กดแถวเพื่อเปิดระดับถัดไป · เทียบช่วงก่อนแบบจำนวนวันเท่ากัน</p></div><div class="ctools"></div></header><div class="cbody"><div class="tree" id="tree"></div></div></section>');
    U.$('.ctools', c4).appendChild(sel);
    U.$('#e4', root).appendChild(c4);
    sel.onchange = function () { STORE.set('u:' + S.me.emp + ':exPath', +sel.value); paintTree(paths[+sel.value]); };
    function paintTree(path) {
      var leaf = {}; // key path → {v,a,w,p}
      for (var ci = 0; ci < D.nC; ci++) {
        var v = R.byC[ci * 3], pv = P ? P.byC[ci * 3] : 0; if (!v && !pv) continue;
        var keys = path.map(function (d) { return D.val(d, ci); }), acc = '';
        keys.forEach(function (k, li) { acc += (li ? '\u0001' : '') + k; var o = leaf[acc] || (leaf[acc] = { lv: li, key: k, path: acc, v: 0, a: 0, p: 0, dim: path[li] }); o.v += v; o.a += R.byC[ci * 3 + 1]; o.p += pv; });
      }
      var all = Object.keys(leaf).map(function (k) { return leaf[k]; }), tot = R.v || 1;
      var kids = function (prefix, lv) { return all.filter(function (o) { return o.lv === lv && (lv === 0 || o.path.indexOf(prefix + '\u0001') === 0); }).sort(function (a, b) { return b.v - a.v; }); };
      var row = function (o) {
        var ch = o.lv < path.length - 1, d = o.p ? o.v / o.p - 1 : null;
        return '<div class="tr lv' + o.lv + '" data-p="' + U.esc(o.path) + '" data-lv="' + o.lv + '">' +
          '<span class="tn">' + (ch ? '<button class="tg" aria-expanded="false">' + ICON.chevR + '</button>' : '<i class="tg-sp"></i>') + U.esc(D.shortLabel(o.dim, o.key)) + '</span>' +
          '<span class="tbar"><i style="width:' + (o.v / tot * 100).toFixed(2) + '%"></i></span>' +
          '<span class="num">' + U.fmt(o.v) + '</span><span class="num muted">' + U.share(o.v / tot) + '</span><span class="num muted">' + (R.nd.W ? U.fmt(o.v / R.nd.W, 1) : '–') + '</span>' +
          '<span class="num ' + (d == null ? 'muted' : '') + '">' + (d == null ? '–' : U.pct(d)) + '</span></div>';
      };
      var box = U.$('#tree', c4);
      box.innerHTML = '<div class="tr th"><span>' + path.map(function (d) { return D.DIM[d].short; }).join(' › ') + '</span><span></span><span class="num">ราย</span><span class="num">%</span><span class="num">/วันทำการ</span><span class="num">เทียบช่วงก่อน</span></div>' + kids('', 0).map(row).join('');
      box.onclick = function (e) {
        var tr = e.target.closest('.tr'); if (!tr || tr.classList.contains('th')) return;
        var lv = +tr.getAttribute('data-lv'), pth = tr.getAttribute('data-p'), btn = tr.querySelector('.tg');
        if (!btn) { var o = leaf[pth]; if (o) DRILL.dim(o.dim, o.key); return; }
        var open = btn.getAttribute('aria-expanded') === 'true';
        if (open) { btn.setAttribute('aria-expanded', 'false'); var nx = tr.nextElementSibling; while (nx && +nx.getAttribute('data-lv') > lv) { var n2 = nx.nextElementSibling; nx.remove(); nx = n2; } }
        else { btn.setAttribute('aria-expanded', 'true'); tr.insertAdjacentHTML('afterend', kids(pth, lv + 1).map(row).join('')); }
      };
      tables['หลายระดับ'] = { cols: path.map(function (d) { return { h: D.DIM[d].short }; }).concat([{ h: 'ราย', num: 1 }, { h: 'ช่วงก่อน', num: 1 }]), rows: all.filter(function (o) { return o.lv === path.length - 1; }).map(function (o) { var ks = o.path.split('\u0001'); return ks.map(function (k, i) { return D.label(path[i], k); }).concat([Math.round(o.v), Math.round(o.p)]); }) };
    }
    paintTree(paths[pathSel]);

    /* 5) วันในสัปดาห์ */
    var dowS = [0, 0, 0, 0, 0, 0, 0], dowN = [0, 0, 0, 0, 0, 0, 0];
    Object.keys(R.byDay).forEach(function (d) { if (R.byDay[d][3] === 'H') return; var w = U.dow(d); dowS[w] += R.byDay[d][0]; dowN[w]++; });
    var order = [1, 2, 3, 4, 5, 6, 0], dv = order.map(function (w) { return dowN[w] ? Math.round(dowS[w] / dowN[w]) : null; });
    var c5 = CH.card(U.$('#e5', root), { title: 'เฉลี่ยตามวันในสัปดาห์', sub: 'ไม่รวมวันหยุดนักขัตฤกษ์', help: 'dow', h: 240 });
    c5.set(CH.line(c5.chartEl, { x: order.map(function (w) { return U.DOWF[w]; }), bars: true, series: [{ name: 'เฉลี่ย/วัน', data: dv, bar: true }] }));
    c5.setTable([{ h: 'วัน' }, { h: 'เฉลี่ย/วัน', num: 1 }, { h: 'จำนวนวัน', num: 1 }], order.map(function (w, i) { return [U.DOWF[w], dv[i] == null ? '' : dv[i], dowN[w]]; }));

    /* 6) ประเภทคลินิก */
    var ty = D.rollup(R, 'type');
    var c6 = CH.card(U.$('#e6', root), { title: 'ในเวลา / นอกเวลาราชการ', help: 'type', h: 240 });
    c6.set(CH.donut(c6.chartEl, ty.map(function (o) { return { label: o.label, v: o.v }; })));
    c6.setTable([{ h: 'ประเภทคลินิก' }, { h: 'ราย', num: 1 }, { h: '%', num: 1, d: 1 }], ty.map(function (o) { return [o.label, Math.round(o.v), o.share * 100]; }));
    countUp(root);
  }
  function treePaths() {
    var p = [['bld', 'floor', 'clinic'], ['type', 'grp', 'clinic'], ['grp', 'clinic'], ['bld', 'grp', 'clinic']];
    D.G.forEach(function (g) { p.push(['g:' + g.id, 'grp', 'clinic']); });
    return p;
  }
  /** แยกยอดรายวันตาม top keys → {iso: Float64Array(k+1)} (ตัวสุดท้าย = อื่น ๆ) */
  function splitByDay(dates, dim, keyset, k) {
    var K = D.compile(), out = {}, keyOf = new Int16Array(D.nC).fill(-1);
    for (var ci = 0; ci < D.nC; ci++) if (D.C[ci]) { var ix = keyset[D.val(dim, ci)]; keyOf[ci] = ix == null ? k : ix; }
    dates.forEach(function (d) {
      var R1 = D.agg(d, d, { K: K }); if (!R1.days) return;
      var a = new Float64Array(k + 1);
      for (var c = 0; c < D.nC; c++) if (R1.byC[c * 3]) a[keyOf[c] < 0 ? k : keyOf[c]] += R1.byC[c * 3];
      out[d] = a;
    });
    return out;
  }
  function bucket(dates, gran) {
    var out = [], cur = null;
    dates.forEach(function (d) {
      var key = gran === 'day' ? d : gran === 'week' ? U.addDays(d, -((U.dow(d) + 6) % 7)) : d.slice(0, 7);
      if (!cur || cur.key !== key) { cur = { key: key, days: [], label: gran === 'day' ? U.thDate(d, { noYear: true }) : gran === 'week' ? U.thDate(key, { noYear: false }) : U.thMonth(key) }; out.push(cur); }
      cur.days.push(d);
    });
    return out;
  }
};
