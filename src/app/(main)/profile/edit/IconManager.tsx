"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { itemDisplayName, RARITY_ORDER } from "@/lib/shop-catalog";
import { rarityClass, getOptimizedIconUrl } from "@/lib/utils";
import Image from "next/image";

export default function IconManager({
  items, profile, onRefresh, onMessage,
}: {
  items: any[]; profile: any; onRefresh: (userId: string) => void; onMessage: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  const icons = items.filter((i: any) => i.category === "icon");

  const handleEquip = async (itemId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: ownership } = await supabase.from("user_items").select("*").eq("user_id", user.id).eq("item_id", itemId).maybeSingle();
    if (ownership) {
      await supabase.from("profiles").update({ current_avatar_id: itemId }).eq("id", user.id);
      onRefresh(user.id);
    }
  };

  const sortByRarity = (list: any[]) => [...list].sort((a, b) => (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0));

  return (
    <div className="border-t border-gray-100 pt-3">
      <button type="button" onClick={() => { if (!open) { const u = profile?.id; if (u) onRefresh(u); } setOpen(!open); }}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition ${open ? 'bg-primary/10 border border-primary/20' : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'}`}>
        <div className="flex items-center gap-2">
          <i className={`fas fa-image ${open ? 'text-primary' : 'text-gray-400'} text-sm`} />
          <span className={`text-sm font-bold ${open ? 'text-primary' : 'text-gray-700'}`}>アイコンフレーム</span>
        </div>
        <div className="flex items-center gap-2">
          {icons.length > 0 && <span className="text-[10px] text-gray-400">{icons.length}個</span>}
          <i className={`fas fa-chevron-${open ? "up" : "down"} text-gray-400 text-xs transition-transform`} />
        </div>
      </button>

      {open && (
        <div className="space-y-2 pt-2">
          {/* 現在装備中のプレビュー */}
          {profile.current_avatar_id && (() => {
            const equipped = icons.find((i: any) => i.id === profile.current_avatar_id);
            if (!equipped) return null;
            return (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-50 border border-primary/20">
                <div className={`avatar-frame ${rarityClass(equipped.rarity)} w-14 h-14 min-w-[56px]`} data-icon={itemDisplayName(equipped).replace("【アイコン】", "")}>
                  {profile?.icon_url ? (
                    <Image src={getOptimizedIconUrl(profile.icon_url, 168)} width={56} height={56} className="rounded-full object-cover border-2 border-white" alt="" />
                  ) : (
                    <i className="fas fa-user-circle text-4xl text-gray-300" />
                  )}
                </div>
                <div>
                  <span className={`title-badge ${equipped.rarity} text-[10px]`}>{equipped.rarity}</span>
                  <p className="text-xs font-bold mt-0.5">{itemDisplayName(equipped).replace("【アイコン】", "")}</p>
                  <p className="text-[10px] text-gray-400">装備中</p>
                </div>
              </div>
            );
          })()}

          <div className="space-y-1 max-h-48 overflow-y-auto">
            {(() => {
              const list = sortByRarity(icons);
              if (!list.length) return <p className="text-xs text-gray-400">アイコンフレームをまだ持っていません</p>;
              return list.map((item: any) => {
                const isEquipped = profile.current_avatar_id === item.id;
                return (
                  <div key={item.id} className={`flex items-center justify-between py-1.5 px-2 rounded-lg ${isEquipped ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`title-badge ${item.rarity} flex-shrink-0`}>{item.rarity}</span>
                      <span className="text-xs truncate">{itemDisplayName(item).replace("【アイコン】", "")}</span>
                    </div>
                    <button type="button" onClick={() => handleEquip(item.id)}
                      className={`text-xs flex-shrink-0 px-3 py-1.5 rounded-full font-bold cursor-pointer transition ${isEquipped ? 'bg-primary text-white shadow-sm' : 'bg-white text-primary border border-primary hover:bg-primary hover:text-white'}`}>
                      {isEquipped ? "装備中" : "装備"}
                    </button>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
