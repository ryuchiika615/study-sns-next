import { NextRequest, NextResponse } from "next/server";
import ytdl from "@distube/ytdl-core";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { youtubeUrl } = await request.json();
    if (!youtubeUrl || (!youtubeUrl.includes("youtube.com") && !youtubeUrl.includes("youtu.be"))) {
      return NextResponse.json({ error: "有効なYouTubeのURLを入力してください" }, { status: 400 });
    }

    const info = await ytdl.getInfo(youtubeUrl);
    const format = ytdl.chooseFormat(info.formats, { quality: "lowestaudio", filter: "audioonly" });
    if (!format) return NextResponse.json({ error: "音声が見つかりませんでした" }, { status: 500 });

    const title = info.videoDetails.title?.slice(0, 50) || "Unknown";
    const stream = ytdl(youtubeUrl, { format });

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    const fileName = `bgm/${user.id}/youtube-${Date.now()}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from("audio-bgm")
      .upload(fileName, audioBuffer, { contentType: "audio/mpeg" });

    if (uploadError) {
      return NextResponse.json({ error: `アップロード失敗: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from("audio-bgm").getPublicUrl(fileName);
    if (!urlData?.publicUrl) {
      return NextResponse.json({ error: "公開URLの取得に失敗" }, { status: 500 });
    }

    const { error: insertError } = await supabase.from("audio_bgm").insert({
      user_id: user.id,
      name: title,
      duration_seconds: Math.round(Number(info.videoDetails.lengthSeconds) || 0),
      audio_url: urlData.publicUrl,
      price: 0,
    });

    if (insertError) {
      return NextResponse.json({ error: `保存失敗: ${insertError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, title, audio_url: urlData.publicUrl });
  } catch (err: any) {
    console.error("youtube-convert error:", err);
    return NextResponse.json({ error: err?.message || "変換に失敗しました" }, { status: 500 });
  }
}
