import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!p?.is_admin) return null;
  return user;
}

export async function GET(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const status = searchParams.get("status") || "unresolved";
  const limit = 5;
  const offset = (page - 1) * limit;

  const admin = createAdminClient();
  let query = admin
    .from("user_feedback")
    .select("*", { count: "estimated" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status === "resolved") {
    query = query.eq("resolved", true);
  } else {
    query = query.eq("resolved", false);
  }

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = [...new Set((data || []).map(f => f.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name, username, icon_url")
    .in("id", userIds);

  const merged = (data || []).map(f => ({
    ...f,
    user: (profiles || []).find(p => p.id === f.user_id) || null,
  }));

  return NextResponse.json({ data: merged, total: count });
}
