-- Membatalkan 019_mk_marketing.sql: menghapus semua tabel dan fungsi mk_*.
-- Tidak menyentuh tabel pk_* (KKH) atau tabel web app Rentalaja.
drop table if exists public.mk_corrections, public.mk_sync_runs, public.mk_targets, public.mk_wa_story_daily,
  public.mk_competitor_daily, public.mk_web_daily, public.mk_tiktok_daily, public.mk_gbp_reviews, public.mk_gbp_daily,
  public.mk_ads_daily, public.mk_ig_account_daily, public.mk_ig_media_daily, public.mk_ig_media,
  public.mk_kol_deals, public.mk_content_reviews, public.mk_content, public.mk_sales, public.mk_wa_conv_meta,
  public.mk_link_clicks, public.mk_competitors, public.mk_kol, public.mk_source_codes, public.mk_campaigns, public.mk_accounts;
drop function if exists public.mk_can_write(), public.mk_phone_ok(text), public.mk_channel_ok(text);
