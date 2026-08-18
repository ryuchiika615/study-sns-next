import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { shareType, entityId } = await request.json();
  if (!['study_record', 'ranking', 'achievement'].includes(shareType)) return NextResponse.json({ error: "Invalid share type" }, { status: 400 });
  await createAdminClient().from("share_events").insert({ user_id: user.id, share_type: shareType, entity_id: entityId || null });
  return NextResponse.json({ ok: true });
}
