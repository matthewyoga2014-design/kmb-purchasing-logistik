// ================= editing, owner access, print/export (v5) =================
let IS_TOP = false; try { IS_TOP = window.top === window.self; } catch (e) {}
let IS_OWNER = false;
let ART = null, DL = null, CAN_EDIT = false, ROLE = 'Pelihat', SAVING = false;
const SEC_OPTS = () => [...new Set(DATA.positions.map((p) => p.section).filter(Boolean))];
const GRP_OPTS = () => [...new Set(DATA.positions.map((p) => p.group).filter(Boolean))];
const JAB_OPTS = () => [...new Set(DATA.positions.map((p) => p.jabatan).concat(DATA.aktif.map((p) => p.jabatan)).filter(Boolean))].sort();

function toast(msg, err) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.className = err ? 'err' : ''; t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 4200);
}
function jsonForScript(o) { return JSON.stringify(o).replace(/</g, '\\u003c'); }
function buildDoc(state) {
  const css = document.getElementById('css').textContent;
  const app = document.getElementById('app').textContent;
  const S = '<' + 'script', E = '</' + 'script>';
  return '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px/1.4 system-ui,-apple-system,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'
    + '<title>Monitoring Manpower KTA-TRA</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
    + '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">\n'
    + '<style id="css">' + css + '</style>\n'
    + S + ' type="application/json" id="state">' + jsonForScript(state) + E + '\n'
    + S + ' src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" defer>' + E + '\n'
    + S + ' src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js" defer>' + E + '\n'
    + S + ' src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" defer>' + E + '\n'
    + S + ' id="app">' + app + E + '</body></html>';
}
async function commit(mutate, okMsg) {
  if (!CAN_EDIT || SAVING) return false;
  const next = JSON.parse(JSON.stringify(STATE));
  mutate(next);
  next.positions.forEach((p, i) => { p.no = i + 1; });
  next.meta = { ...(next.meta || {}), updated: TODAY };
  SAVING = true; showSaving(true);
  try { sessionStorage.setItem('mp5-flash', okMsg || 'Perubahan tersimpan.'); sessionStorage.setItem('mp5-page', ui.page); } catch (e) {}
  try {
    await ART.publish(buildDoc(next));
    STATE = next; DATA = next; render();
    return true;
  } catch (e) {
    try { sessionStorage.removeItem('mp5-flash'); } catch (er) {}
    const c = e && e.code;
    if (c === 'conflict') toast('Ada versi yang lebih baru. Halaman dimuat ulang, silakan ulangi perubahan.', true);
    else if (c === 'not_writer' || c === 'not_granted' || c === 'consent_required' || c === 'not_declared' || c === 'capability_disabled') { CAN_EDIT = false; ROLE = 'Pelihat'; render(); toast('Akun ini hanya bisa melihat. Perubahan tidak disimpan.', true); }
    else if (c === 'rate_limited') toast('Terlalu sering menyimpan. Tunggu sebentar lalu coba lagi.', true);
    else toast('Gagal menyimpan: ' + ((e && e.message) || 'coba lagi.'), true);
    return false;
  } finally { SAVING = false; showSaving(false); }
}
function showSaving(on) { let s = document.getElementById('saving'); if (!s) { s = document.createElement('div'); s.id = 'saving'; s.innerHTML = '<div><span class="spin"></span>Menyimpan…</div>'; document.body.appendChild(s); } s.hidden = !on; }

// ---------- generic form modal ----------
let FORM = null;
function field(f, v) {
  const id = 'f_' + f.k, val = v ?? '';
  const lab = `<label for="${id}">${f.label}${f.req ? ' <b style="color:var(--crit)">*</b>' : ''}</label>`;
  let inp;
  if (f.type === 'select') inp = `<select id="${id}" name="${f.k}">${f.options.map((o) => { const [ov, ol] = Array.isArray(o) ? o : [o, o || '—']; return `<option value="${esc(ov)}" ${String(ov) === String(val) ? 'selected' : ''}>${esc(ol)}</option>`; }).join('')}</select>`;
  else if (f.type === 'textarea') inp = `<textarea id="${id}" name="${f.k}" rows="${f.rows || 4}" placeholder="${esc(f.ph || '')}">${esc(val)}</textarea>`;
  else if (f.type === 'date') inp = (val && !isDate(val)) ? `<input id="${id}" name="${f.k}" type="text" value="${esc(val)}" placeholder="YYYY-MM-DD">` : `<input id="${id}" name="${f.k}" type="date" value="${esc(val)}">`;
  else if (f.type === 'number') inp = `<input id="${id}" name="${f.k}" type="number" min="0" step="1" value="${esc(val)}" ${f.req ? 'required' : ''}>`;
  else if (f.type === 'check') return `<div class="fld full chk"><label><input id="${id}" name="${f.k}" type="checkbox" ${val ? 'checked' : ''}> ${f.label}</label></div>`;
  else inp = `<input id="${id}" name="${f.k}" type="text" value="${esc(val)}" ${f.list ? `list="dl_${f.k}"` : ''} placeholder="${esc(f.ph || '')}" ${f.req ? 'required' : ''} autocomplete="off">${f.list ? `<datalist id="dl_${f.k}">${f.list.map((o) => `<option value="${esc(o)}"></option>`).join('')}</datalist>` : ''}`;
  return `<div class="fld ${f.full ? 'full' : ''}">${lab}${inp}${f.hint ? `<small>${f.hint}</small>` : ''}</div>`;
}
function openForm(cfg) {
  FORM = cfg;
  const groups = cfg.sections || [{ fields: cfg.fields }];
  document.getElementById('dialog').innerHTML = `<button type="button" class="x" id="mClose" aria-label="Tutup">×</button>
    <div class="eyebrow">${esc(cfg.eyebrow || 'Edit Data')}</div><h2 id="mTitle" style="font-size:19px;margin-bottom:4px">${esc(cfg.title)}</h2>
    ${cfg.intro ? `<p class="small" style="margin:0 0 6px">${cfg.intro}</p>` : ''}
    <form id="frm" novalidate>${groups.map((g) => `${g.title ? `<div class="fsec">${g.title}</div>` : ''}<div class="fgrid">${g.fields.map((f) => field(f, cfg.values[f.k])).join('')}</div>`).join('')}
    <div class="ferr" id="ferr" hidden></div>
    <div class="factions">${cfg.danger ? `<button type="button" class="btn btn-d" id="fDanger">${cfg.danger.label}</button>` : ''}<span style="flex:1"></span><button type="button" class="btn btn-g" id="fCancel">Batal</button><button type="submit" class="btn btn-p">${cfg.submit || 'Simpan Perubahan'}</button></div></form>`;
  document.getElementById('modal').hidden = false;
  const first = document.querySelector('#frm input, #frm select, #frm textarea'); if (first) first.focus();
}
function readForm() {
  const out = {};
  const all = (FORM.sections || [{ fields: FORM.fields }]).flatMap((g) => g.fields);
  all.forEach((f) => {
    const el = document.getElementById('f_' + f.k); if (!el) return;
    if (f.type === 'check') out[f.k] = el.checked;
    else if (f.type === 'number') out[f.k] = el.value === '' ? 0 : Math.max(0, Math.round(+el.value));
    else { const v = el.value.trim(); out[f.k] = v === '' ? null : v; }
  });
  return out;
}
document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'frm') return;
  e.preventDefault();
  const v = readForm();
  const all = (FORM.sections || [{ fields: FORM.fields }]).flatMap((g) => g.fields);
  const miss = all.filter((f) => f.req && (v[f.k] === null || v[f.k] === ''));
  const er = document.getElementById('ferr');
  if (miss.length) { er.textContent = 'Lengkapi: ' + miss.map((f) => f.label).join(', ') + '.'; er.hidden = false; return; }
  const bad = all.filter((f) => f.type === 'date' && v[f.k] && !isDate(v[f.k]) && !f.freeText);
  if (bad.length) { er.textContent = 'Format tanggal harus YYYY-MM-DD: ' + bad.map((f) => f.label).join(', ') + '.'; er.hidden = false; return; }
  const ok = await FORM.onSave(v);
  if (ok !== false) closeModal();
});

