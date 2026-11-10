-- 052: Menu Surat (KKH) — surat resmi bernomor, kop PT, nama + QR verifikasi, arsip.
-- Keputusan CEO (doc Mapping Menu Surat, 10/11/2026): pola nomor urut/KODE/UNIT/bulan Romawi/tahun; penanda tangan sesuai tingkatan;
-- kop atas nama PT; tanpa tanda tangan basah (nama + QR); unit investor ditulis "dikelola Rentalaja"; data aset dilengkapi Fajar, Yusril, Dzikri.

create table if not exists public.pk_letter_types (
  code text primary key,                 -- ST, SKK, SPK, SP, SKA
  name text not null,
  subject text not null check (subject in ('people','person','candidate','assets')),
  signer text not null check (signer in ('boss','kepala_staf','ceo')),
  sort int not null default 0,
  fields jsonb not null default '[]',    -- [{k, label, type: text|textarea|date|select|number, req, ph, opts}]
  tpl jsonb not null,                    -- {title, opening, after, closing} — teks dengan {{kolom}}
  valid_months int,                      -- SP: 6 bulan
  is_active boolean not null default true
);

create table if not exists public.pk_letters (
  id uuid primary key default gen_random_uuid(),
  type_code text not null references public.pk_letter_types(code),
  num_code text not null,                -- kode di nomor (ST, SKK, SPK, SP1..SP3, SKA)
  number text unique, seq int,
  biz text not null, company_code text not null default 'PKI',
  y int, m int,
  letter_date date not null default (now() at time zone 'Asia/Jakarta')::date,
  people uuid[] not null default '{}',   -- karyawan yang disebut di surat
  candidate_app uuid,
  assets uuid[] not null default '{}',
  data jsonb not null default '{}',      -- isian + potret data subjek saat surat dibuat
  tpl jsonb not null,                    -- salinan template saat dibuat (surat lama tidak berubah bila template diubah)
  title text not null,                   -- ringkasan untuk arsip
  signer_id uuid not null references public.pk_people(id),
  signer_name text, signer_title text,
  known_by uuid references public.pk_people(id),   -- SP: atasan "mengetahui"
  status text not null default 'menunggu' check (status in ('menunggu','terbit','ditolak','batal')),
  created_by uuid references public.pk_people(id),
  created_at timestamptz not null default now(),
  issued_at timestamptz, decided_note text,
  cancelled_at timestamptz, cancel_reason text, cancelled_by uuid references public.pk_people(id),
  valid_until date,
  verify_key text unique
);
create index if not exists pk_letters_people on public.pk_letters using gin(people);
create index if not exists pk_letters_assets on public.pk_letters using gin(assets);

create table if not exists public.pk_letter_seq (
  num_code text not null, biz text not null, y int not null, m int not null, last int not null default 0,
  primary key (num_code, biz, y, m)
);

alter table public.pk_letter_types enable row level security;
alter table public.pk_letters enable row level security;
alter table public.pk_letter_seq enable row level security;
revoke all on public.pk_letters, public.pk_letter_seq from anon, authenticated;
revoke all on public.pk_letter_types from anon;
drop policy if exists lt_read on public.pk_letter_types;
create policy lt_read on public.pk_letter_types for select to authenticated using (true);
grant select on public.pk_letter_types to authenticated;

insert into public.pk_settings(key, value, note) values ('letter_asset_team', '["YF","DZ","FN"]'::jsonb, 'Kode orang tim aset: boleh membuat surat kepemilikan aset dan melihat daftar unit belum siap surat')
on conflict (key) do nothing;

-- ---------- template ----------
insert into public.pk_letter_types(code, name, subject, signer, sort, fields, tpl, valid_months) values
('ST', 'Surat tugas', 'people', 'boss', 1,
 '[{"k":"keperluan","label":"Keperluan tugas","type":"text","req":true,"ph":"Mengantar unit dan survei lokasi mitra"},
   {"k":"tujuan","label":"Tujuan / lokasi","type":"text","req":true,"ph":"Hotel X, Jl. ... Garut"},
   {"k":"mulai","label":"Tanggal berangkat","type":"date","req":true},
   {"k":"selesai","label":"Tanggal kembali","type":"date","req":true},
   {"k":"kendaraan","label":"Kendaraan (opsional)","type":"text","ph":"Honda Beat Z 1234 AB"}]',
 '{"title":"SURAT TUGAS","opening":"Yang bertanda tangan di bawah ini memberikan tugas kepada:","after":"Untuk melaksanakan tugas {{keperluan}} di {{tujuan}} pada {{mulai}} sampai dengan {{selesai}}.{{?kendaraan}} Dalam pelaksanaan tugas ini menggunakan kendaraan {{kendaraan}}.{{/kendaraan}}","closing":"Demikian surat tugas ini dibuat untuk dilaksanakan dengan penuh tanggung jawab dan digunakan sebagaimana mestinya."}', null),
