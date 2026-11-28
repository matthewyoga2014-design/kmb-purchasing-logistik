/**
 * Web Monitoring Rekondisi Vessel & Dolly — penyimpanan di Google Drive milik Pemilik.
 * (Turunan dari Code.gs Web Notulensi; pola sama.)
 *
 * Pasang:  script.google.com → Proyek baru → tempel file ini → Deploy → New deployment →
 *          Type: Web app · Execute as: Me · Who has access: Anyone → Deploy → salin URL /exec.
 *
 * Isi Drive (dibuat otomatis saat pertama dipakai):
 *   Web Monitoring Rekondisi/
 *     rekondisi-data.json             ← jobsite, unit, timeframe, update aktual, permasalahan, MOL, log
 *     Dokumentasi/<Kode unit>/<Jenis>/… ← foto dokumentasi
 *     Dokumentasi/Arsip Upload Excel/   ← salinan file Excel yang diupload
 *
 * Keamanan: setiap permintaan membawa token login Supabase (akun yang sama dengan Portal Manpower).
 * Token diperiksa ke Supabase; email Pemilik selalu boleh semuanya, akun lain mengikuti daftar akses
 * yang diatur Pemilik dari web (Editor = ubah, Viewer = lihat). Akun lain ditolak.
 */

var OWNER = 'matthewyoga2014@gmail.com';
var SUPABASE_URL = 'https://yoviojbfyvgpllxisjvy.supabase.co';
var SUPABASE_KEY = 'sb_publishable_I26enb2Kz8iF4WFdH8vixA_8kek-kM9';
var ROOT_NAME = 'Web Monitoring Rekondisi';
var DATA_NAME = 'rekondisi-data.json';
var FILES_NAME = 'Dokumentasi';
var COLS = ['jobsites', 'units', 'tf', 'updates', 'issues', 'mols', 'categories', 'roles', 'templates', 'settings', 'drive', 'logs'];
var MAX_BYTES = 20 * 1024 * 1024;

function doGet() {
  return out_({ ok: true, app: 'rekondisi', guestAccess: false, version: '20261128-project', time: new Date().toISOString() });
}

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var guest = req.share ? guestRole_(req.share) : null;
    var who = guest ? {email: guest.role + '-link@monitoring.local',id:'shared-link'} : auth_(req.token);
    var role = guest ? guest.role : roleOf_(who.email, req.token);
    if (role === 'none') return out_({ ok: false, code: 'forbidden', email: who.email, error: 'Akun ini belum didaftarkan Pemilik.' });
    var canWrite = role === 'owner' || role === 'editor';
    var op = req.op;
    // akses per project (jobsite) yang dicentang Pemilik di Pengaturan
    var scope = (role === 'owner' || guest) ? null : scope_(who.email, req.token);

    if (op === 'whoami') return out_({ ok: true, email: who.email, id: who.id, role: role });

    if (op === 'state') {
      var st = readState_();
      if (scope) return out_({ ok: true, rev: st.rev, data: filterState_(st.data, scope) });
      if (req.rev && Number(req.rev) === st.rev) return out_({ ok: true, rev: st.rev, same: true });
      return out_({ ok: true, rev: st.rev, data: st.data });
    }

    if (op === 'download') {
      var f = DriveApp.getFileById(req.id);
      if (!isInside_(f)) throw new Error('Berkas bukan milik Web Monitoring Rekondisi');
      var blob = f.getBlob();
      return out_({ ok: true, name: f.getName(), mime: blob.getContentType(), b64: Utilities.base64Encode(blob.getBytes()) });
    }

    if (op === 'roles') {
      if (role !== 'owner') throw new Error('Hanya Pemilik');
      return out_({ ok: true, roles: roles_() });
    }

    if (!canWrite) return out_({ ok: false, code: 'readonly', error: 'Mode lihat: hanya Pemilik/Editor yang bisa mengubah data.' });

    if (op === 'write') {
      // req.ops = [{t:'put'|'del', col, id, data}]
      return withLock_(function () {
        var st = readState_();
        (req.ops || []).forEach(function (o) {
          if (COLS.indexOf(o.col) < 0) throw new Error('Koleksi tidak dikenal: ' + o.col);
          if (scope) checkScope_(st.data, scope, o);
          var c = st.data[o.col] || (st.data[o.col] = {});
          if (o.t === 'put') c[o.id] = o.data || {};
          else if (o.t === 'del') delete c[o.id];
        });
        st.rev = st.rev + 1;
        st.data._meta = { rev: st.rev, at: new Date().toISOString(), by: who.email };
        writeState_(st);
        return out_({ ok: true, rev: st.rev });
      });
    }

    if (op === 'upload') {
      var bytes = Utilities.base64Decode(req.b64 || '');
      if (bytes.length > MAX_BYTES) throw new Error('Berkas lebih dari 20 MB');
      var folder = pathFolder_(req.dirs || []);
      var file = folder.createFile(Utilities.newBlob(bytes, req.mime || 'application/octet-stream', req.name || 'berkas'));
      file.setDescription('Diunggah lewat Web Monitoring Rekondisi oleh ' + who.email);
      return out_({ ok: true, id: file.getId(), size: bytes.length, mime: file.getMimeType(), url: file.getUrl() });
    }

    if (op === 'trash') {
      var t = DriveApp.getFileById(req.id);
      if (!isInside_(t)) throw new Error('Berkas bukan milik Web Monitoring Rekondisi');
      t.setTrashed(true);
      return out_({ ok: true });
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

    throw new Error('Perintah tidak dikenal: ' + op);
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  }
}

