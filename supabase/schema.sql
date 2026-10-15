-- KMB / KTA-TRA shared authentication and state backend
-- Owner: matthewyoga2014@gmail.com

create extension if not exists citext;

create table if not exists public.access_roles (
  email citext primary key,
  role text not null check (role in ('owner','editor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.access_roles(email, role)
values ('matthewyoga2014@gmail.com','owner')
on conflict (email) do update set role='owner', updated_at=now();

create table if not exists public.app_state_public (
  app_id text primary key check (app_id in ('kmb','kta-tra')),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.app_state_private (
  app_id text primary key check (app_id in ('kmb','kta-tra')),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into public.app_state_public(app_id) values ('kmb'),('kta-tra')
on conflict (app_id) do nothing;
insert into public.app_state_private(app_id) values ('kmb'),('kta-tra')
on conflict (app_id) do nothing;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.access_roles
     where lower(email::text)=lower(coalesce(auth.jwt()->>'email',''))
     limit 1),
    'viewer'
  );
$$;

grant execute on function public.current_app_role() to anon, authenticated;

alter table public.access_roles enable row level security;
alter table public.app_state_public enable row level security;
alter table public.app_state_private enable row level security;

drop policy if exists "roles read self or owner" on public.access_roles;
create policy "roles read self or owner"
on public.access_roles for select
to authenticated
using (
  public.current_app_role()='owner'
  or lower(email::text)=lower(coalesce(auth.jwt()->>'email',''))
);

drop policy if exists "roles owner insert" on public.access_roles;
create policy "roles owner insert"
on public.access_roles for insert
to authenticated
with check (public.current_app_role()='owner');

drop policy if exists "roles owner update" on public.access_roles;
create policy "roles owner update"
on public.access_roles for update
to authenticated
using (public.current_app_role()='owner')
with check (public.current_app_role()='owner');

drop policy if exists "roles owner delete" on public.access_roles;
create policy "roles owner delete"
on public.access_roles for delete
to authenticated
using (public.current_app_role()='owner');

-- Everyone with the link may read the sanitized operational state.
drop policy if exists "public state read" on public.app_state_public;
create policy "public state read"
on public.app_state_public for select
to anon, authenticated
using (true);

-- Only registered Editor or Owner may change operational state.
drop policy if exists "public state write" on public.app_state_public;
create policy "public state write"
on public.app_state_public for all
to authenticated
using (public.current_app_role() in ('owner','editor'))
with check (public.current_app_role() in ('owner','editor'));

-- Sensitive/full manpower state is only visible to registered Editor or Owner.
drop policy if exists "private state read" on public.app_state_private;
create policy "private state read"
on public.app_state_private for select
to authenticated
using (public.current_app_role() in ('owner','editor'));

drop policy if exists "private state write" on public.app_state_private;
create policy "private state write"
on public.app_state_private for all
to authenticated
using (public.current_app_role() in ('owner','editor'))
with check (public.current_app_role() in ('owner','editor'));

grant select on public.app_state_public to anon, authenticated;
grant insert, update, delete on public.app_state_public to authenticated;
grant select, insert, update, delete on public.app_state_private to authenticated;
grant select, insert, update, delete on public.access_roles to authenticated;
