-- RYUTTER の Supabase SQL Editor で、このファイル全体を実行してください。
-- 0109 が未適用でも実行可能。既存の投稿・グループは削除しません。
begin;

alter table public.posts add column if not exists public_group_id uuid references public.study_groups(id) on delete set null;
alter table public.posts add column if not exists public_group_invite_code text;
create index if not exists idx_posts_public_group_id on public.posts(public_group_id) where public_group_id is not null;

-- 公開中の旧画面も動くように、従来の関数を復元する。
create or replace function public.attach_group_recruitment(p_post_id uuid, p_group_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_invite_code text;
begin
  if auth.uid() is null then raise exception 'ログインが必要です'; end if;
  select invite_code into v_invite_code from public.study_groups
    where id = p_group_id and owner_id = auth.uid() for share;
  if v_invite_code is null then raise exception '自分が作成したグループだけを募集できます'; end if;
  update public.posts
    set public_group_id = p_group_id, public_group_invite_code = v_invite_code
    where id = p_post_id and user_id = auth.uid() and group_id is null and subject = 'グループ募集';
  if not found then raise exception 'この募集投稿は変更できません'; end if;
end;
$$;
revoke all on function public.attach_group_recruitment(uuid, uuid) from public, anon;
grant execute on function public.attach_group_recruitment(uuid, uuid) to authenticated;

-- 新画面用：投稿と募集リンクを同一トランザクションで保存する。
-- 紐付けが失敗した場合、投稿・ポイント等もまとめてロールバックされる。
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
  return v_result;
end;
$$;
revoke all on function public.create_group_recruitment_post(uuid, text, text) from public, anon;
grant execute on function public.create_group_recruitment_post(uuid, text, text) to authenticated;

-- API が新しい関数を認識するようキャッシュ再読み込みを依頼。
notify pgrst, 'reload schema';
commit;

-- 下の両方に関数名が出れば作成済み（NULL でないこと）。
select to_regprocedure('public.attach_group_recruitment(uuid,uuid)') as existing_screen_ready,
       to_regprocedure('public.create_group_recruitment_post(uuid,text,text)') as updated_screen_ready;
