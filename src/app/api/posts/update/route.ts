import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId, content, study_minutes, subject, study_date } = await request.json();
  if (!postId || !content?.trim()) {
    return NextResponse.json({ error: "postId and content required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const updateData: Record<string, any> = { content: content.trim(), study_minutes: study_minutes || 0 };
  if (subject !== undefined) updateData.subject = subject;
  if (study_date !== undefined) updateData.study_date = study_date;
  updateData.updated_at = new Date().toISOString();
  const { error } = await admin.from("posts").update(updateData).eq("id", postId).eq("user_id", user.id);

  if (error) {
    delete updateData.updated_at;
    const { error: error2 } = await admin.from("posts").update(updateData).eq("id", postId).eq("user_id", user.id);
    if (error2) return NextResponse.json({ error: error2.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
