import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import StudyClient from "./StudyClient";

export default async function StudyPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: decks } = await supabase
    .from("decks")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order")
    .order("created_at");

  const { data: cardCounts } = await supabase
    .from("cards")
    .select("deck_id, id")
    .eq("user_id", user.id);

  const countMap = new Map<string, number>();
  if (cardCounts) cardCounts.forEach((c: any) => countMap.set(c.deck_id, (countMap.get(c.deck_id) || 0) + 1));

  const today = new Date().toISOString().split("T")[0];
  const { data: dueCounts } = await supabase
    .from("reviews")
    .select("card_id")
    .eq("user_id", user.id)
    .lte("due_date", today);

  const { data: allCards } = await supabase
    .from("cards")
    .select("id, deck_id")
    .eq("user_id", user.id);

  const dueMap = new Map<string, number>();
  if (dueCounts && allCards) {
    const cardDeckMap = new Map(allCards.map((c: any) => [c.id, c.deck_id]));
    dueCounts.forEach((r: any) => {
      const deckId = cardDeckMap.get(r.card_id);
      if (deckId) dueMap.set(deckId, (dueMap.get(deckId) || 0) + 1);
    });
  }

  const result = (decks || []).map((d: any) => ({
    ...d,
    card_count: countMap.get(d.id) || 0,
    due_count: dueMap.get(d.id) || 0,
  }));

  // Stats
  const [totalCards, totalReviews, todayReviews] = await Promise.all([
    supabase.from("cards").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("reviewed_at", today),
  ]);

  const stats = {
    total_cards: totalCards.count || 0,
    total_reviews: totalReviews.count || 0,
    today_reviews: todayReviews.count || 0,
  };

  return <StudyClient initialDecks={result} initialStats={stats} />;
}
