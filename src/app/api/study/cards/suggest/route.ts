import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { card_id, deck_id, description, suggested_front, suggested_back, suggested_options, suggested_correct_answer } = await request.json();

  if (!card_id) return NextResponse.json({ error: "card_id required" }, { status: 400 });
  if (!deck_id) return NextResponse.json({ error: "deck_id required" }, { status: 400 });
  if (!description?.trim()) return NextResponse.json({ error: "description required" }, { status: 400 });

  // Verify card belongs to deck
  const { data: card } = await supabase.from("cards").select("id, deck_id").eq("id", card_id).single();
  if (!card || card.deck_id !== deck_id) {
    return NextResponse.json({ error: "Card not found in this deck" }, { status: 404 });
  }

  // Verify deck is public
  const { data: deck } = await supabase.from("decks").select("is_public").eq("id", deck_id).single();
  if (!deck?.is_public) {
    return NextResponse.json({ error: "Deck is not public" }, { status: 400 });
  }

  // Don't allow suggesting own deck
  const { data: deckOwner } = await supabase.from("decks").select("user_id").eq("id", deck_id).single();
  if (deckOwner?.user_id === user.id) {
    return NextResponse.json({ error: "Cannot suggest corrections for your own deck" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("card_suggestions")
    .insert({
      card_id,
      deck_id,
      user_id: user.id,
      description: description.trim(),
      suggested_front: suggested_front?.trim() || null,
      suggested_back: suggested_back?.trim() || null,
      suggested_options: suggested_options || null,
      suggested_correct_answer: suggested_correct_answer != null ? suggested_correct_answer : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ suggestion: data });
}
