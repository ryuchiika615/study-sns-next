"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase";
import { getOptimizedIconUrl, formatStudyTime } from "@/lib/utils";

type Challenge = {
  id: string;
  challenger_id: string;
  opponent_id: string;
  message: string;
  challenge_type: string;
  target_value: number;
  status: string;
  winner_id: string | null;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  challenger?: { id: string; display_name: string | null; username: string | null; icon_url: string | null };
  opponent?: { id: string; display_name: string | null; username: string | null; icon_url: string | null };
};

export default function ChallengesClient({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [outgoing, setOutgoing] = useState<Challenge[]>([]);
  const [incoming, setIncoming] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutualFollows, setMutualFollows] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOpponent, setSelectedOpponent] = useState("");
  const [challengeMessage, setChallengeMessage] = useState("");
  const [challengeTarget, setChallengeTarget] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchChallenges = async () => {
    const res = await fetch("/api/challenges");
    if (res.ok) {
      const data = await res.json();
      setOutgoing(data.outgoing || []);
      setIncoming(data.incoming || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchChallenges();
    // Fetch mutual follows for challenge creation
    supabase.from("follows").select("following_id, following:following_id(id, display_name, username, icon_url)")
      .eq("follower_id", userId).then(async ({ data: myFollows }) => {
        if (!myFollows?.length) return;
        const followingIds = myFollows.map(f => f.following_id);
        const { data: reverseFollows } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", userId)
          .in("follower_id", followingIds);
        if (!reverseFollows?.length) return;
        const mutualIds = new Set(reverseFollows.map(f => f.follower_id));
        setMutualFollows(myFollows.filter(f => mutualIds.has(f.following_id)).map(f => f.following));
      });
  }, []);

  const handleCreate = async () => {
    if (!selectedOpponent || !challengeMessage) return;
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        opponent_id: selectedOpponent,
        message: challengeMessage,
        target_value: challengeTarget,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error || "エラーが発生しました");
      return;
    }
    setShowCreate(false);
    setSelectedOpponent("");
    setChallengeMessage("");
    setChallengeTarget(0);
    fetchChallenges();
  };

  const handleRespond = async (challengeId: string, action: "accept" | "decline") => {
    const res = await fetch(`/api/challenges/${challengeId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      fetchChallenges();
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "pending": return <span className="text-yellow-500 text-xs font-bold">待機中</span>;
      case "accepted": return <span className="text-green-500 text-xs font-bold">対決中</span>;
      case "declined": return <span className="text-red-400 text-xs font-bold">断られた</span>;
      case "cancelled": return <span className="text-gray-400 text-xs font-bold">キャンセル</span>;
      case "completed": return <span className="text-blue-500 text-xs font-bold">完了</span>;
      default: return <span className="text-xs">{status}</span>;
    }
  };

  return (
    <AppShell>
      <div className="mx-4 my-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">🔥 勉強チャレンジ</h2>
          <button onClick={() => setShowCreate(true)}
            className="bg-primary text-white text-sm rounded-full px-4 py-1.5 font-bold cursor-pointer hover:bg-blue-600 transition active:scale-95">
            <i className="fas fa-plus mr-1" />勝負を仕掛ける
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
            <h3 className="font-bold text-sm">新しい勝負</h3>
            <select value={selectedOpponent} onChange={(e) => setSelectedOpponent(e.target.value)}
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm">
              <option value="">相手を選択</option>
              {mutualFollows.map((u: any) => (
                <option key={u.id} value={u.id}>{u.display_name || u.username}</option>
              ))}
            </select>
            <input type="text" value={challengeMessage} onChange={(e) => setChallengeMessage(e.target.value)}
              placeholder="挑戦文（例: 今週50分多く勉強した方が勝ち！）"
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm" />
            <input type="number" value={challengeTarget || ""} onChange={(e) => setChallengeTarget(parseInt(e.target.value) || 0)}
              placeholder="目標値（分）"
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm" />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={submitting}
                className="flex-1 bg-primary text-white rounded-full py-2 text-sm font-bold cursor-pointer hover:bg-blue-600 transition disabled:opacity-50">
                {submitting ? "送信中..." : "勝負を仕掛ける！"}
              </button>
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 border border-gray-200 rounded-full text-sm cursor-pointer hover:bg-gray-50 transition">
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* Incoming challenges */}
        {incoming.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-500 mb-2">📩 仕掛けられた勝負</h3>
            <div className="space-y-2">
              {incoming.map((c) => (
                <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                      {c.challenger?.icon_url ? (
                        <Image src={getOptimizedIconUrl(c.challenger.icon_url, 120)} width={40} height={40} className="rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400"><i className="fas fa-user text-sm" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">{c.challenger?.display_name || c.challenger?.username || "ユーザー"}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{c.message}</p>
                    </div>
                    <div>{statusLabel(c.status)}</div>
                  </div>
                  {c.status === "pending" && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleRespond(c.id, "accept")}
                        className="flex-1 bg-green-500 text-white rounded-full py-1.5 text-xs font-bold cursor-pointer hover:bg-green-600 transition active:scale-95">
                        受ける！
                      </button>
                      <button onClick={() => handleRespond(c.id, "decline")}
                        className="flex-1 border border-gray-200 text-gray-500 rounded-full py-1.5 text-xs cursor-pointer hover:bg-gray-50 transition active:scale-95">
                        断る
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outgoing challenges */}
        {outgoing.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-500 mb-2">🔥 仕掛けた勝負</h3>
            <div className="space-y-2">
              {outgoing.map((c) => (
                <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                      {c.opponent?.icon_url ? (
                        <Image src={getOptimizedIconUrl(c.opponent.icon_url, 120)} width={40} height={40} className="rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400"><i className="fas fa-user text-sm" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">{c.opponent?.display_name || c.opponent?.username || "ユーザー"}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{c.message}</p>
                    </div>
                    <div>{statusLabel(c.status)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && incoming.length === 0 && outgoing.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-12 text-center">
            <p className="text-4xl mb-3">🔥</p>
            <p className="text-gray-500 text-sm mb-1">まだ勝負がありません</p>
            <p className="text-xs text-gray-400">相互フォローのユーザーに勝負を仕掛けてみよう！</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
