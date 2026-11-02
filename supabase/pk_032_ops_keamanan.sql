-- pk_032 · Keamanan Kerja Lapangan (diterapkan: pk_032_ops_keamanan, pk_032c_lapangan_bukan_holding)
-- - Sistem Kerja holding (pk_me) wajib 2 langkah; petugas lapangan TIDAK pernah dikenali sebagai anggota holding.
-- - Fungsi Kerja Lapangan memakai ops_me(): anggota holding (2 langkah) atau petugas lapangan (login Google/email).
-- - ops_is_mgr tetap memakai pk_me (memutuskan lembur/cuti/kasbon/mutasi wajib 2 langkah).
-- - ops_active tidak bisa dipanggil langsung; fungsi pembantu tertutup untuk anon.
--
-- BELUM DITERAPKAN (perlu dijalankan dari SQL Editor dashboard Supabase oleh pemilik proyek):
-- foto absen & nota di bucket operasional hanya untuk pemilik folder atau manajemen.
drop policy if exists "operasional foto pribadi" on storage.objects;
create policy "operasional foto pribadi" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'operasional' or split_part(name, '/', 1) not in ('absen', 'klaim')
         or split_part(name, '/', 2) = auth.uid()::text
         or app.staff_role() in ('owner', 'experience_manager', 'viewer', 'finance', 'branch_head'))
  with check (bucket_id <> 'operasional' or split_part(name, '/', 1) not in ('absen', 'klaim')
         or split_part(name, '/', 2) = auth.uid()::text
         or app.staff_role() in ('owner', 'experience_manager', 'viewer', 'finance', 'branch_head'));
