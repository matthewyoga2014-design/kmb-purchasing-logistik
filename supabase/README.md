# Backend akses 1-link KMB & KTA-TRA

Target:
- Satu URL untuk setiap web.
- Pemilik: `matthewyoga2014@gmail.com` => full access.
- Email yang tercantum sebagai `editor` => input/edit data operasional.
- Email lain atau pengunjung tanpa role => viewer.
- Viewer tidak menerima data MP sensitif dari `app_state_private`.

Tabel:
- `access_roles`: email Owner/Editor.
- `app_state_public`: state operasional yang aman untuk viewer.
- `app_state_private`: state lengkap untuk Owner/Editor.

Setelah project Supabase terhubung:
1. Jalankan `schema.sql`.
2. Aktifkan email authentication (magic link / OTP).
3. Set Site URL ke GitHub Pages repo ini dan tambahkan redirect URL untuk:
   - /monitoring-manpower-kmb/
   - /monitoring-kta-tra/
4. Masukkan Project URL + anon/publishable key ke konfigurasi frontend.
5. Web membaca role dari email login. Jika role tidak ditemukan, otomatis Viewer.
6. Owner mengelola daftar Editor dari menu Pengaturan.
