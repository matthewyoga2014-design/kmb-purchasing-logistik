/**
 * Psikotest Mekanik KMB — salinan otomatis ke Google Drive Anda.
 * 1) Hasil tes  -> Google Sheet "Psikotest Mekanik KMB - Hasil" (diperbarui otomatis)
 * 2) Foto kamera peserta -> folder Drive "Psikotest Mekanik KMB/Foto Peserta/<Nama>"
 *
 * SETUP (sekali saja):
 *  a. Buka script.google.com > Proyek baru > tempel seluruh file ini.
 *  b. Project Settings > Script Properties > tambah:  SYNC_SECRET = (salin dari web: Pengaturan > Google Drive)
 *  c. Pilih fungsi "setup" lalu klik Run, izinkan akses Drive & Spreadsheet.
 *  d. Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone > Deploy.
 *  e. Salin URL /exec, tempel di web: Pengaturan > Google Drive > URL Apps Script > Simpan > Tes koneksi.
 */
const SUPA_URL = 'https://yoviojbfyvgpllxisjvy.supabase.co';
const SUPA_KEY = 'sb_publishable_I26enb2Kz8iF4WFdH8vixA_8kek-kM9';
const ROOT_NAME = 'Psikotest Mekanik KMB';

function props_() { return PropertiesService.getScriptProperties(); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function rpc_(name, args) {
  const r = UrlFetchApp.fetch(SUPA_URL + '/rest/v1/rpc/' + name, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: SUPA_KEY }, payload: JSON.stringify(args || {})
  });
  const txt = r.getContentText();
  if (r.getResponseCode() >= 300) throw new Error(name + ': ' + txt);
  return txt ? JSON.parse(txt) : null;
}

function root_() {
  const p = props_(); let id = p.getProperty('ROOT_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const it = DriveApp.getFoldersByName(ROOT_NAME);
  const f = it.hasNext() ? it.next() : DriveApp.createFolder(ROOT_NAME);
  p.setProperty('ROOT_ID', f.getId()); return f;
}
function sub_(parent, name) { const it = parent.getFoldersByName(name); return it.hasNext() ? it.next() : parent.createFolder(name); }
function ss_() {
  const p = props_(); let id = p.getProperty('SHEET_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  const ss = SpreadsheetApp.create(ROOT_NAME + ' - Hasil');
  DriveApp.getFileById(ss.getId()).moveTo(root_());
  p.setProperty('SHEET_ID', ss.getId()); return ss;
}

function setup() {
  if (!props_().getProperty('SYNC_SECRET')) throw new Error('Isi dulu Script Property SYNC_SECRET (dari web: Pengaturan > Google Drive).');
  const ss = ss_(); sub_(root_(), 'Foto Peserta');
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncAll').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncAll').timeBased().everyMinutes(10).create();
  syncAll();
  Logger.log('Google Sheet: ' + ss.getUrl());
  Logger.log('Folder Drive: ' + root_().getUrl());
}

function doGet() { return json_({ ok: true, app: 'psikotest-mekanik' }); }

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents || '{}');
    if (b.action === 'photo') return json_(savePhoto_(b));
    if (b.action === 'sync') { syncAll(); return json_({ ok: true }); }
    if (b.action === 'ping') return json_({ ok: true, sheetUrl: ss_().getUrl(), folderUrl: root_().getUrl(), secretSet: !!props_().getProperty('SYNC_SECRET') });
    return json_({ ok: false, error: 'aksi tidak dikenal' });
  } catch (err) { return json_({ ok: false, error: String(err.message || err) }); }
}

function savePhoto_(b) {
  const who = rpc_('pk_photo_ok', { p_token: b.token });           // menolak token salah/kedaluwarsa
  const safe = String(who.nama || 'Peserta').replace(/[\\/:*?"<>|]/g, ' ').trim();
  const folder = sub_(sub_(root_(), 'Foto Peserta'), safe + ' - ' + who.sid);
  const data = String(b.b64 || '').replace(/^data:image\/\w+;base64,/, '');
  if (!data || data.length > 400000) throw new Error('foto tidak valid');
  const stamp = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd_HHmmss');
  const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(data), 'image/jpeg', (b.kind || 'foto') + '_' + stamp + '.jpg'));
  try { rpc_('pk_log_event', { p_token: b.token, p_module: b.module, p_type: 'foto', p_detail: (b.kind || 'foto') + '|' + file.getUrl() }); } catch (e) {}
  return { ok: true, url: file.getUrl() };
}

