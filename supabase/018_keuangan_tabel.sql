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
