-- 023: Program Mitra Affiliate Pokama (semua unit; mulai Rentalaja).
-- Pokama memegang data mitra, perhitungan komisi, gamifikasi, panel BizDev, dan pencairan.
-- Aplikasi unit hanya: (1) mengambil daftar kode aktif, (2) mengirim event booking. Lihat edge function af-api.
-- Semua objek berawalan af_ dan tidak mengubah tabel lain. Batalkan dengan 023_af_mitra_down.sql.

-- ================= tabel =================
create table if not exists public.af_units (
  code text primary key references public.pk_units(code),
  name text not null,
  ref_base text,                      -- mis. https://rentalaja.co.id/?ref=
  logo text,                          -- path gambar di pokama.org
  is_active boolean not null default true,
  sort int not null default 0
);
create table if not exists public.af_unit_keys (
  unit_code text primary key references public.af_units(code) on delete cascade,
  key_hash text not null,
  hint text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.af_rates (
  unit_code text not null references public.af_units(code) on delete cascade,
  cat text not null check (cat ~ '^[a-z0-9_]{2,30}$'),
  label text not null,
  pct numeric(5,2) not null check (pct >= 0 and pct <= 50),
  sort int not null default 0,
  primary key (unit_code, cat)
);
create table if not exists public.af_settings (
  key text primary key,
  value jsonb not null,
  note text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
create table if not exists public.af_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  email text not null,
  name text not null,
  org text,
  kind text not null check (kind in ('penginapan','travel','kantor','komunitas','kampus','kreator')),
  city text not null check (city in ('Garut','Bandung','Ciputat')),
  wa text not null,
  wa_hash text,
  status text not null default 'menunggu' check (status in ('menunggu','aktif','ditolak','nonaktif')),
  code text unique check (code ~ '^[A-Z0-9]{4,8}$'),
  guest_discount boolean not null default false,
  is_internal boolean not null default false,        -- mis. mitra TripinAja: dicatat rujukan internal grup, tanpa komisi uang
  bank_name text, bank_acct text, bank_holder text,
  nik text, npwp text, nik_hash text,
  address text, maps_url text,
  violations int not null default 0,
  reason text,                                       -- alasan ditolak / dinonaktifkan
  demo boolean not null default false,
  agreed_at timestamptz,
  approved_at timestamptz, approved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists af_partners_email on public.af_partners (lower(email)) where status <> 'ditolak';
create index if not exists af_partners_status on public.af_partners (status);
create table if not exists public.af_partner_rates (
  partner_id uuid not null references public.af_partners(id) on delete cascade,
  unit_code text not null references public.af_units(code),
  cat text not null,
  pct numeric(5,2) not null check (pct >= 0 and pct <= 50),
  set_by uuid, set_at timestamptz not null default now(),
  primary key (partner_id, unit_code, cat)
);
create table if not exists public.af_events (
  id bigserial primary key,
  unit_code text not null references public.af_units(code),
  event_key text not null unique,
  booking_id text not null,
  status text not null,
  payload jsonb not null,
  result text,
  demo boolean not null default false,
  received_at timestamptz not null default now()
);
create table if not exists public.af_payouts (
  id uuid primary key default gen_random_uuid(),
  period date not null,                               -- bulan rekap (tanggal 1 bulan yang ditutup)
  partner_id uuid not null references public.af_partners(id),
  commission numeric(14,2) not null default 0,
  rewards numeric(14,2) not null default 0,
  gross numeric(14,2) not null,
  tax_pct numeric(5,2) not null default 0,
  tax numeric(14,2) not null default 0,
  net numeric(14,2) not null,
  bank text,                                          -- salinan rekening saat rekap
  items int not null default 0,
  status text not null default 'diajukan' check (status in ('diajukan','disetujui','ditransfer','ditolak')),
  approved_by uuid, approved_at timestamptz,
  transferred_by uuid, transferred_at timestamptz, proof_url text,
  note text,
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (period, partner_id)
);
create table if not exists public.af_bookings (
  id uuid primary key default gen_random_uuid(),
  unit_code text not null references public.af_units(code),
  booking_id text not null,
  partner_id uuid references public.af_partners(id),
  code text,
  cat text,
  product text,
  net_amount numeric(14,2) not null default 0,
  ext_amount numeric(14,2) not null default 0,
  repeat_cust boolean not null default false,
  source text,                                        -- web / app / ota / dll
  cust_nik_hash text, cust_wa_hash text,
  guest text,                                         -- nama tamu yang sudah disamarkan
  guest_disc boolean not null default false,
  bk_status text not null default 'dibayar' check (bk_status in ('dibayar','selesai','batal','refund','ditolak')),
  issue boolean not null default false,               -- unit menandai ada denda/keluhan
  blacklist boolean not null default false,
  booked_at timestamptz,
  completed_at timestamptz,
  tier text, rate_base numeric(5,2), rate_bonus numeric(5,2), rate_final numeric(5,2),
  commission numeric(14,2) not null default 0,
  comm_status text not null default 'tertunda' check (comm_status in ('tertunda','siap_cair','dicairkan','hangus','dibekukan','internal','nol')),
  comm_note text,
  frozen boolean not null default false,
  frozen_reason text,
  self_ref boolean not null default false,
  payout_id uuid references public.af_payouts(id),
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_code, booking_id)
);
create index if not exists af_bookings_partner on public.af_bookings (partner_id, completed_at);
create index if not exists af_bookings_status on public.af_bookings (comm_status);
create table if not exists public.af_tiers (
  partner_id uuid not null references public.af_partners(id) on delete cascade,
  month date not null,                                -- berlaku untuk bulan ini
  tier text not null,
  done3m int not null default 0,
  streak int not null default 0,
  protected boolean not null default false,
  primary key (partner_id, month)
);
create table if not exists public.af_challenges (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  title text not null,
  unit_code text references public.af_units(code),
  cat text,
  target int not null check (target > 0),
  reward_type text not null default 'tunai' check (reward_type in ('tunai','saldo')),
  reward_amount numeric(14,2) not null default 0 check (reward_amount >= 0),
  is_active boolean not null default true,
  demo boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.af_rank_prizes (
  month date not null,
  rank int not null check (rank between 1 and 3),
  amount numeric(14,2) not null default 0,
  primary key (month, rank)
);
create table if not exists public.af_ranks (
  month date not null,
  demo boolean not null default false,
  city text not null,
  kind text not null,
  rank int not null,
  partner_id uuid not null references public.af_partners(id) on delete cascade,
  done int not null,
  primary key (month, demo, city, kind, rank)
);
create table if not exists public.af_rewards (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.af_partners(id) on delete cascade,
  month date not null,
  kind text not null check (kind in ('tantangan','juara')),
  ref text not null,                                  -- id tantangan / 'rank-<city>-<kind>-<n>'
  title text not null,
  reward_type text not null default 'tunai',
  amount numeric(14,2) not null,
  status text not null default 'siap_cair' check (status in ('siap_cair','dicairkan','ditolak')),
  reason text,
  payout_id uuid references public.af_payouts(id),
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (partner_id, kind, ref)
);
create table if not exists public.af_badges (
  partner_id uuid not null references public.af_partners(id) on delete cascade,
  badge text not null,
  at timestamptz not null default now(),
  primary key (partner_id, badge)
);
create table if not exists public.af_month_close (
  month date not null,
  demo boolean not null default false,
  revenue numeric(14,2) not null default 0,
  commission numeric(14,2) not null default 0,
  reward_budget numeric(14,2) not null default 0,
  reward_used numeric(14,2) not null default 0,
  over_budget boolean not null default false,
  payouts int not null default 0,
  closed_by uuid,
  closed_at timestamptz not null default now(),
  primary key (month, demo)
);
create table if not exists public.af_audit (
  id bigserial primary key,
  at timestamptz not null default now(),
  by_person uuid,
  action text not null,
  target text,
  reason text,
  data jsonb
);
create table if not exists public.af_notifs (
  id bigserial primary key,
  partner_id uuid not null references public.af_partners(id) on delete cascade,
  kind text not null,
  text text not null,
  sent_at timestamptz,
  sent_by uuid,
  demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists af_notifs_open on public.af_notifs (sent_at) where sent_at is null;

-- ================= data awal =================
insert into public.af_units(code, name, ref_base, logo, sort) values
  ('RA', 'Rentalaja', 'https://rentalaja.co.id/?ref=', '/img/ra.png', 1),
  ('WG', 'TripinAja', null, '/img/tr.png', 2),
  ('NA', 'Niagaaja', null, '/img/na.png', 3)
on conflict (code) do nothing;
update public.af_units set is_active = (code = 'RA') where code in ('WG','NA') and not exists (select 1 from public.af_rates r where r.unit_code = af_units.code);
insert into public.af_rates(unit_code, cat, label, pct, sort) values
  ('RA','motor','Motor',5,1), ('RA','mobil','Mobil',5,2), ('RA','iphone','iPhone',7,3), ('RA','kamera','Kamera',7,4),
  ('RA','proyektor','Proyektor',7,5), ('RA','ps','PlayStation',7,6), ('RA','camping','Alat camping',7,7),
  ('RA','penginapan','Penginapan',5,8), ('RA','jeep','Jeep trip',7,9)
on conflict do nothing;
insert into public.af_settings(key, value, note) values
  ('tiers', '[{"name":"Mitra","min":0,"bonus":0},{"name":"Mitra Pilihan","min":10,"bonus":2},{"name":"Mitra Utama","min":30,"bonus":3}]', 'Tingkat dari booking selesai 3 bulan terakhir, lintas unit'),
  ('returning_factor', '0.5', 'Pelanggan lama: komisi x faktor ini'),
  ('guest_discount_pct', '5', 'Potongan untuk tamu bila mitra menyalakan; memotong komisi'),
  ('min_payout', '50000', 'Minimal pencairan (Rp); kurang dari ini dibawa ke bulan berikutnya'),
  ('reward_budget_pct', '2', 'Anggaran hadiah gamifikasi, % pendapatan affiliate bulan itu'),
  ('cost_cap_pct', '10', 'Batas biaya komisi + hadiah, % pendapatan affiliate'),
  ('tax', '{"kind":"Belum diatur (menunggu konsultan pajak)","pct":0}', 'Potongan pajak pencairan'),
  ('bizdev_ids', '["8c65e638-4cff-47dc-bbae-72158ce3e747","ee86fba6-9e6d-48d9-bc06-0082b4076412"]', 'Orang yang boleh mengelola mitra (selain CEO & Kepala Staf)')
on conflict (key) do nothing;

-- ================= peran =================
create or replace function public.af_is_fin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.pk_role() in ('keuangan','ceo'), false)
$$;
create or replace function public.af_is_biz() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.pk_role() in ('ceo','kepala_staf'), false)
      or coalesce((select value ? public.pk_me()::text from public.af_settings where key = 'bizdev_ids'), false)
$$;
create or replace function public.af_can_view() returns boolean language sql stable security definer set search_path = public as $$
  select public.af_is_biz() or public.af_is_fin()
$$;
create or replace function public.af_my_partner() returns uuid language sql stable security definer set search_path = public as $$
  select id from public.af_partners where user_id = auth.uid() and auth.uid() is not null limit 1
$$;
create or replace function public.af_set(k text) returns jsonb language sql stable security definer set search_path = public as $$
  select value from public.af_settings where key = k
$$;

-- ================= pembantu =================
create or replace function public.af_norm_wa(p text) returns text language sql immutable as $$
  select case when d like '0%' then '62' || substr(d, 2) when d like '8%' then '62' || d else d end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') d) x
$$;
create or replace function public.af_hash(p text) returns text language sql immutable set search_path = public, extensions as $$
  select case when coalesce(p, '') = '' then null else encode(extensions.digest(p, 'sha256'), 'hex') end
$$;
create or replace function public.af_mask(p text) returns text language sql immutable as $$
  select case when coalesce(btrim(p), '') = '' then null
              when length(btrim(p)) <= 2 then left(btrim(p), 1) || '*'
              else left(btrim(p), 1) || '***' || right(split_part(btrim(p), ' ', 1), 1) end
$$;
create or replace function public.af_month(d timestamptz default now()) returns date language sql stable as $$
  select date_trunc('month', (coalesce(d, now()) at time zone 'Asia/Jakarta'))::date
$$;
create or replace function public.af_log(p_action text, p_target text, p_reason text default null, p_data jsonb default null) returns void
language sql security definer set search_path = public as $$
  insert into public.af_audit(by_person, action, target, reason, data) values (public.pk_me(), p_action, p_target, p_reason, p_data)
$$;
create or replace function public.af_notify(p_partner uuid, p_kind text, p_text text) returns void
language sql security definer set search_path = public as $$
  insert into public.af_notifs(partner_id, kind, text, demo) select p_partner, p_kind, p_text, demo from public.af_partners where id = p_partner
$$;

-- tingkat yang berlaku bulan ini (dievaluasi tiap tanggal 1); belum dievaluasi = Mitra
create or replace function public.af_tier_now(p uuid) returns jsonb language sql stable security definer set search_path = public as $$
  with t as (select tier from public.af_tiers where partner_id = p and month <= public.af_month() order by month desc limit 1),
       d as (select x from jsonb_array_elements(public.af_set('tiers')) x)
  select coalesce((select x from d where x->>'name' = (select tier from t)), (select x from d where (x->>'min')::int = 0 limit 1))
$$;

-- booking selesai sah (untuk tingkat, tantangan, peringkat)
create or replace function public.af_done(b public.af_bookings) returns boolean language sql immutable as $$
  select b.bk_status = 'selesai' and b.comm_status in ('siap_cair','dicairkan') and not b.frozen
$$;

-- ================= mesin komisi =================
create or replace function public.af_compute(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b public.af_bookings; pr public.af_partners; base numeric; bonus numeric := 0; tr jsonb; fin numeric; st text; note text;
  retf numeric := coalesce((public.af_set('returning_factor'))::text::numeric, 0.5);
  gd numeric := coalesce((public.af_set('guest_discount_pct'))::text::numeric, 5);
  prev text; comm numeric := 0;
begin
  select * into b from public.af_bookings where id = p_id for update;
  if b.id is null then return; end if;
  prev := b.comm_status;
  if prev = 'dicairkan' then
    if b.bk_status in ('batal','refund','ditolak') then
      update public.af_bookings set comm_note = 'Booking ' || b.bk_status || ' setelah komisi dicairkan, perlu dicek Keuangan', updated_at = now() where id = p_id;
    end if;
    return;
  end if;
  if b.partner_id is not null then select * into pr from public.af_partners where id = b.partner_id; end if;

  if pr.id is null then st := 'nol'; note := 'Kode tidak dikenal / mitra tidak aktif';
  elsif pr.is_internal then st := 'internal'; note := 'Rujukan internal grup, tanpa komisi uang';
  elsif lower(coalesce(b.source, '')) = 'ota' then st := 'nol'; note := 'Booking lewat OTA tidak berkomisi';
  elsif b.bk_status in ('batal','refund','ditolak') or b.blacklist then st := 'hangus';
    note := case when b.blacklist then 'Pemesan masuk daftar hitam' else 'Booking ' || b.bk_status end;
  elsif b.self_ref then st := 'dibekukan'; note := coalesce(b.frozen_reason, 'NIK/HP pemesan sama dengan mitra');
  else
    select pct into base from public.af_partner_rates where partner_id = pr.id and unit_code = b.unit_code and cat = b.cat;
    if base is null then select pct into base from public.af_rates where unit_code = b.unit_code and cat = b.cat; end if;
    base := coalesce(base, 0);
    tr := public.af_tier_now(pr.id); bonus := coalesce((tr->>'bonus')::numeric, 0);
    fin := (base + bonus) * case when b.repeat_cust then retf else 1 end - case when b.guest_disc then gd else 0 end;
    fin := greatest(fin, 0);
    comm := round((b.net_amount + b.ext_amount) * fin / 100);
    if b.frozen then st := 'dibekukan'; note := b.frozen_reason;
    elsif b.bk_status = 'selesai' and not b.issue then st := 'siap_cair'; note := null;
    else st := 'tertunda'; note := case when b.issue then 'Menunggu denda/keluhan selesai' end;
    end if;
    update public.af_bookings set tier = tr->>'name', rate_base = base, rate_bonus = bonus, rate_final = fin, commission = comm,
      comm_status = st, comm_note = note, updated_at = now() where id = p_id;
    if st = 'siap_cair' and prev is distinct from 'siap_cair' then
      perform public.af_notify(pr.id, 'siap_cair', 'Komisi ' || to_char(comm, 'FM999G999G999') || ' dari booking ' || b.booking_id || ' siap cair.');
    end if;
    return;
  end if;
  update public.af_bookings set commission = 0, rate_final = 0, comm_status = st, comm_note = note, updated_at = now() where id = p_id;
end $$;

-- satu event dari aplikasi unit; idempoten lewat event_key
create or replace function public.af_ingest(p_unit text, ev jsonb, p_demo boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k text; st text; bid text; pr public.af_partners; b public.af_bookings; amt numeric; t timestamptz; v_code text; res text;
  allowed text[] := array['dibayar','selesai','batal','refund','perpanjang','ditolak'];
begin
  bid := nullif(btrim(coalesce(ev->>'booking_id', ev->>'id_booking', '')), '');
  st := lower(coalesce(ev->>'status', ''));
  if bid is null then raise exception 'booking_id wajib diisi'; end if;
  if not st = any(allowed) then raise exception 'status "%" tidak dikenal. Pilihan: %', st, array_to_string(allowed, ', '); end if;
  t := coalesce((ev->>'waktu')::timestamptz, (ev->>'time')::timestamptz, now());
  k := p_unit || '|' || coalesce(nullif(ev->>'event_id', ''), bid || '|' || st || '|' || to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'));
  begin
    insert into public.af_events(unit_code, event_key, booking_id, status, payload, demo) values (p_unit, k, bid, st, ev, p_demo);
  exception when unique_violation then
    return jsonb_build_object('booking_id', bid, 'status', st, 'duplicate', true, 'result', 'sudah tercatat');
  end;
  amt := nullif(ev->>'nilai_bersih', '')::numeric;
  v_code := upper(nullif(btrim(coalesce(ev->>'kode', ev->>'code', '')), ''));
  select * into b from public.af_bookings where unit_code = p_unit and booking_id = bid for update;

  if b.id is null then
    if st = 'perpanjang' then raise exception 'perpanjang untuk booking % yang belum tercatat; kirim dibayar dulu', bid; end if;
    if v_code is not null then select * into pr from public.af_partners x where x.code = v_code and x.status = 'aktif'; end if;
    if v_code is null then
      update public.af_events set result = 'tanpa kode, diabaikan' where event_key = k;
      return jsonb_build_object('booking_id', bid, 'status', st, 'result', 'tanpa kode, diabaikan');
    end if;
    insert into public.af_bookings(unit_code, booking_id, partner_id, code, cat, product, net_amount, repeat_cust, source, cust_nik_hash, cust_wa_hash,
      guest, guest_disc, bk_status, booked_at, completed_at, blacklist, issue, demo)
    values (p_unit, bid, pr.id, v_code, lower(nullif(ev->>'kategori', '')), nullif(ev->>'produk', ''), coalesce(amt, 0),
      coalesce((ev->>'pelanggan_lama')::boolean, false), lower(nullif(ev->>'sumber', '')),
      lower(nullif(ev->>'hash_nik', '')), lower(nullif(ev->>'hash_hp', '')), public.af_mask(ev->>'nama_tamu'),
      coalesce(pr.guest_discount, false), case when st = 'perpanjang' then 'dibayar' else st end, t,
      case when st = 'selesai' then t end, coalesce((ev->>'daftar_hitam')::boolean, false), coalesce((ev->>'ada_masalah')::boolean, false),
      p_demo or coalesce(pr.demo, false))
    returning * into b;
    if pr.id is not null then
      perform public.af_notify(pr.id, 'booking', 'Booking baru ' || coalesce(nullif(ev->>'produk', ''), b.cat, '') || ' dari kode ' || v_code || '. Komisi dihitung setelah selesai.');
    end if;
  else
    if st = 'perpanjang' then
      update public.af_bookings set ext_amount = ext_amount + coalesce(amt, 0), updated_at = now() where id = b.id;
    else
      update public.af_bookings set bk_status = st,
        net_amount = case when st in ('dibayar','selesai') and amt is not null then amt else net_amount end,
        completed_at = case when st = 'selesai' then t else completed_at end,
        repeat_cust = coalesce((ev->>'pelanggan_lama')::boolean, repeat_cust),
        cust_nik_hash = coalesce(lower(nullif(ev->>'hash_nik', '')), cust_nik_hash),
        cust_wa_hash = coalesce(lower(nullif(ev->>'hash_hp', '')), cust_wa_hash),
        blacklist = blacklist or coalesce((ev->>'daftar_hitam')::boolean, false),
        issue = coalesce((ev->>'ada_masalah')::boolean, case when st = 'selesai' then false else issue end),
        source = coalesce(lower(nullif(ev->>'sumber', '')), source),
        updated_at = now()
      where id = b.id;
    end if;
  end if;

  -- pengaman: pemesan = mitra sendiri
  select * into b from public.af_bookings where id = b.id;
  if b.partner_id is not null and not b.self_ref then
    select * into pr from public.af_partners where id = b.partner_id;
    if (b.cust_nik_hash is not null and b.cust_nik_hash = pr.nik_hash) or (b.cust_wa_hash is not null and b.cust_wa_hash = pr.wa_hash) then
      update public.af_bookings set self_ref = true, frozen = true,
        frozen_reason = case when b.cust_nik_hash = pr.nik_hash then 'NIK pemesan sama dengan mitra' else 'Nomor HP pemesan sama dengan mitra' end
      where id = b.id;
      perform public.af_log('auto_bekukan', b.id::text, 'Self-referral terdeteksi', jsonb_build_object('booking', b.booking_id, 'unit', p_unit));
    end if;
  end if;
  perform public.af_compute(b.id);
  select comm_status into res from public.af_bookings where id = b.id;
  update public.af_events set result = res where event_key = k;
  return jsonb_build_object('booking_id', bid, 'status', st, 'komisi_status', res);
end $$;

-- ================= API unit =================
create or replace function public.af_unit_by_key(p_key text) returns text language sql stable security definer set search_path = public, extensions as $$
  select k.unit_code from public.af_unit_keys k join public.af_units u on u.code = k.unit_code
  where u.is_active and k.key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex')
$$;
create or replace function public.af_api_codes(p_unit text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('unit', p_unit, 'generated_at', now(), 'codes', coalesce(jsonb_agg(jsonb_build_object(
    'kode', p.code, 'nama_mitra', coalesce(nullif(p.org, ''), p.name), 'jenis', p.kind, 'kota', p.city,
    'potongan_tamu', p.guest_discount, 'potongan_tamu_pct', case when p.guest_discount then (public.af_set('guest_discount_pct'))::text::numeric else 0 end,
    'alamat', p.address, 'maps', p.maps_url, 'internal', p.is_internal,
    'produk', (select coalesce(jsonb_agg(r.cat order by r.sort), '[]'::jsonb) from public.af_rates r where r.unit_code = p_unit)
  ) order by p.code), '[]'::jsonb))
  from public.af_partners p where p.status = 'aktif' and not p.demo
$$;
create or replace function public.af_api_events(p_unit text, p_events jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ev jsonb; out jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_events) = 'object' then p_events := jsonb_build_array(p_events); end if;
  if jsonb_array_length(coalesce(p_events, '[]'::jsonb)) > 500 then raise exception 'Maksimal 500 event per kiriman'; end if;
  for ev in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) loop
    begin
      out := out || public.af_ingest(p_unit, ev, false);
    exception when others then
      out := out || jsonb_build_object('booking_id', ev->>'booking_id', 'status', ev->>'status', 'ditolak', true, 'error', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('unit', p_unit, 'results', out);
end $$;
create or replace function public.af_api_featured(p_unit text default null) returns jsonb language sql stable security definer set search_path = public as $$
  with m as (select max(month) mm from public.af_ranks r where not r.demo)
  select jsonb_build_object('bulan', to_char((select mm from m), 'YYYY-MM'), 'mitra', coalesce(jsonb_agg(jsonb_build_object(
    'peringkat', r.rank, 'nama', coalesce(nullif(p.org, ''), p.name), 'jenis', r.kind, 'kota', r.city, 'kode', p.code, 'alamat', p.address
  ) order by r.city, r.kind, r.rank), '[]'::jsonb))
  from public.af_ranks r join public.af_partners p on p.id = r.partner_id
  where r.month = (select mm from m) and not r.demo and p.status = 'aktif' and not p.demo
$$;

-- ================= pendaftaran publik =================
create or replace function public.af_register(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare em text := lower(btrim(coalesce(p->>'email', ''))); wa text := public.af_norm_wa(p->>'wa'); v_id uuid;
begin
  if coalesce(btrim(p->>'name'), '') = '' then raise exception 'Nama wajib diisi'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Email belum benar'; end if;
  if length(wa) < 10 or length(wa) > 15 then raise exception 'Nomor WhatsApp belum benar'; end if;
  if not coalesce((p->>'agree')::boolean, false) then raise exception 'Setujui syarat program dulu'; end if;
  if exists (select 1 from public.pk_people x where x.is_active and (lower(x.email) = em or public.af_norm_wa(x.phone) = wa)) then
    raise exception 'Staf grup Pokama tidak bisa menjadi mitra';
  end if;
  if exists (select 1 from public.af_partners x where lower(x.email) = em and x.status <> 'ditolak') then
    raise exception 'Email ini sudah terdaftar. Silakan masuk.';
  end if;
  if (select count(*) from public.af_partners where created_at > now() - interval '1 hour') > 40 then
    raise exception 'Terlalu banyak pendaftaran. Coba lagi sebentar.';
  end if;
  insert into public.af_partners(email, name, org, kind, city, wa, wa_hash, agreed_at)
  values (em, btrim(p->>'name'), nullif(btrim(coalesce(p->>'org', '')), ''), p->>'kind', p->>'city', wa, public.af_hash(wa), now())
  returning af_partners.id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- mitra login pertama: ikat akun email ke data mitra
create or replace function public.af_link_me() returns jsonb
language plpgsql security definer set search_path = public as $$
declare em text := lower(coalesce(auth.jwt()->>'email', '')); r public.af_partners;
begin
  if auth.uid() is null then raise exception 'Belum masuk'; end if;
  select * into r from public.af_partners where user_id = auth.uid();
  if r.id is null then
    select * into r from public.af_partners where lower(email) = em and user_id is null and status <> 'ditolak' order by created_at desc limit 1;
    if r.id is not null then update public.af_partners set user_id = auth.uid() where id = r.id; end if;
  end if;
  if r.id is null then return jsonb_build_object('found', false); end if;
  return jsonb_build_object('found', true, 'status', r.status, 'reason', r.reason);
end $$;

-- ================= portal mitra =================
create or replace function public.af_me() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare pid uuid := public.af_my_partner(); p public.af_partners; m date := public.af_month(); tr jsonb; tiers jsonb := public.af_set('tiers');
  done3 int; nxt jsonb; streak int := 0; mm date; res jsonb;
begin
  if pid is null then raise exception 'Akun mitra tidak ditemukan'; end if;
  select * into p from public.af_partners where id = pid;
  tr := public.af_tier_now(pid);
  select count(*) into done3 from public.af_bookings b where b.partner_id = pid and public.af_done(b) and b.completed_at >= (m - interval '2 month');
  select x into nxt from jsonb_array_elements(tiers) x where (x->>'min')::int > (tr->>'min')::int order by (x->>'min')::int limit 1;
  mm := m - interval '1 month';
  loop
    exit when not exists (select 1 from public.af_bookings b where b.partner_id = pid and public.af_done(b) and public.af_month(b.completed_at) = mm);
    streak := streak + 1; mm := mm - interval '1 month';
    exit when streak > 36;
  end loop;
  if exists (select 1 from public.af_bookings b where b.partner_id = pid and public.af_done(b) and public.af_month(b.completed_at) = m) then streak := streak + 1; end if;
  res := jsonb_build_object(
    'partner', jsonb_build_object('id', p.id, 'name', p.name, 'org', p.org, 'kind', p.kind, 'city', p.city, 'wa', p.wa, 'email', p.email,
      'status', p.status, 'reason', p.reason, 'code', p.code, 'guest_discount', p.guest_discount, 'is_internal', p.is_internal,
      'bank_name', p.bank_name, 'bank_acct', p.bank_acct, 'bank_holder', p.bank_holder,
      'nik_set', p.nik is not null, 'nik_tail', right(p.nik, 4), 'npwp', p.npwp, 'address', p.address, 'maps_url', p.maps_url, 'demo', p.demo),
    'tier', tr, 'next_tier', nxt, 'done3m', done3, 'streak', streak,
    'protected', coalesce((select protected from public.af_tiers where partner_id = pid and month = m), false),
    'units', (select coalesce(jsonb_agg(jsonb_build_object('code', u.code, 'name', u.name, 'logo', u.logo, 'link', case when u.ref_base is not null and p.code is not null then u.ref_base || p.code end,
        'rates', (select coalesce(jsonb_agg(jsonb_build_object('cat', r.cat, 'label', r.label, 'pct', coalesce(pr.pct, r.pct)) order by r.sort), '[]'::jsonb)
                  from public.af_rates r left join public.af_partner_rates pr on pr.partner_id = pid and pr.unit_code = r.unit_code and pr.cat = r.cat where r.unit_code = u.code)) order by u.sort), '[]'::jsonb)
      from public.af_units u where u.is_active),
    'balance', jsonb_build_object(
      'siap_cair', (select coalesce(sum(commission), 0) from public.af_bookings where partner_id = pid and comm_status = 'siap_cair')
                 + (select coalesce(sum(amount), 0) from public.af_rewards where partner_id = pid and status = 'siap_cair'),
      'tertunda', (select coalesce(sum(commission), 0) from public.af_bookings where partner_id = pid and comm_status = 'tertunda'),
      'tertunda_n', (select count(*) from public.af_bookings where partner_id = pid and comm_status = 'tertunda'),
      'dicairkan', (select coalesce(sum(net), 0) from public.af_payouts where partner_id = pid and status = 'ditransfer')),
    'month', jsonb_build_object('booking', (select count(*) from public.af_bookings where partner_id = pid and public.af_month(booked_at) = m),
      'selesai', (select count(*) from public.af_bookings b where partner_id = pid and public.af_done(b) and public.af_month(b.completed_at) = m),
      'komisi', (select coalesce(sum(commission), 0) from public.af_bookings where partner_id = pid and public.af_month(booked_at) = m and comm_status in ('tertunda','siap_cair','dicairkan'))),
    'bookings', (select coalesce(jsonb_agg(x order by x->>'at' desc), '[]'::jsonb) from (
      select jsonb_build_object('id', b.id, 'unit', b.unit_code, 'booking_id', b.booking_id, 'cat', b.cat, 'product', coalesce(b.product, r.label, b.cat),
        'guest', b.guest, 'amount', b.net_amount + b.ext_amount, 'rate', b.rate_final, 'commission', b.commission, 'status', b.comm_status,
        'bk_status', b.bk_status, 'note', b.comm_note, 'returning', b.repeat_cust, 'at', coalesce(b.completed_at, b.booked_at), 'completed_at', b.completed_at) x
      from public.af_bookings b left join public.af_rates r on r.unit_code = b.unit_code and r.cat = b.cat
      where b.partner_id = pid order by coalesce(b.completed_at, b.booked_at) desc limit 200) q),
    'rewards', (select coalesce(jsonb_agg(jsonb_build_object('title', w.title, 'amount', w.amount, 'status', w.status, 'month', w.month, 'type', w.reward_type) order by w.created_at desc), '[]'::jsonb)
      from public.af_rewards w where w.partner_id = pid),
    'payouts', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'period', o.period, 'net', o.net, 'gross', o.gross, 'tax', o.tax, 'items', o.items,
        'status', o.status, 'transferred_at', o.transferred_at, 'proof_url', o.proof_url) order by o.period desc), '[]'::jsonb) from public.af_payouts o where o.partner_id = pid),
    'challenges', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'target', c.target, 'reward_type', c.reward_type, 'reward_amount', c.reward_amount,
        'unit', c.unit_code, 'cat', c.cat, 'month', c.month,
        'progress', (select count(*) from public.af_bookings b where b.partner_id = pid and public.af_done(b) and public.af_month(b.completed_at) = c.month
                       and (c.unit_code is null or b.unit_code = c.unit_code) and (c.cat is null or b.cat = c.cat))) order by c.created_at), '[]'::jsonb)
      from public.af_challenges c where c.month = m and c.is_active and (c.demo = p.demo or not c.demo)),
    'board', (select coalesce(jsonb_agg(jsonb_build_object('rank', rk, 'name', nm, 'done', dn, 'me', pid2 = pid) order by rk), '[]'::jsonb) from (
      select row_number() over (order by count(b.id) desc, min(b.completed_at)) rk, coalesce(nullif(x.org, ''), x.name) nm, count(b.id) dn, x.id pid2
      from public.af_partners x left join public.af_bookings b on b.partner_id = x.id and public.af_done(b) and public.af_month(b.completed_at) = m
      where x.status = 'aktif' and x.city = p.city and x.kind = p.kind and x.demo = p.demo and not x.is_internal
      group by x.id, x.org, x.name) q where rk <= 10 or pid2 = pid),
    'prizes', (select coalesce(jsonb_object_agg(rank, amount), '{}'::jsonb) from public.af_rank_prizes where month = m),
    'badges', (select coalesce(jsonb_agg(badge), '[]'::jsonb) from public.af_badges where partner_id = pid),
    'rules', jsonb_build_object('min_payout', public.af_set('min_payout'), 'guest_discount_pct', public.af_set('guest_discount_pct'), 'tiers', tiers, 'tax', public.af_set('tax')));
  return res;
