import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { username } = await request.json();
  if (!username?.trim()) {
    return NextResponse.json({ error: "username required" }, { status: 400 });
  }

  const supabase = createServerSupabase();

  const { data: profiles, error: queryError } = await supabase
    .from("profiles")
    .select("username, email")
    .eq("username", username.trim());

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  const profile = profiles?.[0];

  if (!profile?.email) {
    return NextResponse.json({ error: "not found", debug: { username: username.trim(), count: profiles?.length } }, { status: 404 });
  }

  return NextResponse.json({ email: profile.email });
}
