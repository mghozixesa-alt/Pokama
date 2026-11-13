-- Portal investor v2 (gaya aplikasi investasi): grafik pertumbuhan hasil + kartu peluang yang lebih lengkap.
-- Aman dijalankan ulang.

-- 1) Kolom tambahan peluang: tingkat risiko, estimasi % per tahun (angka), dana terkumpul, foto, sorotan.
alter table public.iv_offers add column if not exists risk text check (risk in ('rendah','sedang','tinggi'));
alter table public.iv_offers add column if not exists est_yield_pct numeric(6,2);
alter table public.iv_offers add column if not exists raised_amount numeric(16,2);
alter table public.iv_offers add column if not exists photo_url text;
alter table public.iv_offers add column if not exists highlight text;

create or replace function public.iv_offers_open() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.iv_my_id() is null and not public.iv_can_view() then '[]'::jsonb else
    (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'unit_code', unit_code, 'unit', public.iv_unit_name(unit_code), 'jenis', jenis, 'title', title,
      'summary', summary, 'target_amount', target_amount, 'min_amount', min_amount, 'est_return', est_return, 'tenor_months', tenor_months,
      'risk', risk, 'est_yield_pct', est_yield_pct, 'raised_amount', raised_amount, 'photo_url', photo_url, 'highlight', highlight,
      'mine', exists (select 1 from public.iv_leads l where l.offer_id = o.id and l.investor_id = public.iv_my_id() and l.status in ('baru','dihubungi')))
      order by sort, created_at desc), '[]')
     from public.iv_offers o where status = 'dibuka') end
$$;

create or replace function public.iv_admin_offer_save(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id', '')::uuid; v_risk text := nullif(p->>'risk', '');
begin
  perform public.iv_need('biz');
  if length(btrim(coalesce(p->>'title', ''))) < 4 then raise exception 'Isi judul peluang'; end if;
  if coalesce(p->>'unit_code', '') not in ('RA','WG','NA','PK') then raise exception 'Pilih unit bisnis'; end if;
  if coalesce(p->>'jenis', '') not in ('aset','proyek','saham') then raise exception 'Pilih jenis'; end if;
  if v_risk is not null and v_risk not in ('rendah','sedang','tinggi') then raise exception 'Pilih tingkat risiko'; end if;
  if nullif(p->>'photo_url', '') is not null and p->>'photo_url' !~ '^https://' then raise exception 'Link foto harus diawali https://'; end if;
  if v_id is null then
    insert into public.iv_offers(unit_code, jenis, title, summary, target_amount, min_amount, est_return, tenor_months, status,
      risk, est_yield_pct, raised_amount, photo_url, highlight, created_by)
    values (p->>'unit_code', p->>'jenis', btrim(p->>'title'), nullif(btrim(p->>'summary'), ''), nullif(p->>'target_amount', '')::numeric, nullif(p->>'min_amount', '')::numeric,
      nullif(btrim(p->>'est_return'), ''), nullif(p->>'tenor_months', '')::int, coalesce(nullif(p->>'status', ''), 'dibuka'),
      v_risk, nullif(replace(p->>'est_yield_pct', ',', '.'), '')::numeric, nullif(p->>'raised_amount', '')::numeric,
      nullif(btrim(p->>'photo_url'), ''), nullif(btrim(p->>'highlight'), ''), public.pk_me()) returning id into v_id;
  else
    update public.iv_offers set unit_code = p->>'unit_code', jenis = p->>'jenis', title = btrim(p->>'title'), summary = nullif(btrim(p->>'summary'), ''),
      target_amount = nullif(p->>'target_amount', '')::numeric, min_amount = nullif(p->>'min_amount', '')::numeric, est_return = nullif(btrim(p->>'est_return'), ''),
      tenor_months = nullif(p->>'tenor_months', '')::int, status = coalesce(nullif(p->>'status', ''), status),
      risk = v_risk, est_yield_pct = nullif(replace(p->>'est_yield_pct', ',', '.'), '')::numeric, raised_amount = nullif(p->>'raised_amount', '')::numeric,
      photo_url = nullif(btrim(p->>'photo_url'), ''), highlight = nullif(btrim(p->>'highlight'), ''), updated_at = now() where id = v_id;
  end if;
  perform public.iv_log('peluang', v_id::text, null, p);
  return v_id;
end $$;

-- 2) Grafik pertumbuhan: hasil harian (investasi yang dihitung otomatis) + hasil bulanan final.
create or replace function public.iv_growth(p_days int default 90) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.iv_my_id(); d date; t0 date; s numeric; h public.iv_holdings; c jsonb; daily jsonb := '[]'; n int;
begin
  if me is null then raise exception 'Akun ini belum terdaftar sebagai investor'; end if;
  n := least(greatest(coalesce(p_days, 90), 7), 120);
  t0 := (now() at time zone 'Asia/Jakarta')::date;
  for d in select g::date from generate_series(t0 - (n - 1), t0, interval '1 day') g loop
    s := 0;
    for h in select * from public.iv_holdings where investor_id = me and status = 'aktif' and started_on <= d loop
      c := public.iv_calc(h.id, d::timestamp at time zone 'Asia/Jakarta', least(now(), (d + 1)::timestamp at time zone 'Asia/Jakarta'));
      if coalesce((c->>'auto')::boolean, false) then s := s + coalesce((c->>'share')::numeric, 0); end if;
    end loop;
    daily := daily || jsonb_build_object('d', d, 'v', round(s));
  end loop;
  return jsonb_build_object('daily', daily,
    'monthly', (select coalesce(jsonb_agg(jsonb_build_object('p', period, 'v', v) order by period), '[]') from
      (select period, sum(share) v from public.iv_statements where investor_id = me and status = 'terkunci' and kind <> 'modal' group by period) q));
