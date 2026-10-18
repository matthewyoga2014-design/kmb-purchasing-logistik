import re, os
R = '/home/claude/kmb-purchasing-logistik/'
H = os.path.dirname(os.path.abspath(__file__)) + '/'
src = open(R + 'manpower-portal/index.html').read()
style = src[src.index('<style>') + 7:src.index('</style>')]
scene = re.search(r'\.scene \{[^}]*?url\("([^"]+)"\)', style, re.S).group(1)
art = re.search(r"const ART = \{(.*?)\};", src, re.S).group(1)
deco = src[src.index('<body>') + 6:src.index('<header class="top">')]
js = open(H + 'hub2.js').read().replace("// ART diisi saat build (gambar header kartu dari portal lama)", "const ART = {" + art + ", apd: 'portal-apd.svg', unit: 'portal-excavator.svg', notulensi: 'portal-drill.svg' };")
assert '</script' not in js.lower()
ICON = "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 64 64%27%3E%3Crect width=%2764%27 height=%2764%27 rx=%2716%27 fill=%27%236D28D9%27/%3E%3Ctext x=%2732%27 y=%2740%27 font-family=%27Arial%27 font-weight=%27700%27 font-size=%2734%27 fill=%27white%27 text-anchor=%27middle%27%3EM%3C/text%3E%3C/svg%3E"
GEAR = re.search(r'(<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3".*?</svg>)', src, re.S).group(1)
PRINT = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
body = f'''{deco}<header class="top">
  <span class="lg">M</span><div class="bn"><b>Monitoring</b></div>
  <div class="hbtns"><button type="button" class="hb sa" id="saBtn" title="Bagikan link ke semua web sekaligus" hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 11 21 3l-8 18-2-8z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg><span>Bagikan</span></button><button type="button" class="hb" id="prBtn" title="Print halaman" hidden>{PRINT}<span>Print</span></button><button type="button" class="hb" id="setBtn" title="Pengaturan: akses, bagikan link & izin" hidden>{GEAR}<span>Pengaturan</span><i class="dot" hidden></i></button></div>
  <div class="who" id="who"><button type="button" id="whoBtn" aria-haspopup="menu" aria-expanded="false"><span class="av"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/><path d="M4 20c1.2-3.6 4.2-5.5 8-5.5s6.8 1.9 8 5.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span><span class="wt"><small id="whoL">Belum masuk</small><b id="whoE">Masuk</b></span><svg class="wt" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <div class="menu" id="menu" role="menu" hidden></div></div>
</header>
<main>
  <section class="hero"><h1 class="vh">Monitoring</h1></section>
  <section id="page" hidden></section>
  <div id="note"></div>
  <div class="tot" id="tot"></div>
  <div class="grid" id="grid"></div>
</main>
<div class="modal" id="modal" hidden><div class="dlg hx" role="dialog" aria-modal="true" aria-labelledby="mTitle" id="dialog"></div></div>
<div id="toast" role="status" aria-live="polite" hidden></div>'''
page = ('<!doctype html><html lang="id"><head><meta charset="utf-8">'
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  '<title>Monitoring</title><meta name="description" content="Satu pintu Monitoring MPP dan APD: masuk, pilih site, bagikan link Editor/Pelihat.">'
  '<meta name="theme-color" content="#6D28D9"><link rel="manifest" href="./manifest.webmanifest">'
  f'<link rel="icon" href="{ICON}">'
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">'
  '<style>' + style + open(H + 'hub2.css').read().replace('{{SCENE}}', scene) + '</style></head><body>\n' + body + '\n'
  '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>\n'
  '<script>' + js + '</script>\n</body></html>')
os.makedirs(H + '../web/hub2', exist_ok=True)
open(H + '../web/hub2/index.html', 'w').write(page)
import shutil; shutil.copy(H + 'monitoring-hero.jpg', H + '../web/hub2/monitoring-hero.jpg')
print('hub2', len(page))
