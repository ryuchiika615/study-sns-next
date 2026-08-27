import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  // プロフィールから他ユーザーの公開スコアも確認できる。
  // 投稿本文や習慣の詳細は返さず、集計結果だけを公開する。
  const targetUserId = req.nextUrl.searchParams.get("user_id") || user.id;

  // ランキングも同じ計算式で出すため、公開プロフィールの集計値だけをまとめて取得する。
  // 投稿本文や個別の習慣はレスポンスに含めない。
  const [{ data: profiles }, { data: posts }, { data: habitLogs }] = await Promise.all([
    admin.from("profiles").select("id, consecutive_post_days"),
    admin.from("posts").select("user_id, study_minutes, subject"),
    admin.from("habit_logs").select("user_id, date, achieved").order("date", { ascending: false }),
  ]);
  const profile = (profiles || []).find((item: any) => item.id === targetUserId);
  if (!profile) return NextResponse.json({ error: "not found" }, { status: 404 });

  const calculateScore = (profileId: string, consecutivePostDays: number) => {
    const userPosts = (posts || []).filter((post: any) => post.user_id === profileId);
    const totalMinutes = userPosts.reduce((sum: number, post: any) => sum + (Number(post.study_minutes) || 0), 0);
    const subjectCount = new Set(userPosts.map((post: any) => String(post.subject || "").trim()).filter(Boolean)).size;
    const recentHabitLogs = (habitLogs || []).filter((log: any) => log.user_id === profileId).slice(0, 30);
    const consistencyScore = Math.min(40, Math.round(((Number(consecutivePostDays) || 0) / 30) * 40));
    const volumeScore = Math.min(25, Math.round((totalMinutes / 6000) * 25));
    const habitRate = recentHabitLogs.length > 0
      ? Math.round((recentHabitLogs.filter((log: any) => log.achieved).length / recentHabitLogs.length) * 20)
      : 0;
    const varietyScore = Math.min(15, subjectCount * 3);
    return {
      total: consistencyScore + volumeScore + habitRate + varietyScore,
      breakdown: {
        consistency: { score: consistencyScore, max: 40, label: "学習継続" },
        volume: { score: volumeScore, max: 25, label: "学習量" },
        habits: { score: habitRate, max: 20, label: "習慣達成" },
        variety: { score: varietyScore, max: 15, label: "科目幅" },
      },
    };
  };

  const result = calculateScore(targetUserId, profile.consecutive_post_days || 0);
  const allScores = (profiles || []).map((item: any) => calculateScore(item.id, item.consecutive_post_days || 0).total);
  const rank = 1 + allScores.filter((score) => score > result.total).length;
  const level = result.total >= 90 ? "S" : result.total >= 75 ? "A" : result.total >= 60 ? "B" : result.total >= 45 ? "C" : result.total >= 30 ? "D" : "E";

  return NextResponse.json({
    user_id: targetUserId,
    total: result.total,
    level,
    rank,
    total_users: allScores.length,
    breakdown: result.breakdown,
  });
}
