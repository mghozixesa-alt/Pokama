-- pk_025 · Sistem Kerja Operasional (staf lapangan Rentalaja)
-- Alur: masuk Sistem Kerja (absen, ceklis, performa, lembur) -> "Mulai kerja" membuka panel Rentalaja sesuai penugasan.
-- Penugasan (posisi + cabang + periode) jadi satu-satunya sumber akses: mutasi cukup ubah penugasan.
-- Diterapkan sebagai migrasi pk_025a_ops_dasar, pk_025b_ops_beranda_lembur, pk_025c_ops_penugasan_papan.
-- Lembur & mutasi diputuskan Operasional (staf Rentalaja peran owner / experience_manager / viewer / branch_head).

-- 1) peran baru "lapangan": hanya melihat datanya sendiri di Sistem Kerja (tidak ikut membaca KKH, belanja, proyek holding)
alter table public.pk_people drop constraint if exists pk_people_role_check;
alter table public.pk_people add constraint pk_people_role_check check (role = any (array['ceo','kepala_staf','keuangan','leader','staf','lapangan']));

create or replace function public.pk_member() returns uuid language sql stable security definer set search_path = public as $$
  select p.id from public.pk_people p where p.id = public.pk_me() and p.role <> 'lapangan'
$$;

do $$
declare r record; q text; w text; s text;
begin
  for r in select * from pg_policies where schemaname = 'public'
           and (qual ilike '%pk_me() IS NOT NULL%' or with_check ilike '%pk_me() IS NOT NULL%')
           and policyname not in ('pk_settings_r', 'pk_units_r') loop
    q := replace(r.qual, 'pk_me() IS NOT NULL', 'pk_member() IS NOT NULL');
    w := replace(r.with_check, 'pk_me() IS NOT NULL', 'pk_member() IS NOT NULL');
    if r.policyname = 'pk_people_r' then q := '(pk_member() IS NOT NULL) OR (id = pk_me())'; end if;
    if r.policyname = 'pk_leave_r' then q := '(pk_member() IS NOT NULL) OR (person_id = pk_me())'; end if;
    if r.policyname = 'pk_att_r' then q := '(pk_member() IS NOT NULL) OR (person_id = pk_me())'; end if;
    s := format('alter policy %I on public.%I', r.policyname, r.tablename);
    if q is not null then s := s || ' using (' || q || ')'; end if;
    if w is not null then s := s || ' with check (' || w || ')'; end if;
    execute s;
  end loop;
end $$;

-- 2) tabel
create table if not exists public.ops_assignments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.pk_people(id) on delete cascade,
  position text not null check (position in ('kasir','cs','runner','sopir','qc','teknisi','kepala_cabang')),
  branch_id uuid not null references public.branches(id),
  start_day date not null default public.pk_today(),
  end_day date,
  kind text not null default 'awal' check (kind in ('awal','mutasi','tambahan')),
  reason text,
  created_by uuid references public.pk_people(id),
  created_at timestamptz not null default now(),
  check (end_day is null or end_day >= start_day)
);
create index if not exists ops_assign_person on public.ops_assignments(person_id, start_day);

create table if not exists public.ops_overtime (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.pk_people(id) on delete cascade,
  branch_id uuid references public.branches(id),
  day date not null,
  starts time not null, ends time not null,
  minutes int generated always as (case when ends > starts then (extract(epoch from ends - starts) / 60)::int
                                        else (extract(epoch from ends - starts) / 60)::int + 1440 end) stored,
  reason text,
  kind text not null default 'ajuan' check (kind in ('ajuan','tugas')),
  status text not null default 'diajukan' check (status in ('diajukan','disetujui','ditolak','batal')),
  requested_by uuid references public.pk_people(id),
  decided_by uuid references public.pk_people(id), decided_at timestamptz, decide_note text,
  created_at timestamptz not null default now()
);
create index if not exists ops_ot_person on public.ops_overtime(person_id, day);

create table if not exists public.ops_checklist_items (
  id uuid primary key default gen_random_uuid(),
  position text check (position is null or position in ('kasir','cs','runner','sopir','qc','teknisi','kepala_cabang')),
  phase text not null check (phase in ('buka','tutup')),
  label text not null, sort int not null default 0, is_active boolean not null default true
);
create table if not exists public.ops_staff_checks (
  person_id uuid not null references public.pk_people(id) on delete cascade,
  day date not null, phase text not null check (phase in ('buka','tutup')),
  items uuid[] not null default '{}', note text, done_at timestamptz not null default now(),
  primary key (person_id, day, phase)
);

