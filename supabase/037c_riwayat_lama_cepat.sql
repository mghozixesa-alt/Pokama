-- 037c: riwayat sistem lama dihitung sekali ke tabel ringkas (data lama sudah tidak bertambah sejak 31 Okt 2026)
create table if not exists public.pk_fin_legacy_pay (d date, unit text, grp text, mth text, amt numeric, n int);
create table if not exists public.pk_fin_legacy_line (d date, unit text, line text, pid text, name text, amt numeric, n int);
alter table public.pk_fin_legacy_pay enable row level security;
alter table public.pk_fin_legacy_line enable row level security;
revoke all on public.pk_fin_legacy_pay, public.pk_fin_legacy_line from anon, authenticated;

create or replace function public.pk_fin_legacy_refresh() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  truncate public.pk_fin_legacy_pay; truncate public.pk_fin_legacy_line;
  create temp table _p on commit drop as
    select p.order_id, (p.created_at at time zone 'Asia/Jakarta')::date d, public.pk_fin_legacy_unit(p.store_code) unit,
      case when p.kind = 'outcome' then -p.amount else p.amount end amt,
      case when p.kind = 'outcome' then 'refund' when p.payment_type = 'Denda' then 'denda' when p.payment_type = 'Refund' then 'lain'
           when p.payment_type in ('Uang Muka', 'partial-payment', 'partially-paid') then 'dp' when p.payment_type = 'Pelunasan' then 'pelunasan' else 'lunas' end grp,
      case lower(coalesce(p.method, '')) when 'cash' then 'Tunai' when 'qris' then 'QRIS' when 'qris_bca' then 'QRIS BCA'
           when '' then 'Tidak tercatat' else 'Transfer bank' end mth
    from public.legacy_payments p;
  insert into public.pk_fin_legacy_pay select d, unit, grp, mth, sum(amt), count(*) from _p group by 1, 2, 3, 4;
  with itm as (
    select o.id, public.pk_fin_legacy_line(i->>'pid') line, i->>'n' nm, coalesce(i->>'pid', i->>'n') pid, greatest(coalesce((i->>'sub')::numeric, 0), 0) sub
    from public.legacy_orders o, jsonb_array_elements(o.items) i),
  sh as (select id, line, nm, pid, case when sum(sub) over (partition by id) > 0 then sub / sum(sub) over (partition by id) else 1.0 / count(*) over (partition by id) end s from itm)
  insert into public.pk_fin_legacy_line
    select p.d, p.unit, sh.line, sh.pid, max(sh.nm), sum(p.amt * sh.s), count(distinct p.order_id)
    from _p p join sh on sh.id = p.order_id where p.grp <> 'refund' group by 1, 2, 3, 4;
  select count(*) into n from public.pk_fin_legacy_pay;
  return n;
end $$;
revoke execute on function public.pk_fin_legacy_refresh() from anon, public, authenticated;

create or replace function public.pk_fin_legacy(p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare f date; t date; r jsonb;
begin
  perform public.pk_fin_read_check();
  select coalesce(p_from, min(d)), coalesce(p_to, max(d)) into f, t from public.pk_fin_legacy_pay;
  with rng as (select * from public.pk_fin_legacy_pay where d between f and t),
  pl as (select * from public.pk_fin_legacy_line where d between f and t),
  ord as (select o.*, public.pk_fin_legacy_unit(o.store_code) unit from public.legacy_orders o where (o.created_at at time zone 'Asia/Jakarta')::date between f and t)
  select jsonb_build_object(
    'from', f, 'to', t,
    'first', (select min(d) from public.pk_fin_legacy_pay), 'last', (select max(d) from public.pk_fin_legacy_pay),
    'monthly', (select coalesce(jsonb_agg(x order by x->>'m', x->>'unit'), '[]') from (
        select jsonb_build_object('m', to_char(d, 'YYYY-MM'), 'unit', unit, 'amt', sum(amt), 'denda', coalesce(sum(amt) filter (where grp = 'denda'), 0),
          'refund', -coalesce(sum(amt) filter (where grp = 'refund'), 0), 'n', sum(n)) x from public.pk_fin_legacy_pay group by to_char(d, 'YYYY-MM'), unit) z),
    'total', (select jsonb_build_object('amt', coalesce(sum(amt), 0), 'n', coalesce(sum(n), 0), 'denda', coalesce(sum(amt) filter (where grp = 'denda'), 0),
          'refund', -coalesce(sum(amt) filter (where grp = 'refund'), 0), 'days', count(distinct d)) from rng),
    'units', (select coalesce(jsonb_agg(jsonb_build_object('unit', unit, 'amt', a, 'n', n) order by a desc), '[]') from (select unit, sum(amt) a, sum(n) n from rng group by unit) z),
    'groups', (select coalesce(jsonb_object_agg(grp, a), '{}') from (select grp, sum(amt) a from rng group by grp) z),
    'methods', (select coalesce(jsonb_agg(jsonb_build_object('m', mth, 'amt', a, 'n', n) order by a desc), '[]') from (select mth, sum(amt) a, sum(n) n from rng where grp <> 'refund' group by mth) z),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'amt', a) order by d), '[]') from (select d, sum(amt) a from rng group by d) z),
    'weekday', (select coalesce(jsonb_agg(jsonb_build_object('w', w, 'amt', a, 'days', nd) order by w), '[]') from (select extract(isodow from d)::int w, sum(amt) a, count(distinct d) nd from rng group by 1) z),
    'lines', (select coalesce(jsonb_agg(jsonb_build_object('line', line, 'amt', round(a)) order by a desc), '[]') from (select line, sum(amt) a from pl group by line) z),
    'products', (select coalesce(jsonb_agg(jsonb_build_object('name', nm, 'line', line, 'amt', round(a), 'orders', n) order by a desc), '[]') from (
        select max(name) nm, max(line) line, sum(amt) a, sum(n) n from pl group by pid order by sum(amt) desc limit 15) z),
    'orders', (select jsonb_build_object('n', count(*), 'done', count(*) filter (where status = 'completed'), 'cancel', count(*) filter (where status = 'canceled'),
          'open', count(*) filter (where status in ('pending', 'confirmed', 'processing')),
          'unpaid_done', count(*) filter (where status = 'completed' and total > paid),
          'unpaid_amt', coalesce(sum(total - paid) filter (where status = 'completed' and total > paid), 0),
          'aov', round(avg(total) filter (where status = 'completed' and total > 0)),
          'customers', count(distinct customer_id), 'repeat', (select count(*) from (select customer_id from ord where status = 'completed' and customer_id is not null group by 1 having count(*) > 1) q)) from ord)
  ) into r;
  return r;
end $$;

select public.pk_fin_legacy_refresh();
