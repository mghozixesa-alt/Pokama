-- 044 Buku Keuangan tahap 2: Produk & Stok, Pembelian, Penjualan (tagihan/invoice), Aset Tetap & penyusutan, Pajak.
-- Semua dokumen membukukan lewat pk_fin_post. Persediaan memakai biaya rata-rata.

insert into public.pk_fin_sources(code, name, unit_code, kind, feeds_omzet, is_active, note) values
  ('penjualan', 'Penjualan (Buku Keuangan)', 'HQ', 'sistem', false, true, 'Tagihan penjualan manual di /buku'),
  ('pembelian', 'Pembelian (Buku Keuangan)', 'HQ', 'sistem', false, true, 'Tagihan pembelian vendor di /buku'),
  ('stok', 'Penyesuaian stok (Buku Keuangan)', 'HQ', 'sistem', false, true, 'Stok opname & pemakaian part di /buku'),
  ('aset', 'Aset tetap (Buku Keuangan)', 'HQ', 'sistem', false, true, 'Perolehan & penyusutan aset di /buku')
on conflict (code) do nothing;

/* ---------- tabel ---------- */
create table if not exists public.pk_fin_products (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  kind text not null default 'barang' check (kind in ('barang', 'jasa')),
  uom text not null default 'pcs',
  category text,
  unit_code text references public.pk_units(code),
  sell_price numeric not null default 0,
  buy_price numeric not null default 0,
  sales_acc text references public.pk_fin_accounts(code),
  cogs_acc text references public.pk_fin_accounts(code),
  inv_acc text references public.pk_fin_accounts(code),
  qty numeric not null default 0,
  avg_cost numeric not null default 0,
  min_qty numeric not null default 0,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);
create table if not exists public.pk_fin_stock_moves (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.pk_fin_products(id),
  move_date date not null,
  qty numeric not null,
  unit_cost numeric not null default 0,
  ref_type text not null check (ref_type in ('pembelian', 'penjualan', 'penyesuaian', 'pemakaian', 'saldo_awal', 'batal')),
  ref_code text,
  unit_code text,
  asset_unit_id uuid references public.units(id) on delete set null,
  memo text,
  entry_id uuid references public.pk_fin_entries(id),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists pk_fin_stock_moves_p on public.pk_fin_stock_moves(product_id, move_date);

create table if not exists public.pk_fin_docs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('jual', 'beli')),
  code text unique not null,
  doc_date date not null,
  due_date date,
  unit_code text not null references public.pk_units(code),
  company_code text references public.pk_fin_companies(code),
  party text not null,
  contact text,
  memo text,
  ref_no text,
  lines jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  tax_pct numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  paid numeric not null default 0,
  cogs numeric not null default 0,
  status text not null default 'belum' check (status in ('belum', 'lunas', 'batal')),
  entry_id uuid references public.pk_fin_entries(id),
  pay_entries uuid[] not null default '{}',
  payments jsonb not null default '[]'::jsonb,
  proof_url text,
  void_reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists pk_fin_docs_k on public.pk_fin_docs(kind, doc_date desc);

