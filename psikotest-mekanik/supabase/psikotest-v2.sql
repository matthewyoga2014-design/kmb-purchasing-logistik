-- Psikotest Mekanik v2: mode waktu, pengawasan (kamera/tab/fullscreen), sinkron Google Drive.
-- Jalankan SEKALI di Supabase > SQL Editor > New query > Run (bila belum dijalankan oleh Claude).

delete from public.pk_sessions where token='testtoken__123';
delete from public.pk_modules where code='__test__';

alter table public.pk_questions add column if not exists time_sec int check (time_sec is null or time_sec between 5 and 3600);
alter table public.pk_sessions
  add column if not exists timer_mode text not null default 'total' check (timer_mode in ('total','per_soal','custom')),
  add column if not exists per_q_sec int not null default 60 check (per_q_sec between 5 and 3600),
  add column if not exists total_min int check (total_min is null or total_min between 1 and 600),
  add column if not exists proctor jsonb not null default '{}'::jsonb;
alter table public.pk_attempts
  add column if not exists q_order uuid[],
  add column if not exists cur_index int not null default 0,
  add column if not exists cur_deadline timestamptz,
  add column if not exists violations int not null default 0,
  add column if not exists events jsonb not null default '[]'::jsonb,
  add column if not exists device_id text;

create table if not exists public.pk_secrets(id int primary key default 1 check (id=1),
  sync_secret text not null default replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''));
insert into public.pk_secrets(id) values (1) on conflict do nothing;
alter table public.pk_secrets enable row level security;
revoke all on public.pk_secrets from anon, authenticated;

create or replace function public.pk_can_edit() returns boolean language sql stable set search_path=public as $$ select public.pk_role() in ('owner','editor') $$;
create or replace function public.pk_can_view() returns boolean language sql stable set search_path=public as $$ select public.pk_role() in ('owner','editor','viewer') $$;

create or replace function public.pk_qdur(p_mode text, p_per int, p_qtime int) returns int language sql immutable set search_path=public as $$
  select case when p_mode='custom' then coalesce(p_qtime,p_per) else p_per end $$;

create or replace function public.pk__advance(p_attempt uuid, s public.pk_sessions) returns public.pk_attempts language plpgsql security definer set search_path=public as $$
declare a pk_attempts; n int; qt int;
begin
  select * into a from pk_attempts where id=p_attempt for update;
  if a.submitted_at is not null then return a; end if;
  n := coalesce(array_length(a.q_order,1),0);
  if s.timer_mode <> 'total' then
    while a.cur_index < n and now() > a.cur_deadline + interval '3 seconds' loop
      a.cur_index := a.cur_index + 1;
      if a.cur_index < n then
        select time_sec into qt from pk_questions where id=a.q_order[a.cur_index+1];
        a.cur_deadline := a.cur_deadline + make_interval(secs=>pk_qdur(s.timer_mode,s.per_q_sec,qt));
      end if;
    end loop;
    update pk_attempts set cur_index=a.cur_index, cur_deadline=a.cur_deadline where id=a.id;
    if a.cur_index >= n then perform pk_score_attempt(a.id); select * into a from pk_attempts where id=p_attempt; return a; end if;
  elsif now() > a.deadline + interval '30 seconds' then
    update pk_attempts set late=true where id=a.id; perform pk_score_attempt(a.id);
    select * into a from pk_attempts where id=p_attempt;
  end if;
  return a;
end $$;

create or replace function public.pk__qobj(p_q uuid) returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('id',q.id,'no',q.no,'text',q.text,'image',q.image,'options',q.options) from pk_questions q where q.id=p_q $$;

create or replace function public.pk__payload(s public.pk_sessions, m public.pk_modules, a public.pk_attempts) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare base jsonb;
begin
  if a.submitted_at is not null then return jsonb_build_object('status','selesai'); end if;
  base := jsonb_build_object('status','berjalan','mode',s.timer_mode,'title',m.title,'deadline',a.deadline,'server_now',now(),
    'proctor',s.proctor,'violations',a.violations,'n',coalesce(array_length(a.q_order,1),0));
  if s.timer_mode='total' then
    return base || jsonb_build_object('answers',a.answers,'questions',
      (select jsonb_agg(pk__qobj(u.qid) order by u.ord) from unnest(a.q_order) with ordinality u(qid,ord)));
  end if;
  return base || jsonb_build_object('index',a.cur_index,'q_deadline',a.cur_deadline,'question',pk__qobj(a.q_order[a.cur_index+1]));
