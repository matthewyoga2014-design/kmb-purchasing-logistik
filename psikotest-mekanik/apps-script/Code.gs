/**
 * Psikotest Mekanik KMB — salinan otomatis ke Google Drive Anda.
 * 1) Hasil tes  -> Google Sheet "Psikotest Mekanik KMB - Hasil" (diperbarui otomatis)
 * 2) Satu folder per karyawan -> "Psikotest Mekanik KMB/Karyawan/<Nama> - <NIK>" berisi:
 *      - "Rekap <Nama>" (Google Sheet): semua tes + penilaian kinerja karyawan itu (track record)
 *      - "Tes <tanggal> <jenis> - <id>": foto kamera saat tes
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
  const ss = ss_(); karyawan_();
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

const TZ = 'Asia/Jakarta';
const safe_ = v => String(v || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
const pnorm_ = v => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
function personName_(nama, nik) { return safe_(nama || 'Peserta') + ' - ' + (safe_(nik) || 'tanpa NIK'); }
function testName_(created, jenis, grade, sid) { return 'Tes ' + Utilities.formatDate(new Date(created), TZ, 'yyyy-MM-dd') + ' ' + safe_(jenis || '') + (grade ? ' ' + safe_(grade) : '') + ' - ' + sid; }
function karyawan_() { return sub_(root_(), 'Karyawan'); }
/* folder tes satu peserta (dibuat sekali; dikunci agar tidak dobel saat foto masuk bersamaan) */
function testFolder_(nama, nik, created, jenis, grade, sid) {
  const lock = LockService.getScriptLock(), ok = lock.tryLock(60000);
  try { return sub_(sub_(karyawan_(), personName_(nama, nik)), testName_(created, jenis, grade, sid)); } finally { if (ok) lock.releaseLock(); }
}
function savePhoto_(b) {
  const who = rpc_('pk_photo_ok', { p_token: b.token });           // menolak token salah/kedaluwarsa
  const folder = testFolder_(who.nama, who.nik, who.created_at || new Date(), who.jenis, who.grade, who.sid);
  const data = String(b.b64 || '').replace(/^data:image\/\w+;base64,/, '');
  if (!data || data.length > 400000) throw new Error('foto tidak valid');
  const stamp = Utilities.formatDate(new Date(), TZ, 'yyyyMMdd_HHmmss');
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

const KB_K = ['Inisiatif & Kreativitas', 'Disiplin & Kerajinan', 'Komunikasi & Etika Kerja', 'Tanggung Jawab & Motivasi', 'Kerjasama Tim', 'Integritas & Kejujuran'];
const KB_T = ['Skill / Keahlian Teknis', 'Pengetahuan Pekerjaan', 'Kualitas Kerja (ATR)', 'Ketepatan Waktu & Pencapaian Target', 'Problem Solving / Troubleshooting', 'Perawatan Unit & Tools', 'Laporan Kerja', 'K3 & 5R'];
const KB_I = [['teguran', 'Teguran', 10], ['sp1', 'SP 1', 20], ['sp2', 'SP 2', 30], ['sp3', 'SP 3', 40]];
const KB_H = [['terlambat', 'Terlambat / pulang awal', [0, 1, 2], 1], ['absen', 'Tidak absen', [0, 1, 2], 1], ['ijin', 'Sakit / izin', [0, 1, 2], 1], ['alpa', 'Alpa', [0, 1, 1], 0]];
function kinCalc(d) { const K = (d.K || []).map(Number).filter(x => x > 0), T = (d.T || []).map(Number).filter(x => x > 0);
  const pK = K.length ? avg(K) / 4 * 100 : null, pT = T.length ? avg(T) / 4 * 100 : null;
  const pI = Math.max(0, 100 - KB_I.reduce((a, x) => a + (+(d.I || {})[x[0]] || 0) * x[2], 0));
  const bln = Math.max(1, +(d.H || {}).bulan || 3);
  const pH = avg(KB_H.map(x => { const v = (+(d.H || {})[x[0]] || 0) / (x[3] ? bln : 1), th = x[2]; return v <= th[0] ? 4 : v <= th[1] ? 3 : v <= th[2] ? 2 : 1; })) / 4 * 100;
  const X = (d.X || []).filter(x => x && x.t && +x.v > 0).map(x => +x.v), pX = X.length ? avg(X) / 4 * 100 : null;
  let skor = null; if (K.length === KB_K.length && T.length === KB_T.length) { const p = [[pK, 30], [pT, 35], [pI, 15], [pH, 15]]; if (pX != null) p.push([pX, 5]);
    skor = Math.max(0, Math.min(100, p.reduce((a, x) => a + x[0] * x[1], 0) / p.reduce((a, x) => a + x[1], 0))); }
  return { pK, pT, pI, pH, pX, skor }; }
function kepLabel(k) { const m = { tetap: 'Pengangkatan karyawan tetap', perpanjang: 'Perpanjang kontrak', promosi: 'Promosi / kenaikan grade', gaji: 'Penyesuaian gaji', tidak: 'Tidak diperpanjang' };
  return (m[k.rekomendasi] || k.rekomendasi || '') + (k.rekomendasi === 'perpanjang' && k.kontrak_bulan ? ' ' + k.kontrak_bulan + ' bulan' : '') + (k.rekomendasi === 'tidak' && k.data && k.data.alasan ? ' (' + k.data.alasan + ')' : ''); }

function syncAll() {
  const lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return;
  try {
    try { moveImages_(150000); } catch (e) { Logger.log('Gambar soal: ' + e); }
    const d = rpc_('pk_export', { p_secret: props_().getProperty('SYNC_SECRET') });
    const g = Object.assign({}, DEF, d.settings || {});
    const mods = d.modules || [], att = d.attempts || [];
    const r1 = v => v == null ? '' : Math.round(v * 10) / 10, tz = 'Asia/Jakarta';
    const hasil = [], rinci = [];
    (d.sessions || []).forEach((s, i) => {
      const a = att.filter(x => x.session_id === s.id), ids = s.module_ids || [];
      const done = ids.map(id => a.find(x => x.module_id === id)).filter(x => x && x.submitted_at);
      const teknis = done.length ? avg(done.map(x => +x.score)) : null, kin = null;
      const akhir = teknis != null ? (kin != null ? (teknis * g.wTeknis + kin * g.wKinerja) / ((+g.wTeknis + +g.wKinerja) || 1) : teknis) : kin;
      const c = category(g, akhir), rek = s.keputusan || (c ? (s.jenis === 'Akhir Kontrak' ? g.rekKontrak : g.rekNew)[c.k] : '');
      const lulus = teknis == null ? '' : s.grade_target ? (teknis >= g.gPass ? 'Lulus ' : 'Tidak lulus ') + s.grade_target : grade(g, s.level, teknis);
      let status = done.length && done.length === ids.length ? 'Selesai' : a.length ? 'Sedang' : 'Belum mulai';
      if (status !== 'Selesai' && s.expires_at && new Date(s.expires_at) < new Date()) status = 'Kedaluwarsa';
      hasil.push([i + 1, new Date(s.created_at), s.nama, s.nik || '', s.grade_target || s.level || '', s.jenis, s.jobsite || '', s.grade_saat_ini || '',
        r1(akhir), c ? c.h : '', c ? c.label : '', lulus, rek,
        a.reduce((x, y) => x + (+y.violations || 0), 0), status, s.catatan || '']);
      a.forEach(x => { const m = mods.find(y => y.id === x.module_id) || {}, ev = x.events || [];
        const foto = ev.filter(e => e.type === 'foto').map(e => String(e.d).split('|')[1]).filter(String);
        const topik = Object.keys(x.by_topic || {}).map(t => { const v = x.by_topic[t]; return t + ' ' + (v.total ? Math.round(100 * v.benar / v.total) : 0) + '%'; }).join('; ');
        const pel = ev.filter(e => ['tab', 'fullscreen', 'kamera', 'auto-kirim'].indexOf(e.type) >= 0).map(e => Utilities.formatDate(new Date(e.t), tz, 'HH:mm:ss') + ' ' + e.type).join('; ');
        rinci.push([s.nama, s.nik || '', s.grade_target || '', m.title || '', x.started_at ? new Date(x.started_at) : '', x.submitted_at ? new Date(x.submitted_at) : '',
          x.submitted_at ? x.correct + '/' + x.total : '', x.submitted_at ? r1(+x.score) : '', topik, +x.violations || 0, pel, foto.length, foto[foto.length - 1] || '']); });
    });
    const ss = ss_();
    write_(ss, 'Hasil Tes', ['No', 'Tanggal', 'Nama', 'NIK', 'Grade Dituju', 'Jenis', 'Jobsite', 'Grade Saat Ini', 'Nilai', 'Predikat', 'Kategori', 'Hasil', 'Rekomendasi', 'Pelanggaran', 'Status', 'Catatan'], hasil);
    write_(ss, 'Rincian', ['Nama', 'NIK', 'Grade Dituju', 'Soal', 'Mulai', 'Selesai', 'Benar', 'Nilai', 'Nilai per Topik', 'Pelanggaran', 'Rincian Pelanggaran', 'Jumlah Foto', 'Foto Terakhir'], rinci);
    const kin = (d.kinerja || []).map((k, i) => { const dd = k.data || {}, r = kinCalc(dd), c = category(g, r.skor);
      return [i + 1, new Date(k.created_at), k.nama, k.nik || '', k.jabatan || '', k.grade || '', k.jobsite || '', k.status_karyawan || '', k.periode || '', k.penilai || '']
        .concat(KB_K.map((_, j) => +(dd.K || [])[j] || '')).concat(KB_T.map((_, j) => +(dd.T || [])[j] || ''))
        .concat(KB_I.map(x => +(dd.I || {})[x[0]] || 0)).concat(KB_H.map(x => +(dd.H || {})[x[0]] || 0))
        .concat([(dd.X || []).filter(x => x && x.t).map(x => x.t + ' (' + (x.v || '-') + ')').join('; '), r1(r.pK), r1(r.pT), r1(r.pI), r1(r.pH), r1(r.pX), r1(r.skor), c ? c.h : '', c ? c.label : '', kepLabel(k), dd.kelebihan || '', dd.kekurangan || '', dd.catatan || '']); });
    write_(ss, 'Penilaian Kinerja', ['No', 'Tanggal', 'Nama', 'NIK', 'Jabatan', 'Grade', 'Jobsite', 'Status', 'Periode', 'Penilai'].concat(KB_K.map((t, j) => 'K' + (j + 1) + ' ' + t)).concat(KB_T.map((t, j) => 'T' + (j + 1) + ' ' + t))
      .concat(KB_I.map(x => x[1])).concat(KB_H.map(x => x[1])).concat(['Tugas Tambahan', 'Kepribadian (30%)', 'Target Kinerja (35%)', 'Indisipliner (15%)', 'Kehadiran (15%)', 'Tugas Tambahan (5%)', 'Skor Kinerja', 'Predikat', 'Kategori', 'Keputusan', 'Kelebihan', 'Perlu Ditingkatkan', 'Catatan']), kin);
    let ans = []; try { ans = rpc_('pk_export_answers', { p_secret: props_().getProperty('SYNC_SECRET') }) || []; } catch (e) {}
    const people = people_(d, g, mods, att, ans);
    try { driveReport_(d); } catch (e) { Logger.log('Laporan Drive: ' + e); }
    write_(ss, 'Riwayat Karyawan', ['Nama', 'NIK', 'Grade Terakhir', 'Jumlah Tes', 'Nilai Tes Pertama', 'Tanggal Tes Pertama', 'Nilai Tes Terakhir', 'Tanggal Tes Terakhir', 'Perubahan', 'Hasil Terakhir', 'Skor Kinerja Terakhir', 'Keputusan Kinerja Terakhir', 'Folder Karyawan'],
      people.map(p => [p.nama, p.nik, p.grade, p.T.length, p.T.length ? r1(p.T[0].nilai) : '', p.T.length ? p.T[0].t : '', p.T.length > 1 ? r1(p.T[p.T.length - 1].nilai) : '', p.T.length > 1 ? p.T[p.T.length - 1].t : '',
        p.T.length > 1 ? r1(p.T[p.T.length - 1].nilai - p.T[0].nilai) : '', p.lastHasil, p.lastK ? r1(p.lastK.nilai) : '', p.lastK ? p.lastK.kep : '', p.url || '']));
    const keep = ['Hasil Tes', 'Rincian', 'Penilaian Kinerja', 'Riwayat Karyawan'];
    ss.getSheets().forEach(sh => { if (keep.indexOf(sh.getName()) < 0 && ss.getSheets().length > 1) ss.deleteSheet(sh); });
  } finally { lock.releaseLock(); }
}

/* ---------- satu folder per karyawan: rekap tes + penilaian kinerja, foto per tes ---------- */
const DRV = { sessions: [], kinerja: [], files: [], person: {} };
function people_(d, g, mods, att, ans) {
  DRV.sessions = []; DRV.kinerja = []; DRV.files = []; DRV.person = {};
  const r1 = v => v == null ? '' : Math.round(v * 10) / 10;
  const G = {}, byName = {};
  const all = (d.sessions || []).map(x => ['tes', x]).concat((d.kinerja || []).map(x => ['kin', x]));
  const add = (key, kind, x) => { const p = G[key] = G[key] || { nama: x.nama, nik: '', tes: [], kin: [] }; p[kind].push(x); if (x.nik && !p.nik) p.nik = x.nik; };
  all.filter(a => pnorm_(a[1].nik)).forEach(a => { const k = 'n:' + pnorm_(a[1].nik); add(k, a[0], a[1]); byName[pnorm_(a[1].nama)] = byName[pnorm_(a[1].nama)] || k; });
  all.filter(a => !pnorm_(a[1].nik)).forEach(a => add(byName[pnorm_(a[1].nama)] || 'm:' + pnorm_(a[1].nama), a[0], a[1]));
  const kar = karyawan_(), keepPerson = {}, keepTest = {};
  const people = Object.keys(G).map(key => {
    const p = G[key], ev = [];
    p.tes.forEach(s => { const a = att.filter(x => x.session_id === s.id), done = (s.module_ids || []).map(id => a.find(x => x.module_id === id)).filter(x => x && x.submitted_at);
      const nilai = done.length ? avg(done.map(x => +x.score)) : null, c = category(g, nilai);
      const t = done.length ? new Date(done.map(x => x.submitted_at).sort().pop()) : new Date(s.created_at);
      const hasil = nilai == null ? 'Belum selesai' : s.grade_target ? (nilai >= g.gPass ? 'Lulus ' : 'Tidak lulus ') + s.grade_target : grade(g, s.level, nilai);
      ev.push({ kind: 'tes', t, s, nilai, c, hasil, per: (s.module_ids || []).map(id => { const m = mods.find(y => y.id === id) || {}, x = a.find(y => y.module_id === id); return [m.title || '', m.grade || '', x && x.submitted_at ? x.correct + '/' + x.total : '', x && x.submitted_at ? r1(+x.score) : '']; }) }); });
    p.kin.forEach(k => { const r = kinCalc(k.data || {}), c = category(g, r.skor); ev.push({ kind: 'kin', t: new Date(k.created_at), k, r, nilai: r.skor, c, kep: kepLabel(k) }); });
    ev.sort((a, b) => a.t - b.t);
    const T = ev.filter(e => e.kind === 'tes' && e.nilai != null), K = ev.filter(e => e.kind === 'kin'), lastS = ev.filter(e => e.kind === 'tes').pop();
    const o = { nama: p.nama, nik: p.nik, ev, T, lastK: K[K.length - 1] || null, lastHasil: lastS ? lastS.hasil : '',
      grade: lastS ? (lastS.s.grade_target || lastS.s.level || '') : (K.length ? K[K.length - 1].k.grade || '' : '') };
    /* folder karyawan + rekap */
    const fname = personName_(p.nama, p.nik), folder = sub_(kar, fname); keepPerson[fname] = 1; o.url = folder.getUrl();
    p.tes.forEach(s => { keepTest[left8_(s.id)] = { person: folder, name: testName_(s.created_at, s.jenis, s.grade_target || s.level, left8_(s.id)) }; });
    rekap_(folder, o, r1);
    p.tes.forEach(s2 => DRV.person[s2.id] = folder.getId());
    try { pdfs_(folder, o, g, mods, att, ans || []); } catch (e) { Logger.log('PDF ' + o.nama + ': ' + e); }
    return o; });
  tidyFolders_(kar, keepPerson, keepTest);
  return people.sort((a, b) => a.nama.localeCompare(b.nama));
}
function left8_(id) { return String(id).slice(0, 8); }
/* Rapikan Drive: setiap folder foto tes (termasuk folder lama "Foto Peserta/<Nama> - <id>" dan folder dobel)
   digabung ke "Karyawan/<Nama> - <NIK>/Tes ..."; folder yang datanya sudah dihapus di web dibuang ke Sampah. */
function tidyFolders_(kar, persons, tests) {
  const found = {};   // sid -> [folder]
  const scan = parent => { const it = parent.getFolders(); while (it.hasNext()) { const f = it.next(), m = f.getName().match(/ - ([0-9a-f]{8})$/); if (m) (found[m[1]] = found[m[1]] || []).push(f); } };
  const pit = kar.getFolders(), pf = []; while (pit.hasNext()) { const f = pit.next(); pf.push(f); scan(f); }
  const old = root_().getFoldersByName('Foto Peserta'), oldF = old.hasNext() ? old.next() : null; if (oldF) scan(oldF);
  Object.keys(found).forEach(sid => {
    const t = tests[sid];
    if (!t) { found[sid].forEach(f => f.setTrashed(true)); return; }
    const target = sub_(t.person, t.name);
    found[sid].forEach(f => { if (f.getId() === target.getId()) return;
      const fi = f.getFiles(); while (fi.hasNext()) fi.next().moveTo(target);
      f.setTrashed(true); });
  });
  pf.forEach(f => { if (!persons[f.getName()]) { const sub = f.getFolders(); let keep = false; while (sub.hasNext()) if (!sub.next().isTrashed()) keep = true; if (!keep) f.setTrashed(true); } });
  if (oldF) { const sub = oldF.getFolders(); let any = false; while (sub.hasNext()) if (!sub.next().isTrashed()) any = true; if (!any && !oldF.getFiles().hasNext()) oldF.setTrashed(true); }
}
/* Google Sheet "Rekap <Nama>" di folder karyawan — hanya ditulis ulang bila isinya berubah */
function rekap_(folder, p, r1) {
  const fmtD = t => Utilities.formatDate(t, TZ, 'dd MMM yyyy');
  const rows = p.ev.map(e => e.kind === 'tes'
    ? [fmtD(e.t), 'Tes kompetensi', e.s.jenis || '', e.s.grade_target || e.s.level || '', r1(e.nilai), e.c ? e.c.h : '', e.c ? e.c.label : '', e.hasil, e.s.keputusan || '', '']
    : [fmtD(e.t), 'Penilaian kinerja', e.k.periode || '', e.k.grade || '', r1(e.nilai), e.c ? e.c.h : '', e.c ? e.c.label : '', '', e.kep, [e.k.data && e.k.data.kelebihan, e.k.data && e.k.data.kekurangan].filter(x => x).join(' | ')]);
  const per = []; p.ev.filter(e => e.kind === 'tes').forEach(e => e.per.forEach(x => per.push([fmtD(e.t), e.s.jenis || ''].concat(x))));
  const kin = p.ev.filter(e => e.kind === 'kin').map(e => [fmtD(e.t), e.k.periode || '', e.k.penilai || '', r1(e.r.pK), r1(e.r.pT), r1(e.r.pI), r1(e.r.pH), r1(e.r.pX), r1(e.r.skor), e.c ? e.c.h : '', e.kep]);
  const T = p.T, ring = [['Nama', p.nama], ['NIK', p.nik || '–'], ['Grade terakhir', p.grade || '–'], ['Jumlah tes', T.length], ['Tes pertama', T.length ? r1(T[0].nilai) + ' (' + fmtD(T[0].t) + ')' : '–'],
    ['Tes terakhir', T.length > 1 ? r1(T[T.length - 1].nilai) + ' (' + fmtD(T[T.length - 1].t) + ')' : '–'], ['Perubahan', T.length > 1 ? r1(T[T.length - 1].nilai - T[0].nilai) : '–'], ['Hasil terakhir', p.lastHasil || '–'], ['Keputusan kinerja terakhir', p.lastK ? p.lastK.kep : '–']];
  const sig = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify([ring, rows, per, kin])));
  const name = 'Rekap ' + safe_(p.nama), it = folder.getFilesByName(name);
  let ss; if (it.hasNext()) { const f = it.next(); if (f.getDescription() === sig) return; ss = SpreadsheetApp.openById(f.getId()); }
  else { ss = SpreadsheetApp.create(name); DriveApp.getFileById(ss.getId()).moveTo(folder); }
  write_(ss, 'Ringkasan', ['Data', 'Isi'], ring);
  write_(ss, 'Riwayat', ['Tanggal', 'Kegiatan', 'Jenis / Periode', 'Grade', 'Nilai', 'Predikat', 'Kategori', 'Hasil', 'Keputusan', 'Catatan'], rows);
  write_(ss, 'Nilai per Sheet Tes', ['Tanggal Tes', 'Jenis', 'Sheet Soal', 'Grade Sheet', 'Benar', 'Nilai'], per);
  write_(ss, 'Penilaian Kinerja', ['Tanggal', 'Periode', 'Penilai', 'Kepribadian (30%)', 'Target Kinerja (35%)', 'Indisipliner (15%)', 'Kehadiran (15%)', 'Tugas Tambahan (5%)', 'Skor', 'Predikat', 'Keputusan'], kin);
  ss.getSheets().forEach(sh => { if (['Ringkasan', 'Riwayat', 'Nilai per Sheet Tes', 'Penilaian Kinerja'].indexOf(sh.getName()) < 0 && ss.getSheets().length > 1) ss.deleteSheet(sh); });
  DriveApp.getFileById(ss.getId()).setDescription(sig);
}

