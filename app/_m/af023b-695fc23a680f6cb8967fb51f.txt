-- 023b: data demo dan data asli dipisah di rekap bulanan dan peringkat
alter table public.af_month_close add column if not exists demo boolean not null default false;
alter table public.af_month_close drop constraint if exists af_month_close_pkey;
alter table public.af_month_close add primary key (month, demo);
alter table public.af_ranks add column if not exists demo boolean not null default false;
alter table public.af_ranks drop constraint if exists af_ranks_pkey;
alter table public.af_ranks add primary key (month, demo, city, kind, rank);
create or replace function public.af_close_month(p_month date default null, p_force boolean default false, p_demo boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m date := coalesce(date_trunc('month', p_month)::date, (public.af_month() - interval '1 month')::date); nm date;
  rev numeric; comm numeric; rw numeric; bud numeric; minp numeric := (public.af_set('min_payout'))::text::numeric;
  taxp numeric := coalesce((public.af_set('tax')->>'pct')::numeric, 0); r record; c record; i int; tiers jsonb := public.af_set('tiers');
  d3 int; st int; prevt jsonb; newt jsonb; prot boolean; mm date; npay int := 0; gross numeric; cm numeric; rv numeric;
begin
  if auth.uid() is not null then perform public.af_need(false, true); end if;
  nm := (m + interval '1 month')::date;
  if nm > public.af_month() and not p_force then raise exception 'Bulan % belum selesai', to_char(m, 'YYYY-MM'); end if;
  if exists (select 1 from public.af_month_close where month = m and demo = p_demo) and not p_force then
    return jsonb_build_object('skipped', true, 'month', m);
  end if;
  if p_force then
    -- ulang rekap: lepas pencairan yang belum disetujui
    update public.af_bookings set payout_id = null where payout_id in (select id from public.af_payouts where period = m and status = 'diajukan' and demo = p_demo);
    update public.af_rewards set payout_id = null where payout_id in (select id from public.af_payouts where period = m and status = 'diajukan' and demo = p_demo);
    delete from public.af_payouts where period = m and status = 'diajukan' and demo = p_demo;
    delete from public.af_month_close where month = m and demo = p_demo;
  end if;

  -- 1. tantangan tercapai
  for c in select * from public.af_challenges where month = m and is_active and demo = p_demo loop
    insert into public.af_rewards(partner_id, month, kind, ref, title, reward_type, amount, demo)
    select b.partner_id, m, 'tantangan', c.id::text, c.title, c.reward_type, c.reward_amount, p_demo
    from public.af_bookings b join public.af_partners x on x.id = b.partner_id
    where public.af_done(b) and public.af_month(b.completed_at) = m and b.demo = p_demo and x.status = 'aktif' and not x.is_internal
      and (c.unit_code is null or b.unit_code = c.unit_code) and (c.cat is null or b.cat = c.cat)
    group by b.partner_id having count(*) >= c.target
    on conflict (partner_id, kind, ref) do nothing;
  end loop;
  insert into public.af_notifs(partner_id, kind, text, demo)
    select w.partner_id, 'tantangan_tercapai', 'Selamat! Tantangan "' || w.title || '" tercapai. Hadiah ' || to_char(w.amount, 'FM999G999G999') || ' masuk pencairan.', p_demo
    from public.af_rewards w where w.month = m and w.kind = 'tantangan' and w.demo = p_demo and w.created_at > now() - interval '1 minute';

  -- 2. peringkat per kota x jenis
  delete from public.af_ranks where month = m and partner_id in (select id from public.af_partners where demo = p_demo);
  insert into public.af_ranks(month, demo, city, kind, rank, partner_id, done)
  select m, p_demo, city, kind, rk, pid, dn from (
    select x.city, x.kind, x.id pid, count(*) dn, row_number() over (partition by x.city, x.kind order by count(*) desc, min(b.completed_at)) rk
    from public.af_bookings b join public.af_partners x on x.id = b.partner_id
    where public.af_done(b) and public.af_month(b.completed_at) = m and b.demo = p_demo and x.status = 'aktif' and not x.is_internal
    group by x.city, x.kind, x.id) q where rk <= 3;
  insert into public.af_rewards(partner_id, month, kind, ref, title, amount, demo)
  select r.partner_id, m, 'juara', 'rank-' || r.city || '-' || r.kind, 'Juara ' || r.rank || ' ' || r.kind || ' ' || r.city || ' ' || to_char(m, 'MM/YYYY'), z.amount, p_demo
  from public.af_ranks r join public.af_rank_prizes z on z.month = m and z.rank = r.rank join public.af_partners x on x.id = r.partner_id
  where r.month = m and x.demo = p_demo and z.amount > 0
  on conflict (partner_id, kind, ref) do nothing;
  insert into public.af_badges(partner_id, badge) select partner_id, 'Mitra Unggulan' from public.af_ranks r join public.af_partners x on x.id = r.partner_id
    where r.month = m and x.demo = p_demo on conflict do nothing;
  insert into public.af_notifs(partner_id, kind, text, demo)
    select r.partner_id, 'juara', 'Anda peringkat ' || r.rank || ' ' || r.kind || ' ' || r.city || ' bulan ' || to_char(m, 'MM/YYYY') || ' dan tampil sebagai Mitra Unggulan.', p_demo
    from public.af_ranks r join public.af_partners x on x.id = r.partner_id where r.month = m and x.demo = p_demo;

  -- 3. lencana
  insert into public.af_badges(partner_id, badge)
  select partner_id, bd from (
    select b.partner_id, unnest(array_remove(array[
      case when count(*) >= 1 then 'Booking pertama' end,
      case when count(*) >= 10 then '10 booking' end,
      case when count(*) >= 50 then '50 booking' end,
      case when count(*) filter (where b.cat = 'penginapan') >= 1 then 'Penjelajah' end,
      case when count(*) filter (where b.cat = 'jeep') >= 10 then 'Raja Jeep' end,
      case when count(*) filter (where b.repeat_cust) >= 5 then 'Tamu setia' end], null)) bd
    from public.af_bookings b where public.af_done(b) and b.demo = p_demo and b.partner_id is not null group by b.partner_id) q
  on conflict do nothing;

  -- 4. tingkat untuk bulan depan (+ beruntun & perlindungan)
  for r in select x.id from public.af_partners x where x.status = 'aktif' and x.demo = p_demo loop
    select count(*) into d3 from public.af_bookings b where b.partner_id = r.id and public.af_done(b) and b.completed_at >= (m - interval '2 month') and public.af_month(b.completed_at) <= m;
    st := 0; mm := m;
    while exists (select 1 from public.af_bookings b where b.partner_id = r.id and public.af_done(b) and public.af_month(b.completed_at) = mm) and st < 36 loop
      st := st + 1; mm := (mm - interval '1 month')::date;
    end loop;
    select x into newt from jsonb_array_elements(tiers) x where (x->>'min')::int <= d3 order by (x->>'min')::int desc limit 1;
    prevt := public.af_tier_now(r.id); prot := false;
    if (newt->>'min')::int < (prevt->>'min')::int and st >= 3
       and not coalesce((select protected from public.af_tiers where partner_id = r.id and month = m), false) then
      newt := prevt; prot := true;
    end if;
    insert into public.af_tiers(partner_id, month, tier, done3m, streak, protected) values (r.id, nm, newt->>'name', d3, st, prot)
    on conflict (partner_id, month) do update set tier = excluded.tier, done3m = excluded.done3m, streak = excluded.streak, protected = excluded.protected;
    if st >= 3 then insert into public.af_badges(partner_id, badge) values (r.id, 'Beruntun 3 bulan') on conflict do nothing; end if;
    if (newt->>'min')::int > (prevt->>'min')::int then
      perform public.af_notify(r.id, 'naik_tingkat', 'Naik tingkat jadi ' || (newt->>'name') || ' mulai ' || to_char(nm, 'MM/YYYY') || ': komisi +' || (newt->>'bonus') || '%.');
    end if;
  end loop;

  -- 5. anggaran hadiah
  select coalesce(sum(net_amount + ext_amount), 0), coalesce(sum(commission), 0) into rev, comm from public.af_bookings b
   where public.af_done(b) and public.af_month(b.completed_at) = m and b.demo = p_demo;
  select coalesce(sum(amount), 0) into rw from public.af_rewards where month = m and status <> 'ditolak' and demo = p_demo;
  bud := round(rev * (public.af_set('reward_budget_pct'))::text::numeric / 100);

  -- 6. rekap pencairan: komisi siap cair s.d. akhir bulan + hadiah, per mitra (semua unit digabung)
  for r in
    select x.id, x.bank_name, x.bank_acct, x.bank_holder from public.af_partners x
    where x.demo = p_demo and x.status in ('aktif','nonaktif')
      and (exists (select 1 from public.af_bookings b where b.partner_id = x.id and b.comm_status = 'siap_cair' and b.payout_id is null and b.completed_at < nm)
        or exists (select 1 from public.af_rewards w where w.partner_id = x.id and w.status = 'siap_cair' and w.payout_id is null and w.month <= m))
  loop
    select coalesce(sum(commission), 0) into cm from public.af_bookings b where b.partner_id = r.id and b.comm_status = 'siap_cair' and b.payout_id is null and b.completed_at < nm;
    select coalesce(sum(amount), 0) into rv from public.af_rewards w where w.partner_id = r.id and w.status = 'siap_cair' and w.payout_id is null and w.month <= m;
    gross := cm + rv;
    if gross < minp then continue; end if;  -- dibawa ke bulan berikutnya
    insert into public.af_payouts(period, partner_id, commission, rewards, gross, tax_pct, tax, net, bank, items, demo)
    values (m, r.id, cm, rv, gross, taxp, round(gross * taxp / 100), gross - round(gross * taxp / 100),
      case when r.bank_acct is not null then r.bank_name || ' ' || r.bank_acct || ' a.n. ' || coalesce(r.bank_holder, '-') end,
      (select count(*) from public.af_bookings b where b.partner_id = r.id and b.comm_status = 'siap_cair' and b.payout_id is null and b.completed_at < nm), p_demo)
    on conflict (period, partner_id) do nothing;
    update public.af_bookings set payout_id = (select id from public.af_payouts where period = m and partner_id = r.id)
     where partner_id = r.id and comm_status = 'siap_cair' and payout_id is null and completed_at < nm;
    update public.af_rewards set payout_id = (select id from public.af_payouts where period = m and partner_id = r.id)
     where partner_id = r.id and status = 'siap_cair' and payout_id is null and month <= m;
    npay := npay + 1;
  end loop;

  insert into public.af_month_close(month, demo, revenue, commission, reward_budget, reward_used, over_budget, payouts, closed_by)
  values (m, p_demo, rev, comm, bud, rw, rw > bud, npay, public.pk_me())
  on conflict (month, demo) do update set revenue = excluded.revenue, commission = excluded.commission, reward_budget = excluded.reward_budget,
    reward_used = excluded.reward_used, over_budget = excluded.over_budget, payouts = excluded.payouts, closed_at = now();
  perform public.af_log('tutup_bulan', m::text, null, jsonb_build_object('payouts', npay, 'revenue', rev, 'reward', rw, 'budget', bud, 'demo', p_demo));
  return jsonb_build_object('month', m, 'payouts', npay, 'revenue', rev, 'commission', comm, 'reward_used', rw, 'reward_budget', bud, 'over_budget', rw > bud);
end $$;

-- ================= Keuangan: pencairan =================
create or replace function public.af_payouts_list(p_period date default null, p_demo boolean default false) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.af_is_fin() and not public.af_is_biz() then null else jsonb_build_object(
    'periods', (select coalesce(jsonb_agg(distinct period order by period desc), '[]'::jsonb) from public.af_payouts where demo = p_demo),
    'close', (select to_jsonb(c) from public.af_month_close c where c.demo = p_demo and c.month = coalesce(p_period, (select max(period) from public.af_payouts where demo = p_demo))),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'period', o.period, 'partner_id', o.partner_id, 'name', coalesce(nullif(x.org, ''), x.name), 'holder', x.bank_holder,
        'wa', x.wa, 'bank', o.bank, 'commission', o.commission, 'rewards', o.rewards, 'gross', o.gross, 'tax', o.tax, 'net', o.net, 'items', o.items, 'status', o.status,
        'proof_url', o.proof_url, 'transferred_at', o.transferred_at, 'npwp', x.npwp is not null, 'nik', x.nik is not null,
        'frozen', (select count(*) from public.af_bookings b where b.partner_id = o.partner_id and b.comm_status = 'dibekukan'),
        'lines', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'unit', b.unit_code, 'booking_id', b.booking_id, 'product', coalesce(b.product, b.cat), 'amount', b.net_amount + b.ext_amount,
            'rate', b.rate_final, 'commission', b.commission, 'completed_at', b.completed_at) order by b.completed_at), '[]'::jsonb) from public.af_bookings b where b.payout_id = o.id),
        'reward_lines', (select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'title', w.title, 'amount', w.amount, 'status', w.status)), '[]'::jsonb) from public.af_rewards w where w.payout_id = o.id)
      ) order by o.status, o.net desc), '[]'::jsonb)
      from public.af_payouts o join public.af_partners x on x.id = o.partner_id
      where o.demo = p_demo and o.period = coalesce(p_period, (select max(period) from public.af_payouts where demo = p_demo))),
    'carried', (select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(nullif(x.org, ''), x.name), 'amount', s)), '[]'::jsonb) from (
      select b.partner_id, sum(b.commission) s from public.af_bookings b where b.comm_status = 'siap_cair' and b.payout_id is null and b.demo = p_demo group by b.partner_id) q
      join public.af_partners x on x.id = q.partner_id),
    'frozen', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'booking_id', b.booking_id, 'unit', b.unit_code, 'partner', coalesce(nullif(x.org, ''), x.name), 'partner_id', x.id,
        'reason', b.frozen_reason, 'amount', b.net_amount + b.ext_amount, 'self_ref', b.self_ref, 'at', b.booked_at)), '[]'::jsonb)
      from public.af_bookings b join public.af_partners x on x.id = b.partner_id where b.comm_status = 'dibekukan' and b.demo = p_demo),
    'rewards_open', (select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'title', w.title, 'name', coalesce(nullif(x.org, ''), x.name), 'amount', w.amount, 'status', w.status, 'month', w.month)), '[]'::jsonb)
      from public.af_rewards w join public.af_partners x on x.id = w.partner_id where w.demo = p_demo and w.status = 'siap_cair'),
    'tax', public.af_set('tax'), 'min_payout', public.af_set('min_payout'), 'is_fin', public.af_is_fin())
  end
