import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: p } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!p?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: posts, error } = await supabase
    .from("posts")
    .select("*, user:user_id(display_name, username)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts });
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: p } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!p?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const { postIds } = body;
  if (!postIds?.length) return NextResponse.json({ error: "postIds required" }, { status: 400 });

  let admin;
  try {
    admin = createAdminClient();
  } catch (e: any) {
    return NextResponse.json({ error: `admin client error: ${e.message}` }, { status: 500 });
  }

  const { error, count } = await admin
    .from("posts")
    .delete({ count: "exact" })
    .in("id", postIds);

  if (error) return NextResponse.json({ error: `delete error: ${error.message}` }, { status: 500 });
  return NextResponse.json({ success: true, deleted: count });
}
