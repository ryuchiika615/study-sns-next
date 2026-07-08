import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { post_id, mentioned_usernames } = await request.json();
  if (!post_id || !mentioned_usernames?.length) {
    return NextResponse.json({ error: "post_id and mentioned_usernames required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: users } = await admin
    .from("profiles")
    .select("id, username")
    .in("username", mentioned_usernames);

  if (!users) return NextResponse.json({ ok: true });

  for (const mentioned of users) {
    if (mentioned.id === user.id) continue;

    await admin.from("notifications").insert({
      recipient_id: mentioned.id,
      sender_id: user.id,
      post_id,
      notification_type: "mention",
    });
  }

  return NextResponse.json({ ok: true });
}
