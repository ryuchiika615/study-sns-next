"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const STORAGE_KEY = "ryutter_timer_start";

function getStartTime(): number | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  return v ? parseInt(v, 10) : null;
}

export default function StudyTimer({ onStop }: { onStop: (minutes: number) => void }) {
  const [running, setRunning] = useState(false);
  const [display, setDisplay] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const saved = getStartTime();
    if (saved) {
      startTimeRef.current = saved;
      setRunning(true);
    }
  }, []);

  useEffect(() => {
    if (running && startTimeRef.current) {
      const tick = () => {
        setDisplay(Math.floor((Date.now() - startTimeRef.current!) / 1000));
      };
      tick();
      tickRef.current = setInterval(tick, 1000);
    } else if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [running]);

  const handleStart = useCallback(() => {
    const now = Date.now();
    startTimeRef.current = now;
    localStorage.setItem(STORAGE_KEY, String(now));
    setRunning(true);
  }, []);

  const handleStop = useCallback(() => {
    if (!startTimeRef.current) return;
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const minutes = Math.floor(elapsed / 60);
    onStop(minutes);
    localStorage.removeItem(STORAGE_KEY);
    startTimeRef.current = null;
    setRunning(false);
    setDisplay(0);
  }, [onStop]);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
      <span className="text-2xl font-mono font-bold tabular-nums">{fmt(display)}</span>
      {!running ? (
        <button onClick={handleStart}
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
