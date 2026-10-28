/**
 * Web Monitoring Rekrutmen — penyimpanan di Google Drive milik Pemilik.
 *
 * Pasang (sekali saja):
 *  1. https://script.google.com → Proyek baru → beri nama "Web Rekrutmen".
 *  2. Tempel seluruh isi file ini ke Code.gs → Simpan.
 *  3. Pilih fungsi `setup` → Jalankan → izinkan akses Google Drive & Sheets.
 *     Dibuat otomatis di Drive:
 *       Web Rekrutmen/
 *         Monitoring Rekrutmen (Google Sheet)  ← Lowongan, Pelamar, Assessment, Berkas, Pilihan
 *         Berkas Pelamar/<Nama (ID)>/…         ← CV, KTP, hasil psikotes, MCU, dll.
 *  4. Deploy → Deployment baru → Aplikasi web · Jalankan sebagai: Saya · Akses: Siapa saja → Deploy.
 *  5. Salin URL /exec → buka web Rekrutmen → masuk sebagai Pemilik → tempel URL saat diminta.
 *
 * Setelah mengubah kode: Deploy → Kelola deployment → ikon pensil → Versi baru → Deploy (URL tetap).
 *
 * Keamanan: setiap permintaan membawa token login Supabase (akun yang sama dengan portal Monitoring).
 * Pemilik selalu penuh. Akun lain mengikuti undangan app "rekrutmen" di halaman utama Monitoring,
 * atau daftar akses yang diatur Pemilik dari web. Berkas pelamar TIDAK dibagikan publik; web
 * mengambilnya lewat script ini, jadi hanya akun yang berhak yang bisa membuka.
 */

var OWNER = 'matthewyoga2014@gmail.com';
var APP = 'rekrutmen';
var SUPABASE_URL = 'https://yoviojbfyvgpllxisjvy.supabase.co';
var SUPABASE_KEY = 'sb_publishable_I26enb2Kz8iF4WFdH8vixA_8kek-kM9';
var ROOT_NAME = 'Web Rekrutmen';
var BOOK_NAME = 'Monitoring Rekrutmen';
var FILES_NAME = 'Berkas Pelamar';
var MAX_BYTES = 20 * 1024 * 1024;
var HEAD_BG = '#6D28D9';

/* Kolom tiap tab: key (dipakai web) → judul kolom di Google Sheet */
var TABS = {
  jobs: { name: 'Lowongan', cols: [
    ['id', 'Job ID'], ['title', 'Job Title'], ['dept', 'Department'], ['manager', 'Hiring Manager'], ['recruiter', 'Recruiter'],
    ['openDate', 'Open Date'], ['closeDate', 'Close Date'], ['priority', 'Priority'], ['budget', 'Compensation Budget'],
    ['status', 'Status'], ['notes', 'Notes'], ['updatedAt', 'Diperbarui']] },
  applicants: { name: 'Pelamar', cols: [
    ['id', 'Applicant ID'], ['name', 'Name'], ['jobId', 'Job ID'], ['email', 'Email'], ['phone', 'Phone'], ['location', 'Location'],
    ['appDate', 'Application Date'], ['source', 'Source'], ['phase', 'Recruitment Phase'], ['offered', 'Compensation Offered'],
    ['decisionDate', 'Hired Date / Rejected Date'], ['startDate', 'Start Date'], ['notes', 'Notes'], ['updatedAt', 'Diperbarui']] },
  assessments: { name: 'Assessment', cols: [
    ['id', 'ID'], ['applicantId', 'Applicant ID'], ['step', 'Tahap ke'], ['date', 'Date'], ['phase', 'Phase'],
    ['recruiter', 'Recruiter'], ['detail', 'Details / Feedback / Outcome'], ['updatedAt', 'Diperbarui']] },
  files: { name: 'Berkas', cols: [
    ['id', 'ID'], ['applicantId', 'Applicant ID'], ['kind', 'Jenis berkas'], ['name', 'Nama file'], ['fileId', 'File ID'],
    ['url', 'Link Drive'], ['size', 'Ukuran (byte)'], ['mime', 'Tipe file'], ['at', 'Waktu upload'], ['by', 'Oleh']] },
  options: { name: 'Pilihan', cols: [
    ['id', 'ID'], ['field', 'Kolom'], ['value', 'Nilai'], ['bg', 'Warna'], ['fg', 'Warna teks'], ['order', 'Urutan']] }
};
var DATE_KEYS = { openDate: 1, closeDate: 1, appDate: 1, decisionDate: 1, startDate: 1, date: 1 };
var TEXT_KEYS = { id: 1, phone: 1, jobId: 1, applicantId: 1, fileId: 1 };
var NUM_KEYS = { budget: 1, offered: 1, step: 1, size: 1, order: 1 };
var FIELD_LABEL = { phase: 'Recruitment Phase', source: 'Source', jobStatus: 'Status Lowongan', priority: 'Priority', docKind: 'Jenis berkas' };

