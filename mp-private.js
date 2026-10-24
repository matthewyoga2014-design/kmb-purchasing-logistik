/* Data lengkap karyawan (MP Aktif & MP Out) + Aktifkan kembali.
 * Data pribadi (NIK, KK, NPWP, HP, rekening, BPJS, alamat, keluarga, kontak darurat, mess) disimpan di tabel
 * Supabase terpisah `kta_mp_private` yang hanya bisa dibaca/diubah Pemilik & Editor yang login (RLS).
 * Data operasional tetap di kta_web_state seperti sebelumnya; Pelihat & link tanpa login tidak menerima data pribadi.
 */
(function () {
  if (typeof WEB === 'undefined' || typeof pageKaryawan === 'undefined' || typeof MP_COLS === 'undefined') return;
  const T = 'kta_mp_private';
  const PV = { rows: {}, sig: '', loading: false, err: null, pending: null };
  const ok = () => !!(WEB.sb && WEB.user && !SHARE_KEY && (WEB.role === 'owner' || WEB.role === 'editor'));
  const siteIds = () => PROJ.sites ? PROJ.sites.map((s) => s.id) : [WEB_ID];
  const key = (n) => normName(n);
  const isoD = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

  // ---------- daftar kolom (urutan mengikuti file database HR) ----------
  const SEC = {
    id: 'Identitas', kt: 'Kontak & Alamat', rk: 'Rekening & BPJS', ot: 'Orang Tua', sd: 'Saudara Kandung', em: 'Kontak Darurat (Emergency Call)', ms: 'Mess',
  };
  const PF = [
    ['nip', 'NIP (Karyawan)', '', 'id'], ['nik', 'NIK KTP', '', 'id'], ['kk', 'No. KK', '', 'id'], ['npwp', 'No. NPWP', '', 'id'],
    ['agama', 'Agama', 'agama', 'id'], ['tmpLahir', 'Tempat Lahir', '', 'id'], ['tglLahir', 'Tanggal Lahir', 'date', 'id'],
    ['hp', 'Nomor HP', '', 'kt'], ['wa', 'WhatsApp', '', 'kt'], ['tempatKerja', 'Tempat Bekerja', '', 'kt'],
    ['alamatDom', 'Alamat Domisili', 'long', 'kt'], ['alamat', 'Alamat Lengkap (KTP)', 'long', 'kt'],
    ['rek', 'No. Rekening', '', 'rk'], ['bank', 'Nama Bank', '', 'rk'], ['rekNama', 'Nama Pemilik Rekening', '', 'rk'],
    ['bpjsKes', 'No. BPJS Kesehatan', '', 'rk'], ['bpjsTk', 'No. BPJS Ketenagakerjaan', '', 'rk'],
    ['ibu', 'Nama Ibu', '', 'ot'], ['ibuPend', 'Pendidikan Terakhir Ibu', '', 'ot'], ['ibuKerja', 'Pekerjaan Ibu', '', 'ot'],
    ['ayah', 'Nama Ayah', '', 'ot'], ['ayahPend', 'Pendidikan Terakhir Ayah', '', 'ot'], ['ayahKerja', 'Pekerjaan Ayah', '', 'ot'],
  ];
  for (let n = 1; n <= 4; n++) PF.push([`sdr${n}`, `Saudara Kandung (${n})`, '', 'sd'], [`sdr${n}Jk`, `Jenis Kelamin (${n})`, 'jk', 'sd'], [`sdr${n}Tgl`, `Tanggal Lahir (${n})`, 'date', 'sd']);
  PF.push(['emNama', 'Nama', '', 'em'], ['emHub', 'Hubungan', '', 'em'], ['emHp', 'Nomor Telepon', '', 'em'], ['emWa', 'WhatsApp', '', 'em'],
    ['status', 'Status', '', 'ms'], ['kamar', 'Blok Kamar', '', 'ms']);
  const DATE_K = new Set(PF.filter((f) => f[2] === 'date').map((f) => f[0]));
  const PHONE_K = new Set(['hp', 'wa', 'emHp', 'emWa']);

  const umur = (d) => {
    if (!isoD(d)) return '';
    const b = new Date(d + 'T00:00:00Z'), t = new Date(TODAY + 'T00:00:00Z');
    let y = t.getUTCFullYear() - b.getUTCFullYear();
    if (t.getUTCMonth() < b.getUTCMonth() || (t.getUTCMonth() === b.getUTCMonth() && t.getUTCDate() < b.getUTCDate())) y--;
    return y >= 0 && y < 120 ? y + ' th' : '';
  };
  const showV = (k, v) => v == null || v === '' ? '' : DATE_K.has(k) && isoD(v) ? fmt(v) : String(v);

  // ---------- data pribadi per orang ----------
  function getP(p, site) {
    const k = key(p && p.nama); if (!k) return null;
    if (site && PV.rows[site] && PV.rows[site][k]) return PV.rows[site][k];
    if (PV.rows[WEB_ID] && PV.rows[WEB_ID][k]) return PV.rows[WEB_ID][k];
    for (const s of Object.keys(PV.rows)) if (PV.rows[s][k]) return PV.rows[s][k];
    return null;
  }
  function siteOf(p) {
    const k = key(p && p.nama);
    if (PV.rows[WEB_ID] && PV.rows[WEB_ID][k]) return WEB_ID;
    for (const s of Object.keys(PV.rows)) if (PV.rows[s][k]) return s;
    return null;
  }
  async function load() {
    const sig = ok() ? `${WEB.user.email}|${WEB.role}|${siteIds().join(',')}` : '';
    if (sig === PV.sig || PV.loading) return;
    PV.sig = sig; PV.rows = {}; PV.err = null;
    if (!sig) return;
    PV.loading = true;
    try {
      for (let from = 0; from < 20000; from += 1000) {
        const r = await WEB.sb.from(T).select('site_id,pkey,data').in('site_id', siteIds()).range(from, from + 999);
        if (r.error) throw r.error;
        r.data.forEach((x) => { (PV.rows[x.site_id] = PV.rows[x.site_id] || {})[x.pkey] = x.data || {}; });
        if (r.data.length < 1000) break;
      }
    } catch (e) { PV.err = (e && e.message) || 'gagal memuat'; }
    PV.loading = false;
    if (ui.page === 'karyawan' && document.getElementById('modal').hidden) render();
  }
  async function upsertRows(rows) {
    for (let i = 0; i < rows.length; i += 300) {
      const r = await WEB.sb.from(T).upsert(rows.slice(i, i + 300), { onConflict: 'site_id,pkey' });
      if (r.error) throw r.error;
    }
    rows.forEach((x) => { (PV.rows[x.site_id] = PV.rows[x.site_id] || {})[x.pkey] = x.data; });
  }

  // ---------- baca kolom pribadi dari Excel saat "Sinkronkan Excel" ----------
  const norm = (v) => String(v == null ? '' : v).toLowerCase().replace(/\s+/g, ' ').trim();
  const OPS = [/^no\.?$/, /^nama$/, /^jabatan/, /^departemen/, /^level/, /^status kontrak/, /^akhir kontrak/, /^poh$/, /^sisa hari/, /^reminder/,
    /^(tanggal|tgl).{0,3}masuk/, /^masa kerja/, /^jenis kelamin/, /^umur/, /^usia/, /^keterangan/, /^site$/, /^(tanggal|tgl).{0,3}keluar/];
  const RULES = [
    ['nip', /^nip\b|^nip|induk karyawan/], ['nik', /^nik/], ['kk', /^no\.? ?kk|^nomor kk|kartu keluarga/], ['npwp', /npwp/],
    ['ibuPend', /pendidikan.*ibu/], ['ibuKerja', /pekerjaan.*ibu/], ['ibu', /ibu/],
    ['ayahPend', /pendidikan.*ayah/], ['ayahKerja', /pekerjaan.*ayah/], ['ayah', /ayah/],
    ['_pend', /^pendidikan/], ['_alasan', /alasan/],
    ['wa', /^wh?ats|^wa$/], ['hp', /^(nomor|no\.?) ?(hp|handphone|telp|telf|telep)|^hp$|^telepon|^telfon/],
    ['agama', /^agama/], ['tmpLahir', /^tempat lahir/], ['tglLahir', /lahir/],
    ['alamatDom', /domisili/], ['alamat', /^alamat/], ['tempatKerja', /^tempat.*bekerja/],
    ['rekNama', /pemilik/], ['bank', /bank/], ['rek', /rek/],
    ['bpjsTk', /bpjs.*(tk|ketenaga|tenaga kerja)/], ['bpjsKes', /bpjs/],
    ['status', /^status$/], ['kamar', /kamar/],
  ];
  function headerMap(H, G, raw) {
    const map = [], used = new Set(); let sdr = 0, em = false;
    H.forEach((h, c) => {
      if (!h) return;
      if ((G[c] && /emergency|darurat/.test(G[c])) || /emergency|darurat/.test(h)) em = true;
      let k = /^(tanggal|tgl).{0,3}keluar/.test(h) ? '-' : /alasan/.test(h) ? '_alasan' : null;
      if (k) { /* sudah dikenali */ }
      else if (em) {
        if (/hubungan/.test(h)) k = 'emHub'; else if (/wh?ats/.test(h)) k = 'emWa';
        else if (/telp|telf|telep|hp|nomor|no\./.test(h)) k = 'emHp'; else if (/nama/.test(h)) k = 'emNama';
        else if (/^status$/.test(h)) k = 'status'; else if (/kamar/.test(h)) k = 'kamar';
      } else if (/saudara/.test(h)) { const m = h.match(/(\d)/); sdr = m ? +m[1] : sdr + 1; k = 'sdr' + sdr; }
      else if (sdr && /kelamin/.test(h)) { const m = h.match(/(\d)/); k = `sdr${m ? +m[1] : sdr}Jk`; }
      else if (sdr && /lahir/.test(h)) { const m = h.match(/(\d)/); k = `sdr${m ? +m[1] : sdr}Tgl`; }
      else if (sdr && h === 'nama') { em = true; k = 'emNama'; }
      else if (OPS.some((re) => re.test(h))) k = '-';
      else { const r = RULES.find(([kk, re]) => !used.has(kk) && re.test(h)); k = r ? r[0] : 'x:' + String(raw[c]).replace(/\s+/g, ' ').trim(); }
      if (!k) k = 'x:' + String(raw[c]).replace(/\s+/g, ' ').trim();
      if (k !== '-' && !used.has(k)) { used.add(k); map.push([c, k]); }
    });
    return map;
  }
  function val(k, v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') {
      if (DATE_K.has(k) && v > 1000 && v < 80000) return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);
      if (v === 0) return null;
      let s = v.toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: 0 });
      if (PHONE_K.has(k) && !/^(0|62)/.test(s)) s = '0' + s;
      return s;
    }
    let s = String(v).trim();
    if (!s || s === '-' || s === '0') return null;
    if (DATE_K.has(k)) { const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/); if (m) s = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
    return s;
  }
  function extract(sheets, cfg) {
    const names = Object.keys(sheets || {}), find = (re) => names.find((n) => re.test(n));
    const res = {};
    [[find(/aktif/i), 'aktif'], [find(/out|keluar/i), 'out']].forEach(([nm, kind]) => {
      if (!nm) return;
      const rows = sheets[nm] || [];
      let hr = -1;
      for (let i = 0; i < Math.min(rows.length, 12) && hr < 0; i++) { const r = (rows[i] || []).map(norm); if (r.includes('nama') && r.includes('jabatan')) hr = i; }
      if (hr < 0) return;
      const raw = rows[hr] || [], H = raw.map(norm);
      const G = []; let g = ''; (rows[hr - 1] || []).forEach((x, c) => { const n = norm(x); if (n) g = n; G[c] = /emergency|darurat/.test(g) ? g : n; });
      const map = headerMap(H, G, raw);
      const cN = H.indexOf('nama'), cT = H.findIndex((h) => h.startsWith('tempat') && h.includes('bekerja'));
      for (let i = hr + 1; i < rows.length; i++) {
        const r = rows[i] || [];
        if (typeof r[0] !== 'number') continue;
        const nama = r[cN]; if (typeof nama !== 'string' || !nama.trim()) continue;
        if (cfg && cfg.site && !cfg.site.test(cT >= 0 && r[cT] != null ? String(r[cT]) : '')) continue;
        const data = {}, x = {};
        map.forEach(([c, k]) => { const v = val(k, r[c]); if (v == null) return; if (k.startsWith('x:')) x[k.slice(2)] = v; else data[k] = v; });
        if (Object.keys(x).length) data._x = x;
        res[key(nama)] = { nama: nama.trim(), kind, data };
      }
    });
    return res;
  }
  const _parse = parseSheets;
  parseSheets = function (sheets, cfg) {
    const out = _parse.apply(this, arguments);
    try {
      const cap = extract(sheets, cfg || (typeof PARSE_CFG !== 'undefined' ? PARSE_CFG : null));
      const fill = (p) => { const c = cap[key(p.nama)]; if (!c) return; if (!p.pendidikan && c.data._pend) p.pendidikan = c.data._pend; if (!p.alasan && c.data._alasan) p.alasan = c.data._alasan; };
      (out.aktif || []).forEach(fill); (out.keluar || []).forEach(fill);
      Object.values(cap).forEach((c) => { delete c.data._pend; delete c.data._alasan; });
      PV.pending = { site: WEB_ID, t: Date.now(), map: cap };
    } catch (e) { console.warn('mp-private: kolom pribadi tidak terbaca', e); }
    return out;
  };
  const _commit = commit;
  commit = async function (mutate, okMsg) {
    const r = await _commit.apply(this, arguments);
    const p = PV.pending;
    if (r !== false && okMsg === 'Data disinkronkan dari Excel.' && p && p.site === WEB_ID && Date.now() - p.t < 30 * 60e3) {
      PV.pending = null;
      const list = Object.entries(p.map).filter(([, o]) => Object.keys(o.data).length);
      if (!list.length) return r;
      if (!ok()) { toast('Data pribadi dari Excel tidak disimpan: masuk dengan akun Pemilik/Editor untuk menyimpannya.', true); return r; }
      if (!PV.rows[p.site] && PV.loading) await new Promise((res) => setTimeout(res, 1500));
      const now = new Date().toISOString();
      const rows = list.map(([k, o]) => ({ site_id: p.site, pkey: k, data: { ...((PV.rows[p.site] || {})[k] || {}), ...o.data, _nama: o.nama }, updated_at: now, updated_by: WEB.user.email }));
      try { await upsertRows(rows); toast(`Data disinkronkan dari Excel. Data lengkap ${rows.length} karyawan tersimpan (khusus Pemilik & Editor).`); render(); }
      catch (e) { toast('Data operasional tersimpan, tetapi data pribadi gagal disimpan: ' + ((e && e.message) || 'periksa koneksi'), true); }
    }
    return r;
  };

  // ---------- form data lengkap per karyawan ----------
  const AGAMA = [['', '—'], 'Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'];
  const JK = [['', '—'], 'Laki - Laki', 'Perempuan'];
  function pvForm(site, p) {
    const cur = getP(p, site) || {};
    const s0 = siteOf(p) || site || WEB_ID;
    const fld = (f) => ({ k: f[0], label: f[1], type: f[2] === 'date' ? 'date' : f[2] === 'long' ? 'textarea' : (f[2] === 'agama' || f[2] === 'jk') ? 'select' : undefined,
      options: f[2] === 'agama' ? AGAMA.concat(cur[f[0]] && !AGAMA.includes(cur[f[0]]) ? [cur[f[0]]] : []) : f[2] === 'jk' ? JK.concat(cur[f[0]] && !JK.includes(cur[f[0]]) ? [cur[f[0]]] : []) : undefined,
      rows: 2, full: f[2] === 'long', freeText: true, hint: f[0] === 'tglLahir' && umur(cur.tglLahir) ? 'Umur ' + umur(cur.tglLahir) : undefined });
    const sections = Object.keys(SEC).map((s) => ({ title: SEC[s], fields: PF.filter((f) => f[3] === s).map(fld) }));
    const x = cur._x || {};
    const xs = Object.keys(x);
    if (xs.length) sections.push({ title: 'Kolom lain dari Excel', fields: xs.map((h, i) => ({ k: '_x' + i, label: esc(h), freeText: true })) });
    const vals = { ...cur }; xs.forEach((h, i) => { vals['_x' + i] = x[h]; });
    openForm({
      eyebrow: 'Data Lengkap · khusus Pemilik & Editor', title: p.nama,
      intro: `${esc(p.jabatan || '')}${p.jabatan ? ' · ' : ''}Data pribadi disimpan terpisah dan tidak terlihat oleh Pelihat atau link tanpa login.`,
      values: vals, sections, submit: 'Simpan',
      onSave: async (v) => {
        if (!ok()) { toast('Masuk dengan akun Pemilik/Editor untuk menyimpan.', true); return false; }
        const data = {};
        PF.forEach((f) => { const t = v[f[0]]; if (t !== null && t !== undefined && String(t).trim() !== '') data[f[0]] = String(t).trim(); });
        if (xs.length) { data._x = {}; xs.forEach((h, i) => { const t = v['_x' + i]; if (t != null && String(t).trim() !== '') data._x[h] = String(t).trim(); }); }
        data._nama = p.nama;
        try { await upsertRows([{ site_id: s0, pkey: key(p.nama), data, updated_at: new Date().toISOString(), updated_by: WEB.user.email }]); }
        catch (e) { toast('Gagal menyimpan data lengkap: ' + ((e && e.message) || 'periksa koneksi'), true); return false; }
        toast('Data lengkap ' + p.nama + ' tersimpan.'); setTimeout(render, 0); return true;
      },
    });
  }

  // ---------- MP Out → MP Aktif ----------
  const jk2 = (j) => (typeof jabKey === 'function' ? jabKey(j) : normName(j));
  function restoreForm(idx) {
    const p = DATA.keluar[idx]; if (!p) return;
    const vac = DATA.positions.map((x, i) => [x, i]).filter(([x]) => isVacant(x));
    const same = vac.filter(([x]) => jk2(x.jabatan) === jk2(p.jabatan)), rest = vac.filter(([x]) => jk2(x.jabatan) !== jk2(p.jabatan));
    const opt = ([x, i]) => [String(i), `No. ${x.no} · ${x.jabatan || '-'} · ${x.group || x.section || '-'}`];
    openForm({
      eyebrow: 'MP Out → MP Aktif', title: `Aktifkan kembali ${p.nama}`, submit: 'Aktifkan kembali',
      intro: `Data dipindah lagi ke MP Aktif lengkap dengan datanya${ok() ? ' (termasuk data pribadi)' : ''}. Tanggal keluar sebelumnya dicatat di Catatan Kepegawaian.`,
      values: { masuk: p.masuk || TODAY, akhir: p.akhir || '', fill: same.length ? String(same[0][1]) : rest.length ? String(rest[0][1]) : IS_OWNER ? 'new' : '' },
      fields: [
        { k: 'masuk', label: 'Tanggal Masuk', type: 'date', req: true, hint: 'Ganti bila masuk kembali dengan tanggal baru.' },
        { k: 'akhir', label: 'Akhir Kontrak', type: 'date' },
        { k: 'fill', label: 'Posisi di MPP', type: 'select', full: true, req: true,
          options: (vac.length || IS_OWNER ? [] : [['', 'Tidak ada posisi Vacant']]).concat(same.map(opt), rest.map(opt), IS_OWNER ? [['new', `Tambah posisi baru: ${p.jabatan || '-'}`]] : []),
          hint: 'MP Aktif mengikuti MPP, jadi karyawan perlu menempati satu posisi. ' + (vac.length ? (same.length ? 'Posisi Vacant dengan jabatan yang sama ditampilkan paling atas.' : 'Tidak ada Vacant dengan jabatan yang sama.') : IS_OWNER ? 'Tidak ada posisi Vacant, posisi baru akan ditambahkan.' : 'Tidak ada posisi Vacant: minta Pemilik menambah posisi dulu.') },
      ],
      onSave: (v) => commit((S) => {
        let j = S.keluar[idx] && normName(S.keluar[idx].nama) === normName(p.nama) ? idx : S.keluar.findIndex((x) => normName(x.nama) === normName(p.nama));
        if (j < 0) return;
        let pos = null;
        if (v.fill === 'new' && IS_OWNER) {
          const like = S.positions.find((x) => jk2(x.jabatan) === jk2(p.jabatan)) || {};
          pos = { uid: typeof newUid === 'function' ? newUid() : 'p' + Date.now().toString(36), no: S.positions.length + 1, section: like.section || null, group: like.group || null, nama: 'Vacant', jabatan: p.jabatan || null,
            ket: null, pic: null, ptk: null, aju: null, stages: [null, null, null, null, null, null, null], due: null, status: null, close: null, cands: [] };
          S.positions.push(pos);
        } else if (v.fill !== null && v.fill !== undefined && v.fill !== '') pos = S.positions[+v.fill];
        if (!pos || !isVacant(pos)) return;
        const [rec] = S.keluar.splice(j, 1);
        const note = `Pernah keluar ${rec.keluar ? fmt(rec.keluar) : ''}${rec.alasan ? ' (' + rec.alasan + ')' : ''}, aktif kembali ${fmt(v.masuk)}`.replace('keluar ,', 'keluar,');
        delete rec.keluar; delete rec.alasan;
        rec.masuk = v.masuk; rec.akhir = v.akhir || null;
        rec.catatanHR = rec.catatanHR ? rec.catatanHR + '; ' + note : note;
        S.aktif.push(rec);
        pos.nama = rec.nama;
      }, `${p.nama} aktif kembali di MP Aktif.`),
    });
  }

  // ---------- tampilan MP Aktif / MP Out ----------
  const PCOLS = [];
  PF.forEach((f) => {
    const sub = f[3] === 'sd' ? '' : f[3] === 'em' ? 'Emergency · ' : '';
    PCOLS.push(['pv_' + f[0], sub + f[1], (p) => esc(showV(f[0], (getP(p) || {})[f[0]])), true]);
    if (f[0] === 'tglLahir') PCOLS.push(['pv_umur', 'Umur', (p) => umur((getP(p) || {}).tglLahir), true]);
  });
  const _page = pageKaryawan;
  pageKaryawan = function (D) {
    const full = ok() && ui.allCols;
    if (full) MP_COLS.push(...PCOLS);
    let h;
    try { h = _page.apply(this, arguments); } finally { if (full) MP_COLS.splice(MP_COLS.length - PCOLS.length, PCOLS.length); }
    const out = ui.kt === 'out';
    if (CAN_EDIT) {
      h = h.replace(/<span class="acts">([\s\S]*?)<\/span><\/td>/g, (m, inner) => {
        let site = WEB_ID, kind, i;
        const a = inner.match(/data-empx="([^"|]+)\|(aktif|out)\|(\d+)"/), b = inner.match(/data-emp="(aktif|out):(\d+)"/);
        if (a) { site = a[1]; kind = a[2]; i = a[3]; } else if (b) { kind = b[1]; i = b[2]; } else return m;
        let add = '';
        if (ok()) add += `<button type="button" class="ab pvb" data-pv="${site}|${kind}|${i}" title="Data lengkap (pribadi)">DATA</button>`;
        if (kind === 'out') add += `<button type="button" class="ab inb" data-mpin="${site}|${i}" title="Aktifkan kembali ke MP Aktif">AKTIFKAN</button>`;
        return `<span class="acts">${inner}${add}</span></td>`;
      });
    }
    const note = ok()
      ? `Data pribadi lengkap (NIK, KK, NPWP, HP, rekening, BPJS, alamat, keluarga, kontak darurat) tersimpan terpisah dan hanya bisa dibuka Pemilik & Editor yang login: klik <b>Semua Kolom</b> untuk melihat semuanya atau tombol <b>DATA</b> untuk mengubah per karyawan.${out ? ' Tombol <b>AKTIFKAN</b> memindahkan karyawan kembali ke MP Aktif.' : ''}`
      : `Data pribadi (NIK, KK, NPWP, nomor HP, rekening, BPJS, alamat, data keluarga) hanya bisa dilihat Pemilik & Editor yang login.${out && CAN_EDIT ? ' Tombol <b>AKTIFKAN</b> memindahkan karyawan kembali ke MP Aktif.' : ''}`;
    h = h.replace(/Data pribadi \([^)]*\) tidak disimpan di web ini\.?/, note);
    if (ok()) {
      const n = Object.values(PV.rows).reduce((a, r) => a + Object.keys(r).length, 0);
      const st = PV.loading ? 'memuat data pribadi…' : PV.err ? 'data pribadi gagal dimuat: ' + esc(PV.err) : `data pribadi ${n} karyawan`;
      h = h.replace(/(<div class="small" style="margin:-4px 0 10px">)([\s\S]*?)(<\/div>)/, (m, a, b, c) => `${a}${b} · <span title="Bisa dilihat dan diubah Pemilik & Editor">${st}</span>${DL ? ' · <button type="button" class="lnk" id="pvXlsx">Download Excel Lengkap</button>' : ''}${c}`);
    }
    return h;
  };
  const _render = render;
  render = function () { const r = _render.apply(this, arguments); load(); return r; };

  // ---------- Excel lengkap (format database HR) ----------
  function exportFull() {
    if (typeof XLSX === 'undefined') { toast('Pembuat Excel belum termuat. Coba lagi sebentar.', true); return; }
    const rowsOf = (kind) => PROJ.sites && typeof siteRows === 'function' ? siteRows(kind) : (kind === 'out' ? DATA.keluar : DATA.aktif).map((p, i) => ({ p, i, site: null }));
    const dt = (v) => isoD(v) ? new Date(v + 'T00:00:00Z') : (v || '');
    const sheet = (kind) => {
      const head = ['No.', 'NIP (Karyawan)', 'NIK KTP', 'No. KK', 'Nama', 'No. NPWP', 'Nomor HP', 'WhatsApp', 'Jabatan', 'Departemen', 'Level', 'Status Kontrak PKWT/PKWTT', 'Akhir Kontrak', 'POH',
        'Tanggal Masuk', 'Masa Kerja', 'Jenis Kelamin', 'Agama', 'Tempat Lahir', 'Tgl Lahir', 'Umur', 'Pendidikan Terakhir', 'Alamat Domisili', 'Alamat Lengkap', 'Keterangan', 'Tempat Bekerja', 'Site',
        'No Rekening', 'Nama Bank', 'Nama Pemilik Rekening', 'Nomor BPJS Kesehatan', 'Nomor BPJS Ketenagakerjaan', 'Nama Ibu', 'Pendidikan Terakhir Ibu', 'Pekerjaan Ibu', 'Nama Ayah', 'Pendidikan Terakhir Ayah', 'Pekerjaan Ayah'];
      for (let n = 1; n <= 4; n++) head.push(`Saudara Kandung (${n})`, `Jenis Kelamin (${n})`, `Tanggal Lahir (${n})`);
      head.push('Emergency - Nama', 'Emergency - Hubungan', 'Emergency - Nomor Telepon', 'Emergency - WhatsApp', 'Status', 'Blok Kamar', 'Verifikasi Data', 'Catatan Kepegawaian');
      if (PROJ.sites) head.push('Jobsite');
      if (kind === 'out') head.push('Tanggal Keluar', 'Alasan Keluar');
      const aoa = [head];
      rowsOf(kind).forEach((r, k) => {
        const p = r.p, d = getP(p, r.site && r.site.id) || {};
        const row = [k + 1, d.nip || '', d.nik || '', d.kk || '', p.nama, d.npwp || '', d.hp || '', d.wa || '', p.jabatan || '', p.dept || '', p.level || '', p.kontrak || '', dt(p.akhir), p.poh || '',
          dt(p.masuk), p.masuk ? masaKerja(p.masuk, p.keluar) : '', p.jk || '', d.agama || '', d.tmpLahir || '', dt(d.tglLahir), umur(d.tglLahir), p.pendidikan || '', d.alamatDom || '', d.alamat || '', p.kategori || '', d.tempatKerja || '', p.site || '',
          d.rek || '', d.bank || '', d.rekNama || '', d.bpjsKes || '', d.bpjsTk || '', d.ibu || '', d.ibuPend || '', d.ibuKerja || '', d.ayah || '', d.ayahPend || '', d.ayahKerja || ''];
        for (let n = 1; n <= 4; n++) row.push(d[`sdr${n}`] || '', d[`sdr${n}Jk`] || '', dt(d[`sdr${n}Tgl`]));
        row.push(d.emNama || '', d.emHub || '', d.emHp || '', d.emWa || '', d.status || '', d.kamar || '', p.statusData || '', p.catatanHR || '');
        if (PROJ.sites) row.push(r.site ? r.site.name : '');
        if (kind === 'out') row.push(dt(p.keluar), p.alasan || '');
        aoa.push(row);
      });
      const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true, dateNF: 'dd/mm/yyyy' });
      ws['!cols'] = head.map((h) => ({ wch: Math.max(10, Math.min(28, h.length + 2)) }));
      ws['!freeze'] = { xSplit: 5, ySplit: 1 };
      return ws;
    };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet('aktif'), 'MP Aktif');
    XLSX.utils.book_append_sheet(wb, sheet('out'), 'MP Out');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellDates: true });
    save(`Data_Lengkap_${(PROJ.title || 'Manpower').replace(/^Monitoring\s+/i, '').replace(/[^\w-]+/g, '_')}_${TODAY}.xlsx`,
      new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  }

  // ---------- klik ----------
  document.addEventListener('click', async (e) => {
    const pv = e.target.closest('[data-pv]'), mi = e.target.closest('[data-mpin]'), xl = e.target.closest('#pvXlsx');
    if (!pv && !mi && !xl) return;
    e.stopPropagation(); e.preventDefault();
    if (xl) { if (ok()) exportFull(); return; }
    if (pv) {
      if (!ok()) return;
      const [sid, kind, i] = pv.dataset.pv.split('|');
      const src = sid === WEB_ID ? DATA : (typeof SITE_DATA !== 'undefined' && SITE_DATA[sid]) || (window.SITE_SEEDS && SITE_SEEDS[sid]) || {};
      const p = ((kind === 'out' ? src.keluar : src.aktif) || [])[+i];
      if (p) pvForm(sid, p);
      return;
    }
    if (!CAN_EDIT) return;
    const [sid, i] = mi.dataset.mpin.split('|');
    if (sid !== WEB_ID && typeof switchSite === 'function') await switchSite(sid);
    restoreForm(+i);
  }, true);

  const css = document.createElement('style');
  css.textContent = '.ab.inb{color:var(--good,#15803d)}.ab.pvb{color:var(--primary-ink)}.lnk{background:none;border:0;padding:0;color:var(--accent,#5b3fd6);font:inherit;text-decoration:underline;cursor:pointer}';
  document.head.appendChild(css);
  if (WEB.ready) render();
})();
