'use strict';
/*
 * Monitoring — aplikasi Windows offline.
 * Menjalankan web Monitoring dari dalam aplikasi; semua data disimpan di
 * Documents\Monitoring pada laptop ini, tanpa internet.
 */
const { app, BrowserWindow, protocol, session, ipcMain, shell, dialog, Menu, Notification } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store, LOCAL_EMAIL, LOCAL_UID } = require('./core/store');
const { serve, vendorFor } = require('./core/serve');
const { writeBackup } = require('./core/backup');
const { ONLINE_HOME, fetchOnlineScript } = require('./core/online-import');

const ORIGIN = 'app://monitoring';
const HOME = ORIGIN + '/index.html';
const SMOKE = process.env.MONITORING_SMOKE || '';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } },
]);

if (!SMOKE && !app.requestSingleInstanceLock()) { app.quit(); }

// ---------- folder data ----------
const ROOT = SMOKE ? fs.mkdtempSync(path.join(os.tmpdir(), 'monitoring-smoke-')) : path.join(app.getPath('documents'), 'Monitoring');
const DIRS = {
  root: ROOT,
  data: path.join(ROOT, 'data'),
  files: path.join(ROOT, 'Berkas'),
  excel: path.join(ROOT, 'Excel'),
  downloads: path.join(ROOT, 'Unduhan'),
  backupExcel: path.join(ROOT, 'Backup Excel'),
  backupData: path.join(ROOT, 'Backup Data'),
};
for (const d of Object.values(DIRS)) fs.mkdirSync(d, { recursive: true });
const README = path.join(ROOT, 'BACA SAYA.txt');
if (!fs.existsSync(README)) {
  fs.writeFileSync(README, [
    'Folder data aplikasi Monitoring (offline)',
    '',
    'Excel          : file Excel yang Anda unduh dari tombol "Unduh Excel" di aplikasi.',
    'Backup Excel   : backup otomatis semua data dalam bentuk Excel (satu file per hari).',
    'Backup Data    : cadangan lengkap (.json) untuk dipulihkan lewat menu Monitoring > Impor Data.',
    'Berkas         : lampiran yang diunggah (dokumen pelamar, berkas & foto notulensi).',
    'Unduhan        : unduhan lain (PDF, Word, gambar).',
    'data           : database aplikasi. Jangan diubah manual.',
    '',
  ].join('\r\n'));
}

let backupDirty = false;
const store = new Store({ dataDir: DIRS.data, filesDir: DIRS.files, onChange: () => { backupDirty = true; } });

const webRoot = path.join(__dirname, 'web');
const offlineDir = path.join(__dirname, 'offline');

// ---------- backup otomatis ----------
let backupRunning = null;
async function runBackup(reason) {
  if (backupRunning) return backupRunning;
  backupDirty = false;
  backupRunning = writeBackup(store, ROOT)
    .catch((e) => { console.error('Backup gagal:', e); backupDirty = true; return null; })
    .finally(() => { backupRunning = null; });
  return backupRunning;
}
function todayBackupExists() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return fs.existsSync(path.join(DIRS.backupExcel, `Monitoring-Backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.xlsx`));
}

// ---------- jendela ----------
let mainWin = null;
const ICON = path.join(__dirname, 'build', 'icon.png');
function webPrefs() {
  return { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false };
}
function isLocal(url) { return url.startsWith(ORIGIN + '/') || url === ORIGIN; }

