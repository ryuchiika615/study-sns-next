-- Add day-of-week support to habits
alter table habits add column if not exists days integer[] not null default '{0,1,2,3,4,5,6}';
