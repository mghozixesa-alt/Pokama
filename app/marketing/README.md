# Dashboard Marketing — prototipe

Dashboard Marketing Pokama di `pokama.org/marketing`, masih dengan **data contoh**. Belum tersambung ke database.

- Masuk memakai akun dan sesi yang sama dengan Sistem Kerja (`gate.js`, kunci `pokama.session`). Tidak ada file KKH yang diubah.
- `index.html` mengalihkan ke `Main.dc.html`. `TV.html` = mode layar TV.
- `dc-lite.js` menjalankan halaman (templat `{{…}}`, perulangan, kondisi, event).
- `fun.js` / `fun.css` = lapisan visual: cerita minggu ini, rekap bulanan, cincin target, simulasi budget, papan juara, feed, galeri iklan, papan konten, story WA.
- `mobile.css` / `mobile.js` = tampilan HP.
- Sumber rancangan ada di `design/marketing/` (format kanvas `.dc.html`).
- Rancangan data: dokumen "Arsitektur Data Marketing Pokama". Tabel database: `supabase/019_mk_marketing.sql` (**belum diterapkan**; pembatal di `019_mk_marketing_down.sql`).
