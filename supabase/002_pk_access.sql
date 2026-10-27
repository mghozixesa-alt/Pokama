-- Sistem Kerja Pokama · identitas, aturan akses (RLS) dan fungsi alur kerja

-- ===== identitas =====
create or replace function public.pk_me() returns uuid
language sql stable security definer set search_path = public as $$
  select p.id from public.pk_people p
  where p.is_active and (
    p.user_id = auth.uid()
    or (p.email is not null and lower(p.email) = lower(coalesce(auth.jwt()->>'email','')))
    or (p.phone is not null and ('wa' || p.phone || '@login.rentalaja.co.id') = lower(coalesce(auth.jwt()->>'email','')))
  )
  order by (p.user_id = auth.uid()) desc nulls last
  limit 1
$$;

create or replace function public.pk_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.pk_people where id = public.pk_me()
$$;

create or replace function public.pk_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.pk_role() in ('ceo','kepala_staf'), false)
$$;

create or replace function public.pk_is_fin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.pk_role() in ('ceo','keuangan'), false)
$$;

create or replace function public.pk_is_boss_of(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pk_people x where x.id = p and public.pk_me() in (x.boss_id, x.valuer1_id, x.valuer2_id))
$$;

-- Dipanggil saat masuk: menautkan akun login ke data orang, mengembalikan profil
create or replace function public.pk_session() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public.pk_me(); r record;
begin
  if v is null then return null; end if;
  update public.pk_people set user_id = auth.uid()
   where id = v and user_id is null
     and not exists (select 1 from public.pk_people where user_id = auth.uid());
  select p.id, p.code, p.name, p.nickname, p.role, p.title, p.unit_code, p.photo, p.email, p.phone, p.boss_id
    into r from public.pk_people p where p.id = v;
  return to_jsonb(r);
end $$;

