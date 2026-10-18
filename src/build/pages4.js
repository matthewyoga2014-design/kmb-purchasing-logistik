function pageDashboard(D) {
  const vac = Object.entries(D.vacJab).map(([k, v]) => [k, v.length]).sort((a, b) => b[1] - a[1]);
  const vacCands = Object.values(D.vacJab).flat().reduce((a, p) => a + candidates(p).length, 0);
  const actOpen = D.openCands.filter((c) => c.st === 'pr' || c.st === 'hd').length;
  return `${header('Overview', 'Dashboard Manpower KTA - TRA', 'Monitoring MPP, actual, vacant, kandidat dan progress rekrutmen dalam satu lokasi.')}
  ${kpis(D)}
  <div class="grid">
    <div class="card s8"><div class="ch"><div><div class="eyebrow">Recruitment Pipeline</div><h2>Progress Kandidat & Rekrutmen</h2><p>Jumlah kandidat/posisi berdasarkan tahap terakhir.</p></div><span class="pill live">Live data</span></div>${areaChart(D.pipe)}</div>
    <div class="card s4"><div class="ch"><div><div class="eyebrow">Composition</div><h2>Pemenuhan MPP</h2><p>Actual dibandingkan vacant.</p></div></div>${donutChart(D.actual, D.vacant)}</div>
    <div class="card s5"><div class="ch"><div><div class="eyebrow">Vacancy</div><h2>Vacant per Jabatan</h2><p>Kebutuhan kosong berdasarkan posisi.</p></div><span class="pill">${D.vacant} vacant • ${vacCands} kandidat</span></div>${vac.length ? hbars(vac, (i) => `var(--c${(i % 5) + 1})`) : '<div class="empty">Tidak ada vacant.</div>'}</div>
    <div class="card s7"><div class="ch"><div><div class="eyebrow">Vacant Detail</div><h2>Resume Vacant per Jabatan</h2><p>Klik jabatan untuk melihat kandidat terkait.</p></div></div>${resumeVacant(D)}</div>
  </div>
  <div class="card" style="margin-bottom:18px"><div class="ch"><div><div class="eyebrow">Recruitment</div><h2>Summary Progress Rekrutmen</h2><p>Data PTK Open dari MPP KTA - TRA.</p></div><span class="pill red">${D.open.length} OPEN • ${actOpen} PELAMAR</span></div>${summaryTable(D, D.open)}</div>
  ${statusBoxes(D)}
  ${unitBlock(D)}
  <div class="card"><div class="ch"><div><h2>Rincian Manpower Planning (MPP)</h2><p>Data otomatis mengikuti sheet MPP. Nama Vacant ditandai merah.</p></div></div>${mppTable(D.P)}</div>`;
}

