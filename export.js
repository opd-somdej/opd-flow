/* =====================================================================
   export.js — ส่งออก Excel · บันทึกภาพกราฟ · พิมพ์รายงาน A4 (สร้างในเบราว์เซอร์ ไม่สร้างไฟล์ใน Drive)
   ===================================================================== */
'use strict';
var EXP = (function () {
  function stampName(n) { var t = nowBkk(); return (n || 'OPD-Flow').replace(/[\\/:*?"<>|]+/g, ' ').trim() + ' ' + t.iso + '_' + t.hm.replace(':', ''); }
  function dl(url, name) { var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 100); }
  function chartPng(chart, name) {
    var url = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#fff' });
    dl(url, stampName(name) + '.png');
  }
  /** sheets: [{name, cols:[{h,num}], rows:[[…]]}] */
  function xlsx(name, sheets) {
    if (!window.XLSX) return UI.toast('โหลดตัวสร้าง Excel ไม่สำเร็จ (ตรวจอินเทอร์เน็ต)', 'bad');
    var wb = XLSX.utils.book_new();
    var head = [['OPD Flow · ' + name], ['ตัวกรอง: ' + (D.describe().join(' · ') || 'ทั้งหมด')], ['ส่งออกเมื่อ ' + U.thDate(nowBkk().iso, { full: true }) + ' ' + nowBkk().hm + ' น. โดย ' + S.me.name], []];
    sheets.forEach(function (sh) {
      var aoa = head.concat([sh.cols.map(function (c) { return c.h.replace(/<[^>]+>/g, ''); })]).concat(sh.rows.map(function (r) { return r.map(function (v) { return typeof v === 'number' ? Math.round(v * 100) / 100 : v; }); }));
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = sh.cols.map(function (c, i) { return { wch: i === 0 ? 34 : Math.max(10, c.h.length + 2) }; });
      XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 30));
    });
    var buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    dl(url, stampName(name) + '.xlsx'); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    UI.toast('ส่งออก Excel แล้ว', 'ok');
  }
  /** พิมพ์ทั้งหน้าที่เปิดอยู่: ทุกกล่องกราฟ → ภาพ + ตาราง (≤25 แถว) */
  function printPage(title) {
    var blocks = [];
    U.$$('#page .kpis').forEach(function (k) { blocks.push({ html: '<div class="p-kpis">' + k.innerHTML + '</div>' }); });
    U.$$('#page .card').forEach(function (c) {
      if (c.offsetParent === null || c.classList.contains('no-print')) return;
      var h = c.querySelector('h2'), cv = c.querySelector('.chart'), inst = cv && window.echarts ? echarts.getInstanceByDom(cv) : null, b = { h: h ? h.textContent : '' };
      var sub = c.querySelector('.sub'); if (sub) b.sub = sub.textContent;
      if (inst) b.img = inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
      else { var body = c.querySelector('.cbody'); if (body) b.html = body.innerHTML; }
      blocks.push(b);
    });
    print({ title: title || U.$('#pageTitle').textContent, blocks: blocks });
  }
  function print(o) {
    var t = nowBkk(), wrap = U.el('<div class="print-doc"></div>');
    wrap.innerHTML = '<header class="p-head"><img src="logo-hospital.png" alt="" width="40" height="40"><div><b>' + U.esc(o.title) + '</b><span>' + U.esc((S.boot.settings.orgName || '') + ' · ระบบ OPD Flow') + '</span></div><div class="p-meta">พิมพ์ ' + U.thDate(t.iso, { full: true }) + ' ' + t.hm + ' น.<br>โดย ' + U.esc(S.me.name) + '</div></header>' +
      '<p class="p-filter">ตัวกรอง: ' + U.esc(D.describe().join(' · ') || 'ทุกคลินิกที่แสดง') + (DEMO ? ' · <b>ข้อมูลจำลอง (โหมดสาธิต)</b>' : '') + '</p>' +
      o.blocks.map(function (b) { return '<section class="p-block">' + (b.h ? '<h3>' + U.esc(b.h) + '</h3>' : '') + (b.sub ? '<p class="p-sub">' + U.esc(b.sub) + '</p>' : '') + (b.img ? '<img src="' + b.img + '" alt="">' : '') + (b.html || '') + '</section>'; }).join('') +
      '<footer class="p-foot">ข้อมูลจากระบบสารสนเทศโรงพยาบาล (HIS) · ยอดอัปเดตล่าสุด ' + U.esc(((SYNC.st || S.boot.status || {}).lastFetchAt || '').slice(0, 16)) + '</footer>';
    document.body.appendChild(wrap);
    document.body.classList.add('printing');
    var imgs = U.$$('img', wrap), left = imgs.length;
    var go = function () {
      setTimeout(function () {
        window.print();
        setTimeout(function () { document.body.classList.remove('printing'); wrap.remove(); U.$$('.modal-wrap.out').forEach(function (m) { m.remove(); }); }, 400);
      }, 120);
    };
    if (!left) go(); else imgs.forEach(function (im) { if (im.complete) { if (--left === 0) go(); } else im.onload = im.onerror = function () { if (--left === 0) go(); }; });
  }
  /** ปุ่มส่งออกมาตรฐานบนแถบบน */
  function toolbar(host, opt) {
    opt = opt || {};
    if (window.ARTIFACT) return null;   // หน้าตัวอย่างออนไลน์พิมพ์/ดาวน์โหลดไม่ได้ (ระบบจริงทำได้)
    var b = U.el('<div class="exp-tools"><button class="btn ghost sm" id="btnPrint">' + ICON.print + '<span>พิมพ์/PDF</span></button>' + (opt.xlsx ? '<button class="btn ghost sm" id="btnXl">' + ICON.download + '<span>Excel</span></button>' : '') + '</div>');
    host.appendChild(b);
    U.$('#btnPrint', b).onclick = function () { printPage(opt.title); };
    if (opt.xlsx) U.$('#btnXl', b).onclick = opt.xlsx;
    return b;
  }
  return { xlsx: xlsx, chartPng: chartPng, print: print, printPage: printPage, toolbar: toolbar, dl: dl };
})();
