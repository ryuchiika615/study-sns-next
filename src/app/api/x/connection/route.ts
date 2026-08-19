import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

async function currentUser() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function xIdentity(user: any) {
  return user?.identities?.find((item: any) => item.provider === "x" || item.provider === "twitter");
}

async function syncConnection(user: any) {
  const identity: any = xIdentity(user);
  if (!identity?.provider_id) return null;
  const data = identity.identity_data || {};
  const admin = createAdminClient();
  const connection = {
    user_id: user.id,
    x_user_id: identity.provider_id,
    username: data.user_name || data.username || data.preferred_username || null,
    display_name: data.full_name || data.name || null,
    profile_image_url: data.avatar_url || data.picture || null,
    connected_at: identity.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("x_connections").upsert(connection);
  if (error) throw new Error(error.message);
  return connection;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const [{ data }, { data: profile }] = await Promise.all([
    admin.from("x_connections").select("x_user_id, username, display_name, profile_image_url, connected_at").eq("user_id", user.id).maybeSingle(),
    admin.from("profiles").select("display_name, username").eq("id", user.id).maybeSingle(),
  ]);
  let connection = data;
  // コールバック直後はテーブルへの保存より先に画面が表示されることがあるため、Auth identityから復元する。
  if (!connection && xIdentity(user)) {
    const identity: any = xIdentity(user);
    const identityData = identity.identity_data || {};
    const fallback = {
      x_user_id: identity.provider_id,
      username: identityData.user_name || identityData.username || identityData.preferred_username || null,
      display_name: identityData.full_name || identityData.name || null,
      profile_image_url: identityData.avatar_url || identityData.picture || null,
      connected_at: identity.created_at || new Date().toISOString(),
    };
    try { connection = await syncConnection(user); } catch { connection = fallback; }
  }
  return NextResponse.json({ connection: connection || null, ryutter: profile || null });
}

// OAuthから戻った直後だけ呼ぶ。リクエスト本文ではなく、ログイン中ユーザーのAuth identityを信頼する。
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const connection = await syncConnection(user);
    if (!connection) return NextResponse.json({ error: "Xアカウントが連携されていません" }, { status: 400 });
    return NextResponse.json({ ok: true, connection });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "X連携情報の保存に失敗しました" }, { status: 400 });
  }
}

export async function DELETE() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  await admin.from("x_connections").delete().eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
