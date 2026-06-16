import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { post_id, reaction } = await request.json();
  if (!post_id || !reaction) return NextResponse.json({ error: "post_id and reaction required" }, { status: 400 });

  const validReactions = ["👍", "🔥", "💯", "🎉", "❤️", "😢"];
  if (!validReactions.includes(reaction)) return NextResponse.json({ error: "invalid reaction" }, { status: 400 });

  const { data: existing } = await supabase
    .from("post_reactions")
    .select("reaction")
    .eq("post_id", post_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    if (existing.reaction === reaction) {
      await supabase.from("post_reactions").delete().eq("post_id", post_id).eq("user_id", user.id);
      return NextResponse.json({ action: "removed" });
    }
    await supabase.from("post_reactions").update({ reaction }).eq("post_id", post_id).eq("user_id", user.id);
    return NextResponse.json({ action: "updated" });
  }

  await supabase.from("post_reactions").insert({ post_id, user_id: user.id, reaction });
  return NextResponse.json({ action: "added" });
}
