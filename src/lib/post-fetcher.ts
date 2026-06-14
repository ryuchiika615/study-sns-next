import { formatRelativeTime, formatStudyTime, subjectColor } from "./utils";

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

  if (search) query = query.ilike("content", `%${search}%`);
  if (userId) query = query.eq("user_id", userId);

  const { data: posts, count } = await query;

  const postIds = (posts || []).map((p: any) => p.id);
  const { data: likes } = await supabase
    .from("likes")
    .select("post_id")
    .in("post_id", postIds)
    .eq("user_id", currentUserId);

  const likedPostIds = new Set((likes || []).map((l: any) => l.post_id));

  const titleIds = (posts || [])
    .map((p: any) => p.user?.current_title_id)
    .filter(Boolean);
  const avatarIds = (posts || [])
    .map((p: any) => p.user?.current_avatar_id)
    .filter(Boolean);
  const allItemIds = [...new Set([...titleIds, ...avatarIds])];

  const { data: items } = allItemIds.length > 0
    ? await supabase.from("gacha_items").select("*").in("id", allItemIds)
    : { data: [] };

  const itemMap = new Map((items || []).map((i: any) => [i.id, i]));

  const enriched = (posts || []).map((post: any) => ({
    ...post,
    is_liked: likedPostIds.has(post.id),
    likes_count: post.likes_count?.[0]?.count ?? 0,
    comments_count: post.comments_count?.[0]?.count ?? 0,
    display_study_time: formatStudyTime(post.study_minutes),
    subject_color: subjectColor(post.subject),
    formatted_time: formatRelativeTime(post.created_at),
    current_title: post.user?.current_title_id ? itemMap.get(post.user.current_title_id) || null : null,
    current_avatar: post.user?.current_avatar_id ? itemMap.get(post.user.current_avatar_id) || null : null,
  }));

  return {
    posts: enriched,
    totalPages: Math.ceil((count || 0) / limit),
    currentPage: page,
  };
}
