-- Catatan aktivitas semua web monitoring (dibaca & dihapus hanya oleh Pemilik) + Pemilik bisa menghapus Riwayat Hapus APD.
-- Sudah diterapkan sebagai migration "kta_activity_log_and_apd_audit_delete" (24 Okt 2026).
create table if not exists public.kta_activity_log (
  id bigserial primary key, at timestamptz not null default now(), app text not null, site text, page text,
  actor text not null, role text, action text not null, detail text);
create index if not exists kta_activity_log_at on public.kta_activity_log (at desc);
alter table public.kta_activity_log enable row level security;
create policy "activity owner read" on public.kta_activity_log for select to authenticated using (lower(coalesce(auth.jwt()->>'email','')) = 'matthewyoga2014@gmail.com');
create policy "activity owner delete" on public.kta_activity_log for delete to authenticated using (lower(coalesce(auth.jwt()->>'email','')) = 'matthewyoga2014@gmail.com');
revoke all on public.kta_activity_log from anon, authenticated;
grant select, delete on public.kta_activity_log to authenticated;
-- penulisan hanya lewat fungsi: Pemilik/Editor yang login, atau link tanpa login yang masih berlaku
-- create or replace function public.kta_log_activity(p_app, p_site, p_action, p_detail, p_token, p_page) ... security definer
create policy "apd delete audit owner delete" on public.apd_delete_audit for delete to authenticated using (public.kta_web_role_for('apd') = 'owner');
grant delete on public.apd_delete_audit to authenticated;
