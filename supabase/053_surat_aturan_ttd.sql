-- 053: aturan penanda tangan surat (keputusan CEO 11/11/2026) + CEO diberi tahu setiap surat terbit
-- SP, penawaran kerja, surat aset: wajib CEO. Keterangan kerja: Kepala Staf atau CEO.
-- Surat tugas: atasan langsung SEMUA orang yang ditugaskan, atau CEO / Kepala Staf.
update public.pk_letter_types set signer = 'ceo' where code in ('SP','SPK','SKA');

create or replace function public.pk_letters_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare t pk_letter_types; sg pk_people;
begin
  select * into t from pk_letter_types where code = new.type_code;
  select * into sg from pk_people where id = new.signer_id;
  if t.signer = 'ceo' and sg.role <> 'ceo' then raise exception '% wajib disetujui CEO', t.name; end if;
  if t.signer = 'kepala_staf' and sg.role not in ('ceo','kepala_staf') then raise exception '% ditandatangani Kepala Staf atau CEO', t.name; end if;
  if t.signer = 'boss' and sg.role not in ('ceo','kepala_staf')
     and exists (select 1 from pk_people q where q.id = any(new.people) and q.boss_id is distinct from sg.id) then
    raise exception 'Penanda tangan surat tugas harus atasan langsung semua orang yang ditugaskan, atau CEO / Kepala Staf';
  end if;
  return new;
end $$;
drop trigger if exists pk_letters_guard on public.pk_letters;
create trigger pk_letters_guard before insert or update of signer_id on public.pk_letters for each row execute function public.pk_letters_guard();

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
    valid_until = case when mon is not null then (l.letter_date + make_interval(months => mon))::date end
  where id = l.id;
  if l.created_by is not null and l.created_by <> l.signer_id then perform public.pk_notify(l.created_by, 'surat', 'Surat sudah terbit', l.title, '#/surat', false); end if;
  -- CEO tahu setiap surat yang keluar atas nama perusahaan
  for ceo in select id from pk_people where role = 'ceo' and is_active and id <> l.signer_id loop
    perform public.pk_notify(ceo, 'surat', 'Surat terbit: ' || num, l.title || ' · ttd ' || coalesce(l.signer_name, ''), '#/surat', false);
  end loop;
end $$;
revoke execute on function public.pk_letter_issue_now(uuid) from public, anon, authenticated;
