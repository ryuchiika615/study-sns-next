import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";
import { formatRelativeTime, formatStudyTime, subjectColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const currentUserId = searchParams.get("currentUserId");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = 10;

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  if (!currentUserId) return NextResponse.json({ error: "currentUserId required" }, { status: 400 });

  const admin = createAdminClient();
  const offset = (page - 1) * limit;

  const { data: posts, count } = await admin
    .from("posts")
    .select(`
      *,
      user:user_id(id, display_name, username, icon_url, current_title_id, current_avatar_id),
      likes_count:likes(count),
      comments_count:comments(count)
    `, { count: "estimated" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (!posts) return NextResponse.json({ posts: [], totalPages: 0 });

  const postIds = posts.map((p: any) => p.id);

  const [{ data: likes }, { data: myReactions }, { data: allReactions }] = await Promise.all([
    admin.from("likes").select("post_id").in("post_id", postIds).eq("user_id", currentUserId),
    admin.from("post_reactions").select("post_id, reaction").in("post_id", postIds).eq("user_id", currentUserId),
    admin.from("post_reactions").select("post_id, reaction").in("post_id", postIds),
  ]);

  const likedPostIds = new Set((likes || []).map((l: any) => l.post_id));
  const myReactionMap = new Map((myReactions || []).map((r: any) => [r.post_id, r.reaction]));

  const reactionsGrouped = new Map<string, Map<string, number>>();
  for (const r of (allReactions || [])) {
    if (!reactionsGrouped.has(r.post_id)) reactionsGrouped.set(r.post_id, new Map());
    const map = reactionsGrouped.get(r.post_id)!;
    map.set(r.reaction, (map.get(r.reaction) || 0) + 1);
  }

  const titleIds = posts.map((p: any) => p.user?.current_title_id).filter(Boolean);
  const avatarIds = posts.map((p: any) => p.user?.current_avatar_id).filter(Boolean);
  const allItemIds = [...new Set([...titleIds, ...avatarIds])];

  const { data: items } = allItemIds.length > 0
    ? await admin.from("gacha_items").select("*").in("id", allItemIds)
    : { data: [] };
  const itemMap = new Map((items || []).map((i: any) => [i.id, i]));

  const enriched = posts.map((post: any) => {
    const postReactions = reactionsGrouped.get(post.id) || new Map();
    return {
      ...post,
      is_liked: likedPostIds.has(post.id),
      likes_count: post.likes_count?.[0]?.count ?? 0,
      comments_count: post.comments_count?.[0]?.count ?? 0,
      reactions_count: Array.from(postReactions.entries()).map(([reaction, count]) => ({ reaction, count })),
      my_reaction: myReactionMap.get(post.id) || null,
      display_study_time: formatStudyTime(post.study_minutes),
      subject_color: subjectColor(post.subject),
      formatted_time: formatRelativeTime(post.created_at),
      current_title: post.user?.current_title_id ? itemMap.get(post.user.current_title_id) || null : null,
      current_avatar: post.user?.current_avatar_id ? itemMap.get(post.user.current_avatar_id) || null : null,
    };
  });

  return NextResponse.json({
    posts: enriched,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
