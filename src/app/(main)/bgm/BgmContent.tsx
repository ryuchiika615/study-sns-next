"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

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

interface BgmItem {
  id: string;
  name: string;
  audio_url: string;
  source: "own" | "purchased" | "local";
  dbId?: string;
}

interface Album {
  id: string;
  name: string;
  shuffle: boolean;
  created_at: string;
}

interface AlbumItem {
  id: string;
  album_id: string;
  bgm_id: string | null;
  source_type: "db" | "youtube" | "local";
  name: string;
  audio_url: string;
  youtube_url: string | null;
  local_key: string | null;
  position: number;
}

export default function BgmContent() {
  const supabase = createClient();
  const [bgms, setBgms] = useState<BgmItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ytRequestUrl, setYtRequestUrl] = useState("");
  const [ytRequestTitle, setYtRequestTitle] = useState("");
  const [ytRequesting, setYtRequesting] = useState(false);
  const [ytRequestDone, setYtRequestDone] = useState(false);
  const [ytError, setYtError] = useState("");
  const [cachingId, setCachingId] = useState<string | null>(null);
  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumItems, setAlbumItems] = useState<Record<string, AlbumItem[]>>({});
  const [expandedAlbum, setExpandedAlbum] = useState<string | null>(null);
  const [showNewAlbum, setShowNewAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [addingToAlbum, setAddingToAlbum] = useState<string | null>(null);
  const localInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const loadAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [ownRes, purchasedRes] = await Promise.all([
      supabase.from("audio_bgm").select("id, name, audio_url").eq("user_id", user.id),
      supabase.from("purchased_bgm").select("bgm:bgm_id(id, name, audio_url)").eq("user_id", user.id),
    ]);

    const own: BgmItem[] = (ownRes.data || []).map((b: any) => ({
      id: `user-${b.id}`, name: b.name, audio_url: b.audio_url, source: "own" as const, dbId: b.id,
    }));
    const purchased: BgmItem[] = (purchasedRes.data || []).map((p: any) => p.bgm).filter(Boolean).map((b: any) => ({
      id: `purchased-${b.id}`, name: b.name, audio_url: b.audio_url, source: "purchased" as const,
    }));

    const meta = await idbGet<{ id: string; name: string }[]>("list", "meta");
    const local: BgmItem[] = meta ? meta.map((m) => ({
      id: m.id, name: m.name, audio_url: `local://${m.id}`, source: "local" as const,
    })) : [];

    setBgms([...own, ...purchased, ...local]);
  };

  const loadAlbums = async () => {
    const res = await fetch("/api/bgm/albums");
    if (res.ok) {
      const { data } = await res.json();
      setAlbums(data || []);
    }
  };

  const loadAlbumItems = async (albumId: string) => {
    const res = await fetch(`/api/bgm/albums/${albumId}/items`);
    if (res.ok) {
      const { data } = await res.json();
      setAlbumItems((prev) => ({ ...prev, [albumId]: data || [] }));
    }
  };

  useEffect(() => {
    loadAll();
    loadAlbums();
  }, []);

  useEffect(() => {
    if (bgms.length > 0) checkCache(bgms);
  }, [bgms]);

  useEffect(() => {
    if (expandedAlbum && !albumItems[expandedAlbum]) {
      loadAlbumItems(expandedAlbum);
    }
  }, [expandedAlbum]);

  const checkCache = async (items: BgmItem[]) => {
    const cached = new Set<string>();
    for (const item of items) {
      if (item.source === "local") { cached.add(item.id); continue; }
      const exists = await idbGet("cache-" + item.audio_url);
      if (exists) cached.add(item.id);
    }
    setCachedIds(cached);
  };

  const cacheBgm = async (item: BgmItem) => {
    setCachingId(item.id);
    try {
      const res = await fetch(item.audio_url);
      const blob = await res.blob();
      await idbSave("cache-" + item.audio_url, blob);
      setCachedIds((prev) => new Set(prev).add(item.id));
    } catch {}
    setCachingId(null);
  };

  const selectBgm = (item: BgmItem) => {
    setActiveId(item.id);
    window.dispatchEvent(new CustomEvent("bgm-select", { detail: item.id }));
  };

  const deleteBgm = async (item: BgmItem) => {
    if (!window.confirm("このBGMを削除しますか？")) return;
    if (item.source === "own" && item.dbId) {
      await supabase.from("audio_bgm").delete().eq("id", item.dbId);
    }
    if (item.source === "local") {
      await idbDel(item.id);
      const meta = (await idbGet<{ id: string; name: string }[]>("list", "meta")) || [];
      await idbSave("list", meta.filter((m) => m.id !== item.id), "meta");
    }
    window.dispatchEvent(new CustomEvent("bgm-list-changed"));
    loadAll();
  };

  const startRename = (item: BgmItem) => {
    setRenamingId(item.id);
    setRenameValue(item.name);
  };

  const saveRename = async (item: BgmItem) => {
    if (!renameValue.trim()) return;
    if (item.source === "own" && item.dbId) {
      await fetch("/api/bgm/rename", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.dbId, name: renameValue.trim() }),
      });
    }
    if (item.source === "local") {
      const meta = (await idbGet<{ id: string; name: string }[]>("list", "meta")) || [];
      const idx = meta.findIndex((m) => m.id === item.id);
      if (idx >= 0) {
        meta[idx].name = renameValue.trim().slice(0, 50);
        await idbSave("list", meta, "meta");
      }
    }
    setRenamingId(null);
    setRenameValue("");
    window.dispatchEvent(new CustomEvent("bgm-list-changed"));
    loadAll();
  };

  const handleLocalFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.replace(/\.[^/.]+$/, "").slice(0, 50);
    const id = `local-${Date.now()}`;
    await idbSave(id, file);
    const meta = (await idbGet<{ id: string; name: string }[]>("list", "meta")) || [];
    meta.push({ id, name });
    await idbSave("list", meta, "meta");
    window.dispatchEvent(new CustomEvent("bgm-list-changed"));
    loadAll();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }
    const fileExt = file.name.split(".").pop() || "mp3";
    const fileName = `bgm/${user.id}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from("audio-bgm").upload(fileName, file);
    if (uploadError) { setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("audio-bgm").getPublicUrl(fileName);
    if (!urlData?.publicUrl) { setUploading(false); return; }
    const name = file.name.replace(/\.[^/.]+$/, "").slice(0, 50);
    await supabase.from("audio_bgm").insert({
      user_id: user.id, name, duration_seconds: 0, audio_url: urlData.publicUrl, price: 0,
    });
    setUploading(false);
    window.dispatchEvent(new CustomEvent("bgm-list-changed"));
    loadAll();
  };

  const createAlbum = async () => {
    if (!newAlbumName.trim()) return;
    const res = await fetch("/api/bgm/albums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newAlbumName.trim() }),
    });
    if (res.ok) {
      setNewAlbumName("");
      setShowNewAlbum(false);
      loadAlbums();
    }
  };

  const toggleShuffle = async (album: Album) => {
    await fetch(`/api/bgm/albums/${album.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shuffle: !album.shuffle }),
    });
    loadAlbums();
  };

  const deleteAlbum = async (albumId: string) => {
    if (!window.confirm("このアルバムを削除しますか？")) return;
    await fetch(`/api/bgm/albums/${albumId}`, { method: "DELETE" });
    setAlbums((prev) => prev.filter((a) => a.id !== albumId));
    setExpandedAlbum((prev) => prev === albumId ? null : prev);
  };

  const addToAlbum = async (albumId: string, item: BgmItem) => {
    let sourceType: "db" | "youtube" | "local" = "db";
    let bgmId: string | undefined;
    let youtubeUrl: string | undefined;
    let localKey: string | undefined;

    if (item.source === "local") {
      sourceType = "local";
      localKey = item.id;
    } else if (item.audio_url.includes("youtube") || item.audio_url.includes("youtu.be")) {
      sourceType = "youtube";
      youtubeUrl = item.audio_url;
    } else {
      sourceType = "db";
      bgmId = item.dbId;
    }

    const res = await fetch(`/api/bgm/albums/${albumId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bgm_id: bgmId,
        source_type: sourceType,
        name: item.name,
        audio_url: item.audio_url,
        youtube_url: youtubeUrl,
        local_key: localKey,
      }),
    });

    if (res.ok) {
      setAddingToAlbum(null);
      loadAlbumItems(albumId);
    }
  };

  const removeFromAlbum = async (albumId: string, itemId: string) => {
    if (!window.confirm("この曲をアルバムから削除しますか？")) return;
    await fetch(`/api/bgm/albums/${albumId}/items/${itemId}`, { method: "DELETE" });
    loadAlbumItems(albumId);
  };

  const playAlbum = (album: Album) => {
    window.dispatchEvent(new CustomEvent("bgm-album-play", { detail: { id: album.id, shuffle: album.shuffle } }));
  };

  const reorderItems = async (albumId: string, items: AlbumItem[]) => {
    const reordered = items.map((it, i) => ({ ...it, position: i }));
    await fetch(`/api/bgm/albums/${albumId}/items`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: reordered }),
    });
    loadAlbumItems(albumId);
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
        <i className="fas fa-music text-primary" />
        <h2 className="text-base font-bold flex-1">マイBGM</h2>
        {bgms.some((b) => cachedIds.has(b.id)) && (
          <span className="text-[10px] text-green-600 flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full">
            <i className="fas fa-wifi-slash" /> オフライン可
          </span>
        )}
      </div>

      <div className="text-[10px] text-gray-400 flex items-center gap-3">
        <span><i className="fas fa-wifi mr-1" />オンライン</span>
        <span><i className="fas fa-download mr-1" />タップで保存</span>
        <span><i className="fas fa-check-circle text-green-500 mr-1" />オフライン可</span>
      </div>

      <div className="space-y-1">
        {bgms.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">BGMがありません</p>
        )}
        {bgms.map((item) => {
          const isCached = cachedIds.has(item.id);
          return (
            <div key={item.id} className={`flex items-center gap-3 p-2 rounded-xl ${
              activeId === item.id ? "bg-primary/10 border border-primary/30" : isCached ? "bg-green-50/30 border border-green-100" : "hover:bg-gray-50"
            }`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isCached ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                <i className={`fas ${isCached ? "fa-check-circle" : "fa-music"}`} />
              </div>
              <div className="flex-1 min-w-0">
                {renamingId === item.id ? (
                  <div className="flex items-center gap-1">
                    <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                      className="flex-1 rounded border-gray-300 text-sm py-0.5 px-1 min-w-0"
                      autoFocus onKeyDown={(e) => { if (e.key === "Enter") saveRename(item); if (e.key === "Escape") setRenamingId(null); }} />
                    <button onClick={() => saveRename(item)}
                      className="text-xs text-green-600 cursor-pointer bg-transparent border-none p-1">
                      <i className="fas fa-check" />
                    </button>
                    <button onClick={() => setRenamingId(null)}
                      className="text-xs text-gray-400 cursor-pointer bg-transparent border-none p-1">
                      <i className="fas fa-times" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm font-medium truncate">{item.name}</p>
                )}
                <p className={`text-[10px] ${isCached ? "text-green-600" : "text-gray-400"} flex items-center gap-1`}>
                  {isCached && <i className="fas fa-wifi-slash" />}
                  {item.source === "local" ? "オフライン ✓" : isCached ? "オフライン ✓" : item.source === "own" ? "アップロード" : "購入"}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                {renamingId !== item.id && (
                  <button onClick={() => selectBgm(item)}
                    className="text-xs bg-primary text-white rounded-full px-3 py-1 cursor-pointer hover:bg-primary/80 border-none">
                    {activeId === item.id ? "使用中" : "使う"}
                  </button>
                )}
                {(item.source === "own" || item.source === "local") && renamingId !== item.id && (
                  <button onClick={() => startRename(item)}
                    className="text-xs text-gray-500 hover:bg-gray-100 rounded-full px-2 py-1 cursor-pointer border-none bg-transparent"
                    title="名前を変更">
                    <i className="fas fa-pencil-alt" />
                  </button>
                )}
                {item.source !== "local" && !isCached && renamingId !== item.id && (
                  <button onClick={() => cacheBgm(item)} disabled={cachingId === item.id}
                    className="text-xs text-gray-500 hover:bg-gray-100 rounded-full px-2 py-1 cursor-pointer border-none bg-transparent"
                    title="オフライン保存">
                    <i className={`fas ${cachingId === item.id ? "fa-spinner fa-spin" : "fa-download"}`} />
                  </button>
                )}
                {isCached && renamingId !== item.id && (
                  <span className="text-[10px] text-green-600 flex items-center px-1">
                    <i className="fas fa-check-circle" />
                  </span>
                )}
                {albums.length > 0 && renamingId !== item.id && (
                  <div className="relative">
                    <button onClick={() => setAddingToAlbum(addingToAlbum === item.id ? null : item.id)}
                      className="text-xs text-gray-500 hover:bg-gray-100 rounded-full px-2 py-1 cursor-pointer border-none bg-transparent"
                      title="アルバムに追加">
                      <i className="fas fa-folder-plus" />
                    </button>
                    {addingToAlbum === item.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setAddingToAlbum(null)} />
                        <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-xl border border-gray-200 p-1 min-w-[160px]">
                          {albums.map((a) => (
                            <button key={a.id} onClick={() => addToAlbum(a.id, item)}
                              className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 rounded-lg cursor-pointer bg-transparent border-none">
                              {a.name}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                {(item.source === "own" || item.source === "local") && renamingId !== item.id && (
                  <button onClick={() => deleteBgm(item)}
                    className="text-xs text-red-500 hover:bg-red-50 rounded-full px-2 py-1 cursor-pointer border-none bg-transparent"
                    title="削除">
                    <i className="fas fa-trash-alt" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Albums Section */}
      <div className="border-t border-gray-200 pt-4 space-y-2">
        <div className="flex items-center gap-2">
          <i className="fas fa-compact-disc text-indigo-500" />
          <h3 className="text-sm font-bold flex-1">アルバム</h3>
          <button onClick={() => setShowNewAlbum(true)}
            className="text-xs bg-indigo-100 text-indigo-600 rounded-full px-3 py-1 cursor-pointer hover:bg-indigo-200 border-none">
            <i className="fas fa-plus mr-1" />新規
          </button>
        </div>

        {showNewAlbum && (
          <div className="flex items-center gap-2">
            <input type="text" value={newAlbumName} onChange={(e) => setNewAlbumName(e.target.value)}
              placeholder="アルバム名" className="flex-1 rounded-lg border-gray-300 text-sm py-1.5 px-2"
              onKeyDown={(e) => { if (e.key === "Enter") createAlbum(); if (e.key === "Escape") { setShowNewAlbum(false); setNewAlbumName(""); } }}
              autoFocus />
            <button onClick={createAlbum}
              className="text-xs bg-indigo-600 text-white rounded-full px-3 py-1.5 cursor-pointer border-none">
              作成
            </button>
            <button onClick={() => { setShowNewAlbum(false); setNewAlbumName(""); }}
              className="text-xs text-gray-500 cursor-pointer bg-transparent border-none">
              取消
            </button>
          </div>
        )}

        {albums.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">アルバムがありません</p>
        )}

        {albums.map((album) => (
          <div key={album.id} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
              <i className={`fas ${album.shuffle ? "fa-random text-indigo-500" : "fa-repeat text-gray-400"} text-xs`} />
              <button onClick={() => setExpandedAlbum(expandedAlbum === album.id ? null : album.id)}
                className="flex-1 text-left text-sm font-medium truncate cursor-pointer bg-transparent border-none hover:text-indigo-600">
                {album.name}
              </button>
              <button onClick={() => toggleShuffle(album)}
                className={`text-xs rounded-full px-2 py-0.5 cursor-pointer border-none ${album.shuffle ? "bg-indigo-100 text-indigo-600" : "bg-gray-200 text-gray-500"}`}
                title={album.shuffle ? "ランダム再生ON" : "ランダム再生OFF"}>
                <i className="fas fa-random mr-1" />{album.shuffle ? "ON" : "OFF"}
              </button>
              <button onClick={() => playAlbum(album)}
                className="text-xs bg-indigo-600 text-white rounded-full px-3 py-1 cursor-pointer hover:bg-indigo-700 border-none"
                title={album.shuffle ? "ランダム再生" : "順次再生"}>
                <i className="fas fa-play" />
              </button>
              <button onClick={() => deleteAlbum(album.id)}
                className="text-xs text-red-400 hover:text-red-600 cursor-pointer bg-transparent border-none p-1"
                title="アルバムを削除">
                <i className="fas fa-trash-alt" />
              </button>
            </div>

            {expandedAlbum === album.id && (
              <div className="px-3 py-2 space-y-1 bg-white">
                {(albumItems[album.id]?.length ?? 0) === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">曲がありません（BGMの 📁 ボタンから追加）</p>
                )}
                {albumItems[album.id]?.map((ai, idx) => (
                  <div key={ai.id} className="flex items-center gap-2 py-1">
                    <span className="text-[10px] text-gray-400 w-4 text-right">{idx + 1}.</span>
                    <span className="flex-1 text-xs truncate">{ai.name}</span>
                    <button onClick={() => removeFromAlbum(album.id, ai.id)}
                      className="text-xs text-red-400 hover:text-red-600 cursor-pointer bg-transparent border-none p-1">
                      <i className="fas fa-times" />
                    </button>
                  </div>
                ))}
                {(albumItems[album.id]?.length ?? 0) >= 2 && (
                  <div className="flex gap-1 pt-1 border-t border-gray-100 mt-1">
                    <button onClick={() => {
                      const items = albumItems[album.id];
                      if (!items) return;
                      const shuffled = [...items].sort(() => Math.random() - 0.5);
                      setAlbumItems((prev) => ({ ...prev, [album.id]: shuffled }));
                      reorderItems(album.id, shuffled);
                    }}
                      className="text-[10px] text-gray-500 hover:bg-gray-100 rounded px-2 py-0.5 cursor-pointer bg-transparent border-none">
                      <i className="fas fa-random mr-1" />シャッフル
                    </button>
                    <button onClick={() => {
                      const items = albumItems[album.id];
                      if (!items) return;
                      const sorted = [...items].sort((a, b) => a.position - b.position);
                      setAlbumItems((prev) => ({ ...prev, [album.id]: sorted }));
                      reorderItems(album.id, sorted);
                    }}
                      className="text-[10px] text-gray-500 hover:bg-gray-100 rounded px-2 py-0.5 cursor-pointer bg-transparent border-none">
                      <i className="fas fa-sort-amount-down mr-1" />並び直し
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add BGM section */}
      <div className="border-t border-gray-200 pt-4 space-y-2">
        <div className="flex gap-2">
          <input ref={localInputRef} type="file" accept="audio/*" className="hidden" onChange={handleLocalFile} />
          <button onClick={() => localInputRef.current?.click()}
            className="flex-1 text-xs bg-gray-100 text-gray-700 rounded-full px-3 py-2 cursor-pointer hover:bg-gray-200 border-none flex items-center justify-center gap-1">
            <i className="fas fa-folder-open" /> ローカルファイル
          </button>
          <input ref={uploadInputRef} type="file" accept="audio/*" className="hidden" onChange={handleUpload} />
          <button onClick={() => uploadInputRef.current?.click()} disabled={uploading}
            className="flex-1 text-xs bg-gray-100 text-gray-700 rounded-full px-3 py-2 cursor-pointer hover:bg-gray-200 disabled:opacity-40 border-none flex items-center justify-center gap-1">
            {uploading ? "アップロード中..." : <><i className="fas fa-upload" /> アップロード</>}
          </button>
        </div>
        {!ytRequestUrl && !ytRequestDone && (
          <button onClick={() => { setYtRequestUrl("dummy"); setYtRequestTitle(""); }}
            className="text-xs bg-red-50 text-red-600 rounded-full px-3 py-2 cursor-pointer hover:bg-red-100 border-none flex items-center justify-center gap-1 w-full">
            <i className="fab fa-youtube" /> YouTubeのURLから追加
          </button>
        )}
        {ytRequestUrl && !ytRequestDone && (
          <div className="space-y-1">
            <input type="url" value={ytRequestUrl === "dummy" ? "" : ytRequestUrl}
              onChange={(e) => { setYtRequestUrl(e.target.value); setYtError(""); }}
              placeholder="YouTubeのURLを貼り付け" className="w-full rounded-lg border-gray-300 text-xs py-1.5 px-2" />
            <input type="text" value={ytRequestTitle}
              onChange={(e) => setYtRequestTitle(e.target.value)}
              placeholder="曲名（省略可）" className="w-full rounded-lg border-gray-300 text-xs py-1.5 px-2" />
            <div className="flex gap-2">
              <button onClick={async () => {
                if (!ytRequestUrl || ytRequestUrl === "dummy") return;
                setYtRequesting(true);
                setYtError("");
                try {
                  const res = await fetch("/api/bgm/youtube-convert", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ youtubeUrl: ytRequestUrl, title: ytRequestTitle || undefined }),
                  });
                  const data = await res.json();
                  if (!res.ok) { setYtError(data.error || "変換失敗"); setYtRequesting(false); return; }
                  setYtRequestDone(true);
                  window.dispatchEvent(new CustomEvent("bgm-list-changed"));
                  loadAll();
                } catch { setYtError("ネットワークエラー"); }
                setYtRequesting(false);
              }} disabled={ytRequesting || !ytRequestUrl || ytRequestUrl === "dummy"}
                className="flex-1 text-xs bg-red-500 text-white rounded-full px-3 py-1.5 cursor-pointer disabled:opacity-40 border-none">
                {ytRequesting ? "変換中..." : "直接変換"}
              </button>
              <button onClick={async () => {
                if (!ytRequestUrl || ytRequestUrl === "dummy") return;
                setYtRequesting(true);
                setYtError("");
                try {
                  const res = await fetch("/api/bgm/request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ youtubeUrl: ytRequestUrl, title: ytRequestTitle || undefined }),
                  });
                  if (!res.ok) { setYtError("送信失敗"); setYtRequesting(false); return; }
                  setYtRequestDone(true);
                } catch { setYtError("ネットワークエラー"); }
                setYtRequesting(false);
              }} disabled={ytRequesting || !ytRequestUrl || ytRequestUrl === "dummy"}
                className="flex-1 text-xs bg-orange-500 text-white rounded-full px-3 py-1.5 cursor-pointer disabled:opacity-40 border-none">
                {ytRequesting ? "送信中..." : "管理者に依頼"}
              </button>
            </div>
            {ytError && <p className="text-xs text-red-500"><i className="fas fa-exclamation-circle" /> {ytError}</p>}
          </div>
        )}
        {ytRequestDone && (
          <div className="flex items-center gap-2">
            <p className="flex-1 text-xs text-green-600 flex items-center gap-1">
              <i className="fas fa-check-circle" /> マイBGMに追加しました！
            </p>
            <button onClick={() => { setYtRequestUrl("dummy"); setYtRequestTitle(""); setYtRequestDone(false); setYtError(""); }}
              className="text-xs text-gray-500 cursor-pointer bg-transparent border-none hover:text-gray-700">
              他のURL
            </button>
          </div>
        )}
        <Link href="/shop"
          className="block text-center text-xs bg-primary/10 text-primary rounded-full px-3 py-2 hover:bg-primary/20 no-underline">
          <i className="fas fa-shopping-cart mr-1" /> みんなのBGMを探す（ショップへ）
        </Link>
      </div>
    </div>
  );
}
