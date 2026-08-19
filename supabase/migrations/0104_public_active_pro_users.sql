-- 投稿カードのPro背景・Proバッジを、本人以外のタイムラインでも正しく表示するための公開用ビュー。
-- 契約ID・決済情報などは公開せず、現在ProであるユーザーIDだけを返す。

create or replace view public.active_pro_users
with (security_invoker = false) as
select distinct user_id
from public.pro_grants
where revoked_at is null
  and starts_at <= now()
  and (expires_at is null or expires_at > now());

grant select on public.active_pro_users to anon, authenticated;
