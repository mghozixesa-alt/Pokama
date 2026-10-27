-- 005b: penjaga alur kerja (tugas, permintaan, target, performa, cuti)
create or replace function public.pk_rpc_on() returns void language sql as $$ select set_config('pk.rpc', '1', true) $$;
create or replace function public.pk_is_rpc() returns boolean language sql stable as $$ select coalesce(current_setting('pk.rpc', true), '') = '1' $$;
revoke execute on function public.pk_rpc_on() from public, anon, authenticated;

-- ===== tugas =====
create or replace function public.pk_tasks_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me();
begin
  new.updated_at := now();
  if public.pk_is_rpc() or coalesce(current_setting('pk.allow_done', true), '') = '1' then return new; end if;
  if new.reviewer_id is not null and new.reviewer_id = new.pic_id then
    raise exception 'Reviewer tidak boleh sama dengan PIC';
  end if;
  if tg_op = 'INSERT' then
    if new.status not in ('todo','doing','hold') then raise exception 'Tugas baru harus berstatus belum mulai atau dikerjakan'; end if;
    new.version := 0; new.round := 0; new.done_at := null; new.revise_due := null; new.last_link := null;
    return new;
  end if;
  -- perubahan status langsung hanya antar belum mulai / dikerjakan / ditunda
  if new.status is distinct from old.status then
    if old.status = 'done' and (public.pk_is_admin() or me = old.reviewer_id) and new.status in ('todo','doing') then
      new.done_at := null;
    elsif not (old.status in ('todo','doing','hold') and new.status in ('todo','doing','hold')) then
      raise exception 'Status ini hanya berubah lewat Ajukan hasil atau Review & Revisi';
    end if;
  end if;
  if new.version is distinct from old.version or new.round is distinct from old.round
     or (new.done_at is distinct from old.done_at and new.status <> 'todo' and new.status <> 'doing') or new.revise_due is distinct from old.revise_due
     or new.last_link is distinct from old.last_link then
    raise exception 'Versi, putaran, dan tautan hasil hanya berubah lewat Ajukan hasil atau Review & Revisi';
  end if;
  if (new.pic_id is distinct from old.pic_id or new.reviewer_id is distinct from old.reviewer_id)
     and not (public.pk_is_admin() or me = old.created_by) then
    raise exception 'PIC dan reviewer hanya bisa diganti pembuat tugas atau Kepala Staf';
  end if;
  if old.status in ('review','done') and (new.pic_id is distinct from old.pic_id or new.reviewer_id is distinct from old.reviewer_id) and not public.pk_is_admin() then
    raise exception 'Tugas yang sedang direview atau selesai tidak bisa diganti PIC/reviewer-nya';
  end if;
  return new;
end $$;
create or replace trigger pk_tasks_guard before insert or update on public.pk_tasks
  for each row execute function public.pk_tasks_guard();

-- ===== permintaan =====
create or replace function public.pk_requests_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.pk_is_rpc() or public.pk_is_admin() then return new; end if;
  if new.from_id is distinct from old.from_id or new.pic_id is distinct from old.pic_id or new.task_id is distinct from old.task_id
     or new.project_id is distinct from old.project_id or new.triage_by is distinct from old.triage_by or new.triage_at is distinct from old.triage_at then
    raise exception 'Permintaan dipilah oleh Kepala Staf';
  end if;
  if new.status is distinct from old.status and not (old.status in ('baru','diperjelas') and new.status = 'baru' and public.pk_me() = old.from_id) then
    raise exception 'Status permintaan diubah lewat pemilahan Kepala Staf';
  end if;
  if public.pk_me() is distinct from old.from_id then raise exception 'Hanya pengaju yang bisa mengubah permintaannya'; end if;
  if old.status not in ('baru','diperjelas') then raise exception 'Permintaan yang sudah diproses tidak bisa diubah'; end if;
  return new;
end $$;
create or replace trigger pk_requests_guard before update on public.pk_requests
  for each row execute function public.pk_requests_guard();

