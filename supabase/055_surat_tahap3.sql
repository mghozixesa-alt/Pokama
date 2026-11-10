-- 055: surat tahap 3 — surat jalan runner (SJ), berita acara kerusakan/kehilangan (BAK), mutasi (SM), pengangkatan karyawan tetap (SKT),
--      promosi jabatan (SPJ), pemberitahuan investor (SPI), penawaran kerja sama (SPKS). Aturan pembuat per jenis lewat kolom makers.
alter table public.pk_letter_types add column if not exists makers text[];
alter table public.pk_letter_types add column if not exists makers_label text;
alter table public.pk_letter_types drop constraint if exists pk_letter_types_subject_check;
alter table public.pk_letter_types add constraint pk_letter_types_subject_check check (subject in ('people','person','candidate','assets','booking','investor','free'));
alter table public.pk_letter_types drop constraint if exists pk_letter_types_signer_check;
alter table public.pk_letter_types add constraint pk_letter_types_signer_check check (signer in ('boss','kepala_staf','ceo','leader'));

insert into public.pk_letter_types(code, name, subject, signer, sort, fields, tpl, valid_months, need_complete, makers, makers_label) values
('SJ', 'Surat jalan runner', 'booking', 'leader', 10,
 '[{"k":"runner","label":"Runner","type":"person","req":true},
   {"k":"tugas","label":"Tugas","type":"select","req":true,"opts":[["mengantar","Mengantar unit ke penyewa"],["menjemput","Menjemput unit dari penyewa"],["mengantar dan menjemput","Mengantar dan menjemput"]]},
   {"k":"alamat","label":"Alamat tujuan","type":"text","req":true,"ph":"Hotel / alamat penyewa"},
   {"k":"tanggal","label":"Tanggal jalan","type":"date","req":true}]',
 '{"title":"SURAT JALAN","no_pay":true,"opening":"Dengan ini menerangkan bahwa {{runner}} adalah petugas Rentalaja yang ditugaskan {{tugas}} unit sewa berikut:","after":"ke alamat {{alamat}} pada {{tanggal}}.","closing":"Unit tersebut adalah milik/kelolaan Rentalaja ({{perusahaan}}) dan dibawa untuk keperluan layanan sewa. Mohon bantuan pihak terkait untuk kelancaran tugas. Keaslian surat dapat diperiksa melalui kode QR."}', null, true,
 array['ra','asset'], 'tim Rentalaja, tim aset, CEO, Kepala Staf'),
('BAK', 'Berita acara kerusakan / kehilangan', 'booking', 'kepala_staf', 11,
 '[{"k":"jenis","label":"Jenis","type":"select","req":true,"opts":[["kerusakan","Kerusakan unit"],["kehilangan","Kehilangan unit / kelengkapan"]]},
   {"k":"kejadian","label":"Tanggal diketahui","type":"date","req":true},
   {"k":"uraian","label":"Uraian kerusakan / kehilangan","type":"textarea","req":true,"ph":"Spion kiri patah, body depan baret ±10 cm"},
   {"k":"biaya","label":"Perkiraan biaya (opsional)","type":"text","ph":"Rp…"},
   {"k":"saksi","label":"Saksi (opsional)","type":"text","ph":"Nama petugas yang memeriksa"}]',
 '{"title":"BERITA ACARA {{jenis_judul}}","no_pay":true,"opening":"Pada {{kejadian}} telah diperiksa unit sewa atas pemesanan berikut:","after":"dengan hasil pemeriksaan: {{uraian}}{{?biaya}}\nPerkiraan biaya penggantian/perbaikan: {{biaya}}{{/biaya}}{{?saksi}}\nDiperiksa bersama: {{saksi}}{{/saksi}}","closing":"Berita acara ini dibuat sebagai dasar penyelesaian dengan penyewa {{penyewa}} sesuai syarat dan ketentuan sewa Rentalaja. Penyewa dapat menandatangani salinan cetak berita acara ini."}', null, true,
 array['ra','asset','keuangan'], 'tim Rentalaja, tim aset, Keuangan, CEO, Kepala Staf'),
