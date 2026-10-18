
// ================= WEB: standalone mode (GitHub Pages + Supabase, no Claude) =================
const WEB_CFG = { url: 'https://yoviojbfyvgpllxisjvy.supabase.co', key: 'sb_publishable_I26enb2Kz8iF4WFdH8vixA_8kek-kM9' };
const PROJ = (typeof PROJ_CFG !== 'undefined') ? PROJ_CFG : { id: 'main', app: 'kta-tra', sites: null };
const WEB_TABLE = 'kta_web_state', WEB_BUCKET = 'kta-web-docs', WEB_ROLE_APP = PROJ.app, WEB_OWNER = 'matthewyoga2014@gmail.com';
let WEB_ID = PROJ.id;
if (PROJ.sites) { let k = null; try { k = localStorage.getItem('kta-site:' + PROJ.app); } catch (e) {} const s0 = PROJ.sites.find((x) => x.id === k) || PROJ.sites[0]; WEB_ID = s0.id; PARSE_CFG = s0.cfg; }
if (!PROJ.sites && PROJ.cfg) PARSE_CFG = PROJ.cfg;
const cacheKey = () => WEB_ID === 'main' ? 'kta-web-cache' : 'kta-web-cache:' + WEB_ID;
const WEB = { sb: null, user: null, role: 'viewer', ver: null, editors: null, edErr: null, ready: false, offline: false, empty: false, grant: null, grants: null, gch: null };
const WEB_PRINT = 'kta_print_grants';
// Link anonim ?k= sudah tidak dipakai: semua orang wajib masuk dengan email yang diundang (Pusat Monitoring).
const SHARE_KEY = '';
const HUB = '../';
(function () {
  try { localStorage.removeItem('kta-share:' + PROJ.app); const u = new URL(location.href); if (u.searchParams.has('k')) { u.searchParams.delete('k'); history.replaceState(null, '', u.pathname + u.search + u.hash); } } catch (e) {}
})();
// izin menu & unduh dari Pemilik (Pusat Monitoring → Akses & Bagikan → Izin Menu)
let PERMS = {};
const PERM_FIXED = ['dashboard', 'setting'];
function permOf(id, k) {
  const r = WEB.role; if (r === 'owner') return true; if (r !== 'editor' && r !== 'viewer') return false;
  if (k === 'v' && PERM_FIXED.includes(id)) return true;
  const p = (PERMS[r] || {})[id]; if (p && typeof p[k] === 'boolean') return p[k];
  return k === 'v' ? true : r === 'editor';
}
function DL_OK() { try { if (!WEB.ready) return CAN_EDIT || PRINT_OK; return IS_OWNER || permOf(ui.page, 'd') || (!CAN_EDIT && PRINT_OK); } catch (e) { return CAN_EDIT || PRINT_OK; } }
async function loadPerms() {
  PERMS = {}; if (!WEB.sb || !WEB.user || WEB.role === 'none') return;
  const { data } = await WEB.sb.from('kta_app_perms').select('perms').eq('app_id', WEB_ROLE_APP).maybeSingle();
  PERMS = (data && data.perms) || {};
}
IS_TOP = true;
DL = { async save({ filename, data }) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: /\.csv$/i.test(filename) ? 'text/csv;charset=utf-8' : /\.json$/i.test(filename) ? 'application/json' : 'application/octet-stream' });
  const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
} };

function setState(d) {
  d.positions = d.positions || []; d.aktif = d.aktif || []; d.keluar = d.keluar || []; d.units = d.units || [];
  d.positions.forEach(materialize);
  STATE = d; DATA = d;
  try { localStorage.setItem(cacheKey(), JSON.stringify(d)); } catch (e) {}
  render();
}
function loadCache() { try { const c = JSON.parse(localStorage.getItem(cacheKey()) || 'null'); if (c && Array.isArray(c.positions)) { c.positions.forEach(materialize); STATE = c; DATA = c; return true; } } catch (e) {} return false; }
if (WEB_ID === PROJ.id || !PROJ.sites) loadCache(); else if (!loadCache() && window.SITE_SEEDS && SITE_SEEDS[WEB_ID]) { const d = JSON.parse(JSON.stringify(SITE_SEEDS[WEB_ID])); d.positions.forEach(materialize); STATE = d; DATA = d; }

// uploaded files live in a private Supabase bucket; '/_blob/<id>' links are served from there
const _fetch = window.fetch.bind(window);
window.fetch = async function (u, o) {
  if (typeof u === 'string' && u.startsWith('/_blob/')) {
    const id = decodeURIComponent(u.slice(7));
    if (!WEB.sb || !CAN_EDIT) return new Response('', { status: 403 });
    const { data, error } = await WEB.sb.storage.from(WEB_BUCKET).download(id);
    if (error || !data) return new Response('', { status: /not.?found|404/i.test((error && error.message) || '') ? 404 : 403 });
    const type = data.type || (/\.pdf$/i.test(id) ? 'application/pdf' : /\.png$/i.test(id) ? 'image/png' : /\.webp$/i.test(id) ? 'image/webp' : /\.jpe?g$/i.test(id) ? 'image/jpeg' : '');
    return new Response(data, { status: 200, headers: { 'content-type': type } });
  }
  return _fetch(u, o);
};
const WEB_ASSETS = { async upload(f) {
  const ext = (f.name.match(/\.[A-Za-z0-9]+$/) || [''])[0].toLowerCase();
  const id = (WEB_ID === 'main' ? '' : WEB_ID + '/') + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)) + ext;
  const { error } = await WEB.sb.storage.from(WEB_BUCKET).upload(id, f, { contentType: f.type, upsert: false });
  if (error) { const e = new Error(error.message); e.code = /size|large/i.test(error.message) ? 'too_large' : /policy|security|denied|unauthor/i.test(error.message) ? 'not_granted' : 'error'; throw e; }
  return { id, contentType: f.type };
} };

async function webLoad() {
  const r = await WEB.sb.rpc('kta_web_read', { p_ids: [WEB_ID], p_key: SHARE_KEY || null });
  if (r.error) throw r.error;
  const row = (r.data || [])[0] || null;
  WEB.noAccess = !row;
  if (!row) { lockWeb(); WEB.empty = true; return false; }
  unlockWeb();
  WEB.ver = row.updated_at || null;
  if (row.data && Array.isArray(row.data.positions)) { WEB.empty = false; setState(row.data); return true; }
  WEB.empty = true; return false;
}
// ---------- kunci: tanpa link khusus / akun terdaftar, data proyek tidak ditampilkan ----------
function lockWeb() {
  if (CAN_EDIT) return;
  try { localStorage.removeItem(cacheKey()); } catch (e) {}
  let el = document.getElementById('lockScr');
  if (!el) { document.body.insertAdjacentHTML('beforeend', '<div id="lockScr" role="dialog" aria-modal="true" aria-labelledby="lockT"><div class="lk"><span class="lkm">M</span><h2 id="lockT"></h2><p id="lockP"></p><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button type="button" class="btn btn-p" id="lockIn">Masuk</button><button type="button" class="btn btn-p" id="lockAsk" hidden>Minta Akses</button><a class="btn btn-g" href="' + HUB + '" style="text-decoration:none">Pusat Monitoring</a></div></div></div>'); el = document.getElementById('lockScr'); }
  document.getElementById('lockT').textContent = WEB.user ? 'Belum punya akses ke web ini' : 'Masuk untuk membuka';
  document.getElementById('lockP').innerHTML = WEB.user
    ? `Akun <b>${esc(WEB.user.email)}</b> belum terdaftar di ${esc(PROJ.title || 'web ini')}. Buka link undangan yang dikirim ke email Anda, atau klik <b>Minta Akses</b> agar Pemilik/Editor menyetujuinya.${WEB.asked ? '<br><b>Permintaan sudah terkirim.</b> Halaman terbuka otomatis setelah disetujui (muat ulang).' : ''}`
    : `${esc(PROJ.title || 'Web ini')} hanya bisa dibuka oleh email yang diundang Pemilik atau Editor. Masuk dengan email Anda, atau buka dari <b>Pusat Monitoring</b>.`;
  document.getElementById('lockIn').hidden = !!WEB.user;
  document.getElementById('lockAsk').hidden = !WEB.user || !!WEB.asked;
  el.hidden = false; document.body.classList.add('locked');
}
document.addEventListener('click', async (e) => {
  if (!e.target.closest('#lockAsk')) return; e.stopPropagation();
  const { data, error } = await WEB.sb.rpc('kta_access_ask', { p_app: WEB_ROLE_APP, p_note: null });
  if (error) { toast('Gagal mengirim permintaan: ' + error.message, true); return; }
  WEB.asked = true; toast(data === 'member' ? 'Akun ini sudah punya akses. Muat ulang halaman.' : 'Permintaan akses terkirim ke Pemilik/Editor.'); lockWeb();
}, true);
function unlockWeb() { const el = document.getElementById('lockScr'); if (el) el.hidden = true; document.body.classList.remove('locked'); }
document.addEventListener('click', (e) => { if (e.target.closest('#lockIn')) { e.stopPropagation(); openLogin(); } }, true);
async function webRole() {
  const email = ((WEB.user && WEB.user.email) || '').trim().toLowerCase();
  if (!email) return 'none';
  const r = await WEB.sb.rpc('kta_member_role', { p_app: WEB_ROLE_APP });
  if (!r.error && typeof r.data === 'string') return r.data || 'none';
  const q = await WEB.sb.from('app_access_roles').select('role').eq('app_id', WEB_ROLE_APP).eq('email', email).maybeSingle();
  return q.error ? 'none' : ((q.data && q.data.role) || 'none');
}
async function applyRole() {
  WEB.role = await webRole();
  IS_OWNER = WEB.role === 'owner';
  CAN_EDIT = WEB.role === 'owner' || WEB.role === 'editor';
  ROLE = IS_OWNER ? 'Pemilik · Editor' : CAN_EDIT ? 'Editor' : 'Pelihat';
  ASSETS = CAN_EDIT ? WEB_ASSETS : null;
  { const tp = document.getElementById('toPortal'); if (tp) tp.hidden = WEB.role === 'none'; }
  await loadPerms();
  WEB.editors = null; WEB.grants = null;
  GUARD_WHO = WEB.user ? WEB.user.email : '';
  await loadGrant();
  WEB.mail = null;
  if (IS_OWNER) { loadGrants(); loadMail(); }
  watchGrants();
  authBtn();
  render();
}
function authBtn() {
  let b = document.getElementById('authBtn');
  if (!b) { document.getElementById('roleTag').insertAdjacentHTML('afterend', '<button type="button" class="btn btn-g" id="authBtn"></button>'); b = document.getElementById('authBtn'); }
  b.textContent = WEB.user ? 'Keluar' : 'Masuk';
  b.title = WEB.user ? `Masuk sebagai ${WEB.user.email}` : 'Masuk untuk mengedit';
}

