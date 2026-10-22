/* =====================================================================
   p-admin.js — ตั้งค่าระบบ (เฉพาะผู้ดูแลระบบ)
   ผังคลินิก · จัดกลุ่มเอง (ลากย้าย) · สิทธิการรักษา · ผู้ใช้และสิทธิ์ · การดึงข้อมูล · เชื่อมต่อ API · แจ้งเตือน · วันหยุด · จอแสดงผล · ประวัติ
   ===================================================================== */
'use strict';
PAGE_FN.admin = function (root) {
  var TABS = [['clinics', 'ผังคลินิก'], ['groups', 'จัดกลุ่มเอง'], ['pts', 'สิทธิการรักษา'], ['users', 'ผู้ใช้และสิทธิ์'], ['fetch', 'การดึงข้อมูล'], ['api', 'เชื่อมต่อ API'], ['alerts', 'แจ้งเตือน'], ['hol', 'วันหยุด'], ['tv', 'จอแสดงผล'], ['audit', 'ประวัติการแก้ไข']];
  var tab = STORE.get('u:' + S.me.emp + ':adTab', 'clinics'), A = null;
  root.innerHTML = '<nav class="tabs" role="tablist">' + TABS.map(function (t) { return '<button role="tab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</nav><div id="adBody"></div>';
  U.$$('.tabs button', root).forEach(function (b) { b.onclick = function () { tab = b.getAttribute('data-t'); STORE.set('u:' + S.me.emp + ':adTab', tab); show(); }; });
  var body = U.$('#adBody', root);
  api('getAdmin', {}).then(function (r) { A = r; show(); }).catch(function (e) { body.innerHTML = '<div class="empty"><b>เปิดหน้าตั้งค่าไม่สำเร็จ</b><p>' + U.esc(e.message) + '</p></div>'; });

  function show() {
    U.$$('.tabs button', root).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-t') === tab); b.setAttribute('aria-selected', b.getAttribute('data-t') === tab); });
    CH.disposeAll(); body.innerHTML = '';
    ({ clinics: tClinics, groups: tGroups, pts: tPts, users: tUsers, fetch: tFetch, api: tApi, alerts: tAlerts, hol: tHol, tv: tTv, audit: tAudit })[tab]();
  }
  function applyBoot(part) { Object.keys(part).forEach(function (k) { S.boot[k] = part[k]; }); D.meta(S.boot); }
  function saveSet(partial, msg) { return api('saveSettings', { partial: partial }).then(function (r) { S.boot.settings = r.settings; D.settings = r.settings; if (r.status) SYNC.set(r.status); UI.toast(msg || 'บันทึกแล้ว', 'ok'); return r; }).catch(function (e) { UI.toast(e.message, 'bad'); throw e; }); }

  /* ---------------- ผังคลินิก ---------------- */
  function tClinics() {
    var pend = {}, q = '', fShow = 'all', fType = '', fBld = '', checked = {};
    var types = D.values('type', true), blds = D.values('bld', true), grps = D.values('grp', true);
    body.innerHTML = '<div class="ad-head"><div><h2>ผังคลินิก</h2><p class="muted">กำหนดว่าแต่ละคลินิกอยู่ตึกไหน ชั้นไหน กลุ่มไหน · "แสดง" = นับในรายงาน (คลินิกที่ไม่แสดงยังเก็บข้อมูลครบ) · คลินิกใหม่ที่ HIS ส่งมาจะเพิ่มเองอัตโนมัติ</p></div>' +
      '<div class="ad-act"><button class="btn" id="cImp">นำเข้าจากชีท</button><button class="btn" id="cExp">' + ICON.download + ' Excel</button><button class="btn primary" id="cSave" disabled>บันทึก</button></div></div>' +
      '<div class="ad-filter"><label class="srch">' + ICON.search + '<input type="search" id="cQ" placeholder="ค้นหารหัส/ชื่อคลินิก"></label>' +
      '<select id="cShow"><option value="all">แสดง/ไม่แสดง ทั้งหมด</option><option value="1">เฉพาะที่แสดง</option><option value="0">เฉพาะที่ไม่แสดง</option></select>' +
      '<select id="cType"><option value="">ทุกประเภท</option>' + types.map(function (v) { return '<option>' + U.esc(v) + '</option>'; }).join('') + '</select>' +
      '<select id="cBld"><option value="">ทุกตึก</option>' + blds.map(function (v) { return '<option>' + U.esc(v) + '</option>'; }).join('') + '</select><span class="muted small" id="cN"></span></div>' +
      '<div class="bulk" id="bulk" hidden><b id="bN"></b> ที่เลือก: <select id="bF"><option value="show">แสดงในรายงาน</option><option value="type">ประเภท</option><option value="bld">ตึก/อาคาร</option><option value="floor">ชั้น</option><option value="grp">กลุ่มรายงานสถิติ</option>' + D.G.map(function (g) { return '<option value="g:' + g.id + '">' + U.esc(g.name) + '</option>'; }).join('') + '</select> เป็น <span id="bV"></span><button class="btn sm primary" id="bGo">ใช้กับที่เลือก</button><button class="btn sm ghost" id="bX">ยกเลิกเลือก</button></div>' +
      '<datalist id="dlType">' + types.map(function (v) { return '<option value="' + U.esc(v) + '">'; }).join('') + '</datalist><datalist id="dlBld">' + blds.map(function (v) { return '<option value="' + U.esc(v) + '">'; }).join('') + '</datalist><datalist id="dlGrp">' + grps.map(function (v) { return '<option value="' + U.esc(v) + '">'; }).join('') + '</datalist>' +
      '<div class="tscroll tall"><table class="tbl ctbl"><thead><tr><th><input type="checkbox" id="cAll" aria-label="เลือกทั้งหมด"></th><th>แสดง</th><th>รหัส</th><th>ชื่อคลินิก</th><th>ประเภท</th><th>ตึก/อาคาร</th><th>ชั้น</th><th>กลุ่มรายงานสถิติ</th>' + D.G.map(function (g) { return '<th>' + U.esc(g.name) + '</th>'; }).join('') + '</tr></thead><tbody id="cBody"></tbody></table></div>';
    var val = function (c, k) { var p = pend[c.i]; if (p && p[k] !== undefined) return p[k]; if (k.indexOf('g:') === 0) { var g = (p && p.g && p.g[k.slice(2)] !== undefined) ? p.g[k.slice(2)] : (c.g || {})[k.slice(2)]; return g || ''; } return c[k]; };
    var setv = function (i, k, v) { var p = pend[i] || (pend[i] = { i: i }); if (k.indexOf('g:') === 0) { p.g = p.g || {}; p.g[k.slice(2)] = v; } else p[k] = v; U.$('#cSave').disabled = false; U.$('#cSave').textContent = 'บันทึก (' + Object.keys(pend).length + ')'; };
    var list = function () { return D.C.filter(function (c) { if (!c) return false; var s = String(val(c, 'show')) === '1' || val(c, 'show') === 1; if (fShow !== 'all' && (s ? '1' : '0') !== fShow) return false; if (fType && val(c, 'type') !== fType) return false; if (fBld && val(c, 'bld') !== fBld) return false; if (q && (c.code + ' ' + c.name).toLowerCase().indexOf(q) < 0) return false; return true; }); };
    var paint = function () {
      var L = list(); U.$('#cN').textContent = L.length + ' คลินิก';
      U.$('#cBody').innerHTML = L.slice(0, 400).map(function (c) {
        var on = String(val(c, 'show')) === '1' || val(c, 'show') === 1;
        return '<tr data-i="' + c.i + '" class="' + (pend[c.i] ? 'dirty' : '') + (on ? '' : ' off') + '"><td><input type="checkbox" class="ck1"' + (checked[c.i] ? ' checked' : '') + '></td><td><label class="sw"><input type="checkbox" data-k="show"' + (on ? ' checked' : '') + '><i></i></label></td><td class="code">' + U.esc(c.code) + '</td><td>' + U.esc(c.name) + '</td>' +
          '<td><input list="dlType" data-k="type" value="' + U.esc(val(c, 'type')) + '"></td><td><input list="dlBld" data-k="bld" value="' + U.esc(val(c, 'bld')) + '"></td><td><input class="w4" data-k="floor" value="' + U.esc(val(c, 'floor')) + '"></td><td><input list="dlGrp" data-k="grp" value="' + U.esc(val(c, 'grp')) + '"></td>' +
          D.G.map(function (g) { var v = val(c, 'g:' + g.id); return '<td><select data-k="g:' + g.id + '"><option value="">–</option>' + g.groups.map(function (x) { return '<option value="' + x.id + '"' + (x.id === v ? ' selected' : '') + '>' + U.esc(x.name) + '</option>'; }).join('') + '</select></td>'; }).join('') + '</tr>';
      }).join('') + (L.length > 400 ? '<tr><td colspan="9" class="muted">แสดง 400 แถวแรก · ใช้ค้นหา/ตัวกรองเพื่อหาคลินิกอื่น</td></tr>' : '');
      var nC = Object.keys(checked).length; U.$('#bulk').hidden = !nC; U.$('#bN').textContent = nC + ' คลินิก';
    };
    U.$('#cBody').addEventListener('change', function (e) {
      var tr = e.target.closest('tr'); if (!tr) return; var i = +tr.getAttribute('data-i');
      if (e.target.classList.contains('ck1')) { if (e.target.checked) checked[i] = 1; else delete checked[i]; var n = Object.keys(checked).length; U.$('#bulk').hidden = !n; U.$('#bN').textContent = n + ' คลินิก'; return; }
      var k = e.target.getAttribute('data-k'); if (!k) return;
      setv(i, k, k === 'show' ? (e.target.checked ? 1 : 0) : e.target.value.trim()); tr.classList.add('dirty'); if (k === 'show') tr.classList.toggle('off', !e.target.checked);
    });
    U.$('#cAll').onchange = function () { var on = this.checked; list().forEach(function (c) { if (on) checked[c.i] = 1; else delete checked[c.i]; }); paint(); };
    U.$('#cQ').oninput = U.debounce(function () { q = this.value.trim().toLowerCase(); paint(); }, 200);
    U.$('#cShow').onchange = function () { fShow = this.value; paint(); };
    U.$('#cType').onchange = function () { fType = this.value; paint(); };
    U.$('#cBld').onchange = function () { fBld = this.value; paint(); };
    var bV = function () { var f = U.$('#bF').value, h; if (f === 'show') h = '<select id="bVal"><option value="1">แสดง</option><option value="0">ไม่แสดง</option></select>'; else if (f.indexOf('g:') === 0) { var g = D.grouping(f.slice(2)); h = '<select id="bVal"><option value="">(ยังไม่จัดกลุ่ม)</option>' + g.groups.map(function (x) { return '<option value="' + x.id + '">' + U.esc(x.name) + '</option>'; }).join('') + '</select>'; } else h = '<input id="bVal" list="' + ({ type: 'dlType', bld: 'dlBld', grp: 'dlGrp' })[f] + '">'; U.$('#bV').innerHTML = h; };
    U.$('#bF').onchange = bV; bV();
    U.$('#bGo').onclick = function () { var f = U.$('#bF').value, v = U.$('#bVal').value.trim(); Object.keys(checked).forEach(function (i) { setv(+i, f, f === 'show' ? +v : v); }); paint(); UI.toast('ตั้งค่าแล้ว ' + Object.keys(checked).length + ' คลินิก · กด "บันทึก" เพื่อยืนยัน', 'info'); };
    U.$('#bX').onclick = function () { checked = {}; paint(); };
    U.$('#cSave').onclick = function () {
      var lst = Object.keys(pend).map(function (k) { return pend[k]; });
      api('saveClinics', { list: lst }).then(function (r) { applyBoot({ clinics: r.clinics }); pend = {}; U.$('#cSave').disabled = true; U.$('#cSave').textContent = 'บันทึก'; paint(); UI.toast('บันทึกผังคลินิกแล้ว ' + lst.length + ' คลินิก · ทุกหน้าจะจัดกลุ่มตามผังใหม่ทันที (รวมยอดย้อนหลัง)', 'ok'); }).catch(function (e) { UI.toast(e.message, 'bad'); });
    };
    U.$('#cExp').onclick = function () { EXP.xlsx('ผังคลินิก', [{ name: 'ผังคลินิก', cols: [{ h: 'สถานะ' }, { h: 'รหัสคลินิก' }, { h: 'ชื่อคลินิก' }, { h: 'ประเภทคลินิก' }, { h: 'ตึก_อาคาร' }, { h: 'ชั้น' }, { h: 'กลุ่มคลินิกในรายงานสถิติ' }].concat(D.G.map(function (g) { return { h: g.name }; })), rows: D.C.filter(Boolean).map(function (c) { return [c.show ? 'เลือก' : 'ไม่เลือก', c.code, c.name, c.type, c.bld, c.floor, c.grp].concat(D.G.map(function (g) { return D.label('g:' + g.id, (c.g || {})[g.id] || ''); })); }) }]); };
    U.$('#cImp').onclick = importSheet;
    paint();
    function importSheet() {
      var m = UI.modal({ title: 'นำเข้าผังคลินิกจากชีท', sub: 'คัดลอกจาก Google Sheet ทั้งตาราง (รวมหัวคอลัมน์) แล้ววางด้านล่าง · คอลัมน์: สถานะ, รหัสคลินิก, ชื่อคลินิก, ประเภทคลินิก, ตึก_อาคาร, ชั้น, กลุ่มคลินิกในรายงานสถิติ', wide: true,
        body: '<textarea id="impT" rows="10" placeholder="วางข้อมูลที่นี่ (Ctrl+V)"></textarea><div id="impP" class="muted small"></div>',
        actions: [{ label: 'ยกเลิก' }, { label: 'ตรวจและใช้', kind: 'primary', keep: true, onClick: function (close) {
          var txt = U.$('#impT').value.trim(); if (!txt) return false;
          var rows = txt.split(/\r?\n/).map(function (l) { return l.split(l.indexOf('\t') >= 0 ? '\t' : ','); });
          if (/รหัส/.test(rows[0].join(''))) rows.shift();
          var ch = 0, nw = 0, byCode = {}; D.C.forEach(function (c) { if (c) byCode[c.code] = c; });
          rows.forEach(function (r) {
            var code = (r[1] || '').trim(); if (!code) return; var c = byCode[code];
            var o = { show: /^เลือก/.test((r[0] || '').trim()) ? 1 : 0, name: (r[2] || '').trim(), type: (r[3] || '').trim().replace('ทังใน', 'ทั้งใน'), bld: (r[4] || '').trim(), floor: (r[5] || '').replace(/\s/g, ''), grp: (r[6] || '').trim() };
            if (!c) { nw++; return; }
            var diff = Object.keys(o).some(function (k) { return String(c[k]) !== String(o[k]); });
            if (diff) { Object.keys(o).forEach(function (k) { setv(c.i, k, o[k]); }); ch++; }
          });
          U.$('#impP').innerHTML = 'พบ ' + rows.length + ' แถว · จะแก้ ' + ch + ' คลินิก' + (nw ? ' · ' + nw + ' รหัสยังไม่เคยมีข้อมูลจาก HIS (ข้าม — จะเพิ่มเองเมื่อ HIS ส่งยอดมา)' : '');
          paint(); UI.toast('เตรียมแก้ ' + ch + ' คลินิก · ตรวจในตารางแล้วกด "บันทึก"', 'info'); setTimeout(close, 1400); return false;
        } }] });
    }
  }

  /* ---------------- จัดกลุ่มเอง (ลากย้าย) ---------------- */
  function tGroups() {
    var gi = 0, work = null, assign = {}, picked = {};
    var paint = function () {
      var G = D.G;
      body.innerHTML = '<div class="ad-head"><div><h2>จัดกลุ่มเอง</h2><p class="muted">สร้างมุมมองของหน่วยงานเอง เช่น เขตรับผิดชอบของผู้ตรวจการ/หัวหน้าหอ · ลากคลินิกไปวางในกลุ่ม หรือกดเลือกหลายคลินิกแล้ว "ย้ายไป" · ใช้เป็น "ดูตาม" ตัวกรอง และขอบเขตสิทธิ์ผู้ใช้ได้</p></div><div class="ad-act"><button class="btn" id="gNew">' + ICON.plus + ' สร้างการจัดกลุ่มใหม่</button></div></div>' +
        (G.length ? '<div class="seg wrap gsel">' + G.map(function (g, i) { return '<button data-g="' + i + '" class="' + (i === gi ? 'on' : '') + '">' + U.esc(g.name) + '</button>'; }).join('') + '</div>' : '<div class="empty"><b>ยังไม่มีการจัดกลุ่มเอง</b><p>กด "สร้างการจัดกลุ่มใหม่" เพื่อเริ่ม</p></div>') + '<div id="gBoard"></div>';
      U.$('#gNew').onclick = function () { newGrouping(); };
      U.$$('[data-g]', body).forEach(function (b) { b.onclick = function () { gi = +b.getAttribute('data-g'); work = null; paint(); }; });
      if (G.length) board();
    };
    var board = function () {
      var g = D.G[gi]; if (!work) { work = JSON.parse(JSON.stringify(g)); assign = {}; picked = {}; }
      var cur = function (c) { return assign[c.i] !== undefined ? assign[c.i] : ((c.g || {})[g.id] || ''); };
      var cols = work.groups.concat([{ id: '', name: 'ยังไม่จัดกลุ่ม' }]);
      var cl = D.C.filter(function (c) { return c && c.show; });
      var b = U.$('#gBoard');
      b.innerHTML = '<div class="gbar"><input id="gName" value="' + U.esc(work.name) + '" aria-label="ชื่อการจัดกลุ่ม"><button class="btn sm" id="gAdd">' + ICON.plus + ' เพิ่มกลุ่ม</button><span class="muted small" id="gPk"></span><select id="gMove"><option value="">ย้ายที่เลือกไป…</option>' + cols.map(function (c) { return '<option value="' + c.id + '">' + U.esc(c.name) + '</option>'; }).join('') + '</select>' +
        '<span class="sp"></span><button class="btn sm danger ghost" id="gDel">ลบการจัดกลุ่มนี้</button><button class="btn primary" id="gSave">บันทึก</button></div>' +
        '<div class="board">' + cols.map(function (c, ix) {
          var mine = cl.filter(function (x) { return cur(x) === c.id; });
          return '<section class="bcol' + (c.id ? '' : ' none') + '" data-gid="' + c.id + '"><header>' + (c.id ? '<input class="gn" data-ix="' + ix + '" value="' + U.esc(c.name) + '">' : '<b>' + c.name + '</b>') + '<span class="cnt">' + mine.length + '</span>' + (c.id ? '<button class="icon-btn sm" data-up="' + ix + '" title="เลื่อนขึ้น">' + ICON.chevL + '</button><button class="icon-btn sm" data-rm="' + ix + '" title="ลบกลุ่ม">' + ICON.x + '</button>' : '') + '</header>' +
            '<div class="bdrop">' + mine.map(function (x) { return '<span class="cchip' + (picked[x.i] ? ' pk' : '') + '" draggable="true" data-i="' + x.i + '" title="' + U.esc(x.name + ' · ' + x.bld + ' ชั้น ' + x.floor) + '"><b>' + U.esc(x.code) + '</b>' + U.esc(x.name.replace(/^คลินิก/, '').slice(0, 26)) + '</span>'; }).join('') + '</div></section>';
        }).join('') + '</div>';
      var nP = Object.keys(picked).length; U.$('#gPk').textContent = nP ? 'เลือก ' + nP + ' คลินิก' : 'กดคลินิกเพื่อเลือกหลายรายการ';
      // ลากวาง
      U.$$('.cchip', b).forEach(function (ch) {
        ch.ondragstart = function (e) { var i = ch.getAttribute('data-i'); if (!picked[i]) { picked = {}; picked[i] = 1; } e.dataTransfer.setData('text/plain', Object.keys(picked).join(',')); ch.classList.add('drag'); };
        ch.onclick = function () { var i = ch.getAttribute('data-i'); if (picked[i]) delete picked[i]; else picked[i] = 1; ch.classList.toggle('pk'); var n = Object.keys(picked).length; U.$('#gPk').textContent = n ? 'เลือก ' + n + ' คลินิก' : ''; };
      });
      U.$$('.bcol', b).forEach(function (col) {
        col.ondragover = function (e) { e.preventDefault(); col.classList.add('over'); };
        col.ondragleave = function () { col.classList.remove('over'); };
        col.ondrop = function (e) { e.preventDefault(); col.classList.remove('over'); var gid = col.getAttribute('data-gid'); (e.dataTransfer.getData('text/plain') || '').split(',').forEach(function (i) { if (i !== '') assign[+i] = gid; }); picked = {}; board(); };
      });
      U.$('#gMove').onchange = function () { var gid = this.value; if (this.selectedIndex === 0) return; Object.keys(picked).forEach(function (i) { assign[+i] = gid; }); picked = {}; board(); };
      U.$('#gName').onchange = function () { work.name = this.value.trim() || work.name; };
      U.$$('.gn', b).forEach(function (inp) { inp.onchange = function () { work.groups[+inp.getAttribute('data-ix')].name = inp.value.trim() || 'กลุ่ม'; }; });
      U.$$('[data-up]', b).forEach(function (x) { x.onclick = function () { var i = +x.getAttribute('data-up'); if (!i) return; var t = work.groups[i - 1]; work.groups[i - 1] = work.groups[i]; work.groups[i] = t; work.groups.forEach(function (y, k) { y.order = k; }); board(); }; });
      U.$$('[data-rm]', b).forEach(function (x) { x.onclick = function () { var i = +x.getAttribute('data-rm'), id = work.groups[i].id; work.groups.splice(i, 1); D.C.forEach(function (c) { if (c && cur(c) === id) assign[c.i] = ''; }); board(); }; });
      U.$('#gAdd').onclick = function () { work.groups.push({ id: 'k' + U.uid(), name: 'กลุ่มใหม่ ' + (work.groups.length + 1), order: work.groups.length }); board(); setTimeout(function () { var ins = U.$$('.gn', b); ins[ins.length - 1].focus(); ins[ins.length - 1].select(); }, 30); };
      U.$('#gDel').onclick = function () { UI.confirm('ลบการจัดกลุ่ม', 'ลบ "' + U.esc(g.name) + '" และการจัดคลินิกทั้งหมดในมุมมองนี้? (ยอดผู้ป่วยไม่ได้รับผลกระทบ)', 'ลบ', true).then(function (y) { if (!y) return; api('deleteGrouping', { id: g.id }).then(function (r) { applyBoot({ groupings: r.groupings, clinics: r.clinics }); gi = 0; work = null; paint(); UI.toast('ลบแล้ว', 'ok'); }); }); };
      U.$('#gSave').onclick = function () {
        api('saveGrouping', { grouping: work, assign: assign }).then(function (r) { applyBoot({ groupings: r.groupings, clinics: r.clinics }); work = null; paint(); UI.toast('บันทึกการจัดกลุ่มแล้ว', 'ok'); }).catch(function (e) { UI.toast(e.message, 'bad'); });
      };
    };
    function newGrouping() {
      UI.modal({ title: 'สร้างการจัดกลุ่มใหม่', body: '<label>ชื่อการจัดกลุ่ม<input id="ngN" placeholder="เช่น เขตผู้ตรวจการพยาบาล / ทีมหัวหน้าหอ"></label><label>เริ่มจาก<select id="ngF"><option value="">ว่าง (จัดเองทั้งหมด)</option><option value="bld">คัดลอกตามตึก</option><option value="floor">คัดลอกตามชั้น</option><option value="grp">คัดลอกตามกลุ่มรายงานสถิติ</option><option value="type">คัดลอกตามประเภทคลินิก</option></select></label>',
        actions: [{ label: 'ยกเลิก' }, { label: 'สร้าง', kind: 'primary', onClick: function () {
          var n = U.$('#ngN').value.trim(), f = U.$('#ngF').value; if (!n) { UI.toast('กรุณาตั้งชื่อ', 'warn'); return false; }
          var grp = { id: '', name: n, groups: [] }, asg = {};
          if (f) D.values(f).forEach(function (v, i) { var id = 'k' + i; grp.groups.push({ id: id, name: v, order: i }); D.C.forEach(function (c) { if (c && c.show && D.val(f, c.i) === v) asg[c.i] = id; }); });
          else grp.groups.push({ id: 'k0', name: 'กลุ่มที่ 1', order: 0 });
          api('saveGrouping', { grouping: grp, assign: asg }).then(function (r) { applyBoot({ groupings: r.groupings, clinics: r.clinics }); gi = D.G.length - 1; work = null; paint(); UI.toast('สร้างแล้ว · ลากคลินิกเพื่อจัดกลุ่ม', 'ok'); });
        } }] });
    }
    paint();
  }

  /* ---------------- สิทธิการรักษา ---------------- */
  function tPts() {
    var pg = JSON.parse(JSON.stringify(D.PG)), pts = D.P.filter(Boolean).map(function (p) { return { i: p.i, name: p.name, grp: p.grp }; });
    var paint = function () {
      body.innerHTML = '<div class="ad-head"><div><h2>สิทธิการรักษา</h2><p class="muted">จัดสิทธิการรักษาจาก HIS เข้ากลุ่มสำหรับรายงาน · สิทธิใหม่ที่ HIS ส่งมาจะอยู่กลุ่ม "ชำระเงินเอง/ทั่วไป" จนกว่าจะย้าย</p></div><div class="ad-act"><button class="btn" id="pAdd">' + ICON.plus + ' เพิ่มกลุ่มสิทธิ</button><button class="btn primary" id="pSave">บันทึก</button></div></div>' +
        '<div class="grid g2"><section class="card"><header class="ch"><h2>กลุ่มสิทธิ (ลำดับ = ลำดับสีในกราฟ)</h2></header><div class="cbody"><ol class="pglist">' + pg.map(function (g, i) { return '<li><i class="sw-c" style="background:var(--c' + (i % 8 + 1) + ')"></i><input data-pg="' + i + '" value="' + U.esc(g.name) + '"><span class="muted xs">' + pts.filter(function (p) { return p.grp === g.id; }).length + ' สิทธิ</span></li>'; }).join('') + '</ol>' + (pg.length > 8 ? '<p class="warn-line">มีมากกว่า 8 กลุ่ม — กราฟจะแยกสีได้ไม่ชัด แนะนำรวมกลุ่ม</p>' : '') + '</div></section>' +
        '<section class="card"><header class="ch"><h2>สิทธิจาก HIS → กลุ่ม</h2></header><div class="cbody"><table class="tbl"><tbody>' + pts.map(function (p) { return '<tr><td>' + U.esc(p.name) + '</td><td><select data-pt="' + p.i + '">' + pg.map(function (g) { return '<option value="' + g.id + '"' + (g.id === p.grp ? ' selected' : '') + '>' + U.esc(g.name) + '</option>'; }).join('') + '</select></td></tr>'; }).join('') + '</tbody></table></div></section></div>';
      U.$$('[data-pg]', body).forEach(function (x) { x.onchange = function () { pg[+x.getAttribute('data-pg')].name = x.value.trim(); }; });
      U.$$('[data-pt]', body).forEach(function (x) { x.onchange = function () { pts.filter(function (p) { return p.i === +x.getAttribute('data-pt'); })[0].grp = x.value; }; });
      U.$('#pAdd').onclick = function () { pg.push({ id: 'P' + U.uid(), name: 'กลุ่มสิทธิใหม่', order: pg.length }); paint(); };
      U.$('#pSave').onclick = function () { api('savePts', { ptGroups: pg, pts: pts }).then(function (r) { applyBoot({ pts: r.pts, ptGroups: r.ptGroups }); UI.toast('บันทึกกลุ่มสิทธิแล้ว', 'ok'); paint(); }).catch(function (e) { UI.toast(e.message, 'bad'); }); };
    };
    paint();
  }

  /* ---------------- ผู้ใช้ ---------------- */
  function tUsers() {
    var scopeTxt = function (u) { if (u.role === 'admin') return 'ทั้งหมด (ผู้ดูแลระบบ)'; if (!u.scope || !u.scope.length) return 'ทุกคลินิก'; return u.scope.map(function (s) { return (D.DIM[s.dim] ? D.DIM[s.dim].short + ': ' : '') + D.shortLabel(s.dim, s.val); }).join(', '); };
    body.innerHTML = '<div class="ad-head"><div><h2>ผู้ใช้และสิทธิ์</h2><p class="muted">เฉพาะรหัสเจ้าหน้าที่ 7 หลักที่อยู่ในรายชื่อนี้จึงเข้าใช้ได้ (ตรวจรหัสผ่านกับระบบ HIS) · กำหนดได้ว่าแต่ละคนเห็นข้อมูลระดับไหน</p></div><div class="ad-act"><button class="btn primary" id="uAdd">' + ICON.plus + ' เพิ่มผู้ใช้</button></div></div>' +
      '<div class="tscroll"><table class="tbl"><thead><tr><th>รหัส</th><th>ชื่อ</th><th>บทบาท</th><th>เห็นข้อมูล</th><th>สถานะ</th><th>เข้าใช้ล่าสุด</th><th></th></tr></thead><tbody>' +
      A.users.map(function (u) { return '<tr><td class="code">' + U.esc(u.emp) + '</td><td>' + U.esc(u.name) + (u.note ? '<br><span class="muted xs">' + U.esc(u.note) + '</span>' : '') + '</td><td>' + (u.role === 'admin' ? '<span class="tag brand">ผู้ดูแลระบบ</span>' : 'ผู้ใช้งาน') + '</td><td class="small">' + U.esc(scopeTxt(u)) + '</td><td>' + (+u.active ? 'ใช้งาน' : '<span class="muted">ระงับ</span>') + '</td><td class="small muted">' + U.esc(u.lastLogin || '–') + '</td><td><button class="btn sm" data-e="' + u.emp + '">แก้ไข</button></td></tr>'; }).join('') + '</tbody></table></div>' +
      '<p class="muted small">บทบาท: <b>ผู้ดูแลระบบ</b> = ทุกเมนูรวมตั้งค่า · <b>ผู้ใช้งาน</b> = ดูรายงานทุกหน้า (ยกเว้นตั้งค่า) ตามขอบเขตที่กำหนด · ขอบเขตกรองที่หลังบ้านด้วย</p>';
    U.$('#uAdd').onclick = function () { edit(null); };
    U.$$('[data-e]', body).forEach(function (b) { b.onclick = function () { edit(A.users.filter(function (u) { return u.emp === b.getAttribute('data-e'); })[0]); }; });
    function edit(u) {
      var x = u ? JSON.parse(JSON.stringify(u)) : { emp: '', name: '', role: 'viewer', scope: [], active: 1, note: '' };
      var sdim = x.scope && x.scope[0] ? x.scope[0].dim : 'g:' + (D.G[0] ? D.G[0].id : '') ;
      var bodyEl = U.el('<div class="uform"><label>รหัสเจ้าหน้าที่ 7 หลัก<input id="uE" inputmode="numeric" maxlength="7" value="' + U.esc(x.emp) + '"' + (u ? ' disabled' : '') + '></label><label>ชื่อ-สกุล<input id="uN" value="' + U.esc(x.name) + '"></label><label>หมายเหตุ/ตำแหน่ง<input id="uNo" value="' + U.esc(x.note || '') + '"></label>' +
        '<label>บทบาท<select id="uR"><option value="viewer"' + (x.role !== 'admin' ? ' selected' : '') + '>ผู้ใช้งาน (ดูรายงาน)</option><option value="admin"' + (x.role === 'admin' ? ' selected' : '') + '>ผู้ดูแลระบบ</option></select></label>' +
        '<fieldset id="uScope"><legend>เห็นข้อมูล</legend><label class="ck"><input type="radio" name="sc" value="all"' + (!x.scope.length ? ' checked' : '') + '>ทุกคลินิกทั้งโรงพยาบาล</label><label class="ck"><input type="radio" name="sc" value="some"' + (x.scope.length ? ' checked' : '') + '>เฉพาะ</label>' +
        '<select id="uD">' + D.DIMS.map(function (d) { return '<option value="' + d.id + '"' + (d.id === sdim ? ' selected' : '') + '>' + U.esc(d.name) + '</option>'; }).join('') + '</select><div class="flist" id="uV"></div></fieldset>' +
        '<label class="ck"><input type="checkbox" id="uA"' + (+x.active ? ' checked' : '') + '>เปิดใช้งาน</label></div>');
      var pv = function () { var d = U.$('#uD', bodyEl).value, sel = {}; x.scope.forEach(function (s) { if (s.dim === d) sel[s.val] = 1; }); U.$('#uV', bodyEl).innerHTML = D.values(d).map(function (v) { return '<label class="ck"><input type="checkbox" value="' + U.esc(v) + '"' + (sel[v] ? ' checked' : '') + '>' + U.esc(D.shortLabel(d, v)) + '</label>'; }).join(''); };
      var rv = function () { U.$('#uScope', bodyEl).disabled = U.$('#uR', bodyEl).value === 'admin'; };
      UI.modal({ title: u ? 'แก้ไขผู้ใช้ ' + x.emp : 'เพิ่มผู้ใช้', body: bodyEl, wide: true, onOpen: function () { pv(); rv(); U.$('#uD', bodyEl).onchange = function () { x.scope = []; pv(); }; U.$('#uR', bodyEl).onchange = rv; },
        actions: (u && u.emp !== S.me.emp ? [{ label: 'ลบผู้ใช้', kind: 'danger ghost', onClick: function () { UI.confirm('ลบผู้ใช้', 'ลบ ' + U.esc(x.emp + ' ' + x.name) + ' ออกจากระบบ?', 'ลบ', true).then(function (y) { if (y) api('deleteUser', { emp: x.emp }).then(function (r) { A.users = r.users; tUsers(); UI.toast('ลบแล้ว', 'ok'); }); }); } }] : []).concat([{ label: 'ยกเลิก' }, { label: 'บันทึก', kind: 'primary', keep: true, onClick: function (close) {
          x.emp = U.$('#uE', bodyEl).value.trim(); x.name = U.$('#uN', bodyEl).value.trim(); x.note = U.$('#uNo', bodyEl).value.trim(); x.role = U.$('#uR', bodyEl).value; x.active = U.$('#uA', bodyEl).checked ? 1 : 0;
          if (!/^\d{7}$/.test(x.emp)) return UI.toast('รหัสเจ้าหน้าที่ต้องเป็นตัวเลข 7 หลัก', 'warn');
          var some = U.$('input[name=sc]:checked', bodyEl).value === 'some', d = U.$('#uD', bodyEl).value;
          x.scope = some && x.role !== 'admin' ? U.$$('#uV input:checked', bodyEl).map(function (c) { return { dim: d, val: c.value }; }) : [];
          if (some && x.role !== 'admin' && !x.scope.length) return UI.toast('เลือกขอบเขตอย่างน้อย 1 รายการ', 'warn');
          api('saveUser', { user: x }).then(function (r) { A.users = r.users; close(); tUsers(); UI.toast('บันทึกผู้ใช้แล้ว', 'ok'); }).catch(function (e) { UI.toast(e.message, 'bad'); });
        } }]) });
    }
  }

  /* ---------------- การดึงข้อมูล ---------------- */
  function tFetch() {
    var s = S.boot.settings, st = A.status || {};
    body.innerHTML = '<div class="ad-head"><div><h2>การดึงข้อมูลจาก HIS</h2><p class="muted">หลังบ้านดึงยอดวันนี้ให้อัตโนมัติตามรอบ (ไม่ต้องเปิดหน้าเว็บค้าง) · กลางคืนตรวจซ้ำย้อนหลังเพื่อเก็บยอดที่แก้ไขภายหลัง</p></div><div class="ad-act"><button class="btn primary" id="fNow">' + ICON.refresh + ' ดึงตอนนี้</button></div></div>' +
      '<div class="grid g2"><section class="card"><header class="ch"><h2>ตั้งเวลาดึงอัตโนมัติ</h2></header><div class="cbody form2">' +
      '<label>ดึงทุก<select id="sEv">' + [5, 10, 15, 30, 60].map(function (m) { return '<option value="' + m + '"' + (+s.fetchEvery === m ? ' selected' : '') + '>' + m + ' นาที</option>'; }).join('') + '</select></label>' +
      '<label>ตั้งแต่<input type="time" id="sFr" value="' + s.fetchFrom + '"></label><label>ถึง<input type="time" id="sTo" value="' + s.fetchTo + '"></label>' +
      '<label>ตรวจซ้ำกลางคืน เวลา<select id="sNi">' + [0, 1, 2, 3, 4].map(function (h) { return '<option value="' + h + '"' + (+s.nightlyAt === h ? ' selected' : '') + '>0' + h + ':00 น.</option>'; }).join('') + '</select></label>' +
      '<label>ตรวจซ้ำย้อนหลัง<select id="sRe">' + [1, 3, 7, 14].map(function (d) { return '<option value="' + d + '"' + (+s.recheckDays === d ? ' selected' : '') + '>' + d + ' วัน</option>'; }).join('') + '</select></label>' +
      '<button class="btn primary" id="sSave">บันทึกเวลา</button><p class="muted xs">ยิ่งถี่ยิ่งสด แต่เพิ่มภาระ API ของไอที · ค่าที่แนะนำ 30 นาที (ตกลงกับไอทีก่อนตั้งต่ำกว่า 15 นาที)</p></div></section>' +
      '<section class="card"><header class="ch"><h2>สถานะ</h2></header><div class="cbody stat-list"><p>ดึงล่าสุด <b>' + U.esc(st.lastFetchAt || '–') + '</b></p><p>รอบถัดไป <b>' + U.esc(st.nextFetchAt || 'พรุ่งนี้ ' + s.fetchFrom) + '</b></p><p>โหมดข้อมูล <b>' + (st.apiMode === 'mock' ? 'ข้อมูลจำลอง (ยังไม่เชื่อม HIS)' : 'HIS จริง') + '</b></p><p>ข้อมูลเริ่มตั้งแต่ <b>' + U.thDate(st.firstDate || D.firstDate(), { full: true }) + '</b></p>' + (st.lastError ? '<p class="err">ผิดพลาดล่าสุด: ' + U.esc(st.lastError) + '</p>' : '') + '</div></section></div>' +
      '<section class="card"><header class="ch"><div><h2>ดึงข้อมูลย้อนหลัง</h2><p class="sub">ทำงานเบื้องหลังทีละช่วง (เว้นช่วงที่หน้างานใช้มาก) · ปิดหน้าเว็บได้</p></div></header><div class="cbody form2"><label>ตั้งแต่<input type="date" id="bF" value="' + (s.backfillFrom || '2023-10-01') + '" min="2019-10-01"></label><label>ถึง<input type="date" id="bT" value="' + U.addDays(nowBkk().iso, -1) + '"></label><button class="btn" id="bGo">เริ่มดึงย้อนหลัง</button><button class="btn ghost" id="bStop">หยุด</button><div class="prog" id="bProg"></div></div></section>' +
      '<section class="card"><header class="ch"><h2>ประวัติการดึง (100 ครั้งล่าสุด)</h2></header><div class="cbody"><div class="tscroll"><table class="tbl"><thead><tr><th>เวลา</th><th>แบบ</th><th>วันที่ข้อมูล</th><th class="num">แถวจาก API</th><th class="num">ผู้ป่วย</th><th class="num">ใช้เวลา</th><th>ผล</th></tr></thead><tbody>' +
      (A.log || []).map(function (l) { return '<tr><td class="small">' + U.esc(l.at) + '</td><td>' + U.esc(l.kind) + '</td><td>' + U.esc(l.date) + '</td><td class="num">' + U.fmt(l.rows) + '</td><td class="num">' + U.fmt(l.total) + '</td><td class="num">' + U.fmt((l.ms || 0) / 1000, 1) + ' วิ</td><td>' + (+l.ok ? '<span class="st good"><i></i>สำเร็จ</span>' : '<span class="st critical"><i></i>' + U.esc(l.msg) + '</span>') + '</td></tr>'; }).join('') + '</tbody></table></div></div></section>';
    U.$('#fNow').onclick = function () { SYNC.now().then(function () { api('getAdmin', {}).then(function (r) { A = r; if (tab === 'fetch') tFetch(); }); }); };
    U.$('#sSave').onclick = function () { saveSet({ fetchEvery: +U.$('#sEv').value, fetchFrom: U.$('#sFr').value, fetchTo: U.$('#sTo').value, nightlyAt: +U.$('#sNi').value, recheckDays: +U.$('#sRe').value }, 'บันทึกเวลาดึงข้อมูลแล้ว · มีผลรอบถัดไป'); };
    var pBf = function (bf) { var el = U.$('#bProg'); if (!el) return; if (!bf) { el.innerHTML = ''; return; } var pc = bf.total ? bf.done / bf.total : 0; el.innerHTML = '<div class="bar"><i style="width:' + (pc * 100).toFixed(1) + '%"></i></div><span>' + ({ running: 'กำลังดึง', done: 'เสร็จแล้ว', stopped: 'หยุดแล้ว' })[bf.state] + ' ' + U.fmt(bf.done) + '/' + U.fmt(bf.total) + ' วัน (' + U.thDate(bf.from) + ' – ' + U.thDate(bf.to) + ')</span>'; };
    pBf(A.bf);
    var poll = function () { if (tab !== 'fetch' || !U.$('#bProg')) return; api('getBackfill', {}, { bg: true }).then(function (r) { A.bf = r.bf; pBf(r.bf); if (r.bf && r.bf.state === 'running') setTimeout(poll, 4000); }); };
    if (A.bf && A.bf.state === 'running') setTimeout(poll, 2000);
    U.$('#bGo').onclick = function () { var f = U.$('#bF').value, t = U.$('#bT').value; if (!f || !t || f > t) return UI.toast('ช่วงวันที่ไม่ถูกต้อง', 'warn'); api('startBackfill', { from: f, to: t }).then(function (r) { A.bf = r.bf; pBf(r.bf); UI.toast('เริ่มดึงย้อนหลังแล้ว ทำงานเบื้องหลัง', 'ok'); setTimeout(poll, 2000); }).catch(function (e) { UI.toast(e.message, 'bad'); }); };
    U.$('#bStop').onclick = function () { api('stopBackfill', {}).then(function (r) { A.bf = r.bf; pBf(r.bf); }); };
  }

  /* ---------------- เชื่อมต่อ API ---------------- */
  function tApi() {
    var a = JSON.parse(JSON.stringify(S.boot.settings.api || {})), mp = a.map || {};
    var F = [['date', 'วันที่ (yyyymmdd)'], ['time', 'เวลา (hhmm)'], ['pt', 'สิทธิการรักษา (pttype)'], ['clinic', 'คลินิก ("รหัส:ชื่อ" หรือรหัส)'], ['visit', 'จำนวนทั้งหมด (total_visit)'], ['appoint', 'มาตามนัด (total_appoint)'], ['walkin', 'walk-in (total_walkin)']];
    body.innerHTML = '<div class="ad-head"><div><h2>เชื่อมต่อ API ของฝ่ายไอที</h2><p class="muted">พอไอทีส่ง API มา ใส่ที่อยู่และชื่อฟิลด์ที่นี่ได้เลย ไม่ต้องแก้โค้ด · token เก็บใน Apps Script › Project Settings › Script Properties ชื่อ <code>HIS_API_TOKEN</code> เท่านั้น (ห้ามใส่ในหน้าเว็บ/GitHub)</p></div></div>' +
      '<div class="grid g2"><section class="card"><header class="ch"><h2>ที่อยู่และรูปแบบ</h2></header><div class="cbody form1">' +
      '<label>โหมด<select id="aM"><option value="mock"' + (a.mode === 'mock' ? ' selected' : '') + '>ข้อมูลจำลอง (ระหว่างรอไอที)</option><option value="live"' + (a.mode === 'live' ? ' selected' : '') + '>HIS จริง</option></select></label>' +
      '<label>ที่อยู่ API<input id="aU" value="' + U.esc(a.url || '') + '" placeholder="https://www.thaimed.net/api/new/"></label>' +
      '<label>ชื่อ report<input id="aR" value="' + U.esc(a.report || '') + '" placeholder="รอไอทีแจ้ง"></label>' +
      '<label>วิธีส่งวันที่<select id="aP"><option value="new"' + (a.style !== 'get' ? ' selected' : '') + '>POST JSON + Bearer token (/api/new/)</option><option value="get"' + (a.style === 'get' ? ' selected' : '') + '>GET ?report=…&search_st=yyyymmdd</option></select></label>' +
      '</div></section><section class="card"><header class="ch"><h2>ชื่อฟิลด์ในคำตอบ</h2></header><div class="cbody form1">' + F.map(function (f) { return '<label>' + f[1] + '<input data-m="' + f[0] + '" value="' + U.esc(mp[f[0]] || '') + '"></label>'; }).join('') + '</div></section></div>' +
      '<div class="ad-act left"><button class="btn primary" id="aSave">บันทึก</button><input type="date" id="aD" value="' + nowBkk().iso + '"><button class="btn" id="aTest">ทดสอบดึง</button></div><div id="aOut"></div>';
    U.$('#aSave').onclick = function () { a.mode = U.$('#aM').value; a.url = U.$('#aU').value.trim(); a.report = U.$('#aR').value.trim(); a.style = U.$('#aP').value; a.map = {}; U.$$('[data-m]', body).forEach(function (i) { a.map[i.getAttribute('data-m')] = i.value.trim(); }); saveSet({ api: a }, 'บันทึกการเชื่อมต่อแล้ว'); };
    U.$('#aTest').onclick = function () {
      U.$('#aOut').innerHTML = '<p class="muted">กำลังทดสอบ…</p>';
      api('testApi', { date: U.$('#aD').value }).then(function (r) {
        U.$('#aOut').innerHTML = '<section class="card"><header class="ch"><div><h2>' + (r.ok ? '✓ เชื่อมต่อได้' : '✕ เชื่อมต่อไม่ได้') + '</h2><p class="sub">' + U.esc(r.note || '') + ' · ' + U.fmt(r.count) + ' แถว · รวม ' + U.fmt(r.total) + ' ราย · ' + U.fmt(r.ms / 1000, 1) + ' วินาที</p></div></header><div class="cbody"><p class="small">ฟิลด์ที่พบ: <code>' + U.esc((r.fields || []).join(', ')) + '</code></p><div class="tscroll"><table class="tbl"><thead><tr>' + (r.fields || []).map(function (f) { return '<th>' + U.esc(f) + '</th>'; }).join('') + '</tr></thead><tbody>' + (r.sample || []).map(function (row) { return '<tr>' + r.fields.map(function (f) { return '<td>' + U.esc(row[f]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div></div></section>';
      }).catch(function (e) { U.$('#aOut').innerHTML = '<p class="err">' + U.esc(e.message) + '</p>'; });
    };
  }

  /* ---------------- แจ้งเตือน ---------------- */
  function tAlerts() {
    var rules = JSON.parse(JSON.stringify(S.boot.settings.alerts || []));
    var dims = [{ id: 'all', name: 'ทั้งโรงพยาบาล' }].concat(D.DIMS);
    var paint = function () {
      body.innerHTML = '<div class="ad-head"><div><h2>เกณฑ์แจ้งเตือนความหนาแน่น</h2><p class="muted">ประเมินทุกครั้งที่ดึงยอดใหม่ · แจ้งเป็นป๊อปอัปบนหน้าจอและกระดิ่งมุมขวาบน (ส่งไลน์ไว้เฟสถัดไป)</p></div><div class="ad-act"><button class="btn" id="rAdd">' + ICON.plus + ' เพิ่มเกณฑ์</button><button class="btn primary" id="rSave">บันทึก</button></div></div>' +
        '<div class="tscroll"><table class="tbl rtbl"><thead><tr><th>เปิด</th><th>ใช้กับ</th><th>เฉพาะ</th><th>เงื่อนไข</th><th>ค่า</th><th>ขั้นต่ำ (ราย)</th><th></th></tr></thead><tbody>' +
        rules.map(function (r, i) {
          var vals = r.dim === 'all' ? [] : D.values(r.dim);
          return '<tr data-i="' + i + '"><td><label class="sw"><input type="checkbox" data-f="on"' + (+r.on ? ' checked' : '') + '><i></i></label></td><td><select data-f="dim">' + dims.map(function (d) { return '<option value="' + d.id + '"' + (d.id === r.dim ? ' selected' : '') + '>' + U.esc(d.short || d.name) + '</option>'; }).join('') + '</select></td>' +
            '<td>' + (r.dim === 'all' ? '–' : '<select data-f="val"><option value="">ทุกรายการ (แยกแต่ละ' + U.esc(D.DIM[r.dim].short) + ')</option>' + vals.map(function (v) { return '<option value="' + U.esc(v) + '"' + (v === r.val ? ' selected' : '') + '>' + U.esc(D.shortLabel(r.dim, v)) + '</option>'; }).join('') + '</select>') + '</td>' +
            '<td><select data-f="metric"><option value="last60"' + (r.metric === 'last60' ? ' selected' : '') + '>มาถึงใน 1 ชม.ล่าสุด ≥ (ราย)</option><option value="vsExp"' + (r.metric === 'vsExp' ? ' selected' : '') + '>มากกว่าปกติถึงเวลานี้ ≥ (%)</option></select></td>' +
            '<td><input type="number" class="w6" data-f="thr" value="' + r.thr + '"></td><td>' + (r.metric === 'vsExp' ? '<input type="number" class="w6" data-f="min" value="' + (r.min || 20) + '">' : '–') + '</td><td><button class="icon-btn sm" data-rm="' + i + '" aria-label="ลบ">' + ICON.x + '</button></td></tr>';
        }).join('') + '</tbody></table></div><p class="muted small">"ขั้นต่ำ" กันเตือนเกินจริงในจุดที่ปกติคนน้อย (เช่น ปกติ 3 ราย มา 5 ราย = +67%) · ระดับ "วิกฤต" เมื่อเกินเกณฑ์ 1.5 เท่า (นับราย) หรือเกินปกติ 60%</p>';
      U.$$('tr[data-i]', body).forEach(function (tr) {
        var r = rules[+tr.getAttribute('data-i')];
        U.$$('[data-f]', tr).forEach(function (inp) { inp.onchange = function () { var f = inp.getAttribute('data-f'); r[f] = f === 'on' ? (inp.checked ? 1 : 0) : (f === 'thr' || f === 'min') ? +inp.value : inp.value; if (f === 'dim') { r.val = ''; paint(); } if (f === 'metric') paint(); }; });
      });
      U.$$('[data-rm]', body).forEach(function (b) { b.onclick = function () { rules.splice(+b.getAttribute('data-rm'), 1); paint(); }; });
      U.$('#rAdd').onclick = function () { rules.push({ id: 'r' + U.uid(), dim: 'floor', val: '', metric: 'last60', thr: 50, min: 20, on: 1 }); paint(); };
      U.$('#rSave').onclick = function () { saveSet({ alerts: rules }, 'บันทึกเกณฑ์แจ้งเตือนแล้ว').then(function () { ALERTS.evaluate(); }); };
    };
    paint();
  }

  /* ---------------- วันหยุด ---------------- */
  function tHol() {
    var hol = JSON.parse(JSON.stringify(D.hol)), yr = +nowBkk().iso.slice(0, 4);
    var paint = function () {
      var ds = Object.keys(hol).filter(function (d) { return +d.slice(0, 4) === yr; }).sort();
      body.innerHTML = '<div class="ad-head"><div><h2>วันหยุดนักขัตฤกษ์</h2><p class="muted">ใช้แยก "วันหยุด" ออกจากวันทำการ และสำคัญมากกับการคาดการณ์ (ใส่วันหยุดปีหน้าล่วงหน้า) · เสาร์–อาทิตย์ระบบรู้เอง</p></div><div class="ad-act"><button class="btn primary" id="hSave">บันทึก</button></div></div>' +
        '<div class="seg">' + [yr - 3, yr - 2, yr - 1, yr, yr + 1].map(function (y) { return '<button data-y="' + y + '" class="' + (y === yr ? 'on' : '') + '">' + U.be(y) + '</button>'; }).join('') + '</div>' +
        '<div class="hadd"><input type="date" id="hD"><input id="hN" placeholder="ชื่อวันหยุด"><button class="btn" id="hA">' + ICON.plus + ' เพิ่ม</button><button class="btn ghost" id="hP">วางหลายวัน</button></div>' +
        '<table class="tbl"><tbody>' + (ds.length ? ds.map(function (d) { return '<tr><td>' + U.thDate(d, { dow: true, full: true }) + '</td><td>' + U.esc(hol[d]) + '</td><td>' + (D.dayType(d) === 'S' ? '<span class="muted xs">ตรงเสาร์–อาทิตย์</span>' : '') + '</td><td><button class="icon-btn sm" data-d="' + d + '">' + ICON.x + '</button></td></tr>'; }).join('') : '<tr><td class="muted">ยังไม่มีวันหยุดของปีนี้</td></tr>') + '</tbody></table>';
      U.$$('[data-y]', body).forEach(function (b) { b.onclick = function () { yr = +b.getAttribute('data-y'); paint(); }; });
      U.$$('[data-d]', body).forEach(function (b) { b.onclick = function () { delete hol[b.getAttribute('data-d')]; paint(); }; });
      U.$('#hA').onclick = function () { var d = U.$('#hD').value, n = U.$('#hN').value.trim(); if (!d || !n) return UI.toast('ใส่วันที่และชื่อวันหยุด', 'warn'); hol[d] = n; yr = +d.slice(0, 4); paint(); };
      U.$('#hP').onclick = function () { UI.modal({ title: 'วางวันหยุดหลายวัน', sub: 'บรรทัดละ 1 วัน: วันที่ (yyyy-mm-dd หรือ dd/mm/yyyy พ.ศ.) ตามด้วยชื่อ', body: '<textarea id="hT" rows="10"></textarea>', actions: [{ label: 'ยกเลิก' }, { label: 'เพิ่ม', kind: 'primary', onClick: function () { var n = 0; U.$('#hT').value.split(/\n/).forEach(function (l) { var m = l.match(/(\d{4})-(\d{2})-(\d{2})\s*[,\t ]\s*(.+)/) || null, d; if (m) d = m[1] + '-' + m[2] + '-' + m[3]; else { m = l.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[,\t ]\s*(.+)/); if (m) { var y = +m[3]; if (y > 2400) y -= 543; d = y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); } } if (d && m) { hol[d] = m[4].trim(); n++; } }); UI.toast('เพิ่ม ' + n + ' วัน · กด "บันทึก"', 'info'); paint(); } }] }); };
      U.$('#hSave').onclick = function () { api('saveHolidays', { holidays: hol }).then(function (r) { applyBoot({ holidays: r.holidays }); UI.toast('บันทึกวันหยุดแล้ว', 'ok'); }).catch(function (e) { UI.toast(e.message, 'bad'); }); };
    };
    paint();
  }

  /* ---------------- จอแสดงผล ---------------- */
  function tTv() {
    var tv = S.boot.settings.tv || {}, link = location.origin + location.pathname + '?tv=' + tv.key;
    body.innerHTML = '<div class="ad-head"><div><h2>จอแสดงผล (ทีวี/จอใหญ่)</h2><p class="muted">เปิดลิงก์นี้บนเครื่องที่ต่อจอ ไม่ต้องล็อกอิน · แสดงภาพรวมทั้ง รพ. วนหน้าอัตโนมัติ · ถ้าลิงก์หลุดไปที่อื่น กด "สร้างลิงก์ใหม่" ลิงก์เดิมจะใช้ไม่ได้ทันที</p></div></div>' +
      '<section class="card"><div class="cbody form1"><label>ลิงก์จอแสดงผล<div class="copyrow"><input readonly id="tvL" value="' + U.esc(link) + '"><button class="btn" id="tvC">คัดลอก</button><button class="btn ghost" id="tvN">สร้างลิงก์ใหม่</button></div></label>' +
      '<label>หัวข้อบนจอ<input id="tvT" value="' + U.esc(tv.title || '') + '"></label><label>เปลี่ยนหน้าทุก<select id="tvR">' + [10, 15, 20, 30, 45, 60].map(function (x) { return '<option value="' + x + '"' + (+tv.rotate === x ? ' selected' : '') + '>' + x + ' วินาที</option>'; }).join('') + '</select></label>' +
      '<div class="ad-act left"><button class="btn primary" id="tvS">บันทึก</button><button class="btn" id="tvO">' + ICON.tv + ' เปิดดูตัวอย่าง</button></div></div></section>';
    U.$('#tvC').onclick = function () { U.$('#tvL').select(); try { navigator.clipboard.writeText(U.$('#tvL').value); UI.toast('คัดลอกลิงก์แล้ว', 'ok'); } catch (e) { document.execCommand('copy'); } };
    U.$('#tvN').onclick = function () { UI.confirm('สร้างลิงก์ใหม่', 'จอที่เปิดด้วยลิงก์เดิมจะหยุดทำงาน ต้องเปิดลิงก์ใหม่ที่จอ', 'สร้างลิงก์ใหม่').then(function (y) { if (y) api('newTvKey', {}).then(function (r) { S.boot.settings = r.settings; tTv(); UI.toast('สร้างลิงก์ใหม่แล้ว', 'ok'); }); }); };
    U.$('#tvS').onclick = function () { var t2 = Object.assign({}, tv, { title: U.$('#tvT').value.trim(), rotate: +U.$('#tvR').value }); saveSet({ tv: t2 }, 'บันทึกการตั้งค่าจอแล้ว'); };
    U.$('#tvO').onclick = function () { go('tv'); };
  }

  /* ---------------- ประวัติ ---------------- */
  function tAudit() {
    body.innerHTML = '<div class="ad-head"><div><h2>ประวัติการแก้ไขตั้งค่า</h2><p class="muted">ใคร แก้อะไร เมื่อไร (200 รายการล่าสุด)</p></div></div><div class="tscroll"><table class="tbl"><thead><tr><th>เวลา</th><th>ผู้แก้</th><th>รายการ</th><th>รายละเอียด</th></tr></thead><tbody>' +
      ((A.audit || []).length ? A.audit.map(function (a) { return '<tr><td class="small">' + U.esc(a.at) + '</td><td>' + U.esc(a.emp) + '</td><td>' + U.esc(a.what) + '</td><td class="small">' + U.esc(a.detail) + '</td></tr>'; }).join('') : '<tr><td colspan="4" class="muted">ยังไม่มีการแก้ไข</td></tr>') + '</tbody></table></div>' +
      (DEMO ? '<p><button class="btn ghost" id="rst">คืนค่าโหมดสาธิตทั้งหมด</button></p>' : '');
    var r = U.$('#rst'); if (r) r.onclick = function () { api('resetDemo', {}).then(function () { location.reload(); }); };
  }
};