('SM', 'Surat mutasi', 'person', 'kepala_staf', 12,
 '[{"k":"tujuan","label":"Dipindahkan ke (unit / cabang)","type":"text","req":true,"ph":"Rentalaja Bandung"},
   {"k":"jabatan_baru","label":"Jabatan di tempat baru (opsional)","type":"text"},
   {"k":"mulai","label":"Berlaku mulai","type":"date","req":true},
   {"k":"alasan","label":"Pertimbangan (opsional)","type":"textarea","ph":"Kebutuhan operasional cabang Bandung"}]',
 '{"title":"SURAT KEPUTUSAN MUTASI","opening":"Dengan memperhatikan kebutuhan organisasi, {{perusahaan}} memutuskan memindahkan karyawan berikut:","after":"dari {{unit}} ke {{tujuan}}{{?jabatan_baru}} dengan jabatan {{jabatan_baru}}{{/jabatan_baru}}, berlaku mulai {{mulai}}.{{?alasan}}\nPertimbangan: {{alasan}}{{/alasan}}","closing":"Karyawan yang bersangkutan diminta melaksanakan serah terima pekerjaan sebelum tanggal berlaku. Hak dan kewajiban lainnya tetap mengikuti peraturan perusahaan."}', null, true,
 array['admin'], 'CEO dan Kepala Staf'),
('SKT', 'Surat pengangkatan karyawan tetap', 'person', 'ceo', 13,
 '[{"k":"jabatan_tetap","label":"Jabatan","type":"text","req":true},
   {"k":"mulai","label":"Berlaku mulai","type":"date","req":true},
   {"k":"catatan","label":"Ketentuan tambahan (opsional)","type":"textarea"}]',
 '{"title":"SURAT KEPUTUSAN PENGANGKATAN KARYAWAN TETAP","opening":"Berdasarkan penilaian kinerja selama masa kerja, {{perusahaan}} memutuskan mengangkat:","after":"sebagai karyawan tetap dengan jabatan {{jabatan_tetap}} di {{unit}}, berlaku mulai {{mulai}}.{{?catatan}}\n{{catatan}}{{/catatan}}","closing":"Hak dan kewajiban karyawan tetap mengikuti peraturan perusahaan yang berlaku. Selamat dan terima kasih atas kontribusinya."}', null, true,
 array['admin'], 'CEO dan Kepala Staf'),
('SPJ', 'Surat promosi jabatan', 'person', 'ceo', 14,
 '[{"k":"jabatan_baru","label":"Jabatan baru","type":"text","req":true},
   {"k":"unit_baru","label":"Unit (bila berubah, opsional)","type":"text"},
   {"k":"mulai","label":"Berlaku mulai","type":"date","req":true},
   {"k":"catatan","label":"Ketentuan tambahan (opsional)","type":"textarea"}]',
 '{"title":"SURAT KEPUTUSAN PROMOSI JABATAN","opening":"Berdasarkan penilaian kinerja dan kebutuhan organisasi, {{perusahaan}} memutuskan mempromosikan:","after":"dari jabatan {{jabatan}} menjadi {{jabatan_baru}}{{?unit_baru}} di {{unit_baru}}{{/unit_baru}}, berlaku mulai {{mulai}}.{{?catatan}}\n{{catatan}}{{/catatan}}","closing":"Hak dan kewajiban pada jabatan baru mengikuti peraturan perusahaan yang berlaku. Selamat dan terima kasih atas kontribusinya."}', null, true,
 array['admin'], 'CEO dan Kepala Staf'),
('SPI', 'Surat pemberitahuan investor', 'investor', 'ceo', 15,
 '[{"k":"perihal","label":"Perihal","type":"text","req":true,"ph":"Laporan unit bulan Oktober 2026"},
   {"k":"isi","label":"Isi pemberitahuan","type":"textarea","req":true}]',
 '{"title":"SURAT PEMBERITAHUAN","opening":"Kepada Yth. Bapak/Ibu {{penerima}},\nPerihal: {{perihal}}\nDengan hormat,","after":"{{isi}}","closing":"Demikian pemberitahuan ini kami sampaikan. Informasi lengkap dapat dilihat di Portal Investor (investor.pokama.org). Terima kasih atas kepercayaan Bapak/Ibu kepada Rentalaja."}', null, true,
 array['keuangan'], 'Keuangan, CEO, dan Kepala Staf'),
