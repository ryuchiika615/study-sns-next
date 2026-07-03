"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function AdminBgmPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [giftUserId, setGiftUserId] = useState("");
  const [giftName, setGiftName] = useState("");
  const [giftFile, setGiftFile] = useState<File | null>(null);
  const [tab, setTab] = useState<"requests" | "gift">("requests");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      const { data: p } = await supabase.from("profiles").select("is_admin").eq("id", data.user.id).single();
      if (!p?.is_admin) { setError("管理者のみアクセスできます"); return; }
      loadRequests();
      loadUsers();
    });
  }, []);

  const loadRequests = async () => {
    const { data } = await supabase
      .from("bgm_requests")
      .select("*, user:user_id(id, display_name, username)")
      .order("created_at", { ascending: false });
    if (data) setRequests(data);
  };

  const loadUsers = async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users || []);
    }
  };

  const handleGift = async () => {
    if (!giftUserId || !giftName || !giftFile) return;
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    // Upload MP3
    const fileExt = giftFile.name.split(".").pop() || "mp3";
    const fileName = `bgm/gift/${giftUserId}/${Date.now()}.${fileExt}`;
    const { error: upErr } = await supabase.storage.from("audio-bgm").upload(fileName, giftFile);
    if (upErr) { setMessage("アップロード失敗: " + upErr.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("audio-bgm").getPublicUrl(fileName);
    if (!urlData?.publicUrl) { setMessage("URL取得失敗"); setUploading(false); return; }

    const res = await fetch("/api/admin/bgm-gift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: giftUserId, name: giftName, audioUrl: urlData.publicUrl }),
    });

    if (res.ok) {
      setMessage("BGMをプレゼントしました！");
      setGiftFile(null);
      setGiftName("");
    } else {
      const data = await res.json();
      setMessage(data.error || "エラー");
    }
    setUploading(false);
  };

  const handleRequestGift = async (req: any) => {
    if (!giftFile) return;
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const fileExt = giftFile.name.split(".").pop() || "mp3";
    const fileName = `bgm/gift/${req.user_id}/${Date.now()}.${fileExt}`;
    const { error: upErr } = await supabase.storage.from("audio-bgm").upload(fileName, giftFile);
    if (upErr) { setMessage("アップロード失敗"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("audio-bgm").getPublicUrl(fileName);
    if (!urlData?.publicUrl) { setMessage("URL取得失敗"); setUploading(false); return; }

    const res = await fetch("/api/admin/bgm-gift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: req.user_id,
        name: req.title || giftFile.name.replace(/\.[^/.]+$/, ""),
        audioUrl: urlData.publicUrl,
        requestId: req.id,
      }),
    });

    if (res.ok) {
      setMessage(`${req.user?.display_name || req.user_id} にBGMをプレゼントしました！`);
      setGiftFile(null);
      loadRequests();
    } else {
      const data = await res.json();
      setMessage(data.error || "エラー");
    }
    setUploading(false);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-50 text-red-600 p-6 rounded-lg text-center">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-b from-gray-900 to-blue-900 border-b-4 border-yellow-600 text-center py-6 shadow-lg">
        <h1 className="text-3xl text-yellow-600 font-serif m-0">BGM管理</h1>
        <Link href="/admin" className="text-sm text-yellow-600 hover:text-yellow-400">← ダッシュボードに戻る</Link>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {message && (
          <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm">{message}</div>
        )}

        <div className="flex gap-2">
          <button onClick={() => setTab("requests")}
            className={`px-4 py-2 rounded-full text-sm cursor-pointer border-none ${tab === "requests" ? "bg-primary text-white" : "bg-white text-gray-600"}`}>
            リクエスト一覧
          </button>
          <button onClick={() => setTab("gift")}
            className={`px-4 py-2 rounded-full text-sm cursor-pointer border-none ${tab === "gift" ? "bg-primary text-white" : "bg-white text-gray-600"}`}>
            BGMをプレゼント
          </button>
        </div>

        {tab === "requests" && (
          <div className="space-y-3">
            {requests.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">リクエストはありません</p>
            )}
            {requests.map((req) => (
              <div key={req.id} className="bg-white rounded-xl p-4 border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{req.user?.display_name || "不明"} (@{req.user?.username})</p>
                    <p className="text-xs text-gray-500">{new Date(req.created_at).toLocaleString("ja-JP")}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    req.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                    req.status === "completed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {req.status === "pending" ? "未対応" : req.status === "completed" ? "完了" : req.status}
                  </span>
                </div>
                <a href={req.youtube_url} target="_blank" className="text-xs text-blue-500 hover:underline block truncate">
                  {req.youtube_url}
                </a>
                {req.title && <p className="text-xs text-gray-600">タイトル: {req.title}</p>}
                {req.status === "pending" && (
                  <div className="flex items-center gap-2 pt-1">
                    <input type="file" accept="audio/*" className="text-xs flex-1"
                      onChange={(e) => setGiftFile(e.target.files?.[0] || null)} />
                    <button onClick={() => handleRequestGift(req)} disabled={!giftFile || uploading}
                      className="text-xs bg-primary text-white rounded-full px-3 py-1.5 cursor-pointer disabled:opacity-40 border-none shrink-0">
                      {uploading ? "処理中..." : "変換してプレゼント"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "gift" && (
          <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-3">
            <p className="text-sm font-bold">任意のBGMをユーザーにプレゼント</p>
            <div>
              <label className="text-xs text-gray-600 block mb-1">対象ユーザー</label>
              <select value={giftUserId} onChange={(e) => setGiftUserId(e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm py-1.5">
                <option value="">選択してください</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.display_name || u.username} (@{u.username})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">BGM名</label>
              <input type="text" value={giftName} onChange={(e) => setGiftName(e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm py-1.5" placeholder="曲名" />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">MP3ファイル</label>
              <input type="file" accept="audio/*" className="text-sm"
                onChange={(e) => setGiftFile(e.target.files?.[0] || null)} />
            </div>
            <button onClick={handleGift} disabled={!giftUserId || !giftName || !giftFile || uploading}
              className="w-full bg-primary text-white font-bold rounded-full py-2 text-sm cursor-pointer disabled:opacity-40 border-none">
              {uploading ? "アップロード中..." : "BGMをプレゼント"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
