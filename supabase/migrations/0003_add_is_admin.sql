-- profilesに管理者フラグ追加
alter table profiles add column if not exists is_admin boolean not null default false;

-- ryu._.u を管理者に設定（usernameで特定）
update profiles set is_admin = true
where username = 'ryu._.u';

-- ポイント統合: exchange_pointsをpointsに合算、カラム削除
update profiles set points = points + coalesce(exchange_points, 0);
alter table profiles drop column if exists exchange_points;

-- 確認
select username, display_name, is_admin, points from profiles;
