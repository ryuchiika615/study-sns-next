import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const [defs, uas] = await Promise.all([
    admin.from("achievement_definitions").select("id, condition_type, condition_value"),
    admin.from("user_achievements").select("achievement_id, earned_at").eq("user_id", user.id),
  ]);

  const earnedIds = new Set((uas.data || []).filter((u: any) => u.earned_at).map((u: any) => u.achievement_id));
  const defsList = defs.data || [];

  // Calc current progress for each unearned achievement
  const { data: posts } = await admin.from("posts").select("study_minutes").eq("user_id", user.id);
  const totalMinutes = (posts || []).reduce((s, p) => s + (p.study_minutes || 0), 0);

  const { data: profile } = await admin.from("profiles").select("consecutive_post_days").eq("id", user.id).single();
  const consecutiveDays = profile?.consecutive_post_days || 0;

  const { count: postCount } = await admin.from("posts").select("id", { count: "exact", head: true }).eq("user_id", user.id);

  const { count: challengeWinCount } = await admin.from("challenges").select("id", { count: "exact", head: true }).eq("winner_id", user.id);

  const { data: distinctSubjects } = await admin.rpc("get_distinct_subjects", { p_user_id: user.id });
  const subjectCount = distinctSubjects || 0;

  const { data: habitLogs } = await admin.from("habit_logs").select("date, achieved").eq("user_id", user.id).order("date", { ascending: false }).limit(60);
  let maxHabitStreak = 0;
  if (habitLogs) {
    let current = 0;
    const seen = new Set<string>();
    for (const log of habitLogs) {
      if (log.achieved && !seen.has(log.date)) { current++; seen.add(log.date); }
      else if (!log.achieved) { maxHabitStreak = Math.max(maxHabitStreak, current); current = 0; }
    }
    maxHabitStreak = Math.max(maxHabitStreak, current);
  }

  const newlyEarned: string[] = [];

  for (const def of defsList) {
    if (earnedIds.has(def.id)) continue;
    let progress = 0;
    switch (def.condition_type) {
      case "study_minutes": progress = totalMinutes; break;
      case "consecutive_days": progress = consecutiveDays; break;
      case "post_count": progress = postCount || 0; break;
      case "challenge_wins": progress = challengeWinCount || 0; break;
      case "subject_count": progress = subjectCount; break;
      case "habit_rate": progress = maxHabitStreak; break;
    }
    if (progress >= def.condition_value) {
      await admin.from("user_achievements").upsert({
        user_id: user.id,
        achievement_id: def.id,
        progress,
        earned_at: new Date().toISOString(),
        claimed: false,
      }, { onConflict: "user_id, achievement_id" });
      newlyEarned.push(def.id);
    }
  }

  // Also fetch titles/icons for the newly earned ones
  let newAchievements: any[] = [];
  if (newlyEarned.length > 0) {
    const { data: details } = await admin.from("achievement_definitions").select("*").in("id", newlyEarned);
    newAchievements = details || [];
  }

  return NextResponse.json({ newlyEarned, achievements: newAchievements });
}
