-- 035 · Email notifikasi Portal Investor (melengkapi WA di 034)
-- Investor (email Google-nya) mendapat email: akun dibuat, KYC terverifikasi/ditolak, rekening diganti, investasi aktif/selesai,
--   laporan bulanan final, penarikan diterima/disetujui/ditolak/ditransfer/gagal.
-- Staf mendapat notifikasi Sistem Kerja (lonceng + email seketika lewat pk-notify) untuk hal yang perlu tindakan:
--   persetujuan investasi, penarikan, laporan diajukan, minat baru, KYC baru, pengingat tutup buku tiap tanggal 1.
-- Antrean email investor: iv_mail, dikirim fungsi pk-notify (mode instant, tiap menit + dipicu langsung).
-- Akun investor demo tidak dikirimi email.

create table if not exists public.iv_mail (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid references public.iv_investors(id),
  to_email text not null,
  name text,
  kind text not null,
  subject text not null,
  heading text not null,
  intro text,
  rows jsonb not null default '[]',      -- [[label, nilai], ...]
  note text,
  cta_label text,
  cta_link text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  tries int not null default 0,
  error text
);
create index if not exists iv_mail_pending on public.iv_mail (created_at) where sent_at is null;
alter table public.iv_mail enable row level security;
revoke all on public.iv_mail from anon, authenticated;

