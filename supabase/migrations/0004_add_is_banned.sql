-- profilesにBANカラム追加
alter table profiles add column if not exists is_banned boolean not null default false;
alter table profiles add column if not exists ban_reason text;

-- 確認
select username, display_name, is_admin, is_banned, points from profiles;