/* ================= web API ================= */
function doGet() {
  return out_({ ok: true, app: APP, version: '20261028' });
}

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var guest = req.share ? guestRole_(req.share) : null;
    var who = guest ? { email: guest.role + '-link@monitoring.local' } : auth_(req.token);
    var role = guest ? guest.role : roleOf_(who.email, req.token);
    if (role === 'none') return out_({ ok: false, code: 'forbidden', email: who.email, error: 'Akun ini belum diberi akses ke Web Rekrutmen.' });
    var canWrite = role === 'owner' || role === 'editor';
    var op = req.op;

    if (op === 'whoami') return out_({ ok: true, email: who.email, role: role });

    if (op === 'state') {
      var rev = revKey_();
      if (req.rev && String(req.rev) === rev) return out_({ ok: true, rev: rev, same: true, role: role, email: who.email });
      return out_({ ok: true, rev: rev, role: role, email: who.email, data: readAll_(), links: role === 'owner' ? links_() : null });
    }

    if (op === 'download') {
      var f = DriveApp.getFileById(String(req.id || ''));
      if (!isInside_(f)) throw new Error('Berkas bukan milik Web Rekrutmen');
      var blob = f.getBlob();
      return out_({ ok: true, name: f.getName(), mime: blob.getContentType(), b64: Utilities.base64Encode(blob.getBytes()) });
    }

    if (op === 'roles') {
      if (role !== 'owner') throw new Error('Hanya Pemilik');
      return out_({ ok: true, roles: roles_() });
    }
    if (op === 'setRole') {
      if (role !== 'owner') throw new Error('Hanya Pemilik');
      var email = String(req.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Format email belum benar');
      if (email === OWNER) throw new Error('Pemilik tidak perlu didaftarkan');
      var r = roles_();
      if (req.role === 'editor' || req.role === 'viewer') r[email] = req.role; else delete r[email];
      PropertiesService.getScriptProperties().setProperty('roles', JSON.stringify(r));
      return out_({ ok: true, roles: r });
    }

    if (!canWrite) return out_({ ok: false, code: 'readonly', error: 'Mode lihat: hanya Pemilik/Editor yang bisa mengubah data.' });

    if (op === 'write') {
      return withLock_(function () {
        var data = readAll_(), touched = {};
        (req.ops || []).forEach(function (o) { applyOp_(data, o, who.email); touched[o.col] = 1; });
        Object.keys(touched).forEach(function (c) { writeTab_(c, data[c]); });
        if (touched.options || touched.jobs || req.format) formatBook_(data);
        var rv = bumpRev_();
        return out_({ ok: true, rev: rv, data: data });
      });
    }

    if (op === 'upload') {
      var bytes = Utilities.base64Decode(req.b64 || '');
      if (bytes.length > MAX_BYTES) throw new Error('Berkas lebih dari 20 MB');
      return withLock_(function () {
        var data = readAll_();
        var ap = find_(data.applicants, req.applicantId);
        if (!ap) throw new Error('Pelamar tidak ditemukan');
        var folder = applicantFolder_(ap);
        var file = folder.createFile(Utilities.newBlob(bytes, req.mime || 'application/octet-stream', req.name || 'berkas'));
        file.setDescription((req.kind || 'Berkas') + ' · ' + ap.name + ' · diunggah lewat Web Rekrutmen oleh ' + who.email);
        var rec = { id: 'f-' + Utilities.getUuid().slice(0, 8), applicantId: ap.id, kind: req.kind || 'Lainnya', name: file.getName(),
          fileId: file.getId(), url: file.getUrl(), size: bytes.length, mime: file.getMimeType(), at: new Date().toISOString(), by: who.email };
        data.files.push(rec);
        writeTab_('files', data.files);
        var rv = bumpRev_();
        return out_({ ok: true, rev: rv, file: rec });
      });
    }

    if (op === 'trash') {
      return withLock_(function () {
        var data = readAll_();
        var rec = find_(data.files, req.id);
        if (!rec) throw new Error('Berkas tidak ditemukan');
        try { var t = DriveApp.getFileById(rec.fileId); if (isInside_(t)) t.setTrashed(true); } catch (err) {}
        data.files = data.files.filter(function (x) { return x.id !== rec.id; });
        writeTab_('files', data.files);
        return out_({ ok: true, rev: bumpRev_() });
      });
    }

    throw new Error('Perintah tidak dikenal: ' + op);
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  }
}