('SPKS', 'Surat penawaran kerja sama', 'free', 'ceo', 16,
 '[{"k":"kepada","label":"Kepada (nama / jabatan)","type":"text","req":true,"ph":"Bapak/Ibu Pimpinan"},
   {"k":"instansi","label":"Instansi / usaha","type":"text","req":true,"ph":"Hotel …, Garut"},
   {"k":"perihal","label":"Perihal","type":"text","req":true,"ph":"Penawaran kerja sama layanan sewa untuk tamu hotel"},
   {"k":"isi","label":"Isi penawaran","type":"textarea","req":true,"ph":"Ringkas: apa yang ditawarkan, manfaat bagi mitra, skema (komisi/diskon)"},
   {"k":"kontak","label":"Narahubung","type":"text","req":true,"ph":"Nama · nomor WhatsApp"}]',
 '{"title":"SURAT PENAWARAN KERJA SAMA","opening":"Kepada Yth. {{kepada}}\n{{instansi}}\nPerihal: {{perihal}}\nDengan hormat,","after":"{{isi}}","closing":"Kami berharap dapat berdiskusi lebih lanjut. Untuk informasi dan jadwal pertemuan, silakan menghubungi {{kontak}}. Atas perhatian dan kerja samanya kami ucapkan terima kasih."}', null, true,
 array['bizdev'], 'tim BizDev/Marketing, CEO, dan Kepala Staf')
on conflict (code) do update set name = excluded.name, subject = excluded.subject, signer = excluded.signer, sort = excluded.sort, fields = excluded.fields, tpl = excluded.tpl,
  valid_months = excluded.valid_months, need_complete = excluded.need_complete, makers = excluded.makers, makers_label = excluded.makers_label;

update public.pk_letter_types set makers_label = case code
  when 'ST' then 'semua (untuk diri sendiri/tim)' when 'SKK' then 'semua (untuk diri sendiri)' when 'SPK' then 'tim rekrutmen, CEO, Kepala Staf'
  when 'SP' then 'atasan, CEO, Kepala Staf' when 'SKA' then 'tim aset, CEO, Kepala Staf' when 'PKWT' then 'tim rekrutmen, CEO, Kepala Staf'
  when 'BAST' then 'tim aset, CEO, Kepala Staf' when 'SKU' then 'CEO dan Kepala Staf' when 'STG' then 'tim Rentalaja, Keuangan, tim aset, CEO, Kepala Staf' else makers_label end
where makers is null;

create or replace function public.pk_letters_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare t pk_letter_types; sg pk_people;
begin
  select * into t from pk_letter_types where code = new.type_code;
  select * into sg from pk_people where id = new.signer_id;
  if t.signer = 'ceo' and sg.role <> 'ceo' then raise exception '% wajib disetujui CEO', t.name; end if;
  if t.signer = 'kepala_staf' and sg.role not in ('ceo','kepala_staf') then raise exception '% ditandatangani Kepala Staf atau CEO', t.name; end if;
  if t.signer = 'leader' and sg.role not in ('ceo','kepala_staf','leader') then raise exception '% ditandatangani leader, Kepala Staf, atau CEO', t.name; end if;
  if t.signer = 'boss' and sg.role not in ('ceo','kepala_staf')
     and exists (select 1 from pk_people q where q.id = any(new.people) and q.boss_id is distinct from sg.id) then
    raise exception 'Penanda tangan surat tugas harus atasan langsung semua orang yang ditugaskan, atau CEO / Kepala Staf';
  end if;
  return new;
end $$;

create or replace function public.pk_letter_investors() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb := public.pk_letter_role();
begin
  if r is null or not ((r->>'admin')::boolean or r->>'role' = 'keuangan') then return '[]'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'city', city) order by name), '[]') from iv_investors where coalesce(demo, false) = false);
end $$;
revoke execute on function public.pk_letter_investors() from public, anon;
grant execute on function public.pk_letter_investors() to authenticated;

