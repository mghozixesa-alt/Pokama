-- Modul Marketing Pokama · tabel mk_* (24 tabel baru)
-- STATUS: BELUM diterapkan ke database (ditunda, 28 Okt 2026).
-- Hanya MENAMBAH tabel. Tidak ada tabel pk_* (KKH) maupun tabel web app Rentalaja yang diubah.
-- Catatan: 5 kolom WA di dokumen arsitektur (source_code, account_id, unit_code, outcome, lost_reason)
-- disimpan di tabel pendamping mk_wa_conv_meta, supaya tabel wa_conversations milik web app tidak disentuh.
-- Batalkan: supabase/019_mk_marketing_down.sql

-- ===== aturan bersama =====
create or replace function public.mk_phone_ok(p text) returns boolean
language sql immutable as $$ select p is null or p ~ '^62[0-9]{8,13}$' $$;

create or replace function public.mk_can_write() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.pk_is_admin() or public.pk_role() in ('keuangan','leader')
    or exists (select 1 from public.pk_people p where p.id = public.pk_me() and p.unit_code = 'MKT'), false)
$$;

-- kanal = bagian pertama kode sumber
create or replace function public.mk_channel_ok(c text) returns boolean
language sql immutable as $$ select c in ('ADS','IG','TT','KOL','WEB','MAPS','WAS','BC','REF','OFF','OTA') $$;

-- ===== master =====
create table if not exists public.mk_accounts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('ig','tiktok','meta_ads','gbp','wa','web','ga4')),
  unit_code text not null references public.pk_units(code),
  branch_id uuid references public.branches(id),
  name text not null,
  handle text,
  external_id text,
  is_active boolean not null default true,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (kind, external_id)
);

create table if not exists public.mk_campaigns (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  unit_code text not null references public.pk_units(code),
  channel text not null check (public.mk_channel_ok(channel)),
  objective text,
  starts_on date,
  ends_on date,
  budget bigint not null default 0,
  rab_id uuid references public.pk_rab(id) on delete set null,
  external_id text,
  status text not null default 'aktif' check (status in ('rencana','aktif','jeda','selesai')),
  created_by uuid references public.pk_people(id),
  created_at timestamptz not null default now()
);

create table if not exists public.mk_source_codes (
  code text primary key check (code ~ '^[A-Z]+(-[A-Z0-9]+)+$' and length(code) <= 24),
  channel text not null check (public.mk_channel_ok(channel)),
  unit_code text not null references public.pk_units(code),
  campaign_id uuid references public.mk_campaigns(id) on delete set null,
  label text,
  target_url text,
  is_active boolean not null default true,
  created_by uuid references public.pk_people(id),
  created_at timestamptz not null default now(),
  check (split_part(code, '-', 1) = channel)
);

