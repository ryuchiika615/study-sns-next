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
  const [{ data: profiles }, { data: posts }, { data: habitLogs }, { data: todos }, { data: textbooks }] = await Promise.all([
    admin.from("profiles").select("id, consecutive_post_days"),
    admin.from("posts").select("user_id, study_minutes, workout_minutes, subject, created_at"),
    admin.from("habit_logs").select("user_id, date, achieved").order("date", { ascending: false }),
    admin.from("todos").select("user_id, completed"),
    admin.from("textbooks").select("user_id, total_pages, pages_completed"),
  ]);
  const profile = (profiles || []).find((item: any) => item.id === targetUserId);
  if (!profile) return NextResponse.json({ error: "not found" }, { status: 404 });

  const calculateScore = (profileId: string, consecutivePostDays: number) => {
    const userPosts = (posts || []).filter((post: any) => post.user_id === profileId);
    const totalMinutes = userPosts.reduce((sum: number, post: any) => sum + (Number(post.study_minutes) || 0), 0);
    const totalWorkoutMinutes = userPosts.reduce((sum: number, post: any) => sum + (Number(post.workout_minutes) || 0), 0);
    const subjectCount = new Set(userPosts.map((post: any) => String(post.subject || "").trim()).filter(Boolean)).size;
    const recentHabitLogs = (habitLogs || []).filter((log: any) => log.user_id === profileId).slice(0, 30);
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 29);
    recentDate.setHours(0, 0, 0, 0);
    const activeDays = new Set(userPosts.filter((post: any) => post.created_at && new Date(post.created_at) >= recentDate).map((post: any) => new Date(post.created_at).toISOString().slice(0, 10))).size;
    const userTodos = (todos || []).filter((todo: any) => todo.user_id === profileId);
    const completedTodos = userTodos.filter((todo: any) => todo.completed).length;
    const userTextbooks = (textbooks || []).filter((textbook: any) => textbook.user_id === profileId && Number(textbook.total_pages) > 0);
    const averageProgress = userTextbooks.length > 0
      ? userTextbooks.reduce((sum: number, textbook: any) => sum + Math.min(1, (Number(textbook.pages_completed) || 0) / Number(textbook.total_pages)), 0) / userTextbooks.length
      : 0;
    const consistencyScore = Math.min(18, Math.round(((Number(consecutivePostDays) || 0) / 30) * 18));
    const volumeScore = Math.min(18, Math.round((totalMinutes / 6000) * 18));
    const activeScore = Math.min(14, Math.round((activeDays / 15) * 14));
    const habitRate = recentHabitLogs.length > 0
      ? Math.round((recentHabitLogs.filter((log: any) => log.achieved).length / recentHabitLogs.length) * 15)
      : 0;
    const taskScore = Math.min(12, Math.round((completedTodos / 10) * 12));
    const varietyScore = Math.min(10, subjectCount * 2);
    const workoutScore = Math.min(5, Math.round((totalWorkoutMinutes / 600) * 5));
    const progressScore = Math.min(8, Math.round(averageProgress * 8));
    const breakdown = {
      consistency: { score: consistencyScore, max: 18, label: "学習継続", hint: "連続して記録する" },
      volume: { score: volumeScore, max: 18, label: "学習量", hint: "勉強時間を積む" },
      active_days: { score: activeScore, max: 14, label: "活動日数", hint: "今月あと1日記録" },
      habits: { score: habitRate, max: 15, label: "習慣達成", hint: "習慣をチェックする" },
      tasks: { score: taskScore, max: 12, label: "タスク完了", hint: "タスクを完了にする" },
      variety: { score: varietyScore, max: 10, label: "科目幅", hint: "新しい科目も記録" },
      workout: { score: workoutScore, max: 5, label: "運動", hint: "筋トレも記録する" },
      progress: { score: progressScore, max: 8, label: "教材進捗", hint: "教材のページを進める" },
    };
    return {
      total: Object.values(breakdown).reduce((sum, item) => sum + item.score, 0),
      breakdown,
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
