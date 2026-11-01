-- 025: Keamanan Program Mitra Affiliate + verifikasi 2 langkah staf (permintaan J & K, 1 Nov 2026)
-- Isi: (A) staf wajib 2 langkah (pk_me hanya aal2) + peringatan perangkat baru ke Owner lewat WA Rentalaja
--      (B) peran: Owner semua, BizDev mitra/tarif/tantangan, Keuangan bekukan/pencairan, Kepala Staf hanya lihat; pengaju ≠ penyetuju
--      (C) tidak ada tabel publik; hanya daftar Mitra Unggulan (nama + kota) dan tarif untuk halaman depan lewat fungsi
--      (D) login mitra: Google + kode WA per perangkat (30 hari)
--      (E) NIK, NPWP, rekening dienkripsi (kunci di Supabase Vault), tampil tersamar, buka penuh hanya Keuangan + tercatat
--      (F) ganti rekening: konfirmasi kode WA + ditahan 3 hari
--      (G) log audit sebelum/sesudah, tidak bisa diubah/dihapus
--      (H) API unit: id kunci + rahasia, tanda tangan HMAC + cap waktu, tolak ulang/dobel, batas permintaan, cek kode dibatasi

-- ================= (A) staf: verifikasi 2 langkah =================
do $a$ declare d text;
begin
  if to_regprocedure('public.pk_me_raw()') is null then
    d := replace(pg_get_functiondef('public.pk_me()'::regprocedure), 'FUNCTION public.pk_me()', 'FUNCTION public.pk_me_raw()');
    execute d;
  end if;
end $a$;
create or replace function public.pk_mfa_ok() returns boolean language sql stable as $$
  select coalesce(auth.jwt()->>'aal', '') = 'aal2'
$$;
create or replace function public.pk_me() returns uuid language sql stable security definer set search_path = public as $$
  select case when public.pk_mfa_ok() then public.pk_me_raw() end
$$;
revoke execute on function public.pk_me_raw() from public, anon;

