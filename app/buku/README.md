# Buku Keuangan (ala Kledo)

Pencatatan harian tim Keuangan di `app.pokama.org/buku`, tampilan meniru Kledo: bilah atas putih dengan tombol cepat (+ Jual, + Beli, + Biaya), menu samping, dan formulir dokumen.

- Akses: CEO, Kepala Staf (lihat saja), Keuangan. Masuk memakai sesi Sistem Kerja (`/marketing/gate.js`, wajib 2 langkah).
- Database: `supabase/042_buku_biaya_kas.sql` (terpasang 4 Nov 2026). Setiap dokumen membukukan jurnal lewat `pk_fin_post`, sehingga Laba Rugi, Neraca, Arus Kas, dan laporan lain di `/keuangan` langsung ikut.
- Tahap 1 (sudah):
  - **Biaya**: catat biaya lunas atau bayar nanti (masuk Hutang usaha), banyak baris akun, unit bisnis per baris, tempel ke unit aset (nomor aset `CAT-NNNN`), potongan PPh, bayar sebagian/lunas, batalkan (jurnal dibalik). Nomor `BYYYMM-NNNNN`.
  - **Kas & Bank**: saldo per rekening dikelompokkan per unit bisnis, masuk/keluar per periode, selisih dengan saldo mutasi bank, kirim dana (`KD`), terima dana (`TD`), transfer antar rekening (`TF`).
  - **Daftar Akun** dengan saldo, **Buku Besar** per akun (saldo berjalan, ekspor CSV).
  - **Laporan**: menautkan ke laporan di `/keuangan`.
- Berikutnya: Penjualan/Tagihan, Pembelian, Produk & Stok, Aset Tetap (penyusutan), lampiran unggah file.
- Uji lokal: buka `http://localhost:…/buku/`; `uji-lokal.js` menyediakan data tiruan dan hanya dimuat di localhost.
