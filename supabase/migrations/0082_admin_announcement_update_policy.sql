-- Allow admins to update announcements (soft delete via is_deleted)
create policy "announcements_update" on admin_announcements for update using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
