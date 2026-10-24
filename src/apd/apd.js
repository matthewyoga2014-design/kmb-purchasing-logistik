// ================= Monitoring APD KMB — template & aturan akses sama dengan Monitoring Manpower =================
const CFG = { url: 'https://yoviojbfyvgpllxisjvy.supabase.co', key: 'sb_publishable_I26enb2Kz8iF4WFdH8vixA_8kek-kM9' };
const OWNER = 'matthewyoga2014@gmail.com', APP = 'apd';
// jenis APD bawaan; Pemilik bisa menambah jenis lain di Pengaturan → Jenis APD
const DEF_TYPES = [
  { code: 'HELM', label: 'Helm Safety', vlabel: 'Warna Helm (All Size)', variants: ['Putih', 'Kuning', 'Biru'], color: '#F5A524', desc: 'Pelindung kepala saat bekerja' },
  { code: 'KAOS', label: 'Kaos Kerja', vlabel: 'Ukuran Kaos', variants: ['S', 'M', 'L', 'XL'], color: '#EF4F5F', desc: 'Seragam kerja lapangan KMB' },
  { code: 'SEPATU', label: 'Sepatu Safety', vlabel: 'Ukuran Sepatu', variants: ['6', '7', '8', '9', '10'], color: '#7C3AED', desc: 'Pelindung kaki keselamatan' },
];
const DEF_IMG = { HELM: 'helm.svg', KAOS: 'kaos.svg', SEPATU: 'sepatu.svg' };
const PALETTE = ['#0EA5E9', '#16A34A', '#DB2777', '#EA580C', '#0D9488', '#9333EA', '#CA8A04', '#475569'];
let TYPES = [], VARIANTS = {}, ART = {}, WH = [];
const SRC_LABEL = { OLD: 'APD Lama', NEW: 'APD Baru', REUSE: 'APD Bekas Layak', EXTERNAL: 'APD dari Pihak Luar' };
const REQ_ST = { pending: ['Menunggu', 'hd'], approved: ['Disetujui', 'pr'], fulfilled: ['Selesai dibagikan', 'ok'], rejected: ['Ditolak', 'no'], cancelled: ['Dibatalkan', 'no'] };
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const HELM_DOT = { Putih: '#FFFFFF', Kuning: '#F5C518', Biru: '#2563EB' };

const S = { perms: {}, asked: false, sb: null, user: null, role: '', state: null, revision: 0, ver: null, people: [], access: null, audit: null, share: null, grant: null, grants: null, saving: false, noAccess: false, loaded: false };
const ui = { page: 'dashboard', person: '', q: '', site: 'ALL', period: 'bulanan', year: new Date().getFullYear(), hq: '', ht: 'ALL', wh: 'ALL', rq: 'pending' };
// link anonim ?k= tidak dipakai lagi: semua wajib masuk dengan email yang diundang (Pusat Monitoring)
const SHARE_KEY = '', HUB = '../';
(function () {
  try { localStorage.removeItem('kta-share:' + APP); const u = new URL(location.href); if (u.searchParams.has('k')) { u.searchParams.delete('k'); history.replaceState(null, '', u.pathname + u.search + u.hash); } } catch (e) {}
  try { const h = (location.hash || '').slice(1); if (h) ui.page = h; } catch (e) {}
})();

// ---------- util ----------
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = (x) => Array.isArray(x) ? x : [];
const qty = (x) => Number(x) || 0;
const today = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const fmt = (s) => { if (!s) return '—'; const d = new Date(String(s).slice(0, 10) + 'T00:00:00'); return isNaN(d) ? esc(s) : `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now() + Math.random().toString(16).slice(2));
const cleanName = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('id-ID');
const title = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const can = () => S.role === 'owner' || (S.role === 'editor' && (typeof permOf !== 'function' || permOf(ui.page, 'e')));
const isOwner = () => S.role === 'owner';
// izin menu & unduh dari Pemilik (Pusat Monitoring). detail karyawan mengikuti menu Manpower Aktif.
const PERM_FIXED = ['dashboard', 'setting'];
function permOf(id, k) {
  if (S.role === 'owner') return true; if (S.role !== 'editor' && S.role !== 'viewer') return false;
  id = id === 'detail' ? 'people' : id;
  if (k === 'v' && PERM_FIXED.includes(id)) return true;
  const p = ((S.perms || {})[S.role] || {})[id]; if (p && typeof p[k] === 'boolean') return p[k];
  return k === 'v' ? true : S.role === 'editor';
}
const variant = (x) => x.variant || 'BELUM DIISI';
const tLabel = (t) => (ART[t] || {}).label || t;
const vText = (t, v) => v === 'BELUM DIISI' ? 'Belum diisi' : t === 'HELM' ? v : /^\d+$/.test(v) ? 'No. ' + v : v;
function addMonths(date, months) {
  const [y, m, d] = String(date || '').split('-').map(Number); if (!y || !m || !d) return '';
  const n = Math.max(1, Math.min(120, Number(months) || 6)); const dt = new Date(y, m - 1 + n, 1), last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  dt.setDate(Math.min(d, last)); return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}
const daysUntil = (d) => d ? Math.round((new Date(d + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 864e5) : Infinity;
let toastT; function toast(msg, err) { const t = $('toast'); t.textContent = msg; t.className = err ? 'err' : ''; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, err ? 6000 : 3500); }
function genImg(code, color) {
  const ini = String(code).slice(0, 2);
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><path d="M60 8l42 16v30c0 28-18 48-42 58C36 102 18 82 18 54V24z" fill="${color}" opacity=".18"/><path d="M60 16l34 13v25c0 23-14 40-34 49-20-9-34-26-34-49V29z" fill="${color}"/><text x="60" y="72" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" font-weight="700" fill="#fff">${ini}</text></svg>`);
}
function empty() { return normalize({}); }
function normalize(v) {
  v = v || {};
  const types = arr(v.types).length ? arr(v.types).filter((t) => t && t.code).map((t) => ({ code: String(t.code), label: String(t.label || t.code), vlabel: String(t.vlabel || 'Ukuran'), variants: arr(t.variants).map(String).filter(Boolean), color: t.color || '#64748B', desc: String(t.desc || ''), unit: String(t.unit || (t.code === 'SEPATU' ? 'Pasang' : 'Pcs')), price: Math.max(0, Number(t.price) || 0) })) : JSON.parse(JSON.stringify(DEF_TYPES)).map((t) => ({ ...t, unit: t.code === 'SEPATU' ? 'Pasang' : 'Pcs', price: 0 }));
  const codes = types.map((t) => t.code);
  const d = { types, stockIn: arr(v.stockIn), receipts: arr(v.receipts), returns: arr(v.returns), adjust: arr(v.adjust), transfers: arr(v.transfers), requests: arr(v.requests),
    limits: Object.fromEntries(codes.map((t) => [t, Math.max(0, Number(v.limits && v.limits[t]) || 0)])),
    images: Object.fromEntries(codes.filter((t) => typeof (v.images && v.images[t]) === 'string' && v.images[t].startsWith('data:image/')).map((t) => [t, v.images[t]])),
    personOverrides: v.personOverrides && typeof v.personOverrides === 'object' && !Array.isArray(v.personOverrides) ? v.personOverrides : {},
    dashboardLayout: v.dashboardLayout, ga: gaNorm(v.ga), warehouses: arr(v.warehouses).map(String).filter(Boolean) };
  // gudang: daftar tersimpan + semua lokasi yang pernah dipakai (data lama tetap terbaca)
  const used = [...d.stockIn.map((x) => x.location), ...d.adjust.map((x) => x.location), ...d.receipts.filter((x) => x.source === 'NEW' || x.source === 'REUSE').map((x) => x.warehouse), ...d.transfers.flatMap((x) => [x.from, x.to])].map((x) => String(x || '').trim()).filter(Boolean);
  d.warehouses = [...new Set([...(d.warehouses.length ? d.warehouses : ['Workshop']), ...used])];
  return d;
}
function applyTypes() {
  const st = S.state;
  TYPES = st.types.map((t) => t.code); VARIANTS = {}; ART = {};
  st.types.forEach((t) => { VARIANTS[t.code] = t.variants; ART[t.code] = { label: t.label, vlabel: t.vlabel, color: t.color, desc: t.desc, img: st.images[t.code] || DEF_IMG[t.code] || genImg(t.code, t.color) }; });
  WH = st.warehouses;
}
const whOf = (x) => { const w = String(x || '').trim(); return w || WH[0] || 'Workshop'; };

// ---------- buku stok per gudang ----------
// setiap gerakan stok: jenis, ukuran/warna, kondisi (NEW / REUSE), gudang, jumlah (+/-)
function moves(d = S.state) {
  const m = [];
  d.stockIn.forEach((x) => m.push({ date: x.date, p: 0, t: x.type, v: variant(x), g: x.grade === 'REUSE' ? 'REUSE' : 'NEW', w: whOf(x.location), n: qty(x.qty) }));
  d.adjust.forEach((x) => m.push({ date: x.date, p: qty(x.qty) > 0 ? 0 : 3, t: x.type, v: variant(x), g: x.grade === 'REUSE' ? 'REUSE' : 'NEW', w: whOf(x.location), n: qty(x.qty) }));
  d.transfers.forEach((x) => { m.push({ date: x.date, p: 1.5, t: x.type, v: variant(x), g: x.grade === 'REUSE' ? 'REUSE' : 'NEW', w: whOf(x.from), n: -qty(x.qty) }); m.push({ date: x.date, p: 1.6, t: x.type, v: variant(x), g: x.grade === 'REUSE' ? 'REUSE' : 'NEW', w: whOf(x.to), n: qty(x.qty) }); });
  d.returns.forEach((x) => { const r = d.receipts.find((y) => y.id === x.receiptId); if (r && x.action === 'REUSE') m.push({ date: x.date, p: 1, t: r.type, v: variant(r), g: 'REUSE', w: whOf(x.warehouse || (r.source === 'NEW' || r.source === 'REUSE' ? r.warehouse : '')), n: qty(x.qty) }); });
  d.receipts.forEach((x) => { if (x.source === 'NEW' || x.source === 'REUSE') m.push({ date: x.date, p: 2, t: x.type, v: variant(x), g: x.source, w: whOf(x.warehouse), n: -qty(x.qty) }); });
  return m;
}
function stock(type, d = S.state, wh = 'ALL') {
  const v = { NEW: 0, REUSE: 0, DESTROYED: 0 };
  moves(d).forEach((x) => { if (x.t === type && (wh === 'ALL' || x.w === wh)) v[x.g] += x.n; });
  if (wh === 'ALL') d.returns.forEach((x) => { const r = d.receipts.find((y) => y.id === x.receiptId); if (r && r.type === type && x.action === 'DESTROY') v.DESTROYED += qty(x.qty); });
  return v;
}
function variantStocks(t, d = S.state, wh = 'ALL') {
  const z = {}; [...(VARIANTS[t] || []), 'BELUM DIISI'].forEach((v) => { z[v] = { NEW: 0, REUSE: 0 }; });
  moves(d).forEach((x) => { if (x.t === t && (wh === 'ALL' || x.w === wh)) { if (!z[x.v]) z[x.v] = { NEW: 0, REUSE: 0 }; z[x.v][x.g] += x.n; } });
  return z;
}
const returnedQty = (id, d = S.state) => d.returns.filter((x) => x.receiptId === id).reduce((a, t) => a + qty(t.qty), 0);
const heldLot = (r, d = S.state) => Math.max(0, qty(r.qty) - returnedQty(r.id, d));
const held = (id, type, d = S.state) => d.receipts.filter((r) => r.person === id && (!type || r.type === type)).reduce((a, r) => a + heldLot(r, d), 0);
const latest = (id, type) => S.state.receipts.filter((r) => r.person === id && r.type === type && r.source !== 'OLD').sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)))[0];
const due = (id, type) => { const r = latest(id, type); return r ? addMonths(r.date, r.months) : ''; };
function validate(d) {
  const codes = d.types.map((t) => t.code), vars = Object.fromEntries(d.types.map((t) => [t.code, t.variants]));
  if (new Set(codes).size !== codes.length) return 'Kode jenis APD tidak boleh kembar.';
  for (const x of d.stockIn) if (!codes.includes(x.type) || !['NEW', 'REUSE'].includes(x.grade) || !Number.isInteger(Number(x.qty)) || Number(x.qty) < 1 || !x.date) return 'Tanggal, jenis dan jumlah stok masuk harus valid (minimal 1).';
  for (const x of d.adjust) if (!codes.includes(x.type) || !x.date || !Number.isInteger(Number(x.qty)) || Number(x.qty) === 0) return 'Data koreksi stok tidak valid.';
  for (const x of d.transfers) if (!codes.includes(x.type) || !x.date || !x.from || !x.to || x.from === x.to || !Number.isInteger(Number(x.qty)) || Number(x.qty) < 1) return 'Data mutasi stok tidak valid (gudang asal dan tujuan harus berbeda).';
  for (const x of d.receipts) {
    if (!codes.includes(x.type) || !['OLD', 'NEW', 'REUSE', 'EXTERNAL'].includes(x.source) || !Number.isInteger(Number(x.qty)) || Number(x.qty) < 1 || !x.date || !x.person) return 'Data penerimaan APD belum lengkap.';
    if (x.source !== 'OLD' && (!Number.isInteger(Number(x.months)) || Number(x.months) < 1 || Number(x.months) > 120)) return 'Jatah penggantian harus 1–120 bulan.';
  }
  for (const x of [...d.stockIn, ...d.receipts, ...d.adjust, ...d.transfers]) if (x.variant && x.variant !== 'BELUM DIISI' && !(vars[x.type] || []).includes(x.variant)) return `Ukuran/warna "${x.variant}" tidak ada di jenis ${x.type}.`;
  const back = {};
  for (const x of d.returns) {
    const r = d.receipts.find((y) => y.id === x.receiptId);
    if (!r || !x.date || x.date < r.date) return 'Tanggal pengembalian tidak valid atau catatan asal tidak ada.';
    if (!['REUSE', 'DESTROY'].includes(x.action) || !Number.isInteger(Number(x.qty)) || Number(x.qty) < 1) return 'Jumlah/kondisi pengembalian tidak valid.';
    back[r.id] = (back[r.id] || 0) + Number(x.qty); if (back[r.id] > Number(r.qty)) return 'Jumlah pengembalian melebihi APD yang diterima karyawan.';
  }
  const gi = gaValidate(d.ga, codes); if (gi) return gi;
  const ev = moves(d).sort((a, b) => a.date.localeCompare(b.date) || a.p - b.p), bal = {};
  for (const x of ev) { const k = [x.t, x.v, x.g, x.w].join('|'); bal[k] = (bal[k] || 0) + x.n; if (bal[k] < 0) return `Stok ${x.t} (${x.v === 'BELUM DIISI' ? 'belum diisi' : x.v}, ${x.g === 'NEW' ? 'baru' : 'bekas'}) di gudang ${x.w} tidak mencukupi pada ${fmt(x.date)}.`; }
  return '';
}
const person = (id) => S.people.find((x) => x.id === id);
const personName = (id) => (person(id) || {}).name || title(id);
function schedules() {
  const out = [];
  S.people.filter((x) => x.status === 'AKTIF').forEach((p) => TYPES.forEach((t) => {
    const x = latest(p.id, t); if (!x || held(p.id, t) < 1) return;
    const d = addMonths(x.date, x.months); out.push({ p, t, x, d, days: daysUntil(d) });
  }));
  return out.sort((a, b) => a.d.localeCompare(b.d));
}
// permintaan bisa untuk karyawan atau untuk stok gudang/site
const isStockReq = (r) => r.kind === 'stock';
const reqWho = (r) => isStockReq(r) ? 'Stok ' + (r.warehouse || '') : personName(r.person);
const distributed = () => S.state.receipts.filter((r) => r.source === 'NEW' || r.source === 'REUSE');
const reqOpen = () => S.state.requests.filter((r) => r.status === 'pending' || r.status === 'approved');

