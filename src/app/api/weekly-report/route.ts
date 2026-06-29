import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

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

  const { data: posts } = await admin
    .from("posts")
    .select("study_minutes, subject, study_date, created_at")
    .eq("user_id", user.id)
    .gte("study_date", weekStart)
    .lt("study_date", weekEnd)
    .order("study_date", { ascending: true });

  const totalMinutes = (posts || []).reduce((s, p) => s + (p.study_minutes || 0), 0);
  const postCount = (posts || []).length;

  const subjectMap: Record<string, number> = {};
  for (const p of posts || []) {
    const sub = p.subject || "未分類";
    subjectMap[sub] = (subjectMap[sub] || 0) + (p.study_minutes || 0);
  }
  const subjects = Object.entries(subjectMap)
    .map(([subject, minutes]) => ({ subject, minutes }))
    .sort((a, b) => b.minutes - a.minutes);

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
    const weekDays = Math.min(7, (new Date().getDay() || 7)); // Mon=1..Sun=7
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
  const textbookEntries = (textbookLogs || []).map((l: any) => ({
    title: l.textbooks?.title || "不明",
    pages: l.pages_completed,
    date: l.date,
  }));

  // Consecutive days this week
  const { data: profile } = await admin.from("profiles").select("consecutive_post_days").eq("id", user.id).single();
  const consecutiveDays = profile?.consecutive_post_days || 0;

  return NextResponse.json({
    weekStart,
    weekEnd,
    totalMinutes,
    postCount,
    subjects,
    dailyBreakdown: Object.entries(dailyMap).map(([date, minutes]) => ({ date, minutes })),
    habitRate,
    textbookPages: totalPages,
    textbookEntries,
    consecutiveDays,
  });
}
