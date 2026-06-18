export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

function ensureVapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails("mailto:admin@ryutter.app", publicKey, privateKey);
  return true;
}

export async function POST(request: NextRequest) {
  if (!ensureVapid()) {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const record = body.record;
  if (!record?.recipient_id) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  if (record.sender_id && record.recipient_id === record.sender_id) {
    return NextResponse.json({ ok: true, sent: 0, skipped: "self" });
  }

  const admin = createAdminClient();

  // Check follow bell settings
  const bellCol = record.notification_type === "follow_post" ? "notify_posts" : record.notification_type === "like" ? "notify_likes" : record.notification_type === "reply" ? "notify_comments" : record.notification_type === "repost" ? "notify_repost" : null;
  if (bellCol && record.sender_id) {
    const { data: follow } = await admin
      .from("follows")
      .select(bellCol)
      .eq("follower_id", record.recipient_id)
      .eq("following_id", record.sender_id)
      .maybeSingle();
    if (follow && !(follow as any)[bellCol]) {
      return NextResponse.json({ ok: true, sent: 0, skipped: `${bellCol}_off` });
    }
  }

  const vibrateMap: Record<string, string> = {
    like: "vibrate_like",
    reply: "vibrate_reply",
    follow: "vibrate_follow",
    follow_post: "vibrate_follow_post",
    gift: "vibrate_gift",
    mention: "vibrate_mention",
    admin_announcement: "vibrate_admin_announcement",
    repost: "vibrate_repost",
  };

  const [notifSettingsResult, subscriptionsResult, senderResult] = await Promise.all([
    admin
      .from("notification_settings")
      .select("quiet_hours_start, quiet_hours_end, vibrate_like, vibrate_reply, vibrate_follow, vibrate_mention, vibrate_gift, vibrate_follow_post, vibrate_admin_announcement")
      .eq("user_id", record.recipient_id)
      .maybeSingle(),
    admin
      .from("push_subscriptions")
      .select("endpoint, p256dh_key, auth_key")
      .eq("user_id", record.recipient_id),
    admin
      .from("profiles")
      .select("display_name, username")
      .eq("id", record.sender_id)
      .single(),
  ]);

  const notifSettings = notifSettingsResult.data as any;
  const subscriptions = subscriptionsResult.data;
  const sender = senderResult.data as any;

  if (!subscriptions?.length) return NextResponse.json({ ok: true, sent: 0 });

  // Check quiet hours
  if (notifSettings?.quiet_hours_start && notifSettings?.quiet_hours_end) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startParts = notifSettings.quiet_hours_start.split(":").map(Number);
    const endParts = notifSettings.quiet_hours_end.split(":").map(Number);
    const startMinutes = startParts[0] * 60 + (startParts[1] || 0);
    const endMinutes = endParts[0] * 60 + (endParts[1] || 0);

    let isQuiet = false;
    if (startMinutes <= endMinutes) {
      isQuiet = currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      isQuiet = currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
    if (isQuiet) return NextResponse.json({ ok: true, skipped: "quiet_hours", sent: 0 });
  }

  const senderName = sender?.display_name || sender?.username || "誰か";

  // Include post content preview for like/reply/follow_post
  let preview = "";
  if (record.post_id) {
    const { data: post } = await admin
      .from("posts")
      .select("content")
      .eq("id", record.post_id)
      .maybeSingle();
    if (post?.content) {
      preview = post.content.length > 30 ? post.content.slice(0, 30) + "…" : post.content;
    }
  }

  const messages: Record<string, string> = {
    like: preview ? `${senderName}が「${preview}」にリアクションしました` : `${senderName}がリアクションしました`,
    reply: preview ? `${senderName}が「${preview}」に返信しました` : `${senderName}からコメントが来ました`,
    follow: `${senderName}がフォローしました`,
    follow_post: preview ? `${senderName}が「${preview}」を投稿しました` : `${senderName}がリュイートしました`,
    gift: `${senderName}からプレゼントが届きました。`,
    mention: `${senderName}からメンションが来ました`,
    repost: preview ? `${senderName}があなたの投稿「${preview}」を引用しました` : `${senderName}があなたの投稿を引用しました`,
  };

  const bodyText = messages[record.notification_type] || "新しい通知があります";
  const url = record.notification_type === "follow"
    ? `/profile/${record.sender_id}`
    : record.post_id ? `/post/${record.post_id}` : "/";

  const vibrateCol = vibrateMap[record.notification_type] || "vibrate_like";
  const vibrate = notifSettings?.[vibrateCol] ?? true;

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
      }, JSON.stringify({
        title: "リュッター",
        body: bodyText,
        url,
        vibrate,
      }));
      sent++;
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
