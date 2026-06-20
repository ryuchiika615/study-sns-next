"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

const sectionCard = (title: string, icon: string, children: React.ReactNode) => (
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
      <i className={`fas ${icon} text-primary text-sm w-4 text-center`} />
      <h2 className="text-sm font-bold">{title}</h2>
    </div>
    <div className="p-4 space-y-3">
      {children}
    </div>
  </div>
);

export default function SettingsClient({ userId }: { userId: string }) {
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackType, setFeedbackType] = useState("feedback");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [message, setMessage] = useState("");
  const supabase = createClient();

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <i className="fas fa-cog text-primary" /> 設定
        </h1>

        {message && (
          <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm">{message}</div>
        )}

        {/* 要望・報告 */}
        {sectionCard("要望・報告", "fa-envelope",
          <>
            <p className="text-[10px] text-gray-500">運営への要望、不具合報告、質問など</p>
            <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="自由に書いてください..."
              className="w-full rounded-lg border-gray-300 text-sm py-1.5 mt-0.5" rows={3} maxLength={1000} />
            <div className="flex items-center justify-between">
              <select value={feedbackType} onChange={(e) => setFeedbackType(e.target.value)}
                className="rounded-lg border-gray-300 text-xs p-1.5">
                <option value="feedback">要望</option>
                <option value="bug">不具合報告</option>
                <option value="question">質問</option>
                <option value="other">その他</option>
              </select>
              <span className="text-[10px] text-gray-400">{feedbackText.length}/1000</span>
            </div>
            <button onClick={async () => {
              if (!feedbackText.trim()) return;
              setFeedbackSending(true);
              try {
                const res = await fetch("/api/feedback", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ content: feedbackText, type: feedbackType }),
                });
                const data = await res.json();
                if (data.ok) {
                  setMessage("送信しました！ありがとうございます");
                  setFeedbackText("");
                } else {
                  setMessage(data.error || "送信に失敗しました");
                }
              } catch {
                setMessage("送信に失敗しました");
              }
              setFeedbackSending(false);
            }}
              disabled={!feedbackText.trim() || feedbackSending}
              className="w-full bg-gray-800 text-white font-bold rounded-full py-1.5 text-sm disabled:opacity-40 cursor-pointer">
              {feedbackSending ? "送信中..." : "送信する"}
            </button>
          </>
        )}

        <p className="text-xs text-gray-400 text-center">他の設定は順次追加予定</p>
      </div>
  );
}
