-- Pro限定の投稿カード装飾。無料ユーザーの既存投稿は変更しない。
alter table public.posts add column if not exists card_theme text not null default 'default'
  check (card_theme in ('default', 'ocean', 'sunset', 'midnight', 'photo'));
alter table public.posts add column if not exists card_background_image_url text;
alter table public.posts add column if not exists pro_badge boolean not null default false;

create or replace function public.apply_post_pro_style()
returns trigger language plpgsql security definer set search_path = public as $$
declare active_pro boolean;
begin
  select exists (select 1 from public.pro_grants where user_id = new.user_id and revoked_at is null and starts_at <= now() and (expires_at is null or expires_at > now())) into active_pro;
  new.pro_badge := active_pro;
  if not active_pro then
    new.card_theme := 'default';
    new.card_background_image_url := null;
  end if;
  return new;
end;
$$;
drop trigger if exists apply_post_pro_style_trigger on public.posts;
create trigger apply_post_pro_style_trigger before insert or update on public.posts
  for each row execute function public.apply_post_pro_style();
