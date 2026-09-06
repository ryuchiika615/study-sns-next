import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインしてください。" }, { status: 401 });
  const { data: order } = await supabase.from("digital_product_orders").select("id").eq("user_id", user.id).eq("product_key", "rescue_semester_v1").maybeSingle();
  if (!order) return NextResponse.json({ error: "購入を確認できません。" }, { status: 403 });
  try {
    const body = await readFile(path.join(process.cwd(), "private", "digital-products", "ryutter-deadline-rescue-semester.xlsx"));
    return new NextResponse(body, { headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": "attachment; filename=ryutter-deadline-rescue-semester.xlsx",
      "cache-control": "private, no-store",
    }});
  } catch {
    return NextResponse.json({ error: "ファイルを準備できませんでした。" }, { status: 503 });
  }
}
