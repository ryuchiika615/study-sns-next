"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AppShell from "@/components/AppShell";

export default function FollowPageClient({
  currentUserId, profile, tab, isOwner, unreadCount,
}: {
  currentUserId: string;
  profile: any;
  tab: "followers" | "following";
  isOwner: boolean;
  unreadCount: number;
}) {
  const [users, setUsers] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, { notify_posts: boolean; notify_likes: boolean; notify_comments: boolean }>>({});
  const [openSettingsFor, setOpenSettingsFor] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") === "following" ? "following" : "followers";

  useEffect(() => {
    const fetchUsers = async () => {
      if (activeTab === "followers") {
        const { data: follows } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", profile.id);
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
          .eq("follower_id", profile.id);
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
  }, [activeTab, profile.id]);

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

  const switchTab = (t: "followers" | "following") => {
    router.replace(`/profile/${encodeURIComponent(profile.username || profile.id)}/follow?tab=${t}`);
  };

  return (
    <AppShell unreadCount={unreadCount}>
      <div className="mx-auto my-4 max-w-xl px-4">
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex border-b border-gray-100">
            <button onClick={() => switchTab("followers")}
              className={`flex-1 py-3 text-sm font-bold text-center cursor-pointer transition ${activeTab === "followers" ? "text-primary border-b-2 border-primary" : "text-gray-500"}`}>
              フォロワー
            </button>
            <button onClick={() => switchTab("following")}
              className={`flex-1 py-3 text-sm font-bold text-center cursor-pointer transition ${activeTab === "following" ? "text-primary border-b-2 border-primary" : "text-gray-500"}`}>
              フォロー中
            </button>
          </div>

          <div>
            {users.length === 0 && (
              <p className="text-center text-gray-400 py-8 text-sm">
                {activeTab === "followers" ? "フォロワーはいません" : "フォローしていません"}
              </p>
            )}
            {users.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 p-3 border-b border-gray-50 last:border-0">
                <Link href={`/profile/${u.id}`} className="flex items-center gap-3 flex-1 min-w-0 no-underline text-inherit">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                    {u.icon_url ? (
                      <img src={u.icon_url} loading="lazy" className="w-full h-full object-cover" />
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
                {activeTab === "following" && isOwner && (
                  <div className="flex items-center gap-1">
                    <button onClick={async () => {
                      const { error } = await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", u.id);
                      if (!error) setUsers(prev => prev.filter(x => x.id !== u.id));
                    }} className="text-xs text-red-500 cursor-pointer px-2 py-1 rounded hover:bg-red-50">
                      解除
                    </button>
                    <div className="relative">
                      <button onClick={() => setOpenSettingsFor(openSettingsFor === u.id ? null : u.id)}
                        className={`text-lg cursor-pointer p-1 rounded-full transition ${(settings[u.id]?.notify_posts || settings[u.id]?.notify_likes || settings[u.id]?.notify_comments) ? "text-blue-500" : "text-gray-300"}`}>
                        <i className="fas fa-bell" />
                      </button>
                      {openSettingsFor === u.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-52 z-10">
                          <p className="text-xs font-bold text-gray-600 mb-2">{u.display_name || u.username} の通知</p>
                          <label className="flex items-center justify-between py-1.5 text-sm cursor-pointer">
                            <span>投稿</span>
                            <input type="checkbox" checked={settings[u.id]?.notify_posts ?? true}
                              onChange={(e) => toggleSetting(u.id, "notify_posts", e.target.checked)} />
                          </label>
                          <label className="flex items-center justify-between py-1.5 text-sm cursor-pointer border-t border-gray-100">
                            <span>いいね</span>
                            <input type="checkbox" checked={settings[u.id]?.notify_likes ?? true}
                              onChange={(e) => toggleSetting(u.id, "notify_likes", e.target.checked)} />
                          </label>
                          <label className="flex items-center justify-between py-1.5 text-sm cursor-pointer border-t border-gray-100">
                            <span>返信</span>
                            <input type="checkbox" checked={settings[u.id]?.notify_comments ?? true}
                              onChange={(e) => toggleSetting(u.id, "notify_comments", e.target.checked)} />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {activeTab === "followers" && isOwner && (
                  <button onClick={async () => {
                    const { error } = await supabase.from("follows").delete().eq("follower_id", u.id).eq("following_id", currentUserId);
                    if (!error) setUsers(prev => prev.filter(x => x.id !== u.id));
                  }} className="text-xs text-red-500 cursor-pointer px-2 py-1 rounded hover:bg-red-50">
                    削除
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
