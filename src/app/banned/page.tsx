"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function BannedPage() {
  const [banReason, setBanReason] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      const res = await fetch("/api/profile");
      if (res.ok) {
        const d = await res.json();
        setBanReason(d.profile?.ban_reason || "");
      }
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm w-full text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">アカウントがBANされました</h1>
        {banReason && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
            理由: {banReason}
          </div>
        )}
        <p className="text-gray-500 mb-6">
          このアカウントは利用停止されています。
        </p>
      </div>
    </div>
  );
}
