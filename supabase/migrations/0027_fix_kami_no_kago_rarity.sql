-- Fix 神の加護を失いし rarity from SSR to UR
-- buy_item inserts with p_rarity='UR' but the item somehow got SSR
update gacha_items set rarity = 'UR' where name = '神の加護を失いし' and rarity = 'SSR';
