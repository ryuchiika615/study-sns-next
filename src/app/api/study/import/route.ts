import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deck_id, text, format } = await request.json();
  if (!deck_id) return NextResponse.json({ error: "deck_id required" }, { status: 400 });
  if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });

  let cards: { front: string; back: string }[] = [];

  if (format === "csv") {
    const lines = text.trim().split("\n");
    for (const line of lines) {
      const parts = line.split(",").map((s: string) => s.trim().replace(/^"(.*)"$/, "$1"));
      if (parts.length >= 2 && parts[0] && parts[1]) {
        cards.push({ front: parts[0], back: parts[1] });
      }
    }
  } else if (format === "tsv") {
    const lines = text.trim().split("\n");
    for (const line of lines) {
      const parts = line.split("\t").map((s: string) => s.trim());
      if (parts.length >= 2 && parts[0] && parts[1]) {
        cards.push({ front: parts[0], back: parts[1] });
      }
    }
  } else {
    // Auto-detect: try CSV first, then TSV, then tab-separated
    const lines = text.trim().split("\n");
    for (const line of lines) {
      if (line.includes("\t")) {
        const parts = line.split("\t").map((s: string) => s.trim());
        if (parts.length >= 2 && parts[0] && parts[1]) {
          cards.push({ front: parts[0], back: parts[1] });
        }
      } else if (line.includes(",")) {
        const parts = line.split(",").map((s: string) => s.trim().replace(/^"(.*)"$/, "$1"));
        if (parts.length >= 2 && parts[0] && parts[1]) {
          cards.push({ front: parts[0], back: parts[1] });
        }
      }
    }
  }

  if (cards.length === 0) return NextResponse.json({ error: "No valid cards found in the text" }, { status: 400 });

  const { data, error } = await supabase
    .from("cards")
    .insert(cards.map((c) => ({
      deck_id,
      user_id: user.id,
      front: c.front,
      back: c.back,
    })))
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cards: data, imported_count: cards.length });
}
