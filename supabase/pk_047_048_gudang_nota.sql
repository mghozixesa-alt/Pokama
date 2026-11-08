-- pk_047: Gudang & permintaan antar-divisi (tabel pk_gudang_*, fungsi pk_gudang_item_save / pk_gudang_request / pk_gudang_act / pk_gudang_is_keeper) — sudah diterapkan lewat migrasi Supabase.
-- pk_048 (MENUNGGU PERSETUJUAN): bucket foto nota & serah terima gudang
insert into storage.buckets (id, name, public) values ('pk-nota', 'pk-nota', false) on conflict (id) do nothing;
create policy pk_nota_ins on storage.objects for insert to authenticated with check (bucket_id = 'pk-nota' and (storage.foldername(name))[1] = (public.pk_me())::text);
create policy pk_nota_sel on storage.objects for select to authenticated using (bucket_id = 'pk-nota' and public.pk_member() is not null);