end $$;

revoke execute on function public.iv_growth(int) from public, anon;
grant execute on function public.iv_growth(int) to authenticated;
revoke execute on function public.iv_offers_open() from public, anon;
grant execute on function public.iv_offers_open() to authenticated;
revoke execute on function public.iv_admin_offer_save(jsonb) from public, anon;
grant execute on function public.iv_admin_offer_save(jsonb) to authenticated;

-- 3) Kategori aset per investasi (penginapan, jeep, iphone, motor, …) supaya portal menampilkan ukuran yang pas:
--    penginapan → okupansi & malam terisi, sewa barang → utilisasi.
create or replace function public.iv_holding_cat(p_agreement uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  if p_agreement is null then return null; end if;
  select c.slug into v from public.units u join public.products p on p.id = u.product_id join public.categories c on c.id = p.category_id
   where u.id = any(app.partner_scope_units(p_agreement)) group by c.slug order by count(*) desc limit 1;
  return v;
exception when others then return null;
end $$;
revoke execute on function public.iv_holding_cat(uuid) from public, anon, authenticated;

create or replace function public.iv_holding_json(h public.iv_holdings) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', h.id, 'unit_code', h.unit_code, 'unit', public.iv_unit_name(h.unit_code), 'jenis', h.jenis, 'title', h.title,
    'principal', h.principal, 'started_on', h.started_on, 'ends_on', h.ends_on, 'return_model', h.return_model, 'rate_pct', h.rate_pct,
    'principal_back', h.principal_back, 'rp_scheme', h.rp_scheme, 'rp_basis', h.rp_basis, 'rp_ops_pct', h.rp_ops_pct, 'rp_flat', h.rp_flat,
    'unit_count', coalesce(cardinality(h.rp_unit_ids), 0), 'pay_day', h.pay_day, 'has_doc', h.doc_path is not null, 'status', h.status,
    'cat', case when h.jenis = 'aset' then public.iv_holding_cat(h.rp_agreement_id) end)
$$;

-- =====================================================================
-- 4) Peluang: patokan otomatis dari data asli (kategori + cabang + porsi investor)
alter table public.iv_offers add column if not exists category text;      -- slug kategori unit, mis. iphone, penginapan, motor
alter table public.iv_offers add column if not exists branch_name text;   -- opsional, nama cabang (cocok sebagian)
alter table public.iv_offers add column if not exists share_pct numeric(6,2); -- porsi investor dari pendapatan (%)

