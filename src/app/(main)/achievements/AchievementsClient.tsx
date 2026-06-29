"use client";

import { useEffect, useState } from "react";

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
  const [tab, setTab] = useState<"all" | "earned">("all");

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

  const grouped = filtered.reduce((acc, a) => {
    const cat = a.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {} as Record<string, Achievement[]>);

  return (
    <div>
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
                <div key={a.id} className={`bg-white rounded-xl border p-4 transition ${a.earned ? "border-yellow-400 bg-yellow-50/30" : "border-gray-100"}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{a.icon}</span>
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
