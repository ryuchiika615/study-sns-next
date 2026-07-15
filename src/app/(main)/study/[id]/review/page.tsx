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

  const { data: cards } = await supabase
    .from("cards")
    .select("*")
    .eq("deck_id", params.id)
    .eq("user_id", user.id)
    .order("created_at");

  if (!cards?.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-4">カードがありません</p>
          <a href={`/study/${params.id}`} className="text-primary text-sm">デッキに戻る</a>
        </div>
      </div>
    );
  }

  // Fetch latest review rating for each card
  const { data: reviews } = await supabase
    .from("reviews")
    .select("card_id, rating")
    .in("card_id", cards.map(c => c.id))
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const ratingMap: Record<string, number> = {};
  if (reviews) {
    for (const r of reviews) {
      if (!(r.card_id in ratingMap)) {
        ratingMap[r.card_id] = r.rating;
      }
    }
  }

  return <ReviewClient deck={deck} cards={cards} ratingMap={ratingMap} />;
}
