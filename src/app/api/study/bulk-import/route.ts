import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deck_name, cards } = await request.json();
  if (!deck_name?.trim()) return NextResponse.json({ error: "deck_name required" }, { status: 400 });
  if (!cards?.length) return NextResponse.json({ error: "cards required" }, { status: 400 });

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .insert({ user_id: user.id, name: deck_name.trim() })
    .select()
    .single();

  if (deckError) return NextResponse.json({ error: deckError.message }, { status: 500 });

  const insertData = cards.map((card: any) => ({
    deck_id: deck.id,
    user_id: user.id,
    front: card.front.trim(),
    back: card.back?.trim() || "",
    tags: card.tags || [],
  }));

  const { data, error } = await supabase
    .from("cards")
    .insert(insertData)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deck_id: deck.id, cards_created: data.length });
}