-- Pendapatan per unit per bulan dari sewa 180 hari terakhir (unit baru: dibagi umur unit, min 1 bulan) (baris booking, bukan pembayaran), dan perkiraan %/tahun bagi investor:
-- pendapatan/bulan × porsi × 12 ÷ harga beli unit. Hanya unit yang punya harga beli dihitung untuk %.
create or replace function public.iv_cat_bench(p_cat text, p_branch text, p_share numeric) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if p_cat is null then return null; end if;
  with u as (
    select u.id, u.purchase_price price,
      greatest(1, least(6, extract(epoch from (now() - coalesce(u.purchase_date::timestamptz, u.created_at, now() - interval '180 days'))) / 2629800.0)) age
    from public.units u join public.products p on p.id = u.product_id join public.categories c on c.id = p.category_id
    left join public.branches br on br.id = u.branch_id
    where c.slug = p_cat and (p_branch is null or br.name ilike '%' || p_branch || '%') and u.status::text not in ('inactive','retired','sold','lost')
  ), rev as (
    select u.id, u.price, coalesce(sum(bi.line_total), 0) / u.age m
    from u left join public.booking_items bi on bi.unit_id = u.id and bi.status::text <> 'released'
      and lower(bi.period) >= now() - interval '180 days' and lower(bi.period) < now()
      and exists (select 1 from public.bookings b where b.id = bi.booking_id and b.status::text in ('confirmed','active','returned','completed'))
    group by u.id, u.price, u.age
  ), y as (
    select m, case when price > 0 and p_share > 0 then m * p_share / 100 * 12 / price * 100 end yp from rev
  )
  select jsonb_build_object('units', count(*), 'month_avg', round(avg(m)), 'month_low', round(percentile_cont(0.25) within group (order by m)),
    'month_high', round(percentile_cont(0.75) within group (order by m)),
    'priced', count(yp), 'yield_avg', round(avg(yp)::numeric, 1),
    'yield_low', round((percentile_cont(0.25) within group (order by yp))::numeric, 1), 'yield_high', round((percentile_cont(0.75) within group (order by yp))::numeric, 1))
  into r from y;
  if coalesce((r->>'units')::int, 0) = 0 then return null; end if;
  return r;
exception when others then return null;
end $$;
revoke execute on function public.iv_cat_bench(text, text, numeric) from public, anon, authenticated;

create or replace function public.iv_offers_open() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.iv_my_id() is null and not public.iv_can_view() then '[]'::jsonb else
    (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'unit_code', unit_code, 'unit', public.iv_unit_name(unit_code), 'jenis', jenis, 'title', title,
      'summary', summary, 'target_amount', target_amount, 'min_amount', min_amount, 'est_return', est_return, 'tenor_months', tenor_months,
      'risk', risk, 'est_yield_pct', est_yield_pct, 'raised_amount', raised_amount, 'photo_url', photo_url, 'highlight', highlight,
      'category', category, 'branch_name', branch_name, 'share_pct', share_pct,
      'bench', public.iv_cat_bench(category, branch_name, share_pct),
      'mine', exists (select 1 from public.iv_leads l where l.offer_id = o.id and l.investor_id = public.iv_my_id() and l.status in ('baru','dihubungi')))
      order by sort, created_at desc), '[]')
     from public.iv_offers o where status = 'dibuka') end
$$;

create or replace function public.iv_admin_offer_bench(p_cat text, p_branch text, p_share numeric) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin perform public.iv_need('view'); return public.iv_cat_bench(nullif(p_cat, ''), nullif(p_branch, ''), p_share); end $$;

