-- 029: staf mengisi nomor WA sendiri (untuk peringatan keamanan & notifikasi Sistem Kerja lewat WA Rentalaja)
create or replace function public.pk_set_phone(p_phone text) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); ph text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if me is null then raise exception 'Belum masuk'; end if;
  if ph like '0%' then ph := '62' || substr(ph, 2); elsif ph like '8%' then ph := '62' || ph; end if;
  if ph !~ '^628[0-9]{7,12}$' then raise exception 'Nomor WA belum benar. Contoh: 0812 3456 7890'; end if;
  update public.pk_people set phone = ph where id = me;
  return ph;
end $$;
revoke execute on function public.pk_set_phone(text) from public, anon;
grant execute on function public.pk_set_phone(text) to authenticated;
