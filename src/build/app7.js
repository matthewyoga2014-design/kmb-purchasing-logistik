
// ================= v9: per-candidate stage dates + document uploads =================
let ASSETS = null;
const C_STAGE_KEYS = ['Psikologi Test', 'Interview User', 'Offering Latter', 'MCU', 'FU MCU', 'On Site', 'Induksi'];
const C_UPLOADS = { sumber: 'Berkas Lamaran / CV', st0: 'Hasil Psikologi Test', st1: 'Hasil Interview User', st2: 'Offering Letter', st3: 'Hasil MCU' };
function candStage(c, p) {
  const ds = Array.isArray(c.dates) ? c.dates : [];
  let k = -1; ds.forEach((d, i) => { if (d) k = i; });
  if (k >= 0) return k + 1;
  return c.stage ?? (p ? stageIdx(p) : 0);
}
function candidates(p) {
  materialize(p);
  const out = p.cands.map((c, ci) => {
    const st = ST_OF(c.status);
    return { ci, name: c.name, note: c.note || '', st, status: c.status, sumber: c.sumber, stage: candStage(c, p), dates: c.dates || [], apply: c.apply || null, files: c.files || {},
      reason: st === 'no' ? (c.status === 'Tidak Lolos' ? (c.note ? reasonOf(c.note) : 'Tidak lolos') : c.status === 'No Response' ? 'Tidak ada respon' : c.status === 'Menolak OL' ? 'Menolak offering' : c.status === 'Mundur' ? 'Mundur / kabur' : 'Tidak lolos') : '' };
  });
  (p.hist || []).forEach((h) => { if (!out.some((c) => normName(c.name) === normName(h.name))) out.push({ ...h, status: h.status || 'Tidak Lolos', stage: h.stage ?? stageIdx(p), files: {}, fromHist: true }); });
  return out;
}
const fileUrl = (f) => '/_blob/' + f.id;
const fileChips = (files) => Object.entries(C_UPLOADS).filter(([k]) => files && files[k]).map(([k, lb]) => `<a class="fchip2" href="${fileUrl(files[k])}" title="${esc(files[k].name || lb)}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 3H6v18h12V7l-4-4zM14 3v4h4" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>${lb}</a>`).join('');

