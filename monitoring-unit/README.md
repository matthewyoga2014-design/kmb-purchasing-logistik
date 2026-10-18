# Monitoring Unit All Project

Web untuk memantau rencana kirim, perjalanan, kedatangan, mobilisasi, dan bukti dokumentasi unit di setiap project.

Web online: https://matthewyoga2014-design.github.io/kmb-purchasing-logistik/monitoring-unit/

## Isi folder

```
monitoring-unit/
├── index.html            ← web (tampilan, dashboard, form, hitungan, print, unduh Excel)
├── apps-script/
│   ├── Code.gs           ← jembatan ke Google Sheets & Google Drive (dijalankan di Apps Script)
│   └── appsscript.json   ← pengaturan Apps Script (zona waktu, akses web app)
└── README.md
```

| Bagian | Berjalan di | Tugas |
|---|---|---|
| `index.html` | Browser, di-hosting GitHub Pages | Semua tampilan dan logika web |
| `apps-script/Code.gs` | Google Apps Script di dalam Google Sheet "Monitoring Unit & Mobilisasi" | Membaca/menyimpan data ke Sheet, upload bukti ke Drive, cek Pemilik/Editor |
| Supabase (project `kmb-manpower-system`) | Cloud | Login, daftar Editor, alamat Apps Script yang dipakai web |

`index.html` tidak menulis alamat Apps Script di kodenya. Alamatnya disimpan di Supabase dan diisi lewat menu **Akun → sumber data** di web.

## Mengubah web (`index.html`)

1. Buka folder repo di VS Code.
2. Untuk melihat hasil: klik kanan `monitoring-unit/index.html` → **Open with Live Server** (ekstensi Live Server).
   Data yang tampil adalah data asli, jadi perubahan data saat uji coba ikut tersimpan.
3. Selesai: **Source Control → Commit → Sync/Push**. GitHub Pages memperbarui web dalam 1–2 menit.

## Mengubah Apps Script (`Code.gs`)

Mengubah file ini di VS Code **tidak** langsung mengubah Apps Script. Pilih salah satu cara:

**Cara A — tempel manual**
1. Google Sheet → **Ekstensi → Apps Script**.
2. Ganti seluruh isi `Code.gs` dengan isi file ini, lalu Simpan.
3. **Terapkan → Kelola penerapan → ikon pensil → Versi: Versi baru → Terapkan**.
   Pakai cara ini supaya alamat `/exec` tetap sama.

**Cara B — dari VS Code dengan clasp**
1. Pasang Node.js, lalu di terminal: `npm install -g @google/clasp` dan `clasp login`.
2. Aktifkan Apps Script API: https://script.google.com/home/usersettings
3. Ambil **Script ID**: editor Apps Script → **Setelan project** (ikon roda gigi) → *ID Skrip*.
4. Di folder `monitoring-unit/apps-script/` buat file `.clasp.json`:
   ```json
   { "scriptId": "TEMPEL_SCRIPT_ID_DI_SINI", "rootDir": "." }
   ```
5. Pertama kali, cocokkan dulu dengan yang ada di Google: `clasp pull` (lalu periksa perbedaannya di Source Control sebelum commit).
6. Setelah mengubah `Code.gs`: `clasp push`, lalu deploy versi baru lewat **Kelola penerapan** seperti Cara A
   (atau `clasp deployments` untuk melihat ID penerapan, lalu `clasp deploy -i ID_PENERAPAN` supaya alamat `/exec` tetap sama).

## Kapan keduanya harus diubah bersamaan

- Hanya tampilan (warna, teks, tata letak) → cukup `index.html`.
- Menambah/mengganti kolom data → ubah `index.html` **dan** `Code.gs` (daftar kolom ada di `SHEETS` di awal `Code.gs`), lalu deploy versi baru Apps Script.
  Kolom baru otomatis ditambahkan di kanan tab Sheet saat pertama dipakai.
