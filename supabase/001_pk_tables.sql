-- Sistem Kerja Pokama · tabel inti (semua berawalan pk_, terpisah dari tabel Rentalaja App)

create table if not exists public.pk_units (
  code text primary key,                 -- HQ, RA, WG, NA, lini: GK, BD, ...
  name text not null,
  kind text not null check (kind in ('holding','bisnis','lini')),
  parent text references public.pk_units(code),
  rab_code text,                          -- POK, REN, TRP, NIA
  in_liga boolean not null default false,
  kpi text,
  sort int not null default 0,
  is_active boolean not null default true
);

create table if not exists public.pk_people (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,              -- inisial, mis. GZ
  name text not null,
  nickname text,
  role text not null check (role in ('ceo','kepala_staf','keuangan','leader','staf')),
  title text,                             -- jabatan/fungsi tampil
  unit_code text references public.pk_units(code),
  boss_id uuid references public.pk_people(id),
  valuer1_id uuid references public.pk_people(id),
  valuer2_id uuid references public.pk_people(id),
  email text unique,
  phone text,                             -- format 62xxxxxxxx
  user_id uuid unique references auth.users(id) on delete set null,
  photo text,                             -- data URI kecil atau URL
  joined_on date,
  leave_quota int not null default 12,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.pk_salary (
  person_id uuid primary key references public.pk_people(id) on delete cascade,
  base_salary bigint,
  split jsonb,                            -- [{"unit":"NA","pct":70},...] pribadi, hanya CEO & Keuangan
  updated_at timestamptz not null default now(),
  updated_by uuid references public.pk_people(id)
);

create table if not exists public.pk_settings (
  key text primary key,
  value jsonb not null,
  note text,
  updated_at timestamptz not null default now()
);

create table if not exists public.pk_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit_code text references public.pk_units(code),
  owner_id uuid references public.pk_people(id),
  due date,
  is_closed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.pk_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.pk_projects(id) on delete set null,
  unit_code text references public.pk_units(code),
  title text not null,
  dod text,                               -- selesai bila
  pic_id uuid references public.pk_people(id),
  reviewer_id uuid references public.pk_people(id),
  helpers uuid[] not null default '{}',
  due date,
  status text not null default 'todo' check (status in ('todo','doing','review','revisi','done','hold')),
  progress int not null default 0 check (progress between 0 and 100),
  version int not null default 0,
  round int not null default 0,
  last_link text,
  source text not null default 'atasan' check (source in ('atasan','permintaan')),
  request_id uuid,
  created_by uuid references public.pk_people(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  done_at timestamptz,
  revise_due date
);

create table if not exists public.pk_review_points (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.pk_tasks(id) on delete cascade,
  round int not null,
  text text not null,
  status text not null default 'open' check (status in ('open','fixed','disagree','accepted')),
  answer text,
  created_by uuid references public.pk_people(id),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

create table if not exists public.pk_task_log (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.pk_tasks(id) on delete cascade,
  actor_id uuid references public.pk_people(id),
  action text not null,
  note text,
  at timestamptz not null default now()
);

create table if not exists public.pk_kkh (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.pk_people(id) on delete cascade,
  day date not null,
  hour int not null check (hour between 6 and 22),
  code text not null check (code in ('CP/SR','CW','SW','IN/EX','IZIN')),
  mode text not null default 'kantor' check (mode in ('kantor','wfh','wfe','izin')),
  note text,
  task_id uuid references public.pk_tasks(id) on delete set null,
  unit_code text references public.pk_units(code),
  status text not null default 'rencana' check (status in ('rencana','siap','valid')),
  validated_by uuid references public.pk_people(id),
  validated_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (person_id, day, hour)
);

create table if not exists public.pk_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  from_id uuid not null references public.pk_people(id),
  to_team text not null,                  -- Rentalaja, Marketing, Keuangan, Kepala Staf, Niagaaja, TripinAja, Purchasing & Aset
  priority text not null default 'sedang' check (priority in ('tinggi','sedang','rendah')),
  due date,
  file_link text,
  status text not null default 'baru' check (status in ('baru','ditunda','diterima','ditolak','diperjelas','jadi_tugas','selesai')),
  pic_id uuid references public.pk_people(id),
  task_id uuid references public.pk_tasks(id) on delete set null,
  project_id uuid references public.pk_projects(id) on delete set null,
  triage_by uuid references public.pk_people(id),
  triage_at timestamptz,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.pk_rab (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  unit_code text not null references public.pk_units(code),
  kind text not null default 'op' check (kind in ('op','mt')),
  title text not null,
  need_date date,
  created_by uuid not null references public.pk_people(id),
  via_app boolean not null default false,
  total bigint not null default 0,
  chain uuid[] not null default '{}',     -- urutan penyetuju
  step int not null default 0,            -- indeks penyetuju saat ini
  status text not null default 'diajukan' check (status in ('diajukan','revisi','ditolak','siap_cair','cair','lpj','selesai')),
  note text,
  cair_at timestamptz, cair_by uuid references public.pk_people(id),
  lpj_at timestamptz,
  done_at timestamptz,
  realisasi bigint,
  is_emergency boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.pk_rab_items (
  id uuid primary key default gen_random_uuid(),
  rab_id uuid not null references public.pk_rab(id) on delete cascade,
  name text not null,
  qty numeric not null check (qty > 0),
  price bigint not null check (price >= 0),
  real_amount bigint,
  nota_link text,
  sort int not null default 0
);

create table if not exists public.pk_rab_log (
  id bigint generated always as identity primary key,
  rab_id uuid not null references public.pk_rab(id) on delete cascade,
  actor_id uuid references public.pk_people(id),
  action text not null,
  note text,
  at timestamptz not null default now()
);

create table if not exists public.pk_leave (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.pk_people(id) on delete cascade,
  kind text not null check (kind in ('libur','cuti','izin')),
  day date not null,
  end_day date,
  replacement_id uuid references public.pk_people(id),
  reason text,
  status text not null default 'diajukan' check (status in ('diajukan','disetujui','ditolak')),
  decided_by uuid references public.pk_people(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.pk_omzet (
  id uuid primary key default gen_random_uuid(),
  unit_code text not null references public.pk_units(code),
  day date not null,
  amount bigint not null check (amount >= 0),
  note text,
  reported_by uuid references public.pk_people(id),
  source text not null default 'manual' check (source in ('manual','app')),
  created_at timestamptz not null default now(),
  unique (unit_code, day, source)
);

create table if not exists public.pk_targets (
  id uuid primary key default gen_random_uuid(),
  unit_code text not null references public.pk_units(code),
  month date not null,                    -- tanggal 1
  amount bigint not null check (amount >= 0),
  kpi text,
  status text not null default 'usulan' check (status in ('usulan','dicek','sah')),
  proposed_by uuid references public.pk_people(id),
  checked_by uuid references public.pk_people(id),
  approved_by uuid references public.pk_people(id),
  updated_at timestamptz not null default now(),
  unique (unit_code, month)
);

create table if not exists public.pk_liga (
  id uuid primary key default gen_random_uuid(),
  unit_code text not null references public.pk_units(code),
  week_start date not null,
  kas int not null default 0 check (kas between 0 and 35),
  profit int not null default 0 check (profit between 0 and 30),
  kapasitas int not null default 0 check (kapasitas between 0 and 20),
  growth int not null default 0 check (growth between 0 and 15),
  note text,
  entered_by uuid references public.pk_people(id),
  updated_at timestamptz not null default now(),
  unique (unit_code, week_start)
);

create table if not exists public.pk_outputs (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.pk_people(id) on delete cascade,
  month date not null,
  name text not null,
  weight int not null check (weight between 1 and 100),
  target numeric not null check (target > 0),
  actual numeric not null default 0,
  source text,
  created_by uuid references public.pk_people(id),
  created_at timestamptz not null default now()
);

create table if not exists public.pk_perf (
  person_id uuid not null references public.pk_people(id) on delete cascade,
  month date not null,
  valuer_score numeric check (valuer_score between 1 and 5),
  approved_by uuid references public.pk_people(id),
  approved_at timestamptz,
  paid_at timestamptz,
  incentive bigint,
  primary key (person_id, month)
);

create table if not exists public.pk_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'lainnya',
  unit_code text references public.pk_units(code),
  kind text not null default 'Dokumen',
  status text not null default 'Draf' check (status in ('Final','Draf','Arsip','Template')),
  url text,
  owner_id uuid references public.pk_people(id),
  restricted boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists pk_kkh_day on public.pk_kkh(day);
create index if not exists pk_tasks_pic on public.pk_tasks(pic_id);
create index if not exists pk_tasks_rev on public.pk_tasks(reviewer_id);
create index if not exists pk_rab_status on public.pk_rab(status);
create index if not exists pk_omzet_day on public.pk_omzet(day);
create index if not exists pk_leave_day on public.pk_leave(day);