// ---------- data dari server ----------
async function loadPeople() {
  const r = await S.sb.rpc('apd_people', { p_key: SHARE_KEY || null });
  if (r.error) throw r.error;
  const seen = new Map();
  (r.data || []).forEach((x) => {
    const id = cleanName(x.nama); if (!id) return;
    const cur = seen.get(id); if (cur && cur.status === 'AKTIF') return;
    seen.set(id, { id, name: title(x.nama), position: x.jabatan || '—', site: x.site || '—', status: x.status === 'OUT' ? 'OUT' : 'AKTIF', fromMp: true });
  });
  S.state.receipts.forEach((r) => { if (r.person && !seen.has(r.person)) seen.set(r.person, { id: r.person, name: title(r.person), position: '—', site: '—', status: 'OUT', fromMp: false }); });
  Object.entries(S.state.personOverrides || {}).forEach(([id, v]) => {
    const p = seen.get(id) || { id, name: title(id), position: '—', site: '—', status: 'AKTIF', fromMp: false };
    seen.set(id, { ...p, name: v.name ? String(v.name) : p.name, position: v.position || p.position, site: v.site || p.site, status: v.status === 'OUT' ? 'OUT' : v.status === 'AKTIF' ? 'AKTIF' : p.status, edited: true });
  });
  S.people = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'id'));
}
async function loadApd() {
  const r = await S.sb.rpc('apd_read', { p_key: SHARE_KEY || null });
  if (r.error) throw r.error;
  const row = (r.data || [])[0];
  S.noAccess = !row;
  if (!row) { S.state = empty(); applyTypes(); return false; }
  S.state = normalize(row.data); applyTypes(); S.revision = Number(row.revision) || 0; S.ver = row.updated_at;
  return true;
}
async function loadAll(silent) {
  try {
    const ok = await loadApd();
    if (ok) await loadPeople(); else S.people = [];
    S.loaded = true;
    if (isOwner()) { loadAudit(); loadGrants(); }
  } catch (e) { if (!silent) toast('Data APD belum bisa dimuat: ' + ((e && e.message) || 'periksa koneksi.'), true); }
  render();
}
async function findRole() {
  S.role = ''; S.grant = null;
  const em = ((S.user && S.user.email) || '').toLowerCase();
  if (!em) return;
  if (em === OWNER) { S.role = 'owner'; return; }
  const r = await S.sb.rpc('kta_member_role', { p_app: APP });
  S.role = (!r.error && typeof r.data === 'string') ? r.data : '';
  if (S.role) { const p = await S.sb.from('kta_app_perms').select('perms').eq('app_id', APP).maybeSingle(); S.perms = (p.data && p.data.perms) || {}; }
  if (S.role === 'viewer') {
    const g = await S.sb.from('kta_print_grants').select('status,requested_at').eq('app_id', APP).eq('email', em).maybeSingle();
    S.grant = g.data || null;
  }
}
const OWNER_KEYS = ['stockIn', 'adjust', 'transfers', 'limits', 'images', 'types', 'warehouses', 'ga'];
function editorGuard(next) {
  // Editor tidak boleh mengubah gudang/stok/jenis APD, dan hanya boleh: mengajukan permintaan baru,
  // membatalkan permintaannya sendiri yang masih menunggu, atau menandai permintaan disetujui sebagai selesai.
  for (const k of OWNER_KEYS) if (JSON.stringify(next[k]) !== JSON.stringify(S.state[k])) return 'Stok gudang, gudang, gambar, jenis APD, dan Form GA hanya bisa diubah Pemilik.';
  const before = Object.fromEntries(S.state.requests.map((r) => [r.id, r]));
  for (const r of next.requests) {
    const b = before[r.id];
    if (!b) { if (r.status !== 'pending') return 'Permintaan baru harus berstatus Menunggu.'; continue; }
    if ((b.gaId || '') !== (r.gaId || '')) return 'Form GA Request hanya diatur Pemilik.';
    if (b.status === r.status) continue;
    if (b.status === 'pending' && r.status === 'cancelled' && (b.by || '').toLowerCase() === S.user.email.toLowerCase()) continue;
    if (b.status === 'approved' && r.status === 'fulfilled') continue;
    return 'Persetujuan permintaan APD hanya oleh Pemilik.';
  }
  return '';
}
async function persist(next, msg, audit) {
  if (!can()) { toast('Hanya Pemilik/Editor yang dapat menyimpan data.', true); return false; }
  if (S.saving) return false;
  if (!isOwner()) { const g = editorGuard(next); if (g) { toast(g, true); return false; } }
  const issue = validate(next); if (issue) { toast('Tidak dapat menyimpan: ' + issue, true); return false; }
  S.saving = true; saving(true);
  try {
    const { data, error } = await S.sb.from('apd_state').update({ data: next, revision: S.revision + 1, updated_at: new Date().toISOString(), updated_by: S.user.email }).eq('id', 'main').eq('revision', S.revision).select('revision,updated_at');
    if (error) throw error;
    if (!data || !data.length) { await loadAll(true); toast('Data baru saja diubah orang lain. Data terbaru sudah dimuat, silakan ulangi.', true); return false; }
    S.state = normalize(next); applyTypes(); S.revision = Number(data[0].revision); S.ver = data[0].updated_at;
    if (audit) { try { await S.sb.from('apd_delete_audit').insert({ kind: audit.kind, record_id: audit.id, record_data: audit.data, deleted_by: S.user.email }); } catch (e) {} if (isOwner()) loadAudit(); }
    await loadPeople(); closeModal(); render(); toast(msg || 'Perubahan tersimpan.');
    return true;
  } catch (e) { toast('Gagal menyimpan: ' + ((e && e.message) || 'periksa koneksi.'), true); return false; }
  finally { S.saving = false; saving(false); }
}
function saving(on) { const b = $('syncBtn'); if (b) b.disabled = on; }
async function loadAccess() { const { data } = await S.sb.from('app_access_roles').select('email,role').eq('app_id', APP).order('email'); S.access = data || []; if (ui.page === 'setting') render(); }
async function loadAudit() { const { data } = await S.sb.from('apd_delete_audit').select('kind,record_id,record_data,deleted_by,deleted_at').order('deleted_at', { ascending: false }).limit(500); S.audit = data || []; if (ui.page === 'deleted') render(); }
async function loadShare() { const { data } = await S.sb.from('kta_share_links').select('key').eq('app_id', APP).maybeSingle(); S.share = data || null; if (ui.page === 'setting') render(); }
async function loadGrants() { const { data } = await S.sb.from('kta_print_grants').select('email,status,requested_at,decided_at').eq('app_id', APP).order('requested_at', { ascending: false }); S.grants = data || []; if (ui.page === 'setting') render(); navCounts(); }

// ---------- tampilan ----------
const IC = {
  dashboard: '<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  requests: '<path d="M9 4h6l1 2h3v14H5V6h3zM9 11h6M9 15h4" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>',
  ga: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7M9 8h3" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>',
  people: '<path d="M9 11a4 4 0 100-8 4 4 0 000 8zM2 21c0-4 3-7 7-7s7 3 7 7M16 4a4 4 0 010 7M18 14c2.5 1 4 3.5 4 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  out: '<path d="M14 4h6v6M20 4l-9 9M10 6H5a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1v-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  stock: '<path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  history: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  images: '<rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="16" cy="9" r="1.6" fill="currentColor"/>',
  guide: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  deleted: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  setting: '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
};
const PAGES = [
  { id: 'dashboard', label: 'Dashboard', grp: 'Ringkasan' },
  { id: 'requests', label: 'Permintaan APD', grp: 'Pengelolaan APD' },
  { id: 'ga', label: 'Form GA Request', grp: 'Pengelolaan APD', owner: true },
  { id: 'people', label: 'Manpower Aktif', grp: 'Pengelolaan APD' },
  { id: 'out', label: 'Manpower Keluar', grp: 'Pengelolaan APD' },
  { id: 'stock', label: 'Stok & Gudang', grp: 'Pengelolaan APD', owner: true },
  { id: 'history', label: 'Riwayat Transaksi', grp: 'Pengelolaan APD' },
  { id: 'images', label: 'Gambar APD', grp: 'Pengelolaan APD', owner: true },
  { id: 'guide', label: 'Tata Cara', grp: 'Sistem' },
  { id: 'deleted', label: 'Riwayat Hapus', grp: 'Sistem', owner: true },
  { id: 'setting', label: 'Pengaturan', grp: 'Sistem' },
];
function navHtml() {
  let g = '';
  return `<a class="tohub" href="${HUB}">← Pusat Monitoring</a>` + PAGES.filter((p) => (!p.owner || isOwner()) && permOf(p.id, 'v')).map((p) => {
    const lbl = p.grp !== g ? `<div class="lbl">${p.grp}</div>` : ''; g = p.grp;
    const cur = ui.page === p.id || (ui.page === 'detail' && p.id === ((person(ui.person) || {}).status === 'OUT' ? 'out' : 'people'));
    return `${lbl}<button type="button" data-go="${p.id}" ${cur ? 'aria-current="page"' : ''}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">${IC[p.id]}</svg>${p.label}<span class="ct" data-ct="${p.id}" hidden></span></button>`;
  }).join('');
}
function navCounts() {
  const set = (id, n, al) => { const c = document.querySelector(`[data-ct="${id}"]`); if (c) { c.hidden = !n; c.textContent = n || ''; c.classList.toggle('al', !!al); } };
  set('people', S.people.filter((p) => p.status === 'AKTIF').length);
  set('out', S.people.filter((p) => p.status === 'OUT' && held(p.id) > 0).length, true);
  set('dashboard', schedules().filter((x) => x.days <= 0).length, true);
  set('requests', isOwner() ? S.state.requests.filter((r) => r.status === 'pending').length : S.state.requests.filter((r) => r.status === 'approved').length, true);
  if (isOwner()) set('ga', S.state.ga.docs.filter((d) => d.status !== 'CLOSE').length);
  if (isOwner()) set('setting', (S.grants || []).filter((g) => g.status === 'pending').length, true);
}
function header(eyebrow, ttl, desc, extra) {
  const d = new Date();
  return `<div class="head"><div><div class="eyebrow">${eyebrow}</div><h1>${ttl}</h1><p>${desc}</p></div><div class="mtools">${extra || ''}<div class="upd"><i></i><div><small>Update hari ini</small><b>${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}</b></div></div>${printBtn()}</div></div>`;
}
const printBtn = () => `<button type="button" class="btn btn-g" id="printBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>Print</button>`;
const tag = (s) => { const c = s === 'LAYAK' || s === 'AKTIF' || s === 'TERJADWAL' || s === 'BARU' ? 'ok' : s === 'TIDAK LAYAK' || s === 'OUT' || s === 'MUSNAH' || s === 'JATUH TEMPO' ? 'no' : s === 'BELUM DIPERIKSA' || s === 'SEGERA' ? 'hd' : 'pr'; return `<span class="hs ${c}">${esc(s === 'OUT' ? 'KELUAR' : s)}</span>`; };
const img = (t) => `<img class="apdimg" src="${esc((ART[t] || {}).img || genImg(t, '#64748B'))}" alt="${esc(tLabel(t))}" loading="lazy">`;
const whSel = (id, val, name, extra) => `<select id="${id}" name="${name || 'warehouse'}" ${extra || ''}>${WH.map((w) => `<option ${w === val ? 'selected' : ''}>${esc(w)}</option>`).join('')}</select>`;

function render() {
  if (!S.state) { S.state = empty(); applyTypes(); }
  const locked = S.loaded && S.noAccess;
  $('nav').innerHTML = navHtml();
  $('roleTag').textContent = S.role === 'owner' ? 'Pemilik · Editor' : S.role === 'editor' ? 'Editor' : S.role === 'viewer' ? 'Pelihat' : 'Belum ada akses';
  $('roleTag').className = 'pill' + (can() ? ' live' : '');
  $('authBtn').textContent = S.user ? 'Keluar' : 'Masuk';
  $('authBtn').title = S.user ? 'Masuk sebagai ' + S.user.email : 'Masuk untuk mengedit';
  if (locked) { lockScreen(); return; }
  unlock();
  if (PAGES.some((p) => p.id === ui.page && p.owner) && !isOwner()) ui.page = 'dashboard';
  if (!permOf(ui.page, 'v')) ui.page = 'dashboard';
  if (ui.wh !== 'ALL' && !WH.includes(ui.wh)) ui.wh = 'ALL';
  const map = { dashboard: pageDash, requests: pageRequests, ga: pageGA, people: () => pagePeople(false), out: () => pagePeople(true), detail: pageDetail, stock: pageStock, history: pageHistory, images: pageImages, guide: pageGuide, deleted: pageDeleted, setting: pageSetting };
  $('view').innerHTML = S.loaded ? (map[ui.page] || pageDash)() : '<div class="empty"><span class="spin"></span><p>Menyiapkan Monitoring APD…</p></div>';
  navCounts(); guardSync();
}
function go(id) { ui.page = id; try { history.replaceState(null, '', '#' + id); } catch (e) {} document.body.classList.remove('nav-open'); $('scrim').hidden = true; render(); window.scrollTo({ top: 0 }); }

