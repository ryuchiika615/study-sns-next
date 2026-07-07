import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const deckId = searchParams.get("deck_id");

  let query = supabase
    .from("cards")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (deckId) query = query.eq("deck_id", deckId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cards: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deck_id, front, back, image_url, audio_url, tags, card_type, options, correct_answer, correct_mapping } = await request.json();
  if (!deck_id) return NextResponse.json({ error: "deck_id required" }, { status: 400 });
  if (!front?.trim()) return NextResponse.json({ error: "front required" }, { status: 400 });

  const type = card_type || "basic";
  if (type === "multiple_choice") {
    if (!options?.length || options.length < 2) return NextResponse.json({ error: "multiple choice requires at least 2 options" }, { status: 400 });
    if (typeof correct_answer !== "number" || correct_answer < 0 || correct_answer >= options.length)
      return NextResponse.json({ error: "correct_answer must be a valid index" }, { status: 400 });
    if (!back?.trim()) return NextResponse.json({ error: "back required" }, { status: 400 });
  } else if (type === "sequence") {
    if (!options?.length || options.length < 2) return NextResponse.json({ error: "sequence requires at least 2 options" }, { status: 400 });
    if (!correct_mapping || typeof correct_mapping !== "object") return NextResponse.json({ error: "correct_mapping required for sequence" }, { status: 400 });
    if (!back?.trim()) return NextResponse.json({ error: "back required" }, { status: 400 });
    // Validate mapping values are valid indices
    for (const v of Object.values(correct_mapping)) {
      if (typeof v !== "number" || v < 0 || v >= options.length)
        return NextResponse.json({ error: "correct_mapping values must be valid option indices" }, { status: 400 });
    }
  } else if (!back?.trim()) {
    return NextResponse.json({ error: "back required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("cards")
    .insert({
      deck_id,
      user_id: user.id,
      front: front.trim(),
      back: back.trim(),
      image_url: image_url || null,
      audio_url: audio_url || null,
      tags: tags || [],
      card_type: type,
      options: type !== "basic" ? options : null,
      correct_answer: type === "multiple_choice" ? correct_answer : null,
      correct_mapping: type === "sequence" ? correct_mapping : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ card: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase.from("cards").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
