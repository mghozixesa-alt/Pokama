-- 056: Tugas dari sistem. Masalah operasional Rentalaja (keluhan lewat batas, unit tertahan QC/servis, shift belum tutup,
-- pembayaran menggantung, refund belum diputuskan, booking kembali belum ditutup) otomatis jadi tugas Pokama untuk manajer
-- yang sedang bertugas (absen hari ini), dengan rekan setim sebagai pemantau (reviewer). Selesai otomatis bila masalahnya beres.
-- KKH tidak bisa ditandai siap divalidasi selama prioritas Darurat/Tinggi dari sistem belum dijadwalkan di KKH hari itu.
-- Tugas dari sistem ikut Performa (selesai tepat waktu vs lewat tenggat).

alter table public.pk_tasks add column if not exists sys_key text;
alter table public.pk_tasks add column if not exists sys_prio text;
alter table public.pk_tasks add column if not exists sys_group text;
alter table public.pk_tasks add column if not exists sys_link text;
alter table public.pk_tasks drop constraint if exists pk_tasks_source_check;
alter table public.pk_tasks add constraint pk_tasks_source_check check (source in ('atasan', 'permintaan', 'sistem'));
create unique index if not exists pk_tasks_sys_open on public.pk_tasks(sys_key) where sys_key is not null and status <> 'done';

create table if not exists public.pk_sys_log (day date not null, stage text not null, person_id uuid not null, at timestamptz not null default now(), primary key (day, stage, person_id));
alter table public.pk_sys_log enable row level security;

-- anggota tim jaga per kelompok (dari peran akun Rentalaja): ops = manajer operasional, aset = manajer aset, keu = keuangan / Kepala Staf
create or replace function public.pk_sys_members(g text) returns table(pid uuid, lead boolean, unit text) language sql stable security definer set search_path = public as $$
  select p.id, p.role in ('leader', 'kepala_staf'), p.unit_code from pk_people p join staff s on s.user_id = p.user_id
   where p.is_active and s.is_active
     and s.role::text = any(case g when 'ops' then array['experience_manager'] when 'aset' then array['asset_manager'] else array['finance', 'chief_of_staff'] end) $$;

create or replace function public.pk_sys_onduty(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from pk_attendance a where a.person_id = p and a.day = pk_today())
     and not exists (select 1 from pk_leave l where l.person_id = p and l.status = 'disetujui' and pk_today() between l.day and coalesce(l.end_day, l.day)) $$;

-- pilih orang: yang bertugas hari ini dengan tugas sistem paling sedikit; kalau belum ada yang absen, ketua tim; terakhir Kepala Staf
create or replace function public.pk_sys_pick(g text, p_not uuid) returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select m.pid from pk_sys_members(g) m where m.pid is distinct from p_not and pk_sys_onduty(m.pid)
      order by (select count(*) from pk_tasks t where t.pic_id = m.pid and t.source = 'sistem' and t.status <> 'done'), m.lead desc limit 1),
    (select m.pid from pk_sys_members(g) m where m.pid is distinct from p_not order by m.lead desc limit 1),
    (select id from pk_people where role = 'kepala_staf' and is_active and id is distinct from p_not limit 1),
    (select id from pk_people where role = 'ceo' and is_active and id is distinct from p_not order by created_at limit 1)) $$;

