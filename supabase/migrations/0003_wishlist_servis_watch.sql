-- Unit tersimpan (wishlist)
create table if not exists saved_units (
  customer_id uuid not null references profiles(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, unit_id)
);
alter table saved_units enable row level security;
create policy "saved_units own" on saved_units for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

-- Klaim servis / garansi
create table if not exists service_claims (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default ('SV-' || lpad(floor(random() * 9000 + 1000)::text, 4, '0')),
  order_id uuid references orders(id) on delete set null,
  customer_id uuid not null references profiles(id),
  issue text not null,
  photos text[] not null default '{}',
  status text not null default 'diajukan', -- diajukan | dijadwalkan | dicek | diperbaiki | ditukar | ditolak | selesai
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table service_claims enable row level security;
create policy "claims own read" on service_claims for select using (customer_id = auth.uid() or is_staff());
create policy "claims create" on service_claims for insert with check (customer_id = auth.uid());
create policy "claims staff update" on service_claims for update using (is_staff());

-- Staf boleh membaca & menandai pantauan harga (untuk notif saat unit baru masuk)
create policy "price_watches staff read" on price_watches for select using (is_staff());
create policy "price_watches staff update" on price_watches for update using (is_staff());
