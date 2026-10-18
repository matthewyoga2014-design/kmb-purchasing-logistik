import json, os, sys, re
exec(open('build5.py').read().split("data = json.load(open('data.json'))")[0])  # -> css, app
P = '/tmp/claude-0/-home-claude/7aa149d3-ce04-5175-8931-d81787106bc5/scratchpad/portal/'
k = app.index('// ---------- boot ----------')
base_app = app[:k] + open('web.js').read() + app[k:]
for a, b in [('Berkas hanya bisa dibuka oleh akun pemilik saat membuka halaman di claude.ai.', 'Berkas hanya bisa dibuka oleh Pemilik/Editor yang sudah masuk.'),
             ('Upload tersedia untuk pemilik di claude.ai', 'Masuk sebagai Editor untuk upload')]:
    assert a in base_app, a
    base_app = base_app.replace(a, b)
css2 = css + open('web.css').read()
body = open('shell5.html').read()

PROJECTS = {
 'kta-tra': dict(art='kta', folder='manpower-kta-tra', sp='KTA - TRA', dash='KTA-TRA', title='Monitoring Manpower KTA - TRA',
   cfg="{ id: 'main', app: 'kta-tra', title: 'Monitoring Manpower KTA - TRA', sites: null }", seed='live'),
 'bupr': dict(art='bupr', folder='manpower-bupr', sp='BUPR Ampah', dash='BUPR', title='Monitoring Manpower BUPR Ampah',
   cfg="{ id: 'bupr', app: 'bupr-ampah', title: 'Monitoring Manpower BUPR Ampah', cfg: { mpp: /^MPP/i, mppLabel: 'MPP BUPR' }, sites: null }", seed=['bupr']),
 'mbj': dict(art='mbj', folder='manpower-mbj', sp='MBJ', dash='MBJ', title='Monitoring Manpower MBJ',
   cfg="{ id: 'mbj', app: 'mbj', title: 'Monitoring Manpower MBJ', cfg: { mpp: /^MBJ$/i, mppLabel: 'MBJ' }, sites: null }", seed=['mbj']),
 'kmb': dict(art='kmb', folder='manpower-kmb', sp='KMB', dash='KMB', title='Monitoring Manpower KMB',
   cfg="""{ id: 'kmb-c4', app: 'kmb', title: 'Monitoring Manpower KMB', sites: [
  { id: 'kmb-c4', name: 'C4', cfg: { mpp: /^C4$/i, mppLabel: 'C4', site: /^C4/i, unitBlock: /^C4$/i, autoSection: true } },
  { id: 'kmb-slr-maintenance', name: 'SLR - Maintenance', cfg: { mpp: /^SLR - MAINTENANCE$/i, mppLabel: 'SLR - MAINTENANCE', site: /maintenance/i, unitBlock: /^SLR - MAINTENANCE$/i, autoSection: true } },
  { id: 'kmb-slr-rekondisi', name: 'SLR - Rekondisi', cfg: { mpp: /^SLR - REKONDISI$/i, mppLabel: 'SLR - REKONDISI', site: /rekondisi/i, unitBlock: /^SLR - REKONDISI$/i, autoSection: true } },
  { id: 'kmb-workshop', name: 'Workshop Legok', cfg: { mpp: /^WS$/i, mppLabel: 'WS', site: /workshop|legok/i, unitBlock: /^WORKSHOP/i, autoSection: true } } ] }""",
   seed=['kmb-c4', 'kmb-slr-maintenance', 'kmb-slr-rekondisi', 'kmb-workshop']),
}
ICON = "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 64 64%27%3E%3Crect width=%2764%27 height=%2764%27 rx=%2716%27 fill=%27%236D28D9%27/%3E%3Ctext x=%2732%27 y=%2740%27 font-family=%27Arial%27 font-weight=%27700%27 font-size=%2734%27 fill=%27white%27 text-anchor=%27middle%27%3EM%3C/text%3E%3C/svg%3E"

def build(key):
    pj = PROJECTS[key]
    a = base_app
    if key != 'kta-tra':
        a = a.replace('KTA - TRA', pj['sp']).replace('KTA-TRA', pj['dash'])
    if pj['seed'] == 'live':
        data = json.load(open('live_state.json'))
        for p in data['positions']:
            for c in p.get('cands') or []:
                if c.get('files'): c['files'] = {}
        data['meta'] = {**data.get('meta', {}), 'source': 'Dipindahkan dari web Claude'}
        seeds = {}
    else:
        seeds = {i: json.load(open(P + 'seed-' + i + '.json')) for i in pj['seed']}
        data = seeds[pj['seed'][0]]
    EMPTY = {'positions': [], 'aktif': [], 'keluar': [], 'units': [], 'meta': {}}
    data = EMPTY  # data proyek tidak ditanam di halaman publik; dimuat dari server sesuai hak akses
    seeds = {i: EMPTY for i in seeds}
    state = json.dumps(data, ensure_ascii=False).replace('<', '\\u003c')
    sh = body if key == 'kta-tra' else body.replace('KTA - TRA', pj['sp'])
    ART = json.load(open('../art/art.json'))
    pre = 'var PARSE_CFG;\nconst PROJ_CFG = ' + pj['cfg'] + ';\nPROJ_CFG.short = ' + json.dumps(pj['sp']) + ';\nconst PROJ_ART = ' + json.dumps(ART[pj['art']]) + ';\n'
    if len(seeds) > 1: pre += 'window.SITE_SEEDS = ' + json.dumps(seeds, ensure_ascii=False).replace('<', '\\u003c') + ';\n'
    full = pre + sh + a
    assert '</script' not in full.lower()
    page = ('<!doctype html><html lang="id"><head><meta charset="utf-8">'
     '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
     f'<title>{pj["title"]}</title><meta name="description" content="Monitoring MPP, actual, vacant, pelamar dan progress rekrutmen {pj["sp"]}.">'
     '<meta name="theme-color" content="#6D28D9">'
     f'<link rel="icon" href="{ICON}">'
     '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
     '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">'
     '<style>:root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>'
     '<style id="css">' + css2 + '</style></head><body>\n'
     '<script type="application/json" id="state">' + state + '</script>\n'
     '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" defer></script>\n'
     '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n'
     '<script id="app">' + full + '</script>\n</body></html>')
    out = '../web/' + pj['folder']
    os.makedirs(out, exist_ok=True)
    open(out + '/index.html', 'w').write(page)
    print(key, len(page))
for k in (sys.argv[1:] or PROJECTS): build(k)
