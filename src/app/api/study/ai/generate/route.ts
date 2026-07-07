import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { topic, count } = await request.json();
  if (!topic?.trim()) return NextResponse.json({ error: "topic required" }, { status: 400 });

  const numCards = Math.min(Math.max(count || 5, 1), 20);

  const key = process.env.GROQ_API_KEY;
  if (!key) return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 });

  const prompt = `以下のトピックについて、学習用のフラッシュカード（表面/裏面）を${numCards}個作成してください。
各カードは「表面」と「裏面」を明確に分けて、JSON配列形式で出力してください。

トピック: ${topic}

出力形式（厳守）:
[
  {"front": "質問文1", "back": "回答文1"},
  {"front": "質問文2", "back": "回答文2"}
]

要件:
- 表面は具体的な質問や問題
- 裏面は正確な回答や解説
- 専門用語は正しく使用
- 難易度にばらつきを持たせる
- JSON以外のテキストは一切出力しない`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: `Groq API error: ${body}` }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return NextResponse.json({ error: "Failed to parse AI response" }, { status: 502 });

    const cards = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(cards)) return NextResponse.json({ error: "Invalid response format" }, { status: 502 });

    const validCards = cards
      .filter((c: any) => c.front?.trim() && c.back?.trim())
      .map((c: any) => ({ front: c.front.trim(), back: c.back.trim() }));

    if (validCards.length === 0) return NextResponse.json({ error: "No valid cards generated" }, { status: 502 });

    return NextResponse.json({ cards: validCards });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
