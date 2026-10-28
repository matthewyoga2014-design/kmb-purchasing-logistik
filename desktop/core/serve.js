'use strict';
/*
 * Menyajikan file web Monitoring dari folder lokal dan menyesuaikannya untuk
 * mode offline: email Pemilik diganti akun lokal, alamat GitHub Pages diganti
 * alamat aplikasi, pustaka CDN diganti salinan lokal, dan pengganti Supabase
 * disisipkan paling awal di setiap halaman.
 */
const fs = require('fs');
const path = require('path');
const { LOCAL_EMAIL, mimeOf } = require('./store');

const OWNER_EMAIL = 'matthewyoga2014@gmail.com';
const SITE_BASES = [
  'https://matthewyoga2014-design.github.io/kmb-purchasing-logistik/',
  'https://matthewyoga2014-design.github.io/kmb-purchasing-logistik',
];

// Pustaka dari CDN -> salinan lokal di /__offline/vendor/
const VENDOR = [
  [/https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^"'`\s)]*/g, '/__offline/noop.js'],
  [/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx\/[\d.]+\/xlsx\.full\.min\.js/g, '/__offline/vendor/xlsx.full.min.js'],
  [/https:\/\/cdn\.jsdelivr\.net\/npm\/xlsx@[\d.]+\/dist\/xlsx\.full\.min\.js/g, '/__offline/vendor/xlsx.full.min.js'],
  [/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/jszip\/[\d.]+\/jszip\.min\.js/g, '/__offline/vendor/jszip.min.js'],
  [/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf\/[\d.]+\/jspdf\.umd\.min\.js/g, '/__offline/vendor/jspdf.umd.min.js'],
  [/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js\/[\d.]+\/pdf\.worker\.min\.js/g, '/__offline/vendor/pdf.worker.min.js'],
  [/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js\/[\d.]+\/pdf\.min\.js/g, '/__offline/vendor/pdf.min.js'],
  [/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/html2canvas\/[\d.]+\/html2canvas\.min\.js/g, '/__offline/vendor/html2canvas.min.js'],
  [/https:\/\/cdn\.jsdelivr\.net\/npm\/html-to-image@[\d.]+\/dist\/html-to-image\.js/g, '/__offline/vendor/html-to-image.js'],
  [/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/mammoth\/[\d.]+\/mammoth\.browser\.min\.js/g, '/__offline/vendor/mammoth.browser.min.js'],
  [/https:\/\/cdn\.jsdelivr\.net\/npm\/mammoth@[\d.]+\/mammoth\.browser\.min\.js/g, '/__offline/vendor/mammoth.browser.min.js'],
];

function vendorFor(url) {
  for (const [re, local] of VENDOR) {
    re.lastIndex = 0;
    if (re.test(url)) { re.lastIndex = 0; return local; }
  }
  return null;
}

function rewrite(text, origin) {
  let s = text.split(OWNER_EMAIL).join(LOCAL_EMAIL);
  s = s.split(SITE_BASES[0]).join(origin + '/');
  s = s.split(SITE_BASES[1]).join(origin);
  for (const [re, local] of VENDOR) s = s.replace(re, local);
  return s;
}

const SHIM_TAG = '<script src="/__offline/supabase-shim.js"></script>';
function injectShim(html) {
  const m = html.match(/<head[^>]*>/i);
  if (m) return html.replace(m[0], m[0] + SHIM_TAG);
  return SHIM_TAG + html;
}

const OFFLINE_PAGE = (title, msg) => `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;background:#f5f3ff;color:#1e1b4b;display:grid;place-items:center;min-height:100vh}
.c{background:#fff;border-radius:18px;padding:28px 30px;max-width:460px;box-shadow:0 10px 30px rgba(76,29,149,.12)}h1{margin:0 0 8px;font-size:20px;color:#6D28D9}a{display:inline-block;margin-top:14px;background:#6D28D9;color:#fff;padding:9px 16px;border-radius:10px;text-decoration:none;font-weight:600}</style></head>
<body><div class="c"><h1>${title}</h1><p>${msg}</p><a href="/index.html">Kembali ke Beranda</a></div></body></html>`;

/**
 * @returns {{status:number, mime:string, body:Buffer|string, file?:string}}
 */
function serve(opts, urlPath) {
  const { webRoot, offlineDir, store, origin } = opts;
  let p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  if (p.startsWith('/__offline/')) {
    const file = path.resolve(offlineDir, p.slice('/__offline/'.length));
    if (!file.startsWith(path.resolve(offlineDir)) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      if (p.startsWith('/__offline/vendor/')) return { status: 200, mime: 'text/javascript; charset=utf-8', body: 'console.warn("Pustaka offline belum tersedia: ' + path.basename(p) + '");' };
      return { status: 404, mime: 'text/plain', body: 'Tidak ditemukan' };
    }
    return { status: 200, mime: mimeOf(file), body: fs.readFileSync(file), file };
  }
  if (p.startsWith('/__files/')) {
    const rest = p.slice('/__files/'.length);
    const i = rest.indexOf('/');
    const file = i > 0 ? store.readStorageFile(rest.slice(0, i), rest.slice(i + 1)) : null;
    if (!file) return { status: 404, mime: 'text/plain', body: 'Berkas tidak ditemukan' };
    return { status: 200, mime: mimeOf(file), body: fs.readFileSync(file), file };
  }
  if (p.startsWith('/kantor-ai')) {
    return { status: 200, mime: 'text/html; charset=utf-8', body: injectShim(OFFLINE_PAGE('Kantor AI butuh internet', 'Kantor AI memakai layanan online, jadi tidak tersedia di aplikasi Monitoring offline. Modul MPP, APD, Unit, dan Notulensi tetap bisa dipakai tanpa internet.')) };
  }
  if (p === '' || p === '/') p = '/index.html';
  let file = path.resolve(webRoot, '.' + p);
  const root = path.resolve(webRoot);
  if (file !== root && !file.startsWith(root + path.sep)) return { status: 403, mime: 'text/plain', body: 'Dilarang' };
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    if (/\.html?$/.test(file) || !path.extname(file)) return { status: 404, mime: 'text/html; charset=utf-8', body: OFFLINE_PAGE('Halaman tidak ada', 'Halaman ini tidak tersedia di aplikasi offline.') };
    return { status: 404, mime: 'text/plain', body: 'Tidak ditemukan' };
  }
  const mime = mimeOf(file);
  const ext = path.extname(file).toLowerCase();
  if (ext === '.html' || ext === '.htm') {
    let html = rewrite(fs.readFileSync(file, 'utf8'), origin);
    // Kantor Monitoring (AI) butuh internet: sembunyikan kartunya di beranda offline.
    html = html.replace(/(key:\s*'kantor'[^}]*?show:\s*\(\)\s*=>\s*)isOwner\(\)/, '$1false');
    return { status: 200, mime, body: injectShim(html), file };
  }
  if (ext === '.js' || ext === '.css' || ext === '.webmanifest') {
    return { status: 200, mime, body: rewrite(fs.readFileSync(file, 'utf8'), origin), file };
  }
  return { status: 200, mime, body: fs.readFileSync(file), file };
}

module.exports = { serve, rewrite, vendorFor, OWNER_EMAIL };