create or replace function public.iv_admin_offer_save(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id', '')::uuid; v_risk text := nullif(p->>'risk', '');
begin
  perform public.iv_need('biz');
  if length(btrim(coalesce(p->>'title', ''))) < 4 then raise exception 'Isi judul peluang'; end if;
  if coalesce(p->>'unit_code', '') not in ('RA','WG','NA','PK') then raise exception 'Pilih unit bisnis'; end if;
  if coalesce(p->>'jenis', '') not in ('aset','proyek','saham') then raise exception 'Pilih jenis'; end if;
  if v_risk is not null and v_risk not in ('rendah','sedang','tinggi') then raise exception 'Pilih tingkat risiko'; end if;
  if nullif(p->>'photo_url', '') is not null and p->>'photo_url' !~ '^https://' then raise exception 'Link foto harus diawali https://'; end if;
  if v_id is null then
    insert into public.iv_offers(unit_code, jenis, title, status, created_by) values (p->>'unit_code', p->>'jenis', btrim(p->>'title'), 'dibuka', public.pk_me()) returning id into v_id;
  end if;
  update public.iv_offers set unit_code = p->>'unit_code', jenis = p->>'jenis', title = btrim(p->>'title'), summary = nullif(btrim(p->>'summary'), ''),
    target_amount = nullif(p->>'target_amount', '')::numeric, min_amount = nullif(p->>'min_amount', '')::numeric, est_return = nullif(btrim(p->>'est_return'), ''),
    tenor_months = nullif(p->>'tenor_months', '')::int, status = coalesce(nullif(p->>'status', ''), status),
    risk = v_risk, est_yield_pct = nullif(replace(p->>'est_yield_pct', ',', '.'), '')::numeric, raised_amount = nullif(p->>'raised_amount', '')::numeric,
    photo_url = nullif(btrim(p->>'photo_url'), ''), highlight = nullif(btrim(p->>'highlight'), ''),
    category = nullif(lower(btrim(p->>'category')), ''), branch_name = nullif(btrim(p->>'branch_name'), ''),
    share_pct = nullif(replace(p->>'share_pct', ',', '.'), '')::numeric, updated_at = now() where id = v_id;
  perform public.iv_log('peluang', v_id::text, null, p);
  return v_id;
end $$;

-- =====================================================================
-- 5) Nilai buku aset (harga beli − penyusutan garis lurus) per investasi aset sewa.
--    Umur: gawai/kamera/PS 36 bln, kendaraan 60 bln, camping 24 bln, penginapan tidak disusutkan (pakai modal).
create or replace function public.iv_holding_book(p_h uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare h public.iv_holdings; r jsonb;
begin
  select * into h from public.iv_holdings where id = p_h;
  if h.jenis <> 'aset' or h.rp_agreement_id is null then return null; end if;
  select jsonb_build_object('price', sum(price), 'book', round(sum(greatest(0, price * (1 - least(1, mo / life))))), 'priced', count(*) filter (where price > 0), 'units', count(*))
  into r from (
    select coalesce(u.purchase_price, 0) price,
      extract(epoch from (now() - coalesce(u.purchase_date::timestamptz, u.created_at))) / 2629800.0 mo,
      case when c.slug in ('motor','mobil','mobil-sopir','jeep','atv') then 60.0 when c.slug in ('camping','piknik') then 24.0 else 36.0 end life,
      c.slug
    from public.units u join public.products p on p.id = u.product_id join public.categories c on c.id = p.category_id
    where u.id = any(app.partner_scope_units(h.rp_agreement_id))) q where slug <> 'penginapan';
  if coalesce((r->>'priced')::int, 0) = 0 then return null; end if;
  return r;
exception when others then return null;
end $$;
revoke execute on function public.iv_holding_book(uuid) from public, anon, authenticated;

-- =====================================================================
-- 6) Investasi ulang hasil + kabar untuk investor
alter table public.iv_investors add column if not exists reinvest boolean not null default false;
alter table public.iv_investors add column if not exists reinvest_since timestamptz;

create table if not exists public.iv_news (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid references public.iv_investors(id) on delete cascade,  -- null = semua investor
  holding_id uuid references public.iv_holdings(id) on delete cascade,
  title text not null, body text,
  created_by uuid, created_at timestamptz not null default now()
);
create index if not exists iv_news_at on public.iv_news (created_at desc);
alter table public.iv_news enable row level security;
revoke all on public.iv_news from anon, authenticated;

create or replace function public.iv_set_reinvest(p_on boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.iv_my_id(); r public.iv_investors;
begin
  if me is null then raise exception 'Akun ini belum terdaftar sebagai investor'; end if;
  select * into r from public.iv_investors where id = me;
  if r.demo then raise exception 'Akun demo tidak bisa mengubah pengaturan'; end if;
  update public.iv_investors set reinvest = coalesce(p_on, false), reinvest_since = case when p_on then now() end, updated_at = now() where id = me;
  if p_on and not r.reinvest then
    insert into public.iv_leads(investor_id, name, wa, amount_hint, note, source)
    values (me, r.name, r.wa, (public.iv_balance(me)->>'withdrawable')::numeric,
      'Investasi ulang hasil diaktifkan: hasil dikumpulkan untuk unit/proyek berikutnya. Hubungi investor saat saldo cukup.', 'investor');
  end if;
  insert into public.af_audit(by_person, action, target, reason) values (null, 'iv_investasi_ulang', me::text, case when p_on then 'aktif' else 'mati' end);
  return jsonb_build_object('reinvest', coalesce(p_on, false));
end $$;

-- Data tambahan portal: status investasi ulang, nilai buku per investasi, kabar (dari tim + otomatis).
create or replace function public.iv_extra() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.iv_my_id(); r public.iv_investors;
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

create or replace function public.iv_admin_news(p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.iv_need('view');
  return (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title, 'body', n.body, 'created_at', n.created_at,
    'investor', i.name, 'holding', h.title, 'by', (select nickname from public.pk_people where id = n.created_by)) order by n.created_at desc), '[]')
    from (select * from public.iv_news order by created_at desc limit p_limit) n
    left join public.iv_investors i on i.id = n.investor_id left join public.iv_holdings h on h.id = n.holding_id);
