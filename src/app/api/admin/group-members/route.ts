import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

async function checkAdmin() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

export async function GET() {
  if (!await checkAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createAdminClient();
  const [{ data: groups, error: groupError }, { data: profiles, error: profileError }, { data: members, error: memberError }] = await Promise.all([
    admin.from("study_groups").select("id, name, description, visibility, owner_id, created_at").order("created_at", { ascending: false }),
    admin.from("profiles").select("id, display_name, username, icon_url, is_banned").order("created_at", { ascending: false }),
    admin.from("study_group_members").select("group_id, user_id, role, joined_at"),
  ]);
  const error = groupError || profileError || memberError;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ groups: groups || [], users: (profiles || []).filter((profile: any) => !profile.is_banned), members: members || [] });
}

export async function POST(request: NextRequest) {
  const operator = await checkAdmin();
  if (!operator) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { groupId, userId } = await request.json();
  if (!groupId || !userId) return NextResponse.json({ error: "グループとユーザーを選択してください" }, { status: 400 });

  const admin = createAdminClient();
  const [{ data: group }, { data: profile }] = await Promise.all([
    admin.from("study_groups").select("id, name").eq("id", groupId).maybeSingle(),
    admin.from("profiles").select("id, is_banned").eq("id", userId).maybeSingle(),
  ]);
  if (!group) return NextResponse.json({ error: "グループが見つかりません" }, { status: 404 });
  if (!profile || profile.is_banned) return NextResponse.json({ error: "追加できないユーザーです" }, { status: 400 });

  const { error } = await admin.from("study_group_members").upsert(
    { group_id: groupId, user_id: userId, role: "member" },
    { onConflict: "group_id,user_id", ignoreDuplicates: true },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, message: `「${group.name}」に追加しました` });
}
