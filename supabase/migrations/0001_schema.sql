-- Niagaaja — skema awal (Fase 1 + tabel Fase 2/3 agar tidak perlu migrasi ulang)
create extension if not exists "pgcrypto";

-- ===== Enum =====
create type unit_category as enum ('hp','laptop','kamera','tablet','konsol','audio','smartwatch','drone','aksesori');
create type unit_grade as enum ('A','B','C');
create type unit_source as enum ('beli_pelanggan','tukar_tambah','investor','titipan','eks_sewa_rentalaja');
create type unit_status as enum ('masuk','qc','tersedia','dipesan','terjual','dititip_rentalaja','ditarik','afkir');
create type branch as enum ('garut_kota','wanaraja','bandung');
create type owner_type as enum ('sendiri','investor','titipan');
create type offer_status as enum ('diajukan','counter','disetujui','ditolak','kedaluwarsa','dipakai');
create type order_status as enum ('menunggu_bayar','menunggu_konfirmasi','dibayar','disiapkan','dikirim','selesai','dibatalkan','retur');
create type fulfillment as enum ('ambil_di_toko','kirim');
create type payment_method as enum ('transfer','tunai');
create type trade_in_status as enum ('diajukan','dijadwalkan','dicek','deal','batal');
create type consignment_status as enum ('ditawarkan','diterima','keluar_disewa','kembali_qc','ditarik','terjual');
create type staff_role as enum ('admin','qc','cs','investor');

-- ===== Helper =====
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ===== Profiles (pelanggan & staf) =====
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  role staff_role,                 -- null = pelanggan biasa
  points_balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on profiles for each row execute function set_updated_at();

create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create or replace function is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin','qc','cs'));
$$;

-- ===== Owners (investor & penitip) =====
create table owners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type owner_type not null,
  phone text,
  email text,
  bank_name text,
  bank_account_masked text,           -- hanya 4 digit terakhir yang disimpan di sini
  profile_id uuid references profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger owners_updated before update on owners for each row execute function set_updated_at();

