import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import ShopClient from "./ShopClient";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  return <ShopClient userId={user.id} />;
}
