-- pk_052 · Google Search Console untuk Analitik SEO (Marketing Pokama) · 11 Nov 2026
-- Sudah diterapkan ke Supabase shrvzlltysnbmgpkhjjg (migrasi mk_gsc_sync). Fungsi: supabase/functions/gsc-sync (cron mk-gsc-sync 06.10 WIB, 7 hari terakhir).
-- Properti: https://rentalaja.co.id/ (URL prefix; domain property sc-domain:rentalaja.co.id tidak bisa diakses akun Ghozy).
-- Akses: service account pokama-ga4@popoproject.iam.gserviceaccount.com = Restricted di Search Console; Search Console API aktif di proyek popoproject.
-- Data mulai 8 Nov 2026. Search Console baru final 2-3 hari; fungsi menarik dataState "all" (termasuk data awal).
create table if not exists public.mk_gsc_totals (
  day date primary key, clicks int not null default 0, impressions int not null default 0, position numeric, synced_at timestamptz not null default now());
create table if not exists public.mk_gsc_rows (
  day date not null, query text not null, page text not null, clicks int not null default 0, impressions int not null default 0,
  position numeric, synced_at timestamptz not null default now(), primary key (day, query, page));
create table if not exists public.mk_gsc_sync_log (
  id bigserial primary key, at timestamptz not null default now(), ok boolean not null, date_from date, date_to date, rows_in int, error text);
alter table public.mk_gsc_totals enable row level security;
alter table public.mk_gsc_rows enable row level security;
alter table public.mk_gsc_sync_log enable row level security;
revoke all on public.mk_gsc_totals, public.mk_gsc_rows, public.mk_gsc_sync_log from anon, authenticated;
insert into public.pk_settings(key, value, note, updated_at) values
  ('gsc_site_url', '"https://rentalaja.co.id/"'::jsonb, 'Properti Search Console (URL prefix).', now()),
  ('gsc_keywords', '["sewa motor garut","rental motor garut","sewa iphone garut","rental iphone garut","sewa kamera garut","sewa motor bandung","rental iphone bandung","penginapan garut"]'::jsonb, 'Kata kunci utama yang dipantau (patokan posisi <= 5).', now())
on conflict (key) do nothing;
-- RPC public.mk_seo_gsc(p_from, p_to): totals, prev, daily, queries (30), targets, pages (15). Lihat migrasi mk_gsc_sync di Supabase.
select cron.schedule('mk-gsc-sync', '10 23 * * *',
  $c$select net.http_post(url := 'https://shrvzlltysnbmgpkhjjg.supabase.co/functions/v1/gsc-sync', headers := '{"Content-Type":"application/json"}'::jsonb, body := '{"days":7}'::jsonb, timeout_milliseconds := 60000)$c$);
