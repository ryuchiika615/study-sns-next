"use client";

import { useEffect, useState } from "react";
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

export default function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<UserFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      const { data: profile } = await supabase
        .from("profiles").select("is_admin").eq("id", data.user.id).single();
      if (!profile?.is_admin) { setError("管理者のみアクセスできます"); setLoading(false); return; }

      const res = await fetch("/api/admin/feedback");
      if (res.ok) {
        setFeedbacks(await res.json());
      } else {
        setError("取得に失敗しました");
      }
      setLoading(false);
    });
  }, []);

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
                    <p className={`text-sm text-gray-600 mt-1 ${expandedId !== fb.id ? "line-clamp-2" : ""}`}>
                      {fb.content}
                    </p>
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

        <div className="text-center mt-6">
          <a href="/admin" className="text-sm text-blue-500 hover:underline">← 管理者ダッシュボードに戻る</a>
        </div>
      </div>
    </div>
  );
}
