# Buku Keuangan (ala Kledo)

Pencatatan harian tim Keuangan di `app.pokama.org/buku`, tampilan meniru Kledo: bilah atas putih dengan tombol cepat (+ Jual, + Beli, + Biaya), menu samping, dan formulir dokumen.

- Akses: CEO, Kepala Staf (lihat saja), Keuangan. Masuk memakai sesi Sistem Kerja (`/marketing/gate.js`, wajib 2 langkah).
- Database: `supabase/042_buku_biaya_kas.sql` (terpasang 4 Nov 2026). Setiap dokumen membukukan jurnal lewat `pk_fin_post`, sehingga Laba Rugi, Neraca, Arus Kas, dan laporan lain di `/keuangan` langsung ikut.
- Tahap 1 (sudah):
  - **Biaya**: catat biaya lunas atau bayar nanti (masuk Hutang usaha), banyak baris akun, unit bisnis per baris, tempel ke unit aset (nomor aset `CAT-NNNN`), potongan PPh, bayar sebagian/lunas, batalkan (jurnal dibalik). Nomor `BYYYMM-NNNNN`.
  - **Kas & Bank**: saldo per rekening dikelompokkan per unit bisnis, masuk/keluar per periode, selisih dengan saldo mutasi bank, kirim dana (`KD`), terima dana (`TD`), transfer antar rekening (`TF`).
  - **Daftar Akun** dengan saldo, **Buku Besar** per akun (saldo berjalan, ekspor CSV).
  - **Laporan**: menautkan ke laporan di `/keuangan`.
- Tahap 2 (`supabase/044_buku_lengkap.sql`, `modul.js`, 4 Nov 2026):
  - **Dasbor** padat metrik: kas, pendapatan, beban, laba, piutang, hutang; tren 6 bulan per unit bisnis; gauge rasio beban, runway, jurnal otomatis; arus kas harian; beban terbesar; kinerja unit; sumber pendapatan; jatuh tempo; daftar tindakan.
  - **Penjualan** (tagihan/invoice `INV`) dan **Pembelian** (`PB`): produk atau akun per baris, diskon, PPN 11/12%, termin, lunas langsung, terima/bayar sebagian, batal (jurnal & stok dibalik), cetak invoice, salin teks WA.
  - **Produk & Stok**: barang/jasa, stok dengan biaya rata-rata, HPP otomatis saat dijual, pemakaian part untuk servis unit aset, opname, saldo awal stok, stok minimum.
  - **Aset Tetap**: daftarkan semua unit Rentalaja App sekali klik, penyusutan garis lurus bulanan (idempoten), lepas/jual aset dengan laba/rugi pelepasan.
  - **Pajak**: PPN keluaran/masukan, PPh dipotong, saldo hutang pajak.
  - **Laporan native**: Laba Rugi (per unit bisnis, banding periode lalu, CSV), Neraca (cek seimbang), Arus Kas, Jurnal Umum.
  - **Lainnya**: Anggaran & Target, Gaji & klaim petugas, Persetujuan & antrean, Integrasi & tutup buku (memakai fungsi Panel Keuangan yang sama).
- Uji lokal: buka `http://localhost:…/buku/`; `uji-lokal.js` menyediakan data tiruan dan hanya dimuat di localhost.
