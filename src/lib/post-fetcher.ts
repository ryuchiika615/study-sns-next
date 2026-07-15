import { formatRelativeTime, formatStudyTime, subjectColor } from "./utils";
import type { PostWithDetails } from "./types";

async function buildReactionsWithUsers(
  supabase: any,
  postId: string,
  reactionRows: { reaction: string; user_id: string }[]
): Promise<{ reaction: string; count: number; users: { id: string; icon_url: string | null; display_name: string }[] }[]> {
  const userIds = [...new Set(reactionRows.map(r => r.user_id))];
  const { data: profilesData } = userIds.length > 0
    ? await supabase.from("profiles").select("id, display_name, icon_url").in("id", userIds)
    : { data: [] };
  const profiles: { id: string; display_name: string | null; icon_url: string | null }[] = profilesData || [];
  const profileMap = new Map(profiles.map(p => [p.id, p]));

  const groups = new Map<string, { reaction: string; users: { id: string; icon_url: string | null; display_name: string }[] }>();
  for (const r of reactionRows) {
    if (!groups.has(r.reaction)) groups.set(r.reaction, { reaction: r.reaction, users: [] });
    const p = profileMap.get(r.user_id);
    if (p) groups.get(r.reaction)!.users.push({ id: p.id, icon_url: p.icon_url, display_name: p.display_name || "" });
  }
  return Array.from(groups.values()).map(g => ({ ...g, count: g.users.length }));
}

export async function fetchPostById(
  supabase: any,
  postId: string,
  currentUserId: string
): Promise<PostWithDetails | null> {
  const { data: post, error } = await supabase
    .from("posts")
    .select(`
      *,
      user:user_id(id, display_name, username, icon_url, current_title_id, current_avatar_id),
      likes_count:likes(count),
      comments_count:comments(count)
    `)
    .eq("id", postId)
    .maybeSingle();

  if (error || !post) return null;

  const allItemIds: string[] = [];
  if (post.user?.current_title_id) allItemIds.push(post.user.current_title_id);
  if (post.user?.current_avatar_id) allItemIds.push(post.user.current_avatar_id);

  const [likesResult, itemsResult, myReactionResult, reactionRowsResult] = await Promise.all([
    supabase.from("likes").select("post_id").eq("post_id", post.id).eq("user_id", currentUserId),
    allItemIds.length > 0
      ? supabase.from("gacha_items").select("*").in("id", allItemIds)
      : { data: [] },
    supabase.from("post_reactions").select("reaction").eq("post_id", post.id).eq("user_id", currentUserId).maybeSingle(),
    supabase.from("post_reactions").select("reaction, user_id").eq("post_id", post.id),
  ]);

  const likedPostIds = new Set((likesResult.data || []).map((l: any) => l.post_id));
  const itemMap = new Map((itemsResult.data || []).map((i: any) => [i.id, i]));
  const myReaction = myReactionResult.data;
  const reactionRows = reactionRowsResult.data || [];

  const reactionsCount = await buildReactionsWithUsers(supabase, post.id, reactionRows);

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
  const quoteCommentIds = (posts || []).map((p: any) => p.quote_comment_id).filter(Boolean);
  const titleIds = [...new Set((posts || []).map((p: any) => p.user?.current_title_id).filter(Boolean))];
  const avatarIds = [...new Set((posts || []).map((p: any) => p.user?.current_avatar_id).filter(Boolean))];
  const allItemIds = [...new Set([...titleIds, ...avatarIds])];

  const [likesResult, myReactionsResult, allReactionsResult, quotedPostsResult, quotedCommentsResult, itemsResult] = await Promise.all([
    postIds.length > 0
      ? supabase.from("likes").select("post_id").in("post_id", postIds).eq("user_id", currentUserId)
      : { data: [] },
    postIds.length > 0
      ? supabase.from("post_reactions").select("post_id, reaction").in("post_id", postIds).eq("user_id", currentUserId)
      : { data: [] },
    postIds.length > 0
      ? supabase.from("post_reactions").select("post_id, reaction, user_id").in("post_id", postIds)
      : { data: [] },
    quotePostIds.length > 0
      ? supabase.from("posts").select("id, content, user_id, user:user_id(id, display_name, username, icon_url)").in("id", quotePostIds)
      : { data: [] },
    quoteCommentIds.length > 0
      ? supabase.from("comments").select("id, text, user_id, user:user_id(id, display_name, username, icon_url)").in("id", quoteCommentIds)
      : { data: [] },
    allItemIds.length > 0
      ? supabase.from("gacha_items").select("*").in("id", allItemIds)
      : { data: [] },
  ]);

  const likedPostIds = new Set((likesResult.data || []).map((l: any) => l.post_id));
  const myReactionMap = new Map((myReactionsResult.data || []).map((r: any) => [r.post_id, r.reaction]));

  // Fetch profiles for all reaction users
  const allReactionUserIds = [...new Set((allReactionsResult.data || []).map((r: any) => r.user_id))];
  const { data: reactionProfilesData } = allReactionUserIds.length > 0
    ? await supabase.from("profiles").select("id, display_name, icon_url").in("id", allReactionUserIds)
    : { data: [] };
  const reactionProfiles: { id: string; display_name: string | null; icon_url: string | null }[] = reactionProfilesData || [];
  const reactionProfileMap = new Map(reactionProfiles.map(p => [p.id, p]));

  const reactionsByPost = new Map<string, Map<string, { reaction: string; users: { id: string; icon_url: string | null; display_name: string }[] }>>();
  for (const r of (allReactionsResult.data || [])) {
    if (!reactionsByPost.has(r.post_id)) reactionsByPost.set(r.post_id, new Map());
    const map = reactionsByPost.get(r.post_id)!;
    if (!map.has(r.reaction)) map.set(r.reaction, { reaction: r.reaction, users: [] });
    const p = reactionProfileMap.get(r.user_id);
    if (p) map.get(r.reaction)!.users.push({ id: p.id, icon_url: p.icon_url, display_name: p.display_name || "" });
  }

  const quotedPostMap = new Map((quotedPostsResult.data || []).map((qp: any) => [qp.id, qp]));
  const quotedCommentMap = new Map((quotedCommentsResult.data || []).map((qc: any) => [qc.id, qc]));
  const itemMap = new Map((itemsResult.data || []).map((i: any) => [i.id, i]));

  const enriched = (posts || []).map((post: any) => {
    const postReactionGroups = reactionsByPost.get(post.id) || new Map();
    const quotedPost = post.quote_post_id ? quotedPostMap.get(post.quote_post_id) : null;
    const quotedComment = post.quote_comment_id ? quotedCommentMap.get(post.quote_comment_id) : null;
    return {
      ...post,
      is_liked: likedPostIds.has(post.id),
      likes_count: post.likes_count?.[0]?.count ?? 0,
      comments_count: post.comments_count?.[0]?.count ?? 0,
      reactions_count: Array.from(postReactionGroups.values()).map(g => ({ ...g, count: g.users.length })),
      my_reaction: myReactionMap.get(post.id) || null,
      display_study_time: formatStudyTime(post.study_minutes),
      subject_color: subjectColor(post.subject),
      formatted_time: formatRelativeTime(post.created_at),
      current_title: post.user?.current_title_id ? itemMap.get(post.user.current_title_id) || null : null,
      current_avatar: post.user?.current_avatar_id ? itemMap.get(post.user.current_avatar_id) || null : null,
      quoted_post: quotedPost || null,
      quoted_comment: quotedComment || null,
    };
  });

  return {
    posts: enriched,
    totalPages: Math.ceil((count || 0) / limit),
    currentPage: page,
  };
}
