-- 1ユーザー1枚のPro投稿カード背景。URLはプロフィールに保持し、投稿ごとには保存しない。
alter table public.profiles add column if not exists post_card_background_url text;
alter table public.profiles add column if not exists post_card_background_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-card-backgrounds', 'post-card-backgrounds', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "post_card_backgrounds_public_read" on storage.objects;
create policy "post_card_backgrounds_public_read" on storage.objects for select
  using (bucket_id = 'post-card-backgrounds');

drop policy if exists "post_card_backgrounds_pro_insert" on storage.objects;
create policy "post_card_backgrounds_pro_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-card-backgrounds'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.pro_grants g where g.user_id = auth.uid() and g.revoked_at is null and g.starts_at <= now() and (g.expires_at is null or g.expires_at > now()))
  );

drop policy if exists "post_card_backgrounds_pro_update" on storage.objects;
create policy "post_card_backgrounds_pro_update" on storage.objects for update to authenticated
  using (bucket_id = 'post-card-backgrounds' and (storage.foldername(name))[1] = auth.uid() and exists (select 1 from public.pro_grants g where g.user_id = auth.uid() and g.revoked_at is null and g.starts_at <= now() and (g.expires_at is null or g.expires_at > now())))
  with check (bucket_id = 'post-card-backgrounds' and (storage.foldername(name))[1] = auth.uid() and exists (select 1 from public.pro_grants g where g.user_id = auth.uid() and g.revoked_at is null and g.starts_at <= now() and (g.expires_at is null or g.expires_at > now())));

drop policy if exists "post_card_backgrounds_pro_delete" on storage.objects;
create policy "post_card_backgrounds_pro_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'post-card-backgrounds' and (storage.foldername(name))[1] = auth.uid() and exists (select 1 from public.pro_grants g where g.user_id = auth.uid() and g.revoked_at is null and g.starts_at <= now() and (g.expires_at is null or g.expires_at > now())));

-- Freeユーザーが直接APIで背景URLを書き換えることを防ぐ。設定値自体はPro終了後も残す。
create or replace function public.enforce_post_card_background_pro()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.post_card_background_url is distinct from old.post_card_background_url
     or new.post_card_background_path is distinct from old.post_card_background_path then
    if not exists (select 1 from public.pro_grants g where g.user_id = auth.uid() and g.revoked_at is null and g.starts_at <= now() and (g.expires_at is null or g.expires_at > now())) then
      raise exception 'Pro membership is required to change the post card background';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_post_card_background_pro_trigger on public.profiles;
create trigger enforce_post_card_background_pro_trigger before update on public.profiles
  for each row execute function public.enforce_post_card_background_pro();
