-- pk_051 · Omzet KKH otomatis dari pembayaran Rentalaja (saat uang masuk) · 11 Nov 2026
-- Sudah diterapkan ke proyek Supabase shrvzlltysnbmgpkhjjg (migrasi pk_omzet_dari_rentalaja).
-- Aturan: omzet unit per hari = total pembayaran lunas (DP + pelunasan + lainnya) dikurangi refund, menurut tanggal bayar WIB.
-- Pemetaan cabang Rentalaja -> unit KKH: GRT->GK, BDG-HUB/BDG-JKL->BD, WNR->WN, RM/ERT/DDH->EX, JEEP->JP, MPT->MP, LPA->NL.
-- Pergi Piknik (PPK) belum dipetakan.
-- Mati otomatis kalau pk_fin_sources 'rentalaja' sudah aktif + feeds_omzet (setelah cutover keuangan), supaya tidak dobel.

create table if not exists public.pk_omzet_branch_map (
  branch_id uuid primary key references public.branches(id),
  unit_code text not null references public.pk_units(code),
  note text);
alter table public.pk_omzet_branch_map enable row level security;
revoke all on public.pk_omzet_branch_map from anon, authenticated;

insert into public.pk_omzet_branch_map(branch_id, unit_code, note)
select b.id, m.u, b.name from public.branches b join (values
  ('GRT','GK'), ('BDG-HUB','BD'), ('BDG-JKL','BD'), ('WNR','WN'),
  ('RM','EX'), ('ERT','EX'), ('DDH','EX'), ('JEEP','JP'), ('MPT','MP'), ('LPA','NL')) m(c, u) on m.c = b.code
on conflict (branch_id) do update set unit_code = excluded.unit_code;

create or replace function app.pk_omzet_recalc(p_unit text, p_day date)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v bigint;
begin
  if p_unit is null or p_day is null then return; end if;
  if exists (select 1 from public.pk_fin_sources where code = 'rentalaja' and is_active and feeds_omzet) then return; end if;
  select greatest(coalesce(sum(case when p.kind = 'refund' then -p.amount else p.amount end), 0), 0)::bigint into v
  from public.payments p
  left join public.bookings b on b.id = p.booking_id
  join public.pk_omzet_branch_map m on m.branch_id = coalesce(p.branch_id, b.branch_id)
  where m.unit_code = p_unit and p.status = 'paid' and p.paid_at is not null
    and (p.paid_at at time zone 'Asia/Jakarta')::date = p_day;
  if v = 0 then
    delete from public.pk_omzet where unit_code = p_unit and day = p_day and source = 'app';
  else
    insert into public.pk_omzet(unit_code, day, amount, note, source)
    values (p_unit, p_day, v, 'Otomatis dari pembayaran Rentalaja (uang masuk, dikurangi refund)', 'app')
    on conflict (unit_code, day, source) do update set amount = excluded.amount, note = excluded.note;
  end if;
end $$;
revoke all on function app.pk_omzet_recalc(text, date) from public, anon, authenticated;

create or replace function app.pk_omzet_on_payment()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare u text; d date;
begin
  begin
    if tg_op in ('UPDATE','DELETE') and old.status = 'paid' and old.paid_at is not null then
      select m.unit_code into u from public.pk_omzet_branch_map m
       where m.branch_id = coalesce(old.branch_id, (select branch_id from public.bookings where id = old.booking_id));
      perform app.pk_omzet_recalc(u, (old.paid_at at time zone 'Asia/Jakarta')::date);
    end if;
    if tg_op in ('INSERT','UPDATE') and new.status = 'paid' and new.paid_at is not null then
      select m.unit_code into u from public.pk_omzet_branch_map m
       where m.branch_id = coalesce(new.branch_id, (select branch_id from public.bookings where id = new.booking_id));
      d := (new.paid_at at time zone 'Asia/Jakarta')::date;
      perform app.pk_omzet_recalc(u, d);
    end if;
  exception when others then
    raise warning 'pk_omzet_on_payment: %', sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists t_pk_omzet on public.payments;
create trigger t_pk_omzet after insert or update of status, amount, paid_at, kind, branch_id or delete on public.payments
  for each row execute function app.pk_omzet_on_payment();

do $$ declare r record; begin
  for r in select distinct m.unit_code u, (p.paid_at at time zone 'Asia/Jakarta')::date d
           from public.payments p left join public.bookings b on b.id = p.booking_id
           join public.pk_omzet_branch_map m on m.branch_id = coalesce(p.branch_id, b.branch_id)
           where p.status = 'paid' and p.paid_at >= '2026-11-01 00:00+07' loop
    perform app.pk_omzet_recalc(r.u, r.d);
  end loop;
end $$;
