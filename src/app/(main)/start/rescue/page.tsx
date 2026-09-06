import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import RescueStart from "@/components/RescueStart";

export default async function RescueStartPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=%2Fstart%2Frescue");
  return <RescueStart key={user.id} userId={user.id} />;
}
