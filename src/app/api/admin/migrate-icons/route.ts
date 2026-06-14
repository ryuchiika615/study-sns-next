import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();

  const { data: profiles, error: fetchError } = await admin
    .from("profiles")
    .select("id, icon_url")
    .like("icon_url", "data:%");

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ message: "移行対象のbase64アイコンはありません", count: 0 });
  }

  const results: { id: string; status: string; url?: string; error?: string }[] = [];

  for (const p of profiles) {
    const dataUrl = p.icon_url as string;
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      results.push({ id: p.id, status: "skip", error: "invalid data URL format" });
      continue;
    }

    const mime = match[1];
    const ext = mime.split("/")[1];
    const base64Data = match[2];

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64Data, "base64");
    } catch {
      results.push({ id: p.id, status: "error", error: "base64 decode failed" });
      continue;
    }

    const fileName = `icons/migrated/${p.id}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("avatars")
      .upload(fileName, buffer, {
        contentType: mime,
        upsert: true,
      });

    if (uploadError) {
      results.push({ id: p.id, status: "error", error: `upload failed: ${uploadError.message}` });
      continue;
    }

    const { data: urlData } = admin.storage.from("avatars").getPublicUrl(fileName);
    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) {
      results.push({ id: p.id, status: "error", error: "failed to get public URL" });
      continue;
    }

    const { error: updateError } = await admin
      .from("profiles")
      .update({ icon_url: publicUrl })
      .eq("id", p.id);

    if (updateError) {
      results.push({ id: p.id, status: "error", error: `update failed: ${updateError.message}` });
    } else {
      results.push({ id: p.id, status: "success", url: publicUrl });
    }
  }

  const successCount = results.filter((r) => r.status === "success").length;

  return NextResponse.json({
    message: `${profiles.length}件中 ${successCount}件の移行が完了`,
    total: profiles.length,
    success: successCount,
    results,
  });
}
