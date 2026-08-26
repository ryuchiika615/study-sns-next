import { requireAdmin } from "@/lib/admin-auth";
import { awardMonthlyRanking, previousYearMonth } from "@/lib/monthly-ranking-reward";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  try {
    return NextResponse.json(await awardMonthlyRanking(body.yearMonth || previousYearMonth()));
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "月間報酬の処理に失敗しました。" }, { status: 400 });
  }
}
