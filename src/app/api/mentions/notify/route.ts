import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { post_id, mentioned_usernames } = await request.json();
  if (!post_id || !mentioned_usernames?.length) {
    return NextResponse.json({ error: "post_id and mentioned_usernames required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: users } = await admin
    .from("profiles")
    .select("id, username")
    .in("username", mentioned_usernames);

  if (!users) return NextResponse.json({ ok: true });

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (publicKey && privateKey) {
    webpush.setVapidDetails("mailto:admin@ryutter.app", publicKey, privateKey);
  }

  for (const mentioned of users) {
    if (mentioned.id === user.id) continue;

    await admin.from("notifications").insert({
      recipient_id: mentioned.id,
      sender_id: user.id,
      post_id,
      notification_type: "mention",
    });

    if (publicKey && privateKey) {
      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("endpoint, p256dh_key, auth_key")
        .eq("user_id", mentioned.id);

      if (subs) {
        const { data: senderProfile } = await admin
          .from("profiles")
          .select("display_name, username")
          .eq("id", user.id)
          .single();
        const senderName = senderProfile?.display_name || senderProfile?.username || "誰か";
        for (const sub of subs) {
          try {
            await webpush.sendNotification({
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
            }, JSON.stringify({ title: "リュッター", body: `${senderName}からメンションが来ました`, url: `/post/${post_id}` }));
          } catch (_) {}
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