/* ---------- perhitungan (sama dengan web) ---------- */
const LEVELS = ['Helper', 'Junior', 'Middle', 'Senior', 'Supervisor'];
const DEF = { wTeknis: 60, wKinerja: 40, gTop: 81, gMid: 66, gPass: 56,
  cat: [{ k: 'A', min: 81, label: 'Sangat Baik' }, { k: 'B', min: 66, label: 'Baik' }, { k: 'C', min: 56, label: 'Cukup' }, { k: 'D', min: 41, label: 'Kurang' }, { k: 'E', min: 0, label: 'Sangat Kurang' }],
  scale: [{ min: 86, h: 'A', b: 4, k: 'A' }, { min: 81, h: 'A-', b: 3.67, k: 'A' }, { min: 76, h: 'B+', b: 3.33, k: 'B' }, { min: 71, h: 'B', b: 3, k: 'B' }, { min: 66, h: 'B-', b: 2.67, k: 'B' }, { min: 61, h: 'C+', b: 2.33, k: 'C' }, { min: 56, h: 'C', b: 2, k: 'C' }, { min: 41, h: 'D', b: 1, k: 'D' }, { min: 0, h: 'E', b: 0, k: 'E' }],
  bands: { Helper: ['Helper'], Junior: ['G1', 'G2', 'G3'], Middle: ['G4', 'G5', 'G6'], Senior: ['G7', 'G8', 'G9'], Supervisor: ['G10'] },
  rekKontrak: { A: 'Angkat karyawan tetap / layak naik grade', B: 'Perpanjang kontrak', C: 'Perpanjang kontrak dengan pembinaan', D: 'Perpanjang singkat dengan evaluasi ketat', E: 'Tidak diperpanjang' },
  rekNew: { A: 'Diterima', B: 'Diterima', C: 'Dipertimbangkan (perlu pembinaan)', D: 'Tidak direkomendasikan', E: 'Tidak direkomendasikan' } };
const FPK_VAL = { A: 95, B: 82, C: 67, D: 55, E: 25 }, KMB_SP = [0, 7.5, 12.5, 17.5];
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
function kmbScore(k) { if (!k || !k.scores) return null; const v = k.scores.filter(x => +x > 0).map(Number); if (v.length < 10) return null; return Math.max(0, Math.min(100, v.reduce((a, b) => a + b, 0) / 40 * 100 - (KMB_SP[+k.sp || 0] || 0))); }
function fpkTotal(f) { if (!f) return null; const A = (f.A || []).filter(String).map(x => FPK_VAL[x]), B = (f.B || []).filter(String).map(x => FPK_VAL[x]); if (A.length < 5 || B.length < 10) return null;
  const nA = avg(A), nB = avg(B), nC = Math.max(0, 100 - (+f.sakit || 0) * 2 - (+f.izin || 0) * 3 - (+f.alpa || 0) * 10), nD = Math.max(0, 100 - (+f.teguran || 0) * 10 - (+f.sp1 || 0) * 20 - (+f.sp2 || 0) * 30 - (+f.sp3 || 0) * 40);
  const E = (f.E || []).filter(x => x && x.v).map(x => FPK_VAL[x.v]), F = (f.F || []).filter(x => x && x.v).map(x => FPK_VAL[x.v]), base = (nA + nB) / 2;
  return nA * .3 + nB * .3 + nC * .15 + nD * .15 + (E.length ? avg(E) : base) * .05 + (F.length ? avg(F) : base) * .05; }
function kinerja(k) { if (!k) return null; const p = []; if (k.tpl !== 'FPK') { const s = kmbScore(k.kmb); if (s != null) p.push(s); } if (k.tpl !== 'KMB') { const t = fpkTotal(k.fpk); if (t != null) p.push(t); } return p.length ? avg(p) : null; }
function scaleRows(g) { return (g.scale || DEF.scale).slice().sort((a, b) => b.min - a.min); }
function category(g, sc) { if (sc == null) return null; const r = scaleRows(g), L = r.find(x => sc >= x.min) || r[r.length - 1]; const c = g.cat.find(x => x.k === L.k) || g.cat[g.cat.length - 1]; return { k: c.k, label: c.label, h: L.h, b: L.b }; }
function grade(g, level, sc) { if (sc == null || !level) return '–'; const list = g.bands[level] || []; if (!list.length) return '–';
  if (sc >= g.gPass) { let i = 0; if (list.length > 1) { if (sc >= g.gTop) i = list.length - 1; else if (sc >= g.gMid) i = 1; } return list[i]; }
  const li = LEVELS.indexOf(level); if (li > 0) { const pv = g.bands[LEVELS[li - 1]] || []; return (pv[pv.length - 1] || '–') + ' (turun level)'; } return 'Belum memenuhi'; }

