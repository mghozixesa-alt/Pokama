-- 037: riwayat keuangan Rentalaja sistem lama (legacy_payments + legacy_orders, Sep 2024 – 31 Okt 2026)
-- ditampilkan di Keuangan grup sebagai riwayat omzet (uang masuk per cabang, lini, metode).
-- TIDAK diposting ke buku besar: neraca dimulai dari saldo awal (Jurnal Mekari), jadi riwayat ini tidak dobel.

create or replace function public.pk_fin_legacy_unit(p_store text) returns text
language sql immutable as $$
  select case p_store when 'GRT' then 'GK' when 'WNR' then 'WN' when 'BDG-JKL' then 'BD' else 'RA' end
$$;

create or replace function public.pk_fin_legacy_line(p_pid text) returns text
language sql immutable as $$
  select case split_part(coalesce(p_pid, ''), '-', 1)
    when 'DRIVEINAJA_RENTALAJA' then 'Kendaraan (Driveinaja)' when 'POPOCAMERA' then 'Kamera (Popocamera)'
    when 'IPHONEAJA' then 'iPhone (Iphoneaja)' when 'PERGIPIKNIK' then 'Camping (Pergipiknik)'
    when 'GAMEINAJA' then 'Game (Gameinaja)' when 'FASHIONAJA' then 'Fashion (Fashionaja)' else 'Lainnya' end
$$;

create or replace function public.pk_fin_legacy(p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare f date; t date; r jsonb;
begin
  perform public.pk_fin_read_check();
  select coalesce(p_from, min((created_at at time zone 'Asia/Jakarta')::date)), coalesce(p_to, max((created_at at time zone 'Asia/Jakarta')::date))
    into f, t from public.legacy_payments;
  with pay as (
    select p.*, (p.created_at at time zone 'Asia/Jakarta')::date d, public.pk_fin_legacy_unit(p.store_code) unit,
      case when p.kind = 'outcome' then -p.amount else p.amount end amt,
      case when p.kind = 'outcome' then 'refund'
           when p.payment_type = 'Denda' then 'denda'
           when p.payment_type = 'Refund' then 'lain'
           when p.payment_type in ('Uang Muka', 'partial-payment', 'partially-paid') then 'dp'
           when p.payment_type = 'Pelunasan' then 'pelunasan'
           else 'lunas' end grp,
      case lower(coalesce(p.method, '')) when 'cash' then 'Tunai' when 'qris' then 'QRIS' when 'qris_bca' then 'QRIS BCA'
           when '' then 'Tidak tercatat' else 'Transfer bank' end mth
    from public.legacy_payments p),
  rng as (select * from pay where d between f and t),
  -- uang masuk dibagi ke lini sesuai porsi item di order
  itm as (
    select o.id, public.pk_fin_legacy_line(i->>'pid') line, i->>'n' nm, coalesce(i->>'pid', i->>'n') pid,
           greatest(coalesce((i->>'sub')::numeric, 0), 0) sub, coalesce((i->>'q')::int, 1) q
    from public.legacy_orders o, jsonb_array_elements(o.items) i where o.id in (select distinct order_id from rng)),
  share as (select id, line, nm, pid, q, case when sum(sub) over (partition by id) > 0 then sub / sum(sub) over (partition by id) else 1.0 / count(*) over (partition by id) end s from itm),
  pl as (select s.line, s.nm, s.pid, s.q, r.amt * s.s amt, r.order_id from rng r join share s on s.id = r.order_id where r.grp <> 'refund'),
  ord as (select o.*, (o.created_at at time zone 'Asia/Jakarta')::date d, public.pk_fin_legacy_unit(o.store_code) unit from public.legacy_orders o where (o.created_at at time zone 'Asia/Jakarta')::date between f and t)
  select jsonb_build_object(
    'from', f, 'to', t,
    'first', (select min(d) from pay), 'last', (select max(d) from pay),
    'monthly', (select coalesce(jsonb_agg(x order by x->>'m', x->>'unit'), '[]') from (
        select jsonb_build_object('m', to_char(d, 'YYYY-MM'), 'unit', unit, 'amt', sum(amt), 'denda', sum(amt) filter (where grp = 'denda'),
          'refund', -coalesce(sum(amt) filter (where grp = 'refund'), 0), 'n', count(*)) x from pay group by to_char(d, 'YYYY-MM'), unit) z),
    'total', (select jsonb_build_object('amt', coalesce(sum(amt), 0), 'n', count(*), 'denda', coalesce(sum(amt) filter (where grp = 'denda'), 0),
          'refund', -coalesce(sum(amt) filter (where grp = 'refund'), 0), 'days', count(distinct d)) from rng),
    'units', (select coalesce(jsonb_agg(jsonb_build_object('unit', unit, 'amt', a, 'n', n) order by a desc), '[]') from (select unit, sum(amt) a, count(*) n from rng group by unit) z),
    'groups', (select coalesce(jsonb_object_agg(grp, a), '{}') from (select grp, sum(amt) a from rng group by grp) z),
    'methods', (select coalesce(jsonb_agg(jsonb_build_object('m', mth, 'amt', a, 'n', n) order by a desc), '[]') from (select mth, sum(amt) a, count(*) n from rng where grp <> 'refund' group by mth) z),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'amt', a) order by d), '[]') from (select d, sum(amt) a from rng group by d) z),
    'weekday', (select coalesce(jsonb_agg(jsonb_build_object('w', w, 'amt', a, 'days', nd) order by w), '[]') from (select extract(isodow from d)::int w, sum(amt) a, count(distinct d) nd from rng group by 1) z),
    'lines', (select coalesce(jsonb_agg(jsonb_build_object('line', line, 'amt', round(a)) order by a desc), '[]') from (select line, sum(amt) a from pl group by line) z),
    'products', (select coalesce(jsonb_agg(jsonb_build_object('name', nm, 'line', line, 'amt', round(a), 'orders', n) order by a desc), '[]') from (
        select max(nm) nm, max(line) line, sum(amt) a, count(distinct order_id) n from pl group by pid order by sum(amt) desc limit 15) z),
    'orders', (select jsonb_build_object('n', count(*), 'done', count(*) filter (where status = 'completed'), 'cancel', count(*) filter (where status = 'canceled'),
          'open', count(*) filter (where status in ('pending', 'confirmed', 'processing')),
          'unpaid_done', count(*) filter (where status = 'completed' and pay_status <> 'fully-paid' and total > paid),
          'unpaid_amt', coalesce(sum(total - paid) filter (where status = 'completed' and total > paid), 0),
          'aov', round(avg(total) filter (where status = 'completed' and total > 0)),
          'customers', count(distinct customer_id), 'repeat', (select count(*) from (select customer_id from ord where status = 'completed' and customer_id is not null group by 1 having count(*) > 1) q)) from ord)
  ) into r;
  return r;
end $$;

revoke execute on function public.pk_fin_legacy(date, date) from anon, public;
grant execute on function public.pk_fin_legacy(date, date) to authenticated;
