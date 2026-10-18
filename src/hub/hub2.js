'use strict';
// ================= MONITORING — satu pintu (desain portal) =================
const CFG = { url: 'https://yoviojbfyvgpllxisjvy.supabase.co', key: 'sb_publishable_I26enb2Kz8iF4WFdH8vixA_8kek-kM9' };
const OWNER = 'matthewyoga2014@gmail.com';
// ART diisi saat build (gambar header kartu dari portal lama)
const I = {
  people: (c, s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${c}" aria-hidden="true"><circle cx="9" cy="7.5" r="3.5"/><path d="M2.5 19c.5-3.6 3.1-6 6.5-6s6 2.4 6.5 6z"/><circle cx="17" cy="8.5" r="2.7" opacity=".75"/><path d="M15.6 13.2c3.3-.3 5.6 1.9 6 5.8h-4.6c-.2-2.3-.6-4.1-1.4-5.8z" opacity=".75"/></svg>`,
  helmet: (c, s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${c}" aria-hidden="true"><path d="M4 15a8 8 0 0 1 16 0z"/><path d="M10.5 6.2h3v6h-3z" opacity=".55"/><rect x="2.5" y="15.5" width="19" height="3" rx="1.5"/></svg>`,
  vac: (c, s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${c}" aria-hidden="true"><circle cx="10" cy="7.5" r="4"/><path d="M2.5 21c.6-4.4 3.6-7 7.5-7 1.6 0 3 .4 4.2 1.2-.8 1-1.2 2.3-1.2 3.6 0 .8.1 1.5.4 2.2z"/><path d="M18 14v6M15 17h6" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  pie: (c, s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${c}" aria-hidden="true"><path d="M11 3.1A9 9 0 1 0 20.9 13H11z"/><path d="M13 1.5v9.5h9.5A9.5 9.5 0 0 0 13 1.5z" opacity=".75"/></svg>`,
  doc: (c, s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${c}" aria-hidden="true"><path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M14 2v5h5" fill="#fff" opacity=".45"/><rect x="7.5" y="11" width="8" height="1.8" rx=".9" fill="#fff"/><rect x="7.5" y="15" width="6" height="1.8" rx=".9" fill="#fff"/></svg>`,
  box: (c, s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${c}" aria-hidden="true"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" opacity=".85"/><path d="M3 7.5 12 12l9-4.5M12 12v9" stroke="#fff" stroke-width="1.4" fill="none" opacity=".7"/></svg>`,
  send: (c, s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${c}" aria-hidden="true"><path d="M3 11 21 3l-8 18-2-8z"/></svg>`,
  clock: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  chev: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mount: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 20 9 8l4 6 2.5-3.5L22 20z" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="17" cy="6" r="1.8" stroke="#fff" stroke-width="2"/></svg>',
  exc: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 15h11v4H3zM5 15v-4h5l2 4" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 11 17 5l4 4-2 3" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><circle cx="5" cy="19" r="1.4" fill="#fff"/><circle cx="12" cy="19" r="1.4" fill="#fff"/></svg>',
  sun: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3.5" stroke="#fff" stroke-width="2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
  home: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.5 11 12 4l8.5 7v9.5h-17z" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M9.5 20.5v-6h5v6" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>',
  miner: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9.2a5 5 0 0 1 10 0"/><path d="M5.2 9.4h13.6"/><path d="M12 4.2v2.2M9.6 5 10.3 7M14.4 5 13.7 7"/><path d="M8.6 11.3a3.4 3.4 0 0 0 6.8 0"/><path d="M4.5 21c.6-3.3 3.6-5.4 7.5-5.4s6.9 2.1 7.5 5.4"/><path d="M9.3 16.1 10.8 21M14.7 16.1 13.2 21M7 18.6h2.6M14.4 18.6H17"/></svg>',
  vest: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 11.5a7 7 0 0 1 14 0"/><path d="M3.5 12h17v2.2h-17z"/><path d="M12 4.5v3"/><path d="M7 17.5h10l-1 3.5H8z"/><path d="M9.5 17.5V16M14.5 17.5V16"/></svg>',
  hat: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 15a8 8 0 0 1 16 0" stroke="#fff" stroke-width="2"/><path d="M2.5 16h19v2.5h-19zM12 5v4" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>',
  truck: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 16h13l3-5h3v5h-1M4 16V9h7l3 3" stroke="#fff" stroke-width="1.9" stroke-linejoin="round"/><circle cx="7" cy="17.5" r="1.8" stroke="#fff" stroke-width="1.8"/><circle cx="17" cy="17.5" r="1.8" stroke="#fff" stroke-width="1.8"/></svg>',
  note: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7" stroke="#fff" stroke-width="1.9" stroke-linejoin="round"/></svg>',
};
// sub-portal MPP (satu kartu per jobsite) + APD + tahap 2
const MPP = [
  { app: 'kta-tra', key: 'kta', name: 'KTA - TRA', desc: 'Monitoring Manpower KTA - TRA', url: 'manpower-kta-tra/', ids: ['main'], icon: 'mount', tile: 't1' },
  { app: 'bupr-ampah', key: 'bupr', name: 'BUPR Ampah', desc: 'Monitoring Manpower BUPR Ampah', url: 'manpower-bupr/', ids: ['bupr'], icon: 'exc', tile: 't2' },
  { app: 'mbj', key: 'mbj', name: 'MBJ', desc: 'Monitoring Manpower MBJ', url: 'manpower-mbj/', ids: ['mbj'], icon: 'sun', tile: 't3' },
  { app: 'kmb', key: 'kmb', name: 'KMB', desc: '4 jobsite: C4, SLR, Workshop', url: 'manpower-kmb/', icon: 'home', tile: 't4',
    sites: [['kmb-c4', 'C4'], ['kmb-slr-maintenance', 'SLR - Maintenance'], ['kmb-slr-rekondisi', 'SLR - Rekondisi'], ['kmb-workshop', 'Workshop Legok']] },
];
const APD = { app: 'apd', key: 'apd', name: 'APD KMB', desc: 'Monitoring APD · stok, permintaan & pembagian', url: 'monitoring-apd-kmb/', icon: 'hat', tile: 't5' };
const PHASE2 = [
  { key: 'unit', name: 'Monitoring Unit', desc: 'Rencana kirim, perjalanan & mobilisasi unit', url: 'monitoring-unit/', icon: 'truck' },
  { key: 'notulensi', name: 'Notulensi', desc: 'Notulensi meeting & tindak lanjut', url: 'notulensi/', icon: 'note' },
];
// kotak di halaman utama: satu kotak per web
const WEBS = [
  { key: 'mpp', title: 'Monitoring MPP Achievement All Jobsite', url: 'manpower-portal/', icon: 'miner', tile: 't1', show: () => MPP.some((p) => roleOf(p.app)) },
  { key: 'apd', title: 'Monitoring APD', url: 'monitoring-apd-kmb/', icon: 'vest', tile: 't2', show: () => !!roleOf('apd') },
  { key: 'unit', title: 'Monitoring Unit & Mobilisasi', url: 'monitoring-unit/', icon: 'truck', tile: 't3', show: () => isOwner() },
  { key: 'notulensi', title: 'Notulensi Meeting', url: 'notulensi/', icon: 'note', tile: 't4', show: () => isOwner() },
];
const SUBS = [...MPP.map((s) => ({ ...s, portal: 'Monitoring MPP' })), { ...APD, portal: 'Monitoring APD' }];
const subOf = (app) => SUBS.find((s) => s.app === app);
const MENUS = {
  mpp: [['dashboard', 'Dashboard', 1], ['mpp', 'MPP (Manpower Planning)'], ['pelamar', 'Data Pelamar'], ['org', 'Struktur Organisasi'], ['karyawan', 'MP Aktif & MP Out'], ['unit', 'Populasi Unit'], ['setting', 'Pengaturan · Download Excel & Backup', 1]],
  apd: [['dashboard', 'Dashboard', 1], ['requests', 'Permintaan APD'], ['people', 'Manpower Aktif & Detail APD'], ['out', 'Manpower Keluar'], ['history', 'Riwayat Transaksi'], ['guide', 'Tata Cara'], ['setting', 'Pengaturan · Download Excel', 1]],
};
const menusOf = (app) => MENUS[app === 'apd' ? 'apd' : 'mpp'];
const ROLE_L = { owner: 'Pemilik', editor: 'Editor', viewer: 'Pelihat' };
const S = { sb: null, user: null, apps: {}, loaded: false, pend: {}, invite: null, inviteRes: null, acc: {}, rows: null, apd: null };
const ui = { page: 'home', app: '' };
const BASE = location.origin + location.pathname.replace(/index\.html$/, '');

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isOwner = () => !!S.user && S.user.email.toLowerCase() === OWNER;
const roleOf = (app) => S.apps[app] || '';
const staff = (app) => ['owner', 'editor'].includes(roleOf(app));
const staffApps = () => SUBS.filter((s) => staff(s.app));
const when = (s) => s && !isNaN(new Date(s)) ? new Date(s).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–';
let toastT; function toast(m, err) { const t = $('toast'); t.textContent = m; t.className = err ? 'err' : ''; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, err ? 6500 : 3800); }
function modal(html, wide) { $('dialog').innerHTML = html; $('dialog').className = 'dlg hx' + (wide ? ' wide' : ''); $('modal').hidden = false; const f = $('dialog').querySelector('input:not([readonly]),select'); if (f) setTimeout(() => f.focus(), 30); }
function closeModal() { $('modal').hidden = true; $('dialog').innerHTML = ''; }
const mh = (e, t) => `<div class="mh"><div><div class="eb2">${e}</div><h3 id="mTitle">${t}</h3></div><button type="button" class="mx" data-close aria-label="Tutup">×</button></div>`;
const acts = (label) => `<div class="row"><button type="button" class="btn btn-g" data-close>Batal</button><button type="submit" class="btn btn-p">${label}</button></div>`;
const chip = (r) => `<span class="chip ${r === 'owner' ? 'own' : r === 'viewer' ? 'vw' : ''}">${ROLE_L[r] || r}</span>`;

// ---------- undangan (?i=token) ----------
(function () {
  try { const u = new URL(location.href); const i = u.searchParams.get('i'); if (i) { localStorage.setItem('kta-invite', i); u.searchParams.delete('i'); history.replaceState(null, '', u.pathname + u.search + u.hash); } } catch (e) {}
  try { const h = (location.hash || '').slice(1); if (h) { const [p, a] = h.split(':'); if (p === 'akses' || p === 'pengaturan') { ui.page = 'set'; ui.app = a || ''; } if (p === 'panduan') ui.page = 'guide'; } } catch (e) {}
})();
const inviteToken = () => { try { return localStorage.getItem('kta-invite') || ''; } catch (e) { return ''; } };
const dropInvite = () => { try { localStorage.removeItem('kta-invite'); } catch (e) {} S.invite = null; };
const tokens = () => inviteToken().split('.').map((x) => x.trim()).filter(Boolean).slice(0, 12);
async function peekInvite() {
  const ts = tokens(); if (!ts.length) { S.invite = null; return; }
  S.invite = await Promise.all(ts.map(async (t) => { const { data } = await S.sb.rpc('kta_invite_peek', { p_token: t }); return (data && data[0]) ? { ...data[0], token: t } : { status: 'invalid', token: t }; }));
}
async function redeemInvite() {
  const ts = tokens(); if (!ts.length || !S.user) return;
  const out = [];
  for (const t of ts) {
    const { data, error } = await S.sb.rpc('kta_invite_redeem', { p_token: t });
    const r = (data && data[0]) || {};
    out.push(error ? { status: 'error', msg: error.message } : { ...r, sub: subOf(r.app_id) });
  }
  S.inviteRes = out; dropInvite();
}

// ---------- data ----------
async function loadApps() {
  S.apps = {};
  if (!S.user) return;
  const { data } = await S.sb.rpc('kta_my_apps');
  (data || []).forEach((x) => { S.apps[x.app_id] = x.role; });
  loadPending();
}
async function loadPending() {
  const apps = staffApps().map((s) => s.app); S.pend = {};
  if (!apps.length) { render(); return; }
  const { data } = await S.sb.from('kta_access_requests').select('app_id').eq('status', 'pending').in('app_id', apps);
  (data || []).forEach((r) => { S.pend[r.app_id] = (S.pend[r.app_id] || 0) + 1; });
  render();
}
async function loadStats() {
  const ids = MPP.filter((p) => roleOf(p.app)).flatMap((p) => p.sites ? p.sites.map((x) => x[0]) : p.ids);
  const jobs = [];
  if (ids.length) jobs.push(S.sb.rpc('kta_web_read', { p_ids: ids, p_key: null }).then((r) => { S.rows = r.data || []; }));
  else S.rows = [];
  if (roleOf('apd')) jobs.push(Promise.all([S.sb.rpc('apd_read', { p_key: null }), S.sb.rpc('apd_people', { p_key: null })]).then(([a, p]) => { S.apd = { st: ((a.data || [])[0] || {}), people: p.data || [] }; }));
  await Promise.all(jobs.map((j) => j.catch(() => {})));
  render();
}
async function loadAccess(app) {
  const a = S.acc[app] = { members: null, reqs: null, inv: null, perms: null };
  const [m, q, i, p] = await Promise.all([
    S.sb.rpc('kta_members', { p_app: app }),
    S.sb.from('kta_access_requests').select('id,email,status,note,requested_at,decided_at,decided_by,token').eq('app_id', app).order('requested_at', { ascending: false }).limit(100),
    S.sb.from('kta_invites').select('token,email,role,created_by,created_at,expires_at,used_at,revoked').eq('app_id', app).order('created_at', { ascending: false }).limit(200),
    S.sb.from('kta_app_perms').select('perms').eq('app_id', app).maybeSingle(),
  ]);
  a.members = m.data || []; a.reqs = q.data || []; a.inv = i.data || []; a.perms = (p.data && p.data.perms) || {};
  if (ui.page === 'set' && ui.app === app) render();
}

// ---------- angka kartu ----------
const isVac = (p) => !p.nama || /^vacant$/i.test(String(p.nama).trim());
function mstats(d) {
  const ps = (d && d.positions) || [];
  const mpp = ps.length, vac = ps.filter(isVac).length, act = mpp - vac;
  const open = ps.filter((p) => /open|continue/i.test(p.status || '') && !/close/i.test(p.status || '')).length;
  return { mpp, act, vac, open, pct: mpp ? Math.round(act / mpp * 100) : 0 };
}
const add = (a, b) => ({ mpp: a.mpp + b.mpp, act: a.act + b.act, vac: a.vac + b.vac, open: a.open + b.open });
function mppOf(p) {
  if (!S.rows) return null;
  const by = Object.fromEntries(S.rows.map((r) => [r.id, r]));
  const ids = p.sites ? p.sites.map((x) => x[0]) : p.ids;
  const per = ids.map((id) => ({ id, s: mstats(by[id] && by[id].data), at: by[id] && by[id].updated_at }));
  const s = per.reduce((a, x) => add(a, x.s), { mpp: 0, act: 0, vac: 0, open: 0 }); s.pct = s.mpp ? Math.round(s.act / s.mpp * 100) : 0;
  return { s, per, last: per.map((x) => x.at).filter(Boolean).sort().pop() };
}
function apdOf() {
  if (!S.apd) return null;
  const d = (S.apd.st && S.apd.st.data) || {}, q = (x) => Number(x) || 0, A = (k) => Array.isArray(d[k]) ? d[k] : [];
  const rc = A('receipts'), byId = Object.fromEntries(rc.map((r) => [r.id, r]));
  const stok = A('stockIn').reduce((a, x) => a + q(x.qty), 0) + A('adjust').reduce((a, x) => a + q(x.qty), 0)
    + A('returns').filter((x) => x.action === 'REUSE' && byId[x.receiptId]).reduce((a, x) => a + q(x.qty), 0)
    - rc.filter((r) => r.source === 'NEW' || r.source === 'REUSE').reduce((a, r) => a + q(r.qty), 0);
  const dist = rc.filter((r) => r.source === 'NEW' || r.source === 'REUSE').reduce((a, r) => a + q(r.qty), 0);
  const req = A('requests').filter((r) => r.status === 'pending' || r.status === 'approved').length;
  const act = new Set(S.apd.people.filter((p) => p.status === 'AKTIF').map((p) => String(p.nama).toUpperCase())).size;
  const types = Array.isArray(d.types) && d.types.length ? d.types.length : 3;
  return { stok, dist, req, act, types, last: S.apd.st.updated_at };
}

// ---------- tampilan ----------
function render() {
  whoUI();
  document.body.classList.toggle('setmode', ui.page !== 'home' && !!S.user && S.loaded);
  $('prBtn').hidden = !S.user; $('setBtn').hidden = !S.user; $('saBtn').hidden = !S.user || !staffApps().length;
  const pc = Object.values(S.pend).reduce((a, b) => a + b, 0); $('setBtn').querySelector('.dot').hidden = !pc;
  if (!S.loaded) { $('tot').innerHTML = ''; $('grid').innerHTML = '<div class="lock"><span class="lg">M</span><p>Menyiapkan…</p></div>'; $('page').hidden = true; return; }
  if (!S.user) { $('tot').innerHTML = ''; $('note').innerHTML = ''; $('page').hidden = true; $('grid').innerHTML = loginHtml(); return; }
  if (ui.page !== 'home') { $('page').hidden = false; $('page').innerHTML = ui.page === 'guide' ? pageGuide() : pageSet(); return; }
  $('page').hidden = true; $('page').innerHTML = '';
  $('note').innerHTML = resultBox() + (Object.keys(S.apps).length ? '' : '<div class="nb warn">Email ini belum punya akses ke portal mana pun. Minta Pemilik atau Editor mengirim <b>link undangan</b> ke email ini.</div>');
  const webs = WEBS.filter((w) => w.show());
  $('tot').innerHTML = webs.map((w) => `<a class="t wt ${w.tile}" href="${w.url}" title="Buka ${esc(w.title)}"><span class="ti">${I[w.icon]}</span><div class="tx"><b>${esc(w.title)}</b></div><span class="ga">${I.chev}</span></a>`).join('');
  $('tot').style.setProperty('--n', Math.max(1, Math.min(4, webs.length)));
  $('grid').innerHTML = '';
}
function actRow(app) {
  const r = roleOf(app), sp = staff(app);
  return `<div class="acts">${chip(r)}${sp ? `<button type="button" class="ab" data-share="${app}">${I.send('currentColor', 15)}Bagikan link</button><button type="button" class="ab" data-akses="${app}">Akses${S.pend[app] ? ` <span class="ct">${S.pend[app]}</span>` : ''}</button>` : ''}</div>`;
}
function mppCard(p) {
  const x = mppOf(p), s = x && x.s, v = (n) => s ? n : '<span class="sk">00</span>';
  return `<article class="card k-${p.key}" style="--art:url('${ART[p.key]}')">
    <div class="ch"><span class="ic">${I[p.icon]}</span><div><h2>${esc(p.name)}</h2></div><a class="go" href="${p.url}">Buka →</a></div>
    <div class="cb">
      <div class="st"><div>${I.people('#7C3AED')}<span><b>${v(s && s.mpp)}</b><span>MPP</span></span></div><div>${I.helmet('#2563EB')}<span><b>${v(s && s.act)}</b><span>Actual</span></span></div><div class="v">${I.vac('#E11D48')}<span><b>${v(s && s.vac)}</b><span>Vacant</span></span></div><div class="o">${I.doc('#F59E0B')}<span><b>${v(s && s.open)}</b><span>PTK open</span></span></div></div>
      <div class="bar" title="${s ? s.pct : 0}% terisi"><i style="width:${s ? s.pct : 0}%"></i></div>
      <div class="meta"><span>${s ? s.pct : 0}% MPP terisi</span><span class="tm">${I.clock}Diperbarui ${when(x && x.last)}</span></div>
      ${actRow(p.app)}
    </div></article>`;
}
function apdCard() {
  const x = apdOf(), v = (n) => x ? n : '<span class="sk">00</span>';
  return `<article class="card k-apd" style="--art:url('${ART.apd}')">
    <div class="ch"><span class="ic">${I.hat}</span><div><h2>Monitoring APD</h2></div><a class="go" href="${APD.url}">Buka →</a></div>
    <div class="cb">
      <div class="st"><div>${I.box('#EA580C')}<span><b>${v(x && x.stok)}</b><span>Stok</span></span></div><div>${I.helmet('#2563EB')}<span><b>${v(x && x.dist)}</b><span>Dibagikan</span></span></div><div class="o">${I.send('#F59E0B')}<span><b>${v(x && x.req)}</b><span>Permintaan</span></span></div><div>${I.people('#7C3AED')}<span><b>${v(x && x.act)}</b><span>Karyawan</span></span></div></div>
      <div class="meta"><span>${x ? x.types + ' jenis APD' : ''}</span><span class="tm">${I.clock}Diperbarui ${when(x && x.last)}</span></div>
      ${actRow('apd')}
    </div></article>`;
}
function p2Card(p) {
  return `<article class="card k-${p.key}" style="--art:url('${ART[p.key] || ''}')">
    <div class="ch"><span class="ic">${I[p.icon]}</span><div><h2>${esc(p.name)}</h2></div><a class="go" href="${p.url}">Buka →</a></div>
    <div class="cb"><div class="nb">Tahap 2: masih memakai akses lamanya sendiri. Akan digabung ke sistem link & izin yang sama.</div></div></article>`;
}
function whoUI() {
  $('whoL').textContent = S.user ? 'Masuk sebagai' : 'Belum masuk';
  $('whoE').textContent = S.user ? S.user.email : 'Masuk';
  const pc = Object.values(S.pend).reduce((a, b) => a + b, 0);
  $('menu').innerHTML = S.user
    ? `<button type="button" data-page="home" role="menuitem">Beranda</button>${staffApps().length ? `<button type="button" data-page="set" role="menuitem">Akses & Bagikan${pc ? ` (${pc})` : ''}</button>` : ''}<button type="button" data-page="guide" role="menuitem">Panduan</button><button type="button" id="outBtn" role="menuitem">Keluar</button>`
    : `<button type="button" id="inBtn" role="menuitem">Masuk</button>`;
}

// ---------- masuk & undangan ----------
function inviteBox() {
  const L = S.invite; if (!L || !L.length) return '';
  const ok = L.filter((v) => v.status === 'ok'), bad = L.length - ok.length;
  if (!ok.length) return `<div class="nb warn"><b>Link undangan tidak berlaku</b> (sudah dicabut, kedaluwarsa, atau tidak dikenal). Minta link baru kepada Pemilik atau Editor yang membagikannya.</div>`;
  const v = ok[0];
  return `<div class="invite"><span class="chip ${v.role === 'viewer' ? 'vw' : ''}">Undangan ${ROLE_L[v.role]}</span><h3>${ok.length > 1 ? `${ok.length} web monitoring` : esc((subOf(v.app_id) || {}).portal + ' · ' + (subOf(v.app_id) || {}).name)}</h3>${ok.length > 1 ? `<p>${ok.map((x) => { const sb = subOf(x.app_id); return esc(sb ? sb.name : x.app_id) + ` (${ROLE_L[x.role]})`; }).join(' · ')}</p>` : ''}<p>Undangan ini untuk email <b>${esc(v.email_hint)}</b>. Masuk dengan email tersebut untuk menerima akses.${bad ? ` ${bad} link lain sudah tidak berlaku.` : ''}</p></div>`;
}
function loginHtml() {
  return `<div class="lock lgc"><span class="lg">M</span><h2>Masuk</h2><p>Gunakan email yang diundang atau didaftarkan Pemilik.</p>${inviteBox()}
    <form id="lgForm" class="lf" novalidate><label for="lg_e">Email</label><input id="lg_e" type="email" autocomplete="email" required placeholder="nama@email.com"><label for="lg_p">Password (opsional)</label><input id="lg_p" type="password" autocomplete="current-password" placeholder="Kosongkan untuk menerima link masuk lewat email"><button type="submit" class="btn btn-p">Masuk</button></form>
    <p class="small">Belum punya akses? Minta Pemilik atau Editor membagikan link undangan ke email Anda.</p></div>`;
}
async function doLogin(e) {
  e.preventDefault(); const em = $('lg_e').value.trim().toLowerCase(), pw = $('lg_p').value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { toast('Format email belum benar.', true); return; }
  const r = pw ? await S.sb.auth.signInWithPassword({ email: em, password: pw }) : await S.sb.auth.signInWithOtp({ email: em, options: { emailRedirectTo: BASE, shouldCreateUser: true } });
  if (r.error) { toast(/invalid login/i.test(r.error.message) ? 'Email atau password salah.' : /rate|seconds/i.test(r.error.message) ? 'Terlalu sering meminta link. Tunggu beberapa menit.' : 'Gagal masuk: ' + r.error.message, true); return; }
  toast(pw ? 'Berhasil masuk.' : `Link masuk dikirim ke ${em}. Buka email lalu klik linknya.`);
}
function resultBox() {
  const L = S.inviteRes; if (!L || !L.length) return '';
  const nm = (r) => r.sub ? `${r.sub.portal} · ${r.sub.name}` : 'web';
  const ok = L.filter((r) => r.status === 'ok'), rq = L.filter((r) => r.status === 'requested'), bad = L.filter((r) => r.status !== 'ok' && r.status !== 'requested');
  let h = '';
  if (ok.length) h += `<div class="nb ok"><b>Akses diterima.</b> ${ok.map((r) => `${esc(nm(r))} (${ROLE_L[r.role] || r.role})`).join(', ')}.${ok.length === 1 && ok[0].sub ? ` <a href="${esc(ok[0].sub.url)}" class="btn btn-p btn-s">Buka sekarang →</a>` : ' Pilih web di bawah untuk membuka.'} <button type="button" class="btn btn-g btn-s" data-dismiss>Tutup</button></div>`;
  if (rq.length) h += `<div class="nb warn"><b>Email Anda berbeda dengan email undangan.</b> Permintaan akses Pelihat untuk ${rq.map((r) => esc(nm(r))).join(', ')} sudah dikirim ke Pemilik/Editor. Anda bisa membuka setelah disetujui. <button type="button" class="btn btn-g btn-s" data-dismiss>Tutup</button></div>`;
  if (bad.length) h += `<div class="nb warn"><b>${bad.length} link undangan tidak bisa dipakai</b> (dicabut, kedaluwarsa, atau tidak dikenal). Minta link baru. <button type="button" class="btn btn-g btn-s" data-dismiss>Tutup</button></div>`;
  return h;
}

// ---------- bagikan link menyeluruh (beberapa web sekaligus) ----------
function shareAll() {
  const list = staffApps(); if (!list.length) return;
  const own = list.some((x) => roleOf(x.app) === 'owner');
  modal(`${mh('Bagikan link menyeluruh', 'Satu link untuk beberapa web')}<div class="nb">Centang web yang boleh dibuka. Penerima cukup membuka <b>satu link</b> dan masuk dengan emailnya. Link hanya berlaku untuk email yang Anda isi.${own ? '' : ' Sebagai Editor, Anda hanya bisa membagikan link <b>Pelihat</b>.'}</div><form id="saForm" class="lf" novalidate>
    <label for="sa_e">Email penerima</label><input id="sa_e" type="email" required placeholder="nama@email.com" autocomplete="off">
    <label>Bagikan sebagai</label><div class="seg2" role="group" aria-label="Peran">${own ? '<button type="button" data-sar="editor" aria-pressed="false">Editor (bisa mengubah)</button>' : ''}<button type="button" data-sar="viewer" aria-pressed="true">Pelihat (hanya melihat)</button></div>
    <label>Web yang dibagikan</label><div class="ckl"><label class="all"><input type="checkbox" id="saAll" checked> <b>Semua web</b></label>${list.map((x) => `<label><input type="checkbox" data-saapp="${x.app}" checked> ${esc(x.portal + ' · ' + x.name)} <small>${ROLE_L[roleOf(x.app)]}</small></label>`).join('')}</div>
    <div id="saOut"></div>${acts('Buat Link')}</form>`);
  let role = 'viewer';
  $('saForm').addEventListener('click', (e) => { const b = e.target.closest('[data-sar]'); if (!b) return; role = b.dataset.sar; $('saForm').querySelectorAll('[data-sar]').forEach((x) => x.setAttribute('aria-pressed', x === b)); });
  $('saForm').addEventListener('change', (e) => { if (e.target.id === 'saAll') $('saForm').querySelectorAll('[data-saapp]').forEach((c) => { c.checked = e.target.checked; }); else if (e.target.dataset.saapp) $('saAll').checked = [...$('saForm').querySelectorAll('[data-saapp]')].every((c) => c.checked); });
  $('saForm').onsubmit = async (e) => {
    e.preventDefault(); const em = $('sa_e').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { toast('Format email belum benar.', true); return; }
    const apps = [...$('saForm').querySelectorAll('[data-saapp]:checked')].map((c) => c.dataset.saapp).filter((a) => role === 'viewer' || roleOf(a) === 'owner');
    if (!apps.length) { toast('Centang minimal satu web.', true); return; }
    const btn = $('saForm').querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Membuat link…';
    const toks = [], fail = [];
    for (const a of apps) { const { data, error } = await S.sb.rpc('kta_invite_create', { p_app: a, p_email: em, p_role: role }); if (error || !data) fail.push(subOf(a).name); else toks.push(data); }
    btn.disabled = false; btn.textContent = 'Buat Link Lain';
    if (!toks.length) { toast('Gagal membuat link: ' + fail.join(', '), true); return; }
    const link = BASE + '?i=' + toks.join('.'), names = apps.filter((a) => !fail.includes(subOf(a).name)).map((a) => subOf(a).name).join(', ');
    const body = `Halo,\n\nAnda diundang sebagai ${ROLE_L[role]} di Monitoring (${names}).\nBuka link berikut lalu masuk dengan email ${em}:\n${link}\n\nLink hanya berlaku untuk email ini dan aktif 30 hari.`;
    $('saOut').innerHTML = `<div class="shl"><input type="text" id="shUrl" readonly value="${esc(link)}" aria-label="Link undangan"><button type="button" class="btn btn-p" id="shCopy">Salin Link</button></div><div class="row l"><a class="btn btn-g btn-s" href="mailto:${esc(em)}?subject=${encodeURIComponent('Undangan ' + ROLE_L[role] + ' Monitoring')}&body=${encodeURIComponent(body)}">Kirim lewat email</a><a class="btn btn-g btn-s" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(body)}">Kirim lewat WhatsApp</a></div><p class="small">Satu link untuk <b>${esc(em)}</b> sebagai <b>${ROLE_L[role]}</b>: ${esc(names)}. Aktif 30 hari.${fail.length ? ` Gagal: ${esc(fail.join(', '))}.` : ''}</p>`;
    $('sa_e').value = ''; Object.keys(S.acc).forEach((a) => loadAccess(a));
  };
}

// ---------- bagikan link ----------
function shareForm(app) {
  const r = roleOf(app), s = subOf(app); if (!['owner', 'editor'].includes(r)) return;
  modal(`${mh('Bagikan link', esc(s.portal + ' · ' + s.name))}<div class="nb">Link hanya berlaku untuk <b>email yang Anda isi</b>. Jika diteruskan ke orang lain, orang itu harus minta izin dulu.${r === 'editor' ? ' Sebagai Editor, Anda hanya bisa membagikan link <b>Pelihat</b>.' : ''}</div><form id="shForm" class="lf" novalidate>
    <label for="sh_e">Email penerima</label><input id="sh_e" type="email" required placeholder="nama@email.com" autocomplete="off">
    <label>Bagikan sebagai</label><div class="seg2" role="group" aria-label="Peran">${r === 'owner' ? '<button type="button" data-shr="editor" aria-pressed="false">Editor (bisa mengubah)</button>' : ''}<button type="button" data-shr="viewer" aria-pressed="true">Pelihat (hanya melihat)</button></div>
    <div id="shOut"></div>${acts('Buat Link')}</form>`);
  let role = 'viewer';
  $('shForm').addEventListener('click', (e) => { const b = e.target.closest('[data-shr]'); if (!b) return; role = b.dataset.shr; $('shForm').querySelectorAll('[data-shr]').forEach((x) => x.setAttribute('aria-pressed', x === b)); });
  $('shForm').onsubmit = async (e) => {
    e.preventDefault(); const em = $('sh_e').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { toast('Format email belum benar.', true); return; }
    const { data, error } = await S.sb.rpc('kta_invite_create', { p_app: app, p_email: em, p_role: role });
    if (error) { toast('Gagal: ' + error.message, true); return; }
    const link = BASE + '?i=' + data, subj = `Undangan ${ROLE_L[role]} ${s.portal} ${s.name}`;
    const body = `Halo,\n\nAnda diundang sebagai ${ROLE_L[role]} di ${s.portal} · ${s.name}.\nBuka link berikut lalu masuk dengan email ${em}:\n${link}\n\nLink hanya berlaku untuk email ini dan aktif 30 hari.`;
    $('shOut').innerHTML = `<div class="shl"><input type="text" id="shUrl" readonly value="${esc(link)}" aria-label="Link undangan"><button type="button" class="btn btn-p" id="shCopy">Salin Link</button></div><div class="row l"><a class="btn btn-g btn-s" href="mailto:${esc(em)}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}">Kirim lewat email</a><a class="btn btn-g btn-s" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(body)}">Kirim lewat WhatsApp</a></div><p class="small">Link untuk <b>${esc(em)}</b> sebagai <b>${ROLE_L[role]}</b>, aktif 30 hari.</p>`;
    $('shForm').querySelector('[type=submit]').textContent = 'Buat Link Lain'; $('sh_e').value = '';
    if (S.acc[app]) loadAccess(app);
  };
}

// ---------- Pengaturan: akses & izin ----------
function pageSet() {
  const list = staffApps();
  const head = (t, d) => `<div class="sethead"><div><div class="eb">Pengaturan</div><h1 class="h1s">${t}</h1><p class="sub">${d}</p></div><button type="button" class="btn btn-g" data-page="home">← Kembali</button></div>`;
  if (!list.length) return head('Akses & Bagikan', 'Hanya Pemilik dan Editor yang bisa membagikan link.') + `<div class="sgrid"><div class="scard">${roleInfo()}</div></div>`;
  if (!list.find((s) => s.app === ui.app)) ui.app = list[0].app;
  const app = ui.app, r = roleOf(app), A = S.acc[app];
  if (!A) loadAccess(app);
  const seg = `<div class="seg2 big" role="group" aria-label="Pilih web">${list.map((x) => `<button type="button" data-akses="${x.app}" aria-pressed="${x.app === app}">${esc((x.app === 'apd' ? 'APD' : 'MPP') + ' · ' + x.name)}${S.pend[x.app] ? ` <span class="ct">${S.pend[x.app]}</span>` : ''}</button>`).join('')}</div>`;
  const top = head('Akses & Bagikan', 'Pemilik membagikan link Editor atau Pelihat. Editor hanya bisa membagikan link Pelihat. Semua link wajib login dengan email yang diundang.') + `<div class="nb"><b>Ingin membagikan semua web sekaligus?</b> Satu link untuk satu email, langsung bisa membuka semua web yang dicentang. <button type="button" class="btn btn-p btn-s" data-shareall>Bagikan link menyeluruh</button></div>` + seg;
  if (!A || A.members === null) return top + '<div class="lock"><p>Memuat…</p></div>';
  const pend = A.reqs.filter((q) => q.status === 'pending');
  const reqC = `<div class="scard"><div class="sch"><div><div class="eb2">Permintaan</div><h2>Permintaan Akses</h2><p class="small">Orang yang membuka link bukan untuk emailnya, atau meminta akses dari halaman terkunci. Disetujui = Pelihat.</p></div><span class="rolepill">${pend.length} menunggu</span></div><div class="al">${pend.map((q) => `<div><span class="em">${esc(q.email)}</span><small class="small">${when(q.requested_at)}${q.token ? ' · dari link undangan' : ''}</small><button type="button" class="btn btn-p btn-s" data-dec="1|${q.id}">Setujui</button><button type="button" class="rm" data-dec="0|${q.id}">Tolak</button></div>`).join('') || '<div class="small">Tidak ada permintaan.</div>'}</div></div>`;
  const memC = `<div class="scard"><div class="sch"><div><div class="eb2">Anggota</div><h2>Siapa yang punya akses</h2><p class="small">${r === 'owner' ? 'Ubah peran atau hapus akses. Menghapus juga mencabut undangan yang belum dipakai.' : 'Hanya Pemilik yang bisa mengubah peran atau menghapus anggota.'}</p></div><button type="button" class="btn btn-p btn-s" data-share="${app}">+ Bagikan link</button></div><div class="al">${A.members.map((m) => `<div><span class="em">${esc(m.email)}</span>${r === 'owner' && m.role !== 'owner' ? `<select data-mrole="${esc(m.email)}" aria-label="Peran ${esc(m.email)}"><option value="editor" ${m.role === 'editor' ? 'selected' : ''}>Editor</option><option value="viewer" ${m.role === 'viewer' ? 'selected' : ''}>Pelihat</option></select><button type="button" class="rm" data-mrm="${esc(m.email)}">Hapus</button>` : chip(m.role)}</div>`).join('')}</div></div>`;
  const st = (i) => i.revoked ? ['Dicabut', 'no'] : i.used_at ? ['Dipakai', 'ok'] : new Date(i.expires_at) < new Date() ? ['Kedaluwarsa', 'no'] : ['Aktif', 'hd'];
  const invC = `<div class="scard wide2"><div class="sch"><div><div class="eb2">Link</div><h2>Link Undangan</h2><p class="small">Setiap link terikat ke satu email. Cabut link yang belum dipakai jika salah kirim.</p></div></div><div class="tw2"><table class="tb2"><thead><tr><th>Email</th><th>Sebagai</th><th>Dibuat oleh</th><th>Dibuat</th><th>Status</th><th></th></tr></thead><tbody>${A.inv.map((i) => { const [l, c] = st(i); return `<tr><td><b>${esc(i.email)}</b></td><td>${ROLE_L[i.role]}</td><td>${esc(i.created_by)}</td><td class="nw">${when(i.created_at)}</td><td><span class="stt ${c}">${l}</span></td><td class="nw">${l === 'Aktif' ? `<button type="button" class="btn btn-g btn-s" data-copyinv="${esc(i.token)}">Salin</button> <button type="button" class="rm" data-revoke="${esc(i.token)}">Cabut</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="6" class="small">Belum ada link undangan.</td></tr>'}</tbody></table></div></div>`;
  return top + `<div class="sgrid">${reqC}${memC}${invC}${r === 'owner' ? permCard(app, A) : ''}<div class="scard wide2">${roleInfo()}</div></div>`;
}
function roleInfo() {
  return `<div class="sch"><div><div class="eb2">Peran</div><h2>Pemilik, Editor & Pelihat</h2></div></div><div class="role"><b>Pemilik</b><span>Semua hak: data, stok, persetujuan, link Editor/Pelihat, dan izin menu.</span></div><div class="role"><b>Editor</b><span>Mengisi & mengubah data di site yang diberikan, dan membagikan link Pelihat.</span></div><div class="role"><b>Pelihat</b><span>Hanya melihat menu yang diizinkan. Print & unduh mengikuti izin Pemilik.</span></div>`;
}
function permVal(perms, role, id, k) { const p = ((perms || {})[role] || {})[id]; if (p && typeof p[k] === 'boolean') return p[k]; return k === 'v' ? true : role === 'editor'; }
function permCard(app, A) {
  const rows = menusOf(app).map(([id, l, fixed]) => `<tr><td><b>${esc(l)}</b></td>${['editor', 'viewer'].map((role) => ['v', 'd'].map((k) => { const lock = k === 'v' && fixed; return `<td class="c"><input type="checkbox" data-perm="${role}|${id}|${k}" ${permVal(A.perms, role, id, k) ? 'checked' : ''} ${lock ? 'disabled title="Selalu terlihat"' : ''} aria-label="${ROLE_L[role]} ${k === 'v' ? 'lihat' : 'unduh'} ${esc(l)}"></td>`; }).join('')).join('')}</tr>`).join('');
  return `<div class="scard wide2"><div class="sch"><div><div class="eb2">Khusus Pemilik</div><h2>Izin Menu & Unduh · ${esc(subOf(app).name)}</h2><p class="small"><b>Lihat</b> = menu tampil. <b>Unduh</b> = boleh Print / PDF / Excel di menu itu. Pemilik selalu bisa semuanya.</p></div><button type="button" class="btn btn-p" id="permSave" data-app="${app}">Simpan Izin</button></div>
    <div class="tw2"><table class="tb2 perm"><thead><tr><th rowspan="2">Menu</th><th colspan="2" class="c">Editor</th><th colspan="2" class="c">Pelihat</th></tr><tr><th class="c">Lihat</th><th class="c">Unduh</th><th class="c">Lihat</th><th class="c">Unduh</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
async function savePerms(app) {
  const perms = { editor: {}, viewer: {} };
  document.querySelectorAll('[data-perm]').forEach((c) => { const [role, id, k] = c.dataset.perm.split('|'); (perms[role][id] = perms[role][id] || {})[k] = c.disabled ? true : c.checked; });
  const { error } = await S.sb.from('kta_app_perms').upsert({ app_id: app, perms, updated_at: new Date().toISOString(), updated_by: S.user.email }, { onConflict: 'app_id' });
  if (error) { toast('Gagal menyimpan izin: ' + error.message, true); return; }
  S.acc[app].perms = perms; toast('Izin menu ' + subOf(app).name + ' tersimpan. Berlaku saat web dibuka ulang.');
}
function pageGuide() {
  const g = [
    ['Satu pintu', 'Semua web dibuka dari halaman MONITORING. Masuk sekali dengan email, lalu klik Buka pada site yang diinginkan.'],
    ['Peran', 'Pemilik: semua hak. Editor: mengisi & mengubah data di site yang diberikan, membagikan link Pelihat. Pelihat: hanya melihat menu yang diizinkan.'],
    ['Bagikan link', 'Klik Bagikan link pada kartu site, isi email penerima, pilih Editor atau Pelihat (Editor hanya bisa Pelihat), lalu salin atau kirim lewat email / WhatsApp. Link hanya berlaku untuk email itu.'],
    ['Link diteruskan / alamat disalin', 'Membuka alamat web langsung atau link milik orang lain tidak membuka data. Orang tersebut harus masuk, lalu permintaannya muncul di Akses & Bagikan untuk disetujui.'],
    ['Izin menu & unduh', 'Pemilik mengatur per web di Pengaturan → Akses & Bagikan → Izin Menu & Unduh, terpisah untuk Editor dan Pelihat.'],
    ['Mencabut akses', 'Pemilik: Pengaturan → Anggota → Hapus, atau Cabut pada link yang belum dipakai.'],
  ];
  return `<div class="sethead"><div><div class="eb">Panduan</div><h1 class="h1s">Cara memakai</h1></div><button type="button" class="btn btn-g" data-page="home">← Kembali</button></div><div class="sgrid"><div class="scard wide2"><ol class="gd">${g.map((x) => `<li><b>${x[0]}</b><span>${x[1]}</span></li>`).join('')}</ol></div></div>`;
}
function goPage(p, app) { ui.page = p; if (app) ui.app = app; try { history.replaceState(null, '', p === 'home' ? location.pathname : '#' + (p === 'set' ? 'akses' + (ui.app ? ':' + ui.app : '') : 'panduan')); } catch (e) {} $('menu').hidden = true; render(); window.scrollTo({ top: 0 }); }

// ---------- event ----------
document.addEventListener('click', async (e) => {
  const c = (s) => e.target.closest(s);
  if (c('[data-close]') || e.target.id === 'modal') { closeModal(); return; }
  if (c('#whoBtn')) { const m = $('menu'); m.hidden = !m.hidden; $('whoBtn').setAttribute('aria-expanded', !m.hidden); return; }
  if (!c('#who')) $('menu').hidden = true;
  const pg = c('[data-page]'); if (pg) { goPage(pg.dataset.page); return; }
  if (c('#setBtn')) { goPage('set'); return; }
  if (c('#saBtn') || c('[data-shareall]')) { shareAll(); return; }
  if (c('#prBtn')) { window.print(); return; }
  if (c('#outBtn')) { await S.sb.auth.signOut(); return; }
  if (c('#inBtn')) { goPage('home'); setTimeout(() => $('lg_e') && $('lg_e').focus(), 50); return; }
  if (c('[data-dismiss]')) { S.inviteRes = null; render(); return; }
  const si = c('[data-site]'); if (si) { try { localStorage.setItem('kta-site:kmb', si.dataset.site); } catch (er) {} return; }
  const sh = c('[data-share]'); if (sh) { shareForm(sh.dataset.share); return; }
  const ak = c('[data-akses]'); if (ak) { goPage('set', ak.dataset.akses); return; }
  if (c('#shCopy')) { try { await navigator.clipboard.writeText($('shUrl').value); toast('Link disalin.'); } catch (er) { $('shUrl').select(); toast('Tekan Ctrl+C untuk menyalin.'); } return; }
  const ci = c('[data-copyinv]'); if (ci) { const u = BASE + '?i=' + ci.dataset.copyinv; try { await navigator.clipboard.writeText(u); toast('Link disalin.'); } catch (er) { prompt('Salin link:', u); } return; }
  const rv = c('[data-revoke]'); if (rv) { const { error } = await S.sb.rpc('kta_invite_revoke', { p_token: rv.dataset.revoke }); if (error) toast('Gagal: ' + error.message, true); else { toast('Link dicabut.'); loadAccess(ui.app); } return; }
  const dc = c('[data-dec]'); if (dc) { const [ok, id] = dc.dataset.dec.split('|'); const { error } = await S.sb.rpc('kta_access_decide', { p_id: id, p_ok: ok === '1' }); if (error) toast('Gagal: ' + error.message, true); else { toast(ok === '1' ? 'Disetujui sebagai Pelihat.' : 'Permintaan ditolak.'); loadAccess(ui.app); loadPending(); } return; }
  const mr = c('[data-mrm]'); if (mr && isOwner()) {
    const em = mr.dataset.mrm, app = ui.app;
    modal(`${mh('Hapus akses', esc(em))}<p class="small">Orang ini tidak bisa lagi membuka ${esc(subOf(app).portal + ' · ' + subOf(app).name)}. Link undangan miliknya yang belum dipakai ikut dicabut.</p><form id="rmForm">${acts('Hapus Akses')}</form>`);
    $('rmForm').onsubmit = async (ev) => { ev.preventDefault(); const r1 = await S.sb.from('app_access_roles').delete().eq('app_id', app).eq('email', em).neq('role', 'owner'); if (r1.error) { toast('Gagal: ' + r1.error.message, true); return; } await S.sb.rpc('kta_member_revoke_invites', { p_app: app, p_email: em }); closeModal(); toast(em + ' dihapus.'); loadAccess(app); };
    return;
  }
  const ps = c('#permSave'); if (ps && isOwner()) { savePerms(ps.dataset.app); return; }
});
document.addEventListener('change', async (e) => {
  const m = e.target.dataset && e.target.dataset.mrole; if (!m || !isOwner()) return;
  const { error } = await S.sb.rpc('kta_member_set', { p_app: ui.app, p_email: m, p_role: e.target.value });
  if (error) toast('Gagal: ' + error.message, true); else { toast(`${m} sekarang ${ROLE_L[e.target.value]}.`); loadAccess(ui.app); }
});
document.addEventListener('submit', (e) => { if (e.target.id === 'lgForm') doLogin(e); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!$('modal').hidden) closeModal(); $('menu').hidden = true; } });

// ---------- start ----------
async function boot() {
  await peekInvite();
  await redeemInvite();
  await loadApps();
  S.loaded = true; render();
  const IR = S.inviteRes; if (IR && IR.length === 1 && IR[0].status === 'ok' && IR[0].sub) setTimeout(() => { if (S.inviteRes) location.href = IR[0].sub.url; }, 2500);
}
async function init() {
  render();
  if (!window.supabase || !window.supabase.createClient) { S.loaded = true; render(); toast('Tidak bisa terhubung ke server. Periksa koneksi lalu muat ulang.', true); return; }
  S.sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'kta-web-auth' } });
  try { const { data } = await S.sb.auth.getSession(); S.user = (data && data.session && data.session.user) || null; } catch (e) {}
  await boot();
  S.sb.auth.onAuthStateChange((ev, s) => { const nu = (s && s.user) || null; if ((nu && nu.email) === (S.user && S.user.email)) return; S.user = nu; S.acc = {}; S.inviteRes = null; S.rows = null; S.apd = null; setTimeout(async () => { await boot(); if (ev === 'SIGNED_IN') toast('Masuk sebagai ' + nu.email + '.'); if (ev === 'SIGNED_OUT') toast('Anda sudah keluar.'); }, 0); });
}
init();