// ---------- MPP form ----------
const STAGE_FIELDS = ['Psikologi Test', 'Interview User', 'Offering Letter', 'MCU', 'FU MCU', 'On Site', 'Induksi'];
function mppForm(idx) {
  const p = idx == null ? null : DATA.positions[idx];
  const vals = p ? { ...p, nama: p.nama } : { nama: 'Vacant', section: ui.mppSec || SEC_OPTS()[0] || '', group: '' };
  if (p) p.stages.forEach((s, i) => { vals['st' + i] = s; });
  openForm({
    eyebrow: 'MPP KTA - TRA', title: p ? `Edit Posisi No. ${p.no}` : 'Tambah Data MPP',
    intro: 'Kosongkan Nama atau isi <b>Vacant</b> untuk posisi yang belum terisi. Kandidat ditulis satu baris per orang: <b>Nama - keterangan</b>.',
    values: vals,
    sections: [
      { title: 'Posisi', fields: [
        { k: 'section', label: 'Section', list: SEC_OPTS(), req: true },
        { k: 'group', label: 'Sub-section', list: GRP_OPTS(), hint: 'Kosongkan jika sama dengan section.' },
        { k: 'jabatan', label: 'Jabatan', list: JAB_OPTS(), req: true },
        { k: 'nama', label: 'Nama', ph: 'Vacant' },
        { k: 'ket', label: 'Keterangan / Kandidat', type: 'textarea', full: true, ph: 'Budi Santoso - Tidak lolos interview user\nAndi - HOLD' },
      ] },
      { title: 'PTK', fields: [
        { k: 'pic', label: 'PIC', list: ['PT. KAI'] },
        { k: 'ptk', label: 'No. PTK' },
        { k: 'aju', label: 'Tanggal Pengajuan PTK', type: 'date' },
        { k: 'due', label: 'Due Date', type: 'date' },
        { k: 'status', label: 'Status', type: 'select', options: [['', '—'], 'Open', 'Continue', 'Close'] },
        { k: 'close', label: 'Tanggal Close', type: 'date' },
      ] },
      { title: 'Progress rekrutmen (tanggal)', fields: STAGE_FIELDS.map((l, i) => ({ k: 'st' + i, label: l, type: 'date', freeText: true })) },
    ],
    danger: p ? { label: 'Hapus posisi' } : null,
    onSave: (v) => commit((S) => {
      const rec = {
        section: v.section, group: v.group || v.section, nama: v.nama || 'Vacant', jabatan: v.jabatan, ket: v.ket, pic: v.pic, ptk: v.ptk, aju: v.aju,
        stages: STAGE_FIELDS.map((_, i) => v['st' + i] || null), due: v.due, status: v.status, close: v.close,
      };
      if (rec.status === 'Close' && !rec.close) rec.close = TODAY;
      if (p) { S.positions[idx] = { ...S.positions[idx], ...rec }; }
      else {
        let at = -1; S.positions.forEach((x, i) => { if (x.group === rec.group || (at < 0 && x.section === rec.section)) at = i; });
        S.positions.forEach((x, i) => { if (x.group === rec.group) at = i; });
        if (at < 0) S.positions.forEach((x, i) => { if (x.section === rec.section) at = i; });
        S.positions.splice(at < 0 ? S.positions.length : at + 1, 0, { no: 0, ...rec });
      }
    }, p ? 'Posisi diperbarui.' : 'Posisi ditambahkan.'),
  });
  FORM.dangerFn = () => confirmBox(`Hapus posisi No. ${p.no} (${p.jabatan} · ${p.nama})?`, 'Planning akan berkurang 1 posisi.', () => commit((S) => { S.positions.splice(idx, 1); }, 'Posisi dihapus.'));
}

