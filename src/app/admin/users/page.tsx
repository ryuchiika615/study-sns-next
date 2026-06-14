"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import { SHOP_CATALOG, RARITY_ORDER, itemDisplayName } from "@/lib/shop-catalog";

const RARITIES = Object.keys(RARITY_ORDER);

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [modal, setModal] = useState<{ user: any; action: string } | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [showBannedOnly, setShowBannedOnly] = useState(false);
  // gift modal state
  const [giftRarity, setGiftRarity] = useState("N");
  const [giftType, setGiftType] = useState("title");
  const [giftName, setGiftName] = useState("");
  const [giftUser, setGiftUser] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      fetchUsers();
    });
  }, []);

  const fetchUsers = async () => {
    const res = await fetch("/api/admin/users");
    if (res.status === 403) { setError("管理者のみアクセスできます"); return; }
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
  };

  const openModal = (user: any, action: string) => {
    setModal({ user, action });
    setInputValue("");
  };

  const handleAction = async () => {
    if (!modal) return;
    setLoading(true);
    const { user, action } = modal;

    const body: any = { userId: user.id, action };
    if (action === "set_password") body.value = inputValue;
    else if (action === "change_username") body.value = inputValue;
    else if (action === "set_points") body.value = inputValue;
    else if (action === "ban") body.value = inputValue || "管理者判断";
    else if (action === "toggle_admin") {}

    const res = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      setMessage(data.message || "成功しました");
      setModal(null);
      fetchUsers();
    } else {
      const data = await res.json();
      setMessage(data.error || "エラー");
    }
    setLoading(false);
  };

  const handleGift = async () => {
    if (!giftUser || !giftName) return;
    setLoading(true);
    const res = await fetch("/api/admin/gift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: giftUser.id, itemName: giftName, rarity: giftRarity, itemType: giftType }),
    });
    if (res.ok) {
      setMessage(`${itemDisplayName(giftName)} を ${giftUser.display_name || giftUser.username} に贈りました！`);
      setGiftUser(null);
      setGiftName("");
    } else {
      const data = await res.json();
      setMessage(data.error || "プレゼントに失敗しました");
    }
    setLoading(false);
  };

  const modalContent = () => {
    if (!modal) return null;
    const { user, action } = modal;
    switch (action) {
      case "set_password":
        return { title: "パスワード変更", placeholder: "新しいパスワードを入力", input: true };
      case "change_username":
        return { title: "ユーザーID変更", placeholder: `新しいユーザーID (現在: ${user.username})`, input: true };
      case "set_points":
        return { title: "ポイント設定", placeholder: `新しいポイント数 (現在: ${user.points})`, input: true };
      case "ban":
        return { title: "BANする", placeholder: "BAN理由（任意）", input: true };
      default:
        return null;
    }
  };

  const mc = modalContent();
  const displayedUsers = showBannedOnly ? users.filter((u) => u.is_banned) : users;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-b from-gray-900 to-blue-900 border-b-4 border-yellow-600 text-center py-6 shadow-lg">
        <Link href="/admin" className="absolute left-4 top-6 text-yellow-600 text-lg">
          <i className="fas fa-arrow-left" />
        </Link>
        <h1 className="text-3xl text-yellow-600 font-serif tracking-wider m-0">ユーザー管理</h1>
      </div>

      <div className="max-w-5xl mx-auto p-4">
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg text-center mb-4">{error}</div>}
        {message && <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-4">{message}</div>}

        {/* フィルター */}
        <div className="flex gap-2 mb-3">
          <button onClick={() => setShowBannedOnly(false)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer ${!showBannedOnly ? "bg-primary text-white" : "bg-gray-100 text-gray-600"}`}>
            全員
          </button>
          <button onClick={() => setShowBannedOnly(true)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer ${showBannedOnly ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600"}`}>
            BAN中 ({users.filter((u) => u.is_banned).length})
          </button>
        </div>

        {/* 通常モーダル */}
        {modal && mc && (
          <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center" onClick={() => setModal(null)}>
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-4">{mc.title}</h3>
              <p className="text-sm text-gray-500 mb-3">
                対象: <span className="font-bold text-gray-900">{modal.user?.display_name || modal.user?.username}</span>
              </p>
              {mc.input && (
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={mc.placeholder}
                  className="w-full rounded-lg border-gray-300 text-sm mb-4"
                  autoFocus
                />
              )}
              <div className="flex gap-2">
                <button onClick={() => setModal(null)}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm cursor-pointer hover:bg-gray-50">
                  キャンセル
                </button>
                <button onClick={handleAction} disabled={loading}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold cursor-pointer hover:bg-blue-600 disabled:opacity-50">
                  {loading ? "実行中..." : "実行"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* プレゼントモーダル */}
        {giftUser && (
          <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center" onClick={() => setGiftUser(null)}>
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-4">アイテムをプレゼント</h3>
              <p className="text-sm text-gray-500 mb-3">
                対象: <span className="font-bold text-gray-900">{giftUser.display_name || giftUser.username}</span>
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">種類</label>
                  <select value={giftType} onChange={(e) => { setGiftType(e.target.value); setGiftName(""); }}
                    className="w-full rounded-lg border-gray-300 text-sm">
                    <option value="title">称号</option>
                    <option value="icon">アイコンフレーム</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">レア度</label>
                  <select value={giftRarity} onChange={(e) => { setGiftRarity(e.target.value); setGiftName(""); }}
                    className="w-full rounded-lg border-gray-300 text-sm">
                    {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">アイテム名</label>
                  <select value={giftName} onChange={(e) => setGiftName(e.target.value)}
                    className="w-full rounded-lg border-gray-300 text-sm">
                    <option value="">-- 選択 --</option>
                    {(SHOP_CATALOG[giftType as keyof typeof SHOP_CATALOG]?.[giftRarity] || []).map((name: string) => (
                      <option key={name} value={name}>{itemDisplayName(name)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setGiftUser(null)}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm cursor-pointer hover:bg-gray-50">
                  キャンセル
                </button>
                <button onClick={handleGift} disabled={loading || !giftName}
                  className="flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-bold cursor-pointer hover:bg-purple-700 disabled:opacity-50">
                  {loading ? "実行中..." : "プレゼント"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left whitespace-nowrap">ユーザー</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">状態</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Pts</th>
                <th className="px-3 py-2 text-center whitespace-nowrap" colSpan={5}>操作</th>
              </tr>
            </thead>
            <tbody>
              {displayedUsers.map((u: any) => (
                <tr key={u.id} className={`border-t border-gray-100 ${u.is_banned ? "bg-red-50" : ""}`}>
                  <td className="px-3 py-2">
                    <div className="font-bold">{u.display_name || u.username}</div>
                    <div className="text-xs text-gray-500">@{u.username}</div>
                    {u.is_banned && <div className="text-xs text-red-600 font-bold mt-1">🚫 {u.ban_reason || "BAN中"}</div>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex gap-1">
                      <button onClick={() => openModal(u, "toggle_admin")}
                        className={`text-xs px-2 py-1 rounded-full cursor-pointer ${u.is_admin ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
                        {u.is_admin ? "管理者" : "一般"}
                      </button>
                      {u.is_banned ? (
                        <button onClick={() => { setModal({ user: u, action: "unban" }); handleAction(); }}
                          className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 cursor-pointer">
                          解除
                        </button>
                      ) : (
                        <button onClick={() => openModal(u, "ban")}
                          className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 cursor-pointer">
                          BAN
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-bold">{u.points}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => openModal(u, "set_password")}
                      className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer whitespace-nowrap">
                      パスワード
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => openModal(u, "change_username")}
                      className="text-xs px-2 py-1 rounded bg-purple-50 text-purple-600 hover:bg-purple-100 cursor-pointer whitespace-nowrap">
                      ID変更
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => openModal(u, "set_points")}
                      className="text-xs px-2 py-1 rounded bg-orange-50 text-orange-600 hover:bg-orange-100 cursor-pointer whitespace-nowrap">
                      ポイント
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => setGiftUser(u)}
                      className="text-xs px-2 py-1 rounded bg-pink-50 text-pink-600 hover:bg-pink-100 cursor-pointer whitespace-nowrap">
                      プレゼント
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
