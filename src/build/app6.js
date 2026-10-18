// ================= v6: structured applicants per position (Pelamar) =================
const C_STATUS = ['Aktif', 'Hold', 'No Response', 'Tidak Lolos', 'Menolak OL', 'Mundur', 'Diterima'];
const C_SUMBER = ['Online', 'Job Portal', 'Referral', 'Walk-in', 'Agency / Vendor', 'Internal', 'Lainnya'];
const ST_OF = (s) => s === 'Aktif' ? 'pr' : s === 'Hold' ? 'hd' : s === 'Diterima' ? 'ok' : 'no';
const C_BADGE = { Aktif: 'pr', Hold: 'hd', Diterima: 'ok' };
function statusFromNote(note) {
  const n = (note || '').toLowerCase();
  if (!n) return 'Aktif';
  if (/hold/.test(n)) return 'Hold';
  if (/respon|no response/.test(n)) return 'No Response';
  if (/menolak|tolak/.test(n)) return 'Menolak OL';
  if (/kabur|mundur|resign|batal/.test(n)) return 'Mundur';
  if (/tidak|gagal/.test(n)) return 'Tidak Lolos';
  return 'Aktif';
}
function materialize(p) {
  if (Array.isArray(p.cands)) return p;
  const base = Math.max(0, stageIdx(p));
  const hired = !isVacant(p) ? normName(p.nama) : null;
  const out = [];
  (p.ket || '').split(/\n+/).map((s) => s.trim()).filter(Boolean).forEach((l) => {
    const { name, note } = splitLine(l);
    let status = statusFromNote(note);
    if (hired && normName(name) === hired) status = 'Diterima';
    else if (isClose(p) && status === 'Aktif') status = 'Tidak Lolos';
    out.push({ name, status, sumber: null, stage: status === 'Diterima' ? 7 : base, note: note || null });
  });
  if (isClose(p) && hired && !out.some((c) => c.status === 'Diterima')) out.push({ name: p.nama, status: 'Diterima', sumber: null, stage: 7, note: null });
  p.cands = out;
  return p;
}
function ketFromCands(cs) { return cs.map((c) => c.note ? `${c.name} - ${c.note}` : (c.status === 'Aktif' || c.status === 'Diterima') ? c.name : `${c.name} - ${c.status}`).join('\n') || null; }
STATE.positions.forEach(materialize);

function candidates(p) {
  materialize(p);
  const out = p.cands.map((c) => { const st = ST_OF(c.status); return { name: c.name, note: c.note || '', st, status: c.status, sumber: c.sumber, stage: c.stage ?? stageIdx(p), reason: st === 'no' ? (c.status === 'Tidak Lolos' ? (c.note ? reasonOf(c.note) : 'Tidak lolos') : c.status === 'No Response' ? 'Tidak ada respon' : c.status === 'Menolak OL' ? 'Menolak offering' : c.status === 'Mundur' ? 'Mundur / kabur' : 'Tidak lolos') : '' }; });
  (p.hist || []).forEach((h) => { if (!out.some((c) => normName(c.name) === normName(h.name))) out.push({ ...h, status: h.status || 'Tidak Lolos', stage: h.stage ?? stageIdx(p), fromHist: true }); });
  return out;
}
function candStatusText(c, p) {
  const s = c.stage ?? stageIdx(p);
  if (c.st === 'ok') return 'Diterima';
  if (c.st === 'no') return `${c.status || 'Tidak Lolos'} • Tidak Aktif`;
  return `${c.st === 'hd' ? 'Hold' : 'Aktif'} • ${STAGE_UP[s]} ${STAGE_PCT[s]}%`;
}
const inFlight = (c) => c.st === 'pr' || c.st === 'hd' || c.status === 'No Response';
function topStage(p) { const a = candidates(p).filter((c) => c.st === 'pr' || c.st === 'hd'); return a.length ? Math.max(...a.map((c) => c.stage)) : stageIdx(p); }

