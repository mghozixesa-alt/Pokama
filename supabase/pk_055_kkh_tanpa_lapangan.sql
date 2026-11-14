-- 15 Nov 2026: staf lapangan tidak memakai KKH (absen & kerja lewat ops.pokama.org / Rentalaja App).
-- pk_kkh_tick tidak lagi mencatat "telat isi KKH" / mengirim pengingat ke role 'lapangan',
-- dan catatan pk_kkh_miss lapangan yang terlanjur tercatat dihapus. (Sudah dijalankan di produksi.)
do $d$
declare s text := pg_get_functiondef('public.pk_kkh_tick()'::regprocedure); s2 text;
begin
  s2 := replace(s, $o$where x.is_active and x.role <> 'ceo'$o$, $n$where x.is_active and x.role not in ('ceo', 'lapangan')$n$);
  if s2 = s then raise notice 'pk_kkh_tick sudah diperbarui'; else execute s2; end if;
end $d$;
delete from public.pk_kkh_miss m using public.pk_people p where p.id = m.person_id and p.role = 'lapangan';
