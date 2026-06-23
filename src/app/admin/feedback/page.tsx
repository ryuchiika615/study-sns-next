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
  const [feedbacks, setFeedbacks] = useState<UserFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const router = useRouter();
  const supabase = createClient();

  const loadPage = useCallback(async (p: number) => {
    setLoading(true);
    const res = await fetch(`/api/admin/feedback?page=${p}`);
    if (res.ok) {
      const json = await res.json();
      setFeedbacks(json.data || []);
      setTotal(json.total || 0);
    } else {
      setError("取得に失敗しました");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      const { data: profile } = await supabase
        .from("profiles").select("is_admin").eq("id", data.user.id).single();
      if (!profile?.is_admin) { setError("管理者のみアクセスできます"); setLoading(false); return; }
      loadPage(1);
    });
  }, []);

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
              <div key={fb.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                  <i className={`fas fa-chevron-${expandedId === fb.id ? "up" : "down"} text-gray-300 mt-1.5`} />
                </button>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={() => { setPage((p) => { const np = p - 1; loadPage(np); return np; }); }}
              disabled={page <= 1}
              className="px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 bg-white disabled:opacity-30 cursor-pointer disabled:cursor-default"
            >
              ← 前のページ
            </button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <button
              onClick={() => { setPage((p) => { const np = p + 1; loadPage(np); return np; }); }}
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
    </div>
  );
}