/* ---------- PDF hasil tes & penilaian kinerja (seperti cetak di web), disimpan di folder karyawan ---------- */
const H_ = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const CSS_ = '<style>body{font-family:Arial,sans-serif;font-size:10pt;color:#111}h1{font-size:15pt;margin:0}h2{font-size:11.5pt;margin:14px 0 6px;border-bottom:1px solid #999;padding-bottom:2px}'
  + 'table{border-collapse:collapse;width:100%}td,th{border:1px solid #888;padding:4px 6px;vertical-align:top;font-size:9.5pt}th{background:#eee;text-align:left}.n{text-align:right}.c{text-align:center}'
  + '.kv td{border:none;padding:2px 6px}.kv td:first-child{color:#555;width:150px}.big{font-size:20pt;font-weight:bold}.ok{color:#15803D;font-weight:bold}.no{color:#B91C1C;font-weight:bold}.mut{color:#666;font-size:9pt}'
  + '.g td{width:9%;text-align:center;font-size:8.5pt;padding:2px}.b{background:#DCFCE7}.s{background:#FEE2E2}.k{background:#F3F4F6}</style>';
function head_(title) { return '<html><head><meta charset="utf-8">' + CSS_ + '</head><body><div class="mut">PT Karunia Mandiri Berkarya · Plant Tambang</div><h1>' + H_(title) + '</h1>'; }
function sign_() { const c = [['Karyawan', 'Karyawan'], ['Dibuat oleh', 'Atasan Langsung'], ['Diketahui oleh', 'HRGA Dept.'], ['Disetujui oleh', 'PJO / Manager']];
  return '<h2>Pengesahan</h2><table><tr>' + c.map(x => '<th class="c" style="width:25%">' + x[0] + '</th>').join('') + '</tr><tr>' + c.map(() => '<td style="height:70px"></td>').join('') + '</tr><tr>'
    + c.map(x => '<td class="c">(.............................)<br><b>' + x[1] + '</b></td>').join('') + '</tr><tr>' + c.map(() => '<td>Tgl:</td>').join('') + '</tr></table>'; }
