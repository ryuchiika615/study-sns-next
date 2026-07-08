import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { notFound, redirect } from "next/navigation";
import DiscoverDeckClient from "./DiscoverDeckClient";

export default async function DiscoverDeckPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();

  const { data: deck, error: deckError } = await admin
    .from("decks")
    .select("id, name, description, created_at, user_id")
    .eq("id", params.id)
    .eq("is_public", true)
    .single();

  console.log("[discover detail debug]", { deck, deckError });

  if (!deck) notFound();

  const [profileResult, cardsResult, likeCountResult, commentCountResult, userLikeResult, userBookmarkResult, commentsResult] = await Promise.all([
    admin.from("profiles").select("display_name, username, icon_url").eq("id", deck.user_id).single(),
    admin.from("cards").select("id, front, back, tags, created_at").eq("deck_id", params.id).limit(50),
    admin.from("deck_likes").select("id", { count: "exact", head: true }).eq("deck_id", params.id),
    admin.from("deck_comments").select("id", { count: "exact", head: true }).eq("deck_id", params.id),
    supabase.from("deck_likes").select("id").eq("deck_id", params.id).eq("user_id", user.id).maybeSingle(),
    supabase.from("deck_bookmarks").select("id").eq("deck_id", params.id).eq("user_id", user.id).maybeSingle(),
    admin.from("deck_comments").select("*, user_id").eq("deck_id", params.id).order("created_at", { ascending: true }),
  ]);

  const profile = profileResult.data;
  const cards = cardsResult.data;
  const likeCount = likeCountResult.count;
  const commentCount = commentCountResult.count;
  const userLike = userLikeResult.data;
  const userBookmark = userBookmarkResult.data;
  const commentsData = commentsResult.data || [];

  // Fetch profiles for comment authors
  const commentUserIds = [...new Set(commentsData.map((c: any) => c.user_id))];
  const { data: commentProfiles } = commentUserIds.length > 0
    ? await admin.from("profiles").select("id, display_name, username").in("id", commentUserIds)
    : { data: [] };
  const commentProfileMap = new Map((commentProfiles || []).map((p: any) => [p.id, p]));
  const commentsWithProfiles = commentsData.map((c: any) => ({ ...c, profiles: commentProfileMap.get(c.user_id) || null }));

  return (
    <DiscoverDeckClient
      deck={{ ...deck, profiles: profile }}
      cards={cards || []}
      likeCount={likeCount || 0}
      commentCount={commentCount || 0}
      userLiked={!!userLike}
      userBookmarked={!!userBookmark}
      comments={commentsWithProfiles}
      userId={user.id}
    />
  );
}
