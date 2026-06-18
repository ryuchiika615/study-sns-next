export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [challengerResult, opponentResult] = await Promise.all([
    supabase
      .from("challenges")
      .select("*, opponent:opponent_id(id, display_name, username, icon_url)")
      .eq("challenger_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("challenges")
      .select("*, challenger:challenger_id(id, display_name, username, icon_url)")
      .eq("opponent_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    outgoing: challengerResult.data || [],
    incoming: opponentResult.data || [],
  });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { opponent_id, message, challenge_type, target_value } = await request.json();
  if (!opponent_id) {
    return NextResponse.json({ error: "opponent_id required" }, { status: 400 });
  }
  if (opponent_id === user.id) {
    return NextResponse.json({ error: "自分自身には勝負を仕掛けられません" }, { status: 400 });
  }

  // Must be mutual follows
  const { data: follows } = await supabase
    .from("follows")
    .select("follower_id, following_id")
    .eq("follower_id", user.id)
    .eq("following_id", opponent_id)
    .maybeSingle();

  const { data: reverseFollows } = await supabase
    .from("follows")
    .select("follower_id, following_id")
    .eq("follower_id", opponent_id)
    .eq("following_id", user.id)
    .maybeSingle();

  if (!follows || !reverseFollows) {
    return NextResponse.json({ error: "相互フォローのユーザーのみに勝負を仕掛けられます" }, { status: 400 });
  }

  // Check no pending challenge already exists between these two
  const { data: existing } = await supabase
    .from("challenges")
    .select("id")
    .or(`and(challenger_id.eq.${user.id},opponent_id.eq.${opponent_id}),and(challenger_id.eq.${opponent_id},opponent_id.eq.${user.id})`)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "すでに保留中の勝負があります" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("challenges")
    .insert({
      challenger_id: user.id,
      opponent_id,
      message: message || "勝負しよう！",
      challenge_type: challenge_type || "weekly_study_minutes",
      target_value: target_value || 0,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Insert notification for opponent
  const admin = createAdminClient();
  await admin.from("notifications").insert({
    recipient_id: opponent_id,
    sender_id: user.id,
    notification_type: "challenge",
  }).maybeSingle();

  return NextResponse.json(data);
}
