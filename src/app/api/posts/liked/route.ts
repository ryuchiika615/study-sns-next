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

  // Step 1: Get all post IDs that this user has liked
  const { data: likedRows, error: likesError } = await admin
    .from("likes")
    .select("post_id")
    .eq("user_id", userId);

  if (likesError) return NextResponse.json({ error: likesError.message }, { status: 500 });

  const allLikedIds = (likedRows || []).map((l: any) => l.post_id);

  if (allLikedIds.length === 0) {
    return NextResponse.json({ posts: [], totalLiked: 0, totalPages: 0 });
  }

  // Step 2: Paginate the liked post IDs
  const offset = (page - 1) * limit;
  const pageIds = allLikedIds.slice(offset, offset + limit);

  if (pageIds.length === 0) {
    return NextResponse.json({ posts: [], totalLiked: allLikedIds.length, totalPages: Math.ceil(allLikedIds.length / limit) });
  }

  // Step 3: Fetch the actual posts
  const { data: posts } = await admin
    .from("posts")
    .select(`
      *,
      user:user_id(id, display_name, username, icon_url, current_title_id, current_avatar_id),
      likes_count:likes(count),
      comments_count:comments!post_id(count)
    `)
    .in("id", pageIds);

  if (!posts) return NextResponse.json({ posts: [], totalLiked: allLikedIds.length, totalPages: 0 });

  const postIds = posts.map((p: any) => p.id);

  const [{ data: myLikes }, { data: myReactions }, { data: allReactions }] = await Promise.all([
    admin.from("likes").select("post_id").in("post_id", postIds).eq("user_id", currentUserId),
    admin.from("post_reactions").select("post_id, reaction").in("post_id", postIds).eq("user_id", currentUserId),
    admin.from("post_reactions").select("post_id, reaction").in("post_id", postIds),
  ]);

  const postUserIds = [...new Set(posts.map((p: any) => p.user_id))];
  const { data: textbooksData } = postUserIds.length > 0
    ? await admin.from("textbooks").select("user_id, title, pages_completed, total_pages").in("user_id", postUserIds)
    : { data: [] };

  const textbookMapByUser = new Map<string, Map<string, any>>();
  for (const t of (textbooksData || []) as any[]) {
    if (!textbookMapByUser.has(t.user_id)) textbookMapByUser.set(t.user_id, new Map());
    textbookMapByUser.get(t.user_id)!.set(t.title, t);
  }

  const likedPostIds = new Set((myLikes || []).map((l: any) => l.post_id));
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

  // Reorder posts to match the original liked order
  const ordered = pageIds
    .map((id) => posts.find((p: any) => p.id === id))
    .filter(Boolean)
    .map((post: any) => {
      const postReactions = reactionsGrouped.get(post.id) || new Map();
      const textbook = post.total_pages > 0 ? null : textbookMapByUser.get(post.user_id)?.get(post.subject);
      return {
        ...post,
        is_liked: likedPostIds.has(post.id),
        likes_count: post.likes_count?.[0]?.count ?? 0,
        comments_count: post.comments_count?.[0]?.count ?? 0,
        reactions_count: Array.from(postReactions.entries()).map(([reaction, count]) => ({ reaction, count })),
        my_reaction: myReactionMap.get(post.id) || null,
        display_study_time: formatStudyTime(post.study_minutes),
        display_workout_time: formatStudyTime(post.workout_minutes),
        subject_color: subjectColor(post.subject),
        formatted_time: formatRelativeTime(post.created_at),
        current_title: post.user?.current_title_id ? itemMap.get(post.user.current_title_id) || null : null,
        current_avatar: post.user?.current_avatar_id ? itemMap.get(post.user.current_avatar_id) || null : null,
        pages_completed: post.pages_completed || textbook?.pages_completed || 0,
        total_pages: post.total_pages || textbook?.total_pages || 0,
      };
    });

  return NextResponse.json({
    posts: ordered,
    totalLiked: allLikedIds.length,
    totalPages: Math.ceil(allLikedIds.length / limit),
  });
}
