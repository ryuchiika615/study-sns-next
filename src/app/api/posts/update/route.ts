import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId, content, study_minutes } = await request.json();
  if (!postId || !content?.trim()) {
    return NextResponse.json({ error: "postId and content required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("posts")
    .update({ content: content.trim(), study_minutes: study_minutes || 0 })
    .eq("id", postId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
