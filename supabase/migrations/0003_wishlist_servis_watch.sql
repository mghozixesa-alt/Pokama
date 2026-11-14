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

-- (0004) Pelanggan memakai poin untuk pesanannya sendiri; maks 20% harga; 1 poin = value_per_point (settings.points)
create or replace function use_points_for_order(p_order uuid, p_points int) returns int
language plpgsql security definer set search_path = public as $$
declare v_customer uuid; v_balance int; v_amount int; v_value int; v_max int;
begin
  select customer_id, amount into v_customer, v_amount from orders where id = p_order;
  if v_customer is null or v_customer <> auth.uid() then raise exception 'Bukan pesanan Anda'; end if;
  if p_points is null or p_points <= 0 then return 0; end if;
  select coalesce((value->>'value_per_point')::int, 100) into v_value from settings where key = 'points';
  v_max := floor(v_amount * 0.2 / v_value);
  p_points := least(p_points, v_max);
  select points_balance into v_balance from profiles where id = v_customer;
  if v_balance < p_points then raise exception 'Poin tidak cukup'; end if;
  insert into points_ledger(customer_id, delta, reason, order_id) values (v_customer, -p_points, 'Dipakai untuk pesanan', p_order);
  update orders set points_used = p_points, amount = amount - p_points * v_value where id = p_order;
  return p_points;
end $$;
grant execute on function use_points_for_order(uuid, int) to authenticated;
