/* =====================================================================
   charts.js — กราฟ (Apache ECharts) + กล่องกราฟมาตรฐาน (ⓘ คำอธิบาย · สลับเป็นตาราง · บันทึกภาพ · Excel)
   สี: ชุดหมวดหมู่ 8 สีตามลำดับคงที่ (ผ่านการตรวจตาบอดสี) · ความหนาแน่นใช้สีฟ้าโทนเดียว อ่อน→เข้ม
   ===================================================================== */
'use strict';
var CH = (function () {
  var live = [];
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function T() {
    return {
      ink: css('--ink'), ink2: css('--ink-2'), muted: css('--muted'), grid: css('--grid'), axis: css('--axis'), surface: css('--surface'),
      cat: [1, 2, 3, 4, 5, 6, 7, 8].map(function (i) { return css('--c' + i); }), seq: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (i) { return css('--s' + i); }),
      ok: css('--good'), warn: css('--warning'), serious: css('--serious'), crit: css('--critical'), other: css('--other'), brand: css('--brand'),
      font: css('--font') || 'IBM Plex Sans Thai, sans-serif', fontD: css('--font-d') || 'Anuphan, sans-serif'
    };
  }
  function tip(t) {
    return { backgroundColor: t.surface, borderColor: t.grid, borderWidth: 1, padding: [8, 12], textStyle: { color: t.ink, fontFamily: t.font, fontSize: 13 }, extraCssText: 'box-shadow:0 8px 24px -10px rgba(0,0,0,.35);border-radius:10px;' };
  }
  function make(el, option) {
    if (!window.echarts) { el.innerHTML = '<div class="empty sm">โหลดชุดกราฟไม่สำเร็จ (ตรวจอินเทอร์เน็ต)</div>'; return null; }
    var t = T(), c = echarts.init(el, null, { renderer: 'canvas' });
    option.textStyle = Object.assign({ fontFamily: t.font, color: t.ink2 }, option.textStyle || {});
    option.animationDuration = option.animationDuration == null ? 700 : option.animationDuration;
    option.animationEasing = 'cubicOut';
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) option.animation = false;
    c.setOption(option);
    live.push(c);
    return c;
  }
  function disposeAll() { live.forEach(function (c) { try { c.dispose(); } catch (e) { } }); live = []; }
  window.addEventListener('resize', U.debounce(function () { live.forEach(function (c) { try { c.resize(); } catch (e) { } }); }, 150));
  function axisCommon(t) { return { axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false }, axisLabel: { color: t.muted, fontSize: 11.5 }, splitLine: { lineStyle: { color: t.grid } } }; }
  var nf = function (v) { return U.fmt(v); };

  /** เส้นแนวโน้ม: x = ป้ายแกน, series [{name, data, color, area, dash, z}], band {lo, hi, name} */
  function line(el, o) {
    var t = T(), series = [];
    if (o.band) {
      series.push({ name: o.band.name + '_lo', type: 'line', data: o.band.lo, stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, silent: true, tooltip: { show: false } });
      series.push({ name: o.band.name, type: 'line', data: o.band.hi.map(function (h, i) { return h == null || o.band.lo[i] == null ? null : h - o.band.lo[i]; }), stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: o.band.color || t.cat[0], opacity: 0.16 }, silent: true, tooltip: { show: false } });
    }
    o.series.forEach(function (s, i) {
      series.push({ name: s.name, type: s.bar ? 'bar' : 'line', data: s.data, smooth: s.smooth == null ? 0 : s.smooth, symbol: s.symbol || 'circle', symbolSize: s.symbolSize || 6, showSymbol: !!s.showSymbol, connectNulls: false, z: s.z || 3,
        barMaxWidth: 14, itemStyle: { color: s.color || t.cat[i], borderRadius: s.bar ? [3, 3, 0, 0] : 0 },
        lineStyle: { width: s.width || 2, color: s.color || t.cat[i], type: s.dash ? [4, 4] : 'solid' },
        areaStyle: s.area ? { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: (s.color || t.cat[i]) + '33' }, { offset: 1, color: (s.color || t.cat[i]) + '00' }]) } : undefined,
        markLine: s.markLine, markArea: s.markArea, emphasis: { focus: 'series' } });
    });
    var named = o.series.filter(function (s) { return !s.noLegend; });
    return make(el, {
      grid: { left: 8, right: 16, top: named.length > 1 ? 36 : 16, bottom: o.zoom ? 46 : 8, containLabel: true },
      legend: named.length > 1 ? { top: 0, left: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 4, textStyle: { color: t.ink2 }, data: named.map(function (s) { return s.name; }) } : undefined,
      tooltip: Object.assign(tip(t), { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: t.axis } }, formatter: o.tipFmt || function (ps) {
        var h = '<b>' + (o.tipTitle ? o.tipTitle(ps[0].dataIndex) : ps[0].axisValueLabel) + '</b>';
        ps.forEach(function (p) { if (p.seriesName.slice(-3) === '_lo' || p.value == null) return; h += '<br>' + p.marker + p.seriesName + ' <b style="float:right;margin-left:14px">' + (o.fmt || nf)(p.value) + '</b>'; });
        if (o.band && o.bandTip) h += '<br><span style="color:' + t.muted + '">' + o.bandTip(ps[0].dataIndex) + '</span>';
        return h;
      } }),
      xAxis: Object.assign(axisCommon(t), { type: 'category', data: o.x, boundaryGap: !!o.bars, axisLabel: { color: t.muted, fontSize: 11.5, hideOverlap: true, formatter: o.xFmt } , splitLine: { show: false } }),
      yAxis: Object.assign(axisCommon(t), { type: 'value', min: o.yMin, name: o.yName, nameTextStyle: { color: t.muted, align: 'left' }, axisLabel: { color: t.muted, fontSize: 11.5, formatter: function (v) { return v >= 10000 ? U.fmt(v / 1000) + 'k' : U.fmt(v); } } }),
      dataZoom: o.zoom ? [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8, borderColor: t.grid, fillerColor: t.cat[0] + '22', handleStyle: { color: t.cat[0] }, textStyle: { color: t.muted } }] : undefined,
      series: series
    });
  }
  /** แท่งแนวนอน (จัดอันดับ) rows [{label, v, color, key, sub}] */
  function barsH(el, rows, o) {
    o = o || {}; var t = T();
    var data = rows.slice().reverse();
    var c = make(el, {
      grid: { left: 8, right: 56, top: 4, bottom: 4, containLabel: true },
      tooltip: Object.assign(tip(t), { trigger: 'item', formatter: function (p) { var r = data[p.dataIndex]; return '<b>' + U.esc(r.title || r.label) + '</b><br>' + (o.tip ? o.tip(r) : U.fmt(r.v) + ' ราย'); } }),
      xAxis: { type: 'value', show: false },
      yAxis: { type: 'category', data: data.map(function (r) { return r.label; }), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.ink2, fontSize: 12, width: o.labelW || 200, overflow: 'truncate' } },
      series: [{ type: 'bar', data: data.map(function (r) { return { value: r.v, itemStyle: { color: r.color || t.cat[0], borderRadius: [0, 4, 4, 0] } }; }), barMaxWidth: 16, barCategoryGap: '28%',
        label: { show: true, position: 'right', color: t.ink2, fontSize: 11.5, formatter: function (p) { return o.lbl ? o.lbl(data[p.dataIndex]) : U.fmt(p.value); } },
        showBackground: true, backgroundStyle: { color: t.grid, opacity: 0.35, borderRadius: [0, 4, 4, 0] } }]
    });
    if (c && o.onClick) { c.getZr().setCursorStyle && 0; c.on('click', function (p) { o.onClick(data[p.dataIndex]); }); }
    return c;
  }
  /** วงแหวนส่วนแบ่ง (≤7 ส่วน) rows [{label, v, color}] */
  function donut(el, rows, o) {
    o = o || {}; var t = T(), tot = U.sum(rows.map(function (r) { return r.v; })), narrow = el.clientWidth < 460;
    if (narrow) el.style.height = Math.max(parseInt(el.style.height) || 260, 230 + Math.ceil(rows.length / 2) * 22) + 'px';
    return make(el, {
      tooltip: Object.assign(tip(t), { trigger: 'item', formatter: function (p) { return '<b>' + U.esc(p.name) + '</b><br>' + U.fmt(p.value) + ' ราย · ' + U.share(p.value / tot); } }),
      legend: narrow ? { orient: 'horizontal', bottom: 0, left: 'center', icon: 'circle', itemWidth: 9, itemGap: 10, textStyle: { color: t.ink2, fontSize: 11.5 }, formatter: function (n) { var r = rows.filter(function (x) { return x.label === n; })[0]; return n + ' ' + (r ? U.share(r.v / tot, 0) : ''); } } : { orient: 'vertical', right: 0, top: 'middle', icon: 'circle', itemWidth: 9, itemGap: 9, textStyle: { color: t.ink2, fontSize: 12 }, formatter: function (n) { var r = rows.filter(function (x) { return x.label === n; })[0]; return n + '  ' + (r ? U.share(r.v / tot, 0) : ''); } },
      series: [{ type: 'pie', radius: narrow ? ['42%', '62%'] : ['56%', '80%'], center: narrow ? ['50%', '38%'] : ['30%', '50%'], padAngle: 1.2, itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 4 }, label: { show: true, position: 'center', formatter: function () { return '{a|' + U.fmt(tot) + '}\n{b|' + (o.center || 'ราย') + '}'; }, rich: { a: { fontFamily: t.fontD, fontSize: 20, fontWeight: 700, color: t.ink }, b: { fontSize: 11.5, color: t.muted } } }, emphasis: { scale: true, scaleSize: 4 },
        data: rows.map(function (r, i) { return { name: r.label, value: Math.round(r.v), itemStyle: { color: r.color || t.cat[i] } }; }) }]
    });
  }
  /** ตารางความหนาแน่น x=[ป้าย], y=[ป้าย], data=[[xi, yi, v]] */
  function heat(el, o) {
    var t = T(), max = o.max || Math.max.apply(null, o.data.map(function (d) { return d[2]; }).concat([1]));
    var c = make(el, {
      grid: { left: 8, right: 12, top: 8, bottom: 52, containLabel: true },
      tooltip: Object.assign(tip(t), { formatter: function (p) { return o.tip ? o.tip(p.data) : '<b>' + U.esc(o.y[p.data[1]]) + '</b><br>' + o.x[p.data[0]] + ' · ' + U.fmt(p.data[2], 1); } }),
      xAxis: { type: 'category', data: o.x, splitArea: { show: false }, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.muted, fontSize: 11, interval: o.xInterval == null ? 'auto' : o.xInterval } },
      yAxis: { type: 'category', data: o.y, inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.ink2, fontSize: 12, width: o.labelW || 180, overflow: 'truncate' } },
      visualMap: { min: 0, max: max, calculable: false, orient: 'horizontal', left: 'center', bottom: 4, itemWidth: 12, itemHeight: 160, text: [o.hiText || 'มาก', o.loText || 'น้อย'], textStyle: { color: t.muted, fontSize: 11 }, inRange: { color: [t.seq[0], t.seq[2], t.seq[4], t.seq[6], t.seq[8]] } },
      series: [{ type: 'heatmap', data: o.data, itemStyle: { borderColor: t.surface, borderWidth: 1.5, borderRadius: 3 }, emphasis: { itemStyle: { borderColor: t.ink, borderWidth: 1.5 } }, progressive: 2000,
        label: { show: !!o.labels, fontSize: 10, formatter: function (p) { var v = p.data[2]; if (!(v >= (o.labelMin || 0))) return ''; return '{' + (v > max * 0.5 ? 'w' : 'd') + '|' + U.fmt(v) + '}'; }, rich: { w: { color: '#ffffff', fontSize: 10 }, d: { color: t.ink, fontSize: 10 } } } }]
    });
    if (c && o.onClick) c.on('click', function (p) { o.onClick(p.data); });
    return c;
  }
  /** ปฏิทินความหนาแน่นรายวัน data=[[iso, v]] */
  function calendar(el, o) {
    var t = T(), max = Math.max.apply(null, o.data.map(function (d) { return d[1]; }).concat([1]));
    var years = []; var y0 = +o.from.slice(0, 4), y1 = +o.to.slice(0, 4);
    for (var y = y0; y <= y1; y++) years.push(y);
    var nW = Math.ceil((U.diff(o.from, o.to) + 1) / 7) + 2, cw = Math.max(9, Math.min(26, Math.floor(((el.clientWidth || 700) - 70) / Math.min(nW, 54))));
    var cals = years.map(function (yy, i) { return { top: 28 + i * 150, left: 46, cellSize: [cw, 15], range: [Math.max(o.from, yy + '-01-01') > o.from ? yy + '-01-01' : o.from, (yy + '-12-31') < o.to ? yy + '-12-31' : o.to], splitLine: { lineStyle: { color: t.axis, width: 1 } }, itemStyle: { borderColor: t.surface, borderWidth: 2, color: t.grid }, yearLabel: { show: true, color: t.muted, fontSize: 12, formatter: function (p) { return 'พ.ศ. ' + U.be(+p.start.slice(0, 4)); } }, dayLabel: { firstDay: 1, nameMap: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'], color: t.muted, fontSize: 10 }, monthLabel: { nameMap: U.MTH, color: t.muted, fontSize: 11 } }; });
    el.style.height = (60 + years.length * 150) + 'px';
    return make(el, {
      tooltip: Object.assign(tip(t), { formatter: function (p) { return '<b>' + U.thDate(p.data[0], { dow: true, full: true }) + '</b><br>' + U.fmt(p.data[1]) + ' ราย' + (D.hol[p.data[0]] ? '<br><span style="color:' + t.muted + '">' + D.hol[p.data[0]] + '</span>' : ''); } }),
      visualMap: { min: 0, max: max, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 12, itemHeight: 160, text: ['มาก', 'น้อย'], textStyle: { color: t.muted, fontSize: 11 }, inRange: { color: [t.seq[0], t.seq[2], t.seq[4], t.seq[6], t.seq[8]] } },
      calendar: cals,
      series: years.map(function (yy, i) { return { type: 'heatmap', coordinateSystem: 'calendar', calendarIndex: i, data: o.data.filter(function (d) { return +d[0].slice(0, 4) === yy; }) }; })
    });
  }

  /* ---------- กล่องกราฟมาตรฐาน ---------- */
  /**
   * card(host, {title, sub, help, cls, h, tools:{table, img, xlsx}}) → {el, body, chartEl, setTable(cols, rows), name}
   * ตาราง = มุมมองสำรองของทุกกราฟ (อ่านค่าได้โดยไม่ต้องชี้ · สำหรับคัดลอก/ผู้ใช้โปรแกรมอ่านหน้าจอ)
   */
  function card(host, o) {
    var el = U.el('<section class="card ' + (o.cls || '') + '"><header class="ch"><div><h2>' + o.title + (o.help ? UI.info(o.help) : '') + '</h2>' + (o.sub ? '<p class="sub">' + o.sub + '</p>' : '') + '</div><div class="ctools"></div></header><div class="cbody"><div class="chart" style="height:' + (o.h || 300) + 'px"></div><div class="tview" hidden></div></div></section>');
    host.appendChild(el);
    var tools = el.querySelector('.ctools'), chartEl = el.querySelector('.chart'), tv = el.querySelector('.tview'), tableData = null, chart = null;
    var api = { el: el, chartEl: chartEl, body: el.querySelector('.cbody'), name: o.title.replace(/<[^>]+>/g, '') };
    api.set = function (c) { chart = c; return c; };
    api.setTable = function (cols, rows) { tableData = { cols: cols, rows: rows }; if (!tv.hidden) paintTable(); };
    api.sub = function (s) { var p = el.querySelector('.sub'); if (!p) { p = U.el('<p class="sub"></p>'); el.querySelector('.ch > div').appendChild(p); } p.innerHTML = s; };
    function paintTable() {
      if (!tableData) { tv.innerHTML = '<p class="muted">ไม่มีข้อมูลตาราง</p>'; return; }
      tv.innerHTML = '<div class="tscroll"><table class="tbl"><thead><tr>' + tableData.cols.map(function (c) { return '<th' + (c.num ? ' class="num"' : '') + '>' + c.h + '</th>'; }).join('') + '</tr></thead><tbody>' +
        tableData.rows.map(function (r) { return '<tr>' + r.map(function (v, i) { var c = tableData.cols[i]; return '<td' + (c.num ? ' class="num"' : '') + '>' + (c.num && typeof v === 'number' ? U.fmt(v, c.d || 0) : U.esc(v)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    }
    var t = o.tools || { table: 1, img: 1, xlsx: 1 }; if (window.ARTIFACT) t = { table: t.table };
    if (t.table) { var b1 = U.el('<button class="icon-btn sm" title="สลับกราฟ/ตาราง" aria-pressed="false">' + ICON.table + '</button>'); b1.onclick = function () { var on = tv.hidden; tv.hidden = !on; chartEl.hidden = on; b1.setAttribute('aria-pressed', on); b1.classList.toggle('on', on); if (on) paintTable(); else if (chart) chart.resize(); }; tools.appendChild(b1); }
    if (t.img) { var b2 = U.el('<button class="icon-btn sm" title="บันทึกเป็นภาพ (PNG)">' + ICON.image + '</button>'); b2.onclick = function () { if (!chart) return; EXP.chartPng(chart, api.name); }; tools.appendChild(b2); }
    if (t.xlsx) { var b3 = U.el('<button class="icon-btn sm" title="ส่งออกเป็น Excel">' + ICON.download + '</button>'); b3.onclick = function () { if (!tableData) return UI.toast('ไม่มีข้อมูลให้ส่งออก', 'warn'); EXP.xlsx(api.name, [{ name: 'ข้อมูล', cols: tableData.cols, rows: tableData.rows }]); }; tools.appendChild(b3); }
    if (o.extra) o.extra.forEach(function (n) { tools.insertBefore(n, tools.firstChild); });
    api.chart = function () { return chart; };
    return api;
  }
  return { make: make, disposeAll: disposeAll, line: line, barsH: barsH, donut: donut, heat: heat, calendar: calendar, card: card, T: T };
})();
