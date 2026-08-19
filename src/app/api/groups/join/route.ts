import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const { groupId, inviteCode } = await request.json();
  if (!groupId || !inviteCode) return NextResponse.json({ error: "招待リンクが正しくありません" }, { status: 400 });
  const admin = createAdminClient();
  const { data: group } = await admin.from("study_groups").select("id, invite_code").eq("id", groupId).maybeSingle();
  if (!group || group.invite_code !== inviteCode) return NextResponse.json({ error: "招待リンクが正しくありません" }, { status: 404 });
  const { error } = await admin.from("study_group_members").upsert({ group_id: group.id, user_id: user.id, role: "member" }, { onConflict: "group_id,user_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
