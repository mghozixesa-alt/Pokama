-- 005a: identitas & orang (hasil review keamanan)
-- pk_me: cocokkan akun lewat user_id. Cocok lewat email hanya untuk login Google (email terverifikasi Google)
-- dan hanya bila orang itu belum punya akun tertaut.
create or replace function public.pk_me() returns uuid
language sql stable security definer set search_path = public as $$
  select p.id from public.pk_people p
  where p.is_active and (
    p.user_id = auth.uid()
    or (p.user_id is null and p.email is not null
        and coalesce(auth.jwt()->'app_metadata'->>'provider', 'email') <> 'email'
        and lower(p.email) = lower(coalesce(auth.jwt()->>'email', '')))
  )
  order by (p.user_id = auth.uid()) desc nulls last
  limit 1
$$;

-- akun email Ghozy dipakai sebagai akun utama
update public.pk_people set user_id = '4deacfa9-9412-4757-b26d-e4d2707e155d'
 where code = 'GZ' and email = 'mghozixesa@gmail.com';

-- penjaga tabel orang
create or replace function public.pk_people_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); r text := coalesce(public.pk_role(), '');
begin
  if me is null or coalesce(current_setting('pk.rpc', true), '') = '1' then return new; end if;   -- service role / SQL admin / fungsi sistem
  if r <> 'ceo' then
    if new.role in ('ceo','kepala_staf','keuangan') and (tg_op = 'INSERT' or new.role is distinct from old.role) then
      raise exception 'Hanya CEO yang bisa memberi peran CEO, Kepala Staf, atau Keuangan';
    end if;
    if tg_op = 'UPDATE' and old.role in ('ceo','kepala_staf','keuangan') and old.id <> me then
      if new.role is distinct from old.role or new.email is distinct from old.email or new.is_active is distinct from old.is_active
         or new.boss_id is distinct from old.boss_id then
        raise exception 'Data CEO, Kepala Staf, dan Keuangan hanya bisa diubah CEO';
      end if;
    end if;
    if tg_op = 'UPDATE' and old.id = me and (new.role is distinct from old.role or new.boss_id is distinct from old.boss_id
         or new.valuer1_id is distinct from old.valuer1_id or new.valuer2_id is distinct from old.valuer2_id or new.is_active is distinct from old.is_active) then
      raise exception 'Peran, atasan, dan valuer Anda sendiri hanya bisa diubah CEO';
    end if;
  end if;
  if tg_op = 'INSERT' then new.user_id := null;
  elsif new.user_id is distinct from old.user_id then new.user_id := old.user_id; end if;   -- user_id hanya diatur sistem akun
  if tg_op = 'UPDATE' and new.email is distinct from old.email and old.user_id is not null then
    raise exception 'Orang ini sudah punya akun. Email login tidak bisa diganti dari sini';
  end if;
  return new;
end $$;
create or replace trigger pk_people_guard before insert or update on public.pk_people
  for each row execute function public.pk_people_guard();

create or replace function public.pk_session() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public.pk_me(); r record;
begin
  if v is null then return null; end if;
  perform set_config('pk.rpc', '1', true);
  update public.pk_people set user_id = auth.uid()
   where id = v and user_id is null
     and not exists (select 1 from public.pk_people where user_id = auth.uid());
  perform set_config('pk.rpc', '', true);
  select p.id, p.code, p.name, p.nickname, p.role, p.title, p.unit_code, p.photo, p.email, p.phone, p.boss_id
    into r from public.pk_people p where p.id = v;
  return to_jsonb(r);
end $$;
