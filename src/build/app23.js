
// ================= Keterangan arti status di bawah grafik Progress Kandidat & Rekrutmen =================
const _pipeChart23 = pipeChart;
pipeChart = function (act, off) {
  return _pipeChart23(act, off) + `<div class="pipeinfo">
    <div><div class="pt"><i style="background:var(--primary)"></i>Aktif / Hold</div>
      <p>Pelamar yang <b>masih berjalan</b> di PTK yang Open / Continue: sedang diproses ke tahap berikutnya, atau <b>Hold</b> (ditahan sementara, belum diputuskan lanjut atau tidak). Garis ungu menunjukkan di tahap mana mereka sekarang.</p></div>
    <div><div class="pt"><i style="background:var(--c3)"></i>Tidak aktif</div>
      <p>Pelamar yang <b>sudah berhenti</b> dan tidak dilanjutkan: tidak lolos tes / interview user, tidak ada respon, mundur / kabur, atau menolak offering. Garis merah menunjukkan di tahap mana mereka berhenti.</p></div>
    <div class="ps"><b>Urutan tahap:</b> Sourcing → Psikotes → Interview User → Offering → MCU → FU MCU → On Site → Induksi. Pelamar yang sudah <b>diterima</b> tidak dihitung di grafik ini. Status pelamar diambil otomatis dari kolom <b>Keterangan</b> di MPP.</div></div>`;
};

// tampilkan "interview" di catatan pelamar sebagai "interview user" (data asli tidak diubah)
const _candidates23 = candidates;
candidates = function (p) { return _candidates23(p).map((c) => (c.note && /interview(?!\s*user)/i.test(c.note)) ? { ...c, note: c.note.replace(/interview(?!\s*user)/gi, (m) => m[0] === 'I' ? 'Interview User' : 'interview user') } : c); };

// ================= tahan klik + geser untuk menggulung tabel (seperti Struktur Organisasi) =================
(function () {
  const css = document.createElement('style');
  css.textContent = '.tw.canpan{cursor:grab}.tw.panning,.tw.panning *{cursor:grabbing!important;user-select:none!important}';
  document.head.appendChild(css);
  const SKIP = 'a,button,input,select,textarea,label,summary,[contenteditable],[draggable="true"],.fchip2,[data-pt]';
  let P = null;
  const mark = () => document.querySelectorAll('.tw').forEach((w) => w.classList.toggle('canpan', w.scrollWidth > w.clientWidth + 2));
  new MutationObserver(() => requestAnimationFrame(mark)).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('resize', mark);
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const w = e.target.closest && e.target.closest('.tw'); if (!w || e.target.closest(SKIP)) return;
    if (w.scrollWidth <= w.clientWidth + 2) return;
    P = { w, x: e.clientX, y: e.clientY, sl: w.scrollLeft, sy: window.scrollY, on: false };
  });
  document.addEventListener('mousemove', (e) => {
    if (!P) return;
    const dx = e.clientX - P.x, dy = e.clientY - P.y;
    if (!P.on) { if (Math.abs(dx) + Math.abs(dy) < 6) return; P.on = true; P.w.classList.add('panning'); window.getSelection && window.getSelection().removeAllRanges(); }
    e.preventDefault();
    P.w.scrollLeft = P.sl - dx;
    window.scrollTo(window.scrollX, P.sy - dy);
  });
  const end = () => { if (!P) return; if (P.on) { const w = P.w; w.classList.remove('panning'); const eat = (ev) => { ev.stopPropagation(); ev.preventDefault(); }; window.addEventListener('click', eat, true); setTimeout(() => window.removeEventListener('click', eat, true), 0); } P = null; };
  document.addEventListener('mouseup', end);
  window.addEventListener('blur', end);
})();

// ================= Print: sama seperti tampilan web, pengaturan kertas bebas dari jendela Print =================
(function () {
  window.addEventListener('beforeprint', () => {
    if (typeof ui !== 'undefined' && ui.page === 'org') return;
    document.body.classList.add('pp');
    document.querySelectorAll('#view table.t').forEach((t) => {
      const ths = [...t.querySelectorAll('thead th')];
      ths.forEach((th, i) => {
        if (!/^aksi$/i.test(th.textContent.trim())) return;
        th.classList.add('noprint');
        t.querySelectorAll('tbody tr, tfoot tr').forEach((tr) => { const c = tr.children[i]; if (c && tr.children.length === ths.length) c.classList.add('noprint'); });
      });
    });
    // tabel dicetak persis seperti di web, diperkecil mengikuti lebar kertas yang dipilih di jendela Print
    let css = '';
    document.querySelectorAll('#view .tw').forEach((w, k) => {
      const t = w.querySelector('table'); if (!t) return;
      const W = Math.max(t.scrollWidth, w.clientWidth); w.classList.add('pz' + k);
      for (let pw = 300; pw < W; pw += 20) css += `@media print and (min-width:${pw}px){.pz${k}{zoom:${(pw / W).toFixed(3)}}}`;
      css += `@media print and (min-width:${W}px){.pz${k}{zoom:1}}`;
    });
    let st = document.getElementById('pzCss'); if (!st) { st = document.createElement('style'); st.id = 'pzCss'; document.head.appendChild(st); }
    st.textContent = css;
  });
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('pp');
    document.querySelectorAll('#view .noprint').forEach((e) => e.classList.remove('noprint'));
    const st = document.getElementById('pzCss'); if (st) st.textContent = '';
  });
})();
