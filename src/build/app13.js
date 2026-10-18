
// ================= v17: nest / move whole sub-sections (drag the sub-section title) =================
const GK = (sec, grp) => `${sec}›${grp}`;
const gmap = (S) => (S.orgGroups && typeof S.orgGroups === 'object') ? S.orgGroups : {};
function gParent(map, key) { const v = map[key]; return v && v !== key ? v : null; }
function gIsUnder(map, key, anc) { let k = gParent(map, key), n = 0; while (k && n++ < 100) { if (k === anc) return true; k = gParent(map, k); } return false; }
function gDesc(map, key) { const out = []; const q = [key]; while (q.length) { const k = q.shift(); Object.keys(map).forEach((c) => { if (map[c] === k && !out.includes(c) && c !== key) { out.push(c); q.push(c); } }); } return out; }

function orgChart(D) {
  ORG_MP = orgMpIndex();
  const P = D.P; const M = orgModel(P); const GM = gmap(DATA);
  const freeSet = new Set(M.free.map((p) => p.uid));
  const secs = orgSections(P);
  const isTop = (s) => /penanggung|pjo|manajemen|management/i.test(s.name);
  const top = secs.filter(isTop).flatMap((s) => s.groups.flatMap((g) => g.list)).filter((p) => freeSet.has(p.uid));
  const allBody = secs.filter((s) => !isTop(s)).filter((s) => ui.osec === 'semua' || s.name === ui.osec);
  const body = allBody.filter((s) => !secOut(s.name)), outs = allBody.filter((s) => secOut(s.name));
  const secLi = (s) => {
    const lay = ((DATA.orgSecLay || {})[s.name]) || ui.olay;
    const all = s.groups.flatMap((g) => g.list), vac = all.filter(isVacant).length, mpa = all.length - vac;
    const names = new Set(s.groups.map((g) => g.name));
    const parentOf = (g) => { const pk = gParent(GM, GK(s.name, g.name)); if (!pk) return null; const [ps, pg] = pk.split('›'); return ps === s.name && names.has(pg) && pg !== g.name && !gIsUnder(GM, pk, GK(s.name, g.name)) ? pg : null; };
    const kidsOf = (name) => s.groups.filter((g) => parentOf(g) === name);
    const frame = (g) => {
      const fl = g.list.filter((p) => freeSet.has(p.uid));
      const titled = g.name !== s.name; const gv = g.list.filter(isVacant).length;
      const kids = kidsOf(g.name).map(frame).filter(Boolean);
      if (!fl.length && !CAN_EDIT && !kids.length) return '';
      const box = `<div class="gframe" data-dsec="${esc(s.name)}" data-dg="${esc(g.name)}">${titled ? `<div class="gtitle" ${CAN_EDIT ? `data-rgrp="${esc(s.name)}" data-g="${esc(g.name)}" role="button" tabindex="0" title="Klik = ganti nama · Seret = pindahkan sub-section ini ke bawah sub-section / section lain"` : ''}>${CAN_EDIT ? '<i class="grip" aria-hidden="true">⠿</i>' : ''}${esc(g.name)}<span>${g.list.length} posisi${gv ? ` · <em>${gv} vacant</em>` : ''}</span></div>` : ''}${fl.length ? tiersHtml(fl, M) : `<div class="small" style="padding:8px">${g.list.length ? 'Semua posisi ada di bawah atasannya.' : 'Belum ada posisi.'}</div>`}</div>`;
      const kul = kids.length ? `<ul class="gul">${kids.map((k) => `<li>${k}</li>`).join('')}</ul>` : '';
      if (lay === 'v' && kul) return `<div class="gnode">${box.replace(/<\/div>$/, kul + '</div>')}</div>`;
      return `<div class="gnode">${box}${kul}</div>`;
    };
    const framesArr = s.groups.filter((g) => !parentOf(g)).map(frame).filter(Boolean);
    const frames = !framesArr.length ? '' : (lay === 'v' || framesArr.length === 1) ? `<div class="glist">${framesArr.join('')}</div>` : `<ul class="gul">${framesArr.map((f) => `<li>${f}</li>`).join('')}</ul>`;
    return `<li><div class="onode sec" data-dsec="${esc(s.name)}" ${CAN_EDIT ? `data-rsec="${esc(s.name)}" role="button" tabindex="0" title="Klik untuk ganti nama section"` : ''}><b>${esc(s.name)}</b><span>${all.length} MPP · ${mpa} MPA · ${all.length ? Math.round(mpa / all.length * 100) : 0}%</span></div>${frames}</li>`;
  };
  const secRow = body.length ? `<ul class="tier secs">${body.map(secLi).join('')}</ul>` : '';
  const outBlk = outs.length ? `<div class="orgroot out"><div class="outlbl" ${CAN_EDIT ? 'data-outmv="1" title="Seret untuk memindahkan kotak ini ke kiri / kanan / bawah struktur"' : ''}>${CAN_EDIT ? '<i class="grip">⠿</i>' : ''}Di luar Struktur Organisasi (SO)</div><div class="tiers"><ul class="tier secs">${outs.map(secLi).join('')}</ul></div></div>` : '';
  const main = ui.osec !== 'semua' ? (secRow ? `<div class="orgroot">${tiersHtml([], M, secRow)}</div>` : '') : `<div class="orgroot">${top.length ? tiersHtml(top, M, secRow) : `<div class="tiers">${secRow}</div>`}</div>`;
  return `<div class="org pos-${['left', 'bottom'].includes(DATA.orgOutPos) ? DATA.orgOutPos : 'right'}">${main}${outBlk}</div>`;
}
function secOut(name, S) { const m = ((S || DATA).orgSecMode) || {}; return m[name] ? m[name] === 'out' : /luar\s*so|non[\s-]*so/i.test(name || ''); }

