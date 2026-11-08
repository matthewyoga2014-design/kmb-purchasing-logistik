/**
 * Pengganti fungsi syncFiles_ di Apps Script "Monitoring Manpower → Google Drive" (sinkron tiap 10 menit).
 *
 * Cara pasang (sekali saja):
 *   1. Buka script.google.com → proyek sinkron Monitoring Manpower (yang berisi fungsi `mulai` dan `sinkron`).
 *   2. Cari fungsi `syncFiles_` lalu ganti SELURUH fungsinya dengan isi di bawah. Bagian CFG / MAP / TOKEN jangan diubah.
 *   3. Simpan (Ctrl+S). Tidak perlu deploy ulang; jadwal 10 menit tetap berjalan.
 *
 * Hasil di Drive:
 *   Monitoring Manpower/<jobsite>/Berkas Pelamar/<Kandidat - Jabatan>/…   (seperti sebelumnya)
 *   Monitoring Manpower/<jobsite>/Berkas Karyawan/<Nama Karyawan>/…       (baru: upload dari form Data Karyawan)
 *
 * Sebelum fungsi ini dipasang, berkas karyawan tetap tersalin, tetapi masuk ke
 * "Berkas Pelamar/<Nama> - Berkas Karyawan". Setelah dipasang, folder itu otomatis dipindah ke "Berkas Karyawan".
 */
function syncFiles_(root) {
  const res = fetchJson_(CFG.SB_URL + '/functions/v1/kta-print', 'post', { op: 'drivefiles', token: CFG.TOKEN });
  if (!res || res.ok !== true || !Array.isArray(res.files)) return;   // gagal ambil daftar → jangan hapus apa pun
  const GROUPS = ['Berkas Pelamar', 'Berkas Karyawan'];
  const want = {};   // id → grup → folder → { namaFile: url }
  Object.keys(MAP).forEach(function (id) { want[id] = {}; GROUPS.forEach(function (g) { want[id][g] = {}; }); });
  res.files.forEach(function (x) {
    if (!want[x.state]) return;
    const g = x.group === 'Berkas Karyawan' ? 'Berkas Karyawan' : 'Berkas Pelamar';
    const d = safe_(g === 'Berkas Karyawan' ? x.cand : x.cand + ' - ' + x.jabatan);
    (want[x.state][g][d] = want[x.state][g][d] || {})[safe_(x.name)] = x.url;
  });
  Object.keys(MAP).forEach(function (id) {
    const site = folderPath_(root, MAP[id].path);
    GROUPS.forEach(function (g) {
      const w = want[id][g];
      if (!Object.keys(w).length && !site.getFoldersByName(g).hasNext()) return;   // jangan buat folder kosong
      const base = folderPath_(site, [g]);
      // hapus folder / file yang sudah tidak ada di web
      const it = base.getFolders();
      while (it.hasNext()) {
        const f = it.next(); const keep = w[f.getName()];
        if (!keep) { f.setTrashed(true); continue; }
        const fi = f.getFiles();
        while (fi.hasNext()) { const x = fi.next(); if (!keep[x.getName()]) x.setTrashed(true); }
      }
      // tambah yang baru
      Object.keys(w).forEach(function (d) {
        const dir = folderPath_(base, [d]);
        Object.keys(w[d]).forEach(function (n) {
          if (dir.getFilesByName(n).hasNext()) return;
          const r = UrlFetchApp.fetch(w[d][n], { muteHttpExceptions: true });
          if (r.getResponseCode() === 200) dir.createFile(r.getBlob().setName(n));
        });
      });
    });
  });
}
