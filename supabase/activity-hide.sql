-- Catatan aktivitas tidak lagi bisa dihapus permanen dari web; Pemilik hanya bisa menyembunyikan.
alter table public.kta_activity_log add column if not exists hidden_at timestamptz, add column if not exists hidden_by text;
drop policy if exists "activity owner delete" on public.kta_activity_log;
revoke delete on public.kta_activity_log from anon, authenticated;
revoke update on public.kta_activity_log from anon, authenticated;
grant update (hidden_at, hidden_by) on public.kta_activity_log to authenticated;
drop policy if exists "activity owner hide" on public.kta_activity_log;
create policy "activity owner hide" on public.kta_activity_log for update to authenticated
  using (lower(coalesce(auth.jwt()->>'email','')) = 'matthewyoga2014@gmail.com')
  with check (lower(coalesce(auth.jwt()->>'email','')) = 'matthewyoga2014@gmail.com');