-- antrean WA lewat pengirim WA Rentalaja App (public.notifications → wa-send / Fonnte)
create or replace function public.pk_wa(p_phone text, p_body text, p_otp boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare ph text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if ph like '0%' then ph := '62' || substr(ph, 2); end if;
  if length(ph) < 10 then return; end if;
  insert into public.notifications(channel, to_phone, template_key, body, ref_type)
  values ('wa', ph, case when p_otp then 'otp_login' end, p_body, 'pokama');
end $$;
revoke execute on function public.pk_wa(text, text, boolean) from public, anon, authenticated;

create table if not exists public.pk_login_devices (
  person_id uuid not null references public.pk_people(id) on delete cascade,
  device text not null,
  agent text,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (person_id, device)
);
alter table public.pk_login_devices enable row level security;
revoke all on public.pk_login_devices from anon, authenticated;

create or replace function public.pk_login_seen(p_device text, p_agent text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); nm text; first boolean; o record;
begin
  if me is null or coalesce(btrim(p_device), '') = '' then return; end if;
  first := not exists (select 1 from public.pk_login_devices where person_id = me);
  insert into public.pk_login_devices(person_id, device, agent) values (me, left(p_device, 80), left(p_agent, 200))
  on conflict (person_id, device) do update set last_at = now(), agent = excluded.agent;
  if found and not first and (select first_at from public.pk_login_devices where person_id = me and device = left(p_device, 80)) > now() - interval '10 seconds' then
    select coalesce(nickname, name) into nm from public.pk_people where id = me;
    for o in select phone from public.pk_people where role = 'ceo' and is_active and phone is not null loop
      perform public.pk_wa(o.phone, 'Peringatan Pokama: ' || nm || ' masuk dari perangkat baru (' || left(coalesce(p_agent, '-'), 80) || ') pada '
        || to_char(now() at time zone 'Asia/Jakarta', 'DD/MM HH24.MI') || ' WIB. Bila bukan dia, reset verifikasi 2 langkah dan buat password baru di menu Tim & Peran.');
    end loop;
  end if;
end $$;

create or replace function public.pk_mfa_reset(p_person uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare u uuid;
begin
  if not coalesce(public.pk_role() in ('ceo','kepala_staf'), false) then raise exception 'Hanya CEO atau Kepala Staf'; end if;
  select user_id into u from public.pk_people where id = p_person;
  if u is null then raise exception 'Akun belum tersambung'; end if;
  delete from auth.mfa_factors where user_id = u;
  delete from public.pk_login_devices where person_id = p_person;
  insert into public.af_audit(by_person, action, target, reason) values (public.pk_me(), 'reset_2fa', p_person::text, 'Reset verifikasi 2 langkah');
end $$;
revoke execute on function public.pk_mfa_reset(uuid), public.pk_login_seen(text, text) from public, anon;
grant execute on function public.pk_mfa_reset(uuid), public.pk_login_seen(text, text) to authenticated;

-- ================= (B) peran affiliate =================
create or replace function public.af_is_owner() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.pk_role() = 'ceo', false)
$$;
create or replace function public.af_is_biz() returns boolean language sql stable security definer set search_path = public as $$
  select public.af_is_owner()
      or (public.pk_me() is not null and coalesce((select value ? public.pk_me()::text from public.af_settings where key = 'bizdev_ids'), false))
$$;
create or replace function public.af_is_fin() returns boolean language sql stable security definer set search_path = public as $$
  select public.af_is_owner() or coalesce(public.pk_role() = 'keuangan', false)
$$;
create or replace function public.af_can_view() returns boolean language sql stable security definer set search_path = public as $$
  select public.af_is_biz() or public.af_is_fin() or coalesce(public.pk_role() = 'kepala_staf', false)
$$;
create or replace function public.af_need_view() returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.af_can_view() then raise exception 'Tidak punya akses'; end if;
end $$;

-- ================= (E) enkripsi data pribadi =================
do $v$ begin
  if not exists (select 1 from vault.secrets where name = 'af_pii_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'af_pii_key', 'Kunci enkripsi NIK/NPWP/rekening mitra (Pokama)');
  end if;
end $v$;
create or replace function public.af_pii_key() returns text language sql stable security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'af_pii_key' limit 1
$$;
create or replace function public.af_enc(p text) returns bytea language sql stable security definer set search_path = public, extensions as $$
  select case when coalesce(p, '') = '' then null else extensions.pgp_sym_encrypt(p, public.af_pii_key()) end
$$;
create or replace function public.af_dec(p bytea) returns text language sql stable security definer set search_path = public, extensions as $$
  select case when p is null then null else extensions.pgp_sym_decrypt(p, public.af_pii_key()) end
$$;
revoke execute on function public.af_pii_key(), public.af_enc(text), public.af_dec(bytea) from public, anon, authenticated;

alter table public.af_partners
  add column if not exists nik_enc bytea, add column if not exists npwp_enc bytea, add column if not exists bank_acct_enc bytea,
  add column if not exists nik_last4 text, add column if not exists npwp_last4 text, add column if not exists bank_last4 text,
  add column if not exists bank_new_name text, add column if not exists bank_new_holder text, add column if not exists bank_new_acct_enc bytea,
  add column if not exists bank_new_at timestamptz, add column if not exists bank_hold_until timestamptz,
  add column if not exists wa_verified_at timestamptz;
do $m$ begin
  if exists (select 1 from information_schema.columns where table_name = 'af_partners' and column_name = 'nik') then
    execute $x$update public.af_partners set
      nik_enc = coalesce(nik_enc, public.af_enc(nik)), nik_last4 = coalesce(nik_last4, right(nik, 4)),
      npwp_enc = coalesce(npwp_enc, public.af_enc(npwp)), npwp_last4 = coalesce(npwp_last4, right(regexp_replace(npwp, '\D', '', 'g'), 4)),
      bank_acct_enc = coalesce(bank_acct_enc, public.af_enc(bank_acct)), bank_last4 = coalesce(bank_last4, right(bank_acct, 4))$x$;
  end if;
end $m$;
alter table public.af_payouts add column if not exists created_by uuid;
alter table public.af_audit add column if not exists actor uuid;

-- tambal fungsi lama yang membaca kolom polos (sebelum kolom polos dihapus)
do $p$
declare d text; t text;
  r record;
begin
  for r in select * from (values
    ('public.af_me()'::text, $s1$'bank_name', p.bank_name, 'bank_acct', p.bank_acct, 'bank_holder', p.bank_holder,
      'nik_set', p.nik is not null, 'nik_tail', right(p.nik, 4), 'npwp', p.npwp,$s1$,
     $r1$'bank_name', p.bank_name, 'bank_last4', p.bank_last4, 'bank_holder', p.bank_holder, 'bank_hold_until', p.bank_hold_until,
      'bank_pending', p.bank_new_at is not null, 'bank_new', case when p.bank_new_at is not null then p.bank_new_name || ' · ' || p.bank_new_holder end,
      'nik_set', p.nik_enc is not null, 'nik_tail', p.nik_last4, 'npwp_tail', p.npwp_last4, 'wa_masked', '+' || left(p.wa, 4) || '••••' || right(p.wa, 3),$r1$),
    ('public.af_admin_partners(text,boolean)', $s2$case when x.bank_acct is not null then x.bank_name || ' •••• ' || right(x.bank_acct, 4) || ' · ' || coalesce(x.bank_holder, '') end$s2$,
     $r2$case when x.bank_last4 is not null then x.bank_name || ' •••• ' || x.bank_last4 || ' · ' || coalesce(x.bank_holder, '') end$r2$),
    ('public.af_admin_partners(text,boolean)', $s3$'nik_set', x.nik is not null,$s3$,
     $r3$'nik_set', x.nik_enc is not null, 'npwp_set', x.npwp_enc is not null, 'wa_verified', x.wa_verified_at is not null, 'bank_hold_until', x.bank_hold_until, 'bank_pending', x.bank_new_at is not null,$r3$),
    ('public.af_payouts_list(date,boolean)', $s4$'npwp', x.npwp is not null, 'nik', x.nik is not null,$s4$,
     $r4$'npwp', x.npwp_enc is not null, 'nik', x.nik_enc is not null, 'hold', (x.bank_hold_until > now() or x.bank_new_at is not null), 'hold_until', x.bank_hold_until, 'created_by', o.created_by, 'mine', o.created_by = public.pk_me(),$r4$),
    ('public.af_payouts_list(date,boolean)', $s5$select case when not public.af_is_fin() and not public.af_is_biz() then null else$s5$,
     $r5$select case when not public.af_can_view() then null else$r5$),
    ('public.af_close_month(date,boolean,boolean)', $s6$select x.id, x.bank_name, x.bank_acct, x.bank_holder from public.af_partners x$s6$,
     $r6$select x.id, x.bank_name, x.bank_last4 as bank_acct, x.bank_holder from public.af_partners x$r6$),
    ('public.af_close_month(date,boolean,boolean)', $s7$rec.bank_name || ' ' || rec.bank_acct || ' a.n. '$s7$, $r7$rec.bank_name || ' •••• ' || rec.bank_acct || ' a.n. '$r7$),
    ('public.af_close_month(date,boolean,boolean)', $s8$insert into public.af_payouts(period, partner_id, commission, rewards, gross, tax_pct, tax, net, bank, items, demo)$s8$,
     $r8$insert into public.af_payouts(period, partner_id, commission, rewards, gross, tax_pct, tax, net, bank, items, demo, created_by)$r8$),
    ('public.af_close_month(date,boolean,boolean)', $s9$and b.completed_at < nm), p_demo)$s9$, $r9$and b.completed_at < nm), p_demo, public.pk_me())$r9$),
    ('public.af_admin_overview(date,text,text,text,boolean)', $s10$perform public.af_need(true, true);$s10$, $r10$perform public.af_need_view();$r10$),
    ('public.af_report(date,date,text,boolean)', $s11$perform public.af_need(true, true);$s11$, $r11$perform public.af_need_view();$r11$),
    ('public.af_admin_misc(boolean)', $s13$'key_hint', k.hint, 'key_at', k.created_at,$s13$,
     $r13$'key_hint', k.hint, 'key_at', k.created_at, 'key_id', k.key_id, 'revoked', k.revoked_at is not null,$r13$),
    ('public.af_admin_misc(boolean)', $s14$'action', a.action, 'target', a.target, 'reason', a.reason) order by a.at desc)$s14$,
     $r14$'action', a.action, 'target', a.target, 'reason', a.reason, 'data', a.data) order by a.at desc)$r14$),
    ('public.af_notif_sent(bigint[])', $s15$and public.af_can_view()$s15$, $r15$and (public.af_is_biz() or public.af_is_fin())$r15$),
    ('public.af_api_featured(text)', $s12$'peringkat', r.rank, 'nama', coalesce(nullif(p.org, ''), p.name), 'jenis', r.kind, 'kota', r.city, 'kode', p.code, 'alamat', p.address$s12$,
     $r12$'nama', coalesce(nullif(p.org, ''), p.name), 'kota', r.city$r12$)
  ) v(fn, a, b) loop
    d := pg_get_functiondef(r.fn::regprocedure);
    if position(r.a in d) = 0 then
      if position(r.b in d) > 0 then continue; end if;   -- sudah ditambal
      raise exception 'Tambalan % tidak cocok: %', r.fn, left(r.a, 60);
    end if;
    execute replace(d, r.a, r.b);
  end loop;
