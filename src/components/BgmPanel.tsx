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

export default function BgmPanel({ onClose }: { onClose: () => void }) {
  const supabase = createClient();
  const [bgms, setBgms] = useState<BgmItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ytRequestUrl, setYtRequestUrl] = useState("");
  const [ytRequesting, setYtRequesting] = useState(false);
  const [ytRequestDone, setYtRequestDone] = useState(false);
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

  useEffect(() => {
    loadAll();
  }, []);

  const selectBgm = (item: BgmItem) => {
    setActiveId(item.id);
    window.dispatchEvent(new CustomEvent("bgm-select", { detail: item.id }));
  };

  const deleteBgm = async (item: BgmItem) => {
    if (item.source === "own" && item.dbId) {
      await supabase.from("audio_bgm").delete().eq("id", item.dbId);
    }
    if (item.source === "local") {
      URL.revokeObjectURL(item.audio_url);
      await idbDel(item.id);
      const meta = (await idbGet<{ id: string; name: string }[]>("list", "meta")) || [];
      await idbSave("list", meta.filter((m) => m.id !== item.id), "meta");
    }
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
    setUploading(false);
    window.dispatchEvent(new CustomEvent("bgm-list-changed"));
    loadAll();
  };

  const sourceLabel = (s: string) => {
    switch (s) {
      case "own": return "アップロード";
      case "purchased": return "購入";
      case "local": return "ローカル";
      default: return "";
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-base font-bold flex items-center gap-2">
          <i className="fas fa-music text-primary" /> マイBGM
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer bg-none border-none">
          <i className="fas fa-times" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {bgms.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">BGMがありません</p>
        )}
        {bgms.map((item) => (
          <div key={item.id} className={`flex items-center gap-3 p-2 rounded-xl ${
            activeId === item.id ? "bg-primary/10 border border-primary/30" : "hover:bg-gray-50"
          }`}>
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
              <i className="fas fa-music" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.name}</p>
              <p className="text-[10px] text-gray-400">{sourceLabel(item.source)}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => selectBgm(item)}
                className="text-xs bg-primary text-white rounded-full px-3 py-1 cursor-pointer hover:bg-primary/80 border-none">
                {activeId === item.id ? "使用中" : "使う"}
              </button>
              {(item.source === "own" || item.source === "local") && (
                <button onClick={() => deleteBgm(item)}
                  className="text-xs text-red-500 hover:bg-red-50 rounded-full px-2 py-1 cursor-pointer border-none bg-transparent"
                  title="削除">
                  <i className="fas fa-trash-alt" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 p-4 space-y-2">
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
          <button onClick={() => { setYtRequestUrl("dummy"); }}
            className="text-xs bg-gray-100 text-gray-700 rounded-full px-3 py-2 cursor-pointer hover:bg-gray-200 border-none flex items-center justify-center gap-1 w-full">
            <i className="fab fa-youtube text-red-500" /> YouTubeをリクエスト
          </button>
        )}
        {ytRequestUrl && !ytRequestDone && (
          <div className="flex items-center gap-2">
            <input type="url" value={ytRequestUrl === "dummy" ? "" : ytRequestUrl}
              onChange={(e) => setYtRequestUrl(e.target.value)}
              placeholder="YouTubeのURLを貼り付け" className="flex-1 rounded-lg border-gray-300 text-xs py-1.5 px-2" />
            <button onClick={async () => {
              if (!ytRequestUrl || ytRequestUrl === "dummy") return;
              setYtRequesting(true);
              try {
                await fetch("/api/bgm/request", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ youtubeUrl: ytRequestUrl }),
                });
                setYtRequestDone(true);
              } catch {}
              setYtRequesting(false);
            }} disabled={ytRequesting || !ytRequestUrl || ytRequestUrl === "dummy"}
              className="text-xs bg-red-500 text-white rounded-full px-3 py-1.5 cursor-pointer disabled:opacity-40 border-none shrink-0">
              {ytRequesting ? "送信中..." : "リクエスト"}
            </button>
          </div>
        )}
        {ytRequestDone && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <i className="fas fa-check-circle" /> 管理者に送信しました。変換されるまでお待ちください。
          </p>
        )}
        <Link href="/shop"
          className="block text-center text-xs bg-primary/10 text-primary rounded-full px-3 py-2 hover:bg-primary/20 no-underline">
          <i className="fas fa-shopping-cart mr-1" /> みんなのBGMを探す（ショップへ）
        </Link>
      </div>
    </div>
  );
}
