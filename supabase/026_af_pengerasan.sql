-- 026: pengerasan setelah Supabase security advisor + bersih-bersih uji serang (1 Nov 2026)

-- 1) search_path tetap untuk fungsi bantu
alter function public.af_audit_lock() set search_path = public, pg_temp;
alter function public.af_done(public.af_bookings) set search_path = public, pg_temp;
alter function public.af_google() set search_path = public, pg_temp;
alter function public.af_mask(text) set search_path = public, pg_temp;
alter function public.af_month(timestamptz) set search_path = public, pg_temp;
alter function public.af_norm_wa(text) set search_path = public, pg_temp;
alter function public.af_sid() set search_path = public, pg_temp;
alter function public.pk_mfa_ok() set search_path = public, pg_temp;

-- 2) fungsi bantu internal tidak bisa dipanggil langsung dari luar
revoke execute on function public.pk_me_raw(), public.af_set(text), public.af_tier_now(uuid), public.af_need(boolean, boolean),
  public.af_need_view(), public.af_is_owner(), public.af_is_biz() from public, anon, authenticated;

-- 3) tolak-semua yang tertulis eksplisit di setiap tabel baru (akses hanya lewat fungsi yang memeriksa peran)
do $d$ declare t text; begin
  foreach t in array array['af_api_blocks','af_api_hits','af_api_nonces','af_audit','af_badges','af_bookings','af_challenges','af_events',
    'af_mitra_sessions','af_month_close','af_notifs','af_otp','af_partner_rates','af_partners','af_payouts','af_rank_prizes','af_ranks',
    'af_rates','af_rewards','af_settings','af_tiers','af_unit_keys','af_units','pk_login_devices','pk_notify_kick'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'tolak_semua') then
      execute format('create policy tolak_semua on public.%I as restrictive for all to anon, authenticated using (false) with check (false)', t);
    end if;
  end loop;
end $d$;

-- 4) bersihkan sisa uji serang: kunci uji dicabut, event/booking uji dihapus, tabel bantu uji dihapus
update public.af_unit_keys set revoked_at = now(), secret_enc = null where key_id = 'ra_cbb6273ea4';
update public.af_api_blocks set until = now() where key_id = 'ra_cbb6273ea4';
update net._http_response set content = '{}' where id = -999;
delete from public.af_bookings where booking_id like 'ST%-17935%';
delete from public.af_events where booking_id like 'ST%-17935%';
drop table if exists public._st;
