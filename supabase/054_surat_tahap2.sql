-- DRAF: belum diterapkan ke database (ditahan sampai bug tampilan Surat dicek).
-- 054: surat tahap 2 — kontrak kerja (PKWT), berita acara serah terima unit (BAST), surat kuasa (SKU), surat tagihan/teguran penyewa (STG)
alter table public.pk_letter_types add column if not exists need_complete boolean not null default true;
alter table public.pk_letter_types drop constraint if exists pk_letter_types_subject_check;
alter table public.pk_letter_types add constraint pk_letter_types_subject_check check (subject in ('people','person','candidate','assets','booking'));

insert into public.pk_letter_types(code, name, subject, signer, sort, fields, tpl, valid_months, need_complete) values
('PKWT', 'Kontrak kerja (PKWT)', 'person', 'ceo', 6,
 '[{"k":"posisi","label":"Posisi / jabatan","type":"text","req":true},
   {"k":"lokasi","label":"Lokasi kerja","type":"text","req":true,"ph":"Rentalaja Garut Kota"},
   {"k":"mulai","label":"Tanggal mulai","type":"date","req":true},
   {"k":"selesai","label":"Tanggal berakhir","type":"date","req":true},
   {"k":"gaji","label":"Gaji pokok per bulan","type":"text","req":true,"ph":"Rp…"},
   {"k":"jam_kerja","label":"Hari & jam kerja","type":"text","req":true,"ph":"Senin–Sabtu, 08.00–17.00 WIB"},
   {"k":"tunjangan","label":"Tunjangan / fasilitas (opsional)","type":"textarea"}]',
 '{"title":"PERJANJIAN KERJA WAKTU TERTENTU","opening":"Perjanjian kerja ini dibuat antara {{perusahaan}}, dalam hal ini diwakili oleh {{penanda_tangan}} selaku {{jabatan_ttd}}, selanjutnya disebut PIHAK PERTAMA, dengan:","after":"selanjutnya disebut PIHAK KEDUA. Kedua pihak sepakat atas ketentuan berikut:\n1. PIHAK KEDUA bekerja sebagai {{posisi}} di {{lokasi}}.\n2. Jangka waktu perjanjian mulai {{mulai}} sampai dengan {{selesai}}.\n3. Hari dan jam kerja: {{jam_kerja}}.\n4. PIHAK KEDUA menerima gaji pokok {{gaji}} per bulan{{?tunjangan}}, dengan tunjangan / fasilitas: {{tunjangan}}{{/tunjangan}}.\n5. PIHAK KEDUA wajib mematuhi peraturan perusahaan, Sistem Kerja (KKH), dan menjaga kerahasiaan data perusahaan serta pelanggan.\n6. Hal yang belum diatur dalam perjanjian ini mengikuti peraturan perusahaan dan peraturan perundang-undangan ketenagakerjaan yang berlaku.","closing":"Perjanjian ini dibuat dalam keadaan sadar tanpa paksaan. PIHAK KEDUA menandatangani salinan cetak perjanjian ini sebagai tanda persetujuan."}', null, true),
('BAST', 'Berita acara serah terima unit', 'assets', 'kepala_staf', 7,
 '[{"k":"pihak_pertama","label":"Yang menyerahkan","type":"text","req":true,"ph":"Tim Aset Pokama"},
   {"k":"pihak_kedua","label":"Yang menerima","type":"text","req":true,"ph":"Cabang Rentalaja Garut Kota / nama investor"},
   {"k":"lokasi","label":"Lokasi serah terima","type":"text","req":true},
   {"k":"kondisi","label":"Kondisi unit saat diserahkan","type":"textarea","req":true,"ph":"Baik, tanpa kerusakan; odometer …"},
   {"k":"kelengkapan","label":"Kelengkapan (opsional)","type":"textarea","ph":"STNK asli, 2 kunci, 2 helm"}]',
 '{"title":"BERITA ACARA SERAH TERIMA UNIT","opening":"Pada tanggal surat ini telah dilakukan serah terima unit di {{lokasi}} dari {{pihak_pertama}} kepada {{pihak_kedua}}, atas unit berikut:","after":"Kondisi unit saat diserahkan: {{kondisi}}{{?kelengkapan}}\nKelengkapan: {{kelengkapan}}{{/kelengkapan}}","closing":"Sejak serah terima ini, tanggung jawab atas unit tersebut beralih kepada pihak yang menerima sesuai ketentuan yang berlaku. Pihak yang menyerahkan dan menerima menandatangani salinan cetak berita acara ini."}', null, false),