end $$;

create or replace function public.iv_admin_news_save(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_h uuid := nullif(p->>'holding_id', '')::uuid; v_i uuid := nullif(p->>'investor_id', '')::uuid;
begin
  perform public.iv_need('biz');
  if length(btrim(coalesce(p->>'title', ''))) < 4 then raise exception 'Isi judul kabar'; end if;
  if v_h is not null then select investor_id into v_i from public.iv_holdings where id = v_h; end if;
  insert into public.iv_news(investor_id, holding_id, title, body, created_by)
  values (v_i, v_h, btrim(p->>'title'), nullif(btrim(p->>'body'), ''), public.pk_me()) returning id into v_id;
  perform public.iv_log('kabar', v_id::text, null, p);
  return v_id;
end $$;

create or replace function public.iv_admin_news_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin perform public.iv_need('biz'); delete from public.iv_news where id = p_id; perform public.iv_log('kabar_hapus', p_id::text); end $$;

-- =====================================================================
-- 7) Riwayat tamu/sewa dengan sumber booking (web, WA, OTA, …), tanpa nama pelanggan.
create or replace function public.iv_holding_detail(p_h uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.iv_my_id(); h public.iv_holdings; m0 timestamptz; acts jsonb := '[]'; prev jsonb;
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

-- =====================================================================
-- 8) Simpanan hasil harian untuk grafik (supaya cepat saat investor banyak)
create table if not exists public.iv_daily (
  holding_id uuid not null references public.iv_holdings(id) on delete cascade,
  investor_id uuid not null references public.iv_investors(id) on delete cascade,
  d date not null, share numeric(16,2) not null default 0, computed_at timestamptz not null default now(),
  primary key (holding_id, d)
);
create index if not exists iv_daily_inv on public.iv_daily (investor_id, d);
alter table public.iv_daily enable row level security;
revoke all on public.iv_daily from anon, authenticated;

create or replace function public.iv_daily_fill(p_days int default 3) returns int
language plpgsql security definer set search_path = public as $$
declare h public.iv_holdings; dd date; t0 date := (now() at time zone 'Asia/Jakarta')::date; c jsonb; n int := 0;
begin
  for h in select * from public.iv_holdings where status = 'aktif' loop
    for dd in select g::date from generate_series(greatest(h.started_on, t0 - p_days), t0 - 1, interval '1 day') g loop
      c := public.iv_calc(h.id, dd::timestamp at time zone 'Asia/Jakarta', (dd + 1)::timestamp at time zone 'Asia/Jakarta');
      if coalesce((c->>'auto')::boolean, false) then
        insert into public.iv_daily(holding_id, investor_id, d, share) values (h.id, h.investor_id, dd, coalesce((c->>'share')::numeric, 0))
        on conflict (holding_id, d) do update set share = excluded.share, computed_at = now();
        n := n + 1;
      end if;
    end loop;
  end loop;
  return n;
end $$;
revoke execute on function public.iv_daily_fill(int) from public, anon, authenticated;

create or replace function public.iv_growth(p_days int default 90) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.iv_my_id(); dd date; t0 date; s numeric; h public.iv_holdings; c jsonb; daily jsonb := '[]'; n int; cached numeric;
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

-- Isi ulang 4 hari terakhir tiap malam 00.20 WIB (pembayaran telat ikut terhitung), isi awal 120 hari.
select cron.unschedule('iv-hasil-harian') where exists (select 1 from cron.job where jobname = 'iv-hasil-harian');
select cron.schedule('iv-hasil-harian', '20 17 * * *', 'select public.iv_daily_fill(4)');
select public.iv_daily_fill(120);

do $$ declare f text; begin
  foreach f in array array['public.iv_growth(int)','public.iv_offers_open()','public.iv_admin_offer_save(jsonb)','public.iv_admin_offer_bench(text,text,numeric)',
    'public.iv_set_reinvest(boolean)','public.iv_extra()','public.iv_admin_news(int)','public.iv_admin_news_save(jsonb)','public.iv_admin_news_delete(uuid)',
    'public.iv_holding_detail(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
