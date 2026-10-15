# Backend akses 1-link KMB & KTA-TRA

Supabase project: `kmb-manpower-system` (`yoviojbfyvgpllxisjvy`)

## Target akses
- Owner: `matthewyoga2014@gmail.com`
- Editor: email yang ditambahkan Owner pada menu Pengaturan.
- Viewer: otomatis untuk semua pengguna lain / pengunjung tanpa login.
- Viewer hanya membaca `app_state_public`, yang dibersihkan dari field sensitif.
- Owner/Editor membaca dan menulis `app_state_private`.

## URL web tunggal
- KMB: https://matthewyoga2014-design.github.io/kmb-purchasing-logistik/monitoring-manpower-kmb/
- KTA-TRA: https://matthewyoga2014-design.github.io/kmb-purchasing-logistik/monitoring-kta-tra/

Tidak perlu lagi `?mode=editor` atau `?mode=viewer`.

## Auth URL Configuration — satu langkah dashboard yang wajib
Connector Supabase saat ini tidak menyediakan aksi untuk mengubah Auth URL Configuration.
Di Supabase Dashboard > Authentication > URL Configuration set:

Site URL:
`https://matthewyoga2014-design.github.io/kmb-purchasing-logistik/`

Additional Redirect URLs:
- `https://matthewyoga2014-design.github.io/kmb-purchasing-logistik/monitoring-manpower-kmb/**`
- `https://matthewyoga2014-design.github.io/kmb-purchasing-logistik/monitoring-kta-tra/**`

Setelah itu tombol **Masuk untuk Edit** akan mengirim Magic Link email dan kembali ke web yang sama.

## Database
- `access_roles`: hanya owner/editor. Email yang tidak ada di tabel otomatis Viewer.
- `app_state_public`: state yang aman untuk Viewer.
- `app_state_private`: state lengkap Owner/Editor.
- RLS aktif pada seluruh tabel.
- Realtime publication aktif untuk state public/private.

## Migrasi data browser lama
Saat Owner pertama kali login:
- bila cloud masih berisi initial seed dan browser memiliki data localStorage lama, data browser Owner diprioritaskan dan diunggah ke cloud;
- setelah itu browser/perangkat lain menggunakan state cloud;
- logout beralih kembali ke state public Viewer.