-- 3) siapa Operasional (yang memutuskan lembur, mutasi, jadwal)
create or replace function public.ops_is_mgr() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff s join public.pk_people p on p.user_id = s.user_id
                 where p.id = public.pk_me() and p.is_active and s.is_active
                   and s.role in ('owner','experience_manager','viewer','branch_head'))
$$;

alter table public.ops_assignments enable row level security;
alter table public.ops_overtime enable row level security;
alter table public.ops_checklist_items enable row level security;
alter table public.ops_staff_checks enable row level security;
drop policy if exists ops_assign_r on public.ops_assignments;
create policy ops_assign_r on public.ops_assignments for select using (person_id = public.pk_me() or public.ops_is_mgr());
drop policy if exists ops_ot_r on public.ops_overtime;
create policy ops_ot_r on public.ops_overtime for select using (person_id = public.pk_me() or public.ops_is_mgr());
drop policy if exists ops_ci_r on public.ops_checklist_items;
create policy ops_ci_r on public.ops_checklist_items for select using (public.pk_me() is not null);
drop policy if exists ops_sck_r on public.ops_staff_checks;
create policy ops_sck_r on public.ops_staff_checks for select using (person_id = public.pk_me() or public.ops_is_mgr());

-- 4) posisi -> peran & layar Rentalaja
create or replace function public.ops_pos(p text) returns jsonb language sql immutable as $$
  select case p
    when 'kasir' then '{"role":"cashier","screen":"PosHariIni","label":"Kasir"}'
    when 'cs' then '{"role":"cs","screen":"PusatCS","label":"CS"}'
    when 'runner' then '{"role":"runner","screen":"AgendaLapangan","label":"Runner"}'
    when 'sopir' then '{"role":"driver","screen":"SopirJeep","label":"Sopir jeep"}'
    when 'qc' then '{"role":"qc","screen":"PosQC","label":"QC"}'
    when 'teknisi' then '{"role":"technician","screen":"Teknisi","label":"Teknisi"}'
    when 'kepala_cabang' then '{"role":"branch_head","screen":"PosHariIni","label":"Kepala cabang"}'
  end::jsonb
$$;

-- peran staf Rentalaja yang boleh diatur otomatis oleh penugasan (owner, manajer, keuangan tidak pernah disentuh)
create or replace function public.ops_syncable(r text) returns boolean language sql immutable as $$
  select r is null or r in ('cashier','staff','cs','cs_experience','runner','driver','qc','technician','branch_head')
$$;

-- penugasan aktif pada tanggal tertentu
create or replace function public.ops_active(p_person uuid, p_day date default public.pk_today())
returns setof public.ops_assignments language sql stable security definer set search_path = public as $$
  select * from public.ops_assignments a where a.person_id = p_person and a.start_day <= p_day
     and (a.end_day is null or a.end_day >= p_day) order by a.start_day desc, a.created_at desc
$$;

