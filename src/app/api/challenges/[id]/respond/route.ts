export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await request.json();
  if (!action || !["accept", "decline"].includes(action)) {
    return NextResponse.json({ error: "action must be 'accept' or 'decline'" }, { status: 400 });
  }

  // Get the challenge
  const { data: challenge, error: fetchError } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", params.id)
    .single();

  if (fetchError || !challenge) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }

  // Only the opponent can respond
  if (challenge.opponent_id !== user.id) {
    return NextResponse.json({ error: "この勝負に回答する権限がありません" }, { status: 403 });
  }

  if (challenge.status !== "pending") {
    return NextResponse.json({ error: "この勝負はすでに回答済みです" }, { status: 400 });
  }

  const update: any = { status: action === "accept" ? "accepted" : "declined" };
  if (action === "accept") {
    update.accepted_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from("challenges")
    .update(update)
    .eq("id", params.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Notify challenger of response
  const admin = createAdminClient();
  await admin.from("notifications").insert({
    recipient_id: challenge.challenger_id,
    sender_id: user.id,
    post_id: null,
    notification_type: "challenge",
  }).maybeSingle();

  return NextResponse.json({ ok: true, status: update.status });
}
