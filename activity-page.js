/* Pusat Monitoring → Aktivitas (khusus Pemilik): siapa melakukan apa, kapan, di web mana.
 * Tampilan: dikelompokkan per hari, tiap catatan = judul kalimat biasa + jenis (Tambah/Ubah/Hapus/Persetujuan/Akses)
 * + perubahan per kolom (Sebelum → Sesudah). Simpan berulang pada data yang sama dalam 15 menit digabung.
 */
(function () {
  if (typeof pageSet !== 'function' || typeof S === 'undefined') return;
  const APPS = { kmb: 'Manpower KMB', mbj: 'Manpower MBJ', 'bupr-ampah': 'Manpower BUPR', 'kta-tra': 'Manpower KTA-TRA', apd: 'APD', notulensi: 'Notulensi', 'unit-monitoring': 'Monitoring Unit', psikotest: 'Psikotest' };
  const A = { team: [], rows: null, loading: false, err: null, limit: 300, app: '', who: '', q: '', kind: '', merge: true, open: {}, from: '', to: '', showHidden: false, hist: [] };
  const MP_APPS = ['kta-tra', 'mbj', 'bupr-ampah', 'kmb'];

  // ---------- membaca rincian "Data — kolom: lama → baru; ..." ----------
  const HIDE = /^(updatedAt|updated_at|updatedBy|createdAt|created_at|id|uid|ts|at|by|foto|photo|files?)$/i;
  const LBL = {
    kode: 'Kode unit', kodesementara: 'Status identitas', catatan: 'Catatan', tgltiba: 'Tanggal tiba', kepemilikan: 'Kepemilikan', vendor: 'Vendor', merk: 'Merek', model: 'Model',
    tahun: 'Tahun', serial: 'No. seri / rangka', kondisi: 'Kondisi', etd: 'Perkiraan berangkat (ETD)', eta: 'Perkiraan tiba (ETA)', keterangan: 'Jenis / keterangan', lokasi: 'Lokasi',
    status: 'Status', pic: 'PIC', nama: 'Nama', jabatan: 'Jabatan', dept: 'Departemen', level: 'Level', kontrak: 'Status kontrak', masuk: 'Tanggal masuk', akhir: 'Akhir kontrak',
    poh: 'POH', jk: 'Jenis kelamin', kategori: 'Keterangan', site: 'Site', pendidikan: 'Pendidikan', statusdata: 'Verifikasi data', catatanhr: 'Catatan kepegawaian', keluar: 'Tanggal keluar',
    alasan: 'Alasan keluar', section: 'Section', group: 'Sub-section', ket: 'Keterangan', ptk: 'PTK', aju: 'Tanggal pengajuan PTK', due: 'Due date', close: 'Tanggal close',
    jumlah: 'Jumlah', unit: 'Unit', qty: 'Jumlah', type: 'Jenis', tipe: 'Tipe', date: 'Tanggal', note: 'Catatan', variant: 'Ukuran', person: 'Karyawan', warehouse: 'Gudang',
    location: 'Gudang', source: 'Sumber', condition: 'Kondisi', months: 'Jatah bulan', title: 'Judul', name: 'Nama', hm: 'HM', lambung: 'Nomor lambung', jobsite: 'Jobsite',
  };
  const SPECIAL = { kodesementara: (v) => (v === 'true' || v === 'Ya' ? 'Nomor sementara' : v === 'false' || v === 'Tidak' ? 'Nomor tetap' : v) };
  const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const MONL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const DAY = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const nice = (v) => {
    v = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
    if (!v || v === '—' || v === '-' || v === 'null' || v === 'undefined' || v === '[]' || v === '{}') return '';
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(T[\d:.]+Z?)?$/); if (m) return `${+m[3]} ${MONS[+m[2] - 1]} ${m[1]}`;
    if (v === 'true') return 'Ya'; if (v === 'false') return 'Tidak'; return v;
  };
  const keyOf = (k) => k.toLowerCase().replace(/[\s_]+/g, '');
  const label = (k) => LBL[keyOf(k)] || (k.charAt(0).toUpperCase() + k.slice(1));
  // satu baris rincian → { item, chg:[{k,a,b}], notes:[], hidden }
  function parseLine(line) {
    const out = { item: '', chg: [], notes: [], hidden: 0 };
    let rest = line;
    const i = line.indexOf(' — ');
    if (i >= 0) { out.item = line.slice(0, i).trim(); rest = line.slice(i + 3); }
    else if (!/→/.test(line)) { out.notes.push(line.trim()); return out; }
    const parts = rest.split(/;\s+(?=[A-Za-z][\w .\/()-]{0,30}:\s)/);
    for (const p of parts) {
      const m = p.match(/^([A-Za-z][\w .\/()-]{0,30}):\s*([\s\S]*)$/);
      if (!m || !m[2].includes('→')) { if (p.trim()) out.notes.push(p.trim()); continue; }
      const k = m[1].trim(); if (HIDE.test(k)) { out.hidden++; continue; }
      const j = m[2].indexOf(' → ') >= 0 ? m[2].indexOf(' → ') : m[2].indexOf('→');
      const w = m[2].indexOf(' → ') >= 0 ? 3 : 1;
      let a = nice(m[2].slice(0, j)), b = nice(m[2].slice(j + w));
      const sp = SPECIAL[keyOf(k)]; if (sp) { a = sp(a); b = sp(b); }
      if (a === b) { out.hidden++; continue; }
      out.chg.push({ k: label(k), a, b });
    }
    return out;
  }
  // gabungkan baris per data (item); kolom yang sama: nilai paling awal → paling akhir
  function parseDetail(det) {
    const items = new Map(); let hidden = 0; const notes = [];
    det.forEach((l) => {
      const p = parseLine(l); hidden += p.hidden;
      if (!p.item && !p.chg.length) { notes.push(...p.notes); return; }
      const lab = p.item.replace(/^(Ubah|Tambah|Hapus|Upload)\s+/i, '').trim(), key = lab.toLowerCase().replace(/[\s\-_.]+/g, '');
      const it = items.get(key) || { item: lab, chg: new Map(), notes: [] };
      it.item = lab;
      p.chg.forEach((c) => { const o = it.chg.get(c.k); it.chg.set(c.k, o ? { k: c.k, a: o.a, b: c.b } : c); });
      it.notes.push(...p.notes); items.set(key, it);
    });
    const list = [...items.values()].map((it) => ({ item: it.item, notes: it.notes, chg: [...it.chg.values()].filter((c) => c.a !== c.b) }));
    return { items: list, notes, hidden, total: list.reduce((n, it) => n + it.chg.length + it.notes.length, 0) + notes.length };
  }

  // ---------- jenis & judul ----------
  const KIND = {
    add: { t: 'Tambah', c: 'k-add' }, upd: { t: 'Ubah', c: 'k-upd' }, del: { t: 'Hapus', c: 'k-del' }, apr: { t: 'Persetujuan', c: 'k-apr' }, acc: { t: 'Masuk & akses', c: 'k-acc' },
  };
  function kindOf(r) {
    const a = String(r.action || '');
    if (/^(Menyetujui|Menolak|Mengajukan|Laporan otomatis|Draf \(belum disetujui\))/i.test(a) || r.page === 'Persetujuan') return 'apr';
    if (/^(Masuk|Keluar|Login|Membuka|Izin|Minta izin|Akses|Bagikan|Link)/i.test(a)) return 'acc';
    if (/^(Hapus|Menghapus)\b/i.test(a) || /\bdihapus\b/i.test(a)) return 'del';
    if (/^(Tambah|Upload|Unggah|Menambah|Buat|Membuat)\b/i.test(a) || /\b(baru|ditambahkan)\b/i.test(a)) return 'add';
    const det = String(r.detail || '');
    if (det && !/→/.test(det) && /: tambah /.test(det) && !/: hapus /.test(det)) return 'add';
    return 'upd';
  }
  function titleOf(r) {
    let a = String(r.action || '').replace(/^Draf \(belum disetujui\): /, '');
    let m;
    if (/(disimpan|tersimpan|diperbarui)\.?$/i.test(a) && r.dets) {
      const P = parseDetail(r.dets.join('\n').split('\n').filter(Boolean));
      const its = P.items.filter((it) => it.item);
      if (its.length === 1) return its[0].item + ' diperbarui';
    }
    if ((m = a.match(/^Ubah (.+)$/i))) return m[1] + ' diperbarui';
    if ((m = a.match(/^Tambah (.+)$/i))) return m[1] + ' ditambahkan';
    if ((m = a.match(/^Hapus (.+)$/i))) return m[1] + ' dihapus';
    if ((m = a.match(/^Upload (.+)$/i))) return m[1] + ' diunggah';
    return a.replace(/\.$/, '');
  }
  const whoOf = (a) => String(a || '').replace(/ \(link\)$/, '');   // "email (link)" = orang yang sama lewat link tanpa login
  const roleName = (r) => r.role === 'owner' ? 'Pemilik' : r.role === 'pic' ? 'PIC' : r.role === 'editor' ? 'Editor' : r.actor === 'link tanpa login' ? 'Link tanpa login' : (r.role || '');
  const owner = () => typeof isOwner === 'function' && isOwner();
  const wibStart = (iso) => new Date(Date.parse(iso + 'T00:00:00Z') - 7 * 3600e3).toISOString();
  const addD = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const jkt = (t) => new Date(new Date(t).getTime() + 7 * 3600e3); // tampil dalam WIB
  const dkey = (t) => jkt(t).toISOString().slice(0, 10);
  const hm = (t) => jkt(t).toISOString().slice(11, 16);

  // simpan berulang (orang, web, judul sama, ≤ 15 menit) → satu catatan
  function mergeRows(rows) {
    if (!A.merge) return rows.map((r) => ({ ...r, ids: [r.id], n: 1, first: r.at, dets: [r.detail || ''], parts: [r] }));
    const out = [];
    rows.forEach((r) => {
      const g = out[out.length - 1];
      if (g && !!g.hidden_at === !!r.hidden_at && g.app === r.app && (g.site || '') === (r.site || '') && g.actor === r.actor && g.action === r.action && dkey(g.first) === dkey(r.at) && Date.parse(g.first) - Date.parse(r.at) <= 15 * 60e3) {
        g.ids.push(r.id); g.n++; g.first = r.at; g.dets.unshift(r.detail || ''); g.parts.push(r); return;
      }
      out.push({ ...r, ids: [r.id], n: 1, first: r.at, dets: [r.detail || ''], parts: [r] });
    });
    return out;
  }

  // catatan aktivitas ↔ baris riwayat (dicatat bersamaan saat menyimpan)
  const lc = (x) => String(x || '').toLowerCase();
  function histOf(r) {
    if (!MP_APPS.includes(r.app) || !A.hist.length) return [];
    const out = [];
    (r.parts || [r]).forEach((p) => {
      const t = Date.parse(p.at), who = lc(whoOf(p.actor));
      let best = null, bd = 20e3;
      A.hist.forEach((h) => {
        if (h.app_id !== p.app || !['simpan', 'setujui', 'kembalikan', 'pulihkan'].includes(h.action) || !(h.ops || []).length) return;
        const d = Math.abs(Date.parse(h.at) - t); if (d > bd) return;
        const ha = lc(h.actor);
        if (ha !== who && !(ha === 'editor link' && (p.actor === 'link tanpa login' || / \(link\)$/.test(p.actor || ''))) && !(h.action === 'setujui')) return;
        best = h; bd = d;
      });
      if (best && !out.includes(best)) out.push(best);
    });
    return out;
  }
  const revertedIds = () => { const s = new Set(); A.hist.forEach((h) => { if (h.action === 'kembalikan') String(h.note || '').replace(/#(\d+)/g, (m, id) => { s.add(+id); return m; }); }); return s; };
  async function revertRow(r) {
    const K = window.KTAOps, hs = histOf(r).sort((a, b) => (a.at < b.at ? 1 : -1));
    if (!K || !hs.length) return;
    const ops = [].concat(...hs.map((h) => h.ops));
    const preview = ops.slice(0, 12).map((o) => `• ${o.l} · ${K.opText(o)}: ${K.opNew(o)} → kembali ke ${K.opOld(o)}`).join('\n') + (ops.length > 12 ? `\n… dan ${ops.length - 12} lainnya` : '');
    if (!confirm(`Kembalikan perubahan ini ke nilai sebelumnya?\n\n${preview}\n\nLangkah ini tercatat dan bisa dikembalikan lagi.`)) return;
    const byState = {}; hs.forEach((h) => { (byState[h.state_id] = byState[h.state_id] || []).push(h); });
    for (const [sid, list] of Object.entries(byState)) {
      const inv = K.inverse([].concat(...list.map((h) => h.ops)));
      let done = false;
      for (let tries = 0; tries < 2 && !done; tries++) {
        const cur = await S.sb.from('kta_web_state').select('data,updated_at').eq('id', sid).single();
        if (cur.error) { alert('Gagal membaca data: ' + cur.error.message); return; }
        const next = K.clone(cur.data.data); const res = K.applyOps(next, inv);
        const up = await S.sb.from('kta_web_state').update({ data: next, updated_at: new Date().toISOString(), updated_by: (S.user && S.user.email) || 'Pemilik' }).eq('id', sid).eq('updated_at', cur.data.updated_at).select('id');
        if (up.error) { alert('Gagal mengembalikan: ' + up.error.message); return; }
        if (!up.data || !up.data.length) continue;   // ada yang menyimpan bersamaan → coba sekali lagi dengan data terbaru
        done = true;
        const note = 'Kembalikan ' + list.map((h) => '#' + h.id).join(' ') + (res.conflicts.length ? ` · ${res.conflicts.length} kolom sudah diubah lagi setelahnya` : '');
        const hr = await S.sb.rpc('kta_hist_add', { p_state: sid, p_action: 'kembalikan', p_ops: inv, p_note: note, p_token: null });
        if (!hr.error) A.hist.unshift({ id: hr.data, app_id: r.app, state_id: sid, at: new Date().toISOString(), actor: S.user && S.user.email, action: 'kembalikan', ops: inv, note });
        const lines = inv.map((o) => o.op === 'add' ? `${K.COLL[o.c] ? K.COLL[o.c].name : o.c}: tambah ${o.l}` : o.op === 'del' ? `${K.COLL[o.c] ? K.COLL[o.c].name : o.c}: hapus ${o.l}` : `${o.l} — ${K.fieldLabel(o.f)}: ${K.opOld(o)} → ${K.opNew(o)}`);
        try { await S.sb.rpc('kta_log_activity', { p_app: r.app, p_site: r.site || null, p_action: 'Kembalikan perubahan: ' + titleOf(r), p_detail: lines.slice(0, 40).join('\n'), p_token: null, p_page: 'Aktivitas' }); } catch (e) {}
      }
      if (!done) { alert('Data sedang diubah orang lain. Coba lagi sebentar lagi.'); return; }
    }
    A.rows = null; render();
  }

  async function load() {
    if (A.loading || !S.sb || !owner()) return;
    A.loading = true; A.err = null;
    try {
      let q = S.sb.from('kta_activity_log').select('id,at,app,site,page,actor,role,action,detail,hidden_at,hidden_by').order('at', { ascending: false }).limit(A.limit);
      if (A.app) q = q.eq('app', A.app);
      if (A.from) q = q.gte('at', wibStart(A.from));
      if (A.to) q = q.lt('at', wibStart(addD(A.to, 1)));
      const { data, error } = await q;
      if (error) throw error;
      A.rows = data || [];
      // riwayat perubahan (nilai lama/baru) untuk tombol Kembalikan di web Manpower
      A.hist = [];
      const mp = A.rows.filter((r) => MP_APPS.includes(r.app));
      if (mp.length && window.KTAOps) {
        const lo = new Date(Date.parse(mp[mp.length - 1].at) - 60e3).toISOString(), hi = new Date(Date.parse(mp[0].at) + 60e3).toISOString();
        const h = await S.sb.from('kta_change_history').select('id,app_id,state_id,at,actor,role,action,ops,note,request_actor').gte('at', lo).lte('at', new Date(Date.now() + 60e3).toISOString()).order('at', { ascending: false }).limit(5000);
        if (!h.error) A.hist = h.data || [];
        void hi;
      }
      // semua Editor/Pemilik yang terdaftar ikut muncul di pilihan orang, walau belum ada aktivitas
      const tm = await S.sb.from('app_access_roles').select('email,role').in('role', ['owner', 'editor']);
      A.team = tm.error ? [] : [...new Set((tm.data || []).map((x) => String(x.email || '').toLowerCase()).filter(Boolean))];
    } catch (e) { A.err = (e && e.message) || 'gagal memuat'; A.rows = A.rows || []; }
    A.loading = false;
    if (ui.page === 'act') render();
  }

  function filtered() {
    const q = A.q.toLowerCase();
    return A.rows.filter((r) => (A.showHidden || !r.hidden_at) && (!A.who || whoOf(r.actor) === A.who) && (!A.kind || kindOf(r) === A.kind) && (!q || `${r.action} ${r.detail || ''} ${r.actor} ${r.site || ''} ${APPS[r.app] || ''}`.toLowerCase().includes(q)));
  }

  const chip = (c) => `<span class="actpill"><b>${esc(c.k)}</b>: ${c.a ? esc(c.a) : '<i>kosong</i>'} → <b>${c.b ? esc(c.b) : '<i>dikosongkan</i>'}</b></span>`;
  function changesHtml(r, kind) {
    const P = parseDetail(r.dets.join('\n').split('\n').filter(Boolean));
    if (!P.total) return P.hidden ? '<div class="actnochg">Disimpan tanpa perubahan isi.</div>' : '';
    const flat = []; P.items.forEach((it) => it.chg.forEach((c) => flat.push({ ...c, item: it.item })));
    const multi = P.items.filter((it) => it.chg.length || it.notes.length).length > 1;
    const notes = P.notes.concat(...P.items.map((it) => it.notes.map((n) => (multi && it.item ? it.item + ': ' : '') + n)));
    const pills = flat.slice(0, 3).map((c) => chip(multi && c.item ? { ...c, k: c.item + ' · ' + c.k } : c)).join('') +
      notes.slice(0, flat.length ? Math.max(0, 3 - flat.length) : 3).map((n) => `<span class="actpill ${kind === 'add' ? 'g' : kind === 'del' ? 'r' : ''}">${esc(nice(n))}</span>`).join('');
    const more = flat.length + notes.length > 3 || flat.length > 1;
    const table = more ? `<details ${A.open[r.id] ? 'open' : ''} data-actopen="${r.id}"><summary>Lihat semua ${flat.length + notes.length} perubahan</summary>
      ${P.items.filter((it) => it.chg.length).map((it) => `${multi && it.item ? `<div class="actitem">${esc(it.item)}</div>` : ''}<table class="actchg"><thead><tr><th>Kolom</th><th>Sebelum</th><th></th><th>Sesudah</th></tr></thead><tbody>${it.chg.map((c) => `<tr><td>${esc(c.k)}</td><td>${c.a ? `<s>${esc(c.a)}</s>` : '<i>kosong</i>'}</td><td class="ar">→</td><td>${c.b ? `<b>${esc(c.b)}</b>` : '<i>dikosongkan</i>'}</td></tr>`).join('')}</tbody></table>`).join('')}
      ${notes.length ? `<ul class="actnotes">${notes.map((n) => `<li>${esc(nice(n))}</li>`).join('')}</ul>` : ''}
      ${P.hidden ? `<div class="actnochg">Tidak ditampilkan: ${P.hidden} kolom yang tidak berubah atau catatan teknis sistem.</div>` : ''}</details>` : '';
    return `<div class="actpills">${pills}</div>${table}`;
  }

  function pageAct() {
    const exportBtn = owner() && A.rows && A.rows.length ? '<button type="button" class="btn btn-g" id="actXls">Unduh Excel</button>' : '';
    const head = `<div class="sethead"><div><div class="eb">Khusus Pemilik</div><h1 class="h1s">Aktivitas</h1><p class="sub">Siapa mengubah apa dan kapan, di semua web monitoring. Hanya Pemilik yang bisa melihat halaman ini.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap">${exportBtn}<button type="button" class="btn btn-g" data-page="home">← Kembali</button></div></div>`;
    if (!owner()) return head + '<div class="scard"><p>Halaman ini khusus Pemilik.</p></div>';
    if (A.rows === null) { load(); return head + '<div class="lock"><p>Memuat aktivitas…</p></div>'; }
    const today = dkey(Date.now());
    const rows = filtered();
    const nHidden = A.rows.filter((r) => r.hidden_at).length;
    const people = [...new Set([...A.rows.map((r) => whoOf(r.actor)), ...A.team])].sort((a, b) => (a === 'link tanpa login') - (b === 'link tanpa login') || a.localeCompare(b));
    const cnt = {}; A.rows.forEach((r) => { const w = whoOf(r.actor); cnt[w] = (cnt[w] || 0) + 1; });
    const kc = { add: 0, upd: 0, del: 0, apr: 0, acc: 0 }, ac = {};
    A.rows.filter((r) => (!A.who || whoOf(r.actor) === A.who)).forEach((r) => { kc[kindOf(r)]++; ac[r.app] = (ac[r.app] || 0) + 1; });
    const top = Object.entries(ac).sort((a, b) => b[1] - a[1])[0];
    const span = A.from || A.to ? (A.from === A.to ? niceD(A.from) : `${A.from ? niceD(A.from) : 'awal'} – ${A.to ? niceD(A.to) : 'hari ini'}`) : A.rows.length ? `${dkey(A.rows[A.rows.length - 1].at) === dkey(A.rows[0].at) ? 'hari ini' : 'sejak ' + niceD(dkey(A.rows[A.rows.length - 1].at))}` : '';
    const items = mergeRows(rows);
    const groups = []; items.forEach((r) => { const k = dkey(r.at); const g = groups[groups.length - 1]; if (g && g.k === k) g.rows.push(r); else groups.push({ k, rows: [r] }); });
    const yest = dkey(Date.now() - 864e5);
    const kchip = (k, l) => `<button type="button" class="actk ${k ? KIND[k].c : ''}" data-actkind="${k}" aria-pressed="${A.kind === k}">${k ? '<i></i>' : ''}${l}</button>`;
    const tools = `<div class="actbar">
      <input type="search" id="actQ" placeholder="Cari nama unit, karyawan, atau orang yang mengubah" value="${esc(A.q)}" aria-label="Cari aktivitas">
      <select id="actApp" aria-label="Web"><option value="">Semua web</option>${Object.entries(APPS).map(([k, l]) => `<option value="${k}" ${A.app === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <select id="actWho" aria-label="Orang"><option value="">Semua orang</option>${people.map((p) => `<option value="${esc(p)}" ${A.who === p ? 'selected' : ''}>${esc(p)}${cnt[p] ? '' : ' · belum ada aktivitas'}</option>`).join('')}</select>
      <button type="button" class="btn btn-g" id="actRefresh">${A.loading ? 'Memuat…' : 'Muat ulang'}</button>
    </div>
    <div class="actbar2 actdates"><span class="actlbl">Tanggal:</span>
      <label class="actd">Dari <input type="date" id="actFrom" value="${A.from}" max="${A.to || today}"></label>
      <label class="actd">Sampai <input type="date" id="actTo" value="${A.to}" min="${A.from}" max="${today}"></label>
      ${[['today', 'Hari ini'], ['7', '7 hari'], ['30', '30 hari'], ['month', 'Bulan ini'], ['lastmonth', 'Bulan lalu'], ['', 'Semua']].map(([k, l]) => `<button type="button" class="actk" data-actrange="${k}" aria-pressed="${rangeKey() === k}">${l}</button>`).join('')}
    </div>
    <div class="actbar2"><span class="actlbl">Jenis:</span>${kchip('', 'Semua')}${kchip('add', 'Tambah')}${kchip('upd', 'Ubah')}${kchip('del', 'Hapus')}${kchip('apr', 'Persetujuan')}${kchip('acc', 'Masuk & akses')}
      <span style="flex:1"></span>${nHidden ? `<label class="actmerge"><input type="checkbox" id="actShowHidden" ${A.showHidden ? 'checked' : ''}> Tampilkan yang disembunyikan (${nHidden})</label>` : ''}<label class="actmerge"><input type="checkbox" id="actMerge" ${A.merge ? 'checked' : ''}> Gabungkan simpan berulang pada data yang sama</label></div>`;
    const kpis = `<div class="actkpis">
      <div><span>Aktivitas${span ? ' (' + span + ')' : ''}</span><b>${A.rows.length}</b></div>
      <div><span>Ubah</span><b style="color:#1D4ED8">${kc.upd}</b></div><div><span>Tambah</span><b style="color:#15803D">${kc.add}</b></div>
      <div><span>Hapus</span><b style="color:#B91C1C">${kc.del}</b></div><div><span>Paling aktif</span><b class="sm">${top ? esc(APPS[top[0]] || top[0]) : '–'}</b></div></div>`;
    const body = groups.map((g) => {
      const d = new Date(g.k + 'T00:00:00Z');
      const lbl = `${g.k === today ? 'Hari ini · ' : g.k === yest ? 'Kemarin · ' : ''}${DAY[d.getUTCDay()]}, ${d.getUTCDate()} ${MONL[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
      return `<section class="actday"><div class="actdayh"><b>${lbl}</b><span>${g.rows.length} aktivitas</span></div>${g.rows.map((r) => {
        const k = kindOf(r), K = KIND[k];
        return `<div class="actrow"><div class="acttime"><b>${hm(r.at)}</b>${r.n > 1 ? `<span>mulai ${hm(r.first)}</span>` : ''}</div><div class="actline"><i class="actdot ${K.c}"></i></div><div class="actbody">
          <div class="acttop"><span class="actkind ${K.c}">${K.t.toUpperCase()}</span><span class="actapp">${esc(APPS[r.app] || r.app || '')}${r.site ? ' · ' + esc(r.site) : ''}</span><b class="acttitle">${esc(titleOf(r))}</b>${r.n > 1 ? `<span class="actn">disimpan ${r.n} kali</span>` : ''}${/^Draf \(belum disetujui\)/.test(r.action || '') ? '<span class="actn" style="background:#FFEDD5;color:#9A3412">draf, belum disetujui</span>' : ''}${r.hidden_at ? `<span class="actn" style="background:#FEF3C7;color:#92400E">disembunyikan</span><button type="button" class="actx actunhide" data-actunhide="${r.ids.join(',')}">Tampilkan lagi</button>` : `<button type="button" class="actx" data-actdel="${r.ids.join(',')}" title="Sembunyikan catatan ini" aria-label="Sembunyikan catatan ini">Sembunyikan</button>`}</div>
          <div class="actwho">oleh <b>${esc(roleName(r) || 'tanpa peran')}</b>${r.actor && r.actor !== 'link tanpa login' ? ' · ' + esc(r.actor) : ''}</div>
          ${changesHtml(r, k)}
          ${(() => { const hs = histOf(r); if (!hs.length || k === 'apr' && !/^Menyetujui/.test(r.action || '')) return ''; const rv = revertedIds(); return hs.every((h) => rv.has(h.id)) ? '<div class="actnochg">Perubahan ini sudah dikembalikan.</div>' : `<div><button type="button" class="btn btn-g actrev" data-actrev="${r.id}">Kembalikan perubahan ini</button></div>`; })()}
        </div></div>`;
      }).join('')}</section>`;
    }).join('');
    return head + `<div class="scard actcard">${tools}</div>${kpis}${A.err ? `<div class="nb warn">Aktivitas belum bisa dimuat: ${esc(A.err)}</div>` : ''}
      ${body || '<div class="scard"><p class="small" style="margin:0">Belum ada aktivitas yang cocok dengan pilihan ini. Aktivitas mulai dicatat sejak 24 Okt 2026.</p></div>'}
      <div class="actfoot">${rows.length ? `<button type="button" class="btn btn-g actdel-all" id="actDelAll">Sembunyikan ${rows.filter((r) => !r.hidden_at).length} catatan yang tampil</button>` : ''}${A.rows.length >= A.limit ? `<button type="button" class="btn btn-g" id="actMore">${A.from || A.to ? 'Tampilkan lebih banyak di rentang ini' : 'Tampilkan hari sebelumnya'}</button>` : ''}</div>`;
  }
  function rangeKey() {
    const t = dkey(Date.now()), m0 = t.slice(0, 8) + '01';
    const lm0 = addD(m0, -1).slice(0, 8) + '01', lm1 = addD(m0, -1);
    if (!A.from && !A.to) return '';
    if (A.from === t && A.to === t) return 'today';
    if (A.to === t && A.from === addD(t, -6)) return '7';
    if (A.to === t && A.from === addD(t, -29)) return '30';
    if (A.to === t && A.from === m0) return 'month';
    if (A.from === lm0 && A.to === lm1) return 'lastmonth';
    return 'custom';
  }
  function setRange(k) {
    const t = dkey(Date.now()), m0 = t.slice(0, 8) + '01';
    if (k === '') { A.from = ''; A.to = ''; }
    else if (k === 'today') { A.from = t; A.to = t; }
    else if (k === '7') { A.from = addD(t, -6); A.to = t; }
    else if (k === '30') { A.from = addD(t, -29); A.to = t; }
    else if (k === 'month') { A.from = m0; A.to = t; }
    else if (k === 'lastmonth') { A.to = addD(m0, -1); A.from = A.to.slice(0, 8) + '01'; }
    A.limit = A.from || A.to ? 2000 : 300; A.rows = null; render();
  }
  const niceD = (iso) => { const [y, m, d] = iso.split('-'); return `${+d} ${MONS[+m - 1]} ${y}`; };

  // ---------- unduh Excel (kolom sama dengan yang tampil) ----------
  let XJ = null;
  const loadXJ = () => window.ExcelJS ? Promise.resolve(window.ExcelJS) : XJ || (XJ = new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'; s.onload = () => ok(window.ExcelJS); s.onerror = () => { XJ = null; no(new Error('Pembuat Excel gagal dimuat, periksa koneksi lalu coba lagi.')); }; document.head.appendChild(s); }));
  async function exportXls() {
    let X; try { X = await loadXJ(); } catch (e) { alert(e.message); return; }
    const wb = new X.Workbook(), ws = wb.addWorksheet('Aktivitas');
    const H = ['Tanggal', 'Jam (WIB)', 'Web', 'Siapa', 'Peran', 'Jenis', 'Aktivitas', 'Data', 'Kolom', 'Sebelum', 'Sesudah'];
    ws.addRow(['Aktivitas semua web monitoring']).font = { name: 'Arial', size: 14, bold: true };
    ws.addRow([`Diunduh ${niceD(dkey(Date.now()))} ${hm(Date.now())} WIB${A.from || A.to ? ' · tanggal ' + (A.from ? niceD(A.from) : 'awal') + ' – ' + (A.to ? niceD(A.to) : 'hari ini') : ''}${A.app ? ' · ' + (APPS[A.app] || A.app) : ''}${A.who ? ' · ' + A.who : ''}${A.kind ? ' · ' + KIND[A.kind].t : ''}${A.q ? ' · cari "' + A.q + '"' : ''}`]).font = { name: 'Arial', size: 9, color: { argb: 'FF4B4868' } };
    ws.addRow([]);
    const hr = ws.addRow(H); hr.height = 24;
    hr.eachCell((c) => { c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6D28D9' } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; });
    [12, 9, 18, 30, 12, 13, 36, 30, 22, 28, 28].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    mergeRows(filtered()).forEach((r) => {
      const base = [new Date(Date.parse(dkey(r.at) + 'T00:00:00Z')), hm(r.at), APPS[r.app] || r.app || '', whoOf(r.actor), roleName(r), KIND[kindOf(r)].t, titleOf(r) + (r.n > 1 ? ` (disimpan ${r.n} kali)` : '')];
      const P = parseDetail(r.dets.join('\n').split('\n').filter(Boolean));
      const lines = [];
      P.items.forEach((it) => { it.chg.forEach((c) => lines.push([it.item, c.k, c.a || '(kosong)', c.b || '(dikosongkan)'])); it.notes.forEach((n) => lines.push([it.item, '', '', nice(n)])); });
      P.notes.forEach((n) => lines.push(['', '', '', nice(n)]));
      (lines.length ? lines : [['', '', '', '']]).forEach((l) => { const row = ws.addRow(base.concat(l)); row.getCell(1).numFmt = '[$-421]dd mmm yyyy'; row.eachCell((c) => { c.font = c.font && c.font.bold ? c.font : { name: 'Arial', size: 10 }; c.alignment = { vertical: 'top', wrapText: true }; }); });
    });
    ws.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(5, ws.rowCount), column: H.length } };
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = `Aktivitas_${A.from || A.to ? (A.from || 'awal') + '_sd_' + (A.to || dkey(Date.now())) : dkey(Date.now())}.xlsx`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  const _pageSet = pageSet;
  pageSet = function () { return ui.page === 'act' ? pageAct() : _pageSet.apply(this, arguments); };
  const _who = whoUI;
  whoUI = function () {
    _who.apply(this, arguments);
    if (!owner() || document.querySelector('#menu [data-page="act"]')) return;
    const g = document.querySelector('#menu [data-page="guide"]');
    if (g) g.insertAdjacentHTML('beforebegin', '<button type="button" data-page="act" role="menuitem">Aktivitas</button><button type="button" role="menuitem" onclick="location.href=\'kantor-ai/\'">Kantor Monitoring</button>');
  };
  const _go = goPage;
  goPage = function (p) {
    if (p === 'act') A.rows = null;
    _go.apply(this, arguments);
    if (p === 'act') { try { history.replaceState(null, '', '#aktivitas'); } catch (e) {} }
  };
  if ((location.hash || '').slice(1) === 'aktivitas') { ui.page = 'act'; try { render(); } catch (e) {} }

  document.addEventListener('change', (e) => {
    if (e.target.id === 'actApp') { A.app = e.target.value; A.rows = null; render(); }
    if (e.target.id === 'actWho') { A.who = e.target.value; render(); }
    if (e.target.id === 'actMerge') { A.merge = e.target.checked; render(); }
    if (e.target.id === 'actShowHidden') { A.showHidden = e.target.checked; render(); }
    if (e.target.id === 'actFrom' || e.target.id === 'actTo') {
      A[e.target.id === 'actFrom' ? 'from' : 'to'] = e.target.value || '';
      if (A.from && A.to && A.from > A.to) { if (e.target.id === 'actFrom') A.to = A.from; else A.from = A.to; }
      A.limit = A.from || A.to ? 2000 : 300; A.rows = null; render();
    }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id !== 'actQ') return;
    A.q = e.target.value; const pos = e.target.selectionStart; render();
    const n = document.getElementById('actQ'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (er) {} }
  });
  document.addEventListener('toggle', (e) => { const d = e.target; if (d.dataset && d.dataset.actopen) A.open[d.dataset.actopen] = d.open; }, true);
  document.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('#actRefresh')) { A.rows = null; render(); return; }
    if (t.closest('#actMore')) { A.limit += 300; A.rows = null; render(); return; }
    if (t.closest('#actXls')) { exportXls().catch((er) => alert('Gagal membuat Excel: ' + (er.message || er))); return; }
    const rv = t.closest('[data-actrev]'); if (rv) { const it = mergeRows(filtered()).find((x) => String(x.id) === rv.dataset.actrev); if (it) { rv.disabled = true; rv.textContent = 'Mengembalikan…'; try { await revertRow(it); } finally { rv.disabled = false; rv.textContent = 'Kembalikan perubahan ini'; } } return; }
    const rb = t.closest('[data-actrange]'); if (rb) { setRange(rb.dataset.actrange); return; }
    const kb = t.closest('[data-actkind]'); if (kb) { A.kind = kb.dataset.actkind; render(); return; }
    const x = t.closest('[data-actdel]'), all = t.closest('#actDelAll'), un = t.closest('[data-actunhide]');
    if ((!x && !all && !un) || !owner()) return;
    const ids = (x || un) ? (x || un).dataset[x ? 'actdel' : 'actunhide'].split(',').map(Number) : filtered().filter((r) => !r.hidden_at).map((r) => r.id);
    if (!ids.length) return;
    if (!un && !confirm(x ? 'Sembunyikan catatan ini? Catatan tidak dihapus dan bisa ditampilkan lagi.' : `Sembunyikan ${ids.length} catatan yang sedang tampil? Catatan tidak dihapus dan bisa ditampilkan lagi lewat "Tampilkan yang disembunyikan".`)) return;
    const patch = un ? { hidden_at: null, hidden_by: null } : { hidden_at: new Date().toISOString(), hidden_by: (S.user && S.user.email) || 'Pemilik' };
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await S.sb.from('kta_activity_log').update(patch).in('id', ids.slice(i, i + 200));
      if (error) { alert('Gagal: ' + error.message); break; }
    }
    A.rows.forEach((r) => { if (ids.includes(r.id)) Object.assign(r, patch); }); render();
  });

  const css = document.createElement('style');
  css.textContent = `
  .actcard{padding:16px 18px}
  .actbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
  .actbar select,.actbar input{height:44px;border:1px solid var(--line,#e5e2ef);border-radius:10px;padding:0 12px;font:inherit;font-weight:600;background:#fff;color:var(--ink,#1e1b3a);min-width:0}
  .actbar input{flex:1 1 280px;font-weight:500}
  .actbar select{flex:0 1 200px}
  .actbar2{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:12px}
  .actlbl{font-size:13px;font-weight:700;color:var(--ink-2,#4b4868)}
  .actk{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line,#e8e6f3);background:#fff;color:var(--ink,#1e1b3a);border-radius:999px;padding:6px 14px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;min-height:34px}
  .actk[aria-pressed=true]{background:#EFE9FE;border-color:#DDD0FA;color:#5B21B6;font-weight:700}
  .actk i{width:8px;height:8px;border-radius:99px;background:currentColor}
  .actk.k-add i{background:#15803D}.actk.k-upd i{background:#2563EB}.actk.k-del i{background:#DC2626}.actk.k-apr i{background:#7C3AED}.actk.k-acc i{background:#8A87A6}
  .actd{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--ink-2,#4b4868)}
  .actd input{height:36px;border:1px solid var(--line,#e8e6f3);border-radius:10px;padding:0 10px;font:inherit;background:#fff;color:var(--ink,#1e1b3a)}
  .actmerge{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--ink-2,#4b4868)}
  .actkpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:16px 0}
  .actkpis>div{background:#fff;border:1px solid var(--line,#e8e6f3);border-radius:14px;padding:12px 16px;display:flex;flex-direction:column}
  .actkpis span{font-size:12px;font-weight:600;color:var(--ink-2,#4b4868)}.actkpis b{font-size:26px;font-weight:800;color:var(--ink,#1e1b3a)}.actkpis b.sm{font-size:16px;padding-top:6px}
  .actday{background:#fff;border:1px solid var(--line,#e8e6f3);border-radius:16px;overflow:hidden;margin-bottom:16px}
  .actdayh{display:flex;align-items:center;gap:12px;padding:13px 20px;background:#F7F6FD;border-bottom:1px solid var(--line,#e8e6f3)}
  .actdayh b{flex:1;font-size:15px}.actdayh span{font-size:13px;color:var(--ink-2,#4b4868)}
  .actrow{display:grid;grid-template-columns:84px 28px minmax(0,1fr);padding:16px 20px;border-top:1px solid #EFEDF7}
  .actdayh+.actrow{border-top:0}
  .acttime{display:flex;flex-direction:column;gap:2px}.acttime b{font-size:15px}.acttime span{font-size:12px;color:var(--muted,#6e6a8c)}
  .actline{display:flex;justify-content:center;padding-top:4px}
  .actdot{width:14px;height:14px;border-radius:99px;background:#2563EB;box-shadow:0 0 0 4px #DBEAFE}
  .actdot.k-add{background:#15803D;box-shadow:0 0 0 4px #DCFCE7}.actdot.k-del{background:#DC2626;box-shadow:0 0 0 4px #FEE2E2}.actdot.k-apr{background:#7C3AED;box-shadow:0 0 0 4px #EDE9FE}.actdot.k-acc{background:#8A87A6;box-shadow:0 0 0 4px #F2F1FA}
  .actbody{min-width:0;display:flex;flex-direction:column;gap:7px}
  .acttop{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .actkind{font-size:11.5px;font-weight:800;border-radius:6px;padding:3px 8px;letter-spacing:.02em;background:#DBEAFE;color:#1E40AF}
  .actkind.k-add{background:#DCFCE7;color:#166534}.actkind.k-del{background:#FEE2E2;color:#991B1B}.actkind.k-apr{background:#EDE9FE;color:#5B21B6}.actkind.k-acc{background:#F2F1FA;color:#4B4868}
  .actapp{font-size:11.5px;font-weight:700;color:var(--p-ink,#5b21b6);background:#EFE9FE;border-radius:6px;padding:3px 8px}
  .acttitle{font-size:15.5px;color:var(--ink,#1e1b3a)}
  .actn{font-size:12px;font-weight:600;color:var(--ink-2,#4b4868);background:#F2F1FA;border-radius:99px;padding:3px 10px}
  .actx{margin-left:auto;border:0;background:none;color:var(--muted,#9a96ad);font-size:18px;line-height:1;cursor:pointer;padding:4px 8px;border-radius:6px}
  .actx{font-size:12px;font-weight:700}.actx:hover{color:#92400E;background:#FEF3C7}.actunhide{color:#5B21B6}
  .actrev{font-size:13px;padding:7px 14px;margin-top:2px}
  .actwho{color:var(--ink-2,#4b4868);font-size:13px}.actwho b{color:var(--ink,#1e1b3a)}
  .actpills{display:flex;gap:8px;flex-wrap:wrap}
  .actpill{font-size:13px;background:#F7F6FD;border:1px solid #EFEDF7;border-radius:8px;padding:6px 10px;color:var(--ink-2,#4b4868);max-width:100%;word-break:break-word}
  .actpill b{color:var(--ink,#1e1b3a)}.actpill i{color:#8A87A6}
  .actpill.g{background:#F0FDF4;border-color:#BBF7D0}.actpill.r{background:#FEF2F2;border-color:#FECACA}
  .actbody details{font-size:13px;color:var(--ink-2,#3b3852)}
  .actbody summary{cursor:pointer;color:var(--p-ink,#5b21b6);font-weight:700;padding:2px 0}
  .actitem{font-weight:700;color:var(--ink,#1e1b3a);margin:10px 0 0}
  .actchg{border-collapse:collapse;margin-top:8px;width:100%;max-width:900px;font-size:13px;border:1px solid var(--line,#e8e6f3);border-radius:10px;overflow:hidden}
  .actchg th:nth-child(2),.actchg th:nth-child(4){width:42%}.actchg th:nth-child(3){width:24px}
  .actchg th{text-align:left;font-weight:700;color:var(--ink-2,#4b4868);font-size:12px;padding:8px 12px;background:#F7F6FD;border-bottom:1px solid var(--line,#e8e6f3)}
  .actchg td{padding:8px 12px;border-bottom:1px solid #EFEDF7;vertical-align:top;word-break:break-word}
  .actchg tr:last-child td{border-bottom:0}
  .actchg td:first-child{white-space:nowrap;color:var(--ink,#1e1b3a);font-weight:600;width:1%}
  .actchg td s{color:#6E6A8C}.actchg td.ar{color:#8A87A6;width:1%}
  .actchg i{color:#8A87A6}
  .actnotes{margin:8px 0 0;padding-left:18px}.actnotes li{margin:2px 0;word-break:break-word}
  .actnochg{margin-top:6px;font-size:12.5px;color:var(--muted,#8a87a6)}
  .actfoot{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin:4px 0 10px}
  .actdel-all{color:var(--crit,#dc2626)}
  @media (max-width:760px){.actkpis{grid-template-columns:repeat(2,minmax(0,1fr))}.actkpis>div:last-child{grid-column:span 2}.actbar select{flex:1 1 45%}}
  @media (max-width:560px){.actrow{grid-template-columns:1fr;padding:14px}.actline{display:none}.acttime{flex-direction:row;gap:8px;align-items:baseline}.actmerge{width:100%}.actchg td:first-child{white-space:normal}}`;
  document.head.appendChild(css);
})();