-- samakan akun staf Rentalaja dengan penugasan: peran = penugasan yang dipilih (atau terbaru), cabang = semua cabang penugasan aktif
create or replace function public.ops_sync(p_person uuid, p_assign uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare p public.pk_people; a public.ops_assignments; cur text; rl text;
begin
  select * into p from public.pk_people where id = p_person;
  if p.user_id is null then return; end if;
  if p_assign is not null then select * into a from public.ops_active(p_person) x where x.id = p_assign;
  else select * into a from public.ops_active(p_person) limit 1; end if;
  if a.id is null then return; end if;
  rl := public.ops_pos(a.position)->>'role';
  select role::text into cur from public.staff where user_id = p.user_id;
  if not found then
    insert into public.staff(user_id, name, phone, email, role, all_branches, is_active)
    values (p.user_id, p.name, p.phone, p.email, rl::staff_role, false, true);
  elsif not public.ops_syncable(cur) then return;
  else
    update public.staff set role = rl::staff_role, all_branches = false, is_active = true, updated_at = now()
     where user_id = p.user_id and (role::text is distinct from rl or all_branches or not is_active);
  end if;
  delete from public.staff_branches sb where sb.staff_id = p.user_id
     and sb.branch_id not in (select branch_id from public.ops_active(p_person));
  insert into public.staff_branches(staff_id, branch_id)
  select distinct p.user_id, x.branch_id from public.ops_active(p_person) x
   where not exists (select 1 from public.staff_branches sb where sb.staff_id = p.user_id and sb.branch_id = x.branch_id);
end $$;

-- dipanggil fungsi pk-ra-sso (service role): buka panel untuk satu penugasan
create or replace function public.pk_ra_ops_start(p_user uuid, p_assign uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.pk_people; a public.ops_assignments; b public.branches; pos jsonb;
begin
  select * into p from public.pk_people where user_id = p_user and is_active;
  if p.id is null then return null; end if;
  select * into a from public.ops_active(p.id) x where x.id = p_assign;
  if a.id is null then return null; end if;
  perform public.ops_sync(p.id, a.id);
  select * into b from public.branches where id = a.branch_id;
  pos := public.ops_pos(a.position);
  if not exists (select 1 from public.staff s where s.user_id = p_user and s.is_active and s.role::text = pos->>'role') then return null; end if;
  return jsonb_build_object('screen', pos->>'screen', 'mod', (pos->>'label') || ' · ' || b.name, 'br', b.code);
end $$;
revoke execute on function public.pk_ra_ops_start(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.ops_sync(uuid, uuid) from public, anon, authenticated;

-- notifikasi ke semua orang Operasional
create or replace function public.ops_notify_mgrs(p_title text, p_body text, p_urgent boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare x uuid;
begin
  for x in select p.id from public.pk_people p join public.staff s on s.user_id = p.user_id
           where p.is_active and s.is_active and s.role in ('owner','experience_manager','viewer') loop
    perform public.pk_notify(x, 'ops', p_title, p_body, '#/ops', p_urgent);
  end loop;
end $$;
revoke execute on function public.ops_notify_mgrs(text, text, boolean) from public, anon, authenticated;

-- 5) beranda staf lapangan
create or replace function public.ops_home() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); p public.pk_people; u uuid; d date := public.pk_today(); m0 date := date_trunc('month', public.pk_today())::date;
  poss text[]; out jsonb;
begin
  if me is null then raise exception 'Masuk Sistem Kerja dulu'; end if;
  select * into p from public.pk_people where id = me; u := p.user_id;
  perform public.ops_sync(me);
  select coalesce(array_agg(distinct position), '{}') into poss from public.ops_active(me);
  select jsonb_build_object(
    'me', jsonb_build_object('id', p.id, 'name', p.name, 'nick', coalesce(p.nickname, p.name)),
    'staff', (select jsonb_build_object('role', s.role, 'active', s.is_active) from public.staff s where s.user_id = u),
    'assigns', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'position', a.position, 'pos', public.ops_pos(a.position), 'branch_id', a.branch_id,
        'code', b.code, 'branch', b.name, 'lat', b.lat, 'lng', b.lng, 'start_day', a.start_day, 'end_day', a.end_day, 'kind', a.kind) order by a.start_day desc)
      from public.ops_active(me) a join public.branches b on b.id = a.branch_id), '[]'),
    'next', coalesce((select jsonb_agg(jsonb_build_object('position', a.position, 'pos', public.ops_pos(a.position), 'branch', b.name, 'start_day', a.start_day, 'kind', a.kind, 'reason', a.reason) order by a.start_day)
      from public.ops_assignments a join public.branches b on b.id = a.branch_id where a.person_id = me and a.start_day > d), '[]'),
    'history', coalesce((select jsonb_agg(x order by x->>'start_day' desc) from (select jsonb_build_object('position', a.position, 'pos', public.ops_pos(a.position), 'branch', b.name,
        'start_day', a.start_day, 'end_day', a.end_day, 'kind', a.kind, 'reason', a.reason) x
      from public.ops_assignments a join public.branches b on b.id = a.branch_id where a.person_id = me order by a.start_day desc limit 8) h), '[]'),
    'schedule', (select jsonb_build_object('shift', s.shift, 'starts', s.starts, 'ends', s.ends, 'branch', b.name)
      from public.shift_schedules s left join public.branches b on b.id = s.branch_id where s.staff_id = u and s.day = d),
    'week', coalesce((select jsonb_agg(jsonb_build_object('day', s.day, 'shift', s.shift, 'starts', s.starts, 'ends', s.ends, 'branch', b.name) order by s.day)
      from public.shift_schedules s left join public.branches b on b.id = s.branch_id where s.staff_id = u and s.day between d and d + 6), '[]'),
    'att', (select jsonb_build_object('clock_in', a.clock_in, 'clock_out', a.clock_out, 'late', a.late_minutes, 'inside', a.inside_area, 'status', a.status, 'branch', b.name)
      from public.attendance a left join public.branches b on b.id = a.branch_id where a.staff_id = u and a.day = d),
    'radius', app.num('attendance_radius_m'),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'phase', i.phase, 'label', i.label, 'position', i.position) order by i.phase, i.position nulls first, i.sort)
      from public.ops_checklist_items i where i.is_active and (i.position is null or i.position = any(poss))), '[]'),
    'checks', coalesce((select jsonb_object_agg(c.phase, jsonb_build_object('items', c.items, 'at', c.done_at)) from public.ops_staff_checks c where c.person_id = me and c.day = d), '{}'),
    'open_shift', exists (select 1 from public.shifts sh where sh.staff_id = u and sh.status = 'open'),
    'ot', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'day', o.day, 'starts', o.starts, 'ends', o.ends, 'minutes', o.minutes, 'reason', o.reason, 'kind', o.kind,
        'status', o.status, 'note', o.decide_note, 'by', public.pk_nick(o.decided_by)) order by o.day desc, o.created_at desc)
      from public.ops_overtime o where o.person_id = me and o.day >= m0 - 31), '[]'),
    'perf', jsonb_build_object(
      'hadir', (select count(*) from public.attendance a where a.staff_id = u and a.day >= m0 and a.clock_in is not null),
      'telat', (select count(*) from public.attendance a where a.staff_id = u and a.day >= m0 and a.late_minutes > 0),
      'telat_min', (select coalesce(sum(a.late_minutes), 0) from public.attendance a where a.staff_id = u and a.day >= m0),
      'jadwal', (select count(*) from public.shift_schedules s where s.staff_id = u and s.day >= m0 and s.day <= d),
      'poin', (select coalesce(sum(sp.delta), 0) from public.staff_points sp where sp.staff_id = u and sp.at >= m0),
      'poin_list', coalesce((select jsonb_agg(jsonb_build_object('delta', sp.delta, 'reason', sp.reason, 'at', sp.at) order by sp.at desc) from (select * from public.staff_points sp where sp.staff_id = u and sp.at >= m0 order by sp.at desc limit 6) sp), '[]'),
      'tugas', (select count(*) from public.runner_tasks t where t.runner_id = u and t.status = 'done' and t.done_at >= m0),
      'tugas_gagal', (select count(*) from public.runner_tasks t where t.runner_id = u and t.status = 'failed' and t.scheduled_at >= m0),
      'shift', (select count(*) from public.shifts sh where sh.staff_id = u and sh.status = 'closed' and sh.closed_at >= m0),
      'selisih', (select coalesce(sum(sh.cash_diff), 0) from public.shifts sh where sh.staff_id = u and sh.status = 'closed' and sh.closed_at >= m0),
      'lembur_min', (select coalesce(sum(o.minutes), 0) from public.ops_overtime o where o.person_id = me and o.status = 'disetujui' and o.day >= m0),
      'ceklis', (select count(*) from public.ops_staff_checks c where c.person_id = me and c.day >= m0))
  ) into out;
  return out;
