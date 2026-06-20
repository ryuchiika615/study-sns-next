import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import RankingsClient from "./RankingsClient";

const DEFAULT_DAYS = 7;

export default async function RankingsPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const rankingsData = await fetchRankingsData(supabase, DEFAULT_DAYS);

  return (
    <RankingsClient
      initialRanking={rankingsData}
      initialDays={DEFAULT_DAYS}
    />
  );
}

async function fetchRankingsData(supabase: any, days: number) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: posts } = await supabase
    .from("posts")
    .select("user_id, study_minutes")
    .gt("study_minutes", 0)
    .gte("created_at", startDate.toISOString());

  const userTotals = new Map<string, { total: number; posts: number }>();
  (posts || []).forEach((row: any) => {
    const current = userTotals.get(row.user_id) || { total: 0, posts: 0 };
    current.total += row.study_minutes || 0;
    current.posts += 1;
    userTotals.set(row.user_id, current);
  });

  const sorted = Array.from(userTotals.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 50);

  const userIds = sorted.map(([id]) => id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, icon_url")
    .in("id", userIds);

  const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);

  return sorted.map(([userId, data], index) => ({
    rank: index + 1,
    user: profileMap.get(userId),
    total_minutes: data.total,
    post_count: data.posts,
    display_time: formatStudyTime(data.total),
  }));
}

function formatStudyTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}時間${m}分`;
  if (h > 0) return `${h}時間`;
  return `${m}分`;
}
