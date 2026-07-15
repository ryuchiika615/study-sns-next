"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import LatexText from "@/components/LatexText";

export default function DeckDetailClient({
  deck,
  initialCards,
  initialSuggestions = [],
}: {
  deck: any;
  initialCards: any[];
  initialSuggestions?: any[];
}) {
  const router = useRouter();
  const [cards, setCards] = useState(initialCards);
  const supabase = createClient();
  const [showCreate, setShowCreate] = useState(false);
  const [cardType, setCardType] = useState<"basic" | "multiple_choice" | "sequence">("basic");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [tags, setTags] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [correctAnswer, setCorrectAnswer] = useState(0);
  const [correctMapping, setCorrectMapping] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(deck.is_public);
  const [imageFile, setImageFile] = useState<{ blob: Blob; preview: string } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Edit card
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editCardType, setEditCardType] = useState<"basic" | "multiple_choice" | "sequence">("basic");
  const [editOptions, setEditOptions] = useState<string[]>(["", ""]);
  const [editCorrectAnswer, setEditCorrectAnswer] = useState(0);
  const [editCorrectMapping, setEditCorrectMapping] = useState<Record<string, number>>({});
  const [editImageFile, setEditImageFile] = useState<{ blob: Blob; preview: string } | null>(null);
  const editImageInputRef = useRef<HTMLInputElement>(null);

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

  // PDF Import
  const [showPDFImport, setShowPDFImport] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfProcessing, setPdfProcessing] = useState(false);
  const pdfAbortRef = useRef<AbortController | null>(null);
  const [pdfCards, setPdfCards] = useState<any[]>([]);
  const [pdfInfo, setPdfInfo] = useState<{ pageCount: number; extractedLength: number } | null>(null);

  // Explain
  const [explainingId, setExplainingId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState("");

  // Suggestions
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const loadSuggestions = async () => {
    setSuggestLoading(true);
    const res = await fetch(`/api/study/cards/suggestions?deck_id=${deck.id}`);
    if (res.ok) {
      const data = await res.json();
      setSuggestions(data.suggestions);
    }
    setSuggestLoading(false);
  };

  const handleSuggestion = async (id: string, status: string) => {
    const res = await fetch(`/api/study/cards/suggestions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setSuggestions((prev: any[]) => prev.map((s: any) => s.id === id ? { ...s, status, reviewed_at: new Date().toISOString() } : s));
      loadSuggestions(); // Refresh to get updated card data
    }
  };

  const togglePublic = async () => {
    const newVal = !isPublic;
    const res = await fetch("/api/study/decks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deck.id, is_public: newVal }),
    });
    if (res.ok) setIsPublic(newVal);
  };

  const uploadCardImage = async (file: { blob: Blob; preview: string }, userId: string): Promise<string | null> => {
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(fileName, file.blob);
    if (uploadError) return null;
    const { data: urlData } = supabase.storage
      .from("post-images")
      .getPublicUrl(fileName);
    return urlData?.publicUrl || null;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim()) return;
    if (cardType === "multiple_choice") {
      if (options.filter((o) => o.trim()).length < 2) { setError("選択肢は最低2つ必要です"); return; }
      if (!back.trim()) { setError("解説を入力してください"); return; }
    } else if (cardType === "sequence") {
      if (options.filter((o) => o.trim()).length < 2) { setError("選択肢は最低2つ必要です"); return; }
      if (!back.trim()) { setError("完成文を入力してください"); return; }
      if (Object.keys(correctMapping).length === 0) { setError("正しい組み合わせを設定してください"); return; }
    } else if (!back.trim()) return;
    setCreating(true);
    setError("");

    let imageUrl: string | null = null;
    if (imageFile) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) imageUrl = await uploadCardImage(imageFile, user.id);
    }

    const body: any = {
      deck_id: deck.id,
      front: front.trim(),
      back: back.trim(),
      tags: tags ? tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      card_type: cardType,
      image_url: imageUrl,
    };
    if (cardType === "multiple_choice") {
      body.options = options.filter((o: string) => o.trim());
      body.correct_answer = correctAnswer;
    } else if (cardType === "sequence") {
      body.options = options.filter((o: string) => o.trim());
      body.correct_mapping = correctMapping;
    }
    const res = await fetch("/api/study/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setCreating(false);
    if (res.ok) {
      const data = await res.json();
      setCards((prev) => [data.card, ...prev]);
      setFront("");
      setBack("");
      setTags("");
      setOptions(["", ""]);
      setCorrectAnswer(0);
      setCorrectMapping({});
      setCardType("basic");
      setShowCreate(false);
      if (imageFile) { URL.revokeObjectURL(imageFile.preview); setImageFile(null); }
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

  const startEdit = (card: any) => {
    setEditingId(card.id);
    setEditFront(card.front);
    setEditBack(card.back);
    setEditTags((card.tags || []).join(", "));
    setEditCardType(card.card_type || "basic");
    setEditOptions(card.options?.length ? [...card.options] : ["", ""]);
    setEditCorrectAnswer(card.correct_answer ?? 0);
    setEditCorrectMapping(card.correct_mapping || {});
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFront.trim() || !editBack.trim()) return;

    let imageUrl: string | null = null;
    if (editImageFile) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) imageUrl = await uploadCardImage(editImageFile, user.id);
    }

    const body: any = { id: editingId, front: editFront.trim(), back: editBack.trim(), tags: editTags ? editTags.split(",").map((t: string) => t.trim()).filter(Boolean) : [] };
    if (imageUrl) body.image_url = imageUrl;
    if (editCardType === "multiple_choice") {
      if (editOptions.filter((o) => o.trim()).length < 2) return;
      body.card_type = editCardType;
      body.options = editOptions.filter((o) => o.trim());
      body.correct_answer = editCorrectAnswer;
    } else if (editCardType === "sequence") {
      if (editOptions.filter((o) => o.trim()).length < 2) return;
      if (Object.keys(editCorrectMapping).length === 0) return;
      body.card_type = editCardType;
      body.options = editOptions.filter((o) => o.trim());
      body.correct_mapping = editCorrectMapping;
    }
    const res = await fetch("/api/study/cards", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      setCards((prev) => prev.map((c) => c.id === editingId ? data.card : c));
      setEditingId(null);
      if (editImageFile) { URL.revokeObjectURL(editImageFile.preview); setEditImageFile(null); }
    }
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

  const handlePDFImport = async () => {
    if (!pdfFile) return;
    pdfAbortRef.current = new AbortController();
    setPdfProcessing(true);
    setError("");
    setPdfCards([]);
    setPdfInfo(null);
    const formData = new FormData();
    formData.append("file", pdfFile);
    try {
      const res = await fetch("/api/study/pdf-import", {
        method: "POST",
        body: formData,
        signal: pdfAbortRef.current.signal,
      });
      if (res.ok) {
        const data = await res.json();
        setPdfCards(data.cards);
        setPdfInfo({ pageCount: data.pageCount, extractedLength: data.extractedLength });
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "PDFインポート失敗");
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        setError("キャンセルしました");
      } else {
        setError(e.message || "エラーが発生しました");
      }
    } finally {
      setPdfProcessing(false);
      pdfAbortRef.current = null;
    }
  };

  const cancelPDFImport = () => {
    pdfAbortRef.current?.abort();
  };

  const addPDFCards = async () => {
    setCreating(true);
    for (const card of pdfCards) {
      await fetch("/api/study/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deck_id: deck.id, front: card.front, back: card.back }),
      });
    }
    const res = await fetch(`/api/study/cards?deck_id=${deck.id}`);
    if (res.ok) {
      const data = await res.json();
      setCards(data.cards);
    }
    setPdfCards([]);
    setPdfFile(null);
    setPdfInfo(null);
    setShowPDFImport(false);
    setCreating(false);
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
                <>
                  <Link href={`/study/${deck.id}/review`}
                    className="bg-white border-2 border-primary text-primary text-sm font-bold rounded-full px-4 py-1.5 cursor-pointer hover:bg-primary/5 transition">
                    <i className="fas fa-book-open mr-1" /> 練習
                  </Link>
                  <Link href={`/study/${deck.id}/quiz`}
                    className="bg-primary text-white text-sm font-bold rounded-full px-4 py-1.5 cursor-pointer hover:bg-primary/90 transition">
                    <i className="fas fa-pen mr-1" /> テスト
                  </Link>
                </>
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
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setShowCreate(!showCreate)}
            className="bg-primary text-white font-bold rounded-xl py-3 text-sm cursor-pointer hover:bg-primary/90 transition">
            + 手動追加
          </button>
          <button onClick={() => setShowAIGenerate(!showAIGenerate)}
            className="bg-purple-600 text-white font-bold rounded-xl py-3 text-sm cursor-pointer hover:bg-purple-700 transition">
            <i className="fas fa-magic mr-1" /> AI生成
          </button>
          <button onClick={() => setShowPDFImport(!showPDFImport)}
            className="bg-red-500 text-white font-bold rounded-xl py-3 text-sm cursor-pointer hover:bg-red-600 transition">
            <i className="fas fa-file-pdf mr-1" /> PDFインポート
          </button>
          <button onClick={() => setShowImport(!showImport)}
            className="bg-gray-700 text-white font-bold rounded-xl py-3 text-sm cursor-pointer hover:bg-gray-800 transition">
            <i className="fas fa-upload mr-1" /> インポート
          </button>
        </div>

        {/* Suggestions section (owner only) */}
        {isPublic && suggestions.filter((s: any) => s.status === "pending").length > 0 && (
          <div className="bg-orange-50 rounded-xl border border-orange-200 p-3">
            <button onClick={() => { setShowSuggestions(!showSuggestions); if (!showSuggestions && suggestions.length === 0) loadSuggestions(); }}
              className="w-full flex items-center justify-between cursor-pointer">
              <span className="text-sm font-bold text-orange-700">
                <i className="fas fa-flag mr-1" /> 修正提案 ({suggestions.filter((s: any) => s.status === "pending").length}件)
              </span>
              <i className={`fas fa-chevron-${showSuggestions ? "up" : "down"} text-orange-400 text-xs`} />
            </button>
          </div>
        )}

        {showSuggestions && (
          <div className="space-y-2">
            {suggestLoading ? (
              <p className="text-xs text-gray-400 text-center py-2">読み込み中...</p>
            ) : suggestions.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">提案はありません</p>
            ) : (
              suggestions.map((s: any) => (
                <div key={s.id} className={`bg-white rounded-xl border p-4 ${s.status === "pending" ? "border-orange-200" : "border-gray-200"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.status === "pending" ? "bg-orange-100 text-orange-600" : s.status === "accepted" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                        {s.status === "pending" ? "未対応" : s.status === "accepted" ? "採用" : "却下"}
                      </span>
                      <span className="text-[10px] text-gray-400 ml-2">
                        {s.profiles?.display_name || s.profiles?.username} さん
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400">{new Date(s.created_at).toLocaleString("ja-JP")}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-2 mb-2">
                    <p className="text-xs text-gray-500">対象カード:</p>
                    <p className="text-sm font-medium">{s.cards?.front}</p>
                  </div>

                  <p className="text-sm whitespace-pre-wrap mb-2">{s.description}</p>

                  {(s.suggested_front || s.suggested_back) && (
                    <div className="bg-blue-50 rounded-lg p-2 mb-2 text-xs space-y-1">
                      {s.suggested_front && <p><span className="font-bold">問題修正案:</span> {s.suggested_front}</p>}
                      {s.suggested_back && <p><span className="font-bold">回答修正案:</span> {s.suggested_back}</p>}
                      {s.suggested_options && <p><span className="font-bold">選択肢修正案:</span> {s.suggested_options.join(", ")}</p>}
                    </div>
                  )}

                  {s.status === "pending" && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => handleSuggestion(s.id, "accepted")}
                        className="flex-1 bg-green-500 text-white text-xs font-bold rounded-full py-1.5 cursor-pointer hover:bg-green-600 transition">
                        <i className="fas fa-check mr-1" />採用して修正
                      </button>
                      <button onClick={() => handleSuggestion(s.id, "rejected")}
                        className="flex-1 bg-gray-200 text-gray-600 text-xs font-bold rounded-full py-1.5 cursor-pointer hover:bg-gray-300 transition">
                        <i className="fas fa-times mr-1" />却下
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Manual create form */}
        {showCreate && (
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-500">形式:</span>
              <button type="button" onClick={() => setCardType("basic")}
                className={`text-xs font-bold rounded-full px-3 py-1 cursor-pointer transition ${cardType === "basic" ? "bg-primary text-white" : "bg-gray-100 text-gray-500"}`}>
                基本
              </button>
              <button type="button" onClick={() => setCardType("multiple_choice")}
                className={`text-xs font-bold rounded-full px-3 py-1 cursor-pointer transition ${cardType === "multiple_choice" ? "bg-primary text-white" : "bg-gray-100 text-gray-500"}`}>
                選択問題
              </button>
              <button type="button" onClick={() => setCardType("sequence")}
                className={`text-xs font-bold rounded-full px-3 py-1 cursor-pointer transition ${cardType === "sequence" ? "bg-primary text-white" : "bg-gray-100 text-gray-500"}`}>
                穴埋め
              </button>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">問題</label>
              <textarea value={front} onChange={(e) => {
                setFront(e.target.value);
                if (cardType === "sequence") {
                  const blanks = [...e.target.value.matchAll(/［(.+?)］/g)].map(m => m[1]);
                  setCorrectMapping(prev => {
                    const next = { ...prev };
                    blanks.forEach(b => { if (!(b in next)) next[b] = 0; });
                    Object.keys(next).forEach(k => { if (!blanks.includes(k)) delete next[k]; });
                    return next;
                  });
                }
              }}
                className="w-full rounded-lg border-gray-300 text-sm" rows={3} required
                placeholder={cardType === "sequence"
                  ? "例: ［ア］の定理では、直角三角形の斜辺の長さの2乗は、他の2つの辺の長さの2乗の［イ］に等しい"
                  : cardType === "multiple_choice"
                    ? "例: 日本の首都は？"
                    : "例: ベイズの定理は？"} />
              {cardType === "sequence" && (
                <p className="text-[10px] text-gray-400 mt-1">空欄は［ア］［イ］［ウ］のように記述</p>
              )}
            </div>
            {cardType === "multiple_choice" && (
              <div className="space-y-2">
                <label className="text-xs text-gray-500 block">選択肢（ラジオで正解を選択）</label>
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="radio" name="correct" checked={correctAnswer === i}
                      onChange={() => setCorrectAnswer(i)}
                      className="cursor-pointer" />
                    <input value={opt} onChange={(e) => {
                      const next = [...options];
                      next[i] = e.target.value;
                      setOptions(next);
                    }}
                      className="flex-1 rounded-lg border-gray-300 text-sm" placeholder={i === 0 ? "東京" : i === 1 ? "大阪" : `選択肢 ${i + 1}`} />
                    {options.length > 2 && (
                      <button type="button" onClick={() => {
                        const next = options.filter((_, j) => j !== i);
                        setOptions(next);
                        if (correctAnswer >= next.length) setCorrectAnswer(0);
                      }}
                        className="text-xs text-red-400 cursor-pointer">
                        <i className="fas fa-times" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => { setOptions([...options, ""]); }}
                  className="text-xs text-primary font-bold cursor-pointer">
                  <i className="fas fa-plus mr-1" />選択肢を追加
                </button>
              </div>
            )}
            {cardType === "sequence" && (
              <div className="space-y-2">
                <label className="text-xs text-gray-500 block">選択肢</label>
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 w-5 text-center">{String.fromCharCode(65 + i)}</span>
                    <input value={opt} onChange={(e) => {
                      const next = [...options];
                      next[i] = e.target.value;
                      setOptions(next);
                    }}
                      className="flex-1 rounded-lg border-gray-300 text-sm" placeholder={i === 0 ? "ピタゴラス" : i === 1 ? "和" : i === 2 ? "差" : `選択肢 ${String.fromCharCode(65 + i)}`} />
                    {options.length > 2 && (
                      <button type="button" onClick={() => {
                        const next = options.filter((_, j) => j !== i);
                        setOptions(next);
                        const fixed: Record<string, number> = {};
                        Object.entries(correctMapping).forEach(([k, v]) => { fixed[k] = v >= next.length ? 0 : v; });
                        setCorrectMapping(fixed);
                      }}
                        className="text-xs text-red-400 cursor-pointer">
                        <i className="fas fa-times" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => { setOptions([...options, ""]); }}
                  className="text-xs text-primary font-bold cursor-pointer">
                  <i className="fas fa-plus mr-1" />選択肢を追加
                </button>

                {/* Blank mapping */}
                {options.filter(o => o.trim()).length >= 2 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <label className="text-xs text-gray-500 block mb-2">正しい組み合わせ</label>
                    {Object.keys(correctMapping).length > 0 ? (
                      Object.keys(correctMapping).sort().map((blank) => (
                        <div key={blank} className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-bold text-orange-600">［{blank}］</span>
                          <span className="text-xs text-gray-400">→</span>
                          <select value={correctMapping[blank]} onChange={(e) => {
                            setCorrectMapping({ ...correctMapping, [blank]: Number(e.target.value) });
                          }}
                            className="flex-1 rounded-lg border-gray-300 text-sm">
                            {options.filter(o => o.trim()).map((_, i) => (
                              <option key={i} value={i}>{(String.fromCharCode(65 + i))}. {options.filter(o => o.trim())[i] || `(空)`}</option>
                            ))}
                          </select>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-orange-500">
                        <i className="fas fa-exclamation-triangle mr-1" />
                        問題文に［ア］［イ］［ウ］のように空欄を記入すると、ここに組み合わせを設定できるようになります。
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                {cardType === "multiple_choice" || cardType === "sequence" ? "解説（完成文）" : "裏面（答え）"}
              </label>
              <textarea value={back} onChange={(e) => setBack(e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm" rows={3} required
                placeholder={cardType === "sequence"
                  ? "例: ピタゴラスの定理では、直角三角形の斜辺の長さの2乗は、他の2つの辺の長さの2乗の和に等しい"
                  : cardType === "multiple_choice"
                    ? "例: 東京は日本の首都であり、最大でもある"
                    : "例: P(A|B) = P(B|A) × P(A) / P(B)"} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">タグ（カンマ区切り、任意）</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm" placeholder="例: 数学, 代数" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">画像（任意）</label>
              <input ref={imageInputRef} type="file" accept="image/*" className="text-sm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (imageFile) URL.revokeObjectURL(imageFile.preview);
                  setImageFile({ blob: file, preview: URL.createObjectURL(file) });
                  e.target.value = "";
                }} />
              {imageFile && (
                <div className="relative w-24 h-24 mt-2 rounded-lg overflow-hidden border border-gray-200">
                  <img src={imageFile.preview} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => { URL.revokeObjectURL(imageFile.preview); setImageFile(null); if (imageInputRef.current) imageInputRef.current.value = ""; }}
                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 hover:bg-red-600/80 rounded text-white text-[10px] flex items-center justify-center cursor-pointer border-none">
                    <i className="fas fa-times" />
                  </button>
                </div>
              )}
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

        {/* PDF Import form */}
        {showPDFImport && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h3 className="font-bold text-sm"><i className="fas fa-file-pdf text-red-500 mr-1" /> PDFインポート</h3>
            <p className="text-[10px] text-gray-400">
              PDFファイルを選択すると、テキストを抽出してAIが自動的にフラッシュカードを生成します。
            </p>
            <div>
              <input type="file" accept=".pdf,application/pdf" className="text-sm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) { setPdfFile(file); setPdfCards([]); setPdfInfo(null); }
                  e.target.value = "";
                }} />
              {pdfFile && (
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                  <i className="fas fa-file-pdf text-red-500" />
                  <span>{pdfFile.name}</span>
                  <span className="text-gray-400">({(pdfFile.size / 1024 / 1024).toFixed(1)}MB)</span>
                  <button onClick={() => { setPdfFile(null); setPdfCards([]); setPdfInfo(null); }}
                    className="text-gray-400 hover:text-red-500 cursor-pointer"><i className="fas fa-times" /></button>
                </div>
              )}
            </div>
            {pdfProcessing ? (
              <div className="flex gap-2">
                <button disabled
                  className="flex-1 bg-red-500 text-white font-bold rounded-full py-2 text-sm opacity-50 cursor-not-allowed">
                  <span><i className="fas fa-spinner fa-spin mr-1" /> テキスト抽出・カード生成中...</span>
                </button>
                <button onClick={cancelPDFImport}
                  className="bg-gray-200 text-gray-600 font-bold rounded-full px-4 py-2 text-sm hover:bg-gray-300 cursor-pointer">
                  中止
                </button>
              </div>
            ) : (
              <button onClick={handlePDFImport} disabled={!pdfFile}
                className="w-full bg-red-500 text-white font-bold rounded-full py-2 text-sm disabled:opacity-50 cursor-pointer">
                PDFからカードを生成
              </button>
            )}
            {pdfInfo && (
              <p className="text-[10px] text-gray-400">
                {pdfInfo.pageCount}ページ / {pdfInfo.extractedLength.toLocaleString()}文字を抽出
              </p>
            )}
            {pdfCards.length > 0 && (
              <div className="space-y-2 mt-2">
                <p className="text-xs text-gray-500">{pdfCards.length}枚のカードが生成されました</p>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {pdfCards.map((card: any, i: number) => (
                    <div key={i} className="border border-gray-100 rounded-lg p-2">
                      <p className="text-xs font-bold">Q: {card.front.length > 80 ? card.front.slice(0, 80) + "..." : card.front}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">A: {card.back.length > 80 ? card.back.slice(0, 80) + "..." : card.back}</p>
                    </div>
                  ))}
                </div>
                <button onClick={addPDFCards} disabled={creating}
                  className="w-full bg-red-500 text-white font-bold rounded-full py-2 text-sm disabled:opacity-50 cursor-pointer">
                  {creating ? "追加中..." : `${pdfCards.length}枚をデッキに追加`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Card list */}
        <div id="card-list" className="space-y-2">
          {editingId && (() => {
            const card = cards.find((c: any) => c.id === editingId);
            if (!card) return null;
            return (
              <form key={card.id} onSubmit={handleEditSave} className="bg-white rounded-xl border-2 border-primary p-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-primary"><i className="fas fa-pen mr-1" />カードを編集</h3>
                  <button type="button" onClick={() => setEditingId(null)}
                    className="text-xs text-gray-400 cursor-pointer hover:text-gray-600"><i className="fas fa-times" /></button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">形式:</span>
                  {(["basic", "multiple_choice", "sequence"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setEditCardType(t)}
                      className={`text-xs font-bold rounded-full px-3 py-1 cursor-pointer transition ${editCardType === t ? "bg-primary text-white" : "bg-gray-100 text-gray-500"}`}>
                      {t === "basic" ? "基本" : t === "multiple_choice" ? "選択問題" : "穴埋め"}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">問題</label>
                  <textarea value={editFront} onChange={(e) => {
                    setEditFront(e.target.value);
                    if (editCardType === "sequence") {
                      const blanks = [...e.target.value.matchAll(/［(.+?)］/g)].map(m => m[1]);
                      setEditCorrectMapping(prev => {
                        const next = { ...prev };
                        blanks.forEach(b => { if (!(b in next)) next[b] = 0; });
                        Object.keys(next).forEach(k => { if (!blanks.includes(k)) delete next[k]; });
                        return next;
                      });
                    }
                  }} className="w-full rounded-lg border-gray-300 text-sm" rows={3} required />
                </div>
                {editCardType === "multiple_choice" && (
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500 block">選択肢</label>
                    {editOptions.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="radio" name="edit-correct" checked={editCorrectAnswer === i}
                          onChange={() => setEditCorrectAnswer(i)} className="cursor-pointer" />
                        <input value={opt} onChange={(e) => {
                          const next = [...editOptions];
                          next[i] = e.target.value;
                          setEditOptions(next);
                        }} className="flex-1 rounded-lg border-gray-300 text-sm" />
                        {editOptions.length > 2 && (
                          <button type="button" onClick={() => {
                            const next = editOptions.filter((_, j) => j !== i);
                            setEditOptions(next);
                            if (editCorrectAnswer >= next.length) setEditCorrectAnswer(0);
                          }} className="text-xs text-red-400 cursor-pointer"><i className="fas fa-times" /></button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => setEditOptions([...editOptions, ""])}
                      className="text-xs text-primary font-bold cursor-pointer"><i className="fas fa-plus mr-1" />選択肢を追加</button>
                  </div>
                )}
                {editCardType === "sequence" && (
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500 block">選択肢</label>
                    {editOptions.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 w-5 text-center">{String.fromCharCode(65 + i)}</span>
                        <input value={opt} onChange={(e) => {
                          const next = [...editOptions];
                          next[i] = e.target.value;
                          setEditOptions(next);
                        }} className="flex-1 rounded-lg border-gray-300 text-sm" />
                        {editOptions.length > 2 && (
                          <button type="button" onClick={() => {
                            const next = editOptions.filter((_, j) => j !== i);
                            setEditOptions(next);
                            const fixed: Record<string, number> = {};
                            Object.entries(editCorrectMapping).forEach(([k, v]) => { fixed[k] = v >= next.length ? 0 : v; });
                            setEditCorrectMapping(fixed);
                          }} className="text-xs text-red-400 cursor-pointer"><i className="fas fa-times" /></button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => setEditOptions([...editOptions, ""])}
                      className="text-xs text-primary font-bold cursor-pointer"><i className="fas fa-plus mr-1" />選択肢を追加</button>
                    {editOptions.filter(o => o.trim()).length >= 2 && Object.keys(editCorrectMapping).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <label className="text-xs text-gray-500 block mb-2">正しい組み合わせ</label>
                        {Object.keys(editCorrectMapping).sort().map((blank) => (
                          <div key={blank} className="flex items-center gap-2 mb-1.5">
                            <span className="text-sm font-bold text-orange-600">［{blank}］</span>
                            <span className="text-xs text-gray-400">→</span>
                            <select value={editCorrectMapping[blank]} onChange={(e) => {
                              setEditCorrectMapping({ ...editCorrectMapping, [blank]: Number(e.target.value) });
                            }} className="flex-1 rounded-lg border-gray-300 text-sm">
                              {editOptions.filter(o => o.trim()).map((_, i) => (
                                <option key={i} value={i}>{String.fromCharCode(65 + i)}. {editOptions.filter(o => o.trim())[i]}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">{editCardType === "multiple_choice" || editCardType === "sequence" ? "解説（完成文）" : "裏面（答え）"}</label>
                  <textarea value={editBack} onChange={(e) => setEditBack(e.target.value)}
                    className="w-full rounded-lg border-gray-300 text-sm" rows={3} required />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">タグ（カンマ区切り）</label>
                  <input value={editTags} onChange={(e) => setEditTags(e.target.value)}
                    className="w-full rounded-lg border-gray-300 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">画像（任意）</label>
                  <input ref={editImageInputRef} type="file" accept="image/*" className="text-sm"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (editImageFile) URL.revokeObjectURL(editImageFile.preview);
                      setEditImageFile({ blob: file, preview: URL.createObjectURL(file) });
                      e.target.value = "";
                    }} />
                  {(editImageFile || (cards.find((c: any) => c.id === editingId)?.image_url)) && (
                    <div className="relative w-24 h-24 mt-2 rounded-lg overflow-hidden border border-gray-200">
                      <img src={editImageFile?.preview || (cards.find((c: any) => c.id === editingId)?.image_url)} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => { if (editImageFile) { URL.revokeObjectURL(editImageFile.preview); } setEditImageFile(null); if (editImageInputRef.current) editImageInputRef.current.value = ""; }}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 hover:bg-red-600/80 rounded text-white text-[10px] flex items-center justify-center cursor-pointer border-none">
                        <i className="fas fa-times" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-primary text-white font-bold rounded-full py-2 text-sm cursor-pointer hover:bg-primary/90 transition">保存</button>
                  <button type="button" onClick={() => setEditingId(null)}
                    className="flex-1 bg-gray-100 text-gray-600 font-bold rounded-full py-2 text-sm cursor-pointer hover:bg-gray-200 transition">キャンセル</button>
                </div>
              </form>
            );
          })()}
          {cards.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">カードがありません。手動追加、AI生成、またはインポートでカードを作成しましょう。</p>
          )}
          {cards.map((card: any) =>
            editingId === card.id ? null : (
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
                      {card.card_type === "multiple_choice" && (
                        <span className="text-[10px] bg-blue-100 text-blue-600 font-bold px-1.5 py-0.5 rounded">選択</span>
                      )}
                      {card.card_type === "sequence" && (
                        <span className="text-[10px] bg-purple-100 text-purple-600 font-bold px-1.5 py-0.5 rounded">穴埋め</span>
                      )}
                      <LatexText text={card.front} className="text-sm font-medium" />
                      {card.image_url && !flippedId && (
                        <div className="mt-2 relative w-full h-40 rounded-lg overflow-hidden border border-gray-200">
                          <Image src={card.image_url} fill className="object-contain" alt="" sizes="(max-width: 768px) 100vw, 400px" />
                        </div>
                      )}
                    </div>
                    {flippedId === card.id && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <LatexText text={card.back} className="text-sm text-gray-700" />
                        {card.image_url && (
                          <div className="mt-2 relative w-full h-48 rounded-lg overflow-hidden border border-gray-200">
                            <Image src={card.image_url} fill className="object-contain" alt="" sizes="(max-width: 768px) 100vw, 600px" />
                          </div>
                        )}
                        {card.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {card.tags.map((tag: string, i: number) => (
                              <span key={i} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{tag}</span>
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
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); startEdit(card); }}
                      className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 flex-shrink-0">
                      <i className="fas fa-pen" />
                    </button>
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