create or replace function public.pk_sys_sync() returns jsonb language plpgsql security definer set search_path = public as $$
declare url text := rtrim(coalesce((select value #>> '{}' from settings where key = 'app_url'), 'https://rentalaja.co.id'), '/');
  d date := pk_today(); wib timestamp := now() at time zone 'Asia/Jakarta'; c record; t pk_tasks; pic uuid; rev uuid;
  n_new int := 0; n_upd int := 0; n_done int := 0; n_hand int := 0; n_rem int := 0; lst text; r record;
begin
  perform set_config('pk.rpc', '1', true);
  create temp table if not exists _sys(key text primary key, grp text, title text, dod text, prio text, due date, link text) on commit drop;
  truncate _sys;
  -- 1) keluhan yang lewat batas (sudah naik ke Manajer Operasional / CEO)
  insert into _sys select 'tiket:' || k.id, case when k.division = 'teknisi' then 'aset' else 'ops' end,
      'Keluhan ' || tk.code || ' lewat batas · ' || app.tk_label(k.division),
      left(tk.summary, 300) || E'\nSelesai otomatis begitu tugas ' || app.tk_label(k.division) || ' di tiket ini ditutup.',
      case tk.priority when 'urgent' then 'urgent' when 'high' then 'high' else 'normal' end,
      greatest(d, (k.done_due at time zone 'Asia/Jakarta')::date), url || '/#/TiketCS?id=' || tk.id
    from ticket_tasks k join tickets tk on tk.id = k.ticket_id where k.status in ('open', 'doing') and k.esc_level >= 1 and k.division <> 'ceo'
  on conflict do nothing;
  -- 2) unit antre QC lebih dari 2 hari (per cabang)
  insert into _sys select 'qc:' || q.branch_id, 'aset', count(*) || ' unit antre QC lebih dari 2 hari · ' || coalesce(max(b.name), 'cabang'),
      'Cek dan putuskan lolos/gagal di Cek QC. Selesai otomatis bila tidak ada lagi antrean QC lebih dari 2 hari di cabang ini.', 'high', d, url || '/#/PosQC'
    from qc_inspections q left join branches b on b.id = q.branch_id where q.done_at is null and q.queued_at < now() - interval '2 days' group by q.branch_id
  on conflict do nothing;
  -- 3) work order terbuka lebih dari 3 hari (per cabang)
  insert into _sys select 'wo:' || w.branch_id, 'aset', count(*) || ' work order terbuka lebih dari 3 hari · ' || coalesce(max(b.name), 'cabang'),
      'Selesaikan, tunggu part, atau tutup work order yang sudah beres di Papan servis. Selesai otomatis bila tidak ada lagi work order lebih dari 3 hari.', 'high', d, url || '/#/AsetServis'
    from work_orders w left join branches b on b.id = w.branch_id where w.status in ('queued', 'working', 'waiting_part') and w.created_at < now() - interval '3 days' group by w.branch_id
  on conflict do nothing;
  -- 4) shift kasir belum ditutup lebih dari 1 hari
  insert into _sys select 'shift:' || s.id, 'ops', 'Shift kasir belum ditutup · ' || coalesce(b.name, 'cabang') || ' · dibuka ' || to_char(s.opened_at at time zone 'Asia/Jakarta', 'DD/MM HH24.MI'),
      'Pastikan kasir menutup shift dan menyetor kas. Selesai otomatis begitu shift ditutup.', 'high', d, url || '/#/PosShift'
    from shifts s left join branches b on b.id = s.branch_id where s.closed_at is null and s.opened_at < now() - interval '1 day'
  on conflict do nothing;
  -- 5) pembayaran menggantung lebih dari 1 hari
  insert into _sys select 'bayar', 'ops', count(*) || ' pembayaran menggantung lebih dari 1 hari',
      'Cek satu per satu: sudah lunas, batalkan, atau tagih ulang. Selesai otomatis bila tidak ada lagi pembayaran menggantung lebih dari 1 hari.', 'normal', d + 1, url || '/#/PosHariIni'
    from payments where status = 'pending' and created_at < now() - interval '1 day' having count(*) > 0
  on conflict do nothing;
  -- 6) refund belum diputuskan lebih dari 2 hari
  insert into _sys select 'refund:' || a.id, 'keu', 'Putuskan refund · ' || a.title, coalesce(a.detail, '') || E'\nSelesai otomatis begitu disetujui atau ditolak.', 'high', d, url || '/#/MgmtSetuju'
    from approvals a where a.status = 'pending' and a.kind = 'refund' and a.created_at < now() - interval '2 days'
  on conflict do nothing;
  -- 7) booking sudah dikembalikan tapi belum ditutup lebih dari 1 hari
  insert into _sys select 'kembali:' || bk.id, 'ops', 'Booking ' || bk.code || ' sudah kembali tapi belum ditutup',
      'Selesaikan tagihan akhir lalu tutup booking di Serah-terima & kembali.', 'normal', d + 1, url || '/#/PosSerahTerima'
    from bookings bk where bk.status::text = 'returned' and bk.updated_at < now() - interval '1 day'
  on conflict do nothing;

  -- buat / perbarui tugas
  for c in select * from _sys loop
    select * into t from pk_tasks where sys_key = c.key and status <> 'done';
    if not found then
      pic := pk_sys_pick(c.grp, null); rev := pk_sys_pick(c.grp, pic);
      if pic is null then continue; end if;
      insert into pk_tasks(unit_code, title, dod, pic_id, reviewer_id, due, status, source, sys_key, sys_prio, sys_group, sys_link)
      values ((select unit_code from pk_people where id = pic), '[Sistem] ' || c.title, c.dod, pic, nullif(rev, pic), c.due, 'todo', 'sistem', c.key, c.prio, c.grp, c.link);
      n_new := n_new + 1;
    elsif t.title is distinct from '[Sistem] ' || c.title or t.sys_prio is distinct from c.prio or t.dod is distinct from c.dod then
      update pk_tasks set title = '[Sistem] ' || c.title, dod = c.dod, sys_prio = c.prio, sys_link = c.link where id = t.id;
      n_upd := n_upd + 1;
    end if;
  end loop;
  -- masalah sudah beres -> tugas selesai otomatis
  update pk_tasks set status = 'done', progress = 100, done_at = now()
   where source = 'sistem' and status <> 'done' and sys_key is not null and sys_key not in (select key from _sys);
  get diagnostics n_done = row_count;

  -- serah terima giliran: mulai 09.00, tugas milik orang yang tidak bertugas hari ini pindah ke rekan yang bertugas
  if extract(hour from wib) >= 9 then
    for t in select * from pk_tasks where source = 'sistem' and status in ('todo', 'doing', 'hold') and pic_id is not null and not pk_sys_onduty(pic_id) loop
      pic := (select m.pid from pk_sys_members(t.sys_group) m where m.pid <> t.pic_id and pk_sys_onduty(m.pid)
               order by (select count(*) from pk_tasks x where x.pic_id = m.pid and x.source = 'sistem' and x.status <> 'done') limit 1);
      if pic is null then continue; end if;
      update pk_tasks set pic_id = pic, reviewer_id = nullif(coalesce(pk_sys_pick(t.sys_group, pic), t.pic_id), pic) where id = t.id;
      n_hand := n_hand + 1;
    end loop;
  end if;

  -- pengingat 08.30: ringkasan prioritas hari ini
  if wib::time >= '08:30' and wib::time < '10:00' then
    for r in select pic_id, count(*) n, string_agg('• ' || replace(title, '[Sistem] ', ''), E'\n' order by sys_prio, due) l from pk_tasks
             where source = 'sistem' and status <> 'done' and pic_id is not null group by pic_id loop
      if exists (select 1 from pk_sys_log where day = d and stage = 'pagi' and person_id = r.pic_id) then continue; end if;
      insert into pk_sys_log(day, stage, person_id) values (d, 'pagi', r.pic_id);
      perform pk_notify(r.pic_id, 'tugas', r.n || ' prioritas dari sistem hari ini', r.l || E'\nMasukkan ke KKH hari ini.', '#/kkh', true);
      n_rem := n_rem + 1;
    end loop;
  end if;
  -- pengingat 09.30: prioritas Darurat/Tinggi belum masuk KKH (ke PIC dan rekan pemantau)
  if wib::time >= '09:30' and wib::time < '11:00' then
    for r in select t2.pic_id, t2.reviewer_id, string_agg('• ' || replace(t2.title, '[Sistem] ', ''), E'\n') l, count(*) n from pk_tasks t2
             where t2.source = 'sistem' and t2.status <> 'done' and t2.sys_prio in ('urgent', 'high') and t2.due <= d and t2.pic_id is not null
               and not exists (select 1 from pk_kkh k where k.person_id = t2.pic_id and k.day = d and k.task_id = t2.id)
             group by t2.pic_id, t2.reviewer_id loop
      if exists (select 1 from pk_sys_log where day = d and stage = 'kkh' and person_id = r.pic_id) then continue; end if;
      insert into pk_sys_log(day, stage, person_id) values (d, 'kkh', r.pic_id);
      perform pk_notify(r.pic_id, 'tugas', 'Prioritas belum masuk KKH hari ini', r.l || E'\nKKH tidak bisa ditandai siap divalidasi sebelum prioritas ini dijadwalkan.', '#/kkh', true);
      if r.reviewer_id is not null then
        perform pk_notify(r.reviewer_id, 'tugas', pk_nick(r.pic_id) || ' belum menjadwalkan ' || r.n || ' prioritas dari sistem', r.l, '#/kkh-tim', false);
      end if;
      n_rem := n_rem + 1;
    end loop;
  end if;
  -- Performa: output otomatis "Prioritas dari sistem selesai tepat waktu" (bobot awal 30, bisa diubah atasan)
  for r in select t3.pic_id, round(100.0 * count(*) filter (where t3.status = 'done' and t3.done_at::date <= t3.due) / count(*), 1) pct
           from pk_tasks t3 where t3.source = 'sistem' and t3.pic_id is not null and t3.due between date_trunc('month', d)::date and d
             and (t3.status = 'done' or t3.due < d)
           group by t3.pic_id loop
    if exists (select 1 from pk_outputs o where o.person_id = r.pic_id and o.month = date_trunc('month', d)::date and o.source = 'sistem:prioritas') then
      update pk_outputs set actual = r.pct where person_id = r.pic_id and month = date_trunc('month', d)::date and source = 'sistem:prioritas' and actual is distinct from r.pct;
    else
      insert into pk_outputs(person_id, month, name, weight, target, actual, source)
      values (r.pic_id, date_trunc('month', d)::date, 'Prioritas dari sistem selesai tepat waktu (%)', 30, 100, r.pct, 'sistem:prioritas');
    end if;
  end loop;
  return jsonb_build_object('baru', n_new, 'diperbarui', n_upd, 'selesai', n_done, 'serah_terima', n_hand, 'pengingat', n_rem);