('SKK', 'Surat keterangan kerja', 'person', 'kepala_staf', 2,
 '[{"k":"keperluan","label":"Keperluan","type":"text","req":true,"ph":"Pengajuan pinjaman bank / beasiswa / administrasi"}]',
 '{"title":"SURAT KETERANGAN KERJA","opening":"Yang bertanda tangan di bawah ini menerangkan bahwa:","after":"adalah benar karyawan {{perusahaan}} yang bekerja sejak {{tgl_masuk}} sampai dengan saat ini sebagai {{jabatan}} di {{unit}}.","closing":"Surat keterangan ini dibuat untuk keperluan {{keperluan}}. Demikian surat keterangan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya."}', null),
('SPK', 'Surat penawaran kerja', 'candidate', 'ceo', 3,
 '[{"k":"posisi","label":"Posisi","type":"text","req":true},
   {"k":"lokasi","label":"Lokasi kerja","type":"text","req":true},
   {"k":"mulai","label":"Tanggal mulai kerja","type":"date","req":true},
   {"k":"percobaan","label":"Masa percobaan","type":"text","req":true,"ph":"3 bulan"},
   {"k":"gaji","label":"Gaji pokok per bulan","type":"text","req":true,"ph":"Rp…"},
   {"k":"tunjangan","label":"Tunjangan / fasilitas (opsional)","type":"textarea"},
   {"k":"batas","label":"Batas konfirmasi","type":"date","req":true}]',
 '{"title":"SURAT PENAWARAN KERJA","opening":"Dengan hormat,\nBerdasarkan hasil seleksi yang telah Saudara/i ikuti, {{perusahaan}} dengan senang hati menawarkan posisi kerja kepada:","after":"dengan ketentuan sebagai berikut:\nPosisi: {{posisi}}\nUnit: {{unit}}\nLokasi kerja: {{lokasi}}\nTanggal mulai: {{mulai}}\nMasa percobaan: {{percobaan}}\nGaji pokok: {{gaji}} per bulan{{?tunjangan}}\nTunjangan / fasilitas: {{tunjangan}}{{/tunjangan}}","closing":"Penawaran ini berlaku sampai {{batas}}. Mohon konfirmasi penerimaan penawaran kepada tim rekrutmen sebelum tanggal tersebut. Ketentuan lengkap akan dituangkan dalam perjanjian kerja.\nKami menantikan kehadiran Saudara/i di tim kami."}', null),
('SP', 'Surat peringatan', 'person', 'ceo', 4,
 '[{"k":"level","label":"Tingkat","type":"select","req":true,"opts":[["1","SP 1"],["2","SP 2"],["3","SP 3"]]},
   {"k":"pelanggaran","label":"Pelanggaran","type":"textarea","req":true,"ph":"Uraikan pelanggaran secara jelas dan faktual"},
   {"k":"kejadian","label":"Tanggal kejadian","type":"date","req":true},
   {"k":"tindak_lanjut","label":"Tindak lanjut yang diminta","type":"textarea","req":true,"ph":"Mis. hadir tepat waktu dan mengisi KKH penuh setiap hari kerja"}]',
 '{"title":"SURAT PERINGATAN {{level_romawi}}","opening":"Surat peringatan ini diberikan kepada:","after":"sehubungan dengan pelanggaran berikut:\n{{pelanggaran}}\nyang terjadi pada {{kejadian}}.{{?sp_aktif}}\nSebelumnya yang bersangkutan telah menerima {{sp_aktif}}.{{/sp_aktif}}","closing":"Yang bersangkutan diminta untuk: {{tindak_lanjut}}\nSurat peringatan ini berlaku selama 6 (enam) bulan sejak tanggal diterbitkan. Apabila dalam masa berlaku tersebut yang bersangkutan kembali melakukan pelanggaran, perusahaan akan memberikan sanksi lebih lanjut sesuai peraturan perusahaan."}', 6),
