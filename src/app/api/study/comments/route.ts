import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const deckId = searchParams.get("deck_id");
  if (!deckId) return NextResponse.json({ error: "deck_id required" }, { status: 400 });

  const { data: comments } = await supabase
    .from("deck_comments")
    .select("*, profiles!inner(display_name, username, avatar_url)")
    .eq("deck_id", deckId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ comments: comments || [] });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deck_id, content } = await request.json();
  if (!deck_id) return NextResponse.json({ error: "deck_id required" }, { status: 400 });
  if (!content?.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });

  const { data, error } = await supabase
    .from("deck_comments")
    .insert({ deck_id, user_id: user.id, content: content.trim() })
    .select("*, profiles!inner(display_name, username, avatar_url)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comment: data });
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
