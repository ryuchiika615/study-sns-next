/** Adds the current Pro state to post authors with one query for the whole feed. */
export async function attachActiveProToPosts<T extends { user_id: string; user?: any }>(supabase: any, posts: T[]) {
  const userIds = [...new Set(posts.map((post) => post.user_id).filter(Boolean))];
  if (!userIds.length) return posts;

  // pro_grants itself is private. This view is already restricted to active
  // Pro users and intentionally exposes only their IDs.
  const { data: grants } = await supabase
    .from("active_pro_users")
    .select("user_id")
    .in("user_id", userIds);
  const activeProUserIds = new Set((grants || []).map((grant: any) => grant.user_id));

  return posts.map((post) => post.user
    // pro_badge is stamped on a post when its author is Pro. Keep it as a
    // fallback for existing posts while the public active-Pro view propagates.
    ? { ...post, user: { ...post.user, has_active_pro: activeProUserIds.has(post.user_id) || Boolean((post as any).pro_badge) } }
    : post
  );
}
