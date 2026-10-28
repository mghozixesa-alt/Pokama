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
      insert into public.pk_omzet(unit_code, day, amount, note, source) values (u, e.event_date, amt::bigint, 'Otomatis ' || e.source || ' · ' || e.external_id, 'integrasi');
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
  for e in select b.id from public.bookings b
           where (b.status::text in ('active','returned','completed') or (b.line::text = 'experience' and b.status::text = 'confirmed' and b.start_at <= now()))
             and not exists (select 1 from public.pk_fin_events x where x.source = 'rentalaja' and x.external_id like 'RA-REV-' || b.code || '-%' and x.status = 'terposting')
           limit 500 loop
    perform public.pk_fin_ra_booking(e.id);
  end loop;
  for e in select b.id from public.bookings b where b.status::text in ('cancelled','no_show','expired') and b.updated_at > now() - interval '60 days' loop
    perform public.pk_fin_ra_cancel(e.id);
  end loop;
  r := r || jsonb_build_object('mutasi', public.pk_fin_bank_match(null));
  select count(*) into n from public.pk_fin_events where status = 'gagal';
  n := n + (select count(*) from public.pk_fin_bank_lines where status = 'baru');
  if n > 0 then
    for f in select id from public.pk_people where role = 'keuangan' and is_active loop
      perform public.pk_notify(f, 'keuangan', n || ' transaksi keuangan perlu dicek', 'Akun belum dipetakan atau mutasi bank belum dikenali', '#/keuangan?tab=cek', false);
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
