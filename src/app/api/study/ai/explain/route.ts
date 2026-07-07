import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { front, back } = await request.json();
  if (!front?.trim()) return NextResponse.json({ error: "front required" }, { status: 400 });

  const key = process.env.GROQ_API_KEY;
  if (!key) return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 });

  const prompt = `あなたは学習チューターです。以下のフラッシュカードについて、学習者が理解を深められるよう解説してください。

表面（問題）: ${front}
裏面（答え）: ${back}

以下の形式で解説してください：
1. **なぜこの問題が重要なのか**: （1-2文）
2. **詳しい解説**: （3-5文、具体例を含む）
3. **よくある間違い**: （1文）
4. **暗記のコツ**: （1文）

解説は簡潔で分かりやすく、日本語で書いてください。`;

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
        max_tokens: 600,
        temperature: 0.5,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: `Groq API error: ${body}` }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    return NextResponse.json({ explanation: content });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