end $$;

-- ceklis buka / tutup
create or replace function public.ops_check_save(p_phase text, p_items uuid[], p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me();
begin
  if me is null then raise exception 'Masuk Sistem Kerja dulu'; end if;
  if p_phase not in ('buka','tutup') then raise exception 'Ceklis tidak dikenal'; end if;
  insert into public.ops_staff_checks(person_id, day, phase, items, note, done_at) values (me, public.pk_today(), p_phase, coalesce(p_items, '{}'), p_note, now())
  on conflict (person_id, day, phase) do update set items = excluded.items, note = excluded.note, done_at = now();
end $$;

-- absen keluar: ceklis tutup harus lengkap dan kas kasir sudah ditutup
create or replace function public.ops_clock_out() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); u uuid; need uuid[]; got uuid[];
begin
  if me is null then raise exception 'Masuk Sistem Kerja dulu'; end if;
  select user_id into u from public.pk_people where id = me;
  if exists (select 1 from public.shifts sh where sh.staff_id = u and sh.status = 'open') then
    raise exception 'Kas shift masih terbuka. Tutup shift dulu di panel Kasir, lalu absen keluar.'; end if;
  select coalesce(array_agg(i.id), '{}') into need from public.ops_checklist_items i
   where i.is_active and i.phase = 'tutup' and (i.position is null or i.position in (select position from public.ops_active(me)));
  select coalesce(items, '{}') into got from public.ops_staff_checks where person_id = me and day = public.pk_today() and phase = 'tutup';
  if cardinality(need) > 0 and not (need <@ coalesce(got, '{}')) then raise exception 'Selesaikan ceklis tutup dulu sebelum absen keluar.'; end if;
  return public.clock_out();
