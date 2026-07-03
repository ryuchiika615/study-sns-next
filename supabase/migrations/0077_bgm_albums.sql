-- BGM Albums
create table if not exists bgm_albums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  shuffle boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists bgm_album_items (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references bgm_albums(id) on delete cascade,
  bgm_id uuid references audio_bgm(id) on delete set null,
  source_type text not null default 'db' check (source_type in ('db', 'youtube', 'local')),
  name text not null default '',
  audio_url text not null default '',
  youtube_url text,
  local_key text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table bgm_album_items enable row level security;
alter table bgm_albums enable row level security;

-- Users can manage own albums
create policy "Users can manage own albums"
  on bgm_albums for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can manage items in own albums
create policy "Users can manage own album items"
  on bgm_album_items for all
  using (
    exists (
      select 1 from bgm_albums
      where bgm_albums.id = bgm_album_items.album_id
        and bgm_albums.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from bgm_albums
      where bgm_albums.id = bgm_album_items.album_id
        and bgm_albums.user_id = auth.uid()
    )
  );
