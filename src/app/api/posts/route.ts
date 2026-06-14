import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { fetchAndEnrichPosts } from "@/lib/post-fetcher";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const search = searchParams.get("search") || "";
  const userId = searchParams.get("user_id") || "";

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await fetchAndEnrichPosts(supabase, user.id, { page, search, userId });
  return NextResponse.json(result);
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

  const todayJST = new Date();
  todayJST.setHours(todayJST.getHours() + 9);
  const todayStr = todayJST.toISOString().split("T")[0];

  // 今日の日付なら現在時刻、過去の日付なら12:00 JST
  const isBackdate = studyDate && studyDate !== todayStr;
  const createdDate = isBackdate
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

  const streakInfo = await updateStreakBonus(supabase, user.id, studyMinutes);

  return NextResponse.json({ post, streak: streakInfo });
}

async function updateStreakBonus(supabase: any, userId: string, minutes: number) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!profile) return null;

  const today = new Date().toISOString().split("T")[0];
  const lastDate = profile.last_post_date;
  let streak = profile.consecutive_post_days || 0;
  let points = profile.points || 0;
  let bonusPoints = 0;
  let isNewStreak = false;

  if (lastDate !== today) {
    if (lastDate === getYesterdayString()) {
      streak += 1;
    } else {
      streak = 1;
    }

    bonusPoints = streak <= 7 ? Math.pow(2, streak - 1) : 100;
    points += minutes + bonusPoints;
    isNewStreak = true;
  } else {
    points += minutes;
  }

  const exchangePoints = (profile.exchange_points || 0) + (isNewStreak ? bonusPoints : 0);

  await supabase
    .from("profiles")
    .update({
      points,
      exchange_points: exchangePoints,
      consecutive_post_days: streak,
      last_post_date: today,
    })
    .eq("id", userId);

  return isNewStreak ? { streak, bonus_points: bonusPoints } : null;
}

function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}
