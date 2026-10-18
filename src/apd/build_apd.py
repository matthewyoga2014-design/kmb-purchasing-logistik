import os, base64
os.chdir('/tmp/claude-0/-home-claude/7aa149d3-ce04-5175-8931-d81787106bc5/scratchpad/build')
exec(open('build5.py').read().split("data = json.load(open('data.json'))")[0])
css2 = css + open('web.css').read() + open('../apd/apd.css').read()
A = '../apd/'
js = open(A + 'ga.js').read() + '\n' + open(A + 'apd.js').read()
assert '</script' not in js.lower()
ICON = "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 64 64%27%3E%3Crect width=%2764%27 height=%2764%27 rx=%2716%27 fill=%27%236D28D9%27/%3E%3Ctext x=%2732%27 y=%2740%27 font-family=%27Arial%27 font-weight=%27700%27 font-size=%2734%27 fill=%27white%27 text-anchor=%27middle%27%3EM%3C/text%3E%3C/svg%3E"
shell = '''<aside class="side" id="side" aria-label="Menu">
  <div class="brand"><span class="lg">M</span><div><b>Monitoring</b><span>APD KMB</span></div></div>
  <nav class="nav" id="nav"></nav>
  <div class="side-foot"><b>Monitoring APD</b>KMB · Permintaan, Stok &amp; Gudang APD</div>
</aside>
<div class="scrim" id="scrim" hidden></div>
<div class="main">
  <header class="top">
    <button class="ibtn" id="menuBtn" type="button" aria-label="Buka menu"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
    <a class="btn btn-g backbtn" href="../" title="Kembali ke halaman utama Monitoring"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Kembali</span></a>
    <div class="ttl">Monitoring APD KMB</div>
    <span class="pill" id="roleTag">Pelihat</span>
    <button class="btn btn-g" id="authBtn" type="button">Masuk</button>
    <button class="btn btn-p" id="syncBtn" type="button"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 11a8 8 0 00-14.7-4.4M4 4v4h4M4 13a8 8 0 0014.7 4.4M20 20v-4h-4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>Sinkronkan</button>
  </header>
  <main class="content" id="view"></main>
</div>
<div class="modal" id="modal" hidden><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="mTitle" id="dialog"></div></div>
<div id="toast" role="status" aria-live="polite" hidden></div>
<div id="wm" aria-hidden="true"></div>
<div id="shield" hidden><div><b>Tampilan disembunyikan</b><span>Screenshot dan rekam layar tidak diizinkan untuk Pelihat. Klik di sini untuk melanjutkan.</span></div></div>
<div id="nopr"><b>Monitoring APD</b><br>Cetak tidak diizinkan. Minta izin cetak ke Pemilik melalui tombol Print di web.</div>'''
page = ('<!doctype html><html lang="id"><head><meta charset="utf-8">'
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  '<title>Monitoring APD KMB</title><meta name="description" content="Monitoring APD KMB: stok gudang, pembagian, penggantian, dan pengembalian helm, kaos, sepatu safety.">'
  '<meta name="theme-color" content="#6D28D9">'
  f'<link rel="icon" href="{ICON}">'
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">'
  '<style>:root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>'
  '<style id="css">' + css2 + '</style><style>.backbtn{display:inline-flex;align-items:center;gap:6px;text-decoration:none;flex-shrink:0}@media (max-width:560px){.backbtn span{display:none}.backbtn{padding-left:10px;padding-right:10px}}@media print{.backbtn{display:none!important}}</style></head><body>\n' + shell + '\n'
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" defer></script>\n'
  '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>\n'
  '<script>' + js + '</script>\n</body></html>')
out = '../web/monitoring-apd-kmb'
os.makedirs(out, exist_ok=True)
open(out + '/index.html', 'w').write(page)
for s in ['helm.svg', 'kaos.svg', 'sepatu.svg']:
    open(out + '/' + s, 'wb').write(open(A + s, 'rb').read())
print('apd', len(page))