create table if not exists public.pk_fin_assets (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  asset_acc text not null references public.pk_fin_accounts(code),
  accum_acc text not null references public.pk_fin_accounts(code),
  exp_acc text not null default '5-50001' references public.pk_fin_accounts(code),
  unit_code text not null default 'RA' references public.pk_units(code),
  asset_unit_id uuid unique references public.units(id) on delete set null,
  acquired date,
  cost numeric not null default 0,
  residual numeric not null default 0,
  life_months int not null default 48 check (life_months > 0),
  start_month date,
  accum_opening numeric not null default 0,
  status text not null default 'aktif' check (status in ('aktif', 'dilepas')),
  disposed_at date,
  dispose_value numeric,
  entry_id uuid references public.pk_fin_entries(id),
  dispose_entry uuid references public.pk_fin_entries(id),
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.pk_fin_depr (
  asset_id uuid not null references public.pk_fin_assets(id) on delete cascade,
  month date not null,
  amount numeric not null,
  entry_id uuid references public.pk_fin_entries(id),
  primary key (asset_id, month)
);

do $$ declare t text; begin
  foreach t in array array['pk_fin_products', 'pk_fin_stock_moves', 'pk_fin_docs', 'pk_fin_assets', 'pk_fin_depr'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

/* ---------- pembantu ---------- */
create or replace function public.pk_fin_party_of(p jsonb) returns text language sql immutable as $$ select nullif(btrim(p->>'party'), '') $$;

-- catat mutasi stok & perbarui saldo serta biaya rata-rata produk
create or replace function public.pk_fin_stock_apply(p_product uuid, p_date date, p_qty numeric, p_cost numeric, p_type text, p_ref text,
  p_unit text default null, p_asset uuid default null, p_memo text default null, p_entry uuid default null)
returns numeric language plpgsql security definer set search_path to 'public' as $$
declare pr public.pk_fin_products; c numeric;
begin
  select * into pr from public.pk_fin_products where id = p_product for update;
  if pr.id is null then raise exception 'Produk tidak ditemukan'; end if;
  if pr.kind = 'jasa' then return 0; end if;
  if p_qty > 0 then
    c := coalesce(p_cost, pr.avg_cost);
    update public.pk_fin_products set avg_cost = case when greatest(qty, 0) + p_qty > 0 then round((greatest(qty, 0) * avg_cost + p_qty * c) / (greatest(qty, 0) + p_qty), 4) else c end,
           qty = qty + p_qty, buy_price = case when p_type = 'pembelian' then c else buy_price end where id = p_product;
  else
    c := pr.avg_cost;
    update public.pk_fin_products set qty = qty + p_qty where id = p_product;
  end if;
  insert into public.pk_fin_stock_moves(product_id, move_date, qty, unit_cost, ref_type, ref_code, unit_code, asset_unit_id, memo, entry_id, created_by)
  values (p_product, p_date, p_qty, c, p_type, p_ref, p_unit, p_asset, p_memo, p_entry, public.pk_me());
  return c;
end $$;

/* ---------- Produk & stok ---------- */
create or replace function public.pk_fin_product_save(p jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid := nullif(p->>'id', '')::uuid; v_code text; v_kind text := coalesce(nullif(p->>'kind', ''), 'barang');
begin
  perform public.pk_fin_write_check();
  if coalesce(btrim(p->>'name'), '') = '' then raise exception 'Isi nama produk'; end if;
  v_code := coalesce(nullif(btrim(p->>'code'), ''), 'PRD-' || lpad(nextval('public.pk_fin_doc_seq')::text, 5, '0'));
  if v_id is null then
    insert into public.pk_fin_products(code, name, kind, uom, category, unit_code, sell_price, buy_price, sales_acc, cogs_acc, inv_acc, min_qty, note)
    values (v_code, btrim(p->>'name'), v_kind, coalesce(nullif(p->>'uom', ''), 'pcs'), nullif(p->>'category', ''), nullif(p->>'unit', ''),
      coalesce(nullif(p->>'sell_price', '')::numeric, 0), coalesce(nullif(p->>'buy_price', '')::numeric, 0),
      coalesce(nullif(p->>'sales_acc', ''), case when v_kind = 'jasa' then '4-42003' else '4-42001' end),
      case when v_kind = 'barang' then coalesce(nullif(p->>'cogs_acc', ''), '5-51001') end,
      case when v_kind = 'barang' then coalesce(nullif(p->>'inv_acc', ''), '1-10210') end,
      coalesce(nullif(p->>'min_qty', '')::numeric, 0), nullif(p->>'note', ''))
    returning id into v_id;
  else
    update public.pk_fin_products set code = v_code, name = btrim(p->>'name'), uom = coalesce(nullif(p->>'uom', ''), uom), category = nullif(p->>'category', ''),
      unit_code = nullif(p->>'unit', ''), sell_price = coalesce(nullif(p->>'sell_price', '')::numeric, sell_price),
      sales_acc = coalesce(nullif(p->>'sales_acc', ''), sales_acc), cogs_acc = coalesce(nullif(p->>'cogs_acc', ''), cogs_acc), inv_acc = coalesce(nullif(p->>'inv_acc', ''), inv_acc),
      min_qty = coalesce(nullif(p->>'min_qty', '')::numeric, min_qty), note = nullif(p->>'note', ''), is_active = coalesce((p->>'is_active')::boolean, is_active)
    where id = v_id;
  end if;
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

-- penyesuaian stok: opname (selisih), pemakaian part untuk servis unit, atau saldo awal
-- p: {product, date, kind: penyesuaian|pemakaian|saldo_awal, qty (+/-; untuk opname isi 'count' = hasil hitung), cost (saldo awal), unit, asset, memo, acc (lawan, default sesuai jenis)}
create or replace function public.pk_fin_stock_adjust(p jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare pr public.pk_fin_products; v_qty numeric; v_kind text := coalesce(p->>'kind', 'penyesuaian'); v_d date; v_cost numeric; v_amt numeric; v_acc text; v_ref text; v_e uuid; v_u text;
begin
  perform public.pk_fin_write_check();
  select * into pr from public.pk_fin_products where id = (p->>'product')::uuid;
  if pr.id is null or pr.kind <> 'barang' then raise exception 'Pilih produk barang'; end if;
  v_d := coalesce(nullif(p->>'date', '')::date, public.pk_today());
  v_u := coalesce(nullif(p->>'unit', ''), pr.unit_code, 'HQ');
  v_qty := case when nullif(p->>'count', '') is not null then (p->>'count')::numeric - pr.qty else coalesce(nullif(p->>'qty', '')::numeric, 0) end;
  if v_kind = 'pemakaian' then v_qty := -abs(v_qty); end if;
  if v_qty = 0 then raise exception 'Tidak ada perubahan stok'; end if;
  v_cost := case when v_kind = 'saldo_awal' then coalesce(nullif(p->>'cost', '')::numeric, pr.buy_price) else pr.avg_cost end;
  v_amt := round(abs(v_qty) * v_cost, 2);
  v_acc := coalesce(nullif(p->>'acc', ''), case v_kind when 'pemakaian' then '5-50002' when 'saldo_awal' then '3-30999' else '6-60007' end);
  v_ref := public.pk_fin_doc_code('ST', v_d);
  if v_amt > 0 then
    v_e := public.pk_fin_post('stok', v_ref, v_d, v_u,
      case v_kind when 'pemakaian' then 'Pemakaian ' when 'saldo_awal' then 'Saldo awal stok ' else 'Penyesuaian stok ' end || pr.name || ' ' || v_qty || ' ' || pr.uom || coalesce(' · ' || nullif(p->>'memo', ''), ''),
      jsonb_build_array(
        jsonb_build_object('acc', pr.inv_acc, 'unit', v_u, case when v_qty > 0 then 'd' else 'c' end, v_amt, 'memo', pr.name),
        jsonb_build_object('acc', v_acc, 'unit', v_u, case when v_qty > 0 then 'c' else 'd' end, v_amt, 'asset', nullif(p->>'asset', ''), 'memo', coalesce(nullif(p->>'memo', ''), pr.name))),
      null, null, public.pk_me());
  end if;
  perform public.pk_fin_stock_apply(pr.id, v_d, v_qty, case when v_kind = 'saldo_awal' then v_cost end,
    case when v_kind in ('pemakaian', 'saldo_awal') then v_kind else 'penyesuaian' end, v_ref, v_u, nullif(p->>'asset', '')::uuid, nullif(p->>'memo', ''), v_e);
  return jsonb_build_object('code', v_ref, 'qty', v_qty, 'amount', v_amt);
end $$;

create or replace function public.pk_fin_products_list(p_q text default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  perform public.pk_fin_read_check();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'code', code, 'name', name, 'kind', kind, 'uom', uom, 'category', category, 'unit', unit_code,
      'sell_price', sell_price, 'buy_price', buy_price, 'avg_cost', avg_cost, 'qty', qty, 'min_qty', min_qty, 'value', round(greatest(qty, 0) * avg_cost),
      'sales_acc', sales_acc, 'cogs_acc', cogs_acc, 'inv_acc', inv_acc, 'is_active', is_active, 'note', note,
      'sold30', coalesce((select -sum(m.qty) from public.pk_fin_stock_moves m where m.product_id = x.id and m.ref_type in ('penjualan', 'pemakaian') and m.move_date > public.pk_today() - 30), 0))
      order by is_active desc, name), '[]'::jsonb)
    from public.pk_fin_products x where p_q is null or (code || ' ' || name || ' ' || coalesce(category, '')) ilike '%' || p_q || '%');
end $$;

create or replace function public.pk_fin_product_moves(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  perform public.pk_fin_read_check();
  return jsonb_build_object('product', (select to_jsonb(x) from public.pk_fin_products x where id = p_id),
    'moves', (select coalesce(jsonb_agg(jsonb_build_object('date', m.move_date, 'qty', m.qty, 'cost', m.unit_cost, 'type', m.ref_type, 'ref', m.ref_code, 'memo', m.memo,
      'asset', u.asset_no) order by m.move_date desc, m.created_at desc), '[]'::jsonb) from public.pk_fin_stock_moves m left join public.units u on u.id = m.asset_unit_id where m.product_id = p_id));
end $$;

/* ---------- Penjualan & Pembelian (dokumen tagihan) ---------- */
-- p: {kind: jual|beli, date, due, unit, party, contact, memo, ref_no, tax_pct, discount, pay_acc (lunas langsung), proof_url,
--     lines:[{product, acc, memo, qty, price, disc_pct, unit, asset}]}
create or replace function public.pk_fin_doc_save(p jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_kind text := p->>'kind'; v_d date; v_u text; x jsonb; pr public.pk_fin_products; a public.pk_fin_accounts;
        v_ln jsonb := '[]'::jsonb; v_kept jsonb := '[]'::jsonb; v_sub numeric := 0; v_amt numeric; v_qty numeric; v_price numeric; v_acc text;
        v_disc numeric; v_taxp numeric; v_tax numeric; v_tot numeric; v_code text; v_e uuid; v_id uuid; v_cogs numeric := 0; v_c numeric; v_pay text; v_party text;
        v_moves jsonb := '[]'::jsonb; m jsonb;
begin
  perform public.pk_fin_write_check();
  if v_kind not in ('jual', 'beli') then raise exception 'Jenis dokumen tidak dikenal'; end if;
  v_party := nullif(btrim(p->>'party'), '');
  if v_party is null then raise exception '%', case when v_kind = 'jual' then 'Isi nama pelanggan' else 'Isi nama vendor' end; end if;
  v_d := coalesce(nullif(p->>'date', '')::date, public.pk_today());
  v_u := coalesce(nullif(p->>'unit', ''), 'HQ');
  if not exists (select 1 from public.pk_units where code = v_u) then raise exception 'Unit % tidak dikenal', v_u; end if;
  v_pay := nullif(p->>'pay_acc', '');
  if v_pay is not null and not exists (select 1 from public.pk_fin_accounts where code = v_pay and is_cash and is_active) then raise exception 'Rekening pembayaran tidak valid'; end if;
  for x in select * from jsonb_array_elements(coalesce(p->'lines', '[]'::jsonb)) loop
    v_qty := coalesce(nullif(x->>'qty', '')::numeric, 1); v_price := coalesce(nullif(x->>'price', '')::numeric, 0);
    if v_qty <= 0 or v_price < 0 then raise exception 'Kuantitas dan harga harus positif'; end if;
    v_amt := round(v_qty * v_price * (1 - coalesce(nullif(x->>'disc_pct', '')::numeric, 0) / 100), 2);
    if v_amt = 0 then continue; end if;
    pr := null;
    if nullif(x->>'product', '') is not null then
      select * into pr from public.pk_fin_products where id = (x->>'product')::uuid and is_active;
      if pr.id is null then raise exception 'Produk tidak ditemukan'; end if;
    end if;
    v_acc := coalesce(nullif(x->>'acc', ''), case when pr.id is null then null when v_kind = 'jual' then pr.sales_acc when pr.kind = 'barang' then pr.inv_acc else coalesce(pr.cogs_acc, '6-60010') end);
    select * into a from public.pk_fin_accounts where code = v_acc and is_active;
    if a.code is null then raise exception 'Pilih produk atau akun di setiap baris'; end if;
    if a.is_cash then raise exception 'Akun baris tidak boleh kas/bank'; end if;
    v_sub := v_sub + v_amt;
    v_kept := v_kept || jsonb_build_object('product', pr.id, 'product_name', pr.name, 'acc', a.code, 'memo', nullif(btrim(x->>'memo'), ''), 'qty', v_qty, 'uom', coalesce(pr.uom, nullif(x->>'uom', '')),
      'price', v_price, 'disc_pct', coalesce(nullif(x->>'disc_pct', '')::numeric, 0), 'amount', v_amt, 'unit', coalesce(nullif(x->>'unit', ''), v_u), 'asset', nullif(x->>'asset', ''));
    v_ln := v_ln || jsonb_build_object('acc', a.code, 'unit', coalesce(nullif(x->>'unit', ''), v_u), 'asset', nullif(x->>'asset', ''), 'party', v_party,
      case when v_kind = 'jual' then 'c' else 'd' end, v_amt, 'memo', coalesce(nullif(btrim(x->>'memo'), ''), pr.name));
    if pr.id is not null and pr.kind = 'barang' then
      v_moves := v_moves || jsonb_build_object('product', pr.id, 'qty', case when v_kind = 'jual' then -v_qty else v_qty end, 'cost', case when v_kind = 'beli' then v_amt / v_qty end,
        'unit', coalesce(nullif(x->>'unit', ''), v_u), 'asset', nullif(x->>'asset', ''), 'name', pr.name);
      if v_kind = 'jual' then
        if pr.qty < v_qty then raise exception 'Stok % tinggal % %', pr.name, pr.qty, pr.uom; end if;
        v_c := round(v_qty * pr.avg_cost, 2);
        if v_c > 0 then
          v_cogs := v_cogs + v_c;
          v_ln := v_ln || jsonb_build_object('acc', pr.cogs_acc, 'unit', coalesce(nullif(x->>'unit', ''), v_u), 'd', v_c, 'memo', 'HPP ' || pr.name)
                       || jsonb_build_object('acc', pr.inv_acc, 'unit', coalesce(nullif(x->>'unit', ''), v_u), 'c', v_c, 'memo', 'HPP ' || pr.name);
        end if;
      end if;
    end if;
  end loop;
  if v_sub <= 0 then raise exception 'Isi minimal satu baris'; end if;
  v_disc := round(coalesce(nullif(p->>'discount', '')::numeric, 0), 2);
  if v_disc < 0 or v_disc >= v_sub then raise exception 'Diskon tidak masuk akal'; end if;
  v_taxp := coalesce(nullif(p->>'tax_pct', '')::numeric, 0);
  v_tax := round((v_sub - v_disc) * v_taxp / 100, 2);
  v_tot := v_sub - v_disc + v_tax;
  if v_disc > 0 then
    v_ln := v_ln || jsonb_build_object('acc', case when v_kind = 'jual' then '4-40009' else '7-70005' end, 'unit', v_u, case when v_kind = 'jual' then 'd' else 'c' end, v_disc, 'memo', 'Diskon');
  end if;
  if v_tax > 0 then
    v_ln := v_ln || jsonb_build_object('acc', '2-20400', 'unit', v_u, case when v_kind = 'jual' then 'c' else 'd' end, v_tax, 'memo', case when v_kind = 'jual' then 'PPN keluaran' else 'PPN masukan' end);
  end if;
  v_ln := v_ln || jsonb_build_object('acc', case when v_kind = 'jual' then '1-10100' else '2-20100' end, 'unit', v_u, 'party', v_party,
    case when v_kind = 'jual' then 'd' else 'c' end, v_tot, 'memo', case when v_kind = 'jual' then 'Piutang ' else 'Hutang ' end || v_party);
  v_code := public.pk_fin_doc_code(case when v_kind = 'jual' then 'INV' else 'PB' end, v_d);
  v_e := public.pk_fin_post(case when v_kind = 'jual' then 'penjualan' else 'pembelian' end, v_code, v_d, v_u,
    case when v_kind = 'jual' then 'Penjualan ' else 'Pembelian ' end || v_code || ' · ' || v_party || coalesce(' · ' || nullif(btrim(p->>'memo'), ''), ''),
    v_ln, null, nullif(btrim(p->>'proof_url'), ''), public.pk_me());
  for m in select * from jsonb_array_elements(v_moves) loop
    perform public.pk_fin_stock_apply((m->>'product')::uuid, v_d, (m->>'qty')::numeric, nullif(m->>'cost', '')::numeric,
      case when v_kind = 'jual' then 'penjualan' else 'pembelian' end, v_code, m->>'unit', nullif(m->>'asset', '')::uuid, null, v_e);
  end loop;
  insert into public.pk_fin_docs(kind, code, doc_date, due_date, unit_code, company_code, party, contact, memo, ref_no, lines, subtotal, discount, tax_pct, tax, total, cogs, status, entry_id, proof_url, created_by)
  values (v_kind, v_code, v_d, coalesce(nullif(p->>'due', '')::date, v_d + coalesce(nullif(p->>'terms', '')::int, 14)), v_u, public.pk_fin_company_of(v_u), v_party,
    nullif(btrim(p->>'contact'), ''), nullif(btrim(p->>'memo'), ''), nullif(btrim(p->>'ref_no'), ''), v_kept, v_sub, v_disc, v_taxp, v_tax, v_tot, v_cogs, 'belum', v_e,
    nullif(btrim(p->>'proof_url'), ''), public.pk_me())
  returning id into v_id;
  if v_pay is not null then perform public.pk_fin_doc_pay(v_id, v_pay, v_d, null); end if;
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

create or replace function public.pk_fin_doc_pay(p_id uuid, p_acc text, p_date date default null, p_amount numeric default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e public.pk_fin_docs; v_owe numeric; v_amt numeric; v_e uuid; v_d date; v_n int;
begin
  perform public.pk_fin_write_check();
  select * into e from public.pk_fin_docs where id = p_id for update;
  if e.id is null or e.status = 'batal' then raise exception 'Dokumen tidak ditemukan atau sudah batal'; end if;
  v_owe := e.total - e.paid;
  if v_owe <= 0 then raise exception 'Dokumen % sudah lunas', e.code; end if;
  if not exists (select 1 from public.pk_fin_accounts where code = p_acc and is_cash and is_active) then raise exception 'Pilih rekening kas/bank'; end if;
  v_amt := round(coalesce(p_amount, v_owe), 2);
  if v_amt <= 0 or v_amt > v_owe then raise exception 'Jumlah harus antara 1 dan %', v_owe; end if;
  v_d := coalesce(p_date, public.pk_today());
  v_n := coalesce(array_length(e.pay_entries, 1), 0) + 1;
  v_e := public.pk_fin_post(case when e.kind = 'jual' then 'penjualan' else 'pembelian' end, e.code || '/BYR' || v_n, v_d, e.unit_code,
    case when e.kind = 'jual' then 'Terima pembayaran ' else 'Bayar ' end || e.code || ' · ' || e.party,
    case when e.kind = 'jual' then jsonb_build_array(jsonb_build_object('acc', p_acc, 'unit', e.unit_code, 'd', v_amt, 'party', e.party),
                                                     jsonb_build_object('acc', '1-10100', 'unit', e.unit_code, 'c', v_amt, 'party', e.party, 'memo', 'Pelunasan ' || e.code))
         else jsonb_build_array(jsonb_build_object('acc', '2-20100', 'unit', e.unit_code, 'd', v_amt, 'party', e.party, 'memo', 'Pelunasan ' || e.code),
                                jsonb_build_object('acc', p_acc, 'unit', e.unit_code, 'c', v_amt, 'party', e.party)) end,
    null, null, public.pk_me());
  update public.pk_fin_docs set paid = paid + v_amt, pay_entries = pay_entries || v_e,
    payments = payments || jsonb_build_array(jsonb_build_object('date', v_d, 'acc', p_acc, 'amount', v_amt, 'entry', (select code from public.pk_fin_entries where id = v_e))),
    status = case when paid + v_amt >= total then 'lunas' else 'belum' end where id = e.id;
  return jsonb_build_object('remaining', v_owe - v_amt);
end $$;

create or replace function public.pk_fin_doc_void(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare e public.pk_fin_docs; x uuid; m record;
begin
  perform public.pk_fin_write_check();
  select * into e from public.pk_fin_docs where id = p_id for update;
  if e.id is null or e.status = 'batal' then raise exception 'Dokumen tidak ditemukan atau sudah batal'; end if;
  foreach x in array e.pay_entries loop perform public.pk_fin_void(x, p_reason); end loop;
  if e.entry_id is not null then perform public.pk_fin_void(e.entry_id, p_reason); end if;
  for m in select product_id, qty, unit_cost, unit_code from public.pk_fin_stock_moves where ref_code = e.code and ref_type in ('penjualan', 'pembelian') loop
    perform public.pk_fin_stock_apply(m.product_id, public.pk_today(), -m.qty, m.unit_cost, 'batal', e.code, m.unit_code, null, 'Batal ' || e.code, null);
  end loop;
  update public.pk_fin_docs set status = 'batal', void_reason = btrim(p_reason) where id = e.id;
end $$;

create or replace function public.pk_fin_doc_list(p_kind text, p_from date, p_to date, p_status text default null, p_q text default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare t date := public.pk_today();
begin
  perform public.pk_fin_read_check();
  return jsonb_build_object(
    'rows', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'code', code, 'date', doc_date, 'due', due_date, 'unit', unit_code, 'party', party, 'memo', memo, 'ref_no', ref_no,
        'status', case when status = 'belum' and due_date < t then 'telat' when status = 'belum' and paid > 0 then 'sebagian' else status end,
        'total', total, 'paid', paid, 'owe', case when status = 'batal' then 0 else total - paid end, 'tax', tax) order by doc_date desc, code desc), '[]'::jsonb)
      from (select * from public.pk_fin_docs where kind = p_kind and doc_date between p_from and p_to
        and (p_status is null or (p_status = 'telat' and status = 'belum' and due_date < t) or (p_status = 'sebagian' and status = 'belum' and paid > 0) or status = p_status)
        and (p_q is null or (code || ' ' || party || ' ' || coalesce(memo, '') || ' ' || coalesce(ref_no, '')) ilike '%' || p_q || '%') order by doc_date desc limit 1000) z),
    'sum', (select jsonb_build_object(
      'belum', coalesce(sum(total - paid) filter (where status = 'belum'), 0), 'n_belum', count(*) filter (where status = 'belum'),
      'telat', coalesce(sum(total - paid) filter (where status = 'belum' and due_date < t), 0), 'n_telat', count(*) filter (where status = 'belum' and due_date < t),
      'lunas30', coalesce(sum(paid) filter (where status <> 'batal' and doc_date > t - 30), 0),
      'bulan', coalesce(sum(total) filter (where status <> 'batal' and date_trunc('month', doc_date) = date_trunc('month', t::timestamp)), 0),
      'n_bulan', count(*) filter (where status <> 'batal' and date_trunc('month', doc_date) = date_trunc('month', t::timestamp)))
      from public.pk_fin_docs where kind = p_kind),
    'parties', (select coalesce(jsonb_agg(distinct party), '[]'::jsonb) from public.pk_fin_docs where kind = p_kind));
end $$;

create or replace function public.pk_fin_doc_get(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e public.pk_fin_docs;
begin
  perform public.pk_fin_read_check();
  select * into e from public.pk_fin_docs where id = p_id;
  if e.id is null then raise exception 'Dokumen tidak ditemukan'; end if;
  return to_jsonb(e) || jsonb_build_object(
    'lines', (select coalesce(jsonb_agg(l || jsonb_build_object('name', a.name, 'asset_no', un.asset_no)), '[]'::jsonb)
              from jsonb_array_elements(e.lines) l left join public.pk_fin_accounts a on a.code = l->>'acc' left join public.units un on un.id::text = l->>'asset'),
    'company', (select jsonb_build_object('code', c.code, 'name', c.name) from public.pk_fin_companies c where c.code = e.company_code),
    'journal', (select coalesce(jsonb_agg(jsonb_build_object('code', en.code, 'date', en.entry_date, 'memo', en.memo,
                 'lines', (select jsonb_agg(jsonb_build_object('acc', li.account_code, 'name', ac.name, 'd', li.debit, 'c', li.credit) order by li.debit desc)
                           from public.pk_fin_lines li join public.pk_fin_accounts ac on ac.code = li.account_code where li.entry_id = en.id)) order by en.created_at), '[]'::jsonb)
                from public.pk_fin_entries en where en.id = e.entry_id or en.id = any(e.pay_entries) or en.reverses = e.entry_id or en.reverses = any(e.pay_entries)));
end $$;

/* ---------- Aset tetap ---------- */
create or replace function public.pk_fin_asset_class(p_prefix text)
returns jsonb language sql immutable as $$
  select case
    when p_prefix in ('MTR', 'MBL', 'JEP') then '{"asset":"1-10701","accum":"1-10751","life":60,"label":"Kendaraan"}'::jsonb
    when p_prefix in ('KAM', 'LNS', 'IPH', 'PSG', 'PRY') then '{"asset":"1-10702","accum":"1-10752","life":36,"label":"Elektronik & kamera"}'::jsonb
    when p_prefix in ('CMP', 'PKN') then '{"asset":"1-10703","accum":"1-10753","life":24,"label":"Camping & piknik"}'::jsonb
    else '{"asset":"1-10704","accum":"1-10753","life":48,"label":"Peralatan & inventaris"}'::jsonb end
$$;

-- daftarkan unit sewa Rentalaja App sebagai aset tetap (sekali per unit; harga bisa diisi belakangan)
create or replace function public.pk_fin_asset_import_units()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare n int := 0; u record; k jsonb;
begin
  perform public.pk_fin_write_check();
  for u in select un.*, p.name pname from public.units un left join public.products p on p.id = un.product_id
           where un.archived_at is null and not exists (select 1 from public.pk_fin_assets a where a.asset_unit_id = un.id) order by un.asset_no loop
    k := public.pk_fin_asset_class(split_part(u.asset_no, '-', 1));
    insert into public.pk_fin_assets(code, name, asset_acc, accum_acc, unit_code, asset_unit_id, acquired, cost, life_months, start_month, note, created_by)
    values (coalesce(u.asset_no, 'AT-' || lpad(nextval('public.pk_fin_doc_seq')::text, 5, '0')),
      coalesce(u.pname, 'Unit') || coalesce(' · ' || u.plate_or_serial, ''), k->>'asset', k->>'accum', 'RA', u.id, u.purchase_date, coalesce(u.purchase_price, 0), (k->>'life')::int,
      case when u.purchase_date is not null then (date_trunc('month', u.purchase_date) + interval '1 month')::date end, 'Dari Rentalaja App', public.pk_me());
    n := n + 1;
  end loop;
  return jsonb_build_object('added', n);
end $$;

-- p: {id?, code, name, asset_acc, accum_acc, exp_acc, unit, asset_unit, acquired, cost, residual, life_months, start_month, accum_opening, note, pay_acc (catat perolehan dibayar dari rekening)}
create or replace function public.pk_fin_asset_save(p jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid := nullif(p->>'id', '')::uuid; v_code text; v_cost numeric := coalesce(nullif(p->>'cost', '')::numeric, 0); v_e uuid; v_acq date := nullif(p->>'acquired', '')::date;
        v_acc text := coalesce(nullif(p->>'asset_acc', ''), '1-10704'); v_u text := coalesce(nullif(p->>'unit', ''), 'RA');
begin
  perform public.pk_fin_write_check();
  if coalesce(btrim(p->>'name'), '') = '' then raise exception 'Isi nama aset'; end if;
  if exists (select 1 from public.pk_fin_depr where asset_id = v_id) and exists (select 1 from public.pk_fin_assets where id = v_id and (cost <> v_cost or life_months <> coalesce(nullif(p->>'life_months', '')::int, life_months))) then
    raise exception 'Aset sudah disusutkan; harga & umur tidak bisa diubah. Lepas aset lalu catat ulang bila perlu.';
  end if;
  v_code := coalesce(nullif(btrim(p->>'code'), ''), 'AT-' || lpad(nextval('public.pk_fin_doc_seq')::text, 5, '0'));
  if v_id is null then
    insert into public.pk_fin_assets(code, name, asset_acc, accum_acc, exp_acc, unit_code, asset_unit_id, acquired, cost, residual, life_months, start_month, accum_opening, note, created_by)
    values (v_code, btrim(p->>'name'), v_acc, coalesce(nullif(p->>'accum_acc', ''), '1-10753'), coalesce(nullif(p->>'exp_acc', ''), '5-50001'), v_u, nullif(p->>'asset_unit', '')::uuid,
      v_acq, v_cost, coalesce(nullif(p->>'residual', '')::numeric, 0), coalesce(nullif(p->>'life_months', '')::int, 48),
      coalesce(nullif(p->>'start_month', '')::date, (date_trunc('month', coalesce(v_acq, public.pk_today())) + interval '1 month')::date),
      coalesce(nullif(p->>'accum_opening', '')::numeric, 0), nullif(p->>'note', ''), public.pk_me())
    returning id into v_id;
  else
    update public.pk_fin_assets set code = v_code, name = btrim(p->>'name'), asset_acc = v_acc, accum_acc = coalesce(nullif(p->>'accum_acc', ''), accum_acc),
      exp_acc = coalesce(nullif(p->>'exp_acc', ''), exp_acc), unit_code = v_u, acquired = v_acq, cost = v_cost, residual = coalesce(nullif(p->>'residual', '')::numeric, residual),
      life_months = coalesce(nullif(p->>'life_months', '')::int, life_months),
      start_month = coalesce(nullif(p->>'start_month', '')::date, start_month, (date_trunc('month', coalesce(v_acq, public.pk_today())) + interval '1 month')::date),
      accum_opening = coalesce(nullif(p->>'accum_opening', '')::numeric, accum_opening), note = nullif(p->>'note', '')
    where id = v_id;
  end if;
  if nullif(p->>'pay_acc', '') is not null and v_cost > 0 and (select entry_id from public.pk_fin_assets where id = v_id) is null then
    v_e := public.pk_fin_post('aset', 'PEROLEHAN-' || v_code, coalesce(v_acq, public.pk_today()), v_u, 'Perolehan aset ' || v_code || ' · ' || btrim(p->>'name'),
      jsonb_build_array(jsonb_build_object('acc', v_acc, 'unit', v_u, 'd', v_cost, 'asset', nullif(p->>'asset_unit', '')),
                        jsonb_build_object('acc', p->>'pay_acc', 'unit', v_u, 'c', v_cost)), null, null, public.pk_me());
    update public.pk_fin_assets set entry_id = v_e where id = v_id;
  end if;
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

-- nilai penyusutan satu aset untuk satu bulan (0 bila belum mulai, sudah habis, atau harga kosong)
create or replace function public.pk_fin_asset_month_amount(a public.pk_fin_assets, p_month date)
returns numeric language sql stable set search_path to 'public' as $$
  select case when a.status <> 'aktif' or a.cost <= 0 or a.start_month is null or p_month < a.start_month then 0
    else greatest(0, least(round((a.cost - a.residual) / a.life_months, 0),
      a.cost - a.residual - a.accum_opening - coalesce((select sum(amount) from public.pk_fin_depr d where d.asset_id = a.id and d.month < p_month), 0))) end
$$;

-- jalankan penyusutan bulanan (idempoten: aset yang sudah disusutkan bulan itu dilewati)
create or replace function public.pk_fin_depr_run(p_month date)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare m date := date_trunc('month', p_month)::date; a public.pk_fin_assets; v numeric; ln jsonb := '[]'::jsonb; tot numeric := 0; n int := 0; v_e uuid; ids uuid[] := '{}'; amts numeric[] := '{}'; i int;
begin
  perform public.pk_fin_write_check();
  if m > date_trunc('month', public.pk_today()) then raise exception 'Penyusutan hanya untuk bulan berjalan atau sebelumnya'; end if;
  for a in select * from public.pk_fin_assets where status = 'aktif' and not exists (select 1 from public.pk_fin_depr d where d.asset_id = pk_fin_assets.id and d.month = m) loop
    v := public.pk_fin_asset_month_amount(a, m);
    if v <= 0 then continue; end if;
    ln := ln || jsonb_build_object('acc', a.exp_acc, 'unit', a.unit_code, 'd', v, 'asset', a.asset_unit_id, 'memo', 'Penyusutan ' || a.code)
             || jsonb_build_object('acc', a.accum_acc, 'unit', a.unit_code, 'c', v, 'asset', a.asset_unit_id, 'memo', 'Penyusutan ' || a.code);
    ids := ids || a.id; amts := amts || v; tot := tot + v; n := n + 1;
  end loop;
  if n = 0 then return jsonb_build_object('n', 0, 'total', 0); end if;
  v_e := public.pk_fin_post('aset', 'DEPR-' || to_char(m, 'YYYY-MM') || '-' || nextval('public.pk_fin_doc_seq'), (m + interval '1 month - 1 day')::date, 'RA',
    'Penyusutan aset tetap ' || to_char(m, 'MM/YYYY') || ' · ' || n || ' aset', ln, null, null, public.pk_me());
  for i in 1..n loop insert into public.pk_fin_depr(asset_id, month, amount, entry_id) values (ids[i], m, amts[i], v_e); end loop;
  return jsonb_build_object('n', n, 'total', tot, 'entry', (select code from public.pk_fin_entries where id = v_e));
end $$;

-- lepas / jual aset: tutup akumulasi, catat laba/rugi pelepasan
create or replace function public.pk_fin_asset_dispose(p_id uuid, p_date date, p_value numeric, p_acc text default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare a public.pk_fin_assets; acc_dep numeric; book numeric; gain numeric; ln jsonb; v_e uuid;
begin
  perform public.pk_fin_write_check();
  select * into a from public.pk_fin_assets where id = p_id for update;
  if a.id is null or a.status <> 'aktif' then raise exception 'Aset tidak aktif'; end if;
  acc_dep := a.accum_opening + coalesce((select sum(amount) from public.pk_fin_depr where asset_id = a.id), 0);
  book := a.cost - acc_dep; gain := coalesce(p_value, 0) - book;
  if a.cost > 0 then
    ln := jsonb_build_array(jsonb_build_object('acc', a.accum_acc, 'unit', a.unit_code, 'd', acc_dep, 'asset', a.asset_unit_id),
                            jsonb_build_object('acc', a.asset_acc, 'unit', a.unit_code, 'c', a.cost, 'asset', a.asset_unit_id));
    if coalesce(p_value, 0) > 0 then
      if p_acc is null then raise exception 'Pilih rekening penerimaan hasil penjualan aset'; end if;
      ln := ln || jsonb_build_object('acc', p_acc, 'unit', a.unit_code, 'd', p_value);
    end if;
    if gain <> 0 then ln := ln || jsonb_build_object('acc', '7-70004', 'unit', a.unit_code, case when gain > 0 then 'c' else 'd' end, abs(gain), 'asset', a.asset_unit_id); end if;
    v_e := public.pk_fin_post('aset', 'LEPAS-' || a.code, coalesce(p_date, public.pk_today()), a.unit_code, 'Pelepasan aset ' || a.code || coalesce(' · ' || p_note, ''), ln, null, null, public.pk_me());
  end if;
  update public.pk_fin_assets set status = 'dilepas', disposed_at = coalesce(p_date, public.pk_today()), dispose_value = p_value, dispose_entry = v_e,
    note = concat_ws(' · ', note, p_note) where id = a.id;
  return jsonb_build_object('gain', gain);
end $$;

create or replace function public.pk_fin_assets_list(p_q text default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare m date := date_trunc('month', public.pk_today())::date;
begin
  perform public.pk_fin_read_check();
  return jsonb_build_object(
    'rows', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'code', a.code, 'name', a.name, 'asset_acc', a.asset_acc, 'acc_name', ac.name, 'unit', a.unit_code,
        'acquired', a.acquired, 'cost', a.cost, 'residual', a.residual, 'life', a.life_months, 'start', a.start_month, 'status', a.status,
        'accum', a.accum_opening + coalesce(d.s, 0), 'book', a.cost - a.accum_opening - coalesce(d.s, 0), 'months', coalesce(d.n, 0), 'last', d.last,
        'monthly', case when a.cost > 0 then round((a.cost - a.residual) / a.life_months) else 0 end, 'this_month', public.pk_fin_asset_month_amount(a, m),
        'done_this_month', exists (select 1 from public.pk_fin_depr x where x.asset_id = a.id and x.month = m), 'asset_no', u.asset_no, 'unit_status', u.status, 'note', a.note) order by a.code), '[]'::jsonb)
      from public.pk_fin_assets a join public.pk_fin_accounts ac on ac.code = a.asset_acc left join public.units u on u.id = a.asset_unit_id
      left join (select asset_id, sum(amount) s, count(*) n, max(month) last from public.pk_fin_depr group by asset_id) d on d.asset_id = a.id
      where p_q is null or (a.code || ' ' || a.name || ' ' || coalesce(u.plate_or_serial, '')) ilike '%' || p_q || '%'),
    'units_unregistered', (select count(*) from public.units un where un.archived_at is null and not exists (select 1 from public.pk_fin_assets a where a.asset_unit_id = un.id)),
    'runs', (select coalesce(jsonb_agg(jsonb_build_object('m', to_char(month, 'YYYY-MM'), 'n', n, 'total', t) order by month desc), '[]'::jsonb)
             from (select month, count(*) n, sum(amount) t from public.pk_fin_depr group by month order by month desc limit 12) r));
end $$;

/* ---------- Pajak ---------- */
create or replace function public.pk_fin_tax_summary(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  perform public.pk_fin_read_check();
  return jsonb_build_object(
    'months', (select coalesce(jsonb_agg(r order by r->>'m' desc), '[]'::jsonb) from (
      select jsonb_build_object('m', to_char(mm, 'YYYY-MM'),
        'ppn_out', coalesce((select sum(tax) from public.pk_fin_docs where kind = 'jual' and status <> 'batal' and date_trunc('month', doc_date) = mm), 0),
        'ppn_in', coalesce((select sum(tax) from public.pk_fin_docs where kind = 'beli' and status <> 'batal' and date_trunc('month', doc_date) = mm), 0),
        'pph', coalesce((select sum(tax) from public.pk_fin_expenses where status <> 'batal' and date_trunc('month', doc_date) = mm), 0),
        'paid', coalesce((select sum(l.debit) from public.pk_fin_lines l join public.pk_fin_entries e on e.id = l.entry_id
                          where l.account_code = '2-20400' and e.source in ('kasbank', 'manual', 'bank') and date_trunc('month', e.entry_date) = mm), 0),
        'beban', coalesce((select sum(l.debit - l.credit) from public.pk_fin_lines l join public.pk_fin_entries e on e.id = l.entry_id
                          where l.account_code = '8-80002' and date_trunc('month', e.entry_date) = mm), 0)) r
      from generate_series(date_trunc('month', p_from::timestamp), date_trunc('month', p_to::timestamp), interval '1 month') mm) z),
    'balance', coalesce((select sum(l.credit - l.debit) from public.pk_fin_lines l join public.pk_fin_entries e on e.id = l.entry_id where l.account_code = '2-20400' and e.entry_date <= p_to), 0),
    'docs', (select coalesce(jsonb_agg(jsonb_build_object('kind', k, 'code', code, 'date', d, 'party', party, 'base', base, 'tax', tax) order by d desc), '[]'::jsonb) from (
      select case kind when 'jual' then 'PPN keluaran' else 'PPN masukan' end k, code, doc_date d, party, subtotal - discount base, tax from public.pk_fin_docs where status <> 'batal' and tax > 0 and doc_date between p_from and p_to
      union all select 'PPh dipotong', code, doc_date, party, total, tax from public.pk_fin_expenses where status <> 'batal' and tax > 0 and doc_date between p_from and p_to
      order by 3 desc limit 300) z));
end $$;

/* ---------- hak akses fungsi ---------- */
do $$ declare f text; begin
  foreach f in array array['pk_fin_product_save(jsonb)', 'pk_fin_stock_adjust(jsonb)', 'pk_fin_products_list(text)', 'pk_fin_product_moves(uuid)',
    'pk_fin_doc_save(jsonb)', 'pk_fin_doc_pay(uuid,text,date,numeric)', 'pk_fin_doc_void(uuid,text)', 'pk_fin_doc_list(text,date,date,text,text)', 'pk_fin_doc_get(uuid)',
    'pk_fin_asset_import_units()', 'pk_fin_asset_save(jsonb)', 'pk_fin_depr_run(date)', 'pk_fin_asset_dispose(uuid,date,numeric,text,text)', 'pk_fin_assets_list(text)',
    'pk_fin_tax_summary(date,date)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
  foreach f in array array['pk_fin_stock_apply(uuid,date,numeric,numeric,text,text,text,uuid,text,uuid)', 'pk_fin_asset_month_amount(pk_fin_assets,date)', 'pk_fin_asset_class(text)', 'pk_fin_party_of(jsonb)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
