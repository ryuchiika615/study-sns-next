import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabase } from "@/lib/supabase-server";

async function currentUser() { const supabase = createServerSupabase(); const { data: { user } } = await supabase.auth.getUser(); return user; }

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 }); const admin = createAdminClient();
  const { data: mine } = await admin.from("study_group_members").select("group_id").eq("group_id", params.id).eq("user_id", user.id).maybeSingle(); if (!mine) return NextResponse.json({ error: "グループのメンバーのみ閲覧できます" }, { status: 403 });
  const { data: rows } = await admin.from("study_group_members").select("user_id, role, joined_at, profile:user_id(id,display_name,username,icon_url)").eq("group_id", params.id).order("joined_at"); return NextResponse.json({ members: rows || [] });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const admin = createAdminClient(); const { action, userId, name, description, visibility } = await request.json();
  const { data: group } = await admin.from("study_groups").select("owner_id").eq("id", params.id).maybeSingle();
  if (!group) return NextResponse.json({ error: "グループが見つかりません" }, { status: 404 });
  if (action === "leave") { if (group.owner_id === user.id) return NextResponse.json({ error: "作成者はグループを削除するか、所有者を引き継いでください" }, { status: 400 }); await admin.from("study_group_members").delete().eq("group_id", params.id).eq("user_id", user.id); return NextResponse.json({ ok: true }); }
  if (group.owner_id !== user.id) return NextResponse.json({ error: "作成者のみ操作できます" }, { status: 403 });
  if (action === "update_group") {
    const nextName = typeof name === "string" ? name.trim() : "";
    const nextDescription = typeof description === "string" ? description.trim() : "";
    if (!nextName || nextName.length > 50) return NextResponse.json({ error: "グループ名は1〜50文字で入力してください" }, { status: 400 });
    if (nextDescription.length > 300) return NextResponse.json({ error: "説明は300文字以内で入力してください" }, { status: 400 });
    if (visibility !== "private" && visibility !== "public") return NextResponse.json({ error: "公開設定を選んでください" }, { status: 400 });
    const { data, error } = await admin.from("study_groups").update({ name: nextName, description: nextDescription, visibility, updated_at: new Date().toISOString() }).eq("id", params.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, group: data });
  }
  if (action === "regenerate_invite") { const invite_code = crypto.randomUUID().replaceAll("-", ""); const { error } = await admin.from("study_groups").update({ invite_code, updated_at: new Date().toISOString() }).eq("id", params.id); if (error) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ ok: true, invite_code }); }
  if (action === "remove_member") { if (!userId || userId === user.id) return NextResponse.json({ error: "作成者は外せません" }, { status: 400 }); await admin.from("study_group_members").delete().eq("group_id", params.id).eq("user_id", userId); return NextResponse.json({ ok: true }); }
  return NextResponse.json({ error: "不明な操作です" }, { status: 400 });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 }); const admin = createAdminClient();
  const { data: group } = await admin.from("study_groups").select("owner_id").eq("id", params.id).maybeSingle();
  if (!group || group.owner_id !== user.id) return NextResponse.json({ error: "作成者のみ削除できます" }, { status: 403 });
  const { error } = await admin.from("study_groups").delete().eq("id", params.id); if (error) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ ok: true });
}
