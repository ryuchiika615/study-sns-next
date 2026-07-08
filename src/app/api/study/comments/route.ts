import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const deckId = searchParams.get("deck_id");
  if (!deckId) return NextResponse.json({ error: "deck_id required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: comments } = await admin
    .from("deck_comments")
    .select("id, content, created_at, user_id")
    .eq("deck_id", deckId)
    .order("created_at", { ascending: true });

  const userIds = [...new Set((comments || []).map((c: any) => c.user_id))];
  const { data: profiles } = userIds.length > 0
    ? await admin.from("profiles").select("id, display_name, username").in("id", userIds)
    : { data: [] };
  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
  const result = (comments || []).map((c: any) => ({ ...c, profiles: profileMap.get(c.user_id) || null }));

  return NextResponse.json({ comments: result });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deck_id, content } = await request.json();
  if (!deck_id) return NextResponse.json({ error: "deck_id required" }, { status: 400 });
  if (!content?.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: newComment, error } = await admin
    .from("deck_comments")
    .insert({ deck_id, user_id: user.id, content: content.trim() })
    .select("id, content, created_at, user_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: commentProfile } = await admin
    .from("profiles")
    .select("display_name, username")
    .eq("id", user.id)
    .single();

  return NextResponse.json({ comment: { ...newComment, profiles: commentProfile } });
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase.from("deck_comments").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
