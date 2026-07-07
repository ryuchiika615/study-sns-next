import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const deckId = searchParams.get("deck_id");

  if (!deckId) return NextResponse.json({ error: "deck_id required" }, { status: 400 });

  // Verify ownership
  const { data: deck } = await supabase.from("decks").select("user_id").eq("id", deckId).single();
  if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  if (deck.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("card_suggestions")
    .select("*, cards(front, back, card_type, options, correct_answer), profiles!inner(display_name, username)")
    .eq("deck_id", deckId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ suggestions: data || [] });
}
