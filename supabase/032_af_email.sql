-- 032: Email Program Mitra — notifikasi otomatis ke mitra, campaign email, berhenti langganan, dan notifikasi staf untuk kejadian mitra.
-- Pengiriman lewat edge function af-mail (Brevo, kunci yang sama dengan email Sistem Kerja). Mitra DEMO tidak pernah dikirimi email.

-- ================= kolom & tabel =================
alter table public.af_notifs add column if not exists emailed_at timestamptz, add column if not exists email_error text;
alter table public.af_partners add column if not exists campaign_optout boolean not null default false,
  add column if not exists mail_token uuid not null default gen_random_uuid();

create table if not exists public.af_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  segment jsonb not null default '{}'::jsonb,
  status text not null default 'draf' check (status in ('draf','terjadwal','mengirim','selesai','dibatalkan')),
  scheduled_at timestamptz,
  n_target int not null default 0, n_sent int not null default 0, n_fail int not null default 0,
  demo boolean not null default false,
  created_by uuid, created_at timestamptz not null default now(),
  sent_by uuid, sent_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.af_campaign_sends (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.af_campaigns(id) on delete cascade,
  partner_id uuid references public.af_partners(id) on delete set null,
  to_email text not null,
  is_test boolean not null default false,
  status text not null default 'antre' check (status in ('antre','terkirim','gagal','simulasi')),
  error text, sent_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists ix_af_campaign_sends_queue on public.af_campaign_sends (status, created_at) where status = 'antre';
create index if not exists ix_af_campaign_sends_campaign on public.af_campaign_sends (campaign_id);
create index if not exists ix_af_notifs_mail on public.af_notifs (created_at) where emailed_at is null and not demo;

do $d$ declare t text; begin
  foreach t in array array['af_campaigns','af_campaign_sends'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'tolak_semua') then
      execute format('create policy tolak_semua on public.%I as restrictive for all to anon, authenticated using (false) with check (false)', t);
    end if;
  end loop;
end $d$;

-- ================= sasaran campaign =================
-- segment: {"status":"aktif"|"semua", "city":"Garut", "kind":"penginapan", "idle":true, "produktif":true}
create or replace function public.af_campaign_pick(p_segment jsonb, p_demo boolean) returns setof public.af_partners
language sql stable security definer set search_path = public as $$
  select x.* from public.af_partners x
  where x.demo = p_demo and x.email is not null and x.email like '%@%' and not x.campaign_optout
    and (case coalesce(p_segment->>'status', 'aktif') when 'semua' then x.status in ('aktif','nonaktif','menunggu') else x.status = coalesce(p_segment->>'status', 'aktif') end)
    and (coalesce(p_segment->>'city', '') = '' or x.city = p_segment->>'city')
    and (coalesce(p_segment->>'kind', '') = '' or x.kind = p_segment->>'kind')
    and (coalesce((p_segment->>'idle')::boolean, false) = false
         or not exists (select 1 from public.af_bookings b where b.partner_id = x.id and b.booked_at > now() - interval '30 day'))
    and (coalesce((p_segment->>'produktif')::boolean, false) = false
         or exists (select 1 from public.af_bookings b where b.partner_id = x.id and b.bk_status = 'selesai' and b.completed_at > now() - interval '90 day'))
$$;
revoke execute on function public.af_campaign_pick(jsonb, boolean) from public, anon, authenticated;

create or replace function public.af_campaign_targets(p_segment jsonb, p_demo boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.af_need_view();
  return jsonb_build_object(
    'n', (select count(*) from public.af_campaign_pick(p_segment, p_demo)),
    'optout', (select count(*) from public.af_partners x where x.demo = p_demo and x.campaign_optout),
    'no_email', (select count(*) from public.af_partners x where x.demo = p_demo and (x.email is null or x.email not like '%@%')),
    'sample', (select coalesce(jsonb_agg(coalesce(nullif(q.org, ''), q.name) order by q.name), '[]'::jsonb) from (select * from public.af_campaign_pick(p_segment, p_demo) limit 8) q));
end $$;

-- ================= simpan, kirim, batal =================
create or replace function public.af_campaign_save(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id', '')::uuid; c public.af_campaigns;
begin
  if not public.af_is_biz() then raise exception 'Hanya BizDev atau Owner'; end if;
  if length(btrim(coalesce(p->>'subject', ''))) < 3 then raise exception 'Judul email belum diisi'; end if;
  if length(btrim(coalesce(p->>'body', ''))) < 10 then raise exception 'Isi email terlalu pendek'; end if;
  if length(p->>'body') > 8000 then raise exception 'Isi email terlalu panjang (maks 8000 huruf)'; end if;
  if v_id is not null then
    select * into c from public.af_campaigns where id = v_id;
    if c.id is null then raise exception 'Campaign tidak ditemukan'; end if;
    if c.status not in ('draf','terjadwal') then raise exception 'Campaign yang sudah dikirim tidak bisa diubah'; end if;
    update public.af_campaigns set subject = left(btrim(p->>'subject'), 160), body = p->>'body', segment = coalesce(p->'segment', '{}'::jsonb), updated_at = now()
      where id = v_id;
  else
    insert into public.af_campaigns(subject, body, segment, demo, created_by)
    values (left(btrim(p->>'subject'), 160), p->>'body', coalesce(p->'segment', '{}'::jsonb), coalesce((p->>'demo')::boolean, false), public.pk_me())
    returning id into v_id;
  end if;
  insert into public.af_audit(by_person, actor, action, target, reason, data)
  values (public.pk_me(), auth.uid(), 'campaign_simpan', v_id::text, left(p->>'subject', 120), jsonb_build_object('segment', p->'segment'));
  return v_id;
end $$;

-- kirim uji ke email staf yang sedang masuk
create or replace function public.af_campaign_test(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare em text;
begin
  if not public.af_is_biz() then raise exception 'Hanya BizDev atau Owner'; end if;
  select email into em from public.pk_people where id = public.pk_me();
  if em is null then raise exception 'Email Anda belum terdaftar di Tim & Peran'; end if;
  insert into public.af_campaign_sends(campaign_id, to_email, is_test) values (p_id, em, true);
  return em;
end $$;

-- p_when null = kirim sekarang
create or replace function public.af_campaign_send(p_id uuid, p_when timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.af_campaigns; n int;
begin
  if not public.af_is_biz() then raise exception 'Hanya BizDev atau Owner'; end if;
  select * into c from public.af_campaigns where id = p_id for update;
  if c.id is null then raise exception 'Campaign tidak ditemukan'; end if;
  if c.status not in ('draf','terjadwal') then raise exception 'Campaign ini sudah dikirim'; end if;
  if p_when is not null and p_when < now() + interval '5 minute' then raise exception 'Jadwal minimal 5 menit dari sekarang'; end if;
  if p_when is not null then
    update public.af_campaigns set status = 'terjadwal', scheduled_at = p_when, sent_by = public.pk_me(), updated_at = now() where id = p_id;
    insert into public.af_audit(by_person, actor, action, target, reason, data)
    values (public.pk_me(), auth.uid(), 'campaign_jadwal', p_id::text, c.subject, jsonb_build_object('jadwal', p_when));
    return jsonb_build_object('status', 'terjadwal', 'at', p_when);
  end if;
  insert into public.af_campaign_sends(campaign_id, partner_id, to_email, status)
  select c.id, x.id, x.email, case when c.demo then 'simulasi' else 'antre' end from public.af_campaign_pick(c.segment, c.demo) x;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Tidak ada penerima untuk sasaran ini'; end if;
  update public.af_campaigns set status = case when c.demo then 'selesai' else 'mengirim' end, n_target = n, sent_by = public.pk_me(),
    sent_at = now(), scheduled_at = null, updated_at = now() where id = p_id;
  insert into public.af_audit(by_person, actor, action, target, reason, data)
  values (public.pk_me(), auth.uid(), 'campaign_kirim', p_id::text, c.subject, jsonb_build_object('penerima', n, 'demo', c.demo));
  return jsonb_build_object('status', case when c.demo then 'simulasi' else 'mengirim' end, 'n', n);
end $$;

create or replace function public.af_campaign_cancel(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.af_is_biz() then raise exception 'Hanya BizDev atau Owner'; end if;
  update public.af_campaigns set status = 'dibatalkan', updated_at = now() where id = p_id and status in ('draf','terjadwal');
  if not found then raise exception 'Hanya draf atau jadwal yang bisa dibatalkan'; end if;
  insert into public.af_audit(by_person, actor, action, target) values (public.pk_me(), auth.uid(), 'campaign_batal', p_id::text);
end $$;

create or replace function public.af_campaign_list(p_demo boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.af_need_view();
  return jsonb_build_object(
    'rows', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'subject', c.subject, 'body', c.body, 'segment', c.segment, 'status', c.status,
        'scheduled_at', c.scheduled_at, 'sent_at', c.sent_at, 'created_at', c.created_at, 'n_target', c.n_target,
        'n_sent', (select count(*) from public.af_campaign_sends s where s.campaign_id = c.id and not s.is_test and s.status in ('terkirim','simulasi')),
        'n_fail', (select count(*) from public.af_campaign_sends s where s.campaign_id = c.id and not s.is_test and s.status = 'gagal'),
        'n_queue', (select count(*) from public.af_campaign_sends s where s.campaign_id = c.id and not s.is_test and s.status = 'antre'),
        'by', (select coalesce(nickname, name) from public.pk_people where id = coalesce(c.sent_by, c.created_by))) order by c.created_at desc), '[]'::jsonb)
      from public.af_campaigns c where c.demo = p_demo),
    'notif_mail', jsonb_build_object(
      'terkirim_7h', (select count(*) from public.af_notifs where not demo and emailed_at > now() - interval '7 day' and email_error is null),
      'gagal_7h', (select count(*) from public.af_notifs where not demo and emailed_at > now() - interval '7 day' and email_error is not null),
      'antre', (select count(*) from public.af_notifs where not demo and emailed_at is null)),
    'is_biz', public.af_is_biz());
end $$;

-- ================= preferensi mitra =================
create or replace function public.af_mail_pref(p_optout boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare me uuid := public.af_my_partner();
begin
  if me is null then raise exception 'Akun mitra tidak ditemukan'; end if;
  update public.af_partners set campaign_optout = coalesce(p_optout, false) where id = me;
  return coalesce(p_optout, false);
end $$;
create or replace function public.af_mail_prefs_get() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('campaign_optout', campaign_optout, 'email', email) from public.af_partners where id = public.af_my_partner()
$$;

-- ================= untuk pengirim (service_role saja) =================
create or replace function public.af_mail_claim_notifs(p_limit int default 40) returns jsonb
language sql security definer set search_path = public as $$
  with c as (
    update public.af_notifs n set emailed_at = now()
    where n.id in (select id from public.af_notifs where emailed_at is null and not demo and created_at > now() - interval '3 day'
                   order by id limit p_limit for update skip locked)
    returning n.*)
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'kind', c.kind, 'text', c.text, 'email', x.email,
      'name', x.name, 'org', x.org, 'code', x.code, 'token', x.mail_token)), '[]'::jsonb)
  from c join public.af_partners x on x.id = c.partner_id
$$;
create or replace function public.af_mail_notif_result(p_id bigint, p_error text) returns void
language sql security definer set search_path = public as $$
  update public.af_notifs set email_error = left(p_error, 300) where id = p_id
$$;

create or replace function public.af_mail_claim_sends(p_limit int default 40) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  -- campaign terjadwal yang sudah waktunya → isi antrean
  insert into public.af_campaign_sends(campaign_id, partner_id, to_email, status)
  select c.id, x.id, x.email, 'antre' from public.af_campaigns c cross join lateral public.af_campaign_pick(c.segment, c.demo) x
   where c.status = 'terjadwal' and c.scheduled_at <= now() and not c.demo;
  update public.af_campaigns c set status = 'mengirim', sent_at = now(),
    n_target = (select count(*) from public.af_campaign_sends s where s.campaign_id = c.id and not s.is_test)
   where c.status = 'terjadwal' and c.scheduled_at <= now();
  -- klaim antrean
  with q as (
    update public.af_campaign_sends s set status = 'terkirim', sent_at = now()
    where s.id in (select id from public.af_campaign_sends where status = 'antre' order by is_test desc, id limit p_limit for update skip locked)
    returning s.*)
  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'to', q.to_email, 'test', q.is_test, 'subject', c.subject, 'body', c.body,
      'name', coalesce(x.name, (select coalesce(nickname, name) from public.pk_people where email = q.to_email limit 1), 'Mitra'),
      'org', x.org, 'code', coalesce(x.code, 'KODEANDA'), 'city', x.city, 'token', x.mail_token)), '[]'::jsonb) into r
  from q join public.af_campaigns c on c.id = q.campaign_id left join public.af_partners x on x.id = q.partner_id;
  -- campaign yang antreannya habis → selesai
  update public.af_campaigns c set status = 'selesai', updated_at = now()
   where c.status = 'mengirim' and not exists (select 1 from public.af_campaign_sends s where s.campaign_id = c.id and s.status = 'antre');
  return r;
