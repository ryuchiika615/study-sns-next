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
  const RARITY_ORDER: Record<string, number> = {
    N: 1, R: 2, SR: 3, SSR: 4, UR: 5, LR: 6,
  };

  const [profileResult, userItemsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_items").select("*, item:item_id(*)").eq("user_id", user.id),
  ]);

  const profile = profileResult.data;
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const allItems = userItemsResult.data || [];
  const protectedNames = new Set([profile.current_title_id, profile.current_avatar_id]);

  let totalPoints = 0;
  let idsToDelete: number[] = [];

  if (maxRarity) {
    const maxVal = RARITY_ORDER[maxRarity] || 0;
    idsToDelete = allItems
      .filter((ui: any) => {
        const rarityVal = RARITY_ORDER[ui.item?.rarity] || 0;
        return rarityVal <= maxVal && !protectedNames.has(ui.item?.id)
          && !ui.item?.name?.startsWith("精錬:") && !ui.item?.name?.startsWith("邊ｾ骭ｬ:");
      })
      .map((ui: any) => ui.item_id);
  } else if (itemIds?.length) {
    idsToDelete = allItems
      .filter((ui: any) => itemIds.includes(ui.item_id))
      .filter((ui: any) => {
        return ui.item?.id !== profile.current_title_id && ui.item?.id !== profile.current_avatar_id
          && !ui.item?.name?.startsWith("精錬:") && !ui.item?.name?.startsWith("邊ｾ骭ｬ:");
      })
      .map((ui: any) => ui.item_id);
  }

  totalPoints = idsToDelete.reduce((sum: number, id: number) => {
    const ui = allItems.find((u: any) => u.item_id === id);
    return sum + (SELL_VALUES[ui?.item?.rarity] || 0);
  }, 0);

  if (idsToDelete.length > 0) {
    await supabase
      .from("user_items")
      .delete()
      .eq("user_id", user.id)
      .in("item_id", idsToDelete);

    await supabase
      .from("profiles")
      .update({ exchange_points: (profile.exchange_points || 0) + totalPoints })
      .eq("id", user.id);
  }

  return NextResponse.json({
    sold: totalPoints,
    remaining_points: (profile.exchange_points || 0) + totalPoints,
  });
}
