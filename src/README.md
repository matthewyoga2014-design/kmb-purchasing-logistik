# Kode sumber web Monitoring

Folder ini berisi kode sumber halaman yang sudah jadi di repo. Data karyawan dan kunci rahasia sengaja tidak disimpan di sini.

| Folder | Menghasilkan | Cara build |
|---|---|---|
| `hub/` | `index.html` (halaman utama Monitoring: login, undangan, bagikan link, izin menu) | `python3 hub/build_hub2.py` (mengambil gaya dari `manpower-portal/index.html`) |
| `build/` | `manpower-kta-tra/`, `manpower-bupr/`, `manpower-mbj/`, `manpower-kmb/` | `build5.py` + `buildmulti.py` |
| `apd/` | `monitoring-apd-kmb/` (Monitoring APD + Form GA Request) | `python3 apd/build_apd.py` |
| `portal/` | template `manpower-portal/` (Monitoring MPP Achievement All Jobsite) | |
| `hub/migration_access.sql` | aturan akses di Supabase (undangan, permintaan akses, izin menu) | sudah terpasang |

Catatan: skrip build ditulis untuk folder kerja sementara, jadi alamat folder di dalamnya perlu disesuaikan bila dijalankan di tempat lain.

## shared/ — panel upload seragam
`uppick.js` adalah panel upload "Sisipkan file" (Jelajah + tarik file ke sini) yang sama seperti di sub portal KTA - TRA.
Panel ini dipasang ke APD, Monitoring Unit dan Notulensi oleh `inject_uppick.py` (aman dijalankan berulang).
Setelah build ulang APD atau mengganti file Unit/Notulensi, jalankan: `python3 src/shared/inject_uppick.py`.
