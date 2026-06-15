-- notificationsテーブルにpush_sent_atカラムを追加
alter table if exists notifications
  add column if not exists push_sent_at timestamptz;

-- インデックス追加（未送信通知の検索用）
create index if not exists idx_notifications_push_sent
  on notifications (push_sent_at)
  where push_sent_at is null;
