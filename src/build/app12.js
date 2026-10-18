
// ================= v16: pointer-based drag (mouse + touch) and pan =================
let PD = null, SUPPRESS_CLICK = false, PX = 0, PY = 0;
const DROP_CLS = ['dropok', 'dropbefore', 'dropafter', 'droptop', 'dropbottom'];
function clearDrop() { document.querySelectorAll('.dragging,.dropok,.dropbefore,.dropafter,.droptop,.dropbottom').forEach((x) => x.classList.remove('dragging', ...DROP_CLS)); showDropLine(null); }
function markDrop(t) { document.querySelectorAll('.dropok,.dropbefore,.dropafter,.droptop,.dropbottom').forEach((x) => { if (!t || x !== t.el) x.classList.remove(...DROP_CLS); }); if (t) { t.el.classList.remove(...DROP_CLS); t.el.classList.add(t.cls || 'dropok'); } showDropLine(t); }
document.addEventListener('pointermove', (e) => { PX = e.clientX; PY = e.clientY; }, true);
async function doOrgDrop(uid, t) {
  const p = posByUid(DATA, uid); if (!p || !t) return;
  const L = t.leader && posByUid(DATA, t.leader);
  if (L && p.atasan === L.uid) return;
  if (!L && !p.atasan && p.section === t.section && (p.group || p.section) === t.group) return;
  await commit((S) => moveTo(S, uid, t), L ? `${nameOf(p)} sekarang di bawah ${nameOf(L)}.` : `${nameOf(p)} dipindah ke ${t.group && t.group !== t.section ? t.section + ' › ' + t.group : t.section}.`);
}
function pdCleanup() {
  if (PD && PD.ghost) PD.ghost.remove();
  clearDrop();
  document.body.classList.remove('odragging');
  const w = document.getElementById('orgWrap'); if (w) w.classList.remove('panning');
  DRAG = null; PD = null;
}
document.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const wrap = e.target.closest && e.target.closest('#orgWrap'); if (!wrap) return;
  const card = CAN_EDIT && e.target.closest('.ocard[data-uid]');
  if (card && !e.target.closest('button')) { PD = { mode: 'card', card, uid: card.dataset.uid, x: e.clientX, y: e.clientY, wrap }; return; }
  if (e.pointerType === 'mouse' && !e.target.closest('.ocard, .onode, .gtitle, button, input, select, a')) {
    PD = { mode: 'pan', x: e.clientX, y: e.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop, wrap }; e.preventDefault();
  }
});
document.addEventListener('pointermove', (e) => {
  if (!PD) return;
  const dx = e.clientX - PD.x, dy = e.clientY - PD.y;
  if (PD.mode === 'pan') {
    if (!PD.started && Math.hypot(dx, dy) < 4) return;
    PD.started = true; PD.wrap.classList.add('panning');
    PD.wrap.scrollLeft = PD.sl - dx; PD.wrap.scrollTop = PD.st - dy; return;
  }
  if (!PD.started) {
    if (Math.hypot(dx, dy) < 7) return;
    PD.started = true; DRAG = PD.uid;
    const r = PD.card.getBoundingClientRect();
    PD.ox = PD.x - r.left; PD.oy = PD.y - r.top;
    const g = PD.card.cloneNode(true); g.classList.add('oghost'); g.removeAttribute('data-soe');
    g.style.width = PD.card.offsetWidth + 'px'; g.style.transform = `scale(${r.width / PD.card.offsetWidth})`;
    document.body.appendChild(g); PD.ghost = g;
    PD.card.classList.add('dragging'); document.body.classList.add('odragging');
  }
  e.preventDefault();
  PD.ghost.style.left = (e.clientX - PD.ox) + 'px'; PD.ghost.style.top = (e.clientY - PD.oy) + 'px';
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const t = el && el.closest('#orgWrap') ? dropTarget(el) : null; PD.t = t;
  markDrop(t);
  const wr = PD.wrap.getBoundingClientRect(), m = 48, sp = 14;
  if (e.clientX < wr.left + m) PD.wrap.scrollLeft -= sp; else if (e.clientX > wr.right - m) PD.wrap.scrollLeft += sp;
  if (e.clientY < wr.top + m) PD.wrap.scrollTop -= sp; else if (e.clientY > wr.bottom - m) PD.wrap.scrollTop += sp;
  if (e.clientY < 70) window.scrollBy(0, -sp); else if (e.clientY > window.innerHeight - 40) window.scrollBy(0, sp);
}, { passive: false });
document.addEventListener('pointerup', (e) => {
  if (!PD) return;
  const st = PD.started, mode = PD.mode, uid = PD.uid, t = PD.t;
  pdCleanup();
  if (st) { SUPPRESS_CLICK = true; setTimeout(() => { SUPPRESS_CLICK = false; }, 0); }
  if (st && mode === 'card') {
    if (t) doOrgDrop(uid, t); else toast('Lepaskan di kotak atasan, kotak sub-section, atau kotak section.', true);
  }
});
document.addEventListener('pointercancel', pdCleanup);
document.addEventListener('click', (e) => { if (SUPPRESS_CLICK) { e.stopPropagation(); e.preventDefault(); SUPPRESS_CLICK = false; } }, true);
document.addEventListener('dragstart', (e) => { if (e.target.closest && e.target.closest('#orgWrap')) e.preventDefault(); }, true);

