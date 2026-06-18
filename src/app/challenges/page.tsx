import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import ChallengesClient from "./ChallengesClient";

export default async function ChallengesPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return <ChallengesClient userId={user.id} />;
}
