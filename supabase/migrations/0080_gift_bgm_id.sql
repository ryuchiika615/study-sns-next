-- notifications.post_id には audio_bgm.id も入るように FK を外す
alter table notifications drop constraint if exists notifications_post_id_fkey;

-- gift通知でBGMを参照するためのbgm_idカラム（nullable、FKなし）
alter table notifications add column if not exists bgm_id uuid;
