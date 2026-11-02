-- 034: notifikasi WA otomatis ke investor (lewat antrean WA Rentalaja App: pk_wa → notifications → wa-send/Fonnte).
-- Dikirim saat:
--   1) laporan bagi hasil dikunci (satu pesan per investor per periode, total semua investasinya)
--   2) penarikan disetujui / ditolak / ditransfer / gagal
-- Akun demo dan investor tanpa nomor WA dilewati. Fungsi portal investor tidak diubah; ini pemicu (trigger) terpisah.

create or replace function public.iv_rp(n numeric) returns text language sql immutable as $$
  select 'Rp' || replace(to_char(round(coalesce(n, 0)), 'FM999G999G999G999'), ',', '.')
$$;

create or replace function public.iv_bulan(d date) returns text language sql immutable as $$
  select (array['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'])[extract(month from d)::int]
    || ' ' || extract(year from d)::int
$$;

-- 1) laporan dikunci
create or replace function public.iv_notif_locked() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select i.wa, i.name, n.period,
      sum(n.share) filter (where n.kind <> 'modal') hasil, sum(n.share) filter (where n.kind = 'modal') modal
    from newrows n join public.iv_investors i on i.id = n.investor_id
    left join oldrows o on o.id = n.id
    where n.status = 'terkunci' and o.status is distinct from 'terkunci'
      and not coalesce(i.demo, false) and coalesce(btrim(i.wa), '') <> ''
    group by i.id, i.wa, i.name, n.period
  loop
    perform public.pk_wa(r.wa,
      'Halo ' || split_part(r.name, ' ', 1) || ', laporan investasi Pokama bulan ' || public.iv_bulan(r.period) || ' sudah final. '
      || initcap(left(concat_ws(' dan ',
           case when coalesce(r.hasil, 0) > 0 then 'bagi hasil ' || public.iv_rp(r.hasil) end,
           case when coalesce(r.modal, 0) > 0 then 'pengembalian modal ' || public.iv_rp(r.modal) end), 1))
      || substr(concat_ws(' dan ',
           case when coalesce(r.hasil, 0) > 0 then 'bagi hasil ' || public.iv_rp(r.hasil) end,
           case when coalesce(r.modal, 0) > 0 then 'pengembalian modal ' || public.iv_rp(r.modal) end), 2)
      || case when coalesce(r.hasil, 0) + coalesce(r.modal, 0) > 0 then ' sudah masuk ke saldo Anda. ' else 'Bulan ini belum ada bagi hasil yang masuk. ' end
      || 'Rincian dan penarikan: https://investor.pokama.org');
  end loop;
  return null;
end $$;

drop trigger if exists iv_statements_notif on public.iv_statements;
create trigger iv_statements_notif after update on public.iv_statements
  referencing old table as oldrows new table as newrows
  for each statement execute function public.iv_notif_locked();

-- 2) status penarikan
create or replace function public.iv_notif_withdrawal() returns trigger
language plpgsql security definer set search_path = public as $$
declare i public.iv_investors; msg text; sapa text;
begin
  if new.status is not distinct from old.status then return null; end if;
  select * into i from public.iv_investors where id = new.investor_id;
  if not found or coalesce(i.demo, false) or coalesce(btrim(i.wa), '') = '' then return null; end if;
  sapa := 'Halo ' || split_part(i.name, ' ', 1) || ', ';
  msg := case new.status
    when 'disetujui' then sapa || 'penarikan ' || public.iv_rp(new.amount) || ' sudah disetujui dan sedang diproses transfer ke ' || coalesce(new.bank_snapshot, 'rekening terdaftar') || '.'
    when 'ditolak' then sapa || 'penarikan ' || public.iv_rp(new.amount) || ' belum bisa diproses. Alasan: ' || coalesce(new.reason, '-') || '. Dana kembali ke saldo Anda dan bisa diajukan lagi.'
    when 'dibayar' then sapa || 'penarikan ' || public.iv_rp(new.amount) || ' sudah ditransfer ke ' || coalesce(new.bank_snapshot, 'rekening terdaftar') || '. No. referensi: ' || coalesce(new.ref, '-') || '.'
    when 'gagal' then sapa || 'transfer penarikan ' || public.iv_rp(new.amount) || ' gagal' || coalesce(' (' || new.reason || ')', '') || '. Dana kembali ke saldo Anda; tim Keuangan Pokama akan menghubungi Anda.'
  end;
  if msg is not null then perform public.pk_wa(i.wa, msg || ' https://investor.pokama.org'); end if;
  return null;
end $$;

drop trigger if exists iv_withdrawals_notif on public.iv_withdrawals;
create trigger iv_withdrawals_notif after update of status on public.iv_withdrawals
  for each row execute function public.iv_notif_withdrawal();

revoke execute on function public.iv_notif_locked() from public, anon, authenticated;
revoke execute on function public.iv_notif_withdrawal() from public, anon, authenticated;
