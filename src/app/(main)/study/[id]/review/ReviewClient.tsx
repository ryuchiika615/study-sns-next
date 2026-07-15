"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

const ratings = [
  { value: 0, label: "Again", color: "bg-red-500", short: "もう一度" },
  { value: 1, label: "Hard", color: "bg-orange-500", short: "難しい" },
  { value: 2, label: "Good", color: "bg-green-500", short: "わかった" },
  { value: 3, label: "Easy", color: "bg-blue-500", short: "簡単" },
];

const ratingColors = ["bg-red-500", "bg-orange-500", "bg-green-500", "bg-blue-500"];

function shuffleArray(arr: number[]): number[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function extractBlanks(text: string): string[] {
  return [...text.matchAll(/［(.+?)］/g)].map(m => m[1]);
}

const blankLabels = ["ア", "イ", "ウ", "エ", "オ", "カ", "キ", "ク", "ケ", "コ"];

export default function ReviewClient({ deck, cards }: { deck: any; cards: any[] }) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [sessionCards, setSessionCards] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [ratingCounts, setRatingCounts] = useState([0, 0, 0, 0]);
  const [startTime, setStartTime] = useState(Date.now());
  const [lastStreak, setLastStreak] = useState(0);
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [recommendedRating, setRecommendedRating] = useState<number | null>(null);
  const [seqOrder, setSeqOrder] = useState<number[]>([]);
  const [seqSubmitted, setSeqSubmitted] = useState(false);
  const [seqResults, setSeqResults] = useState<boolean[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [quitConfirm, setQuitConfirm] = useState(false);

  const current = sessionCards[index];
  const isMultipleChoice = current?.card_type === "multiple_choice";
  const isSequence = current?.card_type === "sequence";
  const blanks = isSequence ? extractBlanks(current?.front || "") : [];

  useEffect(() => {
    if (current) {
      if (isMultipleChoice && current.options?.length) {
        setShuffledIndices(shuffleArray(current.options.map((_: any, i: number) => i)));
      }
      setSelectedAnswer(null);
      setShowFeedback(false);
      setRecommendedRating(null);
      setFlipped(false);
      setShowAnswer(false);
      setSeqOrder([]);
      setSeqSubmitted(false);
      setSeqResults([]);
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
    setSeqSubmitted(false);
    setSeqResults([]);
    setShowAnswer(false);

    if (index + 1 < sessionCards.length) {
      setIndex((i) => i + 1);
    } else {
      setCompleted(true);
    }
  }, [current, submitting, index, sessionCards.length]);

  const handleSelectOption = (optIdx: number) => {
    if (showFeedback) return;
    const actualIdx = shuffledIndices[optIdx];
    setSelectedAnswer(actualIdx);
    setShowFeedback(true);
    const isCorrect = actualIdx === current.correct_answer;
    setRecommendedRating(isCorrect ? 2 : 0);
  };

  const handleSeqSelectOption = (optIdx: number) => {
    if (seqSubmitted) return;
    if (seqOrder.length >= blanks.length) return;
    setSeqOrder([...seqOrder, optIdx]);
  };

  const handleUndoSeq = () => {
    if (seqOrder.length === 0) return;
    setSeqOrder(seqOrder.slice(0, -1));
  };

  const handleSubmitSequence = () => {
    const correctMap = current.correct_mapping || {};
    const results = blanks.map((b, i) => seqOrder[i] === correctMap[b]);
    setSeqResults(results);
    setSeqSubmitted(true);
    setRecommendedRating(results.every(Boolean) ? 2 : 0);
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isMultipleChoice && !showFeedback) {
      const optKeyMap: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3 };
      if (e.key in optKeyMap && current.options?.length) {
        e.preventDefault();
        handleSelectOption(optKeyMap[e.key]);
      }
      return;
    }
    if ((isMultipleChoice && showFeedback) || (isSequence && seqSubmitted)) {
      const keyMap: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3 };
      if (e.key in keyMap) {
        e.preventDefault();
        handleRate(keyMap[e.key]);
      }
      return;
    }
    if (isSequence && !seqSubmitted) {
      const optKeyMap: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3 };
      if (e.key in optKeyMap && current.options?.length) {
        e.preventDefault();
        handleSeqSelectOption(optKeyMap[e.key]);
        return;
      }
      if (e.key === "Enter" && seqOrder.length === blanks.length) {
        e.preventDefault();
        handleSubmitSequence();
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        handleUndoSeq();
        return;
      }
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
  }, [flipped, handleRate, isMultipleChoice, isSequence, showFeedback, seqSubmitted, seqOrder, blanks, current]);

  const handleStart = (count: number) => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    const selected = count === 0 ? shuffled : shuffled.slice(0, count);
    setSessionCards(selected);
    setStartTime(Date.now());
    setStarted(true);
  };

  const handleQuit = () => {
    router.push(`/study/${deck.id}`);
  };

  if (!started) {
    const total = cards.length;
    const options = [
      { label: "10問", value: 10 },
      { label: "20問", value: 20 },
      { label: "30問", value: 30 },
      { label: "全て", value: 0 },
    ].filter(o => o.value === 0 || o.value <= total);

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 max-w-sm w-full mx-4 text-center space-y-4">
          <div className="text-4xl">📚</div>
          <h2 className="text-lg font-bold">{deck.name}</h2>
          <p className="text-sm text-gray-500">全{total}枚のカード</p>
          <div className="space-y-2">
            <p className="text-xs text-gray-400">何問解答しますか？</p>
            <div className="grid grid-cols-2 gap-2">
              {options.map((o) => (
                <button key={o.value} onClick={() => handleStart(o.value)}
                  className="bg-primary text-white font-bold rounded-xl py-3 text-sm hover:bg-primary/90 transition cursor-pointer">
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleQuit}
            className="text-gray-400 text-xs cursor-pointer hover:text-gray-600">
            キャンセル
          </button>
        </div>
      </div>
    );
  }

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
              className="bg-white text-gray-800 border border-gray-300 rounded-full px-6 py-2 text-sm font-bold cursor-pointer hover:bg-gray-50 transition">
              デッキに戻る
            </button>
            <button onClick={() => { setStarted(false); setIndex(0); setFlipped(false); setCompleted(false); setRatingCounts([0, 0, 0, 0]); setSessionCards([]); }}
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

  const progress = ((index) / sessionCards.length) * 100;

  const renderSequenceQuestion = () => {
    if (!current.front) return null;
    const parts = current.front.split(/(［.+?］)/g);
    let blankIdx = -1;
    return parts.map((part: string, i: number) => {
      const match = part.match(/［(.+?)］/);
      if (!match) return <span key={i}>{part}</span>;
      blankIdx++;
      const blank = match[1];
      const isFilled = seqOrder.length > blankIdx;
      const selectedOpt = isFilled ? seqOrder[blankIdx] : null;
      const isActive = seqOrder.length === blankIdx && !seqSubmitted;
      const isCorrect = seqSubmitted ? seqResults[blankIdx] : null;

      let boxClass = "inline-flex items-center justify-center min-w-[2.5rem] h-8 px-1.5 rounded-lg font-bold text-sm border-2 mx-0.5 ";
      if (seqSubmitted) {
        boxClass += isCorrect ? "border-green-500 bg-green-50 text-green-700" : "border-red-500 bg-red-50 text-red-700";
      } else if (isFilled) {
        boxClass += "border-primary bg-primary/10 text-primary";
      } else if (isActive) {
        boxClass += "border-orange-400 bg-orange-50 text-orange-500 animate-pulse";
      } else {
        boxClass += "border-dashed border-gray-300 text-gray-400";
      }

      return (
        <span key={i} className="inline-flex items-center mx-0.5">
          <span className={boxClass}>
            {isFilled ? String.fromCharCode(65 + selectedOpt!) : blank}
          </span>
          {seqSubmitted && !isCorrect && (
            <span className="text-[10px] text-green-600 font-bold ml-0.5">
              ({String.fromCharCode(65 + (current.correct_mapping?.[blank] ?? 0))})
            </span>
          )}
        </span>
      );
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" tabIndex={0} onKeyDown={handleKeyDown}>
      <div className="h-1 bg-gray-200">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {quitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full mx-4 text-center space-y-4">
            <p className="font-bold text-sm">学習を終了しますか？</p>
            <p className="text-xs text-gray-500">途中経過は保存されません</p>
            <div className="flex gap-2">
              <button onClick={() => setQuitConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-600 font-bold rounded-xl py-2 text-sm cursor-pointer">
                続ける
              </button>
              <button onClick={handleQuit}
                className="flex-1 bg-red-500 text-white font-bold rounded-xl py-2 text-sm cursor-pointer">
                終了する
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full p-4">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
          <span>{deck.name}</span>
          <div className="flex items-center gap-3">
            <span>{index + 1} / {sessionCards.length}</span>
            <button onClick={() => setQuitConfirm(true)}
              className="text-gray-400 hover:text-red-500 cursor-pointer">
              <i className="fas fa-times" />
            </button>
          </div>
        </div>

        {isMultipleChoice ? (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
              <p className="text-sm text-gray-400 mb-3">問題</p>
              <p className={`text-xl font-medium whitespace-pre-wrap mb-4 ${current.text_color || ""}`}>{current.front}</p>
              <div className="space-y-2">
                {shuffledIndices.map((_, optIdx) => {
                  const actualIdx = shuffledIndices[optIdx];
                  const label = String.fromCharCode(65 + optIdx);
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
            {showFeedback && (
              <>
                <div className={`text-center font-bold text-sm mb-3 ${selectedAnswer === current.correct_answer ? "text-green-600" : "text-red-600"}`}>
                  {selectedAnswer === current.correct_answer ? "正解！" : "不正解"}
                  {selectedAnswer !== current.correct_answer && (
                    <span className="text-gray-500 font-normal ml-1">正解: {current.options[current.correct_answer]}</span>
                  )}
                </div>
                {current.back && (
                  <div className="text-center mb-3">
                    <button onClick={() => setShowAnswer(!showAnswer)}
                      className="text-xs text-primary font-bold cursor-pointer hover:underline">
                      <i className={`fas fa-chevron-${showAnswer ? "up" : "down"} mr-1`} />
                      {showAnswer ? "答えを隠す" : "答えを表示"}
                    </button>
                    {showAnswer && (
                      <div className={`mt-2 bg-blue-50 rounded-lg p-3 text-sm text-left whitespace-pre-wrap ${current.text_color || ""}`}>
                        {current.back}
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-4 gap-2">
                  {ratings.map((r) => {
                    const isRecommended = recommendedRating === r.value;
                    return (
                      <button key={r.value} onClick={() => handleRate(r.value)} disabled={submitting}
                        className={`${r.color} text-white font-bold rounded-xl py-3 text-xs cursor-pointer hover:opacity-90 transition disabled:opacity-50 ${isRecommended ? "ring-2 ring-white ring-offset-2" : ""}`}>
                        <div>{r.short}</div>
                        <div className="text-[10px] opacity-75">({r.value + 1})</div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        ) : isSequence ? (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
              <p className="text-sm text-gray-400 mb-3">正解だと思う順番に選択肢をタップ</p>
              <div className="text-lg font-medium leading-relaxed whitespace-pre-wrap">
                {renderSequenceQuestion()}
              </div>
              {!seqSubmitted && seqOrder.length > 0 && (
                <div className="text-center mt-2">
                  <button onClick={handleUndoSeq}
                    className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                    <i className="fas fa-undo mr-1" />一つ戻す
                  </button>
                  <span className="text-xs text-gray-400 ml-3">
                    {seqOrder.length}/{blanks.length}
                  </span>
                </div>
              )}
            </div>

            {/* Options buttons */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {current.options?.map((opt: string, i: number) => {
                const isUsed = seqOrder.includes(i);
                const isNext = seqOrder.length === blanks.length ? false : true;
                let btnClass = "rounded-xl border px-4 py-3 text-sm font-medium text-left transition cursor-pointer ";
                if (seqSubmitted) {
                  btnClass += "border-gray-200 bg-gray-50 text-gray-400";
                } else if (isUsed) {
                  btnClass += "border-gray-200 bg-gray-100 text-gray-400";
                } else {
                  btnClass += "border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300";
                }
                return (
                  <button key={i} onClick={() => handleSeqSelectOption(i)}
                    disabled={isUsed || seqSubmitted}
                    className={btnClass}>
                    <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span> {opt}
                  </button>
                );
              })}
            </div>

            {!seqSubmitted ? (
              <button onClick={handleSubmitSequence}
                disabled={seqOrder.length !== blanks.length}
                className="w-full bg-primary text-white font-bold rounded-full py-3 text-sm disabled:opacity-40 cursor-pointer hover:bg-primary/90 transition">
                {seqOrder.length !== blanks.length ? `あと${blanks.length - seqOrder.length}個選択` : "回答を確認"}
              </button>
            ) : (
              <>
                <div className={`text-center font-bold text-sm mb-3 ${seqResults.every(Boolean) ? "text-green-600" : "text-red-600"}`}>
                  {seqResults.every(Boolean) ? "全問正解！" : "間違いがあります"}
                </div>
                {current.back && (
                  <div className="text-center mb-3">
                    <button onClick={() => setShowAnswer(!showAnswer)}
                      className="text-xs text-primary font-bold cursor-pointer hover:underline">
                      <i className={`fas fa-chevron-${showAnswer ? "up" : "down"} mr-1`} />
                      {showAnswer ? "完成文を隠す" : "完成文を表示"}
                    </button>
                    {showAnswer && (
                      <div className={`mt-2 bg-blue-50 rounded-lg p-3 text-sm text-left whitespace-pre-wrap ${current.text_color || ""}`}>
                        {current.back}
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-4 gap-2">
                  {ratings.map((r) => {
                    const isRecommended = recommendedRating === r.value;
                    return (
                      <button key={r.value} onClick={() => handleRate(r.value)} disabled={submitting}
                        className={`${r.color} text-white font-bold rounded-xl py-3 text-xs cursor-pointer hover:opacity-90 transition disabled:opacity-50 ${isRecommended ? "ring-2 ring-white ring-offset-2" : ""}`}>
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
            <div
              className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center justify-center cursor-pointer p-6 mb-4 hover:shadow-md transition"
              onClick={() => !flipped && setFlipped(true)}
              style={{ minHeight: "300px" }}
            >
              <div className="text-center w-full">
                {!flipped ? (
                  <div>
                    <p className="text-sm text-gray-400 mb-3">問題</p>
                    <p className={`text-xl font-medium whitespace-pre-wrap ${current.text_color || ""}`}>{current.front}</p>
                    <p className="text-xs text-gray-400 mt-6">タップするかスペースキーで答えを表示</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-400 mb-3">答え</p>
                    <p className={`text-xl whitespace-pre-wrap ${current.text_color || ""}`}>{current.back}</p>
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
            {flipped && (
              <div className="grid grid-cols-4 gap-2">
                {ratings.map((r) => (
                  <button key={r.value} onClick={() => handleRate(r.value)} disabled={submitting}
                    className={`${r.color} text-white font-bold rounded-xl py-3 text-xs cursor-pointer hover:opacity-90 transition disabled:opacity-50`}>
                    <div>{r.short}</div>
                    <div className="text-[10px] opacity-75">({r.value + 1})</div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <p className="text-[10px] text-gray-400 text-center mt-3">
          {!isMultipleChoice && !isSequence ? (!flipped ? "Space / Enter" : "1 2 3 4")
            : isMultipleChoice ? (!showFeedback ? "1 2 3 4 で選択" : "1 2 3 4 で評価")
            : isSequence ? (!seqSubmitted ? "1 2 3 4 で選択 / Backspace取消 / Enter確認" : "1 2 3 4 で評価")
            : ""}
        </p>
      </div>
    </div>
  );
}