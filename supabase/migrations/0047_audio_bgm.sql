-- ユーザー録音BGM
CREATE TABLE IF NOT EXISTS audio_bgm (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 10,
  audio_url TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 100,
  plays_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 購入済みBGM
CREATE TABLE IF NOT EXISTS purchased_bgm (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bgm_id UUID NOT NULL REFERENCES audio_bgm(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, bgm_id)
);

ALTER TABLE audio_bgm ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchased_bgm ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audio_bgm_select" ON audio_bgm FOR SELECT USING (true);
CREATE POLICY "audio_bgm_insert" ON audio_bgm FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "audio_bgm_update" ON audio_bgm FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "audio_bgm_delete" ON audio_bgm FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "purchased_bgm_select" ON purchased_bgm FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "purchased_bgm_insert" ON purchased_bgm FOR INSERT WITH CHECK (auth.uid() = user_id);

-- BGM購入RPC
create or replace function purchase_bgm(p_bgm_id UUID)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id UUID;
  v_price INTEGER;
  v_creator_id UUID;
  v_balance INTEGER;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  select price, user_id into v_price, v_creator_id
  from audio_bgm where id = p_bgm_id;
  if v_price is null then raise exception 'BGM not found'; end if;
  if v_creator_id = v_user_id then raise exception 'Cannot buy your own BGM'; end if;

  if exists (select 1 from purchased_bgm where user_id = v_user_id and bgm_id = p_bgm_id) then
    raise exception 'Already purchased';
  end if;

  select exchange_points into v_balance from profiles where id = v_user_id;
  if v_balance < v_price then raise exception 'Insufficient points'; end if;

  update profiles set exchange_points = exchange_points - v_price where id = v_user_id;
  update profiles set exchange_points = exchange_points + floor(v_price * 0.9) where id = v_creator_id;
  insert into purchased_bgm (user_id, bgm_id) values (v_user_id, p_bgm_id);
  update audio_bgm set plays_count = plays_count + 1 where id = p_bgm_id;

  return jsonb_build_object('success', true, 'remaining_points', (v_balance - v_price));
end;
$$;
