/**
 * Web Notulensi — penyimpanan di Google Drive milik Pemilik.
 *
 * Pasang:  script.google.com → Proyek baru → tempel file ini → Deploy → New deployment →
 *          Type: Web app · Execute as: Me · Who has access: Anyone → Deploy → salin URL /exec.
 *
 * Isi Drive (dibuat otomatis saat pertama dipakai):
 *   Web Notulensi/
 *     notulensi-data.json        ← semua folder, notulensi, meeting, daftar berkas
 *     Berkas/<Unit>/<Section>/…  ← berkas asli, mengikuti susunan folder di web
 *
 * Keamanan: setiap permintaan membawa token login Supabase (akun yang sama dengan Portal Manpower).
 * Token diperiksa ke Supabase; email Pemilik selalu boleh semuanya, akun lain mengikuti daftar akses
 * yang diatur Pemilik dari web (Editor = ubah, Viewer = lihat). Akun lain ditolak.
 */

var OWNER = 'matthewyoga2014@gmail.com';
var SUPABASE_URL = 'https://yoviojbfyvgpllxisjvy.supabase.co';
var SUPABASE_KEY = 'sb_publishable_I26enb2Kz8iF4WFdH8vixA_8kek-kM9';
var ROOT_NAME = 'Web Notulensi';
var DATA_NAME = 'notulensi-data.json';
var FILES_NAME = 'Berkas';
var COLS = ['folders', 'series', 'versions', 'files'];
var MAX_BYTES = 20 * 1024 * 1024;

function doGet() {
  return out_({ ok: true, app: 'notulensi', time: new Date().toISOString() });
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

    if (op === 'whoami') return out_({ ok: true, email: who.email, id: who.id, role: role });

    if (op === 'state') {
      var st = readState_();
      if (req.rev && Number(req.rev) === st.rev) return out_({ ok: true, rev: st.rev, same: true });
      return out_({ ok: true, rev: st.rev, data: st.data });
    }

    if (op === 'download') {
      var f = DriveApp.getFileById(req.id);
      if (!isInside_(f)) throw new Error('Berkas bukan milik Web Notulensi');
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
      file.setDescription('Diunggah lewat Web Notulensi oleh ' + who.email);
      return out_({ ok: true, id: file.getId(), size: bytes.length, mime: file.getMimeType(), url: file.getUrl() });
    }

    if (op === 'trash') {
      var t = DriveApp.getFileById(req.id);
      if (!isInside_(t)) throw new Error('Berkas bukan milik Web Notulensi');
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

/* Tautan Editor/Pelihat tanpa login. Server memeriksa Supabase SETIAP permintaan
   sehingga pencabutan dan kedaluwarsa langsung berlaku. */
function guestRole_(share) {
  if (!/^[a-f0-9]{48}$/.test(String(share||''))) throw new Error('Link berbagi tidak berlaku');
  var res=UrlFetchApp.fetch(SUPABASE_URL+'/rest/v1/rpc/monitoring_guest_check',{
    method:'post',contentType:'application/json',
    headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY},
    payload:JSON.stringify({p_token:share}),muteHttpExceptions:true
  });
  if (res.getResponseCode()!==200) throw new Error('Gagal memeriksa hak akses link');
  var rows=JSON.parse(res.getContentText()||'[]');
  for(var i=0;i<rows.length;i++)if(rows[i].app_id==='notulensi')return {role:rows[i].access_role};
  throw new Error('Link Notulensi dicabut, kedaluwarsa, atau tidak dikenal');
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
  // 1) sistem undangan di halaman utama Monitoring (app "notulensi"), 2) daftar lama di web Notulensi
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
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token }, payload: JSON.stringify({ p_app: 'notulensi' }), muteHttpExceptions: true });
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
    : root.createFile(DATA_NAME, JSON.stringify({ folders: {}, series: {}, versions: {}, files: {}, _meta: { rev: 1 } }), 'application/json');
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

/** Jalankan sekali dari editor Apps Script untuk memberi izin Drive & membuat folder "Web Notulensi". */
function setup() {
  var f = dataFile_();
  Logger.log('Folder: ' + root_().getUrl());
  Logger.log('Data: ' + f.getUrl());
}