('SKA', 'Surat keterangan kepemilikan aset', 'assets', 'ceo', 5,
 '[{"k":"keperluan","label":"Keperluan","type":"text","req":true,"ph":"Pemeriksaan kendaraan / laporan investor / administrasi"}]',
 '{"title":"SURAT KETERANGAN ASET","opening":"Yang bertanda tangan di bawah ini menerangkan bahwa unit berikut:","after":"adalah unit yang dikelola oleh Rentalaja ({{perusahaan}}), dengan keterangan sebagaimana tercantum di atas.","closing":"Surat keterangan ini dibuat untuk keperluan {{keperluan}}. Keaslian dan status surat dapat diperiksa melalui kode QR pada surat ini."}', null)
on conflict (code) do update set name = excluded.name, subject = excluded.subject, signer = excluded.signer, sort = excluded.sort, fields = excluded.fields, tpl = excluded.tpl, valid_months = excluded.valid_months;

-- ---------- pembantu ----------
create or replace function public.pk_letter_role() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('me', p.id, 'code', p.code, 'role', p.role,
    'admin', p.role in ('ceo','kepala_staf'),
    'asset', p.role in ('ceo','kepala_staf') or p.code in (select jsonb_array_elements_text(coalesce((select value from pk_settings where key = 'letter_asset_team'), '[]'))),
    'rec', public.pk_rec_can(),
    'team', coalesce((select jsonb_agg(x.id) from pk_people x where x.boss_id = p.id and x.is_active), '[]'))
  from pk_people p where p.id = public.pk_me() and p.is_active
$$;

create or replace function public.pk_roman(n int) returns text language sql immutable as $$
  select (array['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'])[n]
$$;

create or replace function public.pk_tgl(d date) returns text language sql immutable as $$
  select extract(day from d)::int || ' ' || (array['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'])[extract(month from d)::int] || ' ' || extract(year from d)::int
$$;

-- unit aset untuk surat: data identitas + kolom yang kurang
create or replace function public.pk_letter_asset_rows(p_ids uuid[]) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'code', u.code, 'asset_no', u.asset_no, 'product', p.name, 'category', c.slug,
      'vehicle', c.slug in ('motor','mobil'), 'plate', u.plate_or_serial, 'frame_no', u.frame_no, 'engine_no', u.engine_no, 'color', u.color,
      'bpkb_name', u.bpkb_name, 'bpkb_location', u.bpkb_location, 'stnk_due', u.stnk_due, 'stnk_tax_due', u.stnk_tax_due,
      'branch', b.name, 'city', b.city, 'investor', u.owner_partner_id is not null,
      'missing', to_jsonb(array_remove(array[
        case when c.slug in ('motor','mobil') and nullif(btrim(u.plate_or_serial), '') is null then 'plat' end,
        case when c.slug in ('motor','mobil') and nullif(btrim(u.frame_no), '') is null then 'nomor rangka' end,
        case when c.slug in ('motor','mobil') and nullif(btrim(u.engine_no), '') is null then 'nomor mesin' end,
        case when c.slug in ('motor','mobil') and nullif(btrim(u.bpkb_name), '') is null then 'nama BPKB' end,
        case when c.slug in ('motor','mobil') and nullif(btrim(u.bpkb_location), '') is null then 'lokasi BPKB' end,
        case when c.slug in ('motor','mobil') and u.stnk_due is null then 'masa berlaku STNK' end,
        case when b.id is null then 'cabang' end], null))
    ) order by c.slug, u.code), '[]')
  from units u join products p on p.id = u.product_id join categories c on c.id = p.category_id left join branches b on b.id = u.branch_id
  where u.id = any(p_ids)
$$;
revoke execute on function public.pk_letter_asset_rows(uuid[]) from public, anon, authenticated;

