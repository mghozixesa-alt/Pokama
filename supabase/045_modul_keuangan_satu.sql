-- 045 Satu kartu "Keuangan" di beranda Sistem Kerja (4 Nov 2026): kartu lama /keuangan diarahkan ke /buku,
-- kartu "Buku Keuangan" dari 043 dihapus. Diterapkan dengan mengganti teks fungsi pk_modules().
do $$ declare d text; i int; j int; begin
  d := pg_get_functiondef('public.pk_modules()'::regprocedure);
  i := position(E'  if public.pk_fin_can_read() then\n    select count(*), count(*) filter (where due_date' in d);
  j := position(E'  if public.af_can_view() then' in d);
  if i > 0 and j > i then d := substr(d, 1, i - 1) || substr(d, j); end if;
  d := replace(d, $q$'name', 'Keuangan grup', 'href', '/keuangan/'$q$, $q$'name', 'Keuangan', 'href', '/buku/'$q$);
  d := replace(d, $q$'Buku, kas, laba rugi semua unit'$q$, $q$'Catat biaya, kas, penjualan; laporan semua unit'$q$);
  execute d;
end $$;
