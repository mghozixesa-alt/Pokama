# Niagaaja

Web app jual beli elektronik bekas bersertifikat — unit bisnis PT Popo Karya Investama (Garut). Terpisah dari Rentalaja: repo, database, dan ID unit (`NJ-xxxx`) sendiri.

Spesifikasi lengkap: doc "Spesifikasi Teknis Niagaaja" di Project Niagaaja (claude.ai). Desain: canvas "Niagaaja UI/UX".

## Stack

Next.js 15 (App Router) · React 19 · Tailwind 3 · Supabase (Auth Google, Postgres, Storage) · Vercel.

## Menjalankan lokal

```bash
npm install
cp .env.example .env.local      # isi NEXT_PUBLIC_SITE_URL & NEXT_PUBLIC_WA_NUMBER
npm run dev                      # http://localhost:3000
```

## Supabase

Project: `niagaaja` (ap-southeast-1), ref `ytaprobsqfrrrifjwhpt`. Skema sudah diterapkan dari `supabase/migrations/0001_schema.sql`; data contoh dari `supabase/seed.sql`.

Yang masih perlu disetel di dashboard Supabase:

1. **Authentication → Providers → Google**: isi Client ID & Secret dari Google Cloud Console. Authorized redirect URI: `https://ytaprobsqfrrrifjwhpt.supabase.co/auth/v1/callback`.
2. **Authentication → URL Configuration**: Site URL = domain produksi; tambahkan `http://localhost:3000/**` dan `https://<domain>/**` ke Redirect URLs.
3. **Jadikan akun staf**: setelah login pertama kali dengan Google, jalankan di SQL editor:
   ```sql
   update profiles set role = 'admin' where id = (select id from auth.users where email = 'email@anda.com');
   ```
4. **Rekening pembayaran** (tampil ke pelanggan): `update settings set value = '{"bank":"BCA","number":"1234567890","holder":"PT Popo Karya Investama"}' where key = 'bank_account';`

## Deploy ke Vercel

1. Import repo ini → Framework Next.js (otomatis).
2. Environment Variables: salin dari `.env.example` (ubah `NEXT_PUBLIC_SITE_URL` ke domain produksi).
3. Domain: `niagaaja.co.id` → arahkan DNS dari Hostinger ke Vercel.

## Struktur

```
src/app/
  page.tsx                 Beranda (hero, kategori, banner, baru masuk)
  katalog/                 Katalog + filter chip + urutkan
  unit/[publicId]/         Detail unit, pilih grade = harga, sertifikat, tawar
  cek/[token]/             Sertifikat publik (dari QR)
  booking/[publicId]/      Booking + pilih cara bayar (transfer / tunai)
  pesanan/                 Daftar pesanan & tawaran; detail = instruksi transfer + unggah bukti
  akun/                    Profil, Niaga Poin, garansi aktif
  masuk/ auth/             Login Google
  admin/                   Ringkasan, stok & kepemilikan, sertifikat cek, konfirmasi bayar, tawaran, pesanan
  tukar-tambah, pantau-harga, servis, poin   (Fase 2 — sementara via WhatsApp)
src/lib/                   supabase client/server/middleware, format, pricing, types
supabase/                  migrations + seed
```

## Alur pembayaran manual

Booking → `orders.status = menunggu_bayar` (unit `dipesan`, ditahan 24 jam) → pelanggan transfer **nominal + 3 digit kode unik** lalu unggah bukti ke bucket `proofs` → `menunggu_konfirmasi` → admin "Terima" di `/admin/pembayaran` → `dibayar` (unit `terjual`) → `disiapkan` → `dikirim` → `selesai` (garansi & Niaga Poin otomatis).

## Fase berikutnya

- Fase 2: tawar (sudah ada dasarnya), tukar tambah, pantau harga, Niaga Poin penuh, servis.
- Fase 3: titip ke Rentalaja — tabel `consignments` & `sync_events` sudah ada; tinggal endpoint `POST /api/sync` + webhook keluar.
