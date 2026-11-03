-- 046 Data tambahan Dasbor Keuangan bergambar: utilisasi unit, omzet & target per bulan, target per unit bulan ini.
create or replace function public.pk_fin_dash_extra(p_year int default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare y int := coalesce(p_year, extract(year from public.pk_today())::int); m0 date := make_date(y, 1, 1); cm date := date_trunc('month', public.pk_today())::date;
begin
  perform public.pk_fin_read_check();
  return jsonb_build_object(
    'util', (select jsonb_build_object('total', count(*), 'rented', count(*) filter (where status = 'rented'), 'service', count(*) filter (where status = 'service'),
             'ready', count(*) filter (where status = 'ready')) from public.units where archived_at is null),
    'months', (select coalesce(jsonb_agg(jsonb_build_object('m', to_char(mm, 'YYYY-MM'),
        'rev', coalesce((select sum(l.credit - l.debit) from public.pk_fin_lines l join public.pk_fin_entries e on e.id = l.entry_id
                         where left(l.account_code, 1) in ('4', '7') and date_trunc('month', e.entry_date) = mm), 0),
        'target', coalesce((select sum(t.amount) from public.pk_targets t where t.month = mm::date), 0)) order by mm), '[]'::jsonb)
      from generate_series(m0::timestamp, make_date(y, 12, 1)::timestamp, interval '1 month') mm),
    'targets', (select coalesce(jsonb_object_agg(b, amt), '{}'::jsonb) from (
        select coalesce(u.parent, u.code) b, sum(t.amount) amt from public.pk_targets t join public.pk_units u on u.code = t.unit_code
        where t.month = cm group by 1) z),
    'pf', public.pk_fin_settings_get()->'fin_profit_first');
end $$;
revoke execute on function public.pk_fin_dash_extra(int) from public, anon;
grant execute on function public.pk_fin_dash_extra(int) to authenticated, service_role;
