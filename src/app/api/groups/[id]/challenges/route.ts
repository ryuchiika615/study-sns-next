import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 }); const { name, description, startsAt, endsAt } = await request.json();
  if (!name?.trim() || !startsAt || !endsAt) return NextResponse.json({ error: "勝負名と期間を入力してください" }, { status: 400 }); const admin = createAdminClient(); const { data: group } = await admin.from("study_groups").select("owner_id").eq("id", params.id).maybeSingle(); if (!group || group.owner_id !== user.id) return NextResponse.json({ error: "作成者のみ勝負を作れます" }, { status: 403 });
  const { data: challenge, error } = await admin.from("study_group_challenges").insert({ group_id: params.id, created_by: user.id, name: name.trim(), description: description?.trim() || "", starts_at: startsAt, ends_at: endsAt }).select().single(); if (error) return NextResponse.json({ error: error.message }, { status: 400 }); const { data: members } = await admin.from("study_group_members").select("user_id").eq("group_id", params.id); const notices = (members || []).filter((m: any) => m.user_id !== user.id).map((m: any) => ({ recipient_id: m.user_id, sender_id: user.id, group_id: params.id, notification_type: "group_challenge", message: `「${challenge.name}」が始まります！` })); if (notices.length) await admin.from("notifications").insert(notices); return NextResponse.json({ ok: true, challenge });
}
