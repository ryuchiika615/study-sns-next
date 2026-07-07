"use client";

import Link from "next/link";

const ratingLabels = ["Again", "Hard", "Good", "Easy"];
const ratingColors = ["bg-red-500", "bg-orange-500", "bg-green-500", "bg-blue-500"];

export default function StatsClient({
  totalCards,
  totalReviews,
  todayReviews,
  dueCards,
  decksCount,
  streak,
  dailyLogs,
  dueProjection,
  ratingDistribution,
}: {
  totalCards: number;
  totalReviews: number;
  todayReviews: number;
  dueCards: number;
  decksCount: number;
  streak: { current_streak: number; longest_streak: number; last_study_date: string } | null;
  dailyLogs: any[];
  dueProjection: { date: string; count: number }[];
  ratingDistribution: number[];
}) {
  // Calendar heatmap: build map of date -> count
  const logMap = new Map(dailyLogs.map((l: any) => [l.date, l.cards_reviewed + l.cards_new]));

  // Generate last 365 days
  const today = new Date();
  const yearDays: { date: string; count: number }[] = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    yearDays.push({ date: dateStr, count: logMap.get(dateStr) || 0 });
  }

  // Weeks for calendar
  const weeks: { date: string; count: number }[][] = [];
  let week: { date: string; count: number }[] = [];
  yearDays.forEach((day, i) => {
    const dayOfWeek = new Date(day.date).getDay();
    if (dayOfWeek === 0 && week.length > 0) { weeks.push(week); week = []; }
    week.push(day);
    if (i === yearDays.length - 1) weeks.push(week);
  });

  const maxCount = Math.max(...yearDays.map((d) => d.count), 1);
  const getHeatColor = (count: number) => {
    if (count === 0) return "bg-gray-100";
    const intensity = Math.min(count / maxCount, 1);
    if (intensity < 0.25) return "bg-green-200";
    if (intensity < 0.5) return "bg-green-300";
    if (intensity < 0.75) return "bg-green-400";
    return "bg-green-500";
  };

  const totalRatingCount = ratingDistribution.reduce((a, b) => a + b, 0);
  const dueSum = dueProjection.reduce((a, b) => a + b.count, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Link href="/study" className="text-gray-400 text-sm"><i className="fas fa-arrow-left mr-1" />戻る</Link>
          <h1 className="text-lg font-bold">学習統計</h1>
        </div>

        {/* Streak */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <div className="text-5xl mb-2">
            {streak && streak.current_streak > 0 ? (
              <span className={`${streak.current_streak >= 7 ? "text-orange-500" : "text-yellow-500"}`}>
                <i className="fas fa-fire" />
              </span>
            ) : (
              <span className="text-gray-300"><i className="far fa-calendar" /></span>
            )}
          </div>
          <p className="text-3xl font-bold">
            {streak?.current_streak || 0}
            <span className="text-base text-gray-500 font-normal ml-1">日連続</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            最長記録: {streak?.longest_streak || 0}日
            {streak?.last_study_date && ` · 最終学習: ${streak.last_study_date}`}
          </p>
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalCards}</p>
            <p className="text-xs text-gray-500">総カード数</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-purple-500">{totalReviews}</p>
            <p className="text-xs text-gray-500">総復習数</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{todayReviews}</p>
            <p className="text-xs text-gray-500">今日の復習</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-orange-500">{dueCards}</p>
            <p className="text-xs text-gray-500">復習待ち</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-700">{decksCount}</p>
            <p className="text-xs text-gray-500">デッキ数</p>
          </div>
        </div>

        {/* Calendar heatmap */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-bold mb-3">学習カレンダー</h3>
          <div className="flex gap-0.5 overflow-x-auto pb-2">
            {weeks.map((w, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {w.map((day) => (
                  <div
                    key={day.date}
                    className={`w-3 h-3 rounded-sm ${getHeatColor(day.count)}`}
                    title={`${day.date}: ${day.count}枚`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-400 justify-end">
            <span>少</span>
            <div className="w-3 h-3 rounded-sm bg-gray-100" />
            <div className="w-3 h-3 rounded-sm bg-green-200" />
            <div className="w-3 h-3 rounded-sm bg-green-300" />
            <div className="w-3 h-3 rounded-sm bg-green-400" />
            <div className="w-3 h-3 rounded-sm bg-green-500" />
            <span>多</span>
          </div>
        </div>

        {/* Due projection */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-bold mb-3">復習予定（30日間）</h3>
          <p className="text-xs text-gray-400 mb-3">合計 {dueSum}枚の復習が予定されています</p>
          <div className="flex items-end gap-1 h-24">
            {dueProjection.map((d) => {
              const maxCount = Math.max(...dueProjection.map((x) => x.count), 1);
              const height = (d.count / maxCount) * 100;
              const isToday = d.date === new Date().toISOString().split("T")[0];
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className={`w-full rounded-t ${isToday ? "bg-primary" : "bg-blue-300"} transition-all`}
                    style={{ height: `${Math.max(height, d.count > 0 ? 4 : 0)}%` }}
                  />
                  {d.count > 0 && <span className="text-[8px] text-gray-400">{d.count}</span>}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>今日</span>
            <span>15日後</span>
            <span>30日後</span>
          </div>
        </div>

        {/* Today's rating distribution */}
        {totalRatingCount > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold mb-3">今日の評価分布</h3>
            <div className="space-y-2">
              {ratingDistribution.map((count, i) => {
                const pct = totalRatingCount > 0 ? Math.round((count / totalRatingCount) * 100) : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span>{ratingLabels[i]}</span>
                      <span className="text-gray-500">{count}回 ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${ratingColors[i]}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