// ---------- Dashboard ----------
function varChips(t, wh = 'ALL') {
  const z = variantStocks(t, S.state, wh);
  const vs = [...(VARIANTS[t] || [])];
  return `<div class="vchips">${vs.map((v) => { const n = z[v] ? z[v].NEW + z[v].REUSE : 0; return `<span class="${n ? '' : 'zero'}" title="${esc(ART[t].vlabel)} ${esc(v)}: baru ${z[v] ? z[v].NEW : 0}, bekas ${z[v] ? z[v].REUSE : 0}">${t === 'HELM' && HELM_DOT[v] && !S.state.images.HELM ? `<img class="hm hm-${v}" src="${esc(ART.HELM.img)}" alt="">` : ''}${esc(vText(t, v))}<b>${n}</b></span>`; }).join('')}${z['BELUM DIISI'] && z['BELUM DIISI'].NEW + z['BELUM DIISI'].REUSE ? `<span title="Stok lama tanpa warna/ukuran">Belum diisi<b>${z['BELUM DIISI'].NEW + z['BELUM DIISI'].REUSE}</b></span>` : ''}</div>`;
}
function pageDash() {
  const w = TYPES.reduce((a, t) => { const z = stock(t); return a + z.NEW + z.REUSE; }, 0);
  const dist = distributed().reduce((a, t) => a + qty(t.qty), 0), sch = schedules(), dueN = sch.filter((x) => x.days <= 0).length, act = S.people.filter((p) => p.status === 'AKTIF').length;
  const pend = S.state.requests.filter((r) => r.status === 'pending').length, appr = S.state.requests.filter((r) => r.status === 'approved').length;
  const banner = `<div class="gbanner gb-apd"><div class="gb-t"><span>Monitoring APD</span><b>KMB</b><small>${TYPES.length} jenis APD · ${WH.length} gudang · permintaan, pembagian & penggantian</small></div><div class="gb-art" aria-hidden="true">${TYPES.slice(0, 3).map(img).join('')}</div></div>`;
  const kpi = `<div class="kpis">
    <div class="kpi k1"><span class="ic">▣</span><div><div class="lb">Total Stok APD</div><div class="v">${w}</div><div class="ds">${WH.length} gudang · ${TYPES.length} jenis</div></div></div>
    <div class="kpi k2"><span class="ic">➤</span><div><div class="lb">Permintaan Terbuka</div><div class="v">${pend + appr}</div><div class="ds">${pend} menunggu · ${appr} siap dibagikan</div></div></div>
    <div class="kpi k3"><span class="ic">!</span><div><div class="lb">Jatuh Tempo Ganti</div><div class="v">${dueN}</div><div class="ds">APD perlu diganti</div></div></div>
    <div class="kpi k4"><span class="ic">♙</span><div><div class="lb">Karyawan Aktif</div><div class="v">${act}</div><div class="ds">${dist} unit sudah dibagikan</div></div></div></div>`;
  const years = [...new Set([new Date().getFullYear(), ui.year, ...S.state.receipts.map((x) => Number((x.date || '').slice(0, 4)) || 0)])].filter((y) => y > 2000).sort((a, b) => b - a);
  const trend = `<div class="card s8"><div class="ch"><div><div class="eyebrow">Distribusi</div><h2>Tren Distribusi APD</h2><p>Dari transaksi pembagian APD baru & bekas layak.</p></div><div class="mtools"><div class="seg" role="group" aria-label="Periode">${['harian', 'mingguan', 'bulanan', 'tahunan'].map((p) => `<button type="button" data-period="${p}" aria-pressed="${ui.period === p}">${title(p)}</button>`).join('')}</div>${ui.period === 'bulanan' || ui.period === 'tahunan' ? `<select id="yearSel" aria-label="Tahun">${years.map((y) => `<option ${y === ui.year ? 'selected' : ''}>${y}</option>`).join('')}</select>` : ''}</div></div>${trendChart()}</div>`;
  const comp = `<div class="card s4"><div class="ch"><div><div class="eyebrow">Komposisi</div><h2>Komposisi Distribusi</h2><p>Total pembagian per jenis APD.</p></div><span class="pill live">Live data</span></div>${donut()}</div>`;
  const prod = `<div class="card s8"><div class="ch"><div><div class="eyebrow">Gudang</div><h2>Stok APD per Jenis</h2><p>Total semua gudang dibandingkan stok minimum.</p></div>${isOwner() ? '<button type="button" class="btn btn-g btn-sm" data-go="stock">Kelola Stok →</button>' : ''}</div><div class="apdprods">${TYPES.map((t) => {
    const z = stock(t), n = z.NEW + z.REUSE, min = Number(S.state.limits[t] || 0), pct = min ? Math.min(100, Math.round(n / min * 100)) : n > 0 ? 100 : 0, low = n === 0 || (min > 0 && n < min);
    return `<div class="apdprod"><div class="pim">${img(t)}<span class="hs ${n === 0 ? 'no' : low ? 'hd' : 'ok'}">${n === 0 ? 'Stok kosong' : low ? 'Stok menipis' : 'Stok aman'}</span></div><b>${esc(tLabel(t))}</b><small>${esc(ART[t].desc)}</small><div class="pnum"><span><small>Stok</small><strong>${n}</strong></span><span><small>Min.</small><strong>${min}</strong></span><span><small>Baru / Bekas</small><strong>${z.NEW} / ${z.REUSE}</strong></span></div><div class="tr"><i style="width:${pct}%;background:${ART[t].color}"></i></div>${varChips(t)}</div>`;
  }).join('')}</div></div>`;
  const actv = `<div class="card s4"><div class="ch"><div><div class="eyebrow">Aktivitas</div><h2>Aktivitas Terbaru</h2></div><button type="button" class="btn btn-g btn-sm" data-go="history">Semua →</button></div>${activity()}</div>`;
  const rows = sch.slice(0, 8).map((x) => `<tr><td class="b"><a href="#" data-person="${esc(x.p.id)}">${esc(x.p.name)}</a><div class="small">${esc(x.p.position)} · ${esc(x.p.site)}</div></td><td>${esc(tLabel(x.t))}</td><td class="nw">${fmt(x.x.date)}</td><td class="nw">${fmt(x.d)}</td><td>${tag(x.days <= 0 ? 'JATUH TEMPO' : x.days <= 30 ? 'SEGERA' : 'TERJADWAL')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Belum ada jadwal penggantian. Mulai dari pembagian APD kepada karyawan.</td></tr>';
  const schCard = `<div class="card s12"><div class="ch"><div><div class="eyebrow">Penggantian</div><h2>Jadwal Penggantian APD</h2><p>Tanggal penerimaan terbaru + jatah penggantian (bulan). APD lama tidak menentukan jadwal.</p></div><span class="pill ${dueN ? 'red' : ''}">${dueN} jatuh tempo · ${sch.length} terjadwal</span></div><div class="tw"><table class="t"><thead><tr><th>Karyawan</th><th>Jenis APD</th><th>Terakhir Menerima</th><th>Jadwal Ganti</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  const reqNote = (pend && isOwner()) || (appr && can()) ? `<div class="srcnote">${pend && isOwner() ? `<b>${pend} permintaan APD</b> menunggu persetujuan Anda. ` : ''}${appr && can() ? `<b>${appr} permintaan</b> sudah disetujui dan siap dibagikan. ` : ''}<a href="#" data-go="requests">Buka Permintaan APD →</a></div>` : '';
  return banner + header('Overview', 'Dashboard Monitoring APD', 'Permintaan, distribusi, stok gudang, dan penggantian Alat Pelindung Diri karyawan KMB.') + reqNote + kpi + `<div class="grid">${trend}${comp}</div><div class="grid">${prod}${actv}</div><div class="grid">${schCard}</div>`;
}
function buckets() {
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'], out = [], now = new Date(today() + 'T12:00:00');
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  if (ui.period === 'bulanan') for (let m = 0; m < 12; m++) { const k = ui.year + '-' + String(m + 1).padStart(2, '0'); out.push({ l: mon[m], a: k + '-01', b: k + '-31' }); }
  if (ui.period === 'tahunan') for (let y = ui.year - 4; y <= ui.year; y++) out.push({ l: String(y), a: y + '-01-01', b: y + '-12-31' });
  if (ui.period === 'harian') for (let i = 13; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); out.push({ l: d.getDate() + '/' + (d.getMonth() + 1), a: iso(d), b: iso(d) }); }
  if (ui.period === 'mingguan') { const m0 = new Date(now); m0.setDate(m0.getDate() - (m0.getDay() + 6) % 7); for (let i = 7; i >= 0; i--) { const d = new Date(m0); d.setDate(d.getDate() - i * 7); const e = new Date(d); e.setDate(e.getDate() + 6); out.push({ l: d.getDate() + '/' + (d.getMonth() + 1), a: iso(d), b: iso(e) }); } }
  return out;
}
function trendChart() {
  const b = buckets(), hist = distributed();
  const ser = TYPES.map((t) => ({ t, c: ART[t].color, v: b.map((k) => hist.filter((r) => r.type === t && r.date >= k.a && r.date <= k.b).reduce((a, r) => a + qty(r.qty), 0)) }));
  const max = Math.max(1, ...ser.flatMap((x) => x.v)), tick = Math.max(1, Math.ceil(max / 4)), W = 640, H = 230, L = 34, R = 12, T = 14, B = 30;
  const x = (i) => L + (W - L - R) * i / Math.max(1, b.length - 1), y = (n) => T + (H - T - B) * (1 - n / (tick * 4));
  let g = [0, 1, 2, 3, 4].map((i) => `<line x1="${L}" x2="${W - R}" y1="${y(i * tick)}" y2="${y(i * tick)}" stroke="var(--line)" stroke-dasharray="3 4"/><text x="${L - 7}" y="${y(i * tick) + 4}" text-anchor="end" style="fill:var(--muted);font-size:11px">${i * tick}</text>`).join('');
  g += b.map((k, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" style="fill:var(--muted);font-size:10.5px">${k.l}</text>`).join('');
  g += ser.map((z) => { const pts = z.v.map((v, i) => [x(i), y(v)]); const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '); return `<path d="${d} L${x(b.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z" fill="${z.c}" fill-opacity=".08"/><path d="${d}" fill="none" stroke="${z.c}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>` + pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.4" fill="var(--card)" stroke="${z.c}" stroke-width="2"><title>${esc(tLabel(z.t))} ${b[i].l}: ${z.v[i]}</title></circle>`).join(''); }).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tren distribusi APD">${g}</svg></div><div class="legend">${ser.map((z) => `<span><i style="background:${z.c}"></i>${esc(tLabel(z.t))} <b>${z.v.reduce((a, c) => a + c, 0)}</b></span>`).join('')}</div>`;
}
function donut() {
  const sums = TYPES.map((t) => distributed().filter((r) => r.type === t).reduce((a, r) => a + qty(r.qty), 0)), tot = sums.reduce((a, c) => a + c, 0);
  const R = 70, C = 2 * Math.PI * R; let off = 0;
  const arcs = tot ? TYPES.map((t, i) => { const len = sums[i] / tot * C; const s = `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${ART[t].color}" stroke-width="26" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 100 100)"/>`; off += len; return s; }).join('') : `<circle cx="100" cy="100" r="${R}" fill="none" stroke="var(--line)" stroke-width="26"/>`;
  return `<div class="donut"><svg viewBox="0 0 200 200" role="img" aria-label="Komposisi distribusi APD">${arcs}<text x="100" y="98" text-anchor="middle" style="font-size:28px;font-weight:800;fill:var(--ink)">${tot}</text><text x="100" y="120" text-anchor="middle" style="font-size:11px;fill:var(--muted)">total dibagikan</text></svg></div><div class="legend">${TYPES.map((t, i) => `<span><i style="background:${ART[t].color}"></i>${esc(tLabel(t))} <b>${tot ? Math.round(sums[i] / tot * 100) : 0}%</b></span>`).join('')}</div>`;
}
function activity() {
  const it = [];
  if (isOwner()) { S.state.stockIn.forEach((x) => it.push({ d: x.date, t: 'Stok masuk', s: `${x.qty} ${tLabel(x.type)} → ${whOf(x.location)}`, c: 'pr' })); S.state.transfers.forEach((x) => it.push({ d: x.date, t: 'Mutasi', s: `${x.qty} ${tLabel(x.type)} ${x.from} → ${x.to}`, c: 'pr' })); }
  S.state.requests.forEach((x) => it.push({ d: (x.decidedAt || x.date || '').slice(0, 10), t: 'Permintaan ' + (REQ_ST[x.status] || ['', ''])[0].toLowerCase(), s: `${x.qty} ${tLabel(x.type)} · ${reqWho(x)}`, c: (REQ_ST[x.status] || ['', 'pr'])[1] }));
  S.state.receipts.forEach((x) => it.push({ d: x.date, t: x.source === 'OLD' ? 'Catat APD lama' : 'APD dibagikan', s: `${x.qty} ${tLabel(x.type)} · ${personName(x.person)}`, c: 'ok' }));
  S.state.returns.forEach((x) => { const r = S.state.receipts.find((t) => t.id === x.receiptId); if (r) it.push({ d: x.date, t: x.action === 'REUSE' ? 'Kembali layak' : 'Dimusnahkan', s: `${x.qty} ${tLabel(r.type)} · ${personName(r.person)}`, c: x.action === 'REUSE' ? 'hd' : 'no' }); });
  it.sort((a, b) => b.d.localeCompare(a.d));
  return `<div class="actl">${it.slice(0, 7).map((x) => `<div><span class="hs ${x.c}">${esc(x.t)}</span><b>${esc(x.s)}</b><time>${fmt(x.d)}</time></div>`).join('') || '<div class="empty">Belum ada aktivitas APD.</div>'}</div>`;
}

// ---------- Permintaan APD ----------
function pageRequests() {
  const all = [...S.state.requests].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const cnt = (s) => all.filter((r) => r.status === s).length;
  const tabs = [['pending', 'Menunggu'], ['approved', 'Disetujui'], ['fulfilled', 'Selesai'], ['rejected', 'Ditolak / Batal'], ['all', 'Semua']];
  const list = all.filter((r) => ui.rq === 'all' || r.status === ui.rq || (ui.rq === 'rejected' && r.status === 'cancelled'));
  const rows = list.map((r) => {
    const p = isStockReq(r) ? null : person(r.person) || { name: personName(r.person), site: r.site || '—', position: '—' };
    const z = variantStocks(r.type)[variant(r)] || { NEW: 0, REUSE: 0 }, avail = z.NEW + z.REUSE;
    const st = REQ_ST[r.status] || ['?', 'pr'];
    const acts = [];
    if (r.status === 'pending' && isOwner()) acts.push(`<button type="button" class="btn btn-p btn-sm" data-rqact="approve|${esc(r.id)}">Setujui</button>`, `<button type="button" class="btn btn-g btn-sm red" data-rqact="reject|${esc(r.id)}">Tolak</button>`);
    if (r.status === 'pending' && !isOwner() && can() && (r.by || '').toLowerCase() === S.user.email.toLowerCase()) acts.push(`<button type="button" class="btn btn-g btn-sm red" data-rqact="cancel|${esc(r.id)}">Batalkan</button>`);
    if (r.status === 'approved' && !isStockReq(r) && can()) acts.push(`<button type="button" class="btn btn-p btn-sm" data-rqact="fulfill|${esc(r.id)}">Bagikan</button>`);
    if (r.status === 'approved' && isStockReq(r) && isOwner()) acts.push(`<button type="button" class="btn btn-p btn-sm" data-rqact="fulfill|${esc(r.id)}">Kirim Stok</button>`);
    return `<tr><td class="nw">${fmt(r.date)}</td><td class="b">${p ? `<a href="#" data-person="${esc(r.person)}">${esc(p.name)}</a><div class="small">${esc(p.position)} · ${esc(p.site)}</div>` : `<span class="hs pr">Stok site</span> ${esc(r.warehouse)}`}</td><td>${esc(tLabel(r.type))}<div class="small">${esc(vText(r.type, variant(r)))}</div></td><td class="b">${r.qty}</td><td><span class="small">${avail >= r.qty ? '✓ ' : '⚠ '}${avail} di semua gudang${isStockReq(r) ? `<br>${(() => { const y = variantStocks(r.type, S.state, r.warehouse)[variant(r)] || { NEW: 0, REUSE: 0 }; return y.NEW + y.REUSE; })()} di ${esc(r.warehouse)}` : ''}</span></td><td>${esc(r.reason || '—')}<div class="small">oleh ${esc(r.by || '—')}</div></td><td><span class="hs ${st[1]}">${st[0]}</span>${r.gaNo ? `<div class="small">${isOwner() ? `<a href="#" data-go="ga">GA ${esc(r.gaNo)}</a>` : 'Sudah diajukan ke GA'}</div>` : ''}${r.decidedBy ? `<div class="small">${esc(r.decidedBy)} · ${fmt(r.decidedAt)}</div>` : ''}${r.decisionNote ? `<div class="small">${esc(r.decisionNote)}</div>` : ''}</td><td class="nw">${acts.join(' ')}</td></tr>`;
  }).join('') || `<tr><td colspan="8" class="empty">Belum ada permintaan di kategori ini.</td></tr>`;
  return header('Alur permintaan', 'Permintaan APD', 'Admin jobsite (Editor) mengajukan APD untuk karyawan atau untuk stok gudang site → Pemilik menyetujui → APD dibagikan ke karyawan, atau stok dikirim ke gudang site.', (isOwner() && S.state.requests.some((r) => (r.status === 'pending' || r.status === 'approved') && !r.gaId) ? `<button type="button" class="btn btn-g" data-gafrom="${esc(S.state.requests.filter((r) => (r.status === 'pending' || r.status === 'approved') && !r.gaId).map((r) => r.id).join(','))}">Buat Form GA</button>` : '') + (can() ? '<button type="button" class="btn btn-g" data-newreq="|||stock">+ Minta Stok Site</button><button type="button" class="btn btn-p" data-newreq="1">+ Ajukan Permintaan</button>' : '')) +
    `<div class="mstats" style="grid-template-columns:repeat(4,minmax(0,1fr))"><div><b style="color:var(--warn,#B45309)">${cnt('pending')}</b><span>Menunggu persetujuan</span></div><div><b style="color:var(--primary)">${cnt('approved')}</b><span>Disetujui, belum dibagikan</span></div><div><b style="color:var(--good)">${cnt('fulfilled')}</b><span>Selesai dibagikan</span></div><div><b style="color:var(--crit)">${cnt('rejected') + cnt('cancelled')}</b><span>Ditolak / dibatalkan</span></div></div>
    <div class="card"><div class="toolbar"><div class="seg" role="group" aria-label="Status permintaan">${tabs.map(([k, l]) => `<button type="button" data-rq="${k}" aria-pressed="${ui.rq === k}">${l}${k !== 'all' ? ` (${k === 'rejected' ? cnt('rejected') + cnt('cancelled') : cnt(k)})` : ''}</button>`).join('')}</div><span class="small">${list.length} permintaan</span></div>
    <div class="tw"><table class="t"><thead><tr><th>Tanggal</th><th>Untuk</th><th>APD</th><th>Qty</th><th>Stok</th><th>Alasan / Pengaju</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function reqForm(pid, type, kind) {
  if (!can()) return;
  const ppl = S.people.filter((p) => p.status === 'AKTIF');
  const t0 = type || TYPES[0], k0 = kind || (pid ? 'person' : 'person');
  modal(`${mh('Permintaan APD', 'Ajukan Permintaan')}<div class="srcnote">Permintaan dikirim ke Pemilik untuk disetujui. Untuk karyawan: setelah disetujui klik <b>Bagikan</b>. Untuk stok site: Pemilik mengirim stok ke gudang site (mutasi) atau mengajukannya lewat Form GA.</div><form id="qForm"><div class="fgrid">
    <div class="fld full"><label>Permintaan untuk</label><div class="seg" role="group" aria-label="Permintaan untuk"><button type="button" data-qk="person" aria-pressed="${k0 === 'person'}">Karyawan</button><button type="button" data-qk="stock" aria-pressed="${k0 === 'stock'}">Stok gudang / site</button></div></div>
    <div class="fld full" id="qf_pw"><label for="qf_p">Karyawan</label><select id="qf_p" name="person"><option value="">Pilih karyawan</option>${ppl.map((p) => `<option value="${esc(p.id)}" ${p.id === pid ? 'selected' : ''}>${esc(p.name)} — ${esc(p.position)} · ${esc(p.site)}</option>`).join('')}</select></div>
    <div class="fld full" id="qf_ww"><label for="qf_w">Gudang / site tujuan</label>${whSel('qf_w', WH.find((w) => w !== 'Workshop') || WH[0], 'warehouse')}<small class="small">Gudang site belum ada di daftar? Minta Pemilik menambahkannya di Pengaturan → Gudang.</small></div>
    <div class="fld"><label for="qf_t">Jenis APD</label><select id="qf_t" name="type">${TYPES.map((t) => `<option value="${t}" ${t === t0 ? 'selected' : ''}>${esc(tLabel(t))}</option>`).join('')}</select></div><div id="qf_vw">${vSel(t0, '', 'qf_v')}</div>
    <div class="fld"><label for="qf_q">Jumlah</label><input id="qf_q" type="number" name="qty" min="1" step="1" required value="1"></div><div class="fld"><label for="qf_d">Tanggal dibutuhkan</label><input id="qf_d" type="date" name="need" value="${today()}"></div>
    <div class="fld full"><label for="qf_r">Alasan</label><select id="qf_r" name="reason"></select></div>
    <div class="fld full"><label for="qf_n">Catatan</label><input id="qf_n" name="note" placeholder="opsional"></div></div><div class="small" id="qf_h" style="margin-top:8px"></div>${actions('Kirim Permintaan')}</form>`);
  let kind0 = k0;
  const RS = { person: ['Karyawan baru', 'Penggantian rutin (jatuh tempo)', 'Rusak / tidak layak', 'Hilang', 'Ukuran tidak sesuai', 'Lainnya'], stock: ['Stok cadangan site', 'Stok site menipis / habis', 'Persiapan karyawan baru', 'Lainnya'] };
  const hint = () => { const t = $('qf_t').value, v = $('qf_v').value, z = variantStocks(t)[v || 'BELUM DIISI'] || { NEW: 0, REUSE: 0 }, w = kind0 === 'stock' ? (variantStocks(t, S.state, $('qf_w').value)[v || 'BELUM DIISI'] || { NEW: 0, REUSE: 0 }) : null; $('qf_h').textContent = v ? `Stok ${tLabel(t)} ${vText(t, v)} di semua gudang: ${z.NEW + z.REUSE}${w ? ` · di ${$('qf_w').value}: ${w.NEW + w.REUSE}` : ''}.` : ''; };
  const setKind = (k) => { kind0 = k; document.querySelectorAll('[data-qk]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.qk === k)); $('qf_pw').hidden = k !== 'person'; $('qf_ww').hidden = k !== 'stock'; $('qf_p').required = k === 'person'; $('qf_r').innerHTML = RS[k].map((x) => `<option>${x}</option>`).join(''); hint(); };
  $('qForm').addEventListener('click', (e) => { const b = e.target.closest('[data-qk]'); if (b) setKind(b.dataset.qk); });
  $('qf_t').onchange = () => { $('qf_vw').innerHTML = vSel($('qf_t').value, '', 'qf_v'); $('qf_v').onchange = hint; hint(); }; $('qf_v').onchange = hint; $('qf_w').onchange = hint; setKind(k0);
  $('qForm').onsubmit = (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    if (kind0 === 'person' && !f.person) { toast('Pilih karyawan.', true); return; }
    if ((VARIANTS[f.type] || []).length && !f.variant) { toast('Pilih ukuran/warna.', true); return; }
    const p = kind0 === 'person' ? person(f.person) : null, n = structuredClone(S.state);
    const base = { id: uid(), date: today(), need: f.need, type: f.type, variant: f.variant, qty: Number(f.qty), reason: f.reason, note: f.note, by: S.user.email, status: 'pending' };
    n.requests.push(kind0 === 'stock' ? { ...base, kind: 'stock', person: '', warehouse: f.warehouse, site: f.warehouse } : { ...base, kind: 'person', person: f.person, site: p ? p.site : '' });
    persist(n, 'Permintaan APD terkirim ke Pemilik.');
  };
}
function reqAction(act, id) {
  const r = S.state.requests.find((x) => x.id === id); if (!r) return;
  const set = (status, note) => { const n = structuredClone(S.state); const x = n.requests.find((y) => y.id === id); x.status = status; if (status !== 'fulfilled') { x.decidedBy = S.user.email; x.decidedAt = today(); x.decisionNote = note || ''; } return n; };
  if (act === 'approve') persist(set('approved'), 'Permintaan disetujui. Gudang bisa membagikan APD.');
  if (act === 'cancel') confirmBox('Batalkan permintaan ini?', `${r.qty} ${esc(tLabel(r.type))} untuk ${esc(reqWho(r))}.`, () => persist(set('cancelled'), 'Permintaan dibatalkan.'), 'Ya, batalkan');
  if (act === 'reject') {
    modal(`${mh('Permintaan APD', 'Tolak Permintaan')}<p class="small">${r.qty} ${esc(tLabel(r.type))} ${esc(vText(r.type, variant(r)))} untuk ${esc(reqWho(r))}.</p><form id="rjForm"><div class="fgrid"><div class="fld full"><label for="rj_n">Alasan penolakan</label><input id="rj_n" required placeholder="mis. jatah belum habis, stok habis"></div></div>${actions('Tolak Permintaan')}</form>`);
    $('rjForm').onsubmit = (e) => { e.preventDefault(); persist(set('rejected', $('rj_n').value.trim()), 'Permintaan ditolak.'); };
  }
  if (act === 'fulfill') { if (isStockReq(r)) transferForm(r.type, r); else receiptForm(r.person, r.type, '', 'NEW', r); }
}

// ---------- Manpower aktif / keluar ----------
function pagePeople(out) {
  const src = S.people.filter((p) => p.status === (out ? 'OUT' : 'AKTIF'));
  const sites = [...new Set(src.map((p) => p.site))].sort();
  const q = ui.q.toLowerCase();
  const rows = src.filter((p) => (ui.site === 'ALL' || p.site === ui.site) && (!q || `${p.name} ${p.position} ${p.site}`.toLowerCase().includes(q)));
  const body = rows.map((p, i) => `<tr><td>${i + 1}</td><td class="b"><a href="#" data-person="${esc(p.id)}">${esc(p.name)}</a><div class="small">${esc(p.position)}${p.edited ? ' · diubah di APD' : ''}</div></td><td>${esc(p.site)}</td>${TYPES.map((t) => { const d = due(p.id, t), dd = daysUntil(d); return `<td><b>${held(p.id, t)}</b><div class="small ${d && dd <= 0 ? 'red' : ''}">${d ? (dd <= 0 ? 'Ganti ' : '') + fmt(d) : 'Belum terjadwal'}</div></td>`; }).join('')}<td class="nw"><button type="button" class="btn btn-p btn-sm" data-person="${esc(p.id)}">Detail APD</button>${can() && !out ? ` <button type="button" class="btn btn-g btn-sm" data-newreq="${esc(p.id)}">Minta APD</button>` : ''}${can() ? ` <button type="button" class="btn btn-g btn-sm" data-editp="${esc(p.id)}">Edit</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="${TYPES.length + 4}" class="empty">Tidak ada karyawan yang cocok.</td></tr>`;
  const heldOut = out ? src.filter((p) => held(p.id) > 0).length : 0;
  return header('Database', out ? 'Manpower Keluar & Pengembalian' : 'Manpower Aktif & Kepemilikan APD', out ? 'Karyawan keluar: periksa dan catat APD yang dikembalikan.' : 'Klik nama karyawan untuk mencatat APD lama atau membagikan APD.') +
    `${out && heldOut ? `<div class="srcnote">${heldOut} karyawan keluar masih memegang APD. Buka detailnya lalu catat <b>Pengembalian</b>.</div>` : ''}
    <div class="card"><div class="toolbar"><input type="search" id="pq" placeholder="Cari nama, jabatan, jobsite" value="${esc(ui.q)}" aria-label="Cari karyawan"><select id="siteSel" aria-label="Filter jobsite"><option value="ALL">Semua jobsite</option>${sites.map((s) => `<option ${ui.site === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select><span class="small">${rows.length} dari ${src.length} karyawan · data dari Monitoring Manpower KMB</span></div>
    <div class="tw"><table class="t"><thead><tr><th>No</th><th>Nama & Jabatan</th><th>Jobsite</th>${TYPES.map((t) => `<th>${esc(tLabel(t))}</th>`).join('')}<th>Aksi</th></tr></thead><tbody>${body}</tbody></table></div></div>`;
}

// ---------- detail karyawan ----------
function pageDetail() {
  const p = person(ui.person); if (!p) return '<div class="empty">Karyawan tidak ditemukan. <a href="#" data-go="people">Kembali</a></div>';
  const sec = TYPES.map((t) => {
    const lots = S.state.receipts.filter((x) => x.person === p.id && x.type === t).sort((a, b) => b.date.localeCompare(a.date));
    const last = latest(p.id, t), d = due(p.id, t), old = lots.filter((x) => x.source === 'OLD').reduce((a, x) => a + heldLot(x), 0);
    const items = lots.map((r) => {
      const rem = heldLot(r), back = S.state.returns.filter((x) => x.receiptId === r.id);
      return `<div class="lot"><div class="lmain"><div><b>${SRC_LABEL[r.source]} · ${fmt(r.date)} · ${r.qty} unit · ${esc(vText(t, variant(r)))}</b> ${tag(r.condition || 'BELUM DIPERIKSA')}</div>
        <small>Masih dipegang: <b>${rem} unit</b>${r.source === 'OLD' ? ' · APD lama tidak menentukan jadwal ganti' : ` · Jatah ${r.months} bulan · Ganti ${fmt(addMonths(r.date, r.months))}`}</small>
        <small>Asal: ${esc(r.source === 'OLD' ? 'APD lama / milik pribadi' : r.source === 'EXTERNAL' ? r.warehouse || 'Pihak luar' : 'Gudang ' + whOf(r.warehouse))}${r.requestId ? ' · dari permintaan APD' : ''}${r.note ? ' · ' + esc(r.note) : ''}</small>
        ${back.map((x) => `<small class="ret">↳ ${fmt(x.date)} · ${x.qty} unit ${x.action === 'REUSE' ? 'dikembalikan layak → stok bekas gudang ' + esc(whOf(x.warehouse || r.warehouse)) : 'tidak layak → dimusnahkan'}${x.note ? ' · ' + esc(x.note) : ''}${can() ? ` <a href="#" data-editret="${esc(x.id)}">Edit</a> · <a href="#" class="red" data-del="return:${esc(x.id)}">Hapus</a>` : ''}</small>`).join('')}</div>
        ${can() ? `<div class="acts"><button type="button" class="btn btn-g btn-sm" data-rcpt="${esc(p.id)}|${t}|${esc(r.id)}|">Edit</button><button type="button" class="btn btn-g btn-sm red" data-del="receipt:${esc(r.id)}">Hapus</button>${p.status === 'OUT' && rem > 0 ? `<button type="button" class="btn btn-p btn-sm" data-ret="${esc(r.id)}">↩ Pengembalian</button>` : ''}</div>` : ''}</div>`;
    }).join('') || '<div class="small" style="padding:6px 0">Belum ada catatan. Gunakan <b>Catat APD Lama</b> untuk APD yang sudah dimiliki, atau <b>Bagikan APD</b> dari gudang.</div>';
    return `<div class="card s12"><div class="ch"><div class="apdh">${img(t)}<div><div class="eyebrow">${esc(t)}</div><h2>${esc(tLabel(t))}</h2><p>Dipegang ${held(p.id, t)} unit · APD lama ${old} unit</p></div></div>${can() ? `<div class="mtools">${p.status === 'AKTIF' ? `<button type="button" class="btn btn-g btn-sm" data-newreq="${esc(p.id)}|${t}">Minta APD</button>` : ''}<button type="button" class="btn btn-g btn-sm" data-rcpt="${esc(p.id)}|${t}||OLD">+ Catat APD Lama</button><button type="button" class="btn btn-p btn-sm" data-rcpt="${esc(p.id)}|${t}||NEW">+ Bagikan APD</button></div>` : ''}</div>
      <div class="mstats" style="grid-template-columns:repeat(4,minmax(0,1fr))"><div><b>${held(p.id, t)}</b><span>Total dipegang</span></div><div><b>${old}</b><span>APD lama</span></div><div><b style="font-size:15px">${fmt(last && last.date)}</b><span>Terakhir terima</span></div><div><b style="font-size:15px;${d && daysUntil(d) <= 0 ? 'color:var(--crit)' : ''}">${fmt(d)}</b><span>Jadwal ganti</span></div></div><div class="lots">${items}</div></div>`;
  }).join('');
  const reqs = S.state.requests.filter((r) => r.person === p.id && (r.status === 'pending' || r.status === 'approved'));
  return `<div class="toolbar"><button type="button" class="btn btn-g" data-go="${p.status === 'OUT' ? 'out' : 'people'}">← Kembali</button></div>` +
    header('Detail APD karyawan', esc(p.name), `${esc(p.position)} · ${esc(p.site)} · ${p.status === 'AKTIF' ? 'Aktif' : 'Keluar'} · memegang ${held(p.id)} unit APD`, can() ? `<button type="button" class="btn btn-g" data-editp="${esc(p.id)}">Edit Data Karyawan</button>` : '') +
    `${reqs.length ? `<div class="srcnote">Permintaan terbuka: ${reqs.map((r) => `${r.qty} ${esc(tLabel(r.type))} ${esc(vText(r.type, variant(r)))} (${REQ_ST[r.status][0].toLowerCase()})`).join(', ')}. <a href="#" data-go="requests">Lihat Permintaan APD →</a></div>` : ''}${p.status === 'OUT' && held(p.id) > 0 ? '<div class="srcnote">Karyawan ini sudah keluar. Klik <b>↩ Pengembalian</b> pada APD yang dikembalikan: layak masuk stok bekas, tidak layak dimusnahkan.</div>' : ''}<div class="grid">${sec}</div>`;
}

// ---------- stok & gudang (Pemilik) ----------
function pageStock() {
  const wh = ui.wh;
  const seg = `<div class="seg" role="group" aria-label="Gudang">${['ALL', ...WH].map((w) => `<button type="button" data-wh="${esc(w)}" aria-pressed="${ui.wh === w}">${w === 'ALL' ? 'Semua gudang' : esc(w)}</button>`).join('')}</div>`;
  const cards = TYPES.map((t) => { const x = stock(t, S.state, wh); return `<div class="card s4 apdcard">${img(t)}<div><div class="eyebrow">${esc(t)}</div><h2>${esc(tLabel(t))}</h2><div class="big">${x.NEW + x.REUSE}<small> unit${wh === 'ALL' ? '' : ' di ' + esc(wh)}</small></div><p class="small">Baru ${x.NEW} · Bekas layak ${x.REUSE}${wh === 'ALL' ? ` · Musnah ${x.DESTROYED}<br>Minimal stok ${Number(S.state.limits[t] || 0)}` : ''}</p>${varChips(t, wh)}<div class="mtools" style="margin-top:10px"><button type="button" class="btn btn-p btn-sm" data-opname="${t}">Edit Stok Gudang</button><button type="button" class="btn btn-g btn-sm" data-stock="|${t}">+ Stok Masuk</button><button type="button" class="btn btn-g btn-sm" data-xfer="${t}">Mutasi</button><button type="button" class="btn btn-g btn-sm" data-min="${t}">Min. Stok</button></div></div></div>`; }).join('');
  // matriks stok per gudang
  const mx = TYPES.flatMap((t) => [...(VARIANTS[t] || []), 'BELUM DIISI'].map((v) => {
    const per = WH.map((w) => { const z = variantStocks(t, S.state, w)[v] || { NEW: 0, REUSE: 0 }; return z.NEW + z.REUSE; });
    const tot = per.reduce((a, c) => a + c, 0);
    if (v === 'BELUM DIISI' && !tot) return '';
    return `<tr><td>${esc(tLabel(t))}</td><td>${esc(vText(t, v))}</td>${per.map((n) => `<td class="${n ? 'b' : 'small'}">${n}</td>`).join('')}<td class="b">${tot}</td></tr>`;
  })).join('');
  const inRows = [...S.state.stockIn].filter((x) => wh === 'ALL' || whOf(x.location) === wh).sort((a, b) => b.date.localeCompare(a.date)).map((x) => `<tr><td class="nw">${fmt(x.date)}</td><td>${esc(tLabel(x.type))}</td><td>${esc(vText(x.type, variant(x)))}</td><td>${tag(x.grade === 'NEW' ? 'BARU' : 'LAYAK')}</td><td class="b">${x.qty}</td><td>${esc(whOf(x.location))}</td><td>${esc(x.note || '—')}</td><td class="nw"><button type="button" class="btn btn-g btn-sm" data-stock="${esc(x.id)}|">Edit</button> <button type="button" class="btn btn-g btn-sm red" data-del="stock:${esc(x.id)}">Hapus</button></td></tr>`).join('') || '<tr><td colspan="8" class="empty">Belum ada stok masuk.</td></tr>';
  const xf = [...S.state.transfers].filter((x) => wh === 'ALL' || x.from === wh || x.to === wh).sort((a, b) => b.date.localeCompare(a.date)).map((x) => `<tr><td class="nw">${fmt(x.date)}</td><td>${esc(tLabel(x.type))}</td><td>${esc(vText(x.type, variant(x)))}</td><td>${x.grade === 'REUSE' ? 'Bekas layak' : 'Baru'}</td><td class="b">${x.qty}</td><td>${esc(x.from)} → ${esc(x.to)}</td><td>${esc(x.note || '—')}</td><td><button type="button" class="btn btn-g btn-sm red" data-del="transfer:${esc(x.id)}">Hapus</button></td></tr>`).join('');
  const adj = [...S.state.adjust].filter((x) => wh === 'ALL' || whOf(x.location) === wh).sort((a, b) => b.date.localeCompare(a.date)).map((x) => `<tr><td class="nw">${fmt(x.date)}</td><td>${esc(tLabel(x.type))}</td><td>${esc(vText(x.type, variant(x)))}</td><td>${x.grade === 'REUSE' ? 'Bekas layak' : 'Baru'}</td><td>${esc(whOf(x.location))}</td><td class="b" style="color:${x.qty > 0 ? 'var(--good)' : 'var(--crit)'}">${x.qty > 0 ? '+' : ''}${x.qty}</td><td>${esc(x.note || '—')}</td><td>${esc(x.by || '—')}</td><td><button type="button" class="btn btn-g btn-sm red" data-del="adjust:${esc(x.id)}">Hapus</button></td></tr>`).join('');
  return header('Inventory', 'Stok APD Gudang', 'Stok dihitung per gudang. Hanya Pemilik yang bisa mengubah stok, mutasi, dan koreksi.', '<button type="button" class="btn btn-p" data-stock="|">+ Stok Masuk</button>') +
    `<div class="toolbar">${seg}<span class="small">Kelola daftar gudang di Pengaturan → Gudang.</span></div><div class="grid">${cards}</div>
    <div class="grid"><div class="card s12"><div class="ch"><div><div class="eyebrow">Per gudang</div><h2>Stok per Gudang</h2><p>Jumlah baru + bekas layak per ukuran/warna di setiap gudang.</p></div></div><div class="tw"><table class="t"><thead><tr><th>Jenis</th><th>Ukuran / Warna</th>${WH.map((w) => `<th>${esc(w)}</th>`).join('')}<th>Total</th></tr></thead><tbody>${mx}</tbody></table></div></div></div>
    <div class="grid"><div class="card s12"><div class="ch"><div><div class="eyebrow">Riwayat</div><h2>Stok Masuk Gudang</h2><p>APD yang sudah dipakai karyawan dicatat lewat Detail Karyawan → Catat APD Lama, bukan di sini.</p></div></div><div class="tw"><table class="t"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Ukuran</th><th>Kondisi</th><th>Qty</th><th>Gudang</th><th>Keterangan</th><th>Aksi</th></tr></thead><tbody>${inRows}</tbody></table></div></div></div>
    ${xf ? `<div class="grid"><div class="card s12"><div class="ch"><div><div class="eyebrow">Mutasi</div><h2>Mutasi Antar Gudang</h2></div></div><div class="tw"><table class="t"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Ukuran</th><th>Kondisi</th><th>Qty</th><th>Dari → Ke</th><th>Keterangan</th><th>Aksi</th></tr></thead><tbody>${xf}</tbody></table></div></div></div>` : ''}
    ${adj ? `<div class="grid"><div class="card s12"><div class="ch"><div><div class="eyebrow">Stok opname</div><h2>Riwayat Edit / Koreksi Stok</h2><p>Selisih antara stok di sistem dan hitungan fisik gudang.</p></div></div><div class="tw"><table class="t"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Warna / Ukuran</th><th>Kondisi</th><th>Gudang</th><th>Selisih</th><th>Alasan</th><th>Oleh</th><th>Aksi</th></tr></thead><tbody>${adj}</tbody></table></div></div></div>` : ''}`;
}

// ---------- riwayat transaksi ----------
function pageHistory() {
  const rows = [];
  if (isOwner()) {
    S.state.stockIn.forEach((x) => rows.push({ d: x.date, t: x.type, l: x.grade === 'NEW' ? 'STOK BARU MASUK' : 'STOK BEKAS MASUK', n: x.qty, who: 'Gudang ' + whOf(x.location), from: x.note || '—', kind: 'stock', id: x.id, edit: `data-stock="${esc(x.id)}|"` }));
    S.state.adjust.forEach((x) => rows.push({ d: x.date, t: x.type, l: x.qty > 0 ? 'KOREKSI STOK +' : 'KOREKSI STOK −', n: x.qty, who: 'Gudang ' + whOf(x.location), from: x.note || 'Stok opname', kind: 'adjust', id: x.id, edit: `data-opname="${x.type}"` }));
    S.state.transfers.forEach((x) => rows.push({ d: x.date, t: x.type, l: 'MUTASI GUDANG', n: x.qty, who: `${x.from} → ${x.to}`, from: x.note || '—', kind: 'transfer', id: x.id, edit: '' }));
  }
  S.state.receipts.forEach((x) => rows.push({ d: x.date, t: x.type, l: x.source === 'OLD' ? 'APD LAMA' : x.source === 'EXTERNAL' ? 'TERIMA EKSTERNAL' : x.source === 'NEW' ? 'TERIMA BARU' : 'TERIMA BEKAS', n: x.qty, who: personName(x.person), pid: x.person, from: x.source === 'OLD' ? 'Milik pribadi' : x.source === 'EXTERNAL' ? x.warehouse || 'Pihak luar' : 'Gudang ' + whOf(x.warehouse), kind: 'receipt', id: x.id, edit: `data-rcpt="${esc(x.person)}|${x.type}|${esc(x.id)}|"` }));
  S.state.returns.forEach((x) => { const r = S.state.receipts.find((a) => a.id === x.receiptId); if (r) rows.push({ d: x.date, t: r.type, l: x.action === 'REUSE' ? 'KEMBALI LAYAK' : 'DIMUSNAHKAN', n: x.qty, who: personName(r.person), pid: r.person, from: x.action === 'REUSE' ? 'Ke gudang ' + whOf(x.warehouse || r.warehouse) : '—', kind: 'return', id: x.id, edit: `data-editret="${esc(x.id)}"` }); });
  rows.sort((a, b) => b.d.localeCompare(a.d));
  const q = ui.hq.toLowerCase();
  const list = rows.filter((x) => (ui.ht === 'ALL' || x.t === ui.ht) && (!q || `${x.who} ${x.l} ${x.from}`.toLowerCase().includes(q)));
  const ownerKinds = ['stock', 'adjust', 'transfer'];
  return header('Audit trail', 'Riwayat Transaksi APD', isOwner() ? 'Stok masuk, mutasi, koreksi, APD lama, pembagian, dan pengembalian.' : 'Riwayat APD karyawan. Riwayat stok gudang khusus Pemilik.', isOwner() ? '<button type="button" class="btn btn-g" id="xlsBtn">Download Excel</button>' : '') +
    `<div class="card"><div class="toolbar"><input type="search" id="hq" placeholder="Cari karyawan / aktivitas" value="${esc(ui.hq)}" aria-label="Cari transaksi"><div class="seg" role="group" aria-label="Jenis APD">${['ALL', ...TYPES].map((t) => `<button type="button" data-ht="${esc(t)}" aria-pressed="${ui.ht === t}">${t === 'ALL' ? 'Semua' : esc(tLabel(t))}</button>`).join('')}</div><span class="small">${list.length} transaksi</span></div>
    <div class="tw"><table class="t"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Aktivitas</th><th>Qty</th><th>Karyawan / Gudang</th><th>Asal / Keterangan</th>${can() ? '<th>Aksi</th>' : ''}</tr></thead><tbody>${list.map((x) => `<tr><td class="nw">${fmt(x.d)}</td><td>${esc(tLabel(x.t))}</td><td>${tag(x.l)}</td><td class="b">${x.n}</td><td>${x.pid ? `<a href="#" data-person="${esc(x.pid)}">${esc(x.who)}</a>` : esc(x.who)}</td><td>${esc(x.from)}</td>${can() ? `<td class="nw">${!ownerKinds.includes(x.kind) || isOwner() ? `${x.edit ? `<button type="button" class="btn btn-g btn-sm" ${x.edit}>Edit</button> ` : ''}<button type="button" class="btn btn-g btn-sm red" data-del="${x.kind}:${esc(x.id)}">Hapus</button>` : ''}</td>` : ''}</tr>`).join('') || `<tr><td colspan="7" class="empty">Belum ada transaksi.</td></tr>`}</tbody></table></div></div>`;
}

// ---------- gambar, tata cara, riwayat hapus ----------
function pageImages() {
  return header('Tampilan', 'Gambar APD', 'Ganti gambar setiap jenis APD. Gambar otomatis diperkecil dan ditengahkan.') + `<div class="grid">${TYPES.map((t) => `<div class="card s4 apdpic"><div class="eyebrow">${esc(t)}</div><h2>${esc(tLabel(t))}</h2><div class="pv">${img(t)}</div><div class="mtools"><label class="btn btn-p btn-sm">Pilih Gambar<input type="file" accept="image/png,image/jpeg,image/webp" data-upimg="${esc(t)}" hidden></label>${S.state.images[t] ? `<button type="button" class="btn btn-g btn-sm" data-resetimg="${esc(t)}">Kembalikan Bawaan</button>` : ''}</div></div>`).join('')}</div>`;
}
function pageGuide() {
  const g = [
    ['Data karyawan', 'Otomatis dari Monitoring Manpower KMB (MP Aktif & MP Out semua jobsite). Kalau perlu, Pemilik/Editor bisa mengubah nama, jabatan, jobsite, atau status khusus di APD lewat tombol Edit.'],
    ['Permintaan APD', 'Admin jobsite (Editor) klik Minta APD pada karyawan atau + Ajukan Permintaan. Untuk stok cadangan di site pilih "Stok gudang / site" (atau tombol + Minta Stok Site). Pemilik menyetujui atau menolak di halaman Permintaan APD; permintaan stok site dipenuhi dengan Kirim Stok (mutasi) atau lewat Form GA. Setelah disetujui, klik Bagikan untuk mencatat serah terima; stok gudang otomatis berkurang.'],
    ['Form GA Request', 'Khusus Pemilik: menu Form GA Request → + Buat Form GA → Ambil dari Permintaan (atau isi baris manual) → Simpan. Klik Excel untuk unduh sesuai format GA Request, atau Lihat / PDF untuk cetak. Saat barang datang klik Barang Datang: stok gudang bertambah otomatis.'],
    ['Catat APD lama', 'Detail karyawan → Catat APD Lama. Isi tanggal diterima, jumlah yang masih dipegang, dan kondisinya. Tidak mengurangi stok gudang dan tidak membuat jadwal ganti.'],
    ['Stok per gudang', 'Khusus Pemilik: Stok & Gudang → + Stok Masuk (pilih gudang), Mutasi untuk memindahkan stok antar gudang, dan Edit Stok Gudang untuk stok opname. Daftar gudang diatur di Pengaturan → Gudang.'],
    ['Jenis APD', 'Pemilik bisa menambah jenis APD baru (sarung tangan, kacamata, masker, rompi, earplug, dll.) beserta ukuran/warnanya di Pengaturan → Jenis APD, lalu memasang gambarnya di menu Gambar APD.'],
    ['Jadwal ganti otomatis', 'Jadwal = tanggal penerimaan baru/bekas terakhir + jatah bulan. Yang sudah lewat tampil sebagai Jatuh Tempo di Dashboard.'],
    ['Karyawan keluar', 'Saat status karyawan menjadi Keluar di Monitoring Manpower, buka Manpower Keluar → Detail → ↩ Pengembalian. Layak masuk stok bekas di gudang yang dipilih, tidak layak dimusnahkan.'],
    ['Salah input', 'Edit atau Hapus dari Detail karyawan, Stok & Gudang, atau Riwayat Transaksi. Setiap hapus tercatat di Riwayat Hapus (khusus Pemilik). Stok selalu dicek ulang per gudang agar tidak minus.'],
  ];
  return header('Panduan', 'Tata Cara Monitoring APD', 'Langkah singkat mengelola permintaan, APD karyawan, dan stok gudang.') + `<div class="card"><ol class="guide">${g.map((x) => `<li><b>${x[0]}</b><p>${x[1]}</p></li>`).join('')}</ol></div>`;
}
function pageDeleted() {
  const lb = { ga: 'Form GA Request', stock: 'Stok masuk', receipt: 'Penerimaan APD', return: 'Pengembalian APD', adjust: 'Koreksi stok', transfer: 'Mutasi gudang', type: 'Jenis APD', warehouse: 'Gudang' };
  const rows = (S.audit || []).map((x) => { const d = x.record_data || {}; return `<tr><td class="nw">${new Date(x.deleted_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' })} WIB</td><td>${esc(x.deleted_by)}</td><td>${lb[x.kind] || esc(x.kind)}</td><td>${esc(d.type || d.code || d.no || '—')}</td><td>${esc(x.kind === 'receipt' ? personName(d.person) : d.location || d.from || d.name || '—')}</td><td>${esc(d.qty ?? '—')}</td><td class="nw">${fmt(d.date)}</td><td>${esc(d.note || '—')}</td></tr>`; }).join('');
  return header('Audit khusus Pemilik', 'Riwayat Hapus APD', 'Siapa yang menghapus, kapan, dan data apa yang terhapus.') + `<div class="card"><div class="tw"><table class="t"><thead><tr><th>Waktu hapus</th><th>Oleh</th><th>Jenis</th><th>APD</th><th>Karyawan / Gudang</th><th>Qty</th><th>Tanggal data</th><th>Keterangan</th></tr></thead><tbody>${S.audit === null ? '<tr><td colspan="8" class="empty"><span class="spin sm"></span> Memuat…</td></tr>' : rows || '<tr><td colspan="8" class="empty">Belum ada data yang dihapus.</td></tr>'}</tbody></table></div></div>`;
}

// ---------- pengaturan ----------
function usedType(c) { const s = S.state; return [...s.stockIn, ...s.receipts, ...s.adjust, ...s.transfers, ...s.requests, ...s.ga.docs.flatMap((d) => d.items)].some((x) => x.type === c); }
function usedWh(w) { const s = S.state; return s.stockIn.some((x) => whOf(x.location) === w) || s.adjust.some((x) => whOf(x.location) === w) || s.transfers.some((x) => x.from === w || x.to === w) || s.receipts.some((x) => (x.source === 'NEW' || x.source === 'REUSE') && whOf(x.warehouse) === w) || s.returns.some((x) => x.warehouse === w); }
function pageSetting() {
  const role = `<div class="card s6"><div class="ch"><div><div class="eyebrow">Akses</div><h2>Pemilik, Editor & Pelihat</h2></div><span class="pill ${can() ? 'live' : ''}">${$('roleTag').textContent}</span></div>
    <div class="role"><b>Pemilik</b><span>${OWNER}. Mengatur semua data, stok & gudang, jenis APD, gambar, akses, link Pelihat, dan menyetujui permintaan APD.</span></div>
    <div class="role"><b>Editor (admin jobsite)</b><span>Diundang lewat link Editor. Mengajukan permintaan APD, mencatat APD lama, membagikan APD yang sudah disetujui, pengembalian, dan membagikan link Pelihat. Tidak bisa mengubah stok gudang, jenis APD, atau menyetujui permintaan.</span></div>
    <div class="role"><b>Pelihat</b><span>Email yang diundang lewat <b>link Pelihat</b> (wajib masuk). Hanya melihat menu yang diizinkan; print & unduh mengikuti izin menu dari Pemilik atau izin cetak per orang. Tidak bisa membuka web lain.</span></div>
    <p class="small" style="margin:12px 0 0">${S.user ? `Masuk sebagai <b style="color:var(--ink)">${esc(S.user.email)}</b>.` : 'Anda melihat sebagai Pelihat. Klik Masuk di kanan atas untuk mengedit.'}</p></div>`;
  if (!isOwner()) return header('Sistem', 'Pengaturan', 'Hak akses Monitoring APD.') + `<div class="grid">${role}${can() ? `<div class="card s6"><div class="ch"><div><div class="eyebrow">Bagikan</div><h2>Bagikan Link Pelihat</h2><p>Editor bisa mengundang Pelihat lewat Pusat Monitoring. Link hanya berlaku untuk email yang diundang.</p></div></div><a class="btn btn-p" style="text-decoration:none" href="${HUB}#akses:${APP}">Bagikan Link Pelihat →</a></div>` : ''}</div>`;
  const types = `<div class="card s12"><div class="ch"><div><div class="eyebrow">Master data</div><h2>Jenis APD</h2><p>Tambah jenis APD baru beserta ukuran/warnanya. Jenis yang sudah punya transaksi tidak bisa dihapus.</p></div><button type="button" class="btn btn-p" data-typeform="">+ Tambah Jenis APD</button></div>
    <div class="tw"><table class="t"><thead><tr><th></th><th>Kode</th><th>Nama</th><th>Ukuran / Warna</th><th>Stok</th><th>Min.</th><th>Aksi</th></tr></thead><tbody>${S.state.types.map((t) => { const z = stock(t.code); return `<tr><td style="width:46px"><span class="tico">${img(t.code)}</span></td><td class="b"><i class="dot" style="background:${esc(t.color)}"></i>${esc(t.code)}</td><td>${esc(t.label)}<div class="small">${esc(t.desc || '')}</div></td><td><span class="small">${esc(t.vlabel)}:</span> ${t.variants.map((v) => esc(vText(t.code, v))).join(', ') || '—'}</td><td class="b">${z.NEW + z.REUSE}</td><td>${Number(S.state.limits[t.code] || 0)}</td><td class="nw"><button type="button" class="btn btn-g btn-sm" data-typeform="${esc(t.code)}">Edit</button>${usedType(t.code) ? '' : ` <button type="button" class="btn btn-g btn-sm red" data-deltype="${esc(t.code)}">Hapus</button>`}</td></tr>`; }).join('')}</tbody></table></div></div>`;
  const hubC = `<div class="card s6"><div class="ch"><div><div class="eyebrow">Bagikan</div><h2>Akses & Bagikan Link</h2><p>Link undangan Editor & Pelihat, daftar anggota, permintaan akses, serta izin menu & unduh Monitoring APD dikelola di Pusat Monitoring. Setiap link hanya berlaku untuk email yang diundang.</p></div></div><a class="btn btn-p" style="text-decoration:none" href="${HUB}#akses:${APP}">Buka Akses & Bagikan →</a></div>`;
  const whs = `<div class="card s6"><div class="ch"><div><div class="eyebrow">Lokasi stok</div><h2>Gudang</h2><p>Stok APD dihitung per gudang. Tambah gudang di jobsite agar stok tersebar tercatat rapi.</p></div></div>
    <form id="whForm" class="edf" novalidate><input id="whName" placeholder="Nama gudang, mis. Gudang C4" aria-label="Nama gudang baru" autocomplete="off"><button type="submit" class="btn btn-p">+ Tambah Gudang</button></form>
    <div class="edl">${WH.map((w) => { const n = TYPES.reduce((a, t) => { const z = stock(t, S.state, w); return a + z.NEW + z.REUSE; }, 0); return `<div><span class="em">${esc(w)}</span><span class="hs pr">${n} unit</span>${usedWh(w) || WH.length < 2 ? '' : `<button type="button" class="btn btn-g btn-sm red" data-delwh="${esc(w)}">Hapus</button>`}</div>`; }).join('')}</div></div>`;
  const shareUrl = S.share ? location.origin + location.pathname + '?k=' + S.share.key : '';
  const share = `<div class="card s6"><div class="ch"><div><div class="eyebrow">Bagikan</div><h2>Link untuk Pelihat</h2><p>Bagikan ke orang yang hanya boleh <b>melihat</b> Monitoring APD. Tidak bisa membuka Portal atau web lain.</p></div></div>${shareUrl ? `<div class="shl"><input type="text" id="shareUrl" readonly value="${esc(shareUrl)}" aria-label="Link untuk Pelihat"><button type="button" class="btn btn-p" id="shareCopy">Salin Link</button></div><p class="small" style="margin:10px 0">Link tersebar ke orang yang salah? Klik Ganti Link: link lama langsung mati.</p><button type="button" class="btn btn-g red" id="shareRot">Ganti Link</button>` : '<div class="upst"><span class="spin sm"></span>Memuat link…</div>'}</div>`;
  const ed = (S.access || []).filter((a) => a.role !== 'owner');
  const editors = `<div class="card s6"><div class="ch"><div><div class="eyebrow">Editor</div><h2>Kelola Editor APD</h2><p>Admin jobsite yang boleh mengajukan permintaan & membagikan APD. Mereka masuk lewat tombol Masuk.</p></div></div>
    <form id="edForm" class="edf" novalidate><input type="email" id="edEmail" placeholder="nama@email.com" aria-label="Email editor baru" autocomplete="off"><button type="submit" class="btn btn-p">+ Tambah Editor</button></form>
    <div class="edl">${S.access === null ? '<div class="upst"><span class="spin sm"></span>Memuat…</div>' : ed.map((a) => `<div><span class="em">${esc(a.email)}</span><span class="hs pr">${a.role === 'editor' ? 'Editor' : 'Pelihat terdaftar'}</span><button type="button" class="btn btn-g btn-sm red" data-rmed="${esc(a.email)}">Hapus</button></div>`).join('') || '<div class="small">Belum ada editor.</div>'}</div></div>`;
  const g = S.grants || [];
  const grants = `<div class="card s6"><div class="ch"><div><div class="eyebrow">Keamanan</div><h2>Izin Cetak Pelihat</h2><p>Pelihat yang login bisa meminta izin print/unduh. Setujui atau tolak di sini atau dari email.</p></div></div><div class="pgl2">${g.map((r) => `<div><span class="em">${esc(r.email)}</span><span class="hs ${r.status === 'approved' ? 'ok' : r.status === 'pending' ? 'hd' : 'no'}">${r.status === 'approved' ? 'Disetujui' : r.status === 'pending' ? 'Menunggu' : 'Ditolak'}</span>${r.status !== 'approved' ? `<button type="button" class="btn btn-p btn-sm" data-grant="approved|${esc(r.email)}">Setujui</button>` : ''}${r.status !== 'denied' ? `<button type="button" class="btn btn-g btn-sm red" data-grant="denied|${esc(r.email)}">${r.status === 'approved' ? 'Cabut' : 'Tolak'}</button>` : ''}<small>Diminta ${new Date(r.requested_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</small></div>`).join('') || '<div class="small">Belum ada permintaan.</div>'}</div></div>`;
  const data = `<div class="card s6"><div class="ch"><div><div class="eyebrow">Data</div><h2>Download & Backup</h2><p>Excel lengkap (ringkasan, stok per gudang, karyawan, permintaan, penerimaan, pengembalian, mutasi, koreksi, jadwal ganti) dan backup .json.</p></div></div><div class="mtools"><button type="button" class="btn btn-p" id="xlsBtn">Download Excel</button><button type="button" class="btn btn-g" id="bkBtn">Download Backup</button><button type="button" class="btn btn-g" id="rsBtn">Pulihkan dari Backup</button></div><input type="file" id="rsIn" accept=".json,application/json" hidden></div>`;
  return header('Sistem', 'Pengaturan', 'Jenis APD, gudang, akses, link Pelihat, izin cetak, dan data Monitoring APD.') + `<div class="grid">${types}</div><div class="grid">${hubC}${whs}${grants}${role}${data}</div>`;
}

// ---------- form & modal ----------
function modal(html) { $('dialog').innerHTML = html; $('modal').hidden = false; const f = $('dialog').querySelector('input:not([readonly]):not([type=hidden]),select'); if (f) setTimeout(() => f.focus(), 30); }
function closeModal() { $('modal').hidden = true; $('dialog').innerHTML = ''; $('dialog').className = 'dialog'; }
const mh = (eyebrow, ttl) => `<div class="cm-h"><div><div class="eyebrow">${eyebrow}</div><h2 id="mTitle">${ttl}</h2></div><button type="button" class="x" data-close aria-label="Tutup">×</button></div>`;
const actions = (label, danger) => `<div class="factions">${danger || ''}<span style="flex:1"></span><button type="button" class="btn btn-g" data-close>Batal</button><button type="submit" class="btn btn-p">${label}</button></div>`;
const vSel = (t, v, id) => `<div class="fld"><label for="${id}">${esc((ART[t] || {}).vlabel || 'Ukuran')}</label><select id="${id}" name="variant" ${(VARIANTS[t] || []).length ? 'required' : ''}>${(VARIANTS[t] || []).length ? '<option value="">Pilih</option>' : '<option value="">Tanpa ukuran</option>'}${(VARIANTS[t] || []).map((z) => `<option value="${esc(z)}" ${z === v ? 'selected' : ''}>${esc(vText(t, z))}</option>`).join('')}${v === 'BELUM DIISI' ? '<option value="BELUM DIISI" selected>Belum diisi (data lama)</option>' : ''}</select></div>`;
function confirmBox(ttl, sub, fn, label) {
  modal(`${mh('Konfirmasi', esc(ttl))}<p class="small" style="margin:10px 0 0">${sub}</p><form id="cfmForm">${actions(label || 'Ya, hapus')}</form>`);
  $('cfmForm').querySelector('[type=submit]').className = 'btn btn-d';
  $('cfmForm').onsubmit = async (e) => { e.preventDefault(); const r = await fn(); if (r !== false) closeModal(); };
}
function personForm(id) {
  const p = person(id); if (!p || !can()) return;
  modal(`${mh('Data karyawan', 'Edit ' + esc(p.name))}<div class="srcnote">Perubahan hanya berlaku di Monitoring APD, tidak mengubah Monitoring Manpower KMB.</div><form id="pForm"><div class="fgrid">
    <div class="fld"><label for="pf_n">Nama</label><input id="pf_n" name="name" required value="${esc(p.name)}"></div><div class="fld"><label for="pf_j">Jabatan</label><input id="pf_j" name="position" required value="${esc(p.position)}"></div>
    <div class="fld"><label for="pf_s">Jobsite</label><input id="pf_s" name="site" required value="${esc(p.site)}"></div><div class="fld"><label for="pf_st">Status</label><select id="pf_st" name="status"><option value="AKTIF" ${p.status === 'AKTIF' ? 'selected' : ''}>Aktif</option><option value="OUT" ${p.status === 'OUT' ? 'selected' : ''}>Keluar</option></select></div></div>${actions('Simpan')}</form>`);
  $('pForm').onsubmit = (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const n = structuredClone(S.state); n.personOverrides = { ...(n.personOverrides || {}), [id]: { name: f.name.trim(), position: f.position.trim(), site: f.site.trim(), status: f.status } }; persist(n, 'Data karyawan diperbarui di Monitoring APD.'); };
}
function receiptForm(pid, type, rid, src, req) {
  if (!can()) return; const p = person(pid); if (!p) return;
  const r = S.state.receipts.find((x) => x.id === rid) || { person: pid, type, date: today(), qty: req ? req.qty : 1, source: src || 'OLD', condition: 'LAYAK', months: 6, note: req ? 'Permintaan: ' + (req.reason || '') : '', variant: req ? req.variant : '', warehouse: WH[0] };
  if (!rid && r.source === 'OLD') r.condition = 'BELUM DIPERIKSA';
  const wsel = whOf(r.warehouse);
  modal(`${mh(req ? 'Bagikan sesuai permintaan' : rid ? 'Edit penerimaan' : r.source === 'OLD' ? 'Catat APD lama' : 'Bagikan APD', esc(p.name))}<div class="srcnote"><b>APD lama</b>: sudah dimiliki, tidak mengurangi gudang. <b>Baru / bekas dari gudang</b>: stok gudang yang dipilih berkurang. <b>Pihak luar</b> (PT. KKA / toko): tercatat tanpa mengurangi stok.</div><form id="rForm"><div class="fgrid">
    <div class="fld"><label for="rf_t">Jenis APD</label><select id="rf_t" name="type" ${req ? 'disabled' : ''}>${TYPES.map((t) => `<option value="${esc(t)}" ${r.type === t ? 'selected' : ''}>${esc(tLabel(t))}</option>`).join('')}</select></div><div id="rf_vw">${vSel(r.type, r.variant || (rid ? 'BELUM DIISI' : ''), 'rf_v')}</div>
    <div class="fld"><label for="rf_s">Asal APD</label><select id="rf_s" name="source">${Object.keys(SRC_LABEL).filter((k) => !req || k !== 'OLD').map((k) => `<option value="${k}" ${r.source === k ? 'selected' : ''}>${k === 'OLD' ? 'APD lama yang sudah dimiliki' : k === 'NEW' ? 'APD baru dari gudang' : k === 'REUSE' ? 'APD bekas layak dari gudang' : 'APD langsung dari pihak luar'}</option>`).join('')}</select></div>
    <div class="fld" id="rf_gw"><label for="rf_g">Dari gudang</label>${whSel('rf_g', wsel, 'wh')}</div>
    <div class="fld" id="rf_ew"><label for="rf_e">Asal APD eksternal</label><select id="rf_e" name="ext"><option ${r.warehouse === 'PT. KKA' ? 'selected' : ''}>PT. KKA</option><option ${r.warehouse === 'Toko Lainnya' ? 'selected' : ''}>Toko Lainnya</option></select></div>
    <div class="fld"><label for="rf_d">Tanggal diterima</label><input id="rf_d" type="date" name="date" required value="${esc(r.date)}"></div><div class="fld"><label for="rf_q">Jumlah</label><input id="rf_q" type="number" name="qty" min="1" step="1" required value="${r.qty}"></div>
    <div class="fld"><label for="rf_c">Kondisi saat ini</label><select id="rf_c" name="condition">${['BELUM DIPERIKSA', 'LAYAK', 'TIDAK LAYAK'].map((c) => `<option ${r.condition === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    <div class="fld" id="rf_mw"><label for="rf_m">Jatah ganti (bulan)</label><input id="rf_m" type="number" name="months" min="1" max="120" step="1" value="${r.months || 6}"><small class="small">Tanggal diterima + bulan = jadwal ganti.</small></div>
    <div class="fld full"><label for="rf_n">Keterangan / bukti</label><input id="rf_n" name="note" value="${esc(r.note || '')}"></div></div><div class="small" id="rf_h" style="margin-top:8px"></div>${actions(req ? 'Bagikan & Selesaikan Permintaan' : rid ? 'Simpan Perubahan' : 'Simpan')}</form>`);
  const mode = () => {
    const s = $('rf_s').value, old = s === 'OLD', ext = s === 'EXTERNAL', gd = s === 'NEW' || s === 'REUSE';
    $('rf_gw').hidden = !gd; $('rf_ew').hidden = !ext; $('rf_mw').hidden = old;
    const t = $('rf_t').value, v = $('rf_v').value || 'BELUM DIISI', z = variantStocks(t, S.state, $('rf_g').value)[v] || { NEW: 0, REUSE: 0 };
    $('rf_h').textContent = old ? 'APD lama tidak mengurangi stok gudang.' : ext ? 'APD pihak luar tidak mengurangi stok; jadwal ganti tetap dihitung.' : `Tersedia di ${$('rf_g').value}: baru ${z.NEW}, bekas layak ${z.REUSE}. Stok berkurang setelah disimpan.`;
  };
  $('rf_s').onchange = mode; $('rf_g').onchange = mode; $('rf_t').onchange = () => { $('rf_vw').innerHTML = vSel($('rf_t').value, '', 'rf_v'); $('rf_v').onchange = mode; mode(); }; $('rf_v').onchange = mode; mode();
  $('rForm').onsubmit = (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const t = req ? req.type : f.type;
    const w = f.source === 'OLD' ? '' : f.source === 'EXTERNAL' ? f.ext : f.wh;
    const v = { id: rid || uid(), person: pid, type: t, date: f.date, qty: Number(f.qty), source: f.source, warehouse: w, variant: f.variant, months: f.source === 'OLD' ? 0 : Number(f.months || 6), condition: f.condition, note: f.note };
    if (req) v.requestId = req.id; else if (rid) { const o = S.state.receipts.find((x) => x.id === rid); if (o && o.requestId) v.requestId = o.requestId; }
    const n = structuredClone(S.state); if (rid) { const i = n.receipts.findIndex((x) => x.id === rid); if (i < 0) return; n.receipts[i] = v; } else n.receipts.push(v);
    if (req) { const x = n.requests.find((y) => y.id === req.id); if (x) { x.status = 'fulfilled'; x.receiptId = v.id; x.fulfilledBy = S.user.email; x.fulfilledAt = today(); } }
    persist(n, req ? 'APD dibagikan dan permintaan selesai.' : 'Penerimaan APD tersimpan. Kepemilikan dan jadwal ganti diperbarui.');
  };
}
function returnForm(rid, retId) {
  if (!can()) return; const x = S.state.returns.find((a) => a.id === retId); const r = S.state.receipts.find((a) => a.id === (x ? x.receiptId : rid)); if (!r) return;
  const p = person(r.person) || { name: personName(r.person), status: 'OUT' };
  if (!x && p.status !== 'OUT') { toast('Pengembalian dicatat setelah status karyawan Keluar di Monitoring Manpower.', true); return; }
  const left = heldLot(r) + (x ? qty(x.qty) : 0);
  modal(`${mh(x ? 'Edit pengembalian' : 'Pengembalian APD', esc(p.name) + ' · ' + esc(tLabel(r.type)))}<div class="srcnote"><b>Layak</b>: masuk stok bekas layak di gudang yang dipilih. <b>Tidak layak</b>: dicatat dimusnahkan.</div><form id="tForm"><div class="fgrid">
    <div class="fld"><label for="tf_d">Tanggal kembali</label><input id="tf_d" type="date" name="date" required min="${esc(r.date)}" value="${esc(x ? x.date : today())}"></div><div class="fld"><label for="tf_q">Jumlah (maks ${left})</label><input id="tf_q" type="number" name="qty" min="1" max="${left}" step="1" required value="${x ? x.qty : left}"></div>
    <div class="fld"><label for="tf_a">Hasil pemeriksaan</label><select id="tf_a" name="action"><option value="REUSE" ${x && x.action === 'REUSE' ? 'selected' : ''}>Layak — masuk stok bekas</option><option value="DESTROY" ${x && x.action === 'DESTROY' ? 'selected' : ''}>Tidak layak — musnahkan</option></select></div>
    <div class="fld" id="tf_gw"><label for="tf_g">Masuk ke gudang</label>${whSel('tf_g', whOf(x ? x.warehouse || r.warehouse : r.warehouse), 'warehouse')}</div>
    <div class="fld full"><label for="tf_n">Keterangan</label><input id="tf_n" name="note" value="${esc(x ? x.note || '' : '')}"></div></div>${actions('Simpan Pengembalian')}</form>`);
  const m = () => { $('tf_gw').hidden = $('tf_a').value !== 'REUSE'; }; $('tf_a').onchange = m; m();
  $('tForm').onsubmit = (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const v = { id: retId || uid(), receiptId: r.id, date: f.date, qty: Number(f.qty), action: f.action, warehouse: f.action === 'REUSE' ? f.warehouse : '', note: f.note }; const n = structuredClone(S.state); if (retId) { const i = n.returns.findIndex((a) => a.id === retId); n.returns[i] = v; } else n.returns.push(v); persist(n, 'Pengembalian tersimpan.'); };
}
function stockForm(id, type) {
  if (!isOwner()) return; const x = S.state.stockIn.find((t) => t.id === id) || { date: today(), type: TYPES.includes(type) ? type : TYPES[0], grade: 'NEW', qty: 1, location: ui.wh !== 'ALL' ? ui.wh : WH[0], note: '', variant: '' };
  modal(`${mh('Gudang', id ? 'Edit Stok Masuk' : 'Tambah Stok Masuk')}<div class="srcnote">Hanya untuk barang di gudang. APD yang sudah dipakai karyawan dicatat lewat Catat APD Lama.</div><form id="sForm"><div class="fgrid">
    <div class="fld"><label for="sf_d">Tanggal masuk</label><input id="sf_d" type="date" name="date" required value="${esc(x.date)}"></div><div class="fld"><label for="sf_w">Gudang</label>${whSel('sf_w', whOf(x.location), 'location')}</div>
    <div class="fld"><label for="sf_t">Jenis APD</label><select id="sf_t" name="type">${TYPES.map((t) => `<option value="${esc(t)}" ${x.type === t ? 'selected' : ''}>${esc(tLabel(t))}</option>`).join('')}</select></div><div id="sf_vw">${vSel(x.type, x.variant || (id ? 'BELUM DIISI' : ''), 'sf_v')}</div>
    <div class="fld"><label for="sf_g">Kondisi</label><select id="sf_g" name="grade"><option value="NEW" ${x.grade === 'NEW' ? 'selected' : ''}>Barang baru</option><option value="REUSE" ${x.grade === 'REUSE' ? 'selected' : ''}>Bekas layak (stok awal)</option></select></div>
    <div class="fld"><label for="sf_q">Jumlah</label><input id="sf_q" type="number" name="qty" min="1" step="1" required value="${x.qty}"></div>
    <div class="fld full"><label for="sf_n">Keterangan (no. PO / surat jalan / supplier)</label><input id="sf_n" name="note" value="${esc(x.note || '')}"></div></div>${actions(id ? 'Simpan Perubahan' : 'Simpan Stok Masuk')}</form>`);
  $('sf_t').onchange = () => { $('sf_vw').innerHTML = vSel($('sf_t').value, '', 'sf_v'); };
  $('sForm').onsubmit = (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const v = { id: id || uid(), date: f.date, type: f.type, grade: f.grade, variant: f.variant, qty: Number(f.qty), location: f.location, note: f.note }; const n = structuredClone(S.state); if (id) n.stockIn[n.stockIn.findIndex((a) => a.id === id)] = v; else n.stockIn.push(v); persist(n, 'Stok masuk tersimpan.'); };
}
function transferForm(t, req) {
  if (!isOwner()) return; if (WH.length < 2) { toast('Tambahkan minimal 2 gudang dulu di Pengaturan → Gudang.', true); return; }
  const to0 = req ? req.warehouse : null, from0 = req ? (WH.find((w) => w !== to0 && ((variantStocks(req.type, S.state, w)[variant(req)] || {}).NEW || 0) >= req.qty) || WH.find((w) => w !== to0)) : ui.wh !== 'ALL' ? ui.wh : WH[0], toX = to0 || WH.find((w) => w !== from0);
  modal(`${mh(req ? 'Kirim stok sesuai permintaan' : 'Gudang', 'Mutasi Stok Antar Gudang')}<form id="xForm"><div class="fgrid">
    <div class="fld"><label for="xf_t">Jenis APD</label><select id="xf_t" name="type">${TYPES.map((c) => `<option value="${esc(c)}" ${c === t ? 'selected' : ''}>${esc(tLabel(c))}</option>`).join('')}</select></div><div id="xf_vw">${vSel(t, req ? req.variant : '', 'xf_v')}</div>
    <div class="fld"><label for="xf_f">Dari gudang</label>${whSel('xf_f', from0, 'from')}</div><div class="fld"><label for="xf_o">Ke gudang</label>${whSel('xf_o', toX, 'to')}</div>
    <div class="fld"><label for="xf_g">Kondisi</label><select id="xf_g" name="grade"><option value="NEW">Baru</option><option value="REUSE">Bekas layak</option></select></div><div class="fld"><label for="xf_q">Jumlah</label><input id="xf_q" type="number" name="qty" min="1" step="1" required value="${req ? req.qty : 1}"></div>
    <div class="fld"><label for="xf_d">Tanggal</label><input id="xf_d" type="date" name="date" required value="${today()}"></div><div class="fld"><label for="xf_n">Keterangan</label><input id="xf_n" name="note" placeholder="mis. kirim ke jobsite C4"></div></div><div class="small" id="xf_h" style="margin-top:8px"></div>${actions('Simpan Mutasi')}</form>`);
  const h = () => { const z = variantStocks($('xf_t').value, S.state, $('xf_f').value)[$('xf_v').value || 'BELUM DIISI'] || { NEW: 0, REUSE: 0 }; $('xf_h').textContent = `Tersedia di ${$('xf_f').value}: baru ${z.NEW}, bekas layak ${z.REUSE}.`; };
  ['xf_f', 'xf_g'].forEach((i) => { $(i).onchange = h; }); $('xf_v').onchange = h; $('xf_t').onchange = () => { $('xf_vw').innerHTML = vSel($('xf_t').value, '', 'xf_v'); $('xf_v').onchange = h; h(); }; h();
  $('xForm').onsubmit = (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); if (f.from === f.to) { toast('Gudang asal dan tujuan harus berbeda.', true); return; } const n = structuredClone(S.state); const xid = uid(); if (req) { const q = n.requests.find((y) => y.id === req.id); if (q) { q.status = 'fulfilled'; q.transferId = xid; q.fulfilledBy = S.user.email; q.fulfilledAt = f.date; } } n.transfers.push({ id: xid, date: f.date, type: f.type, variant: f.variant, grade: f.grade, qty: Number(f.qty), from: f.from, to: f.to, note: f.note, by: S.user.email }); persist(n, req ? `Stok dikirim ke ${f.to}. Permintaan selesai.` : `Mutasi ${f.qty} ${tLabel(f.type)} ${f.from} → ${f.to} tersimpan.`); };
}
function opnameForm(t) {
  if (!isOwner()) return;
  const wh0 = ui.wh !== 'ALL' ? ui.wh : WH[0];
  const draw = (wh) => {
    const z = variantStocks(t, S.state, wh), vs = [...(VARIANTS[t] || []), ...(z['BELUM DIISI'] && (z['BELUM DIISI'].NEW || z['BELUM DIISI'].REUSE) ? ['BELUM DIISI'] : [])], vlist = vs.length ? vs : ['BELUM DIISI'];
    return { z, vlist, html: vlist.map((v, i) => { const s = z[v] || { NEW: 0, REUSE: 0 }; return `<tr><td class="b">${t === 'HELM' && HELM_DOT[v] ? `<i class="dot" style="background:${HELM_DOT[v]}"></i>` : ''}${esc(vText(t, v))}</td><td>${s.NEW}</td><td><input type="number" min="0" step="1" name="n${i}" value="${s.NEW}" aria-label="Stok baru fisik ${esc(v)}"></td><td>${s.REUSE}</td><td><input type="number" min="0" step="1" name="r${i}" value="${s.REUSE}" aria-label="Stok bekas fisik ${esc(v)}"></td></tr>`; }).join('') };
  };
  let cur = draw(wh0);
  modal(`${mh('Stok opname', 'Edit Stok Gudang · ' + esc(tLabel(t)))}<div class="srcnote">Pilih gudang, lalu isi jumlah <b>fisik</b> hasil hitung. Sistem mencatat selisihnya sebagai koreksi stok. Riwayat pembagian karyawan tidak berubah.</div><form id="oForm"><div class="fgrid"><div class="fld"><label for="of_w">Gudang</label>${whSel('of_w', wh0, 'location')}</div><div class="fld"><label for="of_d">Tanggal hitung</label><input id="of_d" type="date" name="date" required value="${today()}"></div></div>
    <div class="tw" style="margin-top:12px"><table class="t opn"><thead><tr><th>${esc(ART[t].vlabel)}</th><th>Baru (sistem)</th><th>Baru (fisik)</th><th>Bekas layak (sistem)</th><th>Bekas layak (fisik)</th></tr></thead><tbody id="of_rows">${cur.html}</tbody></table></div>
    <div class="fgrid" style="margin-top:12px"><div class="fld full"><label for="of_n">Alasan / keterangan</label><input id="of_n" name="note" required placeholder="mis. Stok opname Oktober, barang rusak, salah input"></div></div>${actions('Simpan Stok Gudang')}</form>`);
  $('of_w').onchange = () => { cur = draw($('of_w').value); $('of_rows').innerHTML = cur.html; };
  $('oForm').onsubmit = (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const n = structuredClone(S.state); let k = 0;
    cur.vlist.forEach((v, i) => [['NEW', 'n'], ['REUSE', 'r']].forEach(([g, p]) => { const want = Number(f[p + i]); if (!Number.isInteger(want) || want < 0) return; const s = cur.z[v] || { NEW: 0, REUSE: 0 }; const diff = want - s[g]; if (diff) { n.adjust.push({ id: uid(), date: f.date, type: t, variant: v === 'BELUM DIISI' ? '' : v, grade: g, qty: diff, location: f.location, note: f.note, by: S.user.email }); k++; } }));
    if (!k) { toast('Tidak ada perubahan jumlah.'); closeModal(); return; }
    persist(n, `Stok ${tLabel(t)} di ${f.location} diperbarui (${k} koreksi tercatat).`);
  };
}
function minForm(t) {
  if (!isOwner()) return;
  modal(`${mh('Gudang', 'Stok Minimum ' + esc(tLabel(t)))}<form id="mForm"><div class="fgrid"><div class="fld full"><label for="mf">Minimal stok total (unit)</label><input id="mf" type="number" name="min" min="0" step="1" required value="${Number(S.state.limits[t] || 0)}"><small class="small">Jika stok semua gudang di bawah angka ini, Dashboard menampilkan "Stok menipis".</small></div></div>${actions('Simpan')}</form>`);
  $('mForm').onsubmit = (e) => { e.preventDefault(); const v = Number(new FormData(e.target).get('min')); if (!Number.isSafeInteger(v) || v < 0) { toast('Isi bilangan bulat 0 atau lebih.', true); return; } const n = structuredClone(S.state); n.limits = { ...n.limits, [t]: v }; persist(n, 'Stok minimum diperbarui.'); };
}
function typeForm(code) {
  if (!isOwner()) return;
  const t = S.state.types.find((x) => x.code === code) || { code: '', label: '', vlabel: 'Ukuran', unit: 'Pcs', price: 0, variants: [], color: PALETTE[S.state.types.length % PALETTE.length], desc: '' };
  const used = code ? usedType(code) : false;
  modal(`${mh('Jenis APD', code ? 'Edit ' + esc(t.label) : 'Tambah Jenis APD')}<form id="yForm"><div class="fgrid">
    <div class="fld"><label for="yf_l">Nama APD</label><input id="yf_l" required value="${esc(t.label)}" placeholder="mis. Sarung Tangan"></div>
    <div class="fld"><label for="yf_c">Kode singkat</label><input id="yf_c" required value="${esc(t.code)}" ${code ? 'readonly' : ''} placeholder="mis. SARUNG" style="text-transform:uppercase"><small class="small">${code ? 'Kode tidak bisa diubah.' : 'Huruf/angka, tanpa spasi. Otomatis dari nama.'}</small></div>
    <div class="fld"><label for="yf_v">Label ukuran / warna</label><input id="yf_v" value="${esc(t.vlabel)}" placeholder="mis. Ukuran, Warna"></div>
    <div class="fld"><label for="yf_col">Warna grafik</label><input id="yf_col" type="color" value="${esc(t.color)}" style="height:40px;padding:2px"></div>
    <div class="fld full"><label for="yf_vs">Daftar ukuran / warna (pisahkan dengan koma)</label><input id="yf_vs" value="${esc(t.variants.join(', '))}" placeholder="mis. S, M, L, XL — kosongkan jika tanpa ukuran"><small class="small">${used ? 'Ukuran yang sudah dipakai di transaksi tidak bisa dihapus.' : ''}</small></div>
    <div class="fld"><label for="yf_u">Satuan (Form GA)</label><input id="yf_u" value="${esc(t.unit || 'Pcs')}" placeholder="Pcs / Pasang / Set"></div>
    <div class="fld"><label for="yf_p">Estimasi harga satuan (Rp)</label><input id="yf_p" type="number" min="0" step="500" value="${Number(t.price) || 0}"></div>
    <div class="fld full"><label for="yf_d">Keterangan singkat</label><input id="yf_d" value="${esc(t.desc)}" placeholder="mis. Pelindung tangan saat bekerja"></div></div>${actions(code ? 'Simpan' : 'Tambah Jenis APD')}</form>`);
  if (!code) $('yf_l').oninput = () => { $('yf_c').value = $('yf_l').value.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12); };
  $('yForm').onsubmit = (e) => {
    e.preventDefault();
    const c = (code || $('yf_c').value).toUpperCase().replace(/[^A-Z0-9]+/g, '');
    if (!c) { toast('Isi kode singkat.', true); return; }
    if (!code && S.state.types.some((x) => x.code === c)) { toast('Kode ' + c + ' sudah dipakai.', true); return; }
    const vs = [...new Set($('yf_vs').value.split(',').map((x) => x.trim()).filter(Boolean))];
    const nt = { code: c, label: $('yf_l').value.trim(), vlabel: $('yf_v').value.trim() || 'Ukuran', variants: vs, color: $('yf_col').value, desc: $('yf_d').value.trim(), unit: $('yf_u').value.trim() || 'Pcs', price: Math.max(0, Number($('yf_p').value) || 0) };
    const n = structuredClone(S.state); const i = n.types.findIndex((x) => x.code === c); if (i >= 0) n.types[i] = nt; else n.types.push(nt);
    if (n.limits[c] == null) n.limits[c] = 0;
    persist(n, code ? 'Jenis APD diperbarui.' : `Jenis APD ${nt.label} ditambahkan. Pasang gambarnya di menu Gambar APD.`);
  };
}
function delRecord(kind, id) {
  if (!can()) return;
  const col = { stock: 'stockIn', receipt: 'receipts', return: 'returns', adjust: 'adjust', transfer: 'transfers' }[kind]; const rec = S.state[col].find((x) => x.id === id); if (!rec) return;
  if (['stock', 'adjust', 'transfer'].includes(kind) && !isOwner()) return;
  if (kind === 'receipt' && S.state.returns.some((x) => x.receiptId === id)) { toast('APD ini punya catatan pengembalian. Hapus pengembaliannya dulu.', true); return; }
  const lbl = { stock: 'stok masuk', receipt: 'penerimaan APD', return: 'pengembalian APD', adjust: 'koreksi stok', transfer: 'mutasi gudang' }[kind];
  const r = kind === 'return' ? S.state.receipts.find((x) => x.id === rec.receiptId) : rec;
  const who = kind === 'transfer' ? `${rec.from} → ${rec.to}` : ['stock', 'adjust'].includes(kind) ? 'Gudang ' + whOf(rec.location) : personName(r && r.person);
  confirmBox(`Hapus ${lbl}?`, `${esc(who)} · ${esc(tLabel((r || rec).type))} · ${fmt(rec.date)} · ${rec.qty} unit. Stok dan kepemilikan dihitung ulang, dan penghapusan tercatat di Riwayat Hapus.`, async () => {
    const n = structuredClone(S.state); n[col] = n[col].filter((x) => x.id !== id);
    if (kind === 'transfer') n.requests.forEach((q) => { if (q.transferId === id && q.status === 'fulfilled') { q.status = 'approved'; delete q.transferId; } });
    if (kind === 'receipt' && rec.requestId) { const q = n.requests.find((y) => y.id === rec.requestId); if (q && q.status === 'fulfilled') { q.status = 'approved'; delete q.receiptId; } }
    return persist(n, `Data ${lbl} dihapus.`, { kind, id, data: { ...rec, type: (r || rec).type, person: r && r.person } });
  });
}
async function centerImage(src) {
  const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Gambar tidak terbaca.')); i.src = src; });
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; if (c.width * c.height > 3e7) throw new Error('Resolusi gambar terlalu besar.');
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); const px = x.getImageData(0, 0, c.width, c.height).data;
  let a = c.width, b = c.height, e = -1, f = -1; const st = Math.max(1, Math.floor(Math.max(c.width, c.height) / 900));
  for (let yy = 0; yy < c.height; yy += st) for (let xx = 0; xx < c.width; xx += st) { const p = (yy * c.width + xx) * 4; if (px[p + 3] < 65 || (px[p] > 245 && px[p + 1] > 245 && px[p + 2] > 245)) continue; if (xx < a) a = xx; if (yy < b) b = yy; if (xx > e) e = xx; if (yy > f) f = yy; }
  if (e < 0) { a = 0; b = 0; e = c.width - 1; f = c.height - 1; }
  const w = e - a + 1, h = f - b + 1, s = Math.min(580 / w, 580 / h, 1.8), o = document.createElement('canvas'); o.width = 720; o.height = 720;
  o.getContext('2d').drawImage(c, a, b, w, h, (720 - w * s) / 2, (720 - h * s) / 2, w * s, h * s);
  let out = o.toDataURL('image/webp', 0.8); if (!out.startsWith('data:image/webp')) out = o.toDataURL('image/png');
  if (out.length > 650000) throw new Error('Gambar masih terlalu besar. Gunakan JPG/WEBP yang lebih kecil.'); return out;
}

// ---------- Excel & backup ----------
function exportExcel() {
  if (!isOwner() && !PRINT_OK()) { askPrint(); return; }
  if (!window.XLSX) { toast('Modul Excel belum termuat. Coba lagi sebentar.', true); return; }
  const wb = XLSX.utils.book_new(), add = (n, rows, w) => { const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = w.map((x) => ({ wch: x })); XLSX.utils.book_append_sheet(wb, ws, n); };
  add('RINGKASAN', [['MONITORING APD KMB'], ['Tanggal ekspor', today()], ['Manpower aktif', S.people.filter((p) => p.status === 'AKTIF').length], ['Manpower keluar', S.people.filter((p) => p.status === 'OUT').length], ['Permintaan menunggu', S.state.requests.filter((r) => r.status === 'pending').length], [], ['Jenis APD', 'Stok Baru', 'Stok Bekas Layak', 'Total Stok', 'Dipegang Karyawan', 'Dimusnahkan', 'Minimal Stok', 'Jatuh Tempo'], ...TYPES.map((t) => { const x = stock(t); return [tLabel(t), x.NEW, x.REUSE, x.NEW + x.REUSE, S.people.reduce((n, p) => n + held(p.id, t), 0), x.DESTROYED, Number(S.state.limits[t] || 0), schedules().filter((y) => y.t === t && y.days <= 0).length]; })], [26, 12, 16, 12, 18, 14, 13, 13]);
  if (isOwner()) add('STOK PER GUDANG', [['Jenis', 'Ukuran/Warna', ...WH.flatMap((w) => [w + ' Baru', w + ' Bekas']), 'Total'], ...TYPES.flatMap((t) => [...(VARIANTS[t] || []), 'BELUM DIISI'].map((v) => { const per = WH.flatMap((w) => { const z = variantStocks(t, S.state, w)[v] || { NEW: 0, REUSE: 0 }; return [z.NEW, z.REUSE]; }); return [tLabel(t), vText(t, v), ...per, per.reduce((a, c) => a + c, 0)]; }).filter((r) => r[r.length - 1] || r[1] !== 'Belum diisi'))], [18, 14, ...WH.flatMap(() => [12, 12]), 9]);
  add('KARYAWAN', [['Nama', 'Jabatan', 'Jobsite', 'Status', ...TYPES.flatMap((t) => [t + ' Dipegang', t + ' Terakhir', t + ' Ganti'])], ...S.people.map((p) => [p.name, p.position, p.site, p.status === 'AKTIF' ? 'Aktif' : 'Keluar', ...TYPES.flatMap((t) => [held(p.id, t), (latest(p.id, t) || {}).date || '', due(p.id, t) || ''])])], [26, 22, 20, 10, ...TYPES.flatMap(() => [12, 13, 13])]);
  add('PERMINTAAN', [['Tanggal', 'Nama', 'Jobsite', 'Jenis', 'Ukuran/Warna', 'Jumlah', 'Alasan', 'Catatan', 'Diajukan oleh', 'Status', 'Diputuskan oleh', 'Tgl Putusan', 'Catatan Putusan'], ...S.state.requests.map((r) => [r.date, reqWho(r), r.site || (person(r.person) || {}).site || '', r.type, vText(r.type, variant(r)), Number(r.qty), r.reason || '', r.note || '', r.by || '', (REQ_ST[r.status] || [r.status])[0], r.decidedBy || '', r.decidedAt || '', r.decisionNote || ''])], [12, 24, 18, 10, 12, 8, 24, 24, 26, 18, 26, 12, 24]);
  if (isOwner()) add('STOK MASUK', [['Tanggal', 'Gudang', 'Jenis', 'Ukuran/Warna', 'Kondisi', 'Jumlah', 'Keterangan'], ...S.state.stockIn.map((x) => [x.date, whOf(x.location), x.type, vText(x.type, variant(x)), x.grade === 'NEW' ? 'Baru' : 'Bekas layak', Number(x.qty), x.note || ''])], [12, 16, 10, 14, 12, 8, 30]);
  if (isOwner() && S.state.transfers.length) add('MUTASI GUDANG', [['Tanggal', 'Jenis', 'Ukuran/Warna', 'Kondisi', 'Jumlah', 'Dari', 'Ke', 'Keterangan', 'Oleh'], ...S.state.transfers.map((x) => [x.date, x.type, vText(x.type, variant(x)), x.grade === 'REUSE' ? 'Bekas layak' : 'Baru', Number(x.qty), x.from, x.to, x.note || '', x.by || ''])], [12, 10, 14, 12, 8, 16, 16, 28, 26]);
  if (isOwner() && S.state.adjust.length) add('KOREKSI STOK', [['Tanggal', 'Gudang', 'Jenis', 'Warna/Ukuran', 'Kondisi', 'Selisih', 'Alasan', 'Oleh'], ...S.state.adjust.map((x) => [x.date, whOf(x.location), x.type, vText(x.type, variant(x)), x.grade === 'REUSE' ? 'Bekas layak' : 'Baru', Number(x.qty), x.note || '', x.by || ''])], [12, 16, 10, 14, 12, 9, 34, 26]);
  if (isOwner() && S.state.ga.docs.length) add('FORM GA REQUEST', [['No. Urut', 'Tanggal', 'Lokasi', 'Dept', 'Deskripsi', 'Jumlah', 'Satuan', 'Estimasi Harga', 'Total', 'Site', 'Keterangan', 'Status', 'Tgl Datang', 'Qty Datang'], ...S.state.ga.docs.flatMap((d) => d.items.map((x) => [d.no, d.date, d.lokasi, d.dept, x.desc, Number(x.qty), x.unit, Number(x.price) || 0, (Number(x.qty) || 0) * (Number(x.price) || 0), x.site, x.note, d.status === 'CLOSE' ? 'Barang datang' : 'Open', d.receivedAt || '', x.got ?? '']))], [30, 12, 14, 8, 26, 8, 8, 14, 14, 16, 34, 14, 12, 10]);
  add('PENERIMAAN APD', [['Nama', 'Jobsite', 'Jenis', 'Ukuran/Warna', 'Asal', 'Gudang / Asal', 'Tanggal', 'Jumlah', 'Masih Dipegang', 'Kondisi', 'Jatah Bulan', 'Jadwal Ganti', 'Keterangan'], ...S.state.receipts.map((r) => [personName(r.person), (person(r.person) || {}).site || '', r.type, vText(r.type, variant(r)), SRC_LABEL[r.source], r.source === 'OLD' ? '' : r.source === 'EXTERNAL' ? r.warehouse || '' : whOf(r.warehouse), r.date, Number(r.qty), heldLot(r), r.condition || '', r.source === 'OLD' ? '' : Number(r.months || 6), r.source === 'OLD' ? '' : addMonths(r.date, r.months), r.note || ''])], [24, 18, 9, 12, 18, 16, 12, 8, 13, 15, 11, 13, 28]);
  add('PENGEMBALIAN', [['Tanggal', 'Nama', 'Jenis', 'Jumlah', 'Hasil', 'Ke Gudang', 'Keterangan'], ...S.state.returns.map((x) => { const r = S.state.receipts.find((a) => a.id === x.receiptId) || {}; return [x.date, personName(r.person), r.type || '', Number(x.qty), x.action === 'REUSE' ? 'Layak - stok bekas' : 'Tidak layak - dimusnahkan', x.action === 'REUSE' ? whOf(x.warehouse || r.warehouse) : '', x.note || '']; })], [12, 24, 9, 8, 24, 16, 30]);
  add('JADWAL GANTI', [['Nama', 'Jabatan', 'Jobsite', 'Jenis', 'Terakhir Terima', 'Jatah Bulan', 'Jadwal Ganti', 'Sisa Hari', 'Status'], ...schedules().map((x) => [x.p.name, x.p.position, x.p.site, x.t, x.x.date, Number(x.x.months), x.d, x.days, x.days <= 0 ? 'JATUH TEMPO' : x.days <= 30 ? 'SEGERA' : 'TERJADWAL'])], [24, 20, 18, 9, 14, 11, 13, 9, 13]);
  XLSX.writeFile(wb, `Monitoring_APD_KMB_${today()}.xlsx`, { compression: true });
}
function download(name, text) { const u = URL.createObjectURL(new Blob([text], { type: 'application/json' })); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000); }

// ---------- Pelihat: watermark, anti-screenshot, izin cetak ----------
const PRINT_OK = () => isOwner() || permOf(ui.page, 'd') || (!can() && !!S.grant && S.grant.status === 'approved');
function wmPaint() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0'), who = (S.user && S.user.email) || 'Pelihat · tanpa login';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="220"><g transform="rotate(-22 190 110)" font-family="Plus Jakarta Sans,Segoe UI,sans-serif" text-anchor="middle" fill="#1E1B3A" fill-opacity=".085"><text x="190" y="100" font-size="17" font-weight="800">MONITORING APD · RAHASIA</text><text x="190" y="126" font-size="13" font-weight="600">${esc(who)} · ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}</text></g></svg>`;
  $('wm').style.backgroundImage = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}
function guardSync() { const lock = !PRINT_OK(); document.body.classList.toggle('nop', lock); if (!lock) $('shield').hidden = true; wmPaint(); document.querySelectorAll('#printBtn,#xlsBtn').forEach((b) => b.classList.toggle('lk', lock)); }
const shieldOn = () => { if (!PRINT_OK()) $('shield').hidden = false; };
window.addEventListener('blur', shieldOn);
document.addEventListener('visibilitychange', () => { if (document.hidden) shieldOn(); });
window.addEventListener('focus', () => setTimeout(() => { $('shield').hidden = true; }, 250));
function askPrint() {
  if (can()) { modal(`${mh('Print & unduh', 'Dimatikan di menu ini')}<p class="small">Pemilik tidak mengizinkan print / unduh di menu ini untuk Editor.</p><form id="ap0">${actions('Tutup')}</form>`); $('ap0').onsubmit = (e) => { e.preventDefault(); closeModal(); }; return; }
  if (!S.user) {
    modal(`${mh('Izin cetak', 'Print & unduh perlu izin Pemilik')}<p class="small">Sebagai Pelihat, Anda hanya bisa melihat. Masuk dengan email Anda, lalu kirim permintaan izin ke Pemilik.</p><form id="ap1">${actions('Masuk')}</form>`);
    $('ap1').onsubmit = (e) => { e.preventDefault(); closeModal(); openLogin(); }; return;
  }
  const st = S.grant && S.grant.status;
  modal(`${mh('Izin cetak', st === 'pending' ? 'Permintaan sedang ditinjau' : st === 'denied' ? 'Permintaan ditolak' : 'Minta izin cetak')}<p class="small">${st === 'pending' ? 'Pemilik sudah menerima permintaan Anda. Halaman ini otomatis terbuka setelah disetujui.' : st === 'denied' ? 'Pemilik menolak permintaan sebelumnya. Anda bisa mengajukan ulang.' : 'Kirim permintaan ke Pemilik untuk print, simpan PDF, dan unduh Excel Monitoring APD.'}</p><form id="ap2">${actions(st === 'pending' ? 'Kirim ulang' : 'Kirim permintaan')}</form>`);
  $('ap2').onsubmit = async (e) => {
    e.preventDefault(); const em = S.user.email.toLowerCase();
    const row = { app_id: APP, email: em, status: 'pending', requested_at: new Date().toISOString(), decided_at: null };
    const r = S.grant ? await S.sb.from('kta_print_grants').update(row).eq('app_id', APP).eq('email', em) : await S.sb.from('kta_print_grants').insert(row);
    if (r.error) { toast('Gagal mengirim: ' + r.error.message, true); return; }
    let mailed = false; try { const { data } = await S.sb.functions.invoke('kta-print', { body: { op: 'notify', app: APP } }); mailed = !!(data && data.ok); } catch (er) {}
    S.grant = { status: 'pending' }; closeModal(); toast(mailed ? 'Permintaan terkirim ke email Pemilik.' : 'Permintaan tercatat. Pemilik akan melihatnya di Pengaturan.');
  };
}
document.addEventListener('keydown', (e) => {
  if (PRINT_OK()) return; const k = (e.key || '').toLowerCase();
  if ((e.ctrlKey || e.metaKey) && (k === 'p' || k === 's')) { e.preventDefault(); e.stopImmediatePropagation(); askPrint(); return; }
  if ((e.ctrlKey || e.metaKey) && (k === 'c' || k === 'x') && !e.target.closest('input,textarea')) { e.preventDefault(); return; }
  if (k === 'meta' || k === 'os' || k === 'printscreen') shieldOn();
}, true);
document.addEventListener('keyup', (e) => { if (!PRINT_OK() && (e.key || '').toLowerCase() === 'printscreen') { shieldOn(); toast('Screenshot tidak diizinkan untuk Pelihat.', true); } }, true);
['contextmenu', 'copy', 'cut', 'dragstart'].forEach((ev) => document.addEventListener(ev, (e) => { if (!PRINT_OK() && !(e.target.closest && e.target.closest('input,textarea,select'))) e.preventDefault(); }, true));
window.addEventListener('beforeprint', () => { if (!PRINT_OK()) document.body.classList.add('nop'); });

// ---------- kunci & login ----------
function lockScreen() {
  let el = $('lockScr');
  if (!el) { document.body.insertAdjacentHTML('beforeend', `<div id="lockScr" role="dialog" aria-modal="true" aria-labelledby="lockT"><div class="lk"><span class="lkm">M</span><h2 id="lockT"></h2><p id="lockP"></p><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button type="button" class="btn btn-p" id="lockIn">Masuk</button><button type="button" class="btn btn-p" id="lockAsk" hidden>Minta Akses</button><a class="btn btn-g" href="${HUB}" style="text-decoration:none">Pusat Monitoring</a></div></div></div>`); el = $('lockScr'); }
  $('lockT').textContent = S.user ? 'Belum punya akses ke Monitoring APD' : 'Masuk untuk membuka';
  $('lockP').innerHTML = S.user ? `Akun <b>${esc(S.user.email)}</b> belum terdaftar di Monitoring APD. Buka link undangan yang dikirim ke email Anda, atau klik <b>Minta Akses</b> agar Pemilik/Editor menyetujuinya.${S.asked ? '<br><b>Permintaan sudah terkirim.</b> Muat ulang setelah disetujui.' : ''}` : 'Monitoring APD hanya bisa dibuka oleh email yang diundang Pemilik atau Editor. Masuk dengan email Anda, atau buka dari <b>Pusat Monitoring</b>.';
  $('lockIn').hidden = !!S.user; $('lockAsk').hidden = !S.user || S.asked; el.hidden = false; document.body.classList.add('locked');
}
document.addEventListener('click', async (e) => {
  if (!e.target.closest('#lockAsk')) return; e.stopPropagation();
  const { data, error } = await S.sb.rpc('kta_access_ask', { p_app: APP, p_note: null });
  if (error) { toast('Gagal mengirim permintaan: ' + error.message, true); return; }
  S.asked = true; toast(data === 'member' ? 'Akun ini sudah punya akses. Muat ulang halaman.' : 'Permintaan akses terkirim ke Pemilik/Editor.'); lockScreen();
}, true);
function unlock() { const el = $('lockScr'); if (el) el.hidden = true; document.body.classList.remove('locked'); }
function openLogin() {
  modal(`${mh('Masuk', 'Masuk ke Monitoring')}<p class="small">Editor: gunakan email yang didaftarkan Pemilik. Isi password jika akun sudah punya; kosongkan untuk menerima <b>kode masuk</b> lewat email. Login berlaku juga di web Monitoring lain.</p><form id="lgForm"><div class="fgrid"><div class="fld full"><label for="lg_e">Email</label><input id="lg_e" type="email" autocomplete="email" required placeholder="nama@email.com"></div><div class="fld full"><label for="lg_p">Password (opsional)</label><input id="lg_p" type="password" autocomplete="current-password"></div></div>${actions('Masuk')}</form>`);
  $('lgForm').onsubmit = async (e) => {
    e.preventDefault(); const em = $('lg_e').value.trim().toLowerCase(), pw = $('lg_p').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { toast('Format email belum benar.', true); return; }
    const r = pw ? await S.sb.auth.signInWithPassword({ email: em, password: pw }) : await S.sb.auth.signInWithOtp({ email: em, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true } });
    if (r.error) { toast(/invalid login/i.test(r.error.message) ? 'Email atau password salah.' : 'Gagal masuk: ' + r.error.message, true); return; }
    closeModal(); if (pw) toast('Berhasil masuk.'); else { toast(`Kode masuk dikirim ke ${em}.`); window.KMBOtp && KMBOtp.prompt(S.sb, em, { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true }); }
  };
}

// ---------- event ----------
document.addEventListener('click', async (e) => {
  const t = e.target, c = (s) => t.closest(s);
  if (c('[data-close]') || t.id === 'modal') { closeModal(); return; }
  if (gaClick(e)) return;
  const g = c('[data-go]'); if (g) { e.preventDefault(); go(g.dataset.go); return; }
  const pp = c('[data-person]'); if (pp) { e.preventDefault(); ui.person = pp.dataset.person; go('detail'); return; }
  if (c('#menuBtn')) { document.body.classList.add('nav-open'); $('scrim').hidden = false; return; }
  if (c('#scrim')) { document.body.classList.remove('nav-open'); $('scrim').hidden = true; return; }
  if (c('#authBtn')) { if (S.user) confirmBox('Keluar dari ' + S.user.email + '?', 'Anda kembali melihat sebagai Pelihat.', async () => { await S.sb.auth.signOut(); }, 'Keluar'); else openLogin(); return; }
  if (c('#lockIn')) { openLogin(); return; }
  if (c('#syncBtn')) { await loadAll(); toast('Data APD & karyawan sudah terbaru.'); return; }
  if (c('#printBtn')) { if (!PRINT_OK()) { askPrint(); return; } window.print(); return; }
  if (c('#xlsBtn')) { exportExcel(); return; }
  if (c('#bkBtn') && isOwner()) { download(`Backup_APD_KMB_${today()}.json`, JSON.stringify({ date: today(), state: S.state }, null, 1)); return; }
  if (c('#rsBtn') && isOwner()) { $('rsIn').click(); return; }
  const per = c('[data-period]'); if (per) { ui.period = per.dataset.period; render(); return; }
  const ht = c('[data-ht]'); if (ht) { ui.ht = ht.dataset.ht; render(); return; }
  const wh = c('[data-wh]'); if (wh) { ui.wh = wh.dataset.wh; render(); return; }
  const rq = c('[data-rq]'); if (rq) { ui.rq = rq.dataset.rq; render(); return; }
  const nr = c('[data-newreq]'); if (nr) { const [pid, ty, , kd] = (nr.dataset.newreq === '1' ? '' : nr.dataset.newreq).split('|'); reqForm(pid, ty, kd); return; }
  const ra = c('[data-rqact]'); if (ra) { const [a, id] = ra.dataset.rqact.split('|'); reqAction(a, id); return; }
  const ep = c('[data-editp]'); if (ep) { personForm(ep.dataset.editp); return; }
  const rc = c('[data-rcpt]'); if (rc) { const [pid, ty, rid, src] = rc.dataset.rcpt.split('|'); receiptForm(pid, ty, rid, src); return; }
  const rt = c('[data-ret]'); if (rt) { returnForm(rt.dataset.ret); return; }
  const er = c('[data-editret]'); if (er) { e.preventDefault(); returnForm(null, er.dataset.editret); return; }
  const sk = c('[data-stock]'); if (sk) { const [id, ty] = sk.dataset.stock.split('|'); stockForm(id, ty); return; }
  const mn = c('[data-min]'); if (mn) { minForm(mn.dataset.min); return; }
  const op = c('[data-opname]'); if (op) { opnameForm(op.dataset.opname); return; }
  const xf = c('[data-xfer]'); if (xf) { transferForm(xf.dataset.xfer); return; }
  const tf = c('[data-typeform]'); if (tf) { typeForm(tf.dataset.typeform); return; }
  const dt = c('[data-deltype]'); if (dt && isOwner()) { const code = dt.dataset.deltype; if (usedType(code)) return; confirmBox(`Hapus jenis APD ${code}?`, 'Jenis ini belum punya transaksi, jadi aman dihapus.', () => { const n = structuredClone(S.state); n.types = n.types.filter((x) => x.code !== code); delete n.limits[code]; delete n.images[code]; return persist(n, 'Jenis APD dihapus.', { kind: 'type', id: code, data: S.state.types.find((x) => x.code === code) }); }); return; }
  const dw = c('[data-delwh]'); if (dw && isOwner()) { const w = dw.dataset.delwh; if (usedWh(w)) return; confirmBox(`Hapus gudang ${w}?`, 'Gudang ini belum dipakai di transaksi mana pun.', () => { const n = structuredClone(S.state); n.warehouses = WH.filter((x) => x !== w); return persist(n, 'Gudang dihapus.', { kind: 'warehouse', id: w, data: { name: w } }); }); return; }
  const dl = c('[data-del]'); if (dl) { e.preventDefault(); const [k, id] = dl.dataset.del.split(':'); delRecord(k, id); return; }
  const ri = c('[data-resetimg]'); if (ri && isOwner()) { const n = structuredClone(S.state); delete n.images[ri.dataset.resetimg]; persist(n, 'Gambar bawaan dipulihkan.'); return; }
  if (c('#shareCopy')) { try { await navigator.clipboard.writeText($('shareUrl').value); toast('Link Pelihat disalin.'); } catch (er) { $('shareUrl').select(); toast('Tekan Ctrl+C untuk menyalin.'); } return; }
  if (c('#shareRot') && isOwner()) { confirmBox('Ganti link Pelihat APD?', 'Semua yang memakai link lama tidak bisa membuka Monitoring APD lagi.', async () => { const { data, error } = await S.sb.rpc('kta_share_rotate', { p_app: APP }); if (error) { toast('Gagal: ' + error.message, true); return false; } S.share = { key: data }; render(); toast('Link baru dibuat. Salin dan bagikan.'); }, 'Ganti Link'); return; }
  const rm = c('[data-rmed]'); if (rm && isOwner()) { const em = rm.dataset.rmed; confirmBox(`Hapus ${em} dari Monitoring APD?`, 'Orang ini tidak bisa lagi membuka atau mengubah Monitoring APD.', async () => { const { error } = await S.sb.from('app_access_roles').delete().eq('app_id', APP).eq('email', em).neq('role', 'owner'); if (error) { toast('Gagal: ' + error.message, true); return false; } toast(em + ' dihapus.'); loadAccess(); }); return; }
  const gr = c('[data-grant]'); if (gr && isOwner()) { const [st, em] = gr.dataset.grant.split('|'); const { error } = await S.sb.from('kta_print_grants').update({ status: st, decided_at: new Date().toISOString(), decided_by: S.user.email }).eq('app_id', APP).eq('email', em); if (error) toast('Gagal: ' + error.message, true); else { toast(st === 'approved' ? 'Izin cetak disetujui.' : 'Izin cetak ditolak.'); loadGrants(); } }
});
document.addEventListener('submit', async (e) => {
  if (e.target.id === 'whForm') {
    e.preventDefault(); if (!isOwner()) return; const w = ($('whName').value || '').trim().replace(/\s+/g, ' ');
    if (!w) { toast('Isi nama gudang.', true); return; } if (WH.some((x) => x.toLowerCase() === w.toLowerCase())) { toast('Gudang ' + w + ' sudah ada.', true); return; }
    const n = structuredClone(S.state); n.warehouses = [...WH, w]; persist(n, (/^gudang/i.test(w) ? '' : 'Gudang ') + w + ' ditambahkan.'); return;
  }
  if (e.target.id !== 'edForm') return; e.preventDefault(); if (!isOwner()) return;
  const em = ($('edEmail').value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { toast('Format email belum benar.', true); return; }
  if (em === OWNER) { toast('Email ini adalah Pemilik.', true); return; }
  const { error } = await S.sb.from('app_access_roles').upsert({ app_id: APP, email: em, role: 'editor', updated_at: new Date().toISOString() }, { onConflict: 'app_id,email' });
  if (error) { toast('Gagal menambah editor: ' + error.message, true); return; }
  toast(em + ' sekarang Editor APD.'); loadAccess();
});
document.addEventListener('input', (e) => {
  const keep = (id, set) => { set(e.target.value); const pos = e.target.selectionStart; render(); const n = $(id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (er) {} } };
  if (e.target.id === 'pq') keep('pq', (v) => { ui.q = v; });
  if (e.target.id === 'hq') keep('hq', (v) => { ui.hq = v; });
});
document.addEventListener('change', async (e) => {
  if (e.target.id === 'siteSel') { ui.site = e.target.value; render(); }
  if (e.target.id === 'yearSel') { ui.year = Number(e.target.value); render(); }
  const ui2 = e.target.dataset && e.target.dataset.upimg;
  if (ui2 && isOwner()) {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { toast('Pilih gambar JPG, PNG, atau WEBP.', true); return; }
    if (f.size > 12 * 1024 * 1024) { toast('Ukuran gambar maksimal 12 MB.', true); return; }
    try { const raw = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => no(new Error('Gagal membaca berkas')); r.readAsDataURL(f); }); const n = structuredClone(S.state); n.images = { ...n.images, [ui2]: await centerImage(raw) }; persist(n, 'Gambar ' + tLabel(ui2) + ' diperbarui.'); } catch (er) { toast('Gagal memproses gambar: ' + er.message, true); }
  }
  if (e.target.id === 'rsIn' && isOwner()) {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const j = JSON.parse(await f.text()); const st = normalize(j.state || j); const issue = validate(st); if (issue) { toast('Backup tidak valid: ' + issue, true); return; } confirmBox('Pulihkan data APD dari backup?', `Semua data APD sekarang diganti isi backup ${esc(j.date || f.name)} (${st.receipts.length} penerimaan, ${st.stockIn.length} stok masuk).`, () => persist(st, 'Data APD dipulihkan dari backup.'), 'Ya, pulihkan'); } catch (er) { toast('File backup tidak terbaca.', true); }
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('modal').hidden) closeModal(); });

// tahan klik + geser untuk menggulung tabel lebar (seperti Monitoring Manpower)
(function () {
  let P = null; const SKIP = 'a,button,input,select,textarea,label';
  document.addEventListener('mousedown', (e) => { if (e.button !== 0) return; const w = e.target.closest && e.target.closest('.tw'); if (!w || e.target.closest(SKIP) || w.scrollWidth <= w.clientWidth + 2) return; P = { w, x: e.clientX, y: e.clientY, sl: w.scrollLeft, sy: window.scrollY, on: false }; });
  document.addEventListener('mousemove', (e) => { if (!P) return; const dx = e.clientX - P.x, dy = e.clientY - P.y; if (!P.on) { if (Math.abs(dx) + Math.abs(dy) < 6) return; P.on = true; P.w.classList.add('panning'); } e.preventDefault(); P.w.scrollLeft = P.sl - dx; window.scrollTo(window.scrollX, P.sy - dy); });
  document.addEventListener('mouseup', () => { if (P && P.on) { P.w.classList.remove('panning'); const eat = (ev) => { ev.stopPropagation(); ev.preventDefault(); }; window.addEventListener('click', eat, true); setTimeout(() => window.removeEventListener('click', eat, true), 0); } P = null; });
})();

// ---------- start ----------
let watch = null, poll = null;
function live() {
  if (watch) { S.sb.removeChannel(watch); watch = null; } clearInterval(poll);
  if (can()) watch = S.sb.channel('apd-state-' + Date.now()).on('postgres_changes', { event: '*', schema: 'public', table: 'apd_state' }, (pl) => { const n = pl.new; if (!n || n.updated_at === S.ver || S.saving || !$('modal').hidden) return; S.state = normalize(n.data); applyTypes(); S.revision = Number(n.revision) || S.revision; S.ver = n.updated_at; loadPeople().then(render); toast('Data APD diperbarui oleh ' + (n.updated_by || 'editor') + '.'); }).subscribe();
  poll = setInterval(() => { if (!document.hidden && $('modal').hidden && !S.saving) loadAll(true); }, can() ? 180000 : 60000);
}
async function init() {
  S.state = empty(); applyTypes(); render();
  if (!window.supabase || !window.supabase.createClient) { toast('Tidak bisa terhubung ke server. Periksa koneksi lalu muat ulang.', true); return; }
  S.sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'kta-web-auth' } });
  try { const { data } = await S.sb.auth.getSession(); S.user = (data && data.session && data.session.user) || null; } catch (e) {}
  await findRole(); await loadAll(); live();
  S.sb.auth.onAuthStateChange((ev, s) => { const nu = (s && s.user) || null; if ((nu && nu.email) === (S.user && S.user.email)) return; S.user = nu; setTimeout(async () => { await findRole(); await loadAll(true); live(); if (ev === 'SIGNED_IN') toast('Masuk sebagai ' + nu.email + '.'); if (ev === 'SIGNED_OUT') toast('Anda sudah keluar.'); }, 0); });
}
init();

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
