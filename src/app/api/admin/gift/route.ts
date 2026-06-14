import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, itemName, rarity, itemType } = await request.json();
  if (!userId || !itemName) {
    return NextResponse.json({ error: "userId and itemName required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // アイテムを取得または作成
  let { data: item } = await supabase
    .from("gacha_items")
    .select("*")
    .eq("name", itemName)
    .maybeSingle();

  if (!item) {
    const { data: newItem } = await supabase
      .from("gacha_items")
      .insert({ name: itemName, rarity: rarity || "N", category: itemType || "title" })
      .select()
      .single();
    item = newItem;
  }

  if (!item) return NextResponse.json({ error: "Failed to create item" }, { status: 500 });

  // ユーザーに付与
  await supabase.from("user_items").insert({ user_id: userId, item_id: item.id });

  // 通知を作成
  await supabase.from("notifications").insert({
    recipient_id: userId,
    sender_id: user.id,
    notification_type: "gift",
    post_id: null,
  });

  return NextResponse.json({ success: true, item });
}
