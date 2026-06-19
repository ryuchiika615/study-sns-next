import { createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ users: [] });

  const supabase = createServerSupabase();
  const { data: following } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
  const followingIds = (following || []).map((f: any) => f.following_id);
  followingIds.push(userId);

  const { data: profiles } = followingIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, display_name, username, icon_url")
        .filter("id", "not.in", `(${followingIds.join(",")})`)
        .order("updated_at", { ascending: false })
        .limit(5)
    : await supabase
        .from("profiles")
        .select("id, display_name, username, icon_url")
        .order("updated_at", { ascending: false })
        .limit(5);

  return NextResponse.json({ users: profiles || [] });
}