// move a group (and its nested groups) to another section, keeping the nesting
function moveGroupSection(S, key, newSec) {
  const map = gmap(S); const keys = [key, ...gDesc(map, key)];
  const remap = {};
  keys.forEach((k) => { const [sec, g] = k.split('›'); remap[k] = GK(newSec, g); S.positions.forEach((p) => { if (p.section === sec && (p.group || p.section) === g) { p.section = newSec; p.group = g; } }); });
  const next = {};
  Object.entries(map).forEach(([k, v]) => { const nk = remap[k] || k, nv = remap[v] || v; next[nk] = nv; });
  S.orgGroups = next;
}
function renameForm(kind, sec, grp) {
  const old = kind === 'sec' ? sec : grp;
  const n = DATA.positions.filter((p) => kind === 'sec' ? p.section === sec : (p.section === sec && (p.group || p.section) === grp)).length;
  openForm({ eyebrow: 'Struktur Organisasi', title: `Ganti nama ${kind === 'sec' ? 'section' : 'sub-section'}`, submit: 'Simpan',
    intro: `${n} posisi di <b>${esc(old)}</b> ikut berubah.${kind === 'grp' ? ` (Section: ${esc(sec)})` : ''}`,
    values: { nm: old, out: kind === 'sec' && secOut(sec) }, fields: [{ k: 'nm', label: kind === 'sec' ? 'Nama section' : 'Nama sub-section', req: true, full: true, list: kind === 'sec' ? SEC_OPTS() : GRP_OPTS() }].concat(kind === 'sec' ? [{ k: 'out', label: 'Tampilkan terpisah — di luar Struktur Organisasi (tidak tersambung ke atasan)', type: 'check' }] : []),
    onSave: (v) => { const nv = String(v.nm).trim(); const modeChanged = kind === 'sec' && !!v.out !== secOut(sec); if (!nv || (nv === old && !modeChanged)) return true; return commit((S) => {
      if (kind === 'sec') { const m = { ...(S.orgSecMode || {}) }; delete m[sec]; m[nv] = v.out ? 'out' : 'in'; S.orgSecMode = m; }
      if (nv === old) return;
      S.positions.forEach((p) => {
        if (kind === 'sec' && p.section === sec) { if ((p.group || p.section) === sec) p.group = nv; p.section = nv; }
        if (kind === 'grp' && p.section === sec && (p.group || p.section) === grp) p.group = nv;
      });
      const map = gmap(S), next = {};
      const fix = (k) => { if (!k) return k; const [s2, g2] = k.split('›'); if (kind === 'sec' && s2 === sec) return GK(nv, g2 === sec ? nv : g2); if (kind === 'grp' && s2 === sec && g2 === grp) return GK(sec, nv); return k; };
      Object.entries(map).forEach(([k, v]) => { next[fix(k)] = fix(v); });
      S.orgGroups = next;
    }, nv === old ? (v.out ? `${sec} ditampilkan terpisah (di luar SO).` : `${sec} disambungkan ke struktur.`) : `${kind === 'sec' ? 'Section' : 'Sub-section'} diganti menjadi ${nv}.`); } });
}

