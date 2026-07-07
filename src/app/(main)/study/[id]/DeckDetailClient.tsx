"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DeckDetailClient({
  deck,
  initialCards,
}: {
  deck: any;
  initialCards: any[];
}) {
  const router = useRouter();
  const [cards, setCards] = useState(initialCards);
  const [showCreate, setShowCreate] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [flippedId, setFlippedId] = useState<string | null>(null);

  const dueCount = cards.filter((c) => {
    if (!c.review_state) return true;
    return c.review_state.due_date <= new Date().toISOString().split("T")[0];
  }).length;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    setCreating(true);
    setError("");
    const res = await fetch("/api/study/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deck_id: deck.id,
        front: front.trim(),
        back: back.trim(),
        tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      }),
    });
    setCreating(false);
    if (res.ok) {
      const data = await res.json();
      setCards((prev) => [data.card, ...prev]);
      setFront("");
      setBack("");
      setTags("");
      setShowCreate(false);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "作成失敗");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このカードを削除しますか？")) return;
    const res = await fetch("/api/study/cards", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setCards((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <Link href="/study" className="text-gray-400 text-sm">
              <i className="fas fa-arrow-left mr-1" /> 戻る
            </Link>
            {cards.length > 0 && (
              <Link href={`/study/${deck.id}/review`}
                className="bg-primary text-white text-sm font-bold rounded-full px-4 py-1.5 cursor-pointer hover:bg-primary/90 transition">
                学習を開始
              </Link>
            )}
          </div>
          <h1 className="text-lg font-bold">{deck.name}</h1>
          {deck.description && <p className="text-xs text-gray-500">{deck.description}</p>}
          <p className="text-xs text-gray-400 mt-1">カード {cards.length}枚</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

        {/* Create card button */}
        <button onClick={() => setShowCreate(!showCreate)}
          className="w-full bg-primary text-white font-bold rounded-xl py-3 text-sm cursor-pointer hover:bg-primary/90 transition">
          + カードを追加
        </button>

        {showCreate && (
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">表面（問題）</label>
              <textarea value={front} onChange={(e) => setFront(e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm" rows={3} required />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">裏面（答え）</label>
              <textarea value={back} onChange={(e) => setBack(e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm" rows={3} required />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">タグ（カンマ区切り、任意）</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm" placeholder="例: 数学, 代数" />
            </div>
            <button type="submit" disabled={creating}
              className="w-full bg-primary text-white font-bold rounded-full py-2 text-sm disabled:opacity-50 cursor-pointer">
              {creating ? "作成中..." : "追加"}
            </button>
          </form>
        )}

        {/* Card list */}
        <div className="space-y-2">
          {cards.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">カードがありません。最初のカードを作成しましょう。</p>
          )}
          {cards.map((card: any) => (
            <div key={card.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition"
              onClick={() => setFlippedId(flippedId === card.id ? null : card.id)}>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium whitespace-pre-wrap">{card.front}</p>
                    {flippedId === card.id && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{card.back}</p>
                        {card.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {card.tags.map((tag: string, i: number) => (
                              <span key={i} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(card.id); }}
                    className="text-xs text-red-400 cursor-pointer hover:text-red-600 ml-2 flex-shrink-0">
                    <i className="fas fa-trash" />
                  </button>
                </div>
                {!flippedId && (
                  <p className="text-[10px] text-gray-400 mt-2">タップして答えを表示</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
