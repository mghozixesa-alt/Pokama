# Panel Keuangan grup

Modul Keuangan Pokama di `app.pokama.org/keuangan`. Satu buku untuk semua unit bisnis (Rentalaja, TripinAja, Niagaaja) dan Holding.

- Akses: CEO, Kepala Staf (lihat saja), Keuangan. Masuk memakai akun & sesi Sistem Kerja (`/marketing/gate.js`, wajib 2 langkah).
- Data dari fungsi database `pk_fin_*` (`supabase/018_keuangan_*.sql`). **Selama 018 belum diterapkan**, halaman otomatis memakai data contoh dari `demo.js` (bentuknya sama persis dengan hasil fungsi database) dan menampilkan pita "DATA CONTOH". Begitu 018 diterapkan, halaman langsung memakai data sungguhan tanpa perubahan kode.
- Halaman: Ringkasan (perlu keputusan, 12 metrik, kinerja unit setelah biaya holding, tren 6 bulan, kas harian, lini bisnis, kas per pos, jatuh tempo, biaya terbesar, sumber pendapatan, kesehatan data), Per unit bisnis, Kas & bank, Kewajiban & jatuh tempo, Belanja (RAB & LPJ), Laba rugi (per unit / per lini / per divisi, dengan periode lalu), Neraca, Buku jurnal, Antrean Keuangan, Sumber data & tutup buku.
- Tindakan (peta akun, coba ulang, abaikan, bukukan mutasi, impor mutasi CSV, jurnal balik, tutup buku, kunci API, kewajiban rutin) hanya untuk Keuangan & CEO, dan hanya aktif dengan data sungguhan.
- "Salin ringkasan" menyalin teks untuk WhatsApp. Kirim hanya ke nomor owner dan Keuangan, bukan ke grup.

Catatan penerapan 018: `018_keuangan_rentalaja.sql` mematikan mesin akuntansi Rentalaja App (trigger `t_fin_*`) dan memindahkan pembukuan ke Pokama. Terapkan setelah neraca saldo awal dari Jurnal Mekari siap.
