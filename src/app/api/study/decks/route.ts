import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: decks } = await supabase
    .from("decks")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order")
    .order("created_at");

  const { data: cardCounts } = await supabase
    .from("cards")
    .select("deck_id, id")
    .eq("user_id", user.id);

  const countMap = new Map<string, number>();
  if (cardCounts) {
    cardCounts.forEach((c: any) => {
      countMap.set(c.deck_id, (countMap.get(c.deck_id) || 0) + 1);
    });
  }

  const { data: dueCounts } = await supabase
    .from("reviews")
    .select("card_id, due_date")
    .eq("user_id", user.id)
    .lte("due_date", new Date().toISOString().split("T")[0]);

  const dueMap = new Map<string, number>();
  if (dueCounts) {
    const { data: allCards } = await supabase
      .from("cards")
      .select("id, deck_id")
      .eq("user_id", user.id);
    if (allCards) {
      const cardDeckMap = new Map(allCards.map((c: any) => [c.id, c.deck_id]));
      dueCounts.forEach((r: any) => {
        const deckId = cardDeckMap.get(r.card_id);
        if (deckId) dueMap.set(deckId, (dueMap.get(deckId) || 0) + 1);
      });
    }
  }

  const result = (decks || []).map((d: any) => ({
    ...d,
    card_count: countMap.get(d.id) || 0,
    due_count: dueMap.get(d.id) || 0,
  }));

  return NextResponse.json({ decks: result });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, parent_id } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const { data: maxSort } = await supabase
    .from("decks")
    .select("sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("decks")
    .insert({
      user_id: user.id,
      name: name.trim(),
      description: description || null,
      parent_id: parent_id || null,
      sort_order: (maxSort?.sort_order ?? -1) + 1,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deck: data });
}

export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name, description, is_public, parent_id } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description || null;
  if (is_public !== undefined) updates.is_public = is_public;
  if (parent_id !== undefined) updates.parent_id = parent_id || null;

  const { data, error } = await supabase.from("decks").update(updates).eq("id", id).eq("user_id", user.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deck: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase.from("decks").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