end $p$;
alter table public.af_partners drop column if exists nik, drop column if exists npwp, drop column if exists bank_acct;

create or replace function public.af_reveal(p_partner uuid, p_field text) returns text
language plpgsql security definer set search_path = public as $$
declare x public.af_partners; v text;
begin
  if not public.af_is_fin() then raise exception 'Hanya Keuangan'; end if;
  select * into x from public.af_partners where id = p_partner;
  v := case p_field when 'nik' then public.af_dec(x.nik_enc) when 'npwp' then public.af_dec(x.npwp_enc) when 'rekening' then public.af_dec(x.bank_acct_enc)
         else null end;
  if p_field not in ('nik','npwp','rekening') then raise exception 'Data tidak dikenal'; end if;
  insert into public.af_audit(by_person, actor, action, target, reason, data) values (public.pk_me(), auth.uid(), 'buka_data', p_partner::text, p_field, jsonb_build_object('field', p_field));
  return v;
end $$;

create or replace function public.af_payout_transfer_list(p_period date, p_demo boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  if not public.af_is_fin() then raise exception 'Hanya Keuangan'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('nama', coalesce(nullif(x.org, ''), x.name), 'bank', x.bank_name, 'rekening', public.af_dec(x.bank_acct_enc),
      'atas_nama', x.bank_holder, 'jumlah', o.net, 'status', o.status, 'ditahan', (x.bank_hold_until > now() or x.bank_new_at is not null)) order by x.name), '[]'::jsonb)
    into res from public.af_payouts o join public.af_partners x on x.id = o.partner_id
   where o.period = p_period and o.demo = p_demo and o.status in ('diajukan','disetujui');
  insert into public.af_audit(by_person, actor, action, target, reason, data) values (public.pk_me(), auth.uid(), 'buka_rekening', p_period::text, 'Unduh daftar transfer', jsonb_build_object('n', jsonb_array_length(res)));
  return res;
