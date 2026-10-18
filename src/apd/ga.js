'use strict';
// ================= Form GA Request (khusus Pemilik) =================
// Nomor: <prefix>/<bulan romawi>/<tahun>-<urut 3 digit>, contoh HO01/HO-KMB/GA-REG/X/2026-007
const GA_DEF = { prefix: 'HO01/HO-KMB/GA-REG', lokasi: 'HO / JS WS', dept: 'HRGA', notes: '1. GA Req terlampir berdasarkan Material Request Dept. HRGA',
  sign: [{ title: 'Diajukan Oleh,', name: '', dept: 'Dept. HRGA' }, { title: 'Disetujui Oleh,', name: '', dept: '' }, { title: 'Diterima Oleh,', name: '', dept: '' }],
  logo: '', lastSeq: {}, catalog: [] };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const SIG_KEY = 'apd-ga-sig';
const LIBS = { jszip: ['https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'JSZip'] };
let GA_ED = null;

function gaNorm(v) {
  v = v && typeof v === 'object' ? v : {};
  const s = v.settings && typeof v.settings === 'object' ? v.settings : {};
  const sign = [0, 1, 2].map((i) => ({ ...GA_DEF.sign[i], ...((Array.isArray(s.sign) && s.sign[i]) || {}) }));
  return { settings: { ...GA_DEF, ...s, sign, lastSeq: s.lastSeq && typeof s.lastSeq === 'object' ? s.lastSeq : {}, catalog: Array.isArray(s.catalog) ? s.catalog : [] },
    docs: (Array.isArray(v.docs) ? v.docs : []).map((d) => ({ ...d, items: Array.isArray(d.items) ? d.items : [], signDates: Array.isArray(d.signDates) ? d.signDates : [] })) };
}
function gaValidate(g, codes) {
  const nos = new Set();
  for (const d of g.docs) {
    if (!d.id || !d.no || !d.date) return 'Form GA Request harus punya nomor dan tanggal.';
    if (nos.has(d.no)) return 'Nomor GA Request ' + d.no + ' kembar.'; nos.add(d.no);
    if (!d.items.length) return 'Form GA Request ' + d.no + ' belum ada barangnya.';
    for (const it of d.items) {
      if (!String(it.desc || '').trim() || !Number.isInteger(Number(it.qty)) || Number(it.qty) < 1) return 'Setiap baris barang di ' + d.no + ' harus punya deskripsi dan jumlah minimal 1.';
      if (Number(it.price || 0) < 0) return 'Estimasi harga tidak boleh minus.';
      if (it.type && !codes.includes(it.type)) return 'Jenis APD ' + it.type + ' di ' + d.no + ' tidak dikenal.';
    }
  }
  return '';
}
const gaSig = () => { try { return localStorage.getItem(SIG_KEY) || ''; } catch (e) { return ''; } };
const gaSetSig = (v) => { try { if (v) localStorage.setItem(SIG_KEY, v); else localStorage.removeItem(SIG_KEY); } catch (e) {} };
const rp = (n) => (Number(n) || 0).toLocaleString('id-ID');
const dmy = (s) => { const [y, m, d] = String(s || '').slice(0, 10).split('-'); return y && m && d ? `${d}/${m}/${y}` : ''; };
const gaTotal = (d) => d.items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
function gaNextNo(date) {
  const g = S.state.ga, st = g.settings, y = Number(String(date).slice(0, 4)) || new Date().getFullYear(), m = Number(String(date).slice(5, 7)) || 1;
  const used = g.docs.filter((d) => Number(d.year) === y).map((d) => Number(d.seq) || 0);
  const seq = Math.max(Number(st.lastSeq[y]) || 0, ...used, 0) + 1;
  return { seq, year: y, no: `${st.prefix}/${ROMAN[m - 1]}/${y}-${String(seq).padStart(3, '0')}` };
}
// daftar site: jobsite dari Monitoring Manpower + gudang + yang pernah dipakai di Form GA
function gaSites() {
  const g = S.state.ga, raw = [g.settings.lokasi, ...S.people.map((p) => p.site), ...WH, ...g.docs.flatMap((d) => [d.lokasi, ...d.items.map((x) => x.site)])];
  const seen = new Map(); raw.map((x) => String(x || '').trim()).filter((x) => x && x !== '—').forEach((x) => { const k = x.toLowerCase(); if (!seen.has(k)) seen.set(k, x); });
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'id'));
}
function gaDesc(t, v) { const l = tLabel(t); if (!v || v === 'BELUM DIISI') return l; return /^\d+$/.test(v) ? `${l} (${v})` : `${l} ${v}`; }
function loadLib(k) {
  const [url, g] = LIBS[k]; if (window[g]) return Promise.resolve(window[g]);
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = url; s.onload = () => (window[g] ? ok(window[g]) : no(new Error('Modul gagal dimuat'))); s.onerror = () => no(new Error('Modul gagal dimuat. Periksa koneksi.')); document.head.appendChild(s); });
}

