import { NextRequest, NextResponse } from "next/server";
import { Innertube, ClientType } from "youtubei.js";
import { createServerSupabase } from "@/lib/supabase-server";

const CLIENT_ORDER: ClientType[] = [
  ClientType.TV,
  ClientType.ANDROID,
  ClientType.IOS,
  ClientType.WEB,
];

async function tryDownload(videoId: string): Promise<{ buffer: Uint8Array; title: string; duration: number }> {
  for (const clientType of CLIENT_ORDER) {
    try {
      const yt = await Innertube.create({
        lang: "ja",
        retrieve_player: false,
        client_type: clientType,
      });

      const info = await yt.getInfo(videoId);
      const title = info.basic_info.title?.slice(0, 50) || "Unknown";
      const duration = info.basic_info.duration ? Math.round(info.basic_info.duration) : 0;

      const stream = await info.download({ type: "audio", quality: "best" });

      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLength = chunks.reduce((sum, c) => sum + c.byteLength, 0);
      const buffer = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.byteLength;
      }

      return { buffer, title, duration };
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("login required") || msg.includes("LOGIN_REQUIRED") || msg.includes("Private video") || msg.toLowerCase().includes("private")) {
        const isLast = clientType === CLIENT_ORDER[CLIENT_ORDER.length - 1];
        if (isLast) throw e;
        continue;
      }
      throw e;
    }
  }
  throw new Error("すべてのクライアントでダウンロードできませんでした");
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { youtubeUrl, title: customTitle } = await request.json();
    if (!youtubeUrl || (!youtubeUrl.includes("youtube.com") && !youtubeUrl.includes("youtu.be"))) {
      return NextResponse.json({ error: "有効なYouTubeのURLを入力してください" }, { status: 400 });
    }

    const videoId = new URL(youtubeUrl).searchParams.get("v") || youtubeUrl.split("youtu.be/")[1]?.split("?")[0];
    if (!videoId) return NextResponse.json({ error: "動画IDが見つかりません" }, { status: 400 });

    const { buffer, title: extractedTitle, duration } = await tryDownload(videoId);
    const title = customTitle || extractedTitle;

    const fileName = `bgm/${user.id}/youtube-${Date.now()}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from("audio-bgm")
      .upload(fileName, buffer, { contentType: "audio/mpeg" });

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
    if (msg.includes("login required") || msg.includes("LOGIN_REQUIRED") || msg.includes("Private video") || msg.toLowerCase().includes("private")) {
      return NextResponse.json({ error: "この動画はダウンロードできません（ログイン制限）。管理者に依頼してください。" }, { status: 400 });
    }
    return NextResponse.json({ error: `変換失敗: ${msg}` }, { status: 500 });
  }
}
