/* =====================================================================
   p-admin.js — ตั้งค่าระบบ (เฉพาะผู้ดูแลระบบ)
   ผังคลินิก · จัดกลุ่มเอง (ลากย้าย) · สิทธิการรักษา · ผู้ใช้และสิทธิ์ · การดึงข้อมูล · เชื่อมต่อ API · แจ้งเตือน · วันหยุด · จอแสดงผล · ประวัติ
   ===================================================================== */
'use strict';
PAGE_FN.admin = function (root) {
  var TABS = [['clinics', 'ผังคลินิก (หน่วยงาน/โซน)'], ['fetch', 'ข้อมูลและการดึง'], ['users', 'ผู้ใช้และสิทธิ์'], ['pts', 'สิทธิการรักษา'], ['groups', 'จัดกลุ่มเอง'], ['api', 'เชื่อมต่อ API'], ['alerts', 'แจ้งเตือน'], ['hol', 'วันหยุด'], ['tv', 'จอแสดงผล'], ['audit', 'ประวัติการแก้ไข']];
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

  /* ---------------- ผังคลินิก: หน่วยงาน › โซน › คลินิก (27 ต.ค. 69) ---------------- */
  function tClinics() {
    var pend = {}, q = '', fShow = STORE.get('u:' + S.me.emp + ':cShow', 'all'), fUnit = '', checked = {};
    STORE.set('u:' + S.me.emp + ':cShow', 'all');
    var units = D.values('unit', true).filter(function (u) { return u !== '(ยังไม่จัดกลุ่ม)'; }), types = D.values('type', true), blds = D.values('bld', true), grps = D.values('grp', true);
    var zonesOf = function (u) { var o = []; ((S.boot.settings.orgMap || {}).units || []).forEach(function (x) { if (x[0] === u) o = o.concat(x[1]); }); D.C.forEach(function (c) { if (c && c.unit === u && c.zone && o.indexOf(c.zone) < 0) o.push(c.zone); }); return o; };
    var used = {}; var um = UNMAPPED.list(); um.forEach(function (x) { used[x.c.i] = x.n; });
    var om = S.boot.settings.orgMap || {};
    body.innerHTML = '<div class="ad-head"><div><h2>ผังคลินิก: หน่วยงาน › โซน › คลินิก</h2><p class="muted">ใช้จัดกลุ่มยอดทุกหน้า · คลินิกที่<b>ยังไม่จัดกลุ่ม</b> (HIS ส่งมาแต่ไม่อยู่ในผัง) จะ<b>ไม่นับ</b>ในยอด OPD จนกว่าจะเลือกหน่วยงานให้ · แก้แล้วยอดย้อนหลังจัดกลุ่มใหม่ทันที' +
      (om.at ? '<br><span class="xs">ผังปัจจุบัน: ' + U.esc(om.n || '') + ' คลินิก · ปรับล่าสุด ' + U.esc(om.at) + ' โดย ' + U.esc(om.by || '') + '</span>' : '') + '</p></div>' +
      '<div class="ad-act"><label class="btn" id="cImpL">' + ICON.upload + '<span>นำเข้าผังจาก Excel</span><input type="file" id="cImp" accept=".xlsx,.xls,.csv" hidden></label><button class="btn" id="cExp">' + ICON.download + '<span>ดาวน์โหลดผัง (Excel)</span></button><button class="btn primary" id="cSave" disabled>' + ICON.check + '<span>บันทึก</span></button></div></div>' +
      (um.length ? '<div class="flag-bar"><b class="fi">!</b><div><b>ยังไม่จัดกลุ่ม ' + um.length + ' คลินิกที่มีผู้ป่วยใน 30 วันล่าสุด</b> — เลือกหน่วยงาน/โซนให้ แล้วกดบันทึก (หรือปล่อยไว้ ถ้าไม่ใช่ OPD เช่น ER ไตเทียม)</div><button class="btn sm" id="cShowNew">ดูรายการ</button></div>' : '') +
      '<div class="ad-filter"><label class="srch">' + ICON.search + '<input type="search" id="cQ" placeholder="ค้นหารหัส/ชื่อคลินิก"></label>' +
      '<select id="cShow"><option value="all">ทุกสถานะ</option><option value="in">อยู่ในผัง (นับในยอด)</option><option value="new">ยังไม่จัดกลุ่ม · มีผู้ป่วย</option><option value="out">ยังไม่จัดกลุ่มทั้งหมด</option></select>' +
      '<select id="cUnit"><option value="">ทุกหน่วยงาน</option>' + units.map(function (v) { return '<option value="' + U.esc(v) + '">' + U.esc(D.shortLabel('unit', v)) + '</option>'; }).join('') + '</select><span class="muted small" id="cN"></span></div>' +
      '<div class="bulk" id="bulk" hidden><b id="bN"></b> ที่เลือก: ย้ายไปหน่วยงาน <select id="bU"><option value="">— ไม่นับ (ยังไม่จัดกลุ่ม) —</option>' + units.map(function (v) { return '<option value="' + U.esc(v) + '">' + U.esc(D.shortLabel('unit', v)) + '</option>'; }).join('') + '</select> โซน <input id="bZ" list="dlZone" placeholder="ชื่อโซน"><button class="btn sm primary" id="bGo">ใช้กับที่เลือก</button><button class="btn sm ghost" id="bX">ยกเลิกเลือก</button></div>' +
      '<datalist id="dlType">' + types.map(function (v) { return '<option value="' + U.esc(v) + '">'; }).join('') + '</datalist><datalist id="dlBld">' + blds.map(function (v) { return '<option value="' + U.esc(v) + '">'; }).join('') + '</datalist><datalist id="dlGrp">' + grps.map(function (v) { return '<option value="' + U.esc(v) + '">'; }).join('') + '</datalist><datalist id="dlZone"></datalist>' +
      '<div class="tscroll tall"><table class="tbl ctbl"><thead><tr><th><input type="checkbox" id="cAll" aria-label="เลือกทั้งหมด"></th><th>สถานะ</th><th>รหัส</th><th>ชื่อคลินิก</th><th>หน่วยงาน</th><th>โซน</th><th>ประเภท</th><th>ตึก/อาคาร</th><th>ชั้น</th><th>กลุ่มรายงานสถิติ</th></tr></thead><tbody id="cBody"></tbody></table></div>';
    U.$('#cShow').value = fShow;
    var val = function (c, k) { var p = pend[c.i]; if (p && p[k] !== undefined) return p[k]; return c[k] || ''; };
    var setv = function (i, k, v) { var p = pend[i] || (pend[i] = { i: i }); p[k] = v; var n = Object.keys(pend).length; U.$('#cSave').disabled = false; U.$('#cSave span').textContent = 'บันทึก (' + n + ')'; };
    var isIn = function (c) { return !!String(val(c, 'unit')).trim(); };
    var list = function () { return D.C.filter(function (c) { if (!c) return false; var inn = isIn(c); if (fShow === 'in' && !inn) return false; if (fShow === 'out' && inn) return false; if (fShow === 'new' && (inn || !used[c.i])) return false; if (fUnit && val(c, 'unit') !== fUnit) return false; if (q && (c.code + ' ' + c.name + ' ' + val(c, 'zone')).toLowerCase().indexOf(q) < 0) return false; return true; }).sort(function (a, b) { var ia = isIn(a), ib = isIn(b); if (fShow === 'new' || fShow === 'all') { var na = !ia && used[a.i] ? 1 : 0, nb = !ib && used[b.i] ? 1 : 0; if (na !== nb) return nb - na; } return (D.UORD[val(a, 'unit')] != null ? D.UORD[val(a, 'unit')] : 1e6) - (D.UORD[val(b, 'unit')] != null ? D.UORD[val(b, 'unit')] : 1e6) || (D.ZORD[val(a, 'zone')] || 0) - (D.ZORD[val(b, 'zone')] || 0) || a.code.localeCompare(b.code); }); };
    var paint = function () {
      var L = list(); U.$('#cN').textContent = L.length + ' คลินิก';
      U.$('#cBody').innerHTML = L.slice(0, 500).map(function (c) {
        var inn = isIn(c), u = val(c, 'unit');
        return '<tr data-i="' + c.i + '" class="' + (pend[c.i] ? 'dirty' : '') + (inn ? '' : ' off') + '"><td><input type="checkbox" class="ck1"' + (checked[c.i] ? ' checked' : '') + '></td>' +
          '<td>' + (inn ? '<span class="st good"><i>✓</i>ในผัง</span>' : '<span class="st warning"><i>!</i>ยังไม่จัดกลุ่ม</span>' + (used[c.i] ? '<br><span class="xs muted">' + U.fmt(used[c.i]) + ' ราย/30 วัน</span>' : '')) + '</td>' +
          '<td class="code">' + U.esc(c.code) + '</td><td>' + U.esc(c.name) + '</td>' +
          '<td><select data-k="unit"><option value="">— ไม่นับ —</option>' + units.map(function (v) { return '<option value="' + U.esc(v) + '"' + (v === u ? ' selected' : '') + '>' + U.esc(D.shortLabel('unit', v)) + '</option>'; }).join('') + '</select></td>' +
          '<td><input data-k="zone" list="dlZone" value="' + U.esc(val(c, 'zone')) + '"' + (inn ? '' : ' disabled') + ' placeholder="เลือก/พิมพ์โซน"></td>' +
          '<td><input list="dlType" data-k="type" value="' + U.esc(val(c, 'type')) + '"></td><td><input list="dlBld" data-k="bld" value="' + U.esc(val(c, 'bld')) + '"></td><td><input class="w4" data-k="floor" value="' + U.esc(val(c, 'floor')) + '"></td><td><input list="dlGrp" data-k="grp" value="' + U.esc(val(c, 'grp')) + '"></td></tr>';
      }).join('') + (L.length > 500 ? '<tr><td colspan="10" class="muted">แสดง 500 แถวแรก · ใช้ค้นหา/ตัวกรองเพื่อหาคลินิกอื่น</td></tr>' : '');
      var nC = Object.keys(checked).length; U.$('#bulk').hidden = !nC; U.$('#bN').textContent = nC + ' คลินิก';
    };
    U.$('#cBody').addEventListener('focusin', function (e) { if (e.target.getAttribute('data-k') !== 'zone') return; var tr = e.target.closest('tr'), c = D.C[+tr.getAttribute('data-i')]; U.$('#dlZone').innerHTML = zonesOf(val(c, 'unit')).map(function (z) { return '<option value="' + U.esc(z) + '">'; }).join(''); });
    U.$('#cBody').addEventListener('change', function (e) {
      var tr = e.target.closest('tr'); if (!tr) return; var i = +tr.getAttribute('data-i');
      if (e.target.classList.contains('ck1')) { if (e.target.checked) checked[i] = 1; else delete checked[i]; var n = Object.keys(checked).length; U.$('#bulk').hidden = !n; U.$('#bN').textContent = n + ' คลินิก'; return; }
      var k = e.target.getAttribute('data-k'); if (!k) return;
      setv(i, k, e.target.value.trim());
      if (k === 'unit') { var zs = zonesOf(e.target.value); setv(i, 'zone', e.target.value ? (zs.indexOf(val(D.C[i], 'zone')) >= 0 ? val(D.C[i], 'zone') : zs[0] || e.target.value) : ''); paint(); return; }
      tr.classList.add('dirty');
    });
    U.$('#cAll').onchange = function () { var on = this.checked; list().forEach(function (c) { if (on) checked[c.i] = 1; else delete checked[c.i]; }); paint(); };
    U.$('#cQ').oninput = U.debounce(function () { q = this.value.trim().toLowerCase(); paint(); }, 200);
    U.$('#cShow').onchange = function () { fShow = this.value; paint(); };
    U.$('#cUnit').onchange = function () { fUnit = this.value; paint(); };
    var sn = U.$('#cShowNew'); if (sn) sn.onclick = function () { fShow = 'new'; U.$('#cShow').value = 'new'; paint(); };
    U.$('#bU').onchange = function () { var zs = zonesOf(this.value); U.$('#dlZone').innerHTML = zs.map(function (z) { return '<option value="' + U.esc(z) + '">'; }).join(''); U.$('#bZ').value = zs[0] || ''; };
    U.$('#bGo').onclick = function () { var u = U.$('#bU').value, z = U.$('#bZ').value.trim() || u; Object.keys(checked).forEach(function (i) { setv(+i, 'unit', u); setv(+i, 'zone', u ? z : ''); }); paint(); UI.toast('ตั้งค่าแล้ว ' + Object.keys(checked).length + ' คลินิก · กด "บันทึก" เพื่อยืนยัน', 'info'); };
    U.$('#bX').onclick = function () { checked = {}; paint(); };
    U.$('#cSave').onclick = function () {
      var lst = Object.keys(pend).map(function (k) { return pend[k]; });
      UI.busyBtn(this, api('saveClinics', { list: lst }), 'กำลังบันทึก…').then(function (r) { applyBoot({ clinics: r.clinics }); pend = {}; U.$('#cSave').disabled = true; U.$('#cSave span').textContent = 'บันทึก'; paint(); UI.toast('บันทึกผังคลินิกแล้ว ' + lst.length + ' คลินิก · ทุกหน้าจัดกลุ่มตามผังใหม่ทันที (รวมยอดย้อนหลัง)', 'ok'); }).catch(function (e) { UI.toast(e.message, 'bad'); });
    };
    U.$('#cExp').onclick = function () {
      var rows = D.C.filter(Boolean).sort(function (a, b) { return (D.UORD[a.unit] != null ? D.UORD[a.unit] : 1e6) - (D.UORD[b.unit] != null ? D.UORD[b.unit] : 1e6) || (D.ZORD[a.zone] || 0) - (D.ZORD[b.zone] || 0) || a.code.localeCompare(b.code); });
      EXP.xlsx('ผังคลินิก OPD ' + nowBkk().iso, [{ name: 'ผังคลินิก', cols: [{ h: 'หน่วยงาน' }, { h: 'โซน' }, { h: 'รหัสคลินิก' }, { h: 'ชื่อคลินิก' }, { h: 'ประเภทคลินิก' }, { h: 'ตึก_อาคาร' }, { h: 'ชั้น' }, { h: 'กลุ่มคลินิกในรายงานสถิติ' }, { h: 'สถานะ' }],
        rows: rows.map(function (c) { return [c.unit || '', c.zone || '', c.code, c.name, c.type, c.bld, c.floor, c.grp, c.unit ? 'ในผัง' : 'ยังไม่จัดกลุ่ม']; }) }]);
    };
    U.$('#cImp').onchange = function () { var f = this.files[0]; this.value = ''; if (f) MAPIO.read(f).then(previewImport).catch(function (e) { UI.toast(e.message, 'bad', 7000); }); };
    paint();

    /** แสดงความต่างก่อนใช้ผังใหม่ (แก้ชื่อหน่วยงานได้ก่อนยืนยัน) */
    function previewImport(M) {
      var byCode = {}; D.C.forEach(function (c) { if (c) byCode[c.code] = c; });
      var inFile = {}; M.rows.forEach(function (r) { inFile[r.code] = r; });
      var moved = [], added = [], out = [], same = 0;
      M.rows.forEach(function (r) { var c = byCode[r.code]; if (!c) added.push(r); else if (!c.unit) moved.push([r, '(ยังไม่จัดกลุ่ม)']); else if (c.unit !== r.unit || c.zone !== r.zone) moved.push([r, c.zone || c.unit]); else same++; });
      D.C.forEach(function (c) { if (c && c.unit && !inFile[c.code]) out.push(c); });
      var names = M.units.map(function (u) { return u[0]; });
      var b = U.el('<div class="imp">' +
        '<div class="kpis sm">' + kpi({ label: 'คลินิกในไฟล์', value: M.rows.length }) + kpi({ label: 'ย้ายหน่วยงาน/โซน', value: moved.length }) + kpi({ label: 'ไม่อยู่ในไฟล์ (จะไม่นับ)', value: out.length }) + kpi({ label: 'รหัสใหม่ (ยังไม่เคยมีข้อมูล)', value: added.length }) + '</div>' +
        (M.notes.length ? '<p class="warn-line">' + M.notes.map(U.esc).join(' · ') + '</p>' : '') +
        '<h4>หน่วยงานและโซนในไฟล์ (แก้ชื่อหน่วยงานได้)</h4><div class="imp-units">' + M.units.map(function (u, i) { return '<div class="imp-u"><input data-ui="' + i + '" value="' + U.esc(u[0]) + '"><span class="muted small">' + u[1].length + ' โซน · ' + M.rows.filter(function (r) { return r.unit === u[0]; }).length + ' คลินิก</span><div class="xs muted">' + u[1].map(U.esc).join(' · ') + '</div></div>'; }).join('') + '</div>' +
        (moved.length ? '<details><summary>ดูรายการที่ย้าย (' + moved.length + ')</summary><table class="tbl"><tbody>' + moved.slice(0, 300).map(function (m) { return '<tr><td class="code">' + U.esc(m[0].code) + '</td><td>' + U.esc(m[1]) + ' → <b>' + U.esc(m[0].zone) + '</b></td></tr>'; }).join('') + '</tbody></table></details>' : '') +
        (out.length ? '<details><summary>ดูรายการที่จะไม่นับ (' + out.length + ')</summary><p class="small">' + out.map(function (c) { return U.esc(c.code); }).join(', ') + '</p></details>' : '') + '</div>');
      UI.modal({ title: 'ตรวจผังก่อนใช้ · ' + U.esc(M.file), sub: 'ตรวจตัวเลขแล้วกด "ใช้ผังนี้" · มีผลกับทุกหน้าและยอดย้อนหลังทันที', body: b, wide: true,
        actions: [{ label: 'ยกเลิก' }, { label: 'ใช้ผังนี้', kind: 'primary', keep: true, onClick: function (close, m) {
          U.$$('[data-ui]', b).forEach(function (inp) { var i = +inp.getAttribute('data-ui'), nv = inp.value.trim(), ov = names[i]; if (nv && nv !== ov) { M.units[i][0] = nv; M.rows.forEach(function (r) { if (r.unit === ov) { r.unit = nv; if (r.zone === ov) r.zone = nv; } }); M.units[i][1] = M.units[i][1].map(function (z) { return z === ov ? nv : z; }); } });
          UI.busyBtn(U.$('footer .primary', m), api('importClinicMap', { rows: M.rows, units: M.units }), 'กำลังบันทึกผัง…').then(function (r) {
            applyBoot({ clinics: r.clinics, settings: r.settings }); close(); tClinics();
            UI.toast('ใช้ผังใหม่แล้ว · ในผัง ' + r.n.total + ' · แก้ ' + r.n.upd + ' · ไม่นับ ' + r.n.off + ' คลินิก', 'ok', 6000);
          }).catch(function (e) { UI.toast(e.message, 'bad'); });
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
      var sdim = x.scope && x.scope[0] ? x.scope[0].dim : 'unit';
      var bodyEl = U.el('<div class="uform"><label>รหัสเจ้าหน้าที่ 7 หลัก<input id="uE" inputmode="numeric" maxlength="7" value="' + U.esc(x.emp) + '"' + (u ? ' disabled' : '') + '></label><label>ชื่อ-สกุล<input id="uN" value="' + U.esc(x.name) + '"></label><label>หมายเหตุ/ตำแหน่ง<input id="uNo" value="' + U.esc(x.note || '') + '"></label>' +
        '<label>บทบาท<select id="uR"><option value="viewer"' + (x.role !== 'admin' ? ' selected' : '') + '>ผู้ใช้งาน (ดูรายงาน)</option><option value="admin"' + (x.role === 'admin' ? ' selected' : '') + '>ผู้ดูแลระบบ</option></select></label>' +
        '<fieldset id="uScope"><legend>เห็นข้อมูล</legend><label class="ck"><input type="radio" name="sc" value="all"' + (!x.scope.length ? ' checked' : '') + '>ทุกหน่วยงาน ทั้งโรงพยาบาล (ผู้บริหาร)</label><label class="ck"><input type="radio" name="sc" value="some"' + (x.scope.length ? ' checked' : '') + '>เฉพาะหน่วยงาน/โซนที่เลือก (หัวหน้าหอ · กรอก "ขึ้นงานจริง" ของหน่วยงานตัวเองได้)</label>' +
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

  /* ---------------- ข้อมูลและการดึง (ล้าง/ดึงใหม่ · สถานะรายวัน · ตรวจเทียบ HIS) ---------------- */
  function tFetch() {
    var s = S.boot.settings, st = A.status || {}, t = nowBkk().iso;
    var calYm = t.slice(0, 7), DS = null;
    body.innerHTML = '<div class="ad-head"><div><h2>ข้อมูลและการดึงจาก HIS</h2><p class="muted">หลังบ้านดึงยอดวันนี้ให้อัตโนมัติตามรอบ (ไม่ต้องเปิดหน้าเว็บค้าง) · กลางคืนตรวจซ้ำย้อนหลัง · ถ้ายอดย้อนหลังไม่ตรง ใช้ "ล้างและดึงใหม่" ด้านล่าง</p></div><div class="ad-act"><button class="btn primary" id="fNow">' + ICON.refresh + '<span>ดึงวันนี้ตอนนี้</span></button></div></div>' +
      '<section class="card"><header class="ch"><div><h2>① ตรวจยอดเทียบ HIS' + UI.info('chk') + '</h2><p class="sub">ดึงจาก API ของไอทีตอนนี้ แล้วเทียบกับยอดที่ระบบเก็บไว้ทีละคลินิก · ใส่รหัสคลินิกเพื่อตรวจคลินิกเดียว (เร็วกว่า)</p></div></header><div class="cbody form2">' +
      '<label>วันที่<input type="date" id="kD" value="' + U.addDays(t, -1) + '" max="' + t + '"></label><label>รหัสคลินิก (ไม่ใส่ = ทุกคลินิก)<input id="kC" placeholder="เช่น CARROT" style="text-transform:uppercase"></label><button class="btn primary" id="kGo">ตรวจเทียบ</button></div><div id="kOut"></div></section>' +
      '<section class="card"><header class="ch"><div><h2>② ล้างและดึงข้อมูลใหม่' + UI.info('reset') + '</h2><p class="sub">ใช้เมื่อไอทีแก้ API แล้วยอดย้อนหลังในระบบไม่ตรง · ทำงานเบื้องหลังทีละวัน (ประมาณ 25 วันต่อ 5 นาที) ปิดหน้าเว็บได้</p></div></header><div class="cbody">' +
      '<div class="form2"><label>ตั้งแต่<input type="date" id="rF" value="' + (s.backfillFrom || '2023-10-01') + '" min="2019-10-01" max="' + t + '"></label><label>ถึง<input type="date" id="rT" value="' + t + '" max="' + t + '"></label>' +
      '<div class="quick">' + [['7 วัน', 6], ['30 วัน', 29], ['ตั้งแต่ 1 ต.ค. 69', '2025-10-01'], ['ทั้งหมด', s.backfillFrom || '2023-10-01']].map(function (x) { return '<button type="button" data-rq="' + x[1] + '">' + x[0] + '</button>'; }).join('') + '</div></div>' +
      '<div class="opts mt"><label class="opt"><input type="radio" name="rW" value="0" checked><span><b>ดึงทับ (แนะนำ)</b> · ระหว่างดึง หน้าจอยังแสดงยอดเดิม แล้วค่อยเปลี่ยนเป็นยอดใหม่ทีละวัน</span></label><label class="opt"><input type="radio" name="rW" value="1"><span><b>ลบยอดเดิมก่อน</b> · ช่วงที่เลือกจะว่างจนกว่าจะดึงถึง (ใช้เมื่อยอดเดิมผิดมาก ไม่อยากให้ใครเห็น)</span></label></div>' +
      '<div class="ad-act left"><button class="btn danger" id="rGo">' + ICON.refresh + '<span>ล้างและดึงใหม่</span></button><button class="btn" id="bRun">ดึงต่อทันที (≈1 นาที)</button><button class="btn ghost" id="bStop">หยุดคิว</button></div><div class="prog" id="bProg"></div></div></section>' +
      '<section class="card"><header class="ch"><div><h2>③ สถานะข้อมูลรายวัน' + UI.info('daystat') + '</h2><p class="sub" id="dsSub">วันไหนดึงแล้ว ดึงเมื่อไร ยอดเท่าไร</p></div><div class="ctools"><button class="icon-btn" id="dsP" aria-label="เดือนก่อน">' + ICON.chevL + '</button><b id="dsL"></b><button class="icon-btn" id="dsN" aria-label="เดือนถัดไป">' + ICON.chevR + '</button></div></header><div class="cbody"><div id="dsCal" class="dcal"></div>' +
      '<p class="legend-line"><span class="dk ok">✓ ดึงแล้ว (หลังล้างล่าสุด)</span><span class="dk old">⟳ ยอดก่อนล้าง รอดึงใหม่</span><span class="dk none">✕ ยังไม่มีข้อมูล</span><span class="dk zero">0 ไม่มีผู้ป่วย</span></p></div></section>' +
      '<div class="grid g2"><section class="card"><header class="ch"><h2>ตั้งเวลาดึงอัตโนมัติ</h2></header><div class="cbody form2">' +
      '<label>ดึงทุก<select id="sEv">' + [5, 10, 15, 30, 60].map(function (m) { return '<option value="' + m + '"' + (+s.fetchEvery === m ? ' selected' : '') + '>' + m + ' นาที</option>'; }).join('') + '</select></label>' +
      '<label>ตั้งแต่<input type="time" id="sFr" value="' + s.fetchFrom + '"></label><label>ถึง<input type="time" id="sTo" value="' + s.fetchTo + '"></label>' +
      '<label>ตรวจซ้ำกลางคืน<select id="sNi">' + [0, 1, 2, 3, 4].map(function (h) { return '<option value="' + h + '"' + (+s.nightlyAt === h ? ' selected' : '') + '>0' + h + ':00 น.</option>'; }).join('') + '</select></label>' +
      '<label>ตรวจซ้ำย้อนหลัง<select id="sRe">' + [1, 3, 7, 14].map(function (d) { return '<option value="' + d + '"' + (+s.recheckDays === d ? ' selected' : '') + '>' + d + ' วัน</option>'; }).join('') + '</select></label>' +
      '<label>กราฟตามเวลา ช่องละ<select id="sRes">' + [[60, '1 ชั่วโมง (แนะนำตอนนี้)'], [30, '30 นาที'], [15, '15 นาที']].map(function (o) { return '<option value="' + o[0] + '"' + (TR.res() === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn primary" id="sSave">บันทึก</button><p class="muted xs">ยิ่งถี่ยิ่งสด แต่เพิ่มภาระ API ของไอที · แนะนำ 30 นาที · กราฟตามเวลาใช้ 1 ชั่วโมงจนกว่าไอทีจะส่ง "เวลามาถึงจริง" ของผู้ป่วยนัด (ตอนนี้เป็นเวลานัด)</p></div></section>' +
      '<section class="card"><header class="ch"><h2>สถานะ</h2></header><div class="cbody stat-list"><p>ดึงล่าสุด <b>' + U.esc(st.lastFetchAt || '–') + '</b></p><p>รอบถัดไป <b>' + U.esc(st.nextFetchAt || 'พรุ่งนี้ ' + s.fetchFrom) + '</b></p><p>โหมดข้อมูล <b>' + (st.apiMode === 'mock' ? 'ข้อมูลจำลอง (ยังไม่เชื่อม HIS)' : 'HIS จริง') + '</b></p><p>ข้อมูลเริ่มตั้งแต่ <b>' + U.thDate(st.firstDate || D.firstDate(), { full: true }) + '</b></p>' + (st.apptTime ? '<p class="warn-line">เวลาของผู้ป่วยนัดจาก HIS = เวลานัด (:00/:30) ไม่ใช่เวลามาถึงจริง</p>' : '') + (st.lastError ? '<p class="err">ผิดพลาดล่าสุด: ' + U.esc(st.lastError) + '</p>' : '') + '</div></section></div>' +
      '<section class="card"><header class="ch"><h2>ประวัติการดึง (100 ครั้งล่าสุด)</h2></header><div class="cbody"><div class="tscroll"><table class="tbl"><thead><tr><th>เวลา</th><th>แบบ</th><th>วันที่ข้อมูล</th><th class="num">แถวจาก API</th><th class="num">ผู้ป่วย</th><th class="num">ใช้เวลา</th><th>ผล</th></tr></thead><tbody>' +
      (A.log || []).map(function (l) { return '<tr><td class="small">' + U.esc(l.at) + '</td><td>' + U.esc(l.kind) + '</td><td>' + U.esc(l.date) + '</td><td class="num">' + U.fmt(l.rows) + '</td><td class="num">' + U.fmt(l.total) + '</td><td class="num">' + U.fmt((l.ms || 0) / 1000, 1) + ' วิ</td><td>' + (+l.ok ? '<span class="st good"><i>✓</i>สำเร็จ</span>' : '<span class="st critical"><i>!</i>' + U.esc(l.msg) + '</span>') + '</td></tr>'; }).join('') + '</tbody></table></div></div></section>';

    U.$('#fNow').onclick = function () { UI.busyBtn(this, SYNC.now(), 'กำลังดึงจาก HIS…').then(function () { return api('getAdmin', {}).then(function (r) { A = r; if (tab === 'fetch') tFetch(); }); }); };
    U.$('#sSave').onclick = function () { var b = this; UI.busyBtn(b, saveSet({ fetchEvery: +U.$('#sEv').value, fetchFrom: U.$('#sFr').value, fetchTo: U.$('#sTo').value, nightlyAt: +U.$('#sNi').value, recheckDays: +U.$('#sRe').value, timeRes: +U.$('#sRes').value }, 'บันทึกแล้ว · เวลาดึงมีผลรอบถัดไป · กราฟตามเวลาใช้ความละเอียดใหม่ทันที'), 'กำลังบันทึก…').catch(function () { }); };

    /* ① ตรวจเทียบ */
    var showChk = function (r, el) {
      if (!r.ok) { el.innerHTML = '<p class="err">' + U.esc(r.reason || 'ดึงไม่สำเร็จ') + '</p>'; return; }
      var diff = r.rows.filter(function (x) { return x.api !== x.stored; });
      el.innerHTML = '<div class="kpis sm">' + kpi({ label: 'HIS ตอนนี้', value: r.apiTotal, unit: 'ราย' }) + kpi({ label: 'ในระบบ', value: r.storedTotal, unit: 'ราย', sub: r.storedAt ? 'ดึงเมื่อ ' + U.esc(r.storedAt) : 'ยังไม่มีข้อมูลวันนี้' }) +
        kpi({ label: 'ผลต่าง', value: (r.storedTotal - r.apiTotal > 0 ? '+' : '') + U.fmt(r.storedTotal - r.apiTotal), cls: r.storedTotal === r.apiTotal ? 'good' : 'hot', sub: diff.length ? diff.length + ' คลินิกไม่ตรง' : 'ตรงทุกคลินิก ✓' }) +
        kpi({ label: 'จาก API', value: U.fmt(r.raw) + ' แถว', sub: 'ตัดยกเลิก ' + r.cancelled + ' · ตัด VN ซ้ำ ' + r.dup + ' · ' + U.fmt(r.ms / 1000, 1) + ' วิ' }) + '</div>' +
        (r.apptTime ? '<p class="warn-line">เวลาของผู้ป่วยนัดเป็น :00/:30 = เวลานัด (ไม่ใช่เวลามาถึงจริง) · ยอดรวมถูกต้อง แต่กราฟตามเวลาเป็นค่าประมาณ</p>' : '') +
        (diff.length && !r.clinic ? '<div class="ad-act left"><button class="btn primary" id="kFix">' + ICON.check + '<span>เก็บยอดจาก HIS แทนของเดิม (วันที่ ' + U.thDate(r.date) + ')</span></button><span class="muted small">แก้เฉพาะวันนี้ทันที · ถ้าหลายวันใช้ ② ล้างและดึงใหม่</span></div>' : '') +
        '<div class="tscroll"><table class="tbl"><thead><tr><th>รหัส</th><th>คลินิก</th><th>หน่วยงาน</th><th class="num">HIS</th><th class="num">ในระบบ</th><th class="num">ต่าง</th><th class="num">นัด (HIS)</th><th class="num">walk-in (HIS)</th></tr></thead><tbody>' +
        r.rows.map(function (x) { var d = x.stored - x.api; return '<tr class="' + (d ? 'bad-row' : '') + '"><td class="code">' + U.esc(x.code) + '</td><td>' + U.esc(x.name) + '</td><td class="small">' + (x.mapped ? U.esc(D.shortLabel('unit', x.unit)) : '<span class="st warning"><i>!</i>ยังไม่จัดกลุ่ม</span>') + '</td><td class="num">' + U.fmt(x.api) + '</td><td class="num">' + U.fmt(x.stored) + '</td><td class="num">' + (d ? '<b class="gap ' + (d > 0 ? 'pos' : 'neg') + '">' + (d > 0 ? '+' : '−') + U.fmt(Math.abs(d)) + '</b>' : '<span class="muted">✓</span>') + '</td><td class="num">' + U.fmt(x.apiA) + '</td><td class="num">' + U.fmt(x.apiW) + '</td></tr>'; }).join('') + '</tbody></table></div>';
      var fx = U.$('#kFix', el); if (fx) fx.onclick = function () { UI.busyBtn(fx, api('checkHis', { date: r.date, fix: true }), 'กำลังเก็บยอดใหม่…').then(function (r2) { D.LM = {}; showChk(r2, el); UI.toast('เก็บยอดจาก HIS ของวันที่ ' + U.thDate(r.date) + ' แล้ว · ทุกเครื่องจะโหลดใหม่เอง', 'ok'); loadDays(); }).catch(function (e) { UI.toast(e.message, 'bad'); }); };
    };
    U.$('#kGo').onclick = function () { var el = U.$('#kOut'), d = U.$('#kD').value, c = U.$('#kC').value.trim().toUpperCase(); el.innerHTML = '<p class="muted"><i class="spin-i"></i> กำลังดึงจาก HIS… (ทั้งวันใช้ประมาณ 10–40 วินาที)</p>'; UI.busyBtn(this, api('checkHis', { date: d, clinic: c }), 'กำลังตรวจ…').then(function (r) { showChk(r, el); }).catch(function (e) { el.innerHTML = '<p class="err">' + U.esc(e.message) + '</p>'; }); };

    /* ② ล้างและดึงใหม่ */
    U.$$('[data-rq]', body).forEach(function (b) { b.onclick = function () { var v = b.getAttribute('data-rq'); U.$('#rF').value = /^\d+$/.test(v) ? U.addDays(t, -(+v)) : v; U.$('#rT').value = t; }; });
    var pBf = function (bf) {
      var el = U.$('#bProg'); if (!el) return; if (!bf) { el.innerHTML = '<span class="muted">ไม่มีคิวค้าง</span>'; return; }
      var pc = bf.total ? bf.done / bf.total : 0, left = Math.max(0, bf.total - bf.done);
      el.innerHTML = '<div class="bar"><i style="width:' + (pc * 100).toFixed(1) + '%"></i></div><span><b>' + ({ running: 'กำลังดึง', done: 'เสร็จแล้ว ✓', stopped: 'หยุดแล้ว' })[bf.state] + '</b> ' + U.fmt(bf.done) + '/' + U.fmt(bf.total) + ' วัน (' + U.thDate(bf.from) + ' – ' + U.thDate(bf.to) + ')' +
        (bf.state === 'running' ? ' · เหลือ ≈ ' + (left > 25 ? Math.ceil(left / 25 * 5) + ' นาที (ทำงานเองทุก 5 นาที)' : 'ไม่ถึง 5 นาที') + (bf.cur ? ' · ถึงวันที่ ' + U.thDate(bf.cur) : '') : '') + (bf.err ? '<br><span class="err small">ล่าสุด: ' + U.esc(bf.err) + '</span>' : '') + '</span>';
    };
    pBf(A.bf);
    var poll = function () { if (tab !== 'fetch' || !U.$('#bProg')) return; api('getBackfill', {}, { bg: true }).then(function (r) { A.bf = r.bf; pBf(r.bf); if (r.bf && r.bf.state === 'running') setTimeout(poll, 8000); else loadDays(); }); };
    if (A.bf && A.bf.state === 'running') setTimeout(poll, 3000);
    U.$('#rGo').onclick = function () {
      var f = U.$('#rF').value, to = U.$('#rT').value, wipe = U.$('input[name=rW]:checked').value === '1', btn = this;
      if (!f || !to || f > to) return UI.toast('ช่วงวันที่ไม่ถูกต้อง', 'warn');
      var n = U.diff(f, to) + 1;
      UI.confirm('ล้างและดึงข้อมูลใหม่ ' + U.fmt(n) + ' วัน', 'ช่วง <b>' + U.thDate(f, { full: true }) + ' – ' + U.thDate(to, { full: true }) + '</b><br>' + (wipe ? '⚠ <b>ลบยอดเดิมก่อน</b> — หน้าจอของช่วงนี้จะว่างจนกว่าจะดึงถึง' : 'ดึงทับทีละวัน ระหว่างดึงยังเห็นยอดเดิม') + '<br>ใช้เวลาประมาณ ' + (n > 25 ? Math.ceil(n / 25 * 5) + ' นาที' : 'ไม่ถึง 5 นาที') + ' (ทำงานเบื้องหลัง ปิดหน้าเว็บได้) · ทุกเครื่องจะล้างแคชและโหลดยอดใหม่เอง', 'เริ่มล้างและดึงใหม่', true).then(function (y) {
        if (!y) return;
        UI.busyBtn(btn, api('resetData', { from: f, to: to, wipe: wipe }), 'กำลังตั้งคิว…').then(function (r) { A.bf = r.bf; pBf(r.bf); if (r.status) SYNC.set(r.status); D.LM = {}; IDB.clear(); UI.toast('เริ่มล้างและดึงใหม่แล้ว · กด "ดึงต่อทันที" เพื่อเร่ง หรือรอระบบทำเองทุก 5 นาที', 'ok', 6000); setTimeout(poll, 3000); loadDays(); }).catch(function (e) { UI.toast(e.message, 'bad'); });
      });
    };
    U.$('#bRun').onclick = function () { UI.busyBtn(this, api('runBackfillNow', {}), 'กำลังดึง (ไม่เกิน 1 นาที)…').then(function (r) { A.bf = r.bf; pBf(r.bf); if (r.status) SYNC.set(r.status); loadDays(); UI.toast(r.bf && r.bf.state === 'done' ? 'ดึงครบแล้ว ✓' : 'ดึงต่อแล้ว ' + U.fmt(r.bf ? r.bf.done : 0) + ' วัน', 'ok'); }).catch(function (e) { UI.toast(e.message, 'bad'); }); };
    U.$('#bStop').onclick = function () { UI.busyBtn(this, api('stopBackfill', {}), 'กำลังหยุด…').then(function (r) { A.bf = r.bf; pBf(r.bf); }); };

    /* ③ สถานะรายวัน (ปฏิทิน) */
    function loadDays() {
      var from = calYm + '-01', to = U.lastDay(calYm);
      U.$('#dsL').textContent = U.thMonth(calYm, true);
      U.$('#dsCal').innerHTML = '<p class="muted"><i class="spin-i"></i> กำลังโหลด…</p>';
      api('getDayStatus', { from: from, to: to }).then(function (r) { DS = r; paintCal(r, from, to); }).catch(function (e) { U.$('#dsCal').innerHTML = '<p class="err">' + U.esc(e.message) + '</p>'; });
    }
    function paintCal(r, from, to) {
      var rs = r.reset, t2 = nowBkk().iso, first = U.dow(from), cells = '', nOk = 0, nOld = 0, nNone = 0;
      ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'].forEach(function (d) { cells += '<b class="dh">' + d + '</b>'; });
      for (var k = 0; k < (first + 6) % 7; k++) cells += '<i></i>';
      U.dates(from, to).forEach(function (d) {
        var x = r.days[d], cls, txt, tip;
        if (d > t2) { cls = 'fut'; txt = ''; tip = 'ยังไม่ถึง'; }
        else if (!x) { cls = 'none'; txt = '✕'; tip = 'ยังไม่มีข้อมูล'; nNone++; }
        else {
          var old = !!(rs && d >= rs.from && d <= rs.to && x[1] && x[1] < rs.at);
          cls = old ? 'old' : x[0] ? 'ok' : 'zero'; txt = U.fmt(x[0]); tip = 'ยอด ' + U.fmt(x[0]) + ' ราย · ดึงเมื่อ ' + x[1] + (old ? ' (ก่อนล้างล่าสุด รอดึงใหม่)' : '');
          if (old) nOld++; else nOk++;
        }
        cells += '<div class="dc ' + cls + ' dt-' + D.dayType(d) + '" title="' + U.esc(U.thDate(d, { dow: true, full: true }) + ' · ' + tip) + '"><span>' + (+d.slice(8)) + '</span><b>' + txt + '</b>' + (cls === 'old' ? '<em>⟳</em>' : cls === 'ok' ? '<em>✓</em>' : '') + '</div>';
      });
      U.$('#dsCal').innerHTML = cells;
      U.$('#dsSub').innerHTML = '✓ ' + nOk + ' วัน · ⟳ รอดึงใหม่ ' + nOld + ' วัน · ✕ ไม่มีข้อมูล ' + nNone + ' วัน' + (rs ? ' · ล้างล่าสุด ' + U.esc(rs.at) + ' (' + U.thDate(rs.from) + ' – ' + U.thDate(rs.to) + ')' : '');
    }
    U.$('#dsP').onclick = function () { calYm = U.ymAdd(calYm, -1); loadDays(); };
    U.$('#dsN').onclick = function () { if (calYm >= t.slice(0, 7)) return; calYm = U.ymAdd(calYm, 1); loadDays(); };
    loadDays();
  }

  /* ---------------- เชื่อมต่อ API ---------------- */
  function tApi() {
    var a = JSON.parse(JSON.stringify(S.boot.settings.api || {})), mp = a.map || {};
    var F = [['time', 'เวลา visit (YYYYMMDDHHMMSS)'], ['arrive', 'เวลามาถึงจริง ถ้าไอทีเพิ่ม (ARRIVE_TIME/VISIT_TIME)'], ['vn', 'เลข visit ใช้ตัดซ้ำ (VN)'], ['clinic', 'คลินิก "รหัส:ชื่อ" (CLINIC)'], ['pt', 'สิทธิหลัก (PTTYPE_MAIN)'], ['kind', 'นัด "X" (CHECK_APPOINT)'], ['walk', 'walk-in "X" (CHECK_WALKIN)'], ['cancel', 'ยกเลิกโดย (CANCEL_BY)'], ['count', 'จำนวน ถ้าเป็นยอดรวม (TOTAL_HN)'], ['visit', 'ยอดทั้งหมด แบบเดิม (total_visit)'], ['appoint', 'ยอดนัด แบบเดิม (total_appoint)'], ['walkin', 'ยอด walk-in แบบเดิม (total_walkin)']];
    body.innerHTML = '<div class="ad-head"><div><h2>เชื่อมต่อ API ของฝ่ายไอที</h2><p class="muted">พอไอทีส่ง API มา ใส่ที่อยู่และชื่อฟิลด์ที่นี่ได้เลย ไม่ต้องแก้โค้ด · token เก็บใน Apps Script › Project Settings › Script Properties ชื่อ <code>HIS_API_TOKEN</code> เท่านั้น (ห้ามใส่ในหน้าเว็บ/GitHub)</p></div></div>' +
      '<div class="grid g2"><section class="card"><header class="ch"><h2>ที่อยู่และรูปแบบ</h2></header><div class="cbody form1">' +
      '<label>โหมด<select id="aM"><option value="mock"' + (a.mode === 'mock' ? ' selected' : '') + '>ข้อมูลจำลอง (ระหว่างรอไอที)</option><option value="live"' + (a.mode === 'live' ? ' selected' : '') + '>HIS จริง</option></select></label>' +
      '<label>ที่อยู่ API<input id="aU" value="' + U.esc(a.url || '') + '" placeholder="https://www.thaimed.net/api/new/"></label>' +
      '<label>ชื่อ report<input id="aR" value="' + U.esc(a.report || '') + '" placeholder="รอไอทีแจ้ง"></label>' +
      '<label>วิธีส่งวันที่<select id="aP"><option value="new"' + (a.style !== 'get' ? ' selected' : '') + '>POST JSON + Bearer token (/api/new/)</option><option value="get"' + (a.style === 'get' ? ' selected' : '') + '>GET ?report=…&search_st=yyyymmdd</option></select></label>' +
      '</div></section><section class="card"><header class="ch"><div><h2>ชื่อฟิลด์ในคำตอบ</h2><p class="sub">เว้นว่างได้ ระบบหาจากชื่อในวงเล็บให้เอง · ใส่เฉพาะเมื่อไอทีเปลี่ยนชื่อฟิลด์</p></div></header><div class="cbody form1">' + F.map(function (f) { return '<label>' + f[1] + '<input data-m="' + f[0] + '" value="' + U.esc(mp[f[0]] || '') + '" placeholder="อัตโนมัติ"></label>'; }).join('') + '</div></section></div>' +
      '<div class="ad-act left"><button class="btn primary" id="aSave">บันทึก</button><input type="date" id="aD" value="' + U.addDays(nowBkk().iso, -1) + '"><button class="btn" id="aTest">ทดสอบดึงจาก HIS จริง</button><span class="muted small">ทดสอบกับ API จริงเสมอ แม้ยังอยู่โหมดจำลอง · อาจใช้เวลาถึง 1 นาที</span></div><div id="aOut"></div>';
    U.$('#aSave').onclick = function () { a.mode = U.$('#aM').value; a.url = U.$('#aU').value.trim(); a.report = U.$('#aR').value.trim(); a.style = U.$('#aP').value; a.map = {}; U.$$('[data-m]', body).forEach(function (i) { a.map[i.getAttribute('data-m')] = i.value.trim(); }); UI.busyBtn(this, saveSet({ api: a }, 'บันทึกการเชื่อมต่อแล้ว'), 'กำลังบันทึก…').catch(function () { }); };
    U.$('#aTest').onclick = function () {
      U.$('#aOut').innerHTML = '<p class="muted"><i class="spin-i"></i> กำลังเรียก API ของไอที… (รอได้ถึงประมาณ 1 นาที)</p>';
      UI.busyBtn(this, api('testApi', { date: U.$('#aD').value }), 'กำลังทดสอบ…').then(function (r) {
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

/* =====================================================================
   อ่านไฟล์ผังคลินิก (Excel) → {rows:[{code,name,type,bld,floor,grp,unit,zone}], units:[[หน่วยงาน,[โซน]]], notes, file}
   รองรับ 2 แบบ
    ก. แบบที่ประชุมทำ (จัดกลุ่มคลินิกOPD 23-10-2569.xlsx): คอลัมน์ A = หอผู้ป่วย/หน่วยงาน (หัวบล็อก) · B = โซน · C รหัส · D ชื่อ · E ประเภท · F ตึก · G ชั้น · H กลุ่มสถิติ
    ข. แบบที่ดาวน์โหลดจากระบบ: หัวคอลัมน์ หน่วยงาน · โซน · รหัสคลินิก · ชื่อคลินิก · ประเภทคลินิก · ตึก_อาคาร · ชั้น · กลุ่มคลินิกในรายงานสถิติ
   ===================================================================== */
var MAPIO = {
  read: function (file) {
    return new Promise(function (res, rej) {
      if (!window.XLSX) return rej(new Error('ยังโหลดตัวอ่าน Excel ไม่เสร็จ ลองอีกครั้งใน 2–3 วินาที'));
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var wb = XLSX.read(new Uint8Array(fr.result), { type: 'array' }), best = null;
          wb.SheetNames.forEach(function (n) { var a = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: false }); var M = MAPIO.parse(a); if (!best || M.rows.length > best.rows.length) best = M; });
          if (!best || best.rows.length < 5) throw new Error('อ่านไฟล์ไม่ได้ หรือพบคลินิกน้อยเกินไป · ต้องมีคอลัมน์ รหัสคลินิก และหน่วยงาน/โซน (ดูตัวอย่างจากปุ่ม "ดาวน์โหลดผัง")');
          best.file = file.name; res(best);
        } catch (e) { rej(e); }
      };
      fr.onerror = function () { rej(new Error('เปิดไฟล์ไม่สำเร็จ')); };
      fr.readAsArrayBuffer(file);
    });
  },
  /** ชื่อหน่วยงานให้สม่ำเสมอ (แก้คำพิมพ์ผิดที่พบบ่อย) */
  unitName: function (u) {
    var s = String(u || '').replace(/\s+/g, ' ').trim();
    if (/OPD ?1/.test(s) && /อายุร/.test(s)) return 'หอผู้ป่วยคลินิกอายุรกรรม (OPD 1)';
    if (/OPD ?2/.test(s) && /ศัลย/.test(s)) return 'หอผู้ป่วยคลินิกศัลยกรรม (OPD 2)';
    if (/สูติ|นรีเวช|นีเวช/.test(s) && /กุมาร/.test(s)) return 'หอผู้ป่วยคลินิกสูติ-นรีเวชกรรมและกุมารเวชกรรม (OPD 3)';
    if (/เวช\s?ปฏิบัติ|เวชปฎิบัติ/.test(s)) return 'หอผู้ป่วยคลินิกเวชปฏิบัติ (OPD 4)';
    return s;
  },
  parse: function (a) {
    var cell = function (r, i) { return String(r[i] == null ? '' : r[i]).replace(/\s+/g, ' ').trim(); };
    var rows = [], notes = [], seen = {}, units = [], um = {};
    var addU = function (u, z) { if (!um[u]) { um[u] = []; units.push([u, um[u]]); } if (z && um[u].indexOf(z) < 0) um[u].push(z); };
    var fixZone = function (z) { return z.replace('อายุุรกรรม', 'อายุรกรรม').replace(/ชั้น(\d)/, 'ชั้น $1').replace(/^เวชปฎิบัติ/, 'เวชปฏิบัติ').replace(/^คลินิก โสต/, 'คลินิกโสต').replace(/^ชั้น ?2$/, 'โครงการ ชั้น 2'); };
    // แบบ ข.
    var h = -1, hi = {};
    for (var i = 0; i < Math.min(a.length, 10); i++) { var r0 = a[i].map(function (x) { return String(x).trim(); }); if (r0.indexOf('หน่วยงาน') >= 0 && r0.indexOf('รหัสคลินิก') >= 0) { h = i; r0.forEach(function (x, j) { hi[x] = j; }); break; } }
    if (h >= 0) {
      a.slice(h + 1).forEach(function (r) {
        var code = cell(r, hi['รหัสคลินิก']); if (!code || seen[code]) { if (code) notes.push('รหัสซ้ำ ' + code); return; }
        var u = cell(r, hi['หน่วยงาน']); if (!u) return;
        seen[code] = 1; var z = cell(r, hi['โซน']) || u;
        rows.push({ code: code, name: cell(r, hi['ชื่อคลินิก']), type: cell(r, hi['ประเภทคลินิก']), bld: cell(r, hi['ตึก_อาคาร']), floor: cell(r, hi['ชั้น']).replace(/\s/g, ''), grp: cell(r, hi['กลุ่มคลินิกในรายงานสถิติ']), unit: u, zone: z });
        addU(u, z);
      });
      return { rows: rows, units: units, notes: notes };
    }
    // แบบ ก.
    var raw = '', unit = '', zone = '';
    a.forEach(function (r) {
      var A = cell(r, 0), B = cell(r, 1), C = cell(r, 2);
      if (!A && !B && !C && !cell(r, 3)) return;
      if (C === 'รหัสคลินิก') { raw = A; unit = MAPIO.unitName(A); zone = B ? fixZone(B) : unit; return; }
      if (!C) { if (A && !B) { raw += ' ' + A; var nu = MAPIO.unitName(raw); if (zone === unit) zone = nu; unit = nu; } if (B) zone = fixZone(B); return; }
      if (A) { raw = A; unit = MAPIO.unitName(A); zone = B ? fixZone(B) : unit; } else if (B) zone = fixZone(B);
      if (!unit) return;
      if (seen[C]) { notes.push('รหัสซ้ำ ' + C + ' (ใช้แถวแรก)'); return; }
      seen[C] = 1;
      rows.push({ code: C, name: cell(r, 3), type: cell(r, 4).replace('ทังใน', 'ทั้งใน'), bld: cell(r, 5), floor: cell(r, 6).replace(/\s/g, ''), grp: cell(r, 7), unit: unit, zone: zone });
      addU(unit, zone);
    });
    // ลำดับหน่วยงาน: OPD 1–4 ก่อน แล้วตามลำดับในไฟล์
    units.sort(function (x, y) { var a1 = (x[0].match(/OPD (\d)/) || [0, 9])[1], b1 = (y[0].match(/OPD (\d)/) || [0, 9])[1]; return a1 - b1; });
    return { rows: rows, units: units, notes: notes };
  }
};
