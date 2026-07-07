import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import StudyClient from "./StudyClient";

export default async function StudyPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [decksRes, cardCountsRes, dueCountsRes, allCardsRes, totalCards, totalReviews, todayReviews, streakRes] = await Promise.all([
    supabase.from("decks").select("*").eq("user_id", user.id).order("sort_order").order("created_at"),
    supabase.from("cards").select("deck_id, id").eq("user_id", user.id),
    supabase.from("reviews").select("card_id").eq("user_id", user.id).lte("due_date", new Date().toISOString().split("T")[0]),
    supabase.from("cards").select("id, deck_id").eq("user_id", user.id),
    supabase.from("cards").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("reviewed_at", new Date().toISOString().split("T")[0]),
    supabase.from("study_streaks").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  const countMap = new Map<string, number>();
  if (cardCountsRes.data) cardCountsRes.data.forEach((c: any) => countMap.set(c.deck_id, (countMap.get(c.deck_id) || 0) + 1));

  const dueMap = new Map<string, number>();
  if (dueCountsRes.data && allCardsRes.data) {
    const cardDeckMap = new Map(allCardsRes.data.map((c: any) => [c.id, c.deck_id]));
    dueCountsRes.data.forEach((r: any) => {
      const deckId = cardDeckMap.get(r.card_id);
      if (deckId) dueMap.set(deckId, (dueMap.get(deckId) || 0) + 1);
    });
  }

  const result = (decksRes.data || []).map((d: any) => ({
    ...d,
    card_count: countMap.get(d.id) || 0,
    due_count: dueMap.get(d.id) || 0,
  }));

  const streak = streakRes.data || { current_streak: 0, longest_streak: 0, last_study_date: null };

  return (
    <StudyClient
      initialDecks={result}
      initialStats={{
        total_cards: totalCards.count || 0,
        total_reviews: totalReviews.count || 0,
        today_reviews: todayReviews.count || 0,
      }}
      initialStreak={streak}
    />
  );
}
