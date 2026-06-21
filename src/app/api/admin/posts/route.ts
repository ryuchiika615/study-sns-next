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
  const limit = 10;
  const offset = (page - 1) * limit;

  const supabase = createServerSupabase();
  const [{ data: posts, error }, { count }] = await Promise.all([
    supabase
      .from("posts")
      .select("*, user:user_id(display_name, username)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
    supabase.from("posts").select("*", { count: "exact", head: true }),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts, totalPages: Math.ceil((count || 0) / limit), currentPage: page });
}

export async function PATCH(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { postId, content, study_minutes } = await request.json();
  if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });

  const admin = createAdminClient();
  const updateData: Record<string, any> = {};
  if (content !== undefined) updateData.content = content.trim();
  if (study_minutes !== undefined) updateData.study_minutes = study_minutes;
  updateData.updated_at = new Date().toISOString();

  const { error } = await admin.from("posts").update(updateData).eq("id", postId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const { postIds } = body || {};
  if (!postIds?.length) return NextResponse.json({ error: "postIds required" }, { status: 400 });

  const admin = createAdminClient();
  const { error, count } = await admin.from("posts").delete({ count: "exact" }).in("id", postIds);
  if (error) return NextResponse.json({ error: `delete error: ${error.message}` }, { status: 500 });
  return NextResponse.json({ success: true, deleted: count });
}