end $$;
create or replace function public.af_mail_send_result(p_id bigint, p_error text) returns void
language sql security definer set search_path = public as $$
  update public.af_campaign_sends set status = case when p_error is null then 'terkirim' else 'gagal' end, error = left(p_error, 300) where id = p_id
$$;
create or replace function public.af_mail_optout(p_token uuid) returns text
language sql security definer set search_path = public as $$
  update public.af_partners set campaign_optout = true where mail_token = p_token returning coalesce(nullif(org, ''), name)
$$;

-- ================= notifikasi staf untuk kejadian mitra (lewat email Sistem Kerja) =================
create or replace function public.af_staff_notify(p_who text, p_title text, p_body text, p_link text) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  for pid in
    select p.id from public.pk_people p where p.is_active and (
      (p_who in ('biz','semua') and (p.role = 'ceo' or p.id::text in (select jsonb_array_elements_text(coalesce((public.af_set('bizdev_ids'))::jsonb, '[]'::jsonb)))))
      or (p_who in ('fin','semua') and p.role in ('keuangan','ceo')))
  loop
    perform public.pk_notify(pid, 'mitra', p_title, p_body, p_link, true);
  end loop;
end $$;

create or replace function public.af_trg_staff_partner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.demo then return new; end if;
  if tg_op = 'INSERT' and new.status = 'menunggu' then
    perform public.af_staff_notify('biz', 'Pendaftar mitra baru: ' || coalesce(nullif(new.org, ''), new.name),
      coalesce(new.kind, '') || ' · ' || coalesce(new.city, '') || '. Cek data & hubungi lewat WA, lalu setujui atau tolak.', 'affiliate#pendaftar');
  elsif tg_op = 'UPDATE' and new.bank_new_at is not null and old.bank_new_at is null then
    perform public.af_staff_notify('fin', 'Mitra mengganti rekening: ' || coalesce(nullif(new.org, ''), new.name),
      'Rekening baru ditahan 3 hari setelah dikonfirmasi lewat WA. Pastikan tidak ada pencairan ke rekening lama yang tertunda.', 'affiliate#cair');
  end if;
  return new;
