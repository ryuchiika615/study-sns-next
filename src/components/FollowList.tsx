"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function FollowList({
  userId,
  type,
  onClose,
}: {
  userId: string;
  type: "followers" | "following";
  onClose: () => void;
}) {
  const [users, setUsers] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const fetchUsers = async () => {
      if (type === "followers") {
        const { data: follows } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", userId)
          .order("created_at", { ascending: false });
        if (follows && follows.length > 0) {
          const ids = follows.map((r: any) => r.follower_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, display_name, username, icon_url")
            .in("id", ids);
          setUsers(profiles || []);
        } else {
          setUsers([]);
        }
      } else {
        const { data: follows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", userId)
          .order("created_at", { ascending: false });
        if (follows && follows.length > 0) {
          const ids = follows.map((r: any) => r.following_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, display_name, username, icon_url")
            .in("id", ids);
          setUsers(profiles || []);
        } else {
          setUsers([]);
        }
      }
    };
    fetchUsers();
  }, [userId, type]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-bold text-lg">
            {type === "followers" ? "フォロワー" : "フォロー中"}
          </h3>
          <button onClick={onClose} className="text-gray-500 text-xl cursor-pointer">
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-2">
          {users.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">
              {type === "followers" ? "フォロワーはいません" : "フォローしていません"}
            </p>
          )}
          {users.map((u: any) => (
            <Link key={u.id} href={`/profile/${u.id}`}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 no-underline text-inherit">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                {u.icon_url ? (
                  <img src={u.icon_url} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <i className="fas fa-user" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{u.display_name || u.username}</p>
                <p className="text-xs text-gray-500">@{u.username}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
