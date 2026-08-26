import { createSpiCards, SPI_TARGET_COMPANIES } from "@/lib/spi-company-pack";
import { createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PARENT_NAME = "SPI実戦｜志望企業パック（オリジナル）";

export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existingDecks, error: existingError } = await supabase
    .from("decks")
    .select("id, name, sort_order")
    .eq("user_id", user.id);
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const existingByName = new Map((existingDecks || []).map((deck: any) => [deck.name, deck]));
  let parent = existingByName.get(PARENT_NAME);
  let nextSort = (existingDecks || []).reduce((max: number, deck: any) => Math.max(max, deck.sort_order ?? 0), -1) + 1;

  if (!parent) {
    const { data, error } = await supabase
      .from("decks")
      .insert({
        user_id: user.id,
        name: PARENT_NAME,
        description: "志望企業別のSPI形式オリジナル問題。実際の過去問・出題形式を転載または保証するものではありません。",
        sort_order: nextSort++,
      })
      .select("id, name")
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message || "親デッキの作成に失敗しました" }, { status: 500 });
    parent = data;
  }

  const missingCompanies = SPI_TARGET_COMPANIES.filter((company) => !existingByName.has(`SPI実戦｜${company}`));
  let createdDecks: any[] = [];
  if (missingCompanies.length > 0) {
    const { data, error: decksError } = await supabase
      .from("decks")
      .insert(missingCompanies.map((company) => ({
        user_id: user.id,
        parent_id: parent.id,
        name: `SPI実戦｜${company}`,
        description: "言語50問・非言語50問。SPIの公開された一般的な出題形式をもとにしたオリジナル実戦問題です。",
        sort_order: nextSort++,
      })))
      .select("id, name");
    if (decksError || !data) return NextResponse.json({ error: decksError?.message || "企業別デッキの作成に失敗しました" }, { status: 500 });
    createdDecks = data;
  }

  const targetDecks = SPI_TARGET_COMPANIES.map((company) => {
    const name = `SPI実戦｜${company}`;
    return existingByName.get(name) || createdDecks.find((deck) => deck.name === name);
  }).filter(Boolean);

  let createdCards = 0;
  for (const deck of targetDecks) {
    const company = deck.name.replace("SPI実戦｜", "");
    const companyIndex = SPI_TARGET_COMPANIES.indexOf(company as typeof SPI_TARGET_COMPANIES[number]);
    const { count, error: countError } = await supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("deck_id", deck.id)
      .eq("user_id", user.id);
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });

    const missingCards = createSpiCards(company, companyIndex).slice(count || 0);
    if (missingCards.length === 0) continue;
    const { error: cardsError } = await supabase
      .from("cards")
      .insert(missingCards.map((card) => ({ ...card, user_id: user.id, deck_id: deck.id })));
    if (cardsError) return NextResponse.json({ error: cardsError.message }, { status: 500 });
    createdCards += missingCards.length;
  }

  return NextResponse.json({
    created_decks: createdDecks.length,
    created_cards: createdCards,
    message: createdCards === 0 ? "SPI実戦パックはすでに各社100問ずつ追加済みです。" : undefined,
  });
}
