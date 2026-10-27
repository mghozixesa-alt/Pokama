# Sistem Kerja Pokama

Aplikasi kerja harian tim management PT Popo Karya Investama, terbit di **https://pokama.org**.

- `app/` — aplikasi web (HTML + JavaScript modul, tanpa build). Dideploy Vercel (root directory `app`).
  - `core.js` sambungan Supabase (auth + REST), sesi, komponen dasar.
  - `app.js` login, kerangka menu laptop & HP, router.
  - `screens/` layar: KKH, Proyek & Tugas, Review, Permintaan Bantuan, Pengajuan Belanja, Kehadiran, Unit Bisnis, Tim & Peran, Performa, Library, Pengaturan.
- `supabase/` — skema database (tabel `pk_*` di proyek Supabase `rentalaja-produksi`), aturan akses per peran, dan fungsi alur (RAB, review, KKH, cuti).
- `design/` — rancangan layar (canvas desain).
- `brand/` — logo Pokama.

Login: email + password (akun dibuat dari menu Tim & Peran), Google (aktifkan provider Google di Supabase), atau kode WhatsApp (memakai fungsi auth-otp Rentalaja App).
