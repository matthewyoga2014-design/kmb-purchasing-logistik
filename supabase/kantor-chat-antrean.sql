-- Kantor Monitoring: chat lewat antrean Manager (tanpa API key).
-- Pesan chat disimpan sebagai permintaan (office_requests.thread_id). Manager terjadwal
-- (Claude langganan Pemilik) mengerjakannya; saat permintaan selesai / butuh persetujuan,
-- jawabannya otomatis ditulis ke riwayat chat yang sama.

alter table public.office_requests add column if not exists thread_id uuid references public.office_threads(id) on delete set null;

create or replace function public.office_chat_queue(p_thread uuid, p_text text, p_files jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t uuid := p_thread; rid bigint; txt text := left(trim(coalesce(p_text, '')), 12000); f jsonb := coalesce(p_files, '[]'::jsonb); note text;
begin
  if not public.office_is_owner() then raise exception 'Hanya Pemilik.'; end if;
  if txt = '' and jsonb_array_length(f) = 0 then raise exception 'Pesan kosong'; end if;
  if t is not null and not exists (select 1 from office_threads where id = t) then t := null; end if;
  if t is null then
    insert into office_threads(title) values (left(coalesce(nullif(txt, ''), f->0->>'name', 'Chat baru'), 60)) returning id into t;
  else
    update office_threads set updated_at = now() where id = t;
  end if;
  insert into office_messages(thread_id, role, content, files) values (t, 'user', txt, f);
  select string_agg(x->>'name', ', ') into note from jsonb_array_elements(f) x;
  insert into office_requests(text, files, thread_id)
    values ('[Dari chat Kantor] ' || coalesce(nullif(txt, ''), '(lihat lampiran)') || coalesce(E'\n[Lampiran: ' || note || ']', ''), f, t)
    returning id into rid;
  return jsonb_build_object('thread_id', t, 'request_id', rid);
end $$;
grant execute on function public.office_chat_queue(uuid, text, jsonb) to authenticated;

create or replace function public.office_request_reply()
returns trigger language plpgsql security definer set search_path = public as $$
declare body text; j record;
begin
  if new.thread_id is null or new.status is not distinct from old.status
     or new.status not in ('selesai', 'butuh_persetujuan') then return new; end if;
  body := case when new.status = 'selesai' then '### Jawaban Manager' else '### Sebagian menunggu persetujuanmu' end
          || coalesce(E'\n' || nullif(trim(new.manager_note), ''), '');
  for j in select * from office_jobs where request_id = new.id order by id loop
    body := body || E'\n\n**' || j.title || '** · ' || j.division || E'\n'
      || case when j.status = 'butuh_persetujuan' then '⏳ Usulan (setujui/tolak di meja Manager): ' || left(coalesce(j.proposal, '-'), 2500)
              when j.status = 'ditolak' then '✖ Ditolak.'
              else left(coalesce(j.result, '(tanpa hasil)'), 3500) end;
  end loop;
  insert into office_messages(thread_id, role, content) values (new.thread_id, 'assistant', left(body, 14000));
  update office_threads set updated_at = now() where id = new.thread_id;
  return new;
end $$;

drop trigger if exists office_request_reply on public.office_requests;
create trigger office_request_reply after update of status on public.office_requests
  for each row execute function public.office_request_reply();
