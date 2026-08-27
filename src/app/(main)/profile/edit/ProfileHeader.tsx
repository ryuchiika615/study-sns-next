"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { getOptimizedIconUrl } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { itemDisplayName } from "@/lib/shop-catalog";

const PostCard = dynamic(() => import("@/components/PostCard"));

export default function ProfileHeader({
  profile, items, followersCount, followingCount, userId,
  activityTotals, focusScore,
  editSection, setEditSection,
  myPosts, myPostsLoading, myPostsError, postPage, setPostPage,
  likedPosts, likedLoading, likedError, likedPage, setLikedPage,
  loadMyPosts, loadLikedPosts, onDeletePost, onUpdatePost,
}: {
  profile: any; items: any[]; followersCount: number; followingCount: number; userId: string;
  activityTotals: { study: number; workout: number; monthStudy: number; monthWorkout: number };
  focusScore: any;
  editSection: "posts" | "likes" | null; setEditSection: (s: "posts" | "likes" | null) => void;
  myPosts: any[]; myPostsLoading: boolean; myPostsError: string; postPage: number; setPostPage: (n: number | ((p: number) => number)) => void;
  likedPosts: any[]; likedLoading: boolean; likedError: string; likedPage: number; setLikedPage: (n: number | ((p: number) => number)) => void;
  loadMyPosts: () => void; loadLikedPosts: () => void;
  onDeletePost: (id: string) => void; onUpdatePost: (id: string, data: any) => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <button onClick={() => profile.icon_url && setViewingImage(profile.icon_url)}
            className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 cursor-pointer border-none p-0">
            {profile.icon_url ? (
              <Image src={getOptimizedIconUrl(profile.icon_url, 168)} width={56} height={56} className="rounded-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl">
                {(profile.display_name || "?")[0]}
              </div>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm truncate">{profile.display_name || "ユーザー"}</span>
              <span className="text-xs text-gray-400 truncate">@{profile.username || "unknown"}</span>
            </div>
            <div className="flex gap-3 mt-0.5">
              <Link href={`/profile/${encodeURIComponent(profile?.username || userId)}/follow?tab=following`}
                className="text-xs text-gray-500 hover:opacity-70 cursor-pointer no-underline">
                <strong className="text-gray-800">{followingCount}</strong> フォロー
              </Link>
              <Link href={`/profile/${encodeURIComponent(profile?.username || userId)}/follow?tab=followers`}
                className="text-xs text-gray-500 hover:opacity-70 cursor-pointer no-underline">
                <strong className="text-gray-800">{followersCount}</strong> フォロワー
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={toggleTheme}
              className="text-sm w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 cursor-pointer border-none transition">
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <div className="text-center">
              <p className="text-xl font-bold text-orange-500">{profile.exchange_points || 0}</p>
              <p className="text-[9px] text-gray-400">pt</p>
              <Link href="/shop" className="text-[9px] text-primary hover:underline block">交換所</Link>
            </div>
          </div>
        </div>
        {profile.current_title_id && (() => {
          const equippedTitle = items.find((i: any) => i.id === profile.current_title_id);
          return equippedTitle ? (
            <div className="text-xs text-gray-600 ml-0.5">
              <span className="text-gray-400">称号:</span> <span className="font-medium">{itemDisplayName(equippedTitle)}</span>
            </div>
          ) : null;
        })()}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2">
            <p className="text-[10px] font-bold text-blue-600">📚 総勉強時間</p>
            <p className="mt-0.5 text-sm font-extrabold text-blue-950">{Math.floor(activityTotals.study / 60)}時間{activityTotals.study % 60}分</p>
            <p className="mt-0.5 text-[10px] text-blue-600">今月 {Math.floor(activityTotals.monthStudy / 60)}時間{activityTotals.monthStudy % 60}分</p>
          </div>
          <div className="rounded-xl bg-pink-50 border border-pink-100 px-3 py-2">
            <p className="text-[10px] font-bold text-pink-600">🏋️ 総筋トレ時間</p>
            <p className="mt-0.5 text-sm font-extrabold text-pink-950">{Math.floor(activityTotals.workout / 60)}時間{activityTotals.workout % 60}分</p>
            <p className="mt-0.5 text-[10px] text-pink-600">今月 {Math.floor(activityTotals.monthWorkout / 60)}時間{activityTotals.monthWorkout % 60}分</p>
          </div>
        </div>
        {focusScore && (
          <div className="mt-2 rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-violet-800"><i className="fas fa-brain mr-1" />集中度スコア</p>
                <p className="mt-0.5 text-[10px] text-violet-600">8つの行動で評価。バーを伸ばすほどスコアUP。</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-lg font-extrabold ${focusScore.level === "S" ? "text-yellow-600" : focusScore.level === "A" ? "text-green-600" : focusScore.level === "B" ? "text-blue-600" : "text-violet-700"}`}>{focusScore.level} <span className="text-sm">{focusScore.total}</span></p>
                <p className="text-[10px] font-bold text-indigo-600">🏆 {focusScore.rank}位 / {focusScore.total_users}人中</p>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              {Object.values(focusScore.breakdown).map((item: any) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="w-[72px] shrink-0 text-[10px] font-bold text-violet-700">{item.label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500" style={{ width: `${(item.score / item.max) * 100}%` }} /></div>
                  <span className="w-9 text-right text-[10px] text-violet-700">{item.score}/{item.max}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 rounded-lg bg-white/75 px-2 py-1.5 text-[10px] font-bold text-violet-800">💡 次は「{Object.values(focusScore.breakdown).sort((a: any, b: any) => (a.score / a.max) - (b.score / b.max))[0] && (Object.values(focusScore.breakdown).sort((a: any, b: any) => (a.score / a.max) - (b.score / b.max))[0] as any).hint}」で伸ばそう</p>
          </div>
        )}
      </div>

      {!editSection && (
        <div className="border-t border-gray-100 grid grid-cols-2">
          <button onClick={() => { setEditSection("posts"); loadMyPosts(); }}
            className="flex items-center justify-center gap-2 py-3 hover:bg-blue-50 transition cursor-pointer text-left border-r border-gray-100">
            <i className="far fa-file-alt text-blue-500 text-sm" />
            <span className="text-sm font-bold">自分の投稿</span>
          </button>
          <button onClick={() => { setEditSection("likes"); loadLikedPosts(); }}
            className="flex items-center justify-center gap-2 py-3 hover:bg-red-50 transition cursor-pointer text-left">
            <i className="far fa-heart text-red-500 text-sm" />
            <span className="text-sm font-bold">いいねした投稿</span>
          </button>
        </div>
      )}

      {editSection === "posts" && (
        <div className="border-t border-gray-100 p-4 space-y-2">
          <button onClick={() => { setEditSection(null); }}
            className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer mb-2">
            <i className="fas fa-arrow-left" /> 戻る
          </button>
          {myPostsError && <div className="bg-red-50 text-red-600 p-2 rounded-lg text-xs">{myPostsError}</div>}
          {myPostsLoading && <div className="text-center py-4"><div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mx-auto" /></div>}
          {!myPostsLoading && myPosts.length === 0 && !myPostsError && (
            <p className="text-xs text-gray-400 text-center py-3">まだ投稿がありません</p>
          )}
          {myPosts.slice(0, postPage * 10).map((post: any) => (
            <PostCard key={post.id} post={post} currentUserId={userId}
              onDelete={onDeletePost} onUpdate={(id: string, data: any) => onUpdatePost(id, data)} />
          ))}
          {myPosts.length > postPage * 10 && (
            <button onClick={() => setPostPage((p) => p + 1)}
              className="w-full py-2 text-xs text-primary font-bold cursor-pointer hover:bg-gray-50 rounded-lg">
              もっと見る
            </button>
          )}
        </div>
      )}
      {editSection === "likes" && (
        <div className="border-t border-gray-100 p-4 space-y-2">
          <button onClick={() => { setEditSection(null); }}
            className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer mb-2">
            <i className="fas fa-arrow-left" /> 戻る
          </button>
          {likedError && <div className="bg-red-50 text-red-600 p-2 rounded-lg text-xs">{likedError}</div>}
          {likedLoading && <div className="text-center py-4"><div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mx-auto" /></div>}
          {!likedLoading && likedPosts.length === 0 && !likedError && (
            <p className="text-xs text-gray-400 text-center py-3">いいねした投稿はありません</p>
          )}
          {likedPosts.slice(0, likedPage * 10).map((post: any) => (
            <PostCard key={post.id} post={post} currentUserId={userId} onDelete={() => {}} onUpdate={() => {}} />
          ))}
          {likedPosts.length > likedPage * 10 && (
            <button onClick={() => setLikedPage((p) => p + 1)}
              className="w-full py-2 text-xs text-primary font-bold cursor-pointer hover:bg-gray-50 rounded-lg">
              もっと見る
            </button>
          )}
        </div>
      )}

      {viewingImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setViewingImage(null)}>
          <Image src={viewingImage} fill className="object-contain p-4 select-none" draggable={false} sizes="100vw" alt="" />
        </div>
      )}
    </div>
  );
}
