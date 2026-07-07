import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { groqGenerate } from "@/lib/gemini";

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
  const weekStartStr = monday.toISOString().split("T")[0];
  const weekEndDate = new Date(monday.getTime() + 7 * 86400000);
  const weekEndStr = weekEndDate.toISOString().split("T")[0];

  const prevWeekStartDate = new Date(monday.getTime() - 7 * 86400000);
  const prevWeekStartStr = prevWeekStartDate.toISOString().split("T")[0];

  // Use Date objects instead of strings for reliable timestamptz comparison
  const weekStartISO = monday.toISOString();
  const weekEndISO = weekEndDate.toISOString();

  const { data: posts } = await admin
    .from("posts")
    .select("study_minutes, subject, created_at")
    .eq("user_id", user.id)
    .gte("created_at", weekStartISO)
    .lt("created_at", weekEndISO)
    .order("created_at", { ascending: true });

  // Debug: total posts for this user (no date filter)
  const { data: allUserPosts, count: allUserPostsCount } = await admin
    .from("posts")
    .select("id, created_at", { count: "exact", head: false })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);
  console.log("[weekly-report debug]", {
    userId: user.id,
    weekStart: weekStartStr, weekEnd: weekEndStr,
    queryStart: weekStartISO,
    queryEnd: weekEndISO,
    postsFound: posts?.length || 0,
    totalUserPosts: allUserPostsCount || 0,
    recentPosts: allUserPosts?.map(p => ({ id: p.id, created_at: p.created_at })),
    posts: posts?.slice(0, 5).map(p => ({ study_minutes: p.study_minutes, subject: p.subject, created_at: p.created_at })),
  });

  const prevWeekStartISO = prevWeekStartDate.toISOString();
  const { data: prevPosts } = await admin
    .from("posts")
    .select("study_minutes, subject, created_at")
    .eq("user_id", user.id)
    .gte("created_at", prevWeekStartISO)
    .lt("created_at", weekStartISO)
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
    const date = p.created_at?.split("T")[0];
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
      .gte("date", weekStartStr)
      .lt("date", weekEndStr);
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
    .gte("date", weekStartStr)
    .lt("date", weekEndStr)
    .order("date", { ascending: true });

  const totalPages = (textbookLogs || []).reduce((s, l) => s + (l.pages_completed || 0), 0);

  // Consecutive days this week & target info
  const { data: profile } = await admin.from("profiles").select("consecutive_post_days, target_minutes, target_date, weekly_ai_week_start, weekly_ai_comment").eq("id", user.id).single();
  const consecutiveDays = profile?.consecutive_post_days || 0;
  const targetMinutes = profile?.target_minutes || 0;
  const targetDate = profile?.target_date || null;

  // AI coaching comment (cached daily)
  const todayStr = new Date().toISOString().split("T")[0];
  const hasGroqKey = !!process.env.GROQ_API_KEY;
  let aiComment: string | null = null;
  let aiError: string | null = null;
  const cachedComment = profile?.weekly_ai_week_start === todayStr ? profile?.weekly_ai_comment : null;
  if (cachedComment) {
    aiComment = cachedComment;
  } else if (hasGroqKey) {
    try {
      const diff = totalMinutes - prevTotalMinutes;
      const diffText = diff >= 0 ? `先週より${Math.floor(diff / 60)}時間${diff % 60}分増えました` : `先週より${Math.floor(Math.abs(diff) / 60)}時間${Math.abs(diff) % 60}分減りました`;
      const subjectText = subjects.slice(0, 3).map(s => `${s.subject} ${Math.floor(s.minutes / 60)}h${s.minutes % 60}m`).join("、");

      const targetExpired = targetDate ? new Date(targetDate + "T23:59:59") < new Date() : false;
      const targetText = targetMinutes > 0 && targetDate && !targetExpired
        ? `【目標】${targetDate}までに合計${Math.floor(targetMinutes / 60)}時間${targetMinutes % 60}分（残り${Math.floor(Math.max(targetMinutes - totalMinutes, 0) / 60)}時間${Math.max(targetMinutes - totalMinutes, 0) % 60}分）`
        : targetMinutes > 0 && targetDate && targetExpired
        ? `【目標】期限切れ: ${targetDate}までに${Math.floor(targetMinutes / 60)}時間${targetMinutes % 60}分の目標は達成できませんでした。新しい目標を設定するよう勧めてください`
        : "【目標】なし";

      const prompt = `あなたは熱血勉強コーチです。以下のユーザーの週間データを見て、その人だけのオーダーメイドアドバイスを書いてください。テンプレート文章ではなく、この数字に基づいた具体的な改善策を提案してください。マークダウンは使わず、4〜5文程度で。

【週間データ】
- 今週の合計勉強時間: ${Math.floor(totalMinutes / 60)}時間${totalMinutes % 60}分
- ${diffText}
- 投稿数: ${postCount}
- 主要科目: ${subjectText || "なし"}
- 習慣達成率: ${habitRate}%
- 連続学習日数: ${consecutiveDays}日
- テキスト進捗: ${totalPages}ページ
${targetText}

【条件】
- 「お疲れ様です」などの決まり文句は絶対に使わない
- 必ず具体的な数字に触れること
- 集中時間帯のデータは不正確なので言及しないこと
- 目標が有効なら、「○曜日に△時間やろう」など具体的なスケジュール案を入れる
- 目標が期限切れなら、新しい目標設定を促す内容にする
- ユーザーにだけ届く特別なアドバイスであること`;

      aiComment = await groqGenerate(prompt);
      await admin.from("profiles").update({
        weekly_ai_week_start: todayStr,
        weekly_ai_comment: aiComment,
      }).eq("id", user.id);
    } catch (e: any) {
      console.error("AI weekly report error:", e?.message || e);
      aiError = e?.message || String(e);
      aiComment = null;
    }
  }

  return NextResponse.json({
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
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
    aiError,
    hasGroqKey,
  });
}
