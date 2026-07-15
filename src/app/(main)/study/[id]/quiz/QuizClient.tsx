"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Answer = {
  blankId: string;
  selectedOption: number | null;
};

export default function QuizClient({ deck, cards }: { deck: any; cards: any[] }) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [questionCount, setQuestionCount] = useState(Math.min(cards.length, 10));
  const [randomOrder, setRandomOrder] = useState(true);
  const [shuffledCards, setShuffledCards] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<{ blankId: string; correct: boolean; correctOption: number }[]>([]);
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [userInput, setUserInput] = useState("");

  const current = shuffledCards[index];

  // 回答記録を保存
  const saveReview = async (cardId: string, rating: number) => {
    try {
      await fetch("/api/study/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: cardId, rating }),
      });
    } catch (e) { /* ignore */ }
  };

  // 穴埋めの空欄を抽出
  const extractBlanks = (text: string): string[] => {
    return [...text.matchAll(/［(.+?)］/g)].map(m => m[1]);
  };

  const blanks = extractBlanks(current?.front || "");
  const isSequence = current?.card_type === "sequence" && blanks.length >= 2;
  const isMultipleChoice = current?.card_type === "multiple_choice" && current?.options?.length > 0;
  const isBasic = !isSequence && !isMultipleChoice;

  useEffect(() => {
    if (current) {
      setAnswers(blanks.map(b => ({ blankId: b, selectedOption: null })));
      setSelectedAnswer(null);
      setUserInput("");
    }
  }, [index, current?.id]);

  // 選択問題の回答処理
  const handleSelectMultipleChoice = (optionIndex: number) => {
    if (submitted) return;
    setSelectedAnswer(optionIndex);
  };

  // 穴埋めの回答処理
  const handleSelectBlank = (blankIndex: number, optionIndex: number) => {
    if (submitted) return;
    const newAnswers = [...answers];
    newAnswers[blankIndex] = { ...newAnswers[blankIndex], selectedOption: optionIndex };
    setAnswers(newAnswers);
  };

  // 解答
  const handleSubmit = () => {
    let isCorrect = false;
    if (isMultipleChoice) {
      isCorrect = selectedAnswer === current.correct_answer;
      setResults([{
        blankId: "answer",
        correct: isCorrect,
        correctOption: current.correct_answer,
      }]);
      setScore(prev => prev + (isCorrect ? 1 : 0));
    } else if (isSequence) {
      const correctMap = current.correct_mapping || {};
      const newResults = blanks.map((blankId, i) => ({
        blankId,
        correct: answers[i].selectedOption === correctMap[blankId],
        correctOption: correctMap[blankId] ?? 0,
      }));
      isCorrect = newResults.every(r => r.correct);
      const correctCount = newResults.filter(r => r.correct).length;
      setScore(prev => prev + correctCount);
      setResults(newResults);
    } else if (isBasic) {
      // 基本問題は正解判定なし、入力があれば記録
      isCorrect = true;
    }
    // 回答記録を保存（正解→Easy 3、不正解→Again 0）
    saveReview(current.id, isCorrect ? 3 : 0);
    setSubmitted(true);
  };

  // 次の問題へ
  const handleNext = () => {
    if (index + 1 < shuffledCards.length) {
      setIndex(i => i + 1);
      setSubmitted(false);
      setResults([]);
      setSelectedAnswer(null);
      setUserInput("");
    } else {
      setCompleted(true);
    }
  };

  const handleStart = () => {
    const selected = randomOrder
      ? [...cards].sort(() => Math.random() - 0.5).slice(0, questionCount)
      : cards.slice(0, questionCount);
    setShuffledCards(selected);
    setIndex(0);
    setScore(0);
    setStarted(true);
  };

  const handleExit = () => {
    if (confirm("学習を終了しますか？")) {
      router.push(`/study/${deck.id}`);
    }
  };

  // タグをランダムにシャッフル
  const [shuffledOptions, setShuffledOptions] = useState<number[]>([]);
  useEffect(() => {
    if (isMultipleChoice && current.options?.length) {
      const indices = current.options.map((_: any, i: number) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      setShuffledOptions(indices);
    }
  }, [current?.id]);

  // 解答ボタンの disabled 判定
  const isSubmitDisabled = () => {
    if (isMultipleChoice) return selectedAnswer === null;
    if (isSequence) return !answers.some(a => a.selectedOption !== null);
    if (isBasic) return !userInput.trim();
    return true;
  };

  // 開始画面
  if (!started) {
    const counts = [5, 10, 15, 20, 30, cards.length];
    const uniqueCounts = [...new Set(counts.filter(c => c <= cards.length))];
    if (!uniqueCounts.includes(cards.length)) uniqueCounts.push(cards.length);

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">📚</div>
          <h2 className="text-xl font-bold mb-2">{deck.name}</h2>
          <p className="text-gray-500 text-sm mb-6">
            {cards.length}問の問題があります
          </p>
          <div className="mb-6">
            <label className="text-sm text-gray-600 block mb-3 font-bold">何問やる？</label>
            <div className="flex flex-wrap justify-center gap-2">
              {uniqueCounts.map(n => (
                <button key={n} onClick={() => setQuestionCount(n)}
                  className={`w-14 h-14 rounded-2xl font-bold text-sm transition-all cursor-pointer
                    ${questionCount === n
                      ? "bg-primary text-white shadow-md scale-110"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}>
                  {n === cards.length ? "全" : n}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              選択: {questionCount === cards.length ? `全${cards.length}問` : `${questionCount}問`}
            </p>
          </div>
          <div className="mb-6 flex items-center justify-center gap-3">
            <label className="text-sm text-gray-600 font-bold">順番</label>
            <button onClick={() => setRandomOrder(!randomOrder)}
              className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${randomOrder ? "bg-primary" : "bg-gray-300"}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${randomOrder ? "translate-x-6" : ""}`} />
            </button>
            <span className="text-sm text-gray-600">{randomOrder ? "ランダム" : "順番通り"}</span>
          </div>
          <button onClick={handleStart}
            className="w-full bg-primary text-white font-bold rounded-full py-3.5 text-sm hover:bg-primary/90 transition shadow-md">
            <i className="fas fa-play mr-2" /> 学習を始める
          </button>
        </div>
      </div>
    );
  }

  // 完了画面
  if (completed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold mb-2">学習完了！</h2>
          <p className="text-gray-600 mb-4">
            {shuffledCards.length}問学習しました
          </p>
          <div className="flex gap-3">
            <Link href={`/study/${deck.id}`}
              className="flex-1 bg-white border-2 border-gray-300 text-gray-700 font-bold rounded-full py-3 text-sm hover:bg-gray-50 transition text-center">
              デッキに戻る
            </Link>
            <button onClick={() => { setStarted(false); setCompleted(false); }}
              className="flex-1 bg-primary text-white font-bold rounded-full py-3 text-sm hover:bg-primary/90 transition">
              もう一度
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">問題がありません</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={handleExit} className="text-gray-400 text-sm hover:text-gray-600 cursor-pointer">
            <i className="fas fa-times mr-1" /> 終了
          </button>
          <div className="text-sm font-bold text-gray-600">
            {index + 1} / {shuffledCards.length}
          </div>
        </div>

        {/* プログレスバー */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
          <div className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${((index + 1) / shuffledCards.length) * 100}%` }} />
        </div>

        {/* 問題カード */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          {/* タグ表示 */}
          {current.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {current.tags.map((tag: string, i: number) => (
                <span key={i} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* 問題文 */}
          <div className="text-sm leading-relaxed whitespace-pre-wrap mb-6">
            {current.front}
          </div>

          {/* 選択問題の場合 */}
          {isMultipleChoice && (
            <div className="space-y-2">
              {current.options.map((opt: string, i: number) => {
                const displayIndex = shuffledOptions.length ? shuffledOptions.indexOf(i) : i;
                const letter = String.fromCharCode(65 + displayIndex);
                const isSelected = selectedAnswer === i;
                const isCorrect = submitted && i === current.correct_answer;
                const isWrong = submitted && isSelected && i !== current.correct_answer;

                return (
                  <button key={i} onClick={() => handleSelectMultipleChoice(i)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm
                      ${submitted
                        ? isCorrect ? "border-green-500 bg-green-50 text-green-700"
                          : isWrong ? "border-red-500 bg-red-50 text-red-700"
                            : "border-gray-200 bg-gray-50 text-gray-400"
                        : isSelected ? "border-primary bg-primary/5 text-primary"
                          : "border-gray-200 hover:border-gray-300 text-gray-700"
                      }`}
                    disabled={submitted}
                  >
                    <span className="font-bold mr-2">{letter}</span>
                    {opt}
                    {submitted && isCorrect && <span className="ml-2">✓</span>}
                    {submitted && isWrong && <span className="ml-2">✗</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* 穴埋めの場合 */}
          {isSequence && (
            <div className="space-y-4">
              {/* 穴埋め表示 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm leading-relaxed">
                  {blanks.map((blankId, i) => {
                    const answer = answers[i];
                    const isSelected = answer && answer.selectedOption !== null;
                    const isCorrect = submitted && results[i]?.correct;
                    const isWrong = submitted && !isCorrect;

                    return (
                      <span key={blankId} className="inline">
                        ［
                        <span className={`inline-block min-w-[2rem] text-center font-bold border-b-2 mx-1
                          ${submitted
                            ? isCorrect ? "border-green-500 text-green-600"
                              : "border-red-500 text-red-600"
                            : isSelected ? "border-primary text-primary"
                              : "border-gray-300 text-gray-400"
                          }`}>
                          {isSelected
                            ? String.fromCharCode(65 + answer.selectedOption!)
                            : "？"}
                          {submitted && !isCorrect && (
                            <span className="text-xs text-green-600 block">
                              {String.fromCharCode(65 + results[i].correctOption)}
                            </span>
                          )}
                        </span>
                        ］
                        {i < blanks.length - 1 && " "}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* 選択肢 */}
              <div className="space-y-2">
                <p className="text-xs text-gray-500 mb-2">選択肢:</p>
                {current.options?.map((opt: string, i: number) => {
                  const currentBlankIndex = answers.findIndex(a => a.selectedOption === null);

                  return (
                    <button key={i} onClick={() => {
                      if (!submitted && currentBlankIndex >= 0) {
                        handleSelectBlank(currentBlankIndex, i);
                      }
                    }}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm
                        ${submitted
                          ? results.some(r => r.correctOption === i && !r.correct)
                            ? "border-red-300 bg-red-50 text-red-600"
                            : "border-gray-200 bg-gray-50"
                          : "border-gray-200 hover:border-primary hover:bg-primary/5 text-gray-700"
                        }`}
                      disabled={submitted}
                    >
                      <span className="font-bold mr-2">{String.fromCharCode(65 + i)}</span>
                      {opt}
                    </button>
                  );
                })}
              </div>

              {/* やり直しボタン */}
              {!submitted && answers.some(a => a.selectedOption !== null) && (
                <button onClick={() => setAnswers(answers.map(a => ({ ...a, selectedOption: null })))}
                  className="text-xs text-gray-400 hover:text-gray-600">
                  <i className="fas fa-undo mr-1" /> やり直す
                </button>
              )}
            </div>
          )}

          {/* 基本問題の場合 - テキスト入力 */}
          {isBasic && (
            <div className="mt-4">
              {!submitted ? (
                <div>
                  <label className="text-xs text-gray-500 block mb-2">あなたの答え:</label>
                  <textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    className="w-full rounded-xl border-2 border-gray-200 text-sm p-3 focus:border-primary focus:outline-none transition"
                    rows={3}
                    placeholder="ここに答えを入力してください..."
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-300">
                    <p className="text-xs text-blue-700 font-bold mb-2">
                      <i className="fas fa-user mr-1" /> あなたの答え
                    </p>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap font-medium">
                      {userInput}
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 border-2 border-green-400">
                    <p className="text-xs text-green-800 font-bold mb-2">
                      <i className="fas fa-check-circle mr-1" /> 正解
                    </p>
                    <div className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed font-medium">
                      {current.back}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 解答ボタン / 次へボタン */}
        <div className="flex gap-3">
          {!submitted ? (
            <button onClick={handleSubmit}
              disabled={isSubmitDisabled()}
              className="flex-1 bg-primary text-white font-bold rounded-full py-3 text-sm disabled:opacity-40 hover:bg-primary/90 transition">
              解答
            </button>
          ) : (
            <div className="flex-1">
              <button onClick={handleNext}
                className="w-full bg-primary text-white font-bold rounded-full py-3 text-sm hover:bg-primary/90 transition">
                {index + 1 < shuffledCards.length ? "次の問題へ" : "結果を見る"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
