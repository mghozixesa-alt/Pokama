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
