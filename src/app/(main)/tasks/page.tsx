import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import TasksClient from "./TasksClient";

export default async function TasksPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthStart = new Date(year, month, 1).toISOString().split("T")[0];
  const monthEnd = new Date(year, month + 1, 0).toISOString().split("T")[0];
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [habitsResult, logsResult, textbooksResult, textbookLogsResult, postsResult, todosResult] = await Promise.all([
    supabase.from("habits").select("*").eq("user_id", user.id).order("sort_order").order("created_at"),
    supabase.from("habit_logs").select("*").eq("user_id", user.id).gte("date", monthStart).lte("date", monthEnd),
    supabase.from("textbooks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("textbook_progress_logs").select("date, pages_completed").eq("user_id", user.id).gte("date", yearStart).lte("date", yearEnd),
    supabase.from("posts").select("created_at, study_minutes").eq("user_id", user.id).gte("created_at", yearStart).lte("created_at", yearEnd + "T23:59:59Z").gt("study_minutes", 0),
    supabase.from("todos").select("*").eq("user_id", user.id).order("due_date"),
  ]);

  const calendarData = (postsResult.data || []).map((p: any) => ({
    date: p.created_at.split("T")[0],
    minutes: p.study_minutes || 0,
  }));

  return (
    <TasksClient
      userId={user.id}
      initialHabits={habitsResult.data || []}
      initialLogs={logsResult.data || []}
      initialTextbooks={textbooksResult.data || []}
      textbookLogs={textbookLogsResult.data || []}
      calendarData={calendarData}
      initialTodos={todosResult.data || []}
    />
  );
}
