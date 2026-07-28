"use client";

import { useState } from "react";

export default function StatsCards({ profile, totalMinutes, goalMinutes, totalWorkoutMinutes }: { profile: any; totalMinutes: number; goalMinutes: number; totalWorkoutMinutes: number }) {
  const [showWorkout, setShowWorkout] = useState(false);
  const formatRemaining = (minutes: number) => {
    if (minutes <= 0) return "目標達成！🎉";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}時間${m}分`;
    if (h > 0) return `${h}時間`;
    return `${m}分`;
  };

  const isTargetExpired = profile?.target_date
    ? new Date(profile.target_date + "T23:59:59") < new Date()
    : false;

  const displayMinutes = showWorkout ? totalWorkoutMinutes : totalMinutes;

  return (
    <div className="mx-4 mb-3 space-y-3">
      {(totalMinutes > 0 || totalWorkoutMinutes > 0) && (
        <div>
          <div className={`p-4 rounded-xl text-white text-center shadow-sm border ${
            showWorkout
              ? "bg-gradient-to-r from-pink-900 to-pink-700 border-pink-400"
              : "bg-gradient-to-r from-blue-900 to-blue-700 border-blue-400"
          }`}>
            <p className={`text-sm ${showWorkout ? "text-pink-200" : "text-blue-200"}`}>
              {showWorkout ? "総筋トレ時間" : "総勉強時間"}
            </p>
            <p className="text-2xl font-bold">{formatRemaining(displayMinutes)}</p>
          </div>
          <div className="flex justify-center mt-1.5">
            <div className="inline-flex bg-gray-100 rounded-full p-0.5">
              <button onClick={() => setShowWorkout(false)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer border-none ${
                  !showWorkout ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 bg-transparent"
                }`}>
                勉強
              </button>
              <button onClick={() => setShowWorkout(true)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer border-none ${
                  showWorkout ? "bg-white text-pink-600 shadow-sm" : "text-gray-500 bg-transparent"
                }`}>
                筋トレ
              </button>
            </div>
          </div>
        </div>
      )}
      {profile?.target_date && profile?.target_minutes > 0 && !isTargetExpired && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-gray-900 to-gray-800 text-white border border-yellow-600 text-center shadow-sm">
          <h4 className="text-yellow-500 m-0 mb-2"><i className="fas fa-bullseye" /> {profile.target_date} までの目標</h4>
          <p className="text-sm text-gray-400">目標合計 {Math.floor(profile.target_minutes / 60)}時間{profile.target_minutes % 60}分</p>
          <p className="text-lg text-yellow-400 font-bold mt-1">あと {formatRemaining(profile.target_minutes - goalMinutes)}</p>
        </div>
      )}
    </div>
  );
}
