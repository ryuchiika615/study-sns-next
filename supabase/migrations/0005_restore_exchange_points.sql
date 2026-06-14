-- exchange_pointsカラムを復活（交換ショップで使用）
alter table profiles add column if not exists exchange_points integer not null default 0;

-- pointsからexchange_pointsを再分割（元の計算式: streak bonusがexchange_pointsに入ってた）
-- 簡易的に全ユーザーのpointsの30%をexchange_pointsに割り振る
-- （正確な復元は不可能なので、全ユーザーに最低限の交換ポイントを付与）
update profiles set exchange_points = least(points, 100) where exchange_points = 0;

-- 管理者フラグを確実に設定（username or emailで検索）
update profiles set is_admin = true where username = 'ryu._.u';
update profiles set is_admin = true where email = 'ryu._.u@example.com';
-- 念のためID指定でも設定
update profiles set is_admin = true where id in (
  select id from profiles where username = 'ryu._.u' or email = 'ryu._.u@example.com'
);

-- 確認
select username, display_name, email, is_admin, points, exchange_points from profiles;