-- ===== target bulanan =====
create or replace function public.pk_targets_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.pk_is_rpc() then return new; end if;
  if tg_op = 'INSERT' then new.status := 'usulan'; new.approved_by := null; new.checked_by := null; return new; end if;
  if new.status is distinct from old.status or new.approved_by is distinct from old.approved_by or new.checked_by is distinct from old.checked_by then
    raise exception 'Status target diubah lewat tombol Tandai dicek / Sahkan';
  end if;
  if old.status = 'sah' and new.amount is distinct from old.amount and coalesce(public.pk_role(),'') <> 'ceo' then
    raise exception 'Target yang sudah disahkan hanya bisa diubah CEO';
  end if;
  return new;
end $$;
create or replace trigger pk_targets_guard before insert or update on public.pk_targets
  for each row execute function public.pk_targets_guard();

create or replace function public.pk_target_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me();
begin
  perform public.pk_rpc_on();
  if p_status = 'dicek' and public.pk_is_fin() then
    update public.pk_targets set status = 'dicek', checked_by = me, updated_at = now() where id = p_id and status = 'usulan';
  elsif p_status = 'sah' and public.pk_role() = 'ceo' then
    update public.pk_targets set status = 'sah', approved_by = me, updated_at = now() where id = p_id;
  else raise exception 'Tidak berwenang'; end if;
  perform set_config('pk.rpc', '', true);
end $$;

-- ===== performa & insentif =====
create or replace function public.pk_perf_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text := coalesce(public.pk_role(), '');
begin
  if public.pk_me() is null then return new; end if;
  if r <> 'ceo' and (tg_op = 'INSERT' and (new.approved_by is not null or new.approved_at is not null)
       or tg_op = 'UPDATE' and (new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at)) then
    raise exception 'Persetujuan performa hanya oleh CEO';
  end if;
  if not public.pk_is_fin() and (tg_op = 'INSERT' and (new.paid_at is not null or new.incentive is not null)
       or tg_op = 'UPDATE' and (new.paid_at is distinct from old.paid_at or new.incentive is distinct from old.incentive)) then
    raise exception 'Insentif dan status bayar hanya diisi Keuangan';
  end if;
  return new;
end $$;
create or replace trigger pk_perf_guard before insert or update on public.pk_perf
  for each row execute function public.pk_perf_guard();

-- ===== cuti: saldo dicek di server =====
create or replace function public.pk_leave_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare used int; q int; n int;
begin
  if new.kind = 'cuti' then
    n := (coalesce(new.end_day, new.day) - new.day) + 1;
    if n < 1 then raise exception 'Tanggal selesai tidak boleh sebelum tanggal mulai'; end if;
    select coalesce(leave_quota, 12) into q from public.pk_people where id = new.person_id;
    select coalesce(sum((coalesce(end_day, day) - day) + 1), 0) into used from public.pk_leave
     where person_id = new.person_id and kind = 'cuti' and status in ('diajukan','disetujui')
       and extract(year from day) = extract(year from new.day);
    if used + n > q then raise exception 'Saldo cuti tidak cukup (sisa % hari)', greatest(q - used, 0); end if;
  end if;
  return new;
end $$;
create or replace trigger pk_leave_guard before insert on public.pk_leave
  for each row execute function public.pk_leave_guard();

create or replace function public.pk_leave_decide(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); l public.pk_leave;
begin
  select * into l from public.pk_leave where id = p_id for update;
  if l.id is null then raise exception 'Pengajuan tidak ditemukan'; end if;
  if l.status <> 'diajukan' then raise exception 'Pengajuan ini sudah diputuskan'; end if;
  if l.person_id = me then raise exception 'Tidak bisa menyetujui pengajuan sendiri'; end if;
  if not (public.pk_is_admin() or exists (select 1 from public.pk_people x where x.id = l.person_id and x.boss_id = me)) then
    raise exception 'Hanya atasan langsung yang menyetujui';
  end if;
  update public.pk_leave set status = case when p_approve then 'disetujui' else 'ditolak' end, decided_by = me, decided_at = now() where id = p_id;
end $$;

-- fungsi trigger tidak perlu bisa dipanggil langsung
revoke execute on function public.pk_leave_guard(), public.pk_people_guard(), public.pk_perf_guard(), public.pk_requests_guard(), public.pk_targets_guard() from public, anon, authenticated;
revoke execute on function public.pk_is_rpc(), public.pk_today() from anon;
