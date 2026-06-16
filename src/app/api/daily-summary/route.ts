import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import webpush from "web-push";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const date = yesterday.toISOString().split("T")[0];

  // Check if already sent for this date
  const { data: existing } = await supabase
    .from("daily_summaries")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  if (existing) return NextResponse.json({ ok: true, alreadySent: true });

  // Check notification setting
  const { data: settings } = await supabase
    .from("notification_settings")
    .select("daily_summary")
    .eq("user_id", user.id)
    .maybeSingle();

  if (settings?.daily_summary === false) return NextResponse.json({ ok: true, disabled: true });

  // Calculate stats for the date
  const dayStart = `${date}T00:00:00Z`;
  const dayEnd = `${date}T23:59:59Z`;

  // Reactions received that day on user's posts
  const { data: userPosts } = await supabase
    .from("posts")
    .select("id")
    .eq("user_id", user.id);

  const postIds = (userPosts || []).map(p => p.id);
  let reactionsCount = 0;
  if (postIds.length > 0) {
    const { count } = await supabase
      .from("post_reactions")
      .select("*", { count: "exact", head: true })
      .in("post_id", postIds)
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd);
    reactionsCount = count || 0;
  }

  // Follower count (current)
  const { count: followersCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", user.id);

  // Study minutes that day
  const { data: dayPosts } = await supabase
    .from("posts")
    .select("study_minutes")
    .eq("user_id", user.id)
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd);

  const studyMinutes = (dayPosts || []).reduce((sum, p) => sum + (p.study_minutes || 0), 0);

  // Get current total points (exchange_points)
  const { data: profile } = await supabase
    .from("profiles")
    .select("exchange_points")
    .eq("id", user.id)
    .single();

  const currentPoints = profile?.exchange_points || 0;

  // Calculate points
  const loginBonus = 10;
  const followerMultiplier = 1 + ((followersCount || 0) * 0.1);
  const pointsEarned = loginBonus + (reactionsCount * 10) + Math.floor(studyMinutes * followerMultiplier);
  const totalPoints = currentPoints + pointsEarned;

  // Save summary
  const { error: insertError } = await supabase
    .from("daily_summaries")
    .insert({
      user_id: user.id,
      date,
      reactions_count: reactionsCount,
      followers_count: followersCount || 0,
      study_minutes: studyMinutes,
      points_earned: pointsEarned,
      total_points: totalPoints,
    });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Send push notification
  const admin = createAdminClient();
  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh_key, auth_key")
    .eq("user_id", user.id);

  if (subscriptions?.length) {
    const body = `${date} のまとめ📊\nログインボーナス: +${loginBonus}\nリアクション: ${reactionsCount}件 (+${reactionsCount * 10})\n勉強時間: ${Math.floor(studyMinutes / 60)}h${studyMinutes % 60}m ×${followerMultiplier.toFixed(1)} = +${Math.floor(studyMinutes * followerMultiplier)}\n獲得ポイント: +${pointsEarned}\n合計ポイント: ${totalPoints}`;

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

  return NextResponse.json({ ok: true, reactionsCount, pointsEarned, totalPoints });
}
