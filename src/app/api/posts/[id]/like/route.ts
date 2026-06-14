import { createServerSupabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // トグル
  const { data: existing } = await supabase
    .from("likes")
    .select("*")
    .eq("user_id", user.id)
    .eq("post_id", params.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", params.id);
  } else {
    await supabase.from("likes").insert({ user_id: user.id, post_id: params.id });

    // 通知
    const { data: post } = await supabase
      .from("posts")
      .select("user_id")
      .eq("id", params.id)
      .single();

    if (post && post.user_id !== user.id) {
      await supabase.from("notifications").insert({
        recipient_id: post.user_id,
        sender_id: user.id,
        post_id: params.id,
        notification_type: "like",
      });
    }
  }

  const { count } = await supabase
    .from("likes")
    .select("*", { count: "exact", head: true })
    .eq("post_id", params.id);

  return NextResponse.json({ liked: !existing, count: count ?? 0 });
}
