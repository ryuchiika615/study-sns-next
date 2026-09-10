"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { officialToeicDeck } from "@/lib/official-toeic-800";

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
  const [importingOfficial, setImportingOfficial] = useState(false);

  const categoryFor = (deck: any) => {
    const text = `${deck.name} ${deck.description || ""}`.toLowerCase();
    if (/toeic|英語|english|ielts|語彙/.test(text)) return "英語・資格";
    if (/spi|就活|面接|企業/.test(text)) return "就活・キャリア";
    if (/it|program|code|開発/.test(text)) return "IT・プログラミング";
    return "みんなのデッキ";
  };
  const communityByCategory = decks.reduce((groups: Record<string, any[]>, deck: any) => {
    const category = categoryFor(deck);
    (groups[category] ||= []).push(deck);
    return groups;
  }, {});

  const importOfficial = async () => {
    setImportingOfficial(true);
    const res = await fetch("/api/study/official-decks/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deckId: officialToeicDeck.id }) });
    const data = await res.json().catch(() => ({}));
    setImportingOfficial(false);
    if (!res.ok) return alert(data.error || "ダウンロードに失敗しました");
    router.push(`/study/${data.deckId}`);
  };

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

        <div>
          <h1 className="text-lg font-bold">公開デッキ</h1>
          <p className="mt-1 text-xs text-gray-500">カテゴリーから選んで、必要なデッキだけ自分のデッキへ追加できます。</p>
        </div>

        <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-bold text-indigo-700">{officialToeicDeck.category}</span><h2 className="mt-2 text-base font-black text-slate-900">{officialToeicDeck.name}</h2><p className="mt-1 text-xs leading-5 text-slate-600">{officialToeicDeck.description}</p></div><i className="fas fa-language mt-1 text-2xl text-indigo-500" /></div>
          <button onClick={importOfficial} disabled={importingOfficial} className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60">{importingOfficial ? "追加中..." : `↓ 自分のデッキに追加（${officialToeicDeck.cardCount}枚）`}</button>
        </section>

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

        {/* Community decks by category */}
        <div className="space-y-5">
          {decks.length === 0 && (
            <p className="text-center text-gray-400 py-4 text-sm">ほかの公開デッキはまだありません</p>
          )}
          {Object.entries(communityByCategory).map(([category, categoryDecks]) => <section key={category}><h2 className="mb-2 text-xs font-black tracking-wide text-slate-500"><i className="fas fa-folder-open mr-1 text-indigo-400" />{category}</h2><div className="space-y-2">{categoryDecks.map((deck: any) => (
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
          ))}</div></section>)}
        </div>
      </div>
    </div>
  );
}
