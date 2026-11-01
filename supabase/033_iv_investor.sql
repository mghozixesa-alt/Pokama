-- 033 · Portal Investor Pokama (investor.pokama.org + app.pokama.org/investor)
-- Satu tempat untuk semua investor semua unit bisnis. Tiga jenis investasi:
--   aset   : unit sewa Rentalaja (motor/iPhone/kamera). Hasil dihitung otomatis per unit dari transaksi
--            memakai mesin bagi hasil Rentalaja (app.partner_calc) lewat perjanjian cermin di partner_agreements.
--   proyek : modal kerja / proyek unit mana pun (mis. stok Laptopaja, TripinAja). Imbal tetap per bulan
--            (otomatis) atau bagi laba (Keuangan mengisi laba per bulan).
--   saham  : kepemilikan persen di unit/PT. Dividen diisi Keuangan saat dibagikan.
-- Peran: CEO semua + menyetujui; Kepala Staf lihat saja; BizDev kelola investor/investasi/peluang;
--        Keuangan KYC, rekening, bagi hasil, tandai transfer. Pengaju tidak bisa menyetujui miliknya sendiri.
-- Investor: masuk dengan Google, hanya melihat datanya sendiri. Rekening hanya diganti oleh Keuangan.

begin;

-- ================= tabel =================
create table if not exists public.iv_investors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  email text not null,
  name text not null,
  wa text,
  kind text not null default 'perorangan' check (kind in ('perorangan','badan_usaha')),
  city text,
  status text not null default 'aktif' check (status in ('aktif','nonaktif')),
  kyc_status text not null default 'menunggu' check (kyc_status in ('menunggu','terverifikasi','ditolak')),
  kyc_note text,
  nik_enc bytea, nik_last4 text,
  npwp_enc bytea, npwp_last4 text,
  bank_name text, bank_holder text, bank_acct_enc bytea, bank_last4 text,
  rp_partner_id uuid references public.partners(id),
  note text,
  demo boolean not null default false,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists iv_investors_email on public.iv_investors (lower(email)) where status = 'aktif';

create table if not exists public.iv_holdings (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.iv_investors(id) on delete restrict,
  unit_code text not null check (unit_code in ('RA','WG','NA','PK')),
  jenis text not null check (jenis in ('aset','proyek','saham')),
  title text not null,
  principal numeric(16,2) not null default 0 check (principal >= 0),
  started_on date not null default (now() at time zone 'Asia/Jakarta')::date,
  ends_on date,
  -- proyek
  return_model text check (return_model in ('imbal_tetap','bagi_laba')),
  rate_pct numeric(7,3),              -- imbal tetap: % per bulan dari modal; bagi laba/saham/aset: porsi %
  principal_back text check (principal_back in ('akhir','cicil','tidak')),
  -- aset (Rentalaja)
  rp_scheme text check (rp_scheme in ('per_unit','vendor','flat','location')),
  rp_basis text check (rp_basis in ('gross','net')),
  rp_ops_pct numeric(6,2),
  rp_flat numeric(14,2),
  rp_unit_ids uuid[] not null default '{}',
  rp_branch_ids uuid[] not null default '{}',
  rp_product_ids uuid[] not null default '{}',
  rp_agreement_id uuid references public.partner_agreements(id),
  pay_day int check (pay_day between 1 and 28),
  doc_path text,
  status text not null default 'draf' check (status in ('draf','menunggu','aktif','selesai','ditolak')),
  reject_reason text,
  note text,
  demo boolean not null default false,
  created_by uuid, created_at timestamptz not null default now(),
  submitted_by uuid, submitted_at timestamptz,
  approved_by uuid, approved_at timestamptz,
  ended_by uuid, ended_at timestamptz,
  constraint iv_h_aset check (jenis <> 'aset' or (unit_code = 'RA' and rp_scheme is not null)),
  constraint iv_h_proyek check (jenis <> 'proyek' or (return_model is not null and rate_pct is not null and principal > 0)),
  constraint iv_h_saham check (jenis <> 'saham' or rate_pct is not null)
);
create index if not exists iv_holdings_inv on public.iv_holdings (investor_id);

create table if not exists public.iv_statements (
  id uuid primary key default gen_random_uuid(),
  holding_id uuid not null references public.iv_holdings(id) on delete restrict,
  investor_id uuid not null references public.iv_investors(id) on delete restrict,
  period date not null,                               -- tanggal 1 bulan itu
  kind text not null default 'hasil' check (kind in ('hasil','dividen','modal')),
  revenue numeric(16,2) not null default 0,
  costs numeric(16,2) not null default 0,
  base numeric(16,2) not null default 0,             -- dasar hitung (laba/pendapatan/modal)
  share numeric(16,2) not null default 0,            -- bagian investor
  detail jsonb,
  source text not null default 'otomatis' check (source in ('otomatis','input')),
  status text not null default 'draf' check (status in ('draf','diajukan','terkunci')),
  note text,
  computed_by uuid, computed_at timestamptz not null default now(),
  submitted_by uuid, submitted_at timestamptz,
  locked_by uuid, locked_at timestamptz,
  unique (holding_id, period, kind)
);
create index if not exists iv_statements_inv on public.iv_statements (investor_id, period);

create table if not exists public.iv_withdrawals (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.iv_investors(id) on delete restrict,
  amount numeric(16,2) not null check (amount > 0),
  status text not null default 'diminta' check (status in ('diminta','disetujui','dibayar','ditolak','gagal')),
  bank_snapshot text not null,
  requested_at timestamptz not null default now(),
  decided_by uuid, decided_at timestamptz, reason text,
  paid_by uuid, paid_at timestamptz, ref text
);
create index if not exists iv_withdrawals_inv on public.iv_withdrawals (investor_id, requested_at desc);

create table if not exists public.iv_offers (
  id uuid primary key default gen_random_uuid(),
  unit_code text not null check (unit_code in ('RA','WG','NA','PK')),
  jenis text not null check (jenis in ('aset','proyek','saham')),
  title text not null,
  summary text,
  target_amount numeric(16,2),
  min_amount numeric(16,2),
  est_return text,
  tenor_months int,
  status text not null default 'dibuka' check (status in ('dibuka','ditutup')),
  sort int not null default 0,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.iv_leads (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid references public.iv_investors(id),
  offer_id uuid references public.iv_offers(id),
  name text not null,
  wa text,
  wa_hash text,
  unit_code text,
  amount_hint numeric(16,2),
  note text,
  source text not null default 'publik' check (source in ('publik','investor','staf')),
  status text not null default 'baru' check (status in ('baru','dihubungi','jadi_investor','batal')),
  handled_by uuid, updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists iv_leads_status on public.iv_leads (status, created_at desc);

alter table public.iv_investors enable row level security;
alter table public.iv_holdings enable row level security;
alter table public.iv_statements enable row level security;
alter table public.iv_withdrawals enable row level security;
alter table public.iv_offers enable row level security;
alter table public.iv_leads enable row level security;
-- Tidak ada policy: semua akses lewat fungsi di bawah (security definer). Akses tabel langsung ditolak.
revoke all on public.iv_investors, public.iv_holdings, public.iv_statements, public.iv_withdrawals, public.iv_offers, public.iv_leads from anon, authenticated;

-- ================= peran =================
create or replace function public.iv_is_owner() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.pk_role() = 'ceo', false) $$;
create or replace function public.iv_is_biz() returns boolean language sql stable security definer set search_path = public as $$
  select public.af_is_biz() $$;
create or replace function public.iv_is_fin() returns boolean language sql stable security definer set search_path = public as $$
  select public.af_is_fin() $$;
create or replace function public.iv_can_view() returns boolean language sql stable security definer set search_path = public as $$
  select public.iv_is_biz() or public.iv_is_fin() or coalesce(public.pk_role() = 'kepala_staf', false) $$;
create or replace function public.iv_need(p text) returns void language plpgsql stable security definer set search_path = public as $$
begin
  if p = 'view' and not public.iv_can_view() then raise exception 'Tidak punya akses'; end if;
  if p = 'biz' and not (public.iv_is_biz() or public.iv_is_fin()) then raise exception 'Hanya BizDev, Keuangan, atau CEO'; end if;
  if p = 'fin' and not public.iv_is_fin() then raise exception 'Hanya Keuangan atau CEO'; end if;
  if p = 'owner' and not public.iv_is_owner() then raise exception 'Hanya CEO'; end if;
end $$;
create or replace function public.iv_log(p_action text, p_target text, p_reason text default null, p_data jsonb default null) returns void
language sql security definer set search_path = public as $$
  insert into public.af_audit(by_person, action, target, reason, data) values (public.pk_me(), 'iv_' || p_action, p_target, p_reason, p_data) $$;
create or replace function public.iv_my_id() returns uuid language sql stable security definer set search_path = public as $$
  select id from public.iv_investors where user_id = auth.uid() and status = 'aktif' and auth.uid() is not null limit 1 $$;
create or replace function public.iv_month(d date default null) returns date language sql stable as $$
  select date_trunc('month', coalesce(d::timestamp, (now() at time zone 'Asia/Jakarta')))::date $$;
create or replace function public.iv_unit_name(c text) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select name from public.af_units where code = c), case c when 'PK' then 'Pokama (holding)' else c end) $$;

