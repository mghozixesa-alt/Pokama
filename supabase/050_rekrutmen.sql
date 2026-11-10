-- 050: Rekrutmen & talent pool (portal karir pokama.org/karir + menu Rekrutmen di KKH)
-- Pelamar TIDAK membuat akun Supabase: masuk dengan OTP WhatsApp, lalu memegang token sesi (disimpan sebagai hash).
-- Semua akses pelamar lewat fungsi rec_* (security definer). Tabel hanya bisa dibaca tim rekrutmen (pk_rec_can()).

create table if not exists public.pk_rec_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  unit_code text not null references public.pk_units(code),
  city text not null default 'Garut',
  work_type text not null default 'Penuh waktu',
  summary text, duties text, reqs text,
  tests text[] not null default array['disc','umum'],
  status text not null default 'buka' check (status in ('buka','tutup')),
  closes_on date,
  created_by uuid references public.pk_people(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pk_rec_candidates (
  id uuid primary key default gen_random_uuid(),
  wa text not null unique,
  name text, city text, has_sim_c boolean, experience text, cv_url text,
  interests text[] not null default '{}',
  consent_at timestamptz,
  pool_status text not null default 'siap' check (pool_status in ('siap','diproses','karyawan','tidak_direkomendasikan')),
  labels text[] not null default '{}',
  note text,
  person_id uuid references public.pk_people(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pk_rec_otp (
  id uuid primary key default gen_random_uuid(),
  wa text not null, code_hash text not null, expires_at timestamptz not null,
  tries int not null default 0, used_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists pk_rec_otp_wa on public.pk_rec_otp(wa, created_at desc);

create table if not exists public.pk_rec_sessions (
  token_hash text primary key,
  candidate_id uuid not null references public.pk_rec_candidates(id) on delete cascade,
  expires_at timestamptz not null, created_at timestamptz not null default now()
);

create table if not exists public.pk_rec_applications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.pk_rec_candidates(id) on delete cascade,
  job_id uuid references public.pk_rec_jobs(id),
  stage text not null default 'tes' check (stage in ('tes','review','wawancara','tawaran','diterima','tidak_lanjut')),
  reason text, interview_at timestamptz, interview_place text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists pk_rec_app_once on public.pk_rec_applications(candidate_id, coalesce(job_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists public.pk_rec_tests (
  code text primary key, name text not null, kind text not null check (kind in ('disc','mc')),
  minutes int not null, intro text, sort int not null default 0
);
create table if not exists public.pk_rec_questions (
  test_code text not null references public.pk_rec_tests(code) on delete cascade,
  n int not null, prompt text not null,
  options jsonb not null,           -- disc: [{t, d:'D'|'I'|'S'|'C'}]; mc: [{t}]
  answer int,                       -- mc: indeks opsi yang benar (0-based); disc: null
  primary key (test_code, n)
);

create table if not exists public.pk_rec_attempts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.pk_rec_applications(id) on delete cascade,
  candidate_id uuid not null references public.pk_rec_candidates(id) on delete cascade,
  test_code text not null references public.pk_rec_tests(code),
  started_at timestamptz not null default now(), deadline timestamptz not null,
  submitted_at timestamptz, answers jsonb, score numeric, disc jsonb, blur_count int not null default 0, late boolean not null default false,
  unique (application_id, test_code)
);

create table if not exists public.pk_rec_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.pk_rec_applications(id) on delete cascade,
  reviewer_id uuid references public.pk_people(id), rating int check (rating between 1 and 5), note text,
  created_at timestamptz not null default now()
);
create table if not exists public.pk_rec_events (
  id bigserial primary key,
  application_id uuid references public.pk_rec_applications(id) on delete cascade,
  candidate_id uuid references public.pk_rec_candidates(id) on delete cascade,
  kind text not null, detail jsonb, by_id uuid references public.pk_people(id),
  created_at timestamptz not null default now()
);

-- siapa tim rekrutmen: kode orang di pk_settings 'rec_viewers' (default GZ, IF, AD, KV)
insert into public.pk_settings(key, value, note) values ('rec_viewers', '["GZ","IF","AD","KV"]'::jsonb, 'Kode orang yang bisa membuka menu Rekrutmen (KKH)')
on conflict (key) do nothing;
create or replace function public.pk_rec_can() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pk_people p where p.id = public.pk_me() and p.is_active
    and p.code in (select jsonb_array_elements_text(coalesce((select value from public.pk_settings where key = 'rec_viewers'), '[]'::jsonb))))
$$;
grant execute on function public.pk_rec_can() to authenticated;

do $$ declare t text; begin
  foreach t in array array['pk_rec_jobs','pk_rec_candidates','pk_rec_otp','pk_rec_sessions','pk_rec_applications','pk_rec_tests','pk_rec_questions','pk_rec_attempts','pk_rec_reviews','pk_rec_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
  foreach t in array array['pk_rec_jobs','pk_rec_candidates','pk_rec_applications','pk_rec_tests','pk_rec_questions','pk_rec_attempts','pk_rec_reviews','pk_rec_events'] loop
    execute format('drop policy if exists rec_read on public.%I', t);
    execute format('create policy rec_read on public.%I for select to authenticated using (public.pk_rec_can())', t);
  end loop;
end $$;

-- ================= sisi pelamar (anon) =================
create or replace function public.rec_norm_wa(p text) returns text language sql immutable as $$
  select case when x like '0%' then '62' || substr(x, 2) when x like '8%' then '62' || x else x end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') x) s
$$;

create or replace function public.rec_cand(p_token text) returns uuid language sql stable security definer set search_path = public, extensions as $$
  select s.candidate_id from public.pk_rec_sessions s
  where s.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') and s.expires_at > now()
$$;
revoke execute on function public.rec_cand(text) from public, anon, authenticated;

create or replace function public.rec_jobs() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', j.id, 'title', j.title, 'unit', u.name, 'biz', coalesce(pu.name, u.name), 'biz_code', coalesce(u.parent, u.code),
    'city', j.city, 'type', j.work_type, 'summary', j.summary, 'duties', j.duties, 'reqs', j.reqs,
    'minutes', (select coalesce(sum(t.minutes), 0) from public.pk_rec_tests t where t.code = any(j.tests)),
    'tests', (select coalesce(jsonb_agg(t.name order by t.sort), '[]') from public.pk_rec_tests t where t.code = any(j.tests)))
    order by j.created_at desc), '[]'::jsonb)
  from public.pk_rec_jobs j join public.pk_units u on u.code = j.unit_code left join public.pk_units pu on pu.code = u.parent
  where j.status = 'buka' and (j.closes_on is null or j.closes_on >= (now() at time zone 'Asia/Jakarta')::date)
$$;

create or replace function public.rec_otp_send(p_wa text) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare w text := public.rec_norm_wa(p_wa); c text; oid uuid; last timestamptz; n int; g int;
begin
  if w !~ '^628\d{7,12}$' then raise exception 'Nomor WhatsApp tidak valid'; end if;
  select max(created_at), count(*) into last, n from public.pk_rec_otp where wa = w and created_at > now() - interval '1 hour';
  if last > now() - interval '60 seconds' then raise exception 'Tunggu 1 menit sebelum meminta kode lagi'; end if;
  if n >= 5 then raise exception 'Terlalu sering meminta kode. Coba lagi 1 jam lagi.'; end if;
  select count(*) into g from public.pk_rec_otp where created_at > now() - interval '1 hour';
  if g >= 300 then raise exception 'Layanan sedang sibuk, coba lagi sebentar.'; end if;
  c := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
  oid := gen_random_uuid();
  insert into public.pk_rec_otp(id, wa, code_hash, expires_at) values (oid, w, encode(extensions.digest(oid::text || c, 'sha256'), 'hex'), now() + interval '10 minutes');
  perform public.pk_wa(w, 'Kode masuk Karir Pokama: ' || c || '. Berlaku 10 menit. Jangan berikan kode ini kepada siapa pun.', true);
  return jsonb_build_object('ok', true, 'wa_masked', '+' || left(w, 4) || '••••' || right(w, 3));
end $$;

create or replace function public.rec_otp_verify(p_wa text, p_code text) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare w text := public.rec_norm_wa(p_wa); o public.pk_rec_otp; cid uuid; tok text;
begin
  select * into o from public.pk_rec_otp where wa = w and used_at is null order by created_at desc limit 1 for update;
  if o.id is null or o.expires_at < now() then return jsonb_build_object('ok', false, 'error', 'Kode sudah kedaluwarsa. Minta kode baru.'); end if;
  if o.tries >= 5 then return jsonb_build_object('ok', false, 'error', 'Terlalu banyak salah. Minta kode baru.'); end if;
  if encode(extensions.digest(o.id::text || regexp_replace(coalesce(p_code, ''), '\D', '', 'g'), 'sha256'), 'hex') <> o.code_hash then
    update public.pk_rec_otp set tries = tries + 1 where id = o.id;
    return jsonb_build_object('ok', false, 'error', 'Kode salah. Sisa ' || (4 - o.tries) || ' kesempatan.');
  end if;
  update public.pk_rec_otp set used_at = now() where id = o.id;
  insert into public.pk_rec_candidates(wa) values (w) on conflict (wa) do update set updated_at = now() returning id into cid;
  tok := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.pk_rec_sessions(token_hash, candidate_id, expires_at) values (encode(extensions.digest(tok, 'sha256'), 'hex'), cid, now() + interval '30 days');
  return jsonb_build_object('ok', true, 'token', tok);
end $$;

create or replace function public.rec_me(p_token text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare cid uuid := public.rec_cand(p_token); c public.pk_rec_candidates;
begin
  if cid is null then return jsonb_build_object('ok', false); end if;
  select * into c from public.pk_rec_candidates where id = cid;
  return jsonb_build_object('ok', true,
    'me', jsonb_build_object('name', c.name, 'city', c.city, 'has_sim_c', c.has_sim_c, 'experience', c.experience, 'cv_url', c.cv_url, 'consent', c.consent_at is not null,
      'wa_masked', '+' || left(c.wa, 4) || '••••' || right(c.wa, 3)),
    'apps', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'stage', a.stage, 'created_at', a.created_at,
        'interview_at', a.interview_at, 'interview_place', a.interview_place,
        'job', case when j.id is null then null else jsonb_build_object('id', j.id, 'title', j.title, 'unit', u.name, 'city', j.city) end,
        'tests', (select coalesce(jsonb_agg(jsonb_build_object('code', t.code, 'name', t.name, 'minutes', t.minutes, 'kind', t.kind,
            'done', tt.submitted_at is not null, 'started', tt.id is not null) order by t.sort), '[]')
          from public.pk_rec_tests t left join public.pk_rec_attempts tt on tt.application_id = a.id and tt.test_code = t.code
          where t.code = any(coalesce(j.tests, array['disc','umum']))))
      order by a.created_at desc)
      from public.pk_rec_applications a left join public.pk_rec_jobs j on j.id = a.job_id left join public.pk_units u on u.code = j.unit_code
      where a.candidate_id = cid), '[]'::jsonb));
