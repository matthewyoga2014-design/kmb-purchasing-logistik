
// ================= v19: free re-arranging (order of people, sub-sections, sections, Di luar SO box) =================
const _orgSections15 = orgSections;
orgSections = function (P) {
  const out = _orgSections15(P);
  const so = DATA.orgSecOrder || [], go = DATA.orgGrpOrder || {};
  const ix = (arr, n, d) => { const i = arr.indexOf(n); return i < 0 ? 1000 + d : i; };
  out.forEach((s, i) => { s._i = i; const ord = go[s.name] || []; s.groups = s.groups.map((g, j) => ({ g, k: ix(ord, g.name, j) })).sort((a, b) => a.k - b.k).map((x) => x.g); });
  return out.sort((a, b) => ix(so, a.name, a._i) - ix(so, b.name, b._i));
};
const zone = (el, x, edge) => { const r = el.getBoundingClientRect(); const rel = (x - r.left) / Math.max(1, r.width); return rel < edge ? 'before' : rel > 1 - edge ? 'after' : 'mid'; };

// ---------- people: before / after (sejajar) or onto (bawahan) ----------
dropTarget = function (el) {
  const card = el.closest('.ocard');
  if (card) {
    const u = card.dataset.uid; if (u === DRAG || isUnder(DATA, u, DRAG)) return null;
    const z = zone(card, PX, .28);
    if (z === 'mid') return { el: card, leader: u };
    return { el: card, cls: z === 'before' ? 'dropbefore' : 'dropafter', beside: u, where: z };
  }
  const sec = el.closest('.onode.sec'); if (sec) return { el: sec, section: sec.dataset.dsec, group: sec.dataset.dsec };
  const fr = el.closest('.gframe'); if (fr) return { el: fr, section: fr.dataset.dsec, group: fr.dataset.dg };
  return null;
};
const _doOrgDrop15 = doOrgDrop;
doOrgDrop = async function (uid, t) {
  if (!t || !t.beside) return _doOrgDrop15(uid, t);
  const p = posByUid(DATA, uid), T = posByUid(DATA, t.beside); if (!p || !T) return;
  await commit((S) => {
    const a = S.positions.findIndex((x) => x.uid === uid); const [rec] = S.positions.splice(a, 1);
    const tgt = posByUid(S, t.beside);
    rec.atasan = tgt.atasan || null; rec.section = tgt.section; rec.group = tgt.group || tgt.section;
    const b = S.positions.findIndex((x) => x.uid === t.beside);
    S.positions.splice(t.where === 'before' ? b : b + 1, 0, rec);
    cascadeSection(S, rec);
  }, `${nameOf(p)} dipindah ${t.where === 'before' ? 'sebelum' : 'sesudah'} ${nameOf(T)}.`);
};

