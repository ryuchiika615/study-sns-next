"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatRelativeTime, formatStudyTime, subjectColor, rarityClass } from "@/lib/utils";
import type { PostWithDetails } from "@/lib/types";

export default function PostCard({
  post,
  currentUserId,
  onDelete,
}: {
  post: PostWithDetails;
  currentUserId: string;
  onDelete?: (id: string) => void;
}) {
  const [liked, setLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.likes_count);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const router = useRouter();

  const handleLike = async () => {
    const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setLiked(data.liked);
      setLikeCount(data.count);
    }
  };

  const toggleComments = async () => {
    if (!showComments && !commentsLoaded) {
      const res = await fetch(`/api/posts/${post.id}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments);
        setCommentsLoaded(true);
      }
    }
    setShowComments(!showComments);
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    const res = await fetch(`/api/posts/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: commentText }),
    });
    if (res.ok) {
      const data = await res.json();
      setComments([...comments, data.comment]);
      setCommentText("");
    }
  };

  const handleDelete = async () => {
    if (!confirm("削除しますか？")) return;
    const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    if (res.ok) {
      onDelete?.(post.id);
      router.refresh();
    }
  };

  const rarity = rarityClass(post.current_title?.rarity);

  return (
    <div className="post-card">
      <div className="flex px-4 pt-1">
        <Link href={`/profile/${post.user?.username || post.user?.display_name || post.user_id}`} className="no-underline">
          <div className={`avatar-frame ${rarityClass(post.current_avatar?.rarity)}`}>
            {post.user?.icon_url ? (
              <img src={post.user.icon_url} className="w-12 h-12 rounded-full object-cover border-2 border-white" />
            ) : (
              <i className="fas fa-user-circle text-4xl text-gray-300" />
            )}
          </div>
        </Link>

        <div className="ml-3 flex-1 min-w-0">
          {post.current_title && (
            <span className={`title-badge ${rarity}`}>
              {post.current_title.rarity} {post.current_title.name.replace("精錬:", "").replace("邊ｾ骭ｬ:", "")}
            </span>
          )}

          <div className="flex items-baseline gap-1 flex-wrap">
            <strong className="text-[15px]">
              <Link href={`/profile/${post.user?.username || post.user?.display_name || post.user_id}`} className="text-gray-900 no-underline hover:underline">
                {post.user?.display_name || "ユーザー"}
              </Link>
            </strong>
            <span className="text-gray-500 text-sm">@{post.user?.username || post.user?.display_name || post.user_id?.slice(0, 8)}</span>
            <span className="text-gray-500 text-sm">·</span>
            <span className="text-gray-500 text-sm">{post.formatted_time}</span>
          </div>
        </div>

        {post.user_id === currentUserId && (
          <button onClick={handleDelete} className="text-gray-500 hover:text-danger bg-none border-none cursor-pointer">
            <i className="fas fa-ellipsis-h" />
          </button>
        )}
      </div>

      <div className="px-4 py-1 text-[15px] leading-relaxed break-words">
        <p className="whitespace-pre-wrap">{post.content}</p>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="subject-chip" style={{ backgroundColor: post.subject_color }}>
            {post.subject}
          </span>
          {post.study_minutes > 0 && (
            <span className="text-primary font-bold text-sm">
              <i className="fas fa-book-open" /> {post.display_study_time}
            </span>
          )}
        </div>

        {post.image_url && (
          <img src={post.image_url} className="mt-3 rounded-2xl border border-gray-200 max-w-full" />
        )}
      </div>

      <div className="flex gap-6 px-4 pb-3 max-w-[300px]">
        <button onClick={toggleComments} className="flex items-center gap-1.5 text-gray-500 text-sm bg-none border-none cursor-pointer hover:text-primary">
          <i className="far fa-comment" /> <span>{post.comments_count}</span>
        </button>
        <button onClick={handleLike} className="flex items-center gap-1.5 text-sm bg-none border-none cursor-pointer"
          style={{ color: liked ? "#f91880" : "#536471" }}>
          <i className={`${liked ? "fas" : "far"} fa-heart`} /> <span>{likeCount}</span>
        </button>
      </div>

      {showComments && (
        <div className="px-4 pb-4 bg-white">
          {comments.map((c: any) => (
            <div key={c.id} className="mb-2.5 pb-2.5 border-b border-gray-100 text-sm">
              <strong>{c.user?.display_name || "ユーザー"}</strong>
              <span className="text-gray-500 text-xs ml-1">@{c.user?.username || c.user_id?.slice(0, 8)}</span>
              <p className="mt-1 text-gray-900 whitespace-pre-wrap">{c.text}</p>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
               placeholder="返信をリュイート"
              className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm bg-gray-100 focus:bg-white focus:border-primary outline-none"
              onKeyDown={(e) => e.key === "Enter" && addComment()}
            />
            <button onClick={addComment}
              className="bg-primary text-white rounded-full px-4 text-sm font-bold border-none cursor-pointer">
              返信
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
