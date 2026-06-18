import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function checkAdmin() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!p?.is_admin) return null;
  return { supabase, user };
}

export async function GET() {
  const ctx = await checkAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: surveys } = await ctx.supabase
    .from("surveys")
    .select("*")
    .order("created_at", { ascending: false });

  const surveysWithStats = await Promise.all((surveys || []).map(async (s) => {
    const { data: responses } = await ctx.supabase
      .from("survey_responses")
      .select("selected_option, custom_reply")
      .eq("survey_id", s.id);

    const counts: Record<string, number> = {};
    (responses || []).forEach((r) => {
      counts[r.selected_option] = (counts[r.selected_option] || 0) + 1;
    });

    return {
      ...s,
      total_responses: responses?.length || 0,
      counts,
      responses: responses || [],
    };
  }));

  return NextResponse.json({ surveys: surveysWithStats });
}

export async function POST(request: NextRequest) {
  const ctx = await checkAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { question, options, allow_custom } = await request.json();
  if (!question?.trim()) {
    return NextResponse.json({ error: "question required" }, { status: 400 });
  }

  const opts = Array.isArray(options) && options.length > 0 ? options : ["良い", "ダメ", "どちらでも"];

  const { data, error } = await ctx.supabase
    .from("surveys")
    .insert({ question: question.trim(), options: opts, allow_custom: allow_custom !== false, created_by: ctx.user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ survey: data });
}

export async function PUT(request: NextRequest) {
  const ctx = await checkAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { survey_id } = await request.json();
  if (!survey_id) return NextResponse.json({ error: "survey_id required" }, { status: 400 });

  const { error } = await ctx.supabase
    .from("surveys")
    .update({ closed_at: new Date().toISOString() })
    .eq("id", survey_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