end $$;

-- 6) lembur
create or replace function public.ops_ot_request(p_day date, p_starts time, p_ends time, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); v_id uuid; br uuid;
begin
  if me is null then raise exception 'Masuk Sistem Kerja dulu'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Tulis alasan lembur'; end if;
  if p_day < public.pk_today() - 7 then raise exception 'Lembur lebih dari 7 hari lalu tidak bisa diajukan'; end if;
  select branch_id into br from public.ops_active(me, p_day) limit 1;
  insert into public.ops_overtime(person_id, branch_id, day, starts, ends, reason, kind, status, requested_by)
  values (me, br, p_day, p_starts, p_ends, trim(p_reason), 'ajuan', 'diajukan', me) returning ops_overtime.id into v_id;
  perform public.ops_notify_mgrs('Pengajuan lembur ' || public.pk_nick(me), to_char(p_day, 'DD/MM') || ' ' || to_char(p_starts, 'HH24.MI') || '–' || to_char(p_ends, 'HH24.MI') || ' · ' || trim(p_reason), false);
  return v_id;
end $$;

create or replace function public.ops_ot_assign(p_person uuid, p_day date, p_starts time, p_ends time, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); v_id uuid; br uuid;
begin
  if not public.ops_is_mgr() then raise exception 'Hanya Operasional yang bisa menugaskan lembur'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Tulis keperluan lembur'; end if;
  select branch_id into br from public.ops_active(p_person, p_day) limit 1;
  insert into public.ops_overtime(person_id, branch_id, day, starts, ends, reason, kind, status, requested_by, decided_by, decided_at)
  values (p_person, br, p_day, p_starts, p_ends, trim(p_reason), 'tugas', 'disetujui', me, me, now()) returning ops_overtime.id into v_id;
  perform public.pk_notify(p_person, 'ops', 'Anda ditugaskan lembur', to_char(p_day, 'DD/MM') || ' ' || to_char(p_starts, 'HH24.MI') || '–' || to_char(p_ends, 'HH24.MI') || ' · ' || trim(p_reason), '#/shift', true);
  return v_id;
end $$;

create or replace function public.ops_ot_decide(p_id uuid, p_ok boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); o public.ops_overtime;
begin
  if not public.ops_is_mgr() then raise exception 'Hanya Operasional yang bisa memutuskan lembur'; end if;
  select * into o from public.ops_overtime where id = p_id for update;
  if o.id is null or o.status <> 'diajukan' then raise exception 'Pengajuan ini sudah diputuskan'; end if;
  if o.person_id = me then raise exception 'Lembur sendiri diputuskan orang lain'; end if;
  if not p_ok and coalesce(trim(p_note), '') = '' then raise exception 'Tulis alasan penolakan'; end if;
  update public.ops_overtime set status = case when p_ok then 'disetujui' else 'ditolak' end, decided_by = me, decided_at = now(), decide_note = nullif(trim(p_note), '') where id = p_id;
  perform public.pk_notify(o.person_id, 'ops', 'Lembur ' || to_char(o.day, 'DD/MM') || case when p_ok then ' disetujui' else ' ditolak' end, coalesce(nullif(trim(p_note), ''), o.reason), '#/shift', not p_ok);
end $$;

create or replace function public.ops_ot_cancel(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.ops_overtime set status = 'batal' where id = p_id and person_id = public.pk_me() and status = 'diajukan';
  if not found then raise exception 'Pengajuan tidak bisa dibatalkan'; end if;
end $$;

-- 7) penugasan & mutasi
create or replace function public.ops_assign(p_person uuid, p_position text, p_branch uuid, p_start date, p_reason text, p_mode text default 'mutasi') returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); v_id uuid; had boolean; b public.branches; k text;
begin
  if not public.ops_is_mgr() then raise exception 'Hanya Operasional yang bisa mengatur penugasan dan mutasi'; end if;
  if public.ops_pos(p_position) is null then raise exception 'Posisi tidak dikenal'; end if;
  select * into b from public.branches where id = p_branch; if b.id is null then raise exception 'Pilih cabang'; end if;
  p_start := coalesce(p_start, public.pk_today());
  had := exists (select 1 from public.ops_assignments where person_id = p_person);
  k := case when not had then 'awal' when p_mode = 'tambahan' then 'tambahan' else 'mutasi' end;
  if k = 'mutasi' and coalesce(trim(p_reason), '') = '' then raise exception 'Tulis alasan mutasi'; end if;
  if k = 'mutasi' then
    delete from public.ops_assignments where person_id = p_person and start_day >= p_start;
    update public.ops_assignments set end_day = p_start - 1 where person_id = p_person and (end_day is null or end_day >= p_start);
  end if;
  insert into public.ops_assignments(person_id, position, branch_id, start_day, kind, reason, created_by)
  values (p_person, p_position, p_branch, p_start, k, nullif(trim(p_reason), ''), me) returning ops_assignments.id into v_id;
  if p_start <= public.pk_today() then perform public.ops_sync(p_person); end if;
  perform public.pk_notify(p_person, 'ops', case k when 'mutasi' then 'Mutasi: ' when 'tambahan' then 'Tugas tambahan: ' else 'Penugasan: ' end || (public.ops_pos(p_position)->>'label') || ' · ' || b.name,
    'Mulai ' || to_char(p_start, 'DD/MM/YYYY') || coalesce(' · ' || nullif(trim(p_reason), ''), ''), '#/shift', true);
  return v_id;
