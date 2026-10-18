/* Panel upload "Sisipkan file" (sama seperti sub portal KTA - TRA) untuk SEMUA input file di halaman.
   Setiap kali sebuah input file dibuka (klik tombol upload, label, atau input.click() dari kode),
   yang muncul adalah panel: tombol Jelajah + area "atau tarik file ke sini". */
(function () {
  if (window.__upkInstalled) return; window.__upkInstalled = true;
  const CSS = `#upPick{position:fixed;inset:0;z-index:100000;background:rgba(18,16,40,.45);display:grid;place-items:center;padding:16px;font-family:inherit}
#upPick[hidden]{display:none!important}
#upPick .upk{background:#EEF2FB;border-radius:18px;width:min(560px,100%);box-shadow:0 24px 60px rgba(18,16,40,.3);overflow:hidden}
#upPick .upk-h{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:18px 20px 12px;background:#fff;border-bottom:1px solid #E3E6F0}
#upPick .upk-h small{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6D28D9}#upPick .upk-h h3{margin:2px 0 0;font-size:20px;color:#1E1B3A;line-height:1.25}
#upPick .upk-x{border:0;background:#F3F2FA;width:38px;height:38px;border-radius:50%;font-size:22px;cursor:pointer;color:#4B4868;flex-shrink:0}
#upPick .upk-i{display:flex;gap:10px;align-items:flex-start;margin:14px 16px 0;background:#fff;border-radius:14px;padding:12px 14px;font-size:13.5px;color:#3F3D56;line-height:1.45}
#upPick .upk-i svg{flex-shrink:0;color:#6D28D9}
#upPick .upk-z{margin:14px 16px 18px;border:2.5px dashed #9AA3B8;border-radius:18px;padding:26px 16px 22px;display:grid;justify-items:center;gap:12px;text-align:center;cursor:pointer;transition:background .15s,border-color .15s}
#upPick .upk-z.on{background:#E6F7EC;border-color:#16A34A}
#upPick .upk-z p{margin:0;font-size:14px;color:#1E1B3A}
#upPick .upk-b{border:0;background:#1A56DB;color:#fff;border-radius:999px;padding:12px 34px;font-weight:700;font-size:15px;line-height:1;font-family:inherit;cursor:pointer;box-shadow:0 6px 16px rgba(26,86,219,.3)}
#upPick .upk-b:focus-visible,#upPick .upk-x:focus-visible{outline:3px solid #6D28D9;outline-offset:2px}
.upk-w{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;border:2px dashed #C9CEDD;border-radius:12px;padding:10px 12px;background:#FAFAFE;cursor:pointer;transition:background .15s,border-color .15s;font-family:inherit}
.upk-w.drag{background:#EFE9FE;border-color:#6D28D9;border-style:solid}
.upk-w .upk-wb{display:inline-flex;align-items:center;gap:6px;border:1px solid #D9D6EC;background:#fff;color:#3B2A7A;border-radius:10px;padding:7px 12px;font:700 13px/1 inherit;font-family:inherit;cursor:pointer}
.upk-w small{color:#6B6889;font-size:12px;pointer-events:none}.upk-w .upk-wf{flex-basis:100%;font-size:12.5px;color:#15803D;font-weight:600;word-break:break-all}.upk-w .upk-wf:empty{display:none}
@media (max-width:560px){#upPick{place-items:end center;padding:0}#upPick .upk{border-radius:20px 20px 0 0}}`;
  const nativeClick = HTMLInputElement.prototype.click;
  const isFile = (i) => i && i.tagName === 'INPUT' && (i.type || '').toLowerCase() === 'file';
  const skip = (i) => i.webkitdirectory || i.hasAttribute('webkitdirectory') || i.hasAttribute('data-upfile') || i.dataset.upkNative === '1';
  let lastBtn = null, lastAt = 0;
  document.addEventListener('pointerdown', (e) => { lastBtn = e.target.closest && e.target.closest('button,a,label,[role=button],.upw,[data-upimg]'); lastAt = Date.now(); }, true);
  function label(i) {
    const t = i.getAttribute('data-upk-title') || i.getAttribute('aria-label') || i.title; if (t) return t;
    const lb = i.id && document.querySelector(`label[for="${CSS_esc(i.id)}"]`); const fl = i.closest('.field,.fld,.form-group'); const fll = fl && fl.querySelector('label'); const c = (lb && lb.textContent) || (fll && fll.textContent) || (lastBtn && Date.now() - lastAt < 1500 && lastBtn.textContent) || '';
    const s = c.replace(/\s+/g, ' ').trim(); return s && s.length <= 48 ? s : 'Upload berkas';
  }
  function CSS_esc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : s; }
  function info(i) {
    const a = (i.accept || '').toLowerCase(); const k = [];
    if (/pdf/.test(a)) k.push('PDF');
    if (/image/.test(a) || /\.(jpe?g|png|webp)/.test(a)) k.push(/webp/.test(a) ? 'JPG, PNG, atau WEBP' : 'JPG atau PNG');
    if (/xls|sheet/.test(a)) k.push('Excel (.xlsx)');
    if (/docx|word/.test(a)) k.push('Word (.docx)');
    if (/json/.test(a)) k.push('file cadangan (.json)');
    const jenis = k.length ? k.join(', ') : 'semua jenis file';
    return (i.multiple ? 'Bisa beberapa file sekaligus' : 'Upload 1 file') + ': ' + jenis + '.';
  }
  function okType(f, i) {
    const a = (i.accept || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean); if (!a.length) return true;
    const n = f.name.toLowerCase(), t = (f.type || '').toLowerCase();
    return a.some((x) => x.startsWith('.') ? n.endsWith(x) : x.endsWith('/*') ? t.startsWith(x.slice(0, -1)) : t === x);
  }
  function build() {
    let pk = document.getElementById('upPick'); if (pk) return pk;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    document.body.insertAdjacentHTML('beforeend', `<div id="upPick" role="dialog" aria-modal="true" aria-labelledby="upPkT" hidden><div class="upk">
<div class="upk-h"><div><small>Sisipkan file</small><h3 id="upPkT"></h3></div><button type="button" class="upk-x" data-pkclose aria-label="Tutup">×</button></div>
<div class="upk-i"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span id="upPkI"></span></div>
<div class="upk-z" id="upPkZ"><svg width="150" height="104" viewBox="0 0 150 104" aria-hidden="true"><defs><linearGradient id="upkg2" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#4ADE80"/><stop offset="1" stop-color="#BAE6FD"/></linearGradient></defs><path d="M38 98h80a28 28 0 0 0 3-56 34 34 0 0 0-66-8 28 28 0 0 0-17 64z" fill="url(#upkg2)" stroke="#1E1B3A" stroke-width="1.6"/><path d="M75 82V44M61 57l14-14 14 14" fill="none" stroke="#1E1B3A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
<button type="button" class="upk-b" id="upPkB">Jelajah</button><p>atau tarik file ke sini</p></div></div></div>`);
    pk = document.getElementById('upPick');
    pk.addEventListener('click', (e) => {
      if (e.target === pk || e.target.closest('[data-pkclose]')) close();
      else if (e.target.closest('#upPkB') || e.target.closest('#upPkZ')) { const i = pk._inp; if (i) nativeClick.call(i); }
    });
    const z = document.getElementById('upPkZ');
    ['dragenter', 'dragover'].forEach((ev) => z.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); z.classList.add('on'); }));
    z.addEventListener('dragleave', (e) => { if (!z.contains(e.relatedTarget)) z.classList.remove('on'); });
    z.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation(); z.classList.remove('on'); const i = pk._inp; if (!i) return;
      close(); if (!setFiles(i, [...((e.dataTransfer && e.dataTransfer.files) || [])])) { open(i); document.getElementById('upPkI').textContent = 'Jenis file tidak sesuai. ' + info(i); }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pk.hidden) { e.stopPropagation(); close(); } }, true);
    return pk;
  }
  function open(i) {
    const pk = build();
    if (pk._inp && pk._inp._upkH) pk._inp.removeEventListener('change', pk._inp._upkH);
    pk._inp = i; i._upkH = () => close(); i.addEventListener('change', i._upkH, { once: true });
    document.getElementById('upPkT').textContent = label(i); document.getElementById('upPkI').textContent = info(i);
    pk.hidden = false; setTimeout(() => document.getElementById('upPkB').focus(), 30);
  }
  function setFiles(i, fs) {
    fs = fs.filter((f) => okType(f, i)); if (!fs.length) return false; if (!i.multiple) fs = fs.slice(0, 1);
    const dt = new DataTransfer(); fs.forEach((f) => dt.items.add(f)); i.files = dt.files;
    i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return true;
  }
  // input file yang terlihat (kotak "Choose file") diganti tombol Upload + area seret, seperti KTA - TRA
  const UPI = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 15V4M7 9l5-5 5 5M4 20h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function enhance(root) {
    (root.querySelectorAll ? root.querySelectorAll('input[type=file]') : []).forEach((i) => {
      if (i._upkW || i.hidden || skip(i) || i.closest('#upPick') || getComputedStyle(i).display === 'none') return;
      const w = document.createElement('div'); w.className = 'upk-w'; w.tabIndex = -1;
      w.innerHTML = `<button type="button" class="upk-wb">${UPI}Upload</button><small>atau seret berkas ke sini${i.multiple ? ' · bisa beberapa file' : ''}</small><span class="upk-wf"></span>`;
      i.insertAdjacentElement('afterend', w); i.style.display = 'none'; i._upkW = w;
      const show = () => { w.querySelector('.upk-wf').textContent = [...(i.files || [])].map((f) => '✓ ' + f.name).join('   '); };
      i.addEventListener('change', show);
      w.addEventListener('click', (e) => { e.preventDefault(); open(i); });
      ['dragenter', 'dragover'].forEach((ev) => w.addEventListener(ev, (e) => { e.preventDefault(); w.classList.add('drag'); }));
      w.addEventListener('dragleave', (e) => { if (!w.contains(e.relatedTarget)) w.classList.remove('drag'); });
      w.addEventListener('drop', (e) => { e.preventDefault(); w.classList.remove('drag'); setFiles(i, [...((e.dataTransfer && e.dataTransfer.files) || [])]); });
    });
  }
  const start = () => { enhance(document); new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) enhance(n.matches && n.matches('input') ? n.parentNode : n); }))).observe(document.body, { childList: true, subtree: true }); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  function close() { const pk = document.getElementById('upPick'); if (pk) { pk.hidden = true; } }
  // input.click() dari kode (tombol upload, input yang dibuat dinamis)
  HTMLInputElement.prototype.click = function () { if (isFile(this) && !skip(this) && !this.disabled) { open(this); return; } return nativeClick.call(this); };
  // klik langsung pada input file atau label-nya
  document.addEventListener('click', (e) => {
    if (!e.isTrusted) return; let i = isFile(e.target) ? e.target : null;
    if (!i) { const lb = e.target.closest && e.target.closest('label'); const c = lb && (lb.control || lb.querySelector('input[type=file]')); if (isFile(c)) i = c; }
    if (!i || skip(i) || i.disabled || e.target.closest('#upPick')) return;
    e.preventDefault(); open(i);
  }, true);
})();
