"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { itemDisplayName, isRefinedItem, RARITY_ORDER } from "@/lib/shop-catalog";
import RefineParts from "@/components/RefineParts";

export default function TitleManager({
  items, profile, onRefresh, onMessage,
}: {
  items: any[]; profile: any; onRefresh: (userId: string) => void; onMessage: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  const titles = items.filter((i: any) => i.category === "title");

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

  const handleEquip = async (itemId: string, slot: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: ownership } = await supabase.from("user_items").select("*").eq("user_id", user.id).eq("item_id", itemId).maybeSingle();
    if (ownership) {
      await supabase.from("profiles").update({ [slot]: itemId }).eq("id", user.id);
      onRefresh(user.id);
    }
  };

  const handleRefineParts = async (word: string, noun: string, namePart: string, order: string, connA?: string, connB?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.rpc("refine_parts", {
      p_word: word, p_noun: noun, p_name_part: namePart, p_order: order,
      p_conn_a: connA || '', p_conn_b: connB || '',
    });
    if (!error && data) {
      onMessage("精錬しました！");
      onRefresh(user.id);
    } else {
      onMessage(error?.message || "精錬に失敗しました");
    }
  };

  const sortByRarity = (list: any[]) => [...list].sort((a, b) => (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0));

  return (
    <div className="border-t border-gray-100 pt-3">
      <button type="button" onClick={() => { if (!open) { const u = profile?.id; if (u) onRefresh(u); } setOpen(!open); }}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition ${open ? 'bg-primary/10 border border-primary/20' : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'}`}>
        <div className="flex items-center gap-2">
          <i className={`fas fa-box ${open ? 'text-primary' : 'text-gray-400'} text-sm`} />
          <span className={`text-sm font-bold ${open ? 'text-primary' : 'text-gray-700'}`}>称号管理</span>
        </div>
        <div className="flex items-center gap-2">
          {titles.length > 0 && <span className="text-[10px] text-gray-400">{titles.length}個</span>}
          <i className={`fas fa-chevron-${open ? "up" : "down"} text-gray-400 text-xs transition-transform`} />
        </div>
      </button>

      {open && (
        <div className="space-y-3 pt-2">
          <div className="bg-gray-50 rounded-lg p-3">
            <h3 className="text-xs font-bold mb-2">称号を精錬</h3>
            <RefineParts parts={ownedParts()} onRefine={handleRefineParts} />
          </div>

          <div className="space-y-1">
            {(() => {
              const refined = sortByRarity(titles.filter((t) => isRefinedItem(t)));
              const raw = sortByRarity(titles.filter((t) => !isRefinedItem(t)));
              const list = [...refined, ...raw];
              if (!list.length) return <p className="text-xs text-gray-400">称号をまだ持っていません</p>;
              return list.map((item: any) => {
                const isEquipped = profile.current_title_id === item.id;
                return (
                  <div key={item.id} className={`flex items-center justify-between py-1.5 px-2 rounded-lg ${isEquipped ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`title-badge ${item.rarity} flex-shrink-0`}>{item.rarity}</span>
                      <span className="text-xs truncate">{itemDisplayName(item)}</span>
                      {isRefinedItem(item) && <span className="text-[10px] text-gray-400 flex-shrink-0">精錬品</span>}
                    </div>
                    <button type="button" onClick={() => handleEquip(item.id, "current_title_id")}
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
