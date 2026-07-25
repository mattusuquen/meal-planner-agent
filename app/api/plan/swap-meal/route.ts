import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { searchAndFetchRecipe, extractNutrition } from "@/lib/spoonacular";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // Calculate remaining macros for the day (excluding the slot being swapped)
  const dayPlan = mealPlan.plan[day] ?? {};
  const consumed = Object.entries(dayPlan)
    .filter(([s]) => s !== slot)
    .reduce(
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
    fat: (profile?.fat_g ?? 65) - consumed.fat,
  };

  // Pick a random cuisine from the user's preferences if they have any
  const cuisines = profile?.cuisines ?? [];
  const cuisine = cuisines.length
    ? cuisines[Math.floor(Math.random() * cuisines.length)]
    : undefined;

  const spoon = await searchAndFetchRecipe({
    cuisine,
    restrictions: profile?.dietary_restrictions ?? [],
    allergies: profile?.allergies ?? [],
    maxCalories: Math.max(remaining.calories, 200), // never go below 200 to avoid empty results
    minProtein: remaining.protein > 0 ? Math.round(remaining.protein * 0.3) : undefined,
    maxFat: remaining.fat > 0 ? Math.round(remaining.fat * 1.2) : undefined,
  });

  if (!spoon) {
    return NextResponse.json({ error: "No matching recipes found" }, { status: 404 });
  }

  const nutrition = extractNutrition(spoon);
  const instructions = spoon.analyzedInstructions
    .flatMap((block) => block.steps.map((s) => s.step))
    .filter(Boolean);

  const newMeal = {
    name: spoon.title,
    calories: nutrition.calories,
    protein: nutrition.protein_g,
    carbs: nutrition.carbs_g,
    fat: nutrition.fat_g,
    ingredients: spoon.extendedIngredients.map((i) => i.original),
    instructions,
    image_url: spoon.image || null,
  };

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
