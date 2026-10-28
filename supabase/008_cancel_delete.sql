-- 008: batalkan (RAB, permintaan, cuti/izin) dan hapus data biasa
alter table public.pk_rab drop constraint pk_rab_status_check;
alter table public.pk_rab add constraint pk_rab_status_check check (status = any (array['diajukan','revisi','ditolak','siap_cair','cair','lpj','selesai','batal']));
alter table public.pk_requests drop constraint pk_requests_status_check;
alter table public.pk_requests add constraint pk_requests_status_check check (status = any (array['baru','ditunda','diterima','ditolak','diperjelas','jadi_tugas','selesai','batal']));
alter table public.pk_leave drop constraint pk_leave_status_check;
alter table public.pk_leave add constraint pk_leave_status_check check (status = any (array['diajukan','disetujui','ditolak','batal']));

-- RAB: dibatalkan pengaju (atau CEO) selama dana belum cair
create or replace function public.pk_rab_cancel(p_id uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); r public.pk_rab;
begin
  select * into r from public.pk_rab where id = p_id for update;
  if r.id is null then raise exception 'RAB tidak ditemukan'; end if;
  if me is distinct from r.created_by and coalesce(public.pk_role(),'') <> 'ceo' then raise exception 'Hanya pengaju yang bisa membatalkan RAB'; end if;
  if r.status not in ('diajukan','revisi','siap_cair') then raise exception 'RAB yang dananya sudah cair atau sudah selesai tidak bisa dibatalkan'; end if;
  update public.pk_rab set status = 'batal', note = coalesce(nullif(btrim(p_note),''), 'Dibatalkan pengaju') where id = p_id;
  insert into public.pk_rab_log(rab_id, actor_id, action, note) values (p_id, me, 'batal', p_note);
end $$;

-- Permintaan: dibatalkan pengaju selama belum jadi tugas
create or replace function public.pk_request_cancel(p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); r public.pk_requests;
begin
  select * into r from public.pk_requests where id = p_id for update;
  if r.id is null then raise exception 'Permintaan tidak ditemukan'; end if;
  if me is distinct from r.from_id and not public.pk_is_admin() then raise exception 'Hanya pengaju yang bisa membatalkan permintaan'; end if;
  if r.status not in ('baru','diperjelas','ditunda','diterima') then raise exception 'Permintaan yang sudah jadi tugas tidak bisa dibatalkan. Hapus tugasnya di Proyek & Tugas.'; end if;
  perform public.pk_rpc_on();
  update public.pk_requests set status = 'batal', reason = coalesce(nullif(btrim(p_reason),''), 'Dibatalkan pengaju') where id = p_id;
  perform set_config('pk.rpc', '', true);
end $$;

-- Cuti / izin: dibatalkan yang mengajukan selama belum diputuskan
create or replace function public.pk_leave_cancel(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.pk_me(); l public.pk_leave;
begin
  select * into l from public.pk_leave where id = p_id for update;
  if l.id is null then raise exception 'Pengajuan tidak ditemukan'; end if;
  if me is distinct from l.person_id then raise exception 'Hanya yang mengajukan yang bisa membatalkan'; end if;
  if l.status <> 'diajukan' then raise exception 'Pengajuan yang sudah diputuskan tidak bisa dibatalkan. Minta atasan mengubahnya.'; end if;
  update public.pk_leave set status = 'batal' where id = p_id;
end $$;

revoke execute on function public.pk_rab_cancel(uuid, text), public.pk_request_cancel(uuid, text), public.pk_leave_cancel(uuid) from public, anon;
grant execute on function public.pk_rab_cancel(uuid, text), public.pk_request_cancel(uuid, text), public.pk_leave_cancel(uuid) to authenticated;

-- Target bulanan: usulan yang belum dicek boleh dihapus pengusul, Keuangan, atau Kepala Staf/CEO
create policy pk_targets_d on public.pk_targets for delete
  using (status = 'usulan' and (proposed_by = public.pk_me() or public.pk_is_fin() or public.pk_is_admin()));
grant delete on public.pk_targets to authenticated;

-- Orang: hanya CEO yang boleh menghapus data orang (lainnya cukup dinonaktifkan)
create or replace function public.pk_people_del_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.pk_me() is not null and coalesce(public.pk_role(), '') <> 'ceo' then
    raise exception 'Data orang tidak dihapus. Nonaktifkan saja (hilangkan centang Aktif)';
  end if;
  return old;
end $$;
revoke execute on function public.pk_people_del_guard() from public, anon, authenticated;
create or replace trigger pk_people_del_guard before delete on public.pk_people
  for each row execute function public.pk_people_del_guard();
