import { createServerSupabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 所持アイテム
  const { data: userItems, error } = await supabase
    .from("user_items")
    .select("*, item:item_id(*)")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (userItems || []).map((ui: any) => ui.item);
  const titles = items.filter((i: any) => i.category === "title");
  const icons = items.filter((i: any) => i.category === "icon");

  return NextResponse.json({ items, titles, icons });
}