create or replace function public.pk_letter_create(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb := public.pk_letter_role(); me uuid; t pk_letter_types; ppl uuid[]; ast uuid[]; sg pk_people; f jsonb := coalesce(p->'fields', '{}');
  d jsonb; lid uuid; v_biz text := upper(coalesce(nullif(p->>'biz', ''), 'HQ')); fd jsonb; ttl text; sub jsonb; v_known uuid; v_num text; lvl int; sp jsonb; app pk_rec_applications; cand pk_rec_candidates; j pk_rec_jobs; bk jsonb; v_valid date; inv iv_investors; v_ok boolean; v_ra boolean; v_unit text;
begin
  if r is null then raise exception 'Akun Anda belum terdaftar di Data Karyawan'; end if;
  me := (r->>'me')::uuid;
  select * into t from pk_letter_types where code = p->>'type' and is_active;
  if t.code is null then raise exception 'Jenis surat tidak dikenal'; end if;
  if v_biz not in ('HQ','RA','WG','NA') then raise exception 'Unit bisnis tidak dikenal'; end if;
  ppl := coalesce(array(select (x)::uuid from jsonb_array_elements_text(coalesce(p->'people', '[]')) x), '{}');
  ast := coalesce(array(select (x)::uuid from jsonb_array_elements_text(coalesce(p->'assets', '[]')) x), '{}');
  for fd in select * from jsonb_array_elements(t.fields) loop
    if coalesce((fd->>'req')::boolean, false) and nullif(btrim(coalesce(f->>(fd->>'k'), '')), '') is null then raise exception 'Isi %', lower(fd->>'label'); end if;
  end loop;
  select q.unit_code, (q.unit_code = 'RA' or u.parent = 'RA') into v_unit, v_ra from pk_people q left join pk_units u on u.code = q.unit_code where q.id = me;
  if t.makers is not null and not (r->>'admin')::boolean then
    v_ok := ('rec' = any(t.makers) and (r->>'rec')::boolean) or ('asset' = any(t.makers) and (r->>'asset')::boolean)
      or ('ra' = any(t.makers) and coalesce(v_ra, false)) or ('keuangan' = any(t.makers) and r->>'role' = 'keuangan')
      or ('bizdev' = any(t.makers) and v_unit in ('BIZ','MKT')) or ('leader' = any(t.makers) and r->>'role' = 'leader');
    if not coalesce(v_ok, false) then raise exception '% hanya bisa dibuat oleh: %', t.name, t.makers_label; end if;
  end if;
  if t.subject in ('people','person') then
    if cardinality(ppl) = 0 then raise exception 'Pilih karyawan'; end if;
    if t.subject = 'person' and cardinality(ppl) <> 1 then raise exception 'Surat ini untuk satu orang'; end if;
    if exists (select 1 from unnest(ppl) x left join pk_people q on q.id = x where q.id is null or not q.is_active) then raise exception 'Ada karyawan yang tidak aktif'; end if;
    if not (r->>'admin')::boolean then
      if t.code = 'SKK' and ppl <> array[me] then raise exception 'Surat keterangan kerja hanya bisa diminta untuk diri sendiri'; end if;
      if t.code in ('ST','SP') and exists (select 1 from unnest(ppl) x where x <> me and not (r->'team') ? x::text) then raise exception 'Hanya untuk anggota tim langsung Anda'; end if;
      if t.code = 'SP' and me = any(ppl) then raise exception 'Tidak bisa membuat SP untuk diri sendiri'; end if;
      if t.code in ('PKWT','SKU') and not (t.code = 'PKWT' and (r->>'rec')::boolean) then raise exception '% hanya dibuat oleh CEO, Kepala Staf%', t.name, case when t.code = 'PKWT' then ', atau tim rekrutmen' else '' end; end if;
    end if;
  elsif t.subject = 'candidate' then
    if not ((r->>'admin')::boolean or (r->>'rec')::boolean) then raise exception 'Surat penawaran hanya untuk tim rekrutmen'; end if;
    select * into app from pk_rec_applications where id = (p->>'candidate_app')::uuid;
    if app.id is null then raise exception 'Pilih pelamar'; end if;
    select * into cand from pk_rec_candidates where id = app.candidate_id; select * into j from pk_rec_jobs where id = app.job_id;
  elsif t.subject = 'assets' then
    if not (r->>'asset')::boolean then raise exception '% hanya untuk tim aset, CEO, dan Kepala Staf', t.name; end if;
    if cardinality(ast) = 0 then raise exception 'Pilih unit'; end if;
    if t.need_complete and exists (select 1 from jsonb_array_elements(public.pk_letter_asset_rows(ast)) x where jsonb_array_length(x->'missing') > 0) then
      raise exception 'Ada unit yang datanya belum lengkap. Lengkapi dulu di data aset (lihat tab Unit belum siap surat).'; end if;
    v_biz := 'RA';
  elsif t.subject = 'booking' then
    if t.makers is null and not ((r->>'admin')::boolean or (r->>'asset')::boolean or r->>'role' = 'keuangan' or exists (select 1 from pk_people q left join pk_units u on u.code = q.unit_code where q.id = me and (q.unit_code = 'RA' or u.parent = 'RA'))) then
      raise exception 'Surat tagihan/teguran hanya untuk tim Rentalaja, Keuangan, CEO, dan Kepala Staf'; end if;
    bk := public.pk_letter_booking_row(p->>'booking');
    if bk is null or bk->>'code' is null then raise exception 'Kode booking tidak ditemukan'; end if;
    v_biz := 'RA';
  elsif t.subject = 'investor' then
    select * into inv from iv_investors where id = nullif(p->>'investor', '')::uuid;
    if inv.id is null then raise exception 'Pilih investor'; end if;
    v_biz := 'RA';
  end if;
  select * into sg from pk_people where id = (p->>'signer_id')::uuid and is_active;
  if sg.id is null then raise exception 'Pilih penanda tangan'; end if;
  if t.signer in ('ceo','kepala_staf') and sg.role not in ('ceo','kepala_staf') then raise exception 'Surat ini ditandatangani CEO atau Kepala Staf'; end if;
  if t.signer = 'leader' and sg.role not in ('ceo','kepala_staf','leader') then raise exception 'Surat ini ditandatangani leader, Kepala Staf, atau CEO'; end if;
  if t.code = 'PKWT' then v_known := ppl[1]; end if;
  if t.code = 'SP' then
    lvl := (f->>'level')::int; if lvl not between 1 and 3 then raise exception 'Pilih tingkat SP'; end if;
    v_known := (select boss_id from pk_people where id = ppl[1]);
    sp := public.pk_letter_sp_active(ppl[1]);
    if jsonb_array_length(sp) > 0 then f := f || jsonb_build_object('sp_aktif', (select string_agg('SP ' || (x->>'level') || ' nomor ' || (x->>'number'), ', ') from jsonb_array_elements(sp) x)); end if;
    f := f || jsonb_build_object('level_romawi', pk_roman(lvl));
  end if;
  sub := case t.subject
    when 'candidate' then jsonb_build_object('people', jsonb_build_array(jsonb_build_object('Nama', cand.name, 'Kota', cand.city)), 'nama', cand.name, 'unit', (select name from pk_units where code = j.unit_code))
    when 'assets' then jsonb_build_object('assets', public.pk_letter_asset_rows(ast))
    when 'investor' then jsonb_build_object('penerima', inv.name, 'people', jsonb_build_array(jsonb_build_object('Nama', inv.name, 'Kota', coalesce(inv.city, '—'))))
    when 'free' then '{}'::jsonb
    when 'booking' then jsonb_build_object('booking', bk, 'penyewa', (bk->>'penyewa'), 'sisa', 'Rp' || replace(to_char((bk->>'sisa')::numeric, 'FM999,999,999'), ',', '.'))
    else jsonb_build_object('people', (select jsonb_agg(jsonb_build_object('Nama', q.name, 'Jabatan', coalesce(q.title, initcap(q.role)), 'Unit', coalesce(u.name, '—')) order by array_position(ppl, q.id)) from pk_people q left join pk_units u on u.code = q.unit_code where q.id = any(ppl)),
      'nama', (select name from pk_people where id = ppl[1]), 'jabatan', (select coalesce(title, initcap(role)) from pk_people where id = ppl[1]),
      'unit', (select u.name from pk_people q left join pk_units u on u.code = q.unit_code where q.id = ppl[1]),
      'tgl_masuk', (select case when joined_on is null then null else pk_tgl(joined_on) end from pk_people where id = ppl[1])) end;
  if t.code = 'SKK' and sub->>'tgl_masuk' is null then raise exception 'Tanggal masuk karyawan belum diisi di Tim & Peran'; end if;
  for fd in select * from jsonb_array_elements(t.fields) where value->>'type' = 'date' loop
    if nullif(f->>(fd->>'k'), '') is not null then f := f || jsonb_build_object(fd->>'k', pk_tgl((f->>(fd->>'k'))::date)); end if;
  end loop;
  d := sub || f || jsonb_build_object('perusahaan', (select name from pk_fin_companies where code = 'PKI'), 'penanda_tangan', sg.name, 'jabatan_ttd', coalesce(sg.title, initcap(sg.role)))
    || case when t.code = 'PKWT' then jsonb_build_object('known_label', 'Pihak Kedua,') else '{}' end
    || case when t.code = 'STG' then jsonb_build_object('jenis_judul', case when f->>'jenis' = 'teguran' then 'TEGURAN' else 'TAGIHAN' end) else '{}' end
    || case when t.code = 'BAK' then jsonb_build_object('jenis_judul', case when f->>'jenis' = 'kehilangan' then 'KEHILANGAN' else 'KERUSAKAN' end) else '{}' end;
  v_valid := case when nullif(p->'fields'->>'sampai', '') is not null then (p->'fields'->>'sampai')::date when t.code = 'PKWT' then nullif(p->'fields'->>'selesai', '')::date end;
  v_num := case when t.code = 'SP' then 'SP' || lvl else t.code end;
  ttl := t.name || coalesce(case when t.code = 'SP' then ' ' || lvl end, '') || ' · ' || coalesce(case t.subject when 'assets' then (select string_agg(coalesce(x->>'plate', x->>'code'), ', ') from jsonb_array_elements(sub->'assets') x)
      when 'candidate' then cand.name when 'investor' then inv.name when 'free' then coalesce(f->>'kepada', '') || coalesce(' · ' || nullif(f->>'instansi', ''), '') when 'booking' then (bk->>'code') || ' · ' || (bk->>'penyewa') else (select string_agg(coalesce(nickname, name), ', ') from pk_people where id = any(ppl)) end, '');
  insert into pk_letters(type_code, num_code, biz, letter_date, people, candidate_app, assets, data, tpl, title, signer_id, signer_name, signer_title, known_by, created_by)
  values (t.code, v_num, v_biz, coalesce(nullif(p->>'letter_date', '')::date, (now() at time zone 'Asia/Jakarta')::date), ppl, app.id, ast, d, t.tpl, left(ttl, 200),
    sg.id, sg.name, coalesce(sg.title, initcap(sg.role)), v_known, me)
  returning id into lid;
  if v_valid is not null then update pk_letters set valid_until = v_valid where id = lid; end if;
  if sg.id = me then perform public.pk_letter_issue_now(lid);
  else perform public.pk_notify(sg.id, 'surat', 'Surat menunggu persetujuan Anda', ttl, '#/surat', false); end if;
  return jsonb_build_object('id', lid, 'status', (select status from pk_letters where id = lid));
end $$;

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
        or (l.type_code not in ('SP','SKA','PKWT','BAST','STG','SJ','BAK','SKT','SPJ','SPI','SPKS') and exists (select 1 from pk_people q where q.id = any(l.people) and q.boss_id = me))
        or (l.type_code = 'SP' and (l.known_by = me))
        or (l.type_code in ('SKA','BAST','SJ','BAK') and (r->>'asset')::boolean)
        or (l.type_code = 'SPK' and (r->>'rec')::boolean))
      and (coalesce(p_q, '') = '' or l.number ilike '%' || p_q || '%' or l.title ilike '%' || p_q || '%'
        or exists (select 1 from jsonb_array_elements(coalesce(l.data->'assets', '[]')) a where a->>'plate' ilike '%' || p_q || '%' or a->>'code' ilike '%' || p_q || '%'))
    limit 500);