end $$;

create or replace function public.rec_apply(p_token text, p_job uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid := public.rec_cand(p_token); aid uuid; j public.pk_rec_jobs; nm text := btrim(coalesce(p->>'name', ''));
begin
  if cid is null then raise exception 'Sesi habis, masuk lagi dengan kode WhatsApp'; end if;
  if length(nm) < 3 then raise exception 'Isi nama lengkap'; end if;
  if coalesce((p->>'consent')::boolean, false) is not true then raise exception 'Centang persetujuan penyimpanan data'; end if;
  if p_job is not null then
    select * into j from public.pk_rec_jobs where id = p_job;
    if j.id is null or j.status <> 'buka' then raise exception 'Lowongan sudah ditutup'; end if;
  end if;
  update public.pk_rec_candidates set name = left(nm, 80), city = left(nullif(btrim(p->>'city'), ''), 40),
    has_sim_c = (p->>'has_sim_c')::boolean, experience = left(nullif(btrim(p->>'experience'), ''), 1200),
    cv_url = case when coalesce(p->>'cv_url', '') ~* '^https://' then left(p->>'cv_url', 400) end,
    interests = case when jsonb_typeof(p->'interests') = 'array' then array(select left(x, 40) from jsonb_array_elements_text(p->'interests') x limit 6) else interests end,
    consent_at = coalesce(consent_at, now()), pool_status = case when pool_status = 'siap' and p_job is not null then 'diproses' else pool_status end, updated_at = now()
  where id = cid;
  select id into aid from public.pk_rec_applications where candidate_id = cid and job_id is not distinct from p_job;
  if aid is null then
    insert into public.pk_rec_applications(candidate_id, job_id) values (cid, p_job) returning id into aid;
    insert into public.pk_rec_events(application_id, candidate_id, kind, detail) values (aid, cid, 'melamar', jsonb_build_object('job', j.title));
  end if;
  return jsonb_build_object('ok', true, 'application_id', aid);
end $$;

create or replace function public.rec_test_start(p_token text, p_app uuid, p_test text) returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid := public.rec_cand(p_token); a public.pk_rec_applications; t public.pk_rec_tests; v_at public.pk_rec_attempts; jt text[];
begin
  if cid is null then raise exception 'Sesi habis, masuk lagi dengan kode WhatsApp'; end if;
  select * into a from public.pk_rec_applications where id = p_app and candidate_id = cid;
  if a.id is null then raise exception 'Lamaran tidak ditemukan'; end if;
  select coalesce(tests, array['disc','umum']) into jt from public.pk_rec_jobs where id = a.job_id;
  jt := coalesce(jt, array['disc','umum']);
  if not (p_test = any(jt)) then raise exception 'Tes ini tidak termasuk lowongan Anda'; end if;
  select * into t from public.pk_rec_tests where code = p_test;
  -- skor tes berlaku 6 bulan: tes yang sama di lamaran lain dalam 6 bulan tidak diulang
  select * into v_at from public.pk_rec_attempts where candidate_id = cid and test_code = p_test and submitted_at > now() - interval '6 months' order by submitted_at desc limit 1;
  if v_at.id is not null and v_at.application_id <> a.id then
    insert into public.pk_rec_attempts(application_id, candidate_id, test_code, started_at, deadline, submitted_at, answers, score, disc, blur_count)
    values (a.id, cid, p_test, v_at.started_at, v_at.deadline, v_at.submitted_at, v_at.answers, v_at.score, v_at.disc, v_at.blur_count) on conflict do nothing;
    perform public.rec_after_test(a.id);
    return jsonb_build_object('ok', true, 'done', true, 'reused', true);
  end if;
  select * into v_at from public.pk_rec_attempts where application_id = a.id and test_code = p_test;
  if v_at.submitted_at is not null then return jsonb_build_object('ok', true, 'done', true); end if;
  if v_at.id is null then
    insert into public.pk_rec_attempts(application_id, candidate_id, test_code, deadline) values (a.id, cid, p_test, now() + make_interval(mins => t.minutes)) returning * into v_at;
  end if;
  return jsonb_build_object('ok', true, 'attempt_id', v_at.id, 'name', t.name, 'kind', t.kind, 'intro', t.intro,
    'seconds_left', greatest(0, floor(extract(epoch from v_at.deadline - now())))::int,
    'questions', (select jsonb_agg(jsonb_build_object('n', q.n, 'prompt', q.prompt,
        'options', (select jsonb_agg(jsonb_build_object('i', o.i - 1, 't', o.v->>'t') order by o.i) from jsonb_array_elements(q.options) with ordinality o(v, i)))
      order by q.n) from public.pk_rec_questions q where q.test_code = t.code));
end $$;

-- skor: mc = persen benar; disc = paling-mirip dikurangi paling-tidak-mirip per dimensi, diskalakan 0–100
create or replace function public.rec_test_submit(p_token text, p_attempt uuid, p_answers jsonb, p_blur int default 0) returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid := public.rec_cand(p_token); v_at public.pk_rec_attempts; t public.pk_rec_tests; q record; ans jsonb; total int := 0; right_n int := 0;
  m jsonb := '{"D":0,"I":0,"S":0,"C":0}'; l jsonb := '{"D":0,"I":0,"S":0,"C":0}'; d text; raw jsonb := '{}'; k text; sc jsonb := '{}'; prof text; ord text[]; v_disc jsonb; v_score numeric;
begin
  if cid is null then raise exception 'Sesi habis, masuk lagi dengan kode WhatsApp'; end if;
  select * into v_at from public.pk_rec_attempts where id = p_attempt and candidate_id = cid for update;
  if v_at.id is null then raise exception 'Tes tidak ditemukan'; end if;
  if v_at.submitted_at is not null then return jsonb_build_object('ok', true, 'done', true); end if;
  select * into t from public.pk_rec_tests where code = v_at.test_code;
  for q in select * from public.pk_rec_questions where test_code = t.code order by n loop
    total := total + 1;
    ans := p_answers -> (q.n::text);
    if t.kind = 'mc' then
      if ans is not null and jsonb_typeof(ans) = 'number' and (ans)::int = q.answer then right_n := right_n + 1; end if;
    else
      if ans is not null and jsonb_typeof(ans) = 'object' then
        d := q.options -> ((ans->>'m')::int) ->> 'd'; if d is not null then m := jsonb_set(m, array[d], to_jsonb((m->>d)::int + 1)); end if;
        d := q.options -> ((ans->>'l')::int) ->> 'd'; if d is not null then l := jsonb_set(l, array[d], to_jsonb((l->>d)::int + 1)); end if;
      end if;
    end if;
  end loop;
  if t.kind = 'mc' then
    v_score := round(100.0 * right_n / greatest(total, 1));
  else
    foreach k in array array['D','I','S','C'] loop
      raw := raw || jsonb_build_object(k, (m->>k)::int - (l->>k)::int);
      sc := sc || jsonb_build_object(k, round(((m->>k)::int - (l->>k)::int + total) * 100.0 / (2 * greatest(total, 1))));
    end loop;
    select array_agg(key order by value::int desc, key) into ord from jsonb_each_text(raw);
    prof := ord[1];
    if (raw->>ord[2])::int >= 0 and (raw->>ord[1])::int - (raw->>ord[2])::int <= 4 then prof := ord[1] || '/' || ord[2]; end if;
    v_disc := jsonb_build_object('most', m, 'least', l, 'raw', raw, 'scaled', sc, 'profile', prof);
  end if;
  update public.pk_rec_attempts set submitted_at = now(), answers = p_answers, score = v_score, disc = v_disc,
    blur_count = greatest(coalesce(p_blur, 0), blur_count), late = now() > deadline + interval '30 seconds' where id = v_at.id;
  perform public.rec_after_test(v_at.application_id);
  return jsonb_build_object('ok', true, 'done', true);
end $$;

create or replace function public.rec_after_test(p_app uuid) returns void language plpgsql security definer set search_path = public as $$
declare a public.pk_rec_applications; jt text[];
begin
  select * into a from public.pk_rec_applications where id = p_app;
  select tests into jt from public.pk_rec_jobs where id = a.job_id;
  jt := coalesce(jt, array['disc','umum']);
  if a.stage = 'tes' and not exists (select 1 from unnest(jt) x where not exists (select 1 from public.pk_rec_attempts t where t.application_id = a.id and t.test_code = x and t.submitted_at is not null)) then
    update public.pk_rec_applications set stage = 'review', updated_at = now() where id = a.id;
    insert into public.pk_rec_events(application_id, candidate_id, kind) values (a.id, a.candidate_id, 'tes_selesai');
  end if;
end $$;
revoke execute on function public.rec_after_test(uuid) from public, anon, authenticated;

grant execute on function public.rec_jobs() to anon, authenticated;
grant execute on function public.rec_otp_send(text) to anon, authenticated;
grant execute on function public.rec_otp_verify(text, text) to anon, authenticated;
grant execute on function public.rec_me(text) to anon, authenticated;
grant execute on function public.rec_apply(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.rec_test_start(text, uuid, text) to anon, authenticated;
grant execute on function public.rec_test_submit(text, uuid, jsonb, int) to anon, authenticated;

-- ================= sisi tim rekrutmen (KKH) =================
create or replace function public.rec_need() returns void language plpgsql stable security definer set search_path = public as $$
begin if not public.pk_rec_can() then raise exception 'Menu Rekrutmen hanya untuk tim rekrutmen'; end if; end $$;

create or replace function public.rec_board(p_job uuid default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.rec_need();
  return jsonb_build_object(
    'jobs', (select coalesce(jsonb_agg(jsonb_build_object('id', j.id, 'title', j.title, 'unit_code', j.unit_code, 'unit', u.name, 'city', j.city, 'type', j.work_type,
        'summary', j.summary, 'duties', j.duties, 'reqs', j.reqs, 'tests', j.tests, 'status', j.status, 'closes_on', j.closes_on,
        'n', (select count(*) from public.pk_rec_applications a where a.job_id = j.id and a.stage not in ('tidak_lanjut'))) order by j.status, j.created_at desc), '[]')
      from public.pk_rec_jobs j join public.pk_units u on u.code = j.unit_code),
    'apps', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'stage', a.stage, 'job_id', a.job_id, 'created_at', a.created_at, 'updated_at', a.updated_at,
        'interview_at', a.interview_at, 'interview_place', a.interview_place, 'reason', a.reason,
        'cand', jsonb_build_object('id', c.id, 'name', c.name, 'city', c.city, 'wa', c.wa, 'has_sim_c', c.has_sim_c, 'experience', c.experience, 'cv_url', c.cv_url, 'labels', c.labels, 'pool_status', c.pool_status),
        'tests', (select coalesce(jsonb_object_agg(t.test_code, jsonb_build_object('score', t.score, 'disc', t.disc, 'done', t.submitted_at is not null, 'blur', t.blur_count, 'late', t.late)), '{}')
                  from public.pk_rec_attempts t where t.application_id = a.id),
        'reviews', (select coalesce(jsonb_agg(jsonb_build_object('by', p.nickname, 'rating', r.rating, 'note', r.note, 'at', r.created_at) order by r.created_at desc), '[]')
                  from public.pk_rec_reviews r left join public.pk_people p on p.id = r.reviewer_id where r.application_id = a.id)) order by a.updated_at desc), '[]')
      from public.pk_rec_applications a join public.pk_rec_candidates c on c.id = a.candidate_id
      where (p_job is null or a.job_id is not distinct from p_job)),
    'tests', (select jsonb_agg(jsonb_build_object('code', code, 'name', name, 'minutes', minutes, 'kind', kind,
        'n', (select count(*) from public.pk_rec_questions q where q.test_code = t.code)) order by sort) from public.pk_rec_tests t));
