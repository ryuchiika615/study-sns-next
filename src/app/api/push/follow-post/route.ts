import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { post_id } = await request.json();
  if (!post_id) {
    return NextResponse.json({ error: "post_id required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: senderProfile } = await admin
    .from("profiles")
    .select("display_name, username")
    .eq("id", user.id)
    .single();

  const senderName = senderProfile?.display_name || senderProfile?.username || "誰か";

  // Get post content preview
  let preview = "";
  const { data: post } = await admin
    .from("posts")
    .select("content")
    .eq("id", post_id)
    .maybeSingle();
  if (post?.content) {
    preview = post.content.length > 30 ? post.content.slice(0, 30) + "…" : post.content;
  }

  const { data: followers } = await admin
    .from("follows")
    .select("follower_id")
    .eq("following_id", user.id)
    .eq("notify_posts", true);

  if (!followers?.length) return NextResponse.json({ ok: true, sent: 0 });

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return NextResponse.json({ ok: true, sent: 0 });

  webpush.setVapidDetails("mailto:admin@ryutter.app", publicKey, privateKey);

  let sent = 0;

  for (const follower of followers) {
    if (follower.follower_id === user.id) continue;

    const { data: notifSettings } = await admin
      .from("notification_settings")
      .select("quiet_hours_start, quiet_hours_end, vibrate_follow_post")
      .eq("user_id", follower.follower_id)
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
      if (isQuiet) continue;
    }

    const { data: subscriptions } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh_key, auth_key")
      .eq("user_id", follower.follower_id);

    if (!subscriptions?.length) continue;

    for (const sub of subscriptions) {
      try {
        const vibrate = notifSettings?.vibrate_follow_post ?? true;
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
        }, JSON.stringify({
          title: "リュッター",
          body: preview ? `${senderName}が「${preview}」を投稿しました` : `${senderName}が投稿しました`,
          url: `/post/${post_id}`,
          vibrate,
        }));
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