-- ---------- pembantu ----------
create or replace function public.iv_kick_mail() returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.pk_notify_kick set last = now() where id = 1 and last < now() - interval '20 seconds';
  if found then
    perform net.http_post(url := 'https://shrvzlltysnbmgpkhjjg.supabase.co/functions/v1/pk-notify', body := '{"mode":"instant"}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb);
  end if;
exception when others then null;   -- email tidak boleh menggagalkan transaksi
end $$;

create or replace function public.iv_mail_q(p_inv uuid, p_kind text, p_subject text, p_heading text, p_intro text, p_rows jsonb, p_note text,
  p_cta_label text default 'Buka portal investor', p_cta_link text default 'https://investor.pokama.org', p_to text default null) returns void
language plpgsql security definer set search_path = public as $$
declare i public.iv_investors; em text;
begin
  select * into i from public.iv_investors where id = p_inv;
  if not found or coalesce(i.demo, false) then return; end if;
  em := lower(btrim(coalesce(p_to, i.email)));
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return; end if;
  insert into public.iv_mail(investor_id, to_email, name, kind, subject, heading, intro, rows, note, cta_label, cta_link)
  values (i.id, em, split_part(i.name, ' ', 1), p_kind, p_subject, p_heading, p_intro, coalesce(p_rows, '[]'), p_note, p_cta_label, p_cta_link);
  perform public.iv_kick_mail();
end $$;

-- diklaim pengirim (service role saja): ditandai terkirim dulu supaya tidak ganda
create or replace function public.iv_mail_claim(p_limit int default 200) returns setof public.iv_mail
language sql security definer set search_path = public as $$
  update public.iv_mail m set sent_at = now(), tries = tries + 1
   where m.id in (select id from public.iv_mail where sent_at is null and tries < 5 order by created_at limit p_limit for update skip locked)
  returning m.*;
$$;
create or replace function public.iv_mail_fail(p_id uuid, p_error text) returns void
language sql security definer set search_path = public as $$
  update public.iv_mail set sent_at = null, error = left(p_error, 500) where id = p_id;
$$;

-- notifikasi staf menurut peran: 'ceo' | 'keuangan' | 'bizdev'
create or replace function public.iv_staff_notify(p_target text, p_title text, p_body text, p_link text, p_urgent boolean) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  for pid in
    select p.id from public.pk_people p where p.is_active and (
      (p_target = 'ceo' and p.role = 'ceo') or (p_target = 'keuangan' and p.role = 'keuangan')
      or (p_target = 'bizdev' and p.id::text in (select jsonb_array_elements_text(coalesce((select value from public.af_settings where key = 'bizdev_ids'), '[]')))))
  loop
    perform public.pk_notify(pid, 'investor', p_title, p_body, p_link, p_urgent);
  end loop;
end $$;

create or replace function public.iv_terms(h public.iv_holdings) returns text language sql stable security definer set search_path = public as $$
  select case
    when h.jenis = 'aset' and h.rp_scheme = 'flat' then public.iv_rp(h.rp_flat) || ' per bulan'
    when h.jenis = 'aset' then replace(trim_scale(h.rate_pct)::text, '.', ',') || '% ' || case when h.rp_scheme = 'per_unit' then 'laba bersih unit' when h.rp_basis = 'gross' then 'pendapatan' else 'laba bersih' end
    when h.jenis = 'proyek' and h.return_model = 'imbal_tetap' then replace(trim_scale(h.rate_pct)::text, '.', ',') || '% per bulan dari modal'
    when h.jenis = 'proyek' then replace(trim_scale(h.rate_pct)::text, '.', ',') || '% laba proyek'
    else replace(trim_scale(h.rate_pct)::text, '.', ',') || '% kepemilikan' end
$$;
create or replace function public.iv_tgl(d date) returns text language sql immutable as $$
  select extract(day from d)::int || ' ' || public.iv_bulan(d)
$$;

-- ---------- investor: akun, KYC, rekening ----------
create or replace function public.iv_mail_investor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.iv_mail_q(new.id, 'akun', 'Akun investor Pokama Anda sudah siap', 'Selamat datang di Portal Investor Pokama',
      'Akun investor untuk ' || new.name || ' sudah dibuat. Masuk ke portal dengan tombol "Masuk dengan Google" memakai email ini. Di sana Anda bisa melihat hasil harian, laporan bulanan, dokumen perjanjian, dan menarik dana.',
      jsonb_build_array(jsonb_build_array('Email untuk masuk', new.email), jsonb_build_array('Alamat portal', 'investor.pokama.org')),
      'Tim Keuangan Pokama akan memverifikasi data diri (KTP, NPWP) dan rekening atas nama Anda sebelum penarikan pertama.',
      'Masuk ke portal investor');
    if not new.demo then
      perform public.iv_staff_notify('keuangan', 'KYC investor baru: ' || new.name, 'Lengkapi NIK, NPWP, dan rekening atas nama investor sebelum penarikan pertama.', 'investor#investor', false);
    end if;
    return new;
  end if;
  if new.kyc_status is distinct from old.kyc_status and new.kyc_status = 'terverifikasi' then
    perform public.iv_mail_q(new.id, 'kyc', 'Data diri dan rekening Anda sudah terverifikasi', 'Verifikasi selesai',
      'Data diri dan rekening Anda sudah diverifikasi tim Keuangan Pokama. Hasil yang sudah masuk saldo bisa ditarik dari menu Dana.',
      jsonb_build_array(jsonb_build_array('Rekening penerimaan', coalesce(new.bank_name, '-') || ' •••• ' || coalesce(new.bank_last4, '-')),
        jsonb_build_array('Atas nama', coalesce(new.bank_holder, new.name))), null, 'Lihat saldo saya', 'https://investor.pokama.org/#dana');
  elsif new.kyc_status is distinct from old.kyc_status and new.kyc_status = 'ditolak' then
    perform public.iv_mail_q(new.id, 'kyc', 'Verifikasi data investor perlu diperbaiki', 'Verifikasi belum bisa diselesaikan',
      'Data diri atau rekening Anda belum bisa diverifikasi. Tim Keuangan Pokama akan menghubungi Anda untuk melengkapinya.',
      case when coalesce(new.kyc_note, '') <> '' then jsonb_build_array(jsonb_build_array('Catatan', new.kyc_note)) else '[]'::jsonb end, null);
  end if;
  if old.bank_last4 is not null and (new.bank_last4 is distinct from old.bank_last4 or new.bank_name is distinct from old.bank_name) then
    perform public.iv_mail_q(new.id, 'rekening', 'Rekening penerimaan Anda diganti', 'Rekening penerimaan diganti',
      'Rekening tujuan penarikan dana Anda baru saja diganti oleh tim Keuangan Pokama.',
      jsonb_build_array(jsonb_build_array('Sebelumnya', coalesce(old.bank_name, '-') || ' •••• ' || old.bank_last4),
        jsonb_build_array('Sekarang', coalesce(new.bank_name, '-') || ' •••• ' || coalesce(new.bank_last4, '-'))),
      'Jika Anda tidak meminta perubahan ini, segera balas email ini atau hubungi CEO Pokama. Penarikan berikutnya akan ditransfer ke rekening yang baru.');
  end if;
  if lower(new.email) is distinct from lower(old.email) then
    perform public.iv_mail_q(new.id, 'akun', 'Email akun investor Pokama Anda diganti', 'Email masuk diganti',
      'Email untuk masuk ke Portal Investor Pokama diganti. Email ini tidak bisa lagi dipakai untuk masuk.',
      jsonb_build_array(jsonb_build_array('Email baru', new.email)),
      'Jika Anda tidak meminta perubahan ini, segera hubungi CEO Pokama.', null, null, old.email);
    perform public.iv_mail_q(new.id, 'akun', 'Akun investor Pokama sekarang memakai email ini', 'Email masuk Anda yang baru',
      'Mulai sekarang masuk ke Portal Investor Pokama dengan tombol "Masuk dengan Google" memakai email ini.', '[]'::jsonb, null, 'Masuk ke portal investor');
  end if;
  return new;
end $$;
create or replace trigger iv_investors_mail after insert or update on public.iv_investors
  for each row execute function public.iv_mail_investor();

-- ---------- investasi ----------
create or replace function public.iv_mail_holding() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv public.iv_investors; asker uuid; asker_ceo boolean; info text;
begin
  if new.status is not distinct from old.status or new.demo then return new; end if;
  select * into inv from public.iv_investors where id = new.investor_id;
  info := inv.name || ' · ' || public.iv_unit_name(new.unit_code) || ' · modal ' || public.iv_rp(new.principal) || ' · ' || public.iv_terms(new);
  asker := coalesce(new.submitted_by, new.created_by);
  asker_ceo := coalesce((select role = 'ceo' from public.pk_people where id = asker), false);
  if new.status = 'menunggu' then
    perform public.iv_staff_notify(case when asker_ceo then 'keuangan' else 'ceo' end, 'Persetujuan investasi: ' || new.title, info, 'investor#investasi', true);
  elsif new.status = 'ditolak' then
    perform public.pk_notify(asker, 'investor', 'Investasi ditolak: ' || new.title, 'Alasan: ' || coalesce(new.reject_reason, '-') || '. Perbaiki lalu ajukan lagi.', 'investor#investasi', true);
  elsif new.status = 'aktif' then
    perform public.pk_notify(asker, 'investor', 'Investasi disetujui: ' || new.title, info, 'investor#investasi', false);
    perform public.iv_mail_q(new.investor_id, 'investasi', 'Investasi Anda sudah aktif: ' || new.title, 'Investasi Anda sudah aktif',
      'Perjanjian sudah disetujui. Mulai hari ini perkembangannya bisa Anda pantau di Portal Investor Pokama.',
      jsonb_build_array(jsonb_build_array('Investasi', new.title), jsonb_build_array('Unit bisnis', public.iv_unit_name(new.unit_code)),
        jsonb_build_array('Modal', public.iv_rp(new.principal)), jsonb_build_array('Ketentuan', public.iv_terms(new)),
        jsonb_build_array('Mulai', public.iv_tgl(new.started_on))) || case when new.ends_on is not null then jsonb_build_array(jsonb_build_array('Berakhir', public.iv_tgl(new.ends_on))) else '[]'::jsonb end
        || case when new.jenis = 'aset' then jsonb_build_array(jsonb_build_array('Jumlah unit', cardinality(new.rp_unit_ids)::text)) else '[]'::jsonb end,
      case when new.jenis = 'aset' then 'Hasil per unit dihitung otomatis setiap hari dari pembayaran sewa yang lunas.'
           when new.jenis = 'proyek' and new.return_model = 'imbal_tetap' then 'Imbal hasil dihitung harian dan menjadi final setiap tutup buku bulanan.'
           else 'Bagian Anda dihitung saat tutup buku dan dikirim lewat email ini setiap kali laporan final.' end,
      'Lihat investasi', 'https://investor.pokama.org/#inv/' || new.id);
  elsif new.status = 'selesai' then
    perform public.iv_mail_q(new.investor_id, 'investasi', 'Investasi selesai: ' || new.title, 'Investasi Anda sudah selesai',
      'Investasi berikut sudah diakhiri. Laporan dan hasil yang sudah masuk tetap bisa Anda lihat di portal.',
      jsonb_build_array(jsonb_build_array('Investasi', new.title), jsonb_build_array('Berakhir', public.iv_tgl(coalesce(new.ends_on, (now() at time zone 'Asia/Jakarta')::date)))),
      null, 'Lihat riwayat', 'https://investor.pokama.org/#investasi');
  end if;
  return new;
end $$;
create or replace trigger iv_holdings_mail after update of status on public.iv_holdings
  for each row execute function public.iv_mail_holding();

-- ---------- laporan bulanan ----------
create or replace function public.iv_mail_statements() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  -- diajukan → yang berhak mengunci
  for r in
    select n.period, n.submitted_by, count(*) n, sum(n.share) tot,
      coalesce((select role = 'ceo' from public.pk_people where id = n.submitted_by), false) by_ceo
    from newrows n left join oldrows o on o.id = n.id
    join public.iv_holdings h on h.id = n.holding_id
    where n.status = 'diajukan' and o.status is distinct from 'diajukan' and not h.demo
    group by n.period, n.submitted_by
  loop
    perform public.iv_staff_notify(case when r.by_ceo then 'keuangan' else 'ceo' end,
      'Kunci laporan investor ' || public.iv_bulan(r.period), r.n || ' laporan bagi hasil diajukan, total bagian investor ' || public.iv_rp(r.tot) || '. Setelah dikunci masuk saldo investor.',
      'investor#bagihasil', true);
  end loop;
  -- terkunci → email ke investor (satu per investor per bulan)
  for r in
    select n.investor_id, n.period,
      jsonb_agg(jsonb_build_array(h.title || ' · ' || case n.kind when 'dividen' then 'dividen' when 'modal' then 'pengembalian modal' else 'bagi hasil' end, public.iv_rp(n.share)) order by h.title) lines,
      coalesce(sum(n.share) filter (where n.kind <> 'modal'), 0) hasil, coalesce(sum(n.share) filter (where n.kind = 'modal'), 0) modal
    from newrows n left join oldrows o on o.id = n.id
    join public.iv_holdings h on h.id = n.holding_id
    where n.status = 'terkunci' and o.status is distinct from 'terkunci'
    group by n.investor_id, n.period
  loop
    perform public.iv_mail_q(r.investor_id, 'laporan', 'Laporan investasi ' || public.iv_bulan(r.period) || ' sudah final',
      'Laporan ' || public.iv_bulan(r.period) || ' sudah final',
      case when r.hasil + r.modal > 0 then 'Bagian Anda bulan ini sudah masuk ke saldo dan bisa ditarik dari portal.' else 'Laporan bulan ini sudah dikunci. Bulan ini belum ada bagian yang masuk ke saldo.' end,
      r.lines || jsonb_build_array(jsonb_build_array('Total bagi hasil', public.iv_rp(r.hasil)))
        || case when r.modal > 0 then jsonb_build_array(jsonb_build_array('Pengembalian modal', public.iv_rp(r.modal))) else '[]'::jsonb end
        || jsonb_build_array(jsonb_build_array('Saldo bisa ditarik', public.iv_rp((public.iv_balance(r.investor_id)->>'withdrawable')::numeric))),
      'Rincian per unit dan versi PDF ada di menu Laporan.', 'Lihat laporan', 'https://investor.pokama.org/#laporan');
  end loop;
  return null;
end $$;
create or replace trigger iv_statements_mail after update on public.iv_statements
  referencing old table as oldrows new table as newrows
  for each statement execute function public.iv_mail_statements();

-- ---------- penarikan ----------
create or replace function public.iv_mail_withdrawal() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv public.iv_investors; rows jsonb;
begin
  select * into inv from public.iv_investors where id = new.investor_id;
  if inv.demo then return new; end if;
  rows := jsonb_build_array(jsonb_build_array('Nominal', public.iv_rp(new.amount)), jsonb_build_array('Ke rekening', new.bank_snapshot));
  if tg_op = 'INSERT' then
    perform public.iv_mail_q(new.investor_id, 'penarikan', 'Permintaan penarikan ' || public.iv_rp(new.amount) || ' kami terima', 'Permintaan penarikan diterima',
      'Permintaan penarikan Anda sedang menunggu persetujuan. Kami kabari lagi lewat email saat disetujui dan saat sudah ditransfer.', rows,
      'Jika Anda tidak mengajukan penarikan ini, segera hubungi CEO Pokama.', 'Lihat status', 'https://investor.pokama.org/#dana');
    perform public.iv_staff_notify('ceo', 'Penarikan investor: ' || inv.name || ' ' || public.iv_rp(new.amount), 'Ke ' || new.bank_snapshot || '. Setujui atau tolak di panel investor.', 'investor#penarikan', true);
    return new;
  end if;
  if new.status is not distinct from old.status then return new; end if;
  if new.status = 'disetujui' then
    perform public.iv_mail_q(new.investor_id, 'penarikan', 'Penarikan ' || public.iv_rp(new.amount) || ' disetujui', 'Penarikan disetujui',
      'Penarikan Anda sudah disetujui dan sedang diproses transfer oleh tim Keuangan, biasanya 1–3 hari kerja.', rows, null, 'Lihat status', 'https://investor.pokama.org/#dana');
    perform public.iv_staff_notify('keuangan', 'Transfer penarikan investor: ' || inv.name || ' ' || public.iv_rp(new.amount),
      'Sudah disetujui CEO. Transfer ke ' || new.bank_snapshot || ', lalu tandai ditransfer dengan nomor referensi.', 'investor#penarikan', true);
  elsif new.status = 'ditolak' then
    perform public.iv_mail_q(new.investor_id, 'penarikan', 'Penarikan ' || public.iv_rp(new.amount) || ' belum bisa diproses', 'Penarikan belum bisa diproses',
      'Dana kembali ke saldo Anda dan bisa diajukan lagi.', rows || jsonb_build_array(jsonb_build_array('Alasan', coalesce(new.reason, '-'))), null, 'Buka menu Dana', 'https://investor.pokama.org/#dana');
  elsif new.status = 'dibayar' then
    perform public.iv_mail_q(new.investor_id, 'penarikan', 'Penarikan ' || public.iv_rp(new.amount) || ' sudah ditransfer', 'Dana sudah ditransfer',
      'Penarikan Anda sudah ditransfer. Mohon cek mutasi rekening Anda.', rows || jsonb_build_array(jsonb_build_array('No. referensi', coalesce(new.ref, '-')),
        jsonb_build_array('Tanggal', public.iv_tgl((coalesce(new.paid_at, now()) at time zone 'Asia/Jakarta')::date))),
      'Jika dana belum masuk dalam 1×24 jam, balas email ini.', 'Lihat riwayat', 'https://investor.pokama.org/#dana');
  elsif new.status = 'gagal' then
    perform public.iv_mail_q(new.investor_id, 'penarikan', 'Transfer penarikan ' || public.iv_rp(new.amount) || ' gagal', 'Transfer gagal',
      'Transfer penarikan Anda gagal dan dana kembali ke saldo. Tim Keuangan Pokama akan menghubungi Anda.', rows || jsonb_build_array(jsonb_build_array('Keterangan', coalesce(new.reason, '-'))),
      null, 'Buka menu Dana', 'https://investor.pokama.org/#dana');
  end if;
  return new;
end $$;
create or replace trigger iv_withdrawals_mail after insert or update of status on public.iv_withdrawals
  for each row execute function public.iv_mail_withdrawal();

-- ---------- minat baru ----------
create or replace function public.iv_mail_lead() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.iv_staff_notify('bizdev',
    'Minat investor baru: ' || new.name || case when new.source = 'investor' then ' (investor)' else '' end,
    concat_ws(' · ', coalesce((select title from public.iv_offers where id = new.offer_id), public.iv_unit_name(new.unit_code)),
      case when new.amount_hint is not null then 'kisaran ' || public.iv_rp(new.amount_hint) end, nullif(new.note, ''),
      case when new.wa is not null then 'WA +' || new.wa end),
    'investor#peluang', true);
  return new;
end $$;
create or replace trigger iv_leads_mail after insert on public.iv_leads
  for each row execute function public.iv_mail_lead();

-- ---------- pengingat tutup buku (tanggal 1, 08.30 WIB) ----------
create or replace function public.iv_close_reminder() returns void
language plpgsql security definer set search_path = public as $$
declare prev date := (public.iv_month() - interval '1 month')::date; n int;
begin
  select count(*) into n from public.iv_holdings h where h.status in ('aktif','selesai') and not h.demo and h.started_on < public.iv_month()
    and coalesce(h.ends_on, 'infinity'::date) >= prev
    and not exists (select 1 from public.iv_statements s where s.holding_id = h.id and s.period = prev and s.status = 'terkunci');
  if n = 0 then return; end if;
  perform public.iv_staff_notify('keuangan', 'Tutup buku investor ' || public.iv_bulan(prev),
    n || ' investasi belum dikunci. Tekan Hitung otomatis, isi laba proyek dan dividen, lalu ajukan ke CEO.', 'investor#bagihasil', true);
end $$;
select cron.schedule('iv-tutup-buku', '30 1 1 * *', 'select public.iv_close_reminder()');

revoke execute on function public.iv_kick_mail(), public.iv_mail_q(uuid, text, text, text, text, jsonb, text, text, text, text),
  public.iv_mail_claim(int), public.iv_mail_fail(uuid, text), public.iv_staff_notify(text, text, text, text, boolean),
  public.iv_terms(public.iv_holdings), public.iv_mail_investor(), public.iv_mail_holding(), public.iv_mail_statements(),
  public.iv_mail_withdrawal(), public.iv_mail_lead(), public.iv_close_reminder() from public, anon, authenticated;
grant execute on function public.iv_mail_claim(int), public.iv_mail_fail(uuid, text) to service_role;
