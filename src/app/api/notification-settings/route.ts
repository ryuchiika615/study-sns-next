import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("notification_settings")
    .select("quiet_hours_start, quiet_hours_end, daily_summary")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json(data || { quiet_hours_start: null, quiet_hours_end: null, daily_summary: true });
}

export async function PUT(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { quiet_hours_start, quiet_hours_end, daily_summary } = await request.json();

  const { error } = await supabase
    .from("notification_settings")
    .upsert({ user_id: user.id, quiet_hours_start, quiet_hours_end, daily_summary }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
