-- 033: Melengkapi Keuangan grup Pokama (satu buku: PT Popo Karya Investama)
-- Saldo awal, jurnal manual dengan pihak (pelanggan/vendor/mitra), utang leasing, proyeksi kas 13 minggu,
-- laporan arus kas, piutang & hutang per pihak, pengaturan Profit First / pajak / kas minimum.
-- Isian (saldo awal, rekening, jurnal) dilakukan tim Keuangan dari panel. Tidak mengubah data yang sudah ada.

-- ===== pihak (pelanggan / vendor / mitra / karyawan) di baris jurnal =====
alter table public.pk_fin_lines add column if not exists party text;
create index if not exists pk_fin_lines_party on public.pk_fin_lines(party) where party is not null;

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
  insert into public.pk_fin_lines(entry_id, account_code, unit_code, debit, credit, memo, party)
  select v, x->>'acc', coalesce(x->>'unit', p_unit), round(coalesce((x->>'d')::numeric, 0), 2), round(coalesce((x->>'c')::numeric, 0), 2), x->>'memo',
         nullif(btrim(x->>'party'), '')
  from jsonb_array_elements(p_lines) x
  where round(coalesce((x->>'d')::numeric, 0), 2) <> 0 or round(coalesce((x->>'c')::numeric, 0), 2) <> 0;
  return v;
end $$;

-- buku jurnal: baris ikut menampilkan pihak
create or replace function public.pk_fin_journal(p_from date, p_to date, p_biz text default null, p_source text default null, p_q text default null, p_acc text default null, p_limit int default 200)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.pk_fin_read_check();
  return (select coalesce(jsonb_agg(j order by (j->>'date') desc, j->>'code' desc), '[]'::jsonb) from (
    select jsonb_build_object('id', e.id, 'code', e.code, 'date', e.entry_date, 'source', e.source, 'ref', e.source_ref, 'unit', e.unit_code, 'memo', e.memo,
      'proof', e.proof_url, 'status', e.status, 'by', e.created_by, 'at', e.created_at, 'reverses', e.reverses,
      'by_name', (select coalesce(p.nickname, p.name) from public.pk_people p where p.id = e.created_by),
      'total', (select sum(debit) from public.pk_fin_lines where entry_id = e.id),
      'lines', (select jsonb_agg(jsonb_build_object('acc', l.account_code, 'name', a.name, 'unit', l.unit_code, 'd', l.debit, 'c', l.credit, 'memo', l.memo, 'party', l.party) order by l.id)
                from public.pk_fin_lines l join public.pk_fin_accounts a on a.code = l.account_code where l.entry_id = e.id)) j
    from public.pk_fin_entries e
    where e.entry_date between p_from and p_to
      and (p_source is null or e.source = p_source)
      and (p_biz is null or exists (select 1 from public.pk_fin_lines l where l.entry_id = e.id and public.pk_fin_biz(coalesce(l.unit_code, e.unit_code)) = p_biz))
      and (p_acc is null or exists (select 1 from public.pk_fin_lines l where l.entry_id = e.id and l.account_code = p_acc))
      and (p_q is null or e.memo ilike '%' || p_q || '%' or e.code ilike '%' || p_q || '%' or e.source_ref ilike '%' || p_q || '%'
           or exists (select 1 from public.pk_fin_lines l where l.entry_id = e.id and l.party ilike '%' || p_q || '%'))
    order by e.entry_date desc, e.code desc limit least(coalesce(p_limit, 200), 1000)) z);
end $$;

-- ===== jurnal manual (Keuangan): langsung ke buku, wajib seimbang, tercatat siapa yang membuat =====
create or replace function public.pk_fin_journal_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid; ln jsonb := '[]'::jsonb; x jsonb; ref text;
begin
  perform public.pk_fin_write_check();
  if coalesce(btrim(p->>'memo'), '') = '' then raise exception 'Tulis keterangan jurnal'; end if;
  for x in select * from jsonb_array_elements(coalesce(p->'lines', '[]'::jsonb)) loop
    ln := ln || jsonb_build_object('acc', x->>'acc', 'unit', coalesce(nullif(x->>'unit', ''), nullif(p->>'unit', ''), 'HQ'),
      'd', coalesce(nullif(x->>'d', '')::numeric, 0), 'c', coalesce(nullif(x->>'c', '')::numeric, 0), 'memo', nullif(x->>'memo', ''), 'party', nullif(x->>'party', ''));
  end loop;
  ref := 'MJ-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 4);
  v := public.pk_fin_post('manual', ref, coalesce(nullif(p->>'date', '')::date, public.pk_today()), coalesce(nullif(p->>'unit', ''), 'HQ'),
                          btrim(p->>'memo'), ln, null, nullif(btrim(p->>'proof_url'), ''), public.pk_me());
  return jsonb_build_object('id', v, 'code', (select code from public.pk_fin_entries where id = v));
