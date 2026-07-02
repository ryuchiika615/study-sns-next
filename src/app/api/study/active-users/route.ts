import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();

  const { data: sessions, error } = await admin
    .from("studying_sessions")
    .select("user_id, heartbeat_at")
    .gt("heartbeat_at", threeMinAgo)
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = (sessions || []).map(s => s.user_id);
  let userMap: Record<string, any> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name, username, icon_url")
      .in("id", userIds);
    if (profiles) {
      for (const p of profiles) userMap[p.id] = p;
    }
  }

  const result = (sessions || []).map(s => ({
    user_id: s.user_id,
    heartbeat_at: s.heartbeat_at,
    user: userMap[s.user_id] || null,
  }));

  return NextResponse.json(result);
}
