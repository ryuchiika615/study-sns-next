import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { geminiGenerate } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const weekStart = monday.toISOString().split("T")[0];
  const weekEnd = new Date(monday.getTime() + 7 * 86400000).toISOString().split("T")[0];

  const prevWeekStartDate = new Date(monday.getTime() - 7 * 86400000);
  const prevWeekStart = prevWeekStartDate.toISOString().split("T")[0];

  const { data: posts } = await admin
    .from("posts")
    .select("study_minutes, subject, study_date, created_at")
    .eq("user_id", user.id)
    .gte("created_at", weekStart)
    .lte("created_at", weekEnd + "T23:59:59Z")
    .order("created_at", { ascending: true });

  // Debug: log query parameters and results
  console.log("[weekly-report debug]", {
    userId: user.id,
    weekStart, weekEnd,
    queryStart: weekStart,
    queryEnd: weekEnd + "T23:59:59Z",
    postsFound: posts?.length || 0,
    posts: posts?.slice(0, 5).map(p => ({ study_minutes: p.study_minutes, study_minutes_type: typeof p.study_minutes, study_date: p.study_date, created_at: p.created_at })),
  });

  const { data: prevPosts } = await admin
    .from("posts")
    .select("study_minutes, subject, study_date, created_at")
    .eq("user_id", user.id)
    .gte("created_at", prevWeekStart)
    .lte("created_at", weekStart + "T23:59:59Z")
    .order("created_at", { ascending: true });

  const totalMinutes = (posts || []).reduce((s, p) => s + (p.study_minutes || 0), 0);
  const prevTotalMinutes = (prevPosts || []).reduce((s, p) => s + (p.study_minutes || 0), 0);
  const postCount = (posts || []).length;

  const subjectMap: Record<string, number> = {};
  for (const p of posts || []) {
    const sub = p.subject || "未分類";
    subjectMap[sub] = (subjectMap[sub] || 0) + (p.study_minutes || 0);
  }
  const subjects = Object.entries(subjectMap)
    .map(([subject, minutes]) => ({ subject, minutes }))
    .sort((a, b) => b.minutes - a.minutes);

  // Hourly breakdown for best time analysis
  const hourlyMap: Record<string, number> = {};
  for (const p of posts || []) {
    const hour = p.created_at ? new Date(p.created_at).getHours() + "時" : "不明";
    hourlyMap[hour] = (hourlyMap[hour] || 0) + (p.study_minutes || 0);
  }
  const bestHour = Object.entries(hourlyMap).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Daily breakdown
  const dailyMap: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getTime() + i * 86400000);
    const key = d.toISOString().split("T")[0];
    dailyMap[key] = 0;
  }
  for (const p of posts || []) {
    const date = p.study_date || p.created_at?.split("T")[0];
    if (date && dailyMap[date] !== undefined) dailyMap[date] += p.study_minutes || 0;
  }

  // Habit rate this week
  const { data: habits } = await admin.from("habits").select("id").eq("user_id", user.id);
  const habitCount = habits?.length || 0;
  let habitRate = 0;
  if (habitCount > 0) {
    const { data: habitLogs } = await admin
      .from("habit_logs")
      .select("date, achieved")
      .eq("user_id", user.id)
      .gte("date", weekStart)
      .lt("date", weekEnd);
    const uniqueDates = new Set((habitLogs || []).filter(l => l.achieved).map(l => l.date));
    const weekDays = Math.min(7, (new Date().getDay() || 7));
    const totalHabitDays = weekDays;
    habitRate = totalHabitDays > 0 ? Math.round((uniqueDates.size / totalHabitDays) * 100) : 0;
  }

  // Textbook progress this week
  const { data: textbookLogs } = await admin
    .from("textbook_progress_logs")
    .select("textbook_id, pages_completed, date, textbooks(title)")
    .eq("user_id", user.id)
    .gte("date", weekStart)
    .lt("date", weekEnd)
    .order("date", { ascending: true });

  const totalPages = (textbookLogs || []).reduce((s, l) => s + (l.pages_completed || 0), 0);

  // Consecutive days this week
  const { data: profile } = await admin.from("profiles").select("consecutive_post_days").eq("id", user.id).single();
  const consecutiveDays = profile?.consecutive_post_days || 0;

  // AI coaching comment
  let aiComment: string | null = null;
  try {
    const diff = totalMinutes - prevTotalMinutes;
    const diffText = diff >= 0 ? `先週より${Math.floor(diff / 60)}時間${diff % 60}分増えました` : `先週より${Math.floor(Math.abs(diff) / 60)}時間${Math.abs(diff) % 60}分減りました`;
    const subjectText = subjects.slice(0, 3).map(s => `${s.subject} ${Math.floor(s.minutes / 60)}h${s.minutes % 60}m`).join("、");
    const bestTimeText = bestHour ? `${bestHour}台` : "不明";

    const prompt = `あなたは勉強コーチです。以下のユーザーの週間データを元に、日本語で2〜3文の励ましとアドバイスを書いてください。

【週間データ】
- 今週の合計勉強時間: ${Math.floor(totalMinutes / 60)}時間${totalMinutes % 60}分
- ${diffText}
- 投稿数: ${postCount}
- 主要科目: ${subjectText || "なし"}
- 習慣達成率: ${habitRate}%
- 最も集中している時間帯: ${bestTimeText}
- 連続学習日数: ${consecutiveDays}日
- テキスト進捗: ${totalPages}ページ

【条件】
- 「お疲れ様です」などの決まり文句は不要
- 具体的な数字に触れる
- 改善点がある場合は優しく提案
- 2〜3文で簡潔に`;

    aiComment = await geminiGenerate(prompt);
  } catch (e: any) {
    console.error("Gemini weekly report error:", e?.message || e);
    aiComment = null;
  }

  return NextResponse.json({
    weekStart,
    weekEnd,
    totalMinutes,
    prevTotalMinutes,
    postCount,
    subjects,
    dailyBreakdown: Object.entries(dailyMap).map(([date, minutes]) => ({ date, minutes })),
    habitRate,
    textbookPages: totalPages,
    consecutiveDays,
    bestHour,
    aiComment,
  });
}