-- ================= perhitungan =================
-- Hasil satu investasi untuk rentang waktu [f, t). Mengembalikan revenue/costs/base/share + rincian.
create or replace function public.iv_calc(p_h uuid, f timestamptz, t timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare h public.iv_holdings; c jsonb; m0 date; days numeric; covered numeric; s0 timestamptz; s1 timestamptz;
begin
  select * into h from public.iv_holdings where id = p_h;
  if not found then return null; end if;
  if h.jenis = 'aset' then
    if h.rp_agreement_id is null then return jsonb_build_object('revenue',0,'costs',0,'base',0,'share',0,'units','[]'::jsonb); end if;
    c := app.partner_calc(h.rp_agreement_id, f, t);
    return jsonb_build_object('revenue', (c->>'revenue')::numeric, 'costs', (c->>'service')::numeric + (c->>'ops')::numeric,
      'service', (c->>'service')::numeric, 'ops', (c->>'ops')::numeric, 'net', (c->>'net')::numeric,
      'base', (c->>'base')::numeric, 'share', (c->>'share')::numeric, 'bookings', (c->>'bookings')::int, 'units', c->'units', 'auto', true);
  elsif h.jenis = 'proyek' and h.return_model = 'imbal_tetap' then
    -- imbal tetap dihitung harian: modal × % per bulan × (hari berjalan / hari dalam bulan)
    s0 := greatest(f, h.started_on::timestamp at time zone 'Asia/Jakarta');
    s1 := least(t, coalesce((h.ends_on + 1)::timestamp at time zone 'Asia/Jakarta', t));
    if s1 <= s0 then covered := 0; else covered := extract(epoch from (s1 - s0)) / 86400.0; end if;
    m0 := date_trunc('month', f at time zone 'Asia/Jakarta')::date;
    days := extract(day from (m0 + interval '1 month' - interval '1 day'));
    return jsonb_build_object('revenue',0,'costs',0,'base', h.principal,
      'share', round(h.principal * h.rate_pct / 100 * least(covered, days) / days), 'days', round(covered,2), 'auto', true);
  else
    return jsonb_build_object('revenue',0,'costs',0,'base',0,'share',0,'auto', false);
  end if;
end $$;

create or replace function public.iv_balance(p_inv uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'credited', coalesce((select sum(share) from public.iv_statements where investor_id = p_inv and status = 'terkunci'), 0),
    'out', coalesce((select sum(amount) from public.iv_withdrawals where investor_id = p_inv and status in ('diminta','disetujui','dibayar')), 0),
    'paid', coalesce((select sum(amount) from public.iv_withdrawals where investor_id = p_inv and status = 'dibayar'), 0),
    'in_process', coalesce((select sum(amount) from public.iv_withdrawals where investor_id = p_inv and status in ('diminta','disetujui')), 0),
    'withdrawable', greatest(0,
        coalesce((select sum(share) from public.iv_statements where investor_id = p_inv and status = 'terkunci'), 0)
      - coalesce((select sum(amount) from public.iv_withdrawals where investor_id = p_inv and status in ('diminta','disetujui','dibayar')), 0)))
$$;

create or replace function public.iv_holding_json(h public.iv_holdings) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', h.id, 'unit_code', h.unit_code, 'unit', public.iv_unit_name(h.unit_code), 'jenis', h.jenis, 'title', h.title,
    'principal', h.principal, 'started_on', h.started_on, 'ends_on', h.ends_on, 'return_model', h.return_model, 'rate_pct', h.rate_pct,
    'principal_back', h.principal_back, 'rp_scheme', h.rp_scheme, 'rp_basis', h.rp_basis, 'rp_ops_pct', h.rp_ops_pct, 'rp_flat', h.rp_flat,
    'unit_count', coalesce(cardinality(h.rp_unit_ids), 0), 'pay_day', h.pay_day, 'has_doc', h.doc_path is not null, 'status', h.status)
$$;

-- ================= portal investor =================
create or replace function public.iv_link_me() returns jsonb
language plpgsql security definer set search_path = public as $$
declare em text := lower(coalesce(auth.jwt()->>'email', '')); r public.iv_investors;
begin
  if auth.uid() is null then raise exception 'Belum masuk'; end if;
  if not public.af_google() then return jsonb_build_object('found', false, 'need_google', true); end if;
  select * into r from public.iv_investors where user_id = auth.uid() limit 1;
  if r.id is null then
    select * into r from public.iv_investors where lower(email) = em and user_id is null and status = 'aktif' order by created_at limit 1;
    if r.id is not null then
      update public.iv_investors set user_id = auth.uid(), updated_at = now() where id = r.id;
      insert into public.af_audit(by_person, action, target, reason) values (null, 'iv_tautan_akun', r.id::text, em);
    end if;
  end if;
  if r.id is null then
    return jsonb_build_object('found', false, 'email', em,
      'staff', exists (select 1 from public.pk_people x where x.is_active and lower(x.email) = em));
  end if;
  return jsonb_build_object('found', true, 'status', r.status, 'name', r.name);
end $$;

create or replace function public.iv_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.iv_my_id(); r public.iv_investors; h public.iv_holdings; m0 timestamptz; d0 timestamptz; d1 timestamptz;
  hs jsonb := '[]'; cm jsonb; td jsonb; yd jsonb; last jsonb; live numeric := 0; today numeric := 0; yday numeric := 0; cur date;
begin
  if me is null then raise exception 'Akun ini belum terdaftar sebagai investor'; end if;
  select * into r from public.iv_investors where id = me;
  cur := public.iv_month();
  m0 := cur::timestamp at time zone 'Asia/Jakarta';
  d0 := date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
  d1 := d0 - interval '1 day';
  for h in select * from public.iv_holdings where investor_id = me and status in ('aktif','selesai') order by status, started_on loop
    cm := case when h.status = 'aktif' then public.iv_calc(h.id, m0, now()) end;
    td := case when h.status = 'aktif' then public.iv_calc(h.id, d0, now()) end;
    yd := case when h.status = 'aktif' then public.iv_calc(h.id, d1, d0) end;
    select to_jsonb(x) into last from (select period, share, status, kind from public.iv_statements
      where holding_id = h.id and status = 'terkunci' order by period desc, kind limit 1) x;
    if h.status = 'aktif' and coalesce((cm->>'auto')::boolean, false)
       and not exists (select 1 from public.iv_statements where holding_id = h.id and period = cur and status = 'terkunci') then
      live := live + coalesce((cm->>'share')::numeric, 0);
    end if;
    today := today + coalesce((td->>'share')::numeric, 0);
    yday := yday + coalesce((yd->>'share')::numeric, 0);
    hs := hs || jsonb_build_object('h', public.iv_holding_json(h), 'month', cm, 'today', td, 'yesterday', yd, 'last', last,
      'total', (select coalesce(sum(share), 0) from public.iv_statements where holding_id = h.id and status = 'terkunci'));
  end loop;
  return jsonb_build_object(
    'me', jsonb_build_object('name', r.name, 'email', r.email, 'kind', r.kind, 'kyc_status', r.kyc_status,
       'bank', case when r.bank_name is null then null else r.bank_name || ' •••• ' || coalesce(r.bank_last4, '') end,
       'bank_holder', r.bank_holder, 'wa', case when r.wa is null then null else '+' || left(r.wa, 4) || '••••' || right(r.wa, 3) end,
       'nik', case when r.nik_last4 is null then null else '•••• ' || r.nik_last4 end, 'npwp', case when r.npwp_last4 is null then null else '•••• ' || r.npwp_last4 end,
       'demo', r.demo),
    'period', cur, 'now', now(), 'holdings', hs,
    'principal', (select coalesce(sum(principal), 0) from public.iv_holdings where investor_id = me and status = 'aktif'),
    'today', today, 'yesterday', yday, 'month_live', live,
    'year_total', (select coalesce(sum(share), 0) from public.iv_statements where investor_id = me and status = 'terkunci' and kind <> 'modal'
                    and period >= date_trunc('year', cur)::date),
    'all_total', (select coalesce(sum(share), 0) from public.iv_statements where investor_id = me and status = 'terkunci' and kind <> 'modal'),
    'balance', public.iv_balance(me),
    'withdrawals', (select coalesce(jsonb_agg(to_jsonb(w) order by w.requested_at desc), '[]') from
       (select id, amount, status, requested_at, paid_at, reason, bank_snapshot from public.iv_withdrawals where investor_id = me order by requested_at desc limit 20) w),
    'docs', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title)), '[]') from public.iv_holdings where investor_id = me and doc_path is not null and status in ('aktif','selesai')));
end $$;

