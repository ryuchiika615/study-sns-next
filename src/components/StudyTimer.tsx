"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const STORAGE_KEY = "ryutter_timer_start";
const STORAGE_PAUSED_KEY = "ryutter_timer_paused";

function getStartTime(): number | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  return v ? parseInt(v, 10) : null;
}

function getPausedElapsed(): number {
  if (typeof window === "undefined") return 0;
  const v = localStorage.getItem(STORAGE_PAUSED_KEY);
  return v ? parseInt(v, 10) : 0;
}

export default function StudyTimer({ onStop }: { onStop: (minutes: number) => void }) {
  const [status, setStatus] = useState<"idle" | "running" | "paused">("idle");
  const [display, setDisplay] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const pausedElapsedRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const saved = getStartTime();
    const savedPaused = getPausedElapsed();
    if (saved) {
      startTimeRef.current = saved;
      pausedElapsedRef.current = savedPaused;
      setStatus("running");
    } else if (savedPaused > 0) {
      pausedElapsedRef.current = savedPaused;
      setDisplay(savedPaused);
      setStatus("paused");
    }
  }, []);

  useEffect(() => {
    if (status === "running" && startTimeRef.current) {
      const tick = () => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);
        setDisplay(pausedElapsedRef.current + elapsed);
      };
      tick();
      tickRef.current = setInterval(tick, 1000);
      heartbeatRef.current = setInterval(() => {
        fetch("/api/study/heartbeat", { method: "POST" }).catch(() => {});
      }, 60000);
    } else {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      fetch("/api/study/heartbeat", { method: "DELETE" }).catch(() => {});
    };
  }, [status]);

  const handleStart = useCallback(() => {
    const now = Date.now();
    startTimeRef.current = now;
    pausedElapsedRef.current = 0;
    localStorage.setItem(STORAGE_KEY, String(now));
    localStorage.removeItem(STORAGE_PAUSED_KEY);
    fetch("/api/study/heartbeat", { method: "POST" }).catch(() => {});
    setStatus("running");
  }, []);

  const handlePause = useCallback(() => {
    if (!startTimeRef.current) return;
    const elapsed = pausedElapsedRef.current + Math.floor((Date.now() - startTimeRef.current) / 1000);
    pausedElapsedRef.current = elapsed;
    setDisplay(elapsed);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(STORAGE_PAUSED_KEY, String(elapsed));
    startTimeRef.current = null;
    fetch("/api/study/heartbeat", { method: "DELETE" }).catch(() => {});
    setStatus("paused");
  }, []);

  const handleResume = useCallback(() => {
    const now = Date.now();
    startTimeRef.current = now - pausedElapsedRef.current * 1000;
    pausedElapsedRef.current = 0;
    localStorage.setItem(STORAGE_KEY, String(startTimeRef.current));
    localStorage.removeItem(STORAGE_PAUSED_KEY);
    fetch("/api/study/heartbeat", { method: "POST" }).catch(() => {});
    setStatus("running");
  }, []);

  const handleStop = useCallback(() => {
    const totalElapsed = pausedElapsedRef.current + (startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0);
    const minutes = Math.floor(totalElapsed / 60);
    onStop(minutes);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_PAUSED_KEY);
    startTimeRef.current = null;
    pausedElapsedRef.current = 0;
    fetch("/api/study/heartbeat", { method: "DELETE" }).catch(() => {});
    setStatus("idle");
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
      {status === "idle" && (
        <button onClick={handleStart}
          className="bg-green-500 text-white rounded-full px-4 py-1 text-sm font-bold cursor-pointer hover:bg-green-600">
          <i className="fas fa-play mr-1" /> 開始
        </button>
      )}
      {status === "running" && (
        <>
          <button onClick={handlePause}
            className="bg-yellow-500 text-white rounded-full px-4 py-1 text-sm font-bold cursor-pointer hover:bg-yellow-600">
            <i className="fas fa-pause mr-1" /> 一時停止
          </button>
          <button onClick={handleStop}
            className="bg-red-500 text-white rounded-full px-4 py-1 text-sm font-bold cursor-pointer hover:bg-red-600">
            <i className="fas fa-stop mr-1" /> 停止
          </button>
        </>
      )}
      {status === "paused" && (
        <>
          <button onClick={handleResume}
            className="bg-green-500 text-white rounded-full px-4 py-1 text-sm font-bold cursor-pointer hover:bg-green-600">
            <i className="fas fa-play mr-1" /> 再開
          </button>
          <button onClick={handleStop}
            className="bg-red-500 text-white rounded-full px-4 py-1 text-sm font-bold cursor-pointer hover:bg-red-600">
            <i className="fas fa-stop mr-1" /> 停止
          </button>
        </>
      )}
    </div>
  );
}
