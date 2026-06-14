import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, { params }: { params: { username: string } }) {
  const supabase = createServerSupabase();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username } = params;

  // usersテーブルからusernameで検索 (Supabase Authはemailベースなのでprofilesにusernameカラムはない)
  // 代わりにauth.usersのemailをusernameとして使う
  const { data: { users } } = await supabase.auth.admin.listUsers();

  const targetAuthUser = users?.find((u: any) => u.email?.split("@")[0] === username);
  if (!targetAuthUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*, current_title:current_title_id(*), current_avatar:current_avatar_id(*)")
    .eq("id", targetAuthUser.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // フォロー状態
  const { data: follow } = await supabase
    .from("follows")
    .select("*")
    .eq("follower_id", currentUser.id)
    .eq("following_id", targetAuthUser.id)
    .maybeSingle();

  // フォロワー・フォロー数
  const { count: followersCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", targetAuthUser.id);

  const { count: followingCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", targetAuthUser.id);

  // 投稿数
  const { count: postCount } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", targetAuthUser.id);

  // 勉強統計
  const { data: stats } = await supabase
    .from("posts")
    .select("study_minutes, subject")
    .eq("user_id", targetAuthUser.id)
    .gt("study_minutes", 0);

  const totalMinutes = (stats || []).reduce((sum: number, p: any) => sum + (p.study_minutes || 0), 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthMinutes = (stats || [])
    .filter((p: any) => new Date(p.created_at) >= monthStart)
    .reduce((sum: number, p: any) => sum + (p.study_minutes || 0), 0);

  // 科目集計
  const subjectMap = new Map<string, number>();
  (stats || []).forEach((p: any) => {
    subjectMap.set(p.subject, (subjectMap.get(p.subject) || 0) + (p.study_minutes || 0));
  });

  return NextResponse.json({
    profile,
    is_following: !!follow,
    followers_count: followersCount || 0,
    following_count: followingCount || 0,
    post_count: postCount || 0,
    total_study_display: formatStudyTime(totalMinutes),
    month_study_display: formatStudyTime(monthMinutes),
    subject_labels: JSON.stringify([...subjectMap.keys()]),
    subject_data: JSON.stringify([...subjectMap.values()]),
    username: targetAuthUser.email?.split("@")[0] || username,
  });
}

function formatStudyTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}時間${m}分`;
  if (h > 0) return `${h}時間`;
  return `${m}分`;
}