create or replace function public.iv_holding_detail(p_h uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.iv_my_id(); h public.iv_holdings; m0 timestamptz; acts jsonb := '[]'; prev jsonb;
begin
  select * into h from public.iv_holdings where id = p_h;
  if not found or (h.investor_id is distinct from me and not public.iv_can_view()) then raise exception 'Investasi tidak ditemukan'; end if;
  m0 := public.iv_month()::timestamp at time zone 'Asia/Jakarta';
  if h.jenis = 'aset' and h.rp_agreement_id is not null then
    -- aktivitas terakhir unit (tanpa nama penyewa)
    select coalesce(jsonb_agg(x order by x->>'at' desc), '[]') into acts from (
      select jsonb_build_object('at', lower(bi.period), 'unit', p.name || ' ' || u.code, 'branch', br.name,
        'hours', round(extract(epoch from (upper(bi.period) - lower(bi.period))) / 3600)) x
      from public.booking_items bi join public.bookings b on b.id = bi.booking_id
      join public.units u on u.id = bi.unit_id join public.products p on p.id = u.product_id join public.branches br on br.id = u.branch_id
      where bi.unit_id = any(app.partner_scope_units(h.rp_agreement_id)) and bi.status <> 'released'
        and b.status in ('confirmed','active','returned','completed') and lower(bi.period) <= now()
      order by lower(bi.period) desc limit 12) s;
  end if;
  prev := public.iv_calc(h.id, (public.iv_month() - interval '1 month')::timestamp at time zone 'Asia/Jakarta', m0);
  return jsonb_build_object('h', public.iv_holding_json(h),
    'month', case when h.status = 'aktif' then public.iv_calc(h.id, m0, now()) end,
    'prev', prev,
    'd30', case when h.status = 'aktif' then public.iv_calc(h.id, now() - interval '30 days', now()) end,
    'activity', acts,
    'statements', (select coalesce(jsonb_agg(jsonb_build_object('period', period, 'kind', kind, 'base', base, 'revenue', revenue, 'costs', costs, 'share', share) order by period desc), '[]')
                   from public.iv_statements where holding_id = h.id and status = 'terkunci'),
    'total', (select coalesce(sum(share), 0) from public.iv_statements where holding_id = h.id and status = 'terkunci' and kind <> 'modal'));
end $$;

create or replace function public.iv_reports(p_year int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.iv_my_id();
begin
  if me is null then raise exception 'Akun ini belum terdaftar sebagai investor'; end if;
  return jsonb_build_object('year', p_year,
    'months', (select coalesce(jsonb_agg(m order by m->>'period' desc), '[]') from (
      select jsonb_build_object('period', s.period,
        'revenue', sum(s.revenue), 'costs', sum(s.costs), 'share', coalesce(sum(s.share) filter (where s.kind <> 'modal'), 0),
        'modal', coalesce(sum(s.share) filter (where s.kind = 'modal'), 0),
        'rows', jsonb_agg(jsonb_build_object('title', h.title, 'unit', public.iv_unit_name(h.unit_code), 'jenis', h.jenis, 'kind', s.kind,
                 'revenue', s.revenue, 'costs', s.costs, 'base', s.base, 'share', s.share, 'units', s.detail->'units') order by h.title)) m
      from public.iv_statements s join public.iv_holdings h on h.id = s.holding_id
      where s.investor_id = me and s.status = 'terkunci' and extract(year from s.period) = p_year
      group by s.period) q),
    'paid', (select coalesce(sum(amount), 0) from public.iv_withdrawals where investor_id = me and status = 'dibayar' and extract(year from paid_at at time zone 'Asia/Jakarta') = p_year));
end $$;

create or replace function public.iv_request_withdrawal(p_amount numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.iv_my_id(); r public.iv_investors; bal numeric; w public.iv_withdrawals;
begin
  if me is null then raise exception 'Akun ini belum terdaftar sebagai investor'; end if;
  select * into r from public.iv_investors where id = me for update;
  if r.demo then raise exception 'Akun demo tidak bisa menarik dana'; end if;
  if r.kyc_status <> 'terverifikasi' then raise exception 'Data diri (KYC) belum terverifikasi. Hubungi tim Pokama.'; end if;
  if r.bank_name is null or r.bank_acct_enc is null then raise exception 'Rekening tujuan belum terdaftar. Hubungi tim Pokama.'; end if;
  if p_amount is null or p_amount < 50000 then raise exception 'Minimal penarikan Rp50.000'; end if;
  if exists (select 1 from public.iv_withdrawals where investor_id = me and status = 'diminta') then
    raise exception 'Masih ada penarikan yang menunggu persetujuan'; end if;
  bal := (public.iv_balance(me)->>'withdrawable')::numeric;
  if p_amount > bal then raise exception 'Nominal melebihi saldo yang bisa ditarik'; end if;
  insert into public.iv_withdrawals(investor_id, amount, bank_snapshot)
  values (me, round(p_amount), r.bank_name || ' •••• ' || r.bank_last4 || ' · a.n. ' || coalesce(r.bank_holder, r.name)) returning * into w;
  insert into public.af_audit(by_person, action, target, reason, data) values (null, 'iv_tarik_diminta', w.id::text, r.name, jsonb_build_object('amount', w.amount));
  return jsonb_build_object('id', w.id, 'amount', w.amount, 'bank', w.bank_snapshot);
end $$;

create or replace function public.iv_offers_open() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.iv_my_id() is null and not public.iv_can_view() then '[]'::jsonb else
    (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'unit_code', unit_code, 'unit', public.iv_unit_name(unit_code), 'jenis', jenis, 'title', title,
      'summary', summary, 'target_amount', target_amount, 'min_amount', min_amount, 'est_return', est_return, 'tenor_months', tenor_months) order by sort, created_at desc), '[]')
     from public.iv_offers where status = 'dibuka') end
$$;