create table if not exists public.mk_kol (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  handle text,
  niche text,
  followers integer,
  er numeric(5,2),
  contact_phone text check (public.mk_phone_ok(contact_phone)),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.mk_competitors (
  id uuid primary key default gen_random_uuid(),
  unit_code text not null references public.pk_units(code),
  name text not null,
  ig_handle text,
  place_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ===== kejadian =====
create table if not exists public.mk_link_clicks (
  id bigint generated always as identity primary key,
  source_code text not null references public.mk_source_codes(code),
  unit_code text not null references public.pk_units(code),
  clicked_at timestamptz not null default now(),
  device text,
  referrer text,
  ip_hash text
);
create index if not exists mk_link_clicks_code_time on public.mk_link_clicks (source_code, clicked_at);

create table if not exists public.mk_wa_conv_meta (
  conversation_id uuid primary key references public.wa_conversations(id) on delete cascade,
  source_code text references public.mk_source_codes(code),
  account_id uuid references public.mk_accounts(id),
  unit_code text references public.pk_units(code),
  outcome text check (outcome in ('baru','penawaran','dp','closing','batal')),
  lost_reason text check (lost_reason in ('harga','unit_habis','jadwal','lokasi','hanya_tanya','pilih_pesaing','tidak_balas','lainnya')),
  updated_by uuid references public.pk_people(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.mk_sales (
  id uuid primary key default gen_random_uuid(),
  unit_code text not null references public.pk_units(code),
  source_code text references public.mk_source_codes(code),
  sold_on date not null default current_date,
  customer_phone text check (public.mk_phone_ok(customer_phone)),
  amount bigint not null check (amount >= 0),
  note text,
  proof_url text,
  created_by uuid references public.pk_people(id),
  created_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by uuid references public.pk_people(id)
);

create table if not exists public.mk_content (
  id uuid primary key default gen_random_uuid(),
  unit_code text not null references public.pk_units(code),
  account_id uuid references public.mk_accounts(id),
  campaign_id uuid references public.mk_campaigns(id) on delete set null,
  title text not null,
  format text not null check (format in ('Reels','Carousel','Foto','Story','TikTok','Video')),
  pillar text check (pillar in ('Promo','Produk','Testimoni','Edukasi','Di balik layar')),
  stage text not null default 'Ide' check (stage in ('Ide','Brief','Produksi','Review','Revisi','Terjadwal','Tayang','Batal')),
  pic_id uuid references public.pk_people(id),
  reviewer_id uuid references public.pk_people(id),
  plan_date date,
  due_date date,
  published_at timestamptz,
  post_url text,
  ig_media_id text,
  draft_url text,
  task_id uuid references public.pk_tasks(id) on delete set null,
  created_by uuid references public.pk_people(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mk_content_plan on public.mk_content (plan_date);

create table if not exists public.mk_content_reviews (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.mk_content(id) on delete cascade,
  reviewer_id uuid references public.pk_people(id),
  verdict text not null check (verdict in ('setuju','revisi')),
  note text,
  revise_due date,
  task_id uuid references public.pk_tasks(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.mk_kol_deals (
  id uuid primary key default gen_random_uuid(),
  kol_id uuid not null references public.mk_kol(id),
  campaign_id uuid references public.mk_campaigns(id) on delete set null,
  unit_code text not null references public.pk_units(code),
  source_code text references public.mk_source_codes(code),
  deal text,
  cost bigint not null default 0,
  is_barter boolean not null default false,
  due_date date,
  published_at timestamptz,
  post_url text,
  ig_media_id text,
  status text not null default 'Shortlist' check (status in ('Shortlist','Negosiasi','Brief dikirim','Produksi','Tayang','Laporan hasil','Batal')),
  insight jsonb,
  rab_id uuid references public.pk_rab(id) on delete set null,
  task_id uuid references public.pk_tasks(id) on delete set null,
  created_by uuid references public.pk_people(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== metrik harian (API atau manual, tabel sama) =====
create table if not exists public.mk_ig_media (
  id text primary key,
  account_id uuid not null references public.mk_accounts(id),
  media_type text,
  product_type text,
  caption text,
  permalink text,
  media_url text,
  thumbnail_url text,
  posted_at timestamptz,
  fetched_at timestamptz not null default now()
);

create table if not exists public.mk_ig_media_daily (
  media_id text not null references public.mk_ig_media(id) on delete cascade,
  day date not null,
  reach integer, views integer, likes integer, comments integer, saves integer, shares integer,
  profile_visits integer, follows integer, avg_watch_ms integer,
  origin text not null default 'api' check (origin in ('api','manual','csv')),
  primary key (media_id, day)
);

create table if not exists public.mk_ig_account_daily (
  account_id uuid not null references public.mk_accounts(id),
  day date not null,
  followers integer, follows integer, unfollows integer, reach integer, views integer, profile_taps integer,
  online_hours jsonb,
  origin text not null default 'api' check (origin in ('api','manual','csv')),
  primary key (account_id, day)
);

create table if not exists public.mk_ads_daily (
  account_id uuid not null references public.mk_accounts(id),
  day date not null,
  ad_ext text not null,
  breakdown text not null default 'all',
  campaign_ext text, adset_ext text, ad_name text,
  campaign_id uuid references public.mk_campaigns(id) on delete set null,
  spend numeric(14,2) not null default 0,
  reach integer, impressions integer, clicks integer, chats_started integer,
  origin text not null default 'api' check (origin in ('api','manual','csv')),
  primary key (account_id, day, ad_ext, breakdown)
);

create table if not exists public.mk_gbp_daily (
  account_id uuid not null references public.mk_accounts(id),
  day date not null,
  views_search integer, views_maps integer, directions integer, calls integer, web_clicks integer, wa_clicks integer,
  origin text not null default 'api' check (origin in ('api','manual','csv')),
  primary key (account_id, day)
);

create table if not exists public.mk_gbp_reviews (
  id text primary key,
  account_id uuid not null references public.mk_accounts(id),
  stars integer check (stars between 1 and 5),
  body text, reviewer text,
  reviewed_at timestamptz, replied_at timestamptz, reply text,
  origin text not null default 'api' check (origin in ('api','manual','csv')),
  fetched_at timestamptz not null default now()
);

create table if not exists public.mk_tiktok_daily (
  video_id text not null,
  day date not null,
  account_id uuid not null references public.mk_accounts(id),
  title text,
  views integer, likes integer, comments integer, shares integer,
  proof_url text,
  origin text not null default 'api' check (origin in ('api','manual','csv')),
  primary key (video_id, day)
);

create table if not exists public.mk_web_daily (
  account_id uuid not null references public.mk_accounts(id),
  day date not null,
  source text not null default '', medium text not null default '', campaign text not null default '',
  sessions integer, users integer, conversions integer,
  primary key (account_id, day, source, medium, campaign)
);

create table if not exists public.mk_competitor_daily (
  competitor_id uuid not null references public.mk_competitors(id) on delete cascade,
  day date not null,
  followers integer, posts integer, avg_likes integer, avg_comments integer,
  rating numeric(2,1), reviews integer,
  price_note text, proof_url text,
  origin text not null default 'api' check (origin in ('api','manual','csv')),
  primary key (competitor_id, day)
);

-- ===== input manual & kontrol =====
create table if not exists public.mk_wa_story_daily (
  account_id uuid not null references public.mk_accounts(id),
  day date not null,
  viewers integer not null check (viewers >= 0),
  stories integer,
  proof_url text,
  reported_by uuid references public.pk_people(id),
  reported_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by uuid references public.pk_people(id),
  primary key (account_id, day)
);

create table if not exists public.mk_targets (
  month date not null check (extract(day from month) = 1),
  unit_code text not null references public.pk_units(code),
  channel text not null,
  metric text not null,
  target numeric not null,
  approved_by uuid references public.pk_people(id),
  approved_at timestamptz,
  primary key (month, unit_code, channel, metric)
);

create table if not exists public.mk_sync_runs (
  id bigint generated always as identity primary key,
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_written integer,
  status text check (status in ('ok','error','partial')),
  error text
);

create table if not exists public.mk_corrections (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_key text not null,
  field text not null,
  old_value text,
  new_value text,
  reason text not null,
  corrected_by uuid references public.pk_people(id),
  corrected_at timestamptz not null default now()
);

-- ===== akses (RLS) =====
-- baca: semua orang yang terdaftar aktif di pk_people
-- tulis: tim marketing (unit MKT), leader, keuangan, kepala staf, CEO
-- target: hanya CEO, kepala staf, keuangan · catatan sinkron & klik: hanya sistem (service role)
do $$
declare t text;
begin
  foreach t in array array['mk_accounts','mk_campaigns','mk_source_codes','mk_kol','mk_competitors','mk_link_clicks','mk_wa_conv_meta',
    'mk_sales','mk_content','mk_content_reviews','mk_kol_deals','mk_ig_media','mk_ig_media_daily','mk_ig_account_daily','mk_ads_daily',
    'mk_gbp_daily','mk_gbp_reviews','mk_tiktok_daily','mk_web_daily','mk_competitor_daily','mk_wa_story_daily','mk_targets','mk_sync_runs','mk_corrections'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists mk_read on public.%I', t);
    execute format('create policy mk_read on public.%I for select to authenticated using (public.pk_me() is not null)', t);
    if t not in ('mk_link_clicks','mk_sync_runs','mk_targets','mk_corrections') then
      execute format('grant insert, update, delete on public.%I to authenticated', t);
      execute format('drop policy if exists mk_write on public.%I', t);
      execute format('create policy mk_write on public.%I for all to authenticated using (public.mk_can_write()) with check (public.mk_can_write())', t);
    end if;
  end loop;
end $$;

grant insert, update, delete on public.mk_targets to authenticated;
drop policy if exists mk_write on public.mk_targets;
create policy mk_write on public.mk_targets for all to authenticated
  using (public.pk_is_admin() or public.pk_is_fin()) with check (public.pk_is_admin() or public.pk_is_fin());

grant insert on public.mk_corrections to authenticated;
drop policy if exists mk_write on public.mk_corrections;
create policy mk_write on public.mk_corrections for insert to authenticated
  with check (public.mk_can_write() and corrected_by = public.pk_me());
