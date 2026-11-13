-- Lihat portal sebagai investor (khusus CEO, hanya lihat). Fungsi baca portal memakai iv_view_id();
-- fungsi tulis (tarik dana, minat, investasi ulang) tetap memakai iv_my_id() sehingga CEO tidak bisa bertindak atas nama investor.
create table if not exists public.iv_preview (
  user_id uuid primary key, investor_id uuid not null references public.iv_investors(id) on delete cascade,
  started_at timestamptz not null default now(), expires_at timestamptz not null);
alter table public.iv_preview enable row level security;
revoke all on public.iv_preview from anon, authenticated;

create or replace function public.iv_view_id() returns uuid language sql stable security definer set search_path = public as $$
  select coalesce((select p.investor_id from public.iv_preview p where p.user_id = auth.uid() and p.expires_at > now() and public.iv_is_owner()), public.iv_my_id()) $$;

create or replace function public.iv_preview_start(p_inv uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.iv_investors;
begin
  perform public.iv_need('owner');
  select * into r from public.iv_investors where id = p_inv;
  if r.id is null then raise exception 'Investor tidak ditemukan'; end if;
  insert into public.iv_preview(user_id, investor_id, expires_at) values (auth.uid(), p_inv, now() + interval '30 minutes')
  on conflict (user_id) do update set investor_id = excluded.investor_id, started_at = now(), expires_at = excluded.expires_at;
  perform public.iv_log('lihat_sebagai', p_inv::text, r.name);
  return jsonb_build_object('name', r.name, 'expires_at', now() + interval '30 minutes');
end $$;

create or replace function public.iv_preview_stop() returns void
language sql security definer set search_path = public as $$ delete from public.iv_preview where user_id = auth.uid() $$;

create or replace function public.iv_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.iv_view_id(); r public.iv_investors; h public.iv_holdings; m0 timestamptz; d0 timestamptz; d1 timestamptz;
  hs jsonb := '[]'; cm jsonb; td jsonb; yd jsonb; last jsonb; live numeric := 0; today numeric := 0; yday numeric := 0; cur date;
begin
  if me is null then raise exception 'Akun ini belum terdaftar sebagai investor'; end if;
  select * into r from public.iv_investors where id = me;
  cur := public.iv_month();
  m0 := cur::timestamp at time zone 'Asia/Jakarta';
  d0 := date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
  d1 := d0 - interval '1 day';
  for h in select * from public.iv_holdings where investor_id = me and status in ('aktif','selesai') order by status, started_on loop
    cm := case when h.status = 'aktif' then public.iv_calc(h.id, m0, now()) end;
    td := case when h.status = 'aktif' then public.iv_calc(h.id, d0, now()) end;
    yd := case when h.status = 'aktif' then public.iv_calc(h.id, d1, d0) end;
    select to_jsonb(x) into last from (select period, share, status, kind from public.iv_statements
      where holding_id = h.id and status = 'terkunci' order by period desc, kind limit 1) x;
    if h.status = 'aktif' and coalesce((cm->>'auto')::boolean, false)
       and not exists (select 1 from public.iv_statements where holding_id = h.id and period = cur and status = 'terkunci') then
      live := live + coalesce((cm->>'share')::numeric, 0);
    end if;
    today := today + coalesce((td->>'share')::numeric, 0);
    yday := yday + coalesce((yd->>'share')::numeric, 0);
    hs := hs || jsonb_build_object('h', public.iv_holding_json(h), 'month', cm, 'today', td, 'yesterday', yd, 'last', last,
      'total', (select coalesce(sum(share), 0) from public.iv_statements where holding_id = h.id and status = 'terkunci'));
  end loop;
  return jsonb_build_object(
    'me', jsonb_build_object('name', r.name, 'email', r.email, 'kind', r.kind, 'kyc_status', r.kyc_status,
       'bank', case when r.bank_name is null then null else r.bank_name || ' •••• ' || coalesce(r.bank_last4, '') end,
       'bank_holder', r.bank_holder, 'wa', case when r.wa is null then null else '+' || left(r.wa, 4) || '••••' || right(r.wa, 3) end,
       'nik', case when r.nik_last4 is null then null else '•••• ' || r.nik_last4 end, 'npwp', case when r.npwp_last4 is null then null else '•••• ' || r.npwp_last4 end,
       'demo', r.demo),
    'period', cur, 'now', now(), 'holdings', hs,
    'principal', (select coalesce(sum(principal), 0) from public.iv_holdings where investor_id = me and status = 'aktif'),
    'today', today, 'yesterday', yday, 'month_live', live,
    'year_total', (select coalesce(sum(share), 0) from public.iv_statements where investor_id = me and status = 'terkunci' and kind <> 'modal'
                    and period >= date_trunc('year', cur)::date),
    'all_total', (select coalesce(sum(share), 0) from public.iv_statements where investor_id = me and status = 'terkunci' and kind <> 'modal'),
    'balance', public.iv_balance(me),
    'withdrawals', (select coalesce(jsonb_agg(to_jsonb(w) order by w.requested_at desc), '[]') from
       (select id, amount, status, requested_at, paid_at, reason, bank_snapshot from public.iv_withdrawals where investor_id = me order by requested_at desc limit 20) w),
    'docs', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title)), '[]') from public.iv_holdings where investor_id = me and doc_path is not null and status in ('aktif','selesai')));
