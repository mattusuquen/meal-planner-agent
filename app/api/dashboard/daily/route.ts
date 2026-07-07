import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: totals }, { data: profile }, { data: meals }] = await Promise.all([
    supabase
      .from("daily_totals")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", date)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("calorie_target, protein_g, carbs_g, fat_g")
      .eq("id", user.id)
      .single(),
    supabase
      .from("logged_meals")
      .select("*, recipe:recipes(id, name, calories, protein_g, carbs_g, fat_g, image_url)")
      .eq("user_id", user.id)
      .eq("logged_date", date)
      .order("created_at", { ascending: true }),
  ]);

  return NextResponse.json({
    totals: totals ?? {
      user_id: user.id,
      date,
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      meals_logged: 0,
    },
    targets: {
      calories: profile?.calorie_target ?? 2000,
      protein_g: profile?.protein_g ?? 150,
      carbs_g: profile?.carbs_g ?? 200,
      fat_g: profile?.fat_g ?? 65,
    },
    meals: meals ?? [],
  });
}
