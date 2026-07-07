import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function sm2(rating: number, prevEase: number, prevInterval: number, prevReps: number) {
  let ef = prevEase + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
  if (ef < 1.3) ef = 1.3;

  let interval: number;
  let reps: number;

  if (rating >= 3) {
    reps = prevReps + 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.round(prevInterval * ef);
  } else {
    reps = 0;
    interval = 1;
  }

  const due = new Date();
  due.setDate(due.getDate() + interval);
  const dueDate = due.toISOString().split("T")[0];

  return { easiness_factor: ef, interval_days: interval, repetitions: reps, due_date: dueDate };
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { card_id, rating } = await request.json();
  if (!card_id) return NextResponse.json({ error: "card_id required" }, { status: 400 });
  if (typeof rating !== "number" || rating < 0 || rating > 3)
    return NextResponse.json({ error: "rating must be 0-3" }, { status: 400 });

  // Map UI rating (0=Again, 1=Hard, 2=Good, 3=Easy) to SM-2 rating (0-5 scale)
  const sm2Rating = rating === 0 ? 1 : rating === 1 ? 2 : rating === 2 ? 3 : 4;

  // Get latest review for this card
  const { data: lastReview } = await supabase
    .from("reviews")
    .select("*")
    .eq("card_id", card_id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevEase = lastReview?.easiness_factor ?? 2.5;
  const prevInterval = lastReview?.interval_days ?? 0;
  const prevReps = lastReview?.repetitions ?? 0;

  const result = sm2(sm2Rating, prevEase, prevInterval, prevReps);

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      card_id,
      user_id: user.id,
      rating,
      interval_days: result.interval_days,
      repetitions: result.repetitions,
      easiness_factor: result.easiness_factor,
      due_date: result.due_date,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ review: data });
}
