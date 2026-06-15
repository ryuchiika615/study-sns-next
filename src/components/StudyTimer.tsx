"use client";

import { useState, useRef, useEffect } from "react";

export default function StudyTimer({ onStop }: { onStop: (minutes: number) => void }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const handleStop = () => {
    setRunning(false);
    const minutes = Math.max(1, Math.round(elapsed / 60));
    onStop(minutes);
    setElapsed(0);
  };

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
      <span className="text-2xl font-mono font-bold tabular-nums">{fmt(elapsed)}</span>
      {!running ? (
        <button onClick={() => setRunning(true)}
          className="bg-green-500 text-white rounded-full px-4 py-1 text-sm font-bold cursor-pointer hover:bg-green-600">
          <i className="fas fa-play mr-1" /> 開始
        </button>
      ) : (
        <button onClick={handleStop}
          className="bg-red-500 text-white rounded-full px-4 py-1 text-sm font-bold cursor-pointer hover:bg-red-600">
          <i className="fas fa-stop mr-1" /> 停止
        </button>
      )}
    </div>
  );
}
