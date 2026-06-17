"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { formatRelativeTime, formatStudyTime, subjectColor, rarityClass } from "@/lib/utils";
import type { PostWithDetails } from "@/lib/types";

function highlightMentions(text: string) {
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) =>
    part.startsWith("@")
      ? <span key={i} className="text-blue-500 font-semibold">{part}</span>
      : part
  );
}

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
  const [reactions, setReactions] = useState(post.reactions_count || []);
  const [myReaction, setMyReaction] = useState(post.my_reaction || null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showComments, setShowComments] = useState(defaultShowComments ?? false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>(initialComments ?? []);
  const [commentsLoaded, setCommentsLoaded] = useState(!!initialComments);
  const [editing, setEditing] = useState(false);
  const [editedLocally, setEditedLocally] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [editMinutes, setEditMinutes] = useState(String(post.study_minutes));
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const swipeStartY = useRef(0);
  const swipeDist = useRef(0);
  const [swipeTranslate, setSwipeTranslate] = useState(0);
  const router = useRouter();

  const handleReply = useCallback((username: string) => {
    setCommentText(`@${username} `);
    setShowComments(true);
    setTimeout(() => commentInputRef.current?.focus(), 100);
  }, []);

  const handleReaction = async (emoji: string) => {
    const prev = { myReaction, reactions };
    const wasSame = myReaction === emoji;
    setMyReaction(wasSame ? null : emoji);
    if (wasSame) {
      setReactions(prev => prev.map(r => r.reaction === emoji ? { ...r, count: r.count - 1 } : r).filter(r => r.count > 0));
    } else {
      setReactions(prev => {
        if (myReaction) prev = prev.map(r => r.reaction === myReaction ? { ...r, count: r.count - 1 } : r).filter(r => r.count > 0);
        const existing = prev.find(r => r.reaction === emoji);
        if (existing) return prev.map(r => r.reaction === emoji ? { ...r, count: r.count + 1 } : r);
        return [...prev, { reaction: emoji, count: 1 }];
      });
    }
    const res = await fetch("/api/posts/reactions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: post.id, reaction: emoji }),
    });
    if (!res.ok) {
      setMyReaction(prev.myReaction);
      setReactions(prev.reactions);
    }
  };

  const reactionEmojis = ["👍", "🔥", "💯", "🎉", "❤️", "😢"];

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
    const text = commentText.trim();
    const { data, error } = await supabase
      .from("comments")
      .insert({ post_id: post.id, user_id: currentUserId, text })
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
      const mentionMatches = text.match(/@(\w+)/g);
      if (mentionMatches) {
        const mentionedUsernames = [...new Set(mentionMatches.map(m => m.slice(1)))];
        supabase.from("profiles").select("id, username").in("username", mentionedUsernames).then(({ data: mentionedUsers }) => {
          if (!mentionedUsers) return;
          mentionedUsers.forEach((mentioned: any) => {
            if (mentioned.id === currentUserId) return;
            supabase.from("notifications").insert({
              recipient_id: mentioned.id,
              sender_id: currentUserId,
              post_id: post.id,
              notification_type: "mention",
            }).then(() => {
              fetch("/api/push/notify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "mention", recipient_id: mentioned.id, post_id: post.id }),
              }).catch(() => {});
            });
          });
        });
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
    const daysOld = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysOld > 7) {
      alert("1週間以上経過した投稿は削除できません。管理者にお問い合わせください。");
      return;
    }
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
    setEditedLocally(true);
    onUpdate?.(post.id, { content: editContent.trim(), study_minutes: minutes });
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(post.content);
    setEditMinutes(String(post.study_minutes));
    setEditing(false);
  };

  const rarity = rarityClass(post.current_title?.rarity);

  const isOwn = post.user_id === currentUserId;

  return (
    <div className={`post-card ${isOwn ? "border-l-4 border-l-primary" : ""}`}>
      <div className="flex px-4 pt-1">
        <Link href={`/profile/${post.user?.id || post.user_id}`} className="no-underline">
          <div className={`avatar-frame ${rarityClass(post.current_avatar?.rarity)}`}>
            {post.user?.icon_url ? (
              <img src={post.user.icon_url} loading="lazy" className="w-12 h-12 rounded-full object-cover border-2 border-white" />
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
            {(editedLocally || (post.updated_at && new Date(post.updated_at) > new Date(post.created_at))) && (
              <span className="text-[10px] text-gray-400 ml-0.5">編集済み</span>
            )}
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

            {((post.image_urls?.length ?? 0) > 0 || post.image_url) && (
              <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min((post.image_urls || [post.image_url]).filter(Boolean).length, 2)}, 1fr)` }}>
                {(post.image_urls?.length ? post.image_urls : [post.image_url]).filter((u): u is string => !!u).map((url, i) => (
                  <img key={i} src={url} loading="lazy" className="rounded-2xl border border-gray-200 w-full h-48 object-cover cursor-pointer" onClick={() => setViewingImage(url)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-3 px-4 pb-3 flex-wrap">
        <button onClick={toggleComments} className="flex items-center gap-1.5 text-gray-500 text-sm bg-none border-none cursor-pointer hover:text-primary">
          <i className="far fa-comment" /> <span>{post.comments_count}</span>
        </button>
        <div className="flex items-center gap-1 flex-wrap">
          <div className="relative">
            <button onClick={() => setShowReactionPicker(!showReactionPicker)}
              className="text-sm px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100 cursor-pointer transition">
              <i className="far fa-smile" />
            </button>
            {showReactionPicker && (
              <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 flex gap-1 z-10">
                {reactionEmojis.map((emoji) => (
                  <button key={emoji} onClick={() => { handleReaction(emoji); setShowReactionPicker(false); }}
                    className={`text-lg w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer transition ${
                      myReaction === emoji ? "bg-primary/10" : ""
                    }`}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          {reactions.map((r) => (
            <button key={r.reaction} onClick={() => handleReaction(r.reaction)}
              className={`text-sm px-2 py-0.5 rounded-full border cursor-pointer transition flex items-center gap-1 ${
                myReaction === r.reaction ? "bg-primary/10 border-primary text-primary" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
              }`}>
              <span>{r.reaction}</span>
              <span className="text-xs font-medium">{r.count}</span>
            </button>
          ))}
        </div>
      </div>

      {showComments && (
        <div className="px-4 pb-4 bg-white">
          {comments.map((c: any) => (
            <div key={c.id} className="mb-2.5 pb-2.5 border-b border-gray-100 text-sm">
              <div className="flex items-start gap-2">
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
                    <p className="mt-1 text-gray-900 whitespace-pre-wrap">{highlightMentions(c.text)}</p>
                  )}
                </div>
                {c.user_id === currentUserId && (
                  <div className="flex gap-1 items-center shrink-0">
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
              {editCommentId !== c.id && (
                <button onClick={() => handleReply(c.user?.username || c.user_id?.slice(0, 8))}
                  className="text-gray-400 hover:text-blue-500 bg-none border-none cursor-pointer text-xs mt-1 pl-0">
                  <i className="fas fa-reply mr-1" />返信
                </button>
              )}
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input
              ref={commentInputRef}
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

      {viewingImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center select-none"
          onClick={() => setViewingImage(null)}
          onTouchStart={(e) => { swipeStartY.current = e.touches[0].clientY; swipeDist.current = 0; setSwipeTranslate(0); }}
          onTouchMove={(e) => { const d = e.touches[0].clientY - swipeStartY.current; if (d > 0) { swipeDist.current = d; setSwipeTranslate(d); } }}
          onTouchEnd={() => { if (swipeDist.current > 80) setViewingImage(null); swipeDist.current = 0; setSwipeTranslate(0); }}
          style={{}}
        >
          <div style={{ transform: swipeTranslate > 0 ? `translateY(${swipeTranslate}px)` : undefined, transition: swipeTranslate > 0 ? "none" : "transform 0.3s" }}>
            <img src={viewingImage} className="max-w-full max-h-full object-contain p-4 select-none" draggable={false} />
          </div>
        </div>
      )}
    </div>
  );
}
