import { execSync } from "child_process";
import { readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createClient } from "@supabase/supabase-js";

const [,, youtubeUrl, userId] = process.argv;

if (!youtubeUrl || !userId) {
  console.log("使用方法: node scripts/convert-youtube.mjs <YouTube URL> <ユーザーID>");
  console.log("例: node scripts/convert-youtube.mjs https://youtu.be/xxxxx 00000000-0000-0000-0000-000000000000");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("環境変数 NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const outPath = join(tmpdir(), `ytbgm-${Date.now()}.mp3`);

try {
  console.log("ダウンロード中...");
  execSync(`yt-dlp -x --audio-format mp3 -o "${outPath}" "${youtubeUrl}"`, { stdio: "inherit" });

  const buffer = readFileSync(outPath);
  const fileName = `bgm/${userId}/youtube-${Date.now()}.mp3`;

  console.log("アップロード中...");
  const { error: uploadError } = await supabase.storage
    .from("audio-bgm")
    .upload(fileName, buffer, { contentType: "audio/mpeg" });

  if (uploadError) throw new Error(`アップロード失敗: ${uploadError.message}`);

  const { data: urlData } = supabase.storage.from("audio-bgm").getPublicUrl(fileName);
  if (!urlData?.publicUrl) throw new Error("公開URLの取得に失敗");

  const title = youtubeUrl.split("/").pop()?.slice(0, 50) || "YouTube BGM";

  console.log("データベースに保存中...");
  const { error: insertError } = await supabase.from("audio_bgm").insert({
    user_id: userId,
    name: title,
    duration_seconds: 0,
    audio_url: urlData.publicUrl,
    price: 0,
  });

  if (insertError) throw new Error(`保存失敗: ${insertError.message}`);

  console.log("完了！");
  console.log(`タイトル: ${title}`);
  console.log(`URL: ${urlData.publicUrl}`);
} catch (err) {
  console.error("エラー:", err.message);
  process.exit(1);
} finally {
  try { unlinkSync(outPath); } catch {}
}
