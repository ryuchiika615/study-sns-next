import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status: newStatus } = await request.json();
  if (!newStatus || !["accepted", "rejected"].includes(newStatus)) {
    return NextResponse.json({ error: "status must be 'accepted' or 'rejected'" }, { status: 400 });
  }

  // Get suggestion + verify deck ownership
  const { data: suggestion } = await supabase
    .from("card_suggestions")
    .select("*, decks!inner(user_id)")
    .eq("id", params.id)
    .single();

  if (!suggestion) return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  if (suggestion.decks.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (newStatus === "accepted") {
    // Apply suggestion to the card
    const updateData: any = {};
    if (suggestion.suggested_front) updateData.front = suggestion.suggested_front;
    if (suggestion.suggested_back) updateData.back = suggestion.suggested_back;
    if (suggestion.suggested_options) updateData.options = suggestion.suggested_options;
    if (suggestion.suggested_correct_answer != null) updateData.correct_answer = suggestion.suggested_correct_answer;
    if (suggestion.suggested_correct_mapping) updateData.correct_mapping = suggestion.suggested_correct_mapping;

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("cards")
        .update(updateData)
        .eq("id", suggestion.card_id);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("card_suggestions")
    .update({ status: newStatus, reviewed_at: new Date().toISOString() })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ suggestion: data });
}
