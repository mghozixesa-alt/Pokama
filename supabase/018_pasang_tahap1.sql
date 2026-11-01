-- Pasang buku besar grup Pokama (tahap 1): 018a tabel + 018b mesin + 018d laporan.
-- TIDAK termasuk 018c (sambungan Rentalaja App). Jalankan sekali di Supabase → SQL Editor → Run.
begin;
-- 018a: Modul Keuangan Grup Pokama — tabel, akun, peta, sumber data
-- Prinsip: input sekali di sistem asal (website/RAB/bank) → kejadian (event) → mesin jurnal otomatis → laporan.
-- Manusia (Keuangan) hanya menangani pengecualian: akun yang belum dipetakan dan mutasi bank yang belum dikenali.
-- Satu buku grup: Rentalaja App, TripinAja, Niagaaja, RAB/LPJ, gaji, dan mutasi bank semuanya masuk lewat kejadian ke buku ini.

-- ===== bagan akun grup =====
create table if not exists public.pk_fin_accounts (
  code text primary key check (code ~ '^[1-8]-\d{5}$'),
  name text not null,
  grp text generated always as (case left(code, 1) when '1' then 'aset' when '2' then 'kewajiban' when '3' then 'ekuitas'
    when '4' then 'pendapatan' when '5' then 'hpp' when '6' then 'beban' when '7' then 'pendapatan_lain' else 'beban_lain' end) stored,
  is_cash boolean not null default false,
  pos text check (pos in ('penerimaan','kewajiban','operasional','bersama','investasi')),
  unit_code text references public.pk_units(code),
  bank text,
  bank_balance numeric(16,2),
  bank_balance_at date,
  note text,
  sort int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ===== buku jurnal grup =====
create sequence if not exists public.pk_fin_seq;
create table if not exists public.pk_fin_entries (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  entry_date date not null,
  unit_code text references public.pk_units(code),
  source text not null,
  source_ref text,
  event_id uuid,
  memo text,
  proof_url text,
  status text not null default 'posted' check (status in ('posted','void')),
  reverses uuid references public.pk_fin_entries(id),
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists pk_fin_entries_src on public.pk_fin_entries(source, source_ref) where status = 'posted' and source_ref is not null;
create index if not exists pk_fin_entries_date on public.pk_fin_entries(entry_date);
create table if not exists public.pk_fin_lines (
  id bigserial primary key,
  entry_id uuid not null references public.pk_fin_entries(id) on delete cascade,
  account_code text not null references public.pk_fin_accounts(code),
  unit_code text references public.pk_units(code),
  debit numeric(16,2) not null default 0 check (debit >= 0),
  credit numeric(16,2) not null default 0 check (credit >= 0),
  memo text
);
create index if not exists pk_fin_lines_entry on public.pk_fin_lines(entry_id);
create index if not exists pk_fin_lines_acc on public.pk_fin_lines(account_code);

-- ===== tutup buku =====
create table if not exists public.pk_fin_periods (
  month date primary key check (extract(day from month) = 1),
  status text not null default 'open' check (status in ('open','locked')),
  locked_by uuid, locked_at timestamptz, note text
);

-- ===== peta otomatis: kunci kejadian → akun =====
-- kunci: <jenis>[:<unit>][:<kategori/kanal>], mis. rev:WG:open_trip, cash:NA:tunai, exp:konsumsi, rab_pay:RA
create table if not exists public.pk_fin_maps (
  key text primary key,
  account_code text not null references public.pk_fin_accounts(code),
  note text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

-- ===== sumber data & kunci API =====
create table if not exists public.pk_fin_sources (
  code text primary key,
  name text not null,
  unit_code text references public.pk_units(code),
  kind text not null check (kind in ('website','sistem','database','bank')),
  feeds_omzet boolean not null default false,
  is_active boolean not null default true,
  last_event_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);
create table if not exists public.pk_fin_source_keys (
  source text primary key references public.pk_fin_sources(code) on delete cascade,
  key_hash text not null,
  hint text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- ===== kotak masuk kejadian keuangan =====
create table if not exists public.pk_fin_events (
  id uuid primary key default gen_random_uuid(),
  source text not null references public.pk_fin_sources(code),
  external_id text not null,
  type text not null,
  event_date date not null,
  unit_code text references public.pk_units(code),
  amount numeric(16,2),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'baru' check (status in ('baru','terposting','gagal','diabaikan')),
  error text,
  need_key text,
  entry_id uuid references public.pk_fin_entries(id),
  attempts int not null default 0,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  resolved_by uuid,
  note text,
  unique (source, external_id)
);
create index if not exists pk_fin_events_status on public.pk_fin_events(status);

-- ===== mutasi bank (rekonsiliasi) =====
create table if not exists public.pk_fin_bank_lines (
  id uuid primary key default gen_random_uuid(),
  account_code text not null references public.pk_fin_accounts(code),
  tx_date date not null,
  description text not null,
  amount numeric(16,2) not null check (amount <> 0),
  balance numeric(16,2),
  batch text,
  status text not null default 'baru' check (status in ('baru','cocok','diposting','diabaikan')),
  match_ref text,
  event_id uuid references public.pk_fin_events(id),
  note text,
  created_at timestamptz not null default now()
);
create unique index if not exists pk_fin_bank_dupe on public.pk_fin_bank_lines(account_code, tx_date, description, amount, coalesce(balance, -1));
create table if not exists public.pk_fin_bank_rules (
  id uuid primary key default gen_random_uuid(),
  pattern text not null check (length(btrim(pattern)) >= 3),
  account_code text not null references public.pk_fin_accounts(code),
  unit_code text references public.pk_units(code),
  cash_account text references public.pk_fin_accounts(code),
  note text,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- ===== kewajiban rutin (leasing, pinjaman, bagi hasil, sewa, langganan) =====
create table if not exists public.pk_fin_obligations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'lain' check (kind in ('leasing','pinjaman','bagi_hasil','sewa','langganan','pajak','lain')),
  unit_code text references public.pk_units(code),
  amount numeric(16,2) not null check (amount > 0),
  due_day int not null check (due_day between 1 and 31),
  start_month date,
  end_month date,
  account_code text not null references public.pk_fin_accounts(code),
  bank_pattern text,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);

-- ===== akses: baca untuk CEO, Kepala Staf (audit), Keuangan; tulis hanya lewat fungsi =====
create or replace function public.pk_fin_can_read() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.pk_role() in ('ceo','kepala_staf','keuangan'), false)
$$;
do $$ declare t text; begin
  foreach t in array array['pk_fin_accounts','pk_fin_entries','pk_fin_lines','pk_fin_periods','pk_fin_maps','pk_fin_sources','pk_fin_source_keys',
                           'pk_fin_events','pk_fin_bank_lines','pk_fin_bank_rules','pk_fin_obligations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    if t <> 'pk_fin_source_keys' then
      execute format('drop policy if exists %I on public.%I', t || '_r', t);
      execute format('create policy %I on public.%I for select to authenticated using (public.pk_fin_can_read())', t || '_r', t);
    end if;
  end loop;
end $$;
revoke all on public.pk_fin_source_keys from authenticated;

-- ===== pengaturan =====
insert into public.pk_settings(key, value, note) values
  ('fin_capitalize_min', '500000', 'Barang RAB dengan harga satuan ≥ angka ini dicatat sebagai aset (bila kategorinya dipetakan ke aset)'),
  ('fin_payroll_day', '25', 'Tanggal gaji bulan berjalan otomatis dibukukan sebagai beban gaji per unit'),
  ('fin_close_day', '5', 'Tutup buku bulan lalu paling lambat tanggal ini')
on conflict (key) do nothing;

-- ===== bagan akun: salin akun Rentalaja (kode sama) + akun grup =====
insert into public.pk_fin_accounts(code, name, is_cash, sort)
select a.code, a.name, a.is_cash, 0 from public.accounts a where not a.is_header and a.code ~ '^[1-8]-\d{5}$'
on conflict (code) do nothing;
update public.pk_fin_accounts set unit_code = x.u, pos = x.p from (values
  ('1-10001','GK','operasional'), ('1-10002','WN','operasional'), ('1-10003','BD','operasional'), ('1-10004','EX','operasional'),
  ('1-10011','RA','operasional'), ('1-10012','RA','investasi'), ('1-10013','RA','kewajiban'), ('1-10014','RA','bersama'),
  ('1-10015','RA','investasi'), ('1-10021', null, 'penerimaan')) x(c, u, p) where code = x.c;
insert into public.pk_fin_accounts(code, name, is_cash, unit_code, pos, sort) values
  ('1-10031','Bank Penerimaan TripinAja', true, 'WG', 'penerimaan', 31), ('1-10032','Bank Operasional TripinAja', true, 'WG', 'operasional', 32),
  ('1-10033','Kas TripinAja', true, 'WG', 'operasional', 33),
  ('1-10041','Bank Penerimaan Niagaaja', true, 'NA', 'penerimaan', 41), ('1-10042','Bank Operasional Niagaaja', true, 'NA', 'operasional', 42),
  ('1-10043','Kas toko Niagaaja', true, 'NA', 'operasional', 43),
  ('1-10051','Bank Operasional Holding', true, 'HQ', 'bersama', 51), ('1-10052','Bank Kewajiban (cicilan & bagi hasil)', true, 'HQ', 'kewajiban', 52),
  ('1-10053','Bank Investasi & pilot', true, 'HQ', 'investasi', 53), ('1-10061','Kas kecil Holding', true, 'HQ', 'bersama', 61)
on conflict (code) do nothing;
insert into public.pk_fin_accounts(code, name) values
  ('1-10102','Uang muka kegiatan (RAB)'), ('1-10210','Persediaan barang dagang'), ('1-10704','Peralatan dan inventaris'),
  ('2-20600','Hutang reimburse karyawan'), ('2-21100','Hutang bank'), ('2-21200','Dana investor (modal kerja)'),
  ('4-41001','Pendapatan paket tour'), ('4-41002','Pendapatan open trip dan custom'),
  ('4-42001','Penjualan laptop'), ('4-42002','Penjualan kamera'), ('4-42003','Pendapatan jasa servis'),
  ('5-51001','HPP barang dagang'), ('5-51002','Biaya vendor tour'),
  ('6-60008','Bahan dan perlengkapan'), ('6-60009','Konsumsi'), ('6-60010','Jasa dan tenaga lepas'), ('6-60011','ATK dan kantor'),
  ('6-60012','Langganan dan sistem'), ('7-70005','Pendapatan lain-lain')
on conflict (code) do nothing;

-- ===== peta awal =====
insert into public.pk_fin_maps(key, account_code, note) values
  ('cash:RA','1-10011','Rekening default Rentalaja'), ('cash:WG','1-10031','Rekening default TripinAja'), ('cash:NA','1-10041','Rekening default Niagaaja'),
  ('cash:HQ','1-10051','Rekening default Holding'),
  ('cash:qris','1-10021','Uang masuk lewat gateway'), ('cash:xendit','1-10021',null), ('cash:midtrans','1-10021',null), ('cash:va','1-10021',null),
  ('cash:ewallet','1-10021',null), ('cash:kartu','1-10021',null),
  ('cash:tunai','1-10061','Tunai tanpa unit'), ('cash:WG:tunai','1-10033',null), ('cash:NA:tunai','1-10043',null),
  ('rev:RA','4-40001',null), ('rev:WG','4-41001',null), ('rev:WG:open_trip','4-41002',null), ('rev:WG:custom','4-41002',null),
  ('rev:NA','4-42001',null), ('rev:NA:laptop','4-42001',null), ('rev:NA:kamera','4-42002',null), ('rev:NA:servis','4-42003',null),
  ('rev:HQ','7-70005',null),
  ('cogs','5-51001','HPP default'), ('cogs:WG','5-51002','Biaya vendor tour'), ('stock','1-10210',null),
  ('dp','2-20200',null), ('fee','6-60006',null), ('advance','1-10102',null), ('reimburse','2-20600',null),
  ('payroll','6-60001',null), ('payroll_payable','2-20500',null),
  ('rab_pay:RA','1-10011','RAB Rentalaja dibayar dari'), ('rab_pay:WG','1-10032','RAB TripinAja dibayar dari'),
  ('rab_pay:NA','1-10042','RAB Niagaaja dibayar dari'), ('rab_pay:HQ','1-10051','RAB Holding dibayar dari'),
  ('exp:bahan_perlengkapan','6-60008',null), ('exp:sparepart_perawatan','5-50002',null), ('exp:konsumsi','6-60009',null),
  ('exp:transport_ongkir','6-60005',null), ('exp:marketing_cetak','6-60004',null), ('exp:jasa_tenaga','6-60010',null),
  ('exp:atk_kantor','6-60011',null), ('exp:lain_lain','6-60007',null), ('exp:iklan','6-60004',null), ('exp:vendor_tour','5-51002',null),
  ('exp:sewa','6-60002',null), ('exp:listrik_air_internet','6-60003',null), ('exp:langganan_sistem','6-60012',null),
  ('asset:bahan_perlengkapan','1-10704','Barang mahal dicatat aset'), ('asset:atk_kantor','1-10704',null), ('asset:lain_lain','1-10704',null)
on conflict (key) do nothing;

insert into public.pk_fin_sources(code, name, unit_code, kind, note) values
  ('rentalaja','Rentalaja App (rentalaja.co.id)','RA','database','Otomatis dari transaksi Rentalaja App'),
  ('tripinaja','Website TripinAja','WG','website','Kirim lewat API pk-fin-ingest'),
  ('niagaaja','Website Niagaaja','NA','website','Kirim lewat API pk-fin-ingest'),
  ('pokama','Sistem Kerja Pokama (RAB, gaji)','HQ','sistem','Otomatis dari RAB/LPJ dan gaji'),
  ('bank','Mutasi bank','HQ','bank','Mutasi yang dikenali aturan bank'),
  ('manual','Jurnal penyesuaian Keuangan','HQ','sistem','Koreksi manual oleh Keuangan')
on conflict (code) do nothing;

-- sambungan Rentalaja App (018c) belum dipasang: tunggu keputusan owner
update public.pk_fin_sources set is_active = false, note = 'Belum disambung. Rentalaja App masih memakai pembukuannya sendiri sampai sambungan 018c dipasang.' where code in ('rentalaja','niagaaja');

-- 018b: Mesin jurnal otomatis — peta akun, posting, pemrosesan kejadian, RAB, gaji, mutasi bank

create or replace function public.pk_fin_slug(t text) returns text
language sql immutable as $$ select nullif(btrim(regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', '_', 'g'), '_'), '') $$;

create or replace function public.pk_fin_biz(u text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select coalesce(x.parent, x.code) from public.pk_units x where x.code = u), 'HQ')
$$;

-- cari akun dari peta: paling spesifik dulu (unit+kunci → bisnis+kunci → kunci → unit → bisnis → jenis)
create or replace function public.pk_fin_map(kind text, u text, k text default null) returns text
language plpgsql stable security definer set search_path = public as $$
declare b text := public.pk_fin_biz(u); s text := public.pk_fin_slug(k); r text; c text;
begin
  foreach c in array array[
    case when u is not null and s is not null then kind || ':' || u || ':' || s end,
    case when s is not null then kind || ':' || b || ':' || s end,
    case when s is not null then kind || ':' || s end,
    case when u is not null then kind || ':' || u end,
    kind || ':' || b,
    kind] loop
    if c is not null then
      select m.account_code into r from public.pk_fin_maps m join public.pk_fin_accounts a on a.code = m.account_code and a.is_active where m.key = c;
      if r is not null then return r; end if;
    end if;
  end loop;
  return null;
end $$;

-- akun wajib ada; bila belum dipetakan → pengecualian yang bisa diselesaikan Keuangan sekali pilih akun
create or replace function public.pk_fin_need(kind text, u text, k text, label text) returns text
language plpgsql stable security definer set search_path = public as $$
declare r text := public.pk_fin_map(kind, u, k); s text := public.pk_fin_slug(k);
begin
  if r is null then
    raise exception 'PETA:%|%', kind || ':' || public.pk_fin_biz(u) || coalesce(':' || s, ''), label;
  end if;
  return r;
end $$;

create or replace function public.pk_fin_open_date(d date) returns date
language plpgsql stable security definer set search_path = public as $$
declare m date := date_trunc('month', d)::date;
begin
  if not exists (select 1 from public.pk_fin_periods where month = m and status = 'locked') then return d; end if;
  loop
    m := (m + interval '1 month')::date;
    exit when not exists (select 1 from public.pk_fin_periods where month = m and status = 'locked');
  end loop;
  return m;
end $$;

-- posting jurnal seimbang; idempoten per (sumber, ref)
create or replace function public.pk_fin_post(p_source text, p_ref text, p_date date, p_unit text, p_memo text, p_lines jsonb,
  p_event uuid default null, p_proof text default null, p_user uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid; l jsonb; dr numeric := 0; cr numeric := 0; n int := 0; d date; dd numeric; cc numeric; acc text;
begin
  if p_ref is not null then
    select id into v from public.pk_fin_entries where source = p_source and source_ref = p_ref and status = 'posted';
    if v is not null then return v; end if;
  end if;
  for l in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    dd := round(coalesce((l->>'d')::numeric, 0), 2); cc := round(coalesce((l->>'c')::numeric, 0), 2);
    if dd < 0 or cc < 0 then raise exception 'Nominal jurnal tidak boleh negatif'; end if;
    if dd = 0 and cc = 0 then continue; end if;
    acc := l->>'acc';
    if acc is null or not exists (select 1 from public.pk_fin_accounts where code = acc and is_active) then
      raise exception 'Akun % tidak ada atau nonaktif', coalesce(acc, '(kosong)');
    end if;
    if l->>'unit' is not null and not exists (select 1 from public.pk_units where code = l->>'unit') then
      raise exception 'Unit % tidak dikenal', l->>'unit';
    end if;
    dr := dr + dd; cr := cr + cc; n := n + 1;
  end loop;
  if n < 2 then raise exception 'Jurnal minimal dua baris'; end if;
  if dr <> cr then raise exception 'Jurnal tidak seimbang (debit % ≠ kredit %)', dr, cr; end if;
  d := public.pk_fin_open_date(coalesce(p_date, public.pk_today()));
  insert into public.pk_fin_entries(code, entry_date, unit_code, source, source_ref, event_id, memo, proof_url, created_by)
  values ('JP' || to_char(d, 'YYMM') || '-' || lpad(nextval('public.pk_fin_seq')::text, 5, '0'), d, p_unit, p_source, p_ref, p_event,
          left(p_memo, 500) || case when d <> coalesce(p_date, d) then ' (periode ' || to_char(p_date, 'MM/YYYY') || ' sudah ditutup)' else '' end,
          p_proof, coalesce(p_user, public.pk_me()))
  returning id into v;
  insert into public.pk_fin_lines(entry_id, account_code, unit_code, debit, credit, memo)
  select v, x->>'acc', coalesce(x->>'unit', p_unit), round(coalesce((x->>'d')::numeric, 0), 2), round(coalesce((x->>'c')::numeric, 0), 2), x->>'memo'
  from jsonb_array_elements(p_lines) x
  where round(coalesce((x->>'d')::numeric, 0), 2) <> 0 or round(coalesce((x->>'c')::numeric, 0), 2) <> 0;
  return v;
end $$;

-- ===== proses satu kejadian menjadi jurnal =====
create or replace function public.pk_fin_process(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare e public.pk_fin_events; p jsonb; u text; amt numeric; cat text; ch text; memo text; ln jsonb := '[]'::jsonb;
  cash text; v uuid; x jsonb; fee numeric; cost numeric; cair numeric; rl numeric := 0; acc text; minc numeric; src public.pk_fin_sources;
  msg text; nk text;
begin
  select * into e from public.pk_fin_events where id = p_id for update;
  if e.id is null or e.status in ('terposting','diabaikan') then return coalesce(e.status, 'tidak ada'); end if;
  p := e.payload; u := e.unit_code; amt := round(coalesce(e.amount, 0), 2);
  cat := p->>'category'; ch := coalesce(nullif(p->>'channel', ''), 'transfer');
  memo := coalesce(nullif(p->>'memo', ''), e.type || ' · ' || e.external_id) || coalesce(' · ' || nullif(p->>'customer', ''), '');
  fee := round(coalesce((p->>'fee')::numeric, 0), 2); cost := round(coalesce((p->>'cost')::numeric, 0), 2);
  begin
    if e.type in ('sale.paid','deposit.received','sale.refund','expense.paid','purchase.paid','fee.charged','sale.recognized','stock.sold')
       and amt <= 0 and not (e.type = 'stock.sold' and cost > 0) then
      raise exception 'Nominal harus lebih dari 0';
    end if;
    case e.type
    when 'sale.paid' then
      cash := public.pk_fin_need('cash', u, ch, 'rekening penerimaan kanal ' || ch);
      ln := jsonb_build_array(jsonb_build_object('acc', cash, 'd', amt),
                              jsonb_build_object('acc', public.pk_fin_need('rev', u, cat, 'pendapatan ' || coalesce(cat, 'umum')), 'c', amt, 'memo', cat));
    when 'deposit.received' then
      cash := public.pk_fin_need('cash', u, ch, 'rekening penerimaan kanal ' || ch);
      ln := jsonb_build_array(jsonb_build_object('acc', cash, 'd', amt),
                              jsonb_build_object('acc', public.pk_fin_need('dp', u, null, 'uang muka pelanggan (DP)'), 'c', amt));
    when 'sale.recognized' then
      ln := jsonb_build_array(jsonb_build_object('acc', public.pk_fin_need('dp', u, null, 'uang muka pelanggan (DP)'), 'd', amt),
                              jsonb_build_object('acc', public.pk_fin_need('rev', u, cat, 'pendapatan ' || coalesce(cat, 'umum')), 'c', amt, 'memo', cat));
    when 'sale.refund' then
      cash := public.pk_fin_need('cash', u, ch, 'rekening kanal ' || ch);
      ln := jsonb_build_array(jsonb_build_object('acc', public.pk_fin_need('rev', u, cat, 'pendapatan ' || coalesce(cat, 'umum')), 'd', amt, 'memo', 'refund'),
                              jsonb_build_object('acc', cash, 'c', amt));
    when 'expense.paid' then
      cash := public.pk_fin_need('cash', u, ch, 'rekening pembayar kanal ' || ch);
      ln := jsonb_build_array(jsonb_build_object('acc', public.pk_fin_need('exp', u, cat, 'biaya ' || coalesce(cat, 'tanpa kategori')), 'd', amt, 'memo', cat),
                              jsonb_build_object('acc', cash, 'c', amt));
    when 'purchase.paid' then
      cash := public.pk_fin_need('cash', u, ch, 'rekening pembayar kanal ' || ch);
      ln := jsonb_build_array(jsonb_build_object('acc', public.pk_fin_need('stock', u, cat, 'persediaan ' || coalesce(cat, 'barang')), 'd', amt, 'memo', cat),
                              jsonb_build_object('acc', cash, 'c', amt));
    when 'stock.sold' then
      cost := greatest(cost, amt);
    when 'fee.charged' then
      cash := public.pk_fin_need('cash', u, ch, 'rekening kanal ' || ch);
      ln := jsonb_build_array(jsonb_build_object('acc', public.pk_fin_need('fee', u, null, 'biaya gateway/bank'), 'd', amt),
                              jsonb_build_object('acc', cash, 'c', amt));
    when 'transfer' then
      ln := jsonb_build_array(
        jsonb_build_object('acc', public.pk_fin_need('cash', u, coalesce(p->>'to', 'transfer'), 'rekening tujuan ' || coalesce(p->>'to', '?')), 'd', amt),
        jsonb_build_object('acc', public.pk_fin_need('cash', u, coalesce(p->>'from', 'transfer'), 'rekening asal ' || coalesce(p->>'from', '?')), 'c', amt));
    when 'journal' then
      -- baris boleh menyebut akun langsung ("account") atau lewat peta ("map": jenis, "key": kategori/kanal)
      for x in select * from jsonb_array_elements(coalesce(p->'lines', '[]'::jsonb)) loop
        acc := coalesce(x->>'account', public.pk_fin_need(x->>'map', coalesce(x->>'unit', u), x->>'key', coalesce(x->>'label', x->>'map')));
        ln := ln || jsonb_build_object('acc', acc, 'unit', coalesce(x->>'unit', u), 'd', x->'debit', 'c', x->'credit', 'memo', x->>'memo');
      end loop;
    when 'rab.cair' then
      ln := jsonb_build_array(jsonb_build_object('acc', public.pk_fin_need('advance', u, null, 'uang muka kegiatan (RAB)'), 'd', amt, 'memo', p->>'code'),
                              jsonb_build_object('acc', public.pk_fin_need('rab_pay', u, null, 'rekening pembayar RAB ' || public.pk_fin_biz(u)), 'c', amt));
    when 'rab.close' then
      cair := round(coalesce((p->>'cair')::numeric, 0), 2);
      minc := public.pk_setting_num('fin_capitalize_min', 500000);
      for x in select * from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) loop
        if coalesce((x->>'real')::numeric, 0) <= 0 then continue; end if;
        acc := null;
        if coalesce((x->>'price')::numeric, 0) >= minc then acc := public.pk_fin_map('asset', u, coalesce(x->>'category', 'lain_lain')); end if;
        if acc is null then
          acc := public.pk_fin_need('exp', u, coalesce(nullif(x->>'category', ''), case when p->>'kind' = 'mt' then 'sparepart_perawatan' else 'lain_lain' end),
                                    'biaya kategori ' || coalesce(nullif(x->>'category', ''), 'tanpa kategori'));
        end if;
        ln := ln || jsonb_build_object('acc', acc, 'd', (x->>'real')::numeric, 'memo', x->>'name');
        rl := rl + (x->>'real')::numeric;
      end loop;
      if rl > 0 then ln := ln || jsonb_build_object('acc', public.pk_fin_need('advance', u, null, 'uang muka kegiatan (RAB)'), 'c', least(rl, cair), 'memo', p->>'code'); end if;
      if cair > rl then
        ln := ln || jsonb_build_array(jsonb_build_object('acc', public.pk_fin_need('rab_pay', u, null, 'rekening pembayar RAB'), 'd', cair - rl, 'memo', 'sisa dana RAB kembali'),
                                      jsonb_build_object('acc', public.pk_fin_need('advance', u, null, 'uang muka kegiatan (RAB)'), 'c', cair - rl));
      elsif rl > cair then
        ln := ln || jsonb_build_object('acc', public.pk_fin_need('reimburse', u, null, 'hutang reimburse karyawan'), 'c', rl - cair, 'memo', 'kekurangan dana RAB');
      end if;
    when 'payroll.accrue' then
      for x in select * from jsonb_array_elements(coalesce(p->'lines', '[]'::jsonb)) loop
        ln := ln || jsonb_build_object('acc', public.pk_fin_need('payroll', x->>'unit', null, 'beban gaji'), 'unit', x->>'unit', 'd', (x->>'amount')::numeric);
      end loop;
      ln := ln || jsonb_build_object('acc', public.pk_fin_need('payroll_payable', 'HQ', null, 'hutang gaji'), 'unit', 'HQ', 'c', amt);
    when 'bank.line' then
      if (p->>'signed')::numeric > 0 then
        ln := jsonb_build_array(jsonb_build_object('acc', p->>'cash', 'd', amt), jsonb_build_object('acc', p->>'counter', 'c', amt, 'memo', p->>'desc'));
      else
        ln := jsonb_build_array(jsonb_build_object('acc', p->>'counter', 'd', amt, 'memo', p->>'desc'), jsonb_build_object('acc', p->>'cash', 'c', amt));
      end if;
    else
      raise exception 'Jenis kejadian "%" tidak dikenal', e.type;
    end case;
    -- penjualan barang: HPP otomatis bila harga pokok dikirim
    if cost > 0 and e.type in ('sale.paid','sale.recognized','stock.sold') then
      ln := ln || jsonb_build_array(jsonb_build_object('acc', public.pk_fin_need('cogs', u, cat, 'HPP ' || coalesce(cat, 'barang')), 'd', cost, 'memo', cat),
                                    jsonb_build_object('acc', public.pk_fin_need('stock', u, cat, 'persediaan ' || coalesce(cat, 'barang')), 'c', cost));
    end if;
    -- biaya gateway dipotong dari uang masuk
    if fee > 0 and e.type in ('sale.paid','deposit.received') then
      ln := ln || jsonb_build_array(jsonb_build_object('acc', public.pk_fin_need('fee', u, null, 'biaya gateway/bank'), 'd', fee),
                                    jsonb_build_object('acc', cash, 'c', fee));
    end if;
    v := public.pk_fin_post(e.source, e.external_id, e.event_date, u, memo, ln, e.id, nullif(p->>'proof_url', ''), null);
    update public.pk_fin_events set status = 'terposting', entry_id = v, error = null, need_key = null, processed_at = now(), attempts = attempts + 1 where id = p_id;
    select * into src from public.pk_fin_sources where code = e.source;
    if src.feeds_omzet and e.type in ('sale.paid','deposit.received') and u is not null then
      insert into public.pk_omzet(unit_code, day, amount, note, source) values (u, e.event_date, amt::bigint, 'Otomatis ' || e.source || ' · ' || e.external_id, 'app');
    end if;
    return 'terposting';
  exception when others then
    msg := sqlerrm; nk := null;
    if msg like 'PETA:%' then
      nk := split_part(substr(msg, 6), '|', 1);
      msg := 'Akun untuk ' || split_part(substr(msg, 6), '|', 2) || ' belum dipetakan (' || nk || ')';
    end if;
    update public.pk_fin_events set status = 'gagal', error = msg, need_key = nk, processed_at = now(), attempts = attempts + 1 where id = p_id;
    return 'gagal';
  end;
end $$;

-- ===== terima kejadian (dipakai API, trigger internal, website di database yang sama) =====
create or replace function public.pk_fin_emit(p_source text, p_ext text, p_type text, p_date date, p_unit text, p_amount numeric, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare e public.pk_fin_events; st text;
begin
  if coalesce(btrim(p_ext), '') = '' then raise exception 'id kejadian wajib diisi'; end if;
  select * into e from public.pk_fin_events where source = p_source and external_id = p_ext for update;
  if e.id is null then
    insert into public.pk_fin_events(source, external_id, type, event_date, unit_code, amount, payload)
    values (p_source, p_ext, p_type, coalesce(p_date, public.pk_today()), p_unit, p_amount, coalesce(p_payload, '{}'::jsonb))
    returning * into e;
  elsif e.status in ('baru','gagal') then
    -- kiriman ulang yang sudah diperbaiki menggantikan versi gagal
    update public.pk_fin_events set type = p_type, event_date = coalesce(p_date, event_date), unit_code = p_unit, amount = p_amount,
      payload = coalesce(p_payload, '{}'::jsonb), status = 'baru' where id = e.id returning * into e;
  else
    return jsonb_build_object('id', e.id, 'status', e.status, 'duplicate', true,
      'note', case when e.amount is distinct from p_amount then 'Sudah terposting dengan nominal berbeda; koreksi lewat kejadian baru (refund/jurnal)' end);
  end if;
  update public.pk_fin_sources set last_event_at = now() where code = p_source;
  st := public.pk_fin_process(e.id);
  select * into e from public.pk_fin_events where id = e.id;
  return jsonb_build_object('id', e.id, 'status', st, 'error', e.error, 'entry_id', e.entry_id);
end $$;

-- ===== API eksternal: dipanggil edge function pk-fin-ingest dengan kunci sumber =====
create or replace function public.pk_fin_ingest(p_key text, p_events jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s public.pk_fin_sources; ev jsonb; out jsonb := '[]'::jsonb; u text; r jsonb; t text;
  allowed text[] := array['sale.paid','deposit.received','sale.recognized','sale.refund','expense.paid','purchase.paid','stock.sold','fee.charged','transfer','journal'];
begin
  select src.* into s from public.pk_fin_source_keys k join public.pk_fin_sources src on src.code = k.source
   where k.key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex');
  if s.code is null then raise exception 'Kunci API tidak dikenal'; end if;
  if not s.is_active then raise exception 'Sumber % sedang dinonaktifkan', s.code; end if;
  if jsonb_typeof(p_events) = 'object' then p_events := jsonb_build_array(p_events); end if;
  if jsonb_array_length(coalesce(p_events, '[]'::jsonb)) > 500 then raise exception 'Maksimal 500 kejadian per kiriman'; end if;
  for ev in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) loop
    begin
      t := ev->>'type';
      if not (t = any(allowed)) then raise exception 'type "%" tidak dikenal. Pilihan: %', t, array_to_string(allowed, ', '); end if;
      u := coalesce(ev->>'unit', s.unit_code);
      if s.unit_code is not null and public.pk_fin_biz(u) <> public.pk_fin_biz(s.unit_code) then
        raise exception 'unit % bukan bagian dari %', u, s.unit_code;
      end if;
      r := public.pk_fin_emit(s.code, ev->>'id', t, (ev->>'date')::date, u, (ev->>'amount')::numeric, ev - 'id' - 'type' - 'date' - 'unit' - 'amount');
      out := out || (jsonb_build_object('ref', ev->>'id') || r);
    exception when others then
      out := out || jsonb_build_object('ref', ev->>'id', 'status', 'ditolak', 'error', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('source', s.code, 'results', out);
end $$;

-- ===== RAB/LPJ → jurnal otomatis =====
create or replace function public.pk_fin_on_rab() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  begin
    if new.status = 'cair' then
      perform public.pk_fin_emit('pokama', new.code || ':cair', 'rab.cair', (coalesce(new.cair_at, now()) at time zone 'Asia/Jakarta')::date,
        new.unit_code, new.total, jsonb_build_object('code', new.code, 'memo', 'Pencairan ' || new.code || ' · ' || new.title, 'rab_id', new.id));
    elsif new.status = 'selesai' then
      perform public.pk_fin_emit('pokama', new.code || ':tutup', 'rab.close', (coalesce(new.done_at, now()) at time zone 'Asia/Jakarta')::date,
        new.unit_code, coalesce(new.realisasi, 0), jsonb_build_object('code', new.code, 'kind', new.kind, 'cair', new.total, 'rab_id', new.id,
          'memo', 'LPJ ' || new.code || ' · ' || new.title,
          'proof_url', (select nota_link from public.pk_rab_items where rab_id = new.id and active and nota_link is not null order by sort limit 1),
          'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.name, 'category', i.category, 'price', i.price, 'qty', i.qty, 'real', i.real_amount) order by i.sort), '[]'::jsonb)
                    from public.pk_rab_items i where i.rab_id = new.id and i.active)));
    end if;
  exception when others then
    raise warning 'pk_fin_on_rab: %', sqlerrm;   -- alur RAB tidak boleh terhenti karena keuangan
  end;
  return new;
end $$;
drop trigger if exists pk_fin_rab on public.pk_rab;
create trigger pk_fin_rab after update of status on public.pk_rab for each row execute function public.pk_fin_on_rab();

-- ===== gaji bulanan → beban gaji per unit (sesuai split), tanpa rincian per orang =====
create or replace function public.pk_fin_payroll_accrue(p_month date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m date := date_trunc('month', coalesce(p_month, public.pk_today()))::date; lines jsonb; tot numeric;
begin
  with s as (
    select p.unit_code home, sl.base_salary::numeric base, sl.split from public.pk_salary sl join public.pk_people p on p.id = sl.person_id
    where p.is_active and coalesce(sl.base_salary, 0) > 0),
  parts as (
    select coalesce(k, home) unit, base * coalesce(case when v <= 1 then v * 100 else v end, 100) / 100 amt from s
    left join lateral (
      select key k, (value #>> '{}')::numeric v from jsonb_each(case when jsonb_typeof(s.split) = 'object' then s.split else '{}'::jsonb end)
      union all
      select x->>'unit', (x->>'pct')::numeric from jsonb_array_elements(case when jsonb_typeof(s.split) = 'array' then s.split else '[]'::jsonb end) x
    ) sp on true)
  select jsonb_agg(jsonb_build_object('unit', unit, 'amount', round(a))), sum(round(a)) into lines, tot
  from (select unit, sum(amt) a from parts where unit in (select code from public.pk_units) group by unit) z;
  if coalesce(tot, 0) <= 0 then return jsonb_build_object('status', 'kosong', 'note', 'Belum ada data gaji pokok di Tim & Peran'); end if;
  return public.pk_fin_emit('pokama', 'GAJI-' || to_char(m, 'YYYY-MM'), 'payroll.accrue', (m + interval '1 month - 1 day')::date, 'HQ', tot,
    jsonb_build_object('memo', 'Beban gaji ' || to_char(m, 'MM/YYYY') || ' per unit', 'lines', lines));
end $$;

-- ===== satu buku grup: semua baris jurnal (Rentalaja masuk lewat kejadian, bukan dari buku Rentalaja App) =====
create or replace function public.pk_fin_ra_unit(b uuid) returns text
language sql stable security definer set search_path = public as $$
  select case (select code from public.branches where id = b)
    when 'GRT' then 'GK' when 'WNR' then 'WN' when 'BDG-HUB' then 'BD' when 'BDG-JKL' then 'BD'
    when 'RM' then 'EX' when 'ERT' then 'EX' when 'JEEP' then 'JP' else 'RA' end
$$;

create or replace function public.pk_fin_lines_all(p_from date, p_to date)
returns table(d date, unit text, biz text, acc text, debit numeric, credit numeric, src text, entry uuid, ref text, line_ref text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.pk_fin_can_read() and public.pk_me() is not null then raise exception 'Hanya CEO, Kepala Staf, dan Keuangan'; end if;
  return query
    select e.entry_date, coalesce(l.unit_code, e.unit_code, 'HQ'), public.pk_fin_biz(coalesce(l.unit_code, e.unit_code, 'HQ')), l.account_code,
           l.debit, l.credit, e.source, e.id, e.code, 'pk:' || l.id
    from public.pk_fin_lines l join public.pk_fin_entries e on e.id = l.entry_id
    where e.status = 'posted' and (p_from is null or e.entry_date >= p_from) and (p_to is null or e.entry_date <= p_to);
end $$;

-- ===== mutasi bank: impor, cocokkan, kenali dengan aturan =====
create or replace function public.pk_fin_bank_match(p_account text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b record; m text; r record; o record; n_match int := 0; n_rule int := 0; res jsonb;
begin
  for b in select * from public.pk_fin_bank_lines where status = 'baru' and (p_account is null or account_code = p_account) order by tx_date, created_at loop
    -- 1) cocok dengan transaksi yang sudah tercatat (±3 hari, nominal sama, belum dipakai)
    select x.line_ref into m from public.pk_fin_lines_all(b.tx_date - 3, b.tx_date + 3) x
     where x.acc = b.account_code and ((b.amount > 0 and x.debit = b.amount) or (b.amount < 0 and x.credit = -b.amount))
       and not exists (select 1 from public.pk_fin_bank_lines z where z.match_ref = x.line_ref)
     order by abs(x.d - b.tx_date), x.d limit 1;
    if m is not null then
      update public.pk_fin_bank_lines set status = 'cocok', match_ref = m where id = b.id; n_match := n_match + 1; continue;
    end if;
    -- 2) aturan bank / kewajiban rutin yang polanya cocok
    select ru.account_code, ru.unit_code, ru.pattern into r from public.pk_fin_bank_rules ru
     where ru.is_active and (ru.cash_account is null or ru.cash_account = b.account_code) and b.description ilike '%' || ru.pattern || '%'
     order by length(ru.pattern) desc limit 1;
    if r.account_code is null then
      select ob.account_code, ob.unit_code, ob.bank_pattern pattern into r from public.pk_fin_obligations ob
       where ob.is_active and coalesce(ob.bank_pattern, '') <> '' and b.amount < 0 and b.description ilike '%' || ob.bank_pattern || '%'
       order by abs(ob.amount + b.amount), length(ob.bank_pattern) desc limit 1;
    end if;
    if r.account_code is not null then
      res := public.pk_fin_emit('bank', 'MUTASI-' || b.id, 'bank.line', b.tx_date,
        coalesce(r.unit_code, (select unit_code from public.pk_fin_accounts where code = b.account_code), 'HQ'), abs(b.amount),
        jsonb_build_object('cash', b.account_code, 'counter', r.account_code, 'signed', b.amount, 'desc', b.description,
                           'memo', 'Mutasi ' || b.description || ' (aturan: ' || r.pattern || ')'));
      update public.pk_fin_bank_lines set status = case when res->>'status' = 'terposting' then 'diposting' else 'baru' end,
        event_id = (res->>'id')::uuid, match_ref = case when res->>'status' = 'terposting' then 'ev:' || (res->>'id') end where id = b.id;
      if res->>'status' = 'terposting' then n_rule := n_rule + 1; end if;
    end if;
    r := null;
  end loop;
  return jsonb_build_object('cocok', n_match, 'aturan', n_rule,
    'sisa', (select count(*) from public.pk_fin_bank_lines where status = 'baru' and (p_account is null or account_code = p_account)));
end $$;

create or replace function public.pk_fin_bank_import(p_account text, p_rows jsonb, p_batch text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare x jsonb; n int := 0; dup int := 0; bt text := coalesce(p_batch, to_char(now(), 'YYYYMMDDHH24MISS')); last record; amt numeric; dt date;
begin
  if not public.pk_is_fin() then raise exception 'Hanya Keuangan yang mengimpor mutasi'; end if;
  if not exists (select 1 from public.pk_fin_accounts where code = p_account and is_cash) then raise exception 'Pilih rekening kas/bank'; end if;
  for x in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    amt := round((x->>'amount')::numeric, 2); dt := (x->>'date')::date;
    if amt is null or dt is null or amt = 0 then continue; end if;
    insert into public.pk_fin_bank_lines(account_code, tx_date, description, amount, balance, batch)
    values (p_account, dt, coalesce(nullif(btrim(x->>'desc'), ''), '(tanpa keterangan)'), amt, (x->>'balance')::numeric, bt)
    on conflict do nothing;
    if found then n := n + 1; else dup := dup + 1; end if;
  end loop;
  select tx_date, balance into last from public.pk_fin_bank_lines where account_code = p_account and balance is not null order by tx_date desc, created_at desc limit 1;
  if last.balance is not null then
    update public.pk_fin_accounts set bank_balance = last.balance, bank_balance_at = last.tx_date where code = p_account;
  end if;
  return jsonb_build_object('masuk', n, 'dobel', dup) || public.pk_fin_bank_match(p_account);
end $$;

-- ===== tugas harian (pg_cron 00.10 WIB) =====
create or replace function public.pk_fin_daily() returns jsonb
language plpgsql security definer set search_path = public as $$
declare t date := public.pk_today(); r jsonb := '{}'::jsonb; e record; n int; f uuid;
begin
  if extract(day from t) >= public.pk_setting_num('fin_payroll_day', 25) then
    r := r || jsonb_build_object('gaji', public.pk_fin_payroll_accrue(t));
  end if;
  -- coba ulang kejadian gagal yang bukan karena peta (mis. gangguan sementara)
  for e in select id from public.pk_fin_events where status in ('baru','gagal') and need_key is null and attempts < 6 loop
    perform public.pk_fin_process(e.id);
  end loop;
  -- Rentalaja: pengakuan pendapatan yang jatuh tempo karena waktu (trip/penginapan yang sudah mulai) dan DP hangus yang tertunda
  -- hanya bila sambungan Rentalaja (018c) sudah dipasang dan sumbernya aktif
  if to_regprocedure('public.pk_fin_ra_booking(uuid)') is not null and exists (select 1 from public.pk_fin_sources where code = 'rentalaja' and is_active) then
  for e in select b.id from public.bookings b
           where (b.status::text in ('active','returned','completed') or (b.line::text = 'experience' and b.status::text = 'confirmed' and b.start_at <= now()))
             and not exists (select 1 from public.pk_fin_events x where x.source = 'rentalaja' and x.external_id like 'RA-REV-' || b.code || '-%' and x.status = 'terposting')
           limit 500 loop
    perform public.pk_fin_ra_booking(e.id);
  end loop;
  for e in select b.id from public.bookings b where b.status::text in ('cancelled','no_show','expired') and b.updated_at > now() - interval '60 days' loop
    perform public.pk_fin_ra_cancel(e.id);
  end loop;
  end if;
  r := r || jsonb_build_object('mutasi', public.pk_fin_bank_match(null));
  select count(*) into n from public.pk_fin_events where status = 'gagal';
  n := n + (select count(*) from public.pk_fin_bank_lines where status = 'baru');
  if n > 0 then
    for f in select id from public.pk_people where role = 'keuangan' and is_active loop
      perform public.pk_notify(f, 'keuangan', n || ' transaksi keuangan perlu dicek', 'Akun belum dipetakan atau mutasi bank belum dikenali', '/keuangan/#antrean', false);
    end loop;
  end if;
  return r || jsonb_build_object('perlu_cek', n);
end $$;

-- ===== hak eksekusi: mesin internal tidak bisa dipanggil langsung dari aplikasi =====
revoke execute on function public.pk_fin_post(text, text, date, text, text, jsonb, uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.pk_fin_process(uuid) from public, anon, authenticated;
revoke execute on function public.pk_fin_emit(text, text, text, date, text, numeric, jsonb) from public, anon, authenticated;
revoke execute on function public.pk_fin_ingest(text, jsonb) from public, anon, authenticated;
revoke execute on function public.pk_fin_on_rab() from public, anon, authenticated;
revoke execute on function public.pk_fin_payroll_accrue(date) from public, anon, authenticated;
revoke execute on function public.pk_fin_daily() from public, anon, authenticated;
revoke execute on function public.pk_fin_bank_match(text) from public, anon;
revoke execute on function public.pk_fin_need(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.pk_fin_lines_all(date, date) from public, anon;
grant execute on function public.pk_fin_ingest(text, jsonb) to service_role;
grant execute on function public.pk_fin_emit(text, text, text, date, text, numeric, jsonb) to service_role;

-- 018d: Laporan dan aksi Keuangan (dipanggil layar Keuangan di pokama.org)

create or replace function public.pk_fin_read_check() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.pk_fin_can_read() then raise exception 'Modul Keuangan hanya untuk CEO, Kepala Staf, dan Keuangan'; end if;
end $$;
create or replace function public.pk_fin_write_check() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.pk_is_fin() then raise exception 'Hanya Keuangan atau CEO yang bisa mengubah data keuangan'; end if;
end $$;

create or replace function public.pk_fin_next_due(p_day int, p_from date) returns date
language sql immutable as $$
  select case when d1 >= p_from then d1 else d2 end from (
    select make_date(extract(year from p_from)::int, extract(month from p_from)::int,
             least(p_day, extract(day from (date_trunc('month', p_from) + interval '1 month - 1 day'))::int)) d1,
           make_date(extract(year from n)::int, extract(month from n)::int,
             least(p_day, extract(day from (n + interval '1 month - 1 day'))::int)) d2
    from (select (date_trunc('month', p_from) + interval '1 month')::date n) z) x
$$;

-- ===== dasbor =====
create or replace function public.pk_fin_dashboard(p_from date, p_to date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t date := public.pk_today(); len int; pf date; pt date; m6 date; out jsonb; hq_cost numeric; rev3 numeric; cash_total numeric; burn numeric;
  lpj int := public.pk_setting_num('lpj_days', 2)::int;
begin
  perform public.pk_fin_read_check();
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Periode tidak valid'; end if;
  len := p_to - p_from + 1;
  if extract(day from p_from) = 1 and p_to = (date_trunc('month', p_from) + interval '1 month - 1 day')::date then
    pf := (p_from - interval '1 month')::date; pt := p_from - 1;
  else pf := p_from - len; pt := p_from - 1; end if;
  m6 := (date_trunc('month', p_to) - interval '5 months')::date;

  drop table if exists _fl; drop table if exists _pl;
  create temp table _fl on commit drop as select * from public.pk_fin_lines_all(null, p_to);
  create temp table _pl on commit drop as
    select per, biz, unit,
      sum(case when left(acc, 1) = '4' then credit - debit else 0 end) rev,
      sum(case when left(acc, 1) = '5' then debit - credit else 0 end) hpp,
      sum(case when left(acc, 1) = '6' then debit - credit else 0 end) opex,
      sum(case when left(acc, 1) = '7' then credit - debit else 0 end) oi,
      sum(case when left(acc, 1) = '8' then debit - credit else 0 end) oe
    from (select case when d between p_from and p_to then 'cur' when d between pf and pt then 'prev' end per, * from _fl) x
    where per is not null group by per, biz, unit;

  select coalesce(sum(hpp + opex + oe - oi - rev), 0) into hq_cost from _pl where per = 'cur' and biz = 'HQ';
  select coalesce(sum(rev), 0) into rev3 from _pl where per = 'cur' and biz in ('RA','WG','NA');
  select coalesce(sum(debit - credit), 0) into cash_total from _fl f join public.pk_fin_accounts a on a.code = f.acc and a.is_cash;
  -- biaya tunai rata-rata 3 bulan (penyusutan tidak mengeluarkan uang, jadi tidak dihitung)
  select coalesce(sum(case when left(acc, 1) in ('5','6','8') and acc <> '5-50001' and coalesce(a.name, '') not ilike '%penyusutan%' then debit - credit else 0 end), 0) / 3 into burn
    from _fl left join public.pk_fin_accounts a on a.code = _fl.acc where d >= (date_trunc('month', t) - interval '3 months')::date and d < date_trunc('month', t)::date;

  out := jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to, 'prev_from', pf, 'prev_to', pt, 'today', t),
    'units', (select coalesce(jsonb_agg(jsonb_build_object('code', b.code, 'name', b.name,
        'cur', (select jsonb_build_object('rev', coalesce(sum(rev), 0), 'hpp', coalesce(sum(hpp), 0), 'opex', coalesce(sum(opex), 0),
                 'oi', coalesce(sum(oi), 0), 'oe', coalesce(sum(oe), 0), 'net', coalesce(sum(rev + oi - hpp - opex - oe), 0)) from _pl where per = 'cur' and biz = b.code),
        'prev', (select jsonb_build_object('rev', coalesce(sum(rev), 0), 'net', coalesce(sum(rev + oi - hpp - opex - oe), 0)) from _pl where per = 'prev' and biz = b.code),
        'share', case when b.code = 'HQ' then null when rev3 > 0 then (select coalesce(sum(rev), 0) from _pl where per = 'cur' and biz = b.code) / rev3 else 1.0 / 3 end,
        'lines', (select coalesce(jsonb_agg(jsonb_build_object('code', u.code, 'name', u.name,
                     'rev', coalesce((select sum(rev) from _pl where per = 'cur' and unit = u.code), 0),
                     'net', coalesce((select sum(rev + oi - hpp - opex - oe) from _pl where per = 'cur' and unit = u.code), 0)) order by u.sort), '[]'::jsonb)
                  from public.pk_units u where u.parent = b.code and u.is_active)) order by b.sort), '[]'::jsonb)
      from public.pk_units b where b.kind in ('bisnis','holding') and b.is_active),
    'hq_cost', greatest(hq_cost, 0),
    'trend', (select coalesce(jsonb_agg(jsonb_build_object('m', to_char(m, 'YYYY-MM'),
        'by', (select coalesce(jsonb_object_agg(biz, jsonb_build_object('rev', rv, 'net', nt)), '{}'::jsonb) from (
                 select biz, sum(case when left(acc, 1) = '4' then credit - debit else 0 end) rv,
                        sum(case when left(acc, 1) in ('4','7') then credit - debit when left(acc, 1) in ('5','6','8') then credit - debit else 0 end) nt
                 from _fl where date_trunc('month', d) = m group by biz) z)) order by m), '[]'::jsonb)
      from generate_series(m6, date_trunc('month', p_to)::date, interval '1 month') m),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('d', dd, 'in', coalesce(i, 0), 'out', coalesce(o, 0)) order by dd), '[]'::jsonb) from (
        select g::date dd, (select sum(debit) from _fl f join public.pk_fin_accounts a on a.code = f.acc and a.is_cash where f.d = g::date) i,
               (select sum(credit) from _fl f join public.pk_fin_accounts a on a.code = f.acc and a.is_cash where f.d = g::date) o
        from generate_series(greatest(p_from, p_to - 61), p_to, interval '1 day') g) z),
    'cash', (select coalesce(jsonb_agg(jsonb_build_object('code', a.code, 'name', a.name, 'unit', a.unit_code, 'pos', a.pos, 'bank', a.bank,
        'book', coalesce(s.bal, 0), 'in', coalesce(s.i, 0), 'out', coalesce(s.o, 0), 'bank_balance', a.bank_balance, 'bank_at', a.bank_balance_at,
        'unmatched', (select count(*) from public.pk_fin_bank_lines bl where bl.account_code = a.code and bl.status = 'baru'),
        'stmt_last', (select max(tx_date) from public.pk_fin_bank_lines bl where bl.account_code = a.code)) order by a.sort, a.code), '[]'::jsonb)
      from public.pk_fin_accounts a left join lateral (
        select sum(debit - credit) bal, sum(debit) filter (where d between p_from and p_to) i, sum(credit) filter (where d between p_from and p_to) o
        from _fl where acc = a.code) s on true
      where a.is_cash and a.is_active),
    'balances', (select coalesce(jsonb_object_agg(a.code, jsonb_build_object('name', a.name,
        'bal', coalesce((select sum(case when left(a.code, 1) = '1' then debit - credit else credit - debit end) from _fl where acc = a.code), 0))), '{}'::jsonb)
      from public.pk_fin_accounts a where a.code in ('1-10100','1-10101','1-10102','1-10200','1-10210','2-20100','2-20200','2-20300','2-20400','2-20500','2-20600','2-21000','2-21100','2-21200')),
    'obligations', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'kind', o.kind, 'unit', o.unit_code, 'amount', o.amount, 'due', nd,
        'days', nd - t, 'pattern', o.bank_pattern) order by nd), '[]'::jsonb)
      from public.pk_fin_obligations o cross join lateral (select public.pk_fin_next_due(o.due_day, t) nd) x
      where o.is_active and nd <= t + 30 and (o.start_month is null or nd >= o.start_month)
        and (o.end_month is null or nd <= (date_trunc('month', o.end_month) + interval '1 month - 1 day')::date)),
    'obligations_month', (select coalesce(sum(amount), 0) from public.pk_fin_obligations where is_active),
    'rab', (select coalesce(jsonb_agg(jsonb_build_object('biz', biz,
        'menunggu', count(*) filter (where status = 'diajukan'), 'menunggu_rp', coalesce(sum(total) filter (where status = 'diajukan'), 0),
        'siap', count(*) filter (where status = 'siap_cair'), 'siap_rp', coalesce(sum(total) filter (where status = 'siap_cair'), 0),
        'nota', count(*) filter (where status = 'cair'), 'nota_rp', coalesce(sum(total) filter (where status = 'cair'), 0),
        'telat', count(*) filter (where status = 'cair' and cair_at < now() - make_interval(days => lpj)),
        'cek', count(*) filter (where status = 'lpj'),
        'cair_periode', coalesce(sum(total) filter (where cair_at is not null and (cair_at at time zone 'Asia/Jakarta')::date between p_from and p_to), 0),
        'real_periode', coalesce(sum(realisasi) filter (where done_at is not null and (done_at at time zone 'Asia/Jakarta')::date between p_from and p_to), 0),
        'darurat', count(*) filter (where is_emergency and created_at >= p_from))), '[]'::jsonb)
      from (select r.*, public.pk_fin_biz(r.unit_code) biz from public.pk_rab r) z group by biz),
    'expense_top', (select coalesce(jsonb_agg(jsonb_build_object('code', acc, 'name', (select name from public.pk_fin_accounts where code = acc), 'amt', amt, 'by', by_) order by amt desc), '[]'::jsonb)
      from (select acc, sum(debit - credit) amt, jsonb_object_agg(biz, s) by_ from (
              select acc, biz, sum(debit - credit) s, sum(debit) debit, sum(credit) credit from _fl where d between p_from and p_to and left(acc, 1) in ('5','6','8') group by acc, biz) y
            group by acc order by 2 desc limit 10) z),
    'revenue_mix', (select coalesce(jsonb_agg(jsonb_build_object('code', acc, 'name', (select name from public.pk_fin_accounts where code = acc), 'amt', amt) order by amt desc), '[]'::jsonb)
      from (select acc, sum(credit - debit) amt from _fl where d between p_from and p_to and left(acc, 1) in ('4','7') group by acc having sum(credit - debit) <> 0) z),
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'unit', s.unit_code, 'kind', s.kind, 'active', s.is_active,
        'feeds_omzet', s.feeds_omzet, 'last', s.last_event_at, 'has_key', exists (select 1 from public.pk_fin_source_keys k where k.source = s.code),
        'n30', (select count(*) from public.pk_fin_events e where e.source = s.code and e.received_at > now() - interval '30 days'),
        'ok30', (select count(*) from public.pk_fin_events e where e.source = s.code and e.status = 'terposting' and e.received_at > now() - interval '30 days'),
        'gagal', (select count(*) from public.pk_fin_events e where e.source = s.code and e.status = 'gagal')) order by s.created_at), '[]'::jsonb)
      from public.pk_fin_sources s),
    'exceptions', jsonb_build_object(
        'gagal', (select count(*) from public.pk_fin_events where status = 'gagal'),
        'peta', (select count(distinct need_key) from public.pk_fin_events where status = 'gagal' and need_key is not null),
        'mutasi', (select count(*) from public.pk_fin_bank_lines where status = 'baru')),
    'periods', (select coalesce(jsonb_agg(jsonb_build_object('m', to_char(m, 'YYYY-MM'),
        'status', coalesce((select status from public.pk_fin_periods p where p.month = m::date), 'open')) order by m), '[]'::jsonb)
      from generate_series(m6, date_trunc('month', t)::date, interval '1 month') m),
    'health', jsonb_build_object('cash', cash_total, 'burn', burn, 'runway', case when burn > 0 then round(cash_total / burn, 1) end,
        'auto', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where src <> 'manual') / count(*)) end from _fl where d between p_from and p_to),
        'entries', (select count(distinct entry) from _fl where d between p_from and p_to),
        'close_day', public.pk_setting_num('fin_close_day', 5))
  );
  return out;
