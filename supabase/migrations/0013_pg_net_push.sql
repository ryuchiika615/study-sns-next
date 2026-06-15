-- pg_net 拡張を有効化
create extension if not exists pg_net;

-- 設定テーブル
create table if not exists app_settings (
  key text primary key,
  value text not null
);

-- 設定値を挿入（実際のURLに書き換えてください）
insert into app_settings (key, value) values
  ('push_webhook_url', 'https://study-sns-next.vercel.app/api/push/send'),
  ('webhook_secret', 'ryutter-webhook-secret-change-me')
on conflict (key) do nothing;

-- 通知挿入時にプッシュ通知APIを呼び出すトリガー関数
create or replace function notify_push_on_notification()
returns trigger
language plpgsql security definer
as $$
declare
  v_webhook_url text;
  v_secret text;
  v_req_id bigint;
begin
  select value into v_webhook_url from app_settings where key = 'push_webhook_url';
  select value into v_secret from app_settings where key = 'webhook_secret';

  if v_webhook_url is not null and v_secret is not null then
    v_req_id := net.http_post(
      url := v_webhook_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', format('Bearer %s', v_secret)
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'notifications',
        'record', row_to_json(new)::jsonb
      ),
      timeout_milliseconds := 5000
    );
  end if;

  return new;
end;
$$;

-- トリガー作成
drop trigger if exists trg_notify_push on notifications;
create trigger trg_notify_push
  after insert on notifications
  for each row execute function notify_push_on_notification();
