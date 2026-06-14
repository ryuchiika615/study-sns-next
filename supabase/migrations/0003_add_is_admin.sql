-- profilesに管理者フラグ追加
alter table profiles add column if not exists is_admin boolean not null default false;

-- ryu._.u を管理者に設定（usernameで特定）
update profiles set is_admin = true
where username = 'ryu._.u';

-- 確認
select username, display_name, is_admin from profiles where is_admin = true;