/* ops: {col, action:'put'|'del'|'replace', id, data, rows} */
function applyOp_(data, o, email) {
  if (!TABS[o.col]) throw new Error('Koleksi tidak dikenal: ' + o.col);
  var list = data[o.col];
  if (o.action === 'replace') { data[o.col] = (o.rows || []).map(clean_(o.col)); return; }
  if (o.action === 'del') {
    data[o.col] = list.filter(function (x) { return x.id !== o.id; });
    if (o.col === 'applicants') {   // hapus juga assessment & berkasnya
      data.assessments = data.assessments.filter(function (x) { return x.applicantId !== o.id; });
      data.files.forEach(function (f) { if (f.applicantId === o.id) { try { DriveApp.getFileById(f.fileId).setTrashed(true); } catch (e) {} } });
      data.files = data.files.filter(function (x) { return x.applicantId !== o.id; });
    }
    return;
  }
  if (o.action === 'put') {
    var rec = clean_(o.col)(Object.assign({}, o.data || {}, { id: o.id || (o.data && o.data.id) }));
    if (!rec.id) throw new Error('ID kosong');
    if (TABS[o.col].cols.some(function (c) { return c[0] === 'updatedAt'; })) rec.updatedAt = new Date().toISOString();
    var i = -1;
    for (var k = 0; k < list.length; k++) if (list[k].id === rec.id) { i = k; break; }
    if (i >= 0) list[i] = Object.assign({}, list[i], rec); else list.push(rec);
    return;
  }
  throw new Error('Aksi tidak dikenal: ' + o.action);
}
function clean_(col) {
  var keys = TABS[col].cols.map(function (c) { return c[0]; });
  return function (r) { var o = {}; keys.forEach(function (k) { if (r[k] !== undefined && r[k] !== null) o[k] = r[k]; }); if (r.id !== undefined) o.id = String(r.id); return o; };
}
function find_(list, id) { for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i]; return null; }

