"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function StudyClient({
  initialDecks,
  initialStats,
  initialStreak,
  isPro,
}: {
  initialDecks: any[];
  initialStats: { total_cards: number; total_reviews: number; today_reviews: number };
  initialStreak: { current_streak: number; longest_streak: number; last_study_date: string | null };
  isPro: boolean;
}) {
  const [decks, setDecks] = useState(initialDecks);
  const [stats] = useState(initialStats);
  const [streak] = useState(initialStreak);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const totalDue = decks.reduce((sum: number, d: any) => sum + (d.due_count || 0), 0);
  const newCards = stats.total_cards - initialStats.total_reviews;
  const dueDeck = decks.find((d: any) => (d.due_count || 0) > 0);
  const firstDeckWithCards = decks.find((d: any) => (d.card_count || 0) > 0);
  const nextAction = dueDeck
    ? { href: `/study/${dueDeck.id}/review`, label: `「${dueDeck.name}」を復習する`, detail: `復習待ち ${dueDeck.due_count}枚` }
    : firstDeckWithCards
      ? { href: `/study/${firstDeckWithCards.id}/quiz`, label: `「${firstDeckWithCards.name}」を5問テスト`, detail: "まずは短く定着チェック" }
      : null;

  // Group decks by whether they have parent_id
  const rootDecks = decks.filter((d: any) => !d.parent_id);
  const childDecks = decks.filter((d: any) => d.parent_id);
  const getChildren = (parentId: string) => childDecks.filter((d: any) => d.parent_id === parentId);

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

  const renderDeck = (deck: any) => (
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
        <div className="flex items-center gap-1.5">
          {deck.card_count > 0 && (
            <>
              <Link href={`/study/${deck.id}/review`}
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] bg-white border border-primary text-primary rounded-full px-2.5 py-1 font-bold cursor-pointer hover:bg-primary/5 transition whitespace-nowrap">
                練習
              </Link>
              <Link href={`/study/${deck.id}/quiz`}
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] bg-primary text-white rounded-full px-2.5 py-1 font-bold cursor-pointer hover:bg-primary/90 transition whitespace-nowrap">
                テスト
              </Link>
            </>
          )}
          <button onClick={(e) => handleDelete(deck.id, e)}
            className="text-xs text-red-400 cursor-pointer hover:text-red-600 ml-1">
            <i className="fas fa-trash" />
          </button>
        </div>
      </div>
      {getChildren(deck.id).length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          {getChildren(deck.id).map(renderDeck)}
        </div>
      )}
    </Link>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Header with streak */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">学習</h1>
              {streak.current_streak > 0 && (
                <span className="flex items-center gap-1 text-sm font-bold text-orange-500">
                  <i className="fas fa-fire" /> {streak.current_streak}日連続
                </span>
              )}
            </div>
            <Link href="/study/stats"
              className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-full px-3 py-1.5 transition cursor-pointer">
              <i className="fas fa-chart-line" /> 学習履歴を見る
            </Link>
          </div>
          <div className="flex gap-4 text-sm">
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

        {/* Free daily learning route */}
        <section className="overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50 shadow-sm">
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900"><i className="fas fa-bullseye mr-1.5 text-sky-500" />今日の学習ルート</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">迷ったら、まず5分。この順番で進めればOKです。</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">無料</span>
            </div>

            {nextAction ? (
              <Link href={nextAction.href} className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white p-3 no-underline shadow-sm ring-1 ring-sky-100 transition hover:-translate-y-0.5 hover:shadow">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-sky-700">STEP 1　今日の一歩</p>
                  <p className="mt-0.5 truncate text-sm font-bold text-slate-900">{nextAction.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{nextAction.detail}</p>
                </div>
                <span className="shrink-0 rounded-full bg-sky-500 px-3 py-2 text-xs font-bold text-white">始める <i className="fas fa-arrow-right ml-1" /></span>
              </Link>
            ) : (
              <button onClick={() => setShowCreate(true)} className="mt-3 flex w-full items-center justify-between rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-sky-100 transition hover:shadow">
                <span><span className="block text-xs font-bold text-sky-700">STEP 1　最初の準備</span><span className="mt-0.5 block text-sm font-bold text-slate-900">覚えたいことをデッキに追加しよう</span></span>
                <span className="rounded-full bg-sky-500 px-3 py-2 text-xs font-bold text-white">作る</span>
              </button>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-white/80 px-3 py-2 text-slate-600"><span className="font-bold text-slate-900">STEP 2</span>　終わったら記録<br /><span className="text-[11px]">今日 {stats.today_reviews}枚を復習済み</span></div>
              <Link href="/study/discover" className="rounded-lg bg-white/80 px-3 py-2 text-slate-600 no-underline transition hover:bg-white"><span className="font-bold text-slate-900">STEP 3</span>　公開デッキも使う<br /><span className="text-[11px]">みんなの教材を探す</span></Link>
            </div>
          </div>

          {isPro ? (
            <div className="flex flex-col gap-2 border-t border-purple-100 bg-purple-50 px-4 py-3 sm:flex-row">
              <Link href="/pro/planner" className="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-center text-xs font-bold text-white no-underline">🎯 試験逆算プランを開く</Link>
              <Link href="/study/stats" className="flex-1 rounded-lg border border-purple-200 bg-white px-3 py-2 text-center text-xs font-bold text-purple-700 no-underline">📈 詳細な学習分析を見る</Link>
            </div>
          ) : (
            <Link href="/pro?from=study-route" className="flex items-center justify-between gap-3 border-t border-purple-100 bg-purple-50 px-4 py-3 no-underline transition hover:bg-purple-100">
              <span><span className="block text-xs font-bold text-purple-900">🔒 Proで、次の学習をもっと計画的に</span><span className="mt-0.5 block text-[11px] text-purple-700">試験逆算プラン・長期の定着分析・復習予測を使えます</span></span>
              <span className="shrink-0 text-xs font-bold text-purple-700">Proを見る <i className="fas fa-chevron-right ml-1" /></span>
            </Link>
          )}
        </section>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button onClick={() => setShowCreate(!showCreate)}
            className="flex-1 bg-primary text-white font-bold rounded-xl py-3 text-sm cursor-pointer hover:bg-primary/90 transition">
            + デッキを作成
          </button>
          <Link href="/study/discover"
            className="flex-1 bg-purple-600 text-white font-bold rounded-xl py-3 text-sm text-center cursor-pointer hover:bg-purple-700 transition">
            <i className="fas fa-globe mr-1" /> 公開デッキ
          </Link>
        </div>

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
          {rootDecks.length === 0 && childDecks.length > 0 && (
            <p className="text-xs text-gray-400 mb-2">サブデッキ（フォルダ未所属）</p>
          )}
          {rootDecks.length === 0 ? childDecks.map(renderDeck) : rootDecks.map(renderDeck)}
        </div>
      </div>
    </div>
  );
}