// upload widget inside the generic form
const _field = field;
field = function (f, v) {
  if (f.type !== 'upload') return _field(f, v);
  return `<div class="fld"><label>${f.label}</label><div class="upw" id="up_${f.k}">${upInner(f.k)}</div></div>`;
};
function upInner(k) {
  const cur = FORM && FORM.files ? FORM.files[k] : null;
  if (FORM && FORM.uploading === k) return '<span class="upst"><span class="spin sm"></span>Mengunggah…</span>';
  if (cur) return `<a class="fchip2" href="${fileUrl(cur)}" title="${esc(cur.name || 'Berkas')}">${esc(cur.name || 'Berkas')}</a><button type="button" class="upx" data-uprm="${k}" aria-label="Hapus berkas">×</button>`;
  if (!ASSETS) return '<span class="small">Upload tersedia untuk pemilik di claude.ai</span>';
  return `<button type="button" class="btn btn-g btn-sm upbtn" data-uppick="${k}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 15V4M7 9l5-5 5 5M4 20h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Upload</button><input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" data-upfile="${k}" hidden><small>atau seret berkas ke sini · PDF / JPG / PNG, maks 20 MB</small>`;
}
document.addEventListener('change', async (e) => {
  const inp = e.target.closest && e.target.closest('[data-upfile]'); if (!inp || !FORM) return;
  const k = inp.dataset.upfile, f = inp.files && inp.files[0]; inp.value = ''; if (!f || !ASSETS) return;
  const ok = /^(application\/pdf|image\/(png|jpeg|webp))$/.test(f.type);
  if (!ok) { toast('Format belum didukung. Gunakan PDF, JPG, atau PNG (file Word bisa disimpan sebagai PDF dulu).', true); return; }
  if (f.size > 20 * 1024 * 1024) { toast('Ukuran file lebih dari 20 MB.', true); return; }
  const form = FORM; form.uploading = k; document.getElementById('up_' + k).innerHTML = upInner(k);
  try {
    const r = await ASSETS.upload(f);
    form.files = { ...(form.files || {}), [k]: { id: r.id, name: f.name, type: r.contentType } };
  } catch (er) {
    const c = er && er.code;
    toast(c === 'too_large' ? 'Ukuran file terlalu besar (maks 20 MB).' : c === 'unsupported_type' ? 'Format file tidak didukung. Gunakan PDF, JPG, atau PNG.' : c === 'quota_or_state' ? 'Penyimpanan berkas sudah penuh.' : c === 'not_granted' ? 'Akun ini tidak bisa mengunggah berkas.' : 'Upload gagal' + (er && er.message ? ': ' + er.message : '.'), true);
  } finally { form.uploading = null; const box = document.getElementById('up_' + k); if (box && FORM === form) box.innerHTML = upInner(k); }
}, true);
// seret & lepas berkas ke kotak upload (seperti Google Form), atau klik kotaknya untuk mencari berkas
(function () {
  const zone = (e) => e.target.closest && e.target.closest('.upw');
  const inpOf = (z) => z && z.querySelector('[data-upfile]');
  ['dragenter', 'dragover'].forEach((ev) => document.addEventListener(ev, (e) => {
    if (!FORM || !e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
    e.preventDefault(); const z = zone(e);
    document.querySelectorAll('.upw.drag').forEach((x) => { if (x !== z) x.classList.remove('drag'); });
    if (z && inpOf(z)) { z.classList.add('drag'); e.dataTransfer.dropEffect = 'copy'; } else e.dataTransfer.dropEffect = 'none';
  }));
  document.addEventListener('dragleave', (e) => { const z = zone(e); if (z && !z.contains(e.relatedTarget)) z.classList.remove('drag'); });
  document.addEventListener('drop', (e) => {
    if (!FORM || !e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    e.preventDefault(); document.querySelectorAll('.upw.drag').forEach((x) => x.classList.remove('drag'));
    const inp = inpOf(zone(e)); if (!inp) { toast('Lepaskan berkas tepat di kotak Upload.', true); return; }
    if (e.dataTransfer.files.length > 1) toast('Satu kotak satu berkas. Yang dipakai berkas pertama.');
    const dt = new DataTransfer(); dt.items.add(e.dataTransfer.files[0]); inp.files = dt.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-uppick]');
    const z = zone(e); if (!b && (!z || e.target.closest('a,button,label,input'))) return;
    const inp = inpOf(b ? b.closest('.upw') : z); if (inp) { e.preventDefault(); pickerOpen(inp); }
  });
  // panel "Sisipkan file" seperti Google Form
  function pickerOpen(inp) {
    const fld = inp.closest('.fld'), name = fld && fld.querySelector('label') ? fld.querySelector('label').textContent.trim() : 'Berkas';
    let pk = document.getElementById('upPick');
    if (!pk) {
      document.body.insertAdjacentHTML('beforeend', `<div id="upPick" role="dialog" aria-modal="true" aria-labelledby="upPkT" hidden><div class="upk">
        <div class="upk-h"><div><small>Sisipkan file</small><h3 id="upPkT"></h3></div><button type="button" class="upk-x" data-pkclose aria-label="Tutup">×</button></div>
        <div class="upk-i"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Upload 1 file: PDF, JPG, atau PNG. Maks 20 MB. File Word simpan dulu sebagai PDF.</span></div>
        <div class="upk-z" id="upPkZ"><svg class="cloud" width="150" height="104" viewBox="0 0 150 104" aria-hidden="true"><defs><linearGradient id="upkg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#4ADE80"/><stop offset="1" stop-color="#BAE6FD"/></linearGradient></defs><path d="M38 98h80a28 28 0 0 0 3-56 34 34 0 0 0-66-8 28 28 0 0 0-17 64z" fill="url(#upkg)" stroke="#1E1B3A" stroke-width="1.6"/><path d="M75 82V44M61 57l14-14 14 14" fill="none" stroke="#1E1B3A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <button type="button" class="upk-b" id="upPkB">Jelajah</button><p>atau tarik file ke sini</p></div></div></div>`);
      pk = document.getElementById('upPick');
      pk.addEventListener('click', (e) => { if (e.target === pk || e.target.closest('[data-pkclose]')) pickerClose(); else if (e.target.closest('#upPkB') || e.target.closest('#upPkZ')) { if (pk._inp) pk._inp.click(); } });
      const z = document.getElementById('upPkZ');
      ['dragenter', 'dragover'].forEach((ev) => z.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); z.classList.add('on'); }));
      z.addEventListener('dragleave', (e) => { if (!z.contains(e.relatedTarget)) z.classList.remove('on'); });
      z.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); z.classList.remove('on'); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (!f || !pk._inp) return; const dt = new DataTransfer(); dt.items.add(f); pk._inp.files = dt.files; const i = pk._inp; pickerClose(); i.dispatchEvent(new Event('change', { bubbles: true })); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pk.hidden) { e.stopPropagation(); pickerClose(); } }, true);
    }
    if (pk._inp && pk._inp._pkh) pk._inp.removeEventListener('change', pk._inp._pkh);
    pk._inp = inp; inp._pkh = () => pickerClose(); inp.addEventListener('change', inp._pkh, { once: true });
    document.getElementById('upPkT').textContent = name; pk.hidden = false; setTimeout(() => document.getElementById('upPkB').focus(), 30);
  }
  function pickerClose() { const pk = document.getElementById('upPick'); if (pk) pk.hidden = true; }
})();
document.addEventListener('click', (e) => {
  const rm = e.target.closest('[data-uprm]'); if (!rm || !FORM) return;
  e.stopPropagation(); const k = rm.dataset.uprm; const f = { ...(FORM.files || {}) }; delete f[k]; FORM.files = f;
  document.getElementById('up_' + k).innerHTML = upInner(k);
}, true);

