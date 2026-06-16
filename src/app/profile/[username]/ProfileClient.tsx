"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import AppShell from "@/components/AppShell";
import PostCard from "@/components/PostCard";
import FollowList from "@/components/FollowList";
import StudyCalendar from "@/components/StudyCalendar";
import { PieChart } from "@/components/Charts";
import { formatStudyTime } from "@/lib/utils";

type ProfileClientProps = {
  user: { id: string };
  profile: any;
  initialPosts: any[];
  isFollowing: boolean;
  subjectLabels: string;
  subjectData: string;
  subjectColors: string;
  followersCount: number;
  followingCount: number;
  postCount: number;
  totalStudyDisplay: string;
  monthStudyDisplay: string;
  totalStudyMinutes: number;
  unreadCount: number;
  calendarData?: { date: string; minutes: number }[];
};

export default function ProfileClient({
  user, profile, initialPosts, isFollowing: initialFollow,
  subjectLabels, subjectData, subjectColors,
  followersCount, followingCount, postCount,
  totalStudyDisplay, monthStudyDisplay, totalStudyMinutes,
  unreadCount, calendarData,
}: ProfileClientProps) {
  const supabase = createClient();
  const [isFollowing, setIsFollowing] = useState(initialFollow);
  const [notifySettings, setNotifySettings] = useState<{ notify_posts: boolean; notify_likes: boolean; notify_comments: boolean } | null>(null);
  const [showNotifyPopover, setShowNotifyPopover] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");
  const [posts, setPosts] = useState(initialPosts);
  const [followListType, setFollowListType] = useState<"followers" | "following" | null>(null);

  useEffect(() => {
    if (isFollowing && user.id !== profile.id) {
      supabase
        .from("follows")
        .select("notify_posts, notify_likes, notify_comments")
        .eq("follower_id", user.id)
        .eq("following_id", profile.id)
        .single()
        .then(({ data }) => {
          if (data) setNotifySettings(data);
        });
    }
  }, [isFollowing, user.id, profile.id]);

  const handleFollow = async () => {
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);

    if (wasFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", profile.id);
      if (error) setIsFollowing(true);
      else setNotifySettings(null);
    } else {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: user.id, following_id: profile.id });
      if (error) setIsFollowing(false);
      else {
        fetch("/api/push/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "follow", recipient_id: profile.id }),
        }).catch(() => {});
      }
    }
  };

  const toggleNotifySetting = async (key: string, value: boolean) => {
    const prev = { ...notifySettings };
    setNotifySettings((s) => s ? { ...s, [key]: value } : s);
    const res = await fetch("/api/follow-notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ following_id: profile.id, [key]: value }),
    });
    if (!res.ok) setNotifySettings(prev as any);
  };

  return (
    <AppShell unreadCount={unreadCount}>
      <div className="p-4">
        <div className="flex items-start gap-4 mb-6">
          <div className="avatar-frame">
            {profile?.icon_url ? (
              <img src={profile.icon_url} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <i className="fas fa-user-circle text-5xl text-gray-300" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{profile?.display_name || profile.username}</h2>
            <p className="text-gray-500 text-sm">@{profile?.username || profile.username}</p>
            {profile?.bio && <p className="text-sm mt-1">{profile.bio}</p>}
            {profile?.department && (
              <p className="text-sm text-gray-500"><i className="fas fa-building mr-1" />{profile.department}</p>
            )}

            <div className="flex gap-4 mt-2 text-sm">
              <span><strong>{postCount}</strong> リュイート</span>
              <button onClick={() => setFollowListType("followers")}
                className="hover:underline cursor-pointer">
                <strong>{followersCount}</strong> フォロワー
              </button>
              <button onClick={() => setFollowListType("following")}
                className="hover:underline cursor-pointer">
                <strong>{followingCount}</strong> フォロー中
              </button>
            </div>

            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-primary font-bold"><i className="fas fa-book-open" /> {totalStudyDisplay}</span>
              <span className="text-green-600 font-bold">今月 {monthStudyDisplay}</span>
            </div>
            {profile?.target_date && profile?.target_minutes > 0 && (
              <div className="mt-2 text-sm text-yellow-700 font-bold">
                <i className="fas fa-bullseye" /> 目標 {profile.target_date} まであと{(() => {
                  const remaining = profile.target_minutes - totalStudyMinutes;
                  if (remaining <= 0) return "目標達成！🎉";
                  const h = Math.floor(remaining / 60);
                  const m = remaining % 60;
                  return `${h > 0 ? `${h}時間` : ""}${m}分`;
                })()}
              </div>
            )}

            {user.id !== profile?.id && (
              <div className="flex items-center gap-2 mt-2">
                <button onClick={handleFollow}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold cursor-pointer ${
                    isFollowing ? "bg-gray-200 text-gray-700" : "bg-primary text-white"
                  }`}>
                  {isFollowing ? "フォロー中" : "フォローする"}
                </button>
                {isFollowing && (
                  <div className="relative">
                    <button onClick={() => setShowNotifyPopover(!showNotifyPopover)}
                      className={`text-lg cursor-pointer p-1.5 rounded-full transition ${
                        notifySettings?.notify_posts || notifySettings?.notify_likes || notifySettings?.notify_comments
                          ? "text-blue-500" : "text-gray-300"
                      }`}
                      title="通知設定">
                      <i className="fas fa-bell" />
                    </button>
                    {showNotifyPopover && (
                      <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-52 z-10">
                        <p className="text-xs font-bold text-gray-600 mb-2">{profile.display_name || profile.username} の通知</p>
                        <label className="flex items-center justify-between py-1.5 text-sm cursor-pointer">
                          <span>投稿</span>
                          <input type="checkbox" checked={notifySettings?.notify_posts ?? true}
                            onChange={(e) => toggleNotifySetting("notify_posts", e.target.checked)}
                            className="cursor-pointer" />
                        </label>
                        <label className="flex items-center justify-between py-1.5 text-sm cursor-pointer">
                          <span>いいね</span>
                          <input type="checkbox" checked={notifySettings?.notify_likes ?? true}
                            onChange={(e) => toggleNotifySetting("notify_likes", e.target.checked)}
                            className="cursor-pointer" />
                        </label>
                        <label className="flex items-center justify-between py-1.5 text-sm cursor-pointer">
                          <span>コメント</span>
                          <input type="checkbox" checked={notifySettings?.notify_comments ?? true}
                            onChange={(e) => toggleNotifySetting("notify_comments", e.target.checked)}
                            className="cursor-pointer" />
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {(() => {
          const labels = JSON.parse(subjectLabels || "[]");
          if (labels.length > 0) {
            return (
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <h3 className="font-bold mb-2">科目内訳</h3>
                <PieChart labels={subjectLabels} data={subjectData} colors={subjectColors} />
              </div>
            );
          }
          return null;
        })()}

        {calendarData && calendarData.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <h3 className="font-bold mb-2">{new Date().getFullYear()}年の勉強</h3>
            <StudyCalendar data={calendarData} />
          </div>
        )}

        <div className="flex border-b border-gray-200 mb-4">
          {["posts", "likes"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-bold text-center cursor-pointer ${
                activeTab === tab ? "text-primary border-b-2 border-primary" : "text-gray-500"
              }`}>
              {tab === "posts" ? "リュイート" : "いいね"}
            </button>
          ))}
        </div>

        {activeTab === "posts" && posts.map((post: any) => (
          <PostCard key={post.id} post={post} currentUserId={user.id}
            onDelete={(id) => {
              const idx = posts.findIndex((p: any) => p.id === id);
              if (idx >= 0) { const newPosts = [...posts]; newPosts.splice(idx, 1); setPosts(newPosts); }
            }}
            onUpdate={(id, data) => setPosts((prev: any[]) => prev.map((p: any) => p.id === id ? { ...p, ...data, display_study_time: formatStudyTime(data.study_minutes ?? p.study_minutes) } : p))} />
        ))}

        {followListType && (
          <FollowList userId={profile.id} type={followListType} onClose={() => setFollowListType(null)} />
        )}
      </div>
    </AppShell>
  );
}
