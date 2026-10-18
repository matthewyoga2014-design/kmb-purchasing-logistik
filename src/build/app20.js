
// ================= Pelihat guard: no print/export without Pemilik approval, screenshot deterrence =================
let PRINT_OK = false;            // set true by the web adapter when the Pemilik approved this viewer
let GUARD_WHO = '';              // email shown in the watermark (web adapter fills it after login)
const LOCK_SEL = '#printBtn,[data-oexp],#xlsxBtn,#bkBtn,#csvPel';
const guardFree = () => (typeof DL_OK === 'function' ? DL_OK() : (CAN_EDIT || PRINT_OK));
document.body.insertAdjacentHTML('beforeend', `<div id="wm" aria-hidden="true"></div>
<div id="shield" hidden><div><b>Tampilan disembunyikan</b><span>Screenshot dan rekam layar tidak diizinkan untuk Pelihat. Klik di sini untuk melanjutkan.</span></div></div>
<div id="nopr"><b>Monitoring Manpower</b><br>Cetak tidak diizinkan. Minta izin cetak ke Pemilik melalui tombol Print di web.</div>`);

function wmPaint() {
  const el = document.getElementById('wm'); if (!el) return;
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  const stamp = `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  const who = GUARD_WHO || 'Pelihat · tanpa login';
  const t = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="220"><g transform="rotate(-22 190 110)" font-family="Plus Jakarta Sans,Segoe UI,sans-serif" text-anchor="middle" fill="#1E1B3A" fill-opacity=".085"><text x="190" y="100" font-size="17" font-weight="800">MONITORING MANPOWER · RAHASIA</text><text x="190" y="126" font-size="13" font-weight="600">${t(who)} · ${stamp}</text></g></svg>`;
  el.style.backgroundImage = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}
function guardSync() {
  const lock = !guardFree();
  document.body.classList.toggle('nop', lock);
  if (!lock) shieldOff();
  wmPaint();
  document.querySelectorAll(LOCK_SEL).forEach((b) => { b.classList.toggle('lk', lock); if (lock) b.title = 'Perlu izin Pemilik untuk mencetak / mengunduh'; });
}
setInterval(() => { if (document.body.classList.contains('nop')) wmPaint(); }, 30000);
const _render20 = render;
render = function () { _render20.apply(this, arguments); guardSync(); };

function shieldOn() { if (!guardFree()) document.getElementById('shield').hidden = false; }
function shieldOff() { const s = document.getElementById('shield'); if (s) s.hidden = true; }
window.addEventListener('blur', shieldOn);
document.addEventListener('visibilitychange', () => { if (document.hidden) shieldOn(); });
window.addEventListener('focus', () => setTimeout(shieldOff, 250));
document.getElementById('shield').addEventListener('pointerdown', shieldOff);

function askPrint() {
  if (typeof PRINT_ASK === 'function') { PRINT_ASK(); return; }
  openForm({ eyebrow: 'Izin cetak', title: 'Cetak & unduh perlu izin Pemilik', values: {}, fields: [], submit: 'Mengerti',
    intro: 'Sebagai Pelihat, Anda hanya bisa melihat. Untuk mencetak, menyimpan PDF/PNG, atau mengunduh Excel, minta izin ke Pemilik.', onSave: () => true });
}
document.addEventListener('click', (e) => {
  if (guardFree()) return;
  if (e.target.closest && e.target.closest(LOCK_SEL)) { e.preventDefault(); e.stopImmediatePropagation(); askPrint(); }
}, true);
document.addEventListener('keydown', (e) => {
  if (guardFree()) return;
  const k = (e.key || '').toLowerCase();
  if ((e.ctrlKey || e.metaKey) && (k === 'p' || k === 's')) { e.preventDefault(); e.stopImmediatePropagation(); askPrint(); return; }
  if ((e.ctrlKey || e.metaKey) && (k === 'c' || k === 'x') && !e.target.closest('input,textarea')) { e.preventDefault(); return; }
  if (k === 'meta' || k === 'os' || k === 'printscreen' || (e.shiftKey && e.metaKey)) shieldOn();
}, true);
document.addEventListener('keyup', (e) => {
  if (guardFree() || (e.key || '').toLowerCase() !== 'printscreen') return;
  shieldOn();
  try { navigator.clipboard && navigator.clipboard.writeText('Screenshot Monitoring Manpower tidak diizinkan.'); } catch (er) {}
  toast('Screenshot tidak diizinkan untuk Pelihat.', true);
}, true);
['contextmenu', 'copy', 'cut', 'dragstart', 'selectstart'].forEach((ev) => document.addEventListener(ev, (e) => {
  if (guardFree() || (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]'))) return;
  e.preventDefault();
}, true));
window.addEventListener('beforeprint', () => { if (!guardFree()) document.body.classList.add('nop'); });
guardSync();
