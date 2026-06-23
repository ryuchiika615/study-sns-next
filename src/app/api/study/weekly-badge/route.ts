import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  const weekStart = monday.toISOString().split("T")[0];

  const { data: profile } = await admin
    .from("profiles")
    .select("target_minutes")
    .eq("id", user.id)
    .single();

  const target = profile?.target_minutes || 0;

  if (target > 0) {
    const { data: posts } = await admin
      .from("posts")
      .select("study_minutes")
      .eq("user_id", user.id)
      .gte("created_at", weekStart)
      .gt("study_minutes", 0);

    const weeklyTotal = (posts || []).reduce((sum, p) => sum + (p.study_minutes || 0), 0);

    if (weeklyTotal >= target) {
      const { data: existing } = await admin
        .from("weekly_badges")
        .select("id")
        .eq("user_id", user.id)
        .eq("week_start", weekStart)
        .maybeSingle();

      if (!existing) {
        await admin.from("weekly_badges").insert({ user_id: user.id, week_start: weekStart });
      }
    }
  }

  const { data: badges } = await admin
    .from("weekly_badges")
    .select("*")
    .eq("user_id", user.id)
    .order("week_start", { ascending: false });

  return NextResponse.json({ badges: badges || [], target, weekStart });
}
