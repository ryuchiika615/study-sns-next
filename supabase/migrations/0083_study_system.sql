-- Study / Flashcard system (Anki-compatible)
-- Decks (folders for organizing cards)
create table if not exists decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  parent_id uuid references decks(id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cards (flashcards with front/back content)
create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  front text not null,
  back text not null,
  image_url text,
  audio_url text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reviews (spaced repetition history using SM-2 algorithm)
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  rating int not null check (rating >= 0 and rating <= 3),
  interval_days int not null default 0,
  repetitions int not null default 0,
  easiness_factor real not null default 2.5,
  due_date date not null,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_decks_user on decks(user_id);
create index if not exists idx_decks_parent on decks(parent_id);
create index if not exists idx_cards_deck on cards(deck_id);
create index if not exists idx_cards_user on cards(user_id);
create index if not exists idx_reviews_card on reviews(card_id);
create index if not exists idx_reviews_user on reviews(user_id);
create index if not exists idx_reviews_due on reviews(user_id, due_date);

-- Enable RLS
alter table decks enable row level security;
alter table cards enable row level security;
alter table reviews enable row level security;

-- RLS policies: users can only see/manage their own data
create policy "decks_select" on decks for select using (auth.uid() = user_id);
create policy "decks_insert" on decks for insert with check (auth.uid() = user_id);
create policy "decks_update" on decks for update using (auth.uid() = user_id);
create policy "decks_delete" on decks for delete using (auth.uid() = user_id);

create policy "cards_select" on cards for select using (auth.uid() = user_id);
create policy "cards_insert" on cards for insert with check (auth.uid() = user_id);
create policy "cards_update" on cards for update using (auth.uid() = user_id);
create policy "cards_delete" on cards for delete using (auth.uid() = user_id);

create policy "reviews_select" on reviews for select using (auth.uid() = user_id);
create policy "reviews_insert" on reviews for insert with check (auth.uid() = user_id);
create policy "reviews_update" on reviews for update using (auth.uid() = user_id);
create policy "reviews_delete" on reviews for delete using (auth.uid() = user_id);
