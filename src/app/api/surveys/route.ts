import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: active } = await supabase
    .from("surveys")
    .select("*")
    .is("closed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!active) return NextResponse.json({ survey: null });

  const { data: myResponse } = await supabase
    .from("survey_responses")
    .select("*")
    .eq("survey_id", active.id)
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ survey: active, myResponse });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { survey_id, selected_option, custom_reply } = await request.json();
  if (!survey_id || !selected_option) {
    return NextResponse.json({ error: "survey_id and selected_option required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("survey_responses")
    .select("id")
    .eq("survey_id", survey_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "既に回答済みです" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("survey_responses")
    .insert({ survey_id, user_id: user.id, selected_option, custom_reply: custom_reply || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ response: data });
}
