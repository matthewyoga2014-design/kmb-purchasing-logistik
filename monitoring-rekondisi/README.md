# Monitoring Rekondisi Vessel & Dolly (pribadi)

Monitoring rekondisi unit Vessel & Dolly per vendor/jobsite (KMB, Trinanda, …): timeframe dengan tanggal mulai menyusul, update aktual Shift 1 + 2, permasalahan, Logistik/MOL, populasi unit, laporan Excel/PDF.

Alamat: https://matthewyoga2014-design.github.io/kmb-purchasing-logistik/monitoring-rekondisi/

## Cara kerja
- **Login**: akun Portal Monitoring (Supabase, sama dengan Notulensi).
- **Akses**: web pribadi. Hanya Pemilik (`matthewyoga2014@gmail.com`) yang melihat kartunya di Beranda dan bisa membuka data. Pemilik bisa menambah email lain dari menu *Pengaturan → Hak akses pengguna* bila perlu.
- **Penyimpanan**: Google Drive milik Pemilik, lewat Google Apps Script (`apps-script/Code.gs`).
  - `Web Monitoring Rekondisi/rekondisi-data.json` — jobsite, unit, timeframe, update aktual, permasalahan, MOL, log.
  - `Web Monitoring Rekondisi/Dokumentasi/<Kode unit>/<Jenis>/…` — foto dokumentasi.
  - `Web Monitoring Rekondisi/Dokumentasi/Arsip Upload Excel/` — salinan file Excel yang diupload.
- Data unit (kode, serial number) **tidak** disimpan di repo ini karena repo publik; unit dimuat dari file Excel populasi ke Drive.

## Pasang Apps Script (sekali saja)
1. Buka https://script.google.com dengan akun Google Pemilik → **New project**, beri nama `Web Monitoring Rekondisi`.
2. Hapus isi `Code.gs`, tempel seluruh isi `apps-script/Code.gs` dari folder ini, lalu **Save**.
3. Pilih fungsi `setup` → **Run** → izinkan akses Google Drive. Folder `Web Monitoring Rekondisi` dibuat di Drive.
4. **Deploy → New deployment → Web app** — Execute as: **Me**, Who has access: **Anyone** → **Deploy**, salin **Web app URL** (`…/exec`).
5. Buka web ini, masuk, lalu tempel URL tersebut saat diminta. (Atau ganti `@@GAS_URL@@` di `index.html` dengan URL itu agar tertanam permanen.)

"Anyone" hanya berarti alamat Apps Script bisa dihubungi. Setiap permintaan tetap diperiksa: harus membawa login Supabase yang sah dan email yang terdaftar.

Setelah mengubah `Code.gs`, pakai **Deploy → Manage deployments → Edit → New version** supaya URL tetap sama.

## Mengisi data pertama kali
1. Masuk sebagai Pemilik → di Beranda web ini klik **Muat data awal** (jobsite KMB & Trinanda + template timeframe KMB dari Job Sheet).
2. **Upload Data → Populasi unit** → pilih file *Update Monitoring Vessel dan Dolly Rekondisi.xlsx*. Unit yang belum selesai otomatis ditugaskan ke jobsite sesuai kolom **Vendor**.
3. **Isi tanggal mulai** unit yang sudah masuk workshop — tahapan lain tersusun otomatis.

Template vendor lain: **Upload Data → Timeframe / Job Sheet** dengan file berformat *Time Frame Rekondisi* (sheet Grafik Vessel / Grafik Dolly).
