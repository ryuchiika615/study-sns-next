import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ALL_COLS = "push_admin_announcements, quiet_hours_start, quiet_hours_end, daily_summary, vibrate_like, vibrate_reply, vibrate_follow, vibrate_mention, vibrate_gift, vibrate_follow_post, vibrate_admin_announcement, notify_challenge";
const ALL_DEFAULTS = { push_admin_announcements: true, quiet_hours_start: null, quiet_hours_end: null, daily_summary: true, vibrate_like: true, vibrate_reply: true, vibrate_follow: true, vibrate_mention: true, vibrate_gift: true, vibrate_follow_post: true, vibrate_admin_announcement: true, notify_challenge: true };

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("notification_settings")
    .select(ALL_COLS)
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json(data || ALL_DEFAULTS);
}

export async function PUT(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { push_admin_announcements, quiet_hours_start, quiet_hours_end, daily_summary, notify_challenge } = body;

  const { error } = await supabase
    .from("notification_settings")
    .upsert({
      user_id: user.id,
      push_admin_announcements,
      quiet_hours_start,
      quiet_hours_end,
      daily_summary,
      notify_challenge,
    }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
