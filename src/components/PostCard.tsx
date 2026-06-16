"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { formatRelativeTime, formatStudyTime, subjectColor, rarityClass } from "@/lib/utils";
import type { PostWithDetails } from "@/lib/types";

export default function PostCard({
  post,
  currentUserId,
  onDelete,
  onUpdate,
  defaultShowComments,
  initialComments,
}: {
  post: PostWithDetails;
  currentUserId: string;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, data: { content?: string; study_minutes?: number }) => void;
  defaultShowComments?: boolean;
  initialComments?: any[];
}) {
  const supabase = createClient();
  const [liked, setLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.likes_count);
  const [showComments, setShowComments] = useState(defaultShowComments ?? false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>(initialComments ?? []);
  const [commentsLoaded, setCommentsLoaded] = useState(!!initialComments);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [editMinutes, setEditMinutes] = useState(String(post.study_minutes));
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const router = useRouter();

  const handleLike = async () => {
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount(wasLiked ? likeCount - 1 : likeCount + 1);

    if (wasLiked) {
      const { error } = await supabase
        .from("likes")
        .delete()
        .eq("user_id", currentUserId)
        .eq("post_id", post.id);
      if (error) { setLiked(true); setLikeCount(likeCount); }
    } else {
      const { error } = await supabase
        .from("likes")
        .insert({ user_id: currentUserId, post_id: post.id });
      if (error) { setLiked(false); setLikeCount(likeCount); }
      else if (post.user_id !== currentUserId) {
        fetch("/api/push/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "like", recipient_id: post.user_id, post_id: post.id }),
        }).catch(() => {});
      }
    }
  };

  const toggleComments = async () => {
    if (!showComments && !commentsLoaded) {
      const { data } = await supabase
        .from("comments")
        .select("*, user:user_id(*)")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });
      if (data) {
        setComments(data);
        setCommentsLoaded(true);
      }
    }
    setShowComments(!showComments);
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    const { data, error } = await supabase
      .from("comments")
      .insert({ post_id: post.id, user_id: currentUserId, text: commentText.trim() })
      .select("*, user:user_id(*)")
      .single();
    if (!error && data) {
      setComments([...comments, data]);
      setCommentText("");
      if (post.user_id !== currentUserId) {
        fetch("/api/push/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "reply", recipient_id: post.user_id, post_id: post.id }),
        }).catch(() => {});
      }
    }
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", commentId).eq("user_id", currentUserId);
    if (!error) {
      setComments(comments.filter((c: any) => c.id !== commentId));
    }
  };

  const startEditComment = (c: any) => {
    setEditCommentId(c.id);
    setEditCommentText(c.text);
  };

  const saveEditComment = async () => {
    if (!editCommentText.trim()) return;
    const { error } = await supabase
      .from("comments")
      .update({ text: editCommentText.trim() })
      .eq("id", editCommentId);
    if (error) return;
    setComments(comments.map((c: any) => c.id === editCommentId ? { ...c, text: editCommentText.trim() } : c));
    setEditCommentId(null);
  };

  const cancelEditComment = () => {
    setEditCommentId(null);
  };

  const handleDelete = async () => {
    if (!confirm("削除しますか？")) return;
    const res = await fetch("/api/posts/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: post.id }),
    });
    if (res.ok) {
      onDelete?.(post.id);
    }
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    const minutes = parseInt(editMinutes) || 0;
    const res = await fetch("/api/posts/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: post.id, content: editContent.trim(), study_minutes: minutes }),
    });
    if (!res.ok) {
      alert("保存に失敗しました。もう一度お試しください。");
      return;
    }
    onUpdate?.(post.id, { content: editContent.trim(), study_minutes: minutes });
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(post.content);
    setEditMinutes(String(post.study_minutes));
    setEditing(false);
  };

  const rarity = rarityClass(post.current_title?.rarity);

  return (
    <div className="post-card">
      <div className="flex px-4 pt-1">
        <Link href={`/profile/${post.user?.id || post.user_id}`} className="no-underline">
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
              <Link href={`/profile/${post.user?.id || post.user_id}`} className="text-gray-900 no-underline hover:underline">
                {post.user?.display_name || "ユーザー"}
              </Link>
            </strong>
            <span className="text-gray-500 text-sm">@{post.user?.username || post.user?.display_name || post.user_id?.slice(0, 8)}</span>
            <span className="text-gray-500 text-sm">·</span>
            <span className="text-gray-500 text-sm">{post.formatted_time}</span>
          </div>
        </div>

        {post.user_id === currentUserId && (
          <div className="flex gap-1">
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-gray-500 hover:text-blue-500 bg-none border-none cursor-pointer text-sm p-1">
                <i className="fas fa-pen" />
              </button>
            )}
            <button onClick={handleDelete} className="text-gray-500 hover:text-danger bg-none border-none cursor-pointer">
              <i className="fas fa-trash" />
            </button>
          </div>
        )}
      </div>

      <div className="px-4 py-1 text-[15px] leading-relaxed break-words">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm resize-none h-20"
            />
            <div className="flex gap-2 items-center">
              <span className="text-sm text-gray-500">勉強時間（分）:</span>
              <input
                type="number"
                value={editMinutes}
                onChange={(e) => setEditMinutes(e.target.value)}
                min={0}
                className="w-20 border border-gray-300 rounded-lg p-1 text-sm"
              />
              <button onClick={handleSaveEdit} className="bg-primary text-white rounded-full px-4 py-1 text-sm font-bold border-none cursor-pointer">
                保存
              </button>
              <button onClick={handleCancelEdit} className="text-gray-500 text-sm bg-none border-none cursor-pointer hover:text-gray-700">
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap">{post.content}</p>
            {post.updated_at && new Date(post.updated_at) > new Date(post.created_at) && (
              <p className="text-xs text-gray-400 mt-1">（編集済み）</p>
            )}

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
          </>
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
            <div key={c.id} className="mb-2.5 pb-2.5 border-b border-gray-100 text-sm flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <strong>{c.user?.display_name || "ユーザー"}</strong>
                <span className="text-gray-500 text-xs ml-1">@{c.user?.username || c.user_id?.slice(0, 8)}</span>
                <span className="text-gray-400 text-xs ml-1">· {formatRelativeTime(c.created_at)}</span>
                {editCommentId === c.id ? (
                  <div className="mt-1 flex gap-1">
                    <input
                      type="text"
                      value={editCommentText}
                      onChange={(e) => setEditCommentText(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg p-1 text-sm"
                      autoFocus
                    />
                    <button onClick={saveEditComment} className="bg-primary text-white rounded-full px-3 py-1 text-xs font-bold border-none cursor-pointer">
                      保存
                    </button>
                    <button onClick={cancelEditComment} className="text-gray-500 text-xs bg-none border-none cursor-pointer">
                      取消
                    </button>
                  </div>
                ) : (
                  <p className="mt-1 text-gray-900 whitespace-pre-wrap">{c.text}</p>
                )}
              </div>
              {c.user_id === currentUserId && (
                <div className="flex gap-1">
                  <button onClick={() => startEditComment(c)}
                    className="text-gray-400 hover:text-blue-500 bg-none border-none cursor-pointer text-xs p-1">
                    <i className="fas fa-pen" />
                  </button>
                  <button onClick={() => deleteComment(c.id)}
                    className="text-gray-400 hover:text-red-500 bg-none border-none cursor-pointer text-xs p-1">
                    <i className="fas fa-times" />
                  </button>
                </div>
              )}
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
