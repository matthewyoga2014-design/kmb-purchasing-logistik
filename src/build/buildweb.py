import re, json, os
exec(open('build5.py').read().split("data = json.load(open('data.json'))")[0])  # css, app
k = app.index('// ---------- boot ----------')
app = app[:k] + open('web.js').read() + app[k:]
reps = [
 ('Berkas hanya bisa dibuka oleh akun pemilik saat membuka halaman di claude.ai.', 'Berkas hanya bisa dibuka oleh Pemilik/Editor yang sudah masuk.'),
 ('Upload tersedia untuk pemilik di claude.ai', 'Masuk sebagai Editor untuk upload'),
]
for a, b in reps:
    assert a in app, a
    app = app.replace(a, b)
assert '</script' not in app.lower()
css2 = css + open('web.css').read()
data = json.load(open('live_state.json'))
removed = []
for p in data['positions']:
    for c in p.get('cands') or []:
        if c.get('files'):
            removed += [(c['name'], f['name']) for f in c['files'].values()]
            c['files'] = {}
data['meta'] = {**data.get('meta', {}), 'source': 'Dipindahkan dari web Claude'}
state = json.dumps(data, ensure_ascii=False).replace('<', '\\u003c')
body = open('shell5.html').read()
page = ('<!doctype html><html lang="id"><head><meta charset="utf-8">'
 '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
 '<title>Monitoring Manpower KTA-TRA</title><meta name="description" content="Monitoring MPP, actual, vacant, pelamar dan progress rekrutmen KTA - TRA.">'
 '<meta name="theme-color" content="#6D28D9">'
 '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 64 64%27%3E%3Crect width=%2764%27 height=%2764%27 rx=%2716%27 fill=%27%236D28D9%27/%3E%3Ctext x=%2732%27 y=%2740%27 font-family=%27Arial%27 font-weight=%27700%27 font-size=%2720%27 fill=%27white%27 text-anchor=%27middle%27%3EKMB%3C/text%3E%3C/svg%3E">'
 '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
 '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">'
 '<style>:root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>'
 '<style id="css">' + css2 + '</style></head><body>\n'
 '<script type="application/json" id="state">' + state + '</script>\n'
 '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" defer></script>\n'
 '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n'
 '<script id="app">' + body + app + '</script>\n</body></html>')
os.makedirs('../web/manpower-kta-tra', exist_ok=True)
open('../web/manpower-kta-tra/index.html', 'w').write(page)
print(len(page), removed)
