import { NextRequest, NextResponse } from "next/server";
import { Innertube } from "youtubei.js";
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

    const videoId = new URL(youtubeUrl).searchParams.get("v") || youtubeUrl.split("youtu.be/")[1]?.split("?")[0];
    if (!videoId) return NextResponse.json({ error: "動画IDが見つかりません" }, { status: 400 });

    const yt = await Innertube.create({
      lang: "ja",
      retrieve_player: false,
    });

    const info = await yt.getInfo(videoId);
    const title = info.basic_info.title?.slice(0, 50) || "Unknown";

    const stream = await info.download({
      type: "audio",
      quality: "best",
    });

    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLength = chunks.reduce((sum, c) => sum + c.byteLength, 0);
    const audioBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      audioBuffer.set(chunk, offset);
      offset += chunk.byteLength;
    }

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

    const duration = info.basic_info.duration ? Math.round(info.basic_info.duration) : 0;

    const { error: insertError } = await supabase.from("audio_bgm").insert({
      user_id: user.id,
      name: title,
      duration_seconds: duration,
      audio_url: urlData.publicUrl,
      price: 0,
    });

    if (insertError) {
      return NextResponse.json({ error: `保存失敗: ${insertError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, title, audio_url: urlData.publicUrl });
  } catch (err: any) {
    console.error("youtube-convert error:", err);
    const msg = err?.message || "";
    if (msg.includes("login required") || msg.includes("LOGIN_REQUIRED")) {
      return NextResponse.json({ error: "この動画はダウンロードできません（ログイン制限）。管理者に依頼してください。" }, { status: 400 });
    }
    if (msg.includes("Private video") || msg.includes("private")) {
      return NextResponse.json({ error: "この動画は非公開です。管理者に依頼してください。" }, { status: 400 });
    }
    return NextResponse.json({ error: `変換失敗: ${msg}` }, { status: 500 });
  }
}
