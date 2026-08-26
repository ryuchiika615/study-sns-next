import { awardMonthlyRanking, previousYearMonth } from "@/lib/monthly-ranking-reward";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secrets = [process.env.CRON_SECRET, process.env.WEBHOOK_SECRET].filter(Boolean);
  if (!secrets.some((secret) => auth === `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const requestedMonth = new URL(request.url).searchParams.get("month");
  try {
    return NextResponse.json(await awardMonthlyRanking(requestedMonth || previousYearMonth()));
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "月間報酬の処理に失敗しました。" }, { status: 400 });
  }
}

export const GET = run;
export const POST = run;