function savePdf_(folder, name, html) {
  const sig = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, html));
  const it = folder.getFilesByName(name); if (it.hasNext()) { const f = it.next(); if (f.getDescription() === sig) return f; f.setTrashed(true); }
  const pdf = Utilities.newBlob(html, 'text/html', name + '.html').getAs('application/pdf').setName(name);
  const f = folder.createFile(pdf); f.setDescription(sig); return f;
}
function pdfs_(person, p, g, mods, att, ans) {
  const fmtD = t => Utilities.formatDate(new Date(t), TZ, 'dd MMM yyyy HH:mm'), r1 = v => v == null ? '–' : (Math.round(v * 10) / 10).toString().replace('.', ',');
  const keepK = {};
  p.ev.forEach(e => {
    if (e.kind === 'tes') {
      const s = e.s, sid = left8_(s.id); if (e.nilai == null) return;
      const a = att.filter(x => x.session_id === s.id), done = a.filter(x => x.submitted_at);
      const tops = {}; done.forEach(x => Object.keys(x.by_topic || {}).forEach(t => { const v = x.by_topic[t]; tops[t] = tops[t] || [0, 0]; tops[t][0] += +v.benar; tops[t][1] += +v.total; }));
      const tl = Object.keys(tops).map(t => [t, tops[t][1] ? 100 * tops[t][0] / tops[t][1] : 0, tops[t]]).sort((x, y) => y[1] - x[1]);
      const rek = s.keputusan || (e.c ? (s.jenis === 'Akhir Kontrak' ? g.rekKontrak : g.rekNew)[e.c.k] : '');
      const viol = a.reduce((x, y) => x + (+y.violations || 0), 0);
      const evs = [].concat.apply([], a.map(x => (x.events || []).filter(v => ['tab', 'fullscreen', 'kamera', 'auto-kirim'].indexOf(v.type) >= 0).map(v => Utilities.formatDate(new Date(v.t), TZ, 'HH:mm:ss') + ' ' + v.type)));
      const nfoto = [].concat.apply([], a.map(x => (x.events || []).filter(v => v.type === 'foto'))).length;
      let h = head_('Resume Hasil Psikotest') + '<table class="kv" style="margin-top:8px"><tr><td>Nama</td><td><b>' + H_(s.nama) + '</b></td><td>Nilai akhir</td><td class="big">' + r1(e.nilai) + '</td></tr>'
        + '<tr><td>NIK / NIP</td><td>' + H_(s.nik || '–') + '</td><td>Predikat · kategori</td><td><b>' + H_(e.c ? e.c.h + ' · ' + e.c.label : '–') + '</b></td></tr>'
        + '<tr><td>Grade yang dituju</td><td>' + H_(s.grade_target || s.level || '–') + (s.grade_saat_ini ? ' (saat ini ' + H_(s.grade_saat_ini) + ')' : '') + '</td><td>Hasil</td><td class="' + (/^Lulus/.test(e.hasil) ? 'ok' : 'no') + '">' + H_(e.hasil) + '</td></tr>'
        + '<tr><td>Jenis penilaian</td><td>' + H_(s.jenis) + '</td><td>Batas lulus</td><td>' + g.gPass + '</td></tr>'
        + '<tr><td>Jobsite</td><td>' + H_(s.jobsite || '–') + '</td><td>Tanggal selesai</td><td>' + fmtD(e.t) + '</td></tr></table>'
        + '<h2>Rekomendasi</h2><b>' + H_(rek || '–') + '</b>' + (s.keputusan ? ' <span class="mut">(keputusan diisi manual)</span>' : '')
        + '<h2>Nilai per sheet tes</h2><table><tr><th>Sheet soal</th><th>Grade sheet</th><th class="n">Benar</th><th class="n">Nilai</th><th>Selesai</th></tr>'
        + (s.module_ids || []).map(id => { const m = mods.find(y => y.id === id) || {}, x = a.find(y => y.module_id === id);
            return '<tr><td>' + H_(m.title || '') + '</td><td>' + H_(m.grade || '') + '</td><td class="n">' + (x && x.submitted_at ? x.correct + '/' + x.total : '–') + '</td><td class="n"><b>' + (x && x.submitted_at ? r1(+x.score) : '–') + '</b></td><td>' + (x && x.submitted_at ? fmtD(x.submitted_at) + (x.late ? ' (waktu habis)' : '') : 'Belum') + '</td></tr>'; }).join('') + '</table>'
        + '<h2>Penguasaan per topik</h2><table><tr><th>Topik</th><th class="n">Benar / soal</th><th class="n">%</th></tr>' + tl.map(t => '<tr><td>' + H_(t[0]) + '</td><td class="n">' + t[2][0] + ' / ' + t[2][1] + '</td><td class="n">' + Math.round(t[1]) + '%</td></tr>').join('') + '</table>'
        + '<table style="margin-top:8px"><tr><th style="width:50%">Kekuatan (≥ 80%)</th><th>Perlu ditingkatkan (&lt; 60%)</th></tr><tr><td>' + (tl.filter(t => t[1] >= 80).map(t => H_(t[0])).join('<br>') || '–') + '</td><td>' + (tl.filter(t => t[1] < 60).map(t => H_(t[0])).join('<br>') || '–') + '</td></tr></table>';
      done.forEach(x => { const r = ans.find(y => y.a === x.id), m = mods.find(y => y.id === x.module_id) || {}; if (!r || !r.q) return;
        const q = r.q, rows = []; for (let i = 0; i < q.length; i += 10) rows.push(q.slice(i, i + 10));
        h += '<h2>Rangkuman jawaban – ' + H_(m.title || '') + '</h2><div class="mut">Hijau = benar · merah = salah · abu-abu = tidak dijawab. Format: nomor, jawaban peserta / kunci.</div><table class="g">'
          + rows.map(rw => '<tr>' + rw.map(v => '<td class="' + (v[4] ? 'b' : v[3] ? 's' : 'k') + '"><b>' + v[0] + '</b><br>' + (v[3] || '–') + ' / ' + v[2] + '</td>').join('') + '</tr>').join('') + '</table>'; });
      h += '<h2>Pengawasan</h2>Pelanggaran: <b>' + viol + '</b>' + (evs.length ? ' (' + H_(evs.join(', ')) + ')' : '') + ' · Foto kamera tersimpan: <b>' + nfoto + '</b> (di folder tes ini)'
        + sign_() + '</body></html>';
      const tf = sub_(person, testName_(s.created_at, s.jenis, s.grade_target || s.level, sid));
      const pf = savePdf_(tf, 'Hasil Tes ' + safe_(s.nama) + ' ' + Utilities.formatDate(new Date(s.created_at), TZ, 'yyyy-MM-dd') + '.pdf', h);
      DRV.sessions.push({ id: s.id, drive: { pdf: pf.getId(), folder: tf.getId(), person: person.getId() } }); DRV.files.push(pf);
    } else {
      const k = e.k, dd = k.data || {}, r = e.r, kid = left8_(k.id); keepK[kid] = 1;
      const row = (lbl, v) => '<tr><td>' + H_(lbl) + '</td><td class="c">' + (v === '' || v == null ? '–' : H_(v)) + '</td></tr>';
      let h = head_('Penilaian Kinerja Karyawan – Plant') + '<table class="kv" style="margin-top:8px"><tr><td>Nama</td><td><b>' + H_(k.nama) + '</b></td><td>Jabatan</td><td>' + H_(k.jabatan || '–') + '</td></tr>'
        + '<tr><td>NIK</td><td>' + H_(k.nik || '–') + '</td><td>Grade</td><td>' + H_(k.grade || '–') + '</td></tr><tr><td>Jobsite</td><td>' + H_(k.jobsite || '–') + '</td><td>Status karyawan</td><td>' + H_(k.status_karyawan || '–') + '</td></tr>'
        + '<tr><td>Periode</td><td>' + H_(k.periode || '–') + '</td><td>Penilai</td><td>' + H_(k.penilai || '–') + '</td></tr></table>'
        + '<h2>Ringkasan nilai</h2><table><tr><th>Bab</th><th class="n">Bobot</th><th class="n">Nilai</th></tr>'
        + [['Kepribadian', 30, r.pK], ['Target Kinerja', 35, r.pT], ['Indisipliner', 15, r.pI], ['Kehadiran', 15, r.pH], ['Tugas Tambahan (opsional)', 5, r.pX]].map(x => '<tr><td>' + x[0] + '</td><td class="n">' + x[1] + '%</td><td class="n">' + r1(x[2]) + '</td></tr>').join('')
        + '<tr><th>Skor kinerja</th><th></th><th class="n">' + r1(r.skor) + (e.c ? ' · ' + H_(e.c.h + ' ' + e.c.label) : '') + '</th></tr></table>'
        + '<p><b>Keputusan:</b> ' + H_(e.kep || '–') + '</p>'
        + '<h2>A. Kepribadian (nilai 1–4)</h2><table>' + KB_K.map((t, j) => row(t, (dd.K || [])[j])).join('') + '</table>'
        + '<h2>B. Target Kinerja (nilai 1–4)</h2><table>' + KB_T.map((t, j) => row(t, (dd.T || [])[j])).join('') + '</table>'
        + '<h2>C. Indisipliner (jumlah)</h2><table>' + KB_I.map(x => row(x[1], +(dd.I || {})[x[0]] || 0)).join('') + '</table>'
        + '<h2>D. Kehadiran (total periode, ' + Math.max(1, +(dd.H || {}).bulan || 3) + ' bulan)</h2><table>' + KB_H.map(x => row(x[1], +(dd.H || {})[x[0]] || 0)).join('') + '</table>'
        + ((dd.X || []).filter(x => x && x.t).length ? '<h2>E. Tugas Tambahan</h2><table>' + dd.X.filter(x => x && x.t).map(x => row(x.t, x.v)).join('') + '</table>' : '')
        + '<h2>Catatan atasan</h2><table><tr><th style="width:33%">Kelebihan</th><th style="width:33%">Perlu ditingkatkan</th><th>Catatan</th></tr><tr><td>' + H_(dd.kelebihan || '–') + '</td><td>' + H_(dd.kekurangan || '–') + '</td><td>' + H_(dd.catatan || '–') + '</td></tr></table>'
        + sign_() + '</body></html>';
      const kf = savePdf_(person, 'Penilaian Kinerja ' + safe_(k.nama) + ' ' + Utilities.formatDate(new Date(k.created_at), TZ, 'yyyy-MM-dd') + ' - ' + kid + '.pdf', h);
      DRV.kinerja.push({ id: k.id, drive: { pdf: kf.getId(), person: person.getId() } }); DRV.files.push(kf);
    }
  });
  const fi = person.getFiles(); while (fi.hasNext()) { const f = fi.next(), m = f.getName().match(/^Penilaian Kinerja .* - ([0-9a-f]{8})\.pdf$/); if (m && !keepK[m[1]]) f.setTrashed(true); }
}

