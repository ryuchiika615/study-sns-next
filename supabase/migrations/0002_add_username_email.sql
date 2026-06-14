-- profilesにusername/emailカラム追加
alter table profiles add column if not exists username text;
alter table profiles add column if not exists email text;

-- auth.usersからデータをコピー
update profiles p set
  username = au.raw_user_meta_data->>'username',
  email = au.email
from auth.users au
where p.id = au.id;

-- 抜けがないか確認
select count(*) as missing_username from profiles where username is null;
select count(*) as missing_email from profiles where email is null;

-- ユニーク制約（usernameはログインに使うので一意）
create unique index if not exists idx_profiles_username on profiles(username);

-- 新規サインアップ時に自動でプロファイル作成
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, username, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
