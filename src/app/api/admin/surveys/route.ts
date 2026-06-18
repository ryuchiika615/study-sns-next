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

  const { data: surveys } = await ctx.supabase
    .from("surveys")
    .select("*")
    .order("created_at", { ascending: false });

  const surveysWithStats = await Promise.all((surveys || []).map(async (s) => {
    const selectCols = "selected_option, custom_reply" + (!s.anonymous ? ", user_id, users:user_id(display_name, username)" : "");
    const { data: responses } = await ctx.supabase
      .from("survey_responses")
      .select(selectCols)
      .eq("survey_id", s.id);

    const counts: Record<string, number> = {};
    const voters: Record<string, any[]> = {};
    (responses || []).forEach((r: any) => {
      counts[r.selected_option] = (counts[r.selected_option] || 0) + 1;
      if (!s.anonymous) {
        if (!voters[r.selected_option]) voters[r.selected_option] = [];
        voters[r.selected_option].push({ user_id: r.user_id, display_name: r.users?.display_name || r.users?.username || "ユーザー" });
      }
    });

    return {
      ...s,
      total_responses: responses?.length || 0,
      counts,
      responses: responses || [],
      ...(!s.anonymous ? { voters } : {}),
    };
  }));

  return NextResponse.json({ surveys: surveysWithStats });
}

export async function POST(request: NextRequest) {
  const ctx = await checkAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { question, options, allow_custom, anonymous } = await request.json();
  if (!question?.trim()) {
    return NextResponse.json({ error: "question required" }, { status: 400 });
  }

  const opts = Array.isArray(options) && options.length > 0 ? options : ["良い", "ダメ", "どちらでも"];

  const { data, error } = await ctx.supabase
    .from("surveys")
    .insert({ question: question.trim(), options: opts, allow_custom: allow_custom !== false, anonymous: anonymous !== false, created_by: ctx.user.id })
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
      const { data: settings } = await admin
        .from("notification_settings")
        .select("user_id, push_admin_announcements, vibrate_admin_announcement");
      const pushSet = new Set((settings || []).filter((s: any) => s.push_admin_announcements !== false).map((s: any) => s.user_id));
      const vibMap = new Map((settings || []).map((s: any) => [s.user_id, s.vibrate_admin_announcement ?? true]));

      for (const sub of subscriptions) {
        if (sub.user_id === ctx.user.id) continue;
        if (!pushSet.has(sub.user_id)) continue;
        try {
          const vibrate = vibMap.get(sub.user_id) ?? true;
          await webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
          }, JSON.stringify({
            title: "リュッター",
            body: "アンケートが届きました: " + (data.question.length > 50 ? data.question.slice(0, 50) + "…" : data.question),
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

  return NextResponse.json({ survey: data });
}

export async function PUT(request: NextRequest) {
  const ctx = await checkAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { survey_id } = await request.json();
  if (!survey_id) return NextResponse.json({ error: "survey_id required" }, { status: 400 });

  const { error } = await ctx.supabase
    .from("surveys")
    .update({ closed_at: new Date().toISOString() })
    .eq("id", survey_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
