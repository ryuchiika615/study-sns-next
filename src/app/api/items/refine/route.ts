import { createServerSupabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

// 部位合成（カスタム称号作成）
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { word, noun, namePart, order } = await request.json();

  const RARITY_ORDER: Record<string, number> = {
    N: 1, R: 2, SR: 3, SSR: 4, UR: 5, LR: 6,
  };
  const RARITY_BY_VALUE: Record<number, string> = {
    1: "N", 2: "R", 3: "SR", 4: "SSR", 5: "UR", 6: "LR",
  };

  const fullTitle =
    order === "name_first"
      ? `${namePart || ""}${word || ""}${noun || ""}`
      : order === "noun_first"
      ? `${noun || ""}${word || ""}${namePart || ""}`
      : `${word || ""}${noun || ""}${namePart || ""}`;

  // 所持パーツのレアリティから最大値を計算
  const { data: userItems } = await supabase
    .from("user_items")
    .select("*, item:item_id(*)")
    .eq("user_id", user.id);

  const ownedItems = (userItems || []).map((ui: any) => ui.item);

  const rarityValue = Math.max(
    refinedPartRarity(word, ownedItems),
    refinedPartRarity(noun, ownedItems),
    refinedPartRarity(namePart, ownedItems)
  );

  let { data: newItem } = await supabase
    .from("gacha_items")
    .select("*")
    .eq("name", `精錬:${fullTitle.slice(0, 47)}`)
    .maybeSingle();

  if (!newItem) {
    const { data: created } = await supabase
      .from("gacha_items")
      .insert({
        name: `精錬:${fullTitle.slice(0, 47)}`,
        rarity: RARITY_BY_VALUE[rarityValue],
        category: "title",
      })
      .select()
      .single();
    newItem = created;
  }

  if (newItem) {
    await supabase.from("user_items").insert({ user_id: user.id, item_id: newItem.id });
    await supabase.from("profiles").update({ current_title_id: newItem.id }).eq("id", user.id);
  }

  return NextResponse.json({ item: newItem });
}

function refinedPartRarity(part: string | null, items: any[]): number {
  if (!part) return 1;
  const RARITY_ORDER: Record<string, number> = {
    N: 1, R: 2, SR: 3, SSR: 4, UR: 5, LR: 6,
  };
  let value = 1;
  for (const item of items) {
    if (item?.name?.includes(part)) {
      value = Math.max(value, RARITY_ORDER[item.rarity] || 1);
    }
  }
  return value;
}