end $$;

create or replace function public.iv_reports(p_year int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.iv_view_id();
begin
  if me is null then raise exception 'Akun ini belum terdaftar sebagai investor'; end if;
  return jsonb_build_object('year', p_year,
    'months', (select coalesce(jsonb_agg(m order by m->>'period' desc), '[]') from (
      select jsonb_build_object('period', s.period,
        'revenue', sum(s.revenue), 'costs', sum(s.costs), 'share', coalesce(sum(s.share) filter (where s.kind <> 'modal'), 0),
        'modal', coalesce(sum(s.share) filter (where s.kind = 'modal'), 0),
        'rows', jsonb_agg(jsonb_build_object('title', h.title, 'unit', public.iv_unit_name(h.unit_code), 'jenis', h.jenis, 'kind', s.kind,
                 'revenue', s.revenue, 'costs', s.costs, 'base', s.base, 'share', s.share, 'units', s.detail->'units') order by h.title)) m
      from public.iv_statements s join public.iv_holdings h on h.id = s.holding_id
      where s.investor_id = me and s.status = 'terkunci' and extract(year from s.period) = p_year
      group by s.period) q),
    'paid', (select coalesce(sum(amount), 0) from public.iv_withdrawals where investor_id = me and status = 'dibayar' and extract(year from paid_at at time zone 'Asia/Jakarta') = p_year));
end $$;

create or replace function public.iv_holding_detail(p_h uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.iv_view_id(); h public.iv_holdings; m0 timestamptz; acts jsonb := '[]'; prev jsonb;
begin
  select * into h from public.iv_holdings where id = p_h;
  if not found or (h.investor_id is distinct from me and not public.iv_can_view()) then raise exception 'Investasi tidak ditemukan'; end if;
  m0 := public.iv_month()::timestamp at time zone 'Asia/Jakarta';
  if h.jenis = 'aset' and h.rp_agreement_id is not null then
    select coalesce(jsonb_agg(x order by x->>'at' desc), '[]') into acts from (
      select jsonb_build_object('at', lower(bi.period), 'unit', p.name || ' ' || u.code, 'branch', br.name, 'source', b.source,
        'hours', round(extract(epoch from (upper(bi.period) - lower(bi.period))) / 3600)) x
      from public.booking_items bi join public.bookings b on b.id = bi.booking_id
      join public.units u on u.id = bi.unit_id join public.products p on p.id = u.product_id join public.branches br on br.id = u.branch_id
      where bi.unit_id = any(app.partner_scope_units(h.rp_agreement_id)) and bi.status <> 'released'
        and b.status in ('confirmed','active','returned','completed') and lower(bi.period) <= now()
      order by lower(bi.period) desc limit 12) s;
  end if;
  prev := public.iv_calc(h.id, (public.iv_month() - interval '1 month')::timestamp at time zone 'Asia/Jakarta', m0);
  return jsonb_build_object('h', public.iv_holding_json(h),
    'month', case when h.status = 'aktif' then public.iv_calc(h.id, m0, now()) end,
    'prev', prev,
    'd30', case when h.status = 'aktif' then public.iv_calc(h.id, now() - interval '30 days', now()) end,
    'book', public.iv_holding_book(h.id),
    'activity', acts,
    'statements', (select coalesce(jsonb_agg(jsonb_build_object('period', period, 'kind', kind, 'base', base, 'revenue', revenue, 'costs', costs, 'share', share) order by period desc), '[]')
                   from public.iv_statements where holding_id = h.id and status = 'terkunci'),
    'total', (select coalesce(sum(share), 0) from public.iv_statements where holding_id = h.id and status = 'terkunci' and kind <> 'modal'));
end $$;

create or replace function public.iv_growth(p_days int default 90) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.iv_view_id(); dd date; t0 date; s numeric; h public.iv_holdings; c jsonb; daily jsonb := '[]'; n int; cached numeric;
begin
  if me is null then raise exception 'Akun ini belum terdaftar sebagai investor'; end if;
  n := least(greatest(coalesce(p_days, 90), 7), 120);
  t0 := (now() at time zone 'Asia/Jakarta')::date;
  for dd in select g::date from generate_series(t0 - (n - 1), t0, interval '1 day') g loop
    s := 0;
    for h in select * from public.iv_holdings where investor_id = me and status = 'aktif' and started_on <= dd loop
      select x.share into cached from public.iv_daily x where x.holding_id = h.id and x.d = dd;
      if dd < t0 and cached is not null then s := s + cached;
      else
        c := public.iv_calc(h.id, dd::timestamp at time zone 'Asia/Jakarta', least(now(), (dd + 1)::timestamp at time zone 'Asia/Jakarta'));
        if coalesce((c->>'auto')::boolean, false) then s := s + coalesce((c->>'share')::numeric, 0); end if;
      end if;
    end loop;
    daily := daily || jsonb_build_object('d', dd, 'v', round(s));
  end loop;
  return jsonb_build_object('daily', daily,
    'monthly', (select coalesce(jsonb_agg(jsonb_build_object('p', period, 'v', v) order by period), '[]') from
      (select period, sum(share) v from public.iv_statements where investor_id = me and status = 'terkunci' and kind <> 'modal' group by period) q));
end $$;

create or replace function public.iv_extra() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.iv_view_id(); r public.iv_investors;
begin
  if me is null then raise exception 'Akun ini belum terdaftar sebagai investor'; end if;
  select * into r from public.iv_investors where id = me;
  return jsonb_build_object('reinvest', r.reinvest, 'reinvest_since', r.reinvest_since,
    'book', (select coalesce(jsonb_object_agg(h.id, b), '{}') from public.iv_holdings h, lateral public.iv_holding_book(h.id) b
             where h.investor_id = me and h.status = 'aktif' and b is not null),
    'feed', (select coalesce(jsonb_agg(f order by f->>'at' desc), '[]') from (
      select jsonb_build_object('at', n.created_at, 'kind', 'tim', 'title', n.title, 'body', n.body, 'holding', h.title) f
        from public.iv_news n left join public.iv_holdings h on h.id = n.holding_id
        where (n.investor_id is null or n.investor_id = me) and (n.holding_id is null or h.investor_id = me) and n.created_at > now() - interval '120 days'
      union all
      select jsonb_build_object('at', max(s.locked_at), 'kind', 'laporan', 'title', 'Laporan ' || to_char(s.period, 'MM/YYYY') || ' sudah final',
        'body', 'Bagian Anda ' || to_char(sum(s.share) filter (where s.kind <> 'modal'), 'FM999G999G999G990') || ' rupiah masuk ke saldo.', 'period', s.period)
        from public.iv_statements s where s.investor_id = me and s.status = 'terkunci' and s.locked_at > now() - interval '120 days' group by s.period
      union all
      select jsonb_build_object('at', coalesce(w.paid_at, w.decided_at, w.requested_at), 'kind', 'dana',
        'title', case w.status when 'dibayar' then 'Penarikan sudah ditransfer' when 'disetujui' then 'Penarikan disetujui' when 'ditolak' then 'Penarikan ditolak'
                               when 'gagal' then 'Transfer penarikan gagal' else 'Penarikan diajukan' end,
        'body', to_char(w.amount, 'FM999G999G999G990') || ' rupiah · ' || w.bank_snapshot || coalesce(' · ' || w.reason, ''))
        from public.iv_withdrawals w where w.investor_id = me and w.requested_at > now() - interval '120 days'
      union all
      select jsonb_build_object('at', h.approved_at, 'kind', 'mulai', 'title', 'Investasi ' || h.title || ' aktif', 'body', 'Hasil mulai dihitung sejak ' || to_char(h.started_on, 'DD/MM/YYYY') || '.')
        from public.iv_holdings h where h.investor_id = me and h.approved_at > now() - interval '120 days'
    ) q limit 30));
end $$;

create or replace function public.iv_offers_open() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.iv_view_id() is null and not public.iv_can_view() then '[]'::jsonb else
    (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'unit_code', unit_code, 'unit', public.iv_unit_name(unit_code), 'jenis', jenis, 'title', title,
      'summary', summary, 'target_amount', target_amount, 'min_amount', min_amount, 'est_return', est_return, 'tenor_months', tenor_months,
      'risk', risk, 'est_yield_pct', est_yield_pct, 'raised_amount', raised_amount, 'photo_url', photo_url, 'highlight', highlight,
      'category', category, 'branch_name', branch_name, 'share_pct', share_pct,
      'bench', public.iv_cat_bench(category, branch_name, share_pct),
      'mine', exists (select 1 from public.iv_leads l where l.offer_id = o.id and l.investor_id = public.iv_view_id() and l.status in ('baru','dihubungi')))
      order by sort, created_at desc), '[]')
     from public.iv_offers o where status = 'dibuka') end
$$;

do $$ declare f text; begin
  foreach f in array array['public.iv_preview_start(uuid)','public.iv_preview_stop()','public.iv_dashboard()','public.iv_reports(int)',
    'public.iv_holding_detail(uuid)','public.iv_growth(int)','public.iv_extra()','public.iv_offers_open()'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.iv_view_id() from public, anon;
