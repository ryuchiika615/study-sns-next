-- 「通知を送らない」を、アプリ内通知・Push通知の両方で守る。
create or replace function public.notify_followers_on_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_silent then
    return new;
  end if;

  insert into public.notifications (recipient_id, sender_id, post_id, notification_type)
  select f.follower_id, new.user_id, new.id, 'follow_post'
  from public.follows f
  where f.following_id = new.user_id
    and f.notify_posts = true
    and f.follower_id != new.user_id;
  return new;
end;
$$;

-- Proユーザーがプロフィールで選ぶ、今後の投稿の既定カード柄。
alter table public.profiles add column if not exists default_post_card_theme text not null default 'default'
  check (default_post_card_theme in ('default', 'ocean', 'sunset', 'midnight', 'photo'));

create or replace function public.apply_post_pro_style()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  active_pro boolean;
  selected_theme text;
begin
  select exists (
    select 1 from public.pro_grants
    where user_id = new.user_id
      and revoked_at is null
      and starts_at <= now()
      and (expires_at is null or expires_at > now())
  ) into active_pro;

  new.pro_badge := active_pro;
  if not active_pro then
    new.card_theme := 'default';
    new.card_background_image_url := null;
  elsif tg_op = 'INSERT' then
    select coalesce(default_post_card_theme, 'default') into selected_theme
    from public.profiles where id = new.user_id;
    new.card_theme := coalesce(selected_theme, 'default');
    new.card_background_image_url := case
      when new.card_theme = 'photo' then new.image_url
      else null
    end;
  end if;
  return new;
end;
$$;
