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

  const { data: profile } = await admin.from("profiles").select("consecutive_post_days, created_at").eq("id", targetUserId).single();
  if (!profile) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 1. Study consistency (0-40 points): based on consecutive days
  const consecutiveDays = profile.consecutive_post_days || 0;
  const consistencyScore = Math.min(40, Math.round((consecutiveDays / 30) * 40));

  // 2. Study volume (0-25 points): based on total study minutes (target: 100h = 6000min)
  const { data: posts } = await admin.from("posts").select("study_minutes").eq("user_id", targetUserId);
  const totalMinutes = (posts || []).reduce((s, p) => s + (p.study_minutes || 0), 0);
  const volumeScore = Math.min(25, Math.round((totalMinutes / 6000) * 25));

  // 3. Habit completion (0-20 points): recent habit streak
  const { data: habitLogs } = await admin.from("habit_logs").select("date, achieved").eq("user_id", targetUserId).order("date", { ascending: false }).limit(30);
  const habitRate = habitLogs && habitLogs.length > 0
    ? Math.round((habitLogs.filter(l => l.achieved).length / habitLogs.length) * 20)
    : 0;

  // 4. Subject variety (0-15 points): how many distinct subjects
  const { data: distinctSubjects } = await admin.rpc("get_distinct_subjects", { p_user_id: targetUserId });
  const subjectCount = distinctSubjects || 0;
  const varietyScore = Math.min(15, subjectCount * 3);

  const total = consistencyScore + volumeScore + habitRate + varietyScore;
  const level = total >= 90 ? "S" : total >= 75 ? "A" : total >= 60 ? "B" : total >= 45 ? "C" : total >= 30 ? "D" : "E";

  return NextResponse.json({
    user_id: targetUserId,
    total,
    level,
    breakdown: {
      consistency: { score: consistencyScore, max: 40, label: "学習継続" },
      volume: { score: volumeScore, max: 25, label: "学習量" },
      habits: { score: habitRate, max: 20, label: "習慣達成" },
      variety: { score: varietyScore, max: 15, label: "科目幅" },
    },
  });
}
