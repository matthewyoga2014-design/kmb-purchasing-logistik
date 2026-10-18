/* Parser: sheets = { sheetName: [[cell,...],...] } (row 0 = Excel row 1, col 0 = column A).
   Dates arrive as Excel serial numbers. Only non-sensitive fields are kept. */
function parseSheets(sheets, cfg) {
  cfg = cfg || (typeof PARSE_CFG !== 'undefined' ? PARSE_CFG : {});
  const names = Object.keys(sheets);
  const find = (re) => names.find((n) => re.test(n));
  const str = (v) => (v === null || v === undefined || v === 0 || v === '0') ? null : (String(v).trim() || null);
  const iso = (v) => {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      const d = new Date(Math.round((v - 25569) * 864e5));
      return d.toISOString().slice(0, 10);
    }
    return null;
  };
  const stage = (v) => { const d = iso(v); if (d) return d; const s = str(v); return s; };

  // ---- MPP (planning) ----
  const mppName = find(cfg.mpp || /MPP/i);
  if (!mppName) throw new Error(`Sheet "${cfg.mppLabel || 'MPP'}" tidak ditemukan di file ini.`);
  const mpp = sheets[mppName];
  const positions = [];
  let section = null, group = null;
  for (let i = 1; i < mpp.length; i++) {
    const r = mpp[i] || [];
    const a = r[0], b = r[1], c = r[2];
    if (typeof a === 'number' && a > 0 && (str(b) || str(c))) {
      positions.push({
        no: a, section, group,
        nama: str(b) || 'Vacant',
        jabatan: str(c),
        ket: str(r[3]),
        pic: str(r[4]),
        ptk: str(r[5]),
        aju: iso(r[6]),
        stages: [7, 8, 9, 10, 11, 12, 13].map((k) => stage(r[k])),
        due: iso(r[14]),
        status: str(r[15]),
        close: iso(r[16]),
      });
    } else if (typeof a !== 'number' && (c === null || c === undefined || c === '') && ((typeof a === 'string' && a.trim()) || (typeof b === 'string' && b.trim()))) {
      const t = (typeof a === 'string' && a.trim()) ? a.trim() : b.trim();
      if (/^vacant$/i.test(t) || /TIDAK ADA/i.test(t)) continue;
      if (/section|penanggung|di luar/i.test(t)) { section = t; group = t; } else { group = t; }
    }
  }

  if (cfg.autoSection) {
    const fam = (j) => { const t = String(j || '').toLowerCase();
      if (/admin|clerk|planner|supervisor|leader|foreman|head|superintendent/.test(t)) return ['Plant Admin & Leader', 'Admin & Leader'];
      if (/magang|intern|ojt/.test(t)) return ['Program Magang', 'Magang'];
      if (/weld/.test(t)) return ['Maintenance Section', 'Welder'];
      if (/helper/.test(t)) return ['Maintenance Section', 'Helper'];
      if (/mekanik|mechanic|electric|tyre/.test(t)) return ['Maintenance Section', 'Mekanik'];
      return ['Maintenance Section', 'Lainnya']; };
    positions.forEach((p) => { if (!p.section) { const f = fam(p.jabatan); p.section = f[0]; p.group = f[1]; } });
    // Keterangan di sheet jobsite KMB sering berisi asal karyawan / catatan, bukan nama pelamar
    const noteOnly = /^(searching|mencari|onsite|on site|menunggu|kmb$|lokal|pinjam)/i;
    positions.forEach((p) => {
      const lines = String(p.ket || '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
      const vac = /^vacant$/i.test(p.nama || '');
      if ((!vac && !p.status) || !lines.some((l) => !noteOnly.test(l))) p.cands = (!vac && /close/i.test(p.status || '')) ? [{ name: p.nama, status: 'Diterima', sumber: null, stage: 7, note: null }] : [];
    });
  }

  // ---- Karyawan (MP Aktif / MP Out) ----
  const norm = (v) => String(v == null ? '' : v).toLowerCase().replace(/\s+/g, ' ').trim();
  const people = (name, withOut) => {
    if (!name) return [];
    const rows = sheets[name];
    let hr = -1;
    for (let i = 0; i < Math.min(rows.length, 12) && hr < 0; i++) { const r = (rows[i] || []).map(norm); if (r.includes('nama') && r.includes('jabatan')) hr = i; }
    const H = hr >= 0 ? (rows[hr] || []).map(norm) : [];
    const col = (test, dflt) => { const k = H.findIndex((h) => h && test(h)); return k >= 0 ? k : dflt; };
    const C = {
      nama: col((h) => h === 'nama', 4), jabatan: col((h) => h === 'jabatan', 8), dept: col((h) => h.startsWith('departemen'), 9),
      level: col((h) => h === 'level', 10), kontrak: col((h) => h.startsWith('status kontrak'), 11), akhir: col((h) => h.startsWith('akhir kontrak'), 12),
      poh: col((h) => h === 'poh', 13), masuk: col((h) => h.startsWith('tanggal') && h.includes('masuk'), 16), jk: col((h) => h.startsWith('jenis kelamin'), 18),
      kategori: col((h) => h === 'keterangan', 26), site: col((h) => h === 'site', -1), tempat: col((h) => h.startsWith('tempat') && h.includes('bekerja'), -1),
      keluar: col((h) => h.startsWith('tanggal keluar'), 57),
    };
    const out = [];
    for (let i = (hr >= 0 ? hr + 1 : 5); i < rows.length; i++) {
      const r = rows[i] || [];
      if (typeof r[0] !== 'number') continue;
      const nama = r[C.nama];
      if (typeof nama !== 'string' || !nama.trim()) continue;
      const tempat = C.tempat >= 0 ? str(r[C.tempat]) : null;
      if (cfg.site && !cfg.site.test(tempat || '')) continue;
      const p = {
        nama: nama.trim(),
        jabatan: str(r[C.jabatan]), dept: str(r[C.dept]), level: str(r[C.level]), kontrak: str(r[C.kontrak]),
        akhir: iso(r[C.akhir]), poh: str(r[C.poh]), masuk: iso(r[C.masuk]), jk: str(r[C.jk]),
        kategori: str(r[C.kategori]), site: C.site >= 0 ? str(r[C.site]) : tempat,
      };
      if (withOut) p.keluar = iso(r[C.keluar]);
      out.push(p);
    }
    return out;
  };
  const aktif = people(find(/aktif/i), false);
  const keluar = people(find(/out|keluar/i), true);

  // ---- Unit (DASHBOARD) ----
  const units = [];
  const dashName = find(/dashboard/i);
  if (dashName && cfg.unitBlock) {
    const d = sheets[dashName];
    for (let i = 0; i < d.length; i++) {
      const r = d[i] || []; const j = r.findIndex((v) => typeof v === 'string' && cfg.unitBlock.test(v.trim()));
      if (j < 0 || !(d[i + 1] && norm(d[i + 1][j]) === 'unit')) continue;
      for (let k = i + 2; k < d.length; k++) {
        const n = (d[k] || [])[j];
        if (typeof n === 'string' && /^total/i.test(n.trim())) break;
        if (typeof n === 'string' && n.trim()) units.push({ unit: n.trim(), jumlah: typeof d[k][j + 1] === 'number' ? d[k][j + 1] : 0 });
      }
      break;
    }
  } else if (dashName) {
    const d = sheets[dashName];
    let hr = -1, hc = -1;
    for (let i = 0; i < d.length && hr < 0; i++) {
      const r = d[i] || [];
      for (let j = 0; j < r.length; j++) if (typeof r[j] === 'string' && /^jenis unit$/i.test(r[j].trim())) { hr = i; hc = j; break; }
    }
    if (hr >= 0) {
      for (let i = hr + 1; i < d.length; i++) {
        const r = d[i] || [];
        const n = r[hc];
        if (typeof n !== 'string' || !n.trim()) break;
        if (/^total$/i.test(n.trim())) break;
        units.push({ unit: n.trim(), jumlah: typeof r[hc + 1] === 'number' ? r[hc + 1] : 0 });
      }
    }
  }

  return { positions, aktif, keluar, units };
}
if (typeof module !== 'undefined') module.exports = { parseSheets };
