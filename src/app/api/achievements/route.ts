import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

async function calcProgress(userId: string, admin: ReturnType<typeof createAdminClient>) {
  const { data: posts } = await admin.from("posts").select("study_minutes").eq("user_id", userId);
  const totalMinutes = (posts || []).reduce((s, p) => s + (p.study_minutes || 0), 0);

  // 連続学習系の実績は、投稿が途切れた時点で下がる現在値ではなく、
  // 学習カードを続けた「最高連続学習日数」で判定する。
  const { data: studyStreak } = await admin
    .from("study_streaks")
    .select("longest_streak")
    .eq("user_id", userId)
    .maybeSingle();
  const consecutiveDays = studyStreak?.longest_streak || 0;

  const { data: postCountData, count: postCount } = await admin.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId);

  const { data: challengeWins, count: challengeWinCount } = await admin.from("challenges").select("id", { count: "exact", head: true }).eq("winner_id", userId);

  const { data: distinctSubjects } = await admin.rpc("get_distinct_subjects", { p_user_id: userId });
  const subjectCount = distinctSubjects || 0;

  const { data: habitLogs } = await admin.from("habit_logs").select("date, achieved").eq("user_id", userId).order("date", { ascending: false }).limit(60);
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

  return { totalMinutes, consecutiveDays, postCount: postCount || 0, challengeWinCount: challengeWinCount || 0, subjectCount, maxHabitStreak };
}

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const [defsResult, userResult, progress, titleRewardMapResult, titleRewardResult] = await Promise.all([
    admin.from("achievement_definitions").select("*").order("sort_order", { ascending: true }),
    admin.from("user_achievements").select("*").eq("user_id", user.id),
    calcProgress(user.id, admin),
    admin.from("achievement_title_character_rewards").select("achievement_id, definition_id, title_character_definitions(character, rarity)"),
    admin.from("user_achievement_title_rewards").select("achievement_id, claimed_at").eq("user_id", user.id),
  ]);

  const defs = defsResult.data || [];
  const userAchievements = userResult.data || [];
  const titleRewardMap = new Map((titleRewardMapResult.data || []).map((row: any) => [row.achievement_id, row]));
  const titleRewardClaims = new Map((titleRewardResult.data || []).map((row: any) => [row.achievement_id, row]));
  const { totalMinutes, consecutiveDays, postCount, challengeWinCount, subjectCount, maxHabitStreak } = progress;

  const newlyEarned: string[] = [];

  const result = await Promise.all(defs.map(async (def: any) => {
    const ua = userAchievements.find((u: any) => u.achievement_id === def.id);

    let currentProgress = ua?.progress || 0;
    switch (def.condition_type) {
      case "study_minutes": currentProgress = totalMinutes; break;
      case "consecutive_days": currentProgress = consecutiveDays; break;
      case "post_count": currentProgress = postCount; break;
      case "challenge_wins": currentProgress = challengeWinCount; break;
      case "subject_count": currentProgress = subjectCount; break;
      case "habit_rate": currentProgress = maxHabitStreak; break;
    }

    const isComplete = currentProgress >= def.condition_value;
    const alreadyEarned = !!ua?.earned_at;

    // Auto-earn if condition met but not yet earned
    if (isComplete && !alreadyEarned) {
      await admin.from("user_achievements").upsert({
        user_id: user.id,
        achievement_id: def.id,
        progress: currentProgress,
        earned_at: new Date().toISOString(),
        claimed: false,
      }, { onConflict: "user_id, achievement_id" });
      newlyEarned.push(def.id);
    } else if (ua && !alreadyEarned) {
      // Update progress only
      await admin.from("user_achievements").upsert({
        user_id: user.id,
        achievement_id: def.id,
        progress: currentProgress,
      }, { onConflict: "user_id, achievement_id" });
    }

    const titleReward = titleRewardMap.get(def.id);
    const titleRewardClaim = titleRewardClaims.get(def.id);
    return {
      ...def,
      progress: currentProgress,
      earned: alreadyEarned || isComplete,
      earned_at: ua?.earned_at || (isComplete ? new Date().toISOString() : null),
      claimed: ua?.claimed || false,
      title_character: titleReward?.title_character_definitions?.character || null,
      title_character_rarity: titleReward?.title_character_definitions?.rarity || null,
      title_reward_pending: Boolean((alreadyEarned || isComplete) && titleReward && !titleRewardClaim?.claimed_at),
      title_reward_claimed: Boolean(titleRewardClaim?.claimed_at),
    };
  }));

  return NextResponse.json({ achievements: result, newlyEarned });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
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