// candidate form like the reference (one date per stage + uploads)
function candForm(idx, ci) {
  const p = DATA.positions[idx]; materialize(p);
  const c = ci == null ? null : p.cands[ci];
  const vals = c ? { ...c } : { status: 'Aktif', apply: TODAY };
  const ds = (c && c.dates) || [];
  C_STAGE_KEYS.forEach((_, i) => { vals['d' + i] = ds[i] || null; });
  openForm({ eyebrow: `${isVacant(p) ? 'Vacant' : esc(p.nama)} #${p.no} • ${p.ptk || 'Tanpa PTK'}`, title: `${c ? 'Edit' : 'Tambah'} Pelamar — ${p.jabatan}`,
    values: vals, submit: 'Simpan Pelamar',
    sections: [{ fields: [
      { k: 'name', label: 'Nama Kandidat', req: true },
      { k: 'apply', label: 'Tanggal Lamaran', type: 'date' },
      { k: 'sumber', label: 'Sumber', list: C_SUMBER, ph: 'Online, Referral, Walk-in…' },
      { k: 'u_sumber', label: 'Berkas Lamaran / CV', type: 'upload' },
      { k: 'd0', label: 'Psikologi Test', type: 'date' }, { k: 'u_st0', label: 'Hasil Psikologi Test', type: 'upload' },
      { k: 'd1', label: 'Interview User', type: 'date' }, { k: 'u_st1', label: 'Hasil Interview User', type: 'upload' },
      { k: 'd2', label: 'Offering Letter', type: 'date' }, { k: 'u_st2', label: 'Offering Letter (dokumen)', type: 'upload' },
      { k: 'd3', label: 'MCU', type: 'date' }, { k: 'u_st3', label: 'Hasil MCU', type: 'upload' },
      { k: 'd4', label: 'FU MCU', type: 'date' }, { k: 'd5', label: 'On Site', type: 'date' }, { k: 'd6', label: 'Induksi', type: 'date' },
      { k: 'status', label: 'Status Kandidat', type: 'select', options: C_STATUS },
      { k: 'note', label: 'Keterangan', type: 'textarea', full: true, rows: 3, ph: 'Contoh: Tidak lolos interview user' },
    ] }],
    onSave: (v) => {
      if (FORM && FORM.uploading) { toast('Tunggu upload selesai dulu.', true); return false; }
      const files = {}; Object.entries((FORM && FORM.files) || {}).forEach(([k, f]) => { files[k.replace(/^u_/, '')] = f; });
      return commit((S) => {
        const pos = S.positions[idx]; materialize(pos);
        const dates = C_STAGE_KEYS.map((_, i) => v['d' + i] || null);
        const rec = { name: v.name, status: v.status || 'Aktif', sumber: v.sumber, apply: v.apply, dates, files, note: v.note };
        rec.stage = dates.some(Boolean) ? candStage(rec) : (c ? (c.stage ?? stageIdx(pos)) : 0);
        if (c) pos.cands[ci] = rec; else pos.cands.push(rec);
        if (rec.status === 'Diterima' && isVacant(pos)) pos.nama = rec.name;
        pos.ket = ketFromCands(pos.cands);
        try { sessionStorage.setItem('mp5-cands', String(idx)); } catch (e) {}
      }, c ? 'Pelamar diperbarui.' : 'Pelamar ditambahkan.');
    } });
  const fl = {}; Object.entries((c && c.files) || {}).forEach(([k, f]) => { fl['u_' + k] = f; }); FORM.files = fl;
  Object.keys(C_UPLOADS).forEach((k) => { const box = document.getElementById('up_u_' + k); if (box) box.innerHTML = upInner('u_' + k); });
  document.querySelector('#frm .fgrid').classList.add('c3');
  const back = document.createElement('div'); back.className = 'cm-back';
  back.innerHTML = `<button type="button" class="btn btn-g btn-sm" data-cands="${idx}">← Daftar Pelamar</button><span class="small">${isVacant(p) ? 'Vacant' : esc(p.nama)} #${p.no} • ${esc(p.ptk || '')}</span>`;
  document.getElementById('frm').prepend(back);
}