async function commit(mutate, okMsg) {
  if (!CAN_EDIT || SAVING || !WEB.sb) return false;
  const next = JSON.parse(JSON.stringify(STATE));
  mutate(next);
  next.positions.forEach((p, i) => { p.no = i + 1; });
  next.meta = { ...(next.meta || {}), updated: TODAY };
  SAVING = true; showSaving(true);
  let reopen = null; try { reopen = sessionStorage.getItem('mp5-cands'); sessionStorage.removeItem('mp5-cands'); } catch (e) {}
  try {
    const cur = await WEB.sb.from(WEB_TABLE).select('updated_at').eq('id', WEB_ID).maybeSingle();
    if (cur.error) throw cur.error;
    if ((cur.data ? cur.data.updated_at : null) !== WEB.ver) { await webLoad(); toast('Data baru saja diubah editor lain. Data terbaru sudah dimuat, silakan ulangi perubahan.', true); return false; }
    const r = await WEB.sb.from(WEB_TABLE).upsert({ id: WEB_ID, data: next, updated_at: new Date().toISOString(), updated_by: WEB.user.email }).select('updated_at').single();
    if (r.error) throw r.error;
    WEB.ver = r.data.updated_at;
    setState(next);
    toast(okMsg || 'Perubahan tersimpan.');
    if (reopen !== null && DATA.positions[+reopen]) setTimeout(() => openCands(+reopen), 60);
    return true;
  } catch (e) {
    const m = (e && e.message) || '';
    toast(/policy|security|permission|denied/i.test(m) ? 'Akun ini tidak punya akses edit.' : 'Gagal menyimpan: ' + (m || 'periksa koneksi lalu coba lagi.'), true);
    return false;
  } finally { SAVING = false; showSaving(false); }
}

// ---------- login ----------
function openLogin() {
  openForm({ eyebrow: 'Masuk', title: 'Masuk', submit: 'Masuk',
    intro: 'Editor: masukkan email yang sudah didaftarkan Pemilik. Pelihat: masuk dengan email Anda untuk meminta izin cetak. Isi password jika akun Anda sudah punya password; kosongkan untuk menerima <b>link masuk</b> lewat email.',
    values: {}, fields: [{ k: 'em', label: 'Email', req: true, full: true, ph: 'nama@email.com' }, { k: 'pw', label: 'Password (opsional)', full: true }],
    onSave: async (v) => {
      const email = String(v.em || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Format email belum benar.', true); return false; }
      try {
        if (v.pw) {
          const { error } = await WEB.sb.auth.signInWithPassword({ email, password: v.pw });
          if (error) throw error;
          toast('Berhasil masuk.');
        } else {
          const { error } = await WEB.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true } });
          if (error) throw error;
          toast(`Link masuk dikirim ke ${email}. Buka email lalu klik linknya.`);
        }
        return true;
      } catch (e) {
        const m = (e && e.message) || '';
        toast(/invalid login/i.test(m) ? 'Email atau password salah.' : /rate|limit|seconds/i.test(m) ? 'Terlalu sering meminta link. Tunggu beberapa menit lalu coba lagi.' : 'Gagal masuk: ' + m, true);
        return false;
      }
    } });
  const pw = document.getElementById('f_pw'); if (pw) { pw.type = 'password'; pw.autocomplete = 'current-password'; }
  const em = document.getElementById('f_em'); if (em) { em.type = 'email'; em.autocomplete = 'email'; }
}

