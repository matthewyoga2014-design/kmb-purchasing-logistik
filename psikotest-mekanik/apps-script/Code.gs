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
    const people = people_(d, g, mods, att);
    write_(ss, 'Riwayat Karyawan', ['Nama', 'NIK', 'Grade Terakhir', 'Jumlah Tes', 'Nilai Tes Pertama', 'Tanggal Tes Pertama', 'Nilai Tes Terakhir', 'Tanggal Tes Terakhir', 'Perubahan', 'Hasil Terakhir', 'Skor Kinerja Terakhir', 'Keputusan Kinerja Terakhir', 'Folder Karyawan'],
      people.map(p => [p.nama, p.nik, p.grade, p.T.length, p.T.length ? r1(p.T[0].nilai) : '', p.T.length ? p.T[0].t : '', p.T.length > 1 ? r1(p.T[p.T.length - 1].nilai) : '', p.T.length > 1 ? p.T[p.T.length - 1].t : '',
        p.T.length > 1 ? r1(p.T[p.T.length - 1].nilai - p.T[0].nilai) : '', p.lastHasil, p.lastK ? r1(p.lastK.nilai) : '', p.lastK ? p.lastK.kep : '', p.url || '']));
    const keep = ['Hasil Tes', 'Rincian', 'Penilaian Kinerja', 'Riwayat Karyawan'];
    ss.getSheets().forEach(sh => { if (keep.indexOf(sh.getName()) < 0 && ss.getSheets().length > 1) ss.deleteSheet(sh); });
  } finally { lock.releaseLock(); }
}

/* ---------- satu folder per karyawan: rekap tes + penilaian kinerja, foto per tes ---------- */
function people_(d, g, mods, att) {
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

function write_(ss, name, head, rows) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#EDE7FB');
  if (rows.length) sh.getRange(2, 1, rows.length, head.length).setValues(rows.map(r => head.map((_, i) => r[i] === undefined || r[i] === null ? '' : r[i])));
  sh.setFrozenRows(1);
}