/* ---------- laporkan ID Drive ke web + bagikan PDF per berkas ke Editor ---------- */
function driveReport_(d) {
  const sec = props_().getProperty('SYNC_SECRET'), done = {};
  DRV.sessions.forEach(x => done[x.id] = 1);
  (d.sessions || []).forEach(s => { if (!done[s.id] && DRV.person[s.id]) DRV.sessions.push({ id: s.id, drive: { person: DRV.person[s.id] } }); });
  rpc_('pk_drive_report', { p_secret: sec, p: { sessions: DRV.sessions, kinerja: DRV.kinerja } });
  let refs = null; try { refs = rpc_('pk_drive_refs', { p_secret: sec }); } catch (e) {}
  if (refs) shareFiles_(DRV.files, (refs.editors || []).map(String));
}
/* tiap PDF dibagikan ke email Editor sebagai Pelihat (tanpa email pemberitahuan, unduh/cetak dimatikan bila Drive API aktif);
   email yang sudah bukan Editor dicabut. Folder tidak pernah dibagikan. */
function shareFiles_(files, editors) {
  const want = {}; editors.forEach(e => { if (/@/.test(e)) want[e.toLowerCase()] = 1; });
  const me = (Session.getEffectiveUser().getEmail() || '').toLowerCase();
  let budget = 120;
  files.forEach(f => {
    if (budget <= 0) return;
    let have = {}; try { f.getViewers().forEach(u => have[(u.getEmail() || '').toLowerCase()] = 1); } catch (e) { return; }
    Object.keys(want).forEach(e => { if (have[e] || e === me || budget <= 0) return; budget--;
      try { if (typeof Drive !== 'undefined' && Drive.Permissions) { Drive.Permissions.create({ role: 'reader', type: 'user', emailAddress: e }, f.getId(), { sendNotificationEmail: false }); }
            else f.addViewer(e); } catch (err) { Logger.log('Bagikan ' + f.getName() + ' ke ' + e + ': ' + err); } });
    Object.keys(have).forEach(e => { if (!want[e] && e && e !== me) { try { f.removeViewer(e); } catch (err) {} } });
    try { if (typeof Drive !== 'undefined' && Drive.Files && Object.keys(want).length) Drive.Files.update({ copyRequiresWriterPermission: true }, f.getId()); } catch (e) {}
  });
}
/* ---------- gambar soal: pindahkan dari database ke Drive (sedikit demi sedikit, tiap sinkron) ---------- */
function moveImages_(maxMs) {
  const t0 = Date.now(), sec = props_().getProperty('SYNC_SECRET'), base = sub_(root_(), 'Gambar Soal'); let moved = 0;
  while (Date.now() - t0 < maxMs) {
    const list = rpc_('pk_drive_images', { p_secret: sec, p_limit: 15 }) || []; if (!list.length) break;
    const rep = [];
    list.forEach(x => { if (Date.now() - t0 > maxMs + 60000) return;
      const m = String(x.image).match(/^data:(image\/[\w+.-]+);base64,(.+)$/); if (!m) return;
      const ext = /png/.test(m[1]) ? 'png' : /gif/.test(m[1]) ? 'gif' : /webp/.test(m[1]) ? 'webp' : 'jpg';
      const dir = sub_(base, safe_((x.grade ? x.grade + ' ' : '') + x.title));
      const f = dir.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], 'Soal ' + String(x.no).padStart(3, '0') + ' - ' + String(x.id).slice(0, 8) + '.' + ext));
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      rep.push({ id: x.id, file: f.getId() }); });
    if (!rep.length) break;
    rpc_('pk_drive_report', { p_secret: sec, p: { questions: rep } }); moved += rep.length;
  }
  if (Date.now() - t0 < maxMs) {   // semua sudah pindah: buang gambar yang soalnya sudah dihapus
    const refs = rpc_('pk_drive_refs', { p_secret: sec }); const keep = {}; (refs.images || []).forEach(id => keep[id] = 1);
    if ((refs.images || []).length || moved === 0) { const fi = base.getFolders(); while (fi.hasNext()) { const dir = fi.next(), it = dir.getFiles(); let any = false;
      while (it.hasNext()) { const f = it.next(); if (!keep[f.getId()]) f.setTrashed(true); else any = true; } if (!any) dir.setTrashed(true); } }
  }
  return moved;
}

function write_(ss, name, head, rows) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#EDE7FB');
  if (rows.length) sh.getRange(2, 1, rows.length, head.length).setValues(rows.map(r => head.map((_, i) => r[i] === undefined || r[i] === null ? '' : r[i])));
  sh.setFrozenRows(1);
}
