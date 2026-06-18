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

  let results = null;
  if (myResponse) {
    const { data: allResponses } = await supabase
      .from("survey_responses")
      .select("selected_option, user_id, custom_reply" + (!active.anonymous ? ", users:user_id(display_name, username)" : ""))
      .eq("survey_id", active.id);

    const counts: Record<string, number> = {};
    const voters: Record<string, any[]> = {};
    const customs: { option: string; reply: string; user?: any }[] = [];

    (allResponses || []).forEach((r: any) => {
      counts[r.selected_option] = (counts[r.selected_option] || 0) + 1;
      if (!active.anonymous) {
        if (!voters[r.selected_option]) voters[r.selected_option] = [];
        voters[r.selected_option].push({ user_id: r.user_id, display_name: r.users?.display_name || r.users?.username || "ユーザー" });
      }
      if (r.custom_reply) {
        customs.push({ option: r.selected_option, reply: r.custom_reply, user: !active.anonymous ? { display_name: r.users?.display_name || r.users?.username || "ユーザー" } : undefined });
      }
    });

    results = {
      counts,
      total: allResponses?.length || 0,
      ...(!active.anonymous ? { voters } : {}),
      ...(active.allow_custom !== false ? { customs } : {}),
    };
  }

  return NextResponse.json({ survey: active, myResponse, results });
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
