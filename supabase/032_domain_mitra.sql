-- 032: portal mitra pindah ke mitra.pokama.org, panel affiliate ke app.pokama.org/affiliate.
-- Ganti teks alamat di pesan notifikasi mitra (fungsi af_*), tanpa mengubah logika lain.
do $$
declare f record; d text;
begin
  for f in
    select p.oid, pg_get_functiondef(p.oid) def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'af\_%' and pg_get_functiondef(p.oid) like '%pokama.org/mitra%'
  loop
    d := replace(f.def, 'pokama.org/mitra/admin', 'app.pokama.org/affiliate');
    d := replace(d, 'pokama.org/mitra', 'mitra.pokama.org');
    execute d;
  end loop;
end $$;
