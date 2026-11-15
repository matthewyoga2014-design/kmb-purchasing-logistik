-- =====================================================================
-- VERSI FINAL & PERSETUJUAN PEMILIK (bagian 1: tabel + pembanding data)
-- Editor tetap bekerja seperti biasa di tabel kerja (kta_web_state, kta_mp_private, apd_state).
-- mg_final menyimpan versi final (yang sudah disetujui Pemilik). Pelihat & link Pelihat membaca versi final.
-- Semua tabel mg_* tertutup RLS tanpa policy: hanya bisa diakses lewat fungsi di bawah.
-- =====================================================================

create table if not exists public.mg_final (
  tbl text not null, rkey text not null, grp text not null,
  data jsonb, existed boolean not null default true,
  updated_at timestamptz not null default now(), updated_by text,
  primary key (tbl, rkey));
create index if not exists mg_final_grp on public.mg_final(grp);

create table if not exists public.mg_final_history (
  id bigserial primary key, tbl text not null, rkey text not null, grp text not null,
  data jsonb, existed boolean not null, saved_at timestamptz not null default now(), saved_by text, kind text not null);
create index if not exists mg_hist_row on public.mg_final_history(tbl, rkey, id desc);
create index if not exists mg_hist_grp on public.mg_final_history(grp, id desc);

create table if not exists public.mg_drafts (
  grp text primary key, editors text[] not null default '{}', first_at timestamptz, last_at timestamptz, submitted_at timestamptz);

create table if not exists public.mg_reports (
  id bigserial primary key, grp text not null, seq int not null, code text not null,
  editors text[] not null default '{}', note text, auto boolean not null default false,
  status text not null default 'menunggu' check (status in ('menunggu','selesai','digantikan','dikembalikan')),
  created_at timestamptz not null default now(), token text not null,
  decided_at timestamptz, decided_by text, replaced_by bigint, replaces text,
  n_items int not null default 0, wa_sent_at timestamptz, wa_done_sent_at timestamptz, wa_tries int not null default 0);
create index if not exists mg_reports_grp on public.mg_reports(grp, id desc);

create table if not exists public.mg_report_items (
  id bigserial primary key, report_id bigint not null references public.mg_reports(id) on delete cascade,
  tbl text not null, rkey text not null, steps jsonb not null, kind text not null, label text not null, detail text,
  before jsonb, after jsonb, ord int not null default 0,
  decision text check (decision in ('setuju','tolak','dibatalkan')), decided_at timestamptz, decided_via text);
create index if not exists mg_items_report on public.mg_report_items(report_id);

create table if not exists public.mg_login_log (
  id bigserial primary key, at timestamptz not null default now(), email text, event text not null,
  ip text, ua text, page text, known text, alert text, alerted boolean not null default false);
create index if not exists mg_login_at on public.mg_login_log(at desc);
create index if not exists mg_login_email on public.mg_login_log(email, at desc);

create table if not exists public.mg_wa_outbox (
  id bigserial primary key, at timestamptz not null default now(), kind text, ref text,
  message text, ok boolean, response text);

alter table public.mg_final enable row level security;
alter table public.mg_final_history enable row level security;
alter table public.mg_drafts enable row level security;
alter table public.mg_reports enable row level security;
alter table public.mg_report_items enable row level security;
alter table public.mg_login_log enable row level security;
alter table public.mg_wa_outbox enable row level security;
revoke all on public.mg_final, public.mg_final_history, public.mg_drafts, public.mg_reports, public.mg_report_items, public.mg_login_log, public.mg_wa_outbox from anon, authenticated;

-- ---------- nama portal / subportal ----------
create or replace function public.mg_grp(t text, k text) returns text language sql immutable set search_path = public as $$
  select case t when 'apd_state' then 'apd'
                when 'kta_web_state' then public.kta_app_of(k)
                when 'kta_mp_private' then public.kta_app_of(split_part(k, '|', 1)) end;
$$;

create or replace function public.mg_portal(g text) returns text language sql immutable as $$
  select case g when 'kta-tra' then 'Manpower KTA-TRA' when 'kmb' then 'Manpower KMB' when 'bupr-ampah' then 'Manpower BUPR Ampah'
    when 'mbj' then 'Manpower MBJ' when 'apd' then 'Monitoring APD' when 'unit-monitoring' then 'Monitoring Unit' when 'notulensi' then 'Notulensi' else g end;
