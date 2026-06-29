import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const [defsResult, userResult] = await Promise.all([
    admin.from("achievement_definitions").select("*").order("sort_order", { ascending: true }),
    admin.from("user_achievements").select("*").eq("user_id", user.id),
  ]);

  const defs = defsResult.data || [];
  const userAchievements = userResult.data || [];

  // Calculate current progress for each achievement
  const { data: posts } = await admin.from("posts").select("study_minutes").eq("user_id", user.id);
  const totalMinutes = (posts || []).reduce((s, p) => s + (p.study_minutes || 0), 0);

  const { data: profile } = await admin.from("profiles").select("consecutive_post_days").eq("id", user.id).single();
  const consecutiveDays = profile?.consecutive_post_days || 0;

  const { data: postCountData } = await admin.from("posts").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  const postCount = postCountData?.length || 0;

  const { data: challengeWins } = await admin.from("challenges").select("id", { count: "exact", head: true }).eq("winner_id", user.id);
  const challengeWinCount = challengeWins?.length || 0;

  const { data: distinctSubjects } = await admin.rpc("get_distinct_subjects", { p_user_id: user.id });
  const subjectCount = distinctSubjects || 0;

  const { data: habitLogs } = await admin.from("habit_logs").select("date, achieved").eq("user_id", user.id).order("date", { ascending: false }).limit(60);
  let maxHabitStreak = 0;
  if (habitLogs) {
    let current = 0;
    const seen = new Set<string>();
    for (const log of habitLogs) {
      if (log.achieved && !seen.has(log.date)) {
        current++;
        seen.add(log.date);
      } else if (!log.achieved) {
        maxHabitStreak = Math.max(maxHabitStreak, current);
        current = 0;
      }
    }
    maxHabitStreak = Math.max(maxHabitStreak, current);
  }

  const result = defs.map((def: any) => {
    const ua = userAchievements.find((u: any) => u.achievement_id === def.id);

    let progress = ua?.progress || 0;
    switch (def.condition_type) {
      case "study_minutes":
        progress = totalMinutes;
        break;
      case "consecutive_days":
        progress = consecutiveDays;
        break;
      case "post_count":
        progress = postCount;
        break;
      case "challenge_wins":
        progress = challengeWinCount;
        break;
      case "subject_count":
        progress = subjectCount;
        break;
      case "habit_rate":
        progress = maxHabitStreak;
        break;
    }

    return {
      ...def,
      progress,
      earned: !!ua?.earned_at,
      earned_at: ua?.earned_at || null,
      claimed: ua?.claimed || false,
    };
  });

  return NextResponse.json({ achievements: result });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { achievement_id } = await req.json();
  if (!achievement_id) return NextResponse.json({ error: "achievement_id required" }, { status: 400 });

  const admin = createAdminClient();

  const { data: ua } = await admin.from("user_achievements").select("*").eq("user_id", user.id).eq("achievement_id", achievement_id).single();
  if (!ua || !ua.earned_at) return NextResponse.json({ error: "not earned yet" }, { status: 400 });
  if (ua.claimed) return NextResponse.json({ error: "already claimed" }, { status: 400 });

  const { data: def } = await admin.from("achievement_definitions").select("*").eq("id", achievement_id).single();
  if (!def) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Grant reward
  if (def.reward_type === "points") {
    const { data: profile } = await admin.from("profiles").select("exchange_points").eq("id", user.id).single();
    await admin.from("profiles").update({ exchange_points: (profile?.exchange_points || 0) + def.reward_value }).eq("id", user.id);
  } else if (def.reward_type === "title") {
    const titleNames: Record<string, string> = {
      "study_500h": "知識の探求者",
      "study_1000h": "至高の学習者",
      "streak_30": "連続勉強達人",
      "streak_365": "年間無欠",
      "posts_500": "投稿の達人",
      "habits_30": "習慣化マスター",
      "challenge_10": "バトルマスター",
      "challenge_50": "無敗の王者",
      "subjects_10": "オールラウンダー",
    };
    const titleName = titleNames[achievement_id] || def.title;
    // Check if user already has this title
    const { data: existingItems } = await admin.from("user_items").select("id").eq("user_id", user.id).eq("item_name", titleName).maybeSingle();
    if (!existingItems) {
      await admin.from("user_items").insert({
        user_id: user.id,
        item_name: titleName,
        category: "title",
        rarity: "SSR",
      });
    }
  }

  await admin.from("user_achievements").update({ claimed: true }).eq("user_id", user.id).eq("achievement_id", achievement_id);

  return NextResponse.json({ success: true, reward_type: def.reward_type, reward_value: def.reward_value });
}
