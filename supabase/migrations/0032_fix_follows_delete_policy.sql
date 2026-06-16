-- Allow deleting follows rows where the current user is either follower or following
-- (needed for "remove follower" feature)
drop policy if exists "follows_delete" on public.follows;
create policy "follows_delete" on public.follows for delete using (
  auth.uid() = follower_id or auth.uid() = following_id
);