/* ---------- akses per project ---------- */
function scope_(email, token) {
  if (!token) return null;
  var cache = CacheService.getScriptCache();
  var key = 'sc_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token + '|' + email));
  var hit = cache.get(key);
  if (hit !== null) return hit ? JSON.parse(hit) : null;
  var v = null;
  var res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/kta_app_perms?app_id=eq.rekondisi&select=perms', {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Gagal memeriksa akses project');
  var rows = JSON.parse(res.getContentText() || '[]');
  var sc = rows[0] && rows[0].perms && rows[0].perms.scope;
  if (sc && Object.prototype.toString.call(sc[email]) === '[object Array]') {
    v = {}; sc[email].forEach(function (id) { v[id] = true; });
  }
  cache.put(key, v ? JSON.stringify(v) : '', 120);
  return v;
}
function unitOk_(data, A, uid) { var u = (data.units || {})[uid]; return !!(u && A[u.jobsiteId]); }
function recOk_(data, A, col, id, d) {
  d = d || {};
  if (d.jobsiteId && A[d.jobsiteId]) return true;
  return unitOk_(data, A, d.unitId || (col === 'tf' ? id : ''));
}
function filterState_(data, A) {
  var out = {}, codes = [];
  Object.keys(data).forEach(function (c) {
    var src = data[c] || {};
    if (c === 'jobsites' || c === 'units' || c === 'tf' || c === 'updates' || c === 'issues' || c === 'mols') {
      var o = {};
      Object.keys(src).forEach(function (id) {
        var d = src[id] || {};
        var ok = c === 'jobsites' ? !!A[id] : c === 'units' ? !!A[d.jobsiteId] : recOk_(data, A, c, id, d);
        if (ok) o[id] = d;
      });
      out[c] = o;
    } else if (c === 'roles') out[c] = {};
    else out[c] = src;
  });
  Object.keys(out.units || {}).forEach(function (id) { if (out.units[id].code) codes.push(String(out.units[id].code)); });
  Object.keys(out.jobsites || {}).forEach(function (id) { if (out.jobsites[id].name) codes.push(String(out.jobsites[id].name)); });
  if (data.logs) {
    var lg = {};
    Object.keys(data.logs).forEach(function (id) {
      var x = data.logs[id] || {}, t = (x.ref || '') + ' ' + (x.detail || '');
      for (var i = 0; i < codes.length; i++) if (t.indexOf(codes[i]) >= 0) { lg[id] = x; break; }
    });
    out.logs = lg;
  }
  return out;
}
function checkScope_(data, A, o) {
  var deny = function () { throw new Error('Akses Anda dibatasi ke project tertentu; perubahan ini tidak diizinkan.'); };
  if (o.col === 'logs' || o.col === 'categories') return;
  var cur = (data[o.col] || {})[o.id];
  if (o.col === 'units') {
    if (o.t !== 'put' || !cur || !A[cur.jobsiteId] || !A[(o.data || {}).jobsiteId]) deny();
    return;
  }
  if (o.col === 'tf' || o.col === 'updates' || o.col === 'issues' || o.col === 'mols') {
    if (cur && !recOk_(data, A, o.col, o.id, cur)) deny();
    if (o.t === 'put' && !recOk_(data, A, o.col, o.id, o.data)) deny();
    return;
  }
  deny();
}