create or replace function public.iv_interest(p_offer uuid, p_amount numeric, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.iv_my_id(); r public.iv_investors; o public.iv_offers;
begin
  if me is null then raise exception 'Akun ini belum terdaftar sebagai investor'; end if;
  select * into r from public.iv_investors where id = me;
  if p_offer is not null then select * into o from public.iv_offers where id = p_offer and status = 'dibuka'; if o.id is null then raise exception 'Peluang sudah ditutup'; end if; end if;
  if (select count(*) from public.iv_leads where investor_id = me and created_at > now() - interval '1 day') >= 5 then raise exception 'Terlalu banyak permintaan hari ini'; end if;
  insert into public.iv_leads(investor_id, offer_id, name, wa, unit_code, amount_hint, note, source)
  values (me, o.id, r.name, r.wa, o.unit_code, nullif(p_amount, 0), left(nullif(btrim(p_note), ''), 500), 'investor');
end $$;

-- minat dari halaman publik (tanpa login): dibatasi per nomor dan total per jam
create or replace function public.iv_public_interest(p_name text, p_wa text, p_unit text, p_note text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare w text := regexp_replace(coalesce(p_wa, ''), '\D', '', 'g'); hsh text;
begin
  if length(btrim(coalesce(p_name, ''))) < 3 then raise exception 'Isi nama lengkap'; end if;
  if w like '0%' then w := '62' || substr(w, 2); end if;
  if w !~ '^62[0-9]{8,13}$' then raise exception 'Nomor WhatsApp tidak valid'; end if;
  hsh := encode(extensions.digest(w, 'sha256'), 'hex');
  if exists (select 1 from public.iv_leads where wa_hash = hsh and created_at > now() - interval '1 day') then
    raise exception 'Minat dengan nomor ini sudah kami terima. Tim kami akan menghubungi.'; end if;
  if (select count(*) from public.iv_leads where source = 'publik' and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Sedang ramai. Coba lagi nanti.'; end if;
  insert into public.iv_leads(name, wa, wa_hash, unit_code, note, source)
  values (left(btrim(p_name), 80), w, hsh, case when p_unit in ('RA','WG','NA','PK') then p_unit end, left(nullif(btrim(p_note), ''), 500), 'publik');
end $$;

-- dokumen perjanjian: investor hanya miliknya, staf yang berhak lihat
create or replace function public.iv_doc_path(p_h uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare h public.iv_holdings;
begin
  select * into h from public.iv_holdings where id = p_h;
  if not found or (h.investor_id is distinct from public.iv_my_id() and not public.iv_can_view()) then raise exception 'Dokumen tidak ditemukan'; end if;
  return h.doc_path;
end $$;

-- ================= panel staf =================
create or replace function public.iv_admin_meta() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.iv_need('view');
  return jsonb_build_object('role', public.pk_role(), 'me', public.pk_me(),
    'is_owner', public.iv_is_owner(), 'is_biz', public.iv_is_biz(), 'is_fin', public.iv_is_fin(),
    'units', (select jsonb_agg(jsonb_build_object('code', code, 'name', name) order by sort) from public.af_units) || '[{"code":"PK","name":"Pokama (holding)"}]'::jsonb,
    'counts', jsonb_build_object(
      'hold_wait', (select count(*) from public.iv_holdings where status = 'menunggu'),
      'wd_wait', (select count(*) from public.iv_withdrawals where status = 'diminta'),
      'wd_pay', (select count(*) from public.iv_withdrawals where status = 'disetujui'),
      'st_wait', (select count(*) from public.iv_statements where status = 'diajukan'),
      'kyc_wait', (select count(*) from public.iv_investors where status = 'aktif' and kyc_status = 'menunggu'),
      'leads', (select count(*) from public.iv_leads where status = 'baru')));
end $$;

create or replace function public.iv_admin_overview(p_unit text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare cur date := public.iv_month(); m0 timestamptz; h public.iv_holdings; c jsonb; live numeric := 0; per jsonb := '{}'; k text; x jsonb;
  fixed30 numeric := 0;
begin
  perform public.iv_need('view');
  m0 := cur::timestamp at time zone 'Asia/Jakarta';
  for h in select * from public.iv_holdings where status = 'aktif' and not demo and (p_unit is null or unit_code = p_unit) loop
    c := public.iv_calc(h.id, m0, now());
    live := live + coalesce((c->>'share')::numeric, 0);
    k := h.unit_code;
    x := coalesce(per->k, jsonb_build_object('principal', 0, 'live', 0, 'n', 0, 'aset', 0, 'proyek', 0, 'saham', 0, 'revenue', 0));
    x := x || jsonb_build_object('principal', (x->>'principal')::numeric + h.principal, 'live', (x->>'live')::numeric + coalesce((c->>'share')::numeric, 0),
      'n', (x->>'n')::int + 1, h.jenis, (x->>h.jenis)::int + 1, 'revenue', (x->>'revenue')::numeric + coalesce((c->>'revenue')::numeric, 0));
    per := per || jsonb_build_object(k, x);
    if h.jenis = 'proyek' and h.return_model = 'imbal_tetap' then fixed30 := fixed30 + round(h.principal * h.rate_pct / 100); end if;
  end loop;
  return jsonb_build_object('period', cur,
    'investors', (select count(*) from public.iv_investors where status = 'aktif' and not demo),
    'investors_active', (select count(distinct investor_id) from public.iv_holdings where status = 'aktif' and not demo and (p_unit is null or unit_code = p_unit)),
    'principal', (select coalesce(sum(principal), 0) from public.iv_holdings where status = 'aktif' and not demo and (p_unit is null or unit_code = p_unit)),
    'month_live', live,
    'last_month', (select coalesce(sum(s.share), 0) from public.iv_statements s join public.iv_holdings h on h.id = s.holding_id
                   where s.period = (cur - interval '1 month')::date and s.kind <> 'modal' and not h.demo and (p_unit is null or h.unit_code = p_unit)),
    'ytd', (select coalesce(sum(s.share), 0) from public.iv_statements s join public.iv_holdings h on h.id = s.holding_id
            where s.status = 'terkunci' and s.kind <> 'modal' and s.period >= date_trunc('year', cur)::date and not h.demo and (p_unit is null or h.unit_code = p_unit)),
    'payable', (select coalesce(sum((public.iv_balance(i.id)->>'withdrawable')::numeric), 0) from public.iv_investors i where not i.demo),
    'wd_pending', (select coalesce(sum(amount), 0) from public.iv_withdrawals w join public.iv_investors i on i.id = w.investor_id where w.status in ('diminta','disetujui') and not i.demo),
    'fixed_next', fixed30,
    'due_90', (select coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'title', h.title, 'investor', i.name, 'unit', public.iv_unit_name(h.unit_code),
                 'ends_on', h.ends_on, 'principal', h.principal, 'back', h.principal_back) order by h.ends_on), '[]')
               from public.iv_holdings h join public.iv_investors i on i.id = h.investor_id
               where h.status = 'aktif' and not h.demo and h.ends_on is not null and h.ends_on <= (now() at time zone 'Asia/Jakarta')::date + 90
                 and (p_unit is null or h.unit_code = p_unit)),
    'per_unit', (select coalesce(jsonb_agg(jsonb_build_object('code', key, 'name', public.iv_unit_name(key)) || value), '[]') from jsonb_each(per)),
    'by_jenis', (select coalesce(jsonb_object_agg(jenis, jsonb_build_object('n', n, 'principal', p)), '{}') from
                 (select jenis, count(*) n, sum(principal) p from public.iv_holdings where status = 'aktif' and not demo and (p_unit is null or unit_code = p_unit) group by jenis) q),
    'trend', (select coalesce(jsonb_agg(jsonb_build_object('period', period, 'share', s) order by period), '[]') from
              (select s.period, sum(s.share) s from public.iv_statements s join public.iv_holdings h on h.id = s.holding_id
               where s.status = 'terkunci' and s.kind <> 'modal' and not h.demo and s.period >= (cur - interval '11 months')::date and (p_unit is null or h.unit_code = p_unit)
               group by s.period) q),
    'top_assets', (select coalesce(jsonb_agg(u order by (u->>'revenue')::numeric desc), '[]') from (
        select jsonb_build_object('name', uu->>'name', 'branch', uu->>'branch', 'investor', i.name, 'revenue', (uu->>'revenue')::numeric,
          'net', (uu->>'net')::numeric, 'share', (uu->>'share')::numeric, 'util30', uu->'util30', 'purchase_price', uu->'purchase_price') u
        from public.iv_holdings h join public.iv_investors i on i.id = h.investor_id,
          lateral jsonb_array_elements(coalesce(public.iv_calc(h.id, m0, now())->'units', '[]')) uu
        where h.status = 'aktif' and h.jenis = 'aset' and not h.demo and (p_unit is null or h.unit_code = p_unit) limit 200) z),
    'last_unlocked', (select count(*) from public.iv_holdings h where h.status = 'aktif' and not h.demo and h.started_on < cur
                      and not exists (select 1 from public.iv_statements s where s.holding_id = h.id and s.period = (cur - interval '1 month')::date and s.status = 'terkunci')),
    'leads_new', (select count(*) from public.iv_leads where status = 'baru'));
end $$;

create or replace function public.iv_admin_investors(p_q text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.iv_need('view');
  return (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'email', i.email, 'kind', i.kind, 'city', i.city, 'status', i.status,
      'kyc_status', i.kyc_status, 'linked', i.user_id is not null, 'demo', i.demo,
      'wa', case when i.wa is null then null else '+' || left(i.wa, 4) || '••••' || right(i.wa, 3) end,
      'bank', case when i.bank_name is null then null else i.bank_name || ' •••• ' || coalesce(i.bank_last4, '') end,
      'principal', (select coalesce(sum(principal), 0) from public.iv_holdings h where h.investor_id = i.id and h.status = 'aktif'),
      'holdings', (select count(*) from public.iv_holdings h where h.investor_id = i.id and h.status = 'aktif'),
      'units', (select coalesce(jsonb_agg(distinct h.unit_code), '[]') from public.iv_holdings h where h.investor_id = i.id and h.status = 'aktif'),
      'balance', (public.iv_balance(i.id)->>'withdrawable')::numeric,
      'earned', (select coalesce(sum(share), 0) from public.iv_statements s where s.investor_id = i.id and s.status = 'terkunci' and s.kind <> 'modal'),
      'created_at', i.created_at) order by i.status, i.name), '[]')
    from public.iv_investors i
    where p_q is null or i.name ilike '%' || p_q || '%' or i.email ilike '%' || p_q || '%');
end $$;