-- daftar unit (tim aset): cari + tandai belum siap surat
create or replace function public.pk_letter_assets(p_q text default null, p_only_missing boolean default false) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb := public.pk_letter_role(); ids uuid[];
begin
  if r is null or not (r->>'asset')::boolean then raise exception 'Daftar aset hanya untuk tim aset, CEO, dan Kepala Staf'; end if;
  select array_agg(u.id) into ids from (
    select u.id from units u join products p on p.id = u.product_id join categories c on c.id = p.category_id
    where u.archived_at is null and c.slug in ('motor','mobil')
      and (coalesce(p_q, '') = '' or u.code ilike '%' || p_q || '%' or u.plate_or_serial ilike '%' || p_q || '%' or p.name ilike '%' || p_q || '%' or u.asset_no ilike '%' || p_q || '%')
    order by c.slug, u.code limit 400) u;
  return (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(public.pk_letter_asset_rows(coalesce(ids, '{}'))) x
          where not p_only_missing or jsonb_array_length(x->'missing') > 0);
end $$;

-- SP yang masih berlaku untuk seseorang
create or replace function public.pk_letter_sp_active(p_person uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('number', number, 'level', (data->>'level')::int, 'issued', issued_at, 'valid_until', valid_until) order by issued_at desc), '[]')
  from pk_letters where type_code = 'SP' and status = 'terbit' and p_person = any(people) and valid_until >= (now() at time zone 'Asia/Jakarta')::date
$$;
revoke execute on function public.pk_letter_sp_active(uuid) from public, anon, authenticated;