end $$;

create or replace function public.af_me_update(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid := public.af_my_partner(); nk text;
begin
  if pid is null then raise exception 'Akun mitra tidak ditemukan'; end if;
  nk := nullif(regexp_replace(coalesce(p->>'nik', ''), '\D', '', 'g'), '');
  if nk is not null and length(nk) <> 16 then raise exception 'NIK harus 16 digit'; end if;
  update public.af_partners set
    bank_name = coalesce(nullif(btrim(p->>'bank_name'), ''), bank_name),
    bank_acct = coalesce(nullif(regexp_replace(coalesce(p->>'bank_acct', ''), '[^0-9]', '', 'g'), ''), bank_acct),
    bank_holder = coalesce(nullif(btrim(p->>'bank_holder'), ''), bank_holder),
    nik = coalesce(nk, nik), nik_hash = coalesce(public.af_hash(nk), nik_hash),
    npwp = coalesce(nullif(btrim(p->>'npwp'), ''), npwp),
    address = coalesce(nullif(btrim(p->>'address'), ''), address),
    maps_url = coalesce(nullif(btrim(p->>'maps_url'), ''), maps_url),
    guest_discount = coalesce((p->>'guest_discount')::boolean, guest_discount),
    updated_at = now()
  where id = pid;
end $$;

-- ================= panel BizDev =================
create or replace function public.af_need(biz boolean, fin boolean) returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not ((biz and public.af_is_biz()) or (fin and public.af_is_fin())) then raise exception 'Tidak punya akses'; end if;
end $$;

create or replace function public.af_admin_overview(p_month date default null, p_city text default null, p_unit text default null, p_kind text default null, p_demo boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m date := coalesce(p_month, public.af_month()); res jsonb; rev numeric; comm numeric; rw numeric; capp numeric := (public.af_set('cost_cap_pct'))::text::numeric;
  bud numeric := (public.af_set('reward_budget_pct'))::text::numeric;
begin
  perform public.af_need(true, true);
  create temp table if not exists _afb on commit drop as select b.*, x.city, x.kind from public.af_bookings b join public.af_partners x on x.id = b.partner_id where false;
  truncate _afb;
  insert into _afb select b.*, x.city, x.kind from public.af_bookings b join public.af_partners x on x.id = b.partner_id
    where b.demo = p_demo and (p_city is null or x.city = p_city) and (p_unit is null or b.unit_code = p_unit) and (p_kind is null or x.kind = p_kind);
  select coalesce(sum(net_amount + ext_amount), 0), coalesce(sum(commission), 0) into rev, comm from _afb b
    where b.bk_status = 'selesai' and b.comm_status in ('siap_cair','dicairkan') and public.af_month(b.completed_at) = m;
  select coalesce(sum(amount), 0) into rw from public.af_rewards w join public.af_partners x on x.id = w.partner_id
    where w.month = m and w.status <> 'ditolak' and w.demo = p_demo and (p_city is null or x.city = p_city) and (p_kind is null or x.kind = p_kind);
  res := jsonb_build_object(
    'month', m,
    'partners', jsonb_build_object(
      'aktif', (select count(*) from public.af_partners x where x.status = 'aktif' and x.demo = p_demo and (p_city is null or x.city = p_city) and (p_kind is null or x.kind = p_kind)),
      'produktif', (select count(distinct partner_id) from _afb b where public.af_month(b.completed_at) = m and b.bk_status = 'selesai'),
      'menunggu', (select count(*) from public.af_partners x where x.status = 'menunggu' and x.demo = p_demo),
      'terdaftar', (select count(*) from public.af_partners x where x.status in ('aktif','nonaktif') and x.demo = p_demo)),
    'booking', (select count(*) from _afb b where public.af_month(b.booked_at) = m),
    'selesai', (select count(*) from _afb b where public.af_month(b.completed_at) = m and b.bk_status = 'selesai'),
    'revenue', rev, 'commission', comm, 'commission_pct', case when rev > 0 then round(comm / rev * 100, 1) end,
    'cost_pct', case when rev > 0 then round((comm + rw) / rev * 100, 1) end, 'cost_cap', capp,
    'reward_used', rw, 'reward_budget', round(rev * bud / 100), 'reward_budget_pct', bud,
    'per_unit', (select coalesce(jsonb_agg(jsonb_build_object('unit', u.code, 'name', u.name,
        'booking', (select count(*) from _afb b where b.unit_code = u.code and public.af_month(b.booked_at) = m),
        'revenue', (select coalesce(sum(net_amount + ext_amount), 0) from _afb b where b.unit_code = u.code and b.bk_status = 'selesai' and public.af_month(b.completed_at) = m),
        'commission', (select coalesce(sum(commission), 0) from _afb b where b.unit_code = u.code and b.comm_status in ('siap_cair','dicairkan') and public.af_month(b.completed_at) = m)) order by u.sort), '[]'::jsonb)
      from public.af_units u where u.is_active),
    'per_cat', (select coalesce(jsonb_agg(jsonb_build_object('unit', unit_code, 'cat', cat, 'n', n, 'revenue', rv, 'commission', cm) order by rv desc), '[]'::jsonb) from (
      select unit_code, cat, count(*) n, sum(net_amount + ext_amount) rv, sum(commission) cm from _afb b
      where b.bk_status = 'selesai' and public.af_month(b.completed_at) = m group by unit_code, cat) q),
    'top', (select coalesce(jsonb_agg(q order by (q->>'done')::int desc, (q->>'commission')::numeric desc), '[]'::jsonb) from (
      select jsonb_build_object('id', x.id, 'name', coalesce(nullif(x.org, ''), x.name), 'city', x.city, 'kind', x.kind, 'tier', public.af_tier_now(x.id)->>'name',
        'booking', count(b.id) filter (where public.af_month(b.booked_at) = m),
        'done', count(b.id) filter (where b.bk_status = 'selesai' and public.af_month(b.completed_at) = m),
        'commission', coalesce(sum(b.commission) filter (where b.comm_status in ('siap_cair','dicairkan','tertunda') and public.af_month(b.booked_at) = m), 0)) q
      from public.af_partners x join _afb b on b.partner_id = x.id group by x.id limit 50) z),
    'frozen', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'booking_id', b.booking_id, 'unit', b.unit_code, 'partner', coalesce(nullif(x.org, ''), x.name),
        'reason', b.frozen_reason, 'amount', b.net_amount + b.ext_amount, 'at', b.booked_at)), '[]'::jsonb)
      from public.af_bookings b join public.af_partners x on x.id = b.partner_id where b.frozen and b.comm_status = 'dibekukan' and b.demo = p_demo),
    'idle', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', coalesce(nullif(x.org, ''), x.name), 'city', x.city, 'kind', x.kind, 'wa', x.wa,
        'last', (select max(booked_at) from public.af_bookings b where b.partner_id = x.id))), '[]'::jsonb)
      from public.af_partners x where x.status = 'aktif' and x.demo = p_demo and x.approved_at < now() - interval '30 day'
        and not exists (select 1 from public.af_bookings b where b.partner_id = x.id and b.booked_at > now() - interval '30 day')),
    'notifs', (select count(*) from public.af_notifs n where n.sent_at is null and n.demo = p_demo),
    'is_fin', public.af_is_fin(), 'is_biz', public.af_is_biz());
  return res;
