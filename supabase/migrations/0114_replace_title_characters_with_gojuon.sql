-- 実績文字を「五十音コレクション」へ置き換える。
-- 条件・並びは五十音順ではなくランダムにして、次に何が手に入るかを楽しめるようにする。
-- すでに作成済みの自作称号・通常称号・フレーム・獲得済み文字は削除しない。
-- 最初の15件は旧IDをそのまま使い、獲得履歴を五十音の文字へ安全に引き継ぐ。

insert into public.title_character_definitions (id, character, label, description, condition_type, threshold, rarity, sort_order) values
  ('streak_10_shi', 'み', '実績文字「み」', '合計12時間学習する', 'study_minutes', 720, 'R', 310),
  ('study_20_yu', 'け', '実績文字「け」', '7日連続で記録する', 'streak', 7, 'R', 80),
  ('active_30_u',  'あ', '実績文字「あ」', '8件投稿する', 'post_count', 8, 'R', 420),
  ('study_50_ga', 'ろ', '実績文字「ろ」', '合計6時間筋トレする', 'workout_minutes', 360, 'SR', 150),
  ('post_40_ku','つ', '実績文字「つ」', '18日分の活動記録を残す', 'active_days', 18, 'SR', 10),
  ('study_100_sei', 'や', '実績文字「や」', '合計35時間学習する', 'study_minutes', 2100, 'SR', 260),
  ('streak_21_ha', 'ほ', '実績文字「ほ」', '14日連続で記録する', 'streak', 14, 'SR', 450),
  ('workout_20_zero', 'に', '実績文字「に」', '25件投稿する', 'post_count', 25, 'SR', 120),
  ('active_100_toki',  'え', '実績文字「え」', '合計60時間学習する', 'study_minutes', 3600, 'SSR', 370),
  ('study_200_ou', 'さ', '実績文字「さ」', '合計15時間筋トレする', 'workout_minutes', 900, 'SSR', 220),
  ('streak_60_ryu', 'り', '実績文字「り」', '40日分の活動記録を残す', 'active_days', 40, 'SSR', 60),
  ('challenge_3_ten', 'く', '実績文字「く」', '21日連続で記録する', 'streak', 21, 'SSR', 400),
  ('study_500_shin',  'お', '実績文字「お」', '合計100時間学習する', 'study_minutes', 6000, 'SSR', 180),
  ('streak_100_sora', 'へ', '実績文字「へ」', '50件投稿する', 'post_count', 50, 'SSR', 340),
  ('study_1000_infinity', 'ぬ', '実績文字「ぬ」', '合計130時間学習する', 'study_minutes', 7800, 'UR', 90),
  ('kana_16_i',  'い', '実績文字「い」', '30日連続で記録する', 'streak', 30, 'UR', 290),
  ('kana_17_re', 'れ', '実績文字「れ」', '合計30時間筋トレする', 'workout_minutes', 1800, 'UR', 30),
  ('kana_18_so', 'そ', '実績文字「そ」', '75日分の活動記録を残す', 'active_days', 75, 'UR', 440),
  ('kana_19_ta', 'た', '実績文字「た」', '合計180時間学習する', 'study_minutes', 10800, 'UR', 200),
  ('kana_20_mu', 'む', '実績文字「む」', '80件投稿する', 'post_count', 80, 'UR', 350),
  ('kana_21_yo', 'よ', '実績文字「よ」', '45日連続で記録する', 'streak', 45, 'LR', 130),
  ('kana_22_ha', 'は', '実績文字「は」', '合計250時間学習する', 'study_minutes', 15000, 'LR', 380),
  ('kana_23_na', 'な', '実績文字「な」', '対決で2勝する', 'challenge_wins', 2, 'LR', 20),
  ('kana_24_chi','ち', '実績文字「ち」', '合計50時間筋トレする', 'workout_minutes', 3000, 'LR', 280),
  ('kana_25_wo', 'を', '実績文字「を」', '120日分の活動記録を残す', 'active_days', 120, 'LR', 100),
  ('kana_26_ka', 'か', '実績文字「か」', '合計350時間学習する', 'study_minutes', 21000, 'LR', 410),
  ('kana_27_no', 'の', '実績文字「の」', '100件投稿する', 'post_count', 100, 'LR', 170),
  ('kana_28_u',  'う', '実績文字「う」', '60日連続で記録する', 'streak', 60, 'XR', 330),
  ('kana_29_ma', 'ま', '実績文字「ま」', '合計500時間学習する', 'study_minutes', 30000, 'XR', 70),
  ('kana_30_se', 'せ', '実績文字「せ」', '対決で5勝する', 'challenge_wins', 5, 'XR', 240),
  ('kana_31_hi', 'ひ', '実績文字「ひ」', '合計80時間筋トレする', 'workout_minutes', 4800, 'XR', 140),
  ('kana_32_ra', 'ら', '実績文字「ら」', '180日分の活動記録を残す', 'active_days', 180, 'XR', 430),
  ('kana_33_te', 'て', '実績文字「て」', '合計750時間学習する', 'study_minutes', 45000, 'XR', 50),
  ('kana_34_ko', 'こ', '実績文字「こ」', '120日連続で記録する', 'streak', 120, 'XR', 270),
  ('kana_35_ne', 'ね', '実績文字「ね」', '200件投稿する', 'post_count', 200, 'XR', 160),
  ('kana_36_fu', 'ふ', '実績文字「ふ」', '合計1000時間学習する', 'study_minutes', 60000, 'XR', 390),
  ('kana_37_su', 'す', '実績文字「す」', '合計120時間筋トレする', 'workout_minutes', 7200, 'XR', 110),
  ('kana_38_ru', 'る', '実績文字「る」', '250日分の活動記録を残す', 'active_days', 250, 'XR', 300),
  ('kana_39_to', 'と', '実績文字「と」', '対決で10勝する', 'challenge_wins', 10, 'XR', 230),
  ('kana_40_me', 'め', '実績文字「め」', '合計1500時間学習する', 'study_minutes', 90000, 'XR', 360),
  ('kana_41_wa', 'わ', '実績文字「わ」', '180日連続で記録する', 'streak', 180, 'XR', 190),
  ('kana_42_n',  'ん', '実績文字「ん」', '300件投稿する', 'post_count', 300, 'XR', 470),
  ('kana_43_ki', 'き', '実績文字「き」', '合計200時間筋トレする', 'workout_minutes', 12000, 'XR', 40),
  ('kana_44_shi','し', '実績文字「し」', '500日分の活動記録を残す', 'active_days', 500, 'XR', 320),
  ('kana_45_yu', 'ゆ', '実績文字「ゆ」', '合計2000時間学習する', 'study_minutes', 120000, 'XR', 250),
  ('kana_46_mo', 'も', '実績文字「も」', '対決で20勝する', 'challenge_wins', 20, 'XR', 460)
on conflict (id) do update set
  character = excluded.character,
  label = excluded.label,
  description = excluded.description,
  condition_type = excluded.condition_type,
  threshold = excluded.threshold,
  rarity = excluded.rarity,
  sort_order = excluded.sort_order;

-- 変更後の五十音定義で、現在達成済みの実績をすぐ再判定できるようにする。
grant execute on function public.sync_title_characters() to authenticated;
