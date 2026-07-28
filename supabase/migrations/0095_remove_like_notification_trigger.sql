-- Remove duplicate like notification trigger
-- The API route (api/posts/reactions/route.ts) already handles notification insertion with dedup.
-- The database trigger causes race condition duplicates.
DROP TRIGGER IF EXISTS trg_notify_on_reaction ON public.post_reactions;
DROP FUNCTION IF EXISTS notify_on_reaction() CASCADE;
