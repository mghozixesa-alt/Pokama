-- 031: angka keputusan untuk Ringkasan affiliate — tren 6 bulan, corong mitra, utang komisi, ekonomi per booking, per kota & jenis.
-- Filter sama dengan af_admin_overview (bulan, kota, unit, jenis, demo). Bisa dilihat Owner, Kepala Staf, BizDev, Keuangan.
create or replace function public.af_admin_insight(p_month date default null, p_city text default null, p_unit text default null,
  p_kind text default null, p_demo boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m date := coalesce(p_month, public.af_month()); res jsonb; due date;
begin
  perform public.af_need_view();
  create temp table if not exists _afi on commit drop as
    select b.*, x.city, x.kind from public.af_bookings b join public.af_partners x on x.id = b.partner_id where false;
  truncate _afi;
  insert into _afi select b.*, x.city, x.kind from public.af_bookings b join public.af_partners x on x.id = b.partner_id
    where b.demo = p_demo and (p_city is null or x.city = p_city) and (p_unit is null or b.unit_code = p_unit) and (p_kind is null or x.kind = p_kind);
  create temp table if not exists _afp on commit drop as select * from public.af_partners where false;
  truncate _afp;
  insert into _afp select * from public.af_partners x where x.demo = p_demo and (p_city is null or x.city = p_city) and (p_kind is null or x.kind = p_kind);
  due := case when extract(day from (now() at time zone 'Asia/Jakarta')) <= 10 then date_trunc('month', now() at time zone 'Asia/Jakarta')::date + 9
              else (date_trunc('month', now() at time zone 'Asia/Jakarta') + interval '1 month')::date + 9 end;

  res := jsonb_build_object(
    'month', m,
    -- tren 6 bulan sampai bulan terpilih
    'trend', (select coalesce(jsonb_agg(t order by t->>'month'), '[]'::jsonb) from (
      select jsonb_build_object('month', mm,
        'booking', (select count(*) from _afi b where public.af_month(b.booked_at) = mm),
        'selesai', (select count(*) from _afi b where b.bk_status = 'selesai' and public.af_month(b.completed_at) = mm),
        'batal', (select count(*) from _afi b where b.bk_status in ('batal','refund') and public.af_month(b.booked_at) = mm),
        'revenue', (select coalesce(sum(net_amount + ext_amount), 0) from _afi b where b.bk_status = 'selesai' and b.comm_status in ('siap_cair','dicairkan') and public.af_month(b.completed_at) = mm),
        'commission', (select coalesce(sum(commission), 0) from _afi b where b.comm_status in ('siap_cair','dicairkan') and public.af_month(b.completed_at) = mm),
        'rewards', (select coalesce(sum(w.amount), 0) from public.af_rewards w join _afp x on x.id = w.partner_id where w.month = mm and w.status <> 'ditolak' and w.demo = p_demo),
        'produktif', (select count(distinct partner_id) from _afi b where b.bk_status = 'selesai' and public.af_month(b.completed_at) = mm),
        'mitra_baru', (select count(*) from _afp x where x.approved_at is not null and public.af_month(x.approved_at) = mm)) t
      from generate_series((m - interval '5 month')::date, m, interval '1 month') g(mm0), lateral (select mm0::date mm) z) q),
    -- corong mitra (semua waktu)
    'funnel', jsonb_build_object(
      'daftar', (select count(*) from _afp),
      'disetujui', (select count(*) from _afp where approved_at is not null),
      'aktif', (select count(*) from _afp where status = 'aktif'),
      'pernah_booking', (select count(distinct partner_id) from _afi),
      'pernah_selesai', (select count(distinct partner_id) from _afi where bk_status = 'selesai'),
      'rutin', (select count(*) from (select partner_id from _afi where bk_status = 'selesai' and completed_at > now() - interval '90 day' group by partner_id having count(*) >= 3) r),
      'ditolak', (select count(*) from _afp where status = 'ditolak'),
      'nonaktif', (select count(*) from _afp where status = 'nonaktif')),
    -- utang komisi (kewajiban ke mitra)
    'liability', jsonb_build_object(
      'tertunda', (select coalesce(sum(commission), 0) from _afi where comm_status = 'tertunda'),
      'tertunda_n', (select count(*) from _afi where comm_status = 'tertunda'),
      'siap_cair', (select coalesce(sum(commission), 0) from _afi where comm_status = 'siap_cair' and payout_id is null),
      'siap_cair_n', (select count(*) from _afi where comm_status = 'siap_cair' and payout_id is null),
      'hadiah_siap', (select coalesce(sum(w.amount), 0) from public.af_rewards w join _afp x on x.id = w.partner_id where w.status = 'siap_cair' and w.payout_id is null and w.demo = p_demo),
      'diajukan', (select coalesce(sum(o.net), 0) from public.af_payouts o join _afp x on x.id = o.partner_id where o.status = 'diajukan' and o.demo = p_demo),
      'disetujui', (select coalesce(sum(o.net), 0) from public.af_payouts o join _afp x on x.id = o.partner_id where o.status = 'disetujui' and o.demo = p_demo),
      'rekap_n', (select count(*) from public.af_payouts o join _afp x on x.id = o.partner_id where o.status in ('diajukan','disetujui') and o.demo = p_demo),
      'dibekukan', (select coalesce(sum(commission), 0) from _afi where frozen),
      'dibayar_total', (select coalesce(sum(o.net), 0) from public.af_payouts o join _afp x on x.id = o.partner_id where o.status = 'ditransfer' and o.demo = p_demo),
      'jatuh_tempo', due),
    -- kualitas & ekonomi bulan terpilih
    'quality', (select jsonb_build_object(
      'booked', count(*) filter (where public.af_month(booked_at) = m),
      'batal', count(*) filter (where public.af_month(booked_at) = m and bk_status in ('batal','refund')),
      'selesai', count(*) filter (where public.af_month(completed_at) = m and bk_status = 'selesai'),
      'repeat', count(*) filter (where public.af_month(completed_at) = m and bk_status = 'selesai' and repeat_cust),
      'guest_disc', count(*) filter (where public.af_month(completed_at) = m and bk_status = 'selesai' and guest_disc),
      'ext_rev', coalesce(sum(ext_amount) filter (where public.af_month(completed_at) = m and bk_status = 'selesai'), 0),
      'self_ref', count(*) filter (where public.af_month(booked_at) = m and self_ref),
      'issue', count(*) filter (where public.af_month(booked_at) = m and (issue or blacklist)),
      'hangus', count(*) filter (where public.af_month(booked_at) = m and comm_status = 'hangus'),
      'avg_rate', round(avg(rate_final) filter (where public.af_month(completed_at) = m and bk_status = 'selesai' and comm_status in ('siap_cair','dicairkan')), 2))
      from _afi),
    -- per kota & per jenis mitra bulan terpilih
    'by_city', (select coalesce(jsonb_agg(q order by (q->>'revenue')::numeric desc), '[]'::jsonb) from (
      select jsonb_build_object('key', x.city,
        'mitra', count(distinct x.id) filter (where x.status = 'aktif'),
        'produktif', count(distinct b.partner_id) filter (where b.bk_status = 'selesai' and public.af_month(b.completed_at) = m),
        'selesai', count(b.id) filter (where b.bk_status = 'selesai' and public.af_month(b.completed_at) = m),
        'revenue', coalesce(sum(b.net_amount + b.ext_amount) filter (where b.bk_status = 'selesai' and b.comm_status in ('siap_cair','dicairkan') and public.af_month(b.completed_at) = m), 0),
        'commission', coalesce(sum(b.commission) filter (where b.comm_status in ('siap_cair','dicairkan') and public.af_month(b.completed_at) = m), 0)) q
      from _afp x left join _afi b on b.partner_id = x.id group by x.city) z),
    'by_kind', (select coalesce(jsonb_agg(q order by (q->>'revenue')::numeric desc), '[]'::jsonb) from (
      select jsonb_build_object('key', x.kind,
        'mitra', count(distinct x.id) filter (where x.status = 'aktif'),
        'produktif', count(distinct b.partner_id) filter (where b.bk_status = 'selesai' and public.af_month(b.completed_at) = m),
        'selesai', count(b.id) filter (where b.bk_status = 'selesai' and public.af_month(b.completed_at) = m),
        'revenue', coalesce(sum(b.net_amount + b.ext_amount) filter (where b.bk_status = 'selesai' and b.comm_status in ('siap_cair','dicairkan') and public.af_month(b.completed_at) = m), 0),
        'commission', coalesce(sum(b.commission) filter (where b.comm_status in ('siap_cair','dicairkan') and public.af_month(b.completed_at) = m), 0)) q
      from _afp x left join _afi b on b.partner_id = x.id group by x.kind) z));
  return res;
end $$;
revoke execute on function public.af_admin_insight(date, text, text, text, boolean) from public, anon;
grant execute on function public.af_admin_insight(date, text, text, text, boolean) to authenticated;
