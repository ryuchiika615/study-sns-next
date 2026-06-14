import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7");
  const limit = parseInt(searchParams.get("limit") || "50");

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: rankings, error } = await supabase
    .from("posts")
    .select("user_id, study_minutes")
    .gt("study_minutes", 0)
    .gte("created_at", startDate.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 繝ｦ繝ｼ繧ｶ繝ｼ縺斐→縺ｫ髮・ｨ・  const userTotals = new Map<string, { total: number; posts: number }>();
  (rankings || []).forEach((row: any) => {
    const current = userTotals.get(row.user_id) || { total: 0, posts: 0 };
    current.total += row.study_minutes || 0;
    current.posts += 1;
    userTotals.set(row.user_id, current);
  });

  // 繧ｽ繝ｼ繝・  const sorted = [...userTotals.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, limit);

  const userIds = sorted.map(([id]) => id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .in("id", userIds);

  const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);

  const ranking = sorted.map(([userId, data], index) => ({
    rank: index + 1,
    user: profileMap.get(userId),
    total_minutes: data.total,
    post_count: data.posts,
    display_time: formatStudyTime(data.total),
  }));

  return NextResponse.json({ ranking, start: startDate.toISOString().split("T")[0], end: new Date().toISOString().split("T")[0] });
}

function formatStudyTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}譎る俣${m}蛻・;
  if (h > 0) return `${h}譎る俣`;
  return `${m}蛻・;
}
