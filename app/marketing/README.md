# Dashboard Marketing

Modul Marketing Pokama di `pokama.org/marketing`, masih dengan **data contoh**. Menunya terpisah dari Sistem Kerja (KKH), tetapi nanti memakai database yang sama.

- Masuk memakai akun dan sesi Sistem Kerja (`gate.js`, kunci `pokama.session`). Akun Kepala Staf tidak punya akses. Tidak ada file KKH yang diubah.
- `index.html` mengalihkan ke `kerja.html` (semua menu: Dashboard utama, menu Kerja, menu Analitik; data uji coba tersimpan di browser, belum di database). Halaman `*.dc.html` lama sekarang hanya mengalihkan ke menu yang setara.
- `dc-lite.js` menjalankan halaman (templat `{{…}}`, perulangan, kondisi, event). Tampilan HP ada di CSS tiap halaman.
- Halaman: Dashboard utama, Hari ini (`Main`), Campaign, Content plan (`MingguDepan`), Content bank (`BankIde`), Analytics IG & TikTok (`Sosial`), Paid ads, KOL, SEO (`Maps`), WA & CS, Halaman CS (HP), Review mingguan (`Hasil`), Laporan & WA, Tim & workload, Input & patokan (`Data`), Brand & positioning.
- Sumber rancangan ada di `design/marketing/` (format kanvas `.dc.html`). Halaman di sini dibuat dari sumber itu.
- Tabel database: `supabase/019_mk_marketing.sql` (**belum diterapkan**; pembatal di `019_mk_marketing_down.sql`).
