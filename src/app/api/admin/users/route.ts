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
      points: p?.points || 0,
      last_sign_in: au.last_sign_in_at,
      created_at: au.created_at,
    };
  });

  return NextResponse.json({ users: enriched });
}

export async function PUT(request: NextRequest) {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { userId, action } = body;

  if (!userId || !action) {
    return NextResponse.json({ error: "userId and action required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const supabase = createServerSupabase();

  switch (action) {
    case "reset_password": {
      await admin.auth.admin.updateUserById(userId, { password: "resetme123" });
      return NextResponse.json({ success: true, message: "パスワードを resetme123 にリセットしました" });
    }

    case "toggle_admin": {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userId)
        .single();

      const newValue = !profile?.is_admin;
      await supabase.from("profiles").update({ is_admin: newValue }).eq("id", userId);
      return NextResponse.json({ success: true, is_admin: newValue });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