// ---------- MP Aktif / Out forms ----------
const MP_FIELDS = () => [
  { k: 'nama', label: 'Nama', req: true },
  { k: 'jabatan', label: 'Jabatan', list: JAB_OPTS(), req: true },
  { k: 'dept', label: 'Departemen', list: ['Plant'] },
  { k: 'level', label: 'Level', type: 'select', options: [['', '—'], 'Staff', 'Non Staff'] },
  { k: 'kontrak', label: 'Status Kontrak', type: 'select', options: [['', '—'], 'PKWT', 'PKWTT', 'Harian Lepas'] },
  { k: 'masuk', label: 'Tanggal Masuk', type: 'date' },
  { k: 'akhir', label: 'Akhir Kontrak', type: 'date' },
  { k: 'poh', label: 'POH' },
  { k: 'jk', label: 'Jenis Kelamin', type: 'select', options: [['', '—'], 'Laki - Laki', 'Perempuan'] },
  { k: 'kategori', label: 'Keterangan (Ring)', type: 'select', options: [['', '—'], 'Ring 1', 'Ring 2', 'Ring 3', 'Nasional'] },
  { k: 'site', label: 'Site', list: ['TRA'] },
];
function mpForm(kind, idx) {
  const list = kind === 'out' ? DATA.keluar : DATA.aktif;
  const p = idx == null ? null : list[idx];
  const vac = DATA.positions.map((x, i) => [x, i]).filter(([x]) => isVacant(x));
  const fields = MP_FIELDS();
  if (kind === 'out') fields.push({ k: 'keluar', label: 'Tanggal Keluar', type: 'date' });
  if (!p && kind === 'aktif') fields.push({ k: 'fill', label: 'Isi posisi Vacant di MPP', type: 'select', full: true, options: [['', 'Tidak dihubungkan']].concat(vac.map(([x, i]) => [String(i), `No. ${x.no} · ${x.jabatan} · ${x.group || x.section}`])), hint: 'Nama di MPP berubah dari Vacant menjadi nama karyawan ini.' });
  openForm({
    eyebrow: kind === 'out' ? 'MP Out' : 'MP Aktif', title: p ? `Edit ${p.nama}` : 'Tambah Data Karyawan',
    values: p ? { ...p } : { dept: 'Plant', site: 'TRA', kontrak: 'PKWT', level: 'Non Staff', masuk: TODAY },
    fields, danger: p ? { label: 'Hapus data' } : null,
    onSave: (v) => commit((S) => {
      const L = kind === 'out' ? S.keluar : S.aktif;
      const rec = { nama: v.nama, jabatan: v.jabatan, dept: v.dept, level: v.level, kontrak: v.kontrak, masuk: v.masuk, akhir: v.akhir, poh: v.poh, jk: v.jk, kategori: v.kategori, site: v.site };
      if (kind === 'out') rec.keluar = v.keluar;
      if (p) L[idx] = { ...L[idx], ...rec }; else L.push(rec);
      if (!p && v.fill !== null && v.fill !== undefined && v.fill !== '') { const pos = S.positions[+v.fill]; if (pos) pos.nama = v.nama; }
    }, p ? 'Data karyawan diperbarui.' : 'Karyawan ditambahkan.'),
  });
  if (p) FORM.dangerFn = () => confirmBox(`Hapus ${p.nama} dari ${kind === 'out' ? 'MP Out' : 'MP Aktif'}?`, 'Data ini akan dihapus permanen dari web.', () => commit((S) => { (kind === 'out' ? S.keluar : S.aktif).splice(idx, 1); }, 'Data dihapus.'));
}
function mpOutForm(idx) {
  const p = DATA.aktif[idx];
  const match = DATA.positions.map((x, i) => [x, i]).filter(([x]) => !isVacant(x) && (normName(x.nama) === normName(p.nama) || normName(p.nama).startsWith(normName(x.nama)) || normName(x.nama).startsWith(normName(p.nama))));
  const opts = [['', 'Tidak mengubah MPP']].concat(DATA.positions.map((x, i) => [x, i]).filter(([x]) => !isVacant(x)).map(([x, i]) => [String(i), `No. ${x.no} · ${x.nama} · ${x.jabatan}`]));
  openForm({
    eyebrow: 'MP Aktif → MP Out', title: `Pindahkan ${p.nama} ke MP Out`, submit: 'Pindahkan ke MP Out',
    intro: 'Data dipindah ke MP Out dan dihapus dari MP Aktif. Posisinya di MPP bisa langsung dijadikan Vacant.',
    values: { keluar: TODAY, pos: match.length ? String(match[0][1]) : '' },
    fields: [{ k: 'keluar', label: 'Tanggal Keluar', type: 'date', req: true }, { k: 'pos', label: 'Jadikan Vacant di MPP', type: 'select', options: opts, full: true }],
    onSave: (v) => commit((S) => {
      const [rec] = S.aktif.splice(idx, 1); rec.keluar = v.keluar; S.keluar.push(rec);
      if (v.pos !== null && v.pos !== '') { const pos = S.positions[+v.pos]; if (pos) Object.assign(pos, { nama: 'Vacant', ket: null, pic: null, ptk: null, aju: null, stages: [null, null, null, null, null, null, null], due: null, status: null, close: null, hist: [] }); }
    }, `${p.nama} dipindahkan ke MP Out.`),
  });
}
function unitForm(idx) {
  const u = idx == null ? null : DATA.units[idx];
  openForm({ eyebrow: 'Populasi Unit', title: u ? `Edit ${u.unit}` : 'Tambah Jenis Unit', values: u ? { ...u } : { jumlah: 1 },
    fields: [{ k: 'unit', label: 'Jenis Unit', req: true }, { k: 'jumlah', label: 'Jumlah', type: 'number', req: true }],
    danger: u ? { label: 'Hapus unit' } : null,
    onSave: (v) => commit((S) => { const rec = { unit: v.unit, jumlah: v.jumlah }; if (u) S.units[idx] = rec; else S.units.push(rec); }, u ? 'Unit diperbarui.' : 'Unit ditambahkan.') });
  if (u) FORM.dangerFn = () => confirmBox(`Hapus ${u.unit}?`, '', () => commit((S) => { S.units.splice(idx, 1); }, 'Unit dihapus.'));
}
function confirmBox(title, sub, fn) {
  openForm({ eyebrow: 'Konfirmasi', title, intro: sub, values: {}, fields: [], submit: 'Ya, hapus', onSave: fn });
  document.querySelector('#frm button[type="submit"]').className = 'btn btn-d';
}