end $$;

-- ===== laba rugi rinci (akun × unit) =====
create or replace function public.pk_fin_pl(p_from date, p_to date) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.pk_fin_read_check();
  return (select coalesce(jsonb_agg(jsonb_build_object('acc', acc, 'name', a.name, 'grp', a.grp, 'unit', unit, 'biz', biz, 'amt', amt) order by acc, unit), '[]'::jsonb)
    from (select acc, unit, biz, sum(case when left(acc, 1) in ('4','7') then credit - debit else debit - credit end) amt
          from public.pk_fin_lines_all(p_from, p_to) where left(acc, 1) between '4' and '8' group by acc, unit, biz) z
    left join public.pk_fin_accounts a on a.code = z.acc where amt <> 0);
end $$;

-- ===== neraca ringkas per tanggal =====
create or replace function public.pk_fin_balance_sheet(p_to date) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.pk_fin_read_check();
  return (select coalesce(jsonb_agg(jsonb_build_object('acc', acc, 'name', a.name, 'grp', a.grp, 'is_cash', a.is_cash, 'bal', bal) order by acc), '[]'::jsonb)
    from (select acc, sum(case when left(acc, 1) = '1' then debit - credit else credit - debit end) bal
          from public.pk_fin_lines_all(null, p_to) where left(acc, 1) between '1' and '3' group by acc) z
    left join public.pk_fin_accounts a on a.code = z.acc where bal <> 0)
    || jsonb_build_array(jsonb_build_object('acc', '3-39999', 'name', 'Laba (rugi) berjalan', 'grp', 'ekuitas', 'bal',
         (select coalesce(sum(credit - debit), 0)
          from public.pk_fin_lines_all(null, p_to) where left(acc, 1) between '4' and '8')));
