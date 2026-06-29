import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import AchievementsClient from "./AchievementsClient";

export default async function AchievementsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-lg font-bold mb-4"><i className="fas fa-trophy mr-2 text-yellow-500" />実績一覧</h1>
      <AchievementsClient userId={user.id} />
    </div>
  );
}
