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
  select coalesce(sum(case when left(acc, 1) in ('5','6','8') then debit - credit else 0 end), 0) / 3 into burn
    from _fl where d >= (date_trunc('month', t) - interval '3 months')::date and d < date_trunc('month', t)::date;

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
