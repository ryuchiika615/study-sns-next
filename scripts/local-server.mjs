import { createServer } from "http";
import { execSync } from "child_process";
import { readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createClient } from "@supabase/supabase-js";

const PORT = 3456;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("環境変数が不足しています。プロジェクトルートで実行してください。");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function convert(youtubeUrl, userId, requestId, res) {
  const outPath = join(tmpdir(), `ytbgm-${Date.now()}.mp3`);
  try {
    const info = execSync(`yt-dlp --print "%(title)s" "${youtubeUrl}"`, { encoding: "utf-8" });
    const title = info.trim().slice(0, 50) || "YouTube BGM";

    execSync(`yt-dlp -x --audio-format mp3 -o "${outPath}" "${youtubeUrl}"`, { stdio: "inherit" });

    const buffer = readFileSync(outPath);
    const fileName = `bgm/${userId}/youtube-${Date.now()}.mp3`;

    const { error: upErr } = await supabase.storage
      .from("audio-bgm")
      .upload(fileName, buffer, { contentType: "audio/mpeg" });
    if (upErr) throw new Error(`アップロード失敗: ${upErr.message}`);

    const { data: urlData } = supabase.storage.from("audio-bgm").getPublicUrl(fileName);
    if (!urlData?.publicUrl) throw new Error("公開URLの取得に失敗");

    console.log("データベースに保存中...");
    const { error: insErr } = await supabase.from("audio_bgm").insert({
      user_id: userId, name: title, duration_seconds: 0, audio_url: urlData.publicUrl, price: 0,
    });
    if (insErr) throw new Error(`保存失敗: ${insErr.message}`);

    if (requestId) {
      await supabase.from("bgm_requests").update({ status: "completed" }).eq("id", requestId);
    }

    return { success: true, title, audio_url: urlData.publicUrl };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    try { unlinkSync(outPath); } catch {}
  }
}

function renderPage(requests, converting, result) {
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BGM ローカル変換サーバー</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, sans-serif; background: #f5f5f5; padding: 20px; color: #333; }
  h1 { font-size: 20px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .card { background: #fff; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .card h3 { font-size: 14px; margin-bottom: 4px; }
  .card .meta { font-size: 12px; color: #888; }
  .card a { font-size: 12px; color: #3b82f6; word-break: break-all; }
  .btn { display: inline-block; padding: 8px 20px; border-radius: 999px; font-size: 13px; font-weight: bold; cursor: pointer; border: none; color: #fff; text-decoration: none; }
  .btn-primary { background: #3b82f6; }
  .btn-primary:hover { background: #2563eb; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-success { background: #22c55e; }
  .empty { text-align: center; padding: 40px 0; color: #aaa; font-size: 14px; }
  .result { margin-top: 12px; padding: 10px; border-radius: 8px; font-size: 13px; }
  .result.success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
  .result.error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
  .status-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #333; color: #fff; padding: 8px 20px; font-size: 12px; text-align: center; }
</style>
</head>
<body>
<h1>🎵 BGM ローカル変換</h1>
${result ? `<div class="result ${result.success ? 'success' : 'error'}">${result.success ? `✅ 「${result.title}」を追加しました！` : `❌ ${result.error}`}</div>` : ""}
<div class="card">
  <h3>💡 使い方</h3>
  <p style="font-size:12px;color:#888;margin-top:4px">「変換」ボタンを押すと <b>yt-dlp</b> でMP3変換 → Supabaseにアップロード → ユーザーにギフトされます。変換中はこの画面を閉じないでください。</p>
</div>
${requests.length === 0 ? '<div class="empty">📭 未対応のリクエストはありません</div>' : requests.map(req => `
<div class="card">
  <h3>${req.user?.display_name || "不明"} (@${req.user?.username || "?"})</h3>
  <div class="meta">${new Date(req.created_at).toLocaleString("ja-JP")}</div>
  <a href="${req.youtube_url}" target="_blank">${req.youtube_url}</a>
  ${req.title ? `<div class="meta" style="margin-top:4px">タイトル: ${req.title}</div>` : ""}
  <div style="margin-top:10px">
    <form method="POST" action="/convert/${req.id}" style="display:inline">
      <button class="btn btn-primary" type="submit" ${converting ? "disabled" : ""}>${converting ? "変換中..." : "変換する"}</button>
    </form>
  </div>
</div>
`).join("")}
<div style="margin-top:20px;text-align:center">
  <a href="/" class="btn btn-primary" style="background:#888">🔄 更新</a>
</div>
<div class="status-bar">🟢 サーバー起動中 | ポート ${PORT}</div>
</body>
</html>`;
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  if (path.startsWith("/convert/")) {
    const requestId = path.split("/convert/")[1];
    if (!requestId) { res.writeHead(302, { Location: "/" }); res.end(); return; }

    const { data: requests } = await supabase
      .from("bgm_requests")
      .select("*, user:user_id(id, display_name, username)")
      .eq("id", requestId)
      .limit(1);

    const reqData = requests?.[0];
    if (!reqData) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderPage([], true, { success: false, error: "リクエストが見つかりません" }));
      return;
    }

    const result = await convert(reqData.youtube_url, reqData.user_id, requestId);

    const { data: remaining } = await supabase
      .from("bgm_requests")
      .select("*, user:user_id(id, display_name, username)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderPage(remaining || [], false, result));
    return;
  }

  // Top page: show pending requests
  const { data: pending } = await supabase
    .from("bgm_requests")
    .select("*, user:user_id(id, display_name, username)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(renderPage(pending || [], false, null));
}).listen(PORT, () => {
  console.log(`\n  🎵 BGMローカル変換サーバー起動！`);
  console.log(`  http://localhost:${PORT} にアクセスしてください\n`);
});