('SKU', 'Surat kuasa', 'person', 'ceo', 8,
 '[{"k":"urusan","label":"Urusan yang dikuasakan","type":"textarea","req":true,"ph":"Mengurus perpanjangan STNK dan pembayaran pajak kendaraan"},
   {"k":"objek","label":"Objek (opsional)","type":"text","ph":"Honda Beat Z 1234 AB"},
   {"k":"instansi","label":"Instansi / tempat (opsional)","type":"text","ph":"Samsat Garut"},
   {"k":"sampai","label":"Kuasa berlaku sampai","type":"date","req":true}]',
 '{"title":"SURAT KUASA","opening":"Yang bertanda tangan di bawah ini, {{penanda_tangan}}, {{jabatan_ttd}} {{perusahaan}}, selanjutnya disebut PEMBERI KUASA, memberikan kuasa kepada:","after":"selanjutnya disebut PENERIMA KUASA, untuk dan atas nama {{perusahaan}}: {{urusan}}{{?objek}}, atas {{objek}}{{/objek}}{{?instansi}}, di {{instansi}}{{/instansi}}.","closing":"Kuasa ini berlaku sampai {{sampai}} dan tidak dapat dialihkan kepada pihak lain. Keaslian dan masa berlaku kuasa dapat diperiksa melalui kode QR pada surat ini."}', null, true),
('STG', 'Surat tagihan / teguran penyewa', 'booking', 'kepala_staf', 9,
 '[{"k":"jenis","label":"Jenis","type":"select","req":true,"opts":[["tagihan","Tagihan (belum lunas / denda)"],["teguran","Teguran (unit belum dikembalikan)"]]},
   {"k":"batas","label":"Batas waktu penyelesaian","type":"date","req":true},
   {"k":"catatan","label":"Rincian (opsional)","type":"textarea","ph":"Denda keterlambatan 2 hari, biaya kerusakan spion"}]',
 '{"title":"SURAT {{jenis_judul}}","opening":"Kepada Yth. {{penyewa}},\nBerdasarkan catatan kami atas pemesanan berikut:","after":"terdapat kewajiban yang belum diselesaikan sebesar {{sisa}}{{?catatan}}, dengan rincian: {{catatan}}{{/catatan}}.","closing":"Mohon kewajiban tersebut diselesaikan paling lambat {{batas}} melalui cabang Rentalaja atau kanal pembayaran resmi. Apabila sampai batas waktu tersebut belum diselesaikan, kami akan menempuh langkah lanjutan sesuai syarat dan ketentuan sewa Rentalaja. Abaikan surat ini apabila kewajiban telah diselesaikan."}', null, true)
on conflict (code) do update set name = excluded.name, subject = excluded.subject, signer = excluded.signer, sort = excluded.sort, fields = excluded.fields, tpl = excluded.tpl, valid_months = excluded.valid_months, need_complete = excluded.need_complete;

-- potret booking untuk surat tagihan/teguran
create or replace function public.pk_letter_booking_row(p_code text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', b.code, 'penyewa', coalesce(nullif(b.guest_name, ''), c.name), 'start', b.start_at, 'end', b.end_at,
    'items', (select string_agg(p.name || coalesce(' (' || u.plate_or_serial || ')', ''), ', ') from booking_items i join products p on p.id = i.product_id left join units u on u.id = i.unit_id where i.booking_id = b.id and coalesce(i.is_addon, false) = false),
    'branch', br.name, 'total', b.total, 'paid', b.paid_amount, 'late_fee', b.late_fee, 'damage_fee', b.damage_fee,
    'sisa', greatest(coalesce(b.total, 0) + coalesce(b.late_fee, 0) + coalesce(b.damage_fee, 0) - coalesce(b.paid_amount, 0), 0), 'status', b.status)
  from bookings b left join customers c on c.id = b.customer_id left join branches br on br.id = b.branch_id
  where upper(b.code) = upper(btrim(p_code))
$$;
revoke execute on function public.pk_letter_booking_row(text) from public, anon, authenticated;

