-- Fix: add ON DELETE CASCADE to likes and comments post_id foreign keys
-- The current constraints lack CASCADE, preventing admin post deletion
-- This uses dynamic SQL to handle auto-generated constraint names

do $$
declare
  rec record;
begin
  for rec in
    select conname, conrelid::regclass::text as tbl
    from pg_constraint
    where confrelid = 'posts'::regclass
      and contype = 'f'
      and conrelid in ('likes'::regclass, 'comments'::regclass)
  loop
    execute 'alter table ' || rec.tbl || ' drop constraint ' || rec.conname;
  end loop;
end $$;

alter table likes
  add constraint fk_likes_post
    foreign key (post_id)
    references posts(id)
    on delete cascade;

alter table comments
  add constraint fk_comments_post
    foreign key (post_id)
    references posts(id)
    on delete cascade;
