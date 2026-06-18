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

  const { endpoint, keys, verify } = await request.json();
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify subscription by sending a silent test push
  if (verify && ensureVapid()) {
    try {
      await webpush.sendNotification({
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
      }, JSON.stringify({ type: "ping" }));
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
        return NextResponse.json({ ok: false, retry: true, reason: "expired" });
      }
    }
  }

  await admin.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint,
    p256dh_key: keys.p256dh,
    auth_key: keys.auth,
  }, { onConflict: "user_id, endpoint" });

  return NextResponse.json({ ok: true });
}
