"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DiscoverClient({
  initialDecks,
  userId,
}: {
  initialDecks: any[];
  userId: string;
}) {
  const router = useRouter();
  const [decks, setDecks] = useState(initialDecks);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "popular">("popular");
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    const params = new URLSearchParams({ q: search, sort });
    const res = await fetch(`/api/study/discover?${params}`);
    if (res.ok) {
      const data = await res.json();
      setDecks(data.decks);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Link href="/study" className="text-gray-400 text-sm"><i className="fas fa-arrow-left mr-1" />戻る</Link>

        <h1 className="text-lg font-bold">公開デッキ</h1>

        {/* Search */}
        <div className="flex gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1 rounded-xl border-gray-300 text-sm" placeholder="デッキを検索..." />
          <button onClick={handleSearch} disabled={loading}
            className="bg-primary text-white rounded-xl px-4 text-sm cursor-pointer hover:bg-primary/90 transition disabled:opacity-50">
            <i className="fas fa-search" />
          </button>
        </div>

        {/* Sort tabs */}
        <div className="flex gap-2 text-sm">
          <button onClick={() => { setSort("popular"); handleSearch(); }}
            className={`px-3 py-1.5 rounded-full font-bold cursor-pointer transition ${sort === "popular" ? "bg-primary text-white" : "bg-gray-200 text-gray-600"}`}>
            人気順
          </button>
          <button onClick={() => { setSort("newest"); handleSearch(); }}
            className={`px-3 py-1.5 rounded-full font-bold cursor-pointer transition ${sort === "newest" ? "bg-primary text-white" : "bg-gray-200 text-gray-600"}`}>
            新着順
          </button>
        </div>

        {/* Deck list */}
        <div className="space-y-2">
          {decks.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">公開デッキがまだありません</p>
          )}
          {decks.map((deck: any) => (
            <Link key={deck.id} href={`/study/discover/${deck.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm">{deck.name}</h3>
                  {deck.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{deck.description}</p>}
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                    <span>{deck.profiles?.display_name || deck.profiles?.username}</span>
                    <span>·</span>
                    <span>{deck.card_count}枚</span>
                    <span>·</span>
                    <span><i className="fas fa-heart mr-0.5" />{deck.like_count}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
