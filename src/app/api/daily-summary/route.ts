import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import webpush from "web-push";

export const dynamic = "force-dynamic";

async function sendSummaryForUser(supabase: any, admin: any, userId: string, date: string) {
  const dayStart = `${date}T00:00:00Z`;
  const dayEnd = `${date}T23:59:59Z`;

  const { data: userPosts } = await supabase
    .from("posts").select("id").eq("user_id", userId);

  const postIds = (userPosts || []).map((p: any) => p.id);
  let reactionsCount = 0;
  if (postIds.length > 0) {
    const { data: reactions } = await supabase
      .from("post_reactions")
      .select("post_id, user_id")
      .in("post_id", postIds)
      .gte("created_at", dayStart).lte("created_at", dayEnd);
    const unique = new Set((reactions || []).map((r: any) => `${r.post_id}-${r.user_id}`));
    reactionsCount = unique.size;
  }

  const { count: followersCount } = await supabase
    .from("follows").select("*", { count: "exact", head: true })
    .eq("following_id", userId);

  const { data: dayPosts } = await supabase
    .from("posts").select("study_minutes")
    .eq("user_id", userId)
    .gte("created_at", dayStart).lte("created_at", dayEnd);

  const studyMinutes = (dayPosts || []).reduce((sum: number, p: any) => sum + (p.study_minutes || 0), 0);

  const { data: profile } = await supabase
    .from("profiles").select("exchange_points, consecutive_post_days, last_post_date").eq("id", userId).single();

  const currentPoints = profile?.exchange_points || 0;
  const followerMultiplier = 1 + ((followersCount || 0) * 0.1);

  // Calculate actual streak bonus earned (already awarded when user posted)
  let streakBonus = 0;
  const consecutiveDays = profile?.consecutive_post_days || 0;
  const lastPostDate = profile?.last_post_date;
  if (lastPostDate === date) {
    streakBonus = consecutiveDays <= 7 ? Math.pow(2, consecutiveDays - 1) : 100;
  }
  streakBonus = Math.floor(streakBonus);

  const pointsEarned = (reactionsCount * 10) + Math.floor(studyMinutes * followerMultiplier);
  const totalPoints = currentPoints + pointsEarned;

  await supabase.from("daily_summaries").insert({
    user_id: userId, date,
    reactions_count: reactionsCount,
    followers_count: followersCount || 0,
    study_minutes: studyMinutes,
    points_earned: pointsEarned,
    total_points: totalPoints,
  });

  await supabase.from("profiles").update({ exchange_points: totalPoints }).eq("id", userId);

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh_key, auth_key")
    .eq("user_id", userId);

  if (subscriptions?.length) {
    const body = `${date} のまとめ📊\n連続ボーナス: +${streakBonus}\nリアクション: ${reactionsCount}件 (+${reactionsCount * 10})\n勉強時間: ${Math.floor(studyMinutes / 60)}h${studyMinutes % 60}m ×${followerMultiplier.toFixed(1)} = +${Math.floor(studyMinutes * followerMultiplier)}\n獲得ポイント: +${pointsEarned}\n合計ポイント: ${totalPoints}`;

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (publicKey && privateKey) {
      webpush.setVapidDetails("mailto:admin@ryutter.app", publicKey, privateKey);
      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
          }, JSON.stringify({ title: "リュッター", body, url: "/" }));
        } catch (_) {}
      }
    }
  }

  return { reactionsCount, pointsEarned, totalPoints };
}

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const jstOffset = 9 * 60;
  const jst = new Date(now.getTime() + jstOffset * 60 * 1000);
  const currentHourJST = jst.getUTCHours();
  const currentMinuteJST = jst.getUTCMinutes();

  if (currentHourJST < 23) {
    return NextResponse.json({ ok: true, message: "23時以降に送信されます", currentHour: currentHourJST });
  }

  const date = jst.toISOString().split("T")[0];

  const { data: existing } = await supabase
    .from("daily_summaries").select("id")
    .eq("user_id", user.id).eq("date", date)
    .maybeSingle();

  if (existing) return NextResponse.json({ ok: true, alreadySent: true });

  const { data: settings } = await supabase
    .from("notification_settings").select("daily_summary")
    .eq("user_id", user.id).maybeSingle();

  if (settings?.daily_summary === false) return NextResponse.json({ ok: true, disabled: true });

  const admin = createAdminClient();
  const result = await sendSummaryForUser(supabase, admin, user.id, date);

  return NextResponse.json({ ok: true, ...result });
}
