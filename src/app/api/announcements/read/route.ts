import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { announcementId } = await request.json();
  if (!announcementId) return NextResponse.json({ error: "announcementId required" }, { status: 400 });

  const { error } = await supabase
    .from("announcement_reads")
    .insert({ user_id: user.id, announcement_id: announcementId });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
