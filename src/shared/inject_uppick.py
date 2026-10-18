"""Sisipkan uppick.js ke halaman yang belum punya panel upload sendiri. Aman dijalankan berulang (idempotent).
Jalankan setelah build ulang APD / setelah mengganti file Unit atau Notulensi: python3 src/shared/inject_uppick.py"""
import pathlib, re
ROOT = pathlib.Path(__file__).resolve().parents[2]
JS = (pathlib.Path(__file__).parent / 'uppick.js').read_text()
TARGETS = ['monitoring-apd-kmb/index.html', 'monitoring-unit/index.html', 'notulensi/index.html']
for t in TARGETS:
    p = ROOT / t; s = p.read_text()
    block = f'<!--uppick--><script>{JS}</script><!--/uppick-->'
    s = re.sub(r'<!--uppick-->.*?<!--/uppick-->', '', s, flags=re.S)
    i = s.rfind('</body>'); s = s[:i] + block + s[i:] if i >= 0 else s + block
    p.write_text(s); print('ok', t)
