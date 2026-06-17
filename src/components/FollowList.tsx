"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import BottomSheet from "./BottomSheet";
import { getOptimizedIconUrl } from "@/lib/utils";

export default function FollowList({
  userId,
  type,
  onClose,
  currentUserId,
}: {
  userId: string;
  type: "followers" | "following";
  onClose: () => void;
  currentUserId?: string;
}) {
  const [users, setUsers] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, { notify_posts: boolean; notify_likes: boolean; notify_comments: boolean }>>({});
  const [openSettingsFor, setOpenSettingsFor] = useState<string | null>(null);
  const supabase = createClient();
  const isOwner = currentUserId === userId;

  useEffect(() => {
    const fetchUsers = async () => {
      if (type === "followers") {
        const { data: follows } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", userId);
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
          .select("following_id, notify_posts, notify_likes, notify_comments")
          .eq("follower_id", userId);
        if (follows && follows.length > 0) {
          const ids = follows.map((r: any) => r.following_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, display_name, username, icon_url")
            .in("id", ids);
          setUsers(profiles || []);
          const s: Record<string, any> = {};
          follows.forEach((f: any) => { s[f.following_id] = { notify_posts: f.notify_posts, notify_likes: f.notify_likes, notify_comments: f.notify_comments }; });
          setSettings(s);
        } else {
          setUsers([]);
        }
      }
    };
    fetchUsers();
  }, [userId, type]);

  const toggleSetting = async (followingId: string, key: string, value: boolean) => {
    const prev = { ...settings };
    setSettings((s) => ({
      ...s,
      [followingId]: { ...s[followingId], [key]: value },
    }));
    const res = await fetch("/api/follow-notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ following_id: followingId, [key]: value }),
    });
    if (!res.ok) setSettings(prev);
  };

  return (
    <BottomSheet open={true} onClose={onClose} title={type === "followers" ? "フォロワー" : "フォロー中"}>
      <div className="p-2">
          {users.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">
              {type === "followers" ? "フォロワーはいません" : "フォローしていません"}
            </p>
          )}
          {users.map((u: any) => (
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
              <Link href={`/profile/${u.id}`} className="flex items-center gap-3 flex-1 min-w-0 no-underline text-inherit">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                  {u.icon_url ? (
                    <img src={getOptimizedIconUrl(u.icon_url, 40)} loading="lazy" className="w-full h-full object-cover" />
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
              {type === "following" && isOwner && (
                <div className="flex items-center gap-1">
                  <button onClick={async (e) => {
                    e.stopPropagation();
                    const { error } = await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", u.id);
                    if (error) {
                      console.error("unfollow error:", error);
                      return;
                    }
                    setUsers(prev => prev.filter(x => x.id !== u.id));
                  }} className="text-xs text-red-500 cursor-pointer px-2 py-1 rounded hover:bg-red-50">
                    解除
                  </button>
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenSettingsFor(openSettingsFor === u.id ? null : u.id); }}
                      className={`text-lg cursor-pointer p-1 rounded-full transition ${(settings[u.id]?.notify_posts || settings[u.id]?.notify_likes || settings[u.id]?.notify_comments) ? "text-blue-500" : "text-gray-300"}`}
                      title="通知設定"
                    >
                      <i className="fas fa-bell" />
                    </button>
                    {openSettingsFor === u.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-52 z-10">
                        <p className="text-xs font-bold text-gray-600 mb-2">{u.display_name || u.username} の通知</p>
                        <label className="flex items-center justify-between py-1.5 text-sm cursor-pointer">
                          <span>投稿</span>
                          <input type="checkbox" checked={settings[u.id]?.notify_posts ?? true}
                            onChange={(e) => toggleSetting(u.id, "notify_posts", e.target.checked)}
                            className="cursor-pointer" />
                        </label>
                        <label className="flex items-center justify-between py-1.5 text-sm cursor-pointer border-t border-gray-100">
                          <span>いいね</span>
                          <input type="checkbox" checked={settings[u.id]?.notify_likes ?? true}
                            onChange={(e) => toggleSetting(u.id, "notify_likes", e.target.checked)}
                            className="cursor-pointer" />
                        </label>
                        <label className="flex items-center justify-between py-1.5 text-sm cursor-pointer border-t border-gray-100">
                          <span>返信</span>
                          <input type="checkbox" checked={settings[u.id]?.notify_comments ?? true}
                            onChange={(e) => toggleSetting(u.id, "notify_comments", e.target.checked)}
                            className="cursor-pointer" />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {type === "followers" && isOwner && (
                <button onClick={async (e) => {
                  e.stopPropagation();
                  const { error } = await supabase.from("follows").delete().eq("follower_id", u.id).eq("following_id", currentUserId);
                  if (error) {
                    console.error("remove follower error:", error);
                    return;
                  }
                  setUsers(prev => prev.filter(x => x.id !== u.id));
                }} className="text-xs text-red-500 cursor-pointer px-2 py-1 rounded hover:bg-red-50 flex-shrink-0">
                  削除
                </button>
              )}
            </div>
          ))}
      </div>
    </BottomSheet>
  );
}