-- ===== Units =====
create sequence unit_public_seq start 1;
create table units (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default ('NJ-' || lpad(nextval('unit_public_seq')::text, 4, '0')),
  category unit_category not null,
  brand text not null,
  model text not null,
  variant text,
  specs jsonb not null default '{}'::jsonb,
  condition_note text,
  grade unit_grade,
  price_new integer,
  price_sell integer not null default 0,
  price_floor integer,
  source unit_source not null default 'beli_pelanggan',
  rentalaja_asset_id text,
  status unit_status not null default 'masuk',
  branch branch not null default 'garut_kota',
  photos text[] not null default '{}',
  is_hot boolean not null default false,
  hot_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index units_status_idx on units(status);
create index units_category_idx on units(category);
create trigger units_updated before update on units for each row execute function set_updated_at();

-- ===== Ownerships =====
create table ownerships (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  owner_type owner_type not null default 'sendiri',
  owner_id uuid references owners(id),
  cost_basis integer not null default 0,
  share_owner_pct numeric(5,2) not null default 0,
  share_niagaaja_pct numeric(5,2) not null default 100,
  agreement_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ownerships_unit_idx on ownerships(unit_id);
create trigger ownerships_updated before update on ownerships for each row execute function set_updated_at();

-- ===== Inspections (sertifikat cek 8 langkah) =====
create table inspections (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  checklist jsonb not null default '[]'::jsonb,   -- [{step, label, status: lolos|minus|gagal, note, photo}]
  result_grade unit_grade not null,
  inspector_id uuid references profiles(id),
  certificate_no text not null unique,
  qr_token text not null unique default encode(gen_random_bytes(9), 'hex'),
  disclosed_source boolean not null default true,
  inspected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index inspections_unit_idx on inspections(unit_id);

-- salin grade hasil cek terakhir ke unit
create or replace function sync_unit_grade() returns trigger language plpgsql as $$
begin
  update units set grade = new.result_grade, status = case when status in ('masuk','qc') then 'tersedia' else status end
  where id = new.unit_id;
  return new;
end $$;
create trigger inspections_sync_grade after insert on inspections for each row execute function sync_unit_grade();

-- ===== Offers (tawar harga) =====
create table offers (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  customer_id uuid not null references profiles(id),
  amount integer not null,
  status offer_status not null default 'diajukan',
  counter_amount integer,
  message text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger offers_updated before update on offers for each row execute function set_updated_at();

-- ===== Orders & payments (pembayaran manual) =====
create sequence order_public_seq start 1;
create table orders (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default ('NJO-' || lpad(nextval('order_public_seq')::text, 5, '0')),
  unit_id uuid not null references units(id),
  customer_id uuid not null references profiles(id),
  offer_id uuid references offers(id),
  amount integer not null,
  unique_code integer not null default (floor(random() * 900) + 100)::int,  -- 3 digit nominal unik
  points_used integer not null default 0,
  points_earned integer not null default 0,
  fulfillment fulfillment not null default 'ambil_di_toko',
  shipping_address text,
  status order_status not null default 'menunggu_bayar',
  hold_until timestamptz not null default now() + interval '24 hours',
  warranty_until date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_customer_idx on orders(customer_id);
create trigger orders_updated before update on orders for each row execute function set_updated_at();

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  method payment_method not null default 'transfer',
  amount integer not null,
  proof_url text,
  bank_name text,
  sender_name text,
  confirmed_by uuid references profiles(id),
  paid_at timestamptz,
  rejected_reason text,
  created_at timestamptz not null default now()
);
create index payments_order_idx on payments(order_id);

-- unit ikut status order
create or replace function sync_unit_on_order() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update units set status = 'dipesan' where id = new.unit_id and status = 'tersedia';
  elsif new.status in ('dibatalkan') and old.status <> new.status then
    update units set status = 'tersedia' where id = new.unit_id and status = 'dipesan';
  elsif new.status in ('dibayar') and old.status <> new.status then
    update units set status = 'terjual' where id = new.unit_id;
  elsif new.status = 'selesai' and old.status <> new.status then
    update orders set warranty_until = current_date + case when (select grade from units where id = new.unit_id) = 'C' then 7 else 30 end
    where id = new.id and warranty_until is null;
  end if;
  return new;
end $$;
create trigger orders_sync_unit after insert or update on orders for each row execute function sync_unit_on_order();

-- ===== Trade-ins, price watches, points =====
create table trade_ins (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id),
  category unit_category not null,
  brand text, model text, variant text,
  condition jsonb not null default '{}'::jsonb,
  photos text[] not null default '{}',
  estimate_low integer, estimate_high integer,
  final_price integer,
  status trade_in_status not null default 'diajukan',
  unit_id uuid references units(id),
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trade_ins_updated before update on trade_ins for each row execute function set_updated_at();

create table price_watches (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id),
  unit_id uuid references units(id) on delete cascade,
  category unit_category,
  model_query text,
  grade unit_grade,
  target_price integer,
  last_notified_at timestamptz,
  created_at timestamptz not null default now()
);

create table points_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id),
  delta integer not null,
  reason text not null,
  order_id uuid references orders(id),
  created_at timestamptz not null default now()
);
create or replace function apply_points() returns trigger language plpgsql as $$
begin
  update profiles set points_balance = points_balance + new.delta where id = new.customer_id;
  return new;
end $$;
create trigger points_apply after insert on points_ledger for each row execute function apply_points();

-- ===== Consignments & sync (Fase 3) =====
create table consignments (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  rentalaja_asset_id text,
  status consignment_status not null default 'ditawarkan',
  share_rentalaja_pct numeric(5,2) not null default 30,
  share_owner_pct numeric(5,2) not null default 30,
  share_niagaaja_pct numeric(5,2) not null default 40,
  last_sync_at timestamptz,
  last_event jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger consignments_updated before update on consignments for each row execute function set_updated_at();

create table sync_events (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('in','out')),
  event_id text not null unique,
  event_type text not null,
  unit_id uuid references units(id),
  payload jsonb not null,
  status text not null default 'ok',
  attempts integer not null default 1,
  created_at timestamptz not null default now()
);

-- ===== Settings =====
create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into settings (key, value) values
  ('grade_multiplier', '{"A":1,"B":0.9,"C":0.78}'),
  ('offer_min_pct', '85'),
  ('offer_lock_hours', '24'),
  ('order_hold_hours', '24'),
  ('warranty_days', '{"A":30,"B":30,"C":7}'),
  ('points', '{"earn_per_rupiah":10000,"value_per_point":100,"review_bonus":50,"trade_in_bonus":200}'),
  ('bank_account', '{"bank":"BCA","number":"0000000000","holder":"PT Popo Karya Investama"}'),
  ('consignment_share', '{"rentalaja":30,"owner":30,"niagaaja":40}');

-- ===== RLS =====
alter table profiles enable row level security;
alter table owners enable row level security;
alter table units enable row level security;
alter table ownerships enable row level security;
alter table inspections enable row level security;
alter table offers enable row level security;
alter table orders enable row level security;
alter table payments enable row level security;
alter table trade_ins enable row level security;
alter table price_watches enable row level security;
alter table points_ledger enable row level security;
alter table consignments enable row level security;
alter table sync_events enable row level security;
alter table settings enable row level security;

create policy "profiles self read" on profiles for select using (id = auth.uid() or is_staff());
create policy "profiles self update" on profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "units public read" on units for select using (status in ('tersedia','dipesan','terjual') or is_staff());
create policy "units staff write" on units for all using (is_staff()) with check (is_staff());

create policy "owners staff" on owners for all using (is_staff()) with check (is_staff());
create policy "owners self read" on owners for select using (profile_id = auth.uid());

create policy "ownerships staff" on ownerships for all using (is_staff()) with check (is_staff());
create policy "ownerships owner read" on ownerships for select using (owner_id in (select id from owners where profile_id = auth.uid()));

create policy "inspections public read" on inspections for select using (true);
create policy "inspections staff write" on inspections for all using (is_staff()) with check (is_staff());

create policy "offers own" on offers for select using (customer_id = auth.uid() or is_staff());
create policy "offers create" on offers for insert with check (customer_id = auth.uid());
create policy "offers staff update" on offers for update using (is_staff());

create policy "orders own" on orders for select using (customer_id = auth.uid() or is_staff());
create policy "orders create" on orders for insert with check (customer_id = auth.uid());
create policy "orders staff update" on orders for update using (is_staff());

create policy "payments own" on payments for select using (is_staff() or order_id in (select id from orders where customer_id = auth.uid()));
create policy "payments create" on payments for insert with check (order_id in (select id from orders where customer_id = auth.uid()));
create policy "payments staff update" on payments for update using (is_staff());

create policy "trade_ins own" on trade_ins for select using (customer_id = auth.uid() or is_staff());
create policy "trade_ins create" on trade_ins for insert with check (customer_id = auth.uid());
create policy "trade_ins staff update" on trade_ins for update using (is_staff());

create policy "price_watches own" on price_watches for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy "points own" on points_ledger for select using (customer_id = auth.uid() or is_staff());
create policy "points staff" on points_ledger for insert with check (is_staff());

create policy "consignments staff" on consignments for all using (is_staff()) with check (is_staff());
create policy "sync staff" on sync_events for all using (is_staff()) with check (is_staff());
create policy "settings read" on settings for select using (true);
create policy "settings staff" on settings for all using (is_staff()) with check (is_staff());

-- ===== Storage buckets =====
insert into storage.buckets (id, name, public) values ('units', 'units', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('proofs', 'proofs', false) on conflict do nothing;
create policy "units photos public" on storage.objects for select using (bucket_id = 'units');
create policy "units photos staff" on storage.objects for insert with check (bucket_id = 'units' and is_staff());
create policy "proofs own upload" on storage.objects for insert with check (bucket_id = 'proofs' and auth.uid() is not null);
create policy "proofs read" on storage.objects for select using (bucket_id = 'proofs' and (is_staff() or owner = auth.uid()));
