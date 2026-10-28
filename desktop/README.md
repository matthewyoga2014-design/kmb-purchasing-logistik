# Monitoring untuk Windows (offline)

Aplikasi Windows yang menjalankan web Monitoring tanpa internet. Semua data disimpan di laptop pengguna, di `Documents\Monitoring`:

| Folder | Isi |
|---|---|
| `Excel` | File Excel dari tombol "Unduh Excel" di aplikasi (tersimpan otomatis, tanpa dialog) |
| `Backup Excel` | Backup otomatis semua data dalam Excel, satu file per hari (disimpan 60 hari) |
| `Backup Data` | Cadangan lengkap `.json` untuk dipulihkan lewat menu **Monitoring → Impor Data** |
| `Berkas` | Lampiran yang diunggah (dokumen pelamar, berkas & foto notulensi) |
| `Unduhan` | Unduhan lain (PDF, Word, gambar) |
| `data` | Database aplikasi (jangan diubah manual) |

## Cara kerja

- Halaman web di folder induk repo dipakai apa adanya. Saat build, `scripts/prepare-web.js` menyalinnya ke `desktop/web`.
- `offline/supabase-shim.js` menggantikan supabase-js: tabel, RPC, storage, dan login diarahkan ke `core/store.js` (file JSON lokal).
- Notulensi (Google Apps Script) dan Monitoring Unit (Google Sheet) juga diarahkan ke penyimpanan lokal.
- Pustaka CDN (xlsx, jspdf, pdf.js, dll.) ikut dikemas di `offline/vendor`.
- Menu **Monitoring → Ambil Data dari Monitoring Online…** menyalin data sekali dari web online (butuh internet & login email).

## Build

Installer dibuat otomatis oleh GitHub Actions (`.github/workflows/desktop-windows.yml`) di runner Windows, lalu diterbitkan di halaman Releases.

Lokal (Windows):

```
cd desktop
npm install
npm run dist:win
```

Uji di browser (tanpa Electron): `node test/smoke.js <folder-data> <folder-screenshot>` dan `node test/queries.js <folder-data>`.