// candidate cards with dates + documents
function openCands(idx) {
  CANDS_FOR = idx; FORM = null;
  const p = DATA.positions[idx], cs = candidates(p), hi = topStage(p);
  const dl = (c) => { const parts = []; if (c.apply) parts.push(`Lamaran ${fmt(c.apply)}`); (c.dates || []).forEach((d, i) => { if (d) parts.push(`${STAGE_SHORT[i + 1]} ${isDate(d) ? fmt(d) : esc(d)}`); }); return parts.length ? `<div class="cc-dates">${parts.join(' • ')}</div>` : ''; };
  document.getElementById('dialog').innerHTML = `<div class="cm-h"><h2 id="mTitle">Pelamar — ${esc(p.jabatan)} (${isVacant(p) ? 'Vacant' : esc(p.nama)} #${p.no})</h2><button type="button" class="x" id="mClose" aria-label="Tutup">×</button></div>
    <div class="cm-sum"><div><b>${cs.length} pelamar</b><span>Progress tertinggi ${STAGE_UP[hi]} (${STAGE_PCT[hi]}%)</span></div>${CAN_EDIT ? '<button type="button" class="btn btn-y" id="addCand">+ Tambah Pelamar</button>' : ''}</div>
    <div class="cm-list">${cs.map((c) => `<div class="cc"><div class="cc-h"><div><b>${esc(c.name)}</b><div class="cc-meta"><span class="hs ${C_BADGE[c.status] || 'no'}">${esc(c.status)}</span><span>${esc(c.sumber || 'Sumber belum diisi')}</span>${c.fromHist ? '<span class="hs hist">riwayat</span>' : ''}</div></div>
      ${CAN_EDIT && !c.fromHist ? `<div class="acts"><button type="button" class="btn btn-g btn-sm" data-ecand="${c.ci}">Edit</button><button type="button" class="btn btn-g btn-sm red" data-dcand="${c.ci}">Hapus</button></div>` : ''}</div>
      <div class="cc-pg"><span class="tr"><i style="width:${STAGE_PCT[c.stage]}%"></i></span><b>${STAGE_PCT[c.stage]}%</b><span>${STAGE_UP[c.stage]}</span></div>
      ${dl(c)}${c.note ? `<div class="cc-note">${esc(c.note)}</div>` : ''}
      ${Object.keys(c.files || {}).length ? `<div class="cc-files">${fileChips(c.files)}</div>` : ''}</div>`).join('') || '<div class="empty">Belum ada pelamar untuk posisi ini.</div>'}</div>
    <div class="factions"><span style="flex:1"></span><button type="button" class="btn btn-g" id="fCancel">Batal</button></div>`;
  document.getElementById('modal').hidden = false; document.getElementById('mClose').focus();
}

