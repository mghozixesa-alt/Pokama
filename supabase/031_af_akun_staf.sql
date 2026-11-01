-- 031: portal mitra mengenali akun staf.
-- Bila akun Google yang masuk ke /mitra adalah staf aktif (pk_people) dan bukan mitra,
-- af_link_me mengembalikan staff=true sehingga portal menampilkan "pilih akun lain",
-- bukan formulir daftar (staf memang tidak boleh jadi mitra).

create or replace function public.af_link_me() returns jsonb
language plpgsql security definer set search_path = public as $$
declare em text := lower(coalesce(auth.jwt()->>'email', '')); r public.af_partners; ver boolean;
begin
  if auth.uid() is null then raise exception 'Belum masuk'; end if;
  if not public.af_google() then return jsonb_build_object('found', false, 'need_google', true); end if;
  select * into r from public.af_partners where user_id = auth.uid() and status <> 'ditolak' order by created_at desc limit 1;
  if r.id is null then
    select * into r from public.af_partners where lower(email) = em and user_id is null and status <> 'ditolak' order by created_at desc limit 1;
    if r.id is not null then update public.af_partners set user_id = auth.uid() where id = r.id; end if;
  end if;
  if r.id is null then
    select * into r from public.af_partners where user_id = auth.uid() order by created_at desc limit 1;
    if r.id is null then
      return jsonb_build_object('found', false,
        'staff', exists (select 1 from public.pk_people x where x.is_active and lower(x.email) = em),
        'email', em);
    end if;
  end if;
  ver := exists (select 1 from public.af_mitra_sessions s where s.session_id = public.af_sid() and s.partner_id = r.id and s.verified_at > now() - interval '30 days');
  return jsonb_build_object('found', true, 'status', r.status, 'reason', r.reason, 'verified', ver, 'wa_masked', '+' || left(r.wa, 4) || '••••' || right(r.wa, 3));
end $$;

revoke all on function public.af_link_me() from public, anon;
grant execute on function public.af_link_me() to authenticated;
