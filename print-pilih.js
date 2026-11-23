/* Pilihan Print untuk semua portal Monitoring:
   "Print sheet ini" (menu yang sedang dibuka) atau "Print keseluruhan" (semua menu, tiap menu mulai halaman baru).
   Tiap web memanggil PrintPilih.attach({...}) dengan cara menampilkan menunya sendiri. */
(function () {
  if (window.PrintPilih) return;
  const CSS = `
.pp-bg{position:fixed;inset:0;z-index:2147483000;background:rgba(20,20,26,.45);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit}
.pp-box{width:min(540px,100%);background:#fff;color:#1F1F24;border-radius:20px;padding:24px;display:flex;flex-direction:column;gap:14px;box-shadow:0 24px 60px rgba(0,0,0,.25)}
.pp-eb{font-size:12px;font-weight:700;color:#A32626;letter-spacing:.04em}
.pp-box h2{margin:2px 0 0;font-size:20px;line-height:1.3}
.pp-op{all:unset;box-sizing:border-box;cursor:pointer;display:flex;gap:14px;align-items:center;border:1px solid #D8D8DE;background:#fff;border-radius:14px;padding:14px 16px;min-height:44px}
.pp-op:hover,.pp-op:focus-visible{border-color:#D93B3B;background:#FFF5F5;outline:none}
.pp-op:focus-visible{box-shadow:0 0 0 3px rgba(217,59,59,.25)}
.pp-ic{width:42px;height:42px;border-radius:12px;background:#FDE8E8;color:#A32626;display:flex;align-items:center;justify-content:center;flex:none}
.pp-op.pp-1 .pp-ic{background:#D93B3B;color:#fff}
.pp-tx{display:flex;flex-direction:column;gap:2px;min-width:0}
.pp-tx b{font-size:15px}.pp-tx span{font-size:13px;color:#5A5A66;line-height:1.45}
.pp-ft{display:flex;justify-content:flex-end}
.pp-x{all:unset;box-sizing:border-box;cursor:pointer;height:42px;padding:0 18px;border-radius:12px;border:1px solid #D8D8DE;font-weight:600;font-size:14px;display:inline-flex;align-items:center}
.pp-x:hover{background:#F4F4F6}
.pp-wait{position:fixed;inset:0;z-index:2147483001;background:rgba(255,255,255,.92);display:flex;flex-direction:column;gap:10px;align-items:center;justify-content:center;font:600 15px/1.4 inherit;color:#1F1F24}
.pp-wait i{width:34px;height:34px;border-radius:50%;border:3px solid #FDE8E8;border-top-color:#D93B3B;animation:pp-sp .8s linear infinite}
@keyframes pp-sp{to{transform:rotate(360deg)}}
.pp-sec~.pp-sec{break-before:page;page-break-before:always}
@media print{.pp-bg,.pp-wait{display:none!important}}`;
  const st = document.createElement('style'); st.id = 'pp-css'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const IC1 = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6M9 15h6"/></svg>';
  const IC2 = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h9l3 3v12H8z"/><path d="M4 7v14h12"/></svg>';

  function ask(o) {
    return new Promise((res) => {
      const bg = document.createElement('div'); bg.className = 'pp-bg';
      bg.innerHTML = `<div class="pp-box" role="dialog" aria-modal="true" aria-label="Pilih yang dicetak">
        <div><div class="pp-eb">PRINT</div><h2>Apa yang mau dicetak?</h2></div>
        <button type="button" class="pp-op pp-1" data-pp="sheet"><span class="pp-ic">${IC1}</span><span class="pp-tx"><b>Print sheet ini</b><span>Hanya menu yang sedang dibuka${o.current ? ': ' + esc(o.current) : ''}</span></span></button>
        <button type="button" class="pp-op" data-pp="all"><span class="pp-ic">${IC2}</span><span class="pp-tx"><b>Print keseluruhan</b><span>Semua menu dicetak berurutan, tiap menu mulai di halaman baru${o.list && o.list.length ? ': ' + esc(o.list.join(', ')) : ''}</span></span></button>
        <div class="pp-ft"><button type="button" class="pp-x" data-pp="">Batal</button></div></div>`;
      const done = (v) => { document.removeEventListener('keydown', key, true); bg.remove(); res(v); };
      const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(''); } };
      bg.addEventListener('click', (e) => { const b = e.target.closest('[data-pp]'); if (b) done(b.dataset.pp); else if (e.target === bg) done(''); });
      document.addEventListener('keydown', key, true);
      document.body.appendChild(bg);
      setTimeout(() => { const f = bg.querySelector('[data-pp="sheet"]'); if (f) f.focus(); }, 0);
    });
  }
  function busy(on) {
    let w = document.getElementById('pp-wait');
    if (!on) { if (w) w.remove(); return; }
    if (!w) { w = document.createElement('div'); w.id = 'pp-wait'; w.className = 'pp-wait'; w.innerHTML = '<i></i><span>Menyiapkan print keseluruhan…</span>'; document.body.appendChild(w); }
  }
  async function imgs(el) {
    const list = [...el.querySelectorAll('img')].filter((i) => !i.complete);
    await Promise.race([Promise.all(list.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))), wait(4000)]);
  }
  // Cetak lalu jalankan "after" sekali saja (window.print kadang menahan, kadang tidak).
  function printThen(after, doPrint) {
    let ran = false;
    const fin = () => { if (ran) return; ran = true; window.removeEventListener('afterprint', fin); try { after(); } catch (e) { console.error(e); } };
    window.addEventListener('afterprint', fin);
    return Promise.resolve().then(() => (doPrint ? doPrint() : window.print())).then(() => setTimeout(fin, 400), () => setTimeout(fin, 400));
  }

  const PP = { busy: false };
  /* Web satu halaman (#view diganti per menu): kumpulkan isi tiap menu ke #view, cetak, lalu kembalikan. */
  PP.collect = async function (c) {
    const view = typeof c.view === 'string' ? document.querySelector(c.view) : c.view;
    if (!view || PP.busy) return;
    PP.busy = true; busy(true);
    const parts = [];
    try {
      for (const p of c.pages()) {
        await p.show();
        await wait(c.delay || 250);
        await imgs(view);
        parts.push(`<section class="pp-sec">${view.innerHTML}</section>`);
        if (p.after) await p.after();
      }
      if (c.beforePrint) c.beforePrint();
      view.innerHTML = parts.join('');
      await wait(150);
    } catch (e) { console.error(e); }
    busy(false);
    await printThen(() => { PP.busy = false; c.restore(); }, c.print);
  };
  /* Web dengan panel tab yang sudah ada di halaman: tampilkan semua panel bersamaan. */
  PP.panels = async function (c) {
    if (PP.busy) return;
    PP.busy = true;
    const els = c.panels().filter(Boolean);
    try { if (c.prepare) await c.prepare(); } catch (e) { console.error(e); }
    const prev = els.map((el) => el.hidden);
    els.forEach((el) => { el.hidden = false; el.classList.add('pp-sec'); });
    document.body.classList.add('pp-all');
    await wait(150);
    await printThen(() => {
      els.forEach((el, i) => { el.hidden = prev[i]; el.classList.remove('pp-sec'); });
      document.body.classList.remove('pp-all');
      PP.busy = false;
      try { c.restore(); } catch (e) { console.error(e); }
    });
  };
  /* Pasang pilihan pada tombol Print. opsi: btn (selector), allowed(), current(), list(), all() */
  PP.attach = function (c) {
    document.addEventListener('click', async (e) => {
      if (PP.bypass) return;
      const b = e.target.closest && e.target.closest(c.btn);
      if (!b || b.disabled) return;
      if (c.allowed && !c.allowed()) return;          // biarkan pesan izin bawaan web yang muncul
      if (c.skip && c.skip()) return;                  // tampilan ini sudah punya pilihan sendiri
      e.preventDefault(); e.stopImmediatePropagation();
      const v = await ask({ current: c.current ? c.current() : '', list: c.list ? c.list() : [] });
      if (v === 'sheet') {
        const nb = document.querySelector(c.btn) || b;
        PP.bypass = true; try { nb.click(); } finally { PP.bypass = false; }
      } else if (v === 'all') { try { await c.all(); } catch (er) { console.error(er); busy(false); PP.busy = false; } }
    }, true);
  };
  PP.ask = ask;
  window.PrintPilih = PP;
})();
