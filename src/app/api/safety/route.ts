import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 }); const body = await request.json();
  if (body.action === "block") { if (!body.userId || body.userId === user.id) return NextResponse.json({ error: "このユーザーはブロックできません" }, { status: 400 }); const { error } = await supabase.from("user_blocks").upsert({ blocker_id: user.id, blocked_id: body.userId }); return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true }); }
  if (body.action === "report") { if (!body.reason?.trim()) return NextResponse.json({ error: "理由を入力してください" }, { status: 400 }); const { error } = await supabase.from("reports").insert({ reporter_id: user.id, reported_user_id: body.userId || null, post_id: body.postId || null, group_id: body.groupId || null, reason: body.reason.trim() }); return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true }); }
  return NextResponse.json({ error: "不明な操作です" }, { status: 400 });
}
