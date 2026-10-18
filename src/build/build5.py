import re, json
t = open('template4.html').read()
css = t[t.index('<style>')+7 : t.index('</style>')]
# light only: drop dark blocks
css = re.sub(r'@media \(prefers-color-scheme: dark\) \{ :root:not\(\[data-theme="light"\]\) \{.*?\} \}\n', '', css, flags=re.S)
css = re.sub(r':root\[data-theme="dark"\] \{.*?\n\}\n', '', css, flags=re.S)
assert 'color-scheme: dark' not in css
css = css.replace('--side-w: 248px; --r: 14px;\n}', '--side-w: 248px; --r: 14px; color-scheme: light;\n}')
css += open('extra5.css').read() + open('extra6.css').read() + open('extra10.css').read() + open('org.css').read() + open('guard.css').read() + open('print.css').read()
script = t[t.index('<script>\n')+9 : t.index('// ---------- render ----------')]
script = script.replace('const BUNDLED = /*__DATA__*/;', "let STATE = JSON.parse(document.getElementById('state').textContent);\nconst BUNDLED = STATE;")
script = script.replace("let DATA = BUNDLED, SRC = BUNDLED_SRC, SRC_MSG = null;", "let DATA = STATE, SRC = BUNDLED_SRC, SRC_MSG = null;")
script = re.sub(r"try \{ const s = JSON.parse\(store.get\('mp4-data'\).*?\n", "", script)
script = script.replace("store.get('mp4-page')", "(sessionStorage.getItem('mp5-page') || store.get('mp5-page'))")
parser = open('parser.js').read().replace("if (typeof module !== 'undefined') module.exports = { parseSheets };\n", '')
script = script.replace('/*__PARSER__*/', parser)
a5 = open('app5.js').read(); k = a5.index('// ---------- boot ----------')
app = script + a5[:k] + open('app6.js').read() + open('app7.js').read() + open('app8.js').read() + open('app9.js').read() + open('app10.js').read() + open('app11.js').read() + open('app12.js').read() + open('app13.js').read() + open('app14.js').read() + open('app15.js').read() + open('app16.js').read() + open('app17.js').read() + open('app18.js').read() + open('app19.js').read() + open('app20.js').read() + open('app21.js').read() + open('app22.js').read() + open('app23.js').read() + a5[k:]
assert '</script' not in app.lower(), 'script close in app'
data = json.load(open('data.json'))
data['meta'] = {'updated': '2026-10-15', 'source': 'Sinkron dari Monitoring_Manpower_KTA_-_TRA.xlsx'}
import os
if os.path.exists('live_state.json'):
    data = json.load(open('live_state.json'))
state = json.dumps(data, ensure_ascii=False).replace('<', '\\u003c')
body = open('shell5.html').read()
page = ('<title>Monitoring Manpower KTA-TRA</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
 '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
 '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">\n'
 '<style id="css">' + css + '</style>\n'
 '<script type="application/json" id="state">' + state + '</script>\n'
 '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" defer></script>\n'
 '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js" defer></script>\n'
 '<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" defer></script>\n'
 '<script id="app">' + body + app + '</script>')
open('../monitoring-manpower.html','w').write(page)
open('../preview.html','w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}body{margin:0}</style></head><body>'+page+'</body></html>')
print(len(page))