end $$;

drop function if exists public.pk_start_module(text,uuid);
create or replace function public.pk_start_module(p_token text, p_module uuid, p_device text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare s pk_sessions; m pk_modules; a pk_attempts; ord uuid[]; dl timestamptz; cd timestamptz; tot int; qt int; shuf boolean;
begin
  s := pk__session(p_token);
  if not (p_module = any(s.module_ids)) then raise exception 'Sheet ini tidak termasuk dalam tes Anda.'; end if;
  select * into m from pk_modules where id=p_module;
  if not found then raise exception 'Sheet tes ini sudah dihapus. Hubungi HR.'; end if;
  select * into a from pk_attempts where session_id=s.id and module_id=m.id;
  if not found then
    shuf := coalesce((s.proctor->>'shuffle')::boolean, m.shuffle);
    select array_agg(id order by case when shuf then md5(id::text||s.id::text) else lpad(no::text,6,'0')||id::text end) into ord from pk_questions where module_id=m.id;
    if ord is null then raise exception 'Sheet ini belum memiliki soal. Hubungi HR.'; end if;
    if s.timer_mode='total' then
      dl := now()+make_interval(mins=>coalesce(s.total_min,m.duration_min)); cd := null;
    else
      select sum(pk_qdur(s.timer_mode,s.per_q_sec,time_sec)) into tot from pk_questions where module_id=m.id;
      select time_sec into qt from pk_questions where id=ord[1];
      dl := now()+make_interval(secs=>tot); cd := now()+make_interval(secs=>pk_qdur(s.timer_mode,s.per_q_sec,qt));
    end if;
    insert into pk_attempts(session_id,module_id,deadline,q_order,cur_index,cur_deadline,device_id)
      values (s.id,m.id,dl,ord,0,cd,p_device) on conflict (session_id,module_id) do nothing;
    select * into a from pk_attempts where session_id=s.id and module_id=m.id;
  end if;
  if a.q_order is null then
    select array_agg(id order by lpad(no::text,6,'0')||id::text) into ord from pk_questions where module_id=m.id;
    update pk_attempts set q_order=ord where id=a.id; a.q_order := ord;
  end if;
  if a.submitted_at is null and a.device_id is not null and p_device is not null and a.device_id<>p_device then
    raise exception 'Tes ini sudah dibuka di perangkat lain. Hubungi HR untuk mengizinkan perangkat ini.';
  end if;
  if a.device_id is null and p_device is not null then update pk_attempts set device_id=p_device where id=a.id; end if;
  a := pk__advance(a.id, s);
  return pk__payload(s,m,a);
end $$;

create or replace function public.pk_answer_q(p_token text, p_module uuid, p_qid uuid, p_answer text, p_device text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare s pk_sessions; m pk_modules; a pk_attempts; ans jsonb; idx int; n int; qt int;
begin
  s := pk__session(p_token);
  select * into m from pk_modules where id=p_module;
  select * into a from pk_attempts where session_id=s.id and module_id=p_module;
  if not found then raise exception 'Sheet belum dimulai.'; end if;
  if a.submitted_at is null and a.device_id is not null and p_device is not null and a.device_id<>p_device then
    raise exception 'Tes ini sudah dibuka di perangkat lain. Hubungi HR.'; end if;
  a := pk__advance(a.id, s);
  if a.submitted_at is null and s.timer_mode<>'total' and a.q_order[a.cur_index+1]=p_qid then
    ans := case when coalesce(p_answer,'')='' then a.answers else a.answers || jsonb_build_object(p_qid::text, lower(p_answer)) end;
    idx := a.cur_index+1; n := array_length(a.q_order,1);
    if idx >= n then
      update pk_attempts set answers=ans, cur_index=idx where id=a.id;
      perform pk_score_attempt(a.id);
    else
      select time_sec into qt from pk_questions where id=a.q_order[idx+1];
      update pk_attempts set answers=ans, cur_index=idx, cur_deadline=now()+make_interval(secs=>pk_qdur(s.timer_mode,s.per_q_sec,qt)) where id=a.id;
    end if;
    select * into a from pk_attempts where id=a.id;
  end if;
  return pk__payload(s,m,a);
end $$;

create or replace function public.pk_log_event(p_token text, p_module uuid, p_type text, p_detail text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare s pk_sessions; a pk_attempts; lim int;
begin
  s := pk__session(p_token);
  update pk_attempts set events = events || jsonb_build_array(jsonb_build_object('t',now(),'type',left(p_type,30),'d',left(coalesce(p_detail,''),500))),
    violations = violations + case when p_type in ('tab','fullscreen','kamera') and submitted_at is null then 1 else 0 end
   where session_id=s.id and module_id=p_module returning * into a;
  if not found then return null; end if;
  lim := coalesce(nullif(s.proctor->>'tabLimit','')::int,0);
  if a.submitted_at is null and lim>0 and a.violations>lim then
    perform pk_score_attempt(a.id);
    update pk_attempts set events = events || jsonb_build_array(jsonb_build_object('t',now(),'type','auto-kirim','d','Melebihi batas pelanggaran')) where id=a.id;
    return jsonb_build_object('violations',a.violations,'limit',lim,'submitted',true);
  end if;
  return jsonb_build_object('violations',a.violations,'limit',lim,'submitted',a.submitted_at is not null);
end $$;

create or replace function public.pk_photo_ok(p_token text) returns jsonb language plpgsql security definer set search_path=public as $$
declare s pk_sessions;
begin s := pk__session(p_token); return jsonb_build_object('nama',s.nama,'nik',s.nik,'sid',left(s.id::text,8)); end $$;

create or replace function public.pk_get_session(p_token text) returns jsonb language plpgsql security definer set search_path=public as $$
declare s pk_sessions;
begin
  s := pk__session(p_token);
  perform pk_finalize_expired(s.id);
  return jsonb_build_object('nama',s.nama,'nik',s.nik,'posisi',s.posisi,'level',s.level,'jenis',s.jenis,'jobsite',s.jobsite,
    'server_now',now(),'expires_at',s.expires_at,'timer_mode',s.timer_mode,'per_q_sec',s.per_q_sec,'proctor',s.proctor,
    'gas_url',(select data->>'gasUrl' from pk_settings where id=1),
    'modules',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'description',m.description,
        'n',(select count(*) from pk_questions q where q.module_id=m.id),
        'dur_sec',case when s.timer_mode='total' then coalesce(s.total_min,m.duration_min)*60
                  else (select coalesce(sum(pk_qdur(s.timer_mode,s.per_q_sec,q.time_sec)),0) from pk_questions q where q.module_id=m.id) end,
        'status',case when a.submitted_at is not null then 'selesai' when a.id is not null then 'berjalan' else 'belum' end) order by u.ord)
      from unnest(s.module_ids) with ordinality u(mid,ord) join pk_modules m on m.id=u.mid
      left join pk_attempts a on a.session_id=s.id and a.module_id=m.id),'[]'::jsonb));
