import { officialToeicDeck, OFFICIAL_TOEIC_800_ID } from "@/lib/official-toeic-800";
import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { deckId } = await request.json();
  if (deckId !== OFFICIAL_TOEIC_800_ID) return NextResponse.json({ error: "Deck not found" }, { status: 404 });

  const { data: existing } = await supabase.from("decks").select("id").eq("user_id", user.id).eq("name", officialToeicDeck.name).maybeSingle();
  if (existing) return NextResponse.json({ deckId: existing.id, alreadyImported: true });

  const { data: deck, error: deckError } = await supabase.from("decks").insert({
    user_id: user.id, name: officialToeicDeck.name, description: officialToeicDeck.description,
  }).select("id").single();
  if (deckError || !deck) return NextResponse.json({ error: deckError?.message || "デッキの作成に失敗しました" }, { status: 500 });

  const { error: cardsError } = await supabase.from("cards").insert(officialToeicDeck.cards.map((card) => ({
    ...card, user_id: user.id, deck_id: deck.id, tags: ["TOEIC", "800+", "ビジネス英語", "Part 5｜短文穴埋め"],
  })));
  if (cardsError) return NextResponse.json({ error: cardsError.message }, { status: 500 });
  return NextResponse.json({ deckId: deck.id });
}