end $$;

create or replace function public.af_admin_partners(p_status text default null, p_demo boolean default false) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.af_can_view() then null else coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id, 'name', x.name, 'org', x.org, 'kind', x.kind, 'city', x.city, 'wa', x.wa, 'email', x.email, 'status', x.status, 'code', x.code,
    'guest_discount', x.guest_discount, 'is_internal', x.is_internal, 'violations', x.violations, 'reason', x.reason,
    'bank', case when x.bank_acct is not null then x.bank_name || ' •••• ' || right(x.bank_acct, 4) || ' · ' || coalesce(x.bank_holder, '') end,
    'nik_set', x.nik is not null, 'address', x.address, 'created_at', x.created_at, 'approved_at', x.approved_at,
    'tier', public.af_tier_now(x.id)->>'name',
    'done3m', (select count(*) from public.af_bookings b where b.partner_id = x.id and public.af_done(b) and b.completed_at >= public.af_month() - interval '2 month'),
    'total', (select count(*) from public.af_bookings b where b.partner_id = x.id),
    'rates', (select coalesce(jsonb_agg(jsonb_build_object('unit', r.unit_code, 'cat', r.cat, 'pct', r.pct)), '[]'::jsonb) from public.af_partner_rates r where r.partner_id = x.id)
  ) order by x.created_at desc), '[]'::jsonb) end
  from public.af_partners x where x.demo = p_demo and (p_status is null or x.status = p_status)
