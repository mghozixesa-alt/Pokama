-- 006: tag tim di KKH + sisa perbaikan review keamanan
-- (sengaja tanpa perintah hapus di migrasi; salinan tag dilepas oleh pemilik slot lewat REST dengan policy di bawah)

-- ===== KKH: tag antar tim =====
alter table public.pk_kkh add column if not exists tag_of uuid;
create index if not exists pk_kkh_tag_of on public.pk_kkh(tag_of);

create or replace function public.pk_kkh_owner(p_id uuid) returns uuid
language sql stable security definer set search_path = public as $$ select person_id from public.pk_kkh where id = p_id $$;
revoke execute on function public.pk_kkh_owner(uuid) from public, anon;
grant execute on function public.pk_kkh_owner(uuid) to authenticated;

-- pemilik slot boleh melepas (mengosongkan) salinan tag di KKH orang lain, selama belum divalidasi
alter policy pk_kkh_d on public.pk_kkh
  using (status <> 'valid' and (person_id = public.pk_me() or (tag_of is not null and public.pk_kkh_owner(tag_of) = public.pk_me())));

-- Pemilik slot men-tag orang lain: slot yang sama masuk otomatis ke KKH mereka dan menimpa isi jam itu.
-- Slot yang sudah divalidasi tidak ditimpa (dilaporkan sebagai "terkunci").
create or replace function public.pk_kkh_tag(p_slot uuid, p_people uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); s public.pk_kkh; pid uuid; added int := 0; locked text[] := '{}'; ppl uuid[];
begin
  select * into s from public.pk_kkh where id = p_slot;
  if s.id is null then raise exception 'Slot tidak ditemukan'; end if;
  if s.person_id is distinct from me then raise exception 'Hanya pemilik slot yang bisa men-tag'; end if;
  if s.tag_of is not null then raise exception 'Slot ini hasil tag orang lain, tidak bisa men-tag lagi'; end if;
  select coalesce(array_agg(distinct x), '{}') into ppl from unnest(coalesce(p_people, '{}')) x
   where x <> me and exists (select 1 from public.pk_people p where p.id = x and p.is_active);
  foreach pid in array ppl loop
    if exists (select 1 from public.pk_kkh where person_id = pid and day = s.day and hour = s.hour and status = 'valid') then
      locked := locked || (select coalesce(nickname, name) from public.pk_people where id = pid);
      continue;
    end if;
    insert into public.pk_kkh(person_id, day, hour, code, mode, note, task_id, unit_code, status, tag_of)
      values (pid, s.day, s.hour, s.code, s.mode, s.note, null, (select unit_code from public.pk_people where id = pid), 'rencana', s.id)
    on conflict (person_id, day, hour) do update set code = excluded.code, mode = excluded.mode, note = excluded.note,
      task_id = case when pk_kkh.tag_of = s.id then pk_kkh.task_id end,
      status = case when pk_kkh.tag_of = s.id then pk_kkh.status else 'rencana' end,
      tag_of = s.id, updated_at = now();
    added := added + 1;
  end loop;
  return jsonb_build_object('tagged', added, 'locked', locked);
end $$;
revoke execute on function public.pk_kkh_tag(uuid, uuid[]) from public, anon;
grant execute on function public.pk_kkh_tag(uuid, uuid[]) to authenticated;

-- ===== RAB: rantai persetujuan berurutan sesuai jabatan =====
create or replace function public.pk_rank(p uuid) returns int language sql stable security definer set search_path = public as $$
  select case role when 'ceo' then 4 when 'kepala_staf' then 3 when 'keuangan' then 2 else 1 end from public.pk_people where id = p $$;

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
  for i in 1..coalesce(array_length(c,1),0) loop
    x := c[i];
    if x is not null and x <> p_person and not (x = any(o)) then o := o || x; end if;
  end loop;
  -- jabatan lebih tinggi menyetujui belakangan
  select coalesce(array_agg(u order by public.pk_rank(u), ord), '{}') into o from unnest(o) with ordinality t(u, ord);
  return o;
end $$;

create or replace function public.pk_rab_submit(p_unit text, p_kind text, p_title text, p_need date, p_items jsonb,
  p_emergency boolean default false, p_via_app boolean default false, p_for uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); who uuid; rc text; v_code text; tot bigint; c uuid[]; rid uuid; it jsonb; i int := 0;
  biz text; emer boolean;
begin
  if me is null then raise exception 'Tidak berwenang'; end if;
  who := coalesce(p_for, me);
  if who <> me then
    if not (public.pk_is_boss_of(who) or public.pk_is_admin()) or public.pk_rank(who) >= public.pk_rank(me)
       or (select role from public.pk_people where id = who) in ('ceo','kepala_staf','keuangan') then
      raise exception 'Hanya atasan yang bisa mengajukan atas nama bawahannya';
    end if;
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
  c := array_remove(public.pk_rab_chain(who, tot), me);          -- pengaju tidak menyetujui RAB yang ia ajukan
  if who <> me and coalesce(array_length(c,1),0) = 0 then
    c := array_remove(public.pk_rab_chain(me, tot), who);        -- naik ke atasan si pengaju
  end if;
  if who <> me and coalesce(array_length(c,1),0) = 0 and coalesce(public.pk_role(),'') <> 'ceo' then
    raise exception 'Tidak ada yang bisa menyetujui RAB ini';
  end if;
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

-- ===== cuti: hari Minggu tidak dihitung (sama dengan layar) =====
create or replace function public.pk_leave_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare used int; q int; n int;
begin
  if new.kind = 'cuti' then
    if coalesce(new.end_day, new.day) < new.day then raise exception 'Tanggal selesai tidak boleh sebelum tanggal mulai'; end if;
    select count(*) into n from generate_series(new.day, coalesce(new.end_day, new.day), interval '1 day') g where extract(isodow from g) <> 7;
    select coalesce(leave_quota, 12) into q from public.pk_people where id = new.person_id;
    select coalesce(sum((select count(*) from generate_series(l.day, coalesce(l.end_day, l.day), interval '1 day') g where extract(isodow from g) <> 7)), 0)
      into used from public.pk_leave l
     where l.person_id = new.person_id and l.kind = 'cuti' and l.status in ('diajukan','disetujui')
       and extract(year from l.day) = extract(year from new.day);
    if used + n > q then raise exception 'Saldo cuti tidak cukup (sisa % hari)', greatest(q - used, 0); end if;
  end if;
  return new;
end $$;
revoke execute on function public.pk_rank(uuid) from public, anon; grant execute on function public.pk_rank(uuid) to authenticated;
