/* Pusat Monitoring → Aktivitas (khusus Pemilik): siapa melakukan apa, kapan, di web mana. */
(function () {
  if (typeof pageSet !== 'function' || typeof S === 'undefined') return;
  const APPS = { kmb: 'Manpower KMB', mbj: 'Manpower MBJ', 'bupr-ampah': 'Manpower BUPR', 'kta-tra': 'Manpower KTA-TRA', apd: 'APD', notulensi: 'Notulensi', 'unit-monitoring': 'Monitoring Unit' };
  const A = { rows: null, loading: false, err: null, limit: 300, app: '', who: '', q: '', open: {} };
  const owner = () => typeof isOwner === 'function' && isOwner();
  const DAY = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const jkt = (t) => new Date(new Date(t).getTime() + 7 * 3600e3); // tampil dalam WIB
  const dkey = (t) => jkt(t).toISOString().slice(0, 10);
  const hm = (t) => jkt(t).toISOString().slice(11, 16);

  async function load() {
    if (A.loading || !S.sb || !owner()) return;
    A.loading = true; A.err = null;
    try {
      let q = S.sb.from('kta_activity_log').select('id,at,app,site,page,actor,role,action,detail').order('at', { ascending: false }).limit(A.limit);
      if (A.app) q = q.eq('app', A.app);
      const { data, error } = await q;
      if (error) throw error;
      A.rows = data || [];
    } catch (e) { A.err = (e && e.message) || 'gagal memuat'; A.rows = A.rows || []; }
    A.loading = false;
    if (ui.page === 'act') render();
  }

  function pageAct() {
    const head = `<div class="sethead"><div><div class="eb">Khusus Pemilik</div><h1 class="h1s">Aktivitas</h1><p class="sub">Semua perubahan yang dilakukan Pemilik, Editor, dan link tanpa login di setiap web monitoring. Hanya Pemilik yang bisa melihat halaman ini.</p></div><button type="button" class="btn btn-g" data-page="home">← Kembali</button></div>`;
    if (!owner()) return head + '<div class="scard"><p>Halaman ini khusus Pemilik.</p></div>';
    if (A.rows === null) { load(); return head + '<div class="lock"><p>Memuat aktivitas…</p></div>'; }
    const q = A.q.toLowerCase();
    const rows = A.rows.filter((r) => (!A.who || r.actor === A.who) && (!q || `${r.action} ${r.detail || ''} ${r.actor} ${r.site || ''}`.toLowerCase().includes(q)));
    const people = [...new Set(A.rows.map((r) => r.actor))].sort();
    const groups = []; rows.forEach((r) => { const k = dkey(r.at); const g = groups[groups.length - 1]; if (g && g.k === k) g.rows.push(r); else groups.push({ k, rows: [r] }); });
    const today = dkey(Date.now()), yest = dkey(Date.now() - 864e5);
    const tools = `<div class="actbar">
      <select id="actApp" aria-label="Web"><option value="">Semua web</option>${Object.entries(APPS).map(([k, l]) => `<option value="${k}" ${A.app === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <select id="actWho" aria-label="Orang"><option value="">Semua orang</option>${people.map((p) => `<option value="${esc(p)}" ${A.who === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
      <input type="search" id="actQ" placeholder="Cari aktivitas, nama karyawan…" value="${esc(A.q)}" aria-label="Cari aktivitas">
      <button type="button" class="btn btn-g" id="actRefresh">${A.loading ? 'Memuat…' : 'Muat ulang'}</button>
      ${rows.length ? `<button type="button" class="btn btn-g actdel-all" id="actDelAll">Hapus ${rows.length} yang tampil</button>` : ''}
    </div>`;
    const body = groups.map((g) => {
      const d = new Date(g.k + 'T00:00:00Z');
      const lbl = g.k === today ? 'Hari ini' : g.k === yest ? 'Kemarin' : DAY[d.getUTCDay()];
      return `<div class="actday"><div class="actdate"><span>${lbl}</span><b>${d.getUTCDate()}</b><span>${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}</span></div><ol class="actlist">${g.rows.map((r) => {
        const det = (r.detail || '').split('\n').filter(Boolean);
        return `<li><i class="actdot ${r.role === 'owner' ? 'o' : r.actor === 'link tanpa login' ? 'g' : ''}"></i><div class="actbody">
          <div class="acttop"><b>${hm(r.at)}</b><span class="actapp">${esc(APPS[r.app] || r.app)}${r.site ? ' · ' + esc(r.site) : ''}</span><button type="button" class="actx" data-actdel="${r.id}" title="Hapus catatan ini" aria-label="Hapus catatan ini">×</button></div>
          <div class="actmsg">${esc(r.action)}</div>
          <div class="actwho">${esc(r.actor)}${r.role ? ` <span class="actrole">${r.role === 'owner' ? 'Pemilik' : r.role === 'editor' ? 'Editor' : esc(r.role)}</span>` : ''}</div>
          ${det.length ? `<details ${A.open[r.id] ? 'open' : ''} data-actopen="${r.id}"><summary>Rincian (${det.length})</summary><ul>${det.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
        </div></li>`;
      }).join('')}</ol></div>`;
    }).join('');
    return head + `<div class="scard actcard">${tools}${A.err ? `<div class="nb warn">Aktivitas belum bisa dimuat: ${esc(A.err)}</div>` : ''}
      ${body || '<p class="small" style="margin:16px 0 0">Belum ada aktivitas tercatat. Aktivitas mulai dicatat sejak fitur ini aktif (24 Okt 2026).</p>'}
      ${A.rows.length >= A.limit ? '<div style="text-align:center;margin-top:14px"><button type="button" class="btn btn-g" id="actMore">Tampilkan lebih banyak</button></div>' : ''}</div>`;
  }

  const _pageSet = pageSet;
  pageSet = function () { return ui.page === 'act' ? pageAct() : _pageSet.apply(this, arguments); };
  const _who = whoUI;
  whoUI = function () {
    _who.apply(this, arguments);
    if (!owner() || document.querySelector('#menu [data-page="act"]')) return;
    const g = document.querySelector('#menu [data-page="guide"]');
    if (g) g.insertAdjacentHTML('beforebegin', '<button type="button" data-page="act" role="menuitem">Aktivitas</button>');
  };
  const _go = goPage;
  goPage = function (p) {
    if (p === 'act') A.rows = null;
    _go.apply(this, arguments);
    if (p === 'act') { try { history.replaceState(null, '', '#aktivitas'); } catch (e) {} }
  };
  if ((location.hash || '').slice(1) === 'aktivitas') { ui.page = 'act'; try { render(); } catch (e) {} }

  document.addEventListener('change', (e) => {
    if (e.target.id === 'actApp') { A.app = e.target.value; A.rows = null; render(); }
    if (e.target.id === 'actWho') { A.who = e.target.value; render(); }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id !== 'actQ') return;
    A.q = e.target.value; const pos = e.target.selectionStart; render();
    const n = document.getElementById('actQ'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (er) {} }
  });
  document.addEventListener('toggle', (e) => { const d = e.target; if (d.dataset && d.dataset.actopen) A.open[d.dataset.actopen] = d.open; }, true);
  document.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('#actRefresh')) { A.rows = null; render(); return; }
    if (t.closest('#actMore')) { A.limit += 300; A.rows = null; render(); return; }
    const x = t.closest('[data-actdel]'), all = t.closest('#actDelAll');
    if ((!x && !all) || !owner()) return;
    const q = A.q.toLowerCase();
    const ids = x ? [Number(x.dataset.actdel)] : A.rows.filter((r) => (!A.who || r.actor === A.who) && (!q || `${r.action} ${r.detail || ''} ${r.actor} ${r.site || ''}`.toLowerCase().includes(q))).map((r) => r.id);
    if (!ids.length || !confirm(x ? 'Hapus catatan aktivitas ini?' : `Hapus ${ids.length} catatan aktivitas yang sedang tampil? Data di web monitoring tidak berubah.`)) return;
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await S.sb.from('kta_activity_log').delete().in('id', ids.slice(i, i + 200));
      if (error) { alert('Gagal menghapus: ' + error.message); break; }
    }
    A.rows = A.rows.filter((r) => !ids.includes(r.id)); render();
  });

  const css = document.createElement('style');
  css.textContent = `
  .actbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:16px}
  .actbar select,.actbar input{height:40px;border:1px solid var(--line,#e5e2ef);border-radius:10px;padding:0 10px;font:inherit;background:var(--card,#fff);color:var(--ink,#1e1b3a);min-width:0}
  .actbar input{flex:1 1 220px}
  .actdel-all{color:var(--crit,#dc2626)}
  .actday{display:grid;grid-template-columns:86px 1fr;gap:12px;padding:14px 0;border-top:1px solid var(--line,#ece8f5)}
  .actday:first-of-type{border-top:0}
  .actdate{display:flex;flex-direction:column;align-items:center;color:var(--muted,#6b6880);font-size:13px;line-height:1.2;position:sticky;top:8px;align-self:start}
  .actdate b{font-size:40px;font-weight:500;color:var(--ink,#1e1b3a);line-height:1.05;margin:2px 0}
  .actlist{list-style:none;margin:0;padding:0 0 0 4px;border-left:2px solid var(--line,#e5e2ef)}
  .actlist>li{position:relative;padding:0 0 14px 20px}
  .actdot{position:absolute;left:-8px;top:3px;width:14px;height:14px;border-radius:50%;background:#dbeafe;border:2px solid #60a5fa}
  .actdot.o{background:#ede9fe;border-color:#8b5cf6}.actdot.g{background:#fef3c7;border-color:#f59e0b}
  .acttop{display:flex;align-items:center;gap:10px}
  .acttop b{font-size:15px;color:var(--ink,#1e1b3a)}
  .actapp{font-size:11.5px;font-weight:700;color:var(--p-ink,#5b21b6);background:var(--p-soft,#f3efff);border-radius:999px;padding:2px 8px}
  .actx{margin-left:auto;border:0;background:none;color:var(--muted,#9a96ad);font-size:18px;line-height:1;cursor:pointer;padding:2px 6px;border-radius:6px}
  .actx:hover{color:var(--crit,#dc2626);background:#fee2e2}
  .actmsg{color:var(--ink-2,#3b3852);margin-top:3px;font-size:14.5px}
  .actwho{color:var(--muted,#6b6880);font-size:12.5px;margin-top:2px}
  .actrole{font-size:11px;font-weight:700;color:var(--muted,#6b6880);border:1px solid var(--line,#e5e2ef);border-radius:6px;padding:0 5px;margin-left:4px}
  .actbody details{margin-top:6px;font-size:12.5px;color:var(--ink-2,#3b3852)}
  .actbody summary{cursor:pointer;color:var(--p-ink,#5b21b6);font-weight:600}
  .actbody details ul{margin:6px 0 0;padding-left:18px;max-height:260px;overflow:auto}
  .actbody details li{margin:2px 0;word-break:break-word}
  @media (max-width:560px){.actday{grid-template-columns:1fr}.actdate{flex-direction:row;gap:6px;position:static;justify-content:flex-start}.actdate b{font-size:20px;margin:0}}`;
  document.head.appendChild(css);
})();