$$;

create or replace function public.mg_prefix(g text) returns text language sql immutable as $$
  select case g when 'kta-tra' then 'KTA' when 'kmb' then 'KMB' when 'bupr-ampah' then 'BUPR' when 'mbj' then 'MBJ' when 'apd' then 'APD'
    when 'unit-monitoring' then 'UNIT' when 'notulensi' then 'NOT' else upper(left(g, 4)) end;
$$;

create or replace function public.mg_site(t text, k text) returns text language sql immutable as $$
  select case when t = 'apd_state' then 'APD'
    else (case split_part(k, '|', 1) when 'main' then 'KTA-TRA' when 'bupr' then 'BUPR Ampah' when 'mbj' then 'MBJ'
      when 'kmb-c4' then 'C4' when 'kmb-slr-maintenance' then 'SLR - Maintenance' when 'kmb-slr-rekondisi' then 'SLR - Rekondisi'
      when 'kmb-workshop' then 'Workshop Legok' else split_part(k, '|', 1) end) end;
$$;

-- ---------- pembanding ----------
create or replace function public.mg_nk(x text) returns text language sql immutable as $$
  select lower(regexp_replace(coalesce(x, ''), '[^A-Za-z]', '', 'g'));
$$;

create or replace function public.mg_ekey(e jsonb, p_by text) returns text language sql immutable as $$
  select case p_by
    when 'pos' then coalesce(e->>'uid', 'n' || coalesce(e->>'no', ''))
    when 'name' then public.mg_nk(e->>'name')
    when 'nama' then public.mg_nk(e->>'nama')
    when 'unit' then coalesce(e->>'unit', '')
    else coalesce(e->>'id', e->>'code', '') end;
$$;

create or replace function public.mg_find(arr jsonb, p_by text, p_id text) returns int language sql immutable as $$
  select (o - 1)::int from jsonb_array_elements(case when jsonb_typeof(arr) = 'array' then arr else '[]'::jsonb end) with ordinality e(v, o)
  where public.mg_ekey(v, p_by) = p_id limit 1;
$$;

create or replace function public.mg_label(k text) returns text language sql immutable as $$
  select case k when 'nama' then 'Nama' when 'name' then 'Nama' when 'jabatan' then 'Jabatan' when 'dept' then 'Departemen' when 'level' then 'Level'
    when 'kontrak' then 'Status Kontrak' when 'masuk' then 'Tgl Masuk' when 'akhir' then 'Akhir Kontrak' when 'poh' then 'POH' when 'jk' then 'Jenis Kelamin'
    when 'kategori' then 'Keterangan' when 'site' then 'Site' when 'pendidikan' then 'Pendidikan' when 'statusData' then 'Verifikasi Data'
    when 'catatanHR' then 'Catatan Kepegawaian' when 'keluar' then 'Tgl Keluar' when 'alasan' then 'Alasan Keluar' when 'section' then 'Section'
    when 'group' then 'Sub-section' when 'ket' then 'Keterangan' when 'pic' then 'PIC' when 'ptk' then 'PTK' when 'aju' then 'Tgl Pengajuan'
    when 'due' then 'Due Date' when 'status' then 'Status' when 'close' then 'Tgl Close' when 'stages' then 'Tahap' when 'stage' then 'Tahap'
    when 'jumlah' then 'Jumlah' when 'unit' then 'Unit' when 'qty' then 'Qty' when 'type' then 'Jenis' when 'date' then 'Tanggal' when 'note' then 'Catatan'
    when 'catatan' then 'Catatan' when 'details' then 'Detail' when 'apply' then 'Tgl Melamar' when 'dates' then 'Tanggal Tahap' when 'files' then 'Berkas'
    when 'sumber' then 'Sumber' when 'scr' then 'Screening' when 'atasan' then 'Atasan' when 'tier' then 'Tier' when 'no' then 'No'
    when 'variant' then 'Ukuran' when 'person' then 'Karyawan' when 'warehouse' then 'Gudang' when 'location' then 'Gudang' else k end;
$$;