-- ---------- buat surat ----------
-- p: {type, biz, people[], candidate_app, assets[], fields{}, signer_id, letter_date}
create or replace function public.pk_letter_create(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb := public.pk_letter_role(); me uuid; t pk_letter_types; ppl uuid[]; ast uuid[]; sg pk_people; f jsonb := coalesce(p->'fields', '{}');
  d jsonb; lid uuid; v_biz text := upper(coalesce(nullif(p->>'biz', ''), 'HQ')); fd jsonb; ttl text; sub jsonb; v_known uuid; v_num text; lvl int; sp jsonb; app pk_rec_applications; cand pk_rec_candidates; j pk_rec_jobs;
begin
  if r is null then raise exception 'Akun Anda belum terdaftar di Data Karyawan'; end if;
  me := (r->>'me')::uuid;
  select * into t from pk_letter_types where code = p->>'type' and is_active;
  if t.code is null then raise exception 'Jenis surat tidak dikenal'; end if;
  if v_biz not in ('HQ','RA','WG','NA') then raise exception 'Unit bisnis tidak dikenal'; end if;
  ppl := coalesce(array(select (x)::uuid from jsonb_array_elements_text(coalesce(p->'people', '[]')) x), '{}');
  ast := coalesce(array(select (x)::uuid from jsonb_array_elements_text(coalesce(p->'assets', '[]')) x), '{}');
  -- isian wajib
  for fd in select * from jsonb_array_elements(t.fields) loop
    if coalesce((fd->>'req')::boolean, false) and nullif(btrim(coalesce(f->>(fd->>'k'), '')), '') is null then raise exception 'Isi %', lower(fd->>'label'); end if;
  end loop;
  -- hak membuat
  if t.subject in ('people','person') then
    if cardinality(ppl) = 0 then raise exception 'Pilih karyawan'; end if;
    if t.subject = 'person' and cardinality(ppl) <> 1 then raise exception 'Surat ini untuk satu orang'; end if;
    if exists (select 1 from unnest(ppl) x left join pk_people q on q.id = x where q.id is null or not q.is_active) then raise exception 'Ada karyawan yang tidak aktif'; end if;
    if not (r->>'admin')::boolean then
      if t.code = 'SKK' and ppl <> array[me] then raise exception 'Surat keterangan kerja hanya bisa diminta untuk diri sendiri'; end if;
      if t.code in ('ST','SP') and exists (select 1 from unnest(ppl) x where x <> me and not (r->'team') ? x::text) then raise exception 'Hanya untuk anggota tim langsung Anda'; end if;
      if t.code = 'SP' and me = any(ppl) then raise exception 'Tidak bisa membuat SP untuk diri sendiri'; end if;
    end if;
  elsif t.subject = 'candidate' then
    if not ((r->>'admin')::boolean or (r->>'rec')::boolean) then raise exception 'Surat penawaran hanya untuk tim rekrutmen'; end if;
    select * into app from pk_rec_applications where id = (p->>'candidate_app')::uuid;
    if app.id is null then raise exception 'Pilih pelamar'; end if;
    select * into cand from pk_rec_candidates where id = app.candidate_id; select * into j from pk_rec_jobs where id = app.job_id;
  elsif t.subject = 'assets' then
    if not (r->>'asset')::boolean then raise exception 'Surat kepemilikan aset hanya untuk tim aset, CEO, dan Kepala Staf'; end if;
    if cardinality(ast) = 0 then raise exception 'Pilih unit'; end if;
    if exists (select 1 from jsonb_array_elements(public.pk_letter_asset_rows(ast)) x where jsonb_array_length(x->'missing') > 0) then
      raise exception 'Ada unit yang datanya belum lengkap. Lengkapi dulu di data aset (lihat tab Unit belum siap surat).'; end if;
    v_biz := 'RA';
  end if;
  -- penanda tangan
  select * into sg from pk_people where id = (p->>'signer_id')::uuid and is_active;
  if sg.id is null then raise exception 'Pilih penanda tangan'; end if;
  if t.signer in ('ceo','kepala_staf') and sg.role not in ('ceo','kepala_staf') then raise exception 'Surat ini ditandatangani CEO atau Kepala Staf'; end if;
  if t.code = 'SP' then
    lvl := (f->>'level')::int; if lvl not between 1 and 3 then raise exception 'Pilih tingkat SP'; end if;
    v_known := (select boss_id from pk_people where id = ppl[1]);
    sp := public.pk_letter_sp_active(ppl[1]);
    if jsonb_array_length(sp) > 0 then f := f || jsonb_build_object('sp_aktif', (select string_agg('SP ' || (x->>'level') || ' nomor ' || (x->>'number'), ', ') from jsonb_array_elements(sp) x)); end if;
    f := f || jsonb_build_object('level_romawi', pk_roman(lvl));
  end if;
  -- potret data subjek (diambil dari server, bukan dari isian)
  sub := case t.subject
    when 'candidate' then jsonb_build_object('people', jsonb_build_array(jsonb_build_object('Nama', cand.name, 'Kota', cand.city)), 'nama', cand.name, 'unit', (select name from pk_units where code = j.unit_code))
    when 'assets' then jsonb_build_object('assets', public.pk_letter_asset_rows(ast))
    else jsonb_build_object('people', (select jsonb_agg(jsonb_build_object('Nama', q.name, 'Jabatan', coalesce(q.title, initcap(q.role)), 'Unit', coalesce(u.name, '—')) order by array_position(ppl, q.id)) from pk_people q left join pk_units u on u.code = q.unit_code where q.id = any(ppl)),
      'nama', (select name from pk_people where id = ppl[1]), 'jabatan', (select coalesce(title, initcap(role)) from pk_people where id = ppl[1]),
      'unit', (select u.name from pk_people q left join pk_units u on u.code = q.unit_code where q.id = ppl[1]),
      'tgl_masuk', (select case when joined_on is null then null else pk_tgl(joined_on) end from pk_people where id = ppl[1])) end;
  if t.code = 'SKK' and sub->>'tgl_masuk' is null then raise exception 'Tanggal masuk karyawan belum diisi di Tim & Peran'; end if;
  -- tanggal di isian ditulis lengkap
  for fd in select * from jsonb_array_elements(t.fields) where value->>'type' = 'date' loop
    if nullif(f->>(fd->>'k'), '') is not null then f := f || jsonb_build_object(fd->>'k', pk_tgl((f->>(fd->>'k'))::date)); end if;
  end loop;
  d := sub || f || jsonb_build_object('perusahaan', (select name from pk_fin_companies where code = 'PKI'));
  v_num := case when t.code = 'SP' then 'SP' || lvl else t.code end;
  ttl := t.name || coalesce(case when t.code = 'SP' then ' ' || lvl end, '') || ' · ' || coalesce(case t.subject when 'assets' then (select string_agg(coalesce(x->>'plate', x->>'code'), ', ') from jsonb_array_elements(sub->'assets') x)
      when 'candidate' then cand.name else (select string_agg(coalesce(nickname, name), ', ') from pk_people where id = any(ppl)) end, '');
  insert into pk_letters(type_code, num_code, biz, letter_date, people, candidate_app, assets, data, tpl, title, signer_id, signer_name, signer_title, known_by, created_by)
  values (t.code, v_num, v_biz, coalesce(nullif(p->>'letter_date', '')::date, (now() at time zone 'Asia/Jakarta')::date), ppl, app.id, ast, d, t.tpl, left(ttl, 200),
    sg.id, sg.name, coalesce(sg.title, initcap(sg.role)), v_known, me)
  returning id into lid;
  if sg.id = me then perform public.pk_letter_issue_now(lid);
  else perform public.pk_notify(sg.id, 'surat', 'Surat menunggu persetujuan Anda', ttl, '#/surat', false); end if;
  return jsonb_build_object('id', lid, 'status', (select status from pk_letters where id = lid));
end $$;

-- terbitkan: kunci nomor, aktifkan QR
create or replace function public.pk_letter_issue_now(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare l pk_letters; v_y int; v_m int; s int; v_code text; mon int;
begin
  select * into l from pk_letters where id = p_id for update;
  if l.status <> 'menunggu' then return; end if;
  v_y := extract(year from l.letter_date); v_m := extract(month from l.letter_date);
  insert into pk_letter_seq(num_code, biz, y, m, last) values (l.num_code, l.biz, v_y, v_m, 1)
  on conflict (num_code, biz, y, m) do update set last = pk_letter_seq.last + 1 returning last into s;
  v_code := case l.biz when 'WG' then 'TA' when 'HQ' then 'PKI' else l.biz end;
  select valid_months into mon from pk_letter_types where code = l.type_code;
  update pk_letters set status = 'terbit', seq = s, y = v_y, m = v_m, issued_at = now(),
    number = lpad(s::text, 3, '0') || '/' || l.num_code || '/' || v_code || '/' || pk_roman(v_m) || '/' || v_y,
    verify_key = encode(extensions.gen_random_bytes(9), 'hex'),
    valid_until = case when mon is not null then (l.letter_date + make_interval(months => mon))::date end
  where id = l.id;
  if l.created_by is not null and l.created_by <> l.signer_id then perform public.pk_notify(l.created_by, 'surat', 'Surat sudah terbit', l.title, '#/surat', false); end if;
end $$;
revoke execute on function public.pk_letter_issue_now(uuid) from public, anon, authenticated;

create or replace function public.pk_letter_decide(p_id uuid, p_ok boolean, p_note text default null) returns void language plpgsql security definer set search_path = public as $$
declare l pk_letters;
begin
  select * into l from pk_letters where id = p_id for update;
  if l.id is null or l.signer_id <> public.pk_me() then raise exception 'Hanya penanda tangan yang bisa menyetujui surat ini'; end if;
  if l.status <> 'menunggu' then raise exception 'Surat ini sudah diputuskan'; end if;
  if p_ok then perform public.pk_letter_issue_now(l.id);
  else
    update pk_letters set status = 'ditolak', decided_note = nullif(btrim(p_note), '') where id = l.id;
    if l.created_by is not null then perform public.pk_notify(l.created_by, 'surat', 'Surat ditolak', l.title || coalesce(': ' || nullif(btrim(p_note), ''), ''), '#/surat', false); end if;
  end if;
end $$;

create or replace function public.pk_letter_cancel(p_id uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare r jsonb := public.pk_letter_role(); l pk_letters;
begin
  select * into l from pk_letters where id = p_id for update;
  if l.id is null then raise exception 'Surat tidak ditemukan'; end if;
  if not ((r->>'admin')::boolean or l.signer_id = (r->>'me')::uuid or (l.created_by = (r->>'me')::uuid and l.status = 'menunggu')) then raise exception 'Hanya penanda tangan, pembuat, CEO, atau Kepala Staf yang bisa membatalkan'; end if;
  if l.status not in ('menunggu','terbit') then raise exception 'Surat ini sudah tidak aktif'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'Tulis alasan pembatalan'; end if;
  update pk_letters set status = 'batal', cancelled_at = now(), cancel_reason = btrim(p_reason), cancelled_by = (r->>'me')::uuid where id = l.id;
end $$;

-- arsip yang boleh dilihat: admin semua; SP hanya ybs, atasannya, penanda tangan, pembuat; aset untuk tim aset; lainnya: ybs, pembuat, penanda tangan, atasan ybs
create or replace function public.pk_letter_list(p_q text default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb := public.pk_letter_role(); me uuid;
begin
  if r is null then return '[]'; end if; me := (r->>'me')::uuid;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'type', l.type_code, 'number', l.number, 'title', l.title, 'status', l.status, 'letter_date', l.letter_date,
      'issued_at', l.issued_at, 'valid_until', l.valid_until, 'signer_id', l.signer_id, 'signer_name', l.signer_name, 'signer_title', l.signer_title, 'created_by', l.created_by, 'created_at', l.created_at,
      'people', l.people, 'assets', l.assets, 'data', l.data, 'tpl', l.tpl, 'verify_key', l.verify_key, 'biz', l.biz, 'known_by', l.known_by,
      'known_name', (select name from pk_people where id = l.known_by), 'known_title', (select coalesce(title, initcap(role)) from pk_people where id = l.known_by),
      'cancel_reason', l.cancel_reason, 'decided_note', l.decided_note,
      'mine_to_sign', l.status = 'menunggu' and l.signer_id = me) order by coalesce(l.issued_at, l.created_at) desc), '[]')
    from pk_letters l
    where ((r->>'admin')::boolean or l.created_by = me or l.signer_id = me or me = any(l.people)
        or (l.type_code <> 'SP' and l.type_code <> 'SKA' and exists (select 1 from pk_people q where q.id = any(l.people) and q.boss_id = me))
        or (l.type_code = 'SP' and (l.known_by = me))
        or (l.type_code = 'SKA' and (r->>'asset')::boolean)
        or (l.type_code = 'SPK' and (r->>'rec')::boolean))
      and (coalesce(p_q, '') = '' or l.number ilike '%' || p_q || '%' or l.title ilike '%' || p_q || '%'
        or exists (select 1 from jsonb_array_elements(coalesce(l.data->'assets', '[]')) a where a->>'plate' ilike '%' || p_q || '%' or a->>'code' ilike '%' || p_q || '%'))
    limit 500);
