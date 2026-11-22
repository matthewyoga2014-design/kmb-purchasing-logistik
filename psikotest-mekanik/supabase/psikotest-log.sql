-- Catatan aktivitas (audit log) Psikotest — hanya Pemilik yang bisa membaca
create table if not exists public.pk_log(
  id bigserial primary key, at timestamptz not null default now(),
  actor text, role text, action text not null, target text, detail jsonb);
create index if not exists pk_log_at on public.pk_log(at desc);
alter table public.pk_log enable row level security;
drop policy if exists pk_log_owner on public.pk_log;
create policy pk_log_owner on public.pk_log for select to anon, authenticated using (public.pk_role()='owner');
revoke insert, update, delete on public.pk_log from anon, authenticated;

create or replace function public.pk_log_add(a text, t text, d jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare e text; r text; h text; l record; who text; rl text;
begin
  e := auth.jwt()->>'email';
  if e is not null and e<>'' then
    select x.role into r from app_access_roles x where x.app_id='psikotest' and lower(x.email::text)=lower(e) limit 1;
    if r='owner' then who:='Pemilik'; rl:='owner';
    else who:=coalesce(initcap(r),'Pengguna')||' · '||e; rl:=coalesce(r,'user'); end if;
  else
    h := pk_link_token();
    if h is not null then select * into l from pk_links where token=h; end if;
    if l.token is not null then who:=(case when l.role='editor' then 'Editor (link)' else 'Viewer (link)' end)||coalesce(' · '||nullif(l.label,''),''); rl:=l.role;
    else who:='Sistem / peserta'; rl:='system'; end if;
  end if;
  insert into pk_log(actor,role,action,target,detail) values(who,rl,a,t,d);
end $$;
revoke all on function public.pk_log_add(text,text,jsonb) from public, anon, authenticated;

create or replace function public.pk_tg_log() returns trigger
language plpgsql security definer set search_path=public as $$
declare mt text; ch jsonb := '{}'::jsonb; k text; o jsonb; n jsonb;
begin
  if TG_TABLE_NAME='pk_sessions' then
    if TG_OP='INSERT' then perform pk_log_add('Buat link tes', NEW.nama, jsonb_build_object('grade',NEW.grade_target,'jenis',NEW.jenis,'sheet',coalesce(array_length(NEW.module_ids,1),0)));
    elsif TG_OP='DELETE' then perform pk_log_add('Hapus hasil / link tes', OLD.nama, jsonb_build_object('grade',OLD.grade_target,'jenis',OLD.jenis,'dibuat',OLD.created_at));
    else
      if NEW.keputusan is distinct from OLD.keputusan then perform pk_log_add('Ubah keputusan akhir', NEW.nama, jsonb_build_object('dari',OLD.keputusan,'ke',NEW.keputusan)); end if;
      if NEW.expires_at is distinct from OLD.expires_at then perform pk_log_add('Ubah masa berlaku link', NEW.nama, jsonb_build_object('dari',OLD.expires_at,'ke',NEW.expires_at)); end if;
      if NEW.nama is distinct from OLD.nama or NEW.nik is distinct from OLD.nik then perform pk_log_add('Ubah data peserta', NEW.nama, jsonb_build_object('nama_lama',OLD.nama)); end if;
    end if;
  elsif TG_TABLE_NAME='pk_modules' then
    if TG_OP='INSERT' then perform pk_log_add('Tambah sheet soal', NEW.title, jsonb_build_object('grade',NEW.grade,'level',NEW.level));
    elsif TG_OP='DELETE' then perform pk_log_add('Hapus sheet soal', OLD.title, jsonb_build_object('grade',OLD.grade,'level',OLD.level));
    else
      o := to_jsonb(OLD) - 'sort' - 'updated_at'; n := to_jsonb(NEW) - 'sort' - 'updated_at';
      for k in select jsonb_object_keys(n) loop
        if o->k is distinct from n->k then ch := ch || jsonb_build_object(k, jsonb_build_array(o->k, n->k)); end if;
      end loop;
      if ch <> '{}'::jsonb then perform pk_log_add('Ubah sheet soal', NEW.title, ch); end if;
    end if;
  elsif TG_TABLE_NAME='pk_questions' then
    select title into mt from pk_modules where id=coalesce(NEW.module_id,OLD.module_id);
    if TG_OP='INSERT' then
      if exists(select 1 from pk_modules where id=NEW.module_id and created_at < now()-interval '15 minutes') then
        perform pk_log_add('Tambah soal', mt||' no. '||NEW.no, jsonb_build_object('soal',left(NEW.text,160),'kunci',NEW.answer)); end if;
    elsif TG_OP='DELETE' then
      if mt is not null then perform pk_log_add('Hapus soal', mt||' no. '||OLD.no, jsonb_build_object('soal',left(OLD.text,160))); end if;
    else
      if NEW.answer is distinct from OLD.answer then perform pk_log_add('Ubah kunci jawaban', mt||' no. '||NEW.no, jsonb_build_object('dari',upper(OLD.answer),'ke',upper(NEW.answer),'soal',left(NEW.text,160))); end if;
      if NEW.text is distinct from OLD.text or NEW.options is distinct from OLD.options then perform pk_log_add('Ubah isi soal', mt||' no. '||NEW.no, jsonb_build_object('soal_lama',left(OLD.text,160),'soal_baru',left(NEW.text,160))); end if;
      if NEW.image is distinct from OLD.image then perform pk_log_add('Ubah gambar soal', mt||' no. '||NEW.no, null); end if;
    end if;
  elsif TG_TABLE_NAME='pk_attempts' then
    if exists(select 1 from pk_sessions where id=OLD.session_id) then
      select title into mt from pk_modules where id=OLD.module_id;
      perform pk_log_add('Reset sheet tes peserta', (select nama from pk_sessions where id=OLD.session_id), jsonb_build_object('sheet',mt,'nilai_lama',OLD.score)); end if;
  elsif TG_TABLE_NAME='pk_settings' then
    o := OLD.data; n := NEW.data;
    for k in select jsonb_object_keys(coalesce(o,'{}')||coalesce(n,'{}')) loop
      if o->k is distinct from n->k then ch := ch || jsonb_build_object(k, jsonb_build_array(o->k, n->k)); end if;
    end loop;
    if ch ? 'lock' then perform pk_log_add('Ubah kunci web', null, jsonb_build_object('dari',ch->'lock'->0,'ke',ch->'lock'->1)); ch := ch - 'lock'; end if;
    if ch ? 'folderOrder' then perform pk_log_add('Ubah urutan folder Bank Soal', null, null); ch := ch - 'folderOrder'; end if;
    if ch <> '{}'::jsonb then perform pk_log_add('Ubah pengaturan', null, jsonb_build_object('bagian',(select jsonb_agg(x) from jsonb_object_keys(ch) x))); end if;
  elsif TG_TABLE_NAME='pk_links' then
    if TG_OP='INSERT' then perform pk_log_add('Buat link akses '||NEW.role, NEW.label, null);
    elsif TG_OP='DELETE' then perform pk_log_add('Hapus link akses '||OLD.role, OLD.label, null);
    elsif NEW.revoked and not coalesce(OLD.revoked,false) then perform pk_log_add('Cabut link akses '||NEW.role, NEW.label, null);
    elsif not NEW.revoked and coalesce(OLD.revoked,false) then perform pk_log_add('Aktifkan lagi link akses '||NEW.role, NEW.label, null);
    elsif NEW.label is distinct from OLD.label then perform pk_log_add('Ubah nama link akses', NEW.label, jsonb_build_object('dari',OLD.label)); end if;
  elsif TG_TABLE_NAME='pk_kinerja' then
    if TG_OP='INSERT' then perform pk_log_add('Buat penilaian kinerja', NEW.nama, jsonb_build_object('skor',NEW.skor));
    elsif TG_OP='DELETE' then perform pk_log_add('Hapus penilaian kinerja', OLD.nama, jsonb_build_object('skor',OLD.skor));
    else perform pk_log_add('Ubah penilaian kinerja', NEW.nama, jsonb_build_object('skor_lama',OLD.skor,'skor_baru',NEW.skor)); end if;
  end if;
  return null;
exception when others then
  raise warning 'pk_tg_log: %', sqlerrm;
  return null;
end $$;

drop trigger if exists pk_log_sessions on public.pk_sessions;
create trigger pk_log_sessions after insert or update or delete on public.pk_sessions for each row execute function public.pk_tg_log();
drop trigger if exists pk_log_modules on public.pk_modules;
create trigger pk_log_modules after insert or update or delete on public.pk_modules for each row execute function public.pk_tg_log();
drop trigger if exists pk_log_questions on public.pk_questions;
create trigger pk_log_questions after insert or update or delete on public.pk_questions for each row execute function public.pk_tg_log();
drop trigger if exists pk_log_attempts on public.pk_attempts;
create trigger pk_log_attempts after delete on public.pk_attempts for each row execute function public.pk_tg_log();
drop trigger if exists pk_log_settings on public.pk_settings;
create trigger pk_log_settings after update on public.pk_settings for each row execute function public.pk_tg_log();
drop trigger if exists pk_log_links on public.pk_links;
create trigger pk_log_links after insert or update or delete on public.pk_links for each row execute function public.pk_tg_log();
drop trigger if exists pk_log_kinerja on public.pk_kinerja;
create trigger pk_log_kinerja after insert or update or delete on public.pk_kinerja for each row execute function public.pk_tg_log();
