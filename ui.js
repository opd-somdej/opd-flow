/* =====================================================================
   ui.js — ชิ้นส่วนที่ใช้ร่วมกันทุกหน้า
   ตัวกรอง (ใช้ร่วมทุกหน้า) · ตัวเลขสรุป · แถบเวลาวันนี้ (ribbon) · การแจ้งเตือนความหนาแน่น · ทัวร์แนะนำ
   ===================================================================== */
'use strict';

/* ---------------- ตัวกรอง (ทำเป็นขั้น 1-2-3 · 27 ต.ค. 69) ----------------
   ① ช่วงเวลา  ② หน่วยงาน › โซน › คลินิก (ติ๊กเป็นต้นไม้)  ③ รายละเอียด (ใน/นอกเวลา · นัด/walk-in · สิทธิ · ประเภทวัน · ช่วงเวลาที่มาถึง)
   กด "ดูผล" ครั้งเดียว → ทุกหน้าใช้ตัวกรองเดียวกันจนกว่าจะล้าง */
var FUI = {
  /** ปุ่มตัวกรอง + ชิปสรุป · opt.pc = ตัวเลือกช่วงเวลาของหน้า (ให้ขั้นที่ 1 เปลี่ยนช่วงได้) · onChange() เมื่อกดดูผล/ล้าง */
  bar: function (host, onChange, opt) {
    opt = opt || {};
    var box = U.el('<div class="fbar"><button class="btn fbtn" id="fBtn" aria-haspopup="dialog">' + ICON.filter + '<span>ตัวกรอง</span><i class="fn" hidden></i></button><div class="chips" id="fChips"></div></div>');
    host.appendChild(box);
    var self = { opt: opt };
    var paint = function () {
      var d = D.describe(), n = U.$('.fn', box);
      n.hidden = !d.length; n.textContent = d.length;
      U.$('#fBtn', box).classList.toggle('on', !!d.length);
      U.$('#fChips', box).innerHTML = d.length ? d.map(function (x) { return '<span class="chip" title="' + U.esc(x) + '">' + U.esc(x) + '</span>'; }).join('') + '<button class="chip clear" id="fClr" title="ล้างตัวกรองทั้งหมด">' + ICON.x + 'ล้าง</button>' : '<span class="chip muted">' + (D.scopeMask ? 'ทุกคลินิกในหน่วยงานของคุณ' : 'ทุกหน่วยงาน ทั้งโรงพยาบาล') + '</span>';
      var c = U.$('#fClr', box); if (c) c.onclick = function () { var sh = D.filt().showHidden; D.FILT = D.emptyFilt(); D.FILT.showHidden = sh; D.saveFilt(); paint(); onChange(); };
    };
    U.$('#fBtn', box).onclick = function () { FUI.open(function () { paint(); onChange(); }, Object.assign({ pc: self.pc || FUI._pc }, opt)); };
    paint();
    self.paint = paint;
    return self;
  },
  open: function (onApply, opt) {
    opt = opt || {};
    var F = JSON.parse(JSON.stringify(D.filt())), pc = opt.pc || null, P = pc ? JSON.parse(JSON.stringify(pc.get())) : null;
    if (!F.kind) F.kind = 'all';
    var step = pc ? 1 : 2, q = '';
    var body = U.el('<div class="fpanel"><ol class="fsteps" role="tablist"></ol><div class="fstep-body"></div></div>');
    var STEPS = [[1, 'ช่วงเวลา'], [2, 'หน่วยงาน / คลินิก'], [3, 'รายละเอียด']];
    /* ---- ต้นไม้ หน่วยงาน › โซน › คลินิก ---- */
    var visible = D.C.filter(function (c) { return c && (c.show || F.showHidden) && (!D.scopeMask || D.scopeMask[c.i]); });
    var selSet = function () { var s = {}; var cl = F.dims.clinic; if (cl && cl.length) cl.forEach(function (k) { s[k] = 1; }); else visible.forEach(function (c) { s[c.code] = 1; }); return s; };
    var sel = selSet(), allSel = !(F.dims.clinic && F.dims.clinic.length);
    var tree = function () {
      var units = D.values('unit', F.showHidden), out = [];
      units.forEach(function (u) {
        var zs = {}; visible.forEach(function (c) { if (D.val('unit', c.i) === u) { var z = D.val('zone', c.i); (zs[z] = zs[z] || []).push(c); } });
        var zk = Object.keys(zs).sort(function (a, b) { return (D.ZORD[a] != null ? D.ZORD[a] : 1e6) - (D.ZORD[b] != null ? D.ZORD[b] : 1e6) || a.localeCompare(b, 'th'); });
        if (zk.length) out.push({ u: u, zones: zk.map(function (z) { return { z: z, cl: zs[z].sort(function (a, b) { return a.code.localeCompare(b.code); }) }; }) });
      });
      return out;
    };
    var T = tree();
    var st = function (list) { var n = list.filter(function (c) { return sel[c.code]; }).length; return n === 0 ? 'none' : n === list.length ? 'all' : 'some'; };
    var unitCl = function (u) { var o = []; u.zones.forEach(function (z) { o = o.concat(z.cl); }); return o; };
    var match = function (c) { return !q || (c.code + ' ' + c.name + ' ' + (c.zone || '') + ' ' + (c.unit || '')).toLowerCase().indexOf(q) >= 0; };
    function sync() { var n = Object.keys(sel).length; allSel = n >= visible.length; F.dims.clinic = allSel ? [] : Object.keys(sel); }
    function ck(state, attrs, label, cls) { return '<label class="tck ' + (cls || '') + '"><input type="checkbox" ' + attrs + (state === 'all' ? ' checked' : '') + (state === 'some' ? ' data-mixed="1"' : '') + '><span>' + label + '</span></label>'; }
    function paintTree(box) {
      var html = '';
      T.forEach(function (u, ui) {
        var ucl = unitCl(u).filter(match); if (!ucl.length) return;
        var us = st(unitCl(u));
        html += '<details class="tu"' + (q || us === 'some' || T.length === 1 ? ' open' : '') + '><summary>' + ck(us, 'data-u="' + ui + '"', U.esc(D.shortLabel('unit', u.u)), 'lv0') + '<span class="tn-c">' + unitCl(u).filter(function (c) { return sel[c.code]; }).length + '/' + unitCl(u).length + '</span></summary>';
        u.zones.forEach(function (z, zi) {
          var zcl = z.cl.filter(match); if (!zcl.length) return;
          var zst = st(z.cl), zname = z.z === u.u ? 'ทุกคลินิกในหน่วยงานนี้' : z.z;
          html += '<details class="tz"' + (q || zst === 'some' ? ' open' : '') + '><summary>' + ck(zst, 'data-z="' + ui + ':' + zi + '"', U.esc(zname), 'lv1') + '<span class="tn-c">' + z.cl.filter(function (c) { return sel[c.code]; }).length + '/' + z.cl.length + '</span></summary><div class="tcl">' +
            zcl.map(function (c) { return ck(sel[c.code] ? 'all' : 'none', 'data-c="' + U.esc(c.code) + '"', '<b>' + U.esc(c.code) + '</b> ' + U.esc(c.name.replace(/^คลินิก/, '')), 'lv2'); }).join('') + '</div></details>';
        });
        html += '</details>';
      });
      box.innerHTML = html || '<p class="muted">ไม่พบคลินิกที่ค้นหา</p>';
      U.$$('input[data-mixed]', box).forEach(function (x) { x.indeterminate = true; });
    }
    function setList(list, on) { list.forEach(function (c) { if (on) sel[c.code] = 1; else delete sel[c.code]; }); sync(); }
    /* ---- ช่วงเวลา ---- */
    var kinds = (opt.kinds || (pc && pc.kinds) || ['day', 'week', 'month', 'quarter', 'year', 'custom']);
    function stepPeriod() {
      if (!pc) return '<div class="fnote">หน้านี้แสดงยอด <b>วันนี้</b> เสมอ ไม่ต้องเลือกช่วงเวลา · ไปขั้นที่ 2 เพื่อเลือกหน่วยงาน/คลินิก</div>';
      var t = nowBkk().iso, fisc = PER.fiscal();
      return '<div class="fsec"><h4>ดูเป็น</h4><div class="seg wrap big" id="fpK">' + kinds.map(function (k) { return '<button type="button" data-k="' + k + '" class="' + (P.kind === k ? 'on' : '') + '">' + PER.KINDS[k] + '</button>'; }).join('') + '</div></div>' +
        (P.kind !== 'custom' ? '<div class="fsec"><h4>ช่วงที่ดู</h4><div class="fp-nav"><button type="button" class="btn" data-n="-1" aria-label="ก่อนหน้า">' + ICON.chevL + '</button><b class="fp-lbl">' + U.esc(P.label) + '</b><button type="button" class="btn" data-n="1" aria-label="ถัดไป">' + ICON.chevR + '</button></div>' +
          '<div class="quick">' + [['day', 'วันนี้'], ['month', 'เดือนนี้'], ['quarter', 'ไตรมาสนี้'], ['year', fisc ? 'ปีงบประมาณนี้' : 'ปีนี้']].filter(function (x) { return kinds.indexOf(x[0]) >= 0; }).map(function (x) { return '<button type="button" data-q="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div></div>'
          : '<div class="fsec"><h4>เลือกวันที่</h4><div class="fp-custom"><label>ตั้งแต่<input type="date" id="fpF" min="' + D.firstDate() + '" max="' + t + '" value="' + P.from + '"></label><label>ถึง<input type="date" id="fpT" min="' + D.firstDate() + '" max="' + t + '" value="' + (P.to > t ? t : P.to) + '"></label></div>' +
          '<div class="quick">' + [['7 วันล่าสุด', 6], ['30 วันล่าสุด', 29], ['90 วันล่าสุด', 89], ['1 ปีล่าสุด', 364]].map(function (x) { return '<button type="button" data-d="' + x[1] + '">' + x[0] + '</button>'; }).join('') + '</div></div>') +
        ((kinds.indexOf('quarter') >= 0 || kinds.indexOf('year') >= 0) ? '<div class="fsec"><label class="ck"><input type="checkbox" id="fpFy"' + (fisc ? ' checked' : '') + '><span>นับไตรมาส/ปี แบบ<b>ปีงบประมาณ</b> (ต.ค.–ก.ย.) · ไม่ติ๊ก = ปีปฏิทิน (ม.ค.–ธ.ค.)</span></label></div>' : '');
    }
    function bindPeriod(box) {
      if (!pc) return;
      U.$$('[data-k]', box).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-k'); var a = P.to > nowBkk().iso ? nowBkk().iso : P.to; P = k === 'custom' ? PER.custom(P.from < D.firstDate() ? D.firstDate() : P.from, a) : PER.make(k, a); paint(); }; });
      U.$$('[data-n]', box).forEach(function (b) { b.onclick = function () { var np = PER.shift(P, +b.getAttribute('data-n')); if (np.from > nowBkk().iso) return UI.toast('ยังไม่มีข้อมูลของช่วงถัดไป', 'info'); P = np; paint(); }; });
      U.$$('[data-q]', box).forEach(function (b) { b.onclick = function () { P = PER.make(b.getAttribute('data-q'), nowBkk().iso); paint(); }; });
      U.$$('[data-d]', box).forEach(function (b) { b.onclick = function () { var t = nowBkk().iso; P = PER.custom(U.addDays(t, -(+b.getAttribute('data-d'))), t); paint(); }; });
      var f = U.$('#fpF', box), t2 = U.$('#fpT', box);
      if (f) f.onchange = t2.onchange = function () { var a = f.value, b2 = t2.value; if (!a || !b2) return; if (a > b2) { var x = a; a = b2; b2 = x; } P = PER.custom(a, b2); };
      var fy = U.$('#fpFy', box); if (fy) fy.onchange = function () { STORE.set('u:' + S.me.emp + ':fiscal', fy.checked); if (P.kind === 'quarter' || P.kind === 'year') P = PER.make(P.kind, P.to > nowBkk().iso ? nowBkk().iso : P.to, fy.checked); paint(); };
    }
    /* ---- รายละเอียด ---- */
    var otherDims = D.DIMS.filter(function (d) { return ['unit', 'zone', 'clinic', 'type'].indexOf(d.id) < 0; });
    function stepMore() {
      var types = D.values('type', F.showHidden), tsel = F.dims.type || [];
      return '<div class="fsec"><h4>ในเวลา / นอกเวลาราชการ</h4><div class="opts">' + types.map(function (v) { return '<label class="opt"><input type="checkbox" data-ty="' + U.esc(v) + '"' + (!tsel.length || tsel.indexOf(v) >= 0 ? ' checked' : '') + '><span>' + U.esc(v) + '</span></label>'; }).join('') + '</div></div>' +
        '<div class="fsec"><h4>ประเภทผู้ป่วย' + UI.info('appoint') + '</h4><div class="opts">' + [['all', 'ทั้งหมด'], ['a', 'เฉพาะมาตามนัด'], ['w', 'เฉพาะ walk-in']].map(function (k) { return '<label class="opt"><input type="radio" name="fk" value="' + k[0] + '"' + (F.kind === k[0] ? ' checked' : '') + '><span>' + k[1] + '</span></label>'; }).join('') + '</div></div>' +
        '<div class="fsec"><h4>กลุ่มสิทธิการรักษา</h4><div class="opts">' + D.PG.map(function (g) { return '<label class="opt"><input type="checkbox" data-pg="' + g.id + '"' + (!F.ptg.length || F.ptg.indexOf(g.id) >= 0 ? ' checked' : '') + '><span>' + U.esc(g.name) + '</span></label>'; }).join('') + '</div></div>' +
        '<div class="fsec"><h4>ประเภทวัน</h4><div class="opts">' + ['W', 'S', 'H'].map(function (t) { return '<label class="opt"><input type="checkbox" data-dt="' + t + '"' + (F.dts.indexOf(t) >= 0 ? ' checked' : '') + '><span>' + D.DT[t] + '</span></label>'; }).join('') + '</div></div>' +
        '<div class="fsec"><h4>ช่วงเวลาที่มาถึง' + UI.info('hours') + '</h4><div class="opts">' +
        [['ทั้งวัน', null], ['เช้า 06–12 น.', [24, 47]], ['บ่าย 12–16 น.', [48, 63]], ['ในเวลา 06–16 น.', [24, 63]], ['นอกเวลา 16–21 น.', [64, 83]]].map(function (h) { var on = JSON.stringify(F.hours) === JSON.stringify(h[1]); return '<label class="opt"><input type="radio" name="fh" data-h=\'' + JSON.stringify(h[1]) + '\'' + (on ? ' checked' : '') + '><span>' + h[0] + '</span></label>'; }).join('') + '</div></div>' +
        (otherDims.length ? '<details class="fsec fd"><summary><h4>กรองตามมุมอื่น (กลุ่มรายงานสถิติ · ตึก · ชั้น)</h4><span class="muted small">ไม่จำเป็น</span></summary>' + otherDims.map(function (d) {
          var vals = D.values(d.id, F.showHidden), s2 = F.dims[d.id] || [];
          return '<div class="fsub"><b>' + U.esc(d.name) + '</b> <span class="muted xs">' + (s2.length ? 'เลือก ' + s2.length : 'ทั้งหมด') + '</span><div class="flist" data-dim="' + d.id + '">' + vals.map(function (v) { return '<label class="ck"><input type="checkbox" value="' + U.esc(v) + '"' + (s2.indexOf(v) >= 0 ? ' checked' : '') + '><span>' + U.esc(D.shortLabel(d.id, v)) + '</span></label>'; }).join('') + '</div></div>';
        }).join('') + '</details>' : '');
    }
    function bindMore(box) {
      var types = D.values('type', F.showHidden);
      U.$$('[data-ty]', box).forEach(function (c) { c.onchange = function () { var on = U.$$('[data-ty]', box).filter(function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-ty'); }); F.dims.type = on.length === types.length ? [] : on; summary(); }; });
      U.$$('input[name=fk]', box).forEach(function (c) { c.onchange = function () { F.kind = c.value; summary(); }; });
      U.$$('[data-pg]', box).forEach(function (c) { c.onchange = function () { var on = U.$$('[data-pg]', box).filter(function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-pg'); }); F.ptg = on.length === D.PG.length ? [] : on; summary(); }; });
      U.$$('[data-dt]', box).forEach(function (c) { c.onchange = function () { F.dts = U.$$('[data-dt]', box).filter(function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-dt'); }); summary(); }; });
      U.$$('input[name=fh]', box).forEach(function (c) { c.onchange = function () { F.hours = JSON.parse(c.getAttribute('data-h')); summary(); }; });
      U.$$('.flist', box).forEach(function (l) { l.onchange = function () { F.dims[l.getAttribute('data-dim')] = U.$$('input', l).filter(function (x) { return x.checked; }).map(function (x) { return x.value; }); summary(); }; });
    }
    /* ---- วาด ---- */
    function summary() {
      var el = U.$('.fsum', body.closest('.modal') || body); if (!el) return;
      var tmp = D.FILT; D.FILT = F; var d = D.describe(); D.FILT = tmp;
      el.innerHTML = (P ? '<b>' + U.esc(P.label) + '</b> · ' : '') + (d.length ? U.esc(d.join(' · ')) : (D.scopeMask ? 'ทุกคลินิกในหน่วยงานของคุณ' : 'ทุกหน่วยงาน ทั้งโรงพยาบาล'));
    }
    function paint() {
      U.$('.fsteps', body).innerHTML = STEPS.map(function (x) { return '<li><button type="button" role="tab" data-st="' + x[0] + '" class="' + (x[0] === step ? 'on' : '') + (x[0] < step ? ' done' : '') + '" aria-selected="' + (x[0] === step) + '"><i>' + x[0] + '</i><span>' + x[1] + '</span></button></li>'; }).join('');
      U.$$('[data-st]', body).forEach(function (b) { b.onclick = function () { step = +b.getAttribute('data-st'); paint(); }; });
      var sb = U.$('.fstep-body', body);
      if (step === 1) { sb.innerHTML = stepPeriod(); bindPeriod(sb); }
      else if (step === 2) {
        sb.innerHTML = '<div class="tree-tools"><label class="srch">' + ICON.search + '<input type="search" id="fq" placeholder="ค้นหาหน่วยงาน โซน รหัสหรือชื่อคลินิก" value="' + U.esc(q) + '"></label>' +
          '<button type="button" class="btn sm" id="tAll">เลือกทั้งหมด</button><button type="button" class="btn sm ghost" id="tNone">ไม่เลือกเลย</button></div>' +
          '<p class="fnote">ติ๊กที่ <b>หน่วยงาน</b> = ทุกคลินิกในหน่วยงาน · กด ▸ เพื่อเปิดดูโซนและคลินิก</p><div class="ttree" id="ttree"></div>' +
          (S.me.role === 'admin' ? '<label class="ck hid-ck"><input type="checkbox" id="fHid"' + (F.showHidden ? ' checked' : '') + '>แสดงคลินิกที่ <b>ยังไม่จัดกลุ่ม</b> ด้วย (ปกติไม่นับในยอด OPD)</label>' : '');
        var tb = U.$('#ttree', sb); paintTree(tb);
        tb.onchange = function (e) {
          var x = e.target, u = x.getAttribute('data-u'), z = x.getAttribute('data-z'), c = x.getAttribute('data-c');
          if (u != null) setList(unitCl(T[+u]), x.checked);
          else if (z != null) { var p2 = z.split(':'); setList(T[+p2[0]].zones[+p2[1]].cl, x.checked); }
          else if (c != null) { if (x.checked) sel[c] = 1; else delete sel[c]; sync(); }
          var open = U.$$('details[open]', tb).map(function (d) { return d.querySelector('input').getAttribute('data-u') || d.querySelector('input').getAttribute('data-z'); });
          paintTree(tb); U.$$('details', tb).forEach(function (d) { var i = d.querySelector('input'); if (open.indexOf(i.getAttribute('data-u') || i.getAttribute('data-z')) >= 0) d.open = true; });
          summary();
        };
        tb.onclick = function (e) { if (e.target.closest('label.tck') && e.target.closest('summary')) { /* ติ๊กโดยไม่พับ/กาง */ if (e.target.tagName !== 'INPUT') { e.preventDefault(); var i = e.target.closest('label').querySelector('input'); i.checked = !i.checked; i.dispatchEvent(new Event('change', { bubbles: true })); } } };
        U.$('#fq', sb).oninput = U.debounce(function () { q = this.value.trim().toLowerCase(); paintTree(tb); }, 150);
        U.$('#tAll', sb).onclick = function () { setList(visible, true); paintTree(tb); summary(); };
        U.$('#tNone', sb).onclick = function () { sel = {}; sync(); paintTree(tb); summary(); };
        var h = U.$('#fHid', sb); if (h) h.onchange = function () { F.showHidden = h.checked; visible = D.C.filter(function (c) { return c && (c.show || F.showHidden) && (!D.scopeMask || D.scopeMask[c.i]); }); T = tree(); if (allSel) { sel = {}; visible.forEach(function (c) { sel[c.code] = 1; }); } sync(); paint(); };
      } else { sb.innerHTML = stepMore(); bindMore(sb); }
      var m = body.closest('.modal');
      if (m) { var bk = U.$('[data-act=back]', m), nx = U.$('[data-act=next]', m); if (bk) bk.hidden = step === 1 || (!pc && step === 2); if (nx) nx.hidden = step === 3; }
      summary();
    }
    var modal = UI.modal({ title: 'ตัวกรอง', sub: 'เลือกทีละขั้น แล้วกด "ดูผล" · ใช้กับทุกหน้าจนกว่าจะล้าง', body: body, wide: true, cls: 'drawer fdrawer', noFocus: true,
      actions: [{ label: 'ล้างทั้งหมด', kind: 'ghost', keep: true, onClick: function () { var sh = F.showHidden; F = D.emptyFilt(); F.showHidden = sh; sel = selSet(); allSel = true; if (pc) P = PER.make('month', nowBkk().iso); paint(); return false; } },
        { label: 'ย้อนกลับ', keep: true, act: 'back', onClick: function () { step = Math.max(1, step - 1); paint(); return false; } },
        { label: 'ถัดไป', keep: true, act: 'next', onClick: function () { step = Math.min(3, step + 1); paint(); return false; } },
        { label: 'ดูผล', kind: 'primary', onClick: function () {
          if (!F.dts.length) { UI.toast('เลือกประเภทวันอย่างน้อย 1 แบบ', 'warn'); return false; }
          if (!allSel && !Object.keys(sel).length) { UI.toast('เลือกหน่วยงานหรือคลินิกอย่างน้อย 1 รายการ', 'warn'); step = 2; paint(); return false; }
          sync(); Object.keys(F.dims).forEach(function (k) { if (!F.dims[k] || !F.dims[k].length) delete F.dims[k]; });
          D.FILT = F; D.saveFilt();
          if (pc && P) pc.set(P, true);
          onApply();
        } }] });
    U.$$('footer .btn', modal.el).forEach(function (b) { if (b.textContent === 'ย้อนกลับ') b.setAttribute('data-act', 'back'); if (b.textContent === 'ถัดไป') b.setAttribute('data-act', 'next'); });
    var foot = U.$('footer', modal.el); foot.insertAdjacentHTML('afterbegin', '<div class="fsum" aria-live="polite"></div>');
    paint();
  },
  /** ตัวเลือก "ดูตาม" (มิติ) */
  dimSelect: function (host, key, def, onChange, extra) {
    var cur = STORE.get('u:' + S.me.emp + ':' + key, def);
    var all = D.DIMS.concat(extra || []);
    if (!all.some(function (d) { return d.id === cur; })) cur = def;
    var el = U.el('<label class="dimsel"><span>ดูตาม</span><select>' + all.map(function (d) { return '<option value="' + d.id + '"' + (d.id === cur ? ' selected' : '') + '>' + U.esc(d.short || d.name) + '</option>'; }).join('') + '</select></label>');
    host.appendChild(el);
    el.querySelector('select').onchange = function () { STORE.set('u:' + S.me.emp + ':' + key, this.value); onChange(this.value); };
    return cur;
  }
};

/* ---------------- ตัวเลขสรุป ---------------- */
function kpi(o) {
  var d = o.delta, dHtml = '';
  if (d != null && isFinite(d)) dHtml = '<span class="delta ' + (Math.abs(d) < 0.005 ? 'flat' : d > 0 ? 'up' : 'down') + '">' + (d > 0.005 ? '▲ เพิ่ม ' : d < -0.005 ? '▼ ลด ' : '■ เท่าเดิม ') + U.pct(Math.abs(d)).replace('+', '') + '</span><span class="dl">' + (o.deltaLabel || '') + '</span>';
  return '<div class="kpi' + (o.cls ? ' ' + o.cls : '') + '"><span class="kl">' + o.label + (o.help ? UI.info(o.help) : '') + '</span>' +
    '<b class="kv" data-count="' + (typeof o.value === 'number' ? o.value : '') + '" data-d="' + (o.d || 0) + '">' + (typeof o.value === 'number' ? U.fmt(o.value, o.d || 0) : o.value) + '</b>' + (o.unit ? '<span class="ku">' + o.unit + '</span>' : '') +
    '<div class="ks">' + dHtml + (o.sub ? '<span class="sub2">' + o.sub + '</span>' : '') + '</div></div>';
}
/** ตัวเลขนับขึ้น (ครั้งแรกที่เปิดหน้า) */
function countUp(root) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  U.$$('[data-count]', root).forEach(function (el) {
    var to = +el.getAttribute('data-count'), dd = +el.getAttribute('data-d') || 0; if (!isFinite(to) || el.getAttribute('data-count') === '') return;
    var t0 = performance.now(), dur = 650;
    (function step(t) { var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = U.fmt(to * e, dd); if (k < 1) requestAnimationFrame(step); })(t0);
  });
}

/* ---------------- แถบเวลาวันนี้ (ลายเซ็นของระบบ) ---------------- */
/**
 * ribbon(el, {act:[96], exp:[96], now: ช่องล่าสุดที่มีข้อมูล, from, to})
 * ช่องละ 15 นาที · สีเข้มตามจำนวนที่มาถึง · ช่องอนาคตแสดงกรอบเส้นตามค่าคาดการณ์ · เข็มบอกเวลาปัจจุบัน
 */
function ribbon(el, o) {
  var from = o.from == null ? 20 : o.from, to = o.to == null ? 87 : o.to, st = o.step || TR.step();
  // รวมช่อง 15 นาทีตามความละเอียดที่ตั้ง (ตั้งต้น 1 ชม.)
  var act = [], exp = [], idx = [], now = null;
  for (var b0 = from; b0 <= to; b0 += st) {
    var av = 0, ev = 0, any = false;
    for (var k = 0; k < st && b0 + k <= to; k++) { if (o.now == null || b0 + k <= o.now) { av += o.act[b0 + k] || 0; any = true; } ev += o.exp ? o.exp[b0 + k] || 0 : 0; }
    act.push(any ? av : null); exp.push(ev); idx.push(b0);
    if (o.now != null && o.now >= b0 && o.now < b0 + st) now = idx.length - 1;
  }
  var max = 1; act.forEach(function (v, i) { max = Math.max(max, v || 0, exp[i] || 0); });
  var lvl = function (v) { if (!v) return 0; return Math.min(9, 1 + Math.floor(8 * Math.sqrt(v / max))); };
  var cells = '', labels = '', n = idx.length, every = st >= 4 ? (n > 14 ? 2 : 1) : Math.max(1, Math.round(4 / st));
  idx.forEach(function (s0, i) {
    var past = act[i] != null, v = act[i], e = o.exp ? Math.round(exp[i]) : null;
    var tipTxt = U.hhmm(s0) + '–' + U.hhmm(Math.min(s0 + st, to + 1)) + ' น. · ' + (past ? 'มาถึง ' + U.fmt(v) + ' ราย' : 'ยังไม่ถึงเวลา') + (e != null ? ' · ปกติ ≈ ' + U.fmt(e) : '');
    cells += '<i class="rc ' + (past ? 'l' + lvl(v) : 'fut f' + lvl(e)) + (i === now ? ' now' : '') + '" data-tip="' + tipTxt + '" style="--h:' + (past ? Math.max(0.06, (v || 0) / max) : Math.max(0.06, (e || 0) / max)) + '">' + (o.vals && past && v ? '<em>' + U.fmt(v) + '</em>' : '') + '</i>';
    if (i % every === 0) labels += '<span style="grid-column:' + (i + 1) + '">' + U.hhmm(s0).slice(0, st >= 4 ? 2 : 5) + '</span>';
  });
  var fromS = from; to = n; from = 0;
  el.innerHTML = '<div class="ribbon' + (st >= 4 ? ' hourly' : '') + '" style="--n:' + n + '"><div class="rcells">' + cells + '</div><div class="rlabels">' + labels + '</div></div>';
  var tipEl = null;
  el.onmousemove = function (ev) {
    var c = ev.target.closest('.rc'); if (!c) { if (tipEl) tipEl.hidden = true; return; }
    if (!tipEl) { tipEl = U.el('<div class="rtip"></div>'); document.body.appendChild(tipEl); }
    tipEl.hidden = false; tipEl.textContent = c.getAttribute('data-tip');
    tipEl.style.left = Math.min(innerWidth - tipEl.offsetWidth - 8, ev.clientX + 12) + 'px'; tipEl.style.top = (ev.clientY - 40) + 'px';
  };
  el.onmouseleave = function () { if (tipEl) tipEl.hidden = true; };
  var obs = new MutationObserver(function () { if (!document.body.contains(el) && tipEl) { tipEl.remove(); obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });
}
/** ภาพประกอบหน้าเข้าสู่ระบบ: แถบเวลาเติมจากเช้าถึงค่ำ (เคลื่อนไหวครั้งเดียว) */
window.LOGIN_ART = function (el) {
  var prof = [], s;
  for (s = 20; s <= 84; s++) { var h = s / 4; prof.push(Math.exp(-0.5 * Math.pow((h - 8) / 1.3, 2)) + 0.35 * Math.exp(-0.5 * Math.pow((h - 11) / 1.2, 2)) + 0.25 * Math.exp(-0.5 * Math.pow((h - 17.5) / 0.9, 2)) + 0.04); }
  var mx = Math.max.apply(null, prof);
  el.innerHTML = '<div class="la-rib">' + prof.map(function (v, i) { return '<i style="--v:' + (v / mx).toFixed(3) + ';--d:' + (i * 22) + 'ms"></i>'; }).join('') + '</div><div class="la-axis"><span>05:00</span><span>09:00</span><span>13:00</span><span>17:00</span><span>21:00</span></div>';
};

/* ---------------- การแจ้งเตือนความหนาแน่น ---------------- */
var ALERTS = {
  list: [],
  init: function () { if (S.me.role !== 'tv') ALERTS.refresh(); },
  /** โหลดวันนี้ + วันเดียวกันของ 8 สัปดาห์ก่อน → ประเมินกฎทั้งหมด */
  refresh: function () {
    var t = nowBkk().iso;
    return Promise.all([D.loadToday(), D.ensure(U.addDays(t, -56), U.addDays(t, -1), true)]).then(function () { ALERTS.evaluate(); }).catch(function () { });
  },
  /** โปรไฟล์ปกติ (ค่าเฉลี่ย 8 สัปดาห์ วันเดียวกันในสัปดาห์ ประเภทวันเดียวกัน) แยกตามคลินิก */
  expected: function (iso) {
    var same = [], dt = D.dayType(iso);
    for (var k = 1; k <= 8; k++) { var d = U.addDays(iso, -7 * k); if (D.dayType(d) === dt && D.DAYS[d] && D.DAYS[d].sl) same.push(d); }
    if (dt !== 'W' && same.length < 3) { for (k = 1; k <= 21 && same.length < 6; k++) { var d2 = U.addDays(iso, -k); if (D.dayType(d2) === dt && D.DAYS[d2] && D.DAYS[d2].sl && same.indexOf(d2) < 0) same.push(d2); } }
    var cs = new Float64Array(D.nC * NS);
    same.forEach(function (d) { var sl = D.DAYS[d].sl; for (var i = 0; i < sl.length; i += 4) cs[sl[i] * NS + sl[i + 1]] += sl[i + 2] / same.length; });
    return { cs: cs, n: same.length, days: same };
  },
  evaluate: function () {
    var t = nowBkk().iso, x = D.DAYS[t];
    ALERTS.list = [];
    if (!x || !x.sl) return ALERTS.paint();
    var rules = (S.boot.settings.alerts || []).filter(function (r) { return +r.on; });
    var last = -1; for (var i = 0; i < x.sl.length; i += 4) last = Math.max(last, x.sl[i + 1]);
    if (last < 0) return ALERTS.paint();
    var ex = ALERTS.expected(t), K = D.compile({ dims: {}, ptg: [], hours: null, dts: ['W', 'S', 'H'] });
    rules.forEach(function (r) {
      var dim = r.dim === 'all' ? null : r.dim, groups = {};
      var keyOf = function (ci) { return dim ? D.val(dim, ci) : '*'; };
      for (var j = 0; j < x.sl.length; j += 4) {
        var ci = x.sl[j]; if (!K.cm[ci]) continue;
        var k = keyOf(ci); if (r.val && k !== r.val) continue;
        var g = groups[k] || (groups[k] = { act: 0, exp: 0, l60: 0 });
        g.act += x.sl[j + 2];
        if (x.sl[j + 1] > last - 4) g.l60 += x.sl[j + 2];
      }
      for (var ci2 = 0; ci2 < D.nC; ci2++) {
        if (!K.cm[ci2]) continue; var k2 = keyOf(ci2); if (r.val && k2 !== r.val) continue;
        for (var s = 0; s <= last; s++) { var e = ex.cs[ci2 * NS + s]; if (e) (groups[k2] || (groups[k2] = { act: 0, exp: 0, l60: 0 })).exp += e; }
      }
      Object.keys(groups).forEach(function (k) {
        var g = groups[k], name = dim ? D.shortLabel(dim, k) : 'ทั้งโรงพยาบาล';
        if (r.metric === 'last60' && g.l60 >= +r.thr) ALERTS.list.push({ id: r.id + ':' + k, lvl: g.l60 >= 1.5 * r.thr ? 'critical' : 'serious', title: name, msg: 'มาถึง ' + U.fmt(g.l60) + ' รายใน 1 ชั่วโมงล่าสุด (เกณฑ์ ' + r.thr + ')', dim: dim, key: k });
        if (r.metric === 'vsExp' && g.exp >= (+r.min || 20)) { var over = g.act / g.exp - 1; if (over * 100 >= +r.thr) ALERTS.list.push({ id: r.id + ':' + k, lvl: over >= 0.6 ? 'critical' : 'serious', title: name, msg: 'มากกว่าปกติ ' + U.pct(over, 0) + ' (ถึงตอนนี้ ' + U.fmt(g.act) + ' · ปกติ ≈ ' + U.fmt(g.exp) + ')', dim: dim, key: k }); }
      });
    });
    ALERTS.list.sort(function (a, b) { return (a.lvl === 'critical' ? 0 : 1) - (b.lvl === 'critical' ? 0 : 1); });
    ALERTS.paint();
    // ป๊อปอัปเฉพาะรายการใหม่ (ครั้งละไม่เกิน 3)
    var seen = {}; try { seen = JSON.parse(sessionStorage.getItem('opd:seenAl:' + t) || '{}'); } catch (e) { }
    var fresh = ALERTS.list.filter(function (a) { return !seen[a.id]; });
    fresh.slice(0, 3).forEach(function (a, i) { setTimeout(function () { UI.toast('<b>' + U.esc(a.title) + '</b><br>' + U.esc(a.msg), a.lvl === 'critical' ? 'bad' : 'warn', 7000); }, 400 + i * 500); });
    fresh.forEach(function (a) { seen[a.id] = 1; });
    try { sessionStorage.setItem('opd:seenAl:' + t, JSON.stringify(seen)); } catch (e) { }
  },
  paint: function () {
    var n = U.$('#bellN'); if (!n) return;
    n.hidden = !ALERTS.list.length; n.textContent = ALERTS.list.length;
    var b = U.$('#bellBtn'); if (b) b.classList.toggle('ring', ALERTS.list.some(function (a) { return a.lvl === 'critical'; }));
  },
  html: function (max) {
    if (!ALERTS.list.length) return '<p class="muted small ok-line">✓ ยังไม่มีจุดที่แน่นเกินเกณฑ์</p>';
    return '<ul class="alist">' + ALERTS.list.slice(0, max || 50).map(function (a) { return '<li class="al ' + a.lvl + '"><b class="ai">!</b><div><b>' + U.esc(a.title) + '</b><span>' + U.esc(a.msg) + '</span></div></li>'; }).join('') + '</ul>';
  },
  showList: function (anchor) {
    UI.pop(anchor, '<div class="apop"><h4>แจ้งเตือนความหนาแน่นวันนี้</h4>' + ALERTS.html(12) + (S.me.role === 'admin' ? '<p class="xs muted">ตั้งเกณฑ์ได้ที่ ตั้งค่าระบบ › แจ้งเตือน</p>' : '') + '</div>', { right: true });
  }
};

/* ---------------- ทัวร์แนะนำการใช้งาน ---------------- */
var TOUR = {
  steps: [
    ['.rail nav, .tabbar', 'เมนูหลัก', 'ปุ่มมุมบนของเมนูใช้ย่อ/ขยายแถบเมนู · เริ่มที่ "สถานการณ์วันนี้" ดูยอดสด แล้วไป "วิเคราะห์" "ความหนาแน่น" "คาดการณ์" และ "อัตรากำลัง" เพื่อวางแผน'],
    ['#syncBtn', 'ยอดอัปเดตล่าสุด', 'ระบบดึงยอดจาก HIS ให้อัตโนมัติตามรอบที่ตั้งไว้ กดปุ่มนี้เพื่อดึงล่าสุดทันที'],
    ['#fBtn', 'ตัวกรอง 3 ขั้น', 'เลือก ① ช่วงเวลา ② หน่วยงาน › โซน › คลินิก ③ รายละเอียด (ใน/นอกเวลา · นัด/walk-in · สิทธิ) แล้วกด ดูผล · ใช้กับทุกหน้าจนกว่าจะล้าง'],
    ['.per, .dimsel', 'ช่วงเวลาและมุมมอง', 'เลือกดูเป็นวัน สัปดาห์ เดือน ไตรมาส หรือปี (ปีงบประมาณหรือปีปฏิทิน) และเลือก "ดูตาม" ตึก ชั้น หรือกลุ่ม'],
    ['.info-btn', 'ปุ่ม i', 'กดดูคำอธิบายว่าตัวเลขนี้คำนวณอย่างไร'],
    ['#bellBtn', 'แจ้งเตือน', 'เมื่อคลินิกแน่นเกินเกณฑ์ จะมีป๊อปอัปเตือนและตัวเลขที่กระดิ่งนี้'],
    ['#btnPrint', 'พิมพ์และส่งออก', 'พิมพ์เป็น A4/PDF หรือส่งออก Excel ไว้รายงานหรือนำเสนอ · ทุกกราฟกดสลับเป็นตารางได้']
  ],
  start: function () {
    var i = 0, ov = U.el('<div class="tour"><div class="tour-hole"></div><div class="tour-card"><b></b><p></p><div><button class="btn sm" data-x>ข้าม</button><span class="xs muted"></span><button class="btn primary sm" data-n>ถัดไป</button></div></div></div>');
    document.body.appendChild(ov);
    var end = function () { ov.remove(); STORE.set('u:' + S.me.emp + ':toured', true); };
    var show = function () {
      while (i < TOUR.steps.length) {
        var st = TOUR.steps[i], el = U.$$(st[0]).filter(function (e) { var r = e.getBoundingClientRect(); return e.offsetParent !== null && r.width > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight; })[0];
        if (el) break; i++;
      }
      if (i >= TOUR.steps.length) return end();
      var r = el.getBoundingClientRect(), hole = U.$('.tour-hole', ov), card = U.$('.tour-card', ov);
      hole.style.cssText = 'left:' + (r.left - 6) + 'px;top:' + (r.top - 6) + 'px;width:' + (r.width + 12) + 'px;height:' + (r.height + 12) + 'px';
      U.$('b', card).textContent = st[1]; U.$('p', card).textContent = st[2]; U.$('span', card).textContent = (i + 1) + '/' + TOUR.steps.length;
      U.$('[data-n]', card).textContent = i === TOUR.steps.length - 1 ? 'เริ่มใช้งาน' : 'ถัดไป';
      var cw = Math.min(320, innerWidth - 24), left = U.clamp(r.left, 12, innerWidth - cw - 12), top = r.bottom + 14;
      if (top + 170 > innerHeight) top = r.top - 184; top = U.clamp(top, 12, Math.max(12, innerHeight - 200));
      card.style.cssText = 'left:' + left + 'px;top:' + top + 'px;width:' + cw + 'px';
    };
    U.$('[data-x]', ov).onclick = end;
    U.$('[data-n]', ov).onclick = function () { i++; show(); };
    show();
  }
};
