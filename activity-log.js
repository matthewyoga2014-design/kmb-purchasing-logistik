/* Catatan aktivitas (siapa melakukan apa, kapan) untuk semua web monitoring.
 * Ditulis lewat RPC kta_log_activity (hanya Pemilik/Editor yang login, atau link tanpa login yang sah).
 * Hanya Pemilik yang bisa membaca: Pusat Monitoring → Aktivitas.
 * Pemakaian: <script src="../activity-log.js" data-kind="manpower|apd|unit"></script> (dimuat paling akhir),
 * Notulensi memanggil KTALog.init / KTALog.doc dari shim-nya sendiri.
 */
(function () {
  const KIND = (document.currentScript && document.currentScript.dataset.kind) || '';
  const L = window.KTALog = {
    cfg: null, buf: {},
    init(cfg) { this.cfg = cfg; },
    async log(action, detail) {
      const c = this.cfg; if (!c || !action) return;
      let sb; try { sb = c.sb(); } catch (e) { sb = null; } if (!sb) return;
      const lines = Array.isArray(detail) ? detail : detail ? [String(detail)] : [];
      const MAX = 40, txt = (lines.length > MAX ? lines.slice(0, MAX).concat([`… dan ${lines.length - MAX} perubahan lain`]) : lines).join('\n');
      const v = (f) => { try { return f ? f() || null : null; } catch (e) { return null; } };
      try {
        await sb.rpc('kta_log_activity', { p_app: v(c.app), p_site: v(c.site), p_action: String(action).replace(/\s+/g, ' ').trim().slice(0, 300), p_detail: txt || null, p_token: v(c.token), p_page: v(c.page) });
      } catch (e) { /* catatan aktivitas tidak boleh mengganggu penyimpanan */ }
    },
    // gabungkan perubahan beruntun pada dokumen yang sama (mis. mengetik) menjadi satu catatan
    later(key, action, lines, ms) {
      const b = this.buf[key] || (this.buf[key] = { lines: [] });
      b.action = action; lines.forEach((l) => { if (!b.lines.includes(l)) b.lines.push(l); });
      clearTimeout(b.t); b.t = setTimeout(() => { delete this.buf[key]; this.log(b.action, b.lines); }, ms || 6000);
    },
    flushAll() { Object.keys(this.buf).forEach((k) => { const b = this.buf[k]; clearTimeout(b.t); delete this.buf[k]; this.log(b.action, b.lines); }); },
  };
  window.addEventListener('pagehide', () => L.flushAll());

  // ---------- pembanding data ----------
  const LBL = {
    nama: 'Nama', jabatan: 'Jabatan', dept: 'Departemen', level: 'Level', kontrak: 'Status Kontrak', masuk: 'Tgl Masuk', akhir: 'Akhir Kontrak', poh: 'POH',
    jk: 'Jenis Kelamin', kategori: 'Keterangan', site: 'Site', pendidikan: 'Pendidikan', statusData: 'Verifikasi Data', catatanHR: 'Catatan Kepegawaian', keluar: 'Tgl Keluar',
    alasan: 'Alasan Keluar', section: 'Section', group: 'Sub-section', ket: 'Keterangan', pic: 'PIC', ptk: 'PTK', aju: 'Tgl Pengajuan', due: 'Due Date', status: 'Status',
    close: 'Tgl Close', stages: 'Tahap', jumlah: 'Jumlah', unit: 'Unit', qty: 'Qty', type: 'Jenis', date: 'Tanggal', note: 'Catatan', variant: 'Ukuran', person: 'Karyawan',
    warehouse: 'Gudang', location: 'Gudang', source: 'Sumber', condition: 'Kondisi', months: 'Jatah bulan', title: 'Judul', name: 'Nama', kode: 'Kode', tipe: 'Tipe', kondisi: 'Kondisi', lokasi: 'Lokasi',
  };
  const short = (v) => v == null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v).slice(0, 70) : String(v).replace(/\s+/g, ' ').slice(0, 70);
  const same = (a, b) => JSON.stringify(a == null ? null : a) === JSON.stringify(b == null ? null : b);
  function fields(a, b, skip) {
    const out = [];
    new Set([...Object.keys(a || {}), ...Object.keys(b || {})]).forEach((k) => {
      if ((skip && skip.includes(k)) || k.startsWith('_')) return;
      const x = a ? a[k] : undefined, y = b ? b[k] : undefined;
      if (!same(x, y)) out.push(`${LBL[k] || k}: ${short(x)} → ${short(y)}`);
    });
    return out;
  }
  function list(name, A, B, key, lab, skip, extra) {
    const out = [], ma = new Map(), mb = new Map();
    (A || []).forEach((x, i) => ma.set(key(x, i), x)); (B || []).forEach((x, i) => mb.set(key(x, i), x));
    mb.forEach((x, k) => { if (!ma.has(k)) out.push(`${name}: tambah ${lab(x)}`); });
    ma.forEach((x, k) => { if (!mb.has(k)) out.push(`${name}: hapus ${lab(x)}`); });
    mb.forEach((y, k) => {
      const x = ma.get(k); if (!x || same(x, y)) return;
      const f = fields(x, y, skip).concat(extra ? extra(x, y) : []);
      if (f.length) out.push(`${name} ${lab(y)} — ${f.join('; ')}`);
    });
    return out;
  }
  L.fields = fields; L.list = list;

  // ---------- Monitoring Manpower ----------
  function manpower() {
    if (typeof commit !== 'function' || typeof WEB === 'undefined') return;
    L.init({ app: () => PROJ.app, site: () => (PROJ.sites && typeof siteName === 'function' ? siteName() : PROJ.short || ''), sb: () => WEB.sb, token: () => SHARE_KEY, page: () => ui.page });
    const nk = (n) => String(n || '').toLowerCase().replace(/[^a-z]/g, '');
    const posLab = (p) => `No.${p.no} ${p.jabatan || '-'} (${p.nama || 'Vacant'})`;
    const stg = typeof STAGE_FIELDS !== 'undefined' ? STAGE_FIELDS : [];
    function diff(a, b) {
      a = a || {}; b = b || {};
      return [].concat(
        list('MPP', a.positions, b.positions, (p, i) => p.uid || 'n' + p.no || i, posLab, ['no', 'cands', 'stages', 'history', 'hist', 'tier'], (x, y) => {
          const o = [];
          (y.stages || []).forEach((s, i) => { const s0 = (x.stages || [])[i]; if (!same(s0, s)) o.push(`${stg[i] || 'Tahap ' + (i + 1)}: ${short(s0)} → ${short(s)}`); });
          o.push(...list('Pelamar', x.cands, y.cands, (c, i) => nk(c.name) || i, (c) => c.name || '-', ['files', 'ci']));
          return o;
        }),
        list('MP Aktif', a.aktif, b.aktif, (p, i) => nk(p.nama) || i, (p) => p.nama),
        list('MP Out', a.keluar, b.keluar, (p, i) => nk(p.nama) || i, (p) => p.nama),
        list('Unit', a.units, b.units, (u, i) => u.unit || i, (u) => `${u.unit} (${u.jumlah})`),
      );
    }
    const _c = commit;
    commit = async function (mutate, okMsg) {
      let prev = null; try { prev = JSON.parse(JSON.stringify(STATE)); } catch (e) {}
      const r = await _c.apply(this, arguments);
      if (r !== false && prev) {
        try { const lines = diff(prev, STATE); if (lines.length) L.log(okMsg || 'Perubahan tersimpan', lines); } catch (e) {}
      }
      return r;
    };
  }

  // ---------- Monitoring APD ----------
  function apd() {
    if (typeof persist !== 'function' || typeof S === 'undefined') return;
    L.init({ app: () => 'apd', sb: () => S.sb, token: () => (typeof SHARE_KEY !== 'undefined' ? SHARE_KEY : null), page: () => ui.page });
    const pn = (id) => { try { return personName(id); } catch (e) { return id; } };
    const NAME = { receipts: 'APD karyawan', stockIn: 'Stok masuk', adjust: 'Koreksi stok', transfers: 'Mutasi gudang', returns: 'Pengembalian', requests: 'Permintaan', types: 'Jenis APD', warehouses: 'Gudang' };
    const lab = (k, x) => {
      if (x == null || typeof x !== 'object') return short(x);
      const who = x.person ? pn(x.person) : x.location ? 'Gudang ' + x.location : x.from ? `${x.from} → ${x.to}` : x.name || x.code || x.no || '';
      return [who, x.type, x.qty != null ? x.qty + ' unit' : '', x.date].filter(Boolean).join(' · ');
    };
    function diff(a, b) {
      const out = [];
      new Set([...Object.keys(a || {}), ...Object.keys(b || {})]).forEach((k) => {
        const x = a[k], y = b[k]; if (same(x, y)) return;
        if (k === 'images') { out.push('Gambar APD diubah: ' + Object.keys(y || {}).filter((t) => !same((x || {})[t], (y || {})[t])).join(', ')); return; }
        if (k === 'ga') { out.push(...list('Form GA', (x || {}).docs, (y || {}).docs, (d, i) => d.id || d.no || i, (d) => d.no || d.id || '-', ['items'])); return; }
        if (Array.isArray(x) || Array.isArray(y)) {
          const arr = (y || x || []); const objs = arr.length && typeof arr[0] === 'object';
          if (objs) out.push(...list(NAME[k] || k, x, y, (r, i) => r.id || r.code || i, (r) => lab(k, r)));
          else out.push(`${NAME[k] || k}: ${short(x)} → ${short(y)}`);
          return;
        }
        if (x && y && typeof x === 'object') { out.push(...fields(x, y).map((f) => `${k === 'limits' ? 'Batas' : k === 'personOverrides' ? 'Data karyawan' : k} ${f}`)); return; }
        out.push(`${k}: ${short(x)} → ${short(y)}`);
      });
      return out;
    }
    const _p = persist;
    persist = async function (next, msg) {
      let prev = null; try { prev = JSON.parse(JSON.stringify(S.state)); } catch (e) {}
      const r = await _p.apply(this, arguments);
      if (r === true && prev) { try { L.log(msg || 'Perubahan tersimpan', diff(prev, S.state)); } catch (e) {} }
      return r;
    };
  }

  // ---------- Monitoring Unit ----------
  function unit() {
    const U = window.__unitLog; if (!U) return;
    L.init({ app: () => 'unit-monitoring', sb: () => U.sb, token: () => U.GUEST_SHARE });
    const COL = { projects: 'Proyek', units: 'Unit', pengiriman: 'Pengiriman', mobilisasi: 'Mobilisasi', dokumentasi: 'Dokumentasi', revisi: 'Revisi' };
    const lab = (col, r) => { try { return U.label(col, r || {}); } catch (e) { return (r && (r.kode || r.nama || r.id)) || '-'; } };
    const VERB = { add: 'Tambah', update: 'Ubah', remove: 'Hapus', upload: 'Upload' };
    const snap = () => { try { return JSON.parse(JSON.stringify(U.STATE)); } catch (e) { return null; } };
    U.wrap('sheetOp', (orig) => function (op) {
      const prev = snap();
      const job = orig.apply(this, arguments);
      Promise.resolve(job).then(() => {
        const ops = Array.isArray(op) ? op : [op];
        const lines = ops.map((o) => {
          const old = prev && prev[o.col] ? prev[o.col].find((x) => x.id === o.id) : null;
          const rec = o.action === 'remove' ? old : { ...(old || {}), ...(o.data || {}) };
          const f = o.action === 'update' ? fields(old, rec).join('; ') : '';
          return `${VERB[o.action] || o.action} ${COL[o.col] || o.col || ''} ${lab(o.col, rec)}${f ? ' — ' + f : ''}`.trim();
        });
        const a = ops[0] || {};
        L.log(ops.length > 1 ? `${ops.length} perubahan data unit` : `${VERB[a.action] || 'Ubah'} ${COL[a.col] || a.col || 'data'} ${lab(a.col, (prev && prev[a.col] || []).find((x) => x.id === a.id) || a.data)}`, lines);
      }).catch(() => {});
      return job;
    });
    U.wrap('doMutate', (orig) => async function () {
      const prev = snap();
      const r = await orig.apply(this, arguments);
      try {
        const cur = U.STATE, lines = [];
        Object.keys(COL).forEach((c) => lines.push(...list(COL[c], prev && prev[c], cur && cur[c], (x, i) => x.id || i, (x) => lab(c, x))));
        if (lines.length) L.log(lines.length === 1 ? lines[0] : `${lines.length} perubahan data unit`, lines);
      } catch (e) {}
      return r;
    });
  }

  // ---------- Notulensi (dipanggil dari shim) ----------
  const NCOL = { folders: 'Folder', series: 'Notulensi', versions: 'Meeting', files: 'File' };
  L.doc = function (col, id, prev, next, state) {
    try {
      const r = next || prev || {};
      const sr = (sid) => (state && state.series && state.series[sid] && state.series[sid].title) || '';
      const name = col === 'versions' ? `${sr(r.seriesId)} · Meeting ke-${r.no || '?'}` : col === 'files' ? r.name : r.title || r.name || id;
      const verb = !prev ? 'Tambah' : !next ? 'Hapus' : 'Ubah';
      let lines = [];
      if (prev && next) {
        lines = fields(prev, next, ['rows', 'cols', 'updatedAt', 'updatedBy', 'by', 'at', 'ts']);
        if (!same(prev.rows, next.rows)) {
          const a = prev.rows || [], b = next.rows || [];
          const ch = b.filter((x, i) => !same(x, a[i])).length + Math.max(0, a.length - b.length);
          lines.push(`Isi tabel: ${ch} baris berubah (${a.length} → ${b.length} baris)`);
        }
        if (!lines.length) return;
      }
      L.later(col + '|' + id, `${verb} ${NCOL[col] || col} "${short(name)}"`, lines, !prev || !next ? 800 : 8000);
    } catch (e) {}
  };

  const run = () => { try { ({ manpower, apd, unit })[KIND] && ({ manpower, apd, unit })[KIND](); } catch (e) { console.warn('activity-log', e); } };
  run();
})();
