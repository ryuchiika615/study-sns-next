"use client";

import { useState, useRef, useEffect } from "react";

type BGM = {
  id: string;
  user_id: string;
  name: string;
  duration_seconds: number;
  audio_url: string;
  price: number;
  plays_count: number;
  created_at: string;
  seller_name?: string;
};

const MAX_RECORD_SECONDS = 10;

export default function StudyBGMRecorder({ supabase, userId }: { supabase: any; userId: string }) {
  const [myBgms, setMyBgms] = useState<BGM[]>([]);
  const [marketBgms, setMarketBgms] = useState<BGM[]>([]);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"record" | "market">("record");

  // Recording state
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [bgmName, setBgmName] = useState("");
  const [bgmPrice, setBgmPrice] = useState(100);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [myRes, marketRes, purchasedRes] = await Promise.all([
      supabase.from("audio_bgm").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("audio_bgm").select("*, profiles!audio_bgm_user_id_fkey(display_name, username)").neq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("purchased_bgm").select("bgm_id").eq("user_id", userId),
    ]);
    if (myRes.data) setMyBgms(myRes.data);
    if (marketRes.data) {
      setMarketBgms(marketRes.data.map((b: any) => ({
        ...b,
        seller_name: b.profiles?.display_name || b.profiles?.username || "ユーザー",
      })));
    }
    if (purchasedRes.data) {
      setPurchasedIds(new Set(purchasedRes.data.map((p: any) => p.bgm_id)));
    }
  };

  const startRecording = async () => {
    try {
      setMessage("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };

      recorder.start();
      setRecording(true);
      setRecordingTime(0);

      let elapsed = 0;
      timerRef.current = setInterval(() => {
        elapsed++;
        setRecordingTime(elapsed);
        if (elapsed >= MAX_RECORD_SECONDS) {
          stopRecording();
        }
      }, 1000);
    } catch (e: any) {
      setMessage("マイクへのアクセスを許可してください");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setRecording(false);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingTime(0);
  };

  const handleUpload = async () => {
    if (!recordedBlob || !bgmName.trim()) return;
    setUploading(true);
    setMessage("");
    try {
      const fileName = `bgm/${userId}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("audio-bgm")
        .upload(fileName, recordedBlob, { contentType: "audio/webm" });
      if (uploadError) { setMessage("アップロード失敗"); setUploading(false); return; }
      const { data: urlData } = supabase.storage.from("audio-bgm").getPublicUrl(fileName);
      if (!urlData?.publicUrl) { setMessage("URL取得失敗"); setUploading(false); return; }

      const { error } = await supabase.from("audio_bgm").insert({
        user_id: userId,
        name: bgmName.trim(),
        duration_seconds: recordingTime || MAX_RECORD_SECONDS,
        audio_url: urlData.publicUrl,
        price: bgmPrice,
      });
      if (error) { setMessage(error.message); } else {
        setMessage("出品しました！");
        setBgmName("");
        setBgmPrice(100);
        setRecordedBlob(null);
        setRecordedUrl(null);
        setRecordingTime(0);
        loadData();
      }
    } catch { setMessage("エラーが発生しました"); }
    setUploading(false);
  };

  const handlePurchase = async (bgmId: string) => {
    const { data, error } = await supabase.rpc("purchase_bgm", { p_bgm_id: bgmId });
    if (error) { setMessage(error.message); return; }
    setMessage("購入しました！");
    loadData();
  };

  const handleDelete = async (bgmId: string) => {
    const { error } = await supabase.from("audio_bgm").delete().eq("id", bgmId);
    if (!error) loadData();
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-gray-500">自分の声でBGMを録音（最大10秒）、ループ再生されます。出品すると他のユーザーが購入でき、売上の90%が手に入ります。</p>

      {message && (
        <div className={`text-xs p-2 rounded-lg ${message.includes("失敗") || message.includes("エラー") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
          {message}
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-100 pb-2">
        <button onClick={() => setTab("record")}
          className={`text-xs font-medium px-3 py-1 rounded-full cursor-pointer ${tab === "record" ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-100"}`}>
          録音する
        </button>
        <button onClick={() => setTab("market")}
          className={`text-xs font-medium px-3 py-1 rounded-full cursor-pointer ${tab === "market" ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-100"}`}>
          BGMマーケット ({marketBgms.length})
        </button>
      </div>

      {tab === "record" && (
        <div className="space-y-2">
          {/* 録音UI */}
          {!recordedBlob && (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
              {!recording ? (
                <button onClick={startRecording}
                  className="text-sm bg-red-500 text-white rounded-full px-5 py-2 font-bold cursor-pointer hover:bg-red-600 transition">
                  <i className="fas fa-microphone mr-1" /> 録音開始（{MAX_RECORD_SECONDS}秒）
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-sm font-bold text-red-500">録音中 {recordingTime}秒 / {MAX_RECORD_SECONDS}秒</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-red-500 h-2 rounded-full transition-all"
                      style={{ width: `${(recordingTime / MAX_RECORD_SECONDS) * 100}%` }} />
                  </div>
                  <button onClick={stopRecording}
                    className="text-xs bg-gray-800 text-white rounded-full px-4 py-1.5 cursor-pointer">
                    停止
                  </button>
                </div>
              )}
            </div>
          )}

          {/* プレビュー */}
          {recordedUrl && (
            <div className="space-y-2">
              <audio ref={audioPreviewRef} src={recordedUrl} controls className="w-full h-8" />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={bgmName} onChange={(e) => setBgmName(e.target.value)}
                  placeholder="BGM名" className="rounded-lg border-gray-300 text-xs p-1.5" />
                <div className="flex items-center gap-1">
                  <input type="number" value={bgmPrice} onChange={(e) => setBgmPrice(Math.max(10, parseInt(e.target.value) || 0))}
                    min={10} className="flex-1 rounded-lg border-gray-300 text-xs p-1.5" />
                  <span className="text-xs text-gray-500">pt</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleUpload} disabled={!bgmName.trim() || uploading}
                  className="flex-1 text-xs bg-primary text-white rounded-full py-1.5 disabled:opacity-40 cursor-pointer">
                  {uploading ? "出品中..." : "出品する"}
                </button>
                <button onClick={cancelRecording}
                  className="text-xs bg-gray-200 text-gray-600 rounded-full px-3 py-1.5 cursor-pointer">
                  録り直す
                </button>
              </div>
            </div>
          )}

          {/* 自分のBGM一覧 */}
          {myBgms.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1.5">あなたのBGM ({myBgms.length})</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {myBgms.map((bgm) => (
                  <div key={bgm.id} className="flex items-center justify-between p-2 rounded-lg border border-gray-200">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-xs font-medium truncate">{bgm.name}</p>
                      <p className="text-[10px] text-gray-400">{bgm.price}pt / 再生{bgm.plays_count}回</p>
                    </div>
                    <button onClick={() => handleDelete(bgm.id)}
                      className="text-xs text-red-500 cursor-pointer">削除</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "market" && (
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {marketBgms.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-3">まだBGMがありません</p>
          )}
          {marketBgms.map((bgm) => {
            const isOwn = bgm.user_id === userId;
            const isPurchased = purchasedIds.has(bgm.id);
            return (
              <div key={bgm.id} className="flex items-center justify-between p-2 rounded-lg border border-gray-200">
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-xs font-medium truncate">{bgm.name}</p>
                  <p className="text-[10px] text-gray-400">by {bgm.seller_name} / {bgm.price}pt</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <audio src={bgm.audio_url} controls className="h-7 w-24" />
                  {isPurchased ? (
                    <span className="text-[10px] text-green-600 font-medium">購入済</span>
                  ) : (
                    <button onClick={() => handlePurchase(bgm.id)}
                      className="text-xs bg-primary text-white rounded-full px-2.5 py-1 cursor-pointer hover:bg-blue-600">
                      購入
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
