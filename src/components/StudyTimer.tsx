"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import BgmToggle from "./BgmToggle";

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
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlName, setUrlName] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [ytVideoId, setYtVideoId] = useState("");
  const [ytPlaylistId, setYtPlaylistId] = useState("");
  const [ytPlaying, setYtPlaying] = useState(false);
  const [localBgms, setLocalBgms] = useState<{ id: string; name: string; audio_url: string }[]>([]);
  const [cachedBgms, setCachedBgms] = useState<Set<string>>(new Set());
  const [albumMode, setAlbumMode] = useState(false);
  const [albumTracks, setAlbumTracks] = useState<any[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [albumShuffle, setAlbumShuffle] = useState(false);
  const [albumName, setAlbumName] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytApiReadyRef = useRef(false);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const currentTrackIndexRef = useRef(0);
  const albumTracksRef = useRef<any[]>([]);
  const albumShuffleRef = useRef(false);
  const albumModeRef = useRef(false);
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
      const all = [...own, ...purchased];
      setUserBgms(all);
      // Check cache status
      const cached = new Set<string>();
      for (const b of all) {
        const exists = await idbGet("cache-" + b.audio_url);
        if (exists) cached.add(b.id);
      }
      setCachedBgms(cached);
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

  // Listen for BGM events from BgmPanel
  useEffect(() => {
    const onSelect = (e: Event) => {
      const id = (e as CustomEvent).detail;
      setAlbumMode(false);
      setAlbumTracks([]);
      setBgmId(id);
    };
    const onAlbumPlay = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const { id: albumId, shuffle } = detail;
      setAlbumMode(false);
      setAlbumTracks([]);
      setBgmId("none");
      try {
        const res = await fetch(`/api/bgm/albums/${albumId}`);
        if (!res.ok) return;
        const albumData = await res.json();
        setAlbumName(albumData.name || "");
      } catch {}
      const itemsRes = await fetch(`/api/bgm/albums/${albumId}/items`);
      if (!itemsRes.ok) return;
      const { data: items } = await itemsRes.json();
      if (!items?.length) return;
      setAlbumTracks(items);
      albumTracksRef.current = items;
      setAlbumShuffle(shuffle);
      albumShuffleRef.current = shuffle;
      const startIdx = shuffle ? Math.floor(Math.random() * items.length) : 0;
      setCurrentTrackIndex(startIdx);
      currentTrackIndexRef.current = startIdx;
      setAlbumMode(true);
      albumModeRef.current = true;
      // Play will be triggered by the effect below
    };
    const onRefresh = () => {
      setUserBgms([]);
      setLocalBgms([]);
      // Re-fetch user BGM
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        Promise.all([
          supabase.from("audio_bgm").select("id, name, audio_url").eq("user_id", user.id),
          supabase.from("purchased_bgm").select("bgm:bgm_id(id, name, audio_url)").eq("user_id", user.id),
        ]).then(async ([ownRes, purchasedRes]) => {
          const own = (ownRes.data || []).map((b: any) => ({ id: `user-${b.id}`, name: b.name, audio_url: b.audio_url }));
          const purchased = (purchasedRes.data || []).map((p: any) => p.bgm).filter(Boolean).map((b: any) => ({ id: `purchased-${b.id}`, name: b.name, audio_url: b.audio_url }));
          const all = [...own, ...purchased];
          setUserBgms(all);
          const cached = new Set<string>();
          for (const b of all) {
            const exists = await idbGet("cache-" + b.audio_url);
            if (exists) cached.add(b.id);
          }
          setCachedBgms(cached);
        });
      });
      // Re-fetch local BGM
      idbGet<{ id: string; name: string }[]>("list", "meta").then((meta) => {
        if (!meta) return;
        Promise.all(meta.map(async (m) => {
          const blob = await idbGet<Blob>(m.id);
          if (!blob) return null;
          return { id: m.id, name: m.name, audio_url: URL.createObjectURL(blob) };
        })).then((entries) => {
          setLocalBgms(entries.filter(Boolean) as { id: string; name: string; audio_url: string }[]);
        });
      });
    };
    window.addEventListener("bgm-select", onSelect);
    window.addEventListener("bgm-album-play", onAlbumPlay);
    window.addEventListener("bgm-list-changed", onRefresh);
    return () => {
      window.removeEventListener("bgm-select", onSelect);
      window.removeEventListener("bgm-album-play", onAlbumPlay);
      window.removeEventListener("bgm-list-changed", onRefresh);
    };
  }, []);

  const extractYtId = (url: string) => {
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|m\.youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (!m) return null;
    const listM = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    return { videoId: m[1], playlistId: listM ? listM[1] : "" };
  };

  // Load YouTube IFrame API
  useEffect(() => {
    if (typeof window !== "undefined" && !document.querySelector("#yt-api-script")) {
      const tag = document.createElement("script");
      tag.id = "yt-api-script";
      tag.src = "https://www.youtube.com/iframe_api";
      (window as any).onYouTubeIframeAPIReady = () => {
        ytApiReadyRef.current = true;
      };
      document.head.appendChild(tag);
    }
  }, []);

  // Advance to next track in album
  const advanceTrack = useCallback(() => {
    const tracks = albumTracksRef.current;
    if (!tracks.length) return;
    const shuffle = albumShuffleRef.current;
    let nextIdx: number;
    if (shuffle) {
      do { nextIdx = Math.floor(Math.random() * tracks.length); } while (tracks.length > 1 && nextIdx === currentTrackIndexRef.current);
    } else {
      nextIdx = (currentTrackIndexRef.current + 1) % tracks.length;
    }
    currentTrackIndexRef.current = nextIdx;
    setCurrentTrackIndex(nextIdx);
  }, []);

  // Play track from album
  const playTrack = useCallback(async (track: any) => {
    const el = audioElRef.current;
    if (!el) return;
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.destroy(); } catch {}
      ytPlayerRef.current = null;
    }
    if (ytContainerRef.current) {
      ytContainerRef.current.remove();
      ytContainerRef.current = null;
    }
    setYtVideoId("");
    setYtPlaylistId("");
    setYtPlaying(false);

    const yt = track.youtube_url ? extractYtId(track.youtube_url) : extractYtId(track.audio_url);
    if (yt) {
      const vid = yt.videoId;
      setYtVideoId(vid);
      setYtPlaylistId(yt.playlistId);
      setTimeout(() => {
        setYtPlaying(true);
        if (ytPlayerRef.current) {
          ytPlayerRef.current.playVideo();
          return;
        }
        const container = document.createElement("div");
        container.style.cssText = "position:fixed;top:-9999px;left:0;width:400px;height:300px;opacity:0;pointer-events:none";
        container.id = "yt-bgm-player";
        document.body.appendChild(container);
        ytContainerRef.current = container;
        const tryCreate = () => {
          if (!(window as any).YT?.Player) { setTimeout(tryCreate, 200); return; }
          ytPlayerRef.current = new (window as any).YT.Player("yt-bgm-player", {
            videoId: vid,
            height: 300, width: 400,
            playerVars: {
              autoplay: 1, loop: 0,
              controls: 0, playsinline: 1,
            },
            events: {
              onReady: (e: any) => { e.target.playVideo(); },
              onStateChange: (e: any) => {
                if (e.data === 0) advanceTrack();
              },
            },
          });
        };
        tryCreate();
      }, 50);
      return;
    }

    let audioSrc = track.audio_url;
    if (track.source_type === "local" && track.local_key) {
      const blob = await idbGet<Blob>(track.local_key);
      if (blob) audioSrc = URL.createObjectURL(blob);
    } else if (track.audio_url && !track.audio_url.startsWith("local://")) {
      const cacheKey = "cache-" + track.audio_url;
      let blob = await idbGet<Blob>(cacheKey);
      if (!blob) {
        try {
          const res = await fetch(track.audio_url);
          blob = await res.blob();
          await idbSave(cacheKey, blob);
        } catch {}
      }
      if (blob) audioSrc = URL.createObjectURL(blob);
    }
    el.src = audioSrc;
    el.loop = false;
    el.volume = 0.3;
    el.onended = () => advanceTrack();
    el.play().catch(() => {});
  }, [advanceTrack]);

  // Play single BGM (non-album mode)
  const playSingleBgm = useCallback(async (targetId: string) => {
    const el = audioElRef.current;
    if (el) { el.pause(); el.src = ""; el.onended = null; }
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.destroy(); } catch {}
      ytPlayerRef.current = null;
    }
    if (ytContainerRef.current) {
      ytContainerRef.current.remove();
      ytContainerRef.current = null;
    }
    setYtVideoId("");
    setYtPlaylistId("");
    setYtPlaying(false);

    if (targetId === "none") return;

    const preset = PRESET_TRACKS.find((t) => t.id === targetId);
    if (preset?.url) {
      const yt = extractYtId(preset.url);
      if (yt) { setYtVideoId(yt.videoId); setYtPlaylistId(yt.playlistId); return; }
      if (el) { el.src = preset.url; el.loop = true; el.volume = 0.3; el.play().catch(() => {}); }
      return;
    }
    const userBgm = userBgms.find((b) => b.id === targetId);
    const localBgm = localBgms.find((b) => b.id === targetId);
    const target = userBgm ?? localBgm;
    if (target?.audio_url && el) {
      const yt = extractYtId(target.audio_url);
      if (yt) { setYtVideoId(yt.videoId); setYtPlaylistId(yt.playlistId); return; }
      const cacheKey = "cache-" + target.audio_url;
      let blob = await idbGet<Blob>(cacheKey);
      if (!blob) {
        try {
          const res = await fetch(target.audio_url);
          blob = await res.blob();
          await idbSave(cacheKey, blob);
        } catch {}
      }
      if (el) {
        el.src = blob ? URL.createObjectURL(blob) : target.audio_url;
        el.loop = true;
        el.volume = 0.3;
        el.play().catch(() => {});
      }
    }
  }, [userBgms, localBgms]);

  // Sync refs when state changes
  useEffect(() => { albumModeRef.current = albumMode; }, [albumMode]);
  useEffect(() => { albumTracksRef.current = albumTracks; }, [albumTracks]);
  useEffect(() => { albumShuffleRef.current = albumShuffle; }, [albumShuffle]);
  useEffect(() => { currentTrackIndexRef.current = currentTrackIndex; }, [currentTrackIndex]);

  useEffect(() => {
    if (albumMode) return;
    playSingleBgm(bgmId);
  }, [bgmId, playSingleBgm, localBgms, albumMode]);

  useEffect(() => {
    if (!albumMode) return;
    const tracks = albumTracks;
    if (!tracks.length || currentTrackIndex >= tracks.length) return;
    playTrack(tracks[currentTrackIndex]);
  }, [currentTrackIndex, playTrack, albumMode, albumTracks]);

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

  const playYt = () => {
    if (!ytVideoId) return;
    setYtPlaying(true);
    if (ytPlayerRef.current) {
      ytPlayerRef.current.playVideo();
      return;
    }
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;top:-9999px;left:0;width:400px;height:300px;opacity:0;pointer-events:none";
    container.id = "yt-bgm-player";
    document.body.appendChild(container);
    ytContainerRef.current = container;
    const tryCreate = () => {
      if (!(window as any).YT?.Player) { setTimeout(tryCreate, 200); return; }
      ytPlayerRef.current = new (window as any).YT.Player("yt-bgm-player", {
        videoId: ytVideoId,
        height: 300, width: 400,
        playerVars: {
          autoplay: 1, loop: 1,
          playlist: ytVideoId,
          controls: 0, playsinline: 1,
        },
        events: {
          onReady: (e: any) => { e.target.playVideo(); },
          onStateChange: (e: any) => {
            if (e.data === 0) e.target.playVideo(); // loop
          },
        },
      });
    };
    tryCreate();
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
        <div className="ml-auto">
          <BgmToggle className="w-9 h-9 rounded-full bg-primary text-white shadow flex items-center justify-center cursor-pointer hover:bg-primary/80 border-none text-sm" iconOnly />
        </div>
      </div>
      {/* BGM */}
      <div className="flex items-center gap-2 px-1">
        <i className="fas fa-music text-xs text-gray-400" />
        {albumMode ? (
          <div className="flex-1 flex items-center gap-2 text-xs text-indigo-600">
            <i className="fas fa-compact-disc" />
            <span className="font-medium truncate">{albumName}</span>
            <span className="text-gray-400">
              {currentTrackIndex + 1} / {albumTracks.length}
              {albumShuffle && <span className="ml-1">🔀</span>}
            </span>
            <button onClick={() => { setAlbumMode(false); setAlbumTracks([]); setBgmId("none"); }}
              className="text-xs text-red-500 hover:text-red-700 cursor-pointer bg-transparent border-none ml-auto">
              <i className="fas fa-times" /> 解除
            </button>
          </div>
        ) : (
          <>
        <select value={bgmId} onChange={(e) => setBgmId(e.target.value)}
          className="flex-1 rounded-lg border-gray-300 text-xs py-1">
          <optgroup label="プリセット">
            {PRESET_TRACKS.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </optgroup>
          {userBgms.filter((b) => cachedBgms.has(b.id)).length > 0 && (
            <optgroup label="あなたのBGM（オフライン✓）">
              {userBgms.filter((b) => cachedBgms.has(b.id)).map((b) => (
                <option key={b.id} value={b.id}>✓ {b.name}</option>
              ))}
            </optgroup>
          )}
          {userBgms.filter((b) => !cachedBgms.has(b.id)).length > 0 && (
            <optgroup label="あなたのBGM（オンライン）">
              {userBgms.filter((b) => !cachedBgms.has(b.id)).map((b) => (
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
                    if (!window.confirm("このBGMを削除しますか？")) return;
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
        <button onClick={() => setShowUrlInput(true)}
          className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-1 cursor-pointer hover:bg-gray-200 shrink-0"
          title="YouTubeのURLを追加">
          <i className="fas fa-link" />
        </button>
          </>
        )}
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
      {ytVideoId && !ytPlaying && (
        <div className="flex items-center gap-2 px-1 mt-1">
          <button onClick={playYt}
            className="text-xs bg-red-500 text-white rounded-full px-3 py-1 cursor-pointer hover:bg-red-600 border-none flex items-center gap-1">
            <i className="fas fa-play" /> YouTube BGM
          </button>
          <span className="text-[10px] text-gray-400">タップで再生</span>
        </div>
      )}
    </div>
  );
}