// ---------- halaman ----------
function pageGA() {
  const g = S.state.ga, st = g.settings;
  const docs = [...g.docs].sort((a, b) => String(b.date).localeCompare(String(a.date)) || (Number(b.seq) || 0) - (Number(a.seq) || 0));
  const open = docs.filter((d) => d.status !== 'CLOSE').length;
  const waiting = S.state.requests.filter((r) => (r.status === 'pending' || r.status === 'approved') && !r.gaId).length;
  const ready = st.sign.every((x) => x.name);
  const rows = docs.map((d) => `<tr><td class="b nw">${esc(d.no)}</td><td class="nw">${fmt(d.date)}</td><td class="nw">${esc(d.lokasi)}<div class="small">Dept ${esc(d.dept)}</div></td><td style="min-width:240px">${d.items.slice(0, 3).map((it) => `${esc(it.desc)} × ${it.qty}`).join('<br>')}${d.items.length > 3 ? `<div class="small">+${d.items.length - 3} barang lain</div>` : ''}</td><td class="b nw">Rp ${rp(gaTotal(d))}</td><td>${d.status === 'CLOSE' ? `<span class="hs ok">Barang datang</span><div class="small">${fmt(d.receivedAt)}</div>` : `<span class="hs hd">Open</span>${d.due ? `<div class="small ${daysUntil(d.due) < 0 ? 'red' : ''}">Target ${fmt(d.due)}</div>` : ''}`}</td>
    <td class="nw"><button type="button" class="btn btn-p btn-sm" data-gax="${esc(d.id)}">Excel</button> <button type="button" class="btn btn-g btn-sm" data-gapv="${esc(d.id)}">Lihat / PDF</button> <button type="button" class="btn btn-g btn-sm" data-gaed="${esc(d.id)}">Edit</button>${d.status !== 'CLOSE' ? ` <button type="button" class="btn btn-g btn-sm" data-garcv="${esc(d.id)}">Barang Datang</button>` : ''} <button type="button" class="btn btn-g btn-sm red" data-gadel="${esc(d.id)}">Hapus</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Belum ada Form GA Request. Klik <b>+ Buat Form GA</b>.</td></tr>';
  const set = `<div class="card s12"><div class="ch"><div><div class="eyebrow">Format form</div><h2>Pengaturan Form GA Request</h2><p>Kop, nomor urut, catatan, dan nama penanda tangan. Cara tercepat: <b>Ambil dari Form Excel</b> lalu pilih file Form GA Request yang biasa dipakai.</p></div><div class="mtools"><button type="button" class="btn btn-p" id="gaImp">Ambil dari Form Excel</button><button type="button" class="btn btn-g" id="gaSet">Ubah Pengaturan</button></div><input type="file" id="gaImpIn" accept=".xlsx" hidden></div>
    <div class="gaset"><div><small>Format nomor</small><b>${esc(st.prefix)}/${ROMAN[new Date().getMonth()]}/${new Date().getFullYear()}-${String(gaNextNo(today()).seq).padStart(3, '0')}</b><span class="small">nomor berikutnya</span></div><div><small>Lokasi / Dept</small><b>${esc(st.lokasi)} · ${esc(st.dept)}</b></div>
    ${st.sign.map((x) => `<div><small>${esc(x.title.replace(/,$/, ''))}</small><b>${esc(x.name) || '<span class="red">belum diisi</span>'}</b><span class="small">${esc(x.dept)}</span></div>`).join('')}
    <div><small>Logo & tanda tangan</small><b>${st.logo ? 'Logo ✓' : 'Logo belum ada'} · ${gaSig() ? 'TTD ✓' : 'TTD belum ada'}</b><span class="small">TTD hanya disimpan di perangkat ini</span></div></div></div>`;
  return header('Pengadaan', 'Form GA Request', 'Buat pengajuan barang ke Purchasing langsung dari web, unduh Excel sesuai format asli, atau cetak PDF. Saat barang datang, stok gudang otomatis bertambah.', '<button type="button" class="btn btn-p" data-gaed="">+ Buat Form GA</button>') +
    `${!ready ? '<div class="srcnote">Nama penanda tangan belum lengkap. Klik <b>Ambil dari Form Excel</b> agar kop, nomor terakhir, logo, nama, dan tanda tangan terisi otomatis dari file Form Anda.</div>' : ''}${waiting ? `<div class="srcnote"><b>${waiting} permintaan APD</b> belum masuk Form GA. Klik <b>+ Buat Form GA</b> lalu <b>Ambil dari Permintaan</b>.</div>` : ''}
    <div class="mstats" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div><b>${docs.length}</b><span>Form GA dibuat</span></div><div><b style="color:var(--warn,#B45309)">${open}</b><span>Open (barang belum datang)</span></div><div><b style="color:var(--good)">${docs.length - open}</b><span>Barang sudah datang</span></div></div>
    <div class="grid"><div class="card s12"><div class="tw"><table class="t"><thead><tr><th>No. Urut</th><th>Tanggal</th><th>Lokasi</th><th>Barang</th><th>Total</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div></div></div><div class="grid">${set}</div>`;
}

// ---------- editor form ----------
function gaEdit(id, reqIds, draft) {
  if (!isOwner()) return;
  const g = S.state.ga, st = g.settings, old = g.docs.find((x) => x.id === (draft ? draft.d.id : id));
  const d = draft ? draft.d : old ? structuredClone(old) : (() => { const n = gaNextNo(today()); return { id: uid(), ...n, date: today(), lokasi: st.lokasi, dept: st.dept, notes: st.notes, due: '', items: [], signDates: [today(), today(), today()], status: 'OPEN' }; })();
  GA_ED = draft || { d, auto: !old };
  if (reqIds) gaAddReqs(reqIds);
  modal(`${mh('Form GA Request', old ? 'Edit ' + esc(d.no) : 'Buat Form GA Request')}<form id="gaForm" novalidate><div class="fgrid c3">
    <div class="fld"><label for="ga_no">No. Urut</label><input id="ga_no" required value="${esc(d.no)}"></div><div class="fld"><label for="ga_d">Tanggal</label><input id="ga_d" type="date" required value="${esc(d.date)}"></div><div class="fld"><label for="ga_due">Target barang datang</label><input id="ga_due" type="date" value="${esc(d.due || '')}"></div>
    <div class="fld"><label for="ga_l">Lokasi / Site</label><input id="ga_l" list="gaSite" value="${esc(d.lokasi)}" placeholder="Pilih atau ketik site"></div><div class="fld"><label for="ga_dp">Dept</label><input id="ga_dp" value="${esc(d.dept)}"></div><div class="fld"><label for="ga_n">Notes</label><input id="ga_n" value="${esc(d.notes)}"></div></div>
    <div class="ch" style="margin:16px 0 8px"><div><h2 style="font-size:15px">Barang / Jasa</h2></div><div class="mtools"><button type="button" class="btn btn-g btn-sm" id="gaPick">Ambil dari Permintaan</button><button type="button" class="btn btn-g btn-sm" id="gaAdd">+ Tambah Baris</button></div></div>
    <div class="tw"><table class="t gat"><thead><tr><th>No</th><th>Deskripsi Barang / Jasa</th><th>Jumlah</th><th>Satuan</th><th>Estimasi Harga (Rp)</th><th>Total (Rp)</th><th>Site</th><th>Keterangan</th><th></th></tr></thead><tbody id="gaRows"></tbody><tfoot><tr><td></td><td class="b" style="text-align:right">TOTAL</td><td colspan="3"></td><td class="b" id="gaTot"></td><td colspan="3"></td></tr></tfoot></table></div>
    <datalist id="gaSite">${gaSites().map((x) => `<option value="${esc(x)}">`).join('')}</datalist><datalist id="gaCat">${st.catalog.map((c) => `<option value="${esc(c.desc)}">`).join('')}</datalist>
    <div class="fgrid c3" style="margin-top:14px">${st.sign.map((x, i) => `<div class="fld"><label for="ga_s${i}">${esc(x.title.replace(/,$/, ''))}: ${esc(x.name || '—')} · Tgl</label><input id="ga_s${i}" type="date" value="${esc(d.signDates[i] || '')}"></div>`).join('')}</div>
    ${actions(old ? 'Simpan Perubahan' : 'Simpan Form GA')}</form>`);
  gaRows();
  $('ga_d').onchange = () => { if (GA_ED.auto) { const n = gaNextNo($('ga_d').value); Object.assign(GA_ED.d, n); $('ga_no').value = n.no; } };
  $('ga_no').oninput = () => { GA_ED.auto = false; };
  $('gaAdd').onclick = () => { gaRead(); GA_ED.d.items.push({ desc: '', qty: 1, unit: 'Pcs', price: 0, site: '', note: '' }); gaRows(); const r = document.querySelectorAll('#gaRows [data-f="desc"]'); if (r.length) r[r.length - 1].focus(); };
  $('gaPick').onclick = () => { gaRead(); gaPicker(); };
  $('gaForm').onsubmit = (e) => { e.preventDefault(); gaRead(); gaSave(); };
}
function gaRows() {
  const it = GA_ED.d.items;
  $('gaRows').innerHTML = it.map((x, i) => `<tr data-i="${i}"><td>${i + 1}</td><td><input data-f="desc" list="gaCat" value="${esc(x.desc)}" aria-label="Deskripsi baris ${i + 1}">${x.reqId ? '<div class="small">dari Permintaan APD</div>' : ''}</td><td><input data-f="qty" type="number" min="1" step="1" value="${esc(x.qty)}" style="width:70px" aria-label="Jumlah"></td><td><input data-f="unit" value="${esc(x.unit)}" style="width:80px" aria-label="Satuan"></td><td><input data-f="price" type="number" min="0" step="500" value="${esc(x.price || 0)}" style="width:120px" aria-label="Estimasi harga"></td><td class="nw" data-tot>${rp((Number(x.qty) || 0) * (Number(x.price) || 0))}</td><td><input data-f="site" list="gaSite" value="${esc(x.site)}" style="width:150px" aria-label="Site" placeholder="Pilih site"></td><td><input data-f="note" value="${esc(x.note)}" aria-label="Keterangan"></td><td><button type="button" class="btn btn-g btn-sm red" data-garm="${i}" aria-label="Hapus baris">×</button></td></tr>`).join('') || '<tr><td colspan="9" class="empty">Belum ada barang. Klik <b>Ambil dari Permintaan</b> atau <b>+ Tambah Baris</b>.</td></tr>';
  $('gaTot').textContent = rp(gaTotal(GA_ED.d));
  $('gaRows').oninput = (e) => {
    const tr = e.target.closest('tr[data-i]'); if (!tr) return; const x = GA_ED.d.items[Number(tr.dataset.i)], f = e.target.dataset.f;
    x[f] = f === 'qty' || f === 'price' ? Number(e.target.value) || 0 : e.target.value;
    if (f === 'desc') { const c = S.state.ga.settings.catalog.find((k) => k.desc.toLowerCase() === e.target.value.trim().toLowerCase()); if (c) { x.unit = c.unit || x.unit; x.price = Number(c.price) || x.price; tr.querySelector('[data-f="unit"]').value = x.unit; tr.querySelector('[data-f="price"]').value = x.price; } }
    tr.querySelector('[data-tot]').textContent = rp((Number(x.qty) || 0) * (Number(x.price) || 0)); $('gaTot').textContent = rp(gaTotal(GA_ED.d));
  };
  $('gaRows').onclick = (e) => { const b = e.target.closest('[data-garm]'); if (!b) return; GA_ED.d.items.splice(Number(b.dataset.garm), 1); gaRows(); };
}
function gaRead() {
  const d = GA_ED.d; d.no = $('ga_no').value.trim(); d.date = $('ga_d').value; d.due = $('ga_due').value; d.lokasi = $('ga_l').value.trim(); d.dept = $('ga_dp').value.trim(); d.notes = $('ga_n').value.trim();
  d.signDates = [0, 1, 2].map((i) => $('ga_s' + i).value);
}
function gaFree() { const inDoc = new Set(GA_ED ? GA_ED.d.items.map((x) => x.reqId).filter(Boolean) : []); return S.state.requests.filter((r) => (r.status === 'pending' || r.status === 'approved') && (!r.gaId || (GA_ED && r.gaId === GA_ED.d.id)) && !inDoc.has(r.id)); }
function gaAddReqs(ids) {
  ids.forEach((id) => {
    const r = S.state.requests.find((x) => x.id === id); if (!r || GA_ED.d.items.some((x) => x.reqId === id)) return;
    const ty = S.state.types.find((t) => t.code === r.type) || {};
    const base = { desc: gaDesc(r.type, variant(r)), qty: Number(r.qty) || 1, unit: ty.unit || 'Pcs', price: Number(ty.price) || 0, type: r.type, variant: r.variant || '', reqId: r.id };
    if (isStockReq(r)) { GA_ED.d.items.push({ ...base, site: r.warehouse, wh: r.warehouse, note: `Stok ${/^gudang/i.test(r.warehouse) ? "" : "gudang "}${r.warehouse}${r.reason ? ' (' + r.reason + ')' : ''}` }); return; }
    const p = person(r.person) || { name: personName(r.person), position: '', site: r.site || '' };
    GA_ED.d.items.push({ ...base, site: p.site || r.site || '', note: `${p.name} (${r.reason ? r.reason + ' ' : ''}${p.position || ''})`.replace(/\s+\)/, ')') });
  });
}
function gaPicker() {
  const free = gaFree(), snap = GA_ED;
  modal(`${mh('Form GA Request', 'Ambil dari Permintaan APD')}<p class="small">Pilih permintaan yang akan diajukan ke Purchasing. Setiap permintaan menjadi satu baris barang.</p><form id="gpForm"><div class="pick">${free.map((r) => { const p = isStockReq(r) ? { name: 'Stok ' + r.warehouse, site: 'gudang site' } : person(r.person) || { name: personName(r.person), site: r.site }; const z = variantStocks(r.type)[variant(r)] || { NEW: 0, REUSE: 0 }; return `<label><input type="checkbox" name="r" value="${esc(r.id)}" ${z.NEW + z.REUSE < r.qty ? 'checked' : ''}><span><b>${esc(p.name)}</b> · ${esc(p.site || '')}<br>${r.qty} ${esc(gaDesc(r.type, variant(r)))} · ${esc(r.reason || '')} · <i>${REQ_ST[r.status][0]}</i> · stok ${z.NEW + z.REUSE}</span></label>`; }).join('') || '<div class="empty">Tidak ada permintaan yang menunggu atau semua sudah masuk Form GA.</div>'}</div><p class="small">Yang stoknya tidak cukup sudah dicentang otomatis.</p><div class="factions"><span style="flex:1"></span><button type="button" class="btn btn-g" id="gpBack">Kembali</button><button type="submit" class="btn btn-p">Tambahkan ke Form</button></div></form>`);
  const x = $('dialog').querySelector('.cm-h [data-close]'); if (x) { x.removeAttribute('data-close'); x.id = 'gpX'; }
  const back = (ids) => { GA_ED = snap; gaAddReqs(ids); gaEdit(null, null, snap); };
  $('gpBack').onclick = () => back([]); if ($('gpX')) $('gpX').onclick = () => back([]);
  $('gpForm').onsubmit = (e) => { e.preventDefault(); back([...document.querySelectorAll('#gpForm [name=r]:checked')].map((i) => i.value)); };
}
function gaSave() {
  const d = GA_ED.d;
  if (!d.items.length) { toast('Tambahkan minimal satu barang.', true); return; }
  const n = structuredClone(S.state), g = n.ga; const i = g.docs.findIndex((x) => x.id === d.id);
  d.items = d.items.map((x) => ({ ...x, desc: String(x.desc || '').trim(), qty: Number(x.qty) || 0, price: Number(x.price) || 0 }));
  const m = String(d.no).match(/-(\d{1,5})$/); if (m) d.seq = Number(m[1]); d.year = Number(String(d.date).slice(0, 4));
  if (i >= 0) g.docs[i] = d; else g.docs.push(d);
  // tautkan permintaan APD ke form ini
  const ids = new Set(d.items.map((x) => x.reqId).filter(Boolean));
  n.requests.forEach((r) => { if (ids.has(r.id)) { r.gaId = d.id; r.gaNo = d.no; } else if (r.gaId === d.id) { delete r.gaId; delete r.gaNo; } });
  // katalog harga: deskripsi terakhir yang dipakai
  d.items.forEach((x) => { if (!x.desc) return; const c = g.settings.catalog.find((k) => k.desc.toLowerCase() === x.desc.toLowerCase()); if (c) { c.unit = x.unit; if (x.price) c.price = x.price; } else g.settings.catalog.push({ desc: x.desc, unit: x.unit, price: x.price }); });
  g.settings.catalog = g.settings.catalog.slice(-300);
  persist(n, `Form GA ${d.no} tersimpan. Klik Excel untuk mengunduh.`);
}

// ---------- barang datang → stok masuk ----------
function gaReceive(id) {
  const d = S.state.ga.docs.find((x) => x.id === id); if (!d || !isOwner()) return;
  modal(`${mh('Barang datang', esc(d.no))}<div class="srcnote">Barang APD yang datang langsung masuk <b>Stok Masuk</b> gudang terpilih (kondisi baru). Baris non-APD (mis. kabel roll) biarkan "Bukan stok APD".</div><form id="grForm"><div class="fgrid"><div class="fld"><label for="gr_d">Tanggal datang</label><input id="gr_d" type="date" required value="${today()}"></div><div class="fld"><label for="gr_w">Gudang (semua baris)</label>${whSel('gr_w', WH[0], 'wh')}<small class="small">Baris permintaan stok site otomatis ke gudang site-nya.</small></div></div>
    <div class="tw" style="margin-top:12px"><table class="t"><thead><tr><th>Barang</th><th>Diajukan</th><th>Jenis APD</th><th>Ukuran / Warna</th><th>Qty datang</th><th>Masuk gudang</th></tr></thead><tbody>${d.items.map((x, i) => `<tr><td>${esc(x.desc)}</td><td>${x.qty} ${esc(x.unit)}</td><td><select data-gt="${i}" aria-label="Jenis APD"><option value="">Bukan stok APD</option>${TYPES.map((t) => `<option value="${esc(t)}" ${x.type === t ? 'selected' : ''}>${esc(tLabel(t))}</option>`).join('')}</select></td><td data-gvw="${i}">${gaVSel(x.type, x.variant, i)}</td><td><input type="number" min="0" step="1" data-gq="${i}" value="${x.qty}" style="width:80px" aria-label="Qty datang"></td><td>${whSel('grw' + i, x.wh && WH.includes(x.wh) ? x.wh : WH[0], 'grw' + i, `data-gw="${i}"`)}</td></tr>`).join('')}</tbody></table></div>${actions('Simpan & Tambah Stok')}</form>`);
  $('gr_w').addEventListener('change', () => d.items.forEach((x, i) => { if (!x.wh) $('grw' + i).value = $('gr_w').value; }));
  $('grForm').addEventListener('change', (e) => { const t = e.target.dataset.gt; if (t != null) $('dialog').querySelector(`[data-gvw="${t}"]`).innerHTML = gaVSel(e.target.value, '', t); });
  $('grForm').onsubmit = (e) => {
    e.preventDefault(); const n = structuredClone(S.state), doc = n.ga.docs.find((x) => x.id === id), date = $('gr_d').value; let k = 0; const whs = new Set();
    for (const [i, x] of doc.items.entries()) {
      const t = $('dialog').querySelector(`[data-gt="${i}"]`).value, v = ($('dialog').querySelector(`[data-gv="${i}"]`) || {}).value || '', q = Number($('dialog').querySelector(`[data-gq="${i}"]`).value) || 0;
      const wh = $('grw' + i).value; x.got = q; if (!t || q < 1) continue; whs.add(wh);
      if ((VARIANTS[t] || []).length && !v) { toast('Pilih ukuran/warna untuk ' + x.desc + '.', true); return; }
      n.stockIn.push({ id: uid(), date, type: t, grade: 'NEW', variant: v, qty: q, location: wh, note: 'GA ' + doc.no, gaId: doc.id }); k++;
      // permintaan stok site yang tertaut otomatis selesai saat barang masuk ke gudangnya
      const rq = x.reqId && n.requests.find((y) => y.id === x.reqId); if (rq && isStockReq(rq) && rq.warehouse === wh && rq.status !== 'fulfilled' && rq.status !== 'rejected' && rq.status !== 'cancelled') { rq.status = 'fulfilled'; rq.fulfilledBy = S.user.email; rq.fulfilledAt = date; rq.decidedBy = rq.decidedBy || S.user.email; rq.decidedAt = rq.decidedAt || date; }
    }
    doc.status = 'CLOSE'; doc.receivedAt = date;
    persist(n, k ? `${k} baris barang masuk stok (${[...whs].join(', ')}). Form GA ditutup.` : 'Form GA ditandai barang datang.');
  };
}
const gaVSel = (t, v, i) => !t || !(VARIANTS[t] || []).length ? '<span class="small">—</span>' : `<select data-gv="${i}" aria-label="Ukuran/warna"><option value="">Pilih</option>${VARIANTS[t].map((z) => `<option value="${esc(z)}" ${z === v ? 'selected' : ''}>${esc(vText(t, z))}</option>`).join('')}</select>`;
function gaDelete(id) {
  const d = S.state.ga.docs.find((x) => x.id === id); if (!d) return;
  confirmBox('Hapus Form GA ' + d.no + '?', `${d.items.length} baris barang, total Rp ${rp(gaTotal(d))}. ${d.status === 'CLOSE' ? 'Stok masuk dari form ini tetap ada (hapus di Stok & Gudang bila perlu).' : 'Permintaan APD yang tertaut kembali bisa diajukan.'}`, () => {
    const n = structuredClone(S.state); n.ga.docs = n.ga.docs.filter((x) => x.id !== id); n.requests.forEach((r) => { if (r.gaId === id) { delete r.gaId; delete r.gaNo; } });
    return persist(n, 'Form GA dihapus.', { kind: 'ga', id, data: { no: d.no, date: d.date, qty: d.items.length, note: 'Total Rp ' + rp(gaTotal(d)) } });
  });
}

// ---------- pengaturan ----------
function gaSettings() {
  const st = S.state.ga.settings, y = new Date().getFullYear();
  modal(`${mh('Form GA Request', 'Pengaturan Form')}<form id="gsForm"><div class="fgrid c3">
    <div class="fld"><label for="gs_p">Awalan nomor</label><input id="gs_p" required value="${esc(st.prefix)}"></div><div class="fld"><label for="gs_l">Lokasi / Site</label><input id="gs_l" value="${esc(st.lokasi)}"></div><div class="fld"><label for="gs_d">Dept</label><input id="gs_d" value="${esc(st.dept)}"></div>
    <div class="fld"><label for="gs_s">Nomor terakhir tahun ${y}</label><input id="gs_s" type="number" min="0" step="1" value="${Number(st.lastSeq[y]) || 0}"><small class="small">Form baru melanjutkan dari nomor ini.</small></div><div class="fld" style="grid-column:span 2"><label for="gs_n">Notes bawaan</label><input id="gs_n" value="${esc(st.notes)}"></div>
    ${st.sign.map((x, i) => `<div class="fld"><label for="gs_t${i}">Judul ${i + 1}</label><input id="gs_t${i}" value="${esc(x.title)}"><label for="gs_m${i}" style="margin-top:6px">Nama</label><input id="gs_m${i}" value="${esc(x.name)}"><label for="gs_x${i}" style="margin-top:6px">Jabatan / Dept</label><input id="gs_x${i}" value="${esc(x.dept)}"></div>`).join('')}
    <div class="fld"><label>Logo kop</label><div class="gapic">${st.logo ? `<img src="${esc(st.logo)}" alt="Logo">` : '<span class="small">Belum ada</span>'}</div><label class="btn btn-g btn-sm" style="margin-top:6px">Pilih Logo<input type="file" id="gs_lg" accept="image/png,image/jpeg" hidden></label></div>
    <div class="fld"><label>Tanda tangan (${esc(st.sign[0].name || 'Diajukan')})</label><div class="gapic">${gaSig() ? `<img src="${esc(gaSig())}" alt="Tanda tangan">` : '<span class="small">Belum ada</span>'}</div><div class="mtools" style="margin-top:6px"><label class="btn btn-g btn-sm">Pilih TTD<input type="file" id="gs_tt" accept="image/png,image/jpeg" hidden></label>${gaSig() ? '<button type="button" class="btn btn-g btn-sm red" id="gs_ttx">Hapus</button>' : ''}</div><small class="small">Disimpan di perangkat ini saja, tidak ikut ke server, agar tanda tangan tidak bisa diambil orang lain.</small></div>
    </div>${actions('Simpan Pengaturan')}</form>`);
  let logo = st.logo;
  $('gs_lg').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { logo = await gaImgFile(f, 600); $('dialog').querySelector('.gapic').innerHTML = `<img src="${logo}" alt="Logo">`; } catch (er) { toast(er.message, true); } };
  $('gs_tt').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { gaSetSig(await gaClear(await gaImgFile(f, 400))); toast('Tanda tangan tersimpan di perangkat ini.'); gaSettings(); } catch (er) { toast(er.message, true); } };
  if ($('gs_ttx')) $('gs_ttx').onclick = () => { gaSetSig(''); gaSettings(); };
  $('gsForm').onsubmit = (e) => {
    e.preventDefault(); const n = structuredClone(S.state), s = n.ga.settings;
    s.prefix = $('gs_p').value.trim().replace(/\/+$/, ''); s.lokasi = $('gs_l').value.trim(); s.dept = $('gs_d').value.trim(); s.notes = $('gs_n').value.trim(); s.lastSeq = { ...s.lastSeq, [y]: Math.max(0, Number($('gs_s').value) || 0) };
    s.sign = [0, 1, 2].map((i) => ({ title: $('gs_t' + i).value.trim(), name: $('gs_m' + i).value.trim(), dept: $('gs_x' + i).value.trim() })); s.logo = logo;
    persist(n, 'Pengaturan Form GA tersimpan.');
  };
}
// latar putih tanda tangan dibuat transparan agar tidak menutupi nama
async function gaClear(uri) {
  const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Gambar tidak terbaca')); i.src = uri; });
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const m = Math.min(p[i], p[i + 1], p[i + 2]); if (m > 235) p[i + 3] = 0; else if (m > 200) p[i + 3] = Math.round(p[i + 3] * (235 - m) / 35); }
  x.putImageData(d, 0, 0); return c.toDataURL('image/png');
}
async function gaImgFile(f, max) {
  if (!/^image\/(png|jpeg)$/.test(f.type)) throw new Error('Pilih gambar PNG atau JPG.');
  const raw = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => no(new Error('Gagal membaca gambar')); r.readAsDataURL(f); });
  const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Gambar tidak terbaca')); i.src = raw; });
  const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/png');
}
// baca Form GA Request .xlsx lama → pengaturan, nomor terakhir, logo, tanda tangan, katalog harga
async function gaImport(file) {
  const JSZip = await loadLib('jszip'); const z = await JSZip.loadAsync(await file.arrayBuffer());
  const P = (s) => new DOMParser().parseFromString(s, 'application/xml');
  const txt = async (p) => (z.file(p) ? z.file(p).async('string') : '');
  const sheetPath = Object.keys(z.files).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0]; if (!sheetPath) throw new Error('Sheet tidak ditemukan.');
  const ss = [...P(await txt('xl/sharedStrings.xml')).getElementsByTagName('si')].map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent).join(''));
  const cell = {};
  [...P(await txt(sheetPath)).getElementsByTagName('c')].forEach((c) => { const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0]; cell[c.getAttribute('r')] = t === 's' ? ss[Number(v && v.textContent)] : t === 'inlineStr' ? [...c.getElementsByTagName('t')].map((x) => x.textContent).join('') : v ? v.textContent : ''; });
  const val = (r) => String(cell[r] ?? '').trim();
  const out = structuredClone(S.state.ga.settings); let found = 0;
  for (let r = 1; r <= 6; r++) { const k = val('G' + r).toLowerCase(), v = val('H' + r); if (!v) continue;
    if (k.startsWith('no')) { const m = v.match(/^(.*)\/([IVXL]+)\/(\d{4})-(\d+)$/); if (m) { out.prefix = m[1].trim(); out.lastSeq = { ...out.lastSeq, [m[3]]: Math.max(Number(out.lastSeq[m[3]]) || 0, Number(m[4])) }; found++; } }
    if (k.startsWith('lokasi')) { out.lokasi = v; found++; } if (k.startsWith('dept')) { out.dept = v; found++; } }
  const rows = [...new Set(Object.keys(cell).map((k) => Number(k.replace(/^[A-Z]+/, ''))))].sort((a, b) => a - b);
  const hdr = rows.find((r) => /^no$/i.test(val('A' + r)) && /deskripsi/i.test(val('B' + r)));
  const tot = rows.find((r) => r > (hdr || 0) && /^total$/i.test(val('B' + r)));
  if (hdr && tot) for (let r = hdr + 1; r < tot; r++) { const desc = val('B' + r); if (!desc) continue; const price = Number(cell['E' + r]) || 0; const c = out.catalog.find((k) => k.desc.toLowerCase() === desc.toLowerCase()); if (c) { c.unit = val('D' + r) || c.unit; if (price) c.price = price; } else out.catalog.push({ desc, unit: val('D' + r), price }); }
  const nr = rows.find((r) => /^notes/i.test(val('A' + r)));
  const sr = rows.find((r) => /diajukan/i.test(val('B' + r)));
  if (nr) { const lines = rows.filter((r) => r > nr && (!sr || r < sr) && val('A' + r)).map((r) => val('A' + r)); if (lines.length) { out.notes = lines.join('\n'); found++; } }
  if (sr) { ['B', 'E', 'H'].forEach((col, i) => { out.sign[i] = { title: val(col + sr) || out.sign[i].title, name: val(col + (sr + 2)) || out.sign[i].name, dept: val(col + (sr + 3)) || out.sign[i].dept }; }); found++; }
  // gambar: di atas tabel = logo; di area tanda tangan = TTD
  let logo = '', sig = '';
  const rel = P(await txt(sheetPath.replace('worksheets/', 'worksheets/_rels/') + '.rels'));
  const dRel = [...rel.getElementsByTagName('Relationship')].find((x) => /drawing/.test(x.getAttribute('Type')));
  if (dRel) {
    const dp = 'xl/' + dRel.getAttribute('Target').replace(/^\.\.\//, '').replace(/^\/xl\//, '');
    const dx = P(await txt(dp)), dr = P(await txt(dp.replace('drawings/', 'drawings/_rels/') + '.rels'));
    const map = Object.fromEntries([...dr.getElementsByTagName('Relationship')].map((x) => [x.getAttribute('Id'), 'xl/' + x.getAttribute('Target').replace(/^\.\.\//, '')]));
    for (const a of [...dx.getElementsByTagName('*')].filter((e) => /(two|one)CellAnchor$/.test(e.localName))) {
      const from = [...a.getElementsByTagName('*')].find((e) => e.localName === 'from'); const row = from ? Number([...from.getElementsByTagName('*')].find((e) => e.localName === 'row').textContent) + 1 : 0;
      const blip = [...a.getElementsByTagName('*')].find((e) => e.localName === 'blip'); if (!blip) continue;
      const path = map[blip.getAttribute('r:embed') || blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed')]; if (!path || !z.file(path)) continue;
      const ext = path.split('.').pop().toLowerCase(), mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ''; if (!mime) continue;
      const uri = `data:${mime};base64,` + await z.file(path).async('base64');
      if (hdr && row <= hdr) logo = uri; else if (sr && row >= sr - 1) sig = uri;
    }
  }
  if (logo) { out.logo = logo; found++; }
  if (!found) throw new Error('Format Form GA Request tidak dikenali.');
  if (sig) gaSetSig(await gaClear(sig));
  const n = structuredClone(S.state); n.ga.settings = out;
  const y = Object.keys(out.lastSeq).sort().pop();
  await persist(n, `Format Form GA diambil dari ${file.name}: nomor terakhir ${y ? out.lastSeq[y] : '-'}, ${out.sign.filter((x) => x.name).length} penanda tangan${logo ? ', logo' : ''}${sig ? ', tanda tangan (disimpan di perangkat ini)' : ''}.`);
}

// ---------- unduh Excel (format sama dengan Form GA Request) ----------
async function gaXlsx(id) {
  const d = S.state.ga.docs.find((x) => x.id === id); if (!d) return;
  const JSZip = await loadLib('jszip'); const st = S.state.ga.settings, sig = gaSig();
  const X = (s) => esc(s);
  const col = (n) => 'ABCDEFGH'[n];
  const cells = {}; const H = {}; const merges = [];
  const put = (ref, s, v, k) => { cells[ref] = { s, v, k }; };
  const serial = (iso) => { const [y, m, dd] = String(iso).split('-').map(Number); return (Date.UTC(y, m - 1, dd) - Date.UTC(1899, 11, 30)) / 864e5; };
  [['No. Urut', d.no], ['Lokasi/Site', d.lokasi], ['Dept', d.dept]].forEach(([a, b], i) => { put('G' + (i + 1), 1, a); put('H' + (i + 1), 2, b); });
  put('G4', 1, 'Tanggal'); put('H4', 15, serial(d.date), 'n');
  [1, 2, 3, 4].forEach((r) => { H[r] = 13; }); H[5] = 10; H[6] = 26;
  ['No', 'Deskripsi Barang / Jasa', 'Jumlah', 'Satuan', 'Estimasi Harga (Rp)', 'Total (Rp)', 'Site', 'Keterangan'].forEach((t, i) => put(col(i) + '6', 3, t));
  d.items.forEach((x, i) => {
    const r = 7 + i, q = Number(x.qty) || 0, p = Number(x.price) || 0;
    put('A' + r, 4, i + 1, 'n'); put('B' + r, 5, x.desc); put('C' + r, 4, q, 'n'); put('D' + r, 4, x.unit || ''); put('E' + r, 6, p ? p : '', p ? 'n' : ''); put('F' + r, 6, { f: `C${r}*E${r}`, v: q * p }, 'f'); put('G' + r, 4, x.site || ''); put('H' + r, 5, x.note || '');
  });
  const tr = 7 + d.items.length; H[tr] = 22;
  ['A', 'C', 'D', 'E', 'G', 'H'].forEach((c) => put(c + tr, 9, '')); put('B' + tr, 7, 'TOTAL'); put('F' + tr, 8, { f: `SUM(F7:F${tr - 1})`, v: gaTotal(d) }, 'f');
  const nr = tr + 2; put('A' + nr, 10, 'Notes:'); H[nr] = 13;
  const notes = String(d.notes || '').split(/\n/).filter(Boolean); notes.forEach((t, i) => { put('A' + (nr + 1 + i), 11, t); H[nr + 1 + i] = 13; });
  const sr = nr + 1 + Math.max(1, notes.length) + 2; H[sr] = 18; H[sr + 1] = 45; H[sr + 2] = 18; H[sr + 3] = 16; H[sr + 4] = 16;
  st.sign.forEach((x, i) => { const c = ['B', 'E', 'H'][i]; put(c + sr, 12, x.title); put(c + (sr + 2), 12, x.name); put(c + (sr + 3), 13, x.dept); put(c + (sr + 4), 14, 'Tgl: ' + (dmy(d.signDates[i]) || '')); });
  [sr, sr + 2, sr + 3, sr + 4].forEach((r) => merges.push(`E${r}:F${r}`));
  const rowsXml = Object.keys({ ...H, ...Object.fromEntries(Object.keys(cells).map((k) => [Number(k.replace(/^[A-Z]+/, '')), 1])) }).map(Number).sort((a, b) => a - b).map((r) => {
    const cs = Object.keys(cells).filter((k) => Number(k.replace(/^[A-Z]+/, '')) === r).sort().map((k) => { const c = cells[k];
      if (c.k === 'n') return `<c r="${k}" s="${c.s}"><v>${c.v}</v></c>`;
      if (c.k === 'f') return `<c r="${k}" s="${c.s}"><f>${c.v.f}</f><v>${c.v.v}</v></c>`;
      return c.v === '' ? `<c r="${k}" s="${c.s}"/>` : `<c r="${k}" s="${c.s}" t="inlineStr"><is><t xml:space="preserve">${X(c.v)}</t></is></c>`; }).join('');
    return `<row r="${r}"${H[r] ? ` ht="${H[r]}" customHeight="1"` : ''}>${cs}</row>`;
  }).join('');
  // gambar
  const imgs = [];
  const dim = (uri) => new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.onerror = () => ok([1, 1]); i.src = uri; });
  const fit = ([w, h], bw, bh) => { const s = Math.min(bw / w, bh / h); return [Math.round(w * s), Math.round(h * s)]; };
  if (st.logo) { const [w, h] = fit(await dim(st.logo), 125, 76); imgs.push({ uri: st.logo, col: 0, colOff: 9, row: 0, rowOff: 5, w, h }); }
  if (sig) { const [w, h] = fit(await dim(sig), 94, 112); imgs.push({ uri: sig, col: 1, colOff: Math.max(0, Math.round((180 - w) / 2)), row: sr - 1, rowOff: 20, w, h, clear: true }); }
  const E = 9525;
  const drawing = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${imgs.map((m, i) => `<xdr:oneCellAnchor><xdr:from><xdr:col>${m.col}</xdr:col><xdr:colOff>${m.colOff * E}</xdr:colOff><xdr:row>${m.row}</xdr:row><xdr:rowOff>${m.rowOff * E}</xdr:rowOff></xdr:from><xdr:ext cx="${m.w * E}" cy="${m.h * E}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i + 2}" name="Gambar ${i + 1}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${i + 1}">${m.clear ? '<a:clrChange><a:clrFrom><a:srgbClr val="FFFFFF"/></a:clrFrom><a:clrTo><a:srgbClr val="FFFFFF"><a:alpha val="0"/></a:srgbClr></a:clrTo></a:clrChange>' : ''}</a:blip><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${m.w * E}" cy="${m.h * E}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`).join('')}</xdr:wsDr>`;
  const B = (l, r, t, b) => `<border><left${l ? ` style="${l}"><color auto="1"/></left>` : '/>'}<right${r ? ` style="${r}"><color auto="1"/></right>` : '/>'}<top${t ? ` style="${t}"><color auto="1"/></top>` : '/>'}<bottom${b ? ` style="${b}"><color auto="1"/></bottom>` : '/>'}<diagonal/></border>`;
  const xf = (font, fill, border, ha, numFmt, wrap) => `<xf numFmtId="${numFmt || 0}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0"${font ? ' applyFont="1"' : ''}${fill ? ' applyFill="1"' : ''}${border ? ' applyBorder="1"' : ''}${numFmt ? ' applyNumberFormat="1"' : ''}${ha || wrap ? ` applyAlignment="1"><alignment${ha ? ` horizontal="${ha}"` : ''} vertical="center"${wrap ? ' wrapText="1"' : ''}/></xf>` : '/>'}`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="4"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><i/><sz val="10"/><name val="Arial"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6EEF4"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="4">${B()}${B('thin', 'thin', 'thin', 'thin')}${B('thin', 'thin', 'medium', 'medium')}${B('thin', 'thin', 'thin', 'double')}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="16">${[xf(0, 0, 0), xf(1, 0, 0, 'right'), xf(0, 0, 0, 'left'), xf(2, 2, 2, 'center', 0, true), xf(0, 0, 1, 'center'), xf(0, 0, 1, 'left'), xf(0, 0, 1, 'right', 3), xf(1, 3, 3, 'right'), xf(1, 3, 3, 'right', 3), xf(0, 3, 3), xf(1, 0, 0), xf(3, 0, 0), xf(1, 0, 0, 'center'), xf(0, 0, 0, 'center'), xf(3, 0, 0, 'center'), xf(0, 0, 0, 'left', 164)].join('')}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const last = Math.max(...Object.keys(H).map(Number), sr + 4);
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:H${last}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="13"/>
<cols><col min="1" max="1" width="6" customWidth="1"/><col min="2" max="2" width="25" customWidth="1"/><col min="3" max="3" width="10" customWidth="1"/><col min="4" max="4" width="9" customWidth="1"/><col min="5" max="5" width="18" customWidth="1"/><col min="6" max="6" width="14" customWidth="1"/><col min="7" max="7" width="16" customWidth="1"/><col min="8" max="8" width="35" customWidth="1"/></cols>
<sheetData>${rowsXml}</sheetData><mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>${imgs.length ? '<drawing r:id="rId1"/>' : ''}</worksheet>`;
  const name = 'GA Request';
  const zip = new JSZip(), ext = (u) => (u.startsWith('data:image/png') ? 'png' : 'jpeg');
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${imgs.length ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : ''}</Types>`);
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'${name}'!$A$1:$H$${last}</definedName></definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  zip.file('xl/styles.xml', styles); zip.file('xl/worksheets/sheet1.xml', sheet);
  if (imgs.length) {
    zip.file('xl/worksheets/_rels/sheet1.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>');
    zip.file('xl/drawings/drawing1.xml', drawing);
    zip.file('xl/drawings/_rels/drawing1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${imgs.map((m, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${i + 1}.${ext(m.uri)}"/>`).join('')}</Relationships>`);
    imgs.forEach((m, i) => zip.file(`xl/media/image${i + 1}.${ext(m.uri)}`, m.uri.split(',')[1], { base64: true }));
  }
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `GA_Request_${d.no.replace(/[\\/:*?"<>| ]+/g, '_')}.xlsx`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  window.__gaLast = blob;
}

// ---------- pratinjau & cetak PDF ----------
function gaHtml(d) {
  const st = S.state.ga.settings, sig = gaSig();
  return `<div class="gadoc"><div class="gah"><div class="galogo">${st.logo ? `<img src="${esc(st.logo)}" alt="Logo">` : ''}</div><table class="gameta"><tr><th>No. Urut</th><td>${esc(d.no)}</td></tr><tr><th>Lokasi/Site</th><td>${esc(d.lokasi)}</td></tr><tr><th>Dept</th><td>${esc(d.dept)}</td></tr><tr><th>Tanggal</th><td>${dmy(d.date)}</td></tr></table></div>
  <table class="gatb"><thead><tr><th>No</th><th>Deskripsi Barang / Jasa</th><th>Jumlah</th><th>Satuan</th><th>Estimasi Harga (Rp)</th><th>Total (Rp)</th><th>Site</th><th>Keterangan</th></tr></thead><tbody>${d.items.map((x, i) => `<tr><td class="c">${i + 1}</td><td>${esc(x.desc)}</td><td class="c">${x.qty}</td><td class="c">${esc(x.unit)}</td><td class="r">${x.price ? rp(x.price) : ''}</td><td class="r">${rp((Number(x.qty) || 0) * (Number(x.price) || 0))}</td><td class="c">${esc(x.site)}</td><td>${esc(x.note)}</td></tr>`).join('')}<tr class="tot"><td></td><td class="r">TOTAL</td><td></td><td></td><td></td><td class="r">${rp(gaTotal(d))}</td><td></td><td></td></tr></tbody></table>
  <div class="ganote"><b>Notes:</b>${String(d.notes || '').split(/\n/).map((t) => `<i>${esc(t)}</i>`).join('')}</div>
  <div class="gasign">${st.sign.map((x, i) => `<div><b>${esc(x.title)}</b><span class="gs">${i === 0 && sig ? `<img src="${esc(sig)}" alt="">` : ''}</span><b>${esc(x.name)}</b><span>${esc(x.dept)}</span><i>Tgl: ${dmy(d.signDates[i])}</i></div>`).join('')}</div></div>`;
}
const GA_CSS = `.gadoc{font:10pt Arial,sans-serif;color:#000;background:#fff;padding:18px}.gah{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}.galogo img{max-width:130px;max-height:78px}.gameta th{text-align:right;padding:0 6px 0 0;font-weight:700}.gameta td{padding:0}.gameta{border-collapse:collapse;font-size:10pt}.gatb{width:100%;border-collapse:collapse;font-size:10pt}.gatb th{background:#1F4E78;color:#fff;border:1px solid #000;border-top:2px solid #000;border-bottom:2px solid #000;padding:6px 4px}.gatb td{border:1px solid #000;padding:2px 5px}.gatb .c{text-align:center}.gatb .r{text-align:right}.gatb .tot td{background:#E6EEF4;font-weight:700;border-bottom:3px double #000;height:22px}.ganote{margin-top:16px}.ganote b,.ganote i{display:block}.gasign{display:grid;grid-template-columns:1fr 1fr 1fr;text-align:center;margin-top:36px}.gasign div{display:flex;flex-direction:column;align-items:center;gap:2px}.gasign .gs{height:64px;display:flex;align-items:center}.gasign .gs img{max-height:90px;max-width:100px;position:relative;top:14px}`;
function gaPreview(id) {
  const d = S.state.ga.docs.find((x) => x.id === id); if (!d) return;
  modal(`${mh('Form GA Request', esc(d.no))}<div class="gaview"><style>${GA_CSS}</style>${gaHtml(d)}</div><div class="factions"><span style="flex:1"></span><button type="button" class="btn btn-g" data-close>Tutup</button><button type="button" class="btn btn-g" data-gax="${esc(d.id)}">Download Excel</button><button type="button" class="btn btn-p" id="gaPrint">Print / Simpan PDF</button></div>`);
  $('dialog').classList.add('wide');
  $('gaPrint').onclick = () => {
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
    f.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.no)}</title><style>@page{size:A4 portrait;margin:12mm}body{margin:0}${GA_CSS}.gadoc{padding:0}</style></head><body>${gaHtml(d)}</body></html>`;
    f.onload = () => { setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); }, 150); };
  };
}

// ---------- event ----------
function gaClick(e) {
  if (!isOwner()) return false; const c = (s) => e.target.closest(s);
  const ed = c('[data-gaed]'); if (ed) { gaEdit(ed.dataset.gaed || null); return true; }
  const x = c('[data-gax]'); if (x) { gaXlsx(x.dataset.gax).catch((er) => toast('Gagal membuat Excel: ' + er.message, true)); return true; }
  const pv = c('[data-gapv]'); if (pv) { gaPreview(pv.dataset.gapv); return true; }
  const rc = c('[data-garcv]'); if (rc) { gaReceive(rc.dataset.garcv); return true; }
  const dl = c('[data-gadel]'); if (dl) { gaDelete(dl.dataset.gadel); return true; }
  const fr = c('[data-gafrom]'); if (fr) { go('ga'); gaEdit(null, fr.dataset.gafrom.split(',').filter(Boolean)); return true; }
  if (c('#gaSet')) { gaSettings(); return true; }
  if (c('#gaImp')) { $('gaImpIn').click(); return true; }
  return false;
}
document.addEventListener('change', (e) => {
  if (e.target.id !== 'gaImpIn' || !isOwner()) return; const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
  gaImport(f).catch((er) => toast('Gagal membaca Form Excel: ' + er.message, true));
});
