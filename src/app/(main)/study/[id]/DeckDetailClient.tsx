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
  const [isPublic, setIsPublic] = useState(deck.is_public);

  // AI generate
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiCards, setAiCards] = useState<any[]>([]);

  // Import
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);

  // Explain
  const [explainingId, setExplainingId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState("");

  const togglePublic = async () => {
    const newVal = !isPublic;
    const res = await fetch("/api/study/decks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deck.id, is_public: newVal }),
    });
    if (res.ok) setIsPublic(newVal);
  };

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

  const handleAIGenerate = async () => {
    if (!aiTopic.trim()) return;
    setAiGenerating(true);
    setError("");
    setAiCards([]);
    const res = await fetch("/api/study/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: aiTopic.trim(), count: aiCount }),
    });
    setAiGenerating(false);
    if (res.ok) {
      const data = await res.json();
      setAiCards(data.cards);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "生成失敗");
    }
  };

  const addAICards = async () => {
    setCreating(true);
    for (const card of aiCards) {
      await fetch("/api/study/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deck_id: deck.id, front: card.front, back: card.back }),
      });
    }
    // Refresh cards
    const res = await fetch(`/api/study/cards?deck_id=${deck.id}`);
    if (res.ok) {
      const data = await res.json();
      setCards(data.cards);
    }
    setAiCards([]);
    setAiTopic("");
    setShowAIGenerate(false);
    setCreating(false);
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    setImporting(true);
    setError("");
    const res = await fetch("/api/study/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deck_id: deck.id, text: importText }),
    });
    setImporting(false);
    if (res.ok) {
      const data = await res.json();
      const refreshed = await fetch(`/api/study/cards?deck_id=${deck.id}`);
      if (refreshed.ok) {
        const rd = await refreshed.json();
        setCards(rd.cards);
      }
      setImportText("");
      setShowImport(false);
      setError(`${data.imported_count}枚のカードをインポートしました`);
      setTimeout(() => setError(""), 3000);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "インポート失敗");
    }
  };

  const handleExplain = async (card: any) => {
    setExplainingId(card.id);
    setExplanation("");
    const res = await fetch("/api/study/ai/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ front: card.front, back: card.back }),
    });
    if (res.ok) {
      const data = await res.json();
      setExplanation(data.explanation);
    } else {
      setExplanation("解説の生成に失敗しました");
    }
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
            <div className="flex items-center gap-2">
              {cards.length > 0 && (
                <Link href={`/study/${deck.id}/review`}
                  className="bg-primary text-white text-sm font-bold rounded-full px-4 py-1.5 cursor-pointer hover:bg-primary/90 transition">
                  学習を開始
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">{deck.name}</h1>
              {deck.description && <p className="text-xs text-gray-500">{deck.description}</p>}
              <p className="text-xs text-gray-400 mt-1">カード {cards.length}枚</p>
            </div>
            <button onClick={togglePublic}
              className={`text-xs font-bold rounded-full px-3 py-1.5 cursor-pointer transition ${isPublic ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              <i className={`fas fa-${isPublic ? "globe" : "lock"} mr-1`} />
              {isPublic ? "公開中" : "非公開"}
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

        {/* Action buttons row */}
        <div className="flex gap-2">
          <button onClick={() => setShowCreate(!showCreate)}
            className="flex-1 bg-primary text-white font-bold rounded-xl py-3 text-sm cursor-pointer hover:bg-primary/90 transition">
            + 手動追加
          </button>
          <button onClick={() => setShowAIGenerate(!showAIGenerate)}
            className="flex-1 bg-purple-600 text-white font-bold rounded-xl py-3 text-sm cursor-pointer hover:bg-purple-700 transition">
            <i className="fas fa-magic mr-1" /> AI生成
          </button>
          <button onClick={() => setShowImport(!showImport)}
            className="flex-1 bg-gray-700 text-white font-bold rounded-xl py-3 text-sm cursor-pointer hover:bg-gray-800 transition">
            <i className="fas fa-upload mr-1" /> インポート
          </button>
        </div>

        {/* Manual create form */}
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

        {/* AI Generate form */}
        {showAIGenerate && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h3 className="font-bold text-sm"><i className="fas fa-magic text-purple-500 mr-1" /> AIでカード生成</h3>
            <textarea value={aiTopic} onChange={(e) => setAiTopic(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm" rows={3} placeholder="例: ベイズの定理、TOEIC英単語、日本史 明治時代..." />
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">枚数:</span>
              <select value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))}
                className="rounded-lg border-gray-300 text-sm">
                {[3, 5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}枚</option>)}
              </select>
            </div>
            <button onClick={handleAIGenerate} disabled={aiGenerating || !aiTopic.trim()}
              className="w-full bg-purple-600 text-white font-bold rounded-full py-2 text-sm disabled:opacity-50 cursor-pointer">
              {aiGenerating ? "生成中..." : "生成"}
            </button>

            {aiCards.length > 0 && (
              <div className="space-y-2 mt-2">
                <p className="text-xs text-gray-500">{aiCards.length}枚のカードが生成されました</p>
                {aiCards.map((card: any, i: number) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-3">
                    <p className="text-xs font-bold">Q: {card.front}</p>
                    <p className="text-xs text-gray-600 mt-1">A: {card.back}</p>
                  </div>
                ))}
                <button onClick={addAICards} disabled={creating}
                  className="w-full bg-purple-600 text-white font-bold rounded-full py-2 text-sm disabled:opacity-50 cursor-pointer">
                  {creating ? "追加中..." : `${aiCards.length}枚をデッキに追加`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Import form */}
        {showImport && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h3 className="font-bold text-sm"><i className="fas fa-upload text-gray-600 mr-1" /> CSV/TSVインポート</h3>
            <p className="text-[10px] text-gray-400">
              CSV形式: 表面,裏面（1行に1カード） or TSV形式: 表面\t裏面（タブ区切り）
            </p>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm font-mono" rows={5}
              placeholder={"例:\n水の化学式, H2O\n光合成の化学式, 6CO2 + 6H2O → C6H12O6 + 6O2"} />
            <button onClick={handleImport} disabled={importing || !importText.trim()}
              className="w-full bg-gray-700 text-white font-bold rounded-full py-2 text-sm disabled:opacity-50 cursor-pointer">
              {importing ? "インポート中..." : "インポート"}
            </button>
          </div>
        )}

        {/* Card list */}
        <div className="space-y-2">
          {cards.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">カードがありません。手動追加、AI生成、またはインポートでカードを作成しましょう。</p>
          )}
          {cards.map((card: any) => (
            <div key={card.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition"
              onClick={() => {
                if (explainingId !== card.id) {
                  setFlippedId(flippedId === card.id ? null : card.id);
                  setExplainingId(null);
                  setExplanation("");
                }
              }}>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium whitespace-pre-wrap">{card.front}</p>
                    </div>
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
                        <button onClick={(e) => { e.stopPropagation(); handleExplain(card); }}
                          className="mt-2 text-xs text-purple-500 font-bold cursor-pointer hover:text-purple-700 transition">
                          <i className="fas fa-robot mr-0.5" /> AI解説
                        </button>
                      </div>
                    )}
                    {explainingId === card.id && explanation && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{explanation}</div>
                      </div>
                    )}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(card.id); }}
                    className="text-xs text-red-400 cursor-pointer hover:text-red-600 ml-2 flex-shrink-0">
                    <i className="fas fa-trash" />
                  </button>
                </div>
                {!flippedId && explainingId !== card.id && (
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