end $$;

-- ================= (C) tidak ada tabel publik =================
drop policy if exists af_units_r on public.af_units;
drop policy if exists af_rates_r on public.af_rates;
revoke all on public.af_units, public.af_rates from anon, authenticated;
create or replace function public.af_public_rates() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('label', r.label, 'pct', r.pct) order by r.sort), '[]'::jsonb)
  from public.af_rates r join public.af_units u on u.code = r.unit_code where u.code = 'RA' and u.is_active
$$;

-- ================= (D) login mitra: Google + kode WA =================
create table if not exists public.af_otp (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  partner_id uuid references public.af_partners(id) on delete cascade,
  purpose text not null check (purpose in ('login','bank')),
  code_hash text not null,
  tries int not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists af_otp_user on public.af_otp (user_id, purpose, created_at desc);
create table if not exists public.af_mitra_sessions (
  session_id uuid primary key,
  user_id uuid not null,
  partner_id uuid not null references public.af_partners(id) on delete cascade,
  verified_at timestamptz not null default now()
);
alter table public.af_otp enable row level security;
alter table public.af_mitra_sessions enable row level security;
revoke all on public.af_otp, public.af_mitra_sessions from anon, authenticated;

create or replace function public.af_google() returns boolean language sql stable as $$
  select coalesce(auth.jwt()->'amr' @> '[{"method":"oauth"}]'::jsonb, false)
$$;
create or replace function public.af_sid() returns uuid language sql stable as $$
  select nullif(auth.jwt()->>'session_id', '')::uuid
$$;
-- mitra dikenali hanya bila masuk dengan Google DAN sesi ini sudah lolos kode WA (berlaku 30 hari)
create or replace function public.af_my_partner() returns uuid language sql stable security definer set search_path = public as $$
  select p.id from public.af_partners p join public.af_mitra_sessions s on s.partner_id = p.id
  where p.user_id = auth.uid() and auth.uid() is not null and public.af_google()
    and s.session_id = public.af_sid() and s.user_id = auth.uid() and s.verified_at > now() - interval '30 days'
  limit 1
$$;

create or replace function public.af_register(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare em text := lower(coalesce(auth.jwt()->>'email', '')); wa text := public.af_norm_wa(p->>'wa'); v_id uuid;
begin
  if auth.uid() is null or not public.af_google() then raise exception 'Daftar lewat tombol Masuk dengan Google'; end if;
  if coalesce(btrim(p->>'name'), '') = '' then raise exception 'Nama wajib diisi'; end if;
  if length(wa) < 10 or length(wa) > 15 then raise exception 'Nomor WhatsApp belum benar'; end if;
  if not coalesce((p->>'agree')::boolean, false) then raise exception 'Setujui syarat program dulu'; end if;
  if exists (select 1 from public.pk_people x where x.is_active and (lower(x.email) = em or public.af_norm_wa(x.phone) = wa)) then
    raise exception 'Staf grup Pokama tidak bisa menjadi mitra';
  end if;
  if exists (select 1 from public.af_partners x where (x.user_id = auth.uid() or lower(x.email) = em) and x.status <> 'ditolak') then
    raise exception 'Akun Google ini sudah terdaftar sebagai mitra';
  end if;
  if (select count(*) from public.af_partners where created_at > now() - interval '1 hour') > 40 then raise exception 'Terlalu banyak pendaftaran. Coba lagi sebentar.'; end if;
  insert into public.af_partners(user_id, email, name, org, kind, city, wa, wa_hash, agreed_at)
  values (auth.uid(), em, btrim(p->>'name'), nullif(btrim(coalesce(p->>'org', '')), ''), p->>'kind', p->>'city', wa, public.af_hash(wa), now())
  returning af_partners.id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

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
    if r.id is null then return jsonb_build_object('found', false); end if;
  end if;
  ver := exists (select 1 from public.af_mitra_sessions s where s.session_id = public.af_sid() and s.partner_id = r.id and s.verified_at > now() - interval '30 days');
  return jsonb_build_object('found', true, 'status', r.status, 'reason', r.reason, 'verified', ver, 'wa_masked', '+' || left(r.wa, 4) || '••••' || right(r.wa, 3));
end $$;

create or replace function public.af_otp_send(p_purpose text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r public.af_partners; c text; n int; last timestamptz; oid uuid;
begin
  if auth.uid() is null or not public.af_google() then raise exception 'Masuk dengan Google dulu'; end if;
  if p_purpose not in ('login','bank') then raise exception 'Tujuan kode tidak dikenal'; end if;
  select * into r from public.af_partners where user_id = auth.uid() and status <> 'ditolak' order by created_at desc limit 1;
  if r.id is null then raise exception 'Akun mitra tidak ditemukan'; end if;
  if p_purpose = 'bank' and (r.bank_new_at is null or public.af_my_partner() is null) then raise exception 'Tidak ada perubahan rekening yang menunggu'; end if;
  select max(created_at), count(*) into last, n from public.af_otp where user_id = auth.uid() and created_at > now() - interval '1 hour';
  if last > now() - interval '60 seconds' then raise exception 'Tunggu 1 menit sebelum meminta kode lagi'; end if;
  if n >= 5 then raise exception 'Terlalu sering meminta kode. Coba lagi 1 jam lagi.'; end if;
  c := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
  oid := gen_random_uuid();
  insert into public.af_otp(id, user_id, partner_id, purpose, code_hash, expires_at)
  values (oid, auth.uid(), r.id, p_purpose, encode(extensions.digest(oid::text || c, 'sha256'), 'hex'), now() + interval '10 minutes');
  perform public.pk_wa(r.wa, case p_purpose when 'login' then 'Kode masuk Mitra Pokama: ' || c || '. Berlaku 10 menit. Jangan berikan kode ini kepada siapa pun.'
    else 'Kode konfirmasi GANTI REKENING Mitra Pokama: ' || c || ' (rekening baru ' || coalesce(r.bank_new_name, '') || ' a.n. ' || coalesce(r.bank_new_holder, '') || '). Bila Anda tidak mengubah rekening, abaikan dan hubungi tim kami.' end, true);
  return jsonb_build_object('ok', true, 'wa_masked', '+' || left(r.wa, 4) || '••••' || right(r.wa, 3));
end $$;

create or replace function public.af_otp_verify(p_purpose text, p_code text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare o public.af_otp; r public.af_partners;
begin
  if auth.uid() is null or not public.af_google() then raise exception 'Masuk dengan Google dulu'; end if;
  select * into o from public.af_otp where user_id = auth.uid() and purpose = p_purpose and used_at is null order by created_at desc limit 1 for update;
  if o.id is null or o.expires_at < now() then return jsonb_build_object('ok', false, 'error', 'Kode sudah kedaluwarsa. Minta kode baru.'); end if;
  if o.tries >= 5 then return jsonb_build_object('ok', false, 'error', 'Terlalu banyak salah. Minta kode baru.'); end if;
  if encode(extensions.digest(o.id::text || regexp_replace(coalesce(p_code, ''), '\D', '', 'g'), 'sha256'), 'hex') <> o.code_hash then
    update public.af_otp set tries = tries + 1 where id = o.id;   -- tersimpan (tidak di-raise)
    return jsonb_build_object('ok', false, 'error', 'Kode salah. Sisa ' || (4 - o.tries) || ' kesempatan.');
  end if;
  update public.af_otp set used_at = now() where id = o.id;
  select * into r from public.af_partners where id = o.partner_id;
  if p_purpose = 'login' then
    update public.af_partners set wa_verified_at = coalesce(wa_verified_at, now()) where id = r.id;
    if public.af_sid() is null then raise exception 'Sesi tidak dikenali, masuk ulang'; end if;
    insert into public.af_mitra_sessions(session_id, user_id, partner_id) values (public.af_sid(), auth.uid(), r.id)
    on conflict (session_id) do update set verified_at = now(), partner_id = excluded.partner_id, user_id = excluded.user_id;
    delete from public.af_mitra_sessions where user_id = auth.uid() and verified_at < now() - interval '30 days';
  else
    if r.bank_new_at is null then raise exception 'Tidak ada perubahan rekening'; end if;
    update public.af_partners set bank_name = bank_new_name, bank_holder = bank_new_holder, bank_acct_enc = bank_new_acct_enc,
      bank_last4 = right(public.af_dec(bank_new_acct_enc), 4), bank_hold_until = now() + interval '3 days',
      bank_new_name = null, bank_new_holder = null, bank_new_acct_enc = null, bank_new_at = null, updated_at = now()
    where id = r.id;
    perform public.pk_wa(r.wa, 'Rekening pencairan Mitra Pokama sudah diganti. Demi keamanan, rekening baru dipakai mulai ' || to_char((now() + interval '3 days') at time zone 'Asia/Jakarta', 'DD/MM HH24.MI') || ' WIB.');
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.af_me_update(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid uuid := public.af_my_partner(); x public.af_partners; nk text; acct text; npwp text; pending boolean := false;
begin
  if pid is null then raise exception 'Akun mitra tidak ditemukan'; end if;
  select * into x from public.af_partners where id = pid;
  nk := nullif(regexp_replace(coalesce(p->>'nik', ''), '\D', '', 'g'), '');
  if nk is not null and length(nk) <> 16 then raise exception 'NIK harus 16 digit'; end if;
  npwp := nullif(regexp_replace(coalesce(p->>'npwp', ''), '\D', '', 'g'), '');
  acct := nullif(regexp_replace(coalesce(p->>'bank_acct', ''), '\D', '', 'g'), '');
  if acct is not null then
    if length(acct) < 6 then raise exception 'Nomor rekening belum benar'; end if;
    if coalesce(btrim(p->>'bank_name'), '') = '' or coalesce(btrim(p->>'bank_holder'), '') = '' then raise exception 'Isi bank dan nama pemilik rekening'; end if;
    -- rekening baru menunggu konfirmasi kode WA, lalu ditahan 3 hari
    update public.af_partners set bank_new_name = btrim(p->>'bank_name'), bank_new_holder = btrim(p->>'bank_holder'), bank_new_acct_enc = public.af_enc(acct), bank_new_at = now() where id = pid;
    pending := true;
  end if;
  update public.af_partners set
    nik_enc = coalesce(public.af_enc(nk), nik_enc), nik_last4 = coalesce(right(nk, 4), nik_last4), nik_hash = coalesce(public.af_hash(nk), nik_hash),
    npwp_enc = coalesce(public.af_enc(npwp), npwp_enc), npwp_last4 = coalesce(right(npwp, 4), npwp_last4),
    address = coalesce(nullif(btrim(p->>'address'), ''), address),
    maps_url = coalesce(nullif(btrim(p->>'maps_url'), ''), maps_url),
    guest_discount = coalesce((p->>'guest_discount')::boolean, guest_discount),
    updated_at = now()
  where id = pid;
  return jsonb_build_object('ok', true, 'bank_pending', pending);
end $$;

-- ================= (B) pemisahan tugas pencairan + (F) rekening ditahan =================
create or replace function public.af_payout_approve(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public.af_need(false, true);
  if exists (select 1 from public.af_payouts where id = any(p_ids) and created_by is not null and created_by = public.pk_me()) then
    raise exception 'Rekap yang Anda buat sendiri harus disetujui orang lain (Keuangan / Owner lain)';
  end if;
  update public.af_payouts set status = 'disetujui', approved_by = public.pk_me(), approved_at = now() where id = any(p_ids) and status = 'diajukan';
  get diagnostics n = row_count;
  return n;
end $$;

do $q$ declare d text; begin
  d := pg_get_functiondef('public.af_payout_paid(uuid,text)'::regprocedure);
  if position('bank_hold_until' in d) = 0 then
    d := replace(d, $a$  if o.status <> 'disetujui' then raise exception 'Setujui pencairan dulu sebelum ditandai ditransfer'; end if;$a$,
      $b$  if o.status <> 'disetujui' then raise exception 'Setujui pencairan dulu sebelum ditandai ditransfer'; end if;
  if exists (select 1 from public.af_partners x where x.id = o.partner_id and (x.bank_hold_until > now() or x.bank_new_at is not null)) then
    raise exception 'Rekening mitra baru diganti dan masih ditahan sampai %', (select to_char(bank_hold_until at time zone 'Asia/Jakarta', 'DD/MM HH24.MI') from public.af_partners where id = o.partner_id);
  end if;
  if o.approved_by is not distinct from public.pk_me() and o.created_by is not distinct from public.pk_me() then
    raise exception 'Pencairan ini Anda ajukan dan setujui sendiri; minta orang lain menandai transfer';
  end if;$b$);
    execute d;
  end if;
end $q$;

-- ================= (G) log audit: sebelum/sesudah, tidak bisa diubah/dihapus =================
create or replace function public.af_audit_lock() returns trigger language plpgsql as $$
begin
  raise exception 'Log audit tidak bisa diubah atau dihapus';
end $$;
drop trigger if exists af_audit_lock on public.af_audit;
create trigger af_audit_lock before update or delete on public.af_audit for each row execute function public.af_audit_lock();
drop trigger if exists af_audit_lock_t on public.af_audit;
create trigger af_audit_lock_t before truncate on public.af_audit for each statement execute function public.af_audit_lock();

create or replace function public.af_audit_row() returns trigger language plpgsql security definer set search_path = public as $$
declare o jsonb; n jsonb; hide text[] := array['nik_enc','npwp_enc','bank_acct_enc','bank_new_acct_enc','key_hash','secret_enc','updated_at','code_hash'];
  k text;
begin
  o := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  n := case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) end;
  foreach k in array hide loop o := o - k; n := n - k; end loop;
  if tg_op = 'UPDATE' and o = n then return new; end if;
  if tg_table_name = 'af_bookings' and tg_op = 'UPDATE'
     and (o->>'comm_status') is not distinct from (n->>'comm_status') and (o->>'frozen') is not distinct from (n->>'frozen')
     and (o->>'commission') is not distinct from (n->>'commission') and (o->>'rate_final') is not distinct from (n->>'rate_final') then return new; end if;
  insert into public.af_audit(by_person, actor, action, target, data)
  values (public.pk_me(), auth.uid(), lower(tg_op) || '_' || tg_table_name, coalesce(n->>'id', o->>'id', n->>'key', o->>'key', n->>'unit_code', o->>'unit_code'),
          jsonb_build_object('sebelum', o, 'sesudah', n));
  return coalesce(new, old);
end $$;
do $t$ declare t text; begin
  foreach t in array array['af_rates','af_partner_rates','af_bookings','af_payouts','af_partners','af_rewards','af_challenges','af_rank_prizes','af_settings','af_unit_keys','af_units'] loop
    execute format('drop trigger if exists af_audit_row on public.%I', t);
    execute format('create trigger af_audit_row after insert or update or delete on public.%I for each row execute function public.af_audit_row()', t);
  end loop;
end $t$;

-- ================= (H) API unit: HMAC + cap waktu + anti-ulang + batas =================
alter table public.af_unit_keys add column if not exists key_id text unique, add column if not exists secret_enc bytea, add column if not exists revoked_at timestamptz;
create table if not exists public.af_api_nonces (sig text primary key, at timestamptz not null default now());
create table if not exists public.af_api_hits (bucket text not null, win timestamptz not null, n int not null default 0, primary key (bucket, win));
create table if not exists public.af_api_blocks (key_id text primary key, until timestamptz not null, reason text);
alter table public.af_api_nonces enable row level security;
alter table public.af_api_hits enable row level security;
alter table public.af_api_blocks enable row level security;
revoke all on public.af_api_nonces, public.af_api_hits, public.af_api_blocks from anon, authenticated;

create or replace function public.af_unit_key_new(p_unit text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare kid text := lower(p_unit) || '_' || encode(extensions.gen_random_bytes(5), 'hex'); sec text := 'afs_' || encode(extensions.gen_random_bytes(32), 'hex');
begin
  if not public.af_is_fin() then raise exception 'Hanya Owner / Keuangan'; end if;
  insert into public.af_unit_keys(unit_code, key_id, key_hash, secret_enc, hint, created_by, revoked_at)
  values (p_unit, kid, encode(extensions.digest(sec, 'sha256'), 'hex'), public.af_enc(sec), right(sec, 4), public.pk_me(), null)
  on conflict (unit_code) do update set key_id = excluded.key_id, key_hash = excluded.key_hash, secret_enc = excluded.secret_enc, hint = excluded.hint,
    created_by = excluded.created_by, created_at = now(), revoked_at = null;
  return jsonb_build_object('key_id', kid, 'secret', sec);
end $$;
create or replace function public.af_unit_key_revoke(p_unit text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.af_is_fin() then raise exception 'Hanya Owner / Keuangan'; end if;
  update public.af_unit_keys set revoked_at = now() where unit_code = p_unit;
end $$;
drop function if exists public.af_unit_by_key(text);

create or replace function public.af_api_hit(p_bucket text) returns int
language plpgsql security definer set search_path = public as $$
declare w timestamptz := date_trunc('minute', now()); c int;
begin
  insert into public.af_api_hits(bucket, win, n) values (p_bucket, w, 1) on conflict (bucket, win) do update set n = af_api_hits.n + 1 returning n into c;
  return c;
end $$;

-- verifikasi permintaan unit (tanpa raise supaya hitungan percobaan tersimpan). Hasil {unit} atau {error, status}.
-- Tanda tangan = hex(HMAC-SHA256(rahasia, "<cap waktu>.<METODE>.<path>.<body>"))
create or replace function public.af_api_verify(p_key_id text, p_ts text, p_sig text, p_method text, p_path text, p_body text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare k public.af_unit_keys; u public.af_units; ts bigint; exp text; b public.af_api_blocks;
begin
  if random() < 0.02 then
    delete from public.af_api_nonces where at < now() - interval '1 day';
    delete from public.af_api_hits where win < now() - interval '1 day';
  end if;
  select * into k from public.af_unit_keys where key_id = p_key_id;
  if k.unit_code is null or k.revoked_at is not null or k.secret_enc is null then return jsonb_build_object('error', 'Kunci unit tidak dikenal atau sudah dicabut', 'status', 401); end if;
  select * into u from public.af_units where code = k.unit_code;
  if not u.is_active then return jsonb_build_object('error', 'Unit nonaktif', 'status', 403); end if;
  select * into b from public.af_api_blocks where key_id = p_key_id and until > now();
  if b.key_id is not null then return jsonb_build_object('error', 'Diblokir sementara sampai ' || to_char(b.until at time zone 'Asia/Jakarta', 'HH24.MI') || ' WIB (' || b.reason || ')', 'status', 429); end if;
  if public.af_api_hit('k:' || p_key_id) > 120 then return jsonb_build_object('error', 'Terlalu banyak permintaan (maks 120/menit)', 'status', 429); end if;
  begin ts := p_ts::bigint; exception when others then return jsonb_build_object('error', 'x-timestamp harus detik unix', 'status', 401); end;
  if abs(extract(epoch from now()) - ts) > 300 then return jsonb_build_object('error', 'Cap waktu lebih dari 5 menit dari waktu server', 'status', 401); end if;
  exp := encode(extensions.hmac(ts::text || '.' || upper(p_method) || '.' || p_path || '.' || coalesce(p_body, ''), public.af_dec(k.secret_enc), 'sha256'), 'hex');
  if lower(coalesce(p_sig, '')) <> exp then
    if public.af_api_hit('bad:' || p_key_id) > 10 then
      insert into public.af_api_blocks(key_id, until, reason) values (p_key_id, now() + interval '15 minutes', 'terlalu banyak tanda tangan salah')
      on conflict (key_id) do update set until = excluded.until, reason = excluded.reason;
      insert into public.af_audit(action, target, reason) values ('api_blokir', p_key_id, 'Lebih dari 10 tanda tangan salah per menit');
    end if;
    return jsonb_build_object('error', 'Tanda tangan tidak cocok', 'status', 401);
  end if;
  begin
    insert into public.af_api_nonces(sig) values (exp);
  exception when unique_violation then return jsonb_build_object('error', 'Permintaan yang sama sudah pernah dikirim (replay)', 'status', 409); end;
  return jsonb_build_object('unit', k.unit_code);
end $$;

-- cek satu kode di checkout; tebakan salah dibatasi supaya kode tidak bisa ditebak beruntun
create or replace function public.af_api_code(p_unit text, p_key_id text, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare x public.af_partners; misses int;
begin
  if exists (select 1 from public.af_api_blocks where key_id = p_key_id and until > now()) then return jsonb_build_object('valid', false, 'error', 'Diblokir sementara karena terlalu banyak kode salah'); end if;
  if public.af_api_hit('c:' || p_key_id) > 60 then return jsonb_build_object('valid', false, 'error', 'Terlalu banyak cek kode (maks 60/menit)'); end if;
  select * into x from public.af_partners where code = upper(btrim(coalesce(p_code, ''))) and status = 'aktif' and not demo;
  if x.id is null then
    perform public.af_api_hit('miss:' || p_key_id);
    select coalesce(sum(n), 0) into misses from public.af_api_hits where bucket = 'miss:' || p_key_id and win > now() - interval '10 minutes';
    if misses > 30 then
      insert into public.af_api_blocks(key_id, until, reason) values (p_key_id, now() + interval '30 minutes', 'terlalu banyak kode salah')
      on conflict (key_id) do update set until = excluded.until, reason = excluded.reason;
      insert into public.af_audit(action, target, reason) values ('api_blokir', p_key_id, 'Lebih dari 30 kode salah dalam 10 menit');
    end if;
    return jsonb_build_object('valid', false);
  end if;
  return jsonb_build_object('valid', true, 'kode', x.code, 'nama_mitra', coalesce(nullif(x.org, ''), x.name), 'potongan_tamu', x.guest_discount,
    'potongan_tamu_pct', case when x.guest_discount then (public.af_set('guest_discount_pct'))::text::numeric else 0 end, 'internal', x.is_internal);
end $$;

-- ================= hak jalan fungsi =================
do $g$ declare f record; begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like 'af\_%') loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $g$;
revoke execute on function public.af_ingest(text, jsonb, boolean), public.af_api_events(text, jsonb), public.af_api_codes(text), public.af_api_featured(text),
  public.af_api_verify(text, text, text, text, text, text), public.af_api_code(text, text, text), public.af_api_hit(text),
  public.af_compute(uuid), public.af_notify(uuid, text, text), public.af_log(text, text, text, jsonb),
  public.af_pii_key(), public.af_enc(text), public.af_dec(bytea), public.af_audit_row(), public.af_audit_lock() from public, anon, authenticated;
grant execute on function public.af_public_rates() to anon;
grant execute on function public.af_api_featured(text) to anon;
