import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

export const dynamic = "force-dynamic";

async function sendSummaryForUser(admin: any, userId: string, date: string) {
  const dayStart = `${date}T00:00:00Z`;
  const dayEnd = `${date}T23:59:59Z`;

  const { data: userPosts } = await admin
    .from("posts").select("id").eq("user_id", userId);

  const postIds = (userPosts || []).map((p: any) => p.id);
  let reactionsCount = 0;
  if (postIds.length > 0) {
    const { count } = await admin
      .from("post_reactions")
      .select("*", { count: "exact", head: true })
      .in("post_id", postIds)
      .gte("created_at", dayStart).lte("created_at", dayEnd);
    reactionsCount = count || 0;
  }

  const { count: followersCount } = await admin
    .from("follows").select("*", { count: "exact", head: true })
    .eq("following_id", userId);

  const { data: dayPosts } = await admin
    .from("posts").select("study_minutes")
    .eq("user_id", userId)
    .gte("created_at", dayStart).lte("created_at", dayEnd);

  const studyMinutes = (dayPosts || []).reduce((sum: number, p: any) => sum + (p.study_minutes || 0), 0);

  const { data: profile } = await admin
    .from("profiles").select("exchange_points").eq("id", userId).single();

  const currentPoints = profile?.exchange_points || 0;
  const loginBonus = 10;
  const followerMultiplier = 1 + ((followersCount || 0) * 0.1);
  const pointsEarned = loginBonus + (reactionsCount * 10) + Math.floor(studyMinutes * followerMultiplier);
  const totalPoints = currentPoints + pointsEarned;

  const { error: insertError } = await admin.from("daily_summaries").insert({
    user_id: userId, date,
    reactions_count: reactionsCount,
    followers_count: followersCount || 0,
    study_minutes: studyMinutes,
    points_earned: pointsEarned,
    total_points: totalPoints,
  });
  if (insertError) return null;

  await admin.from("profiles").update({ exchange_points: totalPoints }).eq("id", userId);

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh_key, auth_key")
    .eq("user_id", userId);

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

  return { reactionsCount, pointsEarned, totalPoints };
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const date = jst.toISOString().split("T")[0];

  const { data: allUsers } = await admin.from("notification_settings").select("user_id").eq("daily_summary", true);
  if (!allUsers?.length) return NextResponse.json({ ok: true, sent: 0 });

  let sent = 0;
  for (const u of allUsers) {
    const { data: existing } = await admin
      .from("daily_summaries").select("id")
      .eq("user_id", u.user_id).eq("date", date)
      .maybeSingle();
    if (existing) continue;

    const result = await sendSummaryForUser(admin, u.user_id, date);
    if (result) sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
