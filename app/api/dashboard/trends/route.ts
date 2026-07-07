import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "weekly";
  const days = period === "monthly" ? 30 : 7;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split("T")[0];

  const [{ data: dailyData }, { data: profile }] = await Promise.all([
    supabase
      .from("daily_totals")
      .select("date, calories, protein_g, carbs_g, fat_g")
      .eq("user_id", user.id)
      .gte("date", sinceStr)
      .order("date", { ascending: true }),
    supabase
      .from("profiles")
      .select("calorie_target")
      .eq("id", user.id)
      .single(),
  ]);

  const data = dailyData ?? [];
  const calorieTarget = profile?.calorie_target ?? 2000;

  const avgCalories = data.length
    ? Math.round(data.reduce((s, d) => s + (d.calories ?? 0), 0) / data.length)
    : 0;
  const avgProtein = data.length
    ? Math.round(data.reduce((s, d) => s + (d.protein_g ?? 0), 0) / data.length)
    : 0;
  const adherenceDays = data.filter(
    (d) => Math.abs((d.calories ?? 0) - calorieTarget) / calorieTarget <= 0.1
  ).length;

  return NextResponse.json({
    data,
    summary: {
      avg_calories: avgCalories,
      avg_protein: avgProtein,
      adherence_days: adherenceDays,
      total_days: data.length,
      calorie_target: calorieTarget,
    },
  });
}
