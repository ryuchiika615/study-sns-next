import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import TasksClient from "./TasksClient";

export default async function TasksPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: textbooks } = await supabase
    .from("textbooks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const year = new Date().getFullYear();
  const startStr = `${year}-01-01`;
  const endStr = `${year}-12-31`;

  const { data: yearPosts } = await supabase
    .from("posts")
    .select("created_at, study_minutes")
    .eq("user_id", user.id)
    .gte("created_at", startStr)
    .lte("created_at", endStr + "T23:59:59Z")
    .gt("study_minutes", 0);

  const { data: logs } = await supabase
    .from("textbook_progress_logs")
    .select("date, pages_completed")
    .eq("user_id", user.id)
    .gte("date", startStr)
    .lte("date", endStr);

  const { data: profile } = await supabase
    .from("profiles")
    .select("consecutive_post_days")
    .eq("id", user.id)
    .single();

  const calendarData = (yearPosts || []).map((p: any) => ({
    date: p.created_at.split("T")[0],
    minutes: p.study_minutes || 0,
  }));

  return (
    <TasksClient
      userId={user.id}
      initialTextbooks={textbooks || []}
      calendarData={calendarData}
      textbookLogs={logs || []}
      consecutiveDays={profile?.consecutive_post_days || 0}
    />
  );
}
