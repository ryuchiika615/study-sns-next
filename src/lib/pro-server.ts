import { getProStatus, type ProGrant } from "@/lib/pro";
import { createServerSupabase } from "@/lib/supabase-server";

/** Returns the signed-in user only when they currently have Pro access. */
export async function getProUser() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, isPro: false };

  const { data } = await supabase
    .from("pro_grants")
    .select("id, source, starts_at, expires_at, revoked_at")
    .eq("user_id", user.id);

  return {
    user,
    isPro: getProStatus((data || []) as ProGrant[]).isPro,
  };
}
