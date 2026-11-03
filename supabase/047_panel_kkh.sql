-- 047 Panel bergambar Sistem Kerja (KKH tahap 1): boarding pass & streak (semua staf), Menara kontrol (Kepala Staf),
-- Ruang kemudi (CEO), pendakian target & cuaca unit (Unit Bisnis). Hanya membaca data; tidak mengubah alur KKH.

create or replace function public.pk_kkh_streak(p uuid)
returns int language plpgsql stable security definer set search_path to 'public' as $$
declare d date := public.pk_today(); n int := 0; i int; days text := coalesce((select value #>> '{}' from public.pk_settings where key = 'kkh_check_days'), '1,2,3,4,5,6');
begin
  if exists (select 1 from public.pk_kkh where person_id = p and day = d) then n := 1; end if;
  for i in 1..120 loop
    d := d - 1;
    if position(extract(dow from d)::text in days) = 0 then continue; end if;
    if exists (select 1 from public.pk_leave l where l.person_id = p and l.status = 'disetujui' and l.day <= d and coalesce(l.end_day, l.day) >= d) then continue; end if;
    if exists (select 1 from public.pk_kkh where person_id = p and day = d) then n := n + 1; else exit; end if;
  end loop;
  return n;
end $$;

create or replace function public.pk_panel_saya()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare me uuid := public.pk_me(); p public.pk_people; d date := public.pk_today();
begin
  if me is null then raise exception 'Belum masuk'; end if;
  select * into p from public.pk_people where id = me;
  return jsonb_build_object('day', d, 'nick', coalesce(p.nickname, p.name), 'code', p.code, 'unit', p.unit_code, 'role', p.role,
    'slots', (select count(*) from public.pk_kkh where person_id = me and day = d and coalesce(code, '') <> 'IZIN'),
    'done', (select count(*) from public.pk_kkh where person_id = me and day = d and status in ('siap', 'valid')),
    'valid', (select count(*) from public.pk_kkh where person_id = me and day = d and status = 'valid'),
    'need', coalesce((select (value #>> '{}')::int from public.pk_settings where key = 'kkh_daily_hours'), 8),
    'start', coalesce((select (value #>> '{}')::int from public.pk_settings where key = 'work_start'), 9),
    'end', coalesce((select (value #>> '{}')::int from public.pk_settings where key = 'kkh_end'), 20) + 1,
    'tasks', (select count(*) from public.pk_tasks where pic_id = me and status in ('todo', 'doing', 'revisi', 'review')),
    'late_tasks', (select count(*) from public.pk_tasks where pic_id = me and status in ('todo', 'doing', 'revisi') and due < d),
    'att', (select jsonb_build_object('at', a.at, 'late', a.late_min, 'mode', a.mode) from public.pk_attendance a where a.person_id = me and a.day = d limit 1),
    'streak', public.pk_kkh_streak(me),
    'team', (select coalesce(jsonb_agg(jsonb_build_object('nick', coalesce(x.nickname, split_part(x.name, ' ', 1)), 'me', x.id = me, 's', public.pk_kkh_streak(x.id)) order by public.pk_kkh_streak(x.id) desc), '[]'::jsonb)
             from (select * from public.pk_people x where x.is_active and x.role <> 'lapangan' and (x.unit_code = p.unit_code or x.id = me) limit 8) x));
end $$;

create or replace function public.pk_panel_kendali()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare r text := public.pk_role(); d date := public.pk_today(); m date := date_trunc('month', public.pk_today())::date; staff jsonb;
begin
  if r not in ('ceo', 'kepala_staf') then raise exception 'Khusus CEO dan Kepala Staf'; end if;
  select coalesce(jsonb_agg(z order by z->>'unit', z->>'nick'), '[]'::jsonb) into staff from (
    select jsonb_build_object('id', p.id, 'nick', coalesce(p.nickname, split_part(p.name, ' ', 1)), 'code', p.code, 'unit', p.unit_code, 'role', p.role,
      'biz', coalesce(u.parent, u.code),
      'kkh', (select count(*) from public.pk_kkh k where k.person_id = p.id and k.day = d),
      'att', (select a.at from public.pk_attendance a where a.person_id = p.id and a.day = d limit 1),
      'late', (select a.late_min from public.pk_attendance a where a.person_id = p.id and a.day = d limit 1),
      'leave', (select l.kind from public.pk_leave l where l.person_id = p.id and l.status = 'disetujui' and l.day <= d and coalesce(l.end_day, l.day) >= d limit 1),
      'wfa', exists (select 1 from public.pk_wfa w where w.person_id = p.id and w.day = d and w.status = 'disetujui'),
      'overdue', (select count(*) from public.pk_tasks t where t.pic_id = p.id and t.status in ('todo', 'doing', 'revisi') and t.due < d),
      'streak', public.pk_kkh_streak(p.id)) z
    from public.pk_people p left join public.pk_units u on u.code = p.unit_code
    where p.is_active and p.role not in ('lapangan', 'ceo')) s;
  return jsonb_build_object('day', d, 'role', r, 'staff', staff,
    'fill_deadline', coalesce((select (value #>> '{}')::int from public.pk_settings where key = 'kkh_fill_deadline'), 10),
    'validate', (select count(*) from public.pk_kkh where status = 'siap'),
    'validate_old', (select count(*) from public.pk_kkh where status = 'siap' and day < d),
    'review', (select count(*) from public.pk_tasks where status = 'review'),
    'revisi_late', (select count(*) from public.pk_tasks where status = 'revisi' and revise_due < d),
    'delay', (select coalesce(jsonb_agg(t order by t->>'due'), '[]'::jsonb) from (
       select jsonb_build_object('id', t.id, 'title', t.title, 'due', t.due, 'days', d - t.due, 'unit', t.unit_code, 'status', t.status,
         'pic', (select coalesce(nickname, split_part(name, ' ', 1)) from public.pk_people where id = t.pic_id)) t
       from public.pk_tasks t where t.status in ('todo', 'doing', 'revisi') and t.due < d order by t.due limit 8) z),
    'due_today', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
       select jsonb_build_object('id', t.id, 'title', t.title, 'unit', t.unit_code, 'status', t.status, 'pic', (select coalesce(nickname, split_part(name, ' ', 1)) from public.pk_people where id = t.pic_id)) t
       from public.pk_tasks t where t.status in ('todo', 'doing', 'revisi', 'review') and t.due = d limit 6) z),
    'requests_stuck', (select count(*) from public.pk_requests q where coalesce(q.status, 'baru') not in ('selesai', 'ditolak', 'batal', 'done') and q.created_at < now() - interval '2 days'),
    'cabang', (select coalesce(jsonb_agg(c), '[]'::jsonb) from (
       select jsonb_build_object('code', u.code, 'name', u.name, 'biz', coalesce(u.parent, u.code),
         'omzet', coalesce((select sum(o.amount) from public.pk_omzet o where o.unit_code = u.code and o.day = d), 0),
         'people', (select count(*) from public.pk_people p where p.is_active and p.role not in ('lapangan', 'ceo') and p.unit_code = u.code),
         'filled', (select count(distinct k.person_id) from public.pk_kkh k join public.pk_people p on p.id = k.person_id where p.unit_code = u.code and k.day = d)) c
       from public.pk_units u where u.is_active order by u.sort) z),
    'targets', (select coalesce(jsonb_agg(jsonb_build_object('biz', b, 'target', t, 'omzet', o)), '[]'::jsonb) from (
       select b.code b, coalesce((select sum(t.amount) from public.pk_targets t join public.pk_units uu on uu.code = t.unit_code where coalesce(uu.parent, uu.code) = b.code and t.month = m), 0) t,
              coalesce((select sum(o.amount) from public.pk_omzet o join public.pk_units uu on uu.code = o.unit_code where coalesce(uu.parent, uu.code) = b.code and o.day >= m and o.day <= d), 0) o
       from public.pk_units b where b.parent is null and b.code in ('RA', 'WG', 'NA')) z),
    'ceo', case when r = 'ceo' then jsonb_build_object(
       'kas', coalesce((select sum(l.debit - l.credit) from public.pk_fin_lines l join public.pk_fin_accounts a on a.code = l.account_code where a.is_cash), 0),
       'rev', coalesce((select sum(l.credit - l.debit) from public.pk_fin_lines l join public.pk_fin_entries e on e.id = l.entry_id where left(l.account_code, 1) in ('4', '7') and e.entry_date >= m), 0),
       'cost', coalesce((select sum(l.debit - l.credit) from public.pk_fin_lines l join public.pk_fin_entries e on e.id = l.entry_id where left(l.account_code, 1) in ('5', '6', '8') and e.entry_date >= m), 0),
       'burn', coalesce((select sum(l.debit - l.credit) / 3 from public.pk_fin_lines l join public.pk_fin_entries e on e.id = l.entry_id where left(l.account_code, 1) in ('5', '6', '8') and l.account_code <> '5-50001' and e.entry_date >= (m - interval '3 months')::date and e.entry_date < m), 0),
       'asset_noprice', (select count(*) from public.pk_fin_assets where status = 'aktif' and cost = 0),
       'hutang_telat', coalesce((select sum(total - tax - paid) from public.pk_fin_expenses where status = 'belum' and due_date < d), 0) + coalesce((select sum(total - paid) from public.pk_fin_docs where kind = 'beli' and status = 'belum' and due_date < d), 0),
       'fin_fail', (select count(*) from public.pk_fin_events where status = 'gagal')) end);
end $$;

do $$ declare f text; begin
  foreach f in array array['pk_panel_saya()', 'pk_panel_kendali()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
  execute 'revoke execute on function public.pk_kkh_streak(uuid) from public, anon, authenticated';
  execute 'grant execute on function public.pk_kkh_streak(uuid) to service_role';
end $$;
