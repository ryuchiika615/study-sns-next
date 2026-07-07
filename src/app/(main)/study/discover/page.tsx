import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import DiscoverClient from "./DiscoverClient";

export default async function DiscoverPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: decks } = await supabase
    .from("decks")
    .select("id, name, description, created_at, user_id, profiles!inner(display_name, username, avatar_url)")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(20);

  const deckIds = (decks || []).map((d: any) => d.id);
  const [cardCounts, likeCounts] = await Promise.all([
    deckIds.length > 0
      ? supabase.from("cards").select("deck_id").in("deck_id", deckIds)
      : Promise.resolve({ data: [] }),
    deckIds.length > 0
      ? supabase.from("deck_likes").select("deck_id").in("deck_id", deckIds)
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

  return <DiscoverClient initialDecks={result} userId={user.id} />;
}
