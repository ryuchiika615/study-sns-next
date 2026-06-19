"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import AppShell from "@/components/AppShell";
import StudyBGMRecorder from "@/components/StudyBGMRecorder";
import { SHOP_CATALOG, SELL_VALUES, BUY_COSTS, RARITY_ORDER, isRefinedItem, itemDisplayName } from "@/lib/shop-catalog";
import RefineParts from "@/components/RefineParts";
import { getOptimizedIconUrl } from "@/lib/utils";

const RARITIES = ["N", "R", "SR", "SSR", "UR", "LR"];

export default function ShopClient({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [titles, setTitles] = useState<any[]>([]);
  const [icons, setIcons] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [message, setMessage] = useState("");
  const [selectedSell, setSelectedSell] = useState<Set<string>>(new Set());
  const [bgmUserId, setBgmUserId] = useState("");
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const supabase = createClient();

  const loadData = async () => {
    const [profileResult, notifResult] = await Promise.all([
      supabase.from("profiles").select("id, display_name, username, bio, icon_url, points, exchange_points, current_title_id, current_avatar_id").eq("id", userId).single(),
      supabase.from("notifications").select("*", { count: "exact", head: true }).eq("recipient_id", userId).eq("is_read", false).neq("notification_type", "follow_post"),
    ]);

    if (profileResult.data) {
      setProfile(profileResult.data);
    }

    setUnreadCount(notifResult.count || 0);
  };

  const loadInventory = useCallback(async () => {
    const { data: userItemsResult } = await supabase
      .from("user_items")
      .select("*, item:item_id(*)")
      .eq("user_id", userId);

    if (userItemsResult) {
      const items = userItemsResult.map((ui: any) => ui.item);
      setItems(items);
      setTitles(items.filter((i: any) => i.category === "title"));
      setIcons(items.filter((i: any) => i.category === "icon"));
    }
  }, [userId, supabase]);

  useEffect(() => {
    if (userId) {
      setBgmUserId(userId);
      loadData();
    }
  }, [userId]);

  const handleEquip = async (itemId: string, slot: string) => {
    const { data: ownership } = await supabase
      .from("user_items")
      .select("*")
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .maybeSingle();

    if (ownership) {
      await supabase
        .from("profiles")
        .update({ [slot]: itemId })
        .eq("id", userId);
      loadData();
    }
  };

  const handleBuy = async (rarity: string, itemType: string, itemName: string) => {
    const { data, error } = await supabase.rpc("buy_item", {
      p_rarity: rarity, p_item_type: itemType, p_item_name: itemName,
    });
    if (!error && data) {
      setMessage(`${itemName} を交換しました！`);
      loadData();
    } else {
      setMessage(error?.message || "交換に失敗しました");
    }
  };

  const handleSell = async (itemIds: string[]) => {
    const { data, error } = await supabase.rpc("sell_items", {
      p_item_ids: itemIds,
    });
    if (!error && data) {
      setMessage("売却しました！");
      setSelectedSell(new Set());
      loadData();
    }
  };

  const handleBulkSell = async (maxRarity: string) => {
    const { data, error } = await supabase.rpc("sell_items", {
      p_item_ids: [], p_max_rarity: maxRarity,
    });
    if (!error && data) {
      setMessage("売却しました！");
      loadData();
    }
  };

  const handleRefineParts = async (word: string, noun: string, namePart: string, order: string, connA?: string, connB?: string) => {
    const { data, error } = await supabase.rpc("refine_parts", {
      p_word: word, p_noun: noun, p_name_part: namePart, p_order: order,
      p_conn_a: connA || '', p_conn_b: connB || '',
    });
    if (!error && data) {
      setMessage("精錬しました！");
      loadData();
    } else {
      setMessage(error?.message || "精錬に失敗しました");
    }
  };

  const toggleSellItem = (id: string) => {
    setSelectedSell((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canSell = (item: any) => {
    if (item.id === profile.current_title_id) return false;
    if (item.id === profile.current_avatar_id) return false;
    return true;
  };

  const sortTitles = (list: any[]) => {
    return [...list].sort((a, b) => {
      return (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0);
    });
  };

  const titleCard = (item: any) => {
    const isEquipped = profile.current_title_id === item.id;
    const sellable = canSell(item);
    return (
      <div key={item.id} className={`relative p-2 rounded-lg border text-sm ${isEquipped ? 'border-primary bg-blue-50' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <span className={`title-badge ${item.rarity} text-xs`}>{item.rarity}</span>
          {isRefinedItem(item) && <span className="text-xs text-gray-400">精錬品</span>}
        </div>
        <span className="ml-1 text-sm">{itemDisplayName(item)}</span>
        <div className="flex gap-1 mt-1">
          <button onClick={() => handleEquip(item.id, "current_title_id")}
            className="flex-1 text-xs text-primary hover:underline py-0.5">
            {isEquipped ? "装備中" : "装備"}
          </button>
          {sellable && (
            <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={selectedSell.has(item.id)}
                onChange={() => toggleSellItem(item.id)} />
              {isRefinedItem(item) ? "捨てる" : "売却"}
            </label>
          )}
        </div>
      </div>
    );
  };

  const ownedParts = () => {
    const displayNames = titles.map((t: any) => itemDisplayName(t));
    const tokens = new Set<string>();
    for (const name of displayNames) {
      tokens.add(name);
      const parts = name.split(/[\s,、。．.（）()「」【】]+/).filter(Boolean);
      for (const p of parts) tokens.add(p);
    }
    return [...tokens].sort();
  };

  if (!profile) return null;

  return (
    <AppShell unreadCount={unreadCount}>
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {message && (
          <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm">{message}</div>
        )}

        {/* ポイント表示 */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-orange-500">{profile.exchange_points || 0}</p>
          <p className="text-[10px] text-gray-500">ポイント</p>
        </div>

        {/* 交換ショップ */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <h2 className="text-sm font-bold mb-1">交換ショップ</h2>
          <p className="text-[10px] text-gray-500 mb-2">売却で得た交換ptで称号やアイコンフレームを購入できます</p>
          {(() => {
            const ownedTitles = new Set(titles.map((t: any) => t.name));
            const ownedIcons = new Set(icons.map((i: any) => i.name));
            return RARITIES.map((rarity) => (
              <div key={rarity} className="mb-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0">
                <div className="flex items-center justify-between mb-2">
                  <span className={`title-badge ${rarity}`}>{rarity}</span>
                  <span className="text-sm text-gray-500">購入 {BUY_COSTS[rarity]}pt / 売却 {SELL_VALUES[rarity]}pt</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <select id={`shop-title-${rarity}`} className="w-full rounded-lg border-gray-300 text-xs p-1.5">
                      {SHOP_CATALOG.title[rarity].map((name: string) => (
                        <option key={name} value={name} disabled={ownedTitles.has(name)}>
                          {name}{ownedTitles.has(name) ? " （取得済み）" : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const select = document.getElementById(`shop-title-${rarity}`) as HTMLSelectElement;
                        handleBuy(rarity, "title", select.value);
                      }}
                      disabled={(profile.exchange_points || 0) < BUY_COSTS[rarity]}
                      className="w-full mt-1 text-xs bg-primary text-white rounded-full py-1.5 disabled:opacity-40"
                    >
                      称号を交換
                    </button>
                  </div>
                  <div>
                    <select id={`shop-icon-${rarity}`} className="w-full rounded-lg border-gray-300 text-xs p-1.5">
                      {SHOP_CATALOG.icon[rarity].map((name: string) => (
                        <option key={name} value={name} disabled={ownedIcons.has(name)}>
                          {name.replace("【アイコン】", "")}{ownedIcons.has(name) ? " （取得済み）" : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const select = document.getElementById(`shop-icon-${rarity}`) as HTMLSelectElement;
                        handleBuy(rarity, "icon", select.value);
                      }}
                      disabled={(profile.exchange_points || 0) < BUY_COSTS[rarity]}
                      className="w-full mt-1 text-xs bg-orange-500 text-white rounded-full py-1.5 disabled:opacity-40"
                    >
                      アイコンを交換
                    </button>
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>

        {/* BGM録音・販売 */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <h2 className="text-sm font-bold mb-2"><i className="fas fa-microphone mr-1" /> BGM録音・販売</h2>
          {bgmUserId && <StudyBGMRecorder key={bgmUserId} supabase={supabase} userId={bgmUserId} />}
        </div>

        {/* 称号管理（開いたらロード） */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button onClick={() => {
            if (!inventoryOpen) loadInventory();
            setInventoryOpen(!inventoryOpen);
          }}
            className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition">
            <div className="flex items-center gap-2">
              <i className="fas fa-box text-primary text-sm" />
              <h2 className="text-sm font-bold">称号管理</h2>
            </div>
            <i className={`fas fa-chevron-${inventoryOpen ? "up" : "down"} text-gray-400 text-xs transition-transform`} />
          </button>

          {inventoryOpen && (
            <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-3">
              {/* 称号を精錬（部位組み合わせ） */}
              <div>
                <h3 className="text-xs font-bold mb-2">称号を精錬（部位組み合わせ）</h3>
                <RefineParts parts={ownedParts()} onRefine={handleRefineParts} />
              </div>

              {/* 一括売却 */}
              <div>
                <h3 className="text-xs font-bold mb-2">一括売却</h3>
                <p className="text-[10px] text-gray-500 mb-2">装備中は売却できません（精錬品は0ptで捨てられます）</p>
                <div className="flex gap-2">
                  {["N", "R", "SR"].map((rarity) => (
                    <button key={rarity} onClick={() => handleBulkSell(rarity)}
                      className="flex-1 bg-red-50 text-red-600 border border-red-200 rounded-lg py-2 text-xs font-medium hover:bg-red-100">
                      {rarity}以下を売却
                    </button>
                  ))}
                </div>
              </div>

              {/* 称号一覧 */}
              <div>
                <h3 className="text-xs font-bold mb-2">所持称号 ({titles.length})</h3>
                {(() => {
                  const refined = sortTitles(titles.filter((t: any) => isRefinedItem(t)));
                  const raw = sortTitles(titles.filter((t: any) => !isRefinedItem(t)));
                  return (
                    <>
                      {refined.length > 0 && (
                        <>
                          <p className="text-xs text-gray-400 mb-1.5">精錬品称号 ({refined.length})</p>
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            {refined.map((item: any) => titleCard(item))}
                          </div>
                        </>
                      )}
                      {raw.length > 0 && (
                        <>
                          <p className="text-xs text-gray-400 mb-1.5">通常称号 ({raw.length})</p>
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            {raw.map((item: any) => titleCard(item))}
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
                {selectedSell.size > 0 && (
                  <button onClick={() => handleSell(Array.from(selectedSell))}
                    className="mt-3 w-full bg-red-500 text-white rounded-full py-2 text-sm font-medium">
                    選択した{selectedSell.size}個を売却 (+{Array.from(selectedSell).reduce((sum, id) => {
                      const item = items.find((i: any) => i.id === id);
                      if (!item) return sum;
                      if (isRefinedItem(item)) return sum;
                      return sum + (SELL_VALUES[item?.rarity] || 0);
                    }, 0)}pt)
                  </button>
                )}
              </div>

              {/* アバター一覧 */}
              <div>
                <h3 className="text-xs font-bold mb-2">所持アバター ({icons.length})</h3>
                <div className="grid grid-cols-2 gap-2">
                  {icons.map((item: any) => {
                    const isEquipped = profile.current_avatar_id === item.id;
                    const sellable = canSell(item);
                    return (
                      <div key={item.id} className={`p-2 rounded-lg border text-sm ${isEquipped ? 'border-primary bg-blue-50' : 'border-gray-200'}`}>
                        <span className={`title-badge ${item.rarity} text-xs`}>{item.rarity}</span>
                        <span className="ml-1">{itemDisplayName(item).replace("【アイコン】", "")}</span>
                        <div className="flex gap-1 mt-1">
                          <button onClick={() => handleEquip(item.id, "current_avatar_id")}
                            className="flex-1 text-xs text-primary hover:underline py-0.5">
                            {isEquipped ? "装備中" : "装備"}
                          </button>
                          {sellable && (
                            <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                              <input type="checkbox" checked={selectedSell.has(item.id)}
                                onChange={() => toggleSellItem(item.id)} />
                              売却
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}
