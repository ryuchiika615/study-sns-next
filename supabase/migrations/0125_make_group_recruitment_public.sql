-- 公開掲示板のグループ募集は、フォロー関係・過去のグループ参加に関係なく全ユーザーが閲覧できるようにする。
-- 過去の募集投稿に誤って残ったグループ共有も安全に解除する。

begin;

update public.posts
set group_id = null
where subject in ('グループ募集', '勉強仲間募集')
  and public_group_id is not null;

delete from public.post_group_shares s
using public.posts p
where p.id = s.post_id
  and p.subject in ('グループ募集', '勉強仲間募集')
  and p.public_group_id is not null;

create or replace function public.can_access_post(p_post_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post_id and (
      (p.subject in ('グループ募集', '勉強仲間募集') and p.public_group_id is not null)
      or not exists (select 1 from public.post_group_shares s where s.post_id = p.id)
      or exists (
        select 1 from public.post_group_shares s
        join public.study_group_members m on m.group_id = s.group_id
        where s.post_id = p.id and m.user_id = auth.uid()
      )
    )
  );
$$;

create or replace function public.create_group_recruitment_post(
  p_group_id uuid,
  p_content text,
  p_image_url text default null
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_result json;
  v_post_id uuid;
begin
  if auth.uid() is null then raise exception 'ログインが必要です'; end if;
  if p_content is null or length(btrim(p_content)) = 0 or length(p_content) > 2000 then
    raise exception '募集内容を1〜2000文字で入力してください';
  end if;
  perform 1 from public.study_groups
    where id = p_group_id and owner_id = auth.uid() and invite_code is not null for share;
  if not found then raise exception '自分が作成したグループだけを募集できます'; end if;

  v_result := public.create_post(
    p_content := btrim(p_content), p_subject := 'グループ募集',
    p_study_minutes := 0, p_image_url := p_image_url,
    p_image_urls := case when p_image_url is null then null::text[] else array[p_image_url] end,
    p_study_date := null, p_quote_post_id := null, p_quote_comment_id := null,
    p_silent := false, p_audio_url := null, p_audio_name := null,
    p_workout_minutes := 0, p_pages_completed := 0, p_total_pages := 0
  );
  v_post_id := (v_result ->> 'post_id')::uuid;
  if v_post_id is null then raise exception '募集投稿の保存結果を確認できませんでした'; end if;
  perform public.attach_group_recruitment(v_post_id, p_group_id);
  update public.posts set group_id = null where id = v_post_id;
  delete from public.post_group_shares where post_id = v_post_id;
  return v_result;
end;
$$;
revoke all on function public.create_group_recruitment_post(uuid, text, text) from public, anon;
grant execute on function public.create_group_recruitment_post(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