/* ================= Google Sheet ================= */
function book_() {
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty('bookId');
  if (id) { try { var f = DriveApp.getFileById(id); if (!f.isTrashed()) return SpreadsheetApp.openById(id); } catch (e) {} }
  var ss = SpreadsheetApp.create(BOOK_NAME);
  DriveApp.getFileById(ss.getId()).moveTo(root_());
  p.setProperty('bookId', ss.getId());
  ss.setSpreadsheetTimeZone('Asia/Jakarta');
  Object.keys(TABS).forEach(function (c) { sheet_(c, ss); });
  var first = ss.getSheetByName('Sheet1') || ss.getSheetByName('Lembar1');
  if (first && ss.getSheets().length > 1) ss.deleteSheet(first);
  return ss;
}
function sheet_(col, ss) {
  ss = ss || book_();
  var def = TABS[col], sh = ss.getSheetByName(def.name);
  if (!sh) sh = ss.insertSheet(def.name);
  var head = def.cols.map(function (c) { return c[1]; });
  var cur = sh.getLastColumn() ? sh.getRange(1, 1, 1, Math.max(head.length, sh.getLastColumn())).getValues()[0].map(String) : [];
  if (head.some(function (h, i) { return cur[i] !== h; })) {
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setFontColor('#FFFFFF').setBackground(HEAD_BG);
    sh.setFrozenRows(1);
  }
  return sh;
}
function readTab_(col, ss) {
  var def = TABS[col], sh = sheet_(col, ss), last = sh.getLastRow(), n = def.cols.length, out = [];
  if (last < 2) return out;
  var tz = 'Asia/Jakarta';
  sh.getRange(2, 1, last - 1, n).getValues().forEach(function (row) {
    if (row.every(function (v) { return v === '' || v === null; })) return;
    var o = {};
    def.cols.forEach(function (c, i) {
      var k = c[0], v = row[i];
      if (v instanceof Date) v = DATE_KEYS[k] ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : v.toISOString();
      else if (NUM_KEYS[k]) v = (v === '' || v === null) ? '' : Number(v);
      else v = (v === null || v === undefined) ? '' : String(v);
      o[k] = v;
    });
    if (!o.id) o.id = (col.charAt(0)) + '-' + Utilities.getUuid().slice(0, 8);
    out.push(o);
  });
  return out;
}
function readAll_() {
  var ss = book_(), d = {};
  Object.keys(TABS).forEach(function (c) { d[c] = readTab_(c, ss); });
  if (!d.options.length) { d.options = defaultOptions_(); writeTab_('options', d.options); formatBook_(d); }
  return d;
}
function writeTab_(col, rows) {
  var def = TABS[col], sh = sheet_(col), n = def.cols.length;
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, Math.max(n, sh.getLastColumn())).clearContent();
  if (!rows.length) return;
  var vals = rows.map(function (r) {
    return def.cols.map(function (c) {
      var v = r[c[0]];
      if (v === undefined || v === null) return '';
      if (DATE_KEYS[c[0]] && /^\d{4}-\d{2}-\d{2}$/.test(String(v))) { var p = String(v).split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }
      return v;
    });
  });
  // kolom teks (telepon, ID) diformat teks dulu supaya angka 0 di depan tidak hilang
  def.cols.forEach(function (c, i) {
    if (TEXT_KEYS[c[0]]) sh.getRange(2, i + 1, vals.length, 1).setNumberFormat('@');
    else if (DATE_KEYS[c[0]]) sh.getRange(2, i + 1, vals.length, 1).setNumberFormat('dd mmm yyyy');
  });
  sh.getRange(2, 1, vals.length, n).setValues(vals.map(function (r) {
    return r.map(function (v, i) { return TEXT_KEYS[def.cols[i][0]] && v !== '' ? String(v) : v; });
  }));
}

/* Dropdown + warna di Google Sheet, mengikuti tab Pilihan */
function formatBook_(data) {
  try {
    var opts = data.options || [];
    var by = function (f) { return opts.filter(function (o) { return o.field === f && o.value; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); };
    var plan = [
      ['applicants', 'phase', 'phase'], ['applicants', 'source', 'source'],
      ['assessments', 'phase', 'phase'], ['jobs', 'status', 'jobStatus'], ['jobs', 'priority', 'priority'], ['files', 'kind', 'docKind']
    ];
    var rulesBySheet = {};
    plan.forEach(function (p) {
      var def = TABS[p[0]], sh = sheet_(p[0]);
      var ci = def.cols.map(function (c) { return c[0]; }).indexOf(p[1]) + 1;
      var list = by(p[2]);
      var rng = sh.getRange(2, ci, Math.max(sh.getMaxRows() - 1, 1), 1);
      if (list.length) rng.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(list.map(function (o) { return o.value; }), true).setAllowInvalid(true).build());
      else rng.clearDataValidations();
      var rs = rulesBySheet[p[0]] || (rulesBySheet[p[0]] = []);
      list.forEach(function (o) {
        rs.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(o.value).setBackground(o.bg || '#EEEEEE').setFontColor(o.fg || '#111111').setBold(true).setRanges([rng]).build());
      });
    });
    Object.keys(rulesBySheet).forEach(function (c) { sheet_(c).setConditionalFormatRules(rulesBySheet[c]); });
    // tab Pilihan: warnai sel Nilai sesuai warnanya
    var sh = sheet_('options'), rows = opts.length;
    if (rows) {
      var bgs = opts.map(function (o) { return [o.bg || '#FFFFFF']; }), fgs = opts.map(function (o) { return [o.fg || '#111111']; });
      sh.getRange(2, 3, rows, 1).setBackgrounds(bgs).setFontColors(fgs).setFontWeight('bold');
    }
  } catch (err) { /* format gagal tidak menggagalkan simpan */ }
}

