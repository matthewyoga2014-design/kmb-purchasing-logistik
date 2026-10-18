/* Izin per menu untuk Editor & Pelihat (diatur Pemilik di Pusat Monitoring → Pengaturan → Izin Menu).
   Lihat (v) / Ubah (e, khusus Editor) / Unduh (d). "excel" = tombol Download Excel, "setting" = halaman Pengaturan. */
(function () {
  if (window.__permx) return; window.__permx = true;
  let MPP = false, APD = false;
  try { MPP = typeof WEB === 'object' && typeof PERMS !== 'undefined'; } catch (e) {}
  try { APD = !MPP && typeof S === 'object' && S && typeof exportExcel === 'function'; } catch (e) {}
  if (!MPP && !APD) return;
  const role = () => (MPP ? WEB.role : S.role);
  const perms = () => (MPP ? PERMS : S.perms) || {};
  const page = () => { try { return ui.page || 'dashboard'; } catch (e) { return 'dashboard'; } };
  function P(id, k) {
    const r = role(); if (r === 'owner') return true; if (r !== 'editor' && r !== 'viewer') return false;
    if (id === 'detail') id = MPP ? 'mpp' : 'people';
    if (k === 'v' && id === 'dashboard') return true;
    const all = perms(); if (id === 'setting' && all._v !== 2) return false;
    const p = (all[r] || {})[id]; if (p && typeof p[k] === 'boolean') return p[k];
    if (id === 'setting') return false;
    if (id === 'excel') return k === 'd' && r === 'editor';
    if (k === 'e') return r === 'editor';
    return k === 'v' ? true : r === 'editor';
  }
  window.permOf = P;
  const XL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function after() {
    if (role() !== 'owner') { const nav = document.getElementById('nav'); if (nav) { nav.querySelectorAll('[data-go]').forEach((x) => { x.hidden = !P(x.dataset.go, 'v'); }); nav.querySelectorAll('.lbl').forEach((l) => { let n = l.nextElementSibling, any = false; while (n && !n.classList.contains('lbl')) { if (!n.hidden) any = true; n = n.nextElementSibling; } l.hidden = !any; }); } }
    // tombol Excel terpisah dari Pengaturan
    const show = role() !== 'owner' && P('excel', 'd');
    document.querySelectorAll('#printBtn').forEach((pb) => { const nx = pb.parentElement && pb.parentElement.querySelector('#xlsTop'); if (show && !nx) pb.insertAdjacentHTML('afterend', `<button type="button" class="btn btn-g" id="xlsTop" title="Download Excel">${XL}Excel</button>`); if (!show && nx) nx.remove(); });
    const tag = document.getElementById('roleTag'); if (tag && role() === 'editor' && !P(page(), 'e')) tag.textContent = 'Editor · lihat saja di menu ini';
  }
  const orig = window.render;
  if (typeof orig === 'function') window.render = function () {
    if (MPP && WEB.role === 'editor') { try { CAN_EDIT = P(page(), 'e'); ROLE = CAN_EDIT ? 'Editor' : 'Editor · lihat saja'; } catch (e) {} }
    const r = orig.apply(this, arguments); try { after(); } catch (e) {} return r;
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('#xlsTop'); if (!b) return;
    e.preventDefault(); e.stopPropagation(); if (!P('excel', 'd')) return;
    try { MPP ? exportXLSX() : exportExcel(); } catch (err) { console.error(err); }
  }, true);
  try { after(); } catch (e) {}
})();
