-- 036: leasing/pinjaman boleh dicatat walau pokok & tenor belum diketahui (cukup cicilan per bulan + tanggal).
-- Tim Keuangan melengkapi pokok/tenor belakangan; sementara itu proyeksi kas tetap memakai cicilannya.
alter table public.pk_fin_loans add column if not exists contract_no text;
alter table public.pk_fin_loans alter column principal drop not null;
alter table public.pk_fin_loans alter column tenor_months drop not null;

create or replace function public.pk_fin_loan_save(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid := nullif(p->>'id', '')::uuid;
  v_pr numeric := nullif(p->>'principal', '')::numeric; v_tn int := nullif(p->>'tenor_months', '')::int; v_in numeric := nullif(p->>'installment', '')::numeric;
begin
  perform public.pk_fin_write_check();
  if coalesce(btrim(p->>'name'), '') = '' then raise exception 'Isi nama pinjaman'; end if;
  if coalesce(v_pr, 0) <= 0 and coalesce(v_in, 0) <= 0 then raise exception 'Isi pokok pinjaman atau cicilan per bulan'; end if;
  if v_in is null and v_tn is null then raise exception 'Isi tenor (atau cicilan per bulan)'; end if;
  if v is null then
    insert into public.pk_fin_loans(name, lender, kind, unit_code, contract_no, principal, rate_pct, method, tenor_months, start_month, due_day, installment, paid_months, bank_pattern, note)
    values (btrim(p->>'name'), nullif(btrim(p->>'lender'), ''), coalesce(nullif(p->>'kind', ''), 'leasing'), nullif(p->>'unit_code', ''), nullif(btrim(p->>'contract_no'), ''),
            nullif(v_pr, 0), coalesce(nullif(p->>'rate_pct', '')::numeric, 0), coalesce(nullif(p->>'method', ''), 'flat'),
            v_tn, date_trunc('month', coalesce(nullif(p->>'start_month', '')::date, current_date))::date, coalesce(nullif(p->>'due_day', '')::int, 1),
            v_in, coalesce(nullif(p->>'paid_months', '')::int, 0), nullif(btrim(p->>'bank_pattern'), ''), nullif(p->>'note', ''))
    returning id into v;
  else
    update public.pk_fin_loans set name = btrim(p->>'name'), lender = nullif(btrim(p->>'lender'), ''), kind = coalesce(nullif(p->>'kind', ''), 'leasing'),
      unit_code = nullif(p->>'unit_code', ''), contract_no = nullif(btrim(p->>'contract_no'), ''), principal = nullif(v_pr, 0), rate_pct = coalesce(nullif(p->>'rate_pct', '')::numeric, 0),
      method = coalesce(nullif(p->>'method', ''), 'flat'), tenor_months = v_tn, start_month = date_trunc('month', coalesce(nullif(p->>'start_month', '')::date, start_month))::date,
      due_day = coalesce(nullif(p->>'due_day', '')::int, 1), installment = v_in,
      paid_months = coalesce(nullif(p->>'paid_months', '')::int, 0), bank_pattern = nullif(btrim(p->>'bank_pattern'), ''), note = nullif(p->>'note', ''),
      is_active = coalesce((p->>'is_active')::boolean, true) where id = v;
  end if;
  return v;
end $$;

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
          and public.pk_fin_loan_installment(ln) is not null
          and (ln.tenor_months is null or ((extract(year from age(date_trunc('month', d), ln.start_month)) * 12 + extract(month from age(date_trunc('month', d), ln.start_month)))::int) < ln.tenor_months);
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
