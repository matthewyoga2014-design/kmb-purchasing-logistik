-- Pusat Monitoring: undangan Editor/Pelihat berbasis email, permintaan akses, izin menu per web.
-- Pelihat wajib login; link anonim ?k= tidak lagi membuka data.

create or replace function public.kta_member_role(p_app text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when lower(coalesce(auth.jwt()->>'email','')) = 'matthewyoga2014@gmail.com' then 'owner'
    else coalesce((select a.role from public.app_access_roles a
                   where a.app_id = p_app and lower(a.email::text) = lower(coalesce(auth.jwt()->>'email',''))
                   limit 1), '') end;
$$;

create or replace function public.kta_app_ok(p_app text) returns boolean language sql immutable as $$
  select p_app in ('kta-tra','bupr-ampah','mbj','kmb','apd');
$$;

create table if not exists public.kta_invites (
  token text primary key default encode(extensions.gen_random_bytes(18), 'hex'),
  app_id text not null, email text not null, role text not null check (role in ('editor','viewer')),
  created_by text not null, created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  used_at timestamptz, used_by text, revoked boolean not null default false);
alter table public.kta_invites enable row level security;
drop policy if exists "invites read staff" on public.kta_invites;
create policy "invites read staff" on public.kta_invites for select to authenticated
  using (public.kta_member_role(app_id) = 'owner' or (public.kta_member_role(app_id) = 'editor' and role = 'viewer'));

create table if not exists public.kta_access_requests (
  id uuid primary key default gen_random_uuid(),
  app_id text not null, email text not null, role text not null default 'viewer',
  token text, note text, status text not null default 'pending' check (status in ('pending','approved','denied')),
  requested_at timestamptz not null default now(), decided_at timestamptz, decided_by text,
  unique (app_id, email));
alter table public.kta_access_requests enable row level security;
drop policy if exists "access req read" on public.kta_access_requests;
create policy "access req read" on public.kta_access_requests for select to authenticated
  using (public.kta_member_role(app_id) in ('owner','editor') or lower(email) = lower(coalesce(auth.jwt()->>'email','')));

create table if not exists public.kta_app_perms (
  app_id text primary key, perms jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(), updated_by text);
alter table public.kta_app_perms enable row level security;
drop policy if exists "perms read member" on public.kta_app_perms;
create policy "perms read member" on public.kta_app_perms for select to authenticated using (public.kta_member_role(app_id) <> '');
drop policy if exists "perms write owner" on public.kta_app_perms;
create policy "perms write owner" on public.kta_app_perms for all to authenticated
  using (public.kta_member_role(app_id) = 'owner') with check (public.kta_member_role(app_id) = 'owner');

-- ---------- RPC ----------
create or replace function public.kta_my_apps() returns table(app_id text, role text)
language sql stable security definer set search_path = public as $$
  select x.a, public.kta_member_role(x.a) from unnest(array['kta-tra','bupr-ampah','mbj','kmb','apd']) x(a)
  where public.kta_member_role(x.a) <> '';
$$;

create or replace function public.kta_invite_create(p_app text, p_email text, p_role text) returns text
language plpgsql security definer set search_path = public as $$
declare r text := public.kta_member_role(p_app); em text := lower(trim(coalesce(p_email,''))); me text := lower(coalesce(auth.jwt()->>'email','')); t text;
begin
  if not public.kta_app_ok(p_app) then raise exception 'Web tidak dikenal.'; end if;
  if p_role not in ('editor','viewer') then raise exception 'Peran tidak valid.'; end if;
  if not (r = 'owner' or (r = 'editor' and p_role = 'viewer')) then raise exception 'Anda tidak punya hak membagikan link ini.'; end if;
  if em !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Format email belum benar.'; end if;
  if em = 'matthewyoga2014@gmail.com' then raise exception 'Email ini adalah Pemilik.'; end if;
  insert into public.kta_invites(app_id, email, role, created_by) values (p_app, em, p_role, me) returning token into t;
  return t;
end $$;

create or replace function public.kta_invite_peek(p_token text) returns table(app_id text, role text, email_hint text, status text)
language sql stable security definer set search_path = public as $$
  select i.app_id, i.role,
         left(split_part(i.email,'@',1), 2) || '***@' || split_part(i.email,'@',2),
         case when i.revoked then 'revoked' when i.expires_at < now() then 'expired' else 'ok' end
  from public.kta_invites i where i.token = p_token;
$$;

create or replace function public.kta_invite_redeem(p_token text) returns table(app_id text, role text, status text)
language plpgsql security definer set search_path = public as $$
declare me text := lower(coalesce(auth.jwt()->>'email','')); i public.kta_invites; cur text; fin text;
begin
  if me = '' then raise exception 'Silakan masuk dulu.'; end if;
  select * into i from public.kta_invites where token = p_token for update;
  if not found then return query select null::text, null::text, 'invalid'; return; end if;
  if i.revoked then return query select i.app_id, i.role, 'revoked'; return; end if;
  if i.expires_at < now() then return query select i.app_id, i.role, 'expired'; return; end if;
  cur := public.kta_member_role(i.app_id);
  if lower(i.email) <> me then
    if cur <> '' then return query select i.app_id, cur, 'ok'; return; end if;
    insert into public.kta_access_requests(app_id, email, role, token, status, requested_at, decided_at, decided_by)
      values (i.app_id, me, 'viewer', p_token, 'pending', now(), null, null)
      on conflict on constraint kta_access_requests_app_id_email_key do update set status = 'pending', token = excluded.token, requested_at = now(), decided_at = null, decided_by = null;
    return query select i.app_id, 'viewer'::text, 'requested'; return;
  end if;
  if cur in ('owner','editor') and i.role = 'viewer' then fin := cur;
  else
    insert into public.app_access_roles(app_id, email, role, updated_at) values (i.app_id, me, i.role, now())
      on conflict (app_id, email) do update set role = excluded.role, updated_at = now();
    fin := i.role;
  end if;
  update public.kta_invites set used_at = coalesce(used_at, now()), used_by = me where token = p_token;
  delete from public.kta_access_requests r where r.app_id = i.app_id and lower(r.email) = me;
  return query select i.app_id, fin, 'ok';
end $$;

create or replace function public.kta_access_ask(p_app text, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare me text := lower(coalesce(auth.jwt()->>'email',''));
begin
  if me = '' then raise exception 'Silakan masuk dulu.'; end if;
  if not public.kta_app_ok(p_app) then raise exception 'Web tidak dikenal.'; end if;
  if public.kta_member_role(p_app) <> '' then return 'member'; end if;
  insert into public.kta_access_requests(app_id, email, role, note, status, requested_at)
    values (p_app, me, 'viewer', left(p_note, 300), 'pending', now())
    on conflict on constraint kta_access_requests_app_id_email_key do update set status = 'pending', note = excluded.note, requested_at = now(), decided_at = null, decided_by = null;
  return 'pending';
end $$;

create or replace function public.kta_access_decide(p_id uuid, p_ok boolean) returns text
language plpgsql security definer set search_path = public as $$
declare q public.kta_access_requests; me text := lower(coalesce(auth.jwt()->>'email','')); r text;
begin
  select * into q from public.kta_access_requests where id = p_id for update;
  if not found then raise exception 'Permintaan tidak ditemukan.'; end if;
  r := public.kta_member_role(q.app_id);
  if r not in ('owner','editor') then raise exception 'Anda tidak punya hak memutuskan.'; end if;
  update public.kta_access_requests set status = case when p_ok then 'approved' else 'denied' end, decided_at = now(), decided_by = me where id = p_id;
  if p_ok then
    insert into public.app_access_roles(app_id, email, role, updated_at) values (q.app_id, lower(q.email), 'viewer', now())
      on conflict (app_id, email) do nothing;
  end if;
  return case when p_ok then 'approved' else 'denied' end;
end $$;

create or replace function public.kta_members(p_app text) returns table(email text, role text, since timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.kta_member_role(p_app) not in ('owner','editor') then raise exception 'Tidak punya akses.'; end if;
  return query select 'matthewyoga2014@gmail.com'::text, 'owner'::text, null::timestamptz
    union all select a.email::text, a.role, a.created_at from public.app_access_roles a
    where a.app_id = p_app and a.role <> 'owner' and lower(a.email::text) <> 'matthewyoga2014@gmail.com' order by 2 desc, 1;
end $$;

create or replace function public.kta_member_remove(p_app text, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare r text := public.kta_member_role(p_app); tr text;
begin
  select a.role into tr from public.app_access_roles a where a.app_id = p_app and lower(a.email::text) = lower(p_email);
  if tr is null then return; end if;
  if tr = 'owner' then raise exception 'Pemilik tidak bisa dihapus.'; end if;
  if not (r = 'owner' or (r = 'editor' and tr = 'viewer')) then raise exception 'Editor hanya bisa menghapus Pelihat.'; end if;
  delete from public.app_access_roles a where a.app_id = p_app and lower(a.email::text) = lower(p_email);
  update public.kta_invites set revoked = true where app_id = p_app and lower(email) = lower(p_email) and used_at is null;
end $$;

create or replace function public.kta_member_set(p_app text, p_email text, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.kta_member_role(p_app) <> 'owner' then raise exception 'Hanya Pemilik.'; end if;
  if p_role not in ('editor','viewer') then raise exception 'Peran tidak valid.'; end if;
  update public.app_access_roles set role = p_role, updated_at = now() where app_id = p_app and lower(email::text) = lower(p_email) and role <> 'owner';
end $$;

create or replace function public.kta_invite_revoke(p_token text) returns void
language plpgsql security definer set search_path = public as $$
declare i public.kta_invites; me text := lower(coalesce(auth.jwt()->>'email',''));
begin
  select * into i from public.kta_invites where token = p_token;
  if not found then return; end if;
  if not (public.kta_member_role(i.app_id) = 'owner' or lower(i.created_by) = me) then raise exception 'Tidak punya hak.'; end if;
  update public.kta_invites set revoked = true where token = p_token;
end $$;

-- ---------- baca data: hanya anggota terdaftar (Pemilik / Editor / Pelihat), link ?k= tidak dipakai lagi ----------
create or replace function public.kta_web_read(p_ids text[], p_key text default null)
returns table(id text, data jsonb, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.data, s.updated_at from public.kta_web_state s
  where s.id = any(p_ids) and public.kta_member_role(public.kta_app_of(s.id)) in ('owner','editor','viewer');
$$;

create or replace function public.apd_can_read(p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.kta_member_role('apd') in ('owner','editor','viewer');
$$;

-- ---------- APD: bagian khusus Pemilik dijaga juga di server ----------
create or replace function public.apd_protect_owner_sections() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare em text := lower(coalesce(auth.jwt()->>'email','')); k text; o jsonb; n jsonb;
begin
  if auth.role() is distinct from 'authenticated' then return new; end if;
  if public.kta_member_role('apd') = 'owner' then return new; end if;
  foreach k in array array['stockIn','adjust','transfers','limits','images','types','warehouses','ga'] loop
    if (new.data -> k) is distinct from (old.data -> k) then
      raise exception 'Khusus Pemilik: stok gudang, gudang, gambar, jenis APD, dan Form GA tidak bisa diubah Editor.' using errcode = '42501';
    end if;
  end loop;
  for o in select * from jsonb_array_elements(coalesce(old.data->'requests','[]'::jsonb)) loop
    select x into n from jsonb_array_elements(coalesce(new.data->'requests','[]'::jsonb)) x where x->>'id' = o->>'id' limit 1;
    if n is null then raise exception 'Permintaan APD tidak boleh dihapus Editor.' using errcode = '42501'; end if;
    if coalesce(n->>'gaId','') is distinct from coalesce(o->>'gaId','') then raise exception 'Form GA hanya diatur Pemilik.' using errcode = '42501'; end if;
    if n->>'status' is distinct from o->>'status' and not (
        (o->>'status' = 'pending' and n->>'status' = 'cancelled' and lower(o->>'by') = em) or
        (o->>'status' = 'approved' and n->>'status' = 'fulfilled' and coalesce(o->>'kind','person') <> 'stock')) then
      raise exception 'Persetujuan permintaan APD hanya oleh Pemilik.' using errcode = '42501';
    end if;
  end loop;
  for n in select * from jsonb_array_elements(coalesce(new.data->'requests','[]'::jsonb)) loop
    if not exists (select 1 from jsonb_array_elements(coalesce(old.data->'requests','[]'::jsonb)) x where x->>'id' = n->>'id')
       and n->>'status' <> 'pending' then raise exception 'Permintaan baru harus berstatus Menunggu.' using errcode = '42501'; end if;
  end loop;
  return new;
end $$;