// ---------- editor management (Pengaturan) ----------
async function loadEditors() {
  try {
    const { data, error } = await WEB.sb.from('app_access_roles').select('email,role').eq('app_id', WEB_ROLE_APP).order('email');
    if (error) throw error;
    WEB.editors = data || []; WEB.edErr = null;
  } catch (e) { WEB.editors = []; WEB.edErr = (e && e.message) || 'Daftar editor tidak bisa dimuat.'; }
  if (ui.page === 'setting') render();
}
function editorsCard() {
  if (!IS_OWNER) return `<div class="card s6"><div class="ch"><div><div class="eyebrow">Editor</div><h2>Daftar Editor</h2></div></div><p class="small" style="margin:0">Hanya Pemilik yang bisa menambah atau menghapus Editor. ${CAN_EDIT ? '' : 'Jika Anda perlu mengedit, minta Pemilik mendaftarkan email Anda, lalu klik <b>Masuk</b> di pojok kanan atas.'}</p></div>`;
  const list = WEB.editors;
  return `<div class="card s6"><div class="ch"><div><div class="eyebrow">Editor</div><h2>Kelola Editor</h2><p>Tambahkan email orang yang boleh mengedit. Mereka masuk lewat tombol <b>Masuk</b> dengan email itu, tanpa akun Claude.</p></div></div>
    <form id="edForm" class="edf" novalidate><input type="email" id="edEmail" placeholder="nama@email.com" aria-label="Email editor baru" autocomplete="off"><button type="submit" class="btn btn-p">+ Tambah Editor</button></form>
    ${WEB.edErr ? `<div class="ferr">${esc(WEB.edErr)}</div>` : ''}
    <div class="edl">${list === null ? '<div class="upst"><span class="spin sm"></span>Memuat daftar…</div>' : list.map((r) => `<div><span class="em">${esc(r.email)}</span><span class="hs ${r.role === 'owner' ? 'ok' : 'pr'}">${r.role === 'owner' ? 'Pemilik' : 'Editor'}</span>${r.role === 'owner' ? '' : `<button type="button" class="btn btn-g btn-sm red" data-rmed="${esc(r.email)}">Hapus</button>`}</div>`).join('') || '<div class="small">Belum ada editor.</div>'}</div>
    <p class="small" style="margin:10px 0 0">Editor hanya bisa mengubah proyek ini; proyek lain punya daftar editornya sendiri.</p></div>`;
}
function pageSetting(D) {
  return `${header('Sistem', 'Pengaturan', 'Pemilik, editor, sinkronisasi, backup, dan download Excel.')}
  <div class="grid">
    <div class="card s6"><div class="ch"><div><div class="eyebrow">Akses</div><h2>Pemilik & Editor</h2></div><span class="pill ${CAN_EDIT ? 'live' : ''}">${ROLE}</span></div>
      <div class="role"><b>Pemilik</b><span>${esc(WEB_OWNER)}. Bisa mengedit semua data dan menentukan siapa saja editornya.</span></div>
      <div class="role"><b>Editor</b><span>Email yang didaftarkan Pemilik. Diundang lewat link Editor dari Pemilik. Bisa membagikan link Pelihat, mengubah data posisi yang sudah ada, mengelola pelamar, upload berkas, dan menata Struktur Organisasi. Menambah / menghapus posisi, nama section / sub-section / jabatan baru, sinkron Excel, dan pulihkan backup hanya oleh Pemilik.</span></div>
      <div class="role"><b>Pelihat</b><span>Email yang diundang lewat <b>link Pelihat</b> (wajib masuk). Hanya melihat menu yang diizinkan Pemilik di proyek ini, tidak bisa membuka proyek lain. Print & unduhan mengikuti izin menu, atau setelah Pemilik menyetujui permintaan izin cetaknya. Tampilan diberi watermark dan disembunyikan saat mencoba screenshot.</span></div>
      <p class="small" style="margin:12px 0 0">${WEB.user ? `Masuk sebagai <b style="color:var(--ink)">${esc(WEB.user.email)}</b> — ${IS_OWNER ? '<b style="color:var(--good)">Pemilik</b>' : CAN_EDIT ? '<b style="color:var(--good)">Editor</b>' : '<b>Pelihat</b> (diundang sebagai Pelihat)'}.` : 'Anda melihat sebagai <b>Pelihat</b>. Klik <b>Masuk</b> di pojok kanan atas untuk mengedit.'}</p></div>
    ${accessCard()}
    ${printCard()}
    ${mailCard()}
    <div class="card s6"><div class="ch"><div><div class="eyebrow">Sinkronisasi</div><h2>Sinkronkan Excel</h2><p>Ganti seluruh data web dengan isi file Excel Monitoring Manpower KTA - TRA (sheet DASHBOARD, MPP KTA-TRA, MP Aktif, MP Out). Pelamar yang hilang dari Keterangan tetap disimpan sebagai riwayat.</p></div></div>
      ${CAN_EDIT ? '<button type="button" class="btn btn-p" data-sync="1">Sinkronkan Excel</button>' : '<p class="small" style="margin:0">Hanya Pemilik/Editor yang bisa menyinkronkan Excel.</p>'}</div>
    <div class="card s6"><div class="ch"><div><div class="eyebrow">Download</div><h2>Download Excel</h2><p>Unduh data terbaru dari web dalam format .xlsx (MPP, MP Aktif, MP Out, Populasi Unit).</p></div></div>
      <button type="button" class="btn btn-g" id="xlsxBtn">Download Excel</button></div>
    <div class="card s6"><div class="ch"><div><div class="eyebrow">Backup</div><h2>Backup & Pulihkan</h2><p>Simpan cadangan seluruh data (.json) dan pulihkan bila perlu. Backup dari web versi Claude juga bisa dipulihkan di sini.</p></div></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn btn-g" id="bkBtn">Download Backup</button>${CAN_EDIT ? '<button type="button" class="btn btn-g" id="rsBtn">Pulihkan dari Backup</button>' : ''}</div>
      <input type="file" id="rsIn" accept=".json,application/json" hidden></div>
  </div>`;
}
document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'edForm') return;
  e.preventDefault();
  if (!IS_OWNER) return;
  const inp = document.getElementById('edEmail'); const email = (inp.value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Format email belum benar.', true); return; }
  if (email === WEB_OWNER) { toast('Email ini adalah Pemilik.', true); return; }
  const { error } = await WEB.sb.from('app_access_roles').upsert({ app_id: WEB_ROLE_APP, email, role: 'editor', updated_at: new Date().toISOString() }, { onConflict: 'app_id,email' });
  if (error) { toast('Gagal menambah editor: ' + error.message, true); return; }
  toast(`${email} sekarang Editor.`); await loadEditors();
});
document.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('#authBtn')) {
    e.stopPropagation();
    if (!WEB.sb) { toast('Server belum terhubung. Periksa koneksi internet lalu muat ulang.', true); return; }
    if (WEB.user) confirmBox(`Keluar dari ${WEB.user.email}?`, 'Anda kembali melihat sebagai Pelihat.', async () => { await WEB.sb.auth.signOut(); return true; });
    else openLogin();
    if (WEB.user) { const b = document.querySelector('#frm button[type="submit"]'); if (b) { b.textContent = 'Keluar'; b.className = 'btn btn-p'; } }
    return;
  }
  const rm = t.closest('[data-rmed]');
  if (rm && IS_OWNER) {
    e.stopPropagation(); const email = rm.dataset.rmed;
    confirmBox(`Hapus ${email} dari Editor?`, 'Orang ini hanya bisa melihat setelah dihapus.', async () => {
      const { error } = await WEB.sb.from('app_access_roles').delete().eq('app_id', WEB_ROLE_APP).eq('email', email).eq('role', 'editor');
      if (error) { toast('Gagal menghapus: ' + error.message, true); return false; }
      toast(`${email} dihapus dari Editor.`); loadEditors(); return true;
    });
  }
}, true);

// ---------- start ----------
async function webInit() {
  authBtn();
  if (!window.supabase || !window.supabase.createClient) { WEB.offline = true; toast('Tidak bisa terhubung ke server data. Menampilkan data terakhir yang tersimpan.', true); return; }
  WEB.sb = window.supabase.createClient(WEB_CFG.url, WEB_CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'kta-web-auth' } });
  try { const { data } = await WEB.sb.auth.getSession(); WEB.user = (data && data.session && data.session.user) || null; } catch (e) {}
  try { await webLoad(); } catch (e) { toast('Data terbaru belum bisa dimuat: ' + ((e && e.message) || 'periksa koneksi.'), true); }
  await applyRole();
  WEB.ready = true; render();
  if (WEB.noAccess && !CAN_EDIT) lockWeb();
  setInterval(() => { if (!CAN_EDIT && !document.hidden && WEB.sb) { webLoad().catch(() => {}); if (PROJ.sites) loadAllSites(); } }, 60000);
  if (CAN_EDIT && WEB.empty && !WEB.noAccess) await commit(() => {}, 'Data awal tersimpan di server.');
  WEB.sb.auth.onAuthStateChange((ev, s) => {
    const nu = (s && s.user) || null;
    if ((nu && nu.email) === (WEB.user && WEB.user.email)) return;
    WEB.user = nu;
    setTimeout(async () => { await applyRole(); try { await webLoad(); if (PROJ.sites) loadAllSites(); } catch (er) {} if (CAN_EDIT && WEB.empty && !WEB.noAccess) commit(() => {}, 'Data awal tersimpan di server.'); if (ev === 'SIGNED_IN') toast(`Masuk sebagai ${nu.email} (${ROLE}).`); if (ev === 'SIGNED_OUT') toast('Anda sudah keluar.'); }, 0);
  });
  watchState();
  if (PROJ.sites) { loadAllSites(); WEB.sb.channel('kta-web-sites').on('postgres_changes', { event: '*', schema: 'public', table: WEB_TABLE }, (pl) => { const n = pl.new; if (n && n.id && PROJ.sites.some((x) => x.id === n.id) && n.data) { SITE_DATA[n.id] = n.data; if (ui.page === 'karyawan' && document.getElementById('modal').hidden) render(); else siteNavCount(); } }).subscribe(); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && document.getElementById('modal').hidden && !SAVING) webLoad().catch(() => {}); });
}
setTimeout(webInit, 0);

