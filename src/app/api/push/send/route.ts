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

  const admin = createAdminClient();

  // Check quiet hours
  const { data: notifSettings } = await admin
    .from("notification_settings")
    .select("quiet_hours_start, quiet_hours_end")
    .eq("user_id", record.recipient_id)
    .maybeSingle();

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

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh_key, auth_key")
    .eq("user_id", record.recipient_id);

  if (!subscriptions?.length) return NextResponse.json({ ok: true, sent: 0 });

  const { data: sender } = await admin
    .from("profiles")
    .select("display_name, username")
    .eq("id", record.sender_id)
    .single();

  const senderName = sender?.display_name || sender?.username || "誰か";

  const messages: Record<string, string> = {
    like: `${senderName}がリアクションしました`,
    reply: `${senderName}からコメントが来ました`,
    follow: `${senderName}がフォローしました`,
    follow_post: `${senderName}がリュイートしました`,
    gift: `${senderName}からプレゼントが届きました。`,
    mention: `${senderName}からメンションが来ました`,
  };

  const bodyText = messages[record.notification_type] || "新しい通知があります";
  const url = record.notification_type === "follow"
    ? `/profile/${record.sender_id}`
    : record.post_id ? `/post/${record.post_id}` : "/";

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
