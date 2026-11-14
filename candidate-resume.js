/* Resume pelamar (portal Monitoring Manpower: KTA - TRA, BUPR, MBJ, KMB).
 * Satu halaman ringkas per pelamar: sampai tahap mana, tanggal tiap tahap, berkas yang sudah/belum ada,
 * status & keterangan. Dibuka dari tombol "Resume" (daftar pelamar per posisi, Data Pelamar, form Edit Pelamar).
 * Memakai data & fungsi yang sudah ada di halaman (DATA, candidates, STAGE_UP, C_UPLOADS, fileUrl, …). */
(function () {
  'use strict';
  if (window.KMBResume) return;
  // akses variabel global halaman (const/let/function di skrip utama) tanpa eval
  const GET = {
    DATA: () => typeof DATA !== 'undefined' ? DATA : undefined, candidates: () => typeof candidates !== 'undefined' ? candidates : undefined,
    STAGE_PCT: () => typeof STAGE_PCT !== 'undefined' ? STAGE_PCT : undefined, fileUrl: () => typeof fileUrl !== 'undefined' ? fileUrl : undefined,
    isVacant: () => typeof isVacant !== 'undefined' ? isVacant : undefined, CAN_EDIT: () => typeof CAN_EDIT !== 'undefined' ? CAN_EDIT : undefined,
    toast: () => typeof toast !== 'undefined' ? toast : undefined, candForm: () => typeof candForm !== 'undefined' ? candForm : undefined,
  };
  const G = (n, d) => { try { const v = GET[n](); return v === undefined ? d : v; } catch (e) { return d; } };
  const escH = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isD = (s) => /^\d{4}-\d{2}-\d{2}/.test(String(s || ''));
  const fmtD = (s) => { if (!s) return ''; if (!isD(s)) return escH(s); const d = new Date(String(s).slice(0, 10) + 'T00:00:00'); return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); };
  const daysAgo = (s) => { if (!isD(s)) return null; const d = new Date(String(s).slice(0, 10) + 'T00:00:00'), t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((t - d) / 864e5); };
  const nn = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // tahap 0 = lamaran/sourcing, 1..7 = tanggal di form (Psikologi Test … Induksi)
  // MCU & FU MCU satu tahap: FU MCU hanya bila diperlukan
  const STAGES = ['Lamaran / Sourcing', 'Screening CV', 'Psikologi Test', 'Interview User', 'Offering Letter', 'MCU / FU MCU', 'On Site', 'Induksi'];
  const LAST = STAGES.length - 1;
  const UP_OF_STAGE = { 0: ['sumber'], 1: ['scr'], 2: ['st0'], 3: ['st1'], 4: ['st2'], 5: ['st3'], 7: ['st6'] };
  const UP_LABEL = { sumber: 'Berkas Lamaran / CV', scr: 'Hasil Screening CV', st0: 'Hasil Psikologi Test', st1: 'Hasil Interview User', st2: 'Offering Letter (dokumen)', st3: 'Hasil MCU', st6: 'Bukti Induksi' };
  const STOP_LABEL = { 'Tidak Lolos': 'Tidak lolos', 'No Response': 'Tidak ada respon', 'Menolak OL': 'Menolak offering', 'Mundur': 'Mundur / kabur' };

  const css = document.createElement('style');
  css.textContent = `
.rs-btn{display:inline-flex;align-items:center;gap:4px;border:1px solid #DDD0FA;background:#F5F0FF;color:#6D28D9;border-radius:999px;padding:1px 9px;font-family:inherit;font-size:11.5px;font-weight:600;line-height:1.5;cursor:pointer;vertical-align:middle;white-space:nowrap}
.rs-btn:hover{background:#6D28D9;color:#fff;border-color:#6D28D9}
.rs-name{all:unset;cursor:pointer;font-weight:700;color:inherit;border-bottom:1px dashed #B9A6EE}
.rs-name:hover{color:#6D28D9}
#rsm{position:fixed;inset:0;z-index:58;background:rgba(20,14,45,.45);display:grid;place-items:center;padding:16px}
#rsm[hidden]{display:none}
#rsm .rs{background:#fff;color:#1C1A33;border-radius:16px;width:min(760px,100%);max-height:calc(100vh - 32px);overflow:auto;box-shadow:0 30px 80px -20px rgba(30,10,80,.5);font-size:13.5px;line-height:1.5}
.rs-h{display:flex;gap:12px;align-items:flex-start;padding:18px 20px 12px;border-bottom:1px solid #ECEAF4;position:sticky;top:0;background:#fff;z-index:1}
.rs-h h2{margin:2px 0 0;font-size:20px;line-height:1.2}
.rs-eb{font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#6D28D9}
.rs-sub{color:#6B6985;font-size:12.5px;margin-top:3px}
.rs-x{border:0;background:#F2F0F8;width:34px;height:34px;border-radius:50%;font-size:20px;cursor:pointer;flex:none;margin-left:auto}
.rs-b{padding:16px 20px 8px;display:flex;flex-direction:column;gap:16px}
.rs-now{border-radius:14px;padding:14px 16px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 14px;align-items:center}
.rs-now.pr{background:linear-gradient(120deg,#EDE7FE,#F7F4FF);border:1px solid #DDD0FA}
.rs-now.ok{background:linear-gradient(120deg,#DCF5E5,#F1FBF5);border:1px solid #B7E8C8}
.rs-now.no{background:linear-gradient(120deg,#FDE2E7,#FFF4F6);border:1px solid #F7C3CE}
.rs-now.hd{background:linear-gradient(120deg,#FDEFD7,#FFF9EE);border:1px solid #F5DDB0}
.rs-now small{font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#6B6985}
.rs-now .big{font-size:19px;font-weight:800;line-height:1.25}
.rs-now .pct{font-size:30px;font-weight:800;grid-row:span 3;color:#6D28D9;font-variant-numeric:tabular-nums}
.rs-now.ok .pct{color:#15803D}.rs-now.no .pct{color:#BE123C}.rs-now.hd .pct{color:#B45309}
.rs-bar{grid-column:1/-1;height:8px;border-radius:4px;background:rgba(0,0,0,.07);overflow:hidden}
.rs-bar i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#7C3AED,#A78BFA)}
.rs-now.ok .rs-bar i{background:linear-gradient(90deg,#16A34A,#4ADE80)}.rs-now.no .rs-bar i{background:linear-gradient(90deg,#E11D48,#F7949C)}.rs-now.hd .rs-bar i{background:linear-gradient(90deg,#D97706,#FCD34D)}
.rs-facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.rs-facts div{background:#F7F6FB;border-radius:10px;padding:8px 10px}
.rs-facts span{display:block;font-size:11px;color:#6B6985;font-weight:600}
.rs-facts b{font-size:13px}
.rs-sec{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#6B6985;margin:0 0 8px}
.rs-tl{display:flex;flex-direction:column}
.rs-st{display:grid;grid-template-columns:28px minmax(0,1fr);gap:10px;position:relative;padding-bottom:12px}
.rs-st::before{content:"";position:absolute;left:13px;top:26px;bottom:0;width:2px;background:#E8E6F2}
.rs-st:last-child::before{display:none}
.rs-st.done::before{background:#C4B5FD}
.rs-dot{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:800;background:#F2F0F8;color:#A8A5C4;border:2px solid #fff;box-shadow:0 0 0 1px #E8E6F2}
.rs-st.done .rs-dot{background:#7C3AED;color:#fff;box-shadow:none}
.rs-st.cur .rs-dot{background:#7C3AED;color:#fff;box-shadow:0 0 0 4px #E4DAFD}
.rs-st.stop .rs-dot{background:#E11D48;color:#fff;box-shadow:0 0 0 4px #FDE2E7}
.rs-st.next .rs-dot{background:#fff;color:#7C3AED;box-shadow:0 0 0 2px #C4B5FD}
.rs-st.ok .rs-dot{background:#16A34A}
.rs-l{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;min-height:28px}
.rs-l b{font-size:14px}
.rs-st.todo .rs-l b{color:#A8A5C4;font-weight:600}
.rs-tag{font-size:11.5px;font-weight:700;border-radius:999px;padding:1px 9px}
.rs-tag.d{background:#EDE7FE;color:#5B21B6}.rs-tag.n{background:#F2F0F8;color:#8B88A3}.rs-tag.x{background:#FDE2E7;color:#BE123C}.rs-tag.nx{background:#fff;color:#6D28D9;border:1px dashed #C4B5FD}.rs-tag.c{background:#DCF5E5;color:#15803D}
.rs-f{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.rs-f .miss{font-size:11.5px;color:#A8A5C4;border:1px dashed #DCD9EA;border-radius:7px;padding:2px 8px}
.rs-docs{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px}
.rs-doc{display:flex;gap:8px;align-items:center;border:1px solid #ECEAF4;border-radius:10px;padding:7px 9px;min-width:0}
.rs-doc i{font-style:normal;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:800;flex:none}
.rs-doc.y i{background:#DCF5E5;color:#15803D}.rs-doc.n i{background:#F2F0F8;color:#A8A5C4}
.rs-doc div{min-width:0}.rs-doc span{display:block;font-size:11px;color:#6B6985}
.rs-doc a{font-size:12.5px;font-weight:600;color:#5B21B6;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rs-note{background:#FFF9EE;border:1px solid #F5DDB0;border-radius:10px;padding:10px 12px;white-space:pre-wrap}
.rs-ft{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;padding:12px 20px 16px;border-top:1px solid #ECEAF4;position:sticky;bottom:0;background:#fff}
.rs-ft button{border:1px solid #DCD9EA;background:#fff;border-radius:9px;padding:8px 13px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;color:#1C1A33}
.rs-ft button:hover{border-color:#6D28D9;color:#6D28D9}
.rs-ft button.p{background:linear-gradient(120deg,#7C3AED,#A78BFA);color:#fff;border-color:transparent}
@media (max-width:560px){.rs-now{grid-template-columns:1fr}.rs-now .pct{grid-row:auto;font-size:24px}}
@media print{body.rs-printing>*:not(#rsm){display:none!important}body.rs-printing #rsm{position:static;background:none;padding:0;display:block}
 body.rs-printing #rsm .rs{box-shadow:none;max-height:none;width:100%}body.rs-printing .rs-x,body.rs-printing .rs-ft{display:none!important}body.rs-printing .rs-h{position:static}}
`;
  document.head.appendChild(css);

  function findCand(idx, ci, name) {
    const P = G('DATA', null); if (!P || !P.positions || !P.positions[idx]) return null;
    const p = P.positions[idx]; const cs = G('candidates', null)(p);
    let c = ci !== '' && ci != null ? cs.find((x) => !x.fromHist && x.ci === Number(ci)) : null;
    if (!c && name) c = cs.find((x) => nn(x.name) === nn(name));
    return c ? { c, p, idx } : null;
  }

  function build(c, p) {
    const dates = Array.isArray(c.dates) ? c.dates : [];
    const files = c.files || {};
    // tanggal form: dates[0]=Psikotes,1=Interview,2=Offering,3=MCU,4=FU MCU,5=On Site,6=Induksi
    const stDate = (i) => i === 0 ? c.apply : i === 1 ? c.scr : i <= 4 ? dates[i - 2] : i === 5 ? (dates[3] || dates[4]) : dates[i - 1];
    const stLabel = (i) => i === 5 && dates[3] && dates[4] ? `MCU ${fmtD(dates[3])} · FU MCU ${fmtD(dates[4])}` : (i === 5 && !dates[3] && dates[4] ? 'FU MCU ' + fmtD(dates[4]) : fmtD(stDate(i)));
    let raw = 0; dates.forEach((d, i) => { if (d) raw = i + 1; });          // patokan: tanggal terakhir yang diisi di form
    const stage = raw === 0 ? (c.scr ? 1 : 0) : raw <= 4 ? raw + 1 : raw === 5 ? 5 : raw;   // Screening CV disisipkan setelah lamaran
    const pctArr = G('STAGE_PCT', [0, 25, 40, 55, 70, 80, 95, 100]);
    const pct = (c.status === 'Diterima') ? 100 : (raw === 0 && c.scr ? 12 : (pctArr[raw] ?? 0));
    const status = c.status || 'Aktif';
    const kind = status === 'Diterima' ? 'ok' : status === 'Hold' ? 'hd' : (c.st === 'no' || STOP_LABEL[status]) ? 'no' : 'pr';
    const lastDate = [c.apply, c.scr, ...dates].filter(isD).sort().pop();
    const ago = daysAgo(lastDate);
    const fu = G('fileUrl', (f) => '/_blob/' + f.id);
    const chip = (k) => files[k] ? `<a class="fchip2" href="${escH(fu(files[k]))}" title="${escH(files[k].name || UP_LABEL[k])}">${escH(UP_LABEL[k])}</a>` : '';
    const posName = `${escH(p.jabatan || '')} · ${G('isVacant', () => false)(p) ? 'Vacant' : escH(p.nama || '')} #${escH(p.no)}`;
    let head, sub;
    if (kind === 'ok') { head = 'Diterima' + (raw ? ' — ' + STAGES[stage] : ''); sub = 'Pelamar sudah diterima' + (stage < LAST ? ' · tanggal tahapan di form belum lengkap' : ''); }
    else if (kind === 'no') { head = `Berhenti di ${STAGES[stage]}`; sub = (STOP_LABEL[status] || status) + (c.reason && c.reason !== STOP_LABEL[status] ? ' · ' + escH(c.reason) : ''); }
    else { head = `Sedang di tahap ${STAGES[stage]}`; sub = stage < LAST ? `Berikutnya: ${STAGES[stage + 1]}` : 'Semua tahap sudah dilalui'; if (kind === 'hd') sub = 'Status Hold · ' + sub; }
    const tl = STAGES.map((nm, i) => {
      const d = stDate(i); const done = i <= stage && (i === 0 || !!d || i < stage);
      let cls = i < stage ? 'done' : i === stage ? (kind === 'no' ? 'stop' : kind === 'ok' ? 'done ok' : 'cur') : (i === stage + 1 && kind !== 'no' && kind !== 'ok' ? 'next' : 'todo');
      if (kind === 'ok' && i <= stage) cls = 'done ok';
      let tag = '';
      if (i === stage && kind === 'no') tag = `<span class="rs-tag x">${escH(STOP_LABEL[status] || status)}</span>`;
      else if (i === stage && kind !== 'ok') tag = `<span class="rs-tag d">Posisi sekarang</span>`;
      else if (cls === 'next') tag = '<span class="rs-tag nx">Berikutnya</span>';
      else if (i > stage) tag = '<span class="rs-tag n">Belum</span>';
      const ups = (UP_OF_STAGE[i] || []);
      const fl = ups.map((k) => files[k] ? chip(k) : (i <= stage ? `<span class="miss">${escH(UP_LABEL[k])} belum diupload</span>` : '')).join('');
      return `<div class="rs-st ${cls}"><span class="rs-dot">${cls.includes('stop') ? '!' : (i < stage || cls.includes('ok')) ? '✓' : i + 1}</span><div>
        <div class="rs-l"><b>${nm}</b>${d ? `<span>${stLabel(i)}</span>` : (done ? '<span style="color:#A8A5C4">tanggal belum diisi</span>' : '')}${tag}</div>${fl ? `<div class="rs-f">${fl}</div>` : ''}</div></div>`;
    }).join('');
    const nDocs = Object.keys(UP_LABEL).filter((k) => files[k]).length;
    const docs = Object.keys(UP_LABEL).map((k) => `<div class="rs-doc ${files[k] ? 'y' : 'n'}"><i>${files[k] ? '✓' : '–'}</i><div><span>${escH(UP_LABEL[k])}</span>${files[k] ? `<a class="fchip2" style="all:unset;cursor:pointer;color:#5B21B6;font-weight:600;font-size:12.5px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" href="${escH(fu(files[k]))}" title="${escH(files[k].name || UP_LABEL[k])}">${escH(files[k].name || 'Lihat berkas')}</a>` : '<span style="font-size:12.5px;color:#A8A5C4">Belum ada</span>'}</div></div>`).join('');
    const text = [
      `RESUME PELAMAR`, `Nama: ${c.name}`, `Posisi: ${p.jabatan || ''} (${G('isVacant', () => false)(p) ? 'Vacant' : p.nama || ''} #${p.no})${p.ptk ? ' · ' + p.ptk : ''}`,
      `Status: ${status} · Progres ${pct}%`, `Posisi proses: ${head.replace(/<[^>]+>/g, '')}${sub ? ' (' + sub.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&') + ')' : ''}`,
      `Sumber: ${c.sumber || '-'} · Tgl lamaran: ${c.apply ? fmtD(c.apply) : '-'}`, '', 'Tahapan:',
      ...STAGES.map((nm, i) => `${i <= stage ? '✓' : '·'} ${nm}: ${stDate(i) ? stLabel(i) : (i <= stage ? 'tanggal belum diisi' : 'belum')}`),
      '', `Berkas (${nDocs}/${Object.keys(UP_LABEL).length}): ` + Object.keys(UP_LABEL).map((k) => `${files[k] ? '✓' : '✗'} ${UP_LABEL[k]}`).join(', '),
      c.note ? `\nKeterangan: ${c.note}` : '',
    ].join('\n').trim();
    const html = `<div class="rs" role="dialog" aria-modal="true" aria-labelledby="rsT">
      <div class="rs-h"><div style="min-width:0"><div class="rs-eb">Resume pelamar</div><h2 id="rsT">${escH(c.name)}</h2><div class="rs-sub">${posName}${p.ptk ? ' · ' + escH(p.ptk) : ''}</div></div><button type="button" class="rs-x" data-rsclose aria-label="Tutup">×</button></div>
      <div class="rs-b">
        <div class="rs-now ${kind}"><small>Sampai mana prosesnya</small><span class="pct">${pct}%</span><div class="big">${head}</div><div>${sub}${ago != null ? ` · update terakhir ${fmtD(lastDate)}${ago > 0 ? ` (${ago} hari lalu)` : ' (hari ini)'}` : ''}</div><div class="rs-bar"><i style="width:${pct}%"></i></div></div>
        <div class="rs-facts"><div><span>Status kandidat</span><b>${escH(status)}</b></div><div><span>Tanggal lamaran</span><b>${c.apply ? fmtD(c.apply) : '-'}</b></div><div><span>Sumber</span><b>${escH(c.sumber || '-')}</b></div><div><span>Berkas</span><b>${nDocs} dari ${Object.keys(UP_LABEL).length}</b></div>${c.fromHist ? '<div><span>Catatan</span><b>Dari riwayat</b></div>' : ''}</div>
        <div><p class="rs-sec">Tahapan rekrutmen</p><div class="rs-tl">${tl}</div></div>
        <div><p class="rs-sec">Kelengkapan berkas (${nDocs}/${Object.keys(UP_LABEL).length})</p><div class="rs-docs">${docs}</div></div>
        ${c.note ? `<div><p class="rs-sec">Keterangan</p><div class="rs-note">${escH(c.note)}</div></div>` : ''}
      </div>
      <div class="rs-ft"><button type="button" data-rscopy>Salin ringkasan (WhatsApp)</button><button type="button" data-rsprint>Print / PDF</button>${G('CAN_EDIT', false) && !c.fromHist ? '<button type="button" class="p" data-rsedit>Edit pelamar</button>' : ''}</div></div>`;
    return { html, text };
  }

  let CUR = null;
  function open(idx, ci, name) {
    const hit = findCand(idx, ci, name);
    const toastF = G('toast', (m) => alert(m));
    if (!hit) { toastF('Data pelamar tidak ditemukan.', true); return; }
    const { html, text } = build(hit.c, hit.p);
    let m = document.getElementById('rsm');
    if (!m) { m = document.createElement('div'); m.id = 'rsm'; document.body.appendChild(m); }
    m.innerHTML = html; m.hidden = false; CUR = { ...hit, text };
    const x = m.querySelector('.rs-x'); if (x) x.focus();
  }
  function close() { const m = document.getElementById('rsm'); if (m) { m.hidden = true; m.innerHTML = ''; } CUR = null; }

  document.addEventListener('click', (e) => {
    const t = e.target;
    const b = t.closest && t.closest('[data-resume]');
    if (b) { e.preventDefault(); e.stopPropagation(); const [i, ci, nm] = b.dataset.resume.split(':'); open(Number(i), ci, decodeURIComponent(nm || '')); return; }
    const m = document.getElementById('rsm'); if (!m || m.hidden) return;
    if (t === m || t.closest('[data-rsclose]')) { close(); return; }
    if (t.closest('[data-rscopy]')) {
      const done = () => G('toast', (x) => alert(x))('Ringkasan disalin. Tinggal tempel di WhatsApp.');
      if (navigator.clipboard) navigator.clipboard.writeText(CUR.text).then(done, () => prompt('Salin ringkasan:', CUR.text)); else prompt('Salin ringkasan:', CUR.text);
      return;
    }
    if (t.closest('[data-rsprint]')) { document.body.classList.add('rs-printing'); setTimeout(() => { window.print(); document.body.classList.remove('rs-printing'); }, 50); return; }
    if (t.closest('[data-rsedit]')) { const c = CUR; close(); const f = G('candForm', null); if (f && c) f(c.idx, c.c.ci); }
  }, true);
  document.addEventListener('keydown', (e) => { const m = document.getElementById('rsm'); const v = document.getElementById('viewer'); if (e.key === 'Escape' && m && !m.hidden && !(v && !v.hidden)) { e.stopImmediatePropagation(); close(); } }, true);

  window.KMBResume = { open, close, attr: (idx, c) => `${idx}:${c.fromHist || c.ci == null ? '' : c.ci}:${encodeURIComponent(c.name || '')}` };
})();
