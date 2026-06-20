"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function FollowRecommendations({ userId, onFollow }: { userId: string; onFollow?: () => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/recommend-users?userId=${userId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.users) setUsers(data.users);
      })
      .catch(() => {});
  }, [userId]);

  if (!userId) return null;
  if (dismissed) return null;
  if (users.length === 0) return null;

  const supabase = createClient();

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-bold flex items-center gap-1.5">
          <i className="fas fa-user-plus text-blue-400 text-xs" /> フォローおすすめ
        </h2>
        <button onClick={() => setDismissed(true)} className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
          閉じる
        </button>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-3 p-3">
          {users.map((u) => (
            <div key={u.id} className="flex flex-col items-center gap-1.5 w-24 flex-shrink-0">
              <Link href={`/profile/${u.username || u.id}`} className="flex flex-col items-center gap-1 no-underline">
                <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                  {u.icon_url ? (
                    <img src={u.icon_url} loading="lazy" className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400"><i className="fas fa-user text-sm" /></div>
                  )}
                </div>
                <p className="text-xs font-bold text-gray-800 truncate w-full text-center leading-tight">{u.display_name || u.username}</p>
              </Link>
              <button onClick={async () => {
                await supabase.from("follows").insert({ follower_id: userId, following_id: u.id });
                setUsers((prev) => prev.filter((x) => x.id !== u.id));
                onFollow?.();
              }}
                className="text-[10px] bg-blue-500 text-white rounded-full px-2.5 py-1 font-medium cursor-pointer hover:bg-blue-600 transition active:scale-95">
                フォロー
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
