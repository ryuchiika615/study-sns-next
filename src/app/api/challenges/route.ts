export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Lazy evaluation: check accepted challenges that might have been completed
  const { data: activeChallenges } = await admin
    .from("challenges")
    .select("id, challenger_id, opponent_id, target_value, accepted_at")
    .eq("status", "accepted")
    .gt("target_value", 0);

  if (activeChallenges) {
    for (const c of activeChallenges) {
      const [challengerPosts, opponentPosts] = await Promise.all([
        admin
          .from("posts")
          .select("study_minutes")
          .eq("user_id", c.challenger_id)
          .gte("created_at", c.accepted_at),
        admin
          .from("posts")
          .select("study_minutes")
          .eq("user_id", c.opponent_id)
          .gte("created_at", c.accepted_at),
      ]);

      const challengerTotal = (challengerPosts.data || []).reduce((sum, p) => sum + (p.study_minutes || 0), 0);
      const opponentTotal = (opponentPosts.data || []).reduce((sum, p) => sum + (p.study_minutes || 0), 0);

      let winnerId: string | null = null;
      if (challengerTotal >= c.target_value && opponentTotal >= c.target_value) {
        winnerId = challengerTotal >= opponentTotal ? c.challenger_id : c.opponent_id;
      } else if (challengerTotal >= c.target_value) {
        winnerId = c.challenger_id;
      } else if (opponentTotal >= c.target_value) {
        winnerId = c.opponent_id;
      }

      if (winnerId) {
        await admin
          .from("challenges")
          .update({ status: "completed", winner_id: winnerId, completed_at: new Date().toISOString() })
          .eq("id", c.id)
          .eq("status", "accepted");
      }
    }
  }

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

  // Add progress data for accepted challenges
  const allChallenges = [...(challengerResult.data || []), ...(opponentResult.data || [])];
  const activeOnes = allChallenges.filter((c: any) => c.status === "accepted" && c.target_value > 0);

  const progressMap: Record<string, { challenger_minutes: number; opponent_minutes: number }> = {};
  await Promise.all(activeOnes.map(async (c: any) => {
    const [challengerPosts, opponentPosts] = await Promise.all([
      admin
        .from("posts")
        .select("study_minutes")
        .eq("user_id", c.challenger_id)
        .gte("created_at", c.accepted_at),
      admin
        .from("posts")
        .select("study_minutes")
        .eq("user_id", c.opponent_id)
        .gte("created_at", c.accepted_at),
    ]);
    progressMap[c.id] = {
      challenger_minutes: (challengerPosts.data || []).reduce((sum, p) => sum + (p.study_minutes || 0), 0),
      opponent_minutes: (opponentPosts.data || []).reduce((sum, p) => sum + (p.study_minutes || 0), 0),
    };
  }));

  return NextResponse.json({
    outgoing: challengerResult.data || [],
    incoming: opponentResult.data || [],
    progress: progressMap,
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
  if (!target_value || target_value < 1) {
    return NextResponse.json({ error: "目標値を設定してください" }, { status: 400 });
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