end $$;

create or replace function public.ops_assign_end(p_id uuid, p_end date) returns void
language plpgsql security definer set search_path = public as $$
declare a public.ops_assignments;
begin
  if not public.ops_is_mgr() then raise exception 'Hanya Operasional yang bisa mengakhiri penugasan'; end if;
  select * into a from public.ops_assignments where id = p_id;
  if a.id is null then raise exception 'Penugasan tidak ditemukan'; end if;
  if p_end < a.start_day then delete from public.ops_assignments where id = p_id;
  else update public.ops_assignments set end_day = p_end where id = p_id; end if;
  perform public.ops_sync(a.person_id);
end $$;

-- staf lapangan baru: masuk Sistem Kerja dengan Google memakai email ini, akun Rentalaja dibuat otomatis saat pertama masuk
create or replace function public.ops_person_add(p_name text, p_nick text, p_email text, p_phone text, p_position text, p_branch uuid, p_start date) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; b public.branches; v_code text; unit text; n int := 0;
begin
  if not public.ops_is_mgr() then raise exception 'Hanya Operasional yang bisa menambah staf lapangan'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Isi nama'; end if;
  if coalesce(trim(p_email), '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Isi email Google staf (untuk masuk)'; end if;
  if exists (select 1 from public.pk_people where lower(email) = lower(trim(p_email))) then raise exception 'Email ini sudah terdaftar di Sistem Kerja'; end if;
  select * into b from public.branches where id = p_branch; if b.id is null then raise exception 'Pilih cabang'; end if;
  unit := case when b.code = 'GRT' then 'GK' when b.code = 'WNR' then 'WN' when b.code like 'BDG%' then 'BD' when b.code = 'MPT' then 'MP'
               when b.code = 'JEEP' then 'JP' when b.code in ('RM','ERT','DDH') then 'EX' else 'RA' end;
  v_code := upper(left(regexp_replace(coalesce(nullif(trim(p_nick), ''), p_name), '[^A-Za-z]', '', 'g'), 3));
  if length(v_code) < 2 then v_code := 'OPS'; end if;
  while exists (select 1 from public.pk_people where pk_people.code = v_code || case when n = 0 then '' else n::text end) loop n := n + 1; end loop;
  if n > 0 then v_code := v_code || n; end if;
  perform set_config('pk.rpc', '1', true);
  insert into public.pk_people(code, name, nickname, role, title, unit_code, email, phone, joined_on, is_active)
  values (v_code, trim(p_name), nullif(trim(p_nick), ''), 'lapangan', public.ops_pos(p_position)->>'label', unit, lower(trim(p_email)),
          nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''), coalesce(p_start, public.pk_today()), true)
  returning pk_people.id into v_id;
  perform set_config('pk.rpc', '', true);
  perform public.ops_assign(v_id, p_position, p_branch, p_start, null, 'awal');
  return v_id;
end $$;

-- jadwal shift harian (tabel shift_schedules Rentalaja, dipakai hitung telat)
create or replace function public.ops_schedule_set(p_person uuid, p_day date, p_shift text, p_starts time, p_ends time) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid; br uuid;
begin
  if not public.ops_is_mgr() then raise exception 'Hanya Operasional yang bisa mengatur jadwal'; end if;
  select user_id into u from public.pk_people where id = p_person;
  if u is null then raise exception 'Orang ini belum pernah masuk Sistem Kerja, jadwal bisa diatur setelah ia masuk pertama kali'; end if;
  if p_starts is null then delete from public.shift_schedules where staff_id = u and day = p_day; return; end if;
  select branch_id into br from public.ops_active(p_person, p_day) limit 1;
  insert into public.shift_schedules(branch_id, staff_id, day, shift, starts, ends) values (br, u, p_day, coalesce(nullif(trim(p_shift), ''), 'Shift'), p_starts, p_ends)
  on conflict (staff_id, day) do update set branch_id = excluded.branch_id, shift = excluded.shift, starts = excluded.starts, ends = excluded.ends;
