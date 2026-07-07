"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function StudyClient({
  initialDecks,
  initialStats,
}: {
  initialDecks: any[];
  initialStats: { total_cards: number; total_reviews: number; today_reviews: number };
}) {
  const [decks, setDecks] = useState(initialDecks);
  const [stats] = useState(initialStats);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const totalDue = decks.reduce((sum: number, d: any) => sum + (d.due_count || 0), 0);
  const newCards = stats.total_cards - initialStats.total_reviews;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    const res = await fetch("/api/study/decks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
    });
    setCreating(false);
    if (res.ok) {
      const data = await res.json();
      setDecks((prev) => [...prev, { ...data.deck, card_count: 0, due_count: 0 }]);
      setName("");
      setDescription("");
      setShowCreate(false);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "作成失敗");
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("デッキと全てのカードを削除しますか？")) return;
    const res = await fetch("/api/study/decks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setDecks((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h1 className="text-lg font-bold">学習</h1>
          <div className="flex gap-4 mt-3 text-sm">
            <div className="flex-1 text-center">
              <p className="text-2xl font-bold text-primary">{stats.today_reviews}</p>
              <p className="text-xs text-gray-500">今日の復習</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-2xl font-bold text-green-500">{totalDue}</p>
              <p className="text-xs text-gray-500">復習待ち</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-2xl font-bold text-purple-500">{newCards}</p>
              <p className="text-xs text-gray-500">未学習</p>
            </div>
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

        {/* Create deck button */}
        <button onClick={() => setShowCreate(!showCreate)}
          className="w-full bg-primary text-white font-bold rounded-xl py-3 text-sm cursor-pointer hover:bg-primary/90 transition">
          + デッキを作成
        </button>

        {showCreate && (
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm" placeholder="デッキ名" required />
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm" placeholder="説明（任意）" />
            <button type="submit" disabled={creating}
              className="w-full bg-primary text-white font-bold rounded-full py-2 text-sm disabled:opacity-50 cursor-pointer">
              {creating ? "作成中..." : "作成"}
            </button>
          </form>
        )}

        {/* Deck list */}
        <div className="space-y-2">
          {decks.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">デッキがありません。新しいデッキを作成しましょう。</p>
          )}
          {decks.map((deck: any) => (
            <Link key={deck.id} href={`/study/${deck.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm">{deck.name}</h3>
                  {deck.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{deck.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    カード {deck.card_count}枚
                    {deck.due_count > 0 && (
                      <span className="text-green-500 font-bold ml-2">復習 {deck.due_count}枚</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {deck.card_count > 0 && (
                    <Link href={`/study/${deck.id}/review`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs bg-primary text-white rounded-full px-3 py-1.5 font-bold cursor-pointer hover:bg-primary/90 transition whitespace-nowrap">
                      学習
                    </Link>
                  )}
                  <button onClick={(e) => handleDelete(deck.id, e)}
                    className="text-xs text-red-400 cursor-pointer hover:text-red-600">
                    <i className="fas fa-trash" />
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
