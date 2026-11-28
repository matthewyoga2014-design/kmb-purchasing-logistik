/* MP Aktif / MP Out: "Atur Kolom" (urutan & kolom yang tampil, disimpan untuk semua yang membuka web,
 * hanya Pemilik & Editor yang bisa mengubah) + filter per kolom (centang nilai, berlaku untuk yang sedang membuka).
 * Pakai: <script src="../mp-cols.js"></script> SETELAH mp-private.js. Server: mp_cols_get / mp_cols_set (tabel mp_col_prefs). */
(function () {
  'use strict';
  if (typeof pageKaryawan !== 'function' || typeof MP_COLS === 'undefined' || typeof render !== 'function') return;
  const BASE = MP_COLS.slice();
  const h = (s) => (typeof esc === 'function' ? esc(String(s == null ? '' : s)) : String(s == null ? '' : s));
  const say = (m, e) => (typeof toast === 'function' ? toast(m, e) : alert(m));
  const KONG = '(Kosong)';
  let PREFS = {};
  let CF = (() => { try { const o = JSON.parse(sessionStorage.getItem('mpcf:' + location.pathname) || '{}'); const r = {}; Object.keys(o).forEach((k) => { r[k] = new Set(o[k]); }); return r; } catch (e) { return {}; } })();
  const cfSave = () => { try { const o = {}; Object.keys(CF).forEach((k) => { o[k] = [...CF[k]]; }); sessionStorage.setItem('mpcf:' + location.pathname, JSON.stringify(o)); } catch (e) {} };

  const privOk = () => !!(window.KMBPriv && KMBPriv.ok && KMBPriv.ok());
  const universe = () => BASE.concat(privOk() && KMBPriv.pcols ? KMBPriv.pcols : []);
  const defHidden = (c) => !c[3] || String(c[0]).startsWith('pv_');
  function layout() {
    const all = universe(), keys = all.map((c) => c[0]);
    const order = (PREFS.order || []).filter((k) => keys.includes(k));
    keys.forEach((k) => { if (!order.includes(k)) order.push(k); });
    const hid = new Set(PREFS.order ? (PREFS.hidden || []).filter((k) => keys.includes(k)) : all.filter(defHidden).map((c) => c[0]));
    // kolom yang baru ada (belum pernah diatur) ikut aturan bawaan
    if (PREFS.order) all.forEach((c) => { if (!PREFS.order.includes(c[0]) && defHidden(c)) hid.add(c[0]); });
    const byK = new Map(all.map((c) => [c[0], c]));
    return { order, hid, byK };
  }
  const canSet = () => typeof CAN_EDIT !== 'undefined' && CAN_EDIT === true;
  const token = () => (typeof SHARE_KEY !== 'undefined' && SHARE_KEY && typeof GUEST_ROLE !== 'undefined' && GUEST_ROLE === 'editor') ? SHARE_KEY : null;

  // ---------- susun tabel sesuai pengaturan ----------
  const _page = pageKaryawan;
  pageKaryawan = function () {
    const { order, hid, byK } = layout();
    const vis = order.filter((k) => !hid.has(k)).map((k) => { const c = byK.get(k); return [c[0], c[1], c[2], true]; });
    const was = ui.allCols; ui.allCols = false;
    MP_COLS.splice(0, MP_COLS.length, ...vis);
    let out;
    try { out = _page.apply(this, arguments); } finally { MP_COLS.splice(0, MP_COLS.length, ...BASE); ui.allCols = was; }
    const btn = canSet() ? '<button type="button" class="btn btn-g" data-mpcols title="Atur urutan & kolom yang tampil">Atur Kolom</button>' : '';
    out = out.replace(/<button type="button" class="btn btn-g" id="colBtn"[^>]*>[^<]*<\/button>/, btn);
    return out.replace(/<div class="tw"><table class="t mpp">/, '<div class="mpcf-bar" id="mpcfBar" hidden></div>$&');
  };

  // ---------- filter per kolom (di tabel yang sudah tampil) ----------
  const cellVal = (td) => (td ? td.textContent.replace(/\s+/g, ' ').trim() : '') || KONG;
  const NOF = new Set(['aksi', 'form', 'no.', '']);
  function tableEl() { return ui.page === 'karyawan' ? document.querySelector('#view table.mpp') : null; }
  function heads(t) { return Array.from(t.tHead.rows[0].cells).map((th) => (th.dataset.mpl || th.textContent).trim()); }
  function dataRows(t) { return Array.from(t.tBodies[0].rows).filter((tr) => !tr.querySelector('td.empty')); }
  function decorate() {
    const t = tableEl(); if (!t || !t.tHead || !t.tBodies.length) return;
    const H = heads(t);
    Array.from(t.tHead.rows[0].cells).forEach((th, j) => {
      if (th.dataset.mpl !== undefined || NOF.has(H[j].toLowerCase())) return;
      th.dataset.mpl = H[j];
      th.insertAdjacentHTML('beforeend', `<button type="button" class="mpcf-b${CF[H[j]] ? ' on' : ''}" data-mpcf="${h(H[j])}" aria-label="Filter ${h(H[j])}" title="Filter ${h(H[j])}"></button>`);
    });
    const rows = dataRows(t); let shown = 0;
    const idx = Object.keys(CF).map((l) => [H.indexOf(l), CF[l]]).filter(([i]) => i >= 0);
    rows.forEach((tr) => { const ok = idx.every(([i, set]) => set.has(cellVal(tr.cells[i]))); tr.hidden = !ok; if (ok) shown++; });
    const bar = document.getElementById('mpcfBar');
    if (bar) {
      const act = Object.keys(CF);
      bar.hidden = !act.length;
      bar.innerHTML = act.length ? `<span>Menampilkan <b>${shown}</b> dari ${rows.length} data</span>${act.map((l) => `<button type="button" class="mpcf-chip" data-mpcfx="${h(l)}" title="Hapus filter ${h(l)}">${h(l)}: ${h([...CF[l]].slice(0, 3).join(', '))}${CF[l].size > 3 ? ' +' + (CF[l].size - 3) : ''} ✕</button>`).join('')}<button type="button" class="mpcf-clr" data-mpcfx="*">Hapus semua filter</button>` : '';
    }
  }
  const _render = render;
  render = function () { const r = _render.apply(this, arguments); try { decorate(); } catch (e) {} return r; };

  function openFilter(btn, label) {
    const t = tableEl(); if (!t) return;
    let pop = document.getElementById('mpcfPop');
    if (!pop) { document.body.insertAdjacentHTML('beforeend', '<div id="mpcfPop" class="mpcf-pop" role="dialog" hidden></div>'); pop = document.getElementById('mpcfPop'); }
    const H = heads(t), j = H.indexOf(label); if (j < 0) return;
    // nilai dihitung dari baris yang lolos filter kolom LAIN (seperti Excel)
    const others = Object.keys(CF).filter((l) => l !== label).map((l) => [H.indexOf(l), CF[l]]).filter(([i]) => i >= 0);
    const cnt = new Map();
    dataRows(t).forEach((tr) => { if (!others.every(([i, s]) => s.has(cellVal(tr.cells[i])))) return; const v = cellVal(tr.cells[j]); cnt.set(v, (cnt.get(v) || 0) + 1); });
    (CF[label] ? [...CF[label]] : []).forEach((v) => { if (!cnt.has(v)) cnt.set(v, 0); });
    const vals = [...cnt.keys()].sort((a, b) => a === KONG ? 1 : b === KONG ? -1 : a.localeCompare(b, 'id', { numeric: true }));
    let sel = new Set(CF[label] || vals);
    const draw = () => {
      const q = (pop.querySelector('.mpcf-q') || {}).value || '';
      pop.querySelector('.mpcf-l').innerHTML = vals.filter((v) => v.toLowerCase().includes(q.toLowerCase())).map((v) => `<label><input type="checkbox" value="${h(v)}" ${sel.has(v) ? 'checked' : ''}><span>${h(v)}</span><small>${cnt.get(v)}</small></label>`).join('') || '<div class="mpcf-none">Tidak ada nilai.</div>';
    };
    pop.innerHTML = `<div class="mpcf-h"><b>Filter: ${h(label)}</b><button type="button" data-mpcfp="close" aria-label="Tutup">✕</button></div>
      <input type="search" class="mpcf-q" placeholder="Cari nilai…" aria-label="Cari nilai">
      <div class="mpcf-a"><button type="button" data-mpcfp="all">Pilih semua</button><button type="button" data-mpcfp="none">Kosongkan</button></div>
      <div class="mpcf-l"></div>
      <div class="mpcf-f"><button type="button" class="btn btn-g" data-mpcfp="clear">Hapus filter ini</button><button type="button" class="btn btn-p" data-mpcfp="ok">Terapkan</button></div>`;
    draw();
    const r = btn.getBoundingClientRect(), w = Math.min(300, window.innerWidth - 16);
    pop.style.width = w + 'px'; pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + window.scrollX)) + 'px'; pop.style.top = (r.bottom + window.scrollY + 6) + 'px';
    pop.hidden = false;
    const q = pop.querySelector('.mpcf-q'); q.oninput = draw; setTimeout(() => q.focus(), 0);
    pop.onchange = (e) => { const c = e.target.closest('input[type=checkbox]'); if (!c) return; if (c.checked) sel.add(c.value); else sel.delete(c.value); };
    pop.onclick = (e) => {
      const b = e.target.closest('[data-mpcfp]'); if (!b) return; const a = b.dataset.mpcfp;
      if (a === 'close') { pop.hidden = true; return; }
      if (a === 'all') { const qq = q.value.toLowerCase(); vals.filter((v) => v.toLowerCase().includes(qq)).forEach((v) => sel.add(v)); draw(); return; }
      if (a === 'none') { const qq = q.value.toLowerCase(); vals.filter((v) => v.toLowerCase().includes(qq)).forEach((v) => sel.delete(v)); draw(); return; }
      if (a === 'clear') delete CF[label];
      if (a === 'ok') {
        if (!sel.size) { say('Centang minimal satu nilai.', true); return; }
        if (vals.every((v) => sel.has(v))) delete CF[label]; else CF[label] = new Set(sel);
      }
      cfSave(); pop.hidden = true; render();
    };
  }

  // ---------- dialog Atur Kolom ----------
  async function saveCols(p) {
    if (!WEB.sb) { say('Belum terhubung ke server.', true); return false; }
    const r = await WEB.sb.rpc('mp_cols_set', { p_state: WEB_ID, p_prefs: p, p_token: token() });
    if (r.error) { say('Gagal menyimpan pengaturan kolom: ' + r.error.message, true); return false; }
    PREFS = p || {}; return true;
  }
  function dialog() {
    if (!canSet()) { say('Hanya Pemilik atau Editor yang dapat mengatur kolom.', true); return; }
    const { order: o0, hid: h0, byK } = layout();
    let order = o0.slice(); const hid = new Set(h0);
    let dlg = document.getElementById('mpColDlg');
    if (!dlg) { document.body.insertAdjacentHTML('beforeend', '<dialog id="mpColDlg" class="mpc-dlg"></dialog>'); dlg = document.getElementById('mpColDlg'); }
    const lab = (k) => { const c = byK.get(k); return c ? c[1] : k; };
    const vis = () => order.filter((k) => !hid.has(k));
    const draw = () => {
      const show = vis(), av = order.filter((k) => hid.has(k)), body = dlg.querySelector('.mpc-body'), top = body ? body.scrollTop : 0;
      dlg.innerHTML = `<div class="mpc"><div class="mpc-h"><div><b>Atur kolom</b><small>MP Aktif & MP Out</small></div><button type="button" class="mpc-x" data-mc="close" aria-label="Tutup">✕</button></div>
      <p class="mpc-tip">Seret <span aria-hidden="true">⠿</span> atau pakai ↑ ↓ untuk mengubah urutan. Klik <b>−</b> untuk menyembunyikan, <b>+</b> untuk menampilkan. Berlaku untuk semua yang membuka web ini.${privOk() ? ' Kolom bertanda 🔒 adalah data pribadi, hanya terlihat oleh Pemilik & Editor yang login.' : ''}</p>
      <div class="mpc-body"><div class="mpc-sec">Tambah kolom</div>
      <div class="mpc-av">${av.length ? av.map((k) => `<button type="button" data-mc="show" data-k="${h(k)}">+ ${k.startsWith('pv_') ? '🔒 ' : ''}${h(lab(k))}</button>`).join('') : '<span class="mpc-none">Semua kolom sudah tampil.</span>'}</div>
      <div class="mpc-sec">Kolom yang tampil <span>${show.length}</span></div>
      <ul class="mpc-l">${show.map((k, i) => `<li data-k="${h(k)}"><span class="mpc-g" title="Seret untuk memindah" aria-hidden="true">⠿</span><span class="mpc-n">${k.startsWith('pv_') ? '🔒 ' : ''}${h(lab(k))}</span>
        <span class="mpc-b"><button type="button" data-mc="up" ${i ? '' : 'disabled'} aria-label="Naikkan">↑</button><button type="button" data-mc="dn" ${i < show.length - 1 ? '' : 'disabled'} aria-label="Turunkan">↓</button><button type="button" class="rm" data-mc="hide" aria-label="Sembunyikan" title="Sembunyikan">−</button></span></li>`).join('')}</ul></div>
      <div class="mpc-f"><button type="button" class="btn btn-g" data-mc="reset">Kembalikan ke awal</button><span></span><button type="button" class="btn btn-g" data-mc="close">Batal</button><button type="button" class="btn btn-p" data-mc="save">Simpan</button></div></div>`;
      const b2 = dlg.querySelector('.mpc-body'); if (b2) b2.scrollTop = top;
    };
    draw();
    const swap = (k, d) => { const v = vis(), i = v.indexOf(k), o = v[i + d]; if (!o) return; const a1 = order.indexOf(k), a2 = order.indexOf(o); order[a1] = o; order[a2] = k; };
    dlg.onclick = async (e) => {
      const b = e.target.closest('[data-mc]'); if (!b) return; const a = b.dataset.mc, li = b.closest('li'), k = (li && li.dataset.k) || b.dataset.k;
      if (a === 'close') dlg.close();
      else if (a === 'hide') { if (vis().length <= 1) { say('Sisakan minimal satu kolom.', true); return; } hid.add(k); order = [...order.filter((x) => x !== k), k]; draw(); }
      else if (a === 'show') { hid.delete(k); const v = vis().filter((x) => x !== k), last = v[v.length - 1]; order = order.filter((x) => x !== k); order.splice(last ? order.indexOf(last) + 1 : 0, 0, k); draw(); }
      else if (a === 'up') { swap(k, -1); draw(); }
      else if (a === 'dn') { swap(k, 1); draw(); }
      else if (a === 'reset') { b.disabled = true; if (await saveCols({})) { say('Kolom kembali seperti awal.'); dlg.close(); render(); } else b.disabled = false; }
      else if (a === 'save') {
        b.disabled = true;
        // kolom yang tidak terlihat oleh pengatur (mis. data pribadi bagi Editor link) tetap memakai pengaturan lama
        const keep = (PREFS.order || []).filter((x) => !byK.has(x));
        const p = { order: order.concat(keep), hidden: order.filter((x) => hid.has(x)).concat((PREFS.hidden || []).filter((x) => keep.includes(x))) };
        if (await saveCols(p)) { say('Susunan kolom disimpan.'); dlg.close(); render(); } else b.disabled = false;
      }
    };
    dlg.onpointerdown = (e) => {
      const g = e.target.closest('.mpc-g'); if (!g) return; e.preventDefault();
      const li = g.closest('li'), ul = li.parentNode, body = dlg.querySelector('.mpc-body'); li.classList.add('drag');
      const move = (ev) => { const ur = body.getBoundingClientRect(); if (ev.clientY < ur.top + 30) body.scrollTop -= 12; else if (ev.clientY > ur.bottom - 30) body.scrollTop += 12;
        const ov = document.elementFromPoint(ev.clientX, ev.clientY), o = ov && ov.closest && ov.closest('.mpc-l li'); if (!o || o === li || o.parentNode !== ul) return;
        const r = o.getBoundingClientRect(); ul.insertBefore(li, ev.clientY < r.top + r.height / 2 ? o : o.nextSibling); };
      const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
        order = [...[...ul.children].map((x) => x.dataset.k), ...order.filter((x) => hid.has(x))]; draw(); };
      document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
    };
    dlg.showModal();
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('[data-mpcols]')) { e.preventDefault(); e.stopPropagation(); dialog(); return; }
    const fb = t.closest('[data-mpcf]');
    if (fb) { e.preventDefault(); e.stopPropagation(); const pop = document.getElementById('mpcfPop'); if (pop && !pop.hidden && pop.dataset.for === fb.dataset.mpcf) { pop.hidden = true; return; } openFilter(fb, fb.dataset.mpcf); const p2 = document.getElementById('mpcfPop'); if (p2) p2.dataset.for = fb.dataset.mpcf; return; }
    const x = t.closest('[data-mpcfx]');
    if (x) { e.preventDefault(); e.stopPropagation(); if (x.dataset.mpcfx === '*') CF = {}; else delete CF[x.dataset.mpcfx]; cfSave(); render(); return; }
    const pop = document.getElementById('mpcfPop'); if (pop && !pop.hidden && !t.closest('#mpcfPop')) pop.hidden = true;
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const pop = document.getElementById('mpcfPop'); if (pop) pop.hidden = true; } });

  // ---------- muat pengaturan dari server ----------
  let tries = 0;
  (function load() {
    if (typeof WEB === 'undefined' || !WEB.sb) { if (tries++ < 120) setTimeout(load, 500); return; }
    WEB.sb.rpc('mp_cols_get', { p_state: WEB_ID }).then((r) => {
      if (r && !r.error && r.data && typeof r.data === 'object') { PREFS = r.data; if (ui.page === 'karyawan') render(); }
    }, () => {});
  })();

  document.head.insertAdjacentHTML('beforeend', `<style id="mp-cols-css">
  .mpcf-b{display:inline-block;vertical-align:middle;width:18px;height:18px;margin-left:4px;border:0;border-radius:5px;cursor:pointer;background:transparent center/12px no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 5h18l-7 8v6l-4 2v-8z'/%3E%3C/svg%3E");opacity:.75}
  .mpcf-b:hover{background-color:rgba(0,0,0,.06);opacity:1}
  .mpcf-b.on{opacity:1;background-color:var(--primary-soft,#fde8e8);background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23dc3737' stroke='%23dc3737' stroke-width='2' stroke-linejoin='round'%3E%3Cpath d='M3 5h18l-7 8v6l-4 2v-8z'/%3E%3C/svg%3E")}
  .mpcf-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 10px;font-size:12.5px;color:var(--muted,#666)}
  .mpcf-chip{border:1px solid var(--line,#e5e5e5);background:var(--primary-soft,#fdeeee);color:var(--primary-ink,#a42020);border-radius:999px;padding:3px 10px;font:inherit;font-weight:600;cursor:pointer}
  .mpcf-clr{border:0;background:none;color:var(--primary,#dc3737);font:inherit;font-weight:700;cursor:pointer;text-decoration:underline}
  .mpcf-pop{position:absolute;z-index:1000;background:#fff;color:#27272a;border:1px solid #e6e6e8;border-radius:14px;box-shadow:0 18px 44px rgba(30,30,35,.18);padding:12px;display:flex;flex-direction:column;gap:8px;font-size:13px}
  .mpcf-pop[hidden]{display:none}
  .mpcf-h{display:flex;justify-content:space-between;align-items:center;gap:8px}.mpcf-h button{border:0;background:#f3f3f4;border-radius:7px;width:28px;height:28px;cursor:pointer}
  .mpcf-q{width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #e0e0e3;border-radius:8px;font:inherit}
  .mpcf-a{display:flex;gap:12px}.mpcf-a button{border:0;background:none;color:var(--primary,#dc3737);font:inherit;font-weight:700;cursor:pointer;padding:0}
  .mpcf-l{max-height:260px;overflow:auto;display:flex;flex-direction:column;gap:2px}
  .mpcf-l label{display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:7px;cursor:pointer}.mpcf-l label:hover{background:#f7f7f8}
  .mpcf-l span{flex:1;word-break:break-word}.mpcf-l small{color:#888}.mpcf-none{color:#888;padding:6px}
  .mpcf-f{display:flex;justify-content:space-between;gap:8px}
  .mpc-dlg{border:0;border-radius:18px;padding:0;width:min(440px,94vw);box-shadow:0 24px 60px rgba(41,41,44,.25)}
  .mpc-dlg::backdrop{background:rgba(37,37,40,.35)}
  .mpc{display:flex;flex-direction:column;max-height:86vh}
  .mpc-h{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:16px 18px 6px}.mpc-h b{display:block;font-size:17px}.mpc-h small{display:block;color:#777;font-size:12.5px;margin-top:2px}
  .mpc-x{border:0;background:#f3f3f4;border-radius:8px;width:32px;height:32px;cursor:pointer}
  .mpc-tip{margin:0 18px 10px;font-size:12.5px;color:#666}
  .mpc-body{overflow:auto;flex:1;padding:0 12px}
  .mpc-sec{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#777;margin:10px 6px 6px}.mpc-sec span{background:#f0f0f1;border-radius:999px;padding:1px 8px;margin-left:4px}
  .mpc-av{display:flex;flex-wrap:wrap;gap:6px;padding:0 6px}.mpc-av button{border:1px dashed #cfcfd3;background:#fff;border-radius:999px;padding:5px 11px;font:inherit;font-size:12.5px;cursor:pointer}.mpc-av button:hover{border-color:var(--primary,#dc3737);color:var(--primary,#dc3737)}
  .mpc-none{color:#888;font-size:12.5px}
  .mpc-l{list-style:none;margin:0;padding:0}
  .mpc-l li{display:flex;align-items:center;gap:10px;padding:7px 10px;margin:4px 0;border:1px solid #e6e6e8;border-radius:12px;background:#fff;user-select:none}
  .mpc-l li.drag{border-color:var(--primary,#dc3737);box-shadow:0 8px 20px rgba(220,55,55,.18)}
  .mpc-g{cursor:grab;touch-action:none;color:#a6a6a9;font-size:18px;line-height:1;padding:4px 2px}.mpc-n{flex:1;font-size:13.5px}
  .mpc-b{display:flex;gap:4px}.mpc-b button{border:1px solid #e6e6e8;background:#fff;border-radius:7px;width:28px;height:28px;cursor:pointer}.mpc-b button:disabled{opacity:.35;cursor:default}.mpc-b .rm{color:#dc3737;font-weight:800}
  .mpc-f{display:flex;gap:8px;align-items:center;padding:12px 18px;border-top:1px solid #eee}.mpc-f span{flex:1}
  @media print{.mpcf-b,.mpcf-bar{display:none!important}}
  </style>`);
})();
