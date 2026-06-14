import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { username } = await request.json();
  if (!username?.trim()) {
    return NextResponse.json({ error: "username required" }, { status: 400 });
  }

  const supabase = createServerSupabase();

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("username", username.trim())
    .maybeSingle();

  if (!profile?.email) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ email: profile.email });
}
