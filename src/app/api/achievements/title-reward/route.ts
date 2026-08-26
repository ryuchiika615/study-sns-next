import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { achievement_id } = await req.json();
  if (!achievement_id) return NextResponse.json({ error: "achievement_id required" }, { status: 400 });

  const { data, error } = await supabase.rpc("claim_achievement_title_character", { p_achievement_id: achievement_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, reward: data });
}
