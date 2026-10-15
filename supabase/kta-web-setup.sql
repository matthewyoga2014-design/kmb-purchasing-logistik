-- Monitoring Manpower KTA-TRA (web mandiri) — jalankan SEKALI di Supabase > SQL Editor > New query > Run.
-- Tidak mengubah tabel web lain. Editor memakai daftar yang sama: app_access_roles (app_id = 'kta-tra').

-- 1) Pastikan pemilik terdaftar
insert into public.app_access_roles (app_id, email, role)
values ('kta-tra', 'matthewyoga2014@gmail.com', 'owner')
on conflict (app_id, email) do update set role = 'owner';

-- 2) Fungsi cek peran (owner / editor / viewer)
create or replace function public.kta_web_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((
    select role from public.app_access_roles
    where app_id = 'kta-tra'
      and lower(email::text) = lower(coalesce(auth.jwt()->>'email', ''))
    limit 1), 'viewer');
$$;
grant execute on function public.kta_web_role() to anon, authenticated;

-- 3) Tabel data web
create table if not exists public.kta_web_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.kta_web_state enable row level security;

drop policy if exists "kta web read" on public.kta_web_state;
create policy "kta web read" on public.kta_web_state
  for select to anon, authenticated using (true);

drop policy if exists "kta web write" on public.kta_web_state;
create policy "kta web write" on public.kta_web_state
  for all to authenticated
  using (public.kta_web_role() in ('owner','editor'))
  with check (public.kta_web_role() in ('owner','editor'));

grant select on public.kta_web_state to anon, authenticated;
grant insert, update, delete on public.kta_web_state to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.kta_web_state;
exception when others then null; end $$;

-- 4) Tempat berkas pelamar (privat: hanya Pemilik/Editor yang bisa buka)
insert into storage.buckets (id, name, public, file_size_limit)
values ('kta-web-docs', 'kta-web-docs', false, 20971520)
on conflict (id) do nothing;

drop policy if exists "kta web docs read" on storage.objects;
create policy "kta web docs read" on storage.objects for select to authenticated
  using (bucket_id = 'kta-web-docs' and public.kta_web_role() in ('owner','editor'));
drop policy if exists "kta web docs upload" on storage.objects;
create policy "kta web docs upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'kta-web-docs' and public.kta_web_role() in ('owner','editor'));
drop policy if exists "kta web docs delete" on storage.objects;
create policy "kta web docs delete" on storage.objects for delete to authenticated
  using (bucket_id = 'kta-web-docs' and public.kta_web_role() in ('owner','editor'));
