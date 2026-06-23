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

  const { data, error } = await admin
    .from("studying_sessions")
    .select(`
      user_id,
      heartbeat_at,
      user:user_id(id, display_name, username, icon_url)
    `)
    .gt("heartbeat_at", threeMinAgo)
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
