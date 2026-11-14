-- ===== Skema privat untuk rahasia server-ke-server (tidak terekspos lewat API) =====
create schema if not exists private;
create table if not exists private.secrets (name text primary key, value text not null);
revoke all on schema private from anon, authenticated;

create or replace function private.check_secret(p_name text, p_value text) returns boolean
language sql security definer set search_path = private as $$
  select exists (select 1 from private.secrets where name = p_name and value = p_value and p_value <> '');
$$;

-- ===== Housekeeping (dipanggil cron tiap jam) =====
-- Booking lewat 24 jam tanpa bayar → dibatalkan (trigger mengembalikan unit ke 'tersedia');
-- tawaran disetujui yang lewat masa kunci → kedaluwarsa. Mengembalikan daftar pesanan yang dibatalkan untuk notifikasi.
create or replace function public.housekeeping(p_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_cancelled jsonb; v_offers int;
begin
  if not private.check_secret('cron', p_secret) then raise exception 'unauthorized'; end if;
  with c as (
    update orders set status = 'dibatalkan', notes = coalesce(notes, '') || ' | dibatalkan otomatis: lewat 24 jam'
    where status = 'menunggu_bayar' and hold_until < now()
    returning id, public_id, customer_id, points_used
  ), refund as (
    insert into points_ledger(customer_id, delta, reason, order_id)
    select customer_id, points_used, 'Dikembalikan (pesanan batal)', id from c where points_used > 0
  )
  select coalesce(jsonb_agg(jsonb_build_object('public_id', c.public_id, 'phone', p.phone)), '[]'::jsonb) into v_cancelled
  from c join profiles p on p.id = c.customer_id;
  with o as (update offers set status = 'kedaluwarsa' where status = 'disetujui' and expires_at < now() returning id)
  select count(*) into v_offers from o;
  return jsonb_build_object('cancelled', v_cancelled, 'expired_offers', v_offers);
end $$;

-- ===== API titip ke Rentalaja (Fase 3) =====
-- Daftar unit yang dititipkan beserta bagi hasil (untuk ditarik sistem Rentalaja)
create or replace function public.rentalaja_units(p_secret text) returns jsonb
language sql security definer set search_path = public as $$
  select case when private.check_secret('rentalaja', p_secret) then
    coalesce(jsonb_agg(jsonb_build_object(
      'unit_id', u.id, 'public_id', u.public_id, 'rentalaja_asset_id', coalesce(c.rentalaja_asset_id, u.rentalaja_asset_id),
      'category', u.category, 'brand', u.brand, 'model', u.model, 'variant', u.variant, 'grade', u.grade, 'specs', u.specs,
      'photos', u.photos, 'price_sell', u.price_sell, 'consignment_status', c.status,
      'share', jsonb_build_object('rentalaja', c.share_rentalaja_pct, 'owner', c.share_owner_pct, 'niagaaja', c.share_niagaaja_pct),
      'updated_at', greatest(u.updated_at, c.updated_at)
    )), '[]'::jsonb)
  else null end
  from units u join consignments c on c.unit_id = u.id
  where u.status = 'dititip_rentalaja' and c.status <> 'ditarik';
$$;

create unique index if not exists consignments_unit_uidx on consignments(unit_id);

-- Event dari Rentalaja: diterima | keluar_disewa | kembali_qc | ditarik | terjual | pendapatan
-- Idempoten lewat event_id. Payload bebas (mis. {"amount": 150000, "period": "2026-11", "renter": "..."}).
create or replace function public.rentalaja_event(p_secret text, p_event_id text, p_type text, p_public_id text, p_asset_id text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_unit units%rowtype; v_dup boolean; v_status consignment_status;
begin
  if not private.check_secret('rentalaja', p_secret) then raise exception 'unauthorized'; end if;
  select exists(select 1 from sync_events where event_id = p_event_id) into v_dup;
  if v_dup then return jsonb_build_object('ok', true, 'duplicate', true); end if;
  select * into v_unit from units where public_id = p_public_id or (p_asset_id is not null and rentalaja_asset_id = p_asset_id) limit 1;
  if v_unit.id is null then raise exception 'unit tidak ditemukan: %', coalesce(p_public_id, p_asset_id); end if;
  insert into sync_events(direction, event_id, event_type, unit_id, payload) values ('in', p_event_id, p_type, v_unit.id, coalesce(p_payload, '{}'::jsonb));
  if p_type in ('diterima','keluar_disewa','kembali_qc','ditarik','terjual') then
    v_status := p_type::consignment_status;
    insert into consignments(unit_id, rentalaja_asset_id, status, last_sync_at, last_event)
    values (v_unit.id, p_asset_id, v_status, now(), jsonb_build_object('type', p_type, 'payload', p_payload))
    on conflict (unit_id) do update set status = excluded.status, rentalaja_asset_id = coalesce(excluded.rentalaja_asset_id, consignments.rentalaja_asset_id), last_sync_at = now(), last_event = excluded.last_event;
    if p_asset_id is not null then update units set rentalaja_asset_id = p_asset_id where id = v_unit.id; end if;
    if p_type = 'diterima' then update units set status = 'dititip_rentalaja' where id = v_unit.id;
    elsif p_type = 'ditarik' then update units set status = 'qc' where id = v_unit.id;
    elsif p_type = 'terjual' then update units set status = 'terjual' where id = v_unit.id;
    end if;
  elsif p_type = 'pendapatan' then
    update consignments set last_sync_at = now(), last_event = jsonb_build_object('type', p_type, 'payload', p_payload) where unit_id = v_unit.id;
  else
    raise exception 'event_type tidak dikenal: %', p_type;
  end if;
  return jsonb_build_object('ok', true, 'unit_id', v_unit.id, 'public_id', v_unit.public_id);
end $$;

grant execute on function public.housekeeping(text) to anon, authenticated;
grant execute on function public.rentalaja_units(text) to anon, authenticated;
grant execute on function public.rentalaja_event(text, text, text, text, text, jsonb) to anon, authenticated;

-- ===== Penjadwal (pg_cron + pg_net): tiap jam panggil endpoint housekeeping =====
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create or replace function private.call_housekeeping() returns void
language plpgsql security definer set search_path = private, extensions as $$
declare v_secret text;
begin
  select value into v_secret from private.secrets where name = 'cron';
  perform net.http_get(url := 'https://niagaaja.vercel.app/api/cron/housekeeping',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret), timeout_milliseconds := 15000);
end $$;
select cron.schedule('niagaaja_housekeeping', '5 * * * *', $$select private.call_housekeeping()$$);
-- Cron Vercel (vercel.json) hanya cadangan harian (paket Hobby membatasi 1×/hari).

-- ===== Pengerasan keamanan (hasil Supabase advisor) =====
alter function public.set_updated_at() set search_path = public;
alter function public.sync_unit_grade() set search_path = public;
alter function public.sync_unit_on_order() set search_path = public;
alter function public.apply_points() set search_path = public;
alter function public.handle_new_user() set search_path = public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.use_points_for_order(uuid, int) from anon, public;
revoke execute on function public.housekeeping(text) from authenticated, public;
revoke execute on function public.rentalaja_units(text) from authenticated, public;
revoke execute on function public.rentalaja_event(text, text, text, text, text, jsonb) from authenticated, public;
