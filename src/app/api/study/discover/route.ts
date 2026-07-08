import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const offset = (page - 1) * limit;
  const search = searchParams.get("q") || "";
  const sort = searchParams.get("sort") || "popular";
  const deckId = searchParams.get("deck_id");

  if (deckId) {
    const { data: deck } = await admin
      .from("decks")
      .select("*, profiles!inner(display_name, username, icon_url)")
      .eq("id", deckId)
      .eq("is_public", true)
      .single();

    if (!deck) return NextResponse.json({ deck: null });

    const { data: cards } = await admin
      .from("cards")
      .select("id, front, back, tags, created_at")
      .eq("deck_id", deckId)
      .limit(50);

    const { count: likeCount } = await admin
      .from("deck_likes")
      .select("id", { count: "exact", head: true })
      .eq("deck_id", deckId);

    const { count: commentCount } = await admin
      .from("deck_comments")
      .select("id", { count: "exact", head: true })
      .eq("deck_id", deckId);

    const { data: userLike } = await supabase
      .from("deck_likes")
      .select("id")
      .eq("deck_id", deckId)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: userBookmark } = await supabase
      .from("deck_bookmarks")
      .select("id")
      .eq("deck_id", deckId)
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      deck: {
        ...deck,
        profiles: deck.profiles,
        card_count: cards?.length || 0,
        cards: cards || [],
        like_count: likeCount || 0,
        comment_count: commentCount || 0,
        user_liked: !!userLike,
        user_bookmarked: !!userBookmark,
      },
    });
  }

  // List public decks
  let query = admin
    .from("decks")
    .select("id, name, description, created_at, user_id, profiles!inner(display_name, username, icon_url)")
    .eq("is_public", true);

  if (search) query = query.ilike("name", `%${search}%`);

  if (sort === "newest") query = query.order("created_at", { ascending: false });
  else query = query.order("created_at", { ascending: false }); // default: newest

  const { data: decks } = await query.range(offset, offset + limit - 1);

  // Batch get card counts and like counts
  const deckIds = (decks || []).map((d: any) => d.id);
  const [cardCounts, likeCounts] = await Promise.all([
    deckIds.length > 0
      ? admin.from("cards").select("deck_id").in("deck_id", deckIds)
      : Promise.resolve({ data: [] }),
    deckIds.length > 0
      ? admin.from("deck_likes").select("deck_id").in("deck_id", deckIds)
      : Promise.resolve({ data: [] }),
  ]);

  const cardCountMap = new Map<string, number>();
  (cardCounts.data || []).forEach((c: any) => cardCountMap.set(c.deck_id, (cardCountMap.get(c.deck_id) || 0) + 1));

  const likeCountMap = new Map<string, number>();
  (likeCounts.data || []).forEach((l: any) => likeCountMap.set(l.deck_id, (likeCountMap.get(l.deck_id) || 0) + 1));

  const result = (decks || []).map((d: any) => ({
    ...d,
    card_count: cardCountMap.get(d.id) || 0,
    like_count: likeCountMap.get(d.id) || 0,
  }));

  // Sort by popularity if needed
  if (sort === "popular") result.sort((a, b) => b.like_count - a.like_count);

  return NextResponse.json({ decks: result });
}
