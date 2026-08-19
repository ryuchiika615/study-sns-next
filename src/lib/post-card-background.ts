/** Adds the current Pro state to post authors with one query for the whole feed. */
export async function attachActiveProToPosts<T extends { user_id: string; user?: any }>(supabase: any, posts: T[]) {
  const userIds = [...new Set(posts.map((post) => post.user_id).filter(Boolean))];
  if (!userIds.length) return posts;

  const now = new Date().toISOString();
  const { data: grants } = await supabase
    .from("pro_grants")
    .select("user_id")
    .in("user_id", userIds)
    .is("revoked_at", null)
    .lte("starts_at", now)
    .or(`expires_at.is.null,expires_at.gt.${now}`);
  const activeProUserIds = new Set((grants || []).map((grant: any) => grant.user_id));

  return posts.map((post) => post.user
    ? { ...post, user: { ...post.user, has_active_pro: activeProUserIds.has(post.user_id) } }
    : post
  );
}
