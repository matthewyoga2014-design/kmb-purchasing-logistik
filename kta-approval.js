/* Simpan & Persetujuan perubahan untuk web Monitoring Manpower.
 * - Editor (saat persetujuan NYALA di Pengaturan): perubahan masuk draf dulu, lalu "Ajukan simpan" ke Pemilik/PIC.
 *   Draf tersimpan otomatis di server; kalau ditinggal lebih dari X menit, server mengirimnya sebagai laporan otomatis.
 * - Pemilik & PIC: perubahan langsung tersimpan seperti biasa dan tercatat di Riwayat.
 * - Riwayat harian (nilai lama -> baru) bisa dikembalikan, salinan lengkap harian bisa dipulihkan, semua bisa diunduh Excel.
 * Pemakaian: <script src="../kta-approval.js"></script> setelah kode utama halaman (butuh WEB, STATE, setState, commit, webLoad).
 * Tabel & fungsi server: supabase/kta-approval.sql
 */
(function () {
  'use strict';
  if (typeof WEB === 'undefined' || typeof setState !== 'function' || typeof commit !== 'function' || !window.KTAOps) return;

  const { clone, norm, ss, same, BLN, HARI, isoDate, fmtD, wib, dayOf, jam, todayWib, addDays, COLL, STG, FIELD, fieldLabel, showVal, keyed, SKIP, diffDoc, getF, setF, findIdx, applyOps, inverse, opText, opOld, opNew } = window.KTAOps;
  const h = (s) => (typeof esc === 'function' ? esc(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const say = (m, e) => (typeof toast === 'function' ? toast(m, e) : alert(m));

  // ---------------- state ----------------
  const A = window.KTAApproval = {
    info: { enabled: false, auto_minutes: 30, approver: false, role: 'viewer', pending: null },
    base: null, baseVer: null, ops: [], mine: [], savedAt: null, dirtyT: null, putting: false,
    _suppress: false, _action: null, _note: null,
    diff: diffDoc, apply: applyOps,
  };
  const token = () => (typeof SHARE_KEY !== 'undefined' && SHARE_KEY && typeof GUEST_ROLE !== 'undefined' && GUEST_ROLE === 'editor') ? SHARE_KEY : null;
  const sb = () => WEB.sb;
  A.mode = function () {
    if (!CAN_EDIT || !WEB.sb) return 'none';
    if (!A.info.enabled) return 'direct';
    if (A.info.approver) return 'direct';
    return 'draft';
  };
  A.isApprover = () => !!A.info.approver;

  async function loadInfo() {
    if (!WEB.sb) return;
    const r = await sb().rpc('kta_approval_info', { p_state: WEB_ID, p_token: token() });
    if (!r.error && r.data) A.info = r.data;
  }
  async function loadMine() {
    if (!WEB.sb || !CAN_EDIT || A.info.approver) { A.mine = []; return; }
    const r = await sb().rpc('kta_cr_mine', { p_state: WEB_ID, p_token: token() });
    A.mine = r.error ? [] : (r.data || []);
  }
  async function loadDraft() {
    A.ops = []; A.savedAt = null;
    if (A.mode() !== 'draft') return;
    const r = await sb().rpc('kta_draft_get', { p_state: WEB_ID, p_token: token() });
    if (!r.error && r.data && Array.isArray(r.data.ops) && r.data.ops.length) {
      A.ops = r.data.ops; A.savedAt = r.data.updated_at;
      say(`Draf Anda (${A.ops.length} perubahan) dimuat. Klik Ajukan simpan bila sudah selesai.`);
    }
  }
  A.refresh = async function () {
    try { await loadInfo(); await loadMine(); await loadDraft(); } catch (e) { /* tidak boleh mengganggu web */ }
    if (A.base) viewFromBase(); else if (typeof STATE !== 'undefined') { A.base = clone(STATE); A.baseVer = WEB.ver; }
    ui();
  };

  // setState dibungkus: data dari server = data resmi (base); editor melihat base + drafnya
  const _setState = setState;
  let bypass = false;
  function viewFromBase() {
    const v = clone(A.base);
    if (A.mode() === 'draft' && A.ops.length) {
      const r = applyOps(v, A.ops);
      if (r.skipped.length) { A.ops = A.ops.filter((o) => !r.skipped.includes(o)); queuePut(); }
    }
    bypass = true; try { _setState(v); } finally { bypass = false; }
  }
  setState = function (d) {
    if (bypass) return _setState(d);
    A.base = clone(d); A.baseVer = WEB.ver;
    if (A.mode() === 'draft' && A.ops.length) return viewFromBase();
    return _setState(d);
  };

  // ---------------- editor: simpan ke draf ----------------
  A.commitDraft = async function (mutate, okMsg) {
    if (SAVING) return false;
    const next = clone(STATE);
    mutate(next);
    next.positions.forEach((p, i) => { p.no = i + 1; });
    let reopen = null; try { reopen = sessionStorage.getItem('mp5-cands'); sessionStorage.removeItem('mp5-cands'); } catch (e) {}
    A.ops = diffDoc(A.base, next);
    bypass = true; try { _setState(next); } finally { bypass = false; }
    queuePut(true);
    say((okMsg ? okMsg.replace(/\.$/, '') + ' — ' : '') + 'masuk draf. Klik "Ajukan simpan" agar disetujui Pemilik.');
    if (reopen !== null && DATA.positions[+reopen] && typeof openCands === 'function') setTimeout(() => openCands(+reopen), 60);
    ui();
    return true;
  };
  function queuePut(now) {
    clearTimeout(A.dirtyT);
    A.dirtyT = setTimeout(putDraft, now ? 400 : 1500);
  }
  async function putDraft() {
    if (A.mode() !== 'draft') return;
    A.putting = true; ui();
    const r = await sb().rpc('kta_draft_put', { p_state: WEB_ID, p_base: A.baseVer, p_ops: A.ops, p_token: token() });
    A.putting = false;
    if (r.error) { say('Draf belum tersimpan ke server: ' + r.error.message, true); A.savedAt = null; }
    else A.savedAt = r.data || null;
    ui();
  }
  A.discard = async function () {
    A.ops = []; clearTimeout(A.dirtyT);
    await sb().rpc('kta_draft_put', { p_state: WEB_ID, p_base: A.baseVer, p_ops: [], p_token: token() });
    viewFromBase(); ui(); say('Perubahan dibatalkan. Data kembali ke versi yang disetujui.');
  };
  A.submit = async function (note) {
    if (!A.ops.length) { say('Belum ada perubahan untuk diajukan.'); return false; }
    clearTimeout(A.dirtyT);
    const r = await sb().rpc('kta_cr_submit', { p_state: WEB_ID, p_base: A.baseVer, p_ops: A.ops, p_note: note || null, p_token: token() });
    if (r.error) { say('Gagal mengajukan: ' + r.error.message, true); return false; }
    A.ops = []; A.savedAt = null;
    await loadMine();
    viewFromBase(); ui();
    say('Perubahan diajukan. Data berubah setelah disetujui Pemilik/PIC.');
    return true;
  };

  // ---------------- pemilik/PIC: catat riwayat setiap simpan langsung ----------------
  A.afterDirect = function (prev, next) {
    setTimeout(ui, 0);
    if (A._suppress || !WEB.sb) return;
    const ops = diffDoc(prev, next);
    if (!ops.length) return;
    const action = A._action || 'simpan', note = A._note || null;
    sb().rpc('kta_hist_add', { p_state: WEB_ID, p_action: action, p_ops: ops, p_note: note, p_token: token() }).then(() => {}, () => {});
  };

  // ---------------- tampilan: tombol Simpan di header ----------------
  const ICON_SAVE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>';
  const STYLE = `
  .kta-sv{display:flex;align-items:center;gap:10px;flex-shrink:0}
  .kta-st{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;border-radius:99px;padding:5px 12px;white-space:nowrap}
  .kta-st i{width:8px;height:8px;border-radius:99px;background:currentColor}
  .kta-st.ok{color:var(--ink-2,#4B4868);background:transparent;font-weight:600}.kta-st.ok i{background:var(--good,#15803D)}
  .kta-st.dirty{color:#9A3412;background:#FFF7ED;border:1px solid #FED7AA}.kta-st.dirty i{background:#EA580C}
  .kta-st.wait{color:#1E40AF;background:var(--info-soft,#DBEAFE)}
  .kta-split{display:flex;border-radius:12px;overflow:hidden;position:relative}
  .kta-split>button{border:0;font:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center}
  .kta-main{gap:9px;padding:0 18px;height:44px;font-size:14.5px;font-weight:800;background:var(--primary,#6D28D9);color:#fff}
  .kta-caret{width:40px;height:44px;background:#5B21B6;color:#fff;border-left:1px solid #8B5CF6 !important}
  .kta-split.quiet .kta-main{background:#F5F3FF;color:#5B21B6}.kta-split.quiet .kta-caret{background:#EDE9FE;color:#5B21B6;border-left:1px solid #DDD6FE !important}
  .kta-split.quiet{border:1px solid #DDD6FE}
  .kta-menu{position:absolute;right:0;top:50px;min-width:270px;background:#fff;border:1px solid var(--line,#E8E6F3);border-radius:12px;padding:6px;box-shadow:0 12px 30px rgba(30,27,58,.14);z-index:60;display:flex;flex-direction:column}
  .kta-menu button{all:unset;cursor:pointer;padding:10px 12px;border-radius:8px;font-size:13.5px;font-weight:600;color:var(--ink,#1E1B3A);display:flex;justify-content:space-between;gap:10px}
  .kta-menu button:hover,.kta-menu button:focus-visible{background:#F5F3FF}
  .kta-menu button.danger{color:#B91C1C}
  .kta-menu .ct{font-size:11px;font-weight:800;border-radius:99px;padding:1px 8px;background:#FEE2E2;color:#B91C1C}
  .kta-banner{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:11px 16px;color:#1E3A8A;font-size:13px;margin:0 0 16px}
  .kta-banner.or{background:#FFF7ED;border-color:#FED7AA;color:#9A3412}
  .kta-banner b{font-weight:800}.kta-banner span{flex:1;min-width:220px}
  .kta-banner button{all:unset;cursor:pointer;font-weight:800;color:inherit;text-decoration:underline}
  tr.kta-chg>td{background:#FFF7ED !important;box-shadow:inset 0 1px 0 #FDBA74,inset 0 -1px 0 #FDBA74}
  tr.kta-chg>td:first-child{box-shadow:inset 3px 0 0 #EA580C,inset 0 1px 0 #FDBA74,inset 0 -1px 0 #FDBA74}
  #ktaP{position:fixed;inset:0;z-index:90;background:rgba(30,27,58,.5);display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow:auto}
  #ktaP[hidden]{display:none}
  #ktaP .pn{width:min(1100px,100%);background:var(--bg,#F2F1FA);border-radius:18px;box-shadow:0 30px 70px rgba(30,27,58,.3);overflow:hidden}
  #ktaP .ph{display:flex;align-items:center;gap:12px;background:#fff;border-bottom:1px solid var(--line,#E8E6F3);padding:14px 18px}
  #ktaP .ph h2{margin:0;font-size:18px;flex:1}
  #ktaP .tabs{display:flex;gap:6px;flex-wrap:wrap;padding:12px 18px 0}
  #ktaP .tabs button{border:1px solid var(--line,#E8E6F3);background:#fff;border-radius:99px;padding:7px 14px;font:inherit;font-weight:700;font-size:13px;color:var(--ink-2,#4B4868);cursor:pointer}
  #ktaP .tabs button[aria-pressed=true]{background:#EFE9FE;border-color:#DDD0FA;color:#5B21B6}
  #ktaP .pb{padding:16px 18px 22px;display:flex;flex-direction:column;gap:14px}
  #ktaP .cd{background:#fff;border:1px solid var(--line,#E8E6F3);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
  #ktaP .cd.or{border:1.5px solid #FDBA74}
  #ktaP .row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  #ktaP .who{flex:1;min-width:200px;display:flex;flex-direction:column}
  #ktaP .who small{color:var(--muted,#8A87A6);font-size:12px}
  #ktaP .tag{font-size:11.5px;font-weight:800;border-radius:99px;padding:3px 10px;white-space:nowrap}
  #ktaP .t-blue{background:#DBEAFE;color:#1E40AF}#ktaP .t-or{background:#FFEDD5;color:#9A3412}#ktaP .t-green{background:#DCFCE7;color:#166534}#ktaP .t-red{background:#FEE2E2;color:#991B1B}#ktaP .t-gray{background:#F2F1FA;color:#4B4868}
  #ktaP table{width:100%;border-collapse:collapse;font-size:13px}
  #ktaP th{background:#F7F6FD;text-align:left;font-size:12px;color:var(--ink-2,#4B4868);padding:8px 10px;border-bottom:1px solid var(--line,#E8E6F3);white-space:nowrap}
  #ktaP td{padding:8px 10px;border-bottom:1px solid #EFEDF7;vertical-align:top}
  #ktaP td s{color:var(--muted,#8A87A6)} #ktaP td.nw{white-space:nowrap}
  #ktaP .wrap{overflow:auto;border:1px solid #EFEDF7;border-radius:10px;background:#fff}
  #ktaP .warn{color:#B45309;font-size:11.5px;font-weight:700}
  #ktaP .days{display:flex;gap:6px;overflow:auto}
  #ktaP .days button{flex:1 0 108px;border:1px solid var(--line,#E8E6F3);background:#fff;border-radius:12px;padding:8px;font:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px}
  #ktaP .days button small{font-size:11.5px;color:var(--muted,#8A87A6)} #ktaP .days button b{font-size:13px}
  #ktaP .days button[aria-pressed=true]{border:2px solid #6D28D9;background:#EFE9FE}
  #ktaP .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
  #ktaP .kpi{background:#fff;border:1px solid var(--line,#E8E6F3);border-radius:12px;padding:10px 14px;display:flex;flex-direction:column}
  #ktaP .kpi span{font-size:12px;font-weight:600;color:var(--ink-2,#4B4868)} #ktaP .kpi b{font-size:22px}
  #ktaP .fld{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700}
  #ktaP .fld input,#ktaP .fld select,#ktaP textarea{font:inherit;font-weight:500;border:1px solid var(--line,#E8E6F3);border-radius:10px;padding:9px 12px;background:#fff}
  #ktaP .grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
  #ktaP .lk{display:flex;gap:8px;flex-wrap:wrap} #ktaP .lk a{border:1px solid #DDD6FE;background:#F5F3FF;border-radius:10px;padding:8px 12px;font-size:13px;font-weight:700;color:#5B21B6;text-decoration:none}
  #ktaP .empty{color:var(--muted,#8A87A6);font-size:13px;padding:14px;text-align:center}
  #ktaLeave{position:fixed;inset:0;z-index:95;background:rgba(30,27,58,.55);display:flex;align-items:center;justify-content:center;padding:16px}
  #ktaLeave[hidden]{display:none}
  #ktaLeave .bx{width:min(560px,100%);background:#fff;border-radius:20px;padding:24px;display:flex;flex-direction:column;gap:16px}
  #ktaLeave h2{margin:0;font-size:19px}
  #ktaLeave .ls{border:1px solid var(--line,#E8E6F3);border-radius:12px;max-height:200px;overflow:auto;font-size:13px}
  #ktaLeave .ls div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:8px 12px;border-bottom:1px solid #EFEDF7}
  #ktaLeave .b3{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  #ktaLeave .bigb{height:48px;font-size:15px;font-weight:800}
  @media (max-width:720px){.kta-st{display:none}.kta-main span{display:none}.kta-main{padding:0 14px}}
  @media print{.kta-sv,.kta-banner,#ktaP,#ktaLeave{display:none !important}}
  `;
  document.head.insertAdjacentHTML('beforeend', '<style id="ktaCss">' + STYLE + '</style>');

  function ui() {
    const top = document.querySelector('header.top');
    if (!top) return;
    let box = document.getElementById('ktaSv');
    const m = A.mode();
    if (m === 'none') { if (box) box.remove(); banner(); return; }
    if (!box) {
      const rt = document.getElementById('roleTag');
      (rt || top.lastElementChild).insertAdjacentHTML('afterend', `<div class="kta-sv" id="ktaSv"><span class="kta-st" id="ktaSt"></span><div class="kta-split" id="ktaSplit"><button type="button" class="kta-main" id="ktaMain">${ICON_SAVE}<span id="ktaMainT">Simpan</span></button><button type="button" class="kta-caret" id="ktaCaret" aria-label="Pilihan simpan lainnya" aria-haspopup="true" aria-expanded="false"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></div>`);
      box = document.getElementById('ktaSv');
    }
    const st = document.getElementById('ktaSt'), sp = document.getElementById('ktaSplit'), mt = document.getElementById('ktaMainT');
    const n = A.ops.length, pend = A.mine.filter((r) => r.status === 'pending').length;
    if (m === 'draft') {
      mt.textContent = 'Ajukan simpan';
      sp.classList.toggle('quiet', !n);
      if (n) { st.className = 'kta-st dirty'; st.innerHTML = `<i></i>${n} perubahan belum disimpan${A.putting ? ' · menyimpan draf…' : A.savedAt ? ' · draf ' + jam(A.savedAt) : ''}`; }
      else if (pend) { st.className = 'kta-st wait'; st.innerHTML = `<i></i>${pend} usulan menunggu persetujuan`; }
      else { st.className = 'kta-st ok'; st.innerHTML = '<i></i>Tidak ada perubahan'; }
    } else {
      mt.textContent = 'Simpan';
      sp.classList.add('quiet');
      const p = A.info.pending || 0;
      if (A.info.approver && A.info.enabled && p) { st.className = 'kta-st wait'; st.innerHTML = `<i></i>${p} usulan menunggu persetujuan`; }
      else { st.className = 'kta-st ok'; st.innerHTML = '<i></i>Tersimpan' + (WEB.ver ? ' · ' + jam(WEB.ver) : ''); }
    }
    banner(); decorate();
  }
  A.ui = ui;

  function banner() {
    const v = document.getElementById('view'); if (!v) return;
    let b = document.getElementById('ktaBanner');
    const m = A.mode(), pend = A.mine.filter((r) => r.status === 'pending').length;
    let html = '';
    if (m === 'draft' && A.ops.length) html = `<div class="kta-banner or" id="ktaBanner"><span><b>${A.ops.length} perubahan Anda belum diajukan.</b> Baris berwarna oranye adalah yang Anda ubah. Draf tersimpan otomatis; kalau tidak diajukan dalam ${A.info.auto_minutes} menit setelah aktivitas terakhir, draf dikirim otomatis ke Pemilik sebagai laporan.</span><button type="button" data-kta="submit">Ajukan simpan</button></div>`;
    else if (m === 'draft' && pend) html = `<div class="kta-banner" id="ktaBanner"><span><b>${pend} usulan Anda masih menunggu persetujuan.</b> Data yang tampil adalah versi terakhir yang sudah disetujui.</span><button type="button" data-kta="mine">Lihat usulan saya</button></div>`;
    else if (A.info.approver && A.info.enabled && A.info.pending) html = `<div class="kta-banner" id="ktaBanner"><span><b>${A.info.pending} usulan perubahan menunggu persetujuan Anda.</b></span><button type="button" data-kta="approve">Buka persetujuan</button></div>`;
    if (!html) { if (b) b.remove(); return; }
    if (b) b.outerHTML = html; else v.insertAdjacentHTML('afterbegin', html);
  }
  // baris yang diubah editor diberi warna oranye
  function decorate() {
    document.querySelectorAll('tr.kta-chg').forEach((t) => t.classList.remove('kta-chg'));
    if (A.mode() !== 'draft' || !A.ops.length || typeof DATA === 'undefined') return;
    const ks = new Set(A.ops.filter((o) => o.c === 'positions').map((o) => o.k));
    keyed(DATA.positions, 'positions').forEach(([k], i) => {
      if (!ks.has(k)) return;
      document.querySelectorAll(`[data-epos="${i}"]`).forEach((b) => { const tr = b.closest('tr'); if (tr) { tr.classList.add('kta-chg'); tr.title = 'Diubah, belum diajukan'; } });
    });
  }
  const _render = typeof render === 'function' ? render : null;
  if (_render) render = function () { const r = _render.apply(this, arguments); try { banner(); decorate(); } catch (e) {} return r; };

  // menu & tombol
  document.addEventListener('click', (e) => {
    const t = e.target;
    const menu = document.getElementById('ktaMenu');
    if (menu && !t.closest('#ktaMenu') && !t.closest('#ktaCaret')) closeMenu();
    if (t.closest('#ktaMain')) { e.preventDefault(); if (A.mode() === 'draft') openLeave(false); else say('Semua perubahan Anda sudah tersimpan.'); return; }
    if (t.closest('#ktaCaret')) { e.preventDefault(); menu ? closeMenu() : openMenu(); return; }
    const k = t.closest('[data-kta]');
    if (!k) return;
    e.preventDefault(); closeMenu();
    const a = k.getAttribute('data-kta');
    if (a === 'submit') openLeave(false);
    else if (a === 'discard') { if (confirm('Buang semua perubahan yang belum diajukan?')) A.discard(); }
    else if (a === 'mine') openPanel('mine');
    else if (a === 'approve') openPanel('approve');
    else if (a === 'history') openPanel('history');
    else if (a === 'settings') openPanel('settings');
    else if (a === 'xlsx') A.exportExcel(DATA);
  });
  function openMenu() {
    const sp = document.getElementById('ktaSplit'); if (!sp) return;
    const m = A.mode(), items = [];
    if (m === 'draft') {
      items.push(`<button type="button" data-kta="submit">Ajukan simpan${A.ops.length ? ` <span class="ct" style="background:#FFEDD5;color:#9A3412">${A.ops.length}</span>` : ''}</button>`);
      items.push(`<button type="button" data-kta="mine">Usulan saya${A.mine.filter((r) => r.status === 'pending').length ? ` <span class="ct" style="background:#DBEAFE;color:#1E40AF">${A.mine.filter((r) => r.status === 'pending').length}</span>` : ''}</button>`);
      if (A.ops.length) items.push('<button type="button" data-kta="discard" class="danger">Batalkan semua perubahan</button>');
    } else {
      if (A.info.approver) items.push(`<button type="button" data-kta="approve">Menunggu persetujuan${A.info.pending ? ` <span class="ct">${A.info.pending}</span>` : ''}</button>`);
      if (A.info.approver) items.push('<button type="button" data-kta="history">Riwayat perubahan harian</button>');
    }
    items.push('<button type="button" data-kta="xlsx">Unduh Excel (format web)</button>');
    if (typeof IS_OWNER !== 'undefined' && IS_OWNER) items.push('<button type="button" data-kta="settings">Pengaturan simpan & persetujuan</button>');
    sp.insertAdjacentHTML('beforeend', `<div class="kta-menu" id="ktaMenu" role="menu">${items.join('')}</div>`);
    document.getElementById('ktaCaret').setAttribute('aria-expanded', 'true');
  }
  function closeMenu() { const m = document.getElementById('ktaMenu'); if (m) m.remove(); const c = document.getElementById('ktaCaret'); if (c) c.setAttribute('aria-expanded', 'false'); }
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S') && A.mode() !== 'none') { e.preventDefault(); if (A.mode() === 'draft') openLeave(false); else say('Semua perubahan Anda sudah tersimpan.'); }
    if (e.key === 'Escape') { closeMenu(); const l = document.getElementById('ktaLeave'); if (l && !l.hidden) l.hidden = true; }
  });

  // ---------------- keluar sebelum diajukan ----------------
  window.addEventListener('beforeunload', (e) => { if (A.mode() === 'draft' && A.ops.length && !A._leaving) { e.preventDefault(); e.returnValue = ''; } });
  let leaveTo = null;
  document.addEventListener('click', (e) => {
    if (A.mode() !== 'draft' || !A.ops.length) return;
    const a = e.target.closest('a.backbtn, #toPortal, #authBtn');
    if (!a) return;
    e.preventDefault(); e.stopImmediatePropagation();
    leaveTo = a.tagName === 'A' ? () => { A._leaving = true; location.href = a.href; } : () => { A._leaving = true; a.click(); };
    openLeave(true);
  }, true);
  function openLeave(leaving) {
    if (!leaving) leaveTo = null;
    if (!A.ops.length) { say('Belum ada perubahan untuk diajukan.'); return; }
    let el = document.getElementById('ktaLeave');
    if (!el) { document.body.insertAdjacentHTML('beforeend', '<div id="ktaLeave" hidden role="dialog" aria-modal="true" aria-labelledby="ktaLT"><div class="bx"></div></div>'); el = document.getElementById('ktaLeave'); }
    const rows = A.ops.slice(0, 60).map((o) => `<div><span><b>${h(o.l)}</b> · ${h(opText(o))}</span><span><s>${h(opOld(o))}</s> → <b style="color:#9A3412">${h(opNew(o))}</b></span></div>`).join('') + (A.ops.length > 60 ? `<div><span>… dan ${A.ops.length - 60} perubahan lain</span><span></span></div>` : '');
    el.querySelector('.bx').innerHTML = `
      <h2 id="ktaLT">${leaving ? `Ada ${A.ops.length} perubahan yang belum disimpan` : `Ajukan ${A.ops.length} perubahan`}</h2>
      <p style="margin:-6px 0 0;color:var(--ink-2,#4B4868);font-size:14px">${leaving ? 'Pilih dulu sebelum keluar dari halaman ini.' : 'Perubahan akan dikirim ke Pemilik/PIC untuk disetujui.'}</p>
      <div class="ls">${rows}</div>
      <label class="fld" style="display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700">Catatan untuk Pemilik (opsional)<input type="text" id="ktaNote" maxlength="300" placeholder="Contoh: sesuai OL tanggal 14 Nov" style="font:inherit;font-weight:500;border:1px solid var(--line,#E8E6F3);border-radius:10px;padding:10px 12px"></label>
      <button type="button" class="btn btn-p bigb" id="ktaGo">${ICON_SAVE} ${leaving ? 'Ajukan simpan, lalu keluar' : 'Ajukan simpan'}</button>
      <div class="b3">${leaving ? '<button type="button" class="btn btn-g" id="ktaDrop" style="color:#B91C1C;border-color:#FECACA">Buang perubahan</button>' : '<button type="button" class="btn btn-g" id="ktaDrop" style="color:#B91C1C;border-color:#FECACA">Batalkan semua perubahan</button>'}<button type="button" class="btn btn-g" id="ktaStay">${leaving ? 'Batal, tetap di sini' : 'Nanti dulu'}</button></div>
      <p style="margin:0;font-size:12.5px;color:var(--ink-2,#4B4868);background:#F7F6FD;border-radius:10px;padding:10px 12px">Kalau tab ditutup paksa atau sinyal putus, draf tetap tersimpan dan otomatis dikirim ke Pemilik sebagai laporan setelah ${A.info.auto_minutes} menit.</p>`;
    el.hidden = false;
    setTimeout(() => { const n = document.getElementById('ktaNote'); if (n) n.focus(); }, 30);
    document.getElementById('ktaGo').onclick = async () => { const ok = await A.submit(document.getElementById('ktaNote').value); if (ok) { el.hidden = true; if (leaveTo) leaveTo(); } };
    document.getElementById('ktaDrop').onclick = async () => { if (!confirm('Buang semua perubahan yang belum diajukan?')) return; await A.discard(); el.hidden = true; if (leaveTo) leaveTo(); };
    document.getElementById('ktaStay').onclick = () => { el.hidden = true; leaveTo = null; };
  }

  // ---------------- panel: persetujuan · riwayat · usulan saya · pengaturan ----------------
  const P = { tab: 'approve', day: null, reqs: [], hist: [], days: {}, settings: null, approvers: [], editors: [] };
  function panelEl() {
    let el = document.getElementById('ktaP');
    if (!el) {
      document.body.insertAdjacentHTML('beforeend', '<div id="ktaP" hidden role="dialog" aria-modal="true" aria-labelledby="ktaPT"><div class="pn"><div class="ph"><h2 id="ktaPT">Perubahan & Persetujuan</h2><button type="button" class="btn btn-g" id="ktaPX">Tutup</button></div><div class="tabs" id="ktaTabs"></div><div class="pb" id="ktaPB"></div></div></div>');
      el = document.getElementById('ktaP');
      el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('#ktaPX')) closePanel(); });
      el.addEventListener('click', onPanelClick);
      el.addEventListener('change', onPanelChange);
    }
    return el;
  }
  function closePanel() { const el = document.getElementById('ktaP'); if (el) el.hidden = true; document.body.style.overflow = ''; }
  async function openPanel(tab) {
    P.tab = tab; const el = panelEl(); el.hidden = false; document.body.style.overflow = 'hidden';
    await drawPanel();
  }
  A.openPanel = openPanel;
  function tabs() {
    const t = [];
    if (A.info.approver) { t.push(['approve', 'Menunggu persetujuan' + (A.info.pending ? ` (${A.info.pending})` : '')]); t.push(['history', 'Riwayat harian']); }
    if (A.mode() === 'draft') t.push(['mine', 'Usulan saya']);
    if (typeof IS_OWNER !== 'undefined' && IS_OWNER) t.push(['settings', 'Pengaturan']);
    if (!t.some((x) => x[0] === P.tab)) P.tab = t.length ? t[0][0] : 'mine';
    document.getElementById('ktaTabs').innerHTML = t.map(([k, l]) => `<button type="button" data-ktab="${k}" aria-pressed="${P.tab === k}">${h(l)}</button>`).join('');
  }
  async function drawPanel() {
    tabs();
    const b = document.getElementById('ktaPB');
    b.innerHTML = '<div class="empty">Memuat…</div>';
    try {
      if (P.tab === 'approve') b.innerHTML = await viewApprove();
      else if (P.tab === 'history') b.innerHTML = await viewHistory();
      else if (P.tab === 'mine') b.innerHTML = await viewMine();
      else if (P.tab === 'settings') b.innerHTML = await viewSettings();
    } catch (e) { b.innerHTML = `<div class="empty">Gagal memuat: ${h(e.message || e)}</div>`; }
  }
  function opRows(ops, opt) {
    opt = opt || {};
    return `<div class="wrap"><table><thead><tr>${opt.check ? '<th></th>' : ''}${opt.time ? '<th>Jam</th><th>Siapa</th>' : ''}<th>Data</th><th>Kolom</th><th>Lama</th><th>Baru</th>${opt.status ? '<th>Status</th>' : ''}${opt.act ? '<th></th>' : ''}</tr></thead><tbody>${ops.map((o, i) => `<tr>${opt.check ? `<td><input type="checkbox" checked data-op="${i}" aria-label="Setujui perubahan ini"></td>` : ''}${opt.time ? `<td class="nw">${h(o._t || '')}</td><td>${h(o._who || '')}</td>` : ''}<td><b>${h(o.l)}</b><br><small style="color:var(--muted,#8A87A6)">${h(COLL[o.c] ? COLL[o.c].name : o.c)}</small>${o._conf ? `<div class="warn">Sudah berubah sejak diajukan (sekarang: ${h(o._conf)})</div>` : ''}</td><td>${h(opText(o))}</td><td><s>${h(opOld(o))}</s></td><td><b>${h(opNew(o))}</b></td>${opt.status ? `<td>${o._st || ''}</td>` : ''}${opt.act ? `<td class="nw">${o._act || ''}</td>` : ''}</tr>`).join('') || `<tr><td colspan="9" class="empty">Tidak ada perubahan.</td></tr>`}</tbody></table></div>`;
  }
  function conflictsOf(ops) {
    return ops.map((o) => {
      const x = Object.assign({}, o);
      if (!o.op && typeof DATA !== 'undefined') {
        const i = findIdx(A.base || DATA, o.c, o.k);
        const cur = i >= 0 ? getF((A.base || DATA)[o.c][i], o.f) : undefined;
        if (i < 0) x._conf = 'data sudah tidak ada';
        else if (!same(cur, o.o) && !same(cur, o.n)) x._conf = showVal(cur, o.f);
      }
      return x;
    });
  }
  const kindTag = (r) => r.kind === 'otomatis' ? '<span class="tag t-or">Laporan otomatis · lupa simpan</span>' : '<span class="tag t-blue">Diajukan editor</span>';
  const stTag = (s) => ({ pending: '<span class="tag t-blue">Menunggu</span>', approved: '<span class="tag t-green">Disetujui</span>', partial: '<span class="tag t-green">Disetujui sebagian</span>', rejected: '<span class="tag t-red">Ditolak</span>', cancelled: '<span class="tag t-gray">Dibatalkan</span>' }[s] || s);
  const tglJam = (t) => { const d = dayOf(t); return (d === todayWib() ? 'Hari ini' : d === addDays(todayWib(), -1) ? 'Kemarin' : fmtD(d)) + ' ' + jam(t); };

  async function viewApprove() {
    const r = await sb().from('kta_change_requests').select('*').eq('state_id', WEB_ID).eq('status', 'pending').order('created_at', { ascending: true });
    if (r.error) throw r.error;
    P.reqs = r.data || [];
    A.info.pending = P.reqs.length; ui();
    const off = !A.info.enabled ? `<div class="kta-banner or" style="margin:0"><span><b>Persetujuan sedang MATI.</b> Editor masih menyimpan langsung. Nyalakan di tab Pengaturan bila sudah siap.</span></div>` : '';
    if (!P.reqs.length) return off + '<div class="cd"><div class="empty">Tidak ada usulan yang menunggu persetujuan.</div></div>';
    return off + `<div class="row"><span style="flex:1;font-size:13px;color:var(--ink-2,#4B4868)">Data utama baru berubah setelah Anda klik Setujui. Perubahan yang bertanda kuning sudah diubah orang lain sejak diajukan.</span></div>` +
      P.reqs.map((q, qi) => `<div class="cd ${q.kind === 'otomatis' ? 'or' : ''}" data-req="${qi}">
        <div class="row"><div class="who"><b>${h(q.actor_label || q.actor)}</b><small>${q.kind === 'otomatis' ? `Terakhir mengubah ${tglJam(q.last_activity || q.created_at)} · dilaporkan otomatis ${tglJam(q.created_at)}` : `Diajukan ${tglJam(q.created_at)}`} · ${q.ops.length} perubahan</small></div>${kindTag(q)}</div>
        ${q.note ? `<div style="font-size:13px;background:#F7F6FD;border-radius:10px;padding:8px 12px">Catatan: “${h(q.note)}”</div>` : ''}
        ${opRows(conflictsOf(q.ops), { check: true })}
        <div class="row" style="justify-content:flex-end"><input type="text" placeholder="Catatan keputusan (opsional)" data-rnote="${qi}" style="flex:1;min-width:200px;font:inherit;border:1px solid var(--line,#E8E6F3);border-radius:10px;padding:8px 12px"><button type="button" class="btn btn-g" data-rej="${qi}" style="color:#B91C1C;border-color:#FECACA">Tolak semua</button><button type="button" class="btn btn-p" data-acc="${qi}" style="background:#15803D;border-color:#15803D">Setujui yang dicentang</button></div>
      </div>`).join('');
  }
  async function decide(qi, approve) {
    const q = P.reqs[qi]; if (!q) return;
    const card = document.querySelector(`[data-req="${qi}"]`);
    const note = (card.querySelector(`[data-rnote="${qi}"]`) || {}).value || null;
    const picked = new Set([...card.querySelectorAll('[data-op]')].filter((x) => x.checked).map((x) => +x.getAttribute('data-op')));
    const sel = approve ? q.ops.filter((_, i) => picked.has(i)) : [];
    const rej = q.ops.filter((o) => !sel.includes(o));
    if (approve && !sel.length) { say('Centang dulu perubahan yang mau disetujui.'); return; }
    if (!approve && !confirm(`Tolak semua ${q.ops.length} perubahan dari ${q.actor_label || q.actor}?`)) return;
    card.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    if (sel.length) {
      A._suppress = true;
      let ok = false;
      try { ok = await commit((next) => { applyOps(next, sel); }, `Usulan ${q.actor_label || ''} disetujui.`); } finally { A._suppress = false; }
      if (!ok) { card.querySelectorAll('button').forEach((b) => { b.disabled = false; }); return; }
    }
    const r = await sb().rpc('kta_cr_decide', { p_id: q.id, p_status: !sel.length ? 'rejected' : rej.length ? 'partial' : 'approved', p_applied: sel, p_rejected: rej, p_note: note });
    if (r.error) say('Data tersimpan, tetapi status usulan gagal diperbarui: ' + r.error.message, true);
    else if (!sel.length) say('Usulan ditolak. Data tidak berubah.');
    await loadInfo(); ui(); drawPanel();
  }

  async function viewMine() {
    await loadMine();
    if (!A.mine.length && !A.ops.length) return '<div class="cd"><div class="empty">Belum ada usulan dalam 30 hari terakhir.</div></div>';
    const draft = A.ops.length ? `<div class="cd or"><div class="row"><div class="who"><b>Draf (belum diajukan)</b><small>${A.ops.length} perubahan${A.savedAt ? ' · tersimpan ' + tglJam(A.savedAt) : ''}</small></div><button type="button" class="btn btn-p" data-kta="submit">Ajukan simpan</button></div>${opRows(A.ops)}</div>` : '';
    return draft + A.mine.map((q) => `<div class="cd"><div class="row"><div class="who"><b>${q.kind === 'otomatis' ? 'Laporan otomatis (lupa simpan)' : 'Diajukan'} ${tglJam(q.created_at)}</b><small>${q.ops.length} perubahan${q.decided_at && q.status !== 'pending' ? ` · diputuskan ${tglJam(q.decided_at)}${q.decided_note ? ' · “' + h(q.decided_note) + '”' : ''}` : ''}</small></div>${stTag(q.status)}${q.status === 'pending' ? `<button type="button" class="btn btn-g" data-cancel="${h(q.id)}">Batalkan</button>` : ''}</div>${opRows(q.ops)}</div>`).join('');
  }

  // riwayat harian
  async function loadDays() {
    const from = addDays(todayWib(), -6);
    const since = new Date(Date.parse(from + 'T00:00:00Z') - 7 * 3600e3).toISOString();
    const [hq, rq] = await Promise.all([
      sb().from('kta_change_history').select('at,ops').eq('state_id', WEB_ID).gte('at', since),
      sb().from('kta_change_requests').select('created_at,ops,status').eq('state_id', WEB_ID).gte('created_at', since),
    ]);
    const days = {};
    for (let i = 0; i < 7; i++) days[addDays(from, i)] = 0;
    (hq.data || []).forEach((x) => { const d = dayOf(x.at); if (d in days) days[d] += (x.ops || []).length; });
    (rq.data || []).filter((x) => x.status === 'pending').forEach((x) => { const d = dayOf(x.created_at); if (d in days) days[d] += (x.ops || []).length; });
    P.days = days;
  }
  async function loadDay(day) {
    const s = new Date(Date.parse(day + 'T00:00:00Z') - 7 * 3600e3).toISOString(), e = new Date(Date.parse(day + 'T00:00:00Z') + 17 * 3600e3).toISOString();
    return loadRange(s, e);
  }
  async function loadRange(s, e) {
    const [hq, rq] = await Promise.all([
      sb().from('kta_change_history').select('*').eq('state_id', WEB_ID).gte('at', s).lt('at', e).order('at', { ascending: false }),
      sb().from('kta_change_requests').select('*').eq('state_id', WEB_ID).eq('status', 'pending').gte('created_at', s).lt('created_at', e).order('created_at', { ascending: false }),
    ]);
    if (hq.error) throw hq.error;
    const lines = [];
    (rq.data || []).forEach((q) => q.ops.forEach((o) => lines.push({ ...o, _at: q.created_at, _t: jam(q.created_at), _who: (q.actor_label || q.actor) + ' · Editor', _st: q.kind === 'otomatis' ? '<span class="tag t-or">Laporan otomatis</span>' : '<span class="tag t-blue">Menunggu</span>', _status: q.kind === 'otomatis' ? 'Laporan otomatis (menunggu)' : 'Menunggu persetujuan', _by: q.actor_label, _kind: q.kind })));
    (hq.data || []).forEach((x) => {
      const roleName = { owner: 'Pemilik', pic: 'PIC', editor: 'Editor' }[x.role] || x.role || '';
      const st = { simpan: ['Disimpan', 't-green'], setujui: ['Disetujui', 't-green'], tolak: ['Ditolak', 't-red'], kembalikan: ['Dikembalikan', 't-gray'], pulihkan: ['Dipulihkan dari salinan', 't-gray'] }[x.action] || [x.action, 't-gray'];
      (x.ops || []).forEach((o, i) => lines.push({ ...o, _at: x.at, _t: jam(x.at), _who: (x.action === 'setujui' || x.action === 'tolak') ? `${x.request_actor || 'Editor'} → ${roleName} ${x.actor}` : `${x.actor} · ${roleName}`, _st: `<span class="tag ${st[1]}">${st[0]}${x.request_kind === 'otomatis' ? ' (laporan otomatis)' : ''}</span>`, _status: st[0], _by: x.request_actor || x.actor, _kind: x.request_kind || '', _note: x.note || '', _act: (x.action !== 'tolak') ? `<button type="button" class="btn btn-g" style="padding:4px 10px;font-size:12px" data-undo="${x.id}:${i}">Kembalikan</button>` : '' }));
    });
    lines.sort((a, b) => (b._at > a._at ? 1 : -1));
    P.hist = hq.data || [];
    return lines;
  }
  async function viewHistory() {
    if (!P.day) P.day = todayWib();
    await loadDays();
    const lines = await loadDay(P.day); P.lines = lines;
    const cnt = (f) => lines.filter(f).length;
    const strip = Object.keys(P.days).map((d) => { const wd = HARI[new Date(Date.parse(d + 'T00:00:00Z')).getUTCDay()]; return `<button type="button" data-day="${d}" aria-pressed="${P.day === d}"><small>${d === todayWib() ? 'Hari ini' : wd} · ${fmtD(d).replace(/ \d{4}$/, '')}</small><b>${P.days[d] ? P.days[d] + ' perubahan' : 'Tidak ada'}</b></button>`; }).join('');
    return `<div class="row"><div class="days" style="flex:1">${strip}</div><label class="fld" style="flex-direction:row;align-items:center"><span>Tanggal lain</span><input type="date" id="ktaDayPick" value="${P.day}" max="${todayWib()}"></label></div>
      <div class="kpis"><div class="kpi"><span>Total perubahan</span><b>${lines.length}</b></div><div class="kpi"><span>Disetujui / disimpan</span><b style="color:#15803D">${cnt((l) => /Disimpan|Disetujui/.test(l._status))}</b></div><div class="kpi"><span>Menunggu</span><b style="color:#1D4ED8">${cnt((l) => /Menunggu|menunggu/.test(l._status))}</b></div><div class="kpi"><span>Ditolak</span><b style="color:#B91C1C">${cnt((l) => l._status === 'Ditolak')}</b></div><div class="kpi" style="background:#FFF7ED;border-color:#FED7AA"><span style="color:#9A3412">Laporan otomatis</span><b style="color:#C2410C">${cnt((l) => l._kind === 'otomatis')}</b></div></div>
      <div class="row"><b style="flex:1">${P.day === todayWib() ? 'Hari ini' : fmtD(P.day)}</b><button type="button" class="btn btn-g" data-snap="${P.day}">Data persis per ${fmtD(P.day)} 00:00 (Excel)</button><button type="button" class="btn btn-g" data-restore="${P.day}">Pulihkan ke salinan ini…</button><button type="button" class="btn btn-p" data-hxls="day">Unduh riwayat hari ini (Excel)</button><button type="button" class="btn btn-g" data-hxls="month">Unduh riwayat 1 bulan (Excel)</button></div>
      ${opRows(lines, { time: true, status: true, act: true })}`;
  }
  async function undo(hid, idx) {
    const x = P.hist.find((r) => String(r.id) === String(hid)); if (!x) return;
    const op = x.ops[idx]; if (!op) return;
    const inv = inverse([op]);
    if (!confirm(`Kembalikan "${op.l} · ${opText(op)}" ke nilai sebelumnya (${opOld(op)})?`)) return;
    A._action = 'kembalikan'; A._note = `Mengembalikan perubahan ${tglJam(x.at)} oleh ${x.request_actor || x.actor}`;
    try { await commit((next) => { applyOps(next, inv); }, 'Perubahan dikembalikan.'); } finally { A._action = null; A._note = null; }
    drawPanel();
  }
  async function snapshot(day) {
    const r = await sb().from('kta_state_snapshots').select('data,data_updated_at,taken_at').eq('state_id', WEB_ID).lte('day', day).order('day', { ascending: false }).limit(1).maybeSingle();
    if (r.error) throw r.error;
    if (!r.data) { say('Belum ada salinan untuk tanggal itu. Salinan harian mulai dibuat sejak fitur ini dipasang.', true); return null; }
    return r.data;
  }
  async function restore(day) {
    const s = await snapshot(day); if (!s) return;
    const ops = diffDoc(A.base || DATA, s.data);
    if (!ops.length) { say('Data sekarang sudah sama dengan salinan ' + fmtD(day) + '.'); return; }
    if (!confirm(`Pulihkan data ke salinan ${fmtD(day)} (diambil ${tglJam(s.taken_at)})?\n${ops.length} perubahan akan dibatalkan. Langkah ini tercatat di riwayat dan bisa dikembalikan lagi.`)) return;
    A._action = 'pulihkan'; A._note = 'Pulihkan ke salinan ' + fmtD(day);
    try { await commit((next) => { Object.keys(COLL).forEach((c) => { next[c] = clone(s.data[c] || []); }); }, 'Data dipulihkan ke salinan ' + fmtD(day) + '.'); } finally { A._action = null; A._note = null; }
    drawPanel();
  }

  // pengaturan (Pemilik)
  const LINKS = (window.KTA_SYSTEM_LINKS || {});
  async function viewSettings() {
    const [s, ap, ed] = await Promise.all([
      sb().from('kta_approval_settings').select('*').eq('app_id', WEB_ROLE_APP).maybeSingle(),
      sb().from('kta_approvers').select('*').eq('app_id', WEB_ROLE_APP),
      sb().from('app_access_roles').select('email,role').eq('app_id', WEB_ROLE_APP),
    ]);
    if (s.error) throw s.error;
    P.settings = s.data || { app_id: WEB_ROLE_APP, enabled: false, auto_minutes: 30, recap_hour: 17, escalate_hours: 24, owner_wa: '' };
    P.approvers = ap.data || []; P.editors = (ed.data || []).filter((x) => x.role === 'editor');
    const S = P.settings, apMap = new Map(P.approvers.map((x) => [x.email.toLowerCase(), x]));
    let ver = '';
    if (LINKS.repo && LINKS.path) {
      try { const g = await fetch(`https://api.github.com/repos/${LINKS.repo}/commits?path=${encodeURIComponent(LINKS.path)}&per_page=1`); const j = await g.json(); if (Array.isArray(j) && j[0]) ver = `Update terakhir ${tglJam(j[0].commit.committer.date)} · ${h(j[0].commit.message.split('\n')[0].slice(0, 90))} · versi ${h(j[0].sha.slice(0, 7))}`; } catch (e) {}
    }
    const opt = (v, cur, l) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${l}</option>`;
    return `<div class="grid2">
      <div class="cd"><b style="font-size:15px">Simpan & persetujuan</b>
        <label class="row" style="font-size:14px;font-weight:700"><input type="checkbox" id="ktaEn" ${S.enabled ? 'checked' : ''}> Perubahan dari Editor harus disetujui Pemilik/PIC</label>
        <p style="margin:0;font-size:12.5px;color:var(--ink-2,#4B4868)">${S.enabled ? '<b style="color:#15803D">NYALA.</b> Editor hanya bisa membuat draf dan mengajukan; data utama berubah setelah disetujui.' : '<b style="color:#B45309">MATI.</b> Editor masih menyimpan langsung (riwayat tetap tercatat). Nyalakan setelah Anda mencoba alurnya.'} Link Editor tanpa login ikut aturan ini.</p>
        <label class="fld">Kalau editor lupa simpan, kirim laporan otomatis setelah<select id="ktaAuto">${[5, 10, 15, 30, 60, 120, 240].map((m) => opt(m, S.auto_minutes, m < 60 ? m + ' menit tidak ada aktivitas' : (m / 60) + ' jam tidak ada aktivitas')).join('')}</select></label>
        <label class="fld">Nomor WhatsApp Pemilik (untuk notifikasi tahap berikutnya)<input type="tel" id="ktaWa" value="${h(S.owner_wa || '')}" placeholder="08xxxxxxxxxx"></label>
        <div class="row" style="justify-content:flex-end"><button type="button" class="btn btn-p" id="ktaSaveSet">Simpan pengaturan</button></div>
      </div>
      <div class="cd"><b style="font-size:15px">PIC (boleh menyetujui usulan)</b>
        <p style="margin:0;font-size:12.5px;color:var(--ink-2,#4B4868)">Pilih Editor yang juga boleh menyetujui. Kalau tidak ada PIC, semua usulan masuk ke Pemilik. Tambah Editor baru lewat menu Akses seperti biasa.</p>
        <div class="wrap"><table><thead><tr><th>Editor</th><th>PIC?</th><th>Bagian yang dipegang (catatan)</th></tr></thead><tbody>${P.editors.map((e) => { const a = apMap.get(e.email.toLowerCase()); return `<tr><td>${h(e.email)}</td><td><input type="checkbox" data-pic="${h(e.email)}" ${a ? 'checked' : ''} aria-label="Jadikan PIC"></td><td><input type="text" data-scope="${h(e.email)}" value="${h(a && a.scope || '')}" placeholder="mis. Maintenance Section" ${a ? '' : 'disabled'} style="width:100%;font:inherit;border:1px solid var(--line,#E8E6F3);border-radius:8px;padding:6px 8px"></td></tr>`; }).join('') || '<tr><td colspan="3" class="empty">Belum ada Editor.</td></tr>'}</tbody></table></div>
      </div>
      <div class="cd"><b style="font-size:15px">Arsip & unduhan</b>
        <p style="margin:0;font-size:12.5px;color:var(--ink-2,#4B4868)">Salinan lengkap data dibuat otomatis setiap malam (00:01 WIB) dan bisa dibuka/diunduh di tab Riwayat harian. Arsip file Excel ke folder Google Drive menyusul lewat kode sinkron Drive.</p>
        <div class="lk"><a href="#" data-kta="xlsx">Unduh semua data (Excel)</a><a href="#" data-hxls="month">Unduh riwayat 1 bulan (Excel)</a>${LINKS.drive ? `<a href="${h(LINKS.drive)}" target="_blank" rel="noopener">Buka folder arsip Drive ↗</a>` : ''}</div>
      </div>
      <div class="cd"><b style="font-size:15px">Info sistem</b>
        <p style="margin:0;font-size:12.5px;color:var(--ink-2,#4B4868)">${ver || 'Kode web tersimpan di GitHub.'}</p>
        <div class="lk">${LINKS.repo ? `<a href="https://github.com/${h(LINKS.repo)}/blob/main/${h(LINKS.path)}" target="_blank" rel="noopener">Lihat kode web (GitHub) ↗</a><a href="https://github.com/${h(LINKS.repo)}/commits/main/${h(LINKS.path)}" target="_blank" rel="noopener">Riwayat perubahan kode ↗</a>` : ''}${LINKS.supabase ? `<a href="${h(LINKS.supabase)}" target="_blank" rel="noopener">Buka database (Supabase) ↗</a>` : ''}${LINKS.script ? `<a href="${h(LINKS.script)}" target="_blank" rel="noopener">Kode sinkron Drive (Apps Script) ↗</a>` : ''}</div>
      </div></div>`;
  }
  async function saveSettings() {
    const patch = { enabled: document.getElementById('ktaEn').checked, auto_minutes: +document.getElementById('ktaAuto').value, owner_wa: document.getElementById('ktaWa').value.trim() || null, updated_at: new Date().toISOString(), updated_by: WEB.user && WEB.user.email };
    if (patch.enabled && !P.settings.enabled && !confirm('Nyalakan persetujuan? Mulai sekarang perubahan dari Editor harus Anda (atau PIC) setujui dulu.')) return;
    const r = await sb().from('kta_approval_settings').update(patch).eq('app_id', WEB_ROLE_APP).select('*');
    if (r.error || !r.data || !r.data.length) { say('Gagal menyimpan pengaturan' + (r.error ? ': ' + r.error.message : '.'), true); return; }
    const want = [...document.querySelectorAll('[data-pic]')].filter((x) => x.checked).map((x) => x.getAttribute('data-pic'));
    const have = P.approvers.map((x) => x.email);
    const scopes = Object.fromEntries([...document.querySelectorAll('[data-scope]')].map((x) => [x.getAttribute('data-scope'), x.value.trim() || null]));
    const del = have.filter((e) => !want.includes(e));
    if (del.length) await sb().from('kta_approvers').delete().eq('app_id', WEB_ROLE_APP).in('email', del);
    if (want.length) { const up = await sb().from('kta_approvers').upsert(want.map((e) => ({ app_id: WEB_ROLE_APP, email: e, scope: scopes[e] || null, added_by: WEB.user && WEB.user.email })), { onConflict: 'app_id,email' }); if (up.error) say('PIC gagal disimpan: ' + up.error.message, true); }
    say('Pengaturan tersimpan.');
    await loadInfo(); ui(); drawPanel();
  }

  function onPanelChange(e) {
    const t = e.target;
    if (t.matches('[data-pic]')) { const s = document.querySelector(`[data-scope="${CSS.escape(t.getAttribute('data-pic'))}"]`); if (s) s.disabled = !t.checked; }
    if (t.id === 'ktaDayPick' && t.value) { P.day = t.value; drawPanel(); }
  }
  async function onPanelClick(e) {
    const t = e.target, g = (s) => t.closest(s);
    if (g('[data-ktab]')) { P.tab = g('[data-ktab]').getAttribute('data-ktab'); drawPanel(); return; }
    if (g('[data-acc]')) return decide(+g('[data-acc]').getAttribute('data-acc'), true);
    if (g('[data-rej]')) return decide(+g('[data-rej]').getAttribute('data-rej'), false);
    if (g('[data-cancel]')) { if (!confirm('Batalkan usulan ini?')) return; const r = await sb().rpc('kta_cr_cancel', { p_id: g('[data-cancel]').getAttribute('data-cancel'), p_token: token() }); if (r.error) say(r.error.message, true); await loadMine(); ui(); drawPanel(); return; }
    if (g('[data-day]')) { P.day = g('[data-day]').getAttribute('data-day'); drawPanel(); return; }
    if (g('[data-undo]')) { const [id, i] = g('[data-undo]').getAttribute('data-undo').split(':'); return undo(id, +i); }
    if (g('[data-snap]')) { e.preventDefault(); const d = g('[data-snap]').getAttribute('data-snap'); const s = await snapshot(d); if (s) A.exportExcel(s.data, `per ${fmtD(d)}`); return; }
    if (g('[data-restore]')) return restore(g('[data-restore]').getAttribute('data-restore'));
    if (g('[data-hxls]')) { e.preventDefault(); return exportHistory(g('[data-hxls]').getAttribute('data-hxls')); }
    if (t.id === 'ktaSaveSet') return saveSettings();
  }

  // ---------------- Excel (format seperti di web, dengan rumus) ----------------
  let EXJ = null;
  function loadExcelJS() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    if (EXJ) return EXJ;
    EXJ = new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'; s.onload = () => ok(window.ExcelJS); s.onerror = () => { EXJ = null; no(new Error('Pembuat Excel gagal dimuat. Periksa koneksi lalu coba lagi.')); }; document.head.appendChild(s); });
    return EXJ;
  }
  const C = { ink: 'FF1E1B3A', ink2: 'FF4B4868', muted: 'FF8A87A6', line: 'FFE8E6F3', pri: 'FF6D28D9', priSoft: 'FFEFE9FE', priInk: 'FF5B21B6', card2: 'FFF7F6FD', crit: ['FFDC2626', 'FFFEE2E2'], warn: ['FFB45309', 'FFFEF3C7'], good: ['FF15803D', 'FFDCFCE7'], info: ['FF2563EB', 'FFDBEAFE'], mute: ['FF8A87A6', 'FFF7F6FD'] };
  const FONT = 'Arial', DFMT = '[$-421]dd mmm yyyy';
  const toDate = (v) => isoDate(v) ? new Date(Date.UTC(+v.slice(0, 4), +v.slice(5, 7) - 1, +v.slice(8, 10))) : (v == null || v === '' ? null : v);
  const border = { top: { style: 'thin', color: { argb: C.line } }, left: { style: 'thin', color: { argb: C.line } }, bottom: { style: 'thin', color: { argb: C.line } }, right: { style: 'thin', color: { argb: C.line } } };
  function head(ws, row, heads, widths) {
    const r = ws.getRow(row); r.height = 32;
    heads.forEach((t, i) => { const c = r.getCell(i + 1); c.value = t; c.font = { name: FONT, bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.pri } }; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = border; ws.getColumn(i + 1).width = widths[i] || 14; });
  }
  function cellB(c, opt) { opt = opt || {}; c.font = Object.assign({ name: FONT, size: 10, color: { argb: C.ink } }, opt.font || {}); c.border = border; c.alignment = { vertical: 'top', wrapText: !!opt.wrap, horizontal: opt.center ? 'center' : undefined }; if (c.value instanceof Date) { c.numFmt = DFMT; c.alignment = { vertical: 'top', horizontal: 'center' }; } }
  function title(ws, t, sub) { ws.getCell('A1').value = t; ws.getCell('A1').font = { name: FONT, size: 14, bold: true, color: { argb: C.ink } }; ws.getCell('A2').value = sub; ws.getCell('A2').font = { name: FONT, size: 9, color: { argb: C.ink2 } }; ws.views = [{ showGridLines: false }]; }
  async function download(wb, name) {
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    if (typeof save === 'function') return save(name, blob);
    const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  }
  const short = () => (typeof PROJ !== 'undefined' && (PROJ.cfg && PROJ.cfg.mppLabel)) || String(WEB_ID).toUpperCase();

  A.exportExcel = async function (D, label) {
    D = D || DATA;
    let X; try { X = await loadExcelJS(); } catch (e) { if (_oldXLSX && D === DATA) { say('Format Excel baru gagal dimuat, memakai format lama.', true); return _oldXLSX(); } say(e.message, true); return; }
    say('Menyiapkan Excel…');
    const wb = new X.Workbook(); wb.creator = 'Monitoring Manpower';
    const L = short();
    // --- MPP
    const ws = wb.addWorksheet('MPP ' + L, { properties: { defaultRowHeight: 18 } });
    title(ws, 'MPP ' + L, 'Planning manpower dan monitoring PTK/rekrutmen' + (label ? ' · data ' + label : '') + '. Keterangan PTK dihitung otomatis terhadap tanggal acuan di C3.');
    ws.getCell('A3').value = 'Tanggal acuan'; ws.getCell('A3').font = { name: FONT, size: 9, bold: true, color: { argb: C.ink2 } };
    ws.getCell('C3').value = { formula: 'TODAY()' }; ws.getCell('C3').numFmt = DFMT; ws.getCell('C3').font = { name: FONT, bold: true, color: { argb: C.priInk } }; ws.getCell('C3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.priSoft } };
    ws.getCell('D3').value = 'Ganti dengan tanggal lain untuk melihat status per tanggal itu.'; ws.getCell('D3').font = { name: FONT, size: 9, italic: true, color: { argb: C.muted } };
    const H = ['No', 'Nama', 'Jabatan', 'Keterangan', 'PIC', 'PTK', 'Tanggal Pengajuan PTK', 'Psikologi Test', 'Interview User', 'Offering Latter', 'MCU', 'FU MCU', 'On Site', 'Induksi', 'Due Date', 'Status', 'Tanggal Close', 'Keterangan PTK', 'Lama Closing (Hari)'];
    const HR = 5; head(ws, HR, H, [6, 30, 24, 48, 12, 26, 14, 13, 13, 13, 13, 13, 13, 13, 13, 11, 13, 22, 12]);
    let r = HR + 1, lastS = {}, lastG = {}; const rows = [];
    (D.positions || []).forEach((p, i) => {
      if (p.section !== lastS) { ws.mergeCells(r, 1, r, H.length); const c = ws.getCell(r, 1); c.value = p.section || '(tanpa section)'; c.font = { name: FONT, bold: true, color: { argb: C.priInk } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.priSoft } }; r++; lastS = p.section; lastG = p.section; }
      if (p.group && p.group !== lastG) { ws.mergeCells(r, 1, r, H.length); const c = ws.getCell(r, 1); c.value = p.group; c.font = { name: FONT, bold: true, size: 9, color: { argb: C.ink2 } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.card2 } }; r++; lastG = p.group; }
      const st = (p.stages || []).slice(0, 7); while (st.length < 7) st.push(null);
      const vals = [i + 1, p.nama, p.jabatan, p.ket, p.pic, p.ptk, toDate(p.aju)].concat(st.map(toDate), [toDate(p.due), p.status, toDate(p.close)]);
      vals.forEach((v, j) => { const c = ws.getCell(r, j + 1); c.value = v == null ? null : v; cellB(c, { wrap: j === 3, center: j === 0 || j === 4 || j === 15 }); });
      const vac = /^vacant$/i.test(String(p.nama || '').trim());
      ws.getCell(r, 2).font = { name: FONT, size: 10, bold: true, color: { argb: vac ? C.crit[0] : C.ink } }; if (vac) ws.getCell(r, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.crit[1] } };
      const R = (col) => col + r;
      ws.getCell(r, 18).value = { formula: `IF(OR(${R('F')}="",${R('G')}=""),"TIDAK ADA PENGAJUAN",IF(ISNUMBER(SEARCH("close",${R('P')})),"SELESAI",IF(${R('O')}="","",IF(${R('O')}-$C$3<=0,"JATUH TEMPO",IF(${R('O')}-$C$3<=7,"HAMPIR JATUH TEMPO","ON TRACK")))))` };
      ws.getCell(r, 19).value = { formula: `IF(AND(${R('F')}<>"",${R('G')}<>"",LOWER(TRIM(${R('P')}))="close",${R('Q')}<>""),${R('Q')}-${R('G')},"")` };
      [18, 19].forEach((j) => { const c = ws.getCell(r, j); cellB(c, { center: true }); c.font = { name: FONT, size: 10, bold: true, color: { argb: C.ink } }; });
      ws.getCell(r, 19).numFmt = '0';
      rows.push(r); r++;
    });
    const f = rows[0] || HR + 1, l = rows[rows.length - 1] || HR + 1;
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: HR, showGridLines: false }];
    ws.autoFilter = { from: { row: HR, column: 1 }, to: { row: l, column: H.length } };
    const cf = (ref, col, text, key, exact) => ws.addConditionalFormatting({ ref, rules: [{ type: 'expression', formulae: [exact ? `$${col}${f}="${text}"` : `ISNUMBER(SEARCH("${text}",$${col}${f}))`], style: { font: { bold: true, color: { argb: C[key][0] } }, fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C[key][1] } } } }] });
    cf(`R${f}:R${l}`, 'R', 'JATUH TEMPO', 'crit', true); cf(`R${f}:R${l}`, 'R', 'HAMPIR JATUH TEMPO', 'warn', true); cf(`R${f}:R${l}`, 'R', 'ON TRACK', 'good', true); cf(`R${f}:R${l}`, 'R', 'SELESAI', 'info', true); cf(`R${f}:R${l}`, 'R', 'TIDAK ADA PENGAJUAN', 'mute', true);
    cf(`P${f}:P${l}`, 'P', 'close', 'good'); cf(`P${f}:P${l}`, 'P', 'continue', 'warn'); cf(`P${f}:P${l}`, 'P', 'open', 'crit');
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${HR}:${HR}` };
    // --- MP Aktif / MP Out
    const MPH = ['No', 'Nama', 'Jabatan', 'Departemen', 'Level', 'Status Kontrak', 'Tanggal Masuk', 'Akhir Kontrak', 'POH', 'Jenis Kelamin', 'Keterangan', 'Site', 'Pendidikan Terakhir', 'Verifikasi Data', 'Catatan Kepegawaian'];
    const mpVals = (p, i) => [i + 1, p.nama, p.jabatan, p.dept, p.level, p.kontrak, toDate(p.masuk), toDate(p.akhir), p.poh, p.jk, p.kategori, p.site, p.pendidikan, p.statusData, p.catatanHR];
    const mpSheet = (name, list, extra) => {
      const w = wb.addWorksheet(name);
      title(w, name, list.length ? list.length + ' orang tercatat.' : 'Belum ada data.');
      const hh = MPH.concat(extra ? ['Tanggal Keluar', 'Alasan Keluar'] : []);
      head(w, 4, hh, hh.map((x) => ({ No: 6, Nama: 32, Jabatan: 24, Departemen: 28, Keterangan: 26, 'Catatan Kepegawaian': 28, 'Alasan Keluar': 26 }[x] || 15)));
      list.forEach((p, i) => { const v = mpVals(p, i).concat(extra ? [toDate(p.keluar), p.alasan] : []); v.forEach((x, j) => { const c = w.getCell(5 + i, j + 1); c.value = x == null ? null : x; cellB(c, { wrap: /Keterangan|Catatan|Alasan/.test(hh[j]), center: j === 0 }); }); w.getCell(5 + i, 2).font = { name: FONT, size: 10, bold: true, color: { argb: C.ink } }; });
      w.views = [{ state: 'frozen', xSplit: 2, ySplit: 4, showGridLines: false }];
      w.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(5, 4 + list.length), column: hh.length } };
    };
    mpSheet('MP Aktif', D.aktif || [], false); mpSheet('MP Out', D.keluar || [], true);
    // --- Populasi Unit & Detail Unit
    const wu = wb.addWorksheet('Populasi Unit'); title(wu, 'Populasi Unit', 'Jumlah per jenis unit.'); head(wu, 4, ['No', 'Jenis Unit', 'Jumlah'], [6, 32, 12]);
    const units = D.units || [];
    units.forEach((u, i) => { [i + 1, u.unit, u.jumlah].forEach((x, j) => { const c = wu.getCell(5 + i, j + 1); c.value = x == null ? null : x; cellB(c, { center: j !== 1 }); }); });
    const tr = 5 + units.length; wu.getCell(tr, 2).value = 'Total'; wu.getCell(tr, 3).value = { formula: `SUM(C5:C${Math.max(5, tr - 1)})` };
    [1, 2, 3].forEach((j) => { const c = wu.getCell(tr, j); c.font = { name: FONT, bold: true, color: { argb: C.priInk } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.priSoft } }; c.border = border; });
    const DH = ['Jenis Unit', 'Nomor Lambung', 'Merek', 'Model/Tipe', 'Tahun', 'Serial/Chassis', 'HM', 'Status Operasional', 'Kondisi', 'Jobsite', 'Keterangan', 'Foto'];
    const wd = wb.addWorksheet('Detail Unit'); const det = units.flatMap((u) => (Array.isArray(u.details) ? u.details : []).map((d) => [u.unit, d.lambung, d.merk, d.model, d.tahun, d.serial, d.hm, d.status, d.kondisi, d.jobsite, d.keterangan, d.foto ? 'Ada (lihat di web)' : 'Belum']));
    title(wd, 'Detail Unit', det.length + ' unit tercatat.'); head(wd, 4, DH, [22, 16, 18, 16, 8, 18, 9, 18, 16, 14, 24, 14]);
    det.forEach((v, i) => v.forEach((x, j) => { const c = wd.getCell(5 + i, j + 1); c.value = x == null || x === '' ? null : x; cellB(c, { wrap: j === 10 }); }));
    wd.views = [{ state: 'frozen', xSplit: 2, ySplit: 4, showGridLines: false }];
    if (det.length) wd.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + det.length, column: DH.length } };
    // --- Ringkasan (sheet pertama)
    const wr = wb.addWorksheet('Ringkasan'); wb.worksheets.unshift(wb.worksheets.pop());
    wb.worksheets.forEach((w, i) => { w.orderNo = i; });
    title(wr, 'Monitoring Manpower ' + L, 'Ringkasan dihitung otomatis dari sheet lain di file ini' + (label ? ' · data ' + label : '') + '.');
    head(wr, 4, ['Indikator', 'Jumlah', 'Catatan'], [34, 14, 50]);
    const M = `'MPP ${L}'!`;
    [['Planning (MPP)', `SUMPRODUCT(--(${M}C${f}:C${l}<>""))`, 'Jumlah posisi di MPP'],
      ['Actual (terisi)', `SUMPRODUCT((${M}C${f}:C${l}<>"")*(LOWER(TRIM(${M}B${f}:B${l}))<>"vacant"))`, 'Posisi yang nama orangnya sudah ada'],
      ['Vacant', `SUMPRODUCT((${M}C${f}:C${l}<>"")*(LOWER(TRIM(${M}B${f}:B${l}))="vacant"))`, 'Posisi yang masih kosong'],
      ['PTK Open', `COUNTIF(${M}P${f}:P${l},"Open")`, ''], ['PTK Continue', `COUNTIF(${M}P${f}:P${l},"Continue")`, ''], ['PTK Close', `COUNTIF(${M}P${f}:P${l},"Close")`, ''],
      ['Jatuh tempo', `COUNTIF(${M}R${f}:R${l},"JATUH TEMPO")`, 'Terhadap tanggal acuan di sheet MPP'], ['Hampir jatuh tempo (≤ 7 hari)', `COUNTIF(${M}R${f}:R${l},"HAMPIR JATUH TEMPO")`, ''],
      ['Rata-rata lama closing (hari)', `IFERROR(AVERAGE(${M}S${f}:S${l}),"–")`, 'Hanya PTK yang sudah close'],
      ['MP Aktif', `COUNTA('MP Aktif'!B5:B2000)`, ''], ['MP Out', `COUNTA('MP Out'!B5:B2000)`, ''], ['Populasi unit', `'Populasi Unit'!C${tr}`, 'Dari baris Total di sheet Populasi Unit'],
    ].forEach(([k, fm, n], i) => { const rr = 5 + i; wr.getCell(rr, 1).value = k; wr.getCell(rr, 2).value = { formula: fm }; wr.getCell(rr, 3).value = n; [1, 2, 3].forEach((j) => cellB(wr.getCell(rr, j), { center: j === 2 })); wr.getCell(rr, 2).font = { name: FONT, size: 11, bold: true, color: { argb: C.ink } }; wr.getCell(rr, 3).font = { name: FONT, size: 9, color: { argb: C.ink2 } }; if (k.startsWith('Rata')) wr.getCell(rr, 2).numFmt = '0.0'; });
    await download(wb, `Monitoring_Manpower_${L}_${(label ? label.replace(/[^0-9A-Za-z]+/g, '-') : (typeof TODAY !== 'undefined' ? TODAY : todayWib()))}.xlsx`);
  };
  // tombol "Download Excel" lama memakai format baru
  const _oldXLSX = typeof exportXLSX === 'function' ? exportXLSX : null;
  if (_oldXLSX) exportXLSX = function () { A.exportExcel(DATA); };

  async function exportHistory(kind) {
    let X; try { X = await loadExcelJS(); } catch (e) { say(e.message, true); return; }
    let lines, name;
    if (kind === 'month') {
      const first = todayWib().slice(0, 8) + '01';
      const s = new Date(Date.parse(first + 'T00:00:00Z') - 7 * 3600e3).toISOString(), e = new Date(Date.now() + 864e5).toISOString();
      lines = await loadRange(s, e); name = `Riwayat_${short()}_${first.slice(0, 7)}.xlsx`;
    } else { lines = P.lines || await loadDay(P.day || todayWib()); name = `Riwayat_${short()}_${P.day || todayWib()}.xlsx`; }
    const wb = new X.Workbook(); const ws = wb.addWorksheet('Riwayat');
    title(ws, 'Riwayat perubahan ' + short(), (kind === 'month' ? 'Bulan ' + fmtD(todayWib()).replace(/^\d+ /, '') : fmtD(P.day || todayWib())) + ' · ' + lines.length + ' perubahan · diunduh ' + tglJam(Date.now()));
    const H = ['Tanggal', 'Jam (WIB)', 'Siapa', 'Status', 'Jenis', 'Halaman', 'Data', 'Kolom', 'Nilai lama', 'Nilai baru', 'Catatan'];
    head(ws, 4, H, [14, 10, 40, 22, 18, 14, 34, 22, 26, 26, 30]);
    lines.slice().reverse().forEach((o, i) => {
      const v = [toDate(dayOf(o._at)), jam(o._at), o._who, o._status, o._kind === 'otomatis' ? 'Laporan otomatis' : o._kind === 'diajukan' ? 'Diajukan editor' : 'Langsung', COLL[o.c] ? COLL[o.c].name : o.c, o.l, opText(o), opOld(o), opNew(o), o._note || ''];
      v.forEach((x, j) => { const c = ws.getCell(5 + i, j + 1); c.value = x == null ? null : x; cellB(c, { wrap: j >= 6 }); });
    });
    ws.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(5, 4 + lines.length), column: H.length } };
    await download(wb, name);
  }
  A.exportHistory = exportHistory;

  // ---------------- sambungkan ke halaman ----------------
  const _applyRole = typeof applyRole === 'function' ? applyRole : null;
  if (_applyRole) applyRole = async function () { const r = await _applyRole.apply(this, arguments); await A.refresh(); return r; };
  const _webLoad = typeof webLoad === 'function' ? webLoad : null;
  if (_webLoad) webLoad = async function () { const r = await _webLoad.apply(this, arguments); try { ui(); } catch (e) {} return r; };
  // pemberitahuan usulan baru untuk Pemilik/PIC
  setInterval(async () => { if (document.hidden || !WEB.sb || !A.info.approver || !A.info.enabled) return; const p = A.info.pending; await loadInfo(); if ((A.info.pending || 0) > (p || 0)) say(`Ada usulan perubahan baru (${A.info.pending} menunggu persetujuan).`); ui(); }, 60000);
  // editor: perbarui status usulan sesekali
  setInterval(async () => { if (document.hidden || A.mode() !== 'draft') return; await loadMine(); ui(); }, 90000);
  if (WEB.sb && WEB.ready) A.refresh();
})();