end $$;

-- ===== buku jurnal =====
create or replace function public.pk_fin_journal(p_from date, p_to date, p_biz text default null, p_source text default null, p_q text default null, p_acc text default null, p_limit int default 200)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.pk_fin_read_check();
  return (select coalesce(jsonb_agg(j order by (j->>'date') desc, j->>'code' desc), '[]'::jsonb) from (
    select jsonb_build_object('id', e.id, 'code', e.code, 'date', e.entry_date, 'source', e.source, 'ref', e.source_ref, 'unit', e.unit_code, 'memo', e.memo,
      'proof', e.proof_url, 'status', e.status, 'by', e.created_by, 'at', e.created_at,
      'total', (select sum(debit) from public.pk_fin_lines where entry_id = e.id),
      'lines', (select jsonb_agg(jsonb_build_object('acc', l.account_code, 'name', a.name, 'unit', l.unit_code, 'd', l.debit, 'c', l.credit, 'memo', l.memo) order by l.id)
                from public.pk_fin_lines l join public.pk_fin_accounts a on a.code = l.account_code where l.entry_id = e.id)) j
    from public.pk_fin_entries e
    where e.entry_date between p_from and p_to
      and (p_source is null or e.source = p_source)
      and (p_biz is null or exists (select 1 from public.pk_fin_lines l where l.entry_id = e.id and public.pk_fin_biz(coalesce(l.unit_code, e.unit_code)) = p_biz))
      and (p_acc is null or exists (select 1 from public.pk_fin_lines l where l.entry_id = e.id and l.account_code = p_acc))
      and (p_q is null or e.memo ilike '%' || p_q || '%' or e.code ilike '%' || p_q || '%' or e.source_ref ilike '%' || p_q || '%')
    order by e.entry_date desc, e.code desc limit least(coalesce(p_limit, 200), 1000)) z);
