import { createServerSupabase } from "@/lib/supabase-server";
import { redirect, notFound } from "next/navigation";
import ReviewClient from "./ReviewClient";

export default async function ReviewPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: deck } = await supabase
    .from("decks")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!deck) notFound();

  const today = new Date().toISOString().split("T")[0];

  // Get due reviews for this deck
  const { data: dueReviews } = await supabase
    .from("reviews")
    .select("card_id, due_date, interval_days, repetitions, easiness_factor")
    .eq("user_id", user.id)
    .lte("due_date", today);

  const { data: allCards } = await supabase
    .from("cards")
    .select("id")
    .eq("deck_id", params.id)
    .eq("user_id", user.id);

  const dueCardIds = new Set<string>();
  if (dueReviews && allCards) {
    const deckCardIds = new Set(allCards.map((c: any) => c.id));
    dueReviews.forEach((r: any) => {
      if (deckCardIds.has(r.card_id)) dueCardIds.add(r.card_id);
    });
  }

  // New cards (never reviewed)
  const { data: reviewedCards } = await supabase
    .from("reviews")
    .select("card_id")
    .eq("user_id", user.id);

  const reviewedSet = new Set((reviewedCards || []).map((r: any) => r.card_id));
  const newCardIds = (allCards || [])
    .filter((c: any) => !reviewedSet.has(c.id))
    .map((c: any) => c.id);

  const allIds = Array.from(new Set([...Array.from(dueCardIds), ...newCardIds]));

  if (allIds.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-4">復習するカードはありません</p>
          <a href={`/study/${params.id}`} className="text-primary text-sm">デッキに戻る</a>
        </div>
      </div>
    );
  }

  const { data: cards } = await supabase
    .from("cards")
    .select("*")
    .in("id", allIds)
    .eq("user_id", user.id);

  return <ReviewClient deck={deck} cards={cards || []} />;
}
