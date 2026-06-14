import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { subjectColor, formatStudyTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const startStr = searchParams.get("start") || getDateNDaysAgo(29);
  const endStr = searchParams.get("end") || getTodayString();

  const { data: posts, error } = await supabase
    .from("posts")
    .select("*")
    .eq("user_id", user.id)
    .gt("study_minutes", 0)
    .gte("created_at", startStr)
    .lte("created_at", endStr + "T23:59:59Z")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 遘醍岼蛻･
  const subjectMap = new Map<string, { total: number; count: number }>();
  const dayMap = new Map<string, number>();

  (posts || []).forEach((post: any) => {
    const sub = subjectMap.get(post.subject) || { total: 0, count: 0 };
    sub.total += post.study_minutes || 0;
    sub.count += 1;
    subjectMap.set(post.subject, sub);

    const day = post.created_at.split("T")[0];
    dayMap.set(day, (dayMap.get(day) || 0) + (post.study_minutes || 0));
  });

  const subjectRows = [...subjectMap.entries()]
    .map(([subject, data]) => ({
      subject,
      total: data.total,
      count: data.count,
      display_time: formatStudyTime(data.total),
      color: subjectColor(subject),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  // 譌･蛻･
  const dayLabels: string[] = [];
  const dayData: number[] = [];
  const start = new Date(startStr);
  const end = new Date(endStr);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split("T")[0];
    dayLabels.push(`${d.getMonth() + 1}/${d.getDate()}`);
    dayData.push(dayMap.get(key) || 0);
  }

  const totalMinutes = (posts || []).reduce((sum, p) => sum + (p.study_minutes || 0), 0);

  // 騾ｱ髢薙げ繝ｩ繝・
  const weeklyLabels: string[] = [];
  const weeklySubjects = new Map<string, number[]>();
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    weeklyLabels.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }

  (posts || []).forEach((post: any) => {
    const postDate = post.created_at.split("T")[0];
    const weeklyIndex = weeklyLabels.findIndex((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split("T")[0] === postDate;
    });
    if (weeklyIndex >= 0) {
      if (!weeklySubjects.has(post.subject)) {
        weeklySubjects.set(post.subject, new Array(7).fill(0));
      }
      weeklySubjects.get(post.subject)![weeklyIndex] += post.study_minutes || 0;
    }
  });

  const datasets = [...weeklySubjects.entries()].map(([subject, data]) => ({
    label: subject,
    data,
    backgroundColor: subjectColor(subject),
  }));

  if (datasets.length === 0) {
    datasets.push({
      label: "蜍牙ｼｷ譎る俣",
      data: new Array(7).fill(0),
      backgroundColor: "#1877f2",
    });
  }

  return NextResponse.json({
    start: startStr,
    end: endStr,
    pie_labels: JSON.stringify(subjectRows.map((s) => s.subject)),
    pie_data: JSON.stringify(subjectRows.map((s) => s.total)),
    pie_colors: JSON.stringify(subjectRows.map((s) => s.color)),
    bar_labels: JSON.stringify(dayLabels),
    bar_data: JSON.stringify(dayData),
    subject_list: subjectRows,
    total_all_time_display: formatStudyTime(totalMinutes),
    weekly_labels: JSON.stringify(weeklyLabels),
    weekly_datasets: JSON.stringify(datasets),
  });
}

function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

function getDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
