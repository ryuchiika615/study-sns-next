-- XR rare added for monthly champion rewards
alter table gacha_items drop constraint if exists gacha_items_rarity_check;
alter table gacha_items add constraint gacha_items_rarity_check
  check (rarity in ('N','R','SR','SSR','UR','LR','XR'));
