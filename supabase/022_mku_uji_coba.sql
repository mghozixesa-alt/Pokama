-- Uji coba Marketing (tahap 1): satu tabel dokumen bersama, terpisah dari tabel KKH (pk_*) dan draf mk_*.
-- Setiap baris = satu konten / ide / campaign / KOL / laporan / angka harian. Bisa dihapus utuh setelah uji coba
-- (lihat 022_mku_uji_coba_down.sql). Tidak mengubah tabel lain.
create table if not exists public.mku_docs (
  key text primary key,                       -- mis. item:abc123, ig:2026-10-28:Instagram:Rentalaja
  kind text not null,                         -- item | idea | camp | kol | rep | ig | ads | seo | team | budget | subs | meta
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.pk_people(id) on delete set null
);
create index if not exists mku_docs_updated_idx on public.mku_docs (updated_at);

create or replace function public.mku_touch() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := public.pk_me();
  return new;
end $$;
drop trigger if exists mku_docs_touch on public.mku_docs;
create trigger mku_docs_touch before insert or update on public.mku_docs for each row execute function public.mku_touch();

alter table public.mku_docs enable row level security;
drop policy if exists mku_docs_r on public.mku_docs;
drop policy if exists mku_docs_w on public.mku_docs;
create policy mku_docs_r on public.mku_docs for select to authenticated using (public.pk_me() is not null);
create policy mku_docs_w on public.mku_docs for all to authenticated using (public.pk_me() is not null) with check (public.pk_me() is not null);
grant select, insert, update on public.mku_docs to authenticated;
