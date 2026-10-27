-- 005c: fungsi alur kerja diperketat
create or replace function public.pk_task_submit(p_task uuid, p_link text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare t public.pk_tasks; me uuid := public.pk_me();
begin
  select * into t from public.pk_tasks where id = p_task for update;
  if t.id is null then raise exception 'Pekerjaan tidak ditemukan'; end if;
  if me is distinct from t.pic_id then raise exception 'Hanya PIC yang bisa mengajukan hasil'; end if;
  if t.reviewer_id is null then raise exception 'Tentukan reviewer dulu'; end if;
  if t.status in ('review','done') then raise exception 'Pekerjaan ini sudah diajukan atau selesai'; end if;
  if coalesce(nullif(btrim(p_link),''), t.last_link) is not null and coalesce(nullif(btrim(p_link),''), t.last_link) !~* '^https?://' then
    raise exception 'Tautan hasil harus diawali https://';
  end if;
  if t.status = 'revisi' and exists (select 1 from public.pk_review_points where task_id = p_task and status = 'open') then
    raise exception 'Jawab dulu semua poin revisi sebelum mengajukan ulang';
  end if;
  perform public.pk_rpc_on();
  update public.pk_tasks set status = 'review', version = version + 1, last_link = coalesce(nullif(btrim(p_link),''), last_link),
    progress = greatest(progress, 90) where id = p_task;
  perform set_config('pk.rpc', '', true);
  insert into public.pk_task_log(task_id, actor_id, action, note) values (p_task, me, 'ajukan', coalesce(p_note, p_link));
end $$;

create or replace function public.pk_task_review(p_task uuid, p_decision text, p_points text[] default '{}', p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare t public.pk_tasks; me uuid := public.pk_me(); pt text; d date := public.pk_today(); n int := 0;
  days int := greatest(public.pk_setting_num('review_revise_days', 2)::int, 1);
begin
  select * into t from public.pk_tasks where id = p_task for update;
  if t.id is null then raise exception 'Pekerjaan tidak ditemukan'; end if;
  if me is distinct from t.reviewer_id and not public.pk_is_admin() then raise exception 'Hanya reviewer yang bisa memutuskan'; end if;
  if me = t.pic_id then raise exception 'PIC tidak bisa mereview pekerjaannya sendiri'; end if;
  if t.status <> 'review' then raise exception 'Pekerjaan ini tidak sedang menunggu review'; end if;
  perform public.pk_rpc_on();
  if p_decision = 'approve' then
    if exists (select 1 from public.pk_review_points where task_id = p_task and status <> 'accepted') then
      raise exception 'Masih ada poin revisi yang belum diterima';
    end if;
    update public.pk_tasks set status = 'done', progress = 100, done_at = now() where id = p_task;
    insert into public.pk_task_log(task_id, actor_id, action, note) values (p_task, me, 'setujui', p_note);
  elsif p_decision = 'revise' then
    if coalesce(array_length(p_points,1),0) = 0 and not exists (select 1 from public.pk_review_points where task_id = p_task and status in ('open','fixed','disagree')) then
      raise exception 'Tulis minimal satu poin yang harus diperbaiki';
    end if;
    while n < days loop d := d + 1; if extract(isodow from d) <> 7 then n := n + 1; end if; end loop;
    update public.pk_review_points set status = 'open' where task_id = p_task and status in ('fixed','disagree');
    update public.pk_tasks set status = 'revisi', round = round + 1, revise_due = d where id = p_task;
    foreach pt in array p_points loop
      if btrim(pt) <> '' then
        insert into public.pk_review_points(task_id, round, text, created_by) values (p_task, t.round + 1, btrim(pt), me);
      end if;
    end loop;
    insert into public.pk_task_log(task_id, actor_id, action, note) values (p_task, me, 'revisi', p_note);
  else
    raise exception 'Keputusan tidak dikenal';
  end if;
  perform set_config('pk.rpc', '', true);
end $$;

create or replace function public.pk_request_triage(p_id uuid, p_action text, p_pic uuid default null, p_reason text default null, p_project uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me();
begin
  if not public.pk_is_admin() then raise exception 'Hanya Kepala Staf atau CEO yang memilah permintaan'; end if;
  perform public.pk_rpc_on();
  if p_action = 'terima' then
    if p_pic is null then raise exception 'Pilih siapa yang mengerjakan'; end if;
    update public.pk_requests set status = 'diterima', pic_id = p_pic, project_id = p_project, triage_by = me, triage_at = now(), reason = p_reason where id = p_id;
  elsif p_action in ('tunda','tolak','perjelas') then
    if coalesce(btrim(p_reason),'') = '' then raise exception 'Tulis alasannya untuk pengaju'; end if;
    update public.pk_requests set status = case p_action when 'tunda' then 'ditunda' when 'tolak' then 'ditolak' else 'diperjelas' end,
      triage_by = me, triage_at = now(), reason = p_reason where id = p_id;
  else raise exception 'Aksi tidak dikenal'; end if;
  perform set_config('pk.rpc', '', true);
end $$;

create or replace function public.pk_request_to_task(p_id uuid, p_due date, p_reviewer uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); r public.pk_requests; t uuid; u text; rv uuid;
begin
  select * into r from public.pk_requests where id = p_id for update;
  if r.id is null then raise exception 'Permintaan tidak ditemukan'; end if;
  if me is distinct from r.pic_id and not public.pk_is_admin() then raise exception 'Hanya PIC yang bisa menerima'; end if;
  if r.status <> 'diterima' then raise exception 'Permintaan ini belum dipilah atau sudah diproses'; end if;
  rv := coalesce(p_reviewer, r.from_id);
  if rv = r.pic_id then rv := (select boss_id from public.pk_people where id = r.pic_id); end if;
  select unit_code into u from public.pk_people where id = r.pic_id;
  perform public.pk_rpc_on();
  insert into public.pk_tasks(project_id, unit_code, title, dod, pic_id, reviewer_id, due, source, request_id, created_by)
    values (r.project_id, u, r.title, r.description, r.pic_id, rv, coalesce(p_due, r.due), 'permintaan', r.id, me)
    returning id into t;
  update public.pk_requests set status = 'jadi_tugas', task_id = t where id = p_id;
  perform set_config('pk.rpc', '', true);
  insert into public.pk_task_log(task_id, actor_id, action, note) values (t, me, 'dibuat', 'Dari permintaan bantuan');
  return t;
end $$;

-- ===== RAB =====
create or replace function public.pk_rab_chain(p_person uuid, p_total bigint) returns uuid[]
language plpgsql stable security definer set search_path = public as $$
declare p public.pk_people; ks uuid; ceo uuid; c uuid[] := '{}'; o uuid[] := '{}'; x uuid; i int;
  l1 bigint := public.pk_setting_num('rab_limit_atasan', 1000000);
  l2 bigint := public.pk_setting_num('rab_limit_kepala_staf', 5000000);
begin
  select * into p from public.pk_people where id = p_person;
  if p.id is null then raise exception 'Pengaju tidak dikenal'; end if;
  select id into ks from public.pk_people where role = 'kepala_staf' and is_active order by created_at limit 1;
  select id into ceo from public.pk_people where role = 'ceo' and is_active order by created_at limit 1;
  if ceo is null then raise exception 'CEO belum terdaftar di sistem'; end if;
  if p.role in ('leader','keuangan') then c := array[coalesce(ks, ceo)];
  elsif p.role = 'kepala_staf' then c := array[ceo];
  elsif p.role = 'ceo' then c := '{}';
  else
    c := array[coalesce(p.boss_id, ks, ceo)];
    if p_total > l1 then c := c || coalesce(ks, ceo); end if;
  end if;
  if p_total > l2 then c := c || ceo; end if;
  -- buang duplikat, simpan kemunculan terakhir (jabatan tertinggi menyetujui paling akhir)
  for i in reverse coalesce(array_length(c,1),0)..1 loop
    x := c[i];
    if x is not null and x <> p_person and not (x = any(o)) then o := array_prepend(x, o); end if;
  end loop;
  return o;
end $$;

create or replace function public.pk_rab_code(rc text) returns text
language plpgsql security definer set search_path = public as $$
declare n int; d text := to_char(public.pk_today(), 'DDMMYY'); pre text := 'RAB-' || rc || '-' || d || '-';
begin
  perform pg_advisory_xact_lock(hashtext(pre));
  select coalesce(max(nullif(regexp_replace(substr(code, length(pre) + 1), '\D', '', 'g'), '')::int), 0) + 1 into n
    from public.pk_rab where code like pre || '%';
  return pre || lpad(n::text, 2, '0');
end $$;

create or replace function public.pk_rab_submit(p_unit text, p_kind text, p_title text, p_need date, p_items jsonb,
  p_emergency boolean default false, p_via_app boolean default false, p_for uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); who uuid; rc text; v_code text; tot bigint; c uuid[]; rid uuid; it jsonb; i int := 0;
  biz text; emer boolean;
begin
  if me is null then raise exception 'Tidak berwenang'; end if;
  who := coalesce(p_for, me);
  if who <> me and not (public.pk_is_boss_of(who) or public.pk_is_admin()) then
    raise exception 'Hanya atasan langsung yang bisa mengajukan atas nama orang lain';
  end if;
  emer := coalesce(p_emergency, false) and coalesce(public.pk_role(),'') in ('leader','kepala_staf','ceo','keuangan');
  if coalesce(btrim(p_title),'') = '' then raise exception 'Isi untuk apa belanjanya'; end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 then raise exception 'Isi minimal satu barang'; end if;
  if exists (select 1 from jsonb_array_elements(p_items) x where coalesce((x->>'qty')::numeric, 0) <= 0 or coalesce((x->>'price')::bigint, -1) < 0) then
    raise exception 'Jumlah dan harga barang harus angka positif';
  end if;
  select coalesce(u.parent, u.code), coalesce(u.rab_code, pu.rab_code) into biz, rc
    from public.pk_units u left join public.pk_units pu on pu.code = u.parent where u.code = p_unit;
  if rc is null then raise exception 'Unit tidak dikenal'; end if;
  if not emer and exists (select 1 from public.pk_rab r join public.pk_units u on u.code = r.unit_code
       where coalesce(u.parent, u.code) = biz and r.status = 'cair'
         and r.cair_at < now() - make_interval(days => public.pk_setting_num('lpj_days', 2)::int)) then
    raise exception 'Ada RAB unit ini yang notanya terlambat. Upload nota dulu, baru bisa mengajukan RAB baru.';
  end if;
  select coalesce(sum((x->>'qty')::numeric * (x->>'price')::bigint), 0)::bigint into tot from jsonb_array_elements(p_items) x;
  c := public.pk_rab_chain(who, tot);
  v_code := public.pk_rab_code(rc);
  insert into public.pk_rab(code, unit_code, kind, title, need_date, created_by, via_app, total, chain, step, status, is_emergency)
    values (v_code, p_unit, coalesce(p_kind,'op'), btrim(p_title), p_need, who, p_via_app, tot, c, 0,
            case when coalesce(array_length(c,1),0) = 0 then 'siap_cair' else 'diajukan' end, emer)
    returning id into rid;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.pk_rab_items(rab_id, name, qty, price, sort) values (rid, it->>'name', (it->>'qty')::numeric, (it->>'price')::bigint, i);
    i := i + 1;
  end loop;
  insert into public.pk_rab_log(rab_id, actor_id, action, note) values (rid, me, 'ajukan',
    concat_ws(' · ', case when who <> me then 'Diajukan atas nama ' || (select nickname from public.pk_people where id = who) end, case when emer then 'dana darurat' end));
  return jsonb_build_object('id', rid, 'code', v_code, 'total', tot, 'chain', c);
end $$;

create or replace function public.pk_rab_lpj(p_id uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); r public.pk_rab; it jsonb; tot bigint;
begin
  select * into r from public.pk_rab where id = p_id for update;
  if r.id is null then raise exception 'RAB tidak ditemukan'; end if;
  if me is distinct from r.created_by and not public.pk_is_fin() then raise exception 'Hanya pengaju yang mengupload nota'; end if;
  if r.status <> 'cair' then raise exception 'Dana RAB ini belum cair'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    if (it->>'real_amount') is null or (it->>'real_amount')::bigint < 0 then raise exception 'Isi realisasi tiap barang (angka 0 atau lebih)'; end if;
    if coalesce(it->>'nota_link','') <> '' and (it->>'nota_link') !~* '^https?://' then raise exception 'Tautan nota harus diawali https://'; end if;
    update public.pk_rab_items set real_amount = (it->>'real_amount')::bigint, nota_link = nullif(btrim(it->>'nota_link'),'')
     where id = (it->>'id')::uuid and rab_id = p_id and active;
  end loop;
  if exists (select 1 from public.pk_rab_items where rab_id = p_id and active and real_amount is null) then
    raise exception 'Semua barang harus diisi realisasinya';
  end if;
  if not exists (select 1 from public.pk_rab_items where rab_id = p_id and active and nota_link is not null) then
    raise exception 'Lampirkan minimal satu tautan foto nota';
  end if;
  select coalesce(sum(real_amount),0)::bigint into tot from public.pk_rab_items where rab_id = p_id and active;
  update public.pk_rab set status = 'lpj', lpj_at = now(), realisasi = tot where id = p_id;
  insert into public.pk_rab_log(rab_id, actor_id, action) values (p_id, me, 'upload nota');
end $$;

-- CEO boleh menyetujui di luar giliran: langsung menyelesaikan semua langkah tersisa (tercatat di riwayat)
create or replace function public.pk_rab_decide(p_id uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); r public.pk_rab; turn boolean; ceo boolean := coalesce(public.pk_role(),'') = 'ceo';
begin
  select * into r from public.pk_rab where id = p_id for update;
  if r.id is null then raise exception 'RAB tidak ditemukan'; end if;
  if r.status <> 'diajukan' then raise exception 'RAB ini tidak sedang menunggu persetujuan'; end if;
  if me = r.created_by then raise exception 'Tidak bisa menyetujui RAB sendiri'; end if;
  turn := me is not distinct from r.chain[r.step + 1];
  if not turn and not ceo then raise exception 'Bukan giliran Anda menyetujui RAB ini'; end if;
  if p_action = 'approve' then
    if turn then
      update public.pk_rab set step = step + 1,
        status = case when step + 1 >= coalesce(array_length(chain,1),0) then 'siap_cair' else 'diajukan' end where id = p_id;
    else
      update public.pk_rab set step = coalesce(array_length(chain,1),0), status = 'siap_cair' where id = p_id;
      p_note := concat_ws(' · ', 'Disetujui CEO di luar giliran', p_note);
    end if;
  elsif p_action = 'revise' then
    if coalesce(btrim(p_note),'') = '' then raise exception 'Tulis apa yang perlu direvisi'; end if;
    update public.pk_rab set status = 'revisi', note = p_note where id = p_id;
  elsif p_action = 'reject' then
    if coalesce(btrim(p_note),'') = '' then raise exception 'Tulis alasan penolakan'; end if;
    update public.pk_rab set status = 'ditolak', note = p_note where id = p_id;
  else raise exception 'Aksi tidak dikenal'; end if;
  insert into public.pk_rab_log(rab_id, actor_id, action, note) values (p_id, me, p_action, p_note);
end $$;
