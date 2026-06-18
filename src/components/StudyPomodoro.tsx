"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

type Phase = "work" | "break";

const WORK_MINUTES = 25;
const BREAK_MINUTES = 5;

const PRESET_TRACKS = [
  { id: "none", label: "なし", url: "" },
  { id: "lofi", label: "Lo-fi", url: "https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&loop=1" },
  { id: "rain", label: "雨の音", url: "https://www.youtube.com/embed/mPZkdNFk_b4?autoplay=1&loop=1" },
  { id: "nature", label: "自然", url: "https://www.youtube.com/embed/eKFTSSKCzWA?autoplay=1&loop=1" },
];

const STORAGE_SESSION_KEY = "ryutter_pomodoro_session";

export default function StudyPomodoro() {
  const [phase, setPhase] = useState<Phase>("work");
  const [secondsLeft, setSecondsLeft] = useState(WORK_MINUTES * 60);
  const [running, setRunning] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [bgmId, setBgmId] = useState("none");
  const [userBgms, setUserBgms] = useState<{ id: string; name: string; audio_url: string }[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_SESSION_KEY);
    if (saved) setSessionCount(parseInt(saved, 10));
  }, []);

  useEffect(() => {
    const loadUserBgms = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [ownRes, purchasedRes] = await Promise.all([
        supabase.from("audio_bgm").select("id, name, audio_url").eq("user_id", user.id),
        supabase.from("purchased_bgm").select("bgm:bgm_id(id, name, audio_url)").eq("user_id", user.id),
      ]);
      const own = (ownRes.data || []).map((b: any) => ({ id: `user-${b.id}`, name: b.name, audio_url: b.audio_url }));
      const purchased = (purchasedRes.data || []).map((p: any) => p.bgm).filter(Boolean).map((b: any) => ({ id: `purchased-${b.id}`, name: b.name, audio_url: b.audio_url }));
      setUserBgms([...own, ...purchased]);
    };
    loadUserBgms();
  }, []);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            handlePhaseEnd();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (bgmId && bgmId !== "none") {
      const preset = PRESET_TRACKS.find((t) => t.id === bgmId);
      if (preset?.url) {
        const audio = new Audio(preset.url);
        audio.loop = true;
        audio.volume = 0.3;
        audioRef.current = audio;
        audio.play().catch(() => {});
        return;
      }
      const userBgm = userBgms.find((b) => b.id === bgmId);
      if (userBgm?.audio_url) {
        const audio = new Audio(userBgm.audio_url);
        audio.loop = true;
        audio.volume = 0.3;
        audioRef.current = audio;
        audio.play().catch(() => {});
      }
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [bgmId]);

  const handlePhaseEnd = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (phase === "work") {
      const newCount = sessionCount + 1;
      setSessionCount(newCount);
      localStorage.setItem(STORAGE_SESSION_KEY, String(newCount));
      setPhase("break");
      setSecondsLeft(BREAK_MINUTES * 60);
    } else {
      setPhase("work");
      setSecondsLeft(WORK_MINUTES * 60);
    }
    setRunning(false);
  }, [phase, sessionCount]);

  const handleStart = () => setRunning(true);
  const handlePause = () => setRunning(false);
  const handleReset = () => {
    setRunning(false);
    setPhase("work");
    setSecondsLeft(WORK_MINUTES * 60);
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = phase === "work"
    ? (secondsLeft / (WORK_MINUTES * 60)) * 100
    : (secondsLeft / (BREAK_MINUTES * 60)) * 100;

  return (
    <div className="pomodoro-card bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 cursor-pointer bg-transparent border-none text-left">
        <div className="flex items-center gap-2">
          <i className={`fas fa-clock text-sm ${running ? "text-green-500" : "text-gray-400"}`} />
          <span className="text-xs font-bold text-gray-700">集中タイマー</span>
          {running && (
            <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 animate-pulse">
              {phase === "work" ? "作業中" : "休憩中"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {running && (
            <span className="pomodoro-timer text-lg font-mono font-bold tabular-nums text-yellow-600">
              {fmt(secondsLeft)}
            </span>
          )}
          <i className={`fas fa-chevron-down text-xs text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2.5">
          {/* 経過バー */}
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-1000 ${phase === "work" ? "bg-green-500" : "bg-blue-400"}`}
              style={{ width: `${progress}%` }} />
          </div>

          <div className="flex items-center justify-center gap-4">
            <span className="pomodoro-timer text-4xl font-mono font-bold tabular-nums text-yellow-600">
              {fmt(secondsLeft)}
            </span>
          </div>

          <div className="flex items-center justify-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${phase === "work" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
              {phase === "work" ? "📚 勉強" : "☕ 休憩"}
            </span>
            <span className="pomodoro-label text-xs text-gray-400">
              {sessionCount}セッション完了
            </span>
          </div>

          <div className="flex items-center justify-center gap-2">
            {!running ? (
              <button onClick={handleStart}
                className="bg-green-500 text-white rounded-full px-5 py-1.5 text-sm font-bold cursor-pointer hover:bg-green-600 transition">
                <i className="fas fa-play mr-1" /> スタート
              </button>
            ) : (
              <button onClick={handlePause}
                className="bg-yellow-500 text-white rounded-full px-5 py-1.5 text-sm font-bold cursor-pointer hover:bg-yellow-600 transition">
                <i className="fas fa-pause mr-1" /> 一時停止
              </button>
            )}
            <button onClick={handleReset}
              className="bg-gray-200 text-gray-600 rounded-full px-4 py-1.5 text-xs font-bold cursor-pointer hover:bg-gray-300 transition">
              リセット
            </button>
          </div>

          {/* BGM */}
          <div className="flex items-center gap-2 pt-1">
            <i className="fas fa-music text-xs text-gray-400" />
            <select value={bgmId} onChange={(e) => setBgmId(e.target.value)}
              className="flex-1 rounded-lg border-gray-300 text-xs py-1">
              <optgroup label="プリセット">
                {PRESET_TRACKS.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </optgroup>
              {userBgms.length > 0 && (
                <optgroup label="あなたのBGM">
                  {userBgms.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