end $$;

create or replace function public.pk_letter_verify(p_key text) returns jsonb language sql stable security definer set search_path = public as $$
  select case when l.id is null then jsonb_build_object('ok', false) else jsonb_build_object('ok', true,
    'number', l.number, 'type', t.name || case when l.type_code = 'SP' then ' ' || (l.data->>'level') else '' end, 'date', l.letter_date,
    'company', (select name from pk_fin_companies where code = l.company_code),
    'signer', l.signer_name, 'signer_title', l.signer_title,
    'about', case when l.type_code = 'SPKS' then coalesce(l.data->>'instansi', '') when l.type_code = 'SPI' then 'Investor' when l.type_code in ('STG','SJ','BAK') then 'Booking ' || (l.data->'booking'->>'code') when l.type_code in ('SKA','BAST') then (select string_agg(coalesce(a->>'product', '') || ' ' || coalesce(a->>'plate', a->>'code'), ', ') from jsonb_array_elements(l.data->'assets') a)
                  else (select string_agg(regexp_replace(a->>'Nama', '^(\S+)(\s+\S).*$', '\1\2.'), ', ') from jsonb_array_elements(l.data->'people') a) end,
    'status', case when l.status = 'batal' then 'batal' when l.valid_until is not null and l.valid_until < (now() at time zone 'Asia/Jakarta')::date then 'kedaluwarsa' else 'berlaku' end,
    'valid_until', l.valid_until, 'cancelled_at', l.cancelled_at) end
  from (select 1) x left join pk_letters l on l.verify_key = p_key and l.status in ('terbit','batal') left join pk_letter_types t on t.code = l.type_code
$$;
