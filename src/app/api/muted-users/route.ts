import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("muted_users")
    .select("muted_user_id, created_at")
    .eq("user_id", user.id);

  return NextResponse.json({ mutedUsers: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { muted_user_id } = await request.json();
  if (!muted_user_id) return NextResponse.json({ error: "muted_user_id required" }, { status: 400 });

  const { error } = await supabase
    .from("muted_users")
    .insert({ user_id: user.id, muted_user_id });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { muted_user_id } = await request.json();
  if (!muted_user_id) return NextResponse.json({ error: "muted_user_id required" }, { status: 400 });

  const { error } = await supabase
    .from("muted_users")
    .delete()
    .eq("user_id", user.id)
    .eq("muted_user_id", muted_user_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
