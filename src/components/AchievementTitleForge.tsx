"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { RARITY_ORDER } from "@/lib/shop-catalog";

type CharacterDefinition = {
  id: string;
  character: string;
  label: string;
  description: string;
  rarity: string;
  sort_order: number;
};

const GOJUON = ["あ", "い", "う", "え", "お", "か", "き", "く", "け", "こ", "さ", "し", "す", "せ", "そ", "た", "ち", "つ", "て", "と", "な", "に", "ぬ", "ね", "の", "は", "ひ", "ふ", "へ", "ほ", "ま", "み", "む", "め", "も", "や", "ゆ", "よ", "ら", "り", "る", "れ", "ろ", "わ", "を", "ん"];

export default function AchievementTitleForge({ onCreated, onMessage, collectionOnly = false }: { onCreated: () => void; onMessage: (message: string) => void; collectionOnly?: boolean }) {
  const supabase = createClient();
  const [definitions, setDefinitions] = useState<CharacterDefinition[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setLoading(false); return; }
    const [defsResult, ownedResult] = await Promise.all([
      supabase.from("title_character_definitions").select("id, character, label, description, rarity, sort_order").order("sort_order"),
      supabase.from("user_title_characters").select("definition_id").eq("user_id", userData.user.id),
    ]);
    setDefinitions((defsResult.data || []) as CharacterDefinition[]);
    setOwned(new Set((ownedResult.data || []).map((item: any) => item.definition_id)));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const selectedCharacters = useMemo(() => selected.map((id) => definitions.find((item) => item.id === id)?.character || "").join(""), [selected, definitions]);
  const gojuonDefinitions = useMemo(() => [...definitions].sort((a, b) => {
    const aOrder = GOJUON.indexOf(a.character);
    const bOrder = GOJUON.indexOf(b.character);
    return (aOrder < 0 ? 999 : aOrder) - (bOrder < 0 ? 999 : bOrder);
  }), [definitions]);

  const toggle = (id: string) => {
    if (!owned.has(id)) return;
    setSelected((previous) => previous.includes(id)
      ? previous.filter((item) => item !== id)
      : previous.length >= 8 ? previous : [...previous, id]);
  };

  const checkAchievements = async () => {
    setChecking(true);
    const { data, error } = await supabase.rpc("sync_title_characters");
    setChecking(false);
    if (error) { onMessage(error.message); return; }
    const newCharacters = data?.new_characters || [];
    await load();
    onMessage(newCharacters.length ? `新しく ${newCharacters.map((item: any) => `「${item.character}」`).join("・")} を解放！` : "新しく解放できる文字はありません。次の実績を目指そう！");
  };

  const createTitle = async () => {
    if (selected.length < 2) { onMessage("文字を2個以上選んでください。"); return; }
    setCreating(true);
    const { data, error } = await supabase.rpc("create_custom_title", { p_definition_ids: selected });
    setCreating(false);
    if (error) { onMessage(error.message); return; }
    onMessage(`自作称号「${selectedCharacters}」を作成して装備しました！`);
    setSelected([]);
    onCreated();
  };

  return (
    <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="text-sm font-black text-violet-950">✦ 実績で五十音を解放</h3><p className="mt-0.5 text-[11px] leading-relaxed text-violet-800">あ〜んの文字を実績で集めよう。解放順・難易度はランダム。{collectionOnly ? "称号の作成・装備はプロフィール設定から行えます。" : "集めた文字を2〜8個並べて、自分だけの称号を作れます。"}</p></div>
        <button type="button" onClick={checkAchievements} disabled={checking} className="shrink-0 rounded-full bg-violet-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{checking ? "確認中…" : "実績を確認"}</button>
      </div>

      {collectionOnly ? <div className="mt-3 rounded-lg bg-slate-950 px-3 py-2 text-center text-sm font-black text-white">解放済み：{owned.size}/{definitions.length || 46} 文字　プロフィール設定で称号を作れます</div> : <><div className="mt-3 rounded-lg bg-slate-950 px-3 py-2 text-center text-lg font-black tracking-[0.25em] text-white">{selectedCharacters || "称号を組み立てよう"}</div>
      <p className="mt-1 text-center text-[10px] text-violet-700">{selected.length}/8文字選択中。強い実績の文字を入れるほどレア度も上がります。</p></>}

      {loading ? <p className="py-4 text-center text-xs text-gray-400">文字を読み込み中…</p> : (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {gojuonDefinitions.map((item) => {
            const unlocked = owned.has(item.id);
            const active = selected.includes(item.id);
            return <button key={item.id} type="button" onClick={() => !collectionOnly && toggle(item.id)} disabled={!unlocked}
              className={`min-h-[76px] rounded-lg border p-1.5 text-left transition ${active ? "border-violet-600 bg-violet-600 text-white shadow" : unlocked ? "border-violet-200 bg-white hover:border-violet-400" : "cursor-not-allowed border-gray-200 bg-gray-100 opacity-60"}`}>
              <div className="flex items-center justify-between"><span className="text-xl font-black">{unlocked ? item.character : "🔒"}</span><span className={`title-badge ${item.rarity} text-[9px]`}>{item.rarity}</span></div>
              <p className={`mt-1 text-[10px] font-bold leading-tight ${active ? "text-white" : "text-gray-700"}`}>{item.label}</p>
              <p className={`mt-0.5 text-[9px] leading-tight ${active ? "text-white/85" : "text-gray-500"}`}>{item.description}</p>
            </button>;
          })}
        </div>
      )}
      {!collectionOnly && <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setSelected([])} disabled={!selected.length} className="rounded-full border border-violet-300 bg-white px-3 py-2 text-xs font-bold text-violet-700 disabled:opacity-40">選択を戻す</button>
        <button type="button" onClick={createTitle} disabled={creating || selected.length < 2} className="flex-1 rounded-full bg-gradient-to-r from-violet-700 to-fuchsia-600 px-3 py-2 text-sm font-black text-white disabled:opacity-40">{creating ? "作成中…" : "この称号を作成・装備"}</button>
      </div>}
    </div>
  );
}
