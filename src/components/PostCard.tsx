"use client";

import { memo, useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { formatRelativeTime, formatStudyTime, subjectColor, rarityClass, getOptimizedIconUrl, insertAtCursor, notifyMentions } from "@/lib/utils";
import type { PostWithDetails } from "@/lib/types";
import MentionAutocomplete from "./MentionAutocomplete";

function highlightMentions(text: string) {
  const parts: (string | JSX.Element)[] = [];
  let last = 0;
  const regex = /@(?:[\p{L}\p{N}._-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gu;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<span key={m.index} className="text-blue-500 font-semibold">{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : text;
}

const PostCard = memo(function PostCard({
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
  onUpdate?: (id: string, data: { content?: string; study_minutes?: number; subject?: string; study_date?: string | null }) => void;
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
  const [editSubject, setEditSubject] = useState(post.subject);
  const [editDate, setEditDate] = useState(post.study_date || "");
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [subjectOptions, setSubjectOptions] = useState<string[]>([]);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteContent, setQuoteContent] = useState("");
  const [quoteSilent, setQuoteSilent] = useState(false);
  const [championUserId, setChampionUserId] = useState<string | null>(null);
  const [quoteImages, setQuoteImages] = useState<{ blob: Blob; originalUrl: string }[]>([]);
  const quoteContentRef = useRef<HTMLTextAreaElement>(null);
  const [commentImages, setCommentImages] = useState<{ blob: Blob; originalUrl: string }[]>([]);
  const [commentLikes, setCommentLikes] = useState<Record<string, boolean>>({});
  const [commentLikesCount, setCommentLikesCount] = useState<Record<string, number>>({});
  const commentInputRef = useRef<HTMLInputElement>(null);
  const swipeStartY = useRef(0);
  const swipeDist = useRef(0);
  const [swipeTranslate, setSwipeTranslate] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (editing && subjectOptions.length === 0) {
      supabase.from("textbooks").select("title").eq("user_id", currentUserId).then(({ data }) => {
        if (data) setSubjectOptions(data.map(t => t.title));
      });
    }
  }, [editing]);

  useEffect(() => {
    fetch("/api/rankings/current-champion").then(r => r.json()).then(d => setChampionUserId(d.user_id)).catch(() => {});
  }, []);

  const handleReply = useCallback((username: string) => {
    setCommentText((prev) => {
      const tag = `@${username}`;
      if (prev.includes(tag)) return prev;
      return prev ? `${prev} ${tag} ` : `${tag} `;
    });
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
        return [...prev, { reaction: emoji, count: 1, users: [] }];
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

  const reactionEmojis = ["😄", "😠", "😢", "😆", "❤️", "😲"];

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
        const commentIds = data.map((c: any) => c.id);
        if (commentIds.length > 0) {
          const { data: likesData } = await supabase
            .from("comment_likes")
            .select("comment_id, user_id")
            .in("comment_id", commentIds);
          if (likesData) {
            const counts: Record<string, number> = {};
            const myLikes: Record<string, boolean> = {};
            for (const l of likesData) {
              counts[l.comment_id] = (counts[l.comment_id] || 0) + 1;
              if (l.user_id === currentUserId) myLikes[l.comment_id] = true;
            }
            setCommentLikesCount(counts);
            setCommentLikes(myLikes);
          }
        }
      }
    }
    setShowComments(!showComments);
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    const text = commentText.trim();

    const imageUrls: string[] = [];
    for (const img of commentImages) {
      const fileName = `${currentUserId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(fileName, img.blob);
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("post-images")
          .getPublicUrl(fileName);
        if (urlData?.publicUrl) imageUrls.push(urlData.publicUrl);
      }
    }

    const { data, error } = await supabase
      .from("comments")
      .insert({ post_id: post.id, user_id: currentUserId, text, image_urls: imageUrls.length > 0 ? imageUrls : null })
      .select("*, user:user_id(*)")
      .single();
    if (!error && data) {
      setComments([...comments, data]);
      setCommentText("");
      setCommentImages([]);
      notifyMentions(post.id, text);
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

  const handleCommentMentionClick = () => {
    commentInputRef.current && insertAtCursor(commentInputRef.current, "@");
  };

  const toggleCommentLike = async (commentId: string) => {
    const prevLiked = commentLikes[commentId];
    const prevCount = commentLikesCount[commentId] || 0;
    setCommentLikes(prev => ({ ...prev, [commentId]: !prevLiked }));
    setCommentLikesCount(prev => ({ ...prev, [commentId]: prevCount + (prevLiked ? -1 : 1) }));
    const { error } = prevLiked
      ? await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", currentUserId)
      : await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: currentUserId });
    if (error) {
      setCommentLikes(prev => ({ ...prev, [commentId]: prevLiked }));
      setCommentLikesCount(prev => ({ ...prev, [commentId]: prevCount }));
    }
  };

  const handleCommentQuote = (c: any) => {
    setShowQuoteForm(true);
    setQuoteContent(`@${c.user?.username || c.user_id?.slice(0, 8)} `);
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
      body: JSON.stringify({ postId: post.id, content: editContent.trim(), study_minutes: minutes, subject: editSubject.trim() || "その他" }),
    });
    if (!res.ok) {
      alert("保存に失敗しました。もう一度お試しください。");
      return;
    }
    setEditedLocally(true);
    onUpdate?.(post.id, { content: editContent.trim(), study_minutes: minutes, subject: editSubject.trim() || "その他" });
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(post.content);
    setEditMinutes(String(post.study_minutes));
    setEditSubject(post.subject);
    setEditing(false);
  };

  const rarity = rarityClass(post.current_title?.rarity);

  const isOwn = post.user_id === currentUserId;

  return (
    <div className={`post-card ${isOwn ? "border-l-4 border-l-primary" : ""} ${post.user_id === championUserId ? "relative overflow-hidden" : ""}`}>
      {post.user_id === championUserId && (
        <>
          {/* 雫デコレーション（月間王者） */}
          <div className="absolute inset-0 pointer-events-none border-2 border-transparent"
            style={{
              borderImage: "linear-gradient(135deg, rgba(6,182,212,0.5), rgba(59,130,246,0.3), rgba(6,182,212,0.1)) 1",
            }}
          />
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {[0, 1, 2].map(i => (
              <span key={i} className="text-[8px] text-cyan-400 drop-shadow"
                style={{ opacity: 0.7 + i * 0.15 }}>
                <i className="fas fa-tint" />
              </span>
            ))}
          </div>
        </>
      )}
      <div className="flex px-4 pt-5">
        <Link href={`/profile/${post.user?.id || post.user_id}`} className="no-underline">
          <div className={`avatar-frame ${rarityClass(post.current_avatar?.rarity)}`} data-icon={post.current_avatar?.name?.replace("【アイコン】", "") || ""}>
            {post.user?.icon_url ? (
              <Image src={getOptimizedIconUrl(post.user.icon_url, 320)} width={48} height={48} className="rounded-full object-cover border-2 border-white" alt="" />
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
            {post.user?.consecutive_post_days ? (
              <span className="text-xs font-bold text-orange-500" title={`${post.user.consecutive_post_days}日連続勉強中`}>
                🔥{post.user.consecutive_post_days}
              </span>
            ) : null}
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
              <span className="text-sm text-gray-500">科目:</span>
              <input
                type="text"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                list="edit-subjects"
                className="flex-1 border border-gray-300 rounded-lg p-1 text-sm"
              />
              <datalist id="edit-subjects">
                {subjectOptions.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
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
            <p className="whitespace-pre-wrap">{highlightMentions(post.content)}</p>

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
                  <div key={i} className="relative w-full h-48">
                    <Image src={url} fill className="rounded-2xl border border-gray-200 object-cover cursor-pointer" onClick={() => setViewingImage(url)} sizes="(max-width: 768px) 100vw, 600px" alt="" />
                  </div>
                ))}
              </div>
            )}

            {/* Audio player */}
            {post.audio_url && (
              <div className="mt-3 flex items-center gap-2 bg-gray-50 rounded-xl p-2 border border-gray-200">
                <i className="fas fa-music text-gray-400" />
                <span className="text-xs text-gray-600 truncate flex-1">{post.audio_name || "音声"}</span>
                <audio src={post.audio_url} controls className="h-8 w-40" preload="none" />
                <button onClick={async () => {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) return;
                  const { data: existing } = await supabase.from("audio_bgm")
                    .select("id").eq("user_id", user.id).eq("audio_url", post.audio_url!).maybeSingle();
                  if (existing) return;
                  await supabase.from("audio_bgm").insert({
                    user_id: user.id,
                    name: post.audio_name || "共有BGM",
                    duration_seconds: 0,
                    audio_url: post.audio_url,
                    price: 0,
                  });
                  window.dispatchEvent(new CustomEvent("bgm-added"));
                  alert("BGMに追加しました！");
                }} className="text-xs bg-primary text-white rounded-full px-3 py-1 cursor-pointer hover:bg-primary/80 border-none shrink-0">
                  BGMに追加
                </button>
              </div>
            )}

            {/* Quoted post embed */}
            {post.quoted_post && (
              <Link href={`/post/${post.quoted_post.id}`} className="block mt-3 border border-gray-200 rounded-xl p-3 hover:bg-gray-50 no-underline text-inherit">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                    {post.quoted_post.user?.icon_url ? (
                      <Image src={getOptimizedIconUrl(post.quoted_post.user.icon_url, 60)} width={20} height={20} className="object-cover" alt="" />
                    ) : (
                      <i className="fas fa-user text-xs text-gray-400 flex items-center justify-center w-full h-full" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-900">{post.quoted_post.user?.display_name || "ユーザー"}</span>
                  <span className="text-xs text-gray-500">@{post.quoted_post.user?.username}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">{post.quoted_post.content}</p>
              </Link>
            )}

            {/* Quote repost form */}
            {showQuoteForm && (
              <div className="mt-3 border border-primary/30 rounded-xl p-3 bg-primary/5">
                <p className="text-xs font-bold text-gray-600 mb-2">引用してリュイート</p>
                <div className="relative">
                  <textarea ref={quoteContentRef} value={quoteContent} onChange={(e) => setQuoteContent(e.target.value.slice(0, 2000))}
                    className="w-full rounded-lg border-gray-300 text-sm resize-none pr-6" rows={2} placeholder="コメントを入力（任意）" maxLength={2000} />
                  <MentionAutocomplete textareaRef={quoteContentRef} content={quoteContent} onChange={(v) => setQuoteContent(v)} />
                  <button type="button" onClick={() => quoteContentRef.current && insertAtCursor(quoteContentRef.current, "@")}
                    className="absolute top-1 right-1 text-gray-400 hover:text-primary bg-none border-none cursor-pointer text-xs p-0.5">
                    ＠
                  </button>
                </div>
                <p className="text-xs text-right text-gray-400 mt-1">{quoteContent.length}/2000</p>
                <label className="flex items-center gap-2 mt-2 text-xs text-gray-500 cursor-pointer">
                  <i className="fas fa-camera" />
                  画像を追加
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (!files) return;
                      const newImages = Array.from(files).map(file => ({
                        blob: file,
                        originalUrl: URL.createObjectURL(file),
                      }));
                      setQuoteImages(prev => [...prev, ...newImages]);
                      e.target.value = "";
                    }} />
                </label>
                {quoteImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {quoteImages.map((img, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                        <img src={img.originalUrl} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => {
                          setQuoteImages(prev => prev.filter((_, j) => j !== i));
                          URL.revokeObjectURL(img.originalUrl);
                        }}
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/50 hover:bg-red-600/80 rounded text-white text-[8px] flex items-center justify-center cursor-pointer border-none">
                          <i className="fas fa-times" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="flex items-center gap-2 mt-2 text-xs text-gray-500 cursor-pointer select-none">
                  <input type="checkbox" checked={quoteSilent} onChange={(e) => setQuoteSilent(e.target.checked)}
                    className="accent-gray-400 w-3.5 h-3.5" />
                  通知を送らない
                </label>
                <div className="flex gap-2 mt-2">
                  <button onClick={async () => {
                    if (!quoteContent.trim()) return;
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) return;

                    const imageUrls: string[] = [];
                    for (const img of quoteImages) {
                      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
                      const { error: uploadError } = await supabase.storage
                        .from("post-images")
                        .upload(fileName, img.blob);
                      if (!uploadError) {
                        const { data: urlData } = supabase.storage
                          .from("post-images")
                          .getPublicUrl(fileName);
                        if (urlData?.publicUrl) imageUrls.push(urlData.publicUrl);
                      }
                    }

                    const { data, error } = await supabase.rpc("create_post", {
                      p_content: quoteContent.trim(),
                      p_subject: "その他",
                      p_study_minutes: 0,
                      p_image_url: imageUrls[0] || null,
                      p_image_urls: imageUrls.length > 0 ? imageUrls : null,
                      p_study_date: null,
                      p_quote_post_id: post.id,
                      p_silent: quoteSilent,
                      p_audio_url: null,
                      p_audio_name: null,
                    });
                    if (!error && data?.post_id) {
                      notifyMentions(data.post_id, quoteContent);
                      setShowQuoteForm(false);
                      setQuoteContent("");
                      setQuoteSilent(false);
                      setQuoteImages([]);
                      if (!quoteSilent) {
                        fetch("/api/push/follow-post", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ post_id: data.post_id }),
                        }).catch(() => {});
                      }
                      window.dispatchEvent(new CustomEvent("post-created"));
                      router.refresh();
                    }
                  }} className="bg-primary text-white rounded-full px-4 py-1 text-xs font-bold cursor-pointer">
                    引用リュイート
                  </button>
                  <button onClick={() => { setShowQuoteForm(false); setQuoteContent(""); setQuoteSilent(false); setQuoteImages([]); }}
                    className="text-gray-500 text-xs bg-none border-none cursor-pointer">
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-3 px-4 pb-3 flex-wrap">
        <button onClick={toggleComments} className="flex items-center gap-1.5 text-gray-500 text-sm bg-none border-none cursor-pointer hover:text-primary">
          <i className="far fa-comment" /> <span>{post.comments_count}</span>
        </button>
        <button onClick={() => setShowQuoteForm(!showQuoteForm)}
          className="flex items-center gap-1 text-gray-500 text-sm bg-none border-none cursor-pointer hover:text-primary">
          <i className="fas fa-retweet" /> <span>引用</span>
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
          {(() => {
            const allUsers = reactions.flatMap(r =>
              (r.users || []).map(u => ({ ...u, reaction: r.reaction }))
            );
            if (allUsers.length > 0) {
              const maxVisible = 8;
              const visible = allUsers.slice(0, maxVisible);
              const remaining = allUsers.length - maxVisible;
              return (
                <>
                  {visible.map((u, i) => (
                    <div key={`${u.id}-${u.reaction}`} className="relative w-7 h-7 shrink-0"
                      title={`${u.display_name}: ${u.reaction}`}>
                      <img src={u.icon_url || "/default-icon.png"} alt=""
                        className="w-7 h-7 rounded-full object-cover border border-gray-200" />
                      <span className="absolute -bottom-0.5 -right-0.5 text-[9px] leading-none drop-shadow bg-white rounded-full">{u.reaction}</span>
                    </div>
                  ))}
                  {remaining > 0 && (
                    <span className="text-[10px] text-gray-400 font-bold shrink-0">+{remaining}</span>
                  )}
                  {reactions.filter(r => (r.users || []).length === 0).map(r => (
                    <button key={r.reaction} onClick={() => handleReaction(r.reaction)}
                      className={`text-sm px-2 py-0.5 rounded-full border cursor-pointer transition flex items-center gap-1 ${
                        myReaction === r.reaction ? "bg-primary/10 border-primary text-primary" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                      }`}>
                      <span>{r.reaction}</span>
                      <span className="text-xs font-medium">{r.count}</span>
                    </button>
                  ))}
                </>
              );
            }
            return reactions.map(r => (
              <button key={r.reaction} onClick={() => handleReaction(r.reaction)}
                className={`text-sm px-2 py-0.5 rounded-full border cursor-pointer transition flex items-center gap-1 ${
                  myReaction === r.reaction ? "bg-primary/10 border-primary text-primary" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                }`}>
                <span>{r.reaction}</span>
                <span className="text-xs font-medium">{r.count}</span>
              </button>
            ));
          })()}
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
                        onChange={(e) => setEditCommentText(e.target.value.slice(0, 500))}
                        className="flex-1 border border-gray-300 rounded-lg p-1 text-sm"
                        autoFocus
                        maxLength={500}
                      />
                      <button onClick={saveEditComment} className="bg-primary text-white rounded-full px-3 py-1 text-xs font-bold border-none cursor-pointer">
                        保存
                      </button>
                      <button onClick={cancelEditComment} className="text-gray-500 text-xs bg-none border-none cursor-pointer">
                        取消
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="mt-1 text-gray-900 whitespace-pre-wrap">{highlightMentions(c.text)}</p>
                      {c.image_urls?.length > 0 && (
                        <div className="mt-2 flex gap-2">
                          {c.image_urls.map((url: string, i: number) => (
                            <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                              <Image src={url} fill className="object-cover cursor-pointer" onClick={() => setViewingImage(url)} sizes="80px" alt="" />
                            </div>
                          ))}
                        </div>
                      )}
                    </>
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
                <div className="flex items-center gap-2 mt-1">
                  <button onClick={() => handleReply(c.user?.username || c.user_id?.slice(0, 8))}
                    className="text-gray-400 hover:text-blue-500 bg-none border-none cursor-pointer text-xs">
                    <i className="fas fa-reply mr-1" />返信
                  </button>
                  <button onClick={() => toggleCommentLike(c.id)}
                    className={`bg-none border-none cursor-pointer text-xs flex items-center gap-0.5 ${
                      commentLikes[c.id] ? "text-red-500" : "text-gray-400 hover:text-red-500"
                    }`}>
                    <i className={`${commentLikes[c.id] ? "fas" : "far"} fa-heart`} />
                    <span>{(commentLikesCount[c.id] || 0) > 0 ? commentLikesCount[c.id] : ""}</span>
                  </button>
                  <button onClick={() => handleCommentQuote(c)}
                    className="text-gray-400 hover:text-blue-500 bg-none border-none cursor-pointer text-xs">
                    <i className="fas fa-retweet mr-0.5" />引用
                  </button>
                </div>
              )}
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <div className="flex-1 flex items-center gap-1 bg-gray-100 rounded-full px-3 focus-within:bg-white focus-within:border focus-within:border-primary">
              <input
                ref={commentInputRef}
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value.slice(0, 500))}
                placeholder="返信をリュイート"
                className="flex-1 bg-transparent border-none outline-none py-2 text-sm"
                maxLength={500}
                onKeyDown={(e) => e.key === "Enter" && addComment()}
              />
              <button type="button" onClick={handleCommentMentionClick}
                className="text-gray-400 hover:text-primary bg-none border-none cursor-pointer text-xs p-1">
                ＠
              </button>
              <label className="text-gray-400 hover:text-primary cursor-pointer text-xs p-1">
                <i className="fas fa-camera" />
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (!files) return;
                    const newImages = Array.from(files).map(file => ({
                      blob: file,
                      originalUrl: URL.createObjectURL(file),
                    }));
                    setCommentImages(prev => [...prev, ...newImages]);
                    e.target.value = "";
                  }} />
              </label>
            </div>
            <button onClick={addComment}
              className="bg-primary text-white rounded-full px-4 text-sm font-bold border-none cursor-pointer">
              返信
            </button>
          </div>
          {commentImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {commentImages.map((img, i) => (
                <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200">
                  <img src={img.originalUrl} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => {
                    setCommentImages(prev => prev.filter((_, j) => j !== i));
                    URL.revokeObjectURL(img.originalUrl);
                  }}
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/50 hover:bg-red-600/80 rounded text-white text-[8px] flex items-center justify-center cursor-pointer border-none">
                    <i className="fas fa-times" />
                  </button>
                </div>
              ))}
            </div>
          )}
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
          <div className="relative w-full h-full" style={{ transform: swipeTranslate > 0 ? `translateY(${swipeTranslate}px)` : undefined, transition: swipeTranslate > 0 ? "none" : "transform 0.3s" }}>
            <Image src={viewingImage} fill className="object-contain p-4 select-none" draggable={false} sizes="100vw" alt="" />
          </div>
        </div>
      )}
    </div>
  );
});

export default PostCard;