$$;

create or replace function public.af_approve(p_id uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c text := upper(btrim(coalesce(p_code, ''))); x public.af_partners;
begin
  perform public.af_need(true, false);
  select * into x from public.af_partners where id = p_id for update;
  if x.id is null then raise exception 'Mitra tidak ditemukan'; end if;
  if c !~ '^[A-Z0-9]{4,8}$' then raise exception 'Kode harus 4–8 huruf besar/angka'; end if;
  if exists (select 1 from public.af_partners where code = c and id <> p_id) then raise exception 'Kode % sudah dipakai', c; end if;
  if exists (select 1 from public.pk_people s where s.is_active and (lower(s.email) = lower(x.email) or public.af_norm_wa(s.phone) = x.wa)) then
    raise exception 'Email/WA ini milik staf grup; staf tidak boleh jadi mitra';
  end if;
  update public.af_partners set status = 'aktif', code = c, approved_at = coalesce(approved_at, now()), approved_by = public.pk_me(), reason = null, updated_at = now() where id = p_id;
  perform public.af_log('setujui', p_id::text, null, jsonb_build_object('code', c));
  perform public.af_notify(p_id, 'disetujui', 'Pendaftaran mitra disetujui. Kode Anda ' || c || '. Masuk ke pokama.org/mitra untuk link, QR, dan rekening.');
  return jsonb_build_object('ok', true, 'code', c);
end $$;

create or replace function public.af_set_status(p_id uuid, p_status text, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.af_need(true, true);
  if p_status not in ('aktif','ditolak','nonaktif') then raise exception 'Status tidak dikenal'; end if;
  if p_status in ('ditolak','nonaktif') and coalesce(btrim(p_reason), '') = '' then raise exception 'Alasan wajib diisi'; end if;
  update public.af_partners set status = p_status, reason = nullif(btrim(coalesce(p_reason, '')), ''), updated_at = now() where id = p_id;
  perform public.af_log('status_' || p_status, p_id::text, p_reason);
end $$;

create or replace function public.af_partner_edit(p_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.af_need(true, false);
  update public.af_partners set
    is_internal = coalesce((p->>'is_internal')::boolean, is_internal),
    guest_discount = coalesce((p->>'guest_discount')::boolean, guest_discount),
    city = coalesce(nullif(p->>'city', ''), city), kind = coalesce(nullif(p->>'kind', ''), kind),
    org = coalesce(nullif(btrim(p->>'org'), ''), org), address = coalesce(nullif(btrim(p->>'address'), ''), address),
    updated_at = now()
  where id = p_id;
  perform public.af_log('ubah_mitra', p_id::text, null, p);
end $$;

create or replace function public.af_set_rate(p_partner uuid, p_unit text, p_cat text, p_pct numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.af_need(true, false);
  if p_pct is null then delete from public.af_partner_rates where partner_id = p_partner and unit_code = p_unit and cat = p_cat;
  else
    if p_pct < 0 or p_pct > 15 then raise exception 'Tarif khusus 0–15%%'; end if;
    insert into public.af_partner_rates(partner_id, unit_code, cat, pct, set_by) values (p_partner, p_unit, p_cat, p_pct, public.pk_me())
    on conflict (partner_id, unit_code, cat) do update set pct = excluded.pct, set_by = excluded.set_by, set_at = now();
  end if;
  perform public.af_log('tarif_khusus', p_partner::text, null, jsonb_build_object('unit', p_unit, 'cat', p_cat, 'pct', p_pct));
end $$;

create or replace function public.af_rate_base_set(p_unit text, p_cat text, p_label text, p_pct numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.af_need(true, false);
  if p_pct is null then delete from public.af_rates where unit_code = p_unit and cat = p_cat;
  else insert into public.af_rates(unit_code, cat, label, pct, sort) values (p_unit, lower(p_cat), p_label, p_pct, (select coalesce(max(sort), 0) + 1 from public.af_rates where unit_code = p_unit))
    on conflict (unit_code, cat) do update set label = excluded.label, pct = excluded.pct;
  end if;
  perform public.af_log('tarif_dasar', p_unit || '/' || p_cat, null, jsonb_build_object('pct', p_pct, 'label', p_label));
end $$;

create or replace function public.af_challenge_save(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id', '')::uuid; m date := coalesce((p->>'month')::date, public.af_month());
begin
  perform public.af_need(true, false);
  if coalesce(btrim(p->>'title'), '') = '' then raise exception 'Judul tantangan wajib diisi'; end if;
  if v_id is null then
    if (select count(*) from public.af_challenges where month = m and is_active and demo = coalesce((p->>'demo')::boolean, false)) >= 3 then raise exception 'Maksimal 3 tantangan per bulan'; end if;
    insert into public.af_challenges(month, title, unit_code, cat, target, reward_type, reward_amount, demo, created_by)
    values (date_trunc('month', m)::date, btrim(p->>'title'), nullif(p->>'unit', ''), nullif(p->>'cat', ''), (p->>'target')::int,
      coalesce(nullif(p->>'reward_type', ''), 'tunai'), coalesce((p->>'reward_amount')::numeric, 0), coalesce((p->>'demo')::boolean, false), public.pk_me())
    returning af_challenges.id into v_id;
    insert into public.af_notifs(partner_id, kind, text, demo)
      select x.id, 'tantangan', 'Tantangan baru: ' || btrim(p->>'title') || '. Lihat di pokama.org/mitra.', x.demo from public.af_partners x
      where x.status = 'aktif' and not x.is_internal and x.demo = coalesce((p->>'demo')::boolean, false);
  else
    update public.af_challenges set title = btrim(p->>'title'), unit_code = nullif(p->>'unit', ''), cat = nullif(p->>'cat', ''), target = (p->>'target')::int,
      reward_type = coalesce(nullif(p->>'reward_type', ''), reward_type), reward_amount = coalesce((p->>'reward_amount')::numeric, reward_amount),
      is_active = coalesce((p->>'is_active')::boolean, is_active) where af_challenges.id = v_id;
  end if;
  perform public.af_log('tantangan', v_id::text, null, p);
  return v_id;
end $$;

create or replace function public.af_prizes_save(p_month date, p_amounts numeric[]) returns void
language plpgsql security definer set search_path = public as $$
declare i int;
begin
  perform public.af_need(true, false);
  for i in 1..3 loop
    insert into public.af_rank_prizes(month, rank, amount) values (date_trunc('month', p_month)::date, i, coalesce(p_amounts[i], 0))
    on conflict (month, rank) do update set amount = excluded.amount;
  end loop;
  perform public.af_log('hadiah_juara', p_month::text, null, to_jsonb(p_amounts));
end $$;

create or replace function public.af_admin_challenges(p_month date default null, p_demo boolean default false) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.af_can_view() then null else jsonb_build_object(
    'challenges', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'unit', c.unit_code, 'cat', c.cat, 'target', c.target,
        'reward_type', c.reward_type, 'reward_amount', c.reward_amount, 'is_active', c.is_active,
        'reached', (select count(*) from (select b.partner_id from public.af_bookings b where public.af_done(b) and public.af_month(b.completed_at) = c.month and b.demo = p_demo
            and (c.unit_code is null or b.unit_code = c.unit_code) and (c.cat is null or b.cat = c.cat) group by b.partner_id having count(*) >= c.target) q)) order by c.created_at), '[]'::jsonb)
      from public.af_challenges c where c.month = coalesce(p_month, public.af_month()) and c.demo = p_demo),
    'prizes', (select coalesce(jsonb_agg(jsonb_build_object('rank', rank, 'amount', amount) order by rank), '[]'::jsonb) from public.af_rank_prizes where month = coalesce(p_month, public.af_month())),
    'boards', (select coalesce(jsonb_agg(q), '[]'::jsonb) from (
      select jsonb_build_object('city', city, 'kind', kind, 'rows', jsonb_agg(jsonb_build_object('name', nm, 'done', dn) order by dn desc)) q from (
        select x.city, x.kind, coalesce(nullif(x.org, ''), x.name) nm, count(b.id) dn from public.af_partners x
        join public.af_bookings b on b.partner_id = x.id and public.af_done(b) and public.af_month(b.completed_at) = coalesce(p_month, public.af_month())
        where x.status = 'aktif' and x.demo = p_demo and not x.is_internal group by x.id) r group by city, kind) z))
  end
$$;

-- ================= Keuangan: bekukan, pelanggaran =================
create or replace function public.af_freeze(p_booking uuid, p_freeze boolean, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare b public.af_bookings;
begin
  perform public.af_need(false, true);
  if coalesce(btrim(p_reason), '') = '' then raise exception 'Alasan wajib diisi'; end if;
  select * into b from public.af_bookings where id = p_booking for update;
  if b.id is null then raise exception 'Booking tidak ditemukan'; end if;
  if b.comm_status = 'dicairkan' then raise exception 'Komisi sudah dicairkan'; end if;
  update public.af_bookings set frozen = p_freeze, frozen_reason = case when p_freeze then btrim(p_reason) end,
    self_ref = case when p_freeze then self_ref else false end, updated_at = now() where id = p_booking;
  perform public.af_log(case when p_freeze then 'bekukan' else 'lepas' end, p_booking::text, p_reason, jsonb_build_object('booking', b.booking_id, 'unit', b.unit_code));
  perform public.af_compute(p_booking);
end $$;

create or replace function public.af_violation(p_partner uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int; m date := public.af_month(); burned int;
begin
  perform public.af_need(false, true);
  if coalesce(btrim(p_reason), '') = '' then raise exception 'Alasan wajib diisi'; end if;
  update public.af_partners set violations = violations + 1, updated_at = now() where id = p_partner returning violations into n;
  update public.af_bookings set comm_status = 'hangus', comm_note = 'Pelanggaran: ' || btrim(p_reason), updated_at = now()
   where partner_id = p_partner and comm_status in ('tertunda','siap_cair','dibekukan') and public.af_month(booked_at) = m;
  get diagnostics burned = row_count;
  if n >= 2 then
    update public.af_partners set status = 'nonaktif', reason = 'Pelanggaran ke-' || n || ': ' || btrim(p_reason) where id = p_partner;
  end if;
  perform public.af_log('pelanggaran', p_partner::text, p_reason, jsonb_build_object('ke', n, 'hangus', burned));
  return jsonb_build_object('ke', n, 'hangus', burned, 'nonaktif', n >= 2);
end $$;

-- ================= tutup bulan (tgl 1): tantangan, peringkat, lencana, tingkat, rekap pencairan =================
create or replace function public.af_close_month(p_month date default null, p_force boolean default false, p_demo boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m date := coalesce(date_trunc('month', p_month)::date, (public.af_month() - interval '1 month')::date); nm date;
  rev numeric; comm numeric; rw numeric; bud numeric; minp numeric := (public.af_set('min_payout'))::text::numeric;
  taxp numeric := coalesce((public.af_set('tax')->>'pct')::numeric, 0); rec record; c record; i int; tiers jsonb := public.af_set('tiers');
  d3 int; st int; prevt jsonb; newt jsonb; prot boolean; mm date; npay int := 0; gross numeric; cm numeric; rv numeric;
begin
  if auth.uid() is not null then perform public.af_need(false, true); end if;
  nm := (m + interval '1 month')::date;
  if nm > public.af_month() and not p_force then raise exception 'Bulan % belum selesai', to_char(m, 'YYYY-MM'); end if;
  if exists (select 1 from public.af_month_close where month = m and demo = p_demo) and not p_force then
    return jsonb_build_object('skipped', true, 'month', m);
  end if;
  if p_force then
    -- ulang rekap: lepas pencairan yang belum disetujui
    update public.af_bookings set payout_id = null where payout_id in (select id from public.af_payouts where period = m and status = 'diajukan' and demo = p_demo);
    update public.af_rewards set payout_id = null where payout_id in (select id from public.af_payouts where period = m and status = 'diajukan' and demo = p_demo);
    delete from public.af_payouts where period = m and status = 'diajukan' and demo = p_demo;
    delete from public.af_month_close where month = m and demo = p_demo;
  end if;

  -- 1. tantangan tercapai
  for c in select * from public.af_challenges where month = m and is_active and demo = p_demo loop
    insert into public.af_rewards(partner_id, month, kind, ref, title, reward_type, amount, demo)
    select b.partner_id, m, 'tantangan', c.id::text, c.title, c.reward_type, c.reward_amount, p_demo
    from public.af_bookings b join public.af_partners x on x.id = b.partner_id
    where public.af_done(b) and public.af_month(b.completed_at) = m and b.demo = p_demo and x.status = 'aktif' and not x.is_internal
      and (c.unit_code is null or b.unit_code = c.unit_code) and (c.cat is null or b.cat = c.cat)
    group by b.partner_id having count(*) >= c.target
    on conflict (partner_id, kind, ref) do nothing;
  end loop;
  insert into public.af_notifs(partner_id, kind, text, demo)
    select w.partner_id, 'tantangan_tercapai', 'Selamat! Tantangan "' || w.title || '" tercapai. Hadiah ' || to_char(w.amount, 'FM999G999G999') || ' masuk pencairan.', p_demo
    from public.af_rewards w where w.month = m and w.kind = 'tantangan' and w.demo = p_demo and w.created_at > now() - interval '1 minute';

  -- 2. peringkat per kota x jenis
  delete from public.af_ranks where month = m and partner_id in (select id from public.af_partners where demo = p_demo);
  insert into public.af_ranks(month, demo, city, kind, rank, partner_id, done)
  select m, p_demo, city, kind, rk, pid, dn from (
    select x.city, x.kind, x.id pid, count(*) dn, row_number() over (partition by x.city, x.kind order by count(*) desc, min(b.completed_at)) rk
    from public.af_bookings b join public.af_partners x on x.id = b.partner_id
    where public.af_done(b) and public.af_month(b.completed_at) = m and b.demo = p_demo and x.status = 'aktif' and not x.is_internal
    group by x.city, x.kind, x.id) q where rk <= 3;
  insert into public.af_rewards(partner_id, month, kind, ref, title, amount, demo)
  select r.partner_id, m, 'juara', 'rank-' || r.city || '-' || r.kind, 'Juara ' || r.rank || ' ' || r.kind || ' ' || r.city || ' ' || to_char(m, 'MM/YYYY'), z.amount, p_demo
  from public.af_ranks r join public.af_rank_prizes z on z.month = m and z.rank = r.rank join public.af_partners x on x.id = r.partner_id
  where r.month = m and x.demo = p_demo and z.amount > 0
  on conflict (partner_id, kind, ref) do nothing;
  insert into public.af_badges(partner_id, badge) select partner_id, 'Mitra Unggulan' from public.af_ranks r join public.af_partners x on x.id = r.partner_id
    where r.month = m and x.demo = p_demo on conflict do nothing;
  insert into public.af_notifs(partner_id, kind, text, demo)
    select r.partner_id, 'juara', 'Anda peringkat ' || r.rank || ' ' || r.kind || ' ' || r.city || ' bulan ' || to_char(m, 'MM/YYYY') || ' dan tampil sebagai Mitra Unggulan.', p_demo
    from public.af_ranks r join public.af_partners x on x.id = r.partner_id where r.month = m and x.demo = p_demo;

  -- 3. lencana
  insert into public.af_badges(partner_id, badge)
  select partner_id, bd from (
    select b.partner_id, unnest(array_remove(array[
      case when count(*) >= 1 then 'Booking pertama' end,
      case when count(*) >= 10 then '10 booking' end,
      case when count(*) >= 50 then '50 booking' end,
      case when count(*) filter (where b.cat = 'penginapan') >= 1 then 'Penjelajah' end,
      case when count(*) filter (where b.cat = 'jeep') >= 10 then 'Raja Jeep' end,
      case when count(*) filter (where b.repeat_cust) >= 5 then 'Tamu setia' end], null)) bd
    from public.af_bookings b where public.af_done(b) and b.demo = p_demo and b.partner_id is not null group by b.partner_id) q
  on conflict do nothing;

  -- 4. tingkat untuk bulan depan (+ beruntun & perlindungan)
  for rec in select x.id from public.af_partners x where x.status = 'aktif' and x.demo = p_demo loop
    select count(*) into d3 from public.af_bookings b where b.partner_id = rec.id and public.af_done(b) and b.completed_at >= (m - interval '2 month') and public.af_month(b.completed_at) <= m;
    st := 0; mm := m;
    while exists (select 1 from public.af_bookings b where b.partner_id = rec.id and public.af_done(b) and public.af_month(b.completed_at) = mm) and st < 36 loop
      st := st + 1; mm := (mm - interval '1 month')::date;
    end loop;
    select x into newt from jsonb_array_elements(tiers) x where (x->>'min')::int <= d3 order by (x->>'min')::int desc limit 1;
    prevt := public.af_tier_now(rec.id); prot := false;
    if (newt->>'min')::int < (prevt->>'min')::int and st >= 3
       and not coalesce((select protected from public.af_tiers where partner_id = rec.id and month = m), false) then
      newt := prevt; prot := true;
    end if;
    insert into public.af_tiers(partner_id, month, tier, done3m, streak, protected) values (rec.id, nm, newt->>'name', d3, st, prot)
    on conflict (partner_id, month) do update set tier = excluded.tier, done3m = excluded.done3m, streak = excluded.streak, protected = excluded.protected;
    if st >= 3 then insert into public.af_badges(partner_id, badge) values (rec.id, 'Beruntun 3 bulan') on conflict do nothing; end if;
    if (newt->>'min')::int > (prevt->>'min')::int then
      perform public.af_notify(rec.id, 'naik_tingkat', 'Naik tingkat jadi ' || (newt->>'name') || ' mulai ' || to_char(nm, 'MM/YYYY') || ': komisi +' || (newt->>'bonus') || '%.');
    end if;
  end loop;

  -- 5. anggaran hadiah
  select coalesce(sum(net_amount + ext_amount), 0), coalesce(sum(commission), 0) into rev, comm from public.af_bookings b
   where public.af_done(b) and public.af_month(b.completed_at) = m and b.demo = p_demo;
  select coalesce(sum(amount), 0) into rw from public.af_rewards where month = m and status <> 'ditolak' and demo = p_demo;
  bud := round(rev * (public.af_set('reward_budget_pct'))::text::numeric / 100);

  -- 6. rekap pencairan: komisi siap cair s.d. akhir bulan + hadiah, per mitra (semua unit digabung)
  for rec in
    select x.id, x.bank_name, x.bank_acct, x.bank_holder from public.af_partners x
    where x.demo = p_demo and x.status in ('aktif','nonaktif')
      and (exists (select 1 from public.af_bookings b where b.partner_id = x.id and b.comm_status = 'siap_cair' and b.payout_id is null and b.completed_at < nm)
        or exists (select 1 from public.af_rewards w where w.partner_id = x.id and w.status = 'siap_cair' and w.payout_id is null and w.month <= m))
  loop
    select coalesce(sum(commission), 0) into cm from public.af_bookings b where b.partner_id = rec.id and b.comm_status = 'siap_cair' and b.payout_id is null and b.completed_at < nm;
    select coalesce(sum(amount), 0) into rv from public.af_rewards w where w.partner_id = rec.id and w.status = 'siap_cair' and w.payout_id is null and w.month <= m;
    gross := cm + rv;
    if gross < minp then continue; end if;  -- dibawa ke bulan berikutnya
    insert into public.af_payouts(period, partner_id, commission, rewards, gross, tax_pct, tax, net, bank, items, demo)
    values (m, rec.id, cm, rv, gross, taxp, round(gross * taxp / 100), gross - round(gross * taxp / 100),
      case when rec.bank_acct is not null then rec.bank_name || ' ' || rec.bank_acct || ' a.n. ' || coalesce(rec.bank_holder, '-') end,
      (select count(*) from public.af_bookings b where b.partner_id = rec.id and b.comm_status = 'siap_cair' and b.payout_id is null and b.completed_at < nm), p_demo)
    on conflict (period, partner_id) do nothing;
    update public.af_bookings set payout_id = (select id from public.af_payouts where period = m and partner_id = rec.id)
     where partner_id = rec.id and comm_status = 'siap_cair' and payout_id is null and completed_at < nm;
    update public.af_rewards set payout_id = (select id from public.af_payouts where period = m and partner_id = rec.id)
     where partner_id = rec.id and status = 'siap_cair' and payout_id is null and month <= m;
    npay := npay + 1;
  end loop;

  insert into public.af_month_close(month, demo, revenue, commission, reward_budget, reward_used, over_budget, payouts, closed_by)
  values (m, p_demo, rev, comm, bud, rw, rw > bud, npay, public.pk_me())
  on conflict (month, demo) do update set revenue = excluded.revenue, commission = excluded.commission, reward_budget = excluded.reward_budget,
    reward_used = excluded.reward_used, over_budget = excluded.over_budget, payouts = excluded.payouts, closed_at = now();
  perform public.af_log('tutup_bulan', m::text, null, jsonb_build_object('payouts', npay, 'revenue', rev, 'reward', rw, 'budget', bud, 'demo', p_demo));
  return jsonb_build_object('month', m, 'payouts', npay, 'revenue', rev, 'commission', comm, 'reward_used', rw, 'reward_budget', bud, 'over_budget', rw > bud);
end $$;

-- ================= Keuangan: pencairan =================
create or replace function public.af_payouts_list(p_period date default null, p_demo boolean default false) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.af_is_fin() and not public.af_is_biz() then null else jsonb_build_object(
    'periods', (select coalesce(jsonb_agg(distinct period order by period desc), '[]'::jsonb) from public.af_payouts where demo = p_demo),
    'close', (select to_jsonb(c) from public.af_month_close c where c.demo = p_demo and c.month = coalesce(p_period, (select max(period) from public.af_payouts where demo = p_demo))),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'period', o.period, 'partner_id', o.partner_id, 'name', coalesce(nullif(x.org, ''), x.name), 'holder', x.bank_holder,
        'wa', x.wa, 'bank', o.bank, 'commission', o.commission, 'rewards', o.rewards, 'gross', o.gross, 'tax', o.tax, 'net', o.net, 'items', o.items, 'status', o.status,
        'proof_url', o.proof_url, 'transferred_at', o.transferred_at, 'npwp', x.npwp is not null, 'nik', x.nik is not null,
        'frozen', (select count(*) from public.af_bookings b where b.partner_id = o.partner_id and b.comm_status = 'dibekukan'),
        'lines', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'unit', b.unit_code, 'booking_id', b.booking_id, 'product', coalesce(b.product, b.cat), 'amount', b.net_amount + b.ext_amount,
            'rate', b.rate_final, 'commission', b.commission, 'completed_at', b.completed_at) order by b.completed_at), '[]'::jsonb) from public.af_bookings b where b.payout_id = o.id),
        'reward_lines', (select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'title', w.title, 'amount', w.amount, 'status', w.status)), '[]'::jsonb) from public.af_rewards w where w.payout_id = o.id)
      ) order by o.status, o.net desc), '[]'::jsonb)
      from public.af_payouts o join public.af_partners x on x.id = o.partner_id
      where o.demo = p_demo and o.period = coalesce(p_period, (select max(period) from public.af_payouts where demo = p_demo))),
    'carried', (select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(nullif(x.org, ''), x.name), 'amount', s)), '[]'::jsonb) from (
      select b.partner_id, sum(b.commission) s from public.af_bookings b where b.comm_status = 'siap_cair' and b.payout_id is null and b.demo = p_demo group by b.partner_id) q
      join public.af_partners x on x.id = q.partner_id),
    'frozen', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'booking_id', b.booking_id, 'unit', b.unit_code, 'partner', coalesce(nullif(x.org, ''), x.name), 'partner_id', x.id,
        'reason', b.frozen_reason, 'amount', b.net_amount + b.ext_amount, 'self_ref', b.self_ref, 'at', b.booked_at)), '[]'::jsonb)
      from public.af_bookings b join public.af_partners x on x.id = b.partner_id where b.comm_status = 'dibekukan' and b.demo = p_demo),
    'rewards_open', (select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'title', w.title, 'name', coalesce(nullif(x.org, ''), x.name), 'amount', w.amount, 'status', w.status, 'month', w.month)), '[]'::jsonb)
      from public.af_rewards w join public.af_partners x on x.id = w.partner_id where w.demo = p_demo and w.status = 'siap_cair'),
    'tax', public.af_set('tax'), 'min_payout', public.af_set('min_payout'), 'is_fin', public.af_is_fin())
  end