$$;

create or replace function public.af_payouts_list(p_period date default null, p_demo boolean default false) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.af_is_fin() and not public.af_is_biz() then null else jsonb_build_object(
    'periods', (select coalesce(jsonb_agg(distinct period order by period desc), '[]'::jsonb) from public.af_payouts where demo = p_demo),
    'close', (select to_jsonb(c) from public.af_month_close c where c.demo = p_demo and c.month = coalesce(p_period, (select max(period) from public.af_payouts where demo = p_demo))),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'period', o.period, 'partner_id', o.partner_id, 'name', coalesce(nullif(x.org, ''), x.name), 'holder', x.bank_holder,
        'wa', x.wa, 'bank', o.bank, 'commission', o.commission, 'rewards', o.rewards, 'gross', o.gross, 'tax', o.tax, 'net', o.net, 'items', o.items, 'status', o.status,
        'proof_url', o.proof_url, 'transferred_at', o.transferred_at, 'npwp', x.npwp is not null, 'nik', x.nik is not null,
        'frozen', (select count(*) from public.af_bookings b where b.partner_id = o.partner_id and b.comm_status = 'dibekukan'),
        'lines', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'unit', b.unit_code, 'booking_id', b.booking_id, 'product', coalesce(b.product, b.cat), 'amount', b.net_amount + b.ext_amount,
            'rate', b.rate_final, 'commission', b.commission, 'completed_at', b.completed_at) order by b.completed_at), '[]'::jsonb) from public.af_bookings b where b.payout_id = o.id),
        'reward_lines', (select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'title', w.title, 'amount', w.amount, 'status', w.status)), '[]'::jsonb) from public.af_rewards w where w.payout_id = o.id)
      ) order by o.status, o.net desc), '[]'::jsonb)
      from public.af_payouts o join public.af_partners x on x.id = o.partner_id
      where o.demo = p_demo and o.period = coalesce(p_period, (select max(period) from public.af_payouts where demo = p_demo))),
    'carried', (select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(nullif(x.org, ''), x.name), 'amount', s)), '[]'::jsonb) from (
      select b.partner_id, sum(b.commission) s from public.af_bookings b where b.comm_status = 'siap_cair' and b.payout_id is null and b.demo = p_demo group by b.partner_id) q
      join public.af_partners x on x.id = q.partner_id),
    'frozen', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'booking_id', b.booking_id, 'unit', b.unit_code, 'partner', coalesce(nullif(x.org, ''), x.name), 'partner_id', x.id,
        'reason', b.frozen_reason, 'amount', b.net_amount + b.ext_amount, 'self_ref', b.self_ref, 'at', b.booked_at)), '[]'::jsonb)
      from public.af_bookings b join public.af_partners x on x.id = b.partner_id where b.comm_status = 'dibekukan' and b.demo = p_demo),
    'rewards_open', (select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'title', w.title, 'name', coalesce(nullif(x.org, ''), x.name), 'amount', w.amount, 'status', w.status, 'month', w.month)), '[]'::jsonb)
      from public.af_rewards w join public.af_partners x on x.id = w.partner_id where w.demo = p_demo and w.status = 'siap_cair'),
    'tax', public.af_set('tax'), 'min_payout', public.af_set('min_payout'), 'is_fin', public.af_is_fin())
  end
