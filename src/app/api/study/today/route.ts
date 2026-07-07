import { createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().split("T")[0];

  // Get all cards that have a review due today or earlier
  const { data: dueReviews } = await supabase
    .from("reviews")
    .select("card_id, due_date, interval_days, repetitions, easiness_factor")
    .eq("user_id", user.id)
    .lte("due_date", today)
    .order("due_date", { ascending: true });

  // Get latest review per card (there could be multiple)
  const latestPerCard = new Map<string, any>();
  if (dueReviews) {
    for (const r of dueReviews) {
      const existing = latestPerCard.get(r.card_id);
      if (!existing || r.due_date > existing.due_date) {
        latestPerCard.set(r.card_id, r);
      }
    }
  }

  const dueCardIds = Array.from(latestPerCard.keys());

  // Also get cards that have never been reviewed (new cards)
  const { data: allCards } = await supabase
    .from("cards")
    .select("id")
    .eq("user_id", user.id);

  const allCardIds = new Set((allCards || []).map((c: any) => c.id));
  const reviewedCardIds = new Set(dueCardIds);
  const newCardIds = Array.from(allCardIds).filter((id) => !reviewedCardIds.has(id));

  // Limit new cards to 20 per day
  const newCardsLimit = 20;
  const limitedNewIds = newCardIds.slice(0, newCardsLimit);

  const allDueIds = [...dueCardIds, ...limitedNewIds];

  if (allDueIds.length === 0) {
    return NextResponse.json({ cards: [], due_count: 0, new_count: 0 });
  }

  const { data: cards } = await supabase
    .from("cards")
    .select("*, decks!inner(name)")
    .in("id", allDueIds)
    .eq("user_id", user.id);

  // Include deck name
  const result = (cards || []).map((c: any) => ({
    ...c,
    deck_name: c.decks?.name || "",
    review_state: latestPerCard.has(c.id)
      ? { due_date: latestPerCard.get(c.id).due_date, interval: latestPerCard.get(c.id).interval_days, reps: latestPerCard.get(c.id).repetitions, ease: latestPerCard.get(c.id).easiness_factor }
      : null,
  }));

  return NextResponse.json({
    cards: result,
    due_count: dueCardIds.length,
    new_count: limitedNewIds.length,
  });
}
