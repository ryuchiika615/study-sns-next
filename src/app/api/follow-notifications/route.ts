import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { following_id, notify_posts } = await request.json();
  if (!following_id) return NextResponse.json({ error: "following_id required" }, { status: 400 });

  const payload: Record<string, boolean> = {};
  if (typeof notify_posts === "boolean") payload.notify_posts = notify_posts;

  const admin = createAdminClient();
  const { error } = await admin
    .from("follows")
    .update(payload)
    .eq("follower_id", user.id)
    .eq("following_id", following_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