end $$;

-- ===== saldo awal: satu jurnal "SALDO-AWAL"; simpan ulang menggantikan versi sebelumnya =====
create or replace function public.pk_fin_opening_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare e public.pk_fin_entries;
begin
  perform public.pk_fin_read_check();
  select * into e from public.pk_fin_entries where source = 'manual' and source_ref = 'SALDO-AWAL' and status = 'posted';
  return jsonb_build_object('date', e.entry_date, 'code', e.code, 'at', e.created_at,
    'by', (select coalesce(p.nickname, p.name) from public.pk_people p where p.id = e.created_by),
    'first_tx', (select min(entry_date) from public.pk_fin_entries where status = 'posted' and not (source = 'manual' and source_ref = 'SALDO-AWAL')),
    'lines', (select coalesce(jsonb_agg(jsonb_build_object('acc', l.account_code, 'unit', l.unit_code, 'party', l.party,
                 'amount', case when left(l.account_code, 1) = '1' then l.debit - l.credit else l.credit - l.debit end) order by l.account_code), '[]'::jsonb)
              from public.pk_fin_lines l where l.entry_id = e.id and l.account_code <> '3-30999'),
    'balancing', (select coalesce(sum(credit - debit), 0) from public.pk_fin_lines l where l.entry_id = e.id and l.account_code = '3-30999'));
end $$;

