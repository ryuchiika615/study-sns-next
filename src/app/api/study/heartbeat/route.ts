import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.from("studying_sessions").upsert(
    { user_id: user.id, heartbeat_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  await admin.from("studying_sessions").delete().eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
