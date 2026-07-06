import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { userId, name, audioUrl, requestId } = await request.json();
  if (!userId || !name || !audioUrl) {
    return NextResponse.json({ error: "userId, name, audioUrl required" }, { status: 400 });
  }

  // Add BGM to user's library
  const { data: bgm, error: insertError } = await admin
    .from("audio_bgm")
    .insert({ user_id: userId, name, duration_seconds: 0, audio_url: audioUrl, price: 0 })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Mark request as completed
  if (requestId) {
    await admin.from("bgm_requests").update({ status: "completed" }).eq("id", requestId);
  }

  // Notify user (store bgm id in post_id so the client can show details)
  await admin.from("notifications").insert({
    recipient_id: userId,
    sender_id: user.id,
    notification_type: "gift",
    post_id: bgm.id,
  });

  return NextResponse.json({ success: true, bgm });
}
