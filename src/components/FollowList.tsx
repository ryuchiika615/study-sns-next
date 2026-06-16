"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

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
  const [settings, setSettings] = useState<Record<string, { notify_posts: boolean; notify_likes: boolean; notify_comments: boolean }>>({});
  const [openSettingsFor, setOpenSettingsFor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [debug, setDebug] = useState("");
  const supabase = createClient();

  useEffect(() => {
    const fetchUsers = async () => {
      setError("");
      setDebug("");
      try {
        if (type === "followers") {
          setDebug(prev => prev + `userId: ${userId}\n`);
          const { data: follows, error: err } = await supabase
            .from("follows")
            .select("follower_id")
            .eq("following_id", userId);
          if (err) { setError(err.message); setDebug(prev => prev + `follows query error: ${err.message}\n`); return; }
          setDebug(prev => prev + `follows found: ${follows?.length ?? 0}\n`);
          if (follows && follows.length > 0) {
            const ids = follows.map((r: any) => r.follower_id);
            setDebug(prev => prev + `ids: ${JSON.stringify(ids)}\n`);
            const { data: profiles, error: err2 } = await supabase
              .from("profiles")
              .select("id, display_name, username, icon_url")
              .in("id", ids);
            if (err2) { setError(err2.message); setDebug(prev => prev + `profiles query error: ${err2.message}\n`); return; }
            setDebug(prev => prev + `profiles found: ${profiles?.length ?? 0}\n`);
            setUsers(profiles || []);
          } else {
            setUsers([]);
          }
        } else {
          setDebug(prev => prev + `userId: ${userId}\n`);
          const { data: follows, error: err } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", userId);
          if (err) { setError(err.message); setDebug(prev => prev + `follows query error: ${err.message}\n`); return; }
          setDebug(prev => prev + `follows found: ${follows?.length ?? 0}\n`);
          if (follows && follows.length > 0) {
            const ids = follows.map((r: any) => r.following_id);
            setDebug(prev => prev + `ids: ${JSON.stringify(ids)}\n`);
            const { data: profiles, error: err2 } = await supabase
              .from("profiles")
              .select("id, display_name, username, icon_url")
              .in("id", ids);
            if (err2) { setError(err2.message); setDebug(prev => prev + `profiles query error: ${err2.message}\n`); return; }
            setDebug(prev => prev + `profiles found: ${profiles?.length ?? 0}\n`);
            setUsers(profiles || []);
          } else {
            setUsers([]);
          }
        }
      } catch (e: any) {
        setError(e?.message || "不明なエラー");
        setDebug(prev => prev + `catch: ${e?.message}\n`);
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
    if (!res.ok) {
      setSettings(prev);
    }
  };

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
        {error && <div className="mx-4 mt-2 bg-red-50 text-red-600 p-2 rounded text-xs whitespace-pre-wrap">{error}</div>}
        {debug && <div className="mx-4 mt-1 bg-gray-50 text-gray-500 p-2 rounded text-xs whitespace-pre-wrap font-mono max-h-24 overflow-auto">{debug}</div>}
        <div className="overflow-y-auto flex-1 p-2">
          {users.length === 0 && !error && (
            <p className="text-center text-gray-400 py-8 text-sm">
              {type === "followers" ? "フォロワーはいません" : "フォローしていません"}
            </p>
          )}
          {users.map((u: any) => (
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
              <Link href={`/profile/${u.username || u.id}`} className="flex items-center gap-3 flex-1 min-w-0 no-underline text-inherit">
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
              {type === "following" && (
                <div className="relative flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenSettingsFor(openSettingsFor === u.id ? null : u.id); }}
                    className={`text-lg cursor-pointer p-1 rounded-full transition ${settings[u.id]?.notify_posts || settings[u.id]?.notify_likes || settings[u.id]?.notify_comments ? "text-blue-500" : "text-gray-300"}`}
                    title="通知設定"
                  >
                    <i className="fas fa-bell" />
                  </button>
                  {openSettingsFor === u.id && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-52 z-10">
                      <p className="text-xs font-bold text-gray-600 mb-2">{u.display_name || u.username} の通知</p>
                      <label className="flex items-center justify-between py-1.5 text-sm cursor-pointer">
                        <span>投稿</span>
                        <input
                          type="checkbox"
                          checked={settings[u.id]?.notify_posts ?? true}
                          onChange={(e) => toggleSetting(u.id, "notify_posts", e.target.checked)}
                          className="cursor-pointer"
                        />
                      </label>
                      <label className="flex items-center justify-between py-1.5 text-sm cursor-pointer">
                        <span>いいね</span>
                        <input
                          type="checkbox"
                          checked={settings[u.id]?.notify_likes ?? true}
                          onChange={(e) => toggleSetting(u.id, "notify_likes", e.target.checked)}
                          className="cursor-pointer"
                        />
                      </label>
                      <label className="flex items-center justify-between py-1.5 text-sm cursor-pointer">
                        <span>コメント</span>
                        <input
                          type="checkbox"
                          checked={settings[u.id]?.notify_comments ?? true}
                          onChange={(e) => toggleSetting(u.id, "notify_comments", e.target.checked)}
                          className="cursor-pointer"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