$$;

create or replace function public.af_payout_approve(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public.af_need(false, true);
  update public.af_payouts set status = 'disetujui', approved_by = public.pk_me(), approved_at = now() where id = any(p_ids) and status = 'diajukan';
  get diagnostics n = row_count;
  perform public.af_log('setujui_pencairan', array_to_string(p_ids, ','), null, jsonb_build_object('n', n));
  return n;
end $$;

create or replace function public.af_payout_reject(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.af_need(false, true);
  if coalesce(btrim(p_reason), '') = '' then raise exception 'Alasan wajib diisi'; end if;
  update public.af_bookings set payout_id = null where payout_id = p_id;
  update public.af_rewards set payout_id = null where payout_id = p_id;
  update public.af_payouts set status = 'ditolak', note = btrim(p_reason) where id = p_id and status in ('diajukan','disetujui');
  perform public.af_log('tolak_pencairan', p_id::text, p_reason);
end $$;

create or replace function public.af_payout_paid(p_id uuid, p_proof text) returns void
language plpgsql security definer set search_path = public as $$
declare o public.af_payouts; r record;
begin
  perform public.af_need(false, true);
  select * into o from public.af_payouts where id = p_id for update;
  if o.status <> 'disetujui' then raise exception 'Setujui pencairan dulu sebelum ditandai ditransfer'; end if;
  if coalesce(btrim(p_proof), '') = '' then raise exception 'Unggah bukti transfer dulu'; end if;
  update public.af_payouts set status = 'ditransfer', transferred_by = public.pk_me(), transferred_at = now(), proof_url = p_proof where id = p_id;
  update public.af_bookings set comm_status = 'dicairkan', updated_at = now() where payout_id = p_id;
  update public.af_rewards set status = 'dicairkan' where payout_id = p_id;
  perform public.af_log('ditransfer', p_id::text, null, jsonb_build_object('net', o.net));
  perform public.af_notify(o.partner_id, 'transfer', 'Pencairan ' || to_char(o.period, 'MM/YYYY') || ' sebesar ' || to_char(o.net, 'FM999G999G999') || ' sudah ditransfer. Bukti ada di pokama.org/mitra.');
  -- beban marketing per unit asal booking → buku keuangan grup (bukan untuk data demo)
  if not o.demo and to_regprocedure('public.pk_fin_emit(text,text,text,date,text,numeric,jsonb)') is not null then
    for r in select unit_code, sum(commission) amt from public.af_bookings where payout_id = p_id group by unit_code loop
      begin
        perform public.pk_fin_emit('pokama', 'af-' || p_id || '-' || r.unit_code, 'expense.paid', public.pk_today(), r.unit_code, r.amt,
          jsonb_build_object('category', 'komisi affiliate', 'memo', 'Komisi mitra ' || to_char(o.period, 'MM/YYYY'), 'channel', 'transfer'));
      exception when others then perform public.af_log('fin_emit_gagal', p_id::text, sqlerrm); end;
    end loop;
    if o.rewards > 0 then
      begin
        perform public.pk_fin_emit('pokama', 'af-' || p_id || '-hadiah', 'expense.paid', public.pk_today(), 'RA', o.rewards,
          jsonb_build_object('category', 'hadiah mitra affiliate', 'memo', 'Hadiah gamifikasi mitra ' || to_char(o.period, 'MM/YYYY'), 'channel', 'transfer'));
      exception when others then perform public.af_log('fin_emit_gagal', p_id::text, sqlerrm); end;
    end if;
  end if;
end $$;

create or replace function public.af_reward_reject(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.af_need(false, true);
  if coalesce(btrim(p_reason), '') = '' then raise exception 'Alasan wajib diisi'; end if;
  update public.af_rewards set status = 'ditolak', reason = btrim(p_reason) where id = p_id and status = 'siap_cair' and payout_id is null;
  if not found then raise exception 'Hadiah sudah masuk rekap pencairan; tolak pencairannya dulu'; end if;
  perform public.af_log('tolak_hadiah', p_id::text, p_reason);
end $$;

create or replace function public.af_setting_save(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_key in ('tax','min_payout') then perform public.af_need(false, true); else perform public.af_need(true, false); end if;
  if p_key not in ('tax','min_payout','reward_budget_pct','cost_cap_pct','guest_discount_pct','bizdev_ids','tiers','returning_factor') then raise exception 'Pengaturan tidak dikenal'; end if;
  update public.af_settings set value = p_value, updated_by = public.pk_me(), updated_at = now() where key = p_key;
  perform public.af_log('pengaturan', p_key, null, p_value);
end $$;

create or replace function public.af_unit_key_new(p_unit text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare k text := 'afk_' || lower(p_unit) || '_' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not coalesce(public.pk_role() in ('ceo','keuangan'), false) then raise exception 'Hanya CEO / Keuangan'; end if;
  insert into public.af_unit_keys(unit_code, key_hash, hint, created_by) values (p_unit, encode(extensions.digest(k, 'sha256'), 'hex'), right(k, 4), public.pk_me())
  on conflict (unit_code) do update set key_hash = excluded.key_hash, hint = excluded.hint, created_by = excluded.created_by, created_at = now();
  perform public.af_log('kunci_unit_baru', p_unit);
  return k;
end $$;

create or replace function public.af_admin_misc(p_demo boolean default false) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.af_can_view() then null else jsonb_build_object(
    'units', (select coalesce(jsonb_agg(jsonb_build_object('code', u.code, 'name', u.name, 'ref_base', u.ref_base, 'is_active', u.is_active, 'logo', u.logo,
        'key_hint', k.hint, 'key_at', k.created_at,
        'rates', (select coalesce(jsonb_agg(jsonb_build_object('cat', r.cat, 'label', r.label, 'pct', r.pct) order by r.sort), '[]'::jsonb) from public.af_rates r where r.unit_code = u.code)) order by u.sort), '[]'::jsonb)
      from public.af_units u left join public.af_unit_keys k on k.unit_code = u.code),
    'settings', (select jsonb_object_agg(key, value) from public.af_settings),
    'notifs', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'text', n.text, 'at', n.created_at, 'name', coalesce(nullif(x.org, ''), x.name), 'wa', x.wa) order by n.created_at desc), '[]'::jsonb)
      from public.af_notifs n join public.af_partners x on x.id = n.partner_id where n.sent_at is null and n.demo = p_demo),
    'audit', (select coalesce(jsonb_agg(jsonb_build_object('at', a.at, 'by', coalesce(pp.nickname, pp.name, 'sistem'), 'action', a.action, 'target', a.target, 'reason', a.reason) order by a.at desc), '[]'::jsonb)
      from (select * from public.af_audit order by at desc limit 80) a left join public.pk_people pp on pp.id = a.by_person),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('at', e.received_at, 'unit', e.unit_code, 'booking_id', e.booking_id, 'status', e.status, 'result', e.result) order by e.id desc), '[]'::jsonb)
      from (select * from public.af_events where demo = p_demo order by id desc limit 50) e),
    'people', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', coalesce(nickname, name), 'title', title) order by name), '[]'::jsonb) from public.pk_people where is_active),
    'is_fin', public.af_is_fin(), 'is_biz', public.af_is_biz(), 'role', public.pk_role())
  end
