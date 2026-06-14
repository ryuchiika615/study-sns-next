import { createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 邂｡逅・・メ繧ｧ繝・け
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const adminName = process.env.NEXT_PUBLIC_SITE_ADMIN_USERNAME || "admin";
  const userEmail = user.email?.split("@")[0] || "";

  if (userEmail !== adminName && userEmail !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: sessions, error } = await supabase
    .from("login_sessions")
    .select("*, user:user_id(*)")
    .order("login_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const activeCount = (sessions || []).filter(
    (s: any) => s.logout_at === null && new Date(s.last_seen_at) >= new Date(fifteenMinAgo)
  ).length;

  const enriched = (sessions || []).map((s: any) => ({
    ...s,
    is_active_now: s.logout_at === null && new Date(s.last_seen_at) >= new Date(fifteenMinAgo),
  }));

  return NextResponse.json({ sessions: enriched, active_count: activeCount });
}
