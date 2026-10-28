-- 018c: Rentalaja App jadi sumber data operasional; pembukuan pindah sepenuhnya ke Pokama.
-- Mesin akuntansi Rentalaja App (trigger t_fin_*) DINONAKTIFKAN (bukan dihapus; bisa dinyalakan lagi).
-- Pokama memasang trigger sendiri di tabel operasional Rentalaja: pembayaran, booking, biaya, kas, tagihan, kasbon, selisih shift, bagi hasil mitra.
-- Akun pengantar booking: 2-20200 "Uang muka pelanggan". Bayar → kredit; pendapatan diakui → debit. Saldo per booking > 0 = DP, < 0 = piutang.

insert into public.pk_fin_maps(key, account_code, note) values
  ('rev:RA:hub','4-40001',null), ('rev:RA:transportation','4-40002',null), ('rev:RA:stay','4-40003',null), ('rev:RA:experience','4-40003',null),
  ('rev:RA:trip','4-40004',null), ('rev:RA:car_driver','4-40006',null), ('rev:RA:corporate','4-40007',null), ('rev:RA:delivery','4-40005',null),
  ('rev:RA:late_fee','7-70001',null), ('rev:RA:damage','7-70002',null), ('rev:RA:cancel','7-70003','DP hangus'),
  ('cash:RA:tunai','1-10001','Tunai Rentalaja tanpa cabang'), ('cash:GK:tunai','1-10001',null), ('cash:WN:tunai','1-10002',null),
  ('cash:BD:tunai','1-10003',null), ('cash:EX:tunai','1-10004',null), ('cash:JP:tunai','1-10004',null),
  ('cash:card','1-10021',null), ('cash:link','1-10021',null),
  ('ap','2-20100','Hutang usaha'), ('employee_ar','1-10101','Kasbon & selisih kas karyawan'),
  ('partner_cost','5-50003',null), ('partner_payable','2-20300',null), ('partner_pay','1-10011','Pembayar bagi hasil mitra'),
  ('kasbon_pay','1-10011','Pembayar kasbon staf cabang')
on conflict (key) do nothing;

-- akun Rentalaja → akun grup (kode sama; akun baru di Rentalaja otomatis ikut)
create or replace function public.pk_fin_ra_acc(p uuid) returns text
language plpgsql security definer set search_path = public as $$
declare a public.accounts;
begin
  select * into a from public.accounts where id = p;
  if a.id is null then return null; end if;
  insert into public.pk_fin_accounts(code, name, is_cash) values (a.code, a.name, a.is_cash) on conflict (code) do nothing;
  return a.code;
end $$;

-- saldo uang muka satu booking menurut buku Pokama (+ DP, − piutang)
create or replace function public.pk_fin_ra_dp(p_booking uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum((payload->>'dp')::numeric), 0) from public.pk_fin_events
  where source = 'rentalaja' and status = 'terposting' and payload->>'booking_id' = p_booking::text
$$;

