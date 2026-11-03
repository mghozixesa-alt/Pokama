-- 042 Buku Keuangan (tampilan ala Kledo) tahap 1: Biaya, Kas & Bank, saldo akun, buku besar.
-- Semua dokumen tetap membukukan lewat pk_fin_post, jadi laporan di /keuangan langsung ikut.

insert into public.pk_fin_sources(code, name, unit_code, kind, feeds_omzet, is_active, note) values
  ('biaya', 'Biaya (Buku Keuangan)', 'HQ', 'sistem', false, true, 'Dicatat tim Keuangan di /buku'),
  ('kasbank', 'Kas & Bank (Buku Keuangan)', 'HQ', 'sistem', false, true, 'Kirim dana, terima dana, transfer antar rekening di /buku')
on conflict (code) do nothing;

create sequence if not exists public.pk_fin_doc_seq;

create table if not exists public.pk_fin_expenses (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  doc_date date not null,
  due_date date,
  unit_code text not null references public.pk_units(code),
  company_code text references public.pk_fin_companies(code),
  party text,
  memo text,
  ref_no text,
  pay_acc text references public.pk_fin_accounts(code),
  status text not null default 'belum' check (status in ('lunas', 'belum', 'batal')),
  total numeric not null default 0,
  tax numeric not null default 0,
  paid numeric not null default 0,
  lines jsonb not null default '[]'::jsonb,
  proof_url text,
  entry_id uuid references public.pk_fin_entries(id),
  pay_entries uuid[] not null default '{}',
  void_reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists pk_fin_expenses_date on public.pk_fin_expenses(doc_date desc);
alter table public.pk_fin_expenses enable row level security;
revoke all on public.pk_fin_expenses from anon;

create table if not exists public.pk_fin_cash_docs (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  kind text not null check (kind in ('kirim', 'terima', 'transfer')),
  doc_date date not null,
  cash_acc text not null references public.pk_fin_accounts(code),
  to_acc text references public.pk_fin_accounts(code),
  unit_code text not null references public.pk_units(code),
  party text,
  memo text,
  total numeric not null,
  lines jsonb not null default '[]'::jsonb,
  proof_url text,
  entry_id uuid references public.pk_fin_entries(id),
  status text not null default 'posted' check (status in ('posted', 'batal')),
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.pk_fin_cash_docs enable row level security;
revoke all on public.pk_fin_cash_docs from anon;

-- jurnal balik ikut membawa pihak & unit aset
create or replace function public.pk_fin_void(p_entry uuid, p_reason text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare e public.pk_fin_entries; v uuid;
begin
  perform public.pk_fin_write_check();
  if coalesce(btrim(p_reason), '') = '' then raise exception 'Tulis alasan pembatalan'; end if;
  select * into e from public.pk_fin_entries where id = p_entry;
  if e.id is null or e.status <> 'posted' then raise exception 'Jurnal tidak ditemukan atau sudah batal'; end if;
  if e.reverses is not null then raise exception 'Jurnal balik tidak bisa dibatalkan lagi'; end if;
  if exists (select 1 from public.pk_fin_entries where reverses = e.id) then raise exception 'Jurnal % sudah pernah dibatalkan', e.code; end if;
  v := public.pk_fin_post('manual', 'BALIK-' || e.code, public.pk_today(), e.unit_code, 'Batal ' || e.code || ': ' || btrim(p_reason),
    (select jsonb_agg(jsonb_build_object('acc', account_code, 'unit', unit_code, 'd', credit, 'c', debit, 'memo', memo, 'party', party, 'asset', asset_unit_id)) from public.pk_fin_lines where entry_id = e.id));
  update public.pk_fin_entries set reverses = e.id where id = v;
  update public.pk_fin_events set status = 'diabaikan', note = 'Jurnal dibatalkan: ' || btrim(p_reason) where entry_id = e.id;
  return v;
end $$;

create or replace function public.pk_fin_doc_code(p_prefix text, p_date date)
returns text language sql volatile set search_path to 'public' as $$
  select p_prefix || to_char(coalesce(p_date, public.pk_today()), 'YYMM') || '-' || lpad(nextval('public.pk_fin_doc_seq')::text, 5, '0')
$$;

/* ---------- Biaya ---------- */
-- p: {date, due, unit, party, memo, ref_no, pay_acc (kosong = bayar nanti), tax, proof_url,
--     lines:[{acc, memo, unit, asset, amount}]}
create or replace function public.pk_fin_expense_save(p jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
#variable_conflict use_column
declare x jsonb; ln jsonb := '[]'::jsonb; kept jsonb := '[]'::jsonb; tot numeric := 0; amt numeric; tx numeric; net numeric;
        d date; u text; pay text; code text; eid uuid; xid uuid; a public.pk_fin_accounts;
begin
  perform public.pk_fin_write_check();
  d := coalesce(nullif(p->>'date', '')::date, public.pk_today());
  u := coalesce(nullif(p->>'unit', ''), 'HQ');
  if not exists (select 1 from public.pk_units where code = u) then raise exception 'Unit % tidak dikenal', u; end if;
  pay := nullif(p->>'pay_acc', '');
  if pay is not null and not exists (select 1 from public.pk_fin_accounts where code = pay and is_cash and is_active) then
    raise exception 'Akun pembayaran harus akun kas/bank yang aktif';
  end if;
  if pay is null and coalesce(btrim(p->>'party'), '') = '' then raise exception 'Isi penerima/vendor untuk biaya yang dibayar nanti'; end if;
  for x in select * from jsonb_array_elements(coalesce(p->'lines', '[]'::jsonb)) loop
    amt := round(coalesce(nullif(x->>'amount', '')::numeric, 0), 2);
    if amt = 0 then continue; end if;
    if amt < 0 then raise exception 'Jumlah biaya tidak boleh negatif'; end if;
    select * into a from public.pk_fin_accounts where code = x->>'acc' and is_active;
    if a.code is null then raise exception 'Pilih akun biaya di setiap baris'; end if;
    if a.is_cash then raise exception 'Akun % adalah kas/bank, bukan akun biaya', a.code; end if;
    tot := tot + amt;
    kept := kept || jsonb_build_object('acc', a.code, 'memo', nullif(btrim(x->>'memo'), ''), 'unit', coalesce(nullif(x->>'unit', ''), u), 'asset', nullif(x->>'asset', ''), 'amount', amt);
    ln := ln || jsonb_build_object('acc', a.code, 'unit', coalesce(nullif(x->>'unit', ''), u), 'asset', nullif(x->>'asset', ''), 'd', amt,
                                   'memo', coalesce(nullif(btrim(x->>'memo'), ''), nullif(btrim(p->>'memo'), '')), 'party', nullif(btrim(p->>'party'), ''));
  end loop;
  if tot <= 0 then raise exception 'Isi minimal satu baris biaya'; end if;
  tx := round(coalesce(nullif(p->>'tax', '')::numeric, 0), 2);
  if tx < 0 or tx >= tot then raise exception 'Potongan pajak tidak masuk akal'; end if;
  net := tot - tx;
  ln := ln || jsonb_build_object('acc', coalesce(pay, '2-20100'), 'unit', u, 'c', net, 'party', nullif(btrim(p->>'party'), ''),
                                 'memo', case when pay is null then 'Hutang biaya' else 'Bayar biaya' end);
  if tx > 0 then ln := ln || jsonb_build_object('acc', '2-20400', 'unit', u, 'c', tx, 'memo', 'Potongan PPh biaya'); end if;
  code := public.pk_fin_doc_code('BY', d);
  eid := public.pk_fin_post('biaya', code, d, u,
           'Biaya ' || code || coalesce(' · ' || nullif(btrim(p->>'party'), ''), '') || coalesce(' · ' || nullif(btrim(p->>'memo'), ''), ''),
           ln, null, nullif(btrim(p->>'proof_url'), ''), public.pk_me());
  insert into public.pk_fin_expenses(code, doc_date, due_date, unit_code, company_code, party, memo, ref_no, pay_acc, status, total, tax, paid, lines, proof_url, entry_id, created_by)
  values (code, d, coalesce(nullif(p->>'due', '')::date, case when pay is null then d + 30 end), u, public.pk_fin_company_of(u),
          nullif(btrim(p->>'party'), ''), nullif(btrim(p->>'memo'), ''), nullif(btrim(p->>'ref_no'), ''), pay,
          case when pay is null then 'belum' else 'lunas' end, tot, tx, case when pay is null then 0 else net end, kept,
          nullif(btrim(p->>'proof_url'), ''), eid, public.pk_me())
  returning id into xid;
  return jsonb_build_object('id', xid, 'code', code, 'entry', (select code from public.pk_fin_entries where id = eid));
end $$;

create or replace function public.pk_fin_expense_pay(p_id uuid, p_acc text, p_date date default null, p_amount numeric default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e public.pk_fin_expenses; owe numeric; amt numeric; eid uuid; d date;
begin
  perform public.pk_fin_write_check();
  select * into e from public.pk_fin_expenses where id = p_id for update;
  if e.id is null or e.status = 'batal' then raise exception 'Biaya tidak ditemukan atau sudah batal'; end if;
  owe := e.total - e.tax - e.paid;
  if owe <= 0 then raise exception 'Biaya % sudah lunas', e.code; end if;
  if not exists (select 1 from public.pk_fin_accounts where code = p_acc and is_cash and is_active) then raise exception 'Pilih rekening kas/bank'; end if;
  amt := round(coalesce(p_amount, owe), 2);
  if amt <= 0 or amt > owe then raise exception 'Jumlah bayar harus antara 1 dan %', owe; end if;
  d := coalesce(p_date, public.pk_today());
  eid := public.pk_fin_post('biaya', e.code || '/BYR' || (coalesce(array_length(e.pay_entries, 1), 0) + 1), d, e.unit_code,
           'Pembayaran ' || e.code || coalesce(' · ' || e.party, ''),
           jsonb_build_array(jsonb_build_object('acc', '2-20100', 'unit', e.unit_code, 'd', amt, 'party', e.party, 'memo', 'Pelunasan ' || e.code),
                             jsonb_build_object('acc', p_acc, 'unit', e.unit_code, 'c', amt, 'party', e.party, 'memo', 'Pelunasan ' || e.code)),
           null, null, public.pk_me());
  update public.pk_fin_expenses set paid = paid + amt, pay_entries = pay_entries || eid,
         status = case when paid + amt >= total - tax then 'lunas' else 'belum' end,
         pay_acc = coalesce(pay_acc, p_acc)
   where id = e.id;
  return jsonb_build_object('entry', (select code from public.pk_fin_entries where id = eid), 'remaining', owe - amt);
end $$;

create or replace function public.pk_fin_expense_void(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare e public.pk_fin_expenses; x uuid;
begin
  perform public.pk_fin_write_check();
  select * into e from public.pk_fin_expenses where id = p_id for update;
  if e.id is null or e.status = 'batal' then raise exception 'Biaya tidak ditemukan atau sudah batal'; end if;
  foreach x in array e.pay_entries loop perform public.pk_fin_void(x, p_reason); end loop;
  if e.entry_id is not null then perform public.pk_fin_void(e.entry_id, p_reason); end if;
  update public.pk_fin_expenses set status = 'batal', void_reason = btrim(p_reason) where id = e.id;
end $$;

create or replace function public.pk_fin_expense_list(p_from date, p_to date, p_status text default null, p_q text default null, p_unit text default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare t date := public.pk_today();
begin
  perform public.pk_fin_read_check();
  return jsonb_build_object(
    'rows', (select coalesce(jsonb_agg(r order by r->>'date' desc, r->>'code' desc), '[]'::jsonb) from (
      select jsonb_build_object('id', e.id, 'code', e.code, 'date', e.doc_date, 'due', e.due_date, 'unit', e.unit_code, 'party', e.party, 'memo', e.memo,
        'ref_no', e.ref_no, 'status', case when e.status = 'belum' and e.due_date < t then 'telat' else e.status end, 'total', e.total, 'tax', e.tax, 'paid', e.paid,
        'owe', case when e.status = 'batal' then 0 else e.total - e.tax - e.paid end, 'pay_acc', e.pay_acc, 'proof', e.proof_url,
        'accs', (select string_agg(distinct coalesce(a.name, l->>'acc'), ', ') from jsonb_array_elements(e.lines) l left join public.pk_fin_accounts a on a.code = l->>'acc')) r
      from public.pk_fin_expenses e
      where e.doc_date between p_from and p_to
        and (p_unit is null or e.unit_code = p_unit or public.pk_fin_biz(e.unit_code) = p_unit)
        and (p_status is null or (p_status = 'telat' and e.status = 'belum' and e.due_date < t) or e.status = p_status)
        and (p_q is null or (coalesce(e.code, '') || ' ' || coalesce(e.party, '') || ' ' || coalesce(e.memo, '') || ' ' || coalesce(e.ref_no, '')) ilike '%' || p_q || '%')
      limit 1000) z),
    'sum', (select jsonb_build_object(
      'belum', coalesce(sum(total - tax - paid) filter (where status = 'belum'), 0),
      'n_belum', count(*) filter (where status = 'belum'),
      'telat', coalesce(sum(total - tax - paid) filter (where status = 'belum' and due_date < t), 0),
      'n_telat', count(*) filter (where status = 'belum' and due_date < t),
      'lunas30', coalesce(sum(total) filter (where status = 'lunas' and doc_date > t - 30), 0),
      'n_lunas30', count(*) filter (where status = 'lunas' and doc_date > t - 30),
      'bulan', coalesce(sum(total) filter (where status <> 'batal' and date_trunc('month', doc_date) = date_trunc('month', t::timestamp)), 0))
      from public.pk_fin_expenses));
end $$;

create or replace function public.pk_fin_expense_get(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e public.pk_fin_expenses;
begin
  perform public.pk_fin_read_check();
  select * into e from public.pk_fin_expenses where id = p_id;
  if e.id is null then raise exception 'Biaya tidak ditemukan'; end if;
  return to_jsonb(e) || jsonb_build_object(
    'lines', (select coalesce(jsonb_agg(l || jsonb_build_object('name', a.name, 'asset_no', un.asset_no, 'asset_name', coalesce(un.code, '') || coalesce(' · ' || un.plate_or_serial, ''))), '[]'::jsonb)
              from jsonb_array_elements(e.lines) l left join public.pk_fin_accounts a on a.code = l->>'acc' left join public.units un on un.id::text = l->>'asset'),
    'pay_name', (select name from public.pk_fin_accounts where code = e.pay_acc),
    'journal', (select coalesce(jsonb_agg(jsonb_build_object('code', en.code, 'date', en.entry_date, 'memo', en.memo, 'status', en.status,
                 'lines', (select jsonb_agg(jsonb_build_object('acc', li.account_code, 'name', ac.name, 'd', li.debit, 'c', li.credit) order by li.debit desc)
                           from public.pk_fin_lines li join public.pk_fin_accounts ac on ac.code = li.account_code where li.entry_id = en.id)) order by en.created_at), '[]'::jsonb)
                from public.pk_fin_entries en where en.id = e.entry_id or en.id = any(e.pay_entries) or en.reverses = e.entry_id or en.reverses = any(e.pay_entries)));
end $$;

/* ---------- Kas & Bank ---------- */
-- p: {kind: kirim|terima|transfer, date, cash_acc, to_acc (transfer), unit, party, memo, proof_url, amount (transfer), lines:[{acc, memo, unit, amount}]}
create or replace function public.pk_fin_cash_save(p jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
#variable_conflict use_column
declare k text := p->>'kind'; d date; u text; c text; t text; x jsonb; ln jsonb := '[]'::jsonb; kept jsonb := '[]'::jsonb; tot numeric := 0; amt numeric;
        code text; eid uuid; xid uuid; a public.pk_fin_accounts; cu text;
begin
  perform public.pk_fin_write_check();
  if k not in ('kirim', 'terima', 'transfer') then raise exception 'Jenis transaksi kas tidak dikenal'; end if;
  d := coalesce(nullif(p->>'date', '')::date, public.pk_today());
  u := coalesce(nullif(p->>'unit', ''), 'HQ');
  c := p->>'cash_acc';
  if not exists (select 1 from public.pk_fin_accounts where code = c and is_cash and is_active) then raise exception 'Pilih rekening kas/bank'; end if;
  select coalesce(unit_code, u) into cu from public.pk_fin_accounts where code = c;
  if k = 'transfer' then
    t := p->>'to_acc';
    if t = c or not exists (select 1 from public.pk_fin_accounts where code = t and is_cash and is_active) then raise exception 'Pilih rekening tujuan yang berbeda'; end if;
    tot := round(coalesce(nullif(p->>'amount', '')::numeric, 0), 2);
    if tot <= 0 then raise exception 'Isi jumlah transfer'; end if;
    ln := jsonb_build_array(jsonb_build_object('acc', t, 'unit', coalesce((select unit_code from public.pk_fin_accounts where code = t), u), 'd', tot, 'memo', nullif(btrim(p->>'memo'), '')),
                            jsonb_build_object('acc', c, 'unit', cu, 'c', tot, 'memo', nullif(btrim(p->>'memo'), '')));
  else
    for x in select * from jsonb_array_elements(coalesce(p->'lines', '[]'::jsonb)) loop
      amt := round(coalesce(nullif(x->>'amount', '')::numeric, 0), 2);
      if amt = 0 then continue; end if;
      if amt < 0 then raise exception 'Jumlah tidak boleh negatif'; end if;
      select * into a from public.pk_fin_accounts where code = x->>'acc' and is_active;
      if a.code is null then raise exception 'Pilih akun di setiap baris'; end if;
      if a.code = c then raise exception 'Akun baris tidak boleh sama dengan rekeningnya'; end if;
      tot := tot + amt;
      kept := kept || jsonb_build_object('acc', a.code, 'memo', nullif(btrim(x->>'memo'), ''), 'unit', coalesce(nullif(x->>'unit', ''), u), 'amount', amt);
      ln := ln || jsonb_build_object('acc', a.code, 'unit', coalesce(nullif(x->>'unit', ''), u), 'party', nullif(btrim(p->>'party'), ''),
               'memo', coalesce(nullif(btrim(x->>'memo'), ''), nullif(btrim(p->>'memo'), '')), case when k = 'kirim' then 'd' else 'c' end, amt);
    end loop;
    if tot <= 0 then raise exception 'Isi minimal satu baris'; end if;
    ln := ln || jsonb_build_object('acc', c, 'unit', cu, case when k = 'kirim' then 'c' else 'd' end, tot, 'party', nullif(btrim(p->>'party'), ''), 'memo', nullif(btrim(p->>'memo'), ''));
  end if;
  code := public.pk_fin_doc_code(case k when 'kirim' then 'KD' when 'terima' then 'TD' else 'TF' end, d);
  eid := public.pk_fin_post('kasbank', code, d, u,
           case k when 'kirim' then 'Kirim dana ' when 'terima' then 'Terima dana ' else 'Transfer ' end || code
           || coalesce(' · ' || nullif(btrim(p->>'party'), ''), '') || coalesce(' · ' || nullif(btrim(p->>'memo'), ''), ''),
           ln, null, nullif(btrim(p->>'proof_url'), ''), public.pk_me());
  insert into public.pk_fin_cash_docs(code, kind, doc_date, cash_acc, to_acc, unit_code, party, memo, total, lines, proof_url, entry_id, created_by)
  values (code, k, d, c, t, u, nullif(btrim(p->>'party'), ''), nullif(btrim(p->>'memo'), ''), tot, kept, nullif(btrim(p->>'proof_url'), ''), eid, public.pk_me())
  returning id into xid;
  return jsonb_build_object('id', xid, 'code', code, 'entry', (select code from public.pk_fin_entries where id = eid));
end $$;

-- saldo semua akun per tanggal (tanda normal: aset/hpp/beban = debit − kredit, lainnya = kredit − debit)
create or replace function public.pk_fin_balances(p_to date default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare t date := coalesce(p_to, public.pk_today());
begin
  perform public.pk_fin_read_check();
  return (select coalesce(jsonb_agg(jsonb_build_object('code', a.code, 'name', a.name, 'grp', a.grp, 'is_cash', a.is_cash, 'unit', a.unit_code, 'pos', a.pos, 'bank', a.bank,
      'bal', case when a.grp in ('aset', 'hpp', 'beban', 'beban_lain') then coalesce(s.d, 0) - coalesce(s.c, 0) else coalesce(s.c, 0) - coalesce(s.d, 0) end,
      'n', coalesce(s.n, 0)) order by a.code), '[]'::jsonb)
    from public.pk_fin_accounts a
    left join (select l.account_code, sum(l.debit) d, sum(l.credit) c, count(*) n from public.pk_fin_lines l join public.pk_fin_entries e on e.id = l.entry_id
               where e.entry_date <= t group by l.account_code) s on s.account_code = a.code
    where a.is_active);
end $$;

-- ringkasan rekening kas & bank: saldo, masuk & keluar dalam rentang, mutasi bank yang belum dicocokkan
create or replace function public.pk_fin_cash_summary(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  perform public.pk_fin_read_check();
  return (select coalesce(jsonb_agg(jsonb_build_object('code', a.code, 'name', a.name, 'unit', a.unit_code, 'pos', a.pos, 'bank', a.bank,
      'bal', coalesce((select sum(l.debit - l.credit) from public.pk_fin_lines l join public.pk_fin_entries e on e.id = l.entry_id where l.account_code = a.code and e.entry_date <= p_to), 0),
      'in', coalesce((select sum(l.debit) from public.pk_fin_lines l join public.pk_fin_entries e on e.id = l.entry_id where l.account_code = a.code and e.entry_date between p_from and p_to), 0),
      'out', coalesce((select sum(l.credit) from public.pk_fin_lines l join public.pk_fin_entries e on e.id = l.entry_id where l.account_code = a.code and e.entry_date between p_from and p_to), 0),
      'bank_bal', (select balance from public.pk_fin_bank_lines b where b.account_code = a.code and b.balance is not null order by tx_date desc, created_at desc limit 1),
      'unmatched', (select count(*) from public.pk_fin_bank_lines b where b.account_code = a.code and b.status = 'baru')) order by a.code), '[]'::jsonb)
    from public.pk_fin_accounts a where a.is_active and a.is_cash);
end $$;

-- buku besar satu akun
create or replace function public.pk_fin_ledger(p_acc text, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare a public.pk_fin_accounts; sgn int; op numeric;
begin
  perform public.pk_fin_read_check();
  select * into a from public.pk_fin_accounts where code = p_acc;
  if a.code is null then raise exception 'Akun tidak ditemukan'; end if;
  sgn := case when a.grp in ('aset', 'hpp', 'beban', 'beban_lain') then 1 else -1 end;
  select coalesce(sum(l.debit - l.credit), 0) * sgn into op from public.pk_fin_lines l join public.pk_fin_entries e on e.id = l.entry_id
   where l.account_code = p_acc and e.entry_date < p_from;
  return jsonb_build_object('acc', to_jsonb(a), 'opening', op,
    'rows', (select coalesce(jsonb_agg(jsonb_build_object('id', z.entry_id, 'code', z.code, 'date', z.entry_date, 'source', z.source, 'ref', z.source_ref, 'memo', coalesce(z.lmemo, z.memo),
               'party', z.party, 'unit', z.unit_code, 'd', z.debit, 'c', z.credit, 'run', op + z.run * sgn) order by z.entry_date, z.created_at, z.id), '[]'::jsonb)
             from (select l.entry_id, l.id, e.code, e.entry_date, e.source, e.source_ref, e.memo, l.memo lmemo, l.party, l.unit_code, l.debit, l.credit, e.created_at,
                          sum(l.debit - l.credit) over (order by e.entry_date, e.created_at, l.id) run
                   from public.pk_fin_lines l join public.pk_fin_entries e on e.id = l.entry_id
                   where l.account_code = p_acc and e.entry_date between p_from and p_to order by e.entry_date, e.created_at, l.id limit 2000) z));
end $$;

-- pilihan unit aset (motor, mobil, kamera, dll.) untuk ditempel di baris biaya
create or replace function public.pk_fin_asset_pick(p_q text default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  perform public.pk_fin_read_check();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'no', u.asset_no, 'label', coalesce(u.asset_no, '') || ' · ' || coalesce(u.code, '') || coalesce(' · ' || u.plate_or_serial, ''))
          order by u.asset_no), '[]'::jsonb)
    from (select * from public.units u where u.archived_at is null
            and (p_q is null or (coalesce(u.asset_no, '') || ' ' || coalesce(u.code, '') || ' ' || coalesce(u.plate_or_serial, '')) ilike '%' || p_q || '%')
          order by u.asset_no limit 30) u);
end $$;

do $$ declare f text; begin
  foreach f in array array['pk_fin_expense_save(jsonb)', 'pk_fin_expense_pay(uuid,text,date,numeric)', 'pk_fin_expense_void(uuid,text)',
    'pk_fin_expense_list(date,date,text,text,text)', 'pk_fin_expense_get(uuid)', 'pk_fin_cash_save(jsonb)', 'pk_fin_balances(date)',
    'pk_fin_cash_summary(date,date)', 'pk_fin_ledger(text,date,date)', 'pk_fin_asset_pick(text)', 'pk_fin_doc_code(text,date)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;
revoke execute on function public.pk_fin_doc_code(text, date) from authenticated;