create or replace function public.iv_admin_investor(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare i public.iv_investors;
begin
  perform public.iv_need('view');
  select * into i from public.iv_investors where id = p_id;
  if not found then raise exception 'Investor tidak ditemukan'; end if;
  return jsonb_build_object('id', i.id, 'name', i.name, 'email', i.email, 'kind', i.kind, 'city', i.city, 'status', i.status, 'note', i.note,
    'kyc_status', i.kyc_status, 'kyc_note', i.kyc_note, 'linked', i.user_id is not null, 'demo', i.demo,
    'wa', case when i.wa is null then null else '+' || left(i.wa, 4) || '••••' || right(i.wa, 3) end,
    'nik', case when i.nik_last4 is null then null else '•••• ' || i.nik_last4 end, 'npwp', case when i.npwp_last4 is null then null else '•••• ' || i.npwp_last4 end,
    'bank_name', i.bank_name, 'bank_holder', i.bank_holder, 'bank', case when i.bank_last4 is null then null else '•••• ' || i.bank_last4 end,
    'balance', public.iv_balance(i.id),
    'holdings', (select coalesce(jsonb_agg(public.iv_holding_json(h) order by h.created_at desc), '[]') from public.iv_holdings h where h.investor_id = i.id),
    'withdrawals', (select coalesce(jsonb_agg(to_jsonb(w) - 'investor_id' order by w.requested_at desc), '[]') from public.iv_withdrawals w where w.investor_id = i.id),
    'statements', (select coalesce(jsonb_agg(jsonb_build_object('period', s.period, 'title', h.title, 'kind', s.kind, 'share', s.share, 'status', s.status) order by s.period desc), '[]')
                   from public.iv_statements s join public.iv_holdings h on h.id = s.holding_id where s.investor_id = i.id));
end $$;

create or replace function public.iv_admin_investor_save(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id', '')::uuid; old public.iv_investors; em text := lower(btrim(coalesce(p->>'email', ''))); w text;
begin
  perform public.iv_need('biz');
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Email Google investor tidak valid'; end if;
  if length(btrim(coalesce(p->>'name', ''))) < 3 then raise exception 'Isi nama investor'; end if;
  if exists (select 1 from public.pk_people x where x.is_active and lower(x.email) = em) then raise exception 'Email ini akun staf Pokama. Pakai email pribadi investor.'; end if;
  w := regexp_replace(coalesce(p->>'wa', ''), '\D', '', 'g'); if w like '0%' then w := '62' || substr(w, 2); end if;
  if w <> '' and w !~ '^62[0-9]{8,13}$' then raise exception 'Nomor WhatsApp tidak valid'; end if;
  if v_id is null then
    insert into public.iv_investors(email, name, wa, kind, city, note, created_by)
    values (em, btrim(p->>'name'), nullif(w, ''), coalesce(nullif(p->>'kind', ''), 'perorangan'), nullif(btrim(p->>'city'), ''), nullif(btrim(p->>'note'), ''), public.pk_me())
    returning id into v_id;
    perform public.iv_log('investor_baru', v_id::text, null, jsonb_build_object('name', p->>'name', 'email', em));
  else
    select * into old from public.iv_investors where id = v_id for update;
    if not found then raise exception 'Investor tidak ditemukan'; end if;
    if old.user_id is not null and lower(old.email) <> em and not public.iv_is_owner() then raise exception 'Email akun yang sudah tersambung hanya bisa diganti CEO'; end if;
    update public.iv_investors set email = em, name = btrim(p->>'name'), wa = nullif(w, ''), kind = coalesce(nullif(p->>'kind', ''), kind),
      city = nullif(btrim(p->>'city'), ''), note = nullif(btrim(p->>'note'), ''),
      user_id = case when lower(old.email) <> em then null else user_id end,
      status = case when p ? 'status' and public.iv_is_owner() then p->>'status' else status end, updated_at = now()
    where id = v_id;
    perform public.iv_log('investor_ubah', v_id::text, null, jsonb_build_object('before', jsonb_build_object('name', old.name, 'email', old.email, 'status', old.status),
      'after', jsonb_build_object('name', p->>'name', 'email', em, 'status', p->>'status')));
  end if;
  return v_id;
end $$;

-- KYC & rekening: Keuangan saja. Nomor lengkap disimpan terenkripsi, tampil 4 digit terakhir.
create or replace function public.iv_admin_kyc(p_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare old public.iv_investors; nik text := regexp_replace(coalesce(p->>'nik', ''), '\D', '', 'g'); npwp text := regexp_replace(coalesce(p->>'npwp', ''), '\D', '', 'g');
  acct text := regexp_replace(coalesce(p->>'bank_acct', ''), '\D', '', 'g');
begin
  perform public.iv_need('fin');
  select * into old from public.iv_investors where id = p_id for update;
  if not found then raise exception 'Investor tidak ditemukan'; end if;
  if nik <> '' and length(nik) <> 16 then raise exception 'NIK harus 16 digit'; end if;
  if acct <> '' and length(acct) < 6 then raise exception 'Nomor rekening terlalu pendek'; end if;
  if coalesce(p->>'kyc_status', old.kyc_status) not in ('menunggu','terverifikasi','ditolak') then raise exception 'Status KYC tidak dikenal'; end if;
  if coalesce(p->>'kyc_status', '') = 'terverifikasi' and (coalesce(acct, '') = '' and old.bank_acct_enc is null) then raise exception 'Isi rekening sebelum menandai terverifikasi'; end if;
  if exists (select 1 from public.iv_withdrawals where investor_id = p_id and status in ('diminta','disetujui')) and (acct <> '' or nullif(p->>'bank_name', '') is distinct from null and p->>'bank_name' <> coalesce(old.bank_name, '')) then
    raise exception 'Ada penarikan yang belum selesai. Selesaikan dulu sebelum mengganti rekening.'; end if;
  update public.iv_investors set
    nik_enc = case when nik <> '' then public.af_enc(nik) else nik_enc end, nik_last4 = case when nik <> '' then right(nik, 4) else nik_last4 end,
    npwp_enc = case when npwp <> '' then public.af_enc(npwp) else npwp_enc end, npwp_last4 = case when npwp <> '' then right(npwp, 4) else npwp_last4 end,
    bank_acct_enc = case when acct <> '' then public.af_enc(acct) else bank_acct_enc end, bank_last4 = case when acct <> '' then right(acct, 4) else bank_last4 end,
    bank_name = coalesce(nullif(btrim(p->>'bank_name'), ''), bank_name), bank_holder = coalesce(nullif(btrim(p->>'bank_holder'), ''), bank_holder),
    kyc_status = coalesce(nullif(p->>'kyc_status', ''), kyc_status), kyc_note = coalesce(nullif(btrim(p->>'kyc_note'), ''), kyc_note), updated_at = now()
  where id = p_id;
  perform public.iv_log('kyc_ubah', p_id::text, null, jsonb_build_object(
    'nik', nik <> '', 'npwp', npwp <> '', 'rekening', acct <> '', 'bank', jsonb_build_array(old.bank_name, p->>'bank_name'),
    'kyc', jsonb_build_array(old.kyc_status, p->>'kyc_status'), 'rek_lama', old.bank_last4, 'rek_baru', case when acct <> '' then right(acct, 4) end));
end $$;

create or replace function public.iv_admin_reveal(p_id uuid, p_field text) returns text
language plpgsql security definer set search_path = public as $$
declare i public.iv_investors; v text;
begin
  perform public.iv_need('fin');
  select * into i from public.iv_investors where id = p_id;
  if not found then raise exception 'Investor tidak ditemukan'; end if;
  v := case p_field when 'nik' then public.af_dec(i.nik_enc) when 'npwp' then public.af_dec(i.npwp_enc) when 'rekening' then public.af_dec(i.bank_acct_enc) else null end;
  perform public.iv_log('buka_data', p_id::text, p_field);
  return v;
end $$;

-- unit Rentalaja untuk dipilih sebagai aset investor
create or replace function public.iv_admin_rp_units(p_q text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.iv_need('view');
  return (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'code', u.code, 'name', p.name || ' ' || u.code, 'product', p.name, 'branch', b.name,
      'serial', u.plate_or_serial, 'price', u.purchase_price, 'since', u.purchase_date, 'status', u.status,
      'owned_by', (select i.name from public.iv_holdings h join public.iv_investors i on i.id = h.investor_id
                   where h.status in ('aktif','menunggu') and u.id = any(h.rp_unit_ids) limit 1)) order by p.name, u.code), '[]')
    from public.units u join public.products p on p.id = u.product_id join public.branches b on b.id = u.branch_id
    where u.archived_at is null and (p_q is null or p.name ilike '%' || p_q || '%' or u.code ilike '%' || p_q || '%' or u.plate_or_serial ilike '%' || p_q || '%' or b.name ilike '%' || p_q || '%'));
end $$;

create or replace function public.iv_admin_rp_refs() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.iv_need('view');
  return jsonb_build_object(
    'branches', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by sort), '[]') from public.branches),
    'products', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name), '[]') from public.products));
end $$;

create or replace function public.iv_admin_holdings(p_status text default null, p_unit text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m0 timestamptz := public.iv_month()::timestamp at time zone 'Asia/Jakarta';
begin
  perform public.iv_need('view');
  return (select coalesce(jsonb_agg(public.iv_holding_json(h) || jsonb_build_object('investor', i.name, 'investor_id', i.id, 'demo', h.demo,
      'created_by', (select nickname from public.pk_people where id = h.created_by), 'submitted_by_me', h.submitted_by = public.pk_me() or (h.submitted_by is null and h.created_by = public.pk_me()),
      'submitter_ceo', (select role = 'ceo' from public.pk_people where id = coalesce(h.submitted_by, h.created_by)),
      'reject_reason', h.reject_reason, 'note', h.note, 'rp_unit_ids', h.rp_unit_ids, 'rp_branch_ids', h.rp_branch_ids, 'rp_product_ids', h.rp_product_ids,
      'month', case when h.status = 'aktif' then (select jsonb_build_object('revenue', (c->>'revenue')::numeric, 'share', (c->>'share')::numeric, 'auto', c->'auto')
                                                   from (select public.iv_calc(h.id, m0, now()) c) z) end,
      'earned', (select coalesce(sum(share), 0) from public.iv_statements s where s.holding_id = h.id and s.status = 'terkunci' and s.kind <> 'modal'))
      order by case h.status when 'menunggu' then 0 when 'draf' then 1 when 'aktif' then 2 else 3 end, h.created_at desc), '[]')
    from public.iv_holdings h join public.iv_investors i on i.id = h.investor_id
    where (p_status is null or h.status = p_status) and (p_unit is null or h.unit_code = p_unit));
end $$;

create or replace function public.iv_admin_holding_save(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id', '')::uuid; old public.iv_holdings; j text := p->>'jenis'; u text := p->>'unit_code';
  units uuid[] := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p->'rp_unit_ids', '[]')) x), '{}');
  brs uuid[] := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p->'rp_branch_ids', '[]')) x), '{}');
  prs uuid[] := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p->'rp_product_ids', '[]')) x), '{}');
  clash text;