end $$;
drop trigger if exists af_staff_partner on public.af_partners;
create trigger af_staff_partner after insert or update of status, bank_new_at on public.af_partners
  for each row execute function public.af_trg_staff_partner();

create or replace function public.af_trg_staff_payout() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; tot numeric; per date;
begin
  select count(*), coalesce(sum(net), 0), max(period) into n, tot, per from new_rows where not demo and status = 'diajukan';
  if n > 0 then
    perform public.af_staff_notify('fin', 'Rekap komisi mitra siap disetujui: ' || n || ' mitra',
      'Total ' || to_char(tot, 'FM999G999G999') || ' (periode ' || to_char(per, 'MM/YYYY') || '). Setujui lalu transfer paling lambat tanggal 10.', 'affiliate#cair');
  end if;
  return null;
end $$;
drop trigger if exists af_staff_payout on public.af_payouts;
create trigger af_staff_payout after insert on public.af_payouts referencing new table as new_rows
  for each statement execute function public.af_trg_staff_payout();

create or replace function public.af_trg_staff_freeze() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.demo and new.frozen and not coalesce(old.frozen, false) then
    perform public.af_staff_notify('fin', 'Komisi mitra dibekukan: booking ' || new.booking_id,
      coalesce(new.frozen_reason, 'Perlu dicek') || '. Putuskan lanjut atau hangus di menu Pencairan.', 'affiliate#cair');
  end if;
  return new;
