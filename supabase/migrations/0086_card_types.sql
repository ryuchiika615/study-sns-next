-- Add card type support (basic / multiple_choice)
alter table cards add column if not exists card_type text not null default 'basic' check (card_type in ('basic', 'multiple_choice'));
alter table cards add column if not exists options text[];
alter table cards add column if not exists correct_answer int;
