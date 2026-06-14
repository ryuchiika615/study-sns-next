-- ==================== 勉強SNS「リュッター」Supabaseスキーマ ====================

-- 拡張機能
create extension if not exists "pgcrypto";

-- 1. ガチャアイテムマスター (元: GachaItem)
create table if not exists gacha_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rarity text not null check (rarity in ('N','R','SR','SSR','UR','LR')),
  category text not null default 'title' check (category in ('title','icon')),
  created_at timestamptz not null default now()
);
create index idx_gacha_items_rarity on gacha_items(rarity);

-- 2. プロフィール (元: Profile, Userに1対1)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  bio text check (char_length(bio) <= 300),
  department text,
  theme_color text not null default 'dark',
  icon_url text,
  target_date date,
  target_minutes integer not null default 0,
  points integer not null default 0,
  exchange_points integer not null default 0,
  consecutive_post_days integer not null default 0,
  last_post_date date,
  current_title_id uuid references gacha_items(id),
  current_avatar_id uuid references gacha_items(id),
  created_at timestamptz not null default now()
);

-- 3. フォロー (元: Profile.follows ManyToMany)
create table if not exists follows (
  follower_id uuid references profiles(id) on delete cascade,
  following_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id)
);
create index idx_follows_follower on follows(follower_id);
create index idx_follows_following on follows(following_id);

-- 4. ユーザー所持アイテム (元: Profile.items ManyToMany)
create table if not exists user_items (
  user_id uuid references profiles(id) on delete cascade,
  item_id uuid references gacha_items(id) on delete cascade,
  primary key (user_id, item_id)
);

-- 5. 投稿 (元: Post)
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  content text not null check (char_length(content) <= 140),
  image_url text,
  subject text not null default 'その他',
  study_minutes integer not null default 0,
  reply_to_id uuid references posts(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_posts_user_created on posts(user_id, created_at desc);
create index idx_posts_created on posts(created_at desc);
create index idx_posts_subject on posts(subject);
create index idx_posts_content_search on posts using gin(to_tsvector('japanese', coalesce(content, '')));

-- 6. いいね (元: Post.liked_by ManyToMany)
create table if not exists likes (
  user_id uuid references profiles(id) on delete cascade,
  post_id uuid references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index idx_likes_post on likes(post_id);

-- 7. コメント (元: Comment)
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  text text not null check (char_length(text) <= 100),
  created_at timestamptz not null default now()
);
create index idx_comments_post_created on comments(post_id, created_at);

-- 8. 通知 (元: Notification)
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references profiles(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  post_id uuid references posts(id) on delete cascade,
  notification_type text not null check (notification_type in ('like','reply','follow')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_notifications_recipient on notifications(recipient_id, is_read, created_at desc);

-- 9. ログインセッション (元: UserLoginSession)
create table if not exists login_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  login_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  logout_at timestamptz,
  ip_address text,
  user_agent text
);
create index idx_login_sessions_user on login_sessions(user_id, login_at desc);

-- ==================== 初期データ ====================
-- デフォルトのガチャアイテム
insert into gacha_items (name, rarity, category) values
  ('新人エンジニア', 'N', 'title'),
  ('初期アバター', 'N', 'icon'),
  ('努力の羽根', 'N', 'icon'),
  ('ノートの星', 'N', 'icon'),
  ('集中リング', 'N', 'icon')
on conflict do nothing;

-- ==================== シグナル/トリガー ====================
-- ユーザー作成時に自動でプロフィール作成
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 最終アクセス日時を更新するトリガー
create or replace function update_last_seen()
returns trigger as $$
begin
  new.last_seen_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_login_session_update on login_sessions;
create trigger on_login_session_update
  before update on login_sessions
  for each row execute function update_last_seen();

-- ==================== Row Level Security ====================
alter table profiles enable row level security;
alter table follows enable row level security;
alter table user_items enable row level security;
alter table posts enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;
alter table notifications enable row level security;
alter table login_sessions enable row level security;

-- 全ユーザー閲覧可、本人のみ編集可
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_update" on profiles for update using (auth.uid() = id);

create policy "follows_select" on follows for select using (true);
create policy "follows_insert" on follows for insert with check (auth.uid() = follower_id);
create policy "follows_delete" on follows for delete using (auth.uid() = follower_id);

create policy "user_items_select" on user_items for select using (true);
create policy "user_items_insert" on user_items for insert with check (auth.uid() = user_id);
create policy "user_items_delete" on user_items for delete using (auth.uid() = user_id);

create policy "posts_select" on posts for select using (true);
create policy "posts_insert" on posts for insert with check (auth.uid() = user_id);
create policy "posts_update" on posts for update using (auth.uid() = user_id);
create policy "posts_delete" on posts for delete using (auth.uid() = user_id);

create policy "likes_select" on likes for select using (true);
create policy "likes_insert" on likes for insert with check (auth.uid() = user_id);
create policy "likes_delete" on likes for delete using (auth.uid() = user_id);

create policy "comments_select" on comments for select using (true);
create policy "comments_insert" on comments for insert with check (auth.uid() = user_id);
create policy "comments_delete" on comments for delete using (auth.uid() = user_id);

create policy "notifications_select" on notifications for select using (auth.uid() = recipient_id);
create policy "notifications_update" on notifications for update using (auth.uid() = recipient_id);

-- 管理者用：全権限
create policy "admin_all_profiles" on profiles for all using (auth.uid() in (
  select id from profiles where id = auth.uid()
  -- adminチェックはアプリ側で行う
));
