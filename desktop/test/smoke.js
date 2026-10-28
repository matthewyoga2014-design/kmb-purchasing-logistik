'use strict';
// Uji cepat: buka setiap halaman Monitoring offline, catat error, simpan screenshot.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { start } = require('./server');

const PAGES = ['/index.html', '/manpower-portal/', '/manpower-kta-tra/', '/manpower-kmb/', '/manpower-mbj/', '/manpower-bupr/', '/monitoring-apd-kmb/', '/monitoring-unit/', '/notulensi/', '/kantor-ai/'];

(async () => {
  const dataDir = process.argv[2] || '/tmp/monitoring-smoke';
  const outDir = process.argv[3] || '/tmp/monitoring-shots';
  const importFile = process.argv[4];
  fs.mkdirSync(outDir, { recursive: true });
  const { srv, store, port } = await start({ dataDir, webRoot: path.join(__dirname, '..', '..') });
  if (importFile) store.importAll(JSON.parse(fs.readFileSync(importFile, 'utf8')));
  const base = 'http://127.0.0.1:' + port;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  const external = new Set();
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    external.add(new URL(u).host);
    return route.abort();
  });
  const report = [];
  for (const p of (process.env.PAGES ? process.env.PAGES.split(',') : PAGES)) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)); });
    try {
      await page.goto(base + p, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(Number(process.env.WAIT || 3500));
    } catch (e) { errs.push('goto: ' + e.message); }
    const name = p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home';
    await page.screenshot({ path: path.join(outDir, name + '.png') }).catch(() => {});
    const text = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 400).replace(/\s+/g, ' ') : '').catch(() => '');
    report.push({ page: p, errors: errs, text });
    await page.close();
  }
  console.log(JSON.stringify({ report, externalBlocked: [...external] }, null, 1));
  await browser.close();
  store.flush();
  srv.close();
})();