end $$;

-- ===== antrean pengecualian =====
create or replace function public.pk_fin_exceptions() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.pk_fin_read_check();
  return jsonb_build_object(
    'keys', (select coalesce(jsonb_agg(jsonb_build_object('key', need_key, 'n', n, 'amt', amt, 'error', err, 'sample', sample) order by n desc), '[]'::jsonb) from (
       select need_key, count(*) n, sum(amount) amt, min(error) err, min(source || ' · ' || external_id) sample from public.pk_fin_events
       where status = 'gagal' and need_key is not null group by need_key) z),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'source', source, 'ext', external_id, 'type', type, 'date', event_date, 'unit', unit_code,
        'amount', amount, 'error', error, 'key', need_key, 'memo', payload->>'memo', 'attempts', attempts, 'at', received_at) order by received_at desc), '[]'::jsonb)
      from (select * from public.pk_fin_events where status = 'gagal' order by received_at desc limit 300) z),
    'bank', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'acc', b.account_code, 'acc_name', a.name, 'date', b.tx_date, 'desc', b.description,
        'amount', b.amount, 'unit', a.unit_code) order by b.tx_date desc), '[]'::jsonb)
      from (select * from public.pk_fin_bank_lines where status = 'baru' order by tx_date desc limit 500) b join public.pk_fin_accounts a on a.code = b.account_code));
