"use client";

import { useEffect, useState } from "react";
import XShareButton from "@/components/XShareButton";
import AchievementTitleForge from "@/components/AchievementTitleForge";

type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  condition_type: string;
  condition_value: number;
  reward_type: string;
  reward_value: number;
  progress: number;
  earned: boolean;
  earned_at: string | null;
  claimed: boolean;
};

const categoryLabels: Record<string, string> = {
  study_time: "勉強時間",
  streak: "連続学習",
  posts: "投稿",
  habits: "習慣",
  challenges: "チャレンジ",
  subjects: "科目",
  special: "スペシャル",
};

export default function AchievementsClient({ userId }: { userId: string }) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [category, setCategory] = useState<string>("all");
  const [tab, setTab] = useState<"all" | "earned" | "unearned">("all");
  const [titleMessage, setTitleMessage] = useState("");

  useEffect(() => {
    fetch("/api/achievements").then(r => r.json()).then(d => {
      if (d.achievements) setAchievements(d.achievements);
    });
  }, []);

  const claimReward = async (id: string) => {
    const res = await fetch("/api/achievements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ achievement_id: id }),
    });
    const data = await res.json();
    if (data.success) {
      setAchievements(prev => prev.map(a => a.id === id ? { ...a, claimed: true } : a));
    }
  };

  const categories = [...new Set(achievements.map(a => a.category))];

  let filtered = achievements;
  if (category !== "all") filtered = filtered.filter(a => a.category === category);
  if (tab === "earned") filtered = filtered.filter(a => a.earned);
  if (tab === "unearned") filtered = filtered.filter(a => !a.earned);

  const grouped = filtered.reduce((acc, a) => {
    const cat = a.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {} as Record<string, Achievement[]>);

  return (
    <div>
      <section className="mb-5 rounded-2xl border border-violet-300 bg-gradient-to-br from-violet-100 via-white to-fuchsia-100 p-3 shadow-sm">
        <div className="mb-2 px-1">
          <h2 className="text-base font-black text-violet-950">🔤 五十音称号コレクション</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-violet-900">実績を達成して「あ〜ん」を集めよう。称号の作成・装備はプロフィール設定からできます。</p>
        </div>
        <AchievementTitleForge collectionOnly onCreated={() => undefined} onMessage={setTitleMessage} />
        {titleMessage && <p className="mt-2 rounded-lg bg-white/80 px-3 py-2 text-xs font-bold text-violet-800">{titleMessage}</p>}
      </section>

      {/* Tab bar */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <button onClick={() => setTab("all")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer whitespace-nowrap transition ${tab === "all" ? "bg-primary text-white" : "bg-gray-100 text-gray-600"}`}>
          すべて
        </button>
        <button onClick={() => setTab("earned")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer whitespace-nowrap transition ${tab === "earned" ? "bg-primary text-white" : "bg-gray-100 text-gray-600"}`}>
          獲得済み
        </button>
        <button onClick={() => setTab("unearned")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer whitespace-nowrap transition ${tab === "unearned" ? "bg-primary text-white" : "bg-gray-100 text-gray-600"}`}>
          未獲得
        </button>
        <button onClick={() => setCategory("all")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer whitespace-nowrap transition ${category === "all" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600"}`}>
          全カテゴリ
        </button>
        {categories.map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer whitespace-nowrap transition ${category === c ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600"}`}>
            {categoryLabels[c] || c}
          </button>
        ))}
      </div>

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="mb-6">
          <h2 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">{categoryLabels[cat] || cat}</h2>
          <div className="space-y-2">
            {items.map(a => {
              const progressPct = Math.min(100, Math.round((a.progress / a.condition_value) * 100));
              const isComplete = a.progress >= a.condition_value;
              return (
                <div key={a.id} className={`relative rounded-xl border p-4 transition ${a.earned ? "bg-yellow-50/30 border-yellow-400" : "bg-gray-50 border-gray-200 opacity-60"}`}>
                  {!a.earned && <span className="absolute top-2 right-2 text-sm">🔒</span>}
                  <div className="flex items-start gap-3">
                    <span className={`text-2xl ${!a.earned ? "grayscale" : ""}`}>{a.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm">{a.title}</h3>
                        {a.earned && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">✓ 達成</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>

                      {/* Progress bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${isComplete ? "bg-yellow-400" : "bg-primary"}`}
                            style={{ width: `${progressPct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
                          {a.progress.toLocaleString()}/{a.condition_value.toLocaleString()}
                        </span>
                      </div>

                      {/* Reward + claim button */}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">
                          報酬: {a.reward_type === "points" ? `${a.reward_value}ポイント` : a.reward_type === "title" ? "称号" : "アイコン"}
                        </span>
                        {a.earned && !a.claimed && (
                          <button onClick={() => claimReward(a.id)}
                            className="text-xs bg-yellow-400 text-yellow-900 font-bold px-3 py-1 rounded-full hover:bg-yellow-300 cursor-pointer transition">
                            受け取る
                          </button>
                        )}
                        {a.claimed && (
                          <span className="text-xs text-green-500 font-bold">✅ 受取済み</span>
                        )}
                        {a.earned && (
                          <XShareButton compact shareType="achievement" entityId={a.id}
                            text={`🎉 「${a.title}」を獲得しました！\n\n${a.description}\n\nリュッターで勉強を記録しています。\n\n#リュッター #勉強記録`}
                            sharePath={`/share/achievement/${userId}/${a.id}`} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-8">該当する実績がありません</p>
      )}
    </div>
  );
}