$$;

create or replace function public.af_notif_sent(p_ids bigint[]) returns void
language sql security definer set search_path = public as $$
  update public.af_notifs set sent_at = now(), sent_by = public.pk_me() where id = any(p_ids) and public.af_can_view()
$$;

create or replace function public.af_report(p_from date, p_to date, p_by text, p_demo boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  perform public.af_need(true, true);
  select coalesce(jsonb_agg(q order by (q->>'revenue')::numeric desc), '[]'::jsonb) into res from (
    select jsonb_build_object('key', k, 'booking', count(*), 'selesai', count(*) filter (where b.bk_status = 'selesai'),
      'revenue', coalesce(sum(b.net_amount + b.ext_amount) filter (where b.bk_status = 'selesai'), 0),
      'commission', coalesce(sum(b.commission) filter (where b.comm_status in ('siap_cair','dicairkan')), 0),
      'hangus', count(*) filter (where b.comm_status = 'hangus')) q
    from (select b.*, case p_by when 'unit' then b.unit_code when 'kota' then x.city when 'produk' then b.unit_code || ' · ' || coalesce(b.cat, '-')
            when 'jenis' then x.kind else coalesce(nullif(x.org, ''), x.name) end k
          from public.af_bookings b join public.af_partners x on x.id = b.partner_id
          where b.demo = p_demo and public.af_month(b.booked_at) between date_trunc('month', p_from) and date_trunc('month', p_to)) b
    group by k) z;
  return res;
end $$;

-- ================= keamanan =================
alter table public.af_units enable row level security;
alter table public.af_unit_keys enable row level security;
alter table public.af_rates enable row level security;
alter table public.af_settings enable row level security;
alter table public.af_partners enable row level security;
alter table public.af_partner_rates enable row level security;
alter table public.af_events enable row level security;
alter table public.af_bookings enable row level security;
alter table public.af_payouts enable row level security;
alter table public.af_tiers enable row level security;
alter table public.af_challenges enable row level security;
alter table public.af_rank_prizes enable row level security;
alter table public.af_ranks enable row level security;
alter table public.af_rewards enable row level security;
alter table public.af_badges enable row level security;
alter table public.af_month_close enable row level security;
alter table public.af_audit enable row level security;
alter table public.af_notifs enable row level security;
-- baca langsung hanya untuk tabel publik ringan; selebihnya lewat fungsi di atas
drop policy if exists af_units_r on public.af_units;
create policy af_units_r on public.af_units for select using (true);
drop policy if exists af_rates_r on public.af_rates;
create policy af_rates_r on public.af_rates for select using (true);
grant select on public.af_units, public.af_rates to anon, authenticated;
revoke insert, update, delete, truncate on public.af_units, public.af_rates from anon, authenticated;
revoke all on public.af_unit_keys, public.af_settings, public.af_partners, public.af_partner_rates, public.af_events, public.af_bookings,
  public.af_payouts, public.af_tiers, public.af_challenges, public.af_rank_prizes, public.af_ranks, public.af_rewards, public.af_badges,
  public.af_month_close, public.af_audit, public.af_notifs from anon, authenticated;

do $g$ declare f record; begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'af\_%' loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $g$;
revoke execute on function public.af_ingest(text, jsonb, boolean), public.af_api_events(text, jsonb), public.af_api_codes(text),
  public.af_unit_by_key(text), public.af_compute(uuid), public.af_notify(uuid, text, text), public.af_log(text, text, text, jsonb),
  public.af_close_month(date, boolean, boolean) from public, anon, authenticated;
grant execute on function public.af_close_month(date, boolean, boolean) to authenticated;
grant execute on function public.af_api_featured(text) to anon, authenticated;
grant execute on function public.af_register(jsonb) to anon, authenticated;

-- ================= jadwal: tanggal 1, 07.35 WIB =================
select cron.unschedule('af-close-month') where exists (select 1 from cron.job where jobname = 'af-close-month');
select cron.schedule('af-close-month', '35 0 1 * *', $c$select public.af_close_month(null, false, false)$c$);

-- ================= bukti transfer (bucket privat) =================
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('af-bukti', 'af-bukti', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;
do $p$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'af_bukti_r') then
    create policy af_bukti_r on storage.objects for select to authenticated
      using (bucket_id = 'af-bukti' and (public.af_can_view() or (storage.foldername(name))[1] = public.af_my_partner()::text));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'af_bukti_w') then
    create policy af_bukti_w on storage.objects for insert to authenticated
      with check (bucket_id = 'af-bukti' and public.af_is_fin());
  end if;
end $p$;
