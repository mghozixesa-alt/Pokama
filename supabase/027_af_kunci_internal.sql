-- 027: unit yang berjalan di project Supabase yang sama (Rentalaja App) membaca kunci API-nya langsung dari database
-- lewat service_role, jadi rahasia tidak pernah disalin manual / lewat chat. Ganti kunci di panel → otomatis terpakai.
create or replace function public.af_unit_own_key(p_unit text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('key_id', k.key_id, 'secret', public.af_dec(k.secret_enc))
  from public.af_unit_keys k where k.unit_code = p_unit and k.revoked_at is null and k.secret_enc is not null
$$;
revoke execute on function public.af_unit_own_key(text) from public, anon, authenticated;
grant execute on function public.af_unit_own_key(text) to service_role;
