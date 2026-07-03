import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { youtubeUrl, title } = await request.json();
  if (!youtubeUrl || !youtubeUrl.includes("youtube.com") && !youtubeUrl.includes("youtu.be")) {
    return NextResponse.json({ error: "有効なYouTubeのURLを入力してください" }, { status: 400 });
  }

  const { error } = await supabase.from("bgm_requests").insert({
    user_id: user.id,
    youtube_url: youtubeUrl,
    title: title || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
