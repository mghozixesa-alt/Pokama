-- 043 Kartu "Buku Keuangan" di beranda Sistem Kerja (pk_modules), terpasang 4 Nov 2026.
-- Disisipkan sebelum blok Mitra Affiliate; angka = biaya lewat jatuh tempo.
do $$ declare d text; ins text; begin
  d := pg_get_functiondef('public.pk_modules()'::regprocedure);
  if position('''buku''' in d) > 0 then return; end if;
  ins := $q$  if public.pk_fin_can_read() then
    select count(*), count(*) filter (where due_date < public.pk_today()) into n, n2 from public.pk_fin_expenses where status = 'belum';
    out := out || jsonb_build_array(jsonb_build_object('k', 'buku', 'name', 'Buku Keuangan', 'href', '/buku/', 'ic', 'grid',
      'n', case when r = 'kepala_staf' then 0 else n2 end,
      'note', case when n = 0 then 'Catat biaya, kas & bank, buku besar' else n || ' biaya belum dibayar' || case when n2 > 0 then ' · ' || n2 || ' lewat jatuh tempo' else '' end end,
      'urgent', n2 > 0));
  end if;
  if public.af_can_view() then$q$;
  d := replace(d, E'  if public.af_can_view() then', ins);
  execute d;
end $$;
