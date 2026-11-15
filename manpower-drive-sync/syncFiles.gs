/**
 * Pengganti fungsi syncFiles_ di Apps Script "Monitoring Manpower → Google Drive" (sinkron tiap 10 menit).
 * Versi 2: berkas dibuka langsung dari Google Drive, dibagikan PER BERKAS ke Editor portal.
 *
 * Cara pasang (sekali saja):
 *   1. Buka script.google.com → proyek sinkron Monitoring Manpower (yang berisi fungsi `mulai` dan `sinkron`).
 *   2. Di panel kiri, klik "Services" (Layanan) → "+" → pilih "Drive API" → versi v3 → Add.
 *   3. Cari fungsi `syncFiles_` lalu ganti SELURUH fungsinya dengan isi di bawah
 *      (mulai `function syncFiles_` sampai akhir file ini). Bagian CFG / MAP / TOKEN jangan diubah.
 *   4. Simpan (Ctrl+S). Jalankan `sinkron` sekali dari editor dan setujui izin Google yang diminta.
 *      Jadwal 10 menit tetap berjalan.
 *
 * Hasil di Drive:
 *   Monitoring Manpower/<jobsite>/Berkas Pelamar/<Kandidat - Jabatan>/…
 *   Monitoring Manpower/<jobsite>/Berkas Karyawan/<Nama Karyawan>/…
 *
 * Yang dilakukan versi 2:
 *   - Menyalin berkas baru dari web ke Drive (seperti sebelumnya).
 *   - Melaporkan ID Drive tiap berkas ke web, sehingga web membuka berkas langsung dari Drive.
 *     Setelah 1 jam aman di Drive, salinan di Supabase dihapus otomatis (hemat kuota).
 *   - Membagikan tiap berkas (bukan folder) ke email Editor portal itu sebagai PELIHAT,
 *     tanpa email pemberitahuan, dan mematikan unduh/cetak/salin untuk pelihat.
 *   - Mencabut akses berkas dari email yang sudah tidak menjadi Editor.
 *   - Folder Drive TIDAK pernah dibagikan, jadi orang lain tidak bisa melihat berkas lain.
 */
function syncFiles_(root) {
  const started = Date.now();
  const res = fetchJson_(CFG.SB_URL + '/functions/v1/kta-print', 'post', { op: 'drivefiles', token: CFG.TOKEN });
  if (!res || res.ok !== true || !Array.isArray(res.files)) return;   // gagal ambil daftar → jangan hapus apa pun
  const GROUPS = ['Berkas Pelamar', 'Berkas Karyawan'];
  const want = {};   // id → grup → folder → { namaFile: item }
  const knownIds = {};   // ID Drive yang tercatat di web → jangan pernah dibuang
  Object.keys(MAP).forEach(function (id) { want[id] = {}; GROUPS.forEach(function (g) { want[id][g] = {}; }); });
  res.files.forEach(function (x) {
    if (x.drive_id) knownIds[x.drive_id] = true;
    if (!want[x.state]) return;
    const g = x.group === 'Berkas Karyawan' ? 'Berkas Karyawan' : 'Berkas Pelamar';
    const d = safe_(g === 'Berkas Karyawan' ? x.cand : x.cand + ' - ' + x.jabatan);
    (want[x.state][g][d] = want[x.state][g][d] || {})[safe_(x.name)] = x;
  });
  const report = [];
  let shareBudget = 150;   // batas aksi berbagi per putaran (sisanya lanjut 10 menit lagi)
  Object.keys(MAP).forEach(function (id) {
    const site = folderPath_(root, MAP[id].path);
    GROUPS.forEach(function (g) {
      const w = want[id][g];
      if (!Object.keys(w).length && !site.getFoldersByName(g).hasNext()) return;   // jangan buat folder kosong
      const base = folderPath_(site, [g]);
      // hapus folder / file yang sudah tidak ada di web (kecuali berkas yang ID Drive-nya tercatat)
      const it = base.getFolders();
      while (it.hasNext()) {
        const f = it.next(); const keep = w[f.getName()];
        if (!keep) { if (!hasKnown_(f, knownIds)) f.setTrashed(true); continue; }
        const fi = f.getFiles();
        while (fi.hasNext()) { const x = fi.next(); if (!keep[x.getName()] && !knownIds[x.getId()]) x.setTrashed(true); }
      }
      // tambah yang baru, catat ID Drive, atur akses per berkas
      Object.keys(w).forEach(function (d) {
        const dir = folderPath_(base, [d]);
        Object.keys(w[d]).forEach(function (n) {
          const item = w[d][n];
          let file = null;
          if (item.drive_id) { try { file = DriveApp.getFileById(item.drive_id); if (file.isTrashed()) file = null; } catch (e) { file = null; } }
          if (!file) { const ex = dir.getFilesByName(n); if (ex.hasNext()) file = ex.next(); }
          if (!file && item.url) {
            const r = UrlFetchApp.fetch(item.url, { muteHttpExceptions: true });
            if (r.getResponseCode() === 200) file = dir.createFile(r.getBlob().setName(n));
          }
          if (!file) return;
          const fid = file.getId();
          const isNew = item.drive_id !== fid;
          // pelihat tidak bisa unduh / cetak / salin
          if (isNew) { try { Drive.Files.update({ copyRequiresWriterPermission: true }, fid); } catch (e) { console.warn('kunci unduh gagal ' + n + ': ' + e); } }
          // daftar email yang sudah punya akses menurut web
          const viewers = item.viewers || [], add = item.add || [], rem = item.remove || [];
          const have = {};
          viewers.forEach(function (e) { if (add.indexOf(e) < 0) have[e] = true; });
          rem.forEach(function (e) { have[e] = true; });
          if (isNew) { add.length = 0; viewers.forEach(function (e) { add.push(e); }); Object.keys(have).forEach(function (e) { if (viewers.indexOf(e) >= 0) delete have[e]; }); }
          add.forEach(function (e) {
            if (shareBudget <= 0 || Date.now() - started > 4 * 60 * 1000) return;
            shareBudget--;
            try { Drive.Permissions.create({ role: 'reader', type: 'user', emailAddress: e }, fid, { sendNotificationEmail: false }); have[e] = true; }
            catch (err) { console.warn('bagikan gagal ' + e + ' → ' + n + ': ' + err); }
          });
          if (rem.length && shareBudget > 0) {
            shareBudget--;
            try {
              const ps = Drive.Permissions.list(fid, { fields: 'permissions(id,emailAddress,role)' }).permissions || [];
              ps.forEach(function (p) {
                const em = String(p.emailAddress || '').toLowerCase();
                if (p.role !== 'owner' && rem.indexOf(em) >= 0) { Drive.Permissions.remove(fid, p.id); delete have[em]; }
              });
            } catch (err) { console.warn('cabut akses gagal ' + n + ': ' + err); }
          }
          report.push({ id: item.id, drive_id: fid, shared_to: Object.keys(have) });
        });
      });
    });
  });
  if (res.v === 2 && report.length) {
    for (let i = 0; i < report.length; i += 200) {
      fetchJson_(CFG.SB_URL + '/functions/v1/kta-print', 'post', { op: 'drivedone', token: CFG.TOKEN, files: report.slice(i, i + 200) });
    }
  }
}

function hasKnown_(folder, knownIds) {
  const fi = folder.getFiles();
  while (fi.hasNext()) { if (knownIds[fi.next().getId()]) return true; }
  return false;
}
