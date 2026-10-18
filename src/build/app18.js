
// ================= v22: Struktur Organisasi on the Dashboard (read-only, full width) =================
function dashOrgCard(D) {
  const ce = CAN_EDIT, lay = ui.olay, sec = ui.osec;
  CAN_EDIT = false; ui.olay = 'v'; ui.osec = 'semua';
  let chart; try { chart = orgChart(D); } finally { CAN_EDIT = ce; ui.olay = lay; ui.osec = sec; }
  const fams = [...new Set(D.P.map((p) => roleFamily(p.jabatan)))];
  return `<div class="card orgcard dashorg" style="margin-top:18px"><div class="ch" style="padding:0 18px"><div><div class="eyebrow">Struktur Organisasi</div><h2>Struktur Organisasi KTA - TRA</h2><p>Otomatis dari MPP KTA - TRA. Untuk menata atau mengubah, buka halaman Struktur Organisasi.</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-g btn-sm" data-go="org">Buka halaman SO</button><button type="button" class="btn btn-p btn-sm" id="dashOrgFull">⛶ Layar penuh</button></div></div>
    <div class="olegend">${fams.map((f) => `<span><i style="background:${FAM_COLOR[f] || '#6D28D9'}"></i>${esc(f)}</span>`).join('')}<span><i class="v"></i>Vacant</span><span><b class="lw">⚠</b>Kontrak habis ≤ 30 hari</span></div>
    <div class="orgwrap dashv" id="orgWrapD"><div class="orgsizer" id="orgSizerD">${chart}</div></div></div>`;
}
function fitDashOrg() {
  const wrap = document.getElementById('orgWrapD'), sizer = document.getElementById('orgSizerD'); if (!wrap || !sizer) return;
  const org = sizer.querySelector('.org'); if (!org) return;
  org.style.transform = 'none';
  const w = org.offsetWidth, h = org.offsetHeight, s = Math.min(1, (wrap.clientWidth - 24) / w);
  org.style.transform = `scale(${s})`; sizer.style.width = Math.ceil(w * s) + 'px'; sizer.style.height = Math.ceil(h * s) + 'px';
}
const _pageDashboard18 = pageDashboard;
pageDashboard = function (D) { return _pageDashboard18(D) + dashOrgCard(D); };
const _render18 = render;
render = function () { _render18(); if (ui.page === 'dashboard') fitDashOrg(); };
let _dzT; window.addEventListener('resize', () => { clearTimeout(_dzT); _dzT = setTimeout(() => { if (ui.page === 'dashboard') fitDashOrg(); }, 150); });
window.addEventListener('beforeprint', () => { if (ui.page === 'dashboard') fitDashOrg(); });
document.addEventListener('click', (e) => { if (e.target.closest('#dashOrgFull')) { ui.ofull = true; document.body.classList.add('ofull'); ui.ojump = true; go('org'); document.body.classList.add('ofull'); ui.ofull = true; render(); } });