begin
  perform public.iv_need('biz');
  if not exists (select 1 from public.iv_investors where id = (p->>'investor_id')::uuid and status = 'aktif') then raise exception 'Pilih investor aktif'; end if;
  if coalesce(j, '') not in ('aset','proyek','saham') then raise exception 'Pilih jenis investasi'; end if;
  if j = 'aset' then u := 'RA'; end if;
  if coalesce(u, '') not in ('RA','WG','NA','PK') then raise exception 'Pilih unit bisnis'; end if;
  if length(btrim(coalesce(p->>'title', ''))) < 3 then raise exception 'Isi nama investasi'; end if;
  if j = 'aset' and coalesce(p->>'rp_scheme', '') not in ('per_unit','vendor','flat','location') then raise exception 'Pilih skema aset'; end if;
  if j = 'proyek' and coalesce(p->>'return_model', '') not in ('imbal_tetap','bagi_laba') then raise exception 'Pilih cara imbal hasil'; end if;
  if j <> 'aset' and coalesce(nullif(p->>'rate_pct', '')::numeric, 0) <= 0 then raise exception 'Isi persen imbal/porsi'; end if;
  if j = 'aset' and p->>'rp_scheme' <> 'flat' and coalesce(nullif(p->>'rate_pct', '')::numeric, 0) <= 0 then raise exception 'Isi porsi investor (%%)'; end if;
  if j = 'aset' and p->>'rp_scheme' = 'flat' and coalesce(nullif(p->>'rp_flat', '')::numeric, 0) <= 0 then raise exception 'Isi nominal flat per bulan'; end if;
  if coalesce(nullif(p->>'rate_pct', '')::numeric, 0) > 100 then raise exception 'Persen tidak boleh lebih dari 100'; end if;
  if j = 'aset' and coalesce(p->>'rp_scheme', '') = 'per_unit' and cardinality(units) = 0 then raise exception 'Pilih unit yang dimiliki investor'; end if;
  if j = 'aset' and coalesce(p->>'rp_scheme', '') = 'location' and cardinality(brs) = 0 then raise exception 'Pilih lokasi'; end if;
  select string_agg(p2.name || ' ' || un.code, ', ') into clash from public.units un join public.products p2 on p2.id = un.product_id
  where un.id = any(units) and exists (select 1 from public.iv_holdings h where h.status in ('aktif','menunggu') and un.id = any(h.rp_unit_ids) and h.id is distinct from v_id);
  if clash is not null then raise exception 'Unit sudah dimiliki investasi lain: %', clash; end if;
  if v_id is not null then
    select * into old from public.iv_holdings where id = v_id for update;
    if not found then raise exception 'Investasi tidak ditemukan'; end if;
    if old.status not in ('draf','ditolak') then raise exception 'Investasi yang sudah diajukan/aktif tidak bisa diubah. Akhiri lalu buat yang baru.'; end if;
  end if;
  if v_id is null then
    insert into public.iv_holdings(investor_id, unit_code, jenis, title, principal, started_on, ends_on, return_model, rate_pct, principal_back,
      rp_scheme, rp_basis, rp_ops_pct, rp_flat, rp_unit_ids, rp_branch_ids, rp_product_ids, pay_day, note, created_by)
    values ((p->>'investor_id')::uuid, u, j, btrim(p->>'title'), coalesce(nullif(p->>'principal', '')::numeric, 0),
      coalesce(nullif(p->>'started_on', '')::date, (now() at time zone 'Asia/Jakarta')::date), nullif(p->>'ends_on', '')::date,
      case when j = 'proyek' then nullif(p->>'return_model', '') end, nullif(p->>'rate_pct', '')::numeric, case when j = 'proyek' then coalesce(nullif(p->>'principal_back', ''), 'akhir') end,
      case when j = 'aset' then nullif(p->>'rp_scheme', '') end, case when j = 'aset' then coalesce(nullif(p->>'rp_basis', ''), 'net') end,
      case when j = 'aset' then nullif(p->>'rp_ops_pct', '')::numeric end, case when j = 'aset' then nullif(p->>'rp_flat', '')::numeric end,
      case when j = 'aset' then units else '{}' end, case when j = 'aset' then brs else '{}' end, case when j = 'aset' then prs else '{}' end,
      nullif(p->>'pay_day', '')::int, nullif(btrim(p->>'note'), ''), public.pk_me())
    returning id into v_id;
    perform public.iv_log('investasi_baru', v_id::text, null, p);
  else
    update public.iv_holdings set investor_id = (p->>'investor_id')::uuid, unit_code = u, jenis = j, title = btrim(p->>'title'),
      principal = coalesce(nullif(p->>'principal', '')::numeric, 0), started_on = coalesce(nullif(p->>'started_on', '')::date, started_on), ends_on = nullif(p->>'ends_on', '')::date,
      return_model = case when j = 'proyek' then nullif(p->>'return_model', '') end, rate_pct = nullif(p->>'rate_pct', '')::numeric,
      principal_back = case when j = 'proyek' then coalesce(nullif(p->>'principal_back', ''), 'akhir') end,
      rp_scheme = case when j = 'aset' then nullif(p->>'rp_scheme', '') end, rp_basis = case when j = 'aset' then coalesce(nullif(p->>'rp_basis', ''), 'net') end,
      rp_ops_pct = case when j = 'aset' then nullif(p->>'rp_ops_pct', '')::numeric end, rp_flat = case when j = 'aset' then nullif(p->>'rp_flat', '')::numeric end,
      rp_unit_ids = case when j = 'aset' then units else '{}' end, rp_branch_ids = case when j = 'aset' then brs else '{}' end, rp_product_ids = case when j = 'aset' then prs else '{}' end,
      pay_day = nullif(p->>'pay_day', '')::int, note = nullif(btrim(p->>'note'), ''), status = 'draf', reject_reason = null
    where id = v_id;
    perform public.iv_log('investasi_ubah', v_id::text, null, jsonb_build_object('before', public.iv_holding_json(old), 'after', p));
  end if;
  return v_id;
end $$;