// ================= v9b: Data Pelamar page =================
PAGES.splice(2, 0, { id: 'pelamar', label: 'Data Pelamar', grp: 'Monitoring', ic: '<path d="M9 11a4 4 0 100-8 4 4 0 000 8zM2 21c0-4 3-7 7-7s7 3 7 7M16 4a4 4 0 010 7M18 14c2.5 1 4 3.5 4 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' });
if ((location.hash || '').slice(1) === 'pelamar') ui.page = 'pelamar';
try { if ((sessionStorage.getItem('mp5-page') || store.get('mp5-page')) === 'pelamar') ui.page = 'pelamar'; } catch (e) {}
ui.pt = 'aktif'; ui.pq2 = '';
const PT_OF = (c) => c.st === 'ok' ? 'diterima' : (c.st === 'pr' || c.st === 'hd') ? 'aktif' : 'tidak';
function pagePelamar(D) {
  const all = []; D.P.forEach((p, idx) => candidates(p).forEach((c) => all.push({ ...c, p, idx })));
  const cnt = (t) => all.filter((c) => PT_OF(c) === t).length;
  const q = ui.pq2.toLowerCase();
  const rows = all.filter((c) => (ui.pt === 'semua' || PT_OF(c) === ui.pt) && (!q || `${c.name} ${c.p.jabatan} ${c.sumber || ''} ${c.note} ${c.p.ptk || ''}`.toLowerCase().includes(q)))
    .sort((a, b) => (isOpen(b.p) - isOpen(a.p)) || (a.p.no - b.p.no));
  const reasons = {}; all.filter((c) => PT_OF(c) === 'tidak').forEach((c) => { reasons[c.status] = (reasons[c.status] || 0) + 1; });
  return `<div class="mhead"><div><div class="eyebrow">Monitoring Manpower KTA - TRA</div><h1>Data Pelamar</h1><p>Seluruh pelamar dari semua PTK: aktif, tidak aktif, dan yang sudah diterima.</p></div>
    <div class="mtools"><input type="search" id="pq2" placeholder="Cari nama / jabatan / sumber" value="${esc(ui.pq2)}" aria-label="Cari pelamar">
    ${DL ? '<button type="button" class="btn btn-g" id="csvPel">Export CSV</button>' : ''}${(DL || IS_TOP) ? '<button type="button" class="btn btn-g" id="printBtn">Print</button>' : ''}</div></div>
  <div class="mstats"><div><b>${all.length}</b><span>Total pelamar</span></div><div><b style="color:var(--primary)">${cnt('aktif')}</b><span>Aktif (proses + hold)</span></div><div><b style="color:var(--crit)">${cnt('tidak')}</b><span>Tidak aktif</span></div><div><b style="color:var(--good)">${cnt('diterima')}</b><span>Diterima</span></div><div><b>${Object.entries(reasons).map(([k, n]) => `${n}`).join('/') || 0}</b><span>${Object.keys(reasons).join(' / ') || 'Alasan tidak aktif'}</span></div></div>
  <div class="card" style="padding:16px 0 6px">
    <div class="toolbar" style="padding:0 16px"><div class="seg" role="group" aria-label="Kategori pelamar">${[['aktif', `Aktif (${cnt('aktif')})`], ['tidak', `Tidak Aktif (${cnt('tidak')})`], ['diterima', `Diterima (${cnt('diterima')})`], ['semua', `Semua (${all.length})`]].map(([k, l]) => `<button type="button" data-pt="${k}" aria-pressed="${ui.pt === k}">${l}</button>`).join('')}</div><span class="small">${rows.length} pelamar</span></div>
    <div class="tw"><table class="t mt"><thead><tr><th>No</th><th>Nama Kandidat</th><th>Jabatan</th><th>PTK</th><th>Status PTK</th><th>Status Kandidat</th><th>Tahap Terakhir</th><th>Tgl Lamaran</th><th>Sumber</th><th>Berkas</th><th>Keterangan</th>${CAN_EDIT ? '<th>Aksi</th>' : ''}</tr></thead><tbody>
    ${rows.map((c, i) => `<tr><td>${i + 1}</td><td class="b">${esc(c.name)}</td><td>${esc(c.p.jabatan)}<div class="small">${isVacant(c.p) ? 'Vacant' : esc(c.p.nama)} #${c.p.no}</div></td><td class="ptkc small">${esc(c.p.ptk || '-')}</td>
      <td>${hasPTK(c.p) ? `<span class="stt ${isOpen(c.p) ? 'open' : 'close'}">${esc(c.p.status)}</span>` : '-'}</td>
      <td><span class="hs ${C_BADGE[c.status] || 'no'}">${esc(c.status)}</span>${c.fromHist ? ' <span class="hs hist">riwayat</span>' : ''}</td>
      <td><div class="pg"><span class="tr"><i style="width:${STAGE_PCT[c.stage]}%"></i></span><b>${STAGE_PCT[c.stage]}%</b></div><div class="pgl">${STAGE_UP[c.stage]}</div></td>
      <td class="nw">${c.apply ? fmt(c.apply) : '-'}</td><td>${esc(c.sumber || '-')}</td>
      <td><div class="cc-files">${fileChips(c.files) || '<span class="small">-</span>'}</div></td><td class="ket">${esc(c.note || '-')}</td>
      ${CAN_EDIT ? `<td>${c.fromHist ? '' : `<button type="button" class="btn btn-g btn-sm" data-epc="${c.idx}:${c.ci}">Edit</button>`}</td>` : ''}</tr>`).join('') || `<tr><td colspan="12" class="empty">Belum ada pelamar di kategori ini.</td></tr>`}
    </tbody></table></div></div>`;
}
function render() {
  D = derive();
  let lastG = '';
  const nPel = D.P.reduce((a, p) => a + candidates(p).filter((c) => c.st === 'pr' || c.st === 'hd').length, 0);
  const ct = { mpp: [D.open.length, D.ket['JATUH TEMPO'] > 0], pelamar: [nPel, false], karyawan: [DATA.aktif.length, false], unit: [D.unitTot, false] };
  document.getElementById('nav').innerHTML = PAGES.map((pg) => {
    const lbl = pg.grp !== lastG ? `<div class="lbl">${pg.grp}</div>` : ''; lastG = pg.grp;
    const c = ct[pg.id];
    return `${lbl}<button type="button" data-go="${pg.id}" ${ui.page === pg.id ? 'aria-current="page"' : ''}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">${pg.ic}</svg>${pg.label}${c ? `<span class="ct ${c[1] ? 'al' : ''}">${c[0]}</span>` : ''}</button>`;
  }).join('');
  document.getElementById('roleTag').textContent = ROLE;
  document.getElementById('roleTag').className = 'pill' + (CAN_EDIT ? ' live' : '');
  document.getElementById('upBtn').hidden = !CAN_EDIT;
  const map = { dashboard: pageDashboard, mpp: pageMPP, pelamar: pagePelamar, unit: pageUnit, karyawan: pageKaryawan, setting: pageSetting };
  document.getElementById('view').innerHTML = (map[ui.page] || pageDashboard)(D);
}
document.addEventListener('click', (e) => {
  const t = e.target;
  const pt = t.closest('[data-pt]'); if (pt) { ui.pt = pt.dataset.pt; render(); return; }
  const ep = t.closest('[data-epc]'); if (ep && CAN_EDIT) { const [i, ci] = ep.dataset.epc.split(':').map(Number); candForm(i, ci); return; }
  if (t.closest('#csvPel')) {
    const head = ['No', 'Nama Kandidat', 'Kategori', 'Status Kandidat', 'Jabatan', 'No Posisi', 'PTK', 'Status PTK', 'Tahap Terakhir', 'Tanggal Lamaran', 'Sumber', ...C_STAGE_KEYS, 'Keterangan'];
    const rows = []; DATA.positions.forEach((p) => candidates(p).forEach((c) => rows.push([0, c.name, { aktif: 'Aktif', tidak: 'Tidak Aktif', diterima: 'Diterima' }[PT_OF(c)], c.status, p.jabatan, p.no, p.ptk, p.status, STAGE_UP[c.stage], c.apply, c.sumber, ...C_STAGE_KEYS.map((_, i) => (c.dates || [])[i] || ''), c.note])));
    rows.forEach((r, i) => { r[0] = i + 1; });
    save('Data_Pelamar_KTA-TRA.csv', csvOf(head, rows));
  }
});
document.addEventListener('input', (e) => { if (e.target.id === 'pq2') { ui.pq2 = e.target.value; keepFocus('pq2'); } });
