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

## Kategori & persentase
- **Kategori notulensi**: Persiapan, Permasalahan, Lainnya (bisa ditambah). Dipilih dengan klik saat unduh template, Meeting Baru, form live, form update Word/Excel, upload, dan koreksi dari file.
- **Unduh Template Notulensi**: pilih kategori lalu **Unduh Excel** atau **Unduh Word**.
- **Template Excel (Persiapan/Permasalahan)**, tanpa macro: kolom No, Bab, Topik, Hasil Pembahasan, Tindak Lanjut, PIC, Due Date, Status + **Sumber Data** (dropdown kode), **Lihat ›**, **Hasil (%)**, **Nilai Sub Bab**, **Nilai Bab**.
  - Kanan atas: **Total kesiapan**, dropdown **Pilih sumber** + **Buka ›**, dan **+ Tambah sumber**.
  - Tambah sumber: buka sheet *SD contoh* → klik kanan tab › Move or Copy › Create a copy → ganti nama SD 1, SD 2, … → pilih kode yang sama di kolom Sumber Data. Sheet SD hanya ada untuk sumber yang dipakai.
  - Sheet SD: Nama sumber data, lalu No, Persiapan, Jumlah, Aktual, Persentase. Hasil = rata-rata Persentase.
  - Hasil (%) per tindak lanjut dari sheet SD; tanpa sumber: Close/Continue = 100%, Open = 0%. Nilai Sub Bab = rata-rata Hasil per Topik; Nilai Bab = rata-rata Nilai Sub Bab; Total = rata-rata Nilai Bab. Sama dengan perhitungan web.
  - Saat upload, setiap sheet yang namanya sama dengan kode di kolom Sumber Data ikut terbaca. Form dari web hanya membuat sheet SD untuk sumber yang sudah ada.
- **Template Word**: kolom Sumber Data diisi teks, mis. "Plan 6 / Aktual 2".
- **Di web**: klik kolom *Sumber Data* pada tindak lanjut → sheet isian (bisa tempel dari Excel), plus upload rincian/bukti.
- **Koreksi dari file**: menu ⋮ › *Koreksi Meeting ke-n dari file Word/Excel revisi*.
