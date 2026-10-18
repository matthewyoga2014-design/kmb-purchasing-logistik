
// ================= v11: in-page document viewer =================
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Gagal memuat ' + src)); document.head.appendChild(s); }); }
let PDFJS = null;
async function ensurePdfJs() {
  if (PDFJS) return PDFJS;
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
  PDFJS = window.pdfjsLib; return PDFJS;
}
function viewerEl() {
  let v = document.getElementById('viewer');
  if (!v) { v = document.createElement('div'); v.id = 'viewer'; v.className = 'modal'; v.style.zIndex = 60; v.innerHTML = '<div class="dialog vdlg" role="dialog" aria-modal="true" aria-labelledby="vTitle"></div>'; document.body.appendChild(v); }
  return v;
}
async function openFile(id, name) {
  const v = viewerEl(), d = v.querySelector('.vdlg');
  d.innerHTML = `<div class="cm-h"><h2 id="vTitle">${esc(name || 'Berkas')}</h2><div class="acts">${DL ? '<button type="button" class="btn btn-g btn-sm" id="vDl" disabled>Download</button>' : ''}<button type="button" class="x" id="vClose" aria-label="Tutup">×</button></div></div><div class="vbody" id="vBody"><div class="upst"><span class="spin sm"></span>Memuat berkas…</div></div>`;
  v.hidden = false;
  let blob;
  try {
    const r = await fetch('/_blob/' + id, { credentials: 'include' });
    if (!r.ok) throw new Error(r.status === 404 ? 'Berkas tidak ditemukan.' : 'Berkas tidak bisa dibuka (kode ' + r.status + ').');
    blob = await r.blob();
  } catch (e) {
    document.getElementById('vBody').innerHTML = `<div class="empty">${esc(e.message || 'Berkas tidak bisa dibuka di tampilan ini.')}<br><span class="small">Berkas hanya bisa dibuka oleh akun pemilik saat membuka halaman di claude.ai.</span></div>`;
    return;
  }
  const dl = document.getElementById('vDl');
  if (dl) { dl.disabled = false; dl.onclick = () => save(name || ('berkas_' + id + (blob.type === 'application/pdf' ? '.pdf' : '.png')), blob); }
  const body = document.getElementById('vBody');
  if (/^image\//.test(blob.type)) { const u = URL.createObjectURL(blob); body.innerHTML = `<img src="${u}" alt="${esc(name || 'Berkas')}" class="vimg">`; return; }
  if (blob.type === 'application/pdf' || /\.pdf$/i.test(name || '')) {
    try {
      const lib = await ensurePdfJs();
      const doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
      body.innerHTML = `<div class="small" style="margin-bottom:8px">${doc.numPages} halaman</div>`;
      const w = Math.min(860, body.clientWidth || 700);
      for (let i = 1; i <= doc.numPages; i++) {
        const pg = await doc.getPage(i); const vp0 = pg.getViewport({ scale: 1 }); const sc = (w / vp0.width) * (window.devicePixelRatio || 1);
        const vp = pg.getViewport({ scale: sc }); const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; c.className = 'vpage';
        body.appendChild(c); await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      }
    } catch (e) { body.innerHTML = `<div class="empty">PDF tidak bisa ditampilkan di sini${DL ? ', gunakan tombol Download untuk membukanya' : ''}.<br><span class="small">${esc(e.message || '')}</span></div>`; }
    return;
  }
  body.innerHTML = `<div class="empty">Pratinjau tidak tersedia untuk jenis berkas ini.${DL ? ' Gunakan tombol Download.' : ''}</div>`;
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a.fchip2');
  if (a) { e.preventDefault(); e.stopPropagation(); const id = (a.getAttribute('href') || '').split('/_blob/')[1]; if (id) openFile(id, a.getAttribute('title') || a.textContent.trim()); return; }
  if (e.target.id === 'vClose' || e.target.id === 'viewer') { e.stopPropagation(); document.getElementById('viewer').hidden = true; }
}, true);
document.addEventListener('keydown', (e) => { const v = document.getElementById('viewer'); if (e.key === 'Escape' && v && !v.hidden) { e.stopImmediatePropagation(); v.hidden = true; } }, true);