// ---------- export / print ----------
function csvOf(head, rows) { const q = (v) => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }; return '﻿' + [head].concat(rows).map((r) => r.map(q).join(',')).join('\r\n'); }
async function save(filename, data) {
  if (!DL) { toast('Unduhan tidak tersedia di tampilan ini.', true); return; }
  try { await DL.save({ filename, data }); } catch (e) { if (e && e.code !== 'declined') toast('File tidak bisa disimpan di sini' + (e.message ? ': ' + e.message : '.'), true); }
}
const MPP_HEAD = ['No', 'Section', 'Sub-section', 'Nama', 'Jabatan', 'Keterangan', 'PIC', 'PTK', 'Tanggal Pengajuan PTK', 'Psikologi Test', 'Interview User', 'Offering Latter', 'MCU', 'FU MCU', 'On Site', 'Induksi', 'Due Date', 'Status', 'Tanggal Close', 'Keterangan PTK', 'Lama Closing (Hari)'];
const mppRow = (p) => [p.no, p.section, p.group, p.nama, p.jabatan, p.ket, p.pic, p.ptk, p.aju, ...p.stages, p.due, p.status, p.close, ketPTK(p), isClose(p) ? diff(p.close, p.aju) : ''];
const MP_HEAD = ['No', 'Nama', 'Jabatan', 'Departemen', 'Level', 'Status Kontrak', 'Tanggal Masuk', 'Akhir Kontrak', 'POH', 'Jenis Kelamin', 'Keterangan', 'Site'];
const mpRow = (p, i) => [i + 1, p.nama, p.jabatan, p.dept, p.level, p.kontrak, p.masuk, p.akhir, p.poh, p.jk, p.kategori, p.site];
function exportCSV(kind) {
  if (kind === 'mpp') return save('MPP_KTA-TRA.csv', csvOf(MPP_HEAD, DATA.positions.map(mppRow)));
  if (kind === 'aktif') return save('MP_Aktif_KTA-TRA.csv', csvOf(MP_HEAD, DATA.aktif.map(mpRow)));
  if (kind === 'out') return save('MP_Out_KTA-TRA.csv', csvOf(MP_HEAD.concat(['Tanggal Keluar']), DATA.keluar.map((p, i) => mpRow(p, i).concat([p.keluar]))));
  if (kind === 'unit') return save('Populasi_Unit_KTA-TRA.csv', csvOf(['No', 'Jenis Unit', 'Jumlah'], DATA.units.map((u, i) => [i + 1, u.unit, u.jumlah])));
}
function exportXLSX() {
  if (typeof XLSX === 'undefined') { toast('Pembuat Excel belum termuat. Coba lagi sebentar.', true); return; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([MPP_HEAD].concat(DATA.positions.map(mppRow))), 'MPP KTA-TRA');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([MP_HEAD].concat(DATA.aktif.map(mpRow))), 'MP Aktif');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([MP_HEAD.concat(['Tanggal Keluar'])].concat(DATA.keluar.map((p, i) => mpRow(p, i).concat([p.keluar])))), 'MP Out');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Jenis Unit', 'Jumlah']].concat(DATA.units.map((u) => [u.unit, u.jumlah]))), 'Populasi Unit');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  save(`Monitoring_Manpower_KTA-TRA_${TODAY}.xlsx`, new Blob([buf]));
}
async function printFallback() {
  const css = document.getElementById('css').textContent;
  const S = '<' + 'script', E = '</' + 'script>';
  const title = PAGES.find((p) => p.id === ui.page).label;
  const doc = '<!doctype html><html><head><meta charset="utf-8"><title>' + title + ' KTA-TRA</title>'
    + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">'
    + '<style>' + css + ' .main{margin:0}.content{max-width:none;padding:16px}.tw{overflow:visible!important}#printBtn,.acts,.btn{display:none!important}@page{size:A4;margin:10mm}@media print{.card,.kpi,.rcard,tr{break-inside:avoid}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>'
    + '<div class="main"><main class="content">' + document.getElementById('view').innerHTML + '</main></div>'
    + S + '>window.onload=function(){setTimeout(function(){window.print()},600)}' + E + '</body></html>';
  toast('PDF langsung tidak bisa dibuat di sini. Simpan file versi cetak, lalu buka untuk Print.');
  await save(title.replace(/[^A-Za-z0-9]+/g, '_') + '_KTA-TRA_' + TODAY + '_print.html', doc);
}
async function printPDF() {
  let top = false; try { top = window.top === window.self; } catch (e) { top = false; }
  if (top) { window.print(); return; }
  if (typeof html2canvas === 'undefined' || !window.jspdf) { toast('Modul print belum termuat. Coba lagi sebentar.', true); return; }
  const btn = document.getElementById('printBtn'); if (btn) btn.disabled = true;
  toast('Menyiapkan PDF…');
  try {
    const el = document.getElementById('view');
    document.body.classList.add('printing');
    const svgs = [...el.querySelectorAll('svg')].map((s) => { const r = s.getBoundingClientRect(); const prev = [s.getAttribute('width'), s.getAttribute('height')]; s.setAttribute('width', Math.round(r.width)); s.setAttribute('height', Math.round(r.height)); return [s, prev]; });
    const base = el.getBoundingClientRect().top, elH = el.getBoundingClientRect().height;
    const blocks = [...el.querySelectorAll('tr, .kpi, .rcard, .mstats > div, .app, .sbx > div, .units > div, .hb, .cc, .chart, .donut, .legend, .head, .mhead, .ch, .fchip, .toolbar, p, h1, h2, .eyebrow, .pg, .plist > div, .kl > div')]
      .map((e) => { const r = e.getBoundingClientRect(); return [r.top - base, r.bottom - base]; }).filter(([a, b]) => b > a);
    let canvas;
    try { canvas = await html2canvas(el, { scale: 2, backgroundColor: '#F2F1FA', useCORS: true, onclone: (d) => d.body.classList.add('printing') }); }
    finally { svgs.forEach(([s, [w, h]]) => { if (w === null) s.removeAttribute('width'); else s.setAttribute('width', w); if (h === null) s.removeAttribute('height'); else s.setAttribute('height', h); }); }
    document.body.classList.remove('printing');
    const pdf = new window.jspdf.jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const stampImg = await stampForPdf();
    const pw = 210, ph = 297, m = 8, iw = pw - m * 2;
    const pxPerMm = canvas.width / iw, pageH = Math.floor((ph - m * 2) * pxPerMm);
    const k = canvas.height / elH;
    const iv = blocks.map(([a, b]) => [a * k, b * k]);
    const cands = [...new Set(iv.flatMap(([a, b]) => [Math.round(a), Math.round(b)]))].sort((a, b) => a - b);
    const safe = (c) => !iv.some(([a, b]) => c > a + 2 && c < b - 2);
    for (let y = 0, pg = 0; y < canvas.height - 4; pg++) {
      let end = y + pageH;
      if (end >= canvas.height) end = canvas.height;
      else {
        let best = -1;
        for (const c of cands) { if (c > y + pageH * 0.35 && c <= y + pageH && safe(c)) best = c; }
        if (best > 0) end = best;
      }
      const h = end - y;
      const c = document.createElement('canvas'); c.width = canvas.width; c.height = h;
      c.getContext('2d').drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (pg) pdf.addPage();
      pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', m, m, iw, h / pxPerMm);
      if (stampImg) { try { pdf.saveGraphicsState(); pdf.setGState(new pdf.GState({ opacity: stampImg.op })); pdf.addImage(stampImg.url, 'PNG', (pw - stampImg.w) / 2, (ph - stampImg.h) / 2, stampImg.w, stampImg.h); pdf.restoreGraphicsState(); } catch (er) {} }
      y = end;
    }
    const name = PAGES.find((p) => p.id === ui.page).label.replace(/[^A-Za-z0-9]+/g, '_');
    await save(`${name}_KTA-TRA_${TODAY}.pdf`, pdf.output('blob'));
  } catch (e) { document.body.classList.remove('printing'); await printFallback(); }
  finally { if (btn) btn.disabled = false; }
}

// ---------- overrides: header & pages with edit controls ----------
function header(eyebrow, title, desc) {
  const d = new Date();
  return `<div class="head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${desc}</p></div>
    <div class="head-r"><div class="upd"><i></i><div><small>Update hari ini</small><b>${DAYS_L[d.getDay()]}, ${d.getDate()} ${MONTHS_L[d.getMonth()]} ${d.getFullYear()}</b></div></div>
    ${(DL || IS_TOP) ? `<button type="button" class="btn btn-g" id="printBtn" title="Simpan halaman ini sebagai PDF untuk dicetak"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>Print</button>` : ''}</div></div>
    ${STATE.meta && STATE.meta.updated ? `<p class="small" style="margin:-8px 0 14px">Data terakhir diubah ${fmt(STATE.meta.updated)}${STATE.meta.source ? ' · ' + esc(STATE.meta.source) : ''}</p>` : ''}`;
}
const editBtn = (attr, label = 'Edit') => CAN_EDIT ? `<button type="button" class="ab" ${attr} title="${label}" aria-label="${label}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></button>` : '';

