import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, { params }: { params: { username: string } }) {
  const supabase = createServerSupabase();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username } = params;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (profile.id === currentUser.id) return NextResponse.json({ error: "Cannot follow self" }, { status: 400 });

  const { data: existing } = await supabase
    .from("follows")
    .select("*")
    .eq("follower_id", currentUser.id)
    .eq("following_id", profile.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", currentUser.id)
      .eq("following_id", profile.id);

    return NextResponse.json({ following: false });
  } else {
    await Promise.all([
      supabase.from("notifications").insert({
        recipient_id: profile.id,
        sender_id: currentUser.id,
        notification_type: "follow",
      }),
      supabase.from("follows").insert({ follower_id: currentUser.id, following_id: profile.id }),
    ]);

    return NextResponse.json({ following: true });
  }
}