// ================= v12: unit icons per jenis unit =================
const UI_PATHS = {
  excavator: '<rect x="2" y="16.5" width="12" height="4" rx="2"/><circle cx="5" cy="18.5" r=".6"/><circle cx="11" cy="18.5" r=".6"/><path d="M3 16.5V12h3l1-3h4v7.5"/><path d="M11 11l5-6.5 5 4.5-.6 3.5h-3l.8-2.6"/>',
  bulldozer: '<rect x="3" y="15.5" width="13" height="5" rx="2.5"/><circle cx="6" cy="18" r=".7"/><circle cx="13" cy="18" r=".7"/><path d="M5 15.5V11h3V6h5l1.2 5H16v4.5"/><path d="M16 13h3M19.5 8.5c1.5 3.5 1.5 8 0 12h2"/>',
  grader: '<path d="M2 14.5h5V8.5h4.5l1 4h9.5v2"/><path d="M7 14.5h15"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="M10 19.5l5.5-1.8M12.5 14.5l.5 3.5"/>',
  tower: '<rect x="7" y="3" width="10" height="4" rx="1"/><path d="M9 5h.01M12 5h.01M15 5h.01"/><path d="M12 7v10M9.5 17L12 12l2.5 5"/><path d="M4 17h16v2H4z"/><circle cx="7.5" cy="21" r="1"/><circle cx="16.5" cy="21" r="1"/>',
  genset: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M13 8.5l-3 4h4l-3 4"/><path d="M5 9.5v5M19 9.5v5M6 18v2M18 18v2"/>',
  fuel: '<rect x="2" y="6.5" width="12" height="8.5" rx="4.25"/><path d="M14 9.5h3.5l3.5 3.5V16H2"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M8 8.6c-1.1 1.4-1.6 2.2-1.6 3a1.6 1.6 0 003.2 0c0-.8-.5-1.6-1.6-3z"/>',
  water: '<rect x="2" y="6.5" width="12" height="8.5" rx="4.25"/><path d="M14 9.5h3.5l3.5 3.5V16H2"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M4.2 10.2c1-.8 1.9-.8 2.9 0s1.9.8 2.9 0M4.2 12.6c1-.8 1.9-.8 2.9 0s1.9.8 2.9 0"/>',
  bus: '<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M4 6.5h16"/><path d="M8 14.5h.01M16 14.5h.01"/><path d="M7 18v2.5M17 18v2.5"/>',
  lube: '<rect x="2" y="5.5" width="12" height="10.5" rx="1"/><path d="M14 9.5h3.5l3.5 3.5V16H2"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M5 12.5h4.5l2-2.5M5 12.5v-2.5h3.5v2.5M6.5 10V8.5"/>',
  compressor: '<rect x="2.5" y="10" width="15" height="7" rx="3.5"/><circle cx="10" cy="5.5" r="2.5"/><path d="M10 8v2M10 5.5l1.2-1.2"/><path d="M17.5 13.5H21v-4"/><path d="M5.5 17v3M14.5 17v3"/>',
  dump: '<path d="M2 6.5l12 1.5-1.4 6.5H3.2z"/><path d="M14 9.5h3.5l3.5 3.5V16H2"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  welder: '<rect x="2" y="9" width="11" height="10" rx="1.5"/><circle cx="5.5" cy="13" r="1.3"/><path d="M8.5 12.2h2.5M8.5 15.2h2.5M4 16.5h3"/><path d="M13 16c2.5 0 4-1.5 4-4l2.5-2.5"/><path d="M20.5 4v2.2M23 7.5h-2.2M22.4 5.1l-1.5 1.5"/>',
  pump: '<circle cx="9" cy="13" r="5"/><path d="M9 13l2.4-2.4"/><path d="M14 13h4V7.5h-2.5M1.5 13H4"/><path d="M4 20h10M9 18v2"/><path d="M21 12c-.9 1.1-1.3 1.8-1.3 2.4a1.3 1.3 0 002.6 0c0-.6-.4-1.3-1.3-2.4z"/>',
  truck: '<path d="M2 7h12v9H2zM14 10h3.5l3.5 3.5V16h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
};
function unitKind(n) {
  n = (n || '').toLowerCase();
  if (/excav|backhoe|pc\s?\d/.test(n)) return 'excavator';
  if (/dozer|bulldoz/.test(n)) return 'bulldozer';
  if (/grader/.test(n)) return 'grader';
  if (/tower|lamp|lampu/.test(n)) return 'tower';
  if (/genset|generator/.test(n)) return 'genset';
  if (/fuel|bbm|solar/.test(n)) return 'fuel';
  if (/water|air/.test(n)) return 'water';
  if (/bus|mainhaul|manhaul/.test(n)) return 'bus';
  if (/lube|oli/.test(n)) return 'lube';
  if (/compres|kompres/.test(n)) return 'compressor';
  if (/^dt\b|dump|tonly|hauler/.test(n)) return 'dump';
  if (/las|weld/.test(n)) return 'welder';
  if (/pomp|pump|pompa/.test(n)) return 'pump';
  return 'truck';
}
const unitIcon = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${UI_PATHS[unitKind(n)]}</svg>`;
function unitBlock(D) {
  return `<div class="card" style="margin-bottom:18px"><div class="ch"><div><div class="eyebrow">Populasi Unit</div><h2>Populasi Unit KTA - TRA</h2><p>Jumlah unit operasional sesuai tabel Jenis Unit di sheet Dashboard.</p></div><span class="pill live">${D.unitTot} unit</span></div>
    <div class="units2">${DATA.units.map((u, i) => { const c = UNIT_COLORS[i % UNIT_COLORS.length]; return `<div style="--uc:${c};--ubg:${tint(c, .07)};--ubd:${tint(c, .22)}"><span class="uic">${unitIcon(u.unit)}</span><span class="un">${esc(u.unit)}</span><b>${u.jumlah}</b></div>`; }).join('') || '<div class="empty">Tabel unit tidak ditemukan.</div>'}</div></div>`;
}

// ================= v13: OPEN / CLOSED stamp on every printed page =================
function stampClosed() { return !(D || derive()).open.length; }
function syncPrintStamp() {
  let s = document.getElementById('printStamp');
  if (!s) { s = document.createElement('div'); s.id = 'printStamp'; s.setAttribute('aria-hidden', 'true'); document.body.appendChild(s); }
  s.className = stampClosed() ? 'closed' : '';
}
window.addEventListener('beforeprint', syncPrintStamp);
async function stampForPdf() {
  try {
    const closed = stampClosed();
    if (!closed) return null;
    const v = getComputedStyle(document.documentElement).getPropertyValue(closed ? '--stamp-closed' : '--stamp-open');
    const m = v.match(/url\(["']?(data:[^"')]+)["']?\)/); if (!m) return null;
    const img = new Image(); img.src = m[1]; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const w = 120, h = w * img.naturalHeight / img.naturalWidth;
    return { url: c.toDataURL('image/png'), w, h, op: closed ? 0.16 : 0.12 };
  } catch (e) { return null; }
}