/* Tautan Editor/Pelihat tanpa login. Server memeriksa Supabase SETIAP permintaan
   sehingga pencabutan dan kedaluwarsa langsung berlaku. */
function guestRole_(share) {
  if (!/^[a-f0-9]{48}$/.test(String(share||''))) throw new Error('Link berbagi tidak berlaku');
  var res=UrlFetchApp.fetch(SUPABASE_URL+'/rest/v1/rpc/monitoring_guest_check',{
    method:'post',contentType:'application/json',
    headers:{apikey:SUPABASE_KEY},
    payload:JSON.stringify({p_token:share}),muteHttpExceptions:true
  });
  if (res.getResponseCode()!==200) throw new Error('Gagal memeriksa hak akses link');
  var rows=JSON.parse(res.getContentText()||'[]');
  for(var i=0;i<rows.length;i++)if(rows[i].app_id==='rekondisi')return {role:rows[i].access_role};
  throw new Error('Link Monitoring Rekondisi dicabut, kedaluwarsa, atau tidak dikenal');
}

/* ---------- login: token Supabase (akun Portal Manpower) ---------- */
function auth_(token) {
  if (!token) throw new Error('Belum masuk');
  var cache = CacheService.getScriptCache();
  var key = 'tk_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  var res = UrlFetchApp.fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token }, muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('Sesi login tidak berlaku, silakan masuk lagi');
  var u = JSON.parse(res.getContentText());
  var who = { email: String(u.email || '').toLowerCase(), id: u.id };
  if (!who.email) throw new Error('Akun tanpa email');
  cache.put(key, JSON.stringify(who), 600);
  return who;
}
function roles_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('roles') || '{}'); } catch (e) { return {}; }
}
function roleOf_(email, token) {
  if (email === OWNER) return 'owner';
  // Web pribadi Pemilik: 1) undangan portal (app "rekondisi") bila kelak dipakai, 2) daftar akses di web ini
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
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token }, payload: JSON.stringify({ p_app: 'rekondisi' }), muteHttpExceptions: true });
    if (res.getResponseCode() === 200) v = String(JSON.parse(res.getContentText() || '""') || '');
  } catch (e) {}
  cache.put(key, v, 300);
  return v;
}

/* ---------- Drive ---------- */
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
function pathFolder_(dirs) {
  var f = child_(root_(), FILES_NAME);
  dirs.forEach(function (d) {
    var n = String(d || '').replace(/[\\/]+/g, '-').trim();
    if (n) f = child_(f, n.slice(0, 120));
  });
  return f;
}
function isInside_(file) {
  var rootId = root_().getId();
  var seen = 0, q = [file.getParents()];
  while (q.length && seen < 40) {
    var it = q.shift();
    while (it.hasNext()) {
      var p = it.next(); seen++;
      if (p.getId() === rootId) return true;
      q.push(p.getParents());
    }
  }
  return false;
}
function dataFile_() {
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty('dataId');
  if (id) { try { var f = DriveApp.getFileById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  var root = root_();
  var it = root.getFilesByName(DATA_NAME);
  var file = it.hasNext() ? it.next()
    : root.createFile(DATA_NAME, JSON.stringify(COLS.reduce(function (o, c) { o[c] = {}; return o; }, { _meta: { rev: 1 } })), 'application/json');
  p.setProperty('dataId', file.getId());
  return file;
}
function readState_() {
  var data;
  try { data = JSON.parse(dataFile_().getBlob().getDataAsString('UTF-8') || '{}'); } catch (e) { data = {}; }
  COLS.forEach(function (c) { if (!data[c]) data[c] = {}; });
  var rev = Number((data._meta && data._meta.rev) || PropertiesService.getScriptProperties().getProperty('rev') || 1);
  return { data: data, rev: rev };
}
function writeState_(st) {
  dataFile_().setContent(JSON.stringify(st.data));
  PropertiesService.getScriptProperties().setProperty('rev', String(st.rev));
}
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Jalankan sekali dari editor Apps Script untuk memberi izin Drive & membuat folder "Web Monitoring Rekondisi". */
function setup() {
  var f = dataFile_();
  Logger.log('Folder: ' + root_().getUrl());
  Logger.log('Data: ' + f.getUrl());
}