-- ===== pengakuan pendapatan booking (dan penyesuaiannya) =====
create or replace function public.pk_fin_ra_booking(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b public.bookings; u text; base numeric; wsum numeric; lines jsonb := '[]'::jsonb; r record; tot numeric := 0; ext text; n int; dpacc text;
begin
  select * into b from public.bookings where id = p_id;
  if b.id is null then return null; end if;
  if not (b.status::text in ('active','returned','completed') or (b.line::text = 'experience' and b.status::text = 'confirmed' and b.start_at <= now())) then return null; end if;
  u := public.pk_fin_ra_unit(b.branch_id);
  dpacc := public.pk_fin_map('dp', u, null);
  base := coalesce(b.total, 0) - coalesce(b.delivery_fee, 0);
  select coalesce(sum(bi.line_total), 0) into wsum from public.booking_items bi where bi.booking_id = b.id and bi.status::text <> 'released';
  for r in
    with want as (
      select case c.kind when 'stay' then 'stay' when 'trip' then 'trip' when 'car_driver' then 'car_driver' else b.line::text end k,
             sum(bi.line_total) * base / wsum amt
      from public.booking_items bi join public.products p on p.id = bi.product_id join public.categories c on c.id = p.category_id
      where wsum > 0 and bi.booking_id = b.id and bi.status::text <> 'released' group by 1
      union all select b.line::text, base where wsum = 0
      union all select 'delivery', coalesce(b.delivery_fee, 0)
      union all select 'late_fee', coalesce(b.late_fee, 0)
      union all select 'damage', coalesce(b.damage_fee, 0)),
    w as (select k, sum(amt) amt from want group by k),
    have as (
      select l.memo k, sum(l.credit - l.debit) amt from public.pk_fin_lines l join public.pk_fin_entries e on e.id = l.entry_id
      where e.source = 'rentalaja' and e.status = 'posted' and e.source_ref like 'RA-REV-' || b.code || '-%' and l.account_code is distinct from dpacc
      group by l.memo)
    select coalesce(w.k, have.k) k, round(coalesce(w.amt, 0) - coalesce(have.amt, 0), 2) delta from w full join have on have.k = w.k
  loop
    if abs(r.delta) < 1 then continue; end if;
    lines := lines || jsonb_build_object('map', 'rev', 'key', r.k, 'label', 'pendapatan Rentalaja ' || r.k, 'credit', greatest(r.delta, 0), 'debit', greatest(-r.delta, 0), 'memo', r.k);
    tot := tot + r.delta;
  end loop;
  if jsonb_array_length(lines) = 0 then return null; end if;
  lines := lines || jsonb_build_object('map', 'dp', 'label', 'uang muka pelanggan (DP)', 'debit', greatest(tot, 0), 'credit', greatest(-tot, 0), 'memo', 'Booking ' || b.code);
  -- pakai ulang kejadian yang masih gagal supaya tidak dobel setelah diperbaiki
  select external_id into ext from public.pk_fin_events where source = 'rentalaja' and external_id like 'RA-REV-' || b.code || '-%' and status in ('baru','gagal') limit 1;
  if ext is null then
    select count(*) into n from public.pk_fin_events where source = 'rentalaja' and external_id like 'RA-REV-' || b.code || '-%';
    ext := 'RA-REV-' || b.code || '-' || (n + 1);
  end if;
  return public.pk_fin_emit('rentalaja', ext, 'journal',
    case when ext like '%-1' then (coalesce(b.actual_start_at, b.start_at, now()) at time zone 'Asia/Jakarta')::date else public.pk_today() end, u, abs(tot),
    jsonb_build_object('lines', lines, 'booking_id', b.id, 'dp', -tot,
      'memo', case when ext like '%-1' then 'Pendapatan diakui · ' else 'Penyesuaian pendapatan · ' end || b.code || coalesce(' · ' || b.guest_name, '')));
end $$;

-- ===== booking batal: DP yang tidak direfund menjadi pendapatan pembatalan =====
create or replace function public.pk_fin_ra_cancel(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b public.bookings; u text; dep numeric; ref numeric; amt numeric; n int;
begin
  select * into b from public.bookings where id = p_id;
  if b.id is null or b.status::text not in ('cancelled','no_show','expired') then return null; end if;
  if exists (select 1 from public.pk_fin_events where source = 'rentalaja' and external_id like 'RA-REV-' || b.code || '-%' and status = 'terposting') then return null; end if;
  dep := public.pk_fin_ra_dp(b.id);
  select coalesce(sum(a.amount), 0) into ref from public.approvals a
   where a.ref_type = 'booking' and a.ref_id = b.id and a.kind = 'refund'
     and (a.status = 'pending' or (a.status = 'approved' and not exists (select 1 from public.payments pm where pm.booking_id = b.id and pm.kind = 'refund' and pm.status = 'paid')));
  amt := round(dep - ref, 2);
  if amt <= 0 then return null; end if;
  u := public.pk_fin_ra_unit(b.branch_id);
  select count(*) into n from public.pk_fin_events where source = 'rentalaja' and external_id like 'RA-BATAL-' || b.code || '-%' and status = 'terposting';
  return public.pk_fin_emit('rentalaja', 'RA-BATAL-' || b.code || '-' || (n + 1), 'journal', public.pk_today(), u, amt,
    jsonb_build_object('booking_id', b.id, 'dp', -amt, 'memo', 'DP hangus · ' || b.code,
      'lines', jsonb_build_array(jsonb_build_object('map', 'dp', 'label', 'uang muka pelanggan (DP)', 'debit', amt, 'memo', 'Booking ' || b.code),
                                 jsonb_build_object('map', 'rev', 'key', 'cancel', 'label', 'pendapatan pembatalan', 'credit', amt, 'memo', 'cancel'))));
end $$;

create or replace function public.pk_fin_ra_on_booking() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.status::text in ('active','returned','completed','confirmed')
       and (old.status is distinct from new.status or old.total is distinct from new.total or old.late_fee is distinct from new.late_fee
            or old.damage_fee is distinct from new.damage_fee or old.delivery_fee is distinct from new.delivery_fee) then
      perform public.pk_fin_ra_booking(new.id);
    elsif new.status::text in ('cancelled','no_show','expired') and old.status is distinct from new.status then
      perform public.pk_fin_ra_cancel(new.id);
    end if;
  exception when others then raise warning 'pk_fin_ra_on_booking: %', sqlerrm;
  end;
  return null;
end $$;

-- ===== pembayaran pelanggan & refund =====
create or replace function public.pk_fin_ra_on_payment() returns trigger
language plpgsql security definer set search_path = public as $$
declare b public.bookings; u text; ch text; d date;
begin
  if new.status <> 'paid' or (tg_op = 'UPDATE' and old.status = 'paid') or coalesce(new.amount, 0) <= 0 then return null; end if;
  begin
    if new.booking_id is not null then select * into b from public.bookings where id = new.booking_id; end if;
    u := public.pk_fin_ra_unit(coalesce(new.branch_id, b.branch_id));
    ch := case when new.method = 'cash' then 'tunai' else coalesce(new.method, 'transfer') end;
    d := (coalesce(new.paid_at, now()) at time zone 'Asia/Jakarta')::date;
    if new.kind = 'refund' then
      perform public.pk_fin_emit('rentalaja', 'RA-PAY-' || coalesce(new.code, new.id::text), 'journal', d, u, new.amount,
        jsonb_build_object('booking_id', b.id, 'dp', -new.amount, 'memo', 'Refund ' || coalesce(b.code, new.code, ''),
          'lines', jsonb_build_array(jsonb_build_object('map', 'dp', 'label', 'uang muka pelanggan (DP)', 'debit', new.amount, 'memo', 'Refund ' || coalesce(b.code, '')),
                                     jsonb_build_object('map', 'cash', 'key', ch, 'label', 'rekening kanal ' || ch, 'credit', new.amount))));
    elsif b.id is null then
      perform public.pk_fin_emit('rentalaja', 'RA-PAY-' || coalesce(new.code, new.id::text), 'sale.paid', d, u, new.amount,
        jsonb_build_object('channel', ch, 'category', 'corporate', 'memo', 'Pembayaran tagihan ' || coalesce(new.code, '')));
    else
      perform public.pk_fin_emit('rentalaja', 'RA-PAY-' || coalesce(new.code, new.id::text), 'deposit.received', d, u, new.amount,
        jsonb_build_object('channel', ch, 'booking_id', b.id, 'dp', new.amount,
          'memo', 'Pembayaran ' || b.code || ' · ' || new.kind || ' · ' || coalesce(new.method, '') || coalesce(' · ' || b.guest_name, '')));
    end if;
  exception when others then raise warning 'pk_fin_ra_on_payment: %', sqlerrm;
  end;
  return null;
end $$;

-- ===== biaya, kas, tagihan pembelian yang dicatat di Rentalaja App =====
create or replace function public.pk_fin_ra_on_expense() returns trigger
language plpgsql security definer set search_path = public as $$
declare l jsonb; lines jsonb := '[]'::jsonb; u text; cr text;
begin
  if new.status not in ('posted','unpaid') or (tg_op = 'UPDATE' and old.status in ('posted','unpaid')) then return null; end if;
  begin
    u := public.pk_fin_ra_unit((new.lines->0->>'branch_id')::uuid);
    for l in select * from jsonb_array_elements(coalesce(new.lines, '[]'::jsonb)) loop
      lines := lines || jsonb_build_object('account', public.pk_fin_ra_acc((l->>'account_id')::uuid), 'unit', public.pk_fin_ra_unit((l->>'branch_id')::uuid),
                                           'debit', (l->>'amount')::numeric, 'memo', l->>'desc');
    end loop;
    cr := case when new.status = 'unpaid' or new.method = 'later' then null else public.pk_fin_ra_acc(new.pay_from_account) end;
    lines := lines || case when cr is null then jsonb_build_object('map', 'ap', 'label', 'hutang usaha', 'credit', new.total)
                           else jsonb_build_object('account', cr, 'credit', new.total) end;
    perform public.pk_fin_emit('rentalaja', 'RA-BY-' || coalesce(new.code, new.id::text), 'journal', new.expense_date, u, new.total,
      jsonb_build_object('lines', lines, 'memo', 'Biaya ' || coalesce(new.code, '') || coalesce(' · ' || new.payee, ''), 'proof_url', new.receipt_path));
  exception when others then raise warning 'pk_fin_ra_on_expense: %', sqlerrm;
  end;
  return null;
end $$;

create or replace function public.pk_fin_ra_on_cash_tx() returns trigger
language plpgsql security definer set search_path = public as $$
declare l jsonb; lines jsonb := '[]'::jsonb; u text; acc text;
begin
  if new.status <> 'posted' or (tg_op = 'UPDATE' and old.status = 'posted') then return null; end if;
  begin
    u := public.pk_fin_ra_unit(new.branch_id); acc := public.pk_fin_ra_acc(new.account_id);
    if new.kind = 'transfer' then
      lines := jsonb_build_array(jsonb_build_object('account', public.pk_fin_ra_acc(new.counter_account_id), 'debit', new.total),
                                 jsonb_build_object('account', acc, 'credit', new.total));
      for l in select * from jsonb_array_elements(coalesce(new.lines, '[]'::jsonb)) loop
        if coalesce((l->>'amount')::numeric, 0) = 0 then continue; end if;
        lines := lines || jsonb_build_array(jsonb_build_object('account', public.pk_fin_ra_acc((l->>'account_id')::uuid), 'debit', (l->>'amount')::numeric, 'memo', l->>'desc'),
                                            jsonb_build_object('account', acc, 'credit', (l->>'amount')::numeric));
      end loop;
    else
      for l in select * from jsonb_array_elements(coalesce(new.lines, '[]'::jsonb)) loop
        if coalesce((l->>'amount')::numeric, 0) = 0 then continue; end if;
        lines := lines || jsonb_build_object('account', public.pk_fin_ra_acc((l->>'account_id')::uuid), 'unit', public.pk_fin_ra_unit(coalesce((l->>'branch_id')::uuid, new.branch_id)),
          case when new.kind = 'receive' then 'credit' else 'debit' end, (l->>'amount')::numeric, 'memo', l->>'desc');
      end loop;
      lines := lines || jsonb_build_object('account', acc, case when new.kind = 'receive' then 'debit' else 'credit' end, new.total);
    end if;
    perform public.pk_fin_emit('rentalaja', 'RA-KAS-' || coalesce(new.code, new.id::text), 'journal', new.tx_date, u, new.total,
      jsonb_build_object('lines', lines, 'memo', coalesce(new.memo, 'Transaksi kas ' || coalesce(new.code, '')), 'proof_url', new.attachment_path));
  exception when others then raise warning 'pk_fin_ra_on_cash_tx: %', sqlerrm;
  end;
  return null;
end $$;

create or replace function public.pk_fin_ra_on_bill() returns trigger
language plpgsql security definer set search_path = public as $$
declare l jsonb; lines jsonb := '[]'::jsonb; u text;
begin
  if new.status not in ('unpaid','overdue','paid') or (tg_op = 'UPDATE' and old.status in ('unpaid','overdue','paid')) then return null; end if;
  begin
    u := public.pk_fin_ra_unit(new.branch_id);
    for l in select * from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) loop
      lines := lines || jsonb_build_object('account', public.pk_fin_ra_acc((l->>'account_id')::uuid), 'unit', public.pk_fin_ra_unit(coalesce((l->>'branch_id')::uuid, new.branch_id)),
                                           'debit', (l->>'amount')::numeric, 'memo', l->>'desc');
    end loop;
    lines := lines || jsonb_build_object('map', 'ap', 'label', 'hutang usaha', 'credit', new.total);
    perform public.pk_fin_emit('rentalaja', 'RA-PI-' || coalesce(new.code, new.id::text), 'journal', new.bill_date, u, new.total,
      jsonb_build_object('lines', lines, 'memo', 'Tagihan pembelian ' || coalesce(new.code, ''), 'proof_url', new.attachment_path));
  exception when others then raise warning 'pk_fin_ra_on_bill: %', sqlerrm;
  end;
  return null;
end $$;

-- ===== kasbon staf cabang, selisih kas shift, bagi hasil mitra =====
create or replace function public.pk_fin_ra_on_misc() returns trigger
language plpgsql security definer set search_path = public as $$
declare u text; amt numeric;
begin
  begin
    if tg_table_name = 'cash_advances' and new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
      perform public.pk_fin_emit('rentalaja', 'RA-KB-' || new.id, 'journal', public.pk_today(), 'RA', new.amount,
        jsonb_build_object('memo', 'Kasbon staf' || coalesce(' · ' || new.reason, ''), 'lines', jsonb_build_array(
          jsonb_build_object('map', 'employee_ar', 'label', 'piutang karyawan', 'debit', new.amount),
          jsonb_build_object('map', 'kasbon_pay', 'label', 'rekening pembayar kasbon', 'credit', new.amount))));
    elsif tg_table_name = 'shifts' and new.status = 'closed' and old.status is distinct from 'closed' and coalesce(new.cash_diff, 0) < 0 then
      amt := -new.cash_diff; u := public.pk_fin_ra_unit(new.branch_id);
      perform public.pk_fin_emit('rentalaja', 'RA-SK-' || new.id, 'journal', (coalesce(new.closed_at, now()) at time zone 'Asia/Jakarta')::date, u, amt,
        jsonb_build_object('memo', 'Selisih kurang kas shift' || coalesce(' · ' || new.diff_note, ''), 'lines', jsonb_build_array(
          jsonb_build_object('map', 'employee_ar', 'label', 'piutang karyawan', 'debit', amt),
          jsonb_build_object('map', 'cash', 'key', 'tunai', 'label', 'kas tunai cabang', 'credit', amt))));
    elsif tg_table_name = 'partner_statements' and new.status in ('locked','paid') and old.status not in ('locked','paid') and coalesce(new.share, 0) > 0 then
      perform public.pk_fin_emit('rentalaja', 'RA-BH-' || new.id, 'journal', ((new.period || '-01')::date + interval '1 month - 1 day')::date, 'RA', new.share,
        jsonb_build_object('memo', 'Bagi hasil mitra ' || coalesce((select name from public.partners where id = new.partner_id), '') || ' · ' || new.period,
          'lines', jsonb_build_array(jsonb_build_object('map', 'partner_cost', 'label', 'beban bagi hasil mitra', 'debit', new.share),
                                     jsonb_build_object('map', 'partner_payable', 'label', 'hutang bagi hasil mitra', 'credit', new.share))));
    elsif tg_table_name = 'partner_withdrawals' and new.status = 'paid' and old.status is distinct from 'paid' then
      perform public.pk_fin_emit('rentalaja', 'RA-BHC-' || new.id, 'journal', (coalesce(new.paid_at, now()) at time zone 'Asia/Jakarta')::date, 'RA', new.amount,
        jsonb_build_object('memo', 'Pencairan bagi hasil ' || coalesce((select name from public.partners where id = new.partner_id), ''),
          'lines', jsonb_build_array(jsonb_build_object('map', 'partner_payable', 'label', 'hutang bagi hasil mitra', 'debit', new.amount),
                                     jsonb_build_object('map', 'partner_pay', 'label', 'rekening pembayar bagi hasil', 'credit', new.amount))));
    end if;
  exception when others then raise warning 'pk_fin_ra_on_misc: %', sqlerrm;
  end;
  return null;
end $$;

-- ===== pasang trigger Pokama, matikan mesin akuntansi Rentalaja App =====
drop trigger if exists pk_fin_ra_booking on public.bookings;
create trigger pk_fin_ra_booking after update on public.bookings for each row execute function public.pk_fin_ra_on_booking();
drop trigger if exists pk_fin_ra_payment on public.payments;
create trigger pk_fin_ra_payment after insert or update of status on public.payments for each row execute function public.pk_fin_ra_on_payment();
drop trigger if exists pk_fin_ra_expense on public.expenses;
create trigger pk_fin_ra_expense after insert or update of status on public.expenses for each row execute function public.pk_fin_ra_on_expense();
drop trigger if exists pk_fin_ra_cash_tx on public.cash_transactions;
create trigger pk_fin_ra_cash_tx after insert or update of status on public.cash_transactions for each row execute function public.pk_fin_ra_on_cash_tx();
drop trigger if exists pk_fin_ra_bill on public.purchase_bills;
create trigger pk_fin_ra_bill after insert or update of status on public.purchase_bills for each row execute function public.pk_fin_ra_on_bill();
drop trigger if exists pk_fin_ra_advance on public.cash_advances;
create trigger pk_fin_ra_advance after insert or update of status on public.cash_advances for each row execute function public.pk_fin_ra_on_misc();
drop trigger if exists pk_fin_ra_shift on public.shifts;
create trigger pk_fin_ra_shift after update of status on public.shifts for each row execute function public.pk_fin_ra_on_misc();
drop trigger if exists pk_fin_ra_partner_st on public.partner_statements;
create trigger pk_fin_ra_partner_st after update of status on public.partner_statements for each row execute function public.pk_fin_ra_on_misc();
drop trigger if exists pk_fin_ra_partner_wd on public.partner_withdrawals;
create trigger pk_fin_ra_partner_wd after update of status on public.partner_withdrawals for each row execute function public.pk_fin_ra_on_misc();

alter table public.bookings disable trigger t_fin_booking;
alter table public.payments disable trigger t_fin_payment;
alter table public.expenses disable trigger t_fin_expense;
alter table public.cash_transactions disable trigger t_fin_cash_tx;
alter table public.purchase_bills disable trigger t_fin_bill;
alter table public.cash_advances disable trigger t_fin_advance;
alter table public.shifts disable trigger t_fin_shift;
alter table public.partner_statements disable trigger t_fin_partner_statement;
alter table public.partner_withdrawals disable trigger t_fin_partner_withdrawal;
-- t_fin_approval tetap hidup: ia menjalankan alur persetujuan (status biaya, pembuatan pembayaran refund), bukan pembukuan.
-- t_fin_guard_expense tetap hidup: validasi isian biaya.

update public.pk_fin_sources set name = 'Rentalaja App (rentalaja.co.id)', kind = 'database',
  note = 'Otomatis dari pembayaran, booking, biaya, kas, tagihan, kasbon, selisih shift, bagi hasil mitra. Mesin akuntansi Rentalaja App dimatikan.'
 where code = 'rentalaja';

revoke execute on function public.pk_fin_ra_booking(uuid), public.pk_fin_ra_cancel(uuid), public.pk_fin_ra_acc(uuid), public.pk_fin_ra_dp(uuid),
  public.pk_fin_ra_on_booking(), public.pk_fin_ra_on_payment(), public.pk_fin_ra_on_expense(), public.pk_fin_ra_on_cash_tx(),
  public.pk_fin_ra_on_bill(), public.pk_fin_ra_on_misc() from public, anon, authenticated;
