import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

export const dynamic = "force-dynamic";

function ensureVapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails("mailto:admin@ryutter.app", publicKey, privateKey);
  return true;
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { feedbackId, customMessage } = await request.json();
  if (!feedbackId) return NextResponse.json({ error: "feedbackId required" }, { status: 400 });

  const admin = createAdminClient();

  const { data: adminProfile } = await admin
    .from("profiles")
    .select("display_name, username")
    .eq("id", user.id)
    .single();

  const adminName = adminProfile?.display_name || adminProfile?.username || "管理者";

  const { data: fb, error: fbError } = await admin
    .from("user_feedback")
    .select("content, type, resolved")
    .eq("id", feedbackId)
    .single();

  if (fbError || !fb) return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
  if (fb.resolved) return NextResponse.json({ error: "Already resolved" }, { status: 400 });

  const typeLabel = fb.type === "bug" ? "不具合報告" : fb.type === "question" ? "質問" : "要望";
  const announcementContent = `✅ ${typeLabel}が解決されました\n\n「${fb.content}」${customMessage ? `\n\n${customMessage}` : ""}\n\n— ${adminName}`;

  const { error: updateError } = await admin
    .from("user_feedback")
    .update({ resolved: true })
    .eq("id", feedbackId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { data: announcement, error: insertError } = await admin
    .from("admin_announcements")
    .insert({ content: announcementContent })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  if (ensureVapid()) {
    const { data: subscriptions } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh_key, auth_key, user_id");

    if (subscriptions?.length) {
      const { data: settings } = await admin
        .from("notification_settings")
        .select("user_id, push_admin_announcements, vibrate_admin_announcement");

      const pushSet = new Map((settings || []).map((s: any) => [s.user_id, s.push_admin_announcements !== false]));
      const vibMap = new Map((settings || []).map((s: any) => [s.user_id, s.vibrate_admin_announcement ?? true]));

      for (const sub of subscriptions) {
        if (sub.user_id === user.id) continue;
        if (pushSet.get(sub.user_id) === false) continue;
        try {
          const vibrate = vibMap.get(sub.user_id) ?? true;
          await webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
          }, JSON.stringify({
            title: "リュッター",
            body: announcementContent.length > 200 ? announcementContent.slice(0, 200) + "…" : announcementContent,
            url: "/",
            vibrate,
          }));
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}