create or replace function public.iv_admin_holding_doc(p_id uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.iv_need('biz');
  if p_path !~ ('^iv-docs/' || p_id::text || '/') then raise exception 'Lokasi dokumen tidak valid'; end if;
  if not exists (select 1 from public.iv_holdings where id = p_id and status in ('draf','ditolak')) then raise exception 'Dokumen hanya bisa diganti saat draf'; end if;
  update public.iv_holdings set doc_path = p_path where id = p_id;
  perform public.iv_log('dokumen', p_id::text, p_path);
end $$;

-- alur: draf → (ajukan) menunggu → (CEO setujui) aktif → (akhiri) selesai
create or replace function public.iv_admin_holding_act(p_id uuid, p_act text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare h public.iv_holdings; i public.iv_investors; pid uuid; ag uuid; me uuid := public.pk_me(); asker uuid;
begin
  select * into h from public.iv_holdings where id = p_id for update;
  if not found then raise exception 'Investasi tidak ditemukan'; end if;
  asker := coalesce(h.submitted_by, h.created_by);
  if p_act = 'ajukan' then
    perform public.iv_need('biz');
    if h.status not in ('draf','ditolak') then raise exception 'Hanya draf yang bisa diajukan'; end if;
    if h.doc_path is null then raise exception 'Unggah dokumen perjanjian dulu'; end if;
    update public.iv_holdings set status = 'menunggu', submitted_by = me, submitted_at = now(), reject_reason = null where id = p_id;
  elsif p_act in ('setujui','tolak') then
    if h.status <> 'menunggu' then raise exception 'Investasi tidak sedang menunggu persetujuan'; end if;
    -- CEO menyetujui; bila CEO sendiri yang mengajukan, Keuangan yang menyetujui. Pengaju tidak pernah menyetujui sendiri.
    if asker = me then raise exception 'Pengaju tidak bisa menyetujui pengajuannya sendiri'; end if;
    if not (public.iv_is_owner() or (public.pk_role() = 'keuangan' and (select role from public.pk_people where id = asker) = 'ceo')) then
      raise exception 'Hanya CEO yang menyetujui investasi'; end if;
    if p_act = 'tolak' then
      if coalesce(btrim(p_reason), '') = '' then raise exception 'Tulis alasan penolakan'; end if;
      update public.iv_holdings set status = 'ditolak', reject_reason = p_reason, approved_by = me, approved_at = now() where id = p_id;
    else
      if h.jenis = 'aset' then
        select * into i from public.iv_investors where id = h.investor_id for update;
        pid := i.rp_partner_id;
        if pid is null then
          insert into public.partners(user_id, name, phone, kind, kyc_status, bank_name, bank_account_masked, bank_account_holder, npwp_masked, is_active)
          values (null, i.name || ' (investor Pokama)', i.wa, case h.rp_scheme when 'per_unit' then 'unit' else h.rp_scheme end,
            case i.kyc_status when 'terverifikasi' then 'verified' when 'ditolak' then 'rejected' else 'pending' end,
            i.bank_name, case when i.bank_last4 is null then null else '•••• ' || i.bank_last4 end, i.bank_holder,
            case when i.npwp_last4 is null then null else '•••• ' || i.npwp_last4 end, true)
          returning id into pid;
          update public.iv_investors set rp_partner_id = pid where id = i.id;
        end if;
        insert into public.partner_agreements(partner_id, scheme, basis, share_percent, flat_amount, pay_day, unit_ids, branch_ids, product_ids,
          all_products_at_location, starts_on, ends_on, document_path, status, approved_by, ops_cost_percent, note, created_by)
        values (pid, h.rp_scheme, coalesce(h.rp_basis, 'net'), h.rate_pct, h.rp_flat, h.pay_day, h.rp_unit_ids, h.rp_branch_ids, h.rp_product_ids,
          cardinality(h.rp_product_ids) = 0, h.started_on, h.ends_on, h.doc_path, 'active', auth.uid(), h.rp_ops_pct,
          'Dikelola dari Portal Investor Pokama · ' || h.title, auth.uid())
        returning id into ag;
        update public.iv_holdings set rp_agreement_id = ag where id = p_id;
      end if;
      update public.iv_holdings set status = 'aktif', approved_by = me, approved_at = now() where id = p_id;
    end if;
  elsif p_act = 'akhiri' then
    perform public.iv_need('owner');
    if h.status <> 'aktif' then raise exception 'Hanya investasi aktif yang bisa diakhiri'; end if;
    if coalesce(btrim(p_reason), '') = '' then raise exception 'Tulis alasan/keterangan pengakhiran'; end if;
    update public.iv_holdings set status = 'selesai', ends_on = least(coalesce(ends_on, (now() at time zone 'Asia/Jakarta')::date), (now() at time zone 'Asia/Jakarta')::date),
      ended_by = me, ended_at = now(), note = coalesce(note || E'\n', '') || 'Diakhiri: ' || p_reason where id = p_id;
    if h.rp_agreement_id is not null then
      update public.partner_agreements set status = 'ended', ends_on = (now() at time zone 'Asia/Jakarta')::date where id = h.rp_agreement_id;
    end if;
  elsif p_act = 'hapus' then
    perform public.iv_need('biz');
    if h.status not in ('draf','ditolak') then raise exception 'Hanya draf yang bisa dihapus'; end if;
    delete from public.iv_holdings where id = p_id;
  else raise exception 'Aksi tidak dikenal'; end if;
  perform public.iv_log('investasi_' || p_act, p_id::text, p_reason, jsonb_build_object('title', h.title, 'investor', h.investor_id));
  return jsonb_build_object('ok', true);
end $$;

-- bagi hasil per bulan
create or replace function public.iv_admin_statements(p_period date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare f timestamptz; t timestamptz;
begin
  perform public.iv_need('view');
  f := public.iv_month(p_period)::timestamp at time zone 'Asia/Jakarta'; t := (public.iv_month(p_period) + interval '1 month')::timestamp at time zone 'Asia/Jakarta';
  return jsonb_build_object('period', public.iv_month(p_period), 'closed', t <= now(),
    'rows', (select coalesce(jsonb_agg(r order by r->>'status_ord', r->>'investor', r->>'title'), '[]') from (
      select jsonb_build_object('holding_id', h.id, 'title', h.title, 'investor', i.name, 'unit', public.iv_unit_name(h.unit_code), 'unit_code', h.unit_code,
        'jenis', h.jenis, 'return_model', h.return_model, 'rate_pct', h.rate_pct, 'principal', h.principal, 'rp_scheme', h.rp_scheme, 'demo', h.demo,
        'needs_input', not coalesce((lv->>'auto')::boolean, false),
        'live', lv,
        'st', (select jsonb_agg(jsonb_build_object('id', s.id, 'kind', s.kind, 'revenue', s.revenue, 'costs', s.costs, 'base', s.base, 'share', s.share, 'status', s.status,
                 'source', s.source, 'note', s.note, 'by_me', coalesce(s.submitted_by, s.computed_by) = public.pk_me(),
                 'submitter_ceo', (select role = 'ceo' from public.pk_people where id = s.submitted_by)))
               from public.iv_statements s where s.holding_id = h.id and s.period = public.iv_month(p_period)),
        'status_ord', case when exists (select 1 from public.iv_statements s where s.holding_id = h.id and s.period = public.iv_month(p_period) and s.status = 'terkunci') then '2' else '1' end) r
      from public.iv_holdings h join public.iv_investors i on i.id = h.investor_id,
        lateral (select public.iv_calc(h.id, f, least(t, now())) lv) z
      where h.status in ('aktif','selesai') and h.started_on < t::date and coalesce(h.ends_on, 'infinity'::date) >= f::date) q));
end $$;

-- hitung otomatis (aset & imbal tetap) untuk satu bulan yang sudah selesai
create or replace function public.iv_admin_compute(p_period date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m date := public.iv_month(p_period); f timestamptz; t timestamptz; h public.iv_holdings; c jsonb; n int := 0;
begin
  perform public.iv_need('fin');
  f := m::timestamp at time zone 'Asia/Jakarta'; t := (m + interval '1 month')::timestamp at time zone 'Asia/Jakarta';
  if t > now() then raise exception 'Bulan berjalan belum bisa ditutup. Hitung setelah bulan selesai.'; end if;
  for h in select * from public.iv_holdings where status in ('aktif','selesai') and started_on < t::date and coalesce(ends_on, 'infinity'::date) >= f::date loop
    c := public.iv_calc(h.id, f, t);
    if not coalesce((c->>'auto')::boolean, false) then continue; end if;
    insert into public.iv_statements(holding_id, investor_id, period, kind, revenue, costs, base, share, detail, source, status, computed_by)
    values (h.id, h.investor_id, m, 'hasil', coalesce((c->>'revenue')::numeric, 0), coalesce((c->>'costs')::numeric, 0), coalesce((c->>'base')::numeric, 0),
      coalesce((c->>'share')::numeric, 0), c, 'otomatis', 'draf', public.pk_me())
    on conflict (holding_id, period, kind) do update set revenue = excluded.revenue, costs = excluded.costs, base = excluded.base, share = excluded.share,
      detail = excluded.detail, computed_by = excluded.computed_by, computed_at = now(), status = 'draf', submitted_by = null, submitted_at = null
    where iv_statements.status <> 'terkunci';
    n := n + 1;
  end loop;
  perform public.iv_log('hitung', m::text, null, jsonb_build_object('n', n));
  return jsonb_build_object('computed', n);
end $$;

-- input manual: bagi laba (laba proyek/unit), dividen saham, atau pengembalian modal
create or replace function public.iv_admin_statement_input(p_holding uuid, p_period date, p_kind text, p_revenue numeric, p_costs numeric, p_amount numeric, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare h public.iv_holdings; m date := public.iv_month(p_period); base numeric; share numeric; prev numeric;
begin
  perform public.iv_need('fin');
  select * into h from public.iv_holdings where id = p_holding;
  if not found or h.status not in ('aktif','selesai') then raise exception 'Investasi tidak aktif'; end if;
  if p_kind not in ('hasil','dividen','modal') then raise exception 'Jenis tidak dikenal'; end if;
  if (m + interval '1 month')::timestamp at time zone 'Asia/Jakarta' > now() and p_kind <> 'modal' then raise exception 'Bulan berjalan belum bisa diisi'; end if;
  if p_kind = 'hasil' and h.jenis = 'aset' then raise exception 'Aset dihitung otomatis'; end if;
  if p_kind = 'hasil' and h.jenis = 'proyek' and h.return_model = 'imbal_tetap' then raise exception 'Imbal tetap dihitung otomatis'; end if;
  if p_kind = 'dividen' and h.jenis <> 'saham' then raise exception 'Dividen hanya untuk saham'; end if;
  if p_kind = 'hasil' and h.jenis = 'saham' then raise exception 'Untuk saham, isi sebagai dividen'; end if;
  if p_kind = 'modal' then
    if h.jenis <> 'proyek' then raise exception 'Pengembalian modal hanya untuk proyek'; end if;
    select coalesce(sum(share), 0) into prev from public.iv_statements where holding_id = h.id and kind = 'modal' and period <> m;
    if coalesce(p_amount, 0) <= 0 or prev + p_amount > h.principal then raise exception 'Nominal pengembalian modal melebihi sisa modal'; end if;
    base := h.principal; share := round(p_amount);
  elsif p_kind = 'dividen' then
    -- dividen: laba yang dibagikan (p_amount) × persen kepemilikan
    if coalesce(p_amount, 0) < 0 then raise exception 'Nominal tidak valid'; end if;
    base := round(p_amount); share := round(p_amount * h.rate_pct / 100);
  else
    base := coalesce(p_revenue, 0) - coalesce(p_costs, 0);
    share := round(greatest(base, 0) * h.rate_pct / 100);
  end if;
  insert into public.iv_statements(holding_id, investor_id, period, kind, revenue, costs, base, share, source, status, note, computed_by)
  values (h.id, h.investor_id, m, p_kind, coalesce(p_revenue, 0), coalesce(p_costs, 0), base, share, 'input', 'draf', nullif(btrim(p_note), ''), public.pk_me())
  on conflict (holding_id, period, kind) do update set revenue = excluded.revenue, costs = excluded.costs, base = excluded.base, share = excluded.share,
    note = excluded.note, computed_by = excluded.computed_by, computed_at = now(), status = 'draf', submitted_by = null, submitted_at = null
  where iv_statements.status <> 'terkunci';
  if not found then raise exception 'Laporan bulan ini sudah dikunci'; end if;
  perform public.iv_log('input_' || p_kind, h.id::text, p_note, jsonb_build_object('period', m, 'revenue', p_revenue, 'costs', p_costs, 'amount', p_amount, 'share', share));
end $$;

-- ajukan kunci (Keuangan) → kunci (CEO, atau Keuangan bila CEO yang mengajukan). Setelah terkunci masuk saldo investor.
create or replace function public.iv_admin_statements_act(p_period date, p_act text, p_ids uuid[] default null) returns int
language plpgsql security definer set search_path = public as $$
declare m date := public.iv_month(p_period); n int; me uuid := public.pk_me();
begin
  if p_act = 'ajukan' then
    perform public.iv_need('fin');
    update public.iv_statements set status = 'diajukan', submitted_by = me, submitted_at = now()
    where period = m and status = 'draf' and (p_ids is null or id = any(p_ids));
  elsif p_act = 'kunci' then
    if not (public.iv_is_owner() or public.pk_role() = 'keuangan') then raise exception 'Hanya CEO atau Keuangan'; end if;
    update public.iv_statements s set status = 'terkunci', locked_by = me, locked_at = now()
    where period = m and status = 'diajukan' and (p_ids is null or id = any(p_ids)) and s.submitted_by is distinct from me
      and (public.iv_is_owner() or (select role from public.pk_people where id = s.submitted_by) = 'ceo');
  elsif p_act = 'kembalikan' then
    if not (public.iv_is_fin()) then raise exception 'Hanya Keuangan atau CEO'; end if;
    update public.iv_statements set status = 'draf', submitted_by = null, submitted_at = null where period = m and status = 'diajukan' and (p_ids is null or id = any(p_ids));
  else raise exception 'Aksi tidak dikenal'; end if;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Tidak ada laporan yang bisa diproses. Catatan: pengaju tidak bisa mengunci ajuannya sendiri.'; end if;
  perform public.iv_log('laporan_' || p_act, m::text, null, jsonb_build_object('n', n));
  return n;
end $$;

create or replace function public.iv_admin_withdrawals(p_status text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.iv_need('view');
  return (select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'investor', i.name, 'investor_id', i.id, 'amount', w.amount, 'status', w.status, 'bank', w.bank_snapshot,
      'requested_at', w.requested_at, 'decided_at', w.decided_at, 'paid_at', w.paid_at, 'ref', w.ref, 'reason', w.reason, 'demo', i.demo,
      'decided_by', (select nickname from public.pk_people where id = w.decided_by), 'decided_by_me', w.decided_by = public.pk_me(),
      'paid_by', (select nickname from public.pk_people where id = w.paid_by),
      'balance_after', (public.iv_balance(i.id)->>'withdrawable')::numeric, 'kyc', i.kyc_status)
      order by case w.status when 'diminta' then 0 when 'disetujui' then 1 else 2 end, w.requested_at desc), '[]')
    from public.iv_withdrawals w join public.iv_investors i on i.id = w.investor_id
    where p_status is null or w.status = p_status);
end $$;

create or replace function public.iv_admin_withdrawal_act(p_id uuid, p_act text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare w public.iv_withdrawals;
begin
  select * into w from public.iv_withdrawals where id = p_id for update;
  if not found then raise exception 'Penarikan tidak ditemukan'; end if;
  if p_act in ('setujui','tolak') then
    perform public.iv_need('owner');
    if w.status <> 'diminta' then raise exception 'Penarikan tidak sedang menunggu persetujuan'; end if;
    if p_act = 'tolak' and coalesce(btrim(p_note), '') = '' then raise exception 'Tulis alasan penolakan'; end if;
    update public.iv_withdrawals set status = case p_act when 'setujui' then 'disetujui' else 'ditolak' end, decided_by = public.pk_me(), decided_at = now(),
      reason = nullif(btrim(p_note), '') where id = p_id;
  elsif p_act in ('dibayar','gagal') then
    if not (public.pk_role() = 'keuangan' or public.iv_is_owner()) then raise exception 'Hanya Keuangan'; end if;
    if w.status <> 'disetujui' then raise exception 'Penarikan harus disetujui CEO dulu'; end if;
    if w.decided_by = public.pk_me() then raise exception 'Yang menyetujui tidak bisa sekaligus menandai transfer'; end if;
    if p_act = 'dibayar' and coalesce(btrim(p_note), '') = '' then raise exception 'Isi nomor referensi transfer'; end if;
    update public.iv_withdrawals set status = p_act, paid_by = public.pk_me(), paid_at = case when p_act = 'dibayar' then now() end,
      ref = case when p_act = 'dibayar' then btrim(p_note) end, reason = case when p_act = 'gagal' then nullif(btrim(p_note), '') else reason end where id = p_id;
  else raise exception 'Aksi tidak dikenal'; end if;
  perform public.iv_log('tarik_' || p_act, p_id::text, p_note, jsonb_build_object('amount', w.amount, 'investor', w.investor_id));
end $$;

create or replace function public.iv_admin_offers() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.iv_need('view');
  return jsonb_build_object(
    'offers', (select coalesce(jsonb_agg(to_jsonb(o) || jsonb_build_object('unit', public.iv_unit_name(o.unit_code),
                 'leads', (select count(*) from public.iv_leads l where l.offer_id = o.id)) order by o.status, o.sort, o.created_at desc), '[]') from public.iv_offers o),
    'leads', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'wa', l.wa, 'unit', public.iv_unit_name(l.unit_code), 'offer', o.title,
                 'amount_hint', l.amount_hint, 'note', l.note, 'source', l.source, 'status', l.status, 'created_at', l.created_at, 'investor_id', l.investor_id,
                 'handled_by', (select nickname from public.pk_people where id = l.handled_by))
               order by case l.status when 'baru' then 0 when 'dihubungi' then 1 else 2 end, l.created_at desc), '[]')
              from public.iv_leads l left join public.iv_offers o on o.id = l.offer_id));
