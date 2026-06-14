import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [existingResult, postResult, countResult] = await Promise.all([
    supabase.from("likes").select("*").eq("user_id", user.id).eq("post_id", params.id).maybeSingle(),
    supabase.from("posts").select("user_id").eq("id", params.id).single(),
    supabase.from("likes").select("*", { count: "exact", head: true }).eq("post_id", params.id),
  ]);

  const existing = existingResult.data;
  const count = countResult.count ?? 0;

  if (existing) {
    await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", params.id);
  } else {
    await supabase.from("likes").insert({ user_id: user.id, post_id: params.id });

    const post = postResult.data;
    if (post && post.user_id !== user.id) {
      await supabase.from("notifications").insert({
        recipient_id: post.user_id,
        sender_id: user.id,
        post_id: params.id,
        notification_type: "like",
      });
    }
  }

  return NextResponse.json({ liked: !existing, count });
}