// ---------- izin cetak (Pelihat) ----------
async function loadGrant() {
  WEB.grant = null; PRINT_OK = false;
  if (!WEB.sb || !WEB.user || CAN_EDIT) return;
  const { data } = await WEB.sb.from(WEB_PRINT).select('status,requested_at,decided_at').eq('app_id', WEB_ROLE_APP).eq('email', WEB.user.email.toLowerCase()).maybeSingle();
  WEB.grant = data || null; PRINT_OK = !!(data && data.status === 'approved');
}
async function loadGrants() {
  const { data, error } = await WEB.sb.from(WEB_PRINT).select('email,status,requested_at,decided_at').eq('app_id', WEB_ROLE_APP).order('requested_at', { ascending: false });
  WEB.grants = error ? [] : (data || []);
  grantPopup();
  render();
}
function watchGrants() {
  if (WEB.gch) { WEB.sb.removeChannel(WEB.gch); WEB.gch = null; }
  if (!WEB.user || !(IS_OWNER || !CAN_EDIT)) return;
  const f = IS_OWNER ? 'app_id=eq.' + WEB_ROLE_APP : 'email=eq.' + WEB.user.email.toLowerCase();
  WEB.gch = WEB.sb.channel('kta-print-' + Date.now()).on('postgres_changes', { event: '*', schema: 'public', table: WEB_PRINT, filter: f }, async (pl) => {
    if (IS_OWNER) {
      await loadGrants();
      if (pl.new && pl.new.status === 'pending') toast(`Permintaan izin cetak dari ${pl.new.email}. Buka Pengaturan untuk menyetujui.`);
    } else {
      const was = PRINT_OK; await loadGrant(); render();
      if (!was && PRINT_OK) toast('Pemilik menyetujui izin cetak Anda. Print & unduh sekarang aktif.');
      else if (was && !PRINT_OK) toast('Izin cetak Anda dicabut oleh Pemilik.', true);
      else if (WEB.grant && WEB.grant.status === 'denied') toast('Permintaan izin cetak ditolak Pemilik.', true);
    }
  }).subscribe();
}
function PRINT_ASK() {
  const info = (title, intro, submit, fn) => openForm({ eyebrow: 'Izin cetak', title, intro, values: {}, fields: [], submit, onSave: fn || (() => true) });
  if (CAN_EDIT) { info('Print & unduh dimatikan', 'Pemilik tidak mengizinkan print / unduh di menu ini untuk Editor. Hubungi Pemilik bila perlu.', 'Tutup'); return; }
  if (!WEB.sb) { info('Cetak & unduh perlu izin Pemilik', 'Server belum terhubung. Periksa koneksi lalu muat ulang.', 'Tutup'); return; }
  if (!WEB.user) { info('Cetak & unduh perlu izin Pemilik', 'Sebagai Pelihat, Anda hanya bisa melihat. Masuk dengan email Anda dulu, lalu kirim permintaan izin cetak ke Pemilik.', 'Masuk', () => { setTimeout(openLogin, 50); return true; }); return; }
  const g = WEB.grant;
  if (g && g.status === 'pending') { info('Menunggu persetujuan Pemilik', `Permintaan dari <b>${esc(WEB.user.email)}</b> sudah terkirim. Tombol Print & unduh aktif otomatis begitu Pemilik menyetujuinya.`, 'Tutup'); return; }
  info(g && g.status === 'denied' ? 'Permintaan sebelumnya ditolak' : 'Minta izin cetak ke Pemilik',
    `Kirim permintaan sebagai <b>${esc(WEB.user.email)}</b>. Setelah disetujui, Anda bisa print, simpan PDF/PNG, dan mengunduh data.`, 'Kirim permintaan', async () => {
      const row = { app_id: WEB_ROLE_APP, email: WEB.user.email.toLowerCase(), status: 'pending', requested_at: new Date().toISOString(), decided_at: null, decided_by: null };
      const { error } = g ? await WEB.sb.from(WEB_PRINT).update(row).eq('app_id', WEB_ROLE_APP).eq('email', row.email) : await WEB.sb.from(WEB_PRINT).insert(row);
      if (error) { toast('Gagal mengirim permintaan: ' + error.message, true); return false; }
      await loadGrant(); render();
      let mailed = false;
      try { const { data } = await WEB.sb.functions.invoke('kta-print', { body: { op: 'notify', app: WEB_ROLE_APP } }); mailed = !!(data && data.ok); } catch (er) {}
      toast(mailed ? 'Permintaan terkirim. Pemilik sudah diberi tahu lewat email.' : 'Permintaan izin cetak terkirim ke Pemilik.'); return true;
    });
}
function printCard() {
  if (!IS_OWNER) return '';
  const L = WEB.grants, tm = (s) => s ? new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const st = { pending: ['hd', 'Menunggu'], approved: ['ok', 'Diizinkan'], denied: ['no', 'Ditolak'] };
  return `<div class="card s6"><div class="ch"><div><div class="eyebrow">Keamanan</div><h2>Izin Cetak Pelihat</h2><p>Pelihat tidak bisa print, simpan PDF/PNG, atau mengunduh data sebelum Anda setujui. Editor selalu bisa.</p></div>${L && L.some((r) => r.status === 'pending') ? `<span class="pill red">${L.filter((r) => r.status === 'pending').length} menunggu</span>` : ''}</div>
    <div class="pgl2">${L === null ? '<div class="upst"><span class="spin sm"></span>Memuat…</div>' : L.map((r) => `<div><span class="em">${esc(r.email)}</span><span class="hs ${st[r.status][0]}">${st[r.status][1]}</span>
      ${r.status !== 'approved' ? `<button type="button" class="btn btn-p btn-sm" data-pg="approved" data-pe="${esc(r.email)}">Setujui</button>` : ''}
      ${r.status === 'pending' ? `<button type="button" class="btn btn-g btn-sm red" data-pg="denied" data-pe="${esc(r.email)}">Tolak</button>` : ''}
      ${r.status === 'approved' ? `<button type="button" class="btn btn-g btn-sm red" data-pg="del" data-pe="${esc(r.email)}">Cabut izin</button>` : ''}
      <small>Diminta ${tm(r.requested_at)}${r.decided_at ? ' · diputuskan ' + tm(r.decided_at) : ''}</small></div>`).join('') || '<div class="small">Belum ada permintaan.</div>'}</div></div>`;
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-pg]'); if (!b || !IS_OWNER) return;
  e.stopPropagation(); b.disabled = true;
  const email = b.dataset.pe, act = b.dataset.pg;
  const q = WEB.sb.from(WEB_PRINT);
  const { error } = act === 'del' ? await q.delete().eq('app_id', WEB_ROLE_APP).eq('email', email)
    : await q.update({ status: act, decided_at: new Date().toISOString(), decided_by: WEB.user.email }).eq('app_id', WEB_ROLE_APP).eq('email', email);
  if (error) { toast('Gagal: ' + error.message, true); b.disabled = false; return; }
  toast(act === 'approved' ? `${email} sekarang boleh mencetak.` : act === 'denied' ? `Permintaan ${email} ditolak.` : `Izin cetak ${email} dicabut.`);
  loadGrants();
}, true);

// ---------- notifikasi email (Pemilik) ----------
async function loadMail() {
  const { data, error } = await WEB.sb.rpc('kta_mail_key_status');
  WEB.mail = error ? { set: false, err: error.message } : (data || { set: false });
  if (ui.page === 'setting') render();
}
function mailCard() {
  if (!IS_OWNER) return '';
  const m = WEB.mail;
  const st = m === null ? '<div class="upst"><span class="spin sm"></span>Memeriksa…</div>'
    : m.set ? `<div class="role" style="margin-top:0"><b style="color:var(--good)">✓ Aktif</b><span>Key Resend tersimpan (…${esc(m.tail || '')}). Permintaan izin cetak dikirim ke <b>${esc(WEB_OWNER)}</b>.</span></div>`
    : '<div class="role" style="margin-top:0"><b style="color:var(--crit)">Belum aktif</b><span>Tempel API key dari resend.com (diawali <b>re_</b>) lalu klik Simpan.</span></div>';
  return `<div class="card s6"><div class="ch"><div><div class="eyebrow">Notifikasi</div><h2>Email Izin Cetak</h2><p>Permintaan izin cetak dikirim ke email Anda dengan tombol Setujui / Tolak, bisa diputuskan dari HP tanpa membuka web.</p></div></div>
    ${st}
    <form id="mailForm" class="edf" novalidate style="margin-top:12px"><input type="password" id="mailKey" placeholder="${m && m.set ? 'Ganti key (opsional)' : 're_xxxxxxxx'}" aria-label="API key Resend" autocomplete="off" spellcheck="false"><button type="submit" class="btn btn-p">Simpan</button></form>
    ${m && m.set ? '<button type="button" class="btn btn-g" id="mailTest">Kirim email uji</button>' : ''}
    <p class="small" style="margin:10px 0 0">Key disimpan di server dan tidak bisa dilihat siapa pun, termasuk dari web ini.</p></div>`;
}
document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'mailForm') return;
  e.preventDefault(); if (!IS_OWNER) return;
  const inp = document.getElementById('mailKey'); const k = (inp.value || '').trim();
  if (!/^re_[A-Za-z0-9_]{10,}$/.test(k)) { toast('Key Resend harus diawali re_ (salin dari menu API Keys di resend.com).', true); return; }
  const { error } = await WEB.sb.rpc('kta_set_mail_key', { k });
  if (error) { toast('Gagal menyimpan: ' + error.message, true); return; }
  inp.value = ''; toast('Key tersimpan. Mengirim email uji…');
  await loadMail(); mailTest();
});
async function mailTest() {
  const b = document.getElementById('mailTest'); if (b) b.disabled = true;
  let r = null;
  try { const { data } = await WEB.sb.functions.invoke('kta-print', { body: { op: 'test' } }); r = data; } catch (er) {}
  if (b) b.disabled = false;
  if (r && r.ok) toast(`Email uji terkirim ke ${WEB_OWNER}. Cek Kotak Masuk / Spam.`);
  else toast('Email uji gagal: ' + ((r && (r.detail || r.error)) || 'periksa koneksi') + '. Pastikan akun Resend didaftarkan dengan ' + WEB_OWNER + '.', true);
}
document.addEventListener('click', (e) => { if (e.target.closest('#mailTest') && IS_OWNER) { e.stopPropagation(); mailTest(); } }, true);

