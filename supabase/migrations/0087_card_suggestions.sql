-- Card suggestions for public deck corrections
create table if not exists card_suggestions (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  deck_id uuid not null references decks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  description text not null,
  suggested_front text,
  suggested_back text,
  suggested_options text[],
  suggested_correct_answer int,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- Indexes
create index if not exists idx_card_suggestions_deck on card_suggestions(deck_id);
create index if not exists idx_card_suggestions_card on card_suggestions(card_id);

-- RLS
alter table card_suggestions enable row level security;

-- Anyone can create suggestions
create policy "Anyone can create suggestions"
  on card_suggestions for insert
  with check (auth.uid() = user_id);

-- Deck owner can view all suggestions for their deck
create policy "Deck owner can view suggestions"
  on card_suggestions for select
  using (
    deck_id in (
      select id from decks where user_id = auth.uid()
    )
  );

-- Reporter can view their own suggestions
create policy "Reporter can view own suggestions"
  on card_suggestions for select
  using (auth.uid() = user_id);

-- Deck owner can update suggestion status
create policy "Deck owner can update suggestions"
  on card_suggestions for update
  using (
    deck_id in (
      select id from decks where user_id = auth.uid()
    )
  );
