import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

async function currentUser() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data } = await admin.from("x_connections").select("x_user_id, username, display_name, profile_image_url, connected_at").eq("user_id", user.id).maybeSingle();
  return NextResponse.json({ connection: data || null });
}

// OAuthから戻った直後だけ呼ぶ。リクエスト本文ではなく、ログイン中ユーザーのAuth identityを信頼する。
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const identity: any = user.identities?.find((item: any) => item.provider === "x");
  if (!identity?.provider_id) return NextResponse.json({ error: "Xアカウントが連携されていません" }, { status: 400 });
  const data = identity.identity_data || {};
  const admin = createAdminClient();
  const { error } = await admin.from("x_connections").upsert({
    user_id: user.id,
    x_user_id: identity.provider_id,
    username: data.user_name || data.username || data.preferred_username || null,
    display_name: data.full_name || data.name || null,
    profile_image_url: data.avatar_url || data.picture || null,
    connected_at: identity.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  await admin.from("x_connections").delete().eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