function syncAll() {
  const lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return;
  try {
    const d = rpc_('pk_export', { p_secret: props_().getProperty('SYNC_SECRET') });
    const g = Object.assign({}, DEF, d.settings || {});
    const mods = d.modules || [], att = d.attempts || [];
    const r1 = v => v == null ? '' : Math.round(v * 10) / 10, tz = 'Asia/Jakarta';
    const hasil = [], rinci = [];
    (d.sessions || []).forEach((s, i) => {
      const a = att.filter(x => x.session_id === s.id), ids = s.module_ids || [];
      const done = ids.map(id => a.find(x => x.module_id === id)).filter(x => x && x.submitted_at);
      const teknis = done.length ? avg(done.map(x => +x.score)) : null, kin = kinerja(s.kinerja);
      const akhir = teknis != null ? (kin != null ? (teknis * g.wTeknis + kin * g.wKinerja) / ((+g.wTeknis + +g.wKinerja) || 1) : teknis) : kin;
      const c = category(g, akhir), rek = s.keputusan || (c ? (s.jenis === 'Akhir Kontrak' ? g.rekKontrak : g.rekNew)[c.k] : '');
      const lulus = teknis == null ? '' : s.grade_target ? (teknis >= g.gPass ? 'Lulus ' : 'Tidak lulus ') + s.grade_target : grade(g, s.level, teknis);
      let status = done.length && done.length === ids.length ? 'Selesai' : a.length ? 'Sedang' : 'Belum mulai';
      if (status !== 'Selesai' && s.expires_at && new Date(s.expires_at) < new Date()) status = 'Kedaluwarsa';
      hasil.push([i + 1, new Date(s.created_at), s.nama, s.nik || '', s.grade_target || s.level || '', s.jenis, s.jobsite || '', s.grade_saat_ini || '',
        r1(teknis), r1(kin), r1(akhir), c ? c.h : '', c ? c.b : '', c ? c.label : '', lulus, rek,
        a.reduce((x, y) => x + (+y.violations || 0), 0), status, (s.kinerja && s.kinerja.kelebihan) || '', (s.kinerja && s.kinerja.kekurangan) || '', s.catatan || '']);
      a.forEach(x => { const m = mods.find(y => y.id === x.module_id) || {}, ev = x.events || [];
        const foto = ev.filter(e => e.type === 'foto').map(e => String(e.d).split('|')[1]).filter(String);
        const topik = Object.keys(x.by_topic || {}).map(t => { const v = x.by_topic[t]; return t + ' ' + (v.total ? Math.round(100 * v.benar / v.total) : 0) + '%'; }).join('; ');
        const pel = ev.filter(e => ['tab', 'fullscreen', 'kamera', 'auto-kirim'].indexOf(e.type) >= 0).map(e => Utilities.formatDate(new Date(e.t), tz, 'HH:mm:ss') + ' ' + e.type).join('; ');
        rinci.push([s.nama, s.nik || '', s.grade_target || '', m.title || '', x.started_at ? new Date(x.started_at) : '', x.submitted_at ? new Date(x.submitted_at) : '',
          x.submitted_at ? x.correct + '/' + x.total : '', x.submitted_at ? r1(+x.score) : '', topik, +x.violations || 0, pel, foto.length, foto[foto.length - 1] || '']); });
    });
    const ss = ss_();
    write_(ss, 'Hasil Tes', ['No', 'Tanggal', 'Nama', 'NIK', 'Grade Dituju', 'Jenis', 'Jobsite', 'Grade Saat Ini', 'Nilai Teknis', 'Nilai Kinerja', 'Nilai Akhir', 'Huruf', 'Bobot', 'Kategori', 'Hasil', 'Rekomendasi', 'Pelanggaran', 'Status', 'Kelebihan', 'Perlu Ditingkatkan', 'Catatan'], hasil);
    write_(ss, 'Rincian', ['Nama', 'NIK', 'Grade Dituju', 'Soal', 'Mulai', 'Selesai', 'Benar', 'Nilai', 'Nilai per Topik', 'Pelanggaran', 'Rincian Pelanggaran', 'Jumlah Foto', 'Foto Terakhir'], rinci);
    ss.getSheets().forEach(sh => { if (['Hasil Tes', 'Rincian'].indexOf(sh.getName()) < 0 && ss.getSheets().length > 2) ss.deleteSheet(sh); });
  } finally { lock.releaseLock(); }
}

function write_(ss, name, head, rows) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#EDE7FB');
  if (rows.length) sh.getRange(2, 1, rows.length, head.length).setValues(rows.map(r => head.map((_, i) => r[i] === undefined || r[i] === null ? '' : r[i])));
  sh.setFrozenRows(1);
}
