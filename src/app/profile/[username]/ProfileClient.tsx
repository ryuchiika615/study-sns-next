"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import AppShell from "@/components/AppShell";
import PostCard from "@/components/PostCard";
import Link from "next/link";
import Image from "next/image";
import StudyCalendar from "@/components/StudyCalendar";
import { PieChart } from "@/components/Charts";
import { formatStudyTime, getOptimizedIconUrl } from "@/lib/utils";

const PER_PAGE = 10;

type ProfileClientProps = {
  user: { id: string };
  profile: any;
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
  user, profile, isFollowing: initialFollow,
  subjectLabels, subjectData, subjectColors,
  followersCount, followingCount, postCount,
  totalStudyDisplay, monthStudyDisplay, totalStudyMinutes,
  unreadCount, calendarData,
}: ProfileClientProps) {
  const supabase = createClient();
  const [isFollowing, setIsFollowing] = useState(initialFollow);
  const [notifySettings, setNotifySettings] = useState<{ notify_posts: boolean; notify_likes: boolean; notify_comments: boolean } | null>(null);
  const [showNotifyPopover, setShowNotifyPopover] = useState(false);
  const [section, setSection] = useState<"posts" | "likes" | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [postPage, setPostPage] = useState(1);
  const [postLoading, setPostLoading] = useState(false);
  const [postError, setPostError] = useState("");
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [likedPosts, setLikedPosts] = useState<any[]>([]);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [likedPage, setLikedPage] = useState(1);
  const [likedLoading, setLikedLoading] = useState(false);
  const [likedError, setLikedError] = useState("");

  useEffect(() => {
    if (profile?.icon_url) {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = getOptimizedIconUrl(profile.icon_url, 320);
      document.head.appendChild(link);
      return () => { document.head.removeChild(link); };
    }
  }, [profile?.icon_url]);

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

  const loadPosts = async () => {
    setPostLoading(true);
    setPostError("");
    try {
      const res = await fetch(`/api/posts/user?userId=${profile.id}&currentUserId=${user.id}&page=1`);
      if (!res.ok) { setPostError("読み込み失敗"); setPostLoading(false); return; }
      const data = await res.json();
      setPosts(data.posts || []);
      setPostPage(1);
      setHasMorePosts((data.posts || []).length >= 10);
    } catch (e: any) {
      setPostError(e.message || "ネットワークエラー");
    }
    setPostLoading(false);
  };

  const loadMorePosts = async () => {
    const next = postPage + 1;
    const res = await fetch(`/api/posts/user?userId=${profile.id}&currentUserId=${user.id}&page=${next}`);
    if (!res.ok) return;
    const data = await res.json();
    setPosts((prev) => [...prev, ...(data.posts || [])]);
    setPostPage(next);
    setHasMorePosts((data.posts || []).length >= 10);
  };

  const loadLikedIds = async () => {
    setLikedLoading(true);
    setLikedError("");
    const { data, error } = await supabase
      .from("likes")
      .select("post_id")
      .eq("user_id", profile.id);
    if (error) {
      setLikedError(error.message);
      setLikedLoading(false);
      return;
    }
    const ids = (data || []).map((l: any) => l.post_id);
    setLikedIds(ids);
    setLikedPage(1);
    setLikedPosts([]);
    if (ids.length > 0) {
      await loadLikedPosts(ids, 1);
    }
    setLikedLoading(false);
  };

  const loadLikedPosts = async (ids: string[], page: number) => {
    const start = 0;
    const end = page * PER_PAGE;
    const pageIds = ids.slice(start, end);
    const { data, error } = await supabase
      .from("posts")
      .select("*, user:user_id(id, display_name, username, icon_url)")
      .in("id", pageIds)
      .order("created_at", { ascending: false });
    if (error) {
      setLikedError(error.message);
      return;
    }
    const ordered = pageIds.map((id) => data?.find((p) => p.id === id)).filter(Boolean);
    setLikedPosts(ordered);
  };

  const loadMoreLiked = async () => {
    const next = likedPage + 1;
    setLikedPage(next);
    await loadLikedPosts(likedIds, next);
  };

  const hasMoreLiked = likedPosts.length < likedIds.length;

  return (
    <AppShell unreadCount={unreadCount}>
      <div className="mx-auto my-4 max-w-xl space-y-3 px-4">

        {/* ===== プロフィールカード ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-900 to-blue-700 h-20" />
          <div className="px-4 pb-4">
            <div className="flex items-end -mt-10 mb-3">
              <div className="avatar-frame w-20 h-20 border-4 border-white rounded-full shadow-md bg-white">
                {profile?.icon_url ? (
                  <Image src={getOptimizedIconUrl(profile.icon_url, 320)} width={80} height={80} className="rounded-full object-cover" alt="" />
                ) : (
                  <i className="fas fa-user-circle text-5xl text-gray-300" />
                )}
              </div>
            </div>
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold truncate">{profile?.display_name || profile.username}</h2>
                <p className="text-gray-500 text-sm">@{profile?.username || profile.username}</p>
                {profile?.bio && <p className="text-sm mt-1 text-gray-700">{profile.bio}</p>}

                <div className="flex items-center gap-4 mt-3 text-sm">
                  <span><strong className="text-gray-900">{postCount}</strong><span className="text-gray-500 ml-1">リュイート</span></span>
                  <Link href={`/profile/${encodeURIComponent(profile.username || profile.id)}/follow?tab=followers`}
                    className="hover:underline cursor-pointer text-gray-500">
                    <strong className="text-gray-900">{followersCount}</strong><span className="ml-1">フォロワー</span>
                  </Link>
                  <Link href={`/profile/${encodeURIComponent(profile.username || profile.id)}/follow?tab=following`}
                    className="hover:underline cursor-pointer text-gray-500">
                    <strong className="text-gray-900">{followingCount}</strong><span className="ml-1">フォロー中</span>
                  </Link>
                </div>
              </div>

              {user.id !== profile?.id && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={handleFollow}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold cursor-pointer transition ${
                      isFollowing ? "bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200" : "bg-primary text-white hover:bg-blue-600"
                    }`}>
                    {isFollowing ? "フォロー中" : "フォローする"}
                  </button>
                  {isFollowing && (
                    <div className="relative">
                      <button onClick={() => setShowNotifyPopover(!showNotifyPopover)}
                        className={`text-lg cursor-pointer p-1.5 rounded-full transition ${
                          notifySettings?.notify_posts ? "text-blue-500 bg-blue-50" : "text-gray-400 hover:text-gray-600"
                        }`}
                        title="通知設定">
                        <i className="fas fa-bell" />
                      </button>
                      {showNotifyPopover && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-52 z-10">
                          <p className="text-xs font-bold text-gray-600 mb-2">{profile.display_name || profile.username} の通知</p>
                          <label className="flex items-center justify-between py-1.5 text-sm cursor-pointer">
                            <span>投稿</span>
                            <input type="checkbox" checked={notifySettings?.notify_posts ?? true}
                              onChange={(e) => toggleNotifySetting("notify_posts", e.target.checked)}
                              className="cursor-pointer" />
                          </label>
                          <label className="flex items-center justify-between py-1.5 text-sm cursor-pointer border-t border-gray-100">
                            <span>いいね</span>
                            <input type="checkbox" checked={notifySettings?.notify_likes ?? true}
                              onChange={(e) => toggleNotifySetting("notify_likes", e.target.checked)}
                              className="cursor-pointer" />
                          </label>
                          <label className="flex items-center justify-between py-1.5 text-sm cursor-pointer border-t border-gray-100">
                            <span>返信</span>
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
        </div>

        {/* ===== 勉強時間カード ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 text-center py-2 rounded-lg bg-blue-50">
              <p className="text-xs text-blue-500 font-bold">総勉強時間</p>
              <p className="text-lg font-bold text-blue-700">{totalStudyDisplay}</p>
            </div>
            <div className="flex-1 text-center py-2 rounded-lg bg-green-50">
              <p className="text-xs text-green-500 font-bold">今月</p>
              <p className="text-lg font-bold text-green-700">{monthStudyDisplay}</p>
            </div>
          </div>
          {profile?.target_date && profile?.target_minutes > 0 && (
            <div className="mt-3 text-sm text-center py-2 rounded-lg bg-yellow-50 text-yellow-800 font-bold">
              <i className="fas fa-bullseye mr-1" />
              目標 {profile.target_date} まであと{(() => {
                const remaining = profile.target_minutes - totalStudyMinutes;
                if (remaining <= 0) return "目標達成！🎉";
                const h = Math.floor(remaining / 60);
                const m = remaining % 60;
                return `${h > 0 ? `${h}時間` : ""}${m}分`;
              })()}
            </div>
          )}
        </div>

        {/* ===== 科目内訳 ===== */}
        {(() => {
          const labels = JSON.parse(subjectLabels || "[]");
          if (labels.length > 0) {
            return (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <h3 className="font-bold text-sm text-gray-500 mb-3"><i className="fas fa-chart-pie mr-1.5" />科目内訳</h3>
                <PieChart labels={subjectLabels} data={subjectData} colors={subjectColors} />
              </div>
            );
          }
          return null;
        })()}

        {/* ===== 年間カレンダー ===== */}
        {calendarData && calendarData.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="font-bold text-sm text-gray-500 mb-3"><i className="fas fa-calendar-alt mr-1.5" />{new Date().getFullYear()}年の勉強</h3>
            <StudyCalendar data={calendarData} />
          </div>
        )}

        {/* ===== 投稿/いいね セクション ===== */}
        {!section && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 space-y-2">
            <button onClick={() => { setSection("posts"); loadPosts(); }}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition cursor-pointer border border-gray-100">
              <i className="far fa-file-alt text-lg text-blue-500 w-6 text-center" />
              <div className="text-left">
                <p className="text-sm font-bold">リュイートを見る</p>
                <p className="text-xs text-gray-400">{postCount}件の投稿</p>
              </div>
            </button>
            <button onClick={() => { setSection("likes"); loadLikedIds(); }}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 transition cursor-pointer border border-gray-100">
              <i className="far fa-heart text-lg text-red-500 w-6 text-center" />
              <div className="text-left">
                <p className="text-sm font-bold">いいねを見る</p>
                <p className="text-xs text-gray-400">いいねしたリュイート</p>
              </div>
            </button>
          </div>
        )}

        {section === "posts" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-gray-100">
              <button onClick={() => { setSection(null); setPosts([]); }}
                className="flex items-center gap-1 text-sm text-gray-500 cursor-pointer">
                <i className="fas fa-arrow-left text-xs" /> 戻る
              </button>
              <span className="text-sm font-bold">リュイート</span>
              <div className="w-10" />
            </div>
            <div className="p-3">
              {postError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{postError}</div>}
              {postLoading && (
                <div className="text-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                  <p className="text-gray-400 text-sm mt-2">読み込み中...</p>
                </div>
              )}
              {!postLoading && posts.length === 0 && !postError && (
                <div className="text-center py-8 text-gray-400 text-sm">リュイートがありません</div>
              )}
              {posts.map((post: any) => (
                <PostCard key={post.id} post={post} currentUserId={user.id}
                  onDelete={(id) => {
                    const idx = posts.findIndex((p: any) => p.id === id);
                    if (idx >= 0) { const newPosts = [...posts]; newPosts.splice(idx, 1); setPosts(newPosts); }
                  }}
                  onUpdate={(id, data) => setPosts((prev: any[]) => prev.map((p: any) => p.id === id ? { ...p, ...data, display_study_time: formatStudyTime(data.study_minutes ?? p.study_minutes) } : p))} />
              ))}
              {posts.length > 0 && hasMorePosts && (
                <button onClick={loadMorePosts}
                  className="w-full py-3 text-sm text-primary font-bold cursor-pointer hover:bg-blue-50 rounded-lg transition">
                  もっと見る
                </button>
              )}
            </div>
          </div>
        )}

        {section === "likes" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-gray-100">
              <button onClick={() => { setSection(null); setLikedPosts([]); setLikedIds([]); }}
                className="flex items-center gap-1 text-sm text-gray-500 cursor-pointer">
                <i className="fas fa-arrow-left text-xs" /> 戻る
              </button>
              <span className="text-sm font-bold">いいね</span>
              <div className="w-10" />
            </div>
            <div className="p-3">
              {likedError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{likedError}</div>}
              {likedLoading && (
                <div className="text-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                  <p className="text-gray-400 text-sm mt-2">読み込み中...</p>
                </div>
              )}
              {!likedLoading && likedPosts.length === 0 && !likedError && (
                <div className="text-center py-8 text-gray-400 text-sm">いいねしたリュイートはありません</div>
              )}
              {likedPosts.map((post: any) => (
                <PostCard key={post.id} post={post} currentUserId={user.id}
                  onDelete={() => {}}
                  onUpdate={() => {}} />
              ))}
              {hasMoreLiked && (
                <button onClick={loadMoreLiked}
                  className="w-full py-3 text-sm text-primary font-bold cursor-pointer hover:bg-blue-50 rounded-lg transition"
                  disabled={likedLoading}>
                  もっと見る
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
