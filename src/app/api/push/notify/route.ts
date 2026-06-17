export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createServerClient } from "@supabase/ssr";
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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, recipient_id, post_id } = await request.json();
  if (!type || !recipient_id) {
    return NextResponse.json({ error: "Missing type or recipient_id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh_key, auth_key")
    .eq("user_id", recipient_id);

  if (!subscriptions?.length) return NextResponse.json({ ok: true, sent: 0 });

  const { data: sender } = await admin
    .from("profiles")
    .select("display_name, username")
    .eq("id", user.id)
    .single();

  const senderName = sender?.display_name || sender?.username || "誰か";

  const messages: Record<string, string> = {
    like: `${senderName}がリアクションしました`,
    reply: `${senderName}からコメントが来ました`,
    follow: `${senderName}がフォローしました`,
    gift: `${senderName}からプレゼントが届きました。`,
    mention: `${senderName}からメンションが来ました`,
  };

  const bodyText = messages[type] || "新しい通知があります";
  const url = type === "follow"
    ? `/profile/${user.id}`
    : post_id ? `/post/${post_id}` : "/";

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
