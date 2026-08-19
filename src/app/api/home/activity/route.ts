import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

async function getUser() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const page = Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1);
  const limit = 10;
  const admin = createAdminClient();
  const { data: posts, error } = await admin.from("posts")
    .select("id, user_id, subject, study_minutes, workout_minutes, created_at")
    .not("group_id", "is", null)
    .or("study_minutes.gte.1,workout_minutes.gte.1")
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const postIds = (posts || []).map((post: any) => post.id);
  const userIds = [...new Set((posts || []).map((post: any) => post.user_id))];
  const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const [profilesResult, sessionsResult, cheersResult, grantsResult] = await Promise.all([
    userIds.length ? admin.from("profiles").select("id, display_name, username, icon_url, current_title_id, current_avatar_id, post_card_background_url").in("id", userIds) : { data: [] },
    userIds.length ? admin.from("studying_sessions").select("user_id").in("user_id", userIds).gt("heartbeat_at", threeMinutesAgo) : { data: [] },
    postIds.length ? admin.from("activity_cheers").select("activity_post_id, user_id").in("activity_post_id", postIds) : { data: [] },
    // active_pro_users is a safe public view containing only active IDs.
    // Do not filter it by columns from the private pro_grants table.
    userIds.length ? admin.from("active_pro_users").select("user_id").in("user_id", userIds) : { data: [] },
  ]);
  const profileMap = new Map((profilesResult.data || []).map((profile: any) => [profile.id, profile]));
  const proUserIds = new Set((grantsResult.data || []).map((grant: any) => grant.user_id));
  const itemIds = [...new Set((profilesResult.data || []).flatMap((profile: any) => [profile.current_title_id, profile.current_avatar_id]).filter(Boolean))];
  const { data: items } = itemIds.length ? await admin.from("gacha_items").select("id, name, rarity").in("id", itemIds) : { data: [] };
  const itemMap = new Map((items || []).map((item: any) => [item.id, item]));
  const studyingIds = new Set((sessionsResult.data || []).map((session: any) => session.user_id));
  const cheers = new Map<string, { count: number; mine: boolean }>();
  for (const cheer of (cheersResult.data || []) as any[]) {
    const current = cheers.get(cheer.activity_post_id) || { count: 0, mine: false };
    current.count += 1;
    current.mine ||= cheer.user_id === user.id;
    cheers.set(cheer.activity_post_id, current);
  }

  const { count } = await admin.from("posts").select("*", { count: "exact", head: true })
    .not("group_id", "is", null).or("study_minutes.gte.1,workout_minutes.gte.1");
  return NextResponse.json({ activities: (posts || []).map((post: any) => ({
    id: post.id,
    subject: post.subject || "学習",
    studyMinutes: post.study_minutes || 0,
    workoutMinutes: post.workout_minutes || 0,
    createdAt: post.created_at,
    user: (() => {
      const profile = profileMap.get(post.user_id);
      if (!profile) return null;
      const hasActivePro = proUserIds.has(post.user_id);
      return {
        ...profile,
        hasActivePro,
        currentTitle: profile.current_title_id ? itemMap.get(profile.current_title_id) || null : null,
        currentAvatar: profile.current_avatar_id ? itemMap.get(profile.current_avatar_id) || null : null,
        postCardBackgroundUrl: hasActivePro ? profile.post_card_background_url : null,
      };
    })(),
    isStudying: studyingIds.has(post.user_id),
    cheerCount: cheers.get(post.id)?.count || 0,
    cheeredByMe: cheers.get(post.id)?.mine || false,
    isMine: post.user_id === user.id,
  })), totalPages: Math.max(1, Math.ceil((count || 0) / limit)), currentPage: page });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const { postId } = await request.json();
  if (!postId) return NextResponse.json({ error: "活動記録が見つかりません" }, { status: 400 });

  const admin = createAdminClient();
  const { data: post } = await admin.from("posts")
    .select("id, user_id, group_id, study_minutes, workout_minutes")
    .eq("id", postId).maybeSingle();
  if (!post?.group_id || ((post.study_minutes || 0) < 1 && (post.workout_minutes || 0) < 1)) {
    return NextResponse.json({ error: "応援できない活動記録です" }, { status: 400 });
  }
  if (post.user_id === user.id) return NextResponse.json({ error: "自分の記録は応援できません" }, { status: 400 });

  const { data: existing } = await admin.from("activity_cheers")
    .select("id").eq("activity_post_id", post.id).eq("user_id", user.id).maybeSingle();
  if (!existing) {
    const { error } = await admin.from("activity_cheers").insert({ activity_post_id: post.id, user_id: user.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("notifications").insert({
      recipient_id: post.user_id, sender_id: user.id, post_id: post.id,
      notification_type: "activity_cheer", message: "あなたの活動記録に応援が届きました！",
    });
  }
  const { count } = await admin.from("activity_cheers").select("*", { count: "exact", head: true }).eq("activity_post_id", post.id);
  return NextResponse.json({ ok: true, count: count || 0 });
}
