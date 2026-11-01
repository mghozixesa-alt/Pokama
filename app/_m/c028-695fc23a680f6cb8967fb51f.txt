-- 028: cadangan harian sementara (sampai Supabase Pro aktif) — salinan semua tabel public ke skema c_YYYYMMDD (daftar di cadangan.log),
-- disimpan 7 hari. Melindungi dari salah hapus / salah ubah data. BUKAN pengganti cadangan di luar Supabase.
-- Tabel arsip legacy_* (data lama, tidak berubah) disalin sekali saja ke skema c_legacy.
create schema if not exists cadangan;
revoke all on schema cadangan from public, anon, authenticated;

create table if not exists cadangan.log (
  day date primary key, schema_name text not null, tables int not null, bytes bigint, at timestamptz not null default now()
);
revoke all on cadangan.log from public, anon, authenticated;

create or replace function cadangan.harian() returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare d date := (now() at time zone 'Asia/Jakarta')::date; s text := 'c_' || to_char((now() at time zone 'Asia/Jakarta')::date, 'YYYYMMDD');
  t record; n int := 0; old record; sz bigint;
begin
  execute format('drop schema if exists %I cascade', s);
  execute format('create schema %I', s);
  execute format('revoke all on schema %I from public, anon, authenticated', s);
  for t in select tablename from pg_tables where schemaname = 'public' and tablename not like 'legacy\_%' order by 1 loop
    execute format('create table %I.%I as table public.%I', s, t.tablename, t.tablename);
    n := n + 1;
  end loop;
  if to_regnamespace('c_legacy') is null then
    create schema c_legacy; revoke all on schema c_legacy from public, anon, authenticated;
    for t in select tablename from pg_tables where schemaname = 'public' and tablename like 'legacy\_%' loop
      execute format('create table c_legacy.%I as table public.%I', t.tablename, t.tablename);
    end loop;
  end if;
  select coalesce(sum(pg_total_relation_size(c.oid)), 0) into sz from pg_class c join pg_namespace ns on ns.oid = c.relnamespace where ns.nspname = s;
  insert into cadangan.log(day, schema_name, tables, bytes) values (d, s, n, sz)
  on conflict (day) do update set schema_name = excluded.schema_name, tables = excluded.tables, bytes = excluded.bytes, at = now();
  for old in select day, schema_name from cadangan.log where day < d - 6 loop
    execute format('drop schema if exists %I cascade', old.schema_name);
    delete from cadangan.log where day = old.day;
  end loop;
  return jsonb_build_object('schema', s, 'tables', n, 'bytes', sz);
end $$;
revoke execute on function cadangan.harian() from public, anon, authenticated;

-- 01.05 WIB setiap hari
select cron.unschedule('pk-cadangan-harian') where exists (select 1 from cron.job where jobname = 'pk-cadangan-harian');
select cron.schedule('pk-cadangan-harian', '5 18 * * *', 'select cadangan.harian()');
