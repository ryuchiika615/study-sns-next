import { createServerSupabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rarity, itemType, itemName } = await request.json();

  const BUY_COSTS: Record<string, number> = {
    N: 5, R: 15, SR: 60, SSR: 240, UR: 720, LR: 2600,
  };

  const cost = BUY_COSTS[rarity];
  if (!cost) return NextResponse.json({ error: "Invalid rarity" }, { status: 400 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("exchange_points")
    .eq("id", user.id)
    .single();

  if (!profile || profile.exchange_points < cost) {
    return NextResponse.json({ error: "Insufficient points" }, { status: 400 });
  }

  // アイテムを取得または作成
  let { data: item } = await supabase
    .from("gacha_items")
    .select("*")
    .eq("name", itemName)
    .maybeSingle();

  if (!item) {
    const { data: newItem } = await supabase
      .from("gacha_items")
      .insert({ name: itemName, rarity, category: itemType || "title" })
      .select()
      .single();
    item = newItem;
  }

  if (!item) return NextResponse.json({ error: "Failed to create item" }, { status: 500 });

  // 所持アイテムに追加
  await supabase
    .from("user_items")
    .insert({ user_id: user.id, item_id: item.id });

  // ポイント減算
  await supabase
    .from("profiles")
    .update({ exchange_points: profile.exchange_points - cost })
    .eq("id", user.id);

  return NextResponse.json({ item, remaining_points: profile.exchange_points - cost });
}