function derive() {
  const P = DATA.positions;
  const planning = P.length, vacant = P.filter(isVacant).length, actual = planning - vacant;
  const open = P.filter(isOpen).sort((a, b) => (diff(a.due, TODAY) ?? 9999) - (diff(b.due, TODAY) ?? 9999));
  const cont = P.filter((p) => hasPTK(p) && /^continue$/i.test(p.status || ''));
  const closed = P.filter(isClose);
  const ket = {}; P.forEach((p) => { const k = ketPTK(p); ket[k] = (ket[k] || 0) + 1; });
  const openCands = []; open.forEach((p) => candidates(p).forEach((c) => openCands.push({ ...c, p })));
  const allCands = []; P.forEach((p) => candidates(p).forEach((c) => allCands.push({ ...c, p })));
  const pipe = STAGES.map(() => 0).concat([0]);
  open.forEach((p) => { const act = candidates(p).filter((c) => c.st === 'pr' || c.st === 'hd'); if (act.length) act.forEach((c) => { pipe[c.stage]++; }); else pipe[stageIdx(p)]++; });
  closed.forEach((p) => { if (p.close && p.close.slice(0, 7) === TODAY.slice(0, 7)) pipe[8]++; });
  const vacJab = {}; P.filter(isVacant).forEach((p) => { const j = (p.jabatan || '–').trim(); (vacJab[j] = vacJab[j] || []).push(p); });
  const unitTot = DATA.units.reduce((a, b) => a + b.jumlah, 0);
  return { P, planning, vacant, actual, open, cont, closed, ket, openCands, allCands, pipe, vacJab, unitTot };
}
function resumeVacant(D) {
  const entries = Object.entries(D.vacJab).sort((a, b) => b[1].length - a[1].length);
  return `<div class="rgrid">${entries.map(([j, ps]) => {
    const cs = ps.flatMap((p) => candidates(p)); const act = cs.filter((c) => c.st === 'pr' || c.st === 'hd');
    const hi = Math.max(0, ...ps.map(topStage));
    const byStage = {}; act.forEach((c) => { const k = STAGE_UP[c.stage]; byStage[k] = (byStage[k] || 0) + 1; });
    ps.forEach((p) => { if (!candidates(p).some((c) => c.st === 'pr' || c.st === 'hd')) { const k = STAGE_UP[stageIdx(p)]; byStage[k] = (byStage[k] || 0) + 1; } });
    return `<div class="rcard"><div class="hd"><span class="nb">${ps.length}</span>${esc(j)}</div>
      <div class="l1">${act.length} pelamar untuk ${ps.length} vacant</div>
      <div class="l3">${cs.length} kandidat tercatat • ${cs.filter((c) => c.st === 'no').length} tidak lolos</div>
      <div class="l3">${Object.entries(byStage).map(([k, n]) => `${n}× ${k}`).join(' • ')}</div>
      <button type="button" class="more ${ui.jf === j ? 'on' : ''}" data-detail="${esc(j)}">${ui.jf === j ? 'Sedang difilter ✓' : 'Lihat detail →'}</button></div>`;
  }).join('') || '<div class="empty">Tidak ada posisi vacant.</div>'}</div>`;
}

