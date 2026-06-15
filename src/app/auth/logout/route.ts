import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  await admin
    .from("login_sessions")
    .update({ logout_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("logout_at", null);

  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/auth/login", request.url));
}
