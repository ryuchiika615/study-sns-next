import { formatRelativeTime, formatStudyTime, subjectColor } from "./utils";
import type { PostWithDetails } from "./types";

export async function fetchPostById(
  supabase: any,
  postId: string,
  currentUserId: string
): Promise<PostWithDetails | null> {
  const { data: post } = await supabase
    .from("posts")
    .select(`
      *,
      user:user_id(id, display_name, username, icon_url, current_title_id, current_avatar_id),
      likes_count:likes(count),
      comments_count:comments(count)
    `)
    .eq("id", postId)
    .single();

  if (!post) return null;

  const allItemIds: string[] = [];
  if (post.user?.current_title_id) allItemIds.push(post.user.current_title_id);
  if (post.user?.current_avatar_id) allItemIds.push(post.user.current_avatar_id);

  const [likesResult, itemsResult, myReactionResult, reactionRowsResult] = await Promise.all([
    supabase.from("likes").select("post_id").eq("post_id", post.id).eq("user_id", currentUserId),
    allItemIds.length > 0
      ? supabase.from("gacha_items").select("*").in("id", allItemIds)
      : { data: [] },
    supabase.from("post_reactions").select("reaction").eq("post_id", post.id).eq("user_id", currentUserId).maybeSingle(),
    supabase.from("post_reactions").select("reaction").eq("post_id", post.id),
  ]);

  const likedPostIds = new Set((likesResult.data || []).map((l: any) => l.post_id));
  const itemMap = new Map((itemsResult.data || []).map((i: any) => [i.id, i]));
  const myReaction = myReactionResult.data;
  const reactionRows = reactionRowsResult.data || [];

  const reactionsCountMap = new Map<string, number>();
  for (const r of (reactionRows || [])) {
    reactionsCountMap.set(r.reaction, (reactionsCountMap.get(r.reaction) || 0) + 1);
  }
  const reactionsCount = Array.from(reactionsCountMap.entries()).map(([reaction, count]) => ({ reaction, count }));

  return {
    ...post,
    is_liked: likedPostIds.has(post.id),
    likes_count: post.likes_count?.[0]?.count ?? 0,
    comments_count: post.comments_count?.[0]?.count ?? 0,
    reactions_count: reactionsCount,
    my_reaction: myReaction?.reaction || null,
    display_study_time: formatStudyTime(post.study_minutes),
    subject_color: subjectColor(post.subject),
    formatted_time: formatRelativeTime(post.created_at),
    current_title: post.user?.current_title_id ? itemMap.get(post.user.current_title_id) || null : null,
    current_avatar: post.user?.current_avatar_id ? itemMap.get(post.user.current_avatar_id) || null : null,
  };
}

export async function fetchAndEnrichPosts(
  supabase: any,
  currentUserId: string,
  options?: { page?: number; search?: string; userId?: string }
) {
  const { page = 1, search = "", userId = "" } = options ?? {};
  const limit = 10;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("posts")
    .select(`
      *,
      user:user_id(id, display_name, username, icon_url, current_title_id, current_avatar_id),
      likes_count:likes(count),
      comments_count:comments(count)
    `, { count: "estimated" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`content.ilike.%${search}%,subject.ilike.%${search}%`);
  }
  if (userId) query = query.eq("user_id", userId);

  const { data: posts, count } = await query;

  const postIds = (posts || []).map((p: any) => p.id);

  const quotePostIds = (posts || []).map((p: any) => p.quote_post_id).filter(Boolean);
  const titleIds = [...new Set((posts || []).map((p: any) => p.user?.current_title_id).filter(Boolean))];
  const avatarIds = [...new Set((posts || []).map((p: any) => p.user?.current_avatar_id).filter(Boolean))];
  const allItemIds = [...new Set([...titleIds, ...avatarIds])];

  const [likesResult, myReactionsResult, allReactionsResult, quotedPostsResult, itemsResult] = await Promise.all([
    postIds.length > 0
      ? supabase.from("likes").select("post_id").in("post_id", postIds).eq("user_id", currentUserId)
      : { data: [] },
    postIds.length > 0
      ? supabase.from("post_reactions").select("post_id, reaction").in("post_id", postIds).eq("user_id", currentUserId)
      : { data: [] },
    postIds.length > 0
      ? supabase.from("post_reactions").select("post_id, reaction").in("post_id", postIds)
      : { data: [] },
    quotePostIds.length > 0
      ? supabase.from("posts").select("id, content, user_id, user:user_id(id, display_name, username, icon_url)").in("id", quotePostIds)
      : { data: [] },
    allItemIds.length > 0
      ? supabase.from("gacha_items").select("*").in("id", allItemIds)
      : { data: [] },
  ]);

  const likedPostIds = new Set((likesResult.data || []).map((l: any) => l.post_id));
  const myReactionMap = new Map((myReactionsResult.data || []).map((r: any) => [r.post_id, r.reaction]));
  const reactionsGrouped = new Map<string, Map<string, number>>();
  for (const r of (allReactionsResult.data || [])) {
    if (!reactionsGrouped.has(r.post_id)) reactionsGrouped.set(r.post_id, new Map());
    const map = reactionsGrouped.get(r.post_id)!;
    map.set(r.reaction, (map.get(r.reaction) || 0) + 1);
  }
  const quotedPostMap = new Map((quotedPostsResult.data || []).map((qp: any) => [qp.id, qp]));
  const itemMap = new Map((itemsResult.data || []).map((i: any) => [i.id, i]));

  const enriched = (posts || []).map((post: any) => {
    const postReactions = reactionsGrouped.get(post.id) || new Map();
    const quotedPost = post.quote_post_id ? quotedPostMap.get(post.quote_post_id) : null;
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
      quoted_post: quotedPost || null,
    };
  });

  return {
    posts: enriched,
    totalPages: Math.ceil((count || 0) / limit),
    currentPage: page,
  };
}
