import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, { params }: { params: { username: string } }) {
  const supabase = createServerSupabase();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username } = params;
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const targetUser = users?.find((u: any) => u.email?.split("@")[0] === username);

  if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (targetUser.id === currentUser.id) return NextResponse.json({ error: "Cannot follow self" }, { status: 400 });

  const { data: existing } = await supabase
    .from("follows")
    .select("*")
    .eq("follower_id", currentUser.id)
    .eq("following_id", targetUser.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", currentUser.id)
      .eq("following_id", targetUser.id);

    return NextResponse.json({ following: false });
  } else {
    await supabase
      .from("follows")
      .insert({ follower_id: currentUser.id, following_id: targetUser.id });

    // 通知
    await supabase.from("notifications").insert({
      recipient_id: targetUser.id,
      sender_id: currentUser.id,
      notification_type: "follow",
    });

    return NextResponse.json({ following: true });
  }
}
