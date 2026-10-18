
// ================= v10: colorful rekap, status, due date, units =================
const FAM_COLOR = { 'Staff & Admin': '#4F46E5', 'Tyreman': '#0D9488', 'Welder & Elektrik': '#D97706', 'Mekanik': '#7C3AED', 'Helper Mekanik': '#DB2777' };
function tint(hex, a) { const n = parseInt(hex.slice(1), 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255; const m = (c) => Math.round(255 + (c - 255) * a); return `rgb(${m(r)},${m(g)},${m(b)})`; }
function roleFamily(j) {
  j = (j || '').toLowerCase();
  if (/tyre/.test(j)) return 'Tyreman';
  if (/weld|elektrik|electric/.test(j)) return 'Welder & Elektrik';
  if (/helper/.test(j)) return 'Helper Mekanik';
  if (/mekanik/.test(j)) return 'Mekanik';
  return 'Staff & Admin';
}
function jabChip(j) { const f = roleFamily(j); const c = FAM_COLOR[f] || '#6D28D9'; return `<span class="jchip" style="--jc:${c};--jbg:${tint(c, .1)};--jbd:${tint(c, .28)}"><i></i>${esc(j)}</span>`; }
function statusBoxes(D) {
  const tile = (cls, n, lb, ic) => `<div class="stile ${cls}"><span class="sic">${ic}</span><div><b>${n}</b><span>${lb}</span></div></div>`;
  return `<div class="grid"><div class="card s6"><div class="ch"><div><div class="eyebrow">Status</div><h2>Status PTK</h2></div></div>
    <div class="stiles">${tile('t-open', D.open.length - D.cont.length, 'Open', '●')}${tile('t-cont', D.cont.length, 'Continue', '↻')}${tile('t-close', D.closed.length, 'Close', '✓')}</div></div>
    <div class="card s6"><div class="ch"><div><div class="eyebrow">Due Date</div><h2>Due Date PTK</h2></div></div>
    <div class="stiles">${tile('t-soon', D.ket['HAMPIR JATUH TEMPO'] || 0, 'Hampir jatuh tempo', '⏳')}${tile('t-late', D.ket['JATUH TEMPO'] || 0, 'Jatuh tempo', '!')}${tile('t-done', D.ket['SELESAI'] || 0, 'Selesai', '✓')}</div></div></div>`;
}
const UNIT_COLORS = ['#7C3AED', '#2563EB', '#0D9488', '#D97706', '#DB2777', '#059669', '#4F46E5', '#EA580C'];
const UNIT_IC = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 16V9h9l3 4h5v3H3zM6 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
function unitBlock(D) {
  return `<div class="card" style="margin-bottom:18px"><div class="ch"><div><div class="eyebrow">Populasi Unit</div><h2>Populasi Unit KTA - TRA</h2><p>Jumlah unit operasional sesuai tabel Jenis Unit di sheet Dashboard.</p></div><span class="pill live">${D.unitTot} unit</span></div>
    <div class="units2">${DATA.units.map((u, i) => { const c = UNIT_COLORS[i % UNIT_COLORS.length]; return `<div style="--uc:${c};--ubg:${tint(c, .07)};--ubd:${tint(c, .22)}"><span class="uic">${UNIT_IC}</span><span class="un">${esc(u.unit)}</span><b>${u.jumlah}</b></div>`; }).join('') || '<div class="empty">Tabel unit tidak ditemukan.</div>'}</div></div>`;
}
