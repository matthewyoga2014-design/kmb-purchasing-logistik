"""Sisipkan uppick.js dan permx.js ke halaman yang belum punya panel upload sendiri. Aman dijalankan berulang (idempotent).
Jalankan setelah build ulang APD / setelah mengganti file Unit atau Notulensi: python3 src/shared/inject_uppick.py"""
import pathlib, re
ROOT = pathlib.Path(__file__).resolve().parents[2]
JS = (pathlib.Path(__file__).parent / 'uppick.js').read_text()
PX = (pathlib.Path(__file__).parent / 'permx.js').read_text()
def put(t, tag, js):
    p = ROOT / t; s = p.read_text()
    block = f'<!--{tag}--><script>{js}</script><!--/{tag}-->'
    s = re.sub(rf'<!--{tag}-->.*?<!--/{tag}-->', '', s, flags=re.S)
    i = s.rfind('</body>'); s = s[:i] + block + s[i:] if i >= 0 else s + block
    p.write_text(s); print('ok', tag, t)
for t in ['monitoring-apd-kmb/index.html', 'monitoring-unit/index.html', 'notulensi/index.html']: put(t, 'uppick', JS)
# izin Lihat / Ubah / Unduh per menu + tombol Excel terpisah (web MPP & APD)
for t in ['manpower-kta-tra/index.html', 'manpower-bupr/index.html', 'manpower-mbj/index.html', 'manpower-kmb/index.html', 'monitoring-apd-kmb/index.html']: put(t, 'permx', PX)
