import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import StatsClient from "./StatsClient";

export default async function StatsPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const today = new Date().toISOString().split("T")[0];

  const [totalCards, totalReviews, todayReviews, dueData, decksCount, streakRes, dailyLogs] = await Promise.all([
    supabase.from("cards").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("reviewed_at", today),
    supabase.from("reviews").select("card_id").eq("user_id", user.id).lte("due_date", today),
    supabase.from("decks").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("study_streaks").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("daily_study_logs").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(365),
  ]);

  const dueSet = new Set((dueData.data || []).map((r: any) => r.card_id));

  // Due projection
  const { data: allReviews } = await supabase
    .from("reviews")
    .select("due_date, card_id")
    .eq("user_id", user.id)
    .gte("due_date", today)
    .order("due_date", { ascending: true });

  const dueProjection: Record<string, number> = {};
  const seen = new Set<string>();
  if (allReviews) {
    allReviews.forEach((r: any) => {
      if (!seen.has(r.card_id)) { seen.add(r.card_id); dueProjection[r.due_date] = (dueProjection[r.due_date] || 0) + 1; }
    });
  }

  const next30Days: { date: string; count: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today); d.setDate(d.getDate() + i);
    next30Days.push({ date: d.toISOString().split("T")[0], count: dueProjection[d.toISOString().split("T")[0]] || 0 });
  }

  const { data: todayRatingData } = await supabase
    .from("reviews")
    .select("rating")
    .eq("user_id", user.id)
    .gte("reviewed_at", today);

  const ratingDist = [0, 0, 0, 0];
  if (todayRatingData) todayRatingData.forEach((r: any) => { if (r.rating >= 0 && r.rating <= 3) ratingDist[r.rating]++; });

  const streak = streakRes.data || null;

  return (
    <StatsClient
      totalCards={totalCards.count || 0}
      totalReviews={totalReviews.count || 0}
      todayReviews={todayReviews.count || 0}
      dueCards={dueSet.size}
      decksCount={decksCount.count || 0}
      streak={streak}
      dailyLogs={dailyLogs.data || []}
      dueProjection={next30Days}
      ratingDistribution={ratingDist}
    />
  );
}
