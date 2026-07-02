"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

const STORAGE_KEY = "ryutter_timer_start";
const STORAGE_PAUSED_KEY = "ryutter_timer_paused";

const DB_NAME = "ryutter-bgm";
const DB_VER = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("files")) db.createObjectStore("files");
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSave(id: string, value: unknown, store = "files") {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function idbGet<T>(id: string, store = "files"): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => { db.close(); resolve(req.result ?? undefined); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function idbDel(id: string, store = "files") {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

const PRESET_TRACKS = [
  { id: "none", label: "なし", url: "" },
  { id: "lofi", label: "Lo-fi", url: "https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&loop=1" },
  { id: "rain", label: "雨の音", url: "https://www.youtube.com/embed/mPZkdNFk_b4?autoplay=1&loop=1" },
  { id: "nature", label: "自然", url: "https://www.youtube.com/embed/eKFTSSKCzWA?autoplay=1&loop=1" },
];

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
  const [bgmId, setBgmId] = useState("none");
  const [userBgms, setUserBgms] = useState<{ id: string; name: string; audio_url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlName, setUrlName] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [ytUrl, setYtUrl] = useState("");
  const [localBgms, setLocalBgms] = useState<{ id: string; name: string; audio_url: string }[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const localInputRef = useRef<HTMLInputElement | null>(null);
  const supabase = createClient();

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
    (async () => {
      const meta = await idbGet<{ id: string; name: string }[]>("list", "meta");
      if (!meta) return;
      const entries = await Promise.all(meta.map(async (m) => {
        const blob = await idbGet<Blob>(m.id);
        if (!blob) return null;
        return { id: m.id, name: m.name, audio_url: URL.createObjectURL(blob) };
      }));
      setLocalBgms(entries.filter(Boolean) as { id: string; name: string; audio_url: string }[]);
    })();
  }, []);

  const toYtEmbed = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|m\.youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (!match) return null;
    const videoId = match[1];
    const listMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    const listParam = listMatch ? `&list=${listMatch[1]}` : "";
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}${listParam}&controls=0&playsinline=1`;
  };

  useEffect(() => {
    setYtUrl("");
    const el = audioElRef.current;
    if (el) { el.pause(); el.src = ""; }
    if (bgmId && bgmId !== "none") {
      const preset = PRESET_TRACKS.find((t) => t.id === bgmId);
      if (preset?.url) {
        const embed = toYtEmbed(preset.url);
        if (embed) { setYtUrl(embed); return; }
        if (el) { el.src = preset.url; el.loop = true; el.volume = 0.3; el.play().catch(() => {}); }
        return;
      }
      const userBgm = userBgms.find((b) => b.id === bgmId);
      const localBgm = localBgms.find((b) => b.id === bgmId);
      const target = userBgm ?? localBgm;
      if (target?.audio_url && el) {
        const embed = toYtEmbed(target.audio_url);
        if (embed) { setYtUrl(embed); return; }
        el.src = target.audio_url;
        el.loop = true;
        el.volume = 0.3;
        el.play().catch(() => {});
      }
    }
    return () => {
      if (el) { el.pause(); el.src = ""; }
      setYtUrl("");
    };
  }, [bgmId, localBgms]);

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

  const refreshBgms = async () => {
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

  const addUrlBgm = async () => {
    if (!urlName.trim() || !urlValue.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("audio_bgm").insert({
      user_id: user.id, name: urlName.trim(), duration_seconds: 0, audio_url: urlValue.trim(), price: 0,
    });
    setUrlName("");
    setUrlValue("");
    setShowUrlInput(false);
    await refreshBgms();
  };

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }
    const fileExt = file.name.split(".").pop() || "mp3";
    const fileName = `bgm/${user.id}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("audio-bgm")
      .upload(fileName, file);
    if (uploadError) { setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("audio-bgm").getPublicUrl(fileName);
    if (!urlData?.publicUrl) { setUploading(false); return; }
    const name = file.name.replace(/\.[^/.]+$/, "").slice(0, 50);
    await supabase.from("audio_bgm").insert({
      user_id: user.id, name, duration_seconds: 0, audio_url: urlData.publicUrl, price: 0,
    });
    await refreshBgms();
    setUploading(false);
  };

  const handleLocalFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.replace(/\.[^/.]+$/, "").slice(0, 50);
    const id = `local-${Date.now()}`;
    const blobUrl = URL.createObjectURL(file);
    setLocalBgms((prev) => [...prev, { id, name, audio_url: blobUrl }]);
    setBgmId(id);
    await idbSave(id, file);
    const meta = (await idbGet<{ id: string; name: string }[]>("list", "meta")) || [];
    meta.push({ id, name });
    await idbSave("list", meta, "meta");
  };

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-2">
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
      {/* BGM */}
      <div className="flex items-center gap-2 px-1">
        <i className="fas fa-music text-xs text-gray-400" />
        <select value={bgmId} onChange={(e) => setBgmId(e.target.value)}
          className="flex-1 rounded-lg border-gray-300 text-xs py-1">
          <optgroup label="プリセット">
            {PRESET_TRACKS.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </optgroup>
          {userBgms.length > 0 && (
            <optgroup label="あなたのBGM（オンライン）">
              {userBgms.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </optgroup>
          )}
          {localBgms.length > 0 && (
            <optgroup label="ローカル（オフライン）">
              {localBgms.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </optgroup>
          )}
          {localBgms.length > 0 && (
            <div className="flex flex-wrap gap-1 px-1 pt-1">
              {localBgms.map((b) => (
                <span key={b.id} className="flex items-center gap-1 bg-gray-100 rounded-full px-2 py-0.5 text-[10px]">
                  {b.name}
                  <button onClick={async () => {
                    URL.revokeObjectURL(b.audio_url);
                    const meta = (await idbGet<{ id: string; name: string }[]>("list", "meta")) || [];
                    await idbSave("list", meta.filter((m) => m.id !== b.id), "meta");
                    await idbDel(b.id);
                    setLocalBgms((prev) => prev.filter((x) => x.id !== b.id));
                    if (bgmId === b.id) setBgmId("none");
                  }} className="text-gray-400 hover:text-red-500 cursor-pointer leading-none">&times;</button>
                </span>
              ))}
            </div>
          )}
        </select>
        <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
        <input ref={localInputRef} type="file" accept="audio/*" className="hidden" onChange={handleLocalFile} />
        <div className="flex gap-1 shrink-0">
          <button onClick={() => localInputRef.current?.click()}
            className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-1 cursor-pointer hover:bg-gray-200"
            title="ローカルファイルを開く（オフライン・アップロードなし）">
            <i className="fas fa-folder-open" />
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-1 cursor-pointer hover:bg-gray-200 disabled:opacity-40"
            title="ファイルをアップロード">
            {uploading ? "..." : <i className="fas fa-upload" />}
          </button>
          <button onClick={() => setShowUrlInput(true)}
            className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-1 cursor-pointer hover:bg-gray-200"
            title="URLを追加">
            <i className="fas fa-link" />
          </button>
        </div>
      </div>
      {showUrlInput && (
        <div className="flex flex-col gap-1 px-1">
          <div className="flex items-center gap-2">
            <input type="text" value={urlName} onChange={(e) => setUrlName(e.target.value)}
              placeholder="名前" className="flex-1 rounded-lg border-gray-300 text-xs py-1 px-2" />
            <input type="url" value={urlValue} onChange={(e) => setUrlValue(e.target.value)}
              placeholder="YouTubeのURLまたは音声ファイルの直リンク" className="flex-[3] rounded-lg border-gray-300 text-xs py-1 px-2" />
            <button onClick={addUrlBgm} disabled={!urlName.trim() || !urlValue.trim()}
              className="text-xs bg-primary text-white rounded-full px-3 py-1 cursor-pointer disabled:opacity-40">
              追加
            </button>
            <button onClick={() => setShowUrlInput(false)}
              className="text-xs text-gray-500 cursor-pointer">
              取消
            </button>
          </div>
          <p className="text-[10px] text-gray-400">YouTubeのURLをそのまま貼れば再生できます（ストレージ消費ゼロ）</p>
        </div>
      )}
      <audio ref={audioElRef} className="hidden" />
      {ytUrl && (
        <iframe ref={iframeRef} src={ytUrl}
          className="fixed -top-96 left-0 w-[400px] h-[300px] opacity-0 pointer-events-none"
          allow="autoplay" />
      )}
    </div>
  );
}