end $$;


-- petunjuk SP: SP yang masih berlaku (untuk atasan / CEO / Kepala Staf saat membuat SP)
create or replace function public.pk_letter_sp_hint(p_person uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb := public.pk_letter_role();
begin
  if r is null or not ((r->>'admin')::boolean or (r->'team') ? p_person::text) then return '[]'; end if;
  return public.pk_letter_sp_active(p_person);
end $$;

-- verifikasi publik dari QR: tanpa data pribadi berlebih
create or replace function public.pk_letter_verify(p_key text) returns jsonb language sql stable security definer set search_path = public as $$
  select case when l.id is null then jsonb_build_object('ok', false) else jsonb_build_object('ok', true,
    'number', l.number, 'type', t.name || case when l.type_code = 'SP' then ' ' || (l.data->>'level') else '' end, 'date', l.letter_date,
    'company', (select name from pk_fin_companies where code = l.company_code),
    'signer', l.signer_name, 'signer_title', l.signer_title,
    'about', case when l.type_code = 'SKA' then (select string_agg(coalesce(a->>'product', '') || ' ' || coalesce(a->>'plate', a->>'code'), ', ') from jsonb_array_elements(l.data->'assets') a)
                  else (select string_agg(regexp_replace(a->>'Nama', '^(\S+)(\s+\S).*$', '\1\2.'), ', ') from jsonb_array_elements(l.data->'people') a) end,
    'status', case when l.status = 'batal' then 'batal' when l.valid_until is not null and l.valid_until < (now() at time zone 'Asia/Jakarta')::date then 'kedaluwarsa' else 'berlaku' end,
    'valid_until', l.valid_until, 'cancelled_at', l.cancelled_at) end
  from (select 1) x left join pk_letters l on l.verify_key = p_key and l.status in ('terbit','batal') left join pk_letter_types t on t.code = l.type_code
$$;

grant execute on function public.pk_letter_verify(text) to anon, authenticated;
do $$ declare f text; begin
  foreach f in array array['pk_letter_role()','pk_letter_assets(text,boolean)','pk_letter_create(jsonb)','pk_letter_decide(uuid,boolean,text)','pk_letter_cancel(uuid,text)','pk_letter_list(text)','pk_letter_sp_hint(uuid)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