function pageMPP(D) {
  const q = ui.mq.toLowerCase();
  const rows = D.P.filter((p) => {
    if (ui.mf !== 'semua') { if (!hasPTK(p) || (p.status || '').toLowerCase() !== ui.mf) return false; }
    return !q || `${p.nama} ${p.jabatan} ${p.section} ${p.group} ${p.ket} ${p.ptk}`.toLowerCase().includes(q);
  });
  let body = '', lastS, lastG;
  rows.forEach((p) => {
    if (ui.mf === 'semua' && !q) {
      if (p.section !== lastS) { body += `<tr class="grpr"><td colspan="19">${esc(p.section || '')}</td></tr>`; lastS = p.section; lastG = p.section; }
      if (p.group !== lastG) { body += `<tr class="subr"><td colspan="19">${esc(p.group)}</td></tr>`; lastG = p.group; }
    }
    const k = ketPTK(p); const kc = { 'JATUH TEMPO': 'crit', 'HAMPIR JATUH TEMPO': 'warn', 'ON TRACK': 'good', 'SELESAI': 'info' }[k] || 'mute';
    const st = (v) => isDate(v) ? fmt(v) : esc(v || '');
    body += `<tr><td class="n">${p.no}</td><td class="${isVacant(p) ? 'vac' : 'b'}">${esc(p.nama)}</td><td class="nw">${esc(p.jabatan)}</td><td class="ket">${esc(p.ket || '')}</td><td class="nw">${esc(p.pic || '')}</td><td class="small nw">${esc(p.ptk || '')}</td><td class="nw">${fmt(p.aju) === '–' ? '' : fmt(p.aju)}</td>${p.stages.map((v) => `<td class="nw">${st(v)}</td>`).join('')}<td class="nw">${p.due ? fmt(p.due) : ''}</td><td>${hasPTK(p) ? `<span class="stt ${/close/i.test(p.status) ? 'close' : /continue/i.test(p.status) ? 'cont' : 'open'}">${esc(p.status)}</span>` : ''}</td><td class="nw">${p.close ? fmt(p.close) : ''}</td><td><span class="dd ${kc}">${esc(k)}</span></td><td class="n">${isClose(p) ? (diff(p.close, p.aju) ?? '') : ''}</td></tr>`;
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
      <span class="small">${rows.length} dari ${D.P.length} posisi</span>
    </div>
    <div class="tw"><table class="t mpp full"><thead><tr><th>No</th><th>Nama</th><th>Jabatan</th><th>Keterangan</th><th>PIC</th><th>PTK</th><th>Tanggal Pengajuan PTK</th><th>Psikologi Test</th><th>Interview User</th><th>Offering Latter</th><th>MCU</th><th>FU MCU</th><th>On Site</th><th>Induksi</th><th>Due Date</th><th>Status</th><th>Tanggal Close</th><th>Keterangan PTK</th><th class="n">Lama Closing (Hari)</th></tr></thead>
    <tbody>${body || '<tr><td colspan="19" class="empty">Tidak ada data yang cocok.</td></tr>'}</tbody></table></div>
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
    <p class="note">Format kolom Keterangan: satu baris per pelamar, <b>Nama - keterangan</b>. Saat PTK close, biarkan nama pelamar yang gagal tetap di kolom ini dan tambahkan nama yang diterima.</p>
  </div>`;
}

const MP_COLS = [
  ['nip', 'No.', (p, i) => i + 1, true],
  ['nama', 'Nama', (p) => `<b style="color:var(--ink)">${esc(p.nama)}</b>`, true],
  ['jabatan', 'Jabatan', (p) => esc(p.jabatan || ''), true],
  ['dept', 'Departemen', (p) => esc(p.dept || ''), false],
  ['level', 'Level', (p) => esc(p.level || ''), true],
  ['kontrak', 'Status Kontrak', (p) => esc(p.kontrak || ''), true],
  ['akhir', 'Akhir Kontrak', (p) => p.akhir ? fmt(p.akhir) : '', true],
  ['poh', 'POH', (p) => esc(p.poh || ''), true],
  ['sisa', 'Sisa Hari', (p) => { if (!p.akhir) return ''; const r = diff(p.akhir, TODAY); return r > 0 ? `<span class="dd ${r <= 30 ? 'warn' : 'good'}">${r}</span>` : '<span class="dd crit">Jatuh Tempo</span>'; }, true],
  ['masuk', 'Tanggal Masuk', (p) => p.masuk ? fmt(p.masuk) : '', true],
  ['masa', 'Masa Kerja', (p) => masaKerja(p.masuk, p.keluar), true],
  ['jk', 'Jenis Kelamin', (p) => esc(p.jk || ''), false],
  ['kategori', 'Keterangan', (p) => esc(p.kategori || ''), false],
  ['site', 'Site', (p) => esc(p.site || ''), false],
];
function masaKerja(a, b) {
  if (!a) return '';
  const s = new Date(a + 'T00:00:00Z'), e = new Date((b || TODAY) + 'T00:00:00Z');
  let y = e.getUTCFullYear() - s.getUTCFullYear(), m = e.getUTCMonth() - s.getUTCMonth(), d = e.getUTCDate() - s.getUTCDate();
  if (d < 0) { m--; d += new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), 0)).getUTCDate(); }
  if (m < 0) { y--; m += 12; }
  return `${y} Tahun ${m} Bulan ${d} hari`;
}
function pageKaryawan(D) {
  const out = ui.kt === 'out';
  const src = out ? DATA.keluar : DATA.aktif, q = ui.kq.toLowerCase();
  const rows = src.filter((p) => !q || `${p.nama} ${p.jabatan} ${p.poh}`.toLowerCase().includes(q));
  const cols = MP_COLS.filter((c) => ui.allCols || c[3]).filter((c) => !(out && c[0] === 'sisa'));
  if (out) cols.push(['keluar', 'Tanggal Keluar', (p) => p.keluar ? fmt(p.keluar) : '']);
  return `${header('Database', out ? 'MP Out' : 'MP Aktif', 'Database manpower KTA - TRA. Data lengkap dapat disinkronkan dari Excel.')}
  <div class="card"><div class="toolbar">
    <div class="seg" role="group" aria-label="Pilih data">${[['aktif', 'MP Aktif'], ['out', 'MP Out']].map(([k, l]) => `<button type="button" data-kt="${k}" aria-pressed="${ui.kt === k}">${l}</button>`).join('')}</div>
    <span class="pill">${src.length} data</span>
    <input type="search" id="kq" placeholder="Cari nama, jabatan, atau POH" value="${esc(ui.kq)}" aria-label="Cari karyawan">
    <button type="button" class="btn btn-g" id="colBtn" aria-pressed="${!!ui.allCols}">${ui.allCols ? 'Kolom Ringkas' : 'Semua Kolom'}</button>
    <button type="button" class="btn btn-p" data-sync="1">Sinkronkan Excel</button>
  </div>
  <div class="tw"><table class="t mpp"><thead><tr>${cols.map((c) => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>
  ${rows.map((p, i) => `<tr>${cols.map((c) => `<td class="nw">${c[2](p, i)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}" class="empty">Tidak ada data.</td></tr>`}
  </tbody></table></div>
  <p class="note">MP Aktif → MP Out terhubung dengan sheet MP Aktif dan MP Out di Excel. Data pribadi (NIK, KK, NPWP, nomor HP, rekening, BPJS, alamat, data keluarga) tidak ditampilkan karena halaman ini bisa dibuka lewat link.</p></div>`;
}
function pageUnit(D) {
  return `${header('Database', 'Populasi Unit KTA - TRA', 'Daftar populasi unit operasional KTA - TRA sesuai data monitoring.')}
  <div class="card"><div class="ch"><div><div class="eyebrow">Populasi Unit</div><h2>Daftar Unit KTA - TRA</h2><p>Terhubung dengan data unit pada Dashboard.</p></div><span class="pill">${D.unitTot} unit</span></div>
  <div class="tw"><table class="t mpp"><thead><tr><th>No</th><th>Jenis Unit</th><th class="n">Jumlah</th><th>Porsi</th></tr></thead><tbody>
  ${DATA.units.map((u, i) => `<tr><td class="n">${i + 1}</td><td class="b">${esc(u.unit)}</td><td class="n">${u.jumlah}</td><td><div class="pg"><span class="tr"><i style="width:${D.unitTot ? u.jumlah / D.unitTot * 100 : 0}%"></i></span><b>${D.unitTot ? Math.round(u.jumlah / D.unitTot * 100) : 0}%</b></div></td></tr>`).join('')}
  <tr><td></td><td class="b">Total</td><td class="n b">${D.unitTot}</td><td></td></tr>
  </tbody></table></div></div>`;
}
function pageSetting(D) {
  return `${header('Sistem', 'Pengaturan', 'Pemilik, editor, sinkronisasi, backup, dan download Excel.')}
  <div class="grid">
    <div class="card s6"><div class="ch"><div><div class="eyebrow">Sinkronisasi</div><h2>Sinkronkan Excel</h2><p>Muat file Excel Monitoring Manpower KTA - TRA versi terbaru. Sheet yang dibaca: DASHBOARD, MPP KTA-TRA, MP Aktif, MP Out.</p></div></div>
      <p class="small" style="margin:0 0 12px">Sumber data saat ini: <b style="color:var(--ink)">${esc(SRC.name)}</b>${SRC.bundled ? ' (data bawaan)' : ` (dimuat ${fmt(SRC.asOf)}, hanya di browser ini)`}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn btn-p" data-sync="1">Sinkronkan Excel</button>${SRC.bundled ? '' : '<button type="button" class="btn btn-g" id="resetSrc">Kembali ke data bawaan</button>'}</div></div>
    <div class="card s6"><div class="ch"><div><div class="eyebrow">Akses</div><h2>Pelihat & Editor</h2></div></div>
      <p class="small" style="margin:0">Semua orang yang membuka link melihat data sebagai <b>Pelihat</b>. Data diubah di file Excel, lalu disinkronkan. Agar semua pelihat melihat data terbaru, kirim file Excel terbaru ke Claude untuk memperbarui halaman ini.</p></div>
  </div>`;
}
