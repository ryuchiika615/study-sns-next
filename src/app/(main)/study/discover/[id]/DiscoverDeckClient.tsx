"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function DiscoverDeckClient({
  deck,
  cards,
  likeCount: initialLikes,
  commentCount: initialCommentCount,
  userLiked: initialLiked,
  userBookmarked: initialBookmarked,
  comments: initialComments,
  userId,
}: {
  deck: any;
  cards: any[];
  likeCount: number;
  commentCount: number;
  userLiked: boolean;
  userBookmarked: boolean;
  comments: any[];
  userId: string;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [likeCount, setLikeCount] = useState(initialLikes);
  const [commentList, setCommentList] = useState<any[]>(initialComments);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [importing, setImporting] = useState(false);

  const isOwner = deck.user_id === userId;

  const toggleLike = async () => {
    const res = await fetch("/api/study/deck/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deck_id: deck.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setLiked(data.liked);
      setLikeCount((prev) => prev + (data.liked ? 1 : -1));
    }
  };

  const toggleBookmark = async () => {
    const res = await fetch("/api/study/deck/bookmark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deck_id: deck.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setBookmarked(data.bookmarked);
    }
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/study/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deck_id: deck.id, content: commentText.trim() }),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      setCommentList((prev: any[]) => [...prev, data.comment]);
      setCommentText("");
    }
  };

  const deleteComment = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    const res = await fetch("/api/study/comments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setCommentList((prev: any[]) => prev.filter((c: any) => c.id !== id));
  };

  const importDeck = async () => {
    if (!confirm(`「${deck.name}」を自分のデッキにコピーしますか？（カード${cards.length}枚）`)) return;
    setImporting(true);
    const supabase = createClient();
    const { data: newDeck } = await supabase
      .from("decks")
      .insert({ user_id: userId, name: deck.name + " (コピー)", description: deck.description, original_author_id: deck.user_id })
      .select()
      .single();

    if (newDeck && cards.length > 0) {
      await supabase.from("cards").insert(
        cards.map((c: any) => ({
          deck_id: newDeck.id,
          user_id: userId,
          front: c.front,
          back: c.back,
          tags: c.tags,
        }))
      );
    }
    setImporting(false);
    alert("デッキをコピーしました！");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Back */}
        <Link href="/study/discover" className="text-gray-400 text-sm">
          <i className="fas fa-arrow-left mr-1" /> 公開デッキに戻る
        </Link>

        {/* Deck info */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h1 className="text-lg font-bold">{deck.name}</h1>
          {deck.description && <p className="text-sm text-gray-500 mt-1">{deck.description}</p>}
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
            <span>作成者: {deck.profiles?.display_name || deck.profiles?.username}</span>
            <span>·</span>
            <span>{cards.length}枚</span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <button onClick={toggleLike}
              className={`flex-1 flex items-center justify-center gap-1 rounded-xl py-2 text-sm font-bold cursor-pointer transition ${liked ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              <i className={`fas fa-heart ${liked ? "text-red-500" : ""}`} /> {likeCount}
            </button>
            <button onClick={toggleBookmark}
              className={`flex-1 flex items-center justify-center gap-1 rounded-xl py-2 text-sm font-bold cursor-pointer transition ${bookmarked ? "bg-yellow-50 text-yellow-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              <i className={`fas fa-bookmark ${bookmarked ? "text-yellow-600" : ""}`} />
            </button>
            {!isOwner && (
              <button onClick={importDeck} disabled={importing}
                className="flex-1 bg-primary text-white rounded-xl py-2 text-sm font-bold cursor-pointer hover:bg-primary/90 transition disabled:opacity-50">
                {importing ? "コピー中..." : "自分のデッキに追加"}
              </button>
            )}
          </div>
        </div>

        {/* Cards preview */}
        <div className="bg-white rounded-xl border border-gray-200">
          <button onClick={() => setShowCards(!showCards)}
            className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition">
            <span className="font-bold text-sm">カード一覧（{cards.length}枚）</span>
            <i className={`fas fa-chevron-${showCards ? "up" : "down"} text-gray-400 text-xs`} />
          </button>
          {showCards && (
            <div className="px-4 pb-4 space-y-2">
              {cards.map((card: any) => (
                <div key={card.id} className="border border-gray-100 rounded-lg p-3">
                  <p className="text-sm font-medium">{card.front}</p>
                  <p className="text-xs text-gray-500 mt-1">{card.back}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comments */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-bold text-sm mb-3">コメント（{commentList.length}）</h3>

          <form onSubmit={addComment} className="flex gap-2 mb-4">
            <input value={commentText} onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 rounded-xl border-gray-300 text-sm" placeholder="コメントを書く..." required />
            <button type="submit" disabled={submitting || !commentText.trim()}
              className="bg-primary text-white rounded-xl px-4 text-sm font-bold cursor-pointer hover:bg-primary/90 transition disabled:opacity-50">
              送信
            </button>
          </form>

          <div className="space-y-3">
            {commentList.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">コメントはまだありません</p>
            )}
            {commentList.map((c: any) => (
              <div key={c.id} className="border-b border-gray-100 pb-3 last:border-0">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold">{c.profiles?.display_name || c.profiles?.username}</p>
                    <p className="text-sm mt-0.5">{c.content}</p>
                  </div>
                  {c.user_id === userId && (
                    <button onClick={() => deleteComment(c.id)}
                      className="text-xs text-red-400 cursor-pointer hover:text-red-600">
                      <i className="fas fa-trash" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{new Date(c.created_at).toLocaleString("ja-JP")}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