// ---------- visible drop guide (green line + label) ----------
function dropLabel(t) {
  const nm = (u) => { const x = posByUid(DATA, u); return x ? (isVacant(x) ? 'Vacant ' + (x.jabatan || '') : x.nama) : ''; };
  if (t.lbl) return t.lbl;
  if (t.leader) return `Jadi bawahan ${nm(t.leader)}`;
  if (t.beside) return `Sejajar · ${t.where === 'before' ? 'sebelum' : 'sesudah'} ${nm(t.beside)}`;
  if (t.kind === 'grp') return `Masuk di bawah ${t.g}`;
  if (t.kind === 'gpos') return `Urutan · ${t.where === 'before' ? 'sebelum' : 'sesudah'} ${t.g}`;
  if (t.kind === 'sec') return `Langsung di bawah ${t.sec}`;
  if (t.kind === 'spos') return `Letakkan ${t.where === 'before' ? 'sebelum' : 'sesudah'} ${t.sec}`;
  if (t.kind === 'sout') return 'Pindahkan ke Di luar SO';
  if (t.kind === 'sin') return 'Sambungkan ke struktur utama';
  if (t.section) return `Pindah ke ${t.group && t.group !== t.section ? t.group : t.section}`;
  return '';
}
function showDropLine(t) {
  let L = document.getElementById('dropLine'), B = document.getElementById('dropLbl');
  if (!L) { L = document.createElement('div'); L.id = 'dropLine'; document.body.appendChild(L); B = document.createElement('div'); B.id = 'dropLbl'; document.body.appendChild(B); }
  if (!t || !t.el) { L.hidden = true; B.hidden = true; return; }
  const r = t.el.getBoundingClientRect(), cls = t.cls || 'dropok';
  let lx, ly;
  L.className = '';
  if (cls === 'droptop' || cls === 'dropbottom') { const y = cls === 'droptop' ? r.top - 10 : r.bottom + 5; Object.assign(L.style, { left: (r.left - 10) + 'px', top: y + 'px', width: (r.width + 20) + 'px', height: '5px' }); lx = r.left + r.width / 2; ly = y - 4; }
  else if (t.horiz) { L.className = 'h'; Object.assign(L.style, { left: r.left + 'px', top: (r.bottom + 6) + 'px', width: r.width + 'px', height: '5px' }); lx = r.left + r.width / 2; ly = r.bottom + 14; }
  else if (cls === 'dropbefore' || cls === 'dropafter') {
    const x = cls === 'dropbefore' ? r.left - 9 : r.right + 4;
    Object.assign(L.style, { left: x + 'px', top: (r.top - 10) + 'px', width: '5px', height: (r.height + 20) + 'px' }); lx = x + 2; ly = r.top - 14;
  } else { L.className = 'box'; Object.assign(L.style, { left: (r.left - 5) + 'px', top: (r.top - 5) + 'px', width: (r.width + 10) + 'px', height: (r.height + 10) + 'px' }); lx = r.left + r.width / 2; ly = r.top - 14; }
  L.hidden = false;
  B.textContent = dropLabel(t); B.hidden = !B.textContent;
  B.style.left = lx + 'px'; B.style.top = Math.max(8, ly) + 'px';
}