end $$;
drop trigger if exists af_staff_freeze on public.af_bookings;
create trigger af_staff_freeze after update of frozen on public.af_bookings
  for each row execute function public.af_trg_staff_freeze();

-- ================= hak jalan =================
revoke execute on function public.af_mail_claim_notifs(int), public.af_mail_notif_result(bigint, text), public.af_mail_claim_sends(int),
  public.af_mail_send_result(bigint, text), public.af_mail_optout(uuid), public.af_staff_notify(text, text, text, text),
  public.af_trg_staff_partner(), public.af_trg_staff_payout(), public.af_trg_staff_freeze() from public, anon, authenticated;
grant execute on function public.af_mail_claim_notifs(int), public.af_mail_notif_result(bigint, text), public.af_mail_claim_sends(int),
  public.af_mail_send_result(bigint, text), public.af_mail_optout(uuid) to service_role;
revoke execute on function public.af_campaign_targets(jsonb, boolean), public.af_campaign_save(jsonb), public.af_campaign_test(uuid),
  public.af_campaign_send(uuid, timestamptz), public.af_campaign_cancel(uuid), public.af_campaign_list(boolean),
  public.af_mail_pref(boolean), public.af_mail_prefs_get() from public, anon;
grant execute on function public.af_campaign_targets(jsonb, boolean), public.af_campaign_save(jsonb), public.af_campaign_test(uuid),
  public.af_campaign_send(uuid, timestamptz), public.af_campaign_cancel(uuid), public.af_campaign_list(boolean),
  public.af_mail_pref(boolean), public.af_mail_prefs_get() to authenticated;

-- notifikasi lama (sebelum email aktif) tidak dikirim ulang
update public.af_notifs set emailed_at = now(), email_error = 'sebelum email aktif' where emailed_at is null;
