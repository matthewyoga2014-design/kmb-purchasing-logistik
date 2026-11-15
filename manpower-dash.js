/* Dashboard Manpower ringkas + sub-menu.
   - Dashboard utama ("Ringkasan") cukup satu layar: angka KPI + 4 kotak ringkas, semuanya bisa diklik ke halaman tujuan.
   - Bagian lain dashboard lama dipindah ke sub-menu Dashboard di sidebar (Progress Rekrutmen, Vacant & Pemenuhan, Status & Unit, Rincian MPP),
     jadi yang digambar hanya bagian yang sedang dibuka (ringan).
   - Print / PDF dari Dashboard tetap mencetak dashboard lengkap seperti sebelumnya (semua bagian dirangkum). */
(function () {
  if (window.__dashSubs) return; window.__dashSubs = true;
  if (typeof pageDashboard !== 'function' || typeof render !== 'function' || typeof ui !== 'object') return;

  const SUBS = [['ringkasan', 'Ringkasan'], ['progress', 'Progress Rekrutmen'], ['vacant', 'Vacant per Jabatan'], ['status', 'Status & Unit'], ['mpp', 'Rincian MPP']];
  const has = (k) => SUBS.some((s) => s[0] === k);
  let saved = null; try { saved = localStorage.getItem('mp-dsub'); } catch (e) {}
  ui.dsub = has(saved) ? saved : 'ringkasan';
  let FULL = false, AUTO = false;
  const fullDash = pageDashboard;
  const E = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const setSub = (k) => { ui.dsub = has(k) ? k : 'ringkasan'; try { localStorage.setItem('mp-dsub', ui.dsub); } catch (e) {} };

  const css = document.createElement('style');
  css.textContent = `
.dsubs{display:grid;gap:1px;margin:0 0 4px 22px;padding-left:12px;border-left:2px solid var(--line,#E8E6F3)}
.nav .dsubs button{padding:7px 10px;font-size:13px;font-weight:500;border-radius:9px}
.nav .dsubs button[aria-current="page"]{font-weight:700}
.nav button .dchev{margin-left:auto;transition:transform .15s;opacity:.7}
.nav button[data-go="dashboard"] .ct + .dchev{margin-left:6px}
.nav button .dchev.up{transform:rotate(180deg)}
.rk-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px;margin-bottom:16px}
.rk-k{all:unset;box-sizing:border-box;cursor:pointer;background:var(--card,#fff);border:1px solid var(--line,#E8E6F3);border-radius:var(--r,14px);padding:14px 16px;display:flex;flex-direction:column;gap:2px;min-width:0;transition:border-color .15s,box-shadow .15s}
.rk-k:hover,.rk-c:hover{border-color:#C9B8F5;box-shadow:0 4px 16px rgba(76,29,149,.08)}
.rk-k:focus-visible,.rk-c:focus-visible{outline:2px solid var(--primary,#6D28D9);outline-offset:2px}
.rk-k span{font-size:12px;font-weight:600;color:var(--ink-2,#4B4868)}
.rk-k b{font-size:28px;font-weight:800;line-height:1.15;color:var(--ink,#1E1B3A);font-variant-numeric:tabular-nums}
.rk-k small{font-size:11.5px;font-weight:600;color:var(--primary-ink,#5B21B6)}
.rk-k.g b{color:#15803D}.rk-k.r b{color:#DC2626}.rk-k.a b{color:#B45309}
.rk-k.p{background:var(--primary,#6D28D9);border-color:var(--primary,#6D28D9)}.rk-k.p span,.rk-k.p b,.rk-k.p small{color:#fff}
.rk-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.rk-c{all:unset;box-sizing:border-box;cursor:pointer;background:var(--card,#fff);border:1px solid var(--line,#E8E6F3);border-radius:var(--r,14px);padding:16px 18px;display:flex;flex-direction:column;gap:10px;min-width:0;min-height:236px;transition:border-color .15s,box-shadow .15s}
.rk-h{display:flex;align-items:flex-start;gap:10px}.rk-h>div{flex:1;min-width:0}
.rk-h .eyebrow{font-size:10px}.rk-h h2{margin:1px 0 0;font-size:16px;font-weight:800;color:var(--ink,#1E1B3A)}
.rk-h em{font-style:normal;font-size:12px;font-weight:700;color:var(--primary-ink,#5B21B6);white-space:nowrap}
.rk-bars{display:grid;grid-template-columns:118px minmax(0,1fr) 28px;gap:6px 10px;align-items:center;font-size:12.5px}
.rk-bars span{color:var(--ink-2,#4B4868);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rk-bars i{display:block;height:9px;border-radius:99px;background:var(--track,#ECEAF6);overflow:hidden}
.rk-bars i u{display:block;height:100%;border-radius:99px;background:#7C3AED;text-decoration:none}
.rk-bars.v i u{background:#F06A6A}
.rk-bars b{text-align:right;font-variant-numeric:tabular-nums}
.rk-don{display:flex;align-items:center;gap:28px;flex:1}
.rk-leg{display:grid;gap:10px;font-size:13px}.rk-leg div{display:flex;align-items:center;gap:10px}
.rk-leg i{width:12px;height:12px;border-radius:4px;display:inline-block}.rk-leg span{color:var(--ink-2,#4B4868);min-width:74px}
.rk-st{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.rk-st div{border-radius:12px;padding:10px 12px;display:flex;flex-direction:column}
.rk-st span{font-size:12px;font-weight:600}.rk-st b{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums}
.rk-st .g{background:#DCFCE7}.rk-st .g span{color:#166534}.rk-st .g b{color:#15803D}
.rk-st .a{background:#FEF3C7}.rk-st .a span{color:#92400E}.rk-st .a b{color:#B45309}
.rk-st .r{background:#FEE2E2}.rk-st .r span{color:#991B1B}.rk-st .r b{color:#DC2626}
.rk-row{display:flex;gap:10px}.rk-row div{flex:1;border:1px solid var(--line,#E8E6F3);border-radius:12px;padding:9px 12px;display:flex;align-items:center;justify-content:space-between;font-size:13px;gap:8px}
.rk-row span{color:var(--ink-2,#4B4868)}.rk-row b{font-size:17px;font-variant-numeric:tabular-nums}
.rk-empty{font-size:13px;color:var(--muted,#8A87A6);padding:8px 0}
.dsub-bar{display:flex;gap:8px;flex-wrap:wrap;margin:-4px 0 16px}
.dsub-bar button{all:unset;cursor:pointer;font-size:12.5px;font-weight:600;padding:6px 12px;border-radius:99px;border:1px solid var(--line,#E8E6F3);background:var(--card,#fff);color:var(--ink-2,#4B4868)}
.dsub-bar button[aria-current="page"]{background:var(--primary-soft,#EFE9FE);border-color:#DDD0FA;color:var(--primary-ink,#5B21B6)}
.dsub-bar button:focus-visible{outline:2px solid var(--primary,#6D28D9);outline-offset:2px}
@media (max-width:1100px){.rk-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.rk-grid{grid-template-columns:minmax(0,1fr)}}
@media (max-width:560px){.rk-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.rk-bars{grid-template-columns:96px minmax(0,1fr) 24px}.rk-don{gap:16px}.rk-don svg{width:118px;height:118px}}
@media print{.dsub-bar{display:none!important}}`;
  document.head.appendChild(css);

  function title() {
    let t = '';
    try { t = (typeof PROJ_CFG !== 'undefined' && PROJ_CFG && PROJ_CFG.title) || ''; } catch (e) {}
    if (!t) t = document.title || 'Monitoring Manpower';
    t = t.replace(/^Monitoring/i, 'Dashboard');
    try { if (typeof PROJ !== 'undefined' && PROJ && PROJ.sites && typeof siteName === 'function') { const s = siteName(); if (s) t += ' · ' + s; } } catch (e) {}
    return t;
  }
  const isAct = (c) => c.st === 'pr' || c.st === 'hd';

  // ---------- Ringkasan (1 layar) ----------
  function ringkasan(D) {
    const nPel = D.P.reduce((a, p) => a + candidates(p).filter(isAct).length, 0);
    const nOpen = D.open.length - ((D.cont && D.cont.length) || 0);
    const k = (cls, lb, v, go, sub) => `<button type="button" class="rk-k ${cls}" ${go}><span>${lb}</span><b>${v}</b><small>${sub} →</small></button>`;
    // progress per tahap (pelamar aktif di PTK open)
    let act = [0, 0, 0, 0, 0, 0, 0, 0];
    try { act = pipeSeries(D.open).act; } catch (e) {}
    const st = [['Sourcing / CV', act[0]], ['Psikologi Test', act[1]], ['Interview User', act[2]], ['Offering Letter', act[3]], ['MCU / FU MCU', (act[4] || 0) + (act[5] || 0)], ['On Site', act[6]], ['Induksi', act[7]]];
    const mx = Math.max(1, ...st.map((x) => x[1] || 0));
    const bars = st.map(([l, n]) => `<span>${l}</span><i><u style="width:${Math.round((n || 0) / mx * 100)}%"></u></i><b>${n || 0}</b>`).join('');
    // pemenuhan
    const pct = D.planning ? Math.round(D.actual / D.planning * 100) : 0, C = 2 * Math.PI * 54;
    const donut = `<svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Pemenuhan MPP ${pct} persen"><circle cx="70" cy="70" r="54" fill="none" stroke="#FEE2E2" stroke-width="18"/><circle cx="70" cy="70" r="54" fill="none" stroke="#7C3AED" stroke-width="18" stroke-dasharray="${(C * pct / 100).toFixed(1)} ${C.toFixed(1)}" stroke-linecap="${pct > 0 && pct < 100 ? 'round' : 'butt'}" transform="rotate(-90 70 70)"/><text x="70" y="72" text-anchor="middle" font-size="26" font-weight="800" fill="#1E1B3A" font-family="inherit">${pct}%</text><text x="70" y="92" text-anchor="middle" font-size="11" fill="#6E6A8C" font-family="inherit">terisi</text></svg>`;
    // vacant terbanyak
    const vac = Object.entries(D.vacJab || {}).map(([j, ps]) => [j, ps.length, ps.reduce((a, p) => a + candidates(p).filter(isAct).length, 0)]).sort((a, b) => b[1] - a[1]);
    const vmx = Math.max(1, ...vac.map((v) => v[1]));
    const vbars = vac.length ? `<div class="rk-bars v" style="grid-template-columns:minmax(0,1fr) minmax(0,1.2fr) 92px">${vac.slice(0, 5).map(([j, n, c]) => `<span title="${E(j)}">${E(j)}</span><i><u style="width:${Math.round(n / vmx * 100)}%"></u></i><b>${n} · ${c} pel.</b>`).join('')}</div>${vac.length > 5 ? `<div class="rk-empty">+${vac.length - 5} jabatan lain</div>` : ''}` : '<div class="rk-empty">Tidak ada posisi vacant.</div>';
    const K = D.ket || {};
    const soon = K['HAMPIR JATUH TEMPO'] || 0, late = K['JATUH TEMPO'] || 0, track = Math.max(0, D.open.length - soon - late);
    const nPos = (typeof DATA !== 'undefined' && DATA.aktif) ? DATA.aktif.length : D.actual;
    return `${header('Dashboard · Ringkasan', E(title()), 'Klik angka atau kotak mana pun untuk membuka halaman detailnya. Print tetap mencetak dashboard lengkap.')}
  <div class="rk-kpis">
    ${k('', 'Planning (MPP)', D.planning, 'data-dsub="mpp"', 'Rincian MPP')}
    ${k('g', 'Actual', D.actual, 'data-go="karyawan"', 'MP Aktif')}
    ${k('r', 'Vacant', D.vacant, 'data-dsub="vacant"', 'Vacant per Jabatan')}
    ${k('a', 'PTK Open', nOpen, 'data-go="mpp" data-dmf="open"', 'MPP terfilter')}
    ${k('', 'PTK Close', D.closed.length, 'data-go="mpp" data-dmf="close"', 'MPP terfilter')}
    ${k('p', 'Pelamar Aktif', nPel, 'data-go="pelamar"', 'Data Pelamar')}
  </div>
  <div class="rk-grid">
    <button type="button" class="rk-c" data-dsub="progress"><div class="rk-h"><div><div class="eyebrow">Recruitment Pipeline</div><h2>Progress Rekrutmen</h2></div><em>Lihat detail →</em></div>
      <div class="rk-bars">${bars}</div></button>
    <button type="button" class="rk-c" data-dsub="progress"><div class="rk-h"><div><div class="eyebrow">Composition</div><h2>Pemenuhan MPP</h2></div><em>Lihat detail →</em></div>
      <div class="rk-don">${donut}<div class="rk-leg"><div><i style="background:#7C3AED"></i><span>Actual</span><b>${D.actual}</b></div><div><i style="background:#FCA5A5"></i><span>Vacant</span><b>${D.vacant}</b></div><div><i style="background:#E8E6F3"></i><span>Planning</span><b>${D.planning}</b></div></div></div></button>
    <button type="button" class="rk-c" data-dsub="vacant"><div class="rk-h"><div><div class="eyebrow">Vacancy</div><h2>Vacant terbanyak</h2></div><em>Vacant per Jabatan →</em></div>${vbars}</button>
    <button type="button" class="rk-c" data-dsub="status"><div class="rk-h"><div><div class="eyebrow">Status PTK &amp; Unit</div><h2>Status &amp; Unit</h2></div><em>Lihat detail →</em></div>
      <div class="rk-st"><div class="g"><span>On Track</span><b>${track}</b></div><div class="a"><span>Hampir jatuh tempo</span><b>${soon}</b></div><div class="r"><span>Jatuh tempo</span><b>${late}</b></div></div>
      <div class="rk-row"><div><span>Populasi Unit</span><b>${D.unitTot || 0}</b></div><div><span>MP Aktif</span><b>${nPos}</b></div></div></button>
  </div>`;
  }

  // ---------- halaman detail: ambil bagian dari dashboard lengkap ----------
  function part(D, k) {
    const t = document.createElement('template'); t.innerHTML = fullDash(D);
    const r = t.content;
    const card = (re) => [...r.querySelectorAll('.card')].find((c) => { const h = c.querySelector('h2'); return h && re.test(h.textContent); });
    const out = (els) => els.filter(Boolean).map((e) => e.outerHTML).join('');
    const g = (els, cls) => { els = els.filter(Boolean); if (!els.length) return ''; if (cls) els.forEach((e, i) => { e.classList.remove('s4', 's5', 's6', 's7', 's8', 's12'); e.classList.add(cls[i] || 's12'); }); return `<div class="grid">${out(els)}</div>`; };
    const head = r.querySelector('.head');
    const lbl = (SUBS.find((s) => s[0] === k) || [k, k])[1];
    if (head) { const ey = head.querySelector('.eyebrow'); if (ey) ey.textContent = 'Dashboard · ' + lbl; const h1 = head.querySelector('h1'); if (h1) h1.textContent = lbl; const p = head.querySelector('p'); if (p) p.textContent = 'Bagian dari Dashboard ' + title().replace(/^Dashboard\s*/i, '') + '. Print tetap mencetak dashboard lengkap.'; }
    const bar = `<div class="dsub-bar" role="group" aria-label="Bagian dashboard">${SUBS.map(([id, l]) => `<button type="button" data-dsub="${id}" ${id === k ? 'aria-current="page"' : ''}>${l}</button>`).join('')}</div>`;
    let body = '';
    if (k === 'progress') body = g([card(/^Progress Kandidat/i), card(/^Pemenuhan MPP/i)], ['s8', 's4']) + out([r.querySelector('#sumCard')]);
    else if (k === 'vacant') body = g([card(/^Vacant per Jabatan/i), card(/^Resume Vacant/i)], ['s5', 's7']) + out([card(/^Rekapitulasi/i)]);
    else if (k === 'status') { const sg = [...r.querySelectorAll('.grid')].find((x) => x.querySelector('.stiles')); body = out([sg, r.querySelector('.ud-summary-panel') || card(/Populasi Unit/i)]); }
    else if (k === 'mpp') body = out([card(/^Rincian Manpower/i)]);
    return (head ? head.outerHTML : '') + bar + (body || '<div class="card"><div class="empty">Bagian ini belum ada data.</div></div>');
  }

  pageDashboard = function (D) {
    if (FULL) return fullDash(D);
    try { return ui.dsub && ui.dsub !== 'ringkasan' ? part(D, ui.dsub) : ringkasan(D); }
    catch (e) { console.error(e); return fullDash(D); }
  };

  // ---------- sub-menu Dashboard di sidebar ----------
  const CHEV = '<svg class="dchev" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function navSubs() {
    const nav = document.getElementById('nav'); if (!nav) return;
    const b = nav.querySelector('button[data-go="dashboard"]'); if (!b) return;
    const open = ui.page === 'dashboard';
    if (!b.querySelector('.dchev')) b.insertAdjacentHTML('beforeend', CHEV);
    b.querySelector('.dchev').classList.toggle('up', open);
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
    let box = nav.querySelector('.dsubs');
    if (!box) { box = document.createElement('div'); box.className = 'dsubs'; b.after(box); }
    box.hidden = !open;
    box.innerHTML = SUBS.map(([id, l]) => `<button type="button" data-go="dashboard" data-dsub="${id}" ${open && ui.dsub === id ? 'aria-current="page"' : ''}>${l}</button>`).join('');
    if (open) b.removeAttribute('aria-current');
  }
  const _render = render;
  render = function () { const r = _render.apply(this, arguments); try { navSubs(); } catch (e) {} return r; };

  document.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('[data-dsub],[data-go="dashboard"],[data-dmf]');
    if (!t || e.target.closest('#modal')) return;
    if (t.dataset.dmf) { ui.mf = t.dataset.dmf; return; }   // lalu tombol data-go="mpp" membuka MPP terfilter
    if (t.dataset.dsub) {
      setSub(t.dataset.dsub);
      if (!t.dataset.go) { e.preventDefault(); e.stopPropagation(); ui.page = 'dashboard'; render(); window.scrollTo({ top: 0 }); }
      return;
    }
    if (t.closest('#nav')) setSub('ringkasan');   // klik "Dashboard" di sidebar → Ringkasan
  }, true);
  // "Lihat detail" di Resume Vacant → buka Progress Rekrutmen (Summary) dengan filter jabatan
  document.addEventListener('click', (e) => {
    const d = e.target.closest && e.target.closest('[data-detail]');
    if (d && ui.page === 'dashboard' && !e.target.closest('#modal') && ui.dsub !== 'progress' && !FULL) setSub('progress');
  }, true);

  // ---------- Print: selalu dashboard lengkap ----------
  function goFull() { if (ui.page !== 'dashboard' || FULL) return false; FULL = true; render(); return true; }
  function goBack() { if (!FULL) return; FULL = false; AUTO = false; if (ui.page === 'dashboard') render(); }
  window.addEventListener('beforeprint', () => { if (goFull()) AUTO = true; }, true);
  window.addEventListener('afterprint', () => { if (AUTO) setTimeout(goBack, 0); });
  if (typeof printPDF === 'function') {
    const _p = printPDF;
    printPDF = async function () {
      if (ui.page !== 'dashboard') return _p.apply(this, arguments);
      let top = false; try { top = window.top === window.self; } catch (e) {}
      const did = goFull(); if (did && top) AUTO = true;   // jendela Print biasa: kembali setelah afterprint
      try { return await _p.apply(this, arguments); }
      finally { if (did && !top) goBack(); }
    };
  }

  try { if (ui.page === 'dashboard') render(); else navSubs(); } catch (e) {}
})();