// ---------- sub-sections: before / after (urutan) or middle (jadi di bawahnya) ----------
const zoneY = (el, y, edge) => { const r = el.getBoundingClientRect(); const rel = (y - r.top) / Math.max(1, r.height); return rel < edge ? 'before' : rel > 1 - edge ? 'after' : 'mid'; };
gTarget = function (el, key) {
  let fr = el.closest('.gframe'), forced = null;
  if (!fr) { const gl = el.closest('.glist'); if (gl) { let bd = Infinity; [...gl.children].forEach((n) => { const f = n.querySelector(':scope > .gframe'); if (!f) return; const r = f.getBoundingClientRect(); const d = PY < r.top ? r.top - PY : PY > r.bottom ? PY - r.bottom : 0; if (d < bd) { bd = d; fr = f; forced = PY < r.top + r.height / 2 ? 'before' : 'after'; } }); } }
  if (fr && forced) { const r = fr.getBoundingClientRect(); if (PX > r.right + 8 && PY >= r.top && PY <= r.bottom) { const k0 = GK(fr.dataset.dsec, fr.dataset.dg); if (k0 !== key && !gIsUnder(gmap(DATA), k0, key)) return { el: fr, kind: 'gpos', where: 'after', cls: 'dropafter', setLay: 'h', key: k0, sec: fr.dataset.dsec, g: fr.dataset.dg, lbl: `Sejajar ke samping · sesudah ${fr.dataset.dg}` }; } }
  if (fr) {
    const k = GK(fr.dataset.dsec, fr.dataset.dg); if (k === key || gIsUnder(gmap(DATA), k, key)) return null;
    const vert = !!fr.parentElement.closest('.glist') && !fr.parentElement.closest('ul.gul');
    if (vert) {
      const r = fr.getBoundingClientRect(), side = PX < r.left + r.width * .15 ? 'before' : PX > r.right - r.width * .15 ? 'after' : null;
      if (side) return { el: fr, kind: 'gpos', where: side, cls: side === 'before' ? 'dropbefore' : 'dropafter', setLay: 'h', key: k, sec: fr.dataset.dsec, g: fr.dataset.dg, lbl: `Sejajar ke samping · ${side === 'before' ? 'sebelum' : 'sesudah'} ${fr.dataset.dg}` };
    }
    const z = forced || (vert ? zoneY(fr, PY, .3) : zone(fr, PX, .22));
    const cls = z === 'mid' ? 'dropok' : vert ? (z === 'before' ? 'droptop' : 'dropbottom') : (z === 'before' ? 'dropbefore' : 'dropafter');
    return { el: fr, kind: z === 'mid' ? 'grp' : 'gpos', where: z, cls, key: k, sec: fr.dataset.dsec, g: fr.dataset.dg };
  }
  const sn = el.closest('.onode.sec'); if (sn) return { el: sn, kind: 'sec', sec: sn.dataset.dsec };
  return null;
};
function grpOrderOf(S, sec) { const names = []; S.positions.forEach((p) => { if (p.section === sec) { const g = p.group || p.section; if (!names.includes(g)) names.push(g); } }); const cur = (S.orgGrpOrder || {})[sec] || []; return [...cur.filter((n) => names.includes(n)), ...names.filter((n) => !cur.includes(n))]; }
document.addEventListener('pointerup', async () => {
  if (!PG || !PG.started || !PG.t || PG.t.kind !== 'gpos') return;
  const { t, key, sec, g } = PG; pgCleanup();
  SUPPRESS_CLICK = true; setTimeout(() => { SUPPRESS_CLICK = false; }, 0);
  await commit((S) => {
    if (t.sec !== sec) moveGroupSection(S, key, t.sec);
    const m = { ...gmap(S) }; const nk = GK(t.sec, g); const tp = m[t.key]; if (tp) m[nk] = tp; else delete m[nk]; S.orgGroups = m;
    const ord = grpOrderOf(S, t.sec).filter((n) => n !== g); const i = ord.indexOf(t.g); ord.splice(t.where === 'before' ? i : i + 1, 0, g);
    S.orgGrpOrder = { ...(S.orgGrpOrder || {}), [t.sec]: ord };
    if (t.setLay) S.orgSecLay = { ...(S.orgSecLay || {}), [t.sec]: 'h' };
  }, t.setLay ? `${g} sekarang sejajar di samping ${t.g}.` : `${g} dipindah ${t.where === 'before' ? 'sebelum' : 'sesudah'} ${t.g}.`);
}, true);