end $$;

create or replace function public.ops_item_save(p_id uuid, p_position text, p_phase text, p_label text, p_sort int, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ops_is_mgr() then raise exception 'Hanya Operasional yang bisa mengubah ceklis'; end if;
  if p_id is null then
    if coalesce(trim(p_label), '') = '' then raise exception 'Isi butir ceklis'; end if;
    insert into public.ops_checklist_items(position, phase, label, sort) values (nullif(p_position, ''), p_phase, trim(p_label), coalesce(p_sort, 99));
  else update public.ops_checklist_items set position = nullif(p_position, ''), phase = p_phase, label = coalesce(nullif(trim(p_label), ''), label), sort = coalesce(p_sort, sort), is_active = coalesce(p_active, is_active) where id = p_id; end if;
end $$;

-- 8) papan Operasional
create or replace function public.ops_team(p_day date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d date := coalesce(p_day, public.pk_today()); m0 date := date_trunc('month', coalesce(p_day, public.pk_today()))::date;
begin
  if not public.ops_is_mgr() then raise exception 'Hanya Operasional'; end if;
  return jsonb_build_object(
    'day', d,
    'branches', (select jsonb_agg(jsonb_build_object('id', id, 'code', code, 'name', name) order by sort, name) from public.branches where is_active),
    'people', coalesce((select jsonb_agg(x order by x->>'name') from (
      select jsonb_build_object('id', p.id, 'name', p.name, 'nick', coalesce(p.nickname, p.name), 'email', p.email, 'phone', p.phone, 'linked', p.user_id is not null,
        'active', p.is_active, 'role', p.role, 'staff_role', s.role,
        'assigns', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'position', a.position, 'pos', public.ops_pos(a.position), 'branch_id', a.branch_id, 'code', b.code, 'branch', b.name,
            'start_day', a.start_day, 'end_day', a.end_day, 'kind', a.kind)) from public.ops_active(p.id, d) a join public.branches b on b.id = a.branch_id), '[]'),
        'next', (select jsonb_build_object('position', a.position, 'pos', public.ops_pos(a.position), 'branch', b.name, 'start_day', a.start_day, 'kind', a.kind)
            from public.ops_assignments a join public.branches b on b.id = a.branch_id where a.person_id = p.id and a.start_day > d order by a.start_day limit 1),
        'sched', (select jsonb_build_object('shift', sc.shift, 'starts', sc.starts, 'ends', sc.ends) from public.shift_schedules sc where sc.staff_id = p.user_id and sc.day = d),
        'att', (select jsonb_build_object('in', at.clock_in, 'out', at.clock_out, 'late', at.late_minutes, 'inside', at.inside_area) from public.attendance at where at.staff_id = p.user_id and at.day = d),
        'checks', (select jsonb_object_agg(c.phase, cardinality(c.items)) from public.ops_staff_checks c where c.person_id = p.id and c.day = d),
        'open_shift', exists (select 1 from public.shifts sh where sh.staff_id = p.user_id and sh.status = 'open'),
        'm_hadir', (select count(*) from public.attendance at where at.staff_id = p.user_id and at.day >= m0 and at.clock_in is not null),
        'm_telat', (select count(*) from public.attendance at where at.staff_id = p.user_id and at.day >= m0 and at.late_minutes > 0),
        'm_lembur', (select coalesce(sum(o.minutes), 0) from public.ops_overtime o where o.person_id = p.id and o.status = 'disetujui' and o.day >= m0),
        'm_poin', (select coalesce(sum(sp.delta), 0) from public.staff_points sp where sp.staff_id = p.user_id and sp.at >= m0)) x
      from public.pk_people p left join public.staff s on s.user_id = p.user_id
      where p.is_active and (p.role = 'lapangan' or exists (select 1 from public.ops_assignments a where a.person_id = p.id))) q), '[]'),
    'ot', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'person_id', o.person_id, 'nick', public.pk_nick(o.person_id), 'day', o.day, 'starts', o.starts, 'ends', o.ends,
        'minutes', o.minutes, 'reason', o.reason, 'kind', o.kind, 'status', o.status, 'note', o.decide_note, 'by', public.pk_nick(o.decided_by)) order by (o.status = 'diajukan') desc, o.day desc)
      from public.ops_overtime o where o.status = 'diajukan' or o.day >= m0), '[]'),
    'moves', coalesce((select jsonb_agg(x) from (select jsonb_build_object('nick', public.pk_nick(a.person_id), 'position', a.position, 'pos', public.ops_pos(a.position), 'branch', b.name,
        'start_day', a.start_day, 'end_day', a.end_day, 'kind', a.kind, 'reason', a.reason, 'by', public.pk_nick(a.created_by)) x
      from public.ops_assignments a join public.branches b on b.id = a.branch_id order by a.created_at desc limit 30) q), '[]'),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'position', i.position, 'phase', i.phase, 'label', i.label, 'sort', i.sort, 'active', i.is_active) order by i.phase, i.position nulls first, i.sort) from public.ops_checklist_items i), '[]')
  );
