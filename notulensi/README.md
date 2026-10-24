# Web Notulensi

Monitoring notulensi meeting per unit (BUPR, KKA, KMB, Operasional, SLR 2, …): tindak lanjut Open/Continue/Close, jadwal next meeting, arsip meeting, dan berkas pendukung.

Alamat: https://matthewyoga2014-design.github.io/kmb-purchasing-logistik/notulensi/

## Cara kerja
- **Login**: akun yang sama dengan Portal Monitoring Manpower (Supabase Auth: email + password, atau link email). Database Supabase tidak dipakai untuk data notulensi.
- **Penyimpanan**: Google Drive milik Pemilik, lewat Google Apps Script (`apps-script/Code.gs`).
  - `Web Notulensi/notulensi-data.json`: folder, notulensi, meeting, daftar berkas.
  - `Web Notulensi/Berkas/<Unit>/<folder tanggal>/…`: berkas asli, mengikuti susunan folder di web.
- **Akses**: Pemilik (`matthewyoga2014@gmail.com`) selalu penuh. Pemilik menambah Editor (bisa mengubah) atau Viewer (hanya melihat) dari menu nama akun › *Akses pengguna*. Akun lain tidak bisa membuka data.
- **Print**: tombol *Print* di bilah atas mencetak halaman yang sedang dibuka (A4 landscape, tanpa menu dan tombol).

## Pasang Apps Script (sekali saja)
1. Buka https://script.google.com dengan akun Google Pemilik → **New project**, beri nama `Web Notulensi`.
2. Hapus isi `Code.gs`, tempel seluruh isi `apps-script/Code.gs` dari folder ini, lalu **Save**.
3. Pilih fungsi `setup` → **Run** → izinkan akses Google Drive. Folder `Web Notulensi` dibuat di Drive.
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - **Deploy**, lalu salin **Web app URL** (berakhiran `/exec`).
5. Buka web Notulensi, masuk, lalu tempel URL tersebut saat diminta (atau kirim URL-nya untuk ditanam permanen di `index.html`).

"Anyone" hanya berarti alamat Apps Script bisa dihubungi. Setiap permintaan tetap diperiksa: harus membawa login Supabase yang sah dan email yang terdaftar.

Setelah mengubah `Code.gs`, pakai **Deploy → Manage deployments → Edit → New version** supaya URL tetap sama.

## Mengisi data pertama kali
Masuk sebagai Pemilik → **Unit & File** → **Upload Folder** → pilih folder `Monitoring Notulensi` dari laptop. Folder bertanggal yang berisi notulensi Word/Excel menjadi *Meeting ke-n*, dan file lain menjadi lampirannya.

## Kesiapan Project (jenis Persiapan)
- **Jenis notulensi**: Persiapan, Permasalahan, Lainnya (bisa ditambah). Dibaca dari sel *Jenis Notulensi* (B11) atau diatur lewat menu ⋮ › *Ubah jenis notulensi*. Persentase kesiapan hanya untuk jenis Persiapan.
- **Template Notulensi** (halaman Notulensi › *Unduh Template Notulensi*): Bab di kolom A (`Bab I – …`), Sub Bab di kolom B (`1.1 …`), baris pembahasan di bawahnya. Template lama tanpa Bab tetap terbaca.
- **Rincian Plan–Actual** (klik persentase/Sumber pada Sub Bab › *Unduh Template Rincian* › isi › *Upload Sumber*): sheet *Rincian*, data mulai baris 10 (B Nama, C Plan, D Actual).
- **Perhitungan**: item = MIN(Actual/Plan, 100%); Sub Bab = rata-rata item valid; tanpa rincian: Close 100%, Open/Continue 0%; Bab = rata-rata Sub Bab; Total = rata-rata Bab. Bab tanpa data = *Belum Ada Data* dan tidak ikut dirata-rata.
- Upload rincian baru menggantikan nilai, versi lama tetap tersimpan sebagai riwayat. File sumber disimpan di Google Drive.