// ---------- sections (kotak ungu) and the Di luar SO box ----------
let PS = null;
function secOrderOf(S) { const names = []; S.positions.forEach((p) => { const s = p.section || 'Lainnya'; if (!names.includes(s)) names.push(s); }); const cur = S.orgSecOrder || []; return [...cur.filter((n) => names.includes(n)), ...names.filter((n) => !cur.includes(n))]; }
function sTarget(el) {
  if (PS.kind === 'box') return null;
  const out = el.closest('.orgroot.out'); if (out && !secOut(PS.sec)) return { el: out, kind: 'sout' };
  const root = el.closest('.orgroot') || (el.closest('#orgWrap') && document.querySelector('#orgWrap .orgroot:not(.out)'));
  if (!root) return null;
  const isOut = root.classList.contains('out');
  if (!isOut && secOut(PS.sec) && !el.closest('.onode.sec')) return { el: root, kind: 'sin' };
  // nearest section box in this area (by horizontal distance) — drop anywhere in the row
  const nodes = [...root.querySelectorAll('.onode.sec')].filter((n) => n.dataset.dsec !== PS.sec && n.closest('.orgroot') === root);
  if (!nodes.length) return isOut ? null : { el: root, kind: 'sin' };
  let best = null, bd = Infinity;
  nodes.forEach((n) => { const r = n.getBoundingClientRect(); const d = Math.abs(PX - (r.left + r.width / 2)); if (d < bd) { bd = d; best = n; } });
  const r = best.getBoundingClientRect(); const before = PX < r.left + r.width / 2;
  return { el: best, kind: 'spos', sec: best.dataset.dsec, where: before ? 'before' : 'after', cls: before ? 'dropbefore' : 'dropafter' };
}
document.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !CAN_EDIT) return;
  const sn = e.target.closest && e.target.closest('#orgWrap .onode.sec[data-rsec]');
  const ob = e.target.closest && e.target.closest('#orgWrap [data-outmv]');
  if (!sn && !ob) return;
  PS = sn ? { kind: 'sec', el: sn, sec: sn.dataset.rsec, x: e.clientX, y: e.clientY } : { kind: 'box', el: ob.closest('.orgroot.out'), x: e.clientX, y: e.clientY };
  PS.wrap = document.getElementById('orgWrap'); e.preventDefault();
});
document.addEventListener('pointermove', (e) => {
  if (!PS) return;
  const dx = e.clientX - PS.x, dy = e.clientY - PS.y;
  if (!PS.started) {
    if (Math.hypot(dx, dy) < 7) return;
    PS.started = true; const src = PS.kind === 'box' ? PS.el.querySelector('.outlbl') : PS.el;
    const r = src.getBoundingClientRect(); PS.ox = PS.x - r.left; PS.oy = PS.y - r.top;
    const g = src.cloneNode(true); g.classList.add('oghost', 'gghost'); g.style.transform = `scale(${r.width / src.offsetWidth})`; g.style.width = src.offsetWidth + 'px';
    document.body.appendChild(g); PS.ghost = g; PS.el.classList.add('dragging'); document.body.classList.add('odragging');
  }
  e.preventDefault();
  PS.ghost.style.left = (e.clientX - PS.ox) + 'px'; PS.ghost.style.top = (e.clientY - PS.oy) + 'px';
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (PS.kind === 'box') {
    const main = document.querySelector('#orgWrap .orgroot:not(.out)');
    if (main) { const r = main.getBoundingClientRect(); PS.pos = e.clientY > r.bottom - 20 ? 'bottom' : e.clientX < r.left + r.width / 2 ? 'left' : 'right'; main.dataset.pos = PS.pos; markDrop({ el: main, cls: PS.pos === 'left' ? 'dropbefore' : PS.pos === 'right' ? 'dropafter' : 'dropok', horiz: PS.pos === 'bottom', lbl: `Letakkan Di luar SO di ${PS.pos === 'left' ? 'kiri' : PS.pos === 'right' ? 'kanan' : 'bawah'} struktur` }); }
  } else { const t = el && el.closest('#orgWrap') ? sTarget(el) : null; PS.t = t; markDrop(t); }
  const wr = PS.wrap.getBoundingClientRect(), m = 48, sp = 14;
  if (e.clientX < wr.left + m) PS.wrap.scrollLeft -= sp; else if (e.clientX > wr.right - m) PS.wrap.scrollLeft += sp;
  if (e.clientY < wr.top + m) PS.wrap.scrollTop -= sp; else if (e.clientY > wr.bottom - m) PS.wrap.scrollTop += sp;
}, { passive: false });
function psCleanup() { if (PS && PS.ghost) PS.ghost.remove(); clearDrop(); document.body.classList.remove('odragging'); PS = null; }
document.addEventListener('pointerup', async () => {
  if (!PS) return;
  const { started, kind, t, sec, pos } = PS; psCleanup();
  if (!started) return;
  SUPPRESS_CLICK = true; setTimeout(() => { SUPPRESS_CLICK = false; }, 0);
  if (kind === 'box') { if (!pos || pos === (DATA.orgOutPos || 'right')) return; await commit((S) => { S.orgOutPos = pos; }, `Kotak Di luar SO dipindah ke ${pos === 'left' ? 'kiri' : pos === 'right' ? 'kanan' : 'bawah'} struktur.`); return; }
  if (!t) { toast('Lepaskan di samping kotak section lain, atau di area Di luar SO.', true); return; }
  if (t.kind === 'sout' || t.kind === 'sin') { await commit((S) => { S.orgSecMode = { ...(S.orgSecMode || {}), [sec]: t.kind === 'sout' ? 'out' : 'in' }; }, t.kind === 'sout' ? `${sec} dipindah ke Di luar SO.` : `${sec} disambungkan ke struktur.`); return; }
  await commit((S) => {
    const ord = secOrderOf(S).filter((n) => n !== sec); const i = ord.indexOf(t.sec); ord.splice(t.where === 'before' ? i : i + 1, 0, sec); S.orgSecOrder = ord;
    if (secOut(t.sec, S) !== secOut(sec, S)) S.orgSecMode = { ...(S.orgSecMode || {}), [sec]: secOut(t.sec, S) ? 'out' : 'in' };
  }, `${sec} dipindah ${t.where === 'before' ? 'sebelum' : 'sesudah'} ${t.sec}.`);
});
document.addEventListener('pointercancel', psCleanup);