create or replace function public.mg_short(v jsonb) returns text language sql immutable as $$
  select case when v is null or v = 'null'::jsonb or v = '""'::jsonb then '—'
    when jsonb_typeof(v) = 'string' then left(regexp_replace(v #>> '{}', '\s+', ' ', 'g'), 50)
    when jsonb_typeof(v) = 'array' then jsonb_array_length(v) || ' isian'
    when jsonb_typeof(v) = 'object' then 'diubah'
    else left(v::text, 50) end;
$$;

create or replace function public.mg_fields(a jsonb, b jsonb, skip text[] default '{}', private boolean default false) returns text
language sql immutable as $$
  select string_agg(case when private then public.mg_label(k) else public.mg_label(k) || ': ' || public.mg_short(a->k) || ' → ' || public.mg_short(b->k) end, '; ' order by k)
  from (select jsonb_object_keys(coalesce(a, '{}')) k union select jsonb_object_keys(coalesce(b, '{}'))) x
  where not (k = any(skip)) and left(k, 1) <> '_' and (a->k) is distinct from (b->k);
$$;

-- daftar objek berkunci → item per anggota
create or replace function public.mg_diff_list(base jsonb, a jsonb, b jsonb, p_by text, p_kind text, p_title text, skip text[] default '{}')
returns table(steps jsonb, kind text, label text, detail text, before jsonb, after jsonb)
language plpgsql immutable as $$
declare k text; x jsonb; y jsonb; nm text;
begin
  for k in select public.mg_ekey(v, p_by) from jsonb_array_elements(case when jsonb_typeof(a)='array' then a else '[]' end) v
           union select public.mg_ekey(v, p_by) from jsonb_array_elements(case when jsonb_typeof(b)='array' then b else '[]' end) v loop
    x := (select v from jsonb_array_elements(case when jsonb_typeof(a)='array' then a else '[]' end) v where public.mg_ekey(v, p_by) = k limit 1);
    y := (select v from jsonb_array_elements(case when jsonb_typeof(b)='array' then b else '[]' end) v where public.mg_ekey(v, p_by) = k limit 1);
    if x is not distinct from y then continue; end if;
    nm := coalesce(y->>'nama', y->>'name', y->>'unit', x->>'nama', x->>'name', x->>'unit', y->>'type', x->>'type', k);
    steps := base || jsonb_build_array(jsonb_build_object('id', k, 'by', p_by)); kind := p_kind; before := x; after := y;
    label := p_title || ': ' || nm;
    detail := case when x is null then 'baru ditambahkan' when y is null then 'dihapus' else public.mg_fields(x, y, skip) end;
    return next;
  end loop;
end $$;

create or replace function public.mg_diff(t text, a jsonb, b jsonb)
returns table(steps jsonb, kind text, label text, detail text, before jsonb, after jsonb, ord int)
language plpgsql immutable set search_path = public as $$
declare k text; pk text; pa jsonb; pb jsonb; pos jsonb; jab text; r record; arr jsonb; sub text;
begin
  if a is not distinct from b then return; end if;
  -- data pribadi karyawan: satu item, isi tidak ditampilkan (hanya nama kolom)
  if t = 'kta_mp_private' then
    steps := '[]'; kind := 'data_pribadi'; before := a; after := b; ord := 50;
    label := 'Data pribadi karyawan: ' || coalesce(b->>'_nama', a->>'_nama', '-');
    detail := case when a is null then 'baru diisi' when b is null then 'dihapus' else 'kolom diubah: ' || coalesce(public.mg_fields(a, b, '{}', true), '-') end;
    return next; return;
  end if;
  if a is null or b is null or jsonb_typeof(a) <> 'object' or jsonb_typeof(b) <> 'object' then
    steps := '[]'; kind := 'lain'; before := a; after := b; ord := 90;
    label := 'Seluruh data ' || public.mg_site(t, ''); detail := case when a is null then 'dibuat' when b is null then 'dihapus' else 'diubah' end;
    return next; return;
  end if;

  for k in select jsonb_object_keys(a) union select jsonb_object_keys(b) loop
    if k = 'meta' or (a->k) is not distinct from (b->k) then continue; end if;
    if t = 'kta_web_state' and k = 'positions' then
      for pk in select public.mg_ekey(v, 'pos') from jsonb_array_elements(coalesce(a->'positions','[]')) v
                union select public.mg_ekey(v, 'pos') from jsonb_array_elements(coalesce(b->'positions','[]')) v loop
        pa := (select v from jsonb_array_elements(coalesce(a->'positions','[]')) v where public.mg_ekey(v,'pos') = pk limit 1);
        pb := (select v from jsonb_array_elements(coalesce(b->'positions','[]')) v where public.mg_ekey(v,'pos') = pk limit 1);
        if pa is not distinct from pb then continue; end if;
        pos := coalesce(pb, pa); jab := 'No.' || coalesce(pos->>'no','?') || ' ' || coalesce(pos->>'jabatan','-');
        if pb is null then
          steps := jsonb_build_array(jsonb_build_object('k','positions'), jsonb_build_object('id',pk,'by','pos'));
          kind := 'mpp'; label := 'MPP: ' || jab; detail := 'posisi dihapus (beserta pelamarnya)'; before := pa; after := null; ord := 20; return next;
          continue;
        end if;
        if pa is null or (pa - 'cands') is distinct from (pb - 'cands') then
          steps := jsonb_build_array(jsonb_build_object('k','positions'), jsonb_build_object('id',pk,'by','pos','keep',jsonb_build_array('cands')));
          kind := 'mpp'; label := 'MPP: ' || jab || coalesce(' (' || nullif(pb->>'nama','') || ')', '');
          detail := case when pa is null then 'posisi baru' else public.mg_fields(pa, pb, '{cands,history,hist}') end;
          before := pa - 'cands'; after := pb - 'cands'; ord := 20; return next;
        end if;
        for r in select * from public.mg_diff_list(
            jsonb_build_array(jsonb_build_object('k','positions'), jsonb_build_object('id',pk,'by','pos'), jsonb_build_object('k','cands')),
            case when pa is null then '[]'::jsonb else coalesce(pa->'cands','[]') end, coalesce(pb->'cands','[]'), 'name', 'pelamar', 'Pelamar') loop
          steps := r.steps; kind := 'pelamar'; label := r.label || ' (' || coalesce(pos->>'jabatan','-') || ')';
          detail := case when r.before is null then 'baru · tahap ' || coalesce(r.after->>'stage', '-') || coalesce(' · ' || nullif(r.after->>'status',''), '') else r.detail end;
          before := r.before; after := r.after; ord := 10; return next;
        end loop;
      end loop;
    elsif t = 'kta_web_state' and k in ('aktif','keluar','units') then
      for r in select * from public.mg_diff_list(jsonb_build_array(jsonb_build_object('k',k)), a->k, b->k,
          case k when 'units' then 'unit' else 'nama' end,
          case k when 'aktif' then 'mp_aktif' when 'keluar' then 'mp_out' else 'unit' end,
          case k when 'aktif' then 'MP Aktif' when 'keluar' then 'MP Out' else 'Populasi Unit' end) loop
        steps := r.steps; kind := r.kind; label := r.label; detail := r.detail; before := r.before; after := r.after;
        ord := case k when 'aktif' then 30 when 'keluar' then 31 else 40 end; return next;
      end loop;
    elsif t = 'apd_state' and jsonb_typeof(coalesce(b->k, a->k)) = 'array'
          and not exists (select 1 from jsonb_array_elements(coalesce(a->k,'[]') || coalesce(b->k,'[]')) v where jsonb_typeof(v) <> 'object' or coalesce(v->>'id', v->>'code') is null)
          and jsonb_array_length(coalesce(a->k,'[]') || coalesce(b->k,'[]')) > 0 then
      for r in select * from public.mg_diff_list(jsonb_build_array(jsonb_build_object('k',k)), a->k, b->k, 'id', 'apd',
          case k when 'receipts' then 'APD karyawan' when 'stockIn' then 'Stok masuk' when 'adjust' then 'Koreksi stok' when 'transfers' then 'Mutasi gudang'
                 when 'returns' then 'Pengembalian' when 'requests' then 'Permintaan APD' when 'types' then 'Jenis APD' when 'warehouses' then 'Gudang' else k end) loop
        steps := r.steps; kind := 'apd'; before := r.before; after := r.after; ord := 60; detail := r.detail;
        label := split_part(r.label, ':', 1) || ': ' || concat_ws(' · ', nullif(coalesce(r.after->>'type', r.before->>'type'),''),
                  nullif(coalesce(r.after->>'qty', r.before->>'qty') || ' unit', ' unit'), nullif(coalesce(r.after->>'date', r.before->>'date'),''),
                  nullif(coalesce(r.after->>'name', r.before->>'name'),''));
        return next;
      end loop;
    elsif t = 'apd_state' and jsonb_typeof(coalesce(b->k, a->k)) = 'object' then
      for sub in select jsonb_object_keys(coalesce(a->k,'{}')) union select jsonb_object_keys(coalesce(b->k,'{}')) loop
        if (a->k->sub) is not distinct from (b->k->sub) then continue; end if;
        steps := jsonb_build_array(jsonb_build_object('k',k), jsonb_build_object('k',sub)); kind := 'apd'; ord := 70;
        before := a->k->sub; after := b->k->sub;
        label := case k when 'images' then 'Gambar APD' when 'limits' then 'Batas APD' when 'personOverrides' then 'Data karyawan APD' when 'ga' then 'Form GA' else k end || ': ' || sub;
        detail := case when before is null then 'baru' when after is null then 'dihapus'
                       when jsonb_typeof(after) = 'object' and jsonb_typeof(before) = 'object' then public.mg_fields(before, after) else public.mg_short(before) || ' → ' || public.mg_short(after) end;
        return next;
      end loop;
    else
      steps := jsonb_build_array(jsonb_build_object('k',k)); kind := case when k like 'org%' then 'struktur' else 'lain' end;
      label := case when k like 'org%' then 'Struktur organisasi' else 'Pengaturan' end || ' (' || k || ')';
      detail := 'diubah'; before := a->k; after := b->k; ord := 80; return next;
    end if;
  end loop;
end $$;

-- ---------- tulis satu item ke dokumen ----------
create or replace function public.mg_set(doc jsonb, steps jsonb, val jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare s jsonb; rest jsonb; nc jsonb; i int; k text;
begin
  if steps is null or jsonb_array_length(steps) = 0 then return val; end if;
  s := steps->0; rest := steps - 0;
  if s ? 'k' then
    if doc is null or jsonb_typeof(doc) <> 'object' then
      if val is null and jsonb_array_length(rest) = 0 then return doc; end if;
      doc := '{}'::jsonb;
    end if;
    if jsonb_array_length(rest) = 0 and val is null then return doc - (s->>'k'); end if;
    nc := public.mg_set(doc->(s->>'k'), rest, val);
    if nc is null then return doc - (s->>'k'); end if;
    return jsonb_set(doc, array[s->>'k'], nc, true);
  end if;
  if doc is null or jsonb_typeof(doc) <> 'array' then doc := '[]'::jsonb; end if;
  i := public.mg_find(doc, s->>'by', s->>'id');
  if jsonb_array_length(rest) > 0 then
    if i is null then return doc; end if;            -- induk (mis. posisi) sudah tidak ada
    nc := public.mg_set(doc->i, rest, val);
    return jsonb_set(doc, array[i::text], coalesce(nc, '{}'::jsonb));
  end if;
  if val is null then
    if i is null then return doc; end if;
    return doc - i;
  end if;
  if s ? 'keep' and jsonb_typeof(val) = 'object' then
    for k in select jsonb_array_elements_text(s->'keep') loop
      if i is not null and (doc->i) ? k then val := jsonb_set(val, array[k], doc->i->k, true);
      else val := jsonb_set(val, array[k], '[]'::jsonb, true); end if;
    end loop;
  end if;
  if i is null then return doc || jsonb_build_array(val); end if;
  return jsonb_set(doc, array[i::text], val);
end $$;

-- terapkan perubahan old→new (milik Pemilik) ke dokumen final tanpa menyentuh perubahan Editor yang belum disetujui
create or replace function public.mg_apply_delta(t text, fin jsonb, o jsonb, n jsonb) returns jsonb language plpgsql immutable set search_path = public as $$
declare r record;
begin
  if fin is null or o is null or n is null or jsonb_typeof(fin) <> 'object' or t = 'kta_mp_private' then return n; end if;
  for r in select * from public.mg_diff(t, o, n) order by (kind = 'pelamar'), ord loop
    fin := public.mg_set(fin, r.steps, r.after);
  end loop;
  if n ? 'meta' then fin := jsonb_set(fin, '{meta}', n->'meta', true); end if;
  return fin;
end $$;
