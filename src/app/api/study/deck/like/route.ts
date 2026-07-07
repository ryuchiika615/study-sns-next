import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deck_id } = await request.json();
  if (!deck_id) return NextResponse.json({ error: "deck_id required" }, { status: 400 });

  // Toggle like
  const { data: existing } = await supabase
    .from("deck_likes")
    .select("id")
    .eq("deck_id", deck_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("deck_likes").delete().eq("deck_id", deck_id).eq("user_id", user.id);
    return NextResponse.json({ liked: false });
  } else {
    await supabase.from("deck_likes").insert({ deck_id, user_id: user.id });
    return NextResponse.json({ liked: true });
  }
}
