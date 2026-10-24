-- Data pribadi karyawan (MP Aktif / MP Out) untuk web Manpower.
-- Hanya Pemilik & Editor yang login yang bisa membaca/mengubah (RLS). Pelihat & link tanpa login tidak punya akses.
create table if not exists public.kta_mp_private (
  site_id text not null,
  pkey text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (site_id, pkey)
);
alter table public.kta_mp_private enable row level security;
drop policy if exists "mp private rw" on public.kta_mp_private;
create policy "mp private rw" on public.kta_mp_private for all to authenticated
  using (public.kta_web_role_for(public.kta_app_of(site_id)) in ('owner','editor'))
  with check (public.kta_web_role_for(public.kta_app_of(site_id)) in ('owner','editor'));
revoke all on public.kta_mp_private from anon;
grant select, insert, update, delete on public.kta_mp_private to authenticated;
