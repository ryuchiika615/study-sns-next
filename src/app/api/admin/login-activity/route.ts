import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: sessions, error } = await admin
    .from("login_sessions")
    .select("*, user:user_id(id, display_name, username)")
    .order("login_at", { ascending: false })
    .limit(200);

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
