-- pk_050 · Google Analytics 4 untuk Analitik SEO (Marketing Pokama) · 10 Nov 2026
-- Sudah diterapkan ke proyek Supabase shrvzlltysnbmgpkhjjg (migrasi mk_ga4_sync).
-- Data ditarik fungsi supabase/functions/ga4-sync tiap 06.00 WIB (cron mk-ga4-sync).
-- Butuh: pk_settings.ga4_property_id diisi ID properti GA4, dan secret GA4_SERVICE_ACCOUNT (JSON akun layanan Google
-- yang sudah ditambahkan sebagai Viewer di properti GA4).

create table if not exists public.mk_ga4_daily (
  day date not null, channel text not null default '', source text not null default '', medium text not null default '',
  sessions int not null default 0, users int not null default 0, new_users int not null default 0,
  engaged int not null default 0, views int not null default 0, synced_at timestamptz not null default now(),
  primary key (day, channel, source, medium));
create table if not exists public.mk_ga4_pages (
  day date not null, page text not null, sessions int not null default 0, views int not null default 0, users int not null default 0,
  synced_at timestamptz not null default now(), primary key (day, page));
create table if not exists public.mk_ga4_events (
  day date not null, event_name text not null, cnt int not null default 0, synced_at timestamptz not null default now(),
  primary key (day, event_name));
create table if not exists public.mk_ga4_sync_log (
  id bigserial primary key, at timestamptz not null default now(), ok boolean not null, date_from date, date_to date,
  rows_in int, error text);
alter table public.mk_ga4_daily enable row level security;
alter table public.mk_ga4_pages enable row level security;
alter table public.mk_ga4_events enable row level security;
alter table public.mk_ga4_sync_log enable row level security;
revoke all on public.mk_ga4_daily, public.mk_ga4_pages, public.mk_ga4_events, public.mk_ga4_sync_log from anon, authenticated;

insert into public.pk_settings(key, value, note, updated_at) values
  ('ga4_property_id', '""'::jsonb, 'ID properti GA4 rentalaja.co.id (angka, mis. 412345678). Kosong = sinkron belum jalan.', now()),
  ('ga4_wa_events', '["click_wa","whatsapp_click","klik_wa","wa_click","contact"]'::jsonb, 'Nama event GA4 yang dihitung sebagai klik WA.', now())
on conflict (key) do nothing;

create or replace function public.mk_seo_ga4(p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare d0 date := coalesce(p_from, (now() at time zone 'Asia/Jakarta')::date - 28);
        d1 date := coalesce(p_to, (now() at time zone 'Asia/Jakarta')::date - 1);
        n int := d1 - d0 + 1; wa text[];
begin
  if not (app.has_perm('mgmt.marketing') or app.has_perm('mgmt.reports') or public.pk_me() is not null) then
    raise exception 'Tidak berwenang';
  end if;
  select array(select jsonb_array_elements_text(value)) into wa from public.pk_settings where key = 'ga4_wa_events';
  return jsonb_build_object(
    'from', d0, 'to', d1,
    'connected', coalesce((select value #>> '{}' from pk_settings where key = 'ga4_property_id'), '') <> '',
    'last_sync', (select jsonb_build_object('at', at, 'ok', ok, 'error', error, 'to', date_to) from mk_ga4_sync_log order by at desc limit 1),
    'totals', (select jsonb_build_object('sessions', coalesce(sum(sessions),0), 'users', coalesce(sum(users),0), 'new_users', coalesce(sum(new_users),0),
                 'engaged', coalesce(sum(engaged),0), 'views', coalesce(sum(views),0),
                 'organic', coalesce(sum(sessions) filter (where channel = 'Organic Search'),0))
               from mk_ga4_daily where day between d0 and d1),
    'prev', (select jsonb_build_object('sessions', coalesce(sum(sessions),0), 'organic', coalesce(sum(sessions) filter (where channel = 'Organic Search'),0))
               from mk_ga4_daily where day between d0 - n and d0 - 1),
    'wa_clicks', (select coalesce(sum(cnt),0) from mk_ga4_events where day between d0 and d1 and event_name = any(wa)),
    'channels', (select coalesce(jsonb_agg(x order by (x->>'sessions')::int desc), '[]') from (
        select jsonb_build_object('channel', channel, 'sessions', sum(sessions), 'users', sum(users), 'new_users', sum(new_users), 'engaged', sum(engaged)) x
        from mk_ga4_daily where day between d0 and d1 group by channel) z),
    'sources', (select coalesce(jsonb_agg(x order by (x->>'sessions')::int desc), '[]') from (
        select jsonb_build_object('source', source, 'medium', medium, 'sessions', sum(sessions), 'new_users', sum(new_users)) x
        from mk_ga4_daily where day between d0 and d1 group by source, medium order by sum(sessions) desc limit 15) z),
    'pages', (select coalesce(jsonb_agg(x order by (x->>'sessions')::int desc), '[]') from (
        select jsonb_build_object('page', page, 'sessions', sum(sessions), 'views', sum(views), 'users', sum(users)) x
        from mk_ga4_pages where day between d0 and d1 group by page order by sum(sessions) desc limit 20) z),
    'events', (select coalesce(jsonb_agg(x order by (x->>'cnt')::int desc), '[]') from (
        select jsonb_build_object('event', event_name, 'cnt', sum(cnt), 'is_wa', event_name = any(wa)) x
        from mk_ga4_events where day between d0 and d1 group by event_name order by sum(cnt) desc limit 20) z),
    'daily', (select coalesce(jsonb_agg(x order by x->>'day'), '[]') from (
        select jsonb_build_object('day', g::date,
          'sessions', coalesce((select sum(sessions) from mk_ga4_daily where day = g::date), 0),
          'organic', coalesce((select sum(sessions) from mk_ga4_daily where day = g::date and channel = 'Organic Search'), 0),
          'wa', coalesce((select sum(cnt) from mk_ga4_events where day = g::date and event_name = any(wa)), 0)) x
        from generate_series(d0, d1, interval '1 day') g) z));
end $$;
revoke all on function public.mk_seo_ga4(date, date) from public, anon;
grant execute on function public.mk_seo_ga4(date, date) to authenticated;

select cron.schedule('mk-ga4-sync', '0 23 * * *',
  $c$select net.http_post(url := 'https://shrvzlltysnbmgpkhjjg.supabase.co/functions/v1/ga4-sync', headers := '{"Content-Type":"application/json"}'::jsonb, body := '{"days":3}'::jsonb, timeout_milliseconds := 60000)$c$);

-- 11 Nov 2026: total harian diambil langsung dari GA4 (tanpa dimensi kanal). Satu sesi bisa tercatat di lebih dari satu kanal,
-- jadi menjumlah baris kanal melebihkan total (contoh 28 hari: 325 vs 244 di GA4).
create table if not exists public.mk_ga4_totals (
  day date primary key, sessions int not null default 0, users int not null default 0, new_users int not null default 0,
  engaged int not null default 0, views int not null default 0, synced_at timestamptz not null default now());
alter table public.mk_ga4_totals enable row level security;
revoke all on public.mk_ga4_totals from anon, authenticated;
-- mk_seo_ga4 versi terbaru (totals/prev/daily dari mk_ga4_totals) diterapkan lewat migrasi mk_ga4_totals di Supabase.
-- Properti GA4 Rentalaja: 563319806 · event klik WA: klik_whatsapp · service account pokama-ga4@popoproject.iam.gserviceaccount.com (Viewer).