end $$;

create or replace function public.rec_pool(p_q text default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.rec_need();
  return (select coalesce(jsonb_agg(x order by (x->>'updated_at') desc), '[]') from (
    select jsonb_build_object('id', c.id, 'name', c.name, 'city', c.city, 'wa', c.wa, 'interests', c.interests, 'labels', c.labels, 'pool_status', c.pool_status,
      'updated_at', c.updated_at, 'experience', c.experience,
      'disc', (select t.disc->>'profile' from public.pk_rec_attempts t where t.candidate_id = c.id and t.test_code = 'disc' and t.submitted_at is not null order by t.submitted_at desc limit 1),
      'disc_scaled', (select t.disc->'scaled' from public.pk_rec_attempts t where t.candidate_id = c.id and t.test_code = 'disc' and t.submitted_at is not null order by t.submitted_at desc limit 1),
      'scores', (select coalesce(jsonb_object_agg(t.test_code, t.score), '{}') from (select distinct on (test_code) test_code, score from public.pk_rec_attempts
                 where candidate_id = c.id and submitted_at is not null and score is not null order by test_code, submitted_at desc) t),
      'last_test', (select max(submitted_at) from public.pk_rec_attempts t where t.candidate_id = c.id),
      'apps', (select coalesce(jsonb_agg(jsonb_build_object('job', j.title, 'stage', a.stage)), '[]') from public.pk_rec_applications a left join public.pk_rec_jobs j on j.id = a.job_id where a.candidate_id = c.id)) x
    from public.pk_rec_candidates c
    where c.name is not null and (p_q is null or p_q = '' or c.name ilike '%' || p_q || '%' or c.city ilike '%' || p_q || '%' or c.wa like '%' || regexp_replace(p_q, '\D', '', 'g') || '%'
      or exists (select 1 from unnest(c.labels || c.interests) z where z ilike '%' || p_q || '%'))
    limit 300) s);
end $$;

create or replace function public.rec_job_save(p jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare jid uuid := nullif(p->>'id', '')::uuid; v_tests text[];
begin
  perform public.rec_need();
  if length(btrim(coalesce(p->>'title', ''))) < 3 then raise exception 'Isi nama posisi'; end if;
  v_tests := array(select x from jsonb_array_elements_text(coalesce(p->'tests', '["disc","umum"]')) x where x in (select code from public.pk_rec_tests));
  if not ('disc' = any(v_tests)) then v_tests := array['disc'] || v_tests; end if;
  if jid is null then
    insert into public.pk_rec_jobs(title, unit_code, city, work_type, summary, duties, reqs, tests, status, closes_on, created_by)
    values (btrim(p->>'title'), p->>'unit_code', coalesce(nullif(btrim(p->>'city'), ''), 'Garut'), coalesce(nullif(p->>'type', ''), 'Penuh waktu'),
      p->>'summary', p->>'duties', p->>'reqs', v_tests, coalesce(nullif(p->>'status', ''), 'buka'), nullif(p->>'closes_on', '')::date, public.pk_me()) returning id into jid;
  else
    update public.pk_rec_jobs set title = btrim(p->>'title'), unit_code = p->>'unit_code', city = coalesce(nullif(btrim(p->>'city'), ''), city), work_type = coalesce(nullif(p->>'type', ''), work_type),
      summary = p->>'summary', duties = p->>'duties', reqs = p->>'reqs', tests = v_tests, status = coalesce(nullif(p->>'status', ''), status),
      closes_on = nullif(p->>'closes_on', '')::date, updated_at = now() where id = jid;
  end if;
  return jid;
end $$;

create or replace function public.rec_move(p_app uuid, p_stage text, p jsonb default '{}') returns void language plpgsql security definer set search_path = public as $$
declare a public.pk_rec_applications; c public.pk_rec_candidates; j public.pk_rec_jobs; msg text;
begin
  perform public.rec_need();
  if p_stage not in ('tes','review','wawancara','tawaran','diterima','tidak_lanjut') then raise exception 'Tahap tidak dikenal'; end if;
  select * into a from public.pk_rec_applications where id = p_app for update;
  if a.id is null then raise exception 'Lamaran tidak ditemukan'; end if;
  update public.pk_rec_applications set stage = p_stage, reason = case when p_stage = 'tidak_lanjut' then nullif(p->>'reason', '') else reason end,
    interview_at = coalesce(nullif(p->>'interview_at', '')::timestamptz, interview_at), interview_place = coalesce(nullif(p->>'interview_place', ''), interview_place), updated_at = now()
  where id = a.id;
  update public.pk_rec_candidates set pool_status = case p_stage when 'tidak_lanjut' then case when coalesce((p->>'not_recommended')::boolean, false) then 'tidak_direkomendasikan' else 'siap' end
      when 'diterima' then pool_status else 'diproses' end, updated_at = now() where id = a.candidate_id;
  insert into public.pk_rec_events(application_id, candidate_id, kind, detail, by_id) values (a.id, a.candidate_id, 'tahap_' || p_stage, p, public.pk_me());
  if coalesce((p->>'notify')::boolean, false) then
    select * into c from public.pk_rec_candidates where id = a.candidate_id; select * into j from public.pk_rec_jobs where id = a.job_id;
    msg := case p_stage
      when 'wawancara' then 'Halo ' || coalesce(c.name, '') || ', selamat! Anda diundang wawancara untuk posisi ' || coalesce(j.title, '') || coalesce(' pada ' || to_char(nullif(p->>'interview_at', '')::timestamptz at time zone 'Asia/Jakarta', 'DD/MM/YYYY HH24.MI') || ' WIB', '') || coalesce(' di ' || nullif(p->>'interview_place', ''), '') || '. Detail: https://pokama.org/karir#status'
      when 'tidak_lanjut' then 'Halo ' || coalesce(c.name, '') || ', terima kasih sudah melamar ' || coalesce(j.title, '') || ' di Pokama. Saat ini kami belum bisa melanjutkan lamaran Anda. Profil Anda tetap tersimpan di talent pool kami untuk posisi berikutnya.'
      when 'tawaran' then 'Halo ' || coalesce(c.name, '') || ', kabar baik! Tim Pokama akan menghubungi Anda untuk penawaran kerja posisi ' || coalesce(j.title, '') || '.'
      else null end;
    if msg is not null then perform public.pk_wa(c.wa, msg); end if;
  end if;
end $$;

create or replace function public.rec_review(p_app uuid, p_rating int, p_note text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.rec_need();
  insert into public.pk_rec_reviews(application_id, reviewer_id, rating, note) values (p_app, public.pk_me(), p_rating, nullif(btrim(p_note), ''));
end $$;

create or replace function public.rec_label(p_cand uuid, p_labels text[], p_note text default null) returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.rec_need();
  update public.pk_rec_candidates set labels = coalesce(p_labels, '{}'), note = coalesce(p_note, note), updated_at = now() where id = p_cand;
end $$;

create or replace function public.rec_invite(p_cand uuid, p_msg text) returns void language plpgsql security definer set search_path = public as $$
declare c public.pk_rec_candidates;
begin
  perform public.rec_need();
  select * into c from public.pk_rec_candidates where id = p_cand;
  if c.id is null or length(btrim(coalesce(p_msg, ''))) < 5 then raise exception 'Isi pesan undangan'; end if;
  perform public.pk_wa(c.wa, left(p_msg, 900));
  insert into public.pk_rec_events(candidate_id, kind, detail, by_id) values (c.id, 'undangan_wa', jsonb_build_object('msg', left(p_msg, 900)), public.pk_me());
end $$;

-- jadikan karyawan: buat baris Data Karyawan dari kandidat
create or replace function public.rec_hire(p_app uuid, p jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare a public.pk_rec_applications; c public.pk_rec_candidates; pid uuid; v_code text := upper(btrim(coalesce(p->>'code', '')));
begin
  perform public.rec_need();
  select * into a from public.pk_rec_applications where id = p_app; select * into c from public.pk_rec_candidates where id = a.candidate_id;
  if c.person_id is not null then return c.person_id; end if;
  if v_code !~ '^[A-Z0-9]{2,4}$' then raise exception 'Kode karyawan 2–4 huruf/angka'; end if;
  if exists (select 1 from public.pk_people where pk_people.code = v_code) then raise exception 'Kode % sudah dipakai', v_code; end if;
  insert into public.pk_people(code, name, role, title, unit_code, boss_id, valuer1_id, email, phone, joined_on, is_active)
  values (v_code, c.name, coalesce(nullif(p->>'role', ''), 'staf'), nullif(p->>'title', ''), p->>'unit_code', nullif(p->>'boss_id', '')::uuid, nullif(p->>'boss_id', '')::uuid,
    nullif(lower(btrim(p->>'email')), ''), c.wa, coalesce(nullif(p->>'joined_on', '')::date, (now() at time zone 'Asia/Jakarta')::date), true)
  returning id into pid;
  update public.pk_rec_candidates set person_id = pid, pool_status = 'karyawan', updated_at = now() where id = c.id;
  update public.pk_rec_applications set stage = 'diterima', updated_at = now() where id = a.id;
  insert into public.pk_rec_events(application_id, candidate_id, kind, detail, by_id) values (a.id, c.id, 'jadi_karyawan', jsonb_build_object('person_id', pid, 'code', v_code), public.pk_me());
  return pid;
end $$;

do $$ declare f text; begin
  foreach f in array array['rec_need()','rec_board(uuid)','rec_pool(text)','rec_job_save(jsonb)','rec_move(uuid,text,jsonb)','rec_review(uuid,int,text)','rec_label(uuid,text[],text)','rec_invite(uuid,text)','rec_hire(uuid,jsonb)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