end $$;

create or replace function public.pk_fin_bank_list(p_account text, p_limit int default 300) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.pk_fin_read_check();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'date', tx_date, 'desc', description, 'amount', amount, 'balance', balance, 'status', status,
      'match', match_ref, 'note', note) order by tx_date desc, created_at desc), '[]'::jsonb)
    from (select * from public.pk_fin_bank_lines where account_code = p_account order by tx_date desc, created_at desc limit least(coalesce(p_limit, 300), 2000)) z);
end $$;

-- ===== aksi Keuangan =====
create or replace function public.pk_fin_map_set(p_key text, p_account text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e record; ok int := 0; still int := 0; k text := lower(btrim(p_key));
begin
  perform public.pk_fin_write_check();
  if k !~ '^[a-z_]+(:[a-z0-9_]+){0,2}$' then raise exception 'Kunci peta tidak valid'; end if;
  if not exists (select 1 from public.pk_fin_accounts where code = p_account and is_active) then raise exception 'Akun tidak ditemukan'; end if;
  insert into public.pk_fin_maps(key, account_code, note, updated_by, updated_at) values (k, p_account, p_note, public.pk_me(), now())
  on conflict (key) do update set account_code = excluded.account_code, note = coalesce(excluded.note, pk_fin_maps.note), updated_by = excluded.updated_by, updated_at = now();
  for e in select id from public.pk_fin_events where status = 'gagal' and need_key is not null order by received_at loop
    if public.pk_fin_process(e.id) = 'terposting' then ok := ok + 1; else still := still + 1; end if;
  end loop;
  return jsonb_build_object('terposting', ok, 'masih_gagal', still);
end $$;

create or replace function public.pk_fin_event_retry(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
begin perform public.pk_fin_write_check(); return public.pk_fin_process(p_id); end $$;

create or replace function public.pk_fin_event_ignore(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.pk_fin_write_check();
  if coalesce(btrim(p_note), '') = '' then raise exception 'Tulis alasan diabaikan'; end if;
  update public.pk_fin_events set status = 'diabaikan', note = p_note, resolved_by = public.pk_me(), processed_at = now() where id = p_id and status in ('baru','gagal');
end $$;

create or replace function public.pk_fin_bank_import_rpc(p_account text, p_rows jsonb) returns jsonb
language sql security definer set search_path = public as $$ select public.pk_fin_bank_import(p_account, p_rows, null) $$;

create or replace function public.pk_fin_bank_classify(p_line uuid, p_account text, p_unit text, p_pattern text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b public.pk_fin_bank_lines; res jsonb;
begin
  perform public.pk_fin_write_check();
  select * into b from public.pk_fin_bank_lines where id = p_line for update;
  if b.id is null or b.status <> 'baru' then raise exception 'Mutasi ini sudah diproses'; end if;
  if not exists (select 1 from public.pk_fin_accounts where code = p_account and is_active) then raise exception 'Pilih akun lawan'; end if;
  if p_account = b.account_code then raise exception 'Akun lawan tidak boleh rekening yang sama'; end if;
  if coalesce(btrim(p_pattern), '') <> '' then
    insert into public.pk_fin_bank_rules(pattern, account_code, unit_code, created_by) values (btrim(p_pattern), p_account, p_unit, public.pk_me());
    if b.description not ilike '%' || btrim(p_pattern) || '%' then raise exception 'Kata kunci "%" tidak ada di keterangan mutasi ini', p_pattern; end if;
    return public.pk_fin_bank_match(null);
  end if;
  res := public.pk_fin_emit('bank', 'MUTASI-' || b.id, 'bank.line', b.tx_date, coalesce(p_unit, (select unit_code from public.pk_fin_accounts where code = b.account_code), 'HQ'),
    abs(b.amount), jsonb_build_object('cash', b.account_code, 'counter', p_account, 'signed', b.amount, 'desc', b.description, 'memo', 'Mutasi ' || b.description));
  if res->>'status' <> 'terposting' then raise exception '%', coalesce(res->>'error', 'Gagal memposting'); end if;
  update public.pk_fin_bank_lines set status = 'diposting', event_id = (res->>'id')::uuid, match_ref = 'ev:' || (res->>'id') where id = p_line;
  return res;
end $$;

create or replace function public.pk_fin_bank_ignore(p_line uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.pk_fin_write_check();
  if coalesce(btrim(p_note), '') = '' then raise exception 'Tulis alasan diabaikan'; end if;
  update public.pk_fin_bank_lines set status = 'diabaikan', note = p_note where id = p_line and status = 'baru';
end $$;

create or replace function public.pk_fin_rematch() returns jsonb
language plpgsql security definer set search_path = public as $$
begin perform public.pk_fin_write_check(); return public.pk_fin_bank_match(null); end $$;

create or replace function public.pk_fin_source_key(p_code text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare k text;
begin
  perform public.pk_fin_write_check();
  if not exists (select 1 from public.pk_fin_sources where code = p_code and kind = 'website') then raise exception 'Kunci API hanya untuk sumber website'; end if;
  k := 'pkf_' || p_code || '_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.pk_fin_source_keys(source, key_hash, hint, created_by) values (p_code, encode(extensions.digest(k, 'sha256'), 'hex'), right(k, 4), public.pk_me())
  on conflict (source) do update set key_hash = excluded.key_hash, hint = excluded.hint, created_by = excluded.created_by, created_at = now();
  return jsonb_build_object('key', k, 'note', 'Simpan sekarang. Kunci lama langsung tidak berlaku.');
end $$;

create or replace function public.pk_fin_source_set(p_code text, p_feeds_omzet boolean, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.pk_fin_write_check();
  update public.pk_fin_sources set feeds_omzet = coalesce(p_feeds_omzet, feeds_omzet), is_active = coalesce(p_active, is_active) where code = p_code;
end $$;

create or replace function public.pk_fin_account_save(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.pk_fin_write_check();
  if coalesce(btrim(p->>'name'), '') = '' then raise exception 'Isi nama akun'; end if;
  insert into public.pk_fin_accounts(code, name, is_cash, pos, unit_code, bank, note, is_active, sort)
  values (p->>'code', btrim(p->>'name'), coalesce((p->>'is_cash')::boolean, false), nullif(p->>'pos', ''), nullif(p->>'unit_code', ''), nullif(p->>'bank', ''),
          nullif(p->>'note', ''), coalesce((p->>'is_active')::boolean, true), coalesce((p->>'sort')::int, 0))
  on conflict (code) do update set name = excluded.name, is_cash = excluded.is_cash, pos = excluded.pos, unit_code = excluded.unit_code, bank = excluded.bank,
    note = excluded.note, is_active = excluded.is_active, sort = excluded.sort;
end $$;

create or replace function public.pk_fin_obligation_save(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid := nullif(p->>'id', '')::uuid;
begin
  perform public.pk_fin_write_check();
  if coalesce(btrim(p->>'name'), '') = '' then raise exception 'Isi nama kewajiban'; end if;
  if v is null then
    insert into public.pk_fin_obligations(name, kind, unit_code, amount, due_day, start_month, end_month, account_code, bank_pattern, note)
    values (btrim(p->>'name'), coalesce(nullif(p->>'kind', ''), 'lain'), nullif(p->>'unit_code', ''), (p->>'amount')::numeric, (p->>'due_day')::int,
            nullif(p->>'start_month', '')::date, nullif(p->>'end_month', '')::date, p->>'account_code', nullif(btrim(p->>'bank_pattern'), ''), nullif(p->>'note', ''))
    returning id into v;
  else
    update public.pk_fin_obligations set name = btrim(p->>'name'), kind = coalesce(nullif(p->>'kind', ''), 'lain'), unit_code = nullif(p->>'unit_code', ''),
      amount = (p->>'amount')::numeric, due_day = (p->>'due_day')::int, start_month = nullif(p->>'start_month', '')::date, end_month = nullif(p->>'end_month', '')::date,
      account_code = p->>'account_code', bank_pattern = nullif(btrim(p->>'bank_pattern'), ''), note = nullif(p->>'note', ''),
      is_active = coalesce((p->>'is_active')::boolean, true) where id = v;
  end if;
  return v;
end $$;

create or replace function public.pk_fin_rule_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin perform public.pk_fin_write_check(); update public.pk_fin_bank_rules set is_active = false where id = p_id; end $$;

create or replace function public.pk_fin_period_set(p_month date, p_lock boolean) returns void
language plpgsql security definer set search_path = public as $$
declare m date := date_trunc('month', p_month)::date; bad int;
begin
  perform public.pk_fin_write_check();
  if p_lock then
    if m >= date_trunc('month', public.pk_today())::date then raise exception 'Bulan berjalan belum bisa ditutup'; end if;
    select count(*) into bad from public.pk_fin_bank_lines where status = 'baru' and tx_date between m and (m + interval '1 month - 1 day')::date;
    if bad > 0 then raise exception 'Masih ada % mutasi bank bulan ini yang belum dikenali', bad; end if;
    select count(*) into bad from public.pk_fin_events where status = 'gagal' and event_date between m and (m + interval '1 month - 1 day')::date;
    if bad > 0 then raise exception 'Masih ada % transaksi bulan ini yang gagal dibukukan', bad; end if;
    insert into public.pk_fin_periods(month, status, locked_by, locked_at) values (m, 'locked', public.pk_me(), now())
    on conflict (month) do update set status = 'locked', locked_by = excluded.locked_by, locked_at = now();
  else
    if coalesce(public.pk_role(), '') <> 'ceo' then raise exception 'Membuka kembali buku yang sudah ditutup hanya oleh CEO'; end if;
    update public.pk_fin_periods set status = 'open', note = 'Dibuka lagi ' || to_char(now(), 'DD/MM/YYYY') where month = m;
  end if;
end $$;

-- jurnal penyesuaian manual (koreksi) — tercatat sebagai sumber "manual"
create or replace function public.pk_fin_manual(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare tot numeric;
begin
  perform public.pk_fin_write_check();
  if coalesce(btrim(p->>'memo'), '') = '' then raise exception 'Tulis keterangan jurnal'; end if;
  select sum(coalesce((x->>'debit')::numeric, 0)) into tot from jsonb_array_elements(coalesce(p->'lines', '[]'::jsonb)) x;
  return public.pk_fin_emit('manual', 'MJ-' || to_char(now(), 'YYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 4), 'journal',
    coalesce(nullif(p->>'date', '')::date, public.pk_today()), coalesce(nullif(p->>'unit', ''), 'HQ'), tot,
    jsonb_build_object('memo', btrim(p->>'memo'), 'lines', p->'lines', 'proof_url', nullif(p->>'proof_url', '')));
end $$;

-- batalkan jurnal dengan jurnal balik (jejak tetap ada)
create or replace function public.pk_fin_void(p_entry uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare e public.pk_fin_entries; v uuid;
begin
  perform public.pk_fin_write_check();
  if coalesce(btrim(p_reason), '') = '' then raise exception 'Tulis alasan pembatalan'; end if;
  select * into e from public.pk_fin_entries where id = p_entry;
  if e.id is null or e.status <> 'posted' then raise exception 'Jurnal tidak ditemukan atau sudah batal'; end if;
  if e.reverses is not null then raise exception 'Jurnal balik tidak bisa dibatalkan lagi'; end if;
  v := public.pk_fin_post('manual', 'BALIK-' || e.code, public.pk_today(), e.unit_code, 'Batal ' || e.code || ': ' || btrim(p_reason),
    (select jsonb_agg(jsonb_build_object('acc', account_code, 'unit', unit_code, 'd', credit, 'c', debit, 'memo', memo)) from public.pk_fin_lines where entry_id = e.id));
  update public.pk_fin_entries set reverses = e.id where id = v;
  -- kejadian sumber dibuka lagi supaya bisa dikirim ulang versi benar
  update public.pk_fin_events set status = 'diabaikan', note = 'Jurnal dibatalkan: ' || btrim(p_reason) where entry_id = e.id;
  return v;
end $$;

create or replace function public.pk_fin_payroll_run(p_month date) returns jsonb
language plpgsql security definer set search_path = public as $$
begin perform public.pk_fin_write_check(); return public.pk_fin_payroll_accrue(p_month); end $$;

revoke execute on function public.pk_fin_next_due(int, date) from anon;
do $$ declare f text; begin
  foreach f in array array['pk_fin_dashboard(date,date)','pk_fin_pl(date,date)','pk_fin_balance_sheet(date)','pk_fin_journal(date,date,text,text,text,text,int)',
    'pk_fin_exceptions()','pk_fin_bank_list(text,int)','pk_fin_map_set(text,text,text)','pk_fin_event_retry(uuid)','pk_fin_event_ignore(uuid,text)',
    'pk_fin_bank_import_rpc(text,jsonb)','pk_fin_bank_classify(uuid,text,text,text)','pk_fin_bank_ignore(uuid,text)','pk_fin_rematch()','pk_fin_source_key(text)',
    'pk_fin_source_set(text,boolean,boolean)','pk_fin_account_save(jsonb)','pk_fin_obligation_save(jsonb)','pk_fin_rule_delete(uuid)','pk_fin_period_set(date,boolean)',
    'pk_fin_manual(jsonb)','pk_fin_void(uuid,text)','pk_fin_payroll_run(date)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
revoke execute on function public.pk_fin_bank_import(text, jsonb, text) from public, anon, authenticated;

-- tugas harian 00.10 WIB
select cron.unschedule('pk-fin-harian') where exists (select 1 from cron.job where jobname = 'pk-fin-harian');
select cron.schedule('pk-fin-harian', '10 17 * * *', 'select public.pk_fin_daily()');

commit;
