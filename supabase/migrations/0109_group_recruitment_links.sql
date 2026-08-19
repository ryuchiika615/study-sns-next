-- 公開掲示板の「グループ募集」投稿に、作成者が管理するグループへの参加導線を付ける。
alter table public.posts add column if not exists public_group_id uuid references public.study_groups(id) on delete set null;
alter table public.posts add column if not exists public_group_invite_code text;
create index if not exists idx_posts_public_group_id on public.posts(public_group_id) where public_group_id is not null;

create or replace function public.attach_group_recruitment(
  p_post_id uuid,
  p_group_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_invite_code text;
begin
  if auth.uid() is null then raise exception 'ログインが必要です'; end if;
  if not exists (
    select 1 from public.posts
    where id = p_post_id and user_id = auth.uid() and group_id is null and subject = 'グループ募集'
  ) then raise exception 'この募集投稿は変更できません'; end if;
  select invite_code into v_invite_code from public.study_groups
    where id = p_group_id and owner_id = auth.uid();
  if v_invite_code is null then raise exception '自分が作成したグループだけを募集できます'; end if;
  update public.posts set public_group_id = p_group_id, public_group_invite_code = v_invite_code where id = p_post_id;
end;
$$;
