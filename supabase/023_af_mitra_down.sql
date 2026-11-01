-- Membatalkan Program Mitra Affiliate (023). Menghapus semua data mitra!
select cron.unschedule('af-close-month') where exists (select 1 from cron.job where jobname = 'af-close-month');
drop table if exists public.af_notifs, public.af_audit, public.af_month_close, public.af_badges, public.af_rewards, public.af_ranks,
  public.af_rank_prizes, public.af_challenges, public.af_tiers, public.af_bookings, public.af_payouts, public.af_events,
  public.af_partner_rates, public.af_partners, public.af_settings, public.af_rates, public.af_unit_keys, public.af_units cascade;
do $$ declare f record; begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'af\_%' loop
    execute 'drop function if exists ' || f.sig || ' cascade';
  end loop;
end $$;
