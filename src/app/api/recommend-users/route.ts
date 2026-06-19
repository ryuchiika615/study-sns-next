import { createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ users: [] });

  const supabase = createServerSupabase();
  const { data: all, error: allError } = await supabase
    .from("profiles")
    .select("id, display_name, username, icon_url")
    .order("updated_at", { ascending: false });

  if (allError) return NextResponse.json({ error: allError.message, users: [] });

  const { data: following, error: folError } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
  if (folError) return NextResponse.json({ error: folError.message, users: [] });

  const followingIds = new Set((following || []).map((f: any) => f.following_id));
  followingIds.add(userId);

  const users = (all || []).filter((p: any) => !followingIds.has(p.id)).slice(0, 5);

  return NextResponse.json({ users, totalProfiles: all?.length || 0 });
}
