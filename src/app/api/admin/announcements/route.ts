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

async function checkAdmin() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!p?.is_admin) return null;
  return { supabase, user };
}

export async function GET() {
  const ctx = await checkAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await ctx.supabase
    .from("admin_announcements")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcements: data });
}

export async function POST(request: NextRequest) {
  const ctx = await checkAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { content } = await request.json();
  if (!content?.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });

  const { data, error } = await ctx.supabase
    .from("admin_announcements")
    .insert({ content: content.trim() })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget push to all users with subscriptions
  if (ensureVapid()) {
    const admin = createAdminClient();
    const { data: subscriptions } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh_key, auth_key, user_id");
    if (subscriptions?.length) {
      // Get all users' vibrate_admin_announcement settings
      const { data: settings } = await admin
        .from("notification_settings")
        .select("user_id, vibrate_admin_announcement");
      const vibMap = new Map((settings || []).map((s: any) => [s.user_id, s.vibrate_admin_announcement ?? true]));

      for (const sub of subscriptions) {
        try {
          const vibrate = vibMap.get(sub.user_id) ?? true;
          await webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
          }, JSON.stringify({
            title: "リュッター",
            body: "お知らせが届きました",
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

  return NextResponse.json({ announcement: data });
}

export async function DELETE(request: NextRequest) {
  const ctx = await checkAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Soft delete: set is_deleted = true so the content disappears from users' views
  const { error } = await ctx.supabase
    .from("admin_announcements")
    .update({ is_deleted: true })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
