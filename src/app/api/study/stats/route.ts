import { createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().split("T")[0];

  const [totalCards, totalReviews, todayReviews, dueCount, decksCount] = await Promise.all([
    supabase.from("cards").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("reviewed_at", today),
    supabase.from("reviews").select("card_id").eq("user_id", user.id).lte("due_date", today),
    supabase.from("decks").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  // Get unique due cards
  const dueSet = new Set((dueCount.data || []).map((r: any) => r.card_id));
  const uniqueDue = dueSet.size;

  // Get review streak (consecutive days with at least one review)
  const { data: reviewDays } = await supabase
    .from("reviews")
    .select("reviewed_at")
    .eq("user_id", user.id)
    .order("reviewed_at", { ascending: false });

  let streak = 0;
  if (reviewDays && reviewDays.length > 0) {
    const uniqueDates = new Set(
      reviewDays.map((r: any) => r.reviewed_at.split("T")[0])
    );
    const sorted = Array.from(uniqueDates).sort().reverse();
    let check = new Date();
    for (const dateStr of sorted) {
      const d = new Date(dateStr + "T00:00:00");
      const diff = Math.round((check.getTime() - d.getTime()) / 86400000);
      if (diff === streak) streak++;
      else if (diff > streak) break;
    }
  }

  return NextResponse.json({
    total_cards: totalCards.count || 0,
    total_reviews: totalReviews.count || 0,
    today_reviews: todayReviews.count || 0,
    due_cards: uniqueDue,
    decks_count: decksCount.count || 0,
    streak,
  });
}
