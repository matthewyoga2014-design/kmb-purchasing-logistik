
// ================= v18: Excel-like canvas (full screen, ctrl+wheel zoom) =================
function setOrgFull(on) { ui.ofull = on; document.body.classList.toggle('ofull', on); ui.ojump = false; render(); }
document.addEventListener('click', (e) => { if (e.target.closest('#oFull')) setOrgFull(!ui.ofull); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.ofull && document.getElementById('modal').hidden) setOrgFull(false); });
const _go14 = go;
go = function (id) { if (id !== 'org' && ui.ofull) { ui.ofull = false; document.body.classList.remove('ofull'); } _go14(id); };
document.addEventListener('wheel', (e) => {
  const wrap = e.target.closest && e.target.closest('#orgWrap'); if (!wrap || !(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  const r = wrap.getBoundingClientRect(), mx = e.clientX - r.left + wrap.scrollLeft, my = e.clientY - r.top + wrap.scrollTop;
  const old = ui.ozCur || 1, nz = Math.min(1.8, Math.max(.2, +(old * (e.deltaY < 0 ? 1.1 : 1 / 1.1)).toFixed(3)));
  ui.oz = nz; store.set('kta-oz2', String(nz)); applyOrgZoom();
  wrap.scrollLeft = mx * nz / old - (e.clientX - r.left); wrap.scrollTop = my * nz / old - (e.clientY - r.top);
  const l = document.getElementById('ozLbl'); if (l) l.textContent = Math.round(nz * 100) + '%';
}, { passive: false });
