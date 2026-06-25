import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { post_id, reaction } = await request.json();
  if (!post_id || !reaction) return NextResponse.json({ error: "post_id and reaction required" }, { status: 400 });

  const validReactions = ["👍", "🔥", "💯", "🎉", "❤️", "😢"];
  if (!validReactions.includes(reaction)) return NextResponse.json({ error: "invalid reaction" }, { status: 400 });

  const { data: existing } = await supabase
    .from("post_reactions")
    .select("reaction")
    .eq("post_id", post_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    if (existing.reaction === reaction) {
      await supabase.from("post_reactions").delete().eq("post_id", post_id).eq("user_id", user.id);
      return NextResponse.json({ action: "removed" });
    }
    await supabase.from("post_reactions").update({ reaction }).eq("post_id", post_id).eq("user_id", user.id);
    return NextResponse.json({ action: "updated" });
  }

  await supabase.from("post_reactions").insert({ post_id, user_id: user.id, reaction });

  // Notify post author only on FIRST reaction (deduplicate)
  const { data: post } = await supabase.from("posts").select("user_id").eq("id", post_id).single();
  if (post && post.user_id !== user.id) {
    const admin = createAdminClient();
    const [followCount, existingNotif] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", post.user_id).eq("following_id", user.id),
      admin.from("notifications").select("id").eq("recipient_id", post.user_id).eq("sender_id", user.id).eq("post_id", post_id).eq("notification_type", "like").limit(1).maybeSingle(),
    ]);
    if ((followCount.count || 0) > 0 && !existingNotif.data) {
      // 1. Insert notification (triggers DB-level push via pg_net)
      try {
        await admin.from("notifications").insert({
          recipient_id: post.user_id,
          sender_id: user.id,
          post_id,
          notification_type: "like",
        });
      } catch (_) {}

      // 2. Direct push fallback (works even if pg_net fails)
      try {
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        const privateKey = process.env.VAPID_PRIVATE_KEY;
        if (publicKey && privateKey) {
          webpush.setVapidDetails("mailto:admin@ryutter.app", publicKey, privateKey);
          const [subResult, senderResult] = await Promise.all([
            admin.from("push_subscriptions").select("endpoint, p256dh_key, auth_key").eq("user_id", post.user_id),
            admin.from("profiles").select("display_name, username").eq("id", user.id).single(),
          ]);
          const senderName = senderResult.data?.display_name || senderResult.data?.username || "誰か";
          const body = `${senderName}が${reaction}のリアクションをしました`;
          if (subResult.data) {
            for (const sub of subResult.data) {
              try {
                await webpush.sendNotification({
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
                }, JSON.stringify({ title: "リュッター", body, url: `/post/${post_id}` }));
              } catch (_) {}
            }
          }
        }
      } catch (_) {}
    }
  }

  return NextResponse.json({ action: "added" });
}
