alter table login_sessions add column if not exists location text;

drop policy if exists "login_sessions_insert" on login_sessions;
create policy "login_sessions_insert" on login_sessions for insert with check (true);
