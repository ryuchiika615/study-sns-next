"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AppShell from "@/components/AppShell";
import PostCard from "@/components/PostCard";
import { PieChart } from "@/components/Charts";

export default function UserProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const username = params.username as string;
  const [data, setData] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "posts");
  const [page, setPage] = useState(1);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: authData }) => {
      if (!authData.user) { router.push("/auth/login"); return; }
      setUser(authData.user);
      loadData();
    });
  }, [username]);

  const loadData = async () => {
    const res = await fetch(`/api/users/${username}`);
    if (res.ok) {
      const d = await res.json();
      setData(d);
      setIsFollowing(d.is_following);

      // ユーザーの投稿（profile.id確定後に取得）
      const profileId = d.profile?.id;
      if (profileId) {
        const postsRes = await fetch(`/api/posts?user_id=${profileId}&page=${page}`);
        if (postsRes.ok) {
          const pd = await postsRes.json();
          setPosts(pd.posts || []);
        }
      }
    }
  };

  const handleFollow = async () => {
    const res = await fetch(`/api/follow/${username}`, { method: "POST" });
    if (res.ok) {
      const d = await res.json();
      setIsFollowing(d.following);
    }
  };

  if (!data) return <AppShell><div className="p-4 text-center text-gray-500">読み込み中...</div></AppShell>;

  return (
    <AppShell>
      <div className="p-4">
        {/* プロフィールヘッダー */}
        <div className="flex items-start gap-4 mb-6">
          <div className="avatar-frame">
            {data.profile?.icon_url ? (
              <img src={data.profile.icon_url} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <i className="fas fa-user-circle text-5xl text-gray-300" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{data.profile?.display_name || username}</h2>
            <p className="text-gray-500 text-sm">@{data.profile?.username || username}</p>
            {data.profile?.bio && <p className="text-sm mt-1">{data.profile.bio}</p>}
            {data.profile?.department && (
              <p className="text-sm text-gray-500"><i className="fas fa-building mr-1" />{data.profile.department}</p>
            )}

            <div className="flex gap-4 mt-2 text-sm">
              <span><strong>{data.post_count}</strong> リュイート</span>
              <span><strong>{data.followers_count}</strong> フォロワー</span>
              <span><strong>{data.following_count}</strong> フォロー中</span>
            </div>

            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-primary font-bold"><i className="fas fa-book-open" /> {data.total_study_display}</span>
              <span className="text-green-600 font-bold">今月 {data.month_study_display}</span>
            </div>
            {data.profile?.target_date && data.profile?.target_minutes > 0 && (
              <div className="mt-2 text-sm text-yellow-700 font-bold">
                <i className="fas fa-bullseye" /> 目標 {data.profile.target_date} まであと{(() => {
                  const remaining = data.profile.target_minutes - data.total_study_minutes;
                  if (remaining <= 0) return "目標達成！🎉";
                  const h = Math.floor(remaining / 60);
                  const m = remaining % 60;
                  return `${h > 0 ? `${h}時間` : ""}${m}分`;
                })()}
              </div>
            )}

            {user && user.id !== data.profile?.id && (
              <button onClick={handleFollow}
                className={`mt-2 px-4 py-1.5 rounded-full text-sm font-bold cursor-pointer ${
                  isFollowing ? "bg-gray-200 text-gray-700" : "bg-primary text-white"
                }`}>
                {isFollowing ? "フォロー中" : "フォローする"}
              </button>
            )}
          </div>
        </div>

        {/* 科目内訳 */}
        {data.subject_labels && JSON.parse(data.subject_labels).length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <h3 className="font-bold mb-2">科目内訳</h3>
            <PieChart
              labels={data.subject_labels}
              data={data.subject_data}
              colors={data.subject_colors || "[]"}
            />
          </div>
        )}

        {/* タブ */}
        <div className="flex border-b border-gray-200 mb-4">
          {["posts", "likes", "followers", "following"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-bold text-center cursor-pointer ${
                activeTab === tab ? "text-primary border-b-2 border-primary" : "text-gray-500"
              }`}>
              {tab === "posts" ? "リュイート" : tab === "likes" ? "いいね" : tab === "followers" ? "フォロワー" : "フォロー中"}
            </button>
          ))}
        </div>

        {/* 投稿一覧 */}
        {activeTab === "posts" && posts.map((post: any) => (
          <PostCard key={post.id} post={post} currentUserId={user?.id || ""} />
        ))}
      </div>
    </AppShell>
  );
}