function defaultOptions_() {
  var P = [['Application Received', '#E2E8F0', '#334155'], ['Screening CV', '#E0F2FE', '#075985'], ['Phone Screen', '#CFFAFE', '#155E75'],
    ['Psikologi Test', '#EDE9FE', '#5B21B6'], ['First Interview', '#E0E7FF', '#3730A3'], ['Final Interview', '#DBEAFE', '#1E40AF'],
    ['Medical Check Up', '#CCFBF1', '#115E59'], ['Offering Letter', '#FEF3C7', '#92400E'], ['Onboarding', '#ECFCCB', '#3F6212'],
    ['Onsite', '#DCFCE7', '#166534'], ['Hired', '#16A34A', '#FFFFFF'], ['Rejected', '#FEE2E2', '#991B1B'], ['Mengundurkan Diri', '#FFEDD5', '#9A3412']];
  var S = [['Social Media', '#DBEAFE', '#1E40AF'], ['Employee Referal', '#DCFCE7', '#166534'], ['Job Portal', '#EDE9FE', '#5B21B6'],
    ['Walk-in', '#FEF3C7', '#92400E'], ['Website Perusahaan', '#CFFAFE', '#155E75'], ['Agency / Vendor', '#FFEDD5', '#9A3412'],
    ['Job Fair', '#FCE7F3', '#9D174D'], ['Internal', '#E2E8F0', '#334155']];
  var J = [['Open', '#DBEAFE', '#1E40AF'], ['On Hold', '#FEF3C7', '#92400E'], ['Closed-Filled', '#DCFCE7', '#166534'], ['Closed-Unfilled', '#F1F5F9', '#475569'], ['Cancel', '#FEE2E2', '#991B1B']];
  var R = [['High', '#FEE2E2', '#991B1B'], ['Normal', '#E0F2FE', '#075985'], ['Low', '#F1F5F9', '#475569']];
  var D = [['CV', '#EDE9FE', '#5B21B6'], ['KTP', '#E0F2FE', '#075985'], ['Ijazah', '#FEF3C7', '#92400E'], ['Sertifikat', '#ECFCCB', '#3F6212'],
    ['Hasil Psikotes', '#FCE7F3', '#9D174D'], ['Hasil MCU', '#CCFBF1', '#115E59'], ['Offering Letter', '#FFEDD5', '#9A3412'], ['Foto', '#F1F5F9', '#475569'], ['Lainnya', '#E2E8F0', '#334155']];
  var out = [];
  [['phase', P], ['source', S], ['jobStatus', J], ['priority', R], ['docKind', D]].forEach(function (g) {
    g[1].forEach(function (v, i) { out.push({ id: 'o-' + g[0] + '-' + (i + 1), field: g[0], value: v[0], bg: v[1], fg: v[2], order: i + 1 }); });
  });
  return out;
}

