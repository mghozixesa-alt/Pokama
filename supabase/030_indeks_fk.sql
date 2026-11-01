-- 030: indeks untuk setiap foreign key di tabel af_* / pk_* yang belum punya indeks (saran Supabase performance advisor)
do $i$ declare r record; n int := 0; begin
  for r in
    select c.conrelid::regclass tbl, c.conname, cl.relname, array_agg(a.attname order by k.ord) cols
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid join pg_namespace ns on ns.oid = cl.relnamespace
    cross join lateral unnest(c.conkey) with ordinality k(attnum, ord)
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f' and ns.nspname = 'public' and (cl.relname like 'af\_%' or cl.relname like 'pk\_%')
      and not exists (select 1 from pg_index i where i.indrelid = c.conrelid
                      and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey)
    group by c.conrelid, c.conname, cl.relname
  loop
    execute format('create index if not exists %I on %s (%s)', left('ix_' || r.conname, 63), r.tbl,
      (select string_agg(quote_ident(x), ', ') from unnest(r.cols) x));
    n := n + 1;
  end loop;
  raise notice 'indeks dibuat: %', n;
end $i$;
