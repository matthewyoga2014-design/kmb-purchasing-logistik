# Web Monitoring Rekrutmen

Monitoring lowongan, pelamar, tahap assessment, dan berkas pelamar (CV, KTP, psikotes, MCU, …).

Alamat: https://matthewyoga2014-design.github.io/kmb-purchasing-logistik/rekrutmen/
Coba tanpa Google Drive: tambahkan `?demo` di belakang alamat (data hanya di browser).

## Isi
- **Dashboard**: lowongan open, total pelamar, dalam proses, hired, rejected; grafik per Recruitment Phase dan Source; progres per lowongan; assessment terbaru.
- **Pelamar**: kolom **Source** dan **Recruitment Phase** berupa dropdown berwarna, bisa diubah langsung di tabel. Pilihan terakhir di dropdown, *＋ Tambah pilihan baru…*, menambah nilai baru beserta warnanya.
- **Detail pelamar** (klik baris): data, riwayat assessment (tambah/ubah tahap), berkas (upload, lihat, unduh, hapus).
- **Lowongan**, **Assessment**, **Berkas** (termasuk *Upload folder*: subfolder per pelamar dicocokkan otomatis).
- **Pengaturan**: daftar pilihan & warna untuk Recruitment Phase, Source, Status Lowongan, Priority, Jenis Berkas (tambah, ganti nama, ganti warna, urutkan, gabungkan); Import/Download Excel; akses pengguna.

## Penyimpanan
Google Drive milik Pemilik, lewat Google Apps Script (`apps-script/Code.gs`):
```
Web Rekrutmen/
  Monitoring Rekrutmen        ← Google Sheet: tab Lowongan, Pelamar, Assessment, Berkas, Pilihan
  Berkas Pelamar/<Nama (ID)>/ ← berkas asli
```
Di Google Sheet, kolom Source/Recruitment Phase/Phase/Status/Priority juga diberi dropdown + warna mengikuti tab Pilihan.
Berkas pelamar tidak dibagikan publik; web mengambilnya lewat Apps Script setelah memeriksa login.

## Pasang Apps Script (sekali saja)
1. Buka https://script.google.com dengan akun Google Pemilik → **Proyek baru**, beri nama `Web Rekrutmen`.
2. Hapus isi `Code.gs`, tempel seluruh isi `apps-script/Code.gs`, lalu **Simpan**.
3. Pilih fungsi `setup` → **Jalankan** → izinkan akses Google Drive & Sheets. Folder `Web Rekrutmen` dan Google Sheet dibuat.
4. **Deploy → Deployment baru → Aplikasi web** · Jalankan sebagai: **Saya** · Yang memiliki akses: **Siapa saja** → **Deploy**. Salin URL `/exec`.
5. Buka web Rekrutmen, masuk sebagai Pemilik, tempel URL tersebut (atau isi `GAS_DEFAULT` di `index.html` agar semua perangkat langsung tersambung).
6. Pengaturan › **Import Excel** → pilih file *Monitoring Rekrutmen*.

Setelah mengubah `Code.gs`: **Deploy → Kelola deployment → ikon pensil → Versi baru → Deploy** (URL tetap sama).

## Akses
Pemilik (`matthewyoga2014@gmail.com`) selalu penuh. Editor/Viewer bisa ditambah dari web (menu akun › Akses pengguna) atau lewat undangan app `rekrutmen` di halaman utama Monitoring (perlu `supabase/rekrutmen-app.sql`).
