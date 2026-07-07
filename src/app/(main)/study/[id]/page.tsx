import { createServerSupabase } from "@/lib/supabase-server";
import { redirect, notFound } from "next/navigation";
import DeckDetailClient from "./DeckDetailClient";

export default async function DeckDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: deck } = await supabase
    .from("decks")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!deck) notFound();

  const { data: cards } = await supabase
    .from("cards")
    .select("*")
    .eq("deck_id", params.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  let suggestions: any[] = [];
  if (deck.is_public) {
    const { data: s } = await supabase
      .from("card_suggestions")
      .select("*, cards(front, back, card_type), profiles!inner(display_name, username)")
      .eq("deck_id", params.id)
      .order("created_at", { ascending: false });
    suggestions = s || [];
  }

  return <DeckDetailClient deck={deck} initialCards={cards || []} initialSuggestions={suggestions} />;
}