create or replace function public.pk_letter_booking(p_code text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb := public.pk_letter_role();
begin
  if r is null or not ((r->>'admin')::boolean or (r->>'asset')::boolean or r->>'role' = 'keuangan' or exists (select 1 from pk_people q left join pk_units u on u.code = q.unit_code where q.id = (r->>'me')::uuid and (q.unit_code = 'RA' or u.parent = 'RA'))) then
    raise exception 'Hanya untuk tim Rentalaja, Keuangan, CEO, dan Kepala Staf'; end if;
  return public.pk_letter_booking_row(p_code);
end $$;
revoke execute on function public.pk_letter_booking(text) from public, anon;
grant execute on function public.pk_letter_booking(text) to authenticated;

create or replace function public.pk_letter_create(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb := public.pk_letter_role(); me uuid; t pk_letter_types; ppl uuid[]; ast uuid[]; sg pk_people; f jsonb := coalesce(p->'fields', '{}');
  d jsonb; lid uuid; v_biz text := upper(coalesce(nullif(p->>'biz', ''), 'HQ')); fd jsonb; ttl text; sub jsonb; v_known uuid; v_num text; lvl int; sp jsonb; app pk_rec_applications; cand pk_rec_candidates; j pk_rec_jobs; bk jsonb; v_valid date;
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
    if not (r->>'asset')::boolean then raise exception '% hanya untuk tim aset, CEO, dan Kepala Staf', t.name; end if;
    if cardinality(ast) = 0 then raise exception 'Pilih unit'; end if;
    if t.need_complete and exists (select 1 from jsonb_array_elements(public.pk_letter_asset_rows(ast)) x where jsonb_array_length(x->'missing') > 0) then
      raise exception 'Ada unit yang datanya belum lengkap. Lengkapi dulu di data aset (lihat tab Unit belum siap surat).'; end if;
    v_biz := 'RA';
  elsif t.subject = 'booking' then
    if not ((r->>'admin')::boolean or (r->>'asset')::boolean or r->>'role' = 'keuangan' or exists (select 1 from pk_people q left join pk_units u on u.code = q.unit_code where q.id = me and (q.unit_code = 'RA' or u.parent = 'RA'))) then
      raise exception 'Surat tagihan/teguran hanya untuk tim Rentalaja, Keuangan, CEO, dan Kepala Staf'; end if;
    bk := public.pk_letter_booking_row(p->>'booking');
    if bk is null or bk->>'code' is null then raise exception 'Kode booking tidak ditemukan'; end if;
    v_biz := 'RA';
  end if;
  -- penanda tangan
  select * into sg from pk_people where id = (p->>'signer_id')::uuid and is_active;
  if sg.id is null then raise exception 'Pilih penanda tangan'; end if;
  if t.signer in ('ceo','kepala_staf') and sg.role not in ('ceo','kepala_staf') then raise exception 'Surat ini ditandatangani CEO atau Kepala Staf'; end if;
  if t.code = 'PKWT' then v_known := ppl[1]; end if;
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
    when 'booking' then jsonb_build_object('booking', bk, 'penyewa', (bk->>'penyewa'), 'sisa', 'Rp' || to_char((bk->>'sisa')::numeric, 'FM999G999G999'))
    else jsonb_build_object('people', (select jsonb_agg(jsonb_build_object('Nama', q.name, 'Jabatan', coalesce(q.title, initcap(q.role)), 'Unit', coalesce(u.name, '—')) order by array_position(ppl, q.id)) from pk_people q left join pk_units u on u.code = q.unit_code where q.id = any(ppl)),
      'nama', (select name from pk_people where id = ppl[1]), 'jabatan', (select coalesce(title, initcap(role)) from pk_people where id = ppl[1]),
      'unit', (select u.name from pk_people q left join pk_units u on u.code = q.unit_code where q.id = ppl[1]),
      'tgl_masuk', (select case when joined_on is null then null else pk_tgl(joined_on) end from pk_people where id = ppl[1])) end;
  if t.code = 'SKK' and sub->>'tgl_masuk' is null then raise exception 'Tanggal masuk karyawan belum diisi di Tim & Peran'; end if;
  -- tanggal di isian ditulis lengkap
  for fd in select * from jsonb_array_elements(t.fields) where value->>'type' = 'date' loop
    if nullif(f->>(fd->>'k'), '') is not null then f := f || jsonb_build_object(fd->>'k', pk_tgl((f->>(fd->>'k'))::date)); end if;
  end loop;
  d := sub || f || jsonb_build_object('perusahaan', (select name from pk_fin_companies where code = 'PKI'), 'penanda_tangan', sg.name, 'jabatan_ttd', coalesce(sg.title, initcap(sg.role)))
    || case when t.code = 'PKWT' then jsonb_build_object('known_label', 'Pihak Kedua,') else '{}' end
    || case when t.code = 'STG' then jsonb_build_object('jenis_judul', case when f->>'jenis' = 'teguran' then 'TEGURAN' else 'TAGIHAN' end) else '{}' end;
  v_valid := case when nullif(p->'fields'->>'sampai', '') is not null then (p->'fields'->>'sampai')::date when t.code = 'PKWT' then nullif(p->'fields'->>'selesai', '')::date end;
  v_num := case when t.code = 'SP' then 'SP' || lvl else t.code end;
  ttl := t.name || coalesce(case when t.code = 'SP' then ' ' || lvl end, '') || ' · ' || coalesce(case t.subject when 'assets' then (select string_agg(coalesce(x->>'plate', x->>'code'), ', ') from jsonb_array_elements(sub->'assets') x)
      when 'candidate' then cand.name when 'booking' then (bk->>'code') || ' · ' || (bk->>'penyewa') else (select string_agg(coalesce(nickname, name), ', ') from pk_people where id = any(ppl)) end, '');
  insert into pk_letters(type_code, num_code, biz, letter_date, people, candidate_app, assets, data, tpl, title, signer_id, signer_name, signer_title, known_by, created_by)
  values (t.code, v_num, v_biz, coalesce(nullif(p->>'letter_date', '')::date, (now() at time zone 'Asia/Jakarta')::date), ppl, app.id, ast, d, t.tpl, left(ttl, 200),
    sg.id, sg.name, coalesce(sg.title, initcap(sg.role)), v_known, me)
  returning id into lid;
  if v_valid is not null then update pk_letters set valid_until = v_valid where id = lid; end if;
  if sg.id = me then perform public.pk_letter_issue_now(lid);
  else perform public.pk_notify(sg.id, 'surat', 'Surat menunggu persetujuan Anda', ttl, '#/surat', false); end if;
  return jsonb_build_object('id', lid, 'status', (select status from pk_letters where id = lid));
end $$;

create or replace function public.pk_letter_issue_now(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare l pk_letters; v_y int; v_m int; s int; v_code text; mon int; ceo uuid; num text;
begin
  select * into l from pk_letters where id = p_id for update;
  if l.status <> 'menunggu' then return; end if;
  v_y := extract(year from l.letter_date); v_m := extract(month from l.letter_date);
  insert into pk_letter_seq(num_code, biz, y, m, last) values (l.num_code, l.biz, v_y, v_m, 1)
  on conflict (num_code, biz, y, m) do update set last = pk_letter_seq.last + 1 returning last into s;
  v_code := case l.biz when 'WG' then 'TA' when 'HQ' then 'PKI' else l.biz end;
  select valid_months into mon from pk_letter_types where code = l.type_code;
  num := lpad(s::text, 3, '0') || '/' || l.num_code || '/' || v_code || '/' || pk_roman(v_m) || '/' || v_y;
  update pk_letters set status = 'terbit', seq = s, y = v_y, m = v_m, issued_at = now(), number = num,
    verify_key = encode(extensions.gen_random_bytes(9), 'hex'),
    valid_until = coalesce(case when mon is not null then (l.letter_date + make_interval(months => mon))::date end, l.valid_until)
  where id = l.id;
  if l.created_by is not null and l.created_by <> l.signer_id then perform public.pk_notify(l.created_by, 'surat', 'Surat sudah terbit', l.title, '#/surat', false); end if;
  for ceo in select id from pk_people where role = 'ceo' and is_active and id <> l.signer_id loop
    perform public.pk_notify(ceo, 'surat', 'Surat terbit: ' || num, l.title || ' · ttd ' || coalesce(l.signer_name, ''), '#/surat', false);
  end loop;
end $$;
revoke execute on function public.pk_letter_issue_now(uuid) from public, anon, authenticated;

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
        or (l.type_code not in ('SP','SKA','PKWT','BAST','STG') and exists (select 1 from pk_people q where q.id = any(l.people) and q.boss_id = me))
        or (l.type_code = 'SP' and (l.known_by = me))
        or (l.type_code in ('SKA','BAST') and (r->>'asset')::boolean)
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
    'about', case when l.type_code = 'STG' then 'Booking ' || (l.data->'booking'->>'code') when l.type_code in ('SKA','BAST') then (select string_agg(coalesce(a->>'product', '') || ' ' || coalesce(a->>'plate', a->>'code'), ', ') from jsonb_array_elements(l.data->'assets') a)
                  else (select string_agg(regexp_replace(a->>'Nama', '^(\S+)(\s+\S).*$', '\1\2.'), ', ') from jsonb_array_elements(l.data->'people') a) end,
    'status', case when l.status = 'batal' then 'batal' when l.valid_until is not null and l.valid_until < (now() at time zone 'Asia/Jakarta')::date then 'kedaluwarsa' else 'berlaku' end,
    'valid_until', l.valid_until, 'cancelled_at', l.cancelled_at) end
  from (select 1) x left join pk_letters l on l.verify_key = p_key and l.status in ('terbit','batal') left join pk_letter_types t on t.code = l.type_code
$$;
