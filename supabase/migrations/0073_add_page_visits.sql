create table if not exists page_visits (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null,
  referrer text,
  user_agent text,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists idx_page_visits_user_id on page_visits(user_id);
create index if not exists idx_page_visits_created_at on page_visits(created_at);
create index if not exists idx_page_visits_path on page_visits(path);

alter table page_visits enable row level security;

drop policy if exists "page_visits_insert" on page_visits;
create policy "page_visits_insert" on page_visits for insert with check (auth.uid() = user_id);

drop policy if exists "page_visits_select_admin" on page_visits;
create policy "page_visits_select_admin" on page_visits for select using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);