end $$;

create or replace function public.ops_whoami() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('mgr', public.ops_is_mgr(), 'field', exists (select 1 from public.pk_people p where p.id = public.pk_me() and (p.role = 'lapangan' or exists (select 1 from public.ops_assignments a where a.person_id = p.id))))
$$;

grant execute on function public.ops_home(), public.ops_check_save(text, uuid[], text), public.ops_clock_out(), public.ops_ot_request(date, time, time, text),
  public.ops_ot_assign(uuid, date, time, time, text), public.ops_ot_decide(uuid, boolean, text), public.ops_ot_cancel(uuid),
  public.ops_assign(uuid, text, uuid, date, text, text), public.ops_assign_end(uuid, date), public.ops_person_add(text, text, text, text, text, uuid, date),
  public.ops_schedule_set(uuid, date, text, time, time), public.ops_item_save(uuid, text, text, text, int, boolean), public.ops_team(date), public.ops_whoami(), public.ops_is_mgr(), public.pk_member() to authenticated;

-- 9) ceklis awal (bisa diubah di Tim Operasional)
insert into public.ops_checklist_items(position, phase, label, sort)
select * from (values
  (null, 'buka', 'Seragam dan ID card rapi', 1), (null, 'buka', 'Baca info dan target hari ini dari Operasional', 2),
  ('kasir', 'buka', 'Hitung kas awal, buka shift di panel Kasir', 10), ('kasir', 'buka', 'Cek unit siap sewa dan kebersihan etalase', 11), ('kasir', 'buka', 'Tablet, QRIS, dan internet cabang menyala', 12),
  ('cs', 'buka', 'Balas chat yang tertunda dari semalam', 10), ('cs', 'buka', 'Cek booking dan pengembalian hari ini', 11),
  ('runner', 'buka', 'Cek agenda antar dan jemput hari ini', 10), ('runner', 'buka', 'Kendaraan siap: BBM, ban, rem, lampu', 11),
  ('sopir', 'buka', 'Cek jeep: rem, ban, BBM, kebersihan', 10), ('sopir', 'buka', 'Cek jadwal trip dan titik jemput tamu', 11),
  ('teknisi', 'buka', 'Cek antrean servis dan unit rusak', 10),
  ('qc', 'buka', 'Cek unit kembali kemarin yang belum di-QC', 10),
  ('kepala_cabang', 'buka', 'Briefing tim dan cek jadwal shift', 10),
  (null, 'tutup', 'Area kerja rapi dan barang kembali ke tempatnya', 90),
  ('kasir', 'tutup', 'Tutup shift kas di panel Kasir (kas dihitung)', 20), ('kasir', 'tutup', 'KTP jaminan dihitung dan disimpan', 21), ('kasir', 'tutup', 'Unit dan cabang dikunci', 22),
  ('cs', 'tutup', 'Serah terima chat yang belum selesai ke shift berikutnya', 20),
  ('runner', 'tutup', 'Setor uang tagihan dan KTP ke kasir', 20), ('runner', 'tutup', 'Laporkan tugas gagal atau tertunda', 21),
  ('sopir', 'tutup', 'Laporkan kondisi jeep dan BBM akhir', 20),
  ('teknisi', 'tutup', 'Catat part terpakai dan status servis', 20),
  ('qc', 'tutup', 'Semua unit kembali hari ini sudah di-QC', 20),
  ('kepala_cabang', 'tutup', 'Cek setoran kas dan laporan harian cabang', 20)
) v(position, phase, label, sort)
where not exists (select 1 from public.ops_checklist_items);