// ---------- pop-up persetujuan untuk Pemilik (langsung muncul saat membuka web, juga di HP) ----------
function grantPopup() {
  const pend = (WEB.grants || []).filter((r) => r.status === 'pending');
  const open = !document.getElementById('modal').hidden;
  const mine = open && document.getElementById('pgPop');
  if (mine && !pend.length) { closeModal(); return; }
  if (!pend.length || (open && !mine)) return;
  let seen = []; try { seen = JSON.parse(sessionStorage.getItem('kta-pg-seen') || '[]'); } catch (e) {}
  const key = pend.map((r) => r.email + '@' + r.requested_at);
  if (!mine && key.every((k) => seen.includes(k))) return;
  try { sessionStorage.setItem('kta-pg-seen', JSON.stringify([...new Set(seen.concat(key))])); } catch (e) {}
  const tm = (s) => new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  document.getElementById('dialog').innerHTML = `<button type="button" class="x" id="mClose" aria-label="Tutup">×</button>
    <div id="pgPop"><div class="eyebrow">Izin cetak</div><h2 id="mTitle" style="font-size:19px;margin-bottom:4px">${pend.length} permintaan menunggu</h2>
    <p class="small" style="margin:0 0 12px">Orang berikut minta izin untuk print, simpan PDF/PNG, dan mengunduh data.</p>
    <div class="pgl2">${pend.map((r) => `<div><span class="em">${esc(r.email)}</span>
      <button type="button" class="btn btn-p btn-sm" data-pg="approved" data-pe="${esc(r.email)}">✓ Setujui</button>
      <button type="button" class="btn btn-g btn-sm red" data-pg="denied" data-pe="${esc(r.email)}">✕ Tolak</button>
      <small>Diminta ${tm(r.requested_at)}</small></div>`).join('')}</div>
    <p class="small" style="margin:12px 0 0">Bisa diubah kapan saja di Pengaturan → Izin Cetak Pelihat.</p></div>`;
  document.getElementById('modal').hidden = false;
}
const _renderPerm = render;
render = function () {
  if (WEB.ready && !permOf(ui.page, 'v')) ui.page = 'dashboard';
  _renderPerm.apply(this, arguments);
  if (!WEB.ready || IS_OWNER) return;
  const nav = document.getElementById('nav'); if (!nav) return;
  nav.querySelectorAll('[data-go]').forEach((b) => { b.hidden = !permOf(b.dataset.go, 'v'); });
  nav.querySelectorAll('.lbl').forEach((l) => { let n = l.nextElementSibling, any = false; while (n && !n.classList.contains('lbl')) { if (!n.hidden) any = true; n = n.nextElementSibling; } l.hidden = !any; });
};
document.addEventListener('click', (e) => { const g = e.target.closest('[data-go]'); if (g && WEB.ready && !permOf(g.dataset.go, 'v')) { e.preventDefault(); e.stopPropagation(); toast('Menu ini tidak diizinkan untuk akun Anda.', true); } }, true);
const _renderPg = render;
render = function () {
  _renderPg.apply(this, arguments);
  if (!IS_OWNER) return;
  const n = (WEB.grants || []).filter((r) => r.status === 'pending').length;
  const b = document.querySelector('[data-go="setting"]');
  if (b && n && !b.querySelector('.ct')) b.insertAdjacentHTML('beforeend', `<span class="ct al" title="Permintaan izin cetak">${n}</span>`);
};

function watchState() {
  if (WEB.sch) { WEB.sb.removeChannel(WEB.sch); WEB.sch = null; }
  const id = WEB_ID;
  WEB.sch = WEB.sb.channel('kta-web-state-' + id).on('postgres_changes', { event: '*', schema: 'public', table: WEB_TABLE, filter: 'id=eq.' + id }, (pl) => {
    const n = pl.new; if (id !== WEB_ID || !n || !n.data || n.updated_at === WEB.ver || SAVING) return;
    if (!document.getElementById('modal').hidden) return;
    WEB.ver = n.updated_at; setState(n.data); toast('Data diperbarui oleh ' + (n.updated_by || 'editor') + '.');
  }).subscribe();
}

// ---------- jobsite switcher (proyek dengan beberapa jobsite, mis. KMB) ----------
function siteName() { const s = PROJ.sites && PROJ.sites.find((x) => x.id === WEB_ID); return s ? s.name : ''; }
function siteBar() {
  if (!PROJ.sites) return;
  let el = document.getElementById('siteSel');
  if (!el) {
    document.getElementById('roleTag').insertAdjacentHTML('beforebegin', `<label class="sitesel"><span>Jobsite</span><select id="siteSel" aria-label="Pilih jobsite">${PROJ.sites.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>`);
    el = document.getElementById('siteSel');
    el.addEventListener('change', () => switchSite(el.value));
  }
  el.value = WEB_ID;
  const t = document.querySelector('.top .ttl'); if (t) t.textContent = `${PROJ.title} · ${siteName()}`;
  document.title = `${PROJ.title} · ${siteName()}`;
}
async function switchSite(id) {
  const s = PROJ.sites.find((x) => x.id === id); if (!s || id === WEB_ID) return;
  if (SAVING) { siteBar(); return; }
  WEB_ID = id; PARSE_CFG = s.cfg;
  try { localStorage.setItem('kta-site:' + PROJ.app, id); } catch (e) {}
  closeModal();
  if (!loadCache() && window.SITE_SEEDS && SITE_SEEDS[id]) { const d = JSON.parse(JSON.stringify(SITE_SEEDS[id])); d.positions.forEach(materialize); STATE = d; DATA = d; }
  WEB.ver = null; render();
  if (WEB.sb) { try { await webLoad(); } catch (e) { toast('Data jobsite belum bisa dimuat: ' + ((e && e.message) || 'periksa koneksi.'), true); } watchState(); if (CAN_EDIT && WEB.empty && !WEB.noAccess) commit(() => {}, 'Data awal jobsite tersimpan di server.'); }
  toast('Jobsite: ' + s.name);
}
const _renderSite = render;
render = function () { _renderSite.apply(this, arguments); siteBar(); };

// ---------- tautan kembali ke portal ----------
(function () {
  const brand = document.querySelector('.side .brand');
  if (brand && !document.getElementById('toPortal')) brand.insertAdjacentHTML('afterend', '<a id="toPortal" class="toportal" hidden href="../">← Pusat Monitoring</a>');
})();

// ---------- mutasi antar jobsite (proyek dengan beberapa jobsite, mis. KMB) ----------
function mutasiBar(idx) {
  if (!PROJ.sites || !CAN_EDIT) return;
  const p = DATA.positions[idx]; if (!p || isVacant(p)) return;
  const d = document.getElementById('dialog'); if (!d || d.querySelector('.mutbar')) return;
  d.insertAdjacentHTML('beforeend', `<div class="mutbar"><div><b>Pindah jobsite</b><span>Mutasi ${esc(p.nama)} ke jobsite lain. Posisi di sini otomatis menjadi Vacant.</span></div><button type="button" class="btn btn-g" data-mutasi="${idx}">⇄ Pindah jobsite</button></div>`);
}
const _mppFormMut = mppForm;
mppForm = function (idx) { _mppFormMut(idx); if (idx != null) mutasiBar(idx); };
const _soFormMut = soForm;
soForm = function (idx) { _soFormMut(idx); mutasiBar(idx); };
document.addEventListener('click', (e) => { const b = e.target.closest('[data-mutasi]'); if (b && CAN_EDIT) { e.stopPropagation(); openMutasi(+b.dataset.mutasi); } }, true);