end $$;

create or replace function public.pk_finalize_expired(p_session uuid) returns void language plpgsql security definer set search_path=public as $$
declare r record; s pk_sessions;
begin
  select * into s from pk_sessions where id=p_session;
  for r in select id from pk_attempts where session_id=p_session and submitted_at is null loop
    perform pk__advance(r.id, s);
  end loop;
end $$;

create or replace function public.pk_export(p_secret text) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if p_secret is null or p_secret <> (select sync_secret from pk_secrets where id=1) then raise exception 'Kunci sinkron salah.'; end if;
  return jsonb_build_object('settings',(select data from pk_settings where id=1),
    'modules',(select coalesce(jsonb_agg(to_jsonb(m) order by m.sort),'[]') from pk_modules m),
    'sessions',(select coalesce(jsonb_agg(to_jsonb(s)-'token' order by s.created_at),'[]') from pk_sessions s),
    'attempts',(select coalesce(jsonb_agg(to_jsonb(a)-'answers'-'q_order'),'[]') from pk_attempts a));
end $$;

create or replace function public.pk_get_secret() returns text language plpgsql security definer set search_path=public as $$
begin if pk_role()<>'owner' then raise exception 'Hanya Pemilik.'; end if; return (select sync_secret from pk_secrets where id=1); end $$;

revoke all on function public.pk__advance(uuid,public.pk_sessions), public.pk__payload(public.pk_sessions,public.pk_modules,public.pk_attempts), public.pk__qobj(uuid), public.pk_finalize_expired(uuid) from public, anon, authenticated;
grant execute on function public.pk_start_module(text,uuid,text), public.pk_answer_q(text,uuid,uuid,text,text), public.pk_log_event(text,uuid,text,text),
  public.pk_photo_ok(text), public.pk_get_session(text), public.pk_export(text) to anon, authenticated;
grant execute on function public.pk_get_secret() to authenticated;
