import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { notFound, redirect } from "next/navigation";
import DiscoverDeckClient from "./DiscoverDeckClient";

export default async function DiscoverDeckPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();

  const { data: deck } = await admin
    .from("decks")
    .select("*, profiles!inner(display_name, username, icon_url)")
    .eq("id", params.id)
    .eq("is_public", true)
    .single();

  if (!deck) notFound();

  const { data: cards } = await admin
    .from("cards")
    .select("id, front, back, tags, created_at")
    .eq("deck_id", params.id)
    .limit(50);

  const { count: likeCount } = await admin
    .from("deck_likes")
    .select("id", { count: "exact", head: true })
    .eq("deck_id", params.id);

  const { count: commentCount } = await admin
    .from("deck_comments")
    .select("id", { count: "exact", head: true })
    .eq("deck_id", params.id);

  const { data: userLike } = await supabase
    .from("deck_likes")
    .select("id")
    .eq("deck_id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: userBookmark } = await supabase
    .from("deck_bookmarks")
    .select("id")
    .eq("deck_id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: commentsData } = await supabase
    .from("deck_comments")
    .select("*, profiles!inner(display_name, username, icon_url)")
    .eq("deck_id", params.id)
    .order("created_at", { ascending: true });

  return (
    <DiscoverDeckClient
      deck={{ ...deck, profiles: deck.profiles }}
      cards={cards || []}
      likeCount={likeCount || 0}
      commentCount={commentCount || 0}
      userLiked={!!userLike}
      userBookmarked={!!userBookmark}
      comments={commentsData || []}
      userId={user.id}
    />
  );
}
