import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import NotificationsClient from "./NotificationsClient";

export default async function NotificationsPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: notifications } = await supabase
    .from("notifications")
    .select(`
      *,
      sender:sender_id(id, display_name, username, icon_url, is_admin)
    `)
    .eq("recipient_id", user.id)
    .neq("notification_type", "follow_post")
    .order("created_at", { ascending: false })
    .limit(10);

  return <NotificationsClient notifications={notifications || []} />;
}
