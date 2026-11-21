/* Logika perubahan data Monitoring Manpower (dipakai kta-approval.js dan halaman Aktivitas di Pusat Monitoring):
 * diffDoc(lama, baru) -> daftar perubahan per kolom; applyOps(data, ops) menerapkan; inverse(ops) untuk Kembalikan. */
(function () {
  'use strict';
  // ---------------- util ----------------
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const norm = (v) => (v === undefined || v === '' ? null : v);
  function ss(v) {
    v = norm(v);
    if (Array.isArray(v)) return '[' + v.map(ss).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).filter((k) => k[0] !== '_' && norm(v[k]) !== null).sort().map((k) => JSON.stringify(k) + ':' + ss(v[k])).join(',') + '}';
    return JSON.stringify(v);
  }
  const same = (a, b) => ss(a) === ss(b);
  const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const isoDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const fmtD = (iso) => { const [y, m, d] = iso.split('-'); return `${+d} ${BLN[+m - 1]} ${y}`; };
  const wib = (t) => new Date(new Date(t).getTime() + 7 * 3600e3); // tampilkan dalam WIB
  const dayOf = (t) => wib(t).toISOString().slice(0, 10);
  const jam = (t) => wib(t).toISOString().slice(11, 16);
  const todayWib = () => dayOf(Date.now());
  const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

  // ---------------- data: kunci & label ----------------
  const COLL = {
    positions: { name: 'MPP', key: (it, i) => it.uid || ('#' + i), label: (it) => [it.jabatan, it.nama].filter(Boolean).join(' · ') || 'Posisi' },
    aktif: { name: 'MP Aktif', base: (it) => it.nama, label: (it) => it.nama || 'Karyawan' },
    keluar: { name: 'MP Out', base: (it) => it.nama, label: (it) => it.nama || 'Karyawan' },
    units: { name: 'Populasi Unit', base: (it) => it.unit, label: (it) => it.unit || 'Unit' },
  };
  const STG = ['Psikologi Test', 'Interview User', 'Offering Letter', 'MCU', 'FU MCU', 'On Site', 'Induksi'];
  const FIELD = {
    nama: 'Nama', jabatan: 'Jabatan', ket: 'Keterangan', pic: 'PIC', ptk: 'PTK', aju: 'Tanggal Pengajuan PTK', due: 'Due Date', status: 'Status',
    close: 'Tanggal Close', cands: 'Kandidat', section: 'Section', group: 'Sub-section', atasan: 'Atasan', tier: 'Level struktur', area: 'Area',
    dept: 'Departemen', level: 'Level', kontrak: 'Status Kontrak', masuk: 'Tanggal Masuk', akhir: 'Akhir Kontrak', poh: 'POH', jk: 'Jenis Kelamin',
    kategori: 'Keterangan', site: 'Site', keluar: 'Tanggal Keluar', alasan: 'Alasan Keluar', pendidikan: 'Pendidikan Terakhir', statusData: 'Verifikasi Data',
    catatanHR: 'Catatan Kepegawaian', dariMpp: 'Dari MPP', unit: 'Jenis Unit', jumlah: 'Jumlah', catatan: 'Catatan', details: 'Detail unit',
  };
  const fieldLabel = (f) => { const m = /^stages\.(\d+)$/.exec(f); return m ? (STG[+m[1]] || 'Tahap ' + (+m[1] + 1)) : (FIELD[f] || f); };
  function showVal(v, f) {
    v = norm(v);
    if (v === null) return '–';
    if (isoDate(v)) return fmtD(v);
    if (f === 'cands' && Array.isArray(v)) return v.length ? v.map((c) => c && c.name ? c.name + (c.status ? ' (' + c.status + ')' : '') : '').filter(Boolean).join(', ') : 'tidak ada';
    if (f === 'details' && Array.isArray(v)) return v.length + ' unit';
    if (Array.isArray(v)) return v.map((x) => showVal(x)).join(', ');
    if (typeof v === 'object') return v.nama || v.name || v.unit || JSON.stringify(v).slice(0, 80);
    if (typeof v === 'boolean') return v ? 'Ya' : 'Tidak';
    return String(v);
  }
  function keyed(arr, c) {
    const seen = {};
    return (arr || []).map((it, i) => {
      let k;
      if (COLL[c].key) k = COLL[c].key(it, i);
      else { const b = String(COLL[c].base(it) || '').trim().toLowerCase(); seen[b] = (seen[b] || 0) + 1; k = b + '#' + seen[b]; }
      return [k, it];
    });
  }
  const SKIP = { no: 1, _: 1 };

  // ops: {c,k,l,f,o,n} ubah kolom · {c,k,l,op:'add',item,after} tambah · {c,k,l,op:'del',item} hapus
  function diffDoc(a, b) {
    const ops = [];
    Object.keys(COLL).forEach((c) => {
      const A0 = keyed(a && a[c], c), B0 = keyed(b && b[c], c);
      const am = new Map(A0), bm = new Map(B0);
      A0.forEach(([k, it], i) => { if (!bm.has(k)) ops.push({ c, k, l: COLL[c].label(it), op: 'del', item: clone(it), after: i > 0 ? A0[i - 1][0] : null }); });
      B0.forEach(([k, it], i) => {
        if (!am.has(k)) { ops.push({ c, k, l: COLL[c].label(it), op: 'add', item: clone(it), after: i > 0 ? B0[i - 1][0] : null }); return; }
        const o = am.get(k), l = COLL[c].label(it);
        const fs = new Set(Object.keys(o).concat(Object.keys(it)));
        fs.forEach((f) => {
          if (SKIP[f] || f[0] === '_') return;
          if (f === 'stages' && Array.isArray(o[f]) && Array.isArray(it[f])) {
            const n = Math.max(o[f].length, it[f].length);
            for (let i = 0; i < n; i++) if (!same(o[f][i], it[f][i])) ops.push({ c, k, l, f: 'stages.' + i, o: norm(o[f][i]), n: norm(it[f][i]) });
            return;
          }
          if (!same(o[f], it[f])) ops.push({ c, k, l, f, o: o[f] === undefined ? null : clone(o[f]), n: it[f] === undefined ? null : clone(it[f]) });
        });
      });
    });
    return ops;
  }
  function getF(it, f) { const m = /^stages\.(\d+)$/.exec(f); return m ? (it.stages || [])[+m[1]] : it[f]; }
  function setF(it, f, v) { const m = /^stages\.(\d+)$/.exec(f); if (m) { it.stages = it.stages || []; while (it.stages.length <= +m[1]) it.stages.push(null); it.stages[+m[1]] = v; } else it[f] = v; }
  function findIdx(doc, c, k) { const ks = keyed(doc[c], c); return ks.findIndex(([kk]) => kk === k); }
  // terapkan ke data terbaru; kembalikan daftar yang konflik (nilai sekarang sudah tidak sama dengan nilai lama saat diajukan)
  function applyOps(doc, ops, opt) {
    const conflicts = [], skipped = [];
    ops.forEach((op) => {
      doc[op.c] = doc[op.c] || [];
      const i = findIdx(doc, op.c, op.k);
      if (op.op === 'add') {
        if (i >= 0) { if (!same(doc[op.c][i], op.item)) conflicts.push(op); doc[op.c][i] = clone(op.item); return; }
        const ai = op.after ? findIdx(doc, op.c, op.after) : -1;
        doc[op.c].splice(ai >= 0 ? ai + 1 : (op.after ? doc[op.c].length : 0), 0, clone(op.item));
        return;
      }
      if (op.op === 'del') { if (i < 0) { skipped.push(op); return; } if (!same(doc[op.c][i], op.item)) conflicts.push(op); doc[op.c].splice(i, 1); return; }
      if (i < 0) { skipped.push(op); return; }
      const it = doc[op.c][i];
      if (!same(getF(it, op.f), op.o)) conflicts.push(op);
      setF(it, op.f, op.n === null ? null : clone(op.n));
    });
    if (doc.positions) doc.positions.forEach((p, i) => { p.no = i + 1; });
    return { conflicts, skipped };
  }
  const inverse = (ops) => ops.slice().reverse().map((o) => o.op === 'add' ? { ...o, op: 'del' } : o.op === 'del' ? { ...o, op: 'add' } : { ...o, o: o.n, n: o.o });
  const opText = (o) => o.op === 'add' ? `Tambah ${COLL[o.c] ? COLL[o.c].name : o.c}` : o.op === 'del' ? `Hapus dari ${COLL[o.c] ? COLL[o.c].name : o.c}` : fieldLabel(o.f);
  const opOld = (o) => o.op === 'add' ? '–' : o.op === 'del' ? showVal(o.l) : showVal(o.o, o.f);
  const opNew = (o) => o.op === 'add' ? showVal(o.l) : o.op === 'del' ? 'dihapus' : showVal(o.n, o.f);


  window.KTAOps = { clone, norm, ss, same, BLN, HARI, isoDate, fmtD, wib, dayOf, jam, todayWib, addDays, COLL, STG, FIELD, fieldLabel, showVal, keyed, SKIP, diffDoc, getF, setF, findIdx, applyOps, inverse, opText, opOld, opNew };
})();
