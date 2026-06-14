import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function checkAdmin() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return null;
  return user;
}

export async function GET() {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data: { users } } = await admin.auth.admin.listUsers();
  const authUsers = users || [];

  const supabase = createServerSupabase();
  const { data: profiles } = await supabase.from("profiles").select("*");

  const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);

  const enriched = authUsers.map((au: any) => {
    const p = profileMap.get(au.id);
    return {
      id: au.id,
      email: au.email,
      username: p?.username || au.email?.split("@")[0] || "",
      display_name: p?.display_name || "",
      is_admin: p?.is_admin || false,
      is_banned: p?.is_banned || false,
      ban_reason: p?.ban_reason || null,
      points: p?.points || 0,
      last_sign_in: au.last_sign_in_at,
      created_at: au.created_at,
    };
  });

  return NextResponse.json({ users: enriched });
}

export async function PUT(request: NextRequest) {
  const u = await checkAdmin();
  if (!u) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { userId, action, value } = body;
  if (!userId || !action) {
    return NextResponse.json({ error: "userId and action required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const supabase = createServerSupabase();

  switch (action) {
    case "set_password": {
      if (!value) return NextResponse.json({ error: "password required" }, { status: 400 });
      await admin.auth.admin.updateUserById(userId, { password: value });
      return NextResponse.json({ success: true, message: "パスワードを変更しました" });
    }

    case "change_username": {
      if (!value) return NextResponse.json({ error: "username required" }, { status: 400 });
      await supabase.from("profiles").update({ username: value }).eq("id", userId);
      return NextResponse.json({ success: true, message: "ユーザーIDを変更しました" });
    }

    case "adjust_points": {
      const pts = parseInt(value);
      if (isNaN(pts)) return NextResponse.json({ error: "invalid points" }, { status: 400 });
      const { data: profile } = await supabase.from("profiles").select("points").eq("id", userId).single();
      const newPoints = Math.max(0, (profile?.points || 0) + pts);
      await supabase.from("profiles").update({ points: newPoints }).eq("id", userId);
      return NextResponse.json({ success: true, points: newPoints });
    }

    case "set_points": {
      const pts = parseInt(value);
      if (isNaN(pts) || pts < 0) return NextResponse.json({ error: "invalid points" }, { status: 400 });
      await admin.from("profiles").update({ points: pts }).eq("id", userId);
      return NextResponse.json({ success: true, points: pts });
    }

    case "toggle_admin": {
      const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", userId).single();
      const newValue = !profile?.is_admin;
      await admin.from("profiles").update({ is_admin: newValue }).eq("id", userId);
      return NextResponse.json({ success: true, is_admin: newValue });
    }

    case "ban": {
      await admin.from("profiles").update({ is_banned: true, ban_reason: value || null }).eq("id", userId);
      return NextResponse.json({ success: true, message: "BANしました" });
    }

    case "unban": {
      await admin.from("profiles").update({ is_banned: false, ban_reason: null }).eq("id", userId);
      return NextResponse.json({ success: true, message: "BANを解除しました" });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
