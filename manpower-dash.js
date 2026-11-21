/* Dashboard Manpower ringkas + sub-menu.
   - Dashboard utama ("Ringkasan") cukup satu layar: angka KPI + 4 kotak ringkas, semuanya bisa diklik ke halaman tujuan.
   - Bagian lain dashboard lama dipindah ke sub-menu Dashboard di sidebar (Progress Rekrutmen, Vacant & Pemenuhan, Status & Unit, Rincian MPP),
     jadi yang digambar hanya bagian yang sedang dibuka (ringan).
   - Print / PDF dari Dashboard tetap mencetak dashboard lengkap seperti sebelumnya (semua bagian dirangkum). */
(function () {
  if (window.__dashSubs) return; window.__dashSubs = true;
  if (typeof pageDashboard !== 'function' || typeof render !== 'function' || typeof ui !== 'object') return;

  const SUBS = [['ringkasan', 'Ringkasan'], ['progress', 'Progress Rekrutmen'], ['vacant', 'Vacant per Jabatan'], ['unit', 'Populasi Unit'], ['mpp', 'Rincian MPP']];
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
.rk-c.rk-split{cursor:default}.rk-c.rk-split:hover{border-color:var(--line,#E8E6F3);box-shadow:none}
.rk-sub{all:unset;box-sizing:border-box;cursor:pointer;display:grid;gap:8px;border-radius:12px;padding:4px;margin:-4px}
.rk-sub:hover{background:var(--card-2,#F7F6FD)}.rk-sub:focus-visible{outline:2px solid var(--primary,#6D28D9);outline-offset:2px}
.rk-sub small{font-size:11.5px;font-weight:700;color:var(--primary-ink,#5B21B6)}
.up-card .ch{margin-bottom:10px}
.up-tw{overflow-x:auto;border:1px solid var(--line,#E8E6F3);border-radius:12px}
.up-t{width:100%;border-collapse:collapse;font-size:12.5px}
.up-t th{background:var(--card-2,#F7F6FD);color:var(--ink-2,#4B4868);font-size:11.5px;font-weight:700;text-align:left;padding:8px 12px;white-space:nowrap;border-bottom:1px solid var(--line,#E8E6F3)}
.up-t td{padding:8px 12px;border-bottom:1px solid var(--line,#E8E6F3);vertical-align:middle}
.up-t tr:last-child td{border-bottom:0}.up-t tfoot td{background:var(--card-2,#F7F6FD);font-weight:800}
.up-t td.u{font-weight:700;white-space:nowrap}
.up-n{display:flex;align-items:center;gap:8px;min-width:120px}.up-n b{min-width:22px;text-align:right;font-variant-numeric:tabular-nums}
.up-n i{flex:1;height:7px;border-radius:99px;background:var(--track,#ECEAF6);overflow:hidden;display:block}.up-n i u{display:block;height:100%;background:#7C3AED;border-radius:99px}
.uc{display:inline-flex;align-items:center;gap:5px;margin:2px 8px 2px 0;white-space:nowrap;color:var(--ink,#1E1B3A)}
.uc i{width:8px;height:8px;border-radius:50%;background:#B9B6CC;display:inline-block}.uc b{font-variant-numeric:tabular-nums}
.uc.g i{background:#16A34A}.uc.a i{background:#F59E0B}.uc.r i{background:#DC2626}.uc.n{color:var(--muted,#8A87A6)}
.ucfg{position:relative}.ucfg summary{list-style:none;cursor:pointer}.ucfg summary::-webkit-details-marker{display:none}
.ucfg .ucfg-p{position:absolute;right:0;top:calc(100% + 6px);z-index:20;background:#fff;border:1px solid var(--line,#E8E6F3);border-radius:12px;box-shadow:0 12px 32px rgba(30,27,58,.14);padding:12px 14px;min-width:230px;display:grid;gap:8px}
.ucfg label{display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer}.ucfg .ucfg-p p{margin:0;font-size:11.5px;color:var(--muted,#8A87A6)}
.rkm{position:relative;display:inline-block}.rkm summary{list-style:none;cursor:pointer}.rkm summary::-webkit-details-marker{display:none}.rkm-p{position:absolute;right:0;top:calc(100% + 6px);z-index:30;background:#fff;border:1px solid var(--line,#E8E6F3);border-radius:12px;box-shadow:0 12px 32px rgba(30,27,58,.14);padding:6px;min-width:200px;display:grid;gap:2px}.rkm-p button{all:unset;cursor:pointer;display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:9px;font-size:13.5px;font-weight:600;color:var(--ink,#1E1B3A)}.rkm-p button:hover,.rkm-p button:focus-visible{background:var(--primary-soft,#EFE9FE);color:var(--primary-ink,#5B21B6)}
@media print{#rkBtn,.dsub-bar,.ucfg,.up-card [data-go]{display:none!important}.up-tw{overflow:visible}}`;
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

  // ---------- Populasi Unit ringkas (kolom bisa diatur) ----------
  const UCOLS = [['vendor', 'Vendor'], ['merk', 'Merek'], ['model', 'Model / Tipe'], ['status', 'Status Operasional'], ['kondisi', 'Kondisi'], ['jobsite', 'Jobsite']];
  const UMISS = { vendor: 'Belum diisi', merk: 'Belum diisi', model: 'Belum diisi', status: 'Belum diketahui', kondisi: 'Belum diperiksa', jobsite: 'Belum diisi' };
  const UDEF = ['merk', 'status', 'kondisi'];
  function ucols() {
    let c = null;
    try { c = STATE && STATE.meta && STATE.meta.unitCols; } catch (e) {}
    if (!Array.isArray(c)) { try { c = JSON.parse(localStorage.getItem('mp-unitcols') || 'null'); } catch (e) {} }
    if (!Array.isArray(c)) c = UDEF;
    return UCOLS.map((x) => x[0]).filter((k) => c.includes(k));
  }
  function unitList() {
    const us = (typeof DATA !== 'undefined' && Array.isArray(DATA.units)) ? DATA.units : [];
    return us.map((u) => { const ds = Array.isArray(u.details) ? u.details : []; return { u, ds, n: Math.max(+u.jumlah || 0, ds.length) }; }).filter((x) => x.n > 0 || x.u.unit).sort((a, b) => b.n - a.n);
  }
  function tone(k, v) {
    if (k !== 'status' && k !== 'kondisi') return '';
    v = v.toLowerCase();
    if (/^belum/.test(v)) return 'n';
    if (/breakdown|rusak berat|^rusak$|down|tidak (jalan|operasi|layak)|scrap|afkir/.test(v)) return 'r';
    if (/standby|stand by|ringan|servis|service|perbaikan|repair|menunggu|cukup/.test(v)) return 'a';
    if (/operasi|operasional|ready|baik|jalan|aktif|normal|good|layak/.test(v)) return 'g';
    return '';
  }
  function ucount(x, k) {
    const m = new Map();
    x.ds.forEach((d) => { const v = String((d && d[k]) || '').trim() || UMISS[k]; m.set(v, (m.get(v) || 0) + 1); });
    const miss = x.n - x.ds.length; if (miss > 0) m.set(UMISS[k], (m.get(UMISS[k]) || 0) + miss);
    return [...m].sort((a, b) => (/^belum/i.test(a[0]) - /^belum/i.test(b[0])) || b[1] - a[1]);
  }
  function unitSimple() {
    const L = unitList(), cols = ucols(), tot = L.reduce((a, x) => a + x.n, 0), mx = Math.max(1, ...L.map((x) => x.n));
    let ce = false; try { ce = !!CAN_EDIT; } catch (e) {}
    const canGo = typeof permOf !== 'function' || permOf('unit', 'v');
    const cfg = ce ? `<details class="ucfg"><summary class="btn btn-g btn-sm">⚙ Atur kolom</summary><div class="ucfg-p"><p>Kolom yang tampil di dashboard Populasi Unit (berlaku untuk semua pengguna):</p>${UCOLS.map(([k, l]) => `<label><input type="checkbox" data-ucol="${k}" ${cols.includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}<button type="button" class="btn btn-p btn-sm" id="ucfgSave">Simpan</button></div></details>` : '';
    const head = `<tr><th>Jenis Unit</th><th>Jumlah</th>${cols.map((k) => `<th>${UCOLS.find((x) => x[0] === k)[1]}</th>`).join('')}</tr>`;
    const rows = L.map((x) => `<tr><td class="u">${E(x.u.unit || '-')}</td><td><div class="up-n"><b>${x.n}</b><i><u style="width:${Math.round(x.n / mx * 100)}%"></u></i></div></td>${cols.map((k) => `<td>${ucount(x, k).map(([v, n]) => `<span class="uc ${tone(k, v) || (/^belum/i.test(v) ? 'n' : '')}">${tone(k, v) ? '<i></i>' : ''}${E(v)} <b>${n}</b></span>`).join('')}</td>`).join('')}</tr>`).join('');
    return `<div class="card up-card" style="margin-bottom:18px"><div class="ch"><div><div class="eyebrow">Populasi Unit</div><h2>Populasi Unit</h2><p>Ringkasan per jenis unit. Angka di tiap kolom = jumlah unit${L.some((x) => x.n > x.ds.length) ? '; unit yang identitasnya belum dicatat masuk "Belum diisi / diketahui / diperiksa"' : ''}.</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="pill">${tot} unit · ${L.length} jenis</span>${cfg}${canGo ? '<button type="button" class="btn btn-g btn-sm" data-go="unit">Lihat data lengkap →</button>' : ''}</div></div>
      ${L.length ? `<div class="up-tw"><table class="up-t"><thead>${head}</thead><tbody>${rows}</tbody><tfoot><tr><td>Total</td><td><div class="up-n"><b>${tot}</b></div></td>${cols.map(() => '<td></td>').join('')}</tr></tfoot></table></div>` : '<div class="empty">Belum ada data unit.</div>'}</div>`;
  }
  document.addEventListener('click', async (e) => {
    const b = e.target.closest && e.target.closest('#ucfgSave'); if (!b) return;
    const cols = [...document.querySelectorAll('[data-ucol]')].filter((x) => x.checked).map((x) => x.dataset.ucol);
    try { localStorage.setItem('mp-unitcols', JSON.stringify(cols)); } catch (err) {}
    let ok = false;
    if (typeof commit === 'function') { b.disabled = true; try { ok = await commit((n) => { n.meta = { ...(n.meta || {}), unitCols: cols }; }, 'Kolom Populasi Unit disimpan.'); } catch (err) { ok = false; } b.disabled = false; }
    if (!ok) render();
  });

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
    const UL = unitList(), uTot = UL.reduce((a, u) => a + u.n, 0), uJenis = UL.length;
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
    <div class="rk-c rk-split"><div class="rk-h"><div><div class="eyebrow">Status PTK &amp; Unit</div><h2>Due Date PTK &amp; Populasi Unit</h2></div></div>
      <button type="button" class="rk-sub" data-dsub="vacant"><div class="rk-st"><div class="g"><span>On Track</span><b>${track}</b></div><div class="a"><span>Hampir jatuh tempo</span><b>${soon}</b></div><div class="r"><span>Jatuh tempo</span><b>${late}</b></div></div><small>Status PTK di Vacant per Jabatan →</small></button>
      <button type="button" class="rk-sub" data-dsub="unit"><div class="rk-row"><div><span>Populasi Unit</span><b>${uTot}</b></div><div><span>Jenis Unit</span><b>${uJenis}</b></div></div><small>Populasi Unit →</small></button></div>
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
    else if (k === 'vacant') { const sg = [...r.querySelectorAll('.grid')].find((x) => x.querySelector('.stiles')); body = out([sg]) + g([card(/^Vacant per Jabatan/i), card(/^Resume Vacant/i)], ['s5', 's7']) + out([card(/^Rekapitulasi/i)]); }
    else if (k === 'unit') body = unitSimple(D);
    else if (k === 'mpp') body = out([card(/^Rincian Manpower/i)]);
    return (head ? head.outerHTML : '') + bar + (body || '<div class="card"><div class="empty">Bagian ini belum ada data.</div></div>');
  }

  pageDashboard = function (D) {
    if (FULL) {
      const t = document.createElement('template'); t.innerHTML = fullDash(D);
      const u = t.content.querySelector('.ud-summary-panel') || [...t.content.querySelectorAll('.card')].find((c) => { const h = c.querySelector('h2'); return h && /^Populasi Unit/i.test(h.textContent); });
      if (u) { const x = document.createElement('template'); x.innerHTML = unitSimple(D); u.replaceWith(x.content); }
      return t.innerHTML;
    }
    try { return ui.dsub && ui.dsub !== 'ringkasan' ? part(D, ui.dsub) : ringkasan(D); }
    catch (e) { console.error(e); return fullDash(D); }
  };

  // ---------- Print Rekap MPP per jobsite (format tabel: No, Jabatan, Plan, Actual, Vacant, Progress) ----------
  // keterangan per posisi open, urutan sama seperti di MPP: pelamar aktif dulu (tebal), yang tidak aktif dicoret
  const rkActive = (c) => !c.status || c.status === 'Aktif' || c.status === 'Hold' || c.status === 'Diterima';
  const RK_STEP = ['Psikotes', 'Interview User', 'Offering Letter', 'MCU', 'FU MCU', 'On Site', 'Induksi'];
  const RK_ST = { 'Tidak Lolos': 'Tidak Lolos', 'Mundur': 'Mundur', 'No Response': 'No Response', 'Menolak OL': 'Menolak Offering Letter', 'Hold': 'Hold' };
  function rkStep(c) {
    let k = -1; (Array.isArray(c.dates) ? c.dates : []).forEach((d, i) => { if (d) k = i; });
    return k >= 0 ? RK_STEP[k] : c.scr ? 'Screening CV' : 'Berkas Lamaran / CV';
  }
  // format: Nama - Tahap terakhir - Keterangan (keterangan kosong → cukup sampai tahap)
  // format: Nama - Tahap terakhir - Keterangan (keterangan kosong → cukup sampai tahap)
  function rkLine(c) {
    const st = String(c.status || '').trim();
    let note = String(c.note || '').trim();
    if (note && note.toLowerCase() === st.toLowerCase()) note = '';
    if (!note && st && st !== 'Aktif' && st !== 'Diterima') note = RK_ST[st] || st;
    if (!note && st === 'Diterima') note = 'Diterima';
    return { k: rkActive(c) ? 'act' : 'cx', t: [c.name, rkStep(c), note].filter(Boolean).join(' - ') };
  }
  function rkKet(p) {
    const cs = (Array.isArray(p.cands) ? p.cands : []).filter((c) => c && c.name);
    if (!cs.length) return [{ k: 'plain', t: String(p.ket || '').trim() || 'Sourcing kandidat' }];
    return [...cs.filter(rkActive), ...cs.filter((c) => !rkActive(c))].map(rkLine);
  }
  // model satu baris per jabatan; dipakai untuk Print dan Excel
  //   names: [{t, red}]   ket: blok-blok [{k:'ok'|'terisi'|'lbl'|'act'|'cx'|'plain', t, ptk}]
  // urutan jabatan di rekap: Dept Head → Supervisor → Planner → Senior Mekanik → Mid Mekanik → Junior Mekanik → Admin Plant → Welder → Tyreman → (lainnya) → Helper
  function rkRank(j) {
    const s = String(j || '').toLowerCase();
    if (/helper/.test(s)) return 10;
    if (/dep(ar)?t(e?men)?\.?\s*head|kepala\s*dep/.test(s)) return 1;
    if (/supervisor|\bspv\b|section\s*head|sect\.?\s*head/.test(s)) return 2;
    if (/planner/.test(s)) return 3;
    if (/tyre|tire|ban\b/.test(s)) return 9;
    if (/weld|las\b/.test(s)) return 8;
    if (/admin/.test(s)) return 7;
    if (/senior|\bsr\.?\b/.test(s)) return 4;
    if (/mid+le|\bmid\b|madya/.test(s)) return 5;
    if (/junior|\bjr\.?\b/.test(s)) return 6;
    if (/mek|mech/.test(s)) return 5;
    return 9.5;
  }
  function rkRows(d) {
    const P = (d && Array.isArray(d.positions)) ? d.positions : [], m = new Map();
    P.forEach((p) => {
      const j = String(p.jabatan || '').trim() || '-';
      const r = m.get(j) || { j, plan: 0, act: 0, filled: [], repl: [], ket: [], nOpen: 0 }; m.set(j, r);
      r.plan++;
      const nm = String(p.nama || '').trim() || '-', vac = /^vacant$/i.test(nm);
      const open = vac || (!!p.ptk && /open|continue/i.test(String(p.status || '')));   // vacant, atau masih terisi tapi PTK open (mau diganti)
      if (!vac) r.act++;
      if (!vac) (open ? r.repl : r.filled).push(nm);
      if (open) { r.nOpen++; r.ket.push({ lbl: vac ? 'Vacant' : nm + ' (diganti)', ptk: p.ptk ? (/^ptk/i.test(p.ptk) ? '' : 'PTK ') + p.ptk : '', lines: rkKet(p) }); }
    });
    return [...m.values()].map((r, i) => ({ r, i, k: rkRank(r.j) })).sort((a, b) => a.k - b.k || a.i - b.i).map(({ r }) => {
      const vac = r.plan - r.act;
      // Nama: kalau ada vacant cukup "N Vacant" (+ nama yang akan diganti); yang sudah terisi pindah ke Keterangan
      const names = vac ? [{ t: vac + ' Vacant', red: true }].concat(r.repl.map((n) => ({ t: n, red: true })))
        : r.filled.map((n) => ({ t: n })).concat(r.repl.map((n) => ({ t: n, red: true })));
      const blocks = [];
      if (vac && r.filled.length) blocks.push([{ k: 'terisi', t: r.filled.join(', ') }]);
      const showLbl = r.nOpen > 1 || blocks.length;
      r.ket.forEach((k) => blocks.push((showLbl || k.lbl !== 'Vacant' ? [{ k: 'lbl', t: k.lbl, ptk: k.ptk }] : []).concat(k.lines)));
      return { j: r.j, plan: r.plan, act: r.act, vac, names, ket: blocks.length ? blocks : [[{ k: 'ok', t: 'Terpenuhi' }]] };
    });
  }
  function rkHtmlLine(x) {
    if (x.k === 'ok') return `<span class="ok">${E(x.t)}</span>`;
    if (x.k === 'terisi') return `<div><span class="ok">Terisi:</span> ${E(x.t)}</div>`;
    if (x.k === 'lbl') return `<div class="kl"><span class="op">${E(x.t)}</span>${x.ptk ? ' · ' + E(x.ptk) : ''}</div>`;
    return `<div class="${x.k === 'act' ? 'ca' : x.k === 'cx' ? 'cx' : ''}">${E(x.t)}</div>`;
  }
  function rkGrand(sites) {
    let pl = 0, ac = 0; sites.forEach(([, d]) => rkRows(d).forEach((r) => { pl += r.plan; ac += r.act; }));
    return { pl, ac, vc: pl - ac };
  }
  function rkTable(name, d) {
    const R = rkRows(d), n = Math.max(7, R.length), sum = (k) => R.reduce((a, r) => a + r[k], 0);
    let body = '';
    for (let i = 0; i < n; i++) {
      const r = R[i];
      const nm = r ? r.names.map((x) => x.red ? `<span class="op">${E(x.t)}</span>` : `<span>${E(x.t)}</span>`).join(', ') : '';
      const kt = r ? r.ket.map((b) => `<div class="kp">${b.map(rkHtmlLine).join('')}</div>`).join('') : '';
      body += `<tr><td class="c">${i + 1}</td><td>${r ? E(r.j) : ''}</td><td class="nm">${nm}</td><td class="c">${r ? r.plan : ''}</td><td class="c">${r ? r.act : ''}</td><td class="c">${r ? r.vac : 0}</td><td class="kt">${kt}</td></tr>`;
    }
    return `<table><colgroup><col style="width:5%"><col style="width:16%"><col style="width:24%"><col style="width:7.5%"><col style="width:7.5%"><col style="width:7.5%"><col style="width:32.5%"></colgroup>
      <thead><tr><th colspan="7" class="ttl">Jobsite ${E(name)}</th></tr><tr><th>No</th><th>Jabatan</th><th>Nama</th><th>Plan</th><th>Actual</th><th>Vacant</th><th>Keterangan</th></tr></thead>
      <tbody>${body}</tbody><tfoot><tr><td colspan="3">Total</td><td class="r">${sum('plan')}</td><td class="r">${sum('act')}</td><td class="r">${sum('vac')}</td><td></td></tr></tfoot></table>`;
  }
  function rkName() {
    try { if (typeof PROJ !== 'undefined' && PROJ && PROJ.sites) return (typeof PROJ_CFG !== 'undefined' && PROJ_CFG.short) || 'KMB'; } catch (e) {}
    return title().replace(/^Dashboard Manpower\s*/i, '');
  }
  const RK_M = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const rkDate = () => { const d = new Date(); return `${d.getDate()} ${RK_M[d.getMonth()]} ${d.getFullYear()}`; };
  function rkAllowed() {
    let free = true; try { free = guardFree(); } catch (e) {}
    if (!free) { try { (typeof PRINT_ASK === 'function' ? PRINT_ASK : askPrint)(); } catch (e) {} }
    return free;
  }
  async function rkSites() {
    const sites = [];
    try {
      if (typeof PROJ !== 'undefined' && PROJ && PROJ.sites) {
        if (typeof loadAllSites === 'function' && PROJ.sites.some((s) => s.id !== WEB_ID && !SITE_DATA[s.id])) { try { toast('Memuat data semua jobsite…'); } catch (e) {} await loadAllSites(); }
        const ORD = ['kmb-slr-rekondisi', 'kmb-slr-maintenance', 'kmb-c4', 'kmb-workshop'], oi = (s) => { const i = ORD.indexOf(s.id); return i < 0 ? 99 : i; };
        [...PROJ.sites].sort((x, y) => oi(x) - oi(y)).forEach((s) => { const d = s.id === WEB_ID ? DATA : (SITE_DATA[s.id] || (window.SITE_SEEDS && SITE_SEEDS[s.id])); if (d) sites.push([s.name, d]); });
      }
    } catch (e) {}
    if (!sites.length) sites.push([rkName() || 'Jobsite', DATA]);
    // KTA-TRA: posisi punya Area (Hauling / Mining) → satu tabel per area
    const out = []; let split = false;
    sites.forEach(([n, d]) => {
      const ps = (d && d.positions) || [], ar = (p) => /hauling/i.test((p && p.area) || '') ? 'Hauling' : 'Mining';
      if (ps.some((p) => ar(p) === 'Hauling') && ps.some((p) => ar(p) === 'Mining')) { split = true; ['Hauling', 'Mining'].forEach((a) => { const L = ps.filter((p) => ar(p) === a); if (L.length) out.push([n + ' ' + a, { ...d, positions: L }]); }); }
      else out.push([n, d]);
    });
    out.split = split;
    return out;
  }
  const RK_NOTE = 'Merah = posisi open · Terisi = karyawan yang sudah ada · Terpenuhi = tidak ada posisi open · Pelamar: Nama - Tahap - Keterangan (aktif tebal, tidak aktif dicoret).';
  async function rekapPrint() {
    if (!rkAllowed()) return;
    const sites = await rkSites();
    const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Rekap MPP ${E(rkName())}</title><style>
      @page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{margin:0;font-family:Calibri,"Segoe UI",Arial,sans-serif;font-size:11pt;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      h1{font-size:13pt;margin:0 0 2px}p.s{margin:0 0 10px;font-size:9.5pt;color:#444}
      table{width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 16px}tr{break-inside:avoid}thead{display:table-header-group}tfoot{display:table-row-group}
      th,td{border:1px dotted #555;padding:2px 5px;height:22px;vertical-align:middle;overflow:hidden;word-wrap:break-word}
      th{font-weight:400;text-align:center;white-space:nowrap}th.ttl{background:#D9D9D9;border:1px solid #555}
      td.c{text-align:center}td.nm{font-size:10pt;line-height:1.35;padding-top:3px;padding-bottom:3px}.op{color:#C00000;font-weight:700}.ok{color:#15803D;font-weight:700}.ca{font-weight:700;color:#000}.cx{text-decoration:line-through;color:#555}.kp+.kp{margin-top:4px;padding-top:4px;border-top:1px dotted #999}.kl{font-size:9pt}td.kt{font-size:9.5pt;line-height:1.35;padding-top:3px;padding-bottom:3px}td.r{text-align:right;padding-right:8px}
      tfoot td{background:#D9D9D9;border-left:0;border-right:0}tfoot td:first-child{border-left:1px dotted #555}tfoot td:last-child{border-right:1px dotted #555}
    </style></head><body><h1>Rekap Manpower Planning ${E(rkName())}</h1><p class="s">Per ${rkDate()} · <span class="op">Merah</span> = posisi open · <span class="ok">Terisi</span> = karyawan yang sudah ada · <span class="ok">Terpenuhi</span> = tidak ada posisi open · Pelamar: Nama - Tahap - Keterangan (aktif <b>tebal</b>, tidak aktif <span class="cx">dicoret</span>).</p>
      ${sites.map(([n, d]) => rkTable(n, d)).join('')}${sites.split ? (() => { const g = rkGrand(sites); return `<table style="margin-top:-4px"><colgroup><col style="width:45%"><col style="width:7.5%"><col style="width:7.5%"><col style="width:7.5%"><col style="width:32.5%"></colgroup><tr><td style="background:#6D28D9;color:#fff;font-weight:700;border:1px solid #555">TOTAL ${E(rkName())} (${sites.map(([n]) => E(n.replace(rkName(), '').trim() || n)).join(' + ')})</td><td class="r" style="background:#6D28D9;color:#fff;font-weight:700;border:1px solid #555">${g.pl}</td><td class="r" style="background:#6D28D9;color:#fff;font-weight:700;border:1px solid #555">${g.ac}</td><td class="r" style="background:#6D28D9;color:#fff;font-weight:700;border:1px solid #555">${g.vc}</td><td style="background:#6D28D9;border:1px solid #555"></td></tr></table>`; })() : ''}</body></html>`;
    let fr = document.getElementById('rkFrame'); if (fr) fr.remove();
    fr = document.createElement('iframe'); fr.id = 'rkFrame'; fr.setAttribute('aria-hidden', 'true');
    fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(fr);
    const w = fr.contentWindow; w.document.open(); w.document.write(html); w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) { const x = window.open('', '_blank'); if (x) { x.document.write(html); x.document.close(); x.print(); } } }, 300);
  }

  // ---------- Excel Rekap MPP (format sama dengan cetakan: warna merah/hijau, tebal, coret) ----------
  // .xlsx ditulis langsung (XML + JSZip, pustaka yang sama dengan Form Data Karyawan) — tanpa pustaka tambahan
  let _zipP = null;
  function loadZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (_zipP) return _zipP;
    _zipP = new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.onload = () => ok(window.JSZip); s.onerror = () => { _zipP = null; no(new Error('JSZip gagal dimuat')); }; document.head.appendChild(s); });
    return _zipP;
  }
  const X = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const colL = (c) => String.fromCharCode(64 + c);
  // perkiraan jumlah baris teks (agar tinggi baris pas seperti cetakan)
  const wrapN = (txt, per) => String(txt).split('\n').reduce((a, l) => a + Math.max(1, Math.ceil(l.length / per)), 0);
  // ---------- Penulis .xlsx bersama (Rekap MPP & Download Excel seluruh data) ----------
  async function buildBook(sites, dataSheets, org) {
    let Z; try { Z = await loadZip(); } catch (e) { try { toast('Pembuat Excel belum termuat. Periksa koneksi lalu coba lagi.', true); } catch (er) {} return null; }
    // Semua format memakai format SEL (bukan rich text) dan 1 kalimat = 1 baris Excel,
    // supaya tampil sama di Excel, Google Sheets, pratinjau Google Drive, WPS, dan LibreOffice.
    const FONTS = [
      '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>',                                   // 0 biasa
      '<font><b/><sz val="14"/><name val="Calibri"/><family val="2"/></font>',                               // 1 judul
      '<font><sz val="9"/><color rgb="FF444444"/><name val="Calibri"/><family val="2"/></font>',             // 2 catatan
      '<font><sz val="10"/><name val="Calibri"/><family val="2"/></font>',                                   // 3 nama
      '<font><b/><sz val="10"/><color rgb="FFC00000"/><name val="Calibri"/><family val="2"/></font>',        // 4 nama merah
      '<font><sz val="9.5"/><name val="Calibri"/><family val="2"/></font>',                                  // 5 ket biasa
      '<font><b/><sz val="9.5"/><name val="Calibri"/><family val="2"/></font>',                              // 6 ket aktif
      '<font><sz val="9.5"/><color rgb="FF555555"/><name val="Calibri"/><family val="2"/></font>',  // 7 ket tidak aktif (coret lewat karakter)
      '<font><b/><sz val="9.5"/><color rgb="FF15803D"/><name val="Calibri"/><family val="2"/></font>',       // 8 hijau
      '<font><b/><sz val="9"/><color rgb="FFC00000"/><name val="Calibri"/><family val="2"/></font>',         // 9 label merah
      '<font><b/><sz val="10"/><name val="Calibri"/><family val="2"/></font>',                               // 10 header data
      '<font><b/><sz val="10"/><color rgb="FF15803D"/><name val="Calibri"/><family val="2"/></font>',        // 11 hijau 10
      '<font><b/><sz val="10"/><color rgb="FFB45309"/><name val="Calibri"/><family val="2"/></font>',        // 12 oranye 10
      '<font><strike/><sz val="10"/><color rgb="FF6B7280"/><name val="Calibri"/><family val="2"/></font>',   // 13 coret 10
      '<font><b/><sz val="10"/><color rgb="FF1D4ED8"/><name val="Calibri"/><family val="2"/></font>',        // 14 biru 10
      '<font><b/><sz val="9"/><color rgb="FF3B2F7A"/><name val="Calibri"/><family val="2"/></font>',         // 15 judul kotak bagan
      '<font><b/><sz val="11"/><color rgb="FFB45309"/><name val="Calibri"/><family val="2"/></font>',        // 16 oranye 11
      '<font><b/><sz val="11"/><color rgb="FF1D4ED8"/><name val="Calibri"/><family val="2"/></font>',        // 17 biru 11
      '<font><b/><sz val="11"/><color rgb="FF3B2F7A"/><name val="Calibri"/><family val="2"/></font>',        // 18 ungu 11
    ];
    const FILLS = [`<fill><patternFill patternType="none"/></fill>`, `<fill><patternFill patternType="gray125"/></fill>`, `<fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor indexed="64"/></patternFill></fill>`, `<fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill>`, `<fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/><bgColor indexed="64"/></patternFill></fill>`, `<fill><patternFill patternType="solid"><fgColor rgb="FFEDE9FE"/><bgColor indexed="64"/></patternFill></fill>`];
    const DOT = '<color rgb="FF404040"/>';   // garis tegas (thin) agar jelas di Excel maupun pratinjau Google Drive
    const BORDERS = [
      '<border><left/><right/><top/><bottom/><diagonal/></border>',
      `<border><left style="thin">${DOT}</left><right style="thin">${DOT}</right><top style="thin">${DOT}</top><bottom style="thin">${DOT}</bottom><diagonal/></border>`,
      `<border><left style="thin">${DOT}</left><right style="thin">${DOT}</right><top style="thin">${DOT}</top><bottom style="thin">${DOT}</bottom><diagonal/></border>`,
      `<border><left style="thin">${DOT}</left><right style="thin">${DOT}</right><top/><bottom/><diagonal/></border>`,                       // 3 sambungan (tanpa garis atas)
      `<border><left style="thin">${DOT}</left><right style="thin">${DOT}</right><top style="thin">${DOT}</top><bottom/><diagonal/></border>`, // 4 awal blok
      '<border><left style="medium"><color rgb="FF8A87A6"/></left><right/><top/><bottom/><diagonal/></border>',                                      // 5 garis bagan |
      '<border><left/><right/><top style="medium"><color rgb="FF8A87A6"/></top><bottom/><diagonal/></border>',                                      // 6 garis bagan —
      '<border><left style="medium"><color rgb="FF8A87A6"/></left><right/><top style="medium"><color rgb="FF8A87A6"/></top><bottom/><diagonal/></border>', // 7 garis bagan ┌
    ];
    const XF = [], xf = (font, fill, border, align) => { XF.push(`<xf numFmtId="0" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1"${align ? ` applyAlignment="1"><alignment ${align}/></xf>` : '/>'}`); return XF.length - 1; };
    const S0 = xf(0, 0, 0), ST = xf(1, 0, 0), SN = xf(2, 0, 0, 'vertical="top" wrapText="1"'), SBAR = xf(0, 2, 2, 'horizontal="center" vertical="center"'),
      SH = xf(0, 0, 1, 'horizontal="center" vertical="center"'), SC = xf(0, 0, 1, 'horizontal="center" vertical="center" wrapText="1"'), SL = xf(0, 0, 1, 'horizontal="left" vertical="center" wrapText="1"'),
      STL = xf(0, 2, 1, 'horizontal="left" vertical="center"'), STR = xf(0, 2, 1, 'horizontal="right" vertical="center"'), STE = xf(0, 2, 1),
      SNM = xf(3, 0, 1, 'horizontal="left" vertical="center" wrapText="1"'), SNMR = xf(4, 0, 1, 'horizontal="left" vertical="center" wrapText="1"');
    const KF = { plain: 5, act: 6, cx: 7, ok: 8, terisi: 8, lbl: 9 }, KS = {};
    Object.keys(KF).forEach((k) => { KS[k] = [xf(KF[k], 0, 4, 'horizontal="left" vertical="center" wrapText="1"'), xf(KF[k], 0, 3, 'horizontal="left" vertical="center" wrapText="1"')]; });
    const KEMPTY = xf(5, 0, 1, 'horizontal="left" vertical="center" wrapText="1"');
    void S0;
    // sheet data: header, isi, dan warna penanda
    const DH = xf(10, 2, 1, 'horizontal="center" vertical="center" wrapText="1"'), DB = xf(3, 0, 1, 'vertical="top" wrapText="1"'), DBN = xf(3, 0, 1, 'horizontal="center" vertical="top"'),
      DRED = xf(4, 0, 1, 'vertical="top" wrapText="1"'), DGRN = xf(11, 0, 1, 'vertical="top" wrapText="1"'), DORG = xf(12, 0, 1, 'vertical="top" wrapText="1"'), DBOLD = xf(10, 0, 1, 'vertical="top" wrapText="1"'), DCX = xf(13, 0, 1, 'vertical="top" wrapText="1"'), DBLU = xf(14, 0, 1, 'vertical="top" wrapText="1"');
    const OBAR = { top: xf(10, 5, 1, 'horizontal="left" vertical="center"'), Hauling: xf(12, 3, 1, 'horizontal="left" vertical="center"'), Mining: xf(14, 4, 1, 'horizontal="left" vertical="center"'), sec: xf(10, 2, 1, 'horizontal="left" vertical="center"'), grp: xf(3, 0, 1, 'horizontal="left" vertical="center"') };
    const CH = { L: xf(0, 0, 5), T: xf(0, 0, 6), TL: xf(0, 0, 7),
      jab: xf(15, 5, 2, 'horizontal="center" vertical="center" wrapText="1"'),
      nm: xf(10, 0, 2, 'horizontal="center" vertical="center" wrapText="1"'), nmV: xf(4, 0, 2, 'horizontal="center" vertical="center" wrapText="1"'), nmR: xf(12, 0, 2, 'horizontal="center" vertical="center" wrapText="1"'),
      st: xf(2, 0, 2, 'horizontal="center" vertical="center" wrapText="1"'),
      aH: xf(16, 3, 2, 'horizontal="center" vertical="center" wrapText="1"'), aM: xf(17, 4, 2, 'horizontal="center" vertical="center" wrapText="1"'), aS: xf(2, 0, 2, 'horizontal="center" vertical="center" wrapText="1"'),
      sec: xf(18, 2, 2, 'horizontal="center" vertical="center" wrapText="1"'), note: xf(2, 0, 0, 'vertical="center"') };
    // bagan dari tampilan web: daftarkan warna/huruf/garis yang dipakai sebelum styles.xml dibuat
    const hex = (c) => { const m = String(c || '').match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/); if (!m) return null; if (m[4] !== undefined && +m[4] < 0.05) return null; const a = m[4] === undefined ? 1 : +m[4]; const mix = (v) => Math.round(+v * a + 255 * (1 - a)); return [mix(m[1]), mix(m[2]), mix(m[3])].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase(); };
    const fillIdx = {}, fontIdx = {}, xfIdx = {}, brdIdx = {};
    const regFill = (h) => { if (!h || h === 'FFFFFF') return 0; if (fillIdx[h] === undefined) { FILLS.push(`<fill><patternFill patternType="solid"><fgColor rgb="FF${h}"/><bgColor indexed="64"/></patternFill></fill>`); fillIdx[h] = FILLS.length - 1; } return fillIdx[h]; };
    const regFont = (col, b, sz, st) => { const k = [col, b, sz, st].join('|'); if (fontIdx[k] === undefined) { FONTS.push(`<font>${b ? '<b/>' : ''}${st ? '<strike/>' : ''}<sz val="${sz}"/><color rgb="FF${col || '1E1B3A'}"/><name val="Calibri"/><family val="2"/></font>`); fontIdx[k] = FONTS.length - 1; } return fontIdx[k]; };
    const regBorder = (k, xml) => { if (brdIdx[k] === undefined) { BORDERS.push(xml); brdIdx[k] = BORDERS.length - 1; } return brdIdx[k]; };
    const DOMS = {};
    if (org && org.dom) {
      const bx = regBorder('box', `<border><left style="thin"><color rgb="FFB9B6CC"/></left><right style="thin"><color rgb="FFB9B6CC"/></right><top style="thin"><color rgb="FFB9B6CC"/></top><bottom style="thin"><color rgb="FFB9B6CC"/></bottom><diagonal/></border>`);
      org.dom.boxes.forEach((b) => { const k = [b.bg, b.color, b.bold, b.size, b.strike, b.align, b.one].join('|'); if (xfIdx[k] === undefined) xfIdx[k] = xf(regFont(b.color, b.bold, b.size, b.strike), regFill(b.bg), bx, `horizontal="${b.align}" vertical="center" ${b.one ? 'shrinkToFit="1"' : 'wrapText="1"'}`); b.s = xfIdx[k]; });
      ['solid', 'dot'].forEach((ty) => { const st = ty === 'solid' ? 'thin' : 'dotted', c = ty === 'solid' ? 'FF8A87A6' : 'FFB9B6CC';
        const L = `<left style="${st}"><color rgb="${c}"/></left>`, T = `<top style="${st}"><color rgb="${c}"/></top>`;
        DOMS[ty] = { L: xf(0, 0, regBorder(ty + 'L', `<border>${L}<right/><top/><bottom/><diagonal/></border>`)), T: xf(0, 0, regBorder(ty + 'T', `<border><left/><right/>${T}<bottom/><diagonal/></border>`)), TL: xf(0, 0, regBorder(ty + 'TL', `<border>${L}<right/>${T}<bottom/><diagonal/></border>`)) };
      });
    }
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="${FONTS.length}">${FONTS.join('')}</fonts>
<fills count="${FILLS.length}">${FILLS.join('')}</fills>
<borders count="${BORDERS.length}">${BORDERS.join('')}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${XF.length}">${XF.join('')}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    const sst = [];
    const sIdx = (text) => { sst.push(`<t xml:space="preserve">${X(text)}</t>`); return sst.length - 1; };
    const rekapSheet = () => {
    const rows = [], merges = [];
    let r = 1;
    const str = (c, rr, s, text) => `<c r="${colL(c)}${rr}" s="${s}" t="s"><v>${sIdx(text)}</v></c>`;
    const num = (c, rr, s, v) => v === '' || v == null ? `<c r="${colL(c)}${rr}" s="${s}"/>` : `<c r="${colL(c)}${rr}" s="${s}"><v>${v}</v></c>`;
    const blank = (c, rr, s) => `<c r="${colL(c)}${rr}" s="${s}"/>`;
    const row = (rr, cells, ht) => rows.push(`<row r="${rr}"${ht ? ` ht="${ht}" customHeight="1"` : ''}>${cells.join('')}</row>`);
    const LH = 12.5;
    row(r, [str(1, r, ST, 'Rekap Manpower Planning ' + rkName())], 20); r++;
    merges.push(`A${r}:G${r}`); row(r, [str(1, r, SN, 'Per ' + rkDate() + ' · ' + RK_NOTE)], 28); r += 2;
    sites.forEach(([name, d]) => {
      const R = rkRows(d), n = Math.max(7, R.length);
      merges.push(`A${r}:G${r}`); row(r, [str(1, r, SBAR, 'Jobsite ' + name)].concat([2, 3, 4, 5, 6, 7].map((c) => blank(c, r, SBAR))), 18); r++;
      row(r, ['No', 'Jabatan', 'Nama', 'Plan', 'Actual', 'Vacant', 'Keterangan'].map((h, i) => str(i + 1, r, SH, h)), 18); r++;
      const first = r;
      for (let i = 0; i < n; i++) {
        const x = R[i];
        if (!x) { row(r, [num(1, r, SC, i + 1), blank(2, r, SL), blank(3, r, SNM), blank(4, r, SC), blank(5, r, SC), num(6, r, SC, 0), blank(7, r, KEMPTY)], 17); r++; continue; }
        // satu kalimat keterangan = satu baris Excel; kolom No–Vacant digabung ke bawah
        const lines = [];
        x.ket.forEach((b) => b.forEach((y, li) => lines.push({ k: y.k, t: y.k === 'terisi' ? 'Terisi: ' + y.t : y.k === 'lbl' ? y.t + (y.ptk ? ' · ' + y.ptk : '') : y.t, top: li === 0 })));
        const hs = lines.map((l) => Math.max(15, wrapN(l.t, l.k === 'lbl' ? 50 : l.k === 'act' || l.k === 'ok' || l.k === 'terisi' ? 42 : 46) * LH + 3));
        const nameTxt = x.names.map((q) => q.t).join(', '), red = x.names.length && x.names.every((q) => q.red);
        const need = Math.max(wrapN(nameTxt, 27), wrapN(x.j, 17)) * 14 + 6, tot = hs.reduce((a, h) => a + h, 0);
        if (tot < need) hs[hs.length - 1] += need - tot;
        const r0 = r;
        lines.forEach((l, li) => {
          const cells = li === 0
            ? [num(1, r, SC, i + 1), str(2, r, SL, x.j), str(3, r, red ? SNMR : SNM, nameTxt), num(4, r, SC, x.plan), num(5, r, SC, x.act), num(6, r, SC, x.vac)]
            : [blank(1, r, SC), blank(2, r, SL), blank(3, r, SNM), blank(4, r, SC), blank(5, r, SC), blank(6, r, SC)];
          // coretan ditulis sebagai karakter (U+0336) agar tetap tercoret di pratinjau Google Drive / aplikasi yang tidak mendukung format coret
          const txt = l.k === 'cx' ? Array.from(l.t).map((ch) => ch === ' ' ? ' \u0336' : ch + '\u0336').join('') : l.t;
          row(r, cells.concat([str(7, r, KS[l.k][l.top ? 0 : 1], txt)]), Math.round(hs[li]));
          r++;
        });
        if (r - r0 > 1) for (let c = 1; c <= 6; c++) merges.push(`${colL(c)}${r0}:${colL(c)}${r - 1}`);
      }
      const S = (k) => R.reduce((a, y) => a + y[k], 0);
      merges.push(`A${r}:C${r}`);
      row(r, [str(1, r, STL, 'Total'), blank(2, r, STE), blank(3, r, STE),
        `<c r="D${r}" s="${STR}"><f>SUM(D${first}:D${r - 1})</f><v>${S('plan')}</v></c>`, `<c r="E${r}" s="${STR}"><f>SUM(E${first}:E${r - 1})</f><v>${S('act')}</v></c>`, `<c r="F${r}" s="${STR}"><f>SUM(F${first}:F${r - 1})</f><v>${S('vac')}</v></c>`, blank(7, r, STE)], 18);
      r += 2;
    });
    if (sites.split) {
      const g = rkGrand(sites);
      merges.push(`A${r}:C${r}`);
      row(r, [str(1, r, STL, 'TOTAL ' + rkName() + ' (' + sites.map(([n]) => n.replace(rkName(), '').trim() || n).join(' + ') + ')'), blank(2, r, STE), blank(3, r, STE), num(4, r, STR, g.pl), num(5, r, STR, g.ac), num(6, r, STR, g.vc), blank(7, r, STE)], 20);
      r += 2;
    }
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>
<cols><col min="1" max="1" width="5" customWidth="1"/><col min="2" max="2" width="16" customWidth="1"/><col min="3" max="3" width="25" customWidth="1"/><col min="4" max="6" width="7.5" customWidth="1"/><col min="7" max="7" width="34" customWidth="1"/></cols>
<sheetData>${rows.join('')}</sheetData>${merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}
<pageMargins left="0.47" right="0.47" top="0.47" bottom="0.47" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/></worksheet>`;
    };
    // sheet data biasa: baris 1 = judul kolom (tetap bisa di-upload lagi lewat Sinkronkan Excel)
    const dataSheet = (aoa, styleOf) => {
      const head = aoa[0] || [], n = head.length, rows = [];
      const w = head.map((h, c) => Math.min(48, Math.max(6, String(h || '').length + 2, ...aoa.slice(1, 400).map((r) => String((r || [])[c] == null ? '' : r[c]).length * 0.95 + 1))));
      aoa.forEach((r, i) => {
        const cells = [];
        for (let c = 0; c < n; c++) {
          const v = (r || [])[c], ref = colL1(c + 1) + (i + 1);
          const tok = i === 0 ? null : styleOf && styleOf(String(head[c] || ''), v, i - 1);
          const s = i === 0 ? DH : ({ red: DRED, grn: DGRN, org: DORG, bold: DBOLD, cx: DCX, blu: DBLU })[tok] || (typeof v === 'number' ? DBN : DB);
          if (v === null || v === undefined || v === '') cells.push(`<c r="${ref}" s="${s}"/>`);
          else if (typeof v === 'number' && isFinite(v)) cells.push(`<c r="${ref}" s="${s}"><v>${v}</v></c>`);
          else cells.push(`<c r="${ref}" s="${s}" t="s"><v>${sIdx(String(v))}</v></c>`);
        }
        rows.push(`<row r="${i + 1}"${i === 0 ? ' ht="30" customHeight="1"' : ''}>${cells.join('')}</row>`);
      });
      const last = colL1(Math.max(1, n)) + Math.max(1, aoa.length);
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>
<cols>${w.map((x, c) => `<col min="${c + 1}" max="${c + 1}" width="${x.toFixed(1)}" customWidth="1"/>`).join('')}</cols>
<sheetData>${rows.join('')}</sheetData>${aoa.length > 1 && n ? `<autoFilter ref="A1:${last}"/>` : ''}
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
    };
    // sheet Struktur Organisasi: bar project / section berwarna, satu baris per posisi, bawahan menjorok (↳)
    const orgSheet = () => {
      const rows = [], merges = []; let r = 1;
      const cell = (c, s, v) => v === '' || v == null ? `<c r="${colL1(c)}${r}" s="${s}"/>` : typeof v === 'number' ? `<c r="${colL1(c)}${r}" s="${s}"><v>${v}</v></c>` : `<c r="${colL1(c)}${r}" s="${s}" t="s"><v>${sIdx(String(v))}</v></c>`;
      const N = 7;
      rows.push(`<row r="${r}" ht="22" customHeight="1">${cell(1, ST, 'Struktur Organisasi ' + org.name)}</row>`); r++;
      merges.push(`A${r}:G${r}`); rows.push(`<row r="${r}" ht="18" customHeight="1">${cell(1, SN, 'Per ' + rkDate() + ' · urutan sama dengan bagan di web · ↳ = bawahan dari baris di atasnya · Vacant merah, akan diganti oranye')}</row>`); r += 2;
      rows.push(`<row r="${r}" ht="20" customHeight="1">${['No', 'Jabatan', 'Nama', 'Atasan', 'Sub-section', 'Status', 'Keterangan PTK'].map((h, i) => cell(i + 1, DH, h)).join('')}</row>`); r++;
      org.rows.forEach((x) => {
        if (x.bar) { merges.push(`A${r}:G${r}`); rows.push(`<row r="${r}" ht="20" customHeight="1">${cell(1, OBAR[x.bar] || OBAR.sec, x.text)}${[2, 3, 4, 5, 6, 7].map((c) => cell(c, OBAR[x.bar] || OBAR.sec, '')).join('')}</row>`); r++; return; }
        const st = { red: DRED, org: DORG, grn: DGRN }[x.tone] || DB;
        rows.push(`<row r="${r}">${[cell(1, DBN, x.no), cell(2, x.depth ? DB : DBOLD, x.jab), cell(3, x.vac ? DRED : x.repl ? DORG : DB, x.nama), cell(4, DB, x.atasan), cell(5, DB, x.grp), cell(6, st, x.status), cell(7, DB, x.ket)].join('')}</row>`); r++;
      });
      void N;
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>
<cols><col min="1" max="1" width="6" customWidth="1"/><col min="2" max="2" width="34" customWidth="1"/><col min="3" max="3" width="30" customWidth="1"/><col min="4" max="4" width="24" customWidth="1"/><col min="5" max="5" width="22" customWidth="1"/><col min="6" max="6" width="14" customWidth="1"/><col min="7" max="7" width="22" customWidth="1"/></cols>
<sheetData>${rows.join('')}</sheetData>${merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/></worksheet>`;
    };
    const SH_ = [];   // [nama sheet, xml, judul cetak?]
    (dataSheets || []).forEach(([nm, aoa, styleOf]) => SH_.push([nm, dataSheet(aoa, styleOf), '$1:$1']));
    // bagan SO dibentuk langsung di sel Excel (kotak + garis), susunan sama dengan bagan di web
    const chartSheet = (m) => {
      const cells = {}, merges = [], hts = {};
      const put = (r, c, s, v) => { (cells[r] = cells[r] || {})[c] = { s, v }; };
      const box = (r, c0, w, lines) => {   // lines: [[style, text, tinggi baris]]
        lines.forEach(([s, v, h], k) => { const rr = r + k; for (let c = c0; c < c0 + w; c++) put(rr, c, s, c === c0 ? v : ''); if (w > 1) merges.push(`${colL1(c0)}${rr}:${colL1(c0 + w - 1)}${rr}`); hts[rr] = Math.max(hts[rr] || 0, h); });
        return r + lines.length;
      };
      const vline = (r, c) => { const x = (cells[r] || {})[c]; put(r, c, x && (x.s === CH.T || x.s === CH.TL) ? CH.TL : CH.L, ''); };
      const hline = (r, c1, c2) => { for (let c = Math.min(c1, c2); c < Math.max(c1, c2); c++) { const x = (cells[r] || {})[c]; put(r, c, x && (x.s === CH.L || x.s === CH.TL) ? CH.TL : CH.T, ''); } };
      const W = 5, GAP = 1, SL = W + GAP, C0 = 2;
      const lines = (txt, per) => Math.max(1, Math.ceil(String(txt || '').length / per));
      const person = (r, c0, x) => box(r, c0, W, [
        [CH.jab, (x.depth ? '↳ ' : '') + x.jab, 13 * lines((x.depth ? '↳ ' : '') + x.jab, 26) + 4],
        [x.vac ? CH.nmV : x.repl ? CH.nmR : CH.nm, x.nama, 14 * lines(x.nama, 24) + 5],
        [CH.st, x.status + (x.ket ? ' · ' + x.ket : ''), 12 * lines(x.status + (x.ket ? ' · ' + x.ket : ''), 30) + 3]]);
      // satu kolom (slot) per section, dikelompokkan per project
      let slot = 0;
      m.areas.forEach((a) => { a.slot0 = slot; slot += Math.max(1, a.secs.length, a.tops.length); a.slot1 = slot - 1; });
      const cx = (sl) => C0 + sl * SL + Math.floor(W / 2);
      m.areas.forEach((a) => { a.cx = Math.round((cx(a.slot0) + cx(a.slot1)) / 2); a.secs.forEach((s, k) => { s.cx = cx(a.slot0 + k); }); });
      const allC = m.areas.map((a) => a.cx), gcx = Math.round((Math.min(...allC) + Math.max(...allC)) / 2);
      const left = (k, total, center) => center - Math.floor((total * SL - GAP) / 2) + k * SL;   // kolom kiri kotak ke-k bila "total" kotak dipusatkan
      put(1, 1, ST, 'Bagan Struktur Organisasi ' + m.name); hts[1] = 24;
      put(2, 1, CH.note, 'Per ' + rkDate() + ' · Nama merah = Vacant · oranye = akan diganti · ↳ = bawahan dari kotak di atasnya'); hts[2] = 16;
      let r = 4;
      // pimpinan teratas (Dept Head / PJO)
      if (m.tops.length) {
        m.tops.forEach((x, k) => person(r, left(k, m.tops.length, gcx), x));
        r += 3; vline(r, gcx); r++;
        if (m.areas.length > 1) { hline(r, Math.min(...allC), Math.max(...allC)); allC.forEach((c) => vline(r, c)); r++; }
      }
      // kotak project (Hauling / Mining)
      if (m.multi) { m.areas.forEach((a) => { box(r, a.cx - 2, W, [[a.name === 'Hauling' ? CH.aH : CH.aM, 'KTA - TRA ' + a.name.toUpperCase(), 22], [CH.aS, a.stat, 15]]); }); r += 2; }
      // per project: pimpinan project → section → anggota
      const rStart = r;
      m.areas.forEach((a) => {
        let rr = rStart;
        if (m.multi && (a.tops.length || a.secs.length)) { vline(rr, a.cx); rr++; }
        if (a.tops.length) {
          if (a.tops.length > 1) { hline(rr - 1, left(0, a.tops.length, a.cx) + 2, left(a.tops.length - 1, a.tops.length, a.cx) + 2); a.tops.forEach((x, k) => vline(rr - 1, left(k, a.tops.length, a.cx) + 2)); }
          a.tops.forEach((x, k) => person(rr, left(k, a.tops.length, a.cx), x));
          rr += 3;
          if (a.secs.length) { vline(rr, a.cx); rr++; }
        }
        if (a.secs.length) {
          if (a.secs.length > 1) hline(rr, a.secs[0].cx, a.secs[a.secs.length - 1].cx);
          if (a.tops.length || m.multi || m.tops.length) a.secs.forEach((s) => vline(rr, s.cx));
          rr++;
          a.secs.forEach((s) => {
            let q = box(rr, s.cx - 2, W, [[CH.sec, s.name, 13 * lines(s.name, 22) + 6], [CH.aS, s.stat, 15]]);
            s.members.forEach((x) => { vline(q, s.cx); hts[q] = Math.max(hts[q] || 0, 9); q++; q = person(q, s.cx - 2, x); });
          });
        }
      });
      const lastCol = C0 + Math.max(1, slot) * SL;
      const rowsXml = Object.keys(cells).map(Number).sort((a, b) => a - b).map((rr) => `<row r="${rr}"${hts[rr] ? ` ht="${Math.round(hts[rr])}" customHeight="1"` : ''}>${Object.keys(cells[rr]).map(Number).sort((a, b) => a - b).map((c) => { const x = cells[rr][c]; return x.v === '' || x.v == null ? `<c r="${colL1(c)}${rr}" s="${x.s}"/>` : `<c r="${colL1(c)}${rr}" s="${x.s}" t="s"><v>${sIdx(String(x.v))}</v></c>`; }).join('')}</row>`).join('');
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="80" zoomScaleNormal="80"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>
<cols><col min="1" max="1" width="2" customWidth="1"/><col min="2" max="${lastCol}" width="5.3" customWidth="1"/></cols>
<sheetData>${rowsXml}</sheetData>${merges.length ? `<mergeCells count="${merges.length}">${merges.map((x) => `<mergeCell ref="${x}"/>`).join('')}</mergeCells>` : ''}
<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
    };
    // bagan persis seperti tampilan web: posisi kotak & garis diambil dari halaman Struktur Organisasi, 1 sel ≈ 7 px
    const domSheet = (d) => {
      const G = 7, R0 = 4, Cc = 2, cells = {}, merges = [], hts = {}, occ = {};
      const key = (r, c) => r * 100000 + c;
      const put = (r, c, s, v) => { (cells[r] = cells[r] || {})[c] = { s, v }; };
      const gx = (x) => Cc + Math.round(x / G), gy = (y) => R0 + Math.round(y / G);
      // kotak teks
      d.boxes.slice().sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0).forEach((b) => {
        let c0 = gx(b.x0), c1 = Math.max(c0, gx(b.x1) - 1), r0 = gy(b.y0), r1 = Math.max(r0, gy(b.y1) - 1);
        while (r0 <= r1 && [...Array(c1 - c0 + 1)].some((_, k) => occ[key(r0, c0 + k)])) r0++;
        if (r0 > r1) r1 = r0;
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { occ[key(r, c)] = 1; put(r, c, b.s, r === r0 && c === c0 ? b.text : ''); }
        if (c1 > c0 || r1 > r0) merges.push(`${colL1(c0)}${r0}:${colL1(c1)}${r1}`);
        const need = b.one ? b.size * 1.35 + 2 : Math.max(1, Math.ceil(String(b.text).length / Math.max(1, ((c1 - c0 + 1) * G) / (b.size * 0.72)))) * b.size * 1.35 + 2;   // tinggi minimal agar teks muat
        const have = (r1 - r0 + 1) * G * 0.75;
        if (need > have) { const add = (need - have) / (r1 - r0 + 1); for (let r = r0; r <= r1; r++) hts[r] = Math.max(hts[r] || G * 0.75, G * 0.75 + add); }
      });
      // garis
      const mark = (r, c, ty, dir) => { if (occ[key(r, c)]) return; const x = (cells[r] || {})[c], S = DOMS[ty]; let has = x ? (x.s === S.TL ? 'TL' : x.s === S.L ? 'L' : x.s === S.T ? 'T' : '') : ''; if (x && !has) { const o = DOMS[ty === 'solid' ? 'dot' : 'solid']; has = x.s === o.TL ? 'TL' : x.s === o.L ? 'L' : x.s === o.T ? 'T' : ''; if (ty === 'dot' && has) return; } const n = new Set((has + dir).split('')); put(r, c, n.has('T') && n.has('L') ? S.TL : n.has('L') ? S.L : S.T, ''); };
      d.lines.forEach((l) => {
        if (l.v) { const c = gx(l.x0); for (let r = gy(l.y0); r < Math.max(gy(l.y0) + 1, gy(l.y1)); r++) mark(r, c, l.ty, 'L'); }
        else { const r = gy(l.y0); for (let c = gx(l.x0); c < Math.max(gx(l.x0) + 1, gx(l.x1)); c++) mark(r, c, l.ty, 'T'); }
      });
      put(1, 1, ST, 'Bagan Struktur Organisasi ' + org.name); hts[1] = 24;
      put(2, 1, CH.note, 'Per ' + rkDate() + ' · susunan sama dengan bagan di halaman Struktur Organisasi'); hts[2] = 16;
      const maxR = Math.max(...Object.keys(cells).map(Number)), maxC = Cc + Math.ceil(d.W / G) + 1;
      const rowsXml = [];
      for (let r = 1; r <= maxR; r++) {
        const row = cells[r]; const ht = hts[r] || (r > 3 ? G * 0.75 : 0);
        if (!row && !ht) continue;
        rowsXml.push(`<row r="${r}"${ht ? ` ht="${ht.toFixed(2)}" customHeight="1"` : ''}>${row ? Object.keys(row).map(Number).sort((a, b) => a - b).map((c) => { const x = row[c]; return x.v === '' || x.v == null ? `<c r="${colL1(c)}${r}" s="${x.s}"/>` : `<c r="${colL1(c)}${r}" s="${x.s}" t="s"><v>${sIdx(String(x.v))}</v></c>`; }).join('') : ''}</row>`);
      }
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="80" zoomScaleNormal="80"/></sheetViews><sheetFormatPr defaultRowHeight="${(G * 0.75).toFixed(2)}" customHeight="1"/>
<cols><col min="1" max="1" width="2" customWidth="1"/><col min="2" max="${maxC}" width="0.58" customWidth="1"/></cols>
<sheetData>${rowsXml.join('')}</sheetData>${merges.length ? `<mergeCells count="${merges.length}">${merges.map((x) => `<mergeCell ref="${x}"/>`).join('')}</mergeCells>` : ''}
<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="${d.W >= d.H ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="1"/></worksheet>`;
    };
    if (org && org.dom && org.dom.boxes.length) SH_.push(['Bagan Struktur Organisasi', domSheet(org.dom), '']);
    else if (org && org.chart && org.chart.areas.length) SH_.push(['Bagan Struktur Organisasi', chartSheet(org.chart), '']);
    if (org && org.rows.length) SH_.push(['Struktur Organisasi', orgSheet(), '$4:$4']);
    if (sites) SH_.push([dataSheets && dataSheets.length ? 'Rekap Manpower' : 'Rekap MPP', rekapSheet(), '$1:$2']);
    const safeName = (s, i) => (String(s).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31).trim() || 'Sheet' + (i + 1));
    const names = SH_.map((x, i) => safeName(x[0], i));
    const zip = new Z();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' + SH_.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    zip.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + names.map((n, i) => `<sheet name="${X(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets><definedNames>' + names.map((n, i) => SH_[i][2] ? `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${X(n).replace(/'/g, "''")}'!${SH_[i][2]}</definedName>` : '').join('') + '</definedNames></workbook>');
    zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + SH_.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${SH_.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${SH_.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`);
    zip.file('xl/styles.xml', styles);
    zip.file('xl/sharedStrings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sst.length}" uniqueCount="${sst.length}">${sst.map((x) => `<si>${x}</si>`).join('')}</sst>`);
    SH_.forEach((x, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, x[1]));

    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
  }
  const colL1 = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const saveBlob = async (fn, blob) => { if (typeof save === 'function') await save(fn, blob); else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fn; document.body.appendChild(a); a.click(); a.remove(); } };
  async function rekapExcel() {
    if (!rkAllowed()) return;
    const sites = await rkSites();
    const blob = await buildBook(sites, null); if (!blob) return;
    await saveBlob(`Rekap_MPP_${rkName().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}_${new Date().toISOString().slice(0, 10)}.xlsx`, blob);
  }
  window.rekapExcel = rekapExcel;

  // ---------- Download Excel seluruh data (tombol Excel / Pengaturan › Download Excel) ----------
  // Isi & susunan kolom SAMA dengan unduhan lama (jadi tetap bisa di-upload lagi lewat Sinkronkan Excel),
  // ditambah format: judul kolom tebal & abu, garis tabel, baris judul terkunci, filter, warna penanda,
  // sheet "Pelamar" dan sheet "Rekap Manpower" (sama dengan Rekap MPP).
  // data Struktur Organisasi (urutan & hubungan atasan sama dengan bagan di web)
  function orgRows() {
    const P = ((typeof DATA !== 'undefined' && DATA.positions) || []).filter((p) => p && !p.hidden);
    if (!P.length) return null;
    const isVac = (p) => /^vacant$/i.test(String(p.nama || '').trim());
    const isRepl = (p) => !isVac(p) && !!p.ptk && /open|continue/i.test(String(p.status || ''));
    const byUid = {}; P.forEach((p) => { if (p.uid) byUid[p.uid] = p; });
    const nm = (p) => p ? (isVac(p) ? 'Vacant (' + (p.jabatan || '') + ')' : String(p.nama || '').trim()) : '';
    const arOf = (x) => /hauling/i.test((x && x.area) || '') ? 'Hauling' : 'Mining';
    const both = P.some((p) => arOf(p) === 'Hauling') && P.some((p) => arOf(p) === 'Mining');
    const isTopS = (s) => /penanggung|pjo|manajemen|management/i.test(s || '');
    const ord = (typeof DATA !== 'undefined' && Array.isArray(DATA.orgSecOrder)) ? DATA.orgSecOrder : [];
    const secs = (L) => { const o = [], ix = {}; L.forEach((p) => { const s = p.section || 'Lainnya'; if (ix[s] === undefined) { ix[s] = o.length; o.push({ name: s, list: [] }); } o[ix[s]].list.push(p); }); return o.sort((a, b) => { const i = ord.indexOf(a.name), j = ord.indexOf(b.name); return (i < 0 ? 999 : i) - (j < 0 ? 999 : j); }); };
    const out = []; let no = 0; const done = new Set();
    const stat = (L) => { const v = L.filter(isVac).length; return `${L.length} MPP · ${L.length - v} MPA · ${v} Vacant`; };
    const person = (p, depth) => {
      if (done.has(p)) return; done.add(p);
      const ket = (typeof ketPTK === 'function' && p.ptk) ? (() => { try { const k = ketPTK(p); return k && (k.t || k.label || k.text || (typeof k === 'string' ? k : '')) || ''; } catch (e) { return ''; } })() : '';
      out.push({ no: ++no, depth, jab: (depth ? '   '.repeat(depth - 1) + '↳ ' : '') + (p.jabatan || ''), nama: isVac(p) ? 'Vacant' : String(p.nama || '').trim(), vac: isVac(p), repl: isRepl(p),
        atasan: (p.__at || p.atasan) && byUid[p.__at || p.atasan] ? nm(byUid[p.__at || p.atasan]) : '', grp: p.group && p.group !== p.section ? p.group : '', status: isVac(p) ? 'Vacant' : isRepl(p) ? 'Akan diganti' : 'Terisi', tone: isVac(p) ? 'red' : isRepl(p) ? 'org' : 'grn', ket: ket && (isVac(p) || isRepl(p)) ? String(ket).toUpperCase() : '' });
      P.filter((k) => k.atasan === p.uid && k !== p && (k.section || 'Lainnya') === (p.section || 'Lainnya') && arOf(k) === arOf(p)).forEach((k) => person(k, depth + 1));   // bawahan di section lain tampil di section-nya (kolom Atasan)
    };
    const roots = (L) => L.filter((p) => !p.atasan || !byUid[p.atasan] || !L.includes(byUid[p.atasan]));
    const block = (L) => {
      secs(L).forEach((s) => {
        if (!isTopS(s.name)) out.push({ bar: 'sec', text: `${String(s.name).toUpperCase()} · ${stat(s.list)}` });
        roots(s.list).forEach((p) => person(p, 0));
        s.list.forEach((p) => person(p, 0));   // sisa (rantai atasan lintas section)
      });
    };
    if (both) {
      const head = P.filter((p) => isTopS(p.section) && !p.atasan && p.orgTop !== false && (p.orgTop === true || (/dep(ar)?t(e)?(ment|men)?\.?\s*head|manager/i.test(p.jabatan || '') && !/supervisor|spv/i.test(p.jabatan || ''))));
      if (head.length) { out.push({ bar: 'top', text: 'DEPT HEAD · membawahi KTA - TRA Hauling & Mining' }); head.forEach((p) => { done.add(p); out.push({ no: ++no, depth: 0, jab: p.jabatan || '', nama: isVac(p) ? 'Vacant' : String(p.nama || '').trim(), vac: isVac(p), repl: isRepl(p), atasan: '', grp: '', status: isVac(p) ? 'Vacant' : 'Terisi', tone: isVac(p) ? 'red' : 'grn', ket: '' }); }); }
      ['Hauling', 'Mining'].forEach((a) => {
        const L = P.filter((p) => arOf(p) === a && !done.has(p)); if (!L.length) return;
        out.push({ bar: a, text: `KTA - TRA ${a.toUpperCase()} · ${stat(P.filter((p) => arOf(p) === a))}` });
        // supervisor / PJO project tampil paling atas; bawahan langsung Dept Head dihitung sebagai pimpinan project
        const hs = new Set(head.map((h) => h.uid));
        L.forEach((p) => { if (hs.has(p.atasan)) p.__root = true; });
        const saveAt = L.map((p) => [p, p.atasan]); L.forEach((p) => { if (p.__root) { p.__at = p.atasan; p.atasan = null; } });
        try { block(L); } finally { saveAt.forEach(([p, at]) => { p.atasan = at; delete p.__root; delete p.__at; }); }
      });
    } else block(P);
    // model bagan (untuk sheet Bagan Struktur Organisasi)
    const card = (p, depth) => ({ depth, jab: p.jabatan || '', nama: isVac(p) ? 'Vacant' : String(p.nama || '').trim(), vac: isVac(p), repl: isRepl(p), status: isVac(p) ? 'Vacant' : isRepl(p) ? 'Akan diganti' : 'Terisi',
      ket: (isVac(p) || isRepl(p)) && p.ptk && typeof ketPTK === 'function' ? (() => { try { return String(ketPTK(p) || ''); } catch (e) { return ''; } })() : '' });
    const walk = (L, at) => { const res = [], seen = new Set(); const go = (p, d) => { if (seen.has(p)) return; seen.add(p); res.push(card(p, d)); L.filter((k) => at(k) === p.uid && k !== p).forEach((k) => go(k, d + 1)); };
      L.filter((p) => !at(p) || !L.some((q) => q.uid === at(p))).forEach((p) => go(p, 0)); L.forEach((p) => go(p, 0)); return res; };
    const at0 = (p) => p.atasan;
    const secModel = (L, at) => secs(L).filter((s) => !isTopS(s.name)).map((s) => ({ name: String(s.name).toUpperCase(), stat: stat(s.list), members: walk(s.list, at) }));
    let chart;
    if (both) {
      const head = P.filter((p) => isTopS(p.section) && !p.atasan && p.orgTop !== false && (p.orgTop === true || (/dep(ar)?t(e)?(ment|men)?\.?\s*head|manager/i.test(p.jabatan || '') && !/supervisor|spv/i.test(p.jabatan || ''))));
      const hs = new Set(head.map((h) => h.uid)), at = (p) => hs.has(p.atasan) ? null : p.atasan;
      chart = { name: rkName(), multi: true, tops: head.map((p) => card(p, 0)), areas: ['Hauling', 'Mining'].map((a) => {
        const L = P.filter((p) => arOf(p) === a && !hs.has(p.uid));
        const topL = L.filter((p) => isTopS(p.section));
        return { name: a, stat: stat(P.filter((p) => arOf(p) === a)), tops: walk(topL, at).filter((x) => !x.depth), secs: secModel(L, at), _extraTop: walk(topL, at).filter((x) => x.depth) };
      }).filter((a) => a.tops.length || a.secs.length) };
      chart.areas.forEach((a) => { if (a._extraTop.length) a.secs.unshift({ name: 'PENANGGUNG JAWAB OPERASIONAL', stat: '', members: a._extraTop }); delete a._extraTop; });
    } else {
      const topL = P.filter((p) => isTopS(p.section));
      const tw = walk(topL, at0);
      const secsM = secModel(P, at0);
      if (tw.some((x) => x.depth)) secsM.unshift({ name: 'PENANGGUNG JAWAB OPERASIONAL', stat: '', members: tw.filter((x) => x.depth) });
      chart = { name: rkName(), multi: false, tops: tw.filter((x) => !x.depth), areas: [{ name: '', stat: '', tops: [], secs: secsM }] };
    }
    return { name: rkName(), rows: out, chart };
  }
  // ambil susunan bagan dari halaman Struktur Organisasi (semua section & area): posisi kotak, warna, dan garis penghubung
  async function orgDom() {
    if (!((DATA && DATA.positions) || []).length) return null;
    const keep = { page: ui.page, osec: ui.osec, oarea: ui.oarea, y: window.scrollY };
    ui.page = 'org'; ui.osec = 'semua'; if ('oarea' in ui) ui.oarea = 'semua';
    document.body.classList.add('oexport');
    try {
      render();
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 150)));
      const root = document.querySelector('#orgSizer .org'); if (!root) return null;
      const pz = root.style.zoom, pt = root.style.transform; root.style.zoom = '1'; root.style.transform = 'none';
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60)));
      try {
        const RR = root.getBoundingClientRect();
        const rel = (r) => ({ x0: r.left - RR.left, y0: r.top - RR.top, x1: r.right - RR.left, y1: r.bottom - RR.top });
        const hexOf = (c) => c;
        const boxes = [], lines = [];
        const bgOf = (el) => { for (let e = el; e && e !== root; e = e.parentElement) { const cs = getComputedStyle(e), b = cs.backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; const gi = (cs.backgroundImage || '').match(/rgba?\([^)]*\)/); if (gi) return gi[0]; if (e.classList.contains('ocard') || e.classList.contains('onode')) break; } return 'rgb(255, 255, 255)'; };
        const part = (el, par) => { const cs = getComputedStyle(el), r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
          const txt = (el.innerText || '').replace(/\s*\n\s*/g, ' · ').trim(); if (!txt) return;
          const q = rel(r); if (par) { const pr = rel(par.getBoundingClientRect()); q.x0 = pr.x0 + 2; q.x1 = pr.x1 - 2; }
          const rg = document.createRange(); rg.selectNodeContents(el); const one = new Set([...rg.getClientRects()].filter((x) => x.width > 1).map((x) => Math.round(x.top / 4))).size <= 1;
          boxes.push({ ...q, text: txt, one, bg: hexOf(bgOf(el)), color: cs.color, bold: (+cs.fontWeight || 400) >= 600, size: Math.max(6.5, Math.round(parseFloat(cs.fontSize) * 0.68 * 2) / 2), strike: /line-through/.test(cs.textDecorationLine || ''), align: /left|start/.test(cs.textAlign) ? 'left' : /right|end/.test(cs.textAlign) ? 'right' : 'center' }); };
        root.querySelectorAll('.ocard, .onode').forEach((n) => {
          const kids = [...n.children].filter((c) => !c.classList.contains('oacts') && c.innerText && c.innerText.trim() && getComputedStyle(c).display !== 'none');
          if (kids.length) kids.forEach((k) => part(k, n)); else part(n);
        });
        // teks lain di luar kotak (judul sub-section, catatan) — ambil elemen terdalam yang punya teks langsung
        root.querySelectorAll('*').forEach((el) => {
          if (el.closest('.ocard, .onode, .oacts') || getComputedStyle(el).display === 'none') return;
          const own = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
          if (!own || el.parentElement && boxes.some((b) => b.el === el.parentElement)) return;
          const n0 = boxes.length; part(el); if (boxes.length > n0) boxes[boxes.length - 1].el = el;
        });
        boxes.forEach((b) => { delete b.el; });
        // garis: border elemen bukan kotak (bingkai section) + pseudo-element ::before/::after (penghubung)
        const inBox = (el) => !!el.closest('.ocard, .onode');
        const edges = (r, cs, ty0) => {
          const w = (k) => parseFloat(cs['border' + k + 'Width']) || 0, vis = (k) => w(k) > 0 && cs['border' + k + 'Style'] !== 'none' && hexOf(cs['border' + k + 'Color']) && !/rgba\(0, 0, 0, 0\)/.test(cs['border' + k + 'Color']);
          const ty = (k) => ty0 || (/dot|dash/.test(cs['border' + k + 'Style']) ? 'dot' : 'solid');
          if (vis('Top')) lines.push({ v: false, x0: r.x0, x1: r.x1, y0: r.y0, ty: ty('Top') });
          if (vis('Bottom')) lines.push({ v: false, x0: r.x0, x1: r.x1, y0: r.y1, ty: ty('Bottom') });
          if (vis('Left')) lines.push({ v: true, x0: r.x0, y0: r.y0, y1: r.y1, ty: ty('Left') });
          if (vis('Right')) lines.push({ v: true, x0: r.x1, y0: r.y0, y1: r.y1, ty: ty('Right') });
        };
        [root, ...root.querySelectorAll('*')].forEach((el) => {
          if (inBox(el) || el.closest('.oacts')) return;
          const er = el.getBoundingClientRect(), cs = getComputedStyle(el);
          if (er.width > 1 && er.height > 1 && el !== root) edges(rel(er), cs);
          ['::before', '::after'].forEach((ps) => {
            const p = getComputedStyle(el, ps); if (!p || p.content === 'none' || p.display === 'none' || p.content === 'normal') return;
            const W = parseFloat(p.width), H = parseFloat(p.height); if (!(W >= 0) || !(H >= 0)) return;
            let x = parseFloat(p.left), y = parseFloat(p.top);
            if (isNaN(x)) { const rr = parseFloat(p.right); x = isNaN(rr) ? 0 : er.width - rr - W - (parseFloat(p.borderLeftWidth) || 0) - (parseFloat(p.borderRightWidth) || 0); }
            if (isNaN(y)) { const bb = parseFloat(p.bottom); y = isNaN(bb) ? 0 : er.height - bb - H - (parseFloat(p.borderTopWidth) || 0) - (parseFloat(p.borderBottomWidth) || 0); }
            if (p.position !== 'absolute' && p.position !== 'fixed') return;
            const bw = (parseFloat(p.borderLeftWidth) || 0) + (parseFloat(p.borderRightWidth) || 0), bh = (parseFloat(p.borderTopWidth) || 0) + (parseFloat(p.borderBottomWidth) || 0);
            const r = { x0: er.left - RR.left + x, y0: er.top - RR.top + y }; r.x1 = r.x0 + W + bw; r.y1 = r.y0 + H + bh;
            edges(r, p);
            const bgc = p.backgroundColor; if (bgc && !/rgba\(0, 0, 0, 0\)|transparent/.test(bgc)) { if (W + bw <= 4 && H + bh > 4) lines.push({ v: true, x0: (r.x0 + r.x1) / 2, y0: r.y0, y1: r.y1, ty: 'solid' }); else if (H + bh <= 4 && W + bw > 4) lines.push({ v: false, x0: r.x0, x1: r.x1, y0: (r.y0 + r.y1) / 2, ty: 'solid' }); }
          });
        });
        boxes.forEach((b) => { b.bg = hexF(b.bg); b.color = hexF(b.color); });
        return { W: Math.max(RR.width, ...boxes.map((b) => b.x1), ...lines.map((l) => l.x1 || l.x0)), H: Math.max(RR.height, ...boxes.map((b) => b.y1)), boxes, lines };
      } finally { root.style.zoom = pz; root.style.transform = pt; }
    } finally {
      document.body.classList.remove('oexport');
      ui.page = keep.page; ui.osec = keep.osec; if (keep.oarea !== undefined) ui.oarea = keep.oarea;
      render(); window.scrollTo(0, keep.y);
    }
  }
  const hexF = (c) => { const m = String(c || '').match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/); if (!m) return null; const a = m[4] === undefined ? 1 : +m[4]; if (a < 0.05) return null; const mix = (v) => Math.round(+v * a + 255 * (1 - a)); return [mix(m[1]), mix(m[2]), mix(m[3])].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase(); };
  function captureOldExport(fn) {
    if (typeof XLSX === 'undefined' || !XLSX.utils) return null;
    const U = XLSX.utils, keep = { n: U.book_new, a: U.aoa_to_sheet, b: U.book_append_sheet, w: XLSX.write }, sv = typeof save === 'function' ? save : null;
    const out = [];
    U.book_new = () => ({ SheetNames: [], Sheets: {} });
    U.aoa_to_sheet = (aoa) => ({ __aoa: aoa });
    U.book_append_sheet = (wb, ws, name) => { out.push([name, (ws && ws.__aoa) || []]); };
    XLSX.write = () => new Uint8Array(0);
    if (sv) save = () => {};
    try { fn(); } catch (e) { console.error(e); } finally { U.book_new = keep.n; U.aoa_to_sheet = keep.a; U.book_append_sheet = keep.b; XLSX.write = keep.w; if (sv) save = sv; }
    return out;
  }
  if (typeof exportXLSX === 'function') {
    const _oldExport = exportXLSX;
    exportXLSX = async function () {
      if ((typeof XLSX === 'undefined' || !XLSX.write) && typeof loadXLSX === 'function') { try { await loadXLSX(); } catch (e) { toast('Pembuat Excel gagal dimuat. Periksa koneksi internet.', true); return; } }
      const sheets = captureOldExport(_oldExport);
      if (!sheets) return _oldExport.apply(this, arguments);
      if (!sheets.length) return;   // tidak diizinkan / dibatalkan oleh pengecekan di web
      try { toast('Menyiapkan Excel…'); } catch (e) {}
      const P = (typeof DATA !== 'undefined' && DATA.positions) || [];
      const hasArea = P.some((p) => /hauling/i.test(p.area || '')) && P.some((p) => !/hauling/i.test(p.area || ''));
      const arOf = (x) => /hauling/i.test((x && x.area) || '') ? 'Hauling' : 'Mining';
      const out = sheets.map(([nm, aoa]) => {
        aoa = aoa.map((r) => (r || []).slice());
        const isMpp = /MPP/i.test(nm), isAkt = /aktif/i.test(nm), isOut = /out|keluar/i.test(nm);
        // KTA-TRA: kolom Area di paling kanan (tidak menggeser kolom lama)
        if (hasArea && (isMpp || isAkt || isOut)) {
          const src = isMpp ? P : isAkt ? (DATA.aktif || []) : (DATA.keluar || []);
          if (aoa.length - 1 === src.length) { const w = aoa[0].length; aoa[0].push('Area'); src.forEach((x, i) => { const r = aoa[i + 1]; while (r.length < w) r.push(''); r.push(arOf(x)); }); }
        }
        // KTA-TRA: Populasi Unit & Detail Unit dipisah per project (kolom Area + diurutkan Hauling lalu Mining)
        const isUnit = /populasi unit/i.test(nm), isDet = /detail unit/i.test(nm);
        if (hasArea && (isUnit || isDet)) {
          const U = (DATA.units || []);
          const src = isUnit ? U : U.flatMap((u) => (Array.isArray(u.details) ? u.details : []).map(() => u));
          if (aoa.length - 1 === src.length) {
            const w = aoa[0].length; aoa[0].push('Area');
            const body = aoa.slice(1).map((r, i) => { while (r.length < w) r.push(''); r.push(arOf(src[i])); return r; });
            body.sort((x, y) => (x[w] === 'Mining') - (y[w] === 'Mining'));
            aoa = [aoa[0]].concat(body);
          }
        }
        const styleOf = (h, v) => {
          const s = String(v == null ? '' : v);
          if (/^nama$/i.test(h) && /^vacant$/i.test(s.trim())) return 'red';
          if (/^ket\.? ?ptk$|keterangan ptk/i.test(h)) return /^jatuh tempo$/i.test(s) ? 'red' : /hampir/i.test(s) ? 'org' : /on track|selesai/i.test(s) ? 'grn' : null;
          if (/^status$/i.test(h) && isMpp) return /^open$/i.test(s) ? 'red' : /continue/i.test(s) ? 'org' : /close/i.test(s) ? 'grn' : null;
          if (/^area$/i.test(h)) return /hauling/i.test(s) ? 'org' : 'blu';
          return null;
        };
        return [nm, aoa, styleOf];
      });
      // sheet Pelamar: semua pelamar per posisi
      const ph = ['No Posisi'].concat(hasArea ? ['Area'] : []).concat(['Jabatan', 'Posisi (Nama di MPP)', 'Nama Pelamar', 'Status', 'Tahap Terakhir', 'Keterangan', 'Sumber']);
      const pr = [ph], act = [];
      P.forEach((p) => (Array.isArray(p.cands) ? p.cands : []).filter((c) => c && c.name).forEach((c) => {
        pr.push([p.no].concat(hasArea ? [arOf(p)] : []).concat([p.jabatan || '', p.nama || '', c.name, c.status || 'Aktif', rkStep(c), String(c.note || '').trim(), c.sumber || '']));
        act.push(rkActive(c));
      }));
      if (pr.length > 1) out.push(['Pelamar', pr, (h, v, i) => /^nama pelamar$/i.test(h) ? (act[i] ? 'bold' : 'cx') : /^status$/i.test(h) ? (act[i] ? 'grn' : 'cx') : /^area$/i.test(h) ? (/hauling/i.test(String(v)) ? 'org' : 'blu') : (act[i] ? null : 'cx')]);
      const sites = await rkSites();
      let org = null; try { org = orgRows(); } catch (e) { console.error(e); }
      try { const dm = await orgDom(); if (dm && org) org.dom = dm; } catch (e) { console.error(e); }
      const blob = await buildBook(sites, out, org); if (!blob) return;
      await saveBlob(`Monitoring_Manpower_${rkName().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}_${new Date().toISOString().slice(0, 10)}.xlsx`, blob);
    };
  }
  window.rekapPrint = rekapPrint;
  const RK_IC = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h16v14H4zM4 9h16M4 13h16M9 9v10" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  const XL_IC = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const PR_IC = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  function rkButton() {
    if ((ui.page !== 'dashboard' && ui.page !== 'mpp') || document.getElementById('rkBtn')) return;
    const html = `<details class="rkm" id="rkBtn"><summary class="btn btn-g" title="Rekap Plan / Actual / Vacant / Keterangan per jobsite">${RK_IC}Rekap MPP <span aria-hidden="true">▾</span></summary><div class="rkm-p"><button type="button" data-rk="print">${PR_IC}Print / PDF</button><button type="button" data-rk="xlsx">${XL_IC}Download Excel</button></div></details>`;
    const pb = document.querySelector('#view #printBtn');
    if (pb) { pb.insertAdjacentHTML('beforebegin', html); return; }
    const hr = document.querySelector('#view .head .head-r') || document.querySelector('#view .toolbar');
    if (hr) hr.insertAdjacentHTML('beforeend', html);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-rk]');
    const m = document.getElementById('rkBtn');
    if (m && m.open && !(e.target.closest && e.target.closest('#rkBtn'))) m.open = false;
    if (!b) return;
    e.preventDefault(); if (m) m.open = false;
    if (b.dataset.rk === 'xlsx') rekapExcel(); else rekapPrint();
  });

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
  render = function () { const r = _render.apply(this, arguments); try { navSubs(); } catch (e) {} try { rkButton(); } catch (e) {} return r; };

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
  // bagan struktur di dashboard: diperkecil mengikuti lebar kertas yang dipilih (tidak terpotong)
  window.addEventListener('beforeprint', () => {
    let st = document.getElementById('dashOrgPrint'); if (!st) { st = document.createElement('style'); st.id = 'dashOrgPrint'; document.head.appendChild(st); }
    st.textContent = '';
    if (ui.page !== 'dashboard') return;
    const sz = document.getElementById('orgSizerD'), og = sz && sz.querySelector('.org'); if (!og) return;
    const tr = og.style.transform; og.style.transform = 'none'; const W = og.offsetWidth; og.style.transform = tr;
    if (!W) return;
    let css = '@media print{#orgSizerD{width:auto!important;height:auto!important}#orgSizerD .org{transform:none!important}#orgWrapD{overflow:visible!important}}';
    for (let pw = 300; pw < W + 80; pw += 20) css += `@media print and (min-width:${pw}px){#orgSizerD .org{zoom:${Math.min(1, (pw - 80) / W).toFixed(3)}}}`;
    st.textContent = css;
  });
  window.addEventListener('afterprint', () => { const st = document.getElementById('dashOrgPrint'); if (st) st.textContent = ''; });
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

  // ---------- Berkas: langsung buka di Google Drive (tab baru), tidak dimuat di web ----------
  // Pemilik & pengguna berizin download → langsung ke Drive. Pelihat tanpa izin tetap pratinjau di web.
  // Berkas yang belum tersinkron ke Drive (baru diupload, < 10 menit) tetap dibuka dengan pratinjau lama.
  if (typeof openFile === 'function') {
    const _openFile = openFile;
    openFile = async function (id, name) {
      let owner = false, dl = false; try { owner = !!IS_OWNER; dl = !!DL; } catch (e) {}
      if (!(owner || dl) || typeof WEB === 'undefined' || !WEB.sb) return _openFile.apply(this, arguments);
      const w = window.open('', '_blank');   // dibuka saat klik supaya tidak diblokir pop-up
      try { if (w) w.document.write('<title>Membuka…</title><p style="font:15px system-ui,sans-serif;padding:24px;color:#444">Membuka berkas di Google Drive…</p>'); } catch (e) {}
      let link = null;
      try { const r = await WEB.sb.rpc('kta_drive_link', { p_storage_id: id }); link = (r.data || [])[0] || null; } catch (e) { link = null; }
      if (link && link.drive_id && (owner || link.shared)) {
        const u = 'https://drive.google.com/file/d/' + encodeURIComponent(link.drive_id) + '/view';
        if (w) { try { w.opener = null; } catch (e) {} w.location.href = u; } else window.open(u, '_blank', 'noopener');
        return;
      }
      try { if (w) w.close(); } catch (e) {}
      return _openFile.apply(this, arguments);
    };
  }

  // ===== Status PTK "Hold": posisi dikunci (tidak bisa diedit) + diberi tanda kuning =====
  const isHold = (p) => !!p && /^hold$/i.test(String(p.status || '').trim());
  const holdMsg = (p) => `Posisi No. ${p.no} (${p.jabatan}) sedang HOLD. Ubah Status PTK ke Open / Continue dulu untuk mengedit.`;
  if (!document.getElementById('holdCss')) {
    const st = document.createElement('style'); st.id = 'holdCss';
    st.textContent = `tr.ptk-hold>td{background:repeating-linear-gradient(135deg,#FFFBEB 0 12px,#FEF3C7 12px 24px)!important}
tr.ptk-hold>td:first-child{box-shadow:inset 4px 0 0 #D97706}
tr.ptk-hold [data-cands],tr.ptk-hold [data-delpos]{opacity:.45;cursor:not-allowed}
.stt.hold{background:#FEF3C7!important;color:#92400E!important;border:1px solid #F59E0B!important;font-weight:800}
.holdtag{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;background:#D97706;color:#fff;font-size:10px;font-weight:800;letter-spacing:.06em;vertical-align:middle}
.ocard.ptk-hold{outline:2px dashed #D97706;outline-offset:2px;background:#FFFBEB}
.holdnote{margin:0 0 12px;padding:10px 12px;border-radius:10px;background:#FEF3C7;border:1px solid #F59E0B;color:#92400E;font-size:13px;font-weight:600}
@media print{tr.ptk-hold>td{background:#FEF3C7!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
    document.head.appendChild(st);
  }
  // tandai baris / kartu bagan setelah setiap render
  const markHold = () => {
    const P = (typeof DATA !== 'undefined' && DATA.positions) || [];
    document.querySelectorAll('[data-epos]').forEach((el) => {
      const p = P[+el.dataset.epos]; const h = isHold(p);
      const box = el.closest('tr') || (el.classList.contains('ocard') ? el : el.closest('.ocard'));
      if (box) box.classList.toggle('ptk-hold', h);
    });
    document.querySelectorAll('tr.ptk-hold .stt').forEach((s) => { if (/^hold$/i.test(s.textContent.trim())) { s.classList.add('hold'); if (!s.nextElementSibling || !s.nextElementSibling.classList.contains('holdtag')) s.insertAdjacentHTML('afterend', '<span class="holdtag" title="Data posisi dikunci">TERKUNCI</span>'); } });
  };
  if (typeof render === 'function') { const _rH = render; render = function () { const r = _rH.apply(this, arguments); try { markHold(); } catch (e) {} return r; }; }
  // tombol Pelamar / Hapus pada posisi Hold ditolak; Edit tetap bisa dibuka untuk mengubah Status saja
  window.addEventListener('click', (e) => {   // window (capture) jalan sebelum handler halaman di document
    const P = (typeof DATA !== 'undefined' && DATA.positions) || [];
    const b = e.target.closest && e.target.closest('[data-cands],[data-delpos]'); if (!b) return;
    const p = P[+(b.dataset.cands ?? b.dataset.delpos)]; if (!isHold(p)) return;
    e.preventDefault(); e.stopImmediatePropagation(); try { toast(holdMsg(p), true); } catch (er) {}
  }, true);
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-epos]'); if (!b) return;
    const p = ((typeof DATA !== 'undefined' && DATA.positions) || [])[+b.dataset.epos]; if (!isHold(p)) return;
    setTimeout(() => {
      const sel = [...document.querySelectorAll('select[name="status"]')].pop(); if (!sel) return;
      const form = sel.closest('form') || sel.closest('.modal,.sheet,.dlg') || sel.parentElement.parentElement.parentElement;
      const lock = () => { const on = /^hold$/i.test(sel.value); form.querySelectorAll('input,select,textarea').forEach((x) => { if (x !== sel && x.type !== 'hidden') x.disabled = on; }); };
      if (!form.querySelector('.holdnote')) sel.closest('.fld') ? form.insertAdjacentHTML('afterbegin', '<div class="holdnote">⏸ Posisi ini sedang HOLD, semua data dikunci. Ubah <b>Status</b> ke Open / Continue untuk membuka kunci.</div>') : 0;
      sel.addEventListener('change', lock); lock();
    }, 30);
  }, false);
  // pengaman di penyimpanan: perubahan apa pun pada posisi Hold dibatalkan (kecuali mengubah Status-nya)
  if (typeof commit === 'function') {
    const _cH = commit;
    const SKIP = new Set(['status', 'close', 'no', 'hist']);
    const sig = (p) => JSON.stringify(Object.keys(p).filter((k) => !SKIP.has(k)).sort().map((k) => [k, p[k]]));
    commit = function (mutate, ...rest) {
      return _cH.call(this, (S) => {
        const held = (S.positions || []).map((p, i) => [p, i]).filter(([p]) => isHold(p)).map(([p, i]) => ({ uid: p.uid, i, old: JSON.parse(JSON.stringify(p)), s: sig(p) }));
        const r = mutate(S);
        if (held.length) {
          const back = [];
          held.forEach((h) => {
            const j = S.positions.findIndex((x) => x && h.uid && x.uid === h.uid);
            if (j < 0) { S.positions.splice(Math.min(h.i, S.positions.length), 0, h.old); back.push(h.old.no); return; }
            const cur = S.positions[j];
            if (sig(cur) !== h.s) { S.positions[j] = { ...h.old, status: cur.status, close: cur.close, no: cur.no }; back.push(h.old.no); }
          });
          if (back.length) setTimeout(() => { try { toast(`Posisi HOLD tidak diubah (No. ${back.join(', ')}). Ubah Status ke Open / Continue dulu.`, true); } catch (e) {} }, 400);
        }
        return r;
      }, ...rest);
    };
  }
  try { markHold(); } catch (e) {}

  try { if (ui.page === 'dashboard') render(); else navSubs(); } catch (e) {}
})();