// ---------- MPP page (compact, like the reference web) ----------
function pageMPP(D) {
  const q = ui.mq.toLowerCase();
  const rows = D.P.map((p, i) => [p, i]).filter(([p]) => {
    if (ui.mf !== 'semua' && (!hasPTK(p) || (p.status || '').toLowerCase() !== ui.mf)) return false;
    return !q || `${p.nama} ${p.jabatan} ${p.section} ${p.group} ${p.ket} ${p.ptk} ${candidates(p).map((c) => c.name).join(' ')}`.toLowerCase().includes(q);
  });
  const cnt = (s) => D.P.filter((p) => hasPTK(p) && (p.status || '').toLowerCase() === s).length;
  const kc = (k) => ({ 'JATUH TEMPO': 'crit', 'HAMPIR JATUH TEMPO': 'warn', 'ON TRACK': 'good', 'SELESAI': 'good' }[k] || 'mute');
  const all = D.allCands, c = (s) => all.filter((x) => x.st === s).length;
  const pq = ui.pq.toLowerCase();
  const prow = all.filter((x) => (ui.pf === 'semua' || x.st === ui.pf) && (!pq || `${x.name} ${x.p.jabatan} ${x.note} ${x.sumber || ''}`.toLowerCase().includes(pq))).sort((a, b) => (isOpen(b.p) - isOpen(a.p)) || (a.p.no - b.p.no));
  return `<div class="mhead"><div><div class="eyebrow">Monitoring Manpower KTA - TRA</div><h1>MPP KTA - TRA</h1><p>Planning manpower dan monitoring PTK/rekrutmen.</p></div>
    <div class="mtools">
      <input type="search" id="mq" placeholder="Cari nama / jabatan / kandidat" value="${esc(ui.mq)}" aria-label="Cari di MPP">
      <select id="mfSel" aria-label="Filter status">${[['semua', 'Semua Status'], ['open', `Open (${cnt('open')})`], ['continue', `Continue (${cnt('continue')})`], ['close', `Close (${cnt('close')})`]].map(([k, l]) => `<option value="${k}" ${ui.mf === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      ${CAN_EDIT ? '<button type="button" class="btn btn-y" id="addPos">+ Tambah Data</button>' : ''}
      ${DL ? '<button type="button" class="btn btn-g" data-csv="mpp">Export CSV</button>' : ''}
      ${(DL || IS_TOP) ? '<button type="button" class="btn btn-g" id="printBtn">Print</button>' : ''}
    </div></div>
  <div class="mstats"><div><b>${D.planning}</b><span>Planning</span></div><div><b>${D.actual}</b><span>Actual</span></div><div><b>${D.vacant}</b><span>Vacant</span></div><div><b>${cnt('open') + cnt('continue')}</b><span>Open</span></div><div><b>${cnt('close')}</b><span>Close</span></div></div>
  <div class="card" style="padding:6px 0;margin-bottom:18px"><div class="tw"><table class="t mt">
    <thead><tr><th>No</th><th>Nama</th><th>Jabatan</th><th>Pelamar</th><th>Keterangan</th><th>PTK</th><th>Status</th><th>Progress</th><th>Due Date</th><th>Ket. PTK</th><th>Aksi</th></tr></thead>
    <tbody>${rows.map(([p, i]) => {
      const cs = candidates(p), fl = cs.filter(inFlight), si = stageIdx(p), k = ketPTK(p);
      return `<tr>
        <td>${p.no}</td>
        <td class="${isVacant(p) ? 'vacn' : 'b'}">${esc(p.nama)}</td>
        <td>${esc(p.jabatan)}<div class="small">${esc(p.group || p.section || '')}</div></td>
        <td>${cs.length ? `<button type="button" class="pcount" data-cands="${i}">${cs.length} Pelamar</button>${fl.length ? `<div class="plist">${fl.map((x) => `<div><b>${esc(x.name)}</b><span>${x.status === 'No Response' ? 'NO RESPONSE' : STAGE_UP[x.stage] + ' ' + STAGE_PCT[x.stage] + '%'}</span></div>`).join('')}</div>` : ''}` : '<span class="dash">-</span>'}</td>
        <td class="ket">${esc(p.ket || '-')}</td>
        <td class="ptkc">${esc(p.ptk || '-')}</td>
        <td>${hasPTK(p) ? `<span class="stt ${/close/i.test(p.status) ? 'close' : /continue/i.test(p.status) ? 'cont' : 'open'}">${esc(p.status)}</span>` : '<span class="dash">-</span>'}</td>
        <td><div class="pg"><span class="tr"><i style="width:${STAGE_PCT[si]}%"></i></span><b>${STAGE_PCT[si]}%</b></div><div class="pgl">${STAGE_UP[si]}</div></td>
        <td class="nw">${p.due ? fmt(p.due) : '-'}</td>
        <td><span class="kp ${kc(k)}">${esc(k)}</span></td>
        <td><div class="acts">${CAN_EDIT ? `<button type="button" class="btn btn-g btn-sm" data-epos="${i}">Edit</button>` : ''}${hasPTK(p) || cs.length ? `<button type="button" class="btn btn-y btn-sm" data-cands="${i}">Pelamar</button>` : ''}${CAN_EDIT ? `<button type="button" class="btn btn-g btn-sm red" data-delpos="${i}">Hapus</button>` : ''}</div></td>
      </tr>`; }).join('') || '<tr><td colspan="11" class="empty">Tidak ada data yang cocok.</td></tr>'}</tbody></table></div></div>
  <div class="card">
    <div class="ch"><div><div class="eyebrow">Pelamar</div><h2>Rekap & Arsip Pelamar</h2><p>Semua pelamar dari PTK open maupun close. Pelamar yang tidak lolos tetap tercatat.</p></div></div>
    <div class="apps" style="margin-bottom:16px"><div class="app"><b>${all.length}</b><span>Total pelamar</span></div><div class="app pr"><b>${c('pr')}</b><span>Masih proses</span></div><div class="app hd"><b>${c('hd')}</b><span>Hold</span></div><div class="app no"><b>${c('no')}</b><span>Tidak lolos</span></div><div class="app ok"><b>${c('ok')}</b><span>Diterima</span></div></div>
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Filter hasil">${[['semua', 'Semua'], ['pr', 'Proses'], ['hd', 'Hold'], ['no', 'Tidak lolos'], ['ok', 'Diterima']].map(([k, l]) => `<button type="button" data-pf="${k}" aria-pressed="${ui.pf === k}">${l}</button>`).join('')}</div>
      <input type="search" id="pq" placeholder="Cari nama pelamar, jabatan, atau sumber" value="${esc(ui.pq)}" aria-label="Cari pelamar">
      <span class="small">${prow.length} pelamar</span>
    </div>
    <div class="tw"><table class="t"><thead><tr><th>Nama Pelamar</th><th>Jabatan</th><th>PTK</th><th>Status PTK</th><th>Tahap</th><th>Hasil</th><th>Sumber</th><th>Keterangan</th></tr></thead><tbody>
    ${prow.map((x) => `<tr><td class="b">${esc(x.name)}</td><td class="nw">${esc(x.p.jabatan)} <span class="small">No. ${x.p.no}</span></td><td class="small nw">${esc(x.p.ptk || '-')}</td><td>${hasPTK(x.p) ? `<span class="stt ${isOpen(x.p) ? 'open' : 'close'}">${esc(x.p.status)}</span>` : '-'}</td><td class="small nw">${STAGE_UP[x.stage]} ${STAGE_PCT[x.stage]}%</td><td><span class="hs ${x.st}">${esc(x.status || ST_LBL[x.st])}</span>${x.fromHist ? ' <span class="hs hist">riwayat</span>' : ''}</td><td class="small">${esc(x.sumber || '-')}</td><td class="small">${esc(x.note || '-')}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">Tidak ada pelamar yang cocok.</td></tr>'}
    </tbody></table></div>
  </div>`;
}

// ---------- Pelamar modal ----------
let CANDS_FOR = null;
function openCands(idx) {
  CANDS_FOR = idx; FORM = null;
  const p = DATA.positions[idx], cs = candidates(p), hi = topStage(p);
  document.getElementById('dialog').innerHTML = `<div class="cm-h"><h2 id="mTitle">Pelamar — ${esc(p.jabatan)} (${isVacant(p) ? 'Vacant' : esc(p.nama)} #${p.no})</h2><button type="button" class="x" id="mClose" aria-label="Tutup">×</button></div>
    <div class="cm-sum"><div><b>${cs.length} pelamar</b><span>Progress tertinggi ${STAGE_UP[hi]} (${STAGE_PCT[hi]}%)</span></div>${CAN_EDIT ? '<button type="button" class="btn btn-y" id="addCand">+ Tambah Pelamar</button>' : ''}</div>
    <div class="cm-list">${cs.map((c, ci) => `<div class="cc"><div class="cc-h"><div><b>${esc(c.name)}</b><div class="cc-meta"><span class="hs ${C_BADGE[c.status] || 'no'}">${esc(c.status)}</span><span>${esc(c.sumber || 'Sumber belum diisi')}</span>${c.fromHist ? '<span class="hs hist">riwayat</span>' : ''}</div></div>
      ${CAN_EDIT && !c.fromHist ? `<div class="acts"><button type="button" class="btn btn-g btn-sm" data-ecand="${ci}">Edit</button><button type="button" class="btn btn-g btn-sm red" data-dcand="${ci}">Hapus</button></div>` : ''}</div>
      <div class="cc-pg"><span class="tr"><i style="width:${STAGE_PCT[c.stage]}%"></i></span><b>${STAGE_PCT[c.stage]}%</b><span>${STAGE_UP[c.stage]}</span></div>
      ${c.note ? `<div class="cc-note">${esc(c.note)}</div>` : ''}</div>`).join('') || '<div class="empty">Belum ada pelamar untuk posisi ini.</div>'}</div>
    <div class="factions"><span style="flex:1"></span><button type="button" class="btn btn-g" id="fCancel">Batal</button></div>`;
  document.getElementById('modal').hidden = false; document.getElementById('mClose').focus();
}
function candForm(idx, ci) {
  const p = DATA.positions[idx]; materialize(p);
  const c = ci == null ? null : p.cands[ci];
  openForm({ eyebrow: `Pelamar · ${p.jabatan} #${p.no}`, title: c ? `Edit ${c.name}` : 'Tambah Pelamar',
    values: c ? { ...c, stage: String(c.stage ?? stageIdx(p)) } : { status: 'Aktif', stage: String(stageIdx(p)) },
    fields: [
      { k: 'name', label: 'Nama Pelamar', req: true },
      { k: 'status', label: 'Status', type: 'select', options: C_STATUS },
      { k: 'sumber', label: 'Sumber', list: C_SUMBER, ph: 'Online, Referral, Walk-in…' },
      { k: 'stage', label: 'Tahap Terakhir', type: 'select', options: STAGE_UP.map((s, i) => [String(i), `${s} (${STAGE_PCT[i]}%)`]) },
      { k: 'note', label: 'Keterangan', type: 'textarea', full: true, rows: 3, ph: 'Contoh: Tidak lolos interview user' },
    ],
    onSave: (v) => commit((S) => {
      const pos = S.positions[idx]; materialize(pos);
      const rec = { name: v.name, status: v.status || 'Aktif', sumber: v.sumber, stage: +v.stage || 0, note: v.note };
      if (c) pos.cands[ci] = rec; else pos.cands.push(rec);
      if (rec.status === 'Diterima' && isVacant(pos)) pos.nama = rec.name;
      pos.ket = ketFromCands(pos.cands);
      try { sessionStorage.setItem('mp5-cands', String(idx)); } catch (e) {}
    }, c ? 'Pelamar diperbarui.' : 'Pelamar ditambahkan.') });
}
function delCand(idx, ci) {
  const p = DATA.positions[idx]; const c = p.cands[ci];
  confirmBox(`Hapus pelamar ${c.name}?`, 'Data pelamar ini hilang dari arsip.', () => commit((S) => { const pos = S.positions[idx]; materialize(pos); pos.cands.splice(ci, 1); pos.ket = ketFromCands(pos.cands); try { sessionStorage.setItem('mp5-cands', String(idx)); } catch (e) {} }, 'Pelamar dihapus.'));
}
function mppForm(idx) {
  const p = idx == null ? null : DATA.positions[idx];
  const vals = p ? { ...p } : { nama: 'Vacant', section: SEC_OPTS()[0] || '', status: 'Open', aju: TODAY, pic: 'PT. KAI' };
  if (p) p.stages.forEach((s, i) => { vals['st' + i] = s; });
  openForm({
    eyebrow: 'MPP KTA - TRA', title: p ? `Edit Posisi No. ${p.no}` : 'Tambah Data MPP',
    intro: 'Isi <b>Vacant</b> untuk posisi yang belum terisi. Pelamar dikelola lewat tombol <b>Pelamar</b> di tabel.',
    values: vals,
    sections: [
      { title: 'Posisi', fields: [
        { k: 'section', label: 'Section', list: SEC_OPTS(), req: true },
        { k: 'group', label: 'Sub-section', list: GRP_OPTS(), hint: 'Kosongkan jika sama dengan section.' },
        { k: 'jabatan', label: 'Jabatan', list: JAB_OPTS(), req: true },
        { k: 'nama', label: 'Nama', ph: 'Vacant' },
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
    onSave: (v) => commit((S) => {
      const rec = { section: v.section, group: v.group || v.section, nama: v.nama || 'Vacant', jabatan: v.jabatan, pic: v.pic, ptk: v.ptk, aju: v.aju, stages: STAGE_FIELDS.map((_, i) => v['st' + i] || null), due: v.due, status: v.status, close: v.close };
      if (rec.status === 'Close' && !rec.close) rec.close = TODAY;
      if (p) { S.positions[idx] = { ...S.positions[idx], ...rec }; }
      else {
        let at = -1; S.positions.forEach((x, i) => { if (x.group === rec.group) at = i; });
        if (at < 0) S.positions.forEach((x, i) => { if (x.section === rec.section) at = i; });
        S.positions.splice(at < 0 ? S.positions.length : at + 1, 0, { no: 0, ket: null, cands: [], ...rec });
      }
    }, p ? 'Posisi diperbarui.' : 'Posisi ditambahkan.'),
  });
}
function delPos(idx) { const p = DATA.positions[idx]; confirmBox(`Hapus posisi No. ${p.no} (${p.jabatan} · ${p.nama})?`, 'Planning berkurang 1 posisi, beserta data pelamarnya.', () => commit((S) => { S.positions.splice(idx, 1); }, 'Posisi dihapus.')); }

document.addEventListener('click', (e) => {
  const t = e.target;
  const cd = t.closest('[data-cands]'); if (cd) { openCands(+cd.dataset.cands); return; }
  const dp = t.closest('[data-delpos]'); if (dp && CAN_EDIT) { delPos(+dp.dataset.delpos); return; }
  if (t.closest('#addCand') && CAN_EDIT) { candForm(CANDS_FOR, null); return; }
  const ec = t.closest('[data-ecand]'); if (ec && CAN_EDIT) { candForm(CANDS_FOR, +ec.dataset.ecand); return; }
  const dc = t.closest('[data-dcand]'); if (dc && CAN_EDIT) { delCand(CANDS_FOR, +dc.dataset.dcand); return; }
}, true);
document.addEventListener('change', (e) => { if (e.target.id === 'mfSel') { ui.mf = e.target.value; render(); } });
try { const r = sessionStorage.getItem('mp5-cands'); if (r !== null) { sessionStorage.removeItem('mp5-cands'); if (DATA.positions[+r]) setTimeout(() => openCands(+r), 350); } } catch (e) {}

// ================= v7: dashboard filter by jabatan + active/inactive pipeline =================
ui.jf = null;
function pipeSeries(ps) {
  const act = STAGES.map(() => 0), off = STAGES.map(() => 0);
  ps.forEach((p) => candidates(p).forEach((c) => { const s = Math.min(7, Math.max(0, c.stage ?? stageIdx(p))); if (c.st === 'pr' || c.st === 'hd') act[s]++; else if (c.st === 'no') off[s]++; }));
  return { act, off };
}
function pipeChart(act, off) {
  const W = 640, H = 260, L = 30, R = 16, T = 24, B = 30;
  const max = Math.max(1, ...act, ...off); const top = Math.max(4, Math.ceil(max));
  const x = (i) => L + (W - L - R) * i / (act.length - 1);
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const path = (vals) => { const pts = vals.map((v, i) => [x(i), y(v)]); let d = `M${pts[0][0]} ${pts[0][1]}`; for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; const cx = (x0 + x1) / 2; d += ` C${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`; } return [d, pts]; };
  const [da, pa] = path(act), [dn, pn] = path(off);
  const step = top <= 6 ? 1 : top <= 12 ? 2 : 5;
  let g = '';
  for (let v = 0; v <= top; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${L - 10}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  g += `<defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--primary-2)" stop-opacity=".30"/><stop offset="1" stop-color="var(--primary-2)" stop-opacity=".03"/></linearGradient></defs>`;
  g += `<path d="${da} L${x(act.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z" fill="url(#ag)"/>`;
  g += `<path d="${dn}" fill="none" stroke="var(--c3)" stroke-width="2" stroke-dasharray="5 4"/><path d="${da}" fill="none" stroke="var(--primary)" stroke-width="2.5"/>`;
  pn.forEach(([px, py], i) => { g += `<circle cx="${px}" cy="${py}" r="4" fill="var(--card)" stroke="var(--c3)" stroke-width="2"><title>${STAGES[i]}: ${off[i]} tidak aktif</title></circle>`; if (off[i]) g += `<text x="${px + 9}" y="${py + 4}" style="fill:var(--crit);font-weight:800;font-size:11px">${off[i]}</text>`; });
  pa.forEach(([px, py], i) => { g += `<circle cx="${px}" cy="${py}" r="4.5" fill="var(--card)" stroke="var(--primary)" stroke-width="2.5"><title>${STAGES[i]}: ${act[i]} aktif</title></circle><text class="val" x="${px}" y="${py - 11}" text-anchor="middle">${act[i]}</text><text x="${px}" y="${H - 8}" text-anchor="middle">${STAGE_SHORT[i]}</text>`; });
  const ta = act.reduce((a, b) => a + b, 0), tn = off.reduce((a, b) => a + b, 0);
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Pelamar aktif dan tidak aktif per tahap">${g}</svg></div>
    <div class="legend"><span><i style="background:var(--primary)"></i>Aktif / Hold <b>${ta}</b></span><span><i style="background:var(--c3)"></i>Tidak aktif <b>${tn}</b></span><span class="small">Total ${ta + tn} pelamar PTK open</span></div>`;
}
function pageDashboard(D) {
  const vac = Object.entries(D.vacJab).map(([k, v]) => [k, v.length]).sort((a, b) => b[1] - a[1]);
  const vacCands = Object.values(D.vacJab).flat().reduce((a, p) => a + candidates(p).length, 0);
  const jf = ui.jf;
  const openF = jf ? D.open.filter((p) => (p.jabatan || '').trim() === jf) : D.open;
  const { act, off } = pipeSeries(openF);
  const actOpen = openF.reduce((a, p) => a + candidates(p).filter((c) => c.st === 'pr' || c.st === 'hd').length, 0);
  const allOpen = openF.reduce((a, p) => a + candidates(p).length, 0);
  const chip = jf ? `<div class="fchip">Filter jabatan: <b>${esc(jf)}</b><button type="button" id="clearJf" aria-label="Hapus filter">× Semua jabatan</button></div>` : '';
  return `${header('Overview', 'Dashboard Manpower KTA - TRA', 'Monitoring MPP, actual, vacant, kandidat dan progress rekrutmen dalam satu lokasi.')}
  ${kpis(D)}
  <div class="grid">
    <div class="card s8"><div class="ch"><div><div class="eyebrow">Recruitment Pipeline</div><h2>Progress Kandidat & Rekrutmen</h2><p>Pelamar PTK open per tahap terakhir${jf ? ` · ${esc(jf)}` : ''}: aktif vs tidak aktif.</p></div><span class="pill live">Live data</span></div>${pipeChart(act, off)}</div>
    <div class="card s4"><div class="ch"><div><div class="eyebrow">Composition</div><h2>Pemenuhan MPP</h2><p>Actual dibandingkan vacant.</p></div></div>${donutChart(D.actual, D.vacant)}</div>
    <div class="card s5 vac-card"><div class="ch"><div><div class="eyebrow">Vacancy</div><h2>Vacant per Jabatan</h2><p>Kebutuhan kosong berdasarkan posisi.</p></div><span class="pill">${D.vacant} vacant • ${vacCands} kandidat</span></div>${vac.length ? hbars(vac, (i) => `var(--c${(i % 5) + 1})`) : '<div class="empty">Tidak ada vacant.</div>'}${vacStats(D)}</div>
    <div class="card s7"><div class="ch"><div><div class="eyebrow">Vacant Detail</div><h2>Resume Vacant per Jabatan</h2><p>Klik "Lihat detail" untuk memfilter Summary Progress Rekrutmen.</p></div></div>${resumeVacant(D)}</div>
  </div>
  ${rekapBlock(D)}
  <div class="card ${openF.length ? '' : 'closed'}" id="sumCard" style="margin-bottom:18px"><div class="ch"><div><div class="eyebrow">Recruitment</div><h2>Summary Progress Rekrutmen</h2><p>Data PTK Open dari MPP KTA - TRA.</p></div>${openF.length ? `<span class="pill red">${openF.length} OPEN • ${actOpen} PELAMAR AKTIF • ${allOpen - actOpen} TIDAK AKTIF</span>` : '<span class="pill pgood">CLOSED • SEMUA TERPENUHI</span>'}</div>${chip}${openF.length ? summaryTable(D, openF) : `<div class="closedmsg">Semua PTK sudah terpenuhi<span>Tidak ada PTK open${jf ? ` untuk ${esc(jf)}` : ''}.</span></div>`}</div>
  ${statusBoxes(D)}
  ${unitBlock(D)}
  <div class="card"><div class="ch"><div><h2>Rincian Manpower Planning (MPP)</h2><p>Data otomatis mengikuti sheet MPP. Nama Vacant ditandai merah.</p></div></div>${mppTable(D.P)}</div>`;
}
document.addEventListener('click', (e) => {
  const d = e.target.closest('[data-detail]');
  if (d && ui.page === 'dashboard' && !e.target.closest('#modal')) {
    e.stopPropagation(); ui.jf = d.dataset.detail; render();
    const c = document.getElementById('sumCard'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (e.target.closest('#clearJf')) { e.stopPropagation(); ui.jf = null; render(); }
}, true);

// ================= v8: rekap manpower per jabatan (auto) =================
function rekapJabatan(P) {
  const key = (j) => (j || '–').toLowerCase().replace(/middle/g, 'midle').split(/\s+/).filter(Boolean).sort().join(' ');
  const m = new Map();
  P.forEach((p) => {
    const k = key(p.jabatan);
    if (!m.has(k)) m.set(k, { labels: {}, plan: 0, act: 0, vac: 0, open: 0, pel: 0, secs: new Set() });
    const r = m.get(k); const lb = (p.jabatan || '–').trim(); r.labels[lb] = (r.labels[lb] || 0) + 1;
    r.plan++; if (isVacant(p)) r.vac++; else r.act++;
    if (isOpen(p)) r.open++;
    if (isOpen(p)) r.pel += candidates(p).filter((c) => c.st === 'pr' || c.st === 'hd').length;
    if (p.section) r.secs.add(p.section);
  });
  return [...m.values()].map((r) => ({ ...r, jabatan: Object.entries(r.labels).sort((a, b) => b[1] - a[1])[0][0], secs: [...r.secs] }));
}
function rekapBlock(D) {
  const rows = rekapJabatan(D.P);
  const tot = rows.reduce((a, r) => ({ plan: a.plan + r.plan, act: a.act + r.act, vac: a.vac + r.vac }), { plan: 0, act: 0, vac: 0 });
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const bar = (a, b) => `<div class="pg"><span class="tr"><i style="width:${pct(a, b)}%;${a < b ? '' : 'background:var(--good)'}"></i></span><b>${pct(a, b)}%</b></div>`;
  const sel = (a, b) => a - b === 0 ? '<span class="dd good">0</span>' : `<span class="dd crit">${a - b}</span>`;
  return `<div class="card" style="margin-bottom:18px"><div class="ch"><div><div class="eyebrow">Rekapitulasi</div><h2>Rekapitulasi MPP vs MPA per Jabatan</h2><p>MPP = Manpower Planning, MPA = Manpower Actual (posisi MPP yang sudah terisi nama). Otomatis dari MPP KTA - TRA.</p></div><span class="pill">MPP ${tot.plan} • MPA ${tot.act}</span></div>
  <div class="tw"><table class="t rk"><thead><tr><th>No</th><th>Jabatan</th><th class="n">MPP</th><th class="n">MPA</th><th class="n">Selisih</th><th>% Pemenuhan</th></tr></thead><tbody>
  ${rows.map((r, i) => `<tr><td class="n">${i + 1}</td><td>${jabChip(r.jabatan)}</td><td class="n b">${r.plan}</td><td class="n">${r.act}</td><td class="n">${sel(r.act, r.plan)}</td><td>${bar(r.act, r.plan)}</td></tr>`).join('')}
  </tbody><tfoot><tr><td></td><td class="b">Total</td><td class="n b">${tot.plan}</td><td class="n b">${tot.act}</td><td class="n b">${sel(tot.act, tot.plan)}</td><td>${bar(tot.act, tot.plan)}</td></tr></tfoot></table></div></div>`;
}

function vacStats(D) {
  const ps = Object.values(D.vacJab).flat(); const cs = ps.flatMap((p) => candidates(p));
  const act = cs.filter((c) => c.st === 'pr' || c.st === 'hd').length, no = cs.filter((c) => c.st === 'no').length;
  const late = ps.filter((p) => ketPTK(p) === 'JATUH TEMPO').length, noPtk = ps.filter((p) => !hasPTK(p)).length;
  const t = (cls, n, lb) => `<div class="${cls}"><b>${n}</b><span>${lb}</span></div>`;
  return `<div class="vstats">${t('v1', D.vacant, 'Posisi vacant')}${t('v2', act, 'Pelamar aktif')}${t('v3', no, 'Tidak lolos')}${t('v4', late, 'PTK jatuh tempo')}${noPtk ? t('v5', noPtk, 'Belum ada PTK') : ''}</div>`;
}
