export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

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

  const { endpoint, keys } = await request.json();
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint,
    p256dh_key: keys.p256dh,
    auth_key: keys.auth,
  }, { onConflict: "user_id, endpoint" });

  return NextResponse.json({ ok: true });
}
