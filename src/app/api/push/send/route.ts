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
    like: `${senderName}がいいねしました`,
    reply: `${senderName}が返信しました`,
    follow: `${senderName}がフォローしました`,
    follow_post: `${senderName}がリュイートしました`,
    follow_like: `${senderName}がいいねしました`,
    follow_comment: `${senderName}がコメントしました`,
    gift: "おプレゼントが届きました！！",
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
