import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deck_id, cards } = await request.json();
  if (!deck_id) return NextResponse.json({ error: "deck_id required" }, { status: 400 });
  if (!cards?.length) return NextResponse.json({ error: "cards required" }, { status: 400 });

  // Verify deck ownership
  const { data: deck } = await supabase
    .from("decks")
    .select("id")
    .eq("id", deck_id)
    .eq("user_id", user.id)
    .single();

  if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });

  // Insert cards in batch
  const insertData = cards.map((card: any) => ({
    deck_id,
    user_id: user.id,
    front: card.front.trim(),
    back: card.back?.trim() || "",
    image_url: card.image_url || null,
    audio_url: card.audio_url || null,
    tags: card.tags || [],
    card_type: card.card_type || "basic",
    options: card.options || null,
    correct_answer: card.correct_answer ?? null,
    correct_mapping: card.correct_mapping || null,
  }));

  const { data, error } = await supabase
    .from("cards")
    .insert(insertData)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cards: data, count: data.length });
}
