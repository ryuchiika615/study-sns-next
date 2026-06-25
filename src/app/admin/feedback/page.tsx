"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { UserFeedback } from "@/lib/types";

const typeLabels: Record<string, string> = {
  feedback: "要望",
  bug: "不具合報告",
  question: "質問",
  other: "その他",
};

const typeColors: Record<string, string> = {
  feedback: "bg-blue-100 text-blue-700",
  bug: "bg-red-100 text-red-700",
  question: "bg-green-100 text-green-700",
  other: "bg-gray-100 text-gray-700",
};

const PER_PAGE = 5;

export default function AdminFeedbackPage() {
  const [tab, setTab] = useState<"unresolved" | "resolved">("unresolved");
  const [feedbacks, setFeedbacks] = useState<UserFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [resolveTarget, setResolveTarget] = useState<UserFeedback | null>(null);
  const [resolveMessage, setResolveMessage] = useState("");
  const [resolving, setResolving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const loadPage = useCallback(async (p: number, s: string) => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/feedback?page=${p}&status=${s}`);
    if (res.ok) {
      const json = await res.json();
      setFeedbacks(json.data || []);
      setTotal(json.total || 0);
    } else {
      setError("取得に失敗しました");
    }
    setLoading(false);
  }, []);

  const deleteFeedback = async (id: number) => {
    if (!confirm("このフィードバックを削除しますか？")) return;
    const res = await fetch(`/api/admin/feedback?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setFeedbacks(prev => prev.filter(f => f.id !== id));
      setTotal(prev => prev - 1);
    } else {
      alert("削除に失敗しました");
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      const { data: profile } = await supabase
        .from("profiles").select("is_admin").eq("id", data.user.id).single();
      if (!profile?.is_admin) { setError("管理者のみアクセスできます"); setLoading(false); return; }
      loadPage(1, tab);
    });
  }, []);

  useEffect(() => {
    setPage(1);
    loadPage(1, tab);
  }, [tab]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-b from-gray-900 to-blue-900 border-b-4 border-yellow-600 text-center py-6 shadow-lg">
        <h1 className="text-3xl text-yellow-600 font-serif tracking-wider m-0" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
          要望・報告
        </h1>
        <p className="text-sm text-yellow-600 tracking-widest mt-1">ユーザーからのフィードバック一覧</p>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab("unresolved")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold border cursor-pointer transition ${
              tab === "unresolved"
                ? "bg-primary text-white border-primary shadow-md"
                : "bg-white text-gray-500 border-gray-200 hover:border-primary/30"
            }`}>
            未対応
          </button>
          <button onClick={() => setTab("resolved")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold border cursor-pointer transition ${
              tab === "resolved"
                ? "bg-primary text-white border-primary shadow-md"
                : "bg-white text-gray-500 border-gray-200 hover:border-primary/30"
            }`}>
            対応済み
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-center mb-4">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : feedbacks.length === 0 ? (
          <div className="text-center py-12 text-gray-400">フィードバックはまだありません</div>
        ) : (
          <div className="space-y-3">
            {feedbacks.map((fb) => (
              <div key={fb.id} className={`bg-white rounded-xl border overflow-hidden ${fb.resolved ? "border-green-200 opacity-70" : "border-gray-200"}`}>
                <button
                  onClick={() => setExpandedId(expandedId === fb.id ? null : fb.id)}
                  className="w-full flex items-start gap-3 p-4 text-left cursor-pointer border-none bg-transparent"
                >
                  <img
                    src={fb.user?.icon_url || "/default-icon.png"}
                    alt=""
                    className="w-8 h-8 rounded-full mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">
                        {fb.user?.display_name || fb.user?.username || "不明"}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${typeColors[fb.type] || typeColors.other}`}>
                        {typeLabels[fb.type] || fb.type}
                      </span>
                      {fb.resolved && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-700">解決済み</span>}
                    </div>
                    {expandedId === fb.id ? (
                      <div className="mt-1 space-y-2">
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{fb.content}</p>
                        {fb.image_url && (
                          <img src={fb.image_url} alt="添付画像" className="max-h-60 rounded-lg border border-gray-200" />
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{fb.content}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(fb.created_at).toLocaleDateString("ja-JP", {
                        year: "numeric", month: "2-digit", day: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <i className={`fas fa-chevron-${expandedId === fb.id ? "up" : "down"} text-gray-300`} />
                    <div className="flex gap-1">
                      {!fb.resolved && (
                        <button onClick={(e) => { e.stopPropagation(); setResolveTarget(fb); setResolveMessage(""); }}
                          className="text-[10px] px-2 py-0.5 bg-green-500 text-white rounded-full font-bold border-none cursor-pointer hover:bg-green-600">
                          解決
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); deleteFeedback(fb.id); }}
                        className="text-[10px] px-2 py-0.5 bg-red-400 text-white rounded-full font-bold border-none cursor-pointer hover:bg-red-500">
                        削除
                      </button>
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={() => { setPage((p) => { const np = p - 1; loadPage(np, tab); return np; }); }}
              disabled={page <= 1}
              className="px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 bg-white disabled:opacity-30 cursor-pointer disabled:cursor-default"
            >
              ← 前のページ
            </button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <button
              onClick={() => { setPage((p) => { const np = p + 1; loadPage(np, tab); return np; }); }}
              disabled={page >= totalPages}
              className="px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 bg-white disabled:opacity-30 cursor-pointer disabled:cursor-default"
            >
              次のページ →
            </button>
          </div>
        )}

        <div className="text-center mt-6">
          <a href="/admin" className="text-sm text-blue-500 hover:underline">← 管理者ダッシュボードに戻る</a>
        </div>
      </div>

      {resolveTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { if (!resolving) setResolveTarget(null); }}>
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-sm mb-2">このフィードバックを解決済みにする</h3>
            <p className="text-xs text-gray-500 mb-4 break-words">"{resolveTarget.content.slice(0, 60)}{resolveTarget.content.length > 60 ? "…" : ""}"</p>
            <textarea value={resolveMessage} onChange={(e) => setResolveMessage(e.target.value)}
              placeholder="ユーザーへの追加メッセージ（任意）"
              className="w-full rounded-lg border-gray-300 text-sm resize-none h-20 mb-4" />
            <div className="flex gap-2">
              <button onClick={async () => {
                if (resolving) return;
                setResolving(true);
                const res = await fetch("/api/admin/feedback/resolve", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ feedbackId: resolveTarget.id, customMessage: resolveMessage.trim() || null }),
                });
                setResolving(false);
                if (res.ok) {
                  setFeedbacks(prev => prev.filter(f => f.id !== resolveTarget.id));
                  setTotal(prev => prev - 1);
                  setResolveTarget(null);
                } else {
                  const err = await res.json();
                  alert(err.error || "失敗しました");
                }
              }}
                className="flex-1 bg-green-500 text-white font-bold rounded-full py-1.5 text-sm cursor-pointer disabled:opacity-50"
                disabled={resolving}>
                {resolving ? "送信中..." : "解決して通知する"}
              </button>
              <button onClick={() => setResolveTarget(null)}
                className="flex-1 bg-gray-100 text-gray-600 font-bold rounded-full py-1.5 text-sm cursor-pointer">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
