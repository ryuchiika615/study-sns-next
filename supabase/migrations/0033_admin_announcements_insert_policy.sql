-- Allow admins to insert and delete announcements (API uses anon key, RLS blocks otherwise)
create policy "announcements_insert" on admin_announcements for insert with check (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
create policy "announcements_delete" on admin_announcements for delete using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
