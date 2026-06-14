import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { formatRelativeTime, formatStudyTime, subjectColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const search = searchParams.get("search") || "";
  const limit = 10;
  const offset = (page - 1) * limit;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let query = supabase
    .from("posts")
    .select(`
      *,
      user:user_id(*),
      likes_count:likes(count),
      comments_count:comments(count)
    `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.ilike("content", `%${search}%`);
  }

  const { data: posts, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 縺・＞縺ｭ迥ｶ諷九ｒ蜿門ｾ・
  const postIds = posts.map((p: any) => p.id);
  const { data: likes } = await supabase
    .from("likes")
    .select("post_id")
    .in("post_id", postIds)
    .eq("user_id", user.id);

  const likedPostIds = new Set(likes?.map((l: any) => l.post_id) || []);

  // 遘ｰ蜿ｷ繝ｻ繧｢繝舌ち繝ｼ諠・ｱ
  const titleIds = posts
    .map((p: any) => p.user?.current_title_id)
    .filter(Boolean);
  const avatarIds = posts
    .map((p: any) => p.user?.current_avatar_id)
    .filter(Boolean);
  const allItemIds = [...new Set([...titleIds, ...avatarIds])];

  const { data: items } = allItemIds.length > 0
    ? await supabase.from("gacha_items").select("*").in("id", allItemIds)
    : { data: [] };

  const itemMap = new Map(items?.map((i: any) => [i.id, i]) || []);

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

  return NextResponse.json({
    posts: enriched,
    totalPages: Math.ceil((count || 0) / limit),
    currentPage: page,
  });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const content = formData.get("content") as string;
  const subject = (formData.get("subject") as string) || "その他";
  const studyMinutes = parseInt((formData.get("study_minutes") as string) || "0");
  const studyDate = (formData.get("study_date") as string) || new Date().toISOString().split("T")[0];
  const imageFile = formData.get("image") as File | null;

  let imageUrl: string | null = null;
  if (imageFile) {
    const fileExt = imageFile.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(fileName, imageFile);

    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from("post-images")
        .getPublicUrl(fileName);
      imageUrl = urlData?.publicUrl || null;
    }
  }

  const createdDate = studyDate
    ? new Date(studyDate + "T12:00:00+09:00").toISOString()
    : new Date().toISOString();

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      content,
      subject,
      study_minutes: studyMinutes,
      image_url: imageUrl,
      created_at: createdDate,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 騾｣邯壽兜遞ｿ繝懊・繝翫せ
  await updateStreakBonus(supabase, user.id, studyMinutes);

  return NextResponse.json({ post });
}

async function updateStreakBonus(supabase: any, userId: string, minutes: number) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!profile) return;

  const today = new Date().toISOString().split("T")[0];
  const lastDate = profile.last_post_date;
  let streak = profile.consecutive_post_days || 0;
  let points = profile.points || 0;
  let exchangePoints = profile.exchange_points || 0;

  if (lastDate !== today) {
    if (lastDate === getYesterdayString()) {
      streak += 1;
      if (streak > 7) streak = 1;
    } else {
      streak = 1;
    }

    const bonusPoints = Math.pow(2, streak - 1);
    points += minutes;
    exchangePoints += bonusPoints;
  } else {
    points += minutes;
  }

  await supabase
    .from("profiles")
    .update({
      points,
      exchange_points: exchangePoints,
      consecutive_post_days: streak,
      last_post_date: today,
    })
    .eq("id", userId);
}

function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}
