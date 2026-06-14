import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export default async function BannedPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("ban_reason")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm w-full text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">アカウントがBANされました</h1>
        {profile?.ban_reason && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
            理由: {profile.ban_reason}
          </div>
        )}
        <p className="text-gray-500 mb-6">
          このアカウントは利用停止されています。
        </p>
      </div>
    </div>
  );
}