async function openMutasi(idx) {
  const p = DATA.positions[idx]; if (!p) return;
  const others = PROJ.sites.filter((s) => s.id !== WEB_ID);
  const D = document.getElementById('dialog');
  const MUT = { idx, uid: p.uid, nama: p.nama, rows: {} };
  D.innerHTML = `<div class="cm-h"><h2 id="mTitle">Pindah jobsite</h2><button type="button" class="x" id="mClose" aria-label="Tutup">×</button></div>
    <div class="soinfo"><div><span>Nama</span><b>${esc(p.nama)}</b></div><div><span>Jabatan</span><b>${esc(p.jabatan || '-')}</b></div><div><span>Dari</span><b>${esc(siteName())}</b></div></div>
    <form id="mutForm" novalidate>
      <div class="fgrid">
        <div class="fld"><label for="mutTo">Pindah ke jobsite</label><select id="mutTo">${others.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
        <div class="fld"><label for="mutPos">Posisi di jobsite tujuan</label><select id="mutPos" disabled><option>Memuat…</option></select><small id="mutHint"></small></div>
        <div class="fld full"><label for="mutOld">Posisi di ${esc(siteName())}</label><select id="mutOld"><option value="vacant">Jadikan Vacant (perlu pengganti)</option>${IS_OWNER ? '<option value="delete">Hapus posisi ini (headcount ikut pindah)</option>' : ''}</select></div>
      </div>
      <div class="ferr" id="mutErr" hidden></div>
      <div class="factions"><span style="flex:1"></span><button type="button" class="btn btn-g" id="fCancel">Batal</button><button type="submit" class="btn btn-p" id="mutGo" disabled>Pindahkan</button></div>
    </form>`;
  document.getElementById('modal').hidden = false;
  const load = async () => {
    const to = document.getElementById('mutTo').value, sel = document.getElementById('mutPos'), go = document.getElementById('mutGo'), hint = document.getElementById('mutHint');
    sel.disabled = true; go.disabled = true; sel.innerHTML = '<option>Memuat…</option>'; hint.textContent = '';
    try {
      const r = await WEB.sb.from(WEB_TABLE).select('data,updated_at').eq('id', to).maybeSingle();
      if (r.error) throw r.error;
      const d = (r.data && r.data.data) || { positions: [], aktif: [], keluar: [], units: [] };
      MUT.rows[to] = { data: d, ver: (r.data && r.data.updated_at) || null };
      const vac = d.positions.map((x, i) => ({ x, i })).filter(({ x }) => isVacant(x));
      const same = vac.filter(({ x }) => jabKey(x.jabatan) === jabKey(p.jabatan)), rest = vac.filter(({ x }) => jabKey(x.jabatan) !== jabKey(p.jabatan));
      const opt = ({ x, i }) => `<option value="${i}">Isi Vacant No. ${x.no} · ${esc(x.jabatan || '-')} (${esc(x.group || x.section || '-')})</option>`;
      sel.innerHTML = same.map(opt).join('') + rest.map(opt).join('') + (IS_OWNER ? `<option value="new">➕ Tambah posisi baru: ${esc(p.jabatan || '-')}</option>` : '');
      if (!sel.options.length) { hint.textContent = 'Tidak ada posisi Vacant di jobsite tujuan. Minta Pemilik menambah posisi dulu.'; return; }
      hint.textContent = same.length ? 'Posisi Vacant dengan jabatan yang sama ditampilkan paling atas.' : vac.length ? 'Tidak ada Vacant dengan jabatan yang sama.' : 'Tidak ada Vacant, posisi baru akan ditambahkan.';
      sel.disabled = false; go.disabled = false;
    } catch (e) { hint.textContent = 'Gagal memuat jobsite tujuan: ' + ((e && e.message) || 'periksa koneksi'); }
  };
  document.getElementById('mutTo').addEventListener('change', load);
  if (!WEB.sb) { document.getElementById('mutHint').textContent = 'Server belum terhubung.'; return; }
  load();
  document.getElementById('mutForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const to = document.getElementById('mutTo').value, pick = document.getElementById('mutPos').value, old = document.getElementById('mutOld').value;
    const row = MUT.rows[to]; if (!row) return;
    const go = document.getElementById('mutGo'); go.disabled = true;
    const toName = PROJ.sites.find((s) => s.id === to).name, fromName = siteName();
    const cur = posByUid(DATA, MUT.uid); if (!cur || isVacant(cur)) { toast('Data posisi sudah berubah, buka ulang.', true); closeModal(); return; }
    const ak = (DATA.aktif || []).find((a) => mpScore(mpNorm(a.nama), mpNorm(cur.nama)) >= 60);
    const prev = JSON.parse(JSON.stringify(row.data));
    const dest = JSON.parse(JSON.stringify(row.data));
    dest.positions = dest.positions || []; dest.aktif = dest.aktif || [];
    let tp;
    if (pick === 'new') {
      tp = { uid: newUid(), no: dest.positions.length + 1, section: cur.section, group: cur.group, nama: cur.nama, jabatan: cur.jabatan, ket: null, pic: null, ptk: null, aju: null, stages: [null, null, null, null, null, null, null], due: null, status: null, close: null, cands: [] };
      dest.positions.push(tp);
    } else { tp = dest.positions[+pick]; tp.nama = cur.nama; if (!Array.isArray(tp.cands)) tp.cands = []; }
    tp.mutasi = { dari: fromName, tgl: TODAY };
    if (ak) dest.aktif.push({ ...ak, nama: cur.nama, site: toName });
    dest.mutasi = (dest.mutasi || []).concat([{ nama: cur.nama, jabatan: cur.jabatan, dari: fromName, ke: toName, tgl: TODAY, oleh: WEB.user && WEB.user.email }]);
    dest.positions.forEach((x, i) => { x.no = i + 1; });
    dest.meta = { ...(dest.meta || {}), updated: TODAY };
    SAVING = true; showSaving(true);
    try {
      const chk = await WEB.sb.from(WEB_TABLE).select('updated_at').eq('id', to).maybeSingle();
      if ((chk.data ? chk.data.updated_at : null) !== row.ver) throw new Error('Data jobsite tujuan baru saja diubah orang lain. Coba lagi.');
      const w = await WEB.sb.from(WEB_TABLE).upsert({ id: to, data: dest, updated_at: new Date().toISOString(), updated_by: WEB.user.email });
      if (w.error) throw w.error;
    } catch (er) { SAVING = false; showSaving(false); go.disabled = false; toast('Gagal memindahkan: ' + ((er && er.message) || 'periksa koneksi'), true); return; }
    SAVING = false; showSaving(false);
    const ok = await commit((S) => {
      const i = S.positions.findIndex((x) => x.uid === MUT.uid); if (i < 0) return;
      if (old === 'delete' && IS_OWNER) S.positions.splice(i, 1);
      else { const q = S.positions[i]; q.nama = 'Vacant'; q.cands = []; q.ket = `Dipindah ke ${toName} (${cur.nama})`; delete q.tier; }
      S.mutasi = (S.mutasi || []).concat([{ nama: cur.nama, jabatan: cur.jabatan, dari: fromName, ke: toName, tgl: TODAY, oleh: WEB.user && WEB.user.email }]);
    }, `${cur.nama} dipindah ke ${toName}.`);
    if (ok === false) {
      await WEB.sb.from(WEB_TABLE).upsert({ id: to, data: prev, updated_at: new Date().toISOString(), updated_by: WEB.user.email });
      toast('Pemindahan dibatalkan, data kedua jobsite dikembalikan.', true);
    }
  });
}

