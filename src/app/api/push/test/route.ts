export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

export async function POST(request: NextRequest) {
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

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }
  webpush.setVapidDetails("mailto:admin@ryutter.app", publicKey, privateKey);

  const admin = createAdminClient();
  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh_key, auth_key")
    .eq("user_id", user.id);

  if (!subscriptions?.length) {
    return NextResponse.json({ error: "No push subscriptions found" }, { status: 404 });
  }

  let sent = 0;
  const errors: string[] = [];
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
      }, JSON.stringify({
        title: "リュッター",
        body: "これはテスト通知です！",
        url: "/",
      }));
      sent++;
    } catch (err: any) {
      errors.push(err.message || String(err));
    }
  }

  return NextResponse.json({ ok: true, sent, errors: errors.length ? errors : undefined });
}