create or replace function public.pk_fin_opening_save(p_date date, p_lines jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare x jsonb; ln jsonb := '[]'::jsonb; amt numeric; acc text; dr numeric := 0; cr numeric := 0; v uuid;
begin
  perform public.pk_fin_write_check();
  if p_date is null then raise exception 'Isi tanggal saldo awal'; end if;
  if exists (select 1 from public.pk_fin_periods where month = date_trunc('month', p_date)::date and status = 'locked') then
    raise exception 'Bulan % sudah ditutup; buka dulu (CEO) sebelum mengubah saldo awal', to_char(p_date, 'MM/YYYY');
  end if;
  for x in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    acc := x->>'acc'; amt := round(coalesce(nullif(x->>'amount', '')::numeric, 0), 2);
    if amt = 0 then continue; end if;
    if left(acc, 1) not in ('1','2','3') then raise exception 'Saldo awal hanya untuk akun neraca (aset, kewajiban, ekuitas): %', acc; end if;
    -- nilai positif = saldo normal (aset di debit; kewajiban & ekuitas di kredit)
    if (left(acc, 1) = '1') = (amt > 0) then
      ln := ln || jsonb_build_object('acc', acc, 'unit', nullif(x->>'unit', ''), 'd', abs(amt), 'party', nullif(x->>'party', ''), 'memo', 'Saldo awal'); dr := dr + abs(amt);
    else
      ln := ln || jsonb_build_object('acc', acc, 'unit', nullif(x->>'unit', ''), 'c', abs(amt), 'party', nullif(x->>'party', ''), 'memo', 'Saldo awal'); cr := cr + abs(amt);
    end if;
  end loop;
  if jsonb_array_length(ln) = 0 then raise exception 'Isi minimal satu saldo'; end if;
  if dr <> cr then
    ln := ln || case when dr > cr then jsonb_build_object('acc', '3-30999', 'unit', 'HQ', 'c', dr - cr, 'memo', 'Penyeimbang saldo awal')
                     else jsonb_build_object('acc', '3-30999', 'unit', 'HQ', 'd', cr - dr, 'memo', 'Penyeimbang saldo awal') end;
  end if;
  update public.pk_fin_entries set status = 'void', memo = memo || ' (diganti ' || to_char(now() at time zone 'Asia/Jakarta', 'DD/MM HH24:MI') || ')'
   where source = 'manual' and source_ref = 'SALDO-AWAL' and status = 'posted';
  v := public.pk_fin_post('manual', 'SALDO-AWAL', p_date, 'HQ', 'Saldo awal per ' || to_char(p_date, 'DD/MM/YYYY') || ' (PT Popo Karya Investama)', ln, null, null, public.pk_me());
  return jsonb_build_object('id', v, 'selisih', dr - cr);
end $$;

-- ===== pengaturan keuangan (Profit First, pajak, kas minimum) =====
insert into public.pk_settings(key, value, note) values
  ('fin_company', '"PT Popo Karya Investama"', 'Nama badan hukum di kepala laporan keuangan'),
  ('fin_profit_first', '{"operasional": 55, "kewajiban": 20, "bersama": 15, "investasi": 10}', 'Persen pembagian uang masuk ke tiap pos rekening (Profit First)'),
  ('fin_tax_rate', '0.5', 'Tarif PPh final atas omzet bruto (%), untuk estimasi; pastikan dengan konsultan pajak'),
  ('fin_min_cash', '0', 'Batas kas minimum grup; proyeksi kas memberi tanda bila di bawah angka ini')
on conflict (key) do nothing;

create or replace function public.pk_fin_settings_get() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.pk_fin_read_check();
  return (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from public.pk_settings where key like 'fin\_%' or key = 'lpj_days');
end $$;

create or replace function public.pk_fin_setting_set(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare s numeric;
begin
  perform public.pk_fin_write_check();
  if p_key not in ('fin_profit_first','fin_tax_rate','fin_min_cash','fin_close_day','fin_payroll_day','fin_capitalize_min','fin_company') then
    raise exception 'Pengaturan % tidak bisa diubah dari panel', p_key;
  end if;
  if p_key = 'fin_profit_first' then
    select sum(value::text::numeric) into s from jsonb_each(p_value);
    if s is distinct from 100 then raise exception 'Total persen Profit First harus 100 (sekarang %)', coalesce(s, 0); end if;
  end if;
  update public.pk_settings set value = p_value, updated_at = now() where key = p_key;
  if not found then insert into public.pk_settings(key, value) values (p_key, p_value); end if;
end $$;

-- ===== utang leasing & pinjaman =====
create table if not exists public.pk_fin_loans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lender text,
  kind text not null default 'leasing' check (kind in ('leasing','pinjaman','investor')),
  unit_code text references public.pk_units(code),
  principal numeric(16,2) not null check (principal > 0),
  rate_pct numeric(6,3) not null default 0 check (rate_pct >= 0),
  method text not null default 'flat' check (method in ('flat','anuitas')),
  tenor_months int not null check (tenor_months between 1 and 360),
  start_month date not null,
  due_day int not null default 1 check (due_day between 1 and 31),
  installment numeric(16,2),
  paid_months int not null default 0 check (paid_months >= 0),
  liability_account text not null default '2-21000' references public.pk_fin_accounts(code),
  interest_account text not null default '8-80001' references public.pk_fin_accounts(code),
  bank_pattern text,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.pk_fin_loans enable row level security;
revoke all on public.pk_fin_loans from anon;
drop policy if exists pk_fin_loans_r on public.pk_fin_loans;
create policy pk_fin_loans_r on public.pk_fin_loans for select to authenticated using (public.pk_fin_can_read());

create or replace function public.pk_fin_loan_save(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid := nullif(p->>'id', '')::uuid;
begin
  perform public.pk_fin_write_check();
  if coalesce(btrim(p->>'name'), '') = '' then raise exception 'Isi nama pinjaman'; end if;
  if coalesce((p->>'principal')::numeric, 0) <= 0 then raise exception 'Isi pokok pinjaman'; end if;
  if v is null then
    insert into public.pk_fin_loans(name, lender, kind, unit_code, principal, rate_pct, method, tenor_months, start_month, due_day, installment, paid_months, bank_pattern, note)
    values (btrim(p->>'name'), nullif(btrim(p->>'lender'), ''), coalesce(nullif(p->>'kind', ''), 'leasing'), nullif(p->>'unit_code', ''),
            (p->>'principal')::numeric, coalesce(nullif(p->>'rate_pct', '')::numeric, 0), coalesce(nullif(p->>'method', ''), 'flat'),
            (p->>'tenor_months')::int, date_trunc('month', (p->>'start_month')::date)::date, coalesce(nullif(p->>'due_day', '')::int, 1),
            nullif(p->>'installment', '')::numeric, coalesce(nullif(p->>'paid_months', '')::int, 0), nullif(btrim(p->>'bank_pattern'), ''), nullif(p->>'note', ''))
    returning id into v;
  else
    update public.pk_fin_loans set name = btrim(p->>'name'), lender = nullif(btrim(p->>'lender'), ''), kind = coalesce(nullif(p->>'kind', ''), 'leasing'),
      unit_code = nullif(p->>'unit_code', ''), principal = (p->>'principal')::numeric, rate_pct = coalesce(nullif(p->>'rate_pct', '')::numeric, 0),
      method = coalesce(nullif(p->>'method', ''), 'flat'), tenor_months = (p->>'tenor_months')::int, start_month = date_trunc('month', (p->>'start_month')::date)::date,
      due_day = coalesce(nullif(p->>'due_day', '')::int, 1), installment = nullif(p->>'installment', '')::numeric,
      paid_months = coalesce(nullif(p->>'paid_months', '')::int, 0), bank_pattern = nullif(btrim(p->>'bank_pattern'), ''), note = nullif(p->>'note', ''),
      is_active = coalesce((p->>'is_active')::boolean, true) where id = v;
  end if;
  return v;
end $$;

-- cicilan per bulan sebuah pinjaman (flat: pokok/tenor + bunga flat; anuitas: rumus anuitas)
create or replace function public.pk_fin_loan_installment(l public.pk_fin_loans) returns numeric
language sql immutable as $$
  select coalesce(l.installment, case
    when l.method = 'anuitas' and l.rate_pct > 0 then round(l.principal * (l.rate_pct / 1200) / (1 - power(1 + l.rate_pct / 1200, -l.tenor_months)), 0)
    else round(l.principal / l.tenor_months + l.principal * l.rate_pct / 1200, 0) end)
$$;

-- ===== proyeksi kas 13 minggu =====
create or replace function public.pk_fin_forecast(p_weeks int default 13) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t date := public.pk_today(); w0 date; cash0 numeric; hist_from date; nweeks numeric; avg_in numeric; avg_out numeric; out jsonb := '[]'::jsonb;
  i int; ws date; we date; bal numeric; v_in numeric; v_rut numeric; v_obl numeric; v_loan numeric; v_pay numeric; v_rab numeric; items jsonb;
  payday int := public.pk_setting_num('fin_payroll_day', 25)::int; payroll numeric; minc numeric := public.pk_setting_num('fin_min_cash', 0); d date; m date;
begin
  perform public.pk_fin_read_check();
  w0 := t - ((extract(isodow from t)::int) - 1);            -- Senin minggu ini
  hist_from := w0 - 56;                                      -- 8 minggu lengkap terakhir
  select coalesce(sum(l.debit - l.credit), 0) into cash0 from public.pk_fin_lines l join public.pk_fin_entries e on e.id = l.entry_id
    join public.pk_fin_accounts a on a.code = l.account_code and a.is_cash where e.status = 'posted';
  -- arus kas bersih per jurnal (abaikan pindah antar-rekening, gaji, cicilan & kewajiban terjadwal: itu dihitung terpisah)
  with ent as (
    select e.id, sum(case when a.is_cash then l.debit - l.credit else 0 end) net,
           bool_or(not a.is_cash and (l.account_code in (select account_code from public.pk_fin_obligations where is_active)
                   or l.account_code in (select liability_account from public.pk_fin_loans where is_active)
                   or l.account_code in (select interest_account from public.pk_fin_loans where is_active)
                   or l.account_code in ('2-20500','1-10102'))) sched
    from public.pk_fin_entries e join public.pk_fin_lines l on l.entry_id = e.id join public.pk_fin_accounts a on a.code = l.account_code
    where e.status = 'posted' and e.entry_date >= hist_from and e.entry_date < w0 and not (e.source = 'manual' and e.source_ref = 'SALDO-AWAL')
    group by e.id)
  select coalesce(sum(net) filter (where net > 0), 0) / 8, coalesce(-sum(net) filter (where net < 0 and not sched), 0) / 8 into avg_in, avg_out from ent;
  select count(*) into nweeks from (select distinct date_trunc('week', entry_date) from public.pk_fin_entries where status = 'posted' and entry_date >= hist_from and entry_date < w0) z;
  select coalesce(nullif((select sum(base_salary) from public.pk_salary), 0),
                  (select sum(debit) from public.pk_fin_lines l join public.pk_fin_entries e on e.id = l.entry_id
                    where e.status = 'posted' and l.account_code = '6-60001' and e.source = 'pokama' and e.source_ref like 'GAJI-%'
                      and e.entry_date = (select max(entry_date) from public.pk_fin_entries where source = 'pokama' and source_ref like 'GAJI-%' and status = 'posted')), 0) into payroll;
  bal := cash0;
  for i in 0 .. greatest(1, least(p_weeks, 26)) - 1 loop
    ws := w0 + i * 7; we := ws + 6; items := '[]'::jsonb;
    v_in := round(avg_in * case when i = 0 then (we - t + 1) / 7.0 else 1 end);
    v_rut := round(avg_out * case when i = 0 then (we - t + 1) / 7.0 else 1 end);
    -- kewajiban rutin
    select coalesce(sum(o.amount), 0), coalesce(jsonb_agg(jsonb_build_object('name', o.name, 'amt', o.amount, 'due', nd, 'kind', o.kind)), '[]'::jsonb) into v_obl, items
      from public.pk_fin_obligations o
      cross join lateral (select g::date nd from generate_series(public.pk_fin_next_due(o.due_day, greatest(ws, t)), we, interval '1 month') g) x
      where o.is_active and nd between greatest(ws, t) and we
        and (o.start_month is null or nd >= o.start_month) and (o.end_month is null or nd <= (date_trunc('month', o.end_month) + interval '1 month - 1 day')::date);
    -- cicilan pinjaman/leasing yang masih berjalan
    v_loan := 0;
    for d in select g::date from generate_series(greatest(ws, t), we, interval '1 day') g loop
      select coalesce(sum(public.pk_fin_loan_installment(ln)), 0), items || coalesce(jsonb_agg(jsonb_build_object('name', ln.name, 'amt', public.pk_fin_loan_installment(ln), 'due', d, 'kind', ln.kind)), '[]'::jsonb)
        into v_pay, items
        from public.pk_fin_loans ln
        where ln.is_active and extract(day from d) = least(ln.due_day, extract(day from (date_trunc('month', d) + interval '1 month - 1 day'))::int)
          and date_trunc('month', d)::date >= ln.start_month
          and ((extract(year from age(date_trunc('month', d), ln.start_month)) * 12 + extract(month from age(date_trunc('month', d), ln.start_month)))::int) < ln.tenor_months;
      v_loan := v_loan + v_pay;
    end loop;
    -- gaji
    v_pay := 0;
    for m in select distinct date_trunc('month', g)::date from generate_series(greatest(ws, t), we, interval '1 day') g loop
      d := make_date(extract(year from m)::int, extract(month from m)::int, least(payday, extract(day from (m + interval '1 month - 1 day'))::int));
      if d between greatest(ws, t) and we then v_pay := v_pay + payroll; end if;
    end loop;
    -- belanja yang sudah disetujui / diajukan, diperkirakan cair minggu ini dan minggu depan
    v_rab := case when i = 0 then (select coalesce(sum(total), 0) from public.pk_rab where status = 'siap_cair')
                  when i = 1 then (select coalesce(sum(total), 0) from public.pk_rab where status = 'diajukan') else 0 end;
    out := out || jsonb_build_object('week', ws, 'end', we, 'open', bal, 'in', v_in, 'rutin', v_rut, 'kewajiban', v_obl, 'cicilan', v_loan,
      'gaji', v_pay, 'belanja', v_rab, 'items', items,
      'close', bal + v_in - v_rut - v_obl - v_loan - v_pay - v_rab,
      'low', (bal + v_in - v_rut - v_obl - v_loan - v_pay - v_rab) < minc);
    bal := bal + v_in - v_rut - v_obl - v_loan - v_pay - v_rab;
  end loop;
  return jsonb_build_object('today', t, 'cash', cash0, 'avg_in', round(avg_in), 'avg_out', round(avg_out), 'hist_weeks', nweeks, 'payroll', payroll,
    'payday', payday, 'min_cash', minc, 'weeks', out,
    'lowest', (select min((x->>'close')::numeric) from jsonb_array_elements(out) x),
    'first_low', (select x->>'week' from jsonb_array_elements(out) x where (x->>'low')::boolean order by x->>'week' limit 1));
end $$;

-- ===== laporan arus kas (metode langsung, dari jurnal yang menyentuh kas/bank) =====
create or replace function public.pk_fin_cashflow(p_from date, p_to date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare opening numeric; closing numeric;
begin
  perform public.pk_fin_read_check();
  select coalesce(sum(l.debit - l.credit), 0) into opening from public.pk_fin_lines l join public.pk_fin_entries e on e.id = l.entry_id
    join public.pk_fin_accounts a on a.code = l.account_code and a.is_cash where e.status = 'posted' and e.entry_date < p_from;
  select coalesce(sum(l.debit - l.credit), 0) into closing from public.pk_fin_lines l join public.pk_fin_entries e on e.id = l.entry_id
    join public.pk_fin_accounts a on a.code = l.account_code and a.is_cash where e.status = 'posted' and e.entry_date <= p_to;
  return jsonb_build_object('opening', opening, 'closing', closing,
    'rows', (select coalesce(jsonb_agg(jsonb_build_object('cat', cat, 'acc', acc, 'name', name, 'biz', biz, 'amt', amt) order by cat, acc), '[]'::jsonb) from (
      select case when left(l.account_code, 5) in ('1-107') then 'investasi'
                  when left(l.account_code, 4) = '2-21' or left(l.account_code, 1) = '3' then 'pendanaan'
                  else 'operasi' end cat,
             l.account_code acc, a.name, public.pk_fin_biz(coalesce(l.unit_code, e.unit_code, 'HQ')) biz, sum(l.credit - l.debit) amt
      from public.pk_fin_entries e join public.pk_fin_lines l on l.entry_id = e.id join public.pk_fin_accounts a on a.code = l.account_code
      where e.status = 'posted' and e.entry_date between p_from and p_to and not a.is_cash
        and exists (select 1 from public.pk_fin_lines c join public.pk_fin_accounts ca on ca.code = c.account_code and ca.is_cash where c.entry_id = e.id)
      group by 1, 2, 3, 4 having sum(l.credit - l.debit) <> 0) z));
end $$;

-- ===== piutang & hutang per pihak (baris mentah; umur dihitung di layar dengan FIFO) =====
create or replace function public.pk_fin_party_lines(p_to date) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.pk_fin_read_check();
  return (select coalesce(jsonb_agg(jsonb_build_object('acc', l.account_code, 'party', coalesce(l.party, '(tanpa nama)'), 'd', e.entry_date,
      'dr', l.debit, 'cr', l.credit, 'unit', coalesce(l.unit_code, e.unit_code), 'code', e.code, 'memo', coalesce(l.memo, e.memo)) order by e.entry_date, e.code), '[]'::jsonb)
    from public.pk_fin_lines l join public.pk_fin_entries e on e.id = l.entry_id
    where e.status = 'posted' and e.entry_date <= p_to
      and l.account_code in ('1-10100','1-10101','2-20100','2-20300','2-20600','2-21200'));
end $$;

-- ===== hak akses =====
do $$ declare f text; begin
  foreach f in array array['pk_fin_journal_save(jsonb)','pk_fin_opening_get()','pk_fin_opening_save(date,jsonb)','pk_fin_settings_get()',
    'pk_fin_setting_set(text,jsonb)','pk_fin_loan_save(jsonb)','pk_fin_forecast(int)','pk_fin_cashflow(date,date)','pk_fin_party_lines(date)',
    'pk_fin_journal(date,date,text,text,text,text,int)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
revoke execute on function public.pk_fin_post(text, text, date, text, text, jsonb, uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.pk_fin_loan_installment(public.pk_fin_loans) from anon;
