"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function FollowRecommendations({ userId, onFollow }: { userId: string; onFollow?: () => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    (async () => {
      const { data: following } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
      const followingIds = (following || []).map((f: any) => f.following_id);
      followingIds.push(userId);

      let query = supabase
        .from("profiles")
        .select("id, display_name, username, icon_url")
        .order("updated_at", { ascending: false })
        .limit(5);

      if (followingIds.length > 0) {
        query = query.not("id", "in", `(${followingIds.join(",")})`);
      }

      const { data: profiles } = await query;

      setUsers(profiles || []);
    })();
  }, [userId]);

  if (dismissed || users.length === 0) return null;

  const supabase = createClient();

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-bold flex items-center gap-1.5">
          <i className="fas fa-user-plus text-blue-400 text-xs" /> おすすめユーザー
        </h2>
        <button onClick={() => setDismissed(true)} className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
          閉じる
        </button>
      </div>
      <div className="divide-y divide-gray-50">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between px-4 py-2.5">
            <Link href={`/profile/${u.username || u.id}`} className="flex items-center gap-2.5 no-underline min-w-0">
              <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                {u.icon_url ? (
                  <img src={u.icon_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400"><i className="fas fa-user text-sm" /></div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{u.display_name || u.username}</p>
                <p className="text-[10px] text-gray-400 truncate">@{u.username}</p>
              </div>
            </Link>
            <button onClick={async () => {
              await supabase.from("follows").insert({ follower_id: userId, following_id: u.id });
              setUsers((prev) => prev.filter((x) => x.id !== u.id));
              onFollow?.();
            }}
              className="text-xs bg-blue-500 text-white rounded-full px-4 py-1.5 font-medium cursor-pointer hover:bg-blue-600 transition active:scale-95 flex-shrink-0">
              フォロー
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
