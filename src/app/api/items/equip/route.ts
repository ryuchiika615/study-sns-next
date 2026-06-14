import { createServerSupabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId, slot } = await request.json();
  // slot: "current_title_id" or "current_avatar_id"

  // 所有チェック
  const { data: ownership } = await supabase
    .from("user_items")
    .select("*")
    .eq("user_id", user.id)
    .eq("item_id", itemId)
    .maybeSingle();

  if (!ownership) return NextResponse.json({ error: "Item not owned" }, { status: 400 });

  await supabase
    .from("profiles")
    .update({ [slot]: itemId })
    .eq("id", user.id);

  return NextResponse.json({ success: true });
}
