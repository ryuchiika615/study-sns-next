import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemIds, maxRarity } = await request.json();

  const SELL_VALUES: Record<string, number> = {
    N: 1, R: 4, SR: 15, SSR: 60, UR: 180, LR: 650,
  };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  let totalPoints = 0;
  let itemsToDelete: any[] = [];

  if (maxRarity) {
    // 荳諡ｬ螢ｲ蜊ｴ
    const RARITY_ORDER: Record<string, number> = {
      N: 1, R: 2, SR: 3, SSR: 4, UR: 5, LR: 6,
    };
    const maxVal = RARITY_ORDER[maxRarity] || 0;

    const { data: allItems } = await supabase
      .from("user_items")
      .select("*, item:item_id(*)")
      .eq("user_id", user.id);

    const protectedNames = new Set([profile.current_title_id, profile.current_avatar_id]);

    itemsToDelete = (allItems || []).filter((ui: any) => {
      const rarityVal = RARITY_ORDER[ui.item?.rarity] || 0;
      return rarityVal <= maxVal && !protectedNames.has(ui.item?.id) && !ui.item?.name.startsWith("邊ｾ骭ｬ:");
    });

    totalPoints = itemsToDelete.reduce((sum: number, ui: any) => {
      return sum + (SELL_VALUES[ui.item?.rarity] || 0);
    }, 0);
  } else if (itemIds?.length) {
    const { data: selectedItems } = await supabase
      .from("user_items")
      .select("*, item:item_id(*)")
      .eq("user_id", user.id)
      .in("item_id", itemIds);

    itemsToDelete = (selectedItems || []).filter((ui: any) => {
      return ui.item?.name !== profile.current_title && ui.item?.name !== profile.current_avatar;
    });

    totalPoints = itemsToDelete.reduce((sum: number, ui: any) => {
      return sum + (SELL_VALUES[ui.item?.rarity] || 0);
    }, 0);
  }

  for (const ui of itemsToDelete) {
    await supabase
      .from("user_items")
      .delete()
      .eq("user_id", user.id)
      .eq("item_id", ui.item_id);
  }

  if (totalPoints > 0) {
    await supabase
      .from("profiles")
      .update({ exchange_points: (profile.exchange_points || 0) + totalPoints })
      .eq("id", user.id);
  }

  return NextResponse.json({ sold: totalPoints, remaining_points: (profile.exchange_points || 0) + totalPoints });
}
