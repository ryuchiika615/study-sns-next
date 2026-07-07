"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

const ratings = [
  { value: 0, label: "Again", color: "bg-red-500", short: "もう一度" },
  { value: 1, label: "Hard", color: "bg-orange-500", short: "難しい" },
  { value: 2, label: "Good", color: "bg-green-500", short: "わかった" },
  { value: 3, label: "Easy", color: "bg-blue-500", short: "簡単" },
];

const ratingEmojis = ["🔄", "🤔", "✅", "⚡"];
const ratingColors = ["bg-red-500", "bg-orange-500", "bg-green-500", "bg-blue-500"];

function shuffleArray(arr: number[]): number[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ReviewClient({ deck, cards }: { deck: any; cards: any[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [ratingCounts, setRatingCounts] = useState([0, 0, 0, 0]);
  const [startTime] = useState(Date.now());
  const [lastStreak, setLastStreak] = useState(0);
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [recommendedRating, setRecommendedRating] = useState<number | null>(null);

  const current = cards[index];
  const isMultipleChoice = current?.card_type === "multiple_choice";

  useEffect(() => {
    if (current && isMultipleChoice && current.options?.length) {
      setShuffledIndices(shuffleArray(current.options.map((_: any, i: number) => i)));
      setSelectedAnswer(null);
      setShowFeedback(false);
      setRecommendedRating(null);
      setFlipped(false);
    } else {
      setFlipped(false);
    }
  }, [index, current?.id]);

  const handleRate = useCallback(async (rating: number) => {
    if (!current || submitting) return;
    setSubmitting(true);
    setRatingCounts((prev) => { const next = [...prev]; next[rating]++; return next; });
    const res = await fetch("/api/study/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_id: current.id, rating }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.streak) setLastStreak(data.streak);
    }
    setSubmitting(false);
    setFlipped(false);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setRecommendedRating(null);

    if (index + 1 < cards.length) {
      setIndex((i) => i + 1);
    } else {
      setCompleted(true);
    }
  }, [current, submitting, index, cards.length]);

  const handleSelectOption = (optIdx: number) => {
    if (showFeedback) return;
    const actualIdx = shuffledIndices[optIdx];
    setSelectedAnswer(actualIdx);
    setShowFeedback(true);
    const isCorrect = actualIdx === current.correct_answer;
    setRecommendedRating(isCorrect ? 2 : 0);
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isMultipleChoice && !showFeedback) {
      // 1-4 for options
      const optKeyMap: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3 };
      if (e.key in optKeyMap && current.options?.length) {
        e.preventDefault();
        handleSelectOption(optKeyMap[e.key]);
      }
      return;
    }
    if (isMultipleChoice && showFeedback) {
      const keyMap: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3 };
      if (e.key in keyMap) {
        e.preventDefault();
        handleRate(keyMap[e.key]);
      }
      return;
    }
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
  }, [flipped, handleRate, isMultipleChoice, showFeedback, current]);

  // ----- completed -----
  if (completed) {
    const total = ratingCounts.reduce((a, b) => a + b, 0);
    const elapsed = Math.floor((Date.now() - startTime) / 60000);

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm mx-auto p-6 w-full">
          <div className="text-6xl mb-4">
            {lastStreak >= 7 ? "🔥" : "🎉"}
          </div>
          <h2 className="text-xl font-bold mb-1">学習完了！</h2>
          {lastStreak > 0 && (
            <p className="text-orange-500 font-bold text-sm mb-2">
              <i className="fas fa-fire" /> {lastStreak}日連続！
            </p>
          )}
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-lg font-bold text-primary">{total}</p>
                <p className="text-[10px] text-gray-500">復習したカード</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-lg font-bold text-gray-700">{elapsed}分</p>
                <p className="text-[10px] text-gray-500">所要時間</p>
              </div>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden">
              {ratingCounts.map((count, i) => {
                const pct = total > 0 ? (count / total) * 100 : 0;
                return pct > 0 ? <div key={i} className={ratingColors[i]} style={{ width: `${pct}%` }} /> : null;
              })}
            </div>
            {total > 0 && (
              <div className="flex justify-between text-[10px] text-gray-500">
                {ratings.map((r, i) => (
                  <span key={i}>{r.short}: {ratingCounts[i]}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-center">
            <button onClick={() => router.push(`/study/${deck.id}`)}
              className="bg-gray-200 text-gray-700 rounded-full px-6 py-2 text-sm font-bold cursor-pointer hover:bg-gray-300 transition">
              デッキに戻る
            </button>
            <button onClick={() => { setIndex(0); setFlipped(false); setCompleted(false); setRatingCounts([0, 0, 0, 0]); }}
              className="bg-primary text-white rounded-full px-6 py-2 text-sm font-bold cursor-pointer hover:bg-primary/90 transition">
              続ける
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
      <div className="h-1 bg-gray-200">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full p-4">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
          <span>{deck.name}</span>
          <span>{index + 1} / {cards.length}</span>
        </div>

        {isMultipleChoice ? (
          <>
            {/* Question */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
              <p className="text-sm text-gray-400 mb-3">問題</p>
              <p className="text-xl font-medium whitespace-pre-wrap mb-4">{current.front}</p>

              {/* Options */}
              <div className="space-y-2">
                {shuffledIndices.map((_, optIdx) => {
                  const actualIdx = shuffledIndices[optIdx];
                  const label = String.fromCharCode(65 + optIdx); // A, B, C, D
                  const optionText = current.options[actualIdx];
                  const isSelected = showFeedback && selectedAnswer === actualIdx;
                  const isCorrectOption = current.correct_answer === actualIdx;
                  let btnClass = "w-full text-left rounded-xl border px-4 py-3 text-sm font-medium transition cursor-pointer ";
                  if (!showFeedback) {
                    btnClass += "border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300";
                  } else if (isCorrectOption) {
                    btnClass += "border-green-500 bg-green-50 text-green-800";
                  } else if (isSelected) {
                    btnClass += "border-red-500 bg-red-50 text-red-800";
                  } else {
                    btnClass += "border-gray-200 bg-gray-50 text-gray-400";
                  }
                  return (
                    <button key={optIdx} onClick={() => handleSelectOption(optIdx)}
                      disabled={showFeedback}
                      className={btnClass}>
                      <span className="font-bold mr-2">{label}.</span> {optionText}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Feedback */}
            {showFeedback && (
              <>
                <div className={`text-center font-bold text-sm mb-3 ${selectedAnswer === current.correct_answer ? "text-green-600" : "text-red-600"}`}>
                  {selectedAnswer === current.correct_answer ? "正解！" : "不正解"}
                  {selectedAnswer !== current.correct_answer && (
                    <span className="text-gray-500 font-normal ml-1">正解: {current.options[current.correct_answer]}</span>
                  )}
                </div>

                {/* Rating buttons */}
                <div className="grid grid-cols-4 gap-2">
                  {ratings.map((r) => {
                    const isRecommended = recommendedRating === r.value;
                    return (
                      <button
                        key={r.value}
                        onClick={() => handleRate(r.value)}
                        disabled={submitting}
                        className={`${r.color} text-white font-bold rounded-xl py-3 text-xs cursor-pointer hover:opacity-90 transition disabled:opacity-50 ${isRecommended ? "ring-2 ring-white ring-offset-2" : ""}`}
                      >
                        <div>{r.short}</div>
                        <div className="text-[10px] opacity-75">({r.value + 1})</div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {/* Basic card: front/back flip */}
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
          </>
        )}

        <p className="text-[10px] text-gray-400 text-center mt-3">
          {!isMultipleChoice ? (!flipped ? "Space / Enter" : "1 2 3 4")
            : !showFeedback ? "1 2 3 4 で選択" : "1 2 3 4 で評価"}
        </p>
      </div>
    </div>
  );
}
