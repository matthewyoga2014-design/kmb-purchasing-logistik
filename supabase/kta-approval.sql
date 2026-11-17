-- Simpan & Persetujuan perubahan (draf editor, usulan, riwayat, salinan harian)
-- Dipasang per portal lewat kta_approval_settings.enabled (default MATI).
-- Saat MATI: editor menyimpan langsung seperti biasa, tetapi riwayat tetap tercatat.
-- Saat NYALA: editor hanya bisa membuat draf/usulan; Pemilik dan PIC yang menyetujui.

-- ---------- PIC: Editor yang juga boleh menyetujui (tetap tercatat sebagai Editor di app_access_roles) ----------
create table if not exists public.kta_approvers (
  app_id text not null,
  email text not null,
  scope text,                      -- catatan bagian yang dipegang (mis. "Maintenance Section"); kosong = semua
  added_at timestamptz not null default now(),
  added_by text,
  primary key (app_id, email)
);
alter table public.kta_approvers enable row level security;
drop policy if exists "approvers read" on public.kta_approvers;
create policy "approvers read" on public.kta_approvers for select to authenticated
  using (public.kta_web_role_for(app_id) in ('owner','editor'));
drop policy if exists "approvers owner write" on public.kta_approvers;
create policy "approvers owner write" on public.kta_approvers for all to authenticated
  using (public.kta_web_role_for(app_id) = 'owner') with check (public.kta_web_role_for(app_id) = 'owner');

-- ---------- pengaturan per portal ----------
create table if not exists public.kta_approval_settings (
  app_id text primary key,
  enabled boolean not null default false,
  auto_minutes int not null default 30 check (auto_minutes between 5 and 1440),
  recap_hour int not null default 17 check (recap_hour between 0 and 23),
  escalate_hours int not null default 24 check (escalate_hours between 0 and 720),
  owner_wa text,
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.kta_approval_settings(app_id) values ('mbj') on conflict do nothing;
alter table public.kta_approval_settings enable row level security;
drop policy if exists "approval settings read" on public.kta_approval_settings;
create policy "approval settings read" on public.kta_approval_settings for select to authenticated
  using (public.kta_web_role_for(app_id) in ('owner','editor'));
drop policy if exists "approval settings owner write" on public.kta_approval_settings;
create policy "approval settings owner write" on public.kta_approval_settings for update to authenticated
  using (public.kta_web_role_for(app_id) = 'owner') with check (public.kta_web_role_for(app_id) = 'owner');

create or replace function public.kta_approval_on(app text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from public.kta_approval_settings where app_id = app), false);
$$;
create or replace function public.kta_is_approver(app text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.kta_web_role_for(app) = 'owner'
      or (public.kta_web_role_for(app) = 'editor'
          and exists(select 1 from public.kta_approvers p where p.app_id = app and lower(p.email) = lower(coalesce(auth.jwt()->>'email',''))));
$$;

-- ---------- kta_web_state: editor tidak bisa menulis langsung saat persetujuan NYALA ----------
drop policy if exists "kta web write" on public.kta_web_state;
create policy "kta web write" on public.kta_web_state for all to authenticated
  using (public.kta_web_role_for(public.kta_app_of(id)) = 'owner'
         or (public.kta_web_role_for(public.kta_app_of(id)) = 'editor'
             and (not public.kta_approval_on(public.kta_app_of(id)) or public.kta_is_approver(public.kta_app_of(id)))))
  with check (public.kta_web_role_for(public.kta_app_of(id)) = 'owner'
         or (public.kta_web_role_for(public.kta_app_of(id)) = 'editor'
             and (not public.kta_approval_on(public.kta_app_of(id)) or public.kta_is_approver(public.kta_app_of(id)))));

create or replace function public.monitoring_guest_write(p_token text, p_id text, p_data jsonb, p_old timestamp with time zone)
 returns timestamp with time zone language plpgsql security definer set search_path to 'public' as $function$
declare v timestamptz;
begin
 if not exists(select 1 from public.monitoring_guest_links g where g.token=p_token and not g.revoked and g.expires_at>now()
 and g.access_role='editor' and g.app_id=public.kta_app_of(p_id))
 then raise exception 'Link Editor tidak berlaku'; end if;
 if public.kta_approval_on(public.kta_app_of(p_id)) then raise exception 'Perlu persetujuan: gunakan Ajukan simpan'; end if;
 if p_data is null or jsonb_typeof(p_data->'positions')<>'array' or pg_column_size(p_data)>8000000 then raise exception 'Data tidak valid'; end if;
 update public.kta_web_state s set data=p_data,updated_at=clock_timestamp(),updated_by='Editor link'
 where s.id=p_id and s.updated_at is not distinct from p_old returning updated_at into v;
 if not found then raise exception 'Data sudah berubah, muat ulang'; end if;
 return v;
end $function$;

-- ---------- siapa pemanggilnya (login email atau link editor) ----------
create or replace function public.kta_actor(p_state text, p_token text, out actor text, out label text, out role text)
language plpgsql stable security definer set search_path = public as $$
declare app text := public.kta_app_of(p_state); em text := lower(coalesce(auth.jwt()->>'email',''));
begin
  if p_token is not null and p_token <> '' then
    if not exists(select 1 from public.monitoring_guest_links g where g.token=p_token and not g.revoked and g.expires_at>now()
                  and g.access_role='editor' and g.app_id=app) then raise exception 'Link Editor tidak berlaku'; end if;
    actor := 'link:' || left(md5(p_token), 12); label := 'Editor link'; role := 'editor';
  else
    role := public.kta_web_role_for(app);
    if em = '' or role not in ('owner','editor') then raise exception 'Tidak punya akses edit'; end if;
    if role = 'editor' and public.kta_is_approver(app) then role := 'pic'; end if;
    actor := em; label := em;
  end if;
end $$;

-- ---------- draf (perubahan yang belum diajukan) ----------
create table if not exists public.kta_drafts (
  state_id text not null,
  actor text not null,
  actor_label text,
  app_id text not null,
  base_ver timestamptz,
  ops jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (state_id, actor)
);
alter table public.kta_drafts enable row level security;
drop policy if exists "drafts approver read" on public.kta_drafts;
create policy "drafts approver read" on public.kta_drafts for select to authenticated using (public.kta_is_approver(app_id));

create or replace function public.kta_draft_put(p_state text, p_base timestamptz, p_ops jsonb, p_token text default null)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare a record; t timestamptz := now();
begin
  select * into a from public.kta_actor(p_state, p_token);
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) = 0 then
    delete from public.kta_drafts where state_id = p_state and actor = a.actor; return null;
  end if;
  if pg_column_size(p_ops) > 2000000 then raise exception 'Draf terlalu besar'; end if;
  insert into public.kta_drafts(state_id, actor, actor_label, app_id, base_ver, ops, updated_at)
  values (p_state, a.actor, a.label, public.kta_app_of(p_state), p_base, p_ops, t)
  on conflict (state_id, actor) do update set ops = excluded.ops, base_ver = excluded.base_ver, actor_label = excluded.actor_label, updated_at = t;
  return t;
