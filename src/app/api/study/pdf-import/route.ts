import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (file.type !== "application/pdf") return NextResponse.json({ error: "PDFファイルを選択してください" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();

  let pdfData;
  try {
    const parser = new PDFParse({ data: arrayBuffer });
    pdfData = await parser.getText();
  } catch (e: any) {
    return NextResponse.json({ error: `PDFの読み取りに失敗しました: ${e.message}` }, { status: 500 });
  }

  const extractedText = pdfData.text?.trim();
  if (!extractedText || extractedText.length < 10) {
    return NextResponse.json({ error: "PDFからテキストを抽出できませんでした" }, { status: 500 });
  }

  const key = process.env.GROQ_API_KEY;
  if (!key) return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 });

  const truncatedText = extractedText.slice(0, 8000);

  const prompt = `以下のPDFから抽出されたテキストを元に、学習用のフラッシュカード（表面/裏面）を作成してください。
表面は「問題」や「質問」、裏面は「答え」や「解説」にしてください。
専門用語や重要な概念を重点的にカードにしてください。
各カードは简潔で分かりやすくしてください。

出力形式（厳守）:
[
  {"front": "問題文1", "back": "答え1"},
  {"front": "問題文2", "back": "答え2"}
]

テキスト内容:
${truncatedText}

要件:
- JSON配列のみ出力（マークダウンやコードブロック禁止）
- 表面は具体的な質問や用語の定義
- 裏面は正確な回答や解説
- 専門用語は正しく使用
- 難易度にばらつきを持たせる
- 15〜20枚程度作成`;

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
        max_tokens: 4000,
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
    if (!jsonMatch) return NextResponse.json({ error: "AI応答の解析に失敗しました" }, { status: 502 });

    const cards = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(cards)) return NextResponse.json({ error: "不正な応答形式" }, { status: 502 });

    const validCards = cards
      .filter((c: any) => c.front?.trim() && c.back?.trim())
      .map((c: any) => ({ front: c.front.trim(), back: c.back.trim() }));

    if (validCards.length === 0) return NextResponse.json({ error: "有効なカードを生成できませんでした" }, { status: 502 });

    return NextResponse.json({ cards: validCards, pageCount: pdfData.total, extractedLength: extractedText.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