// ---------- MP Aktif & MP Out gabungan semua jobsite (filter jobsite hanya untuk MPP) ----------
const SITE_DATA = {};
async function loadAllSites() {
  if (!PROJ.sites || !WEB.sb) return;
  const { data, error } = await WEB.sb.rpc('kta_web_read', { p_ids: PROJ.sites.map((s) => s.id), p_key: SHARE_KEY || null });
  if (error || !data) return;
  data.forEach((r) => { SITE_DATA[r.id] = r.data; });
  if (ui.page === 'karyawan') render(); else siteNavCount();
}
function siteRows(kind) {
  const out = [];
  PROJ.sites.forEach((s) => {
    let d = s.id === WEB_ID ? DATA : SITE_DATA[s.id] || (window.SITE_SEEDS && SITE_SEEDS[s.id]);
    if (!d) return;
    if (s.id !== WEB_ID) { d = JSON.parse(JSON.stringify(d)); (d.positions || []).forEach((p) => { if (!p.uid) p.uid = 'x'; }); mppSync(d); }
    (kind === 'out' ? d.keluar : d.aktif || []).forEach((p, i) => out.push({ p, i, site: s }));
  });
  return out;
}
function siteNavCount() {
  if (!PROJ.sites) return;
  const n = siteRows('aktif').length, b = document.querySelector('[data-go="karyawan"] .ct');
  if (b) b.textContent = n;
}
if (PROJ.sites) {
  pageKaryawan = function (D) {
    const out = ui.kt === 'out', q = (ui.kq || '').toLowerCase();
    const all = siteRows(out ? 'out' : 'aktif'), nA = siteRows('aktif').length, nO = siteRows('out').length;
    const rows = all.filter(({ p, site }) => !q || `${p.nama} ${p.jabatan} ${p.poh} ${site.name}`.toLowerCase().includes(q));
    const cols = MP_COLS.filter((c) => ui.allCols || c[3]).filter((c) => !(out && c[0] === 'sisa'));
    if (out) cols.push(['keluar', 'Tanggal Keluar', (p) => p.keluar ? fmt(p.keluar) : '']);
    const act = ({ p, i, site }) => !CAN_EDIT ? '' : `<td class="nw"><span class="acts">${editBtn(`data-empx="${site.id}|${out ? 'out' : 'aktif'}|${i}"`)}${out ? '' : `<button type="button" class="ab out" data-mpoutx="${site.id}|${i}" title="Pindahkan ke MP Out">MP OUT</button>`}</span></td>`;
    return `${header('Database', out ? 'MP Out' : 'MP Aktif', 'Database manpower KMB gabungan semua jobsite. Filter jobsite hanya berlaku di MPP.')}
    <div class="card"><div class="toolbar">
      <div class="seg" role="group" aria-label="Pilih data">${[['aktif', `MP Aktif (${nA})`], ['out', `MP Out (${nO})`]].map(([k, l]) => `<button type="button" data-kt="${k}" aria-pressed="${ui.kt === k}">${l}</button>`).join('')}</div>
      <input type="search" id="kq" placeholder="Cari nama, jabatan, POH, atau jobsite" value="${esc(ui.kq || '')}" aria-label="Cari karyawan">
      <button type="button" class="btn btn-g" id="colBtn" aria-pressed="${!!ui.allCols}">${ui.allCols ? 'Kolom Ringkas' : 'Semua Kolom'}</button>
      ${CAN_EDIT ? `<button type="button" class="btn btn-p" data-addmp="${out ? 'out' : 'aktif'}" title="Ditambahkan ke jobsite ${esc(siteName())}">+ Tambah Data (${esc(siteName())})</button>` : ''}
      ${DL ? `<button type="button" class="btn btn-g" data-csv="${out ? 'out' : 'aktif'}">Export CSV</button>` : ''}
    </div>
    <div class="small" style="margin:-4px 0 10px">${rows.length} data · ${PROJ.sites.map((s) => `${esc(s.name)} ${all.filter((r) => r.site.id === s.id).length}`).join(' · ')}</div>
    <div class="tw"><table class="t mpp"><thead><tr>${CAN_EDIT ? '<th>Aksi</th>' : ''}<th>Jobsite</th>${cols.map((c) => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>
    ${rows.map((r, k) => `<tr>${act(r)}<td class="nw"><span class="hs ${r.site.id === WEB_ID ? 'pr' : 'hist'}">${esc(r.site.name)}</span></td>${cols.map((c) => `<td class="nw">${c[2](r.p, k)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length + 2}" class="empty">Tidak ada data.</td></tr>`}
    </tbody></table></div>
    <p class="note">MP Aktif mengikuti MPP tiap jobsite. ${CAN_EDIT ? 'Edit data di jobsite lain otomatis membuka jobsite tersebut. ' : ''}Data pribadi (NIK, KK, NPWP, nomor HP, rekening, BPJS, alamat, data keluarga) tidak disimpan di web ini.</p></div>`;
  };
  document.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-empx],[data-mpoutx]'); if (!a || !CAN_EDIT) return;
    e.stopPropagation();
    const [sid, x, y] = (a.dataset.empx || a.dataset.mpoutx).split('|');
    if (sid !== WEB_ID) { await switchSite(sid); }
    if (a.dataset.empx) mpForm(x, +y); else mpOutForm(+x);
  }, true);
  const _renderNav = render;
  render = function () { _renderNav.apply(this, arguments); siteNavCount(); };
}
if (PROJ.sites) document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-csv="aktif"],[data-csv="out"]'); if (!b || (typeof guardFree === 'function' && !guardFree())) return;
  e.stopImmediatePropagation(); e.preventDefault();
  const out = b.dataset.csv === 'out', rows = siteRows(out ? 'out' : 'aktif');
  const head = ['Jobsite'].concat(MP_HEAD).concat(out ? ['Tanggal Keluar'] : []);
  save(`${out ? 'MP_Out' : 'MP_Aktif'}_KMB_semua_jobsite.csv`, csvOf(head, rows.map((r, k) => [r.site.name].concat(mpRow(r.p, k)).concat(out ? [r.p.keluar || ''] : []))));
}, true);

// ---------- banner gambar di atas Dashboard (seperti header Google Form) ----------
if (typeof PROJ_ART !== 'undefined' && PROJ_ART) {
  const _pageDash = pageDashboard;
  pageDashboard = function (D) {
    const site = PROJ.sites ? siteName() : '';
    return `<div class="gbanner gb-${PROJ.app}" style="--art:url('${PROJ_ART}')"><div class="gb-t"><span>Monitoring Manpower</span><b>${esc(PROJ.short || '')}${site ? ` <em>· ${esc(site)}</em>` : ''}</b><small>Plant Department · ${PROJ.sites ? PROJ.sites.length + ' jobsite' : 'MPP, rekrutmen & struktur organisasi'}</small></div></div>` + _pageDash(D);
  };
}

// ================= Pemilik: hapus berkas pelamar tidak aktif (web + Google Drive) =================
// Berkas pelamar disimpan di Drive selama berkasnya masih ada di web. Hanya Pemilik yang bisa
// menghapus berkas pelamar tidak aktif; setelah itu sinkron Drive ikut membuangnya (±10 menit).
const DRIVE_DIR = { main: 'KTA - TRA', bupr: 'BUPR Ampah', mbj: 'MBJ', 'kmb-c4': 'KMB › C4', 'kmb-slr-maintenance': 'KMB › SLR - Maintenance', 'kmb-slr-rekondisi': 'KMB › SLR - Rekondisi', 'kmb-workshop': 'KMB › Workshop Legok' };
const PURGE = { orphans: [], loading: false };
function purgeList() {
  const out = [];
  DATA.positions.forEach((p, pi) => candidates(p).forEach((c) => {
    if (c.fromHist || PT_OF(c) !== 'tidak') return;
    const fs = Object.values(c.files || {}).filter((f) => f && f.id);
    if (fs.length) out.push({ pi, ci: c.ci, uid: p.uid, name: c.name, jab: p.jabatan || '', status: c.status, ids: fs.map((f) => f.id) });
  }));
  return out;
}
async function purgeOrphans() {
  // berkas di penyimpanan web yang sudah tidak dipakai pelamar mana pun (mis. pelamar dihapus Editor), lebih dari 1 hari
  const used = new Set(); DATA.positions.forEach((p) => (p.cands || []).forEach((c) => Object.values(c.files || {}).forEach((f) => f && f.id && used.add(f.id))));
  const pre = WEB_ID === 'main' ? '' : WEB_ID;
  const r = await WEB.sb.storage.from(WEB_BUCKET).list(pre, { limit: 1000 });
  if (r.error || !Array.isArray(r.data)) return [];
  const old = Date.now() - 864e5;
  return r.data.filter((o) => o.id && o.name !== '.emptyFolderPlaceholder').map((o) => ({ id: pre ? pre + '/' + o.name : o.name, t: Date.parse(o.created_at || '') || 0 }))
    .filter((o) => !used.has(o.id) && o.t && o.t < old).map((o) => o.id);
}
const _pagePelamar24 = pagePelamar;
pagePelamar = function (D) {
  const h = _pagePelamar24(D);
  if (!IS_OWNER) return h;
  const L = purgeList(), n = L.reduce((a, x) => a + x.ids.length, 0);
  const btn = `<button type="button" class="btn btn-g red" id="purgeBtn" title="Hapus berkas pelamar tidak aktif dari web dan Google Drive">Hapus Berkas Tidak Aktif${n ? ` (${n})` : ''}</button>`;
  return h.replace('<div class="mtools">', '<div class="mtools">' + btn);
};
async function openPurge() {
  const L = purgeList();
  const D = document.getElementById('dialog');
  D.innerHTML = `<div class="cm-h"><h2 id="mTitle">Hapus Berkas Pelamar Tidak Aktif</h2><button type="button" class="x" id="mClose" aria-label="Tutup">×</button></div><div class="empty"><span class="spin sm"></span> Memeriksa berkas…</div>`;
  document.getElementById('modal').hidden = false;
  let orph = []; try { orph = await purgeOrphans(); } catch (e) { orph = []; }
  PURGE.orphans = orph; PURGE.list = L;
  const nf = L.reduce((a, x) => a + x.ids.length, 0) + orph.length;
  const dir = DRIVE_DIR[WEB_ID] || 'jobsite ini';
  D.innerHTML = `<div class="cm-h"><h2 id="mTitle">Hapus Berkas Pelamar Tidak Aktif</h2><button type="button" class="x" id="mClose" aria-label="Tutup">×</button></div>
    ${nf ? `<div class="soinfo"><div><span>Pelamar tidak aktif</span><b>${L.length}</b></div><div><span>Berkas dihapus</span><b>${nf}</b></div><div><span>Folder Drive</span><b>${esc(dir)}</b></div></div>
    <div class="cm-list" style="max-height:38vh">${L.map((x) => `<div class="cc"><div class="cc-h"><div><b>${esc(x.name)}</b><div class="cc-meta"><span class="hs no">${esc(x.status)}</span><span>${esc(x.jab)}</span><span>${x.ids.length} berkas</span></div></div></div></div>`).join('')}
      ${orph.length ? `<div class="cc"><div class="cc-h"><div><b>${orph.length} berkas lama tanpa pelamar</b><div class="cc-meta"><span>Pelamarnya sudah dihapus dari web, berkasnya masih tersimpan</span></div></div></div></div>` : ''}</div>
    <p class="small" style="margin:12px 0 0">Download dulu dari Google Drive: <b>Monitoring Manpower › ${esc(dir)} › Berkas Pelamar</b>. Setelah dihapus, berkas hilang dari web dan dari Google Drive dalam ±10 menit (masuk Sampah Drive, bisa dipulihkan 30 hari). Nama, status, dan tahap pelamar tetap tersimpan.</p>
    <label class="small" style="display:flex;gap:8px;align-items:center;margin-top:10px;color:var(--ink)"><input type="checkbox" id="purgeOk" style="width:auto"> Saya sudah download berkasnya dari Google Drive</label>
    <div class="ferr" id="purgeErr" hidden></div>
    <div class="factions"><span style="flex:1"></span><button type="button" class="btn btn-g" id="fCancel">Batal</button><button type="button" class="btn btn-d" id="purgeGo" disabled>Hapus ${nf} Berkas</button></div>`
    : `<div class="empty">Tidak ada berkas pelamar tidak aktif di ${esc(siteName() || dir)}. Semua berkas yang tersimpan milik pelamar aktif atau yang sudah diterima.</div><div class="factions"><span style="flex:1"></span><button type="button" class="btn btn-g" id="fCancel">Tutup</button></div>`}`;
}
async function runPurge() {
  const L = PURGE.list || [], orph = PURGE.orphans || [];
  const ids = [...new Set(L.flatMap((x) => x.ids).concat(orph))];
  const go = document.getElementById('purgeGo'); if (go) { go.disabled = true; go.textContent = 'Menghapus…'; }
  const kill = new Set(ids);
  const ok = await Promise.resolve(commit((S) => {
    S.positions.forEach((p) => (p.cands || []).forEach((c) => {
      if (!c.files) return;
      Object.keys(c.files).forEach((k) => { if (c.files[k] && kill.has(c.files[k].id)) delete c.files[k]; });
    }));
  }, null));
  if (ok === false) { const e = document.getElementById('purgeErr'); if (e) { e.hidden = false; e.textContent = 'Gagal menyimpan. Periksa koneksi lalu coba lagi.'; } if (go) { go.disabled = false; go.textContent = `Hapus ${ids.length} Berkas`; } return; }
  let fail = 0;
  for (let i = 0; i < ids.length; i += 100) { const r = await WEB.sb.storage.from(WEB_BUCKET).remove(ids.slice(i, i + 100)); if (r.error) fail += ids.slice(i, i + 100).length; }
  closeModal(); render();
  toast(fail ? `${ids.length - fail} berkas dihapus, ${fail} gagal. Coba lagi nanti.` : `${ids.length} berkas dihapus. Di Google Drive ikut terhapus dalam ±10 menit.`, !!fail);
}
document.addEventListener('click', (e) => {
  if (e.target.closest('#purgeBtn') && IS_OWNER) { e.stopPropagation(); openPurge(); return; }
  if (e.target.closest('#purgeGo') && IS_OWNER) { e.stopPropagation(); runPurge(); }
}, true);
document.addEventListener('change', (e) => { if (e.target.id === 'purgeOk') { const g = document.getElementById('purgeGo'); if (g) g.disabled = !e.target.checked; } });

// ---------- Akses & bagikan: dikelola di Pusat Monitoring ----------
function accessCard() {
  const staff = IS_OWNER || CAN_EDIT;
  return `<div class="card s6"><div class="ch"><div><div class="eyebrow">Bagikan</div><h2>Akses & Bagikan Link</h2><p>${staff ? `Link undangan ${IS_OWNER ? 'Editor & Pelihat' : 'Pelihat'}, daftar anggota, permintaan akses${IS_OWNER ? ', dan izin menu & unduh' : ''} untuk ${esc(PROJ.short || PROJ.title)} dikelola di Pusat Monitoring. Setiap link hanya berlaku untuk email yang diundang.` : 'Akses web ini diatur Pemilik di Pusat Monitoring.'}</p></div></div>${staff ? `<a class="btn btn-p" style="text-decoration:none" href="${HUB}#akses:${WEB_ROLE_APP}">Buka Akses & Bagikan →</a>` : ''}</div>`;
}
// (lama) link khusus Pelihat ?k= — tidak dipakai lagi
async function loadShare() {
  if (!IS_OWNER) return;
  const { data } = await WEB.sb.from('kta_share_links').select('key,updated_at').eq('app_id', WEB_ROLE_APP).maybeSingle();
  WEB.share = data || null; if (ui.page === 'setting') render();
}
const shareUrl = () => WEB.share ? location.origin + location.pathname + '?k=' + WEB.share.key : '';
function shareCard() {
  if (!IS_OWNER) return '';
  const u = shareUrl();
  return `<div class="card s6"><div class="ch"><div><div class="eyebrow">Bagikan</div><h2>Link untuk Pelihat</h2><p>Bagikan link ini ke orang yang hanya boleh <b>melihat</b> ${esc(PROJ.short || PROJ.title)}. Mereka tidak bisa membuka Portal maupun proyek lain.</p></div></div>
    ${u ? `<div class="shl"><input type="text" id="shareUrl" readonly value="${esc(u)}" aria-label="Link untuk Pelihat"><button type="button" class="btn btn-p" id="shareCopy">Salin Link</button></div>
    <p class="small" style="margin:10px 0 0">Kalau link sudah tersebar ke orang yang tidak seharusnya, klik <b>Ganti Link</b>. Link lama langsung tidak bisa dipakai, lalu bagikan link baru ke orang yang masih berhak.</p>
    <div style="margin-top:10px"><button type="button" class="btn btn-g red" id="shareRot">Ganti Link</button></div>` : '<div class="upst"><span class="spin sm"></span>Memuat link…</div>'}</div>`;
}
document.addEventListener('click', async (e) => {
  if (e.target.closest('#shareCopy')) {
    e.stopPropagation(); const u = shareUrl();
    try { await navigator.clipboard.writeText(u); toast('Link Pelihat disalin.'); } catch (er) { const i = document.getElementById('shareUrl'); i.focus(); i.select(); toast('Tekan Ctrl+C untuk menyalin link.'); }
  }
  if (e.target.closest('#shareRot') && IS_OWNER) {
    e.stopPropagation();
    confirmBox('Ganti link Pelihat?', 'Semua orang yang memakai link lama tidak bisa membuka web ini lagi sampai Anda membagikan link baru.', async () => {
      const { data, error } = await WEB.sb.rpc('kta_share_rotate', { p_app: WEB_ROLE_APP });
      if (error) { toast('Gagal mengganti link: ' + error.message, true); return false; }
      WEB.share = { key: data }; toast('Link baru sudah dibuat. Salin dan bagikan.'); render(); return true;
    });
  }
}, true);

// Tombol Kembali bertingkat (seperti Back di folder): halaman sebelumnya di web ini → halaman induk → halaman utama
(function () {
  const path = location.pathname;
  const PARENT = /\/manpower-(?!portal)[^/]+\/?/.test(path) ? '../manpower-portal/' : '../';
  const KEY = 'navstack:' + path;
  const rd = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  const wr = (a) => { try { sessionStorage.setItem(KEY, JSON.stringify(a.slice(-30))); } catch (e) {} };
  const U = () => { try { return typeof ui !== 'undefined' ? ui : null; } catch (e) { return null; } };
  let goingBack = false;
  const orig = typeof window.go === 'function' ? window.go : null;
  if (orig) window.go = function (id) {
    const u = U(), cur = u && u.page;
    if (!goingBack && cur && cur !== id) { const st = rd(), top = st[st.length - 1], en = { p: cur, x: (u && u.person) || '' }; if (!top || top.p !== en.p || top.x !== en.x) st.push(en); wr(st); }
    const r = orig.apply(this, arguments); label(); return r;
  };
  function label() {
    const st = rd(), t = st.length ? 'Kembali ke halaman sebelumnya' : PARENT === '../' ? 'Kembali ke halaman utama Monitoring' : 'Kembali ke Monitoring MPP semua project';
    document.querySelectorAll('.backbtn').forEach((b) => { b.title = t; b.setAttribute('aria-label', t); });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.backbtn'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const st = rd(), prev = st.pop(); wr(st);
    if (prev && typeof window.go === 'function') { goingBack = true; try { const u = U(); if (prev.x && u) u.person = prev.x; window.go(prev.p); } finally { goingBack = false; label(); } }
    else location.href = PARENT;
  }, true);
  label();
})();