end $$;

create or replace function public.iv_admin_offer_save(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id', '')::uuid;
begin
  perform public.iv_need('biz');
  if length(btrim(coalesce(p->>'title', ''))) < 4 then raise exception 'Isi judul peluang'; end if;
  if coalesce(p->>'unit_code', '') not in ('RA','WG','NA','PK') then raise exception 'Pilih unit bisnis'; end if;
  if coalesce(p->>'jenis', '') not in ('aset','proyek','saham') then raise exception 'Pilih jenis'; end if;
  if v_id is null then
    insert into public.iv_offers(unit_code, jenis, title, summary, target_amount, min_amount, est_return, tenor_months, status, created_by)
    values (p->>'unit_code', p->>'jenis', btrim(p->>'title'), nullif(btrim(p->>'summary'), ''), nullif(p->>'target_amount', '')::numeric, nullif(p->>'min_amount', '')::numeric,
      nullif(btrim(p->>'est_return'), ''), nullif(p->>'tenor_months', '')::int, coalesce(nullif(p->>'status', ''), 'dibuka'), public.pk_me()) returning id into v_id;
  else
    update public.iv_offers set unit_code = p->>'unit_code', jenis = p->>'jenis', title = btrim(p->>'title'), summary = nullif(btrim(p->>'summary'), ''),
      target_amount = nullif(p->>'target_amount', '')::numeric, min_amount = nullif(p->>'min_amount', '')::numeric, est_return = nullif(btrim(p->>'est_return'), ''),
      tenor_months = nullif(p->>'tenor_months', '')::int, status = coalesce(nullif(p->>'status', ''), status), updated_at = now() where id = v_id;
  end if;
  perform public.iv_log('peluang', v_id::text, null, p);
  return v_id;
end $$;

create or replace function public.iv_admin_lead_set(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.iv_need('biz');
  if p_status not in ('baru','dihubungi','jadi_investor','batal') then raise exception 'Status tidak dikenal'; end if;
  update public.iv_leads set status = p_status, handled_by = public.pk_me(), updated_at = now() where id = p_id;
  perform public.iv_log('minat', p_id::text, p_status);
end $$;

create or replace function public.iv_admin_audit(p_limit int default 200) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.iv_need('view');
  return (select coalesce(jsonb_agg(jsonb_build_object('at', a.at, 'by', coalesce((select nickname from public.pk_people where id = a.by_person), 'Investor / sistem'),
      'action', substr(a.action, 4), 'target', a.target, 'reason', a.reason, 'data', a.data) order by a.at desc), '[]')
    from (select * from public.af_audit where action like 'iv\_%' order by at desc limit least(coalesce(p_limit, 200), 1000)) a);
end $$;

-- ================= hak eksekusi =================
do $g$ declare f record; begin
  for f in select p.oid::regprocedure sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'iv\_%' loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.proname in ('iv_calc','iv_balance','iv_holding_json','iv_log','iv_need','iv_unit_name') then
      execute format('revoke execute on function %s from authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $g$;
grant execute on function public.iv_public_interest(text, text, text, text) to anon;

-- ================= dokumen perjanjian (privat) =================
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('iv-docs', 'iv-docs', false, 10485760, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;
drop policy if exists iv_docs_read on storage.objects;
create policy iv_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'iv-docs' and (public.iv_can_view()
    or exists (select 1 from public.iv_holdings h where h.investor_id = public.iv_my_id() and h.doc_path = 'iv-docs/' || storage.objects.name)));
drop policy if exists iv_docs_write on storage.objects;
create policy iv_docs_write on storage.objects for insert to authenticated
  with check (bucket_id = 'iv-docs' and (public.iv_is_biz() or public.iv_is_fin())
    and exists (select 1 from public.iv_holdings h where h.id::text = (storage.foldername(name))[1] and h.status in ('draf','ditolak')));
drop policy if exists iv_docs_upd on storage.objects;
create policy iv_docs_upd on storage.objects for update to authenticated
  using (bucket_id = 'iv-docs' and (public.iv_is_biz() or public.iv_is_fin())
    and exists (select 1 from public.iv_holdings h where h.id::text = (storage.foldername(name))[1] and h.status in ('draf','ditolak')));

commit;
