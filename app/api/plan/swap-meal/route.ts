import { createClient } from "@/lib/supabase/server";
import { openai } from "@/lib/openai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ensure profile row exists
  await supabase.from("profiles").upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });

  const body = await request.json();
  const { plan_id, day, slot } = body;

  if (!plan_id || !day || !slot) {
    return NextResponse.json({ error: "plan_id, day, and slot are required" }, { status: 400 });
  }

  // Fetch the plan
  const { data: mealPlan } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("id", plan_id)
    .eq("user_id", user.id)
    .single();

  if (!mealPlan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("calorie_target, protein_g, carbs_g, fat_g, dietary_restrictions, allergies, cuisines")
    .eq("id", user.id)
    .single();

  // Calculate remaining macros for the day
  const dayPlan = mealPlan.plan[day] ?? {};
  const otherSlots = Object.entries(dayPlan).filter(([s]) => s !== slot);
  const consumed = otherSlots.reduce(
    (acc, [, meal]) => {
      if (!meal) return acc;
      const m = meal as { calories: number; protein: number; carbs: number; fat: number };
      return {
        calories: acc.calories + (m.calories ?? 0),
        protein: acc.protein + (m.protein ?? 0),
        carbs: acc.carbs + (m.carbs ?? 0),
        fat: acc.fat + (m.fat ?? 0),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const remaining = {
    calories: (profile?.calorie_target ?? 2000) - consumed.calories,
    protein: (profile?.protein_g ?? 150) - consumed.protein,
    carbs: (profile?.carbs_g ?? 200) - consumed.carbs,
    fat: (profile?.fat_g ?? 65) - consumed.fat,
  };

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a nutritionist. Suggest a replacement ${slot} meal.
${profile?.dietary_restrictions?.length ? `Restrictions: ${profile.dietary_restrictions.join(", ")}` : ""}
${profile?.allergies?.length ? `Avoid: ${profile.allergies.join(", ")}` : ""}
Remaining budget for the day: ${remaining.calories} cal, ${remaining.protein}g protein, ${remaining.carbs}g carbs, ${remaining.fat}g fat.
Return ONLY JSON: { "name": string, "calories": number, "protein": number, "carbs": number, "fat": number, "ingredients": string[], "instructions": string[], "description": string }
- ingredients: 4–6 key ingredients as short strings
- instructions: 3–5 concise cooking steps
- description: one sentence explaining why this meal fits the goals`,
      },
      { role: "user", content: `Suggest a different ${slot} option.` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.9,
  });

  let newMeal;
  try {
    newMeal = JSON.parse(completion.choices[0].message.content ?? "{}");
  } catch {
    return NextResponse.json({ error: "Failed to parse meal suggestion" }, { status: 500 });
  }

  // Update the plan JSONB
  const updatedPlan = {
    ...mealPlan.plan,
    [day]: {
      ...(mealPlan.plan[day] ?? {}),
      [slot]: newMeal,
    },
  };

  const { error } = await supabase
    .from("meal_plans")
    .update({ plan: updatedPlan })
    .eq("id", plan_id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ meal: newMeal });
}
