/**
 * Monitoring Unit & Mobilisasi — penghubung Google Sheets <-> web
 *
 * Cara pasang (sekali saja):
 * 1. Buka spreadsheet "Monitoring Unit & Mobilisasi" > Ekstensi > Apps Script.
 * 2. Hapus isi Code.gs bawaan, tempel seluruh file ini, lalu Simpan.
 * 3. Deploy > Deployment baru > pilih jenis "Aplikasi web".
 *      Jalankan sebagai : Saya (pemilik spreadsheet)
 *      Yang memiliki akses: Siapa saja
 *    Klik Deploy, izinkan akses, lalu salin URL aplikasi web (berakhiran /exec).
 * 4. Buka https://matthewyoga2014-design.github.io/kmb-purchasing-logistik/monitoring-unit/ , masuk sebagai Pemilik, klik nama Anda di kanan atas,
 *    lalu tempel URL tadi di "Sambungkan Google Sheets".
 *
 * Aturan: siapa pun boleh membaca data. Menyimpan dari web hanya untuk akun yang
 * terdaftar sebagai Pemilik/Editor aplikasi "unit-monitoring" di portal (Supabase).
 * Edit langsung di spreadsheet mengikuti hak share Google Sheets.
 *
 * Dokumentasi: file bukti (foto/PDF) disimpan di Google Drive, folder
 * "Dokumentasi Monitoring Unit" (satu subfolder per project), dan dicatat di
 * tab "Dokumentasi". Tab dan folder dibuat otomatis saat upload pertama.
 * Setelah mengganti kode ini: Deploy > Kelola deployment > ikon pensil >
 * Versi: Versi baru > Deploy, lalu izinkan akses Google Drive. URL tetap sama.
 */

const SB_URL = 'https://yoviojbfyvgpllxisjvy.supabase.co';
const SB_KEY = 'sb_publishable_I26enb2Kz8iF4WFdH8vixA_8kek-kM9';
const APP = 'unit-monitoring';
const OWNER_EMAIL = 'matthewyoga2014@gmail.com';

const SHEETS = {
  projects:   { name: 'Project', prefix: 'p', cols: { id: 'ID', kode: 'Nama singkat', nama: 'Nama lengkap', lokasi: 'Lokasi', catatan: 'Catatan', urut: 'Urutan' } },
  pengiriman: { name: 'Rencana Kirim', prefix: 'k', cols: { id: 'ID', project: 'Project', tipe: 'Item unit', rencanaAwal: 'Rencana awal', rencana: 'Rencana kini', eta: 'ETA', moda: 'Moda', asal: 'Asal', catatan: 'Keterangan', urut: 'Urutan', updatedAt: 'Diperbarui' } },
  units:      { name: 'Unit', prefix: 'u', cols: { id: 'ID', kode: 'No. lambung', sementara: 'Kode sementara', project: 'Project', item: 'Item rencana kirim', lokasi: 'Posisi', tglTiba: 'Tanggal tiba', hm: 'HM', status: 'Status', catatan: 'Catatan', updatedAt: 'Diperbarui', rencanaKirim: 'Rencana kirim', via: 'Via', tglKirim: 'Tanggal kirim' } },
  mobilisasi: { name: 'Mobilisasi', prefix: 'm', cols: { id: 'ID', unitKode: 'No. lambung', project: 'Project', tanggal: 'Tanggal', jam: 'Jam', dari: 'Dari', ke: 'Ke', jarak: 'Jarak (km)', moda: 'Moda', escort: 'Pengawalan', pic: 'PIC', status: 'Status', catatan: 'Catatan' } },
  dokumentasi:{ name: 'Dokumentasi', prefix: 'd', cols: { id: 'ID', waktu: 'Waktu upload', tahap: 'Tahap', project: 'Project', item: 'Item unit', unitKode: 'No. lambung', tanggal: 'Tanggal', lokasi: 'Lokasi', catatan: 'Keterangan', fileName: 'Nama file', fileUrl: 'Link file', fileId: 'File ID', mime: 'Jenis file', oleh: 'Oleh' } },
  revisi:     { name: 'Riwayat Perubahan', prefix: 'r', cols: { id: 'ID', waktu: 'Waktu', project: 'Project', tipe: 'Item unit', lama: 'Jumlah lama', baru: 'Jumlah baru', etaLama: 'ETA lama', etaBaru: 'ETA baru', alasan: 'Alasan', oleh: 'Oleh' } }
};
const DATE_KEYS = { eta: 1, tglTiba: 1, tanggal: 1, etaLama: 1, etaBaru: 1, rencanaKirim: 1, tglKirim: 1 };
const TIME_KEYS = { jam: 1 };
const TS_KEYS = { updatedAt: 1, waktu: 1 };
const NUM_KEYS = { urut: 1, rencanaAwal: 1, rencana: 1, hm: 1, jarak: 1, lama: 1, baru: 1 };