-- ===== aturan akses =====
do $$
declare t text;
begin
  foreach t in array array['pk_units','pk_people','pk_salary','pk_settings','pk_projects','pk_tasks','pk_review_points','pk_task_log',
    'pk_kkh','pk_requests','pk_rab','pk_rab_items','pk_rab_log','pk_leave','pk_omzet','pk_targets','pk_liga','pk_outputs','pk_perf','pk_documents'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- baca: semua anggota management
create policy pk_units_r on public.pk_units for select to authenticated using (public.pk_me() is not null);
create policy pk_units_w on public.pk_units for all to authenticated using (public.pk_is_admin()) with check (public.pk_is_admin());

create policy pk_people_r on public.pk_people for select to authenticated using (public.pk_me() is not null);
create policy pk_people_w on public.pk_people for all to authenticated using (public.pk_is_admin()) with check (public.pk_is_admin());

create policy pk_salary_all on public.pk_salary for all to authenticated using (public.pk_is_fin()) with check (public.pk_is_fin());

create policy pk_settings_r on public.pk_settings for select to authenticated using (public.pk_me() is not null);
create policy pk_settings_w on public.pk_settings for all to authenticated using (public.pk_is_admin()) with check (public.pk_is_admin());

create policy pk_projects_r on public.pk_projects for select to authenticated using (public.pk_me() is not null);
create policy pk_projects_i on public.pk_projects for insert to authenticated with check (public.pk_me() is not null);
create policy pk_projects_u on public.pk_projects for update to authenticated using (public.pk_is_admin() or owner_id = public.pk_me());
create policy pk_projects_d on public.pk_projects for delete to authenticated using (public.pk_is_admin() or owner_id = public.pk_me());

create policy pk_tasks_r on public.pk_tasks for select to authenticated using (public.pk_me() is not null);
create policy pk_tasks_i on public.pk_tasks for insert to authenticated with check (public.pk_me() is not null and created_by = public.pk_me());
create policy pk_tasks_u on public.pk_tasks for update to authenticated
  using (public.pk_is_admin() or public.pk_me() in (pic_id, reviewer_id, created_by));
create policy pk_tasks_d on public.pk_tasks for delete to authenticated using (public.pk_is_admin() or created_by = public.pk_me());

create policy pk_points_r on public.pk_review_points for select to authenticated using (public.pk_me() is not null);
create policy pk_tlog_r on public.pk_task_log for select to authenticated using (public.pk_me() is not null);
create policy pk_tlog_i on public.pk_task_log for insert to authenticated with check (actor_id = public.pk_me());

create policy pk_kkh_r on public.pk_kkh for select to authenticated using (public.pk_me() is not null);
create policy pk_kkh_i on public.pk_kkh for insert to authenticated with check (person_id = public.pk_me() and status <> 'valid');
create policy pk_kkh_u on public.pk_kkh for update to authenticated
  using (person_id = public.pk_me() and status <> 'valid') with check (person_id = public.pk_me() and status <> 'valid');
create policy pk_kkh_d on public.pk_kkh for delete to authenticated using (person_id = public.pk_me() and status <> 'valid');

create policy pk_req_r on public.pk_requests for select to authenticated using (public.pk_me() is not null);
create policy pk_req_i on public.pk_requests for insert to authenticated with check (from_id = public.pk_me() and status = 'baru');
create policy pk_req_u on public.pk_requests for update to authenticated
  using (public.pk_is_admin() or from_id = public.pk_me() or pic_id = public.pk_me());

create policy pk_rab_r on public.pk_rab for select to authenticated using (public.pk_me() is not null);
create policy pk_rabi_r on public.pk_rab_items for select to authenticated using (public.pk_me() is not null);
create policy pk_rabl_r on public.pk_rab_log for select to authenticated using (public.pk_me() is not null);

create policy pk_leave_r on public.pk_leave for select to authenticated using (public.pk_me() is not null);
create policy pk_leave_i on public.pk_leave for insert to authenticated with check (person_id = public.pk_me() and status = 'diajukan');
create policy pk_leave_d on public.pk_leave for delete to authenticated using (person_id = public.pk_me() and status = 'diajukan');

create policy pk_omzet_r on public.pk_omzet for select to authenticated using (public.pk_me() is not null);
create policy pk_omzet_i on public.pk_omzet for insert to authenticated with check (public.pk_me() is not null and reported_by = public.pk_me());
create policy pk_omzet_u on public.pk_omzet for update to authenticated using (reported_by = public.pk_me() or public.pk_is_fin());
create policy pk_omzet_d on public.pk_omzet for delete to authenticated using (reported_by = public.pk_me() or public.pk_is_fin());

create policy pk_targets_r on public.pk_targets for select to authenticated using (public.pk_me() is not null);
create policy pk_targets_i on public.pk_targets for insert to authenticated with check (public.pk_me() is not null and status = 'usulan');
create policy pk_targets_u on public.pk_targets for update to authenticated
  using (public.pk_is_fin() or public.pk_is_admin() or (proposed_by = public.pk_me() and status = 'usulan'));

create policy pk_liga_r on public.pk_liga for select to authenticated using (public.pk_me() is not null);
create policy pk_liga_w on public.pk_liga for all to authenticated using (public.pk_is_fin() or public.pk_is_admin()) with check (public.pk_is_fin() or public.pk_is_admin());

create policy pk_outputs_r on public.pk_outputs for select to authenticated
  using (person_id = public.pk_me() or public.pk_is_fin() or public.pk_is_admin() or public.pk_is_boss_of(person_id));
create policy pk_outputs_w on public.pk_outputs for all to authenticated
  using (public.pk_is_fin() or public.pk_is_admin() or public.pk_is_boss_of(person_id))
  with check (public.pk_is_fin() or public.pk_is_admin() or public.pk_is_boss_of(person_id));

create policy pk_perf_r on public.pk_perf for select to authenticated
  using (person_id = public.pk_me() or public.pk_is_fin() or public.pk_is_admin() or public.pk_is_boss_of(person_id));
create policy pk_perf_w on public.pk_perf for all to authenticated
  using (public.pk_is_fin() or public.pk_is_admin() or public.pk_is_boss_of(person_id))
  with check (public.pk_is_fin() or public.pk_is_admin() or public.pk_is_boss_of(person_id));

create policy pk_docs_r on public.pk_documents for select to authenticated
  using (public.pk_me() is not null and (not restricted or public.pk_is_fin() or owner_id = public.pk_me()));
create policy pk_docs_i on public.pk_documents for insert to authenticated with check (public.pk_me() is not null and owner_id = public.pk_me());
create policy pk_docs_u on public.pk_documents for update to authenticated using (public.pk_is_admin() or owner_id = public.pk_me());
create policy pk_docs_d on public.pk_documents for delete to authenticated using (public.pk_is_admin() or owner_id = public.pk_me());

-- ===== penjaga: pekerjaan hanya selesai lewat reviewer =====
create or replace function public.pk_tasks_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.status = 'done' and old.status is distinct from 'done'
     and coalesce(current_setting('pk.allow_done', true), '') <> '1' then
    raise exception 'Pekerjaan hanya bisa ditandai selesai oleh reviewer lewat Review & Revisi';
  end if;
  if old.status = 'done' and new.status <> 'done' and not public.pk_is_admin() and public.pk_me() is distinct from old.reviewer_id then
    raise exception 'Hanya reviewer atau Kepala Staf yang bisa membuka lagi pekerjaan yang sudah selesai';
  end if;
  return new;
end $$;
drop trigger if exists pk_tasks_guard on public.pk_tasks;
create trigger pk_tasks_guard before update on public.pk_tasks for each row execute function public.pk_tasks_guard();

-- ===== Review & revisi =====
create or replace function public.pk_task_submit(p_task uuid, p_link text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare t public.pk_tasks; me uuid := public.pk_me();
begin
  select * into t from public.pk_tasks where id = p_task for update;
  if t.id is null then raise exception 'Pekerjaan tidak ditemukan'; end if;
  if me is distinct from t.pic_id then raise exception 'Hanya PIC yang bisa mengajukan hasil'; end if;
  if t.reviewer_id is null then raise exception 'Tentukan reviewer dulu'; end if;
  if t.status = 'revisi' and exists (select 1 from public.pk_review_points where task_id = p_task and status = 'open') then
    raise exception 'Jawab dulu semua poin revisi sebelum mengajukan ulang';
  end if;
  update public.pk_tasks set status = 'review', version = version + 1, last_link = coalesce(nullif(p_link,''), last_link),
    progress = greatest(progress, 90) where id = p_task;
  insert into public.pk_task_log(task_id, actor_id, action, note) values (p_task, me, 'ajukan', coalesce(p_note, p_link));
end $$;

create or replace function public.pk_task_review(p_task uuid, p_decision text, p_points text[] default '{}', p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare t public.pk_tasks; me uuid := public.pk_me(); pt text; d date := current_date; n int := 0;
begin
  select * into t from public.pk_tasks where id = p_task for update;
  if t.id is null then raise exception 'Pekerjaan tidak ditemukan'; end if;
  if me is distinct from t.reviewer_id and not public.pk_is_admin() then raise exception 'Hanya reviewer yang bisa memutuskan'; end if;
  if me = t.pic_id then raise exception 'PIC tidak bisa mereview pekerjaannya sendiri'; end if;
  if p_decision = 'approve' then
    if exists (select 1 from public.pk_review_points where task_id = p_task and status <> 'accepted') then
      raise exception 'Masih ada poin revisi yang belum diterima';
    end if;
    perform set_config('pk.allow_done', '1', true);
    update public.pk_tasks set status = 'done', progress = 100, done_at = now() where id = p_task;
    perform set_config('pk.allow_done', '', true);
    insert into public.pk_task_log(task_id, actor_id, action, note) values (p_task, me, 'setujui', p_note);
  elsif p_decision = 'revise' then
    if coalesce(array_length(p_points,1),0) = 0 and not exists (select 1 from public.pk_review_points where task_id = p_task and status in ('open','fixed','disagree')) then
      raise exception 'Tulis minimal satu poin yang harus diperbaiki';
    end if;
    -- tenggat revisi: 2 hari kerja (Senin–Sabtu)
    while n < 2 loop d := d + 1; if extract(isodow from d) <> 7 then n := n + 1; end if; end loop;
    update public.pk_tasks set status = 'revisi', round = round + 1, revise_due = d where id = p_task;
    foreach pt in array p_points loop
      if btrim(pt) <> '' then
        insert into public.pk_review_points(task_id, round, text, created_by) values (p_task, t.round + 1, btrim(pt), me);
      end if;
    end loop;
    -- poin lama yang dijawab tapi belum diterima kembali terbuka
    update public.pk_review_points set status = 'open' where task_id = p_task and status in ('fixed','disagree');
    insert into public.pk_task_log(task_id, actor_id, action, note) values (p_task, me, 'revisi', p_note);
  else
    raise exception 'Keputusan tidak dikenal';
  end if;
end $$;

create or replace function public.pk_point_answer(p_point uuid, p_status text, p_answer text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); t public.pk_tasks;
begin
  select k.* into t from public.pk_tasks k join public.pk_review_points r on r.task_id = k.id where r.id = p_point;
  if me is distinct from t.pic_id then raise exception 'Hanya PIC yang menjawab poin revisi'; end if;
  if p_status not in ('fixed','disagree') then raise exception 'Status jawaban tidak dikenal'; end if;
  if coalesce(btrim(p_answer),'') = '' then raise exception 'Sertakan bukti atau alasan'; end if;
  update public.pk_review_points set status = p_status, answer = p_answer, answered_at = now() where id = p_point;
end $$;

create or replace function public.pk_point_accept(p_point uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); t public.pk_tasks;
begin
  select k.* into t from public.pk_tasks k join public.pk_review_points r on r.task_id = k.id where r.id = p_point;
  if me is distinct from t.reviewer_id and not public.pk_is_admin() then raise exception 'Hanya reviewer yang menerima poin'; end if;
  update public.pk_review_points set status = case when p_accept then 'accepted' else 'open' end where id = p_point;
end $$;

-- ===== KKH: validasi oleh valuer =====
create or replace function public.pk_kkh_validate(p_ids uuid[], p_valid boolean default true) returns int
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); n int;
begin
  update public.pk_kkh k set status = case when p_valid then 'valid' else 'siap' end,
         validated_by = case when p_valid then me else null end,
         validated_at = case when p_valid then now() else null end
   where k.id = any(p_ids)
     and k.person_id <> me
     and (public.pk_is_admin() or exists (select 1 from public.pk_people x where x.id = k.person_id and me in (x.valuer1_id, x.valuer2_id)));
  get diagnostics n = row_count;
  return n;
end $$;

-- ===== Permintaan Bantuan =====
create or replace function public.pk_request_triage(p_id uuid, p_action text, p_pic uuid default null, p_reason text default null, p_project uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me();
begin
  if not public.pk_is_admin() then raise exception 'Hanya Kepala Staf atau CEO yang memilah permintaan'; end if;
  if p_action = 'terima' then
    if p_pic is null then raise exception 'Pilih siapa yang mengerjakan'; end if;
    update public.pk_requests set status = 'diterima', pic_id = p_pic, project_id = p_project, triage_by = me, triage_at = now(), reason = p_reason where id = p_id;
  elsif p_action in ('tunda','tolak','perjelas') then
    if coalesce(btrim(p_reason),'') = '' then raise exception 'Tulis alasannya untuk pengaju'; end if;
    update public.pk_requests set status = case p_action when 'tunda' then 'ditunda' when 'tolak' then 'ditolak' else 'diperjelas' end,
      triage_by = me, triage_at = now(), reason = p_reason where id = p_id;
  else raise exception 'Aksi tidak dikenal'; end if;
end $$;

create or replace function public.pk_request_to_task(p_id uuid, p_due date, p_reviewer uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); r public.pk_requests; t uuid; u text;
begin
  select * into r from public.pk_requests where id = p_id for update;
  if r.id is null then raise exception 'Permintaan tidak ditemukan'; end if;
  if me is distinct from r.pic_id and not public.pk_is_admin() then raise exception 'Hanya PIC yang bisa menerima'; end if;
  if r.status not in ('diterima','baru') then raise exception 'Permintaan ini sudah diproses'; end if;
  select unit_code into u from public.pk_people where id = r.pic_id;
  insert into public.pk_tasks(project_id, unit_code, title, dod, pic_id, reviewer_id, due, source, request_id, created_by)
    values (r.project_id, u, r.title, r.description, r.pic_id, coalesce(p_reviewer, r.from_id), coalesce(p_due, r.due), 'permintaan', r.id, me)
    returning id into t;
  update public.pk_requests set status = 'jadi_tugas', task_id = t where id = p_id;
  insert into public.pk_task_log(task_id, actor_id, action, note) values (t, me, 'dibuat', 'Dari permintaan bantuan');
  return t;
end $$;

-- ===== Pengajuan Belanja (RAB) =====
create or replace function public.pk_setting_num(k text, def bigint) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::bigint from public.pk_settings where key = k), def)
$$;

create or replace function public.pk_rab_chain(p_person uuid, p_total bigint) returns uuid[]
language plpgsql stable security definer set search_path = public as $$
declare p public.pk_people; ks uuid; ceo uuid; c uuid[] := '{}';
  l1 bigint := public.pk_setting_num('rab_limit_atasan', 1000000);
  l2 bigint := public.pk_setting_num('rab_limit_kepala_staf', 5000000);
begin
  select * into p from public.pk_people where id = p_person;
  select id into ks from public.pk_people where role = 'kepala_staf' and is_active order by created_at limit 1;
  select id into ceo from public.pk_people where role = 'ceo' and is_active order by created_at limit 1;
  if p.role in ('leader','keuangan') then
    c := array[coalesce(ks, ceo)];
  elsif p.role = 'kepala_staf' then
    c := array[ceo];
  elsif p.role = 'ceo' then
    c := '{}';
  else
    c := array[coalesce(p.boss_id, ks)];
    if p_total > l1 then c := c || ks; end if;
  end if;
  if p_total > l2 then c := c || ceo; end if;
  -- buang yang kosong, duplikat berurutan, dan diri sendiri
  select coalesce(array_agg(x order by i), '{}') into c from (
    select x, i from unnest(c) with ordinality u(x, i)
    where x is not null and x <> p_person
  ) s;
  select coalesce(array_agg(x order by i), '{}') into c from (
    select x, i, lag(x) over (order by i) as prev from unnest(c) with ordinality u(x, i)
  ) s where prev is distinct from x;
  return c;
end $$;

create or replace function public.pk_rab_submit(p_unit text, p_kind text, p_title text, p_need date, p_items jsonb,
  p_emergency boolean default false, p_via_app boolean default false, p_for uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); who uuid; rc text; v_code text; n int; tot bigint; c uuid[]; rid uuid; it jsonb; i int := 0;
begin
  if me is null then raise exception 'Tidak berwenang'; end if;
  who := coalesce(p_for, me);   -- Leader bisa mengajukan atas nama crew (dari Rentalaja App)
  if coalesce(btrim(p_title),'') = '' then raise exception 'Isi untuk apa belanjanya'; end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 then raise exception 'Isi minimal satu barang'; end if;
  select rab_code into rc from public.pk_units where code = p_unit;
  if rc is null then select u2.rab_code into rc from public.pk_units u1 join public.pk_units u2 on u2.code = u1.parent where u1.code = p_unit; end if;
  if rc is null then raise exception 'Unit tidak dikenal'; end if;
  if not p_emergency and exists (select 1 from public.pk_rab where unit_code = p_unit and status = 'cair'
       and cair_at < now() - make_interval(days => public.pk_setting_num('lpj_days', 2)::int)) then
    raise exception 'Ada RAB unit ini yang notanya terlambat. Upload nota dulu, baru bisa mengajukan RAB baru.';
  end if;
  select coalesce(sum((x->>'qty')::numeric * (x->>'price')::bigint), 0)::bigint into tot from jsonb_array_elements(p_items) x;
  c := public.pk_rab_chain(who, tot);
  select count(*) + 1 into n from public.pk_rab where code like 'RAB-' || rc || '-' || to_char(current_date, 'DDMMYY') || '-%';
  v_code := 'RAB-' || rc || '-' || to_char(current_date, 'DDMMYY') || '-' || lpad(n::text, 2, '0');
  insert into public.pk_rab(code, unit_code, kind, title, need_date, created_by, via_app, total, chain, step, status, is_emergency)
    values (v_code, p_unit, coalesce(p_kind,'op'), btrim(p_title), p_need, who, p_via_app, tot, c, 0,
            case when coalesce(array_length(c,1),0) = 0 then 'siap_cair' else 'diajukan' end, p_emergency)
    returning id into rid;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.pk_rab_items(rab_id, name, qty, price, sort) values (rid, it->>'name', (it->>'qty')::numeric, (it->>'price')::bigint, i);
    i := i + 1;
  end loop;
  insert into public.pk_rab_log(rab_id, actor_id, action, note) values (rid, me, 'ajukan', case when p_for is not null then 'Diajukan atas nama crew' end);
  return jsonb_build_object('id', rid, 'code', v_code, 'total', tot, 'chain', c);
end $$;

create or replace function public.pk_rab_decide(p_id uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); r public.pk_rab;
begin
  select * into r from public.pk_rab where id = p_id for update;
  if r.id is null then raise exception 'RAB tidak ditemukan'; end if;
  if r.status <> 'diajukan' then raise exception 'RAB ini tidak sedang menunggu persetujuan'; end if;
  if me is distinct from r.chain[r.step + 1] and public.pk_role() <> 'ceo' then raise exception 'Bukan giliran Anda menyetujui RAB ini'; end if;
  if p_action = 'approve' then
    update public.pk_rab set step = step + 1,
      status = case when step + 1 >= coalesce(array_length(chain,1),0) then 'siap_cair' else 'diajukan' end where id = p_id;
  elsif p_action = 'revise' then
    if coalesce(btrim(p_note),'') = '' then raise exception 'Tulis apa yang perlu direvisi'; end if;
    update public.pk_rab set status = 'revisi', note = p_note where id = p_id;
  elsif p_action = 'reject' then
    if coalesce(btrim(p_note),'') = '' then raise exception 'Tulis alasan penolakan'; end if;
    update public.pk_rab set status = 'ditolak', note = p_note where id = p_id;
  else raise exception 'Aksi tidak dikenal'; end if;
  insert into public.pk_rab_log(rab_id, actor_id, action, note) values (p_id, me, p_action, p_note);
end $$;

create or replace function public.pk_rab_resubmit(p_id uuid, p_title text, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); r public.pk_rab; tot bigint; it jsonb; i int := 0;
begin
  select * into r from public.pk_rab where id = p_id for update;
  if me is distinct from r.created_by then raise exception 'Hanya pengaju yang bisa merevisi'; end if;
  if r.status <> 'revisi' then raise exception 'RAB ini tidak sedang diminta revisi'; end if;
  delete from public.pk_rab_items where rab_id = p_id;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.pk_rab_items(rab_id, name, qty, price, sort) values (p_id, it->>'name', (it->>'qty')::numeric, (it->>'price')::bigint, i); i := i + 1;
  end loop;
  select coalesce(sum(qty * price),0)::bigint into tot from public.pk_rab_items where rab_id = p_id;
  update public.pk_rab set title = coalesce(nullif(btrim(p_title),''), title), total = tot,
    chain = public.pk_rab_chain(created_by, tot), step = 0, status = 'diajukan', note = null where id = p_id;
  insert into public.pk_rab_log(rab_id, actor_id, action) values (p_id, me, 'ajukan ulang');
end $$;

create or replace function public.pk_rab_cair(p_id uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me();
begin
  if not public.pk_is_fin() then raise exception 'Hanya Keuangan yang mencairkan dana'; end if;
  update public.pk_rab set status = 'cair', cair_at = now(), cair_by = me where id = p_id and status = 'siap_cair';
  if not found then raise exception 'RAB belum siap dicairkan'; end if;
  insert into public.pk_rab_log(rab_id, actor_id, action, note) values (p_id, me, 'cair', p_note);
end $$;

create or replace function public.pk_rab_lpj(p_id uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); r public.pk_rab; it jsonb; tot bigint;
begin
  select * into r from public.pk_rab where id = p_id for update;
  if me is distinct from r.created_by and not public.pk_is_fin() then raise exception 'Hanya pengaju yang mengupload nota'; end if;
  if r.status <> 'cair' then raise exception 'Dana RAB ini belum cair'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    update public.pk_rab_items set real_amount = (it->>'real_amount')::bigint, nota_link = it->>'nota_link'
     where id = (it->>'id')::uuid and rab_id = p_id;
  end loop;
  select coalesce(sum(coalesce(real_amount,0)),0)::bigint into tot from public.pk_rab_items where rab_id = p_id;
  update public.pk_rab set status = 'lpj', lpj_at = now(), realisasi = tot where id = p_id;
  insert into public.pk_rab_log(rab_id, actor_id, action) values (p_id, me, 'upload nota');
end $$;

create or replace function public.pk_rab_close(p_id uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me();
begin
  if not public.pk_is_fin() then raise exception 'Hanya Keuangan yang menutup RAB'; end if;
  update public.pk_rab set status = 'selesai', done_at = now(), note = coalesce(p_note, note) where id = p_id and status = 'lpj';
  if not found then raise exception 'Nota RAB ini belum masuk'; end if;
  insert into public.pk_rab_log(rab_id, actor_id, action, note) values (p_id, me, 'selesai', p_note);
end $$;

-- ===== Kehadiran: libur & cuti =====
create or replace function public.pk_leave_decide(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); l public.pk_leave;
begin
  select * into l from public.pk_leave where id = p_id for update;
  if l.id is null then raise exception 'Pengajuan tidak ditemukan'; end if;
  if l.person_id = me then raise exception 'Tidak bisa menyetujui pengajuan sendiri'; end if;
  if not (public.pk_is_admin() or exists (select 1 from public.pk_people x where x.id = l.person_id and x.boss_id = me)) then
    raise exception 'Hanya atasan langsung yang menyetujui';
  end if;
  update public.pk_leave set status = case when p_approve then 'disetujui' else 'ditolak' end, decided_by = me, decided_at = now() where id = p_id;
end $$;

-- ===== Target: dicek Keuangan, disahkan CEO =====
create or replace function public.pk_target_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me();
begin
  if p_status = 'dicek' and public.pk_is_fin() then
    update public.pk_targets set status = 'dicek', checked_by = me, updated_at = now() where id = p_id;
  elsif p_status = 'sah' and public.pk_role() = 'ceo' then
    update public.pk_targets set status = 'sah', approved_by = me, updated_at = now() where id = p_id;
  else raise exception 'Tidak berwenang'; end if;
end $$;

-- hak eksekusi
do $$
declare f text;
begin
  foreach f in array array['pk_me()','pk_role()','pk_is_admin()','pk_is_fin()','pk_is_boss_of(uuid)','pk_session()',
    'pk_task_submit(uuid,text,text)','pk_task_review(uuid,text,text[],text)','pk_point_answer(uuid,text,text)','pk_point_accept(uuid,boolean)',
    'pk_kkh_validate(uuid[],boolean)','pk_request_triage(uuid,text,uuid,text,uuid)','pk_request_to_task(uuid,date,uuid)',
    'pk_setting_num(text,bigint)','pk_rab_chain(uuid,bigint)','pk_rab_submit(text,text,text,date,jsonb,boolean,boolean,uuid)',
    'pk_rab_decide(uuid,text,text)','pk_rab_resubmit(uuid,text,jsonb)','pk_rab_cair(uuid,text)','pk_rab_lpj(uuid,jsonb)','pk_rab_close(uuid,text)',
    'pk_leave_decide(uuid,boolean)','pk_target_status(uuid,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
