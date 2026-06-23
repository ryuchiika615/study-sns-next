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
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 500 });
  }
  webpush.setVapidDetails("mailto:admin@ryutter.app", publicKey, privateKey);

  const admin = createAdminClient();
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const today = jst.toISOString().split("T")[0];
  const timeStr = `${String(jst.getHours()).padStart(2, "0")}:${String(jst.getMinutes()).padStart(2, "0")}`;

  const { data: habits } = await admin
    .from("habits")
    .select("id, name, notify_time, days")
    .eq("user_id", user.id)
    .eq("notify_enabled", true);

  if (!habits?.length) return NextResponse.json({ ok: true, sent: 0 });

  let sent = 0;
  for (const h of habits) {
    const dow = jst.getDay();
    const days = h.days as number[] | null;
    if (days && !days.includes(dow)) continue;
    if (h.notify_time > timeStr) continue;

    const { data: log } = await admin
      .from("habit_logs")
      .select("id")
      .eq("habit_id", h.id)
      .eq("user_id", user.id)
      .eq("date", today)
      .eq("achieved", true)
      .maybeSingle();
    if (log) continue;

    const { data: alreadySent } = await admin
      .from("habit_notifications_sent")
      .select("id")
      .eq("user_id", user.id)
      .eq("habit_id", h.id)
      .eq("date", today)
      .maybeSingle();
    if (alreadySent) continue;

    const { data: subscriptions } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh_key, auth_key")
      .eq("user_id", user.id);
    if (!subscriptions?.length) continue;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
        }, JSON.stringify({
          title: "習慣が未達成です",
          body: `「${h.name}」がまだ完了していません！`,
          url: "/tasks",
        }));
      } catch (_) {}
    }

    await admin.from("habit_notifications_sent").insert({
      user_id: user.id, habit_id: h.id, date: today,
    });
    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
