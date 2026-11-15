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
  function rkLine(c) {
    const st = String(c.status || '').trim();
    let note = String(c.note || '').trim();
    if (note && note.toLowerCase() === st.toLowerCase()) note = '';
    if (!note && st && st !== 'Aktif' && st !== 'Diterima') note = RK_ST[st] || st;
    if (!note && st === 'Diterima') note = 'Diterima';
    const txt = [c.name, rkStep(c), note].filter(Boolean).join(' - ');
    return rkActive(c) ? `<div class="ca">${E(txt)}</div>` : `<div class="cx">${E(txt)}</div>`;
  }
  function rkKet(p) {
    const cs = (Array.isArray(p.cands) ? p.cands : []).filter((c) => c && c.name);
    if (!cs.length) { const k = String(p.ket || '').trim(); return `<div>${E(k || 'Sourcing kandidat')}</div>`; }
    return [...cs.filter(rkActive), ...cs.filter((c) => !rkActive(c))].map(rkLine).join('');
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
      if (open) { r.nOpen++; r.ket.push({ lbl: vac ? 'Vacant' : nm + ' (diganti)', ptk: p.ptk || '', html: rkKet(p) }); }
    });
    return [...m.values()].map((r) => {
      const vac = r.plan - r.act;
      // Nama: kalau ada vacant cukup "N Vacant" (+ nama yang akan diganti); yang sudah terisi pindah ke Keterangan
      const names = vac
        ? [`<span class="op">${vac} Vacant</span>`].concat(r.repl.map((n) => `<span class="op">${E(n)}</span>`)).join(', ')
        : r.filled.map((n) => `<span>${E(n)}</span>`).concat(r.repl.map((n) => `<span class="op">${E(n)}</span>`)).join(', ');
      const terisi = vac && r.filled.length ? `<div class="kp"><span class="ok">Terisi:</span> ${E(r.filled.join(', '))}</div>` : '';
      const blocks = r.ket.map((k) => `<div class="kp">${r.nOpen > 1 || !/^Vacant$/.test(k.lbl) || terisi ? `<div class="kl"><span class="op">${E(k.lbl)}</span>${k.ptk ? ' · ' + (/^ptk/i.test(k.ptk) ? '' : 'PTK ') + E(k.ptk) : ''}</div>` : ''}${k.html}</div>`).join('');
      return { j: r.j, plan: r.plan, act: r.act, vac, names, ket: r.ket.length ? terisi + blocks : '<span class="ok">Terpenuhi</span>' };
    });
  }
  function rkTable(name, d) {
    const R = rkRows(d), n = Math.max(7, R.length), sum = (k) => R.reduce((a, r) => a + r[k], 0);
    let body = '';
    for (let i = 0; i < n; i++) { const r = R[i]; body += `<tr><td class="c">${i + 1}</td><td>${r ? E(r.j) : ''}</td><td class="nm">${r ? r.names : ''}</td><td class="c">${r ? r.plan : ''}</td><td class="c">${r ? r.act : ''}</td><td class="c">${r ? r.vac : 0}</td><td class="kt">${r ? r.ket : ''}</td></tr>`; }
    return `<table><colgroup><col style="width:5%"><col style="width:16%"><col style="width:24%"><col style="width:7.5%"><col style="width:7.5%"><col style="width:7.5%"><col style="width:32.5%"></colgroup>
      <thead><tr><th colspan="7" class="ttl">Jobsite ${E(name)}</th></tr><tr><th>No</th><th>Jabatan</th><th>Nama</th><th>Plan</th><th>Actual</th><th>Vacant</th><th>Keterangan</th></tr></thead>
      <tbody>${body}</tbody><tfoot><tr><td colspan="3">Total</td><td class="r">${sum('plan')}</td><td class="r">${sum('act')}</td><td class="r">${sum('vac')}</td><td></td></tr></tfoot></table>`;
  }
  function rkName() {
    try { if (typeof PROJ !== 'undefined' && PROJ && PROJ.sites) return (typeof PROJ_CFG !== 'undefined' && PROJ_CFG.short) || 'KMB'; } catch (e) {}
    return title().replace(/^Dashboard Manpower\s*/i, '');
  }
  async function rekapPrint() {
    let free = true; try { free = guardFree(); } catch (e) {}
    if (!free) { try { (typeof PRINT_ASK === 'function' ? PRINT_ASK : askPrint)(); } catch (e) {} return; }
    const sites = [];
    try {
      if (typeof PROJ !== 'undefined' && PROJ && PROJ.sites) {
        if (typeof loadAllSites === 'function' && PROJ.sites.some((s) => s.id !== WEB_ID && !SITE_DATA[s.id])) { try { toast('Memuat data semua jobsite…'); } catch (e) {} await loadAllSites(); }
        const ORD = ['kmb-slr-rekondisi', 'kmb-slr-maintenance', 'kmb-c4', 'kmb-workshop'], oi = (s) => { const i = ORD.indexOf(s.id); return i < 0 ? 99 : i; };
        [...PROJ.sites].sort((x, y) => oi(x) - oi(y)).forEach((s) => { const d = s.id === WEB_ID ? DATA : (SITE_DATA[s.id] || (window.SITE_SEEDS && SITE_SEEDS[s.id])); if (d) sites.push([s.name, d]); });
      }
    } catch (e) {}
    if (!sites.length) sites.push([rkName() || 'Jobsite', DATA]);
    const dt = new Date(), M = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Rekap MPP ${E(rkName())}</title><style>
      @page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{margin:0;font-family:Calibri,"Segoe UI",Arial,sans-serif;font-size:11pt;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      h1{font-size:13pt;margin:0 0 2px}p.s{margin:0 0 10px;font-size:9.5pt;color:#444}
      table{width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 16px}tr{break-inside:avoid}thead{display:table-header-group}tfoot{display:table-row-group}
      th,td{border:1px dotted #555;padding:2px 5px;height:22px;vertical-align:middle;overflow:hidden;word-wrap:break-word}
      th{font-weight:400;text-align:center;white-space:nowrap}th.ttl{background:#D9D9D9;border:1px solid #555}
      td.c{text-align:center}td.nm{font-size:10pt;line-height:1.35;padding-top:3px;padding-bottom:3px}.op{color:#C00000;font-weight:700}.ok{color:#15803D;font-weight:700}.ca{font-weight:700;color:#000}.cx{text-decoration:line-through;color:#555}.kp+.kp{margin-top:4px;padding-top:4px;border-top:1px dotted #999}.kl{font-size:9pt}td.kt{font-size:9.5pt;line-height:1.35;padding-top:3px;padding-bottom:3px}td.r{text-align:right;padding-right:8px}
      tfoot td{background:#D9D9D9;border-left:0;border-right:0}tfoot td:first-child{border-left:1px dotted #555}tfoot td:last-child{border-right:1px dotted #555}
    </style></head><body><h1>Rekap Manpower Planning ${E(rkName())}</h1><p class="s">Per ${dt.getDate()} ${M[dt.getMonth()]} ${dt.getFullYear()} · <span class="op">Merah</span> = posisi open · <span class="ok">Terisi</span> = karyawan yang sudah ada · <span class="ok">Terpenuhi</span> = tidak ada posisi open · Pelamar: Nama - Tahap - Keterangan (aktif <b>tebal</b>, tidak aktif <span class="cx">dicoret</span>).</p>
      ${sites.map(([n, d]) => rkTable(n, d)).join('')}</body></html>`;
    let fr = document.getElementById('rkFrame'); if (fr) fr.remove();
    fr = document.createElement('iframe'); fr.id = 'rkFrame'; fr.setAttribute('aria-hidden', 'true');
    fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(fr);
    const w = fr.contentWindow; w.document.open(); w.document.write(html); w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) { const x = window.open('', '_blank'); if (x) { x.document.write(html); x.document.close(); x.print(); } } }, 300);
  }
  window.rekapPrint = rekapPrint;
  const RK_IC = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h16v14H4zM4 9h16M4 13h16M9 9v10" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  function rkButton() {
    if ((ui.page !== 'dashboard' && ui.page !== 'mpp') || document.getElementById('rkBtn')) return;
    const html = `<button type="button" class="btn btn-g" id="rkBtn" title="Print tabel rekap Plan / Actual / Vacant / Keterangan per jobsite">${RK_IC}Print Rekap MPP</button>`;
    const pb = document.querySelector('#view #printBtn');
    if (pb) { pb.insertAdjacentHTML('beforebegin', html); return; }
    const hr = document.querySelector('#view .head .head-r') || document.querySelector('#view .toolbar');
    if (hr) hr.insertAdjacentHTML('beforeend', html);
  }
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('#rkBtn')) { e.preventDefault(); rekapPrint(); } });

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

  try { if (ui.page === 'dashboard') render(); else navSubs(); } catch (e) {}
})();
