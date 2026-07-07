"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const ratings = [
  { value: 0, label: "Again", color: "bg-red-500", short: "もう一度" },
  { value: 1, label: "Hard", color: "bg-orange-500", short: "難しい" },
  { value: 2, label: "Good", color: "bg-green-500", short: "わかった" },
  { value: 3, label: "Easy", color: "bg-blue-500", short: "簡単" },
];

export default function ReviewClient({ deck, cards }: { deck: any; cards: any[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  const current = cards[index];

  const handleRate = useCallback(async (rating: number) => {
    if (!current || submitting) return;
    setSubmitting(true);
    await fetch("/api/study/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_id: current.id, rating }),
    });
    setSubmitting(false);
    setReviewed((r) => r + 1);
    setFlipped(false);

    if (index + 1 < cards.length) {
      setIndex((i) => i + 1);
    } else {
      setCompleted(true);
    }
  }, [current, submitting, index, cards.length]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!flipped) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped(true);
      }
      return;
    }
    const keyMap: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3 };
    if (e.key in keyMap) {
      e.preventDefault();
      handleRate(keyMap[e.key]);
    }
  }, [flipped, handleRate]);

  if (completed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm mx-auto p-4">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-xl font-bold mb-2">学習完了！</h2>
          <p className="text-gray-500 mb-2">{cards.length}枚中 {reviewed}枚を復習しました</p>
          <p className="text-sm text-gray-400 mb-6">お疲れ様でした</p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => router.push(`/study/${deck.id}`)}
              className="bg-gray-200 text-gray-700 rounded-full px-6 py-2 text-sm font-bold cursor-pointer hover:bg-gray-300 transition">
              デッキに戻る
            </button>
            <button onClick={() => { setIndex(0); setFlipped(false); setCompleted(false); setReviewed(0); }}
              className="bg-primary text-white rounded-full px-6 py-2 text-sm font-bold cursor-pointer hover:bg-primary/90 transition">
              続けて学習
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-4">カードがありません</p>
          <button onClick={() => router.push(`/study/${deck.id}`)}
            className="text-primary text-sm cursor-pointer">
            デッキに戻る
          </button>
        </div>
      </div>
    );
  }

  const progress = ((index) / cards.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" tabIndex={0} onKeyDown={handleKeyDown}>
      {/* Progress bar */}
      <div className="h-1 bg-gray-200">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full p-4">
        {/* Header info */}
        <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
          <span>{deck.name}</span>
          <span>{index + 1} / {cards.length}</span>
        </div>

        {/* Card */}
        <div
          className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center justify-center cursor-pointer p-6 mb-4 hover:shadow-md transition"
          onClick={() => !flipped && setFlipped(true)}
          style={{ minHeight: "300px" }}
        >
          <div className="text-center w-full">
            {!flipped ? (
              <div>
                <p className="text-sm text-gray-400 mb-3">問題</p>
                <p className="text-xl font-medium whitespace-pre-wrap">{current.front}</p>
                <p className="text-xs text-gray-400 mt-6">タップするかスペースキーで答えを表示</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-400 mb-3">答え</p>
                <p className="text-xl whitespace-pre-wrap">{current.back}</p>
                {current.tags?.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1 mt-4">
                    {current.tags.map((tag: string, i: number) => (
                      <span key={i} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Rating buttons */}
        {flipped && (
          <div className="grid grid-cols-4 gap-2">
            {ratings.map((r) => (
              <button
                key={r.value}
                onClick={() => handleRate(r.value)}
                disabled={submitting}
                className={`${r.color} text-white font-bold rounded-xl py-3 text-xs cursor-pointer hover:opacity-90 transition disabled:opacity-50`}
              >
                <div>{r.short}</div>
                <div className="text-[10px] opacity-75">({r.value + 1})</div>
              </button>
            ))}
          </div>
        )}

        {/* Keyboard hints */}
        <p className="text-[10px] text-gray-400 text-center mt-3">
          {!flipped ? "Space / Enter" : "1 2 3 4"}
        </p>
      </div>
    </div>
  );
}
