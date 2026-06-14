import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();

  const { data: comments, error } = await supabase
    .from("comments")
    .select("*, user:user_id(*)")
    .eq("post_id", params.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comments });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text } = await request.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  const [commentResult, postResult] = await Promise.all([
    supabase.from("comments").insert({ post_id: params.id, user_id: user.id, text: text.trim() })
      .select("*, user:user_id(*)").single(),
    supabase.from("posts").select("user_id").eq("id", params.id).single(),
  ]);

  if (commentResult.error) return NextResponse.json({ error: commentResult.error.message }, { status: 500 });

  const post = postResult.data;
  if (post && post.user_id !== user.id) {
    await supabase.from("notifications").insert({
      recipient_id: post.user_id,
      sender_id: user.id,
      post_id: params.id,
      notification_type: "reply",
    });
  }

  return NextResponse.json({ comment: commentResult.data });
}