function pageMPP(D) {
  const q = ui.mq.toLowerCase();
  const idxs = D.P.map((p, i) => [p, i]).filter(([p]) => {
    if (ui.mf !== 'semua') { if (!hasPTK(p) || (p.status || '').toLowerCase() !== ui.mf) return false; }
    return !q || `${p.nama} ${p.jabatan} ${p.section} ${p.group} ${p.ket} ${p.ptk}`.toLowerCase().includes(q);
  });
  const cols = 19 + (CAN_EDIT ? 1 : 0);
  let body = '', lastS, lastG;
  idxs.forEach(([p, i]) => {
    if (ui.mf === 'semua' && !q) {
      if (p.section !== lastS) { body += `<tr class="grpr"><td colspan="${cols}">${esc(p.section || '')}</td></tr>`; lastS = p.section; lastG = p.section; }
      if (p.group !== lastG) { body += `<tr class="subr"><td colspan="${cols}">${esc(p.group)}</td></tr>`; lastG = p.group; }
    }
    const k = ketPTK(p); const kc = { 'JATUH TEMPO': 'crit', 'HAMPIR JATUH TEMPO': 'warn', 'ON TRACK': 'good', 'SELESAI': 'info' }[k] || 'mute';
    const st = (v) => isDate(v) ? fmt(v) : esc(v || '');
    body += `<tr>${CAN_EDIT ? `<td>${editBtn(`data-epos="${i}"`)}</td>` : ''}<td class="n">${p.no}</td><td class="${isVacant(p) ? 'vac' : 'b'}">${esc(p.nama)}</td><td class="nw">${esc(p.jabatan)}</td><td class="ket">${esc(p.ket || '')}</td><td class="nw">${esc(p.pic || '')}</td><td class="small nw">${esc(p.ptk || '')}</td><td class="nw">${p.aju ? fmt(p.aju) : ''}</td>${p.stages.map((v) => `<td class="nw">${st(v)}</td>`).join('')}<td class="nw">${p.due ? fmt(p.due) : ''}</td><td>${hasPTK(p) ? `<span class="stt ${/close/i.test(p.status) ? 'close' : /continue/i.test(p.status) ? 'cont' : 'open'}">${esc(p.status)}</span>` : ''}</td><td class="nw">${p.close ? fmt(p.close) : ''}</td><td><span class="dd ${kc}">${esc(k)}</span></td><td class="n">${isClose(p) ? (diff(p.close, p.aju) ?? '') : ''}</td></tr>`;
  });
  const cnt = (s) => D.P.filter((p) => hasPTK(p) && (p.status || '').toLowerCase() === s).length;
  const all = D.allCands, c = (s) => all.filter((x) => x.st === s).length;
  const pq = ui.pq.toLowerCase();
  const prow = all.filter((x) => (ui.pf === 'semua' || x.st === ui.pf) && (!pq || `${x.name} ${x.p.jabatan} ${x.note}`.toLowerCase().includes(pq))).sort((a, b) => (isOpen(b.p) - isOpen(a.p)) || (a.p.no - b.p.no));
  return `${header('Monitoring', 'MPP KTA - TRA', 'Planning manpower dan monitoring PTK/rekrutmen.')}
  <div class="card" style="margin-bottom:18px">
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Filter status">${[['semua', 'Semua Status'], ['open', `Open (${cnt('open')})`], ['continue', `Continue (${cnt('continue')})`], ['close', `Close (${cnt('close')})`]].map(([k, l]) => `<button type="button" data-mf="${k}" aria-pressed="${ui.mf === k}">${l}</button>`).join('')}</div>
      <input type="search" id="mq" placeholder="Cari nama, jabatan, PTK, atau kandidat" value="${esc(ui.mq)}" aria-label="Cari di MPP">
      ${CAN_EDIT ? '<button type="button" class="btn btn-p" id="addPos">+ Tambah Data</button>' : ''}
      ${DL ? '<button type="button" class="btn btn-g" data-csv="mpp">Export CSV</button>' : ''}
    </div>
    <div class="small" style="margin:-4px 0 10px">${idxs.length} dari ${D.P.length} posisi${CAN_EDIT ? ' · klik ikon pensil untuk mengedit posisi, kandidat, dan tanggal progress' : ''}</div>
    <div class="tw"><table class="t mpp full"><thead><tr>${CAN_EDIT ? '<th>Aksi</th>' : ''}<th>No</th><th>Nama</th><th>Jabatan</th><th>Keterangan</th><th>PIC</th><th>PTK</th><th>Tanggal Pengajuan PTK</th><th>Psikologi Test</th><th>Interview User</th><th>Offering Latter</th><th>MCU</th><th>FU MCU</th><th>On Site</th><th>Induksi</th><th>Due Date</th><th>Status</th><th>Tanggal Close</th><th>Keterangan PTK</th><th class="n">Lama Closing (Hari)</th></tr></thead>
    <tbody>${body || `<tr><td colspan="${cols}" class="empty">Tidak ada data yang cocok.</td></tr>`}</tbody></table></div>
  </div>
  <div class="card">
    <div class="ch"><div><div class="eyebrow">Pelamar</div><h2>Rekap & Arsip Pelamar</h2><p>Dibaca dari kolom Keterangan. Pelamar yang tidak lolos tetap tercatat, termasuk setelah PTK close.</p></div></div>
    <div class="apps" style="margin-bottom:16px"><div class="app"><b>${all.length}</b><span>Total pelamar</span></div><div class="app pr"><b>${c('pr')}</b><span>Masih proses</span></div><div class="app hd"><b>${c('hd')}</b><span>Hold</span></div><div class="app no"><b>${c('no')}</b><span>Tidak lolos</span></div><div class="app ok"><b>${c('ok')}</b><span>Diterima</span></div></div>
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Filter hasil">${[['semua', 'Semua'], ['pr', 'Proses'], ['hd', 'Hold'], ['no', 'Tidak lolos'], ['ok', 'Diterima']].map(([k, l]) => `<button type="button" data-pf="${k}" aria-pressed="${ui.pf === k}">${l}</button>`).join('')}</div>
      <input type="search" id="pq" placeholder="Cari nama pelamar atau jabatan" value="${esc(ui.pq)}" aria-label="Cari pelamar">
      <span class="small">${prow.length} pelamar</span>
    </div>
    <div class="tw"><table class="t"><thead><tr><th>Nama Pelamar</th><th>Jabatan</th><th>PTK</th><th>Status PTK</th><th>Tahap</th><th>Hasil</th><th>Keterangan</th></tr></thead><tbody>
    ${prow.map((x) => `<tr><td class="b">${esc(x.name)}</td><td class="nw">${esc(x.p.jabatan)} <span class="small">No. ${x.p.no}</span></td><td class="small nw">${esc(x.p.ptk)}</td><td><span class="stt ${isOpen(x.p) ? 'open' : 'close'}">${esc(x.p.status)}</span></td><td class="small nw">${isOpen(x.p) ? STAGE_UP[stageIdx(x.p)] : 'Close ' + fmt(x.p.close)}</td><td><span class="hs ${x.st}">${ST_LBL[x.st]}</span>${x.fromHist ? ' <span class="hs hist">riwayat</span>' : ''}</td><td class="small">${esc(x.note || x.reason || '-')}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Tidak ada pelamar yang cocok.</td></tr>'}
    </tbody></table></div>
    <p class="note">Format kolom Keterangan: satu baris per pelamar, <b>Nama - keterangan</b> (contoh: <i>Budi - Tidak lolos interview user</i>, <i>Andi - HOLD</i>). Saat PTK close, biarkan nama pelamar yang gagal tetap di Keterangan dan tambahkan nama yang diterima, supaya arsipnya tetap lengkap.</p>
  </div>`;
}
function pageKaryawan(D) {
  const out = ui.kt === 'out';
  const src = out ? DATA.keluar : DATA.aktif, q = ui.kq.toLowerCase();
  const rows = src.map((p, i) => [p, i]).filter(([p]) => !q || `${p.nama} ${p.jabatan} ${p.poh}`.toLowerCase().includes(q));
  const cols = MP_COLS.filter((c) => ui.allCols || c[3]).filter((c) => !(out && c[0] === 'sisa'));
  if (out) cols.push(['keluar', 'Tanggal Keluar', (p) => p.keluar ? fmt(p.keluar) : '']);
  const act = (p, i) => !CAN_EDIT ? '' : `<td class="nw"><span class="acts">${editBtn(`data-emp="${out ? 'out' : 'aktif'}:${i}"`)}${out ? '' : `<button type="button" class="ab out" data-mpout="${i}" title="Pindahkan ke MP Out">MP OUT</button>`}</span></td>`;
  return `${header('Database', out ? 'MP Out' : 'MP Aktif', 'Database manpower KTA - TRA. Data lengkap dapat disinkronkan dari Excel.')}
  <div class="card"><div class="toolbar">
    <div class="seg" role="group" aria-label="Pilih data">${[['aktif', `MP Aktif (${DATA.aktif.length})`], ['out', `MP Out (${DATA.keluar.length})`]].map(([k, l]) => `<button type="button" data-kt="${k}" aria-pressed="${ui.kt === k}">${l}</button>`).join('')}</div>
    <input type="search" id="kq" placeholder="Cari nama, jabatan, atau POH" value="${esc(ui.kq)}" aria-label="Cari karyawan">
    ${CAN_EDIT ? '<button type="button" class="btn btn-g" data-sync="1">Sinkronkan Excel</button>' : ''}
    <button type="button" class="btn btn-g" id="colBtn" aria-pressed="${!!ui.allCols}">${ui.allCols ? 'Kolom Ringkas' : 'Semua Kolom'}</button>
    ${CAN_EDIT ? `<button type="button" class="btn btn-p" data-addmp="${out ? 'out' : 'aktif'}">+ Tambah Data</button>` : ''}
    ${DL ? `<button type="button" class="btn btn-g" data-csv="${out ? 'out' : 'aktif'}">Export CSV</button>` : ''}
  </div>
  <div class="small" style="margin:-4px 0 10px">${src.length} data</div>
  <div class="tw"><table class="t mpp"><thead><tr>${CAN_EDIT ? '<th>Aksi</th>' : ''}${cols.map((c) => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>
  ${rows.map(([p, i]) => `<tr>${act(p, i)}${cols.map((c) => `<td class="nw">${c[2](p, i)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length + 1}" class="empty">Tidak ada data.</td></tr>`}
  </tbody></table></div>
  <p class="note">MP Aktif → MP Out terhubung. ${CAN_EDIT ? 'Gunakan tombol <b>MP OUT</b> pada data aktif untuk memindahkan data ke MP Out sekaligus membuat posisi yang sesuai di MPP menjadi Vacant. ' : ''}Data pribadi (NIK, KK, NPWP, nomor HP, rekening, BPJS, alamat, data keluarga) tidak disimpan di web ini.</p></div>`;
}
function pageUnit(D) {
  return `${header('Database', 'Populasi Unit KTA - TRA', 'Daftar populasi unit operasional KTA - TRA sesuai data monitoring.')}
  <div class="card"><div class="ch"><div><div class="eyebrow">Populasi Unit</div><h2>Daftar Unit KTA - TRA</h2><p>Terhubung dengan data unit pada Dashboard.</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="pill">${D.unitTot} unit</span>${CAN_EDIT ? '<button type="button" class="btn btn-p" id="addUnit">+ Tambah Jenis Unit</button>' : ''}${DL ? '<button type="button" class="btn btn-g" data-csv="unit">Export CSV</button>' : ''}</div></div>
  <div class="tw"><table class="t mpp"><thead><tr>${CAN_EDIT ? '<th>Aksi</th>' : ''}<th>No</th><th>Jenis Unit</th><th class="n">Jumlah</th><th>Porsi</th></tr></thead><tbody>
  ${DATA.units.map((u, i) => `<tr>${CAN_EDIT ? `<td>${editBtn(`data-eunit="${i}"`)}</td>` : ''}<td class="n">${i + 1}</td><td class="b">${esc(u.unit)}</td><td class="n">${u.jumlah}</td><td><div class="pg"><span class="tr"><i style="width:${D.unitTot ? u.jumlah / D.unitTot * 100 : 0}%"></i></span><b>${D.unitTot ? Math.round(u.jumlah / D.unitTot * 100) : 0}%</b></div></td></tr>`).join('')}
  <tr>${CAN_EDIT ? '<td></td>' : ''}<td></td><td class="b">Total</td><td class="n b">${D.unitTot}</td><td></td></tr>
  </tbody></table></div></div>`;
}
function pageSetting(D) {
  return `${header('Sistem', 'Pengaturan', 'Pemilik, editor, sinkronisasi, backup, dan download Excel.')}
  <div class="grid">
    <div class="card s6"><div class="ch"><div><div class="eyebrow">Akses</div><h2>Pemilik & Editor</h2></div><span class="pill ${CAN_EDIT ? 'live' : ''}">${ROLE}</span></div>
      <div class="role"><b>Pemilik</b><span>Akun Claude yang membuat web ini. Bisa mengedit semua data dan menentukan siapa saja editornya.</span></div>
      <div class="role"><b>Editor</b><span>Orang yang diberi akses edit oleh pemilik. Bisa mengubah data posisi yang sudah ada, mengelola pelamar, upload berkas, dan menata Struktur Organisasi. Menambah / menghapus posisi, membuat nama section / sub-section / jabatan baru, sinkron Excel, dan pulihkan backup hanya oleh Pemilik.</span></div>
      <div class="role"><b>Pelihat</b><span>Semua orang lain yang membuka link. Bisa melihat, mencari, print, dan export, tanpa bisa mengubah data.</span></div>
      <p class="small" style="margin:12px 0 0">${IS_OWNER ? 'Anda masuk sebagai <b style="color:var(--good)">Pemilik</b>.' : CAN_EDIT ? 'Anda masuk sebagai <b style="color:var(--good)">Editor</b>. Tombol Tambah, Edit, dan Hapus aktif di setiap halaman.' : 'Anda melihat sebagai <b>Pelihat</b>. Minta pemilik memberi Anda akses edit jika perlu mengubah data.'}</p></div>
    <div class="card s6"><div class="ch"><div><div class="eyebrow">Editor</div><h2>Cara menambah editor</h2><p>Editor ditambahkan dari menu berbagi di Claude, bukan dari halaman ini.</p></div></div>
      <ol class="steps2"><li>Buka web ini di <b>claude.ai</b> dengan akun pemilik.</li><li>Klik tombol <b>Share</b> di pojok kanan atas halaman.</li><li>Undang orangnya (nama atau email), lalu pilih akses <b>Can edit / Editor</b>.</li><li>Setelah dia membuka link dan login, label di pojok kanan atas berubah menjadi <b>Editor</b> dan tombol edit muncul.</li></ol>
      <p class="small" style="margin:10px 0 0">Untuk mencabut akses, ubah orang itu kembali menjadi pelihat atau hapus dari daftar di menu Share. Semua perubahan tercatat sebagai versi baru halaman.</p></div>
    <div class="card s6"><div class="ch"><div><div class="eyebrow">Sinkronisasi</div><h2>Sinkronkan Excel</h2><p>Ganti seluruh data web dengan isi file Excel Monitoring Manpower KTA - TRA (sheet DASHBOARD, MPP KTA-TRA, MP Aktif, MP Out). Pelamar yang hilang dari Keterangan tetap disimpan sebagai riwayat.</p></div></div>
      ${CAN_EDIT ? '<button type="button" class="btn btn-p" data-sync="1">Sinkronkan Excel</button>' : '<p class="small" style="margin:0">Hanya pemilik yang bisa menyinkronkan Excel.</p>'}</div>
    <div class="card s6"><div class="ch"><div><div class="eyebrow">Download</div><h2>Download Excel</h2><p>Unduh data terbaru dari web dalam format .xlsx (MPP, MP Aktif, MP Out, Populasi Unit).</p></div></div>
      ${DL ? '<button type="button" class="btn btn-g" id="xlsxBtn">Download Excel</button>' : '<p class="small" style="margin:0">Unduhan tidak tersedia di tampilan ini.</p>'}</div>
    <div class="card s6"><div class="ch"><div><div class="eyebrow">Backup</div><h2>Backup & Pulihkan</h2><p>Simpan cadangan seluruh data (.json) dan pulihkan bila perlu.</p></div></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">${DL ? '<button type="button" class="btn btn-g" id="bkBtn">Download Backup</button>' : ''}${CAN_EDIT ? '<button type="button" class="btn btn-g" id="rsBtn">Pulihkan dari Backup</button>' : ''}</div>
      <input type="file" id="rsIn" accept=".json,application/json" hidden></div>
  </div>`;
}

// ---------- render & events ----------
let D;
function render() {
  D = derive();
  let lastG = '';
  const ct = { mpp: [D.open.length, D.ket['JATUH TEMPO'] > 0], karyawan: [DATA.aktif.length, false], unit: [D.unitTot, false] };
  document.getElementById('nav').innerHTML = PAGES.map((pg) => {
    const lbl = pg.grp !== lastG ? `<div class="lbl">${pg.grp}</div>` : ''; lastG = pg.grp;
    const c = ct[pg.id];
    return `${lbl}<button type="button" data-go="${pg.id}" ${ui.page === pg.id ? 'aria-current="page"' : ''}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">${pg.ic}</svg>${pg.label}${c ? `<span class="ct ${c[1] ? 'al' : ''}">${c[0]}</span>` : ''}</button>`;
  }).join('');
  document.getElementById('roleTag').textContent = ROLE;
  document.getElementById('roleTag').className = 'pill' + (CAN_EDIT ? ' live' : '');
  document.getElementById('upBtn').hidden = !CAN_EDIT;
  const map = { dashboard: pageDashboard, mpp: pageMPP, unit: pageUnit, karyawan: pageKaryawan, setting: pageSetting };
  document.getElementById('view').innerHTML = map[ui.page](D);
}
function go(id) {
  ui.page = id; store.set('mp5-page', id); try { history.replaceState(null, '', '#' + id); } catch (e) {}
  document.body.classList.remove('nav-open'); document.getElementById('scrim').hidden = true;
  render(); window.scrollTo({ top: 0 });
}
function keepFocus(id) { const el = document.getElementById(id); const pos = el && el.selectionStart; render(); const n = document.getElementById(id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }
function openDetail(jab) {
  FORM = null;
  const ps = D.vacJab[jab] || [];
  document.getElementById('dialog').innerHTML = `<button type="button" class="x" id="mClose" aria-label="Tutup">×</button><div class="eyebrow">Vacant detail</div><h2 id="mTitle" style="font-size:19px">${esc(jab)}</h2><p class="small" style="margin:2px 0 0">${ps.length} vacant</p>
  ${ps.map((p) => { const si = stageIdx(p), r = diff(p.due, TODAY), cs = candidates(p);
    return `<div class="pos"><h4>No. ${p.no} · ${esc(p.group || p.section || '')}</h4><div class="small">${esc(p.ptk || 'Belum ada PTK')} · Pengajuan ${fmt(p.aju)} · Due ${fmt(p.due)} ${r !== null ? `<span class="dd ${r <= 0 ? 'crit' : r <= 7 ? 'warn' : 'good'}">${r <= 0 ? 'Lewat ' + -r + ' hari' : r + ' hari lagi'}</span>` : ''}</div>
    <div class="pg" style="margin:10px 0"><span class="tr"><i style="width:${STAGE_PCT[si]}%"></i></span><b>${STAGE_UP[si]} ${STAGE_PCT[si]}%</b></div>
    ${cs.length ? `<div class="kl">${cs.map((c) => `<div><span class="nm ${c.st === 'no' ? 'off' : ''}">${esc(c.name)}</span><span class="st ${c.st}">${candStatusText(c, p)}</span></div>`).join('')}</div>` : '<div class="small">Belum ada pelamar.</div>'}
    ${CAN_EDIT ? `<button type="button" class="btn btn-g" style="margin-top:10px" data-epos="${DATA.positions.indexOf(p)}">Edit posisi & kandidat</button>` : ''}</div>`; }).join('')}`;
  document.getElementById('modal').hidden = false; document.getElementById('mClose').focus();
}
const closeModal = () => { document.getElementById('modal').hidden = true; FORM = null; };

document.addEventListener('click', (e) => {
  const t = e.target;
  const g = t.closest('[data-go]'); if (g) { go(g.dataset.go); return; }
  if (t.closest('#menuBtn')) { const o = document.body.classList.toggle('nav-open'); document.getElementById('scrim').hidden = !o; return; }
  if (t.id === 'scrim') { document.body.classList.remove('nav-open'); t.hidden = true; return; }
  if (t.closest('#printBtn')) { printPDF(); return; }
  if (t.closest('#upBtn') || t.closest('[data-sync]')) { if (CAN_EDIT) document.getElementById('fileIn').click(); return; }
  if (t.closest('#colBtn')) { ui.allCols = !ui.allCols; render(); return; }
  if (t.closest('#fCancel') || t.id === 'mClose' || t.id === 'modal') { closeModal(); return; }
  if (t.closest('#fDanger') && FORM && FORM.dangerFn) { FORM.dangerFn(); return; }
  const ep = t.closest('[data-epos]'); if (ep && CAN_EDIT) { mppForm(+ep.dataset.epos); return; }
  if (t.closest('#addPos') && CAN_EDIT) { mppForm(null); return; }
  const em = t.closest('[data-emp]'); if (em && CAN_EDIT) { const [k, i] = em.dataset.emp.split(':'); mpForm(k, +i); return; }
  const am = t.closest('[data-addmp]'); if (am && CAN_EDIT) { mpForm(am.dataset.addmp, null); return; }
  const mo = t.closest('[data-mpout]'); if (mo && CAN_EDIT) { mpOutForm(+mo.dataset.mpout); return; }
  const eu = t.closest('[data-eunit]'); if (eu && CAN_EDIT) { unitForm(+eu.dataset.eunit); return; }
  if (t.closest('#addUnit') && CAN_EDIT) { unitForm(null); return; }
  const cv = t.closest('[data-csv]'); if (cv) { exportCSV(cv.dataset.csv); return; }
  if (t.closest('#xlsxBtn')) { exportXLSX(); return; }
  if (t.closest('#bkBtn')) { save(`Backup_Manpower_KTA-TRA_${TODAY}.json`, JSON.stringify(STATE, null, 1)); return; }
  if (t.closest('#rsBtn') && CAN_EDIT) { document.getElementById('rsIn').click(); return; }
  const dt = t.closest('[data-detail]'); if (dt) { openDetail(dt.dataset.detail); return; }
  const pf = t.closest('[data-pf]'); if (pf) { ui.pf = pf.dataset.pf; render(); return; }
  const mf = t.closest('[data-mf]'); if (mf) { ui.mf = mf.dataset.mf; render(); return; }
  const kt = t.closest('[data-kt]'); if (kt) { ui.kt = kt.dataset.kt; render(); return; }
});
document.addEventListener('input', (e) => {
  const id = e.target.id;
  if (id === 'pq') { ui.pq = e.target.value; keepFocus(id); }
  if (id === 'mq') { ui.mq = e.target.value; keepFocus(id); }
  if (id === 'kq') { ui.kq = e.target.value; keepFocus(id); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); document.body.classList.remove('nav-open'); document.getElementById('scrim').hidden = true; } });
document.addEventListener('change', async (e) => {
  if (e.target.id === 'rsIn') {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || !Array.isArray(d.positions) || !Array.isArray(d.aktif)) throw new Error('File ini bukan backup Monitoring Manpower.');
      openForm({ eyebrow: 'Pulihkan', title: 'Ganti semua data dengan backup ini?', intro: `${d.positions.length} posisi MPP, ${d.aktif.length} MP Aktif, ${(d.keluar || []).length} MP Out, ${(d.units || []).length} jenis unit.`, values: {}, fields: [], submit: 'Pulihkan',
        onSave: () => commit((S) => { S.positions = d.positions; S.aktif = d.aktif; S.keluar = d.keluar || []; S.units = d.units || []; S.meta = { ...(d.meta || {}), source: 'Dipulihkan dari backup' }; }, 'Data dipulihkan dari backup.') });
    } catch (er) { toast(er.message || 'Backup tidak bisa dibaca.', true); }
  }
});
document.getElementById('fileIn').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0]; e.target.value = '';
  if (!file || !CAN_EDIT) return;
  if (typeof XLSX === 'undefined') { toast('Pembaca Excel belum termuat. Coba lagi sebentar.', true); return; }
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheets = {};
    wb.SheetNames.forEach((n) => {
      const ws = wb.Sheets[n]; if (!ws['!ref']) { sheets[n] = []; return; }
      const rg = XLSX.utils.decode_range(ws['!ref']); const rows = [];
      for (let r = 0; r <= Math.min(rg.e.r, 1500); r++) { const row = []; for (let c = 0; c <= Math.min(rg.e.c, 60); c++) { const cell = ws[XLSX.utils.encode_cell({ r, c })]; row.push(cell && cell.t !== 'e' ? cell.v : null); } rows.push(row); }
      sheets[n] = rows;
    });
    const parsed = mergeHistory(STATE, parseSheets(sheets));
    if (!parsed.positions.length) throw new Error('Tidak ada posisi yang terbaca di sheet MPP. Pastikan kolom No, Nama, Jabatan masih di kolom A–C.');
    openForm({ eyebrow: 'Sinkronkan Excel', title: `Ganti data web dengan ${file.name}?`, intro: `Terbaca ${parsed.positions.length} posisi MPP, ${parsed.aktif.length} MP Aktif, ${parsed.keluar.length} MP Out, ${parsed.units.length} jenis unit. Perubahan yang dibuat langsung di web akan tertimpa.`, values: {}, fields: [], submit: 'Sinkronkan',
      onSave: () => commit((S) => { S.positions = parsed.positions; S.aktif = parsed.aktif; S.keluar = parsed.keluar; S.units = parsed.units.length ? parsed.units : S.units; S.meta = { source: 'Sinkron dari ' + file.name }; }, 'Data disinkronkan dari Excel.') });
  } catch (err) { toast(err.message || 'File tidak bisa dibaca.', true); }
});

// ---------- boot ----------
render();
try { const f = sessionStorage.getItem('mp5-flash'); if (f) { sessionStorage.removeItem('mp5-flash'); setTimeout(() => toast(f), 300); } } catch (e) {}
(async () => {
  if (!window.claude || !window.claude.use) return;
  try {
    const [u, a, dl] = await Promise.all([claude.use('user'), claude.use('artifact'), claude.use('downloads')]);
    DL = dl || null;
    const owner = u ? await u.isOwner() : false;
    const editor = u ? await u.canEdit() : false;
    IS_OWNER = owner;
    if ((owner || editor) && a) { ART = a; CAN_EDIT = true; ROLE = owner ? 'Pemilik · Editor' : 'Editor'; }
    if (CAN_EDIT) { try { ASSETS = await claude.use('assets'); } catch (e) { ASSETS = null; } }
    render();
  } catch (e) { render(); }
})();