end $$;
revoke execute on function public.pk_sys_sync() from public, anon, authenticated;

-- KKH: tidak bisa ditandai siap divalidasi selama prioritas Darurat/Tinggi dari sistem belum dijadwalkan di KKH hari itu
create or replace function public.pk_kkh_sys_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare lst text;
begin
  if new.status = 'siap' and (tg_op = 'INSERT' or old.status is distinct from 'siap') and new.day = pk_today() then
    select string_agg('"' || replace(t.title, '[Sistem] ', '') || '"', ', ') into lst from pk_tasks t
     where t.source = 'sistem' and t.status <> 'done' and t.pic_id = new.person_id and t.sys_prio in ('urgent', 'high') and t.due <= new.day
       and t.id is distinct from new.task_id
       and not exists (select 1 from pk_kkh k where k.person_id = new.person_id and k.day = new.day and k.task_id = t.id);
    if lst is not null then
      raise exception 'Jadwalkan dulu prioritas dari sistem di salah satu jam KKH hari ini: %', lst;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists pk_kkh_sys_guard on public.pk_kkh;
create trigger pk_kkh_sys_guard before insert or update of status on public.pk_kkh for each row execute function public.pk_kkh_sys_guard();

-- notifikasi selesai untuk tugas dari sistem: bukan 'disetujui reviewer' tetapi selesai otomatis
do $do$ declare d text := pg_get_functiondef('public.pk_ntf_tasks()'::regprocedure); begin
  if position('Selesai otomatis' in d) = 0 then
    d := replace(d, $x$    elsif new.status = 'done' then$x$, $x$    elsif new.status = 'done' and new.source = 'sistem' then
      perform public.pk_notify(new.pic_id, 'tugas', 'Selesai otomatis: ' || replace(new.title, '[Sistem] ', ''), 'Masalahnya sudah beres di Rentalaja.', lk, false);
    elsif new.status = 'done' then$x$);
    execute d;
  end if;
end $do$;

select cron.schedule('pk-tugas-sistem', '*/10 * * * *', 'select public.pk_sys_sync()');
