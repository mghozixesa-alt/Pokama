-- 010: CEO boleh menghapus target apa pun (termasuk yang sudah disahkan)
alter policy pk_targets_d on public.pk_targets
  using ((status = 'usulan' and (proposed_by = public.pk_me() or public.pk_is_fin() or public.pk_is_admin())) or coalesce(public.pk_role(), '') = 'ceo');