end $$;

create or replace function public.kta_draft_get(p_state text, p_token text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; r jsonb;
begin
  select * into a from public.kta_actor(p_state, p_token);
  select to_jsonb(d) into r from public.kta_drafts d where d.state_id = p_state and d.actor = a.actor;
  return r;
end $$;

-- ---------- usulan perubahan ----------
create table if not exists public.kta_change_requests (
  id uuid primary key default gen_random_uuid(),
  app_id text not null,
  state_id text not null,
  actor text not null,
  actor_label text,
  kind text not null default 'diajukan' check (kind in ('diajukan','otomatis')),
  base_ver timestamptz,
  ops jsonb not null,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','partial','rejected','cancelled')),
  created_at timestamptz not null default now(),
  last_activity timestamptz,
  decided_by text,
  decided_at timestamptz,
  decided_note text
);
create index if not exists kta_cr_state_status on public.kta_change_requests(state_id, status, created_at desc);
alter table public.kta_change_requests enable row level security;
drop policy if exists "requests approver or own read" on public.kta_change_requests;
create policy "requests approver or own read" on public.kta_change_requests for select to authenticated
  using (public.kta_is_approver(app_id) or actor = lower(coalesce(auth.jwt()->>'email','')));

create or replace function public.kta_cr_submit(p_state text, p_base timestamptz, p_ops jsonb, p_note text default null, p_token text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare a record; nid uuid;
begin
  select * into a from public.kta_actor(p_state, p_token);
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) = 0 then raise exception 'Tidak ada perubahan'; end if;
  insert into public.kta_change_requests(app_id, state_id, actor, actor_label, kind, base_ver, ops, note, last_activity)
  values (public.kta_app_of(p_state), p_state, a.actor, a.label, 'diajukan', p_base, p_ops, nullif(trim(coalesce(p_note,'')),''), now())
  returning id into nid;
  delete from public.kta_drafts where state_id = p_state and actor = a.actor;
  insert into public.kta_activity_log(app, site, page, actor, role, action, detail)
  values (public.kta_app_of(p_state), p_state, 'Simpan', a.label, a.role, 'Mengajukan ' || jsonb_array_length(p_ops) || ' perubahan', p_note);
  return nid;
end $$;

create or replace function public.kta_cr_mine(p_state text, p_token text default null)
returns setof public.kta_change_requests language plpgsql stable security definer set search_path = public as $$
declare a record;
begin
  select * into a from public.kta_actor(p_state, p_token);
  return query select * from public.kta_change_requests r where r.state_id = p_state and r.actor = a.actor
    and (r.status = 'pending' or r.created_at > now() - interval '30 days') order by r.created_at desc limit 50;
end $$;

create or replace function public.kta_cr_cancel(p_id uuid, p_token text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r record; a record;
begin
  select * into r from public.kta_change_requests where id = p_id;
  if not found then raise exception 'Usulan tidak ditemukan'; end if;
  select * into a from public.kta_actor(r.state_id, p_token);
  if r.actor <> a.actor then raise exception 'Bukan usulan Anda'; end if;
  update public.kta_change_requests set status = 'cancelled', decided_at = now(), decided_by = a.label where id = p_id and status = 'pending';
end $$;

-- ---------- riwayat ----------
create table if not exists public.kta_change_history (
  id bigserial primary key,
  app_id text not null,
  state_id text not null,
  at timestamptz not null default now(),
  actor text,
  role text,
  action text not null,           -- simpan | setujui | tolak | kembalikan | pulihkan
  request_id uuid,
  request_actor text,
  request_kind text,
  ops jsonb not null default '[]',
  note text
);
create index if not exists kta_hist_state_at on public.kta_change_history(state_id, at desc);
alter table public.kta_change_history enable row level security;
drop policy if exists "history approver read" on public.kta_change_history;
create policy "history approver read" on public.kta_change_history for select to authenticated using (public.kta_is_approver(app_id));

-- dicatat oleh siapa pun yang menulis langsung (Pemilik/PIC; editor & link editor hanya saat persetujuan MATI)
create or replace function public.kta_hist_add(p_state text, p_action text, p_ops jsonb, p_note text default null, p_token text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare a record; app text := public.kta_app_of(p_state); nid bigint;
begin
  select * into a from public.kta_actor(p_state, p_token);
  if a.role = 'editor' and public.kta_approval_on(app) then raise exception 'Perlu persetujuan'; end if;
  if p_action not in ('simpan','kembalikan','pulihkan') then raise exception 'Aksi tidak dikenal'; end if;
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) = 0 then return null; end if;
  insert into public.kta_change_history(app_id, state_id, actor, role, action, ops, note)
  values (app, p_state, a.label, a.role, p_action, p_ops, p_note) returning id into nid;
  return nid;
end $$;

-- Pemilik/PIC memutuskan usulan. Data sudah ditulis oleh browser penyetuju (digabung ke data terbaru) sebelum fungsi ini dipanggil.
create or replace function public.kta_cr_decide(p_id uuid, p_status text, p_applied jsonb, p_rejected jsonb, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r record; who text := lower(coalesce(auth.jwt()->>'email','')); rl text;
begin
  select * into r from public.kta_change_requests where id = p_id for update;
  if not found then raise exception 'Usulan tidak ditemukan'; end if;
  if not public.kta_is_approver(r.app_id) then raise exception 'Hanya Pemilik atau PIC'; end if;
  if r.status <> 'pending' then raise exception 'Usulan sudah diputuskan'; end if;
  if p_status not in ('approved','partial','rejected') then raise exception 'Status tidak dikenal'; end if;
  rl := case when public.kta_web_role_for(r.app_id) = 'owner' then 'owner' else 'pic' end;
  update public.kta_change_requests set status = p_status, decided_by = who, decided_at = now(), decided_note = nullif(trim(coalesce(p_note,'')),'') where id = p_id;
  if p_applied is not null and jsonb_typeof(p_applied) = 'array' and jsonb_array_length(p_applied) > 0 then
    insert into public.kta_change_history(app_id, state_id, actor, role, action, request_id, request_actor, request_kind, ops, note)
    values (r.app_id, r.state_id, who, rl, 'setujui', r.id, r.actor_label, r.kind, p_applied, p_note);
  end if;
  if p_rejected is not null and jsonb_typeof(p_rejected) = 'array' and jsonb_array_length(p_rejected) > 0 then
    insert into public.kta_change_history(app_id, state_id, actor, role, action, request_id, request_actor, request_kind, ops, note)
    values (r.app_id, r.state_id, who, rl, 'tolak', r.id, r.actor_label, r.kind, p_rejected, p_note);
  end if;
  insert into public.kta_activity_log(app, site, page, actor, role, action, detail)
  values (r.app_id, r.state_id, 'Persetujuan', who, rl,
          case p_status when 'rejected' then 'Menolak usulan ' else 'Menyetujui usulan ' end || coalesce(r.actor_label,''), p_note);
end $$;

-- ---------- laporan otomatis: draf yang ditinggal lebih dari X menit ----------
create or replace function public.kta_drafts_autoreport() returns int
language plpgsql security definer set search_path = public as $$
declare d record; n int := 0;
begin
  for d in select k.* from public.kta_drafts k join public.kta_approval_settings s on s.app_id = k.app_id
           where s.enabled and jsonb_array_length(k.ops) > 0 and k.updated_at < now() - make_interval(mins => s.auto_minutes)
           for update of k skip locked loop
    insert into public.kta_change_requests(app_id, state_id, actor, actor_label, kind, base_ver, ops, note, last_activity)
    values (d.app_id, d.state_id, d.actor, d.actor_label, 'otomatis', d.base_ver, d.ops, null, d.updated_at);
    delete from public.kta_drafts where state_id = d.state_id and actor = d.actor;
    insert into public.kta_activity_log(app, site, page, actor, role, action, detail)
    values (d.app_id, d.state_id, 'Simpan', d.actor_label, 'editor', 'Laporan otomatis: lupa simpan (' || jsonb_array_length(d.ops) || ' perubahan)', null);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------- salinan lengkap harian ----------
create table if not exists public.kta_state_snapshots (
  state_id text not null,
  day date not null,
  data jsonb not null,
  data_updated_at timestamptz,
  taken_at timestamptz not null default now(),
  primary key (state_id, day)
);
alter table public.kta_state_snapshots enable row level security;
drop policy if exists "snapshots approver read" on public.kta_state_snapshots;
create policy "snapshots approver read" on public.kta_state_snapshots for select to authenticated
  using (public.kta_is_approver(public.kta_app_of(state_id)));

create or replace function public.kta_snapshot_daily() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.kta_state_snapshots(state_id, day, data, data_updated_at)
  select id, (now() at time zone 'Asia/Jakarta')::date, data, updated_at from public.kta_web_state
  on conflict (state_id, day) do update set data = excluded.data, data_updated_at = excluded.data_updated_at, taken_at = now();
  get diagnostics n = row_count; return n;
end $$;
select public.kta_snapshot_daily();

revoke all on function public.kta_drafts_autoreport() from public, anon, authenticated;
revoke all on function public.kta_snapshot_daily() from public, anon, authenticated;
grant execute on function public.kta_draft_put(text, timestamptz, jsonb, text) to anon, authenticated;
grant execute on function public.kta_draft_get(text, text) to anon, authenticated;
grant execute on function public.kta_cr_submit(text, timestamptz, jsonb, text, text) to anon, authenticated;
grant execute on function public.kta_cr_mine(text, text) to anon, authenticated;
grant execute on function public.kta_cr_cancel(uuid, text) to anon, authenticated;
grant execute on function public.kta_hist_add(text, text, jsonb, text, text) to anon, authenticated;
grant execute on function public.kta_cr_decide(uuid, text, jsonb, jsonb, text) to authenticated;

-- ---------- jadwal (pg_cron) ----------
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname in ('kta-drafts-autoreport','kta-snapshot-daily');
select cron.schedule('kta-drafts-autoreport', '*/5 * * * *', $$select public.kta_drafts_autoreport()$$);
select cron.schedule('kta-snapshot-daily', '1 17 * * *', $$select public.kta_snapshot_daily()$$);  -- 00:01 WIB

-- ---------- info untuk tampilan web (dipakai juga oleh link editor tanpa login) ----------
create or replace function public.kta_approval_info(p_state text, p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare app text := public.kta_app_of(p_state); s record; appr boolean := false; rl text := 'viewer';
begin
  select * into s from public.kta_approval_settings where app_id = app;
  if p_token is not null and p_token <> '' then
    if exists(select 1 from public.monitoring_guest_links g where g.token=p_token and not g.revoked and g.expires_at>now() and g.app_id=app)
      then rl := 'link'; end if;
  else
    rl := public.kta_web_role_for(app);
    appr := public.kta_is_approver(app);
  end if;
  return jsonb_build_object('enabled', coalesce(s.enabled,false), 'auto_minutes', coalesce(s.auto_minutes,30),
    'approver', appr, 'role', rl,
    'pending', case when appr then (select count(*) from public.kta_change_requests r where r.state_id = p_state and r.status = 'pending') else null end);
end $$;
grant execute on function public.kta_approval_info(text, text) to anon, authenticated;
