// 使用方法: node scripts/gift-youtube-all.mjs <YouTubeURL> [曲名]
// SUPABASE_SERVICE_ROLE_KEY と NEXT_PUBLIC_SUPABASE_URL が必要
//
// 依存: yt-dlp (Python) + ffmpeg がシステムにインストールされていること
// 必要: npm install @supabase/supabase-js

import { execSync } from "child_process";
import { readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です");
  process.exit(1);
}

const youtubeUrl = process.argv[2];
const customTitle = process.argv[3];

if (!youtubeUrl) {
  console.error("使用方法: node scripts/gift-youtube-all.mjs <YouTubeURL> [曲名]");
  process.exit(1);
}

const PYTHON = "C:\\Users\\ryuch\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  // 1. yt-dlp でタイトル取得
  console.log(`\n🎵 タイトル取得中: ${youtubeUrl}`);
  const titleRaw = execSync(`chcp 65001 >NUL && "${PYTHON}" -m yt_dlp --print "%(title)s" "${youtubeUrl}"`, { encoding: "utf-8" });
  const extractedTitle = (titleRaw || "").trim().slice(0, 50) || "YouTube BGM";
  const name = customTitle || extractedTitle;
  console.log(`   タイトル: ${name}`);

  // 2. yt-dlp で MP3 ダウンロード
  const outPath = join(tmpdir(), `ytbgm-${Date.now()}.mp3`);
  console.log(`\n⬇️  MP3ダウンロード中...`);
  execSync(`chcp 65001 >NUL && "${PYTHON}" -m yt_dlp -x --audio-format mp3 -o "${outPath}" "${youtubeUrl}"`, { stdio: "inherit" });

  const buffer = readFileSync(outPath);

  // 3. Storageにアップロード
  const fileName = `bgm/gift/youtube-all-${Date.now()}.mp3`;
  console.log(`\n📤 Storageにアップロード中...`);
  const { error: uploadError } = await supabase.storage
    .from("audio-bgm")
    .upload(fileName, buffer, { contentType: "audio/mpeg", upsert: true });
  if (uploadError) {
    console.error(`   アップロード失敗: ${uploadError.message}`);
    process.exit(1);
  }
  const { data: urlData } = supabase.storage.from("audio-bgm").getPublicUrl(fileName);
  if (!urlData?.publicUrl) {
    console.error("   公開URL取得失敗");
    process.exit(1);
  }
  console.log(`   公開URL: ${urlData.publicUrl}`);

  // 4. 管理者ユーザーを取得
  console.log(`\n👤 管理者ユーザーを検索中...`);
  const { data: admins } = await supabase.from("profiles").select("id").eq("is_admin", true).limit(1);
  const adminId = admins?.[0]?.id;
  if (!adminId) {
    console.error("   管理者ユーザーが見つかりません");
    process.exit(1);
  }
  console.log(`   管理者ID: ${adminId}`);

  // 5. audio_bgm 作成
  console.log(`\n💿 audio_bgm 作成中...`);
  const { data: bgm, error: insertError } = await supabase
    .from("audio_bgm")
    .insert({ user_id: adminId, name, duration_seconds: 0, audio_url: urlData.publicUrl, price: 0 })
    .select()
    .single();
  if (insertError) {
    console.error(`   BGM作成失敗: ${insertError.message}`);
    process.exit(1);
  }
  console.log(`   BGM ID: ${bgm.id}`);

  // 6. 全ユーザー取得
  console.log(`\n👥 全ユーザー取得中...`);
  const { data: allUsers } = await supabase.from("profiles").select("id");
  if (!allUsers?.length) {
    console.error("   ユーザーがいません");
    process.exit(1);
  }
  console.log(`   ${allUsers.length}人見つかりました`);

  // 7. purchased_bgm に一括登録
  console.log(`\n📦 purchased_bgm に一括登録中...`);
  const batchSize = 500;
  let inserted = 0;
  for (let i = 0; i < allUsers.length; i += batchSize) {
    const batch = allUsers.slice(i, i + batchSize);
    const pairs = batch.map((u) => ({ user_id: u.id, bgm_id: bgm.id }));
    const { error: batchError } = await supabase
      .from("purchased_bgm")
      .upsert(pairs, { onConflict: "user_id,bgm_id", ignoreDuplicates: true });
    if (batchError) {
      console.error(`   バッチ ${i}-${i + batch.length} 失敗: ${batchError.message}`);
    } else {
      inserted += batch.length;
    }
    process.stdout.write(`\r   ${inserted}/${allUsers.length} 完了`);
  }
  console.log(`\n\n   ✅ ${inserted}人に配布完了`);

  // 8. 通知作成
  console.log(`\n🔔 通知作成中...`);
  let notified = 0;
  for (let i = 0; i < allUsers.length; i += batchSize) {
    const batch = allUsers.slice(i, i + batchSize);
    const notifPairs = batch.map((u) => ({
      recipient_id: u.id,
      sender_id: adminId,
      notification_type: "gift",
      post_id: bgm.id,
    }));
    const { error: notifError } = await supabase
      .from("notifications")
      .insert(notifPairs);
    if (notifError) {
      if (notifError.message?.includes("column")) {
        const fallback = batch.map((u) => ({
          recipient_id: u.id,
          sender_id: adminId,
          notification_type: "gift",
        }));
        await supabase.from("notifications").insert(fallback);
      }
    }
    notified += batch.length;
    process.stdout.write(`\r   ${notified}/${allUsers.length} 通知完了`);
  }

  console.log(`\n\n🎉 完了！「${name}」を${inserted}人に配布、${notified}人に通知しました`);
  console.log(`   あなたもBGM一覧で確認できます 🎧`);
}

main().catch((err) => {
  console.error("エラー:", err);
  process.exit(1);
});
