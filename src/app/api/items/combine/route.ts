import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemIdA, itemIdB, order } = await request.json();
  // order: "normal" or "reverse"

  const { data: items } = await supabase
    .from("gacha_items")
    .select("*")
    .in("id", [itemIdA, itemIdB]);

  const itemA = items?.find((i) => i.id === itemIdA);
  const itemB = items?.find((i) => i.id === itemIdB);

  if (!itemA || !itemB || itemA.id === itemB.id) {
    return NextResponse.json({ error: "Invalid items" }, { status: 400 });
  }

  const RARITY_ORDER: Record<string, number> = {
    N: 1, R: 2, SR: 3, SSR: 4, UR: 5, LR: 6,
  };
  const RARITY_BY_VALUE: Record<number, string> = {
    1: "N", 2: "R", 3: "SR", 4: "SSR", 5: "UR", 6: "LR",
  };

  const left = order === "reverse" ? itemB.name : itemA.name;
  const right = order === "reverse" ? itemA.name : itemB.name;
  const baseName = `${left}${right}`;
  const fullTitle = `精錬:${baseName.slice(0, 95)}`;

  const maxRarityVal = Math.max(
    RARITY_ORDER[itemA.rarity] || 1,
    RARITY_ORDER[itemB.rarity] || 1
  );

  let { data: newItem } = await supabase
    .from("gacha_items")
    .select("*")
    .eq("name", fullTitle)
    .maybeSingle();

  if (!newItem) {
    const { data: created } = await supabase
      .from("gacha_items")
      .insert({ name: fullTitle, rarity: RARITY_BY_VALUE[maxRarityVal], category: "title" })
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
