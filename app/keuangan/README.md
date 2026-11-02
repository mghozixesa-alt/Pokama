# Panel Keuangan grup

Modul Keuangan Pokama di `app.pokama.org/keuangan`. Satu buku untuk semua unit bisnis (Rentalaja, TripinAja, Niagaaja) dan Holding.

- Akses: CEO, Kepala Staf (lihat saja), Keuangan. Masuk memakai akun & sesi Sistem Kerja (`/marketing/gate.js`, wajib 2 langkah).
- Data dari fungsi database `pk_fin_*` (`supabase/018_keuangan_*.sql`). **Terpasang 2 Nov 2026 (018a, 018b, 018d)**; 018c (sambungan Rentalaja App) belum. Bila fungsi database tidak ditemukan, halaman otomatis memakai data contoh dari `demo.js` (bentuknya sama persis dengan hasil fungsi database) dan menampilkan pita "DATA CONTOH". Begitu 018 diterapkan, halaman langsung memakai data sungguhan tanpa perubahan kode.
- Halaman: Ringkasan (perlu keputusan, 12 metrik, kinerja unit setelah biaya holding, tren 6 bulan, kas harian, lini bisnis, kas per pos, jatuh tempo, biaya terbesar, sumber pendapatan, kesehatan data), Per unit bisnis, Kas & bank, Kewajiban & jatuh tempo, Belanja (RAB & LPJ), Laba rugi (per unit / per lini / per divisi, dengan periode lalu), Neraca, Buku jurnal, Antrean Keuangan, Sumber data & tutup buku.
- Tambahan 2 Nov (033, terpasang): Target vs realisasi, Proyeksi kas 13 minggu (kas minimum), Profit First, Kewajiban & leasing (jadwal cicilan), Piutang & hutang per pihak (umur), Arus kas, Saldo awal, Rekening & pengaturan, Jurnal manual, cetak/PDF untuk laba rugi & neraca. Semua di bawah PT Popokar Investama.
- Leasing & pinjaman (036, 2 Nov): 61 kontrak dari rekap cicilan motor Nov 2026 sudah masuk (cicilan + tanggal tempo). Pokok & tenor boleh kosong dulu; proyeksi kas tetap memakai cicilannya. 11 kontrak BCA Finance belum ada nominal cicilan.
- Riwayat sistem lama (037, 2 Nov): halaman Laporan › Riwayat sistem lama membaca `legacy_payments`/`legacy_orders` (kasir Rentalaja lama, 26 Sep 2024 – 31 Okt 2026, Rp2,89 M) lewat `pk_fin_legacy`. Tidak diposting ke buku besar (neraca dimulai dari saldo awal). 037c (tabel ringkas + `pk_fin_legacy_refresh()`) mempercepat halaman; belum terpasang bila halaman lambat.
- Diisi tim Keuangan: saldo awal, rekening (nama bank, pos), pinjaman/leasing, persentase Profit First, kas minimum, jurnal manual.
- Tindakan (peta akun, coba ulang, abaikan, bukukan mutasi, impor mutasi CSV, jurnal balik, tutup buku, kunci API, kewajiban rutin) hanya untuk Keuangan & CEO, dan hanya aktif dengan data sungguhan.
- "Salin ringkasan" menyalin teks untuk WhatsApp. Kirim hanya ke nomor owner dan Keuangan, bukan ke grup.

Catatan penerapan 018: `018_keuangan_rentalaja.sql` mematikan mesin akuntansi Rentalaja App (trigger `t_fin_*`) dan memindahkan pembukuan ke Pokama. Terapkan setelah neraca saldo awal dari Jurnal Mekari siap.
