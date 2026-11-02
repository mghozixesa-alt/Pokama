-- KKH wajib terisi penuh sebelum batas pagi (default 10.00 WIB).
-- 30 menit sebelum batas: pengingat ke yang belum lengkap. Saat batas: tercatat "telat isi KKH"
-- (potongan disiplin sama dengan telat absen, dihitung terpisah), orangnya & atasannya diberi tahu.

insert into public.pk_settings(key, value, note) values
  ('kkh_fill_deadline', '10'::jsonb, 'Batas KKH terisi penuh (jam, 10 = 10.00)'),
  ('kkh_remind_before_min', '30'::jsonb, 'Pengingat isi KKH sekian menit sebelum batas'),
  ('kkh_check_days', '"1,2,3,4,5,6"'::jsonb, 'Hari dicek isi KKH (0=Minggu … 6=Sabtu)')
on conflict (key) do nothing;

create table if not exists public.pk_kkh_miss (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.pk_people(id) on delete cascade,
  day date not null,
  filled int not null default 0,
  created_at timestamptz not null default now(),
  unique (person_id, day)
);
alter table public.pk_kkh_miss enable row level security;
drop policy if exists pk_kkh_miss_r on public.pk_kkh_miss;
create policy pk_kkh_miss_r on public.pk_kkh_miss for select using ((public.pk_member() is not null) or (person_id = public.pk_me()));

create table if not exists public.pk_kkh_check_log (day date not null, stage text not null, at timestamptz not null default now(), primary key (day, stage));
alter table public.pk_kkh_check_log enable row level security;

create or replace function public.pk_kkh_tick()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  wib timestamp := (now() at time zone 'Asia/Jakarta'); d date := wib::date;
  need int := public.pk_setting_num('kkh_daily_hours', 8)::int;
  dl int := public.pk_setting_num('kkh_fill_deadline', 10)::int;
  rb int := public.pk_setting_num('kkh_remind_before_min', 30)::int;
  warn int := public.pk_setting_num('late_warn_count', 3)::int;
  pen numeric := public.pk_setting_num('late_penalty_pct', 2);
  days text := coalesce((select value #>> '{}' from public.pk_settings where key = 'kkh_check_days'), '1,2,3,4,5,6');
  mins int := extract(hour from wib)::int * 60 + extract(minute from wib)::int;
  v_stage text; p record; f int; n int; b record; names text; urgent boolean; done int := 0;
begin
  if not (extract(dow from d)::int)::text = any (string_to_array(replace(days, ' ', ''), ',')) then return jsonb_build_object('skip', 'hari tidak dicek'); end if;
  if mins >= dl * 60 then v_stage := 'deadline'; elsif mins >= dl * 60 - rb then v_stage := 'remind'; else return jsonb_build_object('skip', 'belum waktunya'); end if;
  if mins > dl * 60 + 180 then return jsonb_build_object('skip', 'lewat jendela'); end if;
  if exists (select 1 from public.pk_kkh_check_log l where l.day = d and l.stage = v_stage) then return jsonb_build_object('skip', 'sudah jalan'); end if;
  insert into public.pk_kkh_check_log(day, stage) values (d, v_stage);

  for p in
    select x.id, x.boss_id from public.pk_people x
    where x.is_active and x.role <> 'ceo'
      and not exists (select 1 from public.pk_leave l where l.person_id = x.id and l.status = 'disetujui' and d between l.day and coalesce(l.end_day, l.day))
  loop
    select count(*) into f from public.pk_kkh k where k.person_id = p.id and k.day = d and coalesce(k.code, '') <> '' and k.hour <> public.pk_setting_num('kkh_break', 12)::int;
    if f >= need then continue; end if;
    done := done + 1;
    if v_stage = 'remind' then
      perform public.pk_notify(p.id, 'kkh', 'KKH hari ini baru ' || f || '/' || need || ' jam',
        'Lengkapi sebelum ' || lpad(dl::text, 2, '0') || '.00. Lewat itu tercatat telat isi KKH (potongan disiplin ' || pen || '%).', '#/kkh', true);
    else
      insert into public.pk_kkh_miss(person_id, day, filled) values (p.id, d, f) on conflict (person_id, day) do nothing;
      select (select count(*) from public.pk_attendance a where a.person_id = p.id and a.late_min > 0 and date_trunc('month', a.day) = date_trunc('month', d::timestamp))
           + (select count(*) from public.pk_kkh_miss m where m.person_id = p.id and date_trunc('month', m.day) = date_trunc('month', d::timestamp)) into n;
      perform public.pk_notify(p.id, 'kkh', 'Telat isi KKH hari ini',
        'Baru ' || f || '/' || need || ' jam saat ' || lpad(dl::text, 2, '0') || '.00 · potongan disiplin ' || pen || '% · pelanggaran ke-' || n || ' bulan ini', '#/kkh', n >= warn);
    end if;
  end loop;

  -- ringkasan ke atasan saat batas
  if v_stage = 'deadline' then
    for b in select x.boss_id, string_agg(public.pk_nick(m.person_id) || ' (' || m.filled || '/' || need || ')', ', ') nm, count(*) c
             from public.pk_kkh_miss m join public.pk_people x on x.id = m.person_id
             where m.day = d and x.boss_id is not null group by x.boss_id loop
      perform public.pk_notify(b.boss_id, 'kkh', b.c || ' orang telat isi KKH', b.nm || ' · belum lengkap saat ' || lpad(dl::text, 2, '0') || '.00', '#/kkh-tim', false);
    end loop;
  end if;
  return jsonb_build_object('stage', v_stage, 'orang', done);
end $$;
revoke all on function public.pk_kkh_tick() from public, anon, authenticated;

select cron.unschedule('pk-kkh-batas') where exists (select 1 from cron.job where jobname = 'pk-kkh-batas');
select cron.schedule('pk-kkh-batas', '*/5 0-6 * * *', 'select public.pk_kkh_tick()');
