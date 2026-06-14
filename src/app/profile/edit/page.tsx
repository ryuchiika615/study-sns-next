"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AppShell from "@/components/AppShell";
import { SELL_VALUES, BUY_COSTS, RARITY_LABELS } from "@/lib/utils";
import { SHOP_CATALOG } from "@/lib/data";

export default function EditProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [titles, setTitles] = useState<any[]>([]);
  const [icons, setIcons] = useState<any[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [department, setDepartment] = useState("");
  const [themeColor, setThemeColor] = useState("dark");
  const [targetDate, setTargetDate] = useState("");
  const [targetMinutes, setTargetMinutes] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      loadData();
    });
  }, []);

  const loadData = async () => {
    const [profileRes, itemsRes, notifRes] = await Promise.all([
      fetch("/api/profile"),
      fetch("/api/items"),
      fetch("/api/notifications"),
    ]);

    if (profileRes.ok) {
      const data = await profileRes.json();
      setProfile(data.profile);
      setDisplayName(data.profile.display_name || "");
      setBio(data.profile.bio || "");
      setDepartment(data.profile.department || "");
      setThemeColor(data.profile.theme_color || "dark");
      setTargetDate(data.profile.target_date || "");
      setTargetMinutes(String(data.profile.target_minutes || 0));
    }

    if (itemsRes.ok) {
      const data = await itemsRes.json();
      setItems(data.items);
      setTitles(data.titles);
      setIcons(data.icons);
    }

    if (notifRes.ok) {
      const data = await notifRes.json();
      setUnreadCount(data.unread_count);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("display_name", displayName);
    formData.append("bio", bio);
    formData.append("department", department);
    formData.append("theme_color", themeColor);
    formData.append("target_date", targetDate);
    formData.append("target_minutes", targetMinutes);

    const iconInput = document.querySelector<HTMLInputElement>('input[name="icon"]');
    if (iconInput?.files?.[0]) {
      formData.append("icon", iconInput.files[0]);
    }

    const res = await fetch("/api/profile", { method: "PUT", body: formData });
    if (res.ok) {
      setMessage("保存しました！");
      loadData();
    }
  };

  const handleEquip = async (itemId: string, slot: string) => {
    await fetch("/api/items/equip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, slot }),
    });
    loadData();
  };

  const handleBuy = async (rarity: string, itemType: string, itemName: string) => {
    const res = await fetch("/api/items/buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rarity, itemType, itemName }),
    });
    if (res.ok) {
      setMessage("購入しました！");
      loadData();
    } else {
      const data = await res.json();
      setMessage(data.error || "購入に失敗しました");
    }
  };

  const handleSell = async (itemIds: string[]) => {
    const res = await fetch("/api/items/sell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemIds }),
    });
    if (res.ok) {
      setMessage("売却しました！");
      loadData();
    }
  };

  const handleBulkSell = async (maxRarity: string) => {
    const res = await fetch("/api/items/sell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxRarity }),
    });
    if (res.ok) {
      setMessage("一括売却しました！");
      loadData();
    }
  };

  const handleCombine = async (itemIdA: string, itemIdB: string, order: string) => {
    const res = await fetch("/api/items/combine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemIdA, itemIdB, order }),
    });
    if (res.ok) {
      setMessage("合成しました！");
      loadData();
    }
  };

  if (!profile) return null;

  return (
    <AppShell unreadCount={unreadCount}>
      <div className="p-4 max-w-2xl mx-auto space-y-6">
        {message && (
          <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm">{message}</div>
        )}

        {/* プロフィール編集 */}
        <form onSubmit={handleUpdateProfile} className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <h2 className="text-lg font-bold">プロフィール設定</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">表示名</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">自己紹介</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300}
              className="w-full rounded-lg border-gray-300 text-sm" rows={3} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">部署</label>
            <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">テーマカラー</label>
            <input type="text" value={themeColor} onChange={(e) => setThemeColor(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">目標日</label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">目標時間(分)</label>
              <input type="number" value={targetMinutes} onChange={(e) => setTargetMinutes(e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm" min={0} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">アイコン画像</label>
            <input type="file" name="icon" accept="image/*" className="text-sm" />
          </div>

          <button type="submit" className="bg-primary text-white font-bold rounded-full px-6 py-2 text-sm">
            保存
          </button>
        </form>

        {/* ポイント表示 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{profile.points}</p>
              <p className="text-xs text-gray-500">ポイント</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{profile.exchange_points}</p>
              <p className="text-xs text-gray-500">交換ポイント</p>
            </div>
          </div>
        </div>

        {/* 称号一覧 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-bold mb-3">所持称号</h2>
          <div className="grid grid-cols-2 gap-2">
            {titles.map((item: any) => (
              <div key={item.id} className={`p-2 rounded-lg border text-sm ${profile.current_title_id === item.id ? 'border-primary bg-blue-50' : 'border-gray-200'}`}>
                <span className={`title-badge ${item.rarity} text-xs`}>{item.rarity}</span>
                <span className="ml-1">{item.name.replace("精錬:", "")}</span>
                <button onClick={() => handleEquip(item.id, "current_title_id")}
                  className="block mt-1 text-xs text-primary hover:underline">
                  装備する
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* アバター一覧 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-bold mb-3">所持アバター</h2>
          <div className="grid grid-cols-2 gap-2">
            {icons.map((item: any) => (
              <div key={item.id} className={`p-2 rounded-lg border text-sm ${profile.current_avatar_id === item.id ? 'border-primary bg-blue-50' : 'border-gray-200'}`}>
                <span className={`title-badge ${item.rarity} text-xs`}>{item.rarity}</span>
                <span className="ml-1">{item.name.replace("【アイコン】", "")}</span>
                <button onClick={() => handleEquip(item.id, "current_avatar_id")}
                  className="block mt-1 text-xs text-primary hover:underline">
                  装備する
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ショップ */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-bold mb-3">ショップ</h2>
          {["N", "R", "SR", "SSR", "UR", "LR"].map((rarity) => (
            <details key={rarity} className="mb-2">
              <summary className="cursor-pointer font-bold text-sm p-2 rounded-lg hover:bg-gray-50">
                {rarity} - {BUY_COSTS[rarity as keyof typeof BUY_COSTS]}ポイント (売却: {SELL_VALUES[rarity as keyof typeof SELL_VALUES]})
              </summary>
              <div className="grid grid-cols-2 gap-1 mt-1">
                {(SHOP_CATALOG.title[rarity as keyof typeof SHOP_CATALOG.title] || []).slice(0, 6).map((name: string) => (
                  <button key={name} onClick={() => handleBuy(rarity, "title", name)}
                    className="text-left text-xs p-1.5 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer">
                    {name.slice(0, 20)}
                  </button>
                ))}
              </div>
            </details>
          ))}
        </div>

        {/* 一括売却 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-bold mb-3">一括売却</h2>
          <div className="flex gap-2 flex-wrap">
            {["N", "R", "SR", "SSR", "UR"].map((rarity) => (
              <button key={rarity} onClick={() => handleBulkSell(rarity)}
                className="text-xs px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 cursor-pointer">
                {rarity}以下を売却
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