function hardenContents(wc) {
  wc.setWindowOpenHandler(({ url }) => {
    if (isLocal(url) || url.startsWith('blob:') || url === 'about:blank' || url.startsWith('data:')) {
      return { action: 'allow', overrideBrowserWindowOptions: { width: 1200, height: 820, icon: ICON, autoHideMenuBar: true, webPreferences: webPrefs() } };
    }
    if (/^(https?:|mailto:|tel:|whatsapp:)/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => {
    if (isLocal(url) || url.startsWith('blob:') || url.startsWith('data:')) return;
    e.preventDefault();
    if (/^(https?:|mailto:|tel:)/i.test(url)) shell.openExternal(url);
  });
}

function createWindow() {
  mainWin = new BrowserWindow({
    width: 1400, height: 880, minWidth: 900, minHeight: 600, title: 'Monitoring', icon: ICON, show: false,
    backgroundColor: '#f5f3ff', webPreferences: webPrefs(),
  });
  mainWin.once('ready-to-show', () => mainWin.show());
  mainWin.loadURL(HOME);
  mainWin.on('page-title-updated', (e, t) => { e.preventDefault(); mainWin.setTitle(t && t !== 'Monitoring' ? `${t} — Monitoring` : 'Monitoring'); });
}

function toast(wc, msg) {
  try { wc.executeJavaScript(`window.MonitoringOfflineToast && window.MonitoringOfflineToast(${JSON.stringify(msg)})`).catch(() => {}); } catch (e) {}
}
function uniquePath(dir, name) {
  const safe = String(name || 'unduhan').replace(/[\\/:*?"<>|]+/g, '-');
  const ext = path.extname(safe), base = safe.slice(0, safe.length - ext.length);
  let p = path.join(dir, safe);
  for (let i = 2; fs.existsSync(p); i++) p = path.join(dir, `${base} (${i})${ext}`);
  return p;
}

// ---------- menu ----------
function buildMenu() {
  const focused = () => BrowserWindow.getFocusedWindow() || mainWin;
  const template = [
    {
      label: 'Monitoring',
      submenu: [
        { label: 'Beranda', accelerator: 'CmdOrCtrl+H', click: () => focused() && focused().loadURL(HOME) },
        { type: 'separator' },
        { label: 'Buka Folder Monitoring', click: () => shell.openPath(ROOT) },
        { label: 'Buka Folder Excel', click: () => shell.openPath(DIRS.excel) },
        { label: 'Buka Folder Backup Excel', click: () => shell.openPath(DIRS.backupExcel) },
        { type: 'separator' },
        {
          label: 'Backup Sekarang', accelerator: 'CmdOrCtrl+B', click: async () => {
            const f = await runBackup('manual');
            if (f) { const r = await dialog.showMessageBox(focused(), { type: 'info', title: 'Backup selesai', message: 'Backup Excel tersimpan.', detail: f, buttons: ['Tutup', 'Buka Folder'] }); if (r.response === 1) shell.showItemInFolder(f); }
            else dialog.showErrorBox('Backup gagal', 'Backup tidak bisa ditulis. Pastikan file backup tidak sedang dibuka di Excel lalu coba lagi.');
          },
        },
        { label: 'Ekspor Data (Cadangan Lengkap)…', click: exportData },
        { label: 'Impor Data dari File Cadangan…', click: importData },
        { label: 'Ambil Data dari Monitoring Online…', click: openOnlineImport },
        { type: 'separator' },
        { label: 'Keluar', accelerator: 'Alt+F4', role: 'quit' },
      ],
    },
    {
      label: 'Tampilan',
      submenu: [
        { label: 'Kembali', accelerator: 'Alt+Left', click: () => { const w = focused(); if (w && w.webContents.navigationHistory.canGoBack()) w.webContents.navigationHistory.goBack(); } },
        { label: 'Maju', accelerator: 'Alt+Right', click: () => { const w = focused(); if (w && w.webContents.navigationHistory.canGoForward()) w.webContents.navigationHistory.goForward(); } },
        { label: 'Muat Ulang', accelerator: 'F5', role: 'reload' },
        { label: 'Muat Ulang', accelerator: 'CmdOrCtrl+R', role: 'reload', visible: false },
        { type: 'separator' },
        { label: 'Perbesar', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: 'Perkecil', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Ukuran Normal', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'Layar Penuh', accelerator: 'F11', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Alat Pengembang', accelerator: 'CmdOrCtrl+Shift+I', role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Bantuan',
      submenu: [
        {
          label: 'Tentang Monitoring', click: () => dialog.showMessageBox(focused(), {
            type: 'info', title: 'Tentang Monitoring', message: `Monitoring ${app.getVersion()} — versi offline`,
            detail: `Semua data tersimpan di laptop ini:\n${ROOT}\n\nBackup Excel dibuat otomatis setiap ada perubahan (paling lambat tiap 2 menit) dan saat aplikasi ditutup.`,
          }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- ekspor / impor ----------
async function exportData() {
  const d = new Date().toISOString().slice(0, 10);
  const r = await dialog.showSaveDialog(mainWin, { title: 'Simpan cadangan data Monitoring', defaultPath: path.join(DIRS.backupData, `Monitoring-cadangan-${d}.json`), filters: [{ name: 'Cadangan Monitoring', extensions: ['json'] }] });
  if (r.canceled || !r.filePath) return;
  fs.writeFileSync(r.filePath, JSON.stringify(store.exportAll()));
  shell.showItemInFolder(r.filePath);
}
async function importData() {
  const r = await dialog.showOpenDialog(mainWin, { title: 'Pilih file cadangan Monitoring (.json)', defaultPath: DIRS.backupData, filters: [{ name: 'Cadangan Monitoring', extensions: ['json'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return;
  let obj;
  try { obj = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')); } catch (e) { dialog.showErrorBox('Gagal membaca file', e.message); return; }
  await applyImport(obj, path.basename(r.filePaths[0]));
}
async function applyImport(obj, label) {
  const c = await dialog.showMessageBox(mainWin, {
    type: 'question', title: 'Impor data', message: `Impor data dari ${label}?`,
    detail: 'Ganti semua: data di aplikasi diganti dengan isi file.\nGabungkan: data dari file ditambahkan/menimpa data yang sama.\n\nData sekarang dibackup dulu otomatis ke folder Backup Data.',
    buttons: ['Batal', 'Gabungkan', 'Ganti Semua'], defaultId: 2, cancelId: 0,
  });
  if (c.response === 0) return;
  try {
    const d = new Date();
    fs.writeFileSync(path.join(DIRS.backupData, `sebelum-impor-${d.toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify(store.exportAll()));
    store.importAll(obj, c.response === 1 ? 'merge' : 'replace');
    await runBackup('import');
    for (const w of BrowserWindow.getAllWindows()) if (isLocal(w.webContents.getURL())) w.webContents.reload();
    dialog.showMessageBox(mainWin, { type: 'info', title: 'Impor selesai', message: 'Data berhasil diimpor.' });
  } catch (e) { dialog.showErrorBox('Impor gagal', e.message); }
}

// Satu kali ambil data dari web Monitoring online (butuh internet & login email).
let onlineWin = null;
function openOnlineImport() {
  if (onlineWin) { onlineWin.focus(); return; }
  onlineWin = new BrowserWindow({
    width: 1100, height: 780, parent: mainWin, title: 'Ambil data dari Monitoring online', icon: ICON, autoHideMenuBar: true,
    webPreferences: { partition: 'persist:online', contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  onlineWin.on('closed', () => { onlineWin = null; });
  onlineWin.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  onlineWin.loadURL(ONLINE_HOME);
  dialog.showMessageBox(onlineWin, {
    type: 'info', title: 'Ambil data dari Monitoring online',
    message: 'Masuk dengan email Anda di jendela ini (butuh internet).',
    detail: 'Setelah berhasil masuk, aplikasi akan menawarkan untuk menyalin data yang bisa Anda lihat ke laptop ini. Lampiran berkas (dokumen pelamar, berkas Google Drive) tidak ikut tersalin.',
  });
  let asked = false;
  const timer = setInterval(async () => {
    if (!onlineWin) { clearInterval(timer); return; }
    let email = null;
    try { email = await onlineWin.webContents.executeJavaScript(`(function(){try{var s=JSON.parse(localStorage.getItem('kta-web-auth')||'null');return s&&s.user&&s.user.email||null}catch(e){return null}})()`); } catch (e) {}
    if (!email || asked) return;
    asked = true;
    const c = await dialog.showMessageBox(onlineWin, { type: 'question', title: 'Salin data', message: `Masuk sebagai ${email}.`, detail: 'Salin data Monitoring ke aplikasi offline sekarang?', buttons: ['Nanti', 'Salin Data'], defaultId: 1, cancelId: 0 });
    if (c.response !== 1) { asked = false; return; }
    clearInterval(timer);
    try {
      const out = await onlineWin.webContents.executeJavaScript(fetchOnlineScript(), true);
      if (!out || out.error) throw new Error((out && out.error) || 'Data tidak terbaca');
      const obj = { format: 'monitoring-offline', version: 1, exported_at: new Date().toISOString(), tables: out.tables, notulensi: out.notulensi || undefined };
      const n = Object.values(out.tables).reduce((m, r) => m + r.length, 0);
      fs.writeFileSync(path.join(DIRS.backupData, `dari-online-${new Date().toISOString().slice(0, 10)}.json`), JSON.stringify(obj));
      if (out.notes && out.notes.length) await dialog.showMessageBox(onlineWin, { type: 'warning', title: 'Catatan', message: `${n} baris data terbaca. Beberapa bagian tidak bisa diambil:`, detail: out.notes.join('\n') });
      onlineWin.close();
      await applyImport(obj, 'Monitoring online');
    } catch (e) { dialog.showErrorBox('Gagal mengambil data', e.message); asked = false; }
  }, 2500);
}

// ---------- IPC ----------
function guard(e) {
  const u = (e.senderFrame && e.senderFrame.url) || '';
  if (!isLocal(u)) throw new Error('Akses ditolak');
}
ipcMain.on('mon:info', (e) => { e.returnValue = { email: LOCAL_EMAIL, uid: LOCAL_UID, root: ROOT, version: app.getVersion() }; });
ipcMain.handle('mon:query', (e, q) => { guard(e); return store.query(q); });
ipcMain.handle('mon:rpc', (e, n, a) => { guard(e); return store.rpc(n, a); });
ipcMain.handle('mon:storage', (e, op, a) => { guard(e); return store.storage(op, a); });
ipcMain.handle('mon:gas', (e, kind, body) => { guard(e); return store.gas(kind, body); });
ipcMain.handle('mon:open-folder', (e, which) => { guard(e); return shell.openPath(DIRS[which] || ROOT); });

// ---------- start ----------
app.on('second-instance', () => { if (mainWin) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.focus(); } });

app.whenReady().then(async () => {
  app.setAppUserModelId('id.monitoring.offline');
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    const r = serve({ webRoot, offlineDir, store, origin: ORIGIN }, u.pathname + u.search);
    const headers = { 'Content-Type': r.mime, 'Cache-Control': 'no-store' };
    if (u.searchParams.has('download') && r.file) headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(u.searchParams.get('download') || path.basename(r.file))}`;
    return new Response(r.body, { status: r.status, headers });
  });

  const ses = session.defaultSession;
  // Offline: pustaka CDN diambil dari salinan lokal, permintaan internet lain diblokir.
  ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (d, cb) => {
    const local = vendorFor(d.url);
    if (local) return cb({ redirectURL: ORIGIN + local });
    if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(d.url)) return cb({});
    return cb({ cancel: true });
  });
  ses.on('will-download', (e, item, wc) => {
    const name = item.getFilename();
    const dir = /\.(xlsx|xlsm|xls|csv)$/i.test(name) ? DIRS.excel : DIRS.downloads;
    const target = uniquePath(dir, name);
    item.setSavePath(target);
    item.once('done', (ev, state) => {
      if (state !== 'completed') return;
      const folder = path.basename(dir);
      if (wc && !wc.isDestroyed()) toast(wc, `Tersimpan di Documents\\Monitoring\\${folder}\\${path.basename(target)}`);
      if (Notification.isSupported() && !SMOKE) {
        const n = new Notification({ title: 'File tersimpan', body: `${path.basename(target)}\nKlik untuk membuka folder.`, icon: ICON });
        n.on('click', () => shell.showItemInFolder(target));
        n.show();
      }
    });
  });
  app.on('web-contents-created', (ev, wc) => { if (wc.session === ses) hardenContents(wc); });

  if (SMOKE) return runSmoke();

  buildMenu();
  createWindow();
  if (!todayBackupExists()) setTimeout(() => runBackup('startup'), 8000);
  setInterval(() => { if (backupDirty) runBackup('auto'); }, 2 * 60 * 1000);
});

let quitting = false;
app.on('before-quit', (e) => {
  if (quitting || SMOKE) return;
  e.preventDefault();
  quitting = true;
  store.flush();
  const done = () => app.exit(0);
  const t = setTimeout(done, 15000);
  (backupDirty ? runBackup('quit') : Promise.resolve()).finally(() => { clearTimeout(t); done(); });
});
app.on('window-all-closed', () => app.quit());

// ---------- uji otomatis (dipakai di GitHub Actions) ----------
async function runSmoke() {
  const pages = ['/index.html', '/manpower-portal/', '/manpower-kta-tra/', '/manpower-kmb/', '/manpower-mbj/', '/manpower-bupr/', '/monitoring-apd-kmb/', '/monitoring-unit/', '/notulensi/', '/kantor-ai/'];
  fs.mkdirSync(SMOKE, { recursive: true });
  const report = [];
  const win = new BrowserWindow({ width: 1366, height: 820, show: false, webPreferences: webPrefs() });
  for (const p of pages) {
    const errs = [];
    const onMsg = (ev, ...args) => {
      const d = args[0] && typeof args[0] === 'object' && 'level' in args[0] ? args[0] : { level: args[0], message: args[1] };
      const lvl = typeof d.level === 'string' ? d.level : ['verbose', 'info', 'warning', 'error'][d.level];
      if (lvl === 'error') errs.push(String(d.message).slice(0, 300));
    };
    win.webContents.on('console-message', onMsg);
    try { await win.loadURL(ORIGIN + p); } catch (e) { errs.push('load: ' + e.message); }
    await new Promise((r) => setTimeout(r, 4000));
    const text = await win.webContents.executeJavaScript('document.body ? document.body.innerText.slice(0,300).replace(/\\s+/g," ") : ""').catch((e) => 'ERR ' + e.message);
    const offline = await win.webContents.executeJavaScript('!!window.__MONITORING_OFFLINE__ && !!(window.supabase && window.supabase.__offline)').catch(() => false);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SMOKE, (p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home') + '.png'), img.toPNG());
    win.webContents.off('console-message', onMsg);
    report.push({ page: p, offline, errors: errs, text });
  }
  // Uji simpan: tulis data lewat halaman, lalu pastikan tersimpan di file.
  await win.loadURL(ORIGIN + '/kantor-ai/');
  const saved = await win.webContents.executeJavaScript(`(async()=>{const sb=window.supabase.createClient('x','y');
    const r=await sb.from('kta_web_state').upsert({id:'mbj',data:{positions:[],aktif:[{nama:'Uji',jabatan:'Operator'}],keluar:[],units:[]},updated_at:new Date().toISOString(),updated_by:'smoke'}).select('updated_at').single();
    const x=await sb.rpc('kta_web_read',{p_ids:['mbj']});return {err:r.error,n:x.data[0].data.aktif.length};})()`);
  store.flush();
  const backup = await runBackup('smoke');
  // Uji unduhan: file Excel harus masuk ke folder Excel tanpa dialog.
  const dl = await new Promise((resolve) => {
    const t = setTimeout(() => resolve('timeout'), 10000);
    session.defaultSession.once('will-download', (e, item) => item.once('done', (ev, st) => { clearTimeout(t); resolve(st + ':' + item.getSavePath()); }));
    win.webContents.executeJavaScript(`(()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['a,b'],{type:'text/csv'}));a.download='uji.xlsx';document.body.appendChild(a);a.click();})()`);
  });
  const result = { root: ROOT, report, saved, backup, download: dl, vendor: fs.readdirSync(path.join(offlineDir, 'vendor')) };
  fs.writeFileSync(path.join(SMOKE, 'report.json'), JSON.stringify(result, null, 1));
  console.log('SMOKE-REPORT ' + JSON.stringify(result));
  app.exit(0);
}