/* ================= Drive ================= */
function root_() {
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty('rootId');
  if (id) { try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  var it = DriveApp.getFoldersByName(ROOT_NAME);
  var root = it.hasNext() ? it.next() : DriveApp.createFolder(ROOT_NAME);
  p.setProperty('rootId', root.getId());
  return root;
}
function child_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function applicantFolder_(ap) {
  var name = (String(ap.name || 'Tanpa nama').trim() + ' (' + ap.id + ')').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120);
  return child_(child_(root_(), FILES_NAME), name);
}
function isInside_(file) {
  var rootId = root_().getId(), seen = 0, q = [file.getParents()];
  while (q.length && seen < 40) {
    var it = q.shift();
    while (it.hasNext()) { var p = it.next(); seen++; if (p.getId() === rootId) return true; q.push(p.getParents()); }
  }
  return false;
}
function links_() {
  try { return { folder: root_().getUrl(), sheet: book_().getUrl() }; } catch (e) { return null; }
}

/* ================= login & peran ================= */
function auth_(token) {
  if (!token) throw new Error('Belum masuk');
  var cache = CacheService.getScriptCache();
  var key = 'tk_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  var res = UrlFetchApp.fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Sesi login tidak berlaku, silakan masuk lagi');
  var u = JSON.parse(res.getContentText());
  var who = { email: String(u.email || '').toLowerCase() };
  if (!who.email) throw new Error('Akun tanpa email');
  cache.put(key, JSON.stringify(who), 600);
  return who;
}
function roles_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('roles') || '{}'); } catch (e) { return {}; }
}
function roleOf_(email, token) {
  if (email === OWNER) return 'owner';
  var sb = sbRole_(token);
  if (sb === 'editor' || sb === 'viewer' || sb === 'owner') return sb;
  return roles_()[email] || 'none';
}
function sbRole_(token) {
  if (!token) return '';
  var cache = CacheService.getScriptCache();
  var key = 'rl_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  var hit = cache.get(key); if (hit !== null) return hit;
  var v = '';
  try {
    var res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/kta_member_role', { method: 'post', contentType: 'application/json',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token }, payload: JSON.stringify({ p_app: APP }), muteHttpExceptions: true });
    if (res.getResponseCode() === 200) v = String(JSON.parse(res.getContentText() || '""') || '');
  } catch (e) {}
  cache.put(key, v, 300);
  return v;
}
function guestRole_(share) {
  if (!/^[a-f0-9]{48}$/.test(String(share || ''))) throw new Error('Link berbagi tidak berlaku');
  var res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/monitoring_guest_check', { method: 'post', contentType: 'application/json',
    headers: { apikey: SUPABASE_KEY }, payload: JSON.stringify({ p_token: share }), muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Gagal memeriksa hak akses link');
  var rows = JSON.parse(res.getContentText() || '[]');
  for (var i = 0; i < rows.length; i++) if (rows[i].app_id === APP) return { role: rows[i].access_role };
  throw new Error('Link Rekrutmen dicabut, kedaluwarsa, atau tidak dikenal');
}

/* ================= util ================= */
function getRev_() { return Number(PropertiesService.getScriptProperties().getProperty('rev') || 1); }
function bumpRev_() { var r = getRev_() + 1; PropertiesService.getScriptProperties().setProperty('rev', String(r)); return revKey_(); }
/* penanda versi: ikut berubah juga bila Google Sheet diedit langsung */
function revKey_() {
  var t = 0;
  try { t = DriveApp.getFileById(PropertiesService.getScriptProperties().getProperty('bookId')).getLastUpdated().getTime(); } catch (e) {}
  return getRev_() + '-' + t;
}
function withLock_(fn) { var lock = LockService.getScriptLock(); lock.waitLock(25000); try { return fn(); } finally { lock.releaseLock(); } }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** Jalankan sekali dari editor: membuat folder "Web Rekrutmen", Google Sheet, dan pilihan default. */
function setup() {
  var d = readAll_();
  formatBook_(d);
  Logger.log('Folder: ' + root_().getUrl());
  Logger.log('Google Sheet: ' + book_().getUrl());
}

/** Bila data diubah langsung di Google Sheet, jalankan ini (atau tekan "Muat ulang" di web) agar web ikut memuat ulang. */
function refreshWeb() { bumpRev_(); }