/* ---------------- web API ---------------- */
function doGet() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('state2');
  if (hit) return ContentService.createTextOutput('{"ok":true,"state":' + hit + '}').setMimeType(ContentService.MimeType.JSON);
  const txt = JSON.stringify(buildState_());
  try { if (txt.length < 95000) cache.put('state2', txt, 21600); } catch (err) {}
  return ContentService.createTextOutput('{"ok":true,"state":' + txt + '}').setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (err) { return json_({ ok: false, error: 'bad_request' }); }
  const who = verify_(body.token);
  if (!who) return json_({ ok: false, error: 'not_signed_in' });
  if (who.role !== 'owner' && who.role !== 'editor') return json_({ ok: false, error: 'forbidden', email: who.email });
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return json_({ ok: false, error: 'busy' });
  try {
    const st = buildState_();   // dibaca sekali per permintaan, lalu diperbarui di memori
    (body.ops || []).forEach(function (op) { applyOp_(op, who.email, st); });
    bumpRev_();
    return json_({ ok: true, state: buildState_() });
  } catch (err) {
    return json_({ ok: false, error: 'failed', message: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- cek login & peran (sama dengan portal) ---------------- */
function verify_(token) {
  if (!token) return null;
  const h = { apikey: SB_KEY, Authorization: 'Bearer ' + token };
  const r = UrlFetchApp.fetch(SB_URL + '/auth/v1/user', { headers: h, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return null;
  const email = String((JSON.parse(r.getContentText()) || {}).email || '').toLowerCase();
  if (!email) return null;
  if (email === OWNER_EMAIL) return { email: email, role: 'owner' };
  const q = UrlFetchApp.fetch(SB_URL + '/rest/v1/app_access_roles?select=role&app_id=eq.' + APP + '&email=eq.' + encodeURIComponent(email), { headers: h, muteHttpExceptions: true });
  let role = 'viewer';
  try { const arr = JSON.parse(q.getContentText() || '[]'); if (arr[0] && arr[0].role) role = arr[0].role; } catch (err) {}
  return { email: email, role: role };
}

/* ---------------- baca sheet ---------------- */
function tz_() { return SpreadsheetApp.getActive().getSpreadsheetTimeZone(); }

function sheet_(col) {
  const def = SHEETS[col], ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(def.name);
  if (!sh && col === 'dokumentasi') {
    sh = ss.insertSheet(def.name);
    const head = Object.keys(def.cols).map(function (k) { return def.cols[k]; });
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#6D28D9');
    sh.setFrozenRows(1);
  }
  if (!sh) throw new Error('Tab "' + def.name + '" tidak ditemukan');
  ensureHeaders_(sh, def);
  return sh;
}

// kolom baru (mis. Rencana kirim, Via, Tanggal kirim di tab Unit) ditambahkan otomatis di kanan
const HEAD_OK_ = {};
function ensureHeaders_(sh, def) {
  if (HEAD_OK_[def.name]) return;
  const width = Math.max(1, sh.getLastColumn());
  const head = sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h).trim(); });
  const missing = Object.keys(def.cols).map(function (k) { return def.cols[k]; }).filter(function (n) { return head.indexOf(n) < 0; });
  if (missing.length) {
    const start = head.filter(function (h) { return h !== ''; }).length ? width + 1 : 1;
    sh.getRange(1, start, 1, missing.length).setValues([missing]).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#6D28D9');
  }
  HEAD_OK_[def.name] = true;
}

function headerIndex_(sh) {
  const head = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
  const idx = {};
  head.forEach(function (h, i) { idx[String(h).trim()] = i; });
  return { idx: idx, width: head.length };
}

function norm_(key, v) {
  const tz = tz_();
  if (v instanceof Date) {
    if (DATE_KEYS[key]) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
    if (TIME_KEYS[key]) return Utilities.formatDate(v, tz, 'HH:mm');
    return v.toISOString();
  }
  if (NUM_KEYS[key]) { return v === '' || v === null ? '' : Number(v); }
  return v === null || v === undefined ? '' : String(v).trim();
}

function readRaw_(col) {
  const def = SHEETS[col], sh = sheet_(col), h = headerIndex_(sh);
  const last = sh.getLastRow();
  const out = [];
  if (last < 2) return { rows: out, sh: sh, h: h };
  const vals = sh.getRange(2, 1, last - 1, h.width).getValues();
  const idCol = h.idx[def.cols.id];
  vals.forEach(function (row, i) {
    if (row.every(function (c) { return c === '' || c === null; })) return;
    const rec = { _row: i + 2 };
    Object.keys(def.cols).forEach(function (k) {
      const c = h.idx[def.cols[k]];
      rec[k] = c === undefined ? '' : norm_(k, row[c]);
    });
    if (!rec.id && idCol !== undefined) {
      rec.id = def.prefix + '-' + Utilities.getUuid().slice(0, 8);
      sh.getRange(i + 2, idCol + 1).setValue(rec.id);
    }
    out.push(rec);
  });
  return { rows: out, sh: sh, h: h };
}

function buildState_() {
  const P = readRaw_('projects').rows, K = readRaw_('pengiriman').rows, U = readRaw_('units').rows,
        M = readRaw_('mobilisasi').rows, R = readRaw_('revisi').rows;
  const D = SpreadsheetApp.getActive().getSheetByName(SHEETS.dokumentasi.name) ? readRaw_('dokumentasi').rows : [];
  const byKode = {};
  P.forEach(function (p) { byKode[p.kode] = p.id; });
  const pid = function (kode) { return byKode[kode] || ''; };
  const kirimOf = function (projectId, tipe) { const k = K.filter(function (x) { return pid(x.project) === projectId && x.tipe === tipe; })[0]; return k ? k.id : ''; };
  const projects = P.map(function (p) { return { id: p.id, kode: p.kode, nama: p.nama, lokasi: p.lokasi, catatan: p.catatan, urut: p.urut }; });
  const pengiriman = K.map(function (k) { return { id: k.id, projectId: pid(k.project), tipe: k.tipe, rencanaAwal: k.rencanaAwal === '' ? k.rencana : k.rencanaAwal, rencana: k.rencana === '' ? 0 : k.rencana, eta: k.eta, moda: k.moda, asal: k.asal, catatan: k.catatan, urut: k.urut, updatedAt: k.updatedAt }; });
  const units = U.map(function (u) { const p = pid(u.project); return { id: u.id, kode: u.kode, kodeSementara: /^ya$/i.test(u.sementara), projectId: p, kirimId: kirimOf(p, u.item), tipe: u.item, lokasi: u.lokasi, tglTiba: u.tglTiba, hm: u.hm === '' ? 0 : u.hm, status: u.status || 'Tiba', catatan: u.catatan, updatedAt: u.updatedAt, rencanaKirim: u.rencanaKirim, via: u.via, tglKirim: u.tglKirim }; });
  const unitByKode = {};
  units.forEach(function (u) { unitByKode[u.kode] = u; });
  const mobilisasi = M.map(function (m) { const u = unitByKode[m.unitKode]; return { id: m.id, unitKode: m.unitKode, unitId: u ? u.id : '', projectId: pid(m.project) || (u ? u.projectId : ''), tanggal: m.tanggal, jam: m.jam, dari: m.dari, ke: m.ke, jarak: m.jarak === '' ? 0 : m.jarak, moda: m.moda, escort: m.escort, pic: m.pic, status: m.status || 'Direncanakan', catatan: m.catatan }; });
  const revisi = R.map(function (r) { const p = pid(r.project); return { id: r.id, waktu: r.waktu, projectId: p, kirimId: kirimOf(p, r.tipe), tipe: r.tipe, lama: r.lama, baru: r.baru, etaLama: r.etaLama, etaBaru: r.etaBaru, alasan: r.alasan, oleh: r.oleh }; });
  const dokumentasi = D.map(function (d) { const p = pid(d.project), u = unitByKode[d.unitKode]; return { id: d.id, waktu: d.waktu, tahap: d.tahap, projectId: p, kirimId: kirimOf(p, d.item), tipe: d.item, unitKode: d.unitKode, unitId: u ? u.id : '', tanggal: d.tanggal, lokasi: d.lokasi, catatan: d.catatan, fileName: d.fileName, fileUrl: d.fileUrl, fileId: d.fileId, mime: d.mime, oleh: d.oleh }; });
  return { rev: getRev_(), projects: projects, pengiriman: pengiriman, units: units, mobilisasi: mobilisasi, revisi: revisi, dokumentasi: dokumentasi };
}

/* ---------------- tulis dari web ---------------- */
function toSheetRec_(col, rec, st) {
  const projKode = function (id) { const p = st.projects.filter(function (x) { return x.id === id; })[0]; return p ? p.kode : ''; };
  switch (col) {
    case 'projects': return { id: rec.id, kode: rec.kode, nama: rec.nama, lokasi: rec.lokasi, catatan: rec.catatan, urut: rec.urut };
    case 'pengiriman': return { id: rec.id, project: projKode(rec.projectId), tipe: rec.tipe, rencanaAwal: rec.rencanaAwal, rencana: rec.rencana, eta: rec.eta, moda: rec.moda, asal: rec.asal, catatan: rec.catatan, urut: rec.urut, updatedAt: rec.updatedAt };
    case 'units': {
      const k = st.pengiriman.filter(function (x) { return x.id === rec.kirimId; })[0];
      return { id: rec.id, kode: rec.kode, sementara: rec.kodeSementara ? 'Ya' : '', project: projKode(rec.projectId), item: k ? k.tipe : rec.tipe, lokasi: rec.lokasi, tglTiba: rec.tglTiba, hm: rec.hm, status: rec.status, catatan: rec.catatan, updatedAt: rec.updatedAt, rencanaKirim: rec.rencanaKirim, via: rec.via, tglKirim: rec.tglKirim };
    }
    case 'mobilisasi': {
      const u = st.units.filter(function (x) { return x.id === rec.unitId || x.kode === rec.unitKode; })[0];
      return { id: rec.id, unitKode: u ? u.kode : rec.unitKode, project: projKode(rec.projectId || (u && u.projectId)), tanggal: rec.tanggal, jam: rec.jam, dari: rec.dari, ke: rec.ke, jarak: rec.jarak, moda: rec.moda, escort: rec.escort, pic: rec.pic, status: rec.status, catatan: rec.catatan };
    }
    case 'dokumentasi': {
      const k = st.pengiriman.filter(function (x) { return x.id === rec.kirimId; })[0];
      return { id: rec.id, waktu: rec.waktu, tahap: rec.tahap, project: projKode(rec.projectId), item: k ? k.tipe : (rec.tipe || ''), unitKode: rec.unitKode || '', tanggal: rec.tanggal, lokasi: rec.lokasi, catatan: rec.catatan, fileName: rec.fileName, fileUrl: rec.fileUrl, fileId: rec.fileId, mime: rec.mime, oleh: rec.oleh };
    }
    case 'revisi': return { id: rec.id, waktu: rec.waktu, project: projKode(rec.projectId), tipe: rec.tipe, lama: rec.lama, baru: rec.baru, etaLama: rec.etaLama, etaBaru: rec.etaBaru, alasan: rec.alasan, oleh: rec.oleh };
  }
  throw new Error('Koleksi tidak dikenal: ' + col);
}

function writeRow_(col, rowNum, srec) {
  const def = SHEETS[col], sh = sheet_(col), h = headerIndex_(sh);
  const existing = rowNum ? sh.getRange(rowNum, 1, 1, h.width).getValues()[0] : new Array(h.width).fill('');
  Object.keys(def.cols).forEach(function (k) {
    const c = h.idx[def.cols[k]];
    if (c === undefined || srec[k] === undefined) return;
    existing[c] = srec[k] === null ? '' : srec[k];
  });
  const target = rowNum || Math.max(2, sh.getLastRow() + 1);
  sh.getRange(target, 1, 1, h.width).setValues([existing]);
}

function replaceInColumn_(col, key, from, to, extraMatch) {
  if (!from || from === to) return;
  const raw = readRaw_(col), c = raw.h.idx[SHEETS[col].cols[key]];
  if (c === undefined) return;
  raw.rows.forEach(function (r) {
    if (r[key] === from && (!extraMatch || extraMatch(r))) raw.sh.getRange(r._row, c + 1).setValue(to);
  });
}

function applyOp_(op, email, st) {
  const col = op.col;
  if (!SHEETS[col]) throw new Error('Koleksi tidak dikenal: ' + col);
  st = st || buildState_();
  if (!st[col]) st[col] = [];
  if (op.action === 'upload') {
    if (col !== 'dokumentasi' || !op.file || !op.file.b64) throw new Error('File tidak ada');
    const d = op.data || {};
    const pk = (st.projects.filter(function (x) { return x.id === d.projectId; })[0] || {}).kode || 'Tanpa project';
    const folder = docFolder_(pk);
    const blob = Utilities.newBlob(Utilities.base64Decode(op.file.b64), op.file.mime || 'application/octet-stream', op.file.name || 'bukti');
    const f = folder.createFile(blob);
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    if (d.catatan) f.setDescription(String(d.tahap || '') + ' · ' + d.catatan);
    const rec = Object.assign({}, d, { id: op.id || ('d-' + Utilities.getUuid().slice(0, 8)), waktu: new Date().toISOString(), fileName: f.getName(), fileUrl: f.getUrl(), fileId: f.getId(), mime: blob.getContentType(), oleh: email });
    writeRow_(col, 0, toSheetRec_(col, rec, st));
    st[col].push(rec);
    return;
  }
  if (op.action === 'add') {
    const rec = Object.assign({}, op.data || {}, { id: op.id || (SHEETS[col].prefix + '-' + Utilities.getUuid().slice(0, 8)) });
    if (col === 'revisi' && !rec.oleh) rec.oleh = email;
    writeRow_(col, 0, toSheetRec_(col, rec, st));
    st[col].push(rec);
    return;
  }
  const raw = readRaw_(col);
  const row = raw.rows.filter(function (r) { return r.id === op.id; })[0];
  if (!row) return;
  if (op.action === 'remove') {
    if (col === 'dokumentasi' && row.fileId) { try { DriveApp.getFileById(row.fileId).setTrashed(true); } catch (err) {} }
    raw.sh.deleteRow(row._row);
    st[col] = st[col].filter(function (r) { return r.id !== op.id; });
    return;
  }
  if (op.action === 'update') {
    const cur = st[col].filter(function (r) { return r.id === op.id; })[0] || {};
    const merged = Object.assign({}, cur, op.data || {});
    if (col === 'projects' && merged.kode !== cur.kode) {
      ['pengiriman', 'units', 'mobilisasi', 'revisi'].forEach(function (c) { replaceInColumn_(c, 'project', cur.kode, merged.kode); });
    }
    if (col === 'pengiriman' && merged.tipe !== cur.tipe) {
      const pk = row.project;
      replaceInColumn_('units', 'item', cur.tipe, merged.tipe, function (r) { return r.project === pk; });
    }
    if (col === 'units' && merged.kode !== cur.kode) {
      replaceInColumn_('mobilisasi', 'unitKode', cur.kode, merged.kode);
    }
    writeRow_(col, row._row, toSheetRec_(col, merged, st));
    const i = st[col].indexOf(cur); if (i >= 0) st[col][i] = merged; else st[col].push(merged);
  }
}

/* ---------------- folder dokumentasi di Drive ---------------- */
function docFolder_(projectKode) {
  const props = PropertiesService.getScriptProperties();
  let root = null;
  const rid = props.getProperty('docRoot');
  if (rid) { try { root = DriveApp.getFolderById(rid); if (root.isTrashed()) root = null; } catch (err) { root = null; } }
  if (!root) {
    const parents = DriveApp.getFileById(SpreadsheetApp.getActive().getId()).getParents();
    const base = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
    root = base.createFolder('Dokumentasi Monitoring Unit');
    props.setProperty('docRoot', root.getId());
  }
  const name = String(projectKode).replace(/[\\/:*?"<>|]/g, '-');
  const it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}

/* ---------------- penanda perubahan ---------------- */
function getRev_() { return Number(PropertiesService.getScriptProperties().getProperty('rev') || 0); }
function bumpRev_() {
  PropertiesService.getScriptProperties().setProperty('rev', String(getRev_() + 1));
  try { CacheService.getScriptCache().remove('state2'); } catch (err) {}
}

/**
 * Edit langsung di sheet: beri ID baris baru, isi "Diperbarui", dan catat
 * perubahan "Rencana kini" ke tab Riwayat Perubahan.
 */
function onEdit(e) {
  try {
    const sh = e.range.getSheet(), name = sh.getName();
    const col = Object.keys(SHEETS).filter(function (k) { return SHEETS[k].name === name; })[0];
    if (!col || e.range.getRow() < 2) return;
    const def = SHEETS[col], h = headerIndex_(sh);
    const r0 = e.range.getRow(), n = e.range.getNumRows();
    for (let r = r0; r < r0 + n; r++) {
      const idC = h.idx[def.cols.id];
      if (idC !== undefined && !sh.getRange(r, idC + 1).getValue()) sh.getRange(r, idC + 1).setValue(def.prefix + '-' + Utilities.getUuid().slice(0, 8));
      const upC = def.cols.updatedAt ? h.idx[def.cols.updatedAt] : undefined;
      if (upC !== undefined) sh.getRange(r, upC + 1).setValue(new Date().toISOString());
    }
    const rkC = h.idx['Rencana kini'];
    if (col === 'pengiriman' && n === 1 && e.range.getNumColumns() === 1 && rkC !== undefined && e.range.getColumn() === rkC + 1 && e.oldValue !== undefined && String(e.oldValue) !== String(e.value)) {
      const row = sh.getRange(r0, 1, 1, h.width).getValues()[0];
      const rv = sheet_('revisi'), rh = headerIndex_(rv), line = new Array(rh.width).fill('');
      const put = function (k, v) { const c = rh.idx[SHEETS.revisi.cols[k]]; if (c !== undefined) line[c] = v; };
      put('id', 'r-' + Utilities.getUuid().slice(0, 8));
      put('waktu', new Date().toISOString());
      put('project', row[h.idx['Project']]);
      put('tipe', row[h.idx['Item unit']]);
      put('lama', Number(e.oldValue));
      put('baru', Number(e.value));
      put('alasan', 'Diubah langsung di Google Sheets');
      put('oleh', (Session.getActiveUser().getEmail() || 'Google Sheets'));
      rv.getRange(Math.max(2, rv.getLastRow() + 1), 1, 1, rh.width).setValues([line]);
    }
    bumpRev_();
  } catch (err) {
    // edit tetap tersimpan meski pencatatan otomatis gagal
  }
}
