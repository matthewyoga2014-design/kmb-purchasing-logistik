alter table public.pk_questions add column if not exists image_id text;
alter table public.pk_sessions add column if not exists drive jsonb;
alter table public.pk_kinerja add column if not exists drive jsonb;
alter table public.pk_links add column if not exists email text;

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
      if NEW.image is distinct from OLD.image and not (NEW.image is null and NEW.image_id is not null) then perform pk_log_add('Ubah gambar soal', mt||' no. '||NEW.no, null); end if;
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
    elsif (to_jsonb(NEW)-'drive'-'updated_at') is distinct from (to_jsonb(OLD)-'drive'-'updated_at') then perform pk_log_add('Ubah penilaian kinerja', NEW.nama, jsonb_build_object('skor_lama',OLD.skor,'skor_baru',NEW.skor)); end if;
  end if;
  return null;
exception when others then
  raise warning 'pk_tg_log: %', sqlerrm;
  return null;
end $$;


create or replace function public.pk__qobj(p_q uuid) returns jsonb language sql stable security definer set search_path to 'public' as $f$
  select jsonb_build_object('id',q.id,'no',q.no,'text',q.text,'image',q.image,'image_id',q.image_id,'options',q.options) from pk_questions q where q.id=p_q $f$;

-- Apps Script: ambil gambar soal yang belum dipindah ke Drive (sedikit-sedikit)
create or replace function public.pk_drive_images(p_secret text, p_limit int default 15) returns jsonb
language plpgsql security definer set search_path=public as $f$
begin
  if p_secret is null or p_secret <> (select sync_secret from pk_secrets where id=1) then raise exception 'Kunci sinkron salah.'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'no',q.no,'title',m.title,'grade',m.grade,'image',q.image)),'[]'::jsonb)
    from (select * from pk_questions where image like 'data:image/%' and image_id is null order by module_id, no limit greatest(1,least(p_limit,40))) q join pk_modules m on m.id=q.module_id);
end $f$;

-- Apps Script: laporkan ID file Drive (gambar soal, PDF hasil tes, PDF penilaian kinerja)
create or replace function public.pk_drive_report(p_secret text, p jsonb) returns jsonb
language plpgsql security definer set search_path=public as $f$
declare x jsonb; n int := 0;
begin
  if p_secret is null or p_secret <> (select sync_secret from pk_secrets where id=1) then raise exception 'Kunci sinkron salah.'; end if;
  for x in select * from jsonb_array_elements(coalesce(p->'questions','[]')) loop
    update pk_questions set image_id=x->>'file', image=null where id=(x->>'id')::uuid and image_id is null and x->>'file' ~ '^[A-Za-z0-9_-]{20,}$'; n := n+1; end loop;
  for x in select * from jsonb_array_elements(coalesce(p->'sessions','[]')) loop
    update pk_sessions set drive=x->'drive' where id=(x->>'id')::uuid and drive is distinct from x->'drive'; end loop;
  for x in select * from jsonb_array_elements(coalesce(p->'kinerja','[]')) loop
    update pk_kinerja set drive=x->'drive' where id=(x->>'id')::uuid and drive is distinct from x->'drive'; end loop;
  return jsonb_build_object('ok',true,'questions',n);
end $f$;

-- Apps Script: gambar soal yang masih dipakai + email Editor untuk berbagi file per berkas
create or replace function public.pk_drive_refs(p_secret text) returns jsonb
language plpgsql security definer set search_path=public as $f$
begin
  if p_secret is null or p_secret <> (select sync_secret from pk_secrets where id=1) then raise exception 'Kunci sinkron salah.'; end if;
  return jsonb_build_object(
    'images',(select coalesce(jsonb_agg(image_id),'[]') from pk_questions where image_id is not null),
    'editors',(select coalesce(jsonb_agg(distinct lower(e)),'[]') from (
       select email e from pk_links where role='editor' and not revoked and email like '%@%'
       union select email::text from app_access_roles where app_id='psikotest' and role='editor') z));
end $f$;
revoke all on function public.pk_drive_images(text,int), public.pk_drive_report(text,jsonb), public.pk_drive_refs(text) from public;
grant execute on function public.pk_drive_images(text,int), public.pk_drive_report(text,jsonb), public.pk_drive_refs(text) to anon, authenticated;
