-- 009: notifikasi email (penting langsung + ringkasan pagi)
alter table public.pk_people add column if not exists notify_email boolean not null default true;
alter table public.pk_people add column if not exists last_digest date;

create table if not exists public.pk_notifications (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.pk_people(id),
  kind text not null,                 -- tugas | review | rab | kkh | cuti | permintaan
  title text not null,
  body text,
  link text,                          -- hash route, mis. #/belanja?r=...
  urgent boolean not null default false,
  created_at timestamptz not null default now(),
  emailed_at timestamptz,
  read_at timestamptz
);
create index if not exists pk_notif_pending on public.pk_notifications(person_id, emailed_at);
alter table public.pk_notifications enable row level security;
create policy pk_notif_r on public.pk_notifications for select using (person_id = public.pk_me());
create policy pk_notif_u on public.pk_notifications for update using (person_id = public.pk_me()) with check (person_id = public.pk_me());
grant select, update (read_at) on public.pk_notifications to authenticated;

create or replace function public.pk_notify(p_person uuid, p_kind text, p_title text, p_body text, p_link text, p_urgent boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_person is null then return; end if;
  if p_person = public.pk_me() then return; end if;          -- tidak memberi tahu diri sendiri
  if not exists (select 1 from public.pk_people where id = p_person and is_active) then return; end if;
  insert into public.pk_notifications(person_id, kind, title, body, link, urgent) values (p_person, p_kind, p_title, p_body, p_link, coalesce(p_urgent, false));
end $$;
revoke execute on function public.pk_notify(uuid, text, text, text, text, boolean) from public, anon, authenticated;

create or replace function public.pk_nick(p uuid) returns text language sql stable security definer set search_path = public as $$
  select coalesce(nickname, name, '—') from public.pk_people where id = p $$;

-- ===== tugas & review =====
create or replace function public.pk_ntf_tasks() returns trigger language plpgsql security definer set search_path = public as $$
declare lk text := '#/tugas?t=' || new.id;
begin
  if tg_op = 'INSERT' then
    if new.pic_id is distinct from new.created_by then
      perform public.pk_notify(new.pic_id, 'tugas', 'Tugas baru: ' || new.title, 'Dari ' || public.pk_nick(new.created_by) || coalesce(' · tenggat ' || to_char(new.due, 'DD/MM'), ''), lk, true);
    end if;
    return new;
  end if;
  if new.pic_id is distinct from old.pic_id then
    perform public.pk_notify(new.pic_id, 'tugas', 'Tugas diberikan ke Anda: ' || new.title, coalesce('Tenggat ' || to_char(new.due, 'DD/MM'), null), lk, true);
  end if;
  if new.status is distinct from old.status then
    if new.status = 'review' then
      perform public.pk_notify(new.reviewer_id, 'review', 'Perlu Anda cek: ' || new.title, public.pk_nick(new.pic_id) || ' mengajukan hasil (v' || new.version || ')', '#/review?tab=cek&t=' || new.id, true);
    elsif new.status = 'revisi' then
      perform public.pk_notify(new.pic_id, 'review', 'Diminta revisi: ' || new.title, 'Dari ' || public.pk_nick(new.reviewer_id) || coalesce(' · tenggat revisi ' || to_char(new.revise_due, 'DD/MM'), ''), '#/review?tab=saya&t=' || new.id, true);
    elsif new.status = 'done' then
      perform public.pk_notify(new.pic_id, 'review', 'Disetujui selesai: ' || new.title, 'Oleh ' || public.pk_nick(new.reviewer_id), lk, false);
    end if;
  end if;
  return new;
end $$;
create or replace trigger pk_ntf_tasks after insert or update on public.pk_tasks for each row execute function public.pk_ntf_tasks();

-- ===== belanja (RAB) =====
create or replace function public.pk_ntf_rab() returns trigger language plpgsql security definer set search_path = public as $$
declare lk text := '#/belanja?r=' || new.id; amt text := 'Rp' || to_char(new.total, 'FM999G999G999G999'); f uuid;
begin
  if new.status = 'diajukan' and (tg_op = 'INSERT' or old.status is distinct from 'diajukan' or old.step is distinct from new.step) then
    perform public.pk_notify(new.chain[new.step + 1], 'rab', 'RAB menunggu persetujuan Anda: ' || new.title, new.code || ' · ' || amt || ' · diajukan ' || public.pk_nick(new.created_by), '#/belanja?tab=setujui&r=' || new.id, true);
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'revisi' then
      perform public.pk_notify(new.created_by, 'rab', 'RAB diminta revisi: ' || new.title, coalesce(new.note, ''), lk, true);
    elsif new.status = 'ditolak' then
      perform public.pk_notify(new.created_by, 'rab', 'RAB ditolak: ' || new.title, coalesce(new.note, ''), lk, true);
    elsif new.status = 'siap_cair' then
      perform public.pk_notify(new.created_by, 'rab', 'RAB disetujui: ' || new.title, new.code || ' · ' || amt || ' · menunggu pencairan Keuangan', lk, false);
      for f in select id from public.pk_people where role = 'keuangan' and is_active loop
        perform public.pk_notify(f, 'rab', 'RAB siap dicairkan: ' || new.title, new.code || ' · ' || amt || ' · ' || public.pk_nick(new.created_by), '#/belanja?tab=keuangan&r=' || new.id, true);
      end loop;
    elsif new.status = 'cair' then
      perform public.pk_notify(new.created_by, 'rab', 'Dana RAB sudah cair: ' || new.title, new.code || ' · ' || amt || ' · upload nota paling lambat ' || public.pk_setting_num('lpj_days', 2) || ' hari', lk, true);
    elsif new.status = 'lpj' then
      for f in select id from public.pk_people where role = 'keuangan' and is_active loop
        perform public.pk_notify(f, 'rab', 'Nota masuk, perlu dicek: ' || new.title, new.code || ' · realisasi Rp' || to_char(coalesce(new.realisasi, 0), 'FM999G999G999G999'), '#/belanja?tab=keuangan&r=' || new.id, false);
      end loop;
    elsif new.status = 'selesai' then
      perform public.pk_notify(new.created_by, 'rab', 'RAB selesai: ' || new.title, new.code, lk, false);
    end if;
  end if;
  return new;
end $$;
create or replace trigger pk_ntf_rab after insert or update on public.pk_rab for each row execute function public.pk_ntf_rab();

-- ===== KKH: di-tag tim =====
create or replace function public.pk_ntf_kkh() returns trigger language plpgsql security definer set search_path = public as $$
declare org uuid;
begin
  if new.tag_of is not null and (tg_op = 'INSERT' or old.tag_of is distinct from new.tag_of) then
    select person_id into org from public.pk_kkh where id = new.tag_of;
    perform public.pk_notify(new.person_id, 'kkh', public.pk_nick(org) || ' men-tag Anda di KKH', to_char(new.day, 'DD/MM') || ' · ' || lpad(new.hour::text, 2, '0') || '.00 · ' || new.code || coalesce(' · ' || new.note, ''),
      '#/kkh?d=' || new.day, new.day <= public.pk_today() + 1);
  end if;
  return new;
end $$;
create or replace trigger pk_ntf_kkh after insert or update of tag_of on public.pk_kkh for each row execute function public.pk_ntf_kkh();

-- ===== kehadiran: cuti / izin / libur =====
create or replace function public.pk_ntf_leave() returns trigger language plpgsql security definer set search_path = public as $$
declare boss uuid; ks uuid; lbl text := case new.kind when 'cuti' then 'Cuti' when 'izin' then 'Izin' else 'Libur' end;
  rng text := to_char(new.day, 'DD/MM') || case when new.end_day is not null and new.end_day <> new.day then ' – ' || to_char(new.end_day, 'DD/MM') else '' end;
begin
  if tg_op = 'INSERT' and new.status = 'diajukan' then
    select boss_id into boss from public.pk_people where id = new.person_id;
    if boss is null then select id into boss from public.pk_people where role = 'kepala_staf' and is_active limit 1; end if;
    perform public.pk_notify(boss, 'cuti', lbl || ' ' || public.pk_nick(new.person_id) || ' perlu disetujui', rng, '#/kehadiran', new.kind <> 'libur');
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('disetujui', 'ditolak') then
    perform public.pk_notify(new.person_id, 'cuti', lbl || ' Anda ' || new.status, rng || ' · oleh ' || public.pk_nick(new.decided_by), '#/kehadiran', new.status = 'ditolak');
  end if;
  return new;
end $$;
create or replace trigger pk_ntf_leave after insert or update on public.pk_leave for each row execute function public.pk_ntf_leave();

-- ===== permintaan bantuan =====
create or replace function public.pk_ntf_req() returns trigger language plpgsql security definer set search_path = public as $$
declare a uuid; lk text := '#/permintaan?r=' || new.id;
begin
  if tg_op = 'INSERT' or (new.status = 'baru' and old.status is distinct from 'baru') then
    for a in select id from public.pk_people where role = 'kepala_staf' and is_active loop
      perform public.pk_notify(a, 'permintaan', 'Permintaan baru perlu dipilah: ' || new.title, 'Dari ' || public.pk_nick(new.from_id) || ' → ' || new.to_team, '#/permintaan?tab=pilah&r=' || new.id, true);
    end loop;
  elsif new.status is distinct from old.status then
    if new.status = 'diterima' then
      perform public.pk_notify(new.pic_id, 'permintaan', 'Permintaan diberikan ke Anda: ' || new.title, 'Dari ' || public.pk_nick(new.from_id) || ' · terima untuk jadikan tugas', '#/permintaan?tab=untuk&r=' || new.id, true);
      perform public.pk_notify(new.from_id, 'permintaan', 'Permintaan Anda diberikan ke ' || public.pk_nick(new.pic_id), new.title, lk, false);
    elsif new.status in ('ditolak', 'ditunda', 'diperjelas') then
      perform public.pk_notify(new.from_id, 'permintaan', 'Permintaan ' || case new.status when 'diperjelas' then 'perlu diperjelas' else new.status end || ': ' || new.title, coalesce(new.reason, ''), lk, new.status = 'diperjelas');
    elsif new.status = 'jadi_tugas' then
      perform public.pk_notify(new.from_id, 'permintaan', 'Permintaan Anda sudah jadi tugas: ' || new.title, 'Dikerjakan ' || public.pk_nick(new.pic_id), lk, false);
    end if;
  end if;
  return new;
end $$;
create or replace trigger pk_ntf_req after insert or update on public.pk_requests for each row execute function public.pk_ntf_req();

revoke execute on function public.pk_ntf_tasks(), public.pk_ntf_rab(), public.pk_ntf_kkh(), public.pk_ntf_leave(), public.pk_ntf_req() from public, anon, authenticated;

-- ===== isi ringkasan pagi per orang (dipakai pengirim email) =====
create or replace function public.pk_digest_items(p uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'review', (select count(*) from public.pk_tasks where reviewer_id = p and status = 'review'),
    'revisi', (select count(*) from public.pk_tasks where pic_id = p and status = 'revisi'),
    'revisi_telat', (select count(*) from public.pk_tasks where pic_id = p and status = 'revisi' and revise_due < public.pk_today()),
    'tenggat', (select count(*) from public.pk_tasks where pic_id = p and status in ('todo','doing') and due <= public.pk_today() + 1),
    'rab', (select count(*) from public.pk_rab where status = 'diajukan' and chain[step + 1] = p),
    'nota_telat', (select count(*) from public.pk_rab where created_by = p and status = 'cair' and cair_at < now() - make_interval(days => public.pk_setting_num('lpj_days', 2)::int)),
    'cair', (select count(*) from public.pk_rab where status = 'siap_cair' and exists (select 1 from public.pk_people x where x.id = p and x.role = 'keuangan')),
    'validasi', (select count(*) from public.pk_kkh k join public.pk_people o on o.id = k.person_id where k.status = 'siap' and p in (o.valuer1_id, o.valuer2_id)),
    'kkh_kosong', (select count(*) = 0 from public.pk_kkh where person_id = p and day = public.pk_today()) and not exists (
        select 1 from public.pk_leave l where l.person_id = p and l.status = 'disetujui' and public.pk_today() between l.day and coalesce(l.end_day, l.day)),
    'cuti', (select count(*) from public.pk_leave l join public.pk_people o on o.id = l.person_id where l.status = 'diajukan' and (o.boss_id = p)),
    'pilah', (select count(*) from public.pk_requests where status in ('baru','diperjelas') and exists (select 1 from public.pk_people x where x.id = p and x.role = 'kepala_staf')),
    'permintaan', (select count(*) from public.pk_requests where status = 'diterima' and pic_id = p)
  ) $$;
revoke execute on function public.pk_digest_items(uuid) from public, anon, authenticated;
