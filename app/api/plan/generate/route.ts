import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { planGraph } from "@/lib/langchain/graphs/planGraph";

function getWeekDays(weekStart: string): string[] {
  // Parse as local noon to avoid UTC midnight offset issues across timezones
  const start = new Date(weekStart + "T12:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { week_start } = body;

  if (!week_start) {
    return NextResponse.json(
      { error: "week_start is required" },
      { status: 400 }
    );
  }

  // Ensure profile row exists (handles signup before migration trigger)
  await supabase
    .from("profiles")
    .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const days = getWeekDays(week_start);
  const slots =
    profile?.meal_structure === "3_meals"
      ? ["Breakfast", "Lunch", "Dinner"]
      : ["Breakfast", "Lunch", "Dinner", "Snacks"];

  const result = await planGraph.invoke({
    supabase,
    userId: user.id,
    weekStart: week_start,
    days,
    slots,
    profile,
  });

  if (result.error || !result.savedPlan) {
    console.error(
      "[POST /api/plan/generate] graph error:",
      result.error ?? "no plan saved"
    );
    return NextResponse.json(
      { error: result.error ?? "Failed to generate meal plan" },
      { status: 500 }
    );
  }

  return NextResponse.json({ plan: result.savedPlan });
}
