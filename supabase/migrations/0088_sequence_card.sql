-- Add sequence (fill-in-blanks) card type
alter table cards drop constraint if exists cards_card_type_check;
alter table cards add constraint cards_card_type_check check (card_type in ('basic', 'multiple_choice', 'sequence'));
alter table cards add column if not exists correct_mapping jsonb;