// ---------- drag a whole sub-section by its title ----------
let PG = null;
function gTarget(el, key) {
  const fr = el.closest('.gframe'); if (fr) { const k = GK(fr.dataset.dsec, fr.dataset.dg); if (k === key || gIsUnder(gmap(DATA), k, key)) return null; return { el: fr, kind: 'grp', key: k, sec: fr.dataset.dsec, g: fr.dataset.dg }; }
  const sn = el.closest('.onode.sec'); if (sn) return { el: sn, kind: 'sec', sec: sn.dataset.dsec };
  return null;
}
document.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !CAN_EDIT) return;
  const t = e.target.closest && e.target.closest('#orgWrap .gtitle[data-rgrp]'); if (!t) return;
  PG = { el: t, key: GK(t.dataset.rgrp, t.dataset.g), sec: t.dataset.rgrp, g: t.dataset.g, x: e.clientX, y: e.clientY, wrap: document.getElementById('orgWrap') };
  e.preventDefault();
});
document.addEventListener('pointermove', (e) => {
  if (!PG) return;
  const dx = e.clientX - PG.x, dy = e.clientY - PG.y;
  if (!PG.started) {
    if (Math.hypot(dx, dy) < 7) return;
    PG.started = true;
    const r = PG.el.getBoundingClientRect(); PG.ox = PG.x - r.left; PG.oy = PG.y - r.top;
    const g = PG.el.cloneNode(true); g.classList.add('oghost', 'gghost'); g.style.transform = `scale(${r.width / PG.el.offsetWidth})`;
    document.body.appendChild(g); PG.ghost = g;
    PG.el.closest('.gframe').classList.add('dragging'); document.body.classList.add('odragging');
  }
  e.preventDefault();
  PG.ghost.style.left = (e.clientX - PG.ox) + 'px'; PG.ghost.style.top = (e.clientY - PG.oy) + 'px';
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const t = el && el.closest('#orgWrap') ? gTarget(el, PG.key) : null; PG.t = t;
  markDrop(t);
  const wr = PG.wrap.getBoundingClientRect(), m = 48, sp = 14;
  if (e.clientX < wr.left + m) PG.wrap.scrollLeft -= sp; else if (e.clientX > wr.right - m) PG.wrap.scrollLeft += sp;
  if (e.clientY < wr.top + m) PG.wrap.scrollTop -= sp; else if (e.clientY > wr.bottom - m) PG.wrap.scrollTop += sp;
  if (e.clientY < 70) window.scrollBy(0, -sp); else if (e.clientY > window.innerHeight - 40) window.scrollBy(0, sp);
}, { passive: false });
function pgCleanup() {
  if (PG && PG.ghost) PG.ghost.remove();
  clearDrop();
  document.body.classList.remove('odragging'); PG = null;
}
document.addEventListener('pointerup', async () => {
  if (!PG) return;
  const { started, t, key, sec, g } = PG; pgCleanup();
  if (!started) return;
  SUPPRESS_CLICK = true; setTimeout(() => { SUPPRESS_CLICK = false; }, 0);
  if (!t) { toast('Lepaskan di kotak sub-section lain atau di kotak section.', true); return; }
  const cur = gParent(gmap(DATA), key);
  if (t.kind === 'grp') {
    if (cur === t.key) return;
    await commit((S) => {
      if (t.sec !== sec) moveGroupSection(S, key, t.sec);
      const nk = GK(t.sec, g); S.orgGroups = { ...gmap(S), [nk]: t.key };
    }, `${g} sekarang di bawah ${t.g}.`);
  } else {
    if (t.sec === sec && !cur) return;
    await commit((S) => {
      if (t.sec !== sec) moveGroupSection(S, key, t.sec);
      const m = { ...gmap(S) }; delete m[GK(t.sec, g)]; S.orgGroups = m;
    }, t.sec === sec ? `${g} langsung di bawah ${sec}.` : `${g} dipindah ke ${t.sec}.`);
  }
});
document.addEventListener('pointercancel', pgCleanup);
