'use strict';
// Menyalin file web Monitoring (folder induk repo) ke desktop/web dan pustaka
// pihak ketiga ke desktop/offline/vendor sebelum aplikasi dibuat.
const fs = require('fs');
const path = require('path');

const DESK = path.join(__dirname, '..');
const REPO = path.join(DESK, '..');
const WEB = path.join(DESK, 'web');
const VENDOR = path.join(DESK, 'offline', 'vendor');

const SKIP_DIRS = new Set(['.git', '.github', 'desktop', 'src', 'supabase', 'node_modules', 'kantor-ai', 'apps-script']);
const SKIP_EXT = new Set(['.md', '.py', '.gs', '.sql', '.sh']);

fs.rmSync(WEB, { recursive: true, force: true });
let n = 0;
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) copyDir(s, d); }
    else if (!SKIP_EXT.has(path.extname(e.name).toLowerCase())) { fs.copyFileSync(s, d); n++; }
  }
}
copyDir(REPO, WEB);
console.log(`web: ${n} file disalin`);

const LIBS = {
  'xlsx.full.min.js': 'xlsx/dist/xlsx.full.min.js',
  'jszip.min.js': 'jszip/dist/jszip.min.js',
  'jspdf.umd.min.js': 'jspdf/dist/jspdf.umd.min.js',
  'pdf.min.js': 'pdfjs-dist/build/pdf.min.js',
  'pdf.worker.min.js': 'pdfjs-dist/build/pdf.worker.min.js',
  'html2canvas.min.js': 'html2canvas/dist/html2canvas.min.js',
  'html-to-image.js': 'html-to-image/dist/html-to-image.js',
  'mammoth.browser.min.js': 'mammoth/mammoth.browser.min.js',
};
fs.mkdirSync(VENDOR, { recursive: true });
const missing = [];
for (const [name, rel] of Object.entries(LIBS)) {
  let src;
  try { src = require.resolve(rel, { paths: [DESK] }); } catch (e) { missing.push(rel); continue; }
  fs.copyFileSync(src, path.join(VENDOR, name));
}
if (missing.length) {
  console.error('Pustaka belum terpasang: ' + missing.join(', ') + '\nJalankan "npm ci" di folder desktop.');
  if (!process.env.ALLOW_MISSING_VENDOR) process.exit(1);
}
console.log('vendor: ' + fs.readdirSync(VENDOR).join(', '));