$$;

create or replace function public.af_api_featured(p_unit text default null) returns jsonb language sql stable security definer set search_path = public as $$
  with m as (select max(month) mm from public.af_ranks r where not r.demo)
  select jsonb_build_object('bulan', to_char((select mm from m), 'YYYY-MM'), 'mitra', coalesce(jsonb_agg(jsonb_build_object(
    'peringkat', r.rank, 'nama', coalesce(nullif(p.org, ''), p.name), 'jenis', r.kind, 'kota', r.city, 'kode', p.code, 'alamat', p.address
  ) order by r.city, r.kind, r.rank), '[]'::jsonb))
  from public.af_ranks r join public.af_partners p on p.id = r.partner_id
  where r.month = (select mm from m) and not r.demo and p.status = 'aktif' and not p.demo
$$;

revoke execute on function public.af_close_month(date, boolean, boolean) from public, anon;
grant execute on function public.af_close_month(date, boolean, boolean) to authenticated, service_role;
revoke execute on function public.af_payouts_list(date, boolean) from public, anon;
grant execute on function public.af_api_featured(text) to anon, authenticated, service_role;
-- bukti transfer (bucket privat)
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('af-bukti', 'af-bukti', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;
do $p$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'af_bukti_r') then
    create policy af_bukti_r on storage.objects for select to authenticated
      using (bucket_id = 'af-bukti' and (public.af_can_view() or (storage.foldername(name))[1] = public.af_my_partner()::text));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'af_bukti_w') then
    create policy af_bukti_w on storage.objects for insert to authenticated
      with check (bucket_id = 'af-bukti' and public.af_is_fin());
  end if;
end $p$;
