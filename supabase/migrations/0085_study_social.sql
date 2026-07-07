-- Study social: likes, bookmarks, comments

create table if not exists deck_likes (
  user_id uuid not null references profiles(id) on delete cascade,
  deck_id uuid not null references decks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, deck_id)
);

create table if not exists deck_bookmarks (
  user_id uuid not null references profiles(id) on delete cascade,
  deck_id uuid not null references decks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, deck_id)
);

create table if not exists deck_comments (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- For discover: allow anyone to view public decks
create policy "decks_select_public" on decks for select using (
  is_public = true or auth.uid() = user_id
);

create policy "deck_likes_select" on deck_likes for select using (true);
create policy "deck_likes_insert" on deck_likes for insert with check (auth.uid() = user_id);
create policy "deck_likes_delete" on deck_likes for delete using (auth.uid() = user_id);

create policy "deck_bookmarks_select" on deck_bookmarks for select using (true);
create policy "deck_bookmarks_insert" on deck_bookmarks for insert with check (auth.uid() = user_id);
create policy "deck_bookmarks_delete" on deck_bookmarks for delete using (auth.uid() = user_id);

create policy "deck_comments_select" on deck_comments for select using (true);
create policy "deck_comments_insert" on deck_comments for insert with check (auth.uid() = user_id);
create policy "deck_comments_delete" on deck_comments for delete using (auth.uid() = user_id);

-- Allow viewing cards in public decks
create policy "cards_select_public" on cards for select using (
  exists (select 1 from decks where id = cards.deck_id and (is_public = true or user_id = auth.uid()))
);

alter table deck_likes enable row level security;
alter table deck_bookmarks enable row level security;
alter table deck_comments enable row level security;

-- Indexes
create index if not exists idx_deck_likes_deck on deck_likes(deck_id);
create index if not exists idx_deck_bookmarks_user on deck_bookmarks(user_id);
create index if not exists idx_deck_comments_deck on deck_comments(deck_id);
