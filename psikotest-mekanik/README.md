# Psikotest & Uji Kompetensi Mekanik – KMB

Web mandiri untuk tes teknis mekanik plant tambang (new hire & evaluasi akhir kontrak) dan penentuan grade
(Helper · Junior G1–G3 · Middle G4–G6 · Senior G7–G9 · Supervisor G10).

- URL: https://matthewyoga2014-design.github.io/kmb-purchasing-logistik/psikotest-mekanik/
- Database: Supabase `kmb-manpower-system` (tabel `pk_*`, akses `app_access_roles` app_id `psikotest`).
- Peserta membuka link `?t=TOKEN` tanpa login. Kunci jawaban tidak pernah dikirim ke peserta; nilai dihitung di server.
- Salinan otomatis ke Google Drive: `apps-script/Code.gs` (panduan di bagian atas file & di menu Pengaturan).
- Migrasi database: `supabase/psikotest-v2.sql`.
